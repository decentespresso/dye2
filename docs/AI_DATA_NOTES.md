# AI Data Notes

Read this when touching bridge REST calls, the KV store, equipment, baskets, recipes,
auto-favourites, the workflow, or shot fields.

`docs/KV_CONTRACT.md` is the **authority** for the KV schemas and the read-only consumer
contract. This note covers how the code uses them and what bites. Do not duplicate schema
detail here — go read that file.

## Where Data Access Lives

Almost all bridge access is **browser-side**, by convention rather than necessity — the
plugin runtime does have a permission-gated `fetch` (`AI_RUNTIME_NOTES.md`), but only
`recent-favs.ts` uses it so far, because it must run on `shotStored`/`shotUpdated` and on
plugin load, not on a page open. `src/utils/dev-api.ts` is one large string of plain `async
function` declarations that become page globals when inlined — `getBeans()`, `updateShot()`,
`getWorkflow()` and so on, called directly with no namespace.

There is **no fetch wrapper, no retry, no caching, no request dedupe**. Every helper is
`fetch` → `if (!res.ok) throw new Error('HTTP ' + status)` → `res.json()`. A failed call
throws a bare Error with no body; callers handle it or it surfaces as an unhandled
rejection. Do not assume a shared error path exists.

## Two Persistence Tiers

| Tier | Resources | Shape |
| --- | --- | --- |
| Typed bridge resources | beans, bean-batches, grinders, shots, profiles, workflow | Real REST, real schemas in `rea_restapi.yml` |
| Generic KV store | `autoFavourites`, `recipes`, `baskets`, `equipment` | One JSON **array** per key |

KV lives at `/api/v1/store/dye2.reaplugin/{key}`. Read with GET, **write with POST** (not
PUT). `kvGetArray` coerces anything non-array — including the `null` an unwritten key
returns — to `[]`.

Three things about this store matter more than the schemas:

1. **It is unscoped.** Any skin or plugin can read *and write* these keys. DYE2's ownership
   is a convention, not an enforcement. `docs/KV_CONTRACT.md` describes the single-writer
   convention that everything relies on.
2. **Every mutation rewrites the whole array.** `create*`/`update*`/`delete*` do
   get-array → modify → put-array. Two concurrent writers means last-writer-wins over the
   *entire collection*, not just one row. There is a `ponytail:` comment at `dev-api.ts:160`
   acknowledging this as acceptable at one-tablet scale; if you add a second writer, it
   stops being acceptable.
3. **Derived fields are recomputed on write.** `updateAutoFavourite` / `updateRecipe`
   overwrite `subtitle`, `title` and `workflow` from the source fields every time. Hand-editing
   those in the store is pointless — they will be regenerated.

`baskets` is transitional. Decaid PR #727 adds a real `/api/v1/equipment` resource; check
whether it has landed before building anything new against the `baskets` key.

## Equipment Lives In Three Different Places

A shot, an auto-favourite and a recipe can each reference **multiple** equipment rows
(RDT, WDT, dosing ring…), always as two parallel arrays in lockstep — ids and names:

| Record | Path |
| --- | --- |
| Shot | `annotations.extras.equipmentIds` / `equipmentNames` (`pages/edit-shot.ts:401`) |
| Auto-favourite | `snapshot.equipmentIds` / `equipmentNames` (`pages/auto-fav-edit.ts:593`) |
| Recipe | `dashboardVariables.equipmentIds` / `equipmentNames` (`pages/recipe-edit.ts:722`) |

Same concept, three homes — there is no shared accessor. When adding a consumer, handle the
one shape you actually read and say which.

Shots also carry a **legacy singular** `equipmentId` / `equipmentName`. `equipmentArrays()`
(`edit-shot.ts:407`) reads either shape and normalises; writes delete the singular keys.
Read through that helper, never off `extras.equipmentId` directly. The comment at
`dev-api.ts:217` still describes the singular form — it is stale.

Per-record custom field **values** override the equipment row's saved defaults without
touching the row: `annotations.extras.equipmentCustom`, keyed by equipment id.

The shared widget is `src/utils/equipment-field.ts` (`initEquipmentField` +
`wireEquipmentValuesModal`). `edit-shot.ts` deliberately keeps its **own copy** rather than
migrate and risk a regression — so an equipment-field change may need making twice. Check
both.

## Workflow

`GET /api/v1/workflow` / `PUT` via `getWorkflow()` / `updateWorkflow(data)`.

PUTs are **partial** — `{ context: {...}, profile?: {...} }` — and the host merges with
`deepMergeJson`, where an explicit `null` overwrites and an empty `{}` is a no-op. So
clearing a field needs an explicit per-field `null`; omitting it leaves the old value.

`buildFavouriteWorkflow(fav)` and `buildRecipeWorkflow(recipe)` (`dev-api.ts:250,285`)
return a ready-to-PUT body. They mirror `dashboard.ts`'s apply functions but build a fresh
context and **return** it instead of mutating `currentWorkflow` — if you change how a
favourite maps onto the workflow, both sides need the change.

