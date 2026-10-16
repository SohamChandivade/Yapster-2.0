import { expect, test } from "@playwright/test";
import { mockApi } from "./mockApi";

test.describe("PWA", () => {
  test("serves a manifest whose icons and service worker all exist", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const manifest = (await res.json()) as {
      name: string;
      display: string;
      start_url: string;
      icons: { src: string; purpose?: string }[];
    };
    expect(manifest.name).toBe("Yapster");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const img = await request.get(icon.src);
      expect(img.status(), icon.src).toBe(200);
      expect(img.headers()["content-type"], icon.src).toContain("image/png");
    }

    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(await sw.text()).toContain('addEventListener("fetch"');
  });

  test("pages link the manifest, favicon and Apple touch icon", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveCount(1);
    // Next 15 emits the standard meta (apple-mobile-web-app-capable is deprecated in iOS 17+).
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Yapster");
  });

  test("offline page and the install card render", async ({ page }) => {
    await mockApi(page);
    await page.goto("/offline");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You’re offline");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.screenshot({ path: "test-results/offline.png" });

    await page.goto("/profile");
    await expect(page.getByLabel("App", { exact: true })).toContainText("Add to Home Screen");
  });

  test("the offline page is reachable while signed out", async ({ page }) => {
    await page.goto("/offline");
    await expect(page).toHaveURL(/\/offline$/);
  });
});
