/**
 * What a tap on a favourite card does, as a browser-side script string (no local imports,
 * so test/fav-card-tap.test.mjs can eval it directly): the first tap selects, tapping the
 * card that is already selected opens its edit page.
 */
export const favCardTapScript = `
function decideCardTap(selectedId, favId) {
  return selectedId && favId && selectedId === favId ? 'edit' : 'select';
}
`;

/**
 * The 500 ms card long-press, shared by auto-favs, select-recipe and bean-picker: calls
 * onLong() after a held press, and swallows the click that ends it so the card's ordinary
 * tap does not also fire. (shared-components' attachPresetLongPress is a different shape:
 * it can decline to fire, so it keeps its own copy.)
 */
export const cardLongPressScript = `
function attachCardLongPress(card, onLong) {
  let timer = null, longFired = false;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  card.addEventListener('pointerdown', () => {
    longFired = false;
    clear();
    timer = setTimeout(() => { timer = null; longFired = true; onLong(); }, 500);
  });
  ['pointerup','pointerleave','pointercancel'].forEach(ev => card.addEventListener(ev, clear));
  // Capture phase: stop the trailing click from also firing the card's tap.
  card.addEventListener('click', (e) => {
    if (longFired) { e.stopImmediatePropagation(); e.preventDefault(); longFired = false; }
  }, true);
}
`;
