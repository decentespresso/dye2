import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { buildGrinderBodyScript } from "../utils/grinder-form";

const styles = `
  .dye-sort-btn {
    width: 100%;
    padding: 12px 0;
    border: 2px solid var(--mimoja-blue);
    border-radius: 9999px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 19px;
    text-align: center;
    color: var(--mimoja-blue);
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
  }
  .dye-sort-btn.dye-sort-active {
    background: var(--mimoja-blue);
    color: #fff;
    border-color: var(--mimoja-blue);
  }

  .dye-card {
    width: 100%;
    min-height: 80px;
    border-radius: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 14px 18px;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    background: var(--box-color);
    border: 1px solid var(--profile-button-outline-color);
    color: var(--text-primary);
    transition: background 0.15s, color 0.15s;
    user-select: none;
    gap: 8px;
  }
  .dye-card:hover { opacity: 0.85; }
  .dye-card-add {
    border: 2px solid var(--mimoja-blue);
    color: var(--mimoja-blue);
    font-weight: 700;
    gap: 8px;
    background: var(--box-color);
    flex-direction: row;
    align-items: center;
    justify-content: center;
    min-height: 80px;
  }
  .dye-card-add svg { stroke: var(--mimoja-blue); }

  .dye-card-name  { font-size: 22px; font-weight: 600; line-height: 1.3; }
  .dye-card-sub   { font-size: 20px; font-weight: 400; opacity: 0.7; }
  .dye-card-date  { font-size: 19px; font-weight: 400; opacity: 0.6; margin-top: 4px; }

  .dye-search-wrap { position: relative; width: 100%; margin-bottom: 10px; }
  .dye-search-input {
    width: 100%; height: 54px; border-radius: 12px; border: none;
    background: #EDF0F4; padding: 0 46px 0 16px;
    font-family: 'Inter', sans-serif; font-size: 19px;
    color: var(--text-primary); outline: none;
  }
  .dye-search-input::placeholder { color: var(--text-primary-disabled); }
  .dye-search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }

  #dye-cards-container::-webkit-scrollbar { width: 36px; }
  #dye-cards-container::-webkit-scrollbar-track { background: transparent; }
  #dye-cards-container::-webkit-scrollbar-thumb {
    background: var(--profile-button-outline-color);
    border-radius: 9999px;
    border: 12px solid transparent;
    background-clip: padding-box;
  }

  /* Add/edit modal */
  .dye-modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.45);
    display: none; align-items: center; justify-content: center; z-index: 50;
  }
  .dye-modal-backdrop.open { display: flex; }
  .dye-modal {
    background: var(--box-color); color: var(--text-primary);
    width: min(760px, 92vw); max-height: 90vh; overflow-y: auto;
    border-radius: 18px; padding: 32px 36px;
    font-family: 'Inter', sans-serif;
  }
  .dye-modal h2 { font-size: 28px; font-weight: 700; margin-bottom: 20px; }
  .dye-field { margin-bottom: 16px; }
  .dye-field label { display: block; font-size: 17px; font-weight: 600; color: var(--text-primary-disabled); margin-bottom: 6px; }
  .dye-field input, .dye-field select, .dye-field textarea {
    width: 100%; height: 50px; border-radius: 10px;
    border: 1px solid var(--profile-button-outline-color);
    background: #EDF0F4; padding: 0 14px; font-size: 19px;
    color: var(--text-primary); font-family: 'Inter', sans-serif; outline: none;
  }
  .dye-field textarea { height: auto; padding: 12px 14px; resize: vertical; }
  .dye-field-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .dye-modal-actions { display: flex; justify-content: flex-end; gap: 14px; margin-top: 24px; }
  .dye-btn {
    height: 56px; padding: 0 30px; border-radius: 9999px;
    font-weight: 700; font-size: 22px; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif;
  }
  .dye-btn-primary { background: var(--mimoja-blue); color: #fff; }
  .dye-btn-ghost { background: transparent; color: var(--text-primary); }
  .dye-btn-danger { background: transparent; color: #C0392B; margin-right: auto; }
  .dye-modal-error { color: #C0392B; font-size: 18px; margin-top: 12px; }
  .dye-hidden { display: none !important; }
`;

