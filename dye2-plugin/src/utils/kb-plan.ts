/**
 * Keyboard-avoidance decision, as a browser-side script string (no local imports, so
 * test/kb-plan.test.mjs can eval it directly). The shell's kbAdjust measures the DOM and
 * hands the numbers here; this only decides which mechanism to use and by how much.
 *
 * Inputs are on-screen px except scrollerRoom, which is design px (scrollHeight -
 * clientHeight - scrollTop) or null when the field has no scrollable ancestor.
 * Every returned amount is in design px (on-screen overlap / scale), because the things it
 * moves live inside the scaled <body>.
 *
 *   none   - field clears the keyboard
 *   modal  - translate the position:fixed ancestor up by amount
 *   scroll - scrollTop += amount (the scroller has the room)
 *   pad    - the scroller cannot go far enough: scroll by amount and first add `pad`
 *            (the shortfall) of bottom padding so it can
 *   shift  - last resort: translate the page root up by amount (capped so the field stays
 *            on screen when fieldTop is given)
 */
export const kbPlanScript = `
function kbPlan(o) {
  var margin = o.margin == null ? 24 : o.margin;
  var scale = o.scale > 0 ? o.scale : 1;
  var overlap = o.fieldBottom + margin - (o.vvTop + o.vvHeight);
  if (!(overlap > 0)) return { mode: 'none', amount: 0 };
  var need = overlap / scale;
  if (o.hasModal) return { mode: 'modal', amount: need };
  if (o.scrollerRoom == null) {
    if (o.fieldTop != null) need = Math.min(need, Math.max(0, (o.fieldTop - 8) / scale));
    return need > 0 ? { mode: 'shift', amount: need } : { mode: 'none', amount: 0 };
  }
  var room = Math.max(0, o.scrollerRoom);
  if (room >= need) return { mode: 'scroll', amount: need };
  return { mode: 'pad', amount: need, pad: need - room };
}
`;
