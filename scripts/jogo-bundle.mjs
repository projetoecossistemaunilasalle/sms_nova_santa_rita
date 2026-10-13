import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** Refuse stale, root-hosted or incomplete builds before replacing the game. */
export function validarBundlePhaser(root) {
  if (fs.existsSync(path.join(root, "harness.html")))
    throw new Error("Harness de testes nao deve ser publicado.");
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "offline-shell.json"), "utf8"));
  if (!metadata || !Array.isArray(metadata.shell) || !Array.isArray(metadata.content))
    throw new Error("Metadados offline invalidos.");
  const entries = [...metadata.shell, ...metadata.content];
  if (entries.some((entry) => /(?:^|\/)harness(?:[.-]|$)/.test(entry?.path ?? ""))) {
    throw new Error("Codigo do harness de testes nao deve ser publicado.");
  }
  const listed = new Set();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.path !== "string" ||
      !entry.path ||
      entry.path.includes("\\") ||
      entry.path.includes(":") ||
      /[?#\u0000-\u001f]/.test(entry.path) ||
      entry.path.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
      path.isAbsolute(entry.path)
    )
      throw new Error(`Asset fora do bundle: ${entry?.path}`);
    if (listed.has(entry.path) || ["offline-shell.json", "service-worker.js"].includes(entry.path))
      throw new Error(`Asset duplicado ou reservado: ${entry.path}`);
    listed.add(entry.path);
    if (
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes < 0 ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw new Error(`Metadados do asset invalidos: ${entry.path}`);
    const file = path.resolve(root, entry.path);
    if (
      !file.startsWith(`${path.resolve(root)}${path.sep}`) ||
      !fs.realpathSync(file).startsWith(`${fs.realpathSync(root)}${path.sep}`)
    )
      throw new Error(`Asset fora do bundle: ${entry.path}`);
    const bytes = fs.readFileSync(file);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== entry.bytes || hash !== entry.sha256)
      throw new Error(`Asset divergente: ${entry.path}`);
  }
  if (
    metadata.schemaVersion !== 1 ||
    typeof metadata.manifestVersion !== "string" ||
    !metadata.manifestVersion ||
    typeof metadata.buildId !== "string" ||
    !/^[a-f0-9]{24}$/.test(metadata.buildId) ||
    !metadata.shell.some((entry) => entry.path === "index.html")
  )
    throw new Error("Identidade do bundle offline invalida.");
  const buildId = createHash("sha256")
    .update(
      JSON.stringify({
        shell: metadata.shell,
        content: metadata.content,
        manifestVersion: metadata.manifestVersion,
      }),
    )
    .digest("hex")
    .slice(0, 24);
  if (metadata.buildId !== buildId) throw new Error("Identidade do build offline divergente.");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "assets", "manifest.generated.json"), "utf8"),
  );
  if (
    !listed.has("assets/manifest.generated.json") ||
    manifest.version !== metadata.manifestVersion
  )
    throw new Error("Versao do manifesto offline divergente.");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  if (!html.includes('id="game"') || !/<script[^>]+type="module"/.test(html)) {
    throw new Error("Entrada Phaser ausente.");
  }
  if (/(?:src|href)=["']\/(?!\/)/.test(html) || /url\(["']?\/(?!\/)/.test(html)) {
    throw new Error("Build do jogo usa caminhos de raiz; gere com --base ./.");
  }
  const workerFile = path.join(root, "service-worker.js");
  if (!fs.existsSync(workerFile)) throw new Error("Worker offline ausente.");
  const worker = fs.readFileSync(workerFile, "utf8");
  const workerMetadata = /^const META = (.+);$/m.exec(worker)?.[1];
  if (!workerMetadata || JSON.stringify(JSON.parse(workerMetadata)) !== JSON.stringify(metadata))
    throw new Error("Metadados do worker offline divergentes.");
  listed.add("offline-shell.json");
  listed.add("service-worker.js");
  // Vite copies the font's required license; the offline generator does not cache text files.
  listed.add("fonts/LilitaOne-OFL.txt");
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const relative = path.relative(root, file).replaceAll(path.sep, "/");
      if (entry.isSymbolicLink()) throw new Error(`Link simbolico no bundle: ${relative}`);
      if (entry.isDirectory()) inspect(file);
      else if (!listed.has(relative)) throw new Error(`Asset nao listado no bundle: ${relative}`);
    }
  }
  inspect(root);
  return metadata;
}

/** Bind the published release to provenance included in the hashed runtime shell. */
export function validarReleaseJogo(gameRoot) {
  const runtime = path.join(gameRoot, "runtime");
  const metadata = validarBundlePhaser(runtime);
  if (!metadata.shell.some((entry) => entry.path === "pages-source.json"))
    throw new Error("Identidade da fonte nao consta no shell validado.");
  const identity = JSON.parse(fs.readFileSync(path.join(runtime, "pages-source.json"), "utf8"));
  const fields = [
    "schemaVersion",
    "sourceRepository",
    "sourceCommit",
    "sourceDirty",
    "engine",
    "integration",
    "base",
  ];
  if (
    !identity ||
    Object.keys(identity).length !== fields.length ||
    identity.schemaVersion !== 1 ||
    identity.sourceRepository !== "VictorCardosoPDev/Heroes_Trial" ||
    typeof identity.sourceCommit !== "string" ||
    !/^[a-f0-9]{40}$/.test(identity.sourceCommit) ||
    identity.sourceDirty !== false ||
    identity.engine !== "phaser" ||
    identity.integration !== "catalog-local-v3" ||
    identity.base !== "./"
  )
    throw new Error("Identidade da fonte invalida ou fonte com alteracoes.");
  const release = JSON.parse(fs.readFileSync(path.join(gameRoot, "release.json"), "utf8"));
  if (
    !release ||
    Object.keys(release).length !== fields.length + 2 ||
    fields.some((field) => release[field] !== identity[field]) ||
    release.buildId !== metadata.buildId ||
    release.manifestVersion !== metadata.manifestVersion
  )
    throw new Error("Release do jogo diverge da fonte e do build validados.");
  return release;
}
