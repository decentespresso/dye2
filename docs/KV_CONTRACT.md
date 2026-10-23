# DYE2 KV Contract

How DYE2 persists auto-favourites, recipes, filter baskets, and equipment, and how a
read-only consumer (the Streamline dashboard) should read and apply them.

## Storage

The Streamline Bridge has no `/recipes` or `/auto-favourites` resource, and
(as of this writing) no equipment resource for baskets/portafilters/drippers
either — see `bc-map.ts` `bcMapEquipment`. DYE2 persists each collection as a
**single JSON array** under one key in the generic plugin KV store:

- Namespace: `dye2.reaplugin`
- Keys: `autoFavourites`, `recipes`, `baskets`, `equipment`
- URL: `GET/POST /api/v1/store/{namespace}/{key}`
- `GET` on a key that's never been written returns **`200` with body `null`**
  (verified against `kv_store_handler.dart` — it always responds `jsonOk`,
  never 404). Treat any non-array response (`null` included) as `[]`.
- Each value is a JSON array of item objects (never an object/map).

**Baskets is transitional.** [decentespresso/decaid#727](https://github.com/decentespresso/decaid/pull/727)
adds a real `/api/v1/equipment` resource (`type: basket|portafilter|dripper|other`)
to the bridge, mirroring Grinders. Once that ships and DYE2 migrates onto it,
`baskets` moves off the KV store described here onto a typed, discoverable
endpoint — check whether it has landed before building new consumers against
the `baskets` key below. `autoFavourites`/`recipes` are DYE2-specific concepts
with no native bridge equivalent and are expected to stay on the KV store.

## Access model — this is not a private store

The KV store is **not scoped to the owning plugin**. Decaid's
`/api/v1/store/{namespace}/{key}` routes take `namespace` and `key` as plain
path params with no ownership or permission check (see
`kv_store_handler.dart` / `kv_store_service.dart` in the Decaid repo) — any
skin or plugin can `GET` (or `POST`/`DELETE`) `dye2.reaplugin`'s keys today,
the same as its own. Nothing in the bridge stops a second writer from racing
DYE2 or corrupting an array; the single-writer rule below is a convention
this document defines and DYE2 follows, not something the platform enforces.
That's also exactly why this file exists: to give another consumer (the
Streamline dashboard, or any other skin) a documented, stable shape to read
against instead of reverse-engineering it.

## Single-writer rule

**DYE2 is the sole writer.** It rewrites the whole array on every mutation. A
consumer (skin/dashboard) is **read-only**: `GET` these keys, never `POST` them.
Do not merge, dedupe, or write back — you will clobber concurrent DYE2 edits.

**`recipes` writer rule.** The pages (`updateRecipe` and friends) are the sole routine writer of
`recipes`. The plugin runtime writes it only (a) during the one-time migration gated by the
`recipesMigrated` plugin-storage flag (legacy ids -> `stripSlot`, drop `suggested` rows, and the
self-heal `dedupeRecipeSlots`: of rows sharing a `stripSlot`, the newest `capturedAt` keeps it, ties
go to the larger id, the others become `null`), re-reading the key right before that write; and (b)
on an explicit user action, `save-recipe`. It must not rewrite `recipes` on every load: the host
store is last-write-wins over the whole array, and an overlapping page save and plugin write lose
one side (this once left two rows both holding slot 1).

**`autoFavourites` slot rule.** One saved favourite per `favSlot`, the same as one recipe per
`stripSlot`: `createAutoFavourite`/`updateAutoFavourite` (dev-api `takeSlot`) clear `favSlot` on
whatever else held it in the SAME array write. The usable range is **1..4 or null**: the F strip
shows four favourites (its fifth cell is VIEW ALL AUTO FAV), so a writer stores any other value as
`null` and `assignSlots` never hands out or honours slot 5. A one-time pass gated by the
`favSlotsMigrated` plugin-storage flag runs `dedupeFavSlots` over the SAVED rows (re-reading the key
before the write): of rows sharing a `favSlot`, a shown row (`alwaysOnDashboard !== false`) beats a
hidden one, then the newest `capturedAt`, then the larger id; losers become `favSlot: null` and keep
every other field. `auto: true` recents are not de-duplicated: `assignSlots` re-places them on every
refresh (which also applies `dedupeFavSlots` to the saved rows it rewrites, so it cannot undo the
migration). An existing saved row still holding slot 5 is left as stored; it just never appears.

