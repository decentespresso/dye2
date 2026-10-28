/**
 * Dial-in recording: while a recipe or favourite is "armed" (the one the barista last
 * applied from the dashboard), edits made to the live workflow are written back into
 * that item's own KV entry, so the Streamline skin no longer has to read-modify-write
 * DYE2's arrays itself (docs/KV_CONTRACT.md, "Single-writer rule").
 *
 * Like recent-favs.ts this runs in the PLUGIN runtime (no DOM, no imports) and is also
 * importable by a node test (test/workflow-record.test.mjs). The fetch-like dependency
 * is injected.
 *
 * The selection is derived per call from the live workflow (`deriveSelection`), never
 * stored. This module holds the field maps, the drift tests and `recordWorkflow`, which
 * patches ONLY the fields that differ on the ONE selected item when the barista saves
 * explicitly ("Save changes" on the strip's long-press menu -> POST /record). A workflow
 * change is not by itself a decision to change the recipe, which is what the automatic
 * version got wrong (dye2#30, #31, #33).
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
   * The live values the item may adopt once moved: the steam / hot-water / flush settings
   * (MACHINE_MAP's keys) plus `basketId` (null = no basket live; absent = the workflow had
   * no value). A setting the item does not hold yet is adopted once it
   * moves off this baseline, which makes Streamline's own settings page the editor for
   * them (dye2#23). Null = unknown (armed without a workflow), adopted from the first
   * event like profileFingerprint.
   */
  armedMachine: AnyRecord | null;
}

// kind -> KV key and the sub-object holding the dashboard-derived values.
const TARGETS = {
  recipe: { key: "recipes", field: "dashboardVariables" },
  favourite: { key: "autoFavourites", field: "snapshot" },
} as const;

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

// ── field mappers ───────────────────────────────────────────────────────────

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A grind setting is free text on the host — WorkflowContext.grinderSetting is a
 * `String?` (reaprime workflow_context.dart) — because not every grinder has a single
 * numeric scale: a three-dial grinder reads "1.1.0", a stepped one "15 clicks". num()
 * would keep "1.1" and silently drop the rest, so keep the text whenever it is not
 * plainly a number. A numeric scale still stores a number, as KV_CONTRACT says.
 */
function grindValue(v: unknown): number | string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
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
  put(out, "grind", grindValue(ctx.grinderSetting));
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
// ponytail: 60 s memo, successes only, keyed by base — a BLE read costs 1.4-5.7 s (dye2#40). A flush edit
// made on Streamline inside the window is not seen; shorten MACHINE_TTL_MS if that matters.
// Warming is last-write-wins: a read already in flight when forgetMachineSettings() runs (a record issued
// inside an apply's BLE-read window; handleRecord is not serialised through `chain`) resolves afterwards
// and overwrites the fresh value with the pre-apply one. Narrow; no guard.
const MACHINE_TTL_MS = 60000;
let cached: { base: string; at: number; body: AnyRecord } | null = null;

/** Drop the memo: the arm-time read must see the machine as the apply just left it (dye2#40). */
export function forgetMachineSettings(): void {
  cached = null;
}

export async function readMachineSettings(fetchFn: FetchLike, base: string): Promise<AnyRecord | null> {
  if (cached && cached.base === base && Date.now() - cached.at < MACHINE_TTL_MS) return cached.body;
  try {
    const res = await fetchFn(base + "/machine/settings");
    if (!res.ok) return null;
    const body = await res.json();
    if (body) cached = { base, at: Date.now(), body };
    return body;
  } catch (e) {
    return null;
  }
}

/** Those machine settings of `wf` that have a value: the armed baseline holds. */
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
  put(out, "grindSetting", grindValue(ctx.grinderSetting));
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
 * The basket rides the same baseline: only basket-picker.ts, the two apply builders
 * (dev-api.ts) and the dashboard's Clear (dashboard.ts, writes null) ever write
 * context.extras.basketId, the machine never drifts it, so a move off the armed value is a
 * human act. An absent live basket (Clear) is not drift: ownedRecipeFields drops null, so
 * nothing is adopted or starred. basketName is not listed: the pair rule in
 * itemPatch writes it with the id. rpm stays out (not adoptable).
 */
