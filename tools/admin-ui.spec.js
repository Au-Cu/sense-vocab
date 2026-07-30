const { test, expect } = require("@playwright/test");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const ADMIN_URL = new URL("admin.html", APP_URL).href;

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1280, height: 900 },
});

async function installAdminCloud(page, isAdmin = true) {
  await page.addInitScript((allowed) => {
    const session = {
      user: { id: "admin-user", email: "owner@example.com" },
    };
    window.__fakeAdmin = {
      updated: [],
      replies: [],
      announcements: [],
      announcementImageCounts: [],
      deletedAnnouncements: [],
      membershipUpdates: [],
      extendAllCalls: 0,
      signedOut: false,
    };
    window.__SENSE_VOCAB_CLOUD_FACTORY__ = () => ({
      async getSession() {
        return session;
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signIn() {
        return { session };
      },
      async signOut() {
        window.__fakeAdmin.signedOut = true;
      },
      async isAdmin() {
        return allowed;
      },
      async loadAdminDashboard() {
        return {
          registeredUsers: 12,
          todayNewUsers: 2,
          dau: 5,
          wau: 9,
          mau: 11,
          d1Retention: 60,
          d7Retention: 40,
          d30Retention: null,
          newFeedback: 1,
        };
      },
      async loadAdminUsers() {
        return {
          total: 1,
          items: [{
            userId: "user-1",
            email: "learner@example.com",
            registeredAt: "2026-07-17T02:00:00.000Z",
            lastStudyDate: "2026-07-27",
            studyDays: 10,
            currentStreak: 4,
            lastSyncAt: "2026-07-27T12:00:00.000Z",
          }],
        };
      },
      async loadAdminUserDetail() {
        return {
          userId: "user-1",
          email: "learner@example.com",
          registeredAt: "2026-07-17T02:00:00.000Z",
          lastSyncAt: "2026-07-27T12:00:00.000Z",
          bookId: "ielts",
          membershipExpiresAt: "2026-10-01T00:00:00.000Z",
          membershipRemainingDays: 64,
          introducedWords: 440,
          feedbackCount: 1,
          plan: { dailyTarget: 40 },
          learning: {
            lastStudyDate: "2026-07-27",
            studyDays: 10,
            currentStreak: 4,
          },
          senseStatus: {
            new: 4000,
            reinforce: 32,
            review: 20,
            mastered: 500,
          },
        };
      },
      async loadAdminFeedback() {
        return {
          total: 1,
          items: [{
            id: "feedback-1",
            userId: "user-1",
            email: "learner@example.com",
            message: "学习记录需要核对。",
            status: "new",
            createdAt: "2026-07-28T02:00:00.000Z",
            context: {
              source: "study",
              wordId: "shepherd",
              wordText: "shepherd",
            },
            images: [{
              path: "user-1/feedback-1/1.png",
              url: "data:image/png;base64,iVBORw0KGgo=",
            }],
          }],
        };
      },
      async updateFeedbackStatus(id, status) {
        window.__fakeAdmin.updated.push({ id, status });
        return { ok: true };
      },
      async replyToFeedback(id, message) {
        window.__fakeAdmin.replies.push({ id, message });
        return { ok: true };
      },
      async loadAdminAnnouncements() {
        return {
          items: window.__fakeAdmin.announcements.map((item) => ({
            ...item,
            publishedAt: "2026-07-29T10:00:00.000Z",
          })),
        };
      },
      async publishAnnouncement(title, body, files = []) {
        window.__fakeAdmin.announcementImageCounts.push(files.length);
        window.__fakeAdmin.announcements.unshift({
          id: "11111111-1111-4111-8111-111111111111",
          title,
          body,
          images: Array.from(files).map((file, index) => ({
            path: `announcement-${index + 1}.jpg`,
            url: URL.createObjectURL(file),
          })),
        });
        return { ok: true };
      },
      async deleteAnnouncement(id) {
        window.__fakeAdmin.deletedAnnouncements.push(id);
        window.__fakeAdmin.announcements =
          window.__fakeAdmin.announcements.filter((item) => item.id !== id);
        return { ok: true, deleted: true, imageCleanupFailed: false };
      },
      async setUserMembershipDays(userId, days) {
        window.__fakeAdmin.membershipUpdates.push({ userId, days });
        return { ok: true, remainingDays: days, extendedDays: days - 64 };
      },
      async extendAllMemberships() {
        window.__fakeAdmin.extendAllCalls += 1;
        return { ok: true, affectedUsers: 12 };
      },
    });
  }, isAdmin);
}

test("the public home has no admin entry and does not expose the account email", async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page.locator('a[href*="admin"]')).toHaveCount(0);
  await expect(page.locator("#accountHomeStatus")).toHaveCount(0);
});

