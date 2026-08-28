/**
 * Browser-side API client for dev-style pages.
 * Exported as a string to be inlined as a <script> block in served HTML.
 * Covers all functions used by dye.js and dyeDashboard.js.
 */
export const devApiScript = `
const API_BASE_URL = '/api/v1';

async function getBeans(includeArchived = false) {
  const params = includeArchived ? '?includeArchived=true' : '';
  const res = await fetch(API_BASE_URL + '/beans' + params);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getBeanBatches(beanId, includeArchived = false) {
  const params = includeArchived ? '?includeArchived=true' : '';
  const res = await fetch(API_BASE_URL + '/beans/' + beanId + '/batches' + params);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getBean(id) {
  const res = await fetch(API_BASE_URL + '/beans/' + id);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function createBean(data) {
  const res = await fetch(API_BASE_URL + '/beans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function updateBean(id, data) {
  const res = await fetch(API_BASE_URL + '/beans/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function createBeanBatch(beanId, data) {
  const res = await fetch(API_BASE_URL + '/beans/' + beanId + '/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function updateBeanBatch(batchId, data) {
  const res = await fetch(API_BASE_URL + '/bean-batches/' + batchId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getGrinders(includeArchived = false) {
  const params = includeArchived ? '?includeArchived=true' : '';
  const res = await fetch(API_BASE_URL + '/grinders' + params);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function createGrinder(data) {
  const res = await fetch(API_BASE_URL + '/grinders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function updateGrinder(id, data) {
  const res = await fetch(API_BASE_URL + '/grinders/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getWorkflow() {
  const res = await fetch(API_BASE_URL + '/workflow');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function updateWorkflow(data) {
  const res = await fetch(API_BASE_URL + '/workflow', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getShots(opts = {}) {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  if (opts.order) params.set('order', opts.order);
  if (opts.grinderId) params.set('grinderId', opts.grinderId);
  if (opts.beanId) params.set('beanId', opts.beanId);
  if (opts.beanBatchId) params.set('beanBatchId', opts.beanBatchId);
  if (opts.coffeeName) params.set('coffeeName', opts.coffeeName);
  if (opts.coffeeRoaster) params.set('coffeeRoaster', opts.coffeeRoaster);
  if (opts.search) params.set('search', opts.search);
  const query = params.toString() ? '?' + params.toString() : '';
  const res = await fetch(API_BASE_URL + '/shots' + query);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getLatestShot() {
  const res = await fetch(API_BASE_URL + '/shots/latest');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getShot(id) {
  const res = await fetch(API_BASE_URL + '/shots/' + id);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function deleteShot(id) {
  const res = await fetch(API_BASE_URL + '/shots/' + id, { method: 'DELETE' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
}

async function updateShot(id, data) {
  const res = await fetch(API_BASE_URL + '/shots/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/* ── DYE2 plugin KV store: auto-favourites + recipes ──────────────────────────
   The bridge has no /recipes or /auto-favourites REST resource. DYE2 persists each
   collection as a JSON array under one key in the generic plugin KV store, which the
   Streamline dashboard also reads to render its P/F/R strip.
   ponytail: whole-array rewrite per mutation — fine for one tablet's dozens of items;
   move to key-per-item if it ever grows. */
const DYE_KV_NS = 'dye2.reaplugin';

async function kvGetArray(key) {
  const res = await fetch(API_BASE_URL + '/store/' + DYE_KV_NS + '/' + key);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const val = await res.json();
  return Array.isArray(val) ? val : [];
}

async function kvSetArray(key, arr) {
  const res = await fetch(API_BASE_URL + '/store/' + DYE_KV_NS + '/' + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arr),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
}

function kvUpsert(arr, item) {
  const i = arr.findIndex(x => x && x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
  return arr;
}

function newId(prefix) {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : prefix + '-' + Date.now();
}

/* ── Filter baskets: same "bridge has no equipment resource" situation as
   recipes/auto-favourites (see bc-map.ts bcMapEquipment) — parked in the KV store. */
async function getBaskets() { return kvGetArray('baskets'); }

async function createBasket(data) {
  const arr = await kvGetArray('baskets');
  const item = { ...data, id: newId('bskt'), createdAt: new Date().toISOString() };
  arr.push(item);
  await kvSetArray('baskets', arr);
  return item;
}

async function updateBasket(id, data) {
  const arr = await kvGetArray('baskets');
  const existing = arr.find(x => x && x.id === id);
  const item = { ...data, id, createdAt: (existing && existing.createdAt) || new Date().toISOString() };
  kvUpsert(arr, item);
  await kvSetArray('baskets', arr);
  return item;
}

/* ── Denormalised fields written for the Streamline dashboard (read-only consumer).
   Both builders return a ready-to-PUT WorkflowRequest body { context, profile? }.
   They mirror dashboard.ts applyAutoFavourite/applyRecipe, but build a fresh ctx
   and RETURN it instead of mutating currentWorkflow. Legacy fields are kept; these
   are additive and consumers MUST treat them as optional. See KV_CONTRACT.md. */
function buildFavouriteWorkflow(fav) {
  const snp = (fav && fav.snapshot) || {};
  const mask = (fav && fav.copyMask) || {};
  const on = k => mask[k] !== false;
  const ctx = {};
  const wf = { context: ctx };
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
  if (on('basket')) {
    if (snp.basketId)   ctx.extras = { ...(ctx.extras || {}), basketId: snp.basketId };
    if (snp.basketName) ctx.extras = { ...(ctx.extras || {}), basketName: snp.basketName };
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
  if (on('profile') && (snp.profileId || snp.profileTitle)) {
    wf.profile = { id: snp.profileId, title: snp.profileTitle };
  }
  return wf;
}

function buildRecipeWorkflow(recipe) {
  const dv = (recipe && recipe.dashboardVariables) || {};
  const ctx = {};
  const wf = { context: ctx };
  if (dv.dose != null)  ctx.targetDoseWeight = dv.dose;
  if (dv.drink != null) ctx.targetYield = dv.drink;
  else if (dv.ratio != null && dv.dose != null) ctx.targetYield = Math.round(dv.dose * dv.ratio * 10) / 10;
  if (dv.grind != null) ctx.grinderSetting = String(dv.grind);
  if (dv.rpm != null)   ctx.extras = { ...(ctx.extras || {}), rpm: dv.rpm };
  if (dv.grinderId) ctx.grinderId = dv.grinderId;
  if (dv.basketId)   ctx.extras = { ...(ctx.extras || {}), basketId: dv.basketId };
  if (dv.basketName) ctx.extras = { ...(ctx.extras || {}), basketName: dv.basketName };
  if (recipe && recipe.beanName) ctx.coffeeName = recipe.beanName;
  if (recipe && recipe.barista) ctx.baristaName = recipe.barista;
  if (recipe && recipe.drinker) ctx.drinkerName = recipe.drinker;
  if (recipe && (recipe.profileId || recipe.profileTitle)) {
    wf.profile = { id: recipe.profileId, title: recipe.profileTitle };
  }
  return wf;
}

function favSubtitle(fav) {
  const snp = (fav && fav.snapshot) || {};
  return [snp.coffeeRoaster, snp.coffeeName].filter(Boolean).join(' · ') || (fav && fav.beverage) || '';
}

function recipeSubtitle(r) {
  return (r && r.beanName) || (r && r.beverage) || '';
}

// Recipes (R mode)
async function getRecipes() { return kvGetArray('recipes'); }

async function updateRecipe(id, data) {
  const arr = await kvGetArray('recipes');
  const item = { ...data, id, capturedAt: new Date().toISOString() };
  item.title = item.name || ('Recipe ' + id);
  item.subtitle = recipeSubtitle(item);
  item.workflow = buildRecipeWorkflow(item);
  kvUpsert(arr, item);
  await kvSetArray('recipes', arr);
  return item;
}

// Auto-favourites (F mode)
async function getAutoFavourites() { return kvGetArray('autoFavourites'); }

async function getAutoFavourite(id) {
  const arr = await kvGetArray('autoFavourites');
  return arr.find(x => x && x.id === id) || null;
}

async function createAutoFavourite(data) {
  const arr = await kvGetArray('autoFavourites');
  const fav = { ...data, id: newId('af'), capturedAt: new Date().toISOString() };
  fav.subtitle = favSubtitle(fav);
  fav.workflow = buildFavouriteWorkflow(fav);
  arr.push(fav);
  await kvSetArray('autoFavourites', arr);
  return fav;
}

async function updateAutoFavourite(id, data) {
  const arr = await kvGetArray('autoFavourites');
  const existing = arr.find(x => x && x.id === id);
  const item = { ...data, id, capturedAt: data.capturedAt ?? (existing && existing.capturedAt) ?? new Date().toISOString() };
  item.subtitle = favSubtitle(item);
  item.workflow = buildFavouriteWorkflow(item);
  kvUpsert(arr, item);
  await kvSetArray('autoFavourites', arr);
  return item;
}

async function getBeanBatch(batchId) {
  const res = await fetch(API_BASE_URL + '/bean-batches/' + batchId);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getProfiles(opts = {}) {
  const params = new URLSearchParams();
  if (opts.visibility) params.set('visibility', opts.visibility);
  if (opts.includeHidden) params.set('includeHidden', 'true');
  const query = params.toString() ? '?' + params.toString() : '';
  const res = await fetch(API_BASE_URL + '/profiles' + query);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/* ── Visualizer plugin helpers ────────────────────────────────────────────── */

async function getVisualizerSettings() {
  const res = await fetch('/api/v1/plugins/visualizer.reaplugin/settings');
  if (!res.ok) return null;
  return res.json();
}

async function verifyVisualizerCredentials(username, password) {
  const res = await fetch('/api/v1/plugins/visualizer.reaplugin/verifyCredentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.valid;
}

async function saveVisualizerSettings(username, password, autoUpload, minDuration) {
  const res = await fetch('/api/v1/plugins/visualizer.reaplugin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Username: username, Password: password, AutoUpload: autoUpload, LengthThreshold: minDuration }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function uploadShotToVisualizer(shotId) {
  const res = await fetch('/api/v1/plugins/visualizer.reaplugin/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shotId }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
`;
