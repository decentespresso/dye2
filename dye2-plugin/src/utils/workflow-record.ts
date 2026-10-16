/**
 * Dial-in recording: while a recipe or favourite is "armed" (the one the barista last
 * applied from the dashboard), edits made to the live workflow are written back into
 * that item's own KV entry, so the Streamline skin no longer has to read-modify-write
 * DYE2's arrays itself (docs/KV_CONTRACT.md, "Single-writer rule").
 *
 * Like recent-favs.ts this runs in the PLUGIN runtime (no DOM, no imports) and is also
 * importable by a node test (test/workflow-record.test.mjs). The fetch-like dependency
 * is injected; plugin.ts wires it to the real `fetch` and persists the selection.
 *
 * Flow: dashboard applies an item -> POST /selection -> armSelection(). The host fires
 * `workflowUpdated` on every workflow change -> scheduleWorkflowRecord() debounces ->
 * recordWorkflow() patches ONLY the fields that differ on that ONE item.
 */

type AnyRecord = Record<string, any>;

type FetchLike = (
  url: string,
  init?: AnyRecord
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

export interface Selection {
  kind: "recipe" | "favourite";
  id: string;
  /** Fingerprint of the profile the item was armed on; null until first seen. */
  profileFingerprint: string | null;
  /**
   * Live step-0 temperature when armed (then rebased after each record). apply never
   * pushes a recipe's brewC (docs/KV_CONTRACT.md: display only), so the live profile
   * may legitimately differ from the stored value; brewC is recorded only when the
   * live value moves off this baseline, i.e. a real brew-temp edit. Null = unknown.
   */
  armedBrewC: number | null;
}

const DEBOUNCE_MS = 1500;
const ECHO_WINDOW_MS = 3000;

// kind -> KV key and the sub-object holding the dashboard-derived values.
const TARGETS = {
  recipe: { key: "recipes", field: "dashboardVariables" },
  favourite: { key: "autoFavourites", field: "snapshot" },
} as const;

let selection: Selection | null = null;
let onSelectionChange: ((s: Selection | null) => void) | null = null;
let timer: any = null;
let suppressed: { values: string; at: number } | null = null;

// ── profile drift ───────────────────────────────────────────────────────────
// Ported from streamline_project/src/modules/dye-selection.js. Decaid's
// workflow.profile carries no `id` (decaid#90), so an id check alone never fires; the
// fingerprint covers the fields a real profile switch changes. steps[*].temperature is
// stripped because a brew-temp edit PUTs the same profile back with only that changed
// — otherwise every temperature tweak would look like a new profile and disarm us.
// target_weight/target_volume are left out for the same reason: they are the yield, and
// Streamline's yield writes send the profile back with only those changed. Streamline's
// own identity() in wake-profile.js excludes them too.
export function profileFingerprint(profile: AnyRecord | null | undefined): string | null {
  if (!profile) return null;
  const steps = Array.isArray(profile.steps)
    ? profile.steps.map(({ temperature, ...rest }: AnyRecord) => rest)
    : profile.steps;
  return JSON.stringify({
    title: profile.title,
    tank_temperature: profile.tank_temperature,
    steps,
  });
}

/** Has the live workflow's profile moved away from the one the selection was armed on? */
export function profileDrifted(sel: Selection | null, workflow: AnyRecord | null | undefined): boolean {
  if (!sel) return false;
  const fp = profileFingerprint(workflow && workflow.profile);
  return !!(sel.profileFingerprint && fp && fp !== sel.profileFingerprint);
}

// ── field mappers ───────────────────────────────────────────────────────────

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function put(out: AnyRecord, k: string, v: unknown) {
  if (v !== undefined && v !== null) out[k] = v;
}

/** Everything the live workflow says that a recipe could hold, in dashboardVariables names. */
export function recipeFields(wf: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  const ctx = (wf && wf.context) || {};
  put(out, "dose", ctx.targetDoseWeight);
  put(out, "drink", ctx.targetYield);
  put(out, "grind", num(ctx.grinderSetting));
  const steps = wf && wf.profile && wf.profile.steps;
  put(out, "brewC", num(steps && steps[0] && steps[0].temperature));
  put(out, "steamTimeS", wf && wf.steamSettings && wf.steamSettings.duration);
  put(out, "steamFlowMls", wf && wf.steamSettings && wf.steamSettings.flow);
  put(out, "hotWaterMl", wf && wf.hotWaterData && wf.hotWaterData.volume);
  put(out, "hotWaterTempC", wf && wf.hotWaterData && wf.hotWaterData.targetTemperature);
  put(out, "flushS", wf && wf.rinseData && wf.rinseData.duration);
  return out;
}

/** A favourite's snapshot has no brew-temp/steam/hot-water/flush field: dose/drink/grind only. */
export function favouriteFields(wf: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  const ctx = (wf && wf.context) || {};
  put(out, "dose", ctx.targetDoseWeight);
  put(out, "drink", ctx.targetYield);
  put(out, "grindSetting", num(ctx.grinderSetting));
  return out;
}

/** The entries of `patch` that differ from `stored`, compared numerically where both are numbers. */
export function changedFields(patch: AnyRecord, stored: AnyRecord | undefined): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(patch || {})) {
    const cur = stored ? stored[k] : undefined;
    const same =
      cur === v || (cur != null && v != null && Number.isFinite(Number(cur)) && Number(cur) === Number(v));
    if (!same) out[k] = v;
  }
  return out;
}

