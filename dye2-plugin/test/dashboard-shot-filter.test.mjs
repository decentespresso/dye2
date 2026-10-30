/**
 * One runnable check for the search popup's pure merge logic (dsfBuildFilter): free text and
 * several picked fields all compose into one AND-ed loadShots() filter, and nothing
 * picked/typed means no filter at all (not an empty object, which loadShots/shot-paging.ts
 * treats differently).
 *
 * new Function (not vm), same realm as shot-paging.test.mjs's harness -- a real vm context
 * makes every object it returns fail assert/strict's deepEqual against a plain literal here
 * (different realm, different Object.prototype), which a pure-logic check has no reason to pay.
 * Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dash = readFileSync(new URL('../src/pages/dashboard.ts', import.meta.url), 'utf8');

const start = dash.indexOf('function dsfBuildFilter(');
const end = dash.indexOf('\nfunction updateShotFilterBadge', start);
assert.ok(start > 0 && end > start, 'dsfBuildFilter found');
const src = dash.slice(start, end);

// DSF_FIELDS only needs the field-name slot here; dsfBuildFilter ignores the loader function.
const env = new Function(
  'let dsfSelection = {};\n' +
  'const DSF_FIELDS = [["bean"], ["roaster"], ["grinder"], ["profile"], ["rating"]];\n' +
  src +
  '\nreturn { build: dsfBuildFilter, set: (s) => { dsfSelection = s; } };'
)();

env.set({});
assert.equal(env.build(''), null, 'nothing typed or picked means All Shots, not {}');

env.set({ bean: { label: 'Square Mile Red Brick', param: { beanId: 'b1' } } });
assert.deepEqual(env.build(''), { beanId: 'b1' }, 'one field');

// Several popup fields compose together (AND), unlike Same Beans which replaces the whole
// filter -- this is the "more control" the popup exists to give.
env.set({
  grinder: { label: 'Niche Zero', param: { grinderId: 'g1' } },
  profile: { label: 'Classic Italian', param: { profileTitle: 'Classic Italian' } },
});
assert.deepEqual(env.build(''), { grinderId: 'g1', profileTitle: 'Classic Italian' }, 'multiple picked fields AND together');

// A field cleared back to null drops out of the merge.
env.set({
  grinder: null,
  profile: { label: 'Classic Italian', param: { profileTitle: 'Classic Italian' } },
});
assert.deepEqual(env.build(''), { profileTitle: 'Classic Italian' }, 'cleared field drops out');

// Free text composes with picked fields too (the bridge ANDs search with every other param).
assert.deepEqual(env.build('decaf'), { search: 'decaf', profileTitle: 'Classic Italian' },
  'free text composes with picked fields, not replaces them');

env.set({});
assert.deepEqual(env.build('decaf'), { search: 'decaf' }, 'free text alone, no fields picked');

// Rating rides the same dsfSelection/DSF_FIELDS slots as the combo fields (it's wired by
// setupShotRatingFilter, not setupFilterCombo, but dsfBuildFilter doesn't care which).
env.set({
  rating: { label: '4★ & up', param: { minEnjoyment: 8 } },
  grinder: { label: 'Niche Zero', param: { grinderId: 'g1' } },
});
assert.deepEqual(env.build(''), { grinderId: 'g1', minEnjoyment: 8 }, 'rating composes with the other fields too');

console.log('ok   search popup: dsfBuildFilter composes free text and picked fields');
