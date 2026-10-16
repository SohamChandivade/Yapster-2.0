/**
 * Smoke test for the real service worker, which only registers in production builds
 * (Playwright runs against `next dev`, where it is off by design).
 *
 *   npm run build && npx next start -p 3100   # in one terminal
 *   npm run smoke:sw                          # in another; exits 1 on failure
 *
 * Checks: the worker activates, the offline page gets precached, and with the network cut a
 * navigation to any screen lands on "You're offline".
 */
import { chromium } from "@playwright/test";

const base = process.env.SMOKE_URL ?? "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "allow",
});
const page = await context.newPage();
try {
  await page.goto(`${base}/welcome`);
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.ready).active),
    null,
    { timeout: 20_000 },
  );
  console.log("service worker active");
  await page.waitForFunction(async () => (await caches.match("/offline")) !== undefined, null, {
    timeout: 20_000,
  });
  const cached = await page.evaluate(async () => (await caches.open("yapster-v1")).keys().then((k) => k.length));
  console.log(`offline page precached with ${cached - 1} asset(s)`);

  await context.setOffline(true);
  await page.goto(`${base}/scenarios`);
  const heading = (await page.textContent("h1"))?.trim();
  console.log(`offline navigation rendered: "${heading}"`);
  await page.screenshot({ path: "test-results/offline-live.png" });
  if (!/offline/i.test(heading ?? "")) throw new Error("offline page was not served");
  console.log("OK");
} finally {
  await browser.close();
}
