import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { beanDeleteScript } from "../utils/bean-delete";
import { datePickerCss, datePickerScript } from "../utils/date-picker";
import { lucideIcon } from "../utils/lucide";
import { toggleCss, toggleRowScript } from "../utils/shared-components";

const CALENDAR_ICON = `<svg class="dye-form-icon" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`;

function sectionTitle(text: string): string {
  return `<div class="dye-form-section-title">${text}</div>`;
}

function textFieldRow(id: string, label: string, placeholder = "", rowAttrs = ""): string {
  return `
      <div class="flex gap-[30px] items-center"${rowAttrs}>
        <label class="dye-form-label">${label}</label>
        <div class="dye-form-input-wrap">
          <input id="${id}" type="text" class="dye-form-input" placeholder="${placeholder}" autocomplete="off">
        </div>
      </div>`;
}

function splitFieldRow(label: string, fields: Array<{ id: string; type?: string; placeholder?: string }>): string {
  const inputs = fields
    .map(
      (f) => `
          <div class="dye-form-input-wrap">
            <input id="${f.id}" type="${f.type || "text"}" ${f.type === "number" ? 'step="any"' : ""} class="dye-form-input" placeholder="${f.placeholder || ""}" autocomplete="off">
          </div>`
    )
    .join("");
  return `
      <div class="flex gap-[30px] items-center">
        <label class="dye-form-label">${label}</label>
        <div class="flex gap-[16px] flex-1">${inputs}</div>
      </div>`;
}

function dateFieldRow(id: string, label: string): string {
  return `
      <div class="flex gap-[30px] items-center">
        <label class="dye-form-label">${label}</label>
        <div class="dye-form-input-wrap">
          <input id="${id}" type="date" class="dye-form-input" readonly data-dye-datepicker>
          ${CALENDAR_ICON}
        </div>
      </div>`;
}

function toggleFieldRow(id: string, label: string, rowId?: string): string {
  const checkSvg = lucideIcon("check", 16, "#fff", 2.5);
  const xSvg = lucideIcon("x", 16, "#9CA3AF", 2.5);
  return `
      <div class="flex gap-[30px] items-center"${rowId ? ` id="${rowId}"` : ""}>
        <label class="dye-form-label">${label}</label>
        <div id="${id}-track" class="dye-toggle-track" data-toggle="${id}">
          <div class="dye-toggle-thumb">
            <span class="dye-toggle-icon-on">${checkSvg}</span>
            <span class="dye-toggle-icon-off">${xSvg}</span>
          </div>
        </div>
      </div>`;
}

function textareaFieldRow(id: string, label: string, placeholder = "", small = false): string {
  return `
      <div class="flex gap-[30px] items-start">
        <label class="dye-form-label pt-[23px]">${label}</label>
        <div class="dye-form-input-wrap dye-form-textarea-wrap">
          <textarea id="${id}" class="dye-form-textarea${small ? " dye-form-textarea-sm" : ""}" placeholder="${placeholder}" rows="${small ? 5 : 12}"></textarea>
        </div>
      </div>`;
}

