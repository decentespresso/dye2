import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { shotPagingScript } from "../utils/shot-paging";
import { chartScript } from "../utils/chart";
import { iconHistory, iconClipboard } from "../utils/icons";

const styles = `
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
    color: #B6C3D7;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .dye-grinder-tab.active { color: var(--mimoja-blue); }

  .dye-recipe-pill {
    box-sizing: border-box;
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
    border: 2px solid #C5CDDA;
    background: white;
    color: #5F7BA8;
    transition: background 0.15s, color 0.15s;
  }
  .dye-recipe-pill.active { background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff; }
  .dye-recipe-pill-label {
    min-width: 0;
    max-width: 100%;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  #dye-grinder-tabs::-webkit-scrollbar { display: none; }

  /* ── Visualizer connected state ──────────────────────── */
  #dye-visualizer-btn.viz-connected svg:first-child {
    stroke: #0ca581;
  }

  /* ── Visualizer modal ────────────────────────────────── */
  .viz-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.45); z-index: 200;
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

function buildContent(): string { return `
<div id="dye-dash-root" class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col relative font-['Inter',sans-serif]">
  <div class="flex flex-1 overflow-hidden">

    <!-- LEFT PANEL: Last Shot Review -->
    <div class="flex flex-col w-1/2 shrink-0 bg-white border-r border-[var(--profile-button-outline-color)] overflow-hidden">
      <div class="flex flex-col gap-[27px] px-[38px] pt-[32px] pb-[40px] flex-1 overflow-hidden">

        <!-- Header row -->
        <div class="flex items-center justify-between shrink-0 h-[90px]">
          <div id="dye-last-shot-headings" class="flex flex-col gap-[8px]">
            <div id="dye-last-shot-label" class="text-[var(--mimoja-blue)] font-semibold text-[30px] leading-[1.2]">Last Shot: —</div>
            <div id="dye-last-shot-date" class="text-[var(--text-primary)] font-normal text-[24px] leading-[1.2]">—</div>
          </div>
          <div id="dye-search-wrap" class="hidden flex-1 mr-[24px] min-w-0 flex items-center gap-[16px]">
            <input id="dye-search-input" type="text" autocomplete="off" spellcheck="false"
              placeholder="Coffee, roaster, profile, grinder, notes…"
              class="flex-1 min-w-0 h-[54px] px-[24px] rounded-[23px] border-2 border-[var(--mimoja-blue)] bg-transparent text-[var(--text-primary)] text-[24px] outline-none">
            <!-- The "Last Shot (3/12)" heading is hidden while searching, so the count lives here. -->
            <span id="dye-search-count" class="text-[var(--low-contrast-white)] text-[21px] whitespace-nowrap shrink-0"></span>
          </div>
          <div class="flex items-center gap-[30px]">
            <button id="dye-search-btn" class="text-[var(--mimoja-blue)] cursor-pointer">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
            <button id="dye-history-btn" class="cursor-pointer">
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
            <button id="dye-dose-drink-prev" class="flex items-center justify-center shrink-0 cursor-pointer">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="flex items-center gap-[45px] flex-1 justify-center">
              <div class="flex items-center gap-[18px]">
                <span class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[75px]">Dose</span>
                <div class="flex items-center gap-[24px]">
                  <button id="dye-dose-minus" class="flex items-center justify-center w-[72px] h-[72px] bg-[#EDEDED] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <span id="dye-dose-value" class="font-bold text-[26px] text-[var(--text-primary)] w-[72px] text-center">—</span>
                  <button id="dye-dose-plus" class="flex items-center justify-center w-[72px] h-[72px] bg-[#EDEDED] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                </div>
              </div>
              <div class="flex items-center gap-[18px]">
                <span class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[75px]">Drink</span>
                <div class="flex items-center gap-[24px]">
                  <button id="dye-drink-minus" class="flex items-center justify-center w-[72px] h-[72px] bg-[#EDEDED] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <div class="flex flex-col items-center w-[72px]">
                    <span id="dye-drink-value" class="font-bold text-[26px] text-[var(--text-primary)] text-center">—</span>
                    <span id="dye-drink-ratio" class="font-semibold text-[18px] text-[var(--text-primary)] text-center"></span>
                  </div>
                  <button id="dye-drink-plus" class="flex items-center justify-center w-[72px] h-[72px] bg-[#EDEDED] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                </div>
              </div>
            </div>
            <button id="dye-dose-drink-next" class="flex items-center justify-center shrink-0 cursor-pointer">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        <div class="h-[2px] bg-[var(--profile-button-outline-color)] shrink-0"></div>

        <div class="flex flex-col gap-[18px] shrink-0">
          <div id="dye-grinder-tabs" class="flex gap-[27px] overflow-x-auto"></div>
          <div class="flex items-center gap-[18px]">
            <button id="dye-grind-rpm-prev" class="flex items-center justify-center shrink-0 cursor-pointer">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <!-- Same 45px gap as the Dose/Drink row above: both rows hold identical
                 label+stepper groups, so equal gaps make Grind line up under Dose and
                 RPM under Drink. -->
            <div class="flex items-center gap-[45px] flex-1 justify-center">
              <div class="flex items-center gap-[18px]">
                <span id="dye-grind-label" class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[75px] cursor-pointer">Grind</span>
                <div class="flex items-center gap-[24px]">
                  <button id="dye-grind-minus" class="flex items-center justify-center w-[72px] h-[72px] bg-[#EDEDED] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <span id="dye-grind-value" class="font-bold text-[26px] text-[var(--text-primary)] w-[72px] text-center">—</span>
                  <button id="dye-grind-plus" class="flex items-center justify-center w-[72px] h-[72px] bg-[#EDEDED] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                </div>
              </div>
              <div class="flex items-center gap-[18px]">
                <span class="font-bold text-[24px] text-[var(--mimoja-blue)] w-[75px]">RPM</span>
                <div class="flex items-center gap-[24px]">
                  <button id="dye-rpm-minus" class="flex items-center justify-center w-[72px] h-[72px] bg-[#EDEDED] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <span id="dye-rpm-value" class="font-bold text-[26px] text-[var(--text-primary)] w-[72px] text-center">—</span>
                  <button id="dye-rpm-plus" class="flex items-center justify-center w-[72px] h-[72px] bg-[#EDEDED] rounded-[15px] cursor-pointer"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                </div>
              </div>
            </div>
            <button id="dye-grind-rpm-next" class="flex items-center justify-center shrink-0 cursor-pointer">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
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
let grinders = [];
let recipes = [];
let currentGrinderIndex = 0;
let currentWorkflow = null;
let currentStarRating = 0;
let currentShotNote = '';
let vizLoggedIn = false;
let vizUsername = '';
let lastEditSnapshot = null;

