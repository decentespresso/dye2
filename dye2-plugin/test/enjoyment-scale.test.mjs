/**
 * One runnable check for the enjoyment <-> stars conversion
 * (shared-components.ts enjoymentScaleScript).
 *
 * Decaid's annotations.enjoyment is 0-10 (decentespresso/decaid#887); DYE2
 * renders 5 stars. Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Read the constant out of the source rather than importing the module:
// shared-components.ts pulls in './lucide' extensionless, which Vite resolves
// and node --experimental-strip-types does not.
const source = readFileSync(
  new URL('../src/utils/shared-components.ts', import.meta.url), 'utf8');
const match = source.match(/export const enjoymentScaleScript = `([\s\S]*?)`;/);
assert.ok(match, 'enjoymentScaleScript is still an exported template literal');

const { enjoymentToStars, starsToEnjoyment } = new Function(
  match[1] + '\nreturn { enjoymentToStars, starsToEnjoyment };'
)();

// Reading: 0-10 halves onto the 5-star display.
for (const [enjoyment, stars] of [[0, 0], [2, 1], [4, 2], [6, 3], [8, 4], [10, 5]]) {
  assert.equal(enjoymentToStars(enjoyment), stars,
    `enjoyment ${enjoyment} reads as ${stars} stars`);
}

// The old 1-5 heuristic is gone: these are ordinary canonical ratings now.
assert.equal(enjoymentToStars(4), 2, 'a canonical 4 is 2 stars, not 4');
assert.equal(enjoymentToStars(1), 1, 'a canonical 1 rounds to 1 star, not 1 by pass-through');
assert.equal(enjoymentToStars(5), 3, 'a canonical 5 is half marks rounded up, not 5 stars');

// Decaid sends numbers, the DOM sends strings; both read the same.
assert.equal(enjoymentToStars('8'), 4, 'a numeric string reads like the number');
assert.equal(enjoymentToStars(7), 4, 'an odd value rounds to the nearest star');

// Missing or unreadable values show no rating rather than throwing.
for (const empty of [null, undefined, '', 'great', NaN]) {
  assert.equal(enjoymentToStars(empty), 0, `${String(empty)} shows no rating`);
}

// Writing: a star click produces the canonical 0-10 value, never 0-100.
for (const [stars, enjoyment] of [[0, 0], [1, 2], [2, 4], [3, 6], [4, 8], [5, 10]]) {
  assert.equal(starsToEnjoyment(stars), enjoyment,
    `${stars} stars writes enjoyment ${enjoyment}`);
}
assert.equal(starsToEnjoyment(4), 8,
  'the four-star click Decaid rejected as 80 now writes 8');

// Both directions clamp, so no out-of-range value reaches Decaid's 0-10 check.
assert.equal(enjoymentToStars(80), 5, 'an un-migrated 0-100 rating clamps to full marks');
assert.equal(enjoymentToStars(-3), 0, 'a negative rating clamps to none');
assert.equal(starsToEnjoyment(9), 10, 'more stars than exist clamps to the maximum');
assert.equal(starsToEnjoyment(-1), 0, 'a negative star index clamps to zero');
assert.equal(starsToEnjoyment('x'), 0, 'an unreadable star index writes zero');

// Round-tripping a star rating through Decaid is lossless.
for (let stars = 0; stars <= 5; stars++) {
  assert.equal(enjoymentToStars(starsToEnjoyment(stars)), stars,
    `${stars} stars survives a write and read back`);
}

console.log('enjoyment-scale: all checks passed');
