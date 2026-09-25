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

interface Page {
  items: AnyRecord[];
  total: number;
}

type GetPage = (offset: number) => Promise<Page>;

type FetchLike = (
  url: string,
  init?: AnyRecord
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

const RECENT_MAX = 5;
const RECENT_MAX_PAGES = 5;
const SHOT_PAGE_LIMIT = 100;
const SKIPPED_BEVERAGE_TYPES = new Set(["cleaning", "calibrate"]);

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
  const wf = (shot && shot.workflow) || {};
  const ctx = wf.context || {};
  const profile = wf.profile || {};

  if (SKIPPED_BEVERAGE_TYPES.has(profile.beverage_type)) return null;
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
 * Scans shot history newest-first, one page at a time via getPage, and returns the
 * first (= newest) shot for up to `max` distinct recentGroupKey groups. Because both
 * the page order and each page's own order are newest-first, the first occurrence of
 * each key is already in "by the group's newest shot, newest first" order — no
 * separate sort needed. Stops as soon as `max` groups are found or `maxPages` pages
 * have been scanned, whichever comes first.
 */
export async function pickRecentShots(
  getPage: GetPage,
  max = RECENT_MAX,
  maxPages = RECENT_MAX_PAGES
): Promise<AnyRecord[]> {
  const shotByKey = new Map<string, AnyRecord>();
  const order: string[] = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const { items, total } = await getPage(offset);
    const list = Array.isArray(items) ? items : [];

    for (const shot of list) {
      const key = recentGroupKey(shot);
      if (!key || shotByKey.has(key)) continue;
      shotByKey.set(key, shot);
      order.push(key);
      if (order.length >= max) return order.map((k) => shotByKey.get(k)!);
    }

    offset += list.length;
    if (list.length === 0 || offset >= (total || 0)) break;
  }

  return order.map((k) => shotByKey.get(k)!);
}

/** Builds one auto-favourite from a representative shot. No title de-duplication yet
 *  — that depends on the other recents in the batch, see applyTitleDisambiguation. */
export function toRecentFavourite(shot: AnyRecord, rank: number): AnyRecord {
  const wf = shot.workflow || {};
  const ctx = wf.context || {};
  const profile = wf.profile || {};
  const extras = ctx.extras || {};
  const grinderModel = ctx.grinderModel != null ? ctx.grinderModel : null;

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
  if (extras.rpm != null) context.extras = { rpm: extras.rpm };

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
      beanBatchId: ctx.beanBatchId || null,
      coffeeName: ctx.coffeeName || null,
      coffeeRoaster: ctx.coffeeRoaster || null,
      grinderId: ctx.grinderId || null,
      grinderModel: grinderModel,
      grindSetting: ctx.grinderSetting != null ? ctx.grinderSetting : null,
      rpm: extras.rpm != null ? extras.rpm : null,
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

/**
 * A saved favourite claims a dashboard slot 1..5 when it opts in (alwaysOnDashboard
 * !== false) and has a favSlot in range. Recents fill whatever slots are left, in
 * recentRank order; any that don't fit get favSlot: null, alwaysOnDashboard: false —
 * still readable from the KV array, just not shown on the Streamline dashboard strip.
 */
export function assignSlots(recents: AnyRecord[], saved: AnyRecord[]): AnyRecord[] {
  const claimed = new Set<number>();
  (saved || []).forEach((f) => {
    if (f && f.alwaysOnDashboard !== false && f.favSlot >= 1 && f.favSlot <= 5) {
      claimed.add(f.favSlot);
    }
  });

  let slot = 1;
  return recents.map((r) => {
    while (slot <= 5 && claimed.has(slot)) slot++;
    if (slot > 5) return { ...r, favSlot: null, alwaysOnDashboard: false };
    const placed = { ...r, favSlot: slot, alwaysOnDashboard: true };
    claimed.add(slot);
    slot++;
    return placed;
  });
}

let refreshInFlight: Promise<AnyRecord[]> | null = null;
let rerunRequested = false;

async function runRefresh(fetchFn: FetchLike, base: string): Promise<AnyRecord[]> {
  async function getPage(offset: number): Promise<Page> {
    const res = await fetchFn(
      base + "/shots?limit=" + SHOT_PAGE_LIMIT + "&offset=" + offset + "&order=desc"
    );
    if (!res.ok) throw new Error("HTTP " + res.status + " fetching shots");
    const data = await res.json();
    const items = Array.isArray(data) ? data : data && data.items ? data.items : [];
    const total = data && typeof data.total === "number" ? data.total : items.length;
    return { items, total };
  }

  const chosen = await pickRecentShots(getPage, RECENT_MAX, RECENT_MAX_PAGES);
  const recents = applyTitleDisambiguation(chosen.map((shot, i) => toRecentFavourite(shot, i + 1)));

  const storeRes = await fetchFn(base + "/store/dye2.reaplugin/autoFavourites");
  if (!storeRes.ok) throw new Error("HTTP " + storeRes.status + " reading autoFavourites");
  const storeVal = await storeRes.json();
  const saved = (Array.isArray(storeVal) ? storeVal : []).filter((x: AnyRecord) => x && !x.auto);

  const placedRecents = assignSlots(recents, saved);

  const putRes = await fetchFn(base + "/store/dye2.reaplugin/autoFavourites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([...placedRecents, ...saved]),
  });
  if (!putRes.ok) throw new Error("HTTP " + putRes.status + " writing autoFavourites");

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
