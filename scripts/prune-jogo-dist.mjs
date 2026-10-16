// Removes files the game's public/ folder copies into dist/ but that the offline
// manifest does not list (unused legacy art). The bundle validator rejects them.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const metadata = JSON.parse(fs.readFileSync(path.join(root, "offline-shell.json"), "utf8"));
const listed = new Set([...metadata.shell, ...metadata.content].map((entry) => entry.path));
for (const name of ["offline-shell.json", "service-worker.js", "pages-source.json", "fonts/LilitaOne-OFL.txt"])
  listed.add(name);

let removed = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (!listed.has(path.relative(root, file).replaceAll(path.sep, "/"))) {
      fs.rmSync(file);
      removed += 1;
    }
  }
}
walk(root);
console.log(`Removidos ${removed} arquivos nao listados no manifesto offline.`);
