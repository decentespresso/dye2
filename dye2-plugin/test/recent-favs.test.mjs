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
  rankGroups,
  foldShot,
  pruneTail,
  allocateRecipeSlot,
  toSuggestedRecipe,
  noteShotUpdated,
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

// --- toRecentFavourite RPM precedence (issue #15) ----------------------------------

{
  // annotations.extras.rpm (an Edit Shot correction) wins over the pre-shot
  // workflow.context.extras.rpm, same precedence as shotBasketRpm() in recorded-shot.ts.
  const shot = makeShot('rpm-1', 't1');
  shot.workflow.context.extras = { rpm: 600 };
  shot.annotations = { extras: { rpm: 900 } };
  const fav = toRecentFavourite(shot, 0);
  assert.equal(fav.workflow.context.extras.rpm, 900, 'corrected RPM wins in the workflow to apply');
  assert.equal(fav.snapshot.rpm, 900, 'corrected RPM wins in the snapshot too');
}

{
  // No annotation correction: falls back to the pre-shot workflow.context.extras.rpm.
  const shot = makeShot('rpm-2', 't1');
  shot.workflow.context.extras = { rpm: 600 };
  const fav = toRecentFavourite(shot, 0);
  assert.equal(fav.workflow.context.extras.rpm, 600);
  assert.equal(fav.snapshot.rpm, 600);
}

{
  // No extras anywhere: legacy workflow.grinderData.rpm is the last resort.
  const shot = makeShot('rpm-3', 't1');
  shot.workflow.grinderData = { rpm: 450 };
  const fav = toRecentFavourite(shot, 0);
  assert.equal(fav.workflow.context.extras.rpm, 450);
  assert.equal(fav.snapshot.rpm, 450);
}

{
  // No RPM anywhere: omitted from the workflow to apply, null in the snapshot.
  const shot = makeShot('rpm-4', 't1');
  const fav = toRecentFavourite(shot, 0);
  assert.equal('extras' in fav.workflow.context, false);
  assert.equal(fav.snapshot.rpm, null);
}

console.log('ok   toRecentFavourite: RPM prefers an Edit Shot correction over the pre-shot value (issue #15)');

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

// --- rankGroups -------------------------------------------------------------------------------

const DAY = 86400000;
const NOW = Date.parse('2026-06-01T12:00:00Z');
const t = (id, key, daysAgo, rating = null) => ({ id, key, ts: NOW - daysAgo * DAY, rating });
const many = (prefix, key, n, daysAgo, rating = null) => Array.from({ length: n }, (_, i) => t(prefix + i, key, daysAgo, rating));

{
  // The month rule: six unrated shots a month old beat a one-off this week, but lose to a
  // well-rated group pulled this week.
  const tail = [
    ...many('old', 'six-stale', 6, 30),
    t('one', 'one-off', 0),
    ...many('good', 'rated-fresh', 3, 1, 0.9),
  ];
  const order = rankGroups(tail, NOW).map((r) => r.key);
  assert.deepEqual(order, ['rated-fresh', 'six-stale', 'one-off']);
}

{
  // Rated vs unrated: same recency, a high rating outranks the prior, a low one falls below it.
  const tail = [t('a', 'loved', 1, 1), t('b', 'unrated', 1), t('c', 'hated', 1, 0)];
  assert.deepEqual(rankGroups(tail, NOW).map((r) => r.key), ['loved', 'unrated', 'hated']);
  const s = Object.fromEntries(rankGroups(tail, NOW).map((r) => [r.key, r.score]));
  const w = Math.pow(0.5, 1 / 15);
  assert.ok(Math.abs(s.unrated - 0.6 * w / (w + 1)) < 1e-12, 'unrated scores at the prior');
}

{
  // Stale cutoff: newest shot older than 60 days is dropped; 59 days stays.
  const tail = [t('a', 'stale', 61), t('b', 'edge', 59), t('c', 'stale', 90)];
  assert.deepEqual(rankGroups(tail, NOW).map((r) => r.key), ['edge']);
}

{
  // Monotonic: more shots, better rating, or a newer shot never lowers the score.
  const score = (tail) => rankGroups(tail, NOW)[0].score;
  assert.ok(score([t('a', 'k', 1), t('b', 'k', 2)]) > score([t('a', 'k', 1)]), 'more shots');
  assert.ok(score([t('a', 'k', 1, 0.8)]) > score([t('a', 'k', 1, 0.7)]), 'better rating');
  assert.ok(score([t('a', 'k', 1, 0.8)]) > score([t('a', 'k', 10, 0.8)]), 'newer shot');
}

