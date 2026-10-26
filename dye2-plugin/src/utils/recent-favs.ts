/**
 * Recent auto-favourites: DYE2's own most-used bean + profile + grinder combinations,
 * computed from shot history rather than saved by hand.
 *
 * Unlike the rest of src/utils/, this runs in the PLUGIN runtime, not a page's browser
 * runtime — plugin.ts imports it as real TypeScript (compiled by Vite), not as a
 * template-literal script string. It has no imports of its own and touches no DOM, so
 * it is also importable directly by a node test (see test/recent-favs.test.mjs) and by
 * plugin.ts alike. See docs/KV_CONTRACT.md ("Auto (recent) entries") for the shape this
 * writes, and docs/AI_DATA_NOTES.md for the workflow/KV rules it relies on.
 */

type AnyRecord = Record<string, any>;

type FetchLike = (
  url: string,
  init?: AnyRecord
) => Promise<{ ok: boolean; status: number; json: () => Promise<any>; headers?: { get(k: string): string | null } }>;

const RECENT_MAX = 5;
const SHOT_PAGE_LIMIT = 100;
// stopReason is an open set. Decaid writes ShotDecisionReason.name (reaprime
// lib/src/models/data/shot_state_event.dart:8): noScale, targetWeight, targetVolume, apiStop,
// appStop, machineEnded, profileAdvance, profileSkip, error, disconnected, stoppingBackstop.
// Only `error` and `disconnected` are excluded. `aborted`/`cancelled`/`canceled` are not Decaid
// values; they are kept only for imported shots. `stoppingBackstop` is deliberately NOT excluded:
// it is a safety stop, and whether that means a bad shot is a judgement call not yet made.
const ABORTED_STOP_REASONS = new Set(["error", "disconnected", "aborted", "cancelled", "canceled"]);

// --- Ranking constants (docs/KV_CONTRACT.md, "Auto (recent) entries") ---------------------
const PRIOR = 0.6;            // a group's rating before any evidence, 0..1
const PRIOR_WEIGHT = 2;       // m: how many shots' worth of evidence the prior counts for
const HALF_LIFE_DAYS = 15;    // a shot's weight halves every 15 days (~1 month old = 0.25)
const TAIL_DAYS = 120;        // history the index keeps and scores; older shots weigh < 0.004
const DAY_MS = 86400000;
// NOT user-confirmed: an unrated group scores at PRIOR (ranked mid, not hidden). false = score 0.
const UNRATED_SCORES_AT_PRIOR = true;
// NOT user-confirmed: a group whose newest shot is older than this is dropped from the strip.
const STALE_DAYS = 60;
const INDEX_KEY = "shotIndex";
const INDEX_VERSION = 2;   // 2: tail rows carry `rid`, index carries `uses`

function norm(v: unknown): string {
  return String(v == null ? "" : v).trim().toLowerCase();
}

// PUT /workflow parses context.profile with Profile.fromJson, which requires a
// non-empty title, a non-empty steps array, tank_temperature and
// target_volume_count_start (reaprime profile.dart:59-71) — and rejects the WHOLE
// request, context included, if any are missing. A shot's own recorded profile can
// lack them (e.g. an imported shot), so this must be checked before ever attaching
// one to an auto-favourite.
export function isExecutableRecordedProfile(profile: AnyRecord): boolean {
  if (!profile) return false;
  const title = typeof profile.title === "string" ? profile.title.trim() : "";
  return (
    title.length > 0 &&
    Array.isArray(profile.steps) &&
    profile.steps.length > 0 &&
    profile.tank_temperature != null &&
    profile.target_volume_count_start != null
  );
}

/**
 * The grouping key for a shot: bean (batch id, else roaster+name) + profile title +
 * grinder (id, else model). Returns null for a shot that should never form its own
 * recent group — a cleaning/calibrate run, or one with no bean identity at all.
 */
