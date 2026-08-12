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
      announcementCompliance: [],
      pinnedAnnouncements: [],
      takenDownAnnouncements: [],
      deletedAnnouncements: [],
      complianceSnapshotUpdates: [],
      complianceReleaseUpdates: [],
      membershipUpdates: [],
      extendAllCalls: 0,
      signedOut: false,
    };
    const complianceIssues = [{
      id: "22222222-2222-4222-8222-222222222221",
      issueKey: "LC-RISK-001",
      matrixType: "legal_risk",
      category: "内容与版权",
      revision: 1,
      severity: "BLOCKER",
      status: "open",
      title: "逐义项内容权利链尚未闭合",
      description: "当前仍有字段级权利证据需要补齐。",
      nextStep: "按字段补齐来源、许可和哈希。",
      owner: "CD",
      reviewer: "LC",
      externalConfirmationRequired: true,
      reviewDueAt: null,
      isReviewDue: false,
      affectedAssets: ["data/content-rights-ledger.jsonl"],
      historyCount: 1,
      updatedAt: "2026-08-09T10:00:00.000Z",
    }, {
      id: "22222222-2222-4222-8222-222222222222",
      issueKey: "LC-RISK-002",
      matrixType: "legal_risk",
      category: "流程",
      revision: 1,
      severity: "LOW",
      status: "ready_for_review",
      title: "复核提醒待确认",
      description: "等待下一次人工复核。",
      nextStep: "确认审查日期。",
      owner: "LC",
      reviewer: "LC",
      externalConfirmationRequired: false,
      reviewDueAt: "2026-08-08",
      isReviewDue: true,
      affectedAssets: [],
      historyCount: 1,
      updatedAt: "2026-08-09T09:00:00.000Z",
    }, {
      id: "22222222-2222-4222-8222-222222222223",
      issueKey: "LC-RIGHTS-001",
      matrixType: "rights_chain",
      category: "代码依赖",
      revision: 1,
      severity: "CLEARED",
      status: "closed",
      title: "直接依赖许可证证据已核验",
      description: "当前直接依赖证据完整。",
      nextStep: "依赖升级后重新复核。",
      owner: "R&D",
      reviewer: "LC",
      externalConfirmationRequired: false,
      reviewDueAt: null,
      isReviewDue: false,
      affectedAssets: ["SBOM.cdx.json"],
      historyCount: 1,
      updatedAt: "2026-08-09T08:00:00.000Z",
    }];
    const baseSnapshot = (issue) => ({
      revision: issue.revision,
      severity: issue.severity,
      status: issue.status,
      title: issue.title,
      description: issue.description,
      verifiedFacts: "仓库事实已经核对。",
      evidenceBasis: "docs/CURRENT.md",
      lcAnalysis: "仅作为内部记录。",
      releaseImpact: "影响当前商业发行判断。",
      remediationPlan: "完成证据补充并重新复核。",
      nextStep: issue.nextStep,
      acceptanceEvidence: issue.severity === "CLEARED" ? "证据已经复核。" : "",
      unresolvedQuestions: "",
      externalConfirmationRequired: issue.externalConfirmationRequired,
      externalConfirmation: "",
      owner: issue.owner,
      reviewer: issue.reviewer,
      reviewDueAt: issue.reviewDueAt,
      affectedAssets: issue.affectedAssets,
      evidenceRefs: [{ repoPath: "docs/CURRENT.md" }],
      applicableScope: {
        appVersion: "1.4.0",
        channels: ["Web"],
        businessModel: "内部测试",
        jurisdictions: [],
        reviewDate: "2026-08-09",
      },
      rightsClearance: issue.severity === "CLEARED" ? {
        authorOrRightsholder: "逐依赖权利人",
        licenseOrPermission: "逐依赖许可证",
        sourceUrl: "https://www.npmjs.com/",
        versionOrDate: "2026-08-09",
        commercialScope: "当前锁文件",
        sha256: "a".repeat(64),
      } : {},
      contentHashBefore: null,
      contentHashAfter: null,
      changeSummary: "导入初始快照。",
      updatedBy: null,
      updatedAt: issue.updatedAt,
    });
    const complianceSnapshots = Object.fromEntries(
      complianceIssues.map((issue) => [issue.id, [baseSnapshot(issue)]]),
    );
    let complianceRelease = {
      revision: 1,
      conclusion: "not_releasable",
      appVersion: "1.4.0",
      commitSha: null,
      channels: ["Web"],
      businessModel: "收费商业发行",
      jurisdictions: [],
      reviewDate: "2026-08-09",
      evidenceGeneratedAt: "2026-08-09T10:00:00.000Z",
      scopeNotes: "适用 commit 未知。",
      basis: "仍有 BLOCKER 未解决。",
      evidenceRefs: [{ repoPath: "COMMERCIAL_RELEASE_CHECKLIST.md" }],
      reviewer: "LC",
      changeSummary: "导入初始结论。",
      updatedBy: null,
      updatedAt: "2026-08-09T10:00:00.000Z",
    };
    const complianceReleaseHistory = [complianceRelease];
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
          items: window.__fakeAdmin.announcements
            .slice()
            .sort((left, right) => Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)))
            .map((item) => ({
              ...item,
              publishedAt: "2026-07-29T10:00:00.000Z",
            })),
        };
      },
      async loadAdminCompliance() {
        const counts = {
          total: complianceIssues.length,
          BLOCKER: complianceIssues.filter((item) => item.severity === "BLOCKER").length,
          HIGH: complianceIssues.filter((item) => item.severity === "HIGH").length,
          MEDIUM: complianceIssues.filter((item) => item.severity === "MEDIUM").length,
          LOW: complianceIssues.filter((item) => item.severity === "LOW").length,
          CLEARED: complianceIssues.filter((item) => item.severity === "CLEARED").length,
          reviewDue: complianceIssues.filter((item) => item.isReviewDue).length,
        };
        return {
          release: complianceRelease,
          releaseHistory: complianceReleaseHistory,
          releaseHistoryCount: complianceReleaseHistory.length,
          counts,
          issues: complianceIssues,
        };
      },
      async loadAdminComplianceIssue(id) {
        const issue = complianceIssues.find((item) => item.id === id);
        return {
          id: issue.id,
          issueKey: issue.issueKey,
          matrixType: issue.matrixType,
          category: issue.category,
          createdAt: "2026-08-09T08:00:00.000Z",
          snapshots: complianceSnapshots[id],
        };
      },
      async createComplianceIssue(matrixType, category, snapshot) {
        const id = "22222222-2222-4222-8222-222222222229";
        const issueKey = "LC-NEW-001";
        const saved = {
          ...snapshot,
          revision: 1,
          updatedBy: "admin-user",
          updatedAt: new Date().toISOString(),
        };
        complianceSnapshots[id] = [saved];
        complianceIssues.push({
          id,
          issueKey,
          matrixType,
          category,
          revision: 1,
          severity: snapshot.severity,
          status: snapshot.status,
          title: snapshot.title,
          description: snapshot.description,
          nextStep: snapshot.nextStep,
          owner: snapshot.owner,
          reviewer: snapshot.reviewer,
          externalConfirmationRequired: snapshot.externalConfirmationRequired,
          reviewDueAt: snapshot.reviewDueAt,
          isReviewDue: false,
          affectedAssets: snapshot.affectedAssets,
          historyCount: 1,
          updatedAt: saved.updatedAt,
        });
        return { ok: true, id, issueKey, revision: 1 };
      },
      async appendComplianceIssueSnapshot(id, expectedRevision, snapshot) {
        const revision = expectedRevision + 1;
        const saved = {
          ...snapshot,
          revision,
          updatedBy: "admin-user",
          updatedAt: new Date().toISOString(),
        };
        complianceSnapshots[id].unshift(saved);
        const issue = complianceIssues.find((item) => item.id === id);
        Object.assign(issue, {
          revision,
          severity: snapshot.severity,
          status: snapshot.status,
          title: snapshot.title,
          description: snapshot.description,
          nextStep: snapshot.nextStep,
          owner: snapshot.owner,
          reviewer: snapshot.reviewer,
          externalConfirmationRequired: snapshot.externalConfirmationRequired,
          reviewDueAt: snapshot.reviewDueAt,
          affectedAssets: snapshot.affectedAssets,
          historyCount: complianceSnapshots[id].length,
          updatedAt: saved.updatedAt,
        });
        window.__fakeAdmin.complianceSnapshotUpdates.push({ id, expectedRevision, snapshot });
        return { ok: true, id, issueKey: issue.issueKey, revision };
      },
      async appendComplianceReleaseSnapshot(expectedRevision, snapshot) {
        complianceRelease = {
          ...snapshot,
          revision: expectedRevision + 1,
          updatedBy: "admin-user",
          updatedAt: new Date().toISOString(),
        };
        complianceReleaseHistory.unshift(complianceRelease);
        window.__fakeAdmin.complianceReleaseUpdates.push({ expectedRevision, snapshot });
        return {
          ok: true,
          revision: complianceRelease.revision,
          conclusion: complianceRelease.conclusion,
        };
      },
      async publishAnnouncement(title, body, files = [], compliance = {}) {
        window.__fakeAdmin.announcementImageCounts.push(files.length);
        window.__fakeAdmin.announcementCompliance.push(compliance);
        window.__fakeAdmin.announcements.unshift({
          id: "11111111-1111-4111-8111-111111111111",
          title,
          body,
          isPinned: false,
          rightsStatus: "verified",
          rightsMetadata: Array.from(files).map(() => ({
            rightsBasis: compliance.rightsBasis,
          })),
          contentProvenance: { textOrigin: compliance.textOrigin },
          images: Array.from(files).map((file, index) => ({
            path: `announcement-${index + 1}.jpg`,
            url: URL.createObjectURL(file),
          })),
        });
        return { ok: true };
      },
      async setAnnouncementPinned(id, pinned) {
        window.__fakeAdmin.pinnedAnnouncements.push({ id, pinned });
        const announcement = window.__fakeAdmin.announcements.find(
          (item) => item.id === id,
        );
        if (announcement) announcement.isPinned = pinned;
        return { ok: true, id, isPinned: pinned, changed: true };
      },
      async takedownAnnouncement(id, reason) {
        window.__fakeAdmin.takenDownAnnouncements.push({ id, reason });
        const announcement = window.__fakeAdmin.announcements.find(
          (item) => item.id === id,
        );
        if (announcement) {
          announcement.rightsStatus = "withdrawn";
          announcement.images = [];
        }
        return { ok: true, id, status: "withdrawn" };
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
  await expect(page.locator("#nextButton")).toBeHidden();
  await expect(page.locator("#exitStudyButton")).toHaveText("返回");
  await page.locator("#exitStudyButton").click();
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
  await page.locator("#announcementRightsAuthor").fill("Sense Vocab 团队");
  await page.locator("#announcementHumanReviewed").check();
  await page.locator("#publishAnnouncementButton").click();
  await expect(page.locator(".announcement-item")).toContainText("版本更新");
  await expect(page.locator(".announcement-item .announcement-images img")).toHaveCount(1);
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeAdmin.announcementImageCounts);
  }).toEqual([1]);
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeAdmin.announcementCompliance);
  }).toEqual([{
    rightsBasis: "original",
    author: "Sense Vocab 团队",
    sourceUrl: "",
    license: "",
    authorizationReference: "",
    textOrigin: "original",
    provider: "",
    model: "",
    promptHash: "",
    containsIdentifiablePeople: false,
    personConsentBasis: "",
    disclosureLabel: false,
    humanReviewed: true,
  }]);
  await page.locator(".announcement-pin-button").click();
  await expect(page.locator(".announcement-item")).toHaveClass(/is-pinned/);
  await expect(page.locator(".announcement-pin-button")).toHaveText("取消置顶");
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeAdmin.pinnedAnnouncements);
  }).toEqual([{
    id: "11111111-1111-4111-8111-111111111111",
    pinned: true,
  }]);
  page.once("dialog", (dialog) => dialog.accept("收到权利人通知，工单 LC-1"));
  await page.locator(".announcement-takedown-button").click();
  await expect(page.locator(".announcement-item")).toContainText("已下架");
  await expect(page.locator(".announcement-item .announcement-images img")).toHaveCount(0);
  await expect.poll(async () => {
    return page.evaluate(() => window.__fakeAdmin.takenDownAnnouncements);
  }).toEqual([{
    id: "11111111-1111-4111-8111-111111111111",
    reason: "收到权利人通知，工单 LC-1",
  }]);
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

