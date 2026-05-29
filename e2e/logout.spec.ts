/**
 * Skenario uji otomatis untuk alur logout.
 *
 * Framework: Playwright (@playwright/test).
 *
 * Cara menjalankan:
 *   bun add -D @playwright/test
 *   bunx playwright install chromium
 *   BASE_URL=http://localhost:3000 \
 *   TEST_EMAIL=user@example.com \
 *   TEST_PASSWORD=secret123 \
 *   bunx playwright test e2e/logout.spec.ts
 *
 * Skenario yang dicakup:
 *  1. Logout dari dashboard → redirect ke landing ("/").
 *  2. Setelah logout, tombol Back browser TIDAK boleh mengembalikan
 *     user ke dashboard (sesi sudah invalid → redirect ke "/").
 *  3. Akses langsung URL dashboard tanpa sesi → redirect ke "/".
 *  4. Sesi di-invalidate manual (storage di-clear) saat berada di
 *     dashboard → navigasi berikutnya redirect ke "/".
 *  5. Buka landing saat belum login → tetap di "/" (tidak melempar).
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL ?? "user@example.com";
const PASSWORD = process.env.TEST_PASSWORD ?? "secret123";

const LANDING = "/";
const DASHBOARD = "/kalender"; // route di bawah _authenticated
const LOGIN = "/login";

async function login(page: Page) {
  await page.goto(`${BASE_URL}${LOGIN}`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password|kata sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: /login|masuk|sign in/i }).click();
  // Tunggu navigasi keluar dari /login
  await page.waitForURL((url) => !url.pathname.startsWith(LOGIN), {
    timeout: 10_000,
  });
}

async function logout(page: Page) {
  // Buka menu user (avatar) lalu klik tombol logout.
  // Sesuaikan selector jika label berbeda.
  const trigger = page
    .getByRole("button", { name: /account|akun|profil|menu/i })
    .or(page.locator('[data-testid="user-menu"]'));
  if (await trigger.count()) {
    await trigger.first().click();
  }
  await page
    .getByRole("menuitem", { name: /logout|keluar|sign out/i })
    .or(page.getByRole("button", { name: /logout|keluar|sign out/i }))
    .first()
    .click();
}

test.describe("Alur logout", () => {
  test("1. Logout dari dashboard redirect ke landing", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}${DASHBOARD}`);
    await expect(page).toHaveURL(new RegExp(`${DASHBOARD}$`));

    await logout(page);

    await page.waitForURL(`${BASE_URL}${LANDING}`, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe(LANDING);
  });

  test("2. Tombol Back setelah logout tetap redirect ke landing", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${BASE_URL}${DASHBOARD}`);
    await logout(page);
    await page.waitForURL(`${BASE_URL}${LANDING}`);

    // Coba kembali ke dashboard via history back
    await page.goBack();

    // Karena sesi sudah invalid, guard _authenticated harus melempar
    // user kembali ke landing.
    await page.waitForURL(`${BASE_URL}${LANDING}`, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe(LANDING);
  });

  test("3. Akses dashboard tanpa login redirect ke landing", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}${DASHBOARD}`);

    await page.waitForURL(`${BASE_URL}${LANDING}`, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe(LANDING);
  });

  test("4. Sesi di-clear di tab lain → navigasi berikutnya redirect", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${BASE_URL}${DASHBOARD}`);

    // Simulasi sesi expired / logout dari tab lain
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload untuk memicu ulang guard
    await page.reload();

    await page.waitForURL(`${BASE_URL}${LANDING}`, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe(LANDING);
  });

  test("5. Landing dapat diakses tanpa sesi", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}${LANDING}`);
    await expect(page).toHaveURL(`${BASE_URL}${LANDING}`);
  });
});
