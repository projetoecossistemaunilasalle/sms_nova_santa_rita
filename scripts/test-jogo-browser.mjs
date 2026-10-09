import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const requireGame = createRequire(path.join(root, "../Heroes_Trial/web-poc/package.json"));
const { chromium, expect } = requireGame("@playwright/test");
const base = "/sms_nova_santa_rita/";
const evidence = path.join(root, "../.preview/game-page");
fs.mkdirSync(evidence, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".ogg": "audio/ogg",
  ".css": "text/css",
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404).end();
    return;
  }
  const file = path.resolve(
    root,
    "dist",
    decodeURIComponent(url.pathname.slice(base.length)) || "index.html",
  );
  if (!file.startsWith(path.join(root, "dist") + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}${base}jogo/index.html`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["portrait", 390, 844],
    ["narrow", 320, 568],
    ["landscape", 844, 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: name !== "desktop",
      hasTouch: name !== "desktop",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) =>
      failures.push(`${request.failure()?.errorText} ${request.url()}`),
    );
    await page.goto(url);
    const game = page.frameLocator(".jp-area iframe");
    await expect(game.locator("#blocker")).toBeHidden({ timeout: 30_000 });
    await expect(game.locator("#world-wallet")).toBeVisible();
    const tip = game.getByRole("button", { name: "Fechar dica de orientação" });
    if (await tip.isVisible()) await tip.click();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${name}: horizontal overflow`,
    );
    await page.mouse.move(8, height / 2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const canvasBox = await game.locator("canvas").boundingBox();
    const beforeWheel = await page.evaluate(() => scrollY);
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.wheel(0, -100);
    await expect
      .poll(() => page.evaluate(() => scrollY), {
        message: "Game canvas must not trap page scrolling",
      })
      .toBeLessThan(beforeWheel);
    await page.screenshot({ path: path.join(evidence, `${name}-page.png`), fullPage: true });
    const fullscreen = page.locator(".jp-tela-cheia");
    await fullscreen.click();
    await expect(fullscreen).toHaveAttribute("aria-pressed", "true");
    for (const [w, h] of [
      [width, height],
      [390, 844],
      [844, 390],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      // Let resize/orientation handlers settle before interacting with transient guidance.
      await page.waitForTimeout(350);
      await expect
        .poll(() =>
          page.locator(".jp-palco").evaluate((stage) => {
            const area = stage.querySelector(".jp-area").getBoundingClientRect();
            const bar = stage.querySelector(".jp-barra").getBoundingClientRect();
            const frame = stage.querySelector("iframe").getBoundingClientRect();
            return {
              fits: area.bottom <= innerHeight + 1 && area.right <= innerWidth + 1,
              height: Math.abs(area.height + bar.height - innerHeight) < 1,
              frame: Math.abs(frame.height - area.height) < 1,
            };
          }),
        )
        .toEqual({ fits: true, height: true, frame: true });
      await expect(game.locator("#blocker")).toBeHidden();
      if (await tip.isVisible()) await tip.click();
      await game.getByRole("button", { name: "Configurações e pausa", exact: true }).click();
      await expect(game.getByRole("dialog", { name: "Configurações" })).toBeVisible();
      await game.getByRole("button", { name: "Voltar ao jogo", exact: true }).click();
      await expect(game.getByRole("dialog")).toHaveCount(0);
      await page.screenshot({ path: path.join(evidence, `${name}-fullscreen-${w}x${h}.png`) });
    }
    await page.getByRole("button", { name: "Sair da tela cheia", exact: true }).click();
    await expect(fullscreen).toHaveAttribute("aria-pressed", "false");
    await page.mouse.move(8, 120);
    await page.mouse.wheel(0, -10000);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    assert.deepEqual(failures, [], `${name}: runtime/network failures`);
    results.push({ name, width, height, passed: true });
    await context.close();
  }
  fs.writeFileSync(path.join(evidence, "results.json"), JSON.stringify(results, null, 2));
  console.log(
    "Game page browser checks passed: scrolling, nested assets, fullscreen, portrait/landscape resize, settings and exit.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
