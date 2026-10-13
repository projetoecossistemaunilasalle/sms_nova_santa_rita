import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { validarBundlePhaser, validarReleaseJogo } from "../scripts/jogo-bundle.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pse-bundle-validation-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "assets"));
  const files = {
    "index.html": '<div id="game"></div><script type="module" src="./assets/app.js"></script>',
    "assets/app.js": "console.log('game');",
    "assets/manifest.generated.json": JSON.stringify({ version: "fixture-v1", entries: {} }),
  };
  const metadata = {
    schemaVersion: 1,
    buildId: "",
    manifestVersion: "fixture-v1",
    shell: [],
    content: [],
  };
  for (const [name, text] of Object.entries(files)) {
    const bytes = Buffer.from(text);
    fs.writeFileSync(path.join(root, name), bytes);
    metadata.shell.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
  }
  const save = ({ identify = true, worker = true } = {}) => {
    if (identify)
      metadata.buildId = hash(
        JSON.stringify({
          shell: metadata.shell,
          content: metadata.content,
          manifestVersion: metadata.manifestVersion,
        }),
      ).slice(0, 24);
    fs.writeFileSync(path.join(root, "offline-shell.json"), JSON.stringify(metadata));
    if (worker)
      fs.writeFileSync(
        path.join(root, "service-worker.js"),
        `const META = ${JSON.stringify(metadata)};\n`,
      );
  };
  save();
  return { root, metadata, save };
}

test("validates a generated bundle identity and every listed asset", (t) => {
  const { root, metadata } = fixture(t);
  assert.deepEqual(validarBundlePhaser(root), metadata);
  fs.appendFileSync(path.join(root, "assets/app.js"), "changed");
  assert.throws(() => validarBundlePhaser(root), /Asset divergente/);
});

test("rejects stale build identities and workers from another build", (t) => {
  const { root, metadata, save } = fixture(t);
  metadata.buildId = "0".repeat(24);
  save({ identify: false });
  assert.throws(() => validarBundlePhaser(root), /Identidade do build offline divergente/);
  save();
  fs.writeFileSync(path.join(root, "service-worker.js"), 'const META = {"buildId":"old"};\n');
  assert.throws(() => validarBundlePhaser(root), /Metadados do worker offline divergentes/);
  fs.unlinkSync(path.join(root, "service-worker.js"));
  assert.throws(() => validarBundlePhaser(root), /Worker offline ausente/);
});

test("rejects unsupported schema and invalid asset metadata", (t) => {
  const { root, metadata, save } = fixture(t);
  metadata.schemaVersion = 2;
  save();
  assert.throws(() => validarBundlePhaser(root), /Identidade do bundle offline invalida/);
  metadata.schemaVersion = 1;
  metadata.shell[0].bytes = -1;
  save();
  assert.throws(() => validarBundlePhaser(root), /Metadados do asset invalidos/);
  metadata.shell[0].bytes = 0;
  metadata.shell[0].sha256 = "not-a-hash";
  save();
  assert.throws(() => validarBundlePhaser(root), /Metadados do asset invalidos/);
});

test("rejects unsafe, duplicated and reserved entry paths", (t) => {
  const { root, metadata, save } = fixture(t);
  for (const name of [
    "../escape",
    "/index.html",
    "assets\\app.js",
    "assets/./app.js",
    "assets//app.js",
    "assets/app.js?x",
    "C:/escape",
  ]) {
    metadata.content = [{ path: name, bytes: 0, sha256: hash("") }];
    save();
    assert.throws(() => validarBundlePhaser(root), /fora do bundle/, name);
  }
  for (const name of ["index.html", "offline-shell.json", "service-worker.js"]) {
    metadata.content = [{ path: name, bytes: 0, sha256: hash("") }];
    save();
    assert.throws(() => validarBundlePhaser(root), /duplicado ou reservado/, name);
  }
});

test("rejects unlisted leftovers and test harness chunks", (t) => {
  const { root, metadata, save } = fixture(t);
  fs.writeFileSync(path.join(root, "assets/old-game.js"), "stale");
  assert.throws(() => validarBundlePhaser(root), /Asset nao listado/);
  fs.unlinkSync(path.join(root, "assets/old-game.js"));
  metadata.content = [{ path: "assets/harness-old.js", bytes: 0, sha256: hash("") }];
  save();
  assert.throws(() => validarBundlePhaser(root), /nao deve ser publicado/);
});

