/** Shared CSS + HTML factories for DYE2 redesign pages (1920×1200 layout) */

import { lucideIcon } from './lucide';

// ── Sort sidebar ─────────────────────────────────────────────────────────────

export function sortSidebarCss(): string {
  return `
  .dye-sort-btn {
    width: 135px; padding: 14px 0;
    border: 2px solid var(--mimoja-blue); border-radius: 23px;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 21px;
    text-align: center; color: var(--mimoja-blue); background: transparent;
    cursor: pointer; white-space: nowrap;
  }
  .dye-sort-btn.dye-sort-active { background: var(--mimoja-blue); color: #fff; }
  `;
}

export function sortSidebarHtml(): string {
  const sorts = [
    ['recent', 'Recent'],
    ['oldest', 'Oldest'],
    ['az', 'A-Z'],
    ['za', 'Z-A'],
    ['most-used', 'Most Used'],
    ['least-used', 'Least Used'],
  ];
  const buttons = sorts
    .map(([key, label], i) =>
      `<button class="dye-sort-btn${i === 0 ? ' dye-sort-active' : ''}" data-sort="${key}">${label}</button>`
    )
    .join('\n    ');
  return `<div id="dye-sort-sidebar" class="flex flex-col gap-[30px] items-start pt-[30px] pl-[37px] pr-[30px] shrink-0">
    ${buttons}
  </div>`;
}

// ── Picker page cards ─────────────────────────────────────────────────────────

export function pickerCardCss(): string {
  return `
  .dye-card {
    border-radius: 15px; display: flex; flex-direction: column;
    align-items: flex-start; justify-content: center; padding: 16px 20px;
    font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 400;
    cursor: pointer; background: var(--box-color);
    border: 1px solid var(--profile-button-outline-color);
    color: var(--text-primary); transition: background 0.15s, color 0.15s;
    user-select: none; min-height: 90px;
  }
  .dye-card:hover { opacity: 0.85; }
  .dye-card.dye-card-selected { background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff; }
  .dye-card-add {
    border-color: var(--mimoja-blue); color: var(--mimoja-blue);
    font-weight: 700; flex-direction: row; align-items: center;
    justify-content: center; gap: 8px; background: var(--box-color);
  }
  .dye-card-add svg { stroke: var(--mimoja-blue); }
  .dye-card-name { font-size: 24px; font-weight: 600; line-height: 1.3; }
  .dye-card-sub  { font-size: 20px; font-weight: 400; opacity: 0.7; margin-top: 2px; }
  .dye-card-divider { border: none; border-top: 1px solid var(--profile-button-outline-color); width: 100%; margin: 8px 0; }
  .dye-card-date { font-size: 18px; font-weight: 400; opacity: 0.6; }
  .dye-card.dye-card-selected .dye-card-divider { border-color: rgba(255,255,255,0.3); }
  #dye-cards-container::-webkit-scrollbar { width: 45px; }
  #dye-cards-container::-webkit-scrollbar-track { background: transparent; }
  #dye-cards-container::-webkit-scrollbar-thumb {
    background: var(--profile-button-outline-color);
    border-radius: 53px; border: 14px solid transparent;
    background-clip: padding-box;
  }
  `;
}

// ── Picker page header ────────────────────────────────────────────────────────

export function pickerHeaderHtml(
  title: string,
  primaryLabel: string,
  primaryDisabled = true
): string {
  const opacity = primaryDisabled ? ' opacity-50' : '';
  return `<div class="flex justify-between items-center px-[37px] border-b border-[var(--profile-button-outline-color)] bg-[var(--box-color)] h-[165px] shrink-0">
    <h1 class="text-[38px] font-bold text-[var(--text-primary)] no-select">${title}</h1>
    <div class="flex items-center gap-[16px]">
      <button id="dye-cancel-btn" class="flex justify-center items-center w-[240px] h-[82px] rounded-[68px] font-bold text-[24px] text-[var(--text-primary)]">CANCEL</button>
      <button id="dye-confirm-btn" class="bg-[var(--mimoja-blue)] text-white flex items-center justify-center w-[240px] h-[82px] rounded-[68px] font-bold text-[24px]${opacity}">${primaryLabel}</button>
    </div>
  </div>`;
}

