import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { lucideIcon } from "../utils/lucide";
import {
  stepperCss, stepperHtml,
  starRatingHtml, starRatingScript,
  expandFieldHtml,
} from "../utils/shared-components";

const styles = `
  ${stepperCss()}
  .edit-divider { height: 2px; background: var(--profile-button-outline-color); flex-shrink: 0; }
  .edit-label { font-weight: 700; font-size: 24px; color: var(--mimoja-blue); }
  .edit-value { font-size: 24px; font-weight: 400; color: var(--text-primary); }
  .beans-card {
    border: 1px solid var(--profile-button-outline-color);
    border-radius: 18px; padding: 24px 28px;
    background: var(--dye-surface, #F8FAFC);
    display: flex; flex-direction: column; gap: 12px;
  }
  .beans-card-name { font-size: 26px; font-weight: 700; color: var(--text-primary); }
  .beans-card-roaster { font-size: 22px; font-weight: 400; color: var(--text-primary); }
  .beans-card-age { font-size: 20px; font-weight: 400; color: var(--low-contrast-white); }
  .beans-card-notes { font-size: 20px; font-weight: 400; color: var(--text-primary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .beans-read-more { font-size: 20px; font-weight: 700; color: var(--mimoja-blue); cursor: pointer; margin-top: 4px; }
  .notes-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    z-index: 100; align-items: center; justify-content: center;
  }
  .notes-overlay.open { display: flex; }
  .notes-modal {
    background: var(--box-color); border-radius: 24px;
    padding: 40px 48px; max-width: 900px; width: 90%;
    max-height: 80vh; overflow-y: auto; font-size: 22px;
    line-height: 1.6; color: var(--text-primary);
  }
  .notes-modal h2 { font-size: 28px; font-weight: 700; margin-bottom: 20px; color: var(--mimoja-blue); }
  .notes-modal-close {
    margin-top: 30px; padding: 14px 40px;
    background: var(--mimoja-blue); color: #fff;
    border-radius: 9999px; font-size: 22px; font-weight: 700; cursor: pointer;
  }
  .footer-btn-danger {
    border: 2px solid #E53935; color: #E53935; border-radius: 23px;
    padding: 0 28px; height: 60px; font-size: 21px; font-weight: 600; cursor: pointer;
    font-family: 'Inter', sans-serif;
  }
  .footer-btn-ghost {
    border: 2px solid var(--mimoja-blue); color: var(--mimoja-blue); border-radius: 23px;
    padding: 0 28px; height: 60px; font-size: 21px; font-weight: 600; cursor: pointer;
    font-family: 'Inter', sans-serif;
  }
  .read-from-dropdown {
    display: none; position: absolute; bottom: calc(100% + 4px); left: 0;
    min-width: 220px; background: var(--box-color);
    border: 2px solid var(--profile-button-outline-color);
    border-radius: 15px; overflow: hidden;
    box-shadow: 0 -4px 16px rgba(0,0,0,0.12); z-index: 50;
  }
  .read-from-dropdown.open { display: block; }
  .read-from-item {
    padding: 16px 23px; font-family: 'Inter', sans-serif;
    font-size: 21px; font-weight: 600; color: var(--text-primary);
    cursor: pointer; white-space: nowrap;
  }
  .read-from-item + .read-from-item { border-top: 1px solid var(--profile-button-outline-color); }
  .read-from-item:hover { background: var(--mimoja-blue); color: #fff; }
  .dye-name-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    max-height: 320px; overflow-y: auto;
    background: var(--box-color); border: 2px solid var(--profile-button-outline-color);
    border-radius: 15px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); z-index: 50;
  }
`;

