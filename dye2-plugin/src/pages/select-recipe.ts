import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { recipeUseSortScript, ratingSortScript } from "../utils/recipe-sort";
import { favCardTapScript, cardLongPressScript } from "../utils/fav-card-tap";
import { sortSidebarScript, dyePickerCss, dyePickerHeaderHtml, dyePickerRailHtml } from "../utils/shared-components";
import { recipeStripScript } from "../utils/recipe-strip";

// The recipe library, in the bean picker's translation of Figma "DYE_Select Coffee Beans"
// (2345:2457 / 2345:2577): same CSS, header, rail and grid as bean-picker.ts, all from
// shared-components. Slot assignment normally lives in recipe-edit; this page does it only in
// assign mode (?slot=N), which Streamline's "Replace <name>" opens. No chevron on
// CONFIRM and no second step. Most/Least Used count shots per recipeId from shotIndex.uses (recipe-sort.ts).
const content = `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col">

  ${dyePickerHeaderHtml('Select Recipe', '<span>CONFIRM</span>')}

  <div class="flex flex-1 overflow-hidden">

    ${dyePickerRailHtml([['recent', 'Recent'], ['oldest', 'Oldest'], ['az', 'A-Z'], ['za', 'Z-A'], ['most-used', 'Most Used'], ['least-used', 'Least Used'], ['rating', 'Rating']])}

    <div id="dye-cards-container" class="flex-1 overflow-y-auto pt-[28px] px-[38px] pb-[28px]">
      <div id="dye-cards-grid" class="grid grid-cols-3 gap-[20px]"></div>
    </div>

  </div>
</div>
`;

