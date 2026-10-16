/**
 * Dial-in recording (plugin runtime). Run: npm test
 * Imported directly like recent-favs.ts; see src/utils/workflow-record.ts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  armSelection, clearSelection, getSelection, setSelectionListener, restoreSelection,
  profileFingerprint, profileDrifted, itemPatch, recordWorkflow, scheduleWorkflowRecord,
  suppress, profileAtBrewC, syncSelectionMarker, withMachineSettings, readMachineSettings,
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

  // Apply writes every setting a recipe holds (dye2#23), so a change to the field the mode does
  // NOT show is as much the user's as the one it shows; the mode itself is never written.
  const both = recipe();
  Object.assign(both.dashboardVariables, { steamFlowMls: 2, hotWaterMode: 'vol', hotWaterMl: 120, hotWaterTempC: 80,
    steamTempC: 150, steamStopAtTempC: 0, hotWaterTimeS: 30, hotWaterFlowMls: 6, flushTempC: 90, flushFlowMls: 4 });
  const live = (over) => wf({
    steamSettings: { targetTemperature: 150, duration: 30, flow: 2, stopAtTemperature: 0, ...(over && over.steam) },
    hotWaterData: { targetTemperature: 80, duration: 30, volume: 120, flow: 6, ...(over && over.hw) },
    rinseData: { targetTemperature: 90, duration: 5, flow: 4, ...(over && over.rinse) },
  });
  assert.deepEqual(itemPatch('recipe', both, live()), {}, 'live == held: nothing to record, mode does not flip');
  assert.deepEqual(itemPatch('recipe', both, live({ steam: { flow: 1.2 }, hw: { targetTemperature: 85 } })),
    { steamFlowMls: 1.2, hotWaterTempC: 85 }, 'the field the mode does not show is recorded too');
  assert.deepEqual(itemPatch('recipe', both, live({ steam: { targetTemperature: 140, stopAtTemperature: 60 }, hw: { duration: 20, flow: 8 }, rinse: { targetTemperature: 80, flow: 5 } })),
    { steamTempC: 140, steamStopAtTempC: 60, hotWaterTimeS: 20, hotWaterFlowMls: 8, flushTempC: 80, flushFlowMls: 5 }, 'every added setting is recorded');
  // a setting the recipe does not hold is still left alone
  assert.deepEqual(itemPatch('recipe', recipe(), live({ steam: { targetTemperature: 99 }, hw: { volume: 1 } })), {}, 'not held, not recorded');
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
  // machineValues (the Machine Settings steppers) is stubbed to what the recipe holds; the real
  // one is run against its own stub DOM further down.
  const run = (texts, batch = null, roaster = null, held = null, modes = {}) => new Function('document', 'recipes', 'currentRecipeIdx', 'selectedBeanId', 'selectedBeanName', 'selectedBeanBatchId', 'selectedBeanRoaster', 'selectedProfileId', 'selectedProfileTitle',
    'selectedProfileSnapshot', 'showOnStreamline', 'grinders', 'selectedGrinderId', 'baskets', 'selectedBasketId',
    'equipmentSelIds', 'equipmentSelNames', 'equipmentCustomOverrides', 'machineValues', body + '; return getCurrentRecipeData();')(
    { getElementById: (id) => ({ textContent: texts[id], dataset: id === 're-drink-value' ? { ratio: '2' } : {}, value: '' }),
      querySelector: (sel) => { const m = Object.keys(modes).find((c) => sel.startsWith('.' + c)); return m ? { dataset: { mode: modes[m] } } : null; } },
    held ? [{ dashboardVariables: held }] : [], 0,
    null, null, batch, roaster, null, null, null, false, [], null, [], null, [], [], {},
    (h) => ({ steamTempC: h.steamTempC ?? null }));
  const blank = run({ 're-dose-value': '—', 're-drink-value': '—', 're-brew-c-value': '—', 're-steam-value': '—',
    're-flush-value': '—', 're-hotwater-value': '—', 're-grind-value': '—', 're-rpm-value': '—' }).dashboardVariables;
  for (const k of ['dose', 'drink', 'brewC', 'flushS', 'grind', 'rpm']) assert.equal(blank[k], null, k + ' blank is null, not 0');
  assert.equal(blank.ratio, undefined);
  const filled = run({ 're-dose-value': '18g', 're-drink-value': '36g', 're-brew-c-value': '0°c', 're-grind-value': '4.2' }).dashboardVariables;
  assert.equal(filled.dose, 18);
  assert.equal(filled.brewC, 0, 'a real 0 is kept, not replaced by 93');
  assert.equal(filled.ratio, 2, 'ratio still derived');
  // the mode only picks which value shows: saving keeps the other one the recipe holds (dye2#23)
  const kept = run({ 're-steam-value': '1.2ml/s', 're-hotwater-value': '85°C' },
    null, null, { steamTimeS: 30, steamFlowMls: 2, hotWaterMl: 120, hotWaterTempC: 80, steamTempC: 150 },
    { 're-steam-mode': 'flow', 're-hotwater-mode': 'temp' }).dashboardVariables;
  assert.equal(kept.steamFlowMls, 1.2, 'the shown value is the edited one');
  assert.equal(kept.steamTimeS, 30, 'the hidden steam value survives the save');
  assert.equal(kept.hotWaterTempC, 85);
  assert.equal(kept.hotWaterMl, 120, 'the hidden hot-water value survives the save');
  assert.equal(kept.steamTempC, 150, 'the Machine Settings fields ride along too');
  assert.equal(run({}, null, null, null, { 're-steam-mode': 'flow' }).dashboardVariables.steamTimeS, undefined, 'nothing held, nothing invented');
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

// --- recipe editor: a mode switch shows that mode's own value (dye2#23) ---------------
{
  // Both values of a pair now persist, so relabelling one number into the other's unit would
  // save 30s as 30 ml/s. Browser-side template string again: run the real source.
  const src = readFileSync(new URL('../src/pages/recipe-edit.ts', import.meta.url), 'utf8');
  const fn = (sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
  const cfgStart = src.indexOf('const MODE_CFG = {');
  const code = [
    src.slice(cfgStart, src.indexOf('\n};\n', cfgStart) + 4),
    fn('function activeMode(cls)'),
    fn('function applyMode(cls)'),
    fn('function stashModeValue(cls)'),
  ].join('\n');

  let active = 'time';
  const el = { textContent: '30s' };
  const doc = {
    getElementById: (id) => (id === 're-steam-value' ? el : null),
    querySelector: () => ({ dataset: { mode: active } }),
  };
  const slot = { dashboardVariables: { steamTimeS: 30, steamFlowMls: 1.2 } };
  // renderHeld (the read-only 'Also held' list) is a no-op here: a stub in case the slices above
  // stop carrying its declaration, and the real one finds no #re-held in this stub document.
  const api = new Function('document', 'recipes', 'currentRecipeIdx', 'syncPresetActive', 'wirePresetButtons', 'renderHeld',
    code + '; return { stashModeValue, applyMode };')(doc, [slot], 0, () => {}, () => {}, () => {});

  api.stashModeValue('re-steam-mode');          // what is on screen belongs to `time`
  active = 'flow';
  api.applyMode('re-steam-mode');
  assert.equal(el.textContent, '1.2ml/s', "the flow mode shows the recipe's flow, not 30 relabelled");
  assert.equal(slot.dashboardVariables.steamTimeS, 30, 'the time value is parked, not lost');

  el.textContent = '1.5ml/s';                   // edit in flow, then switch back
  api.stashModeValue('re-steam-mode');
  active = 'time';
  api.applyMode('re-steam-mode');
  assert.equal(el.textContent, '30s');
  assert.equal(slot.dashboardVariables.steamFlowMls, 1.5, 'the unsaved flow edit survives the switch');

  delete slot.dashboardVariables.steamFlowMls;  // a mode the recipe holds nothing for is blank
  active = 'flow';
  api.applyMode('re-steam-mode');
  assert.equal(el.textContent, '—');
  console.log('ok   a mode switch shows that mode\'s own value');
}

// --- recipe editor: the Machine Settings section (dye2#23) -------------------------
{
  // Six settings a recipe can hold that had no control: steppers like every other field, behind
  // a disclosure, with a summary of what is held while it is shut. Real source again.
  const src = readFileSync(new URL('../src/pages/recipe-edit.ts', import.meta.url), 'utf8');
  const table = src.slice(src.indexOf('const MACHINE_FIELDS = ['), src.indexOf('let machineOpen'));
  const fn = (sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf('\n}\n', i) + 2); };

  const el = () => ({ className: '', textContent: '', kids: [], appendChild(n) { this.kids.push(n); }, style: {}, dataset: {} });
  const box = el(), list = el(), count = el();
  let steam = 'flow', hw = 'vol';
  const doc = {
    getElementById: (id) => (id === 're-held-list' ? list : id === 're-machine-count' ? count : id === 're-machine-toggle' ? box : null),
    createElement: el,
    createTextNode: (t) => ({ text: t }),
  };
  const text = () => list.kids.map((r) => r.kids.map((k) => k.textContent ?? k.text).join('')).sort();
  const render = (dv, open = false) => {
    list.kids = [];
    new Function('document', 'recipes', 'currentRecipeIdx', 'activeMode', 'machineOpen',
      table + fn('function renderHeld()') + '; renderHeld();')(
      doc, [{ dashboardVariables: dv }], 0, (cls) => (cls === 're-steam-mode' ? steam : hw), open);
  };

  render({ dose: 18, steamFlowMls: 1.5, hotWaterMl: 120 });
  assert.deepEqual(text(), [], 'nothing held but what the steppers already show');
  assert.equal(count.textContent, '', 'and no count beside the header');

  render({ steamTempC: 150, flushFlowMls: 4, steamTimeS: 30, hotWaterTempC: 85, dose: 18 });
  assert.deepEqual(text(), ['Flush flow 4ml/s', 'Hot water temp 85°c', 'Steam temp 150°c', 'Steam time 30s'],
    "shut: every machine setting held, plus the half of each pair the mode hides");
  assert.equal(count.textContent, '2 held', 'the count is the machine settings, not the pair halves');

  render({ steamTempC: 150, flushFlowMls: 4, steamTimeS: 30, hotWaterTempC: 85 }, true);
  assert.deepEqual(text(), ['Hot water temp 85°c', 'Steam time 30s'],
    'open: the steppers show the machine settings, so only the pair halves are summarised');

  render({ steamTempC: 0, steamStopAtTempC: 0 });
  assert.deepEqual(text(), ['Milk stop Off', 'Steam temp Off'], 'a stored 0 reads as Off, not 0°c');

  // Reading the steppers back. The wipe to avoid: a value the section does not render must keep
  // what the recipe holds, since recipeChanges writes a null as a cleared field.
  const shown = {};
  const vals = new Function('document', 'num',
    table + fn('function machineValues(held)') + '; return machineValues;')(
    { getElementById: (id) => (id in shown ? { textContent: shown[id] } : null) },
    (id) => { const n = parseFloat(shown[id]); return isNaN(n) ? null : n; });

  shown['re-steam-temp-value'] = 'Off';
  shown['re-milk-stop-value'] = '60°c';
  shown['re-hw-time-value'] = '—';
  assert.deepEqual(vals({ hotWaterFlowMls: 6, flushTempC: 90, flushFlowMls: 4 }), {
    steamTempC: 0, steamStopAtTempC: 60, hotWaterTimeS: null,
    hotWaterFlowMls: 6, flushTempC: 90, flushFlowMls: 4,
  }, 'Off is 0, a blank stepper is null, an absent stepper keeps the held value');

  // Stepping. Off sits one step below the range: minus walks down to it, plus comes back at the
  // minimum rather than at a number the DE1 would reject.
  const handlers = {};
  const value = { textContent: '—', dataset: {}, style: {} };
  const stepDoc = {
    getElementById: (id) => (id === 're-steam-temp-value' ? value
      : id === 're-steam-temp-plus' || id === 're-steam-temp-minus'
        ? { addEventListener: (_, h) => { handlers[id] = h; } } : null),
  };
  new Function('document', 'syncPresetActive', 'makeValueEditable', 'machineFmt',
    fn('function wireOffAdjuster(prefix, step, min, max, unit)') + "; wireOffAdjuster('re-steam-temp', 5, 135, 170, '°c');")(
    stepDoc, () => {}, () => {}, (unit, off) => (v) => (off && !(v > 0) ? 'Off' : v + unit));
  const plus = () => handlers['re-steam-temp-plus']();
  const minus = () => handlers['re-steam-temp-minus']();

  plus();
  assert.equal(value.textContent, '135°c', 'plus on a blank field arms it at the minimum');
  plus();
  assert.equal(value.textContent, '140°c');
  minus();
  assert.equal(value.textContent, '135°c');
  minus();
  assert.equal(value.textContent, 'Off', 'a step below the minimum switches it off');
  minus();
  assert.equal(value.textContent, 'Off', 'and Off is the bottom');
  plus();
  assert.equal(value.textContent, '135°c', 'plus comes back at the minimum');
  value.textContent = '170°c';
  plus();
  assert.equal(value.textContent, '170°c', 'the maximum holds');
  console.log('ok   the Machine Settings section: steppers, Off, and the held summary');
}

// --- flush temperature and flow: on the DE1, not the workflow (dye2#23) -------------
{
  const de1 = { flushTemp: 88, flushFlow: 4, steamFlow: 1.5 };
  const merged = withMachineSettings(wf(), de1);
  assert.deepEqual(merged.rinseData, { duration: 5, targetTemperature: 88, flow: 4 }, 'overlaid onto rinseData');
  assert.deepEqual(wf().rinseData, { duration: 5 }, 'the source workflow is not touched');
  assert.equal(merged.steamSettings.flow, 1.5, "steamFlow is the workflow's own: not overlaid from the DE1");
  assert.deepEqual(withMachineSettings(wf(), null).rinseData, { duration: 5 }, 'no settings body: unchanged');
  assert.deepEqual(withMachineSettings(wf(), {}).rinseData, { duration: 5 }, 'empty body: unchanged');

  const fail = async () => ({ ok: false, status: 500, json: async () => null });
  assert.equal(await readMachineSettings(fail, 'x'), null, 'a failed read is null, not a throw');
  assert.equal(await readMachineSettings(async () => { throw new Error('offline'); }, 'x'), null);

  // A machine-settings fetch only when the pair could be written.
  const calls = [];
  const store = (initial) => {
    const data = { ...initial };
    return {
      data, calls,
      fetchFn: async (url, init) => {
        calls.push((init && init.method) || 'GET');
        if (url.endsWith('/machine/settings')) return { ok: true, status: 200, json: async () => de1 };
        const key = url.split('/').pop();
        if (init && init.method === 'POST') { data[key] = JSON.parse(init.body); return { ok: true, status: 200, json: async () => null }; }
        return { ok: true, status: 200, json: async () => (key in data ? data[key] : null) };
      },
    };
  };
  const armed = (over) => ({
    kind: 'recipe', id: '1', profileFingerprint: null, armedBrewC: null,
    armedBeanBatchId: '', armedGrinderId: '', armedMachine: null, ...over,
  });

  // held, and the machine disagrees
  const held = recipe();
  held.dashboardVariables.flushTempC = 90;
  let s1 = store({ recipes: [held] });
  assert.equal(await recordWorkflow(wf(), s1.fetchFn, armed()), true);
  assert.equal(s1.data.recipes[0].dashboardVariables.flushTempC, 88, 'recorded from the DE1');

  // not held, but moved off the arm-time baseline
  let s2 = store({ recipes: [recipe()] });
  assert.equal(await recordWorkflow(wf(), s2.fetchFn, armed({ armedMachine: { flushTempC: 90, flushFlowMls: 4 } })), true);
  assert.equal(s2.data.recipes[0].dashboardVariables.flushTempC, 88, 'adopted; flow was already 4, so it stays out');
  assert.equal(s2.data.recipes[0].dashboardVariables.flushFlowMls, undefined);

  // neither: no extra round trip
  calls.length = 0;
  let s3 = store({ recipes: [recipe()] });
  await recordWorkflow(wf({ context: { targetDoseWeight: 19, targetYield: 36, grinderSetting: '4.2' } }), s3.fetchFn, armed());
  assert.equal(s3.data.recipes[0].dashboardVariables.dose, 19, 'the ordinary record still happens');
  assert.deepEqual(calls, ['GET', 'POST'], 'read the array, wrote it back: no machine-settings call');
}

// --- the echo guard still matches across the overlay --------------------------------
{
  // The apply reads the DE1 pair; the host's event payload is the workflow alone. Comparing it
  // would never match, and every apply would record itself straight back.
  clearSelection();
  const s = fakeStore({ recipes: [recipe()] });
  const applied = withMachineSettings(wf(), { flushTemp: 88, flushFlow: 4 });
  armSelection({ kind: 'recipe', id: '1' }, applied, 1000);
  scheduleWorkflowRecord(wf(), s.fetchFn, undefined, undefined, 1200, 0);
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(s.writes, [], "the apply's own event is still an echo");
  clearSelection();
  console.log('ok   flush temperature and flow are read from the DE1');
}
