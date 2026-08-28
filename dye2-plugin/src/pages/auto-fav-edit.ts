import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { lucideIcon } from "../utils/lucide";
import {
  toggleCss, toggleRowScript,
  segmentControlHtml, segmentControlScript,
  stepperCss,
} from "../utils/shared-components";
import { datePickerCss, datePickerScript } from "../utils/date-picker";

const styles = `
  ${datePickerCss()}
  ${stepperCss()}
  ${toggleCss()}
  .afe-header-sub { font-size: 22px; font-weight: 400; color: var(--text-primary); margin-top: 4px; }
  .afe-section-title { font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 18px; }
  .afe-label { font-size: 24px; font-weight: 600; color: var(--mimoja-blue); margin-bottom: 8px; }
  .afe-input {
    width: 100%; border: 1px solid var(--profile-button-outline-color);
    border-radius: 12px; padding: 0 20px; height: 72px;
    font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 400;
    color: var(--text-primary); background: var(--box-color);
    outline: none;
  }
  .afe-input:focus { border-color: var(--mimoja-blue); }
  .afe-fav-num {
    width: 60px; height: 60px; border-radius: 9999px;
    border: 2px solid var(--profile-button-outline-color);
    font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 600;
    color: var(--text-primary); background: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .afe-fav-num.active {
    background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff;
  }
  .afe-divider { height: 2px; background: var(--profile-button-outline-color); margin: 8px 0; }

  /* Every row shows a read-only value; the pencil reveals its editor. */
  .afe-editor { flex: 1; min-width: 0; display: flex; }
  .afe-editor > * { flex: 1; min-width: 0; }

  /* Searchable lookup field (Profile / Beans / Grinder / Barista / Drinker) */
  .afe-combo { position: relative; }
  .afe-combo-input {
    width: 100%; border: 1px solid var(--profile-button-outline-color);
    border-radius: 12px; padding: 0 18px; height: 60px;
    font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 400;
    color: var(--text-primary); background: var(--box-color); outline: none;
  }
  .afe-combo-input:focus { border-color: var(--mimoja-blue); }
  .afe-combo-drop {
    display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    z-index: 40; max-height: 300px; overflow-y: auto;
    background: var(--box-color); border: 1px solid var(--profile-button-outline-color);
    border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  }
  .afe-combo-drop.open { display: block; }
  .afe-combo-opt {
    padding: 14px 18px; font-size: 22px; color: var(--text-primary); cursor: pointer;
    border-bottom: 1px solid var(--profile-button-outline-color);
  }
  .afe-combo-opt:last-child { border-bottom: none; }
  .afe-combo-opt:hover { background: var(--bgmain-color); }
  .afe-combo-empty { padding: 14px 18px; font-size: 20px; color: var(--text-primary-disabled); }

  /* Roast date — native date picker, styled to match the combo inputs */
  .afe-date-input {
    border: 1px solid var(--profile-button-outline-color);
    border-radius: 12px; padding: 0 18px; height: 60px;
    font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 400;
    color: var(--text-primary); background: var(--box-color); outline: none;
  }
  .afe-date-input:focus { border-color: var(--mimoja-blue); }
  .afe-date-input::-webkit-calendar-picker-indicator { display: none; }

  /* Note — collapsed single line; grows while editing. */
  .afe-note-row.dye-toggle-row { align-items: flex-start; flex-wrap: wrap; }
  .afe-note-head { display: flex; align-items: center; gap: 20px; width: 100%; height: 60px; }
  .afe-note-pencil { margin-left: auto; }
  .afe-note-value {
    width: 100%; min-height: 40px; display: flex; align-items: center;
    font-size: 22px; color: var(--text-primary);
  }
  .afe-note-value.off { color: var(--text-primary-disabled); }
  .afe-note-field {
    width: 100%; box-sizing: border-box; display: none; resize: none; overflow: hidden;
    min-height: 132px; border: 1px solid var(--profile-button-outline-color);
    border-radius: 12px; padding: 14px 18px; line-height: 1.5;
    font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 400;
    color: var(--text-primary); background: var(--box-color); outline: none;
    white-space: pre-wrap; transition: height 0.18s ease, border-color 0.15s, box-shadow 0.15s;
  }
  .afe-note-field::placeholder { color: var(--text-primary-disabled); }
  .afe-note-field:focus { border-color: var(--mimoja-blue); box-shadow: 0 0 0 4px rgba(56,90,146,0.15); }

  /* Toggled-off row: value greyed + pencil dimmed (handled inline) */
  .dye-toggle-value.off { color: var(--text-primary-disabled); }
`;

