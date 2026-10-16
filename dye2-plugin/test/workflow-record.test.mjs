/**
 * Dial-in recording (plugin runtime). Run: npm test
 * Imported directly like recent-favs.ts; see src/utils/workflow-record.ts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  armSelection, clearSelection, getSelection, setSelectionListener, restoreSelection,
  profileFingerprint, profileDrifted, itemPatch, recordWorkflow, scheduleWorkflowRecord,
  suppress, profileAtBrewC,
} from '../src/utils/workflow-record.ts';

const profile = (temp) => ({ title: 'P', tank_temperature: 0, steps: [{ name: 's', temperature: temp }] });
const wf = (over) => Object.assign({
  context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '4.2' },
  profile: profile(93),
  steamSettings: { duration: 30, flow: 1.5 },
  hotWaterData: { volume: 120, targetTemperature: 85 },
  rinseData: { duration: 5 },
}, over || {});

function fakeStore(initial) {
  const store = { ...initial };
  const writes = [];
  const fetchFn = async (url, init) => {
    const key = url.split('/').pop();
    if (init && init.method === 'POST') { store[key] = JSON.parse(init.body); writes.push(key); return { ok: true, status: 200, json: async () => null }; }
    return { ok: true, status: 200, json: async () => (key in store ? store[key] : null) };
  };
  return { store, writes, fetchFn };
}

const recipe = () => ({
  id: '1', dashboardVariables: { dose: 18, drink: 36, grind: 4.2, brewC: 93, steamMode: 'time', steamTimeS: 30, flushS: 5 },
  workflow: { context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '4.2' } },
});
const fav = () => ({ id: 'af1', snapshot: { dose: 18, drink: 36, grindSetting: 4.2, profileTitle: 'P' } });

// --- diff: only changed fields, only fields the item holds ------------------------
{
  assert.deepEqual(itemPatch('recipe', recipe(), wf()), {}, 'identical workflow patches nothing');
  const p = itemPatch('recipe', recipe(), wf({ context: { targetDoseWeight: 19, targetYield: 36, grinderSetting: '4.2' } }));
  assert.deepEqual(p, { dose: 19 });
  const t = itemPatch('recipe', recipe(), wf({ steamSettings: { duration: 40, flow: 1.5 } }));
  assert.deepEqual(t, { steamTimeS: 40 }, 'steam time recorded, mode never written');
  const g = itemPatch('recipe', recipe(), wf({ context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '4.20' } }));
  assert.deepEqual(g, {}, 'numeric compare: 4.20 == 4.2');
  // brewC: apply never pushes it, so a profile that merely differs from the stored value is not an edit
  assert.deepEqual(itemPatch('recipe', recipe(), wf({ profile: profile(95) }), 95), {}, 'live == armed baseline: no brewC');
  assert.deepEqual(itemPatch('recipe', recipe(), wf({ profile: profile(95) }), null), {}, 'unknown baseline: no brewC');
  assert.deepEqual(itemPatch('recipe', recipe(), wf({ profile: profile(96) }), 95), { brewC: 96 }, 'moved after arming: recorded');

  // both modes' values stored: only the active mode's field is the user's
  const both = recipe();
  Object.assign(both.dashboardVariables, { steamFlowMls: 2, hotWaterMode: 'vol', hotWaterMl: 120, hotWaterTempC: 80 });
  const bp = itemPatch('recipe', both, wf({ steamSettings: { duration: 30, flow: 1.5 }, hotWaterData: { volume: 120, targetTemperature: 85 } }));
  assert.deepEqual(bp, {}, 'inactive-mode values are not recorded and the mode does not flip');
}

// --- rpm and basket (context.extras) -----------------------------------------------------
{
  const ex = (e) => wf({ context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '4.2', extras: e } });
  const withExtras = () => {
    const r = recipe();
    Object.assign(r.dashboardVariables, { rpm: 600, basketId: 'bk1', basketName: 'VST 18g' });
    return r;
  };
  assert.deepEqual(itemPatch('recipe', withExtras(), ex({ rpm: 600, basketId: 'bk1', basketName: 'VST 18g' })), {}, 'unchanged extras patch nothing');
  assert.deepEqual(itemPatch('recipe', withExtras(), ex({ rpm: 700, basketId: 'bk1', basketName: 'VST 18g' })), { rpm: 700 });
  assert.deepEqual(
    itemPatch('recipe', withExtras(), ex({ rpm: 600, basketId: 'bk2', basketName: 'VST 18g' })),
    { basketId: 'bk2', basketName: 'VST 18g' }, 'id moved: name written too'
  );
  assert.deepEqual(
    itemPatch('recipe', withExtras(), ex({ rpm: 600, basketId: 'bk1', basketName: 'IMS 20g' })),
    { basketId: 'bk1', basketName: 'IMS 20g' }, 'name moved: id written too'
  );
  assert.deepEqual(itemPatch('recipe', recipe(), ex({ rpm: 700, basketId: 'bk2', basketName: 'X' })), {}, 'item holding none of them is left alone');
  assert.deepEqual(itemPatch('recipe', withExtras(), wf()), {}, 'workflow without extras patches nothing');
  // string names compare exactly, not numerically
  assert.deepEqual(
    itemPatch('recipe', { id: '1', dashboardVariables: { basketId: 'a', basketName: '' } }, ex({ basketId: 'a', basketName: '0' })),
    { basketId: 'a', basketName: '0' }, "'' vs '0' is a change"
  );

  const f = fav();
  f.snapshot.rpm = 600;
  assert.deepEqual(itemPatch('favourite', f, ex({ rpm: 650 })), { rpm: 650 }, 'favourite records rpm');
  assert.deepEqual(itemPatch('favourite', fav(), ex({ rpm: 650 })), {}, 'favourite not holding rpm is left alone');

  // the embedded ready-to-PUT context follows
  const s = fakeStore({ recipes: [{ ...withExtras(), workflow: { context: { extras: { note: 'n' } } } }] });
  await recordWorkflow(ex({ rpm: 700, basketId: 'bk2', basketName: 'IMS' }), s.fetchFn, { kind: 'recipe', id: '1', profileFingerprint: null });
  assert.deepEqual(s.store.recipes[0].workflow.context.extras, { note: 'n', rpm: 700, basketId: 'bk2', basketName: 'IMS' });
}

// --- recipe editor: a blank stepper saves as absent, not 0 ------------------------------
{
  // getCurrentRecipeData lives in a browser-side template string (no type check), so run it
  // from source against a stub DOM.
  const src = readFileSync(new URL('../src/pages/recipe-edit.ts', import.meta.url), 'utf8');
  const start = src.indexOf('function getCurrentRecipeData()');
  const body = src.slice(start, src.indexOf('\n}\n', start) + 2);
  const run = (texts, batch = null, roaster = null) => new Function('document', 'selectedBeanId', 'selectedBeanName', 'selectedBeanBatchId', 'selectedBeanRoaster', 'selectedProfileId', 'selectedProfileTitle',
    'selectedProfileSnapshot', 'showOnStreamline', 'grinders', 'selectedGrinderId', 'baskets', 'selectedBasketId',
    'equipmentSelIds', 'equipmentSelNames', 'equipmentCustomOverrides', body + '; return getCurrentRecipeData();')(
    { getElementById: (id) => ({ textContent: texts[id], dataset: id === 're-drink-value' ? { ratio: '2' } : {}, value: '' }),
      querySelector: () => null },
    null, null, batch, roaster, null, null, null, false, [], null, [], null, [], [], {});
  const blank = run({ 're-dose-value': '—', 're-drink-value': '—', 're-brew-c-value': '—', 're-steam-value': '—',
    're-flush-value': '—', 're-hotwater-value': '—', 're-grind-value': '—', 're-rpm-value': '—' }).dashboardVariables;
  for (const k of ['dose', 'drink', 'brewC', 'flushS', 'grind', 'rpm']) assert.equal(blank[k], null, k + ' blank is null, not 0');
  assert.equal(blank.ratio, undefined);
  const filled = run({ 're-dose-value': '18g', 're-drink-value': '36g', 're-brew-c-value': '0°c', 're-grind-value': '4.2' }).dashboardVariables;
  assert.equal(filled.dose, 18);
  assert.equal(filled.brewC, 0, 'a real 0 is kept, not replaced by 93');
  assert.equal(filled.ratio, 2, 'ratio still derived');
  // the batch and roaster picked with the bean ride along on the saved record (dye2#27)
  const picked = run({}, 'b-9', 'Onyx');
  assert.equal(picked.beanBatchId, 'b-9');
  assert.equal(picked.beanRoaster, 'Onyx');
  assert.equal(run({}).beanBatchId, null, 'no batch picked saves null');
  // a null field is skipped by record, as a missing one is
  const r = recipe();
  r.dashboardVariables.rpm = null;
  assert.deepEqual(itemPatch('recipe', r, wf({ context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '4.2', extras: { rpm: 700 } } })), {}, 'null rpm is not held');
}

// --- a favourite gets dose/drink/grindSetting only ---------------------------------
{
  const changed = wf({
    context: { targetDoseWeight: 19, targetYield: 38, grinderSetting: '5' },
    profile: profile(99), steamSettings: { duration: 1, flow: 1 }, hotWaterData: { volume: 1, targetTemperature: 1 }, rinseData: { duration: 1 },
  });
  const p = itemPatch('favourite', fav(), changed);
  assert.deepEqual(p, { dose: 19, drink: 38, grindSetting: 5 });
  for (const k of ['brewC', 'steamTimeS', 'steamFlowMls', 'hotWaterMl', 'hotWaterTempC', 'flushS', 'steamMode']) assert.ok(!(k in p), k);
}

// --- drift ------------------------------------------------------------------------
{
  assert.equal(profileFingerprint(profile(90)), profileFingerprint(profile(99)), 'temperature is not part of identity');
  assert.equal(
    profileFingerprint({ ...profile(93), target_weight: 36, target_volume: 0 }),
    profileFingerprint({ ...profile(93), target_weight: 40, target_volume: 50 }),
    'yield (target_weight/target_volume) is not part of identity'
  );
  const sel = { kind: 'recipe', id: '1', profileFingerprint: profileFingerprint(profile(93)) };
  assert.equal(profileDrifted(sel, wf()), false);
  assert.equal(profileDrifted(sel, wf({ profile: { ...profile(93), title: 'Other' } })), true);

  armSelection({ kind: 'recipe', id: '1' }, wf(), 0);
  assert.ok(getSelection());
  scheduleWorkflowRecord(wf({ profile: { ...profile(93), title: 'Other' } }), async () => { throw new Error('no'); }, null, null, 10_000, 0);
  assert.equal(getSelection(), null, 'drifted workflow clears the armed item');
}

// --- bean / grinder switch disarms ---------------------------------------------------
{
  const withCtx = (extra) => wf({ context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '4.2', ...extra } });
  const never = async () => { throw new Error('no'); };
  const run = (w) => scheduleWorkflowRecord(w, never, null, null, 10_000, 0);

  armSelection({ kind: 'recipe', id: '1' }, withCtx({ beanBatchId: 'b1', grinderId: 'g1' }), 0);
  assert.equal(getSelection().armedBeanBatchId, 'b1');
  assert.equal(getSelection().armedGrinderId, 'g1');
  run(withCtx({ beanBatchId: 'b2', grinderId: 'g1' }));
  assert.equal(getSelection(), null, 'a different bean batch disarms');

  armSelection({ kind: 'recipe', id: '1' }, withCtx({ beanBatchId: 'b1', grinderId: 'g1' }), 0);
  run(withCtx({ beanBatchId: 'b1', grinderId: 'g2' }));
  assert.equal(getSelection(), null, 'a different grinder disarms');

  // unset is consistent: null / undefined / '' are all "none", so none of them disarms
  armSelection({ kind: 'recipe', id: '1' }, withCtx({ beanBatchId: null }), 0);
  run(withCtx({ beanBatchId: '', grinderId: undefined }));
  assert.ok(getSelection(), 'unset -> unset keeps the selection');
  run(withCtx({ beanBatchId: 'b1' }));
  assert.ok(getSelection(), 'unset -> a batch is specifying, not switching: stays armed');
  run(withCtx({ beanBatchId: 'b2' }));
  assert.equal(getSelection(), null, 'and then a different batch disarms');

  // armed without a workflow: unknown, adopted from the first event rather than disarming
  armSelection({ kind: 'recipe', id: '1' });
  run(withCtx({ beanBatchId: 'b1', grinderId: 'g1' }));
  assert.equal(getSelection().armedBeanBatchId, 'b1', 'unknown baseline adopted');
  run(withCtx({ beanBatchId: 'b3', grinderId: 'g1' }));
  assert.equal(getSelection(), null);

  // round-trips through persistence
  armSelection({ kind: 'recipe', id: '1' }, withCtx({ beanBatchId: 'b1', grinderId: 'g1' }), 0);
  const saved = JSON.parse(JSON.stringify(getSelection()));
  clearSelection();
  restoreSelection(saved);
  assert.equal(getSelection().armedBeanBatchId, 'b1');
  assert.equal(getSelection().armedGrinderId, 'g1');
  clearSelection();
}

// --- a recorded brew temp moves the stored apply-body's profile (dye2#26) ---------
{
  const steps = [{ temperature: 94 }, { temperature: 90 }, { temperature: 88 }];
  assert.deepEqual(profileAtBrewC({ title: 'P', steps }, 92).steps.map((x) => x.temperature), [92, 88, 86]);
  assert.deepEqual(steps.map((x) => x.temperature), [94, 90, 88], 'source profile not mutated');
  assert.equal(profileAtBrewC({ title: 'P' }, 92), null, 'nothing to shift without steps');
  assert.equal(profileAtBrewC({ steps }, null), null, 'nothing to shift without a temperature');

  // Streamline's strip PUTs item.workflow, so dashboardVariables.brewC and that body's
  // profile must not disagree.
  clearSelection();
  const item = { ...recipe(), workflow: { context: {}, profile: { title: 'P', steps: [{ temperature: 93 }, { temperature: 89 }] } } };
  const s = fakeStore({ recipes: [item] });
  const armed = { kind: 'recipe', id: '1', profileFingerprint: null, armedBrewC: 93, armedBeanBatchId: '', armedGrinderId: '' };
  const wrote = await recordWorkflow(wf({ profile: profile(95) }), s.fetchFn, armed);
  assert.equal(wrote, true);
  assert.equal(s.store.recipes[0].dashboardVariables.brewC, 95);
  assert.deepEqual(s.store.recipes[0].workflow.profile.steps.map((x) => x.temperature), [95, 91],
    'the embedded profile follows the recorded brew temp');
  console.log('ok   a recorded brew temp moves the embedded profile too');
}

// --- echo guard -------------------------------------------------------------------
{
  clearSelection();
  const s = fakeStore({ recipes: [recipe()] });
  const applied = wf({ context: { targetDoseWeight: 20, targetYield: 40, grinderSetting: '4.2' } });
  armSelection({ kind: 'recipe', id: '1' }, applied, 1000); // arm records the apply as an echo

  scheduleWorkflowRecord(applied, s.fetchFn, null, null, 2000, 0); // within 3 s, same values
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(s.writes.length, 0, 'own apply is not recorded back');

  scheduleWorkflowRecord(applied, s.fetchFn, null, null, 5000, 0); // window over
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(s.writes.length, 1, 'recorded once the window has passed');
  assert.equal(s.store.recipes[0].dashboardVariables.dose, 20);
  assert.equal(s.store.recipes[0].workflow.context.targetDoseWeight, 20, 'embedded workflow kept in step');

  // different values inside the window are a real edit, not an echo
  armSelection({ kind: 'recipe', id: '1' }, applied, 10_000);
  scheduleWorkflowRecord(wf({ context: { targetDoseWeight: 21, targetYield: 40, grinderSetting: '4.2' } }), s.fetchFn, null, null, 10_500, 0);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(s.store.recipes[0].dashboardVariables.dose, 21);
}

// --- recent: ids do not arm; listener fires ------------------------------------------
{
  let seen = 'unset';
  setSelectionListener((v) => { seen = v; });
  armSelection({ kind: 'favourite', id: 'af1' }, wf());
  assert.equal(seen.id, 'af1');
  assert.equal(armSelection({ kind: 'favourite', id: 'recent:abc' }, wf()), null);
  assert.equal(getSelection(), null);
  assert.equal(seen, null, 'arming a recent clears the selection');
  // the listener (which plugin.ts uses to push `changed`) fires on every clear path, not just arm
  armSelection({ kind: 'favourite', id: 'af1' }, wf());
  seen = 'unset';
  clearSelection();
  assert.equal(seen, null, 'explicit clear notifies');
  armSelection({ kind: 'favourite', id: 'af1' }, wf(), 0);
  seen = 'unset';
  scheduleWorkflowRecord(wf({ profile: { ...profile(93), title: 'Other' } }), async () => {}, null, null, 10_000, 0);
  assert.equal(seen, null, 'profile-drift clear notifies');
  let calls = 0;
  setSelectionListener(() => { calls++; });
  armSelection({ kind: 'favourite', id: 'af1' }, wf());
  assert.equal(calls, 1, 'arm notifies exactly once');
  restoreSelection({ kind: 'favourite', id: 'af1' });
  assert.equal(calls, 1, 'restore does not notify');
  assert.equal(armSelection({}, wf()), null);
  setSelectionListener(null);
}

// --- missing item / other items untouched ------------------------------------------------
{
  const s = fakeStore({ recipes: [recipe()] });
  const ok = await recordWorkflow(wf({ context: { targetDoseWeight: 25 } }), s.fetchFn, { kind: 'recipe', id: 'gone', profileFingerprint: null });
  assert.equal(ok, false);
  assert.equal(s.writes.length, 0, 'missing id is a no-op');

  const other = { ...recipe(), id: '2' };
  const s2 = fakeStore({ recipes: [recipe(), other] });
  await recordWorkflow(wf({ context: { targetDoseWeight: 25, targetYield: 36, grinderSetting: '4.2' } }), s2.fetchFn, { kind: 'recipe', id: '1', profileFingerprint: null });
  assert.equal(s2.store.recipes[0].dashboardVariables.dose, 25);
  assert.deepEqual(s2.store.recipes[1], other, 'other items are not touched');
}

// --- a cleared selection persists as `{}`, which must restore as no selection ----------
{
  // plugin.ts writes `getSelection() || {}` (storage drops a null, so the old value would survive)
  armSelection({ kind: 'recipe', id: '1' }, wf());
  assert.ok(getSelection());
  restoreSelection({});
  assert.equal(getSelection(), null, '{} sentinel restores as no selection');
  restoreSelection(null);
  assert.equal(getSelection(), null);
}

console.log('workflow-record tests passed');
