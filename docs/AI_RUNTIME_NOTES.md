# AI Runtime Notes

Read this when adding or changing a plugin page, touching the page shell, writing
browser-side JavaScript, changing routing, or debugging scaling and keyboard behaviour.

## Two Runtimes, One File Tree

The split runs **through** files, not between them. A single module in
`dye2-plugin/src/` usually contains both:

| | Plugin runtime | Browser runtime |
| --- | --- | --- |
| Where | `flutter_js` on the tablet | the tablet's WebView |
| What | TypeScript, compiled by Vite | plain JS inside exported template literals |
| Has | `PluginHost` (`host.d.ts`) | DOM, `fetch`, `window` |
| Lacks | DOM, `fetch`, `window`, timers beyond the host's | imports, types, build-time checking |
| Job | render an HTML string for a request | run that HTML once it reaches the WebView |

A page module's exported `renderXPage(request)` runs in the plugin. The long
backtick strings it splices in do not — they are inert text until the WebView parses them.

Consequences that bite:

- Browser code gets **no type checking and no build error**. A typo inside a script string
  compiles fine and fails at runtime on the tablet.
- `${...}` inside a browser-code string is evaluated by the **plugin**, at render time, not
  by the browser. To emit a literal `${` for the browser, escape it (`\${`).
- The plugin **does** have a `fetch`, but not the `globalThis.fetch` Decaid defines at
  `plugin_manager.dart:921-963` — that one always rejects with a null bridge token
  (`:943`), a shared baseline stub, not what plugin code actually gets. The real one is a
  local `const fetch` the plugin wrapper shadows it with, bound to that plugin's own
  bridge token and gated by the `api` permission (`:2033-2035`), in scope where the
  plugin's own source is evaluated (`:2229-2230`). (Cross-plugin HTTP calls —
  `/api/v1/plugins/<id>/<endpoint>` — are gated by the same permission separately, at
  `:3134`.) Most bridge access is still browser-side by convention (`AI_DATA_NOTES.md`),
  but plugin-runtime code that needs the bridge itself — `recent-favs.ts` is the first
  example — can call `fetch` directly. The dev-server's vm sandbox does not provide it
  (`dev-server.mjs`'s `loadPlugin()`), so guard with `typeof fetch === 'function'`.
- `onEvent` receives `shotStored` / `shotUpdated` only with the `events.shots` permission
  (`plugin_manager.dart:2478`); the dev server never dispatches either, so anything gated on
  them needs another trigger for local dev (a page's own explicit call, for instance).
- Do not import browser APIs into plugin-runtime code, and do not expect a script string to
  see any module-scope value except through interpolation.

Browser code shared across pages lives as exported string constants:
`dev-api.ts`, `shot-paging.ts`, `chart.ts`, `shared-components.ts`, `equipment-field.ts`,
`bc-map.ts`. Pages pass them to the shell as a script list. Plugin-runtime code that is not
a page (`plotly-asset.ts`, `recent-favs.ts`) is instead plain, real, type-checked TypeScript,
imported normally by `plugin.ts` — no template-literal string, no browser runtime involved.

## Routing

`dye2-plugin/src/plugin.ts:44` is a flat `switch` on `request.endpoint` — 15 page routes
plus a `plotly` asset route. Nothing is auto-discovered.

**Adding a page means editing three hand-maintained lists that nothing keeps in sync:**

1. `src/plugin.ts` — the import and a new `case`.
2. `dye2-plugin/dev-server.mjs:147` — the `PLUGIN_ROUTES` array.
3. `dye2-plugin/manifest.src.json` — an `api[]` entry (`{"id": "...", "type": "http", "data": {}}`).

Miss #2 and the page 404s in dev but works on the tablet. Miss #3 and it works in dev but
the host never exposes the route in production — the inverse failure, and the slower one to
notice. No test covers either. All three currently hold 16 entries; the check at the bottom
of this note compares them.

`plugin.ts:27` carries a hardcoded `version: "0.1.0"` that nobody syncs to the release tag.
The version users and the dashboard see comes from the manifest and `package.json` — see
`AI_BUILD_NOTES.md`. Do not "fix" it during a release.

## Page Assembly

Every live page uses one shell:

```ts
devPageShell(title, content, styles, scripts, opts)   // src/utils/dev-shell.ts:205
```

It injects, in order: the `interactive-widget=overlays-content` viewport tag, compiled
Tailwind (inlined — the tablet is offline, never a CDN), `cssVarFallbacks()` plus the
page's own `styles`, then `content`, then `fitScript`, then each entry of `scripts` as its
own `<script>`.

`opts.plotly` adds a **page-relative** `<script src="plotly">`, deliberately relative so it
resolves both as `/api/v1/plugins/dye2.reaplugin/plotly` on the tablet and `/plotly` in dev.
Do not make it absolute.

`src/pages/layout.ts` is **dead** — zero importers, both `pageShell()` and `sharedStyles()`.
There is one shell and one visual language, not two. Ignore the file; do not extend it.
Same for `src/components/` and `src/api/client.ts`.

## CSS Variables Are Host-Injected

`cssVarFallbacks()` (`dev-shell.ts:129`) defines `--mimoja-blue`, `--box-color`,
`--text-primary` and friends **for the dev server only**. In production REA injects the real
values, which differ and follow the user's theme.

So: style against the variables, never against the fallback hex. A colour that looks right
at `localhost:4444` proves nothing about the tablet.

## Scaling — Do Not "Fix" The Stretch

Pages are authored at a fixed **1920×1200** design reference (Figma canvas × 0.75).
`fitScript` scales `<body>` by transform, x and y **independently**, clamped at
`MAX_STRETCH = 1.15` (`dev-shell.ts:23`).

A desktop browser window that is not 16:10 therefore renders **up to 15% stretched, on
purpose**. The tablet is 16:10, so `sx === sy` there and nothing distorts. This was
chosen deliberately over uniform scale + letterbox.

If a page looks wide or off-proportion: check the body `transform` matrix first. Differing
x and y scales are the shell, not the page CSS. To compare against Figma, size the window
to 16:10 or temporarily override the transform to a uniform scale.

Transform is applied to `body` itself so that `position: fixed` modal overlays — siblings of
the page root, both direct children of `body` — scale with it. Keep that structure.

## Keyboard Avoidance

The page never moves for the Android soft keyboard. The refit guard (`dev-shell.ts:55`)
keys off geometry alone: a **width** change is a real resize (rotation), a **taller**
viewport means the keyboard left, and a same-width-but-shorter viewport *is* the keyboard
and is ignored. Deciding by `document.activeElement` does **not** work — the WebView fires
resize as the keyboard animates in, often before focus lands.

Because the page holds still, a focused field can end up under the keyboard. `kbAdjust()`
handles the two cases differently:

- field inside a `position: fixed` ancestor (a modal) → translate that modal up by the
  overlap, divided by the current scale, because the overlay lives in design px;
- field with no fixed ancestor (inline in the page) → scroll its nearest scrollable
  ancestor instead.

Both paths re-check on `focusin`/`focusout` one frame late. Preserve the geometry-only
guard and the scale division; a naive `scrollIntoView` regresses both cases.

## Dev Server

`dev-server.mjs` loads the built `dye2.reaplugin/plugin.js` into a Node `vm` whose context
holds only `console`, `setTimeout`, `clearTimeout` — a decent approximation of how little
the plugin runtime gives you. It serves the routes and proxies `/api/v1/*` to the bridge.

- Defaults: `PORT=4444`, `BRIDGE_URL=http://localhost:8080` (the file's own usage comment
  says 3000 — stale, the code says 4444).
- It serves the **build output**, not `src/`. Run `npm run dev` (vite watch) alongside
  `npm run serve`, or you will be looking at a stale page and wondering why your edit did
  nothing.
- It watches the *directory*, not the file, because vite and git replace `plugin.js` rather
  than editing in place.

## HTML Safety

`html` (`src/utils/html.ts:6`) is a marker for syntax highlighting and **does not escape**.
Interpolate user-provided data — bean names, roaster names, notes, drinker names — through
`escapeHtml()` (`html.ts:17`). Everything in this app is user-entered text, so the default
assumption for any value reaching HTML should be "needs escaping".

## Troubleshooting

| Symptom | First place to inspect |
| --- | --- |
| New page 404s in dev but works on tablet | `PLUGIN_ROUTES` in `dev-server.mjs:147` |
| New page works in dev but not on tablet | Missing `api[]` entry in `manifest.src.json` |
| Edit to a page does nothing | `npm run dev` not running; server serves built `plugin.js` |
| Page renders ~15% wide on desktop | Expected. `MAX_STRETCH`, `dev-shell.ts:23` — not a bug |
| Colours wrong on tablet, right in dev | Styled against `cssVarFallbacks()` hex instead of the variable |
| Script silently does nothing on tablet | Typo in a browser-code string — no build check covers it |
| `${...}` produced plugin values, not browser ones | Unescaped `${` inside a script string; use `\${` |
| Page squashes while typing | Refit guard bypassed; see the geometry-only rule above |
| Field hidden behind keyboard | `kbAdjust()` — modal vs inline path, and the `lastSy` division |
| Modal overlay does not scale with the page | Overlay moved out of `body`'s direct children |
| Plotly 404s on tablet only | `src="plotly"` made absolute instead of page-relative |

## Focused Checks

```sh
cd dye2-plugin
npm run build
npm run serve          # terminal 1
npm run dev            # terminal 2 — watch build
```

Then visit `http://localhost:4444/` for the route index. For any shell or scaling change,
resize the window to a 16:10 ratio and to a deliberately wrong one, and check a page with a
modal plus a page with inline fields near the bottom.

After adding or renaming a route, confirm the three lists still agree:

```sh
cd dye2-plugin
grep -oE '^\s+case "[a-z-]+"' src/plugin.ts | grep -oE '[a-z-]+' | grep -v case | sort > /tmp/a
node -e 'console.log(require("./manifest.src.json").api.map(x=>x.id).sort().join("\n"))' > /tmp/b
diff /tmp/a /tmp/b && echo "routes agree"
```
