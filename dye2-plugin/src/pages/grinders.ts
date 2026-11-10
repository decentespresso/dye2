import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { buildGrinderBodyScript, grinderLimitsScript } from "../utils/grinder-form";
import { cardLongPressScript } from "../utils/fav-card-tap";

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
  /* Same selected treatment as grinder-picker, so the two grids read alike. */
  .dye-card.dye-card-selected {
    background: var(--mimoja-blue);
    border-color: var(--mimoja-blue);
    color: #fff;
  }
  .dye-card.dye-card-selected .dye-card-sub,
  .dye-card.dye-card-selected .dye-card-date { opacity: 0.85; }
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
  /* Archived: still listed here, and only here -- the pickers never offer one. Dimmed and
     dashed so it reads as set aside rather than deleted. */
  .dye-card.dye-card-archived {
    opacity: 0.45;
    border-style: dashed;
  }
  .dye-card.dye-card-archived:hover { opacity: 0.65; }

  .dye-card-name  { font-size: 22px; font-weight: 600; line-height: 1.3; }
  .dye-card-sub   { font-size: 20px; font-weight: 400; opacity: 0.7; }
  .dye-card-date  { font-size: 19px; font-weight: 400; opacity: 0.6; margin-top: 4px; }

  .dye-search-wrap { position: relative; width: 100%; margin-bottom: 10px; }
  .dye-search-input {
    width: 100%; height: 54px; border-radius: 12px; border: none;
    background: var(--field-bg); padding: 0 46px 0 16px;
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
    position: fixed; inset: 0; background: var(--overlay-scrim);
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
    background: var(--field-bg); padding: 0 14px; font-size: 19px;
    color: var(--text-primary); font-family: 'Inter', sans-serif; outline: none;
  }
  .dye-field textarea { height: auto; padding: 12px 14px; resize: vertical; }
  .dye-field-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .dye-field-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .dye-modal-actions { display: flex; justify-content: flex-end; gap: 14px; margin-top: 24px; }
  .dye-btn {
    height: 56px; padding: 0 30px; border-radius: 9999px;
    font-weight: 700; font-size: 22px; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif;
  }
  .dye-btn-primary { background: var(--mimoja-blue); color: #fff; }
  .dye-btn-ghost { background: transparent; color: var(--text-primary); }
  .dye-btn-danger { background: transparent; color: var(--danger-text); margin-right: auto; }
  .dye-modal-error { color: var(--danger-text); font-size: 18px; margin-top: 12px; }
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
        <div id="dye-numeric-range" class="dye-field dye-field-3">
          <div>
            <label>Setting Min</label>
            <input name="settingMin" type="number" step="any" placeholder="e.g. 0" />
          </div>
          <div>
            <label>Setting Max</label>
            <input name="settingMax" type="number" step="any" placeholder="e.g. 50" />
          </div>
          <div>
            <label>Setting Default</label>
            <input name="settingDefault" type="number" step="any" placeholder="blank = middle of the range" />
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
        <div class="dye-field dye-field-3">
          <div>
            <label>RPM Min</label>
            <input name="rpmMin" type="number" step="any" placeholder="e.g. 300" />
          </div>
          <div>
            <label>RPM Max</label>
            <input name="rpmMax" type="number" step="any" placeholder="e.g. 1400" />
          </div>
          <div>
            <label>RPM Default</label>
            <input name="rpmDefault" type="number" step="any" placeholder="blank = middle of the range" />
          </div>
        </div>
        <div class="dye-field">
          <label>Feed Rate</label>
          <input name="feedRate" placeholder="e.g. FF/MF/SF or feeder RPM range" />
        </div>
        <div class="dye-field">
          <label>Notes</label>
          <textarea name="notes" rows="3" placeholder="Notes about this grinder..."></textarea>
        </div>
        <div id="dye-modal-error" class="dye-modal-error dye-hidden"></div>
        <div class="dye-modal-actions">
          <button type="button" id="dye-modal-delete" class="dye-btn dye-btn-danger dye-hidden">DELETE</button>
          <button type="button" id="dye-modal-archive" class="dye-btn dye-btn-ghost dye-hidden">ARCHIVE</button>
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
let editingExtras = {};
let editingArchived = false;
let currentSort = 'recent';
let selectedGrinderId = null;

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

  // Archived grinders sort to the end of whatever order is picked, so the ones in rotation
  // stay at the top and the set-aside ones are still reachable without a second screen.
  const inOrder = sortItems(grindersCache.filter(matchesSearch), currentSort);
  [...inOrder.filter(g => !g.archived), ...inOrder.filter(g => g.archived)].forEach(g => {
    const card = document.createElement('div');
    card.className = 'dye-card' + (g.archived ? ' dye-card-archived' : '');
    const sub = grinderSub(g);
    const meta = [g.archived ? 'Archived' : '', grinderMeta(g)].filter(Boolean).join(' · ');
    card.innerHTML =
      '<div class="dye-card-name">' + esc(grinderName(g)) + '</div>' +
      (sub ? '<div class="dye-card-sub">' + esc(sub) + '</div>' : '') +
      (meta ? '<div class="dye-card-date">' + esc(meta) + '</div>' : '');
    if (g.id === selectedGrinderId) card.classList.add('dye-card-selected');
    // An archived grinder is not offerable: a tap opens its editor (where UNARCHIVE is)
    // instead of writing it to the workflow as the next shot's grinder.
    if (g.archived) {
      card.addEventListener('click', () => openModal(g));
      grid.appendChild(card);
      return;
    }
    // Tap picks the grinder for the next shot, a 500ms hold edits it -- the same split as
    // bean-picker and the dashboard's grinder tabs. There is no CONFIRM on this page, so the
    // tap writes straight through; PUT /workflow deep-merges, so this partial context is safe.
    // attachCardLongPress swallows the click that ends the hold, so the hold does not also
    // select. Verified in Chrome: it swallows regardless of which of the two is wired first.
    attachCardLongPress(card, () => openModal(g));
    card.addEventListener('click', () => {
      grid.querySelectorAll('.dye-card').forEach(c => c.classList.remove('dye-card-selected'));
      card.classList.add('dye-card-selected');
      selectedGrinderId = g.id;
      // The grinder's own defaults ride along, clamped to its own range: a dial position
      // belongs to the grinder it was read off. A grinder declaring neither default nor
      // range clears the value instead of keeping the previous grinder's number. Same rule
      // as the dashboard's grinder tabs.
      const d = grinderDefaultsPatch(g);
      const ctx = {
        grinderId: g.id,
        grinderModel: grinderName(g),
        grinderSetting: d.grinderSetting != null ? d.grinderSetting : null,
        extras: { rpm: d.rpm != null ? d.rpm : null },
      };
      updateWorkflow({ context: markDye(ctx) })
        .catch(e => console.warn('workflow update failed:', e));
    });
    grid.appendChild(card);
  });
}