function buildContent(): string {
  const searchSvg   = lucideIcon('search',       42, 'var(--mimoja-blue)', 2);
  const prevSvg     = lucideIcon('chevron-left',  36, 'var(--mimoja-blue)', 2.5);
  const nextSvg     = lucideIcon('chevron-right', 36, 'var(--mimoja-blue)', 2.5);
  const expandSvg   = lucideIcon('maximize-2',    26, 'var(--mimoja-blue)', 2);
  const pencilSvg   = lucideIcon('pencil',        26, 'var(--text-primary-disabled)', 2);
  const chevUpSvg   = lucideIcon('chevron-up',    24, 'var(--mimoja-blue)', 2.5);

  return `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex flex-col font-['Inter',sans-serif]">

  <!-- Header bar -->
  <div class="flex items-center justify-between px-[38px] h-[110px] shrink-0 bg-[var(--box-color)] border-b border-[var(--profile-button-outline-color)]">
    <div>
      <div class="text-[30px] font-bold text-[var(--text-primary)]">
        Editing &nbsp;<span id="es-shot-label" class="text-[var(--mimoja-blue)]">Last Shot</span>
      </div>
      <div id="es-shot-subtitle" class="text-[22px] font-normal text-[var(--text-primary)] mt-[4px]">—</div>
    </div>
    <div class="flex items-center gap-[30px]">
      <button id="es-search-btn">${searchSvg}</button>
      <div class="flex items-center border-2 border-[var(--mimoja-blue)] rounded-[23px] overflow-hidden">
        <button id="es-prev-btn" class="flex items-center justify-center w-[60px] h-[54px]">${prevSvg}</button>
        <div class="w-[2px] h-[54px] bg-[var(--profile-button-outline-color)]"></div>
        <button id="es-next-btn" class="flex items-center justify-center w-[60px] h-[54px]">${nextSvg}</button>
      </div>
    </div>
  </div>

  <!-- Two-column body -->
  <div class="flex flex-1 overflow-hidden">

    <!-- LEFT COLUMN -->
    <div class="flex flex-col w-[960px] shrink-0 bg-white border-r border-[var(--profile-button-outline-color)] overflow-y-auto px-[38px] py-[32px] gap-[28px]">

      <!-- Dose / Drink (top row) -->
      <div class="flex items-center gap-[60px]">
        ${stepperHtml('es-dose', 'Dose', '80px')}
        ${stepperHtml('es-drink', 'Drink', '80px', true)}
      </div>
      <div class="edit-divider"></div>

      <!-- TDS / EY (second row) -->
      <div class="flex items-center gap-[60px]">
        ${stepperHtml('es-tds', 'TDS', '80px')}
        ${stepperHtml('es-ey', 'EY', '80px')}
      </div>
      <div class="edit-divider"></div>

      <!-- Beans card -->
      <div>
        <div class="edit-label mb-[14px]">Beans</div>
        <div class="beans-card" id="es-beans-card" style="cursor:pointer">
          <div class="beans-card-name" id="es-bean-name">—</div>
          <div class="beans-card-roaster" id="es-bean-roaster"></div>
          <div class="beans-card-age" id="es-bean-age"></div>
          <div class="beans-card-notes" id="es-bean-notes"></div>
          <div class="beans-read-more" id="es-read-more" style="display:none">READ MORE</div>
        </div>
      </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div class="flex flex-col flex-1 bg-[var(--bgmain-color)] overflow-y-auto px-[38px] py-[32px] gap-[28px]">

      <!-- Grinder -->
      ${expandFieldHtml('es-grinder', 'Grinder')}
      <div class="edit-divider"></div>

      <!-- Setting / RPM -->
      <div class="flex items-center gap-[60px]">
        ${stepperHtml('es-setting', 'Setting', '100px')}
        ${stepperHtml('es-rpm', 'RPM', '100px')}
      </div>
      <div class="edit-divider"></div>

      <!-- Basket -->
      ${expandFieldHtml('es-basket', 'Basket')}
      <div class="edit-divider"></div>

      <!-- Barista / Drinker -->
      ${expandFieldHtml('es-barista', 'Barista')}
      ${expandFieldHtml('es-drinker', 'Drinker')}

      <!-- Drinker Notes -->
      <div class="flex items-center gap-[18px]">
        <span class="dye-stepper-label" style="width:120px;flex-shrink:0">Drinker Notes</span>
        <div class="flex items-center flex-1 border border-[var(--profile-button-outline-color)] rounded-[12px] px-[20px] h-[72px] bg-[var(--box-color)] gap-[12px]">
          <span id="es-notes-preview" class="flex-1 text-[22px] font-normal text-[var(--text-primary)] truncate">—</span>
          <button id="es-notes-edit">${pencilSvg}</button>
        </div>
      </div>
      <div class="edit-divider"></div>

      <!-- Rating -->
      <div class="flex items-center gap-[18px]">
        <span class="dye-stepper-label" style="width:120px;flex-shrink:0">Rating</span>
        ${starRatingHtml('es-stars')}
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="flex items-center px-[38px] h-[90px] shrink-0 bg-[var(--box-color)] border-t border-[var(--profile-button-outline-color)] gap-[18px]">
    <button id="es-delete-btn" class="footer-btn-danger">Delete Shot</button>
    <button id="es-clear-btn" class="footer-btn-ghost">Clear all</button>
    <div class="relative">
      <button id="es-read-from-btn" class="footer-btn-ghost flex items-center gap-[8px]">
        Read From ${chevUpSvg}
      </button>
      <div id="es-read-from-dropdown" class="read-from-dropdown">
        <div class="read-from-item" id="es-read-from-workflow">Current Workflow</div>
        <div class="read-from-item" id="es-read-from-prev">Previous Shot</div>
      </div>
    </div>
    <div class="flex-1"></div>
    <button id="es-cancel-btn" class="text-[24px] font-bold text-[var(--text-primary)] px-[30px] h-[62px]">CANCEL</button>
    <button id="es-save-btn" class="bg-[var(--mimoja-blue)] text-white rounded-[68px] h-[62px] px-[40px] text-[24px] font-bold cursor-pointer">SAVE SHOT DATA</button>
  </div>
</div>

<!-- Bean notes full modal (read-only) -->
<div id="es-notes-overlay" class="notes-overlay">
  <div class="notes-modal">
    <h2 id="es-modal-bean-name">Bean Notes</h2>
    <div id="es-modal-notes-body"></div>
    <button class="notes-modal-close" id="es-modal-close">Close</button>
  </div>
</div>

<!-- Drinker notes editor modal -->
<div id="es-drinker-notes-overlay" class="notes-overlay">
  <div class="notes-modal">
    <h2>Drinker Notes</h2>
    <textarea id="es-drinker-notes-input" placeholder="Add tasting notes…"
      style="width:100%;min-height:220px;font-family:'Inter',sans-serif;font-size:22px;line-height:1.6;color:var(--text-primary);border:2px solid var(--profile-button-outline-color);border-radius:15px;padding:16px 20px;outline:none;resize:vertical;box-sizing:border-box"></textarea>
    <div style="display:flex;gap:16px;margin-top:24px;justify-content:flex-end">
      <button class="notes-modal-close" id="es-drinker-notes-cancel" style="margin-top:0;background:transparent;color:var(--text-primary);border:2px solid var(--profile-button-outline-color)">Cancel</button>
      <button class="notes-modal-close" id="es-drinker-notes-save" style="margin-top:0">Save</button>
    </div>
  </div>
</div>
`;
}

