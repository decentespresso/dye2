/**
 * One runnable check for dashboard shot paging + the Same Beans filter.
 * Run: npm test   (node --experimental-strip-types, so the .ts import works)
 */
import assert from 'node:assert/strict';
import { shotPagingScript } from '../src/utils/shot-paging.ts';

// A fake bridge: 120 shots, newest first, two coffees, one name shared by two roasters.
const store = Array.from({ length: 120 }, (_, i) => ({
  id: 'shot-' + i,
  coffeeName: i % 2 === 0 ? 'Red Brick' : 'Nightshift',
  coffeeRoaster: i % 4 === 0 ? 'Square Mile' : 'Other Roaster',
}));

const calls = [];
let failNextGetShots = false;
let delayNextGetShots = 0;   // ms, consumed by the next call: forces which page lands first
function makeEnv() {
  calls.length = 0;
  failNextGetShots = false;
  delayNextGetShots = 0;
  const getShots = async (opts) => {
    calls.push(opts);
    const wait = delayNextGetShots; delayNextGetShots = 0;
    if (wait) await new Promise(r => setTimeout(r, wait));
    // fetchShotPage swallows a rejection into an empty page, which is what we want to simulate.
    if (failNextGetShots) { failNextGetShots = false; return null; }
    let items = store;
    if (opts.coffeeName) items = items.filter(s => s.coffeeName === opts.coffeeName);
    if (opts.coffeeRoaster) items = items.filter(s => s.coffeeRoaster === opts.coffeeRoaster);
    const total = items.length;
    return { items: items.slice(opts.offset, opts.offset + opts.limit), total, limit: opts.limit, offset: opts.offset };
  };
  return new Function('getShots', shotPagingScript +
    '\nreturn { loadShots, loadMoreShots, stepToOlderShot, seedLatestShot, ensureShotsPage, SHOT_PAGE, state: () => ({ shots, shotsTotal, currentShotIndex, shotFilter, shotsPageLoaded }) };'
  )(getShots);
}

// --- paging ------------------------------------------------------------------
let env = makeEnv();
// Derived from the page size rather than written out, so tuning SHOT_PAGE for the bridge's
// per-row cost does not mean editing assertions that are really about the paging mechanics.
const PAGE = env.SHOT_PAGE;
assert.ok(PAGE >= 1 && PAGE <= 100, 'the bridge clamps limit to 1..100');
await env.loadShots(null);
assert.equal(env.state().shots.length, PAGE, 'first load holds one page');
assert.equal(env.state().shotsTotal, 120, 'total comes from the bridge, not the page');
assert.deepEqual(calls[0], { limit: PAGE, offset: 0, order: 'desc' }, 'unfiltered first page');

for (let i = 0; i < PAGE - 1; i++) await env.stepToOlderShot();
assert.equal(env.state().currentShotIndex, PAGE - 1, 'walked to the end of the loaded page');
assert.equal(calls.length, 1, 'walking inside the page fetches nothing');

await env.stepToOlderShot();
assert.equal(env.state().shots.length, PAGE * 2, 'stepping off the end pulls the next page');
assert.equal(env.state().currentShotIndex, PAGE, 'and lands on the first shot of page two');
assert.equal(calls[1].offset, PAGE, 'the second request asks for the page after the first');

// Walk to the true end of history, then confirm it wraps rather than dead-ending.
while (env.state().currentShotIndex < 119) await env.stepToOlderShot();
assert.equal(env.state().shots.length, 120, 'the whole history is reachable');
const before = calls.length;
await env.stepToOlderShot();
assert.equal(env.state().currentShotIndex, 0, 'past the oldest shot it wraps to the newest');
assert.equal(calls.length, before, 'a fully loaded history never probes the bridge again');

// --- Same Beans --------------------------------------------------------------
env = makeEnv();
await env.loadShots({ coffeeName: 'Red Brick', coffeeRoaster: 'Square Mile' });
assert.equal(env.state().shotsTotal, 30, 'filtering on name AND roaster excludes the same name from another roaster');
assert.ok(env.state().shots.every(s => s.coffeeRoaster === 'Square Mile'), 'no other roaster leaks in');
assert.equal(env.state().currentShotIndex, 0, 'a new filter starts at its newest shot');
assert.equal(calls[0].coffeeName, 'Red Brick', 'the filter went to the bridge');

// The filter must survive paging, or page 2 quietly reverts to all shots.
while (env.state().shots.length < 30) await env.stepToOlderShot();
assert.ok(calls.slice(1).every(c => c.coffeeName === 'Red Brick'), 'later pages keep the filter');

await env.loadShots(null);
assert.equal(env.state().shotsTotal, 120, 'switching back to All Shots drops the filter');

console.log('ok   shot paging + same-beans filter');