/* ── Modal ── */
function form() { return document.getElementById('dye-grinder-form'); }
function setField(name, val) { const el = form().elements[name]; if (el) el.value = val == null ? '' : val; }
function toggleSettingSections() {
  const isNumeric = form().elements['settingType'].value === 'numeric';
  document.getElementById('dye-numeric-settings').classList.toggle('dye-hidden', !isNumeric);
  // A preset grinder's positions are named, not numbered, so a numeric range and default
  // mean nothing there -- settingValues is its whole vocabulary. RPM is independent of the
  // setting type and stays visible either way.
  document.getElementById('dye-numeric-range').classList.toggle('dye-hidden', !isNumeric);
  document.getElementById('dye-preset-settings').classList.toggle('dye-hidden', isNumeric);
}

function openModal(g) {
  editingId = g ? g.id : null;
  editingExtras = (g && g.extras) || {};
  editingArchived = !!(g && g.archived);
  document.getElementById('dye-modal-title').textContent = g ? 'Edit Grinder' : 'New Grinder';
  document.getElementById('dye-modal-error').classList.add('dye-hidden');
  form().reset();
  if (g) {
    ['model','burrs','burrType','burrSize','settingType','settingSmallStep','settingBigStep','rpmSmallStep','rpmBigStep','notes'].forEach(k => setField(k, g[k]));
    setField('feedRate', editingExtras.feedRate);
    ['settingMin','settingMax','settingDefault','rpmMin','rpmMax','rpmDefault']
      .forEach(k => setField(k, editingExtras[k]));
    setField('settingValues', Array.isArray(g.settingValues) ? g.settingValues.join(', ') : (g.settingValues || ''));
    if (!g.settingType) setField('settingType', 'numeric');
  } else {
    setField('settingType', 'numeric');
  }
  toggleSettingSections();
  document.getElementById('dye-modal-delete').classList.toggle('dye-hidden', !g);
  // One button, both directions: this page is the only place an archived grinder is listed,
  // so if it could not bring one back, archiving would strand it exactly as the Beanconqueror
  // import used to (nothing else in DYE2 ever wrote the flag, and nothing showed it).
  const archiveBtn = document.getElementById('dye-modal-archive');
  archiveBtn.classList.toggle('dye-hidden', !g);
  archiveBtn.textContent = editingArchived ? 'UNARCHIVE' : 'ARCHIVE';
  document.getElementById('dye-modal-backdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('dye-modal-backdrop').classList.remove('open');
  editingId = null;
}

async function submitForm() {
  const fd = new FormData(form());
  const fields = {};
  ['model','burrs','burrType','burrSize','feedRate','notes','settingType','settingSmallStep','settingBigStep','rpmSmallStep','rpmBigStep','settingValues',
   'settingMin','settingMax','settingDefault','rpmMin','rpmMax','rpmDefault']
    .forEach(k => { fields[k] = fd.get(k); });
  const body = buildGrinderBody(fields, !!editingId, editingExtras);
  // A reversed range silently breaks every clamp that reads it, so it is refused at the one
  // place it can be entered rather than defended at each of the places it is used.
  const ex = body.extras || {};
  const reversed = [['Setting', ex.settingMin, ex.settingMax], ['RPM', ex.rpmMin, ex.rpmMax]]
    .find(([, lo, hi]) => lo != null && hi != null && lo > hi);
  if (reversed) {
    const errEl = document.getElementById('dye-modal-error');
    errEl.textContent = reversed[0] + ' Min must not be greater than ' + reversed[0] + ' Max.';
    errEl.classList.remove('dye-hidden');
    return;
  }

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

// Archive is the reversible one, and it is NOT delete: the grinder leaves the pickers but
// stays in the database, so recipes that name it keep working and shots keep resolving it.
// PUT deep-merges, so the flag alone is the whole body -- every other field is left as is.
async function toggleArchive() {
  if (!editingId) return;
  const next = !editingArchived;
  if (next && !confirm('Archive this grinder? It leaves the pickers but keeps working in the recipes and shots that name it, and you can bring it back from this page.')) return;
  try {
    const res = await fetch('/api/v1/grinders/' + editingId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: next }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + await res.text());
    closeModal();
    await reload();
  } catch (err) {
    const errEl = document.getElementById('dye-modal-error');
    errEl.textContent = (next ? 'Archive' : 'Unarchive') + ' failed: ' + err.message;
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
    // Archived included: this page is the one place they are listed, and without them an
    // archived grinder is invisible, unpickable and impossible to bring back or delete.
    // The pickers (grinder-picker, auto-fav-edit, recipe-edit chips) deliberately do NOT
    // pass the flag -- an archived grinder must not be offered for a new shot.
    const result = await getGrinders(true);
    grindersCache = Array.isArray(result) ? result : (result.items || []);
  } catch (e) {
    console.error('Failed to load grinders:', e);
    grindersCache = [];
  }
  renderGrinderCards(document.getElementById('dye-cards-grid'));
}

/* The grid shows which grinder the next shot will use, so the live workflow is the source of
   truth for the highlight -- not sessionStorage, which a Streamline-side change would not
   touch. Match by id; older workflow state only ever carried the model string. */
async function loadSelectedGrinder() {
  try {
    const ctx = ((await getWorkflow()) || {}).context || {};
    selectedGrinderId = (ctx.grinderId && grindersCache.some(g => g.id === ctx.grinderId))
      ? ctx.grinderId
      : ((grindersCache.find(g => grinderName(g) === ctx.grinderModel) || {}).id || null);
  } catch (e) { console.warn('Could not read the live workflow:', e); }
}

async function initializeDyeGrinders() {
  const grid = document.getElementById('dye-cards-grid');
  if (!grid) return;

  await reload();
  await loadSelectedGrinder();
  renderGrinderCards(grid);
  setupSortButtons((sort) => { currentSort = sort; renderGrinderCards(grid); });

  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) {
    const g = grindersCache.find(x => x.id === editId);
    if (g) openModal(g);
  }

  const searchInput = document.getElementById('dye-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim().toLowerCase(); renderGrinderCards(grid); });
  }

  document.getElementById('dye-done-btn')?.addEventListener('click', () => window.history.back());
  document.getElementById('dye-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('dye-modal-delete')?.addEventListener('click', deleteGrinder);
  document.getElementById('dye-modal-archive')?.addEventListener('click', toggleArchive);
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
    body: devPageShell("Grinders", content, styles, [devApiScript, buildGrinderBodyScript, grinderLimitsScript, cardLongPressScript, pageScript]),
  };
}
