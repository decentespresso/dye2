// Streamline's shot-history panel opens this page as
//   .../edit-shot?return=<skin-url>&shotId=<id>
// The page must adopt that id (it is on another origin, so the skin cannot set our
// sessionStorage), consume the param so a reload/picker return falls back to the stored
// id, and keep `return` intact because leaveEditShot navigates to it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const src = readFileSync(new URL('../src/pages/edit-shot.ts', import.meta.url), 'utf8');

// Comments name the identifiers asserted on, so match against code only.
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map(line => (line.trim().startsWith('//') ? '' : line.replace(/\s\/\/.*$/, '')))
  .join('\n');

function urlHandlingBlock() {
  const start = code.indexOf('const qs = new URLSearchParams(location.search);');
  const end = code.indexOf('\n  try {', start);
  assert.ok(start > 0 && end > start, 'the ?shotId= block sits at the top of initEditShot');
  return code.slice(start, end);
}

const PATH = '/api/v1/plugins/dye2.reaplugin/edit-shot';

// Runs the lifted block against a fake page context. Returns the stored shot id and the
// URL replaceState was asked to leave behind (undefined when it was not called).
function run({ search, storedId = null, returning = false } = {}) {
  const store = new Map();
  if (storedId) store.set('dye_editShotId', storedId);
  if (returning) store.set('dye_editShotReturn', '1');
  const sessionStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: key => store.delete(key),
  };
  const location = { search, pathname: PATH, hash: '' };
  let replaced;
  const history = { replaceState: (_state, _title, url) => { replaced = url; } };
  new Function('location', 'history', 'sessionStorage', urlHandlingBlock())(
    location, history, sessionStorage
  );
  return { storedId: store.get('dye_editShotId') ?? null, replaced };
}

test('the URL opens the shot the skin sent', () => {
  const out = run({ search: `?return=https%3A%2F%2Fskin%2Fmain&shotId=shot-42` });
  assert.equal(out.storedId, 'shot-42');
  assert.equal(out.replaced, `${PATH}?return=https%3A%2F%2Fskin%2Fmain`,
    'shotId is consumed and `return` is kept for leaveEditShot');
});

test('the URL wins over the id the DYE2 dashboard stored', () => {
  const out = run({ search: '?shotId=new-shot', storedId: 'old-shot' });
  assert.equal(out.storedId, 'new-shot');
});

test('a picker round trip keeps the shot its draft belongs to', () => {
  const out = run({ search: '?shotId=stale-shot', storedId: 'draft-shot', returning: true });
  assert.equal(out.storedId, 'draft-shot', 'the draft wins, not a leftover URL');
});

test('without ?shotId= nothing is stored and the address bar is untouched', () => {
  const out = run({ search: '?return=https%3A%2F%2Fskin%2Fmain', storedId: 'stored-shot' });
  assert.equal(out.storedId, 'stored-shot');
  assert.equal(out.replaced, undefined, 'no rewrite on the dashboard\'s own path');
});

test('the stored id is what initEditShot looks up, before the return-index override', () => {
  const fn = code.indexOf('async function initEditShot()');
  const body = code.slice(fn, code.indexOf('\n}\n', fn));
  const urlAt = body.indexOf('qs.get(\'shotId\')');
  const lookupAt = body.indexOf("sessionStorage.getItem('dye_editShotId')");
  assert.ok(urlAt > 0 && lookupAt > urlAt, 'the handoff is read before the list lookup');
  assert.ok(body.includes('if (idx >= 0) shotIndex = idx;'), 'and selects that row');
});

test('cancel/save still return to the skin URL, carrying the live shot', () => {
  const fn = code.indexOf('function leaveEditShot()');
  const body = code.slice(fn, code.indexOf('\n}\n', fn));
  assert.ok(body.includes("new URLSearchParams(location.search).get('return')"),
    'leaveEditShot reads the return param this handoff preserves');
});

// leaveEditShot runs against a fake page: returns where the frame was sent and whether the
// round-trip keys were cleared.
function liftFn(name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} found`);
  const close = code.indexOf('\n}\n', start);
  assert.ok(close > start, `${name} ends`);
  return code.slice(start, close + 2); // keep the closing brace: this one is executed
}

function leave({ ret, shotId }) {
  const location = {
    search: ret ? `?return=${encodeURIComponent(ret)}` : '',
    href: `https://bridge${PATH}`,
  };
  const window = { location: { href: '' } };
  let cleared = 0;
  const fn = new Function(
    'location', 'window', 'currentShot', 'clearReturnKeys', 'DASHBOARD_ROUTE',
    `${liftFn('leaveEditShot')}\nreturn leaveEditShot;`
  );
  fn(location, window, shotId ? { id: shotId } : null, () => { cleared++; }, 'dashboard')();
  return { href: window.location.href, cleared };
}

test('returning hands back the live shot, not the one the overlay opened', () => {
  const out = leave({ ret: 'https://skin/main?dyeReturn=1', shotId: 'shot-live' });
  assert.equal(out.href, 'https://skin/main?dyeReturn=1&dyeShot=shot-live');
  assert.equal(out.cleared, 1, 'the round-trip keys are still cleared');
  assert.equal(leave({ ret: 'https://skin/main?dyeReturn=1', shotId: null }).href,
    'https://skin/main?dyeReturn=1', 'no current shot: the plain return URL');
  assert.equal(leave({ ret: null, shotId: 'shot-live' }).href, 'dashboard',
    'the DYE2 dashboard path is untouched');
});

test('drink out uses the same derivation as the dashboard', () => {
  const start = code.indexOf('function renderShot(');
  const body = code.slice(start, code.indexOf('\nfunction updateStars(', start));
  assert.ok(body.includes('shotWeights(shot)'), 'shared helper, not doseData.doseOut');
  assert.ok(body.includes("set('es-drink-value'"), 'and the value is painted');
  assert.ok(!body.includes('dd.doseOut'), 'the field that does not carry the yield is gone');
  assert.ok(code.includes('${shotWeightsScript}'), 'the helper is inlined into the page script');
});

test('arrow navigation loads the full shot it lands on', () => {
  const arrows = code.slice(code.indexOf('es-prev-btn'), code.indexOf("'es-dose-minus'"));
  assert.equal((arrows.match(/loadFullShotAt\(shotIndex\)/g) || []).length, 2,
    'both arrows load the row they move to');
  const start = code.indexOf('async function loadFullShotAt(');
  const body = code.slice(start, code.indexOf('\n}\n', start));
  assert.ok(body.includes('getShot(shot.id)'), 'measurements are only in the full record');
  assert.ok(body.includes('token !== shotLoadToken'), 'a late answer cannot repaint another shot');
  assert.ok(body.includes('if (shotIndex === index) renderShot('), 'repaints only if still there');
});

console.log('edit-shot deep-link tests passed');
