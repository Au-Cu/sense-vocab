const { test, expect } = require("@playwright/test");
const bundle = require("../data/vocabulary-bundle.json");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const entries = bundle.books.find((book) => book.id === "kaoyan").entries.slice(0, 4);

test.use({ launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } });

async function restoreRound(page, scenario = "first-stage") {
  await page.addInitScript(({ entries, scenario }) => {
    if (localStorage.getItem("sense-vocab-mvp-kaoyan-plan-v1")) return;
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Hong_Kong" });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE", { timeZone: "Asia/Hong_Kong" });
    const keys = (entry) => entry.senseIds.map((id) => `${entry.wordId}:${id}`);
    const card = (entry, type) => ({
      wordId: entry.wordId, type, senseKeys: keys(entry), activeSenseKeys: keys(entry),
      newSenseKeys: type === "new" ? keys(entry) : [], confirmedKeys: [], expandedMasteredKeys: [],
    });
    const finishedLegacy = scenario.startsWith("legacy-finished-");
    const completedNew = finishedLegacy || ["reinforcement", "legacy-reset", "missing-queue", "older-due", "mixed-review"].includes(scenario) ? 2 : 1;
    const progress = Object.fromEntries(entries.slice(0, completedNew + 1).flatMap((entry, index) => (
      keys(entry).map((key) => [key, {
        status: index === 0 ? "reinforce" : "mastered", dueLearningDay: index === 0 ? 8 : null,
        lastLearningDay: 8, firstSeenActual: index === 0 ? yesterday : today, lastSeenActual: today,
        statusEnteredAt: `${today}T08:00:00+08:00`, updatedAt: `${today}T08:00:00+08:00`,
      }])
    )));
    const queue = [card(entries[0], "review"), card(entries[1], "new"), card(entries[2], "new")];
    let currentIndex = 2;
    if (scenario === "reinforcement") {
      queue.push(card(entries[0], "reinforcement"));
      currentIndex = 3;
    } else if (["legacy-reset", "older-due", "mixed-review"].includes(scenario)) {
      queue.splice(0, queue.length, card(entries[0], "review"));
      currentIndex = 0;
    } else if (["pending-next", "pending-next-hidden"].includes(scenario)) {
      keys(entries[2]).forEach((key) => {
        progress[key] = { ...progress[keys(entries[1])[0]], status: "mastered" };
      });
      if (scenario === "pending-next") queue[2].confirmedKeys = keys(entries[2]);
    }
    if (scenario === "older-due") {
      keys(entries[0]).forEach((key) => { progress[key].lastSeenActual = yesterday; });
    } else if (scenario === "mixed-review") {
      keys(entries[0]).slice(1).forEach((key) => {
        Object.assign(progress[key], { status: "review", lastSeenActual: yesterday, lastLearningDay: 7 });
      });
    }
    if (finishedLegacy) {
      currentIndex = 0;
      Object.values(progress).forEach((record) => {
        record.status = scenario === "legacy-finished-review" ? "review" : "mastered";
        record.dueLearningDay = 9;
      });
      if (scenario === "legacy-finished-reinforcement") {
        keys(entries[0]).forEach((key) => { progress[key].status = "reinforce"; });
        queue.splice(0, queue.length, card(entries[0], "reinforcement"));
      }
    }
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({
      dataVersion: 8, plan: { dailyTarget: 2, startedOn: today }, learningDayCounter: 8,
      introducedWords: entries.slice(0, completedNew + 1).map((entry) => entry.wordId),
      progress, studyWindows: [], dashboardEvents: {}, dashboardSnapshots: {},
      activityLog: { [today]: {
        newWords: entries.slice(1, completedNew + 1).map((entry) => entry.wordId), newCount: completedNew,
        reviewWords: scenario === "older-due" ? [] : [entries[0].wordId],
        reviewCount: scenario === "older-due" ? 0 : 1, target: 2, learningDays: [8],
      } },
      session: scenario === "missing-queue" ? null : {
        date: today, activePlanDate: today, activeBatchType: "planned", baseNewAdded: true,
        baseCompleted: false, activeLearningDay: 8, baseLearningDay: 8,
        queue, currentIndex, historyView: null, reinforcedKeys: [], reviewPromotedKeys: [],
        revealed: scenario === "pending-next", cardPhase: scenario === "pending-next" ? "examples" : "hidden",
        reinforcementAdded: scenario === "reinforcement", snapshotTimingVersion: 2,
      },
    }));
  }, { entries, scenario });
  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.accountReady === "true");
}

async function session(page) {
  return page.evaluate(() => window.SenseVocabApp.getState().session);
}

