# CLAUDE.md

DYE2 is a plugin for Decaid / Streamline (the Decent Espresso tablet software). It manages
coffee beans, grinders and equipment, and adds a shot dashboard, auto-favourites and recipe
editing.

## Two runtimes — read this before editing `dye2-plugin/src/`

`dye2-plugin/src/` is TypeScript that runs inside `flutter_js`: no DOM, and no `fetch`
**unless** the plugin declares the `api` permission (dye2's manifest does). The plugin
wrapper then shadows a local `const fetch` bound to that plugin's own bridge token
(`plugin_manager.dart:2033-2035`, in scope for the injected plugin source at `:2229-2230`)
— not the always-rejecting `globalThis.fetch` defined earlier (`:921-963`; it calls
`__fetchFor` with a null bridge token, which rejects at `:943`). Most code still answers
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
npm test         # 24 suites under test/ (the list lives in package.json)
```

`dye2.reaplugin/` is generated **and committed** — rebuild and commit it with any source
change.

## Verification

**Any change that writes to the workflow — from DYE2 or from Streamline — is not done until
the value is confirmed on Decaid's own `/workflow` endpoint.** The UI showing the new number
proves nothing: the page holds its own copy, and `PUT /api/v1/workflow` *deep-merges* onto
whatever the machine already has (`workflow_handler.dart` `_applyUpdate`), so a write can
land partially, land on the wrong sub-object, or be silently dropped.

```bash
curl -s http://localhost:8080/api/v1/workflow | jq '.context'     # GET needs no token
```

Against the tablet, swap in its address. `npm run serve` proxies `/api/v1/*` to
`localhost:8080`, so `http://localhost:4444/api/v1/workflow` works while the dev server is
up. Make the change in the UI, re-read the endpoint, and check both halves: the field you
meant to set holds the new value, **and** nothing else moved — especially `profile.steps`,
which a `{id, title}` profile stub overwrites by name while leaving the old steps in place.

Report what the endpoint returned, not what the page displayed. If it cannot be checked
(no tablet, no bridge running), say so explicitly rather than implying it was verified.

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