{
  // Ties: same score and same newest shot -> key ascending; stable under input order.
  const a = [t('1', 'b', 2), t('2', 'a', 2), t('3', 'c', 2)];
  const order = (x) => rankGroups(x, NOW).map((r) => r.key);
  assert.deepEqual(order(a), ['a', 'b', 'c']);
  assert.deepEqual(order(a.slice().reverse()), ['a', 'b', 'c']);
}

console.log('ok   rankGroups: month rule, rated vs unrated, stale cutoff, monotonic, tie-break');

// --- allocateRecipeSlot / toSuggestedRecipe -----------------------------------------------------

{
  const row = (id, extra) => ({ id, ...extra });
  assert.deepEqual(allocateRecipeSlot([]), { slot: '1' });
  assert.deepEqual(allocateRecipeSlot([row('1'), row('3')]), { slot: '2' }, 'lowest free');
  assert.deepEqual(allocateRecipeSlot([row('1', { suggested: true })]), { slot: '1' }, 'a suggested row is free');
  assert.deepEqual(allocateRecipeSlot([row('uuid-stray')]), { slot: '1' }, 'strays do not occupy a slot');
  const full = ['1', '2', '3', '4', '5'].map((id) => row(id));
  assert.deepEqual(allocateRecipeSlot(full), { taken: ['1', '2', '3', '4', '5'] }, 'full -> caller 409s');
  assert.deepEqual(allocateRecipeSlot(full, 4), { slot: '4' }, 'explicit slot honoured (overwrites)');
  assert.deepEqual(allocateRecipeSlot(full, 9), { taken: ['1', '2', '3', '4', '5'] }, 'out-of-range slot ignored');

  const fav = toRecentFavourite(makeShot('s1', '2026-05-30T00:00:00Z'), 1);
  const r = toSuggestedRecipe(fav, '2');
  assert.equal(r.id, '2');
  assert.equal(r.suggested, true);
  assert.equal(r.dashboardVariables.dose, 18);
  assert.deepEqual(r.workflow, fav.workflow);
}

console.log('ok   allocateRecipeSlot / toSuggestedRecipe');

// --- foldShot / pruneTail ------------------------------------------------------------------------

{
  const idx = { tail: [] };
  const a = makeShot('a', '2026-05-30T00:00:00Z');
  a.annotations = { enjoyment: 5 };
  foldShot(idx, a);
  assert.equal(idx.tail[0].rating, 0.5, 'enjoyment 0..10 -> 0..1');
  a.annotations = { enjoyment: 9 };
  foldShot(idx, a);
  assert.equal(idx.tail.length, 1, 'same id replaces');
  assert.equal(idx.tail[0].rating, 0.9, 'rating patch');
  foldShot(idx, makeShot('x', '2026-05-30T00:00:00Z', { profile: { beverage_type: 'cleaning' } }));
  const ab = makeShot('ab', '2026-05-30T00:00:00Z'); ab.stopReason = 'error';
  foldShot(idx, ab);
  assert.equal(idx.tail.length, 1, 'cleaning and aborted shots never count');
  const ok = makeShot('ok', '2026-05-30T00:00:00Z'); ok.stopReason = 'someFutureReason';
  foldShot(idx, ok);
  assert.equal(idx.tail.length, 2, 'an unknown stopReason is tolerated');
  pruneTail(idx, Date.parse('2026-06-01T00:00:00Z'), new Set(['ok']));
  assert.deepEqual(idx.tail.map((x) => x.id), ['ok'], 'prune drops ids the bridge no longer lists');
  pruneTail(idx, Date.parse('2027-06-01T00:00:00Z'));
  assert.equal(idx.tail.length, 0, 'prune drops rows past TAIL_DAYS');
}

console.log('ok   foldShot / pruneTail');

// --- refreshRecentFavourites (index + strips) ---------------------------------------------------

const BASE = 'http://localhost:8080/api/v1';
const recent = (days) => new Date(Date.now() - days * DAY).toISOString();

// A fake bridge: shots (newest first), a KV map, and a log of every call.
function makeBridge(shots, kv) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const method = (init && init.method) || 'GET';
    calls.push(method + ' ' + url.replace(BASE, ''));
    const ok = (v) => ({ ok: true, status: 200, json: async () => v });
    if (url.indexOf('/shots?') >= 0) {
      const q = new URL(url).searchParams;
      const off = Number(q.get('offset')) || 0, lim = Number(q.get('limit'));
      return ok({ items: shots.slice(off, off + lim), total: shots.length });
    }
    if (url.endsWith('/shots/ids')) return ok(shots.map((s) => s.id));
    const one = url.match(/\/shots\/([^/?]+)$/);
    if (one) return ok(shots.find((s) => s.id === decodeURIComponent(one[1])));
    const k = url.match(/\/store\/dye2\.reaplugin\/(\w+)$/);
    if (k) {
      if (method === 'POST') { kv[k[1]] = JSON.parse(init.body); return ok({}); }
      return ok(k[1] in kv ? kv[k[1]] : null);
    }
    throw new Error('Unexpected URL: ' + url);
  };
  return { fetchFn, calls };
}
const shotAt = (id, days, bean, extra) => makeShot(id, recent(days), { context: { beanBatchId: bean }, ...(extra || {}) });
const scans = (calls) => calls.filter((c) => c.indexOf('/shots?limit=100') >= 0).length;

