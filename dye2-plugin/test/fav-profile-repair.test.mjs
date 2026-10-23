/**
 * One-time repair of favourites stored with a profile in name only. Run: npm test
 */
import assert from 'node:assert/strict';
import { fattenFavouriteProfiles, favouritesNeedProfileRepair } from '../src/utils/recent-favs.ts';

const prof = (title, temp) => ({ title, target_weight: 36, steps: [{ name: 's', temperature: temp }] });
const library = [
  { id: 'profile:a', profile: prof('Adaptive v2', 93) },
  { id: 'profile:dup', profile: prof('Adaptive v2', 93) },     // titles are not unique
  { id: 'profile:stub', profile: { title: 'Stubbed', steps: [] } },
];

// The row on this tablet: a title, no id, nothing behind it.
{
  const rows = [{ id: 'f1', snapshot: { profileTitle: 'Adaptive v2', profileSnapshot: null, dose: 16.6 },
                  workflow: { context: { targetDoseWeight: 16.6 } } }];
  assert.equal(favouritesNeedProfileRepair(rows), true, 'a named-but-empty profile needs repair');
  const out = fattenFavouriteProfiles(rows, library);
  assert.notEqual(out, rows, 'a repair returns a new array');
  assert.equal(out[0].snapshot.profileSnapshot.steps[0].temperature, 93, 'the snapshot gets the real profile');
  assert.equal(out[0].snapshot.profileId, 'profile:a', 'and the missing id is backfilled');
  // The skin applies workflow.profile straight off the row, so it has to be filled too.
  assert.equal(out[0].workflow.profile.steps.length, 1, 'the ready-to-PUT workflow gets it as well');
  assert.equal(out[0].workflow.context.targetDoseWeight, 16.6, 'the rest of the workflow is untouched');
  assert.equal(out[0].snapshot.dose, 16.6, 'and the rest of the snapshot');
  assert.equal(rows[0].snapshot.profileSnapshot, null, 'the input rows are not mutated');
}

// Already whole in both places, or naming nothing at all: left exactly as they are.
{
  const whole = { id: 'f2', snapshot: { profileId: 'profile:a', profileTitle: 'Adaptive v2', profileSnapshot: prof('Adaptive v2', 93) },
                  workflow: { profile: prof('Adaptive v2', 93) } };
  const nameless = { id: 'f3', snapshot: { dose: 18 }, workflow: { context: {} } };
  const rows = [whole, nameless];
  assert.equal(favouritesNeedProfileRepair(rows), false, 'nothing to do');
  assert.equal(fattenFavouriteProfiles(rows, library), rows, 'the same array comes back, so no write happens');
}

// A snapshot that is whole but a workflow that is not still gets repaired: the skin reads the
// workflow, DYE2 reads the snapshot, and they must agree.
{
  const rows = [{ id: 'f4', snapshot: { profileId: 'profile:a', profileSnapshot: prof('Adaptive v2', 93) },
                  workflow: { profile: { id: 'profile:a', title: 'Adaptive v2', steps: [] } } }];
  assert.equal(favouritesNeedProfileRepair(rows), true, 'a stub workflow profile counts as thin');
  assert.equal(fattenFavouriteProfiles(rows, library)[0].workflow.profile.steps.length, 1, 'and is filled');
}

// Unresolvable: a title nobody has, or a library row with no steps. Left alone, no id invented.
{
  const rows = [
    { id: 'f5', snapshot: { profileTitle: 'Never Heard Of It', profileSnapshot: null }, workflow: {} },
    { id: 'f6', snapshot: { profileTitle: 'Stubbed', profileSnapshot: null }, workflow: {} },
  ];
  assert.equal(fattenFavouriteProfiles(rows, library), rows, 'nothing resolvable, nothing written');
  assert.equal(fattenFavouriteProfiles(rows, []), rows, 'and an empty library changes nothing');
}

// Idempotent: a second pass over its own output is a no-op, so a re-run never writes again.
{
  const rows = [{ id: 'f7', snapshot: { profileTitle: 'Adaptive v2', profileSnapshot: null }, workflow: {} }];
  const once = fattenFavouriteProfiles(rows, library);
  assert.equal(fattenFavouriteProfiles(once, library), once, 'the repair is idempotent');
}

// Not an array (a never-written key reads as null): handed back untouched.
assert.equal(fattenFavouriteProfiles(null, library), null, 'null is not an array of favourites');
assert.equal(favouritesNeedProfileRepair(null), false, 'and needs no repair');

console.log('ok   fattenFavouriteProfiles: by id, by title, both stores filled, idempotent');
