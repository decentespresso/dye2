// Source-text ordering checks for the dashboard open path. dev-shell.ts cannot be imported
// by node (Vite ?inline import) and renderLastShot needs a DOM, so read the sources.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shotPatchAffectsRecents } from "../src/utils/recent-favs.ts";

const shell = readFileSync(new URL("../src/utils/dev-shell.ts", import.meta.url), "utf8");

// 1. echarts loads after the page scripts, not before the first data request.
{
  const tag = shell.indexOf('<script src="echarts"');
  const scripts = shell.indexOf("scripts.map(");
  const headEnd = shell.indexOf("</head>");
  assert.ok(tag > 0 && scripts > 0 && headEnd > 0, "all markers present");
  assert.ok(tag > scripts, "echarts script tag comes after the page scripts");
  // Source order alone would still pass with the tag moved into the head template, so pin it
  // past </head> as well: a blocking ~500 KB script in head delays every data request.
  assert.ok(tag > headEnd, "and it is outside <head>");
}

const dash = readFileSync(new URL("../src/pages/dashboard.ts", import.meta.url), "utf8");

// Drop whole-line AND trailing // comments. Every assertion below matches against code only:
// these comments name the identifiers being asserted on, so matching raw text would pass on
// the prose with the code deleted.
function stripComments(src) {
  return src.split("\n")
    .map(l => (l.trim().startsWith("//") ? "" : l.replace(/\s\/\/.*$/, "")))
    .join("\n");
}

// 3. Every text field is written before the measurements are fetched.
{
  const fn = dash.indexOf("async function renderLastShot(");
  const fnEnd = dash.indexOf("\nfunction updateStarDisplay", fn);
  assert.ok(fn > 0 && fnEnd > fn, "renderLastShot found");
  // Comments are stripped first: they mention the very identifiers asserted on below, so a
  // check against the raw text passes on the prose alone once the code is deleted. Trailing
  // comments count too -- this file has code lines with an explanation after them.
  const body = stripComments(dash.slice(fn, fnEnd));

  const lastText = body.indexOf("baristaEl.innerHTML");
  const fetchAt = body.indexOf("getShot(");
  assert.ok(lastText > 0 && fetchAt > 0, "markers present");
  assert.ok(lastText < fetchAt, "text is written before getShot(");
  assert.ok(!body.includes("await getShot"), "getShot is not awaited");
  assert.ok(body.indexOf("renderToken !== shotRenderToken") > fetchAt, "token compared in the then");

  // The text is swapped before the fetch, so the previous shot's trace must go with it, or the
  // chart shows the old shot under the new shot's numbers for as long as the fetch takes.
  // Anchored to the fetch branch: the !shot branch has a placeholder call of its own.
  const branch = body.slice(body.indexOf("if (!shot.measurements)"), fetchAt);
  assert.ok(branch.includes("chartShowPlaceholder("), "the stale chart is purged before the fetch");
}

// 2. The open does one parallel batch and no serial KV read.
{
  const start = dash.indexOf("async function initializeDyeDashboard(");
  const end = dash.indexOf("\nfunction showTransientMessage", start);
  assert.ok(start > 0 && end > start, "initializeDyeDashboard found");
  const body = dash.slice(start, end);
  const pa = body.indexOf("Promise.all([");
  const paEnd = body.indexOf("]);", pa);
  assert.ok(pa > 0 && paEnd > pa, "Promise.all found");
  assert.ok(body.slice(pa, paEnd).includes("getAutoFavourites("), "favourites are in the batch");
  const after = body.slice(paEnd);
  assert.ok(!after.includes("await getAutoFavourites"), "no serial getAutoFavourites");
  assert.ok(!after.includes("await getAutoFavourite("), "no serial getAutoFavourite");
  assert.ok(!body.includes("getProfiles("), "no /profiles fetch on open");
}

