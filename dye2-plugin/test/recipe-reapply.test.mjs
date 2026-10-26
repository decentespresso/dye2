// dye2#38: re-applying the selected recipe after its own profile was edited must keep the
// selection; a profile that is neither the baseline's nor the recipe's still clears it.
// Drives the built bundle in a vm with a fake Decaid host.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const API = 'http://localhost:8080/api/v1';
const clone = (v) => JSON.parse(JSON.stringify(v));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (base, patch) => {
  if (!isObj(base) || !isObj(patch)) return clone(patch);
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : clone(v);
  return out;
};

const step = (pressure) => ({ name: 'pour', pump: 'pressure', pressure, seconds: 30, temperature: 93 });
const P1 = { title: 'House', steps: [step(9)] };
const P2 = { title: 'House', steps: [step(6)] }; // the recipe's profile after an edit
const P3 = { title: 'Other', steps: [step(3)] }; // somebody else's profile

const bundle = readFileSync(new URL('../../dye2.reaplugin/plugin.js', import.meta.url), 'utf8');

function start() {
  let workflow = { profile: P1, context: { targetDoseWeight: 18, targetYield: 36, extras: {} }, steamSettings: { targetTemperature: 150 } };
  const kv = { recipes: [{ id: 'r1', stripSlot: 1, name: 'Brazil', profileSnapshot: P1, dashboardVariables: { dose: 18, drink: 36 }, workflow: { context: {}, profile: P1 } }], autoFavourites: [] };
  let plugin;
  const pending = new Set();
  const track = (p) => { pending.add(p); p.finally(() => pending.delete(p)); return p; };
  const res = (status, body) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => clone(body), text: async () => JSON.stringify(body) });
  const fetchFn = async (url, init = {}) => {
    const method = init.method || 'GET';
    const path = String(url).replace(API, '').split('?')[0];
    if (path === '/workflow') {
      if (method === 'PUT') {
        workflow = merge(workflow, JSON.parse(init.body));
        const snapshot = clone(workflow);
        track(new Promise((r) => setTimeout(r, 5)).then(() => plugin.onEvent({ name: 'workflowUpdated', payload: snapshot })));
      }
      return res(200, workflow);
    }
    const store = /^\/store\/dye2\.reaplugin\/(\w+)$/.exec(path);
    if (store) {
      if (method === 'POST') { kv[store[1]] = JSON.parse(init.body); return res(200, {}); }
      return res(200, kv[store[1]] ?? null);
    }
    if (path === '/machine/settings') return res(200, {});
    if (path === '/shots') return res(200, { items: [], total: 0 });
    if (path === '/shots/ids' || path === '/profiles') return res(200, []);
    return res(404, {});
  };
  const host = {
    log: () => {}, emit: () => {},
    // every one-time migration flag reads as already done
    storage: ({ type, key }) => { if (type === 'read') setTimeout(() => plugin.onEvent({ name: 'storageRead', payload: { key, value: true } }), 0); },
  };
  const ctx = vm.createContext({ fetch: fetchFn, setTimeout, clearTimeout, console, crypto: globalThis.crypto, URL, URLSearchParams });
  vm.runInContext(`${bundle}\nthis.createPlugin = createPlugin;`, ctx);
  plugin = ctx.createPlugin(host);
  plugin.onLoad({});
  const settle = async () => { for (let i = 0; i < 50; i++) { await new Promise((r) => setTimeout(r, 20)); if (!pending.size) { await new Promise((r) => setTimeout(r, 50)); if (!pending.size) return; } } };
  return {
    kv, settle,
    recipeId: () => workflow.context.extras.dye?.recipeId ?? null,
    apply: (profile, id) => fetchFn(`${API}/workflow`, { method: 'PUT', body: JSON.stringify({ profile, context: { extras: { dye: { v: 1, recipeId: id } } } }) }),
    editProfile: (p) => { kv.recipes[0] = { ...kv.recipes[0], profileSnapshot: p, workflow: { context: {}, profile: p } }; },
    selection: async () => JSON.parse((await plugin.__httpRequestHandler({ requestId: 1, method: 'GET', endpoint: 'selection' })).body),
  };
}

let s = start();
await s.settle();
await s.apply(P1, 'r1'); await s.settle();
s.editProfile(P2);
await s.apply(P2, 'r1'); await s.settle();
assert.equal(s.recipeId(), 'r1', 're-applying the recipe after its profile was edited keeps the id');
assert.deepEqual(await s.selection(), { kind: 'recipe', id: 'r1', modified: false }, 'and the selection is the recipe, unstarred');

// a later switch off it still drops the id, i.e. the re-apply re-baselined
await s.apply(P3, 'r1'); await s.settle();
assert.equal(s.recipeId(), null, 'a profile matching neither the new baseline nor the recipe clears the selection');

// and the plain case is untouched: an edit from elsewhere, with no re-apply, still clears
s = start();
await s.settle();
await s.apply(P1, 'r1'); await s.settle();
await s.apply(P3, 'r1'); await s.settle();
assert.equal(s.recipeId(), null, 'a profile switch under the id clears it');

console.log('recipe-reapply tests passed');
