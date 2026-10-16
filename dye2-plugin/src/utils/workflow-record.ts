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
   * Live step-0 temperature when armed (then rebased after each record). apply now
   * shifts the loaded profile to a recipe's brewC (dye2#26), so right after apply the live
   * value equals the stored one; a favourite carries no brewC and a recipe naming no
   * profile can leave the live one different. brewC is recorded only when the live value
   * moves off this baseline, i.e. a real brew-temp edit. Null = unknown.
   */
  armedBrewC: number | null;
  /**
   * context.beanBatchId / grinderId when armed ("" = none set). A different value means
   * the barista switched bean or grinder, so later edits belong to another coffee and
   * must not land on this item. Null = unknown (armed without a workflow): adopted from
   * the first event, like profileFingerprint.
   */
  armedBeanBatchId: string | null;
  armedGrinderId: string | null;
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

/** Has the workflow's bean batch or grinder moved off what the selection was armed on? */
export function contextDrifted(sel: Selection | null, workflow: AnyRecord | null | undefined): boolean {
  if (!sel) return false;
  const ctx = (workflow && workflow.context) || {};
  // Only a switch away from one the selection actually had. An armed "" means the workflow
  // had none — apply sets beanBatchId only for a recipe that holds one (dye2#27) — so picking
  // a bean then
  // is the barista saying which coffee this is, not switching off the recipe; disarming
  // there would stop recording on the normal apply-then-pick-bean order.
  return (
    (!!sel.armedBeanBatchId && sel.armedBeanBatchId !== idOf(ctx.beanBatchId)) ||
    (!!sel.armedGrinderId && sel.armedGrinderId !== idOf(ctx.grinderId))
  );
}

// null / undefined / "" all mean "not set", so an unset id never counts as a change.
function idOf(v: unknown): string {
  return v == null ? "" : String(v);
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
  // apply writes these into context.extras (dev-api.ts buildFavouriteWorkflow / applyRecipe).
  const extras = ctx.extras || {};
  put(out, "rpm", num(extras.rpm));
  put(out, "basketId", extras.basketId);
  put(out, "basketName", extras.basketName);
  const steps = wf && wf.profile && wf.profile.steps;
  put(out, "brewC", num(steps && steps[0] && steps[0].temperature));
  // Every machine setting a recipe can hold, under the dashboardVariables names (dev-api.ts
  // RECIPE_MACHINE_FIELDS, which the plugin runtime cannot share).
  const steam = (wf && wf.steamSettings) || {};
  const hotWater = (wf && wf.hotWaterData) || {};
  const rinse = (wf && wf.rinseData) || {};
  put(out, "steamTempC", steam.targetTemperature);
  put(out, "steamTimeS", steam.duration);
  put(out, "steamFlowMls", steam.flow);
  put(out, "steamStopAtTempC", steam.stopAtTemperature);
  put(out, "hotWaterTempC", hotWater.targetTemperature);
  put(out, "hotWaterTimeS", hotWater.duration);
  put(out, "hotWaterMl", hotWater.volume);
  put(out, "hotWaterFlowMls", hotWater.flow);
  put(out, "flushTempC", rinse.targetTemperature);
  put(out, "flushS", rinse.duration);
  put(out, "flushFlowMls", rinse.flow);
  return out;
}

/** A favourite's snapshot has no brew-temp/steam/hot-water/flush field: dose/drink/grind/rpm only. */
export function favouriteFields(wf: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  const ctx = (wf && wf.context) || {};
  put(out, "dose", ctx.targetDoseWeight);
  put(out, "drink", ctx.targetYield);
  put(out, "grindSetting", num(ctx.grinderSetting));
  put(out, "rpm", num(ctx.extras && ctx.extras.rpm));
  return out;
}

/** The entries of `patch` that differ from `stored`, compared numerically where both are numbers. */
export function changedFields(patch: AnyRecord, stored: AnyRecord | undefined): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(patch || {})) {
    const cur = stored ? stored[k] : undefined;
    // Two strings (basket id/name) compare exactly: Number("") === Number("0") would
    // call different names equal. Numeric compare is for 4.2 vs "4.20".
    const same =
      cur === v ||
      (cur != null && v != null && !(typeof cur === "string" && typeof v === "string") &&
        Number.isFinite(Number(cur)) && Number(cur) === Number(v));
    if (!same) out[k] = v;
  }
  return out;
}

/**
 * What to write onto `item` for the live workflow `wf`: only fields the item already
 * holds (a workflow always has a value for steam/hot water/flush, so diffing against an
 * absent field would stamp the whole workflow onto the item — a blanket resync) and
 * only those whose value differs. The *Mode fields are never written.
 */
export function itemPatch(
  kind: Selection["kind"],
  item: AnyRecord,
  wf: AnyRecord,
  armedBrewC: number | null = null
): AnyRecord {
  const stored = item[TARGETS[kind].field] || {};
  const all = kind === "recipe" ? recipeFields(wf) : favouriteFields(wf);
  // apply writes every machine setting the item holds (the mode fields only choose what the
  // editor shows, and are never written), so a held field's live value is the user's.
  const known: AnyRecord = {};
  for (const k of Object.keys(all)) {
    if (stored[k] == null) continue;
    if (k === "brewC" && (armedBrewC == null || all.brewC === armedBrewC)) continue;
    known[k] = all[k];
  }
  const patch = changedFields(known, stored);
  // A basket's id and name are one change: if either moved write both, so an item never
  // ends up with the id of one basket and the name of another.
  if ("basketId" in patch || "basketName" in patch) {
    for (const k of ["basketId", "basketName"]) if (all[k] !== undefined) patch[k] = all[k];
  }
  return patch;
}

