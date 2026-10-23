import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { lucideIcon } from "../utils/lucide";
import {
  stepperCss, stepperHtml,
  presetStripCss, presetStripHtml, presetStripScript,
  segmentControlScript,
  expandFieldHtml,
} from "../utils/shared-components";
import { recipeStripScript } from "../utils/recipe-strip";
import { equipmentFieldCss, equipmentValuesModalHtml, equipmentFieldScript } from "../utils/equipment-field";

/* The second line of a Machine Settings label ('Hot Water' / 'Time'), styled like the settled
   side of a mode toggle. Keeps these labels inside the same 120px column as every other
   stepper: a wider label column pushed each row past the pane's width. */
const subLabel = (text: string) => `<div class="re-sub-label">${text}</div>`;

const styles = `
  ${stepperCss()}
  ${presetStripCss()}
  ${equipmentFieldCss}
  /* Figma 2396:728: fixed 270x60 pills, stroke var(--chip-stroke), text var(--chip-text) */
  .re-tab {
    width: 270px; height: 60px; border-radius: 15px;
    /* ponytail: block + line-height, not flex — text-overflow:ellipsis only works on a block box */
    display: block; line-height: 56px; text-align: center;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 21px;
    border: 2px solid var(--chip-stroke);
    background: var(--box-color); color: var(--chip-text);
    cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex-shrink: 0; padding: 0 20px;
  }
  .re-tab.active { background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff; }
  .re-label { font-size: 24px; font-weight: 700; color: var(--mimoja-blue); margin-bottom: 8px; }
  /* Figma 2396:747: label sits inline beside the input, 164px wide */
  .re-field-label { font-size: 24px; font-weight: 700; color: var(--mimoja-blue); width: 164px; flex-shrink: 0; }
  /* Figma 2396:749: one bordered box (2px var(--box-border), square) holding text + edit icon */
  .re-input-row {
    display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;
    border: 2px solid var(--box-border); background: var(--box-color);
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
    border: 2px solid var(--chip-stroke);
    background: var(--box-color); color: var(--chip-text);
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
  /* Figma: grinder options are plain text (no box) — active bold blue, inactive grey, wide gaps.
     flex-shrink: 0 matters here: a flex item with overflow-x set gets an automatic minimum
     height of 0 (not content-based) in a flex column, so once #re-right's total content
     exceeds the viewport, this row (and the basket-chips row, same class) collapse to ~0
     height under flex-shrink instead of the sibling rows sharing the squeeze evenly. */
  .re-grinder-chips { display: flex; align-items: center; gap: 32px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; flex-shrink: 0; }
  .re-grinder-chips::-webkit-scrollbar { display: none; }
  .re-grinder-chip {
    background: none; border: none; padding: 0;
    font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 600;
    color: var(--tab-idle);
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
  /* Figma 2386:1884: bordered pill with check | divider | label. On/off reads by fill,
     not just opacity — solid blue + check when on, outline + x when off. */
  .re-show-streamline {
    display: flex; align-items: center; gap: 14px;
    border: 2px solid var(--mimoja-blue); border-radius: 23px;
    height: 60px; padding: 0 24px 0 16px;
    font-family: 'Inter', sans-serif; font-size: 21px; font-weight: 600;
    cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .re-show-streamline.on  { background: var(--mimoja-blue); color: #fff; }
  .re-show-streamline.off { background: var(--box-color); color: var(--text-primary-disabled); border-color: var(--profile-button-outline-color); }
  .re-show-streamline-icon { flex-shrink: 0; display: flex; align-items: center; }
  .re-show-streamline-sep { width: 2px; height: 36px; background: var(--profile-button-outline-color); flex-shrink: 0; }
  .re-show-streamline.on .re-show-streamline-sep { background: rgba(255,255,255,0.4); }
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
  /* Machine Settings disclosure: the header reads as the pane's other section headings, so the
     caret and the held-count carry the affordance. */
  .re-machine-toggle {
    display: flex; align-items: center; gap: 16px; width: 100%;
    background: none; border: none; padding: 0; cursor: pointer; text-align: left;
    font-family: 'Inter', sans-serif;
  }
  .re-machine-count { font-size: 20px; font-weight: 600; color: var(--text-primary-disabled); }
  .re-sub-label { margin-top: 4px; font-size: 19px; font-weight: 600; color: var(--mimoja-blue); }
  /* The Machine Settings rows sit 20px apart rather than the 45px above. A stepper's value cell
     grows with its text, and a 7-character value (4.5ml/s, reachable by stepping a flow) at 45px
     pushed the row past the pane, which scrolls it sideways rather than wrapping. 20px also
     leaves room for a classic vertical scrollbar, which takes layout width in desktop preview
     even though the tablet's WebView overlays it. test/workflow-record.test.mjs does the
     arithmetic for every row in the pane. */
  .re-machine-caret { display: flex; align-items: center; transition: transform 0.15s; }
  .re-machine-caret.open { transform: rotate(180deg); }
  /* Steam / Hot Water mode: compact inline text toggle under the label (matches Figma) */
  .re-mode-toggle { display: flex; align-items: center; gap: 10px; margin: 4px 0 0 0; font-size: 19px; font-weight: 600; }
  .re-mode-seg { background: none; border: none; padding: 0; font: inherit; cursor: pointer; color: var(--text-primary-disabled); }
  .re-mode-seg.active { color: var(--mimoja-blue); }
  .re-mode-sep { color: var(--profile-button-outline-color); }
`;

// currentColor so these follow .re-show-streamline's text color (white when on, gray when
// off) instead of staying a fixed blue that reads the same regardless of state.
const streamlineOnSvg  = lucideIcon('check-circle', 28, 'currentColor', 2);
const streamlineOffSvg = lucideIcon('x',            28, 'currentColor', 2.5);

