import { expect, test } from "@playwright/test";
import { API, mockApi, SID } from "./mockApi";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test.describe("Progress at 390×844", () => {
  test("shows streak, calendar, weak spots, vocabulary and history", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Progress");
    await expect(page.getByText("5 sessions · 48.5 min · 184 words · 11 notes")).toBeVisible();
    await expect(page.getByLabel("Current streak")).toContainText("2");
    await expect(page.getByLabel("Current streak")).toContainText("best 4");

    const calendar = page.getByRole("group", { name: "Last five weeks" });
    await expect(calendar.getByRole("button")).toHaveCount(35);
    await expect(calendar.locator("[data-active]")).toHaveCount(3);
    await calendar.locator("[data-active]").last().hover();
    await expect(page.getByRole("tooltip")).toContainText("8 min · 1 session");

    const weak = page.getByLabel("Weak spots by week");
    await expect(weak.getByRole("listitem")).toHaveCount(2);
    await expect(weak).toContainText("Dative");
    await expect(weak).toContainText("Word order");
    await expect(weak).toContainText("7 in 4 weeks");

    await expect(
      page.getByRole("img", { name: /Words owned over the last eight weeks, now 184/ }),
    ).toBeVisible();
    await expect(page.locator("[data-point]")).toHaveCount(8);

    const history = page.getByLabel("History");
    await expect(history.getByRole("link")).toHaveCount(2);
    await expect(history.getByRole("link").first()).toHaveAttribute("href", `/recap/${SID}`);
    await page.screenshot({ path: "test-results/progress.png", fullPage: true });

    // Every chart has a table twin.
    const tables = page.getByText("Show as table");
    await expect(tables).toHaveCount(3);
    await tables.nth(1).click();
    await expect(page.getByRole("table").first()).toContainText("Dative");
  });

  test("empty state invites the first talk", async ({ page }) => {
    const day = (ago: number) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);
    await page.route(`${API}/progress`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          days: Array.from({ length: 35 }, (_, i) => ({ date: day(34 - i), minutes: 0, sessions: 0 })),
          streak_days: 0,
          best_streak: 0,
          weeks: [21, 14, 7, 0].map(day),
          weak_spots: [],
          vocab: [49, 42, 35, 28, 21, 14, 7, 0].map((ago) => ({ week_start: day(ago), owned: 0 })),
          sessions: [],
          totals: { sessions: 0, minutes: 0, words: 0, corrections: 0 },
        }),
      }),
    );
    await page.goto("/progress");
    await expect(page.getByText("Nothing yet. Your first talk starts the clock.")).toBeVisible();
    await expect(page.getByText("Your charts fill up as you talk.")).toBeVisible();
    await expect(page.getByText("No notes in the last four weeks")).toBeVisible();
  });
});
