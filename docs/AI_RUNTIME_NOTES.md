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
`dev-api.ts`, `shot-paging.ts`, `recorded-shot.ts`, `chart.ts`, `shared-components.ts`,
`equipment-field.ts`, `bc-map.ts`. Pages pass them to the shell as a script list.
Plugin-runtime code that is not a page (`echarts-asset.ts`, `recent-favs.ts`) is instead
plain, real, type-checked TypeScript, imported normally by `plugin.ts` — no
template-literal string, no browser runtime involved.

## Routing

`dye2-plugin/src/plugin.ts:44` is a flat `switch` on `request.endpoint` — 16 page routes
plus an `echarts` asset route. Nothing is auto-discovered.

**Adding a page means editing three hand-maintained lists that nothing keeps in sync:**

1. `src/plugin.ts` — the import and a new `case`.
2. `dye2-plugin/dev-server.mjs:147` — the `PLUGIN_ROUTES` array.
3. `dye2-plugin/manifest.src.json` — an `api[]` entry (`{"id": "...", "type": "http", "data": {}}`).

Miss #2 and the page 404s in dev but works on the tablet. Miss #3 and it works in dev but
the host never exposes the route in production — the inverse failure, and the slower one to
notice. No test covers either. All three currently hold 17 entries; the check at the bottom
of this note compares them.

`plugin.ts:27` carries a hardcoded `version: "0.1.0"` that nobody syncs to the release tag.
The version users and the dashboard see comes from the manifest and `package.json` — see
`AI_BUILD_NOTES.md`. Do not "fix" it during a release.

### Page query params

Pages are opened by the skin (Streamline) too, and the skin lives on another origin than the
bridge, so **sessionStorage cannot cross that boundary**: anything the skin needs to hand a
page travels in the URL. Current params:

- `?return=<url>` — where Back/Done goes (any page).
- `?id=<recipeId>` — `recipe-edit` only: edit that recipe. Wins over `sessionStorage.dye_editRecipeId`.
- `?new=1` — `recipe-edit` only: start a blank recipe, ignoring any stored id.
- `?slot=<1..5>` — `recipe-edit` only: the R-strip slot this recipe is headed for. The skin
  sends it when a BLANK strip cell is tapped, so the editor opens with that tab selected and
  SAVE lands on the cell the barista actually pressed. Out-of-range or missing means no slot
  (saved to the library), and the recipe's own `stripSlot` is only overridden when the value
  is a valid 1..5.

`recipe-edit` copies `id` into `dye_editRecipeId`, then drops `id`/`new`/`slot` from the address
bar (`history.replaceState`, `return` kept), so a picker round trip or reload keeps the same
recipe and neither a `new` nor a `slot` is replayed. DYE2's own pages still use the sessionStorage key.

## Page Assembly

Every live page uses one shell:

```ts
devPageShell(title, content, styles, scripts, opts)   // src/utils/dev-shell.ts:205
```

It injects, in order: the theme bootstrap script (`utils/theme.ts`), the `interactive-widget=overlays-content` viewport tag, compiled
Tailwind (inlined — the tablet is offline, never a CDN), `cssVarFallbacks()` plus the
page's own `styles`, then `content`, then `fitScript`, then each entry of `scripts` as its
own `<script>`.

`opts.echarts` adds a **page-relative** `<script src="echarts">`, deliberately relative so it
resolves both as `/api/v1/plugins/dye2.reaplugin/echarts` on the tablet and `/echarts` in dev.
Do not make it absolute.

`src/pages/layout.ts` is **dead** — zero importers, both `pageShell()` and `sharedStyles()`.
There is one shell and one visual language, not two. Ignore the file; do not extend it.
Same for `src/components/` and `src/api/client.ts`.

## CSS Variables Are Plugin-Defined

`cssVarFallbacks()` (`dev-shell.ts`) defines `--mimoja-blue`, `--box-color`, `--text-primary`
and friends, and **those values are the production ones**: Decaid injects no CSS or theme
into plugin pages (nothing in `plugin_manager.dart` or `webui_service.dart`). Names match the
Streamline skin's; the dark values are the skin's too. See "Dark mode" in `AI_UI_NOTES.md`.

Style against the variables, never a hex, so that dark mode reaches your markup.

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

- no fixed and no scrollable ancestor, or a scroller that is still short after scrolling and
  padding → translate the page root (`body.firstElementChild`, not `body`, which carries the
  scale) up by the remaining overlap / scale.

The decision is the pure `kbPlan()` in `src/utils/kb-plan.ts` (tested by `test/kb-plan.test.mjs`);
`kbAdjust()` only measures and applies. Checks run at 50/150/350/600 ms after `focusin`/
`focusout` and on `visualViewport` `resize`/`scroll`, cancelled by the next event; `kbReset()`
is idempotent and undoes transform, scrollTop and padding. Preserve the geometry-only guard
and the scale division; a naive `scrollIntoView` regresses both cases.

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
| Colour wrong in dark mode | A hex in markup instead of a token from `cssVarFallbacks()` |
| Script silently does nothing on tablet | Typo in a browser-code string — no build check covers it |
| `${...}` produced plugin values, not browser ones | Unescaped `${` inside a script string; use `\${` |
| Page squashes while typing | Refit guard bypassed; see the geometry-only rule above |
| Field hidden behind keyboard | `kbAdjust()` — modal vs inline path, and the `lastSy` division |
| Modal overlay does not scale with the page | Overlay moved out of `body`'s direct children |
| echarts 404s on tablet only | `src="echarts"` made absolute instead of page-relative |

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
