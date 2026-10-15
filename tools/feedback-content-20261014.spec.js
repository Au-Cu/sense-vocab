const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = "data/content-change-sets/op-feedback-2026-10-14-216.json";
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_PATH), "utf8"));
const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, "data/vocabulary-bundle.json"), "utf8"));
const words = new Map(bundle.words.map((word) => [word.id, word]));
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

test.use({ launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } });

test("approved October feedback fields match their immutable source and rights records", () => {
  const sourceBytes = fs.readFileSync(path.join(ROOT, manifest.sourcePackage.path));
  expect(hash(sourceBytes)).toBe(manifest.sourcePackage.sha256);
  expect(manifest.review.status).toBe("approved");
  expect(manifest.counts.uniqueCandidateFields).toBe(555);
  expect(manifest.counts.duplicateFieldsCollapsed).toBe(9);
  expect(manifest.pendingItems).toHaveLength(16);
  expect(manifest.compatibility.addedSenseKeys).toHaveLength(77);
  const result = execFileSync(process.execPath,
    [path.join(ROOT, "tools/verify-content-change-set.mjs"), MANIFEST_PATH],
    { cwd: ROOT, encoding: "utf8" });
  expect(result).toContain("CLEARED (117 items, 709 fields)");
  for (const item of manifest.items) {
    const sense = words.get(item.wordId).senses.find((value) => value.id === item.senseId);
    expect(sense, `${item.wordId}:${item.senseId}`).toBeDefined();
    for (const [field, value] of Object.entries(item.fields)) {
      expect(sense[field], `${item.wordId}:${item.senseId}:${field}`).toEqual(value);
      expect(hash(String(value ?? "null"))).toBe(item.fieldEvidence[field].candidateSha256Utf8);
    }
  }
});

test("October additions preserve every old stable identity and book ordering", () => {
  const baseline = manifest.baseline.identitySnapshot;
  expect(bundle.words.map((word) => [word.id, word.word])).toEqual(baseline.words.map((word) => [word.id, word.word]));
  const actualAdded = [];
  for (const prior of baseline.words) {
    const current = words.get(prior.id);
    expect(current.senses.slice(0, prior.senses.length).map(({ id, pos, synsetId }) => ({ id, pos, synsetId })))
      .toEqual(prior.senses);
    actualAdded.push(...current.senses.slice(prior.senses.length).map((sense) => `${prior.id}:${sense.id}`));
  }
  expect(actualAdded.sort()).toEqual([...manifest.compatibility.addedSenseKeys].sort());
  for (const prior of baseline.books) {
    const current = bundle.books.find((book) => book.id === prior.id);
    expect(current.entries.map((entry) => entry.wordId)).toEqual(prior.entries.map((entry) => entry.wordId));
    for (let index = 0; index < prior.entries.length; index += 1) {
      const oldEntry = prior.entries[index];
      const newEntry = current.entries[index];
      expect(newEntry.senseIds.slice(0, oldEntry.senseIds.length)).toEqual(oldEntry.senseIds);
      const expected = manifest.items.filter((item) => item.action === "add" &&
        item.wordId === oldEntry.wordId && item.bookIds.includes(prior.id)).map((item) => item.senseId);
      expect(newEntry.senseIds.slice(oldEntry.senseIds.length)).toEqual(expected);
    }
  }
});

test("all October additions have explicit historical-user initialization", () => {
  const source = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const initializer = source.match(/const CONTENT_ADDED_SENSE_KEYS = new Set\(\[([\s\S]*?)\]\);/);
  expect(initializer).not.toBeNull();
  const keys = new Set([...initializer[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  expect(manifest.compatibility.addedSenseKeys.filter((key) => !keys.has(key))).toEqual([]);
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`approved new sense is interactive without resetting mastered history at width ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript((storageKey) => {
      localStorage.clear();
      localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
      localStorage.setItem(storageKey, JSON.stringify({
        dataVersion: 10, view: "home", activeBookId: "kaoyan",
        plan: { dailyTarget: 1, startedOn: "2026-08-01", createdOn: "2026-08-01", updatedOn: "2026-08-01" },
        introducedWords: ["remedy"], progress: { "remedy:n-1": { status: "mastered" } },
        activityLog: {}, studyWindows: [], learningDayCounter: 1,
      }));
    }, STORAGE_KEY);
    await page.goto(APP_URL);
    await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
    await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
    await page.locator("#startStudyButton").click();
    await expect(page.locator("#wordText")).toHaveText("remedy");
    await page.locator("#revealButton").click();
    await expect(page.locator('[data-key="remedy:n-1"]')).toBeDisabled();
    await expect(page.locator('[data-key="remedy:n-2"]')).toBeEnabled();
    await page.locator('[data-key="remedy:n-2"]').click();
    await expect.poll(async () => page.evaluate(() => {
      const saved = window.SenseVocabApp.getGuestState();
      return (saved.bookStates?.kaoyan ?? saved).progress["remedy:n-2"].status;
    })).toBe("mastered");
    const saved = await page.evaluate(() => window.SenseVocabApp.getGuestState());
    const active = saved.bookStates?.kaoyan ?? saved;
    expect(active.progress["remedy:n-1"].status).toBe("mastered");
    expect(active.progress["remedy:n-2"].status).toBe("mastered");
    expect(active.introducedWords.filter((id) => id === "remedy")).toHaveLength(1);
  });
}