test("a non-admin session cannot enter the dashboard", async ({ page }) => {
  await installAdminCloud(page, false);
  await page.goto(ADMIN_URL);
  await expect(page.locator("#adminDeniedView")).toBeVisible();
  await expect(page.locator("#adminDashboard")).toBeHidden();
});

test("a feedback word link opens the matching read-only word card", async ({ page }) => {
  const wordUrl = new URL(APP_URL);
  wordUrl.searchParams.set("word", "shepherd");
  await page.goto(wordUrl.href);
  await page.waitForFunction(() => {
    return document.documentElement.dataset.appReady === "true";
  });

  await expect(page.locator("#studyPanel")).toBeVisible();
  await expect(page.locator("#wordText")).toHaveText("shepherd");
  await expect(page.locator("#cardMode")).toHaveText("单词卡片");
  await expect(page.locator("#senseArea")).toBeVisible();
  await expect(page.locator("#nextButton")).toHaveText("返回首页");
  await page.locator("#nextButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  await expect(page).not.toHaveURL(/word=shepherd/);
});

test("the admin dashboard renders metrics, user details, and feedback", async ({ page }) => {
  await installAdminCloud(page, true);
  await page.goto(ADMIN_URL);

  await expect(page.locator("#adminDashboard")).toBeVisible();
  await expect(page.locator(".metric-card")).toHaveCount(9);
  await expect(page.locator(".metric-card").first()).toContainText("12");
  await expect(page.locator("#usersTableBody")).toContainText("learner@example.com");
  await expect(page.locator("#usersTableBody")).toContainText("10 天");

  await page.locator(".user-link").click();
  await expect(page.locator("#userDetailDialog")).toBeVisible();
  await expect(page.locator("#userDetailGrid")).toContainText("每日新学计划");
  await expect(page.locator("#userDetailGrid")).toContainText("雅思词汇");
  await expect(page.locator("#userDetailGrid")).toContainText("会员到期日");
  await expect(page.locator("#userDetailGrid")).not.toContainText("学习记录");
  await expect(page.locator("#userSenseStatus")).toContainText("已掌握");
  await expect(page.locator("#membershipDaysInput")).toHaveValue("64");
  await page.locator("#membershipDaysInput").fill("70");
  await page.locator("#setMembershipButton").click();
  await expect.poll(async () => page.evaluate(() => {
    return window.__fakeAdmin.membershipUpdates;
  })).toEqual([{ userId: "user-1", days: 70 }]);
  await expect(page.locator("#adminMessage")).toContainText("延长 6 天");
  await page.locator("#closeUserDetailButton").click();

  await page.locator("#feedbackTab").click();
  await expect(page.locator("#feedbackSection")).toBeVisible();
  await expect(page.locator(".feedback-item")).toContainText("学习记录需要核对");
  await expect(page.locator(".feedback-images img")).toHaveCount(1);
  await expect(page.locator(".feedback-word-link")).toHaveText("查看单词：shepherd");
  await expect(page.locator(".feedback-word-link")).toHaveAttribute(
    "href",
    `${new URL("./", ADMIN_URL).href}?word=shepherd`,
  );
  await page.locator(".feedback-status").selectOption("in_progress");
  await expect.poll(async () => page.evaluate(() => window.__fakeAdmin.updated)).toEqual([
    { id: "feedback-1", status: "in_progress" },
  ]);

  await page.locator(".feedback-reply-editor textarea").fill("已经修复，请刷新页面。");
  await page.locator(".feedback-reply-editor button").click();
  await expect.poll(async () => page.evaluate(() => window.__fakeAdmin.replies)).toEqual([
    { id: "feedback-1", message: "已经修复，请刷新页面。" },
  ]);

  await page.locator("#announcementsTab").click();
  await page.locator("#announcementTitle").fill("版本更新");
  await page.locator("#announcementBody").fill("新增会员与消息通知功能。");
  await page.locator("#announcementImageInput").setInputFiles({
    name: "announcement.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator("#announcementImageCount")).toHaveText("1 / 4");
  await expect(page.locator("#announcementImagePreview img")).toHaveCount(1);
  await page.locator("#publishAnnouncementButton").click();
  await expect(page.locator(".announcement-item")).toContainText("版本更新");
  await expect(page.locator(".announcement-item .announcement-images img")).toHaveCount(1);
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeAdmin.announcementImageCounts);
  }).toEqual([1]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".announcement-delete-button").click();
  await expect(page.locator(".announcement-item")).toHaveCount(0);
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeAdmin.deletedAnnouncements);
  }).toEqual(["11111111-1111-4111-8111-111111111111"]);

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#extendAllMembershipsButton").click();
  await expect.poll(async () => page.evaluate(() => window.__fakeAdmin.extendAllCalls))
    .toBe(1);
});
