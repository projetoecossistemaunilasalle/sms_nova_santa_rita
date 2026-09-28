#!/usr/bin/env node
/**
 * Verifica o artefato final montado em dist/ antes da publicacao:
 *
 *   1. as tres entradas existem: landing (/), portal/ e jogo/;
 *   2. nenhum asset da landing ficou com caminho absoluto sem o
 *      base path do GitHub Pages (quebraria sob /sms_nova_santa_rita);
 *   3. o bundle do portal nao tem residuo do base path antigo /SMS_Portal;
 *   4. todo href/src local da landing apontando para o base path
 *      resolve para um arquivo real dentro de dist/.
 *
 * Uso: node scripts/verify-dist.mjs   (respeita PAGES_BASE_PATH)
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDir = path.join(repoRoot, "dist");
const basePath = `/${
  (process.env.PAGES_BASE_PATH ?? "sms_nova_santa_rita").replace(/^\/+|\/+$/g, "")
}`;

const problems = [];

// 1. Entradas obrigatorias.
for (const required of [
  "index.html",
  path.join("portal", "index.html"),
  path.join("jogo", "index.html"),
]) {
  if (!fs.existsSync(path.join(distDir, required))) {
    problems.push(`Arquivo obrigatorio ausente em dist/: ${required}`);
  }
}

const landingHtml = readOrNull(path.join(distDir, "index.html"));
if (landingHtml) {
  // 2. Caminhos absolutos sem o prefixo do Pages.
  const unprefixed = landingHtml.match(
    /(?:href|src)="\/(?!sms_nova_santa_rita\/|portal\/|jogo\/)[^""]*"/g,
  );
  const unprefixedAssets = (unprefixed ?? []).filter((match) =>
    /^"(?:href|src)="\/(assets|_astro|favicon)/.test(match),
  );
  if (unprefixedAssets.length > 0) {
    problems.push(
      `dist/index.html tem caminhos absolutos sem o base path: ${unprefixedAssets.slice(0, 5).join(", ")}`,
    );
  }

  // 4. Todo link interno do base path deve existir no dist.
  const refs = new Set(
    [
      ...(landingHtml.match(/href="[^"]+"/g) ?? []),
      ...(landingHtml.match(/src="[^"]+"/g) ?? []),
    ].map((ref) => ref.slice(ref.indexOf('"') + 1, -1)),
  );
  for (const ref of refs) {
    if (!ref.startsWith(basePath)) continue;
    const relative = ref
      .slice(basePath.length)
      .split("#")[0]
      .split("?")[0]
      .replace(/\/+$/, "");
    if (relative === "") continue; // raiz do proprio site
    const candidate = path.join(distDir, relative);
    const candidateDirIndex = path.join(distDir, relative, "index.html");
    if (fs.existsSync(candidate) || fs.existsSync(candidateDirIndex)) continue;
    problems.push(`dist/index.html aponta para arquivo inexistente: ${ref}`);
  }
}

// 3. Residuo do base path antigo do portal.
const portalDir = path.join(distDir, "portal");
if (fs.existsSync(portalDir)) {
  const residue = findFilesContaining(portalDir, /\/SMS_Portal\//);
  if (residue.length > 0) {
    problems.push(
      `dist/portal ainda referencia o base path antigo /SMS_Portal/ em: ${residue
        .slice(0, 5)
        .join(", ")}`,
    );
  }
}

if (problems.length > 0) {
  console.error("Verificacao do dist falhou:\n");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log(
  `dist/ verificado: landing, portal/ e jogo/ presentes; caminhos consistentes com o base path "${basePath}".`,
);

function readOrNull(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function findFilesContaining(dir, pattern) {
  const matches = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.name.endsWith(".html") || entry.name.endsWith(".txt")) {
        const content = fs.readFileSync(full, "utf8");
        if (pattern.test(content)) matches.push(path.relative(distDir, full));
      }
    }
  }
  return matches;
}
