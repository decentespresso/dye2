/* Browser-side helpers for recipe-edit's five-tab strip (one tab per Streamline R strip slot).
   Kept as a string, like the other browser scripts, so the page inlines it and the node test
   can evaluate the very same text. Pure: no DOM. */
export const recipeStripScript = `
// Who holds strip slot n. A recipe cleared off the strip from Streamline's long-press menu
// keeps its stripSlot but carries showOnStreamlineDashboard:false, and a cleared button must
// read empty here too -- it showed the cleared recipe's name while the R strip showed a blank.
// Absent means shown.
function stripHolds(r, n) {
  return !!r && r.stripSlot === n && r.showOnStreamlineDashboard !== false;
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
`;
