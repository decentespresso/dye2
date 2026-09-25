import assert from 'node:assert/strict';
import { favCardTapScript } from '../src/utils/fav-card-tap.ts';

const { decideCardTap } = new Function(favCardTapScript + '\nreturn { decideCardTap };')();
assert.equal(decideCardTap(null, 'a'), 'select', 'nothing selected: first tap selects');
assert.equal(decideCardTap('b', 'a'), 'select', 'another card selected: tap selects this one');
assert.equal(decideCardTap('a', 'a'), 'edit', 'tapping the selected card opens edit');
assert.equal(decideCardTap('recent:x', 'recent:x'), 'edit', 'same for a recent');
assert.equal(decideCardTap(null, null), 'select', 'no ids never opens edit');
console.log('ok   fav-card-tap: select first, edit on the selected card');