const styles = `
  ${datePickerCss()}
  ${toggleCss()}
  .dye-form-label {
    width: 135px;
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    font-size: 24px;
    color: var(--mimoja-blue);
    flex-shrink: 0;
    line-height: 1.2;
  }
  .dye-form-input-wrap {
    flex: 1;
    border: 2px solid var(--profile-button-outline-color);
    display: flex;
    align-items: center;
    padding: 23px 15px 23px 23px;
    position: relative;
  }
  .dye-form-input {
    flex: 1;
    font-family: 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 400;
    color: var(--text-primary);
    background: transparent;
    border: none;
    outline: none;
    line-height: 1.2;
    width: 100%;
  }
  .dye-form-input::placeholder { color: var(--low-contrast-white); }
  .dye-form-icon { flex-shrink: 0; margin-left: 8px; }

  .dye-form-section-title {
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mimoja-blue);
    padding-top: 20px;
    margin-top: 4px;
    border-top: 1px solid var(--profile-button-outline-color);
  }

  .dye-dropdown-wrap { position: relative; }
  .dye-dropdown-toggle { cursor: pointer; transition: transform 0.2s; }
  .dye-dropdown-wrap.dye-dropdown-open .dye-dropdown-toggle { transform: rotate(180deg); }

  .dye-dropdown-menu {
    display: none;
    position: absolute;
    top: 100%;
    left: -2px;
    right: -2px;
    max-height: 360px;
    overflow-y: auto;
    background: var(--profile-button-background-color);
    border: 2px solid var(--profile-button-outline-color);
    border-top: none;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  }
  .dye-dropdown-wrap.dye-dropdown-open .dye-dropdown-menu { display: block; }
  .dye-dropdown-item {
    padding: 18px 23px;
    font-family: 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 400;
    color: var(--text-primary);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dye-dropdown-item:hover, .dye-dropdown-item.dye-dropdown-highlight { background: var(--mimoja-blue); color: #fff; }
  .dye-dropdown-item + .dye-dropdown-item { border-top: 1px solid var(--profile-button-outline-color); }
  .dye-dropdown-empty { padding: 18px 23px; font-family: 'Inter', sans-serif; font-size: 22px; color: var(--low-contrast-white); font-style: italic; }
  .dye-dropdown-menu::-webkit-scrollbar { width: 12px; }
  .dye-dropdown-menu::-webkit-scrollbar-track { background: transparent; }
  .dye-dropdown-menu::-webkit-scrollbar-thumb { background: var(--profile-button-outline-color); border-radius: 6px; border: 3px solid transparent; background-clip: padding-box; }

  .dye-form-textarea-wrap { align-items: flex-start; }
  .dye-form-textarea {
    flex: 1;
    font-family: 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 400;
    color: var(--text-primary);
    background: transparent;
    border: none;
    outline: none;
    line-height: 1.2;
    width: 100%;
    height: 479px;
    min-height: 120px;
    resize: vertical;
    padding-bottom: 34px;
  }
  /* ponytail: native resize grip is ~16px — too small for a finger. Enlarge + make it visible. */
  .dye-form-textarea::-webkit-resizer {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, transparent 55%, var(--profile-button-outline-color) 55%, var(--profile-button-outline-color) 70%, transparent 70%, transparent 80%, var(--profile-button-outline-color) 80%);
  }
  .dye-form-textarea.dye-form-textarea-sm { height: 160px; min-height: 100px; }
  .dye-form-textarea::placeholder { color: var(--low-contrast-white); }
`;