test("merging a study-window update does not rewind the completed first stage", async ({ page }) => {
  await restoreRound(page);
  const before = await session(page);
  const merged = await page.evaluate(() => {
    const local = window.SenseVocabApp.getState();
    const remote = structuredClone(local);
    const scope = remote.bookStates[remote.activeBookId];
    scope.studyWindows.push({
      id: "peer-window", activityDate: scope.session.date,
      startedAt: `${scope.session.date}T08:00:00+08:00`,
      endedAt: `${scope.session.date}T08:01:00+08:00`, endedReason: "return-home",
    });
    remote.studyWindows = scope.studyWindows;
    const result = window.SenseVocabApp.mergeStates(local, remote);
    return result.bookStates[result.activeBookId].session;
  });
  expect(merged.currentIndex).toBe(before.currentIndex);
  expect(merged.queue.map((card) => [card.type, card.wordId]))
    .toEqual(before.queue.map((card) => [card.type, card.wordId]));
});

test("redrawing statistics preserves the reinforcement stage and completed prefix", async ({ page }) => {
  await restoreRound(page, "reinforcement");
  const before = await session(page);
  await page.evaluate(() => window.SenseVocabApp.repairDerivedData());
  const repaired = await session(page);
  expect(repaired.currentIndex).toBe(before.currentIndex);
  expect(repaired.reinforcementAdded).toBe(true);
  expect(repaired.queue.map((card) => [card.type, card.wordId]))
    .toEqual(before.queue.map((card) => [card.type, card.wordId]));
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(entries[0].wordId);
  expect((await session(page)).queue[(await session(page)).currentIndex].type).toBe("reinforcement");
});

test("a legacy rewound queue resumes reinforcement instead of repeating today's review", async ({ page }) => {
  await restoreRound(page, "legacy-reset");
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(entries[0].wordId);
  const restored = await session(page);
  expect(restored.queue[restored.currentIndex].type).toBe("reinforcement");
  expect(restored.queue.filter((card) => card.type === "review")).toHaveLength(0);
  expect(restored.activeLearningDay).toBe(8);
});

test("repairing an all-familiar current card still waits for the user's next tap", async ({ page }) => {
  await restoreRound(page, "pending-next");
  const before = await session(page);
  await page.evaluate(() => window.SenseVocabApp.repairDerivedData());
  const repaired = await session(page);
  expect(repaired.currentIndex).toBe(before.currentIndex);
  expect(repaired.queue[repaired.currentIndex]).toMatchObject(before.queue[before.currentIndex]);
  expect(repaired.cardPhase).toBe("examples");
});

test("leaving from lookback resumes the real current word instead of the historical word", async ({ page }) => {
  await restoreRound(page);
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(entries[2].wordId);
  await page.locator("#exitStudyButton").click();
  await page.locator("#previousWordButton").click();
  await expect(page.locator("#wordText")).toHaveText(entries[1].wordId);
  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(entries[2].wordId);
  expect((await session(page)).currentIndex).toBe(2);
});

test("a missing queue restores today's reinforcement without another initial review", async ({ page }) => {
  await restoreRound(page, "missing-queue");
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(entries[0].wordId);
  const restored = await session(page);
  expect(restored.queue).toHaveLength(1);
  expect(restored.queue[0].type).toBe("reinforcement");
  expect(restored.activeLearningDay).toBe(8);
});

test("finishing the first stage, exiting, and reloading keeps the reinforcement continuation", async ({ page }) => {
  await restoreRound(page);
  await page.locator("#startStudyButton").click();
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
  await page.locator("#nextButton").click();
  await expect(page.locator("#nextButton")).toHaveText("下一词");
  await page.locator("#nextButton").click();
  await expect.poll(async () => (await session(page)).currentIndex).toBe(3);
  const before = await session(page);
  expect(before.queue[3].type).toBe("reinforcement");
  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.SenseVocabApp.isActiveStatePersisted())).toBe(true);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.accountReady === "true");
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(before.queue[3].wordId);
  const after = await session(page);
  expect(after.currentIndex).toBe(3);
  expect(after.queue[after.currentIndex].type).toBe("reinforcement");
});

test("imported completion removes future work without erasing the completed prefix", async ({ page }) => {
  await restoreRound(page);
  const merged = await page.evaluate(() => {
    const local = window.SenseVocabApp.getState();
    const remote = structuredClone(local);
    const scope = remote.bookStates[remote.activeBookId];
    const pending = scope.session.queue[scope.session.currentIndex];
    pending.activeSenseKeys.forEach((key) => {
      scope.progress[key] = {
        status: "mastered", firstSeenActual: scope.session.date, lastSeenActual: scope.session.date,
        lastLearningDay: 8, updatedAt: `${scope.session.date}T10:00:00+08:00`,
      };
    });
    scope.introducedWords.push(pending.wordId);
    scope.activityLog[scope.session.date].newWords.push(pending.wordId);
    scope.activityLog[scope.session.date].newCount = 2;
    remote.progress = scope.progress;
    remote.introducedWords = scope.introducedWords;
    remote.activityLog = scope.activityLog;
    return window.SenseVocabApp.mergeStates(local, remote).bookStates[remote.activeBookId];
  });
  expect(merged.session.currentIndex).toBe(2);
  expect(merged.session.queue.slice(0, 2).map((card) => card.wordId))
    .toEqual(entries.slice(0, 2).map((entry) => entry.wordId));
  expect(merged.session.queue.slice(2).map((card) => [card.type, card.wordId]))
    .toEqual([["reinforcement", entries[0].wordId]]);
  expect(merged.activityLog[merged.session.date].newCount).toBe(2);
});

