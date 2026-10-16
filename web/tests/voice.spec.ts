import { expect, type Page, test } from "@playwright/test";
import { mockApi } from "./mockApi";

/**
 * Fake Web Speech APIs installed before any page script runs. Recognition yields an
 * interim then a final German sentence; synthesis records every sentence it is asked
 * to speak and only "finishes" when the test says so, so the Blob's speaking state
 * can be observed deterministically.
 */
function installFakeSpeech(page: Page, opts: { recognition: boolean } = { recognition: true }) {
  return page.addInitScript((withRecognition: boolean) => {
    const w = window as unknown as Record<string, unknown>;
    const spoken: string[] = [];
    w.__spoken = spoken;
    const pendingEnds: Array<() => void> = [];
    w.__finishSpeaking = () => {
      pendingEnds.splice(0).forEach((fn) => fn());
    };
    w.__finishListening = () => {};

    class FakeUtterance {
      text: string;
      lang = "";
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const synth = {
      speaking: false,
      getVoices: () => [{ name: "Google Deutsch", lang: "de-DE", default: false, localService: true, voiceURI: "de" }],
      speak(u: FakeUtterance) {
        spoken.push(u.text);
        setTimeout(() => u.onstart?.(), 0);
        pendingEnds.push(() => u.onend?.());
      },
      cancel() {
        spoken.push("<cancel>");
        pendingEnds.splice(0);
      },
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
      onvoiceschanged: null,
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    w.SpeechSynthesisUtterance = FakeUtterance;
    Object.defineProperty(navigator, "userActivation", {
      value: { hasBeenActive: true, isActive: true },
      configurable: true,
    });

    if (!withRecognition) {
      delete w.SpeechRecognition;
      delete w.webkitSpeechRecognition;
      return;
    }
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        w.__recognitionLang = this.lang;
        setTimeout(() => this.onstart?.(), 0);
        const result = (transcript: string, isFinal: boolean) => ({
          resultIndex: 0,
          results: [Object.assign([{ transcript }], { isFinal })],
        });
        setTimeout(() => this.onresult?.(result("Ich möchte", false)), 60);
        w.__finishListening = () => {
          this.onresult?.(result("Ich möchte ein Brot", true));
          this.onend?.();
        };
      }
      stop() {
        (w.__finishListening as () => void)();
      }
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
    delete w.webkitSpeechRecognition;
  }, opts.recognition);
}

const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
const finishSpeaking = (page: Page) =>
  page.evaluate(() => (window as unknown as { __finishSpeaking: () => void }).__finishSpeaking());
const finishListening = (page: Page) =>
  page.evaluate(() => (window as unknown as { __finishListening: () => void }).__finishListening());

test.describe("Voice at 390×844", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test("speaks the opening and the streamed reply one sentence at a time", async ({ page }) => {
    await installFakeSpeech(page);
    await page.goto("/talk?scenario=bakery");
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");
    await expect.poll(() => spoken(page)).toEqual(["Guten Morgen!", "Was darf es sein?"]);

    // The Blob pulses while the browser is still speaking, and stops when it finishes.
    await expect(page.locator("[data-speaking]")).toHaveCount(1);
    await finishSpeaking(page);
    await expect(page.locator("[data-speaking]")).toHaveCount(0);

    const input = page.getByLabel("Your message in German");
    await input.fill("Ich möchte ein Brot");
    await input.press("Enter");
    await expect(page.getByLabel("Transcript")).toContainText("Soll ich es schneiden?");
    await expect
      .poll(() => spoken(page))
      .toEqual(["Guten Morgen!", "Was darf es sein?", "<cancel>", "Gern, ein Roggenbrot.", "Soll ich es schneiden?"]);
  });

  test("tap the mic, speak, and the sentence is sent as the learner's line", async ({ page }) => {
    await installFakeSpeech(page);
    await page.goto("/talk?scenario=bakery");
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");

    const mic = page.getByRole("button", { name: "Talk" });
    await mic.click();
    await expect(page.getByRole("button", { name: "Stop listening" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Listening…").first()).toBeVisible();
    await page.screenshot({ path: "test-results/talk-listening.png" });
    await expect(page.getByLabel("Your message in German")).toHaveValue(/Ich möchte/);
    await finishListening(page);

    const transcript = page.getByLabel("Transcript");
    await expect(transcript.locator("[data-role=user]")).toHaveText(["Ich möchte ein Brot"]);
    await expect(transcript).toContainText("Gern, ein Roggenbrot.");
    expect(await page.evaluate(() => (window as unknown as { __recognitionLang: string }).__recognitionLang)).toBe("de-DE");
    await expect(page.getByRole("button", { name: "Talk" })).toBeVisible();
  });

  test("voice can be switched off and stays off", async ({ page }) => {
    await installFakeSpeech(page);
    await page.goto("/talk?scenario=bakery");
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");
    await page.getByRole("button", { name: "Voice on" }).click();
    await expect(page.getByRole("button", { name: "Voice off" })).toHaveAttribute("aria-pressed", "false");
    const before = (await spoken(page)).length;

    const input = page.getByLabel("Your message in German");
    await input.fill("Ich möchte ein Brot");
    await input.press("Enter");
    await expect(page.getByLabel("Transcript")).toContainText("Soll ich es schneiden?");
    const after = await spoken(page);
    expect(after.slice(before).filter((s) => s !== "<cancel>")).toEqual([]);

    await page.reload();
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");
    await expect(page.getByRole("button", { name: "Voice off" })).toBeVisible();
  });

  test("without speech recognition the mic hides and typing still works", async ({ page }) => {
    await installFakeSpeech(page, { recognition: false });
    await page.goto("/talk?scenario=bakery");
    await expect(page.getByLabel("Transcript")).toContainText("Guten Morgen");
    await expect(page.getByRole("button", { name: "Talk" })).toHaveCount(0);
    const input = page.getByLabel("Your message in German");
    await expect(input).toHaveAttribute("placeholder", "Schreib auf Deutsch…");
    await input.fill("Hallo");
    await input.press("Enter");
    await expect(page.getByLabel("Transcript")).toContainText("Roggenbrot");
  });
});
