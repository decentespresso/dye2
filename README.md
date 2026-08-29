# DYE2

DYE2 (Describe Your Espresso) is a plugin for Decaid (formerly ReaPrime/Streamline), the tablet software for Decent Espresso machines. It manages coffee beans, roast batches, grinders, and equipment, and adds a shot dashboard, auto-favorites, and recipe editing on top of the stock DYE workflow.

This repo is the source of truth for DYE2 — [allofmeng/dye2](https://github.com/allofmeng/dye2). Decaid's own repo pulls a pinned release of it as a build asset (see "Reference Implementation: DYE2 Plugin" in Decaid's `doc/Plugins.md`).

## For users

Grab a release archive (`dye2.reaplugin-vX.Y.Z.zip`) from the [Releases](../../releases) page and install it through Decaid's plugin settings UI, or drop the unzipped `dye2.reaplugin/` folder into Decaid's `plugins/` directory and enable it.

Decaid embeds a pinned DYE2 release automatically via `scripts/fetch_dye2_plugin.sh`, so most users won't need to install this manually — it only matters if you want a newer/older version than what's currently pinned.

## User manual

New to DYE2? **[Read the user manual](MANUAL.md)** — what the plugin does, every screen it
adds, how to import your coffees from Beanconqueror, and the handful of gestures that
aren't obvious.

## For plugin developers

This repo doubles as a worked example of a Decaid plugin. If you're building your own, start with Decaid's `doc/Plugins.md` for the general plugin contract (manifest shape, `host` API, HTTP request handler, lifecycle, sandboxing rules) — this README only covers what's specific to DYE2.

### Repo layout

```
dye2/
├── dye2-plugin/          # TypeScript plugin (has a build step)
│   ├── src/
│   │   ├── plugin.ts     # Entry point — implements PluginInstance
│   │   ├── host.d.ts     # flutter_js host API types
│   │   ├── pages/        # Page-level orchestrators (beans, grinders, pickers, dashboard...)
│   │   ├── components/   # Web Components exported as JS strings
│   │   ├── api/          # Browser-side REST client (client.ts)
│   │   └── utils/        # html`` template, escaping, chart, date picker, etc.
│   ├── dev-server.mjs    # Dev server: serves plugin pages, proxies /api/v1/* to bridge
│   ├── manifest.src.json # Plugin metadata and permissions (copied to the build output as manifest.json)
│   └── vite.config.ts    # Builds to IIFE → ../dye2.reaplugin/plugin.js
│
├── dev/                  # Plain JS/HTML for REA's native DYE workflow pages (no build step)
│   ├── dye/              # HTML pages loaded by REA's webview router
│   ├── dye.js             # Bean/roaster picker logic + add-bean form
│   └── dyeDashboard.js    # Dashboard (shot history, grinder selection, workflow)
│
├── dye2.reaplugin/        # Build output (generated — do not edit directly)
└── rea_restapi.yml        # OpenAPI spec for the Decaid REST API
```

Two runtimes live side by side here:

- **Plugin runtime (`dye2-plugin/`, flutter_js):** runs on-device inside `flutter_js`, no DOM. Implements `PluginInstance` and answers `__httpRequestHandler` calls, acting as a server-side HTML renderer. Has `host.log` / `host.emit` / `host.storage`, nothing else.
- **Browser runtime (`dye2-plugin/src/components/`, and everything in `dev/`):** plain JS that runs in the tablet's WebView. Talks to Decaid over `fetch("/api/v1/...")` and wires itself up with `CustomEvent`.

`dev/` predates the TypeScript rewrite and is still what REA's native DYE workflow pages load directly — no build step, edit and reload.

### Building and running

```bash
cd dye2-plugin
npm install
npm run build    # one-shot build → dye2.reaplugin/plugin.js
npm run dev      # watch mode (run alongside serve)
npm run serve    # dev server at http://localhost:4444, proxies /api/v1/* to BRIDGE_URL
```

Run `npm run dev` and `npm run serve` in separate terminals; the dev server reloads when `plugin.js` changes on disk. Override the defaults with env vars: `PORT=4000 BRIDGE_URL=http://192.168.1.5:8080 npm run serve`.

`dev/` needs no install — open its HTML pages through the dev server or a browser pointed at a running bridge.

### Key patterns

- **Components as string exports** — each `src/components/*.ts` exports `const fooComponent = \`...\`\`, a string containing a Web Component class + `customElements.define(...)`. These are inlined as `<script>` tags by `pageShell()`, never executed by the plugin itself. Don't import browser APIs into plugin-runtime code.
- **Page assembly** — pages in `src/pages/` call `pageShell(title, content, [scripts])`; the scripts array holds component strings plus orchestration scripts.
- **Event flow** — components dispatch `CustomEvent({ bubbles: true })`; page-level scripts attach document-level listeners to show/hide siblings and trigger re-fetches.
- **HTML safety** — the `html` tagged template (`src/utils/html.ts`) does **not** escape values; wrap user-provided data in `escapeHtml()` yourself.
- **API base** — browser-side code hits `/api/v1/*` directly; the dev server proxies it to the bridge, REA handles routing in production.

See `rea_restapi.yml` for the full Decaid OpenAPI spec (beans, batches, grinders, workflow).

### Accessing favourites, recipes, and baskets

Beans and grinders are real Decaid resources (`/api/v1/beans`, `/api/v1/grinders`). Auto-favourites, recipes, and (for now) filter baskets have no bridge resource of their own — DYE2 persists them in Decaid's generic per-plugin KV store instead:

```
GET /api/v1/store/dye2.reaplugin/autoFavourites
GET /api/v1/store/dye2.reaplugin/recipes
GET /api/v1/store/dye2.reaplugin/baskets
```

No auth required. Returns a JSON array, or `null` if the key was never written — treat `null` as `[]`. This route isn't scoped to the owning plugin (verified against Decaid's `kv_store_handler.dart`), so any skin can already read these today; DYE2 is the sole writer by convention only, not by enforcement — don't `POST`/`DELETE` these keys. Full schema in `dye2-plugin/KV_CONTRACT.md`. Baskets is transitional: [decentespresso/decaid#727](https://github.com/decentespresso/decaid/pull/727) adds a real `/api/v1/equipment` resource that DYE2 will migrate onto.

### Releasing

Version is driven entirely by the git tag — push a `vX.Y.Z` tag and the release workflow (`.github/workflows/release.yml`) syncs `dye2-plugin/manifest.src.json` and `package.json` to match, builds, validates the output, and publishes `dye2.reaplugin-vX.Y.Z.zip` to Releases.

One exception to "never hand-bump": Decaid can also install this plugin straight from the `main` branch, and it rejects a branch install that would downgrade an existing install. So the committed `dye2-plugin/manifest.src.json` and `dye2.reaplugin/manifest.json` must never sit below the latest release tag — after tagging a release, bring the branch head up to that version and commit the rebuilt `dye2.reaplugin/`.

The source manifest is named `manifest.src.json`, not `manifest.json`, on purpose: Decaid finds a branch-source plugin root by looking for directories containing a `manifest.json` and refuses to install when the archive has more than one. Only `dye2.reaplugin/manifest.json` may carry that name.
