/**
 * Select Recipe's use sorts, as a browser-side script string (no imports, so
 * test/select-recipe.test.mjs can eval it). `uses` is shotIndex.uses: shots per recipe id in the
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