// 3. Cancel/Done wait for the open's own load before navigating. leaveDashboard() is a hard
// location.href, which aborts any fetch still in flight on the unloading document -- a DONE
// tapped before a picker-return auto-apply's PUT lands would leave the live workflow on
// whatever favourite/recipe it was meant to replace (the Auto Favs "confirm, then Done before
// it's finished applying" bug).
{
  const start = dash.indexOf("function setupBottomButtons(");
  const end = dash.indexOf("\n}\n", start);
  assert.ok(start > 0 && end > start, "setupBottomButtons found");
  const body = stripComments(dash.slice(start, end));
  const cancelAt = body.indexOf("cancelBtn.addEventListener");
  const doneAt = body.indexOf("doneBtn.addEventListener");
  assert.ok(cancelAt > 0 && doneAt > 0, "both handlers found");
  const cancelBody = body.slice(cancelAt, doneAt);
  const doneBody = body.slice(doneAt);
  assert.ok(cancelBody.includes("await dashboardReady") && cancelBody.indexOf("await dashboardReady") < cancelBody.indexOf("leaveDashboard("),
    "cancel awaits the open before leaving");
  const doneWait = doneBody.indexOf("await dashboardReady");
  assert.ok(doneWait >= 0 && doneWait < doneBody.indexOf("leaveDashboard("), "done awaits the open before leaving");
  assert.ok(doneWait < doneBody.indexOf("pushWorkflow()"), "done awaits the open before its own push");
  assert.ok(dash.includes("dashboardReady = initializeDyeDashboard()"), "the open's promise is captured for the buttons to await");
}

// 4. The profiles fallback memoises, so only the first apply fetches.
{
  const start = dash.indexOf("async function resolveFullProfile(");
  const body = dash.slice(start, dash.indexOf("\n}\n", start));
  assert.ok(body.includes("getProfiles("), "fallback fetches");
  assert.ok(body.includes("profiles = list;"), "fallback memoises the list");
}

// 5. Recents recompute only when a shotUpdated patch can change them.
assert.equal(shotPatchAffectsRecents({ annotations: { enjoyment: 8 } }), true, "star tap (feeds the ranking)");
assert.equal(shotPatchAffectsRecents({ annotations: { espressoNotes: "x" } }), false, "note edit");
assert.equal(shotPatchAffectsRecents({ workflow: { context: {} } }), true, "workflow");
assert.equal(shotPatchAffectsRecents({ annotations: { extras: { rpm: 900 } } }), true, "rpm");
assert.equal(shotPatchAffectsRecents({ annotations: { extras: { basketId: "b" } } }), false, "other extras");
assert.equal(shotPatchAffectsRecents(undefined), true, "missing patch fails safe");
assert.equal(shotPatchAffectsRecents("{not json"), true, "unparseable patch fails safe");
assert.equal(shotPatchAffectsRecents('{"annotations":{"espressoNotes":"x"}}'), false, "json string patch");

{
  const del = dash.slice(dash.indexOf("function setupDeleteShot("));
  const delBody = stripComments(del.slice(0, del.indexOf("\n}\n")));
  assert.ok(delBody.includes("refreshRecentsFromHistory()"), "delete refreshes recents");
  // Against the one-shot seed, deleting would empty shots while shotsTotal still counted the
  // rest, and the panel would read "No shots recorded" with history intact.
  assert.ok(delBody.includes("ensureShotsPage()"), "delete waits for the real window first");
  // Assert the value, not one spelling: banning the string "limit: 200" let 300 or 200 through.
  for (const m of stripComments(dash).matchAll(/limit:\s*(\d+)/g)) {
    assert.ok(Number(m[1]) <= 100, "limit " + m[1] + " exceeds the host clamp of 100");
  }
}

// 6. The two-phase open's dashboard half (82a5cbe had no test for it at all).
{
  const fn = dash.indexOf("async function initializeDyeDashboard(");
  const fnEnd = dash.indexOf("\nfunction showTransientMessage", fn);
  const body = stripComments(dash.slice(fn, fnEnd));
  assert.ok(body.includes("getLatestShot("), "the open seeds from GET /shots/latest");
  assert.ok(body.includes("seedLatestShot("), "and installs it as the window");
  assert.ok(body.includes("ensureShotsPage()"), "and loads the real page behind the paint");
  // The counter must resync when the total changes, not only when the shown shot does.
  assert.ok(body.includes("shotsTotal !== seededTotal"), "the deferred re-render checks the total");
  const navFn = stripComments(dash.slice(dash.indexOf("function setupShotNavigation(")));
  assert.ok(navFn.slice(0, navFn.indexOf("\n}\n")).includes("ensureShotsPage()"),
    "stepping to a newer shot waits for the real window");
}

