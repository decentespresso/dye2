import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { shotPagingScript } from "../utils/shot-paging";
import { chartScript } from "../utils/chart";
import { iconHistory, iconClipboard } from "../utils/icons";
import { enjoymentScaleScript } from "../utils/shared-components";
import { recordedShotScript } from "../utils/recorded-shot";
import { shotWeightsScript } from "../utils/shot-weights";

const styles = `
  /* The Undo and Clipboard buttons are the two legacy base64 PNGs from utils/icons.ts, so
     their near-black glyph is baked into the image and no token can reach it — in dark mode
     both buttons simply vanished. brightness(0) flattens whatever shade the PNG holds to
     black, invert(0.91) lifts that to --text-primary (#e8e8e8); the transparent background
     is left alone. Light mode is untouched. Inline SVG (utils/lucide.ts) needs none of this
     and is what new work should use. */
  :root[data-theme="dark"] #dye-history-btn img,
  :root[data-theme="dark"] #dye-clipboard-btn img { filter: brightness(0) invert(0.91); }
  /* Navy popup menu, matches Figma 2345:1613 */
  .dye-dash-dropdown {
    display: none;
    position: absolute;
    bottom: calc(100% + 4px);
    left: 0;
    min-width: 220px;
    background: var(--mimoja-blue);
    border: none;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    z-index: 50;
  }
  .dye-dash-dropdown.open { display: block; }
  .dye-dash-dropdown-item {
    padding: 18px 24px;
    font-family: 'Inter', sans-serif;
    font-size: 21px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
  }
  .dye-dash-dropdown-item + .dye-dash-dropdown-item { border-top: 1px solid rgba(255,255,255,0.28); }
  .dye-dash-dropdown-item:hover { background: rgba(255,255,255,0.14); }
  .dye-dash-dropdown-item-danger:hover { background: rgba(229,57,53,0.85); }
  /* No page designed for this yet — show it as unavailable rather than silently inert. */
  .dye-dash-dropdown-item-disabled { opacity: 0.4; cursor: default; pointer-events: none; }
  /* Inline Barista / Drinker editors. Dropdown matches the auto-fav-edit combo style. */
  .dye-name-combo { position: relative; }
  .dye-name-input {
    font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 400;
    color: var(--text-primary); background: var(--box-color);
    border: 2px solid var(--mimoja-blue); border-radius: 8px;
    padding: 0 12px; height: 44px; width: 240px; outline: none;
  }
  .dye-name-drop {
    display: none; position: absolute; top: calc(100% + 6px); left: 0; z-index: 60;
    min-width: 260px; max-height: 320px; overflow-y: auto;
    background: var(--box-color); border: 1px solid var(--profile-button-outline-color);
    border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  }
  .dye-name-drop.open { display: block; }
  .dye-name-opt {
    padding: 14px 18px; font-size: 22px; color: var(--text-primary); cursor: pointer;
    border-bottom: 1px solid var(--profile-button-outline-color);
  }
  .dye-name-opt:last-child { border-bottom: none; }
  .dye-name-opt:hover { background: var(--bgmain-color); }
  .dye-name-empty { padding: 14px 18px; font-size: 20px; color: var(--text-primary-disabled); }

  .dye-grinder-tab {
    font-family: 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 600;
    color: var(--tab-idle);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .dye-grinder-tab.active { color: var(--mimoja-blue); }

  .dye-recipe-pill {
    box-sizing: border-box;
    position: relative;
    width: 225px;
    height: 60px;
    border-radius: 15px;
    font-family: 'Inter', sans-serif;
    font-size: 21px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    border: 2px solid var(--chip-stroke);
    background: var(--card-bg);
    color: var(--chip-text);
    transition: background 0.15s, color 0.15s;
  }
  /* Rail arrow at the end of its travel. Opacity, not a colour: the arrow SVGs carry
     stroke="var(--mimoja-blue)" inline, so dimming the button works in both themes. */
  .dye-rail-arrow-off { opacity: 0.3; pointer-events: none; }
  /* Pills all fit: no scrolling to do, so the arrows go away. visibility, not display:
     keeping their width stops the rail from widening, which would change how many pills
     fit and make this test flip back and forth. */
  .dye-rail-arrow-hide { visibility: hidden; pointer-events: none; }
  .dye-recipe-pill.active { background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff; }
  /* Recent labels lead with the profile and may wrap to two lines: several recents share a
     bean, and one-line truncation made them identical ("Colombia El Par..."). There is no
     hover on the tablet, so the distinguishing part has to be visible in the pill itself. */
  .dye-recipe-pill.dye-pill-recent .dye-recipe-pill-label {
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
    white-space: normal; text-overflow: clip; line-height: 1.15; font-size: 19px;
    word-break: break-word;
  }
  .dye-recipe-pill-label {
    min-width: 0;
    max-width: 100%;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* The rail carries scrollbar-width:none inline, which the tablet's Chromium WebView
     ignores: it needs this rule too, or a scrollbar sits across the bottom of the pills. */
  #dye-recipe-pills::-webkit-scrollbar,
  #dye-grinder-tabs::-webkit-scrollbar { display: none; }

  /* ── Visualizer connected state ──────────────────────── */
  #dye-visualizer-btn.viz-connected svg:first-child {
    stroke: #0ca581;
  }

  /* ── Visualizer modal ────────────────────────────────── */
  .viz-overlay {
    display: none; position: fixed; inset: 0;
    background: var(--overlay-scrim); z-index: 200;
    align-items: center; justify-content: center;
  }
  .viz-overlay.open { display: flex; }
  .viz-modal {
    background: var(--box-color); border-radius: 24px;
    padding: 44px 52px; width: 680px;
    font-family: 'Inter', sans-serif;
  }
  .viz-modal h2 {
    font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 28px;
  }
  .viz-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
  .viz-field label { font-size: 22px; font-weight: 600; color: var(--text-primary); }
  .viz-input {
    border: 1px solid var(--profile-button-outline-color);
    border-radius: 12px; padding: 0 18px; height: 64px;
    font-family: 'Inter', sans-serif; font-size: 22px;
    color: var(--text-primary); background: var(--profile-button-background-color);
    outline: none; width: 100%;
  }
  .viz-input:focus { border-color: var(--mimoja-blue); }
  .viz-checkbox-row {
    display: flex; align-items: center; gap: 14px;
    font-size: 22px; color: var(--text-primary); margin-bottom: 22px;
  }
  .viz-checkbox { width: 28px; height: 28px; cursor: pointer; accent-color: var(--mimoja-blue); }
  .viz-status {
    font-size: 20px; min-height: 24px; margin-bottom: 16px;
    color: var(--text-primary-disabled);
  }
  .viz-status.error { color: #E53935; }
  .viz-status.success { color: #2E8B57; }
  .viz-footer { display: flex; justify-content: flex-end; gap: 14px; margin-top: 8px; }
  .viz-btn-cancel {
    padding: 0 30px; height: 60px; border-radius: 9999px;
    font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 700;
    color: var(--text-primary); cursor: pointer;
  }
  .viz-btn-save {
    padding: 0 36px; height: 60px; border-radius: 9999px;
    background: var(--mimoja-blue); color: #fff;
    font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 700;
    cursor: pointer;
  }
  .viz-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
  .viz-logged-in-row {
    display: flex; align-items: center; gap: 12px;
    font-size: 22px; color: var(--text-primary); margin-bottom: 22px;
  }
  .viz-logged-in-user { font-weight: 700; color: var(--mimoja-blue); }
`;

// One combo field in the shot filter drawer. Reuses the Barista/Drinker combo (dye-name-*)
// styling already on this page rather than inventing a new one -- readonly so tapping to
// browse the list doesn't pop the keyboard, same reasoning as that field.
function shotFilterFieldHtml(field: string, label: string): string {
  return `<div>
    <div class="text-[var(--low-contrast-white)] text-[18px] mb-[6px]">${label}</div>
    <div class="dye-name-combo">
      <input id="dye-filter-${field}-input" class="dye-name-input" style="width:100%;padding-right:34px" readonly autocomplete="off" placeholder="Any ${label.toLowerCase()}">
      <!-- Clears just this field -- shown only once it holds a pick, see setupFilterCombo. -->
      <button id="dye-filter-${field}-x" class="hidden" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:var(--low-contrast-white);font-size:22px;line-height:1;cursor:pointer">×</button>
      <div id="dye-filter-${field}-drop" class="dye-name-drop"></div>
    </div>
  </div>`;
}

