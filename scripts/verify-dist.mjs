#!/usr/bin/env node
/** Verify the assembled static site before publishing it under the Pages base path. */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { validarReleaseJogo } from "./jogo-bundle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function normalizarBasePath(value = "sms_nova_santa_rita") {
  const normalized = value.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "/";
}

/** Attribute references must resolve inside the configured project, not the host root. */
export function verificarReferenciasLanding(html, distDir, basePath) {
  const problems = [];
  const base = normalizarBasePath(basePath);
  const prefix = base === "/" ? "/" : `${base}/`;
  const refs = new Set(
    [...html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2]),
  );
  for (const ref of refs) {
    if (!ref.startsWith("/") || ref.startsWith("//")) continue;
    const pathname = ref.split(/[?#]/)[0];
    if (pathname !== base && !pathname.startsWith(prefix)) {
      problems.push(`dist/index.html tem caminho absoluto sem o base path "${base}": ${ref}`);
      continue;
    }
    let relative;
    try {
      relative = decodeURIComponent(pathname === base ? "" : pathname.slice(prefix.length));
    } catch {
      problems.push(`dist/index.html tem referencia local invalida: ${ref}`);
      continue;
    }
    if (relative.includes("\\") || relative.split("/").some((segment) => segment === "..")) {
      problems.push(`dist/index.html tem referencia fora do dist: ${ref}`);
      continue;
    }
    const candidate = path.resolve(distDir, relative);
    if (
      candidate !== path.resolve(distDir) &&
      !candidate.startsWith(`${path.resolve(distDir)}${path.sep}`)
    ) {
      problems.push(`dist/index.html tem referencia fora do dist: ${ref}`);
      continue;
    }
    const isFile = (file) => fs.existsSync(file) && fs.statSync(file).isFile();
    if (!isFile(candidate) && !isFile(path.join(candidate, "index.html")))
      problems.push(`dist/index.html aponta para arquivo inexistente: ${ref}`);
  }
  return problems;
}

export function verificarDist({
  distDir = path.join(repoRoot, "dist"),
  basePath = process.env.PAGES_BASE_PATH,
} = {}) {
  const problems = [];
  try {
    validarReleaseJogo(path.join(distDir, "jogo"));
    const gameHtml = fs.readFileSync(path.join(distDir, "jogo", "index.html"), "utf8");
    if (!gameHtml.includes("./runtime/index.html?integration=catalog-local-v3"))
      problems.push("dist/jogo/index.html nao monta o jogo standalone atual.");
    if (fs.existsSync(path.join(distDir, "jogo", "html5game")))
      problems.push("dist/jogo/ ainda contem o runner GameMaker antigo.");
  } catch (error) {
    problems.push(`Bundle Phaser invalido: ${error.message}`);
  }
  for (const required of [
    "index.html",
    path.join("portal", "index.html"),
    path.join("jogo", "index.html"),
  ]) {
    if (!fs.existsSync(path.join(distDir, required)))
      problems.push(`Arquivo obrigatorio ausente em dist/: ${required}`);
  }
  const landingFile = path.join(distDir, "index.html");
  if (fs.existsSync(landingFile))
    problems.push(
      ...verificarReferenciasLanding(fs.readFileSync(landingFile, "utf8"), distDir, basePath),
    );
  const portalDir = path.join(distDir, "portal");
  if (fs.existsSync(portalDir)) {
    const residue = findFilesContaining(portalDir, /\/SMS_Portal\//, distDir);
    if (residue.length)
      problems.push(
        `dist/portal ainda referencia o base path antigo /SMS_Portal/ em: ${residue.slice(0, 5).join(", ")}`,
      );
  }
  return problems;
}

function findFilesContaining(dir, pattern, distDir) {
  const matches = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (
        /\.(html|txt|js|css|json)$/.test(entry.name) &&
        pattern.test(fs.readFileSync(full, "utf8"))
      )
        matches.push(path.relative(distDir, full));
    }
  }
  return matches;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = verificarDist();
  if (problems.length) {
    console.error("Verificacao do dist falhou:\n");
    for (const problem of problems) console.error(` - ${problem}`);
    process.exitCode = 1;
  } else {
    console.log(
      `dist/ verificado: landing, portal/ e jogo/ presentes; caminhos consistentes com o base path "${normalizarBasePath(process.env.PAGES_BASE_PATH)}".`,
    );
  }
}