/**
 * What to write onto `item` for the live workflow `wf`: only fields the item already
 * holds (a workflow always has a value for steam/hot water/flush, so diffing against an
 * absent field would stamp the whole workflow onto the item — a blanket resync) and
 * only those whose value differs. The paired *Mode fields follow whichever of their
 * two values moved.
 */
export function itemPatch(
  kind: Selection["kind"],
  item: AnyRecord,
  wf: AnyRecord,
  armedBrewC: number | null = null
): AnyRecord {
  const stored = item[TARGETS[kind].field] || {};
  const all = kind === "recipe" ? recipeFields(wf) : favouriteFields(wf);
  // apply only writes the active mode's field (the other keeps whatever the machine
  // last had), so only that one is the user's; the mode itself is never written.
  const skip = new Set<string>();
  if (stored.steamMode === "time") skip.add("steamFlowMls");
  else if (stored.steamMode === "flow") skip.add("steamTimeS");
  if (stored.hotWaterMode === "vol") skip.add("hotWaterTempC");
  else if (stored.hotWaterMode === "temp") skip.add("hotWaterMl");
  const known: AnyRecord = {};
  for (const k of Object.keys(all)) {
    if (stored[k] == null || skip.has(k)) continue;
    if (k === "brewC" && (armedBrewC == null || all.brewC === armedBrewC)) continue;
    known[k] = all[k];
  }
  return changedFields(known, stored);
}

// ── selection ───────────────────────────────────────────────────────────────

export function getSelection(): Selection | null {
  return selection;
}

/** plugin.ts registers this to persist the selection whenever it changes. */
export function setSelectionListener(fn: ((s: Selection | null) => void) | null) {
  onSelectionChange = fn;
}

function cancelPending() {
  if (timer != null && typeof clearTimeout === "function") clearTimeout(timer);
  timer = null;
}

function setSel(next: Selection | null) {
  // Anything debounced belongs to the previous selection; never let it land on the new one.
  cancelPending();
  selection = next;
  if (onSelectionChange) onSelectionChange(next);
}

function liveBrewC(wf: AnyRecord): number | null {
  const v = recipeFields(wf).brewC;
  return v === undefined ? null : v;
}

// Mutates the armed selection in place (identity is what the debounce timer checks)
// and tells the persistence listener, so a reload does not lose the baseline.
function updateSelection(sel: Selection, changes: Partial<Selection>) {
  Object.assign(sel, changes);
  if (selection === sel && onSelectionChange) onSelectionChange(sel);
}

export function clearSelection() {
  setSel(null);
}

/** Restore a persisted selection at load; does not notify the persistence listener. */
export function restoreSelection(raw: unknown) {
  const s = raw as AnyRecord | null;
  selection =
    s && (s.kind === "recipe" || s.kind === "favourite") && s.id != null && String(s.id).indexOf("recent:") !== 0
      ? {
          kind: s.kind,
          id: String(s.id),
          profileFingerprint: s.profileFingerprint || null,
          armedBrewC: typeof s.armedBrewC === "number" ? s.armedBrewC : null,
        }
      : null;
}

/**
 * Arm `{kind,id}` on the live workflow `wf` (used for the profile fingerprint). A
 * `recent:` id is not stable (docs/KV_CONTRACT.md, "Auto (recent) entries"), so arming
 * one clears the selection instead. Arming happens right after the dashboard's apply,
 * so it also records that apply as an echo (see suppress).
 */