const content = `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col">

  <!-- Top bar -->
  <div class="flex justify-between items-center px-[38px] border-b border-[var(--profile-button-outline-color)] bg-[var(--box-color)] h-[134px] shrink-0">
    <h1 class="text-[36px] font-bold text-[var(--text-primary)]">Grinders</h1>
    <button id="dye-done-btn" class="flex items-center justify-center h-[60px] px-[30px] rounded-[9999px] font-bold text-[24px] bg-[var(--mimoja-blue)] text-white cursor-pointer">
      DONE
    </button>
  </div>

  <!-- Body: sort rail + grid -->
  <div class="flex flex-1 overflow-hidden">

    <!-- Sort rail -->
    <div id="dye-sort-sidebar" class="flex flex-col gap-[18px] items-stretch pt-[28px] px-[20px] shrink-0 w-[180px]">
      <div class="dye-search-wrap">
        <input id="dye-search-input" class="dye-search-input" type="text" placeholder="Search" />
        <svg class="dye-search-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary-disabled)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
      <button class="dye-sort-btn dye-sort-active" data-sort="recent">Recent</button>
      <button class="dye-sort-btn" data-sort="oldest">Oldest</button>
      <button class="dye-sort-btn" data-sort="az">A-Z</button>
      <button class="dye-sort-btn" data-sort="za">Z-A</button>
      <button class="dye-sort-btn" data-sort="most-used">Most Used</button>
      <button class="dye-sort-btn" data-sort="least-used">Least Used</button>
    </div>

    <!-- Card grid -->
    <div id="dye-cards-container" class="flex-1 overflow-y-auto pt-[28px] px-[38px] pb-[28px]">
      <div id="dye-cards-grid" class="grid grid-cols-3 gap-[20px]"></div>
    </div>

  </div>

  <!-- Add/edit modal -->
  <div id="dye-modal-backdrop" class="dye-modal-backdrop">
    <div class="dye-modal">
      <h2 id="dye-modal-title">New Grinder</h2>
      <form id="dye-grinder-form">
        <div class="dye-field">
          <label>Model *</label>
          <input name="model" required placeholder="Grinder model" />
        </div>
        <div class="dye-field dye-field-2">
          <div>
            <label>Burrs</label>
            <input name="burrs" placeholder="Burr set name" />
          </div>
          <div>
            <label>Burr Type</label>
            <select name="burrType">
              <option value="">-- Select --</option>
              <option value="flat">Flat</option>
              <option value="conical">Conical</option>
            </select>
          </div>
        </div>
        <div class="dye-field dye-field-2">
          <div>
            <label>Burr Size (mm)</label>
            <input name="burrSize" type="number" step="any" placeholder="e.g. 64" />
          </div>
          <div>
            <label>Setting Type</label>
            <select name="settingType">
              <option value="numeric">Numeric</option>
              <option value="preset">Preset</option>
            </select>
          </div>
        </div>
        <div id="dye-numeric-settings" class="dye-field dye-field-2">
          <div>
            <label>Setting Small Step</label>
            <input name="settingSmallStep" type="number" step="any" placeholder="e.g. 0.1" />
          </div>
          <div>
            <label>Setting Big Step</label>
            <input name="settingBigStep" type="number" step="any" placeholder="e.g. 1" />
          </div>
        </div>
        <div id="dye-preset-settings" class="dye-field dye-hidden">
          <label>Setting Values (comma-separated)</label>
          <input name="settingValues" placeholder="e.g. Fine, Medium, Coarse" />
        </div>
        <div class="dye-field dye-field-2">
          <div>
            <label>RPM Small Step</label>
            <input name="rpmSmallStep" type="number" step="any" placeholder="e.g. 10" />
          </div>
          <div>
            <label>RPM Big Step</label>
            <input name="rpmBigStep" type="number" step="any" placeholder="e.g. 100" />
          </div>
        </div>
        <div class="dye-field">
          <label>Notes</label>
          <textarea name="notes" rows="3" placeholder="Notes about this grinder..."></textarea>
        </div>
        <div id="dye-modal-error" class="dye-modal-error dye-hidden"></div>
        <div class="dye-modal-actions">
          <button type="button" id="dye-modal-delete" class="dye-btn dye-btn-danger dye-hidden">DELETE</button>
          <button type="button" id="dye-modal-cancel" class="dye-btn dye-btn-ghost">CANCEL</button>
          <button type="submit" id="dye-modal-save" class="dye-btn dye-btn-primary">SAVE</button>
        </div>
      </form>
    </div>
  </div>
</div>
`;

