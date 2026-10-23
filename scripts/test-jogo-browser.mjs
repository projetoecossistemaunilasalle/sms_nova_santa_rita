import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const requireGame = createRequire(
  path.join(
    process.env.GAME_PROJECT_ROOT ?? path.join(root, "../Heroes_Trial/web-poc"),
    "package.json",
  ),
);
const { chromium, expect, devices } = requireGame("@playwright/test");
const base = "/sms_nova_santa_rita/";
const evidence = process.env.GAME_EVIDENCE_DIR ?? path.join(root, "../.preview/game-page");
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
  let file = path.resolve(
    root,
    process.env.GAME_DIST_DIR ?? "dist",
    decodeURIComponent(url.pathname.slice(base.length)) || "index.html",
  );
  const dist = path.resolve(root, process.env.GAME_DIST_DIR ?? "dist");
  if (!file.startsWith(dist + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = process.env.GAME_PAGE_URL ?? `http://127.0.0.1:${server.address().port}${base}jogo/`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
let release;
let activePage;
let activeCase;
async function startGame(page, game, touch) {
  const play = game.getByRole("button", { name: "JOGAR", exact: true });
  await expect(play).toBeVisible({ timeout: 30_000 });
  await page.locator(".jp-area iframe").scrollIntoViewIfNeeded();
  await insideGame(game, ".ht-menu-play");
  if (touch) await play.tap();
  else await play.press("Enter");
  await expect(game.locator("#blocker")).toBeHidden({ timeout: 30_000 });
  await expect(game.locator("#world-wallet")).toBeVisible();
}
async function insideGame(game, selector) {
  await activePage.locator(".jp-area iframe").scrollIntoViewIfNeeded();
  await game.locator(selector).scrollIntoViewIfNeeded();
  await expect
    .poll(
      () =>
        game.locator(selector).evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.left >= -1 &&
            bounds.top >= -1 &&
            bounds.right <= innerWidth + 1 &&
            bounds.bottom <= innerHeight + 1
          );
        }),
      { message: `${selector} must fit the embedded viewport` },
    )
    .toBe(true);
}
try {
  const cases = [
    ["desktop", 1440, 900],
    ["wide", 2560, 1440],
    ["tablet", 768, 1024],
    ["portrait", 390, 844],
    ["narrow", 320, 568],
    ["landscape", 844, 390],
  ].filter(([name]) => !process.env.GAME_CASES || process.env.GAME_CASES.split(",").includes(name));
  assert.ok(cases.length, "At least one browser size is required");
  for (const [name, width, height] of cases) {
    activeCase = name;
    console.log(`Checking ${name}: ${width}x${height}`);
    const touch = !["desktop", "wide"].includes(name);
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: touch,
      hasTouch: touch,
      deviceScaleFactor: touch ? 2 : 1,
      userAgent: touch ? devices["Pixel 7"].userAgent : undefined,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    activePage = page;
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) =>
      failures.push(`${request.failure()?.errorText} ${request.url()}`),
    );
    await page.goto(url);
    if (!release) {
      const published = await page.request.get(new URL("release.json", url).href);
      assert.equal(published.status(), 200, "Published source identity is available");
      release = await published.json();
      const metadata = await (
        await page.request.get(new URL("runtime/offline-shell.json", url).href)
      ).json();
      const source = await (
        await page.request.get(new URL("runtime/pages-source.json", url).href)
      ).json();
      assert.equal(release.buildId, metadata.buildId);
      assert.equal(release.sourceCommit, source.sourceCommit);
      assert.equal(release.integration, "catalog-local-v3");
      if (process.env.GAME_EXPECTED_COMMIT)
        assert.equal(release.sourceCommit, process.env.GAME_EXPECTED_COMMIT);
    }
    const game = page.frameLocator(".jp-area iframe");
    await expect(game.locator(".ht-menu-art")).toHaveJSProperty("naturalWidth", 1536, {
      timeout: 30_000,
    });
    await insideGame(game, ".ht-menu-play");
    await page.screenshot({ path: path.join(evidence, `${name}-menu.png`), fullPage: true });
    await insideGame(game, ".ht-menu-help");
    await game.getByRole("button", { name: "COMO JOGAR", exact: true }).click();
    await expect(game.locator(".ht-menu-guide")).toBeVisible();
    await insideGame(game, ".ht-menu-back");
    await page.screenshot({ path: path.join(evidence, `${name}-instructions.png`) });
    await game.getByRole("button", { name: "VOLTAR", exact: true }).click();
    await startGame(page, game, touch);
    const tip = game.getByRole("button", { name: "Fechar dica de orientação" });
    if (await tip.isVisible()) await tip.click();
    await insideGame(game, "canvas");
    if (name === "desktop") {
      const routes = game.locator(".ht-world-routes");
      async function go(destination) {
        if ((await routes.getAttribute("data-room")) === destination) return;
        const toggle = game.locator(".ht-world-routes-toggle");
        if ((await toggle.isVisible()) && (await toggle.getAttribute("aria-expanded")) !== "true")
          await toggle.click();
        await routes.locator(`button[data-destination="${destination}"]`).click();
        await expect(routes).toHaveAttribute("data-room", destination, { timeout: 30_000 });
        await expect(game.locator("#blocker")).toBeHidden();
      }
      for (const destination of [
        "hub",
        "corridor",
        "classroom",
        "cafeteria",
        "infirmary",
        "principal",
        "laboratory",
        "school",
      ]) {
        await go("hub");
        await go(destination);
      }
    }
    if (touch) {
      // The menu tap precedes the world's input listeners; exercise touch in the game too.
      await game.locator("canvas").tap();
      await expect(game.locator(".poc-touch-controls")).toBeVisible();
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${name}: horizontal overflow`,
    );
    if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)) {
      await page.mouse.move(8, height / 2);
      await page.mouse.wheel(0, 10000);
      await expect
        .poll(() =>
          page.evaluate(
            () => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) < 1,
          ),
        )
        .toBe(true);
      const canvasBox = await game.locator("canvas").boundingBox();
      const beforeWheel = await page.evaluate(() => scrollY);
      await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        Math.max(10, Math.min(height - 10, canvasBox.y + canvasBox.height / 2)),
      );
      await page.mouse.wheel(0, -100);
      await expect
        .poll(() => page.evaluate(() => scrollY), {
          message: `${name}: game canvas must not trap page scrolling`,
        })
        .toBeLessThan(beforeWheel);
    }
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
      await insideGame(game, '[role="dialog"]');
      await game.getByRole("button", { name: "Voltar ao jogo", exact: true }).click();
      await expect(game.getByRole("dialog")).toHaveCount(0);
      await page.screenshot({ path: path.join(evidence, `${name}-fullscreen-${w}x${h}.png`) });
    }
    await page.getByRole("button", { name: "Sair da tela cheia", exact: true }).click();
    await expect(fullscreen).toHaveAttribute("aria-pressed", "false");
    await page.setViewportSize({ width, height });
    await page.mouse.move(8, 120);
    await page.mouse.wheel(0, -10000);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const runtime = page.frames().find((frame) => frame.url().includes("/jogo/runtime/"));
    const beforeReload = await runtime.evaluate(() => {
      const key = Object.keys(localStorage).find(
        (key) => key.endsWith("v3") && !key.endsWith(":owner"),
      );
      return key ? { key, value: JSON.parse(localStorage.getItem(key)) } : null;
    });
    assert.ok(beforeReload, `${name}: V3 save must exist`);
    assert.equal(beforeReload.value.schema_version, 3);
    assert.equal(
      beforeReload.value.history.catalog_missions.length,
      6,
      `${name}: current six-mission catalog`,
    );
    await page.reload();
    await startGame(page, game, touch);
    const restored = await page
      .frames()
      .find((frame) => frame.url().includes("/jogo/runtime/"))
      .evaluate((key) => JSON.parse(localStorage.getItem(key)), beforeReload.key);
    assert.deepEqual(
      restored.skins,
      beforeReload.value.skins,
      `${name}: owned skins preserved on reload`,
    );
    assert.deepEqual(
      restored.history.progression,
      beforeReload.value.history.progression,
      `${name}: progression preserved on reload`,
    );
    assert.deepEqual(
      restored.history.missions,
      beforeReload.value.history.missions,
      `${name}: missions preserved on reload`,
    );
    assert.deepEqual(failures, [], `${name}: runtime/network failures`);
    results.push({ name, width, height, passed: true });
    await context.close();
  }
  fs.writeFileSync(
    path.join(evidence, "results.json"),
    JSON.stringify({ release, results, browser: "msedge", emulatedDevices: true }, null, 2),
  );
  console.log(
    `Game page browser checks passed: ${results.length} sizes, menu/help, keyboard/touch start, scrolling, nested assets, fullscreen, rotation, settings, exit and V3 reload.`,
  );
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage
      .screenshot({ path: path.join(evidence, `${activeCase}-failure.png`), fullPage: true })
      .catch(() => {});
  }
  fs.writeFileSync(path.join(evidence, "failure.txt"), `${activeCase}: ${error.stack}\n`);
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
