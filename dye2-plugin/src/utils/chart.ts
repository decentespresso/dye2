/**
 * Browser-side ECharts chart logic for the dashboard page.
 * Exported as a string to be inlined as a <script> block.
 * Requires echarts, which devPageShell loads from the plugin's own "echarts" route.
 *
 * Design follows streamline_project/src/modules/chart.js:
 * - Single Y-axis [0,10]; temperature scaled ÷10 to overlay
 * - Weight shown as smoothed flow rate (derivative), not raw weight
 * - Inline end-of-trace annotations, no legend, no hover tooltip
 * - Step marker vertical line on substate change
 *
 * One historical shot at a time, drawn once per shot — no live/append path, so unlike
 * streamline_project/src/modules/echarts-renderer.js there is no projectSeries/appendData
 * machinery and no legend. ponytail: dropped the hover tooltip streamline_project gets from
 * a hand-rolled DOM label — dye2's end-of-line markPoint labels already name every trace, and
 * echarts' own tooltip component needs `triggerLineEvent` wired up before it fires at all; add
 * both back if a hover readout turns out to be wanted.
 */
export const chartScript = `
var CHART_SMOOTHING = 0.1;

// Light values are dye2's originals. Dark values are the skin's DARK_TRACE_COLORS
// (streamline_project chart.js) where it has a counterpart, so a shot reads the same on
// the skin's chart and here. Flow is the exception: the skin has no dark flow trace (it
// keeps the light #0358cf), but that blue is too dim on the dark ground, so #4d82e8 is
// dye2's own choice.
var CHART_COLORS_LIGHT = {
  pressure:          '#17c29a',
  flow:              '#0358cf',
  targetPressure:    '#bde2d5',
  targetFlow:        '#cdd9f5',
  temperature:       '#ff97a1',
  targetTemperature: '#F9ebec',
  weight:            '#D8BDA8',
};
var CHART_COLORS_DARK = {
  pressure:          '#00B087',
  flow:              '#4d82e8',
  targetPressure:    '#374D47',
  targetFlow:        '#23416C',
  temperature:       '#653F43',
  targetTemperature: '#3E3233',
  weight:            '#695F57',
};

// Read at render time, not load time: the shell's bootstrap may still be flipping the
// theme from the KV answer when this script first runs, and plotHistoricalShot redraws
// per shot. A chart already on screen keeps the colours it was drawn with (no live theme
// updates; the theme cannot change while a DYE2 page is open).
function chartIsDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
function chartColors() { return chartIsDark() ? CHART_COLORS_DARK : CHART_COLORS_LIGHT; }

// Keyed by track, not a flat array: chartBuildOption looks an annotation up by the trace's
// own key, so there is no name/colour/coordinate matching to fall back on.
function chartGetAnnotations(tracks) {
  var skip = ['targetPressure', 'targetFlow', 'targetTemperature'];
  var nameMap = { pressure: 'Pressure', flow: 'Flow', temperature: '°C', weight: 'Weight' };
  var candidates = [];

  Object.keys(tracks).forEach(function(key) {
    if (skip.indexOf(key) !== -1) return;
    var tr = tracks[key];
    if (tr.x.length > 0) {
      candidates.push({
        key:   key,
        name:  nameMap[key] || key,
        x:     tr.x[tr.x.length - 1],
        y:     tr.y[tr.y.length - 1],
        color: chartColors()[key] || chartAxisText(),
      });
    }
  });

  candidates.sort(function(a, b) { return a.y - b.y; });

  var annotations = {};
  var lastY = -Infinity;
  var minSep = 0.4;
  var minBuf = 0.2;

  candidates.forEach(function(c) {
    var fy = Math.max(c.y, minBuf);
    if (lastY !== -Infinity && fy - lastY < minSep) fy = lastY + minSep;
    annotations[c.key] = { x: c.x, y: fy, text: c.name, color: c.color };
    lastY = fy;
  });

  return annotations;
}

// Axis text, grid and line colours: light is dye2's slate, dark is the skin's baseLayout.
function chartAxisText() { return chartIsDark() ? '#606579' : '#64748b'; }
function chartGridColor() { return chartIsDark() ? '#1E202B' : '#e2e8f0'; }
function chartAxisLine() { return chartIsDark() ? '#606579' : '#e2e8f0'; }
// The step-marker vertical line.
function chartMarkerColor() { return chartIsDark() ? '#606579' : '#94a3b8'; }

// Dash values are stored as echarts lineStyle.type strings directly (there's no other
// consumer of these track/shape objects left to need Plotly's vocabulary).
function chartMakeTracks() {
  var c = chartColors();
  return {
    pressure:          { x: [], y: [], name: 'Pressure',         line: { color: c.pressure, width: 2 } },
    flow:              { x: [], y: [], name: 'Flow',             line: { color: c.flow, width: 2 } },
    targetPressure:    { x: [], y: [], name: 'Target Pressure',  line: { color: c.targetPressure, width: 1.5, dash: 'dotted' } },
    targetFlow:        { x: [], y: [], name: 'Target Flow',      line: { color: c.targetFlow, width: 1.5, dash: 'dotted' } },
    temperature:       { x: [], y: [], name: '°C',               line: { color: c.temperature, width: 2 } },
    targetTemperature: { x: [], y: [], name: 'Target °C',        line: { color: c.targetTemperature, width: 1.5, dash: 'dotted' } },
    weight:            { x: [], y: [], name: 'Weight',           line: { color: c.weight, width: 2 } },
  };
}

// One chart instance per container, tracked by echarts itself (getInstanceByDom) rather than
// a module-level slot — so a disposed or never-created instance can't go stale independently
// of the DOM it was drawn into.
function chartGetOrCreate(el) {
  var chart = echarts.getInstanceByDom(el);
  if (chart && !chart.isDisposed()) return chart;
  return echarts.init(el, null, { devicePixelRatio: window.devicePixelRatio || 1 });
}

function chartBuildOption(traces, dtick, annotations, shapes) {
  var text = chartAxisText(), grid = chartGridColor(), axisLine = chartAxisLine();

  var series = traces.map(function(tr) {
    var ann = annotations[tr.key];
    var s = {
      id:   tr.key,
      name: tr.name,
      type: 'line',
      data: tr.x.map(function(xv, idx) { return [xv, tr.y[idx]]; }),
      symbol: 'none',
      lineStyle: { color: tr.line.color, width: tr.line.width, type: tr.line.dash || 'solid' },
      itemStyle: { color: tr.line.color },
      emphasis:  { disabled: true },
    };
    if (ann) {
      s.markPoint = {
        silent: true, symbol: 'circle', symbolSize: 1,
        itemStyle: { color: 'transparent', borderWidth: 0 },
        label: {
          show: true, formatter: ann.text, position: 'right', distance: 6,
          color: ann.color, fontFamily: 'Inter, sans-serif', fontSize: 13,
        },
        data: [{ coord: [ann.x, ann.y] }],
      };
    }
    return s;
  });

  // Step markers aren't tied to any one trace, so they ride on a hidden line series of
  // their own via markLine (same approach as streamline_project's echarts-renderer.js).
  if (shapes && shapes.length) {
    series.push({
      id: '__markers', type: 'line', data: [], symbol: 'none', silent: true,
      lineStyle: { opacity: 0 },
      markLine: {
        silent: true, symbol: ['none', 'none'], label: { show: false },
        data: shapes.map(function(sh) {
          return { xAxis: sh.x0, lineStyle: { color: sh.line.color, width: sh.line.width, type: sh.line.dash } };
        }),
      },
    });
  }

  return {
    animation: false,
    textStyle: { color: text, fontFamily: 'Inter, sans-serif', fontSize: 13 },
    grid: { left: 40, right: 60, top: 10, bottom: 36 },
    xAxis: {
      // max: 'dataMax', not a fixed range -- a fixed interval alone rounds the axis out to
      // the next tick past the data (e.g. 27s -> 30), pushing the end-of-line labels inside
      // the plot instead of into the right margin they're sized for.
      type: 'value', min: 0, max: 'dataMax', interval: dtick,
      axisLabel: { color: text },
      axisLine:  { lineStyle: { color: axisLine } },
      axisTick:  { lineStyle: { color: axisLine } },
      splitLine: { show: true, lineStyle: { color: grid } },
    },
    yAxis: {
      type: 'value', min: 0, max: 10, interval: 1,
      axisLabel: { color: text },
      axisLine:  { lineStyle: { color: axisLine } },
      axisTick:  { lineStyle: { color: axisLine } },
      splitLine: { show: true, lineStyle: { color: grid } },
    },
    series: series,
  };
}

// The chart keeps its state on the instance tied to the container node, so a placeholder
// written straight into the node breaks both directions: setOption() then draws into a
// detached/stale instance, and a placeholder left in place survives the next render and
// floats over whatever sits under the chart. Every "nothing to plot" exit calls this.
function chartShowPlaceholder(el, text) {
  if (!el) return;
  if (window.echarts) {
    var chart = echarts.getInstanceByDom(el);
    if (chart && !chart.isDisposed()) chart.dispose();
  }
  el.innerHTML = '<div class="dye-chart-empty" style="height:100%;display:flex;align-items:center;' +
    'justify-content:center;color:var(--low-contrast-white);font-size:24px;">' + text + '</div>';
}

function chartClearPlaceholder(el) {
  if (!el) return;
  var ph = el.querySelector('.dye-chart-empty');
  if (ph) ph.remove();
}

// echarts is the last script in the body, so a shot fetch that resolves first would reach
// chartGetOrCreate before the ~500 KB parse finishes — a ReferenceError swallowed by the
// caller's .catch, leaving a blank chart that nothing redraws. Hold the draw and replay it
// on the script's load event instead.
var chartPendingPlot = null;
window.addEventListener('dye2-echarts-ready', function () {
  var p = chartPendingPlot;
  chartPendingPlot = null;
  if (!p) return;
  plotHistoricalShot(p[0], p[1]);
});

function plotHistoricalShot(measurements, workflow) {
  var el = document.getElementById('plotly-chart');
  if (!el) return;
  if (!window.echarts) {
    chartPendingPlot = [measurements, workflow];
    chartShowPlaceholder(el, 'Loading...');
    return;
  }

  if (!measurements || measurements.length === 0) {
    chartShowPlaceholder(el, 'No shot data');
    return;
  }

  // Find shot start: first preinfusion or pouring point
  var shotStartTime = null;
  for (var i = 0; i < measurements.length; i++) {
    var m0 = measurements[i].machine;
    if (m0 && m0.state && (m0.state.substate === 'preinfusion' || m0.state.substate === 'pouring')) {
      shotStartTime = new Date(m0.timestamp || measurements[i].timestamp);
      break;
    }
  }
  if (!shotStartTime) {
    chartShowPlaceholder(el, 'No pour data');
    return;
  }

  // Find shot end: last preinfusion or pouring point
  var shotEndTime = null;
  for (var j = measurements.length - 1; j >= 0; j--) {
    var mj = measurements[j].machine;
    if (mj && mj.state && (mj.state.substate === 'preinfusion' || mj.state.substate === 'pouring')) {
      shotEndTime = new Date(mj.timestamp || measurements[j].timestamp);
      break;
    }
  }

  var tracks             = chartMakeTracks();
  var shapes             = [];
  var lastScaleWeight    = 0;
  var lastScaleTime      = 0;
  var smoothedWeight     = 0;
  var prevSubstate       = null;

  for (var k = 0; k < measurements.length; k++) {
    var dp = measurements[k];
    var m  = dp.machine;
    var s  = dp.scale;

    if (m && m.state) {
      var sub = m.state.substate;
      if (sub === 'preinfusion' || sub === 'pouring') {
        var t = (new Date(m.timestamp || dp.timestamp) - shotStartTime) / 1000;
        if (t >= 0) {
          // Step marker when substate transitions (e.g. preinfusion → pouring)
          if (prevSubstate !== null && sub !== prevSubstate) {
            shapes.push({
              x0: t,
              line: { color: chartMarkerColor(), width: 1.5, dash: 'dashed' },
            });
          }
          prevSubstate = sub;

          tracks.pressure.x.push(t);
          tracks.pressure.y.push(m.pressure != null ? m.pressure : null);

          tracks.flow.x.push(t);
          tracks.flow.y.push(m.flow != null ? m.flow : null);

          if (m.targetPressure != null) {
            tracks.targetPressure.x.push(t);
            tracks.targetPressure.y.push(m.targetPressure);
          }
          if (m.targetFlow != null) {
            tracks.targetFlow.x.push(t);
            tracks.targetFlow.y.push(m.targetFlow);
          }

          // Temperature: scale ÷10 to fit 0-10 y-axis (e.g. 93°C → 9.3)
          var temp = m.mixTemperature != null ? m.mixTemperature : (m.groupTemperature != null ? m.groupTemperature : null);
          if (temp != null) {
            tracks.temperature.x.push(t);
            tracks.temperature.y.push(temp / 10);
          }
          if (m.targetGroupTemperature != null) {
            tracks.targetTemperature.x.push(t);
            tracks.targetTemperature.y.push(m.targetGroupTemperature / 10);
          }
        }
      }
    }

    // Weight as smoothed flow rate (derivative)
    if (s && s.weight != null) {
      var scaleTs = new Date(s.timestamp || dp.timestamp);
      if (shotEndTime && scaleTs > shotEndTime) continue;
      var st = (scaleTs - shotStartTime) / 1000;
      if (st >= 0) {
        var wChange = 0;
        if (lastScaleTime > 0 && st > lastScaleTime) {
          var dt  = st - lastScaleTime;
          var raw = (s.weight - lastScaleWeight) / dt;
          smoothedWeight = CHART_SMOOTHING * raw + (1 - CHART_SMOOTHING) * smoothedWeight;
          wChange = smoothedWeight;
        }
        tracks.weight.x.push(st);
        tracks.weight.y.push(wChange);
        lastScaleWeight = s.weight;
        lastScaleTime   = st;
      }
    }
  }

  var traces = Object.keys(tracks).map(function(key) {
    tracks[key].key = key;
    return tracks[key];
  }).filter(function(tr) { return tr.x.length > 0; });

  if (traces.length === 0) {
    chartShowPlaceholder(el, 'No sensor data');
    return;
  }

  // Adaptive x-axis tick spacing
  var allX    = traces.reduce(function(acc, tr) { return acc.concat(tr.x); }, []);
  var maxTime = allX.length > 0 ? Math.max.apply(null, allX) : 0;
  var dtick   = maxTime < 15 ? 1 : maxTime < 60 ? 5 : maxTime < 100 ? 20 : 30;

  var annotations = chartGetAnnotations(tracks);
  var option      = chartBuildOption(traces, dtick, annotations, shapes);

  chartClearPlaceholder(el);
  var chart = chartGetOrCreate(el);
  chart.setOption(option, { notMerge: true, lazyUpdate: false, silent: true });
  chartSettle(el);
}

// echarts sizes itself from the container at draw time. The shell scales <body> by a
// transform and may not have settled by then, so on the tablet the plot can be laid out
// at zero size (an empty canvas, no error). Container size in layout px (clientWidth) is not
// affected by the transform; getBoundingClientRect is, so it is divided by the shell's
// scale when clientWidth is unusable. Sizing only: nothing here changes appearance.
function chartContainerSize(el) {
  var sc = window.__dyeScale || { x: 1, y: 1 };
  var r = el.getBoundingClientRect();
  return {
    w: el.clientWidth  || (sc.x ? r.width  / sc.x : 0),
    h: el.clientHeight || (sc.y ? r.height / sc.y : 0),
    sx: sc.x, sy: sc.y, rw: r.width, rh: r.height,
  };
}

function chartCheckSize(el) {
  if (!el || !window.echarts) return;
  var chart = echarts.getInstanceByDom(el);
  if (!chart || chart.isDisposed()) return;
  var c = chartContainerSize(el);
  var w = chart.getWidth();
  var h = chart.getHeight();
  if (!w || !h || !c.w || !c.h) {
    console.warn('[dye2 chart] zero size at draw: plot ' + w + 'x' + h + ', container ' + c.w + 'x' + c.h + ', rect ' + c.rw + 'x' + c.rh +
      ', scale ' + c.sx + ',' + c.sy);
  }
  if (c.w > 0 && c.h > 0 && (Math.abs(w - c.w) > 1 || Math.abs(h - c.h) > 1)) {
    try { chart.resize({ width: c.w, height: c.h }); } catch (e) { console.warn('[dye2 chart] resize failed', e); }
  }
}

// Re-check once layout has settled: next frame, after the shell's own fit (its resize
// listener is registered before this script runs), and on every later viewport resize.
var chartSettleWired = false;
function chartSettle(el) {
  var again = function () { chartCheckSize(document.getElementById('plotly-chart')); };
  if (window.requestAnimationFrame) window.requestAnimationFrame(function () { again(); });
  chartCheckSize(el);
  if (chartSettleWired) return;
  chartSettleWired = true;
  window.addEventListener('resize', again);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', again);
}
`;
