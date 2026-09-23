/** Shared multi-select equipment field: dropdown of saved kit (from the `equipment` KV
 *  table), a "+ New…" round trip to the equipment manage page, and a per-item pencil that
 *  overrides a selected row's custom-field VALUES just for this record (shot / favourite /
 *  recipe) without touching the row's own saved defaults.
 *
 *  Pulled out of edit-shot.ts (the original implementation) so auto-fav-edit and
 *  recipe-edit can offer the same field without copy-pasting it. edit-shot keeps its own
 *  copy — same rules, different ids — rather than risk a regression by migrating it.
 *
 *  A page wires one field per instance:
 *    const field = {
 *      textElId, expandElId,               // ids of the summary span + the element that opens the dropdown
 *      getSelected: () => ({ ids, names }), // current selection, arrays in lockstep
 *      toggle: (item) => { ... },           // add/remove `item` from that selection
 *      getCustomOverrides: () => obj,       // { [equipmentId]: [{key,value}, ...] } or {}
 *      setCustomOverride: (id, arr) => {},
 *      goToNewEquipment: () => { ... },     // stash a draft + navigate to the equipment page
 *    };
 *  then calls initEquipmentField(field) once the page's DOM is ready, and
 *  wireEquipmentValuesModal() once (shared modal, one per page).
 */

import { lucideIcon } from "./lucide";

export const equipmentFieldCss = `
  .dye-name-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    max-height: 320px; overflow-y: auto;
    background: var(--box-color); border: 2px solid var(--profile-button-outline-color);
    border-radius: 15px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); z-index: 50;
  }
  .read-from-item {
    padding: 16px 23px; font-family: 'Inter', sans-serif;
    font-size: 21px; font-weight: 600; color: var(--text-primary);
    cursor: pointer; white-space: nowrap;
  }
  .read-from-item + .read-from-item { border-top: 1px solid var(--profile-button-outline-color); }
  .read-from-item:hover { background: var(--mimoja-blue); color: #fff; }
  .equip-edit-icon { display: flex; flex-shrink: 0; color: var(--mimoja-blue); }
  .read-from-item:hover .equip-edit-icon { color: #fff; }
  .eq-values-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    z-index: 100; align-items: center; justify-content: center;
  }
  .eq-values-overlay.open { display: flex; }
  .eq-values-modal {
    background: var(--bgmain-color); border-radius: 24px;
    padding: 40px 48px; max-width: 900px; width: 90%;
    max-height: 80vh; overflow-y: auto; font-size: 22px;
    line-height: 1.6; color: var(--text-primary);
  }
  .eq-values-modal h2 { font-size: 28px; font-weight: 700; margin-bottom: 20px; color: var(--mimoja-blue); }
  .eq-values-modal-btn {
    margin-top: 30px; padding: 14px 40px;
    background: var(--mimoja-blue); color: #fff;
    border-radius: 9999px; font-size: 22px; font-weight: 700; cursor: pointer;
  }
  .equip-value-row { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
  .equip-value-row label { width: 160px; flex-shrink: 0; font-weight: 700; font-size: 24px; color: var(--mimoja-blue); }
  .equip-value-row input {
    flex: 1; font: inherit; font-size: 24px; font-weight: 400; color: var(--text-primary);
    border: 1px solid var(--profile-button-outline-color); border-radius: 12px;
    padding: 0 20px; height: 72px; outline: none; background: var(--box-color);
  }
`;

/** The per-item value-override modal markup — include once per page. */
export function equipmentValuesModalHtml(): string {
  return `
<div id="eq-values-overlay" class="eq-values-overlay">
  <div class="eq-values-modal">
    <h2 id="eq-values-title">Equipment</h2>
    <div id="eq-values-fields"></div>
    <div style="display:flex;gap:16px;margin-top:24px;justify-content:flex-end">
      <button class="eq-values-modal-btn" id="eq-values-cancel" style="margin-top:0;background:transparent;color:var(--text-primary);border:2px solid var(--profile-button-outline-color)">Cancel</button>
      <button class="eq-values-modal-btn" id="eq-values-save" style="margin-top:0">Save</button>
    </div>
  </div>
</div>`;
}

const equipPencilSvgJs = JSON.stringify(lucideIcon("pencil", 20, "currentColor", 2));

