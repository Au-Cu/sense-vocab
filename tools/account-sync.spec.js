const { test, expect } = require("@playwright/test");
const path = require("node:path");

const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const ACCOUNT_KEY = `${STORAGE_KEY}:account:user-1`;
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const FEEDBACK_IMAGE_PATH = path.resolve(
  __dirname,
  "../assets/app-icon-zoomed.png",
);

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1100, height: 850 },
});

function makeState(dailyTarget) {
  return {
    view: "home",
    plan: {
      dailyTarget,
      createdDate: "2026-07-17",
      startDate: "2026-07-17",
      advancedDays: 0,
      progressBaseWords: 0,
      progressBaseDays: 0,
    },
    session: null,
    introducedWords: [],
    progress: {},
    activityLog: {},
    studyWindows: [],
    learningDayCounter: 0,
    wordListSort: "mastery",
    wordBrowse: null,
    dataVersion: 8,
  };
}

async function waitForAccount(page) {
  await page.waitForFunction(() => {
    return document.documentElement.dataset.appReady === "true" &&
      document.documentElement.dataset.accountReady === "true";
  });
}

async function installFakeCloud(page, remote = null) {
  await page.addInitScript((initialRemote) => {
    window.__fakeCloud = {
      remote: initialRemote,
      saves: [],
      signOuts: 0,
      signUps: [],
      signupOtpVerifications: [],
      signupOtpResends: [],
      recoveryRequests: [],
      recoveryOtpVerifications: [],
      passwordUpdates: [],
      deleted: false,
      feedbacks: [],
      legalComplete: true,
      loadStateCalls: 0,
      profile: {
        registrationNumber: 42,
        membershipExpiresAt: "2026-12-31T16:00:00.000Z",
        memberActive: true,
        remainingDays: 155,
        inviteCode: "A1B2C3D4E5F6",
        inviteUsedAt: null,
      },
      notifications: {
        authenticated: true,
        unreadCount: 1,
        items: [{
          id: "notice-1",
          kind: "direct",
          type: "feedback_reply",
          title: "你的反馈收到了答复",
          body: "问题已经修复，请刷新后重试。",
          images: [{
            path: "notice-1/1.jpg",
            url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==",
          }],
          createdAt: "2026-07-29T10:00:00.000Z",
          readAt: null,
        }],
      },
      markedNotifications: [],
      blockNextDestructiveWrite: false,
    };
    window.__SENSE_VOCAB_CLOUD_FACTORY__ = () => ({
      async getSession() {
        return null;
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signUp(email, password, invitationCode = "") {
        const user = { id: "user-1", email };
        window.__fakeCloud.signUps.push({
          email,
          password,
          ...(invitationCode ? { invitationCode } : {}),
        });
        return {
          user,
          session: null,
        };
      },
      async verifySignupOtp(email, token) {
        window.__fakeCloud.signupOtpVerifications.push({ email, token });
        if (token !== "123456") throw new Error("验证码错误");
        const user = { id: "user-1", email };
        return {
          user,
          session: { user },
        };
      },
      async resendSignupOtp(email) {
        window.__fakeCloud.signupOtpResends.push(email);
        return {};
      },
      async signIn(email) {
        return {
          session: {
            user: { id: "user-1", email },
          },
        };
      },
      async sendPasswordRecoveryOtp(email) {
        window.__fakeCloud.recoveryRequests.push(email);
        return {};
      },
      async verifyRecoveryOtp(email, token) {
        window.__fakeCloud.recoveryOtpVerifications.push({ email, token });
        if (token !== "654321") throw new Error("验证码错误");
        const user = { id: "user-1", email };
        return {
          user,
          session: { user },
        };
      },
      async updatePassword(password) {
        window.__fakeCloud.passwordUpdates.push(password);
        return { user: { id: "user-1" } };
      },
      async signOut() {
        window.__fakeCloud.signOuts += 1;
      },
      async loadLegalConsents() {
        return { complete: window.__fakeCloud.legalComplete };
      },
      async recordLegalConsents() {
        window.__fakeCloud.legalComplete = true;
        return { complete: true };
      },
      async validateInvitationCode(code) {
        return code !== "USED0000";
      },
      async loadRegistrationWelcome() {
        return {
          registrationNumber: window.__fakeCloud.profile.registrationNumber,
          membershipExpiresAt: window.__fakeCloud.profile.membershipExpiresAt,
        };
      },
      async loadAccountProfile() {
        return { ...window.__fakeCloud.profile };
      },
      async loadNotifications() {
        return JSON.parse(JSON.stringify(window.__fakeCloud.notifications));
      },
      async markNotificationRead(kind, id) {
        window.__fakeCloud.markedNotifications.push({ kind, id });
        return { ok: true };
      },
      async loadState() {
        window.__fakeCloud.loadStateCalls += 1;
        return window.__fakeCloud.remote ?? {
          found: false,
          revision: 0,
          state: null,
        };
      },
      async saveState(state, expectedRevision, force = false) {
        window.__fakeCloud.saves.push({
          state: JSON.parse(JSON.stringify(state)),
          expectedRevision,
          force,
        });
        const currentRevision = window.__fakeCloud.remote?.revision ?? 0;
        if (expectedRevision !== currentRevision) {
          return {
            ok: false,
            conflict: true,
            revision: currentRevision,
          };
        }
        if (window.__fakeCloud.blockNextDestructiveWrite && !force) {
          window.__fakeCloud.blockNextDestructiveWrite = false;
          return {
            ok: false,
            conflict: false,
            destructiveBlocked: true,
            reason: "undeclared_deletions",
            revision: currentRevision,
          };
        }
        const revision = currentRevision + 1;
        window.__fakeCloud.remote = {
          found: true,
          revision,
          state: JSON.parse(JSON.stringify(state)),
        };
        return { ok: true, conflict: false, revision };
      },
      async deleteAccount() {
        window.__fakeCloud.deleted = true;
        return { ok: true };
      },
      async submitFeedback(message, files, context) {
        const feedback = {
          message,
          files: files.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        };
        if (context) feedback.context = JSON.parse(JSON.stringify(context));
        window.__fakeCloud.feedbacks.push(feedback);
        return { ok: true, id: "feedback-1" };
      },
    });
  }, remote);
}

async function openAccount(page) {
  if (await page.locator("#accountDialog").isVisible()) return;
  await page.locator("#moreButton").click();
  await page.locator("#accountButton").click();
}

async function login(page, email = "learner@example.com") {
  await openAccount(page);
  await page.locator("#accountEmail").fill(email);
  await page.locator("#accountPassword").fill("password123");
  await page.locator("#accountSubmitButton").click();
}

test("a localStorage quota error does not abort an authenticated cloud sync", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemWithQuota(key, value) {
      if (
        window.__forceAccountQuota && (
          String(key).includes(":account:") ||
          String(key).startsWith("sense-vocab-cloud-sync-v1:")
        )
      ) {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    };
  });
  await installFakeCloud(page, {
    found: true,
    revision: 1,
    state: makeState(20),
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);
  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();
  await page.locator("#closeAccountButton").click();

  await page.evaluate(() => {
    window.__forceAccountQuota = true;
  });
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("27");
  await page.locator("#savePlanButton").click();

  await expect.poll(() => page.evaluate(() => {
    return window.__fakeCloud.remote?.state?.plan?.dailyTarget ?? null;
  })).toBe(27);
  await expect(page.locator("#todayNewCount")).toHaveText("27");
  await expect.poll(() => page.evaluate(() => {
    return window.__fakeCloud.saves.at(-1)?.state?.plan?.dailyTarget ?? null;
  })).toBe(27);
});

