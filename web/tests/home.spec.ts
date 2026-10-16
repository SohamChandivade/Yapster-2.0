import { expect, test } from "@playwright/test";
import { mockApi } from "./mockApi";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test.describe("Home at 390×844", () => {
  test("shows greeting, hero card and the four-tab nav", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hallo, Ujjwal");

    const start = page.getByRole("link", { name: /start talking/i });
    await expect(start).toBeVisible();
    await expect(start).toHaveAttribute("href", "/talk?scenario=interview");
    await expect(page.getByLabel("Stats")).toContainText("Dative");
    await expect(page.getByText("Day 12 · last session 8 min")).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

    await page.screenshot({ path: "test-results/home.png", fullPage: true });
  });

  test("never scrolls horizontally on a phone", async ({ page }) => {
    await page.goto("/");
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("a scenario card opens Talk with its slug", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /bakery/i }).first().click();
    await expect(page).toHaveURL(/\/talk\?scenario=bakery$/);
    await expect(page.getByText("Lena · Bakery")).toBeVisible();
  });

  test("bottom nav moves between tabs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Progress" }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Progress");
    await page.screenshot({ path: "test-results/progress.png" });
  });
});

test.describe("Every screen", () => {
  for (const path of ["/", "/scenarios", "/progress", "/profile", "/talk?scenario=bakery"]) {
    test(`${path} renders without console or page errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(path);
      // Talk has no heading by design; its transcript is the landmark.
      await expect(page.getByRole("heading", { level: 1 }).or(page.getByLabel("Transcript"))).toBeVisible();
      await page.waitForTimeout(500);

      expect(errors).toEqual([]);
    });
  }
});

test.describe("Theme", () => {
  test("defaults to light, toggles to dark, and persists across reload", async ({ page }) => {
    await page.goto("/profile");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.screenshot({ path: "test-results/profile.png" });

    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.screenshot({ path: "test-results/profile-dark.png" });

    await page.getByRole("radio", { name: "Light" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("Auto follows the device preference", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/profile");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.getByRole("radio", { name: "Auto" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
