# AI Build And Release Notes

Read this when changing the Vite config, Tailwind, the manifest, tests, CI, or when cutting
a release or bumping a version.

## Build Shape

```sh
cd dye2-plugin
npm run build    # build:css (Tailwind) then vite build
npm run dev      # vite build --watch
npm run serve    # dev server, PORT=4444, BRIDGE_URL=http://localhost:8080
npm test         # 24 suites under test/, in series
```

`vite.config.ts` builds `src/plugin.ts` as a **single IIFE** exposing `createPlugin` on the
global, output to `../dye2.reaplugin/plugin.js`. `minify: false` and `emptyOutDir: false`
are deliberate — the output directory is a tracked part of the repo, not scratch space.

A `closeBundle` plugin copies `manifest.src.json` → `dye2.reaplugin/manifest.json`.

## The Manifest Is Named .src For A Reason

Decaid resolves a branch-source plugin root by looking for directories containing a
`manifest.json`, and **refuses to install when it finds more than one**. So only the build
output may carry that name; the source is `manifest.src.json`. Do not rename it, and do not
add a second `manifest.json` anywhere in the tree.

`manifest.src.json` `api[]` is one of three hand-maintained route lists — see
`AI_RUNTIME_NOTES.md` before adding a page.

## Tailwind Is Generated, Then Inlined

- Source: `src/styles/tailwind.css`. Config scans `./src/**/*.ts` — correct, because every
  Tailwind class in this repo lives inside a template string, not an HTML file.
- Output: `src/styles/tailwind.generated.css` — **generated, do not hand-edit**.
- `dev-shell.ts` imports it with `?inline` and injects it into every page. The tablet is
  offline; there is no CDN and no stylesheet request.

A class that only ever appears in a dynamically-assembled string (concatenated fragments,
or built at runtime browser-side) will **not** be seen by the scanner and gets purged. Write
complete class names in the source strings.

`npm run dev` runs vite watch **only** — it does not re-run `build:css`. Add a Tailwind
class during a watch session and it will not appear until you run `npm run build` (or
`npm run build:css`).

## Committed Build Output

`dye2.reaplugin/` (`plugin.js` + `manifest.json`) is **committed**. Decaid installs and
updates straight from the `main` branch, so the tree has to carry a working build.

- Rebuild and commit `dye2.reaplugin/` with any source change. CI warns on pushes to `main`
  when the committed output differs from a clean build (warning only — releases always use
  the fresh build).
- A running `npm run dev` watcher rewrites `plugin.js` on branch switches and will block a
  merge with "local changes would be overwritten". Stop the watcher, or
  `git checkout -- dye2.reaplugin/plugin.js`, before git operations.

## Releasing

The **committed version is the source of truth** and the tag must agree with it. Bump the
version on `main` first, then tag that commit. CI no longer patches the version in from the
tag — it checks, and fails the release on a mismatch.

Four files carry the version and must always read the same:

| File | Why |
| --- | --- |
| `dye2-plugin/manifest.src.json` | vite copies it to the output as `manifest.json` |
| `dye2.reaplugin/manifest.json` | the committed build; what a `main`/`dist` install reads |
| `dye2-plugin/package.json` | the middleware shows this one on the dashboard |
| `dye2-plugin/package-lock.json` | follows `package.json` |

To cut a release:

```sh
cd dye2-plugin
npm version --no-git-tag-version X.Y.Z          # package.json + package-lock.json
jq '.version = "X.Y.Z"' manifest.src.json > m && mv m manifest.src.json
npm run build                                   # rewrites dye2.reaplugin/manifest.json
cd .. && git commit -am "chore: release vX.Y.Z" && git push
git tag vX.Y.Z && git push origin vX.Y.Z
```

The bump can also ride along in the change's own commit — either way there is no separate
post-tag catch-up commit any more.

Version is the next patch — the series runs `v0.1.1` (first, 2026-07-28) upward. Do not
propose a different scheme.

`.github/workflows/release.yml` triggers on push to `main`, on tags `v*`, and manually. It:

1. **checks the four versions agree**, and on a tag build that the tag matches them — this
   is the guard that replaced the old sync step, and it runs on `main` pushes too, so a
   half-done bump turns the next push red rather than shipping;
2. `npm ci && npm run build`;
3. validates the output — non-empty `plugin.js` and `manifest.json`, `id == "dye2.reaplugin"`,
   `apiVersion` and `version` present, and `plugin.js` contains `createPlugin`;
4. on `main`, deploys the package to the `dist` branch;
5. on a tag, zips with `dye2.reaplugin/` as the **top-level entry** (REA identifies a plugin
   by that folder name) and attaches it to a GitHub Release.

**Why the committed version has to move with the tag:** Decaid installs from `main` and the
`dist` branch and rejects a downgrade, so a `main` left behind a tag silently serves an old
plugin. That happened at v0.1.25, when the catch-up commit was forgotten. The dist build
ships the same plugin id as the release, so there is no room for the two to drift —
`tadelv/passione` and `decentespresso/streamline-js` avoid this by giving the dist build its
own id (`passione-dist`, `streamline.js-dist`); dye2 does not.

`plugin.ts:27` also carries a hardcoded `version: "0.1.0"` that nothing syncs. It is not the
version anyone sees. Leave it alone during a release.

## Tests

```sh
cd dye2-plugin && npm test
```

Runs every suite named in `package.json`'s `test` script, in series — 24 of them as of
v0.1.26. Most run under `node --experimental-strip-types`, so they import `.ts` directly with no
build step; the few that only read a page's source as text (`save-recipe-slot`,
`recipe-profile-fill`, `suggested-cleanup`) run under plain `node`. Adding a suite means adding
it to that script: there is no directory glob, so a file nobody listed never runs.

Two patterns worth copying, since the browser-side code is untyped template-literal strings:
a suite either imports the pure helper from the `.ts` module, or pulls a function out of a page
string by its signature and evaluates it against a fake `document`. A new guard is also worth
mutation-checking once — revert the guard by hand and confirm the suite goes red.

`src/utils/fit-logic.test.mjs` is **orphaned** — not in `npm test`, not in CI. Run it by
hand if you touch the fit/scaling logic, and consider wiring it into the `test` script:

```sh
node --experimental-strip-types src/utils/fit-logic.test.mjs
```

CI does not run `npm test` at all — it only builds and validates output. A broken test
will not fail a release.

## Troubleshooting

| Symptom | First place to inspect |
| --- | --- |
| Tailwind class has no effect | Purged — class name assembled dynamically, or `build:css` not re-run |
| Class works after `npm run build`, not during watch | `npm run dev` skips `build:css` |
| Decaid refuses to install from branch | A second `manifest.json` in the tree |
| Release failed on a version mismatch | The four committed versions, then the tag; bump on `main` and re-tag |
| Decaid will not update from `main` | Committed manifest version sits below the latest tag |
| Merge blocked, "local changes would be overwritten" | `npm run dev` watcher rewriting `plugin.js` |
| CI warns about stale build | Source changed without committing a rebuilt `dye2.reaplugin/` |
| Plugin loads but host calls nothing | `createPlugin` missing from the bundle — check the IIFE `name`/format |

## Focused Checks

```sh
cd dye2-plugin
npm run build && npm test
git status --short dye2.reaplugin/     # expect clean after a build+commit
node -e 'const m=require("./manifest.src.json");console.log(m.id,m.version,m.apiVersion,m.api.length)'
```
