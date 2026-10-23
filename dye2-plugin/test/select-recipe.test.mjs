/**
 * Recipe library: ids are opaque, stripSlot is the strip position (1..5 | null).
 * Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explicitRecipeSlot, migrateRecipeSlots } from '../src/utils/recent-favs.ts';
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

// explicitRecipeSlot: only a named, valid slot is a slot; nothing is ever picked for the caller.
{
  assert.equal(explicitRecipeSlot(), null, 'no slot -> library');
  assert.equal(explicitRecipeSlot(null), null);
  assert.equal(explicitRecipeSlot(''), null);
  assert.equal(explicitRecipeSlot(3), 3);
  assert.equal(explicitRecipeSlot('4'), 4, 'numeric string honoured');
  assert.equal(explicitRecipeSlot(9), null, 'out-of-range -> library, not a free slot');
  assert.equal(explicitRecipeSlot(0), null);
  assert.equal(explicitRecipeSlot('x'), null);
}
console.log('ok   explicitRecipeSlot: explicit 1..5 or null, never auto-placed');

// The page reuses decideCardTap rather than carrying its own copy.
{
  const page = readFileSync(new URL('../src/pages/select-recipe.ts', import.meta.url), 'utf8');
  assert.ok(page.includes('${favCardTapScript}'), 'inlines the shared helper');
  assert.ok(page.includes('decideCardTap(selectedRecipeId'), 'and calls it');
  assert.ok(!/function decideCardTap/.test(page), 'without redefining it');
}
console.log('ok   select-recipe reuses decideCardTap');

// recipe-edit's five-tab strip: labels, confirm on a held slot, clearing keeps the recipe.
{
  const { recipeStripScript } = await import('../src/utils/recipe-strip.ts');
  const t = new Function(recipeStripScript + '\nreturn { stripTabLabel, stripSlotHolder, stripNextTarget, stripReplaceLabel };')();
  const lib = [
    { id: 'a', name: 'Ethiopia', stripSlot: 1 },
    { id: 'b', stripSlot: 2 },
    { id: 'c', name: 'Guess', stripSlot: 3 },
    { id: 'd', name: 'Unassigned', stripSlot: null },
  ];
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => t.stripTabLabel(lib, n)),
    ['Ethiopia', 'Recipe', 'Guess', '', '']);

  // The open recipe 'd' has no slot: targeting a held slot names the holder and needs the confirm.
  const holder = t.stripSlotHolder(lib, 'd', 1);
  assert.equal(holder.id, 'a');
  assert.equal(t.stripReplaceLabel(holder, 1), 'REPLACE Ethiopia ON 1?');
  assert.equal(t.stripReplaceLabel(t.stripSlotHolder(lib, 'd', 2), 2), 'REPLACE RECIPE ON 2?');
  assert.equal(t.stripSlotHolder(lib, 'd', 4), null, 'a free slot needs no confirm');
  assert.equal(t.stripSlotHolder(lib, 'd', 3).id, 'c', 'every holder counts');
  assert.equal(t.stripSlotHolder(lib, 'a', 1), null, 'its own slot is not a replacement');
  assert.equal(t.stripSlotHolder(lib, 'd', null), null);

  // Tapping the active tab clears the target; SAVE of that keeps the recipe in the library.
  assert.equal(t.stripNextTarget(null, 4), 4);
  assert.equal(t.stripNextTarget(4, 4), null);
  stored = [{ id: 'a', name: 'Ethiopia', stripSlot: 1 }];
  await api.updateRecipe('a', { stripSlot: t.stripNextTarget(1, 1) });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].stripSlot, null);
  assert.equal(stored[0].name, 'Ethiopia');
}
console.log('ok   recipe-edit tab strip: labels, confirm on a held slot, clear keeps the recipe');

// bean-picker and select-recipe share one copy of the picker CSS/header/rail (Figma 2345:2457).
{
  // shared-components imports extensionless modules, so read it as text rather than importing it.
  const sc = readFileSync(new URL('../src/utils/shared-components.ts', import.meta.url), 'utf8');
  const src = (f) => readFileSync(new URL('../src/pages/' + f, import.meta.url), 'utf8');
  for (const f of ['bean-picker.ts', 'select-recipe.ts']) {
    const page = src(f);
    assert.ok(page.includes('dyePickerCss'), f + ' uses the shared css');
    assert.ok(page.includes('dyePickerHeaderHtml') && page.includes('dyePickerRailHtml'), f + ' uses the shared header and rail');
    assert.ok(!/\.dye-card\s*\{/.test(page), f + ' does not carry its own card css');
  }
  assert.ok(!/from "\.\/auto-favs"/.test(src('select-recipe.ts')), 'select-recipe no longer imports auto-favs');
  const css = sc.slice(sc.indexOf('export const dyePickerCss'), sc.indexOf('export const dyePickerSearchHtml'));
  assert.ok(/\.dye-card\s*\{[^}]*min-height: 80px;[^}]*border-radius: 15px/s.test(css), 'card css');
  assert.ok(css.includes('.dye-confirm-disabled') && css.includes('.dye-search-input'), 'confirm + search css');
  assert.ok(sc.includes('w-[180px]') && sc.includes('pt-[28px] px-[20px]') && sc.includes('id="dye-search-input"'), 'rail');
  assert.ok(sc.includes('dye-confirm-disabled" disabled'), 'confirm starts disabled');
}
console.log('ok   bean-picker and select-recipe share the picker css, header and rail');

// Cards open the editor by long-press only: no pencil button, both pages use the shared helper.
{
  for (const f of ['bean-picker', 'select-recipe']) {
    const src = readFileSync(new URL(`../src/pages/${f}.ts`, import.meta.url), 'utf8');
    assert.ok(!src.includes('dye-card-edit-btn'), `${f} has no pencil button`);
    assert.ok(src.includes('attachCardLongPress(card'), `${f} uses the long-press helper`);
    assert.ok(src.includes('cardLongPressScript'), `${f} inlines the helper`);
  }
  const shared = readFileSync(new URL('../src/utils/shared-components.ts', import.meta.url), 'utf8');
  assert.ok(!shared.includes('dye-card-edit-btn'), 'pencil CSS is gone');
}
console.log('ok   no pencil button, long-press helper shared');

// Use counts: shotIndex.uses counts tail rows per recipe id; Most/Least Used sort by it.
{
  const { countUses, foldShot } = await import('../src/utils/recent-favs.ts');
  const { recipeUseSortScript } = await import('../src/utils/recipe-sort.ts');
  const { sortRecipesByUse } = new Function(recipeUseSortScript + '\nreturn { sortRecipesByUse };')();
  const idx = { tail: [] };
  const shot = (id, rid) => ({
    id, timestamp: new Date().toISOString(),
    workflow: { name: 'w', profile: { title: 'P' }, context: { coffeeName: 'C', extras: rid ? { dye: { recipeId: rid } } : {} } },
  });
  foldShot(idx, shot('s1', 'a')); foldShot(idx, shot('s2', 'a')); foldShot(idx, shot('s3', 'b')); foldShot(idx, shot('s4', null));
  const uses = countUses(idx.tail);
  assert.deepEqual(uses, { a: 2, b: 1 }, 'counts per recipe id, ignores shots with no recipeId');
  assert.equal(idx.tail.find((t) => t.id === 's4').rid, null);

  const recipes = [
    { id: 'z', capturedAt: '2026-01-01' }, { id: 'b', capturedAt: '2026-02-01' },
    { id: 'a', capturedAt: '2026-03-01' }, { id: 'y', capturedAt: '2026-04-01' },
  ];
  const ids = (l) => l.map((r) => r.id).join('');
  assert.equal(ids(sortRecipesByUse(recipes, uses, 'desc')), 'abyz', 'most used first; zero-use last, ties newest first');
  assert.equal(ids(sortRecipesByUse(recipes, uses, 'asc')), 'yzba', 'least used first; zero-use first, ties newest first');
  assert.equal(ids(sortRecipesByUse(recipes, {}, 'desc')), 'yabz', 'no counts: newest first');
  const src = readFileSync(new URL('../src/pages/select-recipe.ts', import.meta.url), 'utf8');
  assert.ok(src.includes("['most-used', 'Most Used'], ['least-used', 'Least Used']"), 'rail has the use sorts');
}
console.log('ok   recipe use counts and Most/Least Used sorting');

// Select Roaster uses the shared picker css/header/rail, keeping only a page-scoped single-line card.
{
  const page = readFileSync(new URL('../src/pages/roasters.ts', import.meta.url), 'utf8');
  assert.ok(page.includes('dyePickerCss') && page.includes('dyePickerHeaderHtml') && page.includes('dyePickerRailHtml'), 'roasters uses the shared exports');
  assert.ok(!page.includes('.dye-sort-btn {'), 'roasters carries no own .dye-sort-btn');
  assert.ok(!page.includes('.dye-confirm-disabled {'), 'roasters carries no own .dye-confirm-disabled');
  assert.ok(!/(^|\n)\s*\.dye-card\s*\{/.test(page), 'roasters card override is id-scoped');
  assert.ok(page.includes("searchInput.addEventListener('input'"), 'roasters wires the search');
}
console.log('ok   roasters uses the shared picker css, header and rail');
