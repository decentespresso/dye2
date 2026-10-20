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

console.log("dashboard-open tests passed");
