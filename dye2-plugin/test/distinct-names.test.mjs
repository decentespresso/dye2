/**
 * Barista / Drinker suggestions page past Decaid's 100-shot clamp, include recipe names, and
 * dedupe case-insensitively. Run: npm test
 */
import assert from 'node:assert/strict';
const { devApiScript } = await import('../src/utils/dev-api.ts');

const shots = Array.from({ length: 250 }, (_, i) => ({ workflow: { context: {} } }));
shots[210].workflow.context.baristaName = 'Mark';
shots[220].workflow.context.baristaName = 'mark';
shots[230].metadata = { barista: 'Ann' };
const recipes = [{ barista: 'Zoe' }, { barista: 'ANN' }];
const fakeFetch = async (url) => {
  const u = new URL(url, 'http://x');
  if (u.pathname.endsWith('/shots')) {
    const off = +u.searchParams.get('offset') || 0, lim = Math.min(+u.searchParams.get('limit') || 100, 100);
    return { ok: true, status: 200, json: async () => ({ items: shots.slice(off, off + lim), total: shots.length }) };
  }
  return { ok: true, status: 200, json: async () => recipes };
};
const { distinctNames } = new Function('fetch', devApiScript + '\nreturn { distinctNames };')(fakeFetch);
const names = await distinctNames('baristaName');
assert.deepEqual(names.map(n => n.toLowerCase()).sort(), ['ann', 'mark', 'zoe']);
console.log('distinct-names: ok', names);
