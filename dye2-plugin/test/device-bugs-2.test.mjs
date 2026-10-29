// Device bugs 1 and 3: chart sizing diagnostics and the dashboard return trip. Browser strings
// are run in a vm against fakes; nothing touches a bridge.
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { chartScript } from "../src/utils/chart.ts";

// --- chart: zero size warns, mismatched size resizes -------------------------------------
function runChart({ fullW, fullH, clientW, clientH, rectW = 0, rectH = 0, scale }) {
  const warns = [], resizes = [], rafs = [];
  const el = {
    id: "plotly-chart", clientWidth: clientW, clientHeight: clientH,
    getBoundingClientRect: () => ({ width: rectW, height: rectH }),
    querySelector: () => null,
  };
  const chart = {
    disposed: false,
    isDisposed() { return this.disposed; },
    dispose() { this.disposed = true; },
    getWidth: () => fullW,
    getHeight: () => fullH,
    setOption() {},
    resize: opts => resizes.push(opts),
  };
  let registered = null;
  const win = {
    __dyeScale: scale, requestAnimationFrame: f => rafs.push(f),
    addEventListener() {}, echarts: null,
  };
  win.echarts = {
    init: () => { registered = chart; return chart; },
    getInstanceByDom: () => registered,
  };
  const ctx = vm.createContext({
    window: win, echarts: win.echarts, console: { warn: m => warns.push(m) },
    document: { getElementById: () => el, documentElement: { getAttribute: () => "light" } },
  });
  vm.runInContext(chartScript, ctx);
  const t = "2026-01-01T00:00:0";
  const ms = [0, 1, 2].map(i => ({
    timestamp: t + i + "Z",
    machine: { timestamp: t + i + "Z", state: { substate: "pouring" }, pressure: 6, flow: 2, mixTemperature: 90 },
  }));
  ctx.plotHistoricalShot(ms, {});
  rafs.forEach(f => f());
  return { warns, resizes, el };
}

{
  const r = runChart({ fullW: 0, fullH: 0, clientW: 0, clientH: 0, scale: { x: 0.7, y: 0.7 } });
  assert.ok(r.warns.length >= 1, "zero-size plot warns");
  assert.match(r.warns[0], /zero size/);
  assert.match(r.warns[0], /scale 0\.7,0\.7/, "warning carries the scale");
  assert.equal(r.resizes.length, 0, "no container size to resize to");
}
{
  const r = runChart({ fullW: 0, fullH: 0, clientW: 1000, clientH: 600, rectW: 700, rectH: 420, scale: { x: 0.7, y: 0.7 } });
  assert.ok(r.warns.length >= 1, "zero plot against a real container still warns");
  assert.ok(r.resizes.length >= 1, "and is resized from the unscaled container size");
}
{
  // clientWidth unusable: the scaled rect is divided by the scale, so 700 / 0.7 equals plot 1000.
  const r = runChart({ fullW: 1000, fullH: 600, clientW: 0, clientH: 0, rectW: 700, rectH: 420, scale: { x: 0.7, y: 0.7 } });
  assert.equal(r.warns.length, 0, "matching size is quiet");
  assert.equal(r.resizes.length, 0, "and not resized");
}

// --- dashboard return trip -------------------------------------------------------------
const dash = readFileSync(new URL("../src/pages/dashboard.ts", import.meta.url), "utf8");
const a = dash.indexOf("function referrerBack()");
const b = dash.indexOf("\nfunction setupReadNote");
assert.ok(a > 0 && b > a, "return functions found");
const src = dash.slice(a, b);

function leave({ search = "", referrer = "", host = "localhost", port = "8080", path = "/api/v1/plugins/dye2.reaplugin/dashboard" }) {
  const loc = { search, hostname: host, href: `http://${host}:${port}${path}${search}` };
  const ctx = vm.createContext({
    URL, URLSearchParams, location: loc, Date: { now: () => 123 },
    window: { location: loc }, document: { referrer }, lastApplied: "recipe:2", encodeURIComponent,
  });
  vm.runInContext(src + "\nleaveDashboard();", ctx);
  return loc.href;
}

// 1. the skin's own return= wins, dyeApplied preserved
assert.equal(
  leave({ search: "?return=" + encodeURIComponent("http://localhost:25261/index.html?x=1"), referrer: "http://localhost:3000/" }),
  "http://localhost:25261/index.html?x=1&dyeApplied=recipe%3A2");
// 2. no return=: same-host http referrer, no cache buster
assert.equal(
  leave({ referrer: "http://localhost:25261/" }),
  "http://localhost:25261/?dyeApplied=recipe%3A2");
// 3. referrer on another host, a DYE2 page, or absent: the :3000 fallback keeps _= and dyeApplied
for (const referrer of ["", "http://evil.example/", "http://localhost:8080/api/v1/plugins/dye2.reaplugin/edit-shot", "file:///x"]) {
  assert.equal(leave({ referrer }), "http://localhost:3000/?_=123&dyeApplied=recipe%3A2", `fallback for "${referrer}"`);
}
console.log("device-bugs-2: ok");