function buildContent(): string {
  const chevUpSvg = lucideIcon('chevron-up', 24, 'var(--mimoja-blue)', 2.5);
  const pencilSvg = lucideIcon('pencil',     26, 'var(--text-primary-disabled)', 2);

  const tabs = [1, 2, 3, 4, 5].map(n =>
    `<button class="re-tab" data-slot="${n}">Empty ${n}</button>`
  ).join('');

  return `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex flex-col font-['Inter',sans-serif]">

  <!-- Header: title + one tab per strip slot on the grey strip (Figma 2386:1874) -->
  <div class="flex items-center gap-[48px] px-[38px] h-[124px] shrink-0 bg-[var(--bgmain-color)] border-b border-[var(--profile-button-outline-color)]">
    <span class="text-[30px] font-semibold text-[var(--text-primary)] shrink-0">Edit Recipes</span>
    <div id="re-tabs" class="flex gap-[15px] overflow-x-auto" style="scrollbar-width:none">
      ${tabs}
    </div>
  </div>

  <!-- Two-column body, 50/50 like the Figma columns -->
  <div class="flex flex-1 overflow-hidden">

    <!-- LEFT: recipe metadata -->
    <div id="re-left" class="flex flex-col w-1/2 shrink-0 bg-[var(--card-bg)] border-r border-[var(--profile-button-outline-color)] overflow-y-auto px-[38px] py-[28px] gap-[30px]">

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
            <input id="re-beverage-input" class="re-input" type="text" placeholder="e.g. Cappucino" readonly />
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
              <input id="re-barista-input" class="re-input" type="text" placeholder="Barista" readonly />
              <button class="re-input-pencil" id="re-barista-pencil">${pencilSvg}</button>
            </div>
            <div id="re-barista-drop" class="re-combo-drop"></div>
          </div>
        </div>
        <div class="flex items-center gap-[30px] flex-1 min-w-0">
          <span class="re-field-label" style="width:auto">Drinker</span>
          <div class="re-combo">
            <div class="re-input-row">
              <input id="re-drinker-input" class="re-input" type="text" placeholder="Drinker" readonly />
              <button class="re-input-pencil" id="re-drinker-pencil">${pencilSvg}</button>
            </div>
            <div id="re-drinker-drop" class="re-combo-drop"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Dashboard Variables (2-column, matches Figma) -->
    <div id="re-right" class="flex flex-col flex-1 bg-[var(--card-bg)] overflow-y-auto px-[38px] py-[28px] gap-[30px]">
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

      <!-- The rest of the machine settings a recipe can hold (dye2#23). Collapsed by default:
           they are set once per machine rather than per dial-in, and this pane is already the
           longest page in DYE2. The summary line under the header shows what is held while the
           section is shut, including the half of the Steam / Hot Water pairs the active mode
           hides. Open, they are the same steppers as every other field. -->
      <div>
        <button id="re-machine-toggle" class="re-machine-toggle" aria-expanded="false" aria-controls="re-machine-rows">
          <span class="text-[30px] font-bold text-[var(--mimoja-blue)]">Machine Settings</span>
          <span id="re-machine-count" class="re-machine-count"></span>
          <span class="flex-1"></span>
          <span id="re-machine-caret" class="re-machine-caret">${lucideIcon('chevron-down', 28, 'var(--mimoja-blue)', 2.5)}</span>
        </button>
        <div id="re-held-list" class="flex flex-wrap gap-x-[40px] gap-y-[6px] text-[20px] mt-[4px]"></div>
        <div id="re-machine-rows" style="display:none" class="flex flex-col gap-[30px] mt-[20px]">
          <div class="re-machine-row flex gap-[20px]">
            <div class="re-var-block flex-1">
              ${stepperHtml('re-steam-temp', 'Steam', '120px', false, subLabel('Temp'))}
              ${presetStripHtml('re-steam-temp', ['135°c', '150°c', '160°c', 'Off'])}
            </div>
            <div class="re-vrule"></div>
            <div class="re-var-block flex-1">
              ${stepperHtml('re-milk-stop', 'Milk', '120px', false, subLabel('Stop'))}
              ${presetStripHtml('re-milk-stop', ['55°c', '60°c', '65°c', 'Off'])}
            </div>
          </div>
          <div class="re-divider"></div>
          <div class="re-machine-row flex gap-[20px]">
            <div class="re-var-block flex-1">
              ${stepperHtml('re-hw-time', 'Hot Water', '120px', false, subLabel('Time'))}
              ${presetStripHtml('re-hw-time', ['10s', '20s', '30s', '60s'])}
            </div>
            <div class="re-vrule"></div>
            <div class="re-var-block flex-1">
              ${stepperHtml('re-hw-flow', 'Hot Water', '120px', false, subLabel('Flow'))}
              ${presetStripHtml('re-hw-flow', ['2ml/s', '4ml/s', '6ml/s', '8ml/s'])}
            </div>
          </div>
          <div class="re-divider"></div>
          <div class="re-machine-row flex gap-[20px]">
            <div class="re-var-block flex-1">
              ${stepperHtml('re-flush-temp', 'Flush', '120px', false, subLabel('Temp'))}
              ${presetStripHtml('re-flush-temp', ['80°c', '85°c', '90°c', '95°c'])}
            </div>
            <div class="re-vrule"></div>
            <div class="re-var-block flex-1">
              ${stepperHtml('re-flush-flow', 'Flush', '120px', false, subLabel('Flow'))}
              ${presetStripHtml('re-flush-flow', ['2ml/s', '4ml/s', '6ml/s', '8ml/s'])}
            </div>
          </div>
          <div class="text-[16px] opacity-60">Also set on Streamline's settings page: a change there lands on this recipe while it is selected.</div>
        </div>
      </div>

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

      <!-- Basket names — same plain-text-tab style as Grinder above, no label -->
      <div class="re-grinder-chips" id="re-basket-chips">
        <!-- populated by JS -->
      </div>

      <div class="re-divider"></div>

      <!-- Equipment: multi-select, same dropdown as edit-shot's Equipment field -->
      ${expandFieldHtml('re-equipment', 'Equipment')}
    </div>
  </div>

  ${equipmentValuesModalHtml()}

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
    <button id="re-show-streamline-btn" class="re-show-streamline on">
      <span id="re-show-streamline-icon" class="re-show-streamline-icon">${streamlineOnSvg}</span>
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
${equipmentFieldScript}

${recipeStripScript}
const STREAMLINE_ON_SVG  = ${JSON.stringify(streamlineOnSvg)};
const STREAMLINE_OFF_SVG = ${JSON.stringify(streamlineOffSvg)};

// The one recipe this page edits, opened by id (?id= from the skin, or sessionStorage dye_editRecipeId, set by
// select-recipe; ?new=1 starts blank). No id: a new recipe, written under a fresh opaque id on save.
let recipe = {};
// The recipe as read from the store at open, never edited: save writes only what differs from
// it, so a dial-in recorded while the page is open is not reverted (dye2#28). A new recipe
// has no stored record ({}), so everything on it counts as changed.
let recipeBaseline = {};
let allRecipes = [];    // the library, to name whoever holds a slot
let stripSlot = null;   // 1..5 | null, the strip slot the tabs target for this recipe
let slotArmed = null;   // slot whose current holder the next SAVE tap replaces
let grinders = [];
let baskets = [];
let showOnStreamline = true;
let selectedGrinderId = null;
let selectedBasketId = null;
let selectedBeanId = null;
let selectedBeanName = null;
// The batch (and roaster) picked with the bean: a recipe is dialled in for one roast, and
// apply needs the batch id to set the workflow's beanBatchId (dye2#27).
let selectedBeanBatchId = null;
let selectedBeanRoaster = null;
let selectedProfileId = null;
let selectedProfileTitle = null;
let selectedProfileSnapshot = null;
let beans = [];
let profiles = [];
let equipmentSelIds = [];
let equipmentSelNames = [];
let equipmentCustomOverrides = {};   // per-recipe value overrides, keyed by equipment id

const reEquipmentField = {
  textElId: 're-equipment-text',
  expandElId: 're-equipment-expand',
  getSelected: () => ({ ids: equipmentSelIds, names: equipmentSelNames }),
  toggle: (item) => {
    const idx = equipmentSelIds.indexOf(item.id);
    if (idx >= 0) { equipmentSelIds.splice(idx, 1); equipmentSelNames.splice(idx, 1); }
    else { equipmentSelIds.push(item.id); equipmentSelNames.push(item.name); }
  },
  getCustomOverrides: () => equipmentCustomOverrides,
  setCustomOverride: (id, arr) => { equipmentCustomOverrides[id] = arr; },
  goToNewEquipment: () => {
    sessionStorage.setItem('dye_editShotReturn', '1');   // tells the equipment page to auto-open "add" and hand the new row back
    goToPicker('/api/v1/plugins/dye2.reaplugin/equipment');
  },
};

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

// A field where 0 is a real value meaning off (the steam heater, the milk stop). Off sits one
// step below the range, so minus walks down to it and plus comes back at the field's minimum
// rather than at a number the DE1 would reject. A blank field is still 'not held'.
function wireOffAdjuster(prefix, step, min, max, unit) {
  const valueId = prefix + '-value';
  const fmt = machineFmt(unit, true);
  const read = () => {
    const txt = (document.getElementById(valueId)?.textContent || '').trim();
    if (/^off$/i.test(txt)) return 0;
    const n = parseFloat(txt);
    return isNaN(n) ? null : n;
  };
  [prefix + '-minus', prefix + '-plus'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const el = document.getElementById(valueId);
      if (!el) return;
      const cur = read();
      const up = btnId === prefix + '-plus';
      // Blank or off: plus arms the field at its minimum, minus switches it off.
      const v = cur == null || cur === 0
        ? (up ? min : 0)
        : (up ? Math.min(max, cur + step) : (cur - step < min ? 0 : cur - step));
      el.textContent = fmt(v);
      syncPresetActive(prefix, fmt(v));
    });
  });
  makeValueEditable(valueId, 0, max, fmt);
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
    input.style.cssText = 'width:90px;font:inherit;text-align:center;border:1px solid var(--mimoja-blue);border-radius:8px;background:var(--input-bg);color:inherit;outline:none;padding:2px 4px';
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
  // A recipe can hold both values of a pair, so the stored mode (or whichever is held) picks the one shown.
  const steamMode = dv.steamMode    || (dv.steamFlowMls != null ? 'flow' : dv.steamTimeS != null ? 'time' : 'flow');
  const hwMode    = dv.hotWaterMode || (dv.hotWaterTempC != null ? 'temp' : 'vol');
  const steamShown = steamMode === 'time' ? (dv.steamTimeS != null ? dv.steamTimeS + 's' : null) : (dv.steamFlowMls != null ? dv.steamFlowMls + 'ml/s' : null);
  const hwShown    = hwMode === 'vol' ? (dv.hotWaterMl != null ? dv.hotWaterMl + 'ml' : null) : (dv.hotWaterTempC != null ? dv.hotWaterTempC + '°C' : null);
  set('re-steam-value', steamShown || '—');
  set('re-flush-value', dv.flushS   != null ? dv.flushS + 's'        : '—');
  set('re-hotwater-value', hwShown || '—');
  set('re-hotwater-sub',   dv.hotWaterTempC != null ? dv.hotWaterTempC + '°C' : '');
  // Point the mode toggles at the recipe's stored mode so units + presets match the value shown.
  setMode('re-steam-mode',    steamMode);
  setMode('re-hotwater-mode', hwMode);
  for (const [prefix, key, , unit, , , , off] of MACHINE_FIELDS) {
    set(prefix + '-value', dv[key] != null ? machineFmt(unit, off)(dv[key]) : '—');
  }
  set('re-grind-value', dv.grind    != null ? String(dv.grind)       : '—');
  set('re-rpm-value',   dv.rpm      != null ? String(dv.rpm)         : '—');

  showOnStreamline = recipe.showOnStreamlineDashboard !== false;
  updateStreamlineBtn();

  selectedBeanId      = recipe.beanId || null;
  selectedBeanName    = recipe.beanName || null;
  selectedBeanBatchId = recipe.beanBatchId || null;
  selectedBeanRoaster = recipe.beanRoaster || null;
  selectedProfileId   = recipe.profileId || null;
  selectedProfileTitle = recipe.profileTitle || null;
  selectedProfileSnapshot = recipe.profileSnapshot || null;
  renderBeanChips();
  renderProfileChips();

  if (dv.grinderId) selectedGrinderId = dv.grinderId;
  renderGrinderChips();
  if (dv.basketId) selectedBasketId = dv.basketId;
  renderBasketChips();

  equipmentSelIds = Array.isArray(dv.equipmentIds) ? dv.equipmentIds.slice() : [];
  equipmentSelNames = Array.isArray(dv.equipmentNames) ? dv.equipmentNames.slice() : [];
  equipmentCustomOverrides = (dv.equipmentCustom && typeof dv.equipmentCustom === 'object') ? { ...dv.equipmentCustom } : {};
  refreshEquipmentField(reEquipmentField);

  syncPresetActive('re-dose',   set => {});
}

// Build a recipe-shaped patch from the live workflow.
async function readFromWorkflow() {
  const wf = await getWorkflow().catch(() => null);
  const ctx = (wf && wf.context) || {};
  const g = grinders.find(x => ctx.grinderId ? x.id === ctx.grinderId : (x.model || x.name) === ctx.grinderModel);
  const extras = ctx.extras || {};
  return {
    barista: ctx.baristaName || ctx.barista || '',
    drinker: ctx.drinkerName || ctx.drinker || '',
    // getWorkflow().profile is a required, non-nullable field on Decaid's Workflow model
    // (workflow.dart) whenever a workflow is loaded at all, so it's always a full Profile
    // object when present -- capture it as a snapshot so applying this recipe later doesn't
    // depend on the profile still being resolvable by id in the library.
    profileId:    (wf && wf.profile && wf.profile.id) || null,
    profileTitle: (wf && wf.profile && wf.profile.title) || null,
    profileSnapshot: (wf && wf.profile && Array.isArray(wf.profile.steps)) ? wf.profile : null,
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
  // Auto/recent favourites (recent-favs.ts) never set snapshot.profileId -- only
  // snapshot.profileTitle. Their fav.workflow.profile carries the full recorded
  // profile from the source shot (when isExecutableRecordedProfile allowed it), so
  // fall back to its id/title rather than leaving profileId null and the profile
  // chip unable to show anything.
  const wfProfile = fav.workflow && fav.workflow.profile;
  // Only treat wfProfile as a real captured profile (not a thin {id,title} stub the same
  // field can otherwise hold) when it actually carries brew steps.
  const profileSnapshot = (wfProfile && Array.isArray(wfProfile.steps)) ? wfProfile : null;
  return {
    beverage:     fav.beverage || '',
    barista:      s.barista || '',
    drinker:      s.drinker || '',
    beanId:       bean ? bean.id : null,
    beanName:     s.coffeeName || null,
    beanBatchId:  s.beanBatchId || null,
    beanRoaster:  s.coffeeRoaster || null,
    profileId:    s.profileId || (wfProfile && wfProfile.id) || null,
    profileTitle: s.profileTitle || (wfProfile && wfProfile.title) || null,
    profileSnapshot,
    dashboardVariables: {
      dose:  s.dose,
      drink: s.drink,
      grind: s.grindSetting,
      rpm:   s.rpm,
      grinderId: s.grinderId,
      basketId:   s.basketId,
      basketName: s.basketName,
      equipmentIds:   s.equipmentIds,
      equipmentNames: s.equipmentNames,
      equipmentCustom: s.equipmentCustom,
    },
  };
}

// Merge a patch into the current recipe (keep id/name), then re-render.
function applyToCurrentRecipe(src) {
  if (!src) return;
  const cur = recipe;
  const merged = {
    ...cur, ...src, id: cur.id, name: cur.name,
    dashboardVariables: { ...(cur.dashboardVariables || {}), ...(src.dashboardVariables || {}) },
  };
  recipe = merged;
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
    b => {
      // A batch belongs to its bean: switching bean drops the old one rather than pairing
      // the new bean with another bean's roast. Re-tapping the same bean keeps it.
      if (String(b.id) !== String(selectedBeanId)) { selectedBeanBatchId = null; selectedBeanRoaster = b.roaster || null; }
      selectedBeanId = b.id; selectedBeanName = b.name || ''; renderBeanChips();
    },
    { beans: true, url: '/api/v1/plugins/dye2.reaplugin/bean-picker?return=/api/v1/plugins/dye2.reaplugin/recipe-edit' }
  );
}

// Bridge profiles nest the title under profile.title (not a top-level field).
function profileLabel(p) {
  return (p.profile && p.profile.title) || p.title || p.name || 'Untitled';
}

function renderProfileChips() {
  // selectedProfileId is frequently captured straight off a favourite's/recipe's snapshot
  // (an ad-hoc profile that was never saved into the library), so it may not appear in
  // the profiles array at all. When that happens, synthesize a virtual chip so it still
  // shows — profileLabel() already falls back to .title on a plain {id, title} object.
  let list = profiles;
  if (selectedProfileId != null && !profiles.some(p => String(p.id) === String(selectedProfileId))) {
    list = [{ id: selectedProfileId, title: selectedProfileTitle || 'Profile' }, ...profiles];
  }
  renderChipGrid(
    're-profile-chips',
    orderedChips(list, selectedProfileId, 5),
    p => String(p.id) === String(selectedProfileId),
    p => profileLabel(p),
    p => { selectedProfileId = p.id; selectedProfileTitle = profileLabel(p); selectedProfileSnapshot = null; renderProfileChips(); },
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
  if (!btn) return;
  btn.classList.toggle('on', showOnStreamline);
  btn.classList.toggle('off', !showOnStreamline);
  const icon = document.getElementById('re-show-streamline-icon');
  if (icon) icon.innerHTML = showOnStreamline ? STREAMLINE_ON_SVG : STREAMLINE_OFF_SVG;
}

function getCurrentRecipeData() {
  // A stepper showing '—' is blank: null, not 0. Apply and dial-in recording both skip a
  // null field, but would apply / treat a stored 0 as a real value.
  const num = id => { const n = parseFloat(document.getElementById(id)?.textContent); return isNaN(n) ? null : n; };
  const steamMode = document.querySelector('.re-steam-mode.active')?.dataset.mode || 'flow';
  const steamVal  = num('re-steam-value');
  const hwMode    = document.querySelector('.re-hotwater-mode.active')?.dataset.mode || 'vol';
  const hwVal     = num('re-hotwater-value');
  // The mode only picks which value this editor shows. The other one is not on screen, so keep
  // what the recipe holds rather than saving it as blank (which recipeChanges writes as null).
  const held = recipe.dashboardVariables || {};
  // Persist the drink ratio only while the yield still equals dose × ratio (i.e. not manually overridden).
  const doseVal = num('re-dose-value'), drinkVal = num('re-drink-value');
  const ratioAttr = document.getElementById('re-drink-value')?.dataset.ratio;
  const ratioNum = ratioAttr ? parseFloat(ratioAttr) : NaN;
  const ratio = (!isNaN(ratioNum) && doseVal && drinkVal != null && Math.abs(drinkVal - Math.round(doseVal * ratioNum * 10) / 10) < 0.05)
    ? ratioNum : undefined;
  return {
    name:      document.getElementById('re-name-input')?.value || '',
    beverage:  document.getElementById('re-beverage-input')?.value || '',
    barista:   document.getElementById('re-barista-input')?.value || '',
    drinker:   document.getElementById('re-drinker-input')?.value || '',
    beanId:    selectedBeanId,
    beanName:  selectedBeanName,
    beanBatchId: selectedBeanBatchId,
    beanRoaster: selectedBeanRoaster,
    profileId: selectedProfileId,
    profileTitle: selectedProfileTitle,
    profileSnapshot: selectedProfileSnapshot,
    showOnStreamlineDashboard: showOnStreamline,
    stripSlot,
    dashboardVariables: {
      dose:    num('re-dose-value'),
      drink:   num('re-drink-value'),
      ratio,
      brewC:   num('re-brew-c-value'),
      steamMode,
      steamTimeS:   steamMode === 'time' ? steamVal : held.steamTimeS,
      steamFlowMls: steamMode === 'flow' ? steamVal : held.steamFlowMls,
      flushS:  num('re-flush-value'),
      hotWaterMode:  hwMode,
      hotWaterMl:    hwMode === 'vol'  ? hwVal : held.hotWaterMl,
      hotWaterTempC: hwMode === 'temp' ? hwVal : held.hotWaterTempC,
      // The section may be shut, but its steppers are rendered either way, so these read the
      // same as every other field. 'Off' is a stored 0, not a blank (which means not held).
      ...machineValues(held),
      grind:   num('re-grind-value'),
      rpm:     num('re-rpm-value'),
      grinderId: selectedGrinderId,
      grinderModel: (grinders.find(g => g.id === selectedGrinderId) || {}).model,
      basketId:   selectedBasketId,
      basketName: (baskets.find(b => b.id === selectedBasketId) || {}).name,
      equipmentIds:    equipmentSelIds.slice(),
      equipmentNames:  equipmentSelNames.slice(),
      equipmentCustom: { ...equipmentCustomOverrides },
    },
  };
}

// The Machine Settings fields as getCurrentRecipeData wants them. A stepper that is somehow not
// on the page keeps what the recipe holds rather than blanking it.
function machineValues(held) {
  const out = {};
  for (const [prefix, key, , , , , , off] of MACHINE_FIELDS) {
    const el = document.getElementById(prefix + '-value');
    if (!el) { out[key] = held[key] ?? null; continue; }
    const txt = (el.textContent || '').trim();
    const n = parseFloat(txt);
    // Own parse: getCurrentRecipeData's num() is local to it.
    out[key] = off && /^off$/i.test(txt) ? 0 : (isNaN(n) ? null : n);
  }
  return out;
}

// The five tabs are the slot control. Each is named for whoever holds its slot; the targeted one
// (stripSlot) is active. Tapping a tab targets that slot for THIS recipe (it does not switch which
// recipe is open); tapping the active one clears the target (saved, not on the strip).
// Taking a slot another recipe holds is confirmed on SAVE (a second tap), as auto-fav-edit does.
function renderSlots() {
  document.querySelectorAll('#re-tabs .re-tab').forEach(b => {
    const n = parseInt(b.dataset.slot);
    b.textContent = stripTabLabel(allRecipes, n);
    b.classList.toggle('active', n === stripSlot);
  });
}
function setupSlots() {
  document.querySelectorAll('#re-tabs .re-tab').forEach(btn => btn.addEventListener('click', () => {
    stripSlot = stripNextTarget(stripSlot, parseInt(btn.dataset.slot));
    slotArmed = null;
    const save = document.getElementById('re-save-btn');
    if (save) save.textContent = 'SAVE RECIPE';
    renderSlots();
  }));
}

// Opening a See-All picker mid-edit pushes entries onto the history stack (picker, then
// this page again on confirm), so history.back() lands on the picker the user just left
// rather than the page that opened this page. Leave by route instead: select-recipe leaves
// its route in dye_recipeEditBack (the ?return= is lost across a picker round trip).
function leaveRecipeEdit() {
  const ret = new URLSearchParams(location.search).get('return') || sessionStorage.getItem('dye_recipeEditBack');
  window.location.href = ret || 'dashboard';
}

// Persist the in-progress form (full-page nav to the picker would otherwise lose it),
// then open the picker. initRecipeEdit restores the draft and folds in the pick on return.
function goToPicker(route) {
  recipe = { ...recipe, ...getCurrentRecipeData(), id: recipe.id };
  sessionStorage.setItem('dye_recipeDraft', JSON.stringify({ recipe }));
  window.location.href = route;
}

// Steam/Hot-Water toggles change BOTH the unit shown in the stepper and the preset strip.
// ponytail: preset values below are sensible DE1 defaults — confirm against Figma if needed.
const MODE_CFG = {
  're-steam-mode': {
    valueId: 're-steam-value',
    field:   { time: 'steamTimeS', flow: 'steamFlowMls' },
    unit:    { time: 's', flow: 'ml/s' },
    presets: { time: ['29s','15s','31s','28s'], flow: ['0.8ml/s','1ml/s','1.2ml/s','1.5ml/s'] },
  },
  're-hotwater-mode': {
    valueId: 're-hotwater-value',
    field:   { vol: 'hotWaterMl', temp: 'hotWaterTempC' },
    unit:    { vol: 'ml', temp: '°c' },
    presets: { vol: ['75ml','120ml','180ml','200ml'], temp: ['80°c','85°c','90°c','95°c'] },
  },
};
function activeMode(cls) { return document.querySelector('.' + cls + '.active')?.dataset.mode; }

// The machine settings behind the Machine Settings disclosure (dye2#23): dashboardVariables key,
// label, unit, and the adjuster's step / min / max. Steam temperature and the milk stop take
// ‘off’ as a stored 0, so they are stepped with wireOffAdjuster; a blank field is still
// ‘not held’, which apply skips.
const MACHINE_FIELDS = [
  ['re-steam-temp', 'steamTempC', 'Steam temp', '°c', 5, 135, 170, true],
  ['re-milk-stop', 'steamStopAtTempC', 'Milk stop', '°c', 5, 30, 80, true],
  ['re-hw-time', 'hotWaterTimeS', 'Hot water time', 's', 5, 5, 120, false],
  ['re-hw-flow', 'hotWaterFlowMls', 'Hot water flow', 'ml/s', 0.5, 0.5, 8, false],
  ['re-flush-temp', 'flushTempC', 'Flush temp', '°c', 5, 5, 95, false],
  ['re-flush-flow', 'flushFlowMls', 'Flush flow', 'ml/s', 0.5, 1, 8, false],
];
// 0 reads as Off, and the editor writes it back as 0 (see numOff).
const machineFmt = (unit, off) => (v) => (off && !(v > 0) ? 'Off' : v + unit);

let machineOpen = false;

function setupMachineSection() {
  const btn = document.getElementById('re-machine-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    machineOpen = !machineOpen;
    const rows = document.getElementById('re-machine-rows');
    const caret = document.getElementById('re-machine-caret');
    if (rows) rows.style.display = machineOpen ? '' : 'none';
    if (caret) caret.classList.toggle('open', machineOpen);
    btn.setAttribute('aria-expanded', machineOpen ? 'true' : 'false');
    renderHeld();
  });
}

// The summary under the header: what the recipe holds that is not on screen. Shut, that is every
// machine setting; open, only the half of each pair the active mode hides.
function renderHeld() {
  const list = document.getElementById('re-held-list');
  if (!list) return;
  const dv = recipe.dashboardVariables || {};
  const pairs = [
    activeMode('re-steam-mode') === 'time' ? ['steamFlowMls', 'Steam flow', 'ml/s'] : ['steamTimeS', 'Steam time', 's'],
    activeMode('re-hotwater-mode') === 'vol' ? ['hotWaterTempC', 'Hot water temp', '°c'] : ['hotWaterMl', 'Hot water vol', 'ml'],
  ];
  const held = MACHINE_FIELDS.filter(([, k]) => dv[k] != null);
  const rows = (machineOpen ? [] : held.map(([, k, label, unit, , , , off]) => [k, label, unit, off]))
    .concat(pairs.map(([k, label, unit]) => [k, label, unit, false]))
    .filter(([k]) => dv[k] != null);
  list.innerHTML = '';
  for (const [k, label, unit, off] of rows) {
    const row = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'font-semibold';
    name.textContent = label + ' ';
    row.appendChild(name);
    // textContent, not markup: these come straight out of KV.
    row.appendChild(document.createTextNode(off && !(dv[k] > 0) ? 'Off' : dv[k] + unit));
    list.appendChild(row);
  }
  const count = document.getElementById('re-machine-count');
  if (count) count.textContent = held.length ? held.length + ' held' : '';
}
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
    // A recipe holds both values of a pair (dye2#23), so each mode shows ITS field, blank when
    // it has none. Relabelling the other mode's number would save 30s as 30 ml/s.
    const held = recipe.dashboardVariables || {};
    const v = cfg.field ? held[cfg.field[mode]] : parseFloat(valEl.textContent);
    const n = v == null ? NaN : parseFloat(v);
    valEl.textContent = isNaN(n) ? '—' : n + (cfg.unit[mode] || '');
    syncPresetActive(idPrefix, valEl.textContent);
  }
  // The mode decides which of a pair is on screen, so the read-only list moves with it.
  renderHeld();
}
function setMode(cls, mode) {
  document.querySelectorAll('.' + cls).forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  applyMode(cls);
}
// What is on screen belongs to the mode now active: park it on the in-memory slot before the
// toggle moves on, so an unsaved edit survives a mode switch and getCurrentRecipeData picks it
// up (its 'held' fallback) for the mode that is no longer shown.
function stashModeValue(cls) {
  const cfg = MODE_CFG[cls];
  const slot = recipe;
  const valEl = cfg && document.getElementById(cfg.valueId);
  const key = cfg && cfg.field && cfg.field[activeMode(cls)];
  if (!key || !slot || !valEl) return;
  const n = parseFloat(valEl.textContent);
  slot.dashboardVariables = slot.dashboardVariables || {};
  slot.dashboardVariables[key] = isNaN(n) ? null : n;
}

function setupModeToggle(cls) {
  document.querySelectorAll('.' + cls).forEach(btn => {
    btn.addEventListener('click', () => { stashModeValue(cls); setMode(cls, btn.dataset.mode); });
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
// Tapping the field opens a pick-list instead of the keyboard (the field starts
// readonly, which the WebView won't pop a keyboard for — same trick the themed date
// picker already uses). "+ New…" is the only path that hands the keyboard back, and only
// for as long as it takes to type — blur returns the field to readonly/display mode.
function setupNameCombo(field, loader) {
  const input = document.getElementById(field + '-input');
  const drop  = document.getElementById(field + '-drop');
  const pencil = document.getElementById(field + '-pencil');
  if (!input || !drop) return;
  async function options() {
    if (!nameComboCache[field]) { try { nameComboCache[field] = await loader(); } catch (e) { nameComboCache[field] = []; } }
    return nameComboCache[field];
  }
  function closeDrop() { drop.classList.remove('open'); }
  function commitTyping() { input.readOnly = true; closeDrop(); }
  // A touch tap on a WebView may deliver pointerdown, mousedown or both: act on whichever comes
  // first and ignore the rest of the same tap (a second event within 600ms).
  let lastTap = 0;
  function onTap(el, fn) {
    const handler = (ev) => {
      ev.preventDefault();
      const now = Date.now();
      if (now - lastTap < 600) return;
      lastTap = now;
      // The click this tap still produces would land on whatever is under the finger once the
      // drop has closed (it can re-open the list, or count as an "outside" click and put the
      // field straight back to readonly): swallow it.
      const swallow = (c) => { c.stopPropagation(); c.preventDefault(); };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 450);
      fn(ev);
    };
    el.addEventListener('pointerdown', handler);
    el.addEventListener('mousedown', handler);
  }
  async function open() {
    if (!input.readOnly) return;   // already in "type a new value" mode — let it type, don't reopen
    const opts = await options();
    drop.innerHTML = '';
    const newRow = document.createElement('div');
    newRow.className = 're-combo-opt';
    newRow.textContent = '＋ New…';
    onTap(newRow, () => {
      closeDrop();
      input.readOnly = false;   // before focus(), in this same gesture task
      input.value = '';
      input.focus();
      // A WebView may refuse a programmatic focus (no soft keyboard). If so the field is already
      // writable and is left that way, so the user's next tap on the field itself focuses it and
      // types; the outside-click listener below still returns it to display mode afterwards.
      // Belt-and-braces alongside the 'blur' listener below: a tap on a plain (non-focusable)
      // area doesn't reliably blur a focused input on every WebView, so also watch for a
      // click anywhere outside the field itself.
      setTimeout(() => document.addEventListener('click', function outside(ev2) {
        if (ev2.target !== input && ev2.target !== pencil && !drop.contains(ev2.target)) {
          commitTyping();
          document.removeEventListener('click', outside);
        }
      }), 0);
    });
    drop.appendChild(newRow);
    if (!opts.length) {
      const e = document.createElement('div'); e.className = 're-combo-empty'; e.textContent = 'No previous entries'; drop.appendChild(e);
    } else {
      opts.slice(0, 50).forEach(o => {
        const el = document.createElement('div'); el.className = 're-combo-opt'; el.textContent = o;
        // pointerdown/mousedown (not click) so the pick lands before the input's blur closes the drop.
        onTap(el, () => { input.value = o; closeDrop(); });
        drop.appendChild(el);
      });
    }
    drop.classList.add('open');
  }
  pencil?.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  input.addEventListener('click', open);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  input.addEventListener('blur', () => setTimeout(commitTyping, 150));
}

function setupStreamlineToggle() {
  document.getElementById('re-show-streamline-btn')?.addEventListener('click', () => {
    showOnStreamline = !showOnStreamline;
    updateStreamlineBtn();
  });
}

// The live Workflow still holds the pre-save values of the armed recipe, so the next workflow
// change of any kind would record them back over the save (dye2#33). Apply the save and re-arm
// on it — PUT first, then POST, as the dashboard does: the plugin reads the live workflow to
// fingerprint the profile and to suppress the apply's own echo. Only for the armed recipe; a
// save of any other slot leaves the Workflow alone.
async function reapplyIfSelected(saved) {
  if (!saved || !saved.workflow) return false;
  let sel = null;
  try { sel = await (await fetch('/api/v1/plugins/dye2.reaplugin/selection')).json(); }
  catch (e) { console.warn('selection read failed', e); return false; }
  if (!sel || sel.kind !== 'recipe' || String(sel.id) !== String(saved.id)) return false;
  await updateWorkflow(saved.workflow);
  await fetch('/api/v1/plugins/dye2.reaplugin/selection', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'recipe', id: String(saved.id) }),
  });
  return true;
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
    recipe = { id: recipe.id };
    renderRecipe(recipe);
  });

  document.getElementById('re-cancel-btn')?.addEventListener('click', () => leaveRecipeEdit());

  document.getElementById('re-save-btn')?.addEventListener('click', async () => {
    const data = getCurrentRecipeData();
    const saveBtn = document.getElementById('re-save-btn');
    try {
      const holder = stripSlotHolder(allRecipes, recipe.id, stripSlot);
      if (holder && slotArmed !== stripSlot) {
        slotArmed = stripSlot;
        saveBtn.textContent = stripReplaceLabel(holder, stripSlot);
        return;
      }
      const saved = await updateRecipe(recipe.id, recipeChanges(recipeBaseline, data));
      await reapplyIfSelected(saved);
      leaveRecipeEdit();
    } catch (e) { console.error('Failed to save recipe:', e); }
  });
}

async function initRecipeEdit() {
  setupSlots();
  setupStreamlineToggle();
  setupPresetStrips();
  // After setupPresetStrips so the mode toggle owns/rewires the strips it rebuilds.
  setupMachineSection();
  setupModeToggle('re-steam-mode');
  setupModeToggle('re-hotwater-mode');
  setupNameCombo('re-barista',  () => distinctNames('baristaName'));
  setupNameCombo('re-drinker',  () => distinctNames('drinkerName'));
  setupNameCombo('re-beverage', distinctBeverages);
  setupFooter();
  initEquipmentField(reEquipmentField);
  wireEquipmentValuesModal();
  loadEquipmentCache();

  wireAdjuster('re-dose-minus',  're-dose-plus',  're-dose-value',  0.5, 0, null, v => v + 'g');
  wireAdjuster('re-drink-minus', 're-drink-plus', 're-drink-value', 1,   0, null, v => v + 'g');
  wireAdjuster('re-brew-c-minus','re-brew-c-plus','re-brew-c-value',1, 60, 100,  v => v + '°c');
  wireAdjuster('re-steam-minus', 're-steam-plus', 're-steam-value', 1,   0, null, v => v + (MODE_CFG['re-steam-mode'].unit[activeMode('re-steam-mode')] || 's'));
  wireAdjuster('re-flush-minus', 're-flush-plus', 're-flush-value', 1,   0, null, v => v + 's');
  wireAdjuster('re-hotwater-minus','re-hotwater-plus','re-hotwater-value', 5, 0, null, v => v + (MODE_CFG['re-hotwater-mode'].unit[activeMode('re-hotwater-mode')] || 'ml'));
  for (const [prefix, , , unit, step, min, max, off] of MACHINE_FIELDS) {
    if (off) wireOffAdjuster(prefix, step, min, max, unit);
    else wireAdjuster(prefix + '-minus', prefix + '-plus', prefix + '-value', step, min, max, machineFmt(unit, false));
  }
  wireAdjuster('re-grind-minus', 're-grind-plus', 're-grind-value', 0.1, 0, null, v => v.toFixed(1));
  wireAdjuster('re-rpm-minus',   're-rpm-plus',   're-rpm-value',   1,   1, null, v => String(v));

  let loadedRecipes = [];
  try {
    const result = await getRecipes();
    loadedRecipes = Array.isArray(result) ? result : (result && result.items ? result.items : []);
  } catch (e) {
    console.warn('Could not load recipes from KV store:', e);
  }
  allRecipes = loadedRecipes;
  // Which recipe: the URL wins (the skin is on another origin, so it cannot set our
  // sessionStorage), then the stored id from DYE2's own pages. ?new=1 forces a blank form.
  // Both are consumed once and dropped from the address bar, so a picker round trip or a
  // reload falls back to the stored id and a ?new=1 never mints a second new id.
  const qs = new URLSearchParams(location.search);
  if (qs.get('new')) sessionStorage.removeItem('dye_editRecipeId');
  else if (qs.get('id')) sessionStorage.setItem('dye_editRecipeId', qs.get('id'));
  if (qs.has('new') || qs.has('id')) {
    qs.delete('new'); qs.delete('id');
    const rest = qs.toString();
    try { history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash); } catch (e) { /* not fatal */ }
  }
  const editId = sessionStorage.getItem('dye_editRecipeId');
  const stored = editId ? loadedRecipes.find(r => r && r.id === editId) : null;
  recipeBaseline = JSON.parse(JSON.stringify(stored || {}));
  recipe = stored ? { ...stored } : { id: editId || newId('recipe') };
  if (!editId) sessionStorage.setItem('dye_editRecipeId', recipe.id);   // so a picker round trip keeps the same new id
  stripSlot = recipe.stripSlot == null ? null : recipe.stripSlot;

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

  // Returning from a See-All picker: restore the draft we stashed, then fold in the pick.
  // Gated on the draft so stray picker keys from other flows are never adopted here.
  const draftRaw = sessionStorage.getItem('dye_recipeDraft');
  sessionStorage.removeItem('dye_recipeDraft');
  if (draftRaw) {
    try {
      const draft = JSON.parse(draftRaw);
      if (draft.recipe && draft.recipe.id === recipe.id) { recipe = draft.recipe; stripSlot = recipe.stripSlot == null ? null : recipe.stripSlot; }
      const cur = recipe;
      const beanId = sessionStorage.getItem('dye_selectedBeanId');
      if (beanId) {
        cur.beanId = beanId;
        cur.beanName = sessionStorage.getItem('dye_selectedBeanName') || '';
        // The picker writes '' for a bean picked without a batch; that must clear the old one.
        cur.beanBatchId = sessionStorage.getItem('dye_selectedBatchId') || null;
        cur.beanRoaster = sessionStorage.getItem('dye_selectedBeanRoaster') || null;
        ['dye_selectedBeanId','dye_selectedBeanName','dye_selectedBeanRoaster','dye_selectedBatchId','dye_selectedRoastDate']
          .forEach(k => sessionStorage.removeItem(k));
      }
      const profileId = sessionStorage.getItem('dye_selectedProfileId');
      if (profileId) {
        cur.profileId = profileId;
        cur.profileTitle = sessionStorage.getItem('dye_selectedProfileTitle') || '';
        cur.profileSnapshot = null;   // fresh library pick; its id will always resolve, don't let a stale ad-hoc snapshot shadow it
        ['dye_selectedProfileId','dye_selectedProfileTitle'].forEach(k => sessionStorage.removeItem(k));
      }
      // Returning from the equipment manage page's "+ New…" round trip — add it to
      // whatever was already selected, same as toggling an existing row on.
      const eqId = sessionStorage.getItem('dye_selectedEquipmentId');
      if (eqId) {
        cur.dashboardVariables = cur.dashboardVariables || {};
        const dvIds = Array.isArray(cur.dashboardVariables.equipmentIds) ? cur.dashboardVariables.equipmentIds.slice() : [];
        const dvNames = Array.isArray(cur.dashboardVariables.equipmentNames) ? cur.dashboardVariables.equipmentNames.slice() : [];
        if (!dvIds.includes(eqId)) { dvIds.push(eqId); dvNames.push(sessionStorage.getItem('dye_selectedEquipmentName') || ''); }
        cur.dashboardVariables.equipmentIds = dvIds;
        cur.dashboardVariables.equipmentNames = dvNames;
      }
      ['dye_selectedEquipmentId','dye_selectedEquipmentName','dye_editShotReturn'].forEach(k => sessionStorage.removeItem(k));
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
  renderSlots();
  renderRecipe(recipe);
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