test("compliance issues render as colored cards and append historical snapshots", async ({
  page,
}) => {
  await installAdminCloud(page, true);
  await page.goto(ADMIN_URL);
  await page.locator("#complianceTab").click();

  await expect(page.locator("#complianceSection")).toBeVisible();
  await expect(page.locator("#complianceReleaseConclusion")).toHaveText("不可发行");
  await expect(page.locator(".compliance-card")).toHaveCount(3);
  await expect(page.locator(".compliance-card").nth(0)).toHaveClass(/tone-critical/);
  await expect(page.locator(".compliance-card").nth(1)).toHaveClass(/tone-warning/);
  await expect(page.locator(".compliance-card").nth(2)).toHaveClass(/tone-cleared/);
  await expect(page.locator(".compliance-card").nth(0)).toHaveCSS(
    "background-color",
    "rgb(255, 241, 240)",
  );
  await expect(page.locator(".compliance-card").nth(1)).toHaveCSS(
    "background-color",
    "rgb(255, 248, 219)",
  );
  await expect(page.locator(".compliance-card").nth(2)).toHaveCSS(
    "background-color",
    "rgb(236, 253, 243)",
  );

  await page.locator("#complianceSeverityFilter").selectOption("CLEARED");
  await expect(page.locator(".compliance-card")).toHaveCount(1);
  await expect(page.locator(".compliance-card")).toContainText("直接依赖许可证证据已核验");
  await page.locator("#complianceSeverityFilter").selectOption("");

  await page.locator('.compliance-card[data-issue-id="22222222-2222-4222-8222-222222222221"]').click();
  await expect(page.locator("#complianceIssueDialog")).toBeVisible();
  await expect(page.locator("#complianceHistoryCount")).toHaveText("1 个快照");
  await expect(page.locator("#complianceDetailCurrent")).toContainText(
    "当前仍有字段级权利证据需要补齐",
  );

  await page.locator("#editComplianceIssueButton").click();
  await page.locator("#complianceIssueSeverity").selectOption("MEDIUM");
  await page.locator("#complianceIssueStatus").selectOption("remediation_in_progress");
  await page.locator("#complianceIssueDescription").fill(
    "首批字段已经补齐，剩余字段继续整改。",
  );
  await page.locator("#complianceIssueNextStep").fill("完成第二批字段证据并交由 LC 复核。");
  await page.locator("#complianceIssueChangeSummary").fill("首批整改完成，风险由 BLOCKER 降为 MEDIUM。");
  await page.locator("#saveComplianceIssueButton").click();

  await expect(page.locator("#complianceIssueReadView")).toBeVisible();
  await expect(page.locator("#complianceHistoryCount")).toHaveText("2 个快照");
  await expect(page.locator("#complianceDetailCurrent")).toContainText(
    "首批字段已经补齐",
  );
  await expect(page.locator("#complianceDetailCurrent .compliance-badge").first()).toHaveText(
    "MEDIUM",
  );
  await expect.poll(async () => page.evaluate(() => {
    return window.__fakeAdmin.complianceSnapshotUpdates.length;
  })).toBe(1);

  await page.locator("#closeComplianceIssueButton").click();
  const updatedCard = page.locator(
    '.compliance-card[data-issue-id="22222222-2222-4222-8222-222222222221"]',
  );
  await expect(updatedCard).toHaveClass(/tone-warning/);
  await expect(updatedCard).toContainText("首批字段已经补齐");

  await page.locator("#editComplianceReleaseButton").click();
  await page.locator("#complianceReleaseFormBasis").fill("仍有未解决问题，但依据已经更新。");
  await page.locator("#complianceReleaseChangeSummary").fill("补充本轮复核结论。");
  await page.locator("#saveComplianceReleaseButton").click();
  await expect(page.locator("#complianceReleaseRevision")).toHaveText("快照 #2");
  await expect(page.locator("#complianceReleaseHistoryCount")).toHaveText("2 个快照");
  await page.locator("#complianceReleaseHistoryDetails").click();
  await expect(page.locator("#complianceReleaseHistory .compliance-history-item"))
    .toHaveCount(2);
  await expect.poll(async () => page.evaluate(() => {
    return window.__fakeAdmin.complianceReleaseUpdates.length;
  })).toBe(1);
});

test("compliance cards and history dialog remain usable on a phone viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAdminCloud(page, true);
  await page.goto(ADMIN_URL);
  await page.locator("#complianceTab").click();

  await expect(page.locator(".compliance-card")).toHaveCount(3);
  const railMetrics = await page.locator("#complianceCardRail").evaluate((rail) => ({
    clientWidth: rail.clientWidth,
    scrollWidth: rail.scrollWidth,
    firstCardWidth: rail.firstElementChild?.getBoundingClientRect().width ?? 0,
  }));
  expect(railMetrics.scrollWidth).toBeGreaterThan(railMetrics.clientWidth);
  expect(railMetrics.firstCardWidth).toBeLessThanOrEqual(360);

  await page.locator(".compliance-card").first().click();
  await expect(page.locator("#complianceIssueDialog")).toBeVisible();
  const dialogBox = await page.locator("#complianceIssueDialog").boundingBox();
  expect(dialogBox.width).toBeLessThanOrEqual(382);
  await expect(page.locator("#editComplianceIssueButton")).toBeVisible();
});
