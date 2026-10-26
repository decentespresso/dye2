import { recentGroupKey } from "./recent-favs.ts";

/**
 * Select Recipe's use sorts, as a browser-side script string that
 * test/select-recipe.test.mjs evals directly. `uses` is shotIndex.uses: shots per recipe id in the
 * last TAIL_DAYS. A recipe with no shots counts 0; ties go newest capturedAt first.
 */
export const recipeUseSortScript = `
function sortRecipesByUse(list, uses, dir) {
  const u = uses || {};
  const n = r => u[r.id] || 0;
  const t = r => new Date(r.capturedAt || 0).getTime() || 0;
  return [...list].sort((a, b) => (dir === 'asc' ? n(a) - n(b) : n(b) - n(a)) || t(b) - t(a));
}
`;



/**
 * Rating sort for Select Recipe and Auto Favs. `tail` is shotIndex.tail: rows { id, ts, rating, key,
 * rid }, rating null when unrated. An item's rating is the plain mean of its non-null ratings;
 * rated items go best first, unrated last, ties and unrated newest capturedAt first.
 * `idOf(item)` and `fieldOf(row)` pick what to match: recipe id vs rid, or favourite group key vs
 * key. recentGroupKey is embedded from recent-favs.ts itself (it is self-contained for exactly
 * that reason), so a favourite is keyed by the one formula the index used; no usable workflow ->
 * null -> unrated. The embedded source is assigned to a `const` of a name we choose rather than
 * relied on to declare one: what the bundler calls the function is its business, and a rename
 * would otherwise leave the pages calling a name that no longer exists -- in string code, with
 * nothing to catch it before the tablet.
 */
export const ratingSortScript = `
const recentGroupKey = (${recentGroupKey.toString()});
// A recent favourite's own shot is a tail row, so take that row's key instead of recomputing it:
// a shot whose recorded profile is not executable is stored with no workflow.profile at all
// (recent-favs.ts toRecentFavourite), and a recomputed key would then miss its own group.
function favouriteGroupKey(fav, tail) {
  if (fav && fav.sourceShotId) {
    const own = tail.find(t => t && t.id === fav.sourceShotId);
    if (own && own.key) return own.key;
  }
  return recentGroupKey(fav);
}
function sortByMeanRating(list, tail, idOf, fieldOf) {
  const sum = {}, n = {};
  for (const row of tail) {
    if (!row || typeof row.rating !== 'number' || isNaN(row.rating)) continue;
    const k = fieldOf(row);
    if (k == null) continue;
    sum[k] = (sum[k] || 0) + row.rating; n[k] = (n[k] || 0) + 1;
  }
  const mean = item => { const k = idOf(item); return k != null && n[k] ? sum[k] / n[k] : null; };
  const captured = r => new Date(r.capturedAt || 0).getTime() || 0;
  const m = new Map(list.map(i => [i, mean(i)]));
  return [...list].sort((a, b) => {
    const x = m.get(a), y = m.get(b);
    if (x == null && y == null) return captured(b) - captured(a);
    if (x == null) return 1;
    if (y == null) return -1;
    return (y - x) || captured(b) - captured(a);
  });
}
`;
