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

test.describe("Home links", () => {
  test("calendar, tiles, See all and last session all lead somewhere real", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hallo, Ujjwal");
    await expect(page.getByRole("link", { name: "Open progress" })).toHaveAttribute("href", "/progress");
    await expect(page.getByRole("link", { name: "Streak, see progress" })).toHaveAttribute("href", "/progress");
    await expect(page.getByRole("link", { name: /Open the recap of your last session/ })).toHaveAttribute(
      "href",
      "/recap/11111111-1111-1111-1111-111111111111",
    );
    await page.getByRole("link", { name: "See all" }).click();
    await expect(page).toHaveURL(/\/scenarios$/);
  });

  test("an unfinished conversation can be continued from Home", async ({ page }) => {
    const { API, dashboard, SID } = await import("./mockApi");
    await page.route(`${API}/dashboard`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...dashboard,
          open_session: {
            session_id: SID,
            scenario: "bakery",
            scenario_title: "Bakery",
            started_at: new Date(Date.now() - 600000).toISOString(),
            turns: 1,
          },
        }),
      }),
    );
    await page.goto("/");
    const card = page.getByLabel("Unfinished conversation", { exact: true });
    await expect(card).toContainText("Bakery · 1 turn");
    await card.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(new RegExp(`/talk\\?session=${SID}$`));
    const transcript = page.getByLabel("Transcript");
    await expect(transcript).toContainText("Soll ich es schneiden?");
    await expect(transcript.locator("[data-role=user]")).toHaveText(["Ich möchte ein Brot"]);
    await expect(page.getByRole("button", { name: /1 note/ })).toBeVisible();
  });
});
