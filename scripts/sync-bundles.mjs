#!/usr/bin/env node
/**
 * Monta as pastas `public/portal/` e `public/jogo/` a partir dos builds
 * gerados pelos projetos irmaos (que permanecem com build e repositorio
 * independentes — nada de codigo-fonte e copiado, apenas o output):
 *
 *   portal -> SMS_Portal/out            (npm run build:demo com
 *                                        DEMO_BASE_PATH=sms_nova_santa_rita/portal)
 *   jogo   -> Heroes_Trial/output/web   (tools/export_web.ps1)
 *
 * Os bundles ficam versionados neste repositorio porque os repositorios
 * irmaos sao privados e o workflow de deploy do Pages nao consegue
 * acessa-los. Para atualizar um bundle depois de rebuildar o projeto de
 * origem, rode:
 *
 *   node scripts/sync-bundles.mjs            # sincroniza o que existir
 *   node scripts/sync-bundles.mjs --portal   # exige o build do portal
 *   node scripts/sync-bundles.mjs --jogo     # exige o build do jogo
 *
 * O script substitui a pasta de destino inteira, evitando arquivos de
 * chunks antigos acumulando entre sincronizacoes.
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const BUNDLES = {
  portal: {
    label: "portal",
    target: path.join(repoRoot, "public", "portal"),
    source: path.join(repoRoot, "..", "SMS_Portal", "out"),
    origin: "SMS_Portal (npm run build:demo)",
  },
  jogo: {
    label: "jogo",
    target: path.join(repoRoot, "public", "jogo"),
    source: path.join(repoRoot, "..", "Heroes_Trial", "output", "web"),
    origin: "Heroes_Trial (tools/export_web.ps1)",
  },
};

const requested = [];
for (const arg of process.argv.slice(2)) {
  const name = arg.replace(/^--/, "");
  if (!BUNDLES[name]) {
    console.error(`Argumento desconhecido: ${arg}`);
    console.error("Uso: node scripts/sync-bundles.mjs [--portal] [--jogo]");
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
      console.warn(
        `[aviso] ${message}\n  Mantendo o bundle atual em public/${bundle.label}/.`,
      );
    } else {
      console.error(
        `${message}\n  E nenhuma versao anterior existe em public/${bundle.label}/.`,
      );
      missingRequired = true;
    }
    continue;
  }

  fs.rmSync(bundle.target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(bundle.target), { recursive: true });
  fs.cpSync(bundle.source, bundle.target, { recursive: true });
  const files = countFiles(bundle.target);
  console.log(
    `Bundle "${bundle.label}" sincronizado: ${files} arquivo(s) de ${bundle.source} -> public/${bundle.label}/`,
  );
}

if (missingRequired) process.exit(1);

function countFiles(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory()
      ? countFiles(path.join(dir, entry.name))
      : 1;
  }
  return total;
}
