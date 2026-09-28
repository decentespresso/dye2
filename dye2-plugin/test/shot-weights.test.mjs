import assert from 'node:assert/strict';
import { shotWeightsScript } from '../src/utils/shot-weights.ts';

const { shotWeights } = new Function(shotWeightsScript + '\nreturn { shotWeights };')();

// The reported shot: the graph's last scale sample read 46.8g, the saved actual yield 51.6g.
const measurements = [{ scale: { weight: 40.2 } }, { scale: { weight: 46.8 } }, { machine: {} }];
const workflow = { context: { targetDoseWeight: 18 } };

assert.deepEqual(
  shotWeights({ measurements, workflow, annotations: { actualYield: 51.6, actualDoseWeight: 18.2 } }),
  { doseIn: 18.2, doseOut: 51.6 },
  'saved actual dose/yield win over the target dose and the last scale sample');
assert.deepEqual(shotWeights({ measurements, workflow }), { doseIn: 18, doseOut: 46.8 },
  'no annotations: target dose, last scale sample that has a weight');
assert.equal(shotWeights({ measurements, workflow, annotations: { actualYield: 0 } }).doseOut, 0,
  'a saved yield of 0 is still a saved yield');
assert.deepEqual(shotWeights({ workflow: { doseData: { doseIn: 17 } } }), { doseIn: 17, doseOut: null },
  'legacy doseData dose; no yield anywhere');
assert.deepEqual(shotWeights({}), { doseIn: null, doseOut: null }, 'empty shot');
console.log('ok   shot-weights: Last Shot prefers saved actual dose/yield over the scale graph');
