import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const requireGame = createRequire(path.join(root, "../Heroes_Trial/web-poc/package.json"));
const requirePortal = createRequire(path.join(root, "../SMS_Portal/package.json"));
const { chromium, expect } = requireGame("@playwright/test");
const base = "/sms_nova_santa_rita/";
const evidence = path.join(root, "../.preview/landing");
fs.mkdirSync(evidence, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith(base)) return res.writeHead(404).end();
  const file = path.resolve(
    root,
    "dist",
    decodeURIComponent(url.pathname.slice(base.length)) || "index.html",
  );
  if (!file.startsWith(path.join(root, "dist") + path.sep)) return res.writeHead(403).end();
  try {
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}${base}`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];

try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1024],
    ["compact", 1024, 768],
    ["mobile", 390, 844],
    ["narrow", 320, 568],
    ["landscape", 844, 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
      hasTouch: width < 1000,
    });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".site-header")).toHaveAttribute("data-enhanced", "true");
    assert.ok(
      (await page.locator(".site-header").boundingBox()).height <= 80,
      `${name}: header wraps`,
    );
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator(".grade-missoes > li").count(), 6);
    await expect(page.locator('[data-mission-id="brushing_teeth"] .missao-lugar')).toHaveText(
      "Banheiro",
    );
    await expect(page.locator('[data-mission-id="smile_kit"] .missao-lugar')).toHaveText(
      "Refeitório",
    );
    await expect(
      page.locator('[data-mission-id="when_play_stops_being_play"] .missao-atividade'),
    ).toHaveText("Exploração, diálogo e escolhas");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();

    if (width <= 1184) {
      const toggle = page.getByRole("button", { name: "Menu", exact: true });
      await expect(page.locator("#menu-principal")).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.getByRole("navigation", { name: "Navegação principal", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await expect(page.locator("#menu-principal")).toBeHidden();
      await toggle.click();
      await page.locator('.nav-principal a[href="#missoes"]').click();
      await expect(page.locator("#menu-principal")).toBeHidden();
      await expect(page.locator("#missoes")).toBeFocused();
      const heading = await page.locator("#titulo-missoes").boundingBox();
      const header = await page.locator(".site-header").boundingBox();
      assert.ok(heading.y >= header.height, `${name}: anchor obscured by header`);
    }

    const sections = page.locator("main > section");
    for (let index = 0; index < (await sections.count()); index++) {
      const section = sections.nth(index);
      await section.scrollIntoViewIfNeeded();
      for (const image of await section.locator("img[src]").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
          .toBe(true);
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `${name}: horizontal overflow`,
      );
      if (name === "desktop" || name === "mobile") {
        await section.screenshot({
          path: path.join(evidence, `${name}-${await section.getAttribute("id")}.png`),
          style: ".site-header { visibility: hidden; }",
        });
      }
    }
    await expect(page.locator(".casa").first()).toHaveCSS("opacity", "1");
    assert.equal(await page.evaluate(() => document.fonts.check('800 24px "Nunito"')), true);

    if (name === "desktop" || name === "mobile") {
      await page.addScriptTag({ path: requirePortal.resolve("axe-core/axe.min.js") });
      const audit = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        });
        return result.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        }));
      });
      assert.deepEqual(audit, [], `${name}: accessibility violations`);
      await page
        .locator(".site-footer")
        .screenshot({ path: path.join(evidence, `${name}-footer.png`) });
    }

    const minigame = page.locator(".minigame img");
    const dimensions = await minigame.evaluate((img) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
      ratio: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
    }));
    assert.equal(dimensions.width, 448);
    assert.equal(dimensions.height, 800);
    assert.ok(Math.abs(dimensions.ratio - 448 / 800) < 0.001, `${name}: distorted minigame image`);

    for (let index = 0; index < 4; index++) {
      const link = page.locator(".minigame-ampliar, .galeria-ampliar").nth(index);
      await link.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Fechar" })).toBeFocused();
      await expect(dialog.locator("img")).toHaveAttribute(
        "src",
        new URL(await link.getAttribute("href"), url).href,
      );
      await dialog.locator("img").evaluate((img) => img.decode());
      if (index === 0 && (name === "desktop" || name === "mobile"))
        await page.screenshot({ path: path.join(evidence, `${name}-gallery-open.png`) });
      if (index === 1) await dialog.getByRole("button", { name: "Fechar" }).click();
      else await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(link).toBeFocused();
    }
    assert.equal(await page.locator('a[href*="/jogo/index.html"]').count(), 3);
    assert.equal(await page.locator('a[href*="/portal/"]').count(), 3);
    assert.deepEqual(
      await page
        .locator('a[href^="#"]')
        .evaluateAll((links) =>
          links.filter((link) => !document.querySelector(link.hash)).map((link) => link.hash),
        ),
      [],
    );
    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.locator('.nav-principal a[aria-current="location"]')).toHaveCount(0);
    await page.screenshot({ path: path.join(evidence, `${name}-hero.png`) });
    assert.deepEqual(failures, [], `${name}: browser errors`);
    results.push({ name, width, height, status: "passed" });
    await context.close();
  }

  const noJs = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  await noJs.goto(url);
  await expect(noJs.locator(".nav-principal")).toBeVisible();
  await expect(noJs.locator(".menu-toggle")).toBeHidden();
  await expect(noJs.locator(".casa").first()).toHaveCSS("opacity", "1");
  assert.equal(await noJs.locator(".galeria-ampliar[href]").count(), 3);
  assert.equal(await noJs.locator(".minigame-ampliar[href]").count(), 1);
  results.push({ name: "no-javascript", status: "passed" });

  const motion = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await motion.goto(url);
  await expect(motion.locator("#mascote-guia")).toHaveClass(/is-fixed/);
  await motion.locator("#jogo .casa").first().scrollIntoViewIfNeeded();
  await expect(motion.locator("#jogo .casa").first()).toHaveClass(/casa-visivel/);
  await motion.emulateMedia({ reducedMotion: "reduce" });
  await expect(motion.locator("#mascote-guia")).not.toHaveClass(/is-fixed/);
  await expect(motion.locator("#jogo .casa").first()).toHaveCSS("opacity", "1");
  results.push({ name: "motion-preference", status: "passed" });
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