const content = `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col">
  <div class="flex justify-between items-center px-[37px] border-b border-[var(--profile-button-outline-color)] bg-[var(--box-color)] h-[165px]">
    <h1 id="dye-add-bean-title" class="text-[38px] font-bold text-[var(--text-primary)] no-select">Add New Beans</h1>
    <div class="flex items-center gap-[16px]">
      <button id="dye-delete-btn" style="display:none" class="flex justify-center items-center w-[240px] h-[82px] py-[27px] rounded-[68px] font-bold text-[24px] text-[#C0392B]">
        DELETE
      </button>
      <button id="dye-cancel-btn" class="flex justify-center items-center w-[240px] h-[82px] py-[27px] rounded-[68px] font-bold text-[24px] text-[var(--text-primary)]">
        CANCEL
      </button>
      <button id="dye-confirm-btn" class="bg-[var(--mimoja-blue)] text-white flex items-center justify-center w-[240px] h-[82px] py-[27px] rounded-[68px] font-bold text-[24px]">
        CONFIRM
      </button>
    </div>
  </div>
  <div id="dye-delete-error" style="display:none" class="px-[37px] py-[12px] text-[20px] text-[#C0392B]"></div>
  <div class="flex-1 overflow-y-auto flex justify-center">
    <div id="dye-add-bean-form" class="flex flex-col gap-[30px] w-[1200px] py-[40px]">
      <div class="flex gap-[30px] items-center">
        <label class="dye-form-label">Beans</label>
        <div class="dye-form-input-wrap dye-dropdown-wrap">
          <input id="dye-bean-name" type="text" class="dye-form-input" placeholder="Enter bean name..." autocomplete="off">
          <svg class="dye-form-icon dye-dropdown-toggle" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          <div id="dye-bean-name-dropdown" class="dye-dropdown-menu"></div>
        </div>
      </div>
      <div class="flex gap-[30px] items-center">
        <label class="dye-form-label">Roaster</label>
        <div class="dye-form-input-wrap dye-dropdown-wrap">
          <input id="dye-bean-roaster" type="text" class="dye-form-input" placeholder="Enter or select roaster..." autocomplete="off">
          <svg class="dye-form-icon dye-dropdown-toggle" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          <div id="dye-bean-roaster-dropdown" class="dye-dropdown-menu"></div>
        </div>
      </div>
      ${dateFieldRow("dye-bean-roast-date", "Roast Date")}

      ${sectionTitle("Origin")}
      ${textFieldRow("dye-bean-species", "Species", "arabica, robusta...")}
      ${textFieldRow("dye-bean-processing", "Processing", "washed, natural, honey...")}
      ${textFieldRow("dye-bean-country", "Country", "Ethiopia...")}
      ${textFieldRow("dye-bean-region", "Region", "Yirgacheffe...")}
      ${textFieldRow("dye-bean-producer", "Producer", "Farm or producer name...")}
      ${textFieldRow("dye-bean-variety", "Variety", "Heirloom, 74110...")}
      ${splitFieldRow("Altitude (m)", [
        { id: "dye-bean-altitude-min", type: "number", placeholder: "Min" },
        { id: "dye-bean-altitude-max", type: "number", placeholder: "Max" },
      ])}
      ${toggleFieldRow("dye-bean-decaf", "Decaf")}
      ${textFieldRow("dye-bean-decaf-process", "Decaf Process", "Swiss Water, CO2...", ' id="dye-bean-decaf-process-row" style="display:none"')}

      ${sectionTitle("Roast & Batch Details")}
      ${textFieldRow("dye-batch-roast-level", "Roast Level", "light, medium, dark...")}
      ${textFieldRow("dye-batch-harvest-date", "Harvest Date", "e.g. 2025 dry season...")}
      ${splitFieldRow("Quality Score", [{ id: "dye-batch-quality-score", type: "number", placeholder: "e.g. 87.5" }])}
      ${toggleFieldRow("dye-batch-frozen", "Frozen")}

      ${sectionTitle("Purchase & Storage")}
      ${splitFieldRow("Price / Currency", [
        { id: "dye-batch-price", type: "number", placeholder: "Price" },
        { id: "dye-batch-currency", type: "text", placeholder: "EUR" },
      ])}
      ${splitFieldRow("Weight (g)", [
        { id: "dye-batch-weight", type: "number", placeholder: "Total weight" },
        { id: "dye-batch-weight-remaining", type: "number", placeholder: "Remaining" },
      ])}
      ${dateFieldRow("dye-batch-buy-date", "Buy Date")}
      ${dateFieldRow("dye-batch-open-date", "Open Date")}
      ${dateFieldRow("dye-batch-best-before-date", "Best Before")}
      ${dateFieldRow("dye-batch-freeze-date", "Freeze Date")}
      ${dateFieldRow("dye-batch-unfreeze-date", "Unfreeze Date")}

      ${sectionTitle("Notes")}
      ${textareaFieldRow("dye-bean-notes", "Bean Notes", "Enter tasting notes, description...")}
      ${textareaFieldRow("dye-batch-notes", "Batch Notes", "Notes about this specific batch...", true)}
    </div>
  </div>
</div>
`;

