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
  const usersSection = document.querySelector("#usersSection");
  const feedbackSection = document.querySelector("#feedbackSection");
  const announcementsSection = document.querySelector("#announcementsSection");
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
      const heading = document.createElement("div");
      heading.className = "announcement-item-heading";
      const title = document.createElement("strong");
      title.textContent = announcement.title;
      const time = document.createElement("span");
      time.textContent = formatDate(announcement.publishedAt, true);
      heading.append(title, time);
      const body = document.createElement("p");
      body.textContent = announcement.body;
      item.append(heading, body);
      announcementList.append(item);
    });
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

    publishAnnouncementButton.disabled = true;
    try {
      await cloud.publishAnnouncement(title, body);
      announcementForm.reset();
      await loadAnnouncements();
      setMessage("公告已发布，用户可在“消息通知”中查看。");
    } catch (error) {
      setMessage(error?.message ?? "公告发布失败。", "error");
    } finally {
      publishAnnouncementButton.disabled = false;
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
  extendAllMembershipsButton.addEventListener("click", extendAllMemberships);
  announcementForm.addEventListener("submit", publishAnnouncement);
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
