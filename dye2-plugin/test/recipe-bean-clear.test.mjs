/**
 * Switching recipes must not leave the previous one's coffee in the live workflow. PUT
 * /api/v1/workflow deep-merges, so a recipe naming no bean has to send explicit nulls --
 * Decaid accepts them (workflow_handler.dart rejectExplicitNulls guards only
 * context.targetYield). Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearBeanlessRecipeWorkflows, clearBeanlessFavouriteWorkflows, restoreZeroGrindRecipeWorkflows } from '../src/utils/recent-favs.ts';
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

  // The identities follow the bean (streamline-js#189): a recipe naming no grinder, basket,
  // barista or drinker clears each one rather than filing the shot under the last item's.
  for (const k of ['grinderId', 'grinderModel', 'baristaName', 'drinkerName']) {
    assert.equal(ctxOf('b')[k], null, k + ' must be cleared, not inherited');
    assert.ok(k in ctxOf('b'), k + ' must be sent as an explicit null');
  }
  for (const k of ['basketId', 'basketName']) {
    assert.equal(ctxOf('b').extras[k], null, k + ' must be cleared, not inherited');
    assert.ok(k in ctxOf('b').extras, k + ' must be sent as an explicit null');
  }

  // The numbers are not identities: a recipe that names a grind but no grinder sets the dial
  // and clears the attribution. Every recipe saved before DYE2 tracked grinders is this case.
  await api.updateRecipe('d', { name: 'D', dashboardVariables: { dose: 18, grind: 7.5, rpm: 1400 } });
  assert.equal(ctxOf('d').grinderSetting, '7.5');
  assert.equal(ctxOf('d').targetDoseWeight, 18);
  assert.equal(ctxOf('d').extras.rpm, 1400);
  assert.equal(ctxOf('d').grinderId, null, 'a grind number is not a grinder');
  assert.equal(ctxOf('d').grinderModel, null);

  // A recipe that does name them still carries them.
  await api.updateRecipe('e', {
    name: 'E', barista: 'Vid', drinker: 'Mark',
    dashboardVariables: { grinderId: 'g-1', grinderModel: 'Niche', basketId: 'bk-1', basketName: 'VST 18' },
  });
  assert.equal(ctxOf('e').grinderId, 'g-1');
  assert.equal(ctxOf('e').grinderModel, 'Niche');
  assert.equal(ctxOf('e').extras.basketId, 'bk-1');
  assert.equal(ctxOf('e').extras.basketName, 'VST 18');
  assert.equal(ctxOf('e').baristaName, 'Vid');
  assert.equal(ctxOf('e').drinkerName, 'Mark');

  // markDye turns a cleared field's flag null, so Streamline's post-shot clear reads it as
  // DYE2 clearing the field rather than owning a value.
  assert.equal(ctxOf('b').extras.dye.grinderId, null);
  assert.equal(ctxOf('e').extras.dye.grinderId, true);
}
console.log('ok   a recipe naming no bean, grinder, basket or barista clears each of them');

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
  assert.match(page, /else \{ ctx\.grinderId = null; ctx\.grinderModel = null; \}/,
    'applyRecipe clears the grinder when the recipe names none');
  assert.match(page, /ctx\.baristaName = recipe\.barista \|\| null;/,
    'applyRecipe clears the barista when the recipe names none');
}
{
  const plugin = readFileSync(new URL('../src/plugin.ts', import.meta.url), 'utf8');
  assert.match(plugin, /key: "recipeBeansMigrated"/, 'the pass runs once per install, on its own flag');
  assert.ok(plugin.includes('clearBeanlessRecipeWorkflows'), 'and is wired to the helper');
}
console.log('ok   both apply paths and the migration agree');

// 0 is a real dial position (dye2#47), so only null and '' name no grind, in both apply paths.
{
  const page = readFileSync(new URL('../src/pages/dashboard.ts', import.meta.url), 'utf8');
  const expr = page.match(/ctx\.grinderSetting = (dv\.grind[^;]*);/);
  assert.ok(expr, 'applyRecipe sets the grind from the recipe');
  const applyRecipeGrind = new Function('dv', 'return ' + expr[1]);
  const stripGrind = async (grind) => {
    stored = [];
    await api.updateRecipe('g', { name: 'G', dashboardVariables: { grind } });
    return ctxOf('g').grinderSetting;
  };
  for (const [grind, want] of [[0, '0'], ['0', '0'], [7.5, '7.5'], ['1.1.0', '1.1.0'], ['', null], [null, null], [undefined, null]]) {
    assert.equal(applyRecipeGrind({ grind }), want, 'applyRecipe, grind ' + JSON.stringify(grind));
    assert.equal(await stripGrind(grind), want, 'buildRecipeWorkflow, grind ' + JSON.stringify(grind));
  }
  // The dose and rpm keep the old rule: their 0 means nothing.
  await api.updateRecipe('z', { name: 'Z', dashboardVariables: { dose: 0, rpm: 0 } });
  assert.equal(ctxOf('z').targetDoseWeight, null);
  assert.equal(ctxOf('z').extras.rpm, null);
}
console.log('ok   a grind setting of 0 survives both apply paths');

// Rows saved at grind 0 before dye2#47 hold a null in the body the R strip PUTs.
{
  const row = (id, grind, context) => ({ id, dashboardVariables: { grind }, workflow: { profile: { title: 'P' }, context } });
  const rows = [
    row('nulled', 0, { grinderSetting: null, targetDoseWeight: 18 }),
    row('absent', 0, { targetDoseWeight: 18 }),
    row('kept', 0, { grinderSetting: '0' }),
    row('moved', 0, { grinderSetting: '5' }),
    row('none', null, { grinderSetting: null }),
    row('blank', '', { grinderSetting: null }),
    { id: 'no-body', dashboardVariables: { grind: 0 } },
    null,
  ];
  const once = restoreZeroGrindRecipeWorkflows(rows);
  assert.deepEqual(once[0].workflow, { profile: { title: 'P' }, context: { grinderSetting: '0', targetDoseWeight: 18 } });
  assert.equal(once[1].workflow.context.grinderSetting, '0');
  for (const i of [2, 3, 4, 5, 6, 7]) assert.equal(once[i], rows[i], 'row ' + i + ' is left as it was');
  assert.equal(rows[0].workflow.context.grinderSetting, null, 'the input is not mutated');
  assert.equal(restoreZeroGrindRecipeWorkflows(once), once, 'second run changes nothing');
  const plugin = readFileSync(new URL('../src/plugin.ts', import.meta.url), 'utf8');
  assert.match(plugin, /onLoad\([\s\S]*?healZeroGrindRecipes\(\)/, 'the repair runs on load');
}
console.log('ok   restoreZeroGrindRecipeWorkflows: repairs only a saved 0 the stored body lost');

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
