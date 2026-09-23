import { html } from "./html";
// Tailwind compiled at build time (scanned from src/**/*.ts) and inlined below,
// so pages style themselves with no network — the offline tablet has no CDN.
// Regenerate via `npm run build:css` (runs automatically as part of `npm run build`).
import tailwindCss from "../styles/tailwind.generated.css?inline";

interface DevShellOptions {
  plotly?: boolean;
}

// Pages are authored at a fixed 1920x1200 design reference (the Figma canvas at 75%,
// 16:10 like the tablet). Ported from streamline_project/src/modules/scaling.js:
// scale x and y independently instead of a uniform min(w,h) zoom, so a non-16:10
// screen (e.g. an 8" tablet at 1340x800) fills edge-to-edge instead of leaving thick
// letterbox gutters. The stretch ratio is clamped at 1.15 so round controls don't
// become visible ellipses on far-off aspects; 16:10 screens are unaffected either way.
// Transform (not zoom) is applied to <body> itself — a transformed element becomes the
// containing block for its position:fixed descendants, so modal overlays (which are
// siblings of the page's root div, both direct children of body) scale correctly too.
const fitScript = `
(function () {
  var DESIGN_W = 1920, DESIGN_H = 1200;
  var MAX_STRETCH = 1.15;
  function fit(vw, vh) {
    var sx = vw / DESIGN_W, sy = vh / DESIGN_H;
    var stretch = Math.max(sx, sy) / Math.min(sx, sy);
    if (stretch > MAX_STRETCH) {
      var k = MAX_STRETCH / stretch;
      if (sx > sy) { sx *= k; } else { sy *= k; }
    }
    var offsetX = (vw - DESIGN_W * sx) / 2;
    var offsetY = (vh - DESIGN_H * sy) / 2;
    document.body.style.width = DESIGN_W + 'px';
    document.body.style.height = DESIGN_H + 'px';
    document.body.style.transformOrigin = 'top left';
    document.body.style.transform =
      'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + sx + ', ' + sy + ')';
    // body is no longer a flex container, so its root child (a plain block div) won't
    // auto-fill body's height on its own the way it auto-fills width — pin it explicitly.
    var root = document.body.firstElementChild;
    if (root) { root.style.width = '100%'; root.style.height = '100%'; }
    lastSy = sy;
  }
  var lastSy = 1;
  // Android's soft keyboard shrinks the viewport height (interactive-widget=overlays-content
  // only lands on newer WebViews, so we cannot rely on it). Refitting against that height
  // recomputes sy and visibly squashes the page mid-edit.
  //
  // Deciding by document.activeElement does NOT work: the WebView fires resize as the
  // keyboard animates in, often before focus has landed on the field, so the guard sees no
  // editing and refits anyway. Instead key off the only thing that is always true — the
  // keyboard can shrink the viewport but never widen or grow it. So: a width change is a
  // real resize (rotation), a taller viewport means the keyboard went away, and a
  // same-width-but-shorter viewport is the keyboard and gets ignored. No focus, no timers.
  var fitW = 0, fitH = 0;
  function apply() {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (vw !== fitW || vh > fitH) { fitW = vw; fitH = vh; fit(vw, vh); }
  }
  apply();
  window.addEventListener('resize', apply);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);

  // The page never moves for the keyboard (see above), so a field near the bottom of a
  // modal ends up underneath it. Shift just that modal up by however much the keyboard
  // covers the focused field. The overlay is a child of the scaled <body>, so its own
  // translate is in design px -> divide the on-screen overlap by the current scale.
  // A field with no fixed-position ancestor (i.e. inline in the page, not a modal) has no
  // wrapper worth translating -- instead scroll its nearest scrollable ancestor so the
  // field clears the keyboard, same goal via the mechanism that already fits inline content.
  var kbTarget = null;
  var kbScroller = null, kbScrollerPrevTop = 0;
  function kbReset() {
    if (kbTarget) { kbTarget.style.transform = kbTarget.__kbPrev || ''; kbTarget = null; }
    if (kbScroller) { kbScroller.scrollTop = kbScrollerPrevTop; kbScroller = null; }
  }
  function fixedAncestor(node) {
    while (node && node !== document.body) {
      if (getComputedStyle(node).position === 'fixed') return node;
      node = node.parentElement;
    }
    return null;
  }
  function scrollableAncestor(node) {
    while (node && node !== document.body) {
      var cs = getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) return node;
      node = node.parentElement;
    }
    return null;
  }
  function kbAdjust() {
    var vv = window.visualViewport;
    kbReset();
    if (!vv) return;
    var el = document.activeElement;
    if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
    // With interactive-widget=overlays-content the layout viewport keeps its full height
    // and only the visual viewport shrinks; without it innerHeight shrinks too and this
    // difference is 0 -- either way what is hidden is what sits past the visual viewport.
    var box = el.getBoundingClientRect();
    var overlap = box.bottom + 24 - (vv.offsetTop + vv.height);
    if (overlap <= 0) return;
    var modal = fixedAncestor(el.parentElement);
    if (modal) {
      kbTarget = modal;
      modal.__kbPrev = modal.style.transform;
      modal.style.transform = (modal.__kbPrev ? modal.__kbPrev + ' ' : '') +
        'translateY(' + (-overlap / lastSy) + 'px)';
      return;
    }
    var scroller = scrollableAncestor(el.parentElement);
    if (!scroller) return;
    kbScroller = scroller;
    kbScrollerPrevTop = scroller.scrollTop;
    scroller.scrollTop += overlap / lastSy;
  }
  // The WebView fires the viewport resize while the keyboard animates in, often before
  // focus has landed -- so re-check on focus changes too, one frame late so the field is
  // laid out (and, on blur, so the next focus is already set).
  function kbSoon() { setTimeout(kbAdjust, 50); }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', kbSoon);
  document.addEventListener('focusin', kbSoon);
  document.addEventListener('focusout', kbSoon);
})();
`;

