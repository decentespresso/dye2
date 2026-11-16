/**
 * One runnable check for dyeConfirm (utils/shared-components.ts) -- the in-app replacement
 * for the WebView's confirm(). No jsdom in this repo, so the stub below is the few DOM
 * methods the script actually touches.
 * Run: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Read the constant out of the source rather than importing the module: shared-components.ts
// pulls in './lucide' extensionless, which Vite resolves and node does not.
const source = readFileSync(new URL('../src/utils/shared-components.ts', import.meta.url), 'utf8');
const match = source.match(/export const dyeConfirmScript = `([\s\S]*?)`;/);
assert.ok(match, 'dyeConfirmScript is still an exported template literal');
const dyeConfirmScript = match[1];

function fakeDom() {
  const keyHandlers = [];
  const make = (tag) => ({
    tag, className: '', textContent: null, type: null, style: {}, children: [],
    handlers: {}, focused: false, removed: false,
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(ev, fn) { (this.handlers[ev] ||= []).push(fn); },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
  });
  const body = make('body');
  const document = {
    createElement: make,
    body,
    addEventListener: (ev, fn) => { if (ev === 'keydown') keyHandlers.push(fn); },
    removeEventListener: (ev, fn) => {
      const i = keyHandlers.indexOf(fn);
      if (ev === 'keydown' && i >= 0) keyHandlers.splice(i, 1);
    },
  };
  return { document, body, keyHandlers };
}

const open = (dom, ...args) =>
  new Function('document', dyeConfirmScript + '\nreturn dyeConfirm;')(dom.document)(...args);

const find = (node, pred) =>
  pred(node) ? node : node.children.reduce((hit, c) => hit || find(c, pred), null);
const buttons = (node) => {
  const out = [];
  (function walk(n) { if (n.tag === 'button') out.push(n); n.children.forEach(walk); })(node);
  return out;
};

// A tap on the confirm button resolves true; the box is torn down and the key listener with it.
{
  const dom = fakeDom();
  const p = open(dom, 'Gone for good.', { title: 'Delete this basket?', confirmText: 'DELETE', danger: true });
  const back = dom.body.children[0];
  assert.equal(back.className, 'dye-modal-backdrop open', 'reuses the page\'s own modal classes');
  assert.equal(back.style.zIndex, '60', 'sits above the edit modal it is asked from');
  assert.ok(find(back, n => n.tag === 'h2' && n.textContent === 'Delete this basket?'), 'title shown');
  // The message is user-reachable text, so it must arrive as textContent, never as markup.
  assert.ok(find(back, n => n.textContent === 'Gone for good.'), 'message set as text');
  assert.ok(!/innerHTML/.test(dyeConfirmScript.replace(/\/\/.*$/gm, '')),
    'and the script never builds nodes from a markup string');

  const [no, yes] = buttons(back);
  assert.deepEqual([no.textContent, yes.textContent], ['CANCEL', 'DELETE']);
  assert.ok(yes.className.includes('dye-btn-danger'), 'a danger confirm is styled as one');
  assert.equal(yes.focused, true, 'the confirm button takes focus');
  assert.equal(dom.keyHandlers.length, 1);

  yes.handlers.click[0]();
  assert.equal(await p, true);
  assert.equal(back.removed, true, 'the box is removed');
  assert.equal(dom.keyHandlers.length, 0, 'and its keydown listener is not left behind');
}

// Cancel, a tap on the scrim, and Escape all resolve false -- never reject, so call sites
// stay `if (!await dyeConfirm(...)) return;`.
{
  const dom = fakeDom();
  const p = open(dom, 'x');
  const back = dom.body.children[0];
  const [no, yes] = buttons(back);
  assert.ok(yes.className.includes('dye-btn-primary'), 'a plain confirm is not styled as danger');
  assert.equal(yes.textContent, 'OK', 'default confirm label');
  no.handlers.click[0]();
  assert.equal(await p, false);
}
{
  const dom = fakeDom();
  const p = open(dom, 'x');
  const back = dom.body.children[0];
  back.handlers.click[0]({ target: back });
  assert.equal(await p, false, 'the scrim cancels');
}
{
  const dom = fakeDom();
  const p = open(dom, 'x');
  const back = dom.body.children[0];
  // a click inside the box must NOT cancel
  back.handlers.click[0]({ target: back.children[0] });
  dom.keyHandlers[0]({ key: 'Escape', stopPropagation() {} });
  assert.equal(await p, false, 'Escape cancels, a click inside does not');
}
{
  const dom = fakeDom();
  const p = open(dom, 'x');
  dom.keyHandlers[0]({ key: 'Enter', stopPropagation() {} });
  assert.equal(await p, true, 'Enter confirms');
}

console.log('ok   dyeConfirm: labels, danger styling, and every cancel path resolves false');
