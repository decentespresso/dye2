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
  ['src/pages/dashboard.ts', /wireAdjuster\('dye-grind-minus'[\s\S]{0,600}?\n\s*true\s/],
  ['src/pages/edit-shot.ts', /wireAdjuster\('es-setting-minus'[\s\S]{0,600}?\}, true\)/],
  ['src/pages/recipe-edit.ts', /wireAdjuster\('re-grind-minus'[\s\S]{0,300}?, true\)/],
]) {
  const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert.match(src, wire, file + ': grind stepper must pass allowText');
  assert.match(src, /if \(apply && allowText && raw !== '' && !isNumericText\(raw\)\)/,
    file + ': typed free text must be committed as typed');
  assert.match(src, /if \(allowText && !isNumericText\(/,
    file + ': +/- must leave a non-numeric setting alone');
}

console.log('ok   grind settings keep free text ("1.1.0", "15 clicks")');
