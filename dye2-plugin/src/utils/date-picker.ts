/**
 * Themed date picker for the tablet webview.
 *
 * Android's native date dialog is OS-styled and ignores the REA colour guide, so fields
 * opt in with `readonly data-dye-datepicker` — readonly stops the WebView opening the OS
 * picker, and this script owns the interaction instead. The input stays `type="date"` so
 * its `.value` is still an ISO `YYYY-MM-DD` string and existing readers keep working; the
 * popup dispatches `input` + `change` so existing listeners fire as if the user typed.
 */

export function datePickerCss(): string {
  return `
  input[data-dye-datepicker] { cursor: pointer; }
  /* No native affordance — ours is the only picker. */
  input[data-dye-datepicker]::-webkit-calendar-picker-indicator { display: none; }
  .dye-dp {
    position: absolute; z-index: 200; width: 420px;
    background: var(--box-color); border: 2px solid var(--mimoja-blue);
    border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.18);
    font-family: 'Inter', sans-serif; padding: 18px; user-select: none;
  }
  .dye-dp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .dye-dp-title { font-size: 24px; font-weight: 700; color: var(--mimoja-blue); }
  .dye-dp-nav {
    width: 52px; height: 52px; border-radius: 15px; border: 2px solid var(--chip-stroke);
    background: var(--box-color); color: var(--mimoja-blue);
    font-size: 26px; font-weight: 700; line-height: 48px; text-align: center; cursor: pointer;
  }
  .dye-dp-nav:active { background: var(--mimoja-blue); color: #fff; }
  .dye-dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .dye-dp-dow { font-size: 18px; font-weight: 700; color: var(--muted-grey); text-align: center; padding: 6px 0; }
  .dye-dp-day {
    height: 52px; line-height: 48px; text-align: center; border-radius: 12px;
    font-size: 21px; font-weight: 600; color: var(--text-primary); cursor: pointer;
    border: 2px solid transparent;
  }
  .dye-dp-day:active { background: var(--button-grey); }
  .dye-dp-day.dye-dp-muted { color: var(--chip-stroke); cursor: default; }
  .dye-dp-day.dye-dp-today { border-color: var(--chip-stroke); }
  .dye-dp-day.dye-dp-sel { background: var(--mimoja-blue); border-color: var(--mimoja-blue); color: #fff; }
  .dye-dp-foot { display: flex; gap: 12px; margin-top: 16px; }
  .dye-dp-btn {
    flex: 1; height: 56px; border-radius: 23px; border: 2px solid var(--mimoja-blue);
    background: var(--box-color); color: var(--mimoja-blue);
    font-family: 'Inter', sans-serif; font-size: 21px; font-weight: 600; cursor: pointer;
  }
  .dye-dp-btn-primary { background: var(--mimoja-blue); color: #fff; }
`;
}

export function datePickerScript(): string {
  return `
(function () {
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  var pop = null, target = null, viewY = 0, viewM = 0;

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseIso(s) {
    var m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  // <body> is scaled by the fit script, so it is the containing block for our absolutely
  // positioned popup and its coordinates are pre-transform. Undo translate+scale to turn
  // a viewport rect into that local space, otherwise the popup lands off-target.
  function toLocal(rect) {
    var t = getComputedStyle(document.body).transform;
    if (!t || t === 'none') return { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY };
    var m = new DOMMatrixReadOnly(t);
    return { x: (rect.left - m.e) / (m.a || 1), y: (rect.bottom - m.f) / (m.d || 1) };
  }

  function close() {
    if (pop) { pop.remove(); pop = null; target = null; }
  }

  function commit(d) {
    if (!target) return;
    target.value = d ? iso(d) : '';
    target.dispatchEvent(new Event('input',  { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

  function render() {
    if (!pop) return;
    var sel = parseIso(target.value), today = new Date();
    var first = new Date(viewY, viewM, 1);
    var lead = (first.getDay() + 6) % 7;              // Monday-first
    var days = new Date(viewY, viewM + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<div class="dye-dp-day dye-dp-muted"></div>';
    for (var d = 1; d <= days; d++) {
      var cls = 'dye-dp-day';
      if (sel && sel.getFullYear() === viewY && sel.getMonth() === viewM && sel.getDate() === d) cls += ' dye-dp-sel';
      else if (today.getFullYear() === viewY && today.getMonth() === viewM && today.getDate() === d) cls += ' dye-dp-today';
      cells += '<div class="' + cls + '" data-day="' + d + '">' + d + '</div>';
    }
    pop.innerHTML =
      '<div class="dye-dp-head">' +
        '<div class="dye-dp-nav" data-nav="-1">&#8249;</div>' +
        '<div class="dye-dp-title">' + MONTHS[viewM] + ' ' + viewY + '</div>' +
        '<div class="dye-dp-nav" data-nav="1">&#8250;</div>' +
      '</div>' +
      '<div class="dye-dp-grid">' + DOW.map(function (w) { return '<div class="dye-dp-dow">' + w + '</div>'; }).join('') + cells + '</div>' +
      '<div class="dye-dp-foot">' +
        '<button type="button" class="dye-dp-btn" data-act="clear">Clear</button>' +
        '<button type="button" class="dye-dp-btn dye-dp-btn-primary" data-act="today">Today</button>' +
      '</div>';
  }

  function open(input) {
    close();
    target = input;
    var d = parseIso(input.value) || new Date();
    viewY = d.getFullYear(); viewM = d.getMonth();
    pop = document.createElement('div');
    pop.className = 'dye-dp';
    document.body.appendChild(pop);
    render();
    var p = toLocal(input.getBoundingClientRect());
    pop.style.left = Math.max(8, p.x) + 'px';
    pop.style.top = (p.y + 8) + 'px';
    // Nudge back inside the design canvas if the field sits near an edge.
    var over = (p.x + pop.offsetWidth) - 1920;
    if (over > 0) pop.style.left = Math.max(8, p.x - over - 8) + 'px';
  }

  document.addEventListener('click', function (e) {
    var field = e.target.closest ? e.target.closest('input[data-dye-datepicker]') : null;
    if (field) { e.preventDefault(); if (target === field) { close(); } else { open(field); } return; }
    if (!pop) return;
    if (!pop.contains(e.target)) { close(); return; }

    var nav = e.target.closest('.dye-dp-nav');
    if (nav) {
      viewM += parseInt(nav.dataset.nav, 10);
      if (viewM < 0) { viewM = 11; viewY--; } else if (viewM > 11) { viewM = 0; viewY++; }
      render();
      return;
    }
    var act = e.target.closest('.dye-dp-btn');
    if (act) { commit(act.dataset.act === 'today' ? new Date() : null); return; }
    var day = e.target.closest('.dye-dp-day[data-day]');
    if (day) commit(new Date(viewY, viewM, parseInt(day.dataset.day, 10)));
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
`;
}