test("guest mode remains the default when cloud credentials are absent", async ({ page }) => {
  await page.addInitScript(() => {
    window.SENSE_VOCAB_CLOUD_CONFIG = {
      supabaseUrl: "",
      supabaseAnonKey: "",
    };
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);

  await expect(page.locator("#accountHomeStatus")).toHaveCount(0);
  await expect(page.locator("#accountButton")).toHaveAttribute(
    "aria-label",
    "账户，游客",
  );
  await openAccount(page);
  await expect(page.locator("#accountStateBadge")).toHaveText("游客");
  await expect(page.locator("#accountMessage")).toContainText("云端账户尚未配置");
  await expect(page.locator("#accountSubmitButton")).toBeDisabled();
});

test("registration uses one email, one password, and an emailed OTP", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);

  await openAccount(page);
  await page.locator("#accountRegisterTab").click();
  await expect(page.locator("#accountEmailConfirmField")).toHaveCount(0);
  await expect(page.locator("#accountPasswordConfirmField")).toHaveCount(0);
  await expect(page.locator("#invitationCodeField")).toBeVisible();

  await page.locator("#accountEmail").fill("learner@example.com");
  await page.locator("#accountPassword").fill("password123");
  await page.locator("#registerTermsConsent").check();
  await page.locator("#registerCrossBorderConsent").check();
  await page.locator("#registerAgeConsent").check();
  await page.locator("#invitationCode").fill("a1b2c3d4e5f6");
  await page.locator("#accountSubmitButton").click();
  await expect.poll(async () => page.evaluate(() => window.__fakeCloud.signUps.length))
    .toBe(1);
  expect(await page.evaluate(() => window.__fakeCloud.signUps[0])).toEqual({
    email: "learner@example.com",
    password: "password123",
    invitationCode: "A1B2C3D4E5F6",
  });
  await expect(page.locator("#accountOtpField")).toBeVisible();
  await expect(page.locator("#accountEmail")).toHaveAttribute("readonly", "");
  await expect(page.locator("#accountPasswordField")).toBeHidden();
  await expect(page.locator("#accountMessage")).toContainText("10 分钟");
  await page.locator("#accountOtp").fill("123456");
  await page.locator("#accountSubmitButton").click();
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeCloud.signupOtpVerifications);
  }).toEqual([{ email: "learner@example.com", token: "123456" }]);
  await expect(page.locator("#registrationWelcomeDialog")).toBeVisible();
  await expect(page.locator("#registrationWelcomeMessage")).toHaveText(
    "恭喜你成为第 42 位注册用户",
  );
});

