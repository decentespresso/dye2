import assert from 'node:assert/strict';
import { dedupeRecipeSlots } from '../src/utils/recent-favs.ts';

// The user's live shape: ids 1 and 2 both hold slot 1.
const rows = [
  { id: '1', stripSlot: 1, capturedAt: '2026-09-01T02:32:34.462Z', name: 'a' },
  { id: '2', stripSlot: 1, capturedAt: '2026-10-23T02:57:46.523Z', name: 'b' },
  { id: '3', stripSlot: 3, capturedAt: '2026-10-23T02:14:14.188Z' },
  { id: 'x', stripSlot: null, capturedAt: '2026-10-23T04:30:13.063Z' },
];
const out = dedupeRecipeSlots(rows);
assert.deepEqual(out.map((r) => [r.id, r.stripSlot]), [['1', null], ['2', 1], ['3', 3], ['x', null]], 'newest capturedAt keeps the slot');
assert.equal(out[0].name, 'a', 'loser keeps everything else');
assert.equal(out[2], rows[2], 'untouched rows are the same objects');
assert.equal(rows[0].stripSlot, 1, 'input not mutated');
assert.equal(dedupeRecipeSlots(out), out, 'idempotent: same array back');
const clean = [{ id: 'a', stripSlot: 1 }, { id: 'b', stripSlot: 2 }, { id: 'c', stripSlot: null }];
assert.equal(dedupeRecipeSlots(clean), clean, 'nothing shared: same array');
// ties: larger id keeps; missing capturedAt loses to a dated row; three-way share
const tie = dedupeRecipeSlots([{ id: 'a', stripSlot: 2, capturedAt: 'T' }, { id: 'b', stripSlot: 2, capturedAt: 'T' }]);
assert.deepEqual(tie.map((r) => r.stripSlot), [null, 2], 'tie -> larger id');
const three = dedupeRecipeSlots([{ id: 'p', stripSlot: 4 }, { id: 'q', stripSlot: 4, capturedAt: '2026-01-01T00:00:00Z' }, { id: 'r', stripSlot: 4, capturedAt: '2025-01-01T00:00:00Z' }]);
assert.deepEqual(three.map((r) => r.stripSlot), [null, 4, null]);
assert.equal(dedupeRecipeSlots(undefined), undefined);
console.log('ok   dedupeRecipeSlots: newest keeps the slot, ties by id, idempotent');
