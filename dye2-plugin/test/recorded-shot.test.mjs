import assert from 'node:assert/strict';
import { recordedShotScript } from '../src/utils/recorded-shot.ts';

const { shotBasketRpm, shotWorkflowExtras, shotNote, noteToSave } =
  new Function(recordedShotScript + '\nreturn { shotBasketRpm, shotWorkflowExtras, shotNote, noteToSave };')();

// The reported shot: basket picked on the dashboard, so it lives only in the saved workflow.
const workflow = {
  context: {
    grinderSetting: '5.5',
    extras: { rpm: null, basketId: 'bskt-1790543325397', basketName: 'Decent 18g Ridgeless', note: null },
  },
};
const annotations = { actualDoseWeight: 18.0, actualYield: 53.8, extras: { visualizerId: 'v' } };

assert.deepEqual(shotBasketRpm({ workflow, annotations }),
  { basketId: 'bskt-1790543325397', basketName: 'Decent 18g Ridgeless', rpm: null },
  'basket set on the dashboard shows when annotations carry none');
assert.deepEqual(
  shotBasketRpm({ workflow, annotations: { extras: { basketId: 'b2', basketName: 'VST 20g', rpm: 900 } } }),
  { basketId: 'b2', basketName: 'VST 20g', rpm: 900 },
  'a basket and RPM edited after the shot win over the workflow');
assert.deepEqual(
  shotBasketRpm({ workflow, annotations: { extras: { basketName: 'Legacy name only' } } }),
  { basketId: null, basketName: 'Legacy name only', rpm: null },
  'basket id and name come from one source, never mixed');
assert.equal(
  shotBasketRpm({ workflow: { context: { extras: { rpm: 600 } }, grinderData: { rpm: 400 } } }).rpm, 600,
  'workflow RPM before legacy grinderData');
assert.equal(shotBasketRpm({ workflow: { grinderData: { rpm: 400 } } }).rpm, 400, 'legacy grinderData RPM');
assert.equal(shotBasketRpm({ workflow, annotations: { extras: { rpm: 0 } } }).rpm, 0, 'an RPM of 0 is still an RPM');
assert.deepEqual(shotBasketRpm({}), { basketId: null, basketName: null, rpm: null }, 'old shot with no extras');
assert.deepEqual(shotBasketRpm(null), { basketId: null, basketName: null, rpm: null }, 'no shot');

// Clipboard paste copies a shot back into the live workflow: the rest of the shot's
// context.extras rides along, with basket and RPM resolved the same way edit-shot shows them.
assert.deepEqual(shotWorkflowExtras({ workflow, annotations }),
  { rpm: null, basketId: 'bskt-1790543325397', basketName: 'Decent 18g Ridgeless', note: null },
  'paste: workflow extras copied as-is when nothing was edited after the shot');
assert.deepEqual(
  shotWorkflowExtras({
    workflow: { context: { extras: { rpm: 600, basketId: 'b1', basketName: 'IMS 18g', note: 'n' } } },
    annotations: { extras: { basketId: 'b2', basketName: 'VST 20g', rpm: 900, visualizerId: 'v' } },
  }),
  { rpm: 900, basketId: 'b2', basketName: 'VST 20g', note: 'n' },
  'paste: basket and RPM edited after the shot win; other annotation extras stay out');
assert.deepEqual(shotWorkflowExtras({ workflow: { grinderData: { rpm: 400 } } }), { rpm: 400 },
  'paste: legacy grinderData RPM');
assert.equal(shotWorkflowExtras({ workflow: { context: {} } }), undefined, 'paste: nothing to copy');

// The drinker note: an annotation wins, a missing or null one falls back to the pre-shot
// note, and an empty one is a clear that stays cleared (including after a save round trip).
const noteWorkflow = { context: { extras: { note: 'Before shot' } } };
for (const [annotations, expected, why] of [
  [undefined,                      'Before shot', 'no annotations falls back'],
  [{},                             'Before shot', 'no note annotation falls back'],
  [{ espressoNotes: null },        'Before shot', 'a null note annotation falls back'],
  [{ espressoNotes: 'After shot' }, 'After shot', 'a note edited after the shot wins'],
  [{ espressoNotes: '' },          '',            'a cleared note stays cleared'],
]) {
  const shot = { workflow: noteWorkflow, annotations };
  assert.equal(shotNote(shot), expected, why);
  assert.equal(shotNote(JSON.parse(JSON.stringify(shot))), expected, why + ' after serialization');
}
assert.equal(shotNote({ annotations: { espressoNotes: 'n' } }), 'n', 'a note with no workflow');
// Saving from the note editor: clearing writes '', which shotNote keeps cleared. A null
// here would fall back and bring the pre-shot note back.
assert.equal(noteToSave('  After shot \n'), 'After shot', 'the saved note is trimmed');
for (const text of ['', '   ', null, undefined]) {
  const saved = noteToSave(text);
  assert.equal(saved, '', 'an emptied editor saves an explicit empty string');
  const shot = { workflow: noteWorkflow, annotations: { espressoNotes: saved } };
  assert.equal(shotNote(JSON.parse(JSON.stringify(shot))), '', 'the cleared note stays cleared');
}
assert.equal(shotNote({}), '', 'old shot with no note');
assert.equal(shotNote(null), '', 'no shot');
console.log('ok   recorded-shot: edits after the shot win over its workflow (basket/RPM, then legacy grinderData); a cleared note stays cleared, including when saved from the editor');
