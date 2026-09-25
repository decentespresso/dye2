/**
 * Recent auto-favourites — computed from shot history, not saved by hand.
 * Run: npm test   (node --experimental-strip-types, so the .ts import works)
 *
 * Unlike the browser-side utils (dev-api.ts, bc-map.ts, ...), recent-favs.ts is real
 * TypeScript that runs in the PLUGIN runtime, so it is imported directly here rather
 * than evaluated as a script string.
 */
import assert from 'node:assert/strict';
import {
  recentGroupKey,
  pickRecentShots,
  toRecentFavourite,
  isExecutableRecordedProfile,
  applyTitleDisambiguation,
  assignSlots,
  refreshRecentFavourites,
} from '../src/utils/recent-favs.ts';

function makeShot(id, timestamp, overrides) {
  overrides = overrides || {};
  const context = Object.assign({
    beanBatchId: 'batch-' + id,
    coffeeName: 'Coffee ' + id,
    coffeeRoaster: 'Roaster',
    grinderId: 'grinder-1',
    grinderModel: 'EG1',
    grinderSetting: '4.2',
    targetDoseWeight: 18,
    targetYield: 36,
  }, overrides.context || {});
  // Executable by default (PUT /workflow's Profile.fromJson requirement — see
  // isExecutableRecordedProfile) so tests that don't care about this get a profile
  // attached, same as a normally-run shot.
  const profile = Object.assign({
    title: 'Profile A', steps: [{ name: 'step-1' }],
    tank_temperature: 90, target_volume_count_start: 0,
  }, overrides.profile || {});
  return { id: id, timestamp: timestamp, workflow: { context: context, profile: profile } };
}

// --- recentGroupKey ------------------------------------------------------------

{
  const a = makeShot('z', 't1');
  const b = makeShot('b', 't2', { context: { beanBatchId: '  BATCH-A  ' } });
  const c = makeShot('c', 't3', { context: { beanBatchId: 'batch-a' } });
  assert.equal(recentGroupKey(b), recentGroupKey(c), 'trim + lowercase makes these the same batch');
  assert.notEqual(recentGroupKey(a), recentGroupKey(b), 'a different batch id is a different group');
}

{
  const base = makeShot('x', 't1');
  const diffProfile = makeShot('x', 't1', { profile: { title: 'Profile B' } });
  const diffGrinderId = makeShot('x', 't1', { context: { grinderId: 'grinder-2' } });
  // Same model text, but no grinderId this time — must NOT collide with the grinderId-based key.
  const modelOnly = makeShot('x', 't1', { context: { grinderId: null, grinderModel: 'EG1' } });
  assert.notEqual(recentGroupKey(base), recentGroupKey(diffProfile), 'different profile title -> new group');
  assert.notEqual(recentGroupKey(base), recentGroupKey(diffGrinderId), 'different grinderId -> new group');
  assert.notEqual(recentGroupKey(base), recentGroupKey(modelOnly), 'grinderModel-without-id never collides with a grinderId-keyed group');
}

{
  const noBatchA = makeShot('n1', 't1', { context: { beanBatchId: null, coffeeRoaster: 'Square Mile', coffeeName: 'Yirgacheffe' } });
  const noBatchB = makeShot('n2', 't2', { context: { beanBatchId: null, coffeeRoaster: '  square mile ', coffeeName: 'YIRGACHEFFE' } });
  const noBatchOther = makeShot('n3', 't3', { context: { beanBatchId: null, coffeeRoaster: 'Other Roaster', coffeeName: 'Yirgacheffe' } });
  assert.equal(recentGroupKey(noBatchA), recentGroupKey(noBatchB), 'no batch id -> groups by roaster+name, case/whitespace-insensitive');
  assert.notEqual(recentGroupKey(noBatchA), recentGroupKey(noBatchOther), 'a different roaster is a different group with no batch id');
}

{
  const cleaning = makeShot('cl', 't1', { profile: { beverage_type: 'cleaning' } });
  const calibrate = makeShot('ca', 't1', { profile: { beverage_type: 'calibrate' } });
  const noBean = makeShot('nb', 't1', { context: { beanBatchId: null, coffeeName: null } });
  assert.equal(recentGroupKey(cleaning), null, 'a cleaning run is skipped');
  assert.equal(recentGroupKey(calibrate), null, 'a calibrate run is skipped');
  assert.equal(recentGroupKey(noBean), null, 'a shot with no bean identity at all is skipped');
}

