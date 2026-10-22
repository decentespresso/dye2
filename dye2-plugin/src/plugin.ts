/// <reference path="./host.d.ts" />

import { renderGrindersPage } from "./pages/grinders";
import { renderBasketsPage } from "./pages/baskets";
import { renderEquipmentPage } from "./pages/equipment";
import { renderBeanPickerPage } from "./pages/bean-picker";
import { renderGrinderPickerPage } from "./pages/grinder-picker";
import { renderBasketPickerPage } from "./pages/basket-picker";
import { renderProfilePickerPage } from "./pages/profile-picker";
import { renderRoastersPage } from "./pages/roasters";
import { renderAddBeanPage } from "./pages/add-bean";
import { renderDashboardPage } from "./pages/dashboard";
import { renderPlotlyAsset } from "./utils/plotly-asset";
import { renderEditShotPage } from "./pages/edit-shot";
import { renderAutoFavsPage } from "./pages/auto-favs";
import { renderAutoFavEditPage } from "./pages/auto-fav-edit";
import { renderRecipeEditPage } from "./pages/recipe-edit";
import { renderBcImportPage } from "./pages/bc-import";
import { refreshRecentFavourites, shotPatchAffectsRecents } from "./utils/recent-favs";
import {
  deriveSelection,
  recipeIdOf,
  recipeModified,
  idProfileChanged,
  profileFingerprint,
  resolveRecipeFromHistory,
  proposeRecipeName,
  ownedRecipeFields,
  machineFields,
  withMachineSettings,
  readMachineSettings,
  recordWorkflow,
  type Selection,
} from "./utils/workflow-record";

const API = "http://localhost:8080/api/v1";
const NS = "dye2.reaplugin";
const EMPTY_BASELINE: Selection = {
  kind: "recipe", id: "", profileFingerprint: null, armedBrewC: null,
  armedBeanBatchId: null, armedGrinderId: null, armedMachine: null,
};

