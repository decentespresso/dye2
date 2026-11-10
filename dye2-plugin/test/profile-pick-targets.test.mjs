// Picking a profile on Next Shot has to move Dose and Drink with it: before this, the picker
// wrote only `profile`, so the readouts kept the previous shot's numbers under the new
// profile's name. profileTargetsPatch is what it now sends alongside.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const src = readFileSync(new URL('../src/pages/profile-picker.ts', import.meta.url), 'utf8');

function lift(name) {
  let start = src.indexOf(`function ${name}(`);
  if (src.slice(start - 6, start) === 'async ') start -= 6;   // or `await` lands in a sync function
  const end = src.indexOf('\n}', start);
  assert.ok(start > 0 && end > start, `profile-picker defines ${name}`);
  return src.slice(start, end + 2);
}

// Runs the lifted functions with a stubbed getWorkflow (the live workflow the ratio comes from).
function patch(prof, liveContext) {
  const body = `${lift('profileYieldOf')}\n${lift('profileTargetsPatch')}\nreturn profileTargetsPatch(prof);`;
  const getWorkflow = async () => (liveContext === 'fail'
    ? Promise.reject(new Error('offline'))
    : { context: liveContext });
  return new Function('prof', 'getWorkflow', 'console', body)(prof, getWorkflow, console);
}

test('the profile\'s yield becomes Drink, and Dose follows at the live ratio', async () => {
  // 1:2 in play (18 -> 36), profile asks for 40g out: 20g in keeps the ratio.
  assert.deepEqual(await patch({ target_weight: 40 }, { targetDoseWeight: 18, targetYield: 36 }),
    { targetYield: 40, targetDoseWeight: 20 });
});

test('a yield of 0 means not set, so target_volume answers for it', async () => {
  assert.deepEqual(await patch({ target_weight: 0, target_volume: 36 }, { targetDoseWeight: 20, targetYield: 50 }),
    { targetYield: 36, targetDoseWeight: 14.5 });   // 36 / 2.5 = 14.4 -> the 0.5g dose step
});

test('a profile naming no yield patches nothing and leaves both readouts alone', async () => {
  assert.equal(await patch({ target_weight: 0, target_volume: 0 }, { targetDoseWeight: 18, targetYield: 36 }), null);
  assert.equal(await patch(null, { targetDoseWeight: 18, targetYield: 36 }), null);
});

test('no live ratio to work from (or no workflow at all) still sets Drink', async () => {
  assert.deepEqual(await patch({ target_weight: 36 }, {}), { targetYield: 36 });
  assert.deepEqual(await patch({ target_weight: 36 }, { targetDoseWeight: 18 }), { targetYield: 36 });
  assert.deepEqual(await patch({ target_weight: 36 }, 'fail'), { targetYield: 36 });
});
