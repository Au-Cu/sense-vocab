const { test, expect } = require("@playwright/test");
const wordData = require("../data/kaoyan-words.json");

const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1100, height: 850 },
});

async function reveal(page) {
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
}

async function completeAndAdvance(page) {
  const button = page.locator("#nextButton");
  if ((await button.textContent()) !== "下一词") {
    await button.click();
    await expect(button).toHaveText("下一词");
  }
  await button.click();
}

async function readState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

async function confirmEveryVisibleSense(page) {
  const actionable = page.locator(".sense-item:not(:disabled):not(.is-collapsible)");
  while (await actionable.count()) {
    await actionable.first().click();
    await page.waitForTimeout(450);
  }
}

async function setStudyDate(page, date) {
  await page.evaluate((value) => localStorage.setItem("sense-vocab-test-date", value), date);
  await page.reload();
}

test("sense states follow new, reinforcement, review, and double-check mastery", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super(localStorage.getItem("sense-vocab-test-date") || "2026-07-16T12:00:00Z");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
  });

  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText("act");
  await expect(page.locator("#reviewCount")).toHaveText("0/0");
  await expect(page.locator("#newCount")).toHaveText("0/4");
  await expect(page.locator("#learningCount")).toHaveText("0/0");
  await expect(page.locator("#queueProgress")).toHaveText("1 / 1");

  // Day 1: one sense is familiar immediately; the other three need reinforcement.
  await reveal(page);
  await page.locator('[data-key="act:v-1"]').click();
  await expect(page.locator("#newCount")).toHaveText("1/4");
  await completeAndAdvance(page);
  await expect(page.locator("#cardMode")).toHaveText("强化");
  await expect(page.locator("#wordText")).toHaveText("act");
  await expect(page.locator("#queueProgress")).toHaveText("1 / 1");
  await expect(page.locator("#newCount")).toHaveText("4/4");
  await expect(page.locator("#learningCount")).toHaveText("0/3");

  // One reinforcement confirmation becomes pending review; two misses stay pending reinforcement.
  await reveal(page);
  await page.locator('[data-key="act:v-2"]').click();
  await completeAndAdvance(page);
  let state = await readState(page);
  expect(state.progress["act:v-1"].status).toBe("mastered");
  expect(state.progress["act:v-2"].status).toBe("review");
  expect(state.progress["act:n-3"].status).toBe("reinforce");
  expect(state.progress["act:n-4"].status).toBe("reinforce");

  // Keep the next days focused on review by marking the full word list as introduced.
  await page.evaluate(async (key) => {
    const entries = await fetch("./data/kaoyan-words.json", { cache: "no-store" }).then((response) => response.json());
    const saved = JSON.parse(localStorage.getItem(key));
    saved.introducedWords = entries.map((entry) => entry.id);
    localStorage.setItem(key, JSON.stringify(saved));
  }, STORAGE_KEY);

  // Day 2 morning: review + familiar => mastered; reinforce + familiar => review;
  // an unconfirmed sense remains reinforce and must appear again at the end of the day.
  await setStudyDate(page, "2026-07-17T12:00:00Z");
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("复习");
  await expect(page.locator("#queueProgress")).toHaveText("1 / 1");
  await reveal(page);
  await expect(page.locator('[data-key="act:v-1"]')).toHaveClass(/is-mastered/);
  await expect(page.locator(".sense-item").last()).toHaveAttribute("data-key", "act:v-1");
  await expect(page.locator('[data-key="act:v-2"]')).not.toHaveClass(/is-mastered|is-confirmed/);
  await page.locator('[data-key="act:v-2"]').click();
  await page.locator('[data-key="act:n-3"]').click();
  await completeAndAdvance(page);
  await expect(page.locator("#cardMode")).toHaveText("强化");
  await reveal(page);
  await expect(page.locator('.sense-item[data-key="act:n-4"]')).toBeVisible();
  await page.locator('[data-key="act:n-4"]').click();
  await completeAndAdvance(page);

  state = await readState(page);
  expect(state.progress["act:v-2"].status).toBe("mastered");
  expect(state.progress["act:n-3"].status).toBe("review");
  expect(state.progress["act:n-4"].status).toBe("review");

  // Day 3: both pending-review senses need one more confirmation before leaving the pool.
  await setStudyDate(page, "2026-07-18T12:00:00Z");
  await page.locator("#startStudyButton").click();
  await reveal(page);
  await page.locator('[data-key="act:n-3"]').click();
  await page.locator('[data-key="act:n-4"]').click();
  await completeAndAdvance(page);

  state = await readState(page);
  expect(state.progress["act:n-3"].status).toBe("mastered");
  expect(state.progress["act:n-4"].status).toBe("mastered");
  expect(Object.values(state.progress).filter((item) => item.status !== "mastered")).toEqual([]);
});