// One-level undo for Next Shot Planning: every edit first saves the state it is
// replacing, and the history button swaps back to it (press again to re-apply).
// ponytail: single snapshot, not a stack — add an array if multi-step undo is wanted.
function snapshotWorkflow() {
  if (!currentWorkflow) return;
  lastEditSnapshot = JSON.stringify({ context: currentWorkflow.context || {}, profile: currentWorkflow.profile || null });
  const btn = document.getElementById('dye-history-btn');
  if (btn) btn.style.opacity = '';
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
    updateWorkflow(currentWorkflow).catch(e => console.warn(e));
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

async function renderLastShot() {
  updateSearchCount();
  let shot = shots[currentShotIndex];
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
  // Show position so a single-shot "Same Beans" view is obviously why prev/next don't move.
  const pos = shotsTotal > 1 ? ' (' + (currentShotIndex + 1) + '/' + shotsTotal + ')' : '';
  if (labelEl) labelEl.textContent = 'Last Shot: ' + label + pos;
  if (dateEl) dateEl.textContent = full;

  if (!shot.measurements) {
    try {
      const full = await getShot(shot.id);
      shots[currentShotIndex] = { ...shot, ...full };
      shot = shots[currentShotIndex];
    } catch (e) { console.warn('Could not fetch full shot data:', e); }
  }

  if (shot.measurements && shot.measurements.length > 0) {
    plotHistoricalShot(shot.measurements, shot.workflow);
  }

  const wf = shot.workflow || {};
  const ctx = wf.context || {};
  const doseData = wf.doseData || {};
  const grinderData = wf.grinderData || {};
  const profile = wf.profile || {};

  if (profileEl) profileEl.textContent = profile.title || '—';

  // Dose: from context.targetDoseWeight
  // Drink: last scale.weight value in measurements
  const measurements = shot.measurements || [];
  const doseInRaw = ctx.targetDoseWeight != null ? ctx.targetDoseWeight : (doseData.doseIn != null ? doseData.doseIn : null);
  let doseOutRaw = null;
  for (let mi = measurements.length - 1; mi >= 0; mi--) {
    const sc = measurements[mi].scale;
    if (sc && sc.weight != null) { doseOutRaw = sc.weight; break; }
  }

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

  const roaster = ctx.coffeeRoaster || '';
  const coffeeName = ctx.coffeeName || '';
  if (beansEl) {
    if (roaster || coffeeName) beansEl.innerHTML = roaster ? '<strong>' + roaster + '</strong> &bull; ' + coffeeName : coffeeName;
    else beansEl.textContent = '—';
  }

  const grinderModel = ctx.grinderModel || grinderData.model || grinderData.name || '—';
  const grindSetting = ctx.grinderSetting != null ? ctx.grinderSetting : (grinderData.setting !== undefined ? grinderData.setting : '—');
  // RPM is saved onto the shot by the edit-shot page at annotations.extras.rpm
  const shotAnn = shot.annotations || {};
  const grindRpm = (shotAnn.extras && shotAnn.extras.rpm != null) ? shotAnn.extras.rpm : (grinderData.rpm != null ? grinderData.rpm : null);
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

  const rating = (shot.annotations && shot.annotations.enjoyment) ? parseInt(shot.annotations.enjoyment) : 0;
  currentStarRating = rating;
  updateStarDisplay(rating);

  // Read Note reflects the shot's drinker note (annotations.espressoNotes),
  // falling back to a note attached pre-shot via the workflow (context.extras.note).
  const wfNote = ctx.extras && ctx.extras.note;
  currentShotNote = (shot.annotations && shot.annotations.espressoNotes) || wfNote || '';
  const noteBtn = document.getElementById('dye-read-note-btn');
  if (noteBtn) noteBtn.style.opacity = currentShotNote.trim() ? '' : '0.4';
}

function updateStarDisplay(rating) {
  document.querySelectorAll('.dye-star').forEach(star => {
    const idx = parseInt(star.getAttribute('data-index'));
    if (idx <= rating) { star.setAttribute('fill', 'var(--mimoja-blue)'); star.setAttribute('stroke', 'var(--mimoja-blue)'); }
    else { star.setAttribute('fill', 'none'); star.setAttribute('stroke', 'var(--profile-button-outline-color)'); }
  });
}

function setupStarRating() {
  document.querySelectorAll('.dye-star').forEach(star => {
    star.addEventListener('click', async () => {
      const idx = parseInt(star.getAttribute('data-index'));
      currentStarRating = idx;
      updateStarDisplay(idx);
      const shot = shots[currentShotIndex];
      if (shot) {
        try { const ann = { ...(shot.annotations || {}), enjoyment: idx }; await updateShot(shot.id, { annotations: ann }); shot.annotations = ann; }
        catch (e) { console.warn('Could not save star rating:', e); }
      }
    });
  });
}

// The magnifier searches the whole history through the bridge (coffee name, roaster,
// profile, grinder and notes), not the loaded page — same reason Same Beans does.
async function runShotSearch(query) {
  // A search is its own view of history; Same Beans has no meaning inside one.
  sameBeanFilter = false;
  const sameBeansLabel = document.querySelector('#dye-same-beans-btn span');
  if (sameBeansLabel) sameBeansLabel.textContent = 'All Shots';
  await loadShots(query ? { search: query } : null);
  renderLastShot().catch(e => console.warn(e));
}

function closeShotSearch() {
  const wrap = document.getElementById('dye-search-wrap');
  const input = document.getElementById('dye-search-input');
  const headings = document.getElementById('dye-last-shot-headings');
  if (!wrap || wrap.classList.contains('hidden')) return false;
  wrap.classList.add('hidden');
  if (headings) headings.classList.remove('hidden');
  const had = !!(input && input.value.trim());
  if (input) input.value = '';
  const countEl = document.getElementById('dye-search-count');
  if (countEl) countEl.textContent = '';
  return had;
}

function setupShotSearch() {
  const btn = document.getElementById('dye-search-btn');
  const wrap = document.getElementById('dye-search-wrap');
  const input = document.getElementById('dye-search-input');
  const headings = document.getElementById('dye-last-shot-headings');
  if (!btn || !wrap || !input) return;
  let timer = null;

  btn.addEventListener('click', () => {
    if (wrap.classList.contains('hidden')) {
      if (headings) headings.classList.add('hidden');
      wrap.classList.remove('hidden');
      input.focus();
      return;
    }
    // Closing on a live search puts the full history back.
    if (closeShotSearch()) runShotSearch('');
  });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => runShotSearch(input.value.trim()), 350);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(timer); runShotSearch(input.value.trim()); }
    if (e.key === 'Escape') { clearTimeout(timer); if (closeShotSearch()) runShotSearch(''); }
  });
}

