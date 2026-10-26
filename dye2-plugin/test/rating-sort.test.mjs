/**
 * Rating sort (Select Recipe, Auto Favs): plain mean of shotIndex.tail ratings, unrated last.
 * Evals the same ratingSortScript string the pages inline. Run: npm test
 */
import assert from 'node:assert/strict';
import { ratingSortScript } from '../src/utils/recipe-sort.ts';
import { recentGroupKey } from '../src/utils/recent-favs.ts';

const { sortByMeanRating, favouriteGroupKey, recentGroupKey: pageKey } =
  new Function(ratingSortScript + '\nreturn { sortByMeanRating, favouriteGroupKey, recentGroupKey };')();

// The pages call recentGroupKey by that name, so the script must bind it itself rather than lean
// on whatever the bundler decides to call the embedded function.
assert.match(ratingSortScript, /const recentGroupKey = \(/);
const ids = (l) => l.map((x) => x.id);

const recipes = [
  { id: 'a', capturedAt: '2026-01-01' },
  { id: 'b', capturedAt: '2026-01-03' },
  { id: 'c', capturedAt: '2026-01-02' },
  { id: 'd', capturedAt: '2026-01-04' },
  { id: 'e', capturedAt: '2026-01-05' },
];
const byRid = (l, tail) => sortByMeanRating(l, tail, (r) => r.id, (t) => t.rid);

// Mean of several ratings; mixed rated/unrated shots count only the rated ones.
{
  const tail = [
    { rid: 'a', rating: 0.9 }, { rid: 'a', rating: 0.5 },   // mean 0.7
    { rid: 'b', rating: 0.8 },                               // 0.8
    { rid: 'c', rating: 0.6 }, { rid: 'c', rating: null }, { rid: 'c', rating: null }, // 0.6, not 0.2
  ];
  assert.deepEqual(ids(byRid(recipes, tail)).slice(0, 3), ['b', 'a', 'c']);
}

// Unrated recipes (no shots, or only null ratings) go last in Recent order.
{
  const tail = [{ rid: 'a', rating: 0.1 }, { rid: 'd', rating: null }];
  assert.deepEqual(ids(byRid(recipes, tail)), ['a', 'e', 'd', 'b', 'c']);
}

// Missing or garbage shotIndex data: no throw from junk rows; rating-less tail keeps Recent order.
{
  assert.deepEqual(ids(byRid(recipes, [null, 5, {}, { rid: 'a', rating: 'x' }])), ['e', 'd', 'b', 'c', 'a']);
}

// A favourite matches by the group key of its own stored workflow.
{
  const wf = (name) => ({ context: { coffeeName: name, coffeeRoaster: 'R', grinderModel: 'G' }, profile: { title: 'P' } });
  const favs = [
    { id: 'f1', capturedAt: '2026-01-01', workflow: wf('Ethiopia') },
    { id: 'f2', capturedAt: '2026-01-02', workflow: wf('Kenya') },
    { id: 'f3', capturedAt: '2026-01-03' },                                   // no workflow: unrated
    { id: 'f4', capturedAt: '2026-01-04', workflow: { context: {}, profile: {} } }, // no bean: unrated
  ];
  const k1 = recentGroupKey({ workflow: wf('Ethiopia') });
  assert.equal(pageKey({ workflow: wf('Ethiopia') }), k1, 'page copy is recent-favs recentGroupKey');
  assert.equal(pageKey({ workflow: { context: {}, profile: {} } }), null);
  assert.equal(pageKey({ workflow: { context: { coffeeName: 'x' }, profile: { beverage_type: 'cleaning' } } }), null);
  const tail = [
    { key: k1, rating: 0.4 }, { key: k1, rating: 0.6 },
    { key: recentGroupKey({ workflow: wf('Kenya') }), rating: 0.9 },
  ];
  const sorted = sortByMeanRating(favs, tail, (f) => pageKey(f), (t) => t.key);
  assert.deepEqual(ids(sorted), ['f2', 'f1', 'f4', 'f3']);
}
// A recent whose recorded profile was not executable is stored with no workflow.profile, so its
// recomputed key misses its own group: the row's own key, found by sourceShotId, is authoritative.
{
  const recent = { id: 'recent:s9', sourceShotId: 's9', capturedAt: '2026-01-01',
    workflow: { context: { coffeeName: 'Yirg', coffeeRoaster: 'R', grinderModel: 'G' } } };  // no profile
  const realKey = recentGroupKey({ workflow: { context: { coffeeName: 'Yirg', coffeeRoaster: 'R', grinderModel: 'G' }, profile: { title: 'Londinium' } } });
  const tail = [{ id: 's9', key: realKey, rating: 0.9 }, { id: 's8', key: realKey, rating: 0.7 }];
  assert.notEqual(pageKey(recent), realKey, 'recomputing from a profile-less workflow misses the group');
  assert.equal(favouriteGroupKey(recent, tail), realKey, 'the row found by sourceShotId supplies it');
  const other = { id: 'f0', capturedAt: '2026-01-02' };
  assert.deepEqual(sortByMeanRating([other, recent], tail, (f) => favouriteGroupKey(f, tail), (t) => t.key).map((x) => x.id),
    ['recent:s9', 'f0'], 'so the rated recent outranks an unrated favourite');
  // No sourceShotId, or a shot that has aged out of the tail: fall back to recomputing.
  assert.equal(favouriteGroupKey({ sourceShotId: 'gone', workflow: { context: { coffeeName: 'Yirg', coffeeRoaster: 'R', grinderModel: 'G' }, profile: { title: 'Londinium' } } }, tail), realKey);
  assert.equal(favouriteGroupKey({ capturedAt: 'x' }, tail), null);
}
console.log('rating-sort ok');