// id → kind. Drives which editor the pencil reveals and how the value displays.
const FIELD_KINDS: Record<string, string> = {
  'afe-profile': 'lookup', 'afe-beans': 'lookup', 'afe-grinder': 'lookup', 'afe-basket': 'lookup',
  'afe-barista': 'lookup', 'afe-drinker': 'lookup',
  'afe-roast-date': 'date', 'afe-grind-setting': 'text',
  'afe-dose': 'number', 'afe-drink': 'number', 'afe-note': 'note',
};

function toggleMarkup(id: string, on: boolean): string {
  const checkSvg = lucideIcon('check', 16, '#fff', 2.5);
  const xSvg     = lucideIcon('x', 16, '#9CA3AF', 2.5);
  return `<div id="${id}-track" class="dye-toggle-track${on ? ' on' : ''}" data-toggle="${id}">
    <div class="dye-toggle-thumb">
      <span class="dye-toggle-icon-on">${checkSvg}</span>
      <span class="dye-toggle-icon-off">${xSvg}</span>
    </div>
  </div>`;
}

// Standard row: toggle · label · read-only value · (hidden) editor · pencil.
function rowHtml(id: string, label: string, on: boolean, editorInner: string): string {
  const pencilSvg = lucideIcon('pencil', 26, 'var(--mimoja-blue)', 2);
  return `<div class="dye-toggle-row">
    ${toggleMarkup(id, on)}
    <span class="dye-toggle-label">${label}</span>
    <span id="${id}-value" class="dye-toggle-value">—</span>
    <div id="${id}-editor" class="afe-editor" style="display:none">${editorInner}</div>
    <button class="dye-toggle-edit" data-editrow="${id}">${pencilSvg}</button>
  </div>`;
}

function lookupEditor(id: string, label: string): string {
  return `<div class="afe-combo">
    <input id="${id}-input" class="afe-combo-input" type="text" placeholder="Search ${label}…" autocomplete="off" data-field="${id}" />
    <div id="${id}-drop" class="afe-combo-drop"></div>
  </div>`;
}

function rowFor(id: string, label: string, on: boolean): string {
  const kind = FIELD_KINDS[id];
  if (kind === 'lookup') return rowHtml(id, label, on, lookupEditor(id, label));
  if (kind === 'date')   return rowHtml(id, label, on, `<input id="${id}-input" class="afe-date-input" type="date" required readonly data-dye-datepicker />`);
  if (kind === 'text')   return rowHtml(id, label, on, `<input id="${id}-input" class="afe-combo-input" type="text" inputmode="decimal" autocomplete="off" placeholder="e.g. 2.5 or 15 clicks" />`);
  if (kind === 'number') return rowHtml(id, label, on, `<input id="${id}-input" class="afe-combo-input" type="text" inputmode="decimal" data-unit="g" autocomplete="off" />`);
  // note
  const pencilSvg = lucideIcon('pencil', 26, 'var(--mimoja-blue)', 2);
  return `<div class="dye-toggle-row afe-note-row">
    <div class="afe-note-head">
      ${toggleMarkup(id, on)}
      <span class="dye-toggle-label">${label}</span>
      <button class="dye-toggle-edit afe-note-pencil" data-editrow="${id}">${pencilSvg}</button>
    </div>
    <span id="${id}-value" class="afe-note-value">—</span>
    <textarea id="${id}-input" class="afe-note-field" rows="1"
      autocapitalize="sentences" autocorrect="on" spellcheck="true"
      placeholder="e.g. chocolate & stone fruit, syrupy finish…"></textarea>
  </div>`;
}