function setupShotNavigation() {
  const prevBtn = document.getElementById('dye-prev-shot-btn');
  const nextBtn = document.getElementById('dye-next-shot-btn');
  const sameBeansBtn = document.getElementById('dye-same-beans-btn');

  // Wrap around so the ends are never dead: prev past oldest → newest, next past newest → oldest.
  if (prevBtn) prevBtn.addEventListener('click', async () => {
    if (await stepToOlderShot()) renderLastShot().catch(e => console.warn(e));
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (shots.length < 2) return;
    currentShotIndex = (currentShotIndex - 1 + shots.length) % shots.length;
    renderLastShot().catch(e => console.warn(e));
  });

  if (sameBeansBtn) sameBeansBtn.addEventListener('click', async () => {
    closeShotSearch();
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

function renderGrinderTabs() {
  const container = document.getElementById('dye-grinder-tabs');
  if (!container || grinders.length === 0) return;
  container.innerHTML = '';
  grinders.forEach((g, i) => {
    const tab = document.createElement('button');
    tab.className = 'dye-grinder-tab' + (i === currentGrinderIndex ? ' active' : '');
    tab.textContent = g.model || g.name || ('Grinder ' + (i + 1));
    tab.addEventListener('click', () => {
      currentGrinderIndex = i;
      document.querySelectorAll('.dye-grinder-tab').forEach((t, j) => t.classList.toggle('active', j === i));
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
  const items = recipes.length
    ? recipes.filter(r => r && r.showOnStreamlineDashboard !== false)
    : (workflow.favorites || workflow.recipes || []);
  container.innerHTML = '';
  if (items.length === 0) { container.innerHTML = '<span style="color:var(--low-contrast-white);font-size:21px;">No recipes yet</span>'; return; }
  const activeTitle = workflow.profile && workflow.profile.title;
  items.forEach((item, i) => {
    const title = typeof item === 'string' ? item : (item.name || item.title || ('Recipe ' + (i + 1)));
    const pill = document.createElement('button');
    pill.className = 'dye-recipe-pill' + (title === activeTitle ? ' active' : '');
    pill.title = title;
    const label = document.createElement('span');
    label.className = 'dye-recipe-pill-label';
    label.textContent = title;
    pill.appendChild(label);
    pill.addEventListener('click', () => {
      document.querySelectorAll('.dye-recipe-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (typeof item === 'object') applyRecipe(item);
    });
    container.appendChild(pill);
  });
}

// Map a recipe's dashboardVariables/metadata into currentWorkflow.context, then re-render.
// PUT /workflow only accepts context/profile (see setupClipboardPaste), so everything lands in context.
function applyRecipe(recipe) {
  snapshotWorkflow();
  const dv = recipe.dashboardVariables || {};
  currentWorkflow = currentWorkflow || {};
  const ctx = { ...(currentWorkflow.context || {}) };
  if (dv.dose != null)  ctx.targetDoseWeight = dv.dose;
  if (dv.drink != null) ctx.targetYield = dv.drink;
  else if (dv.ratio != null && dv.dose != null) ctx.targetYield = Math.round(dv.dose * dv.ratio * 10) / 10;
  if (dv.grind != null) ctx.grinderSetting = dv.grind;
  if (dv.rpm != null)   ctx.extras = { ...(ctx.extras || {}), rpm: dv.rpm };
  const grinder = dv.grinderId ? grinders.find(g => g.id === dv.grinderId) : null;
  if (grinder) ctx.grinderModel = grinder.model || grinder.name;
  if (recipe.barista) ctx.baristaName = recipe.barista;
  if (recipe.drinker) ctx.drinkerName = recipe.drinker;
  currentWorkflow.context = ctx;
  if (recipe.profileId || recipe.profileTitle) {
    currentWorkflow.profile = { id: recipe.profileId, title: recipe.profileTitle };
  }
  // Steam / hot-water / flush: override only the recipe's fields on the live sub-objects
  // (which already carry the required targetTemperature/flow). Guarded so we never send a partial.
  if (currentWorkflow.steamSettings && (dv.steamTimeS != null || dv.steamFlowMls != null)) {
    const ss = { ...currentWorkflow.steamSettings };
    if (dv.steamMode === 'time' && dv.steamTimeS != null)  ss.duration = dv.steamTimeS;
    if (dv.steamMode === 'flow' && dv.steamFlowMls != null) ss.flow = dv.steamFlowMls;
    currentWorkflow.steamSettings = ss;
  }
  if (currentWorkflow.hotWaterData && (dv.hotWaterMl != null || dv.hotWaterTempC != null)) {
    const hw = { ...currentWorkflow.hotWaterData };
    if (dv.hotWaterMode === 'vol'  && dv.hotWaterMl != null)    hw.volume = dv.hotWaterMl;
    if (dv.hotWaterMode === 'temp' && dv.hotWaterTempC != null) hw.targetTemperature = dv.hotWaterTempC;
    currentWorkflow.hotWaterData = hw;
  }
  if (currentWorkflow.rinseData && dv.flushS != null) {
    currentWorkflow.rinseData = { ...currentWorkflow.rinseData, duration: dv.flushS };
  }
  renderNextShot();
}

// Apply a saved auto-favourite's snapshot into currentWorkflow, honouring its copyMask
// (a field with mask === false is skipped; absent mask defaults to on). Mirrors applyRecipe.
function applyAutoFavourite(fav) {
  if (!fav) return;
  snapshotWorkflow();
  const snp = fav.snapshot || {};
  const mask = fav.copyMask || {};
  const on = k => mask[k] !== false;
  currentWorkflow = currentWorkflow || {};
  const ctx = { ...(currentWorkflow.context || {}) };
  if (on('dose')  && snp.dose  != null) ctx.targetDoseWeight = snp.dose;
  if (on('drink') && snp.drink != null) ctx.targetYield = snp.drink;
  if (on('grindSetting')) {
    if (snp.grindSetting != null) ctx.grinderSetting = String(snp.grindSetting);
    if (snp.rpm != null) ctx.extras = { ...(ctx.extras || {}), rpm: snp.rpm };
  }
  if (on('grinder')) {
    if (snp.grinderId) ctx.grinderId = snp.grinderId;
    if (snp.grinderModel) ctx.grinderModel = snp.grinderModel;
  }
  if (on('beans')) {
    if (snp.beanBatchId) ctx.beanBatchId = snp.beanBatchId;
    if (snp.coffeeName) ctx.coffeeName = snp.coffeeName;
    if (snp.coffeeRoaster) ctx.coffeeRoaster = snp.coffeeRoaster;
  }
  if (on('roastDate') && snp.roastDate) ctx.roastDate = snp.roastDate;
  if (on('barista')   && snp.barista)   ctx.baristaName = snp.barista;
  if (on('drinker')   && snp.drinker)   ctx.drinkerName = snp.drinker;
  if (on('note')      && snp.note)      ctx.extras = { ...(ctx.extras || {}), note: snp.note };
  currentWorkflow.context = ctx;
  if (on('profile') && (snp.profileId || snp.profileTitle)) {
    currentWorkflow.profile = { id: snp.profileId, title: snp.profileTitle };
  }
  renderNextShot();
}

function wireAdjuster(minusId, plusId, valueId, step, min, max, formatter, onChange) {
  const minusBtn = document.getElementById(minusId);
  const plusBtn = document.getElementById(plusId);
  if (!minusBtn || !plusBtn) return;
  let debounceTimer = null;
  minusBtn.addEventListener('click', () => {
    const valueEl = document.getElementById(valueId);
    if (!valueEl) return;
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
    const raw = parseFloat(valueEl.textContent);
    const base = isNaN(raw) ? min : raw;
    const val = max !== null ? Math.min(max, parseFloat((base + step).toFixed(2))) : parseFloat((base + step).toFixed(2));
    valueEl.textContent = formatter(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onChange(val), 500);
  });
  makeValueEditable(valueId, min, max, formatter, onChange);
}

// Tap the number to type a value directly (tablet-friendly).
function makeValueEditable(valueId, min, max, formatter, onChange) {
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
    val => { if (!currentWorkflow) return; snapshotWorkflow(); currentWorkflow.context = currentWorkflow.context || {}; currentWorkflow.context.targetDoseWeight = val; updateRatioDisplay(); updateWorkflow(currentWorkflow).catch(e => console.warn(e)); }
  );
  wireAdjuster('dye-drink-minus', 'dye-drink-plus', 'dye-drink-value', 1, 0, null,
    val => val + 'g',
    val => { if (!currentWorkflow) return; snapshotWorkflow(); currentWorkflow.context = currentWorkflow.context || {}; currentWorkflow.context.targetYield = val; updateRatioDisplay(); updateWorkflow(currentWorkflow).catch(e => console.warn(e)); }
  );
  wireAdjuster('dye-grind-minus', 'dye-grind-plus', 'dye-grind-value', 0.1, 0, null,
    val => val.toFixed(1),
    val => { if (!currentWorkflow) return; snapshotWorkflow(); currentWorkflow.context = currentWorkflow.context || {}; currentWorkflow.context.grinderSetting = String(val); updateWorkflow(currentWorkflow).catch(e => console.warn(e)); }
  );
  wireAdjuster('dye-rpm-minus', 'dye-rpm-plus', 'dye-rpm-value', 1, 1, null,
    val => String(val),
    val => { if (!currentWorkflow) return; snapshotWorkflow(); currentWorkflow.context = currentWorkflow.context || {}; currentWorkflow.context.extras = { ...(currentWorkflow.context.extras || {}), rpm: val }; updateWorkflow(currentWorkflow).catch(e => console.warn(e)); }
  );
}

function updateRatioDisplay() {
  const ratioEl = document.getElementById('dye-drink-ratio');
  if (!ratioEl || !currentWorkflow) return;
  const ctx = currentWorkflow.context || {};
  const r = calcRatio(ctx.targetDoseWeight, ctx.targetYield);
  ratioEl.textContent = r !== '—' ? '(' + r + ')' : '';
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
      await deleteShot(shot.id);
      shots = shots.filter(s => s.id !== shot.id);
      shotsTotal = Math.max(0, shotsTotal - 1);
      currentShotIndex = Math.min(currentShotIndex, shots.length - 1);
      renderLastShot().catch(e => console.warn(e));
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
  const res = await getShots({ limit: 200 }).catch(() => []);
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
    renderNextShot();
    cache = null;   // a name entered now should appear in the list next time
    try { await updateWorkflow(currentWorkflow); }
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
    const ann = shot.annotations || {};
    const srcRpm = (srcCtx.extras && srcCtx.extras.rpm != null) ? srcCtx.extras.rpm
      : (ann.extras && ann.extras.rpm != null) ? ann.extras.rpm
      : (gd.rpm != null ? gd.rpm : undefined);
    currentWorkflow = currentWorkflow || {};
    // PUT /workflow only accepts context/profile as of v0.5.2 (doseData/grinderData rejected),
    // so map everything into context, falling back to legacy fields for old shots.
    currentWorkflow.context = {
      ...srcCtx,
      targetDoseWeight: srcCtx.targetDoseWeight != null ? srcCtx.targetDoseWeight : dd.doseIn,
      targetYield:      srcCtx.targetYield      != null ? srcCtx.targetYield      : dd.doseOut,
      grinderModel:     srcCtx.grinderModel  || gd.model || gd.name,
      grinderSetting:   srcCtx.grinderSetting != null ? srcCtx.grinderSetting : (gd.setting != null ? String(gd.setting) : undefined),
      extras:           srcRpm != null ? { ...(srcCtx.extras || {}), rpm: srcRpm } : srcCtx.extras,
    };
    if (wf.profile) currentWorkflow.profile = { ...wf.profile };
    renderNextShot();
    // Show the copied shot's profile name (only revealed on clipboard copy).
    const profileEl = document.getElementById('dye-profile-name');
    if (profileEl) profileEl.textContent = (wf.profile && wf.profile.title) || '—';
  });
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
  if (ret) { window.location.href = ret; return; }
  window.location.href = 'http://' + window.location.hostname + ':3000/?_=' + Date.now();
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
    updateWorkflow(currentWorkflow).catch(e => console.warn(e));
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
    if (currentWorkflow) { try { await updateWorkflow(currentWorkflow); } catch (e) { console.warn(e); } }
    leaveDashboard();
  });
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!currentWorkflow) return;
    snapshotWorkflow();
    currentWorkflow.context = {};
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
  setupStarRating();
  setupDropdownToggle('dye-edit-shot-chevron', 'dye-edit-shot-dropdown');
  document.getElementById('dye-edit-shot-go')?.addEventListener('click', () => {
    const shot = shots[currentShotIndex];
    if (shot) sessionStorage.setItem('dye_editShotId', shot.id);
    window.location.href = '/api/v1/plugins/dye2.reaplugin/edit-shot';
  });
  setupDropdownToggle('dye-settings-btn', 'dye-settings-dropdown');
  document.getElementById('dye-settings-favourites')?.addEventListener('click', () => { window.location.href = '/api/v1/plugins/dye2.reaplugin/auto-favs'; });
  document.getElementById('dye-settings-recipes')?.addEventListener('click', () => { sessionStorage.setItem('dye_editRecipeIdx', '0'); window.location.href = '/api/v1/plugins/dye2.reaplugin/recipe-edit'; });
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
  const pills = document.getElementById('dye-recipe-pills');
  document.getElementById('dye-recipe-prev')?.addEventListener('click', () => pills?.scrollBy({ left: -pills.clientWidth, behavior: 'smooth' }));
  document.getElementById('dye-recipe-next')?.addEventListener('click', () => pills?.scrollBy({ left: pills.clientWidth, behavior: 'smooth' }));
  document.addEventListener('click', () => {
    document.querySelectorAll('.dye-dash-dropdown.open').forEach(dd => dd.classList.remove('open'));
  });
}

async function initializeDyeDashboard() {
  wireDashboardControls();

  try {
    const [shotsResult, workflowResult, grindersResult, recipesResult] = await Promise.all([
      fetchShotPage(0),
      getWorkflow().catch(() => null),
      getGrinders().catch(() => []),
      getRecipes().catch(() => []),
    ]);
    shots = shotsResult.items;
    shotsTotal = shotsResult.total;
    // Returning from edit-shot: land back on the shot they were editing, not the newest.
    const editedId = sessionStorage.getItem('dye_editShotId');
    sessionStorage.removeItem('dye_editShotId');
    const editedIdx = editedId ? shots.findIndex(s => String(s.id) === editedId) : -1;
    currentShotIndex = editedIdx >= 0 ? editedIdx : 0;
    currentWorkflow = workflowResult;
    grinders = Array.isArray(grindersResult) ? grindersResult : (grindersResult && grindersResult.items ? grindersResult.items : []);
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
      const fav = await getAutoFavourite(selFavId);
      if (fav) { applyAutoFavourite(fav); await updateWorkflow(currentWorkflow).catch(e => console.warn(e)); }
    } catch (e) { console.warn('Could not apply selected auto-favourite:', e); }
  }

  initChart();
  await renderLastShot();
  renderNextShot();
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
    body: devPageShell("Dashboard", buildContent(), styles, [devApiScript, shotPagingScript, chartScript, pageScript], { plotly: true }),
  };
}