function movedSinceArming(k: string, live: unknown, armed: AnyRecord | null): boolean {
  if (!armed || (!(k in MACHINE_MAP) && k !== "basketId")) return false;
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

function liveBrewC(wf: AnyRecord): number | null {
  const v = recipeFields(wf).brewC;
  return v === undefined ? null : v;
}

// Mutates the baseline in place; the caller owns it (src/plugin.ts's `baseline`).
function updateSelection(sel: Selection, changes: Partial<Selection>) {
  Object.assign(sel, changes);
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
  armed: Selection | null,
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
  // The DE1-only pair is wanted on the common path, when a baseline is armed (the machine always reports both), or the
  // item holds one. The GET is served from the readMachineSettings memo on the common path.
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

// ── derived selection (dye2#36) ─────────────────────────────────────────────
// The highlight is computed from the live workflow, never stored: a recipe by the id in
// context.extras.dye.recipeId, a favourite or recent by comparing the fields it owns.

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
export function recipeModified(recipe: AnyRecord, wf: AnyRecord, armed: AnyRecord | null = null): boolean {
  const stored = recipe.dashboardVariables || {};
  const owned = ownedRecipeFields(wf);
  const held = heldFields(owned, stored);
  // The one non-held field compared: a basket picked since apply is adopted on Save (itemPatch),
  // so it stars too. An absent live basket (Clear) is not drift: put() drops null. ponytail: basket only; other adoptables (steam/flush) still never star.
  if (owned.basketId !== undefined && movedSinceArming("basketId", owned.basketId, armed)) held.basketId = owned.basketId;
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

/**
 * Did the profile change under the selected recipe? Live-vs-live against the fingerprint taken
 * when the id first appeared (same source, so host serialisation differences cannot read as a
 * change, cf. dye2#32); only with no baseline (plugin restarted) compare the stored profile.
 */
export function idProfileChanged(base: Selection | null, recipe: AnyRecord | null, wf: AnyRecord): boolean {
  if (!base) return !!recipe && recipeProfileChanged(recipe, wf);
  const live = profileFingerprint(wf && wf.profile);
  return !!base.profileFingerprint && !!live && live !== base.profileFingerprint;
}

/** A saved favourite compares against its snapshot, a recent (auto: true) against its workflow. */
export function favouriteMatches(fav: AnyRecord, wf: AnyRecord): boolean {
  const src = fav.auto ? favouriteFields(fav.workflow) : fav.snapshot || {};
  const held = heldFields(favouriteFields(wf), src);
  // An empty source must never match, or an empty row would match everything.
  return Object.keys(held).length > 0 && Object.keys(changedFields(held, src)).length === 0;
}

export interface Derived {
  kind: "recipe" | "favourite";
  id: string;
  modified: boolean;
  /** A recent reports kind "favourite" + auto: true, the only shape the current skin renders. */
  auto?: true;
}

/** recipeId wins when it resolves; else the first matching row (saved before recents). */
export function deriveSelection(
  wf: AnyRecord | null | undefined,
  rows: { recipes?: AnyRecord[]; favourites?: AnyRecord[] },
  armed: AnyRecord | null = null
): Derived | null {
  if (!wf) return null;
  const rid = recipeIdOf(wf);
  const recipe = rid && (rows.recipes || []).find((r) => r && String(r.id) === rid);
  if (recipe) return { kind: "recipe", id: rid as string, modified: recipeModified(recipe, wf, armed) };
  const favs = (rows.favourites || []).filter((f) => f && f.id != null);
  const hit = favs.filter((f) => !f.auto).concat(favs.filter((f) => f.auto)).find((f) => favouriteMatches(f, wf));
  if (!hit) return null;
  return hit.auto
    ? { kind: "favourite", id: String(hit.id), modified: false, auto: true }
    : { kind: "favourite", id: String(hit.id), modified: false };
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
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * `<first word of profile title> <bean name> [beverage]`; see docs/KV_CONTRACT.md.
 *
 * No drink is ever inferred from the shot. Steam settings and a yield/dose ratio describe how
 * the coffee was made, not what the barista calls it, and a name guessed from them is wrong as
 * often as it is right -- "Cappuccino" on a shot that was steamed for a second drink, "Lungo"
 * on a long ristretto. A beverage appears only when it was typed, on the item being saved.
 *
 * With no bean name there is nothing identifying left, so the date disambiguates instead of a
 * bare counter: two saves of the same profile on different days read as different recipes.
 */
export function proposeRecipeName(
  wf: AnyRecord,
  existingNames: string[] = [],
  beverage = "",
  now: Date = new Date()
): string {
  const word = String((wf && wf.profile && wf.profile.title) || "").trim().split(/\s+/)[0] || "";
  const ctx = (wf && wf.context) || {};
  const bean = String(ctx.coffeeName || "").trim();
  const typed = String(beverage || "").trim();
  const parts = [GENERIC_PROFILE.test(word) ? "" : word, bean, typed].filter(Boolean);
  // A generic profile, no bean and no typed beverage: "Recipe 26 Oct" rather than a bare date.
  if (!parts.length) parts.push("Recipe");
  if (!bean) parts.push(now.getDate() + " " + MONTHS[now.getMonth()]);
  const base = parts.join(" ");
  const taken = (n: string) => existingNames.some((x) => String(x).toLowerCase() === n.toLowerCase());
  if (!taken(base)) return base;
  // The bean is already in the name, so a collision is the same coffee again: just count.
  let n = 2;
  while (taken(base + " " + n)) n++;
  return base + " " + n;
}
