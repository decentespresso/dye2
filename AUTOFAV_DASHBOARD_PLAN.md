# Auto-Favourites → Streamline Dashboard — Implementation Plan

Feature: DYE2 saves "auto-favourites" (a bean + recipe snapshot). The user-facing
**Streamline** shot screen shows them as chips in the header; tapping a chip applies
that bean+recipe to the current shot. Figma: node `2386:824`.

Status decisions (locked): the 5-slot top strip is driven by a vertical **P / F / R toggle**
at top-left (extends Figma node `2386:1116`, which shows F/R — we add **P = Profiles** on
top, **default**). **P** = existing profile favourites (unchanged), **F** = auto-fav beans,
**R** = recipes. F and R are DYE2-driven (from the KV store). Default `P` means the header
behaves exactly as today until the user opts into DYE2's strip. This doc is **plan only** — no edits yet.

### Figma anchors (node `2386:824`)
- `2386:1116` — F/R toggle, 54×120 at (50,50); two 54×54 cells: `F` (2386:1117, selected) / `R` (2386:1119).
- `2386:901` — "Profile Favorites" strip, 1580×120 at (154,50): 5 cells of 300×120. In F mode the
  cells are auto-fav beans (`Nicaragua Jinotega…`, `Ethiopian Yirgachef…`, `Rwanda Bourbon…`,
  `Ethiopian Yirgachef…`) + last cell `VIEW ALL AUTO FAV`.
- `2386:893` — right control group: `DYE` / `Settings` / `Sleep` (180×72 each).

---

## 1. Why a KV bridge

DYE2 and Streamline are separate runtimes that cannot touch each other's DOM:

- **DYE2** — flutter_js plugin, serves HTML pages (`dye2-plugin/`).
- **Streamline** — standalone vanilla-JS SPA (`streamline_project/index.html` + `src/modules/`).

