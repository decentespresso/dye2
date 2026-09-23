# AI Build And Release Notes

Read this when changing the Vite config, Tailwind, the manifest, tests, CI, or when cutting
a release or bumping a version.

## Build Shape

```sh
cd dye2-plugin
npm run build    # build:css (Tailwind) then vite build
npm run dev      # vite build --watch
npm run serve    # dev server, PORT=4444, BRIDGE_URL=http://localhost:8080
npm test         # three node --experimental-strip-types suites
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

The **git tag is the single source of truth for the version.** Never hand-bump
`manifest.src.json` to *make* a release — CI overwrites it from the tag.

`.github/workflows/release.yml` triggers on push to `main`, on tags `v*`, and manually. On
a tag it:

1. rewrites `manifest.src.json` `.version` from the tag (`jq`), and runs
   `npm version --no-git-tag-version` so `package.json` / `package-lock.json` match — the
   middleware reads the version from there to show it on the dashboard;
2. `npm ci && npm run build`;
3. validates the output — non-empty `plugin.js` and `manifest.json`, `id == "dye2.reaplugin"`,
   `apiVersion` and `version` present, and `plugin.js` contains `createPlugin`;
4. zips with `dye2.reaplugin/` as the **top-level entry** (REA identifies a plugin by that
   folder name) and attaches it to a GitHub Release.

To cut one:

```sh
git tag vX.Y.Z && git push origin vX.Y.Z
```

Version is the next patch — the series runs `v0.1.1` (first, 2026-07-28) upward. Do not
propose a different scheme.

**The one legitimate hand-bump:** because Decaid installs from `main` and rejects a
downgrade, the committed `manifest.src.json` and `dye2.reaplugin/manifest.json` must never
sit **below** the latest release tag. After tagging, bump both to that version, run
`npm version --no-git-tag-version X.Y.Z` in `dye2-plugin`, rebuild, and commit. That catch-up
commit is expected; a pre-emptive bump to force a version is not.

`plugin.ts:27` also carries a hardcoded `version: "0.1.0"` that nothing syncs. It is not the
version anyone sees. Leave it alone during a release.

## Tests

```sh
cd dye2-plugin && npm test
```

Runs `test/bc-map.test.mjs`, `test/shot-paging.test.mjs`, `test/equipment.test.mjs` under
`node --experimental-strip-types` (so the suites import `.ts` directly, no build step).

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
| Released version wrong | Tag name; CI rewrites the manifest from `GITHUB_REF_NAME` |
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
