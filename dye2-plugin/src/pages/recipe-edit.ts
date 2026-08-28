import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { lucideIcon } from "../utils/lucide";
import {
  stepperCss, stepperHtml,
  presetStripCss, presetStripHtml, presetStripScript,
  segmentControlScript,
} from "../utils/shared-components";

const NUM_RECIPES = 5;

const styles = `
  ${stepperCss()}
  ${presetStripCss()}
  /* Figma 2396:728: fixed 270x60 pills, stroke #C5CDDA, text #5F7BA8 */
  .re-tab {
    width: 270px; height: 60px; border-radius: 15px;
    /* ponytail: block + line-height, not flex — text-overflow:ellipsis only works on a block box */
    display: block; line-height: 56px; text-align: center;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 21px;
    border: 2px solid #C5CDDA;
    background: var(--box-color); color: #5F7BA8;
    cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex-shrink: 0; padding: 0 20px;
  }
  .re-tab.active { background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff; }
  .re-label { font-size: 24px; font-weight: 700; color: var(--mimoja-blue); margin-bottom: 8px; }
  /* Figma 2396:747: label sits inline beside the input, 164px wide */
  .re-field-label { font-size: 24px; font-weight: 700; color: var(--mimoja-blue); width: 164px; flex-shrink: 0; }
  /* Figma 2396:749: one bordered box (2px #C9C9C9, square) holding text + edit icon */
  .re-input-row {
    display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;
    border: 2px solid #C9C9C9; background: var(--box-color);
    height: 80px; padding: 0 15px 0 22px;
  }
  .re-input-row:focus-within { border-color: var(--mimoja-blue); }
  .re-input {
    flex: 1; min-width: 0; border: none; height: 100%;
    font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 400;
    color: var(--text-primary); background: transparent; outline: none;
  }
  .re-input-pencil { flex-shrink: 0; opacity: 0.55; cursor: pointer; }
  .re-input-pencil:hover { opacity: 1; }
  /* Name-lookup dropdown for Beverage / Barista / Drinker (previously entered values) */
  .re-combo { position: relative; flex: 1; min-width: 0; }
  /* Matches the auto-fav-edit combo dropdown style (1px outline, 12px radius, soft shadow). */
  .re-combo-drop {
    display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    z-index: 40; max-height: 300px; overflow-y: auto;
    background: var(--box-color); border: 1px solid var(--profile-button-outline-color);
    border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  }
  .re-combo-drop.open { display: block; }
  .re-combo-opt {
    padding: 14px 18px; font-size: 22px; color: var(--text-primary); cursor: pointer;
    border-bottom: 1px solid var(--profile-button-outline-color);
  }
  .re-combo-opt:last-child { border-bottom: none; }
  .re-combo-opt:hover { background: var(--bgmain-color); }
  .re-combo-empty { padding: 14px 18px; font-size: 20px; color: var(--text-primary-disabled); }
  /* Figma 2396:757: strict 3-column grid of 60px-tall pills */
  .re-chip-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
  .re-chip {
    min-height: 60px; border-radius: 15px;
    /* Long bean/profile names don't fit 284px on one line, so wrap to two and let the
       chip grow — the column has vertical slack to spend. -webkit-box + line-clamp
       centres vertically (box-pack on the vertical main axis) and caps at two lines. */
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-box-pack: center;
    -webkit-line-clamp: 2; overflow: hidden; text-align: center;
    font-family: 'Inter', sans-serif; font-size: 21px; font-weight: 600; line-height: 1.2;
    border: 2px solid #C5CDDA;
    background: var(--box-color); color: #5F7BA8;
    cursor: pointer; padding: 6px 16px;
  }
  .re-chip.active { background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff; }
  .re-see-all {
    height: 60px; display: flex; align-items: center; justify-content: center;
    font-size: 21px; font-weight: 600; color: var(--mimoja-blue); cursor: pointer;
  }
  .re-divider { height: 1px; background: var(--profile-button-outline-color); }
  /* Figma 2396:865/910/962: 2px rule between the two steppers in each variables row */
  .re-vrule { width: 2px; align-self: stretch; background: var(--profile-button-outline-color); flex-shrink: 0; }
  .re-var-block { display: flex; flex-direction: column; gap: 8px; }
  .re-var-label { font-size: 22px; font-weight: 700; color: var(--mimoja-blue); margin-bottom: 2px; }
  /* Figma: grinder options are plain text (no box) — active bold blue, inactive grey, wide gaps */
  .re-grinder-chips { display: flex; align-items: center; gap: 32px; overflow-x: auto; padding-bottom: 4px; }
  .re-grinder-chip {
    background: none; border: none; padding: 0;
    font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 600;
    color: #B6C3D7;
    cursor: pointer; white-space: nowrap; flex-shrink: 0;
  }
  .re-grinder-chip.active { color: var(--mimoja-blue); font-weight: 700; }
  /* Figma right column: presets spread across the stepper block width */
  #re-right .re-var-block [id$="-presets"] { justify-content: space-between; }
  .footer-btn-ghost {
    border: 2px solid var(--mimoja-blue); color: var(--mimoja-blue); border-radius: 23px;
    padding: 0 28px; height: 60px; font-size: 21px; font-weight: 600; cursor: pointer;
    font-family: 'Inter', sans-serif; white-space: nowrap; display: flex; align-items: center; gap: 8px;
    background: var(--box-color);
  }
  /* Figma 2386:1884: bordered pill with check | divider | label */
  .re-show-streamline {
    display: flex; align-items: center; gap: 14px;
    border: 2px solid var(--mimoja-blue); border-radius: 23px;
    height: 60px; padding: 0 24px 0 16px; background: var(--box-color);
    font-family: 'Inter', sans-serif; font-size: 21px; font-weight: 600;
    color: var(--mimoja-blue); cursor: pointer;
  }
  .re-show-streamline-icon { flex-shrink: 0; display: flex; align-items: center; }
  .re-show-streamline-sep { width: 2px; height: 36px; background: var(--profile-button-outline-color); flex-shrink: 0; }
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
  /* Steam / Hot Water mode: compact inline text toggle under the label (matches Figma) */
  .re-mode-toggle { display: flex; align-items: center; gap: 10px; margin: 4px 0 0 0; font-size: 19px; font-weight: 600; }
  .re-mode-seg { background: none; border: none; padding: 0; font: inherit; cursor: pointer; color: var(--text-primary-disabled); }
  .re-mode-seg.active { color: var(--mimoja-blue); }
  .re-mode-sep { color: var(--profile-button-outline-color); }
`;