{
  // Full build, saved favourites untouched, autos first, suggested recipes only in free slots.
  const shots = [shotAt('s3', 1, 'B'), shotAt('s2', 2, 'A'), shotAt('s1', 3, 'A')];
  const kv = {
    autoFavourites: [
      { id: 'recent:old', auto: true, recentRank: 1, title: 'Stale' },
      { id: 'saved-1', title: 'My Favourite', favSlot: 2 },
    ],
    recipes: [
      { id: '1', name: 'Mine' },
      { id: '4', name: 'Also mine' },
      { id: '2', suggested: true, name: 'old suggestion' },
      { id: 'stray-uuid', name: 'stray' },
    ],
  };
  const { fetchFn } = makeBridge(shots, kv);
  const autos = await refreshRecentFavourites(fetchFn, BASE);

  assert.deepEqual(autos.map((a) => a.sourceShotId), ['s2', 's3'], 'group A (2 shots) outranks group B (1)');
  assert.equal(kv.autoFavourites[0].id, 'recent:s2', 'autos first');
  assert.deepEqual(kv.autoFavourites.at(-1), { id: 'saved-1', title: 'My Favourite', favSlot: 2 }, 'saved passes through');
  assert.equal(kv.autoFavourites.some((a) => a.id === 'recent:old'), false, 'stale auto replaced');

  const byId = Object.fromEntries(kv.recipes.map((r) => [r.id, r]));
  assert.equal(byId['1'].name, 'Mine'); assert.equal(byId['4'].name, 'Also mine');
  assert.ok(!byId['1'].suggested && !byId['4'].suggested, 'real recipes are never touched');
  assert.equal(byId['stray-uuid'].name, 'stray');
  assert.equal(byId['2'], undefined, 'old suggestion dropped; only 2 groups, both on the F strip, so none suggested');
  assert.equal(byId['3'], undefined);
  assert.equal(kv.shotIndex.v, 1);
  assert.equal(kv.shotIndex.total, 3);
}

{
  // Cached: nothing changed -> one probe, no scanning, no re-write of the index.
  const shots = [shotAt('s2', 1, 'B'), shotAt('s1', 2, 'A')];
  const kv = {};
  const first = makeBridge(shots, kv);
  await refreshRecentFavourites(first.fetchFn, BASE);
  assert.equal(scans(first.calls), 1, 'full build pages once for a small history');
  const second = makeBridge(shots, kv);
  await refreshRecentFavourites(second.fetchFn, BASE);
  assert.equal(scans(second.calls), 0, 'unchanged history: no scanning at all');
  assert.equal(second.calls.filter((c) => c.indexOf('POST /store/dye2.reaplugin/shotIndex') >= 0).length, 0, 'index not rewritten');

  // Delta: a new shot is folded in without a full re-scan; deletes are pruned via /shots/ids.
  shots.unshift(shotAt('s3', 0, 'C'));
  const third = makeBridge(shots, kv);
  const autos = await refreshRecentFavourites(third.fetchFn, BASE);
  assert.ok(autos.some((a) => a.sourceShotId === 's3'));
  assert.equal(third.calls.some((c) => c.indexOf('/shots/ids') >= 0), false, 'a pure add never reconciles');
  assert.equal(kv.shotIndex.tail.length, 3);

  shots.splice(0, 1);   // delete s3
  const fourth = makeBridge(shots, kv);
  const after = await refreshRecentFavourites(fourth.fetchFn, BASE);
  assert.ok(fourth.calls.some((c) => c.indexOf('/shots/ids') >= 0), 'a total mismatch reconciles against /shots/ids');
  assert.equal(after.some((a) => a.sourceShotId === 's3'), false, 'the deleted shot is pruned');
  assert.equal(kv.shotIndex.tail.length, 2);
}