test("password recovery verifies an email OTP before changing the password", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);

  await openAccount(page);
  await page.locator("#forgotPasswordButton").click();
  await expect(page.locator("#accountPasswordField")).toBeHidden();
  await page.locator("#accountEmail").fill("learner@example.com");
  await page.locator("#accountSubmitButton").click();
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeCloud.recoveryRequests);
  }).toEqual(["learner@example.com"]);

  await expect(page.locator("#accountOtpField")).toBeVisible();
  await expect(page.locator("#accountPasswordField")).toBeVisible();
  await expect(page.locator("#accountPasswordLabel")).toHaveText("新密码");
  await page.locator("#accountOtp").fill("654321");
  await page.locator("#accountPassword").fill("new-password-123");
  await page.locator("#accountSubmitButton").click();

  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeCloud.recoveryOtpVerifications);
  }).toEqual([{ email: "learner@example.com", token: "654321" }]);
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeCloud.passwordUpdates);
  }).toEqual(["new-password-123"]);
  await expect(page.locator("#accountStateBadge")).toHaveText("已登录");
});

test("account membership, invite code, and two-way notifications are visible without duplicate menu entries", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);

  await login(page);
  await expect(page.locator("#accountMembershipExpiry")).toContainText("2027");
  await expect(page.locator("#accountInviteCode")).toHaveText("A1B2C3D4E5F6");
  await expect(page.locator("#accountDataActions")).not.toContainText("反馈问题");
  await expect(page.locator("#accountDataActions")).not.toContainText("条款");
  await page.locator("#closeAccountButton").click();

  await expect(page.locator("#moreButton")).toHaveClass(/has-unread/);
  await expect(page.locator("#moreButton")).toHaveAttribute(
    "aria-label",
    /1 .*未读消息/,
  );
  await page.locator("#moreButton").click();
  await expect(page.locator("#notificationBadge")).toHaveText("1");
  await page.locator("#notificationsButton").click();
  await expect(page.locator("#notificationsDialog")).toBeVisible();
  await expect(page.locator(".notification-item")).toContainText("问题已经修复");
  await expect(page.locator(".notification-images img")).toHaveCount(1);
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeCloud.markedNotifications);
  }).toEqual([{ kind: "direct", id: "notice-1" }]);
  await expect(page.locator("#moreButton")).not.toHaveClass(/has-unread/);
  await expect(page.locator("#notificationBadge")).toBeHidden();
});

test("announcements show only title and date until explicitly expanded", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);
  await page.evaluate(() => {
    window.__fakeCloud.notifications = {
      authenticated: false,
      unreadCount: 0,
      items: [{
        id: "22222222-2222-4222-8222-222222222222",
        kind: "announcement",
        type: "announcement",
        title: "置顶公告",
        body: "这段正文默认不应显示。",
        isPinned: true,
        images: [{
          path: "22222222-2222-4222-8222-222222222222/1.jpg",
          url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==",
        }],
        createdAt: "2026-08-03T10:00:00.000Z",
        readAt: null,
      }],
    };
  });

  await page.locator("#moreButton").click();
  await page.locator("#notificationsButton").click();
  const announcement = page.locator(".notification-item");
  await expect(announcement.locator(".notification-item-heading")).toContainText(
    "置顶公告",
  );
  await expect(announcement.locator(".notification-item-content")).toBeHidden();
  await expect(announcement.locator(".notification-expand-button")).toHaveText("展开");

  await announcement.locator(".notification-expand-button").click();
  await expect(announcement.locator(".notification-item-content")).toBeVisible();
  await expect(announcement).toContainText("这段正文默认不应显示。");
  await expect(announcement.locator(".notification-images img")).toHaveCount(1);
  await expect(announcement.locator(".notification-expand-button")).toHaveText("收起");

  await announcement.locator(".notification-expand-button").click();
  await expect(announcement.locator(".notification-item-content")).toBeHidden();
});