function buildContent(): string { return `
<div id="dye-dash-root" class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col relative font-['Inter',sans-serif]">
  <div class="flex flex-1 overflow-hidden">

    <!-- LEFT PANEL: Last Shot Review -->
    <div class="flex flex-col w-1/2 shrink-0 bg-[var(--card-bg)] border-r border-[var(--profile-button-outline-color)] overflow-hidden">
      <div class="relative flex flex-col gap-[27px] px-[38px] pt-[32px] pb-[40px] flex-1 overflow-hidden">

        <!-- Header row -->
        <div class="flex items-center justify-between shrink-0 h-[90px]">
          <div id="dye-last-shot-headings" class="flex flex-col gap-[8px]">
            <div id="dye-last-shot-label" class="text-[var(--mimoja-blue)] font-semibold text-[30px] leading-[1.2]">Last Shot: —</div>
            <div id="dye-last-shot-date" class="text-[var(--text-primary)] font-normal text-[24px] leading-[1.2]">—</div>
          </div>
          <!-- The count moves into the search popup below; the heading stays up regardless of
               whether a search/filter is active, since the popup is now an overlay rather than
               something that swaps places with this row. -->
          <div class="flex items-center gap-[30px]">
            <button id="dye-search-btn" class="relative text-[var(--mimoja-blue)] cursor-pointer">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <!-- Dot shows when free text or any filter field in the popup below is active. -->
              <span id="dye-search-badge-dot" class="hidden absolute top-0 right-0 w-[12px] h-[12px] rounded-full bg-[var(--mimoja-blue)] border-2 border-[var(--card-bg)]"></span>
            </button>
            <div class="flex items-center border-2 border-[var(--mimoja-blue)] rounded-[23px] overflow-hidden">
              <button id="dye-prev-shot-btn" class="flex items-center justify-center w-[60px] h-[54px] shrink-0 cursor-pointer">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div class="w-[2px] h-[54px] bg-[var(--profile-button-outline-color)]"></div>
              <button id="dye-same-beans-btn" class="px-[20px] h-[54px] flex items-center justify-center cursor-pointer">
                <span class="text-[var(--mimoja-blue)] font-semibold text-[24px] whitespace-nowrap">All Shots</span>
              </button>
              <div class="w-[2px] h-[54px] bg-[var(--profile-button-outline-color)]"></div>
              <button id="dye-next-shot-btn" class="flex items-center justify-center w-[60px] h-[54px] shrink-0 cursor-pointer">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Search popup: free text plus Bean / Roaster / Grinder / Profile, all composing
             together (the bridge ANDs every GET /api/v1/shots param, search included -- see
             reaprime shot_dao.dart getShotsPaginated). Absolute so it overlays the shot review
             below rather than pushing it down; its parent just needs 'relative' for the anchor. -->
        <div id="dye-search-popup" class="hidden absolute top-[122px] left-[38px] right-[38px] z-[45] bg-[var(--card-bg)] border border-[var(--profile-button-outline-color)] rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] px-[24px] py-[20px] flex flex-col gap-[18px]">
          <div class="flex items-center gap-[16px]">
            <div class="relative flex-1 min-w-0">
              <input id="dye-search-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="Coffee, roaster, profile, grinder, notes…"
                class="w-full h-[54px] pl-[24px] pr-[44px] rounded-[23px] border-2 border-[var(--mimoja-blue)] bg-transparent text-[var(--text-primary)] text-[24px] outline-none">
              <!-- Clears just the free-text search -- shown only once something is typed. -->
              <button id="dye-search-input-x" class="hidden" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);color:var(--low-contrast-white);font-size:24px;line-height:1;cursor:pointer">×</button>
            </div>
            <span id="dye-search-count" class="text-[var(--low-contrast-white)] text-[21px] whitespace-nowrap shrink-0"></span>
          </div>
          <div class="grid grid-cols-2 gap-x-[24px] gap-y-[18px]">
            ${shotFilterFieldHtml("bean", "Bean")}
            ${shotFilterFieldHtml("roaster", "Roaster")}
            ${shotFilterFieldHtml("grinder", "Grinder")}
            ${shotFilterFieldHtml("profile", "Profile")}
          </div>
          <div class="flex items-center gap-[16px]">
            <span class="text-[var(--low-contrast-white)] text-[18px]">Rating</span>
            <!-- "N stars & up". A distinct id/class from the Last Shot rating widget's
                 #dye-star-rating .dye-star -- sharing either would also wire this up to save
                 a rating onto the displayed shot, which is not what picking a filter means. -->
            <div id="dye-filter-rating" class="flex items-center gap-[4px]">
              ${[1, 2, 3, 4, 5].map(i => `<svg class="dye-filter-star cursor-pointer" data-index="${i}" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('')}
            </div>
            <span id="dye-filter-rating-label" class="text-[var(--low-contrast-white)] text-[16px]"></span>
          </div>
          <div class="flex justify-end">
            <button id="dye-shot-filter-clear" class="hidden text-[var(--mimoja-blue)] text-[20px] font-semibold cursor-pointer">Clear filters</button>
          </div>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>
        <!-- Grows into the column's spare height instead of leaving a void at the bottom;
             330px stays the floor so a short column still shows a usable curve. -->
        <div id="plotly-chart" class="flex-1 min-h-[330px] w-full"></div>
        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <div class="flex flex-col gap-[14px] shrink-0">
          <div id="dye-shot-profile" class="text-[var(--text-primary)] font-semibold text-[24px] leading-[1.2] truncate">—</div>
          <div id="dye-shot-stats" class="text-[var(--text-primary)] font-normal text-[24px] leading-[1.2]">—</div>
          <div id="dye-shot-beans" class="text-[var(--text-primary)] font-normal text-[24px] leading-[1.2] truncate">—</div>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <div class="flex flex-col gap-[14px] shrink-0">
          <div id="dye-shot-grinder" class="text-[var(--text-primary)] font-normal text-[24px] leading-[1.2]">—</div>
          <div class="flex items-center gap-[24px]">
            <div id="dye-shot-barista" class="text-[var(--text-primary)] font-normal text-[24px] leading-[1.2]">—</div>
            <div class="flex items-center gap-[8px]" id="dye-star-rating">
              <svg class="dye-star cursor-pointer" data-index="1" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg class="dye-star cursor-pointer" data-index="2" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg class="dye-star cursor-pointer" data-index="3" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg class="dye-star cursor-pointer" data-index="4" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg class="dye-star cursor-pointer" data-index="5" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--profile-button-outline-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <button id="dye-read-note-btn" class="text-[var(--text-primary)] font-semibold text-[24px] cursor-pointer">Read Note</button>
          </div>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <!-- Figma 2345:633: bottom buttons share one horizon (centre 75px above the
             canvas bottom), so both columns use the same 70px centred band. -->
        <div class="flex items-center gap-[18px] shrink-0 h-[70px]">
          <div class="relative">
            <div id="dye-edit-shot-btn" class="flex items-center gap-0 bg-[var(--mimoja-blue)] text-white rounded-[23px] h-[54px] cursor-pointer overflow-hidden">
              <span id="dye-edit-shot-go" class="px-[20px] h-full flex items-center font-semibold text-[21px] whitespace-nowrap">Edit Shot</span>
              <div class="w-[1px] h-[40px] bg-white opacity-40"></div>
              <span id="dye-edit-shot-chevron" class="px-[14px] h-full flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></span>
            </div>
            <div id="dye-edit-shot-dropdown" class="dye-dash-dropdown">
              <div class="dye-dash-dropdown-item" id="dye-export-shot">Export Shot</div>
              <div class="dye-dash-dropdown-item dye-dash-dropdown-item-disabled" id="dye-view-profile" aria-disabled="true">View Text Profile</div>
              <div class="dye-dash-dropdown-item dye-dash-dropdown-item-danger" id="dye-delete-shot">Delete Shot</div>
            </div>
          </div>
          <div class="relative">
            <button id="dye-settings-btn" class="flex items-center gap-[10px] border-2 border-[var(--mimoja-blue)] text-[var(--mimoja-blue)] rounded-[23px] h-[54px] px-[20px] cursor-pointer">
              <span class="font-semibold text-[21px] whitespace-nowrap">DYE Settings</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <div id="dye-settings-dropdown" class="dye-dash-dropdown">
              <div class="dye-dash-dropdown-item" id="dye-settings-favourites">Favourites</div>
              <div class="dye-dash-dropdown-item" id="dye-settings-recipes">Recipes</div>
              <div class="dye-dash-dropdown-item" id="dye-settings-equipment">Equipment</div>
            </div>
          </div>
          <div class="relative">
            <button id="dye-visualizer-btn" class="flex items-center gap-[10px] border-2 border-[var(--mimoja-blue)] text-[var(--mimoja-blue)] rounded-[23px] h-[54px] px-[20px] cursor-pointer">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span class="font-semibold text-[21px] whitespace-nowrap">Visualizer</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <div id="dye-visualizer-dropdown" class="dye-dash-dropdown">
              <div class="dye-dash-dropdown-item" id="dye-visualizer-upload">Upload to Visualizer</div>
              <div class="dye-dash-dropdown-item" id="dye-visualizer-settings">Visualizer Settings</div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- RIGHT PANEL: Next Shot Planning -->
    <div class="flex flex-col flex-1 bg-[var(--bgmain-color)] overflow-hidden">
      <div class="flex flex-col gap-[22px] px-[38px] pt-[32px] pb-[40px] flex-1 overflow-hidden">

        <div class="flex items-center justify-between shrink-0 h-[90px]">
          <div class="flex flex-col gap-[8px]">
            <div class="text-[var(--mimoja-blue)] font-semibold text-[30px] leading-[1.2]">Next Shot Planning</div>
            <div id="dye-next-date" class="text-[var(--text-primary)] font-normal text-[24px] leading-[1.2]">—</div>
          </div>
          <div class="flex items-center gap-[27px]">
            <button id="dye-history-btn" class="cursor-pointer" title="Undo — reverts your last change here; tap again to redo it" aria-label="Undo last change">
              <img src="${iconHistory}" width="42" height="42" alt="History" />
            </button>
            <button id="dye-clipboard-btn" class="cursor-pointer">
              <img src="${iconClipboard}" width="42" height="42" alt="Clipboard" />
            </button>
          </div>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <div class="flex items-center gap-[18px] shrink-0">
          <button id="dye-recipe-prev" class="flex items-center justify-center shrink-0 cursor-pointer text-[var(--mimoja-blue)]">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div id="dye-recipe-pills" class="grid grid-flow-col grid-rows-[repeat(2,60px)] auto-cols-[225px] gap-[12px] flex-1 overflow-x-auto" style="scrollbar-width:none"></div>
          <button id="dye-recipe-next" class="flex items-center justify-center shrink-0 cursor-pointer text-[var(--mimoja-blue)]">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <div class="flex flex-col gap-[18px] shrink-0">
          <div id="dye-profile-name" class="text-[var(--mimoja-blue)] font-semibold text-[24px] leading-[1.2] text-center truncate cursor-pointer" title="Choose a profile">—</div>
          <div class="flex items-center gap-[18px]">
            <div class="flex items-center gap-[45px] flex-1 justify-center">
              <div class="flex items-center gap-[18px]">
                <span class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[75px]">Dose</span>
                <div class="flex items-center gap-[24px]">
                  <button id="dye-dose-minus" class="flex items-center justify-center w-[72px] h-[72px] bg-[var(--button-grey)] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <span id="dye-dose-value" class="font-bold text-[26px] text-[var(--text-primary)] w-[72px] text-center">—</span>
                  <button id="dye-dose-plus" class="flex items-center justify-center w-[72px] h-[72px] bg-[var(--button-grey)] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                </div>
              </div>
              <div class="flex items-center gap-[18px]">
                <span class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[75px]">Drink</span>
                <div class="flex items-center gap-[24px]">
                  <button id="dye-drink-minus" class="flex items-center justify-center w-[72px] h-[72px] bg-[var(--button-grey)] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <div class="flex flex-col items-center w-[72px]">
                    <span id="dye-drink-value" class="font-bold text-[26px] text-[var(--text-primary)] text-center">—</span>
                    <span id="dye-drink-ratio" class="font-semibold text-[18px] text-[var(--text-primary)] text-center"></span>
                  </div>
                  <button id="dye-drink-plus" class="flex items-center justify-center w-[72px] h-[72px] bg-[var(--button-grey)] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <div class="flex flex-col gap-[18px] shrink-0">
          <div id="dye-grinder-tabs" class="flex gap-[27px] overflow-x-auto"></div>
          <div class="flex items-center gap-[18px]">
            <!-- Same 45px gap as the Dose/Drink row above: both rows hold identical
                 label+stepper groups, so equal gaps make Grind line up under Dose and
                 RPM under Drink. -->
            <div class="flex items-center gap-[45px] flex-1 justify-center">
              <div class="flex items-center gap-[18px]">
                <span id="dye-grind-label" class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[75px] cursor-pointer">Grind</span>
                <div class="flex items-center gap-[24px]">
                  <button id="dye-grind-minus" class="flex items-center justify-center w-[72px] h-[72px] bg-[var(--button-grey)] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <span id="dye-grind-value" class="font-bold text-[26px] text-[var(--text-primary)] w-[72px] text-center">—</span>
                  <button id="dye-grind-plus" class="flex items-center justify-center w-[72px] h-[72px] bg-[var(--button-grey)] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                </div>
              </div>
              <div class="flex items-center gap-[18px]">
                <span class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[75px]">RPM</span>
                <div class="flex items-center gap-[24px]">
                  <button id="dye-rpm-minus" class="flex items-center justify-center w-[72px] h-[72px] bg-[var(--button-grey)] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <span id="dye-rpm-value" class="font-bold text-[26px] text-[var(--text-primary)] w-[72px] text-center">—</span>
                  <button id="dye-rpm-plus" class="flex items-center justify-center w-[72px] h-[72px] bg-[var(--button-grey)] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <div class="flex flex-col gap-[27px] shrink-0">
          <div id="dye-bean-card" class="flex flex-col gap-[8px] cursor-pointer">
            <div class="flex items-baseline gap-[15px]">
              <span class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[69px] shrink-0">Beans</span>
              <span id="dye-bean-name-display" class="font-semibold text-[24px] text-[var(--text-primary)] truncate">—</span>
            </div>
            <div id="dye-bean-roast-info" class="text-[var(--text-primary)] font-normal text-[24px] leading-[1.2]"></div>
          </div>
          <div id="dye-basket-field" class="flex items-baseline gap-[15px] cursor-pointer">
            <span class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[69px] shrink-0">Basket</span>
            <span id="dye-basket-name" class="font-semibold text-[24px] text-[var(--text-primary)] truncate">—</span>
          </div>
          <div class="flex items-center gap-[30px]">
            <div id="dye-barista-field" class="flex items-center gap-[12px] dye-name-combo cursor-pointer">
              <span class="font-bold text-[24px] text-[var(--mimoja-blue)]">Barista</span>
              <span id="dye-next-barista" class="font-normal text-[24px] text-[var(--text-primary)]">—</span>
              <input id="dye-next-barista-input" class="dye-name-input" style="display:none" autocomplete="off" />
              <div id="dye-next-barista-drop" class="dye-name-drop"></div>
            </div>
            <div id="dye-drinker-field" class="flex items-center gap-[12px] dye-name-combo cursor-pointer">
              <span class="font-bold text-[24px] text-[var(--mimoja-blue)]">Drinker</span>
              <span id="dye-next-drinker" class="font-normal text-[24px] text-[var(--text-primary)]">—</span>
              <input id="dye-next-drinker-input" class="dye-name-input" style="display:none" autocomplete="off" />
              <div id="dye-next-drinker-drop" class="dye-name-drop"></div>
            </div>
            <button id="dye-add-note-btn" class="border-2 border-[var(--mimoja-blue)] text-[var(--mimoja-blue)] rounded-[8px] px-[16px] py-[1px] leading-[1.2] font-semibold text-[24px] cursor-pointer whitespace-nowrap ml-auto">
              Add Note
            </button>
          </div>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <!-- mt-auto: nothing in this column can grow, so pin the actions to the bottom
             rather than leaving the leftover height as a void beneath them. -->
        <div class="flex items-center justify-between shrink-0 h-[70px] mt-auto">
          <button id="dye-clear-btn" class="border-2 border-[var(--mimoja-blue)] text-[var(--mimoja-blue)] rounded-[23px] px-[30px] h-[54px] font-semibold text-[21px] cursor-pointer">Clear</button>
          <div class="flex items-center gap-[12px]">
            <button id="dye-cancel-btn" class="flex items-center justify-center w-[240px] h-[62px] rounded-[68px] font-bold text-[24px] text-[var(--text-primary)] cursor-pointer">CANCEL</button>
            <button id="dye-done-btn" class="flex items-center justify-center w-[240px] h-[62px] bg-[var(--mimoja-blue)] text-white rounded-[68px] font-bold text-[24px] cursor-pointer">DONE</button>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>

<!-- Visualizer modal (login / settings) -->
<div id="viz-overlay" class="viz-overlay">
  <div class="viz-modal">
    <h2 id="viz-modal-title">Visualizer Login</h2>

    <!-- Logged-in state (shown when credentials already saved) -->
    <div id="viz-loggedin-section" style="display:none">
      <div class="viz-logged-in-row">
        Logged in as <span id="viz-loggedin-user" class="viz-logged-in-user">—</span>
      </div>
    </div>

    <!-- Login form -->
    <div id="viz-form-section">
      <div class="viz-field">
        <label for="viz-username">Username</label>
        <input id="viz-username" class="viz-input" type="text" placeholder="visualizer.coffee username" autocomplete="username" />
      </div>
      <div class="viz-field">
        <label for="viz-password">Password</label>
        <input id="viz-password" class="viz-input" type="password" placeholder="Password" autocomplete="current-password" />
      </div>
      <div class="viz-checkbox-row">
        <input id="viz-auto-upload" class="viz-checkbox" type="checkbox" checked />
        <label for="viz-auto-upload">Auto-upload shots to Visualizer</label>
      </div>
      <div class="viz-checkbox-row">
        <label for="viz-min-duration">Minimum shot duration (s):</label>
        <input id="viz-min-duration" class="viz-input" type="number" min="1" value="5" style="width:100px;height:48px;font-size:20px" />
      </div>
    </div>

    <div id="viz-status" class="viz-status"></div>

    <div class="viz-footer">
      <button id="viz-cancel-btn" class="viz-btn-cancel">Cancel</button>
      <button id="viz-logout-btn" class="viz-btn-cancel" style="display:none;color:#E53935">Log Out</button>
      <button id="viz-save-btn" class="viz-btn-save">Save &amp; Login</button>
    </div>
  </div>
</div>

<!-- Read Note modal (read-only) -->
<div id="dye-note-overlay" class="viz-overlay">
  <div class="viz-modal">
    <h2>Shot Note</h2>
    <div id="dye-note-body" style="font-size:22px;line-height:1.5;color:var(--text-primary);white-space:pre-wrap;max-height:50vh;overflow-y:auto;margin-bottom:28px;">—</div>
    <div class="viz-footer">
      <button id="dye-note-close" class="viz-btn-cancel">Close</button>
    </div>
  </div>
</div>

<!-- Add Note modal (editable, for the next shot) -->
<div id="dye-add-note-overlay" class="viz-overlay">
  <div class="viz-modal">
    <h2>Note for Next Shot</h2>
    <textarea id="dye-add-note-input" class="viz-input" style="height:160px;padding:14px 18px;resize:vertical;"></textarea>
    <div class="viz-footer" style="margin-top:22px;">
      <button id="dye-add-note-cancel" class="viz-btn-cancel">Cancel</button>
      <button id="dye-add-note-save" class="viz-btn-save">Save</button>
    </div>
  </div>
</div>
`; }

const pageScript = `
${enjoymentScaleScript}
${recordedShotScript}
${shotWeightsScript}
let grinders = [];
let profiles = [];
let recipes = [];
let autoFavs = [];   // auto: true entries from autoFavourites — recent shot combos, see recent-favs.ts
let currentWorkflow = null;
let baseWorkflow = null;   // the Workflow as last read / successfully sent (dye2#31)
let currentStarRating = 0;
let currentShotNote = '';
let vizLoggedIn = false;
let vizUsername = '';
let lastEditSnapshot = null;
// What this visit applied to the Workflow, reported to Streamline on the way
// back so its strip can highlight (and auto-save to) the right item:
// '' nothing, 'recipe:<id>' / 'favourite:<id>', or 'other' for an item with no
// stable id (a recent shot combination).
let lastApplied = '';
function noteApplied(kind, item) {
  const id = item && item.id;
  lastApplied = (id != null && String(id).indexOf('recent:') !== 0) ? kind + ':' + id : 'other';
}
// The recipe being dialled in rides in the workflow itself (extras.dye.recipeId, dye2#36): set
// by a recipe apply, null for anything else that replaces the profile. The plugin runtime
// derives the selection from it; there is no separate POST. A tile edit leaves it alone.
function setRecipeId(ctx, id) {
  const ex = ctx.extras || {};
  ctx.extras = { ...ex, dye: { ...(ex.dye || {}), v: 1, recipeId: id == null ? null : String(id) } };
}