{
  // A rating edit (shotUpdated) re-ranks without a rescan: it folds into the tail.
  const A = [shotAt('a1', 1, 'A'), shotAt('a2', 2, 'A')];
  const B = [shotAt('b1', 1.5, 'B'), shotAt('b2', 2.5, 'B')];
  const shots = [A[0], B[0], A[1], B[1]];
  const kv = {};
  await refreshRecentFavourites(makeBridge(shots, kv).fetchFn, BASE);
  const before = kv.autoFavourites.filter((a) => a.auto).map((a) => a.sourceShotId);
  const edited = { ...B[0], annotations: { enjoyment: 10 } };
  noteShotUpdated(edited);
  const bridge = makeBridge(shots, kv);
  await refreshRecentFavourites(bridge.fetchFn, BASE);
  assert.equal(scans(bridge.calls), 0, 'no rescan for a rating edit');
  const afterIds = kv.autoFavourites.filter((a) => a.auto).map((a) => a.sourceShotId);
  assert.deepEqual(afterIds, ['b1', 'a1']);
  assert.notDeepEqual(before, afterIds, 'the rating moved B above A');
}

{
  // Suggestions never repeat an F-strip group: 7 groups (2 shots each) -> F gets 5, R gets ranks 6-7
  // in the free slots; an unqualified group (one shot) is never suggested.
  const shots = [];
  for (let g = 0; g < 7; g++) { shots.push(shotAt('g' + g + 'a', 1 + g * 0.1, 'G' + g)); shots.push(shotAt('g' + g + 'b', 2 + g * 0.1, 'G' + g)); }
  shots.push(shotAt('lone', 0.5, 'LONE'));
  shots.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const kv = { recipes: [{ id: '1', name: 'Mine' }] };
  await refreshRecentFavourites(makeBridge(shots, kv).fetchFn, BASE);
  const sug = kv.recipes.filter((r) => r.suggested);
  assert.equal(sug.length, 2, 'ranks 6 and 7 qualify; "lone" has one shot');
  assert.deepEqual(sug.map((r) => r.id), ['2', '3']);
  const fBeans = new Set(kv.autoFavourites.filter((a) => a.auto).map((a) => a.workflow.context.beanBatchId));
  sug.forEach((r) => assert.equal(fBeans.has(r.workflow.context.beanBatchId), false, 'an F-strip group is never suggested'));
}

{
  // Accepted (flag dropped) rows are real recipes: the next run keeps them.
  const shots = [];
  for (let g = 0; g < 6; g++) { shots.push(shotAt('g' + g + 'a', 1 + g * 0.1, 'G' + g)); shots.push(shotAt('g' + g + 'b', 2 + g * 0.1, 'G' + g)); }
  shots.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const kv = { recipes: [] };
  await refreshRecentFavourites(makeBridge(shots, kv).fetchFn, BASE);
  assert.equal(kv.recipes[0].suggested, true);
  const name = kv.recipes[0].name;
  delete kv.recipes[0].suggested;
  shots.unshift(shotAt('s2', 0, 'Z'));
  await refreshRecentFavourites(makeBridge(shots, kv).fetchFn, BASE);
  const kept = kv.recipes.find((r) => r.id === '1');
  assert.equal(kept.suggested, undefined, 'an accepted suggestion is kept as is');
  assert.equal(kept.name, name);
}

console.log('ok   refreshRecentFavourites: full build, cached startup, delta, prune, rating patch, suggested rows');

// Overlap: two calls made back to back coalesce into the in-flight run, then a rerun
// picks up a shot stored in between — the last write reflects the latest shots.
{
  let shots = [shotAt('o1', 1, 'X')];
  const kv = {};
  const puts = [];
  const inner = makeBridge(shots, kv).fetchFn;
  const fetchFn = async (url, init) => {
    if (url.indexOf('/shots') >= 0 && url.indexOf('/store/') < 0) return makeBridge(shots.slice(), kv).fetchFn(url, init);
    if (init && init.method === 'POST' && url.endsWith('/autoFavourites')) puts.push(JSON.parse(init.body));
    return inner(url, init);
  };
  const p1 = refreshRecentFavourites(fetchFn, BASE);
  const p2 = refreshRecentFavourites(fetchFn, BASE);
  assert.equal(p1, p2, 'a call made while one is in flight gets the SAME in-flight promise back');
  shots = [shotAt('o2', 0, 'X'), ...shots];
  await p1;
  for (let i = 0; i < 200 && puts.length < 2; i++) await new Promise((r) => setTimeout(r, 2));
  assert.equal(puts.length, 2, 'the coalesced call plus exactly one rerun — never more');
  assert.equal(puts[1].filter((f) => f.auto)[0].sourceShotId, 'o2', 'the rerun reflects the shot stored mid-refresh');
}

console.log('ok   refreshRecentFavourites: overlapping calls coalesce, rerun reflects the latest shots');
