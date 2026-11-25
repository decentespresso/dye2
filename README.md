# DYE2

DYE2 (Describe Your Espresso) is a plugin for [Decaid](https://github.com/decentespresso/decaid) — the tablet software for Decent Espresso machines. It manages coffee beans, roast batches, grinders and equipment, and adds a shot dashboard, auto-favourites and recipe editing on top of the stock DYE workflow.

**This repo is the source of truth for DYE2.** Decaid downloads the latest DYE2 release when it builds and ships it as an asset; nothing here is edited inside Decaid's tree.

| I want to… | Go to |
|---|---|
| Use DYE2 | [User manual](MANUAL.md) · [Releases](../../releases) |
| Work on the code (human or AI) | [Repository map](docs/AI_REPO_MAP.md) — routes any task to the one note that covers it |
| Build a Decaid plugin | [For plugin developers](#for-plugin-developers) below |
| Read the plugin contract | Decaid's [`doc/Plugins.md`](https://github.com/decentespresso/decaid/blob/main/doc/Plugins.md) |

---

## For users

Read the [user manual](MANUAL.md); it covers installing, switching on, and every screen.

In short: most people never install DYE2 by hand. Each Decaid build ships with the DYE2 release that was the latest one when that build was made. Decaid copies it out at startup and records `decentespresso/dye2` as its source, so Decaid's normal plugin update check brings in newer DYE2 releases afterwards. To run a specific version, install `dye2.reaplugin-vX.Y.Z.zip` from [Releases](../../releases) through Decaid's plugin settings (Plugins screen → Install plugin). A lower version than the one installed is refused, so remove DYE2 first to go back.

---

## For plugin developers

This repo is a worked example of a **Decaid plugin that lives in its own repository** and gets bundled into the app from a GitHub release fetched at build time. If you're writing a plugin with a build step (TypeScript, bundler, npm tests), copy this shape.

Read Decaid's `doc/Plugins.md` first for the general contract — manifest fields, the `host` API, the HTTP request handler, lifecycle and sandbox rules. This README expands on it from the perspective of a plugin that lives in its own repo: layout, build, release, and the Decaid-side wiring.

### The one concept that trips everyone up: two runtimes

A Decaid plugin is not a web app. It is two programs in one repo that never share a scope.

| | Plugin runtime | Browser runtime |
|---|---|---|
| **Where** | On-device, inside `flutter_js` | The tablet's WebView |
| **Code** | `dye2-plugin/src/plugin.ts`, `pages/`, and the module-level parts of `utils/` | The template-literal strings those files emit, plus everything in `dev/` |
| **Has** | `host.log`, `host.emit`, `host.storage`, `fetch` (because the manifest declares `api`), `setTimeout`/`clearTimeout` | Full DOM, `fetch`, `CustomEvent` |
| **No** | DOM, `window`, `document`, `setInterval` | `host.*` |
| **Job** | Answer HTTP-handler calls — a server-side HTML renderer | Render and interact once the HTML lands |

Note the split runs *through* files, not just between them: `src/utils/dev-api.ts` is plugin-runtime TypeScript whose main export is a long string of browser JavaScript.

The plugin runtime **emits** browser code as strings; it never executes it. Import a browser API into plugin-runtime code and it fails on-device while working fine in your editor. The strings are inert text to TypeScript, so a typo inside one gets no type error and no build error. It fails at runtime on the tablet.

`fetch` in the plugin runtime is not the global one. Decaid wraps each plugin's source in a scope that defines a local `const fetch`, bound to that plugin's bridge token when the manifest declares `api` and rejecting with `PluginPermissionError` when it does not (`plugin_manager.dart` around line 2216). The `globalThis.fetch` defined earlier always rejects ("fetch is only available to plugins", around line 1063). DYE2's runtime code uses `fetch` to read and write the workflow, the KV store and shot history (`plugin.ts`, `recent-favs.ts`, `workflow-record.ts`).

### Repo layout

```
dye2/
├── dye2-plugin/              # The plugin source (TypeScript, built)
│   ├── src/
│   │   ├── plugin.ts         # Entry point — implements PluginInstance
│   │   ├── host.d.ts         # flutter_js host API types
│   │   ├── pages/            # One renderer per page route
│   │   ├── styles/           # Tailwind input + generated CSS
│   │   ├── utils/            # Browser-script strings, the page shell, html``/escaping,
│   │   │                     #   and the DOM-free plugin-runtime modules
│   │   └── vendor/           # Vendored browser libs (echarts)
│   ├── test/                 # Node test runner (.test.mjs)
│   ├── manifest.src.json     # Plugin metadata — SOURCE of manifest.json
│   ├── vite.config.ts        # IIFE build → ../dye2.reaplugin/plugin.js
│   └── dev-server.mjs        # Local page server, proxies /api/v1/* to a machine
│
├── dye2.reaplugin/           # BUILD OUTPUT — committed, never hand-edited
│   ├── manifest.json
│   └── plugin.js
│
├── dev/                      # Legacy plain JS/HTML for Decaid's native DYE pages
├── docs/
│   ├── AI_REPO_MAP.md        # Routes any task to the note that covers it
│   ├── AI_*_NOTES.md         # Runtime, data, UI, build and Figma notes
│   └── KV_CONTRACT.md        # Schemas for the KV keys DYE2 owns
├── .github/workflows/release.yml   # Build, dist branch, tagged releases
├── MANUAL.md                 # User manual
├── rea_restapi.yml           # Snapshot of Decaid's REST OpenAPI spec
└── websocket_v1.yml          # Snapshot of Decaid's WebSocket AsyncAPI spec
```

**A shipped plugin is exactly two files** — `manifest.json` and `plugin.js` in a folder named after the plugin id. Everything else in this repo exists to produce those two files.

`dev/` predates the TypeScript rewrite; its pages have since been ported into the plugin. No build step; edit and reload. Nothing in Decaid's own tree references it, so treat it as reference material rather than a live surface.

### Build and run

```bash
cd dye2-plugin
npm install

npm run build       # vite → ../dye2.reaplugin/{plugin.js,manifest.json}; runs tailwind itself
npm run serve       # watch build + dev server on :4444; proxies /api/* to a real machine
npm run serve:only  # the dev server alone, when something else owns the build
npm run dev         # the watch build alone
npm test            # 34 suites under test/, run in series (see package.json)
```

`test` names every suite explicitly rather than globbing, so a new `*.test.mjs` does not run until you add it to the script in `package.json`.

`serve` already runs the watch build. Tailwind is regenerated inside each Vite build, and the dev server reloads when `plugin.js` changes on disk.

```bash
PORT=4000 BRIDGE_URL=http://192.168.1.5:8080 npm run serve
```

Point `BRIDGE_URL` at a tablet or a desktop Decaid instance and the pages talk to real beans, shots and machine state without deploying anything. Things to know about the dev server (`dev-server.mjs`):

- It loads the built `plugin.js` in a Node `vm` with Node's `fetch`. It serves pages at `http://localhost:4444/<route>` (`/dashboard`, `/grinders`, …), not at the `/api/v1/plugins/…` path, and lists them at `/`.
- It answers `/api/v1/plugins/dye2.reaplugin/recent-favs` from the local build. Every other `/api/*` request is proxied to `BRIDGE_URL`, including `selection`, `record` and `save-recipe`. Those calls reach the DYE2 that is **installed on that machine**, not your local build.
- The plugin runtime's own `fetch` calls go to `http://localhost:8080` (hardcoded in `plugin.ts`) whatever `BRIDGE_URL` says.
- `host.storage` and `host.emit` are stubs that only log, and Decaid events (`shotStored`, `workflowUpdated`) never arrive, so the runtime's migrations, selection mirror and pushes do not run under the dev server.

### The manifest

`manifest.src.json` is the source; `vite.config.ts` copies it into the build output as `manifest.json`. **Never create a second file literally named `manifest.json`** outside the output folder — Decaid finds a plugin root by looking for directories that contain one and refuses to install when an archive has more than one candidate.

DYE2's shape:

```json
{
  "id": "dye2.reaplugin",
  "author": "Streamline",
  "name": "Streamline/DYE2",
  "description": "Beans, grinders, and shot workflow for Decent Espresso. …",
  "version": "0.1.42",
  "apiVersion": 1,
  "permissions": ["log", "api", "emit", "pluginStorage", "events.shots", "events.workflow"],
  "settings": {},
  "api": [
    { "id": "dashboard", "type": "http", "data": {} },
    { "id": "bean-picker", "type": "http", "data": {} },
    { "id": "changed", "type": "websocket", "data": {} }
  ]
}
```

DYE2 declares 22 `api` entries, 21 http and one websocket; three are shown. Not all of them are pages:

| Kind | Ids |
|---|---|
| HTML pages (15) | `dashboard`, `grinders`, `equipment`, `grinder-picker`, `basket-picker`, `bean-picker`, `roasters`, `add-bean`, `profile-picker`, `edit-shot`, `auto-favs`, `auto-fav-edit`, `recipe-edit`, `select-recipe`, `bc-import` |
| JSON endpoints (5) | `selection` (GET the derived selection; POST is a compat shim), `record` (POST), `save-recipe` (POST), `recent-favs` (GET, recomputes recent auto-favourites), `skin` (GET, Streamline surface discovery: `{"version":1,"surfaces":[],"live":{"endpoint":"changed"}}`) |
| Asset (1) | `echarts` — the vendored ECharts bundle as JavaScript |
| WebSocket (1) | `changed` — a "re-read" push, `{"what":"workflow"}` |

The JSON endpoints are described under [Data](#data-real-resources-vs-the-kv-store). `author` and `description` are **required**. Decaid reads them into non-nullable fields, so omitting either fails the install as an invalid manifest ("The plugin manifest is invalid…" from the installer, `Invalid manifest: …` from the loader).

- **`id`** becomes a directory name and must equal the `id` your `createPlugin` instance returns, or the load fails with "Plugin ID mismatch". It must be a single safe path component (`isSafePathComponent` in Decaid's `lib/src/util/safe_path.dart`): not empty, `.` or `..`; no `/`, `\` or NUL; no drive-letter prefix like `C:`; none of `< > : " | ? *`; no trailing dot or space.
- **`permissions`** are enforced. `host.log`, `host.emit` and `host.storage` **throw** `PluginPermissionError` when undeclared; `fetch` and `host.decentProxy` return a **rejected promise** instead (`decentProxy` needs `proxy.decent_api`, which DYE2 does not declare). Declare the minimum: every added permission blocks automatic updates until a user approves it (see [Permission escalation](#permission-escalation)).
  The `events.*` permissions decide which events reach `onEvent`: DYE2 takes `events.shots` for `shotStored`/`shotUpdated` (it recomputes recent auto-favourites) and `events.workflow` for `workflowUpdated`, which carries the **whole** workflow on every change and is the only push a plugin gets for it — `GET /workflow` has no revision and no socket.
- **`api`** entries each declare one endpoint. `type: "http"` is served at `/api/v1/plugins/<id>/<api-id>`; `type: "websocket"` at `/ws/v1/plugins/<id>/<api-id>`, which streams whatever the plugin passes to `host.emit('<api-id>', payload)` — DYE2's `changed` endpoint is that, and a skin watching it re-reads instead of polling. Decaid calls `__httpRequestHandler` on your instance, aliasing `handleHttpRequest` onto it if that is what you defined — this repo defines `__httpRequestHandler` directly. DYE2's `dashboard` id means `GET /api/v1/plugins/dye2.reaplugin/dashboard` returns a full HTML page.
- **`settings`** are rendered by skins straight from this schema. Give every setting a `label` and a `description` — without a `label` the user sees the raw storage key.

### Key patterns

- **Browser code as string exports.** A runtime with no DOM ships browser JavaScript by returning it as text. Shared browser code lives in `src/utils/`, for example `dev-api.ts` (`devApiScript`), `shot-paging.ts` (`shotPagingScript`), `chart.ts` (`chartScript`) and `shared-components.ts` (`*Script` strings beside `*Html`/`*Css` builders). Each is a template literal that the shell inlines as a `<script>` tag. Icons are markup strings from `lucide.ts` and `icons.ts`.
- **Page assembly.** Every live page calls `devPageShell(title, content, styles, scripts, opts)` from `src/utils/dev-shell.ts`, passing the shared strings plus its own orchestration script. For example, `pages/grinders.ts` ends with `devPageShell("Grinders", content, styles, [devApiScript, buildGrinderBodyScript, grinderLimitsScript, grindStepScript, cardLongPressScript, pageScript])`.
- **HTML safety.** The `html` tagged template in `src/utils/html.ts` does **not** escape. Browser scripts wrap anything user-supplied in `esc()`, defined once in `devApiScript` (`src/utils/dev-api.ts`), which every page loads first.
- **API base.** Browser code calls `/api/v1/*` directly. The dev server proxies it; Decaid routes it in production. No base-URL config anywhere.
- **Not every module is a page.** `src/utils/recent-favs.ts` and `src/utils/workflow-record.ts` run in the plugin runtime as real TypeScript, not as exported strings: `plugin.ts` imports them, they touch no DOM, they take `fetch` as an argument, and so `node:test` imports them directly (`test/recent-favs.test.mjs`, `test/workflow-record.test.mjs`). That is where work belongs that has to happen without a page open — answering an event, or writing the store after a shot. Code shaped this way is type-checked and testable; the page strings are neither.

Older docs describe a Web Component layer (`src/components/`), a REST client (`src/api/client.ts`) and a `pages/layout.ts` shell as the house style. Those were dead code and have been deleted. Build pages with `devPageShell` and the `utils/` strings.

### Data: real resources vs. the KV store

Everything DYE2 can put on a real Decaid resource goes there, so other screens see the same beans, shots and grinders. Only DYE2's own concepts go into the KV store.

**Typed resources** (Decaid's REST API; schema names from `rea_restapi.yml`). The same field name means different things on different resources, so the table names the schema:

| Resource | Route | Schema and fields DYE2 relies on |
|---|---|---|
| Beans | `/api/v1/beans` | `Bean`: `id`, `roaster`, `name`, `species`, `decaf`, `country`, `region`, `producer`, `variety`, `altitude`, `processing`, `notes`, `archived`, `extras` |
| Bean batches (bags) | `/api/v1/beans/{beanId}/batches`, `/api/v1/bean-batches/{id}` | `BeanBatch`: `id`, `beanId`, `roastDate`, `roastLevel`, `weight`, `weightRemaining`, `buyDate`, `openDate`, `bestBeforeDate`, `frozen`/`freezeDate`/`unfreezeDate`, `archived`, `notes`. A batch does not cascade-delete with its bean; delete the batches first. |
| Grinders | `/api/v1/grinders` | `Grinder`: `id`, `model`, `burrs`, `burrSize`, `burrType`, `settingType`, `settingValues`, `settingSmallStep`/`BigStep`, `rpmSmallStep`/`BigStep`, `archived`. DYE2 keeps its own fields in `Grinder.extras`: `feedRate` (what the grinder supports), `settingMin`/`Max`/`Default`, `rpmMin`/`Max`/`Default`, `settingHighest`, `bcUuid`. An update replaces `extras` whole, so send the existing keys back. |
| Profiles | `/api/v1/profiles?includeHidden=true` | `ProfileRecord`, read-only for DYE2 |
| Workflow | `GET`/`PUT /api/v1/workflow` | `context` (`WorkflowContext`: `targetDoseWeight`, `targetYield`, `grinderId`, `grinderModel`, `grinderSetting` — a **string** —, `beanBatchId`, `coffeeName`, `coffeeRoaster`, `baristaName`, `drinkerName`, `extras`), `profile`, `steamSettings`, `hotWaterData`, `rinseData`. `roastDate` is a `BeanBatch` field, not a `WorkflowContext` one. |
| Shots | `/api/v1/shots`, `/api/v1/shots/{id}` | `ShotRecord`: `id`, `timestamp`, `workflow` (a copy of the whole workflow at shot time), `annotations` (`ShotAnnotations`: `actualDoseWeight`, `actualYield`, `drinkTds`, `drinkEy`, `enjoyment` on a 0–10 scale, `espressoNotes`, `extras`), `stopReason` |

Fields with no schema slot ride in `extras`:

- **On the workflow**, in `context.extras`: `rpm`, `feedRate`, `basketId`, `basketName`, `note`, plus `dye`. `dye` holds `recipeId` (the selected recipe) and `{ v: 1, <field>: true|null }` flags that tell Streamline which fields DYE2 set.
- **On a shot**, in `annotations.extras`: the same basket/rpm/feed-rate values when they are edited after the shot (they win over the shot's `workflow.context.extras`), and `equipmentIds`/`equipmentNames`/`equipmentCustom`.

`PUT /api/v1/workflow` **deep-merges** the body onto the live workflow (`workflow_handler.dart` `_applyUpdate` → `deepMergeJson`). Omitting a key leaves the machine's old value in place. That is why a recipe or favourite with no bean writes explicit `null`s for it. `context.targetYield` is the one field that rejects `null` (HTTP 400); clear it with `0`. `GET /api/v1/workflow` has no revision, ETag or socket. A plugin learns of changes through `workflowUpdated`. Check a workflow write against `GET /api/v1/workflow` itself, not against the page.

**The KV store.** Auto-favourites, recipes, (for now) filter baskets and equipment have no resource of their own, so DYE2 persists them in Decaid's generic KV store under namespace `dye2.reaplugin`:

```
GET  /api/v1/store/dye2.reaplugin/<key>     # no auth; never-written key → 200 with body null
POST /api/v1/store/dye2.reaplugin/<key>     # body = the whole new value
```

| Key | Shape | Written by | Holds |
|---|---|---|---|
| `recipes` | array | pages; the runtime only for one-time migrations and `save-recipe` | `id` (opaque, not a position), `stripSlot` (1–5 or `null`), `name`/`title`, `beverage`, `barista`, `drinker`, bean and profile ids/names, `profileSnapshot`, `showOnStreamlineDashboard`, `dashboardVariables` (dose, drink, grind, rpm, brew temperature, steam/hot-water/flush settings, grinder, basket, equipment), `workflow` (a ready-to-PUT body), `capturedAt` |
| `autoFavourites` | array | pages (saved favourites); the runtime rewrites the `auto: true` recents after every stored or edited shot, and runs one-time migrations | `id`, `title`, `beverage`, `favSlot` (1–4 or `null`), `alwaysOnDashboard`, `copyMask`, `snapshot` (the captured values, including `profileSnapshot`), `workflow`, `auto`, `capturedAt` |
| `baskets` | array | pages | `id`, `name`, `size`, `diameterMm`, `notes`, `archived`, `createdAt` |
| `equipment` | array | pages | `id`, `name`, `custom: [{key, value}]`, `createdAt` |
| `selection` | object | runtime | a mirror of the derived selection: `{kind, id, modified, auto?}`, `{}` when none |
| `shotIndex` | object | runtime | a rebuildable cache of recent shot history used for ranking and the "most used" sorts. Don't read it from a skin. |
| `*Migrated` | boolean | runtime | one-time migration flags (`selectionMigrated`, `recipesMigrated`, `recipeBeansMigrated`, `favBeansMigrated`, `favSlotsMigrated`, `favProfilesMigrated`) |

The full field-by-field schemas, the slot rules, how ranking works and how to apply an item are in [`docs/KV_CONTRACT.md`](docs/KV_CONTRACT.md). Treat a `null` (or any non-array) value of an array key as `[]`. `host.storage` writes go to this same store, with the plugin id as the namespace. That is why `selection` and the flags can be read at these URLs.

> The KV route is **not** scoped to the owning plugin. Any skin can already read and write these keys. DYE2 is the sole writer by convention, not by enforcement — don't `POST`/`DELETE` keys you don't own. There is no revision or ETag either, and every mutation rewrites a whole array, so a second writer races the entire collection rather than one row.

**Selection and dial-in.** The selection is **derived from the live workflow, never stored**. A recipe is selected when `context.extras.dye.recipeId` names it. A favourite or recent is selected while the live workflow still matches its snapshot. Nothing is written onto a recipe just because the workflow changed. The skin asks for that explicitly:

```
GET  /api/v1/plugins/dye2.reaplugin/selection       → {kind: 'recipe'|'favourite', id, modified, auto?} | null
POST /api/v1/plugins/dye2.reaplugin/selection {kind, id}
                                                    → compat shim for older callers: PUTs recipeId (null unless
                                                      kind is 'recipe'), stores nothing, returns the derived selection
POST /api/v1/plugins/dye2.reaplugin/record          → {saved, kind, id} — writes the fields the barista moved since
                                                      the apply onto the selected recipe; {saved: false, reason} otherwise
POST /api/v1/plugins/dye2.reaplugin/save-recipe {name?, slot?, beverage?}
                                                    → {id, name} — a new recipe from the live workflow, selected at once
```

A consumer does not have to poll. After a plugin-runtime write, and whenever the derived selection changes, DYE2 `host.emit`s `{"what":"workflow"}` on its `changed` websocket (`/ws/v1/plugins/dye2.reaplugin/changed`). Streamline's plugin-surface `live` channel, discovered through the `skin` endpoint, re-reads on that push. Writes made by DYE2's **pages** go straight from the browser to the KV store and are not pushed, so a consumer should also re-read on focus.

Baskets are transitional: [decaid#727](https://github.com/decentespresso/decaid/pull/727) proposes a real `/api/v1/equipment` resource to migrate onto. It has not landed in Decaid yet.

Full API surface: [`rea_restapi.yml`](rea_restapi.yml) and [`websocket_v1.yml`](websocket_v1.yml) are **snapshots** of Decaid's `assets/api/rest_v1.yml` and `websocket_v1.yml`. They lag the host, so check Decaid's copy when a field matters.

### Releasing

**The committed version is the source of truth; the tag must agree with it.** CI does not patch the version in from the tag. It checks that the versions agree and fails the run when they don't. Bump first, then tag:

```bash
cd dye2-plugin
npm version --no-git-tag-version 0.2.0                          # package.json + package-lock.json
jq '.version = "0.2.0"' manifest.src.json > m && mv m manifest.src.json
npm run build                                                   # rewrites dye2.reaplugin/manifest.json
cd .. && git commit -am "chore: release v0.2.0" && git push
git tag v0.2.0 && git push origin v0.2.0
```

`.github/workflows/release.yml` runs on every push to `main`, on `v*` tags, and on manual dispatch. It:

1. Checks that the four version fields agree: `manifest.src.json`, the committed `dye2.reaplugin/manifest.json`, `package.json` and `package-lock.json`. On a tag build it also checks that the tag minus its `v` equals them.
2. Builds (`npm ci && npm run build`).
3. Validates the output — both files non-empty, `id` matches, `apiVersion` and `version` present, `plugin.js` contains `createPlugin`.
4. On `main`, warns if the committed `dye2.reaplugin/` differs from the clean build, then publishes the build to the `dist` branch.
5. On a tag, zips **with `dye2.reaplugin/` as the top-level entry** and publishes `dye2.reaplugin-vX.Y.Z.zip` to Releases. Decaid's fetch script unpacks into `assets/plugins/` and then reads `assets/plugins/dye2.reaplugin/manifest.json`, so the folder must be there. Decaid's own installer is more relaxed: it accepts a flat zip or a single wrapper directory.

Rules the workflow can't enforce for you:

- **Commit the rebuilt `dye2.reaplugin/`.** A push to `main` whose committed build differs from a clean build raises a CI warning. Note `main` itself is *not* installable from a branch, because its root has no `manifest.json`. Branch installs go through `dist` or a release.
- **The `dist` branch root is the *contents* of `dye2.reaplugin/`, not the folder.** Decaid looks for `manifest.json` in the extracted archive's root or exactly one directory below it (`plugin_package.dart` `_resolveRoot`). With GitHub's archive wrapper in the way, a `dye2.reaplugin/` directory inside the branch would be one level too deep and fail with "Plugin package has no manifest.json". Two manifest-bearing directories also fail, deliberately.
- **Release and `dist` share one install slot.** Both carry the same `manifest.id`, so switching channel overwrites the recorded source. Install one or the other, not both.
- **Never let `main` sit below the latest tag.** Decaid refuses any install that would downgrade an existing one (HTTP 409, "Plugin dye2.reaplugin X.Y.Z is installed; remove it before installing …"). `dist` is built from `main`'s committed version, so bumping before tagging keeps it level with the release.
- **`dist` is a rolling target.** `force_orphan` rewrites the branch on every push to `main`, so the recorded `source.commit` moves and "install from dist" can never be pinned. Pin with a release when that matters.

---

## Getting a plugin bundled into Decaid

Bundling means Decaid ships your plugin inside the app and copies it out at startup. It is for plugins Decent wants on *every* install — otherwise just publish releases and let users install from GitHub. The authoritative description is Decaid's `doc/Plugins.md` ("External First-Party Plugins", "Bundled plugins", "Permission escalation"). This section summarises it from the plugin side.

Two models exist. This repo is the second.

| | In-tree | **External repo (this one)** |
|---|---|---|
| Lives in | `assets/plugins/<id>.reaplugin/`, committed to Decaid | Its own repo; release ZIP fetched at build time |
| Build step | None — hand-written `plugin.js` | Anything you like |
| Decaid's copy | Tracked in git | **Gitignored** — a build artifact |
| Examples | `time-to-ready`, `visualizer`, `settings`, `decent-profile` | `dye2`, `shot-upload`, `dcamp` |

### What you provide

- A public GitHub repo that publishes `<id>.reaplugin-vX.Y.Z.zip` on every tag.
- The zip contains one top-level folder named exactly `<id>.reaplugin`, holding `manifest.json` and `plugin.js`.
- `manifest.json` `.version` equals the tag without its `v`.
- `plugin.js` contains `createPlugin`.

### What the Decaid PR changes

Each external plugin has a fetch script in Decaid's `scripts/`. It downloads the release asset with `gh`, unpacks it into `assets/plugins/`, and hard-fails on any contract violation. It checks the manifest id, the manifest version against the tag, `apiVersion`, a floor of required permissions (DYE2's script checks `log` and `api`), and the `createPlugin` entry point. A drifted release breaks the build instead of shipping quietly. There are two pinning styles:

- **Pinned** (`fetch_shot_upload_plugin.sh`, `fetch_dcamp_plugin.sh`): a `pinned_version` **and** `pinned_sha256`, with the checksum verified. Copy one of these for a new plugin.
- **Latest** (`fetch_dye2_plugin.sh`): no pin and no checksum. It resolves the latest `decentespresso/dye2` release, or the release `DYE2_VERSION=vX.Y.Z` names. Decaid's `release.yml` resolves the tag once in its `release-metadata` job and passes it as `DYE2_VERSION` to every platform job, so all platforms ship the same DYE2. This is how a DYE2 fix ships without a Decaid PR.

Then the wiring, all in Decaid:

| File | Change |
|---|---|
| `scripts/fetch_<name>_plugin.sh` | New — copy a pinned one |
| `.gitignore` | Ignore `assets/plugins/<id>.reaplugin/` — build output |
| `pubspec.yaml` (`assets:`) | Add `- assets/plugins/<id>.reaplugin/` |
| `lib/src/plugins/plugin_loader_service.dart` | Add the path to `_getBundledPluginPaths()` |
| `lib/src/plugins/plugin_source_service.dart` | Add `'<id>.reaplugin': 'owner/repo'` to `bundledPluginRepos` |
| `test/plugins/bundled_plugin_permissions_test.dart` | Add your permission floor to `requiredPermissions` |
| `.github/workflows/{pr-checks,develop-builds,release}.yml` | Call your fetch script in each "Fetch external plugins" step beside the existing ones (2 + 6 + 6 steps today). Miss `release.yml` and your plugin is absent from every shipped build |

`bundledPluginRepos` is what lets an installed copy keep receiving your releases. On the first update check or visit to the Plugins screen, Decaid seeds a `github_release` source for it, tagged with the installed version. Without it your plugin stays at whatever version the app bundled.

The permissions test asserts `containsAll`, so it's a floor, not an exact match: extra permissions pass, a dropped one fails.

### Bundled-copy semantics

The bundled copy is the **app-owned floor**. On every startup Decaid compares versions (`plugin_loader_service.dart` `_copyBundledPlugins`, `plugin_version.dart` `shouldReplaceBundledPlugin`):

- nothing installed (or an empty directory) → the bundled copy is written
- bundled strictly newer than installed → bundled wins, replaces `manifest.json` and `plugin.js`
- bundled equal or older → installed copy is left alone. A version that is not strict semver also counts as "leave alone".

So a user who installed a newer release from GitHub keeps it, and a hand-edit survives as long as the bundled version hasn't moved past it. The comparison is the same in debug, profile and release builds. Bundled plugins also get auto-load switched on by default the first time Decaid sees them.

The startup copy does not go through the permission review below, so a newer bundled copy that adds permissions replaces the installed one without approval.

### Permission escalation

An automatic update installs only when the candidate manifest requests the same permissions or fewer. Asking for anything new parks it as a `pendingUpdate` (the candidate version and the added permissions), shown in the Plugins screen and in `GET /api/v1/plugins`, until it is approved there or over REST:

```bash
curl -X POST http://tablet:8080/api/v1/plugins/dye2.reaplugin/update/approve \
  -H "Authorization: Bearer $TOKEN"
```

The bearer token (scope `extensions:manage`) is needed only while Decaid's extension-management protection is ON. It is OFF by default (`settings_service.dart`), and then the header can be left out.

Plan permissions ahead. Adding one later means every user has to click through.

### Bumping the pin

DYE2 has no pin: a new DYE2 tag is picked up by the next Decaid build, with no Decaid PR. For a **pinned** plugin, open a normal PR against Decaid that updates `pinned_version` and `pinned_sha256` in its fetch script:

```bash
shasum -a 256 <id>.reaplugin-v0.2.0.zip
```

If the release added permissions you want the build to guarantee, raise `requiredPermissions` in the test (and the fetch script's floor) in the same PR.

---

## Copying this repo as a template

1. Rename `dye2-plugin/` → `<your-plugin>/` and set `id`, `name`, `author`, `description` and `version` in `manifest.src.json`. Return the same `id` from `createPlugin`.
2. Replace `dye2.reaplugin` with `<your-id>.reaplugin` wherever it appears as a path: the `outDir` and the copy-manifest step in `vite.config.ts`, and `PLUGIN_PATH` in `dev-server.mjs`. In browser code, also replace the KV namespace and the `/api/v1/plugins/dye2.reaplugin/…` URLs.
3. Declare your `api` page ids in the manifest. Add one file per page under `src/pages/` and one `case` per id in `plugin.ts`'s `__httpRequestHandler` switch (and in the dev server's `PLUGIN_ROUTES`).
4. Trim `permissions` to what you actually call.
5. Keep `.github/workflows/release.yml`. Change the folder name, the `id` it validates, and the artifact name.
6. Set the version to `0.1.0` in all four places, build, commit, then tag `v0.1.0`. Confirm the release zip has `<your-id>.reaplugin/` at its top level.
7. Ship it standalone first. Propose bundling only once it's stable.