// ── Stepper ──────────────────────────────────────────────────────────────────

export function stepperCss(): string {
  return `
  .dye-stepper-btn {
    display: flex; align-items: center; justify-content: center;
    width: 72px; height: 72px; background: #EDEDED;
    border-radius: 15px; cursor: pointer; flex-shrink: 0;
  }
  .dye-stepper-val {
    font-weight: 700; font-size: 26px; color: var(--text-primary);
    text-align: center; min-width: 72px;
  }
  .dye-stepper-sub {
    font-size: 18px; font-weight: 600; color: var(--text-primary); text-align: center;
  }
  .dye-stepper-label { font-weight: 700; font-size: 24px; color: var(--mimoja-blue); }
  `;
}

export function stepperHtml(
  idPrefix: string,
  label: string,
  labelWidth = '75px',
  showSub = false,
  subHtml = ''
): string {
  const minusSvg = lucideIcon('minus', 28, 'var(--text-primary)', 2.5);
  const plusSvg  = lucideIcon('plus',  28, 'var(--text-primary)', 2.5);
  // subHtml renders under the label (e.g. a Flow|Time mode toggle) as a left column.
  const labelBlock = subHtml
    ? `<div class="flex flex-col" style="width:${labelWidth};flex-shrink:0">
         <span class="dye-stepper-label">${label}</span>
         ${subHtml}
       </div>`
    : `<span class="dye-stepper-label" style="width:${labelWidth};flex-shrink:0">${label}</span>`;
  return `<div class="flex items-center gap-[18px]">
    ${labelBlock}
    <div class="flex items-center gap-[15px]">
      <button id="${idPrefix}-minus" class="dye-stepper-btn">${minusSvg}</button>
      <div class="flex flex-col items-center" style="min-width:72px">
        <span id="${idPrefix}-value" class="dye-stepper-val">—</span>
        ${showSub ? `<span id="${idPrefix}-sub" class="dye-stepper-sub"></span>` : ''}
      </div>
      <button id="${idPrefix}-plus" class="dye-stepper-btn">${plusSvg}</button>
    </div>
  </div>`;
}

// ── Preset strip (beneath a stepper) ─────────────────────────────────────────

export function presetStripCss(): string {
  return `
  .dye-preset {
    font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 400;
    color: var(--text-primary-disabled); background: none; border: none;
    cursor: pointer; padding: 0; white-space: nowrap;
  }
  .dye-preset.dye-preset-active { color: var(--mimoja-blue); font-weight: 700; }
  `;
}

// opts.kind='ratio' + opts.basis='re-dose' → a "1:R" preset sets the value to (basis dose × R), in grams.
export function presetStripHtml(idPrefix: string, presets: string[], opts: { kind?: string; basis?: string } = {}): string {
  const attrs = (opts.kind ? ` data-kind="${opts.kind}"` : '') + (opts.basis ? ` data-basis="${opts.basis}"` : '');
  const items = presets
    .map(p => `<button class="dye-preset" data-preset="${p}" data-for="${idPrefix}"${attrs}>${p}</button>`)
    .join('');
  return `<div id="${idPrefix}-presets" class="flex items-center gap-[30px] mt-[6px]">${items}</div>`;
}

// ── Toggle switch row ─────────────────────────────────────────────────────────

