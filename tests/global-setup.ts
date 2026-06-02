import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

export default async function globalSetup(config: FullConfig) {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Missing PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD. " +
        "Buat file .env di root project (lihat .env.example).",
    );
  }

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ??
    `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 5173}`;

  const storagePath = path.resolve("tests/.auth/user.json");
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });

  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  );
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("console", (m) => console.log(`[browser:${m.type()}]`, m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  } catch (err) {
    await page.screenshot({ path: "tests/.auth/login-fail.png", fullPage: true });
    console.log("Login current URL:", page.url());
    throw err;
  }

  await ctx.storageState({ path: storagePath });
  await browser.close();
}