test("a matching learning-day number from an older date does not skip due review", async ({ page }) => {
  await restoreRound(page, "older-due");
  await page.locator("#startStudyButton").click();
  const restored = await session(page);
  expect(restored.queue[restored.currentIndex].type).toBe("review");
});

test("mixed senses retain unfinished review without repeating the processed senses", async ({ page }) => {
  await restoreRound(page, "mixed-review");
  await page.locator("#startStudyButton").click();
  const restored = await session(page);
  expect(restored.queue[restored.currentIndex]).toMatchObject({
    type: "review", wordId: entries[0].wordId,
    activeSenseKeys: entries[0].senseIds.slice(1).map((id) => `${entries[0].wordId}:${id}`),
  });
});

test("a fulfilled merged quota does not discard the current pending-next word", async ({ page }) => {
  await restoreRound(page, "pending-next");
  const merged = await page.evaluate((extra) => {
    const local = window.SenseVocabApp.getState();
    const remote = structuredClone(local);
    const scope = remote.bookStates[remote.activeBookId];
    extra.senseIds.forEach((id) => {
      scope.progress[`${extra.wordId}:${id}`] = {
        status: "mastered", firstSeenActual: scope.session.date, lastSeenActual: scope.session.date,
        lastLearningDay: 8, updatedAt: `${scope.session.date}T10:00:00+08:00`,
      };
    });
    scope.introducedWords.push(extra.wordId);
    scope.activityLog[scope.session.date].newWords.push(extra.wordId);
    scope.activityLog[scope.session.date].newCount = 2;
    remote.progress = scope.progress;
    remote.introducedWords = scope.introducedWords;
    remote.activityLog = scope.activityLog;
    return window.SenseVocabApp.mergeStates(local, remote).bookStates[remote.activeBookId].session;
  }, entries[3]);
  expect(merged.currentIndex).toBe(2);
  expect(merged.queue[merged.currentIndex]).toMatchObject({ type: "new", wordId: entries[2].wordId });
  expect(merged.cardPhase).toBe("examples");
});

for (const lookback of [false, true]) {
test(`reconciling a malformed preceding card remaps the ${lookback ? "lookback origin" : "current cursor"}`, async ({ page }) => {
  await restoreRound(page);
  const result = await page.evaluate((lookback) => {
    const local = window.SenseVocabApp.getState();
    const scope = local.bookStates[local.activeBookId];
    scope.session.queue.splice(1, 0, null);
    scope.session.currentIndex = lookback ? 0 : 3;
    scope.session.historyView = lookback ? { originIndex: 3, originPhase: "hidden", originRevealed: false } : null;
    local.session = scope.session;
    const remote = structuredClone(local);
    remote.bookStates[remote.activeBookId].studyWindows.push({
      id: "legacy-window", activityDate: scope.session.date,
      startedAt: `${scope.session.date}T08:00:00+08:00`,
      endedAt: `${scope.session.date}T08:01:00+08:00`, endedReason: "return-home",
    });
    remote.studyWindows = remote.bookStates[remote.activeBookId].studyWindows;
    const merged = window.SenseVocabApp.mergeStates(local, remote);
    window.SenseVocabApp.replaceActiveState(merged, { notify: false, stampSync: false });
    return window.SenseVocabApp.getState().session;
  }, lookback);
  expect(result.queue).toHaveLength(3);
  expect(result.currentIndex).toBe(lookback ? 0 : 2);
  if (lookback) expect(result.historyView.originIndex).toBe(2);
  expect(result.queue[lookback ? result.historyView.originIndex : result.currentIndex].wordId)
    .toBe(entries[2].wordId);
});
}

for (const status of ["mastered", "review", "reinforcement"]) {
test(`a legacy finished ${status} queue does not repeat completed learning`, async ({ page }) => {
  await restoreRound(page, `legacy-finished-${status}`);
  const restored = await session(page);
  expect(restored.baseCompleted).toBe(true);
  expect(restored.currentIndex).toBe(restored.queue.length);
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(entries[3].wordId);
  expect((await session(page)).activeBatchType).toBe("extra");
});
}

test("an unrevealed unintroduced current word still waits for next acknowledgement", async ({ page }) => {
  await restoreRound(page, "pending-next-hidden");
  await page.evaluate(() => window.SenseVocabApp.repairDerivedData());
  const result = await page.evaluate(() => window.SenseVocabApp.getState());
  expect(result.session.currentIndex).toBe(2);
  expect(result.session.queue[2]).toMatchObject({ type: "new", wordId: entries[2].wordId });
  expect(result.introducedWords).not.toContain(entries[2].wordId);
});
