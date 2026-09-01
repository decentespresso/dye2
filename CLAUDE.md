# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DYE2 is a plugin for the Streamline/REA (Decent Espresso App) tablet software. It manages coffee beans, grinders, and equipment. The repo has two distinct parts with different runtimes and build requirements.

## Repository Structure

```
dye2/
├── dye2-plugin/          # TypeScript plugin (has a build step)
│   ├── src/
│   │   ├── plugin.ts     # Entry point — implements PluginInstance interface
│   │   ├── host.d.ts     # flutter_js host API types
│   │   ├── pages/        # Page-level orchestrators (beans, grinders, pickers)
│   │   ├── components/   # UNUSED — Web Component experiment, nothing imports it
│   │   ├── api/          # UNUSED — earlier REST client (client.ts), nothing imports it
│   │   └── utils/        # Browser-code strings (dev-api, chart, shot-paging, icons),
│   │                     # dev-shell.ts (devPageShell), html.ts (html`` + escapeHtml)
│   ├── dev-server.mjs    # Dev server: serves plugin pages, proxies /api/v1/* to bridge
│   ├── manifest.src.json # Plugin metadata and permissions (copied to the build output as manifest.json)
│   └── vite.config.ts    # Builds to IIFE → ../dye2.reaplugin/plugin.js
│
├── dev/                  # Plain JS/HTML for REA's native DYE workflow pages (no build step)
│   ├── dye/              # HTML pages loaded by REA's webview router
│   ├── dye.js            # Bean/roaster picker logic + add-bean form
│   └── dyeDashboard.js   # Dashboard (shot history, grinder selection, workflow)
│
├── dye2.reaplugin/       # Build output (generated — do not edit directly)
└── rea_restapi.yml       # OpenAPI spec for the Streamline Bridge REST API
```

## Commands

### dye2-plugin (TypeScript plugin)

```bash
cd dye2-plugin

npm run build    # one-shot build → dye2.reaplugin/plugin.js
npm run dev      # watch mode (use alongside serve)
npm run serve    # dev server at http://localhost:4444
                 # PORT=4444, BRIDGE_URL=http://localhost:8080
```

Dev server auto-reloads when `plugin.js` changes on disk. Run `npm run dev` and `npm run serve` in parallel terminals. Override defaults: `PORT=4000 BRIDGE_URL=http://192.168.1.5:8080 npm run serve`.

### dev/ (no build)

Files are consumed directly by REA. No build or install step needed. Open the HTML pages via the dev server or load them directly in a browser with a running bridge.

## Architecture: Two Runtimes

**Plugin runtime (flutter_js):** `dye2-plugin/src/` code runs inside `flutter_js` on the tablet. The plugin implements `PluginInstance` and responds to `__httpRequestHandler` calls — acting as a server-side HTML renderer. It has access to `PluginHost` (log, emit, storage) but no DOM or browser APIs.

**Browser runtime:** `src/utils/*.ts` and `src/pages/*.ts` export browser JavaScript as plain string constants. These strings are inlined as `<script>` tags by `devPageShell()` and execute in the tablet's WebView, calling `/api/v1/*` directly via `fetch()`. The split runs through files, not just between them: a plugin-runtime module's main export is often a long string of browser code.

## Key Patterns

**Browser code as string exports:** Shared browser-side JavaScript lives in `src/utils/*.ts` as exported template literals (`dev-api.ts`, `shot-paging.ts`, `chart.ts`, `shared-components.ts`, `icons.ts`). These are NOT executed by the plugin — they're inlined into HTML as `<script>` blocks. Do not import browser APIs in plugin-runtime code.

**Page assembly:** Live pages call `devPageShell(title, content, styles, scripts, opts)` from `src/utils/dev-shell.ts`, passing shared strings plus a per-page orchestration script — e.g. `devPageShell("Grinders", content, styles, [devApiScript, pageScript])`.

**Dead code — do not copy or extend:** `src/components/` (the only `customElements.define`/`CustomEvent` in the tree), `src/api/client.ts`, and `pageShell()` in `src/pages/layout.ts` all have zero importers. Earlier docs described these as the house style; they are not.

**HTML safety:** Use `escapeHtml()` from `src/utils/html.ts` for user-provided data interpolated into HTML strings. The `html` tagged template does NOT escape values.

**API base:** Browser-side components hit `/api/v1/*` directly. The dev server proxies these to the Streamline Bridge. In production, REA handles routing.

## Streamline Bridge API

See `rea_restapi.yml` for full OpenAPI spec. Core resources used by this plugin:
- `GET/POST /api/v1/beans` — bean list/create
- `GET/PUT/DELETE /api/v1/beans/:id` — bean detail
- `GET/POST /api/v1/beans/:id/batches` — roast batches
- `GET/PUT/DELETE /api/v1/bean-batches/:id`
- `GET/POST /api/v1/grinders`
- `GET/PUT/DELETE /api/v1/grinders/:id`
- `GET/PUT /api/v1/workflow` — active shot workflow (dose data, grinder settings)

Beans/grinders are real, typed bridge resources. Auto-favourites, recipes, and
(for now) filter baskets have no bridge resource of their own and are instead
persisted through the bridge's generic, **unscoped** per-plugin KV store
(`/api/v1/store/{namespace}/{key}` — readable/writable by any skin or plugin,
not just the owner). See `dye2-plugin/KV_CONTRACT.md` for the schema and the
single-writer convention this relies on.
