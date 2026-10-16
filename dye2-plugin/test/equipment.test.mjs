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
  '\nreturn { getEquipment, createEquipment, buildRecipeWorkflow, getRecipe, updateRecipe, recipeChanges, profileAtBrewTemp, buildFavouriteWorkflow, markDye, updateWorkflow, recipeMachineSettings, recipeChanges };')(fakeFetch);

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
  // Naming a bean with no batch CLEARS the batch: PUT deep-merges, so leaving it out would
  // keep the previous bean's roast under this coffee's name.
  const bare = (await api.buildRecipeWorkflow({ beanName: 'Ethiopia' })).context;
  assert.equal(bare.beanBatchId, null);
  assert.equal(bare.coffeeRoaster, null);
  const noBean = (await api.buildRecipeWorkflow({ dashboardVariables: { dose: 18 } })).context;
  assert.ok(!('beanBatchId' in noBean), 'a recipe naming no bean leaves the workflow alone');
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

// Brew temperature moves the whole curve, first step to N (dye2#26); ported from Streamline.
{
  const step = t => ({ name: 's', temperature: t });
  const prof = { title: 'P', steps: [step(94), step(90), step(88)] };
  const out = api.profileAtBrewTemp(prof, 92);
  assert.deepEqual(out.steps.map(s => s.temperature), [92, 88, 86], '94/90/88 at 92');
  assert.deepEqual(prof.steps.map(s => s.temperature), [94, 90, 88], 'the source profile is not mutated');
  assert.notEqual(out, prof);
  assert.deepEqual(api.profileAtBrewTemp({ steps: [step(93)] }, 91).steps.map(s => s.temperature), [91], 'single step');
  assert.deepEqual(api.profileAtBrewTemp({ steps: [step(94), step('x'), step(88)] }, 92).steps.map(s => s.temperature),
    [92, 92, 86], 'a non-numeric step takes the target');
  assert.deepEqual(api.profileAtBrewTemp({ steps: [step(undefined), step(90)] }, 92).steps.map(s => s.temperature),
    [92, 92], 'no usable first step: every step gets the target');
  const stub = { id: 'p', title: 'P' };
  assert.equal(api.profileAtBrewTemp(stub, 92), stub, 'a profile with no steps is left alone');
  // the embedded workflow shifts the profile it carries, from the recipe's snapshot copy
  const snap = { title: 'Snap', steps: [step(94), step(90)] };
  const body = await api.buildRecipeWorkflow({ profileId: 'x', profileSnapshot: snap, dashboardVariables: { brewC: 92 } });
  assert.deepEqual(body.profile.steps.map(s => s.temperature), [92, 88]);
  assert.deepEqual(snap.steps.map(s => s.temperature), [94, 90], 'snapshot untouched');
  assert.deepEqual((await api.buildRecipeWorkflow({ profileId: 'x', profileSnapshot: snap, dashboardVariables: { brewC: null } })).profile.steps.map(s => s.temperature), [94, 90], 'null brewC skips');
  assert.equal((await api.buildRecipeWorkflow({ dashboardVariables: { brewC: 92 } })).profile, undefined, 'no profile named, none embedded');
  console.log('ok   brew temperature shifts the profile');
}

