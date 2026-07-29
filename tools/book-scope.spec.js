const { test, expect } = require("@playwright/test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const ROOT_DIR = path.resolve(__dirname, "..");

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1280, height: 900 },
});

async function openFreshApp(page) {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => {
    return document.documentElement.dataset.appReady === "true";
  });
}

test("the shared pool preserves the original Kaoyan book and adds IELTS", async () => {
  const kaoyanPath = path.join(ROOT_DIR, "data", "kaoyan-words.json");
  const bundlePath = path.join(ROOT_DIR, "data", "vocabulary-bundle.json");
  const kaoyanBytes = fs.readFileSync(kaoyanPath);
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const byId = Object.fromEntries(bundle.books.map((book) => [book.id, book]));

  expect(crypto.createHash("sha256").update(kaoyanBytes).digest("hex"))
    .toBe("dd15b65e76ab805fdf5b9c1cad29e6af811152be593d070488c905338c0f3913");
  expect(bundle.words).toHaveLength(6607);
  expect(byId.kaoyan.entries).toHaveLength(5042);
  expect(byId.ielts.entries).toHaveLength(4827);
  expect(new Set(byId.kaoyan.entries.map((entry) => entry.wordId)).size)
    .toBe(5042);
  expect(new Set(byId.ielts.entries.map((entry) => entry.wordId)).size)
    .toBe(4827);
});

test("plans, progress, statistics, and word lists switch by book", async ({ page }) => {
  await openFreshApp(page);

  await expect(page.locator("#homeBookName")).toHaveText("考研词汇");
  await expect(page.locator("#homeRemainingWords")).toHaveText("5042");

  await page.locator("#planButton").click();
  await page.locator("#bookSelect").selectOption("ielts");
  await expect(page.locator("#planPreview")).toContainText("剩余 4827 个词");
  await page.locator("#dailyTargetInput").fill("30");
  await page.locator("#savePlanButton").click();

  await expect(page.locator("#homeBookName")).toHaveText("雅思词汇");
  await expect(page.locator("#homeRemainingWords")).toHaveText("4827");
  await page.locator("#wordListButton").click();
  await expect(page.locator("#wordListBookName")).toHaveText("雅思词汇");
  await expect(page.locator(".word-list-item")).toHaveCount(4827);
  await page.locator("#wordListBackButton").click();

  await page.locator("#planButton").click();
  await page.locator("#bookSelect").selectOption("kaoyan");
  await page.locator("#dailyTargetInput").fill("40");
  await page.locator("#savePlanButton").click();

  await expect(page.locator("#homeBookName")).toHaveText("考研词汇");
  await expect(page.locator("#homeRemainingWords")).toHaveText("5042");
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.activeBookId).toBe("kaoyan");
  expect(saved.bookStates.kaoyan.plan.dailyTarget).toBe(40);
  expect(saved.bookStates.ielts.plan.dailyTarget).toBe(30);
  expect(saved.bookStates.kaoyan.introducedWords).toEqual([]);
  expect(saved.bookStates.ielts.introducedWords).toEqual([]);
});

test("legacy single-book history migrates only into Kaoyan", async ({ page }) => {
  await openFreshApp(page);
  await page.evaluate(() => {
    window.SenseVocabApp.replaceActiveState({
      view: "home",
      plan: {
        dailyTarget: 40,
        startedOn: "2026-07-17",
        createdOn: "2026-07-17",
        updatedOn: "2026-07-17",
        advancedDays: 0,
        progressBaseWords: 0,
        progressBaseDays: 0,
      },
      session: null,
      introducedWords: ["act"],
      progress: {
        "act:v-1": {
          status: "mastered",
          misses: 0,
          firstSeen: "2026-07-17",
          lastSeen: "2026-07-18",
          masteredOn: "2026-07-18",
        },
      },
      activityLog: {},
      studyWindows: [],
      learningDayCounter: 1,
      wordListSort: "mastery",
      wordBrowse: null,
      dataVersion: 8,
    });
  });

  const migrated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(migrated.bookStates.kaoyan.introducedWords).toContain("act");
  expect(migrated.bookStates.kaoyan.progress["act:v-1"].status).toBe("mastered");
  expect(migrated.bookStates.ielts.introducedWords).toEqual([]);
  expect(migrated.bookStates.ielts.progress).toEqual({});

  await page.locator("#planButton").click();
  await page.locator("#bookSelect").selectOption("ielts");
  await page.locator("#dailyTargetInput").fill("30");
  await page.locator("#savePlanButton").click();
  await expect(page.locator("#homeCompletedWords")).toHaveText("0");

  await page.locator("#planButton").click();
  await page.locator("#bookSelect").selectOption("kaoyan");
  await page.locator("#savePlanButton").click();
  await expect(page.locator("#homeCompletedWords")).toHaveText("1");
});