This includes "dialling in" from the Streamline dashboard. DYE2's plugin runtime
writes edits from the live workflow onto the selected recipe itself, when asked
(below); a skin must not read-modify-write the arrays to do the same. (Older skin builds that
still do are being retired; until they are, the host store's last-write-wins applies.)

### Selection: which item is being dialled in

The selection is **derived from the live workflow, never stored** (dye2#36). Decaid owns the
workflow; a highlight means "the live workflow is this item":

| Family | Selected when |
| --- | --- |
| recipe | `workflow.context.extras.dye.recipeId` names it |
| favourite | the live workflow equals its `snapshot` on the fields the snapshot holds (dose, drink, grindSetting, rpm) |
| recent (`auto: true`) | reported as `kind: 'favourite'` + `auto: true` (the only shape the current skin renders); same comparison against that row's own `workflow` |

A recipe keeps its highlight when fields drift and reports `modified: true` (the `*`): the live
`recipeFields` differ from `dashboardVariables`, on the fields the recipe holds only (steam is
ignored while steam is off, `brewC` for a recipe naming no profile). A favourite or recent has
no save target, so any drift **deselects** it. An empty snapshot never matches. If a recipe and a
favourite/recent both match, the recipe (the explicit id) wins; among rows, saved favourites are
tried before recents.

**`recipeId` rules.** A recipe's identity is its profile: DYE2's recipe apply sets it; applying
a favourite or recent, pasting a shot, or any profile change from any source (including the
Streamline P strip: the plugin compares `profileFingerprint` on every `workflowUpdated`) sets it
to `null`; tile edits (dose / yield / grind) and machine-originated changes leave it alone.
**Consumer side:** an apply made by DYE2's dashboard nulls the id itself, but a skin applying a
favourite, recent or profile from its own strip must also PUT
`context.extras.dye.recipeId: null`, or a favourite naming no profile leaves a stale recipe
highlight. That is the streamline-js#159 dependency.

Decaid copies the whole workflow onto each `ShotRecord` (`de1_state_manager.dart`), so shots
carry `workflow.context.extras.dye.recipeId`. An id with no recipe row (deleted, or made on
another Decaid) is recovered from the newest of the last 50 shots carrying it; none found means
no highlight, quietly.

```
GET  /api/v1/plugins/dye2.reaplugin/selection    -> { kind: 'recipe'|'favourite', id, modified, auto? } | null
POST /api/v1/plugins/dye2.reaplugin/selection {kind, id}  -> compat shim, stores nothing: {kind:'recipe'} PUTs
                                                   recipeId, anything else nulls it; returns the derived selection.
                                                   Going away with streamline-js#159.
POST /api/v1/plugins/dye2.reaplugin/record       -> { saved, kind, id } writes the dial-in onto the selected recipe
POST /api/v1/plugins/dye2.reaplugin/save-recipe {name?, slot?} -> { id, name } new recipe from the live workflow, selected at once
```

The derived answer is mirrored to plugin storage, so `GET /api/v1/store/dye2.reaplugin/selection`
still returns it (`{}` when none) and a `changed` push fires when `kind:id:modified` changes.
The mirror is an output, not state: it is recomputed on every `workflowUpdated`. A one-time
migration (`selectionMigrated`) clears the old stored value and `extras.dye.selection`; the
`extras.dye` field flags are Streamline's and are untouched.

**`record`** (the skin's "Save changes") patches only the changed fields of the selected
**recipe** (a favourite or recent answers `saved: false`): dose, drink, grind, `brewC`, steam,
hot-water and flush values in `dashboardVariables`, with the embedded `workflow` kept in step.
"Changed" is measured against what the workflow held when the recipe id first appeared (an
in-memory baseline; after a plugin restart those baseline-gated fields are simply not adopted).
A workflow event alone never writes. `record` answers `{ saved: false, reason }` for nothing
selected or nothing moved, never an error for "no change". Steam is not recorded from a
workflow whose steam is off (`targetTemperature` below 135).

**`save-recipe`** builds the row from the live workflow (`dashboardVariables` from
`recipeFields`, bean/grinder/profile from `context`/`profile`, `workflow` the live one trimmed,
`extras.dye` rebuilt as `markDye` flags for the fields the row carries, without `recipeId`/`selection`), stores it as a new row with an opaque id and `stripSlot` the body's `slot` (1..5; its previous holder stays in the library and loses the slot) or `null` when none is given (library only; a recipe is never placed automatically, so there is no 409) and PUTs its id as `recipeId`. The name is the
body's `name`, else `<first word of profile title> <drink>`: a generic title word (Default,
Advanced, Custom, Profile, New, Untitled) is dropped; drink is, in order, steam on and set
(duration <=20 s Flat White, <=35 s Cappuccino, otherwise or unknown Latte), hot water set
(Americano), else yield/dose ratio (<1.6 Ristretto, <=2.4 Espresso, otherwise Lungo; Espresso
when unknown). A collision appends the bean's first word, then a counter.

## Freshness

DYE2 exposes a push channel: the `changed` websocket endpoint,
`ws://<bridge-host>:8080/api/v1/plugins/dye2.reaplugin/changed`. It emits
`{ "what": "workflow" }` after DYE2's plugin runtime writes a KV key and after a
recipe/favourite is applied (not `"skin"`: the skin only re-reads its DYE strip's KV
data for pushes other than `{"what":"skin"}`). A push means "something
changed, re-read"; it carries no data. Streamline discovers it through the `skin`
endpoint (`{"version":1,"surfaces":[],"live":{"endpoint":"changed"}}`).

Writes made by DYE2's *browser pages* (editing a recipe, say) are not pushed — they
don't pass through the plugin runtime — so a consumer should still re-`GET` the key on
page focus and `visibilitychange`.

## Querying the data

Every key is a plain, unauthenticated HTTP `GET` against the bridge — no
plugin-specific client or SDK needed, from a terminal or from a skin's own
browser-side code.

From a terminal, against a bridge reachable at `<bridge-host>:8080` (the
dev server proxies the same path at `:4444`, see the root `README.md`'s
"Build and run" section):

```bash
curl http://<bridge-host>:8080/api/v1/store/dye2.reaplugin/equipment | jq
curl http://<bridge-host>:8080/api/v1/store/dye2.reaplugin/recipes   | jq
```

From a browser-side consumer:

```js
async function getDyeCollection(key) {
  const res = await fetch(`/api/v1/store/dye2.reaplugin/${key}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const val = await res.json();
  return Array.isArray(val) ? val : [];   // null on a never-written key — see "Storage" above
}

const equipment = await getDyeCollection('equipment');
const recipes   = await getDyeCollection('recipes');
```

### Worked example: resolve a shot's equipment selection

A shot only stores equipment **ids** plus denormalised **names** (see "Where
equipment data lives" below) — it does not carry each item's `custom`
fields. To show more than the name (e.g. the live values, honouring a
per-shot override), cross-reference the `equipment[]` table:

```js
async function shotEquipmentDetails(shot) {
  const extras = (shot.annotations && shot.annotations.extras) || {};
  // Pre-multi-select shots may still carry the singular equipmentId/equipmentName.
  const ids   = extras.equipmentIds   || (extras.equipmentId   ? [extras.equipmentId]   : []);
  const names = extras.equipmentNames || (extras.equipmentName ? [extras.equipmentName] : []);
  if (!ids.length) return [];

  const all = await getDyeCollection('equipment');
  return ids.map((id, i) => {
    const item = all.find(e => e.id === id);   // undefined if the row was since deleted
    const override = extras.equipmentCustom && extras.equipmentCustom[id];
    return {
      id,
      name: item ? item.name : names[i],       // fall back to the denormalised name
      custom: override || (item && item.custom) || [],
    };
  });
}
```

The same pattern applies to a recipe (read `dashboardVariables.equipmentIds`
etc. instead of `annotations.extras.*`) or an auto-favourite (read
`snapshot.equipmentIds` etc.) — only the container object differs; see the
table in "Where equipment data lives" below.

## Applying an item to the workflow

Every item written by this version carries a `workflow` field that is a
ready-to-PUT `WorkflowRequest` body. For a **favourite** it is `{ context, profile? }`; for a
**recipe** it is `{ context, profile?, steamSettings?, hotWaterData?, rinseData? }` (the
three sub-objects are partial, see "Recipes: steam / hot-water / flush settings" below). To
apply (e.g. on tapping a card):

```
PUT /api/v1/workflow   with body = item.workflow
```

No transformation needed. `PUT /api/v1/workflow` accepts
`{ context, profile?, steamSettings?, hotWaterData?, rinseData? }`.

### Recipes: steam / hot-water / flush settings

A recipe can hold **every** steam / hot-water / flush setting, each optional in
`dashboardVariables`; absent or `null` means "leave the machine's value alone" and `0`
is a real value:

```
steamTempC      steamSettings.targetTemperature     hotWaterTempC     hotWaterData.targetTemperature
steamTimeS      steamSettings.duration              hotWaterTimeS     hotWaterData.duration
steamFlowMls    steamSettings.flow                  hotWaterMl        hotWaterData.volume
steamStopAtTempC steamSettings.stopAtTemperature    hotWaterFlowMls   hotWaterData.flow
flushTempC      rinseData.targetTemperature         flushFlowMls      rinseData.flow
flushS          rinseData.duration
```

`steamMode` (`time`|`flow`) and `hotWaterMode` (`vol`|`temp`) are **display-only**: they say
which of a pair the recipe editor shows. Apply ignores them and writes every setting held.
The editor has a control for every field in the table; `steamTempC` and `steamStopAtTempC`
read `0` as **Off** and save it back as `0`.

The embedded `workflow` carries these as **partial** `steamSettings` / `hotWaterData` /
`rinseData` holding only the fields the recipe holds (omitted entirely when it holds none).
`PUT /workflow` deep-merges a partial sub-object onto the live, complete one and omitted fields
keep their value (`rea_restapi.yml`; `workflow_handler.dart` `_applyUpdate`). DYE2's own
dashboard apply does the merge itself: it lays the held fields over the live sub-object
(`GET /api/v1/workflow`) and only when that sub-object exists.
`brewC` has no workflow field of its own (brew temperature lives on the profile), so apply
shifts the profile instead: the first step goes to `brewC` and every other step moves by the
same amount (94/90/88 at 92 becomes 92/88/86); a profile with no steps is left alone. It applies
to whatever profile the workflow ends up with, so the stored `workflow.profile` is shifted only
when the recipe names a profile.
DYE2's own dashboard (`dashboard.ts applyRecipe`) does exactly this merge; Streamline
should mirror it. `context`/`profile` from `workflow` still apply as a plain PUT.

## Optional fields — MUST fall back

`workflow`, `subtitle`, and (on recipes) `title` / `capturedAt` are present **only
on items written by this version of DYE2**. Older items lack them. Consumers MUST
treat these as optional:

- No `workflow` ⇒ derive the apply-payload from the legacy fields yourself
  (favourite: `snapshot` + `copyMask`; recipe: `dashboardVariables` + top-level
  fields), or skip apply.
- No `subtitle` ⇒ derive a label from `snapshot` / `beverage` / `beanName`.
- No recipe `title` ⇒ fall back to `name`.

Legacy fields (`snapshot`, `copyMask`, `dashboardVariables`, `name`, …) are **kept**
— DYE2's own pages still read them. Do not assume they were removed.

### Baskets have no `workflow` field

Unlike favourites/recipes, `baskets[]` items are not directly PUT-able to
`/api/v1/workflow` — a basket is applied by writing just
`context.extras.basketId` / `context.extras.basketName` (see the picker's
CONFIRM handler in `basket-picker.ts`), not a full context replacement.

## Item schemas

### `autoFavourites[]`

```
{
  id, title, beverage,
  alwaysOnDashboard, favSlot,   // favSlot: 1..4 | null, one saved favourite per slot (see autoFavourites slot rule)
  copyMask: { profile, beans, roastDate, grinder, basket, equipment, grindSetting,
              dose, drink, barista, drinker, note },   // booleans; absent ⇒ on
  snapshot: {
    profileId, profileTitle,
    profileSnapshot,           // optional, full recorded Profile (steps included) captured when the
                                // source profile might not be in the library — apply this directly
                                // instead of resolving profileId when it's set (nested under snapshot
                                // here, unlike the recipe's top-level field)
    beanBatchId, coffeeName, coffeeRoaster,
    roastDate, grinderId, grinderModel, basketId, basketName, grindSetting, rpm,
    dose, drink, barista, drinker, note,
    equipmentIds, equipmentNames,   // arrays in lockstep — see equipment[] below
    equipmentCustom,                // { [equipmentId]: [{key,value}, ...] } — per-value overrides, optional
  },
  capturedAt,                 // ISO 8601

  // added by this version (optional for consumers):
  subtitle,                   // "roaster · coffee" || beverage || ''
  workflow: { context, profile? }   // ready-to-PUT WorkflowRequest — does NOT carry equipment, see note below
}
```

**Auto (recent) entries.** Entries with `auto: true` are computed by DYE2 from shot
history (up to 5 bean-batch + profile + grinder groups, best first by `recentRank`) and are
rewritten wholesale by DYE2's plugin runtime after every stored or edited shot and on DYE2 page
loads. They fill the dashboard slots (1–4) that saved favourites don't claim; entries that don't
fit have `alwaysOnDashboard: false`. Their `workflow.profile` is the full recorded profile of
the source shot, and `workflow.context` carries explicit `null` for bean/grinder
fields the source shot lacked. Consumers read them like any favourite; never edit or
write them, and don't key UI state on their `id` (it changes when a newer shot takes
over the group). Note: the host store is last-write-wins; see the `recipes` writer rule above
for what the plugin runtime may write on `recipes`.

**Ranking.** Computed from the `shotIndex` tail (shots of the last `TAIL_DAYS`); `now` is a
parameter, so it is deterministic. Rating is `annotations.enjoyment / 10` (0..1).

```
quality = (Σ rating + m·prior) / (n + m)       n = rated shots in the group; m = 2, prior = 0.6
w(shot) = 0.5 ^ (ageDays / 15)                 HALF_LIFE_DAYS = 15
volume  = Σ w(shot) over the group's shots
score   = quality × volume / (volume + 1)
```

"Shots" in the score (`volume`, `n`) means shots inside `TAIL_DAYS`, never lifetime: the index keeps no
per-group lifetime counters. Ties: newest shot desc, then group key asc. Shots excluded: cleaning/calibrate `beverage_type`,
no bean identity, and an aborted `stopReason` (`error`, `disconnected`, `aborted`, `cancelled`;
any other value counts). Constants (`recent-favs.ts`): `TAIL_DAYS = 120`, `STALE_DAYS = 60` (a
group whose newest shot is older is dropped from the strip) and `UNRATED_SCORES_AT_PRIOR = true`
(an unrated group scores at the prior). The last two are not yet confirmed product decisions.

### `shotIndex` (object, not an array; written only by the plugin runtime)

```
{ v: 2, builtAt, newestShotId, newestTs, total, etag,
  reps: { <groupKey>: { id, timestamp, workflow, annotations?: { extras: { rpm } } } },  // newest shot per group
  tail: [ { id, ts, rating /* 0..1 | null */, key, rid /* recipeId | null */ } ],         // last TAIL_DAYS, bounded
  uses: { <recipeId>: n }       // shots per recipe id in the tail
}
```

`uses` counts tail rows whose workflow carries `context.extras.dye.recipeId` (rows without one are
not counted). "Used" therefore means used in the last `TAIL_DAYS` (120 days), the same window as
the score; aborted shots and shots with no group never reach the tail, so they are not counted.
Select Recipe's Most/Least Used sorts read it.

A cache, safe to delete (it is rebuilt from the last `TAIL_DAYS` of history). Skins and other
plugins should not read it.

### `recipes[]`

```
{
  id,                          // opaque and stable (shot history and extras.dye.recipeId point at it, dye2#36).
                                // It is NOT the strip position. Legacy rows keep their id '1'..'5'.
  stripSlot,                   // 1..5 | null — the position on the Streamline R strip; null = saved in the
                                // library only. One recipe per slot: assigning n clears it on whoever held n,
                                // in the same write. NOTHING assigns a recipe slot automatically:
                                // `save-recipe` without a (valid 1..5) `slot` saves to the library with
                                // stripSlot null; with one it takes that slot and the previous holder stays in
                                // the library. There is no 409. This is deliberately unlike `favSlot`, where
                                // recents are auto-placed. A slot is only ever set by the barista (recipe-edit
                                // tabs, the auto-fav-edit slot picker, an explicit `slot`).
                                // Assigned in recipe-edit by its five header tabs (one per slot, named for the
                                // holder); SAVE writes the targeted slot through updateRecipe.
                                // Migration (plugin load, idempotent): a row whose id is '1'..'5' and that has
                                // no `stripSlot` gets stripSlot = Number(id). Cleared (null) stays cleared.
                                // One-off cleanup (plugin load, same pass, idempotent): an earlier release
                                // wrote `suggested: true` rows here; every such row is dropped, the key is
                                // written only if something was dropped, real recipes are untouched.
                                // The same one-time pass de-duplicates a shared stripSlot (see writer rule).
                                //
                                // The skin places by this field: streamline_project `recipeStripCells`
                                // (src/modules/dye-selection.js) reads `stripSlot`, ignores rows where it is
                                // null, and falls back to the legacy `recipe.id` position only when NO row
                                // carries the field at all (an older DYE2 mid-upgrade).
  name, beverage, barista, drinker,
  beanId, beanName, profileId, profileTitle,
  beanBatchId, beanRoaster,    // optional — the batch/roaster picked with the bean; apply sets
                                // context.beanBatchId / coffeeRoaster from them. Absent on older
                                // recipes. Dial-in does not repoint them (a mid-dial-in batch
                                // switch disarms the selection instead).
  profileSnapshot,             // optional, full recorded Profile (steps included) captured when the
                                // source profile might not be in the library — apply this directly
                                // instead of resolving profileId when it's set
  showOnStreamlineDashboard,
  dashboardVariables: {
    dose, drink, brewC, steamMode, steamTimeS, steamFlowMls,
    flushS, hotWaterMode, hotWaterMl, hotWaterTempC, grind, rpm, grinderId,
    steamTempC, steamStopAtTempC, hotWaterTimeS, hotWaterFlowMls,   // optional machine settings,
    flushTempC, flushFlowMls,                                       // see "Recipes: steam / hot-water / flush"
    grinderModel, basketId, basketName,
    equipmentIds, equipmentNames,   // arrays in lockstep — see equipment[] below
    equipmentCustom,                // { [equipmentId]: [{key,value}, ...] } — per-value overrides, optional
  },
  // The numeric dashboardVariables (dose … rpm) are a number, or null / absent when the recipe
  // editor's stepper was left blank. Never 0 for "blank": apply and dial-in recording skip a
  // null field but treat 0 as a real value.

  // added by this version (optional for consumers):
  title,                       // name || 'Recipe'
  subtitle,                    // beanName || beverage || ''
  capturedAt,                  // ISO 8601 (recipes had no timestamp before)
  workflow: { context, profile?, steamSettings?, hotWaterData?, rinseData? }   // ready-to-PUT WorkflowRequest — does NOT carry equipment, see note below
}
```

### `equipment[]`

The master list of kit (scale, tamper, WDT tool, dosing ring, kettle…),
managed in full (add / edit its `custom` fields / delete) on the `equipment`
manage page (`equipment.ts`; CRUD in `dev-api.ts`: `getEquipment`,
`createEquipment`, `updateEquipment`, `deleteEquipment`). One row per
distinct item. A shot's edit page can also create a row inline via
"+ New…", which round-trips to the manage page rather than a quick free-text
add — see "Where equipment data lives" below.

```
{
  id,                           // 'eqp-...' (or a uuid)
  name,                         // required, as the user typed it
  custom,                       // [{ key, value }, ...] — user-defined fields, optional/absent on older rows
  createdAt,                    // ISO 8601
}
```

`custom` is free-form: the user names their own fields (e.g. `Weight: 250g`,
`Burr size: 64mm`) on the manage page. There is no fixed schema for it —
consumers must treat it as an arbitrary array and not assume any particular
keys are present. Deleting a row here only removes it from this list — it
does not touch the `equipmentIds`/`equipmentNames` already denormalised onto
shots/recipes/favourites below (see next paragraph), so old records keep
their name even after the row they pointed at is gone.

#### Where equipment data lives

A record — a shot, a recipe, or an auto-favourite — references **zero or
more** `equipment[]` rows via the same shape wherever it appears: parallel
`equipmentIds` / `equipmentNames` arrays (names denormalised so a consumer
can render them without a second read against `equipment[]`, and so a
deleted row doesn't blank out the record), plus an optional `equipmentCustom`
map for per-record value overrides (see below). Only the container differs:

| Record        | Field path                                         |
|---------------|-----------------------------------------------------|
| Shot          | `annotations.extras.equipmentIds` / `equipmentNames` / `equipmentCustom` |
| Recipe        | `dashboardVariables.equipmentIds` / `equipmentNames` / `equipmentCustom` |
| Auto-favourite| `snapshot.equipmentIds` / `equipmentNames` / `equipmentCustom` (gated by `copyMask.equipment`, default on) |

One `equipment[]` row is one named kit item (e.g. "V60 kit") with its own
`custom` fields — it is not itself a bundle of unrelated tools; a record
bundles multiple rows by picking several from the Equipment dropdown (e.g.
"RDT tool" + "WDT tool" + "Dosing ring").

The same kit item can be dialed differently record to record (e.g. a WDT
tool used for 15s on one shot, 20s on another). A record may override a
selected row's field *values* — never its keys or which fields exist — via
its `equipmentCustom` map, keyed by equipment id:

```
equipmentCustom: {
  "<equipment id>": [{ key, value }, ...],   // same keys as that row's `custom`, values only
}
```

Absent here means "use the row's own `custom` values as the default" —
consumers should fall back to `equipment[].custom` for any id with no entry
(or no key) in `equipmentCustom`. Older shots (pre-multi-select) may still carry the singular
`annotations.extras.equipmentId` / `equipmentName` instead — treat that as a
one-item equivalent of the arrays above; DYE2 migrates a shot onto the array
fields (and drops the singular ones) the next time it's edited and saved.
Recipes/favourites have no such legacy singular form — the array shape is
all they've ever used.

Like baskets, equipment is **not** applied to `/api/v1/workflow` — there is
no `workflow`-embed equivalent (see `buildRecipeWorkflow` /
`buildFavouriteWorkflow` in `dev-api.ts`, which both skip it). A consumer
that wants to reproduce a recipe's or favourite's equipment selection reads
`equipmentIds`/`equipmentNames`/`equipmentCustom` directly from the table
above instead of expecting them inside the embedded `workflow` object.

### `baskets[]`

```
{
  id,                           // 'bskt-...'
  name,                         // required
  size,                         // 'single' | 'double' | 'triple' | 'bottomless' | 'other'
  diameterMm,
  notes,
  createdAt,                    // ISO 8601
}
```

Applying a basket does not use a `workflow` field (see above) — write
`context.extras.basketId` / `context.extras.basketName` directly.