function buildContent(): string {
  const chevUpSvg      = lucideIcon('chevron-up',    24, 'var(--mimoja-blue)', 2.5);
  const checkCircleSvg = lucideIcon('check-circle',  28, 'var(--mimoja-blue)', 2);
  const pencilSvg      = lucideIcon('pencil',        26, 'var(--text-primary-disabled)', 2);

  const tabs = Array.from({ length: NUM_RECIPES }, (_, i) =>
    `<button class="re-tab${i === 0 ? ' active' : ''}" data-recipe="${i}">Recipe ${i + 1}</button>`
  ).join('');

  return `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex flex-col font-['Inter',sans-serif]">

  <!-- Header: title + recipe tabs on the grey strip (Figma 2386:1874) -->
  <div class="flex items-center gap-[48px] px-[38px] h-[124px] shrink-0 bg-[var(--bgmain-color)] border-b border-[var(--profile-button-outline-color)]">
    <span class="text-[30px] font-semibold text-[var(--text-primary)] shrink-0">Edit Recipes</span>
    <div id="re-tabs" class="flex gap-[15px] overflow-x-auto" style="scrollbar-width:none">
      ${tabs}
    </div>
  </div>

  <!-- Two-column body, 50/50 like the Figma columns -->
  <div class="flex flex-1 overflow-hidden">

    <!-- LEFT: recipe metadata -->
    <div id="re-left" class="flex flex-col w-1/2 shrink-0 bg-white border-r border-[var(--profile-button-outline-color)] overflow-y-auto px-[38px] py-[28px] gap-[30px]">

      <div class="flex items-center gap-[30px]">
        <span class="re-field-label">Recipe Name</span>
        <div class="re-input-row">
          <input id="re-name-input" class="re-input" type="text" placeholder="Recipe name…" />
          <button class="re-input-pencil" id="re-name-pencil">${pencilSvg}</button>
        </div>
      </div>

      <div class="re-divider"></div>

      <div>
        <div class="re-label" style="margin-bottom:15px">Assign Bean</div>
        <div class="re-chip-grid" id="re-bean-chips"></div>
      </div>

      <div class="re-divider"></div>

      <div>
        <div class="re-label" style="margin-bottom:15px">Assign Profile</div>
        <div class="re-chip-grid" id="re-profile-chips"></div>
      </div>

      <div class="re-divider"></div>

      <div class="flex items-center gap-[30px]">
        <span class="re-field-label">Beverage</span>
        <div class="re-combo">
          <div class="re-input-row">
            <input id="re-beverage-input" class="re-input" type="text" placeholder="e.g. Cappucino" />
            <button class="re-input-pencil" id="re-beverage-pencil">${pencilSvg}</button>
          </div>
          <div id="re-beverage-drop" class="re-combo-drop"></div>
        </div>
      </div>

      <div class="flex gap-[68px]">
        <div class="flex items-center gap-[30px] flex-1 min-w-0">
          <span class="re-field-label" style="width:auto">Barista</span>
          <div class="re-combo">
            <div class="re-input-row">
              <input id="re-barista-input" class="re-input" type="text" placeholder="Barista" />
              <button class="re-input-pencil" id="re-barista-pencil">${pencilSvg}</button>
            </div>
            <div id="re-barista-drop" class="re-combo-drop"></div>
          </div>
        </div>
        <div class="flex items-center gap-[30px] flex-1 min-w-0">
          <span class="re-field-label" style="width:auto">Drinker</span>
          <div class="re-combo">
            <div class="re-input-row">
              <input id="re-drinker-input" class="re-input" type="text" placeholder="Drinker" />
              <button class="re-input-pencil" id="re-drinker-pencil">${pencilSvg}</button>
            </div>
            <div id="re-drinker-drop" class="re-combo-drop"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Dashboard Variables (2-column, matches Figma) -->
    <div id="re-right" class="flex flex-col flex-1 bg-white overflow-y-auto px-[38px] py-[28px] gap-[30px]">
      <div class="text-[30px] font-bold text-[var(--mimoja-blue)]">Dashboard Variables</div>

      <!-- Row: Dose | Drink -->
      <div class="flex gap-[45px]">
        <div class="re-var-block flex-1">
          ${stepperHtml('re-dose', 'Dose', '120px')}
          ${presetStripHtml('re-dose', ['20g', '18g', '19g', '15g'])}
        </div>
        <div class="re-vrule"></div>
        <div class="re-var-block flex-1">
          ${stepperHtml('re-drink', 'Drink', '120px', true)}
          ${presetStripHtml('re-drink', ['1:2.3', '1:2.5', '1:5', '1:15'], { kind: 'ratio', basis: 're-dose' })}
        </div>
      </div>

      <div class="re-divider"></div>

      <!-- Row: Brew °c | Steam (Flow | Time) -->
      <div class="flex gap-[45px]">
        <div class="re-var-block flex-1">
          ${stepperHtml('re-brew-c', 'Brew °c', '120px')}
          ${presetStripHtml('re-brew-c', ['75°c', '80°c', '92°c', '85°c'])}
        </div>
        <div class="re-vrule"></div>
        <div class="re-var-block flex-1">
          ${stepperHtml('re-steam', 'Steam', '120px', true, `
            <div class="re-mode-toggle">
              <button class="re-steam-mode re-mode-seg active" data-mode="flow">Flow</button>
              <span class="re-mode-sep">|</span>
              <button class="re-steam-mode re-mode-seg" data-mode="time">Time</button>
            </div>`)}
          ${presetStripHtml('re-steam', ['29s', '15s', '31s', '28s'])}
        </div>
      </div>

      <div class="re-divider"></div>

      <!-- Row: Flush | Hot Water (Temp | Vol) -->
      <div class="flex gap-[45px]">
        <div class="re-var-block flex-1">
          ${stepperHtml('re-flush', 'Flush', '120px')}
          ${presetStripHtml('re-flush', ['5s', '2s', '10s', '15s'])}
        </div>
        <div class="re-vrule"></div>
        <div class="re-var-block flex-1">
          ${stepperHtml('re-hotwater', 'Hot Water', '120px', true, `
            <div class="re-mode-toggle">
              <button class="re-hotwater-mode re-mode-seg" data-mode="temp">Temp</button>
              <span class="re-mode-sep">|</span>
              <button class="re-hotwater-mode re-mode-seg active" data-mode="vol">Vol</button>
            </div>`)}
          ${presetStripHtml('re-hotwater', ['75ml', '120ml', '180ml', '200ml'])}
        </div>
      </div>

      <div class="re-divider"></div>

      <!-- Grinder names as plain text tabs (Figma 2396:991 — no label above) -->
      <div class="re-grinder-chips" id="re-grinder-chips">
        <!-- populated by JS -->
      </div>

      <!-- Grind + RPM (no preset strips in Figma) -->
      <div class="flex items-center gap-[90px]">
        <div class="re-var-block">
          ${stepperHtml('re-grind', 'Grind', '75px')}
        </div>
        <div class="re-var-block">
          ${stepperHtml('re-rpm', 'RPM', '75px')}
        </div>
      </div>

      <!-- Basket names — same plain-text-tab style as Grinder above -->
      <div class="re-var-label">Basket</div>
      <div class="re-grinder-chips" id="re-basket-chips">
        <!-- populated by JS -->
      </div>
    </div>
  </div>

  <!-- Footer -->
  <!-- Figma 2386:1876: 201px-tall footer band on the 2560 canvas → 151px here -->
  <div class="flex items-center px-[38px] h-[150px] shrink-0 bg-[var(--box-color)] border-t border-[var(--profile-button-outline-color)] gap-[30px]">
    <button id="re-clear-btn" class="footer-btn-ghost">Clear all</button>
    <div class="relative">
      <button id="re-read-from-btn" class="footer-btn-ghost">Read From ${chevUpSvg}</button>
      <div id="re-read-from-dropdown" class="read-from-dropdown">
        <div class="read-from-item" id="re-read-from-workflow">Current Workflow</div>
        <div class="read-from-item" id="re-read-from-fav">From Favourite</div>
      </div>
    </div>
    <button id="re-show-streamline-btn" class="re-show-streamline">
      <span id="re-show-streamline-icon" class="re-show-streamline-icon">${checkCircleSvg}</span>
      <span class="re-show-streamline-sep"></span>
      <span>Show on Streamline Dashboard</span>
    </button>
    <div class="flex-1"></div>
    <button id="re-cancel-btn" class="text-[24px] font-bold text-[var(--text-primary)] w-[240px] h-[76px]">CANCEL</button>
    <button id="re-save-btn" class="bg-[var(--mimoja-blue)] text-white rounded-[68px] h-[76px] w-[300px] text-[24px] font-bold cursor-pointer">SAVE RECIPE</button>
  </div>
</div>
`;
}

