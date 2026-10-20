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

console.log("dashboard-open tests passed");