const pageScript = `
${beanDeleteScript}
let beansCache = null;

function setupDropdown(inputId, dropdownId, items) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const wrap = input && input.closest('.dye-dropdown-wrap');
  if (!input || !dropdown || !wrap) return;

  const chevron = wrap.querySelector('.dye-dropdown-toggle');
  let highlightIndex = -1;

  function renderOptions(filter) {
    const filtered = filter
      ? items.filter(v => v.toLowerCase().includes(filter.toLowerCase()))
      : items;
    dropdown.innerHTML = '';
    highlightIndex = -1;
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dye-dropdown-empty';
      empty.textContent = filter ? 'No matches found' : 'No items available';
      dropdown.appendChild(empty);
      return;
    }
    filtered.forEach((value, i) => {
      const item = document.createElement('div');
      item.className = 'dye-dropdown-item';
      item.textContent = value;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = value;
        closeDropdown();
        input.dispatchEvent(new Event('change'));
      });
      item.addEventListener('mouseenter', () => { clearHighlight(); highlightIndex = i; item.classList.add('dye-dropdown-highlight'); });
      item.addEventListener('mouseleave', () => { item.classList.remove('dye-dropdown-highlight'); highlightIndex = -1; });
      dropdown.appendChild(item);
    });
  }

  function clearHighlight() { dropdown.querySelectorAll('.dye-dropdown-highlight').forEach(el => el.classList.remove('dye-dropdown-highlight')); }
  function openDropdown() { wrap.classList.add('dye-dropdown-open'); renderOptions(input.value); }
  function closeDropdown() { wrap.classList.remove('dye-dropdown-open'); highlightIndex = -1; }
  function isOpen() { return wrap.classList.contains('dye-dropdown-open'); }

  if (chevron) {
    chevron.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isOpen() ? closeDropdown() : (input.focus(), openDropdown());
    });
  }

  input.addEventListener('focus', () => openDropdown());
  input.addEventListener('blur', () => setTimeout(closeDropdown, 150));
  input.addEventListener('input', () => { if (!isOpen()) openDropdown(); renderOptions(input.value); });
  input.addEventListener('keydown', (e) => {
    if (!isOpen()) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { openDropdown(); e.preventDefault(); } return; }
    const visibleItems = dropdown.querySelectorAll('.dye-dropdown-item');
    if (visibleItems.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); clearHighlight(); highlightIndex = (highlightIndex + 1) % visibleItems.length; visibleItems[highlightIndex].classList.add('dye-dropdown-highlight'); visibleItems[highlightIndex].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); clearHighlight(); highlightIndex = highlightIndex <= 0 ? visibleItems.length - 1 : highlightIndex - 1; visibleItems[highlightIndex].classList.add('dye-dropdown-highlight'); visibleItems[highlightIndex].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlightIndex >= 0 && visibleItems[highlightIndex]) { input.value = visibleItems[highlightIndex].textContent; closeDropdown(); input.dispatchEvent(new Event('change')); } else { closeDropdown(); } }
    else if (e.key === 'Escape') { closeDropdown(); }
  });
}

function latestBatch(batches) {
  const arr = Array.isArray(batches) ? batches : (batches && batches.items ? batches.items : []);
  if (!arr.length) return null;
  return arr.slice().sort((a, b) => new Date(b.roastDate || 0) - new Date(a.roastDate || 0))[0];
}

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function textOrNull(id) { return val(id) || null; }
function numOrNull(id) { const v = val(id); if (!v) return null; const n = parseFloat(v); return isNaN(n) ? null : n; }
function isoDateOrNull(id) { const v = val(id); return v ? new Date(v).toISOString() : null; }
function setVal(id, v) { const el = document.getElementById(id); if (el && v != null) el.value = v; }
function setDateVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ? new Date(v).toISOString().slice(0, 10) : ''; }
function setToggle(id, on) {
  const track = document.getElementById(id + '-track');
  if (track) track.classList.toggle('on', !!on);
}

function buildBeanPayload() {
  const varietyRaw = val('dye-bean-variety');
  const variety = varietyRaw ? varietyRaw.split(',').map(s => s.trim()).filter(Boolean) : null;
  const altMin = val('dye-bean-altitude-min');
  const altMax = val('dye-bean-altitude-max');
  const altitude = (altMin && altMax) ? [parseInt(altMin, 10), parseInt(altMax, 10)] : null;
  return {
    roaster: val('dye-bean-roaster'),
    name: val('dye-bean-name'),
    notes: textOrNull('dye-bean-notes'),
    species: textOrNull('dye-bean-species'),
    processing: textOrNull('dye-bean-processing'),
    country: textOrNull('dye-bean-country'),
    region: textOrNull('dye-bean-region'),
    producer: textOrNull('dye-bean-producer'),
    variety: variety,
    altitude: altitude,
    decaf: isToggleOn('dye-bean-decaf'),
    decafProcess: textOrNull('dye-bean-decaf-process'),
  };
}

function buildBatchPayload() {
  const weight = numOrNull('dye-batch-weight');
  // Mirrors the bridge's own create-time behaviour (weightRemaining defaults to weight)
  // so leaving "Remaining" blank while setting a weight doesn't null out the remaining stock.
  const weightRemaining = numOrNull('dye-batch-weight-remaining') ?? weight;
  return {
    roastDate: isoDateOrNull('dye-bean-roast-date'),
    roastLevel: textOrNull('dye-batch-roast-level'),
    harvestDate: textOrNull('dye-batch-harvest-date'),
    qualityScore: numOrNull('dye-batch-quality-score'),
    price: numOrNull('dye-batch-price'),
    currency: textOrNull('dye-batch-currency'),
    weight: weight,
    weightRemaining: weightRemaining,
    buyDate: isoDateOrNull('dye-batch-buy-date'),
    openDate: isoDateOrNull('dye-batch-open-date'),
    bestBeforeDate: isoDateOrNull('dye-batch-best-before-date'),
    freezeDate: isoDateOrNull('dye-batch-freeze-date'),
    unfreezeDate: isoDateOrNull('dye-batch-unfreeze-date'),
    frozen: isToggleOn('dye-batch-frozen'),
    notes: textOrNull('dye-batch-notes'),
  };
}

function hasAnyBatchData(payload) {
  return payload.frozen === true || Object.keys(payload).some(k => k !== 'frozen' && payload[k] != null);
}

function updateDecafProcessVisibility() {
  const row = document.getElementById('dye-bean-decaf-process-row');
  if (row) row.style.display = isToggleOn('dye-bean-decaf') ? '' : 'none';
}

async function initializeDyeAddBean() {
  const cancelBtn = document.getElementById('dye-cancel-btn');
  const confirmBtn = document.getElementById('dye-confirm-btn');
  const titleEl = document.getElementById('dye-add-bean-title');
  const nameInput = document.getElementById('dye-bean-name');
  const roasterInput = document.getElementById('dye-bean-roaster');
  const roastDateInput = document.getElementById('dye-bean-roast-date');

  if (!nameInput) return;

  const editBeanId = new URLSearchParams(location.search).get('id');
  let editBatch = null;

  if (!beansCache) {
    try { beansCache = await getBeans(); }
    catch (e) { console.error('Failed to load beans:', e); beansCache = []; }
  }

  const beanNames = [...new Set(beansCache.map(b => b.name).filter(Boolean))].sort();
  const roasters = [...new Set(beansCache.map(b => b.roaster).filter(Boolean))].sort();

  setupDropdown('dye-bean-name', 'dye-bean-name-dropdown', beanNames);
  setupDropdown('dye-bean-roaster', 'dye-bean-roaster-dropdown', roasters);
  setupToggleRows((id) => { if (id === 'dye-bean-decaf') updateDecafProcessVisibility(); });

  if (editBeanId) {
    if (titleEl) titleEl.textContent = 'Edit Beans';
    try {
      const [bean, batches] = await Promise.all([getBean(editBeanId), getBeanBatches(editBeanId)]);
      editBatch = latestBatch(batches);

      nameInput.value = bean.name || '';
      roasterInput.value = bean.roaster || '';
      setVal('dye-bean-notes', bean.notes);
      setVal('dye-bean-species', bean.species);
      setVal('dye-bean-processing', bean.processing);
      setVal('dye-bean-country', bean.country);
      setVal('dye-bean-region', bean.region);
      setVal('dye-bean-producer', bean.producer);
      setVal('dye-bean-variety', Array.isArray(bean.variety) ? bean.variety.join(', ') : '');
      if (Array.isArray(bean.altitude) && bean.altitude.length === 2) {
        setVal('dye-bean-altitude-min', bean.altitude[0]);
        setVal('dye-bean-altitude-max', bean.altitude[1]);
      }
      setToggle('dye-bean-decaf', !!bean.decaf);
      setVal('dye-bean-decaf-process', bean.decafProcess);
      updateDecafProcessVisibility();

      if (editBatch) {
        if (editBatch.roastDate) roastDateInput.value = new Date(editBatch.roastDate).toISOString().slice(0, 10);
        setVal('dye-batch-roast-level', editBatch.roastLevel);
        setVal('dye-batch-harvest-date', editBatch.harvestDate);
        setVal('dye-batch-quality-score', editBatch.qualityScore);
        setVal('dye-batch-price', editBatch.price);
        setVal('dye-batch-currency', editBatch.currency);
        setVal('dye-batch-weight', editBatch.weight);
        setVal('dye-batch-weight-remaining', editBatch.weightRemaining);
        setDateVal('dye-batch-buy-date', editBatch.buyDate);
        setDateVal('dye-batch-open-date', editBatch.openDate);
        setDateVal('dye-batch-best-before-date', editBatch.bestBeforeDate);
        setDateVal('dye-batch-freeze-date', editBatch.freezeDate);
        setDateVal('dye-batch-unfreeze-date', editBatch.unfreezeDate);
        setToggle('dye-batch-frozen', !!editBatch.frozen);
        setVal('dye-batch-notes', editBatch.notes);
      }
    } catch (e) {
      console.error('Failed to load bean for editing:', e);
    }
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => { window.location.href = 'bean-picker'; });
  }

  const deleteBtn = document.getElementById('dye-delete-btn');
  if (deleteBtn && editBeanId) {
    deleteBtn.style.display = '';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this bean and all its batches? Shots that used it keep their saved name, but the bean is gone.')) return;
      const errEl = document.getElementById('dye-delete-error');
      try {
        const batchIds = await deleteBeanWithBatches(editBeanId, { getBeanBatches, deleteBeanBatch, deleteBean });
        if (sessionStorage.getItem('dye_selectedBeanId') === editBeanId || batchIds.includes(sessionStorage.getItem('dye_selectedBatchId'))) {
          ['dye_selectedBeanId','dye_selectedBeanName','dye_selectedBeanRoaster','dye_selectedBatchId','dye_selectedRoastDate']
            .forEach(k => sessionStorage.removeItem(k));
        }
        beansCache = null;
        window.location.href = 'bean-picker';
      } catch (e) {
        console.error('Failed to delete bean:', e);
        if (errEl) { errEl.textContent = 'Delete failed: ' + e.message + '. Some batches may already be deleted.'; errEl.style.display = ''; }
      }
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const beanPayload = buildBeanPayload();

      if (!beanPayload.name || !beanPayload.roaster) {
        const nameWrap = nameInput.closest('.dye-form-input-wrap');
        const roasterWrap = roasterInput.closest('.dye-form-input-wrap');
        if (nameWrap) nameWrap.style.borderColor = beanPayload.name ? '' : '#DA515E';
        if (roasterWrap) roasterWrap.style.borderColor = beanPayload.roaster ? '' : '#DA515E';
        return;
      }

      const batchPayload = buildBatchPayload();

      try {
        if (editBeanId) {
          await updateBean(editBeanId, beanPayload);
          if (editBatch) await updateBeanBatch(editBatch.id, batchPayload);
          else if (hasAnyBatchData(batchPayload)) await createBeanBatch(editBeanId, batchPayload);
        } else {
          const bean = await createBean(beanPayload);
          if (bean.id && hasAnyBatchData(batchPayload)) await createBeanBatch(bean.id, batchPayload);
        }
        beansCache = null;
        window.location.href = 'bean-picker';
      } catch (e) {
        console.error('Failed to save bean:', e);
      }
    });
  }
}

initializeDyeAddBean().catch(e => console.error('initializeDyeAddBean failed:', e));
`;

export function renderAddBeanPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Add New Beans", content, styles, [devApiScript, datePickerScript(), toggleRowScript, pageScript]),
  };
}
