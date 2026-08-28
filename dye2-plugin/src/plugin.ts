/// <reference path="./host.d.ts" />

import { renderGrindersPage } from "./pages/grinders";
import { renderBasketsPage } from "./pages/baskets";
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

export default function createPlugin(host: PluginHost): PluginInstance {
  function log(msg: string) {
    host.log(`[dye2] ${msg}`);
  }

  return {
    id: "dye2.reaplugin",
    version: "0.1.0",

    onLoad(_settings: Record<string, unknown>) {
      log("DYE2 plugin loaded");
    },

    onUnload() {
      log("DYE2 plugin unloaded");
    },

    onEvent(_event: PluginEvent) {
      // MVP: no event processing
    },

    __httpRequestHandler(request: HttpRequest): HttpResponse {
      log(`HTTP ${request.method} ${request.endpoint}`);

      switch (request.endpoint) {
        case "grinders":
          return renderGrindersPage(request);

        case "baskets":
          return renderBasketsPage(request);

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
