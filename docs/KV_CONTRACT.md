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

## Freshness

There is **no push channel** for the KV store. A consumer must **poll** — re-`GET`
the key on page focus and on `visibilitychange` (and/or a light interval) to pick
up changes DYE2 made while the consumer was idle.

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
ready-to-PUT `WorkflowRequest` body: `{ context, profile? }`. To apply (e.g. on
tapping a card):

```
PUT /api/v1/workflow   with body = item.workflow
```

No transformation needed. `PUT /api/v1/workflow` accepts
`{ context, profile?, steamSettings?, hotWaterData?, rinseData? }`; the stored
`workflow` only ever sets `context` and optionally `profile`.

### Recipes: steam / hot-water / flush need a live merge (not in `workflow`)

The embedded `workflow` deliberately **omits** `steamSettings` / `hotWaterData` /
`rinseData`. Those schemas require `targetTemperature` + `flow` (and hot-water
`volume`), which a recipe does not capture — so a complete, valid object can't be
built at save time. A recipe only stores partial intent in `dashboardVariables`
(`steamMode`/`steamTimeS`/`steamFlowMls`, `hotWaterMode`/`hotWaterMl`/`hotWaterTempC`,
`flushS`).

To apply these, **merge onto the live workflow** rather than blind-PUTting a partial:

```
GET /api/v1/workflow                     // has complete steamSettings/hotWaterData/rinseData
override only the recipe's fields:
  steam  time → steamSettings.duration = steamTimeS
  steam  flow → steamSettings.flow     = steamFlowMls
  hw     vol  → hotWaterData.volume    = hotWaterMl
  hw     temp → hotWaterData.targetTemperature = hotWaterTempC
  flush       → rinseData.duration     = flushS
PUT /api/v1/workflow  with the merged object
```

Only override when the base sub-object exists (it carries the required fields).
`brewC` has no workflow target (brew temperature lives on the profile) — display only.
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
  alwaysOnDashboard, favSlot,
  copyMask: { profile, beans, roastDate, grinder, basket, equipment, grindSetting,
              dose, drink, barista, drinker, note },   // booleans; absent ⇒ on
  snapshot: {
    profileId, profileTitle, beanBatchId, coffeeName, coffeeRoaster,
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
history (up to 5, the most recently used bean-batch + profile + grinder combinations,
newest first by `recentRank`) and are rewritten wholesale by DYE2's plugin runtime
after every stored or edited shot and on DYE2 page loads. They fill the dashboard
slots (1–5) that saved favourites don't claim; entries that don't fit have
`alwaysOnDashboard: false`. Their `workflow.profile` is the full recorded profile of
the source shot, and `workflow.context` carries explicit `null` for bean/grinder
fields the source shot lacked. Consumers read them like any favourite; never edit or
write them, and don't key UI state on their `id` (it changes when a newer shot takes
over the group). Note: the host store is last-write-wins, so DYE2 is now two writers
(plugin runtime + pages) on this key — both only replace their own entries, but a
write at the same instant can lose one side's change.

### `recipes[]`

```
{
  id,                          // '1'..'5'
  name, beverage, barista, drinker,
  beanId, beanName, profileId, profileTitle,
  showOnStreamlineDashboard,
  dashboardVariables: {
    dose, drink, brewC, steamMode, steamTimeS, steamFlowMls,
    flushS, hotWaterMode, hotWaterMl, hotWaterTempC, grind, rpm, grinderId,
    grinderModel, basketId, basketName,
    equipmentIds, equipmentNames,   // arrays in lockstep — see equipment[] below
    equipmentCustom,                // { [equipmentId]: [{key,value}, ...] } — per-value overrides, optional
  },

  // added by this version (optional for consumers):
  title,                       // name || 'Recipe <id>'
  subtitle,                    // beanName || beverage || ''
  capturedAt,                  // ISO 8601 (recipes had no timestamp before)
  workflow: { context, profile? }   // ready-to-PUT WorkflowRequest — does NOT carry equipment, see note below
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
