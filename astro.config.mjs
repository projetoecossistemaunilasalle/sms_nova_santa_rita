// @ts-check
import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";

// Landing page 100% estatica; SolidJS hidrata apenas as ilhas interativas.
//
// O site e publicado no GitHub Pages como "project site", entao todos os
// caminhos ficam sob /sms_nova_santa_rita. O valor pode ser sobrescrito com
// PAGES_BASE_PATH (sem barra inicial, para evitar a reescrita de caminhos
// que o Git Bash do Windows faz em valores "/...").
const pagesBasePath = `/${
  (process.env.PAGES_BASE_PATH ?? "sms_nova_santa_rita").replace(/^\/+|\/+$/g, "")
}`;

export default defineConfig({
  // Configuracao para deploy no GitHub Pages (site de projeto).
  site: "https://projetoecossistemaunilasalle.github.io",
  base: pagesBasePath,
  integrations: [solid()],
  output: "static",
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      // Mantem os assets pequenos inline quando fizer sentido (SVGs, CSS).
      assetsInlineLimit: 4096,
    },
  },
});
