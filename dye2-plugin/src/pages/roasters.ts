import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { dyePickerCss, dyePickerHeaderHtml, dyePickerRailHtml } from "../utils/shared-components";

// Shared picker CSS comes from dyePickerCss. A roaster card is a single line of text, so it keeps
// its own fixed-height, ellipsised look: these rules are id-scoped so they beat the shared
// multi-line .dye-card / .dye-card-add without depending on source order.
const roasterCardCss = `
  #dye-cards-grid .dye-card {
    height: 80px;
    min-height: 0;
    flex-direction: row;
    gap: 0;
    padding: 0 16px;
    font-size: 22px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #dye-cards-grid .dye-card-add { font-weight: 700; gap: 8px; }
`;

const styles = dyePickerCss + roasterCardCss;

const content = `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col">

  ${dyePickerHeaderHtml('Select Roaster', `<span>SELECT ROASTER</span>
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
let beansCache = null;
let selectedRoaster = null;

function sortItems(items, sortKey, nameField) {
  const sorted = [...items];
  switch (sortKey) {
    case 'recent':  sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    case 'oldest':  sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
    case 'az':      sorted.sort((a, b) => (a[nameField] || '').localeCompare(b[nameField] || '')); break;
    case 'za':      sorted.sort((a, b) => (b[nameField] || '').localeCompare(a[nameField] || '')); break;
    default:        sorted.sort((a, b) => (a[nameField] || '').localeCompare(b[nameField] || '')); break;
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

function renderCards(grid, items, nameField, selectedValue, onSelect, addLabel, onAdd) {
  grid.innerHTML = '';

  const addCard = document.createElement('div');
  addCard.className = 'dye-card dye-card-add';
  addCard.innerHTML = '<span>' + addLabel + '</span><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  if (onAdd) addCard.addEventListener('click', onAdd);
  grid.appendChild(addCard);

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'dye-card';
    const value = typeof item === 'string' ? item : item[nameField];
    card.textContent = value;
    if (value === selectedValue) card.classList.add('dye-card-selected');
    card.addEventListener('click', () => {
      grid.querySelectorAll('.dye-card').forEach(c => c.classList.remove('dye-card-selected'));
      card.classList.add('dye-card-selected');
      onSelect(item);
    });
    grid.appendChild(card);
  });
}

// Reached from bean-picker when the bean has no roaster, so add-bean may sit on the history
// stack — history.back() would land on that form instead of the caller. Route explicitly,
// same precedence as bean-picker, with the dashboard as the always-available way out.
const EDIT_SHOT_ROUTE = 'edit-shot';
const DASHBOARD_ROUTE = 'dashboard';
function leaveRoasters() {
  const ret = sessionStorage.getItem('dye_pickerReturn');
  sessionStorage.removeItem('dye_pickerReturn');
  if (ret) { window.location.href = ret; return; }
  if (sessionStorage.getItem('dye_editShotReturn') === '1') { window.location.href = EDIT_SHOT_ROUTE; return; }
  window.location.href = DASHBOARD_ROUTE;
}

async function initializeDyeRoasters() {
  const grid = document.getElementById('dye-cards-grid');
  const cancelBtn = document.getElementById('dye-cancel-btn');
  const confirmBtn = document.getElementById('dye-confirm-btn');
  if (!grid) return;

  // Pre-select roaster from the bean chosen in step 1
  const beanRoaster = sessionStorage.getItem('dye_selectedBeanRoaster') || '';
  selectedRoaster = sessionStorage.getItem('dye_selectedRoaster') || beanRoaster || null;
  if (selectedRoaster) sessionStorage.setItem('dye_selectedRoaster', selectedRoaster);
  let currentSort = 'recent';
  let searchQuery = '';

  if (!beansCache) {
    try { beansCache = await getBeans(); }
    catch (e) { console.error('Failed to load beans:', e); beansCache = []; }
  }

  function getRoasterItems() {
    const roasterMap = new Map();
    (Array.isArray(beansCache) ? beansCache : (beansCache.items || [])).forEach(bean => {
      if (!bean.roaster) return;
      if (!roasterMap.has(bean.roaster)) {
        roasterMap.set(bean.roaster, { name: bean.roaster, createdAt: bean.createdAt, updatedAt: bean.updatedAt });
      } else {
        const existing = roasterMap.get(bean.roaster);
        if (new Date(bean.createdAt) > new Date(existing.createdAt)) existing.createdAt = bean.createdAt;
      }
    });
    return Array.from(roasterMap.values());
  }

  function updateConfirmButton() {
    if (!confirmBtn) return;
    if (selectedRoaster) {
      confirmBtn.disabled = false;
      confirmBtn.classList.remove('dye-confirm-disabled');
      confirmBtn.classList.add('dye-confirm-enabled');
    } else {
      confirmBtn.disabled = true;
      confirmBtn.classList.add('dye-confirm-disabled');
      confirmBtn.classList.remove('dye-confirm-enabled');
    }
  }

  function render() {
    renderCards(
      grid,
      sortItems(getRoasterItems().filter(r => !searchQuery || (r.name || '').toLowerCase().includes(searchQuery)), currentSort, 'name'),
      'name',
      selectedRoaster,
      (roaster) => {
        selectedRoaster = roaster.name;
        sessionStorage.setItem('dye_selectedRoaster', roaster.name);
        updateConfirmButton();
      },
      'ADD NEW ROASTER +',
      () => { window.location.href = 'add-bean'; }
    );
  }

  render();
  updateConfirmButton();
  setupSortButtons((sort) => { currentSort = sort; render(); });
  const searchInput = document.getElementById('dye-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim().toLowerCase(); render(); });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      ['dye_selectedBeanId','dye_selectedBeanName','dye_selectedBeanRoaster','dye_selectedRoaster']
        .forEach(k => sessionStorage.removeItem(k));
      leaveRoasters();
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!selectedRoaster) return;
      const coffeeName    = sessionStorage.getItem('dye_selectedBeanName') || '';
      const coffeeRoaster = selectedRoaster;
      const beanBatchId   = sessionStorage.getItem('dye_selectedBatchId') || undefined;
      try {
        await updateWorkflow({ context: markDye({ coffeeName, coffeeRoaster, beanBatchId }) });
      } catch (e) {
        console.error('Failed to update workflow:', e);
      }
      ['dye_selectedBeanId','dye_selectedBeanName','dye_selectedBeanRoaster','dye_selectedRoaster','dye_selectedBatchId']
        .forEach(k => sessionStorage.removeItem(k));
      leaveRoasters();
    });
  }
}

initializeDyeRoasters().catch(e => console.error('initializeDyeRoasters failed:', e));

// Returning from an add flow restores this page frozen from bfcache — reload to re-fetch.
window.addEventListener('pageshow', function(e) { if (e.persisted) window.location.reload(); });
`;

export function renderRoastersPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Select Roaster", content, styles, [devApiScript, pageScript]),
  };
}
