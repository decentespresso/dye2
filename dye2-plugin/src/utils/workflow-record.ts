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
 * `workflowUpdated` on every workflow change -> trackWorkflow(), which disarms on drift and
 * fills in any missing baseline but NEVER writes. The barista saves explicitly ("Save changes"
 * on the strip's long-press menu -> POST /record) -> recordWorkflow() patches ONLY the fields
 * that differ on that ONE item. A workflow change is not by itself a decision to change the
 * recipe, which is what the automatic version got wrong (dye2#30, #31, #33).
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
  /**
   * The live steam / hot-water / flush settings when armed (MACHINE_MAP's keys; absent =
   * the workflow had no value). A setting the item does not hold yet is adopted once it
   * moves off this baseline, which makes Streamline's own settings page the editor for
   * them (dye2#23). Null = unknown (armed without a workflow), adopted from the first
   * event like profileFingerprint.
   */
  armedMachine: AnyRecord | null;
}

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
    ? profile.steps.map(({ temperature, limiter, ...rest }: AnyRecord) => ({
        ...rest,
        // {value:0}, null and absent all mean "no limiter", and Decaid reports them
        // interchangeably: Streamline nulls a 0 limiter before every PUT (api.js
        // updateWorkflow), so hashing it as sent made its own yield/dose writes look like a
        // profile switch and cleared the selection (dye2#32, streamline-js#158).
        limiter: limiter && Number(limiter.value) !== 0 ? limiter : null,
      }))
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

/**
 * Every machine setting a recipe can hold: dashboardVariables name -> the workflow sub-object
 * and field it lives in. The same ground as dev-api.ts RECIPE_MACHINE_FIELDS, which the plugin
 * runtime cannot share; keep the two in step. brewC is not here — it lives on the profile and
 * has its own baseline.
 */
const MACHINE_MAP: Record<string, [string, string]> = {
  steamTempC: ["steamSettings", "targetTemperature"],
  steamTimeS: ["steamSettings", "duration"],
  steamFlowMls: ["steamSettings", "flow"],
  steamStopAtTempC: ["steamSettings", "stopAtTemperature"],
  hotWaterTempC: ["hotWaterData", "targetTemperature"],
  hotWaterTimeS: ["hotWaterData", "duration"],
  hotWaterMl: ["hotWaterData", "volume"],
  hotWaterFlowMls: ["hotWaterData", "flow"],
  flushTempC: ["rinseData", "targetTemperature"],
  flushS: ["rinseData", "duration"],
  flushFlowMls: ["rinseData", "flow"],
};

/** The steam settings as a group: all four are withheld while steam is off (dye2#30). */
const STEAM_KEYS = ["steamTempC", "steamTimeS", "steamFlowMls", "steamStopAtTempC"];

/** Decaid reads a steam target below 135 as off (de1_controller.dart updateWorkflowSettings). */
function steamOff(wf: AnyRecord | null | undefined): boolean {
  const t = Number(((wf && wf.steamSettings) || {}).targetTemperature);
  return Number.isFinite(t) && t < 135;
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
  for (const [k, [group, field]] of Object.entries(MACHINE_MAP)) {
    put(out, k, ((wf && wf[group]) || {})[field]);
  }
  return out;
}

/**
 * The two settings no workflow carries. Streamline edits them with updateDe1Setting
 * (settings.js), which reaches the DE1 but never the workflow, and Decaid syncs nothing back
 * the other way (de1_controller.dart updateMachineSettings) — so they are read from
 * GET /machine/settings and overlaid. Writing them still goes through the workflow: a PUT with
 * rinseData reaches the machine via updateWorkflowSettings (workflow_handler.dart).
 * dashboardVariables name -> De1Settings field.
 */
const DE1_ONLY: Record<string, string> = { flushTempC: "flushTemp", flushFlowMls: "flushFlow" };

/** A copy of `wf` with the DE1-only settings overlaid from a GET /machine/settings body. */
export function withMachineSettings(wf: AnyRecord, de1: AnyRecord | null | undefined): AnyRecord {
  if (!wf || !de1) return wf;
  const out: AnyRecord = { ...wf };
  for (const [name, key] of Object.entries(DE1_ONLY)) {
    if (de1[key] == null) continue;
    const [group, field] = MACHINE_MAP[name];
    out[group] = { ...(out[group] || {}), [field]: de1[key] };
  }
  return out;
}

/** GET /machine/settings, or null on any failure — those two settings then go unrecorded. */
export async function readMachineSettings(fetchFn: FetchLike, base: string): Promise<AnyRecord | null> {
  try {
    const res = await fetchFn(base + "/machine/settings");
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

/** Those machine settings of `wf` that have a value: the baseline armSelection stores. */
export function machineFields(wf: AnyRecord): AnyRecord {
  const all = recipeFields(wf);
  const out: AnyRecord = {};
  for (const k of Object.keys(MACHINE_MAP)) if (all[k] !== undefined) out[k] = all[k];
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
// Two strings (basket id/name) compare exactly: Number("") === Number("0") would call
// different names equal. The numeric compare is for 4.2 vs "4.20".
function sameValue(cur: unknown, v: unknown): boolean {
  return (
    cur === v ||
    (cur != null &&
      v != null &&
      !(typeof cur === "string" && typeof v === "string") &&
      Number.isFinite(Number(cur)) &&
      Number(cur) === Number(v))
  );
}

export function changedFields(patch: AnyRecord, stored: AnyRecord | undefined): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!sameValue(stored ? stored[k] : undefined, v)) out[k] = v;
  }
  return out;
}

/**
 * Should a machine setting the item does not hold be adopted? Only once the barista has
 * moved it off what was live when the item was applied. DYE2 has no control for most of
 * these (dye2#23) — Streamline's settings page is where they are edited — so without this
 * they could never be recorded at all. The baseline is what makes it safe: a workflow
 * always has a value for every steam/hot-water/flush field, so adopting on presence alone
 * would stamp the machine's whole current state onto the item on the first event.
 */
function movedSinceArming(k: string, live: unknown, armed: AnyRecord | null): boolean {
  if (!armed || !(k in MACHINE_MAP)) return false;
  return armed[k] !== undefined && !sameValue(armed[k], live);
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
  armedBrewC: number | null = null,
  armedMachine: AnyRecord | null = null
): AnyRecord {
  const stored = item[TARGETS[kind].field] || {};
  const all = kind === "recipe" ? recipeFields(wf) : favouriteFields(wf);
  // Steam off is a machine state, not a recipe's: Decaid reads a target below 135 as off
  // (de1_controller.dart updateWorkflowSettings), and Streamline's steam-time 0 sends
  // targetTemperature 0 alongside duration 0. Recording either would turn steam off on every
  // later apply of this item (dye2#30). A recipe set to "Off" in the editor is unaffected —
  // that is a save, not a recording.
  const off = steamOff(wf);
  // apply writes every machine setting the item holds (the mode fields only choose what the
  // editor shows, and are never written), so a held field's live value is the user's.
  const known: AnyRecord = {};
  for (const k of Object.keys(all)) {
    if (off && STEAM_KEYS.indexOf(k) !== -1) continue;
    if (stored[k] == null && !movedSinceArming(k, all[k], armedMachine)) continue;
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
    armedMachine: wf ? machineFields(wf) : null,
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
  const fields = recipeFields(wf);
  // The DE1-only pair is overlaid on the workflow the apply read (plugin.ts) but absent from the
  // host's own event payload, so comparing it here would never match and every apply would
  // record itself straight back.
  for (const k of Object.keys(DE1_ONLY)) delete fields[k];
  return JSON.stringify([fields, favouriteFields(wf)]);
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
  // One extra GET, and only when the DE1-only pair could be written: the item holds one, or the
  // baseline has one to move off. A dose change costs nothing.
  const stored = item[field] || {};
  const wantsDe1 = Object.keys(DE1_ONLY).some(
    (k) => stored[k] != null || (armed.armedMachine && armed.armedMachine[k] !== undefined)
  );
  const full = wantsDe1 ? withMachineSettings(wf, await readMachineSettings(fetchFn, base)) : wf;
  const patch = itemPatch(armed.kind, item, full, armed.armedBrewC, armed.armedMachine);
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
  // Same for the machine settings the strip applies from item.workflow (dev-api.ts
  // buildRecipeWorkflow puts them there): a recorded steam/hot-water/flush change has to move
  // its copy too, or re-applying would steam at the old setting. Partial sub-objects are what
  // the builder sends too — PUT /workflow deep-merges key by key.
  if (next.workflow) {
    for (const [k, [group, field]] of Object.entries(MACHINE_MAP)) {
      if (!(k in patch)) continue;
      next.workflow = { ...next.workflow, [group]: { ...(next.workflow[group] || {}), [field]: patch[k] } };
    }
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
 * Entry point for a `workflowUpdated` event. Recording is explicit now -- the skin's
 * "Save changes" posts to the `record` route -- so this never writes. It only keeps the armed
 * selection honest: drift disarms it, and a selection armed before the workflow was known
 * adopts its baselines here, so a later change still reads as the barista's.
 */
export function trackWorkflow(wf: AnyRecord, now = Date.now()): void {
  if (!selection || !wf) return;
  if (profileDrifted(selection, wf) || contextDrifted(selection, wf)) {
    clearSelection();
    return;
  }
  // Our own apply: its values are the baseline already, set at arm time.
  if (isEcho(wf, now)) return;
  // The skin armed us before the profile was known (no fetch at arm time): adopt it now.
  if (!selection.profileFingerprint) {
    updateSelection(selection, { profileFingerprint: profileFingerprint(wf.profile) });
  }

  // Armed without a workflow: take the machine settings live now as the baseline, so only a
  // later change counts as the barista's.
  if (!selection.armedMachine) updateSelection(selection, { armedMachine: machineFields(wf) });

  // No baseline yet (armed without a workflow) or an empty one (the workflow had no bean
  // or grinder when armed): adopt what the workflow says now, so the NEXT switch disarms.
  if (!selection.armedBeanBatchId || !selection.armedGrinderId) {
    updateSelection(selection, {
      armedBeanBatchId: selection.armedBeanBatchId || idOf(wf.context && wf.context.beanBatchId),
      armedGrinderId: selection.armedGrinderId || idOf(wf.context && wf.context.grinderId),
    });
  }
}

// ── derived selection (dye2#36) ─────────────────────────────────────────────
// The highlight is computed from the live workflow, never stored: a recipe by the id in
// context.extras.dye.recipeId, a favourite or recent by comparing the fields it owns.
// (armSelection/trackWorkflow above are the retired armed-pointer API; plugin.ts no longer
// calls them. ponytail: delete them and their tests with streamline-js#159.)

export function recipeIdOf(wf: AnyRecord | null | undefined): string | null {
  const id = wf && wf.context && wf.context.extras && wf.context.extras.dye && wf.context.extras.dye.recipeId;
  return id == null || id === "" ? null : String(id);
}

/** The entries of `fields` that `stored` holds (non-null): the fields the item owns only. */
export function heldFields(fields: AnyRecord, stored: AnyRecord | undefined): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(fields || {})) if (stored && stored[k] != null) out[k] = v;
  return out;
}

/** recipeFields minus the steam group while steam is off: a machine state, not a recipe's. */
export function ownedRecipeFields(wf: AnyRecord): AnyRecord {
  const out = recipeFields(wf);
  if (steamOff(wf)) for (const k of STEAM_KEYS) delete out[k];
  return out;
}

/** Has the live workflow drifted off the recipe's own fields? (the `*`) */
export function recipeModified(recipe: AnyRecord, wf: AnyRecord): boolean {
  const stored = recipe.dashboardVariables || {};
  const held = heldFields(ownedRecipeFields(wf), stored);
  // brewC means nothing for a recipe that names no profile (apply cannot set it): it must
  // not asterisk the cell for good.
  if (!profileOf(recipe)) delete held.brewC;
  return Object.keys(changedFields(held, stored)).length > 0;
}

function profileOf(recipe: AnyRecord): AnyRecord | null {
  return (recipe.workflow && recipe.workflow.profile) || recipe.profileSnapshot || null;
}

/** Does the live profile differ from the recipe's own? A recipe naming none never differs. */
export function recipeProfileChanged(recipe: AnyRecord, wf: AnyRecord): boolean {
  const mine = profileFingerprint(profileOf(recipe));
  const live = profileFingerprint(wf && wf.profile);
  return !!mine && !!live && mine !== live;
}

/** A saved favourite compares against its snapshot, a recent (auto: true) against its workflow. */
export function favouriteMatches(fav: AnyRecord, wf: AnyRecord): boolean {
  const src = fav.auto ? favouriteFields(fav.workflow) : fav.snapshot || {};
  const held = heldFields(favouriteFields(wf), src);
  // An empty source must never match, or an empty row would match everything.
  return Object.keys(held).length > 0 && Object.keys(changedFields(held, src)).length === 0;
}

export interface Derived {
  kind: "recipe" | "favourite" | "recent";
  id: string;
  modified: boolean;
}

/** recipeId wins when it resolves; else the first matching row (saved before recents). */
export function deriveSelection(
  wf: AnyRecord | null | undefined,
  rows: { recipes?: AnyRecord[]; favourites?: AnyRecord[] }
): Derived | null {
  if (!wf) return null;
  const rid = recipeIdOf(wf);
  const recipe = rid && (rows.recipes || []).find((r) => r && String(r.id) === rid);
  if (recipe) return { kind: "recipe", id: rid as string, modified: recipeModified(recipe, wf) };
  const favs = (rows.favourites || []).filter((f) => f && f.id != null);
  const hit = favs.filter((f) => !f.auto).concat(favs.filter((f) => f.auto)).find((f) => favouriteMatches(f, wf));
  return hit ? { kind: hit.auto ? "recent" : "favourite", id: String(hit.id), modified: false } : null;
}

/**
 * A recipe id with no row (deleted, or made on another Decaid): the newest shot carrying it
 * stands in as the recipe. Null when none, so nothing is highlighted.
 */
export async function resolveRecipeFromHistory(
  fetchFn: FetchLike,
  recipeId: string,
  base = "http://localhost:8080/api/v1"
): Promise<AnyRecord | null> {
  const res = await fetchFn(base + "/shots?limit=50&order=desc");
  if (!res.ok) return null;
  const data = await res.json();
  const items: AnyRecord[] = Array.isArray(data) ? data : (data && data.items) || [];
  const shot = items.find((s) => s && recipeIdOf(s.workflow) === recipeId);
  return shot ? { id: recipeId, dashboardVariables: recipeFields(shot.workflow), workflow: shot.workflow } : null;
}

const GENERIC_PROFILE = /^(default|advanced|custom|profile|new|untitled)$/i;

/** `<first word of profile title> <drink type>`; see docs/KV_CONTRACT.md for the drink table. */
export function proposeRecipeName(wf: AnyRecord, existingNames: string[] = []): string {
  const word = String((wf && wf.profile && wf.profile.title) || "").trim().split(/\s+/)[0] || "";
  const ctx = (wf && wf.context) || {};
  const steamT = Number(wf && wf.steamSettings && wf.steamSettings.targetTemperature);
  const steamS = wf && wf.steamSettings && wf.steamSettings.duration;
  const hw = (wf && wf.hotWaterData) || {};
  const ratio = Math.round((Number(ctx.targetYield) / Number(ctx.targetDoseWeight)) * 100) / 100; // 43.2/18 is 2.4000000000000004
  let drink = "Espresso";
  if (steamT >= 135 && Number(steamS) !== 0) {
    const s = Number(steamS);
    drink = s > 0 && s <= 20 ? "Flat White" : s > 0 && s <= 35 ? "Cappuccino" : "Latte";
  } else if (Number(hw.duration) > 0 || Number(hw.volume) > 0) drink = "Americano";
  else if (Number.isFinite(ratio) && ratio > 0) drink = ratio < 1.6 ? "Ristretto" : ratio <= 2.4 ? "Espresso" : "Lungo";
  const base = (GENERIC_PROFILE.test(word) ? "" : word + " ") + drink;
  const taken = (n: string) => existingNames.some((x) => String(x).toLowerCase() === n.toLowerCase());
  if (!taken(base)) return base;
  // Collision: the bean's first word after the name, then a counter.
  const bean = String(ctx.coffeeName || "").trim().split(/\s+/)[0];
  const named = bean ? base + " " + bean : base;
  if (!taken(named)) return named;
  let n = 2;
  while (taken(named + " " + n)) n++;
  return named + " " + n;
}
