// The user's real recipe shapes (device-bugs plan, FIX 2.1): does the `*` flip?
import assert from 'node:assert/strict';
import { recipeModified, deriveSelection } from '../src/utils/workflow-record.ts';

const wfBase = () => ({
  context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '20.30',
    extras: { basketId: null, basketName: null, rpm: 19, dye: { v: 1, recipeId: 'be96' } } },
  profile: { title: 'p', steps: [{ temperature: 88 }] },
  steamSettings: { targetTemperature: 165, duration: 1, flow: 16.0, stopAtTemperature: 0 },
  hotWaterData: { targetTemperature: 80, duration: 30, volume: 15, flow: 8 },
  rinseData: { targetTemperature: 25, duration: 17, flow: 10 },
});
// the live be96feb2 row: only dose and drink are held; the rest are mode strings / equipment.
const slotless = () => ({ id: 'be96', stripSlot: null,
  dashboardVariables: { dose: 18, drink: 36, steamMode: 'flow', hotWaterMode: 'vol',
    equipmentIds: ['x'], equipmentNames: ['wdt tool'], equipmentCustom: {} } });
// a legacy row 1: holds grind, rpm, brewC, steamFlowMls, flushS, hotWaterMl, mode strings.
const legacy = () => ({ id: '1', stripSlot: 1,
  dashboardVariables: { dose: 18, drink: 36, brewC: 90, steamMode: 'flow', steamFlowMls: 0.8,
    flushS: 10, hotWaterMode: 'vol', hotWaterMl: 215, grind: 10, rpm: 500, basketId: null },
  workflow: { profile: { title: 'x' } } });

assert.equal(recipeModified(slotless(), wfBase()), false, 'untouched: no star');
for (const [label, mut] of [
  ['dose', (w) => { w.context.targetDoseWeight = 19; }],
  ['drink', (w) => { w.context.targetYield = 40; }],
]) {
  const w = wfBase(); mut(w);
  assert.equal(recipeModified(slotless(), w), true, `slotless recipe: ${label} moved -> modified`);
  const d = deriveSelection(w, { recipes: [slotless()], favourites: [] });
  assert.deepEqual(d, { kind: 'recipe', id: 'be96', modified: true });
}
// a field the recipe does not hold never stars it
const w2 = wfBase(); w2.context.grinderSetting = '25'; w2.context.extras.rpm = 99;
assert.equal(recipeModified(slotless(), w2), false, 'unheld grind/rpm do not star');

// legacy row: each held field flips it
const mk = (f) => { const w = wfBase(); w.context.targetDoseWeight = 18; w.context.targetYield = 36; w.context.grinderSetting = '10';
  w.context.extras.rpm = 500; w.profile.steps[0].temperature = 90; w.steamSettings = { targetTemperature: 165, flow: 0.8 };
  w.rinseData = { duration: 10 }; w.hotWaterData = { volume: 215 }; f && f(w); return w; };
assert.equal(recipeModified(legacy(), mk()), false, 'legacy row matching its own fields: no star');
for (const [label, f] of [
  ['grind', (w) => { w.context.grinderSetting = '11'; }],
  ['rpm', (w) => { w.context.extras.rpm = 400; }],
  ['brewC', (w) => { w.profile.steps[0].temperature = 91; }],
  ['steamFlow', (w) => { w.steamSettings.flow = 1.2; }],
  ['flushS', (w) => { w.rinseData.duration = 12; }],
  ['hotWaterMl', (w) => { w.hotWaterData.volume = 200; }],
]) assert.equal(recipeModified(legacy(), mk(f)), true, `legacy: ${label} moved -> modified`);
console.log('ok   recipeModified / deriveSelection flip for the real recipe shapes');
