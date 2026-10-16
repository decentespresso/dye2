/**
 * One runnable check for the equipment KV table (dev-api.ts createEquipment/getEquipment).
 * Run: npm test
 */
import assert from 'node:assert/strict';
const { devApiScript } = await import('../src/utils/dev-api.ts');

// Fake bridge KV: one key, starts unwritten (decaid returns 200 + null, never 404).
let stored = null;
const urls = [];
const fakeFetch = async (url, opts) => {
  urls.push(url);
  if (!opts || opts.method !== 'POST') return { ok: true, status: 200, json: async () => stored };
  stored = JSON.parse(opts.body);
  return { ok: true, status: 200, json: async () => stored };
};

const api = new Function('fetch', devApiScript +
  '\nreturn { getEquipment, createEquipment, buildRecipeWorkflow, getRecipe, updateRecipe, recipeChanges };')(fakeFetch);

assert.deepEqual(await api.getEquipment(), [], 'an unwritten key reads as an empty table');

const a = await api.createEquipment('Acaia Lunar');
assert.ok(a.id && a.name === 'Acaia Lunar' && a.createdAt, 'a row is { id, name, createdAt }');
assert.ok(urls.some(u => u.endsWith('/store/dye2.reaplugin/equipment')), 'written to the equipment key');

const again = await api.createEquipment('acaia lunar');
assert.equal(again.id, a.id, 'same name in different case reuses the row, never duplicates it');
assert.equal((await api.getEquipment()).length, 1, 'the table still holds one row');

await api.createEquipment('Weber tamper');
const rows = await api.getEquipment();
assert.equal(rows.length, 2, 'a genuinely new name adds a row');
assert.equal(new Set(rows.map(r => r.id)).size, 2, 'ids are unique');

console.log('ok   equipment KV table');

// A recipe carries the batch/roaster picked with its bean; the embedded workflow applies
// them together with the coffee name (dye2#27), and only the ones the recipe holds.
{
  const wf = (await api.buildRecipeWorkflow({ beanName: 'Ethiopia', beanRoaster: 'Onyx', beanBatchId: 'b-9' })).context;
  assert.equal(wf.coffeeName, 'Ethiopia');
  assert.equal(wf.coffeeRoaster, 'Onyx');
  assert.equal(wf.beanBatchId, 'b-9');
  const bare = (await api.buildRecipeWorkflow({ beanName: 'Ethiopia' })).context;
  assert.ok(!('beanBatchId' in bare) && !('coffeeRoaster' in bare), 'a recipe without a batch writes none');
  console.log('ok   recipe workflow carries the bean batch');
}

// Saving a recipe writes only what the barista changed onto the freshly re-read record
// (dye2#28): dial-in recording may have changed other fields while the editor was open.
{
  const loaded = { id: '1', name: 'Morning', beanName: 'Ethiopia', profileId: null,
    dashboardVariables: { dose: 18, drink: 36, brewC: 93, rpm: 600, grind: 4.2 } };
  const form = { name: 'Morning', beanName: 'Ethiopia', profileId: null,
    dashboardVariables: { dose: 18, drink: 36, brewC: null, rpm: 600, grind: 4.2, ratio: undefined } };
  // clearing brewC is a change, written as null; every untouched key is absent
  assert.deepEqual(api.recipeChanges(loaded, form), { dashboardVariables: { brewC: null } });
  assert.deepEqual(api.recipeChanges(loaded, JSON.parse(JSON.stringify(loaded))), {}, 'nothing touched, nothing patched');
  assert.deepEqual(api.recipeChanges(loaded, { ...form, dashboardVariables: { ...form.dashboardVariables, brewC: 93, dose: 19 } }),
    { dashboardVariables: { dose: 19 } }, 'dashboardVariables is diffed key by key');
  assert.deepEqual(api.recipeChanges({}, { name: 'N', beanBatchId: null, dashboardVariables: { dose: 18, rpm: null } }),
    { name: 'N', dashboardVariables: { dose: 18 } }, 'a null on a slot with no record is not a change');

  // while the editor was open, dial-in recorded dose 20 and moved the grind; the barista only
  // renamed the recipe. Neither recorded value is reverted, the other recipe survives.
  stored = [{ ...loaded, dashboardVariables: { ...loaded.dashboardVariables, dose: 20, grind: 4.5 } }, { id: '2', name: 'Other' }];
  const saved = await api.updateRecipe('1', api.recipeChanges(loaded, { ...form, name: 'Renamed', dashboardVariables: { ...form.dashboardVariables, brewC: 93 } }));
  assert.equal(saved.name, 'Renamed');
  assert.equal(saved.title, 'Renamed', 'title recomputed from the merged record');
  assert.equal(saved.subtitle, 'Ethiopia', 'subtitle recomputed from the merged record');
  assert.equal(saved.workflow.context.targetDoseWeight, 20, 'embedded workflow built from the merged record');
  assert.deepEqual(saved.dashboardVariables, { dose: 20, drink: 36, brewC: 93, rpm: 600, grind: 4.5 });
  assert.equal(stored.length, 2);
  assert.equal(stored[1].name, 'Other');
  assert.equal((await api.getRecipe('2')).name, 'Other');
  assert.equal(await api.getRecipe('9'), null);

  // a cleared field really is written as null
  const cleared = await api.updateRecipe('1', { dashboardVariables: { rpm: null } });
  assert.equal(cleared.dashboardVariables.rpm, null);
  assert.equal(cleared.dashboardVariables.dose, 20);
  console.log('ok   recipe save writes only changed fields');
}