const pageScript = `
${presetStripScript}
${segmentControlScript}

const NUM_RECIPES = ${NUM_RECIPES};
let recipes = [];
let currentRecipeIdx = 0;
let grinders = [];
let baskets = [];
let showOnStreamline = true;
let selectedGrinderId = null;
let selectedBasketId = null;
let selectedBeanId = null;
let selectedBeanName = null;
let selectedProfileId = null;
let selectedProfileTitle = null;
let beans = [];
let profiles = [];

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
function setInput(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

function wireAdjuster(minusId, plusId, valueId, step, min, max, formatter) {
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
      syncPresetActive(valueId.replace('-value', ''), formatter(val));
    });
  });
  makeValueEditable(valueId, min, max, formatter);
}

// Tap the number to type a value directly (tablet-friendly).
function makeValueEditable(valueId, min, max, formatter) {
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
        syncPresetActive(valueId.replace('-value', ''), formatter(v));
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

function renderRecipe(recipe) {
  if (!recipe) return;
  const dv = recipe.dashboardVariables || {};
  setInput('re-name-input',     recipe.name || '');
  setInput('re-beverage-input', recipe.beverage || '');
  setInput('re-barista-input',  recipe.barista || '');
  setInput('re-drinker-input',  recipe.drinker || '');

  set('re-dose-value',  dv.dose     != null ? dv.dose + 'g'          : '—');
  set('re-drink-value', dv.drink    != null ? dv.drink + 'g'         : '—');
  set('re-drink-sub',   dv.ratio    != null ? '(1:' + dv.ratio + ')' : '');
  const drinkValEl = document.getElementById('re-drink-value');
  if (drinkValEl) { if (dv.ratio != null) drinkValEl.dataset.ratio = String(dv.ratio); else delete drinkValEl.dataset.ratio; }
  set('re-brew-c-value',dv.brewC    != null ? dv.brewC + '°c'        : '—');
  set('re-steam-value', dv.steamTimeS  != null ? dv.steamTimeS + 's' : dv.steamFlowMls != null ? dv.steamFlowMls + 'ml/s' : '—');
  set('re-flush-value', dv.flushS   != null ? dv.flushS + 's'        : '—');
  set('re-hotwater-value', dv.hotWaterMl != null ? dv.hotWaterMl + 'ml' : (dv.hotWaterTempC != null ? dv.hotWaterTempC + '°C' : '—'));
  set('re-hotwater-sub',   dv.hotWaterTempC != null ? dv.hotWaterTempC + '°C' : '');
  // Point the mode toggles at the recipe's stored mode so units + presets match the value shown.
  setMode('re-steam-mode',    dv.steamMode    || (dv.steamFlowMls != null ? 'flow' : dv.steamTimeS != null ? 'time' : 'flow'));
  setMode('re-hotwater-mode', dv.hotWaterMode || (dv.hotWaterTempC != null ? 'temp' : 'vol'));
  set('re-grind-value', dv.grind    != null ? String(dv.grind)       : '—');
  set('re-rpm-value',   dv.rpm      != null ? String(dv.rpm)         : '—');

  showOnStreamline = recipe.showOnStreamlineDashboard !== false;
  updateStreamlineBtn();

  selectedBeanId      = recipe.beanId || null;
  selectedBeanName    = recipe.beanName || null;
  selectedProfileId   = recipe.profileId || null;
  selectedProfileTitle = recipe.profileTitle || null;
  renderBeanChips();
  renderProfileChips();

  if (dv.grinderId) selectedGrinderId = dv.grinderId;
  renderGrinderChips();
  if (dv.basketId) selectedBasketId = dv.basketId;
  renderBasketChips();

  syncPresetActive('re-dose',   set => {});
}

// Build a recipe-shaped patch from the live workflow.
async function readFromWorkflow() {
  const wf = await getWorkflow().catch(() => null);
  const ctx = (wf && wf.context) || {};
  const g = grinders.find(x => (x.model || x.name) === ctx.grinderModel);
  const extras = ctx.extras || {};
  return {
    barista: ctx.baristaName || ctx.barista || '',
    drinker: ctx.drinkerName || ctx.drinker || '',
    dashboardVariables: {
      dose:  ctx.targetDoseWeight,
      drink: ctx.targetYield,
      grind: ctx.grinderSetting,
      rpm:   extras.rpm,
      grinderId: g ? g.id : undefined,
      basketId:   extras.basketId,
      basketName: extras.basketName,
    },
  };
}

// Build a recipe-shaped patch from a chosen favourite's snapshot, loading the WHOLE
// form (bean + profile included). Deliberately ignores the favourite's copyMask: the
// user explicitly picked this favourite and confirmed, so "give me everything it has"
// is least-surprising here (unlike the dashboard's auto-apply, which honours the mask).
// Bean is matched by coffee name → bean id so the chip highlights; profile carries its
// own id. brewC/steam/flush/hotWater aren't in a favourite snapshot, so those stay put.
function favouriteToRecipePatch(fav) {
  const s = fav.snapshot || {};
  const bean = s.coffeeName ? beans.find(b => b.name === s.coffeeName) : null;
  return {
    beverage:     fav.beverage || '',
    barista:      s.barista || '',
    drinker:      s.drinker || '',
    beanId:       bean ? bean.id : null,
    beanName:     s.coffeeName || null,
    profileId:    s.profileId || null,
    profileTitle: s.profileTitle || null,
    dashboardVariables: {
      dose:  s.dose,
      drink: s.drink,
      grind: s.grindSetting,
      rpm:   s.rpm,
      grinderId: s.grinderId,
      basketId:   s.basketId,
      basketName: s.basketName,
    },
  };
}

// Merge a patch into the current recipe (keep id/name), then re-render.
function applyToCurrentRecipe(src) {
  if (!src) return;
  const cur = recipes[currentRecipeIdx] || {};
  const merged = {
    ...cur, ...src, id: cur.id, name: cur.name,
    dashboardVariables: { ...(cur.dashboardVariables || {}), ...(src.dashboardVariables || {}) },
  };
  recipes[currentRecipeIdx] = merged;
  if (merged.dashboardVariables.grinderId) selectedGrinderId = merged.dashboardVariables.grinderId;
  if (merged.dashboardVariables.basketId) selectedBasketId = merged.dashboardVariables.basketId;
  renderRecipe(merged);
}

// First "limit" items, in list order — positions stay put across re-renders so the highlight
// lands on the chip the user actually tapped. Only an assigned item that falls outside the
// visible window gets pulled in (taking the last slot), so it is never invisible.
function orderedChips(list, selectedId, limit) {
  const head = list.slice(0, limit);
  const sel = list.find(x => String(x.id) === String(selectedId));
  if (sel && head.indexOf(sel) === -1) {
    if (head.length < limit) head.push(sel); else head[head.length - 1] = sel;
  }
  return head;
}

function renderChipGrid(containerId, items, isActive, labelOf, onPick, seeAllRoute) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => {
    const chip = document.createElement('div');
    chip.className = 're-chip' + (isActive(item) ? ' active' : '');
    chip.textContent = labelOf(item);
    chip.addEventListener('click', () => { onPick(item); });
    container.appendChild(chip);
  });
  const seeAll = document.createElement('div');
  seeAll.className = 're-see-all';
  seeAll.textContent = seeAllRoute.beans ? 'See All Beans' : 'See All Profiles';
  seeAll.addEventListener('click', () => goToPicker(seeAllRoute.url));
  container.appendChild(seeAll);
}

function renderBeanChips() {
  renderChipGrid(
    're-bean-chips',
    orderedChips(beans, selectedBeanId, 5),
    b => String(b.id) === String(selectedBeanId),
    b => b.name || 'Unnamed bean',
    b => { selectedBeanId = b.id; selectedBeanName = b.name || ''; renderBeanChips(); },
    { beans: true, url: '/api/v1/plugins/dye2.reaplugin/bean-picker?return=/api/v1/plugins/dye2.reaplugin/recipe-edit' }
  );
}

// Bridge profiles nest the title under profile.title (not a top-level field).
function profileLabel(p) {
  return (p.profile && p.profile.title) || p.title || p.name || 'Untitled';
}

function renderProfileChips() {
  renderChipGrid(
    're-profile-chips',
    orderedChips(profiles, selectedProfileId, 5),
    p => String(p.id) === String(selectedProfileId),
    p => profileLabel(p),
    p => { selectedProfileId = p.id; selectedProfileTitle = profileLabel(p); renderProfileChips(); },
    { beans: false, url: '/api/v1/plugins/dye2.reaplugin/profile-picker?return=/api/v1/plugins/dye2.reaplugin/recipe-edit' }
  );
}

function renderGrinderChips() {
  const container = document.getElementById('re-grinder-chips');
  if (!container) return;
  container.innerHTML = '';
  if (grinders.length === 0) {
    container.innerHTML = '<span style="color:var(--text-primary-disabled);font-size:20px">No grinders</span>';
    return;
  }
  grinders.forEach(g => {
    const chip = document.createElement('button');
    chip.className = 're-grinder-chip' + (g.id === selectedGrinderId ? ' active' : '');
    chip.textContent = g.model || g.name || 'Grinder';
    chip.addEventListener('click', () => {
      container.querySelectorAll('.re-grinder-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedGrinderId = g.id;
    });
    container.appendChild(chip);
  });
}

function renderBasketChips() {
  const container = document.getElementById('re-basket-chips');
  if (!container) return;
  container.innerHTML = '';
  if (baskets.length === 0) {
    container.innerHTML = '<span style="color:var(--text-primary-disabled);font-size:20px">No baskets</span>';
    return;
  }
  baskets.forEach(b => {
    const chip = document.createElement('button');
    chip.className = 're-grinder-chip' + (b.id === selectedBasketId ? ' active' : '');
    chip.textContent = b.name || 'Basket';
    chip.addEventListener('click', () => {
      container.querySelectorAll('.re-grinder-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedBasketId = b.id;
    });
    container.appendChild(chip);
  });
}

function updateStreamlineBtn() {
  const btn = document.getElementById('re-show-streamline-btn');
  if (btn) btn.style.opacity = showOnStreamline ? '1' : '0.4';
}

function getCurrentRecipeData() {
  const num = id => parseFloat(document.getElementById(id)?.textContent) || 0;
  const steamMode = document.querySelector('.re-steam-mode.active')?.dataset.mode || 'flow';
  const steamVal  = num('re-steam-value');
  const hwMode    = document.querySelector('.re-hotwater-mode.active')?.dataset.mode || 'vol';
  const hwVal     = num('re-hotwater-value');
  // Persist the drink ratio only while the yield still equals dose × ratio (i.e. not manually overridden).
  const doseVal = num('re-dose-value'), drinkVal = num('re-drink-value');
  const ratioAttr = document.getElementById('re-drink-value')?.dataset.ratio;
  const ratioNum = ratioAttr ? parseFloat(ratioAttr) : NaN;
  const ratio = (!isNaN(ratioNum) && doseVal && Math.abs(drinkVal - Math.round(doseVal * ratioNum * 10) / 10) < 0.05)
    ? ratioNum : undefined;
  return {
    name:      document.getElementById('re-name-input')?.value || '',
    beverage:  document.getElementById('re-beverage-input')?.value || '',
    barista:   document.getElementById('re-barista-input')?.value || '',
    drinker:   document.getElementById('re-drinker-input')?.value || '',
    beanId:    selectedBeanId,
    beanName:  selectedBeanName,
    profileId: selectedProfileId,
    profileTitle: selectedProfileTitle,
    showOnStreamlineDashboard: showOnStreamline,
    dashboardVariables: {
      dose:    num('re-dose-value'),
      drink:   num('re-drink-value'),
      ratio,
      brewC:   num('re-brew-c-value') || 93,
      steamMode,
      steamTimeS:   steamMode === 'time' ? steamVal : undefined,
      steamFlowMls: steamMode === 'flow' ? steamVal : undefined,
      flushS:  num('re-flush-value'),
      hotWaterMode:  hwMode,
      hotWaterMl:    hwMode === 'vol'  ? hwVal : undefined,
      hotWaterTempC: hwMode === 'temp' ? hwVal : undefined,
      grind:   num('re-grind-value'),
      rpm:     num('re-rpm-value'),
      grinderId: selectedGrinderId,
      basketId:   selectedBasketId,
      basketName: (baskets.find(b => b.id === selectedBasketId) || {}).name,
    },
  };
}

function setupTabs() {
  document.getElementById('re-tabs')?.querySelectorAll('.re-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.re-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRecipeIdx = parseInt(btn.dataset.recipe);
      const recipe = recipes[currentRecipeIdx];
      if (recipe) renderRecipe(recipe);
    });
  });
}

// Opening a See-All picker mid-edit pushes entries onto the history stack (picker, then
// this page again on confirm), so history.back() lands on the picker the user just left
// rather than the dashboard that opened this page. Leave by route instead.
const DASHBOARD_ROUTE = 'dashboard';
function leaveRecipeEdit() {
  const ret = new URLSearchParams(location.search).get('return');
  window.location.href = ret || DASHBOARD_ROUTE;
}

// Persist the in-progress form (full-page nav to the picker would otherwise lose it),
// then open the picker. initRecipeEdit restores the draft and folds in the pick on return.
function goToPicker(route) {
  const cur = recipes[currentRecipeIdx] || {};
  recipes[currentRecipeIdx] = { ...cur, ...getCurrentRecipeData(), id: cur.id };
  sessionStorage.setItem('dye_recipeDraft', JSON.stringify({ idx: currentRecipeIdx, recipes }));
  window.location.href = route;
}

// Steam/Hot-Water toggles change BOTH the unit shown in the stepper and the preset strip.
// ponytail: preset values below are sensible DE1 defaults — confirm against Figma if needed.
const MODE_CFG = {
  're-steam-mode': {
    valueId: 're-steam-value',
    unit:    { time: 's', flow: 'ml/s' },
    presets: { time: ['29s','15s','31s','28s'], flow: ['0.8ml/s','1ml/s','1.2ml/s','1.5ml/s'] },
  },
  're-hotwater-mode': {
    valueId: 're-hotwater-value',
    unit:    { vol: 'ml', temp: '°c' },
    presets: { vol: ['75ml','120ml','180ml','200ml'], temp: ['80°c','85°c','90°c','95°c'] },
  },
};
function activeMode(cls) { return document.querySelector('.' + cls + '.active')?.dataset.mode; }
// Wire preset buttons within one strip (setupPresetStrips only wires what exists at load).
function wirePresetButtons(container) {
  container.querySelectorAll('.dye-preset').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn));
    attachPresetLongPress(btn);   // long-press copies the current value into this preset
  });
}
function applyMode(cls) {
  const cfg = MODE_CFG[cls]; if (!cfg) return;
  const mode = activeMode(cls);
  const idPrefix = cfg.valueId.replace('-value', '');
  const strip = document.getElementById(idPrefix + '-presets');
  if (strip && cfg.presets[mode]) {
    strip.innerHTML = cfg.presets[mode]
      .map(p => '<button class="dye-preset" data-preset="' + p + '" data-for="' + idPrefix + '">' + p + '</button>').join('');
    wirePresetButtons(strip);
  }
  const valEl = document.getElementById(cfg.valueId);
  if (valEl) {
    const n = parseFloat(valEl.textContent);
    valEl.textContent = isNaN(n) ? '—' : n + (cfg.unit[mode] || '');
    syncPresetActive(idPrefix, valEl.textContent);
  }
}
function setMode(cls, mode) {
  document.querySelectorAll('.' + cls).forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  applyMode(cls);
}
function setupModeToggle(cls) {
  document.querySelectorAll('.' + cls).forEach(btn => {
    btn.addEventListener('click', () => setMode(cls, btn.dataset.mode));
  });
  applyMode(cls);   // sync presets + unit to the default-active mode on load
}

// ── Name lookups: pick from previously entered values ───────────────────────
async function distinctNames(key) {
  const shots = await getShots({ limit: 200 }).catch(() => []);
  const seen = new Set();
  (Array.isArray(shots) ? shots : (shots.items || [])).forEach(s => {
    const ctx = (s.workflow && s.workflow.context) || {};
    const name = ctx[key] || (s.metadata && s.metadata[key === 'baristaName' ? 'barista' : 'drinker']);
    if (name) seen.add(name);
  });
  return [...seen];
}
async function distinctBeverages() {
  const [recipeList, favs] = await Promise.all([getRecipes().catch(() => []), getAutoFavourites().catch(() => [])]);
  const seen = new Set();
  (Array.isArray(recipeList) ? recipeList : []).forEach(r => { if (r && r.beverage) seen.add(r.beverage); });
  (Array.isArray(favs) ? favs : []).forEach(f => { if (f && f.beverage) seen.add(f.beverage); });
  return [...seen];
}
const nameComboCache = {};
function setupNameCombo(field, loader) {
  const input = document.getElementById(field + '-input');
  const drop  = document.getElementById(field + '-drop');
  const pencil = document.getElementById(field + '-pencil');
  if (!input || !drop) return;
  async function options() {
    if (!nameComboCache[field]) { try { nameComboCache[field] = await loader(); } catch (e) { nameComboCache[field] = []; } }
    return nameComboCache[field];
  }
  async function open() {
    const opts = await options();
    const q = (input.value || '').trim().toLowerCase();
    const list = q ? opts.filter(o => String(o).toLowerCase().includes(q)) : opts;
    drop.innerHTML = '';
    if (!list.length) {
      const e = document.createElement('div'); e.className = 're-combo-empty'; e.textContent = 'No previous entries'; drop.appendChild(e);
    } else {
      list.slice(0, 50).forEach(o => {
        const el = document.createElement('div'); el.className = 're-combo-opt'; el.textContent = o;
        // mousedown (not click) so the pick lands before the input's blur closes the drop.
        el.addEventListener('mousedown', (ev) => { ev.preventDefault(); input.value = o; drop.classList.remove('open'); });
        drop.appendChild(el);
      });
    }
    drop.classList.add('open');
  }
  pencil?.addEventListener('click', () => { input.focus(); open(); });
  input.addEventListener('focus', open);
  input.addEventListener('input', open);
  input.addEventListener('blur', () => setTimeout(() => drop.classList.remove('open'), 150));
}

function setupStreamlineToggle() {
  document.getElementById('re-show-streamline-btn')?.addEventListener('click', () => {
    showOnStreamline = !showOnStreamline;
    updateStreamlineBtn();
  });
}

function setupFooter() {
  const rfBtn  = document.getElementById('re-read-from-btn');
  const rfDrop = document.getElementById('re-read-from-dropdown');
  rfBtn?.addEventListener('click', e => { e.stopPropagation(); rfDrop?.classList.toggle('open'); });
  document.addEventListener('click', () => rfDrop?.classList.remove('open'));

  document.getElementById('re-read-from-workflow')?.addEventListener('click', async () => {
    applyToCurrentRecipe(await readFromWorkflow());
    rfDrop?.classList.remove('open');
  });
  // Route to the Auto Favourites picker (select a card + Confirm). On return,
  // initRecipeEdit reads dye_selectedAutoFavId and loads the whole recipe from it.
  document.getElementById('re-read-from-fav')?.addEventListener('click', () => {
    rfDrop?.classList.remove('open');
    goToPicker('/api/v1/plugins/dye2.reaplugin/auto-favs');
  });

  document.getElementById('re-name-pencil')?.addEventListener('click', () => {
    const inp = document.getElementById('re-name-input');
    if (inp) { inp.focus(); inp.select(); }
  });

  document.getElementById('re-clear-btn')?.addEventListener('click', () => {
    recipes[currentRecipeIdx] = {};
    renderRecipe({});
  });

  document.getElementById('re-cancel-btn')?.addEventListener('click', () => leaveRecipeEdit());

  document.getElementById('re-save-btn')?.addEventListener('click', async () => {
    const data = getCurrentRecipeData();
    const recipe = recipes[currentRecipeIdx];
    try {
      if (recipe && recipe.id) {
        await updateRecipe(recipe.id, data);
      }
      leaveRecipeEdit();
    } catch (e) { console.error('Failed to save recipe:', e); }
  });
}

async function initRecipeEdit() {
  setupTabs();
  setupStreamlineToggle();
  setupPresetStrips();
  // After setupPresetStrips so the mode toggle owns/rewires the strips it rebuilds.
  setupModeToggle('re-steam-mode');
  setupModeToggle('re-hotwater-mode');
  setupNameCombo('re-barista',  () => distinctNames('baristaName'));
  setupNameCombo('re-drinker',  () => distinctNames('drinkerName'));
  setupNameCombo('re-beverage', distinctBeverages);
  setupFooter();

  wireAdjuster('re-dose-minus',  're-dose-plus',  're-dose-value',  0.5, 0, null, v => v + 'g');
  wireAdjuster('re-drink-minus', 're-drink-plus', 're-drink-value', 1,   0, null, v => v + 'g');
  wireAdjuster('re-brew-c-minus','re-brew-c-plus','re-brew-c-value',1, 60, 100,  v => v + '°c');
  wireAdjuster('re-steam-minus', 're-steam-plus', 're-steam-value', 1,   0, null, v => v + (MODE_CFG['re-steam-mode'].unit[activeMode('re-steam-mode')] || 's'));
  wireAdjuster('re-flush-minus', 're-flush-plus', 're-flush-value', 1,   0, null, v => v + 's');
  wireAdjuster('re-hotwater-minus','re-hotwater-plus','re-hotwater-value', 5, 0, null, v => v + (MODE_CFG['re-hotwater-mode'].unit[activeMode('re-hotwater-mode')] || 'ml'));
  wireAdjuster('re-grind-minus', 're-grind-plus', 're-grind-value', 0.1, 0, null, v => v.toFixed(1));
  wireAdjuster('re-rpm-minus',   're-rpm-plus',   're-rpm-value',   1,   1, null, v => String(v));

  let loadedRecipes = [];
  try {
    const result = await getRecipes();
    loadedRecipes = Array.isArray(result) ? result : (result && result.items ? result.items : []);
  } catch (e) {
    console.warn('Could not load recipes from KV store:', e);
  }
  // Normalize to NUM_RECIPES fixed slots with stable ids ("1".."5") so save() always upserts.
  recipes = Array.from({ length: NUM_RECIPES }, (_, i) => {
    const id = String(i + 1);
    const existing = loadedRecipes.find(r => r && r.id === id);
    return existing ? { ...existing, id } : { id, name: 'Recipe ' + (i + 1) };
  });
  document.querySelectorAll('.re-tab').forEach((btn, i) => {
    if (recipes[i] && recipes[i].name) btn.textContent = recipes[i].name;
  });

  try {
    const gs = await getGrinders().catch(() => []);
    grinders = Array.isArray(gs) ? gs : (gs && gs.items ? gs.items : []);
  } catch (e) { grinders = []; }

  try {
    baskets = await getBaskets().catch(() => []);
  } catch (e) { baskets = []; }

  const bs = await getBeans().catch(() => []);
  beans = Array.isArray(bs) ? bs : (bs && bs.items ? bs.items : []);
  const ps = await getProfiles().catch(() => []);
  profiles = Array.isArray(ps) ? ps : (ps && ps.items ? ps.items : []);

  const storedIdx = parseInt(sessionStorage.getItem('dye_editRecipeIdx') || '0');
  currentRecipeIdx = isNaN(storedIdx) ? 0 : Math.min(storedIdx, NUM_RECIPES - 1);

  // Returning from a See-All picker: restore the draft we stashed, then fold in the pick.
  // Gated on the draft so stray picker keys from other flows are never adopted here.
  const draftRaw = sessionStorage.getItem('dye_recipeDraft');
  sessionStorage.removeItem('dye_recipeDraft');
  if (draftRaw) {
    try {
      const draft = JSON.parse(draftRaw);
      if (Array.isArray(draft.recipes) && draft.recipes.length === NUM_RECIPES) recipes = draft.recipes;
      if (draft.idx != null) currentRecipeIdx = Math.min(draft.idx, NUM_RECIPES - 1);
      const cur = recipes[currentRecipeIdx] || (recipes[currentRecipeIdx] = { id: String(currentRecipeIdx + 1) });
      const beanId = sessionStorage.getItem('dye_selectedBeanId');
      if (beanId) {
        cur.beanId = beanId;
        cur.beanName = sessionStorage.getItem('dye_selectedBeanName') || '';
        ['dye_selectedBeanId','dye_selectedBeanName','dye_selectedBeanRoaster','dye_selectedBatchId','dye_selectedRoastDate']
          .forEach(k => sessionStorage.removeItem(k));
      }
      const profileId = sessionStorage.getItem('dye_selectedProfileId');
      if (profileId) {
        cur.profileId = profileId;
        cur.profileTitle = sessionStorage.getItem('dye_selectedProfileTitle') || '';
        ['dye_selectedProfileId','dye_selectedProfileTitle'].forEach(k => sessionStorage.removeItem(k));
      }
    } catch (e) { console.warn('recipe draft restore failed:', e); }
  }
  // Returning from the Auto Favourites picker: load the chosen favourite into this recipe.
  // Applied after the draft restore so it overwrites the in-progress form as intended.
  const selFavId = sessionStorage.getItem('dye_selectedAutoFavId');
  if (selFavId) {
    sessionStorage.removeItem('dye_selectedAutoFavId');
    try {
      const fav = await getAutoFavourite(selFavId);
      if (fav) applyToCurrentRecipe(favouriteToRecipePatch(fav));
    } catch (e) { console.warn('Could not load selected auto-favourite:', e); }
  }
  const activeTab = document.querySelectorAll('.re-tab')[currentRecipeIdx];
  if (activeTab) {
    document.querySelectorAll('.re-tab').forEach(b => b.classList.remove('active'));
    activeTab.classList.add('active');
  }
  renderRecipe(recipes[currentRecipeIdx] || {});
  renderGrinderChips();
  renderBasketChips();
}

initRecipeEdit().catch(e => console.error('initRecipeEdit failed:', e));

// Returning via history.back() from the favourites picker can restore this page frozen
// from bfcache, so init (and the apply-selected-favourite step) never re-runs — reload
// to re-fetch and fold in the pick. Mirrors the dashboard.
window.addEventListener('pageshow', function(e) { if (e.persisted) window.location.reload(); });
`;

export function renderRecipeEditPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Edit Recipes", buildContent(), styles, [devApiScript, pageScript]),
  };
}
