/**
 * Dial-in recording (plugin runtime). Run: npm test
 * Imported directly like recent-favs.ts; see src/utils/workflow-record.ts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  armSelection, clearSelection, getSelection, setSelectionListener,
  profileFingerprint, profileDrifted, itemPatch, recordWorkflow, trackWorkflow,
  suppress, profileAtBrewC, withMachineSettings, readMachineSettings,
  recipeIdOf, heldFields, recipeModified, recipeProfileChanged, favouriteMatches, deriveSelection,
  resolveRecipeFromHistory, proposeRecipeName, idProfileChanged,
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
  const run = (texts, batch = null, roaster = null, held = null, modes = {}) => new Function('document', 'recipe', 'stripSlot', 'selectedBeanId', 'selectedBeanName', 'selectedBeanBatchId', 'selectedBeanRoaster', 'selectedProfileId', 'selectedProfileTitle',
    'selectedProfileSnapshot', 'showOnStreamline', 'grinders', 'selectedGrinderId', 'baskets', 'selectedBasketId',
    'equipmentSelIds', 'equipmentSelNames', 'equipmentCustomOverrides', 'machineValues', body + '; return getCurrentRecipeData();')(
    { getElementById: (id) => ({ textContent: texts[id], dataset: id === 're-drink-value' ? { ratio: '2' } : {}, value: '' }),
      querySelector: (sel) => { const m = Object.keys(modes).find((c) => sel.startsWith('.' + c)); return m ? { dataset: { mode: modes[m] } } : null; } },
    held ? { dashboardVariables: held } : {}, 3,
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
  assert.equal(run({}).stripSlot, 3, 'the picked strip slot rides along for recipeChanges to diff');
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

  // A limiter of value 0 limits nothing, and Streamline nulls it before every PUT
  // (api.js updateWorkflow) — the two must hash alike (dye2#32, streamline-js#158).
  const lim = (l) => ({ title: 'P', tank_temperature: 0, steps: [{ name: 's', temperature: 93, limiter: l }] });
  assert.equal(profileFingerprint(lim({ value: 0, range: 0.6 })), profileFingerprint(lim(null)), 'a 0 limiter is no limiter');
  assert.notEqual(profileFingerprint(lim({ value: 2, range: 0.6 })), profileFingerprint(lim(null)), 'a real limiter still counts');
  assert.equal(profileDrifted({ kind: 'recipe', id: '1', profileFingerprint: profileFingerprint(lim({ value: 0, range: 0.6 })) },
    { profile: lim(null) }), false, 'Streamline nulling a 0 limiter does not disarm');

  armSelection({ kind: 'recipe', id: '1' }, wf(), 0);
  assert.ok(getSelection());
  trackWorkflow(wf({ profile: { ...profile(93), title: 'Other' } }), 10_000);
  assert.equal(getSelection(), null, 'drifted workflow clears the armed item');
}

// --- bean / grinder switch disarms ---------------------------------------------------
{
  const withCtx = (extra) => wf({ context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '4.2', ...extra } });
  const never = async () => { throw new Error('no'); };
  const run = (w) => trackWorkflow(w, 10_000);

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
  const api = new Function('document', 'recipe', 'syncPresetActive', 'wirePresetButtons', 'renderHeld',
    code + '; return { stashModeValue, applyMode };')(doc, slot, () => {}, () => {}, () => {});

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
  // a disclosure. Real source again.
  const src = readFileSync(new URL('../src/pages/recipe-edit.ts', import.meta.url), 'utf8');
  const table = src.slice(src.indexOf('const MACHINE_FIELDS = ['), src.indexOf('let machineOpen'));
  const fn = (sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf('\n}\n', i) + 2); };

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

// --- recipe editor: the variables pane never scrolls sideways -----------------------
{
  // #re-right is overflow-y-auto, so a row wider than the pane scrolls it sideways instead of
  // wrapping. The Machine Settings rows shipped with a 155px label column and did exactly that;
  // this is the arithmetic that caught it.
  const src = readFileSync(new URL('../src/pages/recipe-edit.ts', import.meta.url), 'utf8');
  const design = Number(/var DESIGN_W = (\d+)/.exec(
    readFileSync(new URL('../src/utils/dev-shell.ts', import.meta.url), 'utf8'))[1]);
  // Half the design width, less the pane's px-[38px] and the width a classic vertical scrollbar
  // takes in desktop preview (the tablet's WebView overlays its own, taking none).
  const pane = design / 2 - 38 * 2 - 16;
  const control = 72 + 15 + 72 + 15 + 72;      // minus, value, plus, and the 15px gaps between
  const calls = [...src.matchAll(/stepperHtml\('([a-z0-9-]+)', '[^']*', '(\d+)px'/g)]
    .map((m) => [m[1], Number(m[2])]);
  assert.equal(calls.length, 14, 'every stepper in the page is measured');
  for (const [prefix, label] of calls) {
    // Two blocks side by side, the 45px gaps either side of the 2px rule between them.
    const row = 2 * (label + 18 + control) + 45 * 2 + 2;
    assert.ok(row <= pane, prefix + ': a ' + label + 'px label column makes a ' + row + 'px row in a ' + pane + 'px pane');
  }
  // The Machine Settings rows have to hold a 7-character value (4.5ml/s, 0.5ml/s by stepping
  // the flows), which is why they sit 30px apart rather than 45px.
  const machineRows = [...src.matchAll(/class="re-machine-row flex gap-\[(\d+)px\]"/g)].map((m) => Number(m[1]));
  assert.equal(machineRows.length, 3, 'three rows behind the disclosure');
  const wideValue = 96;   // '4.5ml/s' at the 26px bold value size
  for (const gap of machineRows) {
    const row = 2 * (120 + 18 + 72 + 15 + wideValue + 15 + 72) + gap * 2 + 2;
    assert.ok(row <= pane, 'a machine row with a long value is ' + row + 'px in a ' + pane + 'px pane');
  }
  console.log('ok   no row is wider than the variables pane');
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
  const armedMachineAtArm = JSON.stringify(getSelection().armedMachine);
  // Nothing records automatically any more, so the guard's job is the baseline: the apply's
  // own event must not be adopted as "what the barista changed", or the DE1 pair the apply
  // read would look like a dial-in the next explicit save writes back.
  trackWorkflow(wf(), 1200);
  assert.equal(JSON.stringify(getSelection().armedMachine), armedMachineAtArm,
    "the apply's own event is still an echo: the arm-time baseline stands");
  assert.deepEqual(s.writes, [], 'and a workflow event writes nothing by itself');
  clearSelection();
  console.log('ok   flush temperature and flow are read from the DE1');
}

// --- steam switched off on the machine is not recorded (dye2#30) -------------------
{
  const r = recipe();
  Object.assign(r.dashboardVariables, { steamTempC: 150, steamTimeS: 30, steamFlowMls: 2, steamStopAtTempC: 0 });
  const live = (steam) => wf({ steamSettings: { targetTemperature: 150, duration: 30, flow: 2, stopAtTemperature: 0, ...steam } });
  assert.deepEqual(itemPatch('recipe', r, live({ targetTemperature: 120 })), {}, 'steam off: nothing recorded');
  assert.deepEqual(itemPatch('recipe', r, live({ targetTemperature: 0, duration: 0 })), {}, 'steam-time 0 sends temp 0: still nothing');
  assert.deepEqual(itemPatch('recipe', r, live({ targetTemperature: 140 })), { steamTempC: 140 }, 'above the off threshold is still dial-in');
  assert.deepEqual(itemPatch('recipe', r, wf({ steamSettings: { targetTemperature: 0, duration: 0, flow: 2, stopAtTemperature: 0 }, rinseData: { duration: 7 } })),
    { flushS: 7 }, 'only steam is held back');
  console.log('ok   steam off on the machine is not recorded onto the item');
}

// --- the dashboard sends only what it changed (dye2#31) ---------------------------
{
  const src = readFileSync(new URL('../src/pages/dashboard.ts', import.meta.url), 'utf8');
  const start = src.indexOf('function workflowPatch(');
  const body = src.slice(start, src.indexOf('\n}\n', start) + 2);
  const patch = new Function('base', 'cur', body + '; return workflowPatch(base, cur);');
  const base = { id: 'w1', context: { targetDoseWeight: 18, beanBatchId: 'b1', extras: { rpm: 900 } },
                 steamSettings: { targetTemperature: 150, duration: 30 } };
  const tapped = JSON.parse(JSON.stringify(base));
  tapped.context.targetDoseWeight = 19;
  assert.deepEqual(patch(base, tapped), { context: { targetDoseWeight: 19 } }, 'only the field the tap changed');
  assert.deepEqual(patch(base, JSON.parse(JSON.stringify(base))), {}, 'nothing changed, nothing sent');
  assert.deepEqual(patch(base, { context: { beanBatchId: null } }), { context: { beanBatchId: null } },
    'an explicit null is a change; keys the change did not touch are not sent');
  const shifted = JSON.parse(JSON.stringify(base));
  shifted.profile = { title: 'P', steps: [{ temperature: 92 }] };
  assert.deepEqual(patch(base, shifted), { profile: { title: 'P', steps: [{ temperature: 92 }] } }, 'a profile arrives whole');
  console.log('ok   the dashboard PUTs only its own edits');
}

// --- the editor's save re-applies and re-arms the selected recipe (dye2#33) ----------
{
  const src = readFileSync(new URL('../src/pages/recipe-edit.ts', import.meta.url), 'utf8');
  const start = src.indexOf('async function reapplyIfSelected(');
  const body = src.slice(start, src.indexOf('\n}\n', start) + 2);
  const run = async (sel, saved) => {
    const calls = [];
    const fetchFn = async (url, init) => { calls.push([url, (init && init.method) || 'GET']); return { ok: true, json: async () => sel }; };
    const updateWorkflow = async (wf) => { calls.push(['PUT /workflow', JSON.stringify(wf)]); };
    const ok = await new Function('fetch', 'updateWorkflow', 'saved', body + '; return reapplyIfSelected(saved);')(fetchFn, updateWorkflow, saved);
    return { ok, calls };
  };
  const saved = { id: '1', workflow: { context: { targetDoseWeight: 19.5 } } };
  let r = await run({ kind: 'recipe', id: '1' }, saved);
  assert.equal(r.ok, true);
  assert.equal(r.calls[1][0], 'PUT /workflow', 'the save is applied to the live workflow');
  assert.equal(r.calls[1][1], '{"context":{"targetDoseWeight":19.5}}', 'with the saved values');
  assert.equal(r.calls[2][1], 'POST', 're-armed AFTER the PUT, so the apply is the new baseline');
  for (const other of [null, { kind: 'recipe', id: '2' }, { kind: 'favourite', id: '1' }]) {
    r = await run(other, saved);
    assert.equal(r.ok, false);
    assert.equal(r.calls.length, 1, 'not the armed recipe: the workflow is left alone');
  }
  console.log('ok   saving the armed recipe applies it and re-arms');
}

// --- an unresolvable profile is omitted, not sent as an {id,title} stub ---------------
{
  const src = readFileSync(new URL('../src/utils/dev-api.ts', import.meta.url), 'utf8');
  const start = src.indexOf('async function buildRecipeWorkflow(');
  const body = src.slice(start, src.indexOf('\n}\n', start) + 2);
  const build = (resolved) => new Function(
    'resolveFullProfileById', 'profileAtBrewTemp', 'recipeMachineSettings', 'markDye', 'recipe',
    body + '; return buildRecipeWorkflow(recipe);',
  )(async () => resolved, (p) => p, () => ({}), () => {}, {
    id: 'r1', profileId: 'p1', profileTitle: 'Adaptive v3', dashboardVariables: { dose: 18 },
  });

  const full = { title: 'Adaptive v3', steps: [{ name: 's', temperature: 93 }] };
  assert.deepEqual((await build(full)).profile, full, 'a resolved profile is sent whole');
  // PUT /workflow deep-merges, so a stub would rename the live profile's steps instead of
  // replacing them: the workflow would claim a profile it is not running.
  assert.ok(!('profile' in (await build(null))), 'an unresolvable profile is left out entirely');
  console.log('ok   an unresolvable profile is omitted rather than stubbed');
}

// --- Clear sends no null the bridge refuses -------------------------------------------
{
  const src = readFileSync(new URL('../src/pages/dashboard.ts', import.meta.url), 'utf8');
  const at = src.indexOf('currentWorkflow.context = {', src.indexOf("getElementById('dye-clear-btn')"));
  const literal = src.slice(src.indexOf('{', at), src.indexOf('};', at) + 1);
  const cleared = new Function('return ' + literal + ';')();

  // The bridge 400s the WHOLE body for an explicit null in any of these, so one of them in the
  // clear object means Clear-then-Done clears nothing at all (workflow_handler.dart
  // rejectExplicitNulls / validatePatchFieldTypes).
  for (const field of ['targetYield']) {
    assert.ok(!(field in cleared), 'Clear must not send ' + field + ': null -- the bridge refuses it');
  }
  assert.equal(cleared.targetDoseWeight, null, 'the fields it does send are explicit nulls');
  assert.equal(cleared.extras.note, null, 'including the nested extras');
  assert.ok(Object.keys(cleared).length > 5, 'and it still clears the rest of the context');
  console.log('ok   Clear sends only nulls the bridge accepts');
}

// --- recording is opt-in: a workflow change alone writes nothing -----------------------
{
  clearSelection();
  const s = fakeStore({ recipes: [recipe()] });
  armSelection({ kind: 'recipe', id: '1' }, wf(), 0);

  // A genuine barista change, not the apply's own echo.
  const dialled = wf({ context: { targetDoseWeight: 19.5, targetYield: 36, grinderSetting: '4.2' } });
  trackWorkflow(dialled, 10_000);
  assert.ok(getSelection(), 'the item stays selected');
  assert.deepEqual(s.writes, [], 'but nothing is written: a workflow change is not a decision');

  // Only the explicit save writes, and only the fields that moved.
  const wrote = await recordWorkflow(dialled, s.fetchFn, getSelection());
  assert.equal(wrote, true, 'the explicit save writes');
  assert.equal(s.store.recipes[0].dashboardVariables.dose, 19.5, 'the dialled dose lands');
  assert.equal(s.store.recipes[0].dashboardVariables.drink, 36, 'and the yield');

  // Saving again with nothing further changed writes nothing.
  const before = s.writes.length;
  await recordWorkflow(dialled, s.fetchFn, getSelection());
  assert.equal(s.writes.length, before, 'a second save with no change is a no-op');
  clearSelection();
  console.log('ok   recording is opt-in: the event tracks, only an explicit save writes');
}

// --- derived selection (dye2#36) -------------------------------------------------------
{
  const withId = (id, over) => {
    const w = wf(over);
    w.context = { ...w.context, ...(over && over.context), extras: { dye: { v: 1, recipeId: id } } };
    return w;
  };
  const r1 = () => ({ ...recipe(), workflow: { profile: profile(93) } });
  const rows = (extra) => ({ recipes: [r1()], favourites: [fav()], ...extra });
  assert.equal(recipeIdOf(withId('1')), '1');
  assert.equal(recipeIdOf(withId(null)), null);
  assert.equal(recipeIdOf(withId('')), null);
  assert.equal(recipeIdOf(wf()), null);

  // AC1: a recipe keeps its highlight when a held field drifts, with the modified flag
  assert.deepEqual(deriveSelection(withId('1'), rows()), { kind: 'recipe', id: '1', modified: false });
  const drifted = withId('1', { context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '5' } });
  assert.deepEqual(deriveSelection(drifted, rows()), { kind: 'recipe', id: '1', modified: true }, 'grind change: still selected, starred');
  // and once saved (the recipe holds the new grind) the star clears
  const saved = r1(); saved.dashboardVariables.grind = 5;
  assert.equal(deriveSelection(drifted, { recipes: [saved] }).modified, false, 'save clears the star');
  // a field the recipe does not hold never stars it; steam off never stars it
  assert.equal(recipeModified(r1(), wf({ rinseData: { duration: 5 }, hotWaterData: { volume: 999 } })), false);
  assert.equal(recipeModified(r1(), wf({ steamSettings: { targetTemperature: 0, duration: 0 } })), false, 'steam off is not drift');
  const steamy = r1(); Object.assign(steamy.dashboardVariables, { steamTempC: 150 });
  assert.equal(recipeModified(steamy, wf({ steamSettings: { targetTemperature: 0, duration: 30 } })), false, 'held steam, machine steam off');
  assert.equal(recipeModified(steamy, wf({ steamSettings: { targetTemperature: 160, duration: 30 } })), true, 'held steam, changed');

  // AC2: a favourite deselects on any drift of a field it owns
  assert.deepEqual(deriveSelection(wf(), rows({ recipes: [] })), { kind: 'favourite', id: 'af1', modified: false });
  assert.equal(deriveSelection(wf({ context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '5' } }), rows({ recipes: [] })), null, 'favourite + grind change: nothing');

  // AC4: applying a favourite nulls recipeId, so the recipe highlight goes (nothing stored to remember it)
  assert.equal(deriveSelection(withId(null), rows({ favourites: [] })), null);
  assert.equal(deriveSelection(withId(null), rows()).kind, 'favourite');

  // recents: compared against the row's own workflow; a saved favourite beats the recent duplicating it
  const recent = { id: 'recent:1', auto: true, workflow: wf() };
  assert.deepEqual(deriveSelection(wf(), { favourites: [recent] }), { kind: 'favourite', id: 'recent:1', modified: false, auto: true }, 'a recent reports favourite + auto');
  assert.equal(deriveSelection(wf(), { favourites: [recent, fav()] }).id, 'af1', 'saved before recents');
  assert.equal(deriveSelection(wf({ context: { targetDoseWeight: 19, targetYield: 36, grinderSetting: '4.2' } }), { favourites: [recent] }), null, 'recents deselect on drift');
  // a recipeId that resolves beats a matching favourite
  assert.equal(deriveSelection(withId('1'), rows()).kind, 'recipe');

  // heldFields / favouriteMatches edges
  assert.deepEqual(heldFields({ a: 1, b: 2, c: 3 }, { a: 0, b: null }), { a: 1 }, 'only non-null stored keys');
  assert.equal(favouriteMatches({ id: 'x', snapshot: {} }, wf()), false, 'an empty snapshot never matches');
  assert.equal(favouriteMatches({ id: 'x', auto: true, workflow: {} }, wf()), false, 'nor an empty recent');
  assert.equal(favouriteMatches({ id: 'x', snapshot: { dose: 18, grindSetting: '4.20' } }, wf()), true, '"4.20" == 4.2 numerically');
  assert.equal(favouriteMatches({ id: 'x', snapshot: { dose: 18, grindSetting: 4.2, profileTitle: 'Other' } }, wf()), true, 'non-field keys are ignored');

  // AC3: a profile change drops the recipe's identity; a temperature-only edit does not
  const other = { ...profile(93), title: 'Other' };
  assert.equal(recipeProfileChanged(r1(), wf({ profile: other })), true, 'P-strip profile change');
  assert.equal(recipeProfileChanged(r1(), wf({ profile: profile(96) })), false, 'brew-temp edit is not a new profile');
  assert.equal(recipeProfileChanged(recipe(), wf({ profile: other })), false, 'a recipe naming no profile has no fingerprint to differ from');

  // AC5: a deleted recipe is recovered from the newest shot carrying its id, or quietly nothing
  const shot = (id, dose) => ({ id: 's' + dose, workflow: withId(id, { context: { targetDoseWeight: dose, targetYield: 36, grinderSetting: '4.2' } }) });
  const shotsFetch = (items) => async () => ({ ok: true, status: 200, json: async () => ({ items }) });
  const hist = await resolveRecipeFromHistory(shotsFetch([shot('9', 20), shot('1', 19), shot('1', 17)]), '1');
  assert.equal(hist.id, '1');
  assert.equal(hist.dashboardVariables.dose, 19, 'the newest matching shot');
  assert.deepEqual(deriveSelection(withId('1'), { recipes: [hist] }), { kind: 'recipe', id: '1', modified: true }, 'drifted from the shot: starred');
  assert.equal(await resolveRecipeFromHistory(shotsFetch([shot('9', 20)]), '1'), null, 'no such shot: no highlight');
  assert.equal(deriveSelection(withId('1'), { recipes: [] }), null, 'dangling id, no history: quiet');
  assert.equal(await resolveRecipeFromHistory(async () => ({ ok: false, status: 500, json: async () => null }), '1'), null);

  // The drift compare is live-vs-live once a baseline exists, so a stored snapshot that
  // serialises differently from the host's profile cannot null a fresh apply.
  const skewed = { ...r1(), workflow: { profile: { ...profile(93), title: 'P', extraHostKey: 1 } } };
  assert.equal(recipeProfileChanged(skewed, wf()), false, 'extra top-level key is not in the fingerprint');
  const reordered = { ...r1(), workflow: { profile: { title: 'P', tank_temperature: 0, steps: [{ temperature: 93, name: 's', extra: 1 }] } } };
  assert.equal(recipeProfileChanged(reordered, wf()), true, 'a stored snapshot that differs in shape reads as changed...');
  const base = { profileFingerprint: profileFingerprint(wf().profile) };
  assert.equal(idProfileChanged(base, reordered, wf()), false, '...but with a baseline taken from the live apply it does not');
  assert.equal(idProfileChanged(base, reordered, wf({ profile: other })), true, 'baseline: a real profile change still nulls');
  assert.equal(idProfileChanged(base, reordered, wf({ profile: profile(96) })), false, 'baseline: temperature edit is not a change');
  assert.equal(idProfileChanged(null, reordered, wf()), true, 'no baseline (restart): the stored profile is compared');
  assert.equal(idProfileChanged(null, recipe(), wf({ profile: other })), false, 'no baseline, recipe names no profile');

  // AC6: the id rides in the workflow, which Decaid copies onto the shot. Decaid keeps the
  // whole workflow (shot_record / workflow context extras round-trip), so the contract here is
  // that the id sits in context.extras.dye, where recipeIdOf reads it back from a shot.
  assert.equal(recipeIdOf(shot('1', 18).workflow), '1');
  console.log('ok   selection is derived from the workflow');
}

// --- recipe name proposal -------------------------------------------------------------
{
  const w = (title, ctx, over) => ({
    profile: { title, steps: [] },
    context: { targetDoseWeight: 18, targetYield: 36, ...ctx },
    steamSettings: { targetTemperature: 0, duration: 0 },
    hotWaterData: { volume: 0, duration: 0 },
    ...over,
  });
  const steam = (d) => ({ steamSettings: { targetTemperature: 150, duration: d } });
  assert.equal(proposeRecipeName(w('Turbo', { targetYield: 27 })), 'Turbo Ristretto', 'ratio 1.5');
  assert.equal(proposeRecipeName(w('Turbo', { targetYield: 38.9 })), 'Turbo Espresso', '2.16');
  assert.equal(proposeRecipeName(w('Turbo', { targetYield: 43.2 })), 'Turbo Espresso', '2.4 is still espresso');
  assert.equal(proposeRecipeName(w('Turbo', { targetYield: 54 })), 'Turbo Lungo', 'ratio 3');
  assert.equal(proposeRecipeName(w('Turbo', { targetYield: undefined })), 'Turbo Espresso', 'no ratio: espresso');
  assert.equal(proposeRecipeName(w('Default', {}, { hotWaterData: { volume: 120 } })), 'Americano', 'generic profile dropped');
  assert.equal(proposeRecipeName(w('advanced thing', {})), 'Espresso');
  assert.equal(proposeRecipeName(w('Turbo Shot 2', {})), 'Turbo Espresso', 'first word only');
  assert.equal(proposeRecipeName(w('Turbo', {}, steam(20))), 'Turbo Flat White');
  assert.equal(proposeRecipeName(w('Turbo', {}, steam(35))), 'Turbo Cappuccino');
  assert.equal(proposeRecipeName(w('Turbo', {}, steam(36))), 'Turbo Latte');
  assert.equal(proposeRecipeName(w('Turbo', {}, { steamSettings: { targetTemperature: 150 } })), 'Turbo Latte', 'unknown duration: latte');
  assert.equal(proposeRecipeName(w('Turbo', {}, { ...steam(15), hotWaterData: { volume: 100 } })), 'Turbo Flat White', 'steam beats hot water');
  assert.equal(proposeRecipeName(w('Turbo', { targetYield: 27 }, { hotWaterData: { duration: 10 } })), 'Turbo Americano', 'hot water beats ratio');
  assert.equal(proposeRecipeName(w('Turbo', { targetYield: 27 }, steam(10))), 'Turbo Flat White', 'milk beats ratio');
  // collisions: the bean's first word, then a counter
  const ctx = { targetYield: 27, coffeeName: 'Ethiopia Guji' };
  assert.equal(proposeRecipeName(w('Turbo', ctx), ['Turbo Ristretto']), 'Turbo Ristretto Ethiopia');
  assert.equal(proposeRecipeName(w('Turbo', ctx), ['turbo ristretto', 'Turbo Ristretto Ethiopia']), 'Turbo Ristretto Ethiopia 2');
  assert.equal(proposeRecipeName(w('Turbo', { targetYield: 27 }), ['Turbo Ristretto', 'Turbo Ristretto 2']), 'Turbo Ristretto 3', 'no bean: counter');
  console.log('ok   recipe names are proposed from the workflow');
}
