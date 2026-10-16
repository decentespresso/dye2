/**
 * One runnable check for the equipment KV table (dev-api.ts createEquipment/getEquipment).
 * Run: npm test
 */
import assert from 'node:assert/strict';
const { devApiScript } = await import('../src/utils/dev-api.ts');

// Fake bridge KV: one key, starts unwritten (decaid returns 200 + null, never 404).
let stored = null;
const urls = [];
const fakeFetch = async (url, opts) => {
  urls.push(url);
  if (!opts || opts.method !== 'POST') return { ok: true, status: 200, json: async () => stored };
  stored = JSON.parse(opts.body);
  return { ok: true, status: 200, json: async () => stored };
};

const api = new Function('fetch', devApiScript +
  '\nreturn { getEquipment, createEquipment, buildRecipeWorkflow };')(fakeFetch);

assert.deepEqual(await api.getEquipment(), [], 'an unwritten key reads as an empty table');

const a = await api.createEquipment('Acaia Lunar');
assert.ok(a.id && a.name === 'Acaia Lunar' && a.createdAt, 'a row is { id, name, createdAt }');
assert.ok(urls.some(u => u.endsWith('/store/dye2.reaplugin/equipment')), 'written to the equipment key');

const again = await api.createEquipment('acaia lunar');
assert.equal(again.id, a.id, 'same name in different case reuses the row, never duplicates it');
assert.equal((await api.getEquipment()).length, 1, 'the table still holds one row');

await api.createEquipment('Weber tamper');
const rows = await api.getEquipment();
assert.equal(rows.length, 2, 'a genuinely new name adds a row');
assert.equal(new Set(rows.map(r => r.id)).size, 2, 'ids are unique');

console.log('ok   equipment KV table');

// A recipe carries the batch/roaster picked with its bean; the embedded workflow applies
// them together with the coffee name (dye2#27), and only the ones the recipe holds.
{
  const wf = (await api.buildRecipeWorkflow({ beanName: 'Ethiopia', beanRoaster: 'Onyx', beanBatchId: 'b-9' })).context;
  assert.equal(wf.coffeeName, 'Ethiopia');
  assert.equal(wf.coffeeRoaster, 'Onyx');
  assert.equal(wf.beanBatchId, 'b-9');
  const bare = (await api.buildRecipeWorkflow({ beanName: 'Ethiopia' })).context;
  assert.ok(!('beanBatchId' in bare) && !('coffeeRoaster' in bare), 'a recipe without a batch writes none');
  console.log('ok   recipe workflow carries the bean batch');
}
