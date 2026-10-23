// Plugin load drops the `suggested: true` recipe rows an earlier release wrote, and only then
// writes the recipes key. Runs the built bundle (npm run build first), like the dev server does.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../dye2.reaplugin/plugin.js', import.meta.url), 'utf8');

async function load(recipes, flags = {}, racer = null) {
  const kv = { recipes };
  const writes = [];
  const stored = {};
  let recipeGets = 0;
  const fetchFn = async (url, init) => {
    const m = /\/store\/dye2\.reaplugin\/(\w+)$/.exec(String(url));
    const method = (init && init.method) || 'GET';
    if (m && method === 'POST') { kv[m[1]] = JSON.parse(init.body); writes.push(m[1]); return { ok: true, json: async () => ({}) }; }
    if (m && m[1] === 'recipes' && racer && ++recipeGets === 2) kv.recipes = racer(kv.recipes);
    if (m) return { ok: true, status: 200, json: async () => (kv[m[1]] === undefined ? null : kv[m[1]]) };
    if (/\/shots\?/.test(String(url))) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ items: [], total: 0 }) };
    return { ok: false, status: 404, json: async () => null };
  };
  const context = vm.createContext({ console, setTimeout, clearTimeout, fetch: fetchFn });
  new vm.Script(src, { filename: 'plugin.js' }).runInContext(context);
  let plugin;
  // host.storage is void; a read answers as a storageRead event, a write is kept.
  const storage = (op) => {
    if (op.type === 'write') stored[op.key] = op.data;
    else setTimeout(() => plugin.onEvent({ name: 'storageRead', payload: { key: op.key, value: flags[op.key] } }), 0);
  };
  plugin = context.createPlugin({ log() {}, emit() {}, storage });
  plugin.onLoad({});
  await new Promise((r) => setTimeout(r, 100));
  return { kv, writes, stored };
}

{
  const real = [{ id: 'a', name: 'Mine', stripSlot: 1 }, { id: 'b', name: 'Library only', stripSlot: null }];
  const { kv, writes } = await load([real[0], { id: 'sug-x', stripSlot: 2, suggested: true }, real[1]]);
  assert.deepEqual(kv.recipes, real, 'suggested rows dropped, real recipes untouched');
  assert.equal(writes.filter((k) => k === 'recipes').length, 1, 'one write');
}
{
  const real = [{ id: '2', name: 'Legacy' }, { id: 'sug-y', stripSlot: 3, suggested: true }];
  const { kv } = await load(real);
  assert.deepEqual(kv.recipes, [{ id: '2', name: 'Legacy', stripSlot: 2 }], 'slot migration and cleanup compose');
}
{
  const { kv, writes } = await load([{ id: 'a', stripSlot: 1 }]);
  assert.deepEqual(kv.recipes, [{ id: 'a', stripSlot: 1 }]);
  assert.equal(writes.includes('recipes'), false, 'nothing to drop: the key is not written, load or refresh');
}
// Self-heal on the one-time migration, flag written; second load (flag set) does nothing.
{
  const rows = [{ id: '1', stripSlot: 1, capturedAt: '2026-09-01T00:00:00Z' }, { id: '2', stripSlot: 1, capturedAt: '2026-10-01T00:00:00Z' }];
  const first = await load(rows);
  assert.deepEqual(first.kv.recipes.map((r) => r.stripSlot), [null, 1], 'shared slot de-duplicated, newest keeps it');
  assert.equal(first.stored.recipesMigrated, true, 'flag written');
  const second = await load(rows, { recipesMigrated: true });
  assert.equal(second.writes.includes('recipes'), false, 'flag set: recipes is never touched');
  const clean = await load([{ id: 'a', stripSlot: 1 }]);
  assert.equal(clean.stored.recipesMigrated, true, 'flag written even when nothing needed changing');
}
// Re-read before write: a page save landing between the first read and the write is not clobbered.
{
  const rows = [{ id: '1', stripSlot: 1, capturedAt: '2026-09-01T00:00:00Z' }, { id: '2', stripSlot: 1, capturedAt: '2026-10-01T00:00:00Z' }];
  const { kv, writes } = await load(rows, {}, (cur) => cur.map((r) => (r.id === '1' ? { ...r, stripSlot: null, name: 'page-save' } : r)));
  assert.equal(writes.includes('recipes'), false, 'fresh copy no longer needs the change: no write');
  assert.equal(kv.recipes[0].name, 'page-save');
}
console.log('ok   suggested-row cleanup on plugin load: drops only suggested rows, writes only on change, refresh never writes recipes');
