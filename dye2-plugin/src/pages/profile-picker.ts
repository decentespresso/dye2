import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";

// Mirrors grinder-picker chrome (top bar + CANCEL/CONFIRM, search + sort rail, 3-col grid).
// Opened from "See All Profiles" in recipe-edit; returns the pick via sessionStorage and,
// in workflow mode, PUTs the chosen profile onto /workflow.
const styles = `
  .dye-sort-btn {
    width: 100%; padding: 12px 0;
    border: 2px solid var(--mimoja-blue); border-radius: 9999px;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 19px;
    text-align: center; color: var(--mimoja-blue); background: transparent;
    cursor: pointer; white-space: nowrap;
  }
  .dye-sort-btn.dye-sort-active { background: var(--mimoja-blue); color: #fff; border-color: var(--mimoja-blue); }

  /* Fixed height so every card is the same size regardless of notes length. */
  .dye-card {
    width: 100%; height: 172px; border-radius: 15px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 14px 18px; font-family: 'Inter', sans-serif; cursor: pointer;
    background: var(--box-color); border: 1px solid var(--profile-button-outline-color);
    color: var(--text-primary); transition: background 0.15s, color 0.15s; user-select: none; gap: 6px;
    overflow: hidden;
  }
  .dye-card:hover { opacity: 0.85; }
  .dye-card.dye-card-selected { background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff; }

  .dye-card-name  { font-size: 22px; font-weight: 600; line-height: 1.3; }
  .dye-card-sub   { font-size: 18px; font-weight: 400; opacity: 0.7; }
  /* Notes clamp to 2 lines; a "Read more" reveals the rest in a modal so cards stay uniform. */
  .dye-card-note  { font-size: 17px; font-weight: 400; opacity: 0.6; line-height: 1.3;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .dye-card-readmore { font-size: 16px; font-weight: 600; color: var(--mimoja-blue); cursor: pointer; }
  .dye-card.dye-card-selected .dye-card-sub,
  .dye-card.dye-card-selected .dye-card-note { opacity: 0.85; }
  .dye-card.dye-card-selected .dye-card-readmore { color: #fff; text-decoration: underline; }

  /* Full-note modal */
  .pp-modal-backdrop { position: fixed; inset: 0; background: var(--overlay-scrim);
    display: none; align-items: center; justify-content: center; z-index: 1000; }
  .pp-modal-backdrop.open { display: flex; }
  .pp-modal { background: var(--box-color); color: var(--text-primary); border-radius: 18px;
    max-width: 640px; width: 86%; max-height: 74vh; overflow-y: auto; padding: 30px 34px;
    font-family: 'Inter', sans-serif; }
  .pp-modal-title { font-size: 26px; font-weight: 700; margin-bottom: 14px; }
  .pp-modal-body { font-size: 20px; line-height: 1.5; white-space: pre-wrap; }
  .pp-modal-close { margin-top: 22px; height: 56px; padding: 0 34px; border: none; border-radius: 9999px;
    background: var(--mimoja-blue); color: #fff; font-size: 20px; font-weight: 700; cursor: pointer; }

  .dye-confirm-disabled { background: var(--fav-button-wait, #e0e0e0); color: var(--text-primary-disabled, #aaa); cursor: not-allowed; }
  .dye-confirm-enabled  { background: var(--mimoja-blue); color: #fff; cursor: pointer; }

  .dye-search-wrap { position: relative; width: 100%; margin-bottom: 10px; }
  .dye-search-input {
    width: 100%; height: 54px; border-radius: 12px; border: none; background: var(--field-bg);
    padding: 0 46px 0 16px; font-family: 'Inter', sans-serif; font-size: 19px;
    color: var(--text-primary); outline: none;
  }
  .dye-search-input::placeholder { color: var(--text-primary-disabled); }
  .dye-search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }

  #dye-cards-container::-webkit-scrollbar { width: 36px; }
  #dye-cards-container::-webkit-scrollbar-track { background: transparent; }
  #dye-cards-container::-webkit-scrollbar-thumb {
    background: var(--profile-button-outline-color); border-radius: 9999px;
    border: 12px solid transparent; background-clip: padding-box;
  }
`;

