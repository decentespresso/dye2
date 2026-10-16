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
import { refreshRecentFavourites } from "./utils/recent-favs";
import {
  armSelection,
  clearSelection,
  getSelection,
  restoreSelection,
  scheduleWorkflowRecord,
  setSelectionListener,
  syncSelectionMarker,
} from "./utils/workflow-record";

const SELECTION_STORAGE_KEY = "selection";

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

  // The armed selection lives in workflow-record.ts memory and is mirrored to plugin
  // storage so it survives a reload. Storage reads cannot be awaited: host.storage()
  // returns void and the value comes back later as a `storageRead` event (handled in
  // onEvent), so it is requested once in onLoad.
  function persistSelection(): void {
    if (typeof host.storage !== "function") return;
    host.storage({
      type: "write",
      key: SELECTION_STORAGE_KEY,
      namespace: "dye2.reaplugin",
      // Never null: Decaid's plugin storage does not store a null, so a cleared selection
      // would leave the old value in place and restoreSelection would re-arm it on reload.
      // `{}` has no `kind`, which restoreSelection reads as "no selection".
      data: getSelection() || {},
    });
  }
  // Every selection change (arm, clear, `recent:`, profile drift) persists AND pushes, so
  // the skin re-reads its DYE strip. handleSelection must not announce again itself, and
  // restoreSelection deliberately does not notify this listener.
  let announcedSelection: string | null = null;
  setSelectionListener((sel) => {
    persistSelection();
    // Mirror it into the workflow so each Shot carries it. A failed or unavailable PUT only
    // logs: arming, persistence and the push below do not depend on it.
    if (typeof fetch === "function") {
      syncSelectionMarker(fetch).catch((e: unknown) =>
        log(`selection marker failed: ${e instanceof Error ? e.message : String(e)}`)
      );
    }
    // updateSelection fires this listener for a baseline rebase too (armedBrewC after a
    // record, an adopted fingerprint or bean/grinder): nothing the skin can see, and a
    // brew-temp tweak would otherwise push on every workflowUpdated. Push only when
    // WHICH item is selected changes.
    const key = sel ? sel.kind + ":" + sel.id : null;
    if (key === announcedSelection) return;
    announcedSelection = key;
    announce({ what: "workflow" });
  });

  function json(request: HttpRequest, status: number, body: unknown): HttpResponse {
    return {
      requestId: request.requestId,
      status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }

  async function handleSelection(request: HttpRequest): Promise<HttpResponse> {
    if (request.method === "GET") return json(request, 200, getSelection());
    let body: any = request.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = null;
      }
    }
    if (!body || !body.kind) {
      clearSelection();
      return json(request, 200, null);
    }
    // The dashboard posts this right after its PUT /workflow, so the live workflow is
    // the applied one: fingerprint its profile and record it as the apply's echo.
    let wf: any = null;
    if (typeof fetch === "function") {
      try {
        const res = await fetch("http://localhost:8080/api/v1/workflow");
        if (res.ok) wf = await res.json();
      } catch (e) {
        log(`selection: could not read workflow: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const sel = armSelection(body, wf);
    return json(request, 200, sel);
  }

  return {
    id: "dye2.reaplugin",
    version: "0.1.0",

    onLoad(_settings: Record<string, unknown>) {
      log("DYE2 plugin loaded");
      if (typeof host.storage === "function") {
        host.storage({ type: "read", key: SELECTION_STORAGE_KEY, namespace: "dye2.reaplugin" });
      }
      refreshRecents();
    },

    onUnload() {
      log("DYE2 plugin unloaded");
    },

    onEvent(event: PluginEvent) {
      if (event.name === "shotStored" || event.name === "shotUpdated") {
        refreshRecents();
      } else if (event.name === "storageRead") {
        if (event.payload && event.payload.key === SELECTION_STORAGE_KEY && !getSelection()) {
          restoreSelection(event.payload.value);
        }
      } else if (event.name === "workflowUpdated") {
        if (typeof fetch !== "function") return;
        scheduleWorkflowRecord(
          event.payload,
          fetch,
          () => announce({ what: "workflow" }),
          (e) => log(`workflow record failed: ${e instanceof Error ? e.message : String(e)}`)
        );
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

        // Not pages: arm/clear/read the recipe or favourite being dialled in.
        case "selection":
          return handleSelection(request);

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