// --- the query the bridge actually receives ----------------------------------
// The paging tests stub getShots, so serialization is checked here against the real one.
const { devApiScript } = await import('../src/utils/dev-api.ts');
const urls = [];
const realGetShots = new Function('fetch', devApiScript + '\nreturn getShots;')(
  async (url) => { urls.push(url); return { ok: true, json: async () => ({ items: [], total: 0 }) }; }
);

await realGetShots({ limit: 50, offset: 50, order: 'desc' });
assert.equal(urls[0], '/api/v1/shots?limit=50&offset=50&order=desc', 'offset reaches the bridge — without it page two repeats page one');

await realGetShots({ limit: 50, offset: 0, order: 'desc', coffeeName: 'Red Brick', coffeeRoaster: 'Square Mile' });
assert.equal(urls[1], '/api/v1/shots?limit=50&order=desc&coffeeName=Red+Brick&coffeeRoaster=Square+Mile', 'Same Beans filters server-side');

await realGetShots({ limit: 50, offset: 0, order: 'desc', search: 'yirgacheffe & co' });
assert.equal(urls[2], '/api/v1/shots?limit=50&order=desc&search=yirgacheffe+%26+co', 'search is passed through and escaped');

console.log('ok   getShots query serialization');


// --- the open seeds one shot and loads the page behind it (option 2) ------------------
{
  // The seed is what GET /shots/latest returns: one row, same shape as a list row.
  const latest = store[0];

  // 1. seeded state: one shot on screen, the real total already known, page not loaded
  let env = makeEnv();
  env.seedLatestShot(latest, 120);
  assert.equal(env.state().shots.length, 1, 'the seed holds exactly the newest shot');
  assert.equal(env.state().shotsTotal, 120, 'the total comes from the cheap count, not the page');
  assert.equal(env.state().shotsPageLoaded, false, 'and the real page is still outstanding');
  assert.equal(calls.length, 0, 'seeding asks the bridge for no page at all');

  // 2. the page replaces the seed and keeps the user on the same shot
  await env.ensureShotsPage();
  assert.equal(env.state().shots.length, env.SHOT_PAGE, 'the page replaces the seed');
  assert.equal(env.state().shotsTotal, 120, 'total still right');
  assert.equal(env.state().shotsPageLoaded, true, 'marked loaded');
  assert.equal(env.state().shots[env.state().currentShotIndex].id, latest.id,
    'still on the shot that was on screen');
  assert.equal(calls.length, 1, 'one page request');
  await env.ensureShotsPage();
  assert.equal(calls.length, 1, 'already loaded: no second request');

  // 3. single-flight: concurrent callers share one request
  env = makeEnv();
  env.seedLatestShot(latest, 120);
  await Promise.all([env.ensureShotsPage(), env.ensureShotsPage(), env.ensureShotsPage()]);
  assert.equal(calls.length, 1, 'three concurrent callers make one request');
  assert.equal(env.state().shots.length, env.SHOT_PAGE, 'and the page landed');

  // 4. THE one that matters: navigating off the seed loads the page first rather than
  //    refusing because shots.length is 1, or paging from offset 1 on top of the seed.
  env = makeEnv();
  env.seedLatestShot(latest, 120);
  assert.equal(await env.stepToOlderShot(), true, 'stepping off the seed works');
  assert.equal(calls[0].offset, 0, 'it loads page zero, not offset 1 on top of the seed');
  assert.equal(env.state().shots.length, env.SHOT_PAGE, 'a full page is loaded');
  assert.equal(env.state().currentShotIndex, 1, 'and it stepped to the second-newest shot');
  assert.equal(env.state().shots[1].id, store[1].id, 'which is the right shot');

  // 5. a filtered view is always a real page, so it is never re-fetched as a seed
  env = makeEnv();
  await env.loadShots({ coffeeName: 'Red Brick' });
  assert.equal(env.state().shotsPageLoaded, true, 'loadShots marks the page loaded');
  const after = calls.length;
  await env.ensureShotsPage();
  assert.equal(calls.length, after, 'ensureShotsPage does nothing after a filtered load');

  // 6. a transient bridge failure must not blank the panel while history exists
  env = makeEnv();
  env.seedLatestShot(latest, 120);
  failNextGetShots = true;
  await env.ensureShotsPage();
  assert.equal(env.state().shots.length, 1, 'the seed survives a failed page load');
  assert.equal(env.state().shotsPageLoaded, false, 'and stays unloaded so it retries');
  await env.ensureShotsPage();
  assert.equal(env.state().shots.length, env.SHOT_PAGE, 'the retry succeeds');
  assert.equal(env.state().shotsPageLoaded, true, 'and marks loaded');

  // 7. genuinely empty history: no seed, empty page, settled
  env = makeEnv();
  env.seedLatestShot(null, 0);
  assert.equal(env.state().shots.length, 0, 'no shots, no seed');
  await env.ensureShotsPage();
  assert.equal(env.state().shotsPageLoaded, true, 'an empty history still settles as loaded');

  // 8. The nav buttons are live before the open's reads land, so a seed can arrive after a tap
  //    already installed a real window. Rewinding it would leave currentShotIndex pointing at a
  //    different shot than the one on screen, and delete/star/upload all use that index.
  env = makeEnv();
  await env.loadShots(null);
  const walked = env.state().shots.length;
  await env.stepToOlderShot();
  assert.equal(env.state().currentShotIndex, 1, 'the user has stepped to the second shot');
  env.seedLatestShot(latest, 120);
  assert.equal(env.state().shots.length, walked, 'a late seed does not rewind a loaded window');
  assert.equal(env.state().currentShotIndex, 1, 'and does not move the user off their shot');
  assert.equal(env.state().shotsPageLoaded, true, 'the window stays loaded');

  console.log('ok   the open seeds the newest shot and loads the page behind it');
}

