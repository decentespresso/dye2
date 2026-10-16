import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";

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
    height: 80px;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', sans-serif;
    font-size: 22px;
    font-weight: 500;
    cursor: pointer;
    background: var(--box-color);
    border: 1px solid var(--profile-button-outline-color);
    color: var(--text-primary);
    transition: background 0.15s, color 0.15s;
    user-select: none;
    padding: 0 16px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dye-card:hover { opacity: 0.85; }
  .dye-card.dye-card-selected {
    background: var(--mimoja-blue);
    border-color: var(--mimoja-blue);
    color: #fff;
  }
  .dye-card-add {
    border: 2px solid var(--mimoja-blue);
    color: var(--mimoja-blue);
    font-weight: 700;
    gap: 8px;
    background: var(--box-color);
  }
  .dye-card-add svg { stroke: var(--mimoja-blue); }

  .dye-confirm-disabled {
    background: var(--fav-button-wait, #e0e0e0);
    color: var(--text-primary-disabled, #aaa);
    cursor: not-allowed;
  }
  .dye-confirm-enabled {
    background: var(--mimoja-blue);
    color: #fff;
    cursor: pointer;
  }

  #dye-cards-container::-webkit-scrollbar { width: 36px; }
  #dye-cards-container::-webkit-scrollbar-track { background: transparent; }
  #dye-cards-container::-webkit-scrollbar-thumb {
    background: var(--profile-button-outline-color);
    border-radius: 9999px;
    border: 12px solid transparent;
    background-clip: padding-box;
  }
`;

const content = `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col">

  <!-- Top bar -->
  <div class="flex justify-between items-center px-[38px] border-b border-[var(--profile-button-outline-color)] bg-[var(--box-color)] h-[134px] shrink-0">
    <h1 class="text-[36px] font-bold text-[var(--text-primary)]">Select Roaster</h1>
    <div class="flex items-center gap-[14px]">
      <button id="dye-cancel-btn" class="flex items-center justify-center h-[60px] px-[30px] rounded-[9999px] font-bold text-[24px] text-[var(--text-primary)] cursor-pointer">
        CANCEL
      </button>
      <button id="dye-confirm-btn" class="flex items-center gap-[10px] justify-center h-[60px] px-[30px] rounded-[9999px] font-bold text-[24px] dye-confirm-disabled" disabled>
        <span>SELECT ROASTER</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  </div>

  <!-- Body: sort rail + grid -->
  <div class="flex flex-1 overflow-hidden">

    <!-- Sort rail -->
    <div id="dye-sort-sidebar" class="flex flex-col gap-[18px] items-stretch pt-[28px] px-[20px] shrink-0 w-[150px]">
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
      sortItems(getRoasterItems(), currentSort, 'name'),
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