test("an expired signed-in membership disables study while guest mode stays available", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeState(20) });
  await page.reload();
  await waitForAccount(page);
  await page.evaluate(() => {
    window.__fakeCloud.profile = {
      ...window.__fakeCloud.profile,
      membershipExpiresAt: "2026-07-01T00:00:00.000Z",
      memberActive: false,
      remainingDays: 0,
    };
  });

  await expect(page.locator("#startStudyButton")).toBeEnabled();
  await login(page);
  await page.locator("#closeAccountButton").click();
  await expect(page.locator("#startStudyButton")).toHaveText("会员已到期");
  await expect(page.locator("#startStudyButton")).toBeDisabled();
});

test("existing accounts do not read cloud learning data before legal consent", async ({ page }) => {
  await installFakeCloud(page, {
    found: true,
    revision: 7,
    state: makeState(88),
  });
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      window.__fakeCloud.legalComplete = false;
    }, { once: true });
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);

  await login(page);
  await expect(page.locator("#accountConsentView")).toBeVisible();
  expect(await page.evaluate(() => window.__fakeCloud.loadStateCalls)).toBe(0);
  await expect(page.locator("#accountStateBadge")).toHaveText("待确认");

  await page.locator("#existingTermsConsent").check();
  await page.locator("#existingCrossBorderConsent").check();
  await page.locator("#existingAgeConsent").check();
  await page.locator("#acceptLegalConsentButton").click();
  await expect.poll(async () => page.evaluate(() => window.__fakeCloud.loadStateCalls))
    .toBe(1);
  await expect(page.locator("#accountStateBadge")).toHaveText("已登录");
});

test("background cloud refresh preserves an active study page on mobile", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeState(7) });
  await page.reload();
  await waitForAccount(page);
  await login(page);
  await page.locator("#closeAccountButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#studyPanel")).toBeVisible();
  const currentWord = await page.locator("#wordText").textContent();

  await page.waitForTimeout(1_000);
  await page.evaluate(() => {
    const state = window.SenseVocabApp.getState();
    const revision = (window.__fakeCloud.remote?.revision ?? 0) + 1;
    window.__fakeCloud.remote = {
      found: true,
      revision,
      state,
    };
    window.dispatchEvent(new Event("focus"));
  });

  await page.waitForTimeout(250);
  await expect(page.locator("#studyPanel")).toBeVisible();
  await expect(page.locator("#homePanel")).toBeHidden();
  await expect(page.locator("#wordText")).toHaveText(currentWord);
});

test("first login copies guest history into an isolated account cache and uploads it", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeState(37) });
  await page.reload();
  await waitForAccount(page);

  await login(page);
  await expect(page.locator("#accountEmailLabel")).toHaveText("learner@example.com");
  await expect(page.locator("#accountButton")).toHaveAttribute(
    "aria-label",
    "账户，已登录",
  );
  await expect(page.locator(".home-actions")).not.toContainText("learner@example.com");

  const result = await page.evaluate(({ guestKey, accountKey }) => ({
    activeKey: window.SenseVocabApp.getActiveStorageKey(),
    guest: JSON.parse(localStorage.getItem(guestKey)),
    account: JSON.parse(localStorage.getItem(accountKey)),
    saves: window.__fakeCloud.saves,
  }), { guestKey: STORAGE_KEY, accountKey: ACCOUNT_KEY });

  expect(result.activeKey).toBe(ACCOUNT_KEY);
  expect(result.guest.plan.dailyTarget).toBe(37);
  expect(result.account.plan.dailyTarget).toBe(37);
  expect(result.saves).toHaveLength(1);
  expect(result.saves[0].state.plan.dailyTarget).toBe(37);
  expect(result.saves[0].expectedRevision).toBe(0);
  expect(result.saves[0].force).toBe(false);

  await page.locator("#logoutButton").click();
  await expect(page.locator("#accountButton")).toHaveAttribute(
    "aria-label",
    "账户，游客",
  );
  expect(await page.evaluate(() => window.SenseVocabApp.getActiveStorageKey())).toBe(STORAGE_KEY);
});

