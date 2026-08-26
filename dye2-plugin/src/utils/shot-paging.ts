/**
 * Shot history paging for the dashboard, as a browser-side script string.
 *
 * History is fetched from the bridge one page at a time, and "Same Beans" is a bridge-side
 * filter rather than a filter over the loaded page — filtering locally made it mean "same
 * beans among the last 50", which reads as missing shots.
 *
 * Inlined before the dashboard's own script, which shares these bindings (top-level `let`
 * in a classic script is visible to the scripts that follow it) and owns rendering.
 * Depends on getShots() from dev-api.
 */
export const shotPagingScript = `
const SHOT_PAGE = 50;
let shots = [];              // the loaded window of history, newest first
let shotsTotal = 0;          // how many the bridge holds for the current filter
let currentShotIndex = 0;
let sameBeanFilter = false;
let shotFilter = null;       // {coffeeName, coffeeRoaster} while Same Beans is on
let loadingShots = false;

async function fetchShotPage(offset) {
  const opts = { limit: SHOT_PAGE, offset: offset, order: 'desc' };
  if (shotFilter) Object.assign(opts, shotFilter);
  const res = await getShots(opts).catch(() => null);
  const items = (res && res.items) ? res.items : (Array.isArray(res) ? res : []);
  const total = (res && typeof res.total === 'number') ? res.total : offset + items.length;
  return { items: items, total: total };
}

async function loadShots(filter) {
  shotFilter = filter || null;
  const page = await fetchShotPage(0);
  shots = page.items;
  shotsTotal = page.total;
  currentShotIndex = 0;
}

// Only ever called when navigation actually runs off the end of what is loaded.
async function loadMoreShots() {
  if (loadingShots || shots.length >= shotsTotal) return false;
  loadingShots = true;
  try {
    const page = await fetchShotPage(shots.length);
    shotsTotal = page.total;
    if (!page.items.length) return false;
    shots = shots.concat(page.items);
    return true;
  } finally {
    loadingShots = false;
  }
}

// Step one shot older. Wrapping is the last resort: step off the loaded window and the next
// page is fetched first, so history is limited by what the machine stored, not by SHOT_PAGE.
async function stepToOlderShot() {
  if (currentShotIndex + 1 >= shots.length) await loadMoreShots();
  if (shots.length < 2) return false;
  currentShotIndex = (currentShotIndex + 1) % shots.length;
  return true;
}
`;
