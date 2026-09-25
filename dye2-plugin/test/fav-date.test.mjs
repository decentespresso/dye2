import assert from 'node:assert/strict';
import { favDateScript } from '../src/utils/fav-date.ts';

const { formatFavDate } = new Function(favDateScript + '\nreturn { formatFavDate };')();
const now = new Date(2025, 7, 14, 12, 0, 0);
const captured = new Date(2025, 7, 21, 14, 30, 0).toISOString();

assert.equal(formatFavDate(captured, '2025-07-15T00:00:00Z', now), '15 Jul 2025 (30 days off-roast)', 'roast date + days to today');
assert.equal(formatFavDate(captured, '', now), '21 Aug 2025, 2:30pm', 'no roast date: plain date/time, no off-roast text');
assert.equal(formatFavDate(captured, null, now), '21 Aug 2025, 2:30pm');
assert.equal(formatFavDate(captured, 'not a date', now), '21 Aug 2025, 2:30pm', 'unparseable roast date falls back');
assert.equal(formatFavDate('garbage', '', now), '', 'unparseable capture date renders nothing');
assert.equal(formatFavDate(null, '', now), '');
assert.match(formatFavDate(null, '2025-08-20T00:00:00Z', now), /^20 Aug 2025 \(0 days off-roast\)$/, 'future roast date clamps to 0');
console.log('ok   fav-date: roast date variant, plain fallback, bad input');