test("existing cloud history is never overwritten silently by guest history", async ({ page }) => {
  const remoteState = makeState(55);
  remoteState.introducedWords = ["act"];
  remoteState.progress["act:v-1"] = { status: "mastered" };
  remoteState.activityLog["2026-07-28"] = {
    newWords: ["act"],
    reviewWords: [],
    newCount: 1,
    reviewCount: 0,
    target: 55,
    learningDays: [1],
  };
  const localState = makeState(23);
  localState.introducedWords = ["abandon"];
  localState.progress["abandon:v-1"] = { status: "reinforce" };
  localState.activityLog["2026-07-29"] = {
    newWords: ["abandon"],
    reviewWords: [],
    newCount: 1,
    reviewCount: 0,
    target: 23,
    learningDays: [1],
  };
  await installFakeCloud(page, {
    found: true,
    revision: 4,
    state: remoteState,
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: localState });
  await page.reload();
  await waitForAccount(page);

  await login(page);
  await expect(page.locator("#accountConflictView")).toBeVisible();
  await expect(page.locator("#mergeStateButton")).toContainText("合并两边记录");
  await expect(page.locator("#cloudRecordSummary")).toContainText("1");
  await expect(page.locator("#cloudRecordPlan")).toContainText("每天 55 词");
  await expect(page.locator("#localRecordSummary")).toContainText("1");
  await expect(page.locator("#localRecordPlan")).toContainText("每天 23 词");
  await expect(page.locator("#accountConflictDifference")).toHaveText(
    /本机独有 1 个已学单词，云端独有 1 个/,
  );
  await page.screenshot({
    path: "test-results/account-conflict-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#accountConflictView")).toBeVisible();
  const mobileLayout = await page.locator("#accountDialog .account-dialog").evaluate((dialog) => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    dialogRight: dialog.getBoundingClientRect().right,
  }));
  expect(mobileLayout.documentWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth);
  expect(mobileLayout.dialogRight).toBeLessThanOrEqual(mobileLayout.viewportWidth);
  await page.screenshot({
    path: "test-results/account-conflict-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1100, height: 850 });
  expect(await page.evaluate(() => window.__fakeCloud.saves.length)).toBe(0);

  await page.locator("#closeAccountButton").click();
  await openAccount(page);
  await expect(page.locator("#accountConflictView")).toBeVisible();

  await page.locator(".sync-conflict-advanced summary").click();
  await page.locator("#useCloudStateButton").click();
  const result = await page.evaluate(({ guestKey, accountKey }) => ({
    activeKey: window.SenseVocabApp.getActiveStorageKey(),
    guest: JSON.parse(localStorage.getItem(guestKey)),
    account: JSON.parse(localStorage.getItem(accountKey)),
    saves: window.__fakeCloud.saves.length,
  }), { guestKey: STORAGE_KEY, accountKey: ACCOUNT_KEY });

  expect(result.activeKey).toBe(ACCOUNT_KEY);
  expect(result.guest.plan.dailyTarget).toBe(23);
  expect(result.account.plan.dailyTarget).toBe(55);
  expect(result.guest.introducedWords).toContain("abandon");
  expect(result.account.introducedWords).toContain("act");
  expect(result.saves).toBe(0);
});

test("recommended conflict merge preserves unique learning from both records", async ({ page }) => {
  const remoteState = makeState(40);
  remoteState.introducedWords = ["act"];
  remoteState.progress["act:v-1"] = { status: "mastered" };
  const localState = makeState(30);
  localState.introducedWords = ["abandon"];
  localState.progress["abandon:v-1"] = { status: "reinforce" };
  await installFakeCloud(page, {
    found: true,
    revision: 7,
    state: remoteState,
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: localState });
  await page.reload();
  await waitForAccount(page);

  await login(page);
  await expect(page.locator("#accountConflictView")).toBeVisible();
  await page.locator("#mergeStateButton").click();
  await expect(page.locator("#accountUserView")).toBeVisible();
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeCloud.remote.revision);
  }).toBe(8);

  const result = await page.evaluate(({ guestKey }) => ({
    activeWords: window.SenseVocabApp.getState().introducedWords,
    remoteWords: window.__fakeCloud.remote.state.introducedWords,
    guestWords: JSON.parse(localStorage.getItem(guestKey)).introducedWords,
    lastSave: window.__fakeCloud.saves.at(-1),
  }), { guestKey: STORAGE_KEY });
  expect(result.activeWords.sort()).toEqual(["abandon", "act"]);
  expect(result.remoteWords.sort()).toEqual(["abandon", "act"]);
  expect(result.guestWords).toEqual(["abandon"]);
  expect(result.lastSave.force).toBe(false);
});