export function recentGroupKey(shot: AnyRecord): string | null {
  // Self-contained on purpose: recipe-sort.ts embeds this function's source (.toString()) in the
  // pages, so it may not reference anything outside itself. Keep it that way.
  const skipped = ["cleaning", "calibrate"];
  const norm = (v: unknown): string => String(v == null ? "" : v).trim().toLowerCase();
  const wf = (shot && shot.workflow) || {};
  const ctx = wf.context || {};
  const profile = wf.profile || {};

  if (skipped.indexOf(profile.beverage_type) >= 0) return null;
  if (!ctx.beanBatchId && !ctx.coffeeName) return null;

  const beanPart = ctx.beanBatchId
    ? "batch:" + norm(ctx.beanBatchId)
    : "name:" + norm(ctx.coffeeRoaster) + "::" + norm(ctx.coffeeName);
  const profilePart = "profile:" + norm(profile.title);
  const grinderPart = ctx.grinderId
    ? "gid:" + norm(ctx.grinderId)
    : "gmodel:" + norm(ctx.grinderModel);

  return [beanPart, profilePart, grinderPart].join("|");
}

/**
 * Can this shotUpdated patch change a recent? The workflow (recentGroupKey, the recorded
 * profile), the rpm annotation (resolveRpm) and the rating (the ranking) feed them; a note
 * edit does not. A patch that is missing or unreadable answers true (fail safe).
 */
export function shotPatchAffectsRecents(patch: unknown): boolean {
  let p: any = patch;
  if (typeof p === "string") {
    try { p = JSON.parse(p); } catch { return true; }
  }
  if (!p || typeof p !== "object") return true;
  if ("workflow" in p) return true;
  if (p.annotations && "enjoyment" in p.annotations) return true;
  const extras = p.annotations && p.annotations.extras;
  return !!extras && typeof extras === "object" && "rpm" in extras;
}

// --- Shot index + ranking ------------------------------------------------------------------

interface TailEntry { id: string; ts: number; rating: number | null; key: string; rid: string | null }
interface ShotIndex {
  v: number; builtAt: number; newestShotId: string | null; newestTs: number | null; total: number;
  etag: string | null;
  reps: Record<string, AnyRecord>;   // group key -> slim newest shot (toRecentFavourite input)
  tail: TailEntry[];                 // shots in the last TAIL_DAYS; everything is scored from these
  uses?: Record<string, number>;     // recipeId -> shots in the tail (same TAIL_DAYS window as the score)
}

/** The index row for a shot, or null if it never counts (no group, aborted, no usable time). */
function tailEntry(shot: AnyRecord): TailEntry | null {
  const key = recentGroupKey(shot);
  const ts = Date.parse(shot && shot.timestamp);
  if (!key || isNaN(ts) || ABORTED_STOP_REASONS.has(norm(shot.stopReason))) return null;
  const e = shot.annotations && shot.annotations.enjoyment;   // 0..10, often null
  return { id: shot.id, ts, key, rid: shotRecipeId(shot), rating: typeof e === "number" ? Math.min(10, Math.max(0, e)) / 10 : null };
}

// Mirrors workflow-record.ts recipeIdOf (this file imports nothing so node tests can load it).
function shotRecipeId(shot: AnyRecord): string | null {
  const id = shot && shot.workflow && shot.workflow.context && shot.workflow.context.extras
    && shot.workflow.context.extras.dye && shot.workflow.context.extras.dye.recipeId;
  return id == null || id === "" ? null : String(id);
}

/** Shots per recipe id over the tail; rows without a recipe id (or an old v1 row) are ignored. */
export function countUses(tail: TailEntry[]): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const t of tail) if (t.rid) uses[t.rid] = (uses[t.rid] || 0) + 1;
  return uses;
}

/** Folds one full shot into the index (insert, or replace the same id). Pure apart from `idx`/`known`. */
export function foldShot(idx: ShotIndex, shot: AnyRecord, known?: Map<string, AnyRecord>): void {
  idx.tail = idx.tail.filter((t) => t.id !== shot.id);
  const e = tailEntry(shot);
  if (e) idx.tail.push(e);
  if (known) known.set(shot.id, shot);
}

