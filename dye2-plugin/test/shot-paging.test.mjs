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
function makeEnv() {
  calls.length = 0;
  failNextGetShots = false;
  const getShots = async (opts) => {
    calls.push(opts);
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

  // 8. seeding again after a page has loaded must go back to being a seed, or the fresh
  //    one-shot window would be treated as a full page and never widen.
  env = makeEnv();
  await env.loadShots(null);
  assert.equal(env.state().shotsPageLoaded, true, 'page loaded');
  env.seedLatestShot(latest, 120);
  assert.equal(env.state().shotsPageLoaded, false, 'seeding resets the loaded flag');
  assert.equal(env.state().shots.length, 1, 'and the window is the seed again');
  const before8 = calls.length;
  await env.ensureShotsPage();
  assert.equal(calls.length, before8 + 1, 'so the page is fetched again');
  assert.equal(env.state().shots.length, env.SHOT_PAGE, 'and the window widens');

  console.log('ok   the open seeds the newest shot and loads the page behind it');
}
