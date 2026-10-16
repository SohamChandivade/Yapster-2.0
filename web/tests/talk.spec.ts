import { expect, test } from "@playwright/test";
import { API, mockApi, SID } from "./mockApi";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test.describe("Talk at 390×844", () => {
  test("opens with the tutor's line, streams a reply, counts a silent note", async ({ page }) => {
    await page.goto("/talk?scenario=bakery");
    const transcript = page.getByLabel("Transcript");
    await expect(transcript).toContainText("Guten Morgen! Was darf es sein?");
    await expect(page.getByText("Lena · Bakery")).toBeVisible();
    await expect(page.getByRole("button", { name: /0 notes/ })).toBeVisible();

    const input = page.getByLabel("Your message in German");
    await input.fill("Ich möchte ein Brot");
    await input.press("Enter");

    await expect(transcript).toContainText("Gern, ein Roggenbrot. Soll ich es schneiden?");
    await expect(transcript.locator("[data-role=user]")).toHaveText(["Ich möchte ein Brot"]);
    await expect(page.getByRole("button", { name: /1 note/ })).toBeVisible();
    await page.screenshot({ path: "test-results/talk.png" });

    // Corrections never appear inline; they live in the drawer.
    await expect(transcript).not.toContainText("hätte gern");
    await page.getByRole("button", { name: /1 note/ }).click();
    const drawer = page.getByRole("dialog", { name: "Notes so far" });
    await expect(drawer).toContainText("Ich hätte gern ein Brot");
    await page.screenshot({ path: "test-results/talk-notes.png" });
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("help me say this inserts the German as the learner's line", async ({ page }) => {
    await page.goto("/talk?scenario=bakery");
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");

    await page.getByRole("button", { name: "Help me say this" }).click();
    const sheet = page.getByRole("dialog", { name: "Help me say this" });
    await sheet.getByLabel(/What do you want to say/).fill("Could I have a bag?");
    await sheet.getByRole("button", { name: "Translate" }).click();
    await expect(sheet).toContainText("Könnte ich bitte eine Tüte haben?");
    await page.screenshot({ path: "test-results/talk-help.png" });
    await sheet.getByRole("button", { name: "Use it" }).click();

    const transcript = page.getByLabel("Transcript");
    await expect(transcript.locator("[data-role=user]")).toHaveText([
      "Könnte ich bitte eine Tüte haben?",
    ]);
    await expect(transcript).toContainText("Natürlich, hier ist eine Tüte.");
  });

  test("nudging difficulty updates the level pill", async ({ page }) => {
    await page.goto("/talk");
    await expect(page.getByLabel("Difficulty")).toContainText("B1");
    await page.getByRole("button", { name: "Easier" }).click();
    await expect(page.getByLabel("Difficulty")).toContainText("A2");
  });

  test("ending the session lands on the recap with tiles, notes and save", async ({ page }) => {
    await page.goto("/talk?scenario=bakery");
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");
    await page.getByRole("button", { name: "End session" }).click();

    await expect(page).toHaveURL(new RegExp(`/recap/${SID}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Session recap");
    const stats = page.getByLabel("Session stats");
    await expect(stats).toContainText("62");
    await expect(stats).toContainText("31");
    await expect(page.getByLabel("Notes")).toContainText("Ich hätte gern ein Brot");
    await expect(page.getByLabel("You handled well")).toContainText("without help");
    await expect(page.getByLabel("Next time")).toContainText("follow-up");

    await page.getByRole("button", { name: /Save 1 new word/ }).click();
    await expect(page.getByRole("button", { name: "Saved ✓" })).toBeDisabled();
    await page.screenshot({ path: "test-results/recap.png", fullPage: true });
  });

  test("back with nothing said returns to the dashboard and discards the session", async ({
    page,
  }) => {
    await page.goto("/talk?scenario=bakery");
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");
    const discarded = page.waitForRequest(
      (r) => r.method() === "DELETE" && r.url().endsWith(`/sessions/${SID}`),
    );
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await discarded;
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hallo, Ujjwal");
  });

  test("back after talking asks before leaving", async ({ page }) => {
    await page.goto("/talk?scenario=bakery");
    const input = page.getByLabel("Your message in German");
    await input.fill("Ich möchte ein Brot");
    await input.press("Enter");
    await expect(page.getByLabel("Transcript")).toContainText("Roggenbrot");

    await page.getByRole("button", { name: "Back to dashboard" }).click();
    const sheet = page.getByRole("dialog", { name: "Leave the conversation?" });
    await expect(sheet).toBeVisible();
    await page.screenshot({ path: "test-results/talk-leave.png" });
    await sheet.getByRole("button", { name: "Keep talking" }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await sheet.getByRole("button", { name: "See my recap" }).click();
    await expect(page).toHaveURL(new RegExp(`/recap/${SID}$`));
  });

  test("shows a retry state when the session cannot start", async ({ page }) => {
    await page.route(`${API}/sessions`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "The tutor is unavailable right now: quota" }),
      }),
    );
    await page.goto("/talk");
    await expect(page.getByText(/tutor is unavailable/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
