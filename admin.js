(() => {
  const config = window.SENSE_VOCAB_CLOUD_CONFIG ?? {};
  const factory = window.__SENSE_VOCAB_CLOUD_FACTORY__ ??
    window.SenseVocabCloud?.create;
  const cloud = typeof factory === "function" ? factory(config) : null;

  const adminHeaderActions = document.querySelector("#adminHeaderActions");
  const adminMessage = document.querySelector("#adminMessage");
  const adminLoginView = document.querySelector("#adminLoginView");
  const adminDeniedView = document.querySelector("#adminDeniedView");
  const adminDashboard = document.querySelector("#adminDashboard");
  const adminLoginForm = document.querySelector("#adminLoginForm");
  const adminEmail = document.querySelector("#adminEmail");
  const adminPassword = document.querySelector("#adminPassword");
  const adminLoginButton = document.querySelector("#adminLoginButton");
  const adminLogoutButton = document.querySelector("#adminLogoutButton");
  const deniedLogoutButton = document.querySelector("#deniedLogoutButton");
  const extendAllMembershipsButton = document.querySelector(
    "#extendAllMembershipsButton",
  );
  const refreshAdminButton = document.querySelector("#refreshAdminButton");
  const overviewUpdatedAt = document.querySelector("#overviewUpdatedAt");
  const metricGrid = document.querySelector("#metricGrid");
  const usersTab = document.querySelector("#usersTab");
  const feedbackTab = document.querySelector("#feedbackTab");
  const announcementsTab = document.querySelector("#announcementsTab");
  const complianceTab = document.querySelector("#complianceTab");
  const usersSection = document.querySelector("#usersSection");
  const feedbackSection = document.querySelector("#feedbackSection");
  const announcementsSection = document.querySelector("#announcementsSection");
  const complianceSection = document.querySelector("#complianceSection");
  const userSearchForm = document.querySelector("#userSearchForm");
  const userSearchInput = document.querySelector("#userSearchInput");
  const usersTotal = document.querySelector("#usersTotal");
  const usersTableBody = document.querySelector("#usersTableBody");
  const previousUsersButton = document.querySelector("#previousUsersButton");
  const nextUsersButton = document.querySelector("#nextUsersButton");
  const usersPageLabel = document.querySelector("#usersPageLabel");
  const feedbackStatusFilter = document.querySelector("#feedbackStatusFilter");
  const feedbackTotal = document.querySelector("#feedbackTotal");
  const adminFeedbackList = document.querySelector("#adminFeedbackList");
  const announcementForm = document.querySelector("#announcementForm");
  const announcementTitle = document.querySelector("#announcementTitle");
  const announcementBody = document.querySelector("#announcementBody");
  const announcementImageInput = document.querySelector(
    "#announcementImageInput",
  );
  const announcementImageCount = document.querySelector(
    "#announcementImageCount",
  );
  const announcementImagePreview = document.querySelector(
    "#announcementImagePreview",
  );
  const announcementRightsBasis = document.querySelector("#announcementRightsBasis");
  const announcementRightsAuthor = document.querySelector("#announcementRightsAuthor");
  const announcementRightsSourceUrl = document.querySelector("#announcementRightsSourceUrl");
  const announcementRightsLicense = document.querySelector("#announcementRightsLicense");
  const announcementAuthorizationReference = document.querySelector(
    "#announcementAuthorizationReference",
  );
  const announcementPersonConsentBasis = document.querySelector(
    "#announcementPersonConsentBasis",
  );
  const announcementTextOrigin = document.querySelector("#announcementTextOrigin");
  const announcementAiProvider = document.querySelector("#announcementAiProvider");
  const announcementAiModel = document.querySelector("#announcementAiModel");
  const announcementPromptHash = document.querySelector("#announcementPromptHash");
  const announcementContainsPeople = document.querySelector("#announcementContainsPeople");
  const announcementDisclosureLabel = document.querySelector("#announcementDisclosureLabel");
  const announcementHumanReviewed = document.querySelector("#announcementHumanReviewed");
  const publishAnnouncementButton = document.querySelector(
    "#publishAnnouncementButton",
  );
  const announcementList = document.querySelector("#announcementList");
  const userDetailDialog = document.querySelector("#userDetailDialog");
  const userDetailEmail = document.querySelector("#userDetailEmail");
  const userDetailGrid = document.querySelector("#userDetailGrid");
  const userSenseStatus = document.querySelector("#userSenseStatus");
  const membershipDaysInput = document.querySelector("#membershipDaysInput");
  const setMembershipButton = document.querySelector("#setMembershipButton");
  const closeUserDetailButton = document.querySelector("#closeUserDetailButton");
  const newComplianceIssueButton = document.querySelector("#newComplianceIssueButton");
  const complianceReleaseCard = document.querySelector("#complianceReleaseCard");
  const complianceReleaseConclusion = document.querySelector(
    "#complianceReleaseConclusion",
  );
  const complianceReleaseRevision = document.querySelector("#complianceReleaseRevision");
  const complianceReleaseMeta = document.querySelector("#complianceReleaseMeta");
  const complianceReleaseBasis = document.querySelector("#complianceReleaseBasis");
  const complianceReleaseHistoryCount = document.querySelector(
    "#complianceReleaseHistoryCount",
  );
  const complianceReleaseHistory = document.querySelector("#complianceReleaseHistory");
  const editComplianceReleaseButton = document.querySelector(
    "#editComplianceReleaseButton",
  );
  const complianceCounts = document.querySelector("#complianceCounts");
  const complianceFilters = document.querySelector("#complianceFilters");
  const complianceMatrixFilter = document.querySelector("#complianceMatrixFilter");
  const complianceSeverityFilter = document.querySelector("#complianceSeverityFilter");
  const complianceCategoryFilter = document.querySelector("#complianceCategoryFilter");
  const complianceStatusFilter = document.querySelector("#complianceStatusFilter");
  const complianceOwnerFilter = document.querySelector("#complianceOwnerFilter");
  const complianceExternalFilter = document.querySelector("#complianceExternalFilter");
  const complianceDueFilter = document.querySelector("#complianceDueFilter");
  const complianceSearchInput = document.querySelector("#complianceSearchInput");
  const complianceResultSummary = document.querySelector("#complianceResultSummary");
  const complianceCardRail = document.querySelector("#complianceCardRail");
  const complianceEmpty = document.querySelector("#complianceEmpty");
  const complianceIssueDialog = document.querySelector("#complianceIssueDialog");
  const complianceIssueEyebrow = document.querySelector("#complianceIssueEyebrow");
  const complianceIssueDialogTitle = document.querySelector(
    "#complianceIssueDialogTitle",
  );
  const closeComplianceIssueButton = document.querySelector(
    "#closeComplianceIssueButton",
  );
  const complianceIssueReadView = document.querySelector("#complianceIssueReadView");
  const complianceDetailCurrent = document.querySelector("#complianceDetailCurrent");
  const editComplianceIssueButton = document.querySelector("#editComplianceIssueButton");
  const complianceHistoryCount = document.querySelector("#complianceHistoryCount");
  const complianceHistory = document.querySelector("#complianceHistory");
  const complianceIssueForm = document.querySelector("#complianceIssueForm");
  const complianceIssueMatrixType = document.querySelector("#complianceIssueMatrixType");
  const complianceIssueCategory = document.querySelector("#complianceIssueCategory");
  const complianceIssueTitle = document.querySelector("#complianceIssueTitle");
  const complianceIssueSeverity = document.querySelector("#complianceIssueSeverity");
  const complianceIssueStatus = document.querySelector("#complianceIssueStatus");
  const complianceIssueDescription = document.querySelector(
    "#complianceIssueDescription",
  );
  const complianceIssueNextStep = document.querySelector("#complianceIssueNextStep");
  const complianceIssueChangeSummary = document.querySelector(
    "#complianceIssueChangeSummary",
  );
  const complianceIssueOwner = document.querySelector("#complianceIssueOwner");
  const complianceIssueReviewer = document.querySelector("#complianceIssueReviewer");
  const complianceIssueReviewDue = document.querySelector("#complianceIssueReviewDue");
  const complianceIssueExternalRequired = document.querySelector(
    "#complianceIssueExternalRequired",
  );
  const complianceIssueVerifiedFacts = document.querySelector(
    "#complianceIssueVerifiedFacts",
  );
  const complianceIssueEvidenceBasis = document.querySelector(
    "#complianceIssueEvidenceBasis",
  );
  const complianceIssueAnalysis = document.querySelector("#complianceIssueAnalysis");
  const complianceIssueReleaseImpact = document.querySelector(
    "#complianceIssueReleaseImpact",
  );
  const complianceIssueRemediationPlan = document.querySelector(
    "#complianceIssueRemediationPlan",
  );
  const complianceIssueAcceptanceEvidence = document.querySelector(
    "#complianceIssueAcceptanceEvidence",
  );
  const complianceIssueUnresolved = document.querySelector("#complianceIssueUnresolved");
  const complianceIssueExternalConfirmation = document.querySelector(
    "#complianceIssueExternalConfirmation",
  );
  const complianceIssueAssets = document.querySelector("#complianceIssueAssets");
  const complianceIssueEvidenceRefs = document.querySelector(
    "#complianceIssueEvidenceRefs",
  );
  const complianceIssueScopeVersion = document.querySelector(
    "#complianceIssueScopeVersion",
  );
  const complianceIssueScopeCommit = document.querySelector("#complianceIssueScopeCommit");
  const complianceIssueScopeChannels = document.querySelector(
    "#complianceIssueScopeChannels",
  );
  const complianceIssueScopeJurisdictions = document.querySelector(
    "#complianceIssueScopeJurisdictions",
  );
  const complianceIssueScopeBusiness = document.querySelector(
    "#complianceIssueScopeBusiness",
  );
  const complianceIssueHashBefore = document.querySelector("#complianceIssueHashBefore");
  const complianceIssueHashAfter = document.querySelector("#complianceIssueHashAfter");
  const complianceRightsFields = document.querySelector("#complianceRightsFields");
  const complianceRightsAuthor = document.querySelector("#complianceRightsAuthor");
  const complianceRightsLicense = document.querySelector("#complianceRightsLicense");
  const complianceRightsSourceUrl = document.querySelector("#complianceRightsSourceUrl");
  const complianceRightsVersion = document.querySelector("#complianceRightsVersion");
  const complianceRightsCommercialScope = document.querySelector(
    "#complianceRightsCommercialScope",
  );
  const complianceRightsSha256 = document.querySelector("#complianceRightsSha256");
  const saveComplianceIssueButton = document.querySelector("#saveComplianceIssueButton");
  const cancelComplianceIssueEditButton = document.querySelector(
    "#cancelComplianceIssueEditButton",
  );
  const complianceReleaseDialog = document.querySelector("#complianceReleaseDialog");
  const closeComplianceReleaseButton = document.querySelector(
    "#closeComplianceReleaseButton",
  );
  const complianceReleaseForm = document.querySelector("#complianceReleaseForm");
  const complianceReleaseFormConclusion = document.querySelector(
    "#complianceReleaseFormConclusion",
  );
  const complianceReleaseVersion = document.querySelector("#complianceReleaseVersion");
  const complianceReleaseCommit = document.querySelector("#complianceReleaseCommit");
  const complianceReleaseChannels = document.querySelector("#complianceReleaseChannels");
  const complianceReleaseJurisdictions = document.querySelector(
    "#complianceReleaseJurisdictions",
  );
  const complianceReleaseBusiness = document.querySelector("#complianceReleaseBusiness");
  const complianceReleaseReviewDate = document.querySelector(
    "#complianceReleaseReviewDate",
  );
  const complianceReleaseEvidenceAt = document.querySelector(
    "#complianceReleaseEvidenceAt",
  );
  const complianceReleaseScopeNotes = document.querySelector(
    "#complianceReleaseScopeNotes",
  );
  const complianceReleaseFormBasis = document.querySelector(
    "#complianceReleaseFormBasis",
  );
  const complianceReleaseEvidenceRefs = document.querySelector(
    "#complianceReleaseEvidenceRefs",
  );
  const complianceReleaseReviewer = document.querySelector("#complianceReleaseReviewer");
  const complianceReleaseChangeSummary = document.querySelector(
    "#complianceReleaseChangeSummary",
  );
  const saveComplianceReleaseButton = document.querySelector(
    "#saveComplianceReleaseButton",
  );
  const cancelComplianceReleaseButton = document.querySelector(
    "#cancelComplianceReleaseButton",
  );

  const USER_PAGE_SIZE = 100;
  const metricDefinitions = [
    ["registeredUsers", "注册用户"],
    ["todayNewUsers", "今日新增"],
    ["dau", "DAU"],
    ["wau", "WAU"],
    ["mau", "MAU"],
    ["d1Retention", "D1 留存率", true],
    ["d7Retention", "D7 留存率", true],
    ["d30Retention", "D30 留存率", true],
    ["newFeedback", "待处理反馈"],
  ];

  let currentSession = null;
  let usersOffset = 0;
  let usersResult = { items: [], total: 0 };
  let activeSection = "users";
  let loading = false;
  let selectedUser = null;
  let selectedUserDetail = null;
  let announcementBusy = false;
  let announcementFiles = [];
  let complianceData = { release: null, counts: {}, issues: [] };
  let selectedComplianceIssue = null;
  let complianceCreateMode = false;
  let complianceBusy = false;

  const complianceSeverityLabels = {
    BLOCKER: "BLOCKER",
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
    CLEARED: "已完全解决",
  };
  const complianceStatusLabels = {
    open: "待处理",
    remediation_in_progress: "整改中",
    evidence_pending: "待补证据",
    external_confirmation_pending: "待外部确认",
    ready_for_review: "待复核",
    closed: "已关闭",
  };
  const complianceMatrixLabels = {
    legal_risk: "法律/合规风险",
    rights_chain: "第三方权利链",
  };
  const complianceConclusionLabels = {
    releasable: "可发行",
    conditionally_releasable: "附条件可发行",
    not_releasable: "不可发行",
  };

  const bookNames = {
    kaoyan: "考研词汇",
    ielts: "雅思词汇",
  };

  function setMessage(message = "", type = "") {
    adminMessage.textContent = message;
    adminMessage.classList.toggle("is-error", type === "error");
  }

  function formatDate(value, includeTime = false) {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(includeTime ? {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      } : {}),
    }).format(date);
  }

  function formatActivityDate(value) {
    if (!value) return "—";
    const [year, month, day] = String(value).split("-");
    return year && month && day ? `${year}/${month}/${day}` : String(value);
  }

  function showLogin() {
    currentSession = null;
    adminLoginView.hidden = false;
    adminDeniedView.hidden = true;
    adminDashboard.hidden = true;
    adminHeaderActions.hidden = true;
    adminPassword.value = "";
    setMessage();
  }

  function showDenied() {
    adminLoginView.hidden = true;
    adminDeniedView.hidden = false;
    adminDashboard.hidden = true;
    adminHeaderActions.hidden = true;
    setMessage();
  }

  function showDashboard() {
    adminLoginView.hidden = true;
    adminDeniedView.hidden = true;
    adminDashboard.hidden = false;
    adminHeaderActions.hidden = false;
  }

  function renderMetrics(data = {}) {
    metricGrid.replaceChildren();
    metricDefinitions.forEach(([key, label, percentage]) => {
      const card = document.createElement("div");
      card.className = "metric-card";
      const value = document.createElement("strong");
      value.className = "metric-value";
      const raw = data[key];
      value.textContent = raw === null || raw === undefined
        ? "—"
        : percentage
          ? `${raw}%`
          : new Intl.NumberFormat("zh-CN").format(raw);
      const caption = document.createElement("span");
      caption.className = "metric-label";
      caption.textContent = label;
      card.append(value, caption);
      metricGrid.append(card);
    });
  }

  function setActiveSection(section) {
    activeSection = section;
    const sections = {
      users: [usersSection, usersTab],
      feedback: [feedbackSection, feedbackTab],
      announcements: [announcementsSection, announcementsTab],
      compliance: [complianceSection, complianceTab],
    };
    Object.entries(sections).forEach(([key, [panel, tab]]) => {
      const active = key === section;
      panel.hidden = !active;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
  }

  function makeCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function renderUsers(result) {
    usersResult = result ?? { items: [], total: 0 };
    const items = usersResult.items ?? [];
    const total = Number(usersResult.total) || 0;
    usersTotal.textContent = `${total} 个账户`;
    usersTableBody.replaceChildren();

    if (!items.length) {
      const row = document.createElement("tr");
      const cell = makeCell("没有符合条件的用户", "empty-row");
      cell.colSpan = 6;
      row.append(cell);
      usersTableBody.append(row);
    } else {
      items.forEach((user) => {
        const row = document.createElement("tr");
        const emailCell = document.createElement("td");
        const emailButton = document.createElement("button");
        emailButton.className = "user-link";
        emailButton.type = "button";
        emailButton.textContent = user.email || "无邮箱";
        emailButton.addEventListener("click", () => openUserDetail(user));
        emailCell.append(emailButton);
        row.append(
          emailCell,
          makeCell(formatDate(user.registeredAt, true)),
          makeCell(formatActivityDate(user.lastStudyDate)),
          makeCell(`${Number(user.studyDays) || 0} 天`),
          makeCell(`${Number(user.currentStreak) || 0} 天`),
          makeCell(formatDate(user.lastSyncAt, true)),
        );
        usersTableBody.append(row);
      });
    }

    const first = total ? usersOffset + 1 : 0;
    const last = Math.min(usersOffset + USER_PAGE_SIZE, total);
    usersPageLabel.textContent = `${first}–${last} / ${total}`;
    previousUsersButton.disabled = usersOffset <= 0;
    nextUsersButton.disabled = usersOffset + USER_PAGE_SIZE >= total;
  }

  function appendDetail(container, label, value, className = "detail-item") {
    const item = document.createElement("div");
    item.className = className;
    const caption = document.createElement("span");
    caption.textContent = label;
    const content = document.createElement("strong");
    content.textContent = value;
    item.append(caption, content);
    container.append(item);
  }

  async function openUserDetail(user) {
    selectedUser = user;
    selectedUserDetail = null;
    userDetailEmail.textContent = user.email || "无邮箱";
    userDetailGrid.replaceChildren();
    userSenseStatus.replaceChildren();
    membershipDaysInput.value = "";
    membershipDaysInput.min = "0";
    setMembershipButton.disabled = true;
    appendDetail(userDetailGrid, "加载状态", "读取中");
    if (!userDetailDialog.open) userDetailDialog.showModal();

    try {
      const detail = await cloud.loadAdminUserDetail(user.userId);
      if (!detail) throw new Error("找不到该用户。");
      selectedUserDetail = detail;
      const learning = detail.learning ?? {};
      userDetailEmail.textContent = detail.email || "无邮箱";
      userDetailGrid.replaceChildren();
      appendDetail(userDetailGrid, "注册时间", formatDate(detail.registeredAt, true));
      appendDetail(
        userDetailGrid,
        "词书",
        bookNames[detail.bookId] ?? detail.bookId ?? "考研词汇",
      );
      appendDetail(
        userDetailGrid,
        "会员到期日",
        formatDate(detail.membershipExpiresAt, true),
      );
      appendDetail(
        userDetailGrid,
        "最近学习",
        formatActivityDate(learning.lastStudyDate),
      );
      appendDetail(userDetailGrid, "学习天数", `${Number(learning.studyDays) || 0} 天`);
      appendDetail(
        userDetailGrid,
        "连续学习",
        `${Number(learning.currentStreak) || 0} 天`,
      );
      appendDetail(userDetailGrid, "最近同步", formatDate(detail.lastSyncAt, true));
      appendDetail(
        userDetailGrid,
        "每日新学计划",
        detail.plan?.dailyTarget ? `${detail.plan.dailyTarget} 词` : "未设置",
      );
      appendDetail(
        userDetailGrid,
        "已开始学习",
        `${Number(detail.introducedWords) || 0} 词`,
      );
      appendDetail(
        userDetailGrid,
        "反馈数量",
        `${Number(detail.feedbackCount) || 0} 条`,
      );
      const remainingDays = Math.max(
        0,
        Number(detail.membershipRemainingDays) || 0,
      );
      membershipDaysInput.min = String(remainingDays);
      membershipDaysInput.value = String(remainingDays);
      setMembershipButton.disabled = false;

      const status = detail.senseStatus ?? {};
      [
        ["待新学", status.new],
        ["待强化", status.reinforce],
        ["待复习", status.review],
        ["已掌握", status.mastered],
      ].forEach(([label, value]) => {
        appendDetail(
          userSenseStatus,
          label,
          `${Number(value) || 0} 个义项`,
          "detail-status-item",
        );
      });
    } catch (error) {
      userDetailGrid.replaceChildren();
      appendDetail(userDetailGrid, "读取失败", error?.message ?? "未知错误");
      setMembershipButton.disabled = true;
    }
  }

  function renderFeedback(result) {
    const items = result?.items ?? [];
    feedbackTotal.textContent = `${Number(result?.total) || 0} 条反馈`;
    adminFeedbackList.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-row";
      empty.textContent = "当前没有符合条件的反馈";
      adminFeedbackList.append(empty);
      return;
    }

    items.forEach((feedback) => {
      const item = document.createElement("article");
      item.className = "feedback-item";
      const header = document.createElement("div");
      header.className = "feedback-item-header";
      const meta = document.createElement("div");
      meta.className = "feedback-item-meta";
      const email = document.createElement("strong");
      email.textContent = feedback.email || "已删除账户";
      const createdAt = document.createElement("span");
      createdAt.textContent = formatDate(feedback.createdAt, true);
      meta.append(email, createdAt);
      if (
        feedback.context?.source === "study" &&
        feedback.context?.wordId &&
        feedback.context?.wordText
      ) {
        const wordLink = document.createElement("a");
        const wordUrl = new URL("./", window.location.href);
        wordUrl.searchParams.set("word", feedback.context.wordId);
        if (feedback.context.bookId) {
          wordUrl.searchParams.set("book", feedback.context.bookId);
        }
        wordLink.className = "feedback-word-link";
        wordLink.href = wordUrl.href;
        wordLink.target = "_blank";
        wordLink.rel = "noopener noreferrer";
        wordLink.textContent = `查看单词：${feedback.context.wordText}`;
        meta.append(wordLink);
      }

      const status = document.createElement("select");
      status.className = "feedback-status";
      status.setAttribute("aria-label", "反馈处理状态");
      [
        ["new", "待处理"],
        ["in_progress", "处理中"],
        ["resolved", "已解决"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = feedback.status === value;
        status.append(option);
      });
      status.addEventListener("change", async () => {
        status.disabled = true;
        try {
          await cloud.updateFeedbackStatus(feedback.id, status.value);
          await Promise.all([loadOverview(), loadFeedback()]);
          setMessage("反馈状态已更新。");
        } catch (error) {
          setMessage(error?.message ?? "更新反馈状态失败。", "error");
          status.value = feedback.status;
        } finally {
          status.disabled = false;
        }
      });
      header.append(meta, status);

      const message = document.createElement("p");
      message.className = "feedback-message";
      message.textContent = feedback.message;
      item.append(header, message);

      if (feedback.images?.length) {
        const images = document.createElement("div");
        images.className = "feedback-images";
        feedback.images.forEach((image, index) => {
          const link = document.createElement("a");
          link.href = image.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.title = "查看原图";
          const picture = document.createElement("img");
          picture.src = image.url;
          picture.alt = `反馈截图 ${index + 1}`;
          link.append(picture);
          images.append(link);
        });
        item.append(images);
      }
      const replyPanel = document.createElement("div");
      replyPanel.className = "feedback-reply-panel";
      if (feedback.adminReply) {
        const previousReply = document.createElement("div");
        previousReply.className = "feedback-previous-reply";
        const previousReplyLabel = document.createElement("strong");
        previousReplyLabel.textContent = "已答复";
        const previousReplyBody = document.createElement("p");
        previousReplyBody.textContent = feedback.adminReply;
        const previousReplyTime = document.createElement("span");
        previousReplyTime.textContent = formatDate(feedback.repliedAt, true);
        previousReply.append(previousReplyLabel, previousReplyBody, previousReplyTime);
        replyPanel.append(previousReply);
      }
      const replyEditor = document.createElement("div");
      replyEditor.className = "feedback-reply-editor";
      const replyInput = document.createElement("textarea");
      replyInput.rows = 3;
      replyInput.maxLength = 4000;
      replyInput.placeholder = feedback.userId
        ? "输入给用户的答复"
        : "账户已删除，无法发送答复";
      replyInput.disabled = !feedback.userId;
      const replyButton = document.createElement("button");
      replyButton.className = "admin-button primary";
      replyButton.type = "button";
      replyButton.textContent = feedback.adminReply ? "再次答复" : "发送答复";
      replyButton.disabled = true;
      replyInput.addEventListener("input", () => {
        replyButton.disabled = !feedback.userId || replyInput.value.trim().length < 1;
      });
      replyButton.addEventListener("click", async () => {
        const reply = replyInput.value.trim();
        if (!reply) return;
        replyButton.disabled = true;
        replyInput.disabled = true;
        try {
          await cloud.replyToFeedback(feedback.id, reply);
          await Promise.all([loadOverview(), loadFeedback()]);
          setMessage("答复已通过消息通知发送给用户。");
        } catch (error) {
          setMessage(error?.message ?? "发送答复失败。", "error");
          replyInput.disabled = false;
          replyButton.disabled = false;
        }
      });
      replyEditor.append(replyInput, replyButton);
      replyPanel.append(replyEditor);
      item.append(replyPanel);
      adminFeedbackList.append(item);
    });
  }

  function updateAnnouncementFormState() {
    announcementImageCount.textContent = `${announcementFiles.length} / 4`;
    announcementImageInput.disabled = announcementBusy;
    publishAnnouncementButton.disabled = announcementBusy;
    announcementList
      .querySelectorAll(
        ".announcement-pin-button, .announcement-takedown-button, .announcement-delete-button",
      )
      .forEach((button) => {
        button.disabled = announcementBusy;
      });
  }

  function renderAnnouncementFiles() {
    announcementImagePreview.replaceChildren();
    announcementFiles.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "announcement-image-item";

      const image = document.createElement("img");
      image.src = entry.url;
      image.alt = `待发布公告图片 ${index + 1}`;

      const removeButton = document.createElement("button");
      removeButton.className = "announcement-image-remove";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.title = "移除图片";
      removeButton.setAttribute("aria-label", `移除公告图片 ${index + 1}`);
      removeButton.addEventListener("click", () => {
        URL.revokeObjectURL(entry.url);
        announcementFiles.splice(index, 1);
        renderAnnouncementFiles();
      });

      item.append(image, removeButton);
      announcementImagePreview.append(item);
    });
    updateAnnouncementFormState();
  }

  function clearAnnouncementFiles() {
    announcementFiles.forEach((entry) => URL.revokeObjectURL(entry.url));
    announcementFiles = [];
    announcementImageInput.value = "";
    renderAnnouncementFiles();
  }

  async function decodeAnnouncementImage(file) {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    }

    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "async";
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("图片无法解码。"));
        image.src = sourceUrl;
      });
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => {},
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function sanitizeAnnouncementImage(file, index) {
    const decoded = await decodeAnnouncementImage(file);
    try {
      if (
        !Number.isFinite(decoded.width) ||
        !Number.isFinite(decoded.height) ||
        decoded.width < 1 ||
        decoded.height < 1
      ) {
        throw new Error("图片尺寸无效。");
      }

      const maxDimension = 2560;
      const maxPixels = 6_000_000;
      const dimensionScale = Math.min(
        1,
        maxDimension / Math.max(decoded.width, decoded.height),
      );
      const pixelScale = Math.min(
        1,
        Math.sqrt(maxPixels / (decoded.width * decoded.height)),
      );
      const scale = Math.min(dimensionScale, pixelScale);
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("当前浏览器无法安全处理图片。");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.86);
      });
      canvas.width = 1;
      canvas.height = 1;
      if (!blob || blob.size < 1 || blob.size > 5 * 1024 * 1024) {
        throw new Error("图片重新编码失败或编码后仍超过 5 MB。");
      }
      return new File(
        [blob],
        `announcement-${Date.now()}-${index + 1}.jpg`,
        { type: "image/jpeg", lastModified: Date.now() },
      );
    } finally {
      decoded.close();
    }
  }

  async function addAnnouncementFiles(fileList) {
    const selected = Array.from(fileList ?? []);
    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    if (announcementFiles.length + selected.length > 4) {
      setMessage("每条公告最多添加 4 张图片。", "error");
      announcementImageInput.value = "";
      return;
    }
    if (selected.some((file) => !allowedTypes.has(file.type))) {
      setMessage("仅支持 JPG、PNG 或 WebP 图片。", "error");
      announcementImageInput.value = "";
      return;
    }
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
      setMessage("每张图片不能超过 5 MB。", "error");
      announcementImageInput.value = "";
      return;
    }

    announcementBusy = true;
    updateAnnouncementFormState();
    setMessage("正在安全处理图片……");
    const sanitized = [];
    try {
      for (const [index, file] of selected.entries()) {
        const safeFile = await sanitizeAnnouncementImage(file, index);
        sanitized.push({
          file: safeFile,
          url: URL.createObjectURL(safeFile),
        });
      }
      announcementFiles.push(...sanitized);
      setMessage();
      renderAnnouncementFiles();
    } catch (error) {
      sanitized.forEach((entry) => URL.revokeObjectURL(entry.url));
      setMessage(error?.message ?? "图片处理失败。", "error");
    } finally {
      announcementImageInput.value = "";
      announcementBusy = false;
      updateAnnouncementFormState();
    }
  }

  function renderAnnouncements(result) {
    const items = result?.items ?? [];
    announcementList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-row";
      empty.textContent = "尚未发布公告";
      announcementList.append(empty);
      return;
    }
    items.forEach((announcement) => {
      const item = document.createElement("article");
      item.className = "announcement-item";
      item.classList.toggle("is-pinned", Boolean(announcement.isPinned));
      const heading = document.createElement("div");
      heading.className = "announcement-item-heading";
      const title = document.createElement("strong");
      title.textContent = announcement.title;
      const time = document.createElement("span");
      time.textContent = formatDate(announcement.publishedAt, true);
      const rightsStatus = document.createElement("span");
      rightsStatus.className = `announcement-rights-status is-${announcement.rightsStatus ?? "verified"}`;
      rightsStatus.textContent = {
        verified: "权利已核验",
        takedown_pending: "下架处理中",
        withdrawn: "已下架",
      }[announcement.rightsStatus] ?? "权利状态未知";
      const actions = document.createElement("div");
      actions.className = "announcement-item-actions";
      const pinButton = document.createElement("button");
      pinButton.className = "announcement-pin-button";
      pinButton.type = "button";
      pinButton.textContent = announcement.isPinned ? "取消置顶" : "置顶";
      pinButton.dataset.announcementId = announcement.id;
      pinButton.dataset.announcementPinned = String(Boolean(announcement.isPinned));
      pinButton.setAttribute(
        "aria-label",
        `${announcement.isPinned ? "取消置顶" : "置顶"}公告：${announcement.title}`,
      );
      const deleteButton = document.createElement("button");
      deleteButton.className = "announcement-delete-button";
      deleteButton.type = "button";
      deleteButton.textContent = "删除";
      deleteButton.dataset.announcementId = announcement.id;
      deleteButton.dataset.announcementTitle = announcement.title;
      deleteButton.setAttribute("aria-label", `删除公告：${announcement.title}`);
      const takedownButton = document.createElement("button");
      takedownButton.className = "announcement-takedown-button";
      takedownButton.type = "button";
      takedownButton.textContent = "权利下架";
      takedownButton.dataset.announcementId = announcement.id;
      takedownButton.dataset.announcementTitle = announcement.title;
      takedownButton.hidden = announcement.rightsStatus !== "verified";
      actions.append(time, rightsStatus, pinButton, takedownButton, deleteButton);
      heading.append(title, actions);
      const body = document.createElement("p");
      body.textContent = announcement.body;
      item.append(heading, body);
      const provenance = document.createElement("p");
      provenance.className = "announcement-provenance-summary";
      provenance.textContent = `正文：${announcement.contentProvenance?.textOrigin ?? "未记录"}；图片权利记录：${announcement.rightsMetadata?.length ?? 0} 项`;
      item.append(provenance);
      if (announcement.images?.length) {
        const images = document.createElement("div");
        images.className = "announcement-images";
        announcement.images.forEach((entry, index) => {
          const link = document.createElement("a");
          link.href = entry.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          const image = document.createElement("img");
          image.src = entry.url;
          image.alt = `${announcement.title} 图片 ${index + 1}`;
          image.loading = "lazy";
          image.decoding = "async";
          link.append(image);
          images.append(link);
        });
        item.append(images);
      }
      announcementList.append(item);
    });
  }

  function complianceTone(severity) {
    if (["BLOCKER", "HIGH", "not_releasable"].includes(severity)) {
      return "tone-critical";
    }
    if (["MEDIUM", "LOW", "conditionally_releasable"].includes(severity)) {
      return "tone-warning";
    }
    if (["CLEARED", "releasable"].includes(severity)) return "tone-cleared";
    return "tone-unknown";
  }

  function displayKnown(value) {
    if (value === null || value === undefined || value === "") return "未知";
    if (Array.isArray(value)) return value.length ? value.join("、") : "未知";
    return String(value);
  }

  function parseCommaList(value) {
    return String(value ?? "")
      .split(/[，,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function parseLineList(value) {
    return String(value ?? "")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function evidenceRefText(entry) {
    if (typeof entry === "string") return entry;
    if (!entry || typeof entry !== "object") return "";
    return entry.url ?? entry.repoPath ?? entry.reference ?? entry.label ?? "";
  }

  function formatEvidenceRefs(entries) {
    return Array.isArray(entries)
      ? entries.map(evidenceRefText).filter(Boolean).join("\n")
      : "";
  }

  function parseEvidenceRefs(value) {
    return parseLineList(value).map((reference) => (
      /^https?:\/\//i.test(reference)
        ? { url: reference }
        : { repoPath: reference }
    ));
  }

  function formatLocalDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function appendComplianceMeta(container, label, value, wide = false) {
    const item = document.createElement("div");
    if (wide) item.className = "is-wide";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    if (value instanceof Node) description.append(value);
    else description.textContent = displayKnown(value);
    item.append(term, description);
    container.append(item);
  }

  function renderComplianceRelease(release) {
    complianceReleaseCard.classList.remove(
      "tone-critical",
      "tone-warning",
      "tone-cleared",
      "tone-unknown",
    );
    complianceReleaseCard.classList.add(complianceTone(release?.conclusion));
    complianceReleaseConclusion.textContent = complianceConclusionLabels[release?.conclusion]
      ?? "未知";
    complianceReleaseRevision.textContent = release?.revision
      ? `快照 #${release.revision}`
      : "无快照";
    complianceReleaseMeta.replaceChildren();
    appendComplianceMeta(complianceReleaseMeta, "适用版本", release?.appVersion);
    appendComplianceMeta(complianceReleaseMeta, "适用 commit", release?.commitSha);
    appendComplianceMeta(complianceReleaseMeta, "渠道", release?.channels);
    appendComplianceMeta(complianceReleaseMeta, "商业模式", release?.businessModel);
    appendComplianceMeta(complianceReleaseMeta, "司法辖区", release?.jurisdictions);
    appendComplianceMeta(complianceReleaseMeta, "审查日期", release?.reviewDate);
    appendComplianceMeta(
      complianceReleaseMeta,
      "证据生成时间",
      release?.evidenceGeneratedAt ? formatDate(release.evidenceGeneratedAt, true) : null,
    );
    appendComplianceMeta(complianceReleaseMeta, "复核人", release?.reviewer);
    complianceReleaseBasis.textContent = release?.basis || "尚未保存结论依据。";
  }

  function renderComplianceReleaseHistory(history = []) {
    const snapshots = Array.isArray(history) ? history : [];
    complianceReleaseHistoryCount.textContent = `${snapshots.length} 个快照`;
    complianceReleaseHistory.replaceChildren();
    snapshots.forEach((snapshot) => {
      const item = document.createElement("details");
      item.className = "compliance-history-item";
      const summary = document.createElement("summary");
      const revision = document.createElement("strong");
      revision.textContent = `#${snapshot.revision}`;
      const conclusion = document.createElement("span");
      conclusion.className = "compliance-badge";
      conclusion.textContent = complianceConclusionLabels[snapshot.conclusion]
        ?? snapshot.conclusion;
      const change = document.createElement("span");
      change.textContent = snapshot.changeSummary || "未填写变化说明";
      const time = document.createElement("time");
      time.className = "compliance-history-time";
      time.textContent = formatDate(snapshot.updatedAt, true);
      summary.append(revision, conclusion, change, time);

      const body = document.createElement("dl");
      body.className = "compliance-detail-grid compliance-history-body";
      appendComplianceMeta(body, "适用版本", snapshot.appVersion);
      appendComplianceMeta(body, "适用 commit", snapshot.commitSha);
      appendComplianceMeta(body, "渠道", snapshot.channels);
      appendComplianceMeta(body, "商业模式", snapshot.businessModel);
      appendComplianceMeta(body, "司法辖区", snapshot.jurisdictions);
      appendComplianceMeta(body, "审查日期", snapshot.reviewDate);
      appendComplianceMeta(body, "复核人", snapshot.reviewer);
      appendComplianceMeta(body, "操作账号 ID", snapshot.updatedBy);
      appendComplianceMeta(body, "范围说明", snapshot.scopeNotes, true);
      appendComplianceMeta(body, "结论依据", snapshot.basis, true);
      appendComplianceMeta(
        body,
        "证据引用",
        renderReferenceList(snapshot.evidenceRefs),
        true,
      );
      item.append(summary, body);
      complianceReleaseHistory.append(item);
    });
  }

  function updateComplianceSelect(select, values) {
    const previous = select.value;
    const first = select.options[0];
    select.replaceChildren(first);
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
    select.value = values.includes(previous) ? previous : "";
  }

  function renderComplianceCounts(counts = {}) {
    complianceCounts.replaceChildren();
    ["BLOCKER", "HIGH", "MEDIUM", "LOW", "CLEARED"].forEach((severity) => {
      const chip = document.createElement("span");
      chip.className = "compliance-count-chip";
      chip.textContent = `${complianceSeverityLabels[severity]} ${Number(counts[severity]) || 0}`;
      complianceCounts.append(chip);
    });
    const due = document.createElement("span");
    due.className = "compliance-count-chip";
    due.textContent = `已过期 ${Number(counts.reviewDue) || 0}`;
    complianceCounts.append(due);
  }

  function filteredComplianceIssues() {
    const query = complianceSearchInput.value.trim().toLocaleLowerCase("zh-CN");
    return (complianceData.issues ?? []).filter((issue) => {
      if (complianceMatrixFilter.value && issue.matrixType !== complianceMatrixFilter.value) {
        return false;
      }
      if (complianceSeverityFilter.value && issue.severity !== complianceSeverityFilter.value) {
        return false;
      }
      if (complianceCategoryFilter.value && issue.category !== complianceCategoryFilter.value) {
        return false;
      }
      if (complianceStatusFilter.value && issue.status !== complianceStatusFilter.value) {
        return false;
      }
      if (complianceOwnerFilter.value && issue.owner !== complianceOwnerFilter.value) {
        return false;
      }
      if (
        complianceExternalFilter.value === "required" &&
        !issue.externalConfirmationRequired
      ) return false;
      if (
        complianceExternalFilter.value === "not_required" &&
        issue.externalConfirmationRequired
      ) return false;
      if (complianceDueFilter.value === "due" && !issue.isReviewDue) return false;
      if (complianceDueFilter.value === "scheduled" && !issue.reviewDueAt) return false;
      if (complianceDueFilter.value === "unscheduled" && issue.reviewDueAt) return false;
      if (query) {
        const haystack = [
          issue.issueKey,
          issue.title,
          issue.description,
          issue.nextStep,
          issue.category,
          issue.owner,
        ].join(" ").toLocaleLowerCase("zh-CN");
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function renderComplianceCards() {
    const issues = filteredComplianceIssues();
    complianceCardRail.replaceChildren();
    issues.forEach((issue) => {
      const card = document.createElement("button");
      card.className = `compliance-card ${complianceTone(issue.severity)}`;
      card.type = "button";
      card.dataset.issueId = issue.id;
      card.setAttribute(
        "aria-label",
        `查看 ${issue.issueKey}：${issue.title} 的当前状态和历史快照`,
      );
      const heading = document.createElement("div");
      heading.className = "compliance-card-heading";
      const issueKey = document.createElement("span");
      issueKey.className = "compliance-card-id";
      issueKey.textContent = issue.issueKey;
      const severity = document.createElement("span");
      severity.className = `compliance-badge is-${String(issue.severity).toLowerCase()}`;
      severity.textContent = complianceSeverityLabels[issue.severity] ?? issue.severity;
      heading.append(issueKey, severity);
      const title = document.createElement("h3");
      title.textContent = issue.title;
      const category = document.createElement("p");
      category.className = "compliance-card-category";
      category.textContent = `${complianceMatrixLabels[issue.matrixType] ?? "未知矩阵"} · ${issue.category}`;
      const description = document.createElement("p");
      description.className = "compliance-card-description";
      description.textContent = issue.description;
      const next = document.createElement("div");
      next.className = "compliance-card-next";
      const nextLabel = document.createElement("strong");
      nextLabel.textContent = "下一步解决方案";
      const nextText = document.createElement("span");
      nextText.textContent = issue.nextStep;
      next.append(nextLabel, nextText);
      const meta = document.createElement("div");
      meta.className = "compliance-card-meta";
      const state = document.createElement("span");
      state.textContent = complianceStatusLabels[issue.status] ?? issue.status;
      const history = document.createElement("span");
      history.textContent = `${Number(issue.historyCount) || 0} 个快照 · ${formatDate(issue.updatedAt, true)}`;
      meta.append(state, history);
      card.append(heading, title, category, description, next, meta);
      complianceCardRail.append(card);
    });
    complianceResultSummary.textContent = `显示 ${issues.length} / ${complianceData.issues?.length ?? 0} 个问题`;
    complianceEmpty.hidden = issues.length > 0;
    complianceCardRail.hidden = issues.length === 0;
  }

  function renderCompliance(result = {}) {
    complianceData = {
      release: result.release ?? null,
      releaseHistory: Array.isArray(result.releaseHistory) ? result.releaseHistory : [],
      counts: result.counts ?? {},
      issues: Array.isArray(result.issues) ? result.issues : [],
    };
    renderComplianceRelease(complianceData.release);
    renderComplianceReleaseHistory(complianceData.releaseHistory);
    renderComplianceCounts(complianceData.counts);
    updateComplianceSelect(
      complianceCategoryFilter,
      [...new Set(complianceData.issues.map((issue) => issue.category).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "zh-CN")),
    );
    updateComplianceSelect(
      complianceOwnerFilter,
      [...new Set(complianceData.issues.map((issue) => issue.owner).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "zh-CN")),
    );
    renderComplianceCards();
  }

  function renderReferenceList(entries) {
    const list = document.createElement("ul");
    list.className = "compliance-evidence-list";
    const normalized = Array.isArray(entries) ? entries : [];
    if (!normalized.length) {
      const empty = document.createElement("li");
      empty.textContent = "未知";
      list.append(empty);
      return list;
    }
    normalized.forEach((entry) => {
      const item = document.createElement("li");
      const reference = evidenceRefText(entry);
      if (/^https?:\/\//i.test(reference)) {
        const link = document.createElement("a");
        link.href = reference;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = entry?.label ? `${entry.label}：${reference}` : reference;
        item.append(link);
      } else {
        item.textContent = entry?.label ? `${entry.label}：${reference}` : reference;
      }
      list.append(item);
    });
    return list;
  }

  function renderSnapshotContent(container, snapshot) {
    container.replaceChildren();
    const lead = document.createElement("div");
    lead.className = `compliance-detail-lead ${complianceTone(snapshot.severity)}`;
    const heading = document.createElement("div");
    heading.className = "compliance-card-heading";
    const severity = document.createElement("span");
    severity.className = `compliance-badge is-${String(snapshot.severity).toLowerCase()}`;
    severity.textContent = complianceSeverityLabels[snapshot.severity] ?? snapshot.severity;
    const status = document.createElement("span");
    status.className = "compliance-badge";
    status.textContent = complianceStatusLabels[snapshot.status] ?? snapshot.status;
    heading.append(severity, status);
    const title = document.createElement("h3");
    title.textContent = snapshot.title;
    const description = document.createElement("p");
    description.textContent = snapshot.description;
    const next = document.createElement("p");
    const nextLabel = document.createElement("strong");
    nextLabel.textContent = "下一步：";
    next.append(nextLabel, document.createTextNode(snapshot.nextStep || "未知"));
    lead.append(heading, title, description, next);

    const grid = document.createElement("dl");
    grid.className = "compliance-detail-grid";
    appendComplianceMeta(grid, "负责人", snapshot.owner);
    appendComplianceMeta(grid, "复核人", snapshot.reviewer);
    appendComplianceMeta(grid, "复核日期", snapshot.reviewDueAt);
    appendComplianceMeta(
      grid,
      "外部确认",
      snapshot.externalConfirmationRequired ? "需要" : "不需要",
    );
    appendComplianceMeta(grid, "已验证事实", snapshot.verifiedFacts, true);
    appendComplianceMeta(grid, "依据与证据", snapshot.evidenceBasis, true);
    appendComplianceMeta(grid, "LC 分析", snapshot.lcAnalysis, true);
    appendComplianceMeta(grid, "发行影响", snapshot.releaseImpact, true);
    appendComplianceMeta(grid, "整改方案", snapshot.remediationPlan, true);
    appendComplianceMeta(grid, "验收证据", snapshot.acceptanceEvidence, true);
    appendComplianceMeta(grid, "未解决问题", snapshot.unresolvedQuestions, true);
    appendComplianceMeta(grid, "外部确认事项", snapshot.externalConfirmation, true);
    appendComplianceMeta(
      grid,
      "受影响资产/路径/内容 ID",
      renderReferenceList(snapshot.affectedAssets),
      true,
    );
    appendComplianceMeta(grid, "证据引用", renderReferenceList(snapshot.evidenceRefs), true);
    appendComplianceMeta(
      grid,
      "适用范围",
      snapshot.applicableScope && Object.keys(snapshot.applicableScope).length
        ? JSON.stringify(snapshot.applicableScope, null, 2)
        : null,
      true,
    );
    appendComplianceMeta(grid, "变更前 SHA-256", snapshot.contentHashBefore);
    appendComplianceMeta(grid, "变更后 SHA-256", snapshot.contentHashAfter);
    appendComplianceMeta(grid, "本次变化", snapshot.changeSummary, true);
    appendComplianceMeta(grid, "操作账号 ID", snapshot.updatedBy);
    container.append(lead, grid);
  }

  function renderComplianceIssue(detail) {
    selectedComplianceIssue = detail;
    const snapshots = Array.isArray(detail?.snapshots) ? detail.snapshots : [];
    const current = snapshots[0];
    complianceIssueEyebrow.textContent = `${detail.issueKey} · ${complianceMatrixLabels[detail.matrixType] ?? "合规问题"}`;
    complianceIssueDialogTitle.textContent = current?.title ?? "问题详情";
    complianceIssueReadView.hidden = false;
    complianceIssueForm.hidden = true;
    editComplianceIssueButton.hidden = !current;
    if (current) renderSnapshotContent(complianceDetailCurrent, current);
    else complianceDetailCurrent.replaceChildren();

    complianceHistoryCount.textContent = `${snapshots.length} 个快照`;
    complianceHistory.replaceChildren();
    snapshots.forEach((snapshot) => {
      const item = document.createElement("details");
      item.className = "compliance-history-item";
      const summary = document.createElement("summary");
      const revision = document.createElement("strong");
      revision.textContent = `#${snapshot.revision}`;
      const badge = document.createElement("span");
      badge.className = `compliance-badge is-${String(snapshot.severity).toLowerCase()}`;
      badge.textContent = complianceSeverityLabels[snapshot.severity] ?? snapshot.severity;
      const change = document.createElement("span");
      change.textContent = snapshot.changeSummary || "未填写变化说明";
      const time = document.createElement("time");
      time.className = "compliance-history-time";
      time.textContent = formatDate(snapshot.updatedAt, true);
      summary.append(revision, badge, change, time);
      const body = document.createElement("div");
      body.className = "compliance-history-body";
      renderSnapshotContent(body, snapshot);
      item.append(summary, body);
      complianceHistory.append(item);
    });
  }

  function setComplianceFormMode(editing) {
    complianceIssueReadView.hidden = editing;
    complianceIssueForm.hidden = !editing;
  }

  function updateComplianceRightsVisibility() {
    complianceRightsFields.hidden = complianceIssueMatrixType.value !== "rights_chain";
  }

  function fillComplianceIssueForm(detail = null) {
    const snapshot = detail?.snapshots?.[0] ?? {};
    const scope = snapshot.applicableScope ?? {};
    const rights = snapshot.rightsClearance ?? {};
    const release = complianceData.release ?? {};
    complianceIssueForm.reset();
    complianceIssueMatrixType.value = detail?.matrixType ?? "legal_risk";
    complianceIssueMatrixType.disabled = Boolean(detail);
    complianceIssueCategory.value = detail?.category ?? "";
    complianceIssueCategory.disabled = Boolean(detail);
    complianceIssueTitle.value = snapshot.title ?? "";
    complianceIssueSeverity.value = snapshot.severity ?? "BLOCKER";
    complianceIssueStatus.value = snapshot.status ?? "open";
    complianceIssueDescription.value = snapshot.description ?? "";
    complianceIssueNextStep.value = snapshot.nextStep ?? "";
    complianceIssueChangeSummary.value = detail ? "" : "新增问题并保存初始快照。";
    complianceIssueOwner.value = snapshot.owner ?? "待指定";
    complianceIssueReviewer.value = snapshot.reviewer ?? "LC";
    complianceIssueReviewDue.value = snapshot.reviewDueAt ?? "";
    complianceIssueExternalRequired.checked = Boolean(
      snapshot.externalConfirmationRequired,
    );
    complianceIssueVerifiedFacts.value = snapshot.verifiedFacts ?? "";
    complianceIssueEvidenceBasis.value = snapshot.evidenceBasis ?? "";
    complianceIssueAnalysis.value = snapshot.lcAnalysis ?? "";
    complianceIssueReleaseImpact.value = snapshot.releaseImpact ?? "";
    complianceIssueRemediationPlan.value = snapshot.remediationPlan ?? "";
    complianceIssueAcceptanceEvidence.value = snapshot.acceptanceEvidence ?? "";
    complianceIssueUnresolved.value = snapshot.unresolvedQuestions ?? "";
    complianceIssueExternalConfirmation.value = snapshot.externalConfirmation ?? "";
    complianceIssueAssets.value = Array.isArray(snapshot.affectedAssets)
      ? snapshot.affectedAssets.map(evidenceRefText).filter(Boolean).join("\n")
      : "";
    complianceIssueEvidenceRefs.value = formatEvidenceRefs(snapshot.evidenceRefs);
    complianceIssueScopeVersion.value = scope.appVersion ?? release.appVersion ?? "";
    complianceIssueScopeCommit.value = scope.commitSha ?? release.commitSha ?? "";
    complianceIssueScopeChannels.value = Array.isArray(scope.channels)
      ? scope.channels.join("，")
      : Array.isArray(release.channels) ? release.channels.join("，") : "";
    complianceIssueScopeJurisdictions.value = Array.isArray(scope.jurisdictions)
      ? scope.jurisdictions.join("，")
      : Array.isArray(release.jurisdictions) ? release.jurisdictions.join("，") : "";
    complianceIssueScopeBusiness.value = scope.businessModel ?? release.businessModel ?? "";
    complianceIssueHashBefore.value = snapshot.contentHashBefore ?? "";
    complianceIssueHashAfter.value = snapshot.contentHashAfter ?? "";
    complianceRightsAuthor.value = rights.authorOrRightsholder ?? "";
    complianceRightsLicense.value = rights.licenseOrPermission ?? "";
    complianceRightsSourceUrl.value = rights.sourceUrl ?? "";
    complianceRightsVersion.value = rights.versionOrDate ?? "";
    complianceRightsCommercialScope.value = rights.commercialScope ?? "";
    complianceRightsSha256.value = rights.sha256 ?? "";
    saveComplianceIssueButton.textContent = detail ? "保存新快照" : "创建问题卡片";
    updateComplianceRightsVisibility();
  }

  function collectComplianceSnapshot() {
    const previous = selectedComplianceIssue?.snapshots?.[0] ?? null;
    const severity = complianceIssueSeverity.value;
    const status = complianceIssueStatus.value;
    const evidenceRefs = parseEvidenceRefs(complianceIssueEvidenceRefs.value);
    const scope = {
      ...(previous?.applicableScope ?? {}),
      appVersion: complianceIssueScopeVersion.value.trim() || null,
      commitSha: complianceIssueScopeCommit.value.trim().toLowerCase() || null,
      channels: parseCommaList(complianceIssueScopeChannels.value),
      businessModel: complianceIssueScopeBusiness.value.trim() || null,
      jurisdictions: parseCommaList(complianceIssueScopeJurisdictions.value),
      reviewDate: previous?.applicableScope?.reviewDate
        ?? complianceData.release?.reviewDate
        ?? null,
    };
    const snapshot = {
      severity,
      status,
      title: complianceIssueTitle.value.trim(),
      description: complianceIssueDescription.value.trim(),
      nextStep: complianceIssueNextStep.value.trim(),
      changeSummary: complianceIssueChangeSummary.value.trim(),
      owner: complianceIssueOwner.value.trim(),
      reviewer: complianceIssueReviewer.value.trim(),
      reviewDueAt: complianceIssueReviewDue.value || null,
      externalConfirmationRequired: complianceIssueExternalRequired.checked,
      verifiedFacts: complianceIssueVerifiedFacts.value.trim(),
      evidenceBasis: complianceIssueEvidenceBasis.value.trim(),
      lcAnalysis: complianceIssueAnalysis.value.trim(),
      releaseImpact: complianceIssueReleaseImpact.value.trim(),
      remediationPlan: complianceIssueRemediationPlan.value.trim(),
      acceptanceEvidence: complianceIssueAcceptanceEvidence.value.trim(),
      unresolvedQuestions: complianceIssueUnresolved.value.trim(),
      externalConfirmation: complianceIssueExternalConfirmation.value.trim(),
      affectedAssets: parseLineList(complianceIssueAssets.value),
      evidenceRefs,
      applicableScope: scope,
      rightsClearance: {
        authorOrRightsholder: complianceRightsAuthor.value.trim(),
        licenseOrPermission: complianceRightsLicense.value.trim(),
        sourceUrl: complianceRightsSourceUrl.value.trim(),
        versionOrDate: complianceRightsVersion.value.trim(),
        commercialScope: complianceRightsCommercialScope.value.trim(),
        sha256: complianceRightsSha256.value.trim().toLowerCase(),
      },
      contentHashBefore: complianceIssueHashBefore.value.trim().toLowerCase() || null,
      contentHashAfter: complianceIssueHashAfter.value.trim().toLowerCase() || null,
    };
    const severityChanged = !previous || previous.severity !== severity;
    if (severity === "CLEARED" && status !== "closed") {
      throw new Error("标记为已完全解决时，处理进度必须同时设为“已关闭”。");
    }
    if (severityChanged && (
      !snapshot.reviewer || !snapshot.evidenceBasis || !snapshot.evidenceRefs.length
    )) {
      throw new Error("新增问题或修改严重度时，必须填写复核人、依据与至少一条证据引用。");
    }
    if (severity === "CLEARED" && !snapshot.acceptanceEvidence) {
      throw new Error("标记为已完全解决前，必须填写验收证据。");
    }
    if (
      severity === "CLEARED" &&
      complianceIssueMatrixType.value === "rights_chain" &&
      Object.values(snapshot.rightsClearance).some((value) => !value)
    ) {
      throw new Error("第三方权利链清除前，必须补齐作者、许可、来源、版本、商业范围和证据哈希。");
    }
    return snapshot;
  }

  async function openComplianceIssue(issueId) {
    if (complianceBusy) return;
    complianceBusy = true;
    setMessage("正在读取问题历史……");
    try {
      const detail = await cloud.loadAdminComplianceIssue(issueId);
      complianceCreateMode = false;
      renderComplianceIssue(detail);
      if (!complianceIssueDialog.open) complianceIssueDialog.showModal();
      setMessage();
    } catch (error) {
      setMessage(error?.message ?? "问题历史读取失败。", "error");
    } finally {
      complianceBusy = false;
    }
  }

  function openNewComplianceIssue() {
    selectedComplianceIssue = null;
    complianceCreateMode = true;
    complianceIssueEyebrow.textContent = "新增合规问题";
    complianceIssueDialogTitle.textContent = "创建第一份快照";
    fillComplianceIssueForm();
    setComplianceFormMode(true);
    if (!complianceIssueDialog.open) complianceIssueDialog.showModal();
    complianceIssueTitle.focus();
  }

  async function saveComplianceIssue(event) {
    event.preventDefault();
    if (complianceBusy) return;
    let snapshot;
    try {
      snapshot = collectComplianceSnapshot();
    } catch (error) {
      setMessage(error?.message ?? "请检查合规问题表单。", "error");
      return;
    }
    complianceBusy = true;
    saveComplianceIssueButton.disabled = true;
    try {
      const result = complianceCreateMode
        ? await cloud.createComplianceIssue(
          complianceIssueMatrixType.value,
          complianceIssueCategory.value.trim(),
          snapshot,
        )
        : await cloud.appendComplianceIssueSnapshot(
          selectedComplianceIssue.id,
          selectedComplianceIssue.snapshots[0].revision,
          snapshot,
        );
      await loadCompliance();
      const detail = await cloud.loadAdminComplianceIssue(result.id);
      complianceCreateMode = false;
      renderComplianceIssue(detail);
      setMessage(`已保存 ${result.issueKey ?? detail.issueKey} 的快照 #${result.revision}。`);
    } catch (error) {
      const message = error?.code === "40001"
        ? "该问题已在其他页面更新，请刷新后重新提交。"
        : error?.message ?? "合规问题保存失败。";
      setMessage(message, "error");
    } finally {
      complianceBusy = false;
      saveComplianceIssueButton.disabled = false;
    }
  }

  function openComplianceReleaseEditor() {
    const release = complianceData.release ?? {};
    complianceReleaseForm.reset();
    complianceReleaseFormConclusion.value = release.conclusion ?? "not_releasable";
    complianceReleaseVersion.value = release.appVersion ?? "";
    complianceReleaseCommit.value = release.commitSha ?? "";
    complianceReleaseChannels.value = Array.isArray(release.channels)
      ? release.channels.join("，")
      : "";
    complianceReleaseJurisdictions.value = Array.isArray(release.jurisdictions)
      ? release.jurisdictions.join("，")
      : "";
    complianceReleaseBusiness.value = release.businessModel ?? "";
    complianceReleaseReviewDate.value = release.reviewDate ?? "";
    complianceReleaseEvidenceAt.value = formatLocalDateTime(release.evidenceGeneratedAt);
    complianceReleaseScopeNotes.value = release.scopeNotes ?? "";
    complianceReleaseFormBasis.value = release.basis ?? "";
    complianceReleaseEvidenceRefs.value = formatEvidenceRefs(release.evidenceRefs);
    complianceReleaseReviewer.value = release.reviewer ?? "LC";
    complianceReleaseChangeSummary.value = "";
    if (!complianceReleaseDialog.open) complianceReleaseDialog.showModal();
  }

  async function saveComplianceRelease(event) {
    event.preventDefault();
    if (complianceBusy) return;
    const channels = parseCommaList(complianceReleaseChannels.value);
    const jurisdictions = parseCommaList(complianceReleaseJurisdictions.value);
    const snapshot = {
      conclusion: complianceReleaseFormConclusion.value,
      appVersion: complianceReleaseVersion.value.trim() || null,
      commitSha: complianceReleaseCommit.value.trim().toLowerCase() || null,
      channels,
      businessModel: complianceReleaseBusiness.value.trim(),
      jurisdictions,
      reviewDate: complianceReleaseReviewDate.value || null,
      evidenceGeneratedAt: complianceReleaseEvidenceAt.value
        ? new Date(complianceReleaseEvidenceAt.value).toISOString()
        : null,
      scopeNotes: complianceReleaseScopeNotes.value.trim(),
      basis: complianceReleaseFormBasis.value.trim(),
      evidenceRefs: parseEvidenceRefs(complianceReleaseEvidenceRefs.value),
      reviewer: complianceReleaseReviewer.value.trim(),
      changeSummary: complianceReleaseChangeSummary.value.trim(),
      applicableScope: {
        appVersion: complianceReleaseVersion.value.trim() || null,
        commitSha: complianceReleaseCommit.value.trim().toLowerCase() || null,
        channels,
        businessModel: complianceReleaseBusiness.value.trim() || null,
        jurisdictions,
        reviewDate: complianceReleaseReviewDate.value || null,
      },
    };
    if (!snapshot.evidenceRefs.length) {
      setMessage("更新发行结论时必须填写至少一条证据引用。", "error");
      return;
    }
    complianceBusy = true;
    saveComplianceReleaseButton.disabled = true;
    try {
      const result = await cloud.appendComplianceReleaseSnapshot(
        Number(complianceData.release?.revision) || 0,
        snapshot,
      );
      await loadCompliance();
      complianceReleaseDialog.close();
      setMessage(`已保存商业发行结论快照 #${result.revision}。`);
    } catch (error) {
      const message = error?.code === "40001"
        ? "商业发行结论已在其他页面更新，请刷新后重试。"
        : error?.message ?? "商业发行结论保存失败。";
      setMessage(message, "error");
    } finally {
      complianceBusy = false;
      saveComplianceReleaseButton.disabled = false;
    }
  }

  async function loadOverview() {
    const data = await cloud.loadAdminDashboard();
    renderMetrics(data);
    overviewUpdatedAt.textContent = `更新于 ${formatDate(new Date(), true)}`;
  }

  async function loadUsers() {
    const result = await cloud.loadAdminUsers(
      userSearchInput.value.trim(),
      USER_PAGE_SIZE,
      usersOffset,
    );
    renderUsers(result);
  }

  async function loadFeedback() {
    const status = feedbackStatusFilter.value || null;
    renderFeedback(await cloud.loadAdminFeedback(status, 100, 0));
  }

  async function loadAnnouncements() {
    if (typeof cloud.loadAdminAnnouncements !== "function") {
      renderAnnouncements({ items: [] });
      return;
    }
    renderAnnouncements(await cloud.loadAdminAnnouncements(100));
  }

  async function loadCompliance() {
    if (typeof cloud.loadAdminCompliance !== "function") {
      renderCompliance({ issues: [], counts: {}, release: null });
      return;
    }
    renderCompliance(await cloud.loadAdminCompliance());
  }

  async function refreshAdminData() {
    if (loading) return;
    loading = true;
    refreshAdminButton.disabled = true;
    setMessage("正在读取后台数据……");
    try {
      await Promise.all([
        loadOverview(),
        loadUsers(),
        loadFeedback(),
        loadAnnouncements(),
        loadCompliance(),
      ]);
      setMessage();
    } catch (error) {
      setMessage(error?.message ?? "后台数据读取失败。", "error");
    } finally {
      loading = false;
      refreshAdminButton.disabled = false;
    }
  }

  async function verifySession(session) {
    currentSession = session;
    if (!session?.user) {
      showLogin();
      return;
    }
    setMessage("正在验证管理员权限……");
    try {
      if (!await cloud.isAdmin()) {
        showDenied();
        return;
      }
      showDashboard();
      setActiveSection(activeSection);
      await refreshAdminData();
    } catch (error) {
      showDenied();
      setMessage(error?.message ?? "管理员权限验证失败。", "error");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!cloud) return;
    adminLoginButton.disabled = true;
    setMessage("正在登录……");
    try {
      const result = await cloud.signIn(
        adminEmail.value.trim(),
        adminPassword.value,
      );
      await verifySession(result?.session);
    } catch (error) {
      setMessage(error?.message ?? "登录失败。", "error");
    } finally {
      adminLoginButton.disabled = false;
      adminPassword.value = "";
    }
  }

  async function logout() {
    try {
      await cloud?.signOut();
    } catch (error) {
      setMessage(error?.message ?? "退出失败。", "error");
      return;
    }
    showLogin();
  }

  async function updateSelectedMembership() {
    if (!selectedUser?.userId || !selectedUserDetail) return;
    const minimum = Math.max(
      0,
      Number(selectedUserDetail.membershipRemainingDays) || 0,
    );
    const days = Number(membershipDaysInput.value);
    if (!Number.isInteger(days) || days < minimum || days > 36500) {
      setMessage(`会员剩余天数必须是 ${minimum} 至 36500 的整数。`, "error");
      membershipDaysInput.focus();
      return;
    }

    setMembershipButton.disabled = true;
    try {
      const result = await cloud.setUserMembershipDays(selectedUser.userId, days);
      await openUserDetail(selectedUser);
      const extendedDays = Math.max(0, Number(result?.extendedDays) || 0);
      setMessage(
        extendedDays > 0
          ? `已将该用户的会员剩余时长延长 ${extendedDays} 天。`
          : "该用户的会员剩余时长未发生变化。",
      );
    } catch (error) {
      setMessage(error?.message ?? "会员时长设置失败。", "error");
      setMembershipButton.disabled = false;
    }
  }

  async function extendAllMemberships() {
    const confirmed = window.confirm(
      "确认给当前所有注册用户延长 7 天会员？此操作会立即写入并发送通知。",
    );
    if (!confirmed) return;
    extendAllMembershipsButton.disabled = true;
    try {
      const result = await cloud.extendAllMemberships();
      await Promise.all([loadOverview(), loadUsers()]);
      if (userDetailDialog.open && selectedUser) await openUserDetail(selectedUser);
      setMessage(`已为 ${Number(result?.affectedUsers) || 0} 位用户延长 7 天会员。`);
    } catch (error) {
      setMessage(error?.message ?? "全体会员延长失败。", "error");
    } finally {
      extendAllMembershipsButton.disabled = false;
    }
  }

  async function publishAnnouncement(event) {
    event.preventDefault();
    const title = announcementTitle.value.trim();
    const body = announcementBody.value.trim();
    if (!title || !body) {
      setMessage("请填写公告标题和正文。", "error");
      return;
    }
    const compliance = {
      rightsBasis: announcementRightsBasis.value,
      author: announcementRightsAuthor.value.trim(),
      sourceUrl: announcementRightsSourceUrl.value.trim(),
      license: announcementRightsLicense.value.trim(),
      authorizationReference: announcementAuthorizationReference.value.trim(),
      containsIdentifiablePeople: announcementContainsPeople.checked,
      personConsentBasis: announcementPersonConsentBasis.value.trim(),
      textOrigin: announcementTextOrigin.value,
      provider: announcementAiProvider.value.trim(),
      model: announcementAiModel.value.trim(),
      promptHash: announcementPromptHash.value.trim().toLowerCase(),
      disclosureLabel: announcementDisclosureLabel.checked,
      humanReviewed: announcementHumanReviewed.checked,
    };
    if (!compliance.humanReviewed) {
      setMessage("发布前必须完成人工权利复核。", "error");
      announcementHumanReviewed.focus();
      return;
    }
    if (announcementFiles.length && !compliance.author) {
      setMessage("每批公告图片必须填写作者或权利人。", "error");
      announcementRightsAuthor.focus();
      return;
    }
    if (
      announcementFiles.length &&
      ["licensed", "open-license"].includes(compliance.rightsBasis) &&
      (!compliance.license || !compliance.sourceUrl)
    ) {
      setMessage("许可图片必须填写直接来源和许可证名称与版本。", "error");
      announcementRightsSourceUrl.focus();
      return;
    }
    if (
      announcementFiles.length &&
      compliance.rightsBasis === "public-domain" &&
      !compliance.sourceUrl
    ) {
      setMessage("公有领域图片必须填写可复核的直接来源。", "error");
      announcementRightsSourceUrl.focus();
      return;
    }
    if (compliance.containsIdentifiablePeople && !compliance.personConsentBasis) {
      setMessage("包含可识别人物时必须填写肖像或人物权利依据。", "error");
      announcementPersonConsentBasis.focus();
      return;
    }
    const usesAi = compliance.textOrigin !== "original" ||
      (announcementFiles.length && compliance.rightsBasis === "ai-generated");
    if (
      usesAi &&
      (!compliance.provider || !compliance.model ||
        !/^[0-9a-f]{64}$/.test(compliance.promptHash))
    ) {
      setMessage("AI 内容必须记录提供方、模型版本和提示词 SHA-256。", "error");
      announcementAiProvider.focus();
      return;
    }
    if (usesAi && !compliance.disclosureLabel) {
      setMessage("AI 生成或辅助内容必须启用用户可见标识。", "error");
      announcementDisclosureLabel.focus();
      return;
    }

    announcementBusy = true;
    updateAnnouncementFormState();
    try {
      await cloud.publishAnnouncement(
        title,
        body,
        announcementFiles.map((entry) => entry.file),
        compliance,
      );
      announcementForm.reset();
      clearAnnouncementFiles();
      await loadAnnouncements();
      setMessage("公告已发布，用户可在“消息通知”中查看。");
    } catch (error) {
      setMessage(error?.message ?? "公告发布失败。", "error");
    } finally {
      announcementBusy = false;
      updateAnnouncementFormState();
    }
  }

  async function takedownAnnouncement(announcementId, title) {
    const reason = window.prompt(
      `请填写“${title}”的权利下架依据或工单编号。公告会先隐藏，再删除公开图片，审计记录会保留。`,
      "",
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setMessage("权利下架原因至少需要 3 个字符。", "error");
      return;
    }
    announcementBusy = true;
    updateAnnouncementFormState();
    try {
      await cloud.takedownAnnouncement(announcementId, reason.trim());
      await loadAnnouncements();
      setMessage("公告已完成权利下架，审计记录已保留。");
    } catch (error) {
      setMessage(error?.message ?? "公告权利下架失败，请重试。", "error");
    } finally {
      announcementBusy = false;
      updateAnnouncementFormState();
    }
  }

  async function deleteAnnouncement(announcementId, title) {
    const confirmed = window.confirm(
      `确认删除公告“${title}”？删除后所有用户将不再看到该公告，此操作无法撤销。`,
    );
    if (!confirmed) return;

    announcementBusy = true;
    updateAnnouncementFormState();
    try {
      const result = await cloud.deleteAnnouncement(announcementId);
      await loadAnnouncements();
      if (result?.imageCleanupFailed) {
        setMessage(
          "公告已删除，但部分图片暂未清理，请稍后重试或检查存储空间。",
          "error",
        );
      } else {
        setMessage(result?.deleted === false ? "该公告已经被删除。" : "公告已删除。");
      }
    } catch (error) {
      setMessage(error?.message ?? "公告删除失败。", "error");
    } finally {
      announcementBusy = false;
      updateAnnouncementFormState();
    }
  }

  async function setAnnouncementPinned(announcementId, pinned) {
    announcementBusy = true;
    updateAnnouncementFormState();
    try {
      await cloud.setAnnouncementPinned(announcementId, pinned);
      await loadAnnouncements();
      setMessage(pinned ? "公告已置顶。" : "公告已取消置顶。");
    } catch (error) {
      setMessage(error?.message ?? "公告置顶状态更新失败。", "error");
    } finally {
      announcementBusy = false;
      updateAnnouncementFormState();
    }
  }

  async function initialize() {
    if (!cloud) {
      showLogin();
      adminLoginButton.disabled = true;
      setMessage("云端服务尚未配置。", "error");
      return;
    }
    cloud.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") showLogin();
      if (event === "TOKEN_REFRESHED" && session) currentSession = session;
    });
    try {
      await verifySession(await cloud.getSession());
    } catch (error) {
      showLogin();
      setMessage(error?.message ?? "账户服务暂不可用。", "error");
    }
  }

  adminLoginForm.addEventListener("submit", handleLogin);
  adminLogoutButton.addEventListener("click", logout);
  deniedLogoutButton.addEventListener("click", logout);
  refreshAdminButton.addEventListener("click", refreshAdminData);
  usersTab.addEventListener("click", () => setActiveSection("users"));
  feedbackTab.addEventListener("click", () => setActiveSection("feedback"));
  announcementsTab.addEventListener("click", () => setActiveSection("announcements"));
  complianceTab.addEventListener("click", () => setActiveSection("compliance"));
  extendAllMembershipsButton.addEventListener("click", extendAllMemberships);
  announcementForm.addEventListener("submit", publishAnnouncement);
  announcementImageInput.addEventListener("change", async () => {
    await addAnnouncementFiles(announcementImageInput.files);
  });
  announcementList.addEventListener("click", async (event) => {
    if (announcementBusy) return;
    const pinButton = event.target.closest(".announcement-pin-button");
    if (pinButton) {
      await setAnnouncementPinned(
        pinButton.dataset.announcementId,
        pinButton.dataset.announcementPinned !== "true",
      );
      return;
    }
    const takedownButton = event.target.closest(".announcement-takedown-button");
    if (takedownButton) {
      await takedownAnnouncement(
        takedownButton.dataset.announcementId,
        takedownButton.dataset.announcementTitle,
      );
      return;
    }
    const deleteButton = event.target.closest(".announcement-delete-button");
    if (!deleteButton) return;
    await deleteAnnouncement(
      deleteButton.dataset.announcementId,
      deleteButton.dataset.announcementTitle,
    );
  });
  setMembershipButton.addEventListener("click", updateSelectedMembership);
  userSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    usersOffset = 0;
    try {
      await loadUsers();
      setMessage();
    } catch (error) {
      setMessage(error?.message ?? "用户搜索失败。", "error");
    }
  });
  previousUsersButton.addEventListener("click", async () => {
    usersOffset = Math.max(0, usersOffset - USER_PAGE_SIZE);
    await loadUsers();
  });
  nextUsersButton.addEventListener("click", async () => {
    usersOffset += USER_PAGE_SIZE;
    await loadUsers();
  });
  feedbackStatusFilter.addEventListener("change", async () => {
    try {
      await loadFeedback();
      setMessage();
    } catch (error) {
      setMessage(error?.message ?? "反馈读取失败。", "error");
    }
  });
  complianceFilters.addEventListener("submit", (event) => event.preventDefault());
  [
    complianceMatrixFilter,
    complianceSeverityFilter,
    complianceCategoryFilter,
    complianceStatusFilter,
    complianceOwnerFilter,
    complianceExternalFilter,
    complianceDueFilter,
  ].forEach((filter) => filter.addEventListener("change", renderComplianceCards));
  complianceSearchInput.addEventListener("input", renderComplianceCards);
  complianceCardRail.addEventListener("click", async (event) => {
    const card = event.target.closest(".compliance-card");
    if (card) await openComplianceIssue(card.dataset.issueId);
  });
  newComplianceIssueButton.addEventListener("click", openNewComplianceIssue);
  editComplianceIssueButton.addEventListener("click", () => {
    if (!selectedComplianceIssue) return;
    complianceCreateMode = false;
    fillComplianceIssueForm(selectedComplianceIssue);
    setComplianceFormMode(true);
    complianceIssueChangeSummary.focus();
  });
  complianceIssueMatrixType.addEventListener("change", updateComplianceRightsVisibility);
  complianceIssueSeverity.addEventListener("change", () => {
    if (complianceIssueSeverity.value === "CLEARED") {
      complianceIssueStatus.value = "closed";
    }
  });
  complianceIssueForm.addEventListener("submit", saveComplianceIssue);
  cancelComplianceIssueEditButton.addEventListener("click", () => {
    if (complianceCreateMode) {
      complianceIssueDialog.close();
      selectedComplianceIssue = null;
      complianceCreateMode = false;
      return;
    }
    setComplianceFormMode(false);
  });
  closeComplianceIssueButton.addEventListener("click", () => {
    complianceIssueDialog.close();
    selectedComplianceIssue = null;
    complianceCreateMode = false;
  });
  complianceIssueDialog.addEventListener("click", (event) => {
    if (event.target === complianceIssueDialog) {
      complianceIssueDialog.close();
      selectedComplianceIssue = null;
      complianceCreateMode = false;
    }
  });
  editComplianceReleaseButton.addEventListener("click", openComplianceReleaseEditor);
  complianceReleaseForm.addEventListener("submit", saveComplianceRelease);
  closeComplianceReleaseButton.addEventListener("click", () => {
    complianceReleaseDialog.close();
  });
  cancelComplianceReleaseButton.addEventListener("click", () => {
    complianceReleaseDialog.close();
  });
  complianceReleaseDialog.addEventListener("click", (event) => {
    if (event.target === complianceReleaseDialog) complianceReleaseDialog.close();
  });
  closeUserDetailButton.addEventListener("click", () => {
    userDetailDialog.close();
    selectedUser = null;
    selectedUserDetail = null;
  });
  userDetailDialog.addEventListener("click", (event) => {
    if (event.target === userDetailDialog) {
      userDetailDialog.close();
      selectedUser = null;
      selectedUserDetail = null;
    }
  });

  initialize();
})();