test("a CAS conflict automatically merges independent device learning", async ({ page }) => {
  await installFakeCloud(page, {
    found: true,
    revision: 1,
    state: makeState(40),
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);
  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();

  await page.evaluate(() => {
    const base = structuredClone(window.__fakeCloud.remote.state);
    const remote = structuredClone(base);
    remote.introducedWords = ["ability"];
    remote.activityLog["2026-07-28"] = {
      newWords: ["ability"],
      reviewWords: [],
      newCount: 1,
      reviewCount: 0,
      target: 40,
      learningDays: [1],
    };
    window.SenseVocabSync.stampChanges(remote, base, "remote-device");
    window.__fakeCloud.remote = {
      found: true,
      revision: 2,
      state: remote,
      updatedAt: "2026-07-28T00:01:00.000Z",
    };

    const local = window.SenseVocabApp.getState();
    local.introducedWords = ["abandon"];
    local.activityLog["2026-07-28"] = {
      newWords: ["abandon"],
      reviewWords: [],
      newCount: 1,
      reviewCount: 0,
      target: 40,
      learningDays: [1],
    };
    window.SenseVocabApp.replaceActiveState(local);
  });

  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeCloud.remote.revision);
  }).toBe(3);
  const result = await page.evaluate(() => ({
    introducedWords: window.__fakeCloud.remote.state.introducedWords,
    newWords: window.__fakeCloud.remote.state
      .activityLog["2026-07-28"].newWords,
    saves: window.__fakeCloud.saves.map((entry) => entry.expectedRevision),
    conflictVisible: !document.querySelector("#accountConflictView").hidden,
  }));

  expect(result.introducedWords.sort()).toEqual(["abandon", "ability"]);
  expect(result.newWords.sort()).toEqual(["abandon", "ability"]);
  expect(result.saves).toEqual([1, 2]);
  expect(result.conflictVisible).toBe(false);
});

test("backup import/export and account deletion preserve the separate guest record", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeState(19) });
  await page.reload();
  await waitForAccount(page);

  await openAccount(page);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportDataButton").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^sense-vocab-backup-\d{4}-\d{2}-\d{2}\.json$/);

  await page.locator("#importDataInput").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "sense-vocab-backup",
      version: 1,
      state: makeState(21),
    })),
  });
  await expect.poll(async () => {
    return page.evaluate((key) => JSON.parse(localStorage.getItem(key)).plan.dailyTarget, STORAGE_KEY);
  }).toBe(21);

  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();
  await page.locator("#deleteAccountButton").click();
  await expect(page.locator("#accountDeleteConfirm")).toBeVisible();
  await expect(page.locator("#confirmDeleteAccountButton")).toBeDisabled();
  await page.locator("#deleteAccountConfirmation").fill("删除");
  await expect(page.locator("#confirmDeleteAccountButton")).toBeDisabled();
  await page.locator("#deleteAccountConfirmation").fill("删除账户");
  await expect(page.locator("#confirmDeleteAccountButton")).toBeEnabled();
  await page.locator("#confirmDeleteAccountButton").click();
  await expect(page.locator("#accountButton")).toHaveAttribute(
    "aria-label",
    "账户，游客",
  );

  const result = await page.evaluate(({ guestKey, accountKey }) => ({
    activeKey: window.SenseVocabApp.getActiveStorageKey(),
    guest: JSON.parse(localStorage.getItem(guestKey)),
    account: localStorage.getItem(accountKey),
    deleted: window.__fakeCloud.deleted,
  }), { guestKey: STORAGE_KEY, accountKey: ACCOUNT_KEY });
  expect(result.activeKey).toBe(STORAGE_KEY);
  expect(result.guest.plan.dailyTarget).toBe(21);
  expect(result.account).toBeNull();
  expect(result.deleted).toBe(true);
});

test("signed-in users can submit text and up to four private feedback images", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);

  await login(page);
  await page.locator("#closeAccountButton").click();
  await page.locator("#moreButton").click();
  await page.locator("#homeFeedbackButton").click();
  await expect(page.locator("#accountFeedbackView")).toBeVisible();
  await page.locator("#feedbackMessage").fill("热力图日期显示不正确。");
  await page.locator("#feedbackImageInput").setInputFiles([
    FEEDBACK_IMAGE_PATH,
    FEEDBACK_IMAGE_PATH,
  ]);
  await expect(page.locator("#feedbackImageCount")).toHaveText("2 / 4");
  await expect(page.locator("#feedbackImagePreview img")).toHaveCount(2);
  await page.locator("#submitFeedbackButton").click();
  await expect(page.locator("#accountMessage")).toHaveText("反馈已提交。");

  const feedbacks = await page.evaluate(() => window.__fakeCloud.feedbacks);
  expect(feedbacks).toHaveLength(1);
  expect(feedbacks[0].message).toBe("热力图日期显示不正确。");
  expect(feedbacks[0].files).toHaveLength(2);
  feedbacks[0].files.forEach((file, index) => {
    expect(file.name).toMatch(
      new RegExp(`^feedback-\\d+-${index + 1}\\.jpg$`),
    );
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBeGreaterThan(0);
    expect(file.size).toBeLessThanOrEqual(5 * 1024 * 1024);
  });
});

