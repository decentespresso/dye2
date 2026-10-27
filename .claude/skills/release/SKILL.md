---
name: release
description: Cut a dye2 plugin release — bump the four version files, commit, tag, and watch CI. Use when the user says "cut a release", "release dye2", "ship it", "tag a release", "new version", or invokes /release.
---

# Cut a dye2 release

The **committed version is the source of truth**; the tag must agree with it. Bump on
`main` first, then tag that commit. CI (`.github/workflows/release.yml`, step "Check the
committed versions agree") fails the run on any mismatch — it does not patch versions in.

Never ask which version to cut, or propose a different scheme: it is the **next patch**.

## 1. Preconditions

```sh
cd <repo root>
git status --short                 # must be clean, or only the change being released
git fetch --tags
git ls-remote --tags origin 'refs/tags/v*' | awk '{print $2}' | sed 's#refs/tags/##' | sort -V | tail -1
```

- Work on `main` directly. No branch for ordinary work here.
- Latest tag + 1 patch = the version to cut. Call it `X.Y.Z` below.
- A `npm run dev` watcher rewrites `dye2.reaplugin/plugin.js` and will block git
  operations. Stop it, or `git checkout -- dye2.reaplugin/plugin.js`.

## 2. Bump all four, rebuild, commit

```sh
cd dye2-plugin
npm version --no-git-tag-version X.Y.Z            # package.json + package-lock.json
jq '.version = "X.Y.Z"' manifest.src.json > m && mv m manifest.src.json
npm run build                                     # rewrites dye2.reaplugin/manifest.json
npm test                                          # CI does not run tests; do it here
cd ..
```

The four files that must read the same version:

| File | Why |
| --- | --- |
| `dye2-plugin/manifest.src.json` | vite copies it to the output as `manifest.json` |
| `dye2.reaplugin/manifest.json` | the committed build; what a `main`/`dist` install reads |
| `dye2-plugin/package.json` | the middleware shows this one on the dashboard |
| `dye2-plugin/package-lock.json` | follows `package.json` |

Verify before committing — same comparison CI makes:

```sh
jq -r '.version' dye2-plugin/manifest.src.json dye2.reaplugin/manifest.json \
  dye2-plugin/package.json dye2-plugin/package-lock.json | sort -u
```

One line out, equal to `X.Y.Z`. More than one line means the bump is half done.

Then commit. The bump may ride in the change's own commit instead; either way there is
**no post-tag catch-up commit** any more.

```sh
git commit -am "chore: release vX.Y.Z"
git push origin main
```

## 3. Tag

```sh
git tag vX.Y.Z && git push origin vX.Y.Z
```

CI then builds, validates the output, zips with `dye2.reaplugin/` as the top-level entry
(REA identifies a plugin by that folder name), and attaches
`dye2.reaplugin-vX.Y.Z.zip` to a GitHub Release.

## 4. Confirm

```sh
gh run list --limit 3 --json status,conclusion,headBranch,displayTitle \
  --jq '.[] | "\(.status) \(.conclusion // "-") \(.headBranch) \(.displayTitle)"'
gh release view vX.Y.Z --json tagName,assets --jq '{tagName, assets: [.assets[].name]}'
```

Report the release URL and the asset name. Do not claim success before the run is
`completed success` and the zip is attached.

## If the tag build fails on the guard

The tag does not match the committed version. Fix the version on `main`, then move the
tag:

```sh
git push --delete origin vX.Y.Z && git tag -d vX.Y.Z   # confirm with the user first
```

Re-tag after the corrected commit is pushed. Do not force-push `main`.

## Notes

- `dye2.reaplugin/` is a **committed build artifact**. Any source change needs
  `npm run build` and the rebuilt output committed; CI warns on `main` when it is stale.
- Decaid installs from `main` and the `dist` branch and **rejects a downgrade**, which is
  why the committed version may never sit below the latest tag.
- `src/plugin.ts` carries a hardcoded `version: "0.1.0"` that nothing syncs and nobody
  sees. Leave it alone.
- The repo is PUBLIC (`origin` is `allofmeng/dye2`, redirecting to `decentespresso/dye2`).
- Fuller background: `docs/AI_BUILD_NOTES.md`, "Releasing".