export const equipmentFieldScript = `
const EQUIP_PENCIL_SVG = ${equipPencilSvgJs};
let __equipmentCache = [];
async function loadEquipmentCache() {
  try { __equipmentCache = await getEquipment(); } catch (e) { console.warn('Could not load equipment:', e); __equipmentCache = []; }
  return __equipmentCache;
}

function equipmentCustomFor(overrides, item) {
  const stored = overrides && overrides[item.id];
  if (Array.isArray(stored)) return stored.map(f => ({ ...f }));
  return (Array.isArray(item.custom) ? item.custom : []).map(f => ({ ...f }));
}

let __equipEditingItem = null;
let __equipEditingField = null;

function openEquipmentValuesEditor(field, item) {
  __equipEditingItem = item;
  __equipEditingField = field;
  const titleEl = document.getElementById('eq-values-title');
  if (titleEl) titleEl.textContent = item.name;
  const container = document.getElementById('eq-values-fields');
  if (!container) return;
  container.innerHTML = '';
  equipmentCustomFor(field.getCustomOverrides(), item).forEach(f => {
    const row = document.createElement('div');
    row.className = 'equip-value-row';
    const label = document.createElement('label'); label.textContent = f.key;
    const input = document.createElement('input');
    input.type = 'text'; input.value = f.value || ''; input.dataset.key = f.key;
    row.appendChild(label); row.appendChild(input);
    container.appendChild(row);
  });
  document.getElementById('eq-values-overlay')?.classList.add('open');
}
function closeEquipmentValuesEditor() {
  document.getElementById('eq-values-overlay')?.classList.remove('open');
  __equipEditingItem = null; __equipEditingField = null;
}
function saveEquipmentValues() {
  if (!__equipEditingItem || !__equipEditingField) { closeEquipmentValuesEditor(); return; }
  const inputs = [...document.querySelectorAll('#eq-values-fields input')];
  __equipEditingField.setCustomOverride(__equipEditingItem.id, inputs.map(inp => ({ key: inp.dataset.key, value: inp.value.trim() })));
  closeEquipmentValuesEditor();
}
function wireEquipmentValuesModal() {
  document.getElementById('eq-values-cancel')?.addEventListener('click', closeEquipmentValuesEditor);
  document.getElementById('eq-values-save')?.addEventListener('click', saveEquipmentValues);
}

function equipmentFieldText(field) {
  const { names } = field.getSelected();
  return names.filter(Boolean).join(', ') || '—';
}
function refreshEquipmentField(field) {
  const el = document.getElementById(field.textElId);
  if (el) el.textContent = equipmentFieldText(field);
}

function openEquipmentDropdown(field) {
  const textEl = document.getElementById(field.textElId);
  if (!textEl) return;
  const box = textEl.parentElement;
  const existing = box.querySelector('.dye-name-dropdown');
  if (existing) { existing.remove(); return; }   // toggle off
  box.style.position = 'relative';
  const dd = document.createElement('div');
  dd.className = 'dye-name-dropdown';

  const renderRows = () => {
    dd.innerHTML = '';
    const { ids } = field.getSelected();
    const newRow = document.createElement('div');
    newRow.className = 'read-from-item';
    newRow.textContent = '＋ New…';
    newRow.addEventListener('click', (ev) => { ev.stopPropagation(); field.goToNewEquipment(); });
    dd.appendChild(newRow);
    __equipmentCache.slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .forEach(e => {
        const row = document.createElement('div');
        row.className = 'read-from-item';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px';
        const label = document.createElement('span');
        label.textContent = (ids.includes(e.id) ? '✓ ' : '') + e.name;
        row.appendChild(label);
        // Only a selected item's values apply here, and only when it has fields to edit.
        if (ids.includes(e.id) && Array.isArray(e.custom) && e.custom.length) {
          const editBtn = document.createElement('span');
          editBtn.innerHTML = EQUIP_PENCIL_SVG;
          editBtn.className = 'equip-edit-icon';
          editBtn.addEventListener('click', (ev) => { ev.stopPropagation(); dd.remove(); openEquipmentValuesEditor(field, e); });
          row.appendChild(editBtn);
        }
        row.addEventListener('click', (ev) => { ev.stopPropagation(); field.toggle(e); renderRows(); refreshEquipmentField(field); });
        dd.appendChild(row);
      });
  };
  renderRows();
  box.appendChild(dd);
  setTimeout(() => document.addEventListener('click', function close(ev) {
    if (!dd.contains(ev.target)) { dd.remove(); document.removeEventListener('click', close); }
  }), 0);
}

function initEquipmentField(field) {
  refreshEquipmentField(field);
  document.getElementById(field.expandElId)?.addEventListener('click', (e) => { e.stopPropagation(); openEquipmentDropdown(field); });
  document.getElementById(field.textElId)?.addEventListener('click', (e) => { e.stopPropagation(); openEquipmentDropdown(field); });
}
`;