function buildContent(): string {
  const copyFields: Array<[string, string]> = [
    ['afe-profile',      'Profile'],
    ['afe-beans',        'Beans'],
    ['afe-roast-date',   'Roast Date'],
    ['afe-grinder',      'Grinder'],
    ['afe-basket',       'Basket'],
    ['afe-grind-setting','Grind Setting'],
    ['afe-dose',         'Dose'],
    ['afe-drink',        'Drink'],
    ['afe-barista',      'Barista'],
    ['afe-drinker',      'Drinker'],
    ['afe-note',         'Note'],
  ];
  const defaultOn = new Set(['afe-profile', 'afe-beans', 'afe-grinder', 'afe-basket', 'afe-grind-setting', 'afe-dose', 'afe-drink']);

  return `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex flex-col font-['Inter',sans-serif]">

  <!-- Header bar -->
  <div class="flex items-center justify-between px-[38px] h-[110px] shrink-0 bg-[var(--box-color)] border-b border-[var(--profile-button-outline-color)]">
    <div>
      <div class="text-[30px] font-bold text-[var(--text-primary)]">Edit Auto Favourite</div>
      <div id="afe-subtitle" class="afe-header-sub">—</div>
    </div>
    <div class="flex items-center gap-[16px]">
      <button id="afe-cancel-btn" class="flex justify-center items-center w-[240px] h-[82px] rounded-[68px] font-bold text-[24px] text-[var(--text-primary)]">CANCEL</button>
      <button id="afe-save-btn" class="bg-[var(--mimoja-blue)] text-white flex items-center justify-center w-[310px] h-[82px] rounded-[68px] font-bold text-[24px]">SAVE FAVOURITE</button>
    </div>
  </div>

  <!-- Two-column body -->
  <div class="flex flex-1 overflow-hidden">

    <!-- LEFT: metadata fields -->
    <div class="flex flex-col w-[720px] shrink-0 bg-white border-r border-[var(--profile-button-outline-color)] overflow-y-auto px-[48px] py-[36px] gap-[28px]">

      <div>
        <div class="afe-label">Favourite Title</div>
        <input id="afe-title-input" class="afe-input" type="text" placeholder="Enter a title…" />
      </div>

      <div>
        <div class="afe-label">Beverage</div>
        <input id="afe-beverage-input" class="afe-input" type="text" placeholder="e.g. Cappucino" />
      </div>

      <div>
        <div class="afe-label">Always display on Dashboard</div>
        ${segmentControlHtml('afe-always-display', ['Yes', 'No'], 0)}
      </div>

      <div>
        <div class="afe-label">Assign Fav number</div>
        <div class="flex gap-[18px] mt-[4px]">
          ${[1, 2, 3, 4, 5]
            .map(n => `<button class="afe-fav-num${n === 1 ? ' active' : ''}" data-num="${n}">${n}</button>`)
            .join('')}
        </div>
      </div>
    </div>

    <!-- RIGHT: Data to Copy toggles -->
    <div class="flex flex-col flex-1 overflow-y-auto px-[48px] py-[36px]">
      <div class="afe-section-title">Data to Copy</div>
      <div id="afe-toggles">
        ${copyFields.map(([id, label]) => rowFor(id, label, defaultOn.has(id))).join('')}
      </div>
    </div>
  </div>
</div>
`;
}