// The subset of "cur" that differs from "base", recursing into plain objects: the body for a
// PUT that changes only what this page changed, so a change another app made since the page
// opened is left alone (dye2#31; PUT /workflow deep-merges key by key). An undefined value is
// omitted, as JSON.stringify would drop it anyway; an explicit null IS a change and is kept.
function workflowPatch(base, cur) {
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const out = {};
  for (const k of Object.keys(cur || {})) {
    const b = (base || {})[k], c = cur[k];
    if (c === undefined) continue;
    if (obj(b) && obj(c)) {
      const sub = workflowPatch(b, c);
      if (Object.keys(sub).length) out[k] = sub;
    } else if (JSON.stringify(b) !== JSON.stringify(c)) {
      out[k] = c;
    }
  }
  return out;
}

// Send this page's own edits. baseWorkflow advances only on a successful PUT, so a failed send
// is carried into the next one, and the history button can still undo a change already sent.
function pushWorkflow() {
  if (!currentWorkflow) return Promise.resolve(null);
  const patch = workflowPatch(baseWorkflow, currentWorkflow);
  if (!Object.keys(patch).length) return Promise.resolve(null);
  const sent = JSON.parse(JSON.stringify(currentWorkflow));
  return updateWorkflow(patch).then(r => { baseWorkflow = sent; setTimeout(refreshDerivedSelection, 700); return r; });
}

// The plugin's derived selection ({kind, id, modified}), which the pills mark. A recipe with no
// strip slot has no cell on the Streamline strip, so this is the only place it is visible.
let derivedSel = null;
let derivedSelKey = '';
function refreshDerivedSelection() {
  fetch('/api/v1/plugins/dye2.reaplugin/selection').then(r => (r.ok ? r.json() : null)).then(s => {
    const key = s && s.kind ? s.kind + ':' + s.id + ':' + s.modified : '';
    if (key === derivedSelKey) return;
    derivedSelKey = key;
    derivedSel = s && s.kind ? s : null;
    if (currentWorkflow) renderRecipePills(currentWorkflow);
  }).catch(() => {});
}

// A "Save changes" on the Streamline strip patches the recipe through the plugin's \`record\`
// route, which writes KV and never the workflow — so nothing on this page would notice, and the
// pill's \` *\` would stay on a recipe that now matches. The plugin emits {what:'workflow'} on its
// own \`changed\` socket after that write (docs/KV_CONTRACT.md, "Freshness"), so listen for it.
// Visibility/focus are belt-and-braces: the skin can host this page in an iframe that never
// loses visibility, so the socket is the signal that actually fires there.
function subscribeChanged() {
  let sock = null, retry = null;
  const open = () => {
    if (sock || document.hidden) return;
    try {
      sock = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host +
        '/api/v1/plugins/dye2.reaplugin/changed');
    } catch (e) { return; }
    sock.addEventListener('message', () => refreshDerivedSelection());
    const dead = () => {
      sock = null;
      // Reconnect once a minute at most: the refreshes below cover a dropped socket.
      if (!retry) retry = setTimeout(() => { retry = null; open(); }, 60000);
    };
    sock.addEventListener('close', dead);
    sock.addEventListener('error', dead);
  };
  open();
  const wake = () => { if (!document.hidden) { open(); refreshDerivedSelection(); } };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('focus', wake);
  window.addEventListener('pageshow', wake);
}

// Re-read before applying an item, so the apply lands on what the machine holds now rather
// than on what this page read when it opened — otherwise a recipe whose values match the
// page-open copy diffs to nothing and is never actually applied. Skipped while this page has
// an edit it has not sent yet (the Clear button's nulls), which a re-read would drop.
async function refreshWorkflow() {
  if (!currentWorkflow || Object.keys(workflowPatch(baseWorkflow, currentWorkflow)).length) return;
  const live = await getWorkflow().catch(() => null);
  if (!live) return;
  currentWorkflow = live;
  baseWorkflow = JSON.parse(JSON.stringify(live));
}

// One-level undo for Next Shot Planning: every edit first saves the state it is
// replacing, and the history button swaps back to it (press again to re-apply).
// ponytail: single snapshot, not a stack — add an array if multi-step undo is wanted.
function snapshotWorkflow() {
  if (!currentWorkflow) return;
  lastEditSnapshot = JSON.stringify({ context: currentWorkflow.context || {}, profile: currentWorkflow.profile || null });
  const btn = document.getElementById('dye-history-btn');
  if (btn) btn.style.opacity = '';
}

// Open Select Recipe with the recipe being dialled in (extras.dye.recipeId) preselected; the
// page ignores an id that names no row.
async function openRecipes() {
  const live = await getWorkflow().catch(() => null);
  const rid = (((live || {}).context || {}).extras || {}).dye?.recipeId;
  if (rid) sessionStorage.setItem('dye_editRecipeId', String(rid)); else sessionStorage.removeItem('dye_editRecipeId');
  window.location.href = '/api/v1/plugins/dye2.reaplugin/select-recipe';
}

function setupHistoryRevert() {
  const btn = document.getElementById('dye-history-btn');
  if (!btn) return;
  btn.style.opacity = lastEditSnapshot ? '' : '0.4';
  btn.addEventListener('click', () => {
    if (!lastEditSnapshot || !currentWorkflow) return;
    const prev = JSON.parse(lastEditSnapshot);
    snapshotWorkflow(); // current state becomes the new snapshot, so history toggles
    currentWorkflow.context = prev.context;
    if (prev.profile) currentWorkflow.profile = prev.profile;
    renderNextShot();
    pushWorkflow().catch(e => console.warn(e));
  });
}

function updateVisualizerButtonState() {
  const btn = document.getElementById('dye-visualizer-btn');
  if (!btn) return;
  if (vizLoggedIn) btn.classList.add('viz-connected');
  else btn.classList.remove('viz-connected');
}

async function checkVisualizerLoggedIn() {
  try {
    const settings = await getVisualizerSettings();
    vizLoggedIn = !!(settings && settings.Username);
    vizUsername = (settings && settings.Username) || '';
  } catch (e) {
    vizLoggedIn = false;
    vizUsername = '';
  }
  updateVisualizerButtonState();
}

function openVisualizerModal() {
  const overlay = document.getElementById('viz-overlay');
  const loggedinSection = document.getElementById('viz-loggedin-section');
  const loggedinUser = document.getElementById('viz-loggedin-user');
  const formSection = document.getElementById('viz-form-section');
  const logoutBtn = document.getElementById('viz-logout-btn');
  const saveBtn = document.getElementById('viz-save-btn');
  const titleEl = document.getElementById('viz-modal-title');
  const statusEl = document.getElementById('viz-status');
  const usernameInput = document.getElementById('viz-username');
  const passwordInput = document.getElementById('viz-password');

  if (!overlay) return;
  if (statusEl) { statusEl.textContent = ''; statusEl.className = 'viz-status'; }

  if (vizLoggedIn) {
    if (titleEl) titleEl.textContent = 'Visualizer Settings';
    if (loggedinSection) { loggedinSection.style.display = 'flex'; if (loggedinUser) loggedinUser.textContent = vizUsername; }
    if (usernameInput) usernameInput.value = vizUsername;
    if (passwordInput) passwordInput.value = '';
    if (logoutBtn) logoutBtn.style.display = '';
    if (saveBtn) saveBtn.textContent = 'Save Settings';
  } else {
    if (titleEl) titleEl.textContent = 'Visualizer Login';
    if (loggedinSection) loggedinSection.style.display = 'none';
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (saveBtn) { saveBtn.textContent = 'Save & Login'; saveBtn.disabled = false; }
  }

  overlay.classList.add('open');
}

function setupVisualizerModal() {
  const overlay = document.getElementById('viz-overlay');
  const cancelBtn = document.getElementById('viz-cancel-btn');
  const logoutBtn = document.getElementById('viz-logout-btn');
  const saveBtn = document.getElementById('viz-save-btn');

  if (cancelBtn) cancelBtn.addEventListener('click', () => { if (overlay) overlay.classList.remove('open'); });

  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    const statusEl = document.getElementById('viz-status');
    try {
      await saveVisualizerSettings('', '', false, 5);
      vizLoggedIn = false;
      vizUsername = '';
      updateVisualizerButtonState();
      if (overlay) overlay.classList.remove('open');
    } catch (e) {
      if (statusEl) { statusEl.textContent = 'Logout failed: ' + e.message; statusEl.className = 'viz-status error'; }
    }
  });

  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const statusEl = document.getElementById('viz-status');
    const usernameInput = document.getElementById('viz-username');
    const passwordInput = document.getElementById('viz-password');
    const autoUploadInput = document.getElementById('viz-auto-upload');
    const minDurationInput = document.getElementById('viz-min-duration');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const autoUpload = autoUploadInput ? autoUploadInput.checked : false;
    const minDuration = minDurationInput ? (parseInt(minDurationInput.value) || 5) : 5;

    if (!username || !password) {
      if (statusEl) { statusEl.textContent = 'Username and password required.'; statusEl.className = 'viz-status error'; }
      return;
    }
    saveBtn.disabled = true;
    if (statusEl) { statusEl.textContent = 'Verifying credentials…'; statusEl.className = 'viz-status'; }

    try {
      const valid = await verifyVisualizerCredentials(username, password);
      if (!valid) {
        if (statusEl) { statusEl.textContent = 'Invalid username or password.'; statusEl.className = 'viz-status error'; }
        saveBtn.disabled = false;
        return;
      }
      await saveVisualizerSettings(username, password, autoUpload, minDuration);
      vizLoggedIn = true;
      vizUsername = username;
      updateVisualizerButtonState();
      if (statusEl) { statusEl.textContent = 'Saved!'; statusEl.className = 'viz-status success'; }
      setTimeout(() => { if (overlay) overlay.classList.remove('open'); }, 800);
    } catch (e) {
      if (statusEl) { statusEl.textContent = 'Error: ' + e.message; statusEl.className = 'viz-status error'; }
      saveBtn.disabled = false;
    }
  });
}

function setupVisualizerDropdown() {
  const btn = document.getElementById('dye-visualizer-btn');
  const dropdown = document.getElementById('dye-visualizer-dropdown');
  const uploadItem = document.getElementById('dye-visualizer-upload');
  const settingsItem = document.getElementById('dye-visualizer-settings');

  if (!btn || !dropdown) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    document.querySelectorAll('.dye-dash-dropdown').forEach(dd => { if (dd !== dropdown) dd.classList.remove('open'); });
  });

  if (uploadItem) uploadItem.addEventListener('click', async () => {
    dropdown.classList.remove('open');
    if (!vizLoggedIn) { openVisualizerModal(); return; }
    const shot = shots[currentShotIndex];
    if (!shot) return;
    const uploadItem2 = document.getElementById('dye-visualizer-upload');
    if (uploadItem2) uploadItem2.textContent = 'Uploading…';
    try {
      await uploadShotToVisualizer(shot.id);
      if (uploadItem2) uploadItem2.textContent = 'Uploaded!';
      setTimeout(() => { if (uploadItem2) uploadItem2.textContent = 'Upload to Visualizer'; }, 2000);
    } catch (e) {
      if (uploadItem2) uploadItem2.textContent = 'Upload failed';
      setTimeout(() => { if (uploadItem2) uploadItem2.textContent = 'Upload to Visualizer'; }, 2000);
    }
  });

  if (settingsItem) settingsItem.addEventListener('click', () => {
    dropdown.classList.remove('open');
    openVisualizerModal();
  });
}

function formatShotDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  let label = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : diffDays + ' days ago';
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return { label, full: dateStr + ', ' + timeStr };
}

function formatCurrentDate() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return dateStr + ', ' + timeStr;
}

function calcRatio(doseIn, doseOut) {
  if (!doseIn || doseIn === 0) return '—';
  return '1:' + (doseOut / doseIn).toFixed(1);
}

// While the search box is open it covers the "Last Shot … (2/4)" heading, so this is the
// only place the position shows — without it, stepping through matches is blind.
function updateSearchCount() {
  const countEl = document.getElementById('dye-search-count');
  if (!countEl) return;
  if (!shotFilter || !shotFilter.search) { countEl.textContent = ''; return; }
  countEl.textContent = shotsTotal
    ? (currentShotIndex + 1) + ' of ' + shotsTotal + (shotsTotal === 1 ? ' match' : ' matches')
    : 'No matches';
}

// Drink / Time / Ratio line. Runs once from the list row and again when the measurements land.
function renderShotStats(shot) {
  const statsEl = document.getElementById('dye-shot-stats');
  // Prefers the saved actual dose/yield (what edit-shot shows) over the last scale sample.
  const measurements = shot.measurements || [];
  const { doseIn: doseInRaw, doseOut: doseOutRaw } = shotWeights(shot);

  const doseIn = doseInRaw != null ? doseInRaw + 'g' : '—';
  const doseOut = doseOutRaw != null ? doseOutRaw.toFixed(1) + 'g' : '—';
  const ratio = (doseInRaw && doseOutRaw) ? calcRatio(doseInRaw, doseOutRaw) : '—';

  let shotTimeStr = '—';
  if (measurements.length > 0) {
    let start = null, end = null;
    for (const dp of measurements) {
      const m = dp.machine;
      if (m && m.state && (m.state.substate === 'preinfusion' || m.state.substate === 'pouring')) {
        if (!start) start = new Date(m.timestamp);
        end = new Date(m.timestamp);
      }
    }
    if (start && end) shotTimeStr = Math.round((end - start) / 1000) + 's';
  }

  if (statsEl) {
    const ann = shot.annotations || {};
    const tds = ann.drinkTds != null ? ann.drinkTds + '%' : null;
    const ey  = ann.drinkEy  != null ? ann.drinkEy  + '%' : null;
    let statsHtml = 'Drink <strong>' + doseIn + ':' + doseOut + '</strong> &nbsp; Time <strong>' + shotTimeStr + '</strong> &nbsp; Ratio <strong>' + ratio + '</strong>';
    if (tds || ey) {
      statsHtml += ' &nbsp;&bull;&nbsp; ';
      if (tds) statsHtml += 'TDS <strong>' + tds + '</strong>';
      if (tds && ey) statsHtml += ' &nbsp; ';
      if (ey) statsHtml += 'EY <strong>' + ey + '</strong>';
    }
    statsEl.innerHTML = statsHtml;
  }
}

// Bumped on every render so a slow measurements fetch cannot stamp a shot the user has since left.
let shotRenderToken = 0;
// +1 while stepping to older shots, -1 to newer, 0 before the user has moved. Used only to
// prefetch the shot they are heading towards, so the next tap has its chart already.
let shotStepDir = 0;

