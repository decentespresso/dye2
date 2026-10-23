/**
 * Recipe library: ids are opaque, stripSlot is the strip position (1..5 | null).
 * Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allocateRecipeSlot, migrateRecipeSlots } from '../src/utils/recent-favs.ts';
const { devApiScript } = await import('../src/utils/dev-api.ts');

// Fake bridge KV; reads and the one POST updateRecipe makes (a single write per call).
let stored = [];
let posts = 0;
const fakeFetch = async (url, opts) => {
  if (!opts || opts.method !== 'POST') return { ok: true, status: 200, json: async () => stored };
  posts++;
  stored = JSON.parse(opts.body);
  return { ok: true, status: 200, json: async () => stored };
};
const api = new Function('fetch', devApiScript + '\nreturn { updateRecipe, getRecipes };')(fakeFetch);
const slots = () => Object.fromEntries(stored.map((r) => [r.id, r.stripSlot]));

// Slot assignment is exclusive, in one write; the old holder stays in the library.
{
  stored = [];
  await api.updateRecipe('a', { name: 'A', stripSlot: 2 });
  await api.updateRecipe('b', { name: 'B', stripSlot: 3 });
  assert.deepEqual(slots(), { a: 2, b: 3 });
  posts = 0;
  await api.updateRecipe('b', { stripSlot: 2 });
  assert.equal(posts, 1, 'taking an occupied slot is one POST');
  assert.deepEqual(slots(), { a: null, b: 2 }, 'the old holder loses the slot but is kept');
  assert.equal(stored.length, 2);

  // Clearing a slot keeps the recipe.
  await api.updateRecipe('b', { stripSlot: null });
  assert.deepEqual(slots(), { a: null, b: null });
  assert.equal(stored.find((r) => r.id === 'b').name, 'B');

  // An edit that does not mention stripSlot leaves it alone; a brand-new row defaults to null.
  await api.updateRecipe('a', { stripSlot: 4 });
  await api.updateRecipe('a', { name: 'A2' });
  assert.equal(stored.find((r) => r.id === 'a').stripSlot, 4);
  await api.updateRecipe('c', { name: 'C' });
  assert.equal(stored.find((r) => r.id === 'c').stripSlot, null);
}
console.log('ok   recipe stripSlot: exclusive, single write, clear keeps the recipe');

// Migration: ids '1'..'5' keep their id and gain stripSlot, once.
{
  const rows = [{ id: '2', name: 'x' }, { id: 'recipe-9', name: 'y' }, { id: '5', stripSlot: null }, { id: '7' }];
  const once = migrateRecipeSlots(rows);
  assert.deepEqual(once.map((r) => [r.id, r.stripSlot]), [['2', 2], ['recipe-9', undefined], ['5', null], ['7', undefined]],
    'only legacy ids without a stripSlot are touched; an explicit null (cleared) stays cleared');
  assert.equal(migrateRecipeSlots(once), once, 'second run changes nothing');
  assert.deepEqual(migrateRecipeSlots([]), []);
}
console.log('ok   migrateRecipeSlots: maps once, idempotent, ids untouched');

// allocateRecipeSlot works on stripSlot, not id.
{
  const row = (id, stripSlot, extra) => ({ id, stripSlot, ...extra });
  assert.deepEqual(allocateRecipeSlot([]), { slot: 1 });
  assert.deepEqual(allocateRecipeSlot([row('x', 1), row('y', 3)]), { slot: 2 }, 'lowest free stripSlot');
  assert.deepEqual(allocateRecipeSlot([row('1', null)]), { slot: 1 }, 'an id of "1" does not occupy slot 1');
  assert.deepEqual(allocateRecipeSlot([row('s', 1, { suggested: true })]), { slot: 1 }, 'suggested is free');
  const full = [1, 2, 3, 4, 5].map((n) => row('r' + n, n));
  assert.deepEqual(allocateRecipeSlot(full), { taken: [1, 2, 3, 4, 5] }, 'full -> caller 409s');
  assert.deepEqual(allocateRecipeSlot(full, '4'), { slot: 4 }, 'explicit slot honoured');
  assert.deepEqual(allocateRecipeSlot(full, 9), { taken: [1, 2, 3, 4, 5] }, 'out-of-range ignored');
}
console.log('ok   allocateRecipeSlot: lowest free stripSlot, 409 when full');

// The page reuses decideCardTap rather than carrying its own copy.
{
  const page = readFileSync(new URL('../src/pages/select-recipe.ts', import.meta.url), 'utf8');
  assert.ok(page.includes('${favCardTapScript}'), 'inlines the shared helper');
  assert.ok(page.includes('decideCardTap(selectedRecipeId'), 'and calls it');
  assert.ok(!/function decideCardTap/.test(page), 'without redefining it');
}
console.log('ok   select-recipe reuses decideCardTap');