// --- the two-phase open under races and failures (review of 82a5cbe) -----------------
{
  const latest = store[0];

  // BUG 1: a seed landing while a tap's page is IN FLIGHT must not rewind the window, and
  // must not break single-flight into two identical page requests.
  let env = makeEnv();
  const stepping = env.stepToOlderShot();          // starts the page, nothing loaded yet
  env.seedLatestShot(latest, 120);                 // the open's reads land mid-flight
  await stepping;
  await env.ensureShotsPage();
  assert.equal(calls.length, 1, 'the in-flight page is shared, not duplicated');
  assert.equal(env.state().shots.length, env.SHOT_PAGE, 'the real window survived the seed');
  assert.equal(env.state().shots[env.state().currentShotIndex].id, store[1].id,
    'currentShotIndex still points at the shot the step moved to');

  // BUG 3: an unfiltered page in flight must not land on top of a filtered window.
  env = makeEnv();
  env.seedLatestShot(latest, 120);
  delayNextGetShots = 50;                           // the unfiltered page is the slow one
  const deferred = env.ensureShotsPage();           // in flight
  await env.loadShots({ coffeeName: 'Red Brick' }); // user filters; lands first
  await deferred;                                   // the stale page lands on top
  const st = env.state();
  assert.deepEqual(st.shotFilter, { coffeeName: 'Red Brick' }, 'the filter is still on');
  assert.equal(st.shotsTotal, 60, 'the total is the filtered total, not the unfiltered 120');
  assert.ok(st.shots.every(s => s.coffeeName === 'Red Brick'),
    'and every row in the window matches the filter');

  // BUG 4: a failed page must not fall through to paging from offset 1 on top of the seed.
  env = makeEnv();
  env.seedLatestShot(latest, 120);
  failNextGetShots = true;
  assert.equal(await env.stepToOlderShot(), false, 'the step reports failure rather than paging');
  assert.ok(calls.every(c => c.offset === 0), 'no request paged from offset 1');
  assert.equal(env.state().shots.length, 1, 'the seed is intact');
  assert.equal(await env.stepToOlderShot(), true, 'and the next press works');
  assert.equal(env.state().shots.length, env.SHOT_PAGE, 'on a real page');

  // BUG 6: the measurements the open fetched must survive the seed -> page swap. The dashboard
  // merges them by replacing the array slot, which is what this reproduces.
  env = makeEnv();
  env.seedLatestShot(latest, 120);
  delayNextGetShots = 50;
  const inFlight = env.ensureShotsPage();
  // The dashboard's deferred getShot resolves while the page is still in flight, and it merges
  // by replacing the array slot. Capturing the element instead of the array misses this.
  env.state().shots[0] = Object.assign({}, latest, { measurements: [{ t: 1 }] });
  await inFlight;
  const at = env.state().shots.findIndex(s => s.id === latest.id);
  assert.ok(at >= 0, 'the seeded shot is in the page');
  assert.deepEqual(env.state().shots[at].measurements, [{ t: 1 }],
    'the measurements are carried across the swap, so they are not refetched');

  // and a page whose newest row is NEWER than the seed keeps the user on their shot
  env = makeEnv();
  env.seedLatestShot(store[1], 120);   // seed is the second shot; page 0 starts at store[0]
  await env.ensureShotsPage();
  assert.equal(env.state().shots[env.state().currentShotIndex].id, store[1].id,
    'a newer shot in the page does not move the user');
  assert.ok(env.state().currentShotIndex >= 1, 'and the index moved to match the new window');

  console.log('ok   the two-phase open holds up under races, filters and failures');
}
