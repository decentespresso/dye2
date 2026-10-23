import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { favCardTapScript } from "../utils/fav-card-tap";
import { sortSidebarHtml, sortSidebarScript, pickerHeaderHtml } from "../utils/shared-components";
import { gridStyles } from "./auto-favs";

// The recipe library. Same page structure and card grid as auto-favs (its styles are imported,
// not copied); the slot assignment lives in recipe-edit, not here.
const content = `
<div class="afav overflow-hidden flex-grow flex flex-col">
  <div class="afav-header">${pickerHeaderHtml('Select Recipe', 'CONFIRM')}</div>
  <div class="flex flex-1 overflow-hidden">
    ${sortSidebarHtml()}
    <div class="flex flex-col flex-1 overflow-hidden px-[20px]">
      <div id="dye-cards-container" class="flex-1 overflow-y-auto pt-[20px] pr-[20px]">
        <div id="dye-cards-grid" class="grid grid-cols-3 gap-[30px]"></div>
      </div>
    </div>
  </div>
</div>
`;

const pageScript = `
${sortSidebarScript}
${favCardTapScript}

let recipesCache = [];
// dye_editRecipeId is the preselected card: the dashboard sets it to the recipe being dialled
// in, and a card's edit sets it so coming back from recipe-edit lands on the same card.
let selectedRecipeId = sessionStorage.getItem('dye_editRecipeId');
let currentSort = 'recent';

// Recipes carry no use count, so the two "used" sorts the shared rail offers do nothing here.
document.querySelectorAll('#dye-sort-sidebar [data-sort$="used"]').forEach(b => b.remove());

function sortRecipes(list, sortKey) {
  const s = [...list];
  const name = r => r.name || r.title || '';
  switch (sortKey) {
    case 'recent': s.sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0)); break;
    case 'oldest': s.sort((a, b) => new Date(a.capturedAt || 0) - new Date(b.capturedAt || 0)); break;
    case 'az':     s.sort((a, b) => name(a).localeCompare(name(b))); break;
    case 'za':     s.sort((a, b) => name(b).localeCompare(name(a))); break;
  }
  return s;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function syncConfirmButton() {
  document.getElementById('dye-confirm-btn')?.classList.toggle('opacity-50', !selectedRecipeId);
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
  sessionStorage.setItem('dye_recipeEditBack', 'select-recipe');
  window.location.href = 'recipe-edit';
}

function renderCards() {
  const grid = document.getElementById('dye-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (selectedRecipeId && !recipesCache.some(r => r.id === selectedRecipeId)) selectedRecipeId = null;

  sortRecipes(recipesCache, currentSort).forEach(recipe => {
    const card = document.createElement('div');
    card.className = 'dye-card' + (recipe.id === selectedRecipeId ? ' dye-card-selected' : '');
    const title = recipe.name || recipe.title || 'Untitled recipe';
    const sub = [recipe.beanName, recipe.profileTitle].filter(Boolean).join(' · ') || recipe.subtitle || '';
    const foot = [recipe.stripSlot ? 'Recipe ' + recipe.stripSlot : '', recipe.suggested ? 'Suggested' : ''].filter(Boolean).join(' · ');
    card.innerHTML =
      '<div class="fav-card-head"><div class="fav-card-title">' + esc(title) + '</div>' +
      (sub ? '<div class="fav-card-sub">' + esc(sub) + '</div>' : '') + '</div>' +
      (foot ? '<hr class="dye-card-divider"><div class="fav-card-date">' + esc(foot) + '</div>' : '');
    // Same press handling as auto-favs: first tap selects, a second tap on the selected card or a
    // 500ms long-press opens the editor, and the click that ends a long-press is swallowed.
    card.addEventListener('click', () => {
      if (decideCardTap(selectedRecipeId, recipe.id) === 'edit') openEditPage(recipe.id);
      else selectCard(card, recipe);
    });
    let editTimer = null, longFired = false;
    const clearEdit = () => { if (editTimer) { clearTimeout(editTimer); editTimer = null; } };
    card.addEventListener('pointerdown', () => {
      longFired = false;
      clearEdit();
      editTimer = setTimeout(() => { editTimer = null; longFired = true; openEditPage(recipe.id); }, 500);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => card.addEventListener(ev, clearEdit));
    card.addEventListener('click', (e) => {
      if (longFired) { e.stopImmediatePropagation(); e.preventDefault(); longFired = false; }
    }, true);
    grid.appendChild(card);
  });

  // An empty library is just this card, as on auto-favs.
  const addCard = document.createElement('div');
  addCard.className = 'dye-card dye-card-add';
  addCard.innerHTML = '<span>ADD NEW RECIPE</span><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--mimoja-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
  addCard.addEventListener('click', () => openEditPage(null));
  grid.appendChild(addCard);
  syncConfirmButton();
}

async function initSelectRecipe() {
  setupSortButtons(sort => { currentSort = sort; renderCards(); });
  // Route out, not history.back(): coming back from recipe-edit puts that page behind us.
  document.getElementById('dye-cancel-btn')?.addEventListener('click', () => { window.location.href = 'dashboard'; });
  document.getElementById('dye-confirm-btn')?.addEventListener('click', () => {
    if (!selectedRecipeId) return;
    sessionStorage.setItem('dye_selectedRecipeId', selectedRecipeId);   // the dashboard applies it on load
    window.location.href = 'dashboard';
  });
  try {
    const result = await getRecipes().catch(() => []);
    recipesCache = (Array.isArray(result) ? result : []).filter(r => r && r.id);
  } catch (e) { recipesCache = []; }
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
    body: devPageShell("Select Recipe", content, gridStyles, [devApiScript, pageScript]),
  };
}