/** CSS variable fallbacks for dev server (REA host injects real values in production) */
function cssVarFallbacks(): string {
  return `
    :root {
      --bgmain-color: #f5f7fa;
      --mimoja-blue: #385a92;
      --profile-button-outline-color: #e2e8f0;
      --box-color: #ffffff;
      --text-primary: #1e293b;
      --text-primary-disabled: #94a3b8;
      --low-contrast-white: #94a3b8;
      --fav-button-wait: #e2e8f0;
      --profile-button-background-color: #f8fafc;
      /* DYE2 redesign extras */
      --dye-chart-red:   #C0392B;
      --dye-chart-blue:  #2F6BD1;
      --dye-chart-green: #2E8B57;
      --dye-chart-pink:  #E89AB0;
      --dye-surface:     #F8FAFC;
      --dye-border:      #E5E9EE;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    /* Pages are authored at the fixed 1920x1200 design reference and fit into the
       viewport by the fit script, which scales+positions <body> directly (see
       fitScript) — the page never scrolls. Any leftover space on a non-16:10 screen
       becomes an even letterbox margin filled by this background, so it reads as
       intentional page chrome rather than empty space. */
    html {
      width: 100%; height: 100%;
      background: var(--bgmain-color);
    }
    /* width/height/transform set by the fit script (design px + computed scale). */
    body {
      overflow: hidden;
      background: var(--bgmain-color);
    }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    /* No border:none here — Tailwind preflight already zeroes border-width by
       default, and this used to win on specificity over button.border-2 etc.,
       silencing every bordered button (Add Note, Clear, Settings, Visualizer). */
    button { font-family: inherit; cursor: pointer; background: none; }
    input, textarea, select { font-family: inherit; }
    /* This is a tablet app, not a document: a long press should trigger our own gestures
       (e.g. long-press-to-edit on the favourites cards) rather than Android's text
       selection handles and paste callout. Fields opt back in below so typing, caret
       placement and clipboard still work where they matter. */
    body {
      user-select: none; -webkit-user-select: none;
      -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
    }
    input, textarea, [contenteditable="true"] {
      user-select: text; -webkit-user-select: text; -webkit-touch-callout: default;
    }
    .no-select { user-select: none; -webkit-user-select: none; }

    /* Focus mode: the field being edited goes white so it stands out across the page.
       Fields drawn transparent inside a bordered wrapper paint the wrapper instead. */
    input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus {
      background: #fff;
      color: #111;
      caret-color: var(--mimoja-blue);
    }
    input:focus::placeholder, textarea:focus::placeholder { color: #9CA3AF; }
    .dye-form-input-wrap:focus-within, .re-input-row:focus-within {
      background: #fff;
      border-color: var(--mimoja-blue);
    }
    .dye-form-input-wrap:focus-within .dye-form-input,
    .dye-form-input-wrap:focus-within .dye-form-textarea,
    .re-input-row:focus-within .re-input { color: #111; }
  `;
}

/**
 * Page shell for dev-style pages (Tailwind + REA CSS variables).
 * Use this instead of pageShell() for pages ported from dev/.
 */
export function devPageShell(
  title: string,
  content: string,
  styles: string = "",
  scripts: string[] = [],
  opts: DevShellOptions = {}
): string {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <!-- interactive-widget=overlays-content: on-screen keyboard overlays the page instead of resizing/shrinking it -->
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=overlays-content" />
  <title>DYE2 - ${title}</title>
  ${/* Served by our own "plotly" route, never a CDN — the tablet is offline. Deliberately
        page-relative so it resolves under both runtimes: /api/v1/plugins/dye2.reaplugin/
        dashboard -> .../plotly on the tablet, and /dashboard -> /plotly on the dev server. */
    opts.plotly ? '<script src="plotly" charset="utf-8"></script>' : ""}
  <style>${tailwindCss}</style>
  <style>${cssVarFallbacks()}${styles}</style>
</head>
<body>
  ${content}
  <script>${fitScript}</script>
  ${scripts.map((s) => `<script>${s}</script>`).join("\n")}
</body>
</html>`;
}