console.log('ok   recentGroupKey: trim/lowercase, id-vs-name splits, skip rules');

// --- pickRecentShots -------------------------------------------------------------

// Order by the group's newest shot, newest first — even when an older group has more shots.
{
  const b5 = makeShot('b5', 't5', { context: { beanBatchId: 'B' } });   // group B, newest overall
  const a4 = makeShot('a4', 't4', { context: { beanBatchId: 'A' } });
  const a3 = makeShot('a3', 't3', { context: { beanBatchId: 'A' } });
  const a2 = makeShot('a2', 't2', { context: { beanBatchId: 'A' } });   // group A has 3 shots, group B has 1
  const b1 = makeShot('b1', 't1', { context: { beanBatchId: 'B' } });
  const items = [b5, a4, a3, a2, b1];   // newest-first, as the bridge returns it
  const getPage = async (offset) => (offset === 0 ? { items, total: items.length } : { items: [], total: items.length });
  const picked = await pickRecentShots(getPage, 5, 5);
  assert.deepEqual(picked.map((s) => s.id), ['b5', 'a4'], "group B's newest shot ranks before group A's, despite A having more shots");
}

// Paging: exactly one shots request when the first page already has 5 groups.
{
  let calls = 0;
  const items = Array.from({ length: 250 }, (_, i) => makeShot('s' + i, 't' + (250 - i), { context: { beanBatchId: 'group-' + (i % 5) } }));
  const getPage = async (offset) => { calls++; return offset === 0 ? { items, total: 250 } : { items: [], total: 250 }; };
  const picked = await pickRecentShots(getPage, 5, 5);
  assert.equal(picked.length, 5, 'found all 5 distinct groups');
  assert.equal(calls, 1, 'stopped after the first page once 5 groups were found');
}

// Paging: stops at 5 pages when 5 groups never turn up.
{
  let calls = 0;
  const getPage = async () => {
    calls++;
    // Every page is a single cleaning run — never contributes a group.
    return { items: [makeShot('c' + calls, 't' + calls, { profile: { beverage_type: 'cleaning' } })], total: 999 };
  };
  const picked = await pickRecentShots(getPage, 5, 5);
  assert.deepEqual(picked, [], 'no group ever qualified');
  assert.equal(calls, 5, 'gave up after maxPages, not before');
}

// Paging: an empty first page is an empty result, not an error.
{
  const getPage = async () => ({ items: [], total: 0 });
  const picked = await pickRecentShots(getPage, 5, 5);
  assert.deepEqual(picked, []);
}

console.log('ok   pickRecentShots: newest-group-first ordering, page/group caps, empty history');

// --- toRecentFavourite -------------------------------------------------------------

{
  const shot = makeShot('rep', 't9', {
    context: {
      grinderId: null, grinderModel: null, beanBatchId: null,
      targetYield: null, // omitted, not sent as null (host rejects that)
      grinderSetting: '3.0', targetDoseWeight: 18,
    },
  });
  // annotations would carry ACTUALS on a real shot; toRecentFavourite must ignore them
  // and use the workflow context's TARGET dose/yield instead (first-gen target values).
  shot.annotations = { actualDoseWeight: 99, actualYield: 99 };
  const fav = toRecentFavourite(shot, 3);

  assert.equal(fav.id, 'recent:rep');
  assert.equal(fav.auto, true);
  assert.equal(fav.recentRank, 3);
  assert.equal(fav.sourceShotId, 'rep');
  assert.equal(fav.capturedAt, 't9');
  assert.deepEqual(fav.workflow.profile, shot.workflow.profile, 'the full recorded profile, not a {id,title} reference');

  assert.equal(fav.workflow.context.grinderId, null, 'missing grinderId is an explicit null, not omitted');
  assert.equal(fav.workflow.context.beanBatchId, null, 'missing beanBatchId is an explicit null, not omitted');
  assert.equal('targetYield' in fav.workflow.context, false, 'a target the shot never had is omitted, not sent as null');
  assert.equal(fav.workflow.context.targetDoseWeight, 18, 'dose is the shot TARGET, not annotations.actualDoseWeight');
  assert.equal(fav.snapshot.drink, null, 'snapshot mirrors the same target-only rule');
  assert.equal(fav.snapshot.dose, 18);

  assert.deepEqual(fav.copyMask, {
    profile: true, beans: true, grinder: true, grindSetting: true, dose: true, drink: true,
    roastDate: false, basket: false, equipment: false, barista: false, drinker: false, note: false,
  });
}

