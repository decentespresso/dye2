/**
 * Serves ECharts from the plugin itself instead of a CDN — the tablet is offline, so
 * a CDN <script> leaves the dashboard chart permanently blank.
 *
 * Same reasoning as the old plotly-asset.ts: REA has no static-asset endpoint for plugins
 * (see rea_restapi.yml), so the only way to hand the WebView a .js file is an `http` route
 * of our own, which means the bytes ride along inside plugin.js.
 *
 * The vendor file is a tree-shaken IIFE build (echarts/core + LineChart, GridComponent,
 * MarkLineComponent, MarkPointComponent, CanvasRenderer only — no legend, dye2 never shows
 * one; no tooltip component either, see chart.ts's header comment) that sets
 * `window.echarts`, built the same way streamline_project/scripts/echarts-streamline-entry.js
 * builds its own bundle:
 *
 *   cd streamline_project && cp <entry> ./tmp-entry.js && \
 *     node_modules/.bin/esbuild ./tmp-entry.js --bundle --format=iife --minify \
 *       --outfile=../dye2/dye2-plugin/src/vendor/echarts-dye2.min.js && rm ./tmp-entry.js
 *
 * where <entry> is:
 *   import * as echarts from 'echarts/core';
 *   import { LineChart } from 'echarts/charts';
 *   import { GridComponent, MarkLineComponent, MarkPointComponent } from 'echarts/components';
 *   import { CanvasRenderer } from 'echarts/renderers';
 *   echarts.use([LineChart, GridComponent, MarkLineComponent, MarkPointComponent, CanvasRenderer]);
 *   window.echarts = echarts;
 *
 * Bumping the echarts version means re-running that build with streamline_project's
 * node_modules (it already depends on echarts) and replacing this file.
 */
import echartsSource from "../vendor/echarts-dye2.min.js?raw";

export function renderEchartsAsset(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Pinned to a version-specific file, so the WebView may keep it forever rather
      // than re-fetching it on every dashboard open.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: echartsSource,
  };
}