const pageScript = `
let grindersCache = [];
let searchQuery = '';
let editingId = null;
let currentSort = 'recent';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function grinderName(g) { return g.model || g.name || 'Unnamed'; }
function grinderSub(g) {
  const parts = [];
  if (g.burrs) parts.push(g.burrs);
  if (g.burrType) parts.push(g.burrType);
  if (g.burrSize) parts.push(g.burrSize + 'mm');
  return parts.join(' · ');
}
function grinderMeta(g) {
  const parts = [];
  if (g.settingType) parts.push(g.settingType);
  if (g.notes) parts.push(g.notes);
  return parts.join(' · ');
}

function matchesSearch(g) {
  if (!searchQuery) return true;
  return (grinderName(g) + ' ' + grinderSub(g) + ' ' + grinderMeta(g)).toLowerCase().includes(searchQuery);
}

function sortItems(items, sortKey) {
  const sorted = [...items];
  const name = (g) => grinderName(g).toLowerCase();
  switch (sortKey) {
    case 'recent':  sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    case 'oldest':  sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
    case 'az':      sorted.sort((a, b) => name(a).localeCompare(name(b))); break;
    case 'za':      sorted.sort((a, b) => name(b).localeCompare(name(a))); break;
    default:        sorted.sort((a, b) => name(a).localeCompare(name(b))); break;
  }
  return sorted;
}

function setupSortButtons(onSort) {
  const sidebar = document.getElementById('dye-sort-sidebar');
  if (!sidebar) return;
  sidebar.querySelectorAll('.dye-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sidebar.querySelectorAll('.dye-sort-btn').forEach(b => b.classList.remove('dye-sort-active'));
      btn.classList.add('dye-sort-active');
      onSort(btn.dataset.sort);
    });
  });
}

function renderGrinderCards(grid) {
  grid.innerHTML = '';

  const addCard = document.createElement('div');
  addCard.className = 'dye-card dye-card-add';
  addCard.innerHTML = '<span>ADD NEW GRINDER +</span><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  addCard.addEventListener('click', () => openModal(null));
  grid.appendChild(addCard);

  sortItems(grindersCache.filter(matchesSearch), currentSort).forEach(g => {
    const card = document.createElement('div');
    card.className = 'dye-card';
    const sub = grinderSub(g);
    const meta = grinderMeta(g);
    card.innerHTML =
      '<div class="dye-card-name">' + esc(grinderName(g)) + '</div>' +
      (sub ? '<div class="dye-card-sub">' + esc(sub) + '</div>' : '') +
      (meta ? '<div class="dye-card-date">' + esc(meta) + '</div>' : '');
    card.addEventListener('click', () => openModal(g));
    grid.appendChild(card);
  });
}

/* ── Modal ── */
function form() { return document.getElementById('dye-grinder-form'); }
function setField(name, val) { const el = form().elements[name]; if (el) el.value = val == null ? '' : val; }
function toggleSettingSections() {
  const isNumeric = form().elements['settingType'].value === 'numeric';
  document.getElementById('dye-numeric-settings').classList.toggle('dye-hidden', !isNumeric);
  document.getElementById('dye-preset-settings').classList.toggle('dye-hidden', isNumeric);
}

function openModal(g) {
  editingId = g ? g.id : null;
  document.getElementById('dye-modal-title').textContent = g ? 'Edit Grinder' : 'New Grinder';
  document.getElementById('dye-modal-error').classList.add('dye-hidden');
  form().reset();
  if (g) {
    ['model','burrs','burrType','burrSize','settingType','settingSmallStep','settingBigStep','rpmSmallStep','rpmBigStep','notes'].forEach(k => setField(k, g[k]));
    setField('settingValues', Array.isArray(g.settingValues) ? g.settingValues.join(', ') : (g.settingValues || ''));
    if (!g.settingType) setField('settingType', 'numeric');
  } else {
    setField('settingType', 'numeric');
  }
  toggleSettingSections();
  document.getElementById('dye-modal-delete').classList.toggle('dye-hidden', !g);
  document.getElementById('dye-modal-backdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('dye-modal-backdrop').classList.remove('open');
  editingId = null;
}

async function submitForm() {
  const fd = new FormData(form());
  const fields = {};
  ['model','burrs','burrType','burrSize','notes','settingType','settingSmallStep','settingBigStep','rpmSmallStep','rpmBigStep','settingValues']
    .forEach(k => { fields[k] = fd.get(k); });
  const body = buildGrinderBody(fields, !!editingId);

  try {
    const url = editingId ? '/api/v1/grinders/' + editingId : '/api/v1/grinders';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + await res.text());
    closeModal();
    await reload();
  } catch (err) {
    const errEl = document.getElementById('dye-modal-error');
    errEl.textContent = 'Save failed: ' + err.message;
    errEl.classList.remove('dye-hidden');
  }
}

async function deleteGrinder() {
  if (!editingId) return;
  if (!confirm('Delete this grinder? Shots that used it keep their saved name, but the grinder itself is gone.')) return;
  try {
    const res = await fetch('/api/v1/grinders/' + editingId, { method: 'DELETE' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + await res.text());
    closeModal();
    await reload();
  } catch (err) {
    const errEl = document.getElementById('dye-modal-error');
    errEl.textContent = 'Delete failed: ' + err.message;
    errEl.classList.remove('dye-hidden');
  }
}

async function reload() {
  try {
    const result = await getGrinders();
    grindersCache = Array.isArray(result) ? result : (result.items || []);
  } catch (e) {
    console.error('Failed to load grinders:', e);
    grindersCache = [];
  }
  renderGrinderCards(document.getElementById('dye-cards-grid'));
}

async function initializeDyeGrinders() {
  const grid = document.getElementById('dye-cards-grid');
  if (!grid) return;

  await reload();
  setupSortButtons((sort) => { currentSort = sort; renderGrinderCards(grid); });

  const searchInput = document.getElementById('dye-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim().toLowerCase(); renderGrinderCards(grid); });
  }

  document.getElementById('dye-done-btn')?.addEventListener('click', () => window.history.back());
  document.getElementById('dye-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('dye-modal-delete')?.addEventListener('click', deleteGrinder);
  document.getElementById('dye-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  form().elements['settingType'].addEventListener('change', toggleSettingSections);
  form().addEventListener('submit', (e) => { e.preventDefault(); submitForm(); });
}

initializeDyeGrinders().catch(e => console.error('initializeDyeGrinders failed:', e));
`;

export function renderGrindersPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Grinders", content, styles, [devApiScript, buildGrinderBodyScript, pageScript]),
  };
}