test("study feedback binds the current word and stays a compact secondary action", async ({ page }) => {
  await installFakeCloud(page);
  await page.goto(APP_URL);
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: makeState(1) });
  await page.reload();
  await waitForAccount(page);

  await login(page);
  await page.locator("#closeAccountButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#studyPanel")).toBeVisible();
  const word = await page.locator("#wordText").textContent();
  const feedbackBox = await page.locator("#studyFeedbackButton").boundingBox();
  const progressBox = await page.locator("#queueProgress").boundingBox();
  expect(feedbackBox.width).toBeLessThanOrEqual(40);
  expect(feedbackBox.height).toBeLessThanOrEqual(40);
  expect(Math.abs(feedbackBox.y - progressBox.y)).toBeLessThan(16);
  await expect(page.locator("#studyFeedbackButton").locator("xpath=.."))
    .toHaveClass(/study-progress-tools/);

  await page.locator("#studyFeedbackButton").click();
  await expect(page.locator("#accountFeedbackView")).toBeVisible();
  await expect(page.locator("#feedbackContext")).toBeVisible();
  await expect(page.locator("#feedbackContextWord")).toHaveText(word);
  await page.locator("#feedbackMessage").fill("这个单词的义项需要核对。");
  await page.locator("#submitFeedbackButton").click();

  const feedback = await page.evaluate(() => window.__fakeCloud.feedbacks.at(-1));
  expect(feedback.message).toBe("这个单词的义项需要核对。");
  expect(feedback.context).toMatchObject({
    source: "study",
    wordText: word,
  });
  expect(feedback.context.wordId).toBeTruthy();
});

