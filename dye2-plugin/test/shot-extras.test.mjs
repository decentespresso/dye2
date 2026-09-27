import assert from 'node:assert/strict';
import { shotExtrasScript } from '../src/utils/shot-extras.ts';

const { shotExtras } = new Function(shotExtrasScript + '\nreturn { shotExtras };')();

// The reported shot: basket picked on the dashboard, so it lives only in the saved workflow.
const workflow = {
  context: {
    grinderSetting: '5.5',
    extras: { rpm: null, basketId: 'bskt-1790543325397', basketName: 'Decent 18g Ridgeless', note: null },
  },
};
const annotations = { actualDoseWeight: 18.0, actualYield: 53.8, extras: { visualizerId: 'v' } };

assert.deepEqual(shotExtras({ workflow, annotations }),
  { basketId: 'bskt-1790543325397', basketName: 'Decent 18g Ridgeless', rpm: null },
  'basket set on the dashboard shows when annotations carry none');
assert.deepEqual(
  shotExtras({ workflow, annotations: { extras: { basketId: 'b2', basketName: 'VST 20g', rpm: 900 } } }),
  { basketId: 'b2', basketName: 'VST 20g', rpm: 900 },
  'a basket and RPM edited after the shot win over the workflow');
assert.deepEqual(
  shotExtras({ workflow, annotations: { extras: { basketName: 'Legacy name only' } } }),
  { basketId: null, basketName: 'Legacy name only', rpm: null },
  'basket id and name come from one source, never mixed');
assert.equal(
  shotExtras({ workflow: { context: { extras: { rpm: 600 } }, grinderData: { rpm: 400 } } }).rpm, 600,
  'workflow RPM before legacy grinderData');
assert.equal(shotExtras({ workflow: { grinderData: { rpm: 400 } } }).rpm, 400, 'legacy grinderData RPM');
assert.equal(shotExtras({ workflow, annotations: { extras: { rpm: 0 } } }).rpm, 0, 'an RPM of 0 is still an RPM');
assert.deepEqual(shotExtras({}), { basketId: null, basketName: null, rpm: null }, 'old shot with no extras');
assert.deepEqual(shotExtras(null), { basketId: null, basketName: null, rpm: null }, 'no shot');
console.log('ok   shot-extras: Edit Shot falls back to the shot\'s workflow basket and RPM');
