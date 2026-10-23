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

// Origem canonica para URLs absolutas (og:image). O build do Render usa a URL
// do servico do portal, que tambem serve este site em "/".
const siteUrl =
  process.env.SITE_URL || "https://projetoecossistemaunilasalle.github.io";

export default defineConfig({
  site: siteUrl,
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
