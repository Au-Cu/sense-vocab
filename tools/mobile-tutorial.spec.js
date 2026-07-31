const { test, expect } = require("@playwright/test");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";

test.use({viewport: { width: 390, height: 844 },
});

function makeSeedState() {
  return {
    view: "home",
    plan: {
      dailyTarget: 17,
      createdDate: "2026-07-17",
      startDate: "2026-07-17",
      advancedDays: 0,
      progressBaseWords: 0,
      progressBaseDays: 0,
    },
    session: null,
    introducedWords: ["ability"],
    progress: {
      "ability:n-1": {
        status: "review",
        misses: 0,
        firstSeen: "2026-07-17",
        lastSeen: "2026-07-17",
      },
    },
    activityLog: {},
    studyWindows: [],
    learningDayCounter: 1,
    wordListSort: "mastery",
    wordBrowse: null,
    dataVersion: 8,
  };
}

async function waitForApp(page) {
  await page.waitForFunction(() => {
    return document.documentElement.dataset.appReady === "true" &&
      document.documentElement.dataset.accountReady === "true";
  });
}

async function expectHint(page, text) {
  await expect(page.locator("#tutorialTip")).toContainText(text, {
    timeout: 3_000,
  });
}

async function expectSpotlightContains(page, targetSelector) {
  await expect.poll(async () => page.evaluate((selector) => {
    const spotlight = document.querySelector("#tutorialSpotlight")?.getBoundingClientRect();
    const target = document.querySelector(selector)?.getBoundingClientRect();
    if (!spotlight || !target) return false;
    return spotlight.left <= target.left &&
      spotlight.top <= target.top &&
      spotlight.right >= Math.min(document.documentElement.clientWidth, target.right) &&
      spotlight.bottom >= Math.min(document.documentElement.clientHeight, target.bottom);
  }, targetSelector)).toBe(true);
}

test("mobile home stays compact, searches words, and opens the heatmap at the latest date", async ({ page }) => {
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeSeedState() });
  await page.reload();
  await waitForApp(page);

  const todayBoxes = await page.locator(".today-plan-item").evaluateAll((items) => (
    items.map((item) => item.getBoundingClientRect())
  ));
  expect(todayBoxes).toHaveLength(3);
  expect(Math.max(...todayBoxes.map((box) => box.y)) - Math.min(...todayBoxes.map((box) => box.y)))
    .toBeLessThan(3);

  const actionBoxes = await page.locator(".home-primary-actions > button").evaluateAll((items) => (
    items.map((item) => item.getBoundingClientRect())
  ));
  expect(actionBoxes).toHaveLength(3);
  expect(Math.max(...actionBoxes.map((box) => box.y)) - Math.min(...actionBoxes.map((box) => box.y)))
    .toBeLessThan(3);
  expect(actionBoxes.every((box) => box.bottom <= 844)).toBe(true);
  const homeActionsBox = await page.locator(".home-actions").boundingBox();
  expect(actionBoxes[0].x).toBeLessThanOrEqual(homeActionsBox.x + 1);
  expect(actionBoxes[2].x + actionBoxes[2].width)
    .toBeGreaterThanOrEqual(homeActionsBox.x + homeActionsBox.width - 1);
  const moreBox = await page.locator("#moreButton").boundingBox();
  const progressBox = await page.locator(".progress-card").boundingBox();
  expect(moreBox.y).toBeGreaterThan(progressBox.y + progressBox.height);

  await page.waitForFunction(() => {
    const element = document.querySelector(".heatmap-scroll");
    if (!element) return false;
    const max = element.scrollWidth - element.clientWidth;
    return max <= 0 || element.scrollLeft >= max - 2;
  });
  const heatmapPosition = await page.locator(".heatmap-scroll").evaluate((element) => ({
    left: element.scrollLeft,
    max: element.scrollWidth - element.clientWidth,
  }));
  expect(heatmapPosition.left).toBeGreaterThanOrEqual(heatmapPosition.max - 2);

  await page.locator("#wordListButton").click();
  await page.locator("#wordSearchInput").fill("shepherd");
  await expect(page.locator(".word-list-item")).toHaveCount(1);
  await expect(page.locator(".word-list-item")).toContainText("shepherd");
  await page.locator("#wordSearchInput").fill("not-a-real-vocabulary-entry");
  await expect(page.locator("#wordListEmpty")).toBeVisible();
});

