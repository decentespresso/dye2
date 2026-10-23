import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { cardLongPressScript } from "../utils/fav-card-tap";
import { dyePickerCss, dyePickerHeaderHtml, dyePickerRailHtml } from "../utils/shared-components";

const content = `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col">

  ${dyePickerHeaderHtml('Select Beans', `<span>SELECT ROASTER</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`)}

  <!-- Body: sort rail + grid -->
  <div class="flex flex-1 overflow-hidden">

    ${dyePickerRailHtml([['recent', 'Recent'], ['oldest', 'Oldest'], ['az', 'A-Z'], ['za', 'Z-A'], ['most-used', 'Most Used'], ['least-used', 'Least Used']])}

    <!-- Card grid -->
    <div id="dye-cards-container" class="flex-1 overflow-y-auto pt-[28px] px-[38px] pb-[28px]">
      <div id="dye-cards-grid" class="grid grid-cols-3 gap-[20px]"></div>
    </div>

  </div>
</div>
`;

const pageScript = `
${cardLongPressScript}

let beansCache = [];
let batchMap = {};
let searchQuery = '';
let selectedBeanId = null;
let fromEditShot = false;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function latestBatch(batches) {
  const arr = Array.isArray(batches) ? batches : (batches && batches.items ? batches.items : []);
  if (!arr.length) return null;
  return arr.slice().sort((a, b) => new Date(b.roastDate || 0) - new Date(a.roastDate || 0))[0];
}

function beanLine1(bean, batch) {
  const parts = [bean.name];
  if (batch && batch.harvestDate) parts.push(batch.harvestDate);
  if (bean.country) parts.push(bean.country);
  if (bean.processing) parts.push(bean.processing);
  if (bean.variety && bean.variety.length) parts.push(bean.variety.join(', '));
  return parts.filter(Boolean).join(', ');
}

function beanLine3(batch) {
  if (!batch || !batch.roastDate) return '';
  const rd = new Date(batch.roastDate);
  if (isNaN(rd.getTime())) return '';
  const dateStr = rd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const days = Math.floor((Date.now() - rd.getTime()) / 86400000);
  return dateStr + ' (' + days + ' days off-roast)';
}

function matchesSearch(bean) {
  if (!searchQuery) return true;
  const hay = beanLine1(bean, batchMap[bean.id]) + ' ' + (bean.roaster || '');
  return hay.toLowerCase().includes(searchQuery);
}

function sortItems(items, sortKey) {
  const sorted = [...items];
  switch (sortKey) {
    case 'recent':  sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    case 'oldest':  sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
    case 'az':      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
    case 'za':      sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
    default:        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
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
  const enabled = !!selectedBeanId;
  confirmBtn.disabled = !enabled;
  confirmBtn.classList.toggle('dye-confirm-disabled', !enabled);
  confirmBtn.classList.toggle('dye-confirm-enabled', enabled);
  // Only send to the roaster picker when the chosen bean has no roaster yet.
  const roaster = sessionStorage.getItem('dye_selectedBeanRoaster') || '';
  const label = confirmBtn.querySelector('span');
  if (label) label.textContent = (fromEditShot || roaster) ? 'CONFIRM' : 'SELECT ROASTER';
}

function renderBeanCards(grid, beans, confirmBtn) {
  grid.innerHTML = '';

  const addCard = document.createElement('div');
  addCard.className = 'dye-card dye-card-add';
  addCard.innerHTML = '<span>ADD NEW BEANS</span><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  addCard.addEventListener('click', () => { window.location.href = 'add-bean'; });
  grid.appendChild(addCard);

  const bcCard = document.createElement('div');
  bcCard.className = 'dye-card dye-card-add';
  bcCard.innerHTML = '<span>IMPORT FROM BEANCONQUEROR</span>';
  bcCard.addEventListener('click', () => { window.location.href = 'bc-import'; });
  grid.appendChild(bcCard);

  beans.forEach(bean => {
    const card = document.createElement('div');
    card.className = 'dye-card';
    const batch = batchMap[bean.id];
    const line3 = beanLine3(batch);
    card.title = 'Long-press to edit';
    card.innerHTML =
      '<div class="dye-card-name">' + esc(beanLine1(bean, batch) || 'Unnamed') + '</div>' +
      (bean.roaster ? '<div class="dye-card-sub">' + esc(bean.roaster) + '</div>' : '') +
      (line3 ? '<div class="dye-card-date">' + esc(line3) + '</div>' : '');
    // Long-press opens the editor (the plain tap stays select-only, no second-tap-to-edit).
    attachCardLongPress(card, () => { window.location.href = 'add-bean?id=' + encodeURIComponent(bean.id); });
    if (bean.id === selectedBeanId) card.classList.add('dye-card-selected');
    card.addEventListener('click', () => {
      grid.querySelectorAll('.dye-card').forEach(c => c.classList.remove('dye-card-selected'));
      card.classList.add('dye-card-selected');
      selectedBeanId = bean.id;
      sessionStorage.setItem('dye_selectedBeanId', bean.id);
      sessionStorage.setItem('dye_selectedBeanName', bean.name || '');
      sessionStorage.setItem('dye_selectedBeanRoaster', bean.roaster || '');
      sessionStorage.setItem('dye_selectedBatchId', (batch && batch.id) || '');
      sessionStorage.setItem('dye_selectedRoastDate', (batch && batch.roastDate) || '');
      updateConfirmButton(confirmBtn);
    });
    grid.appendChild(card);
  });
}

// Going through "+ Add new bean" pushes add-bean onto the history stack (and its save
// pushes the picker again), so history.back() no longer lands on the caller — it lands on
// the add-bean form, which is how you get stuck bouncing between the two. Navigate to
// edit-shot by route instead; initEditShot rehydrates its draft from sessionStorage and
// folds in the pick, so it does not care how it was reached.
// Page-relative: resolves to .../dye2.reaplugin/<route> on the tablet and /<route> on the
// dev server, so one string works under both runtimes.
const EDIT_SHOT_ROUTE = 'edit-shot';
const DASHBOARD_ROUTE = 'dashboard';

// add-bean navigates back to a bare /bean-picker, dropping the ?return= the caller passed,
// so remember it for the round trip. Without this a cancel after adding a bean has no idea
// where it came from.
function rememberReturn() {
  const ret = new URLSearchParams(location.search).get('return');
  if (ret) sessionStorage.setItem('dye_pickerReturn', ret);
}
function pickerReturn() {
  return new URLSearchParams(location.search).get('return')
      || sessionStorage.getItem('dye_pickerReturn');
}

// Every exit routes explicitly — never history.back(), which lands on the add-bean form
// once "+ Add new bean" has pushed it onto the stack, stranding the user between the two
// pages. edit-shot and recipe-edit both rehydrate their own drafts, so neither cares how
// it was reached; anything else (e.g. the dashboard's Beans card) falls back to the
// dashboard so there is always a way out.
function leavePicker() {
  const ret = pickerReturn();
  sessionStorage.removeItem('dye_pickerReturn');
  if (ret) { window.location.href = ret; return; }
  if (sessionStorage.getItem('dye_editShotReturn') === '1') { window.location.href = EDIT_SHOT_ROUTE; return; }
  window.location.href = DASHBOARD_ROUTE;
}

async function initializeDyeBeans() {
  const grid = document.getElementById('dye-cards-grid');
  const cancelBtn = document.getElementById('dye-cancel-btn');
  const confirmBtn = document.getElementById('dye-confirm-btn');
  if (!grid) return;

  selectedBeanId = sessionStorage.getItem('dye_selectedBeanId') || null;
  // ?return=<route> → caller (e.g. recipe-edit) wants the pick handed back via the
  // dye_selectedBean* keys, not written to the active workflow. Navigate there on confirm.
  rememberReturn();
  const returnTo = pickerReturn();
  let currentSort = 'recent';

  try {
    const result = await getBeans();
    beansCache = Array.isArray(result) ? result : (result.items || []);
  } catch (e) {
    console.error('Failed to load beans:', e);
    beansCache = [];
  }

  function render() {
    renderBeanCards(grid, sortItems(beansCache.filter(matchesSearch), currentSort), confirmBtn);
  }

  render();
  updateConfirmButton(confirmBtn);
  setupSortButtons((sort) => { currentSort = sort; render(); });

  const searchInput = document.getElementById('dye-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim().toLowerCase(); render(); });
  }

  // ponytail: N+1 batch fetch — fine for a bounded picker list; add ?include=latestBatch to /beans if it gets slow.
  Promise.all(beansCache.map(async (b) => {
    try { batchMap[b.id] = latestBatch(await getBeanBatches(b.id)); }
    catch (e) { batchMap[b.id] = null; }
  })).then(render).catch((e) => console.warn('batch load failed:', e));

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      ['dye_selectedBeanId','dye_selectedBeanName','dye_selectedBeanRoaster','dye_selectedBatchId']
        .forEach(k => sessionStorage.removeItem(k));
      leavePicker();
    });
  }

  // Came from edit-shot (via goToPicker) → return there with the pick instead of the
  // normal bean→roaster flow. Selection is already stashed in sessionStorage on card click.
  fromEditShot = sessionStorage.getItem('dye_editShotReturn') === '1';
  updateConfirmButton(confirmBtn);

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!selectedBeanId) return;
      // Return-target flow (recipe-edit): leave the pick in sessionStorage, hand control back.
      if (returnTo) { sessionStorage.removeItem('dye_pickerReturn'); window.location.href = returnTo; return; }
      const roaster = sessionStorage.getItem('dye_selectedBeanRoaster') || '';
      // Edit-shot round-trips via its draft; hand control back and it folds in the selection.
      if (fromEditShot) { window.location.href = EDIT_SHOT_ROUTE; return; }
      // Bean already has a roaster → no roaster step; write the workflow ourselves (roasters.ts
      // is what normally does this) and return to whatever page opened the picker.
      if (roaster) {
        const coffeeName  = sessionStorage.getItem('dye_selectedBeanName') || '';
        const beanBatchId = sessionStorage.getItem('dye_selectedBatchId') || undefined;
        try { await updateWorkflow({ context: markDye({ coffeeName, coffeeRoaster: roaster, beanBatchId }) }); }
        catch (e) { console.error('Failed to update workflow:', e); }
        ['dye_selectedBeanId','dye_selectedBeanName','dye_selectedBeanRoaster','dye_selectedBatchId','dye_selectedRoastDate']
          .forEach(k => sessionStorage.removeItem(k));
        leavePicker();
      } else {
        window.location.href = 'roasters';
      }
    });
  }
}

initializeDyeBeans().catch(e => console.error('initializeDyeBeans failed:', e));

// Returning from /add-bean restores this page frozen from bfcache — reload to re-fetch.
window.addEventListener('pageshow', function(e) { if (e.persisted) window.location.reload(); });
`;

export function renderBeanPickerPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Select Beans", content, dyePickerCss, [devApiScript, pageScript]),
  };
}