const pageScript = `
let currentShot = null;
let currentStarRating = 0;
let allShots = [];
let shotIndex = 0;

function formatShotDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff + ' days ago';
  const time = d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', hour12:true });
  const date = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  return { label, full: date + ', ' + time };
}

function calcRatio(doseIn, doseOut) {
  if (!doseIn || !doseOut || doseIn === 0) return '';
  return '(1:' + (doseOut / doseIn).toFixed(1) + ')';
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

function wireAdjuster(minusId, plusId, valueId, step, min, max, formatter, onChange) {
  [minusId, plusId].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    let t = null;
    btn.addEventListener('click', () => {
      const el = document.getElementById(valueId);
      if (!el) return;
      const raw = parseFloat(el.textContent);
      // Empty field shows "—" → start from min (or 0) so + / − begin working.
      const base = isNaN(raw) ? (min != null ? min : 0) : raw;
      const delta = btnId === minusId ? -step : step;
      let val = parseFloat((base + delta).toFixed(3));
      if (min != null) val = Math.max(min, val);
      if (max != null) val = Math.min(max, val);
      el.textContent = formatter(val);
      clearTimeout(t);
      t = setTimeout(() => onChange(val), 500);
    });
  });
  makeValueEditable(valueId, min, max, formatter, onChange);
}

// Tap the number to type a value directly (tablet-friendly).
function makeValueEditable(valueId, min, max, formatter, onChange) {
  const valEl = document.getElementById(valueId);
  if (!valEl || valEl.dataset.editable) return;
  valEl.dataset.editable = '1';
  valEl.style.cursor = 'text';
  valEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (valEl.querySelector('input')) return;
    const cur = parseFloat(valEl.textContent);
    const prev = valEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = isNaN(cur) ? '' : String(cur);
    input.style.cssText = 'width:90px;font:inherit;text-align:center;border:1px solid var(--mimoja-blue);border-radius:8px;background:#fff;color:inherit;outline:none;padding:2px 4px';
    valEl.textContent = '';
    valEl.appendChild(input);
    input.focus(); input.select();
    let done = false;
    const commit = (apply) => {
      if (done) return; done = true;
      let v = parseFloat(input.value);
      if (apply && !isNaN(v)) {
        if (min != null) v = Math.max(min, v);
        if (max != null) v = Math.min(max, v);
        valEl.textContent = formatter(v);
        onChange(v);
      } else {
        valEl.textContent = prev;
      }
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); commit(false); }
    });
    input.addEventListener('blur', () => commit(true));
  });
}

function wfctx() {
  if (!currentShot) return {};
  currentShot.workflow = currentShot.workflow || {};
  currentShot.workflow.context = currentShot.workflow.context || {};
  return currentShot.workflow.context;
}

// Tap a text display (barista / drinker) to edit it inline.
function makeTextEditable(displayId, onCommit) {
  const el = document.getElementById(displayId);
  if (!el || el.querySelector('input')) return;
  const prev = el.textContent === '—' ? '' : el.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = prev;
  input.style.cssText = 'width:100%;font:inherit;border:1px solid var(--mimoja-blue);border-radius:8px;background:#fff;color:inherit;outline:none;padding:4px 8px';
  el.textContent = '';
  el.appendChild(input);
  input.focus(); input.select();
  let done = false;
  const commit = (apply) => {
    if (done) return; done = true;
    const v = input.value.trim();
    el.textContent = (apply ? v : prev) || '—';
    if (apply) onCommit(v);
  };
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); commit(false); }
  });
  input.addEventListener('blur', () => commit(true));
}

// Remembered barista/drinker names: past shots (already loaded) ∪ ones typed on this device.
function rememberedNames(storeKey, ctxKeys) {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(storeKey) || '[]'); } catch (e) {}
  const set = new Set(saved);
  allShots.forEach(s => {
    const c = (s.workflow && s.workflow.context) || {};
    for (const k of ctxKeys) if (c[k]) set.add(c[k]);
  });
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function rememberName(storeKey, v) {
  if (!v) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(storeKey) || '[]'); } catch (e) {}
  if (!list.includes(v)) { list.push(v); localStorage.setItem(storeKey, JSON.stringify(list)); }
}

// Expand button → dropdown of remembered names (＋ New… falls back to inline typing).
function openNameDropdown(fieldId, storeKey, ctxKeys, onPick) {
  const textEl = document.getElementById(fieldId + '-text');
  if (!textEl) return;
  const box = textEl.parentElement;
  const existing = box.querySelector('.dye-name-dropdown');
  if (existing) { existing.remove(); return; }  // toggle off
  box.style.position = 'relative';
  const dd = document.createElement('div');
  dd.className = 'dye-name-dropdown';

  const pick = (v) => { textEl.textContent = v || '—'; onPick(v); rememberName(storeKey, v); };
  const rows = [{ label: '＋ New…', act: () => makeTextEditable(fieldId + '-text', v => { onPick(v); rememberName(storeKey, v); }) }];
  rememberedNames(storeKey, ctxKeys).forEach(n => rows.push({ label: n, act: () => pick(n) }));

  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'read-from-item';
    row.textContent = r.label;
    row.addEventListener('click', (e) => { e.stopPropagation(); dd.remove(); r.act(); });
    dd.appendChild(row);
  });
  box.appendChild(dd);
  setTimeout(() => document.addEventListener('click', function close(ev) {
    if (!dd.contains(ev.target)) { dd.remove(); document.removeEventListener('click', close); }
  }), 0);
}

// Full-page nav to a picker loses this page's unsaved edits, so stash the working shot
// (+ index + a return flag) first; initEditShot rehydrates it and applies the picker's pick.
function goToPicker(url) {
  try { sessionStorage.setItem('dye_editShotDraft', JSON.stringify(currentShot)); } catch (e) {}
  sessionStorage.setItem('dye_editShotIdx', String(shotIndex));
  sessionStorage.setItem('dye_editShotReturn', '1');
  window.location.href = url;
}

// Fold any grinder / bean selection made in a picker into the shot being edited.
function applyPendingSelections(shot) {
  shot.workflow = shot.workflow || {};
  shot.workflow.context = shot.workflow.context || {};
  const ctx = shot.workflow.context;
  const gId = sessionStorage.getItem('dye_selectedGrinderId');
  if (gId) { ctx.grinderId = gId; ctx.grinderModel = sessionStorage.getItem('dye_selectedGrinderModel') || ctx.grinderModel; }
  // Basket has no schema field — lives in annotations.extras, same as RPM.
  const bskId = sessionStorage.getItem('dye_selectedBasketId');
  if (bskId) {
    shot.annotations = shot.annotations || {};
    shot.annotations.extras = shot.annotations.extras || {};
    shot.annotations.extras.basketId = bskId;
    shot.annotations.extras.basketName = sessionStorage.getItem('dye_selectedBasketName') || shot.annotations.extras.basketName;
  }
  const bName = sessionStorage.getItem('dye_selectedBeanName');
  if (bName) {
    ctx.coffeeName = bName;
    ctx.coffeeRoaster = sessionStorage.getItem('dye_selectedBeanRoaster') || '';
    const bb = sessionStorage.getItem('dye_selectedBatchId');
    if (bb) ctx.beanBatchId = bb;
    const rd = sessionStorage.getItem('dye_selectedRoastDate');
    if (rd) ctx.roastDate = rd;
  }
}

// Opening a picker pushes pages onto the stack (picker, then this page again on its
// return), so history.back() lands on the picker the user just left rather than the
// dashboard that opened this page. Route explicitly and clear the round-trip keys, or a
// later picker visit would still think it owes this page a selection.
const DASHBOARD_ROUTE = 'dashboard';
function leaveEditShot() {
  const ret = new URLSearchParams(location.search).get('return');
  clearReturnKeys();
  window.location.href = ret || DASHBOARD_ROUTE;
}

function clearReturnKeys() {
  ['dye_editShotReturn','dye_editShotDraft','dye_editShotIdx',
   'dye_selectedGrinderId','dye_selectedGrinderModel',
   'dye_selectedBasketId','dye_selectedBasketName',
   'dye_selectedBeanId','dye_selectedBeanName','dye_selectedBeanRoaster','dye_selectedBatchId']
    .forEach(k => sessionStorage.removeItem(k));
}


// Roast date of the batch this shot points at. Async fetch, cached, re-renders once.
let roastDateCache = {};
function batchRoastDate(batchId, shot) {
  if (!batchId) return '';
  if (roastDateCache[batchId] !== undefined) return roastDateCache[batchId] || '';
  roastDateCache[batchId] = null;
  getBeanBatch(batchId)
    .then(function (b) { roastDateCache[batchId] = (b && b.roastDate) || ''; renderShot(shot); })
    .catch(function () { roastDateCache[batchId] = ''; });
  return '';
}

function renderShot(shot) {
  if (!shot) return;
  currentShot = shot;
  const { label, full } = formatShotDate(shot.timestamp || shot.createdAt || Date.now());
  set('es-shot-label', label);
  const wf = shot.workflow || {};
  const ctx = wf.context || {};
  const dd = wf.doseData || {};
  const gd = wf.grinderData || {};
  const profile = wf.profile || {};
  set('es-shot-subtitle', full + (profile.title ? '  •  ' + profile.title : ''));

  // Shot annotations are the canonical home for measured/entered values (see rea_restapi.yml
  // ShotRecordSummary.annotations). Legacy dd/gd kept as read fallbacks for old shots.
  const ann = shot.annotations || {};
  const doseIn  = ann.actualDoseWeight != null ? ann.actualDoseWeight : dd.doseIn;
  const doseOut = ann.actualYield      != null ? ann.actualYield      : dd.doseOut;
  set('es-dose-value',  doseIn  != null ? doseIn  + 'g' : '—');
  set('es-drink-value', doseOut != null ? doseOut + 'g' : '—');
  set('es-drink-sub', calcRatio(doseIn, doseOut));

  set('es-tds-value', ann.drinkTds != null ? ann.drinkTds + '%' : '—');
  set('es-ey-value',  ann.drinkEy  != null ? ann.drinkEy  + '%' : '—');

  const grinderName = ctx.grinderModel || gd.model || gd.name || '';
  const grinderEl = document.getElementById('es-grinder-text');
  if (grinderEl) grinderEl.textContent = grinderName || '—';

  set('es-setting-value', ctx.grinderSetting != null ? ctx.grinderSetting : (gd.setting != null ? gd.setting : '—'));
  set('es-rpm-value',     (ann.extras && ann.extras.rpm != null) ? ann.extras.rpm : (gd.rpm != null ? gd.rpm : '—'));

  // Basket has no schema field, same as RPM — lives in annotations.extras.
  const basketEl = document.getElementById('es-basket-text');
  if (basketEl) basketEl.textContent = (ann.extras && ann.extras.basketName) || '—';

  const baristaEl = document.getElementById('es-barista-text');
  if (baristaEl) baristaEl.textContent = ctx.baristaName || ctx.barista || '—';
  const drinkerEl = document.getElementById('es-drinker-text');
  if (drinkerEl) drinkerEl.textContent = ctx.drinkerName || ctx.drinker || '—';

  const notes = ann.espressoNotes || '';
  set('es-notes-preview', notes ? notes.slice(0, 60) + (notes.length > 60 ? '…' : '') : '—');

  // Beans
  const beanName = ctx.coffeeName || '';
  const roaster  = ctx.coffeeRoaster || '';
  set('es-bean-name', beanName || '—');
  set('es-bean-roaster', roaster);
  // WorkflowContext carries no roastDate (the bridge drops it), so fall back to the
  // roast date of the linked batch — that is where an imported bean keeps it.
  const roastDate = ctx.roastDate || batchRoastDate(ctx.beanBatchId, shot);
  if (roastDate) {
    const rd = new Date(roastDate);
    const diff = Math.floor((new Date() - rd) / 86400000);
    const ds = rd.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    set('es-bean-age', ds + ' (' + diff + ' days off-roast)');
  } else {
    set('es-bean-age', '');
  }
  const beanNotes = ctx.coffeeNotes || '';
  set('es-bean-notes', beanNotes);
  const readMoreBtn = document.getElementById('es-read-more');
  if (readMoreBtn) readMoreBtn.style.display = beanNotes.length > 200 ? 'block' : 'none';

  // Stars
  const rating = ann.enjoyment ? parseInt(ann.enjoyment) : 0;
  currentStarRating = rating;
  updateStars(rating);
}

function updateStars(rating) {
  document.querySelectorAll('#es-stars .dye-star').forEach(s => {
    const idx = parseInt(s.getAttribute('data-index'));
    s.setAttribute('fill',   idx <= rating ? 'var(--mimoja-blue)' : 'none');
    s.setAttribute('stroke', idx <= rating ? 'var(--mimoja-blue)' : 'var(--profile-button-outline-color)');
  });
}

// Extract the dial-in numbers from a saved shot (annotations first, legacy dd/gd as fallback).
function shotDialing(shot) {
  const ann = (shot && shot.annotations) || {};
  const wf  = (shot && shot.workflow) || {};
  const ctx = wf.context || {}, dd = wf.doseData || {}, gd = wf.grinderData || {};
  return {
    dose:  ann.actualDoseWeight != null ? ann.actualDoseWeight : dd.doseIn,
    yield: ann.actualYield      != null ? ann.actualYield      : dd.doseOut,
    grind: ctx.grinderSetting   != null ? ctx.grinderSetting   : gd.setting,
    rpm:   (ann.extras && ann.extras.rpm != null) ? ann.extras.rpm : gd.rpm,
    basketId:   ann.extras && ann.extras.basketId,
    basketName: ann.extras && ann.extras.basketName,
    barista: ctx.baristaName || ctx.barista,
    drinker: ctx.drinkerName || ctx.drinker,
  };
}

// Extract the dial-in numbers from the live workflow (uses target* field names).
async function workflowDialing() {
  const wf = await getWorkflow().catch(() => null);
  const ctx = (wf && wf.context) || {};
  return {
    dose:  ctx.targetDoseWeight,
    yield: ctx.targetYield,
    grind: ctx.grinderSetting,
    rpm:   ctx.extras && ctx.extras.rpm,
    basketId:   ctx.extras && ctx.extras.basketId,
    basketName: ctx.extras && ctx.extras.basketName,
    barista: ctx.baristaName || ctx.barista,
    drinker: ctx.drinkerName || ctx.drinker,
  };
}

// Copy a dialing patch into the current shot's editable fields, then re-render.
function applyDialing(d) {
  if (!currentShot || !d) return;
  currentShot.annotations = currentShot.annotations || {};
  currentShot.workflow = currentShot.workflow || {};
  currentShot.workflow.context = currentShot.workflow.context || {};
  const ann = currentShot.annotations, ctx = currentShot.workflow.context;
  if (d.dose  != null) ann.actualDoseWeight = d.dose;
  if (d.yield != null) ann.actualYield = d.yield;
  if (d.grind != null) ctx.grinderSetting = String(d.grind);
  if (d.rpm   != null) { ann.extras = ann.extras || {}; ann.extras.rpm = d.rpm; }
  if (d.basketId != null) { ann.extras = ann.extras || {}; ann.extras.basketId = d.basketId; ann.extras.basketName = d.basketName; }
  if (d.barista) ctx.baristaName = d.barista;
  if (d.drinker) ctx.drinkerName = d.drinker;
  renderShot(currentShot);
}

function setupControls() {
  // Shot nav
  document.getElementById('es-prev-btn')?.addEventListener('click', () => {
    if (shotIndex < allShots.length - 1) { shotIndex++; renderShot(allShots[shotIndex]); }
  });
  document.getElementById('es-next-btn')?.addEventListener('click', () => {
    if (shotIndex > 0) { shotIndex--; renderShot(allShots[shotIndex]); }
  });

  // Steppers
  function ann() { currentShot.annotations = currentShot.annotations || {}; return currentShot.annotations; }
  wireAdjuster('es-dose-minus','es-dose-plus','es-dose-value', 0.5, 0, null, v => v + 'g', v => {
    if (currentShot) { ann().actualDoseWeight = v; set('es-drink-sub', calcRatio(v, parseFloat(document.getElementById('es-drink-value')?.textContent))); }
  });
  wireAdjuster('es-drink-minus','es-drink-plus','es-drink-value', 1, 0, null, v => v + 'g', v => {
    if (currentShot) { ann().actualYield = v; }
  });
  wireAdjuster('es-tds-minus','es-tds-plus','es-tds-value', 0.01, 0, null, v => v.toFixed(2) + '%', v => {
    if (currentShot) { ann().drinkTds = v; }
  });
  wireAdjuster('es-ey-minus','es-ey-plus','es-ey-value', 0.01, 0, null, v => v.toFixed(2) + '%', v => {
    if (currentShot) { ann().drinkEy = v; }
  });
  wireAdjuster('es-setting-minus','es-setting-plus','es-setting-value', 0.1, 0, null, v => v.toFixed(1), v => {
    if (currentShot) { currentShot.workflow = currentShot.workflow || {}; currentShot.workflow.context = currentShot.workflow.context || {}; currentShot.workflow.context.grinderSetting = String(v); }
  });
  wireAdjuster('es-rpm-minus','es-rpm-plus','es-rpm-value', 1, 1, null, v => String(v), v => {
    // RPM has no schema field — store in annotations.extras (see README: annotations.extras for DYE2 per-shot extras).
    if (currentShot) { ann().extras = ann().extras || {}; ann().extras.rpm = v; }
  });

  // Stars
  document.querySelectorAll('#es-stars .dye-star').forEach(star => {
    star.addEventListener('click', () => {
      const idx = parseInt(star.getAttribute('data-index'));
      currentStarRating = idx;
      updateStars(idx);
      if (currentShot) { ann().enjoyment = idx; }
    });
  });

  // Beans card → picker (round-trips via draft; selection applied on return)
  document.getElementById('es-beans-card')?.addEventListener('click', () => goToPicker('/api/v1/plugins/dye2.reaplugin/bean-picker'));

  // Bean notes modal
  document.getElementById('es-read-more')?.addEventListener('click', e => {
    e.stopPropagation();
    const notes = document.getElementById('es-bean-notes')?.textContent || '';
    const name = document.getElementById('es-bean-name')?.textContent || 'Bean Notes';
    document.getElementById('es-modal-bean-name').textContent = name;
    document.getElementById('es-modal-notes-body').textContent = notes;
    document.getElementById('es-notes-overlay').classList.add('open');
  });
  document.getElementById('es-modal-close')?.addEventListener('click', () => {
    document.getElementById('es-notes-overlay').classList.remove('open');
  });

  // Grinder → picker (round-trips via draft; selection applied on return)
  const goGrinder = () => goToPicker('/api/v1/plugins/dye2.reaplugin/grinder-picker');
  document.getElementById('es-grinder-expand')?.addEventListener('click', goGrinder);
  document.getElementById('es-grinder-text')?.addEventListener('click', goGrinder);

  // Basket → picker (round-trips via draft; selection applied on return)
  const goBasket = () => goToPicker('/api/v1/plugins/dye2.reaplugin/basket-picker');
  document.getElementById('es-basket-expand')?.addEventListener('click', goBasket);
  document.getElementById('es-basket-text')?.addEventListener('click', goBasket);

  // Barista / Drinker → expand shows remembered-name dropdown; tapping the text types a new one.
  const setBarista = v => { wfctx().baristaName = v; };
  document.getElementById('es-barista-expand')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openNameDropdown('es-barista', 'dye_baristaNames', ['baristaName', 'barista'], setBarista);
  });
  document.getElementById('es-barista-text')?.addEventListener('click', () =>
    makeTextEditable('es-barista-text', v => { setBarista(v); rememberName('dye_baristaNames', v); }));

  const setDrinker = v => { wfctx().drinkerName = v; };
  document.getElementById('es-drinker-expand')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openNameDropdown('es-drinker', 'dye_drinkerNames', ['drinkerName', 'drinker'], setDrinker);
  });
  document.getElementById('es-drinker-text')?.addEventListener('click', () =>
    makeTextEditable('es-drinker-text', v => { setDrinker(v); rememberName('dye_drinkerNames', v); }));

  // Drinker notes → editable modal (writes annotations.espressoNotes)
  const openDrinkerNotes = () => {
    const ta = document.getElementById('es-drinker-notes-input');
    if (ta) ta.value = (currentShot && currentShot.annotations && currentShot.annotations.espressoNotes) || '';
    document.getElementById('es-drinker-notes-overlay')?.classList.add('open');
    ta?.focus();
  };
  document.getElementById('es-notes-edit')?.addEventListener('click', openDrinkerNotes);
  document.getElementById('es-notes-preview')?.addEventListener('click', openDrinkerNotes);
  document.getElementById('es-drinker-notes-cancel')?.addEventListener('click', () => {
    document.getElementById('es-drinker-notes-overlay')?.classList.remove('open');
  });
  document.getElementById('es-drinker-notes-save')?.addEventListener('click', () => {
    const ta = document.getElementById('es-drinker-notes-input');
    const v = ta ? ta.value.trim() : '';
    if (currentShot) ann().espressoNotes = v;
    set('es-notes-preview', v ? v.slice(0, 60) + (v.length > 60 ? '…' : '') : '—');
    document.getElementById('es-drinker-notes-overlay')?.classList.remove('open');
  });

  // Read From dropdown
  const rfBtn = document.getElementById('es-read-from-btn');
  const rfDrop = document.getElementById('es-read-from-dropdown');
  rfBtn?.addEventListener('click', e => { e.stopPropagation(); rfDrop?.classList.toggle('open'); });
  document.addEventListener('click', () => rfDrop?.classList.remove('open'));

  document.getElementById('es-read-from-workflow')?.addEventListener('click', async () => {
    applyDialing(await workflowDialing());
    rfDrop?.classList.remove('open');
  });
  document.getElementById('es-read-from-prev')?.addEventListener('click', () => {
    const prev = allShots[shotIndex + 1]; // higher index = older shot
    if (prev) applyDialing(shotDialing(prev));
    rfDrop?.classList.remove('open');
  });

  // Footer buttons
  document.getElementById('es-cancel-btn')?.addEventListener('click', () => leaveEditShot());

  document.getElementById('es-save-btn')?.addEventListener('click', async () => {
    if (!currentShot) return;
    try {
      // PUT supports partial updates — send only the edited fields, not the heavy measurements array.
      await updateShot(currentShot.id, { annotations: currentShot.annotations || {}, workflow: currentShot.workflow });
      leaveEditShot();
    } catch (e) { console.error('Failed to save shot:', e); }
  });

  document.getElementById('es-delete-btn')?.addEventListener('click', async () => {
    if (!currentShot) return;
    if (!confirm('Delete this shot? This cannot be undone.')) return;
    try {
      await deleteShot(currentShot.id);
      leaveEditShot();
    } catch (e) { console.error('Failed to delete shot:', e); }
  });

  document.getElementById('es-clear-btn')?.addEventListener('click', () => {
    if (!currentShot) return;
    currentShot.workflow = {};
    currentShot.annotations = {};
    renderShot(currentShot);
  });
}

async function initEditShot() {
  setupControls();
  const returning = sessionStorage.getItem('dye_editShotReturn') === '1';
  try {
    const result = await getShots({ limit: 50, order: 'desc' }).catch(() => ({ items: [] }));
    allShots = (result && result.items) ? result.items : (Array.isArray(result) ? result : []);
    const storedId = sessionStorage.getItem('dye_editShotId');
    if (storedId) {
      const idx = allShots.findIndex(s => s.id === storedId);
      if (idx >= 0) shotIndex = idx;
    }
    if (returning) {
      const savedIdx = parseInt(sessionStorage.getItem('dye_editShotIdx') || '');
      if (!isNaN(savedIdx)) shotIndex = savedIdx;
    }
    if (allShots.length === 0) {
      set('es-shot-label', 'No shots');
      clearReturnKeys();
      return;
    }
    if (returning) {
      // Came back from a picker: restore the in-progress draft (keeps unsaved edits) and
      // fold in whatever was selected, instead of re-fetching a clean copy from the bridge.
      try {
        const draft = JSON.parse(sessionStorage.getItem('dye_editShotDraft') || 'null');
        if (draft && draft.id === allShots[shotIndex].id) allShots[shotIndex] = draft;
      } catch (e) { console.warn('Could not restore shot draft:', e); }
      applyPendingSelections(allShots[shotIndex]);
      clearReturnKeys();
    } else {
      clearReturnKeys(); // drop any stale draft from an abandoned round-trip
      try {
        const full = await getShot(allShots[shotIndex].id);
        allShots[shotIndex] = { ...allShots[shotIndex], ...full };
      } catch (e) { console.warn('Could not fetch full shot:', e); }
    }
    renderShot(allShots[shotIndex]);
  } catch (e) {
    console.error('initEditShot failed:', e);
  }
}

initEditShot().catch(e => console.error('initEditShot failed:', e));

// history.back() from a picker can restore this page frozen from bfcache; reload so init
// re-runs and rehydrates the draft + applies the selection.
window.addEventListener('pageshow', function(e) { if (e.persisted) window.location.reload(); });
`;

export function renderEditShotPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Edit Shot", buildContent(), styles, [devApiScript, pageScript]),
  };
}
