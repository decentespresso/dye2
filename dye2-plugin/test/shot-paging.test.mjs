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
function makeEnv() {
  calls.length = 0;
  const getShots = async (opts) => {
    calls.push(opts);
    let items = store;
    if (opts.coffeeName) items = items.filter(s => s.coffeeName === opts.coffeeName);
    if (opts.coffeeRoaster) items = items.filter(s => s.coffeeRoaster === opts.coffeeRoaster);
    const total = items.length;
    return { items: items.slice(opts.offset, opts.offset + opts.limit), total, limit: opts.limit, offset: opts.offset };
  };
  return new Function('getShots', shotPagingScript +
    '\nreturn { loadShots, loadMoreShots, stepToOlderShot, state: () => ({ shots, shotsTotal, currentShotIndex, shotFilter }) };'
  )(getShots);
}

// --- paging ------------------------------------------------------------------
let env = makeEnv();
await env.loadShots(null);
assert.equal(env.state().shots.length, 50, 'first load holds one page');
assert.equal(env.state().shotsTotal, 120, 'total comes from the bridge, not the page');
assert.deepEqual(calls[0], { limit: 50, offset: 0, order: 'desc' }, 'unfiltered first page');

for (let i = 0; i < 49; i++) await env.stepToOlderShot();
assert.equal(env.state().currentShotIndex, 49, 'walked to the end of the loaded page');
assert.equal(calls.length, 1, 'walking inside the page fetches nothing');

await env.stepToOlderShot();
assert.equal(env.state().shots.length, 100, 'stepping off the end pulls the next page');
assert.equal(env.state().currentShotIndex, 50, 'and lands on shot 51, not back at the top');
assert.equal(calls[1].offset, 50, 'the second request asks for the next 50');

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