/** Drops tail rows outside TAIL_DAYS, and rows whose id is not in `liveIds` when given. */
export function pruneTail(idx: ShotIndex, now: number, liveIds?: Set<string>): void {
  idx.tail = idx.tail.filter((t) => now - t.ts <= TAIL_DAYS * DAY_MS && (!liveIds || liveIds.has(t.id)));
}

/**
 * Every group in the tail, scored and ordered. now is a parameter, never Date.now(), so this is
 * deterministic.
 *   quality = (Σ rating + m·prior) / (n + m)          rating 0..1, n = rated shots
 *   w(shot) = 0.5 ^ (ageDays / HALF_LIFE_DAYS);  volume = Σ w
 *   score   = quality × volume / (volume + 1)
 * Groups whose newest shot is older than STALE_DAYS are dropped. Ties: newest shot desc, key asc.
 */
export function rankGroups(tail: TailEntry[], now: number): { key: string; score: number; newestTs: number; shots: number; quality: number }[] {
  const groups = new Map<string, { vol: number; sum: number; n: number; newestTs: number; shots: number }>();
  for (const t of tail) {
    const g = groups.get(t.key) || { vol: 0, sum: 0, n: 0, newestTs: 0, shots: 0 };
    g.vol += Math.pow(0.5, Math.max(0, now - t.ts) / DAY_MS / HALF_LIFE_DAYS);
    if (t.rating != null) { g.sum += t.rating; g.n++; }
    g.shots++;
    g.newestTs = Math.max(g.newestTs, t.ts);
    groups.set(t.key, g);
  }
  const ranked: { key: string; score: number; newestTs: number; shots: number; quality: number }[] = [];
  groups.forEach((g, key) => {
    if (now - g.newestTs > STALE_DAYS * DAY_MS) return;
    const quality = g.n === 0 && !UNRATED_SCORES_AT_PRIOR ? 0 : (g.sum + PRIOR_WEIGHT * PRIOR) / (g.n + PRIOR_WEIGHT);
    ranked.push({ key, score: (quality * g.vol) / (g.vol + 1), newestTs: g.newestTs, shots: g.shots, quality });
  });
  return ranked.sort((a, b) => b.score - a.score || b.newestTs - a.newestTs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * The strip positions 1..5 are `recipes[].stripSlot`, not the row id (ids are opaque and stable).
 * A recipe is NEVER placed automatically: only an explicit request names a slot. Returns that slot
 * (1..5, a numeric string is accepted), or null for anything missing/invalid = save to the library.
 */
export function explicitRecipeSlot(requested?: unknown): number | null {
  if (requested == null || requested === "") return null;
  const want = Number(requested);
  return [1, 2, 3, 4, 5].includes(want) ? want : null;
}

/**
 * One-shot, idempotent: a legacy row whose id is '1'..'5' and that has no `stripSlot` gets
 * `stripSlot = Number(id)`. The id stays put: extras.dye.recipeId in the live workflow and in shot
 * history points at it (dye2#36). Returns the same array when nothing needed migrating.
 */
export function migrateRecipeSlots(recipes: AnyRecord[]): AnyRecord[] {
  if (!(recipes || []).some((r) => r && r.stripSlot === undefined && /^[1-5]$/.test(String(r.id)))) return recipes;
  return recipes.map((r) => (r && r.stripSlot === undefined && /^[1-5]$/.test(String(r.id)) ? { ...r, stripSlot: Number(r.id) } : r));
}

/**
 * Self-heal: two rows must never share a `stripSlot` (updateRecipe clears the previous holder, but
 * two writers on the `recipes` key could still interleave and leave both). For each slot held by
 * more than one row the row with the newest `capturedAt` keeps it (ties, and rows with no valid
 * `capturedAt`, go to the larger id by string compare); the others become `stripSlot: null` and
 * keep everything else. Idempotent; returns the same array when no slot is shared.
 */
export function dedupeRecipeSlots(recipes: AnyRecord[]): AnyRecord[] {
  if (!Array.isArray(recipes)) return recipes;
  const ts = (r: AnyRecord) => { const t = Date.parse(String(r.capturedAt)); return Number.isFinite(t) ? t : -Infinity; };
  const beats = (a: AnyRecord, b: AnyRecord) => ts(a) !== ts(b) ? ts(a) > ts(b) : String(a.id) > String(b.id);
  const winner = new Map<unknown, AnyRecord>();
  for (const r of recipes) {
    if (!r || r.stripSlot == null) continue;
    const w = winner.get(r.stripSlot);
    if (!w || beats(r, w)) winner.set(r.stripSlot, r);
  }
  const loses = (r: AnyRecord) => r && r.stripSlot != null && winner.get(r.stripSlot) !== r;
  if (!recipes.some(loses)) return recipes;
  return recipes.map((r) => (loses(r) ? { ...r, stripSlot: null } : r));
}

/* One-time repair (plugin load, idempotent): a favourite stored with a profile in name only.
   Decaid drops profile.id, so a snapshot taken off the live workflow has no id to resolve later,
   and a live profile without steps left profileSnapshot null — such a row names e.g. 'Adaptive v2'
   with nothing behind it, and applying it (the skin reads workflow.profile straight off the row,
   DYE2 reads the snapshot) silently leaves whatever profile is loaded running. Resolve the real
   record from the library, by id and then by title, and write it onto BOTH the snapshot and the
   row's ready-to-PUT workflow. Returns the same array when nothing needed it, so the caller can
   skip the write. Rows that name no profile at all have nothing to resolve and are left alone;
   auto (recent) rows already carry the recorded profile of their source shot. */
const wholeProfile = (p: any) => !!(p && Array.isArray(p.steps) && p.steps.length);

/* Does this row name a profile it does not actually hold? The names come from the snapshot or the
   row's workflow; the profile has to be whole in BOTH places, since the skin applies
   workflow.profile and DYE2 applies the snapshot. */
function favouriteProfileIsThin(fav: AnyRecord): boolean {
  const snp = fav && fav.snapshot;
  if (!snp) return false;
  const wf = fav.workflow || {};
  if (wholeProfile(snp.profileSnapshot) && wholeProfile(wf.profile)) return false;
  return !!(snp.profileId || snp.profileTitle || (wf.profile && (wf.profile.id || wf.profile.title)));
}

/** Is the library worth fetching? True when any row names a profile it does not hold. */
export function favouritesNeedProfileRepair(favs: AnyRecord[]): boolean {
  return Array.isArray(favs) && favs.some(favouriteProfileIsThin);
}

export function fattenFavouriteProfiles(favs: AnyRecord[], profileRecords: AnyRecord[]): AnyRecord[] {
  if (!Array.isArray(favs)) return favs;
  const whole = wholeProfile;
  const byId = new Map<string, AnyRecord>();
  const byTitle = new Map<string, AnyRecord>();
  for (const rec of Array.isArray(profileRecords) ? profileRecords : []) {
    const prof = rec && rec.profile;
    if (!whole(prof)) continue;
    byId.set(String(rec.id), prof);
    // Titles are not unique; the first match wins, as everywhere else this falls back to a title.
    if (prof.title && !byTitle.has(String(prof.title))) byTitle.set(String(prof.title), { id: rec.id, profile: prof });
  }
  let changed = false;
  const out = favs.map((fav) => {
    if (!favouriteProfileIsThin(fav)) return fav;
    const snp = fav.snapshot;
    const wf = fav.workflow || {};
    const title = snp.profileTitle || (wf.profile && wf.profile.title) || null;
    const id = snp.profileId || (wf.profile && wf.profile.id) || null;
    const hit = (id != null ? byId.get(String(id)) : null) || null;
    const byName = !hit && title ? byTitle.get(String(title)) : null;
    const full = hit || (byName ? byName.profile : null);
    if (!whole(full)) return fav;
    changed = true;
    return {
      ...fav,
      snapshot: {
        ...snp,
        profileId: id != null ? id : (byName ? byName.id : null),
        profileTitle: title || full.title || null,
        profileSnapshot: full,
      },
      workflow: { ...wf, profile: full },
    };
  });
  return changed ? out : favs;
}

/**
 * Self-heal for favourites: two SAVED rows must never share a `favSlot` (the pages clear the
 * previous holder on write, this repairs data written before that). Of rows sharing a slot, one
 * that is shown (`alwaysOnDashboard !== false`) beats a hidden one, then the newest `capturedAt`,
 * then the larger id by string compare; losers become `favSlot: null` and keep every other field.
 * `auto: true` recents are ignored (assignSlots re-places them on every refresh). Idempotent;
 * returns the same array when no slot is shared.
 */
export function dedupeFavSlots(favs: AnyRecord[]): AnyRecord[] {
  if (!Array.isArray(favs)) return favs;
  const ts = (r: AnyRecord) => { const t = Date.parse(String(r.capturedAt)); return Number.isFinite(t) ? t : -Infinity; };
  const shown = (r: AnyRecord) => r.alwaysOnDashboard !== false;
  const beats = (a: AnyRecord, b: AnyRecord) =>
    shown(a) !== shown(b) ? shown(a) : ts(a) !== ts(b) ? ts(a) > ts(b) : String(a.id) > String(b.id);
  const saved = (r: AnyRecord) => r && !r.auto && r.favSlot != null;
  const winner = new Map<unknown, AnyRecord>();
  for (const r of favs) {
    if (!saved(r)) continue;
    const w = winner.get(r.favSlot);
    if (!w || beats(r, w)) winner.set(r.favSlot, r);
  }
  const loses = (r: AnyRecord) => saved(r) && winner.get(r.favSlot) !== r;
  if (!favs.some(loses)) return favs;
  return favs.map((r) => (loses(r) ? { ...r, favSlot: null } : r));
}

/**
 * One-off cleanup: an earlier release wrote `suggested: true` rows into `recipes`. Drops them and
 * leaves every other row untouched. Returns the same array when there is nothing to drop.
 */
export function dropSuggestedRecipes(recipes: AnyRecord[]): AnyRecord[] {
  if (!Array.isArray(recipes) || !recipes.some((r) => r && r.suggested === true)) return recipes;
  return recipes.filter((r) => !(r && r.suggested === true));
}

/**
 * RPM as corrected in Edit Shot wins over the pre-shot value, same precedence as
 * shotBasketRpm() in src/utils/recorded-shot.ts (annotations.extras, then
 * workflow.context.extras, then legacy grinderData). Restated here rather than
 * shared because this file runs in the plugin runtime and can't import that
 * browser-side script string (AI_RUNTIME_NOTES.md).
 */
function resolveRpm(shot: AnyRecord): number | null {
  const wf = shot.workflow || {};
  const extras = (wf.context && wf.context.extras) || {};
  const gd = wf.grinderData || {};
  const ax = (shot.annotations && shot.annotations.extras) || {};
  const rpm = ax.rpm != null ? ax.rpm : extras.rpm != null ? extras.rpm : gd.rpm;
  return rpm != null ? rpm : null;
}

/** Builds one auto-favourite from a representative shot. No title de-duplication yet
 *  — that depends on the other recents in the batch, see applyTitleDisambiguation. */
export function toRecentFavourite(shot: AnyRecord, rank: number): AnyRecord {
  const wf = shot.workflow || {};
  const ctx = wf.context || {};
  const profile = wf.profile || {};
  const grinderModel = ctx.grinderModel != null ? ctx.grinderModel : null;
  const rpm = resolveRpm(shot);

  // Always-present keys carry the shot's value or an explicit null (so an edit that
  // clears the field on save still clears it — PUT /workflow deep-merges). Optional
  // keys are omitted entirely when absent: the host rejects an explicit null
  // targetYield (workflow_handler.dart:172).
  const context: AnyRecord = {
    beanBatchId: ctx.beanBatchId != null ? ctx.beanBatchId : null,
    coffeeName: ctx.coffeeName != null ? ctx.coffeeName : null,
    coffeeRoaster: ctx.coffeeRoaster != null ? ctx.coffeeRoaster : null,
    grinderId: ctx.grinderId != null ? ctx.grinderId : null,
    grinderModel: grinderModel,
  };
  if (ctx.grinderSetting != null) context.grinderSetting = ctx.grinderSetting;
  if (ctx.targetDoseWeight != null) context.targetDoseWeight = ctx.targetDoseWeight;
  if (ctx.targetYield != null) context.targetYield = ctx.targetYield;
  if (rpm != null) context.extras = { rpm };

  return {
    id: "recent:" + shot.id,
    auto: true,
    recentRank: rank,
    sourceShotId: shot.id,
    title: ctx.coffeeName || "Recent shot",
    subtitle: [ctx.coffeeRoaster, profile.title, grinderModel].filter(Boolean).join(" · "),
    beverage: "",
    alwaysOnDashboard: false,
    favSlot: null,
    copyMask: {
      profile: true, beans: true, grinder: true, grindSetting: true, dose: true, drink: true,
      roastDate: false, basket: false, equipment: false, barista: false, drinker: false, note: false,
    },
    snapshot: {
      profileTitle: profile.title || null,
      // The recorded profile goes on the snapshot too, not just the workflow: DYE2's own apply
      // reads the snapshot (dashboard applyAutoFavourite) while the skin reads workflow.profile,
      // and a row that carries it in only one place applies with no profile from the other.
      profileSnapshot: isExecutableRecordedProfile(profile) ? profile : null,
      beanBatchId: ctx.beanBatchId || null,
      coffeeName: ctx.coffeeName || null,
      coffeeRoaster: ctx.coffeeRoaster || null,
      grinderId: ctx.grinderId || null,
      grinderModel: grinderModel,
      grindSetting: ctx.grinderSetting != null ? ctx.grinderSetting : null,
      rpm: rpm,
      dose: ctx.targetDoseWeight != null ? ctx.targetDoseWeight : null,
      drink: ctx.targetYield != null ? ctx.targetYield : null,
    },
    capturedAt: shot.timestamp,
    workflow: isExecutableRecordedProfile(profile)
      ? { context: context, profile: profile }
      : { context: context },
  };
}

/** Two same-titled recents get the profile title appended; if that still collides
 *  (same bean, same profile, different grinder) the grinder model is appended too.
 *  Mutates and returns the given array. */
export function applyTitleDisambiguation(recents: AnyRecord[]): AnyRecord[] {
  const appendWhereDuplicate = (suffixOf: (r: AnyRecord) => string | null | undefined) => {
    const counts = new Map<string, number>();
    recents.forEach((r) => counts.set(r.title, (counts.get(r.title) || 0) + 1));
    recents.forEach((r) => {
      if ((counts.get(r.title) || 0) <= 1) return;
      const suffix = suffixOf(r);
      if (suffix) r.title = r.title + " · " + suffix;
    });
  };
  appendWhereDuplicate((r) => r.snapshot && r.snapshot.profileTitle);
  appendWhereDuplicate((r) => r.snapshot && r.snapshot.grinderModel);
  return recents;
}

/** The F strip shows 4 favourites; its 5th cell is VIEW ALL AUTO FAV, so a favSlot of 5 can never
 *  appear. Keep in step with FAV_SLOT_MAX in dev-api.ts. */
export const FAV_SLOT_MAX = 4;

/**
 * A saved favourite claims a dashboard slot 1..FAV_SLOT_MAX when it opts in (alwaysOnDashboard
 * !== false) and has a favSlot in range. Recents fill whatever slots are left, in
 * recentRank order; any that don't fit get favSlot: null, alwaysOnDashboard: false —
 * still readable from the KV array, just not shown on the Streamline dashboard strip.
 */
export function assignSlots(recents: AnyRecord[], saved: AnyRecord[]): AnyRecord[] {
  const claimed = new Set<number>();
  (saved || []).forEach((f) => {
    if (f && f.alwaysOnDashboard !== false && f.favSlot >= 1 && f.favSlot <= FAV_SLOT_MAX) {
      claimed.add(f.favSlot);
    }
  });

  let slot = 1;
  return recents.map((r) => {
    while (slot <= FAV_SLOT_MAX && claimed.has(slot)) slot++;
    if (slot > FAV_SLOT_MAX) return { ...r, favSlot: null, alwaysOnDashboard: false };
    const placed = { ...r, favSlot: slot, alwaysOnDashboard: true };
    claimed.add(slot);
    slot++;
    return placed;
  });
}

let refreshInFlight: Promise<AnyRecord[]> | null = null;
let rerunRequested = false;
// ponytail: shotUpdated patches queue here until the next run drains them; lost on a plugin restart,
// which is fine because the next full/delta sync reads the shot again. Ceiling: none that matters.
const pendingUpdates: AnyRecord[] = [];

/** Queue an edited shot (shotUpdated's `shot`) for the next refresh to fold in. */
export function noteShotUpdated(shot: unknown): void {
  if (shot && typeof shot === "object" && (shot as AnyRecord).id) pendingUpdates.push(shot as AnyRecord);
}

const slim = (shot: AnyRecord): AnyRecord => {
  const rpm = shot.annotations && shot.annotations.extras && shot.annotations.extras.rpm;
  return { id: shot.id, timestamp: shot.timestamp, workflow: shot.workflow,
    ...(rpm != null ? { annotations: { extras: { rpm } } } : {}) };
};

async function runRefresh(fetchFn: FetchLike, base: string): Promise<AnyRecord[]> {
  const kvUrl = (k: string) => base + "/store/dye2.reaplugin/" + k;
  async function kvRead(k: string): Promise<any> {
    const res = await fetchFn(kvUrl(k));
    if (!res.ok) throw new Error("HTTP " + res.status + " reading " + k);
    return res.json();
  }
  async function kvWrite(k: string, v: unknown): Promise<void> {
    const res = await fetchFn(kvUrl(k), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    if (!res.ok) throw new Error("HTTP " + res.status + " writing " + k);
  }
  async function getPage(offset: number, limit = SHOT_PAGE_LIMIT, init?: AnyRecord) {
    const res = await fetchFn(base + "/shots?limit=" + limit + "&offset=" + offset + "&order=desc", init);
    if (res.status === 304) return { notModified: true as const, items: [], total: 0, etag: null };
    if (!res.ok) throw new Error("HTTP " + res.status + " fetching shots");
    const data = await res.json();
    const items: AnyRecord[] = Array.isArray(data) ? data : data && data.items ? data.items : [];
    const etag = res.headers && res.headers.get ? res.headers.get("ETag") : null;
    return { notModified: false as const, items, total: data && typeof data.total === "number" ? data.total : items.length, etag };
  }

  const now = Date.now();
  const stored = await kvRead(INDEX_KEY);
  const fresh = !stored || stored.v !== INDEX_VERSION || !Array.isArray(stored.tail);
  const idx: ShotIndex = fresh
    ? { v: INDEX_VERSION, builtAt: now, newestShotId: null, newestTs: null, total: 0, etag: null, reps: {}, tail: [], uses: {} }
    : stored;
  const before = JSON.stringify(idx);
  const known = new Map<string, AnyRecord>();

  // Startup / delta sync. Same newest id and total (or a 304 on the stored etag) means nothing new:
  // no scanning at all. Otherwise page newest-first until a known id or past the tail window.
  // ponytail: if the runtime's fetch exposes no headers, no etag is stored and the id+total
  // comparison does the same job; a shot deleted and another stored between runs keeps the same
  // total and is only noticed by the next full build (bump INDEX_VERSION).
  const probe = await getPage(0, 1, !fresh && idx.etag ? { headers: { "If-None-Match": idx.etag } } : undefined);
  const head = probe.items[0];
  const unchanged = !fresh && (probe.notModified || (probe.total === idx.total && (head ? head.id : null) === idx.newestShotId));
  if (!unchanged) {
    let offset = 0, added = 0, hitKnown = false;
    while (!hitKnown) {
      const page = await getPage(offset);
      for (const shot of page.items) {
        if (!fresh && shot.id === idx.newestShotId) { hitKnown = true; break; }
        if (now - Date.parse(shot.timestamp) > TAIL_DAYS * DAY_MS) { hitKnown = true; break; }
        foldShot(idx, shot, known);
        added++;
      }
      offset += page.items.length;
      if (page.items.length === 0 || offset >= page.total) break;
    }
    // A total that does not match what we saw means a delete: reconcile against the id list, no re-page.
    if (!fresh && probe.total !== idx.total + added) {
      const res = await fetchFn(base + "/shots/ids");
      if (!res.ok) throw new Error("HTTP " + res.status + " fetching shot ids");
      pruneTail(idx, now, new Set(await res.json()));
    }
    idx.newestShotId = head ? head.id : null;
    idx.newestTs = head ? Date.parse(head.timestamp) : null;
    idx.total = probe.total;
    idx.etag = probe.etag;
  }
  // Edits (shotUpdated): replace that row. A shot older than TAIL_DAYS is not in the tail and is not
  // scored, so editing it changes nothing here (exact, not stale); only its group's lifetime
  // history, which we do not keep, would differ.
  for (const shot of pendingUpdates.splice(0)) foldShot(idx, shot, known);
  pruneTail(idx, now);

  // Keep one representative (newest) shot per group; refetch it only when it changed or was removed.
  const newest = new Map<string, TailEntry>();
  idx.uses = countUses(idx.tail);
  idx.tail.forEach((t) => {
    const n = newest.get(t.key);
    if (!n || t.ts > n.ts || (t.ts === n.ts && t.id < n.id)) newest.set(t.key, t);
  });
  const reps: Record<string, AnyRecord> = {};
  for (const [key, e] of newest) {
    const have = known.get(e.id);
    if (have) reps[key] = slim(have);
    else if (idx.reps[key] && idx.reps[key].id === e.id) reps[key] = idx.reps[key];
    else {
      // Rare (a deleted or re-keyed rep). The host's `?ids=` list route would not help: it answers
      // with toJson(), measurements included, same as by-id (shots_handler.dart:64-80), so use by-id.
      const res = await fetchFn(base + "/shots/" + encodeURIComponent(e.id));
      if (!res.ok) throw new Error("HTTP " + res.status + " fetching shot " + e.id);
      reps[key] = slim(await res.json());
    }
  }
  idx.reps = reps;
  if (JSON.stringify(idx) !== before) {
    idx.builtAt = now;
    await kvWrite(INDEX_KEY, idx);
  }

  const all = rankGroups(idx.tail, now);
  const recents = applyTitleDisambiguation(all.slice(0, RECENT_MAX).map((r, i) => toRecentFavourite(idx.reps[r.key], i + 1)));

  const storeVal = await kvRead("autoFavourites");
  // dedupeFavSlots here as well: this write rewrites the saved rows from a read of its own, so
  // without it a refresh in flight could write back a shared slot the one-time migration just fixed.
  const saved = dedupeFavSlots((Array.isArray(storeVal) ? storeVal : []).filter((x: AnyRecord) => x && !x.auto));
  const placedRecents = assignSlots(recents, saved);
  await kvWrite("autoFavourites", [...placedRecents, ...saved]);

  return placedRecents;
}

/**
 * Recomputes the recent auto-favourites and rewrites the whole autoFavourites KV
 * array (recents first, then untouched saved favourites). Single-flight: a call made
 * while one is already running does not start a second run — it sets a rerun flag and
 * returns the SAME in-flight promise, then a fresh run starts right after the first
 * finishes, so a shot stored mid-refresh is never missed. Concurrent overlapping
 * callers therefore never see more than one run each, and never more than two runs
 * happen back to back.
 */
export function refreshRecentFavourites(
  fetchFn: FetchLike,
  base = "http://localhost:8080/api/v1"
): Promise<AnyRecord[]> {
  if (refreshInFlight) {
    rerunRequested = true;
    return refreshInFlight;
  }
  refreshInFlight = runRefresh(fetchFn, base).finally(() => {
    refreshInFlight = null;
    if (rerunRequested) {
      rerunRequested = false;
      refreshRecentFavourites(fetchFn, base).catch(() => {});
    }
  });
  return refreshInFlight;
}