Auto-favourites gate each field through `copyMask`: `mask[k] !== false` means copy, so an
absent mask copies everything.

Fields with no schema slot ride in `context.extras` — `rpm`, `basketId`, `basketName`,
`note`. Note that `extras` is rebuilt by spread on each branch, so it merges rather than
clobbers within a single build.

`WorkflowContext` and `BeanBatch` are different schemas that share some field names, and not
all of them: `roastDate` is a `BeanBatch` field, not a `WorkflowContext` one — the bridge
accepts and drops it from workflow context, which is why `dashboard.ts` reads a shot's
`ctx.roastDate` only as a fallback before going to the linked batch. Name the schema when you
make a claim about a field.

Bean deletion: `DELETE /beans/{id}` removes only the bean row, and batches reference it with no cascade
while the host enforces foreign keys, so delete every batch first, archived included (`bean-delete.ts`).

## Shots

Paging via `getShots({limit, offset, order, grinderId, beanId, beanBatchId, coffeeName,
coffeeRoaster, search})`; `getLatestShot()`, `getShot(id)`, `updateShot(id, data)`,
`deleteShot(id)`. Paging logic is `src/utils/shot-paging.ts`, covered by
`test/shot-paging.test.mjs`.

**`annotations.enjoyment` is 0–10**, Decaid's own field — not de1app's or
visualizer.coffee's 0–100 `espresso_enjoyment`, and not a 0–5 star index. Decaid converts at
those two boundaries itself (decentespresso/decaid#887): its importer rescales on the way in,
its Visualizer plugin multiplies by 10 on the way out, and `PUT /api/v1/shots/<id>` rejects
anything outside 0–10. So DYE2's only job is 0–10 ↔ 5 stars, a halving and a doubling
(`shared-components.ts`), with both directions clamped.

This replaced an earlier 0–100 reading. Two rules are now gone and should not come back:

- **No ×20 / ÷20.** Writing `stars * 20` sends 80 for four stars, which Decaid rejects with
  HTTP 400; reading `enjoyment / 20` renders a stored 8 as zero stars.
- **No "an integer in [1,5] is a raw star index" branch** (issue #7). Under 0–10 those are
  ordinary canonical ratings, so that branch misreads normal data: a stored 4 is 2 stars,
  not 4. Rows written by the old raw-star bug are now indistinguishable from valid values,
  so repairing them needs a version or provenance marker, never a guess from the number.

Basket also has no schema field and lives in `annotations.extras`, same as RPM.

## Cross-Plugin Calls

`/api/v1/plugins/visualizer.reaplugin/*` — settings, `verifyCredentials`, `upload`. These
fail soft: `getVisualizerSettings()` returns `null` and `verifyVisualizerCredentials()`
returns `false` on a non-OK response, because the Visualizer plugin may not be installed.
Preserve that; do not make them throw.

## Verifying Host Behaviour

Decaid's Dart source is the authority for anything the bridge does — request handling,
merge semantics, KV responses, plugin lifecycle. It is checked out at
`/Users/markc/Documents/streamline_js/reaprime/reaprime/`. Read it rather than guessing.
Useful: `lib/src/services/webserver/` (REST handlers),
`lib/src/models/data/json_utils.dart` (`deepMergeJson`),
`lib/src/models/data/workflow_context.dart`.

Before asserting a field does not exist, grep the whole of `rea_restapi.yml` and the Dart
models, and scope the claim to the schema you checked.

## Troubleshooting

| Symptom | First place to inspect |
| --- | --- |
| A whole collection lost rows | Concurrent whole-array KV rewrite — `kvSetArray` |
| Edited `subtitle`/`workflow` in KV, change vanished | Recomputed on every `update*` write |
| Clearing a workflow field does nothing | `deepMergeJson` — omitted ≠ null; send explicit `null` |
| Equipment shows on the shot but not the favourite | Different paths; see the three-homes table |
| Equipment change works on one page only | `edit-shot.ts` keeps its own copy of the field |
| Ratings read back near zero, or a star click 400s | ×20/÷20 crept back in; the scale is 0–10 |
| Every rating reads two stars too high | The old [1,5] pass-through branch came back |
| KV read returns an object, code expects array | `kvGetArray` coerces; a direct `fetch` does not |
| Visualizer calls throw | They are meant to fail soft — plugin may be absent |
| Field exists in one schema, missing in another | `WorkflowContext` vs `BeanBatch` — name the schema |

## Focused Checks

```sh
cd dye2-plugin
npm test                       # bc-map, shot-paging, equipment, enjoyment-scale suites
```

Against a running bridge:

```sh
curl -s localhost:8080/api/v1/store/dye2.reaplugin/equipment | jq 'type, length'
curl -s localhost:8080/api/v1/workflow | jq '.context | keys'
```

For a KV schema change, re-read `docs/KV_CONTRACT.md` and update it in the same commit —
the Streamline dashboard reads these keys and will not be updated with you.
