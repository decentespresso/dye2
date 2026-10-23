/* Browser-side helpers for recipe-edit's five-tab strip (one tab per Streamline R strip slot).
   Kept as a string, like the other browser scripts, so the page inlines it and the node test
   can evaluate the very same text. Pure: no DOM. */
export const recipeStripScript = `
// What the tab for strip slot n says: whoever holds it, else blank (an unassigned slot
// reads as an empty tab, not 'Empty n' — the user asked for no filler text).
function stripTabLabel(recipes, n) {
  const h = (recipes || []).find(r => r && r.stripSlot === n);
  return h ? (h.name || 'Recipe') : '';
}
// The other recipe a SAVE onto slot n would replace.
function stripSlotHolder(recipes, openId, n) {
  if (n == null) return null;
  return (recipes || []).find(r => r && r.id !== openId && r.stripSlot === n) || null;
}
// The slot after tapping tab n: tapping the active tab clears the target.
function stripNextTarget(current, n) { return current === n ? null : n; }
// SAVE's label while a held slot is targeted and not yet confirmed.
function stripReplaceLabel(holder, n) { return 'REPLACE ' + (holder.name || 'RECIPE') + ' ON ' + n + '?'; }
`;