const content = `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col">

  <div class="flex justify-between items-center px-[38px] border-b border-[var(--profile-button-outline-color)] bg-[var(--box-color)] h-[134px] shrink-0">
    <h1 class="text-[36px] font-bold text-[var(--text-primary)]">Select Profile</h1>
    <div class="flex items-center gap-[14px]">
      <button id="dye-cancel-btn" class="flex items-center justify-center h-[60px] px-[30px] rounded-[9999px] font-bold text-[24px] text-[var(--text-primary)] cursor-pointer">CANCEL</button>
      <button id="dye-confirm-btn" class="flex items-center gap-[10px] justify-center h-[60px] px-[30px] rounded-[9999px] font-bold text-[24px] dye-confirm-disabled" disabled>
        <span>CONFIRM</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  </div>

  <div class="flex flex-1 overflow-hidden">
    <div id="dye-sort-sidebar" class="flex flex-col gap-[18px] items-stretch pt-[28px] px-[20px] shrink-0 w-[180px]">
      <div class="dye-search-wrap">
        <input id="dye-search-input" class="dye-search-input" type="text" placeholder="Search" />
        <svg class="dye-search-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary-disabled)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
      <button class="dye-sort-btn dye-sort-active" data-sort="az">A-Z</button>
      <button class="dye-sort-btn" data-sort="za">Z-A</button>
      <button class="dye-sort-btn" data-sort="recent">Recent</button>
      <button class="dye-sort-btn" data-sort="oldest">Oldest</button>
    </div>

    <div id="dye-cards-container" class="flex-1 overflow-y-auto pt-[28px] px-[38px] pb-[28px]">
      <div id="dye-cards-grid" class="grid grid-cols-3 gap-[20px]"></div>
    </div>
  </div>

  <div id="pp-note-modal" class="pp-modal-backdrop">
    <div class="pp-modal">
      <div id="pp-note-title" class="pp-modal-title"></div>
      <div id="pp-note-body" class="pp-modal-body"></div>
      <button id="pp-note-close" class="pp-modal-close">Close</button>
    </div>
  </div>
</div>
`;

