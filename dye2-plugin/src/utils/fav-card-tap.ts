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