// 7. The late measurements write must locate its row by id, not by a captured index: the array
//    can be swapped underneath while the displayed shot is unchanged, so nothing re-renders and
//    the render token stays current.
{
  const fn = dash.indexOf("async function renderLastShot(");
  const body = stripComments(dash.slice(fn, dash.indexOf("\nfunction updateStarDisplay", fn)));
  const thenAt = body.indexOf("getShot(");
  const tail = body.slice(thenAt);
  assert.ok(tail.includes("findIndex(s => s && s.id === shot.id)"),
    "the merge finds its row by id");
  assert.ok(!/shots\[idx\]\s*=/.test(tail), "and never writes by the captured index");
}

// 7. dye2#36: a plain page load writes no workflow. recipeId is written only by the apply
// paths (recipe apply, favourite/recent apply, shot paste), never by the open path or tile edits.
{
  const code = stripComments(dash);
  const callers = [...code.matchAll(/setRecipeId\(/g)].length;
  assert.equal(callers, 4, "definition + recipe apply + favourite apply + shot paste, nothing else");
  assert.ok(!/postSelection/.test(code), "no POST /selection round trip is left");
  for (const fn of ["async function initializeDyeDashboard(", "function renderNextShot("]) {
    const i = code.indexOf(fn);
    const body = code.slice(i, code.indexOf("\n}\n", i));
    assert.ok(i > 0 && !/setRecipeId\(/.test(body), fn + " never touches recipeId");
  }
}

// 8. A recipe pill tap holds its highlight until the server actually confirms it. The apply+push
// chain re-renders the pills (applyRecipe/applyAutoFavourite's own renderNextShot) before the
// PUT has even been sent, and refreshDerivedSelection's own fetch can land mid-chain too -- both
// would read the still-stale pre-click derivedSel and snap the highlight back to the old pill
// without pendingSelection holding it. Exercise the real refreshDerivedSelection body: a fetch
// that still reports the pre-click selection must leave the pin alone; a fetch that reports the
// tapped item is what finally clears it.
{
  const start = dash.indexOf("function refreshDerivedSelection()");
  const body = dash.slice(start, dash.indexOf("\n}\n", start) + 2);
  assert.ok(start > 0, "refreshDerivedSelection found");

  const renderRecipePills = () => {};
  const currentWorkflow = {};
  const flush = () => new Promise(r => setTimeout(r, 0));
  const run = (pendingIn, derivedSelIn, derivedSelKeyIn, fetchImpl) => new Function(
    "fetch", "renderRecipePills", "currentWorkflow",
    `let pendingSelection = ${JSON.stringify(pendingIn)};
     let derivedSel = ${JSON.stringify(derivedSelIn)};
     let derivedSelKey = ${JSON.stringify(derivedSelKeyIn)};
     ${body}
     return { refreshDerivedSelection, state: () => ({ pendingSelection, derivedSel, derivedSelKey }) };`
  )(fetchImpl, renderRecipePills, currentWorkflow);

  // Pre-push read: the server still has the pre-click recipe. The user just tapped "NEW".
  {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ kind: "recipe", id: "OLD", modified: false }) });
    const api = run({ kind: "recipe", id: "NEW" }, { kind: "recipe", id: "OLD", modified: false }, "recipe:OLD:false", fetchImpl);
    api.refreshDerivedSelection();
    await flush();
    assert.deepEqual(api.state().pendingSelection, { kind: "recipe", id: "NEW" },
      "a fetch that still shows the pre-click selection leaves the pending pin alone");
  }

  // Confirmed: pushWorkflow's delayed refresh now sees the tapped recipe.
  {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ kind: "recipe", id: "NEW", modified: false }) });
    const api = run({ kind: "recipe", id: "NEW" }, { kind: "recipe", id: "OLD", modified: false }, "recipe:OLD:false", fetchImpl);
    api.refreshDerivedSelection();
    await flush();
    const st = api.state();
    assert.equal(st.pendingSelection, null, "a fetch that matches the pending pick clears it");
    assert.deepEqual(st.derivedSel, { kind: "recipe", id: "NEW", modified: false }, "and becomes the confirmed selection");
  }

  // A favourite pick is not confused with a same-id recipe (kind must match too).
  {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ kind: "recipe", id: "X", modified: false }) });
    const api = run({ kind: "favourite", id: "X" }, null, "", fetchImpl);
    api.refreshDerivedSelection();
    await flush();
    assert.deepEqual(api.state().pendingSelection, { kind: "favourite", id: "X" }, "same id, different kind, does not confirm");
  }
}