test("the first-run tutorial retries after a transient account conflict", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    window.__SENSE_VOCAB_ALLOW_AUTOMATIC_TUTORIAL__ = true;
    window.addEventListener("sensevocab:account-ready", () => {
      const conflict = document.querySelector("#accountConflictView");
      conflict.hidden = false;
      window.setTimeout(() => {
        conflict.hidden = true;
      }, 900);
    }, { once: true });
  });

  await page.goto(APP_URL);
  await waitForApp(page);
  await expect(page.locator("#tutorialOverlay")).toBeVisible({
    timeout: 4_000,
  });
  await expectHint(page, "点击这里选择词书和每日计划");
  await expectSpotlightContains(page, "#planButton");
});

test("the first-run tutorial survives stalled account startup and early home interaction", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    window.__SENSE_VOCAB_ALLOW_AUTOMATIC_TUTORIAL__ = true;
    window.__SENSE_VOCAB_TUTORIAL_ACCOUNT_READY_GRACE_MS__ = 2000;
    window.__SENSE_VOCAB_CLOUD_FACTORY__ = () => ({
      onAuthStateChange() {},
      getSession() {
        return new Promise(() => {});
      },
    });
  });

  await page.goto(APP_URL);
  await page.waitForFunction(() => (
    document.documentElement.dataset.appReady === "true"
  ));
  await page.locator("#planButton").click();
  await page.locator("#savePlanButton").click();

  await expect(page.locator("#tutorialOverlay")).toBeVisible({
    timeout: 5_000,
  });
  await expectHint(page, "点击这里选择词书和每日计划");
  await expectSpotlightContains(page, "#planButton");
  await expect(page.locator("html")).not.toHaveAttribute("data-account-ready", "true");
});

test("tutorial plan cancellation stays covered and cannot strand the overlay", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
  });
  await page.goto(APP_URL);
  await waitForApp(page);
  await page.locator("#moreButton").click();
  await page.locator("#replayTutorialButton").click();
  await page.locator("#planButton").click();
  await expectHint(page, "选择词书和每日计划");
  await expect(page.locator("#planDialog")).toBeVisible();
  await expect(page.locator("#tutorialExclusionMask")).toBeVisible();

  const covered = await page.evaluate(() => {
    const mask = document.querySelector("#tutorialExclusionMask").getBoundingClientRect();
    const cancel = document.querySelector("#cancelPlanButton").getBoundingClientRect();
    return mask.left <= cancel.left &&
      mask.top <= cancel.top &&
      mask.right >= cancel.right &&
      mask.bottom >= cancel.bottom;
  });
  expect(covered).toBe(true);

  await page.locator("#cancelPlanButton").click({ force: true });
  await expect(page.locator("#planDialog")).toBeVisible();
  await expect(page.locator("#tutorialOverlay")).toBeVisible();
  await page.locator("#dailyTargetInput").fill("3");
  await page.locator("#savePlanButton").click();
  await expectHint(page, "试着学几个单词吧");
});