export function armSelection(req: AnyRecord | null | undefined, wf?: AnyRecord | null, now = Date.now()): Selection | null {
  const kind = req && req.kind;
  const id = req && req.id;
  if ((kind !== "recipe" && kind !== "favourite") || id == null || id === "" || String(id).indexOf("recent:") === 0) {
    clearSelection();
    return null;
  }
  setSel({
    kind,
    id: String(id),
    profileFingerprint: profileFingerprint(wf && wf.profile),
    armedBrewC: wf ? liveBrewC(wf) : null,
  });
  if (wf) suppress(wf, now);
  return selection;
}

// ── echo guard ──────────────────────────────────────────────────────────────
// DYE2's own apply writes the workflow, which fires `workflowUpdated`; without this
// every apply would immediately "record" the same values straight back. Mirrors the
// skin's withAutoSaveSuppressed, but by value + time because the event arrives
// asynchronously from the host rather than inside the call that caused it.
function echoKey(wf: AnyRecord): string {
  return JSON.stringify([recipeFields(wf), favouriteFields(wf)]);
}

export function suppress(wf: AnyRecord, now = Date.now()) {
  suppressed = { values: echoKey(wf), at: now };
}

function isEcho(wf: AnyRecord, now: number): boolean {
  return !!suppressed && now - suppressed.at < ECHO_WINDOW_MS && suppressed.values === echoKey(wf);
}

// ── recording ───────────────────────────────────────────────────────────────

/**
 * Patch the armed item for workflow `wf`. Returns true if it wrote. Re-reads the KV
 * array right before writing, touches only the armed item's changed fields, and is a
 * no-op if the item has since been deleted.
 */
export async function recordWorkflow(
  wf: AnyRecord,
  fetchFn: FetchLike,
  armed: Selection | null = selection,
  base = "http://localhost:8080/api/v1"
): Promise<boolean> {
  if (!armed || !wf) return false;
  const { key, field } = TARGETS[armed.kind];
  const url = base + "/store/dye2.reaplugin/" + key;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error("HTTP " + res.status + " reading " + key);
  const val = await res.json();
  const list: AnyRecord[] = Array.isArray(val) ? val : [];
  const idx = list.findIndex((x) => x && String(x.id) === armed.id);
  if (idx === -1) return false;
  const item = list[idx];
  const patch = itemPatch(armed.kind, item, wf, armed.armedBrewC);
  const live = liveBrewC(wf);
  if (live !== armed.armedBrewC) updateSelection(armed, { armedBrewC: live });
  if (Object.keys(patch).length === 0) return false;

  const next: AnyRecord = { ...item, [field]: { ...(item[field] || {}), ...patch } };
  // item.workflow is the ready-to-PUT copy the skin applies from; keep its context in
  // step so a re-apply restores what was just dialled in.
  if (item.workflow && item.workflow.context) {
    const c: AnyRecord = { ...item.workflow.context };
    if ("dose" in patch) c.targetDoseWeight = patch.dose;
    if ("drink" in patch) c.targetYield = patch.drink;
    const g = "grind" in patch ? patch.grind : patch.grindSetting;
    if (g !== undefined) c.grinderSetting = String(g);
    next.workflow = { ...item.workflow, context: c };
  }
  const out = list.slice();
  out[idx] = next;
  const put = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(out),
  });
  if (!put.ok) throw new Error("HTTP " + put.status + " writing " + key);
  return true;
}

/**
 * Entry point for a `workflowUpdated` event. Drift disarms immediately; our own apply
 * is ignored; anything else is debounced (latest workflow wins) then recorded.
 * `onWrote` runs after a successful write (plugin.ts emits `changed` there).
 */
export function scheduleWorkflowRecord(
  wf: AnyRecord,
  fetchFn: FetchLike,
  onWrote?: () => void,
  onError?: (e: unknown) => void,
  now = Date.now(),
  delay = DEBOUNCE_MS
) {
  if (!selection || !wf) return;
  if (profileDrifted(selection, wf)) {
    clearSelection();
    return;
  }
  if (isEcho(wf, now)) return;
  // The skin armed us before the profile was known (no fetch at arm time): adopt it now.
  if (!selection.profileFingerprint) {
    updateSelection(selection, { profileFingerprint: profileFingerprint(wf.profile) });
  }

  cancelPending();
  const armed = selection;
  timer = setTimeout(() => {
    timer = null;
    if (selection !== armed) return;
    recordWorkflow(wf, fetchFn, armed)
      .then((wrote) => {
        if (wrote && onWrote) onWrote();
      })
      .catch((e) => {
        if (onError) onError(e);
      });
  }, delay);
}
