/**
 * Dial-in recording (plugin runtime). Run: npm test
 * Imported directly like recent-favs.ts; see src/utils/workflow-record.ts.
 */
import assert from 'node:assert/strict';
import {
  armSelection, clearSelection, getSelection, setSelectionListener,
  profileFingerprint, profileDrifted, itemPatch, recordWorkflow, scheduleWorkflowRecord,
  suppress,
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
  assert.deepEqual(t, { steamTimeS: 40, steamMode: 'time' }, 'mode follows the moved value; absent steamFlowMls not stamped');
  const g = itemPatch('recipe', recipe(), wf({ context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '4.20' } }));
  assert.deepEqual(g, {}, 'numeric compare: 4.20 == 4.2');
  const b = itemPatch('recipe', recipe(), wf({ profile: profile(95) }));
  assert.deepEqual(b, { brewC: 95 });
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
  const sel = { kind: 'recipe', id: '1', profileFingerprint: profileFingerprint(profile(93)) };
  assert.equal(profileDrifted(sel, wf()), false);
  assert.equal(profileDrifted(sel, wf({ profile: { ...profile(93), title: 'Other' } })), true);

  armSelection({ kind: 'recipe', id: '1' }, wf(), 0);
  assert.ok(getSelection());
  scheduleWorkflowRecord(wf({ profile: { ...profile(93), title: 'Other' } }), async () => { throw new Error('no'); }, null, null, 10_000, 0);
  assert.equal(getSelection(), null, 'drifted workflow clears the armed item');
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

console.log('workflow-record tests passed');
