import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { criarPaginaJogoPhaser } from "../scripts/jogo-pagina.mjs";
import { validarBundlePhaser } from "../scripts/jogo-bundle.mjs";

test("Phaser page keeps input isolated and reserves the full available height", () => {
  const html = criarPaginaJogoPhaser();
  assert.ok(html.includes('src="./runtime/index.html?integration=catalog-local-v3"'));
  assert.ok(html.includes('title="Jogo Missões do Caramelito"'));
  assert.ok(html.includes("viewport-fit=cover"));
  assert.ok(html.includes("70dvh"));
  assert.ok(html.includes(".jp-em-tela-cheia) .jp-area"));
  assert.ok(!html.includes("overflow: hidden;\n  touch-action: none"));
  assert.ok(!/\n\s*height: 100vh/.test(html));
  assert.ok(html.includes("min-height: 0;"));
});

function setupFullscreen(supported = true) {
  const attributes = {};
  const handlers = {};
  const label = {};
  const button = {
    setAttribute: (name, value) => (attributes[name] = value),
    querySelector: () => label,
    addEventListener: (name, fn) => (handlers[name] = fn),
  };
  const frame = { focus: (options) => (frame.focusOptions = options) };
  const status = { hidden: true };
  const stage = { classList: { toggle: (name, enabled) => (stage.fullscreen = enabled) } };
  const document = {
    querySelector: (selector) =>
      ({
        ".jp-tela-cheia": button,
        ".jp-palco": stage,
        ".jp-area iframe": frame,
        ".jp-estado": status,
      })[selector],
    addEventListener: (name, fn) => (handlers[name] = fn),
  };
  if (supported) {
    stage.requestFullscreen = async () => {
      document.fullscreenElement = stage;
      handlers.fullscreenchange();
    };
    document.exitFullscreen = async () => {
      document.fullscreenElement = null;
      handlers.fullscreenchange();
    };
  }
  const script = criarPaginaJogoPhaser().match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, { document });
  return { attributes, handlers, button, frame, stage, document, status, label };
}

test("fullscreen updates its accessible label, restores game focus and handles Escape", async () => {
  const context = setupFullscreen();
  await context.handlers.click();
  assert.equal(context.stage.fullscreen, true);
  assert.equal(context.attributes["aria-pressed"], "true");
  assert.equal(context.label.textContent, "Sair da tela cheia");
  assert.equal(context.frame.focusOptions.preventScroll, true);
  context.document.fullscreenElement = null;
  context.handlers.fullscreenchange();
  assert.equal(context.stage.fullscreen, false);
  assert.equal(context.attributes["aria-label"], "Tela cheia");
  await context.handlers.click();
  await context.handlers.click();
  assert.equal(context.stage.fullscreen, false);
});

test("unsupported fullscreen hides the button and denied requests report recovery", async () => {
  assert.equal(setupFullscreen(false).button.hidden, true);
  const context = setupFullscreen();
  context.stage.requestFullscreen = async () => {
    throw new Error("denied");
  };
  // The handler retains the selected API, just as a real browser does.
  context.document.exitFullscreen = async () => {
    throw new Error("denied");
  };
  context.document.fullscreenElement = context.stage;
  await context.handlers.click();
  assert.equal(context.status.hidden, false);
  assert.match(context.status.textContent, /continuar jogando/);
});

test("the published Phaser bundle is complete and excludes the retired runner", () => {
  const root = new URL("../public/jogo/", import.meta.url);
  const metadata = validarBundlePhaser(fileURLToPath(new URL("runtime/", root)));
  assert.ok(metadata.content.length > 100);
  assert.ok(!fs.existsSync(new URL("html5game/", root)));
  assert.ok(!fs.existsSync(new URL("runtime/harness.html", root)));
  assert.equal(fs.readFileSync(new URL("index.html", root), "utf8"), criarPaginaJogoPhaser());
});

test("invalid replacement bundles fail before publication", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pse-bundle-test-"));
  try {
    assert.throws(() => validarBundlePhaser(root));
    fs.writeFileSync(path.join(root, "harness.html"), "test only");
    assert.throws(() => validarBundlePhaser(root), /nao deve ser publicado/);
    fs.unlinkSync(path.join(root, "harness.html"));
    fs.writeFileSync(
      path.join(root, "offline-shell.json"),
      JSON.stringify({ shell: [{ path: "../escape" }], content: [] }),
    );
    assert.throws(() => validarBundlePhaser(root), /fora do bundle/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