export default function createPlugin(host: PluginHost): PluginInstance {
  function log(msg: string) {
    host.log(`[dye2] ${msg}`);
  }

  // The dev-server vm context has no fetch (see dev-server.mjs); the real plugin
  // runtime does, gated by the "api" permission. Guard so a dev-server load never
  // throws trying to reference it.
  function refreshRecents(): void {
    if (typeof fetch !== "function") return;
    refreshRecentFavourites(fetch)
      .then(() => announce({ what: "workflow" }))
      .catch((e: unknown) => {
      log(`recent-favs refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  // Push on the `changed` websocket endpoint (manifest api). The skin re-reads its
  // surfaces on any push but only the DYE strip's KV data when the push is NOT
  // {"what":"skin"} (plugin-surfaces-ui.js onPush), so KV changes push "workflow".
  function announce(payload: Record<string, unknown>): void {
    try {
      host.emit("changed", payload);
    } catch (e: unknown) {
      log(`emit failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // dye2#36: the selection is derived from the live workflow, never stored. It is mirrored to
  // plugin storage (= the KV key `selection`) so the skin keeps reading the same place.
  type Derived = { kind: string; id: string; modified: boolean; auto?: true } | null;
  let mirrored: string | null = null;

  async function kv(key: string): Promise<any[]> {
    const res = await fetch(`${API}/store/${NS}/${key}`);
    const val = res.ok ? await res.json() : null;
    return Array.isArray(val) ? val : [];
  }

  async function putWorkflow(body: unknown): Promise<void> {
    const res = await fetch(`${API}/workflow`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} writing workflow`);
  }

  // The recipe row `recipeId` names, else the newest shot carrying it (deleted recipe, or one
  // made on another Decaid), else null.
  async function recipeFor(rid: string | null, recipes: any[]): Promise<any | null> {
    if (!rid) return null;
    const row = recipes.find((r) => r && String(r.id) === rid);
    if (row) return row;
    try {
      return await resolveRecipeFromHistory(fetch, rid, API);
    } catch (e) {
      return null;
    }
  }

  async function derive(wf: any, known?: any[]): Promise<Derived> {
    const [recipes, favourites] = await Promise.all([known || kv("recipes"), kv("autoFavourites")]);
    const hist = await recipeFor(recipeIdOf(wf), recipes);
    return deriveSelection(wf, { recipes: hist ? recipes.concat(hist) : recipes, favourites });
  }

  // Apply-time baselines for record (dye2#23 adoption, brewC rule), keyed by the recipeId seen.
  // ponytail: in memory only; after a plugin restart those fields are simply not adopted.
  let baseline: Selection | null = null;

  async function workflowChanged(wf: any, cold: boolean): Promise<void> {
    if (!wf) return;
    const rid = recipeIdOf(wf);
    let recipes: any[] | undefined;
    if (rid) {
      recipes = await kv("recipes");
      const recipe = await recipeFor(rid, recipes);
      // A recipe's identity is its profile: a profile change from any source drops the id.
      // A new id's first event is the apply itself, so only the baseline (or, right after a
      // plugin restart, the stored profile) is compared, never a stored profile against a fresh apply.
      const known = baseline && baseline.id === rid ? baseline : null;
      if ((known || cold) && idProfileChanged(known, recipe, wf)) {
        await putWorkflow({ context: { extras: { dye: { recipeId: null } } } });
        return; // the PUT fires another workflowUpdated, which mirrors the result
      }
      if (!baseline || baseline.id !== rid) {
        const full = withMachineSettings(wf, await readMachineSettings(fetch, API));
        const live = ownedRecipeFields(wf).brewC;
        baseline = {
          kind: "recipe", id: rid, profileFingerprint: profileFingerprint(wf.profile),
          armedBrewC: live === undefined ? null : live,
          armedBeanBatchId: null, armedGrinderId: null, armedMachine: machineFields(full),
        };
      }
    } else baseline = null;
    const sel = await derive(wf, recipes);
    const key = sel ? `${sel.kind}:${sel.id}:${sel.modified}` : null;
    if (key === mirrored) return;
    mirrored = key;
    // Never null: Decaid's plugin storage does not store a null. `{}` has no `kind`.
    host.storage({ type: "write", key: "selection", namespace: NS, data: sel || {} });
    announce({ what: "workflow" });
  }

  let chain: Promise<void> = Promise.resolve();
  function trackWorkflow(wf: any, cold = false): void {
    if (typeof fetch !== "function" || typeof host.storage !== "function") return;
    chain = chain
      .then(() => workflowChanged(wf, cold))
      .catch((e: unknown) => log(`selection sync failed: ${e instanceof Error ? e.message : String(e)}`));
  }

  function json(request: HttpRequest, status: number, body: unknown): HttpResponse {
    return {
      requestId: request.requestId,
      status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }

  async function liveWorkflow(): Promise<any | null> {
    try {
      const res = await fetch(`${API}/workflow`);
      return res.ok ? await res.json() : null;
    } catch (e) {
      log(`could not read workflow: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  function parseBody(request: HttpRequest): any {
    let body: any = request.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = null;
      }
    }
    return body;
  }

  // GET answers the derived selection { kind, id, modified } | null. When both a recipe and a
  // matching favourite/recent are live, the recipe (the explicit id) wins.
  async function handleSelection(request: HttpRequest): Promise<HttpResponse> {
    if (typeof fetch !== "function") return json(request, 503, { error: "no api permission" });
    if (request.method !== "GET") {
      // ponytail: compat shim for callers that still POST; nothing is stored, the id rides in
      // the workflow. Drop the route with streamline-js#159.
      const body = parseBody(request);
      const id = body && body.kind === "recipe" && body.id != null ? String(body.id) : null;
      await putWorkflow({ context: { extras: { dye: { recipeId: id } } } });
    }
    const wf = await liveWorkflow();
    return json(request, 200, wf ? await derive(wf) : null);
  }

  // "Save changes": patch the selected recipe with what the live workflow now says (itemPatch
  // against the apply-time baseline), so only fields the barista actually moved are written.
  // ponytail: only recipes are a save target; a favourite or recent deselects on any drift.
  async function handleRecord(request: HttpRequest): Promise<HttpResponse> {
    if (typeof fetch !== "function") return json(request, 503, { saved: false, reason: "no api permission" });
    let wf = await liveWorkflow();
    if (!wf) return json(request, 502, { saved: false, reason: "could not read the workflow" });
    const sel = await derive(wf);
    if (!sel || sel.kind !== "recipe") return json(request, 200, { saved: false, reason: "no recipe is selected" });
    // Flush temperature and flow live on the DE1, not the workflow (dye2#23).
    wf = withMachineSettings(wf, await readMachineSettings(fetch, API));
    try {
      const armed = baseline && baseline.id === sel.id ? baseline : null;
      const wrote = await recordWorkflow(wf, fetch, armed || { ...EMPTY_BASELINE, id: sel.id });
      if (wrote) announce({ what: "workflow" });
      return json(request, 200, { saved: wrote, kind: sel.kind, id: sel.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`record failed: ${msg}`);
      return json(request, 502, { saved: false, reason: msg });
    }
  }

  // "Save to recipes": a new recipe from the live workflow, selected at once.
  // ponytail: writes the row directly; its `workflow` is the live one trimmed, exactly what an
  // apply would re-PUT, so dev-api.ts buildRecipeWorkflow is not ported here.
  async function handleSaveRecipe(request: HttpRequest): Promise<HttpResponse> {
    if (typeof fetch !== "function") return json(request, 503, { error: "no api permission" });
    let wf = await liveWorkflow();
    if (!wf) return json(request, 502, { error: "could not read the workflow" });
    try {
      const recipes = await kv("recipes");
      const body = parseBody(request);
      const ctx = wf.context || {};
      const name =
        (body && typeof body.name === "string" && body.name.trim()) ||
        proposeRecipeName(wf, recipes.map((r) => r && (r.name || r.title)));
      const id = (globalThis as any).crypto?.randomUUID?.() || `recipe-${Date.now()}`;
      wf = withMachineSettings(wf, await readMachineSettings(fetch, API));
      // The plugin-side markDye: this blob is what a later apply PUTs, and Streamline's post-shot
      // clear acts on these flags. recipeId and selection stay out.
      const { dye, ...extras } = ctx.extras || {};
      const flags: any = {};
      const topKeys = ["beanBatchId", "coffeeName", "coffeeRoaster", "grinderId", "grinderModel", "baristaName", "drinkerName"];
      for (const k of topKeys.concat(["basketId", "basketName", "rpm", "note"])) {
        const v = topKeys.includes(k) ? ctx[k] : extras[k];
        if (v !== undefined) flags[k] = v === null ? null : true;
      }
      if (Object.keys(flags).length) extras.dye = { v: 1, ...flags };
      const dashboardVariables: any = ownedRecipeFields(wf);
      if (ctx.grinderId) {
        dashboardVariables.grinderId = ctx.grinderId;
        dashboardVariables.grinderModel = ctx.grinderModel;
      }
      const row: any = {
        id, name, title: name,
        barista: ctx.baristaName, drinker: ctx.drinkerName,
        beanName: ctx.coffeeName, beanRoaster: ctx.coffeeRoaster, beanBatchId: ctx.beanBatchId,
        profileTitle: wf.profile && wf.profile.title, profileSnapshot: wf.profile,
        dashboardVariables,
        workflow: {
          context: { ...ctx, extras },
          profile: wf.profile,
          steamSettings: wf.steamSettings, hotWaterData: wf.hotWaterData, rinseData: wf.rinseData,
        },
        capturedAt: new Date().toISOString(),
      };
      const res = await fetch(`${API}/store/${NS}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipes.concat(row)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} writing recipes`);
      await putWorkflow({ context: { extras: { dye: { v: 1, recipeId: id } } } });
      announce({ what: "workflow" });
      return json(request, 200, { id, name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`save-recipe failed: ${msg}`);
      return json(request, 502, { error: msg });
    }
  }

  // One-time cleanup (dye2#36): the stored armed selection and its workflow mirror no longer
  // mean anything. The other extras.dye keys are Streamline's field flags: left alone.
  function migrate(): void {
    host.storage({ type: "write", key: "selection", namespace: NS, data: {} });
    if (typeof fetch === "function") {
      putWorkflow({ context: { extras: { dye: { selection: null } } } }).catch((e: unknown) =>
        log(`selection migration failed: ${e instanceof Error ? e.message : String(e)}`)
      );
    }
    host.storage({ type: "write", key: "selectionMigrated", namespace: NS, data: true });
  }

  return {
    id: "dye2.reaplugin",
    version: "0.1.0",

    onLoad(_settings: Record<string, unknown>) {
      log("DYE2 plugin loaded");
      if (typeof host.storage === "function") {
        host.storage({ type: "read", key: "selectionMigrated", namespace: NS });
      }
      refreshRecents();
      // A restart loses the baseline: look at the workflow once, comparing the stored profile.
      if (typeof fetch === "function") liveWorkflow().then((wf) => trackWorkflow(wf, true));
    },

    onUnload() {
      log("DYE2 plugin unloaded");
    },

    onEvent(event: PluginEvent) {
      if (event.name === "shotStored") {
        refreshRecents();
      } else if (event.name === "shotUpdated") {
        // A star tap or note edit cannot change a recent: only the workflow and the rpm
        // annotation feed the recents. A missing or unreadable patch refreshes (fail safe).
        if (shotPatchAffectsRecents(event.payload && event.payload.patch)) refreshRecents();
      } else if (event.name === "storageRead") {
        if (event.payload && event.payload.key === "selectionMigrated" && !event.payload.value) migrate();
      } else if (event.name === "workflowUpdated") {
        // Nothing is written onto a recipe unless the barista asks (`record` route); this
        // only keeps the recipeId honest and the derived selection mirrored.
        trackWorkflow(event.payload);
      }
    },

    __httpRequestHandler(request: HttpRequest): HttpResponse | Promise<HttpResponse> {
      log(`HTTP ${request.method} ${request.endpoint}`);

      switch (request.endpoint) {
        case "grinders":
          return renderGrindersPage(request);

        case "baskets":
          return renderBasketsPage(request);

        case "equipment":
          return renderEquipmentPage(request);

        case "bean-picker":
          return renderBeanPickerPage(request);

        case "grinder-picker":
          return renderGrinderPickerPage(request);

        case "basket-picker":
          return renderBasketPickerPage(request);

        case "profile-picker":
          return renderProfilePickerPage(request);

        case "roasters":
          return renderRoastersPage(request);

        case "add-bean":
          return renderAddBeanPage(request);

        case "dashboard":
          return renderDashboardPage(request);

        case "edit-shot":
          return renderEditShotPage(request);

        case "auto-favs":
          return renderAutoFavsPage(request);

        case "auto-fav-edit":
          return renderAutoFavEditPage(request);

        case "recipe-edit":
          return renderRecipeEditPage(request);

        case "bc-import":
          return renderBcImportPage(request);

        // Not a page: recomputes recent auto-favourites and returns them. Called by
        // pages on load (belt-and-braces alongside onLoad/onEvent) since the dev
        // server never dispatches shotStored/shotUpdated.
        case "recent-favs":
          if (typeof fetch !== "function") {
            return {
              requestId: request.requestId,
              status: 503,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ error: "fetch is not available in this runtime" }),
            };
          }
          return refreshRecentFavourites(fetch)
            .then((autos) => ({
              requestId: request.requestId,
              status: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(autos),
            }))
            .catch((e: unknown) => {
              const message = e instanceof Error ? e.message : String(e);
              log(`recent-favs refresh failed: ${message}`);
              return {
                requestId: request.requestId,
                status: 502,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: message }),
              };
            });

        // Not pages: the derived selection (GET), and a compat shim (POST).
        case "selection":
          return handleSelection(request);

        // Not a page: write the dial-in the barista has made onto the selected item. Explicit,
        // because a workflow change is not by itself a decision to change the recipe.
        case "record":
          return handleRecord(request);

        // Not a page: save the live workflow as a new recipe and select it.
        case "save-recipe":
          return handleSaveRecipe(request);

        // Streamline surface discovery: no surfaces (the F/R strip is the skin's own
        // code), just the live socket so the skin re-reads when `changed` pushes.
        case "skin":
          return json(request, 200, { version: 1, surfaces: [], live: { endpoint: "changed" } });

        // Not a page: the local Plotly bundle for the dashboard chart.
        case "plotly":
          return renderPlotlyAsset(request);

        default:
          return {
            requestId: request.requestId,
            status: 404,
            headers: { "Content-Type": "text/plain" },
            body: "Not found",
          };
      }
    },
  };
}
