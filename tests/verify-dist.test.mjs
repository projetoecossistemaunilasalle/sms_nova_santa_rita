import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  normalizarBasePath,
  verificarReferenciasLanding,
  verificarDist,
} from "../scripts/verify-dist.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pse-dist-validation-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "assets"));
  fs.mkdirSync(path.join(root, "jogo"));
  fs.mkdirSync(path.join(root, "empty"));
  fs.writeFileSync(path.join(root, "index.html"), "landing");
  fs.writeFileSync(path.join(root, "assets", "game.js"), "game");
  fs.writeFileSync(path.join(root, "jogo", "index.html"), "game");
  return root;
}

test("root-hosted assets and sibling applications fail under a project base", (t) => {
  const root = fixture(t);
  for (const url of [
    "/assets/game.js",
    "/_astro/game.js",
    "/favicon.svg",
    "/jogo/",
    "/sms_nova_santa_rita-wrong/assets/game.js",
  ]) {
    const errors = verificarReferenciasLanding(`<img src="${url}">`, root);
    assert.equal(errors.length, 1, url);
    assert.match(errors[0], /sem o base path/);
  }
});

test("custom base paths, root hosting, quoting and query/hash links resolve", (t) => {
  const root = fixture(t);
  assert.equal(normalizarBasePath("//custom/site/"), "/custom/site");
  assert.equal(normalizarBasePath(""), "/");
  assert.deepEqual(
    verificarReferenciasLanding(
      '<script src="/custom/site/assets/game.js?v=1"></script><a href=\'/custom/site/jogo/#start\'>Play</a><a href="/custom/site/">Home</a>',
      root,
      "/custom/site/",
    ),
    [],
  );
  assert.deepEqual(
    verificarReferenciasLanding(
      '<script src="/assets/game.js"></script><a href="/jogo/">Play</a>',
      root,
      "",
    ),
    [],
  );
  assert.match(
    verificarReferenciasLanding(
      '<script src="/sms_nova_santa_rita/assets/game.js"></script>',
      root,
      "custom/site",
    )[0],
    /sem o base path/,
  );
});

test("missing files, empty directories and escaping references fail", (t) => {
  const root = fixture(t);
  for (const url of ["/site/missing.js", "/site/empty/"])
    assert.match(
      verificarReferenciasLanding(`<a href="${url}">Test</a>`, root, "site")[0],
      /arquivo inexistente/,
    );
  for (const url of ["/site/../escape", "/site/%2e%2e/escape", "/site/assets%5cgame.js"])
    assert.match(
      verificarReferenciasLanding(`<a href="${url}">Test</a>`, root, "site")[0],
      /fora do dist/,
    );
  assert.match(
    verificarReferenciasLanding('<a href="/site/%broken">Test</a>', root, "site")[0],
    /referencia local invalida/,
  );
});

test("external, protocol-relative and fragment links are ignored", (t) => {
  const root = fixture(t);
  assert.deepEqual(
    verificarReferenciasLanding(
      '<a href="https://example.com/path">External</a><img src="//example.com/photo.webp"><a href="#game">Jump</a><a href="mailto:test@example.com">Email</a>',
      root,
    ),
    [],
  );
});

test("assembled verification reports missing game metadata and nested portal residue", (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, "portal", "nested"), { recursive: true });
  fs.writeFileSync(path.join(root, "portal", "index.html"), "<p>Portal dos profissionais em breve</p>");
  fs.writeFileSync(path.join(root, "portal", "nested", "app.js"), 'const base = "/SMS_Portal/";');
  const errors = verificarDist({ distDir: root, basePath: "site" });
  assert.ok(errors.some((error) => /Bundle Phaser invalido/.test(error)));
  assert.ok(errors.some((error) => /base path antigo.*app.js/.test(error)));
});

test("assembled verification requires the coming-soon portal page, not a Next export", (t) => {
  const root = fixture(t);
  assert.ok(
    verificarDist({ distDir: root }).some((error) => /portal.index\.html/.test(error)),
    "pagina do portal ausente",
  );
  fs.mkdirSync(path.join(root, "portal"));
  fs.writeFileSync(
    path.join(root, "portal", "index.html"),
    '<script src="/sms_nova_santa_rita/portal/_next/static/chunks/a.js"></script>',
  );
  assert.ok(
    verificarDist({ distDir: root }).some((error) => /export antigo/.test(error)),
    "export antigo do Next aceito",
  );
});