export function toggleCss(): string {
  return `
  .dye-toggle-track {
    position: relative; width: 64px; height: 36px; border-radius: 9999px;
    background: #D1D5DB; transition: background 0.2s; cursor: pointer;
    flex-shrink: 0; display: flex; align-items: center; padding: 4px;
  }
  .dye-toggle-track.on { background: var(--mimoja-blue); justify-content: flex-end; }
  .dye-toggle-thumb {
    width: 28px; height: 28px; border-radius: 9999px; background: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  .dye-toggle-icon-on  { display: none; }
  .dye-toggle-icon-off { display: flex; }
  .dye-toggle-track.on .dye-toggle-icon-on  { display: flex; }
  .dye-toggle-track.on .dye-toggle-icon-off { display: none; }
  .dye-toggle-row {
    display: flex; align-items: center; gap: 20px;
    padding: 20px 0; border-bottom: 1px solid var(--profile-button-outline-color);
  }
  .dye-toggle-row:last-child { border-bottom: none; }
  .dye-toggle-label { font-size: 24px; font-weight: 400; color: var(--text-primary); width: 160px; flex-shrink: 0; }
  .dye-toggle-value { font-size: 24px; font-weight: 700; color: var(--text-primary); flex: 1; }
  .dye-toggle-value.off { color: var(--text-primary-disabled); font-weight: 400; }
  .dye-toggle-edit { cursor: pointer; flex-shrink: 0; opacity: 0.55; }
  .dye-toggle-edit:hover { opacity: 1; }
  `;
}

export function toggleRowHtml(
  id: string,
  label: string,
  value: string,
  initialOn = true,
  editable = true
): string {
  const checkSvg  = lucideIcon('check', 16, '#fff', 2.5);
  const xSvg      = lucideIcon('x',     16, '#9CA3AF', 2.5);
  const pencilSvg = lucideIcon('pencil', 26, 'var(--mimoja-blue)', 2);
  return `<div class="dye-toggle-row" id="${id}-row">
    <div id="${id}-track" class="dye-toggle-track${initialOn ? ' on' : ''}" data-toggle="${id}">
      <div class="dye-toggle-thumb">
        <span class="dye-toggle-icon-on">${checkSvg}</span>
        <span class="dye-toggle-icon-off">${xSvg}</span>
      </div>
    </div>
    <span class="dye-toggle-label">${label}</span>
    <span id="${id}-value" class="dye-toggle-value${initialOn ? '' : ' off'}">${value}</span>
    ${editable ? `<button class="dye-toggle-edit" data-edit="${id}">${pencilSvg}</button>` : ''}
  </div>`;
}

// ── Segment control (Yes / No) ────────────────────────────────────────────────

export function segmentControlHtml(id: string, options: string[], initialIdx = 0): string {
  const buttons = options
    .map(
      (opt, i) =>
        `<button class="dye-seg-btn${i === initialIdx ? ' active' : ''}" data-idx="${i}" data-for="${id}" style="flex:1;font-family:'Inter',sans-serif;font-size:24px;font-weight:600;cursor:pointer;${i === initialIdx ? 'background:var(--mimoja-blue);color:#fff;' : 'background:transparent;color:var(--text-primary);'}">${opt}</button>`
    )
    .join('');
  return `<div id="${id}" class="flex rounded-[15px] overflow-hidden border-2 border-[var(--mimoja-blue)]" style="height:72px">${buttons}</div>`;
}

// ── Star rating ───────────────────────────────────────────────────────────────

