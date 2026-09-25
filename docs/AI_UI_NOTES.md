# AI UI Notes

Read this when adding a control, a picker or dropdown, an icon, page styling, or anything
that has to look like the rest of DYE2.

Everything here is browser-runtime code emitted as strings — read `AI_RUNTIME_NOTES.md`
first if you have not.

## The Css / Html / Script Triad

`dye2-plugin/src/utils/shared-components.ts` is the component library, and it is not
components in any framework sense. Each control is up to three separate exports:

```ts
sortSidebarCss()        // style block, called at render time
sortSidebarHtml()       // markup string, called at render time
sortSidebarScript       // browser code, passed to devPageShell's scripts[]
```

The same triad exists for the stepper, preset strip, toggle row, picker card, segment
control, star rating, enjoyment scale, expand field and text input. Some have only two of
the three. A page pulls the CSS into its `styles` argument, the HTML into `content`, and the
script into `scripts[]`.

When adding a control: follow the triad, export it from `shared-components.ts`, and take an
`idPrefix`/`id` argument the way the existing ones do — the scripts find their elements by
convention (`${id}-input`, `${id}-drop`) rather than by passing references, because the two
halves cannot share values at runtime.

`src/components/` is a dead Web Component experiment — the only `customElements.define` in
the tree, zero importers. Do not copy or extend it.

## Dropdowns And Combo Pickers

**The canonical pattern is the auto-fav-edit combo.** Match it; do not invent another.
Source: `.afe-combo*` in `src/pages/auto-fav-edit.ts:45-66`. The working copy to crib from
is `.re-combo-drop` in `src/pages/recipe-edit.ts`.

Look:

| Part | Style |
| --- | --- |
| `.afe-combo` | `position: relative` wrapper |
| `.afe-combo-drop` | `1px solid var(--profile-button-outline-color)`, `border-radius: 12px`, `box-shadow: 0 8px 24px rgba(0,0,0,0.12)`, `max-height: 300px; overflow-y: auto`, `z-index: 40`, `top: calc(100% + 4px)`, `background: var(--box-color)` |
| `.afe-combo-opt` | `padding: 14px 18px; font-size: 22px; color: var(--text-primary)`, `border-bottom` between rows, none on last, hover `background: var(--bgmain-color)` |
| `.afe-combo-empty` | `padding: 14px 18px; font-size: 20px; color: var(--text-primary-disabled)` |

Behaviour, and this part is not cosmetic: bind option selection to **`mousedown` with
`preventDefault()`**, not `click` (`auto-fav-edit.ts:348,358`). The input's blur closes the
drop, and a `click` handler fires *after* blur — so the drop is already gone and the pick is
lost. `preventDefault` on `mousedown` stops the blur from happening first. Blur still
commits the typed value, on a delay, so the option's `mousedown` lands first
(`auto-fav-edit.ts:617`).

## Icons

Two systems, and they are not interchangeable:

- `src/utils/lucide.ts` — inline Lucide **SVG** path data, ~20 icons, keyed by name. **Use
  this for new work.** Add an icon by pasting its path data into `PATHS`.
- `src/utils/icons.ts` — four base64 **PNG** data-URIs carried over from the `dev/` pages
  (`dev/dye/icons/`). Legacy. Do not add to it.

There is no icon font, no sprite sheet and no `<img src>` pointing at a file — the tablet is
offline and pages are single self-contained documents.

## Styling Rules

- **Style against the CSS variables**, never the hex fallbacks. `cssVarFallbacks()` in
  `dev-shell.ts:129` only fires on the dev server; REA injects the real, theme-dependent
  values in production. See `AI_RUNTIME_NOTES.md`.
- Common variables: `--bgmain-color`, `--box-color`, `--mimoja-blue`,
  `--profile-button-outline-color`, `--text-primary`, `--text-primary-disabled`, plus the
  `--dye-*` redesign extras (chart colours, surface, border).
- Tailwind is available on every page and is inlined at build time. Write **complete class
  names** in source strings — the scanner reads `./src/**/*.ts` and purges anything it
  cannot see literally. Arbitrary values (`bg-[var(--mimoja-blue)]`, `rounded-[68px]`) work.
- Design reference is **1920×1200**; Figma canvas is 2560×1600, so **Figma px × 0.75 = code
  px**. Sizes are written in plain CSS pixels at that reference — the shell scales them.
- The page **never scrolls**. `body` is `overflow: hidden` and fitted by transform. Content
  that overflows needs its own scrollable container.

## Touch And Selection

`body` sets `user-select: none` and kills the long-press callout, because this is a tablet
app and long-press belongs to DYE2's own gestures. On the auto-favs page a first tap selects a card,
tapping the selected card again (or a 500ms long-press) opens its edit page — for a recent, pre-filled,
with SAVE creating a new saved favourite.
Inputs, textareas and `[contenteditable]` opt back in. If you add a control that needs text
selection or a caret, it must be one of those or carry the same opt-in.

Focused fields go white with a blue caret, and wrappers (`.dye-form-input-wrap`,
`.re-input-row`) respond via `:focus-within` — so a field drawn transparent inside a bordered
wrapper paints the wrapper instead. Reuse those class names rather than restyling focus.

Do not add `button { border: none }`. Tailwind preflight already zeroes border width, and a
blanket rule beats `border-2` on specificity — it silently flattened every bordered button
once already.

## Fields Near The Bottom

Anything that can be focused low on the page interacts with keyboard avoidance. A field
inside a `position: fixed` modal gets translated; an inline field gets its nearest
scrollable ancestor scrolled. So an inline field needs a scrollable ancestor to be rescued
at all. Details in `AI_RUNTIME_NOTES.md`.

## Troubleshooting

| Symptom | First place to inspect |
| --- | --- |
| Dropdown closes without registering the pick | `click` used instead of `mousedown` + `preventDefault` |
| Tailwind class does nothing | Purged — name assembled dynamically, or `build:css` not re-run |
| Colours right in dev, wrong on tablet | Styled against fallback hex instead of the CSS variable |
| Bordered buttons lost their borders | A blanket `button { border: none }` beating `border-2` |
| Control looks slightly off vs Figma | Forgot the ×0.75 scale factor |
| Page content cut off with no scrollbar | `body` is `overflow: hidden` by design; add a scroll container |
| Long-press selects text instead of firing a gesture | Element inherits the `user-select: text` opt-in |
| Icon missing | Name absent from `PATHS` in `lucide.ts` |

## Focused Checks

```sh
cd dye2-plugin && npm run build && npm run serve
```

Compare against the existing combo at `/auto-fav-edit` and `/recipe-edit` before shipping a
new dropdown. Check any new control at a 16:10 window size, and with the field focused near
the bottom of the viewport.
