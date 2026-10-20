/**
 * Dark mode for every DYE2 page: the resolution rule and the bootstrap that applies it,
 * as browser-side script strings (no local imports, so test/theme.test.mjs can eval the
 * rule directly). One copy of the rule, used by both the page and the test — the string is
 * not type-checked, so a second hand-mirrored TS copy would only be a place to drift.
 *
 * DYE2 is a follower of the Streamline skin's theme and never a writer. Two inputs:
 *  - `?theme=dark|light` — the skin passes it when it opens a plugin page as an overlay
 *    (plugin-view.js). The full-page path (the DYE button) passes none.
 *  - KV `streamlineSettings/theme` — the skin's durable copy. The skin's own localStorage
 *    is on another origin (port 3000 vs the plugin UI's 8080), so KV is the only way to
 *    learn the preference; `dye2Theme` in our own localStorage caches it so a repeat visit
 *    paints right the first time and never flashes.
 *
 * A URL param wins over everything, including a fresher remote answer: it is what the skin
 * said when it opened this very page, and it is what makes `/dashboard?theme=dark` a usable
 * preview on the dev server. A param is never written to the cache for the same reason.
 */
export const resolveThemeSource = `
function normalizeTheme(v) { return v === 'dark' || v === 'light' ? v : null; }
// param/cached/remote are raw (possibly junk or absent); junk counts as absent.
// theme = what to apply. cache = what to store in dye2Theme (null = leave it alone).
function resolveTheme(o) {
  var param = normalizeTheme(o.param);
  var cached = normalizeTheme(o.cached);
  var remote = normalizeTheme(o.remote);
  return {
    theme: param || remote || cached || 'light',
    cache: remote,
  };
}
`;

/** Inline in <head>, before the stylesheet, so the attribute is set before first paint. */
export const themeBootstrap = `
(function () {
  ${resolveThemeSource}
  var root = document.documentElement;
  var param = null, cached = null;
  // The WebView can refuse storage (private mode, blocked site data): every access is guarded.
  try { param = new URLSearchParams(location.search).get('theme'); } catch (e) {}
  try { cached = localStorage.getItem('dye2Theme'); } catch (e) {}
  root.setAttribute('data-theme', resolveTheme({ param: param, cached: cached }).theme);
  // Refresh from the skin's durable copy. Absolute path, same origin as the page: on the
  // tablet and through the dev server's proxy alike. 404 (never set), no Decaid, junk: all
  // swallowed, and the page stays on what it already applied.
  try {
    fetch('/api/v1/store/streamlineSettings/theme')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remote) {
        var r = resolveTheme({ param: param, cached: cached, remote: remote });
        if (r.cache) { try { localStorage.setItem('dye2Theme', r.cache); } catch (e) {} }
        if (root.getAttribute('data-theme') !== r.theme) root.setAttribute('data-theme', r.theme);
      })
      .catch(function () {});
  } catch (e) {}
})();
`;