They share only the bridge. The auto-fav `/api/v1/auto-favourites` REST endpoints
**do not exist** (review gap #3). The bridge *does* expose a generic KV store
(`rea_restapi.yml` → `/api/v1/store/{namespace}/{key}`), so that is the handoff:

```
DYE2 auto-fav editor ──POST──► KV store ──GET──► Streamline header renders chips
   (write array)        (dye2.reaplugin)              │
                                       chip tap ──PUT /api/v1/workflow (apply snapshot)
                                                       └──► Streamline refreshes its controls
```

KV API (all under `/api/v1/store/{namespace}/{key}`):
- `GET /store/{ns}` → array of keys
- `GET /store/{ns}/{key}` → value (404 if missing)
- `POST /store/{ns}/{key}` → set (204)
- `DELETE /store/{ns}/{key}`

---

## 2. KV schema

- **namespace:** `dye2.reaplugin`
- **keys (two):**
  - `autoFavourites` → JSON array of `AutoFavourite` (F mode). Shape in `DYE2_REDESIGN_PLAN.md §4`.
  - `recipes` → JSON array of `Recipe` (R mode). Shape in `DYE2_REDESIGN_PLAN.md §4`.
    Recipes have no REST endpoint either (review gap #2), so they live in the KV store
    alongside auto-favs and feed the R side of the toggle.

One key holding the whole array → a single atomic read for the dashboard, and
list/create/update/delete are array operations in DYE2.
`ponytail:` whole-array rewrite on every mutation; fine for the expected dozens of
favs on one tablet. Upgrade path if it ever grows: key-per-fav (`autoFav:{id}`) +
the `GET /store/{ns}` key listing.

**Snapshot must be denormalized for display + apply.** Today `snapshot` stores
`beanId`/`grinderId`. The Streamline chip needs a label and the workflow needs
display strings, and Streamline shouldn't have to fetch beans/grinders. Extend the
snapshot written by DYE2's auto-fav editor to also carry:
`coffeeName`, `coffeeRoaster`, `harvestDate`, `grinderModel`, `profileTitle`.
(IDs stay for linking; strings drive label + `workflow.context`.)

---

## 3. Phase A — DYE2 side (this repo) ✅ DONE
Built & verified against the live bridge: KV round-trip works; recipe-edit normalizes to
5 stable-id slots; auto-fav-edit captures the live workflow snapshot on create; closes
review gaps #2 (recipes) and #3 (auto-favourites). Files: `utils/dev-api.ts`,
`pages/recipe-edit.ts`, `pages/auto-fav-edit.ts`. Note: bridge returns 200 (not 404) for
a missing key → `kvGetArray` falls back via `Array.isArray(val) ? val : []`.

**Update (denormalized apply payload — supersedes most of B4).** Each fav/recipe now also
embeds a **ready-to-PUT `workflow`** (`{ context, profile? }`, favourite honours `copyMask`),
plus `subtitle` / recipe `title` / `capturedAt`. Contract: `docs/KV_CONTRACT.md`.
Consequence: Phase B no longer reimplements the B4 `context`/`profile` mapping — it PUTs
`item.workflow` as-is. The **one exception is recipe steam / hot-water / flush**: those
`WorkflowRequest` sub-objects require `targetTemperature`/`flow` a recipe doesn't capture,
so they are **not** in `workflow` and must be applied by merging `dashboardVariables` onto
the **live** workflow (GET → override recipe fields → PUT). DYE2's own
`dashboard.ts applyRecipe` now does this merge; Streamline must mirror it. `brewC` has no
workflow target (profile-level) — display only. **Delete CRUD** (`deleteAutoFavourite`/
`deleteRecipe`) is intentionally not built yet — no UI delete affordance exists; add both
when a delete button lands.


Goal: make the existing auto-fav UI persist to the KV store instead of the missing
REST endpoints. **No UI changes** — `auto-favs.ts` / `auto-fav-edit.ts` already call
`getAutoFavourites / getAutoFavourite / createAutoFavourite / updateAutoFavourite /
deleteAutoFavourite`. Only their implementations in `utils/dev-api.ts` change.

### A1. Add KV helpers to `dev-api.ts`
```js
const KV_NS = 'dye2.reaplugin';
const AF_KEY = 'autoFavourites';

async function kvGet(key) {
  const res = await fetch(API_BASE_URL + '/store/' + KV_NS + '/' + key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function kvSet(key, value) {
  const res = await fetch(API_BASE_URL + '/store/' + KV_NS + '/' + key, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
}
```

### A2. Reimplement the 5 functions over the array
- `getAutoFavourites(opts)` → `(await kvGet(AF_KEY)) || []`, then apply the existing
  `?groupBy=` sort client-side (it already had a groupBy param).
- `getAutoFavourite(id)` → find in array.
- `createAutoFavourite(data)` → assign `id` (`crypto.randomUUID()`) + `capturedAt`
  (ISO now), push, `kvSet`, return the new record.
- `updateAutoFavourite(id, data)` → map/replace by id, `kvSet`.
- `deleteAutoFavourite(id)` → filter out, `kvSet`.

### A3. Editor snapshot denormalization
In `auto-fav-edit.ts` save handler, when building `snapshot`, also write the display
strings listed in §2 (pull from the current workflow / selected bean already in
session). Small addition to the existing `data` object.

### A4. Drop the dead REST functions
Remove the old `/auto-favourites` fetch bodies (now replaced). No route/spec change
needed — KV store already exists.

### A5. Same treatment for recipes (R mode source — closes gap #2)
`recipe-edit.ts` + `dev-api.ts` `getRecipes`/`updateRecipe` currently call the
non-existent `/api/v1/recipes`. Repoint them at KV key `recipes` with the same array
pattern (`getRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`, `deleteRecipe`).
This makes the R side of the Streamline toggle work and unblocks the recipe editor.

**Verify:** dev server + bridge → create a fav in `/auto-fav-edit` and a recipe in
`/recipe-edit`, then `GET /api/v1/store/dye2.reaplugin/autoFavourites` and
`…/recipes` return them; reload `/auto-favs` and `/recipe-edit` show them; delete works.

---

## 4. Phase B — Streamline side (`streamline_project`)

### B1. KV helpers in `src/modules/api.js`
Mirror A1 using the existing `API_BASE_URL` (`api.js:6`):
`getPluginKv(ns, key)` / (read-only is all Streamline needs).

### B2. New module `src/modules/dyeStrip.js`
- `loadDyeStripData()` → GET both KV keys (`autoFavourites`, `recipes`), cache.
- `renderStrip(mode)` → fill the 5-slot strip for `mode` ∈ `{F, R}`:
  - **F (Favorites):** favs with `alwaysOnDashboard !== false`, ordered by `favSlot`
    then `capturedAt`, **max 4** cells + a trailing `VIEW ALL AUTO FAV` button.
    Cell label = `snapshot.coffeeName` + a harvest/country sub-line (Figma `2386:904` etc.).
  - **R (Recipes):** up to 5 recipe cells; label = `recipe.name`.
  - Active cell = filled navy (`--mimoja-blue`).
- `applyFavourite(fav)` → workflow patch from `snapshot` filtered by `copyMask` (B4) → PUT.
- `applyRecipe(recipe)` → workflow patch from `recipe.dashboardVariables` + `beanId`/
  `profileId` (B4) → PUT.
- After any apply, call Streamline's workflow-refresh path so the left controls update.
- `VIEW ALL AUTO FAV` → open DYE2 `/api/v1/plugins/dye2.reaplugin/auto-favs`;
  `DYE` button → `…/dashboard`.

### B3. Header markup — P/F/R toggle + strip (`index.html:58-76`)
Header is `h-[168px]`. Decision (b): a **3-way vertical toggle** `P | F | R`, default `P`.

- **Toggle** (extends Figma `2386:1116`): vertical stack of three ~54px pills,
  `P` (top) / `F` / `R`, at far top-left (x≈50, y≈50). Add `P` above the Figma's F/R.
  Active pill filled navy. Click → `setStripMode('P'|'F'|'R')`; persist in
  `localStorage('streamline.dyeStripMode')`, default `'P'`.
- **Two strips, one slot:** keep the existing profile `<nav>` (`index.html:60-66`) as the
  `P` strip — untouched. Add a sibling `<nav id="dye-strip" hidden>` that the controller
  fills for `F`/`R` (rendered by B2). `setStripMode` shows exactly one `<nav>` and hides
  the other, and toggles the active pill.
  - `P` → show profile `<nav>` (existing 5 `fav-profile-btn-*`); F/R logic dormant.
  - `F` → show `#dye-strip` with auto-fav beans + `VIEW ALL AUTO FAV`.
  - `R` → show `#dye-strip` with recipes.
- **DYE button:** add to the right control group (`index.html:68`, before Settings/Sleep)
  to match Figma `2386:893` (DYE / Settings / Sleep).
- Profile-fav logic in `profileManager.js` / `app.js:729` is **untouched** — `P` is the
  current behaviour verbatim; only the new `#dye-strip` + toggle are added.

### B4. Apply semantics (`copyMask` → workflow)
PUT `/api/v1/workflow` with a `context` patch (only `context`/`profile` accepted,
per v0.5.2). For each mask key that is on:

| mask key      | snapshot field            | workflow target                          |
|---------------|---------------------------|------------------------------------------|
| `dose`        | `dose`                    | `context.targetDoseWeight` (number)      |
| `drink`       | `drink`                   | `context.targetYield` (number)           |
| `grindSetting`| `grindSetting`            | `context.grinderSetting` (string)        |
| `grinder`     | `grinderId`,`grinderModel`| `context.grinderId`, `context.grinderModel` |
| `beans`       | `beanId`,`coffeeName`,`coffeeRoaster` | `context.beanBatchId?`, `context.coffeeName`, `context.coffeeRoaster` |
| `roastDate`   | `roastDate`               | (display only; not a context field)      |
| `barista`     | `barista`                 | `context.baristaName`                    |
| `drinker`     | `drinker`                 | `context.drinkerName`                    |
| `note`        | `note`                    | `context.extras.note`                    |
| `profile`     | `profileId`/`profileTitle`| `workflow.profile` — fetch via `GET /profiles/{id}` then include, OR reuse Streamline's existing profile-apply by id |

Profile is the one heavy field: prefer reusing Streamline's existing profile-load
path (it already applies profiles to the workflow) keyed by `profileId`, rather than
re-PUTting a full profile object.

**R mode (recipe apply).** ⚠️ Superseded by the Phase A update above + `KV_CONTRACT.md`.
Preferred path: PUT `recipe.workflow` (covers `dose→targetDoseWeight`,
`drink→targetYield`, `grind→grinderSetting`, `grinderId`, barista/drinker, profile), then
for steam/hot-water/flush do the **live merge** (GET workflow → override
`steamSettings.duration/flow`, `hotWaterData.volume/targetTemperature`, `rinseData.duration`
from `dashboardVariables` → PUT). Copy the exact mapping from `dashboard.ts applyRecipe`.
`brewC` is display-only (profile-level, no workflow target). A recipe has no `copyMask`.

### B5. Refresh after apply
Streamline holds workflow values in its own controls. After the PUT, re-pull the
workflow and call the existing UI update functions (the same ones used on initial
load / after a profile change) so Grind/Dose/Drink/Brew/etc. reflect the applied fav.
Identify the exact refresh entry point during implementation (`app.js` loadInitialData
+ `ui.js` updaters).

---

## 5. Open questions (resolve before/at build)
1. **Profile apply path** — confirm the reusable function in `profileManager.js` that
   applies a profile by id, vs PUT-ing a full profile object.
2. **Workflow→controls refresh** — confirm the single function to call after apply so
   all left-rail controls update without a full reload.
3. **Selected-state persistence** — should the active chip stay highlighted across
   reloads (store `activeAutoFavId` in KV/localStorage), or is it transient?
4. **DYE / VIEW ALL navigation** — in-app navigation to the DYE2 plugin URL: same
   webview route or a new view? Confirm how Streamline currently opens plugin pages.
5. **Live updates** — if a fav/recipe is edited in DYE2 while Streamline is open, the
   strip updates only on reload (no KV websocket). Acceptable for v1; note it.
6. ✅ **Profile-fav coexistence (B3)** — resolved: 3-way `P | F | R` toggle, default `P`.
   Profile-fav strip preserved as the `P` mode; F/R add a parallel `#dye-strip`.

## 6. Validation checklist
- [ ] DYE2: fav create/edit/delete persists to `store/dye2.reaplugin/autoFavourites`.
- [ ] DYE2: recipe create/edit/delete persists to `store/dye2.reaplugin/recipes` (gap #2).
- [ ] Streamline: P/F/R toggle (default P) swaps + persists; P = profile favs unchanged;
      F renders auto-fav beans (max 4 + "VIEW ALL AUTO FAV"); R renders recipes.
- [ ] F cell tap PUTs workflow with only `copyMask` fields; R cell tap applies recipe;
      left controls refresh after either.
- [ ] `context`-only workflow patch (no legacy `doseData`/`grinderData`).
- [ ] No regression to existing profile-favourite logic.
- [ ] DYE2 unused (empty/missing KV keys) → header behaves exactly as today.

## 7. Sequencing
1. Phase A (DYE2 KV persistence + denormalized snapshot) — self-contained, verifiable
   in this repo against the bridge.
2. Phase B (Streamline render + apply + toggle) — depends on A producing KV data.
3. Update `DYE2_REDESIGN_PLAN.md` §3.10 / Phase 4 to point here and mark progress.
