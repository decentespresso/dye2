// One favourite per favSlot: exclusivity on write (browser-side dev-api string, run in a vm with a fake KV),
// dedupeFavSlots, assignSlots' range, and the one-time migration (built bundle).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dedupeFavSlots, assignSlots, FAV_SLOT_MAX } from '../src/utils/recent-favs.ts';

// --- dedupeFavSlots: the user's live shape
const rows = [
  { id: 'af1', title: 'ssssss', favSlot: 1, alwaysOnDashboard: false, capturedAt: '2026-10-23T05:00:00Z' },
  { id: 'af2', title: 'Jailbreak', favSlot: 1, alwaysOnDashboard: true, capturedAt: '2026-09-01T00:00:00Z' },
  { id: 'recent:9', auto: true, favSlot: 1, alwaysOnDashboard: true },
  { id: 'af3', favSlot: 3, alwaysOnDashboard: true },
];
const out = dedupeFavSlots(rows);
assert.deepEqual(out.map((r) => r.favSlot), [null, 1, 1, 3], 'hidden loses to shown even when newer; recents untouched');
assert.equal(out[0].title, 'ssssss', 'loser keeps every other field');
assert.equal(out[2], rows[2]); assert.equal(out[3], rows[3]);
assert.equal(rows[0].favSlot, 1, 'input not mutated');
assert.equal(dedupeFavSlots(out), out, 'idempotent');
const clean = [{ id: 'a', favSlot: 1 }, { id: 'b', favSlot: null }];
assert.equal(dedupeFavSlots(clean), clean, 'nothing shared: same array');
assert.deepEqual(dedupeFavSlots([{ id: 'a', favSlot: 2, capturedAt: '2026-01-01T00:00:00Z' }, { id: 'b', favSlot: 2, capturedAt: '2026-02-01T00:00:00Z' }]).map((r) => r.favSlot), [null, 2], 'newest wins');
assert.deepEqual(dedupeFavSlots([{ id: 'a', favSlot: 2 }, { id: 'b', favSlot: 2 }]).map((r) => r.favSlot), [null, 2], 'then larger id');
assert.deepEqual(dedupeFavSlots([{ id: 'a', favSlot: 2, alwaysOnDashboard: false }, { id: 'b', favSlot: 2, alwaysOnDashboard: false }]).map((r) => r.favSlot), [null, 2], 'two hidden: still one holder');
assert.equal(dedupeFavSlots(undefined), undefined);

// --- assignSlots range
assert.equal(FAV_SLOT_MAX, 4);
const placed = assignSlots([1, 2, 3, 4, 5].map((n) => ({ id: 'r' + n })), []);
assert.deepEqual(placed.map((r) => r.favSlot), [1, 2, 3, 4, null], 'recents never get slot 5 (the strip shows 4)');
assert.deepEqual(assignSlots([{ id: 'r' }], [{ id: 's', favSlot: 5, alwaysOnDashboard: true }]).map((r) => r.favSlot), [1], 'a saved slot 5 claims nothing');

// --- exclusivity on write: evaluate the dev-api string against a fake KV
const bundle = readFileSync(new URL('../../dye2.reaplugin/plugin.js', import.meta.url), 'utf8');
const { devApiScript: script } = await import('../src/utils/dev-api.ts');

async function api(favs) {
  const kv = { autoFavourites: favs };
  let writes = 0;
  const fetchFn = async (url, init) => {
    const k = /\/store\/dye2\.reaplugin\/(\w+)/.exec(String(url));
    if (k && init && init.method && init.method !== 'GET') { kv[k[1]] = JSON.parse(init.body); if (k[1] === 'autoFavourites') writes++; return { ok: true, status: 200, json: async () => ({}) }; }
    if (k) return { ok: true, status: 200, json: async () => kv[k[1]] ?? null };
    return { ok: false, status: 404, json: async () => null };
  };
  const ctx = vm.createContext({ console, fetch: fetchFn, window: {}, location: { origin: '' }, setTimeout, clearTimeout });
  new vm.Script(script + '\nthis.__api = { updateAutoFavourite, createAutoFavourite };').runInContext(ctx);
  return { api: ctx.__api, kv, writes: () => writes };
}
{
  const held = [{ id: 'a', favSlot: 1, alwaysOnDashboard: true }, { id: 'b', favSlot: 2 }];
  const { api: a, kv, writes } = await api(held.map((r) => ({ ...r })));
  await a.updateAutoFavourite('b', { title: 'B', favSlot: 1, alwaysOnDashboard: true, snapshot: {}, copyMask: {} });
  assert.equal(writes(), 1, 'one array write');
  assert.deepEqual(kv.autoFavourites.map((r) => [r.id, r.favSlot]), [['a', null], ['b', 1]], 'old holder freed in the same write');
  assert.equal(kv.autoFavourites[0].alwaysOnDashboard, true, 'old holder keeps other fields');
  await a.createAutoFavourite({ title: 'C', favSlot: 1, snapshot: {}, copyMask: {} });
  assert.deepEqual(kv.autoFavourites.map((r) => r.favSlot), [null, null, 1], 'create takes an occupied slot too');
  await a.createAutoFavourite({ title: 'D', favSlot: 5, snapshot: {}, copyMask: {} });
  assert.equal(kv.autoFavourites[3].favSlot, null, 'slot 5 is not storable');
  await a.updateAutoFavourite('b', { title: 'B', favSlot: null, snapshot: {}, copyMask: {} });
  assert.equal(kv.autoFavourites.find((r) => r.id === 'c' || r.title === 'C').favSlot, 1, 'clearing one slot frees nothing else');
}

// --- migration runs once (built bundle)
async function load(favs, flags) {
  const kv = { autoFavourites: favs, recipes: [] }; const writes = []; const stored = {};
  const fetchFn = async (url, init) => {
    const k = /\/store\/dye2\.reaplugin\/(\w+)$/.exec(String(url));
    if (k && init && init.method === 'POST') { kv[k[1]] = JSON.parse(init.body); writes.push(k[1]); return { ok: true, json: async () => ({}) }; }
    if (k) return { ok: true, status: 200, json: async () => kv[k[1]] ?? null };
    if (/\/shots\?/.test(String(url))) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ items: [], total: 0 }) };
    return { ok: false, status: 404, json: async () => null };
  };
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, fetch: fetchFn });
  new vm.Script(bundle, { filename: 'plugin.js' }).runInContext(ctx);
  let plugin;
  const storage = (op) => { if (op.type === 'write') stored[op.key] = op.data; else setTimeout(() => plugin.onEvent({ name: 'storageRead', payload: { key: op.key, value: flags[op.key] } }), 0); };
  plugin = ctx.createPlugin({ log() {}, emit() {}, storage });
  plugin.onLoad({});
  await new Promise((r) => setTimeout(r, 150));
  return { kv, writes, stored };
}
{
  const r = await load(rows.map((x) => ({ ...x })), {});
  const saved = r.kv.autoFavourites.filter((x) => !x.auto);
  assert.deepEqual(saved.map((x) => [x.id, x.favSlot]), [['af1', null], ['af2', 1], ['af3', 3]], 'migration de-duplicated the saved rows');
  assert.equal(r.stored.favSlotsMigrated, true, 'flag set');
  const again = await load(rows.map((x) => ({ ...x })), { favSlotsMigrated: true, recipesMigrated: true, selectionMigrated: true });
  assert.equal(again.stored.favSlotsMigrated, undefined, 'already migrated: does not run again');
}
console.log('ok   fav slots: exclusive on write, dedupeFavSlots tie-break, range 1..4, migration once');
