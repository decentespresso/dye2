# AI Figma Notes

Read this before any `use_figma`, `get_design_context`, or asset import — and when
translating a Figma frame into a page.

For how pages are built and styled, read `AI_RUNTIME_NOTES.md` and `AI_UI_NOTES.md` first;
this note covers only what is Figma-specific.

## TL;DR

- **No React/Vue/JSX, and no Web Components.** UI ships as HTML strings assembled by page
  modules, with browser behaviour in separate script strings. Translate frames into HTML +
  CSS strings, not component props.
- **One shell, one visual language** — `devPageShell()`, light, large-touch, REA-native.
  Anything describing a second "dark plugin theme" is obsolete.
- **One token set:** the CSS custom properties in `cssVarFallbacks()`. Bind Figma variables
  to those names; never hardcode hex.
- **Tailwind is a local build-time step**, available on every page, inlined into the HTML.
  Not a CDN. Arbitrary-value classes are the norm.
- Icons are **inline Lucide SVG** (preferred) or legacy base64 PNG data-URIs. No icon font,
  no sprite, no `<img src>` to a file.
- **The tablet is offline.** Nothing loads from a CDN — not Tailwind, not Plotly, not fonts.
  Every asset is inlined or served by our own route.

## Scale Factor

Figma canvas is **2560×1600**. Code design reference is **1920×1200**.

> **Figma px × 0.75 = code px.** Apply it to every spec you lift.

Sizes are absolute CSS pixels at that reference; the shell scales the whole page. There are
no breakpoints and no responsive layout — do not add any. `DYE2_REDESIGN_PLAN.md` has a
pre-scaled table of the common values.

## Tokens

`dye2-plugin/src/utils/dev-shell.ts` → `cssVarFallbacks()`:

```
--bgmain-color      --box-color        --mimoja-blue   /* brand / primary accent */
--text-primary      --text-primary-disabled            --low-contrast-white
--profile-button-outline-color         --profile-button-background-color
--fav-button-wait
/* redesign extras */
--dye-chart-red  --dye-chart-blue  --dye-chart-green  --dye-chart-pink
--dye-surface    --dye-border
```

The hex values in that function are **dev-server fallbacks only** — REA injects the real,
theme-dependent values in production. So: a new colour from Figma gets a new `--var` added
to `cssVarFallbacks()` and is referenced as `var(--name)` or Tailwind `[var(--name)]`.
Never inline the raw hex, and never treat the fallback value as the real one.

Font is `'Inter'` then system fallbacks. Type runs large — labels ~24px, buttons ~82px tall
— because this is a touch tablet.

## Frame → Code

- Reuse existing classes before inventing any. Search `shared-components.ts` for `.dye-*`
  and the page's own styles first.
- A reusable control becomes a Css/Html/Script triad in `src/utils/shared-components.ts` —
  see `AI_UI_NOTES.md`. A one-off stays in the page module.
- Any dropdown or combo must match the canonical `.afe-combo*` pattern, including the
  `mousedown` + `preventDefault` behaviour. Do not translate a Figma dropdown into a fresh
  implementation.
- Do not introduce React, CSS-in-JS, a runtime Tailwind CDN, or an image pipeline to satisfy
  an import.

## Icons

Primary system is `src/utils/lucide.ts` — `PATHS` keyed by the exact kebab-case Lucide name,
rendered by `lucideIcon(name, size=36, color='currentColor', strokeWidth=2, fill='none')`,
with `starIcon(filled)` as a helper. An unknown name falls back to a circle.

Figma designs mostly use Lucide already. When they do: add the path data to `PATHS` under
the exact Lucide name and call `lucideIcon('name')`. **Do not export icon PNGs from Figma
when a Lucide equivalent exists.** Default stroke is `currentColor`; brand accent is
`var(--mimoja-blue)`.

`src/utils/icons.ts` holds four legacy base64 PNGs from the `dev/` port. Do not add to it.

## Redesign Screen Map

Source: Figma `Streamline_Decent (Copy)`, page node **`2345:493`** ("DYE Redesign").
This is the map of how screens link, so page code and the route switch match the intended
flow.

| Screen | Figma node | Code page |
| --- | --- | --- |
| DYE Dashboard v5 | `2345:495`, `2345:1227`, `2386:2312`, `2386:1419` | `pages/dashboard.ts` |
| DYE_Edit Shot v4 | `2345:2021` | `pages/edit-shot.ts` |
| DYE_Select Coffee Beans | `2345:2457`, `2345:2577` | `pages/bean-picker.ts` |
| DYE_Add New Bean | `2345:2721` | `pages/add-bean.ts` |
| DYE_Select Roaster | `2345:2216`, `2345:2337` | `pages/roasters.ts` |
| DYE_View All Auto Favourites | `2386:669` | `pages/auto-favs.ts` |
| Edit DYE Auto Favourite | `2386:1723` | `pages/auto-fav-edit.ts` |
| Edit Recipes | `2386:1873` | `pages/recipe-edit.ts` |
| Fullscreen Visualizer | `2386:824`, `2386:1121` | host-side / deferred |

Auto-favourite dashboard strip anchors: `2386:1116` (P/F/R toggle), `2386:901` (5-slot
strip), `2386:893` (DYE / Settings / Sleep group). Background in
`AUTOFAV_DASHBOARD_PLAN.md`.

### Navigation rules that matter for code

- **Dashboard is the hub.** Every screen is reached from it — directly or via the
  `DYE Settings ▾` menu — and returns to it on CANCEL/DONE/SAVE. No deep back-stack; think
  modal-over-hub.
- **Pickers are reusable and context-agnostic.** `bean-picker`, `roasters`,
  `grinder-picker`, `basket-picker`, `profile-picker` are opened from several places and
  must return the selection to whoever invoked them, not hard-navigate to a fixed screen.
- **Bean → Roaster is a 2-step wizard.** The Select Beans CTA reads `SELECT ROASTER ▸` when
  a new bean needs a roaster; roaster selection returns to bean confirm.
- **Recipes and Auto Favourites are the two config branches** off `DYE Settings`. Recipes
  populate the Next-Shot chips (each gated by "Show on Streamline Dashboard"); auto
  favourites populate the Visualizer tabs and the Streamline chip strip.
- **Fullscreen Visualizer is REA-native**, not a plugin page. `VIEW ALL AUTO FAV` is the one
  link back into plugin territory.

## Troubleshooting

| Symptom | First place to inspect |
| --- | --- |
| Imported design is ~33% too large | Missing the ×0.75 Figma→code scale |
| Colours right in dev, wrong on tablet | Raw hex from Figma instead of a `--var` |
| Icon looks wrong or renders a circle | Name not in `PATHS`, or not the exact Lucide name |
| Asset 404s on the tablet | Something pointed at a CDN; the tablet is offline |
| New dropdown behaves oddly | Did not follow the `.afe-combo*` pattern |

## Focused Checks

```sh
cd dye2-plugin && npm run build && npm run serve
```

Size the browser window to 16:10 before comparing against Figma — otherwise the shell's
independent x/y scaling stretches the page by up to 15% and every measurement is off. See
`AI_RUNTIME_NOTES.md`.
