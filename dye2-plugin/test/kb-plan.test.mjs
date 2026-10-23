import assert from 'node:assert/strict';
import { kbPlanScript } from '../src/utils/kb-plan.ts';

const { kbPlan } = new Function(kbPlanScript + '\nreturn { kbPlan };')();
// Visual viewport 0..500 on screen; the 24px margin means a field bottom > 476 is covered.
const base = { fieldBottom: 300, fieldTop: 260, vvTop: 0, vvHeight: 500, scale: 1, hasModal: false, scrollerRoom: null };
const plan = (o) => kbPlan({ ...base, ...o });

// no overlap
assert.deepEqual(plan({}), { mode: 'none', amount: 0 });
assert.equal(plan({ fieldBottom: 476 }).mode, 'none', 'exactly clear (bottom + 24 == viewport bottom)');
assert.equal(plan({ hasModal: true, scrollerRoom: 0 }).mode, 'none');

// modal: overlap 100 -> 100
assert.deepEqual(plan({ fieldBottom: 576, hasModal: true, scrollerRoom: 999 }), { mode: 'modal', amount: 100 });

// scroller with enough room
assert.deepEqual(plan({ fieldBottom: 576, scrollerRoom: 100 }), { mode: 'scroll', amount: 100 });
assert.equal(plan({ fieldBottom: 576, scrollerRoom: 500 }).mode, 'scroll');

// scroller that saturates: needs 100, has 30 -> pad the 70 shortfall
assert.deepEqual(plan({ fieldBottom: 576, scrollerRoom: 30 }), { mode: 'pad', amount: 100, pad: 70 });
assert.deepEqual(plan({ fieldBottom: 576, scrollerRoom: 0 }), { mode: 'pad', amount: 100, pad: 100 });
assert.equal(plan({ fieldBottom: 576, scrollerRoom: -5 }).pad, 100, 'negative room clamps to 0');

// no ancestor at all -> shift the page root
assert.deepEqual(plan({ fieldBottom: 576 }), { mode: 'shift', amount: 100 });
// shift never pushes the field off the top (fieldTop 60 -> at most 52)
assert.deepEqual(plan({ fieldBottom: 576, fieldTop: 60 }), { mode: 'shift', amount: 52 });
assert.equal(plan({ fieldBottom: 576, fieldTop: 4 }).mode, 'none');

// visual viewport offset counts (pinch/scroll): bottom edge is vvTop + vvHeight
assert.equal(plan({ fieldBottom: 576, vvTop: 100 }).mode, 'none');

// amounts are divided by the scale (design px), for every mode
assert.equal(plan({ fieldBottom: 576, scale: 2, hasModal: true }).amount, 50);
assert.equal(plan({ fieldBottom: 576, scale: 2, scrollerRoom: 100 }).amount, 50);
assert.deepEqual(plan({ fieldBottom: 576, scale: 2, scrollerRoom: 20 }), { mode: 'pad', amount: 50, pad: 30 });
assert.equal(plan({ fieldBottom: 576, scale: 0.5 }).amount, 200);
assert.equal(plan({ fieldBottom: 576, scale: 0 }).amount, 100, 'bad scale falls back to 1');

console.log('kb-plan tests passed');