/**
 * A copy of `profile` with its first step at `brewC` and every other step moved by the same
 * amount: 94, 90, 88 at 92 becomes 92, 88, 86. Port of profileAtBrewTemp in
 * streamline_project/src/modules/brew-temp.js; keep it in step with the browser-side copy in
 * dev-api.ts (the two runtimes cannot share one). Null when there is nothing to shift.
 */
export function profileAtBrewC(profile: AnyRecord | null | undefined, brewC: unknown): AnyRecord | null {
  // Number(null) and Number("") are 0, which would silently shift the whole curve to zero.
  if (brewC == null || brewC === "") return null;
  const target = Number(brewC);
  if (!profile || !Array.isArray(profile.steps) || !Number.isFinite(target)) return null;
  const origin = profile.steps[0] && profile.steps[0].temperature;
  const shift =
    typeof origin === "number" && Number.isFinite(origin) ? target - origin : null;
  return {
    ...profile,
    steps: profile.steps.map((s: AnyRecord) => {
      const t =
        shift != null && typeof s.temperature === "number" && Number.isFinite(s.temperature)
          ? Math.round((s.temperature + shift) * 100) / 100
          : target;
      return { ...s, temperature: t };
    }),
  };
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

// ── selection marker ────────────────────────────────────────────────────────
// The armed {kind,id} is mirrored into the live workflow as context.extras.dye.selection, which
// Decaid copies onto each Shot (decent-sync reads it instead of guessing the recipe). PUT
// /workflow deep-merges key by key (deepMergeJson), so this body leaves every other extras
// key, and the field flags dashboard writes put beside it, alone. Streamline's post-shot
// clear (dye-context.js) acts only on keys whose value is exactly `true`, so the nested
// object is ignored there.
//
// No loop: the PUT fires `workflowUpdated`, but scheduleWorkflowRecord only ever writes KV
// (never the workflow), and only when recipeFields/favouriteFields differ from the item —
// extras.dye is in neither, so the marker's own event diffs to an empty patch (and inside the
// echo window is dropped earlier). The PUT is also gated on the selected {kind,id} actually
// changing, so the baseline rebases that notify the selection listener never PUT.
let markedKey: string | null = null;
let markChain: Promise<void> = Promise.resolve();

const selectionKey = (s: Selection | null) => (s ? s.kind + ":" + s.id : null);

/**
 * Bring the workflow's extras.dye.selection in step with the armed selection. Serialised, and
 * each step reads the selection as it runs, so an arm then a quick clear cannot land out of
 * order. Rejects when the PUT fails; the caller logs it, and the next change retries.
 */
export function syncSelectionMarker(fetchFn: FetchLike, base = "http://localhost:8080/api/v1"): Promise<void> {
  const run = markChain.then(async () => {
    const key = selectionKey(selection);
    if (key === markedKey) return;
    const res = await fetchFn(base + "/workflow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { extras: { dye: { v: 1, selection: selection ? { kind: selection.kind, id: selection.id } : null } } },
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " writing selection marker");
    markedKey = key;
  });
  markChain = run.catch(() => {});
  return run;
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
          armedBeanBatchId: typeof s.armedBeanBatchId === "string" ? s.armedBeanBatchId : null,
          armedGrinderId: typeof s.armedGrinderId === "string" ? s.armedGrinderId : null,
        }
      : null;
  // The workflow was marked when this was armed, so a later clear has something to clear.
  markedKey = selectionKey(selection);
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
    armedBeanBatchId: wf ? idOf(wf.context && wf.context.beanBatchId) : null,
    armedGrinderId: wf ? idOf(wf.context && wf.context.grinderId) : null,
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
    for (const k of ["rpm", "basketId", "basketName"]) {
      if (k in patch) c.extras = { ...(c.extras || {}), [k]: patch[k] };
    }
    next.workflow = { ...item.workflow, context: c };
  }
  // item.workflow is also what Streamline's strip PUTs, so a recorded brew-temp change has
  // to move its profile too — otherwise a strip apply would brew the old temperatures while
  // dashboardVariables.brewC says the new one (dye2#26).
  if ("brewC" in patch && next.workflow) {
    const shifted = profileAtBrewC(next.workflow.profile, patch.brewC);
    if (shifted) next.workflow = { ...next.workflow, profile: shifted };
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
  if (profileDrifted(selection, wf) || contextDrifted(selection, wf)) {
    clearSelection();
    return;
  }
  if (isEcho(wf, now)) return;
  // The skin armed us before the profile was known (no fetch at arm time): adopt it now.
  if (!selection.profileFingerprint) {
    updateSelection(selection, { profileFingerprint: profileFingerprint(wf.profile) });
  }

  // No baseline yet (armed without a workflow) or an empty one (the workflow had no bean
  // or grinder when armed): adopt what the workflow says now, so the NEXT switch disarms.
  if (!selection.armedBeanBatchId || !selection.armedGrinderId) {
    updateSelection(selection, {
      armedBeanBatchId: selection.armedBeanBatchId || idOf(wf.context && wf.context.beanBatchId),
      armedGrinderId: selection.armedGrinderId || idOf(wf.context && wf.context.grinderId),
    });
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