test("legacy learning progress migrates to pending reinforcement", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({
      view: "home",
      plan: {
        dailyTarget: 1,
        startedOn: "2026-07-01",
        createdOn: "2026-07-01",
        updatedOn: "2026-07-01",
      },
      session: null,
      introducedWords: ["act"],
      progress: {
        "act:v-1": {
          status: "learning",
          misses: 1,
          dueDate: "2000-01-01",
          firstSeen: "2026-07-01",
          lastSeen: "2026-07-01",
          masteredOn: null,
        },
      },
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await expect(page.locator("#startStudyButton")).toBeEnabled();
  const state = await readState(page);
  expect(state.progress["act:v-1"].status).toBe("reinforce");
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("复习");
  await expect(page.locator("#wordText")).toHaveText("act");
});

test("home shows all three parts of today's plan without duplicate totals", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({
      view: "home",
      plan: {
        dailyTarget: 1,
        startedOn: "2026-07-01",
        createdOn: "2026-07-01",
        updatedOn: "2026-07-01",
      },
      session: null,
      introducedWords: ["act"],
      progress: {
        "act:v-1": {
          status: "reinforce",
          misses: 1,
          dueDate: "2000-01-01",
          firstSeen: "2026-07-01",
          lastSeen: "2026-07-01",
          masteredOn: null,
        },
        "act:v-2": {
          status: "review",
          misses: 0,
          dueDate: "2000-01-01",
          firstSeen: "2026-07-01",
          lastSeen: "2026-07-01",
          masteredOn: null,
        },
        "act:n-3": {
          status: "reinforce",
          misses: 1,
          dueDate: "2000-01-01",
          firstSeen: "2026-07-01",
          lastSeen: "2026-07-01",
          masteredOn: null,
        },
        "act:n-4": {
          status: "review",
          misses: 0,
          dueDate: "2000-01-01",
          firstSeen: "2026-07-01",
          lastSeen: "2026-07-01",
          masteredOn: null,
        },
      },
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await expect(page.locator("#todayPlanHeading")).toHaveText("今日计划");
  await expect(page.locator("#todayNewCount")).toHaveText("1");
  await expect(page.locator("#todayReinforceCount")).toHaveText("1");
  await expect(page.locator("#todayReviewCount")).toHaveText("1");
  await expect(page.locator(".today-plan-item small")).toHaveText([
    "待新学单词",
    "待强化单词",
    "待复习单词",
  ]);
  await expect(page.locator("#homePlanMeta")).not.toContainText("剩余");
  await expect(page.locator("#homePlanMeta")).not.toContainText("预计");
});

test("advance runs the full next plan day while incremental only adds new words", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super("2026-07-16T12:00:00Z");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
  });

  const seedState = {
    view: "home",
    plan: {
      dailyTarget: 1,
      startedOn: "2026-07-16",
      createdOn: "2026-07-16",
      updatedOn: "2026-07-16",
      advancedDays: 0,
    },
    session: {
      date: "2026-07-16",
      queue: [],
      currentIndex: 0,
      revealed: false,
      cardPhase: "hidden",
      baseNewAdded: true,
      baseCompleted: true,
      activeBatchType: "planned",
      activePlanDate: "2026-07-16",
      extraBatches: 0,
      advanceBatches: 0,
      advanceShiftCommitted: false,
      reinforcementAdded: true,
      reinforcedKeys: [],
    },
    introducedWords: ["act"],
    progress: {
      "act:v-1": {
        status: "reinforce",
        misses: 1,
        dueDate: "2026-07-17",
        firstSeen: "2026-07-16",
        lastSeen: "2026-07-16",
        masteredOn: null,
      },
      "act:v-2": {
        status: "review",
        misses: 0,
        dueDate: "2026-07-17",
        firstSeen: "2026-07-16",
        lastSeen: "2026-07-16",
        masteredOn: null,
      },
    },
  };

  async function restoreSeed() {
    await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEY, value: seedState });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
    await page.waitForFunction((key) => {
      const saved = JSON.parse(localStorage.getItem(key));
      return saved?.introducedWords?.includes("act");
    }, STORAGE_KEY);
  }

  await page.goto(APP_URL);
  await restoreSeed();

  // Incremental learning must ignore words whose review is only due tomorrow.
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("增量");
  let saved = await readState(page);
  expect(saved.introducedWords).toContain("act");
  expect(saved.session.queue[0].wordId).not.toBe("act");
  await expect(page.locator("#wordText")).not.toHaveText("act");
  expect(saved.progress["act:v-1"].status).toBe("reinforce");
  expect(saved.progress["act:v-2"].status).toBe("review");

  await restoreSeed();

  // Advance learning must reproduce tomorrow's review -> new -> reinforcement flow.
  await page.locator("#advanceStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("复习");
  await expect(page.locator("#wordText")).toHaveText("act");
  await expect(page.locator("#studyDate")).toHaveCount(0);
  await expect(page.locator(".study-progress-row")).not.toContainText("实际日期");
  await reveal(page);
  await page.locator('[data-key="act:v-1"]').click();
  await page.locator('[data-key="act:v-2"]').click();
  await completeAndAdvance(page);

  await expect(page.locator("#cardMode")).toHaveText("提前");
  await expect(page.locator("#wordText")).not.toHaveText("act");
  const advancedWord = await page.locator("#wordText").textContent();
  await reveal(page);
  await completeAndAdvance(page);

  await expect(page.locator("#cardMode")).toHaveText("强化");
  await expect(page.locator("#wordText")).toHaveText(advancedWord);
  await reveal(page);
  await confirmEveryVisibleSense(page);
  await completeAndAdvance(page);
  await expect(page.locator("#cardMode")).toHaveText("提前学习完成");

  saved = await readState(page);
  expect(saved.session.activePlanDate).toBe("2026-07-17");
  expect(saved.plan.advancedDays).toBe(1);
  expect(saved.progress["act:v-1"].status).toBe("review");
  expect(saved.progress["act:v-1"].dueDate).toBe("2026-07-18");
  expect(saved.progress["act:v-2"].status).toBe("mastered");
});