// Streamline clears after a shot only what context.extras.dye flags (dye2#25): every write
// flags exactly the fields it set, and a field DYE2 nulls has its flag nulled.
{
  const r = (await api.buildRecipeWorkflow({
    beanName: 'Ethiopia', beanRoaster: 'Onyx', barista: 'Mo',
    dashboardVariables: { dose: 18, rpm: 900, grinderId: 'g1', grinderModel: 'Niche', basketId: 'b1', basketName: 'VST' },
  })).context;
  assert.deepEqual(r.extras.dye, {
    v: 1, coffeeName: true, coffeeRoaster: true, beanBatchId: null, grinderId: true, grinderModel: true,
    baristaName: true, basketId: true, basketName: true, rpm: true,
  }, 'recipe flags what it set; the absent batch it clears is nulled');
  assert.ok(!('drinkerName' in r.extras.dye) && !('note' in r.extras.dye), 'unset fields are not flagged');
  assert.equal(r.extras.rpm, 900, 'values survive the flagging');
  const none = (await api.buildRecipeWorkflow({ dashboardVariables: { dose: 18 } })).context;
  assert.ok(!('extras' in none), 'a write of no flaggable field carries no marker');

  const f = (await api.buildFavouriteWorkflow({ snapshot: { dose: 18, note: 'n', coffeeName: 'X', rpm: 800, grindSetting: 3 }, copyMask: { beans: false } })).context;
  assert.deepEqual(f.extras.dye, { v: 1, rpm: true, note: true }, 'copyMask-skipped fields are not flagged');

  // dashboard setters pass explicit keys: a ctx holding another plugin's values claims none of them
  const ctx = { coffeeName: 'Other plugin', grinderId: 'g2', extras: { dye: { v: 1, rpm: true, selection: { kind: 'recipe', id: '1' } } } };
  api.markDye(ctx, ['grinderId']);
  assert.deepEqual(ctx.extras.dye, { v: 1, rpm: true, selection: { kind: 'recipe', id: '1' }, grinderId: true }, 'merges into existing flags, claims only the named key');
  api.markDye(ctx, ['grinderId', 'note']);
  assert.ok(!('note' in ctx.extras.dye), 'an undefined (unwritten) key is skipped');
  ctx.grinderId = null;
  api.markDye(ctx, ['grinderId']);
  assert.equal(ctx.extras.dye.grinderId, null, 'a cleared field clears its flag');

  // a whole-workflow PUT never carries the plugin runtime's selection back
  let sent = null;
  const put = new Function('fetch', devApiScript + '\nreturn updateWorkflow;')(async (u, o) => { sent = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({}) }; });
  await put({ context: { extras: { rpm: 1, dye: { v: 1, rpm: true, selection: { kind: 'recipe', id: '1' } } } } });
  assert.deepEqual(sent.context.extras.dye, { v: 1, rpm: true }, 'selection is stripped from the outgoing PUT');
  console.log('ok   workflow writes flag extras.dye');
}

// A recipe holds every steam / hot-water / flush setting, each optional (dye2#23): apply writes all
// that are held, not just the active mode's, and only those.
{
  const dv = { steamMode: 'time', steamTimeS: 30, steamFlowMls: 1.2, steamTempC: 140, steamStopAtTempC: 0,
    hotWaterMode: 'vol', hotWaterMl: 120, hotWaterTempC: 85, hotWaterTimeS: 20, hotWaterFlowMls: 6,
    flushS: 5, flushTempC: 90, flushFlowMls: 4 };
  assert.deepEqual(api.recipeMachineSettings(dv), {
    steamSettings: { targetTemperature: 140, duration: 30, flow: 1.2, stopAtTemperature: 0 },
    hotWaterData: { targetTemperature: 85, duration: 20, volume: 120, flow: 6 },
    rinseData: { targetTemperature: 90, duration: 5, flow: 4 },
  }, 'every held setting, both of a mode pair, and a real 0');
  assert.deepEqual(api.recipeMachineSettings({ steamMode: 'time', steamTimeS: 30, hotWaterMl: null, flushS: undefined }),
    { steamSettings: { duration: 30 } }, 'null / absent are left alone; modes are not settings');
  assert.deepEqual(api.recipeMachineSettings({}), {});
  const body = await api.buildRecipeWorkflow({ dashboardVariables: dv });
  assert.deepEqual(body.steamSettings, { targetTemperature: 140, duration: 30, flow: 1.2, stopAtTemperature: 0 });
  assert.deepEqual(body.rinseData, { targetTemperature: 90, duration: 5, flow: 4 });
  const none = await api.buildRecipeWorkflow({ dashboardVariables: { dose: 18 } });
  assert.ok(!('steamSettings' in none) && !('hotWaterData' in none) && !('rinseData' in none), 'a recipe holding none sends none');
  // saving with only the shown value changed leaves the stored hidden value out of the patch
  assert.deepEqual(api.recipeChanges({ dashboardVariables: dv }, { dashboardVariables: { ...dv, steamFlowMls: 1.5 } }),
    { dashboardVariables: { steamFlowMls: 1.5 } });
  console.log('ok   recipes hold every steam / hot-water / flush setting');
}