// Search popup: free text plus Bean / Roaster / Grinder / Profile. field -> the picked
// {id, label, param} option, or absent/null when that field is clear. Prefixed dsf*, not
// shotFilter*: shot-paging.ts's own top-level shotFilter already owns that name in this
// shared scope.
let dsfSearchText = '';
let dsfSelection = {};
let dsfBeansCache = null;   // getBeans(), shared by the bean and roaster fields
let dsfFieldHandles = {};   // field -> {clear()} from setupFilterCombo

// Warm the next shot in the direction of travel. Fire and forget: it only fills in
// measurements, never touches the DOM, and merges by id so a shifting window is harmless.
// One shot ahead only -- each costs the bridge a blob decode, so this is not a crawl.
function prefetchNeighbourShot(idx) {
  if (!shotStepDir) return;
  const next = shots[idx + shotStepDir];
  if (!next || next.measurements || next.__prefetching) return;
  next.__prefetching = true;
  getShot(next.id).then(function (full) {
    const at = shots.findIndex(s => s && s.id === next.id);
    if (at >= 0 && !shots[at].measurements) {
      shots[at] = Object.assign({}, shots[at], { measurements: full.measurements });
    }
  }).catch(function () { next.__prefetching = false; });
}

async function renderLastShot() {
  const renderToken = ++shotRenderToken;
  updateSearchCount();
  const idx = currentShotIndex;
  const shot = shots[idx];
  const labelEl = document.getElementById('dye-last-shot-label');
  const dateEl = document.getElementById('dye-last-shot-date');
  const profileEl = document.getElementById('dye-shot-profile');
  const statsEl = document.getElementById('dye-shot-stats');
  const beansEl = document.getElementById('dye-shot-beans');
  const grinderEl = document.getElementById('dye-shot-grinder');
  const baristaEl = document.getElementById('dye-shot-barista');

  if (!shot) {
    if (labelEl) labelEl.textContent = 'Last Shot: —';
    if (dateEl) dateEl.textContent = shotFilter ? 'No matching shots' : 'No shots recorded';
    chartShowPlaceholder(document.getElementById('plotly-chart'), 'No shot data');
    if (profileEl) profileEl.textContent = '—';
    if (statsEl) statsEl.textContent = '—';
    if (beansEl) beansEl.textContent = '—';
    if (grinderEl) grinderEl.textContent = '—';
    if (baristaEl) baristaEl.textContent = '—';
    currentShotNote = '';
    return;
  }

  const { label, full } = formatShotDate(shot.timestamp);
  // Show position so a single-shot filtered/"Same Beans" view is obviously why prev/next
  // don't move, and so a filter that narrows to exactly one match (a real, working filter)
  // doesn't look indistinguishable from an unfiltered single-shot history.
  const pos = shotsTotal > 0 ? ' (' + (currentShotIndex + 1) + '/' + shotsTotal + ')' : '';
  if (labelEl) labelEl.textContent = 'Last Shot: ' + label + pos;
  if (dateEl) dateEl.textContent = full;

  const wf = shot.workflow || {};
  const ctx = wf.context || {};
  const grinderData = wf.grinderData || {};
  const profile = wf.profile || {};

  if (profileEl) profileEl.textContent = profile.title || '—';

  renderShotStats(shot);

  const roaster = ctx.coffeeRoaster || '';
  const coffeeName = ctx.coffeeName || '';
  if (beansEl) {
    if (roaster || coffeeName) beansEl.innerHTML = roaster ? '<strong>' + roaster + '</strong> &bull; ' + coffeeName : coffeeName;
    else beansEl.textContent = '—';
  }

  const grinderModel = ctx.grinderModel || grinderData.model || grinderData.name || '—';
  const grindSetting = ctx.grinderSetting != null ? ctx.grinderSetting : (grinderData.setting !== undefined ? grinderData.setting : '—');
  // An RPM edited on the edit-shot page (annotations.extras) wins over the one set here
  // before the shot (the shot's workflow.context.extras).
  const grindRpm = shotBasketRpm(shot).rpm;
  if (grinderEl) {
    let grinderHtml = 'Grinder <strong>' + grinderModel + '</strong> &bull; Setting <strong>' + grindSetting + '</strong>';
    if (grindRpm != null) grinderHtml += ' &bull; RPM <strong>' + grindRpm + '</strong>';
    grinderEl.innerHTML = grinderHtml;
  }

  const barista = ctx.baristaName || ctx.barista || '';
  const drinker = ctx.drinkerName || ctx.drinker || '';
  if (baristaEl) {
    let html = '';
    if (barista) html += 'Barista <strong>' + barista + '</strong>';
    if (barista && drinker) html += ' &nbsp; ';
    if (drinker) html += 'Drinker <strong>' + drinker + '</strong>';
    if (!barista && !drinker) html = '—';
    baristaEl.innerHTML = html;
  }

  const rating = enjoymentToStars(shot.annotations && shot.annotations.enjoyment);
  currentStarRating = rating;
  updateStarDisplay(rating);

  // Read Note shows the same note as Edit Shot (recorded-shot.ts).
  currentShotNote = shotNote(shot);
  const noteBtn = document.getElementById('dye-read-note-btn');
  if (noteBtn) noteBtn.style.opacity = currentShotNote.trim() ? '' : '0.4';

  // Measurements only feed the chart and the Time figure, so fetch them after the text is up.
  if (!shot.measurements) {
    // The text above is already the new shot's, so drop the previous shot's trace rather than
    // leave it sitting under it for the length of the fetch (prev/next). chartShowPlaceholder
    // disposes the chart instance and plotHistoricalShot clears the placeholder before it replots.
    // Only show the placeholder if the fetch is actually slow. Clearing the chart instantly
    // means every step flashes "Loading...", and a chart that is one tap stale for 150ms reads
    // better than one that blinks on every tap. Cancelled the moment the data lands.
    const slowChart = setTimeout(function () {
      if (renderToken === shotRenderToken) {
        chartShowPlaceholder(document.getElementById('plotly-chart'), 'Loading...');
      }
    }, 150);
    getShot(shot.id).then(function (fullShot) {
      clearTimeout(slowChart);
      if (renderToken !== shotRenderToken) return;
      // By id, not the captured index: ensureShotsPage can swap the array underneath while the
      // displayed shot stays the same, in which case nothing re-renders and the token is still
      // current. Writing shots[idx] then overwrites whichever shot now sits at that index.
      const at = shots.findIndex(s => s && s.id === shot.id);
      if (at < 0) return;
      shots[at] = { ...shot, ...fullShot };
      const merged = shots[at];
      renderShotStats(merged);
      if (merged.measurements && merged.measurements.length > 0) {
        plotHistoricalShot(merged.measurements, merged.workflow);
      }
      prefetchNeighbourShot(at);
    }).catch(function (e) { clearTimeout(slowChart); console.warn('Could not fetch full shot data:', e); });
  } else if (shot.measurements.length > 0) {
    plotHistoricalShot(shot.measurements, shot.workflow);
    prefetchNeighbourShot(idx);
  }
}

// Scoped to the Last Shot rating widget's own container: the search popup has a second,
// unrelated row of stars (the rating filter) that must not be swept up by a bare
// document-wide '.dye-star' query, or picking a filter threshold would also save a rating
// onto whatever shot happens to be on screen.
function updateStarDisplay(rating) {
  document.querySelectorAll('#dye-star-rating .dye-star').forEach(star => {
    const idx = parseInt(star.getAttribute('data-index'));
    if (idx <= rating) { star.setAttribute('fill', 'var(--mimoja-blue)'); star.setAttribute('stroke', 'var(--mimoja-blue)'); }
    else { star.setAttribute('fill', 'none'); star.setAttribute('stroke', 'var(--profile-button-outline-color)'); }
  });
}

function setupStarRating() {
  document.querySelectorAll('#dye-star-rating .dye-star').forEach(star => {
    star.addEventListener('click', async () => {
      const idx = parseInt(star.getAttribute('data-index'));
      currentStarRating = idx;
      updateStarDisplay(idx);
      const shot = shots[currentShotIndex];
      if (shot) {
        try { const ann = { ...(shot.annotations || {}), enjoyment: starsToEnjoyment(idx) }; await updateShot(shot.id, { annotations: ann }); shot.annotations = ann; }
        catch (e) { console.warn('Could not save star rating:', e); }
      }
    });
  });
}

// Free text and the picker fields below all compose into one bridge query (the handler ANDs
// every GET /api/v1/shots param, search included), so typing a name and picking a grinder
// together narrows further rather than one replacing the other. Same Beans stays a separate
// one-tap shortcut outside the popup -- see setupShotNavigation -- and still resets this.
function closeShotSearchPopup() {
  const popup = document.getElementById('dye-search-popup');
  if (popup) popup.classList.add('hidden');
}

function setupShotSearch() {
  const btn = document.getElementById('dye-search-btn');
  const popup = document.getElementById('dye-search-popup');
  const input = document.getElementById('dye-search-input');
  const xBtn = document.getElementById('dye-search-input-x');
  if (!btn || !popup || !input) return;
  let timer = null;

  btn.addEventListener('click', () => {
    popup.classList.toggle('hidden');
    if (!popup.classList.contains('hidden')) input.focus();
  });

  input.addEventListener('input', () => {
    if (xBtn) xBtn.classList.toggle('hidden', !input.value);
    clearTimeout(timer);
    timer = setTimeout(() => {
      dsfSearchText = input.value.trim();
      applyShotFilters().catch(e => console.warn(e));
    }, 350);
  });

  // Clears just the free text, independent of the popup's own "Clear filters" (everything).
  if (xBtn) xBtn.addEventListener('click', () => {
    clearTimeout(timer);
    input.value = '';
    xBtn.classList.add('hidden');
    dsfSearchText = '';
    applyShotFilters().catch(e => console.warn(e));
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(timer);
      dsfSearchText = input.value.trim();
      applyShotFilters().catch(e => console.warn(e));
    }
    if (e.key === 'Escape') { clearTimeout(timer); closeShotSearchPopup(); }
  });
}

function setupShotNavigation() {
  const prevBtn = document.getElementById('dye-prev-shot-btn');
  const nextBtn = document.getElementById('dye-next-shot-btn');
  const sameBeansBtn = document.getElementById('dye-same-beans-btn');

  // Wrap around so the ends are never dead: prev past oldest → newest, next past newest → oldest.
  if (prevBtn) prevBtn.addEventListener('click', async () => {
    shotStepDir = 1;
    if (await stepToOlderShot()) renderLastShot().catch(e => console.warn(e));
  });

  if (nextBtn) nextBtn.addEventListener('click', async () => {
    shotStepDir = -1;
    await ensureShotsPage();   // the seed alone is one shot, so wrapping would be a no-op
    if (shots.length < 2) return;
    currentShotIndex = (currentShotIndex - 1 + shots.length) % shots.length;
    renderLastShot().catch(e => console.warn(e));
  });

  if (sameBeansBtn) sameBeansBtn.addEventListener('click', async () => {
    closeShotSearchPopup();
    clearShotFilters(false);
    const shot = shots[currentShotIndex];
    const ctx = (shot && shot.workflow && shot.workflow.context) || {};
    // Can't filter "same beans" if the current shot has no bean — stay in All Shots.
    sameBeanFilter = !sameBeanFilter && !!ctx.coffeeName;
    // Label shows the CURRENT state being viewed, not the action.
    if (sameBeanFilter) {
      // Roaster too: the same coffee name from two roasters is two different coffees.
      const filter = { coffeeName: ctx.coffeeName };
      if (ctx.coffeeRoaster) filter.coffeeRoaster = ctx.coffeeRoaster;
      await loadShots(filter);
      sameBeansBtn.querySelector('span').textContent = 'Same Beans';
    } else {
      await loadShots(null);
      sameBeansBtn.querySelector('span').textContent = 'All Shots';
    }
    renderLastShot().catch(e => console.warn(e));
  });
}

// Pick-only combobox for the shot filter drawer: readonly input (tap to browse the full
// list, same reasoning as the Barista/Drinker fields' readonly -- no keyboard needed to pick
// something that already exists), mousedown-select so the pick lands before blur closes the
// drop (see AI_UI_NOTES.md's combo pattern). Returns a handle to reset the field from outside.
function setupFilterCombo(inputId, dropId, loadOptions, onPick, onClear) {
  const input = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  const xBtn = document.getElementById(inputId.replace(/-input$/, '-x'));
  if (!input || !drop) return { clear() {} };
  let cache = null;

  function setValue(value) {
    input.value = value;
    if (xBtn) xBtn.classList.toggle('hidden', !value);
  }

  async function openDrop() {
    if (!cache) { try { cache = await loadOptions(); } catch (e) { console.warn('filter options failed for', inputId, e); cache = []; } }
    drop.innerHTML = '';
    if (!cache.length) {
      drop.insertAdjacentHTML('beforeend', '<div class="dye-name-empty">No matches</div>');
    } else {
      cache.slice(0, 50).forEach(opt => {
        const row = document.createElement('div');
        row.className = 'dye-name-opt';
        row.textContent = opt.label;
        row.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          setValue(opt.label);
          drop.classList.remove('open');
          onPick(opt);
        });
        drop.appendChild(row);
      });
    }
    drop.classList.add('open');
  }

  // click as well as focus: once a pick lands, mousedown's preventDefault (needed so the
  // pick registers before blur tears the drop down) keeps the input focused, so a second tap
  // on an already-focused field fires no new focus event and would otherwise never reopen
  // the drop -- the same reason dashboard.ts's own Barista/Drinker field and auto-fav-edit's
  // combo both wire their open trigger to click rather than relying on focus alone.
  input.addEventListener('focus', openDrop);
  input.addEventListener('click', openDrop);
  input.addEventListener('blur', () => setTimeout(() => drop.classList.remove('open'), 150));
  // Clears just this field, independent of the popup's own "Clear filters" (everything).
  if (xBtn) xBtn.addEventListener('click', () => {
    setValue('');
    drop.classList.remove('open');
    if (onClear) onClear();
  });

  return {
    clear() { setValue(''); drop.classList.remove('open'); },
    invalidate() { cache = null; },
  };
}

async function dsfBeanRecords() {
  if (!dsfBeansCache) dsfBeansCache = await getBeans().catch(() => []);
  return Array.isArray(dsfBeansCache) ? dsfBeansCache : (dsfBeansCache.items || []);
}

// Same shape as dsfBuildFilter, minus one field -- so that field's own dropdown (and the
// facet lookup below) sees what the *other* active picks allow, not its own current value.
function dsfBuildFilterExcluding(excludeField) {
  const f = {};
  if (dsfSearchText) f.search = dsfSearchText;
  DSF_FIELDS.forEach(([field]) => {
    if (field === excludeField || !dsfSelection[field]) return;
    Object.assign(f, dsfSelection[field].param);
  });
  return f;
}

