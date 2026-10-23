// A recipe is never placed on the R strip automatically. save-recipe without a slot saves to the
// library (stripSlot null) and leaves every other row's slot alone; an explicit slot is honoured
// and the previous holder is demoted, not deleted. Runs the built bundle (npm run build first).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../dye2.reaplugin/plugin.js', import.meta.url), 'utf8');
const wf = { context: { coffeeName: 'Ethiopia', extras: {} }, profile: { title: 'Adaptive', steps: [] } };

async function save(recipes, body) {
  const kv = { recipes };
  const fetchFn = async (url, init) => {
    const m = /\/store\/dye2\.reaplugin\/(\w+)$/.exec(String(url));
    const method = (init && init.method) || 'GET';
    if (m && method === 'POST') { kv[m[1]] = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({}) }; }
    if (m) return { ok: true, status: 200, json: async () => (kv[m[1]] === undefined ? null : kv[m[1]]) };
    if (/\/workflow$/.test(String(url))) return { ok: true, status: 200, json: async () => wf };
    return { ok: false, status: 404, json: async () => null };
  };
  const context = vm.createContext({ console, setTimeout, clearTimeout, fetch: fetchFn });
  new vm.Script(src, { filename: 'plugin.js' }).runInContext(context);
  const plugin = context.createPlugin({ log() {}, emit() {}, storage() {} });
  const res = await plugin.__httpRequestHandler({ requestId: '1', method: 'POST', endpoint: 'save-recipe', body });
  return { res, rows: kv.recipes };
}

const held = [1, 2, 3, 4, 5].map((n) => ({ id: 'r' + n, name: 'R' + n, stripSlot: n }));

{
  const { res, rows } = await save(held.map((r) => ({ ...r })), null);
  assert.equal(res.status, 200, 'all five slots held and no slot asked: still saves (no 409)');
  assert.equal(rows.length, 6);
  assert.equal(rows[5].stripSlot, null, 'new recipe is library-only');
  assert.deepEqual(rows.slice(0, 5).map((r) => r.stripSlot), [1, 2, 3, 4, 5], 'no other row changed slot');
}
{
  const { rows } = await save([{ id: 'a', stripSlot: null }], { name: 'X' });
  assert.equal(rows[1].stripSlot, null, 'free slots exist, none is claimed');
}
{
  const { rows } = await save(held.map((r) => ({ ...r })), { slot: 9 });
  assert.equal(rows[5].stripSlot, null, 'invalid slot -> library');
  assert.deepEqual(rows.slice(0, 5).map((r) => r.stripSlot), [1, 2, 3, 4, 5]);
}
{
  const { res, rows } = await save(held.map((r) => ({ ...r })), { slot: 3 });
  assert.equal(res.status, 200);
  assert.equal(rows[5].stripSlot, 3, 'explicit slot honoured');
  const prev = rows.find((r) => r.id === 'r3');
  assert.ok(prev && prev.stripSlot === null, 'previous holder kept in the library, slot cleared');
  assert.equal(rows.length, 6, 'nothing deleted');
  assert.deepEqual(rows.filter((r) => r.id !== 'r3' && r.id !== rows[5].id).map((r) => r.stripSlot), [1, 2, 4, 5]);
}
console.log('ok   save-recipe: no slot -> library, explicit slot honoured, holder demoted');

// auto-fav-edit: the picker starts with no slot selected and SAVE passes null through.
{
  const page = readFileSync(new URL('../src/pages/auto-fav-edit.ts', import.meta.url), 'utf8');
  assert.ok(!/afe-fav-num\$\{n === 1/.test(page), 'no button is rendered active');
  assert.ok(!/lowest free recipe slot/.test(page) && !/getAssignedSlot\(\) \|\| 1/.test(page), 'no default slot');
  assert.ok(/const slot = getAssignedSlot\(\);/.test(page), 'SAVE uses the picked slot or null');
  assert.ok(/REPLACE RECIPE ' \+ slot/.test(page), 'replace confirm kept for an occupied pick');
}
console.log('ok   auto-fav-edit: recipe slot picker defaults to unassigned');