const pageScript = `
${toggleRowScript}
${segmentControlScript}

let currentFav = null;
const el = id => document.getElementById(id);

const FIELD_KINDS = {
  'afe-profile':'lookup','afe-beans':'lookup','afe-grinder':'lookup','afe-basket':'lookup','afe-barista':'lookup','afe-drinker':'lookup',
  'afe-roast-date':'date','afe-grind-setting':'text','afe-dose':'number','afe-drink':'number','afe-note':'note'
};
const ALL_COPY_FIELDS = Object.keys(FIELD_KINDS);

// ── Lookup sources (real data) ──────────────────────────────────────────────
function normList(result, labelFn) {
  const items = Array.isArray(result) ? result : (result.items || []);
  return items.map(it => ({ id: it.id || labelFn(it), label: labelFn(it) })).filter(o => o.label && o.label !== '—');
}
async function distinctNames(key) {
  const shots = await getShots({ limit: 200 }).catch(() => []);
  const seen = new Map();
  (Array.isArray(shots) ? shots : (shots.items || [])).forEach(s => {
    const ctx = (s.workflow && s.workflow.context) || {};
    const name = ctx[key] || (s.metadata && s.metadata[key === 'baristaName' ? 'barista' : 'drinker']);
    if (name && !seen.has(name)) seen.set(name, { id: name, label: name });
  });
  return [...seen.values()];
}
const LOOKUP_SOURCES = {
  'afe-profile': { load: async () => normList(await getProfiles(), p => (p.profile && p.profile.title) || p.title || p.name || p.id) },
  'afe-beans':   { load: async () => normList(await getBeans(), b => [b.roaster, b.name].filter(Boolean).join(' ') || b.name || b.id) },
  'afe-grinder': { load: async () => normList(await getGrinders(), g => g.model || g.name || g.id) },
  'afe-basket':  { load: async () => normList(await getBaskets(), b => b.name || b.id) },
  'afe-barista': { load: () => distinctNames('baristaName') },
  'afe-drinker': { load: () => distinctNames('drinkerName') },
};
const lookupCache = {};
const lookupState = {};   // field -> {id, label}

async function loadOptions(field) {
  if (!lookupCache[field]) {
    try { lookupCache[field] = await LOOKUP_SOURCES[field].load(); }
    catch (e) { console.warn('Lookup load failed for', field, e); lookupCache[field] = []; }
  }
  return lookupCache[field];
}
function filterOptions(opts, q) {
  const s = (q || '').trim().toLowerCase();
  return s ? opts.filter(o => o.label.toLowerCase().includes(s)) : opts;
}
function renderDrop(field, opts) {
  const drop = el(field + '-drop');
  if (!drop) return;
  drop.innerHTML = opts.length
    ? opts.slice(0, 50).map((o, i) => '<div class="afe-combo-opt" data-idx="' + i + '">' + o.label + '</div>').join('')
    : '<div class="afe-combo-empty">No matches</div>';
  drop.classList.add('open');
  drop.querySelectorAll('.afe-combo-opt').forEach(elm => {
    elm.addEventListener('mousedown', (ev) => { ev.preventDefault(); chooseLookup(field, opts[parseInt(elm.dataset.idx)]); });
  });
}
async function openMatches(field) {
  const input = el(field + '-input');
  renderDrop(field, filterOptions(await loadOptions(field), input ? input.value : ''));
}
function chooseLookup(field, opt) {
  lookupState[field] = opt;
  const input = el(field + '-input');
  if (input) input.value = opt.label;
  const drop = el(field + '-drop');
  if (drop) drop.classList.remove('open');
  if (field === 'afe-beans' && opt.id) fillRoastDateFromBean(opt.id);
  if (field === 'afe-beans' || field === 'afe-grinder') fillGrindFromShots();
  endEdit(field);
}

// ── Autofills ───────────────────────────────────────────────────────────────
let grindManual = false;
async function fillGrindFromShots() {
  const grindInput = el('afe-grind-setting-input');
  if (!grindInput || grindManual) return;
  const bean = lookupState['afe-beans'], grinder = lookupState['afe-grinder'];
  if (!bean || !bean.id || !grinder || !grinder.id) return;
  try {
    const res = await getShots({ grinderId: grinder.id, beanId: bean.id, limit: 1, order: 'desc' });
    const shots = Array.isArray(res) ? res : (res.items || []);
    const ctx = shots[0] && shots[0].workflow && shots[0].workflow.context;
    const gs = ctx ? ctx.grinderSetting : null;
    if (gs != null && gs !== '') { grindInput.value = String(gs); refreshValue('afe-grind-setting'); }
  } catch (e) { console.warn('Grind autofill failed:', e); }
}
let roastDateManual = false;
async function fillRoastDateFromBean(beanId) {
  const dateInput = el('afe-roast-date-input');
  if (!dateInput || roastDateManual) return;
  try {
    const batches = await getBeanBatches(beanId);
    const dates = (Array.isArray(batches) ? batches : (batches.items || [])).map(b => b.roastDate).filter(Boolean).sort();
    const latest = dates[dates.length - 1];
    dateInput.value = latest ? new Date(latest).toISOString().slice(0, 10) : '';
    refreshValue('afe-roast-date');
  } catch (e) { console.warn('Roast date autofill failed:', e); }
}

// ── Value display ───────────────────────────────────────────────────────────
const editVals = { 'afe-dose': null, 'afe-drink': null };   // parsed numeric values
function fmtDate(v) { return v ? new Date(v + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'; }
function fieldDisplay(id) {
  const kind = FIELD_KINDS[id], input = el(id + '-input');
  if (kind === 'lookup') { const s = lookupState[id]; return s && s.label ? s.label : '—'; }
  if (kind === 'date')   return input && input.value ? fmtDate(input.value) : '—';
  if (kind === 'text')   return input && input.value.trim() ? input.value.trim() : '—';
  if (kind === 'number') { const n = editVals[id]; return n != null ? n + 'g' : '—'; }
  if (kind === 'note')   { const t = input ? input.value.trim() : ''; return t ? (t.length > 60 ? t.slice(0, 60) + '…' : t) : '—'; }
  return '—';
}
function refreshValue(id) { const v = el(id + '-value'); if (v) v.textContent = fieldDisplay(id); }
function refreshAllValues() { ALL_COPY_FIELDS.forEach(refreshValue); }

// ── Edit reveal ─────────────────────────────────────────────────────────────
let editing = null;
function beginEdit(id) {
  if (!isToggleOn(id)) return;             // off rows aren't editable
  if (editing && editing !== id) endEdit(editing);
  editing = id;
  const kind = FIELD_KINDS[id], input = el(id + '-input');
  const value = el(id + '-value'), editor = el(id + '-editor');
  if (value) value.style.display = 'none';
  if (editor) editor.style.display = 'flex';
  if (kind === 'number' && input) input.value = editVals[id] != null ? String(editVals[id]) : '';
  if (kind === 'note' && input) { input.style.display = 'block'; sizeNote(input); }
  if (!input) return;
  input.focus();
  if (kind === 'lookup') openMatches(id);
  // Open the themed picker (never showPicker(), which is the OS dialog). Deferred so this
  // click finishes bubbling first — the document handler would otherwise treat it as an
  // outside click and close the popup immediately.
  else if (kind === 'date') setTimeout(() => input.click(), 0);
  else if (kind === 'note') setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  else input.select();
}
function endEdit(id) {
  const kind = FIELD_KINDS[id], input = el(id + '-input');
  if (kind === 'number' && input) { const v = input.value.trim(); const n = Number(v); editVals[id] = (v === '' || isNaN(n)) ? null : n; }
  const drop = el(id + '-drop'); if (drop) drop.classList.remove('open');
  refreshValue(id);
  if (kind === 'note' && input) input.style.display = 'none';
  const editor = el(id + '-editor'); if (editor && kind !== 'note') editor.style.display = 'none';
  const value = el(id + '-value'); if (value) value.style.display = '';
  if (editing === id) editing = null;
}

// Note auto-grow while editing.
function sizeNote(elm) { elm.style.height = 'auto'; elm.style.height = Math.max(132, elm.scrollHeight) + 'px'; }

// ── Toggle state → row appearance ───────────────────────────────────────────
function applyRowState(id, on) {
  const value = el(id + '-value');
  if (value) value.classList.toggle('off', !on);
  const pencil = document.querySelector('[data-editrow="' + id + '"]');
  if (pencil) { pencil.disabled = !on; pencil.style.opacity = on ? '' : '0.4'; pencil.style.pointerEvents = on ? '' : 'none'; }
  if (!on && editing === id) endEdit(id);
}
function syncAllRowStates() { ALL_COPY_FIELDS.forEach(id => applyRowState(id, isToggleOn(id))); }

function getToggleMask() {
  return {
    profile: isToggleOn('afe-profile'), beans: isToggleOn('afe-beans'), roastDate: isToggleOn('afe-roast-date'),
    grinder: isToggleOn('afe-grinder'), basket: isToggleOn('afe-basket'), grindSetting: isToggleOn('afe-grind-setting'),
    dose: isToggleOn('afe-dose'), drink: isToggleOn('afe-drink'),
    barista: isToggleOn('afe-barista'), drinker: isToggleOn('afe-drinker'), note: isToggleOn('afe-note'),
  };
}
function getAlwaysDisplay() {
  const btn = document.querySelector('#afe-always-display .dye-seg-btn.active');
  return btn ? btn.textContent === 'Yes' : true;
}
function getAssignedSlot() {
  const active = document.querySelector('.afe-fav-num.active');
  return active ? parseInt(active.dataset.num) : null;
}
function set(id, val) { const e = el(id); if (e) e.textContent = val == null ? '—' : val; }
function initLookup(field, label, id) {
  const input = el(field + '-input');
  if (label) { lookupState[field] = { id: id || null, label }; if (input) input.value = label; }
  else if (input) input.value = '';
}

// Older snapshots stored only the id (no grinderModel/profileTitle), so initLookup falls
// back to showing the raw uuid. Swap in the real name from the field's lookup source.
async function resolveLookupLabel(field, id) {
  if (!id) return;
  const st = lookupState[field];
  if (!st || st.label !== String(id)) return;   // already showing a real name
  const opt = (await loadOptions(field)).find(o => String(o.id) === String(id));
  if (!opt) return;
  lookupState[field] = opt;
  const input = el(field + '-input');
  if (input) input.value = opt.label;
  refreshValue(field);
}

function renderFav(fav) {
  if (!fav) return;
  currentFav = fav;
  if (el('afe-title-input')) el('afe-title-input').value = fav.title || '';
  if (el('afe-beverage-input')) el('afe-beverage-input').value = fav.beverage || '';

  const ts = fav.capturedAt || fav.createdAt;
  const snp = fav.snapshot || {};
  const subtitle = (ts ? new Date(ts).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) + ', ' + new Date(ts).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '') + (snp.coffeeName ? '  |  ' + snp.coffeeName : '');
  set('afe-subtitle', subtitle || '—');

  initLookup('afe-profile', snp.profileTitle || snp.profileId || '', snp.profileId);
  initLookup('afe-beans',   snp.coffeeName || '', snp.beanBatchId);
  initLookup('afe-grinder', snp.grinderModel || snp.grinderId || '', snp.grinderId);
  initLookup('afe-basket',  snp.basketName || snp.basketId || '', snp.basketId);
  initLookup('afe-barista', snp.barista || '');
  initLookup('afe-drinker', snp.drinker || '');
  resolveLookupLabel('afe-grinder', snp.grinderId);
  resolveLookupLabel('afe-basket', snp.basketId);
  resolveLookupLabel('afe-profile', snp.profileId);

  const dateInput = el('afe-roast-date-input');
  if (dateInput) { dateInput.value = snp.roastDate ? new Date(snp.roastDate).toISOString().slice(0, 10) : ''; roastDateManual = !!snp.roastDate; }
  const grindInput = el('afe-grind-setting-input');
  if (grindInput) { grindInput.value = snp.grindSetting != null ? String(snp.grindSetting) : ''; grindManual = snp.grindSetting != null; }

  editVals['afe-dose']  = snp.dose  != null ? snp.dose  : null;
  editVals['afe-drink'] = snp.drink != null ? snp.drink : null;

  const noteInput = el('afe-note-input');
  if (noteInput) noteInput.value = snp.note || '';

  if (fav.copyMask) {
    const keyMap = { 'afe-profile':'profile','afe-beans':'beans','afe-roast-date':'roastDate','afe-grinder':'grinder','afe-basket':'basket',
      'afe-grind-setting':'grindSetting','afe-dose':'dose','afe-drink':'drink','afe-barista':'barista','afe-drinker':'drinker','afe-note':'note' };
    Object.keys(keyMap).forEach(id => { const t = el(id + '-track'); if (t) t.classList.toggle('on', fav.copyMask[keyMap[id]] !== false); });
  }
  syncAllRowStates();
  refreshAllValues();

  if (fav.favSlot) document.querySelectorAll('.afe-fav-num').forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.num) === fav.favSlot));

  const alwaysOn = fav.alwaysOnDashboard !== false;
  const yesBtn = document.querySelector('#afe-always-display .dye-seg-btn[data-idx="0"]');
  const noBtn  = document.querySelector('#afe-always-display .dye-seg-btn[data-idx="1"]');
  if (yesBtn && noBtn) [yesBtn, noBtn].forEach((btn, i) => {
    const active = alwaysOn ? i === 0 : i === 1;
    btn.classList.toggle('active', active);
    btn.style.background = active ? 'var(--mimoja-blue)' : 'transparent';
    btn.style.color = active ? '#fff' : 'var(--text-primary)';
  });
}

function setupControls() {
  setupToggleRows(applyRowState);
  setupSegmentControls();

  // Pencil reveals the row's editor.
  document.querySelectorAll('[data-editrow]').forEach(btn => btn.addEventListener('click', () => beginEdit(btn.dataset.editrow)));

  // Lookup comboboxes: filter as you type, blur commits (delay lets an option's mousedown land first).
  Object.keys(LOOKUP_SOURCES).forEach(field => {
    const input = el(field + '-input');
    if (!input) return;
    input.addEventListener('input', () => { lookupState[field] = { id: null, label: input.value }; openMatches(field); });
    input.addEventListener('blur', () => setTimeout(() => { if (editing === field) endEdit(field); }, 150));
  });

  // Manual edits opt out of autofill.
  el('afe-roast-date-input')?.addEventListener('input', () => { roastDateManual = true; });
  el('afe-grind-setting-input')?.addEventListener('input', () => { grindManual = true; });

  // Commit-on-blur / Enter for the simple inputs; Enter also commits for date.
  ['afe-roast-date', 'afe-grind-setting', 'afe-dose', 'afe-drink'].forEach(id => {
    const input = el(id + '-input');
    if (!input) return;
    input.addEventListener('blur', () => { if (editing === id) endEdit(id); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    if (FIELD_KINDS[id] === 'date') input.addEventListener('change', () => { if (editing === id) endEdit(id); });
  });

  const noteInput = el('afe-note-input');
  if (noteInput) {
    noteInput.addEventListener('input', () => sizeNote(noteInput));
    noteInput.addEventListener('blur', () => { if (editing === 'afe-note') endEdit('afe-note'); });
  }

  document.querySelectorAll('.afe-fav-num').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.afe-fav-num').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }));

  el('afe-cancel-btn')?.addEventListener('click', () => window.history.back());

  el('afe-save-btn')?.addEventListener('click', async () => {
    if (editing) endEdit(editing);   // flush any in-progress edit
    const snapshot = { ...((currentFav && currentFav.snapshot) || {}) };
    const p = lookupState['afe-profile']; if (p) { snapshot.profileTitle = p.label; snapshot.profileId = p.id; }
    const b = lookupState['afe-beans'];   if (b) { snapshot.coffeeName = b.label; if (b.id) snapshot.beanBatchId = b.id; }
    const g = lookupState['afe-grinder']; if (g) { snapshot.grinderModel = g.label; snapshot.grinderId = g.id; }
    const bk = lookupState['afe-basket']; if (bk) { snapshot.basketName = bk.label; snapshot.basketId = bk.id; }
    const ba = lookupState['afe-barista']; if (ba) snapshot.barista = ba.label;
    const dr = lookupState['afe-drinker']; if (dr) snapshot.drinker = dr.label;
    const noteInput = el('afe-note-input'); if (noteInput) snapshot.note = noteInput.value.trim() || null;
    const dateInput = el('afe-roast-date-input'); if (dateInput) snapshot.roastDate = dateInput.value ? new Date(dateInput.value).toISOString() : null;
    const grindInput = el('afe-grind-setting-input');
    if (grindInput) { const v = grindInput.value.trim(); const n = Number(v); snapshot.grindSetting = v === '' ? null : (isNaN(n) ? v : n); }
    snapshot.dose = editVals['afe-dose'];
    snapshot.drink = editVals['afe-drink'];

    const data = {
      ...(currentFav || {}),
      title: el('afe-title-input') ? el('afe-title-input').value : '',
      beverage: el('afe-beverage-input') ? el('afe-beverage-input').value : '',
      alwaysOnDashboard: getAlwaysDisplay(),
      favSlot: getAssignedSlot(),
      copyMask: getToggleMask(),
      snapshot,
    };
    try {
      if (currentFav && currentFav.id) await updateAutoFavourite(currentFav.id, data);
      else await createAutoFavourite(data);
      window.history.back();
    } catch (e) { console.error('Failed to save auto-favourite:', e); }
  });
}

function snapshotFromWorkflow(wf) {
  const ctx = (wf && wf.context) || {};
  const profile = (wf && wf.profile) || {};
  const extras = ctx.extras || {};
  return {
    profileId: profile.id || null, profileTitle: profile.title || null,
    beanBatchId: ctx.beanBatchId || null, coffeeName: ctx.coffeeName || null, coffeeRoaster: ctx.coffeeRoaster || null,
    roastDate: ctx.roastDate || null, grinderId: ctx.grinderId || null, grinderModel: ctx.grinderModel || null,
    basketId: extras.basketId || null, basketName: extras.basketName || null,
    grindSetting: ctx.grinderSetting != null ? ctx.grinderSetting : null, rpm: extras.rpm != null ? extras.rpm : null,
    dose: ctx.targetDoseWeight != null ? ctx.targetDoseWeight : null, drink: ctx.targetYield != null ? ctx.targetYield : null,
    barista: ctx.baristaName || null, drinker: ctx.drinkerName || null, note: extras.note || null,
  };
}

async function initAutoFavEdit() {
  setupControls();
  // Consume the edit id immediately (like dashboard/recipe-edit do): if left set it
  // would hijack the next "new favourite" open — silently editing (and re-saving) the
  // old one instead of creating, or, if it was since deleted, breaking renderFav.
  const favId = sessionStorage.getItem('dye_editAutoFavId');
  sessionStorage.removeItem('dye_editAutoFavId');

  let fav = null;
  if (favId) {
    try { fav = await getAutoFavourite(favId); }
    catch (e) { console.warn('Could not load auto-favourite:', e); }
  }
  // New favourite, or the requested one is gone: seed a fresh one from the workflow so
  // renderFav always runs (populating defaults + disabling off-row pencils).
  if (!fav) {
    try { const wf = await getWorkflow(); fav = { snapshot: snapshotFromWorkflow(wf), alwaysOnDashboard: true }; }
    catch (e) { console.warn('Could not load workflow for new auto-favourite:', e); fav = { snapshot: {}, alwaysOnDashboard: true }; }
  }
  renderFav(fav);
}

initAutoFavEdit().catch(e => console.error('initAutoFavEdit failed:', e));
`;

export function renderAutoFavEditPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Edit Auto Favourite", buildContent(), styles, [devApiScript, datePickerScript(), pageScript]),
  };
}
