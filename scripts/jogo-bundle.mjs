import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** Refuse stale, root-hosted or incomplete builds before replacing the game. */
export function validarBundlePhaser(root) {
  if (fs.existsSync(path.join(root, "harness.html")))
    throw new Error("Harness de testes nao deve ser publicado.");
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "offline-shell.json"), "utf8"));
  if (
    [...metadata.shell, ...metadata.content].some((entry) =>
      /(?:^|\/)harness(?:[.-]|$)/.test(entry.path),
    )
  ) {
    throw new Error("Codigo do harness de testes nao deve ser publicado.");
  }
  for (const entry of [...metadata.shell, ...metadata.content]) {
    const file = path.resolve(root, entry.path);
    if (!file.startsWith(`${path.resolve(root)}${path.sep}`))
      throw new Error(`Asset fora do bundle: ${entry.path}`);
    const bytes = fs.readFileSync(file);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== entry.bytes || hash !== entry.sha256)
      throw new Error(`Asset divergente: ${entry.path}`);
  }
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  if (!html.includes('id="game"') || !/<script[^>]+type="module"/.test(html)) {
    throw new Error("Entrada Phaser ausente.");
  }
  if (/(?:src|href)=["']\/(?!\/)/.test(html) || /url\(["']?\/(?!\/)/.test(html)) {
    throw new Error("Build do jogo usa caminhos de raiz; gere com --base ./.");
  }
  if (!fs.existsSync(path.join(root, "service-worker.js")))
    throw new Error("Worker offline ausente.");
  return metadata;
}
