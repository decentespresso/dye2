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
 *
 * SHOT_PAGE is deliberately modest. The bridge's shots query selects the measurements
 * blob for every row and decodes it before discarding it (shot_dao.dart
 * getShotsPaginated -> shot_mapper.dart fromRow, thrown away at shots_handler.dart), so
 * the cost of a page is linear in its size: measured against a local bridge, limit 50
 * costs about 60ms and 156KB, limit 20 about 21ms and 60KB. Paging deeper pulls another
 * page on demand, so a smaller page costs round trips only for someone who walks far
 * back through history, and those are cheap for the same reason.
 */
export const shotPagingScript = `
const SHOT_PAGE = 20;   // see the note above: the bridge's cost is linear in this
let shots = [];              // the loaded window of history, newest first
let shotsTotal = 0;          // how many the bridge holds for the current filter
let currentShotIndex = 0;
let sameBeanFilter = false;
let shotFilter = null;       // {coffeeName, coffeeRoaster} while Same Beans is on
let loadingShots = false;
let shotsPageLoaded = false; // has a real page replaced the one-shot seed?
let shotsPagePromise = null;
let shotsGen = 0;            // bumped by anything that installs a new window

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
  const prevShots = shots;
  const page = await fetchShotPage(0);
  // Carry forward measurements already fetched for any shot that reappears in the new page
  // (search/Same-Beans still lists the same underlying shots) -- same reasoning as the single
  // seeded shot in ensureShotsPage, just over however many of these already had the blob.
  const cached = new Map(prevShots.filter(s => s && s.measurements).map(s => [s.id, s.measurements]));
  shots = cached.size
    ? page.items.map(s => cached.has(s.id) ? Object.assign({}, s, { measurements: cached.get(s.id) }) : s)
    : page.items;
  shotsTotal = page.total;
  currentShotIndex = 0;
  // A filtered view is always a real page: GET /shots/latest takes no filter parameters.
  shotsPageLoaded = true;
  shotsPagePromise = null;
  shotsGen++;
}

// Seed the newest shot from GET /shots/latest, whose response is the same shape as a list row
// (the bridge serves both from toJsonWithoutMeasurements), so rendering needs no special case.
// total comes from a separate limit=1 read, whose count is a plain SQL COUNT on the bridge.
function seedLatestShot(shot, total) {
  // The nav buttons are wired before the open's reads land, so a tap can already have started
  // or finished a real page. Rewinding to one shot then would leave currentShotIndex pointing
  // at a different shot than the one on screen, and the star, visualizer upload, edit-shot and
  // delete handlers all act on shots[currentShotIndex].
  if (shotsPageLoaded || shotsPagePromise) return;
  shotsGen++;
  shots = shot ? [shot] : [];
  shotsTotal = typeof total === 'number' ? total : shots.length;
  currentShotIndex = 0;
  shotsPageLoaded = false;
  shotsPagePromise = null;
}

// Everything that needs more than the seeded shot waits here: navigation, delete, anything
// reading a window of history. Single-flight, so concurrent callers share the one request.
// The bridge decodes and discards a measurements blob per row, so this is the expensive read
// and it is deliberately off the open's critical path.
async function ensureShotsPage() {
  if (shotsPageLoaded) return true;
  if (!shotsPagePromise) {
    const gen = shotsGen;
    // The array, not the element: renderLastShot merges measurements by replacing the slot
    // (shots[idx] = ...), so reading the captured element would never see them.
    const prevShots = shots;
    const seededId = shots.length ? shots[0].id : null;
    shotsPagePromise = (async () => {
      const page = await fetchShotPage(0);
      // A filtered load (search, Same Beans) may have installed its own window while this
      // unfiltered page was in flight. Landing on top of it would show unfiltered history
      // under a filter label, with shotsTotal the unfiltered total.
      if (gen !== shotsGen) return;
      // fetchShotPage swallows errors into an empty page, which is indistinguishable from an
      // empty history. We know a shot exists when there is a seed, so keep it and stay
      // unloaded rather than blanking the panel on a transient failure; the next caller retries.
      if (!page.items.length && seededId) return;
      shots = page.items;
      shotsTotal = page.total;
      // Stay on the shot already on screen. It is index 0 in both views unless a shot was
      // stored between the two reads, in which case index 0 is the newer one, which is what
      // "Last Shot" means anyway.
      const at = seededId ? shots.findIndex(s => s && s.id === seededId) : -1;
      currentShotIndex = at >= 0 ? at : 0;
      // The seed may already hold the measurements the chart fetched. A page row never does, so
      // without this the swap throws them away and the next render fetches them again.
      const prev = seededId ? prevShots.find(x => x && x.id === seededId) : null;
      if (at >= 0 && prev && prev.measurements) {
        shots[at] = Object.assign({}, shots[at], { measurements: prev.measurements });
      }
      shotsPageLoaded = true;
    })().catch(e => { console.warn('shot page load failed', e); })
        .then(() => { shotsPagePromise = null; });
  }
  await shotsPagePromise;
  return shotsPageLoaded;
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
  // Before any loadMoreShots: with only the seed, shots.length is 1 and shotsTotal the real
  // total, so loadMoreShots would page from offset 1 on top of the seed instead of loading
  // page zero cleanly.
  if (!(await ensureShotsPage())) return false;
  if (currentShotIndex + 1 >= shots.length) await loadMoreShots();
  if (shots.length < 2) return false;
  currentShotIndex = (currentShotIndex + 1) % shots.length;
  return true;
}
`;
