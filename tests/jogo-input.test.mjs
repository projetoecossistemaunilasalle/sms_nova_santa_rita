import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { corrigirEscalaGui } from "../scripts/jogo-input.mjs";
import { aplicarPaginaJogo } from "../scripts/jogo-pagina.mjs";

const runner = `
var aliases = {device_mouse_x_to_gui: "_x$", device_mouse_y_to_gui: "_y$"};
function _x$(device) {
  var x = device === 0 ? mouse.x : touch.x;
  bounds(canvas, rect); x -= rect.left; x -= viewport.x;
  return ~~(x * (gui.width / viewport.width));
}
function _y$(device) {
  var y = device === 0 ? mouse.y : touch.y;
  bounds(canvas, rect); y -= rect.top; y -= viewport.y;
  return ~~(y * (gui.height / viewport.height));
}
function unrelated() { return 42; }
`;

for (const [name, scaleX, scaleY] of [
  ["native size", 1, 1],
  ["fullscreen enlargement", 1.3125, 1.3125],
  ["normal desktop reduction", 1196 / 1280, 1196 / 1280],
  ["narrow mobile", 319 / 1280, 319 / 1280],
  ["independent axis scales", 0.75, 1.25],
]) {
  test(`GUI pointer conversion preserves mouse and touch targets at ${name}`, () => {
    const rect = { left: 231, top: 77, scaleX, scaleY };
    const viewport = { x: 20, y: 30, width: 1200, height: 650 };
    const gui = { width: 600, height: 325 };
    const point = { x: rect.left + 820 * scaleX, y: rect.top + 410 * scaleY };
    const context = vm.createContext({
      rect,
      viewport,
      gui,
      mouse: point,
      touch: point,
      canvas: {},
      bounds: () => {},
    });
    vm.runInContext(corrigirEscalaGui(runner), context);
    for (const device of [0, 1]) {
      assert.equal(context._x$(device), 400);
      assert.equal(context._y$(device), 190);
    }
    assert.equal(context.unrelated(), 42);
  });
}

test("runtime patch is idempotent and follows renamed export aliases", () => {
  const renamed = runner.replaceAll("_x$", "_newX").replaceAll("_y$", "_newY");
  const patched = corrigirEscalaGui(renamed);
  assert.equal(corrigirEscalaGui(patched), patched);
  assert.equal((patched.match(/pse-gui-css-scale/g) || []).length, 2);
});

test("unsupported runner layouts fail instead of silently shipping broken input", () => {
  assert.throws(() => corrigirEscalaGui(""), /nao encontrada/);
  assert.throws(() => corrigirEscalaGui(runner.replace("x -= rect.left;", "")), /mudou/);
});

test("published runner includes exactly the reproducible mouse/touch scale patch", () => {
  const published = fs.readFileSync(
    new URL("../public/jogo/html5game/Hero's Trail Base - GML Visual.js", import.meta.url),
    "utf8",
  );
  assert.equal((published.match(/pse-gui-css-scale/g) || []).length, 2);
  const unpatched = published.replace(
    /\/\* pse-gui-css-scale \*\/([xy])=\(\1-([\w$]+)\.(left|top)\)\/\2\.scale[XY];/g,
    "$1-=$2.$3;",
  );
  assert.notEqual(unpatched, published);
  assert.equal(corrigirEscalaGui(unpatched), published);
});

test("game page generator retains native aspect ratio and loader alignment", () => {
  for (const [width, height] of [
    [1280, 720],
    [960, 540],
    [720, 1280],
  ]) {
    const source = `<html lang="en"><head><title>Game</title>
      <!-- Custom PostStyle code is injected here --></head><body>
      <!-- Custom BodyStart code is injected here -->
      <canvas id="canvas" width="${width}" height="${height}"></canvas>
      <script src="html5game/game.js?cachebust=123"></script>
      <!-- Custom BodyEnd code is injected here --></body></html>`;
    const result = aplicarPaginaJogo(source);
    assert.equal(result.aplicado, true);
    assert.ok(result.html.includes(`--jp-jogo-largura: ${width};`));
    assert.ok(result.html.includes(`--jp-jogo-altura: ${height};`));
    assert.ok(result.html.includes("grid-area: 1 / 1;"));
    assert.ok(result.html.includes("container-type: size;"));
    assert.ok(result.html.includes("game.js?cachebust=123&amp;pse-input=1"));
    assert.equal(aplicarPaginaJogo(result.html).html, result.html);
  }
});
