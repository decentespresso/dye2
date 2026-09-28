import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Page scripts are template strings with extensionless module imports. Execute the
// actual note reader and modal handlers without loading unrelated page dependencies.
const editSource = readFileSync(new URL('../src/pages/edit-shot.ts', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../src/pages/dashboard.ts', import.meta.url), 'utf8');
const reader = editSource.match(/function shotNote\(shot\) \{[\s\S]*?\n\}/)?.[0];
const controls = editSource.match(/  \/\/ Drinker notes →[\s\S]*?(?=  \/\/ Read From dropdown)/)?.[0];
const dashboardReader = dashboardSource.match(/  const wfNote =[^\n]*\n  currentShotNote =[^\n]*/)?.[0];
assert.ok(reader && controls && dashboardReader, 'page note readers and controls found');
const shotNote = new Function(reader + '\nreturn shotNote;')();
const dashboardNote = new Function('shot',
  'const ctx = shot.workflow?.context || {}; let currentShotNote;\n' + dashboardReader + '\nreturn currentShotNote;');

const workflow = { context: { extras: { note: 'Before shot' } } };
for (const [annotations, expected] of [
  [undefined, 'Before shot'],
  [{}, 'Before shot'],
  [{ espressoNotes: null }, 'Before shot'],
  [{ espressoNotes: 'After shot' }, 'After shot'],
  [{ espressoNotes: '' }, ''],
]) {
  const shot = { workflow, annotations };
  assert.equal(shotNote(shot), expected, 'Edit Shot resolves the note');
  assert.equal(dashboardNote(shot), expected, 'dashboard agrees with Edit Shot');
}
assert.equal(shotNote({}), '');
assert.equal(shotNote(null), '');
assert.equal(dashboardNote({}), '');

const nodes = new Map();
const document = {
  getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', textContent: '', focus() {},
      classList: { add() {}, remove() {} },
      addEventListener(event, handler) { this[event] = handler; },
    });
    return nodes.get(id);
  },
};
const shot = { workflow, annotations: {} };
new Function('currentShot', 'document', 'shotNote', 'ann', 'set', controls)(
  shot, document, shotNote, () => shot.annotations,
  (id, value) => { document.getElementById(id).textContent = value; },
);
document.getElementById('es-notes-edit').click();
assert.equal(document.getElementById('es-drinker-notes-input').value, 'Before shot');
document.getElementById('es-drinker-notes-input').value = '';
document.getElementById('es-drinker-notes-save').click();
assert.equal(shot.annotations.espressoNotes, '', 'clear writes an explicit empty annotation');
assert.equal(document.getElementById('es-notes-preview').textContent, '—');
document.getElementById('es-notes-edit').click();
assert.equal(document.getElementById('es-drinker-notes-input').value, '', 'reopening keeps the note cleared');
const savedShot = JSON.parse(JSON.stringify(shot));
assert.equal(shotNote(savedShot), '', 'clear survives serialization');
assert.equal(dashboardNote(savedShot), '', 'dashboard keeps the saved note cleared');
console.log('ok   shot-note: fallback, overrides, and clearing through the editor');