const pageScript = `
${sortSidebarScript}
${favCardTapScript}
${cardLongPressScript}
${recipeUseSortScript}
${ratingSortScript}
${recipeStripScript}

let recipesCache = [];
// Assign mode: Streamline's R-strip long-press "Replace <name>" opens this page as
// select-recipe?slot=N&return=<streamline url>. CONFIRM then puts the picked recipe on
// strip slot N and goes straight back, instead of applying it to the machine.
const assignSlot = assignSlotFrom(location.search);
const returnTo = new URLSearchParams(location.search).get('return');
// Where CANCEL and a finished assign go. Streamline's return URL carries dyeReturn=1, which
// tears its overlay down and reloads the strip.
function leaveSelectRecipe() { window.location.href = returnTo || 'dashboard'; }
// dye_editRecipeId is the preselected card: the dashboard sets it to the recipe being dialled
// in, and a card's edit sets it so coming back from recipe-edit lands on the same card.
// Assign mode starts with NOTHING selected: that key outlives the trip that set it, so a
// preselect there would arm ASSIGN over a card the barista never picked, and one stray tap
// would overwrite the slot. "Pick a card, then assign" is the whole point of the flow.
let selectedRecipeId = assignSlot != null ? null : sessionStorage.getItem('dye_editRecipeId');
let currentSort = 'recent';
// shotIndex.uses: shots per recipe id in the last 120 days. Unreadable -> {} and the use sorts keep list order.
let recipeUses = null;
// shotIndex.tail: the rows the Rating sort averages. Not an array -> null and Rating keeps list order.
let shotTail = null;
let searchQuery = '';

function matchesSearch(r) {
  if (!searchQuery) return true;
  const hay = [r.name, r.title, r.beanName, r.profileTitle].filter(Boolean).join(' ');
  return hay.toLowerCase().includes(searchQuery);
}

function sortRecipes(list, sortKey) {
  const s = [...list];
  const name = r => r.name || r.title || '';
  switch (sortKey) {
    case 'recent': s.sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0)); break;
    case 'oldest': s.sort((a, b) => new Date(a.capturedAt || 0) - new Date(b.capturedAt || 0)); break;
    case 'az':     s.sort((a, b) => name(a).localeCompare(name(b))); break;
    case 'za':     s.sort((a, b) => name(b).localeCompare(name(a))); break;
    case 'most-used':  return recipeUses ? sortRecipesByUse(s, recipeUses, 'desc') : s;
    case 'least-used': return recipeUses ? sortRecipesByUse(s, recipeUses, 'asc') : s;
    case 'rating':     return shotTail ? sortByMeanRating(s, shotTail, r => r.id, t => t.rid) : s;
  }
  return s;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function syncConfirmButton() {
  const btn = document.getElementById('dye-confirm-btn');
  if (!btn) return;
  const enabled = !!selectedRecipeId;
  btn.disabled = !enabled;
  btn.classList.toggle('dye-confirm-disabled', !enabled);
  btn.classList.toggle('dye-confirm-enabled', enabled);
}

function selectCard(card, recipe) {
  document.querySelectorAll('.dye-card').forEach(c => c.classList.remove('dye-card-selected'));
  card.classList.add('dye-card-selected');
  selectedRecipeId = recipe.id;
  syncConfirmButton();
}

// recipe-edit leaves by route, not history.back(): a picker round trip there pushes entries.
function openEditPage(recipeId) {
  if (recipeId) sessionStorage.setItem('dye_editRecipeId', recipeId); else sessionStorage.removeItem('dye_editRecipeId');
  // Carry assign mode back with us: recipe-edit returns by route and the query is otherwise
  // lost, which would drop the barista out of the Replace flow onto the dashboard.
  sessionStorage.setItem('dye_recipeEditBack', 'select-recipe' + assignQuery(assignSlot, returnTo));
  window.location.href = 'recipe-edit';
}

function renderCards() {
  const grid = document.getElementById('dye-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (selectedRecipeId && !recipesCache.some(r => r.id === selectedRecipeId)) selectedRecipeId = null;

  sortRecipes(recipesCache.filter(matchesSearch), currentSort).forEach(recipe => {
    const card = document.createElement('div');
    card.className = 'dye-card' + (recipe.id === selectedRecipeId ? ' dye-card-selected' : '');
    const title = recipe.name || recipe.title || 'Untitled recipe';
    const sub = [recipe.beanName, recipe.profileTitle].filter(Boolean).join(' · ') || recipe.subtitle || '';
    const foot = [recipe.stripSlot ? 'Recipe ' + recipe.stripSlot : ''].filter(Boolean).join(' · ');
    card.title = 'Long-press to edit';
    card.innerHTML =
      '<div class="dye-card-name">' + esc(title) + '</div>' +
      (sub ? '<div class="dye-card-sub">' + esc(sub) + '</div>' : '') +
      (foot ? '<div class="dye-card-date">' + esc(foot) + '</div>' : '');
    // First tap selects, a second tap on the selected card or a
    // 500ms long-press opens the editor, and attachCardLongPress swallows the click that ends it.
    card.addEventListener('click', () => {
      if (decideCardTap(selectedRecipeId, recipe.id) === 'edit') openEditPage(recipe.id);
      else selectCard(card, recipe);
    });
    attachCardLongPress(card, () => openEditPage(recipe.id));
    grid.appendChild(card);
  });

  // An empty library is just this card.
  const addCard = document.createElement('div');
  addCard.className = 'dye-card dye-card-add';
  addCard.innerHTML = '<span>ADD NEW RECIPE</span><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
  addCard.addEventListener('click', () => openEditPage(null));
  grid.appendChild(addCard);
  syncConfirmButton();
}

async function initSelectRecipe() {
  setupSortButtons(sort => { currentSort = sort; renderCards(); });
  const searchInput = document.getElementById('dye-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim().toLowerCase(); renderCards(); });
  }
  // Route out, not history.back(): coming back from recipe-edit puts that page behind us.
  document.getElementById('dye-cancel-btn')?.addEventListener('click', leaveSelectRecipe);
  if (assignSlot != null) {
    // Say which button the pick lands on; 'CONFIRM' alone reads like "apply this recipe".
    const btn = document.getElementById('dye-confirm-btn');
    if (btn) btn.innerHTML = '<span>ASSIGN TO ' + assignSlot + '</span>';
  }
  let assigning = false;
  document.getElementById('dye-confirm-btn')?.addEventListener('click', async () => {
    if (!selectedRecipeId) return;
    if (assignSlot != null) {
      if (assigning) return;   // a second tap before the write lands would write twice
      assigning = true;
      const btn = document.getElementById('dye-confirm-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span>ASSIGNING…</span>'; }
      // updateRecipe's takeSlot frees the slot on whoever held it (demoted to the library, not
      // deleted). showOnStreamlineDashboard goes true as well: a recipe cleared off the strip
      // keeps its old slot, and assigning it without this would leave the button blank.
      try {
        await updateRecipe(selectedRecipeId, { stripSlot: assignSlot, showOnStreamlineDashboard: true });
      } catch (e) {
        // Stay on the page rather than returning as if it worked -- and say so on the button,
        // which is the only surface these pages have (no toasts here).
        console.error('assign to strip slot failed:', e);
        assigning = false;
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>FAILED — TAP TO RETRY</span>'; }
        return;
      }
      leaveSelectRecipe();
      return;
    }
    sessionStorage.setItem('dye_selectedRecipeId', selectedRecipeId);   // the dashboard applies it on load
    window.location.href = 'dashboard';
  });
  try {
    const result = await getRecipes().catch(() => []);
    recipesCache = (Array.isArray(result) ? result : []).filter(r => r && r.id);
  } catch (e) { recipesCache = []; }
  try {
    const res = await fetch(API_BASE_URL + '/store/' + DYE_KV_NS + '/shotIndex');
    if (res.ok) { const idx = await res.json(); if (idx && idx.uses && typeof idx.uses === 'object') recipeUses = idx.uses; if (idx && Array.isArray(idx.tail)) shotTail = idx.tail; }
  } catch (e) { recipeUses = null; shotTail = null; }
  renderCards();
}

initSelectRecipe().catch(e => console.error('initSelectRecipe failed:', e));

// A page restored from bfcache never re-runs init, so a recipe saved in recipe-edit would be missing.
window.addEventListener('pageshow', function(e) { if (e.persisted) window.location.reload(); });
`;

export function renderSelectRecipePage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Select Recipe", content, dyePickerCss, [devApiScript, pageScript]),
  };
}