// null while no other filter is active -- the four option lists below then stay the full
// library, same as before this existed. Once something else is picked, this is what makes
// them shrink to combinations shots actually have. Capped at the bridge's own limit clamp
// (shots_handler.dart: limit.clamp(1, 100)) rather than paged to the real total -- a dropdown
// doesn't need to be exact past a hundred matches.
async function dsfMatchingFacets(excludeField) {
  const filter = dsfBuildFilterExcluding(excludeField);
  if (!Object.keys(filter).length) return null;
  const opts = Object.assign({ limit: 100, order: 'desc' }, filter);
  const res = await getShots(opts).catch(() => null);
  const items = (res && res.items) ? res.items : (Array.isArray(res) ? res : []);
  return items.map(s => {
    const ctx = (s && s.workflow && s.workflow.context) || {};
    const profile = (s && s.workflow && s.workflow.profile) || {};
    return { coffeeName: ctx.coffeeName, coffeeRoaster: ctx.coffeeRoaster, grinderId: ctx.grinderId, profileTitle: profile.title };
  });
}

// Filtering by beanId (not coffeeName) matches every batch ever linked to the bean, archived
// included, so a later bean rename doesn't quietly break the filter -- same reasoning the
// bridge docs give for beanId over coffeeName (rea_restapi.yml /api/v1/shots).
async function dsfBeanOptions() {
  const beans = await dsfBeanRecords();
  const facets = await dsfMatchingFacets('bean');
  const seen = facets && new Set(facets.map(f => (f.coffeeRoaster || '') + '\u0000' + (f.coffeeName || '')));
  return beans.filter(b => b && (b.name || b.roaster))
    .filter(b => !seen || seen.has((b.roaster || '') + '\u0000' + (b.name || '')))
    .map(b => ({
      label: [b.roaster, b.name].filter(Boolean).join(' ') || b.name || b.roaster,
      param: { beanId: b.id },
    }));
}

// No roaster entity exists (it's a plain string on Bean -- see pages/roasters.ts, which
// derives its own list the same way), so this can only filter by the coffeeRoaster string.
async function dsfRoasterOptions() {
  const beans = await dsfBeanRecords();
  const facets = await dsfMatchingFacets('roaster');
  const seen = facets && new Set(facets.map(f => f.coffeeRoaster).filter(Boolean));
  const roasters = new Set();
  beans.forEach(b => { if (b && b.roaster && (!seen || seen.has(b.roaster))) roasters.add(b.roaster); });
  return [...roasters].map(r => ({ label: r, param: { coffeeRoaster: r } }));
}

async function dsfGrinderOptions() {
  const facets = await dsfMatchingFacets('grinder');
  const seen = facets && new Set(facets.map(f => f.grinderId).filter(Boolean));
  return (grinders || []).filter(g => g && (g.model || g.name))
    .filter(g => !seen || seen.has(g.id))
    .map(g => ({ label: g.model || g.name, param: { grinderId: g.id } }));
}

// profiles is resolveFullProfile's own lazy cache (pages/dashboard.ts) -- reused here rather
// than a second one, since both just want the library list and either caller can fill it
// first. GET /api/v1/shots only filters profiles by title (no id), so that's what ships.
async function dsfProfileOptions() {
  if (!profiles.length) {
    try {
      const fresh = await getProfiles({ includeHidden: true });
      profiles = Array.isArray(fresh) ? fresh : (fresh && fresh.items ? fresh.items : []);
    } catch (e) { console.warn('Failed to load profiles for the shot filter:', e); }
  }
  const facets = await dsfMatchingFacets('profile');
  const seen = facets && new Set(facets.map(f => f.profileTitle).filter(Boolean));
  return profiles.map(p => {
    const title = p && ((p.profile && p.profile.title) || p.title || p.name);
    return title && (!seen || seen.has(title)) ? { label: title, param: { profileTitle: title } } : null;
  }).filter(Boolean);
}

// 'rating' has no loadOptions -- it's wired by setupShotRatingFilter below, not
// setupFilterCombo, but still rides the same dsfSelection/dsfFieldHandles slots so
// dsfBuildFilter/updateShotFilterBadge/clearShotFilters pick it up for free.
const DSF_FIELDS = [
  ['bean', dsfBeanOptions],
  ['roaster', dsfRoasterOptions],
  ['grinder', dsfGrinderOptions],
  ['profile', dsfProfileOptions],
  ['rating', null],
];

// Pure on purpose (searchText passed in, not read off dsfSearchText) -- see
// test/dashboard-shot-filter.test.mjs, which extracts and runs this function on its own.
function dsfBuildFilter(searchText) {
  const f = {};
  if (searchText) f.search = searchText;
  DSF_FIELDS.forEach(([field]) => { if (dsfSelection[field]) Object.assign(f, dsfSelection[field].param); });
  return Object.keys(f).length ? f : null;
}

function updateShotFilterBadge() {
  const active = !!dsfSearchText || DSF_FIELDS.some(([field]) => dsfSelection[field]);
  const dot = document.getElementById('dye-search-badge-dot');
  const clearBtn = document.getElementById('dye-shot-filter-clear');
  if (dot) dot.classList.toggle('hidden', !active);
  if (clearBtn) clearBtn.classList.toggle('hidden', !active);
}

async function applyShotFilters() {
  // The pick that just landed changes what every OTHER dropdown's facet query returns, so
  // their cached option lists (set in setupFilterCombo) are stale the moment this runs.
  DSF_FIELDS.forEach(([field]) => { const h = dsfFieldHandles[field]; if (h && h.invalidate) h.invalidate(); });
  await loadShots(dsfBuildFilter(dsfSearchText));
  renderLastShot().catch(e => console.warn(e));
  updateShotFilterBadge();
}

// reapply=false: just reset the UI/state because another filter mechanism (Same Beans) is
// about to replace the whole picture and will call loadShots itself.
function clearShotFilters(reapply) {
  dsfSearchText = '';
  const input = document.getElementById('dye-search-input');
  if (input) input.value = '';
  const xBtn = document.getElementById('dye-search-input-x');
  if (xBtn) xBtn.classList.add('hidden');
  const countEl = document.getElementById('dye-search-count');
  if (countEl) countEl.textContent = '';
  DSF_FIELDS.forEach(([field]) => {
    dsfSelection[field] = null;
    const h = dsfFieldHandles[field];
    if (h) { h.clear(); if (h.invalidate) h.invalidate(); }
  });
  updateShotFilterBadge();
  if (reapply) applyShotFilters().catch(e => console.warn(e));
}

// "N stars & up": clicking the already-active star count clears back to "any rating",
// same toggle-off feel as Same Beans. minEnjoyment is inclusive on the bridge
// (enjoyment >= value), so starsToEnjoyment(n) is exactly the threshold "n stars & up" means.
function setupShotRatingFilter() {
  const container = document.getElementById('dye-filter-rating');
  const label = document.getElementById('dye-filter-rating-label');
  if (!container) return { clear() {} };
  let active = 0;

  function paint() {
    container.querySelectorAll('.dye-filter-star').forEach(star => {
      const idx = parseInt(star.getAttribute('data-index'));
      if (idx <= active) { star.setAttribute('fill', 'var(--mimoja-blue)'); star.setAttribute('stroke', 'var(--mimoja-blue)'); }
      else { star.setAttribute('fill', 'none'); star.setAttribute('stroke', 'var(--profile-button-outline-color)'); }
    });
    if (label) label.textContent = active ? (active + '★ & up') : '';
  }

  container.querySelectorAll('.dye-filter-star').forEach(star => {
    star.addEventListener('click', () => {
      const idx = parseInt(star.getAttribute('data-index'));
      active = active === idx ? 0 : idx;
      paint();
      dsfSelection.rating = active ? { label: active + '★ & up', param: { minEnjoyment: starsToEnjoyment(active) } } : null;
      applyShotFilters().catch(e => console.warn(e));
    });
  });

  return { clear() { active = 0; paint(); } };
}

function setupShotFilterFields() {
  const clearBtn = document.getElementById('dye-shot-filter-clear');
  dsfFieldHandles.rating = setupShotRatingFilter();

  DSF_FIELDS.forEach(([field, loadOptions]) => {
    if (!loadOptions) return;
    dsfFieldHandles[field] = setupFilterCombo(
      'dye-filter-' + field + '-input', 'dye-filter-' + field + '-drop', loadOptions,
      (opt) => { dsfSelection[field] = opt; applyShotFilters().catch(e => console.warn(e)); },
      () => { dsfSelection[field] = null; applyShotFilters().catch(e => console.warn(e)); },
    );
  });

  if (clearBtn) clearBtn.addEventListener('click', () => clearShotFilters(true));
}

function setupDropdownToggle(btnId, dropdownId) {
  const btn = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  if (!btn || !dropdown) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    document.querySelectorAll('.dye-dash-dropdown').forEach(dd => { if (dd !== dropdown) dd.classList.remove('open'); });
  });
}


// Roast date of the batch the workflow points at. Async fetch, cached, re-renders once.
let roastDateCache = {};
function batchRoastDate(batchId) {
  if (!batchId) return '';
  if (roastDateCache[batchId] !== undefined) return roastDateCache[batchId] || '';
  roastDateCache[batchId] = null;
  getBeanBatch(batchId)
    .then(function (b) { roastDateCache[batchId] = (b && b.roastDate) || ''; renderNextShot(); })
    .catch(function () { roastDateCache[batchId] = ''; });
  return '';
}

function renderNextShot() {
  if (!currentWorkflow) return;
  const dateEl = document.getElementById('dye-next-date');
  if (dateEl) dateEl.textContent = formatCurrentDate();

  const wf = currentWorkflow;
  const ctx = wf.context || {};
  // Show the selected/active profile title (set by an applied fav/recipe, clipboard, or the live workflow).
  const profileNameEl = document.getElementById('dye-profile-name');
  if (profileNameEl) profileNameEl.textContent = (wf.profile && wf.profile.title) || '—';

  const doseVal = document.getElementById('dye-dose-value');
  const drinkVal = document.getElementById('dye-drink-value');
  const ratioVal = document.getElementById('dye-drink-ratio');
  if (doseVal) doseVal.textContent = ctx.targetDoseWeight != null ? ctx.targetDoseWeight + 'g' : '—';
  if (drinkVal) drinkVal.textContent = ctx.targetYield != null ? ctx.targetYield + 'g' : '—';
  if (ratioVal) { const r = calcRatio(ctx.targetDoseWeight, ctx.targetYield); ratioVal.textContent = r !== '—' ? '(' + r + ')' : ''; }

  const grindVal = document.getElementById('dye-grind-value');
  const rpmVal = document.getElementById('dye-rpm-value');
  if (grindVal) grindVal.textContent = ctx.grinderSetting != null ? ctx.grinderSetting : '—';
  if (rpmVal) rpmVal.textContent = (ctx.extras && ctx.extras.rpm != null) ? ctx.extras.rpm : '—';

  renderGrinderTabs();

  const beanNameEl = document.getElementById('dye-bean-name-display');
  const roastInfoEl = document.getElementById('dye-bean-roast-info');
  const coffeeName = ctx.coffeeName || '';
  const coffeeRoaster = ctx.coffeeRoaster || '';
  // WorkflowContext has no roastDate field — the bridge drops it — so the date comes from
  // the linked batch instead. Cached per batch id; the fetch fills it in on the next render.
  const roastDate = ctx.roastDate || batchRoastDate(ctx.beanBatchId);
  if (beanNameEl) beanNameEl.textContent = coffeeName || '— Select Beans';
  if (roastInfoEl) {
    if (coffeeRoaster || roastDate) {
      let info = coffeeRoaster ? 'Roasted by ' + coffeeRoaster : '';
      if (roastDate) {
        const rd = new Date(roastDate);
        const diffDays = Math.floor((new Date() - rd) / (1000 * 60 * 60 * 24));
        const dateStr = rd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        info += info ? ' on ' + dateStr + ' (' + diffDays + ' days off-roast)' : dateStr + ' (' + diffDays + ' days off-roast)';
      }
      roastInfoEl.textContent = info;
    } else { roastInfoEl.textContent = ''; }
  }

  const basketNameEl = document.getElementById('dye-basket-name');
  if (basketNameEl) basketNameEl.textContent = (ctx.extras && ctx.extras.basketName) || '— Select Basket';

  const baristaEl = document.getElementById('dye-next-barista');
  const drinkerEl = document.getElementById('dye-next-drinker');
  if (baristaEl) baristaEl.textContent = ctx.baristaName || ctx.barista || '—';
  if (drinkerEl) drinkerEl.textContent = ctx.drinkerName || ctx.drinker || '—';

  renderRecipePills(wf);
}

// Burr info in parentheses so two burr sets on the same model (e.g. "EK43") don't render
// as identical, indistinguishable tabs.
function grinderTabLabel(g) {
  const name = g.model || g.name || 'Grinder';
  const parts = [];
  if (g.burrs) parts.push(g.burrs);
  if (g.burrType) parts.push(g.burrType);
  if (g.burrSize) parts.push(g.burrSize + 'mm');
  return parts.length ? name + ' (' + parts.join(' · ') + ')' : name;
}

function renderGrinderTabs() {
  const container = document.getElementById('dye-grinder-tabs');
  if (!container || grinders.length === 0) return;
  container.innerHTML = '';
  const ctx = (currentWorkflow && currentWorkflow.context) || {};
  // Match by id first (unambiguous between two grinders sharing a model name); fall back
  // to model for older workflow state that only ever carried the string.
  const activeIdx = grinders.findIndex(g => ctx.grinderId ? g.id === ctx.grinderId : (g.model || g.name) === ctx.grinderModel);
  grinders.forEach((g, i) => {
    const tab = document.createElement('button');
    tab.className = 'dye-grinder-tab' + (i === activeIdx ? ' active' : '');
    tab.textContent = grinderTabLabel(g);
    tab.addEventListener('click', () => {
      if (!currentWorkflow) return;
      snapshotWorkflow();
      currentWorkflow.context = currentWorkflow.context || {};
      currentWorkflow.context.grinderId = g.id;
      currentWorkflow.context.grinderModel = g.model || g.name;
      markDye(currentWorkflow.context, ['grinderId', 'grinderModel']);
      renderGrinderTabs();
      pushWorkflow().catch(e => console.warn(e));
    });
    container.appendChild(tab);
  });
}

