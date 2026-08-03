const { test, expect } = require("@playwright/test");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({});

function baseState() {
  return {
    view: "home",
    plan: null,
    session: null,
    introducedWords: [],
    progress: {},
    activityLog: {},
    studyWindows: [],
    confusionLinks: {},
    learningDayCounter: 0,
    wordListSort: "mastery",
    wordBrowse: null,
    dataVersion: 8,
  };
}

async function loadSyncEngine(page) {
  await page.goto(APP_URL);
  await page.waitForFunction(() => Boolean(window.SenseVocabSync));
}

test("independent device changes merge without losing either branch", async ({ page }) => {
  await loadSyncEngine(page);
  const result = await page.evaluate((base) => {
    const sync = window.SenseVocabSync;
    const left = structuredClone(base);
    const right = structuredClone(base);
    left.progress["abandon::0"] = {
      status: "reinforce",
      misses: 1,
      lastSeen: "2026-07-28",
    };
    right.progress["ability::0"] = {
      status: "review",
      misses: 0,
      lastSeen: "2026-07-28",
    };
    sync.stampChanges(left, base, "device-a");
    sync.stampChanges(right, base, "device-b");
    const merged = sync.mergeStates(left, right);
    const reverse = sync.mergeStates(right, left);
    return {
      keys: Object.keys(merged.progress).sort(),
      reverseKeys: Object.keys(reverse.progress).sort(),
      leftStatus: merged.progress["abandon::0"].status,
      rightStatus: merged.progress["ability::0"].status,
    };
  }, baseState());

  expect(result.keys).toEqual(["abandon::0", "ability::0"]);
  expect(result.reverseKeys).toEqual(result.keys);
  expect(result.leftStatus).toBe("reinforce");
  expect(result.rightStatus).toBe("review");
});

test("concurrent disagreement on one sense keeps the safer learning state", async ({ page }) => {
  await loadSyncEngine(page);
  const result = await page.evaluate((base) => {
    const sync = window.SenseVocabSync;
    const left = structuredClone(base);
    const right = structuredClone(base);
    left.progress["abandon::0"] = {
      status: "mastered",
      misses: 0,
      firstSeen: "2026-07-27",
      lastSeen: "2026-07-28",
      masteredOn: "2026-07-28",
    };
    right.progress["abandon::0"] = {
      status: "reinforce",
      misses: 1,
      firstSeen: "2026-07-27",
      lastSeen: "2026-07-28",
      dueDate: "2026-07-29",
    };
    sync.stampChanges(left, base, "device-a");
    sync.stampChanges(right, base, "device-b");
    return sync.mergeStates(left, right).progress["abandon::0"];
  }, baseState());

  expect(result.status).toBe("reinforce");
  expect(result.masteredOn).toBeNull();
  expect(result.misses).toBe(1);
});

test("a concurrent explicit reset is not revived by stale progress", async ({ page }) => {
  await loadSyncEngine(page);
  const result = await page.evaluate((empty) => {
    const sync = window.SenseVocabSync;
    const base = structuredClone(empty);
    base.introducedWords = ["abandon"];
    base.progress["abandon::0"] = {
      status: "review",
      misses: 1,
      lastSeen: "2026-07-27",
    };
    sync.stampChanges(base, empty, "seed");

    const reset = structuredClone(base);
    reset.introducedWords = [];
    delete reset.progress["abandon::0"];
    sync.stampChanges(reset, base, "device-a");

    const learned = structuredClone(base);
    learned.progress["abandon::0"] = {
      status: "mastered",
      misses: 1,
      lastSeen: "2026-07-28",
      masteredOn: "2026-07-28",
    };
    sync.stampChanges(learned, base, "device-b");

    const merged = sync.mergeStates(reset, learned);
    return {
      introduced: merged.introducedWords,
      progress: merged.progress,
      progressRecord: merged._sync.records.progress["abandon::0"],
    };
  }, baseState());

  expect(result.introduced).toEqual([]);
  expect(result.progress["abandon::0"]).toBeUndefined();
  expect(result.progressRecord.deleted).toBe(true);
});