const pageScript = `
let profilesCache = [];
let searchQuery = '';
let selectedProfileId = null;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The bridge nests profile fields under p.profile; keep flat fallbacks for safety.
function profileName(p) { const pr = (p && p.profile) || {}; return pr.title || p.title || p.name || 'Untitled Profile'; }
function profileSub(p)  { const pr = (p && p.profile) || {}; return pr.author || pr.beverage_type || p.author || p.beverage_type || p.type || ''; }
function profileMeta(p) { const pr = (p && p.profile) || {}; return pr.notes || p.notes || p.description || ''; }

function matchesSearch(p) {
  if (!searchQuery) return true;
  const hay = profileName(p) + ' ' + profileSub(p) + ' ' + profileMeta(p);
  return hay.toLowerCase().includes(searchQuery);
}

function sortItems(items, sortKey) {
  const sorted = [...items];
  const name = (p) => profileName(p).toLowerCase();
  const ts = (p) => new Date(p.createdAt || p.updatedAt || 0);
  switch (sortKey) {
    case 'za':     sorted.sort((a, b) => name(b).localeCompare(name(a))); break;
    case 'recent': sorted.sort((a, b) => ts(b) - ts(a)); break;
    case 'oldest': sorted.sort((a, b) => ts(a) - ts(b)); break;
    default:       sorted.sort((a, b) => name(a).localeCompare(name(b))); break;
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

function updateConfirmButton(confirmBtn) {
  if (!confirmBtn) return;
  if (selectedProfileId) {
    confirmBtn.disabled = false;
    confirmBtn.classList.remove('dye-confirm-disabled');
    confirmBtn.classList.add('dye-confirm-enabled');
  } else {
    confirmBtn.disabled = true;
    confirmBtn.classList.add('dye-confirm-disabled');
    confirmBtn.classList.remove('dye-confirm-enabled');
  }
}

function renderProfileCards(grid, profiles, confirmBtn) {
  grid.innerHTML = '';
  profiles.forEach(p => {
    const card = document.createElement('div');
    card.className = 'dye-card';
    const sub = profileSub(p);
    const meta = profileMeta(p);
    card.innerHTML =
      '<div class="dye-card-name">' + esc(profileName(p)) + '</div>' +
      (sub ? '<div class="dye-card-sub">' + esc(sub) + '</div>' : '') +
      (meta ? '<div class="dye-card-note">' + esc(meta) + '</div>' : '');
    if (p.id === selectedProfileId) card.classList.add('dye-card-selected');
    card.addEventListener('click', () => {
      grid.querySelectorAll('.dye-card').forEach(c => c.classList.remove('dye-card-selected'));
      card.classList.add('dye-card-selected');
      selectedProfileId = p.id;
      sessionStorage.setItem('dye_selectedProfileId', p.id);
      sessionStorage.setItem('dye_selectedProfileTitle', profileName(p));
      updateConfirmButton(confirmBtn);
    });
    grid.appendChild(card);
    // Add "Read more" only when the note is actually clamped, so cards stay uniform height.
    if (meta) {
      const noteEl = card.querySelector('.dye-card-note');
      if (noteEl && noteEl.scrollHeight > noteEl.clientHeight + 2) {
        const rm = document.createElement('div');
        rm.className = 'dye-card-readmore';
        rm.textContent = 'Read more';
        rm.addEventListener('click', (e) => { e.stopPropagation(); openNoteModal(profileName(p), meta); });
        card.appendChild(rm);
      }
    }
  });
}

function openNoteModal(title, body) {
  const m = document.getElementById('pp-note-modal');
  const t = document.getElementById('pp-note-title');
  const b = document.getElementById('pp-note-body');
  if (t) t.textContent = title;
  if (b) b.textContent = body;
  if (m) m.classList.add('open');
}
function setupNoteModal() {
  const m = document.getElementById('pp-note-modal');
  document.getElementById('pp-note-close')?.addEventListener('click', () => m?.classList.remove('open'));
  m?.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
}

// Page-relative routes work under both runtimes (.../dye2.reaplugin/<route> on the tablet,
// /<route> on the dev server). Never history.back(): the dashboard opens this page directly,
// and other callers may have pushed pages in between, so route explicitly and always leave a
// way out via the dashboard.
const DASHBOARD_ROUTE = 'dashboard';
function leaveProfilePicker(returnTo) {
  window.location.href = returnTo || DASHBOARD_ROUTE;
}

async function initializeDyeProfiles() {
  const grid = document.getElementById('dye-cards-grid');
  const cancelBtn = document.getElementById('dye-cancel-btn');
  const confirmBtn = document.getElementById('dye-confirm-btn');
  if (!grid) return;

  selectedProfileId = sessionStorage.getItem('dye_selectedProfileId') || null;
  // ?return=<route> → hand the pick back via dye_selectedProfile* keys instead of the workflow.
  const returnTo = new URLSearchParams(location.search).get('return');
  let currentSort = 'az';

  try {
    const result = await getProfiles();
    profilesCache = Array.isArray(result) ? result : (result.items || []);
  } catch (e) {
    console.error('Failed to load profiles:', e);
    profilesCache = [];
  }

  function render() {
    renderProfileCards(grid, sortItems(profilesCache.filter(matchesSearch), currentSort), confirmBtn);
  }

  render();
  updateConfirmButton(confirmBtn);
  setupNoteModal();
  setupSortButtons((sort) => { currentSort = sort; render(); });

  const searchInput = document.getElementById('dye-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim().toLowerCase(); render(); });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      ['dye_selectedProfileId','dye_selectedProfileTitle'].forEach(k => sessionStorage.removeItem(k));
      leaveProfilePicker(returnTo);
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!selectedProfileId) return;
      // Return-target flow (recipe-edit): leave the pick in sessionStorage, hand control back.
      if (returnTo) { window.location.href = returnTo; return; }
      const p = profilesCache.find(x => x.id === selectedProfileId);
      // A profile of only { id, title } would merely RENAME the loaded profile: PUT
      // /workflow deep-merges, so the old steps survive and the machine keeps brewing
      // the previous profile under the new name (issue #10). getProfiles() already gave
      // us the full record, so send its Profile; the thin stub stays as the fallback for
      // a record with no usable steps, with a warning, as resolveFullProfileById does.
      const full = p && p.profile && Array.isArray(p.profile.steps) && p.profile.steps.length ? p.profile : null;
      if (!full) console.warn('profile-picker: no full record for ' + selectedProfileId + ' -- sending id/title only, brew steps will not change');
      try {
        await updateWorkflow({ profile: full || { id: selectedProfileId, title: p ? profileName(p) : '' } });
      } catch (e) { console.warn('workflow update failed:', e); }
      leaveProfilePicker(null);
    });
  }
}

initializeDyeProfiles().catch(e => console.error('initializeDyeProfiles failed:', e));
`;

export function renderProfilePickerPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Select Profile", content, styles, [devApiScript, pageScript]),
  };
}
