const { test, expect } = require("@playwright/test");
const bundle = require("../data/vocabulary-bundle.json");
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const cards = bundle.books.find((book) => book.id === "kaoyan").entries.slice(0, 2).map((entry) => ({
  wordId: entry.wordId, type: "new", senseKeys: entry.senseIds.map((id) => `${entry.wordId}:${id}`),
}));

test.use({ launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } });

async function restore(page, queue, currentIndex, historyView = null) {
  await page.addInitScript(({ key, queue, currentIndex, historyView }) => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Hong_Kong" });
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
    localStorage.setItem(key, JSON.stringify({
      dataVersion: 8, plan: { dailyTarget: 2, startedOn: today },
      progress: {}, introducedWords: [], activityLog: {}, studyWindows: [], learningDayCounter: 1,
      session: { date: today, activePlanDate: today, activeBatchType: "planned", baseNewAdded: true,
        activeLearningDay: 1, baseLearningDay: 1, queue, currentIndex, historyView,
        revealed: false, cardPhase: "hidden", reinforcementAdded: false },
    }));
  }, { key: STORAGE_KEY, queue, currentIndex, historyView });
  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.accountReady === "true");
  return page.evaluate(() => window.SenseVocabApp.getState().session);
}

test("removing an invalid preceding card preserves the active unfinished card", async ({ page }) => {
  const queue = [{ ...cards[0], wordId: "unknown-legacy-word" }, cards[1]];
  const session = await restore(page, queue, 1);
  expect(session.queue).toHaveLength(1);
  expect(session.currentIndex).toBe(0);
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(cards[1].wordId);
});

for (const [cursor, expected] of [[0.5, 0], ["invalid", 0], [-2, 0], ["1", 1]]) {
  test(`a recovered cursor ${JSON.stringify(cursor)} selects a real card`, async ({ page }) => {
    const session = await restore(page, cards, cursor);
    expect(session.currentIndex).toBe(expected);
    await page.locator("#startStudyButton").click();
    await expect(page.locator("#wordText")).toHaveText(cards[expected].wordId);
  });
}

test("filtering a historical queue preserves its return-to-current position", async ({ page }) => {
  const queue = [cards[0], { ...cards[0], wordId: "unknown-legacy-word" }, cards[1]];
  const session = await restore(page, queue, 0, { originIndex: 2, originPhase: "hidden", editable: false });
  expect(session.currentIndex).toBe(0);
  expect(session.historyView.originIndex).toBe(1);
  expect(session.queue[session.historyView.originIndex].wordId).toBe(cards[1].wordId);
});

test("an unchanged membership refresh preserves the current sense interaction", async ({ page }) => {
  await restore(page, cards, 0);
  await page.locator("#startStudyButton").click();
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
  const retained = await page.evaluate(() => {
    const detail = { loggedIn: false, active: true, pending: false, expiresAt: null };
    window.dispatchEvent(new CustomEvent("sensevocab:membership", { detail }));
    const button = document.querySelector("#studyPanel #senseList .sense-item");
    window.dispatchEvent(new CustomEvent("sensevocab:membership", { detail }));
    return Boolean(button && button.isConnected &&
      button === document.querySelector("#studyPanel #senseList .sense-item"));
  });
  expect(retained).toBe(true);
});

for (const scenario of ["expired plan date", "missing queue", "unfinished recorded word"]) {
test(`a recovered ${scenario} preserves today's recorded quota and learning day`, async ({ page }) => {
  const entries = bundle.books.find((book) => book.id === "kaoyan").entries.slice(0, 3);
  const pendingEntry = bundle.books.find((book) => book.id === "kaoyan").entries[3];
  await page.addInitScript(({ entries, pendingEntry, scenario }) => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Hong_Kong" });
    const recordedWords = entries.map((entry) => entry.wordId);
    if (scenario === "unfinished recorded word") recordedWords.push(pendingEntry.wordId);
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({ dataVersion: 8,
      plan: { dailyTarget: 5, startedOn: today }, learningDayCounter: 8,
      introducedWords: entries.map((entry) => entry.wordId), studyWindows: [],
      progress: Object.fromEntries(entries.flatMap((entry) => entry.senseIds.map((id) => [
        `${entry.wordId}:${id}`, { status: "mastered", firstSeenActual: today, lastSeenActual: today, lastLearningDay: 8 },
      ]))),
      activityLog: { [today]: { newWords: recordedWords, newCount: recordedWords.length,
        reviewWords: [], reviewCount: 0, target: 5, learningDays: [8] } },
      session: scenario === "expired plan date" ? { date: today, activePlanDate: "2000-01-01", activeBatchType: "planned", baseNewAdded: true,
        activeLearningDay: 8, baseLearningDay: 8, currentIndex: 0, cardPhase: "hidden",
        queue: [{ wordId: entries[0].wordId, type: "new", senseKeys: entries[0].senseIds.map((id) => `${entries[0].wordId}:${id}`) }] } : null,
    }));
  }, { entries, pendingEntry, scenario });
  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.accountReady === "true");
  await page.locator("#startStudyButton").click();
  const result = await page.evaluate(() => {
    const state = window.SenseVocabApp.getState();
    return { newCards: state.session.queue.filter((card) => card.type === "new").length,
      learningDay: state.session.activeLearningDay,
      newWords: state.session.queue.filter((card) => card.type === "new").map((card) => card.wordId),
      recordedNew: state.activityLog[state.session.date].newCount };
  });
  expect(result).toMatchObject({ newCards: 2, learningDay: 8,
    recordedNew: scenario === "unfinished recorded word" ? 4 : 3 });
  expect(result.newWords).toContain(pendingEntry.wordId);
});
}

for (const pendingReview of [false, true]) {
test(`a missing completed queue ${pendingReview ? "retains due review" : "offers incremental learning"}`, async ({ page }) => {
  const entries = bundle.books.find((book) => book.id === "kaoyan").entries.slice(0, 3);
  await page.addInitScript(({ entries, pendingReview }) => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Hong_Kong" });
    const progress = Object.fromEntries(entries.flatMap((entry) => entry.senseIds.map((id) => [
      `${entry.wordId}:${id}`, { status: "mastered", firstSeenActual: today, lastSeenActual: today, lastLearningDay: 8 },
    ])));
    if (pendingReview) progress[`${entries[0].wordId}:${entries[0].senseIds[0]}`] = {
      ...progress[`${entries[0].wordId}:${entries[0].senseIds[0]}`], status: "review", dueLearningDay: 8,
    };
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({ dataVersion: 8,
      plan: { dailyTarget: 3, startedOn: today }, learningDayCounter: 8,
      introducedWords: entries.map((entry) => entry.wordId), studyWindows: [], progress,
      activityLog: { [today]: { newWords: entries.map((entry) => entry.wordId), newCount: 3,
        reviewWords: [], reviewCount: 0, target: 3, learningDays: [8], baseCompleted: true } },
      session: null,
    }));
  }, { entries, pendingReview });
  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.accountReady === "true");
  expect(await page.evaluate(() => window.SenseVocabApp.getState().session.baseCompleted)).toBe(!pendingReview);
  await page.locator("#startStudyButton").click();
  const session = await page.evaluate(() => window.SenseVocabApp.getState().session);
  expect(session.activeLearningDay).toBe(8);
  expect(session.activeBatchType).toBe(pendingReview ? "planned" : "extra");
  expect(session.queue).toHaveLength(pendingReview ? 1 : 3);
  expect(session.queue[0].type).toBe(pendingReview ? "review" : "extra");
});
}
