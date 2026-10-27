/* Browser-side helpers for strip slots: recipe-edit's five-tab strip (one tab per Streamline R
   strip slot) and select-recipe's assign mode. Kept as a string, like the other browser scripts,
   so the pages inline it and the node test can evaluate the very same text. Pure: no DOM. */
export const recipeStripScript = `
// Who holds strip slot n. A recipe cleared off the strip from Streamline's long-press menu
// keeps its stripSlot but carries showOnStreamlineDashboard:false, and a cleared button must
// read empty here too -- it showed the cleared recipe's name while the R strip showed a blank.
// Absent means shown.
function stripHolds(r, n) {
  return !!r && r.stripSlot === n && r.showOnStreamlineDashboard !== false;
}
// Which slot the OPEN recipe holds, by the same rule the R strip places by: a recipe hidden
// from the strip holds none, whatever stripSlot still says. Streamline's long-press clear writes
// showOnStreamlineDashboard:false and leaves stripSlot behind, and its recipeStripCells filters
// hidden rows out — so reading stripSlot raw lit up a tab for a recipe the strip showed blank.
function stripTargetOf(r) {
  return r && r.showOnStreamlineDashboard !== false && r.stripSlot != null ? r.stripSlot : null;
}
// What the tab for strip slot n says: whoever holds it, else blank (an unassigned slot
// reads as an empty tab, not 'Empty n' — the user asked for no filler text).
function stripTabLabel(recipes, n) {
  const h = (recipes || []).find(r => stripHolds(r, n));
  return h ? (h.name || 'Recipe') : '';
}
// The other recipe a SAVE onto slot n would replace. A cleared one is not replaced in any
// sense the user can see, so it raises no REPLACE confirm.
function stripSlotHolder(recipes, openId, n) {
  if (n == null) return null;
  return (recipes || []).find(r => r && r.id !== openId && stripHolds(r, n)) || null;
}
// The slot after tapping tab n: tapping the active tab clears the target.
function stripNextTarget(current, n) { return current === n ? null : n; }
// SAVE's label while a held slot is targeted and not yet confirmed.
function stripReplaceLabel(holder, n) { return 'REPLACE ' + (holder.name || 'RECIPE') + ' ON ' + n + '?'; }

// --- select-recipe's assign mode ------------------------------------------------------------
// Streamline's R-strip long-press "Replace <name>" opens select-recipe?slot=N&return=<url>, so
// the picked card lands on the button that was long-pressed. Anything outside 1..5 is not a
// slot and leaves the page in its ordinary apply-a-recipe mode.
function assignSlotFrom(search) {
  const n = parseInt(new URLSearchParams(search).get('slot'), 10);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}
// The query that carries assign mode across a detour into recipe-edit, which leaves by route
// and would otherwise drop the barista out of the Replace flow onto the dashboard.
function assignQuery(slot, returnTo) {
  if (slot == null) return '';
  const q = new URLSearchParams({ slot: String(slot) });
  if (returnTo) q.set('return', returnTo);
  return '?' + q.toString();
}
`;