function renderRecipePills(workflow) {
  const container = document.getElementById('dye-recipe-pills');
  if (!container) return;
  // Prefer KV-store recipes (clickable/applicable); fall back to workflow strings (label-only).
  // recipe-edit's "Show on Streamline Dashboard" toggle writes showOnStreamlineDashboard,
  // so honour it here too — absent means shown. The workflow-string fallback carries no
  // flag, so it is never filtered.
  const recentItems = autoFavs.slice().sort((a, b) => (a.recentRank || 0) - (b.recentRank || 0));
  const recipeItems = recipes.length
    ? recipes.filter(r => r && r.stripSlot != null && r.showOnStreamlineDashboard !== false).sort((a, b) => a.stripSlot - b.stripSlot)   // the strip holds the slotted ones; the rest live in Select Recipe
    : (workflow.favorites || workflow.recipes || []);
  const selRecipeId = derivedSel && derivedSel.kind === 'recipe' ? String(derivedSel.id) : null;
  const selFavId = derivedSel && derivedSel.kind === 'favourite' ? String(derivedSel.id) : null;
  const selMark = derivedSel && derivedSel.modified ? ' *' : '';
  // The selected recipe may hold no strip slot (so recipeItems omits it): show it as a pill, first.
  const slotless = selRecipeId && recipes.length ? recipes.find(r => r && String(r.id) === selRecipeId && r.stripSlot == null) : null;
  const items = [...(slotless ? [slotless] : []), ...recentItems, ...recipeItems];
  container.innerHTML = '';
  if (items.length === 0) { container.innerHTML = '<span style="color:var(--low-contrast-white);font-size:21px;">No recipes yet</span>'; updateRailArrows(); return; }
  const activeTitle = workflow.profile && workflow.profile.title;
  items.forEach((item, i) => {
    const isRecent = typeof item === 'object' && item && item.auto === true;
    const title = typeof item === 'string' ? item : (item.name || item.title || ('Recipe ' + (i + 1)));
    // Pill label only (fav.title is stored and read by the Streamline skin): profile first.
    const snap = (isRecent && item.snapshot) || {};
    const pillLabel = isRecent ? ([snap.profileTitle, snap.coffeeName].filter(Boolean).join(' · ') || title) : title;
    const isSel = !isRecent && typeof item === 'object' && selRecipeId && String(item.id) === selRecipeId;
    // Highlight the item the plugin says is selected, by id. Matching the item's name against
    // the live profile title instead (as this did) highlighted nothing after applying a recent
    // -- its name is the favourite's, never the profile's -- and lit up every recipe that
    // happened to share a profile title. A label-only workflow string has no id, so it keeps
    // the title match.
    const isActive = typeof item === 'object'
      ? (isRecent ? !!selFavId && String(item.id) === selFavId : !!isSel)
      : title === activeTitle;
    const pill = document.createElement('button');
    pill.className = 'dye-recipe-pill' + (isRecent ? ' dye-pill-recent' : '') + (isActive ? ' active' : '');
    pill.title = title;
    const label = document.createElement('span');
    label.className = 'dye-recipe-pill-label';
    label.textContent = pillLabel + (isSel ? selMark : '');
    pill.appendChild(label);
    pill.addEventListener('click', async () => {
      document.querySelectorAll('.dye-recipe-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      centreRailOn(pill);
      if (typeof item !== 'object') return;
      await refreshWorkflow();   // apply over the live Workflow, not the page-open copy (dye2#31)
      if (isRecent) {
        await applyAutoFavourite(item);
        noteApplied('favourite', item);
        pushWorkflow().catch(e => console.warn(e));
      } else {
        // The list was read at page load; dial-in recording may have changed this recipe since,
        // so apply the stored record. Fall back to the loaded one if the re-read fails or the
        // recipe is gone, rather than applying nothing (dye2#28).
        let fresh = item;
        try { fresh = (await getRecipe(item.id)) || item; } catch (e) { console.warn('recipe re-read failed', e); }
        await applyRecipe(fresh);
        noteApplied('recipe', fresh);
        pushWorkflow().catch(e => console.warn(e));
      }
    });
    container.appendChild(pill);
  });
  refreshDerivedSelection();
  // Centre the highlighted pill, but only when the highlight itself moved: this runs on every
  // workflow refresh and every \`changed\` push too, and re-centring then would drag the rail
  // back under a barista who had scrolled it to look at something else.
  const activeKey = derivedSel ? derivedSel.kind + ':' + derivedSel.id : (activeTitle || '');
  if (activeKey !== railCentredKey) {
    railCentredKey = activeKey;
    centreRailOn(container.querySelector('.dye-recipe-pill.active'));
  }
  updateRailArrows();
}

// The pill the rail is already centred on, so a plain re-render leaves the scroll alone.
let railCentredKey = '';

// Bring a pill to the middle of the rail. scrollIntoView is not used: it scrolls every
// scrollable ancestor, and the page itself is one. Measured off rects, not offsetLeft --
// the pill's offsetParent is #dye-dash-root rather than the rail, so offsetLeft is in the
// wrong space. Rects are in painted pixels and dev-shell scales the page (and not evenly
// in x and y), while scrollBy wants layout pixels, hence the divide.
function centreRailOn(pill) {
  const rail = document.getElementById('dye-recipe-pills');
  if (!rail || !pill) return;
  const r = rail.getBoundingClientRect(), p = pill.getBoundingClientRect();
  const scale = r.width / rail.clientWidth || 1;
  const delta = ((p.left + p.width / 2) - (r.left + r.width / 2)) / scale;
  rail.scrollBy({ left: delta, behavior: 'smooth' });   // the browser clamps at both ends
}

// One arrow press moves one pill, so the rail always lands flush with a cell edge. 12 is the
// rail's gap-[12px]; a rail with no pills in it cannot scroll anyway.
function railStep() {
  const rail = document.getElementById('dye-recipe-pills');
  const pill = rail && rail.querySelector('.dye-recipe-pill');
  return pill ? pill.offsetWidth + 12 : 0;
}

// Grey out the rail arrows at each end of the scroll; both go off when the pills fit.
function updateRailArrows() {
  const rail = document.getElementById('dye-recipe-pills');
  const prev = document.getElementById('dye-recipe-prev');
  const next = document.getElementById('dye-recipe-next');
  if (!rail || !prev || !next) return;
  const fits = rail.scrollWidth <= rail.clientWidth + 1;
  prev.classList.toggle('dye-rail-arrow-hide', fits);
  next.classList.toggle('dye-rail-arrow-hide', fits);
  const atStart = rail.scrollLeft <= 0;
  const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
  prev.disabled = atStart; prev.classList.toggle('dye-rail-arrow-off', atStart);
  next.disabled = atEnd; next.classList.toggle('dye-rail-arrow-off', atEnd);
}

// PUT /api/v1/workflow deep-merges its body onto whatever workflow is already
// loaded on the machine (reaprime workflow_handler.dart _applyUpdate) rather
// than replacing it, so a profile field of only {id, title} overwrites just
// those two keys on the profile ALREADY loaded -- the steps array (the actual
// brew recipe) stays whatever was there before, and the machine keeps brewing
// the old profile mislabeled with the new one's name. Resolve to the full
// Profile record (steps included) instead: check the profiles list loaded by
// an earlier apply first, then fall back to a GET /profiles, memoised in
// profiles so only the first apply of a session pays for it (init no longer
// fetches it).
// Returns null (never throws) when the id can't be resolved -- an ad-hoc/
// deleted profile with no library record has nothing else to load; callers
// then send no profile at all and leave the live one alone, and a warning
// is logged. They used to send the {id, title} stub described above.
async function resolveFullProfile(id) {
  if (!id) return null;
  const cached = profiles.find(p => p && p.id === id);
  if (cached && cached.profile) return cached.profile;
  try {
    const fresh = await getProfiles({ includeHidden: true });
    const list = Array.isArray(fresh) ? fresh : (fresh && fresh.items ? fresh.items : []);
    profiles = list;
    const record = list.find(p => p && p.id === id);
    if (record && record.profile) return record.profile;
  } catch (e) {
    console.warn('resolveFullProfile: failed to fetch profiles while resolving ' + id, e);
  }
  console.warn('resolveFullProfile: could not resolve profile ' + id + ' to a full record (deleted/ad-hoc profile?) -- applying id/title only, brew steps will not change');
  return null;
}

// Map a recipe's dashboardVariables/metadata into currentWorkflow.context, then re-render.
// PUT /workflow only accepts context/profile (see setupClipboardPaste), so everything lands in context.
async function applyRecipe(recipe) {
  snapshotWorkflow();
  const dv = recipe.dashboardVariables || {};
  currentWorkflow = currentWorkflow || {};
  const ctx = { ...(currentWorkflow.context || {}) };
  // The fields this apply sets, flagged for Streamline's post-shot clear (markDye): ctx is a
  // copy of the whole live context, so scanning it would claim other plugins' values too.
  const wrote = [];
  if (dv.dose != null)  ctx.targetDoseWeight = dv.dose;
  if (dv.drink != null) ctx.targetYield = dv.drink;
  else if (dv.ratio != null && dv.dose != null) ctx.targetYield = Math.round(dv.dose * dv.ratio * 10) / 10;
  if (dv.grind != null) ctx.grinderSetting = dv.grind;
  if (dv.rpm != null)   { ctx.extras = { ...(ctx.extras || {}), rpm: dv.rpm }; wrote.push('rpm'); }
  const grinder = dv.grinderId ? grinders.find(g => g.id === dv.grinderId) : null;
  // Write id and name together: tabs match by id, shots record the name.
  if (grinder) { ctx.grinderId = grinder.id; ctx.grinderModel = grinder.model || grinder.name; wrote.push('grinderId', 'grinderModel'); }
  // Bean, roaster and batch are one pick (bean-picker), so they move together: a recipe that
  // names a bean but holds no batch clears the previous one rather than leaving a shot
  // carrying one roast's id under another coffee's name (dye2#27).
  if (recipe.beanId || recipe.beanName) {
    ctx.coffeeName    = recipe.beanName    || null;
    ctx.coffeeRoaster = recipe.beanRoaster || null;
    ctx.beanBatchId   = recipe.beanBatchId || null;
    wrote.push('coffeeName', 'coffeeRoaster', 'beanBatchId');
  } else {
    // Naming no bean clears the live one: switching from a recipe that names Ethiopia to one
    // that names nothing must not leave the next shot recorded under Ethiopia. Equipment and
    // session fields (grinder, basket, barista) are left alone — see dev-api buildRecipeWorkflow.
    ctx.coffeeName = null; ctx.coffeeRoaster = null; ctx.beanBatchId = null;
    wrote.push('coffeeName', 'coffeeRoaster', 'beanBatchId');
  }
  if (recipe.barista) { ctx.baristaName = recipe.barista; wrote.push('baristaName'); }
  if (recipe.drinker) { ctx.drinkerName = recipe.drinker; wrote.push('drinkerName'); }
  markDye(ctx, wrote);
  setRecipeId(ctx, recipe.id);
  currentWorkflow.context = ctx;
  if (recipe.profileId || recipe.profileTitle) {
    if (usableProfileSnapshot(recipe.profileSnapshot)) {
      currentWorkflow.profile = recipe.profileSnapshot;
    } else {
      const full = recipe.profileId ? await resolveFullProfile(recipe.profileId) : null;
      // Without a full profile, send none: PUT /workflow deep-merges, so a { id, title } stub
      // leaves the live profile's steps standing under the new name -- a workflow that claims a
      // profile it is not running, which dial-in then records onto the item. Leaving the live
      // profile alone is what resolveFullProfile's own warning already promises.
      if (full) currentWorkflow.profile = full;
    }
  }
  // Brew temperature moves the whole curve of whichever profile is now loaded (the recipe's
  // own, or the live one when it names none); a copy, so the recipe's snapshot is untouched.
  if (dv.brewC != null && currentWorkflow.profile) {
    currentWorkflow.profile = profileAtBrewTemp(currentWorkflow.profile, dv.brewC);
  }
  // Steam / hot-water / flush: every setting the recipe holds (recipeMachineSettings, not just the
  // active mode's), laid over the live sub-objects, which already carry the required
  // targetTemperature/flow. Guarded so we never send a partial.
  const machine = recipeMachineSettings(dv);
  for (const sub of Object.keys(machine)) {
    if (currentWorkflow[sub]) currentWorkflow[sub] = { ...currentWorkflow[sub], ...machine[sub] };
  }
  renderNextShot();
}

// Apply a saved auto-favourite's snapshot into currentWorkflow, honouring its copyMask
// (a field with mask === false is skipped; absent mask defaults to on). Mirrors applyRecipe.
async function applyAutoFavourite(fav) {
  if (!fav) return;
  snapshotWorkflow();
  const snp = fav.snapshot || {};
  const mask = fav.copyMask || {};
  const on = k => mask[k] !== false;
  currentWorkflow = currentWorkflow || {};
  const ctx = { ...(currentWorkflow.context || {}) };
  const wrote = [];   // flagged for Streamline's post-shot clear (markDye), as in applyRecipe
  if (on('dose')  && snp.dose  != null) ctx.targetDoseWeight = snp.dose;
  if (on('drink') && snp.drink != null) ctx.targetYield = snp.drink;
  if (on('grindSetting')) {
    if (snp.grindSetting != null) ctx.grinderSetting = String(snp.grindSetting);
    if (snp.rpm != null) { ctx.extras = { ...(ctx.extras || {}), rpm: snp.rpm }; wrote.push('rpm'); }
  }
  if (on('grinder')) {
    if (snp.grinderId) { ctx.grinderId = snp.grinderId; wrote.push('grinderId'); }
    if (snp.grinderModel) { ctx.grinderModel = snp.grinderModel; wrote.push('grinderModel'); }
  }
  if (on('beans')) {
    // A favourite that copies beans but captured none clears the live bean, as a recipe and a
    // recent do: switching items must not leave the previous coffee on the next shot. Turn the
    // beans mask off to leave the live bean alone instead.
    ctx.beanBatchId   = snp.beanBatchId   || null;
    ctx.coffeeName    = snp.coffeeName    || null;
    ctx.coffeeRoaster = snp.coffeeRoaster || null;
    wrote.push('beanBatchId', 'coffeeName', 'coffeeRoaster');
  }
  if (on('roastDate') && snp.roastDate) ctx.roastDate = snp.roastDate;
  if (on('barista')   && snp.barista)   { ctx.baristaName = snp.barista; wrote.push('baristaName'); }
  if (on('drinker')   && snp.drinker)   { ctx.drinkerName = snp.drinker; wrote.push('drinkerName'); }
  if (on('note')      && snp.note)      { ctx.extras = { ...(ctx.extras || {}), note: snp.note }; wrote.push('note'); }
  // A recent's own workflow.context is the source shot's actual recorded values,
  // including an explicit null where the shot had none — unlike a saved favourite's
  // snapshot, where the truthy checks above intentionally leave a field untouched
  // when the favourite never captured it. So a recent overrides its bean/grinder
  // fields outright (matching the Streamline skin's own applyFavourite merge),
  // clearing a stale selection rather than keeping it just because this recent's
  // shot happened to have none.
  if (fav.auto && fav.workflow && fav.workflow.context) {
    const fctx = fav.workflow.context;
    if (on('beans')) {
      ctx.beanBatchId   = fctx.beanBatchId   != null ? fctx.beanBatchId   : null;
      ctx.coffeeName    = fctx.coffeeName    != null ? fctx.coffeeName    : null;
      ctx.coffeeRoaster = fctx.coffeeRoaster != null ? fctx.coffeeRoaster : null;
      wrote.push('beanBatchId', 'coffeeName', 'coffeeRoaster');
    }
    if (on('grinder')) {
      ctx.grinderId    = fctx.grinderId    != null ? fctx.grinderId    : null;
      ctx.grinderModel = fctx.grinderModel != null ? fctx.grinderModel : null;
      wrote.push('grinderId', 'grinderModel');
    }
  }
  markDye(ctx, wrote);
  setRecipeId(ctx, null);
  currentWorkflow.context = ctx;
  if (on('profile') && (snp.profileId || snp.profileTitle)) {
    if (usableProfileSnapshot(snp.profileSnapshot)) {
      currentWorkflow.profile = snp.profileSnapshot;
    } else {
      const full = snp.profileId ? await resolveFullProfile(snp.profileId) : null;
      // No full profile, no profile: a { id, title } stub would deep-merge into the live
      // profile and rename its steps rather than replace them (see dashboard.ts applyRecipe).
      if (full) currentWorkflow.profile = full;
    }
  }
  // Recents carry the FULL recorded profile (not just {id, title}), so reapplying one
  // reproduces the exact steps that ran instead of just a reference by id/title.
  if (fav.auto && fav.workflow && fav.workflow.profile) {
    currentWorkflow.profile = fav.workflow.profile;
  }
  renderNextShot();
}

// A grind setting is free text on the host (WorkflowContext.grinderSetting is a String?):
// "1.1.0" on a three-dial grinder, "15 clicks" on a stepped one. parseFloat keeps "1.1" and
// drops the rest, so the fields that carry one are wired with allowText and go through here.
function isNumericText(t) {
  const s = (t == null ? '' : String(t)).trim();
  return s !== '' && Number.isFinite(Number(s));
}

function wireAdjuster(minusId, plusId, valueId, step, min, max, formatter, onChange, allowText) {
  const minusBtn = document.getElementById(minusId);
  const plusBtn = document.getElementById(plusId);
  if (!minusBtn || !plusBtn) return;
  let debounceTimer = null;
  minusBtn.addEventListener('click', () => {
    const valueEl = document.getElementById(valueId);
    if (!valueEl) return;
    // Free text has no step to move by, and stepping would coerce it to a number.
    // Leave it alone — typing is the way to change it.
    if (allowText && !isNumericText(valueEl.textContent)) return;
    const raw = parseFloat(valueEl.textContent);
    // Empty field shows "—" → start from min so − begins working.
    const base = isNaN(raw) ? min : raw;
    if (base <= min) { valueEl.textContent = formatter(min); clearTimeout(debounceTimer); debounceTimer = setTimeout(() => onChange(min), 500); return; }
    const val = Math.max(min, parseFloat((base - step).toFixed(2)));
    valueEl.textContent = formatter(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onChange(val), 500);
  });
  plusBtn.addEventListener('click', () => {
    const valueEl = document.getElementById(valueId);
    if (!valueEl) return;
    // Free text has no step to move by, and stepping would coerce it to a number.
    // Leave it alone — typing is the way to change it.
    if (allowText && !isNumericText(valueEl.textContent)) return;
    const raw = parseFloat(valueEl.textContent);
    const base = isNaN(raw) ? min : raw;
    const val = max !== null ? Math.min(max, parseFloat((base + step).toFixed(2))) : parseFloat((base + step).toFixed(2));
    valueEl.textContent = formatter(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onChange(val), 500);
  });
  makeValueEditable(valueId, min, max, formatter, onChange, allowText);
}

// Tap the number to type a value directly (tablet-friendly).
function makeValueEditable(valueId, min, max, formatter, onChange, allowText) {
  const valEl = document.getElementById(valueId);
  if (!valEl || valEl.dataset.editable) return;
  valEl.dataset.editable = '1';
  valEl.style.cursor = 'text';
  valEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (valEl.querySelector('input')) return;
    const cur = parseFloat(valEl.textContent);
    const prev = valEl.textContent;
    // A free-text field keeps what is shown, so opening the editor on "1.1.0" and tapping
    // away cannot quietly rewrite it to 1.1.
    const curText = allowText && prev !== '—' ? prev.trim() : (isNaN(cur) ? '' : String(cur));
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = curText;
    input.style.cssText = 'width:90px;font:inherit;text-align:center;border:1px solid var(--mimoja-blue);border-radius:8px;background:var(--input-bg);color:inherit;outline:none;padding:2px 4px';
    valEl.textContent = '';
    valEl.appendChild(input);
    input.focus(); input.select();
    let done = false;
    const commit = (apply) => {
      if (done) return; done = true;
      const raw = input.value.trim();
      // Not plainly a number and the field allows text: store it as typed. parseFloat
      // would read "1.1.0" as 1.1 and "15 clicks" as 15.
      if (apply && allowText && raw !== '' && !isNumericText(raw)) {
        valEl.textContent = raw;
        onChange(raw);
        return;
      }
      let v = parseFloat(raw);
      if (apply && !isNaN(v)) {
        if (min != null) v = Math.max(min, v);
        if (max != null) v = Math.min(max, v);
        valEl.textContent = formatter(v);
        onChange(v);
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

function setupDoseControls() {
  wireAdjuster('dye-dose-minus', 'dye-dose-plus', 'dye-dose-value', 0.5, 0, null,
    val => val + 'g',
    val => { if (!currentWorkflow) return; snapshotWorkflow(); currentWorkflow.context = currentWorkflow.context || {}; currentWorkflow.context.targetDoseWeight = val; updateRatioDisplay(); pushWorkflow().catch(e => console.warn(e)); }
  );
  wireAdjuster('dye-drink-minus', 'dye-drink-plus', 'dye-drink-value', 1, 0, null,
    val => val + 'g',
    val => { if (!currentWorkflow) return; snapshotWorkflow(); currentWorkflow.context = currentWorkflow.context || {}; currentWorkflow.context.targetYield = val; updateRatioDisplay(); pushWorkflow().catch(e => console.warn(e)); }
  );
  wireAdjuster('dye-grind-minus', 'dye-grind-plus', 'dye-grind-value', 0.1, 0, null,
    val => (typeof val === 'number' ? val.toFixed(1) : String(val)),
    val => { if (!currentWorkflow) return; snapshotWorkflow(); currentWorkflow.context = currentWorkflow.context || {}; currentWorkflow.context.grinderSetting = String(val); pushWorkflow().catch(e => console.warn(e)); },
    true   // grind is free text: see isNumericText
  );
  wireAdjuster('dye-rpm-minus', 'dye-rpm-plus', 'dye-rpm-value', 1, 1, null,
    val => String(val),
    val => { if (!currentWorkflow) return; snapshotWorkflow(); currentWorkflow.context = currentWorkflow.context || {}; currentWorkflow.context.extras = { ...(currentWorkflow.context.extras || {}), rpm: val }; markDye(currentWorkflow.context, ['rpm']); pushWorkflow().catch(e => console.warn(e)); }
  );
}

function updateRatioDisplay() {
  const ratioEl = document.getElementById('dye-drink-ratio');
  if (!ratioEl || !currentWorkflow) return;
  const ctx = currentWorkflow.context || {};
  const r = calcRatio(ctx.targetDoseWeight, ctx.targetYield);
  ratioEl.textContent = r !== '—' ? '(' + r + ')' : '';
}

// Ask the plugin runtime to recompute the recents, then re-read them for the pill row.
function refreshRecentsFromHistory() {
  fetch('/api/v1/plugins/dye2.reaplugin/recent-favs', { method: 'POST' })
    .then(() => getAutoFavourites())
    .then(result => {
      const allFavs = Array.isArray(result) ? result : (result && result.items ? result.items : []);
      autoFavs = allFavs.filter(f => f && f.auto);
      if (currentWorkflow) renderRecipePills(currentWorkflow);
    })
    .catch(e => console.warn('Could not refresh recent auto-favourites:', e));
}

function setupDeleteShot() {
  const deleteBtn = document.getElementById('dye-delete-shot');
  const dropdown = document.getElementById('dye-edit-shot-dropdown');
  if (!deleteBtn) return;
  deleteBtn.addEventListener('click', async () => {
    if (dropdown) dropdown.classList.remove('open');
    const shot = shots[currentShotIndex];
    if (!shot) return;
    if (!confirm('Delete this shot? This cannot be undone.')) return;
    try {
      // Against the seed alone, removing the shot would empty shots while shotsTotal still
      // counted the rest, and the panel would read "No shots recorded" with history intact.
      await ensureShotsPage();
      await deleteShot(shot.id);
      shots = shots.filter(s => s.id !== shot.id);
      shotsTotal = Math.max(0, shotsTotal - 1);
      currentShotIndex = Math.min(currentShotIndex, shots.length - 1);
      renderLastShot().catch(e => console.warn(e));
      // No shotDeleted event exists, so this POST is the only way the recents drop a deleted shot.
      refreshRecentsFromHistory();
    } catch (e) { console.error('Failed to delete shot:', e); }
  });
}

function setupBeanCard() {
  const card = document.getElementById('dye-bean-card');
  if (!card) return;
  card.addEventListener('click', () => { window.location.href = 'bean-picker'; });
}

// Tapping the Next Shot profile name opens the full picker. No ?return= — the picker's
// own confirm writes profile into the live workflow, which is exactly what Next Shot
// reads, so renderNextShot shows the new title when we land back here.
function setupProfileName() {
  const el = document.getElementById('dye-profile-name');
  if (!el) return;
  el.addEventListener('click', () => { window.location.href = 'profile-picker'; });
}

// The Grind label is the only way into the grinders page — nothing else links to it.
// The page's own DONE does history.back(), so no ?return= is needed.
function setupGrindLabel() {
  const el = document.getElementById('dye-grind-label');
  if (!el) return;
  el.addEventListener('click', () => { window.location.href = 'grinders'; });
}

// Same pattern as the Beans card: tap opens the picker, whose own confirm writes
// context.extras.basketId/basketName into the live workflow. No ?return= needed.
function setupBasketField() {
  const el = document.getElementById('dye-basket-field');
  if (!el) return;
  el.addEventListener('click', () => { window.location.href = 'basket-picker'; });
}

// Names previously used on shots, so Barista / Drinker can be picked instead of retyped.
async function distinctNames(key) {
  // Decaid clamps limit to 100 (shots_handler.dart), so ask for what it will actually return.
  const res = await getShots({ limit: 100 }).catch(() => []);
  const seen = new Set();
  (Array.isArray(res) ? res : (res.items || [])).forEach(s => {
    const ctx = (s.workflow && s.workflow.context) || {};
    const name = ctx[key] || (s.metadata && s.metadata[key === 'baristaName' ? 'barista' : 'drinker']);
    if (name) seen.add(name);
  });
  return [...seen];
}

// Tap Barista / Drinker on Next Shot to pick a previous name or type a new one. Swaps the
// value for an input the way the auto-fav-edit rows do, then writes the whole workflow
// back (not a partial context) so nothing else in it can be dropped by the round trip.
function setupNameField(fieldId, valueId, ctxKey) {
  const field = document.getElementById(fieldId);
  const value = document.getElementById(valueId);
  const input = document.getElementById(valueId + '-input');
  const drop  = document.getElementById(valueId + '-drop');
  if (!field || !value || !input || !drop) return;

  let cache = null;
  async function options() {
    if (!cache) { try { cache = await distinctNames(ctxKey); } catch (e) { cache = []; } }
    return cache;
  }
  // showAll on open: the input is pre-filled with the current name, so filtering by it
  // would hide every other option exactly when the user wants to see the list.
  async function openDrop(showAll) {
    const q = showAll ? '' : (input.value || '').trim().toLowerCase();
    const opts = (await options()).filter(o => !q || String(o).toLowerCase().includes(q));
    drop.innerHTML = '';
    if (!opts.length) {
      const e = document.createElement('div');
      e.className = 'dye-name-empty';
      e.textContent = 'No previous entries';
      drop.appendChild(e);
    } else {
      opts.slice(0, 50).forEach(o => {
        const el = document.createElement('div');
        el.className = 'dye-name-opt';
        el.textContent = o;
        // mousedown, not click: the pick has to land before the input's blur closes the drop.
        el.addEventListener('mousedown', (ev) => { ev.preventDefault(); input.value = o; commit(); });
        drop.appendChild(el);
      });
    }
    drop.classList.add('open');
  }
  function close() {
    drop.classList.remove('open');
    input.style.display = 'none';
    value.style.display = '';
  }
  function begin() {
    if (input.style.display !== 'none') return;
    input.value = value.textContent === '—' ? '' : value.textContent;
    value.style.display = 'none';
    input.style.display = '';
    input.focus();
    input.select();
    openDrop(true);
  }
  async function commit() {
    const v = input.value.trim();
    close();
    if (!currentWorkflow) return;
    currentWorkflow.context = currentWorkflow.context || {};
    currentWorkflow.context[ctxKey] = v || null;
    markDye(currentWorkflow.context, [ctxKey]);
    renderNextShot();
    cache = null;   // a name entered now should appear in the list next time
    try { await pushWorkflow(); }
    catch (e) { console.warn('Failed to save ' + ctxKey + ':', e); }
  }

  field.addEventListener('click', (e) => { if (e.target !== input) begin(); });
  input.addEventListener('input', () => openDrop(false));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { close(); }
  });
  // Let a dropdown mousedown win the race before blur tears the editor down.
  input.addEventListener('blur', () => setTimeout(() => { if (input.style.display !== 'none') commit(); }, 150));
}

function setupClipboardPaste() {
  const btn = document.getElementById('dye-clipboard-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const shot = shots[currentShotIndex];
    if (!shot) return;
    snapshotWorkflow();
    const wf = shot.workflow || {};
    const srcCtx = wf.context || {};
    const dd = wf.doseData || {};      // legacy shape, only on old shots
    const gd = wf.grinderData || {};
    currentWorkflow = currentWorkflow || {};
    // PUT /workflow only accepts context/profile as of v0.5.2 (doseData/grinderData rejected),
    // so map everything into context, falling back to legacy fields for old shots.
    currentWorkflow.context = {
      ...srcCtx,
      targetDoseWeight: srcCtx.targetDoseWeight != null ? srcCtx.targetDoseWeight : dd.doseIn,
      targetYield:      srcCtx.targetYield      != null ? srcCtx.targetYield      : dd.doseOut,
      grinderModel:     srcCtx.grinderModel  || gd.model || gd.name,
      grinderSetting:   srcCtx.grinderSetting != null ? srcCtx.grinderSetting : (gd.setting != null ? String(gd.setting) : undefined),
      // Basket and RPM as edit-shot shows them: an edit made after the shot wins.
      extras:           shotWorkflowExtras(shot),
    };
    markDye(currentWorkflow.context);   // the pasted shot's own flags are its past; flag what is set now
    setRecipeId(currentWorkflow.context, null);   // a pasted shot brings its own profile
    if (wf.profile) currentWorkflow.profile = { ...wf.profile };
    renderNextShot();
    // Show the copied shot's profile name (only revealed on clipboard copy).
    const profileEl = document.getElementById('dye-profile-name');
    if (profileEl) profileEl.textContent = (wf.profile && wf.profile.title) || '—';
  });
}

function referrerBack() {
  try {
    const r = new URL(document.referrer);
    if (r.protocol !== 'http:' && r.protocol !== 'https:') return '';
    if (r.hostname !== window.location.hostname) return '';
    if (r.pathname.indexOf('/api/v1/plugins/') === 0) return '';   // another DYE2 page, not the skin
    return r.toString();
  } catch (e) { return ''; }
}
// Leave the dashboard for the REA Web UI, which runs on :3000 (this plugin is served
// from :8080); ?_=Date.now() cache-busts, matching settings.reaplugin's back link. A
// caller that wants somewhere else passes ?return=.
//
// Deliberately no history.back() step: visiting recipe-edit (or any sub-page) and
// coming back leaves this page on the stack twice, so back() pops to the page the user
// just finished with — press DONE after saving a recipe and you land in Edit Recipes
// again. history.length is also >1 for almost any webview session, so that branch used
// to win nearly always and the REA fallback below rarely ran.
function leaveDashboard() {
  const ret = new URLSearchParams(location.search).get('return');
  if (ret) {
    // dyeApplied tells Streamline which item this visit applied (see lastApplied);
    // its presence also marks a DYE2 that reports it. Streamline reads and strips it.
    try {
      const u = new URL(ret, window.location.href);
      u.searchParams.set('dyeApplied', lastApplied);
      window.location.href = u.toString();
    } catch (e) { window.location.href = ret; }
    return;
  }
  // The :3000 fallback is a 307 redirector to the skin's real origin, so anything the skin
  // kept in sessionStorage is gone after it. The referrer is the skin's real page when the
  // skin opened us by link, so it goes first.
  const back = referrerBack();
  if (back) {
    try { const u = new URL(back); u.searchParams.set('dyeApplied', lastApplied); window.location.href = u.toString(); }
    catch (e) { window.location.href = back; }
    return;
  }
  window.location.href = 'http://' + window.location.hostname + ':3000/?_=' + Date.now() + '&dyeApplied=' + encodeURIComponent(lastApplied);
}

function setupReadNote() {
  const btn = document.getElementById('dye-read-note-btn');
  const overlay = document.getElementById('dye-note-overlay');
  const body = document.getElementById('dye-note-body');
  const closeBtn = document.getElementById('dye-note-close');
  if (btn && overlay && body) {
    btn.addEventListener('click', () => {
      body.textContent = currentShotNote.trim() || 'No note for this shot.';
      overlay.classList.add('open');
    });
  }
  closeBtn?.addEventListener('click', () => overlay?.classList.remove('open'));
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
}

// Attaches a note to the *next* shot's workflow context, read back later via
// setupReadNote's ctx.extras.note fallback once the shot is recorded.
function setupAddNote() {
  const btn = document.getElementById('dye-add-note-btn');
  const overlay = document.getElementById('dye-add-note-overlay');
  const input = document.getElementById('dye-add-note-input');
  const cancelBtn = document.getElementById('dye-add-note-cancel');
  const saveBtn = document.getElementById('dye-add-note-save');
  if (btn && overlay && input) {
    btn.addEventListener('click', () => {
      input.value = (currentWorkflow && currentWorkflow.context && currentWorkflow.context.extras && currentWorkflow.context.extras.note) || '';
      overlay.classList.add('open');
      input.focus();
    });
  }
  saveBtn?.addEventListener('click', () => {
    if (!currentWorkflow) { overlay?.classList.remove('open'); return; }
    snapshotWorkflow();
    currentWorkflow.context = currentWorkflow.context || {};
    currentWorkflow.context.extras = { ...(currentWorkflow.context.extras || {}), note: input.value };
    markDye(currentWorkflow.context, ['note']);
    pushWorkflow().catch(e => console.warn(e));
    overlay?.classList.remove('open');
  });
  cancelBtn?.addEventListener('click', () => overlay?.classList.remove('open'));
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
}

function setupBottomButtons() {
  const cancelBtn = document.getElementById('dye-cancel-btn');
  const doneBtn = document.getElementById('dye-done-btn');
  const clearBtn = document.getElementById('dye-clear-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => leaveDashboard());
  if (doneBtn) doneBtn.addEventListener('click', async () => {
    if (currentWorkflow) { try { await pushWorkflow(); } catch (e) { console.warn(e); } }
    leaveDashboard();
  });
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!currentWorkflow) return;
    snapshotWorkflow();
    // Explicit nulls, not an empty object. Done PUTs this context and the bridge
    // deep-merges it (deepMergeJson): an empty map iterates nothing and leaves
    // every field standing, so assigning {} cleared the display while the bean,
    // grinder and dose survived on the bridge and came back on the next open.
    // A null value does overwrite. Only fields DYE2 itself writes are listed --
    // finalBeverageType belongs to other writers, and roastDate is not a real
    // WorkflowContext field (the bridge drops it).
    currentWorkflow.context = {
      // targetYield is left out on purpose: the bridge rejects an explicit null for it
      // (workflow_handler.dart rejectExplicitNulls) and 400s the WHOLE body, so listing it
      // cleared nothing at all. WorkflowContext.toJson also omits a null targetYield, so a
      // merge cannot remove one either -- it is simply not clearable through PUT /workflow.
      // ponytail: the drink stays until it is overwritten; needs a host change to clear.
      targetDoseWeight: null,
      beanBatchId: null, coffeeName: null, coffeeRoaster: null,
      grinderId: null, grinderModel: null, grinderSetting: null,
      baristaName: null, drinkerName: null,
      extras: { basketId: null, basketName: null, rpm: null, note: null },
    };
    markDye(currentWorkflow.context);   // all null here, so every flag clears with its value
    renderNextShot();
  });
}

