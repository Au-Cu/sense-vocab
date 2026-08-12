(() => {
  const app = window.SenseVocabApp;
  if (!app) return;

  const accountButton = document.querySelector("#accountButton");
  const accountDialog = document.querySelector("#accountDialog");
  const accountStateBadge = document.querySelector("#accountStateBadge");
  const accountAuthView = document.querySelector("#accountAuthView");
  const accountIntro = document.querySelector("#accountIntro");
  const accountConsentView = document.querySelector("#accountConsentView");
  const accountUserView = document.querySelector("#accountUserView");
  const accountConflictView = document.querySelector("#accountConflictView");
  const accountDeleteConfirm = document.querySelector("#accountDeleteConfirm");
  const accountFeedbackView = document.querySelector("#accountFeedbackView");
  const accountDataActions = document.querySelector("#accountDataActions");
  const accountLoginTab = document.querySelector("#accountLoginTab");
  const accountRegisterTab = document.querySelector("#accountRegisterTab");
  const accountForm = document.querySelector("#accountForm");
  const accountEmail = document.querySelector("#accountEmail");
  const accountPasswordField = document.querySelector("#accountPasswordField");
  const accountPasswordLabel = document.querySelector("#accountPasswordLabel");
  const accountPassword = document.querySelector("#accountPassword");
  const accountOtpField = document.querySelector("#accountOtpField");
  const accountOtp = document.querySelector("#accountOtp");
  const invitationCodeField = document.querySelector("#invitationCodeField");
  const invitationCode = document.querySelector("#invitationCode");
  const registrationConsents = document.querySelector("#registrationConsents");
  const registerTermsConsent = document.querySelector("#registerTermsConsent");
  const registerCrossBorderConsent = document.querySelector("#registerCrossBorderConsent");
  const registerAgeConsent = document.querySelector("#registerAgeConsent");
  const existingTermsConsent = document.querySelector("#existingTermsConsent");
  const existingCrossBorderConsent = document.querySelector("#existingCrossBorderConsent");
  const existingAgeConsent = document.querySelector("#existingAgeConsent");
  const acceptLegalConsentButton = document.querySelector("#acceptLegalConsentButton");
  const declineLegalConsentButton = document.querySelector("#declineLegalConsentButton");
  const accountSubmitButton = document.querySelector("#accountSubmitButton");
  const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
  const backToLoginButton = document.querySelector("#backToLoginButton");
  const resendOtpButton = document.querySelector("#resendOtpButton");
  const accountEmailLabel = document.querySelector("#accountEmailLabel");
  const accountSyncStatus = document.querySelector("#accountSyncStatus");
  const accountMembershipExpiry = document.querySelector("#accountMembershipExpiry");
  const accountInviteCode = document.querySelector("#accountInviteCode");
  const accountMessage = document.querySelector("#accountMessage");
  const syncNowButton = document.querySelector("#syncNowButton");
  const logoutButton = document.querySelector("#logoutButton");
  const deleteAccountButton = document.querySelector("#deleteAccountButton");
  const confirmDeleteAccountButton = document.querySelector("#confirmDeleteAccountButton");
  const cancelDeleteAccountButton = document.querySelector("#cancelDeleteAccountButton");
  const deleteAccountConfirmation = document.querySelector("#deleteAccountConfirmation");
  const mergeStateButton = document.querySelector("#mergeStateButton");
  const useCloudStateButton = document.querySelector("#useCloudStateButton");
  const useLocalStateButton = document.querySelector("#useLocalStateButton");
  const cloudRecordLatest = document.querySelector("#cloudRecordLatest");
  const cloudRecordSummary = document.querySelector("#cloudRecordSummary");
  const cloudRecordPlan = document.querySelector("#cloudRecordPlan");
  const localRecordLatest = document.querySelector("#localRecordLatest");
  const localRecordSummary = document.querySelector("#localRecordSummary");
  const localRecordPlan = document.querySelector("#localRecordPlan");
  const accountConflictDifference = document.querySelector(
    "#accountConflictDifference",
  );
  const exportDataButton = document.querySelector("#exportDataButton");
  const importDataButton = document.querySelector("#importDataButton");
  const importDataInput = document.querySelector("#importDataInput");
  const feedbackContext = document.querySelector("#feedbackContext");
  const feedbackContextWord = document.querySelector("#feedbackContextWord");
  const feedbackIntro = document.querySelector("#feedbackIntro");
  const feedbackStructuredFields = document.querySelector("#feedbackStructuredFields");
  const feedbackIssueSelect = document.querySelector("#feedbackIssueSelect");
  const feedbackSenseField = document.querySelector("#feedbackSenseField");
  const feedbackSenseSelect = document.querySelector("#feedbackSenseSelect");
  const feedbackMissingSenseField = document.querySelector("#feedbackMissingSenseField");
  const feedbackMissingSense = document.querySelector("#feedbackMissingSense");
  const feedbackMessageLabel = document.querySelector("#feedbackMessageLabel");
  const feedbackMessage = document.querySelector("#feedbackMessage");
  const feedbackImageInput = document.querySelector("#feedbackImageInput");
  const feedbackImageCount = document.querySelector("#feedbackImageCount");
  const feedbackImagePreview = document.querySelector("#feedbackImagePreview");
  const feedbackAttachmentCompliance = document.querySelector(
    "#feedbackAttachmentCompliance",
  );
  const feedbackAttachmentRightsConsent = document.querySelector(
    "#feedbackAttachmentRightsConsent",
  );
  const feedbackAttachmentAiDisclosure = document.querySelector(
    "#feedbackAttachmentAiDisclosure",
  );
  const submitFeedbackButton = document.querySelector("#submitFeedbackButton");
  const cancelFeedbackButton = document.querySelector("#cancelFeedbackButton");
  const closeAccountButton = document.querySelector("#closeAccountButton");
  const moreButton = document.querySelector("#moreButton");
  const moreDialog = document.querySelector("#moreDialog");
  const notificationsButton = document.querySelector("#notificationsButton");
  const notificationBadge = document.querySelector("#notificationBadge");
  const notificationsDialog = document.querySelector("#notificationsDialog");
  const notificationsAccountState = document.querySelector("#notificationsAccountState");
  const notificationsIntro = document.querySelector("#notificationsIntro");
  const notificationsList = document.querySelector("#notificationsList");
  const notificationsMessage = document.querySelector("#notificationsMessage");
  const closeNotificationsButton = document.querySelector("#closeNotificationsButton");
  const registrationWelcomeDialog = document.querySelector("#registrationWelcomeDialog");
  const registrationWelcomeMessage = document.querySelector("#registrationWelcomeMessage");
  const closeRegistrationWelcomeButton = document.querySelector(
    "#closeRegistrationWelcomeButton",
  );

  const SYNC_META_PREFIX = "sense-vocab-cloud-sync-v1:";
  const GUEST_MIGRATION_PREFIX = "sense-vocab-guest-migration-v1:";
  const MAX_SYNC_RETRIES = 5;
  const MISSING_SENSE_ISSUE = "missing-sense";
  const OTHER_FEEDBACK_ISSUE = "other";
  const REFRESH_INTERVAL_MS = Number.isFinite(
    window.__SENSE_VOCAB_REFRESH_INTERVAL_MS__,
  )
    ? Math.max(100, window.__SENSE_VOCAB_REFRESH_INTERVAL_MS__)
    : 45000;
  const config = window.SENSE_VOCAB_CLOUD_CONFIG ?? {};
  const factory = window.__SENSE_VOCAB_CLOUD_FACTORY__ ??
    window.SenseVocabCloud?.create;
  const cloud = typeof factory === "function" ? factory(config) : null;

  let mode = "login";
  let authStep = "credentials";
  let pendingAuth = null;
  let currentUser = null;
  let cloudRevision = null;
  let pendingConflict = null;
  let conflictBusy = false;
  let syncTimer = null;
  let syncPromise = null;
  let refreshPromise = null;
  let refreshTimer = null;
  let authBusy = false;
  let deleting = false;
  let feedbackBusy = false;
  let feedbackFiles = [];
  let activeFeedbackContext = null;
  let pendingFeedbackRequest = false;
  let pendingConsentSession = null;
  let consentBusy = false;
  let accountProfile = null;
  let notificationsBusy = false;
  let notificationSnapshot = { authenticated: false, unreadCount: 0, items: [] };
  let localQuotaWarning = false;
  const volatileSyncMeta = new Map();
  const volatileGuestDecisions = new Map();

  function syncMetaKey(userId) {
    return `${SYNC_META_PREFIX}${userId}`;
  }

  function migrationKey(userId) {
    return `${GUEST_MIGRATION_PREFIX}${userId}`;
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadSyncMeta(userId) {
    return {
      revision: null,
      dirty: false,
      lastSyncedAt: null,
      ...readJson(syncMetaKey(userId), {}),
      ...(volatileSyncMeta.get(userId) ?? {}),
    };
  }

  function saveSyncMeta(userId, next) {
    const merged = {
      ...loadSyncMeta(userId),
      ...next,
    };
    try {
      localStorage.setItem(syncMetaKey(userId), JSON.stringify(merged));
      volatileSyncMeta.delete(userId);
    } catch (error) {
      volatileSyncMeta.set(userId, merged);
      window.dispatchEvent(new CustomEvent("sensevocab:storage-error", {
        detail: {
          error,
          storageKey: syncMetaKey(userId),
          quotaExceeded: /quota|storage.*full|exceeded/i.test(
            `${error?.name ?? ""} ${error?.message ?? ""}`,
          ),
        },
      }));
    }
  }

  function rememberGuestDecision(userId) {
    const guestState = app.getGuestState();
    const signature = app.stateSignature(guestState);
    try {
      localStorage.setItem(migrationKey(userId), signature);
      volatileGuestDecisions.delete(userId);
    } catch {
      volatileGuestDecisions.set(userId, signature);
      // The in-memory decision remains valid for this login session.
    }
  }

  function hasUnconsideredGuestState(userId, guestState) {
    if (!app.hasLearningData(guestState)) return false;
    const remembered = volatileGuestDecisions.get(userId) ??
      localStorage.getItem(migrationKey(userId));
    return remembered !== app.stateSignature(guestState);
  }

  function setMessage(message = "", type = "") {
    accountMessage.textContent = message;
    accountMessage.classList.toggle("is-error", type === "error");
  }

  function setNotificationsMessage(message = "", type = "") {
    notificationsMessage.textContent = message;
    notificationsMessage.classList.toggle("is-error", type === "error");
  }

  function formatAccountDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function formatStudyDate(value) {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "—";
    return `${Number(match[2])}月${Number(match[3])}日`;
  }

  function stateBookEntries(candidate) {
    if (
      candidate?.bookStates &&
      typeof candidate.bookStates === "object" &&
      !Array.isArray(candidate.bookStates)
    ) {
      return Object.entries(candidate.bookStates);
    }
    return [[candidate?.activeBookId || "kaoyan", candidate ?? {}]];
  }

  function bookLabel(bookId) {
    return {
      kaoyan: "考研词汇",
      ielts: "雅思词汇",
    }[bookId] ?? bookId;
  }

  function stateSummary(candidate, updatedAt = null) {
    const learnedWords = new Set();
    const studyDates = new Set();
    const plans = [];
    let masteredSenses = 0;
    let pendingSenses = 0;

    stateBookEntries(candidate).forEach(([bookId, bookState]) => {
      const introducedWords = Array.isArray(bookState?.introducedWords)
        ? bookState.introducedWords
        : [];
      introducedWords.forEach((wordId) => learnedWords.add(`${bookId}:${wordId}`));

      Object.values(bookState?.progress ?? {}).forEach((progress) => {
        if (progress?.status === "mastered") {
          masteredSenses += 1;
        } else if (progress?.status && progress.status !== "new") {
          pendingSenses += 1;
        }
      });

      Object.keys(bookState?.activityLog ?? {})
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .forEach((date) => studyDates.add(date));
      (Array.isArray(bookState?.studyWindows) ? bookState.studyWindows : [])
        .forEach((studyWindow) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(studyWindow?.activityDate ?? "")) {
            studyDates.add(studyWindow.activityDate);
          }
        });

      const dailyTarget = Number(bookState?.plan?.dailyTarget);
      if (Number.isFinite(dailyTarget) && dailyTarget > 0) {
        plans.push(`${bookLabel(bookId)}：每天 ${dailyTarget} 词`);
      }
    });

    const latestStudyDate = [...studyDates].sort().at(-1) ?? null;
    return {
      learnedWords,
      learnedWordCount: learnedWords.size,
      masteredSenses,
      pendingSenses,
      studyDayCount: studyDates.size,
      latestStudyDate,
      fallbackUpdatedAt: updatedAt,
      planCopy: plans.length ? plans.join("；") : "尚未选择计划",
    };
  }

  function renderStateSummary(container, summary) {
    const stats = [
      [summary.learnedWordCount, "已学单词"],
      [summary.masteredSenses, "掌握义项"],
      [summary.pendingSenses, "待巩固义项"],
      [summary.studyDayCount, "学习天数"],
    ];
    container.replaceChildren(...stats.map(([value, label]) => {
      const item = document.createElement("div");
      item.className = "sync-record-stat";
      const number = document.createElement("strong");
      number.textContent = String(value);
      const copy = document.createElement("span");
      copy.textContent = label;
      item.append(number, copy);
      return item;
    }));
  }

  function countStatusDifferences(leftState, rightState) {
    const statusByKey = (candidate) => {
      const result = new Map();
      stateBookEntries(candidate).forEach(([bookId, bookState]) => {
        Object.entries(bookState?.progress ?? {}).forEach(([senseKey, progress]) => {
          result.set(`${bookId}:${senseKey}`, progress?.status ?? "new");
        });
      });
      return result;
    };
    const left = statusByKey(leftState);
    const right = statusByKey(rightState);
    const keys = new Set([...left.keys(), ...right.keys()]);
    return [...keys].filter((key) => left.get(key) !== right.get(key)).length;
  }

  function renderConflictComparison() {
    if (!pendingConflict) return;
    const cloudSummary = stateSummary(
      pendingConflict.remote?.state,
      pendingConflict.remote?.updatedAt,
    );
    const localSummary = stateSummary(pendingConflict.localState);
    renderStateSummary(cloudRecordSummary, cloudSummary);
    renderStateSummary(localRecordSummary, localSummary);
    cloudRecordPlan.textContent = cloudSummary.planCopy;
    localRecordPlan.textContent = localSummary.planCopy;
    cloudRecordLatest.textContent = cloudSummary.latestStudyDate
      ? `最近学习 ${formatStudyDate(cloudSummary.latestStudyDate)}`
      : cloudSummary.fallbackUpdatedAt
        ? `云端更新 ${formatAccountDate(cloudSummary.fallbackUpdatedAt)}`
        : "暂无学习日期";
    localRecordLatest.textContent = localSummary.latestStudyDate
      ? `最近学习 ${formatStudyDate(localSummary.latestStudyDate)}`
      : "暂无学习日期";

    const localOnly = [...localSummary.learnedWords]
      .filter((key) => !cloudSummary.learnedWords.has(key)).length;
    const cloudOnly = [...cloudSummary.learnedWords]
      .filter((key) => !localSummary.learnedWords.has(key)).length;
    const statusDifferences = countStatusDifferences(
      pendingConflict.localState,
      pendingConflict.remote?.state,
    );
    if (localOnly || cloudOnly) {
      accountConflictDifference.textContent =
        `本机独有 ${localOnly} 个已学单词，云端独有 ${cloudOnly} 个；` +
        "建议合并，避免遗漏任一侧。";
    } else if (statusDifferences) {
      accountConflictDifference.textContent =
        `两边已学单词范围相同，但有 ${statusDifferences} 个义项状态不同；` +
        "建议合并后按较谨慎状态继续学习。";
    } else {
      accountConflictDifference.textContent =
        "两边的核心学习进度基本一致；合并不会遗漏记录，也无需判断哪份更新。";
    }
  }

  function setConflictBusy(busy) {
    conflictBusy = busy;
    [mergeStateButton, useCloudStateButton, useLocalStateButton].forEach((button) => {
      button.disabled = busy;
    });
  }

  function formatNotificationTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Hong_Kong",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function announceMembership(profile = null, options = {}) {
    const loggedIn = Boolean(currentUser);
    const pending = Boolean(options.pending);
    const active = !loggedIn || pending || profile?.memberActive !== false;
    document.documentElement.dataset.membershipActive = String(active);
    window.dispatchEvent(new CustomEvent("sensevocab:membership", {
      detail: {
        loggedIn,
        pending,
        active,
        expiresAt: profile?.membershipExpiresAt ?? null,
        remainingDays: Number(profile?.remainingDays) || 0,
      },
    }));
  }

  function applyAccountProfile(profile = null) {
    accountProfile = profile && typeof profile === "object" ? profile : null;
    accountMembershipExpiry.textContent = accountProfile
      ? formatAccountDate(accountProfile.membershipExpiresAt)
      : currentUser
        ? "暂时无法读取"
        : "—";
    accountInviteCode.textContent = !currentUser
      ? "—"
      : accountProfile?.inviteCode
        ? accountProfile.inviteCode
        : accountProfile?.inviteUsedAt
          ? "已使用"
          : "暂时无法读取";
    accountMembershipExpiry.classList.toggle(
      "is-expired",
      Boolean(currentUser && accountProfile?.memberActive === false),
    );
    announceMembership(accountProfile);
  }

  async function refreshAccountProfile(options = {}) {
    if (!currentUser || typeof cloud?.loadAccountProfile !== "function") {
      applyAccountProfile(null);
      return null;
    }
    announceMembership(accountProfile, { pending: true });
    try {
      const profile = await cloud.loadAccountProfile();
      if (currentUser) applyAccountProfile(profile);
      return profile;
    } catch (error) {
      if (!options.silent) {
        setMessage(error?.message ?? "会员信息读取失败。", "error");
      }
      applyAccountProfile(null);
      return null;
    }
  }

  function showRegistrationWelcome(receipt) {
    const registrationNumber = Number(receipt?.registrationNumber);
    registrationWelcomeMessage.textContent = Number.isFinite(registrationNumber)
      ? `恭喜你成为第 ${registrationNumber} 位注册用户`
      : "恭喜你注册成功";
    registrationWelcomeDialog.hidden = false;
  }

  function updateNotificationBadge(snapshot = notificationSnapshot) {
    const unreadCount = Math.max(0, Number(snapshot?.unreadCount) || 0);
    notificationBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    notificationBadge.hidden = unreadCount === 0;
    notificationsButton.classList.toggle("has-unread", unreadCount > 0);
    moreButton.classList.toggle("has-unread", unreadCount > 0);
    moreButton.setAttribute(
      "aria-label",
      unreadCount > 0 ? `更多，${unreadCount} 条未读消息` : "更多",
    );
  }

  function renderNotifications(snapshot = notificationSnapshot) {
    notificationSnapshot = {
      authenticated: Boolean(snapshot?.authenticated),
      unreadCount: Math.max(0, Number(snapshot?.unreadCount) || 0),
      items: Array.isArray(snapshot?.items) ? snapshot.items : [],
    };
    updateNotificationBadge(notificationSnapshot);
    notificationsAccountState.textContent = currentUser ? "账户消息" : "公告";
    notificationsAccountState.classList.toggle("is-online", Boolean(currentUser));
    notificationsIntro.textContent = currentUser
      ? "这里会显示公告、反馈答复与会员消息。"
      : "公告会在这里发布。登录后还可以查看反馈答复与账户消息。";
    notificationsList.replaceChildren();

    if (!notificationSnapshot.items.length) {
      const empty = document.createElement("p");
      empty.className = "notifications-empty";
      empty.textContent = "暂时没有消息";
      notificationsList.append(empty);
      return;
    }

    notificationSnapshot.items.forEach((notification, index) => {
      const item = document.createElement("article");
      item.className = "notification-item";
      item.classList.toggle("is-unread", !notification.readAt && Boolean(currentUser));
      item.classList.toggle(
        "is-pinned",
        notification.kind === "announcement" && Boolean(notification.isPinned),
      );

      const heading = document.createElement("div");
      heading.className = "notification-item-heading";
      const title = document.createElement("strong");
      title.textContent = notification.title || "消息";
      const headingMeta = document.createElement("div");
      headingMeta.className = "notification-item-heading-meta";
      const time = document.createElement("span");
      time.textContent = formatNotificationTime(notification.createdAt);
      headingMeta.append(time);

      const isAnnouncement = notification.kind === "announcement";
      const content = document.createElement("div");
      content.className = "notification-item-content";
      content.id = `notification-content-${index}-${notification.id || "item"}`;
      content.hidden = isAnnouncement;
      if (isAnnouncement) {
        const expandButton = document.createElement("button");
        expandButton.className = "notification-expand-button";
        expandButton.type = "button";
        expandButton.textContent = "展开";
        expandButton.setAttribute("aria-expanded", "false");
        expandButton.setAttribute("aria-controls", content.id);
        expandButton.addEventListener("click", () => {
          const shouldExpand = content.hidden;
          content.hidden = !shouldExpand;
          expandButton.textContent = shouldExpand ? "收起" : "展开";
          expandButton.setAttribute("aria-expanded", String(shouldExpand));
        });
        headingMeta.append(expandButton);
      }
      heading.append(title, headingMeta);

      const body = document.createElement("p");
      body.textContent = notification.body || "";
      content.append(body);
      const aiGenerated = ["ai-assisted", "ai-generated"].includes(
        notification.contentProvenance?.textOrigin,
      ) ||
        notification.rightsMetadata?.some((entry) =>
          entry?.rightsBasis === "ai-generated");
      if (aiGenerated) {
        const aiLabel = document.createElement("p");
        aiLabel.className = "notification-ai-label";
        aiLabel.textContent = "此公告包含 AI 生成或合成内容，已由人工复核。";
        content.append(aiLabel);
      }
      if (notification.images?.length) {
        const images = document.createElement("div");
        images.className = "notification-images";
        notification.images.forEach((entry, index) => {
          if (!entry?.url) return;
          const link = document.createElement("a");
          link.href = entry.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          const image = document.createElement("img");
          image.src = entry.url;
          image.alt = `${notification.title || "公告"} 图片 ${index + 1}`;
          image.loading = "lazy";
          image.decoding = "async";
          link.append(image);
          images.append(link);
        });
        if (images.childElementCount) content.append(images);
      }
      item.append(heading, content);
      notificationsList.append(item);
    });
  }

  async function refreshNotifications(options = {}) {
    if (!cloud || typeof cloud.loadNotifications !== "function") {
      renderNotifications({ authenticated: false, unreadCount: 0, items: [] });
      return notificationSnapshot;
    }
    if (notificationsBusy) return notificationSnapshot;
    notificationsBusy = true;
    if (!options.silent) setNotificationsMessage("正在读取消息……");
    try {
      const snapshot = await cloud.loadNotifications(100);
      renderNotifications(snapshot);
      setNotificationsMessage();
      return notificationSnapshot;
    } catch (error) {
      if (!options.silent) {
        setNotificationsMessage(error?.message ?? "消息读取失败。", "error");
      }
      return notificationSnapshot;
    } finally {
      notificationsBusy = false;
    }
  }

  async function markVisibleNotificationsRead() {
    if (!currentUser || typeof cloud?.markNotificationRead !== "function") return;
    const unread = notificationSnapshot.items.filter((item) => !item.readAt);
    if (!unread.length) return;
    const readAt = new Date().toISOString();
    notificationSnapshot.items = notificationSnapshot.items.map((item) => {
      return unread.some((candidate) => candidate.id === item.id)
        ? { ...item, readAt }
        : item;
    });
    notificationSnapshot.unreadCount = 0;
    renderNotifications(notificationSnapshot);
    await Promise.allSettled(
      unread.map((item) => cloud.markNotificationRead(item.kind, item.id)),
    );
  }

  async function openNotificationsDialog() {
    if (moreDialog) moreDialog.hidden = true;
    notificationsDialog.hidden = false;
    await refreshNotifications();
    await markVisibleNotificationsRead();
  }

  function closeNotificationsDialog() {
    notificationsDialog.hidden = true;
    setNotificationsMessage();
  }

  function setSyncStatus(message, type = "") {
    accountSyncStatus.textContent = message;
    accountSyncStatus.classList.toggle("is-error", type === "error");
    accountSyncStatus.classList.toggle("is-pending", type === "pending");
    updateHomeStatus(type);
  }

  function updateHomeStatus(syncType = "") {
    const syncLabel = syncType === "error"
      ? "，同步失败"
      : syncType === "pending"
        ? "，待同步"
        : "";
    const stateLabel = currentUser ? "已登录" : "游客";
    accountButton.setAttribute("aria-label", `账户，${stateLabel}${syncLabel}`);
    accountButton.title = `${stateLabel}${syncLabel}`;
    accountButton.classList.toggle("has-account", Boolean(currentUser));
    accountButton.classList.toggle("has-sync-warning", Boolean(syncType));
  }

  function announceAccountScope(user = null) {
    if (user?.id) {
      document.documentElement.dataset.accountUserId = user.id;
    } else {
      delete document.documentElement.dataset.accountUserId;
    }
    window.dispatchEvent(new CustomEvent("sensevocab:account-scope", {
      detail: { userId: user?.id ?? null },
    }));
  }

  function announceAccountReady() {
    document.documentElement.dataset.accountReady = "true";
    window.dispatchEvent(new CustomEvent("sensevocab:account-ready"));
  }

  function renderAuthForm() {
    const registering = mode === "register";
    const recovering = mode === "recover";
    const verifying = authStep === "otp";
    const loginSelected = mode === "login";

    accountLoginTab.classList.toggle("is-active", loginSelected);
    accountLoginTab.setAttribute("aria-selected", String(loginSelected));
    accountRegisterTab.classList.toggle("is-active", registering);
    accountRegisterTab.setAttribute("aria-selected", String(registering));

    accountEmail.readOnly = verifying;
    accountEmail.autocomplete = "email";
    accountPasswordField.hidden = recovering ? !verifying : verifying;
    accountPassword.required = !accountPasswordField.hidden;
    accountPassword.autocomplete = recovering
      ? "new-password"
      : registering
        ? "new-password"
        : "current-password";
    accountPasswordLabel.textContent = recovering ? "新密码" : "密码";
    accountOtpField.hidden = !verifying;
    accountOtp.required = verifying;
    invitationCodeField.hidden = !(registering && !verifying);
    registrationConsents.hidden = !(registering && !verifying);
    forgotPasswordButton.hidden = !(mode === "login" && !verifying);
    backToLoginButton.hidden = mode === "login" && !verifying;
    resendOtpButton.hidden = !verifying;

    registerTermsConsent.required = false;
    registerCrossBorderConsent.required = false;
    registerAgeConsent.required = false;

    if (mode === "login") {
      accountIntro.textContent =
        "游客数据保存在当前浏览器。登录后可将进度同步到其他浏览器和设备。";
      accountSubmitButton.textContent = "登录";
    } else if (registering && !verifying) {
      accountIntro.textContent = "输入邮箱和密码后，我们会向该邮箱发送一次性验证码。";
      accountSubmitButton.textContent = "发送验证码";
    } else if (registering) {
      accountIntro.textContent = `验证码已发送至 ${pendingAuth?.email ?? accountEmail.value}，验证后即可完成注册。`;
      accountSubmitButton.textContent = "验证并注册";
    } else if (!verifying) {
      accountIntro.textContent = "输入注册邮箱，我们会发送一次性验证码用于重设密码。";
      accountSubmitButton.textContent = "发送验证码";
    } else {
      accountIntro.textContent = `验证码已发送至 ${pendingAuth?.email ?? accountEmail.value}，请输入验证码和新密码。`;
      accountSubmitButton.textContent = "验证并重设密码";
    }
  }

  function setMode(nextMode) {
    mode = nextMode;
    authStep = "credentials";
    pendingAuth = null;
    accountEmail.readOnly = false;
    accountOtp.value = "";
    accountPassword.value = "";
    if (mode !== "register") invitationCode.value = "";
    renderAuthForm();
    setMessage();
  }

  function beginOtpStep(nextMode, email) {
    mode = nextMode;
    authStep = "otp";
    pendingAuth = {
      mode: nextMode,
      email,
      requestedAt: Date.now(),
    };
    accountEmail.value = email;
    accountOtp.value = "";
    accountPassword.value = "";
    renderAuthForm();
    accountOtp.focus();
  }

  function updateLegalConsentButton() {
    acceptLegalConsentButton.disabled = consentBusy ||
      !existingTermsConsent.checked ||
      !existingCrossBorderConsent.checked ||
      !existingAgeConsent.checked;
  }

  function resetDeleteConfirmation() {
    deleteAccountConfirmation.value = "";
    confirmDeleteAccountButton.disabled = true;
  }

  function feedbackFormValidation() {
    const message = feedbackMessage.value.trim();
    if (feedbackFiles.length && !feedbackAttachmentRightsConsent.checked) {
      return {
        message: "请确认你有权提交所选图片。",
        field: feedbackAttachmentRightsConsent,
      };
    }
    if (feedbackFiles.length && !feedbackAttachmentAiDisclosure.value) {
      return {
        message: "请选择图片是否含 AI 生成或合成内容。",
        field: feedbackAttachmentAiDisclosure,
      };
    }
    if (!activeFeedbackContext) {
      return message.length >= 3
        ? null
        : { message: "请至少输入 3 个字符的问题描述。", field: feedbackMessage };
    }

    const issue = feedbackIssueSelect.value;
    if (!issue) {
      return { message: "请选择问题类型。", field: feedbackIssueSelect };
    }
    if (issue === MISSING_SENSE_ISSUE && !feedbackMissingSense.value.trim()) {
      return { message: "请填写缺少的义项。", field: feedbackMissingSense };
    }
    if (issue === OTHER_FEEDBACK_ISSUE && message.length < 3) {
      return { message: "请至少输入 3 个字符的问题描述。", field: feedbackMessage };
    }
    if (
      issue !== MISSING_SENSE_ISSUE &&
      issue !== OTHER_FEEDBACK_ISSUE &&
      !feedbackSenseSelect.value
    ) {
      return { message: "请选择问题所在的义项。", field: feedbackSenseSelect };
    }
    return null;
  }

  function updateFeedbackSubmitState() {
    submitFeedbackButton.disabled = feedbackBusy ||
      !currentUser ||
      Boolean(pendingConsentSession) ||
      Boolean(feedbackFormValidation());
    feedbackImageCount.textContent = `${feedbackFiles.length} / 4`;
  }

  function renderFeedbackFiles() {
    feedbackImagePreview.replaceChildren();
    feedbackFiles.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "feedback-image-item";

      const image = document.createElement("img");
      image.src = entry.url;
      image.alt = `反馈图片 ${index + 1}`;

      const removeButton = document.createElement("button");
      removeButton.className = "feedback-image-remove";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.title = "移除图片";
      removeButton.setAttribute("aria-label", `移除反馈图片 ${index + 1}`);
      removeButton.addEventListener("click", () => {
        URL.revokeObjectURL(entry.url);
        feedbackFiles.splice(index, 1);
        renderFeedbackFiles();
      });

      item.append(image, removeButton);
      feedbackImagePreview.append(item);
    });
    feedbackAttachmentCompliance.hidden = feedbackFiles.length === 0;
    if (!feedbackFiles.length) {
      feedbackAttachmentRightsConsent.checked = false;
      feedbackAttachmentAiDisclosure.value = "";
    }
    updateFeedbackSubmitState();
  }

  function clearFeedbackFiles() {
    feedbackFiles.forEach((entry) => URL.revokeObjectURL(entry.url));
    feedbackFiles = [];
    feedbackImageInput.value = "";
    renderFeedbackFiles();
  }

  function resetFeedbackForm() {
    feedbackIssueSelect.value = "";
    feedbackSenseSelect.value = "";
    feedbackMissingSense.value = "";
    feedbackMessage.value = "";
    renderFeedbackIssueFields();
    clearFeedbackFiles();
  }

  function normalizeFeedbackContext(context) {
    if (!context || typeof context !== "object") return null;
    const wordId = String(context.wordId ?? "").trim().slice(0, 160);
    const wordText = String(context.wordText ?? "").trim().slice(0, 160);
    if (context.source !== "study" || !wordId || !wordText) return null;
    const senses = Array.isArray(context.senses)
      ? context.senses.slice(0, 80).map((sense, index) => ({
        id: String(sense?.id ?? "").trim().slice(0, 80),
        index: Number.isInteger(sense?.index) && sense.index > 0
          ? sense.index
          : index + 1,
        pos: String(sense?.pos ?? "").trim().slice(0, 40),
        meaning: String(sense?.meaning ?? "").trim().slice(0, 300),
      })).filter((sense) => sense.id && sense.meaning)
      : [];
    return {
      source: "study",
      bookId: String(context.bookId ?? "").trim().slice(0, 80),
      bookName: String(context.bookName ?? "").trim().slice(0, 160),
      wordId,
      wordText,
      senses,
      cardType: String(context.cardType ?? "").trim().slice(0, 40),
      capturedAt: typeof context.capturedAt === "string"
        ? context.capturedAt.slice(0, 40)
        : new Date().toISOString(),
    };
  }

  function feedbackContextForSubmission() {
    if (!activeFeedbackContext) return null;
    return {
      source: activeFeedbackContext.source,
      bookId: activeFeedbackContext.bookId,
      bookName: activeFeedbackContext.bookName,
      wordId: activeFeedbackContext.wordId,
      wordText: activeFeedbackContext.wordText,
      cardType: activeFeedbackContext.cardType,
      capturedAt: activeFeedbackContext.capturedAt,
    };
  }

  function renderFeedbackIssueFields() {
    const issue = feedbackIssueSelect.value;
    const missingSense = activeFeedbackContext && issue === MISSING_SENSE_ISSUE;
    const otherIssue = activeFeedbackContext && issue === OTHER_FEEDBACK_ISSUE;
    const senseSpecific = Boolean(
      activeFeedbackContext && issue && !missingSense && !otherIssue,
    );
    feedbackMissingSenseField.hidden = !missingSense;
    feedbackSenseField.hidden = !senseSpecific;
    feedbackMessageLabel.textContent = otherIssue
      ? "问题描述"
      : activeFeedbackContext
        ? "补充说明（可选）"
        : "问题描述";
    feedbackMessage.placeholder = otherIssue
      ? "请描述遇到的其他问题"
      : activeFeedbackContext
        ? "如有需要，可补充更具体的情况"
        : "";
    feedbackMessage.maxLength = activeFeedbackContext ? 3000 : 4000;
    updateFeedbackSubmitState();
  }

  function renderFeedbackContext() {
    feedbackContext.hidden = !activeFeedbackContext;
    feedbackContextWord.textContent = activeFeedbackContext?.wordText ?? "";
    feedbackIntro.textContent = activeFeedbackContext
      ? "请选择问题类型，并可补充说明或附上最多 4 张截图。"
      : "请描述遇到的问题，并可附上最多 4 张截图。";
    feedbackStructuredFields.hidden = !activeFeedbackContext;
    feedbackSenseSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "请选择义项";
    feedbackSenseSelect.append(placeholder);
    (activeFeedbackContext?.senses ?? []).forEach((sense) => {
      const option = document.createElement("option");
      option.value = sense.id;
      option.textContent = [`义项 ${sense.index}`, sense.pos, sense.meaning]
        .filter(Boolean)
        .join(" · ");
      feedbackSenseSelect.append(option);
    });
    renderFeedbackIssueFields();
  }

  function buildFeedbackMessage() {
    const detail = feedbackMessage.value.trim();
    if (!activeFeedbackContext) return detail;

    const issueOption = feedbackIssueSelect.selectedOptions[0];
    const lines = [`问题类型：${issueOption?.textContent?.trim() ?? ""}`];
    if (feedbackIssueSelect.value === MISSING_SENSE_ISSUE) {
      lines.push(`缺少义项：${feedbackMissingSense.value.trim()}`);
      if (detail) lines.push(`补充说明：${detail}`);
      return lines.join("\n");
    }
    if (feedbackIssueSelect.value === OTHER_FEEDBACK_ISSUE) {
      lines.push(`问题描述：${detail}`);
      return lines.join("\n");
    }

    const sense = activeFeedbackContext.senses.find((entry) => {
      return entry.id === feedbackSenseSelect.value;
    });
    const senseLabel = sense
      ? [`义项 ${sense.index}`, sense.pos, sense.meaning].filter(Boolean).join(" · ")
      : feedbackSenseSelect.selectedOptions[0]?.textContent?.trim() ?? "";
    lines.push(`相关义项：${senseLabel}`);
    if (detail) lines.push(`补充说明：${detail}`);
    return lines.join("\n");
  }

  function clearFeedbackRequest() {
    pendingFeedbackRequest = false;
    activeFeedbackContext = null;
    renderFeedbackContext();
  }

  async function decodeFeedbackImage(file) {
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

  async function sanitizeFeedbackImage(file, index) {
    const decoded = await decodeFeedbackImage(file);
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
        `feedback-${Date.now()}-${index + 1}.jpg`,
        { type: "image/jpeg", lastModified: Date.now() },
      );
    } finally {
      decoded.close();
    }
  }

  async function addFeedbackFiles(fileList) {
    const selected = Array.from(fileList ?? []);
    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    if (feedbackFiles.length + selected.length > 4) {
      setMessage("每次最多添加 4 张图片。", "error");
      feedbackImageInput.value = "";
      return;
    }
    const invalidType = selected.find((file) => !allowedTypes.has(file.type));
    if (invalidType) {
      setMessage("仅支持 JPG、PNG 或 WebP 图片。", "error");
      feedbackImageInput.value = "";
      return;
    }
    const oversized = selected.find((file) => file.size > 5 * 1024 * 1024);
    if (oversized) {
      setMessage("每张图片不能超过 5 MB。", "error");
      feedbackImageInput.value = "";
      return;
    }

    feedbackImageInput.disabled = true;
    setMessage("正在安全处理图片……");
    try {
      const sanitized = [];
      for (const [index, file] of selected.entries()) {
        const safeFile = await sanitizeFeedbackImage(file, index);
        sanitized.push({
          file: safeFile,
          url: URL.createObjectURL(safeFile),
        });
      }
      feedbackFiles.push(...sanitized);
      setMessage();
      renderFeedbackFiles();
    } catch (error) {
      setMessage(error?.message ?? "图片处理失败。", "error");
    } finally {
      feedbackImageInput.value = "";
      feedbackImageInput.disabled = false;
    }
  }

  function openFeedbackView(context = null) {
    activeFeedbackContext = normalizeFeedbackContext(context);
    pendingFeedbackRequest = true;
    renderFeedbackContext();
    accountDialog.hidden = false;
    if (!currentUser) {
      showPrimaryAccountView();
      setMessage("登录账户后才能提交问题反馈。", "error");
      accountEmail.focus();
      return;
    }
    if (pendingConsentSession) {
      showPrimaryAccountView();
      setMessage("请先确认账户数据处理方式，再提交问题反馈。", "error");
      return;
    }
    if (pendingConflict) {
      showPrimaryAccountView();
      setMessage("请先选择要保留的学习记录，再提交反馈。", "error");
      return;
    }
    pendingFeedbackRequest = false;
    accountAuthView.hidden = true;
    accountUserView.hidden = true;
    accountConflictView.hidden = true;
    accountDeleteConfirm.hidden = true;
    accountFeedbackView.hidden = false;
    accountDataActions.hidden = true;
    resetFeedbackForm();
    setMessage();
    feedbackMessage.focus();
  }

  function resumePendingFeedback() {
    if (
      !pendingFeedbackRequest ||
      !currentUser ||
      pendingConflict ||
      pendingConsentSession
    ) return false;
    openFeedbackView(activeFeedbackContext);
    return true;
  }

  function showPrimaryAccountView() {
    const hasConflict = Boolean(pendingConflict);
    const needsConsent = Boolean(pendingConsentSession);
    accountDialog.classList.toggle("has-conflict", hasConflict);
    accountConflictView.hidden = !hasConflict;
    accountConsentView.hidden = !needsConsent;
    accountAuthView.hidden = hasConflict || needsConsent || Boolean(currentUser);
    accountUserView.hidden = hasConflict || needsConsent || !currentUser;
    accountDeleteConfirm.hidden = true;
    accountFeedbackView.hidden = true;
    accountDataActions.hidden = needsConsent || hasConflict;
    if (!deleting) resetDeleteConfirmation();
    if (hasConflict) renderConflictComparison();
    if (!hasConflict && conflictBusy) setConflictBusy(false);

    accountStateBadge.textContent = needsConsent
      ? "待确认"
      : currentUser
        ? "已登录"
        : "游客";
    accountStateBadge.classList.toggle("is-online", Boolean(currentUser));
    accountEmailLabel.textContent = currentUser?.email ?? "";
    if (!currentUser) {
      applyAccountProfile(null);
    } else if (!accountProfile) {
      accountMembershipExpiry.textContent = "读取中";
      accountInviteCode.textContent = "读取中";
    }
    accountSubmitButton.disabled = !cloud || authBusy;
    accountLoginTab.disabled = !cloud || authBusy;
    accountRegisterTab.disabled = !cloud || authBusy;
    if (!cloud && !currentUser) {
      setMessage("云端账户尚未配置，游客学习和数据导入导出仍可正常使用。", "error");
    }
    updateHomeStatus(
      hasConflict || loadSyncMeta(currentUser?.id ?? "").dirty ? "pending" : "",
    );
  }

  function openAccountDialog() {
    showPrimaryAccountView();
    accountDialog.hidden = false;
    if (!currentUser && !pendingConsentSession && cloud) accountEmail.focus();
  }

  function closeAccountDialog() {
    accountDialog.hidden = true;
    clearFeedbackFiles();
    clearFeedbackRequest();
    showPrimaryAccountView();
    setMessage();
  }

  function activateAccountState(user, nextState, revision, dirty = false) {
    currentUser = user;
    pendingConsentSession = null;
    const numericRevision = Number(revision);
    cloudRevision = revision === null || revision === undefined
      ? null
      : Number.isFinite(numericRevision)
        ? numericRevision
        : null;
    pendingConflict = null;
    const persisted = app.activateAccount(user.id, nextState);
    saveSyncMeta(user.id, {
      revision: cloudRevision,
      dirty,
      lastSyncedAt: dirty ? null : new Date().toISOString(),
    });
    setSyncStatus(dirty ? "本机记录等待上传" : "云端记录已同步", dirty ? "pending" : "");
    showPrimaryAccountView();
    announceAccountScope(user);
    return persisted;
  }

  function normalizedRemote(result) {
    return {
      found: Boolean(result?.found),
      revision: Number(result?.revision) || 0,
      state: result?.state && typeof result.state === "object"
        ? result.state
        : null,
      updatedAt: result?.updatedAt ?? null,
    };
  }

  async function ensureLegalConsent(session) {
    const user = session?.user;
    if (!user?.id) return false;
    currentUser = user;
    if (typeof cloud.loadLegalConsents !== "function") {
      pendingConsentSession = null;
      return true;
    }

    try {
      const consent = await cloud.loadLegalConsents();
      if (consent?.complete) {
        pendingConsentSession = null;
        return true;
      }
      pendingConsentSession = session;
      pendingConflict = null;
      app.activateGuest();
      announceAccountScope();
      accountDialog.hidden = false;
      showPrimaryAccountView();
      setMessage("确认数据处理方式后才会读取原有云端学习记录。");
      return false;
    } catch (error) {
      pendingConsentSession = session;
      pendingConflict = null;
      app.activateGuest();
      announceAccountScope();
      accountDialog.hidden = false;
      showPrimaryAccountView();
      setMessage(
        error?.message ?? "暂时无法核验隐私同意，云端记录尚未读取。",
        "error",
      );
      return false;
    }
  }

  async function establishAccountSession(session) {
    const user = session?.user;
    if (!user?.id) return;
    if (!await ensureLegalConsent(session)) return;

    currentUser = user;
    setMessage("正在读取云端记录……");
    showPrimaryAccountView();

    try {
      const [remoteResult] = await Promise.all([
        cloud.loadState(),
        refreshAccountProfile({ silent: true }),
        refreshNotifications({ silent: true }),
      ]);
      const remote = normalizedRemote(remoteResult);
      const accountCache = app.getAccountState(user.id);
      const syncMeta = loadSyncMeta(user.id);
      const guestState = app.getGuestState();
      const accountHasUnsyncedData = Boolean(syncMeta.dirty) &&
        app.hasLearningData(accountCache);
      const guestNeedsDecision = hasUnconsideredGuestState(user.id, guestState);

      if (remote.found) {
        const accountState = accountHasUnsyncedData
          ? app.mergeStates(accountCache, remote.state)
          : remote.state;
        const accountNeedsUpload = app.stateSignature(accountState) !==
          app.stateSignature(remote.state);
        if (guestNeedsDecision) {
          cloudRevision = remote.revision;
          pendingConflict = {
            remote: {
              ...remote,
              state: accountState,
            },
            remoteNeedsUpload: accountNeedsUpload,
            localState: guestState,
            localSource: "guest",
          };
          setMessage();
          showPrimaryAccountView();
          return;
        }

        rememberGuestDecision(user.id);
        activateAccountState(
          user,
          accountState,
          remote.revision,
          accountNeedsUpload,
        );
        if (accountNeedsUpload) await syncNow();
        return;
      }

      const localState = accountHasUnsyncedData
        ? accountCache
        : app.hasLearningData(guestState)
          ? guestState
          : accountCache;
      activateAccountState(user, localState, 0, true);
      rememberGuestDecision(user.id);
      await syncNow();
    } catch (error) {
      const accountCache = app.getAccountState(user.id);
      const guestState = app.getGuestState();
      const fallbackState = app.hasLearningData(accountCache)
        ? accountCache
        : guestState;
      activateAccountState(
        user,
        fallbackState,
        loadSyncMeta(user.id).revision,
        true,
      );
      setSyncStatus("云端暂不可用，本机记录会继续保存", "error");
      setMessage(error?.message ?? "读取云端记录失败。", "error");
    }
  }

  function scheduleSync() {
    if (!currentUser || pendingConflict || pendingConsentSession) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncNow();
    }, 800);
  }

  function queueRemoteConflict(remote, localState, source = "account-replace") {
    pendingConflict = {
      remote,
      localState,
      localSource: source,
    };
    setSyncStatus("云端记录刚刚发生变化，请重新选择", "pending");
    showPrimaryAccountView();
  }

  async function syncNow(options = {}) {
    if (!cloud || !currentUser || pendingConflict || pendingConsentSession) {
      return null;
    }
    if (typeof app.isPersistenceSafe === "function" && !app.isPersistenceSafe()) {
      setSyncStatus("完整词库尚未载入，云端同步已暂停", "pending");
      return {
        ok: false,
        skipped: true,
        reason: "vocabulary_not_authoritative",
      };
    }
    if (syncPromise) return syncPromise;

    clearTimeout(syncTimer);
    const syncUserId = currentUser.id;
    const syncMeta = loadSyncMeta(syncUserId);
    let expectedRevision = cloudRevision;
    const replaceRemote = Boolean(options.replace);
    if (!replaceRemote && !syncMeta.dirty) {
      if (
        options.verifyPersistence &&
        typeof app.isActiveStatePersisted === "function" &&
        !app.isActiveStatePersisted()
      ) {
        const persisted = app.replaceActiveState(app.getState(), {
          notify: false,
          stampSync: false,
          preserveNavigation: true,
        });
        if (persisted === false || !app.isActiveStatePersisted()) {
          setSyncStatus("本机记录写入失败，请保留当前页面并重试。", "error");
          return { ok: false, localPersistenceFailed: true };
        }
      }
      setSyncStatus("云端记录已同步");
      return {
        ok: true,
        skipped: true,
        revision: cloudRevision,
      };
    }
    setSyncStatus("正在同步……", "pending");

    syncPromise = (async () => {
      try {
        const initialSnapshot = app.getState();
        if (!app.hasLearningData(initialSnapshot)) {
          const remote = normalizedRemote(await cloud.loadState());
          if (remote.found && app.hasLearningData(remote.state)) {
            cloudRevision = remote.revision;
            if (replaceRemote) {
              queueRemoteConflict(remote, initialSnapshot, "empty-local-blocked");
              setMessage(
                "已阻止空白本机记录覆盖云端学习数据。请选择使用云端记录。",
                "error",
              );
              return {
                ok: false,
                conflict: true,
                blockedEmptyReplacement: true,
                revision: remote.revision,
              };
            }

            app.replaceActiveState(remote.state, {
              notify: false,
              stampSync: false,
              preserveNavigation: true,
            });
            saveSyncMeta(syncUserId, {
              revision: remote.revision,
              dirty: false,
              lastSyncedAt: new Date().toISOString(),
            });
            setSyncStatus("已从云端恢复学习记录");
            return {
              ok: true,
              restoredRemote: true,
              revision: remote.revision,
            };
          }
        }

        for (let attempt = 0; attempt < MAX_SYNC_RETRIES; attempt += 1) {
          if (currentUser?.id !== syncUserId) return null;
          let snapshot = app.getState();

          if (expectedRevision === null) {
            const remote = normalizedRemote(await cloud.loadState());
            if (remote.found) {
              cloudRevision = remote.revision;
              expectedRevision = remote.revision;
              if (replaceRemote) {
                queueRemoteConflict(remote, snapshot);
                return {
                  ok: false,
                  conflict: true,
                  revision: remote.revision,
                };
              }
              const merged = app.mergeStates(snapshot, remote.state);
              app.replaceActiveState(merged, {
                notify: false,
                stampSync: false,
                preserveNavigation: true,
              });
              snapshot = app.getState();
              setSyncStatus("正在合并另一台设备的记录……", "pending");
            } else {
              expectedRevision = 0;
              cloudRevision = 0;
            }
          }

          const snapshotSignature = app.stateSignature(snapshot);
          const result = await cloud.saveState(
            snapshot,
            expectedRevision,
            replaceRemote,
          );
          if (result?.conflict) {
            const remote = normalizedRemote(await cloud.loadState());
            if (replaceRemote) {
              queueRemoteConflict(remote, app.getState());
              return result;
            }
            if (!remote.found) {
              expectedRevision = 0;
              cloudRevision = 0;
              continue;
            }
            const merged = app.mergeStates(app.getState(), remote.state);
            app.replaceActiveState(merged, {
              notify: false,
              stampSync: false,
              preserveNavigation: true,
            });
            cloudRevision = remote.revision;
            expectedRevision = remote.revision;
            saveSyncMeta(syncUserId, {
              revision: cloudRevision,
              dirty: true,
            });
            setSyncStatus("已合并另一台设备的更新，正在重试……", "pending");
            continue;
          }

          if (result?.destructiveBlocked) {
            const remote = normalizedRemote(await cloud.loadState());
            if (!remote.found) {
              throw new Error("云端拒绝了异常缩减，但未能重新读取原记录。");
            }
            const merged = app.mergeStates(app.getState(), remote.state);
            const needsUpload = app.stateSignature(merged) !==
              app.stateSignature(remote.state);
            app.replaceActiveState(merged, {
              notify: false,
              stampSync: false,
              preserveNavigation: true,
            });
            cloudRevision = remote.revision;
            expectedRevision = remote.revision;
            saveSyncMeta(syncUserId, {
              revision: remote.revision,
              dirty: needsUpload,
              lastSyncedAt: needsUpload
                ? loadSyncMeta(syncUserId).lastSyncedAt
                : new Date().toISOString(),
            });
            setSyncStatus(
              needsUpload
                ? "已拦截异常缩减并恢复云端记录，新增内容等待上传"
                : "已拦截异常缩减并恢复云端记录",
              needsUpload ? "pending" : "",
            );
            setMessage("检测到本机记录异常缩减，已自动恢复云端学习数据。");
            if (needsUpload) scheduleSync();
            return {
              ...result,
              restoredRemote: true,
              revision: remote.revision,
            };
          }

          cloudRevision = Number(result?.revision) || cloudRevision || 1;
          if (options.verifyPersistence) {
            const verifiedRemote = normalizedRemote(await cloud.loadState());
            if (!verifiedRemote.found || verifiedRemote.revision < cloudRevision) {
              throw new Error("云端回读未确认刚刚保存的学习记录。");
            }
            const converged = app.mergeStates(app.getState(), verifiedRemote.state);
            const needsAnotherUpload = app.stateSignature(converged) !==
              app.stateSignature(verifiedRemote.state);
            const persisted = app.replaceActiveState(converged, {
              notify: false,
              stampSync: false,
              preserveNavigation: true,
            });
            if (
              persisted === false ||
              (typeof app.isActiveStatePersisted === "function" &&
                !app.isActiveStatePersisted())
            ) {
              throw new Error("合并结果未能写入本机存储。");
            }
            cloudRevision = verifiedRemote.revision;
            if (needsAnotherUpload) {
              expectedRevision = verifiedRemote.revision;
              saveSyncMeta(syncUserId, {
                revision: cloudRevision,
                dirty: true,
              });
              continue;
            }
          }
          const stillUsingAccount = currentUser?.id === syncUserId &&
            app.getActiveStorageKey() === app.accountStorageKey(syncUserId);
          const changedDuringSync = stillUsingAccount &&
            app.stateSignature(app.getState()) !== snapshotSignature;
          saveSyncMeta(syncUserId, {
            revision: cloudRevision,
            dirty: changedDuringSync,
            lastSyncedAt: new Date().toISOString(),
          });
          setSyncStatus(
            changedDuringSync ? "本机有新的记录等待同步" : "云端记录已同步",
            changedDuringSync ? "pending" : "",
          );
          if (localQuotaWarning && !changedDuringSync) {
            localQuotaWarning = false;
            setMessage();
          }
          if (changedDuringSync) scheduleSync();
          return result;
        }
        throw new Error("多台设备更新过于频繁，请稍后再次同步。");
      } catch (error) {
        saveSyncMeta(syncUserId, { dirty: true });
        setSyncStatus(
          localQuotaWarning
            ? "同步失败，请勿关闭当前页面并再次重试"
            : "同步失败，本机记录已保留",
          "error",
        );
        setMessage(error?.message ?? "同步失败，请稍后重试。", "error");
        return null;
      } finally {
        syncPromise = null;
      }
    })();

    return syncPromise;
  }

  async function refreshFromCloud(options = {}) {
    if (!cloud || !currentUser || pendingConflict || pendingConsentSession) {
      return null;
    }
    if (refreshPromise) return refreshPromise;
    const refreshUserId = currentUser.id;

    refreshPromise = (async () => {
      try {
        if (syncPromise) await syncPromise;
        if (
          currentUser?.id !== refreshUserId ||
          pendingConflict ||
          pendingConsentSession
        ) return null;
        const remote = normalizedRemote(await cloud.loadState());
        if (!remote.found || remote.revision <= (cloudRevision ?? -1)) {
          return remote;
        }

        const localState = app.getState();
        const merged = app.mergeStates(localState, remote.state);
        const needsUpload = app.stateSignature(merged) !==
          app.stateSignature(remote.state);
        const persisted = app.replaceActiveState(merged, {
          notify: false,
          stampSync: false,
          preserveNavigation: true,
        });
        if (
          persisted === false ||
          (typeof app.isActiveStatePersisted === "function" &&
            !app.isActiveStatePersisted())
        ) {
          throw new Error("合并结果未能写入本机存储。");
        }
        cloudRevision = remote.revision;
        saveSyncMeta(refreshUserId, {
          revision: remote.revision,
          dirty: needsUpload,
          lastSyncedAt: needsUpload
            ? loadSyncMeta(refreshUserId).lastSyncedAt
            : new Date().toISOString(),
        });
        setSyncStatus(
          needsUpload ? "已合并其他设备的记录，等待上传" : "已获取其他设备的更新",
          needsUpload ? "pending" : "",
        );
        if (needsUpload) scheduleSync();
        return remote;
      } catch (error) {
        if (!options.silent) {
          setSyncStatus("读取其他设备更新失败，本机记录已保留", "error");
          setMessage(error?.message ?? "读取云端记录失败。", "error");
        }
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  function startRefreshTimer() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (currentUser && !pendingConsentSession) {
        refreshFromCloud({ silent: true });
        refreshAccountProfile({ silent: true });
      }
      refreshNotifications({ silent: true });
    }, REFRESH_INTERVAL_MS);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!cloud || authBusy) return;

    const email = accountEmail.value.trim();
    const password = accountPassword.value;
    const normalizedInvitationCode = invitationCode.value.trim().toUpperCase();
    const registering = mode === "register";
    const recovering = mode === "recover";
    const verifying = authStep === "otp";
    const otp = accountOtp.value.replace(/\s+/g, "");
    const passwordRequired = mode === "login" ||
      (registering && !verifying) ||
      (recovering && verifying);

    if (!email) {
      setMessage("请输入有效邮箱。", "error");
      return;
    }
    if (passwordRequired && password.length < 6) {
      setMessage(recovering
        ? "请输入至少 6 位的新密码。"
        : "请输入至少 6 位密码。", "error");
      return;
    }
    if (verifying && !/^\d{6,8}$/.test(otp)) {
      setMessage("请输入邮件中的 6 位验证码。", "error");
      return;
    }
    if (
      registering &&
      !verifying &&
      (
        !registerTermsConsent.checked ||
        !registerCrossBorderConsent.checked ||
        !registerAgeConsent.checked
      )
    ) {
      setMessage("注册前需要分别确认条款、跨境处理和已满 14 周岁。", "error");
      return;
    }

    authBusy = true;
    accountSubmitButton.disabled = true;
    resendOtpButton.disabled = true;
    showPrimaryAccountView();
    setMessage(
      verifying
        ? "正在验证邮箱验证码……"
        : registering || recovering
          ? "正在发送邮箱验证码……"
          : "正在登录……",
    );

    try {
      if (verifying && registering) {
        const result = await cloud.verifySignupOtp(email, otp);
        if (!result?.session) throw new Error("验证码验证失败，请重新获取后再试。");
        if (typeof cloud.recordLegalConsents === "function") {
          await cloud.recordLegalConsents();
        }
        const registrationReceipt = result?.user?.id &&
            typeof cloud.loadRegistrationWelcome === "function"
          ? await cloud.loadRegistrationWelcome(result.user.id)
          : null;
        await establishAccountSession(result.session);
        invitationCode.value = "";
        registerTermsConsent.checked = false;
        registerCrossBorderConsent.checked = false;
        registerAgeConsent.checked = false;
        setMode("login");
        setMessage();
        showRegistrationWelcome(registrationReceipt);
      } else if (verifying && recovering) {
        const result = await cloud.verifyRecoveryOtp(email, otp);
        if (!result?.session) throw new Error("验证码验证失败，请重新获取后再试。");
        await cloud.updatePassword(password);
        await establishAccountSession(result.session);
        setMode("login");
        setMessage("密码已重设，账户已登录。");
      } else if (registering) {
        if (
          normalizedInvitationCode &&
          typeof cloud.validateInvitationCode === "function" &&
          !await cloud.validateInvitationCode(normalizedInvitationCode)
        ) {
          throw new Error("邀请码无效或已经被使用。");
        }
        const result = await cloud.signUp(email, password, normalizedInvitationCode);
        if (result?.session) {
          if (typeof cloud.recordLegalConsents === "function") {
            await cloud.recordLegalConsents();
          }
          const registrationReceipt = result?.user?.id &&
              typeof cloud.loadRegistrationWelcome === "function"
            ? await cloud.loadRegistrationWelcome(result.user.id)
            : null;
          await establishAccountSession(result.session);
          setMode("login");
          setMessage();
          showRegistrationWelcome(registrationReceipt);
        } else {
          beginOtpStep("register", email);
          setMessage("验证码已发送，请在 10 分钟内完成验证。");
        }
      } else if (recovering) {
        await cloud.sendPasswordRecoveryOtp(email);
        beginOtpStep("recover", email);
        setMessage("验证码已发送，请在 10 分钟内完成验证。");
      } else {
        const result = await cloud.signIn(email, password);
        accountPassword.value = "";
        if (result?.session) {
          await establishAccountSession(result.session);
          setMessage();
        }
      }
    } catch (error) {
      setMessage(error?.message ?? "账户操作失败。", "error");
    } finally {
      authBusy = false;
      accountSubmitButton.disabled = !cloud;
      resendOtpButton.disabled = false;
      showPrimaryAccountView();
      resumePendingFeedback();
    }
  }

  async function resendOtp() {
    if (!cloud || authBusy || authStep !== "otp" || !pendingAuth?.email) return;
    authBusy = true;
    accountSubmitButton.disabled = true;
    resendOtpButton.disabled = true;
    setMessage("正在重新发送验证码……");
    try {
      if (mode === "register") {
        await cloud.resendSignupOtp(pendingAuth.email);
      } else {
        await cloud.sendPasswordRecoveryOtp(pendingAuth.email);
      }
      pendingAuth.requestedAt = Date.now();
      setMessage("新的验证码已发送，请在 10 分钟内完成验证。");
    } catch (error) {
      setMessage(error?.message ?? "验证码发送失败，请稍后重试。", "error");
    } finally {
      authBusy = false;
      accountSubmitButton.disabled = false;
      resendOtpButton.disabled = false;
    }
  }

  async function acceptLegalConsents() {
    if (!cloud || !pendingConsentSession || consentBusy) return;
    if (
      !existingTermsConsent.checked ||
      !existingCrossBorderConsent.checked ||
      !existingAgeConsent.checked
    ) {
      setMessage("请逐项确认后继续。", "error");
      return;
    }

    consentBusy = true;
    updateLegalConsentButton();
    setMessage("正在保存你的选择……");
    const session = pendingConsentSession;
    try {
      if (typeof cloud.recordLegalConsents !== "function") {
        throw new Error("当前账户服务不支持保存隐私同意，请刷新后重试。");
      }
      await cloud.recordLegalConsents();
      pendingConsentSession = null;
      existingTermsConsent.checked = false;
      existingCrossBorderConsent.checked = false;
      existingAgeConsent.checked = false;
      await establishAccountSession(session);
      setMessage();
      resumePendingFeedback();
    } catch (error) {
      pendingConsentSession = session;
      setMessage(error?.message ?? "保存失败，云端记录尚未读取。", "error");
    } finally {
      consentBusy = false;
      updateLegalConsentButton();
      showPrimaryAccountView();
    }
  }

  async function declineLegalConsents() {
    if (!cloud || consentBusy) return;
    consentBusy = true;
    acceptLegalConsentButton.disabled = true;
    try {
      await cloud.signOut();
    } catch {
      // Local guest mode is still safe even when the remote sign-out request fails.
    }
    pendingConsentSession = null;
    currentUser = null;
    applyAccountProfile(null);
    cloudRevision = null;
    pendingConflict = null;
    app.activateGuest();
    announceAccountScope();
    await refreshNotifications({ silent: true });
    showPrimaryAccountView();
    setMessage("已退出账户，云端记录未被读取或更改。");
    consentBusy = false;
    updateLegalConsentButton();
  }

  function withoutDeletionTombstones(candidate) {
    const cleaned = JSON.parse(JSON.stringify(candidate ?? {}));
    const cleanScope = (scope) => {
      const records = scope?._sync?.records;
      if (!records || typeof records !== "object") return;
      Object.entries(records).forEach(([domain, recordOrMap]) => {
        if (!recordOrMap || typeof recordOrMap !== "object") return;
        if (Object.prototype.hasOwnProperty.call(recordOrMap, "deleted")) {
          if (recordOrMap.deleted) delete records[domain];
          return;
        }
        Object.entries(recordOrMap).forEach(([key, record]) => {
          if (record?.deleted) delete recordOrMap[key];
        });
      });
    };
    cleanScope(cleaned);
    Object.values(cleaned.bookStates ?? {}).forEach(cleanScope);
    return cleaned;
  }

  async function mergeConflictStates() {
    if (!pendingConflict || !currentUser || conflictBusy) return;
    const { localState, localSource, remote } = pendingConflict;
    setConflictBusy(true);
    setMessage("正在合并两边的学习记录……");
    try {
      const safeLocalState = localSource === "guest"
        ? withoutDeletionTombstones(localState)
        : localState;
      const merged = app.mergeStates(safeLocalState, remote.state);
      if (localSource === "guest") rememberGuestDecision(currentUser.id);
      const persisted = activateAccountState(
        currentUser,
        merged,
        remote.revision,
        true,
      );
      if (persisted === false) {
        pendingConflict = { localState, localSource, remote };
        throw new Error("合并结果未能写入本机存储，云端记录尚未更改。");
      }
      const result = await syncNow({ verifyPersistence: true });
      if (!result?.ok) {
        throw new Error("合并结果尚未同时写入本机和云端，请重试。");
      }
      setMessage("两边记录已合并，云端与本机新增进度均已保留。");
      resumePendingFeedback();
    } catch (error) {
      setMessage(error?.message ?? "合并失败，两边原记录均未删除。", "error");
      showPrimaryAccountView();
    } finally {
      setConflictBusy(false);
    }
  }

  async function useCloudState() {
    if (!pendingConflict || !currentUser || conflictBusy) return;
    const { remote, remoteNeedsUpload, localSource } = pendingConflict;
    setConflictBusy(true);
    try {
      rememberGuestDecision(currentUser.id);
      activateAccountState(
        currentUser,
        remote.state,
        remote.revision,
        Boolean(remoteNeedsUpload),
      );
      if (remoteNeedsUpload) await syncNow();
      setMessage(localSource === "guest"
        ? "已只使用云端学习记录。本机游客记录仍保留在当前浏览器。"
        : "已只使用云端学习记录。");
      resumePendingFeedback();
    } catch (error) {
      setMessage(error?.message ?? "读取云端记录失败，请稍后重试。", "error");
      showPrimaryAccountView();
    } finally {
      setConflictBusy(false);
    }
  }

  async function useLocalState() {
    if (!pendingConflict || !currentUser || conflictBusy) return;
    const { localState, localSource, remote } = pendingConflict;
    if (
      app.hasLearningData(remote?.state) &&
      !app.hasLearningData(localState)
    ) {
      setMessage(
        "空白本机记录不能覆盖已有的云端学习数据，请使用云端记录。",
        "error",
      );
      return;
    }
    setConflictBusy(true);
    try {
      if (localSource === "guest") rememberGuestDecision(currentUser.id);
      activateAccountState(currentUser, localState, remote.revision, true);
      setMessage("正在将本机学习记录上传到云端……");
      await syncNow({ replace: true });
      resumePendingFeedback();
    } catch (error) {
      setMessage(error?.message ?? "上传本机记录失败，请稍后重试。", "error");
      showPrimaryAccountView();
    } finally {
      setConflictBusy(false);
    }
  }

  async function logout() {
    if (!cloud || !currentUser) return;
    logoutButton.disabled = true;
    await syncNow();
    try {
      await cloud.signOut();
    } catch (error) {
      setMessage(error?.message ?? "退出失败。", "error");
    }
    currentUser = null;
    applyAccountProfile(null);
    cloudRevision = null;
    pendingConflict = null;
    pendingConsentSession = null;
    app.activateGuest();
    announceAccountScope();
    await refreshNotifications({ silent: true });
    logoutButton.disabled = false;
    setMessage("已退出账户，当前恢复为游客记录。");
    showPrimaryAccountView();
  }

  async function deleteAccount() {
    if (!cloud || !currentUser || deleting) return;
    if (deleteAccountConfirmation.value.trim() !== "删除账户") {
      setMessage("请输入“删除账户”后再确认。", "error");
      deleteAccountConfirmation.focus();
      return;
    }
    deleting = true;
    confirmDeleteAccountButton.disabled = true;
    setMessage("正在删除账户……");
    const userId = currentUser.id;
    try {
      await cloud.deleteAccount();
      app.removeAccountCache(userId);
      localStorage.removeItem(syncMetaKey(userId));
      localStorage.removeItem(migrationKey(userId));
      try {
        await cloud.signOut();
      } catch {
        // The server-side deletion may invalidate the session before sign-out.
      }
      currentUser = null;
      applyAccountProfile(null);
      cloudRevision = null;
      pendingConflict = null;
      pendingConsentSession = null;
      app.activateGuest();
      announceAccountScope();
      await refreshNotifications({ silent: true });
      setMessage("账户及云端学习记录已删除。");
      showPrimaryAccountView();
    } catch (error) {
      setMessage(error?.message ?? "账户删除失败。", "error");
      showPrimaryAccountView();
    } finally {
      deleting = false;
      resetDeleteConfirmation();
    }
  }

  async function submitFeedback() {
    if (!cloud || !currentUser || pendingConsentSession || feedbackBusy) return;
    const validation = feedbackFormValidation();
    if (validation) {
      setMessage(validation.message, "error");
      validation.field.focus();
      return;
    }
    const message = buildFeedbackMessage();

    feedbackBusy = true;
    updateFeedbackSubmitState();
    setMessage("正在提交反馈……");
    try {
      await cloud.submitFeedback(
        message,
        feedbackFiles.map((entry) => entry.file),
        feedbackContextForSubmission(),
        {
          rightsConfirmed: feedbackFiles.length === 0 ||
            feedbackAttachmentRightsConsent.checked,
          aiDisclosure: feedbackFiles.length
            ? feedbackAttachmentAiDisclosure.value
            : "not_applicable",
        },
      );
      resetFeedbackForm();
      clearFeedbackRequest();
      closeAccountDialog();
      setMessage("反馈已提交。");
    } catch (error) {
      setMessage(error?.message ?? "反馈提交失败，请稍后重试。", "error");
    } finally {
      feedbackBusy = false;
      updateFeedbackSubmitState();
    }
  }

  function exportData() {
    const payload = {
      format: "sense-vocab-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: currentUser?.email ?? null,
      state: app.getState(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `sense-vocab-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("学习数据已导出。");
  }

  async function importData(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const importedState = parsed?.format === "sense-vocab-backup"
        ? parsed.state
        : parsed;
      if (!importedState || typeof importedState !== "object") {
        throw new Error("文件中没有有效的学习数据。");
      }
      app.replaceActiveState(importedState);
      setMessage(currentUser
        ? "数据已导入，正在同步到云端。"
        : "数据已导入当前游客记录。");
      if (currentUser) await syncNow({ replace: true });
    } catch (error) {
      setMessage(error?.message ?? "导入失败。", "error");
    } finally {
      importDataInput.value = "";
    }
  }

  async function initializeAccount() {
    setMode("login");
    showPrimaryAccountView();
    if (!cloud) {
      applyAccountProfile(null);
      renderNotifications({ authenticated: false, unreadCount: 0, items: [] });
      announceAccountScope();
      announceAccountReady();
      return;
    }

    cloud.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && currentUser) {
        currentUser = null;
        applyAccountProfile(null);
        cloudRevision = null;
        pendingConflict = null;
        pendingConsentSession = null;
        app.activateGuest();
        announceAccountScope();
        showPrimaryAccountView();
        refreshNotifications({ silent: true });
      }
      if (event === "TOKEN_REFRESHED" && session?.user) {
        currentUser = session.user;
        showPrimaryAccountView();
        refreshAccountProfile({ silent: true });
        refreshNotifications({ silent: true });
      }
    });

    try {
      const session = await cloud.getSession();
      if (session) await establishAccountSession(session);
    } catch (error) {
      setMessage(error?.message ?? "账户服务暂不可用。", "error");
    }
    startRefreshTimer();
    if (currentUser && !pendingConflict && !pendingConsentSession) {
      announceAccountScope(currentUser);
    }
    if (!currentUser) announceAccountScope();
    announceAccountReady();
    refreshNotifications({ silent: true });
  }

  accountButton.addEventListener("click", openAccountDialog);
  closeAccountButton.addEventListener("click", closeAccountDialog);
  accountDialog.addEventListener("click", (event) => {
    if (event.target === accountDialog) closeAccountDialog();
  });
  accountLoginTab.addEventListener("click", () => setMode("login"));
  accountRegisterTab.addEventListener("click", () => setMode("register"));
  forgotPasswordButton.addEventListener("click", () => setMode("recover"));
  backToLoginButton.addEventListener("click", () => setMode("login"));
  resendOtpButton.addEventListener("click", resendOtp);
  accountForm.addEventListener("submit", handleAuthSubmit);
  [
    existingTermsConsent,
    existingCrossBorderConsent,
    existingAgeConsent,
  ].forEach((input) => {
    input.addEventListener("change", updateLegalConsentButton);
  });
  acceptLegalConsentButton.addEventListener("click", acceptLegalConsents);
  declineLegalConsentButton.addEventListener("click", declineLegalConsents);
  syncNowButton.addEventListener("click", async () => {
    await refreshFromCloud();
    await syncNow({ verifyPersistence: true });
  });
  logoutButton.addEventListener("click", logout);
  deleteAccountButton.addEventListener("click", () => {
    accountAuthView.hidden = true;
    accountUserView.hidden = true;
    accountConflictView.hidden = true;
    accountConsentView.hidden = true;
    accountFeedbackView.hidden = true;
    accountDeleteConfirm.hidden = false;
    accountDataActions.hidden = true;
    resetDeleteConfirmation();
    setMessage();
    deleteAccountConfirmation.focus();
  });
  cancelDeleteAccountButton.addEventListener("click", showPrimaryAccountView);
  deleteAccountConfirmation.addEventListener("input", () => {
    confirmDeleteAccountButton.disabled = deleting ||
      deleteAccountConfirmation.value.trim() !== "删除账户";
  });
  confirmDeleteAccountButton.addEventListener("click", deleteAccount);
  mergeStateButton.addEventListener("click", mergeConflictStates);
  useCloudStateButton.addEventListener("click", useCloudState);
  useLocalStateButton.addEventListener("click", useLocalState);
  exportDataButton.addEventListener("click", exportData);
  importDataButton.addEventListener("click", () => importDataInput.click());
  importDataInput.addEventListener("change", () => importData(importDataInput.files[0]));
  notificationsButton.addEventListener("click", openNotificationsDialog);
  closeNotificationsButton.addEventListener("click", closeNotificationsDialog);
  notificationsDialog.addEventListener("click", (event) => {
    if (event.target === notificationsDialog) closeNotificationsDialog();
  });
  closeRegistrationWelcomeButton.addEventListener("click", () => {
    registrationWelcomeDialog.hidden = true;
  });
  registrationWelcomeDialog.addEventListener("click", (event) => {
    if (event.target === registrationWelcomeDialog) {
      registrationWelcomeDialog.hidden = true;
    }
  });
  feedbackIssueSelect.addEventListener("change", () => {
    feedbackSenseSelect.value = "";
    feedbackMissingSense.value = "";
    renderFeedbackIssueFields();
  });
  feedbackSenseSelect.addEventListener("change", updateFeedbackSubmitState);
  feedbackMissingSense.addEventListener("input", updateFeedbackSubmitState);
  feedbackMessage.addEventListener("input", updateFeedbackSubmitState);
  feedbackAttachmentRightsConsent.addEventListener(
    "change",
    updateFeedbackSubmitState,
  );
  feedbackAttachmentAiDisclosure.addEventListener(
    "change",
    updateFeedbackSubmitState,
  );
  feedbackImageInput.addEventListener("change", async () => {
    await addFeedbackFiles(feedbackImageInput.files);
  });
  submitFeedbackButton.addEventListener("click", submitFeedback);
  cancelFeedbackButton.addEventListener("click", () => {
    resetFeedbackForm();
    clearFeedbackRequest();
    showPrimaryAccountView();
    setMessage();
  });

  window.addEventListener("sensevocab:open-feedback", (event) => {
    openFeedbackView(event.detail?.context ?? app.getCurrentWordContext());
  });

  window.addEventListener("sensevocab:state-saved", (event) => {
    if (!currentUser || pendingConsentSession) return;
    if (event.detail?.storageKey !== app.accountStorageKey(currentUser.id)) return;
    saveSyncMeta(currentUser.id, { dirty: true });
    setSyncStatus(
      event.detail?.persisted === false
        ? "本地空间已满，正在将更新保存到云端"
        : "本机有尚未同步的更新",
      "pending",
    );
    scheduleSync();
  });

  window.addEventListener("sensevocab:storage-error", (event) => {
    if (!event.detail?.quotaExceeded) {
      setMessage("浏览器存储写入失败，请立即导出学习数据。", "error");
      return;
    }
    if (currentUser) {
      localQuotaWarning = true;
      setMessage(
        "浏览器本地空间已满，本次更新将优先同步到云端。请保持登录，等待状态显示“云端记录已同步”。",
        "error",
      );
      return;
    }
    setMessage(
      "浏览器本地空间已满，本次更新暂未写入本机。请先导出学习数据，再清理该网站的旧缓存。",
      "error",
    );
  });

  document.addEventListener("visibilitychange", () => {
    if (!currentUser) return;
    if (document.visibilityState === "hidden") {
      syncNow();
    } else {
      refreshFromCloud({ silent: true });
      refreshAccountProfile({ silent: true });
      refreshNotifications({ silent: true });
    }
  });
  window.addEventListener("focus", () => {
    if (currentUser) {
      refreshFromCloud({ silent: true });
      refreshAccountProfile({ silent: true });
    }
    refreshNotifications({ silent: true });
  });
  window.addEventListener("online", async () => {
    if (currentUser) {
      await Promise.all([
        refreshFromCloud({ silent: true }),
        refreshAccountProfile({ silent: true }),
      ]);
      syncNow();
    }
    refreshNotifications({ silent: true });
  });
  window.addEventListener("storage", (event) => {
    if (!currentUser || event.key !== app.accountStorageKey(currentUser.id)) return;
    if (!event.newValue) return;
    try {
      const incoming = JSON.parse(event.newValue);
      const localState = app.getState();
      const merged = app.mergeStates(localState, incoming);
      if (app.stateSignature(merged) === app.stateSignature(localState)) return;
      app.replaceActiveState(merged, {
        notify: false,
        stampSync: false,
        preserveNavigation: true,
      });
      saveSyncMeta(currentUser.id, { dirty: true });
      setSyncStatus("已合并另一个页面的学习记录", "pending");
      scheduleSync();
    } catch {
      // Ignore incomplete writes from another browser context.
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!registrationWelcomeDialog.hidden) {
      registrationWelcomeDialog.hidden = true;
    } else if (!notificationsDialog.hidden) {
      closeNotificationsDialog();
    } else if (!accountDialog.hidden) {
      closeAccountDialog();
    }
  });

  if (document.documentElement.dataset.appReady === "true") {
    initializeAccount();
  } else {
    window.addEventListener("sensevocab:app-ready", initializeAccount, { once: true });
  }
})();
