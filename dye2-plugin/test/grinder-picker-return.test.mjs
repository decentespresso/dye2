// Streamline's Grind label opens this picker as
//   .../grinder-picker?return=<skin-sentinel-url>
// in an iframe overlay, where the picker is the FIRST entry of a fresh browsing
// context: history.back() has no entry of ours to pop and walks the parent instead,
// stranding the barista. leavePicker must navigate to ?return= when it is there, and
// keep history.back() for edit-shot, which navigated here from its own page and
// passes none.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const src = readFileSync(new URL('../src/pages/grinder-picker.ts', import.meta.url), 'utf8');

function leavePickerBlock() {
  const start = src.indexOf('function leavePicker() {');
  const end = src.indexOf('\n}', start);
  assert.ok(start > 0 && end > start, 'grinder-picker defines leavePicker');
  return src.slice(start, end + 2);
}

// Runs the lifted function against a fake page context. Returns where it navigated
// and whether it used the history stack.
function run(search) {
  let href = null;
  let wentBack = false;
  const location = { search, set href(v) { href = v; }, get href() { return href; } };
  const window = { location, history: { back: () => { wentBack = true; } } };
  new Function('window', 'location', `${leavePickerBlock()}\nleavePicker();`)(window, location);
  return { href, wentBack };
}

test('?return= is where the picker goes, instead of the history stack', () => {
  const ret = 'http://tablet.local:8080/index.html?dyeReturn=1';
  assert.deepEqual(run(`?return=${encodeURIComponent(ret)}`), { href: ret, wentBack: false });
});

test('no ?return= keeps history.back(), which is how edit-shot reaches the picker', () => {
  assert.deepEqual(run(''), { href: null, wentBack: true });
});