// Wiring runs before any network call. Every handler below guards against data that has
// not arrived yet, and wiring after the fetch left the whole header dead for as long as the
// bridge took to answer — on a tablet that is seconds, and a search icon that does nothing
// reads as broken rather than slow.
function wireDashboardControls() {
  setupShotNavigation();
  setupShotSearch();
  setupShotFilterFields();
  setupStarRating();
  setupDropdownToggle('dye-edit-shot-chevron', 'dye-edit-shot-dropdown');
  document.getElementById('dye-edit-shot-go')?.addEventListener('click', () => {
    const shot = shots[currentShotIndex];
    if (shot) sessionStorage.setItem('dye_editShotId', shot.id);
    window.location.href = '/api/v1/plugins/dye2.reaplugin/edit-shot';
  });
  setupDropdownToggle('dye-settings-btn', 'dye-settings-dropdown');
  document.getElementById('dye-settings-favourites')?.addEventListener('click', () => { window.location.href = '/api/v1/plugins/dye2.reaplugin/auto-favs'; });
  document.getElementById('dye-settings-recipes')?.addEventListener('click', openRecipes);
  document.getElementById('dye-settings-equipment')?.addEventListener('click', () => { window.location.href = '/api/v1/plugins/dye2.reaplugin/equipment'; });
  setupVisualizerDropdown();
  setupVisualizerModal();
  checkVisualizerLoggedIn().catch(e => console.warn(e));
  setupDeleteShot();
  setupDoseControls();
  setupBeanCard();
  setupProfileName();
  setupGrindLabel();
  setupBasketField();
  setupNameField('dye-barista-field', 'dye-next-barista', 'baristaName');
  setupNameField('dye-drinker-field', 'dye-next-drinker', 'drinkerName');
  setupClipboardPaste();
  setupBottomButtons();
  setupReadNote();
  setupAddNote();
  setupHistoryRevert();
  subscribeChanged();   // a strip "Save changes" clears the pill's star without a reload
  const pills = document.getElementById('dye-recipe-pills');
  document.getElementById('dye-recipe-prev')?.addEventListener('click', () => pills?.scrollBy({ left: -railStep(), behavior: 'smooth' }));
  document.getElementById('dye-recipe-next')?.addEventListener('click', () => pills?.scrollBy({ left: railStep(), behavior: 'smooth' }));
  // The smooth scrollBy animates, so the scroll event settles the final arrow state.
  pills?.addEventListener('scroll', updateRailArrows);
  window.addEventListener('resize', updateRailArrows);
  document.addEventListener('click', () => {
    document.querySelectorAll('.dye-dash-dropdown.open').forEach(dd => dd.classList.remove('open'));
  });
}