test("retains the font license without allowing other unlisted files", (t) => {
  const { root } = fixture(t);
  fs.mkdirSync(path.join(root, "fonts"));
  fs.writeFileSync(path.join(root, "fonts/LilitaOne-OFL.txt"), "SIL OPEN FONT LICENSE");
  assert.doesNotThrow(() => validarBundlePhaser(root));
  fs.writeFileSync(path.join(root, "fonts/old-game.js"), "stale");
  assert.throws(() => validarBundlePhaser(root), /Asset nao listado/);
});

test("rejects manifest version disagreement even with a matching build identity", (t) => {
  const { root, metadata, save } = fixture(t);
  metadata.manifestVersion = "other-v2";
  save();
  assert.throws(() => validarBundlePhaser(root), /Versao do manifesto offline divergente/);
});

test("rejects directory links instead of following them into the published bundle", (t) => {
  const { root } = fixture(t);
  fs.symlinkSync(path.join(root, "assets"), path.join(root, "linked-assets"), "junction");
  assert.throws(() => validarBundlePhaser(root), /Link simbolico no bundle/);
});

function releaseFixture(t, overrides = {}) {
  const bundle = fixture(t);
  const identity = {
    schemaVersion: 1,
    sourceRepository: "VictorCardosoPDev/Heroes_Trial",
    sourceCommit: "a".repeat(40),
    sourceDirty: false,
    engine: "phaser",
    integration: "catalog-local-v3",
    base: "./",
    ...overrides,
  };
  const bytes = Buffer.from(JSON.stringify(identity));
  fs.writeFileSync(path.join(bundle.root, "pages-source.json"), bytes);
  bundle.metadata.shell.push({
    path: "pages-source.json",
    bytes: bytes.length,
    sha256: hash(bytes),
  });
  bundle.save();
  const gameRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pse-release-validation-"));
  t.after(() => fs.rmSync(gameRoot, { recursive: true, force: true }));
  fs.renameSync(bundle.root, path.join(gameRoot, "runtime"));
  const release = {
    ...identity,
    buildId: bundle.metadata.buildId,
    manifestVersion: bundle.metadata.manifestVersion,
  };
  const saveRelease = () =>
    fs.writeFileSync(path.join(gameRoot, "release.json"), JSON.stringify(release));
  saveRelease();
  return { gameRoot, release, saveRelease };
}

test("published release is tied to the hashed source commit and exact runtime build", (t) => {
  const { gameRoot, release, saveRelease } = releaseFixture(t);
  assert.deepEqual(validarReleaseJogo(gameRoot), release);
  for (const field of [
    "sourceCommit",
    "sourceRepository",
    "buildId",
    "manifestVersion",
    "integration",
  ]) {
    const original = release[field];
    release[field] = "different";
    saveRelease();
    assert.throws(() => validarReleaseJogo(gameRoot), /Release do jogo diverge/, field);
    release[field] = original;
  }
  saveRelease();
  fs.writeFileSync(path.join(gameRoot, "runtime", "pages-source.json"), "changed source identity");
  assert.throws(() => validarReleaseJogo(gameRoot), /Asset divergente/);
});

test("dirty and incompatible source identities cannot be published", (t) => {
  for (const overrides of [
    { sourceDirty: true },
    { sourceRepository: "different/repo" },
    { sourceCommit: "bad" },
    { base: "/" },
    { engine: "gamemaker" },
    { integration: "portal-v1" },
  ]) {
    const { gameRoot } = releaseFixture(t, overrides);
    assert.throws(() => validarReleaseJogo(gameRoot), /Identidade da fonte invalida/);
  }
});

test("release validation requires hashed source provenance", (t) => {
  const { root } = fixture(t);
  const gameRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pse-missing-source-"));
  t.after(() => fs.rmSync(gameRoot, { recursive: true, force: true }));
  fs.renameSync(root, path.join(gameRoot, "runtime"));
  assert.throws(() => validarReleaseJogo(gameRoot), /nao consta no shell validado/);
});
