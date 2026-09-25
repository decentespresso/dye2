import assert from 'node:assert/strict';
import { favDateScript } from '../src/utils/fav-date.ts';

const { formatFavDate, resolveRoastDate } = new Function(favDateScript + '\nreturn { formatFavDate, resolveRoastDate };')();
const at = (y, m, d, h = 14, min = 30) => new Date(y, m - 1, d, h, min).toISOString();

assert.equal(formatFavDate(at(2025, 8, 21), ''), '21 Aug 2025, 2:30pm', 'no roast date: date + 12h time');
assert.equal(formatFavDate(at(2025, 8, 21, 0, 5), null), '21 Aug 2025, 12:05am');
assert.equal(formatFavDate(at(2025, 8, 14), '2025-07-15T00:00:00'), '14 Aug 2025 (30 days off-roast)', 'date only + days roast -> shown date');
assert.equal(formatFavDate(at(2025, 8, 21), '2025-08-20T00:00:00'), '21 Aug 2025 (1 day off-roast)', 'singular');
assert.equal(formatFavDate(at(2025, 8, 21, 9, 0), '2025-08-21T23:00:00'), '21 Aug 2025 (0 days off-roast)', 'same calendar day is 0');
assert.equal(formatFavDate(at(2025, 8, 21), '2025-08-22T00:00:00'), '21 Aug 2025, 2:30pm', 'roast after the shown date: plain');
assert.equal(formatFavDate(at(2025, 8, 21), 'nope'), '21 Aug 2025, 2:30pm', 'unparseable roast date: plain');
assert.equal(formatFavDate('garbage', '2025-07-15'), '', 'bad capture date renders nothing');
assert.equal(formatFavDate(null, ''), '');

const batches = [
  { id: 'b1', beanId: 'A', roastDate: '2025-06-01T00:00:00' },
  { id: 'b2', beanId: 'A', roastDate: '2025-07-15T00:00:00' },
  { id: 'b3', beanId: 'B', roastDate: null, createdAt: '2025-01-01T00:00:00' },
  { id: 'b4', beanId: 'B', roastDate: null, createdAt: '2025-03-01T00:00:00' },
];
assert.equal(resolveRoastDate('b1', batches), '2025-06-01T00:00:00', 'a batch id resolves directly');
assert.equal(resolveRoastDate('A', batches), '2025-07-15T00:00:00', 'a bean id resolves to its latest-roasted batch');
assert.equal(resolveRoastDate('B', batches), '', 'latest batch without a roast date: plain');
assert.equal(resolveRoastDate('zzz', batches), '', 'unknown id');
assert.equal(resolveRoastDate('', batches), '');
assert.equal(resolveRoastDate('A', undefined), '');
console.log('ok   fav-date: shown date + off-roast suffix, plain fallback, batch/bean id resolution');