console.log('ok   toRecentFavourite: target values, explicit nulls, omitted-when-absent, full profile');

// --- isExecutableRecordedProfile / toRecentFavourite profile omission -------------------------------------------------------------

{
  const full = { title: 'D-Flow', steps: [{ name: 's1' }], tank_temperature: 90, target_volume_count_start: 0 };
  assert.equal(isExecutableRecordedProfile(full), true);
  assert.equal(isExecutableRecordedProfile(null), false);
  assert.equal(isExecutableRecordedProfile({ ...full, title: '' }), false, 'empty title fails PUT /workflow');
  assert.equal(isExecutableRecordedProfile({ ...full, title: '   ' }), false, 'whitespace-only title fails PUT /workflow');
  assert.equal(isExecutableRecordedProfile({ ...full, steps: [] }), false, 'empty steps array fails PUT /workflow');
  assert.equal(isExecutableRecordedProfile({ ...full, steps: undefined }), false, 'missing steps fails PUT /workflow');
  assert.equal(isExecutableRecordedProfile({ ...full, tank_temperature: null }), false);
  assert.equal(isExecutableRecordedProfile({ ...full, target_volume_count_start: null }), false);
  // target_volume_count_start: 0 is a valid value, not "missing" — must not be treated as falsy.
  assert.equal(isExecutableRecordedProfile({ ...full, target_volume_count_start: 0 }), true);
}

{
  // An imported shot can carry an incomplete recorded profile (missing the fields
  // PUT /workflow's Profile.fromJson requires). Attaching it anyway would fail the
  // WHOLE apply PUT, context included — see doc-cited profile.dart:59-71.
  const shot = makeShot('incomplete', 't1', { profile: { steps: [] } });
  const fav = toRecentFavourite(shot, 1);
  assert.equal('profile' in fav.workflow, false, 'an unexecutable recorded profile is omitted, not attached');
  assert.ok(fav.workflow.context, 'context is still present — only profile is dropped');
}

console.log('ok   isExecutableRecordedProfile: PUT /workflow\'s Profile.fromJson requirements, profile omitted when unmet');

// --- applyTitleDisambiguation -------------------------------------------------------------

{
  const shotA = makeShot('ta', 't2', { context: { beanBatchId: 'same', coffeeName: 'Same Coffee' }, profile: { title: 'Alpha' } });
  const shotB = makeShot('tb', 't1', { context: { beanBatchId: 'same2', coffeeName: 'Same Coffee' }, profile: { title: 'Beta' } });
  const recents = applyTitleDisambiguation([toRecentFavourite(shotA, 1), toRecentFavourite(shotB, 2)]);
  assert.equal(recents[0].title, 'Same Coffee · Alpha');
  assert.equal(recents[1].title, 'Same Coffee · Beta');
}

{
  // Same bean AND same profile title (only the grinder differs) — profile-title alone
  // doesn't break the tie, so the grinder model gets appended too.
  const shotA = makeShot('ga', 't2', { context: { beanBatchId: 'same', coffeeName: 'Same Coffee', grinderId: null, grinderModel: 'P64' } });
  const shotB = makeShot('gb', 't1', { context: { beanBatchId: 'same2', coffeeName: 'Same Coffee', grinderId: null, grinderModel: 'EG1' } });
  const recents = applyTitleDisambiguation([toRecentFavourite(shotA, 1), toRecentFavourite(shotB, 2)]);
  assert.equal(recents[0].title, 'Same Coffee · Profile A · P64');
  assert.equal(recents[1].title, 'Same Coffee · Profile A · EG1');
}

console.log('ok   applyTitleDisambiguation: profile title then grinder model, only where titles collide');

// --- assignSlots -------------------------------------------------------------

{
  const recents = [1, 2, 3, 4, 5].map((n) => ({ id: 'recent:' + n, recentRank: n }));
  const saved = [
    { id: 'saved-1', favSlot: 1, alwaysOnDashboard: true },
    { id: 'saved-3', favSlot: 3, alwaysOnDashboard: true },
    { id: 'saved-off', favSlot: 2, alwaysOnDashboard: false },   // opted out — claims nothing
  ];
  const placed = assignSlots(recents, saved);
  assert.deepEqual(placed.map((r) => r.favSlot), [2, 4, 5, null, null], 'recents fill the free slots in rank order, then run out');
  assert.deepEqual(placed.map((r) => r.alwaysOnDashboard), [true, true, true, false, false]);
}

