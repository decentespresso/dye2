/**
 * Browser-side Plotly chart logic for the dashboard page.
 * Exported as a string to be inlined as a <script> block.
 * Requires Plotly, which devPageShell loads from the plugin's own "plotly" route.
 *
 * Design follows streamline_project/src/modules/chart.js:
 * - Single Y-axis [0,10]; temperature scaled ÷10 to overlay
 * - Weight shown as smoothed flow rate (derivative), not raw weight
 * - Inline end-of-trace annotations, no legend
 * - Step marker vertical line on substate change
 */
export const chartScript = `
var CHART_SMOOTHING = 0.1;

var CHART_COLORS = {
  pressure:          '#17c29a',
  flow:              '#0358cf',
  targetPressure:    '#bde2d5',
  targetFlow:        '#cdd9f5',
  temperature:       '#ff97a1',
  targetTemperature: '#F9ebec',
  weight:            '#D8BDA8',
};

function chartGetAnnotations(tracks) {
  var skip = ['targetPressure', 'targetFlow', 'targetTemperature'];
  var nameMap = { pressure: 'Pressure', flow: 'Flow', temperature: '°C', weight: 'Weight' };
  var candidates = [];

  Object.keys(tracks).forEach(function(key) {
    if (skip.indexOf(key) !== -1) return;
    var tr = tracks[key];
    if (tr.x.length > 0) {
      candidates.push({
        name:  nameMap[key] || key,
        x:     tr.x[tr.x.length - 1],
        y:     tr.y[tr.y.length - 1],
        color: CHART_COLORS[key] || '#999',
      });
    }
  });

  candidates.sort(function(a, b) { return a.y - b.y; });

  var annotations = [];
  var lastY = -Infinity;
  var minSep = 0.4;
  var minBuf = 0.2;

  candidates.forEach(function(c) {
    var fy = Math.max(c.y, minBuf);
    if (lastY !== -Infinity && fy - lastY < minSep) fy = lastY + minSep;
    annotations.push({
      x: c.x, y: fy,
      xref: 'x', yref: 'y',
      text: c.name,
      showarrow: false,
      xanchor: 'left', yanchor: 'middle',
      xshift: 6,
      font: { color: c.color, size: 13 },
    });
    lastY = fy;
  });

  return annotations;
}

function chartBuildLayout(shapes, annotations) {
  return {
    plot_bgcolor:  'transparent',
    paper_bgcolor: 'transparent',
    font: { family: 'Inter, sans-serif', color: '#64748b', size: 13 },
    shapes:      shapes      || [],
    annotations: annotations || [],
    xaxis: {
      gridcolor:  '#e2e8f0',
      linecolor:  '#e2e8f0',
      tickcolor:  '#e2e8f0',
      tickfont:   { color: '#64748b' },
      dtick:      1,
      fixedrange: true,
      zeroline:   false,
    },
    yaxis: {
      gridcolor:  '#e2e8f0',
      linecolor:  '#e2e8f0',
      tickcolor:  '#e2e8f0',
      tickfont:   { color: '#64748b' },
      range:      [0, 10],
      dtick:      1,
      fixedrange: true,
      zeroline:   false,
    },
    autosize:   true,
    margin:     { l: 40, r: 60, t: 10, b: 36, pad: 0 },
    showlegend: false,
  };
}

function chartMakeTracks() {
  return {
    pressure:          { x: [], y: [], name: 'Pressure',         type: 'scatter', mode: 'lines', line: { color: '#17c29a', width: 2 },              hoverinfo: 'name' },
    flow:              { x: [], y: [], name: 'Flow',             type: 'scatter', mode: 'lines', line: { color: '#0358cf', width: 2 },              hoverinfo: 'name' },
    targetPressure:    { x: [], y: [], name: 'Target Pressure',  type: 'scatter', mode: 'lines', line: { color: '#bde2d5', width: 1.5, dash: 'dot' }, hoverinfo: 'name' },
    targetFlow:        { x: [], y: [], name: 'Target Flow',      type: 'scatter', mode: 'lines', line: { color: '#cdd9f5', width: 1.5, dash: 'dot' }, hoverinfo: 'name' },
    temperature:       { x: [], y: [], name: '°C',               type: 'scatter', mode: 'lines', line: { color: '#ff97a1', width: 2 },              hoverinfo: 'name' },
    targetTemperature: { x: [], y: [], name: 'Target °C',        type: 'scatter', mode: 'lines', line: { color: '#F9ebec', width: 1.5, dash: 'dot' }, hoverinfo: 'name' },
    weight:            { x: [], y: [], name: 'Weight',           type: 'scatter', mode: 'lines', line: { color: '#D8BDA8', width: 2 },              hoverinfo: 'name' },
  };
}

function initChart() {
  // Plotly is loaded by the shell from the plugin's own route — nothing to eagerly init.
}

// Plotly keeps its state on the chart node, so a placeholder written straight into it
// breaks both directions: react() then redraws nothing (blank graph), and a placeholder
// left in place survives the redraw and floats over whatever sits under the chart.
function chartShowPlaceholder(el, text) {
  if (!el) return;
  if (window.Plotly && el._fullLayout) Plotly.purge(el);
  el.innerHTML = '<div class="dye-chart-empty" style="height:100%;display:flex;align-items:center;' +
    'justify-content:center;color:var(--low-contrast-white);font-size:24px;">' + text + '</div>';
}

function chartClearPlaceholder(el) {
  if (!el) return;
  var ph = el.querySelector('.dye-chart-empty');
  if (ph) ph.remove();
}

function plotHistoricalShot(measurements, workflow) {
  var el = document.getElementById('plotly-chart');
  if (!el) return;

  if (!measurements || measurements.length === 0) {
    el.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--low-contrast-white);font-size:18px;">No shot data</div>';
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
    el.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--low-contrast-white);font-size:18px;">No pour data</div>';
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
              type: 'line', x0: t, x1: t, y0: 0, y1: 1, yref: 'paper',
              line: { color: '#94a3b8', width: 1.5, dash: 'longdash' },
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

  // Adaptive x-axis tick spacing
  var allX    = Object.values(tracks).reduce(function(acc, tr) { return acc.concat(tr.x); }, []);
  var maxTime = allX.length > 0 ? Math.max.apply(null, allX) : 0;
  var dtick   = maxTime < 15 ? 1 : maxTime < 60 ? 5 : maxTime < 100 ? 20 : 30;

  var annotations = chartGetAnnotations(tracks);
  var layout      = chartBuildLayout(shapes, annotations);
  var traces      = Object.values(tracks).filter(function(tr) { return tr.x.length > 0; });

  if (traces.length === 0) {
    chartShowPlaceholder(el, 'No sensor data');
    return;
  }

  chartClearPlaceholder(el);
  Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
  Plotly.relayout(el, { 'xaxis.dtick': dtick });
}
`;
