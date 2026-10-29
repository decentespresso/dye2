# AGENTS.md

Guidance for AI coding agents working in this repo. For deeper dives, see the docs
referenced below — don't restate them here.

## What this repo is

DYE2 is a plugin for Decaid (Decent Espresso's tablet software). It manages beans, grinders,
equipment, roast/shot workflow, and adds a shot dashboard, auto-favourites and recipe editing.
This repo is the source of truth for DYE2; Decaid pulls a pinned release build from it.

## Read first

- `docs/AI_REPO_MAP.md` — task routing. Read the smallest matching AI_*.md note; don't preload all.
- `docs/AI_RUNTIME_NOTES.md` — **required before editing anything under `dye2-plugin/src/`**.
- `docs/AI_DATA_NOTES.md`, `docs/AI_UI_NOTES.md`, `docs/AI_BUILD_NOTES.md` — topic deep dives.
- `docs/KV_CONTRACT.md` — authoritative KV schemas (also the read-only consumer contract).
- Decaid's Dart source for host behaviour: `/Users/markc/Documents/streamline_js/reaprime/reaprime/`.
  Read it rather than guessing.

Existing instruction sources worth preserving: `CLAUDE.md` (runtime + verification rules) and
`.claude/skills/release/SKILL.md` (release procedure). Keep `AGENTS.md` consistent with both when
editing.

## The two runtimes — read before touching `dye2-plugin/src/`

A Decaid plugin is two programs in one repo that never share a scope:

- **Plugin runtime** (`flutter_js` on the tablet): TypeScript, no DOM, `fetch` only via the
  permission-gated bridge (DYE2's manifest declares `api`). The `fetch` plugin code gets is a
  wrapper-local const shadowed onto the plugin source, bound to that plugin's bridge token —
  `globalThis.fetch` always rejects. Most handler calls return HTML strings (server-side renderer).
- **Browser runtime**: the same files' exported template-literal strings, inlined as `<script>`
  tags by the shell. Inert text — no type checking, no build error; a typo fails at runtime on the
  tablet. `${...}` is interpolated by the plugin at render time, not the browser; escape literals
  with `\${`. `html` does **not** escape — wrap user data in `escapeHtml()`. Do not import browser
  APIs into plugin-runtime code.

## Commands (all in `dye2-plugin/`)

```bash
npm run build    # build:css (Tailwind) then vite → ../dye2.reaplugin/{plugin.js,manifest.json}
npm run dev      # vite build --watch — does NOT re-run build:css; run `npm run build` after adding Tailwind classes
npm run serve    # dev server; PORT=4444, BRIDGE_URL=http://localhost:8080; proxies /api/v1/*
npm test         # runs exactly the suites named in package.json's "test" script (no glob — add new suites there)
```

- `npm run dev` watcher rewrites `dye2.reaplugin/plugin.js`; stop it or `git checkout -- dye2.reaplugin/plugin.js` before git operations.
- `dye2.reaplugin/` is **generated and committed** — rebuild and commit with source changes.
- No lint or typecheck scripts exist. No CI step runs `npm test` — only build + validate.
- Single test: `node --experimental-strip-types test/<suite>.test.mjs` (some suites run under plain `node`).

## Gotchas

- **Adding/renaming a page** means editing three hand-maintained lists, nothing keeps them in sync:
  1. `dye2-plugin/src/plugin.ts` — import + `case "<endpoint>"`.
  2. `dye2-plugin/dev-server.mjs` — `PLUGIN_ROUTES` array.
  3. `dye2-plugin/manifest.src.json` — `api[]` entry.
  Dev-server miss → 404 in dev; manifest miss → never exposed in production (the inverse failure).
  No test covers either. After changing routes, diff the case list against the manifest ids (the
  check at the bottom of `docs/AI_RUNTIME_NOTES.md`).
- **Manifest**: source is `dye2-plugin/manifest.src.json`; vite copies it to the build output as
  `manifest.json`. Only the output may be named `manifest.json` — Decaid refuses install when it
  finds more than one candidate. Never add a second `manifest.json`.
- **Styling**: style against CSS variables from `cssVarFallbacks()` (`--mimoja-blue`, `--box-color`,
  `--text-primary`, …), never hex — those values are the production ones and dark mode depends on it.

## Verification

- Baseline: `cd dye2-plugin && npm run build && npm test`.
- **Any change that writes to the workflow** (DYE2 or Streamline) is not done until confirmed on
  Decaid's `/api/v1/workflow` endpoint: `curl -s http://localhost:8080/api/v1/workflow | jq '.context'`
  (dev server proxies, so `http://localhost:4444/api/v1/workflow` works too).
- Report what the endpoint returned, not what the page displayed; if it can't be checked (no bridge
  running / no tablet), say so explicitly.
- `PUT /api/v1/workflow` deep-merges — partial writes can land partially or on wrong sub-objects.

## Release

- Committed version is the source of truth; the tag must agree. Four files must read the same
  version: `dye2-plugin/manifest.src.json`, `dye2.reaplugin/manifest.json`, `dye2-plugin/package.json`,
  `dye2-plugin/package-lock.json`.
- Bump on `main`, then `git tag vX.Y.Z && git push origin vX.Y.Z`. Workflow builds, validates
  (non-empty outputs, `id`, `apiVersion`, `version`, `createPlugin` present), zips with
  `dye2.reaplugin/` as top-level entry, publishes to Releases. Push to `main` publishes to the
  `dist` branch instead (branch root = contents of `dye2.reaplugin/`, not the folder itself).
- Full procedure: `.claude/skills/release/SKILL.md`.

## Repo map (ownership)

- `dye2-plugin/src/` — plugin + browser source (TypeScript; pages hold both runtimes' code).
- `dye2-plugin/src/utils/` — shared browser-side code as string exports; pure TS helpers run in plugin runtime.
- `dye2-plugin/src/pages/` — one module per route; each ends with `devPageShell(...)`.
- `dye2-plugin/dev-server.mjs` — local host + bridge proxy; serves the **build output**, not src.
- `dev/` — legacy plain JS/HTML for Decaid's native DYE pages; no build step, reference material.
- Dead code — do not copy or extend: `dye2-plugin/src/components/`, `dye2-plugin/src/api/client.ts`, `dye2-plugin/src/pages/layout.ts`.
