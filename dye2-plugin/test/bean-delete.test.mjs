import assert from 'node:assert/strict';
import { beanDeleteScript } from '../src/utils/bean-delete.ts';

const { deleteBeanWithBatches } = new Function(beanDeleteScript + '\nreturn { deleteBeanWithBatches };')();
function fakeApi(batches, failOn) {
  const calls = [];
  return {
    calls,
    getBeanBatches: async (id, archived) => { calls.push(['list', id, archived]); return batches; },
    deleteBeanBatch: async id => { calls.push(['batch', id]); if (id === failOn) throw new Error('HTTP 500: boom'); },
    deleteBean: async id => { calls.push(['bean', id]); },
  };
}

let api = fakeApi([{ id: 'b1' }, { id: 'b2', archived: true }]);
assert.deepEqual(await deleteBeanWithBatches('bean', api), ['b1', 'b2']);
assert.deepEqual(api.calls, [['list', 'bean', true], ['batch', 'b1'], ['batch', 'b2'], ['bean', 'bean']], 'lists incl. archived, batches first, then the bean');

api = fakeApi([{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }], 'b2');
await assert.rejects(() => deleteBeanWithBatches('bean', api), /boom/);
assert.deepEqual(api.calls.map(c => c[0] + ':' + (c[1] || '')), ['list:bean', 'batch:b1', 'batch:b2'], 'a failed batch stops before b3 and the bean');

api = fakeApi([]);
assert.deepEqual(await deleteBeanWithBatches('bean', api), []);
assert.deepEqual(api.calls, [['list', 'bean', true], ['bean', 'bean']], 'no batches: straight to the bean');

api = fakeApi({ items: [{ id: 'x' }] });
assert.deepEqual(await deleteBeanWithBatches('bean', api), ['x'], 'tolerates an {items} list');
console.log('ok   bean-delete: batches (incl. archived) first, stops on failure, bean last');