export function starRatingHtml(id: string, count = 5, size = 36): string {
  const stars = Array.from(
    { length: count },
    (_, i) =>
      `<svg class="dye-star" data-index="${i + 1}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  ).join('');
  return `<div id="${id}" class="flex items-center gap-[8px]">${stars}</div>`;
}

// ── Expandable text field (text + expand icon → picker) ───────────────────────

export function expandFieldHtml(id: string, label: string, placeholder = '—'): string {
  const expandSvg = lucideIcon('maximize-2', 26, 'var(--mimoja-blue)', 2);
  return `<div class="flex items-center gap-[18px]">
    <span class="dye-stepper-label" style="width:120px;flex-shrink:0">${label}</span>
    <div class="flex items-center flex-1 border border-[var(--profile-button-outline-color)] rounded-[12px] px-[20px] h-[72px] bg-[var(--box-color)] gap-[12px]">
      <span id="${id}-text" class="flex-1 text-[24px] font-normal text-[var(--text-primary)]">${placeholder}</span>
      <button id="${id}-expand" class="flex-shrink-0">${expandSvg}</button>
    </div>
  </div>`;
}

// ── Text input field ──────────────────────────────────────────────────────────

export function textInputHtml(id: string, label: string, placeholder = ''): string {
  const pencilSvg = lucideIcon('pencil', 26, 'var(--text-primary-disabled)', 2);
  return `<div class="flex items-center gap-[18px]">
    <span class="dye-stepper-label" style="width:180px;flex-shrink:0">${label}</span>
    <div class="flex items-center flex-1 border border-[var(--profile-button-outline-color)] rounded-[12px] px-[20px] h-[72px] bg-[var(--box-color)] gap-[12px]">
      <span id="${id}-value" class="flex-1 text-[24px] font-normal text-[var(--text-primary)]">${placeholder}</span>
      <button id="${id}-edit" class="flex-shrink-0">${pencilSvg}</button>
    </div>
  </div>`;
}

// ── Script helper: sort sidebar wiring ───────────────────────────────────────

export const sortSidebarScript = `
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
`;

// ── Script helper: toggle row wiring ─────────────────────────────────────────

export const toggleRowScript = `
function setupToggleRows(onChange) {
  document.querySelectorAll('.dye-toggle-track').forEach(track => {
    track.addEventListener('click', () => {
      const id = track.dataset.toggle;
      const isOn = track.classList.toggle('on');
      const valEl = document.getElementById(id + '-value');
      if (valEl) valEl.classList.toggle('off', !isOn);
      if (onChange) onChange(id, isOn);
    });
  });
}
function isToggleOn(id) {
  const t = document.getElementById(id + '-track');
  return t ? t.classList.contains('on') : false;
}
`;

// ── Script helper: enjoyment <-> stars scale conversion ───────────────────────
// annotations.enjoyment is Decaid's own 0-10 field, not de1app's or
// visualizer.coffee's 0-100 espresso_enjoyment. Decaid converts at those two
// boundaries itself (decentespresso/decaid#887): its importer rescales on the
// way in, its Visualizer plugin multiplies by 10 on the way out, and
// PUT /api/v1/shots/<id> rejects anything outside 0-10. So DYE2's only job is
// 0-10 <-> 5 stars, a plain halving and doubling.
//
// There is deliberately no value-range heuristic here. Under the 0-10 contract
// 1-5 are ordinary canonical ratings, so the old "an integer in [1,5] must be a
// raw star index" rule (issue #7) would now misread normal data — a stored 4
// is 2 stars, not 4. Rows written by that old bug are indistinguishable from
// valid 0-10 values; repairing them needs provenance, not a guess from the
// number, and is out of scope here.

export const enjoymentScaleScript = `
function enjoymentToStars(enjoyment) {
  if (enjoyment == null || enjoyment === '') return 0;
  const n = parseFloat(enjoyment);
  if (isNaN(n)) return 0;
  const canonical = Math.min(Math.max(n, 0), 10);
  return Math.round(canonical / 2);
}
function starsToEnjoyment(stars) {
  const n = Number(stars);
  if (!Number.isFinite(n)) return 0;
  const clampedStars = Math.min(Math.max(Math.round(n), 0), 5);
  return clampedStars * 2;
}
`;

// ── Script helper: star rating wiring ────────────────────────────────────────

export const starRatingScript = `
function setupStarRating(containerId, onRate) {
  const container = document.getElementById(containerId);
  if (!container) return;
  function updateStars(rating) {
    container.querySelectorAll('.dye-star').forEach(star => {
      const idx = parseInt(star.getAttribute('data-index'));
      if (idx <= rating) {
        star.setAttribute('fill', 'var(--mimoja-blue)');
        star.setAttribute('stroke', 'var(--mimoja-blue)');
      } else {
        star.setAttribute('fill', 'none');
        star.setAttribute('stroke', 'var(--profile-button-outline-color)');
      }
    });
  }
  container.querySelectorAll('.dye-star').forEach(star => {
    star.addEventListener('click', () => {
      const idx = parseInt(star.getAttribute('data-index'));
      updateStars(idx);
      if (onRate) onRate(idx);
    });
  });
  return updateStars;
}
`;

// ── Script helper: segment control wiring ────────────────────────────────────

export const segmentControlScript = `
function setupSegmentControls() {
  document.querySelectorAll('.dye-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parentId = btn.dataset.for;
      const parent = document.getElementById(parentId);
      if (!parent) return;
      parent.querySelectorAll('.dye-seg-btn').forEach((b, i) => {
        const active = i === parseInt(btn.dataset.idx);
        b.classList.toggle('active', active);
        b.style.background = active ? 'var(--mimoja-blue)' : 'transparent';
        b.style.color = active ? '#fff' : 'var(--text-primary)';
      });
    });
  });
}
`;

// ── Script helper: preset strip wiring ───────────────────────────────────────

export const presetStripScript = `
// Apply a preset chip to its stepper value. Ratio chips ("1:R") compute grams from the basis dose.
function applyPreset(btn) {
  const idPrefix = btn.dataset.for;
  const valueEl = document.getElementById(idPrefix + '-value');
  if (btn.dataset.kind === 'ratio') {
    const m = /^1:([0-9.]+)$/.exec(btn.dataset.preset || '');
    const r = m ? parseFloat(m[1]) : NaN;
    const basisEl = document.getElementById((btn.dataset.basis || '') + '-value');
    const dose = basisEl ? parseFloat(basisEl.textContent) : NaN;
    if (valueEl && !isNaN(r) && !isNaN(dose)) {
      valueEl.textContent = (Math.round(dose * r * 10) / 10) + 'g';
      valueEl.dataset.ratio = String(r);
      const sub = document.getElementById(idPrefix + '-sub');
      if (sub) sub.textContent = '(1:' + r + ')';
    }
  } else if (valueEl) {
    valueEl.textContent = btn.dataset.preset;
  }
  const container = document.getElementById(idPrefix + '-presets');
  if (container) container.querySelectorAll('.dye-preset').forEach(b => b.classList.toggle('dye-preset-active', b === btn));
}
// Long-press a preset to COPY the current stepper value into that preset chip.
function attachPresetLongPress(btn) {
  if (btn.dataset.kind === 'ratio') return;   // ratio chips represent a ratio, not a grams value
  let longFired = false, timer = null;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener('pointerdown', () => {
    longFired = false; clear();
    timer = setTimeout(() => {
      timer = null;
      const valueEl = document.getElementById(btn.dataset.for + '-value');
      const v = valueEl ? valueEl.textContent : '';
      if (!v || v === '—') return;
      longFired = true;
      btn.dataset.preset = v;
      btn.textContent = v;
      const container = document.getElementById(btn.dataset.for + '-presets');
      if (container) container.querySelectorAll('.dye-preset').forEach(b => b.classList.toggle('dye-preset-active', b === btn));
    }, 500);
  });
  ['pointerup','pointerleave','pointercancel'].forEach(ev => btn.addEventListener(ev, clear));
  // Swallow the click that follows a long-press so it doesn't also write the preset back onto the value.
  btn.addEventListener('click', (e) => { if (longFired) { e.stopImmediatePropagation(); e.preventDefault(); longFired = false; } }, true);
}
function setupPresetStrips() {
  document.querySelectorAll('.dye-preset').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn));
    attachPresetLongPress(btn);
  });
}
function syncPresetActive(idPrefix, currentVal) {
  const container = document.getElementById(idPrefix + '-presets');
  if (!container) return;
  container.querySelectorAll('.dye-preset').forEach(b => {
    b.classList.toggle('dye-preset-active', b.dataset.preset === String(currentVal));
  });
}
`;
