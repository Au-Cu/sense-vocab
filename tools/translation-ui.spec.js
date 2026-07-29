const { test, expect } = require("@playwright/test");
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1280, height: 900 },
});

async function openFirstExample(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(APP_URL);
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).not.toHaveText("");
  await page.locator("#revealButton").click();
  await expect(page.locator(".sense-item").first()).toBeVisible();
  await page.locator("#nextButton").click();
  await expect(page.locator(".sense-example-zh").first()).toBeVisible();
}

test("every sense displays a bilingual definition and contextual example", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await openFirstExample(page);
  const definitions = page.locator(".sense-definition");
  const definitionTranslations = page.locator(".sense-definition-zh");
  const examples = page.locator(".sense-example");
  const translations = page.locator(".sense-example-zh");
  const definitionGroups = page.locator(".sense-definition-group");
  const exampleGroups = page.locator(".sense-example-group");
  expect(await examples.count()).toBeGreaterThan(0);
  expect(await definitions.count()).toBe(await examples.count());
  expect(await definitionTranslations.count()).toBe(await examples.count());
  expect(await translations.count()).toBe(await examples.count());
  expect(await definitionGroups.count()).toBe(await examples.count());
  expect(await exampleGroups.count()).toBe(await examples.count());
  for (const text of await definitions.allTextContents()) {
    expect(text).toMatch(/^\u91ca\u4e49\uff1a.+/);
  }
  for (const text of await examples.allTextContents()) {
    expect(text).toMatch(/^\u4f8b\u53e5\uff1a.+/);
  }
  for (const text of await definitionTranslations.allTextContents()) {
    expect(text).toMatch(/^\u8bd1\u6587\uff1a.+[\u3400-\u9fff]/);
  }
  for (const text of await translations.allTextContents()) {
    expect(text).toMatch(/^\u8bd1\u6587\uff1a.+[\u3400-\u9fff]/);
  }
  const detailColors = await page.locator(
    ".sense-definition, .sense-definition-zh, .sense-example, .sense-example-zh",
  ).evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color));
  expect(new Set(detailColors).size).toBe(1);
  const groupGap = await exampleGroups.first().evaluate((element) => {
    return Number.parseFloat(getComputedStyle(element).marginTop);
  });
  expect(groupGap).toBeGreaterThanOrEqual(12);
  await page.screenshot({ path: "test-results/example-translation-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(translations.first()).toBeVisible();
  await page.screenshot({ path: "test-results/example-translation-mobile.png", fullPage: true });

  expect(consoleErrors).toEqual([]);
});