test("advance learning shifts the remaining plan forward by one day", async ({ page }) => {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await expect(page.locator("#advanceStudyButton")).toBeHidden();

  await page.locator("#startStudyButton").click();
  await reveal(page);
  await confirmEveryVisibleSense(page);
  await completeAndAdvance(page);
  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();

  await expect(page.locator("#startStudyButton")).toHaveText("增量学习");
  await expect(page.locator("#advanceStudyButton")).toBeVisible();
  await expect(page.locator("#advanceStudyButton")).toHaveText("提前学习");
  await page.screenshot({ path: "test-results/advance-study-home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#advanceStudyButton")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/advance-study-home-mobile.png", fullPage: true });
  const completionBefore = await page.locator("#homeCompletionDate").textContent();

  await page.locator("#advanceStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("提前");
  await expect(page.locator("#wordText")).not.toHaveText("act");
  await reveal(page);
  await confirmEveryVisibleSense(page);
  await completeAndAdvance(page);
  await expect(page.locator("#cardMode")).toHaveText("提前学习完成");
  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();

  const completionAfter = await page.locator("#homeCompletionDate").textContent();
  const dayShift = Math.round((new Date(completionBefore) - new Date(completionAfter)) / 86400000);
  expect(dayShift).toBe(1);
  const state = await readState(page);
  expect(state.plan.advancedDays).toBe(1);
  expect(state.introducedWords.length).toBe(2);
  await expect(page.locator("#homePlanMeta")).toContainText("计划已提前 1 天");
  await expect(page.locator("#advanceStudyButton")).toHaveText("再提前一天");

  // Incremental learning remains a separate entry and does not change the advance counter.
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("增量");
  expect((await readState(page)).plan.advancedDays).toBe(1);
});

test("familiar senses move to the bottom and word-level resets restore the right snapshot", async ({ page }) => {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText("act");
  await reveal(page);

  const first = page.locator(".sense-item").first();
  const firstKey = await first.getAttribute("data-key");
  await first.click();
  await page.waitForTimeout(400);
  const movingCards = await page.locator(".sense-item").evaluateAll((items) => {
    return items.filter((item) => item.getAnimations().length > 0).length;
  });
  expect(movingCards).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: "test-results/familiar-sense-reordering.png", fullPage: true });
  await page.waitForTimeout(550);
  await expect(page.locator(`.sense-item[data-key="${firstKey}"]`)).toHaveClass(/is-mastered/);
  await expect(page.locator(".sense-item").last()).toHaveAttribute("data-key", firstKey);
  await expect(page.locator("#senseList")).not.toHaveClass(/is-reordering/);
  await page.screenshot({ path: "test-results/familiar-sense-bottom.png", fullPage: true });

  await page.locator("#resetButton").click();
  await page.locator("#resetMarkingButton").click();
  await expect(page.locator("#resetDialog")).toBeHidden();
  await expect(page.locator(`.sense-item[data-key="${firstKey}"]`)).not.toHaveClass(/is-mastered|is-confirmed/);
  let saved = await readState(page);
  expect(saved.progress[firstKey]).toBeUndefined();

  await page.locator(`.sense-item[data-key="${firstKey}"]`).click();
  await page.waitForTimeout(950);
  await completeAndAdvance(page);
  await expect(page.locator("#cardMode")).toHaveText("强化");
  await reveal(page);
  const reinforcementSense = page.locator(".sense-item:not(:disabled)").first();
  const reinforcementKey = await reinforcementSense.getAttribute("data-key");
  await reinforcementSense.click();
  await page.waitForTimeout(950);
  let reinforcementState = await readState(page);
  expect(reinforcementState.progress[reinforcementKey].status).toBe("review");

  // The snapshot belongs to this reinforcement encounter, not the start of the day.
  await page.locator("#resetButton").click();
  await page.locator("#resetMarkingButton").click();
  await expect(page.locator("#resetDialog")).toBeHidden();
  reinforcementState = await readState(page);
  expect(reinforcementState.progress[firstKey].status).toBe("mastered");
  expect(reinforcementState.progress[reinforcementKey].status).toBe("reinforce");

  await page.locator("#resetButton").click();
  await page.locator("#relearnWordButton").click();
  await expect(page.locator("#resetConfirmCopy")).toContainText("待新学状态");
  await page.locator("#confirmResetButton").click();
  await expect(page.locator("#senseArea")).toBeHidden();
  saved = await readState(page);
  expect(saved.introducedWords).not.toContain("act");
  expect(Object.keys(saved.progress).filter((key) => key.startsWith("act:"))).toEqual([]);
});