async function initializeDyeDashboard() {
  wireDashboardControls();

  // The unfiltered KV favourites array, read in the same batch as everything else.
  let allFavs = [];
  try {
    // The newest shot and the total come from two reads the bridge answers without touching a
    // measurements blob (GET /shots/latest, and limit=1 for its SQL COUNT). The real page is
    // the expensive read and loads behind the first paint, in ensureShotsPage below.
    const [latestResult, countResult, workflowResult, grindersResult, recipesResult, autoResult] = await Promise.all([
      getLatestShot().catch(() => null),
      getShots({ limit: 1, offset: 0, order: 'desc' }).catch(() => null),
      getWorkflow().catch(() => null),
      getGrinders().catch(() => []),
      getRecipes().catch(() => []),
      getAutoFavourites().catch(() => []),
    ]);
    seedLatestShot(latestResult, countResult && typeof countResult.total === 'number' ? countResult.total : null);
    // Returning from edit-shot: land back on the shot they were editing, not the newest. That
    // needs the real window, so this one path waits for it rather than painting the newest and
    // jumping. Every other open paints from the seed.
    const editedId = sessionStorage.getItem('dye_editShotId');
    sessionStorage.removeItem('dye_editShotId');
    // Editing the newest shot is the common case and the seed already is that shot, so only a
    // deeper one pays for the window. edit-shot lists more shots than SHOT_PAGE, so page until
    // the id turns up rather than silently landing on the newest.
    if (editedId && !(shots[0] && String(shots[0].id) === editedId)) {
      await ensureShotsPage();
      let editedIdx = shots.findIndex(s => String(s.id) === editedId);
      while (editedIdx < 0 && shots.length < shotsTotal) {
        if (!(await loadMoreShots())) break;
        editedIdx = shots.findIndex(s => String(s.id) === editedId);
      }
      if (editedIdx >= 0) currentShotIndex = editedIdx;
    }
    currentWorkflow = workflowResult;
    baseWorkflow = workflowResult ? JSON.parse(JSON.stringify(workflowResult)) : null;
    grinders = Array.isArray(grindersResult) ? grindersResult : (grindersResult && grindersResult.items ? grindersResult.items : []);
    allFavs = Array.isArray(autoResult) ? autoResult : (autoResult && autoResult.items ? autoResult.items : []);
    recipes = Array.isArray(recipesResult) ? recipesResult : [];
  } catch (e) {
    console.error('DYE Dashboard: Failed to load data:', e);
    shots = []; shotsTotal = 0; currentWorkflow = null; grinders = [];
  }

  // Returning from the Auto Favourites picker: apply the chosen favourite to Next Shot.
  const selFavId = sessionStorage.getItem('dye_selectedAutoFavId');
  if (selFavId) {
    sessionStorage.removeItem('dye_selectedAutoFavId');
    try {
      const fav = allFavs.find(f => f && f.id === selFavId) || null;
      if (fav) {
        await applyAutoFavourite(fav);
        noteApplied('favourite', fav);
        await pushWorkflow().catch(e => console.warn(e));
      } else if (selFavId.indexOf('recent:') === 0) {
        // A recent's id is not stable — it changes as soon as a newer shot takes over
        // its group — so the one the picker sent back can already be gone by the time
        // we get here. No shot-based fallback (see recent-favs spec); just say so.
        showTransientMessage('Favourite no longer available');
      }
    } catch (e) { console.warn('Could not apply selected auto-favourite:', e); }
  }

  // Returning from Select Recipe: apply the chosen recipe the way a pill tap does.
  const selRecipeId = sessionStorage.getItem('dye_selectedRecipeId');
  if (selRecipeId) {
    sessionStorage.removeItem('dye_selectedRecipeId');
    try {
      const picked = recipes.find(r => r && r.id === selRecipeId) || null;
      if (picked) {
        await applyRecipe(picked);
        noteApplied('recipe', picked);
        await pushWorkflow().catch(e => console.warn(e));
      }
    } catch (e) { console.warn('Could not apply selected recipe:', e); }
  }

  autoFavs = allFavs.filter(f => f && f.auto);

  await renderLastShot();

  // Not awaited: the text is already up. This only widens the loaded window so navigation can
  // move, and the counter was already correct from the cheap total, so there is normally nothing
  // to redraw. Re-render only if the page put a different shot on screen, which happens when a
  // shot is stored between the two reads, or when the seed was empty and the page is not.
  if (!shotsPageLoaded) {
    const seededId = shots[0] && shots[0].id;
    const seededTotal = shotsTotal;
    ensureShotsPage()
      .then(() => {
        const shownId = shots[currentShotIndex] && shots[currentShotIndex].id;
        // The total too: a shot stored between the two cheap reads, or a failed count read,
        // leaves the label showing the seed's total with no other trigger to correct it.
        if (shownId !== seededId || shotsTotal !== seededTotal) return renderLastShot();
      })
      .catch(e => console.warn('could not load the shot page:', e));
  }
  renderNextShot();

  // Recompute recents from the latest shot history in the background — same round
  // trip the Auto Favourites picker takes — then refresh just the pill row once it
  // lands. Never blocks first paint on this round trip.
  // Skipped when the newest loaded shot already represents a recent: pages are newest-first
  // and each group is represented by its newest shot, so the stored recents already include it.
  if (!shots[0] || !allFavs.some(f => f && f.auto && f.sourceShotId === shots[0].id)) {
    refreshRecentsFromHistory();
  }
}

function showTransientMessage(text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);' +
    'background:var(--mimoja-blue);color:#fff;padding:14px 28px;border-radius:12px;' +
    'font-family:Inter,sans-serif;font-size:20px;font-weight:600;z-index:999;' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.2)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

initializeDyeDashboard().catch(e => console.error('initializeDyeDashboard failed:', e));

// Returning here via history.back() can restore the page frozen from bfcache, so init
// (and the apply-selected-auto-favourite step) never re-runs — reload to re-fetch + apply.
window.addEventListener('pageshow', function(e) { if (e.persisted) window.location.reload(); });
`;

export function renderDashboardPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Dashboard", buildContent(), styles, [devApiScript, shotPagingScript, chartScript, pageScript], { echarts: true }),
  };
}
