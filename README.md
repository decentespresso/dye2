# DYE2

DYE2 (Describe Your Espresso) is a plugin for [Decaid](https://github.com/decentespresso/decaid) — the tablet software for Decent Espresso machines. It manages coffee beans, roast batches, grinders and equipment, and adds a shot dashboard, auto-favourites and recipe editing on top of the stock DYE workflow.

**This repo is the source of truth for DYE2.** Decaid pulls a pinned release of it as a build asset; nothing here is edited inside Decaid's tree.

| I want to… | Go to |
|---|---|
| Use DYE2 | [User manual](MANUAL.md) · [Releases](../../releases) |
| Build a Decaid plugin | [For plugin developers](#for-plugin-developers) below |
| Read the plugin contract | Decaid's [`doc/Plugins.md`](https://github.com/decentespresso/decaid/blob/main/doc/Plugins.md) |

---

## For users

Most people never install this by hand. Decaid ships a pinned DYE2 release inside the app and copies it out on first start.

Install a specific version only if you want to run ahead of or behind what Decaid pins:

1. Download `dye2.reaplugin-vX.Y.Z.zip` from [Releases](../../releases).
2. Decaid → Settings → Plugins → install from ZIP.

Or drop the unzipped `dye2.reaplugin/` folder into Decaid's `plugins/` directory and enable it.

---

## For plugin developers

This repo is a worked example of a **Decaid plugin that lives in its own repository** and gets bundled into the app from a pinned GitHub release. If you're writing a plugin with a build step (TypeScript, bundler, npm tests), copy this shape.

Read Decaid's `doc/Plugins.md` first for the general contract — manifest fields, the `host` API, the HTTP request handler, lifecycle and sandbox rules. This README covers what `doc/Plugins.md` doesn't: how a plugin repo is laid out, built, released, and wired into Decaid.

### The one concept that trips everyone up: two runtimes

A Decaid plugin is not a web app. It is two programs in one repo that never share a scope.

| | Plugin runtime | Browser runtime |
|---|---|---|
| **Where** | On-device, inside `flutter_js` | The tablet's WebView |
| **Code** | `dye2-plugin/src/plugin.ts`, `pages/`, `utils/` | `dye2-plugin/src/components/`, everything in `dev/` |
| **Has** | `host.log`, `host.emit`, `host.storage`, `fetch` | Full DOM, `fetch`, `CustomEvent` |
| **No** | DOM, `window`, `document`, timers beyond `setTimeout` | `host.*` |
| **Job** | Answer `handleHttpRequest` calls — a server-side HTML renderer | Render and interact once the HTML lands |

The plugin runtime **emits** browser code as strings; it never executes it. Import a browser API into plugin-runtime code and it fails on-device while working fine in your editor.

### Repo layout

```
dye2/
├── dye2-plugin/              # The plugin source (TypeScript, built)
│   ├── src/
│   │   ├── plugin.ts         # Entry point — implements PluginInstance
│   │   ├── host.d.ts         # flutter_js host API types
│   │   ├── pages/            # One file per declared `api` id — returns HTML
│   │   ├── components/       # Web Components exported as JS strings
│   │   ├── api/client.ts     # Browser-side REST client
│   │   ├── styles/           # Tailwind input + generated CSS
│   │   ├── utils/            # html`` template, escaping, chart, date picker
│   │   └── vendor/           # Vendored browser libs (plotly)
│   ├── test/                 # Node test runner (.test.mjs)
│   ├── manifest.src.json     # Plugin metadata — SOURCE of manifest.json
│   ├── vite.config.ts        # IIFE build → ../dye2.reaplugin/plugin.js
│   ├── dev-server.mjs        # Local page server, proxies /api/v1/* to a machine
│   └── KV_CONTRACT.md        # Schemas for the KV keys DYE2 owns
│
├── dye2.reaplugin/           # BUILD OUTPUT — committed, never hand-edited
│   ├── manifest.json
│   └── plugin.js
│
├── dev/                      # Legacy plain JS/HTML for Decaid's native DYE pages
├── rea_restapi.yml           # Decaid REST OpenAPI spec
└── websocket_v1.yml          # Decaid WebSocket AsyncAPI spec
```

**A shipped plugin is exactly two files** — `manifest.json` and `plugin.js` in a folder named after the plugin id. Everything else in this repo exists to produce those two files.

`dev/` predates the TypeScript rewrite and is still loaded directly by Decaid's native DYE workflow pages. No build step; edit and reload.

### Build and run

```bash
cd dye2-plugin
npm install

npm run build    # one-shot → ../dye2.reaplugin/{plugin.js,manifest.json}
npm run dev      # vite watch mode
npm run serve    # dev server on :4444, proxies /api/v1/* to a real machine
npm test         # node --experimental-strip-types over test/*.test.mjs
```

Run `dev` and `serve` in two terminals — the dev server reloads when `plugin.js` changes on disk.

```bash
PORT=4000 BRIDGE_URL=http://192.168.1.5:8080 npm run serve
```

Point `BRIDGE_URL` at a tablet or a desktop Decaid instance and the pages talk to real beans, shots and machine state without deploying anything.

### The manifest

`manifest.src.json` is the source; `vite.config.ts` copies it into the build output as `manifest.json`. **Never create a second file literally named `manifest.json`** outside the output folder — Decaid finds a plugin root by looking for directories that contain one and refuses to install when an archive has more than one candidate.

DYE2's shape:

```json
{
  "id": "dye2.reaplugin",
  "name": "Streamline/DYE2",
  "version": "0.1.9",
  "apiVersion": 1,
  "permissions": ["log", "api", "emit", "pluginStorage"],
  "settings": {},
  "api": [
    { "id": "dashboard", "type": "http", "data": {} },
    { "id": "bean-picker", "type": "http", "data": {} }
  ]
}
```

- **`id`** becomes a directory name. Single safe path component — no `/`, `\`, `.`, `..`, no Windows-reserved names.
- **`permissions`** are enforced. An undeclared call throws `PluginPermissionError`. Declare the minimum: every added permission blocks automatic updates until a user approves it (see [Permission escalation](#permission-escalation)).
- **`api`** entries each declare one endpoint. `type: "http"` is served at `/api/v1/plugins/<id>/<api-id>` and answered by your `handleHttpRequest`; `type: "websocket"` at `/ws/v1/plugins/<id>/<api-id>`. DYE2's `dashboard` id means `GET /api/v1/plugins/dye2.reaplugin/dashboard` returns a full HTML page.
- **`settings`** are rendered by skins straight from this schema. Give every setting a `label` and a `description` — without a `label` the user sees the raw storage key.

### Key patterns worth copying

- **Components as string exports.** Each `src/components/*.ts` exports a template literal containing a Web Component class plus `customElements.define(...)`. `pageShell()` inlines them as `<script>` tags. This is how you get browser code out of a runtime with no DOM.
- **Page assembly.** Pages in `src/pages/` call `pageShell(title, content, [scripts])`; the scripts array is component strings plus per-page orchestration.
- **Event flow.** Components dispatch `CustomEvent({ bubbles: true })`; page scripts attach document-level listeners to show/hide siblings and re-fetch.
- **HTML safety.** The `html` tagged template in `src/utils/html.ts` does **not** escape. Wrap anything user-supplied in `escapeHtml()` yourself.
- **API base.** Browser code calls `/api/v1/*` directly. The dev server proxies it; Decaid routes it in production. No base-URL config anywhere.

### Data: real resources vs. the KV store

Beans and grinders are first-class Decaid resources:

```
GET /api/v1/beans
GET /api/v1/grinders
```

Auto-favourites, recipes and (for now) filter baskets have no resource of their own, so DYE2 persists them in Decaid's generic per-plugin KV store:

```
GET /api/v1/store/dye2.reaplugin/autoFavourites
GET /api/v1/store/dye2.reaplugin/recipes
GET /api/v1/store/dye2.reaplugin/baskets
```

No auth. Returns a JSON array, or `null` if the key was never written — treat `null` as `[]`. Schemas in [`dye2-plugin/KV_CONTRACT.md`](dye2-plugin/KV_CONTRACT.md).

> The KV route is **not** scoped to the owning plugin. Any skin can already read and write these keys. DYE2 is the sole writer by convention, not by enforcement — don't `POST`/`DELETE` keys you don't own.

Baskets are transitional: [decaid#727](https://github.com/decentespresso/decaid/pull/727) adds a real `/api/v1/equipment` resource to migrate onto.

Full API surface: [`rea_restapi.yml`](rea_restapi.yml) and [`websocket_v1.yml`](websocket_v1.yml).

### Releasing

**The git tag is the version.** Never hand-bump for a release.

```bash
git tag v0.2.0
git push origin v0.2.0
```

`.github/workflows/release.yml` then:

1. Rewrites `manifest.src.json` `.version` and `package.json` to the tag minus its `v`.
2. Builds (`npm ci && npm run build`).
3. Validates the output — both files non-empty, `id` matches, `apiVersion` and `version` present, `plugin.js` contains `createPlugin`.
4. Zips **with `dye2.reaplugin/` as the top-level entry** — Decaid identifies a plugin by that folder name, so a flat zip is rejected.
5. Publishes `dye2.reaplugin-vX.Y.Z.zip` to Releases.

Two rules the workflow can't enforce for you:

- **Commit the rebuilt `dye2.reaplugin/`.** Decaid can install straight from the `main` branch, so the committed output must be real. A push to `main` whose committed build differs from a clean build raises a CI warning.
- **Keep the branch head at or above the latest tag.** Decaid rejects a branch install that would downgrade an existing install. After tagging, bring `main`'s manifest version up to the released version and commit the rebuild.

---

## Getting a plugin bundled into Decaid

Bundling means Decaid ships your plugin inside the app and copies it out at startup. It is for plugins Decent wants on *every* install — otherwise just publish releases and let users install from GitHub.

Two models exist. This repo is the second.

| | In-tree | **External repo (this one)** |
|---|---|---|
| Lives in | `assets/plugins/<id>.reaplugin/`, committed to Decaid | Its own repo; release ZIP fetched at build time |
| Build step | None — hand-written `plugin.js` | Anything you like |
| Decaid's copy | Tracked in git | **Gitignored** — a build artifact |
| Examples | `time-to-ready`, `visualizer`, `settings`, `decent-profile` | `dye2`, `shot-upload` |

### What you provide

- A public GitHub repo that publishes `<id>.reaplugin-vX.Y.Z.zip` on every tag.
- The zip contains one top-level folder named exactly `<id>.reaplugin`, holding `manifest.json` and `plugin.js`.
- `manifest.json` `.version` equals the tag without its `v`.
- `plugin.js` contains `createPlugin`.

### What the Decaid PR changes

Copy `scripts/fetch_dye2_plugin.sh` and change the names. It pins a version **and** a SHA-256, then hard-fails on any contract violation:

```bash
pinned_version="v0.1.4"
pinned_sha256="fd8e43af…"
pinned_api_version="1"
```

It downloads the release asset, verifies the checksum, unpacks into `assets/plugins/`, and asserts the manifest id, the manifest version against the tag, `apiVersion`, the required permissions, and the `createPlugin` entry point. A drifted release breaks the build instead of shipping quietly.

Then the wiring, all in Decaid:

| File | Change |
|---|---|
| `scripts/fetch_<name>_plugin.sh` | New — copy the dye2 one |
| `.gitignore` | Ignore `assets/plugins/<id>.reaplugin/` — build output |
| `pubspec.yaml` (`assets:`) | Add `- assets/plugins/<id>.reaplugin/` |
| `lib/src/plugins/plugin_loader_service.dart` | Add the path to `_getBundledPluginPaths()` |
| `lib/src/plugins/plugin_source_service.dart` | Add `'<id>.reaplugin': 'owner/repo'` to `bundledPluginRepos` |
| `test/plugins/bundled_plugin_permissions_test.dart` | Add your permission floor to `requiredPermissions` |
| `.github/workflows/{pr-checks,develop-builds}.yml` | Call your fetch script beside the existing two |

`bundledPluginRepos` is what lets an installed copy keep receiving your releases after install — without it your plugin freezes at whatever version Decaid pinned.

The permissions test asserts `containsAll`, so it's a floor, not an exact match: extra permissions pass, a dropped one fails.

### Bundled-copy semantics

The bundled copy is the **app-owned floor**. On every startup Decaid compares versions:

- bundled newer than installed → bundled wins, replaces it
- bundled equal or older → installed copy is left alone

So a user who installed a newer release from GitHub keeps it. A user who hand-edited the bundled plugin loses the edit at the next app start.

### Permission escalation

An automatic update installs only when the candidate manifest requests the same permissions or fewer. Asking for anything new parks it as a `pendingUpdate` — surfaced in the Plugins screen and in `GET /api/v1/plugins` — until approved:

```bash
curl -X POST http://tablet:8080/api/v1/plugins/dye2.reaplugin/update/approve
```

Plan permissions ahead. Adding one later means every user has to click through.

### Bumping the pin

When you cut a release, open a normal PR against Decaid updating `pinned_version` and `pinned_sha256` in your fetch script:

```bash
shasum -a 256 dye2.reaplugin-v0.2.0.zip
```

If the release added permissions, update `requiredPermissions` in the test in the same PR.

---

## Copying this repo as a template

1. Rename `dye2-plugin/` → `<your-plugin>/` and set `id`, `name`, `author`, `description` in `manifest.src.json`.
2. Point `vite.config.ts` output at `../<your-id>.reaplugin/`.
3. Declare your `api` page ids in the manifest and add one file per id under `src/pages/`.
4. Trim `permissions` to what you actually call.
5. Keep `.github/workflows/release.yml` — change only the folder and artifact names.
6. Tag `v0.1.0` and confirm the release zip has `<your-id>.reaplugin/` at its top level.
7. Ship it standalone first. Propose bundling only once it's stable.