test("blank guest mode cannot overwrite a non-empty account after logout and login", async ({ page }) => {
  const remoteState = makeState(55);
  remoteState.introducedWords = ["ability"];
  remoteState.progress["ability:n-1"] = {
    status: "review",
    misses: 0,
    firstSeen: "2026-07-28",
    lastSeen: "2026-07-28",
  };
  await installFakeCloud(page, {
    found: true,
    revision: 7,
    state: remoteState,
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);

  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();
  expect(await page.evaluate(() => window.SenseVocabApp.getState().plan.dailyTarget)).toBe(55);

  await page.locator("#logoutButton").click();
  expect(await page.evaluate(() => ({
    activeKey: window.SenseVocabApp.getActiveStorageKey(),
    guestHasData: window.SenseVocabApp.hasLearningData(window.SenseVocabApp.getState()),
  }))).toEqual({
    activeKey: STORAGE_KEY,
    guestHasData: false,
  });

  const savesBeforeLogin = await page.evaluate(() => window.__fakeCloud.saves.length);
  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();
  const result = await page.evaluate(() => ({
    activeKey: window.SenseVocabApp.getActiveStorageKey(),
    dailyTarget: window.SenseVocabApp.getState().plan.dailyTarget,
    introducedWords: window.SenseVocabApp.getState().introducedWords,
    remoteTarget: window.__fakeCloud.remote.state.plan.dailyTarget,
    remoteWords: window.__fakeCloud.remote.state.introducedWords,
    saves: window.__fakeCloud.saves.length,
  }));

  expect(result.activeKey).toBe(ACCOUNT_KEY);
  expect(result.dailyTarget).toBe(55);
  expect(result.introducedWords).toContain("ability");
  expect(result.remoteTarget).toBe(55);
  expect(result.remoteWords).toContain("ability");
  expect(result.saves).toBe(savesBeforeLogin);
});

test("automatic sync restores cloud data instead of uploading an empty account cache", async ({ page }) => {
  const remoteState = makeState(61);
  remoteState.introducedWords = ["abandon"];
  await installFakeCloud(page, {
    found: true,
    revision: 9,
    state: remoteState,
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);
  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();

  const savesBefore = await page.evaluate(() => window.__fakeCloud.saves.length);
  await page.evaluate(() => {
    window.SenseVocabApp.replaceActiveState({});
  });

  await expect.poll(async () => page.evaluate(() => {
    return window.SenseVocabApp.getState().plan?.dailyTarget ?? null;
  })).toBe(61);
  const result = await page.evaluate(() => ({
    introducedWords: window.SenseVocabApp.getState().introducedWords,
    remoteTarget: window.__fakeCloud.remote.state.plan.dailyTarget,
    remoteWords: window.__fakeCloud.remote.state.introducedWords,
    saves: window.__fakeCloud.saves.length,
  }));

  expect(result.introducedWords).toContain("abandon");
  expect(result.remoteTarget).toBe(61);
  expect(result.remoteWords).toContain("abandon");
  expect(result.saves).toBe(savesBefore);
});

test("fallback vocabulary freezes account persistence and cloud writes", async ({ page }) => {
  const remoteState = makeState(40);
  remoteState.introducedWords = ["abandon"];
  remoteState.progress["abandon:v-1"] = {
    status: "review",
    misses: 0,
    firstSeen: "2026-07-30",
    lastSeen: "2026-07-30",
  };
  await installFakeCloud(page, {
    found: true,
    revision: 12,
    state: remoteState,
    updatedAt: "2026-07-30T12:00:00.000Z",
  });
  await page.route("**/data/vocabulary-index.json*", (route) => route.abort());
  await page.route("**/data/vocabulary-bundle.json*", (route) => route.abort());
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);
  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem(
      "sense-vocab-cloud-sync-v1:user-1",
      JSON.stringify({ revision: 12, dirty: true }),
    );
    window.dispatchEvent(new Event("online"));
  });
  await page.waitForTimeout(900);

  const result = await page.evaluate(() => {
    const snapshot = window.SenseVocabApp.getState();
    const active = snapshot.bookStates[snapshot.activeBookId];
    return {
      persistenceSafe: window.SenseVocabApp.isPersistenceSafe(),
      introducedWords: active.introducedWords,
      progress: active.progress,
      saves: window.__fakeCloud.saves.length,
      remoteWords: window.__fakeCloud.remote.state.introducedWords,
    };
  });
  expect(result.persistenceSafe).toBe(false);
  expect(result.introducedWords).toContain("abandon");
  expect(result.progress["abandon:v-1"]?.status).toBe("review");
  expect(result.saves).toBe(0);
  expect(result.remoteWords).toContain("abandon");
  await expect(page.locator("#planButton")).toBeDisabled();
  await expect(page.locator("#wordListButton")).toBeDisabled();
});

test("clean visibility and online events do not rewrite the cloud snapshot", async ({ page }) => {
  const remoteState = makeState(44);
  remoteState.introducedWords = ["abandon"];
  await installFakeCloud(page, {
    found: true,
    revision: 20,
    state: remoteState,
    updatedAt: "2026-07-30T12:00:00.000Z",
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);
  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.locator("#syncNowButton").click();
  await page.waitForTimeout(900);

  expect(await page.evaluate(() => window.__fakeCloud.saves.length)).toBe(0);
});

test("a blocked destructive shrink restores remote records before retrying", async ({ page }) => {
  const remoteState = makeState(52);
  remoteState.introducedWords = ["abandon"];
  remoteState.progress["abandon:v-1"] = {
    status: "review",
    misses: 0,
    firstSeen: "2026-07-30",
    lastSeen: "2026-07-30",
  };
  await installFakeCloud(page, {
    found: true,
    revision: 30,
    state: remoteState,
    updatedAt: "2026-07-30T12:00:00.000Z",
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAccount(page);
  await login(page);
  await expect(page.locator("#accountUserView")).toBeVisible();

  await page.evaluate(() => {
    window.__fakeCloud.blockNextDestructiveWrite = true;
    const next = window.SenseVocabApp.getState();
    next.introducedWords = [];
    next.progress = {};
    next.bookStates[next.activeBookId].introducedWords = [];
    next.bookStates[next.activeBookId].progress = {};
    window.SenseVocabApp.replaceActiveState(next, {
      stampSync: false,
      notify: true,
    });
  });

  await expect.poll(async () => page.evaluate(() => {
    return window.SenseVocabApp.getState().introducedWords.includes("abandon");
  })).toBe(true);
  const result = await page.evaluate(() => ({
    progress: window.SenseVocabApp.getState().progress,
    remoteWords: window.__fakeCloud.remote.state.introducedWords,
    forceFlags: window.__fakeCloud.saves.map((save) => save.force),
  }));
  expect(result.progress["abandon:v-1"]?.status).toBe("review");
  expect(result.remoteWords).toContain("abandon");
  expect(result.forceFlags.every((force) => force === false)).toBe(true);
});
