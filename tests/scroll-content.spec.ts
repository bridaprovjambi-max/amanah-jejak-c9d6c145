import { test, expect, type Page } from "@playwright/test";

/**
 * Verifikasi konten halaman tidak terpotong dan dapat di-scroll sampai bawah
 * di berbagai viewport (terutama mobile). Mencegah regresi seperti
 * overflow-hidden pada <main> atau min-h-screen yang memotong konten di
 * mobile browser dengan URL bar.
 */
const PAGES = ["/dashboard", "/tasks", "/pptk", "/wewenang", "/telaah-staf"] as const;

async function goto(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Tunggu shell siap (header app shell selalu ada di rute terotentikasi).
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
}

for (const path of PAGES) {
  test.describe(`scroll content @ ${path}`, () => {
    test("tidak ada horizontal overflow di document", async ({ page }) => {
      await goto(page, path);
      const { sw, cw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(sw, "no horizontal overflow").toBeLessThanOrEqual(cw + 1);
    });

    test("bisa scroll sampai bawah & elemen terakhir terlihat", async ({ page }) => {
      await goto(page, path);

      // Scroll sampai bawah.
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let last = -1;
          const tick = () => {
            const el = document.scrollingElement || document.documentElement;
            el.scrollTop = el.scrollHeight;
            if (el.scrollTop === last) return resolve();
            last = el.scrollTop;
            requestAnimationFrame(tick);
          };
          tick();
        });
      });

      const metrics = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        return {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          innerHeight: window.innerHeight,
        };
      });

      // Jika konten lebih panjang dari viewport, kita harus benar2 sampai dasar.
      if (metrics.scrollHeight > metrics.clientHeight + 2) {
        const reached = metrics.scrollTop + metrics.clientHeight;
        expect(
          reached,
          `harus bisa scroll sampai bottom (reached=${reached}, total=${metrics.scrollHeight})`,
        ).toBeGreaterThanOrEqual(metrics.scrollHeight - 4);
      }

      // Verifikasi tidak ada wrapper dengan overflow-hidden yg memotong tinggi.
      const clippedMain = await page.evaluate(() => {
        const main = document.querySelector("main");
        if (!main) return false;
        const style = getComputedStyle(main);
        return (
          (style.overflowY === "hidden" || style.overflow === "hidden") &&
          main.scrollHeight > main.clientHeight + 2
        );
      });
      expect(clippedMain, "<main> tidak boleh memotong konten").toBe(false);
    });
  });
}
