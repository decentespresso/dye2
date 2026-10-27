/**
 * Switching recipes must not leave the previous one's coffee in the live workflow. PUT
 * /api/v1/workflow deep-merges, so a recipe naming no bean has to send explicit nulls --
 * Decaid accepts them (workflow_handler.dart rejectExplicitNulls guards only
 * context.targetYield). Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearBeanlessRecipeWorkflows, clearBeanlessFavouriteWorkflows } from '../src/utils/recent-favs.ts';
const { devApiScript } = await import('../src/utils/dev-api.ts');

let stored = [];
const fakeFetch = async (url, opts) => {
  if (!opts || opts.method !== 'POST') return { ok: true, status: 200, json: async () => stored };
  stored = JSON.parse(opts.body);
  return { ok: true, status: 200, json: async () => stored };
};
const api = new Function('fetch', devApiScript + '\nreturn { updateRecipe, buildFavouriteWorkflow };')(fakeFetch);
const ctxOf = (id) => stored.find((r) => r.id === id).workflow.context;

// The stored body is what the R strip PUTs, so the nulls have to be in it.
{
  stored = [];
  await api.updateRecipe('a', { name: 'A', beanName: 'Ethiopia', beanRoaster: 'Some Co', beanBatchId: 'b-77' });
  assert.equal(ctxOf('a').coffeeName, 'Ethiopia');
  assert.equal(ctxOf('a').beanBatchId, 'b-77');

  await api.updateRecipe('b', { name: 'B' });
  assert.equal(ctxOf('b').coffeeName, null, 'no bean named -> cleared, not inherited');
  assert.equal(ctxOf('b').coffeeRoaster, null);
  assert.equal(ctxOf('b').beanBatchId, null);
  // The keys must be PRESENT and null: an absent key is what the deep merge leaves standing.
  for (const k of ['coffeeName', 'coffeeRoaster', 'beanBatchId']) {
    assert.ok(k in ctxOf('b'), k + ' must be sent as an explicit null');
  }

  // A bean with no batch still clears the batch (dye2#27), unchanged by this.
  await api.updateRecipe('c', { name: 'C', beanName: 'Kenya' });
  assert.equal(ctxOf('c').coffeeName, 'Kenya');
  assert.equal(ctxOf('c').beanBatchId, null);

  // Equipment and session fields are deliberately left alone.
  for (const k of ['grinderId', 'grinderModel', 'baristaName', 'drinkerName']) {
    assert.ok(!(k in ctxOf('b')), k + ' stays live: a recipe is not the grinder or the barista');
  }
}
console.log('ok   a recipe naming no bean clears the live bean');

// Rows stored before the rule keep no bean keys at all; the one-time pass adds the nulls.
{
  const rows = [
    { id: 'old', workflow: { context: { targetDoseWeight: 18 } } },
    { id: 'named', beanName: 'Kenya', workflow: { context: { coffeeName: 'Kenya' } } },
    { id: 'done', workflow: { context: { coffeeName: null, coffeeRoaster: null, beanBatchId: null } } },
    { id: 'nobody' },
  ];
  const once = clearBeanlessRecipeWorkflows(rows);
  assert.deepEqual(once[0].workflow.context,
    { targetDoseWeight: 18, coffeeName: null, coffeeRoaster: null, beanBatchId: null });
  assert.equal(once[1].workflow.context.coffeeName, 'Kenya', 'a recipe that names a bean is untouched');
  assert.equal(once[3].workflow, undefined, 'a row with no stored body is left as it is');
  assert.equal(clearBeanlessRecipeWorkflows(once), once, 'second run changes nothing');
  assert.deepEqual(clearBeanlessRecipeWorkflows([]), []);
}
console.log('ok   clearBeanlessRecipeWorkflows: one-shot, idempotent');

// DYE2's own apply (dashboard.ts) is a separate path and must agree. Browser-side string.
{
  const page = readFileSync(new URL('../src/pages/dashboard.ts', import.meta.url), 'utf8');
  assert.match(page, /ctx\.coffeeName = null; ctx\.coffeeRoaster = null; ctx\.beanBatchId = null;/,
    'applyRecipe clears the bean when the recipe names none');
}
{
  const plugin = readFileSync(new URL('../src/plugin.ts', import.meta.url), 'utf8');
  assert.match(plugin, /key: "recipeBeansMigrated"/, 'the pass runs once per install, on its own flag');
  assert.ok(plugin.includes('clearBeanlessRecipeWorkflows'), 'and is wired to the helper');
}
console.log('ok   both apply paths and the migration agree');

// A saved favourite follows the same rule: recents always nulled the bean trio
// (toRecentFavourite), recipes now do, and a saved favourite that copies beans but captured
// none must too. copyMask beans:false is the way to keep the live bean.
{
  const fav = (snapshot, copyMask) => api.buildFavouriteWorkflow({ snapshot, copyMask });

  const captured = (await fav({ coffeeName: 'Kenya', coffeeRoaster: 'Onyx', beanBatchId: 'b-3' })).context;
  assert.equal(captured.coffeeName, 'Kenya');
  assert.equal(captured.beanBatchId, 'b-3');

  const none = (await fav({ dose: 18 })).context;
  assert.equal(none.coffeeName, null, 'captured no bean -> clears the live one');
  assert.equal(none.coffeeRoaster, null);
  assert.equal(none.beanBatchId, null);
  for (const k of ['coffeeName', 'coffeeRoaster', 'beanBatchId']) {
    assert.ok(k in none, k + ' must be an explicit null, not an absent key');
  }

  // A bean with no batch clears just the batch, as before.
  const bare = (await fav({ coffeeName: 'Kenya' })).context;
  assert.equal(bare.coffeeName, 'Kenya');
  assert.equal(bare.beanBatchId, null);

  // Mask off: the favourite does not speak about beans at all.
  const masked = (await fav({ dose: 18 }, { beans: false })).context;
  for (const k of ['coffeeName', 'coffeeRoaster', 'beanBatchId']) {
    assert.ok(!(k in masked), 'copyMask beans:false leaves the live bean alone (' + k + ')');
  }
}
console.log('ok   a saved favourite with no bean clears the live bean');

// The one-time pass over stored favourite bodies: recents and masked rows are skipped.
{
  const rows = [
    { id: 'saved', snapshot: { dose: 18 }, workflow: { context: { targetDoseWeight: 18 } } },
    { id: 'named', snapshot: { coffeeName: 'Kenya' }, workflow: { context: { coffeeName: 'Kenya' } } },
    { id: 'masked', snapshot: {}, copyMask: { beans: false }, workflow: { context: {} } },
    { id: 'recent:1', auto: true, snapshot: {}, workflow: { context: { coffeeName: 'X' } } },
    { id: 'done', snapshot: {}, workflow: { context: { coffeeName: null, coffeeRoaster: null, beanBatchId: null } } },
  ];
  const once = clearBeanlessFavouriteWorkflows(rows);
  assert.deepEqual(once[0].workflow.context,
    { targetDoseWeight: 18, coffeeName: null, coffeeRoaster: null, beanBatchId: null });
  assert.equal(once[1].workflow.context.coffeeName, 'Kenya', 'a favourite that captured a bean is untouched');
  assert.deepEqual(once[2].workflow.context, {}, 'a masked row keeps saying nothing about beans');
  assert.equal(once[3].workflow.context.coffeeName, 'X', 'a recent is rebuilt elsewhere, left alone');
  assert.equal(clearBeanlessFavouriteWorkflows(once), once, 'second run changes nothing');
  assert.deepEqual(clearBeanlessFavouriteWorkflows([]), []);
}
console.log('ok   clearBeanlessFavouriteWorkflows: one-shot, skips recents and masked rows');

// applyAutoFavourite (DYE2's own apply) and the migration wiring agree.
{
  const page = readFileSync(new URL('../src/pages/dashboard.ts', import.meta.url), 'utf8');
  assert.match(page, /ctx\.beanBatchId   = snp\.beanBatchId   \|\| null;/,
    'applyAutoFavourite clears the bean when the favourite captured none');
  const plugin = readFileSync(new URL('../src/plugin.ts', import.meta.url), 'utf8');
  assert.match(plugin, /key: "favBeansMigrated"/);
  assert.ok(plugin.includes('clearBeanlessFavouriteWorkflows'));
}
console.log('ok   favourite apply paths and the migration agree');
