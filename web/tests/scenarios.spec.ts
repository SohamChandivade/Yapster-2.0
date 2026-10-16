import { expect, test } from "@playwright/test";
import { mockApi } from "./mockApi";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test.describe("Scenarios at 390×844", () => {
  test("lists every scenario with play counts and opens a talk", async ({ page }) => {
    await page.goto("/scenarios");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scenarios");
    await expect(page.getByText("5 conversations so far. Pick the next one.")).toBeVisible();
    const list = page.getByLabel("Scenario list");
    await expect(list.getByRole("link")).toHaveCount(7);
    await expect(list.getByRole("link", { name: /Bakery/ })).toContainText("Played 3×");
    await expect(list.getByRole("link", { name: /Train ticket/ })).not.toContainText("Played");
    await page.screenshot({ path: "test-results/scenarios.png", fullPage: true });

    await list.getByRole("link", { name: /Train ticket/ }).click();
    await expect(page).toHaveURL(/\/talk\?scenario=train$/);
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");
  });
});
