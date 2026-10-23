#!/usr/bin/env node
/**
 * Monta a pasta `public/jogo/` a partir do build gerado pelo projeto irmao
 * (que permanece com build e repositorio independentes; nada de codigo-fonte
 * e copiado, apenas o output):
 *
 *   jogo   -> Heroes_Trial/web-poc/dist (scripts/build-jogo.ps1)
 *
 * O portal dos profissionais nao e exportado aqui: ele e um link externo
 * (PORTAL_URL, definido em build) ou a pagina "em breve" em src/pages/portal/.
 *
 * Os bundles ficam versionados neste repositorio porque os repositorios
 * irmaos sao privados e o workflow de deploy do Pages nao consegue
 * acessa-los. Para atualizar um bundle depois de rebuildar o projeto de
 * origem, rode:
 *
 *   node scripts/sync-bundles.mjs            # sincroniza o que existir
 *   node scripts/sync-bundles.mjs --jogo     # exige o build do jogo
 *
 * O script substitui a pasta de destino inteira, evitando arquivos de
 * chunks antigos acumulando entre sincronizacoes.
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { criarPaginaJogoPhaser } from "./jogo-pagina.mjs";
import { validarBundlePhaser, validarReleaseJogo } from "./jogo-bundle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BUNDLES = {
  jogo: {
    label: "jogo",
    target: path.join(repoRoot, "public", "jogo"),
    source: process.env.GAME_PROJECT_ROOT
      ? path.join(process.env.GAME_PROJECT_ROOT, "dist")
      : path.join(repoRoot, "..", "Heroes_Trial", "web-poc", "dist"),
    origin: "Heroes_Trial/web-poc (scripts/build-jogo.ps1)",
  },
};

const requested = [];
for (const arg of process.argv.slice(2)) {
  const name = arg.replace(/^--/, "");
  if (!BUNDLES[name]) {
    console.error(`Argumento desconhecido: ${arg}`);
    console.error("Uso: node scripts/sync-bundles.mjs [--jogo]");
    process.exit(1);
  }
  requested.push(name);
}

const selected = requested.length > 0 ? requested : Object.keys(BUNDLES);
let missingRequired = false;

for (const name of selected) {
  const bundle = BUNDLES[name];
  const hasSource =
    fs.existsSync(path.join(bundle.source, "index.html")) ||
    fs.existsSync(path.join(bundle.source, "index.htm"));

  if (!hasSource) {
    const message = [
      `Bundle "${bundle.label}": build de origem nao encontrado.`,
      `  Esperado em: ${bundle.source}`,
      `  Gere o build primeiro (${bundle.origin}).`,
    ].join("\n");
    if (requested.length > 0) {
      console.error(message);
      missingRequired = true;
      continue;
    }
    if (fs.existsSync(bundle.target)) {
      console.warn(`[aviso] ${message}\n  Mantendo o bundle atual em public/${bundle.label}/.`);
    } else {
      console.error(`${message}\n  E nenhuma versao anterior existe em public/${bundle.label}/.`);
      missingRequired = true;
    }
    continue;
  }

  // Validate and prepare before replacing the published bundle.
  const staged = fs.mkdtempSync(path.join(repoRoot, ".bundle-stage-"));
  const previous = path.join(staged, "previous");
  const prepared = path.join(staged, "prepared");
  try {
    if (name === "jogo") {
      const metadata = validarBundlePhaser(bundle.source);
      const identity = JSON.parse(
        fs.readFileSync(path.join(bundle.source, "pages-source.json"), "utf8"),
      );
      fs.mkdirSync(prepared);
      fs.cpSync(bundle.source, path.join(prepared, "runtime"), { recursive: true });
      fs.writeFileSync(path.join(prepared, "index.html"), criarPaginaJogoPhaser());
      fs.writeFileSync(
        path.join(prepared, "release.json"),
        `${JSON.stringify(
          {
            ...identity,
            buildId: metadata.buildId,
            manifestVersion: metadata.manifestVersion,
          },
          null,
          2,
        )}\n`,
      );
      validarReleaseJogo(prepared);
    } else {
      fs.cpSync(bundle.source, prepared, { recursive: true });
    }
    fs.mkdirSync(path.dirname(bundle.target), { recursive: true });
    if (fs.existsSync(bundle.target)) fs.renameSync(bundle.target, previous);
    try {
      fs.renameSync(prepared, bundle.target);
    } catch (error) {
      if (fs.existsSync(previous)) fs.renameSync(previous, bundle.target);
      throw error;
    }
  } catch (error) {
    missingRequired = true;
    console.error(`Bundle "${name}" nao sincronizado: ${error.message}`);
    continue;
  } finally {
    fs.rmSync(staged, { recursive: true, force: true });
  }

  const files = countFiles(bundle.target);
  console.log(
    `Bundle "${bundle.label}" sincronizado: ${files} arquivo(s) de ${bundle.source} -> public/${bundle.label}/`,
  );
}

if (missingRequired) process.exit(1);

function countFiles(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return total;
}
