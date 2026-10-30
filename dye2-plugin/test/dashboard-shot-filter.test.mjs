/**
 * One runnable check for the shot history filter drawer's pure merge logic (dsfBuildFilter):
 * several picked fields compose into one AND-ed loadShots() filter, and nothing picked means
 * no filter at all (not an empty object, which loadShots/shot-paging.ts treats differently).
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
  'const DSF_FIELDS = [["bean"], ["roaster"], ["grinder"], ["profile"]];\n' +
  src +
  '\nreturn { build: dsfBuildFilter, set: (s) => { dsfSelection = s; } };'
)();

env.set({});
assert.equal(env.build(), null, 'nothing picked means All Shots, not {}');

env.set({ bean: { label: 'Square Mile Red Brick', param: { beanId: 'b1' } } });
assert.deepEqual(env.build(), { beanId: 'b1' }, 'one field');

// Several drawer fields compose together (AND), unlike Same Beans / search which each
// replace the whole filter -- this is the "more control" the drawer exists to give.
env.set({
  grinder: { label: 'Niche Zero', param: { grinderId: 'g1' } },
  profile: { label: 'Classic Italian', param: { profileTitle: 'Classic Italian' } },
});
assert.deepEqual(env.build(), { grinderId: 'g1', profileTitle: 'Classic Italian' }, 'multiple picked fields AND together');

// A field cleared back to null drops out of the merge.
env.set({
  grinder: null,
  profile: { label: 'Classic Italian', param: { profileTitle: 'Classic Italian' } },
});
assert.deepEqual(env.build(), { profileTitle: 'Classic Italian' }, 'cleared field drops out');

console.log('ok   shot filter drawer: dsfBuildFilter composes picked fields');
