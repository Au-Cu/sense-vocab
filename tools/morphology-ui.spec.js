const { test, expect } = require("@playwright/test");
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1280, height: 900 },
});

async function previewWord(page, targetWord) {
  await page.evaluate(async (word) => {
    const entries = await fetch("./data/kaoyan-words.json", { cache: "no-store" }).then((response) => response.json());
    const entry = entries.find((item) => item.word.toLowerCase() === word.toLowerCase());
    if (!entry) throw new Error(`Missing preview word: ${word}`);

    document.querySelector("#homePanel").hidden = true;
    document.querySelector("#studyPanel").hidden = false;
    document.querySelector("#senseArea").hidden = false;
    document.querySelector("#wordText").textContent = entry.word;
    document.querySelector("#senseList").replaceChildren();
    renderMorphology(entry);
  }, targetWord);
}

test("morphology modules render all emphasis modes without overflow", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(APP_URL);
  await expect(page.locator("#homePanel")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("html")).toHaveAttribute("data-vocabulary-ready", "true");
  await expect(page.locator("#morphologyPanel")).toBeHidden();

  await previewWord(page, "action");
  await expect(page.locator("#morphologyPanel")).toContainText("复数");
  await expect(page.locator(".morphology-form.is-muted")).toHaveText("actions");

  await previewWord(page, "hero");
  await expect(page.locator(".morphology-form.is-normal")).toHaveText("heroes");

  await previewWord(page, "information");
  await expect(page.locator("#morphologyPanel")).toContainText("不可数");

  await previewWord(page, "stop");
  await expect(page.locator("#morphologyPanel")).toContainText("stopping");
  await expect(page.locator("#morphologyPanel")).toContainText("stopped");

  await previewWord(page, "lie");
  await expect(page.locator(".morphology-special")).toHaveCount(2);
  await expect(page.locator("#morphologyPanel")).toContainText("lay");
  await expect(page.locator("#morphologyPanel")).toContainText("lain");
  await expect(page.locator("#morphologyPanel")).toContainText("lied");
  const specialColor = await page.locator(".morphology-form.is-special").first().evaluate(
    (element) => getComputedStyle(element).color,
  );
  expect(specialColor).toBe("rgb(180, 35, 24)");
  await page.screenshot({ path: "test-results/morphology-lie-desktop.png", fullPage: true });

  await previewWord(page, "hang");
  await expect(page.locator(".morphology-special")).toHaveCount(2);
  await expect(page.locator("#morphologyPanel")).toContainText("hung");
  await expect(page.locator("#morphologyPanel")).toContainText("hanged");

  await previewWord(page, "beware");
  await expect(page.locator("#morphologyPanel")).toContainText("通常只用原形 beware");

  await page.setViewportSize({ width: 390, height: 844 });
  await previewWord(page, "stop");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/morphology-stop-mobile.png", fullPage: true });

  expect(consoleErrors).toEqual([]);
});