test("long words stay inside the word card on desktop and mobile", async ({ page }) => {
  await page.goto(APP_URL);
  await page.evaluate(async (key) => {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    localStorage.setItem(key, JSON.stringify({
      view: "home",
      plan: {
        dailyTarget: 1,
        startedOn: date,
        createdOn: date,
        updatedOn: date,
        advancedDays: 0,
      },
      session: null,
      introducedWords: (await fetch("./data/kaoyan-words.json").then((response) => response.json()))
        .filter((entry) => entry.id !== "semiconductor")
        .map((entry) => entry.id),
      progress: {},
    }));
  }, STORAGE_KEY);
  await page.reload();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText("semiconductor");

  async function expectWordInsideCard() {
    await page.waitForTimeout(100);
    const boxes = await page.evaluate(() => {
      const word = document.querySelector("#wordText").getBoundingClientRect();
      const card = document.querySelector("#revealButton").getBoundingClientRect();
      const panelElement = document.querySelector("#studyPanel");
      const panel = panelElement.getBoundingClientRect();
      const shellElement = document.querySelector(".app-shell");
      const shell = shellElement.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      const overflowing = [...document.querySelectorAll("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            id: element.id,
            className: element.className,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((item) => item.right > viewport + 1 || item.left < -1)
        .slice(0, 12);
      return {
        word,
        card,
        panel,
        shell,
        panelStyle: {
          width: getComputedStyle(panelElement).width,
          minWidth: getComputedStyle(panelElement).minWidth,
        },
        shellStyle: {
          width: getComputedStyle(shellElement).width,
          columns: getComputedStyle(shellElement).gridTemplateColumns,
        },
        scrollWidth: document.documentElement.scrollWidth,
        viewport,
        overflowing,
      };
    });
    expect(boxes.word.left).toBeGreaterThanOrEqual(boxes.card.left);
    expect(boxes.word.right).toBeLessThanOrEqual(boxes.card.right);
    expect(boxes.scrollWidth, JSON.stringify(boxes)).toBeLessThanOrEqual(boxes.viewport);
  }

  await expectWordInsideCard();
  await page.screenshot({ path: "test-results/long-word-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectWordInsideCard();
  await page.screenshot({ path: "test-results/long-word-mobile.png", fullPage: true });
});

test("study navigation, IPA, and reset entry points follow the revised UI", async ({ page }) => {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("2");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();

  await expect(page.locator("#studyDate")).toHaveCount(0);
  await expect(page.locator(".study-progress-row")).not.toContainText("实际日期");
  await expect(page.locator("#exitStudyButton")).toHaveText("返回");

  await reveal(page);
  const senseCount = await page.locator(".sense-item").count();
  expect(senseCount).toBeGreaterThan(0);
  await expect(page.locator(".sense-ipa")).toHaveCount(senseCount);
  for (const value of await page.locator(".sense-ipa").allTextContents()) {
    expect(value).toMatch(/^\/.+\/$/);
  }

  const firstSenseKey = await page.locator(".sense-item").first().getAttribute("data-key");
  const firstSense = page.locator(`.sense-item[data-key="${firstSenseKey}"]`);
  await firstSense.click();
  await expect(firstSense).toHaveClass(/is-mastered/);
  await page.locator("#resetButton").click();
  await expect(page.locator("#resetDialog")).toBeVisible();
  await expect(page.locator("#resetDialog")).toContainText("重置本次标记");
  await expect(page.locator("#resetDialog")).toContainText("重学该单词");
  await expect(page.locator("#resetDialog")).not.toContainText("重置全部进度");
  await page.locator("#resetMarkingButton").click();
  await expect(page.locator("#resetDialog")).toBeHidden();
  await expect(firstSense).not.toHaveClass(/is-mastered/);

  await page.locator("#exitStudyButton").click();
  await expect(page.locator("#returnDialog")).toBeVisible();
  await expect(page.locator("#previousWordButton")).toBeDisabled();
  await page.locator("#cancelReturnButton").click();

  const firstWord = await page.locator("#wordText").textContent();
  await completeAndAdvance(page);
  const currentWord = await page.locator("#wordText").textContent();
  expect(currentWord).not.toBe(firstWord);

  await page.locator("#exitStudyButton").click();
  await expect(page.locator("#previousWordButton")).toBeEnabled();
  await page.locator("#previousWordButton").click();
  await expect(page.locator("#cardMode")).toHaveText("回看");
  await expect(page.locator("#senseHint")).toHaveText("上一词义项");
  await expect(page.locator("#wordText")).toHaveText(firstWord);
  await expect(page.locator("#nextButton")).toHaveText("回到当前词");
  await page.locator("#nextButton").click();
  await expect(page.locator("#wordText")).toHaveText(currentWord);

  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  await expect(page.locator("#planButton")).toHaveText("修改计划");

  await page.locator("#planButton").click();
  await expect(page.locator("#resetAllPlanButton")).toBeVisible();
  await page.locator("#resetAllPlanButton").click();
  await expect(page.locator("#planResetConfirm")).toBeVisible();
  await page.locator("#backPlanResetButton").click();
  expect((await readState(page)).plan).not.toBeNull();

  await page.locator("#resetAllPlanButton").click();
  await page.locator("#confirmResetAllPlanButton").click();
  await expect(page.locator("#planButton")).toHaveText("选择计划");
  const resetState = await readState(page);
  expect(resetState.plan).toBeNull();
  expect(resetState.introducedWords).toEqual([]);
  expect(resetState.bookStates.kaoyan).toBeUndefined();
});

test("partial new learning advances the sliding word window only by completed words", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super(localStorage.getItem("sense-vocab-test-date") || "2026-07-26T12:00:00Z");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
  });

  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const firstWords = await page.evaluate(() => {
    return fetch("./data/kaoyan-words.json")
      .then((response) => response.json())
      .then((entries) => entries.slice(0, 3).map((entry) => entry.word));
  });

  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("2");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(firstWords[0]);
  await reveal(page);
  await confirmEveryVisibleSense(page);
  await completeAndAdvance(page);

  let saved = await readState(page);
  expect(saved.introducedWords).toEqual([firstWords[0]]);
  expect(saved.plan.advancedDays).toBe(-0.5);

  await setStudyDate(page, "2026-07-27T12:00:00Z");
  await expect(page.locator("#homePlanMeta")).toHaveText("计划已落后 1.5 天");
  await expect(page.locator("#progressCompare")).toHaveText("进度 0.5 天 / 实际 2 天");
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText(firstWords[1]);
  saved = await readState(page);
  expect(saved.session.queue.filter((card) => card.type === "new").map((card) => card.wordId))
    .toEqual(["action", "activate"]);
});

test("an advanced day and a missed calendar day use the same shared progress clock", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super(localStorage.getItem("sense-vocab-test-date") || "2026-07-26T12:00:00Z");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
  });

  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();

  await page.locator("#startStudyButton").click();
  await reveal(page);
  await confirmEveryVisibleSense(page);
  await completeAndAdvance(page);
  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();

  await page.locator("#advanceStudyButton").click();
  await reveal(page);
  await confirmEveryVisibleSense(page);
  await completeAndAdvance(page);
  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();
  await expect(page.locator("#homePlanMeta")).toHaveText("计划已提前 1 天");
  await expect(page.locator("#progressCompare")).toHaveText("进度 2 天 / 实际 1 天");

  await setStudyDate(page, "2026-07-27T12:00:00Z");
  await expect(page.locator("#homePlanMeta")).toHaveText("计划进度同步");
  await expect(page.locator("#progressCompare")).toHaveText("进度 2 天 / 实际 2 天");
  expect((await readState(page)).plan.advancedDays).toBe(0);
});

