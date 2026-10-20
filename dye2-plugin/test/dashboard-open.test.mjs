// Source-text ordering checks for the dashboard open path. dev-shell.ts cannot be imported
// by node (Vite ?inline import) and renderLastShot needs a DOM, so read the sources.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync(new URL("../src/utils/dev-shell.ts", import.meta.url), "utf8");

// 1. Plotly loads after the page scripts, not before the first data request.
{
  const tag = shell.indexOf('<script src="plotly"');
  const scripts = shell.indexOf("scripts.map(");
  assert.ok(tag > 0 && scripts > 0, "both markers present");
  assert.ok(tag > scripts, "plotly script tag must come after scripts.map(");
}

const dash = readFileSync(new URL("../src/pages/dashboard.ts", import.meta.url), "utf8");

// 3. Every text field is written before the measurements are fetched.
{
  const start = dash.indexOf("async function renderLastShot(");
  const end = dash.indexOf("\nfunction updateStarDisplay", start);
  assert.ok(start > 0 && end > start, "renderLastShot found");
  const body = dash.slice(start, end);
  const lastText = body.indexOf("baristaEl.innerHTML");
  const fetchAt = body.indexOf("getShot(");
  assert.ok(lastText > 0 && fetchAt > 0, "markers present");
  assert.ok(lastText < fetchAt, "text is written before getShot(");
  assert.ok(!body.includes("await getShot"), "getShot is not awaited");
  assert.ok(body.indexOf("renderToken !== shotRenderToken") > fetchAt, "token compared in the then");
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

console.log("dashboard-open tests passed");
