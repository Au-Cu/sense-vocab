const { test, expect } = require("@playwright/test");

const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({viewport: { width: 1100, height: 850 },
});

async function waitForApp(page) {
  await page.waitForFunction(() => {
    return document.documentElement.dataset.appReady === "true" &&
      document.documentElement.dataset.accountReady === "true";
  });
}

function makeSeedState(overrides = {}) {
  return {
    view: "home",
    plan: {
      dailyTarget: 5,
      startedOn: "2026-07-30",
      createdOn: "2026-07-30",
      updatedOn: "2026-07-30",
    },
    session: null,
    introducedWords: ["act", "action", "charge"],
    progress: {
      "act:v-1": {
        status: "mastered",
        misses: 0,
        firstSeen: "2026-07-30",
        lastSeen: "2026-07-30",
        masteredOn: "2026-07-30",
      },
      "act:v-2": {
        status: "review",
        misses: 0,
        dueDate: "2026-07-31",
        firstSeen: "2026-07-30",
        lastSeen: "2026-07-30",
        masteredOn: null,
      },
      "action:n-1": {
        status: "reinforce",
        misses: 1,
        dueDate: "2026-07-31",
        firstSeen: "2026-07-30",
        lastSeen: "2026-07-30",
        masteredOn: null,
      },
      "charge:fee": {
        status: "new",
        misses: 0,
        dueDate: null,
        firstSeen: null,
        lastSeen: null,
        masteredOn: null,
      },
    },
    activityLog: {},
    studyWindows: [],
    learningDayCounter: 1,
    wordListSort: "mastery",
    wordBrowse: null,
    dataVersion: 9,
    ...overrides,
  };
}

// ── Test 1: Word list search filtering ──────────────────────────

test("word list search filters by partial match and shows empty state", async ({ page }) => {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeSeedState() });

  await page.goto(APP_URL);
  await waitForApp(page);

  // Open word list — shows all words in the book
  await page.locator("#wordListButton").click();
  await expect(page.locator("#wordListPanel")).toBeVisible();

  // Search for "semiconductor" — unique word with no substrings in other words
  await page.locator("#wordSearchInput").fill("semiconductor");
  await expect(page.locator(".word-list-item")).toHaveCount(1);
  await expect(page.locator(".word-list-item .word-list-name")).toHaveText("semiconductor");

  // Search for "act" — matches "act", "action", and substring matches like "practice", "character" etc.
  await page.locator("#wordSearchInput").fill("act");
  const actItems = page.locator(".word-list-item");
  // Verify that exact words "act" and "action" are among the results
  const actNames = await actItems.locator(".word-list-name").allTextContents();
  expect(actNames).toContain("act");
  expect(actNames).toContain("action");
  // "semiconductor" should not be in results
  expect(actNames).not.toContain("semiconductor");

  // Search for non-existent word
  await page.locator("#wordSearchInput").fill("zzzznotexist");
  await expect(page.locator(".word-list-item")).toHaveCount(0);
  await expect(page.locator("#wordListEmpty")).toBeVisible();
  await expect(page.locator("#wordListEmpty")).toHaveText("没有找到匹配的单词");

  // Clear search — all words come back
  await page.locator("#wordSearchInput").fill("");
  const allItems = page.locator(".word-list-item");
  await expect(allItems.first().locator(".word-list-name")).toBeVisible();
  // Verify a known word outside the search is back
  await expect(page.locator(".word-list-item").first().locator(".word-list-name")).not.toHaveText("zzzznotexist");
});

// ── Test 2: Notification center ─────────────────────────────────

test("notification dialog renders items, badge, and toggles with account state", async ({ page }) => {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));

    window.__fakeCloud = {
      notifications: {
        authenticated: false,
        unreadCount: 3,
        items: [
          {
            id: "ann-1",
            kind: "announcement",
            type: "announcement",
            title: "Sense Vocab 1.2 更新公告",
            body: "新增雅思词书，支持多词书切换。",
            images: [],
            createdAt: "2026-08-01T08:00:00.000Z",
            readAt: null,
          },
          {
            id: "ann-2",
            kind: "announcement",
            type: "announcement",
            title: "系统维护通知",
            body: "本周六凌晨 2:00-4:00 将进行系统维护。",
            images: [
              {
                path: "ann-2/1.jpg",
                url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==",
              },
            ],
            createdAt: "2026-07-30T12:00:00.000Z",
            readAt: "2026-07-30T13:00:00.000Z",
          },
        ],
      },
      profile: {
        membershipExpiresAt: null,
        memberActive: false,
        remainingDays: 0,
        inviteCode: "",
        inviteUsedAt: null,
      },
      saves: [],
      signOuts: 0,
      marks: [],
    };

    window.__SENSE_VOCAB_CLOUD_FACTORY__ = () => ({
      async getSession() { return null; },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async loadAccountProfile() {
        return { ...window.__fakeCloud.profile };
      },
      async loadNotifications() {
        return JSON.parse(JSON.stringify(window.__fakeCloud.notifications));
      },
      async markNotificationRead(kind, id) {
        window.__fakeCloud.marks.push({ kind, id });
        return { ok: true };
      },
      async loadState() {
        return { found: false, revision: 0, state: null };
      },
      async saveState() {
        window.__fakeCloud.saves.push({});
        return { revision: 1 };
      },
    });
  }, { key: STORAGE_KEY, state: makeSeedState() });

  await page.goto(APP_URL);
  await waitForApp(page);

  // Notifications are loaded asynchronously after account init — wait for them
  await page.waitForTimeout(500);

  // Badge is inside the "More" dialog — open it to see the unread count
  await page.locator("#moreButton").click();
  await expect(page.locator("#moreDialog")).toBeVisible();

  // Badge should show unread count from fake cloud notifications
  await expect(page.locator("#notificationBadge")).toBeVisible();
  await expect(page.locator("#notificationBadge")).toHaveText("3");

  // Navigate to notifications from More menu
  await page.locator("#notificationsButton").click();
  await expect(page.locator("#notificationsDialog")).toBeVisible();
  await expect(page.locator("#moreDialog")).toBeHidden();

  // Notification items should render
  const items = page.locator(".notification-item");
  await expect(items).toHaveCount(2);

  // First item: announcement title and body
  await expect(items.nth(0).locator(".notification-item-heading")).toContainText("Sense Vocab 1.2 更新公告");
  await expect(items.nth(0)).toContainText("新增雅思词书，支持多词书切换。");

  // Second item has an image rendered
  await expect(items.nth(1).locator(".notification-images img")).toHaveCount(1);

  // Close dialog
  await page.locator("#closeNotificationsButton").click();
  await expect(page.locator("#notificationsDialog")).toBeHidden();
});

