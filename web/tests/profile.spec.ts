import { expect, test } from "@playwright/test";
import { mockApi } from "./mockApi";

const AVATAR = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

test.describe("Profile avatar", () => {
  test("shows the Google avatar when the account has one", async ({ page }) => {
    await mockApi(page, { user: { avatar_url: AVATAR } });
    await page.goto("/profile");

    const avatar = page.getByRole("main").locator("header img");
    await expect(avatar).toHaveAttribute("src", AVATAR);
    await expect(avatar).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  test("falls back to the first letter without one", async ({ page }) => {
    await mockApi(page);
    await page.goto("/profile");

    const header = page.getByRole("main").locator("header");
    await expect(header).toHaveText("U");
    await expect(header.locator("img")).toHaveCount(0);
  });
});