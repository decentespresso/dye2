# CLAUDE.md

DYE2 is a plugin for Decaid / Streamline (the Decent Espresso tablet software). It manages
coffee beans, grinders and equipment, and adds a shot dashboard, auto-favourites and recipe
editing.

## Two runtimes — read this before editing `dye2-plugin/src/`

`dye2-plugin/src/` is TypeScript that runs inside `flutter_js`: no DOM, and no `fetch`
**unless** the plugin declares the `api` permission (dye2's manifest does) — then `fetch` is
a real, permission-gated global (`plugin_manager.dart:921-963`). Most code still answers
`__httpRequestHandler` calls by returning HTML strings — a server-side renderer — but plugin
code that isn't a page (`recent-favs.ts`) can and does call `fetch` itself.

The browser-side JavaScript lives in those same files as exported **template-literal
strings**, inlined as `<script>` tags. Those strings are inert text to the compiler, so they
get **no type checking and no build error** — a typo there fails at runtime on the tablet.

`dev/` is a separate set of plain JS/HTML pages for REA's native DYE workflow. No build step.

## Commands

```bash
cd dye2-plugin
npm run build    # build:css + vite → ../dye2.reaplugin/plugin.js
npm run dev      # vite watch (run alongside serve)
npm run serve    # dev server on :4444, proxies /api/v1/* to localhost:8080
npm test         # bc-map, shot-paging, equipment, enjoyment-scale, grinder edit, recent-favs
```

`dye2.reaplugin/` is generated **and committed** — rebuild and commit it with any source
change.

## Orientation

**@docs/AI_REPO_MAP.md routes any task to the one note that covers it.** Read the map, then
the smallest matching note. Do not preload them all.

| | |
| --- | --- |
| `docs/AI_RUNTIME_NOTES.md` | runtimes, routing, page shell, scaling, keyboard, escaping |
| `docs/AI_DATA_NOTES.md` | bridge REST, KV store, equipment, workflow, shots |
| `docs/AI_UI_NOTES.md` | shared controls, dropdowns, icons, styling |
| `docs/AI_BUILD_NOTES.md` | Vite, Tailwind, manifest, CI, releases |
| `docs/AI_FIGMA_NOTES.md` | Figma → code, tokens, screen map |
| `docs/KV_CONTRACT.md` | authoritative KV schemas |

Decaid's own Dart source — the authority on host behaviour — is checked out at
`/Users/markc/Documents/streamline_js/reaprime/reaprime/`. Read it rather than guessing.
