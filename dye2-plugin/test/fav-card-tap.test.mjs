import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardLongPressScript, favCardTapScript } from '../src/utils/fav-card-tap.ts';

const { decideCardTap } = new Function(favCardTapScript + '\nreturn { decideCardTap };')();
assert.equal(decideCardTap(null, 'a'), 'select', 'nothing selected: first tap selects');
assert.equal(decideCardTap('b', 'a'), 'select', 'another card selected: tap selects this one');
assert.equal(decideCardTap('a', 'a'), 'edit', 'tapping the selected card opens edit');
assert.equal(decideCardTap('recent:x', 'recent:x'), 'edit', 'same for a recent');
assert.equal(decideCardTap(null, null), 'select', 'no ids never opens edit');
console.log('ok   fav-card-tap: select first, edit on the selected card');

// The hold must not also fire the card's tap. attachCardLongPress stops that with a capture
// listener on the card; Chrome runs capture listeners on the target before its bubble ones, so
// it holds whichever of the two is registered first (checked in the browser both ways round).
// What the swallow does depend on is the longFired flag surviving to the trailing click, so
// pin that the clear handlers cannot reset it.
assert.ok(cardLongPressScript.includes('}, true);'), 'the click swallow is a capture listener');
assert.match(cardLongPressScript, /const clear = \(\) => \{ if \(timer\)/,
  'clear() only cancels a pending timer -- resetting longFired there would unswallow the click');
for (const page of ['dashboard', 'select-recipe', 'auto-favs', 'bean-picker', 'grinders']) {
  const src = readFileSync(new URL(`../src/pages/${page}.ts`, import.meta.url), 'utf8');
  assert.match(src, /attachCardLongPress\(\w+,/, `${page} still wires a card long-press`);
  assert.ok(src.includes('cardLongPressScript'), `${page} still ships the helper to the page`);
}
console.log('ok   fav-card-tap: the hold swallows its trailing click, on every card grid');
