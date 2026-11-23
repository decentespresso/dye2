/**
 * A grind setting is free text: WorkflowContext.grinderSetting is a String? on the host, and
 * not every grinder has one numeric scale ("1.1.0" on a three-dial, "15 clicks" on a stepped
 * one). It used to be parsed with parseFloat everywhere, which kept "1.1" and dropped the
 * rest. Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recipeFields, favouriteFields, itemPatch } from '../src/utils/workflow-record.ts';

const wf = (setting) => ({ context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: setting } });

// Recorded onto a recipe / favourite as typed.
assert.equal(recipeFields(wf('1.1.0')).grind, '1.1.0');
assert.equal(favouriteFields(wf('1.1.0')).grindSetting, '1.1.0');
assert.equal(recipeFields(wf('15 clicks')).grind, '15 clicks');

// A numeric scale still stores a number, as docs/KV_CONTRACT.md says.
assert.equal(recipeFields(wf('4.2')).grind, 4.2);
assert.equal(recipeFields(wf(' 4.2 ')).grind, 4.2);
assert.equal(favouriteFields(wf('4.2')).grindSetting, 4.2);

// Blank stays absent rather than becoming 0.
assert.equal('grind' in recipeFields(wf('')), false);
assert.equal('grind' in recipeFields(wf(null)), false);

// A dotted setting the recipe already holds records a change only when it really moved.
const recipe = { dashboardVariables: { dose: 18, drink: 36, grind: '1.1.0' } };
assert.deepEqual(itemPatch('recipe', recipe, wf('1.1.0')), {});
assert.deepEqual(itemPatch('recipe', recipe, wf('1.1.1')), { grind: '1.1.1' });
assert.deepEqual(itemPatch('recipe', recipe, wf('2')), { grind: 2 });

// The browser-side steppers are template-literal strings, so the compiler never sees them:
// check each grind field is still wired as free text, and that typing commits the raw value.
for (const [file, wire] of [
  ['src/pages/dashboard.ts', /wireAdjuster\('dye-grind-minus'[\s\S]{0,600}?\n\s*\(\) => grinderHighest\(/],
  ['src/pages/edit-shot.ts', /wireAdjuster\('es-setting-minus'[\s\S]{0,600}?\}, \(\) => \{[\s\S]{0,300}?grinderHighest\(/],
  ['src/pages/recipe-edit.ts', /wireAdjuster\('re-grind-minus'[\s\S]{0,300}?\(\) => grinderHighest\(/],
]) {
  const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert.match(src, wire, file + ': grind stepper must pass allowText');
  assert.match(src, /if \(apply && allowText && raw !== '' && !isNumericText\(raw\)\)/,
    file + ': typed free text must be committed as typed');
  assert.match(src, /if \(allowText && !isNumericText\(/,
    file + ': +/- must not parseFloat a non-numeric setting');
  assert.ok(src.includes('stepGrindText(') && src.includes('syncGrindButtons(valueId)'),
    file + ': +/- step text through grindStepScript and keep the dimming in step');
  assert.ok(src.includes('grindStepScript'), file + ': the page ships grindStepScript');
}

// Read From > From Favourite maps the favourite's snapshot.grindSetting onto the recipe. It
// used to parseFloat it, which painted "C40" as NaN in the stepper and clipped "1.1.0" to 1.1.
{
  const src = readFileSync(new URL('../src/pages/recipe-edit.ts', import.meta.url), 'utf8');
  assert.match(src, /grind: grindOrText\(grind\),/, 'favouriteToRecipePatch keeps the text');
  const grab = (sig) => { const m = src.match(new RegExp('function ' + sig + ' \\{[\\s\\S]*?\\n\\}')); assert.ok(m, sig + ' is defined in the page script'); return m[0]; };
  const grindOrText = new Function(grab('isNumericText\\(t\\)') + grab('grindOrText\\(v\\)') + '; return grindOrText;')();
  assert.equal(grindOrText('1.1.0'), '1.1.0');
  assert.equal(grindOrText('15 clicks'), '15 clicks');
  assert.equal(grindOrText('C40'), 'C40');
  assert.equal(grindOrText('20.00'), 20);
  assert.equal(grindOrText(''), undefined);
  assert.equal(grindOrText(null), undefined);
  assert.equal(grindOrText(0), 0);
}

console.log('ok   grind settings keep free text ("1.1.0", "15 clicks")');

// +/− on a grind that is not plainly a number (dye2#49). The grinder's "Highest setting" says
// where each part of a multi-part dial carries; without it, only the last number moves.
{
  const { grindStepScript } = await import('../src/utils/grinder-form.ts');
  const { stepGrindText, grinderHighest, grindCanStep } =
    new Function(grindStepScript + '; return { stepGrindText, grinderHighest, grindCanStep };')();
  const top = '3.39.4';
  assert.equal(stepGrindText('1.12.3', top, 1), '1.12.4');
  assert.equal(stepGrindText('1.12.4', top, 1), '1.13.0', 'the last part carries into the middle');
  assert.equal(stepGrindText('1.39.4', top, 1), '2.0.0', 'and the middle into the first');
  assert.equal(stepGrindText('1.13.0', top, -1), '1.12.4', 'minus borrows back');
  assert.equal(stepGrindText('0.0.0', top, -1), '0.0.0', 'stops at the lowest');
  assert.equal(stepGrindText('3.39.4', top, 1), '3.39.4', 'stops at the highest');
  assert.equal(stepGrindText('1.50.0', top, 1), '1.39.1', 'a part typed past its highest is read as its highest (1.39.0)');
  assert.equal(stepGrindText('1.12', top, 1), '1.13', 'a different part count is not this dial: last number only');
  // No highest setting: the last number moves, nothing carries, nothing else is touched.
  assert.equal(stepGrindText('1.12.0', null, 1), '1.12.1');
  assert.equal(stepGrindText('1.12.9', null, 1), '1.12.10');
  assert.equal(stepGrindText('1.12.0', null, -1), '1.12.0', 'never below 0');
  assert.equal(stepGrindText('15 clicks', null, 1), '16 clicks');
  assert.equal(stepGrindText('C40', null, -1), 'C39');
  assert.equal(stepGrindText('1.12.05', null, 1), '1.12.06', 'keeps leading zeros');
  assert.equal(stepGrindText('Fine', null, 1), null, 'no number: nothing to step');
  // Only a dotted run of whole numbers is a highest setting.
  assert.equal(grinderHighest({ extras: { settingHighest: '3.39.4' } }), '3.39.4');
  for (const bad of ['', '40', '3.39.x', 3.4, null]) assert.equal(grinderHighest({ extras: { settingHighest: bad } }), null, String(bad));
  assert.equal(grinderHighest(null), null);
  // The buttons dim only when there is no number to move (an empty field steps from the min).
  for (const v of ['1.12.0', '15 clicks', '4.2', '—', '']) assert.equal(grindCanStep(v), true, v);
  assert.equal(grindCanStep('Fine'), false);
}
console.log('ok   grind +/− step multi-part settings, carrying at the grinder\'s highest setting');
