import { test, expect, type Page } from "@playwright/test";

const PAGES = [
  { path: "/tasks", selects: 1 },
  { path: "/pptk", selects: 2 },
  { path: "/wewenang", selects: 2 },
  { path: "/telaah-staf", selects: 2 },
] as const;

/**
 * Filter bar identifier — matches the wrapper class shared by the 4 pages.
 * (`shadow-card-elegant` is unique to this container.)
 */
const FILTER_BAR = "div.shadow-card-elegant";

async function goto(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Wait for either filter bar or "Memuat..." to settle.
  await page.locator(FILTER_BAR).first().waitFor({ state: "visible", timeout: 30_000 });
}

async function isWithinViewport(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box, "element should have a layout box").not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  // ≤ 1px tolerance for sub-pixel rounding.
  expect(box.x, "element left within viewport").toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, "element right within viewport").toBeLessThanOrEqual(
    viewport.width + 1,
  );
  expect(box.width, "element should have non-zero width").toBeGreaterThan(0);
}

for (const { path, selects } of PAGES) {
  test.describe(`filter bar @ ${path}`, () => {
    test("tidak ada horizontal scroll pada body", async ({ page }) => {
      await goto(page, path);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, "page should not overflow horizontally").toBeLessThanOrEqual(
        clientWidth + 1,
      );
    });

    test("search input penuh terlihat & tidak terpotong", async ({ page }) => {
      await goto(page, path);
      const bar = page.locator(FILTER_BAR).first();
      const search = bar.locator('input[placeholder^="Cari"]');
      await expect(search).toBeVisible();
      await isWithinViewport(page, search);
    });

    test(`${selects} select trigger terlihat dan dalam viewport`, async ({ page }) => {
      await goto(page, path);
      const bar = page.locator(FILTER_BAR).first();
      const triggers = bar.locator('[role="combobox"]');
      await expect(triggers).toHaveCount(selects);
      for (let i = 0; i < selects; i++) {
        const t = triggers.nth(i);
        await expect(t).toBeVisible();
        await isWithinViewport(page, t);
      }
    });

    test("seluruh filter bar tidak overflow horizontal", async ({ page }) => {
      await goto(page, path);
      const bar = page.locator(FILTER_BAR).first();
      const overflow = await bar.evaluate(
        (el) => el.scrollWidth - el.clientWidth,
      );
      expect(overflow, "filter bar should not overflow").toBeLessThanOrEqual(1);
    });
  });
}
