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

console.log("dashboard-open tests passed");