test("legacy progress backfills the heatmap and word list, whose rows open read-only cards", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super("2026-07-26T12:00:00Z");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
    localStorage.setItem(storageKey, JSON.stringify({
      view: "home",
      plan: {
        dailyTarget: 1,
        startedOn: "2026-07-24",
        createdOn: "2026-07-24",
        updatedOn: "2026-07-24",
      },
      session: null,
      introducedWords: ["act", "action"],
      progress: {
        "act:v-1": {
          status: "reinforce",
          misses: 1,
          dueDate: "2026-07-26",
          firstSeen: "2026-07-24",
          lastSeen: "2026-07-25",
          masteredOn: null,
        },
        "act:v-2": {
          status: "review",
          misses: 0,
          dueDate: "2026-07-26",
          firstSeen: "2026-07-24",
          lastSeen: "2026-07-25",
          masteredOn: null,
        },
        "act:n-3": {
          status: "mastered",
          misses: 0,
          dueDate: null,
          firstSeen: "2026-07-24",
          lastSeen: "2026-07-25",
          masteredOn: "2026-07-25",
        },
        "act:n-4": {
          status: "mastered",
          misses: 0,
          dueDate: null,
          firstSeen: "2026-07-24",
          lastSeen: "2026-07-25",
          masteredOn: "2026-07-25",
        },
        "action:n-1": {
          status: "mastered",
          misses: 0,
          dueDate: null,
          firstSeen: "2026-07-25",
          lastSeen: "2026-07-25",
          masteredOn: "2026-07-25",
        },
        "action:n-2": {
          status: "mastered",
          misses: 0,
          dueDate: null,
          firstSeen: "2026-07-25",
          lastSeen: "2026-07-25",
          masteredOn: "2026-07-25",
        },
      },
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  const migrated = await readState(page);
  expect(migrated.dataVersion).toBeGreaterThanOrEqual(3);
  expect(migrated.activityLog["2026-07-24"].newWords).toContain("act");
  expect(migrated.activityLog["2026-07-25"].newWords).toContain("action");

  const july24 = page.locator('.heatmap-day[data-date="2026-07-24"]');
  await july24.hover();
  await expect(page.locator("#heatmapTooltip")).toHaveText("7月24日，新学 1 词，复习 0 词");
  await expect(page.locator(".heatmap-month-label").first()).toHaveText("8月");
  const heatmapAlignment = await page.evaluate(() => {
    const scroll = document.querySelector(".heatmap-scroll").getBoundingClientRect();
    const grid = document.querySelector(".heatmap-grid").getBoundingClientRect();
    return {
      leftGap: grid.left - scroll.left,
      rightGap: scroll.right - grid.right,
    };
  });
  expect(Math.abs(heatmapAlignment.leftGap - heatmapAlignment.rightGap)).toBeLessThanOrEqual(2);

  await page.locator("#wordListButton").click();
  await expect(page.locator("#wordListPanel")).toBeVisible();
  const firstRow = page.locator(".word-list-item").first();
  await expect(firstRow.locator(".word-list-name")).toHaveText("act");
  await expect(firstRow.locator(".is-duration")).toHaveText("学习2天");
  await expect(firstRow.locator(".is-reinforce")).toHaveText("待强化");
  await expect(firstRow.locator(".is-review")).toHaveText("待复习");
  await expect(firstRow.locator(".is-mastered")).toHaveCount(0);
  await page.locator('.word-list-filter[data-status="review"]').click();
  await expect(page.locator(".word-list-item")).toHaveCount(1);
  await expect(page.locator(".word-list-name")).toHaveText("act");
  await page.locator("#wordSortSelect").selectOption("time-desc");
  await expect(page.locator(".word-list-item")).toHaveCount(1);
  await expect(page.locator(".word-list-name")).toHaveText("act");
  await page.locator('.word-list-filter[data-status="all"]').click();
  await page.screenshot({ path: "test-results/word-list-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  })).toBe(true);
  expect(await page.locator(".word-list-filter-bar").evaluate((bar) => {
    const filters = bar.querySelector(".word-list-filters");
    return Math.abs(bar.getBoundingClientRect().width - filters.getBoundingClientRect().width);
  })).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/word-list-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1100, height: 850 });

  await page.locator("#wordSortSelect").selectOption("time-desc");
  await expect(page.locator(".word-list-item").first().locator(".word-list-name")).toHaveText("action");
  await expect(page.locator(".word-list-item").first().locator(".is-mastered")).toHaveText("已掌握");
  await page.locator(".word-list-item").first().click();
  await expect(page.locator("#cardMode")).toHaveText("单词卡片");
  await expect(page.locator("#wordText")).toHaveText("action");
  await expect(page.locator("#senseArea")).toBeVisible();
  await expect(page.locator("#nextButton")).toBeHidden();
  await expect(page.locator("#exitStudyButton")).toHaveText("返回");
  await page.locator("#exitStudyButton").click();
  await expect(page.locator("#wordListPanel")).toBeVisible();
});

test("completed activity counts survive relearning and repair previously shortened history", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super("2026-07-26T12:00:00Z");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
    localStorage.setItem(storageKey, JSON.stringify({
      dataVersion: 6,
      view: "home",
      plan: {
        dailyTarget: 40,
        startedOn: "2026-07-24",
        createdOn: "2026-07-24",
        updatedOn: "2026-07-24",
      },
      introducedWords: ["act", "action"],
      progress: {
        "act:v-1": {
          status: "review",
          misses: 0,
          dueDate: "2026-07-26",
          firstSeen: "2026-07-24",
          lastSeen: "2026-07-25",
          masteredOn: null,
        },
      },
      activityLog: {
        "2026-07-24": {
          newWords: ["act", "action"],
          reviewWords: [],
          baseCompleted: true,
          overtime: false,
          target: 40,
          learningDays: [1],
        },
      },
      learningDayCounter: 1,
      session: {
        date: "2026-07-26",
        queue: [{
          type: "review",
          wordId: "act",
          activeSenseKeys: ["act:v-1"],
          senseKeys: ["act:v-1"],
          confirmedKeys: [],
        }],
        currentIndex: 0,
        revealed: false,
        cardPhase: "hidden",
        baseNewAdded: true,
        baseCompleted: false,
        activeBatchType: "planned",
        activePlanDate: "2026-07-26",
        reinforcementAdded: false,
        reinforcedKeys: [],
        snapshotTimingVersion: 2,
      },
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  let saved = await readState(page);
  expect(saved.activityLog["2026-07-24"].newCount).toBe(40);
  await page.locator('.heatmap-day[data-date="2026-07-24"]').hover();
  await expect(page.locator("#heatmapTooltip")).toHaveText("7月24日，新学 40 词，复习 0 词");

  await page.locator("#startStudyButton").click();
  await page.locator("#resetButton").click();
  await page.locator("#relearnWordButton").click();
  await page.locator("#confirmResetButton").click();
  saved = await readState(page);
  expect(saved.introducedWords).not.toContain("act");
  expect(saved.activityLog["2026-07-24"].newCount).toBe(40);
  expect(saved.activityLog["2026-07-24"].newWords).toContain("act");
});

test("pending-new words use their recorded encounter span even after relearning", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super("2026-07-30T12:00:00Z");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
    localStorage.setItem(storageKey, JSON.stringify({
      dataVersion: 6,
      view: "home",
      plan: {
        dailyTarget: 40,
        startedOn: "2026-07-24",
        createdOn: "2026-07-24",
        updatedOn: "2026-07-24",
      },
      introducedWords: [],
      progress: {
        "act:v-1": {
          status: "new",
          misses: 0,
          dueDate: null,
          firstSeen: "2026-07-24",
          lastSeen: "2026-07-24",
          masteredOn: null,
          firstSeenActual: "2026-07-24",
          lastSeenActual: "2026-07-24",
          masteredOnActual: null,
        },
      },
      activityLog: {
        "2026-07-24": {
          newWords: ["act"],
          reviewWords: [],
          newCount: 1,
          reviewCount: 0,
          baseCompleted: false,
          overtime: false,
          target: 40,
          learningDays: [1],
        },
      },
      learningDayCounter: 1,
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await page.locator("#wordListButton").click();
  await page.locator("#wordSearchInput").fill("act");

  const row = page.locator('.word-list-item[data-word-id="act"]');
  await expect(row.locator(".is-duration")).toHaveText("学习1天");
  await expect(row.locator(".is-new")).toHaveText("待新学");

  const saved = await readState(page);
  expect(saved.activityLog["2026-07-24"].newWords).toContain("act");
  expect(saved.progress["act:v-1"].firstSeenActual).toBe("2026-07-24");
});

test("introduced words with explicit pending-new senses rejoin tomorrow's new queue", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.clear();
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
    localStorage.setItem(storageKey, JSON.stringify({
      dataVersion: 9,
      view: "home",
      plan: {
        dailyTarget: 1,
        startedOn: "2026-08-01",
        createdOn: "2026-08-01",
        updatedOn: "2026-08-01",
      },
      introducedWords: ["act"],
      progress: {
        "act:v-1": { status: "new", firstSeenActual: "2026-07-17", lastSeenActual: "2026-07-18" },
        "act:v-2": { status: "mastered", firstSeenActual: "2026-07-17", lastSeenActual: "2026-07-18", masteredOnActual: "2026-07-18", masteredOn: "2026-07-18" },
        "act:n-3": { status: "mastered", firstSeenActual: "2026-07-17", lastSeenActual: "2026-07-18", masteredOnActual: "2026-07-18", masteredOn: "2026-07-18" },
        "act:n-4": { status: "mastered", firstSeenActual: "2026-07-17", lastSeenActual: "2026-07-18", masteredOnActual: "2026-07-18", masteredOn: "2026-07-18" },
      },
      activityLog: {},
      studyWindows: [],
      learningDayCounter: 1,
      wordListSort: "mastery",
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await expect(page.locator("#todayNewCount")).toHaveText("1");
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText("act");
  await page.locator("#revealButton").click();
  await expect(page.locator(".sense-item")).toHaveCount(4);
  await expect(page.locator('.sense-item[data-key="act:v-1"]')).toBeEnabled();
  await expect(page.locator(".sense-item.is-mastered")).toHaveCount(3);
  await page.locator('.sense-item[data-key="act:v-1"]').click();
  await expect(page.locator("#nextButton")).toHaveText("下一词");
  await page.locator("#nextButton").click();

  const saved = await readState(page);
  expect(saved.introducedWords.filter((wordId) => wordId === "act")).toHaveLength(1);
  expect(saved.activityLog["2026-08-03"]?.newWords ?? []).not.toContain("act");
});

test("reinforcement cards keep inactive mastered senses visible before and after marking", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super("2026-08-03T12:00:00+08:00");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
    localStorage.clear();
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
    localStorage.setItem(storageKey, JSON.stringify({
      dataVersion: 10,
      view: "study",
      plan: {
        dailyTarget: 1,
        startedOn: "2026-08-01",
        createdOn: "2026-08-01",
        updatedOn: "2026-08-01",
      },
      introducedWords: ["act"],
      progress: {
        "act:v-1": { status: "reinforce", dueDate: "2026-08-03", dueLearningDay: 2 },
        "act:v-2": { status: "mastered", masteredOn: "2026-08-02" },
        "act:n-3": { status: "mastered", masteredOn: "2026-08-02" },
        "act:n-4": { status: "mastered", masteredOn: "2026-08-02" },
      },
      activityLog: {},
      studyWindows: [],
      learningDayCounter: 2,
      wordListSort: "mastery",
      session: {
        date: "2026-08-03",
        queue: [{
          type: "reinforcement",
          wordId: "act",
          activeSenseKeys: ["act:v-1"],
          senseKeys: ["act:v-1"],
          confirmedKeys: [],
          expandedMasteredKeys: [],
        }],
        currentIndex: 0,
        revealed: true,
        cardPhase: "select",
        baseNewAdded: true,
        baseCompleted: false,
        activeBatchType: "planned",
        activePlanDate: "2026-08-03",
        reinforcementAdded: true,
        reinforcedKeys: [],
        activeLearningDay: 2,
        baseLearningDay: 2,
        snapshotTimingVersion: 2,
      },
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await page.locator("#startStudyButton").click();
  await expect(page.locator(".sense-item")).toHaveCount(4);
  await expect(page.locator(".sense-item.is-mastered")).toHaveCount(3);
  await expect(page.locator('.sense-item[data-key="act:v-1"]')).toBeEnabled();

  await page.locator('.sense-item[data-key="act:v-1"]').click();
  await page.waitForTimeout(500);
  await page.locator("#nextButton").click();
  await expect(page.locator(".sense-item")).toHaveCount(4);
  await expect(page.locator(".sense-item.is-mastered, .sense-item.is-confirmed")).toHaveCount(4);
});

test("legacy calendar dates migrate back once and preserve corrected July totals", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super("2026-07-26T12:00:00+08:00");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
    localStorage.setItem(storageKey, JSON.stringify({
      dataVersion: 5,
      view: "home",
      plan: {
        dailyTarget: 40,
        startedOn: "2026-07-18",
        createdOn: "2026-07-18",
        updatedOn: "2026-07-24",
      },
      introducedWords: ["act", "action"],
      progress: {
        "act:v-1": {
          status: "review",
          dueDate: "2026-07-27",
          firstSeen: "2026-07-18",
          lastSeen: "2026-07-26",
          masteredOn: null,
        },
      },
      activityLog: {
        "2026-07-18": {
          newWords: ["act"],
          newCount: 37,
          reviewWords: [],
          reviewCount: 0,
          baseCompleted: false,
          target: 40,
        },
        "2026-07-19": {
          newWords: ["action"],
          newCount: 1,
          reviewWords: [],
          reviewCount: 0,
          baseCompleted: false,
          target: 40,
        },
        "2026-07-21": {
          newWords: [],
          newCount: 41,
          reviewWords: [],
          reviewCount: 0,
          baseCompleted: true,
          overtime: true,
          target: 40,
        },
        "2026-07-22": {
          newWords: [],
          newCount: 38,
          reviewWords: [],
          reviewCount: 0,
          baseCompleted: false,
          target: 40,
        },
        "2026-07-23": {
          newWords: ["act", "action"],
          newCount: 44,
          reviewWords: [],
          reviewCount: 0,
          baseCompleted: true,
          overtime: true,
          target: 40,
        },
        "2026-07-24": {
          newWords: [],
          newCount: 39,
          reviewWords: [],
          reviewCount: 0,
          baseCompleted: false,
          target: 40,
        },
        "2026-07-26": {
          newWords: [],
          newCount: 0,
          reviewWords: ["act"],
          reviewCount: 10,
          baseCompleted: false,
          target: 40,
        },
      },
      learningDayCounter: 6,
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");

  let saved = await readState(page);
  expect(saved.dataVersion).toBe(10);
  expect(saved.activityLog["2026-07-17"].newCount).toBe(40);
  expect(saved.activityLog["2026-07-18"].newCount).toBe(0);
  expect(saved.activityLog["2026-07-20"].newCount).toBe(40);
  expect(saved.activityLog["2026-07-21"].newCount).toBe(40);
  expect(saved.activityLog["2026-07-22"].newCount).toBe(40);
  expect(saved.activityLog["2026-07-23"].newCount).toBe(40);
  expect(saved.activityLog["2026-07-25"].reviewCount).toBe(10);
  expect(saved.activityLog["2026-07-26"]).toBeUndefined();
  expect(saved.progress["act:v-1"].firstSeenActual).toBe("2026-07-17");
  expect(saved.progress["act:v-1"].lastSeenActual).toBe("2026-07-25");

  await page.locator('.heatmap-day[data-date="2026-07-25"]').hover();
  await expect(page.locator("#heatmapTooltip"))
    .toHaveText("7月25日，新学 0 词，复习 10 词");
  await page.locator('.heatmap-day[data-date="2026-07-26"]').hover();
  await expect(page.locator("#heatmapTooltip"))
    .toHaveText("7月26日，新学 0 词，复习 0 词");

  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  saved = await readState(page);
  expect(saved.activityLog["2026-07-25"].reviewCount).toBe(10);
  expect(saved.activityLog["2026-07-24"]?.reviewCount ?? 0).toBe(0);
  expect(saved.activityLog["2026-07-26"]).toBeUndefined();
});

test("359 learned words reconcile to the complete July history without inventing reviews", async ({ page }) => {
  const introducedWords = wordData.slice(0, 359).map((word) => word.id);
  await page.addInitScript(({ storageKey, introducedWords: ids }) => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super("2026-07-26T12:00:00+08:00");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
    localStorage.setItem(storageKey, JSON.stringify({
      dataVersion: 6,
      view: "home",
      plan: {
        dailyTarget: 40,
        startedOn: "2026-07-16",
        createdOn: "2026-07-16",
        updatedOn: "2026-07-24",
      },
      introducedWords: ids,
      progress: {},
      activityLog: {
        "2026-07-16": {
          newCount: 41,
          newWords: [],
          reviewCount: 0,
          reviewWords: [],
          target: 40,
        },
        "2026-07-17": {
          newCount: 40,
          newWords: [],
          reviewCount: 17,
          reviewWords: [],
          target: 40,
        },
        "2026-07-18": {
          newCount: 0,
          newWords: [],
          reviewCount: 0,
          reviewWords: [],
          target: 40,
        },
        "2026-07-25": {
          newCount: 0,
          newWords: [],
          reviewCount: 10,
          reviewWords: [],
          target: 40,
        },
      },
      learningDayCounter: 9,
    }));
  }, { storageKey: STORAGE_KEY, introducedWords });

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");

  const saved = await readState(page);
  const expected = {
    "2026-07-16": 0,
    "2026-07-17": 79,
    "2026-07-18": 40,
    "2026-07-19": 40,
    "2026-07-20": 40,
    "2026-07-21": 40,
    "2026-07-22": 40,
    "2026-07-23": 40,
    "2026-07-24": 40,
    "2026-07-25": 0,
  };
  Object.entries(expected).forEach(([date, count]) => {
    expect(saved.activityLog[date].newCount).toBe(count);
  });
  const totalNew = Object.values(saved.activityLog)
    .reduce((sum, activity) => sum + activity.newCount, 0);
  expect(totalNew).toBe(359);
  expect(saved.activityLog["2026-07-17"].reviewCount).toBe(17);
  expect(saved.activityLog["2026-07-25"].reviewCount).toBe(10);

  const todayColor = await page.locator('.heatmap-day[data-date="2026-07-26"]')
    .evaluate((element) => element.style.getPropertyValue("--heat-color"));
  expect(todayColor).toBe("#ecefeb");
});

test("a study window crossing midnight stays on its start date and requires return confirmation", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super(localStorage.getItem("sense-vocab-test-clock"));
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
    localStorage.setItem("sense-vocab-test-clock", "2026-07-26T23:55:00+08:00");
    localStorage.setItem(storageKey, JSON.stringify({
      dataVersion: 7,
      view: "home",
      plan: {
        dailyTarget: 1,
        startedOn: "2026-07-26",
        createdOn: "2026-07-26",
        updatedOn: "2026-07-26",
      },
      introducedWords: [],
      progress: {},
      activityLog: {},
      studyWindows: [],
      learningDayCounter: 0,
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await expect(page.locator("#startStudyButton")).toBeEnabled();
  let todayColor = await page.locator('.heatmap-day[data-date="2026-07-26"]')
    .evaluate((element) => element.style.getPropertyValue("--heat-color"));
  expect(todayColor).toBe("#ecefeb");

  await page.locator("#startStudyButton").click();
  let saved = await readState(page);
  expect(saved.studyWindows).toHaveLength(1);
  expect(saved.studyWindows[0].activityDate).toBe("2026-07-26");
  expect(saved.studyWindows[0].endedAt).toBeNull();

  await page.evaluate(() => {
    localStorage.setItem("sense-vocab-test-clock", "2026-07-27T00:05:00+08:00");
  });
  await reveal(page);
  await confirmEveryVisibleSense(page);
  await completeAndAdvance(page);

  saved = await readState(page);
  expect(saved.session.date).toBe("2026-07-26");
  expect(saved.activityLog["2026-07-26"].newCount).toBe(1);
  expect(saved.activityLog["2026-07-27"]).toBeUndefined();
  expect(saved.studyWindows[0].endedReason).toBe("completed");
  expect(saved.studyWindows[0].endedDate).toBe("2026-07-27");
  expect(saved.studyWindows[0].crossedMidnight).toBe(true);

  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();
  await expect(page.locator("#returnCrossDayWarning")).toBeVisible();
  await expect(page.locator("#returnCrossDayWarning"))
    .toContainText("当前时间返回首页将进入下一日学习");
  await expect(page.locator("#studyPanel")).toBeVisible();
  await page.locator("#returnHomeButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();

  const previousDayColor = await page.locator('.heatmap-day[data-date="2026-07-26"]')
    .evaluate((element) => element.style.getPropertyValue("--heat-color"));
  expect(previousDayColor).not.toBe("#ecefeb");
  todayColor = await page.locator('.heatmap-day[data-date="2026-07-27"]')
    .evaluate((element) => element.style.getPropertyValue("--heat-color"));
  expect(todayColor).toBe("#ecefeb");
});

test("mastered senses collapse, expand on demand, and fully mastered words advance directly", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const NativeDate = Date;
    class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) {
          super(...args);
          return;
        }
        super("2026-07-26T12:00:00+08:00");
      }

      static now() {
        return new TestDate().getTime();
      }
    }
    window.Date = TestDate;
    localStorage.setItem(storageKey, JSON.stringify({
      dataVersion: 7,
      view: "home",
      plan: {
        dailyTarget: 1,
        startedOn: "2026-07-26",
        createdOn: "2026-07-26",
        updatedOn: "2026-07-26",
      },
      introducedWords: [],
      progress: {},
      activityLog: {},
      studyWindows: [],
      learningDayCounter: 0,
    }));
  }, STORAGE_KEY);

  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  let currentDayColor = await page.locator('.heatmap-day[data-date="2026-07-26"]')
    .evaluate((element) => element.style.getPropertyValue("--heat-color"));
  expect(currentDayColor).toBe("#ecefeb");

  await page.locator("#startStudyButton").click();
  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();
  currentDayColor = await page.locator('.heatmap-day[data-date="2026-07-26"]')
    .evaluate((element) => element.style.getPropertyValue("--heat-color"));
  expect(currentDayColor).toBe("#dc6a63");

  await page.locator("#startStudyButton").click();

  const modeBox = await page.locator("#cardMode").boundingBox();
  const progressBox = await page.locator("#queueProgress").boundingBox();
  expect(Math.abs(
    (modeBox.y + modeBox.height / 2) -
    (progressBox.y + progressBox.height / 2),
  )).toBeLessThan(3);

  await reveal(page);
  await confirmEveryVisibleSense(page);
  await expect(page.locator("#nextButton")).toHaveText("下一词");
  await expect(page.locator("#revealButton")).toHaveClass(/is-mastered/);

  const collapsed = page.locator(".sense-item.is-collapsible");
  expect(await collapsed.count()).toBeGreaterThan(0);
  await expect(collapsed.first()).toHaveAttribute("aria-expanded", "false");
  await expect(collapsed.first().locator(".sense-detail-group")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/mastered-word-collapsed.png",
    fullPage: true,
  });

  await collapsed.first().click();
  const expanded = page.locator(".sense-item.is-collapsible").first();
  await expect(expanded).toHaveAttribute("aria-expanded", "true");
  await expect(expanded.locator(".sense-detail-group")).toHaveCount(2);
  await expanded.click();
  await expect(page.locator(".sense-item.is-collapsible").first())
    .toHaveAttribute("aria-expanded", "false");

  await page.locator("#nextButton").click();
  await expect(page.locator("#wordText")).toHaveText("今日任务已完成");
  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();
  currentDayColor = await page.locator('.heatmap-day[data-date="2026-07-26"]')
    .evaluate((element) => element.style.getPropertyValue("--heat-color"));
  expect(currentDayColor).toBe("#49a96d");
});