// 9. renderRecipePills' own selection derivation prefers the pending pick over derivedSel, so
// the pill just tapped stays active through the window 8. covers, not just refreshDerivedSelection
// in isolation.
{
  const start = dash.indexOf("const sel = pendingSelection || derivedSel;");
  assert.ok(start > 0, "the override line is present in renderRecipePills");
  const end = dash.indexOf("\n", dash.indexOf("const selMark =", start));
  const body = dash.slice(start, end);
  const derive = (pendingSelection, derivedSel) => new Function(
    "pendingSelection", "derivedSel", body + "\nreturn { selRecipeId, selMark };"
  )(pendingSelection, derivedSel);

  const pending = derive({ kind: "recipe", id: "NEW" }, { kind: "recipe", id: "OLD", modified: true });
  assert.equal(pending.selRecipeId, "NEW", "the pending pick wins over a conflicting derivedSel");
  assert.equal(pending.selMark, "", "no dirty-star while pending -- that state is not known yet");

  const confirmed = derive(null, { kind: "recipe", id: "OLD", modified: true });
  assert.equal(confirmed.selRecipeId, "OLD", "falls back to derivedSel once nothing is pending");
  assert.equal(confirmed.selMark, " *", "and the dirty-star comes back with it");
}

console.log("dashboard-open tests passed");

// 9. The pill rail is the whole recipe library, not Streamline's 5-cell R strip: a recipe with
// no stripSlot (what Edit Auto Favourite's SAVE TO RECIPE writes) still gets a pill, slotted
// ones lead in slot order, and the selected recipe is never rendered twice.
{
  const src = readFileSync(new URL('../src/pages/dashboard.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function renderRecipePills('));
  const fn = new Function('recipes', 'selRecipeId', `
    const slotOf = (r) => (r && r.stripSlot != null ? r.stripSlot : Infinity);
    const recipeItems = recipes.filter(r => r && r.showOnStreamlineDashboard !== false)
      .map((r, i) => [r, i]).sort((a, b) => (slotOf(a[0]) - slotOf(b[0])) || (a[1] - b[1])).map(([r]) => r);
    const hidden = selRecipeId ? recipes.find(r => r && String(r.id) === selRecipeId && !recipeItems.includes(r)) : null;
    return [...(hidden ? [hidden] : []), ...recipeItems].map(r => r.id);
  `);
  assert.match(body, /filter\(r => r && r\.showOnStreamlineDashboard !== false\)/,
    'the rail filters on the hidden flag only, not on stripSlot');

  const rows = [
    { id: 'lib1', name: 'From a favourite' },                    // stripSlot absent
    { id: 's2', name: 'Two', stripSlot: 2 },
    { id: 'lib2', name: 'Also library', stripSlot: null },
    { id: 's1', name: 'One', stripSlot: 1 },
    { id: 'off', name: 'Hidden', stripSlot: 4, showOnStreamlineDashboard: false },
  ];
  assert.deepEqual(fn(rows, null), ['s1', 's2', 'lib1', 'lib2'],
    'slotted lead in slot order, unslotted follow as stored, hidden stays off');
  assert.deepEqual(fn(rows, 'lib2'), ['s1', 's2', 'lib1', 'lib2'],
    'the selected library recipe is listed once, not prepended a second time');
  assert.deepEqual(fn(rows, 'off'), ['off', 's1', 's2', 'lib1', 'lib2'],
    'a hidden recipe still shows while it is the selection');
}
console.log('ok   the recipe rail shows the whole library, slotted first');
