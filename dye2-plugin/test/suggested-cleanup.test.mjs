// Plugin load drops the `suggested: true` recipe rows an earlier release wrote, and only then
// writes the recipes key. Runs the built bundle (npm run build first), like the dev server does.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../dye2.reaplugin/plugin.js', import.meta.url), 'utf8');

async function load(recipes) {
  const kv = { recipes };
  const writes = [];
  const fetchFn = async (url, init) => {
    const m = /\/store\/dye2\.reaplugin\/(\w+)$/.exec(String(url));
    const method = (init && init.method) || 'GET';
    if (m && method === 'POST') { kv[m[1]] = JSON.parse(init.body); writes.push(m[1]); return { ok: true, json: async () => ({}) }; }
    if (m) return { ok: true, status: 200, json: async () => (kv[m[1]] === undefined ? null : kv[m[1]]) };
    if (/\/shots\?/.test(String(url))) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ items: [], total: 0 }) };
    return { ok: false, status: 404, json: async () => null };
  };
  const context = vm.createContext({ console, setTimeout, clearTimeout, fetch: fetchFn });
  new vm.Script(src, { filename: 'plugin.js' }).runInContext(context);
  const plugin = context.createPlugin({ log() {}, emit() {}, storage() {} });
  plugin.onLoad({});
  await new Promise((r) => setTimeout(r, 100));
  return { kv, writes };
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
console.log('ok   suggested-row cleanup on plugin load: drops only suggested rows, writes only on change, refresh never writes recipes');
