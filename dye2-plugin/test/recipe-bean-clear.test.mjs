/**
 * Switching recipes must not leave the previous one's coffee in the live workflow. PUT
 * /api/v1/workflow deep-merges, so a recipe naming no bean has to send explicit nulls --
 * Decaid accepts them (workflow_handler.dart rejectExplicitNulls guards only
 * context.targetYield). Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearBeanlessRecipeWorkflows } from '../src/utils/recent-favs.ts';
const { devApiScript } = await import('../src/utils/dev-api.ts');

let stored = [];
const fakeFetch = async (url, opts) => {
  if (!opts || opts.method !== 'POST') return { ok: true, status: 200, json: async () => stored };
  stored = JSON.parse(opts.body);
  return { ok: true, status: 200, json: async () => stored };
};
const api = new Function('fetch', devApiScript + '\nreturn { updateRecipe };')(fakeFetch);
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