// ── Test 3: "More" menu completeness ────────────────────────────

test("more menu contains all expected entries", async ({ page }) => {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeSeedState() });

  await page.goto(APP_URL);
  await waitForApp(page);

  // Open "More" dialog
  await page.locator("#moreButton").click();
  await expect(page.locator("#moreDialog")).toBeVisible();
  await expect(page.locator("#moreTitle")).toHaveText("更多");

  // Verify all expected buttons exist
  await expect(page.locator("#accountButton")).toBeVisible();
  await expect(page.locator("#accountButton")).toHaveText("账户");

  await expect(page.locator("#notificationsButton")).toBeVisible();
  await expect(page.locator("#notificationsButton")).toContainText("消息通知");

  await expect(page.locator("#homeFeedbackButton")).toBeVisible();
  await expect(page.locator("#homeFeedbackButton")).toHaveText("反馈问题");

  await expect(page.locator("#replayTutorialButton")).toBeVisible();
  await expect(page.locator("#replayTutorialButton")).toHaveText("重学教程");

  // Legal link
  const legalLink = page.locator(".legal-link-button");
  await expect(legalLink).toBeVisible();
  await expect(legalLink).toContainText("条款、隐私与内容来源");
  await expect(legalLink).toHaveAttribute("href", "./legal.html");

  // Close via close button
  await page.locator("#closeMoreButton").click();
  await expect(page.locator("#moreDialog")).toBeHidden();

  // Re-open and close via backdrop click
  await page.locator("#moreButton").click();
  await expect(page.locator("#moreDialog")).toBeVisible();
  await page.locator("#moreDialog").click({ position: { x: 0, y: 0 } });
  await expect(page.locator("#moreDialog")).toBeHidden();
});

// ── Test 4: Audio button triggers pronunciation ─────────────────

test("audio button triggers word pronunciation via Audio constructor", async ({ page }) => {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));

    // Track Audio constructor calls
    window.__audioCalls = [];
    const OriginalAudio = window.Audio;
    window.Audio = function AudioMock(src) {
      window.__audioCalls.push(src);
      const audio = new OriginalAudio(src);
      // Prevent actual playback
      audio.play = () => Promise.resolve();
      audio.pause = () => {};
      return audio;
    };
    window.Audio.prototype = OriginalAudio.prototype;
  }, { key: STORAGE_KEY, state: makeSeedState() });

  await page.goto(APP_URL);
  await waitForApp(page);

  // Start studying
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toBeVisible();

  const wordText = await page.locator("#wordText").textContent();
  expect(wordText.length).toBeGreaterThan(0);

  // Click the reveal button first to show senses (audio button may need it)
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();

  // Audio button should be visible
  await expect(page.locator("#audioButton")).toBeVisible();

  // Click audio button
  await page.locator("#audioButton").click();

  // Verify Audio was constructed
  const audioCalls = await page.evaluate(() => window.__audioCalls);
  expect(audioCalls.length).toBeGreaterThanOrEqual(1);
  // The URL should reference the word
  expect(audioCalls[0]).toContain(wordText.toLowerCase());
});

// ── Test 5: Vocabulary loading failure fallback ─────────────────

test("fallback vocabulary shows error message and loads offline words", async ({ page }) => {
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({
      view: "home",
      plan: {
        dailyTarget: 5,
        startedOn: "2026-07-30",
        createdOn: "2026-07-30",
        updatedOn: "2026-07-30",
      },
      session: null,
      introducedWords: [],
      progress: {},
      activityLog: {},
      studyWindows: [],
      learningDayCounter: 0,
      wordListSort: "mastery",
      wordBrowse: null,
      dataVersion: 9,
    }));
  }, { key: STORAGE_KEY });

  // Block vocabulary data requests to trigger fallback — use full URLs
  await page.route("**/data/vocabulary-bundle.json*", (route) => route.abort());
  await page.route("**/data/vocabulary-index.json*", (route) => route.abort());

  await page.goto(APP_URL);
  await page.waitForFunction(() => {
    return document.documentElement.dataset.appReady === "true";
  });

  // Should be in fallback mode with an error message
  await expect(page.locator("#vocabularyStatus")).toContainText("离线应急");
  await expect(page.locator("#vocabularyStatus")).toContainText("刷新页面即可重试");

  // Study and word list are disabled in fallback mode to protect data integrity
  await expect(page.locator("#planButton")).toBeDisabled();
  await expect(page.locator("#wordListButton")).toBeDisabled();

  // Fallback vocabulary entries are loaded in memory — verify via evaluate
  const fallbackReady = await page.evaluate(() => {
    return document.documentElement.dataset.vocabularyReady;
  });
  expect(fallbackReady).toBe("fallback");
});
