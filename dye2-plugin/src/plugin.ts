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

export default function createPlugin(host: PluginHost): PluginInstance {
  function log(msg: string) {
    host.log(`[dye2] ${msg}`);
  }

  // The dev-server vm context has no fetch (see dev-server.mjs); the real plugin
  // runtime does, gated by the "api" permission. Guard so a dev-server load never
  // throws trying to reference it.
  function refreshRecents(): void {
    if (typeof fetch !== "function") return;
    refreshRecentFavourites(fetch).catch((e: unknown) => {
      log(`recent-favs refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  return {
    id: "dye2.reaplugin",
    version: "0.1.0",

    onLoad(_settings: Record<string, unknown>) {
      log("DYE2 plugin loaded");
      refreshRecents();
    },

    onUnload() {
      log("DYE2 plugin unloaded");
    },

    onEvent(event: PluginEvent) {
      if (event.name === "shotStored" || event.name === "shotUpdated") {
        refreshRecents();
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