test("same-day activity from two devices is unioned and counted once", async ({ page }) => {
  await loadSyncEngine(page);
  const result = await page.evaluate((base) => {
    const sync = window.SenseVocabSync;
    const left = structuredClone(base);
    const right = structuredClone(base);
    left.activityLog["2026-07-28"] = {
      newWords: ["abandon"],
      reviewWords: ["bank"],
      newCount: 1,
      reviewCount: 1,
      target: 40,
      learningDays: [1],
    };
    right.activityLog["2026-07-28"] = {
      newWords: ["ability"],
      reviewWords: ["bank", "cut"],
      newCount: 1,
      reviewCount: 2,
      target: 40,
      learningDays: [1],
    };
    sync.stampChanges(left, base, "device-a");
    sync.stampChanges(right, base, "device-b");
    return sync.mergeStates(left, right).activityLog["2026-07-28"];
  }, baseState());

  expect(result.newWords.sort()).toEqual(["abandon", "ability"]);
  expect(result.reviewWords.sort()).toEqual(["bank", "cut"]);
  expect(result.newCount).toBe(2);
  expect(result.reviewCount).toBe(2);
});

test("independent book changes merge into their own progress scopes", async ({ page }) => {
  await loadSyncEngine(page);
  const result = await page.evaluate((scope) => {
    const sync = window.SenseVocabSync;
    const base = {
      schemaVersion: 2,
      activeBookId: "kaoyan",
      bookStates: {
        kaoyan: structuredClone(scope),
        ielts: structuredClone(scope),
      },
    };
    const left = structuredClone(base);
    const right = structuredClone(base);

    left.bookStates.kaoyan.introducedWords = ["act"];
    left.bookStates.kaoyan.activityLog["2026-07-28"] = {
      newWords: ["act"],
      reviewWords: [],
      newCount: 1,
      reviewCount: 0,
      target: 40,
      learningDays: [1],
    };
    right.activeBookId = "ielts";
    right.bookStates.ielts.introducedWords = ["academic"];
    right.bookStates.ielts.activityLog["2026-07-28"] = {
      newWords: ["academic"],
      reviewWords: [],
      newCount: 1,
      reviewCount: 0,
      target: 30,
      learningDays: [1],
    };

    sync.stampChanges(left, base, "device-a");
    sync.stampChanges(right, base, "device-b");
    return sync.mergeStates(left, right);
  }, baseState());

  expect(result.bookStates.kaoyan.introducedWords).toEqual(["act"]);
  expect(result.bookStates.ielts.introducedWords).toEqual(["academic"]);
  expect(result.bookStates.kaoyan.activityLog["2026-07-28"].newWords)
    .toEqual(["act"]);
  expect(result.bookStates.ielts.activityLog["2026-07-28"].newWords)
    .toEqual(["academic"]);
});

test("confusing-word links merge per pair without creating transitive relations", async ({ page }) => {
  await loadSyncEngine(page);
  const result = await page.evaluate((base) => {
    const sync = window.SenseVocabSync;
    const left = structuredClone(base);
    const right = structuredClone(base);
    left.confusionLinks["ability|act"] = {
      left: "ability",
      right: "act",
      createdAt: "2026-08-03T10:00:00.000Z",
    };
    right.confusionLinks["abandon|act"] = {
      left: "abandon",
      right: "act",
      createdAt: "2026-08-03T10:01:00.000Z",
    };

    sync.stampChanges(left, base, "device-a");
    sync.stampChanges(right, base, "device-b");
    const merged = sync.mergeStates(left, right);
    const reverse = sync.mergeStates(right, left);
    return {
      keys: Object.keys(merged.confusionLinks).sort(),
      reverseKeys: Object.keys(reverse.confusionLinks).sort(),
    };
  }, baseState());

  expect(result.keys).toEqual(["abandon|act", "ability|act"]);
  expect(result.reverseKeys).toEqual(result.keys);
  expect(result.keys).not.toContain("abandon|ability");
});
