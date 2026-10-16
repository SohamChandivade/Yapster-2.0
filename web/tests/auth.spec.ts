import { expect, test } from "@playwright/test";
import { mockApi } from "./mockApi";

test.describe("Signed out", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { session: "none" });
  });

  test("every app route lands on the welcome page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Start speaking it.");
    await page.screenshot({ path: "test-results/welcome.png" });

    await page.goto("/talk");
    await expect(page).toHaveURL(/\/welcome$/);

    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("register leads straight into onboarding", async ({ page }) => {
    await page.goto("/register");
    const button = page.getByRole("button", { name: "Continue with email" });
    await expect(button).toBeDisabled();

    await page.getByLabel("Email").fill("new@example.com");
    await page.getByLabel("Password").fill("short");
    await expect(button).toBeDisabled();
    await page.getByLabel("Password").fill("correct horse battery");
    await page.screenshot({ path: "test-results/register.png" });
    await button.click();

    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("login shows the server's message on a wrong password, then goes home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("ujjwal@example.com");
    await page.getByLabel("Password").fill("wrong password");
    await page.screenshot({ path: "test-results/login.png" });
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();

    await page.getByLabel("Password").fill("right password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hallo, Ujjwal");
  });
});

test.describe("Google sign-in", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { session: "none" });
  });

  test("round-trips through the API and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hallo, Ujjwal");
    await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  });

  test("a failed round-trip explains itself on the login page", async ({ page }) => {
    await page.goto("/login?error=google&reason=access_denied");
    await expect(page.getByText(/closed the Google window/)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the welcome page offers Google first", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await page.screenshot({ path: "test-results/welcome.png" });
  });
});

test.describe("Onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { session: "new" });
  });

  test("a signed-in but new user is held on onboarding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("walks five questions, reacts, and starts the first talk", async ({ page }) => {
    await page.goto("/onboarding");
    const next = page.getByRole("button", { name: "Continue" });
    const h1 = page.getByRole("heading", { level: 1 });

    await expect(h1).toHaveText("What should I call you?");
    await expect(next).toBeDisabled();
    await page.getByLabel("Your name").fill("Uli");
    await page.screenshot({ path: "test-results/onboarding-1.png" });
    await page.getByLabel("Your name").press("Enter");

    await expect(h1).toHaveText("How does speaking German feel right now?");
    await expect(next).toBeDisabled();
    await page.getByRole("button", { name: "Awkward" }).click();
    await expect(page.getByRole("button", { name: "Awkward" })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: "test-results/onboarding-2.png" });
    await next.click();

    await expect(h1).toHaveText("What's your level?");
    await expect(page.getByRole("button", { name: /Just starting/ })).toBeVisible();
    await page.getByRole("button", { name: /^B1/ }).click();
    await page.screenshot({ path: "test-results/onboarding-3.png" });
    await next.click();

    await expect(h1).toHaveText("What do you need German for?");
    await page.getByRole("button", { name: "Work" }).click();
    await page.getByRole("button", { name: "Travel" }).click();
    await page.screenshot({ path: "test-results/onboarding-4.png" });
    await next.click();

    await expect(h1).toHaveText("Thanks for being honest.");
    const plan = page.getByText(/Hallo, Uli/);
    await expect(plan).toContainText("B1");
    await expect(page.getByText("First stop:")).toContainText("Job interview");
    await page.screenshot({ path: "test-results/onboarding-5.png" });

    // Back works and keeps the answer.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true");
    await next.click();

    await page.getByRole("button", { name: "Start talking" }).click();
    await expect(page).toHaveURL(/\/talk\?scenario=interview$/);
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");
  });
});

test.describe("Signed in", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test("public pages bounce back to the app", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/$/);
  });

  test("profile shows the account and log out returns to welcome", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ujjwal");
    await expect(page.getByText("ujjwal@example.com")).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome$/);
  });
});
