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

  test("hint explains Lena's line, offers replies, and can keep English on", async ({ page }) => {
    await page.goto("/talk?scenario=bakery");
    const transcript = page.getByLabel("Transcript");
    await expect(transcript).toContainText("Guten Morgen");
    await expect(transcript.locator("[data-english]")).toHaveCount(0);

    await page.getByRole("button", { name: "Hint for this line" }).click();
    const sheet = page.getByRole("dialog", { name: "Hint" });
    await expect(sheet).toContainText("Good morning! What can I get you?");
    await expect(sheet.getByLabel("Suggested replies").getByRole("listitem")).toHaveCount(3);
    await expect(sheet).toContainText("name one thing and add bitte");
    await page.screenshot({ path: "test-results/talk-hint.png" });

    await sheet.getByRole("switch", { name: /Show English/ }).click();
    await expect(sheet.getByRole("switch", { name: /Show English/ })).toHaveAttribute("aria-checked", "true");

    await sheet.getByRole("button", { name: "Use: Ein Brot, bitte." }).click();
    await expect(sheet).toBeHidden();
    await expect(transcript.locator("[data-role=user]")).toHaveText(["Ein Brot, bitte."]);
    await expect(transcript).toContainText("Natürlich, hier ist eine Tüte.");
    // Beginner mode: every tutor line now carries its English underneath.
    await expect(transcript.locator("[data-english]")).toHaveText([
      "Good morning! What can I get you?",
      "Of course, here is a bag.",
    ]);
    await page.screenshot({ path: "test-results/talk-english.png" });
  });

  test("hint stays available on every tutor line and targets the right one", async ({ page }) => {
    const hintBodies: string[] = [];
    await page.route(`${API}/sessions/${SID}/hint`, (route) => {
      hintBodies.push(route.request().postData() ?? "");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message_id: "m2",
          tutor_line: "Gern, ein Roggenbrot. Soll ich es schneiden?",
          translation: "Sure, a rye bread. Shall I slice it?",
          suggestions: [{ german: "Ja, bitte.", english: "Yes, please." }],
          tip: "She is offering to slice it; a yes or no is enough.",
        }),
      });
    });
    await page.goto("/talk?scenario=bakery");
    const transcript = page.getByLabel("Transcript");
    await expect(transcript).toContainText("Guten Morgen");
    await expect(page.getByRole("button", { name: "Hint for this line" })).toHaveCount(1);

    const input = page.getByLabel("Your message in German");
    await input.fill("Ein Brot, bitte.");
    await input.press("Enter");
    await expect(transcript).toContainText("Soll ich es schneiden?");

    // The newest line gets the prominent chip; the earlier one keeps a compact one.
    await expect(page.getByRole("button", { name: "Hint for this line" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Hint for an earlier line" })).toHaveCount(1);

    await page.getByRole("button", { name: "Hint for this line" }).click();
    const sheet = page.getByRole("dialog", { name: "Hint" });
    await expect(sheet).toContainText("Sure, a rye bread. Shall I slice it?");
    expect(JSON.parse(hintBodies[0])).toEqual({ message_id: "m2" });
    await page.screenshot({ path: "test-results/talk-hint-second.png" });
  });

  test("a failed hint shows the error and can be retried", async ({ page }) => {
    let calls = 0;
    await page.route(`${API}/sessions/${SID}/hint`, (route) => {
      calls += 1;
      if (calls === 1) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "The tutor is unavailable right now: quota" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message_id: "m0",
          tutor_line: "Guten Morgen! Was darf es sein?",
          translation: "Good morning! What can I get you?",
          suggestions: [{ german: "Ein Brot, bitte.", english: "A bread, please." }],
          tip: "Name one thing and add bitte.",
        }),
      });
    });
    await page.goto("/talk?scenario=bakery");
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");

    await page.getByRole("button", { name: "Hint for this line" }).click();
    const sheet = page.getByRole("dialog", { name: "Hint" });
    await expect(sheet.getByRole("alert")).toContainText("tutor is unavailable");
    await sheet.getByRole("button", { name: "Try again" }).click();
    await expect(sheet).toContainText("Good morning! What can I get you?");
    await expect(sheet.getByRole("alert")).toHaveCount(0);
    // The chip is still there for the next time.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Hint for this line" })).toBeVisible();
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