test("the guided tutorial is complete and never mutates real learning data", async ({ page }) => {
  await page.addInitScript(() => {
    window.__SENSE_VOCAB_TUTORIAL_WAIT_MS__ = 650;
    window.__SENSE_VOCAB_TUTORIAL_HER_PROMPT_DELAY_MS__ = 450;
    window.__playedTutorialAudio = [];
    window.Audio = class TutorialAudio {
      constructor(src) {
        this.src = src;
      }

      play() {
        window.__playedTutorialAudio.push(this.src);
        return Promise.resolve();
      }

      pause() {}
    };
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class TutorialUtterance {
        constructor(text) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance) {
          window.__playedTutorialAudio.push(utterance.text);
        },
      },
    });
  });
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeSeedState() });
  await page.reload();
  await waitForApp(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

  await page.locator("#moreButton").click();
  await page.locator("#replayTutorialButton").click();
  await expectHint(page, "点击这里选择词书和每日计划");
  await page.locator("#planButton").evaluate((element) => {
    element.style.transform = "translateY(72px)";
  });
  await expectSpotlightContains(page, "#planButton");
  const firstTipBox = await page.locator("#tutorialTip").boundingBox();
  expect(firstTipBox.x).toBeGreaterThanOrEqual(0);
  expect(firstTipBox.x + firstTipBox.width).toBeLessThanOrEqual(390);
  await page.locator("#planButton").click();
  await page.locator("#planButton").evaluate((element) => {
    element.style.removeProperty("transform");
  });
  await expectHint(page, "选择词书和每日计划，然后保存计划");
  await page.locator("#savePlanButton").click();
  await expectHint(page, "试着学几个单词吧");
  await page.locator("#startStudyButton").click();
  await expectHint(page, "请先尽可能回忆其所有含义");
  await expectSpotlightContains(page, "#revealButton");
  const studyPanelBox = await page.locator("#studyPanel").boundingBox();
  expect(Math.abs(844 - (studyPanelBox.y + studyPanelBox.height))).toBeLessThanOrEqual(10);
  await expectHint(page, "点击单词卡片展开详细内容");
  await page.locator("#revealButton").click();

  await expectHint(page, "点击刚才已经想到的义项");
  await page.locator('.sense-item[data-key="act:v-1"]').click();
  await expect(page.locator('.sense-item[data-key="act:v-1"]')).toHaveClass(/is-mastered/);
  await expectHint(page, "点击刚才已经想到的义项");
  await page.locator('.sense-item[data-key="act:n-3"]').click();
  await expectHint(page, "可以在重置中撤回");
  await page.locator("#resetButton").click();
  await expectHint(page, "点击这里撤回本次标记");
  const resetTipBox = await page.locator("#tutorialTip").boundingBox();
  const resetTargetBox = await page.locator("#resetMarkingButton").boundingBox();
  expect(resetTipBox.y + resetTipBox.height).toBeLessThanOrEqual(resetTargetBox.y);
  await page.locator("#resetMarkingButton").click();
  await expectHint(page, "点击这里结束标记");
  await page.locator("#nextButton").click();
  await expectHint(page, "释义和例句以帮助学习记忆");
  await expectSpotlightContains(page, "#senseArea");
  const examplesTipBox = await page.locator("#tutorialTip").boundingBox();
  expect(examplesTipBox.y).toBeLessThanOrEqual(14);
  await expectHint(page, "点击这里进入下一词的学习");
  await page.locator("#nextButton").click();

  await expect(page.locator("#wordText")).toHaveText("her");
  await expect(page.locator("#tutorialTip")).toBeHidden();
  await expectSpotlightContains(page, "#revealButton");
  await expect.poll(async () => page.evaluate(() => {
    return decodeURIComponent(window.__playedTutorialAudio.at(-1) ?? "");
  })).toContain("her");
  await expectHint(page, "试试点击所有义项");
  await expectSpotlightContains(page, "#revealButton");
  await expectSpotlightContains(page, "#senseArea");
  await page.screenshot({
    path: "test-results/tutorial-her-mobile.png",
    fullPage: true,
  });
  const unmarkedHerSenses = page.locator(
    ".sense-item:not(.is-confirmed):not(.is-mastered)",
  );
  while (await unmarkedHerSenses.count()) {
    await unmarkedHerSenses.first().click();
    await page.waitForTimeout(760);
  }
  await expectHint(page, "所有义项都被标为熟悉");
  await page.locator("#nextButton").click();

  await expect(page.locator("#wordText")).toHaveText("abandon");
  await expectHint(page, "点击这里返回主页");
  await page.locator("#exitStudyButton").click();
  await expectHint(page, "点击这里返回主页");
  await page.locator("#returnHomeButton").click();
  await expectHint(page, "点击这里注册/登录/退出账户");
  await page.locator("#moreButton").click();
  await expectHint(page, "请尽快注册账户");
  await page.screenshot({
    path: "test-results/tutorial-account-mobile.png",
    fullPage: true,
  });
  await page.locator("#accountButton").click();
  await expect(page.locator("#tutorialDoneDialog")).toBeVisible();
  await page.locator("#finishTutorialButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();

  const after = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  expect(after).toBe(before);
  expect(await page.evaluate(() => window.SenseVocabApp.getState().plan.dailyTarget))
    .toBe(17);
});