console.log('ok   assignSlots: saved claims win, alwaysOnDashboard:false claims nothing, overflow gets no slot');

// --- refreshRecentFavourites -------------------------------------------------------------

function makeFetch(getShotsPage, store, calls) {
  return async (url, init) => {
    if (calls) calls.push({ url: url, method: (init && init.method) || 'GET' });
    if (url.indexOf('/shots?') >= 0) {
      const offset = Number(new URL(url).searchParams.get('offset')) || 0;
      const page = getShotsPage(offset);
      return { ok: true, status: 200, json: async () => page };
    }
    if (url.endsWith('/store/dye2.reaplugin/autoFavourites')) {
      if (init && init.method === 'POST') {
        store.value = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => store.value };
    }
    throw new Error('Unexpected URL: ' + url);
  };
}

// Store write shape: saved favourites pass through untouched, a stale auto entry is
// replaced (not appended to), and the array is autos-then-saved.
{
  const shot = makeShot('w1', 't1');
  const store = { value: [
    { id: 'recent:old', auto: true, recentRank: 1, title: 'Stale' },
    { id: 'saved-1', title: 'My Favourite', favSlot: 2 },
    { id: 'saved-2', title: 'Another', alwaysOnDashboard: false },
  ] };
  const fetchFn = makeFetch((offset) => (offset === 0 ? { items: [shot], total: 1 } : { items: [], total: 1 }), store);
  const autos = await refreshRecentFavourites(fetchFn, 'http://localhost:8080/api/v1');

  assert.equal(autos.length, 1);
  assert.equal(autos[0].sourceShotId, 'w1');

  const written = store.value;
  assert.equal(written.length, 3, 'one new recent + the two saved favourites — the stale recent is gone');
  assert.equal(written[0].id, 'recent:w1', 'autos come first');
  assert.deepEqual(written[1], { id: 'saved-1', title: 'My Favourite', favSlot: 2 }, 'a saved favourite is passed through untouched');
  assert.deepEqual(written[2], { id: 'saved-2', title: 'Another', alwaysOnDashboard: false });
}

console.log('ok   refreshRecentFavourites: replaces old autos, leaves saved favourites untouched, autos-then-saved');

// Overlap: two calls made back to back coalesce into the in-flight run, then a rerun
// (triggered by the second caller's flag) picks up a shot stored in between — so the
// last write reflects the latest shots, and at most two runs ever happen.
{
  let shotsSource = [makeShot('o1', 't1', { context: { beanBatchId: 'X' } })];
  const store = { value: [] };
  const puts = [];
  const fetchFn = async (url, init) => {
    if (url.indexOf('/shots?') >= 0) {
      const snapshot = shotsSource;   // captured synchronously — a later reassignment of
                                      // shotsSource must not leak into an already-started run
      return { ok: true, status: 200, json: async () => ({ items: snapshot, total: snapshot.length }) };
    }
    if (url.endsWith('/store/dye2.reaplugin/autoFavourites')) {
      if (init && init.method === 'POST') {
        store.value = JSON.parse(init.body);
        puts.push(store.value);
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => store.value };
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const p1 = refreshRecentFavourites(fetchFn, 'http://localhost:8080/api/v1');
  const p2 = refreshRecentFavourites(fetchFn, 'http://localhost:8080/api/v1');
  assert.equal(p1, p2, 'a call made while one is in flight gets the SAME in-flight promise back');

  // A shot lands mid-refresh — group X's representative moves to the newer shot.
  shotsSource = [makeShot('o2', 't2', { context: { beanBatchId: 'X' } })];

  await p1;
  for (let i = 0; i < 200 && puts.length < 2; i++) await new Promise((r) => setTimeout(r, 2));

  assert.equal(puts.length, 2, 'the coalesced call plus exactly one rerun — never more');
  const lastRecents = puts[puts.length - 1].filter((f) => f.auto);
  assert.equal(lastRecents[0].sourceShotId, 'o2', 'the rerun (last write) reflects the shot stored mid-refresh');
}

console.log('ok   refreshRecentFavourites: overlapping calls coalesce, rerun reflects the latest shots');
