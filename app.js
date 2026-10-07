const DEFAULT_DAILY_TARGET = 20;
const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const ACCOUNT_STORAGE_PREFIX = `${STORAGE_KEY}:account:`;
const LOCAL_STORAGE_COMPRESSION_PREFIX = "svlz1:";
const DASHBOARD_SNAPSHOT_STORAGE_SEGMENT = ":dashboard-snapshot-v1:";
const LEARNING_JOURNAL_STORAGE_SEGMENT = ":learning-journal-v1:";
const LZ_MIN_MATCH = 4;
const LZ_MAX_MATCH = 65538;
const LZ_MAX_DISTANCE = 65535;
const LZ_MAX_CANDIDATES = 2;
const DATA_VERSION = 10;
const DASHBOARD_DATA_VERSION = 1;
const ROOT_STATE_VERSION = 2;
const DEFAULT_BOOK_ID = "kaoyan";
const VOCABULARY_INDEX_URL = "./data/vocabulary-index.json";
const VOCABULARY_BUNDLE_URL = "./data/vocabulary-bundle.json";
const VOCABULARY_CACHE_PREFIX = "sense-vocab-vocabulary-";
// Let the index-backed shell paint first, then hydrate the full bundle soon
// enough that study and morphology pages do not sit in an artificial loading
// state after the app is already interactive.
const VOCABULARY_PRELOAD_DELAY_MS = 750;
const FAST_CALENDAR_LAST_VERSION = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const TUTORIAL_STORAGE_PREFIX = "sense-vocab-tutorial-complete-v1:";
const TUTORIAL_WAIT_MS = Number.isFinite(window.__SENSE_VOCAB_TUTORIAL_WAIT_MS__)
  ? Math.max(0, window.__SENSE_VOCAB_TUTORIAL_WAIT_MS__)
  : 5000;
const TUTORIAL_HER_PROMPT_DELAY_MS = Number.isFinite(
  window.__SENSE_VOCAB_TUTORIAL_HER_PROMPT_DELAY_MS__,
)
  ? Math.max(0, window.__SENSE_VOCAB_TUTORIAL_HER_PROMPT_DELAY_MS__)
  : 1000;
const TUTORIAL_AUTO_START_DELAY_MS = 350;
const TUTORIAL_AUTO_RETRY_MS = 500;
const TUTORIAL_ACCOUNT_READY_GRACE_MS = Number.isFinite(
  window.__SENSE_VOCAB_TUTORIAL_ACCOUNT_READY_GRACE_MS__,
)
  ? Math.max(0, window.__SENSE_VOCAB_TUTORIAL_ACCOUNT_READY_GRACE_MS__)
  : 3000;
const TUTORIAL_NON_INTERACTIVE_STEPS = new Set([
  "recall-wait",
  "examples-wait",
  "her-wait",
]);
const LOCAL_HISTORY_NEW_COUNT_CORRECTIONS = Object.freeze({
  "2026-07-18": 40,
  "2026-07-19": 0,
  "2026-07-21": 40,
  "2026-07-22": 40,
  "2026-07-23": 40,
  "2026-07-24": 40,
});
const LOCAL_JULY_NEW_HISTORY = Object.freeze({
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
});
const SENSE_STATUS = Object.freeze({
  NEW: "new",
  REINFORCE: "reinforce",
  REVIEW: "review",
  MASTERED: "mastered",
});
const CHINESE_SEARCH_SYNONYM_GROUPS = [
  ["开心", "高兴", "快乐", "愉快", "欢乐", "喜悦", "幸福", "快活"],
  ["悲伤", "难过", "伤心", "悲哀", "忧伤", "悲痛"],
  ["快速", "迅速", "飞快", "敏捷", "急速"],
  ["开始", "着手", "启动", "开端"],
  ["结束", "终止", "完结", "完成", "终结"],
  ["购买", "买", "购置", "采购"],
  ["重要", "主要", "关键", "核心"],
  ["帮助", "协助", "援助", "帮忙"],
  ["改变", "变化", "变更", "修改", "转变"],
  ["保护", "保卫", "维护", "保障"],
  ["安全", "安稳", "可靠"],
  ["危险", "风险", "危机"],
  ["选择", "挑选", "选取"],
  ["决定", "决心", "判决", "裁定"],
  ["允许", "许可", "准许", "批准"],
  ["禁止", "阻止", "制止", "禁令"],
  ["工作", "劳动", "任务", "运作"],
  ["行动", "活动", "动作"],
  ["表演", "演出", "出演"],
  ["问题", "困难", "麻烦", "疑问"],
  ["说明", "解释", "阐明", "表明"],
  ["增加", "提高", "增长", "上升"],
  ["减少", "降低", "减小", "下降"],
  ["真实", "实际", "真正", "事实"],
  ["错误", "有误", "过错", "失误"],
  ["聪明", "明智", "机敏", "精明"],
  ["美丽", "漂亮", "美好", "优美"],
  ["小心", "谨慎", "注意"],
  ["同意", "赞成", "支持"],
  ["反对", "抵制", "拒绝"],
  ["获得", "取得", "得到", "收获"],
  ["发送", "发出", "传递"],
  ["接受", "承认", "接纳"],
  ["需要", "要求", "必要"],
  ["使用", "利用", "应用"],
  ["相似", "类似", "相近"],
].map((group) => group.map((value) => value.normalize("NFKC")));
const CONTENT_ADDED_SENSE_KEYS = new Set([
  "volunteer:n-3",
  "prepare:v-2",
  "pension:n-2",
  "port:n-4",
  "pose:n-4",
  "deposit:v-6",
  "deposit:v-7",
  "positive:adj-3",
  "prime:adj-2",
  "resume:n-3",
  "soil:n-2",
  "sanction:n-2",
  "sanction:n-3",
  "consent:n-2",
  "prescribe:v-2",
  "aside:adv-2",
  "solid:adj-5",
  "solo:adv-3",
  "solution:n-3",
  "insult:v-2",
  "specify:v-2",
  "terminal:n-3",
  "revenge:v-2",
  "suspect:v-2",
  "spectrum:n-2",
  "vacant:adj-2",
  "entertain:v-2",
  "resolution:n-2",
  "shiver:n-2",
  "silver:adj-3",
  "versatile:adj-3",
  "turn:v-3",
  "writing:n-2",
  "class:n-3",
  "difference:n-3",
  "site:n-2",
  "remain:v-4",
  "rise:n-6",
  "rise:v-3",
  "network:v-1",
  "mass:n-3",
  "apply:v-4",
  "growth:n-3",
  "stand:n-4",
  "stand:v-3",
  "return:v-3",
  "exercise:v-2",
  "force:n-2",
  "negative:adj-3",
  "range:v-5",
  "guide:n-2",
  "epidemic:adj-1",
  "measure:v-4",
  "story:n-3",
  "global:adj-2",
  "stop:v-2",
  "statement:n-2",
  "charge:v-6",
  "charge:v-7",
  "appeal:n-7",
  "step:n-2",
  "sight:n-2",
  "image:n-3",
  "mention:n-1",
  "stick:v-2",
  "saving:n-1",
  "upset:adj-1",
  "understanding:adj-1",
  "energy:n-2",
  "drive:v-2",
  "pursue:v-4",
  "wear:v-3",
  "north:adj-1",
  "draw:v-4",
]);

function updateAppViewportHeight() {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;
  document.documentElement.style.setProperty(
    "--app-viewport-height",
    `${Math.round(viewportHeight)}px`,
  );
}

updateAppViewportHeight();

const FALLBACK_WORDS = [
  {
    id: "charge",
    word: "charge",
    senses: [
      { id: "fee", pos: "v.", meaning: "收费，索价", importance: 100 },
      { id: "accuse", pos: "v.", meaning: "指控，控告", importance: 92 },
      { id: "power", pos: "v.", meaning: "充电", importance: 84 },
      { id: "attack", pos: "v.", meaning: "冲锋", importance: 62 },
      { id: "responsible", pos: "v.", meaning: "负责，掌管", importance: 58 },
      { id: "electric", pos: "n.", meaning: "电荷", importance: 46 },
    ],
  },
  {
    id: "issue",
    word: "issue",
    senses: [
      { id: "topic", pos: "n.", meaning: "问题，议题", importance: 100 },
      { id: "publish", pos: "v.", meaning: "发行，发布", importance: 88 },
      { id: "edition", pos: "n.", meaning: "期号，一期", importance: 72 },
      { id: "flow", pos: "v.", meaning: "发出，流出", importance: 45 },
      { id: "offspring", pos: "n.", meaning: "子女，后代", importance: 24 },
    ],
  },
];

const homePanel = document.querySelector("#homePanel");
const studyPanel = document.querySelector("#studyPanel");
const dashboardPanel = document.querySelector("#dashboardPanel");
const settingsPanel = document.querySelector("#settingsPanel");
const dataPanel = document.querySelector("#dataPanel");
const mainAppNav = document.querySelector("#mainAppNav");
const modalLayer = document.querySelector("#modalLayer");
const appShellElement = document.querySelector("#appShell");
const globalHomeNavButton = document.querySelector("#globalHomeNavButton");
const globalDashboardNavButton = document.querySelector("#globalDashboardNavButton");
const globalSettingsNavButton = document.querySelector("#globalSettingsNavButton");
const dataButton = document.querySelector("#dataButton");
const dataBackButton = document.querySelector("#dataBackButton");
const bootProgress = document.querySelector("#bootProgress");
const bootProgressValue = document.querySelector("#bootProgressValue");
const bootProgressText = document.querySelector("#bootProgressText");
const bootProgressLabel = document.querySelector("#bootProgressLabel");
const dashboardHost = document.querySelector("#dashboardHost");
const dashboardBackButton = document.querySelector("#dashboardBackButton");
const dashboardRoot = document.querySelector("#learningDashboard");
const studyTopbar = studyPanel.querySelector(".topbar");
const studyProgressRow = studyPanel.querySelector(".study-progress-row");
const homeCompletedWords = document.querySelector("#homeCompletedWords");
const homeRemainingWords = document.querySelector("#homeRemainingWords");
const homeCompletionDate = document.querySelector("#homeCompletionDate");
const todayNewCount = document.querySelector("#todayNewCount");
const todayReinforceCount = document.querySelector("#todayReinforceCount");
const todayReviewCount = document.querySelector("#todayReviewCount");
const homePlanMeta = document.querySelector("#homePlanMeta");
const progressCompare = document.querySelector("#progressCompare");
const heatmapTooltip = document.querySelector("#heatmapTooltip");
const heatmapScroll = document.querySelector(".heatmap-scroll");
const heatmapMonths = document.querySelector("#heatmapMonths");
const heatmapGrid = document.querySelector("#heatmapGrid");
const dashboardBookSelect = document.querySelector("#dashboardBookSelect");
const dashboardUnitSelect = document.querySelector("#dashboardUnitSelect");
const dashboardRangeSelect = document.querySelector("#dashboardRangeSelect");
const dashboardHeading = document.querySelector("#dashboardHeading");
const dashboardSubtitle = document.querySelector(".dashboard-subtitle");
const dashboardQuality = document.querySelector("#dashboardQuality");
const dashboardDailyUnitLabel = document.querySelector("#dashboardDailyUnitLabel");
const dashboardDailyChart = document.querySelector("#dashboardDailyChart");
const dashboardDailySummary = document.querySelector("#dashboardDailySummary");
const dashboardStatusUnitLabel = document.querySelector("#dashboardStatusUnitLabel");
const dashboardStatusBar = document.querySelector("#dashboardStatusBar");
const dashboardStatusLegend = document.querySelector("#dashboardStatusLegend");
const dashboardPoolChart = document.querySelector("#dashboardPoolChart");
const dashboardPoolSummary = document.querySelector("#dashboardPoolSummary");
const dashboardPoolQuality = document.querySelector("#dashboardPoolQuality");
const dashboardConversionChart = document.querySelector("#dashboardConversionChart");
const dashboardConversionSummary = document.querySelector("#dashboardConversionSummary");
const dashboardConversionQuality = document.querySelector("#dashboardConversionQuality");
const dashboardHoldChart = document.querySelector("#dashboardHoldChart");
const dashboardHoldSummary = document.querySelector("#dashboardHoldSummary");
const dashboardHoldQuality = document.querySelector("#dashboardHoldQuality");
const dashboardSankeyChart = document.querySelector("#dashboardSankeyChart");
const dashboardSankeySummary = document.querySelector("#dashboardSankeySummary");
const dashboardStartDate = document.querySelector("#dashboardStartDate");
const dashboardEndDate = document.querySelector("#dashboardEndDate");
let dashboardSankeyCleanup = null;
const planButton = document.querySelector("#planButton");
const advanceStudyButton = document.querySelector("#advanceStudyButton");
const wordListButton = document.querySelector("#wordListButton");
const startStudyButton = document.querySelector("#startStudyButton");
const dashboardButton = document.querySelector("#dashboardButton");
const homeFeedbackButton = document.querySelector("#homeFeedbackButton");
const replayTutorialButton = document.querySelector("#replayTutorialButton");

if (dashboardHost && dashboardRoot && dashboardRoot.parentElement !== dashboardHost) {
  dashboardHost.append(dashboardRoot);
}

const wordListPanel = document.querySelector("#wordListPanel");
const wordSortSelect = document.querySelector("#wordSortSelect");
const wordSearchInput = document.querySelector("#wordSearchInput");
const wordListFilters = document.querySelector("#wordListFilters");
const wordListEmpty = document.querySelector("#wordListEmpty");
const wordList = document.querySelector("#wordList");
const wordListMore = document.querySelector("#wordListMore");
const wordListSummary = document.querySelector("#wordListSummary");
const wordListLoadMoreButton = document.querySelector("#wordListLoadMoreButton");
const wordListBackButton = document.querySelector("#wordListBackButton");

const confusionPanel = document.querySelector("#confusionPanel");
const confusionBackButton = document.querySelector("#confusionBackButton");
const confusionTitle = document.querySelector("#confusionTitle");
const confusionCount = document.querySelector("#confusionCount");
const confusionGlobeStage = document.querySelector("#confusionGlobeStage");
const confusionSearchInput = document.querySelector("#confusionSearchInput");
const confusionSearchResults = document.querySelector("#confusionSearchResults");

const wordText = document.querySelector("#wordText");
const revealButton = document.querySelector("#revealButton");
const audioButton = document.querySelector("#audioButton");
const senseArea = document.querySelector("#senseArea");
const morphologyPanel = document.querySelector("#morphologyPanel");
const senseHint = document.querySelector("#senseHint");
const senseList = document.querySelector("#senseList");
const nextButton = document.querySelector("#nextButton");
const studyPrimaryActions = studyPanel.querySelector(".study-primary-actions");
const studyFeedbackButton = document.querySelector("#studyFeedbackButton");
const browsePreviousWordButton = document.querySelector("#browsePreviousWordButton");
const exitStudyButton = document.querySelector("#exitStudyButton");
const browseNextWordButton = document.querySelector("#browseNextWordButton");
const resetButton = document.querySelector("#resetButton");
const reviewCount = document.querySelector("#reviewCount");
const newCount = document.querySelector("#newCount");
const learningCount = document.querySelector("#learningCount");
const queueProgress = document.querySelector("#queueProgress");
const senseProgressLabel = document.querySelector("#senseProgressLabel");
const senseProgressBar = document.querySelector("#senseProgressBar");
const cardMode = document.querySelector("#cardMode");
const studyCardViewport = document.querySelector("#studyCardViewport");

const planDialog = document.querySelector("#planDialog");
const planTitle = document.querySelector("#planTitle");
const bookSelect = document.querySelector("#bookSelect");
const dailyTargetInput = document.querySelector("#dailyTargetInput");
const planPreview = document.querySelector("#planPreview");
const savePlanButton = document.querySelector("#savePlanButton");
const cancelPlanButton = document.querySelector("#cancelPlanButton");
const planForm = document.querySelector("#planForm");
const resetAllPlanButton = document.querySelector("#resetAllPlanButton");
const planResetConfirm = document.querySelector("#planResetConfirm");
const confirmResetAllPlanButton = document.querySelector("#confirmResetAllPlanButton");
const backPlanResetButton = document.querySelector("#backPlanResetButton");
const planResetBookName = document.querySelector("#planResetBookName");
const homeBookName = document.querySelector("#homeBookName");
const wordListBookName = document.querySelector("#wordListBookName");
const vocabularyStatus = document.querySelector("#vocabularyStatus");

const resetDialog = document.querySelector("#resetDialog");
const resetOptions = document.querySelector("#resetOptions");
const resetConfirm = document.querySelector("#resetConfirm");
const resetMarkingButton = document.querySelector("#resetMarkingButton");
const relearnWordButton = document.querySelector("#relearnWordButton");
const confirmResetButton = document.querySelector("#confirmResetButton");
const backResetButton = document.querySelector("#backResetButton");
const cancelResetButton = document.querySelector("#cancelResetButton");
const resetWordLabel = document.querySelector("#resetWordLabel");
const resetConfirmTitle = document.querySelector("#resetConfirmTitle");
const resetConfirmCopy = document.querySelector("#resetConfirmCopy");

const returnDialog = document.querySelector("#returnDialog");
const returnTitle = document.querySelector("#returnTitle");
const returnOptions = document.querySelector("#returnOptions");
const returnCrossDayWarning = document.querySelector("#returnCrossDayWarning");
const previousWordButton = document.querySelector("#previousWordButton");
const nextHistoryWordButton = document.querySelector("#nextHistoryWordButton");
const returnHomeButton = document.querySelector("#returnHomeButton");
const cancelReturnButton = document.querySelector("#cancelReturnButton");

const tutorialOverlay = document.querySelector("#tutorialOverlay");
const tutorialSpotlight = document.querySelector("#tutorialSpotlight");
const tutorialTip = document.querySelector("#tutorialTip");
const tutorialExclusionMask = document.querySelector("#tutorialExclusionMask");
const tutorialMasks = Object.fromEntries(
  [...tutorialOverlay.querySelectorAll("[data-mask]")].map((mask) => [
    mask.dataset.mask,
    mask,
  ]),
);
const tutorialDoneDialog = document.querySelector("#tutorialDoneDialog");
const finishTutorialButton = document.querySelector("#finishTutorialButton");
const tutorialReplayConfirmDialog = document.querySelector("#tutorialReplayConfirmDialog");
const confirmReplayTutorialButton = document.querySelector("#confirmReplayTutorialButton");
const cancelReplayTutorialButton = document.querySelector("#cancelReplayTutorialButton");

let words = [];
let wordById = new Map();
let knownSenseKeySet = new Set();
let state = null;
let rootState = null;
let vocabularyBundle = null;
let vocabularyIndex = null;
let vocabularySearchRelations = new Map();
let vocabularyDetailsReady = false;
let vocabularyDetailsPromise = null;
let vocabularyDetailsError = null;
let vocabularyPreloadTimer = null;
let vocabularyBlockingIntent = null;
let vocabularyCatalogAuthoritative = false;
let bookById = new Map();
let poolWordById = new Map();
let activeStorageKey = STORAGE_KEY;
let wordDeepLinkReturnView = null;
let pendingResetType = null;
let activeAudio = null;
let audioPlaybackGeneration = 0;
let lastAutoPlayedCardKey = null;
let soundContext = null;
let completionFeedbackTimer = null;
let wordFitFrame = null;
let renderedStudyCardKey = null;
let renderedStudyView = null;
let studyScrollResetFrame = null;
let pendingCrossDayReturn = false;
let midnightRefreshTimer = null;
let wordListQuery = "";
let wordListFilter = "all";
const WORD_LIST_PAGE_SIZE = 80;
let wordListVisibleCount = WORD_LIST_PAGE_SIZE;
let wordListWindowKey = "";
let wordListItemsForRender = [];
let wordListIndexCache = null;
let wordListIndexRevision = 0;
let wordListRenderToken = 0;
let wordListRenderFrame = null;
let heatmapPositionedBookId = null;
let dashboardBookId = null;
let dashboardUnit = "sense";
let dashboardRangeDays = 21;
let tutorialRuntime = null;
let tutorialAutoScheduledScope = null;
let tutorialAutoTimer = null;
let tutorialAutoWaitScope = null;
let tutorialAutoWaitStartedAt = 0;
let tutorialOverlayFrameId = null;
let tutorialOverlayGeometryKey = "";
let tutorialLiveTarget = null;
let initialGuestHadLearningData = null;
let confusionRuntime = null;
let confusionGlobe = null;
let confusionGlobeSignature = null;
let confusionTransitioning = false;
let confusionTransitionToken = 0;
let confusionGlobeLoader = null;
let activeUiTransition = null;
let commitActiveUiTransition = null;
let cleanupActiveUiTransition = null;
let deferredUiStateSavePending = false;
let deferredUiStateSaveFrame = null;
let deferredUiStateSaveTimer = null;
let deferredUiStateSaveIdle = null;
let deferredUiStateSaveOptions = {};
let deferredLearningJournalPending = false;
let deferredLearningJournalFrame = null;
let deferredLearningJournalTimer = null;
let deferredLearningJournalIdle = null;
let deferredLearningJournalOptions = {};
let learningSessionCommitOptions = {};
const learningJournalCache = new Map();
let dirtyDashboardSnapshots = new Map();
let studyHierarchyOrigin = null;
let wordListHierarchyOrigin = null;
let membershipAccess = {
  loggedIn: false,
  active: true,
  pending: false,
  expiresAt: null,
};

const RESOURCE_TIMEOUT_MS = 24000;

function setBootProgress(value, label = "") {
  const numericValue = Number(value);
  const determinate = value !== null && value !== undefined &&
    Number.isFinite(numericValue);
  if (bootProgress) {
    // A missing Content-Length is not a percentage. Keep the track still and
    // show an explicit unknown value rather than animating a misleading bar.
    bootProgress.classList.remove("is-indeterminate");
    bootProgress.dataset.mode = determinate ? "determinate" : "unknown";
    if (determinate) {
      const normalized = Math.max(
        0,
        Math.min(100, Math.round(numericValue * 100) / 100),
      );
      bootProgress.setAttribute("aria-valuenow", normalized.toFixed(2));
      bootProgress.setAttribute("aria-valuetext", `${label} ${normalized.toFixed(2)}%`);
      if (bootProgressValue) bootProgressValue.style.width = `${normalized}%`;
      if (bootProgressText) bootProgressText.textContent = `${normalized.toFixed(2)}%`;
    } else {
      bootProgress.removeAttribute("aria-valuenow");
      bootProgress.setAttribute("aria-valuetext", `${label || "正在载入"}，总量未知`);
      if (bootProgressValue) bootProgressValue.style.width = "0%";
      if (bootProgressText) bootProgressText.textContent = "--";
    }
  }
  if (label && bootProgressLabel) bootProgressLabel.textContent = label;
}

window.addEventListener("sensevocab:boot-progress", (event) => {
  setBootProgress(event.detail?.value, event.detail?.label);
});

async function fetchWithTimeout(input, init = {}, timeoutMs = RESOURCE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("资源载入超时，请检查网络后重试。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readJsonResponse(response, {
  label = "正在载入",
  background = false,
} = {}) {
  const total = Number(response.headers.get("content-length"));
  if (!response.body?.getReader) {
    setBootProgress(0, label);
    const data = await response.json();
    setBootProgress(100, `${label} 100.00%`);
    return data;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    const hasKnownTotal = Number.isFinite(total) && total > 0;
    const percent = hasKnownTotal
      ? Math.round(Math.min(1, received / total) * 10000) / 100
      : null;
    const progressCopy = hasKnownTotal
      ? `${label} ${percent.toFixed(2)}%`
      : `${label}，已接收 ${(received / 1024 / 1024).toFixed(2)} MB`;
    if (background && document.documentElement.dataset.appReady === "true") {
      setVocabularyStatus(progressCopy);
    } else {
      setBootProgress(percent, progressCopy);
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  const text = new TextDecoder().decode(bytes);
  if (!background || document.documentElement.dataset.appReady !== "true") {
    setBootProgress(100, `${label} 100.00%`);
  }
  return JSON.parse(text);
}

function validateVocabularyData(data, label) {
  if (!Array.isArray(data?.words) || !Array.isArray(data?.books)) {
    throw new Error(`${label} has an invalid schema.`);
  }
  return data;
}

async function loadVocabularyIndex() {
  const response = await fetchWithTimeout(VOCABULARY_INDEX_URL, {
    cache: "no-cache",
  });
  if (!response.ok) {
    throw new Error(`Vocabulary index failed to load: ${response.status}`);
  }
  const data = validateVocabularyData(
    await readJsonResponse(response, {
      label: "正在载入词库索引",
    }),
    "Vocabulary index",
  );
  if (typeof data.bundleVersion !== "string" || !data.bundleVersion) {
    throw new Error("Vocabulary index is missing its bundle version.");
  }
  return data;
}

async function removeOldVocabularyCaches(currentName) {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => (
        name.startsWith(VOCABULARY_CACHE_PREFIX) && name !== currentName
      ))
      .map((name) => caches.delete(name)),
  );
}

async function loadVocabularyBundle(index, { forceNetwork = false } = {}) {
  const version = index?.bundleVersion || "legacy";
  const cacheName = `${VOCABULARY_CACHE_PREFIX}${version.slice(0, 16)}`;
  const url = new URL(VOCABULARY_BUNDLE_URL, window.location.href);
  url.searchParams.set("v", version);
  const request = new Request(url.href, { credentials: "same-origin" });
  let cache = null;

  if ("caches" in window) {
    try {
      cache = await caches.open(cacheName);
      if (!forceNetwork) {
        const cached = await cache.match(request);
        if (cached) {
          try {
            return validateVocabularyData(
              await cached.json(),
              "Cached vocabulary bundle",
            );
          } catch (error) {
            console.warn("Discarding an invalid cached vocabulary bundle.", error);
            await cache.delete(request);
          }
        }
      }
    } catch (error) {
      console.warn("Vocabulary cache is unavailable.", error);
      cache = null;
    }
  }

  const response = await fetchWithTimeout(request, {
    cache: forceNetwork ? "reload" : "default",
  });
  if (!response.ok) {
    throw new Error(`Vocabulary bundle failed to load: ${response.status}`);
  }
  const cacheCopy = response.clone();
  const data = validateVocabularyData(
    await readJsonResponse(response, {
      label: "正在载入完整学习内容",
      background: true,
    }),
    "Vocabulary bundle",
  );

  if (cache) {
    cache.put(request, cacheCopy)
      .then(() => removeOldVocabularyCaches(cacheName))
      .catch((error) => {
        console.warn("Vocabulary bundle could not be cached.", error);
      });
  }
  return data;
}

function normalizeVocabularyIndex(data) {
  return data
    .filter((entry) => entry?.id && entry?.word && Array.isArray(entry.senses))
    .map((entry) => ({
      id: entry.id,
      word: entry.word,
      morphology: null,
      senses: entry.senses
        .filter((sense) => sense?.id)
        .map((sense, index) => ({
          id: sense.id,
          meaning: typeof sense.meaning === "string" ? sense.meaning : "",
          synsetId: typeof sense.synsetId === "string" ? sense.synsetId : null,
          importance: Number.isFinite(sense.importance)
            ? sense.importance
            : Math.max(1, 100 - index * 3),
        })),
    }))
    .filter((word) => word.senses.length > 0);
}

function normalizeWordList(data) {
  const merged = new Map();

  data.forEach((entry) => {
    if (!entry?.word || !Array.isArray(entry.senses)) return;

    const id = entry.id || entry.word.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const wordId = id.replace(/^-+|-+$/g, "");
    if (!wordId) return;

    if (!merged.has(wordId)) {
      merged.set(wordId, {
        id: wordId,
        word: entry.word,
        morphology: entry.morphology || null,
        senses: [],
        seenSenses: new Set(),
      });
    }

    const target = merged.get(wordId);
    if (!target.morphology && entry.morphology) {
      target.morphology = entry.morphology;
    }
    entry.senses.forEach((sense) => {
      if (!sense?.pos || !sense?.meaning) return;

      const dedupeKey = `${sense.pos}|${sense.meaning}`.toLowerCase();
      if (target.seenSenses.has(dedupeKey)) return;

      target.seenSenses.add(dedupeKey);
      target.senses.push({
        id: sense.id || `${sense.pos.replace(/\.$/, "")}-${target.senses.length + 1}`,
        pos: sense.pos,
        meaning: sense.meaning,
        definitionSentence: sense.definitionSentence,
        definitionZh: sense.definitionZh,
        example: sense.example,
        exampleZh: sense.exampleZh,
        ipa: sense.ipa,
        audio: sense.audio,
        audioAuthor: sense.audioAuthor,
        audioLicense: sense.audioLicense,
        audioLicenseUrl: sense.audioLicenseUrl,
        audioSourcePage: sense.audioSourcePage,
        audioAttribution: sense.audioAttribution,
        exampleSource: sense.exampleSource,
        exampleSourceId: sense.exampleSourceId,
        exampleOwner: sense.exampleOwner,
        exampleLicense: sense.exampleLicense,
        exampleLicenseUrl: sense.exampleLicenseUrl,
        exampleSourcePage: sense.exampleSourcePage,
        exampleHistoryPage: sense.exampleHistoryPage,
        synsetId: sense.synsetId,
        importance: Math.max(1, 100 - target.senses.length * 3),
      });
    });
  });

  return Array.from(merged.values())
    .filter((word) => word.senses.length > 0)
    .map(({ seenSenses, ...word }) => word);
}

function normalizeVocabularySearchRelations(data) {
  const relations = data?.search?.semanticRelations;
  if (!relations || typeof relations !== "object" || Array.isArray(relations)) {
    return new Map();
  }
  return new Map(
    Object.entries(relations).map(([synsetId, targets]) => [
      synsetId,
      new Set(Array.isArray(targets) ? targets.filter(Boolean) : []),
    ]),
  );
}

function installVocabularyData(data, { details = false } = {}) {
  vocabularyBundle = data;
  bookById = new Map(data.books.map((book) => [book.id, book]));
  vocabularySearchRelations = normalizeVocabularySearchRelations(
    vocabularyIndex ?? data,
  );
  const normalizedPool = details
    ? normalizeWordList(data.words)
    : normalizeVocabularyIndex(data.words);
  poolWordById = new Map(normalizedPool.map((word) => [word.id, word]));
  wordListIndexRevision += 1;
  wordListIndexCache = null;

  if (rootState) {
    activateBookScope(rootState.activeBookId, { sanitize: false });
  }
}

function renderBookOptions() {
  bookSelect.replaceChildren(
    ...vocabularyBundle.books.map((book) => {
      const option = document.createElement("option");
      option.value = book.id;
      option.textContent = String(book.displayName ?? book.name)
        .replace(/[《》]/g, "");
      return option;
    }),
  );
}

function setVocabularyStatus(message = "", { error = false } = {}) {
  if (!vocabularyStatus) return;
  vocabularyStatus.textContent = message;
  vocabularyStatus.hidden = !message;
  vocabularyStatus.classList.toggle("is-error", error);
}

function beginVocabularyDetailsLoad({ forceNetwork = false } = {}) {
  if (vocabularyDetailsReady) return Promise.resolve(true);
  if (vocabularyDetailsPromise) return vocabularyDetailsPromise;

  vocabularyDetailsError = null;
  document.documentElement.dataset.vocabularyReady = "loading";
  setVocabularyStatus(
    "计划、日历和单词列表已可使用，学习内容正在后台加载。",
  );
  vocabularyDetailsPromise = loadVocabularyBundle(
    vocabularyIndex,
    { forceNetwork },
  )
    .then((data) => {
      installVocabularyData(data, { details: true });
      vocabularyDetailsReady = true;
      vocabularyDetailsError = null;
      document.documentElement.dataset.vocabularyReady = "true";
      setVocabularyStatus();
      window.dispatchEvent(
        new CustomEvent("sensevocab:vocabulary-ready"),
      );
      // Home and list views already render from the index. Repainting them here
      // can monopolize the main thread just as the background load completes.
      // Only an open study card needs the newly hydrated fields immediately.
      if (state?.view === "study") {
        window.requestAnimationFrame(() => {
          if (state?.view === "study") render();
        });
      }
      return true;
    })
    .catch((error) => {
      console.warn(error);
      vocabularyDetailsError = error;
      document.documentElement.dataset.vocabularyReady = "error";
      setVocabularyStatus(
        "学习内容加载失败。计划和历史记录不受影响，点击开始学习时会自动重试。",
        { error: true },
      );
      return false;
    })
    .finally(() => {
      vocabularyDetailsPromise = null;
    });
  return vocabularyDetailsPromise;
}

function scheduleVocabularyDetailsPreload() {
  if (vocabularyDetailsReady || vocabularyDetailsPromise) return;
  if (vocabularyPreloadTimer !== null) {
    window.clearTimeout(vocabularyPreloadTimer);
  }
  vocabularyPreloadTimer = window.setTimeout(() => {
    vocabularyPreloadTimer = null;
    if (document.visibilityState === "hidden" || vocabularyBlockingIntent) {
      scheduleVocabularyDetailsPreload();
      return;
    }
    beginVocabularyDetailsLoad();
  }, VOCABULARY_PRELOAD_DELAY_MS);
}

function cancelVocabularyDetailsPreload() {
  if (vocabularyPreloadTimer !== null) {
    window.clearTimeout(vocabularyPreloadTimer);
    vocabularyPreloadTimer = null;
  }
}

async function ensureVocabularyDetailsReady(intent = "study") {
  if (vocabularyDetailsReady) return true;

  cancelVocabularyDetailsPreload();
  vocabularyBlockingIntent = intent;
  setVocabularyStatus(
    vocabularyDetailsError
      ? "正在重新连接并加载学习内容…"
      : "正在准备学习内容…",
  );
  if (state) renderHome();
  const ready = await beginVocabularyDetailsLoad({
    forceNetwork: Boolean(vocabularyDetailsError),
  });
  vocabularyBlockingIntent = null;
  if (state) render();
  return ready;
}

function activeBookId() {
  return rootState?.activeBookId ?? DEFAULT_BOOK_ID;
}

function activeBook() {
  return bookById.get(activeBookId()) ?? bookById.get(DEFAULT_BOOK_ID);
}

function bookDisplayName(bookId = activeBookId()) {
  const book = bookById.get(bookId);
  return String(book?.displayName ?? book?.name ?? "考研词汇")
    .replace(/[《》]/g, "");
}

function wordsForBook(bookId) {
  const book = bookById.get(bookId);
  if (!book) return [];
  return book.entries.map((entry) => {
    const pooled = poolWordById.get(entry.wordId);
    if (!pooled) return null;
    const selected = new Set(entry.senseIds ?? []);
    return {
      ...pooled,
      senses: pooled.senses.filter((sense) => selected.has(sense.id)),
    };
  }).filter((entry) => entry?.senses?.length);
}

function isPersistenceSafe() {
  return vocabularyCatalogAuthoritative &&
    document.documentElement.dataset.vocabularyReady !== "fallback";
}

function activateBookScope(bookId, options = {}) {
  const targetId = bookById.has(bookId) ? bookId : DEFAULT_BOOK_ID;
  rootState.activeBookId = targetId;
  if (!rootState.bookStates[targetId]) {
    rootState.bookStates[targetId] = createState();
  }
  state = rootState.bookStates[targetId];
  words = wordsForBook(targetId);
  wordById = new Map(words.map((word) => [word.id, word]));
  knownSenseKeySet = new Set(
    words.flatMap((word) => allSenseKeysForWord(word)),
  );
  if (options.sanitize !== false && isPersistenceSafe()) {
    sanitizeState();
    ensureTodaySession();
  }
}

function todayKey() {
  const now = new Date();
  return formatDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateKey, days) {
  return formatDate(new Date(parseDate(dateKey).getTime() + days * DAY_MS));
}

function daysBetween(startDate, endDate) {
  return Math.max(0, Math.round((parseDate(endDate) - parseDate(startDate)) / DAY_MS));
}

function senseKey(wordId, senseId) {
  return `${wordId}:${senseId}`;
}

function splitSenseKey(key) {
  const [wordId, senseId] = key.split(":");
  return { wordId, senseId };
}

function getSense(key) {
  const { wordId, senseId } = splitSenseKey(key);
  const word = wordById.get(wordId);
  const sense = word?.senses.find((item) => item.id === senseId);
  return { word, sense };
}

function isKnownSenseKey(key) {
  return knownSenseKeySet.has(key);
}

function allSenseKeysForWord(word) {
  return word.senses.map((sense) => senseKey(word.id, sense.id));
}

function cloneProgress(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function masteredSenseKeysForWord(wordId) {
  const word = wordById.get(wordId);
  if (!word) return [];
  return allSenseKeysForWord(word).filter((key) => {
    return state.progress[key]?.status === SENSE_STATUS.MASTERED;
  });
}

function isWordFullyMastered(wordId) {
  const word = wordById.get(wordId);
  if (!word || word.senses.length === 0) return false;
  return allSenseKeysForWord(word).every((key) => {
    return state.progress[key]?.status === SENSE_STATUS.MASTERED;
  });
}

function activeSenseKeysForCard(card) {
  const source = Array.isArray(card?.activeSenseKeys)
    ? card.activeSenseKeys
    : card?.senseKeys ?? [];
  return sortSenseKeysByImportance(source);
}

function refreshCardDisplayKeys(card) {
  const word = wordById.get(card.wordId);
  const displayKeys = word
    ? allSenseKeysForWord(word)
    : [
        ...activeSenseKeysForCard(card),
        ...masteredSenseKeysForWord(card.wordId),
      ];
  card.senseKeys = sortSenseKeysByImportance([...new Set(displayKeys)]);
  return card;
}

function confusionPairKey(leftWordId, rightWordId) {
  return [leftWordId, rightWordId]
    .map((wordId) => encodeURIComponent(wordId))
    .sort()
    .join("|");
}

function normalizeConfusionLinks(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const links = {};
  Object.values(value).forEach((entry) => {
    const left = String(entry?.left ?? "");
    const right = String(entry?.right ?? "");
    if (!left || !right || left === right) return;
    links[confusionPairKey(left, right)] = {
      left,
      right,
      createdAt: typeof entry?.createdAt === "string"
        ? entry.createdAt
        : null,
    };
  });
  return links;
}

function normalizePlanTargetHistory(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([date, target]) => {
        return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          Number.isFinite(Number(target)) && Number(target) >= 0;
      })
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, target]) => [date, Math.max(0, Math.round(Number(target)))])
  );
}

function createEncounterSnapshot(wordId) {
  const word = wordById.get(wordId);
  const progress = {};
  allSenseKeysForWord(word).forEach((key) => {
    progress[key] = cloneProgress(state.progress[key]);
  });
  return {
    progress,
    introduced: state.introducedWords.includes(wordId),
    reinforcedKeys: ensureTodaySession().reinforcedKeys.filter((key) => {
      return splitSenseKey(key).wordId === wordId;
    }),
    reviewPromotedKeys: ensureTodaySession().reviewPromotedKeys.filter((key) => {
      return splitSenseKey(key).wordId === wordId;
    }),
    activity: cloneProgress(state.activityLog[currentActivityDate()]),
  };
}

function ensureEncounterSnapshot(card) {
  if (!card || card.encounterSnapshot) return;
  card.encounterSnapshot = {
    ...createEncounterSnapshot(card.wordId),
    confirmedKeys: [...new Set((card.confirmedKeys ?? []).filter(isKnownSenseKey))],
  };
}

function createStudyCard(type, wordId, activeKeys) {
  const card = {
    type,
    wordId,
    activeSenseKeys: sortSenseKeysByImportance(activeKeys),
    newSenseKeys: ["new", "extra", "advance"].includes(type)
      ? sortSenseKeysByImportance(activeKeys)
      : [],
    senseKeys: [],
    confirmedKeys: [],
    expandedMasteredKeys: [],
  };
  return refreshCardDisplayKeys(card);
}

function createState() {
  return {
    view: "home",
    plan: null,
    session: null,
    introducedWords: [],
    progress: {},
    activityLog: {},
    studyWindows: [],
    dashboardEvents: {},
    dashboardSnapshots: {},
    confusionLinks: {},
    planTargetHistory: {},
    learningDayCounter: 0,
    wordListSort: "mastery",
    wordBrowse: null,
    dataVersion: DATA_VERSION,
    _sync: { version: 1 },
  };
}

function createRootState() {
  return {
    schemaVersion: ROOT_STATE_VERSION,
    activeBookId: DEFAULT_BOOK_ID,
    bookStates: {
      [DEFAULT_BOOK_ID]: createState(),
      ielts: createState(),
    },
  };
}

function normalizeLoadedState(saved) {
  if (!saved || typeof saved !== "object") return createState();

  return {
    ...createState(),
    ...saved,
    view: "home",
    plan: saved.plan && typeof saved.plan === "object" ? saved.plan : null,
    session: saved.session && typeof saved.session === "object" ? saved.session : null,
    introducedWords: Array.isArray(saved.introducedWords)
      ? saved.introducedWords
      : [],
    progress: saved.progress && typeof saved.progress === "object"
      ? saved.progress
      : {},
    activityLog: saved.activityLog && typeof saved.activityLog === "object"
      ? saved.activityLog
      : {},
    studyWindows: Array.isArray(saved.studyWindows) ? saved.studyWindows : [],
    dashboardEvents: saved.dashboardEvents && typeof saved.dashboardEvents === "object"
      ? saved.dashboardEvents
      : {},
    dashboardSnapshots: saved.dashboardSnapshots && typeof saved.dashboardSnapshots === "object"
      ? saved.dashboardSnapshots
      : {},
    confusionLinks: normalizeConfusionLinks(saved.confusionLinks),
    planTargetHistory: normalizePlanTargetHistory(saved.planTargetHistory),
    learningDayCounter: Number.isFinite(saved.learningDayCounter)
      ? saved.learningDayCounter
      : 0,
    wordListSort: typeof saved.wordListSort === "string"
      ? saved.wordListSort
      : "mastery",
    wordBrowse: null,
    dataVersion: Number.isFinite(saved.dataVersion) ? saved.dataVersion : 0,
  };
}

function normalizeRootState(saved) {
  if (saved?.bookStates && typeof saved.bookStates === "object") {
    const normalized = createRootState();
    normalized.schemaVersion = ROOT_STATE_VERSION;
    normalized.activeBookId = bookById.has(saved.activeBookId)
      ? saved.activeBookId
      : DEFAULT_BOOK_ID;
    Object.keys(normalized.bookStates).forEach((bookId) => {
      normalized.bookStates[bookId] = normalizeLoadedState(
        saved.bookStates[bookId],
      );
    });
    Object.entries(saved.bookStates).forEach(([bookId, bookState]) => {
      if (!normalized.bookStates[bookId] && bookById.has(bookId)) {
        normalized.bookStates[bookId] = normalizeLoadedState(bookState);
      }
    });
    // Releases before multi-book support, test fixtures, and Supabase's
    // normalized tables all read/write a top-level scope.  When that mirror is
    // present, apply it to the active book so an older client cannot lose an
    // update merely because it does not know about bookStates yet.
    const mirroredKeys = [
      "view",
      "plan",
      "session",
      "introducedWords",
      "progress",
      "activityLog",
      "studyWindows",
      "dashboardEvents",
      "dashboardSnapshots",
      "confusionLinks",
      "planTargetHistory",
      "learningDayCounter",
      "wordListSort",
      "wordBrowse",
      "dataVersion",
      "_sync",
    ];
    if (mirroredKeys.some((key) => Object.prototype.hasOwnProperty.call(saved, key))) {
      const mirrored = Object.fromEntries(
        mirroredKeys
          .filter((key) => Object.prototype.hasOwnProperty.call(saved, key))
          .map((key) => [key, saved[key]]),
      );
      normalized.bookStates[normalized.activeBookId] = normalizeLoadedState({
        ...normalized.bookStates[normalized.activeBookId],
        ...mirrored,
      });
    }
    return normalized;
  }

  const migrated = createRootState();
  migrated.bookStates[DEFAULT_BOOK_ID] = normalizeLoadedState(saved);
  return migrated;
}

function compactLocalState(candidate) {
  const normalized = normalizeRootState(compactStateSessions(cloneSerializable(
    stateWithoutDashboardSnapshots(candidate),
  )));
  const activeId = normalized.activeBookId;
  const activeScope = cloneSerializable(
    normalized.bookStates[activeId] ?? createState(),
  );
  const inactiveBookStates = Object.fromEntries(
    Object.entries(normalized.bookStates)
      .filter(([bookId]) => bookId !== activeId)
      .map(([bookId, bookState]) => [bookId, cloneSerializable(bookState)]),
  );
  return {
    schemaVersion: ROOT_STATE_VERSION,
    activeBookId: activeId,
    bookStates: inactiveBookStates,
    ...activeScope,
  };
}

function isStorageQuotaError(error) {
  return Boolean(
    error && (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014 ||
      /quota|storage.*full|exceeded/i.test(String(error.message ?? ""))
    )
  );
}

function readStoredState(storageKey) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return { raw: null, parsed: null };
  try {
    return { raw, parsed: decodeStorageValue(raw) };
  } catch {
    return { raw, parsed: null };
  }
}

function dashboardSnapshotStoragePrefix(storageKey) {
  return `${storageKey}${DASHBOARD_SNAPSHOT_STORAGE_SEGMENT}`;
}

function dashboardSnapshotStorageKey(storageKey, bookId, snapshotId) {
  return `${dashboardSnapshotStoragePrefix(storageKey)}${encodeURIComponent(bookId)}:${encodeURIComponent(snapshotId)}`;
}

function markDashboardSnapshotDirty(bookId, snapshotId) {
  if (!bookId || !snapshotId) return;
  const ids = dirtyDashboardSnapshots.get(bookId) ?? new Set();
  ids.add(snapshotId);
  dirtyDashboardSnapshots.set(bookId, ids);
}

function markAllDashboardSnapshotsDirty(candidate = rootState) {
  Object.entries(candidate?.bookStates ?? {}).forEach(([bookId, bookState]) => {
    Object.keys(bookState?.dashboardSnapshots ?? {}).forEach((snapshotId) => {
      markDashboardSnapshotDirty(bookId, snapshotId);
    });
  });
}

function dashboardSnapshotChanges(candidate, includeAll = false) {
  const changes = new Map();
  Object.entries(candidate?.bookStates ?? {}).forEach(([bookId, bookState]) => {
    const ids = includeAll
      ? Object.keys(bookState?.dashboardSnapshots ?? {})
      : [...(dirtyDashboardSnapshots.get(bookId) ?? [])];
    if (ids.length) changes.set(bookId, new Set(ids));
  });
  return changes;
}

function stateWithoutDashboardSnapshots(candidate) {
  if (!candidate || typeof candidate !== "object") return candidate;
  const bookStates = Object.fromEntries(
    Object.entries(candidate.bookStates ?? {}).map(([bookId, bookState]) => [
      bookId,
      { ...(bookState ?? {}), dashboardSnapshots: {} },
    ]),
  );
  return {
    ...candidate,
    dashboardSnapshots: {},
    bookStates,
  };
}

function learningJournalStorageKey(storageKey = activeStorageKey) {
  return `${storageKey}${LEARNING_JOURNAL_STORAGE_SEGMENT}`;
}

function compactSessionForPersistence(value, { forCloud = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const session = cloneSerializable(value);
  if (!Array.isArray(session.queue)) return session;
  const currentIndex = Math.max(
    0,
    Math.min(session.queue.length, Number(session.currentIndex) || 0),
  );
  session.queue = session.queue.map((card, index) => {
    if (!card || typeof card !== "object") return card;
    const compact = { ...card };
    const keepSnapshot = !forCloud && Math.abs(index - currentIndex) <= 1;
    if (!keepSnapshot) {
      delete compact.encounterSnapshot;
      return compact;
    }
    if (compact.encounterSnapshot && typeof compact.encounterSnapshot === "object") {
      const snapshot = { ...compact.encounterSnapshot };
      // The current and immediately previous card are enough to recover an
      // interrupted interaction. Keep only their sense keys instead of a full
      // duplicate progress map for every queued card.
      if (snapshot.progress && typeof snapshot.progress === "object") {
        const keepKeys = new Set([
          ...(Array.isArray(compact.activeSenseKeys) ? compact.activeSenseKeys : []),
          ...(Array.isArray(compact.confirmedKeys) ? compact.confirmedKeys : []),
        ]);
        snapshot.progress = Object.fromEntries(
          Object.entries(snapshot.progress).filter(([key]) => keepKeys.has(key)),
        );
      }
      compact.encounterSnapshot = snapshot;
    }
    return compact;
  });
  return session;
}

function compactStateSessions(candidate, { forCloud = false } = {}) {
  const cloned = cloneSerializable(candidate);
  Object.values(cloned?.bookStates ?? {}).forEach((bookState) => {
    if (bookState && Object.prototype.hasOwnProperty.call(bookState, "session")) {
      bookState.session = compactSessionForPersistence(bookState.session, { forCloud });
    }
  });
  if (cloned && Object.prototype.hasOwnProperty.call(cloned, "session")) {
    cloned.session = compactSessionForPersistence(cloned.session, { forCloud });
  }
  return cloned;
}

function readLearningJournal(storageKey = activeStorageKey) {
  const key = learningJournalStorageKey(storageKey);
  if (learningJournalCache.has(key)) return learningJournalCache.get(key);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      learningJournalCache.set(key, null);
      return null;
    }
    const journal = decodeStorageValue(raw);
    const normalized = journal?.version === 1 && typeof journal === "object"
      ? journal
      : null;
    learningJournalCache.set(key, normalized);
    return normalized;
  } catch {
    learningJournalCache.set(key, null);
    return null;
  }
}

function serializeLearningJournal(journal) {
  const json = JSON.stringify(journal);
  if (json.length < 65536) return json;
  const packed = LOCAL_STORAGE_COMPRESSION_PREFIX + compressStorageText(json);
  return packed.length < json.length ? packed : json;
}

function mergeJournalMaps(previous, next) {
  return {
    ...(previous && typeof previous === "object" ? previous : {}),
    ...(next && typeof next === "object" ? next : {}),
  };
}

function mergeJournalWindows(previous, next) {
  const byId = new Map();
  [...(Array.isArray(previous) ? previous : []), ...(Array.isArray(next) ? next : [])]
    .forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      byId.set(String(entry.id ?? `${entry.startedAt ?? ""}-${byId.size}`), entry);
    });
  return [...byId.values()].sort((left, right) => {
    return String(left.startedAt ?? "").localeCompare(String(right.startedAt ?? ""));
  }).slice(-20);
}

function writeLearningJournal(options = {}) {
  if (tutorialRuntime?.active || !state || !isPersistenceSafe()) return false;
  const bookId = activeBookId();
  const changed = options.syncChangeOptions?.changedMapKeysByBook?.[bookId] ?? {};
  const previous = readLearningJournal() ?? {};
  const progressKeys = new Set(changed.progress ?? []);
  const card = currentCard();
  (card?.activeSenseKeys ?? []).forEach((key) => progressKeys.add(key));
  const progress = {};
  progressKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(state.progress ?? {}, key)) {
      progress[key] = cloneSerializable(state.progress[key]);
    }
  });
  const activityDates = new Set(changed.activityLog ?? []);
  const date = typeof currentActivityDate === "function" ? currentActivityDate() : null;
  if (date) activityDates.add(date);
  const activityLog = {};
  activityDates.forEach((entryDate) => {
    if (state.activityLog?.[entryDate]) {
      activityLog[entryDate] = cloneSerializable(state.activityLog[entryDate]);
    }
  });
  const introducedWords = new Set(previous.introducedWords ?? []);
  (changed.introducedWords ?? []).forEach((wordId) => introducedWords.add(String(wordId)));
  const dashboardEvents = Object.fromEntries(
    Object.entries(state.dashboardEvents ?? {}).filter(([, event]) => event?.date === date),
  );
  const journal = {
    version: 1,
    updatedAt: new Date().toISOString(),
    bookId,
    session: compactSessionForPersistence(state.session),
    progress: mergeJournalMaps(previous.progress, progress),
    activityLog: mergeJournalMaps(previous.activityLog, activityLog),
    dashboardEvents: mergeJournalMaps(previous.dashboardEvents, dashboardEvents),
    introducedWords: [...introducedWords],
    studyWindows: mergeJournalWindows(previous.studyWindows, state.studyWindows?.slice(-3)),
    learningDayCounter: Math.max(
      Number(previous.learningDayCounter) || 0,
      Number(state.learningDayCounter) || 0,
    ),
    plan: state.plan ? cloneSerializable(state.plan) : previous.plan ?? null,
    planTargetHistory: mergeJournalMaps(
      previous.planTargetHistory,
      state.planTargetHistory,
    ),
  };
  try {
    const key = learningJournalStorageKey();
    localStorage.setItem(key, serializeLearningJournal(journal));
    learningJournalCache.set(key, journal);
    return true;
  } catch (error) {
    window.dispatchEvent(new CustomEvent("sensevocab:storage-error", {
      detail: {
        error,
        storageKey: learningJournalStorageKey(),
        quotaExceeded: isStorageQuotaError(error),
        journal: true,
      },
    }));
    return false;
  }
}

function applyLearningJournal(storageKey, candidate) {
  const journal = readLearningJournal(storageKey);
  if (!journal || !candidate?.bookStates) return candidate;
  if (!candidate.bookStates[journal.bookId]) {
    // A crash can happen before the main root write creates the selected
    // book scope.  Keep the journal as the recovery source instead of
    // silently discarding that session on the next boot.
    candidate.bookStates[journal.bookId] = createState();
  }
  const bookState = candidate.bookStates[journal.bookId];
  if (journal.session && typeof journal.session === "object") {
    bookState.session = normalizeLoadedState({ session: journal.session }).session;
  }
  if (journal.plan && typeof journal.plan === "object") bookState.plan = journal.plan;
  bookState.progress = {
    ...(bookState.progress ?? {}),
    ...(journal.progress ?? {}),
  };
  bookState.activityLog = {
    ...(bookState.activityLog ?? {}),
    ...(journal.activityLog ?? {}),
  };
  bookState.dashboardEvents = {
    ...(bookState.dashboardEvents ?? {}),
    ...(journal.dashboardEvents ?? {}),
  };
  bookState.introducedWords = [...new Set([
    ...(bookState.introducedWords ?? []),
    ...(journal.introducedWords ?? []),
  ])];
  bookState.studyWindows = mergeJournalWindows(
    bookState.studyWindows,
    journal.studyWindows,
  );
  bookState.learningDayCounter = Math.max(
    Number(bookState.learningDayCounter) || 0,
    Number(journal.learningDayCounter) || 0,
  );
  bookState.planTargetHistory = normalizePlanTargetHistory({
    ...(bookState.planTargetHistory ?? {}),
    ...(journal.planTargetHistory ?? {}),
  });
  candidate.activeBookId = journal.bookId;
  return candidate;
}

function clearLearningJournal(storageKey = activeStorageKey) {
  const key = learningJournalStorageKey(storageKey);
  learningJournalCache.set(key, null);
  try {
    localStorage.removeItem(key);
  } catch {
    // A stale journal is harmless if the browser refuses the cleanup write.
  }
}

function cloneStateForPersistence(candidate, changes = new Map()) {
  const cloned = normalizeRootState(compactStateSessions(cloneSerializable(
    stateWithoutDashboardSnapshots(candidate),
  )));
  changes.forEach((snapshotIds, bookId) => {
    const target = cloned.bookStates?.[bookId];
    const source = candidate?.bookStates?.[bookId]?.dashboardSnapshots ?? {};
    if (!target) return;
    snapshotIds.forEach((snapshotId) => {
      if (source[snapshotId]) {
        target.dashboardSnapshots[snapshotId] = cloneSerializable(source[snapshotId]);
      }
    });
  });
  return cloned;
}

function serializeDashboardSnapshotSidecar(bookId, snapshotId, snapshot) {
  const json = JSON.stringify({ bookId, snapshotId, snapshot });
  if (json.length < 256000) return json;
  const packed = LOCAL_STORAGE_COMPRESSION_PREFIX + compressStorageText(json);
  return packed.length < json.length ? packed : json;
}

function readDashboardSnapshotSidecar(storageKey, bookId, snapshotId) {
  const raw = localStorage.getItem(
    dashboardSnapshotStorageKey(storageKey, bookId, snapshotId),
  );
  if (!raw) return null;
  try {
    const decoded = decodeStorageValue(raw);
    return decoded?.bookId === bookId && decoded?.snapshotId === snapshotId &&
      decoded.snapshot && typeof decoded.snapshot === "object"
      ? decoded.snapshot
      : null;
  } catch {
    return null;
  }
}

function hydrateDashboardSnapshotSidecars(storageKey, candidate) {
  const prefix = dashboardSnapshotStoragePrefix(storageKey);
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const decoded = decodeStorageValue(raw);
      const bookId = String(decoded?.bookId ?? "");
      const snapshotId = String(decoded?.snapshotId ?? "");
      const snapshot = decoded?.snapshot;
      const bookState = candidate?.bookStates?.[bookId];
      if (!bookState || !snapshotId || !snapshot || typeof snapshot !== "object") continue;
      bookState.dashboardSnapshots[snapshotId] = snapshot;
    } catch {
      // Ignore one damaged sidecar without discarding the remaining history.
    }
  }
  return candidate;
}

function persistDashboardSnapshotChanges(
  storageKey,
  candidate,
  changes,
  { prune = false } = {},
) {
  const retainedKeys = new Set();
  changes.forEach((snapshotIds, bookId) => {
    const snapshots = candidate?.bookStates?.[bookId]?.dashboardSnapshots ?? {};
    snapshotIds.forEach((snapshotId) => {
      const key = dashboardSnapshotStorageKey(storageKey, bookId, snapshotId);
      const snapshot = snapshots[snapshotId];
      if (!snapshot) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(
        key,
        serializeDashboardSnapshotSidecar(bookId, snapshotId, snapshot),
      );
      retainedKeys.add(key);
    });
  });

  if (!prune) return;
  Object.entries(candidate?.bookStates ?? {}).forEach(([bookId, bookState]) => {
    Object.keys(bookState?.dashboardSnapshots ?? {}).forEach((snapshotId) => {
      retainedKeys.add(dashboardSnapshotStorageKey(storageKey, bookId, snapshotId));
    });
  });
  const prefix = dashboardSnapshotStoragePrefix(storageKey);
  const staleKeys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix) && !retainedKeys.has(key)) staleKeys.push(key);
  }
  staleKeys.forEach((key) => localStorage.removeItem(key));
}

function removeDashboardSnapshotSidecars(storageKey) {
  const prefix = dashboardSnapshotStoragePrefix(storageKey);
  const keys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

function hasEmbeddedDashboardSnapshots(candidate) {
  return Object.values(candidate?.bookStates ?? {}).some((bookState) => {
    return Object.keys(bookState?.dashboardSnapshots ?? {}).length > 0;
  });
}

function migrateStoredStateToCompactFormat(storageKey, normalized, raw) {
  if (!raw) return;
  try {
    const compact = serializeLocalState(normalized);
    if (compact !== raw && (
      !raw.startsWith(LOCAL_STORAGE_COMPRESSION_PREFIX) ||
      compact.length < raw.length
    )) {
      localStorage.setItem(storageKey, compact);
    }
  } catch {
    // A failed replacement leaves the previous localStorage value untouched.
  }
}

function writeStoredState(storageKey, serialized) {
  try {
    localStorage.setItem(storageKey, serialized);
    return;
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
  }

  // Existing account caches may still use the verbose format. Compact them
  // before retrying the write that contains the newest learning state.
  compactKnownStateCaches();
  localStorage.setItem(storageKey, serialized);
}

function compactKnownStateCaches() {
  const keys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === STORAGE_KEY || key?.startsWith(ACCOUNT_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => {
    const { raw, parsed } = readStoredState(key);
    if (!parsed) return;
    const normalized = normalizeRootState(parsed);
    if (hasEmbeddedDashboardSnapshots(normalized)) {
      try {
        persistDashboardSnapshotChanges(
          key,
          normalized,
          dashboardSnapshotChanges(normalized, true),
          { prune: true },
        );
      } catch {
        // Never remove the only copy of another account's historical charts.
        return;
      }
    }
    migrateStoredStateToCompactFormat(key, normalized, raw);
  });
}

function loadState(storageKey = activeStorageKey) {
  const { raw, parsed } = readStoredState(storageKey);
  const normalized = normalizeRootState(applyLearningJournal(
    storageKey,
    normalizeRootState(parsed ?? createRootState()),
  ));
  const embeddedSnapshots = hasEmbeddedDashboardSnapshots(normalized);
  if (embeddedSnapshots) {
    const allSnapshots = dashboardSnapshotChanges(normalized, true);
    try {
      persistDashboardSnapshotChanges(storageKey, normalized, allSnapshots, { prune: true });
    } catch {
      // Keep the legacy embedded copy if the one-time sidecar migration cannot finish.
      return normalized;
    }
  }
  hydrateDashboardSnapshotSidecars(storageKey, normalized);
  migrateStoredStateToCompactFormat(storageKey, normalized, raw);
  return normalized;
}

let persistedStateBaseline = null;

function saveState(options = {}) {
  if (tutorialRuntime?.active) return;
  if (!isPersistenceSafe()) return;
  wordListIndexRevision += 1;
  wordListIndexCache = null;
  const notify = options.notify !== false;
  const syncRelevant = options.syncRelevant !== undefined
    ? options.syncRelevant !== false
    : !(
      Array.isArray(options.syncChangeOptions?.changedMaps) &&
      options.syncChangeOptions.changedMaps.length === 0
    );
  const uiOnlySave = options.persistAllSnapshots !== true &&
    options.recordDashboardSnapshot !== true &&
    (
      options.persistUiOnly === true ||
      (
        options.stampSync === false &&
        !Array.isArray(options.syncChangeOptions?.changedMaps)
      ) ||
      (
        Array.isArray(options.syncChangeOptions?.changedMaps) &&
        options.syncChangeOptions.changedMaps.length === 0
      )
    );
  if (uiOnlySave) {
    // View/session presentation changes do not need a synchronous full-state
    // clone or localStorage write. The next durable learning mutation persists
    // the current session together with its progress. Keeping this path in
    // memory prevents a large history from stealing the animation frame.
    rootState.bookStates[activeBookId()] = state;
    if (notify) {
      window.dispatchEvent(new CustomEvent("sensevocab:state-saved", {
        detail: {
          storageKey: activeStorageKey,
          persisted: true,
          stampSync: false,
          syncRelevant: false,
        },
      }));
    }
    return true;
  }
  if (notify && options.recordDashboardSnapshot !== false) {
    dashboardRecordSnapshot(activeBookId());
  }
  const snapshotChanges = dashboardSnapshotChanges(
    rootState,
    options.persistAllSnapshots === true,
  );
  let persisted = true;
  let attemptedCharacters = 0;
  let previousCharacters = 0;
  try {
    rootState.bookStates[activeBookId()] = state;
    const nextRootState = cloneStateForPersistence(rootState, snapshotChanges);
    if (state.wordBrowse && requestedWordId()) {
      nextRootState.bookStates[activeBookId()] = {
        ...nextRootState.bookStates[activeBookId()],
        view: wordDeepLinkReturnView ?? "home",
        wordBrowse: null,
      };
    }
    const previousRaw = localStorage.getItem(activeStorageKey);
    const previous = persistedStateBaseline?.key === activeStorageKey &&
      persistedStateBaseline.raw === previousRaw
      ? persistedStateBaseline
      : readStoredState(activeStorageKey);
    const previousStoredState = previous.parsed
      ? snapshotChanges.size === 0
        ? previous.parsed
        : cloneStateForPersistence(previous.parsed)
      : null;
    snapshotChanges.forEach((snapshotIds, bookId) => {
      const previousBook = previousStoredState?.bookStates?.[bookId];
      if (!previousBook) return;
      snapshotIds.forEach((snapshotId) => {
        const snapshot = readDashboardSnapshotSidecar(
          activeStorageKey,
          bookId,
          snapshotId,
        );
        if (snapshot) previousBook.dashboardSnapshots[snapshotId] = snapshot;
      });
    });
    previousCharacters = previous.raw?.length ?? 0;
    if (window.SenseVocabSync) {
      if (options.stampSync === false) {
        window.SenseVocabSync.ensureMetadata(nextRootState);
      } else {
        const changedMapKeysByBook = Object.fromEntries(
          Object.entries(options.syncChangeOptions?.changedMapKeysByBook ?? {})
            .map(([bookId, changedKeys]) => [bookId, { ...changedKeys }]),
        );
        snapshotChanges.forEach((snapshotIds, bookId) => {
          const existing = changedMapKeysByBook[bookId] ?? {};
          changedMapKeysByBook[bookId] = {
            ...existing,
            dashboardSnapshots: [
              ...(existing.dashboardSnapshots ?? []),
              ...snapshotIds,
            ],
          };
        });
        window.SenseVocabSync.stampChanges(
          nextRootState,
          previousStoredState,
          undefined,
          {
            ...(options.syncChangeOptions ?? {}),
            changedMapKeysByBook,
          },
        );
      }
      Object.entries(nextRootState.bookStates ?? {}).forEach(([bookId, bookState]) => {
        if (rootState.bookStates[bookId] && bookState?._sync) {
          rootState.bookStates[bookId]._sync = cloneSerializable(bookState._sync);
        }
      });
      state = rootState.bookStates[activeBookId()];
    }
    const serialized = serializeLocalState(nextRootState);
    attemptedCharacters = serialized.length;
    persistDashboardSnapshotChanges(
      activeStorageKey,
      rootState,
      snapshotChanges,
      { prune: options.persistAllSnapshots === true },
    );
    writeStoredState(activeStorageKey, serialized);
    discardDeferredLearningJournalWrite();
    clearLearningJournal(activeStorageKey);
    if (options.sealLearningSession === true || !options.syncChangeOptions) {
      learningSessionCommitOptions = {};
    }
    // nextRootState is already detached from the live state, so retaining it
    // avoids a second full clone after the write has completed.
    persistedStateBaseline = { key: activeStorageKey, raw: serialized, parsed: nextRootState };
    snapshotChanges.forEach((snapshotIds, bookId) => {
      const dirtyIds = dirtyDashboardSnapshots.get(bookId);
      snapshotIds.forEach((snapshotId) => dirtyIds?.delete(snapshotId));
      if (dirtyIds?.size === 0) dirtyDashboardSnapshots.delete(bookId);
    });
  } catch (error) {
    persisted = false;
    window.dispatchEvent(new CustomEvent("sensevocab:storage-error", {
      detail: {
        error,
        storageKey: activeStorageKey,
        quotaExceeded: isStorageQuotaError(error),
        attemptedCharacters,
        previousCharacters,
      },
    }));
    if (!isStorageQuotaError(error)) throw error;
  }

  if (notify) {
    window.dispatchEvent(new CustomEvent("sensevocab:state-saved", {
      detail: {
        storageKey: activeStorageKey,
        persisted,
        stampSync: options.stampSync !== false,
        syncRelevant,
      },
    }));
  }
  return persisted;
}

function mergeStateSaveOptions(current = {}, nextOptions = {}) {
  const merged = { ...current, ...nextOptions };
  ["recordDashboardSnapshot", "persistAllSnapshots"].forEach((name) => {
    if (current[name] === true || nextOptions[name] === true) merged[name] = true;
  });

  const currentChanges = current.syncChangeOptions;
  const nextChanges = nextOptions.syncChangeOptions;
  if (currentChanges || nextChanges) {
    const combined = { ...(currentChanges ?? {}), ...(nextChanges ?? {}) };
    const changedScalars = [
      ...(Array.isArray(currentChanges?.changedScalars) ? currentChanges.changedScalars : []),
      ...(Array.isArray(nextChanges?.changedScalars) ? nextChanges.changedScalars : []),
    ];
    if (changedScalars.length) {
      combined.changedScalars = [...new Set(changedScalars)];
      combined.stampScalars = true;
    } else if (currentChanges?.stampScalars === false || nextChanges?.stampScalars === false) {
      combined.stampScalars = false;
    }
    const changedMaps = [
      ...(Array.isArray(currentChanges?.changedMaps) ? currentChanges.changedMaps : []),
      ...(Array.isArray(nextChanges?.changedMaps) ? nextChanges.changedMaps : []),
    ];
    if (changedMaps.length) combined.changedMaps = [...new Set(changedMaps)];
    const currentKeys = currentChanges?.changedMapKeysByBook ?? {};
    const nextKeys = nextChanges?.changedMapKeysByBook ?? {};
    const books = new Set([...Object.keys(currentKeys), ...Object.keys(nextKeys)]);
    if (books.size) {
      combined.changedMapKeysByBook = {};
      books.forEach((bookId) => {
        const bookKeys = {};
        const maps = new Set([
          ...Object.keys(currentKeys[bookId] ?? {}),
          ...Object.keys(nextKeys[bookId] ?? {}),
        ]);
        maps.forEach((mapName) => {
          bookKeys[mapName] = [...new Set([
            ...(currentKeys[bookId]?.[mapName] ?? []),
            ...(nextKeys[bookId]?.[mapName] ?? []),
          ])];
        });
        combined.changedMapKeysByBook[bookId] = bookKeys;
      });
    }
    merged.syncChangeOptions = combined;
    if (combined.changedMaps?.length) {
      // A durable mutation must win over a later presentation-only save that
      // happens before the deferred write runs.
      merged.stampSync = true;
      merged.syncRelevant = true;
    }
  }
  return merged;
}

function mergeDeferredUiStateSaveOptions(nextOptions = {}) {
  return mergeStateSaveOptions(deferredUiStateSaveOptions, nextOptions);
}

function hasLearningSessionCommit() {
  return Object.keys(learningSessionCommitOptions).length > 0;
}

function learningTransactionActive() {
  return Boolean(
    state?.session &&
    !state.wordBrowse &&
    (["study", "confusion"].includes(state.view) || activeStudyWindow()),
  );
}

function prepareLearningSaveOptions(options = {}) {
  let prepared = {
    recordDashboardSnapshot: false,
    ...options,
  };
  const active = learningTransactionActive();
  if (active) {
    const commitOptions = { ...prepared };
    [
      "journalOnly",
      "sealLearningSession",
      "persistUiOnly",
      "syncRelevant",
      "notify",
    ].forEach((name) => delete commitOptions[name]);
    learningSessionCommitOptions = mergeStateSaveOptions(
      learningSessionCommitOptions,
      commitOptions,
    );
  }
  if (prepared.sealLearningSession === true && hasLearningSessionCommit()) {
    prepared = mergeStateSaveOptions(learningSessionCommitOptions, prepared);
  }
  if (prepared.sealLearningSession === true) {
    prepared.journalOnly = false;
  } else if (prepared.journalOnly === undefined) {
    prepared.journalOnly = active && prepared.sealLearningSession !== true;
  }
  return prepared;
}

function discardDeferredLearningJournalWrite() {
  if (deferredLearningJournalFrame !== null) {
    window.cancelAnimationFrame(deferredLearningJournalFrame);
    deferredLearningJournalFrame = null;
  }
  if (deferredLearningJournalTimer !== null) {
    window.clearTimeout(deferredLearningJournalTimer);
    deferredLearningJournalTimer = null;
  }
  if (
    deferredLearningJournalIdle !== null &&
    typeof window.cancelIdleCallback === "function"
  ) {
    window.cancelIdleCallback(deferredLearningJournalIdle);
    deferredLearningJournalIdle = null;
  }
  deferredLearningJournalPending = false;
  deferredLearningJournalOptions = {};
}

function runDeferredLearningJournalWrite() {
  deferredLearningJournalFrame = null;
  deferredLearningJournalTimer = null;
  deferredLearningJournalIdle = null;
  if (!deferredLearningJournalPending) return false;
  deferredLearningJournalPending = false;
  const options = deferredLearningJournalOptions;
  deferredLearningJournalOptions = {};
  return writeLearningJournal(options);
}

function scheduleDeferredLearningJournalWrite(options = {}) {
  if (options.journal === false || tutorialRuntime?.active) return false;
  if (
    options.journalOnly !== true &&
    !learningTransactionActive() &&
    !hasLearningSessionCommit()
  ) return false;
  deferredLearningJournalOptions = mergeStateSaveOptions(
    deferredLearningJournalOptions,
    options,
  );
  deferredLearningJournalPending = true;
  if (document.visibilityState === "hidden") {
    return runDeferredLearningJournalWrite();
  }
  if (
    deferredLearningJournalFrame !== null ||
    deferredLearningJournalTimer !== null ||
    deferredLearningJournalIdle !== null
  ) return true;

  deferredLearningJournalFrame = window.requestAnimationFrame(() => {
    deferredLearningJournalFrame = null;
    deferredLearningJournalTimer = window.setTimeout(() => {
      deferredLearningJournalTimer = null;
      if (typeof window.requestIdleCallback === "function") {
        deferredLearningJournalIdle = window.requestIdleCallback(
          runDeferredLearningJournalWrite,
          { timeout: 800 },
        );
      } else {
        runDeferredLearningJournalWrite();
      }
    }, 120);
  });
  return true;
}

function flushDeferredLearningJournalWrite() {
  if (deferredLearningJournalFrame !== null) {
    window.cancelAnimationFrame(deferredLearningJournalFrame);
    deferredLearningJournalFrame = null;
  }
  if (deferredLearningJournalTimer !== null) {
    window.clearTimeout(deferredLearningJournalTimer);
    deferredLearningJournalTimer = null;
  }
  if (
    deferredLearningJournalIdle !== null &&
    typeof window.cancelIdleCallback === "function"
  ) {
    window.cancelIdleCallback(deferredLearningJournalIdle);
    deferredLearningJournalIdle = null;
  }
  return runDeferredLearningJournalWrite();
}

function runDeferredUiStateSave() {
  deferredUiStateSaveFrame = null;
  deferredUiStateSaveTimer = null;
  deferredUiStateSaveIdle = null;
  if (!deferredUiStateSavePending) return;
  deferredUiStateSavePending = false;
  const options = deferredUiStateSaveOptions;
  deferredUiStateSaveOptions = {};
  flushDeferredLearningJournalWrite();
  if (options.journalOnly === true) {
    saveState({
      ...options,
      persistUiOnly: true,
      syncRelevant: false,
    });
    return;
  }
  saveState(options);
}

function scheduleIdleUiStateSave(timeout = 700, options = {}) {
  deferredUiStateSaveOptions = mergeDeferredUiStateSaveOptions(options);
  const durable = Boolean(
    deferredUiStateSaveOptions.persistAllSnapshots === true ||
    (deferredUiStateSaveOptions.syncChangeOptions?.changedMaps?.length ?? 0) > 0,
  );
  if (deferredUiStateSaveIdle !== null) return;
  if (typeof window.requestIdleCallback === "function") {
    deferredUiStateSaveIdle = window.requestIdleCallback(
      () => runDeferredUiStateSave(),
      { timeout: durable ? Math.max(timeout, 1200) : timeout },
    );
    return;
  }
  deferredUiStateSaveTimer = window.setTimeout(
    runDeferredUiStateSave,
    durable ? Math.max(600, timeout) : 160,
  );
}

function cancelDeferredUiStateSave() {
  if (deferredUiStateSaveFrame !== null) {
    window.cancelAnimationFrame(deferredUiStateSaveFrame);
    deferredUiStateSaveFrame = null;
  }
  if (deferredUiStateSaveTimer !== null) {
    window.clearTimeout(deferredUiStateSaveTimer);
    deferredUiStateSaveTimer = null;
  }
  if (deferredUiStateSaveIdle !== null && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(deferredUiStateSaveIdle);
    deferredUiStateSaveIdle = null;
  }
}

function flushDeferredUiStateSave() {
  cancelDeferredUiStateSave();
  flushDeferredLearningJournalWrite();
  runDeferredUiStateSave();
}

function sealLearningSessionForLifecycle() {
  cancelDeferredUiStateSave();
  const pendingOptions = deferredUiStateSavePending
    ? deferredUiStateSaveOptions
    : {};
  const journalWasPending = deferredLearningJournalPending;
  deferredUiStateSavePending = false;
  deferredUiStateSaveOptions = {};
  flushDeferredLearningJournalWrite();
  const shouldSeal = (
    hasLearningSessionCommit() ||
    journalWasPending ||
    pendingOptions.journalOnly === true
  );
  if (!shouldSeal) {
    if (Object.keys(pendingOptions).length) saveState(pendingOptions);
    return;
  }
  const options = mergeStateSaveOptions(learningSessionCommitOptions, pendingOptions);
  saveState({
    ...options,
    journalOnly: false,
    sealLearningSession: true,
    recordDashboardSnapshot: false,
  });
}

function saveStateAfterInteractionFrame(options = {}) {
  const saveOptions = prepareLearningSaveOptions(options);
  scheduleDeferredLearningJournalWrite(saveOptions);
  deferredUiStateSaveOptions = mergeDeferredUiStateSaveOptions(saveOptions);
  if (document.visibilityState === "hidden") {
    const immediateOptions = deferredUiStateSaveOptions;
    deferredUiStateSaveOptions = {};
    return saveState(immediateOptions);
  }
  deferredUiStateSavePending = true;
  if (deferredUiStateSaveFrame !== null || deferredUiStateSaveTimer !== null) return true;
  deferredUiStateSaveFrame = window.requestAnimationFrame(() => {
    deferredUiStateSaveFrame = null;
    // Let the input frame and its compositor animation render first. The
    // compact clone/compression path is synchronous and can otherwise steal
    // the very next frame on mobile browsers.
    scheduleIdleUiStateSave();
  });
  return true;
}

function saveStateAfterMotion(delay = 380, options = {}) {
  const saveOptions = prepareLearningSaveOptions(options);
  scheduleDeferredLearningJournalWrite(saveOptions);
  deferredUiStateSaveOptions = mergeDeferredUiStateSaveOptions(saveOptions);
  if (document.visibilityState === "hidden") {
    const immediateOptions = deferredUiStateSaveOptions;
    deferredUiStateSaveOptions = {};
    return saveState(immediateOptions);
  }
  deferredUiStateSavePending = true;
  if (deferredUiStateSaveFrame !== null) {
    window.cancelAnimationFrame(deferredUiStateSaveFrame);
    deferredUiStateSaveFrame = null;
  }
  if (deferredUiStateSaveTimer !== null) {
    window.clearTimeout(deferredUiStateSaveTimer);
    deferredUiStateSaveTimer = null;
  }
  if (deferredUiStateSaveIdle !== null && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(deferredUiStateSaveIdle);
    deferredUiStateSaveIdle = null;
  }
  deferredUiStateSaveTimer = window.setTimeout(() => {
    deferredUiStateSaveTimer = null;
    scheduleIdleUiStateSave(500);
  }, delay);
  return true;
}

window.addEventListener("pagehide", sealLearningSessionForLifecycle);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") sealLearningSessionForLifecycle();
});
document.addEventListener("freeze", sealLearningSessionForLifecycle);
window.addEventListener("storage", (event) => {
  if (event.key?.includes(LEARNING_JOURNAL_STORAGE_SEGMENT)) {
    learningJournalCache.delete(event.key);
  }
});

function normalizeActivityEntry(entry = {}) {
  const uniqueKnownWords = (value) => {
    return [...new Set(Array.isArray(value) ? value : [])].filter((wordId) => {
      return wordById.has(wordId);
    });
  };

  const newWords = uniqueKnownWords(entry.newWords);
  const reviewWords = uniqueKnownWords(entry.reviewWords);
  const target = Number.isFinite(entry.target) ? Math.max(0, entry.target) : null;
  const completedFloor = entry.baseCompleted && target ? target : 0;
  const lockedNewCount = Boolean(entry.newCountLocked) &&
    Number.isFinite(entry.newCount);

  return {
    newWords,
    reviewWords,
    newCount: lockedNewCount
      ? Math.max(0, entry.newCount)
      : Math.max(
        newWords.length,
        Number.isFinite(entry.newCount) ? Math.max(0, entry.newCount) : 0,
        completedFloor,
      ),
    newCountLocked: lockedNewCount,
    reviewCount: Math.max(
      reviewWords.length,
      Number.isFinite(entry.reviewCount) ? Math.max(0, entry.reviewCount) : 0,
    ),
    baseCompleted: Boolean(entry.baseCompleted),
    overtime: Boolean(entry.overtime),
    target,
    learningDays: [...new Set(Array.isArray(entry.learningDays) ? entry.learningDays : [])]
      .filter(Number.isFinite),
  };
}

function normalizeDashboardMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .filter(([key, entry]) => {
      return typeof key === "string" && key.length > 0 &&
        entry && typeof entry === "object" && !Array.isArray(entry);
    })
    .map(([key, entry]) => [key, cloneSerializable(entry)]);
  return Object.fromEntries(entries);
}

function activeStudyWindow() {
  if (!Array.isArray(state?.studyWindows)) return null;
  return [...state.studyWindows].reverse().find((window) => {
    return window && !window.endedAt;
  }) ?? null;
}

function currentActivityDate() {
  const studyWindow = activeStudyWindow();
  if (/^\d{4}-\d{2}-\d{2}$/.test(studyWindow?.activityDate ?? "")) {
    return studyWindow.activityDate;
  }
  if (
    state?.view === "study" &&
    /^\d{4}-\d{2}-\d{2}$/.test(state.session?.date ?? "")
  ) {
    return state.session.date;
  }
  return currentDate();
}

function finishStudyWindow(reason) {
  const studyWindow = activeStudyWindow();
  if (!studyWindow) return null;
  studyWindow.endedAt = new Date().toISOString();
  studyWindow.endedDate = currentDate();
  studyWindow.endedReason = reason;
  studyWindow.crossedMidnight = studyWindow.activityDate !== studyWindow.endedDate;
  return studyWindow;
}

function targetForBookDate(bookState, date) {
  const normalizedDate = String(date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return Math.max(0, Number(bookState?.plan?.dailyTarget) || 0);
  }
  const history = normalizePlanTargetHistory(bookState?.planTargetHistory);
  const historicalDate = Object.keys(history)
    .filter((entryDate) => entryDate <= normalizedDate)
    .sort()
    .at(-1);
  if (historicalDate) return history[historicalDate];
  const startedOn = String(bookState?.plan?.startedOn ?? "").slice(0, 10);
  if (startedOn && normalizedDate >= startedOn) {
    return Math.max(0, Number(bookState?.plan?.dailyTarget) || 0);
  }
  return 0;
}

function ensurePlanTargetHistory(bookState) {
  if (!bookState || typeof bookState !== "object") return {};
  const history = normalizePlanTargetHistory(bookState.planTargetHistory);
  // An activity entry records the target that applied to that day, but it is
  // not by itself a plan-change event. Treating every historical activity
  // target as a new baseline makes one anomalous day (or an old legacy value)
  // leak into every later empty day. Only explicit planTargetHistory entries
  // are allowed to change the target used for dates without an activity row.
  if (bookState.plan && /^\d{4}-\d{2}-\d{2}$/.test(bookState.plan.startedOn ?? "")) {
    const start = bookState.plan.startedOn;
    if (!Object.prototype.hasOwnProperty.call(history, start)) {
      history[start] = Math.max(0, Number(bookState.plan.dailyTarget) || 0);
    }
  }
  bookState.planTargetHistory = normalizePlanTargetHistory(history);
  return bookState.planTargetHistory;
}

function startStudyWindow() {
  finishStudyWindow("new-entry");
  const startedAt = new Date().toISOString();
  const activityDate = currentDate();
  const studyWindow = {
    id: `${Date.now()}-${state.studyWindows.length + 1}`,
    startedAt,
    endedAt: null,
    activityDate,
    endedDate: null,
    endedReason: null,
    crossedMidnight: false,
  };
  state.studyWindows.push(studyWindow);
  state.studyWindows = state.studyWindows.slice(-500);
  return studyWindow;
}

function isCrossDayStudy() {
  const sessionDate = ensureTodaySession().date;
  return /^\d{4}-\d{2}-\d{2}$/.test(sessionDate) &&
    sessionDate < currentDate();
}

function activityForDate(date = currentActivityDate()) {
  state.activityLog[date] = normalizeActivityEntry(state.activityLog[date]);
  if (!Number.isFinite(state.activityLog[date].target)) {
    ensurePlanTargetHistory(state);
    state.activityLog[date].target = targetForBookDate(state, date);
  }
  return state.activityLog[date];
}

function addActivityWord(kind, wordId, date = currentActivityDate()) {
  if (!wordById.has(wordId)) return;
  const activity = activityForDate(date);
  const field = kind === "new" ? "newWords" : "reviewWords";
  const countField = kind === "new" ? "newCount" : "reviewCount";
  const alreadyCounted = activity[field].includes(wordId);
  activity[field] = [...new Set([...activity[field], wordId])];
  if (!alreadyCounted) {
    activity[countField] += 1;
  }
  if (kind === "new") {
    activity.newCountLocked = false;
  }
}

function migrateFastLegacyCalendar() {
  const shouldShift = state.dataVersion >= 3 &&
    state.dataVersion <= FAST_CALENDAR_LAST_VERSION &&
    Object.keys(state.activityLog).length > 0;
  if (!shouldShift) return;

  Object.entries(LOCAL_HISTORY_NEW_COUNT_CORRECTIONS).forEach(([date, count]) => {
    const activity = state.activityLog[date];
    if (!activity) return;
    activity.newCount = count;
    activity.newCountLocked = true;
    activity.baseCompleted = count > 0;
    activity.overtime = false;
    if (count > 0 && !Number.isFinite(activity.target)) {
      activity.target = state.plan?.dailyTarget ?? count;
    }
  });

  state.activityLog = Object.fromEntries(
    Object.entries(state.activityLog).map(([date, activity]) => {
      return [addDays(date, -1), activity];
    }),
  );

  Object.values(state.progress).forEach((progress) => {
    if (!progress || typeof progress !== "object") return;
    if (!progress.firstSeenActual && /^\d{4}-\d{2}-\d{2}$/.test(progress.firstSeen ?? "")) {
      progress.firstSeenActual = addDays(progress.firstSeen, -1);
    }
    if (!progress.lastSeenActual && /^\d{4}-\d{2}-\d{2}$/.test(progress.lastSeen ?? "")) {
      progress.lastSeenActual = addDays(progress.lastSeen, -1);
    }
    if (!progress.masteredOnActual && /^\d{4}-\d{2}-\d{2}$/.test(progress.masteredOn ?? "")) {
      progress.masteredOnActual = addDays(progress.masteredOn, -1);
    }
  });
}

function reconcileLocalJulyHistory() {
  if (
    state.dataVersion >= DATA_VERSION ||
    state.introducedWords.length < 359
  ) {
    return false;
  }

  Object.entries(LOCAL_JULY_NEW_HISTORY).forEach(([date, count]) => {
    const activity = normalizeActivityEntry(state.activityLog[date]);
    activity.newCount = count;
    activity.newCountLocked = true;
    activity.target = 40;
    activity.baseCompleted = count >= 40;
    activity.overtime = count > 40;
    state.activityLog[date] = activity;
  });
  return true;
}

function migrateLegacyActivity() {
  migrateFastLegacyCalendar();
  const reconciledLocalHistory = reconcileLocalJulyHistory();
  Object.entries(state.activityLog).forEach(([date, entry]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      delete state.activityLog[date];
      return;
    }
    state.activityLog[date] = normalizeActivityEntry(entry);
  });

  if (
    (reconciledLocalHistory || state.dataVersion >= DATA_VERSION) &&
    Object.keys(state.activityLog).length > 0
  ) {
    state.dataVersion = DATA_VERSION;
    return;
  }

  const target = state.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET;
  const startedOn = state.plan?.startedOn ?? currentDate();
  const inferredDateByWord = new Map();
  const recordedActivityDateByWord = new Map();
  Object.entries(state.activityLog)
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .forEach(([date, activity]) => {
      [...activity.newWords, ...activity.reviewWords].forEach((wordId) => {
        if (!recordedActivityDateByWord.has(wordId)) {
          recordedActivityDateByWord.set(wordId, date);
        }
      });
    });

  state.introducedWords.forEach((wordId, index) => {
    const word = wordById.get(wordId);
    if (!word) return;
    const seenDates = allSenseKeysForWord(word)
      .map((key) => state.progress[key]?.firstSeenActual ?? state.progress[key]?.firstSeen)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))
      .sort();
    const distributed = addDays(startedOn, Math.floor(index / Math.max(1, target)));
    const inferredDate = seenDates[0] ?? recordedActivityDateByWord.get(wordId) ?? (
      distributed <= currentDate() ? distributed : currentDate()
    );
    inferredDateByWord.set(wordId, inferredDate);
    const activity = activityForDate(inferredDate);
    activity.newWords = [...new Set([...activity.newWords, wordId])];
    activity.target = activity.target || target;
  });

  Object.entries(state.progress).forEach(([key, progress]) => {
    if (!isKnownSenseKey(key)) return;
    const { wordId } = splitSenseKey(key);
    const date = progress.lastSeenActual ?? progress.lastSeen;
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") &&
      date !== (
        progress.firstSeenActual ??
        progress.firstSeen ??
        inferredDateByWord.get(wordId)
      )
    ) {
      const activity = activityForDate(date);
      activity.reviewWords = [...new Set([...activity.reviewWords, wordId])];
      activity.target = activity.target || target;
    }
  });

  Object.values(state.activityLog).forEach((activity) => {
    if (activity.newCountLocked) return;
    const newCount = Math.max(activity.newWords.length, activity.newCount || 0);
    if (newCount >= (activity.target || target)) {
      activity.baseCompleted = true;
    }
    if (newCount > (activity.target || target)) {
      activity.overtime = true;
    }
  });
  Object.keys(state.activityLog).forEach((date) => {
    state.activityLog[date] = normalizeActivityEntry(state.activityLog[date]);
  });
  state.dataVersion = DATA_VERSION;
}

function sanitizeState() {
  if (state.plan) {
    const advancedDays = Number(state.plan.advancedDays);
    state.plan.advancedDays = Number.isFinite(advancedDays) ? advancedDays : 0;
    state.plan.progressBaseWords = Math.max(
      0,
      Number(state.plan.progressBaseWords) || 0,
    );
    state.plan.progressBaseDays = Math.max(
      0,
      Number(state.plan.progressBaseDays) || 0,
    );
  }

  state.introducedWords = state.introducedWords.filter((wordId, index, list) => {
    return wordById.has(wordId) && list.indexOf(wordId) === index;
  });

  const introduced = new Set(state.introducedWords);
  CONTENT_ADDED_SENSE_KEYS.forEach((key) => {
    const { wordId } = splitSenseKey(key);
    if (introduced.has(wordId) && isKnownSenseKey(key) && !state.progress[key]) {
      progressFor(key);
    }
  });

  const inferredLearningDays = state.plan?.dailyTarget
    ? Math.ceil(progressDayCount(state.plan.dailyTarget))
    : 0;
  state.learningDayCounter = Math.max(
    0,
    Number.parseInt(state.learningDayCounter, 10) || 0,
    inferredLearningDays,
  );

  Object.keys(state.progress).forEach((key) => {
    if (!isKnownSenseKey(key)) delete state.progress[key];
    const progress = state.progress[key];
    if (!progress) return;
    if (progress.status === "learning") progress.status = SENSE_STATUS.REINFORCE;
    if (!Object.values(SENSE_STATUS).includes(progress.status)) {
      progress.status = SENSE_STATUS.NEW;
    }
    if (typeof progress.statusEnteredAt !== "string") {
      progress.statusEnteredAt = null;
    }
    if (
      (progress.status === SENSE_STATUS.REINFORCE || progress.status === SENSE_STATUS.REVIEW) &&
      !progress.dueDate
    ) {
      progress.dueDate = currentDate();
    }
    if (
      (progress.status === SENSE_STATUS.REINFORCE || progress.status === SENSE_STATUS.REVIEW) &&
      !Number.isFinite(progress.dueLearningDay)
    ) {
      progress.dueLearningDay = progress.dueDate && progress.dueDate > currentDate()
        ? state.learningDayCounter + 1
        : Math.max(1, state.learningDayCounter);
    }
  });

  if (state.session?.queue) {
    if (!["hidden", "select", "examples"].includes(state.session.cardPhase)) {
      state.session.cardPhase = state.session.revealed ? "select" : "hidden";
    }

    state.session.queue = state.session.queue
      .filter((card) => wordById.has(card.wordId) && Array.isArray(card.senseKeys))
      .map((card) => {
        const activeSenseKeys = Array.isArray(card.activeSenseKeys)
          ? card.activeSenseKeys
          : card.senseKeys;
        return refreshCardDisplayKeys({
          ...card,
          type: card.type === "new-review" ? "reinforcement" : card.type,
          activeSenseKeys: sortSenseKeysByImportance(activeSenseKeys),
          newSenseKeys: Array.isArray(card.newSenseKeys)
            ? sortSenseKeysByImportance(card.newSenseKeys)
            : [],
          senseKeys: sortSenseKeysByImportance(card.senseKeys),
          confirmedKeys: Array.isArray(card.confirmedKeys)
            ? card.confirmedKeys.filter(isKnownSenseKey)
            : [],
          expandedMasteredKeys: Array.isArray(card.expandedMasteredKeys)
            ? card.expandedMasteredKeys.filter(isKnownSenseKey)
            : [],
        });
      })
      .filter((card) => card.senseKeys.length > 0);
    state.session.currentIndex = Math.min(
      state.session.currentIndex ?? 0,
      state.session.queue.length,
    );
    if (state.session.snapshotTimingVersion !== 2) {
      const activeIndex = state.session.historyView?.originIndex ??
        state.session.currentIndex;
      state.session.queue.forEach((card, index) => {
        const untouchedCurrent = index === activeIndex &&
          !state.session.revealed &&
          (card.confirmedKeys ?? []).length === 0;
        if (index > activeIndex || untouchedCurrent) {
          delete card.encounterSnapshot;
        }
      });
      state.session.snapshotTimingVersion = 2;
    }
  }

  state.activityLog = state.activityLog && typeof state.activityLog === "object"
    ? state.activityLog
    : {};
  state.dashboardEvents = normalizeDashboardMap(state.dashboardEvents);
  state.dashboardSnapshots = normalizeDashboardMap(state.dashboardSnapshots);
  state.studyWindows = Array.isArray(state.studyWindows)
    ? state.studyWindows
      .filter((studyWindow) => {
        return studyWindow &&
          typeof studyWindow.startedAt === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(studyWindow.activityDate ?? "");
      })
      .map((studyWindow, index) => ({
        id: String(studyWindow.id ?? `${index + 1}`),
        startedAt: studyWindow.startedAt,
        endedAt: typeof studyWindow.endedAt === "string"
          ? studyWindow.endedAt
          : null,
        activityDate: studyWindow.activityDate,
        endedDate: /^\d{4}-\d{2}-\d{2}$/.test(studyWindow.endedDate ?? "")
          ? studyWindow.endedDate
          : null,
        endedReason: typeof studyWindow.endedReason === "string"
          ? studyWindow.endedReason
          : null,
        crossedMidnight: Boolean(studyWindow.crossedMidnight),
      }))
      .slice(-500)
    : [];
  state.confusionLinks = Object.fromEntries(
    Object.entries(normalizeConfusionLinks(state.confusionLinks)).filter(([, link]) => {
      return wordById.has(link.left) && wordById.has(link.right);
    }),
  );
  migrateLegacyActivity();
  ensurePlanTargetHistory(state);
  state.wordListSort = [
    "mastery",
    "time-asc",
    "time-desc",
    "alpha-asc",
    "alpha-desc",
  ].includes(state.wordListSort)
    ? state.wordListSort
    : "mastery";
  state.wordBrowse = null;
  updatePlanDrift();
}

function cloneSerializable(value) {
  return JSON.parse(JSON.stringify(value));
}

const STORAGE_STATUS_CODES = Object.freeze({
  new: 0,
  reinforce: 1,
  review: 2,
  mastered: 3,
});
const STORAGE_STATUS_BY_CODE = Object.freeze(
  Object.fromEntries(Object.entries(STORAGE_STATUS_CODES).map(([key, value]) => [value, key])),
);

function stringFromCharCodes(codes) {
  const chunks = [];
  for (let index = 0; index < codes.length; index += 8192) {
    chunks.push(String.fromCharCode(...codes.slice(index, index + 8192)));
  }
  return chunks.join("");
}

// The local cache is synchronous, so use a small UTF-16 LZ stream instead of
// waiting for an asynchronous CompressionStream during every study action.
function compressStorageText(input) {
  if (!input) return "";

  const candidates = new Map();
  const output = [];
  let flagIndex = -1;
  let flags = 0;
  let flagBit = 0;

  function beginToken() {
    if (flagBit !== 0) return;
    flagIndex = output.length;
    output.push(0);
    flags = 0;
  }

  function finishToken() {
    flagBit += 1;
    if (flagBit === 16) {
      output[flagIndex] = flags;
      flagBit = 0;
    }
  }

  function addCandidate(position) {
    if (position + 2 >= input.length) return;
    const key = input.slice(position, position + 3);
    const list = candidates.get(key) ?? [];
    list.push(position);
    if (list.length > LZ_MAX_CANDIDATES) {
      list.splice(0, list.length - LZ_MAX_CANDIDATES);
    }
    candidates.set(key, list);
  }

  let cursor = 0;
  while (cursor < input.length) {
    let bestLength = 0;
    let bestPosition = -1;
    if (cursor + 2 < input.length) {
      const key = input.slice(cursor, cursor + 3);
      const list = candidates.get(key) ?? [];
      for (let index = list.length - 1; index >= 0; index -= 1) {
        const position = list[index];
        if (cursor - position > LZ_MAX_DISTANCE) continue;
        const maxLength = Math.min(LZ_MAX_MATCH, input.length - cursor);
        let length = 0;
        while (
          length < maxLength &&
          input.charCodeAt(position + length) === input.charCodeAt(cursor + length)
        ) {
          length += 1;
        }
        if (length >= LZ_MIN_MATCH && length > bestLength) {
          bestLength = length;
          bestPosition = position;
          if (length === maxLength || length >= 2048) break;
        }
      }
    }

    beginToken();
    if (bestPosition >= 0) {
      output.push(cursor - bestPosition - 1, bestLength - LZ_MIN_MATCH);
      // Index match boundaries rather than every copied character. The decoder
      // is unchanged; bounded indexing avoids rescanning large history blocks.
      addCandidate(cursor);
      if (bestLength > 3) addCandidate(cursor + bestLength - 3);
      cursor += bestLength;
    } else {
      flags |= 1 << flagBit;
      output.push(input.charCodeAt(cursor));
      addCandidate(cursor);
      cursor += 1;
    }
    finishToken();
  }

  if (flagBit !== 0) output[flagIndex] = flags;
  return stringFromCharCodes(output);
}

function decompressStorageText(input) {
  if (!input) return "";
  const output = [];
  let cursor = 0;
  while (cursor < input.length) {
    const flags = input.charCodeAt(cursor);
    cursor += 1;
    for (let bit = 0; bit < 16 && cursor < input.length; bit += 1) {
      if (flags & (1 << bit)) {
        output.push(input.charCodeAt(cursor));
        cursor += 1;
        continue;
      }
      if (cursor + 1 >= input.length) {
        throw new Error("Invalid compressed local state.");
      }
      const distance = input.charCodeAt(cursor) + 1;
      const length = input.charCodeAt(cursor + 1) + LZ_MIN_MATCH;
      cursor += 2;
      if (distance > output.length) {
        throw new Error("Invalid compressed local state distance.");
      }
      for (let offset = 0; offset < length; offset += 1) {
        output.push(output[output.length - distance]);
      }
    }
  }
  return stringFromCharCodes(output);
}

function encodeDashboardSnapshotsForStorage(bookId, snapshots) {
  const entries = Object.values(snapshots ?? {})
    .filter((snapshot) => snapshot && typeof snapshot === "object")
    .sort((left, right) => String(left.date ?? "").localeCompare(String(right.date ?? "")));
  if (!entries.length) return {};

  const keys = [...new Set(entries.flatMap((snapshot) => [
    ...Object.keys(snapshot.statuses ?? {}),
    ...Object.keys(snapshot.enteredAt ?? {}),
  ]))];
  const keyIndexes = new Map(keys.map((key, index) => [key, index]));
  const times = [...new Set(entries.flatMap((snapshot) => {
    return Object.values(snapshot.enteredAt ?? {})
      .filter((value) => typeof value === "string");
  }))];
  const timeIndexes = new Map(times.map((value, index) => [value, index]));

  return {
    __senseVocabSnapshotEncoding: 1,
    keys,
    times,
    rows: entries.map((snapshot) => ({
      id: snapshot.id ?? `${bookId}:${snapshot.date ?? ""}`,
      bookId: snapshot.bookId ?? bookId,
      date: snapshot.date ?? null,
      observedAt: snapshot.observedAt ?? null,
      version: snapshot.version ?? DASHBOARD_DATA_VERSION,
      quality: snapshot.quality ?? "exact",
      statuses: Object.entries(snapshot.statuses ?? {}).flatMap(([key, status]) => {
        const keyIndex = keyIndexes.get(key);
        if (keyIndex === undefined) return [];
        const code = STORAGE_STATUS_CODES[status];
        return [[keyIndex, code === undefined ? status : code]];
      }),
      enteredAt: Object.entries(snapshot.enteredAt ?? {}).flatMap(([key, value]) => {
        const keyIndex = keyIndexes.get(key);
        const timeIndex = timeIndexes.get(value);
        if (keyIndex === undefined || timeIndex === undefined) return [];
        return [[keyIndex, timeIndex]];
      }),
    })),
  };
}

function decodeDashboardSnapshotsFromStorage(encoded) {
  if (
    !encoded ||
    encoded.__senseVocabSnapshotEncoding !== 1 ||
    !Array.isArray(encoded.keys) ||
    !Array.isArray(encoded.rows)
  ) return encoded;

  const keys = encoded.keys;
  const times = Array.isArray(encoded.times) ? encoded.times : [];
  return Object.fromEntries(encoded.rows.map((row) => {
    const statuses = Object.fromEntries((Array.isArray(row.statuses) ? row.statuses : [])
      .flatMap(([keyIndex, code]) => {
        const key = keys[keyIndex];
        if (typeof key !== "string") return [];
        return [[key, typeof code === "number" ? STORAGE_STATUS_BY_CODE[code] ?? "new" : code]];
      }));
    const enteredAt = Object.fromEntries((Array.isArray(row.enteredAt) ? row.enteredAt : [])
      .flatMap(([keyIndex, timeIndex]) => {
        const key = keys[keyIndex];
        const time = times[timeIndex];
        if (typeof key !== "string" || typeof time !== "string") return [];
        return [[key, time]];
      }));
    const snapshot = {
      id: row.id,
      bookId: row.bookId,
      date: row.date,
      observedAt: row.observedAt,
      version: row.version,
      statuses,
      enteredAt,
      quality: row.quality,
    };
    return [snapshot.id ?? `${snapshot.bookId}:${snapshot.date}`, snapshot];
  }));
}

function encodeLocalStorageScope(scope, bookId) {
  return {
    ...scope,
    dashboardSnapshots: encodeDashboardSnapshotsForStorage(
      bookId,
      scope.dashboardSnapshots,
    ),
  };
}

function encodeLocalStorageState(candidate) {
  const compact = compactLocalState(candidate);
  const activeId = compact.activeBookId;
  const bookStates = Object.fromEntries(
    Object.entries(compact.bookStates ?? {}).map(([bookId, bookState]) => {
      return [bookId, encodeLocalStorageScope(bookState, bookId)];
    }),
  );
  const activeScope = encodeLocalStorageScope(compact, activeId);
  return {
    ...compact,
    ...activeScope,
    bookStates,
    __senseVocabStorageFormat: 2,
  };
}

function decodeLocalStorageState(value) {
  if (!value || typeof value !== "object" || value.__senseVocabStorageFormat !== 2) {
    return value;
  }
  const decoded = { ...value };
  delete decoded.__senseVocabStorageFormat;
  const activeId = decoded.activeBookId;
  const decodeScope = (scope) => ({
    ...scope,
    dashboardSnapshots: decodeDashboardSnapshotsFromStorage(scope.dashboardSnapshots),
  });
  decoded.bookStates = Object.fromEntries(
    Object.entries(decoded.bookStates ?? {}).map(([bookId, bookState]) => {
      return [bookId, decodeScope(bookState)];
    }),
  );
  return decodeScope(decoded, activeId);
}

function decodeStorageValue(raw) {
  if (typeof raw !== "string" || !raw) return null;
  const json = raw.startsWith(LOCAL_STORAGE_COMPRESSION_PREFIX)
    ? decompressStorageText(raw.slice(LOCAL_STORAGE_COMPRESSION_PREFIX.length))
    : raw;
  return decodeLocalStorageState(JSON.parse(json));
}

function serializeLocalState(candidate) {
  const encoded = encodeLocalStorageState(candidate);
  const json = JSON.stringify(encoded);
  if (json.length < 256000) return json;
  // The existing reader (including older deployed clients) supports svlz1.
  // Replace atomically; quota failure leaves the previous complete value intact.
  const packed = LOCAL_STORAGE_COMPRESSION_PREFIX + compressStorageText(json);
  return packed.length < json.length ? packed : json;
}

function accountStorageKey(userId) {
  return `${ACCOUNT_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function requestedWordId() {
  return new URL(window.location.href).searchParams.get("word");
}

function applyWordDeepLink() {
  const requestedBook = new URL(window.location.href).searchParams.get("book");
  if (requestedBook && requestedBook !== activeBookId() && bookById.has(requestedBook)) {
    activateBookScope(requestedBook);
  }
  const wordId = requestedWordId();
  if (!wordId || !wordById.has(wordId)) return false;
  // Account/bootstrap scope switches can re-apply the URL while the card is
  // already open. Do not replace the original return surface with "study";
  // otherwise closing a read-only deep link leaves the user on a hidden card.
  const sameOpenCard = state.view === "study" &&
    state.wordBrowse?.wordId === wordId;
  if (!sameOpenCard) {
    wordDeepLinkReturnView = ["home", "word-list"].includes(state.view)
      ? state.view
      : "home";
  }
  state.wordBrowse = { wordId };
  state.view = "study";
  return true;
}

function clearWordDeepLink() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("word")) return;
  url.searchParams.delete("word");
  url.searchParams.delete("book");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function stateHasLearningData(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  if (candidate.bookStates && typeof candidate.bookStates === "object") {
    return Object.values(candidate.bookStates).some(stateHasLearningData);
  }
  return Boolean(
    candidate.plan ||
    (Array.isArray(candidate.introducedWords) && candidate.introducedWords.length) ||
    Object.keys(candidate.progress ?? {}).length ||
    Object.keys(candidate.activityLog ?? {}).length ||
    Object.keys(candidate.confusionLinks ?? {}).length ||
    (Array.isArray(candidate.studyWindows) && candidate.studyWindows.length) ||
    (
      candidate.session &&
      typeof candidate.session === "object" &&
      (
        Number(candidate.session.currentIndex) > 0 ||
        Boolean(candidate.session.revealed) ||
        (Array.isArray(candidate.session.queue) && candidate.session.queue.length > 0 &&
          candidate.session.queue.some((card) => (card?.confirmedKeys?.length ?? 0) > 0))
      )
    ),
  );
}

function stableStateStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStateStringify).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) => {
    return `${JSON.stringify(key)}:${stableStateStringify(value[key])}`;
  }).join(",")}}`;
}

function stateSignature(candidate) {
  const normalized = normalizeRootState(cloneSerializable(candidate ?? {}));
  Object.values(normalized.bookStates).forEach((bookState) => {
    bookState.view = "home";
    bookState.wordBrowse = null;
  });
  const value = stableStateStringify(normalized);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const SYNC_DELTA_SCALARS = Object.freeze([
  "plan",
  "learningDayCounter",
  "wordListSort",
  "dataVersion",
]);
const SYNC_DELTA_MAPS = Object.freeze([
  "progress",
  "activityLog",
  "planTargetHistory",
  "dashboardEvents",
  "dashboardSnapshots",
  "confusionLinks",
]);
const SYNC_DELTA_SYNC_MAPS = Object.freeze([
  "introducedWords",
  ...SYNC_DELTA_MAPS,
]);

function syncRecordEqual(left, right) {
  if (left === right) return true;
  if (!left || !right || Boolean(left.deleted) !== Boolean(right.deleted)) {
    return false;
  }
  const leftVector = left.vector && typeof left.vector === "object"
    ? left.vector
    : {};
  const rightVector = right.vector && typeof right.vector === "object"
    ? right.vector
    : {};
  const leftKeys = Object.keys(leftVector);
  const rightKeys = Object.keys(rightVector);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => leftVector[key] === rightVector[key]);
}

function stateBookScopes(candidate) {
  if (candidate?.bookStates && typeof candidate.bookStates === "object" &&
      !Array.isArray(candidate.bookStates)) {
    const normalized = normalizeRootState(candidate);
    return normalized.bookStates ?? {};
  }
  return { [DEFAULT_BOOK_ID]: candidate ?? {} };
}

function buildSyncDelta(previousCandidate, nextCandidate, { includeSession = false } = {}) {
  const previousScopes = stateBookScopes(previousCandidate);
  const nextScopes = stateBookScopes(nextCandidate);
  const bookIds = new Set([
    ...Object.keys(previousScopes),
    ...Object.keys(nextScopes),
  ]);
  const books = {};

  bookIds.forEach((bookId) => {
    const previous = previousScopes[bookId] ?? {};
    const next = nextScopes[bookId] ?? {};
    const bookPatch = {};
    const scalars = {};
    const replacements = {};
    const maps = {};
    const syncRecords = {};

    SYNC_DELTA_SCALARS.forEach((name) => {
      if (stableStateStringify(previous[name]) !== stableStateStringify(next[name])) {
        scalars[name] = cloneSerializable(next[name]);
      }
    });
    if (includeSession &&
        stableStateStringify(previous.session) !== stableStateStringify(next.session)) {
      scalars.session = cloneSerializable(next.session);
    }
    if (Object.keys(scalars).length) bookPatch.scalars = scalars;

    ["introducedWords", "studyWindows"].forEach((name) => {
      if (stableStateStringify(previous[name]) !== stableStateStringify(next[name])) {
        replacements[name] = cloneSerializable(next[name] ?? (name === "studyWindows" ? [] : []));
      }
    });
    if (Object.keys(replacements).length) bookPatch.replacements = replacements;

    SYNC_DELTA_MAPS.forEach((name) => {
      const previousMap = previous[name] && typeof previous[name] === "object"
        ? previous[name]
        : {};
      const nextMap = next[name] && typeof next[name] === "object"
        ? next[name]
        : {};
      const upsert = {};
      const deleted = [];
      const keys = new Set([
        ...Object.keys(previousMap),
        ...Object.keys(nextMap),
      ]);
      const previousRecords = previous._sync?.records?.[name] ?? {};
      const nextRecords = next._sync?.records?.[name] ?? {};
      keys.forEach((key) => {
        const previousHas = Object.prototype.hasOwnProperty.call(previousMap, key);
        const nextHas = Object.prototype.hasOwnProperty.call(nextMap, key);
        if (previousHas && nextHas) {
          // Sync vectors are intentionally cheap to compare and are updated
          // for every durable record mutation. Avoid serializing thousands of
          // unchanged progress objects on every background sync.
          if (previousRecords[key] && nextRecords[key] &&
              syncRecordEqual(previousRecords[key], nextRecords[key])) return;
          if (stableStateStringify(previousMap[key]) ===
              stableStateStringify(nextMap[key])) return;
        }
        if (nextHas) upsert[key] = cloneSerializable(nextMap[key]);
        else if (previousHas) deleted.push(key);
      });
      if (Object.keys(upsert).length || deleted.length) {
        maps[name] = { upsert, delete: deleted };
      }
    });
    if (Object.keys(maps).length) bookPatch.maps = maps;

    const previousSync = previous._sync ?? {};
    const nextSync = next._sync ?? {};
    if (stableStateStringify(previousSync.counters) !== stableStateStringify(nextSync.counters)) {
      bookPatch.sync = {
        ...(bookPatch.sync ?? {}),
        counters: cloneSerializable(nextSync.counters ?? {}),
      };
    }
    const scalarSyncNames = includeSession
      ? [...SYNC_DELTA_SCALARS, "session"]
      : SYNC_DELTA_SCALARS;
    scalarSyncNames.forEach((name) => {
      const previousRecord = previousSync.records?.[name];
      const nextRecord = nextSync.records?.[name];
      if (stableStateStringify(previousRecord) !== stableStateStringify(nextRecord) &&
          nextRecord) {
        syncRecords[name] = cloneSerializable(nextRecord);
      }
    });
    SYNC_DELTA_SYNC_MAPS.forEach((name) => {
      const previousRecords = previousSync.records?.[name] ?? {};
      const nextRecords = nextSync.records?.[name] ?? {};
      const changedRecords = {};
      const keys = new Set([
        ...Object.keys(previousRecords),
        ...Object.keys(nextRecords),
      ]);
      keys.forEach((key) => {
        const nextRecord = nextRecords[key];
        if (previousRecords[key] && nextRecord &&
            syncRecordEqual(previousRecords[key], nextRecord)) return;
        if (stableStateStringify(previousRecords[key]) ===
            stableStateStringify(nextRecord)) return;
        if (nextRecord) changedRecords[key] = cloneSerializable(nextRecord);
      });
      if (Object.keys(changedRecords).length) syncRecords[name] = changedRecords;
    });
    if (Object.keys(syncRecords).length) {
      bookPatch.sync = {
        ...(bookPatch.sync ?? {}),
        records: syncRecords,
      };
    }

    if (Object.keys(bookPatch).length) books[bookId] = bookPatch;
  });

  if (!Object.keys(books).length) return null;
  return {
    version: 1,
    activeBookId: nextCandidate?.activeBookId ?? DEFAULT_BOOK_ID,
    books,
  };
}

function recoveryStateSignature(candidate) {
  const normalized = normalizeRootState(cloneSerializable(candidate ?? {}));
  const recoveryState = {
    schemaVersion: normalized.schemaVersion,
    bookStates: Object.fromEntries(
      Object.entries(normalized.bookStates).map(([bookId, bookState]) => {
        return [bookId, {
          plan: bookState.plan,
          introducedWords: bookState.introducedWords,
          progress: bookState.progress,
          activityLog: bookState.activityLog,
          planTargetHistory: bookState.planTargetHistory,
          studyWindows: bookState.studyWindows,
          dashboardEvents: bookState.dashboardEvents,
          dashboardSnapshots: bookState.dashboardSnapshots,
          confusionLinks: bookState.confusionLinks,
        }];
      }),
    ),
  };
  const value = stableStateStringify(recoveryState);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function applyStateToStorage(storageKey, nextState = null, options = {}) {
  if (tutorialRuntime?.active) {
    tutorialRuntime.realStorageKey = storageKey;
    tutorialRuntime.realRootState = nextState
      ? normalizeRootState(cloneSerializable(nextState))
      : loadState(storageKey);
    return true;
  }
  const navigation = options.preserveNavigation ? captureActiveNavigation() : null;
  activeStorageKey = storageKey;
  dirtyDashboardSnapshots = new Map();
  rootState = nextState
    ? normalizeRootState(cloneSerializable(nextState))
    : loadState(storageKey);
  if (nextState) markAllDashboardSnapshotsDirty(rootState);
  if (navigation && bookById.has(navigation.bookId)) {
    rootState.activeBookId = navigation.bookId;
  }
  activateBookScope(rootState.activeBookId);
  restoreActiveNavigation(navigation);
  applyWordDeepLink();
  const persisted = saveState({
    notify: false,
    stampSync: !nextState,
    syncRelevant: !nextState,
    persistAllSnapshots: Boolean(nextState),
  });
  render();
  window.dispatchEvent(new CustomEvent("sensevocab:scope-changed", {
    detail: { storageKey: activeStorageKey },
  }));
  return persisted;
}

function cloudStateSnapshot() {
  if (tutorialRuntime?.active) {
    return compactStateSessions(
      cloneSerializable(tutorialRuntime.realRootState),
      { forCloud: true },
    );
  }
  const snapshot = compactStateSessions(cloneSerializable(rootState), { forCloud: true });
  if (!isPersistenceSafe()) return snapshot;
  const activeScope = {
    ...cloneSerializable(state),
    view: "home",
    wordBrowse: null,
  };
  snapshot.bookStates[activeBookId()] = activeScope;
  // The normalized Supabase tables and the existing admin analytics continue
  // to receive a materialized view of the active book.  The authoritative
  // multi-book snapshot remains in bookStates.
  Object.assign(snapshot, activeScope);
  return snapshot;
}

function captureActiveNavigation() {
  if (!state || !rootState) return null;
  return {
    bookId: activeBookId(),
    view: ["home", "study", "word-list", "dashboard", "settings", "data"].includes(state.view)
      ? state.view
      : "home",
    wordBrowse: state.wordBrowse
      ? cloneSerializable(state.wordBrowse)
      : null,
  };
}

function restoreActiveNavigation(navigation) {
  if (!navigation || !state) return;
  state.wordBrowse = navigation.wordBrowse &&
    wordById.has(navigation.wordBrowse.wordId)
    ? navigation.wordBrowse
    : null;
  state.view = navigation.view;
  if (state.view === "study" && !state.wordBrowse && !state.session) {
    state.view = "home";
  }
  if (state.view === "word-list") {
    state.wordBrowse = null;
  }
}

window.SenseVocabApp = {
  guestStorageKey: STORAGE_KEY,
  accountStorageKey,
  getActiveStorageKey: () => activeStorageKey,
  decodeStorageValue,
  getState: cloudStateSnapshot,
  getGuestState: () => loadState(STORAGE_KEY),
  getAccountState: (userId) => loadState(accountStorageKey(userId)),
  hasLearningData: stateHasLearningData,
  isPersistenceSafe,
  stateSignature,
  buildSyncDelta,
  recoveryStateSignature,
  mergeStates: (localState, remoteState) => {
    if (!window.SenseVocabSync) return cloneSerializable(remoteState);
    const merged = window.SenseVocabSync.mergeStates(localState, remoteState);
    const referenceState = normalizeRootState(cloneSerializable(localState ?? {}));
    const repaired = repairDerivedRootState(merged, { referenceState }).state;
    if (stableStateStringify(merged) !== stableStateStringify(repaired)) {
      window.SenseVocabSync.stampChanges(repaired, merged);
    }
    return repaired;
  },
  repairDerivedData: repairActiveDerivedData,
  prepareIndependentMergeState: (candidate, baseline = null) => {
    if (!window.SenseVocabSync) return cloneSerializable(candidate);
    return window.SenseVocabSync.prepareIndependentMergeState(candidate, baseline);
  },
  hasIndependentChanges: (candidate, baseline) => {
    if (!window.SenseVocabSync) return false;
    return window.SenseVocabSync.hasIndependentChanges(candidate, baseline);
  },
  getCurrentWordContext: () => currentFeedbackContext(),
  activateGuest: (options = {}) => applyStateToStorage(STORAGE_KEY, null, options),
  activateAccount: (userId, nextState = null) => {
    return applyStateToStorage(accountStorageKey(userId), nextState, {
      preserveNavigation: true,
    });
  },
  isTutorialActive: () => Boolean(tutorialRuntime?.active),
  isActiveStatePersisted: () => {
    const { parsed } = readStoredState(activeStorageKey);
    if (!parsed) return false;
    return stableStateStringify(compactLocalState(parsed)) ===
      stableStateStringify(compactLocalState(rootState));
  },
  replaceActiveState: (nextState, options = {}) => {
    if (tutorialRuntime?.active) {
      tutorialRuntime.realRootState = normalizeRootState(cloneSerializable(nextState));
      return true;
    }
    const navigation = options.preserveNavigation
      ? captureActiveNavigation()
      : null;
    rootState = normalizeRootState(cloneSerializable(nextState));
    dirtyDashboardSnapshots = new Map();
    markAllDashboardSnapshotsDirty(rootState);
    if (navigation && bookById.has(navigation.bookId)) {
      rootState.activeBookId = navigation.bookId;
    }
    activateBookScope(rootState.activeBookId);
    restoreActiveNavigation(navigation);
    applyWordDeepLink();
    const persisted = saveState({
      notify: options.notify !== false,
      stampSync: options.stampSync !== false,
      // Replacing the active state is normally a real data mutation, even
      // when the caller deliberately avoids stamping a sync revision. Remote
      // reconciliation paths opt out explicitly; local recovery and imports
      // must still schedule a cloud verification/upload.
      syncRelevant: options.syncRelevant ?? true,
      persistAllSnapshots: true,
    });
    render();
    return persisted;
  },
  removeAccountCache: (userId) => {
    const storageKey = accountStorageKey(userId);
    localStorage.removeItem(storageKey);
    removeDashboardSnapshotSidecars(storageKey);
  },
};

function currentDate() {
  return todayKey();
}

function scheduleMidnightRefresh() {
  if (midnightRefreshTimer) clearTimeout(midnightRefreshTimer);
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    100,
  );
  midnightRefreshTimer = setTimeout(() => {
    if (state) {
      render();
      saveState();
    }
    scheduleMidnightRefresh();
  }, Math.max(100, nextMidnight.getTime() - now.getTime()));
}

function currentPlanDate(dayOffset = 0) {
  return addDays(currentDate(), dayOffset);
}

function ensureTodaySession() {
  const date = currentDate();
  const keepOpenCrossDaySession = ["study", "confusion"].includes(state.view) &&
    Boolean(activeStudyWindow()) &&
    state.session &&
    state.session.date !== date;

  if (!state.session || (state.session.date !== date && !keepOpenCrossDaySession)) {
    state.session = {
      date,
      queue: [],
      currentIndex: 0,
      revealed: false,
      cardPhase: "hidden",
      baseNewAdded: false,
      baseCompleted: false,
      activeBatchType: null,
      activePlanDate: currentPlanDate(),
      extraBatches: 0,
      advanceBatches: 0,
      advanceShiftCommitted: false,
      reinforcementAdded: false,
      reinforcedKeys: [],
      reviewPromotedKeys: [],
      activeLearningDay: null,
      baseLearningDay: null,
      historyView: null,
      snapshotTimingVersion: 2,
    };
  }

  if (!["hidden", "select", "examples"].includes(state.session.cardPhase)) {
    state.session.cardPhase = state.session.revealed ? "select" : "hidden";
  }
  state.session.queue = Array.isArray(state.session.queue) ? state.session.queue : [];
  state.session.currentIndex = Math.min(
    Math.max(0, state.session.currentIndex ?? 0),
    state.session.queue.length,
  );
  state.session.reinforcedKeys = Array.isArray(state.session.reinforcedKeys)
    ? state.session.reinforcedKeys.filter(isKnownSenseKey)
    : [];
  state.session.reviewPromotedKeys = Array.isArray(state.session.reviewPromotedKeys)
    ? state.session.reviewPromotedKeys.filter(isKnownSenseKey)
    : [];
  if (typeof state.session.reinforcementAdded !== "boolean") {
    state.session.reinforcementAdded = state.session.queue.some(
      (card) => card.type === "reinforcement" || card.type === "new-review",
    );
  }
  state.session.advanceBatches = Number.isFinite(state.session.advanceBatches)
    ? state.session.advanceBatches
    : 0;
  state.session.advanceShiftCommitted = Boolean(state.session.advanceShiftCommitted);
  state.session.activeLearningDay = Number.isFinite(state.session.activeLearningDay)
    ? state.session.activeLearningDay
    : null;
  if (
    !Number.isFinite(state.session.activeLearningDay) &&
    state.session.baseNewAdded &&
    state.learningDayCounter > 0
  ) {
    state.session.activeLearningDay = state.learningDayCounter;
  }
  state.session.baseLearningDay = Number.isFinite(state.session.baseLearningDay)
    ? state.session.baseLearningDay
    : state.session.activeLearningDay;
  if (!state.session.historyView || typeof state.session.historyView !== "object") {
    state.session.historyView = null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.session.activePlanDate ?? "")) {
    const pendingAdvanceOffset = state.session.activeBatchType === "advance" &&
      !state.session.advanceShiftCommitted
      ? 1
      : 0;
    state.session.activePlanDate = addDays(state.session.date, pendingAdvanceOffset);
  }

  return state.session;
}

function beginLearningDay(mode) {
  const session = ensureTodaySession();
  if (mode === "extra" && Number.isFinite(session.activeLearningDay)) {
    return session.activeLearningDay;
  }
  if (
    mode === "planned" &&
    Number.isFinite(session.baseLearningDay)
  ) {
    session.activeLearningDay = session.baseLearningDay;
    return session.activeLearningDay;
  }

  state.learningDayCounter += 1;
  session.activeLearningDay = state.learningDayCounter;
  session.reviewPromotedKeys = [];
  if (mode === "planned") {
    session.baseLearningDay = session.activeLearningDay;
  }
  const activity = activityForDate();
  activity.learningDays = [
    ...new Set([...activity.learningDays, session.activeLearningDay]),
  ];
  return session.activeLearningDay;
}

function activeLearningDay() {
  const session = ensureTodaySession();
  return session.activeLearningDay ?? state.learningDayCounter + 1;
}

function upcomingLearningDay() {
  const session = ensureTodaySession();
  return session.activeLearningDay ?? state.learningDayCounter + 1;
}

function activeStudyDate() {
  return ensureTodaySession().activePlanDate ?? currentPlanDate();
}

function hasPlan() {
  return Boolean(state?.plan?.dailyTarget);
}

function completedWordCount() {
  return state.introducedWords.length;
}

function remainingWordCount() {
  return Math.max(0, words.length - completedWordCount());
}

function progressDayCount(dailyTarget = state.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET) {
  if (!dailyTarget) return 0;
  const baseWords = state.plan?.progressBaseWords ?? 0;
  const baseDays = state.plan?.progressBaseDays ?? 0;
  return Math.max(0, baseDays + (completedWordCount() - baseWords) / dailyTarget);
}

function actualDayCount() {
  if (!state.plan?.startedOn) return 0;
  return daysBetween(state.plan.startedOn, currentDate()) + 1;
}

function scheduleDeltaDays(dailyTarget = state.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET) {
  if (!hasPlan() || !dailyTarget) return 0;
  return progressDayCount(dailyTarget) - actualDayCount();
}

function updatePlanDrift() {
  if (!hasPlan()) return;
  state.plan.advancedDays = scheduleDeltaDays();
}

function formatDayValue(value) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function dueReviewKeys(learningDay = upcomingLearningDay()) {
  return Object.entries(state.progress)
    .filter(([, progress]) => {
      const pending = progress.status === SENSE_STATUS.REINFORCE ||
        progress.status === SENSE_STATUS.REVIEW;
      return pending && (
        !Number.isFinite(progress.dueLearningDay) ||
        progress.dueLearningDay <= learningDay
      );
    })
    .map(([key]) => key)
    .filter(isKnownSenseKey);
}

function planStartOffset() {
  const session = ensureTodaySession();
  return session.baseCompleted ? 1 : 0;
}

function plannedCompletionDate(dailyTarget = state.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET) {
  const remaining = remainingWordCount();
  if (!dailyTarget || remaining === 0) return currentDate();

  const daysNeeded = Math.ceil(remaining / dailyTarget);
  return addDays(currentDate(), planStartOffset() + daysNeeded - 1);
}

function nextNewWords(limit) {
  if (limit <= 0) return [];
  const introduced = new Set(state.introducedWords);
  const pendingIntroduced = words.filter((word) => {
    return introduced.has(word.id) && pendingNewSenseKeysForWord(word).length > 0;
  });
  const untouched = words.filter((word) => !introduced.has(word.id));
  return [...pendingIntroduced, ...untouched].slice(0, limit);
}

function pendingNewSenseKeysForWord(word) {
  return allSenseKeysForWord(word).filter((key) => {
    return state.progress[key]?.status === SENSE_STATUS.NEW;
  });
}

function availableNewWordCount() {
  return nextNewWords(Number.MAX_SAFE_INTEGER).length;
}

function sortSenseKeysByImportance(keys) {
  return keys.filter(isKnownSenseKey).sort((left, right) => {
    return getSense(right).sense.importance - getSense(left).sense.importance;
  });
}

function buildReviewCards(reviewLearningDay = upcomingLearningDay()) {
  const reviewGroups = new Map();

  dueReviewKeys(reviewLearningDay).forEach((key) => {
    const { wordId } = splitSenseKey(key);
    const group = reviewGroups.get(wordId) ?? [];
    group.push(key);
    reviewGroups.set(wordId, group);
  });

  return Array.from(reviewGroups.entries()).map(([wordId, keys]) => {
    return createStudyCard("review", wordId, keys);
  });
}

function buildNewCards(limit, type) {
  return nextNewWords(limit)
    .map((word) => {
      const keys = state.introducedWords.includes(word.id)
        ? pendingNewSenseKeysForWord(word)
        : allSenseKeysForWord(word);
      return createStudyCard(type, word.id, keys);
    })
    .filter((card) => card.senseKeys.length > 0);
}

function buildStudyQueue({
  includeReviews,
  newLimit,
  newType,
  reviewLearningDay = upcomingLearningDay(),
}) {
  const reviewCards = includeReviews ? buildReviewCards(reviewLearningDay) : [];
  const newCards = buildNewCards(newLimit, newType);
  const reviewsByWord = new Map(reviewCards.map((card) => [card.wordId, card]));
  const standaloneNewCards = [];
  newCards.forEach((newCard) => {
    const reviewCard = reviewsByWord.get(newCard.wordId);
    if (!reviewCard) {
      standaloneNewCards.push(newCard);
      return;
    }
    reviewCard.newSenseKeys = sortSenseKeysByImportance(newCard.activeSenseKeys);
    reviewCard.activeSenseKeys = sortSenseKeysByImportance([
      ...new Set([...reviewCard.activeSenseKeys, ...newCard.activeSenseKeys]),
    ]);
    refreshCardDisplayKeys(reviewCard);
  });
  return [...reviewCards, ...standaloneNewCards];
}

function buildReinforcementCards(reinforcementLearningDay = activeLearningDay()) {
  const session = ensureTodaySession();
  const alreadyReinforced = new Set(session.reinforcedKeys);
  const groups = new Map();

  Object.entries(state.progress).forEach(([key, progress]) => {
    if (
      progress.status !== SENSE_STATUS.REINFORCE ||
      alreadyReinforced.has(key) ||
      (
        Number.isFinite(progress.dueLearningDay) &&
        progress.dueLearningDay > reinforcementLearningDay
      ) ||
      !isKnownSenseKey(key)
    ) return;
    const { wordId } = splitSenseKey(key);
    const keys = groups.get(wordId) ?? [];
    keys.push(key);
    groups.set(wordId, keys);
  });

  return Array.from(groups.entries()).map(([wordId, keys]) => {
    const card = createStudyCard("reinforcement", wordId, keys);
    card.confirmedKeys = session.reviewPromotedKeys.filter((key) => {
      return splitSenseKey(key).wordId === wordId &&
        state.progress[key]?.status === SENSE_STATUS.REVIEW;
    });
    return card;
  });
}

function appendReinforcementStage() {
  const session = ensureTodaySession();
  if (session.reinforcementAdded) return false;

  session.reinforcementAdded = true;
  const cards = buildReinforcementCards(activeLearningDay());
  session.queue.push(...cards);
  return cards.length > 0;
}

function currentCard() {
  if (state.wordBrowse?.wordId && wordById.has(state.wordBrowse.wordId)) {
    const word = wordById.get(state.wordBrowse.wordId);
    return createStudyCard("browse", word.id, allSenseKeysForWord(word));
  }
  const session = ensureTodaySession();
  return session.queue[session.currentIndex] ?? null;
}

function isHistoryView() {
  return Boolean(ensureTodaySession().historyView || state.wordBrowse);
}

function currentWord() {
  const card = currentCard();
  return card ? wordById.get(card.wordId) : null;
}

function currentFeedbackContext() {
  if (!state || state.view !== "study") return null;
  const card = currentCard();
  const word = currentWord();
  if (!card || !word) return null;
  return {
    source: "study",
    bookId: activeBookId(),
    bookName: bookDisplayName(),
    wordId: word.id,
    wordText: word.word,
    senses: word.senses.map((sense, index) => ({
      id: sense.id,
      index: index + 1,
      pos: sense.pos,
      meaning: sense.meaning,
    })),
    cardType: card.type,
    capturedAt: new Date().toISOString(),
  };
}

function currentCardKey() {
  const card = currentCard();
  const session = ensureTodaySession();
  if (!card) return null;

  if (state.wordBrowse) return `browse:${card.wordId}`;
  return `${session.date}:${session.currentIndex}:${card.wordId}`;
}

function hasUnfinishedQueue() {
  const session = ensureTodaySession();
  return session.queue.length > 0 && session.currentIndex < session.queue.length;
}

function visibleSenses() {
  const card = currentCard();
  if (!card) return [];

  const confirmed = new Set(card.confirmedKeys ?? []);
  const active = new Set(activeSenseKeysForCard(card));

  return refreshCardDisplayKeys(card).senseKeys
    .filter(isKnownSenseKey)
    .sort((left, right) => {
      const leftGroup = confirmed.has(left) ? 2 : isMastered(left) ? 1 : 0;
      const rightGroup = confirmed.has(right) ? 2 : isMastered(right) ? 1 : 0;
      if (leftGroup !== rightGroup) return leftGroup - rightGroup;
      if (leftGroup === 2) {
        return card.confirmedKeys.indexOf(left) - card.confirmedKeys.indexOf(right);
      }
      return getSense(right).sense.importance - getSense(left).sense.importance;
    })
    .map((key) => {
      const { word, sense } = getSense(key);
      return {
        key,
        word,
        sense,
        isActive: active.has(key),
        isConfirmed: confirmed.has(key),
        isMastered: isMastered(key),
      };
    });
}

function definitionSentence(sense) {
  return sense.definitionSentence ? `释义：${sense.definitionSentence}` : "";
}

function definitionTranslation(sense) {
  return sense.definitionZh ? `译文：${sense.definitionZh}` : "";
}

function exampleSentence(sense) {
  return sense.example ? `例句：${sense.example}` : "";
}

function exampleTranslation(sense) {
  return sense.exampleZh ? `译文：${sense.exampleZh}` : "";
}

function normalizeIpa(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

function pronunciationIdentity(value) {
  let normalized = normalizeIpa(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ɹ", "r")
    .replaceAll("ɚ", "ər")
    .replaceAll("ɝ", "ɜr")
    .replace(/[.()\sː]/g, "");
  const vowelNuclei = normalized.match(/[aeiouyɑɐɒæəɘɜɞɛɤɪɨɔɵœøɶʊʉʌɯ]+/g) ?? [];
  if (vowelNuclei.length <= 1) normalized = normalized.replace(/[ˈˌ]/g, "");
  return normalized;
}

function audioRecordingsForWord(word) {
  const recordings = [];
  const byUrl = new Map();
  const byPronunciation = new Map();

  word?.senses?.forEach((sense) => {
    const sourceUrl = safeAudioUrl(sense.audio);
    if (!sourceUrl) return;
    const ipa = normalizeIpa(sense.ipa);
    const pronunciationKey = ipa
      ? pronunciationIdentity(ipa)
      : `url:${sourceUrl}`;
    const existing = byUrl.get(sourceUrl) ?? byPronunciation.get(pronunciationKey);
    if (existing) {
      if (sense.pos && !existing.positions.includes(sense.pos)) {
        existing.positions.push(sense.pos);
      }
      byUrl.set(sourceUrl, existing);
      byPronunciation.set(pronunciationKey, existing);
      return;
    }

    const recording = {
      sourceUrl,
      sense,
      ipa,
      positions: sense.pos ? [sense.pos] : [],
    };
    byUrl.set(sourceUrl, recording);
    byPronunciation.set(pronunciationKey, recording);
    recordings.push(recording);
  });

  return recordings;
}

function progressFor(key) {
  if (!state.progress[key]) {
    state.progress[key] = {
      status: SENSE_STATUS.NEW,
      misses: 0,
      dueDate: null,
      firstSeen: null,
      lastSeen: null,
      masteredOn: null,
      firstSeenActual: null,
      lastSeenActual: null,
      masteredOnActual: null,
      lastLearningDay: null,
      dueLearningDay: null,
      statusEnteredAt: null,
      updatedAt: null,
    };
  }

  return state.progress[key];
}

function isMastered(key) {
  return progressFor(key).status === SENSE_STATUS.MASTERED;
}

function activeLearningCount() {
  return Object.values(state.progress).filter((progress) => {
    return progress.status === SENSE_STATUS.REINFORCE;
  }).length;
}

function dueWordCount(status, learningDay = upcomingLearningDay()) {
  return new Set(
    Object.entries(state.progress)
      .filter(([key, progress]) => {
        return isKnownSenseKey(key) &&
          progress.status === status &&
          (
            !Number.isFinite(progress.dueLearningDay) ||
            progress.dueLearningDay <= learningDay
          );
      })
      .map(([key]) => splitSenseKey(key).wordId),
  ).size;
}

function todayNewWordCount() {
  if (!hasPlan()) return 0;

  const session = ensureTodaySession();
  if (hasUnfinishedQueue()) {
    return new Set(
      session.queue
        .slice(session.currentIndex)
        .filter((card) => isNewLearningCard(card) || card.newSenseKeys?.length)
        .map((card) => card.wordId),
    ).size;
  }

  if (!session.baseNewAdded && !session.baseCompleted) {
    return Math.min(state.plan.dailyTarget, availableNewWordCount());
  }

  return 0;
}

function todayPlanCounts() {
  return {
    newWords: todayNewWordCount(),
    reinforceWords: dueWordCount(SENSE_STATUS.REINFORCE),
    reviewWords: dueWordCount(SENSE_STATUS.REVIEW),
  };
}

function membershipAllowsStudy() {
  return !membershipAccess.loggedIn ||
    membershipAccess.pending ||
    membershipAccess.active;
}

function cardProgressCategory(card) {
  if (card?.type === "review") return "review";
  if (card?.type === "reinforcement") return "reinforcement";
  if (["new", "extra", "advance"].includes(card?.type)) return "new";
  return null;
}

function cardProgressCategoryForKey(card, key) {
  if ((card?.newSenseKeys ?? []).includes(key)) return "new";
  return cardProgressCategory(card);
}

function currentQueueCounts() {
  const session = ensureTodaySession();
  const counts = {
    review: { completed: 0, total: 0 },
    new: { completed: 0, total: 0 },
    reinforcement: { completed: 0, total: 0 },
  };
  const progressIndex = Number.isInteger(session.historyView?.originIndex)
    ? session.historyView.originIndex
    : session.currentIndex;
  const progressPhase = session.historyView?.originPhase ??
    session.cardPhase ??
    (session.revealed ? "select" : "hidden");

  session.queue.forEach((card, index) => {
    const keys = activeSenseKeysForCard(card).filter(isKnownSenseKey);
    const confirmed = new Set(card.confirmedKeys ?? []);
    keys.forEach((key) => {
      const category = cardProgressCategoryForKey(card, key);
      if (!category) return;
      counts[category].total += 1;
      if (index < progressIndex ||
        (index === progressIndex && progressPhase === "examples") ||
        (index === progressIndex && confirmed.has(key))) {
        counts[category].completed += 1;
      }
    });
  });

  if (!session.reinforcementAdded) {
    const alreadyReinforced = new Set(session.reinforcedKeys);
    const learningDay = activeLearningDay();
    const dueReinforcementCount = Object.entries(state.progress).filter(
      ([key, progress]) => {
        return isKnownSenseKey(key) &&
          progress.status === SENSE_STATUS.REINFORCE &&
          !alreadyReinforced.has(key) &&
          (
            !Number.isFinite(progress.dueLearningDay) ||
            progress.dueLearningDay <= learningDay
          );
      },
    ).length;
    counts.reinforcement.total = Math.max(
      counts.reinforcement.total,
      dueReinforcementCount,
    );
  }

  return counts;
}

function currentStageWordProgress() {
  const session = ensureTodaySession();
  if (session.queue.length === 0) return { current: 0, total: 0 };

  const currentIndex = Math.min(
    Math.max(0, session.currentIndex),
    session.queue.length - 1,
  );
  const category = cardProgressCategory(session.queue[currentIndex]);
  if (!category) return { current: 0, total: 0 };

  const stageIndexes = session.queue
    .map((card, index) => cardProgressCategory(card) === category ? index : -1)
    .filter((index) => index >= 0);
  const stageIndex = stageIndexes.indexOf(currentIndex);
  return {
    current: stageIndex >= 0 ? stageIndex + 1 : 0,
    total: stageIndexes.length,
  };
}

function currentSenseProgress(counts) {
  return ["review", "new", "reinforcement"].reduce(
    (progress, category) => ({
      completed: progress.completed + counts[category].completed,
      total: progress.total + counts[category].total,
    }),
    { completed: 0, total: 0 },
  );
}

function studyButtonState() {
  if (!membershipAllowsStudy()) {
    return { label: "会员已到期", disabled: true };
  }
  if (!hasPlan()) {
    return { label: "开始学习", disabled: true };
  }

  const session = ensureTodaySession();
  const hasRemaining = availableNewWordCount() > 0;
  const hasDueReviews = dueReviewKeys().length > 0;

  if (hasUnfinishedQueue()) {
    return { label: "继续学习", disabled: false };
  }

  if (!session.baseNewAdded) {
    return {
      label: "开始学习",
      disabled: !hasRemaining && !hasDueReviews,
    };
  }

  if (!hasRemaining) {
    return { label: hasDueReviews ? "开始学习" : "全部完成", disabled: !hasDueReviews };
  }

  return { label: "增量学习", disabled: false };
}

function canStartAdvanceStudy() {
  if (
    !membershipAllowsStudy() ||
    !hasPlan() ||
    scheduleDeltaDays() > 0 ||
    availableNewWordCount() === 0
  ) {
    return false;
  }
  const session = ensureTodaySession();
  return session.baseCompleted && !hasUnfinishedQueue();
}

function uiTransitionTarget(scope) {
  if (scope === "reveal") return senseArea.hidden ? studyPanel : senseArea;
  if (scope === "card") return studyCardViewport ?? studyPanel;
  return appShell;
}

function getUiTransitionOrigin(target) {
  if (!(target instanceof Element)) return null;
  const rect = target.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
  const x = Math.min(viewportWidth, Math.max(0, rect.left + rect.width / 2));
  const y = Math.min(viewportHeight, Math.max(0, rect.top + rect.height / 2));
  const radius = Math.max(
    Math.hypot(x, y),
    Math.hypot(viewportWidth - x, y),
    Math.hypot(x, viewportHeight - y),
    Math.hypot(viewportWidth - x, viewportHeight - y),
  ) + 2;
  return {
    x: `${x}px`,
    y: `${y}px`,
    radius: `${radius}px`,
  };
}

function clearUiTransitionOrigin(root = document.documentElement) {
  root.style.removeProperty("--ui-transition-x");
  root.style.removeProperty("--ui-transition-y");
  root.style.removeProperty("--ui-transition-radius");
}

function cloneUiTransitionSurface(surface, { includeNavigation = false } = {}) {
  if (!(surface instanceof Element)) return null;
  const clone = surface === appShell
    ? surface.cloneNode(false)
    : surface.cloneNode(true);
  if (surface === appShell) {
    [...surface.children]
      .filter((child) => !child.hidden)
      .forEach((child) => clone.append(child.cloneNode(true)));
  }
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");
  clone.classList.add("ui-transition-snapshot");
  clone.style.viewTransitionName = "none";
  if (includeNavigation && mainAppNav) {
    const navigationClone = mainAppNav.cloneNode(true);
    navigationClone.removeAttribute("id");
    navigationClone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    navigationClone.setAttribute("aria-hidden", "true");
    navigationClone.setAttribute("inert", "");
    navigationClone.classList.add("ui-transition-navigation-snapshot");
    navigationClone.style.viewTransitionName = "none";
    clone.append(navigationClone);
  }
  return clone;
}

function uiTransitionFrames(kind, scope, role = "incoming") {
  if (scope === "card") {
    const entering = role === "incoming";
    const direction = kind === "backward" ? -1 : 1;
    return entering
      ? [
        { transform: `translate3d(${direction * 18}%, 0, 0) scale(0.992)`, opacity: 0.22 },
        { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
      ]
      : [
        { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
        { transform: `translate3d(${direction * -10}%, 0, 0) scale(0.996)`, opacity: 0.1 },
      ];
  }
  if (scope === "page") {
    const entering = role === "incoming";
    if (kind === "backward") {
      return entering
        ? [
          { transform: "translate3d(-100%, 0, 0)", opacity: 0.86 },
          { transform: "translate3d(0, 0, 0)", opacity: 1 },
        ]
        : [
          { transform: "translate3d(0, 0, 0)", opacity: 1 },
          { transform: "translate3d(100%, 0, 0)", opacity: 0.86 },
        ];
    }
    return entering
      ? [
        { transform: "translate3d(100%, 0, 0)", opacity: 0.86 },
        { transform: "translate3d(0, 0, 0)", opacity: 1 },
      ]
      : [
        { transform: "translate3d(0, 0, 0)", opacity: 1 },
        { transform: "translate3d(-100%, 0, 0)", opacity: 0.86 },
      ];
  }
  if (scope === "hierarchy") {
    const origin = "var(--ui-transition-x, 50%) var(--ui-transition-y, 50%)";
    return kind === "backward"
      ? [
        { clipPath: `circle(var(--ui-transition-radius, 150vmax) at ${origin})` },
        { clipPath: `circle(0px at ${origin})` },
      ]
      : [
        { clipPath: `circle(0px at ${origin})` },
        { clipPath: `circle(var(--ui-transition-radius, 150vmax) at ${origin})` },
      ];
  }
  if (kind === "backward") {
    return [
      { opacity: 0, transform: "translate3d(-8px, 0, 0)" },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ];
  }
  if (kind === "reveal") {
    return [
      { opacity: 0.35, transform: "translate3d(0, 8px, 0) scale(0.992)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ];
  }
  return [
    { opacity: 0, transform: "translate3d(8px, 0, 0)" },
    { opacity: 1, transform: "translate3d(0, 0, 0)" },
  ];
}

function lightweightUiTransitionFrames(kind, scope) {
  if (scope === "hierarchy") {
    return [
      {
        opacity: 0.35,
        transform: `translate3d(0, ${kind === "backward" ? -8 : 8}px, 0) scale(0.992)`,
      },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ];
  }
  return uiTransitionFrames(kind, scope, "incoming");
}

function commitUiTransition(kind, update, {
  after,
  afterStart,
  scope = "page",
  origin = null,
  snapshots = true,
} = {}) {
  const root = document.documentElement;
  let afterStartCalled = false;
  const runAfterStart = () => {
    if (afterStartCalled) return;
    afterStartCalled = true;
    afterStart?.();
  };
  const hadActiveTransition = Boolean(activeUiTransition);
  if (activeUiTransition?.skipTransition) {
    try {
      activeUiTransition.skipTransition();
    } catch {
      // A transition can already be settled when a user immediately clicks again.
    }
  } else if (activeUiTransition?.cancel) {
    try {
      activeUiTransition.cancel();
    } catch {
      // A fallback animation may already have completed between input events.
    }
  }
  cleanupActiveUiTransition?.();
  cleanupActiveUiTransition = null;
  // If a second action lands before Chromium has captured the first transition's
  // old frame, commit that pending state exactly once before handling the new one.
  // This keeps rapid navigation ordered without moving the update outside the
  // View Transition callback during normal interactions.
  commitActiveUiTransition?.();
  activeUiTransition = null;
  commitActiveUiTransition = null;
  delete root.dataset.uiTransition;
  delete root.dataset.uiTransitionScope;
  delete root.dataset.uiTransitionMode;
  clearUiTransitionOrigin(root);

  if (prefersReducedMotion()) {
    update();
    runAfterStart();
    after?.();
    return null;
  }

  root.dataset.uiTransition = kind;
  root.dataset.uiTransitionScope = scope;
  const lightweightMotion = prefersLightweightUiMotion();
  if (lightweightMotion) root.dataset.uiTransitionMode = "lightweight";
  if (scope === "hierarchy" && origin) {
    root.style.setProperty("--ui-transition-x", origin.x);
    root.style.setProperty("--ui-transition-y", origin.y);
    root.style.setProperty("--ui-transition-radius", origin.radius);
  }
  const finish = (transition) => {
    if (activeUiTransition !== transition) return;
    activeUiTransition = null;
    commitActiveUiTransition = null;
    if ((lightweightMotion || scope === "reveal") && transition?.cancel) transition.cancel();
    delete root.dataset.uiTransition;
    delete root.dataset.uiTransitionScope;
    delete root.dataset.uiTransitionMode;
    clearUiTransitionOrigin(root);
    after?.();
  };

  // Card changes use the live viewport plus one outgoing snapshot below. Native
  // nested view-transition snapshots can briefly expose the freshly rendered
  // card on Safari and Chromium when a reveal transition has just finished.
  if (!lightweightMotion && !["card", "reveal"].includes(scope) && !hadActiveTransition && typeof document.startViewTransition === "function") {
    let transition;
    let updateCommitted = false;
    const commitUpdate = () => {
      if (updateCommitted) return;
      updateCommitted = true;
      update();
      runAfterStart();
    };
    try {
      transition = document.startViewTransition(commitUpdate);
    } catch {
      transition = null;
    }
    if (transition) {
      activeUiTransition = transition;
      commitActiveUiTransition = commitUpdate;
      Promise.resolve(transition.finished).then(
        () => finish(transition),
        () => finish(transition),
      );
      return transition;
    }
  }

  const transitionSurface = scope === "card" ? studyCardViewport : appShell;
  const outgoingSurface = snapshots && !lightweightMotion && ["hierarchy", "page", "card"].includes(scope)
    ? cloneUiTransitionSurface(transitionSurface, {
      includeNavigation: scope === "hierarchy",
    })
    : null;
  const transitionRect = scope === "card" ? transitionSurface?.getBoundingClientRect() : null;
  update();
  let target = uiTransitionTarget(scope);
  let fallbackOverlay = null;
  if (["hierarchy", "page", "card"].includes(scope) && outgoingSurface) {
    const incomingSurface = scope === "card"
      ? null
      : cloneUiTransitionSurface(transitionSurface, {
        includeNavigation: scope === "hierarchy",
      });
    if (scope === "card" || incomingSurface) {
      fallbackOverlay = document.createElement("div");
      fallbackOverlay.className = `ui-transition-fallback-overlay${scope === "card" ? " is-card" : ""}${scope === "hierarchy" ? " is-hierarchy" : ""}`;
      if (scope === "card" && transitionRect) {
        fallbackOverlay.style.left = `${transitionRect.left}px`;
        fallbackOverlay.style.top = `${transitionRect.top}px`;
        fallbackOverlay.style.width = `${transitionRect.width}px`;
        fallbackOverlay.style.height = `${transitionRect.height}px`;
        fallbackOverlay.style.inset = "auto";
      }
      outgoingSurface.classList.add("ui-transition-snapshot-old");
      if (incomingSurface) {
        incomingSurface.classList.add("ui-transition-snapshot-new");
        fallbackOverlay.append(outgoingSurface, incomingSurface);
      } else {
        fallbackOverlay.append(outgoingSurface);
      }
      document.body.append(fallbackOverlay);
      outgoingSurface.scrollLeft = transitionSurface?.scrollLeft ?? 0;
      outgoingSurface.scrollTop = transitionSurface?.scrollTop ?? 0;
      target = scope === "card"
        ? transitionSurface
        : scope === "hierarchy"
          ? (kind === "backward" ? outgoingSurface : incomingSurface)
          : incomingSurface;
      const cleanup = () => {
        fallbackOverlay?.remove();
        fallbackOverlay = null;
        if (cleanupActiveUiTransition === cleanup) cleanupActiveUiTransition = null;
      };
      cleanupActiveUiTransition = cleanup;
      const transitionAfter = after;
      after = () => {
        cleanup();
        transitionAfter?.();
      };
    }
  }
  let animation = null;
  const animationDuration = lightweightMotion
    ? scope === "hierarchy"
      ? 240
      : scope === "reveal"
        ? 200
        : scope === "card"
          ? 220
          : 240
    : scope === "hierarchy"
      ? 460
      : scope === "reveal"
        ? 300
        : scope === "card"
          ? 400
          : 340;
  const animationEasing = scope === "card"
    ? "cubic-bezier(0.22, 0.61, 0.36, 1)"
    : "cubic-bezier(0.16, 1, 0.3, 1)";
  const liveHierarchyFrames = !outgoingSurface && scope === "hierarchy" && !lightweightMotion
    ? uiTransitionFrames("forward", scope, "incoming")
    : null;
  try {
    animation = target?.animate?.(
      lightweightMotion
        ? lightweightUiTransitionFrames(kind, scope)
        : liveHierarchyFrames ?? uiTransitionFrames(kind, scope, "incoming"), {
        duration: animationDuration,
        easing: animationEasing,
        fill: "both",
      }) ?? null;
  } catch {
    animation = null;
  }
  if (fallbackOverlay && ["page", "card"].includes(scope)) {
    try {
      const outgoingTarget = fallbackOverlay.querySelector(".ui-transition-snapshot-old");
      outgoingTarget?.animate?.(uiTransitionFrames(kind, scope, "outgoing"), {
        duration: scope === "card" ? animationDuration : 420,
        easing: scope === "card" ? animationEasing : "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both",
      });
    } catch {
      // The incoming surface remains usable if an outgoing snapshot cannot animate.
    }
  }
  if (!animation) {
    runAfterStart();
    delete root.dataset.uiTransition;
    delete root.dataset.uiTransitionScope;
    delete root.dataset.uiTransitionMode;
    after?.();
    return null;
  }
  activeUiTransition = animation;
  runAfterStart();
  Promise.resolve(animation.finished).then(
    () => finish(animation),
    () => finish(animation),
  );
  return animation;
}

function render() {
  if (!state) return;

  const session = ensureTodaySession();
  const studyCard = state.view === "study" ? currentCard() : null;
  const studyCardKey = state.view !== "study"
    ? null
    : state.wordBrowse
      ? `browse:${state.wordBrowse.wordId}`
      : studyCard
        ? `session:${session.studyDate}:${session.currentIndex}:${studyCard.wordId}`
        : `finished:${session.studyDate}:${session.currentIndex}:${session.queue.length}`;
  const studyCardChanged = studyCardKey !== null && studyCardKey !== renderedStudyCardKey;
  const enteringStudy = state.view === "study" && renderedStudyView !== "study";
  homePanel.hidden = state.view !== "home";
  studyPanel.hidden = state.view !== "study";
  wordListPanel.hidden = state.view !== "word-list";
  dashboardPanel.hidden = state.view !== "dashboard";
  settingsPanel.hidden = state.view !== "settings";
  dataPanel.hidden = state.view !== "data";
  const mainNavigationVisible = ["home", "dashboard", "settings"].includes(state.view);
  mainAppNav.hidden = !mainNavigationVisible;
  [
    [globalHomeNavButton, "home"],
    [globalDashboardNavButton, "dashboard"],
    [globalSettingsNavButton, "settings"],
  ].forEach(([button, view]) => {
    const active = state.view === view;
    button?.classList.toggle("is-active", active);
    if (active) button?.setAttribute("aria-current", "page");
    else button?.removeAttribute("aria-current");
  });
  appShell.classList.toggle("is-study-view", state.view === "study");
  confusionPanel.hidden = state.view !== "confusion";
  if (state.view === "home" || state.view === "dashboard") renderHome();
  renderStudy();
  if (state.view !== "study") {
    clearStudyCompletionAnimation();
  }
  if (state.view === "word-list") renderWordList();
  if (state.view === "confusion") renderConfusionPanel();
  applyAccountBootstrapGate();
  renderedStudyCardKey = studyCardKey;
  renderedStudyView = state.view;
  if (studyCardChanged) resetStudyScrollPosition({ resetPage: enteringStudy });
}

const DASHBOARD_STATUS_META = Object.freeze([
  { key: SENSE_STATUS.MASTERED, label: "已掌握", color: "#16a34a" },
  { key: SENSE_STATUS.REVIEW, label: "待复习", color: "#0f766e" },
  { key: SENSE_STATUS.REINFORCE, label: "待强化", color: "#c77d2d" },
  { key: SENSE_STATUS.NEW, label: "待新学", color: "#68727d" },
]);

function dashboardBookState(bookId = dashboardBookId ?? activeBookId()) {
  return rootState?.bookStates?.[bookId] ?? createState();
}

function dashboardWords(bookId = dashboardBookId ?? activeBookId()) {
  return wordsForBook(bookId);
}

function dashboardDateList(days = dashboardRangeDays, end = currentDate()) {
  const safeDays = Math.max(1, Math.min(180, Number(days) || 21));
  return Array.from({ length: safeDays }, (_, index) => {
    return addDays(end, index - safeDays + 1);
  });
}

function dashboardSenseKeys(bookWords) {
  return bookWords.flatMap((word) => allSenseKeysForWord(word));
}

function dashboardStatusForKey(bookState, key) {
  const value = bookState.progress?.[key]?.status;
  return Object.values(SENSE_STATUS).includes(value) ? value : SENSE_STATUS.NEW;
}

function dashboardWordStatus(bookState, word) {
  const priority = [
    SENSE_STATUS.NEW,
    SENSE_STATUS.REINFORCE,
    SENSE_STATUS.REVIEW,
    SENSE_STATUS.MASTERED,
  ];
  const statuses = allSenseKeysForWord(word).map((key) => {
    return dashboardStatusForKey(bookState, key);
  });
  return priority.find((status) => statuses.includes(status)) ?? SENSE_STATUS.NEW;
}

function dashboardCountStatuses(bookState, bookWords, unit) {
  const counts = Object.fromEntries(Object.values(SENSE_STATUS).map((status) => [status, 0]));
  if (unit === "word") {
    bookWords.forEach((word) => {
      counts[dashboardWordStatus(bookState, word)] += 1;
    });
  } else {
    dashboardSenseKeys(bookWords).forEach((key) => {
      counts[dashboardStatusForKey(bookState, key)] += 1;
    });
  }
  return counts;
}

function dashboardEventEntries(bookState, bookWords = dashboardWords()) {
  const knownKeys = new Set(dashboardSenseKeys(bookWords));
  return Object.values(bookState.dashboardEvents ?? {})
    .filter((event) => {
      return /^\d{4}-\d{2}-\d{2}$/.test(event?.date ?? "") &&
        knownKeys.has(event.senseId) &&
        Object.values(SENSE_STATUS).includes(event.from) &&
        Object.values(SENSE_STATUS).includes(event.to);
    });
}

function dashboardRecordTransition(bookState, key, from, to, options = {}) {
  const outcome = options.outcome === true;
  if (!bookState || !isKnownSenseKey(key) || (from === to && !outcome)) return false;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(options.date ?? "")
    ? options.date
    : currentActivityDate();
  const observedAt = options.observedAt ?? new Date().toISOString();
  const id = `${date}|${key}|${from}|${to}|${observedAt}`;
  if (
    !bookState.dashboardEvents ||
    typeof bookState.dashboardEvents !== "object" ||
    Array.isArray(bookState.dashboardEvents)
  ) {
    bookState.dashboardEvents = {};
  }
  bookState.dashboardEvents[id] = {
    id,
    date,
    observedAt,
    senseId: key,
    from,
    to,
    source: options.source ?? null,
    learningDay: Number.isFinite(options.learningDay) ? options.learningDay : null,
    outcome,
  };
  return true;
}

function dashboardSnapshotKey(bookId, date) {
  return `${bookId}:${date}`;
}

function dashboardProgressEnteredAt(progress) {
  const exact = Date.parse(progress?.statusEnteredAt ?? "");
  if (Number.isFinite(exact)) return new Date(exact).toISOString();
  const date = progress?.status === SENSE_STATUS.MASTERED
    ? progress.masteredOnActual ?? progress.masteredOn
    : progress?.lastSeenActual ?? progress?.lastSeen ?? progress?.firstSeenActual ?? progress?.firstSeen;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  return parseDate(date).toISOString();
}

function dashboardRecordSnapshot(bookId = activeBookId(), date = currentDate()) {
  const bookState = dashboardBookState(bookId);
  if (!bookState || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const hasLearningEvidence = (bookState.introducedWords?.length ?? 0) > 0 ||
    Object.keys(bookState.progress ?? {}).length > 0 ||
    Object.values(bookState.activityLog ?? {}).some((entry) => {
      return Number(entry?.newCount) > 0 || Number(entry?.reviewCount) > 0 ||
        (Array.isArray(entry?.newWords) && entry.newWords.length > 0) ||
        (Array.isArray(entry?.reviewWords) && entry.reviewWords.length > 0);
    });
  if (!hasLearningEvidence) return false;
  const statuses = {};
  const enteredAt = {};
  // A snapshot treats an omitted progress entry as NEW. Walking the complete
  // 10k-sense vocabulary on every tap made serialization compete with the
  // learning animation; only persisted progress entries can contribute a
  // non-new status or an entered-at timestamp.
  Object.entries(bookState.progress ?? {}).forEach(([key, progress]) => {
    if (!isKnownSenseKey(key)) return;
    if (progress?.status && progress.status !== SENSE_STATUS.NEW) {
      statuses[key] = dashboardStatusForKey(bookState, key);
    }
    const statusEnteredAt = dashboardProgressEnteredAt(progress);
    if (statusEnteredAt) enteredAt[key] = statusEnteredAt;
  });
  const id = dashboardSnapshotKey(bookId, date);
  const previous = bookState.dashboardSnapshots?.[id];
  const snapshot = {
    id,
    version: DASHBOARD_DATA_VERSION,
    bookId,
    date,
    observedAt: new Date().toISOString(),
    statuses,
    enteredAt,
    quality: "exact",
  };
  if (previous && stableStateStringify(previous.statuses) === stableStateStringify(statuses) &&
    stableStateStringify(previous.enteredAt) === stableStateStringify(enteredAt)) {
    return false;
  }
  if (!bookState.dashboardSnapshots || typeof bookState.dashboardSnapshots !== "object") {
    bookState.dashboardSnapshots = {};
  }
  bookState.dashboardSnapshots[id] = snapshot;
  markDashboardSnapshotDirty(bookId, id);
  const dates = Object.values(bookState.dashboardSnapshots)
    .filter((entry) => entry?.bookId === bookId && /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? ""))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  dates.slice(0, Math.max(0, dates.length - 180)).forEach((entry) => {
    markDashboardSnapshotDirty(bookId, entry.id);
    delete bookState.dashboardSnapshots[entry.id];
  });
  return true;
}

function repairDateKey(value) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function firstRepairDate(...values) {
  return values.map(repairDateKey).filter(Boolean).sort()[0] ?? null;
}

function lastRepairDate(...values) {
  return values.map(repairDateKey).filter(Boolean).sort().at(-1) ?? null;
}

function preferredRepairDate(...values) {
  return values.map(repairDateKey).find(Boolean) ?? null;
}

function repairObservedAt(date) {
  return `${date}T23:59:59.999+08:00`;
}

function normalizeRepairActivity(entry, knownWordIds, defaultTarget) {
  const uniqueWords = (value) => [...new Set(
    (Array.isArray(value) ? value : [])
      .map(String)
      .filter((wordId) => knownWordIds.has(wordId)),
  )];
  const newWords = uniqueWords(entry?.newWords);
  const reviewWords = uniqueWords(entry?.reviewWords);
  const target = Number.isFinite(entry?.target)
    ? Math.max(0, Number(entry.target))
    : Math.max(0, Number(defaultTarget) || 0);
  const locked = Boolean(entry?.newCountLocked) && Number.isFinite(entry?.newCount);
  const newCount = locked
    ? Math.max(0, Number(entry.newCount))
    : Math.max(newWords.length, Number(entry?.newCount) || 0);
  return {
    newWords,
    reviewWords,
    newCount,
    newCountLocked: locked,
    reviewCount: Math.max(reviewWords.length, Number(entry?.reviewCount) || 0),
    baseCompleted: Boolean(entry?.baseCompleted),
    overtime: Boolean(entry?.overtime),
    target,
    learningDays: [...new Set(
      (Array.isArray(entry?.learningDays) ? entry.learningDays : [])
        .filter(Number.isFinite),
    )].sort((left, right) => left - right),
  };
}

function rebuildMergedSession(bookId, bookState, bookWords, activityLog) {
  const session = bookState?.session;
  const today = currentDate();
  if (
    !session ||
    repairDateKey(session.date) !== today ||
    !session.baseNewAdded ||
    session.activeBatchType !== "planned"
  ) {
    return false;
  }

  const before = stableStateStringify(session);
  const introduced = new Set((bookState.introducedWords ?? []).map(String));
  const importance = new Map();
  const keysByWord = new Map();
  bookWords.forEach((word) => {
    const keys = word.senses.map((sense) => {
      const key = senseKey(word.id, sense.id);
      importance.set(key, Number(sense.importance) || 0);
      return key;
    });
    keysByWord.set(String(word.id), keys);
  });
  const sortKeys = (keys) => [...new Set(keys)].sort((left, right) => {
    return (importance.get(right) ?? 0) - (importance.get(left) ?? 0) ||
      left.localeCompare(right);
  });
  const progressForKey = (key) => bookState.progress?.[key];
  const learningDay = Number.isFinite(session.activeLearningDay)
    ? session.activeLearningDay
    : Math.max(1, Number(bookState.learningDayCounter) || 1);
  const isDue = (key) => {
    const progress = progressForKey(key);
    return [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].includes(progress?.status) &&
      (!Number.isFinite(progress.dueLearningDay) || progress.dueLearningDay <= learningDay);
  };
  const makeCard = (type, wordId, activeKeys, newKeys = []) => ({
    type,
    wordId,
    activeSenseKeys: sortKeys(activeKeys),
    newSenseKeys: sortKeys(newKeys),
    senseKeys: sortKeys(keysByWord.get(String(wordId)) ?? activeKeys),
    confirmedKeys: [],
    expandedMasteredKeys: [],
  });

  const reviewByWord = new Map();
  Object.keys(bookState.progress ?? {}).forEach((key) => {
    if (!isDue(key)) return;
    const { wordId } = splitSenseKey(key);
    if (!keysByWord.has(String(wordId))) return;
    const keys = reviewByWord.get(String(wordId)) ?? [];
    keys.push(key);
    reviewByWord.set(String(wordId), keys);
  });

  const todayActivity = activityLog[today] ?? normalizeRepairActivity(
    {},
    new Set(bookWords.map((word) => String(word.id))),
    targetForBookDate(bookState, today),
  );
  const remainingNew = Math.max(
    0,
    (Number(bookState.plan?.dailyTarget) || 0) - (Number(todayActivity.newCount) || 0),
  );
  const newCandidates = [
    ...bookWords.filter((word) => {
      return introduced.has(String(word.id)) &&
        (keysByWord.get(String(word.id)) ?? []).some((key) => {
          return (progressForKey(key)?.status ?? SENSE_STATUS.NEW) === SENSE_STATUS.NEW;
        });
    }),
    ...bookWords.filter((word) => !introduced.has(String(word.id))),
  ].slice(0, remainingNew);

  const standaloneNew = [];
  newCandidates.forEach((word) => {
    const wordId = String(word.id);
    const newKeys = (keysByWord.get(wordId) ?? []).filter((key) => {
      return (progressForKey(key)?.status ?? SENSE_STATUS.NEW) === SENSE_STATUS.NEW;
    });
    if (!newKeys.length) return;
    const reviewKeys = reviewByWord.get(wordId);
    if (reviewKeys) {
      reviewByWord.set(wordId, sortKeys([...reviewKeys, ...newKeys]));
      return;
    }
    standaloneNew.push(makeCard("new", wordId, newKeys, newKeys));
  });

  const reviewCards = [...reviewByWord.entries()].map(([wordId, keys]) => {
    const newKeys = keys.filter((key) => {
      return (progressForKey(key)?.status ?? SENSE_STATUS.NEW) === SENSE_STATUS.NEW;
    });
    return makeCard("review", wordId, keys, newKeys);
  });
  session.queue = [...reviewCards, ...standaloneNew];
  session.currentIndex = 0;
  session.revealed = false;
  session.cardPhase = "hidden";
  session.historyView = null;
  session.reinforcementAdded = false;
  session.baseCompleted = session.queue.length === 0 &&
    (Number(todayActivity.newCount) || 0) >= (Number(todayActivity.target) || 0);
  if (session.baseCompleted) todayActivity.baseCompleted = true;
  return stableStateStringify(session) !== before;
}

function repairDerivedBookState(bookId, bookState, options = {}) {
  const today = currentDate();
  const bookWords = wordsForBook(bookId);
  const knownWordIds = new Set(bookWords.map((word) => String(word.id)));
  const knownSenseKeys = new Set();
  const wordIdBySenseKey = new Map();
  bookWords.forEach((word) => {
    word.senses.forEach((sense) => {
      const key = senseKey(word.id, sense.id);
      knownSenseKeys.add(key);
      wordIdBySenseKey.set(key, String(word.id));
    });
  });
  ensurePlanTargetHistory(bookState);
  const beforeActivity = stableStateStringify(bookState.activityLog ?? {});
  const beforeSnapshots = stableStateStringify(bookState.dashboardSnapshots ?? {});
  const activityLog = {};
  Object.entries(bookState.activityLog ?? {}).forEach(([date, entry]) => {
    if (!repairDateKey(date)) return;
    activityLog[date] = normalizeRepairActivity(
      entry,
      knownWordIds,
      targetForBookDate(bookState, date),
    );
  });
  const activityForRepair = (date) => {
    if (!date || date > today) return null;
    activityLog[date] ??= normalizeRepairActivity(
      {},
      knownWordIds,
      targetForBookDate(bookState, date),
    );
    return activityLog[date];
  };
  const addRepairWord = (date, field, wordId) => {
    const activity = activityForRepair(date);
    if (!activity || !knownWordIds.has(wordId)) return;
    activity[field] = [...new Set([...activity[field], wordId])];
  };

  Object.entries(bookState.progress ?? {}).forEach(([key, progress]) => {
    const wordId = wordIdBySenseKey.get(key);
    if (!wordId) return;
    const firstSeen = firstRepairDate(progress?.firstSeenActual, progress?.firstSeen);
    const lastSeen = lastRepairDate(progress?.lastSeenActual, progress?.lastSeen);
    if (firstSeen) addRepairWord(firstSeen, "newWords", wordId);
    if (lastSeen && lastSeen !== firstSeen) addRepairWord(lastSeen, "reviewWords", wordId);
  });

  const completedWindowDates = new Set();
  (Array.isArray(bookState.studyWindows) ? bookState.studyWindows : []).forEach((window) => {
    const date = repairDateKey(window?.activityDate);
    if (!date || date > today) return;
    activityForRepair(date);
    if (window.endedReason === "completed") completedWindowDates.add(date);
  });
  Object.entries(activityLog).forEach(([date, entry]) => {
    entry.newWords = [...new Set(entry.newWords)];
    entry.reviewWords = [...new Set(entry.reviewWords)];
    if (!entry.newCountLocked) entry.newCount = Math.max(entry.newCount, entry.newWords.length);
    entry.reviewCount = Math.max(entry.reviewCount, entry.reviewWords.length);
    entry.baseCompleted = entry.baseCompleted || completedWindowDates.has(date);
    entry.overtime = entry.overtime || Boolean(entry.target && entry.newCount > entry.target);
  });
  bookState.activityLog = activityLog;

  const allSnapshots = normalizeDashboardMap(bookState.dashboardSnapshots);
  const retainedSnapshots = Object.fromEntries(
    Object.entries(allSnapshots).filter(([, snapshot]) => snapshot.quality !== "reconstructed"),
  );
  const exactByDate = new Map();
  Object.values(retainedSnapshots).forEach((snapshot) => {
    const date = repairDateKey(snapshot.date);
    if (!date || (snapshot.bookId && snapshot.bookId !== bookId)) return;
    exactByDate.set(date, snapshot);
  });
  const events = Object.values(normalizeDashboardMap(bookState.dashboardEvents))
    .filter((event) => {
      return knownSenseKeys.has(event?.senseId) &&
        repairDateKey(event?.date) &&
        Object.values(SENSE_STATUS).includes(event?.to);
    })
    .sort((left, right) => {
      return String(left.date).localeCompare(String(right.date)) ||
        String(left.observedAt ?? "").localeCompare(String(right.observedAt ?? ""));
    });
  const eventsByDate = new Map();
  const latestEventByKey = new Map();
  events.forEach((event) => {
    const date = repairDateKey(event.date);
    const entries = eventsByDate.get(date) ?? [];
    entries.push(event);
    eventsByDate.set(date, entries);
    latestEventByKey.set(event.senseId, event);
  });

  const inferredByDate = new Map();
  Object.entries(bookState.progress ?? {}).forEach(([key, progress]) => {
    if (!knownSenseKeys.has(key) || !Object.values(SENSE_STATUS).includes(progress?.status)) return;
    if (progress.status === SENSE_STATUS.NEW) return;
    const statusDate = progress.status === SENSE_STATUS.MASTERED
      ? preferredRepairDate(
        progress.masteredOnActual,
        progress.masteredOn,
        progress.lastSeenActual,
        progress.lastSeen,
        progress.firstSeenActual,
        progress.firstSeen,
      )
      : preferredRepairDate(
        progress.lastSeenActual,
        progress.lastSeen,
        progress.firstSeenActual,
        progress.firstSeen,
      );
    if (!statusDate || statusDate > today) return;
    const latestEvent = latestEventByKey.get(key);
    if (latestEvent && latestEvent.to === progress.status && latestEvent.date >= statusDate) return;
    const entries = inferredByDate.get(statusDate) ?? [];
    entries.push({
      key,
      status: progress.status,
      enteredAt: dashboardProgressEnteredAt(progress) ?? `${statusDate}T00:00:00+08:00`,
    });
    inferredByDate.set(statusDate, entries);
  });

  const evidenceDates = new Set([today]);
  Object.keys(activityLog).forEach((date) => evidenceDates.add(date));
  exactByDate.forEach((_, date) => evidenceDates.add(date));
  eventsByDate.forEach((_, date) => evidenceDates.add(date));
  inferredByDate.forEach((_, date) => evidenceDates.add(date));
  const validEvidenceDates = [...evidenceDates]
    .filter((date) => date <= today)
    .sort();
  const earliest = validEvidenceDates[0];
  if (earliest) {
    const start = earliest < addDays(today, -179) ? addDays(today, -179) : earliest;
    const statuses = {};
    const enteredAt = {};
    for (let date = start; date <= today; date = addDays(date, 1)) {
      (inferredByDate.get(date) ?? []).forEach((entry) => {
        statuses[entry.key] = entry.status;
        enteredAt[entry.key] = entry.enteredAt;
      });
      const exact = exactByDate.get(date);
      if (exact) {
        Object.keys(statuses).forEach((key) => delete statuses[key]);
        Object.keys(enteredAt).forEach((key) => delete enteredAt[key]);
        Object.entries(exact.statuses ?? {}).forEach(([key, status]) => {
          if (knownSenseKeys.has(key) && Object.values(SENSE_STATUS).includes(status)) {
            statuses[key] = status;
          }
        });
        Object.entries(exact.enteredAt ?? {}).forEach(([key, value]) => {
          if (knownSenseKeys.has(key) && Number.isFinite(Date.parse(value))) {
            enteredAt[key] = value;
          }
        });
      }
      (eventsByDate.get(date) ?? []).forEach((event) => {
        if (exact && String(event.observedAt ?? "") <= String(exact.observedAt ?? "")) return;
        if (event.to === SENSE_STATUS.NEW) {
          delete statuses[event.senseId];
          delete enteredAt[event.senseId];
          return;
        }
        statuses[event.senseId] = event.to;
        enteredAt[event.senseId] = event.observedAt ?? `${date}T00:00:00+08:00`;
      });

      if (date === today) {
        Object.entries(bookState.progress ?? {}).forEach(([key, progress]) => {
          if (!knownSenseKeys.has(key)) return;
          if (!progress?.status || progress.status === SENSE_STATUS.NEW) {
            delete statuses[key];
            delete enteredAt[key];
            return;
          }
          statuses[key] = progress.status;
          const entered = dashboardProgressEnteredAt(progress);
          if (entered) enteredAt[key] = entered;
        });
      }

      if (!evidenceDates.has(date) || (exact && date !== today)) continue;
      const id = dashboardSnapshotKey(bookId, date);
      const nextSnapshot = {
        id,
        version: DASHBOARD_DATA_VERSION,
        bookId,
        date,
        observedAt: date === today ? new Date().toISOString() : repairObservedAt(date),
        statuses: cloneSerializable(statuses),
        enteredAt: cloneSerializable(enteredAt),
        quality: date === today ? "exact" : "reconstructed",
      };
      retainedSnapshots[id] = exact &&
        stableStateStringify(exact.statuses ?? {}) === stableStateStringify(nextSnapshot.statuses) &&
        stableStateStringify(exact.enteredAt ?? {}) === stableStateStringify(nextSnapshot.enteredAt)
        ? exact
        : nextSnapshot;
    }
  }
  bookState.dashboardSnapshots = retainedSnapshots;

  const sessionChanged = options.reconcileSession === true
    ? rebuildMergedSession(bookId, bookState, bookWords, activityLog)
    : false;
  return {
    activityChanged: stableStateStringify(bookState.activityLog) !== beforeActivity,
    snapshotsChanged: stableStateStringify(bookState.dashboardSnapshots) !== beforeSnapshots,
    activityDates: Object.keys(bookState.activityLog).length,
    snapshotDates: Object.keys(bookState.dashboardSnapshots).length,
    sessionChanged,
  };
}

function repairDerivedRootState(candidate, options = {}) {
  const repaired = cloneSerializable(candidate ?? {});
  const reports = [];
  Object.entries(repaired.bookStates ?? {}).forEach(([bookId, bookState]) => {
    const referenceBook = options.referenceState?.bookStates?.[bookId];
    const learningChanged = !referenceBook || stableStateStringify({
      introducedWords: bookState.introducedWords,
      progress: bookState.progress,
      activityLog: bookState.activityLog,
      studyWindows: bookState.studyWindows,
    }) !== stableStateStringify({
      introducedWords: referenceBook.introducedWords,
      progress: referenceBook.progress,
      activityLog: referenceBook.activityLog,
      studyWindows: referenceBook.studyWindows,
    });
    reports.push({
      bookId,
      ...repairDerivedBookState(bookId, bookState, {
        reconcileSession: options.reconcileSession === true || learningChanged,
      }),
    });
  });
  return { state: repaired, reports };
}

async function repairActiveDerivedData(onProgress = null) {
  const navigation = captureActiveNavigation();
  const previous = cloneSerializable(rootState);
  const repaired = cloneSerializable(rootState);
  const entries = Object.entries(repaired.bookStates ?? {});
  const reports = [];
  for (let index = 0; index < entries.length; index += 1) {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const [bookId, bookState] = entries[index];
    reports.push({
      bookId,
      ...repairDerivedBookState(bookId, bookState, { reconcileSession: true }),
    });
    onProgress?.((index + 1) / Math.max(1, entries.length) * 90, index + 1, entries.length);
  }
  if (window.SenseVocabSync) {
    window.SenseVocabSync.stampChanges(repaired, previous);
  }
  rootState = normalizeRootState(repaired);
  dirtyDashboardSnapshots = new Map();
  markAllDashboardSnapshotsDirty(rootState);
  if (navigation && bookById.has(navigation.bookId)) rootState.activeBookId = navigation.bookId;
  activateBookScope(rootState.activeBookId);
  restoreActiveNavigation(navigation);
  const persisted = saveState({
    notify: false,
    stampSync: false,
    persistAllSnapshots: true,
  });
  render();
  onProgress?.(100, entries.length, entries.length);
  return {
    persisted,
    reports,
    changed: stateSignature(previous) !== stateSignature(rootState),
  };
}

function dashboardDateLabel(date) {
  const parsed = parseDate(date);
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function dashboardEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

function dashboardSvgLabel(label) {
  // The chart already exposes an aria-label and one fixed, card-level detail
  // region. Native SVG title popovers would duplicate that detail on desktop.
  return "";
}

function dashboardDisplayLabel(key, fallback = "") {
  return {
    new: "新学",
    reinforce: "待强化",
    review: "待复习",
    mastered: "已掌握",
    "new-mastered": "新学 → 掌握",
    "reinforce-review": "强化 → 复习",
    "review-mastered": "复习 → 掌握",
    "hold-reinforce": "强化停留",
    "hold-review": "复习停留",
  }[key] ?? fallback;
}

function dashboardApplyUserCopy() {
  const labels = {
    dashboardHeading: "统计数据",
    dashboardDailyHeading: "每日学习量",
    dashboardStatusHeading: "词书进度",
    dashboardPoolHeading: "强化与复习池",
    dashboardConversionHeading: "义项转化率",
    dashboardHoldHeading: "状态停留时间",
    dashboardSankeyHeading: "义项状态流转",
  };
  Object.entries(labels).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  });
  const ariaLabels = {
    dashboardDailyChart: "每日学习柱状图，可横向滚动查看",
    dashboardPoolChart: "强化与复习池趋势图，可横向滚动查看",
    dashboardConversionChart: "义项转化率趋势图，可横向滚动查看",
    dashboardHoldChart: "状态停留时间趋势图，可横向滚动查看",
    dashboardSankeyChart: "义项状态流转图",
  };
  Object.entries(ariaLabels).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) element.setAttribute("aria-label", text);
  });
  if (dashboardUnitSelect) {
    dashboardUnitSelect.closest(".dashboard-control")?.querySelector("span")?.replaceChildren("统计口径");
  }
  if (dashboardRangeSelect) {
    dashboardRangeSelect.closest(".dashboard-control")?.querySelector("span")?.replaceChildren("时间范围");
  }
  dashboardBookSelect?.closest(".dashboard-control")?.querySelector("span")?.replaceChildren("词书");
}

function dashboardChartEmpty(message = "暂无数据") {
  const normalizedMessage = String(message ?? "") === "所选时间暂无状态变化"
    ? "所选时间暂无状态变化"
    : "暂无数据";
  return `<div class="dashboard-empty" role="status">${dashboardEscape(normalizedMessage)}</div>`;
}

function dashboardSetMarkup(container, markup) {
  if (!container) return;
  container.__dashboardChartCleanup?.();
  container.__dashboardChartCleanup = null;
  const range = document.createRange();
  range.selectNode(container);
  container.replaceChildren(range.createContextualFragment(markup));
}

function dashboardTooltipForElement(element) {
  return element.dataset.dashboardTooltip || element.querySelector?.("title")?.textContent?.trim() || "";
}

function dashboardDetailForFrame(frame) {
  const card = frame?.closest?.(".dashboard-card") ?? frame?.parentElement?.closest?.(".dashboard-card");
  if (!card) return null;
  let detail = card.querySelector(
    ":scope > .dashboard-sankey-detail-row .dashboard-card-detail, :scope > .dashboard-chart-detail-row .dashboard-card-detail, :scope > .dashboard-card-heading .dashboard-card-detail",
  );
  if (!detail) {
    const heading = card.querySelector(":scope > .dashboard-card-heading");
    if (!heading) return null;
    detail = document.createElement("span");
    detail.className = "dashboard-card-detail";
    detail.setAttribute("role", "status");
    detail.setAttribute("aria-live", "polite");
    detail.hidden = true;
    heading.append(detail);
  }
  return detail;
}

function dashboardWriteDetail(detail, text) {
  if (!detail) return;
  const normalized = String(text ?? "").trim();
  const card = detail.closest(".dashboard-card");
  const heading = card?.querySelector(":scope > .dashboard-card-heading");
  const timeHost = heading?.querySelector(".dashboard-card-time");
  const dateMatch = normalized.match(
    /^(\d{4}-\d{2}-\d{2}(?:\s+至\s+\d{4}-\d{2}-\d{2})?)(?:[\u3000\s]+)(.*)$/,
  );
  const timeText = dateMatch?.[1] ?? "";
  const detailText = dateMatch?.[2]?.trim() ?? normalized;
  if (timeHost) {
    timeHost.textContent = timeText;
    timeHost.hidden = !timeText;
  }
  detail.replaceChildren();
  if (detailText) {
    const parts = detailText
      .split(/[\u3000；]/)
      .map((part) => part.trim())
      .filter(Boolean);
    parts.forEach((part, index) => {
      const item = document.createElement("span");
      item.className = "dashboard-detail-part";
      item.textContent = part;
      detail.append(item);
    });
    detail.setAttribute("aria-label", normalized.replace(/\u3000/g, "，"));
  } else {
    detail.removeAttribute("aria-label");
  }
  detail.hidden = !detailText;
  const detailRow = detail.closest(".dashboard-chart-detail-row, .dashboard-sankey-detail-row");
  if (detailRow) detailRow.hidden = !detailText;
}

function dashboardSetDefaultDetail(frame, text) {
  if (!frame) return;
  const normalized = String(text ?? "").trim();
  frame.dataset.dashboardDefaultDetail = normalized;
  const detail = dashboardDetailForFrame(frame);
  if (!detail) return;
  dashboardWriteDetail(detail, normalized);
}

function dashboardShowTooltip(frame, element) {
  if (!frame || !element) return;
  frame.querySelectorAll(".is-dashboard-active").forEach((target) => {
    if (target !== element) target.classList.remove("is-dashboard-active");
  });
  element.classList.add("is-dashboard-active");
  const detail = dashboardDetailForFrame(frame);
  if (!detail) return;
  dashboardWriteDetail(detail, dashboardTooltipForElement(element));
}

function dashboardHideTooltip(frame, element = null) {
  element?.classList.remove("is-dashboard-active");
  frame?.querySelectorAll(".is-dashboard-active").forEach((target) => target.classList.remove("is-dashboard-active"));
  const detail = dashboardDetailForFrame(frame);
  if (detail) {
    const fallback = frame?.dataset?.dashboardDefaultDetail ?? "";
    dashboardWriteDetail(detail, fallback);
  }
}

function dashboardBindChartInteractions(frame) {
  if (!frame) return;
  frame.querySelectorAll("[data-dashboard-hit]").forEach((element) => {
    element.setAttribute("tabindex", "0");
    element.addEventListener("pointerenter", () => dashboardShowTooltip(frame, element));
    element.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") dashboardHideTooltip(frame, element);
    });
    element.addEventListener("focus", () => dashboardShowTooltip(frame, element));
    element.addEventListener("blur", () => dashboardHideTooltip(frame, element));
    element.addEventListener("pointerdown", () => dashboardShowTooltip(frame, element));
  });
}

function dashboardDateDetail(date, details) {
  const prefix = `${date} `;
  const compact = details
    .map((detail) => String(detail ?? "").trim())
    .filter(Boolean)
    .map((detail) => detail.startsWith(prefix) ? detail.slice(prefix.length) : detail)
    .filter((detail, index, values) => values.indexOf(detail) === index);
  return `${date}${compact.length ? `　${compact.join("；")}` : "　暂无数据"}`;
}

function dashboardBindTimeSeriesInteractions(frame, svg, groups, plotTop, plotBottom) {
  const plotScroll = frame?.querySelector(".dashboard-plot-scroll");
  if (!plotScroll || !svg || !groups.length) return;
  const crosshair = document.createElementNS("http://www.w3.org/2000/svg", "line");
  crosshair.classList.add("dashboard-crosshair");
  crosshair.setAttribute("y1", String(plotTop));
  crosshair.setAttribute("y2", String(plotBottom));
  crosshair.setAttribute("aria-hidden", "true");
  crosshair.setAttribute("visibility", "hidden");
  const svgTitle = svg.querySelector(":scope > title");
  if (svgTitle) svgTitle.after(crosshair);
  else svg.prepend(crosshair);
  const ordered = [...groups].sort((left, right) => left.x - right.x);
  const defaultGroup = ordered.at(-1);
  dashboardSetDefaultDetail(frame, defaultGroup?.detail ?? "");

  const clearSelection = () => {
    frame.querySelectorAll(".is-dashboard-active").forEach((element) => element.classList.remove("is-dashboard-active"));
    crosshair.setAttribute("visibility", "hidden");
    dashboardHideTooltip(frame);
  };
  const selectGroup = (group) => {
    if (!group) return;
    frame.querySelectorAll(".is-dashboard-active").forEach((element) => element.classList.remove("is-dashboard-active"));
    svg.querySelectorAll(`[data-dashboard-index="${group.index}"]`).forEach((element) => {
      if (element.matches(".dashboard-bar, .dashboard-point, .dashboard-target-line")) {
        element.classList.add("is-dashboard-active");
      }
    });
    crosshair.setAttribute("x1", String(group.x));
    crosshair.setAttribute("x2", String(group.x));
    crosshair.removeAttribute("visibility");
    const detail = dashboardDetailForFrame(frame);
    if (detail) {
      dashboardWriteDetail(detail, group.detail);
    }
  };
  const groupAtClientX = (clientX) => {
    const bounds = svg.getBoundingClientRect();
    const viewBox = svg.viewBox?.baseVal;
    if (!bounds.width || !viewBox?.width) return null;
    const x = viewBox.x + (clientX - bounds.left) / bounds.width * viewBox.width;
    let nearest = ordered[0];
    let nearestDistance = Math.abs(x - nearest.x);
    ordered.slice(1).forEach((group) => {
      const distance = Math.abs(x - group.x);
      if (distance < nearestDistance) {
        nearest = group;
        nearestDistance = distance;
      }
    });
    const nearestIndex = ordered.indexOf(nearest);
    const previousGap = nearestIndex > 0 ? nearest.x - ordered[nearestIndex - 1].x : null;
    const nextGap = nearestIndex < ordered.length - 1 ? ordered[nearestIndex + 1].x - nearest.x : null;
    const localGap = Math.max(32, previousGap ?? nextGap ?? 64, nextGap ?? previousGap ?? 64);
    return nearestDistance <= localGap * 0.62 ? nearest : null;
  };
  const selectAtClientX = (clientX) => {
    const group = groupAtClientX(clientX);
    if (group) selectGroup(group);
  };

  plotScroll.addEventListener("pointermove", (event) => selectAtClientX(event.clientX));
  plotScroll.addEventListener("pointerdown", (event) => selectAtClientX(event.clientX));
  plotScroll.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "touch") clearSelection();
  });
  plotScroll.addEventListener("touchstart", (event) => {
    if (event.touches[0]) selectAtClientX(event.touches[0].clientX);
  }, { passive: true });
  plotScroll.addEventListener("touchmove", (event) => {
    if (event.touches[0]) selectAtClientX(event.touches[0].clientX);
  }, { passive: true });

  frame.querySelectorAll("[data-dashboard-index]").forEach((element) => {
    if (!element.matches(".dashboard-bar, .dashboard-point, .dashboard-target-line")) return;
    element.setAttribute("tabindex", "0");
    element.addEventListener("focus", () => {
      const group = ordered.find((candidate) => String(candidate.index) === element.dataset.dashboardIndex);
      selectGroup(group);
    });
    element.addEventListener("blur", clearSelection);
  });
}

function dashboardScaleLabel(value) {
  const rounded = Number(Number(value).toFixed(1));
  return Number.isFinite(rounded) ? String(rounded) : "0";
}

function dashboardSetAxisScale(frame, min, max) {
  const labels = [max, min + (max - min) / 2, min].map(dashboardScaleLabel);
  frame.querySelectorAll(".dashboard-axis-rail").forEach((rail) => {
    [...rail.children].forEach((label, index) => {
      label.textContent = labels[index] ?? "";
    });
  });
}

function dashboardVisibleIndexes(plotScroll, groups) {
  const ordered = [...groups].sort((left, right) => left.x - right.x);
  if (!ordered.length) return [];
  const gaps = ordered.slice(1).map((group, index) => group.x - ordered[index].x).filter((gap) => gap > 0);
  const margin = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 2 : 24;
  const start = plotScroll.scrollLeft - margin;
  const end = plotScroll.scrollLeft + plotScroll.clientWidth + margin;
  const visible = ordered.filter((group) => group.x >= start && group.x <= end);
  if (visible.length) return visible.map((group) => group.index);
  const center = (start + end) / 2;
  return [ordered.reduce((nearest, group) => (
    Math.abs(group.x - center) < Math.abs(nearest.x - center) ? group : nearest
  )).index];
}

function dashboardNormalizeScale(bounds) {
  let min = Number(bounds?.min);
  let max = Number(bounds?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max < min) [min, max] = [max, min];
  if (max === min) {
    if (max === 0) {
      max = 1;
    } else {
      const padding = Math.max(1, Math.abs(max) * 0.08);
      min = Math.max(0, min - padding);
      max += padding;
    }
  }
  return { min, max };
}

function dashboardBindVisibleScale(container, frame, svg, groups, visibleScale) {
  const plotScroll = frame.querySelector(".dashboard-plot-scroll");
  if (!plotScroll || !visibleScale?.resolve || !visibleScale?.apply) return null;
  let animationFrame = 0;
  const refresh = () => {
    animationFrame = 0;
    const indexes = dashboardVisibleIndexes(plotScroll, groups);
    const scale = dashboardNormalizeScale(visibleScale.resolve(indexes));
    if (!scale) return;
    visibleScale.apply(svg, scale);
    dashboardSetAxisScale(frame, scale.min, scale.max);
  };
  const schedule = () => {
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(refresh);
  };
  plotScroll.addEventListener("scroll", schedule, { passive: true });
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
  resizeObserver?.observe(plotScroll);
  container.__dashboardChartCleanup = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    plotScroll.removeEventListener("scroll", schedule);
    resizeObserver?.disconnect();
  };
  return schedule;
}

function dashboardEnhanceChart(container, options = {}) {
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) return;
  svg.querySelectorAll(".dashboard-bar, .dashboard-point, .dashboard-target-line, .dashboard-sankey-flow, .dashboard-sankey-node").forEach((element) => {
    element.dataset.dashboardHit = "true";
  });
  const labels = [...svg.querySelectorAll(".dashboard-y-label")].map((label) => label.textContent);
  svg.querySelectorAll(".dashboard-y-label").forEach((label) => label.remove());
  const frame = document.createElement("div");
  frame.className = "dashboard-chart-frame";
  const leftAxis = document.createElement("div");
  leftAxis.className = "dashboard-axis-rail dashboard-axis-left";
  const rightAxis = document.createElement("div");
  rightAxis.className = "dashboard-axis-rail dashboard-axis-right";
  labels.forEach((label) => {
    const leftLabel = document.createElement("span");
    leftLabel.textContent = label;
    const rightLabel = document.createElement("span");
    rightLabel.textContent = label;
    leftAxis.append(leftLabel);
    rightAxis.append(rightLabel);
  });
  const plotScroll = document.createElement("div");
  plotScroll.className = "dashboard-plot-scroll";
  plotScroll.tabIndex = 0;
  plotScroll.setAttribute("aria-label", "图表，可横向滚动");
  plotScroll.append(svg);
  frame.append(leftAxis, plotScroll, rightAxis);
  container.replaceChildren(frame);
  if (options.groups?.length) {
    dashboardBindTimeSeriesInteractions(
      frame,
      svg,
      options.groups,
      Number(options.plotTop ?? 0),
      Number(options.plotBottom ?? 220),
    );
  } else {
    dashboardBindChartInteractions(frame);
  }
  const refreshVisibleScale = options.groups?.length && options.visibleScale
    ? dashboardBindVisibleScale(container, frame, svg, options.groups, options.visibleScale)
    : null;
  const positionAtLatestWindow = () => {
    plotScroll.scrollLeft = plotScroll.scrollWidth;
    refreshVisibleScale?.();
  };
  // Set the initial viewport and scale before yielding to the compositor. A
  // delayed first refresh briefly exposes an outlier from the full range and
  // makes the chart appear to jump when the latest window is selected.
  positionAtLatestWindow();
  requestAnimationFrame(positionAtLatestWindow);
}

function dashboardEnhanceStatusBar(counts, total) {
  if (!dashboardStatusBar || !dashboardStatusLegend) return;
  const clear = () => {
    dashboardStatusBar.querySelectorAll(".is-dashboard-active").forEach((target) => target.classList.remove("is-dashboard-active"));
    dashboardStatusLegend.querySelectorAll(".is-dashboard-active").forEach((target) => target.classList.remove("is-dashboard-active"));
  };
  const show = (status) => {
    clear();
    dashboardStatusBar.querySelector(`[data-dashboard-status="${status}"]`)?.classList.add("is-dashboard-active");
    dashboardStatusLegend.querySelector(`[data-dashboard-status="${status}"]`)?.classList.add("is-dashboard-active");
  };
  dashboardStatusBar.querySelectorAll(".dashboard-status-segment").forEach((segment) => {
    const meta = DASHBOARD_STATUS_META.find((entry) => segment.classList.contains(`dashboard-status-${entry.key}`));
    const value = counts[meta?.key] ?? 0;
    segment.textContent = "";
    segment.dataset.dashboardStatus = meta?.key ?? "";
    segment.setAttribute("tabindex", "0");
    segment.addEventListener("pointerenter", () => show(meta?.key));
    segment.addEventListener("pointerdown", () => show(meta?.key));
    segment.addEventListener("focus", () => show(meta?.key));
    segment.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") clear();
    });
    segment.addEventListener("blur", clear);
  });
  dashboardStatusLegend.querySelectorAll("[data-dashboard-status]").forEach((legendItem) => {
    const status = legendItem.dataset.dashboardStatus;
    legendItem.setAttribute("tabindex", "0");
    legendItem.addEventListener("pointerenter", () => show(status));
    legendItem.addEventListener("pointerdown", () => show(status));
    legendItem.addEventListener("focus", () => show(status));
    legendItem.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") clear();
    });
    legendItem.addEventListener("blur", clear);
  });
}

function dashboardRenderStackedBars(container, dates, rows, summary, targetByDate = {}, targetUnitLabel = "义项") {
  if (!container) return;
  if (!dates.length || !rows.some((row) => row.values.some((value) => value > 0))) {
    dashboardSetMarkup(container, dashboardChartEmpty("暂无学习记录"));
    dashboardSetDefaultDetail(container, dates.length ? `${dates.at(-1)}　暂无学习记录` : "暂无学习记录");
    if (summary) summary.textContent = "";
    return;
  }
  const chartWidth = Math.max(620, dates.length * 46);
  const chartHeight = 220;
  const left = 34;
  const bottom = 34;
  const top = 12;
  const plotHeight = chartHeight - top - bottom;
  const maxValue = Math.max(1, ...dates.map((_, index) => rows.reduce((sum, row) => sum + row.values[index], 0)), ...Object.values(targetByDate));
  const barWidth = Math.max(18, Math.min(34, 34 - (dates.length > 42 ? 8 : 0)));
  const groups = [];
  let markup = `<svg class="dashboard-svg" role="img" aria-label="每日学习量堆叠柱状图" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}">${dashboardSvgLabel("每日学习量堆叠柱状图")}`;
  markup += `<line class="dashboard-axis" x1="${left}" y1="${top + plotHeight}" x2="${chartWidth - 8}" y2="${top + plotHeight}" />`;
  // The fixed axis rails are laid out in document order from top to bottom.
  // Emit the stacked-bar labels in that same visual order; the plot itself
  // still maps larger values towards the top of the chart.
  [1, 0.5, 0].forEach((ratio) => {
    const y = top + plotHeight - ratio * plotHeight;
    markup += `<line class="dashboard-grid-line" x1="${left}" y1="${y}" x2="${chartWidth - 8}" y2="${y}" /><text class="dashboard-y-label" x="${left - 6}" y="${y + 4}" text-anchor="end">${Math.round(maxValue * ratio)}</text>`;
  });
  dates.forEach((date, index) => {
    let cursor = top + plotHeight;
    const x = left + index * (chartWidth - left - 12) / dates.length + ((chartWidth - left - 12) / dates.length - barWidth) / 2;
    rows.forEach((row) => {
      const value = row.values[index] ?? 0;
      if (value <= 0) return;
      const height = value / maxValue * plotHeight;
      cursor -= height;
      const barTooltip = `${date} ${row.label} ${value}`;
      markup += `<rect class="dashboard-bar dashboard-${row.key}" x="${x.toFixed(1)}" y="${cursor.toFixed(1)}" width="${barWidth}" height="${height.toFixed(1)}" rx="3" data-dashboard-index="${index}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(barTooltip)}"></rect>`;
    });
    const target = Number(targetByDate[date]);
    if (target > 0) {
      const y = top + plotHeight - target / maxValue * plotHeight;
      const targetTooltip = `${date} 计划新学 ${target}`;
      markup += `<line class="dashboard-target-line" x1="${x - 4}" y1="${y.toFixed(1)}" x2="${x + barWidth + 4}" y2="${y.toFixed(1)}" data-dashboard-index="${index}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(targetTooltip)}"></line>`;
    }
    groups.push({
      index,
      x: x + barWidth / 2,
      detail: dashboardDateDetail(date, [
        ...rows.map((row) => `${date} ${row.label}：${row.values[index] ?? 0}`),
        `${date} 计划新学：${Number.isFinite(target) ? target : 0}`,
      ]),
    });
    if (index % (dates.length > 42 ? 7 : dates.length > 21 ? 3 : 1) === 0 || index === dates.length - 1) {
      markup += `<text class="dashboard-axis-label" x="${x + barWidth / 2}" y="${chartHeight - 10}" text-anchor="middle">${dashboardEscape(dashboardDateLabel(date))}</text>`;
    }
  });
  markup += "</svg>";
  dashboardSetMarkup(container, markup);
  dashboardEnhanceChart(container, {
    groups,
    plotTop: top,
    plotBottom: top + plotHeight,
    visibleScale: {
      resolve(indexes) {
        const values = indexes.flatMap((index) => [
          rows.reduce((sum, row) => sum + Number(row.values[index] ?? 0), 0),
          Number(targetByDate[dates[index]] ?? 0),
        ]);
        return { min: 0, max: Math.max(1, ...values) };
      },
      apply(svg, scale) {
        const range = Math.max(1, scale.max - scale.min);
        dates.forEach((date, index) => {
          let cursor = top + plotHeight;
          rows.forEach((row) => {
            const value = Number(row.values[index] ?? 0);
            const bar = svg.querySelector(`.dashboard-bar.dashboard-${row.key}[data-dashboard-index="${index}"]`);
            if (!bar || value <= 0) return;
            const height = value / range * plotHeight;
            cursor -= height;
            bar.setAttribute("y", cursor.toFixed(1));
            bar.setAttribute("height", height.toFixed(1));
          });
          const target = Number(targetByDate[date] ?? 0);
          const targetLine = svg.querySelector(`.dashboard-target-line[data-dashboard-index="${index}"]`);
          if (targetLine && target > 0) {
            const y = top + plotHeight - target / range * plotHeight;
            targetLine.setAttribute("y1", y.toFixed(1));
            targetLine.setAttribute("y2", y.toFixed(1));
          }
        });
      },
    },
  });
  if (summary) {
    dashboardSetMarkup(summary, rows.map((row) => `<span class="dashboard-summary-item"><i class="dashboard-dot dashboard-${row.key}"></i>${dashboardEscape(row.label)}</span>`).join("") +
      (Object.keys(targetByDate).length ? `<span class="dashboard-summary-item"><i class="dashboard-target-dot"></i>计划新学</span>` : ""));
  }
}

function dashboardRenderLineChart(container, dates, series, summary, options = {}) {
  if (!container) return;
  const hasValue = series.some((item) => item.values.some((value) => Number.isFinite(value)));
  if (!dates.length || !hasValue) {
    dashboardSetMarkup(container, dashboardChartEmpty(options.emptyMessage ?? "暂无数据"));
    dashboardSetDefaultDetail(container, dates.length ? `${dates.at(-1)}　暂无数据` : "暂无数据");
    if (summary) dashboardSetMarkup(summary, options.summary ?? "");
    return;
  }
  const chartWidth = Math.max(620, dates.length * 46);
  const chartHeight = 220;
  const left = 34;
  const right = 10;
  const top = 14;
  const bottom = 34;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const min = Number.isFinite(options.min) ? options.min : 0;
  const max = Number.isFinite(options.max) ? options.max : Math.max(1, ...series.flatMap((item) => item.values.filter(Number.isFinite)));
  const xFor = (index) => left + (dates.length <= 1 ? 0 : index * plotWidth / (dates.length - 1));
  const yFor = (value) => top + plotHeight - (value - min) / Math.max(1, max - min) * plotHeight;
  const groups = dates.map((date, index) => ({
    index,
    x: xFor(index),
    detail: dashboardDateDetail(date, series.map((item) => {
      if (item.tooltip?.[index]) return item.tooltip[index];
      const label = dashboardDisplayLabel(item.key, item.label);
      const value = item.values[index];
      return `${date} ${label}：${Number.isFinite(value) ? Number(value.toFixed?.(1) ?? value) : "暂无数据"}`;
    })),
  }));
  let markup = `<svg class="dashboard-svg" role="img" aria-label="${dashboardEscape(options.ariaLabel ?? "学习趋势图")}" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}">${dashboardSvgLabel(options.ariaLabel ?? "学习趋势图")}`;
  [0, 0.5, 1].forEach((ratio) => {
    const y = top + ratio * plotHeight;
    const value = max - ratio * (max - min);
    markup += `<line class="dashboard-grid-line" x1="${left}" y1="${y}" x2="${chartWidth - right}" y2="${y}" /><text class="dashboard-y-label" x="${left - 6}" y="${y + 4}" text-anchor="end">${dashboardEscape(Number(value.toFixed(1)))}</text>`;
  });
  series.forEach((item, seriesIndex) => {
    let segment = [];
    const segments = [];
    item.values.forEach((value, index) => {
      if (Number.isFinite(value)) {
        segment.push({ index, value });
      } else if (segment.length) {
        segments.push(segment);
        segment = [];
      }
    });
    if (segment.length) segments.push(segment);
    segments.filter((points) => points.length > 1).forEach((points) => {
      const pointMarkup = points.map((point) => `${xFor(point.index).toFixed(1)},${yFor(point.value).toFixed(1)}`).join(" ");
      const indexes = points.map((point) => point.index).join(",");
      markup += `<polyline class="dashboard-line dashboard-${item.key}" points="${pointMarkup}" fill="none" data-dashboard-series-index="${seriesIndex}" data-dashboard-indexes="${indexes}" />`;
    });
    item.values.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      const title = item.tooltip?.[index] ?? `${dates[index]} ${dashboardDisplayLabel(item.key, item.label)} ${value}`;
      markup += `<circle class="dashboard-point dashboard-${item.key}" cx="${xFor(index)}" cy="${yFor(value)}" r="3" data-dashboard-series-index="${seriesIndex}" data-dashboard-index="${index}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(title)}"></circle>`;
    });
  });
  dates.forEach((date, index) => {
    if (index % (dates.length > 42 ? 7 : dates.length > 21 ? 3 : 1) !== 0 && index !== dates.length - 1) return;
    markup += `<text class="dashboard-axis-label" x="${xFor(index)}" y="${chartHeight - 10}" text-anchor="middle">${dashboardEscape(dashboardDateLabel(date))}</text>`;
  });
  markup += "</svg>";
  dashboardSetMarkup(container, markup);
  dashboardEnhanceChart(container, {
    groups,
    plotTop: top,
    plotBottom: top + plotHeight,
    visibleScale: {
      resolve(indexes) {
        const values = indexes.flatMap((index) => series.map((item) => item.values[index]))
          .filter(Number.isFinite);
        if (!values.length) return null;
        return { min: Math.min(...values), max: Math.max(...values) };
      },
      apply(svg, scale) {
        const range = Math.max(Number.EPSILON, scale.max - scale.min);
        const scaledY = (value) => top + plotHeight - (value - scale.min) / range * plotHeight;
        series.forEach((item, seriesIndex) => {
          svg.querySelectorAll(`polyline[data-dashboard-series-index="${seriesIndex}"]`).forEach((line) => {
            const indexes = String(line.dataset.dashboardIndexes ?? "")
              .split(",")
              .map(Number)
              .filter(Number.isInteger);
            line.setAttribute("points", indexes.map((index) => (
              `${xFor(index).toFixed(1)},${scaledY(item.values[index]).toFixed(1)}`
            )).join(" "));
          });
          svg.querySelectorAll(`circle[data-dashboard-series-index="${seriesIndex}"]`).forEach((point) => {
            const index = Number(point.dataset.dashboardIndex);
            const value = item.values[index];
            if (Number.isFinite(value)) point.setAttribute("cy", scaledY(value).toFixed(1));
          });
        });
      },
    },
  });
  if (summary) dashboardSetMarkup(summary, series.map((item) => `<span class="dashboard-summary-item"><i class="dashboard-dot dashboard-${item.key}"></i>${dashboardEscape(dashboardDisplayLabel(item.key, item.label))}</span>`).join(""));
}

function dashboardActivityValues(bookState, bookWords, dates, unit) {
  const events = dashboardEventEntries(bookState, bookWords);
  const values = { new: [], reinforce: [], review: [] };
  dates.forEach((date) => {
    const activity = normalizeActivityEntry(bookState.activityLog?.[date]);
    const perSegment = { new: new Set(), reinforce: new Set(), review: new Set() };
    events.filter((event) => event.date === date).forEach((event) => {
      const segment = event.source === "review" ? "review"
        : event.source === "reinforcement" ? "reinforce"
          : event.source === "new" || event.source === "extra" || event.source === "advance" ? "new"
            : event.to === SENSE_STATUS.MASTERED && event.from === SENSE_STATUS.NEW ? "new"
              : event.to === SENSE_STATUS.REVIEW ? "reinforce" : null;
      if (segment) perSegment[segment].add(event.senseId);
    });
    if (unit === "word") {
      const wordSets = Object.fromEntries(Object.keys(perSegment).map((key) => [key, new Set()]));
      Object.entries(perSegment).forEach(([segment, keys]) => keys.forEach((key) => wordSets[segment].add(splitSenseKey(key).wordId)));
      if (!wordSets.new.size) activity.newWords.forEach((wordId) => wordSets.new.add(wordId));
      if (!wordSets.review.size) activity.reviewWords.forEach((wordId) => wordSets.review.add(wordId));
      values.new.push(wordSets.new.size);
      values.reinforce.push(wordSets.reinforce.size);
      values.review.push(wordSets.review.size);
      return;
    }
    if (!perSegment.new.size) {
      activity.newWords.forEach((wordId) => {
        const word = bookWords.find((entry) => entry.id === wordId);
        allSenseKeysForWord(word).forEach((key) => {
          const progress = bookState.progress?.[key];
          if (progress?.firstSeenActual === date || progress?.firstSeen === date) perSegment.new.add(key);
        });
      });
    }
    if (!perSegment.review.size) {
      activity.reviewWords.forEach((wordId) => {
        const word = bookWords.find((entry) => entry.id === wordId);
        allSenseKeysForWord(word).forEach((key) => {
          const progress = bookState.progress?.[key];
          if (progress?.lastSeenActual === date || progress?.lastSeen === date) perSegment.review.add(key);
        });
      });
    }
    values.new.push(perSegment.new.size);
    values.reinforce.push(perSegment.reinforce.size);
    values.review.push(perSegment.review.size);
  });
  return values;
}

function dashboardPlannedTargets(bookState, bookWords, dates, unit) {
  const targets = {};
  const introducedBeforeDate = (date) => {
    const ids = new Set();
    Object.entries(bookState.activityLog ?? {}).forEach(([entryDate, entry]) => {
      if (entryDate >= date) return;
      normalizeActivityEntry(entry).newWords.forEach((wordId) => ids.add(String(wordId)));
    });
    return ids;
  };
  dates.forEach((date) => {
    const activity = normalizeActivityEntry(bookState.activityLog?.[date]);
    const wordTarget = Math.max(
      0,
      Number(
        Number.isFinite(activity.target)
          ? activity.target
          : targetForBookDate(bookState, date),
      ) || 0,
    );
    if (unit === "word") {
      targets[date] = wordTarget;
      return;
    }
    const alreadyIntroduced = introducedBeforeDate(date);
    const plannedWordIds = [];
    activity.newWords.forEach((wordId) => {
      if (plannedWordIds.length < wordTarget && !plannedWordIds.includes(String(wordId))) {
        plannedWordIds.push(String(wordId));
      }
    });
    for (const word of bookWords) {
      if (plannedWordIds.length >= wordTarget) break;
      const wordId = String(word.id);
      if (alreadyIntroduced.has(wordId) || plannedWordIds.includes(wordId)) continue;
      plannedWordIds.push(wordId);
    }
    const senseIds = new Set();
    plannedWordIds.forEach((wordId) => {
      const word = bookWords.find((entry) => String(entry.id) === wordId);
      allSenseKeysForWord(word).forEach((key) => senseIds.add(key));
    });
    targets[date] = senseIds.size;
  });
  return targets;
}

function dashboardPoolSeries(bookState, bookWords, dates, unit) {
  const snapshots = bookState.dashboardSnapshots ?? {};
  const bookId = bookIdForState(bookState);
  const snapshotHistory = Object.values(snapshots)
    .filter((entry) => entry?.bookId === bookId && /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? ""))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  const keys = dashboardSenseKeys(bookWords);
  return [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].map((status) => ({
    key: status,
    label: status === SENSE_STATUS.REINFORCE ? "待强化" : "待复习",
    values: dates.map((date) => {
      const snapshot = snapshots[dashboardSnapshotKey(bookId, date)] ??
        [...snapshotHistory].reverse().find((entry) => entry.date <= date);
      if (!snapshot) return null;
      const statusKeys = keys.filter((key) => snapshot.statuses?.[key] === status);
      if (unit === "word") return new Set(statusKeys.map((key) => splitSenseKey(key).wordId)).size;
      return statusKeys.length;
    }),
  }));
}

function bookIdForState(bookState) {
  return Object.entries(rootState?.bookStates ?? {}).find(([, value]) => value === bookState)?.[0] ?? dashboardBookId ?? activeBookId();
}

function dashboardConversionSeries(bookState, dates) {
  const events = dashboardEventEntries(bookState, dashboardWords(bookIdForState(bookState)));
  const isReliableOutcome = (event) => event.outcome === true ||
    (event.from !== SENSE_STATUS.REINFORCE && !["reset", "relearn"].includes(event.source));
  const hasReliableConversionEvidence = events.some(isReliableOutcome);
  const definitions = [
    ["new-mastered", "新学 → 掌握", SENSE_STATUS.NEW, SENSE_STATUS.MASTERED],
    ["reinforce-review", "强化 → 复习", SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW],
    ["review-mastered", "复习 → 掌握", SENSE_STATUS.REVIEW, SENSE_STATUS.MASTERED],
  ];
  return definitions.map(([key, label, from, to]) => {
    const tooltip = [];
    const values = dates.map((date, index) => {
      const reliableOutcomes = events.filter((event) => {
        if (event.date !== date || event.from !== from) return false;
        return isReliableOutcome(event);
      });
      const source = new Set(reliableOutcomes
        .filter((event) => event.to === to)
        .map((event) => event.senseId));
      const denominator = new Set(reliableOutcomes.map((event) => event.senseId));
      if (denominator.size === 0) {
        tooltip[index] = `${date} ${label}：0/0（按 0% 计）`;
        return hasReliableConversionEvidence ? 0 : null;
      }
      tooltip[index] = `${date} ${label}：${source.size}/${denominator.size}（${Math.round(source.size / denominator.size * 100)}%）`;
      return source.size / denominator.size * 100;
    });
    return { key, label, values, tooltip };
  });
}

function dashboardHoldSeries(bookState, bookWords, dates) {
  const snapshots = bookState.dashboardSnapshots ?? {};
  const bookId = bookIdForState(bookState);
  const snapshotHistory = Object.values(snapshots)
    .filter((entry) => entry?.bookId === bookId && /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? ""))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  const eventsBySense = new Map();
  dashboardEventEntries(bookState, bookWords).forEach((event) => {
    if (event.from === event.to || !event.observedAt) return;
    const entries = eventsBySense.get(event.senseId) ?? [];
    entries.push(event);
    eventsBySense.set(event.senseId, entries);
  });
  eventsBySense.forEach((events) => {
    events.sort((left, right) => String(left.observedAt).localeCompare(String(right.observedAt)));
  });
  const snapshotAtOrBefore = (date) => snapshots[dashboardSnapshotKey(bookId, date)] ??
    [...snapshotHistory].reverse().find((entry) => entry.date <= date);
  const endTimestamp = (date) => {
    const end = parseDate(addDays(date, 1)).getTime() - 1;
    return date === currentDate() ? Math.min(Date.now(), end) : end;
  };
  const enteredTimestamp = (key, status, date, snapshot) => {
    const direct = Date.parse(snapshot.enteredAt?.[key] ?? "");
    if (Number.isFinite(direct)) return direct;
    const end = endTimestamp(date);
    const event = [...(eventsBySense.get(key) ?? [])].reverse().find((entry) => {
      const observedAt = Date.parse(entry.observedAt);
      return entry.to === status && Number.isFinite(observedAt) && observedAt <= end;
    });
    if (event) return Date.parse(event.observedAt);

    let earliestMatchingDate = null;
    for (const entry of [...snapshotHistory].reverse()) {
      if (entry.date > date) continue;
      if (entry.statuses?.[key] !== status) break;
      earliestMatchingDate = entry.date;
      const historical = Date.parse(entry.enteredAt?.[key] ?? "");
      if (Number.isFinite(historical)) return historical;
    }

    const progress = bookState.progress?.[key];
    if (progress?.status === status) {
      const fallback = Date.parse(dashboardProgressEnteredAt(progress) ?? "");
      if (Number.isFinite(fallback) && fallback <= end) return fallback;
    }
    return earliestMatchingDate ? parseDate(earliestMatchingDate).getTime() : NaN;
  };
  return [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].map((status) => {
    const tooltip = [];
    const values = dates.map((date, index) => {
      const snapshot = snapshotAtOrBefore(date);
      if (!snapshot) {
        tooltip[index] = `${date}：暂无数据`;
        return null;
      }
      const keys = dashboardSenseKeys(bookWords).filter((key) => snapshot.statuses?.[key] === status);
      const durations = keys.map((key) => {
        const time = enteredTimestamp(key, status, date, snapshot);
        const end = endTimestamp(date);
        return Number.isFinite(time) && Number.isFinite(end) && end >= time ? (end - time) / DAY_MS : null;
      }).filter(Number.isFinite);
      if (!durations.length) {
        tooltip[index] = `${date}：暂无数据`;
        return null;
      }
      const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
      tooltip[index] = `${date} ${status === SENSE_STATUS.REINFORCE ? "强化" : "复习"}：${durations.length}，平均 ${average.toFixed(1)} 天`;
      return average;
    });
    return { key: status === SENSE_STATUS.REINFORCE ? "hold-reinforce" : "hold-review", label: status === SENSE_STATUS.REINFORCE ? "强化停留" : "复习停留", values, tooltip };
  });
}

function dashboardSankeyData(bookState, bookWords, start, end) {
  const flows = new Map();
  const uniqueSenseIds = new Set();
  const addFlow = (senseId, from, to) => {
    if (from === to) return;
    const allowed = (from === SENSE_STATUS.NEW && [SENSE_STATUS.REINFORCE, SENSE_STATUS.MASTERED].includes(to)) ||
      (from === SENSE_STATUS.REINFORCE && to === SENSE_STATUS.REVIEW) ||
      (from === SENSE_STATUS.REVIEW && [SENSE_STATUS.MASTERED, SENSE_STATUS.REINFORCE].includes(to));
    if (!allowed) return;
    uniqueSenseIds.add(senseId);
    const flowKey = `${from}|${to}`;
    const flow = flows.get(flowKey) ?? { from, to, senseIds: new Set() };
    flow.senseIds.add(senseId);
    flows.set(flowKey, flow);
  };

  const events = dashboardEventEntries(bookState, bookWords)
    .filter((event) => event.date >= start && event.date <= end);
  events.forEach((event) => addFlow(event.senseId, event.from, event.to));
  if (events.length) {
    return {
      flows: [...flows.values()].map(({ senseIds, ...flow }) => ({ ...flow, count: senseIds.size })),
      uniqueSenseCount: uniqueSenseIds.size,
      insufficient: false,
    };
  }

  const snapshots = bookState.dashboardSnapshots ?? {};
  const bookId = bookIdForState(bookState);
  const snapshotHistory = Object.values(snapshots)
    .filter((entry) => entry?.bookId === bookId && repairDateKey(entry.date))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  const snapshotAtOrBefore = (date) => snapshots[dashboardSnapshotKey(bookId, date)] ??
    [...snapshotHistory].reverse().find((entry) => entry.date <= date);
  const startSnapshot = snapshotAtOrBefore(start);
  const endSnapshot = snapshotAtOrBefore(end);
  if (!startSnapshot || !endSnapshot) return { flows: [], insufficient: true };
  dashboardSenseKeys(bookWords).forEach((key) => {
    const from = startSnapshot.statuses?.[key] ?? SENSE_STATUS.NEW;
    const to = endSnapshot.statuses?.[key] ?? SENSE_STATUS.NEW;
    addFlow(key, from, to);
  });
  return {
    flows: [...flows.values()].map(({ senseIds, ...flow }) => ({ ...flow, count: senseIds.size })),
    uniqueSenseCount: uniqueSenseIds.size,
    insufficient: false,
  };
}

function dashboardRenderStatusBar(bookState, bookWords, unit) {
  if (!dashboardStatusBar || !dashboardStatusLegend) return;
  const counts = dashboardCountStatuses(bookState, bookWords, unit);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  dashboardStatusBar.replaceChildren();
  DASHBOARD_STATUS_META.forEach((meta) => {
    const value = counts[meta.key] ?? 0;
    const segment = document.createElement("span");
    segment.className = `dashboard-status-segment dashboard-status-${meta.key}`;
    segment.style.width = `${total ? value / total * 100 : 0}%`;
    segment.setAttribute("aria-label", `${meta.label} ${value}，${total ? Math.round(value / total * 100) : 0}%`);
    segment.textContent = "";
    dashboardStatusBar.append(segment);
  });
  dashboardStatusBar.setAttribute("aria-label", `词书状态：${DASHBOARD_STATUS_META.map((meta) => `${meta.label} ${counts[meta.key] ?? 0}`).join("，")}`);
  dashboardSetMarkup(dashboardStatusLegend, DASHBOARD_STATUS_META.map((meta) => `<span class="dashboard-legend-item" data-dashboard-status="${meta.key}"><i class="dashboard-status-swatch dashboard-status-${meta.key}"></i>${meta.label} ${counts[meta.key] ?? 0}（${total ? Math.round((counts[meta.key] ?? 0) / total * 100) : 0}%）</span>`).join(""));
  dashboardEnhanceStatusBar(counts, total);
}

const DASHBOARD_SANKEY_SIZE = Object.freeze({ width: 760, height: 300 });
const DASHBOARD_SANKEY_NODE_WIDTH = 16;
const DASHBOARD_SANKEY_MAX_NODE_HEIGHT = 118;
const DASHBOARD_SANKEY_FLOW_GAP = 4;
const DASHBOARD_SANKEY_STATIONS = Object.freeze({
  [SENSE_STATUS.NEW]: 48,
  [SENSE_STATUS.REINFORCE]: 254,
  [SENSE_STATUS.REVIEW]: 460,
  [SENSE_STATUS.MASTERED]: 640,
});

function dashboardSankeyRouteMeta(from, to) {
  if (from === SENSE_STATUS.NEW && to === SENSE_STATUS.MASTERED) {
    return { lane: "direct", sourceOrder: 0, targetOrder: 0 };
  }
  if (from === SENSE_STATUS.REINFORCE && to === SENSE_STATUS.REVIEW) {
    return { lane: "forward", sourceOrder: 0, targetOrder: 0 };
  }
  if (from === SENSE_STATUS.REVIEW && to === SENSE_STATUS.REINFORCE) {
    return { lane: "return", sourceOrder: 1, targetOrder: 0 };
  }
  if (from === SENSE_STATUS.REVIEW && to === SENSE_STATUS.MASTERED) {
    return { lane: "forward", sourceOrder: 0, targetOrder: 1 };
  }
  return { lane: "forward", sourceOrder: 1, targetOrder: 0 };
}

function dashboardSankeyLayout(flows) {
  const nodeDefinitions = [
    { id: SENSE_STATUS.NEW, status: SENSE_STATUS.NEW, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.NEW], column: 0 },
    { id: SENSE_STATUS.REINFORCE, status: SENSE_STATUS.REINFORCE, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.REINFORCE], column: 1 },
    { id: SENSE_STATUS.REVIEW, status: SENSE_STATUS.REVIEW, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.REVIEW], column: 2 },
    { id: SENSE_STATUS.MASTERED, status: SENSE_STATUS.MASTERED, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.MASTERED], column: 3 },
    { id: "reinforce-return", status: SENSE_STATUS.REINFORCE, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.MASTERED], column: 3 },
  ];
  const layouts = flows.map((flow) => ({
    ...flow,
    key: `${flow.from}|${flow.to}`,
    ...dashboardSankeyRouteMeta(flow.from, flow.to),
    sourceNodeId: flow.from,
    targetNodeId: flow.from === SENSE_STATUS.REVIEW && flow.to === SENSE_STATUS.REINFORCE
      ? "reinforce-return"
      : flow.to,
  }));
  const nodeTraffic = Object.fromEntries(nodeDefinitions.map((node) => [node.id, {
    incoming: 0,
    outgoing: 0,
    incomingFlows: [],
    outgoingFlows: [],
  }]));
  layouts.forEach((flow) => {
    const source = nodeTraffic[flow.sourceNodeId];
    const target = nodeTraffic[flow.targetNodeId];
    source.outgoing += flow.count;
    target.incoming += flow.count;
    source.outgoingFlows.push(flow);
    target.incomingFlows.push(flow);
  });
  const maxTraffic = Math.max(1, ...Object.values(nodeTraffic).map((traffic) => (
    Math.max(traffic.incoming, traffic.outgoing)
  )));
  const unitScale = DASHBOARD_SANKEY_MAX_NODE_HEIGHT / maxTraffic;
  layouts.forEach((flow) => {
    flow.thickness = Math.max(4, flow.count * unitScale);
  });
  const sideHeight = (items) => items.reduce((sum, flow) => sum + flow.thickness, 0) +
    Math.max(0, items.length - 1) * DASHBOARD_SANKEY_FLOW_GAP;
  const nodes = nodeDefinitions.map((definition) => {
    const traffic = nodeTraffic[definition.id];
    traffic.outgoingFlows.sort((left, right) => left.sourceOrder - right.sourceOrder);
    traffic.incomingFlows.sort((left, right) => left.targetOrder - right.targetOrder);
    return {
      ...definition,
      incoming: traffic.incoming,
      outgoing: traffic.outgoing,
      incomingFlows: traffic.incomingFlows,
      outgoingFlows: traffic.outgoingFlows,
      value: Math.max(traffic.incoming, traffic.outgoing),
      height: Math.max(12, sideHeight(traffic.incomingFlows), sideHeight(traffic.outgoingFlows)),
    };
  });
  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  [SENSE_STATUS.NEW].forEach((id) => {
    nodeById[id].y = 92 - nodeById[id].height / 2;
  });
  [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].forEach((id) => {
    nodeById[id].y = 188 - nodeById[id].height / 2;
  });
  const finalNodes = [nodeById[SENSE_STATUS.MASTERED], nodeById["reinforce-return"]]
    .filter((node) => node.value > 0);
  const finalGap = 22;
  const finalHeight = finalNodes.reduce((sum, node) => sum + node.height, 0) +
    Math.max(0, finalNodes.length - 1) * finalGap;
  let finalY = Math.max(22, 130 - finalHeight / 2);
  finalNodes.forEach((node) => {
    node.y = finalY;
    finalY += node.height + finalGap;
  });
  nodes.filter((node) => !Number.isFinite(node.y)).forEach((node) => {
    node.y = 188 - node.height / 2;
  });
  nodes.forEach((node) => {
    const assign = (items, endpoint) => {
      const height = sideHeight(items);
      let cursorY = node.y + (node.height - height) / 2;
      items.forEach((flow) => {
        if (endpoint === "source") flow.sourceTop = cursorY;
        else flow.targetTop = cursorY;
        cursorY += flow.thickness + DASHBOARD_SANKEY_FLOW_GAP;
      });
    };
    assign(node.outgoingFlows, "source");
    assign(node.incomingFlows, "target");
  });
  return { flows: layouts, nodes };
}

function dashboardSankeyBandPath(flow) {
  const sourceX = DASHBOARD_SANKEY_STATIONS[flow.from] + DASHBOARD_SANKEY_NODE_WIDTH / 2;
  const targetX = (flow.targetNodeId === "reinforce-return"
    ? DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.MASTERED]
    : DASHBOARD_SANKEY_STATIONS[flow.to]) - DASHBOARD_SANKEY_NODE_WIDTH / 2;
  const span = targetX - sourceX;
  const firstControlX = sourceX + span * 0.44;
  const secondControlX = targetX - span * 0.44;
  const sourceBottom = flow.sourceTop + flow.thickness;
  const targetBottom = flow.targetTop + flow.thickness;
  return `M ${sourceX} ${flow.sourceTop} C ${firstControlX} ${flow.sourceTop}, ${secondControlX} ${flow.targetTop}, ${targetX} ${flow.targetTop} L ${targetX} ${targetBottom} C ${secondControlX} ${targetBottom}, ${firstControlX} ${sourceBottom}, ${sourceX} ${sourceBottom} Z`;
}

function dashboardSankeyMotionPath(flow) {
  const sourceX = DASHBOARD_SANKEY_STATIONS[flow.from] + DASHBOARD_SANKEY_NODE_WIDTH / 2;
  const targetX = (flow.targetNodeId === "reinforce-return"
    ? DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.MASTERED]
    : DASHBOARD_SANKEY_STATIONS[flow.to]) - DASHBOARD_SANKEY_NODE_WIDTH / 2;
  const sourceY = flow.sourceTop + flow.thickness / 2;
  const targetY = flow.targetTop + flow.thickness / 2;
  const span = targetX - sourceX;
  return `M ${sourceX} ${sourceY} C ${sourceX + span * 0.44} ${sourceY}, ${targetX - span * 0.44} ${targetY}, ${targetX} ${targetY}`;
}

function dashboardEnableSankeyPanZoom(frame, canvas, svg) {
  const controller = new AbortController();
  const signal = controller.signal;
  const baseWidth = DASHBOARD_SANKEY_SIZE.width;
  const baseHeight = DASHBOARD_SANKEY_SIZE.height;
  const mobile = frame.clientWidth <= 560;
  const fitScale = Math.min(
    Math.max(0.1, (frame.clientWidth - 20) / baseWidth),
    Math.max(0.1, (frame.clientHeight - 20) / baseHeight),
  );
  const initialScale = Math.min(mobile ? 1.5 : 1.25, fitScale);
  const minScale = Math.max(0.1, initialScale * 0.82);
  const maxScale = mobile ? 1.5 : 1.4;
  let scale = initialScale;
  let panX = 0;
  let panY = 0;
  let drag = null;

  const clampPan = () => {
    const padding = 10;
    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;
    if (scaledWidth <= frame.clientWidth - padding * 2) {
      panX = (frame.clientWidth - scaledWidth) / 2;
    } else {
      panX = Math.min(padding, Math.max(frame.clientWidth - scaledWidth - padding, panX));
    }
    if (scaledHeight <= frame.clientHeight - padding * 2) {
      panY = (frame.clientHeight - scaledHeight) / 2;
    } else {
      panY = Math.min(padding, Math.max(frame.clientHeight - scaledHeight - padding, panY));
    }
  };

  const applyTransform = () => {
    clampPan();
    canvas.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
    frame.dataset.sankeyScale = scale.toFixed(3);
    frame.dataset.sankeyMinScale = minScale.toFixed(3);
    frame.dataset.sankeyMaxScale = maxScale.toFixed(3);
  };

  const resetTransform = () => {
    scale = initialScale;
    panX = (frame.clientWidth - baseWidth * scale) / 2;
    panY = (frame.clientHeight - baseHeight * scale) / 2;
    applyTransform();
  };

  const zoomTo = (nextScale) => {
    const clampedScale = Math.min(maxScale, Math.max(minScale, nextScale));
    const centerX = frame.clientWidth / 2;
    const centerY = frame.clientHeight / 2;
    const contentX = (centerX - panX) / scale;
    const contentY = (centerY - panY) / scale;
    scale = clampedScale;
    panX = centerX - contentX * scale;
    panY = centerY - contentY * scale;
    applyTransform();
  };

  const controls = document.createElement("div");
  controls.className = "dashboard-sankey-controls";
  controls.setAttribute("aria-label", "流转图缩放控制");
  [
    ["缩小流转图", "−", () => zoomTo(scale / 1.2)],
    ["复位流转图", "↺", resetTransform],
    ["放大流转图", "+", () => zoomTo(scale * 1.2)],
  ].forEach(([label, text, handler]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dashboard-sankey-control";
    button.setAttribute("aria-label", label);
    button.textContent = text;
    button.addEventListener("click", handler, { signal });
    controls.append(button);
  });
  const hint = document.createElement("span");
  hint.className = "dashboard-sankey-gesture-hint";
  hint.textContent = "拖动或缩放查看";
  frame.append(controls, hint);
  frame.tabIndex = 0;
  frame.setAttribute("aria-label", "义项状态流转图，可拖动，并可使用加减按钮缩放");

  frame.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".dashboard-sankey-controls")) return;
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
    frame.setPointerCapture(event.pointerId);
    frame.classList.add("is-dragging");
  }, { signal });
  frame.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    panX = drag.panX + event.clientX - drag.x;
    panY = drag.panY + event.clientY - drag.y;
    applyTransform();
  }, { signal });
  const finishDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    frame.classList.remove("is-dragging");
    if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
  };
  frame.addEventListener("pointerup", finishDrag, { signal });
  frame.addEventListener("pointercancel", finishDrag, { signal });
  frame.addEventListener("dblclick", resetTransform, { signal });
  frame.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomTo(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { signal, passive: false });
  frame.addEventListener("keydown", (event) => {
    if (event.target !== frame) return;
    const step = 28;
    if (event.key === "+" || event.key === "=") zoomTo(scale * 1.2);
    else if (event.key === "-") zoomTo(scale / 1.2);
    else if (event.key === "Home") resetTransform();
    else if (event.key === "ArrowLeft") panX += step;
    else if (event.key === "ArrowRight") panX -= step;
    else if (event.key === "ArrowUp") panY += step;
    else if (event.key === "ArrowDown") panY -= step;
    else return;
    event.preventDefault();
    applyTransform();
  }, { signal });

  const resizeObserver = new ResizeObserver(() => applyTransform());
  resizeObserver.observe(frame);
  resetTransform();
  dashboardSankeyCleanup = () => {
    controller.abort();
    resizeObserver.disconnect();
  };
}

function dashboardRenderSankey(bookState, bookWords, start, end) {
  dashboardSankeyCleanup?.();
  dashboardSankeyCleanup = null;
  const data = dashboardSankeyData(bookState, bookWords, start, end);
  if (data.insufficient || !data.flows.length) {
    dashboardSetMarkup(
      dashboardSankeyChart,
      dashboardChartEmpty(data.insufficient ? "暂无数据" : "所选时间暂无状态变化"),
    );
    dashboardSetDefaultDetail(
      dashboardSankeyChart,
      data.insufficient ? `${start} 至 ${end}　暂无数据` : `${start} 至 ${end}　暂无状态变化`,
    );
    dashboardSankeySummary.textContent = "";
    return;
  }
  const sourceTotals = data.flows.reduce((totals, flow) => {
    totals[flow.from] = (totals[flow.from] ?? 0) + flow.count;
    return totals;
  }, {});
  const layout = dashboardSankeyLayout(data.flows);
  const statusColors = { new: "#68727d", reinforce: "#c77d2d", review: "#0f766e", mastered: "#16a34a" };
  let markup = `<svg class="dashboard-svg dashboard-sankey-svg" role="img" aria-label="义项状态流转流水线" viewBox="0 0 ${DASHBOARD_SANKEY_SIZE.width} ${DASHBOARD_SANKEY_SIZE.height}" width="${DASHBOARD_SANKEY_SIZE.width}" height="${DASHBOARD_SANKEY_SIZE.height}" aria-describedby="dashboardSankeySummary">`;
  markup += `<defs><filter id="dashboardSankeyParticleGlow" x="-250%" y="-250%" width="600%" height="600%"><feGaussianBlur stdDeviation="2.2" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs>`;
  layout.flows.forEach((flow, flowIndex) => {
    const percent = Math.round(flow.count / sourceTotals[flow.from] * 100);
    const fromLabel = dashboardDisplayLabel(flow.from, flow.from);
    const toLabel = dashboardDisplayLabel(flow.to, flow.to);
    const label = `${fromLabel} → ${toLabel}：${flow.count} 个义项（占${fromLabel}流出 ${percent}%）`;
    const bandPath = dashboardSankeyBandPath(flow);
    const motionPath = dashboardSankeyMotionPath(flow);
    markup += `<path class="dashboard-sankey-flow dashboard-status-${flow.from}" data-flow-from="${flow.from}" data-flow-to="${flow.to}" data-flow-target-node="${flow.targetNodeId}" data-flow-lane="${flow.lane}" data-flow-source-top="${flow.sourceTop.toFixed(3)}" data-flow-target-top="${flow.targetTop.toFixed(3)}" data-flow-count="${flow.count}" data-flow-thickness="${flow.thickness.toFixed(3)}" d="${bandPath}" fill="${statusColors[flow.from]}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(label)}"></path>`;
    const particleCount = flow.thickness >= 28 ? 4 : 3;
    const duration = 3.2 + flowIndex * 0.16;
    markup += `<g class="dashboard-sankey-particles" aria-hidden="true">`;
    for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
      const begin = -(duration * particleIndex / particleCount);
      const radius = 1.5 + (particleIndex % 3) * 0.45;
      markup += `<circle class="dashboard-sankey-particle" r="${radius.toFixed(2)}" fill="${statusColors[flow.from]}" filter="url(#dashboardSankeyParticleGlow)"><animate attributeName="opacity" values="0;0.78;0.5;0" keyTimes="0;0.14;0.84;1" dur="${duration.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"></animate><animateMotion path="${motionPath}" dur="${duration.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"></animateMotion></circle>`;
    }
    markup += `</g>`;
  });
  layout.nodes.forEach((node) => {
    if (!node?.value) return;
    const status = node.status;
    const label = dashboardDisplayLabel(status, status);
    const nodeTooltip = `${label}：${node.value}（流入 ${node.incoming}，流出 ${node.outgoing}）`;
    const terminal = node.column === 3;
    const labelBelow = !terminal && (
      status === SENSE_STATUS.REINFORCE || status === SENSE_STATUS.REVIEW
    );
    const labelX = terminal ? node.x + 18 : node.x;
    const labelY = terminal
      ? node.y + node.height / 2 + 6
      : labelBelow
        ? node.y + node.height + 24
        : Math.max(24, node.y - 14);
    markup += `<rect class="dashboard-sankey-node dashboard-status-${status}" data-node-id="${node.id}" data-dashboard-status="${status}" data-node-value="${node.value}" data-node-incoming="${node.incoming}" data-node-outgoing="${node.outgoing}" x="${node.x - DASHBOARD_SANKEY_NODE_WIDTH / 2}" y="${node.y.toFixed(3)}" width="${DASHBOARD_SANKEY_NODE_WIDTH}" height="${node.height.toFixed(3)}" rx="4" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(nodeTooltip)}"></rect>`;
    markup += `<text class="dashboard-sankey-label" data-label-status="${status}" data-label-node="${node.id}" x="${labelX}" y="${labelY.toFixed(3)}" text-anchor="${terminal ? "start" : "middle"}">${dashboardEscape(label)}</text>`;
  });
  markup += "</svg>";
  dashboardSetMarkup(dashboardSankeyChart, markup);
  const svg = dashboardSankeyChart.querySelector("svg");
  if (svg) {
    const frame = document.createElement("div");
    frame.className = "dashboard-sankey-frame";
    const canvas = document.createElement("div");
    canvas.className = "dashboard-sankey-canvas";
    canvas.append(svg);
    frame.append(canvas);
    dashboardSankeyChart.replaceChildren(frame);
    dashboardBindChartInteractions(frame);
    dashboardEnableSankeyPanZoom(frame, canvas, svg);
    dashboardSetDefaultDetail(frame, `${start} 至 ${end}　${data.uniqueSenseCount} 个义项发生状态流转`);
  }
  dashboardSetMarkup(
    dashboardSankeySummary,
    `<table class="dashboard-accessible-table"><caption>状态流转明细</caption><thead><tr><th>起始</th><th>结束</th><th>义项数</th><th>起始状态占比</th></tr></thead><tbody>${data.flows.map((flow) => `<tr><td>${dashboardEscape(dashboardDisplayLabel(flow.from, flow.from))}</td><td>${dashboardEscape(dashboardDisplayLabel(flow.to, flow.to))}</td><td>${flow.count}</td><td>${Math.round(flow.count / sourceTotals[flow.from] * 100)}%</td></tr>`).join("")}</tbody></table>`,
  );
}

function renderDashboard() {
  if (!state || !dashboardDailyChart) return;
  dashboardApplyUserCopy();
  if (dashboardHeading) dashboardHeading.hidden = true;
  if (dashboardSubtitle) dashboardSubtitle.hidden = true;
  if (!dashboardBookId || !rootState.bookStates[dashboardBookId]) dashboardBookId = activeBookId();
  if (dashboardBookSelect && vocabularyBundle?.books) {
    const optionSignature = [...dashboardBookSelect.options].map((option) => option.value).join("|");
    const nextSignature = vocabularyBundle.books.map((book) => book.id).join("|");
    if (optionSignature !== nextSignature) {
      dashboardBookSelect.replaceChildren(
        ...vocabularyBundle.books.map((book) => {
          const option = document.createElement("option");
          option.value = book.id;
          option.textContent = String(book.displayName ?? book.name ?? book.id).replace(/[《》]/g, "");
          return option;
        }),
      );
    }
    dashboardBookSelect.value = dashboardBookId ?? activeBookId();
  }
  if (dashboardUnitSelect) dashboardUnitSelect.value = dashboardUnit;
  if (dashboardRangeSelect) dashboardRangeSelect.value = String(dashboardRangeDays);
  const bookId = dashboardBookId;
  const bookState = dashboardBookState(bookId);
  const bookWords = dashboardWords(bookId);
  const dates = dashboardDateList(dashboardRangeDays);
  const unitLabel = dashboardUnit === "word" ? "单词" : "义项";
  dashboardDailyUnitLabel.textContent = unitLabel;
  dashboardStatusUnitLabel.textContent = unitLabel;
  dashboardQuality.textContent = "";
  const activity = dashboardActivityValues(bookState, bookWords, dates, dashboardUnit);
  const targetByDate = dashboardPlannedTargets(bookState, bookWords, dates, dashboardUnit);
  dashboardRenderStackedBars(
    dashboardDailyChart,
    dates,
    [
      { key: "new", label: "新学", values: activity.new },
      { key: "reinforce", label: "强化", values: activity.reinforce },
      { key: "review", label: "复习", values: activity.review },
    ],
    dashboardDailySummary,
    targetByDate,
    unitLabel,
  );
  dashboardRenderStatusBar(bookState, bookWords, dashboardUnit);
  const pool = dashboardPoolSeries(bookState, bookWords, dates, dashboardUnit);
  dashboardRenderLineChart(dashboardPoolChart, dates, pool, dashboardPoolSummary, {
    ariaLabel: "待强化和待复习池数量趋势",
    emptyMessage: "暂无数据",
  });
  dashboardPoolQuality.textContent = "";
  const conversion = dashboardConversionSeries(bookState, dates);
  dashboardRenderLineChart(dashboardConversionChart, dates, conversion, dashboardConversionSummary, {
    ariaLabel: "每日义项转化率",
    emptyMessage: "暂无数据",
  });
  dashboardConversionQuality.textContent = "";
  const hold = dashboardHoldSeries(bookState, bookWords, dates);
  dashboardRenderLineChart(dashboardHoldChart, dates, hold, dashboardHoldSummary, {
    ariaLabel: "池内平均状态保持时间",
    emptyMessage: "暂无数据",
  });
  dashboardHoldQuality.textContent = "";
  if (!dashboardStartDate.value) dashboardStartDate.value = dates[0];
  if (!dashboardEndDate.value) dashboardEndDate.value = dates.at(-1);
  const start = dashboardStartDate.value;
  const end = dashboardEndDate.value;
  dashboardRenderSankey(bookState, bookWords, start <= end ? start : end, start <= end ? end : start);
}

function applyAccountBootstrapGate() {
  const pending = document.documentElement.dataset.accountReady !== "true";
  [studyPanel, wordListPanel, dashboardPanel, settingsPanel, dataPanel, confusionPanel]
    .forEach((panel) => {
    panel.inert = pending;
  });
  if (!pending) {
    const persistenceSafe = isPersistenceSafe();
    planButton.disabled = !persistenceSafe;
    wordListButton.disabled = !persistenceSafe;
    globalDashboardNavButton.disabled = !persistenceSafe;
    globalSettingsNavButton.disabled = false;
    dataButton.disabled = false;
    return;
  }
  planButton.disabled = true;
  wordListButton.disabled = true;
  globalDashboardNavButton.disabled = true;
  globalSettingsNavButton.disabled = true;
  dataButton.disabled = true;
  startStudyButton.disabled = true;
  advanceStudyButton.disabled = true;
}

function resetStudyScrollPosition({ resetPage = false } = {}) {
  const reset = () => {
    if (studyCardViewport) {
      studyCardViewport.scrollLeft = 0;
      studyCardViewport.scrollTop = 0;
    }
    if (resetPage) {
      const scrollingElement = document.scrollingElement;
      if (scrollingElement) {
        scrollingElement.scrollLeft = 0;
        scrollingElement.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    }
  };

  reset();
  if (studyScrollResetFrame !== null) {
    window.cancelAnimationFrame(studyScrollResetFrame);
  }
  studyScrollResetFrame = window.requestAnimationFrame(() => {
    studyScrollResetFrame = null;
    reset();
  });
}

function fitWordText() {
  wordFitFrame = null;
  wordText.style.fontSize = "";
  const maximum = revealButton.classList.contains("is-finished") ? 78 : 93;
  wordText.style.fontSize = `${maximum}px`;
  const buttonStyle = window.getComputedStyle(revealButton);
  const horizontalPadding =
    Number.parseFloat(buttonStyle.paddingLeft) +
    Number.parseFloat(buttonStyle.paddingRight);
  const cardWidth = revealButton.parentElement?.clientWidth ?? revealButton.clientWidth;
  const available = Math.max(
    96,
    Math.min(revealButton.clientWidth, cardWidth) - horizontalPadding,
  );
  const measured = Math.max(
    wordText.getBoundingClientRect().width,
    wordText.scrollWidth,
  );
  if (measured > available) {
    const fitted = Math.max(18, Math.floor(maximum * available / measured));
    wordText.style.fontSize = `${fitted}px`;
  }
}

function scheduleWordFit() {
  if (wordFitFrame !== null) {
    window.cancelAnimationFrame(wordFitFrame);
  }
  wordFitFrame = window.requestAnimationFrame(fitWordText);
}

function renderHome() {
  const target = state.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET;
  const completed = completedWordCount();
  const remaining = remainingWordCount();
  const button = studyButtonState();
  const todayCounts = todayPlanCounts();
  updatePlanDrift();
  if (homeBookName) homeBookName.textContent = bookDisplayName();

  homeCompletedWords.textContent = completed;
  homeRemainingWords.textContent = remaining;
  homeCompletionDate.textContent = hasPlan() ? plannedCompletionDate(target) : "-";
  todayNewCount.textContent = todayCounts.newWords;
  todayReinforceCount.textContent = todayCounts.reinforceWords;
  todayReviewCount.textContent = todayCounts.reviewWords;

  if (hasPlan()) {
    const progressDays = progressDayCount(target);
    const actualDays = actualDayCount();
    const delta = progressDays - actualDays;
    homePlanMeta.textContent = delta > 0
      ? `计划已提前 ${formatDayValue(delta)} 天`
      : delta < 0
        ? `计划已落后 ${formatDayValue(Math.abs(delta))} 天`
        : "计划进度同步";
    progressCompare.textContent =
      `进度 ${formatDayValue(progressDays)} 天 / 实际 ${formatDayValue(actualDays)} 天`;
    planButton.textContent = "修改计划";
  } else {
    homePlanMeta.textContent = "尚未选择计划";
    progressCompare.textContent = "";
    planButton.textContent = "选择计划";
  }

  renderHeatmap();
  const dashboardSnapshotChanged = dashboardRecordSnapshot(activeBookId());
  if (dashboardSnapshotChanged && isPersistenceSafe()) {
    saveStateAfterMotion(120, {
      notify: hasLearningSessionCommit(),
      recordDashboardSnapshot: false,
      syncChangeOptions: { changedMaps: ["dashboardSnapshots"] },
    });
  }
  if (state.view === "dashboard") renderDashboard();
  startStudyButton.textContent = button.label;
  startStudyButton.disabled = button.disabled;
  advanceStudyButton.hidden = scheduleDeltaDays() > 0 ||
    !hasPlan() ||
    !ensureTodaySession().baseCompleted ||
    remaining === 0;
  advanceStudyButton.disabled = !canStartAdvanceStudy();
  advanceStudyButton.textContent = "提前学习";
  if (vocabularyBlockingIntent === "study") {
    startStudyButton.textContent = "正在加载…";
    startStudyButton.disabled = true;
  }
  if (vocabularyBlockingIntent === "advance") {
    advanceStudyButton.textContent = "正在加载…";
    advanceStudyButton.disabled = true;
  }
}

function heatmapDateRange() {
  const today = parseDate(currentDate());
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - (53 * 7 - 1));
  return { start, end };
}

function hasCompletedStudyWindowForDate(date) {
  return state.studyWindows.some((studyWindow) => {
    return studyWindow.activityDate === date && Boolean(studyWindow.endedAt);
  });
}

function hasSuccessfulStudyWindowForDate(date) {
  return state.studyWindows.some((studyWindow) => {
    return studyWindow.activityDate === date && studyWindow.endedReason === "completed";
  });
}

function heatmapDateIsReady(date) {
  if (date < currentDate()) return true;
  if (date > currentDate()) return false;
  return hasCompletedStudyWindowForDate(date);
}

function heatmapColor(date, activity) {
  const planStarted = state.plan?.startedOn;
  const isPlanDay = planStarted &&
    date >= planStarted &&
    date <= currentDate() &&
    heatmapDateIsReady(date);
  if (!isPlanDay) return "#ecefeb";

  const newCountValue = activity?.newCount ?? activity?.newWords?.length ?? 0;
  const reviewCountValue = activity?.reviewCount ?? activity?.reviewWords?.length ?? 0;
  const hasActivity = newCountValue + reviewCountValue > 0;
  if (!hasActivity) return "#dc6a63";

  const target = Math.max(
    1,
    Number(
      Number.isFinite(activity?.target)
        ? activity.target
        : targetForBookDate(state, date),
    ) || 0,
  );
  const baseCompleted = Boolean(activity?.baseCompleted) ||
    (newCountValue >= target && hasSuccessfulStudyWindowForDate(date)) ||
    (state.session?.date === date && state.session.baseCompleted);
  if (!baseCompleted) {
    const ratio = Math.min(1, (newCountValue + reviewCountValue) / Math.max(1, target));
    const lightness = Math.round(78 - ratio * 24);
    return `hsl(42 78% ${lightness}%)`;
  }

  const overtime = activity.overtime || newCountValue > target;
  if (!overtime) return "#49a96d";
  const intensity = Math.min(1, Math.max(0, (newCountValue - target) / target));
  const lightness = Math.round(41 - intensity * 10);
  return `hsl(151 58% ${lightness}%)`;
}

function heatmapLabel(date, activity) {
  const parsed = parseDate(date);
  const newCountValue = activity?.newCount ?? activity?.newWords?.length ?? 0;
  const reviewCountValue = activity?.reviewCount ?? activity?.reviewWords?.length ?? 0;
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日，新学 ${newCountValue} 词，复习 ${reviewCountValue} 词`;
}

function positionHeatmapAtLatest(force = false) {
  window.requestAnimationFrame(() => {
    const hasHorizontalOverflow = heatmapScroll.scrollWidth > heatmapScroll.clientWidth + 1;
    if (!hasHorizontalOverflow) return;
    if (!force && heatmapPositionedBookId === activeBookId()) return;
    heatmapScroll.scrollLeft = heatmapScroll.scrollWidth - heatmapScroll.clientWidth;
    heatmapPositionedBookId = activeBookId();
  });
}

function renderHeatmap() {
  heatmapGrid.replaceChildren();
  heatmapMonths.replaceChildren();
  if (heatmapTooltip.textContent.includes("正在加载")) {
    heatmapTooltip.textContent = "将鼠标移到日期上查看";
  }
  const { start } = heatmapDateRange();
  let previousMonth = -1;

  for (let index = 0; index < 53 * 7; index += 1) {
    const dateValue = new Date(start);
    dateValue.setDate(start.getDate() + index);
    const date = formatDate(dateValue);
    const activity = state.activityLog[date];
    const label = heatmapLabel(date, activity);
    const day = document.createElement("button");
    day.className = "heatmap-day";
    day.type = "button";
    day.dataset.date = date;
    day.style.setProperty("--heat-color", heatmapColor(date, activity));
    day.setAttribute("aria-label", label);
    if (
      state.plan?.startedOn &&
      date >= state.plan.startedOn &&
      date <= currentDate() &&
      heatmapDateIsReady(date)
    ) {
      day.classList.add("is-active");
    }
    const showLabel = () => {
      heatmapTooltip.textContent = label;
    };
    day.addEventListener("mouseenter", showLabel);
    day.addEventListener("focus", showLabel);
    heatmapGrid.append(day);

    if (dateValue.getDay() === 0 && dateValue.getMonth() !== previousMonth) {
      previousMonth = dateValue.getMonth();
      const firstMonthIsIncomplete = index === 0 && dateValue.getDate() > 7;
      if (firstMonthIsIncomplete) continue;
      const month = document.createElement("span");
      month.className = "heatmap-month-label";
      month.textContent = `${previousMonth + 1}月`;
      month.style.gridColumn = `${Math.floor(index / 7) + 1} / span 4`;
      heatmapMonths.append(month);
    }
  }
  positionHeatmapAtLatest();
}

function buildWordListIndexContext() {
  const introducedOrder = new Map();
  const introducedSet = new Set();
  state.introducedWords.forEach((wordId, index) => {
    const normalizedWordId = String(wordId);
    introducedSet.add(normalizedWordId);
    if (!introducedOrder.has(normalizedWordId)) {
      introducedOrder.set(normalizedWordId, index);
    }
  });

  const activityDatesByWord = new Map();
  Object.entries(state.activityLog ?? {}).forEach(([date, activity]) => {
    const wordIds = new Set([
      ...(Array.isArray(activity?.newWords) ? activity.newWords : []),
      ...(Array.isArray(activity?.reviewWords) ? activity.reviewWords : []),
    ]);
    wordIds.forEach((wordId) => {
      const dates = activityDatesByWord.get(String(wordId)) ?? [];
      dates.push(date);
      activityDatesByWord.set(String(wordId), dates);
    });
  });

  return { activityDatesByWord, introducedOrder, introducedSet };
}

function wordLearningInfo(word, context = buildWordListIndexContext()) {
  const introduced = context.introducedSet.has(word.id);
  const keys = allSenseKeysForWord(word);
  const isDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date ?? "");
  const actualProgressDates = keys.flatMap((key) => {
    const progress = state.progress[key];
    return [
      progress?.firstSeenActual,
      progress?.lastSeenActual,
      progress?.masteredOnActual,
    ].filter(isDate);
  });
  const legacyProgressDates = keys.flatMap((key) => {
    const progress = state.progress[key];
    return [progress?.firstSeen, progress?.lastSeen, progress?.masteredOn]
      .filter(isDate);
  });
  const activityDates = (context.activityDatesByWord.get(word.id) ?? []).filter(isDate);
  const encounterDates = [...new Set([
    ...actualProgressDates,
    ...activityDates,
    ...(actualProgressDates.length || activityDates.length
      ? []
      : legacyProgressDates),
  ])].sort();
  const firstLearned = encounterDates[0] ?? null;
  const lastLearned = encounterDates.at(-1) ?? null;

  const masteredDates = keys.map((key) => {
    const progress = state.progress[key];
    return progress?.status === SENSE_STATUS.MASTERED
      ? progress.masteredOnActual ?? progress.masteredOn
      : null;
  });
  const mastered = keys.length > 0 && masteredDates.every(Boolean);
  const masteredOn = mastered ? masteredDates.sort().at(-1) : null;
  const duration = encounterDates.length;
  const introducedOrder = context.introducedOrder.get(word.id) ?? -1;

  return {
    firstLearned,
    lastLearned,
    firstOrder: introducedOrder >= 0 ? introducedOrder : Number.MAX_SAFE_INTEGER,
    introduced,
    mastered,
    masteredOn,
    duration,
  };
}

function wordStatusBadges(word, context = buildWordListIndexContext()) {
  if (!context.introducedSet.has(word.id)) {
    return [{ label: "待新学", type: "new" }];
  }

  const statuses = allSenseKeysForWord(word).map((key) => {
    return state.progress[key]?.status ?? SENSE_STATUS.NEW;
  });
  if (statuses.length > 0 && statuses.every((status) => status === SENSE_STATUS.MASTERED)) {
    return [{ label: "已掌握", type: "mastered" }];
  }

  const badges = [];
  if (statuses.includes(SENSE_STATUS.NEW)) {
    badges.push({ label: "待新学", type: "new" });
  }
  if (statuses.includes(SENSE_STATUS.REINFORCE)) {
    badges.push({ label: "待强化", type: "reinforce" });
  }
  if (statuses.includes(SENSE_STATUS.REVIEW)) {
    badges.push({ label: "待复习", type: "review" });
  }
  return badges.length > 0 ? badges : [{ label: "待新学", type: "new" }];
}

function normalizeChineseSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-Hans")
    .replace(/[\p{White_Space}\p{P}\p{S}]+/gu, "");
}

function isChineseSearchQuery(value) {
  return /[\u3400-\u9fff]/u.test(String(value ?? ""));
}

function chineseSearchAliases(query) {
  const normalized = normalizeChineseSearchText(query);
  if (!normalized) return [];
  const aliases = new Set([normalized]);
  CHINESE_SEARCH_SYNONYM_GROUPS.forEach((group) => {
    if (group.includes(normalized)) {
      group.forEach((value) => {
        if (value.length > 1 || value === normalized) aliases.add(value);
      });
    }
  });
  return [...aliases];
}

function chineseSearchEditSimilarity(left, right) {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const saved = previous[rightIndex];
      previous[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? diagonal
        : 1 + Math.min(diagonal, previous[rightIndex], previous[rightIndex - 1]);
      diagonal = saved;
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function chineseSearchTextScore(query, text) {
  const normalizedQuery = normalizeChineseSearchText(query);
  const normalizedText = normalizeChineseSearchText(text);
  if (!normalizedQuery || !normalizedText) return 0;
  if (normalizedQuery === normalizedText) return 1;
  if (normalizedText.includes(normalizedQuery)) {
    return 0.91 + 0.08 * normalizedQuery.length / normalizedText.length;
  }
  if (normalizedQuery.length === 1 || normalizedText.length === 1) return 0;

  const queryCharacters = new Set([...normalizedQuery]);
  const textCharacters = new Set([...normalizedText]);
  const overlap = [...queryCharacters].filter((character) => {
    return textCharacters.has(character);
  }).length;
  const dice = 2 * overlap / (queryCharacters.size + textCharacters.size);
  const edit = chineseSearchEditSimilarity(normalizedQuery, normalizedText);
  return Math.max(dice * 0.72 + edit * 0.28, edit * 0.75);
}

function chineseSenseDirectScore(query, sense) {
  const meaning = typeof sense?.meaning === "string" ? sense.meaning : "";
  if (!meaning) return 0;
  const segments = meaning.split(/[,\uFF0C\u3001;\uFF1B|/]+/u).filter(Boolean);
  const normalizedQuery = normalizeChineseSearchText(query);
  return Math.max(
    ...chineseSearchAliases(query).map((alias) => {
      const aliasScore = Math.max(
        ...segments.map((segment) => chineseSearchTextScore(alias, segment)),
        chineseSearchTextScore(alias, meaning),
      );
      return alias === normalizedQuery ? aliasScore : aliasScore * 0.82;
    }),
    0,
  );
}

function chineseWordSearchScores(scopeWords, query) {
  const directBySense = new Map();
  const sensesBySynset = new Map();
  const bestByWord = new Map();
  const seedScores = new Map();

  scopeWords.forEach((word) => {
    word.senses.forEach((sense) => {
      const score = chineseSenseDirectScore(query, sense);
      directBySense.set(`${word.id}:${sense.id}`, score);
      if (score > 0) {
        bestByWord.set(word.id, Math.max(bestByWord.get(word.id) ?? 0, score));
      }
      if (sense.synsetId) {
        const entries = sensesBySynset.get(sense.synsetId) ?? [];
        entries.push({ wordId: word.id, senseId: sense.id });
        sensesBySynset.set(sense.synsetId, entries);
        if (score >= 0.56) {
          seedScores.set(
            sense.synsetId,
            Math.max(seedScores.get(sense.synsetId) ?? 0, score),
          );
        }
      }
    });
  });

  seedScores.forEach((seedScore, synsetId) => {
    const targets = new Set([
      synsetId,
      ...(vocabularySearchRelations.get(synsetId) ?? []),
    ]);
    targets.forEach((targetSynsetId) => {
      (sensesBySynset.get(targetSynsetId) ?? []).forEach(({ wordId, senseId }) => {
        const directScore = directBySense.get(`${wordId}:${senseId}`) ?? 0;
        const relationScore = seedScore * (targetSynsetId === synsetId ? 0.88 : 0.74);
        bestByWord.set(wordId, Math.max(
          bestByWord.get(wordId) ?? 0,
          directScore,
          relationScore,
        ));
      });
    });
  });

  return bestByWord;
}

function getWordListIndex() {
  if (
    wordListIndexCache &&
    wordListIndexCache.state === state &&
    wordListIndexCache.revision === wordListIndexRevision
  ) {
    return wordListIndexCache.items;
  }

  const context = buildWordListIndexContext();
  const items = words.map((word) => ({
    word,
    info: wordLearningInfo(word, context),
    badges: wordStatusBadges(word, context),
    normalizedWord: word.word.toLocaleLowerCase("en"),
  }));
  wordListIndexCache = { state, revision: wordListIndexRevision, items };
  return items;
}

function sortedWordsForList(options = {}) {
  const rawQuery = String(options.query ?? wordListQuery).trim();
  const chineseQuery = isChineseSearchQuery(rawQuery);
  const query = rawQuery.toLocaleLowerCase("en");
  const filter = options.filter ?? wordListFilter;
  const sort = options.sort ?? state.wordListSort;
  const chineseScores = chineseQuery
    ? chineseWordSearchScores(words, rawQuery)
    : new Map();
  const items = getWordListIndex()
    .filter((item) => {
      return filter === "all" ||
        item.badges.some(({ type }) => type === filter);
    })
    .filter((item) => {
      if (!query) return true;
      if (chineseQuery) return (chineseScores.get(item.word.id) ?? 0) >= 0.35;
      return item.normalizedWord.includes(query);
    })
    .map((item) => ({
      ...item,
      matchScore: chineseScores.get(item.word.id) ?? 0,
    }));
  const alpha = (left, right) => left.word.word.localeCompare(
    right.word.word,
    "en",
    { sensitivity: "base" },
  );
  const learnedFirst = (left, right) => {
    if (Boolean(left.info.firstLearned) !== Boolean(right.info.firstLearned)) {
      return left.info.firstLearned ? -1 : 1;
    }
    return 0;
  };

  return items.sort((left, right) => {
    if (chineseQuery && right.matchScore !== left.matchScore) {
      return right.matchScore - left.matchScore;
    }
    const mode = sort;
    if (mode === "alpha-asc") return alpha(left, right);
    if (mode === "alpha-desc") return -alpha(left, right);

    const learnedOrder = learnedFirst(left, right);
    if (learnedOrder !== 0) return learnedOrder;
    if (!left.info.firstLearned && !right.info.firstLearned) return alpha(left, right);

    if (mode === "time-asc" || mode === "time-desc") {
      const dateOrder = left.info.firstLearned.localeCompare(right.info.firstLearned);
      if (dateOrder !== 0) return mode === "time-asc" ? dateOrder : -dateOrder;
      return left.info.firstOrder - right.info.firstOrder;
    }

    if (right.info.duration !== left.info.duration) {
      return right.info.duration - left.info.duration;
    }
    return left.info.firstOrder - right.info.firstOrder;
  });
}

const WORD_LIST_RENDER_BATCH_SIZE = 160;

function cancelWordListRender() {
  wordListRenderToken += 1;
  if (wordListRenderFrame !== null) {
    cancelAnimationFrame(wordListRenderFrame);
    wordListRenderFrame = null;
  }
}

function createWordListItem({ word, info, badges }) {
  const button = document.createElement("button");
  button.className = "word-list-item";
  button.type = "button";
  button.dataset.wordId = word.id;

  const name = document.createElement("span");
  name.className = "word-list-name";
  name.textContent = word.word;

  const meta = document.createElement("span");
  meta.className = "word-list-meta";

  const duration = document.createElement("span");
  duration.className = "word-list-badge is-duration";
  duration.textContent = `学习${Math.max(0, info.duration)}天`;
  meta.append(duration);

  badges.forEach(({ label, type }) => {
    const status = document.createElement("span");
    status.className = `word-list-badge is-${type}`;
    status.textContent = label;
    meta.append(status);
  });

  button.append(name, meta);
  return button;
}

function appendWordListChunk(items, start, token) {
  if (token !== wordListRenderToken) return;
  const end = Math.min(start + WORD_LIST_RENDER_BATCH_SIZE, items.length);
  const fragment = document.createDocumentFragment();
  for (let index = start; index < end; index += 1) {
    fragment.append(createWordListItem(items[index]));
  }
  wordList.insertBefore(fragment, wordListMore);

  if (end < items.length) {
    wordListRenderFrame = requestAnimationFrame(() => {
      appendWordListChunk(items, end, token);
    });
    return;
  }

  wordListRenderFrame = null;
  wordList.removeAttribute("aria-busy");
  const shown = Math.min(wordListVisibleCount, wordListItemsForRender.length);
  const hasMore = shown < wordListItemsForRender.length;
  wordListMore.hidden = !hasMore;
  wordListSummary.textContent = hasMore
    ? `已显示 ${shown} / ${wordListItemsForRender.length}`
    : `共 ${wordListItemsForRender.length} 个单词`;
  wordListLoadMoreButton.hidden = !hasMore;
}

function renderWordList() {
  if (wordListBookName) wordListBookName.textContent = bookDisplayName();
  wordSortSelect.value = state.wordListSort;
  wordSearchInput.value = wordListQuery;
  [...wordListFilters.querySelectorAll(".word-list-filter")].forEach((button) => {
    const active = button.dataset.status === wordListFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  cancelWordListRender();
  const items = sortedWordsForList();
  const nextWindowKey = [
    activeBookId(),
    state.wordListSort,
    wordListFilter,
    wordListQuery.trim(),
  ].join("|");
  if (nextWindowKey !== wordListWindowKey) {
    wordListWindowKey = nextWindowKey;
    wordListVisibleCount = WORD_LIST_PAGE_SIZE;
  }
  wordListItemsForRender = items;
  wordListEmpty.hidden = items.length > 0;
  wordList.replaceChildren(wordListMore);
  wordListMore.hidden = true;
  if (items.length === 0) {
    wordList.removeAttribute("aria-busy");
    return;
  }

  wordList.setAttribute("aria-busy", "true");
  appendWordListChunk(
    items.slice(0, Math.min(wordListVisibleCount, items.length)),
    0,
    wordListRenderToken,
  );
}

function loadMoreWordList() {
  if (wordListVisibleCount >= wordListItemsForRender.length) return;
  cancelWordListRender();
  const start = wordListVisibleCount;
  wordListVisibleCount = Math.min(
    wordListVisibleCount + WORD_LIST_PAGE_SIZE,
    wordListItemsForRender.length,
  );
  wordList.setAttribute("aria-busy", "true");
  appendWordListChunk(
    wordListItemsForRender.slice(start, wordListVisibleCount),
    0,
    wordListRenderToken,
  );
}

function wordBrowseListItems() {
  const browse = state.wordBrowse;
  if (browse?.source !== "word-list") return [];
  return sortedWordsForList({
    query: browse.query,
    filter: browse.filter,
    sort: browse.sort,
  });
}

function wordBrowseNeighbors() {
  const browse = state.wordBrowse;
  const items = wordBrowseListItems();
  const index = items.findIndex(({ word }) => word.id === browse?.wordId);
  if (index < 0) return { previousWordId: null, nextWordId: null };
  return {
    previousWordId: items[index - 1]?.word.id ?? null,
    nextWordId: items[index + 1]?.word.id ?? null,
  };
}

function renderWordBrowseNavigation() {
  const listBrowsing = state.wordBrowse?.source === "word-list";
  browsePreviousWordButton.hidden = !listBrowsing;
  browseNextWordButton.hidden = !listBrowsing;
  studyPrimaryActions.classList.toggle("has-word-card-navigation", listBrowsing);
  if (!listBrowsing) return;

  const { previousWordId, nextWordId } = wordBrowseNeighbors();
  browsePreviousWordButton.disabled = !previousWordId;
  browseNextWordButton.disabled = !nextWordId;
}

function renderStudy() {
  const session = ensureTodaySession();
  const browsing = Boolean(state.wordBrowse);
  if (state.view === "study" && !vocabularyDetailsReady && !browsing) {
    studyFeedbackButton.hidden = true;
    studyTopbar.hidden = browsing;
    studyProgressRow.hidden = false;
    queueProgress.hidden = browsing;
    resetButton.hidden = true;
    nextButton.hidden = browsing;
    studyPrimaryActions.classList.toggle("is-word-browse", browsing);
    renderWordBrowseNavigation();
    reviewCount.textContent = "0/0";
    newCount.textContent = "0/0";
    learningCount.textContent = "0/0";
    queueProgress.textContent = browsing ? "单词卡片" : "正在准备";
    senseProgressLabel.textContent = browsing ? "单词卡片" : "0 / 0";
    senseProgressBar.hidden = browsing;
    senseProgressBar.setAttribute("aria-valuemax", "0");
    senseProgressBar.setAttribute("aria-valuenow", "0");
    senseProgressBar.firstElementChild.style.setProperty("--study-progress", "0");
    senseList.replaceChildren();
    morphologyPanel.replaceChildren();
    senseArea.hidden = true;
    nextButton.disabled = true;
    audioButton.hidden = true;
    revealButton.disabled = true;
    revealButton.classList.remove("is-finished", "is-mastered");
    wordText.textContent = "正在加载学习内容";
    cardMode.textContent = "请稍候";
    revealButton.setAttribute("aria-label", "正在加载学习内容");
    scheduleWordFit();
    return;
  }
  const card = currentCard();
  const historyViewing = isHistoryView();
  if (card && !historyViewing) {
    ensureEncounterSnapshot(card);
  }
  const word = currentWord();
  const counts = currentQueueCounts();
  const senseProgress = currentSenseProgress(counts);
  const stageWordProgress = currentStageWordProgress();
  const finished = !card;
  const phase = historyViewing
    ? "examples"
    : session.cardPhase ?? (session.revealed ? "select" : "hidden");
  const fullyMastered = Boolean(card && isWordFullyMastered(card.wordId));

  studyFeedbackButton.hidden = !word;
  studyTopbar.hidden = browsing;
  studyProgressRow.hidden = false;
  queueProgress.hidden = browsing;
  resetButton.hidden = browsing;
  nextButton.hidden = browsing;
  studyPrimaryActions.classList.toggle("is-word-browse", browsing);
  renderWordBrowseNavigation();
  reviewCount.textContent = `${counts.review.completed}/${counts.review.total}`;
  newCount.textContent = `${counts.new.completed}/${counts.new.total}`;
  learningCount.textContent =
    `${counts.reinforcement.completed}/${counts.reinforcement.total}`;
  queueProgress.textContent = browsing
    ? "单词卡片"
    : `${stageWordProgress.current} / ${stageWordProgress.total}`;
  queueProgress.setAttribute(
    "aria-label",
    browsing
      ? "单词卡片"
      : `当前阶段已完成 ${stageWordProgress.current} / ${stageWordProgress.total} 个单词`,
  );
  senseProgressLabel.textContent = browsing
    ? "单词卡片"
    : `${senseProgress.completed} / ${senseProgress.total}`;
  senseProgressBar.hidden = browsing;
  senseProgressBar.setAttribute("aria-valuemax", String(senseProgress.total));
  senseProgressBar.setAttribute("aria-valuenow", String(senseProgress.completed));
  senseProgressBar.firstElementChild.style.setProperty(
    "--study-progress",
    senseProgress.total > 0 ? String(senseProgress.completed / senseProgress.total) : "0",
  );

  senseList.replaceChildren();
  morphologyPanel.replaceChildren();
  senseArea.hidden = browsing ? false : !session.revealed || finished;
  nextButton.disabled = browsing || !session.revealed || finished;
  nextButton.textContent = !browsing && isHistoryView()
    ? "回到当前词"
    : phase === "examples" ? "下一词" : "完成";
  audioButton.hidden = finished;
  const recordingCount = audioRecordingsForWord(word).length;
  audioButton.setAttribute(
    "aria-label",
    recordingCount > 1 ? `依次播放全部 ${recordingCount} 条可用录音` : "播放读音",
  );
  revealButton.disabled = finished;
  revealButton.classList.toggle("is-finished", finished);
  revealButton.classList.toggle("is-mastered", fullyMastered);

  if (finished) {
    wordText.textContent = session.baseCompleted ? "今日任务已完成" : "本轮已完成";
    cardMode.textContent = session.activeBatchType === "extra"
      ? "增量学习完成"
      : session.activeBatchType === "advance"
        ? "提前学习完成"
        : "今日任务";
    revealButton.setAttribute("aria-label", "本轮已完成");
    nextButton.disabled = false;
    nextButton.textContent = "返回主页";
    scheduleWordFit();
    return;
  }

  wordText.textContent = word.word;
  scheduleWordFit();
  cardMode.textContent = browsing
    ? "单词卡片"
    : historyViewing
    ? "回看"
    : card.type === "review"
    ? "复习"
    : card.type === "reinforcement"
      ? "强化"
    : card.type === "advance"
      ? "提前"
    : card.type === "extra"
      ? "增量"
      : "新学";
  revealButton.setAttribute(
    "aria-label",
    !browsing && !session.revealed
      ? `显示 ${word.word} 的义项`
      : `打开 ${word.word} 的易混词球体`,
  );
  if (!browsing) maybeAutoPlayCurrentWord();

  if (!session.revealed && !browsing) return;

  renderMorphology(word);
  const items = visibleSenses();
  senseHint.textContent = browsing
    ? "全部义项"
    : historyViewing
    ? "上一词义项"
    : phase === "examples"
      ? "义项与例句"
      : "点击熟知的义项";

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "sense-hint";
    empty.textContent = phase === "examples"
      ? "熟知义项已处理，可以进入下一词。"
      : "这个单词的义项本轮都已处理。";
    senseList.append(empty);
    nextButton.disabled = false;
    return;
  }

  items.forEach(({
    key,
    sense,
    isActive,
    isConfirmed,
    isMastered: mastered,
  }, listIndex) => {
    const button = document.createElement("button");
    const greenSense = mastered || isConfirmed;
    const expanded = (card.expandedMasteredKeys ?? []).includes(key);
    const collapsibleGreen = phase === "examples" &&
      !historyViewing &&
      greenSense;
    button.className = "sense-item";
    button.type = "button";
    button.dataset.key = key;
    button.disabled = collapsibleGreen
      ? false
      : phase === "examples" ||
        historyViewing ||
        !isActive ||
        isConfirmed ||
        mastered;
    button.classList.toggle("is-example", phase === "examples");
    button.classList.toggle("is-confirmed", isConfirmed && !mastered);
    button.classList.toggle("is-mastered", mastered);
    button.classList.toggle("is-collapsible", collapsibleGreen);
    button.classList.toggle("is-expanded", collapsibleGreen && expanded);
    if (collapsibleGreen) {
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute("aria-label", `${sense.meaning}，${expanded ? "收起" : "展开"}详情`);
    }

    const rank = document.createElement("span");
    rank.className = "sense-rank";
    rank.textContent = listIndex + 1;

    const copy = document.createElement("span");
    copy.className = "sense-copy";

    const meaningLine = document.createElement("span");
    meaningLine.className = "sense-line";

    const pos = document.createElement("span");
    pos.className = "sense-pos";
    pos.textContent = sense.pos;

    const text = document.createElement("span");
    text.className = "sense-text";
    text.textContent = sense.meaning;

    meaningLine.append(pos, text);
    if (sense.ipa) {
      const ipa = document.createElement("span");
      ipa.className = "sense-ipa";
      ipa.textContent = `/${sense.ipa.replace(/^\/+|\/+$/g, "")}/`;
      meaningLine.append(ipa);
    }
    copy.append(meaningLine);

    if (phase === "examples" && (!collapsibleGreen || expanded)) {
      const definitionGroup = document.createElement("span");
      definitionGroup.className = "sense-detail-group sense-definition-group";
      const definition = document.createElement("span");
      definition.className = "sense-definition";
      definition.textContent = definitionSentence(sense);
      const definitionZh = document.createElement("span");
      definitionZh.className = "sense-definition-zh";
      definitionZh.textContent = definitionTranslation(sense);
      definitionGroup.append(definition, definitionZh);

      const exampleGroup = document.createElement("span");
      exampleGroup.className = "sense-detail-group sense-example-group";
      const example = document.createElement("span");
      example.className = "sense-example";
      example.textContent = exampleSentence(sense);
      const translation = document.createElement("span");
      translation.className = "sense-example-zh";
      translation.textContent = exampleTranslation(sense);
      exampleGroup.append(example, translation);
      copy.append(definitionGroup, exampleGroup);
    }

    button.append(rank, copy);
    senseList.append(button);
  });
}

function appendMorphologyForms(container, rows) {
  rows.forEach((row, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "morphology-separator";
      separator.textContent = "/";
      container.append(separator);
    }
    const form = document.createElement("span");
    form.className = `morphology-form is-${row.emphasis || "normal"}`;
    form.textContent = row.form;
    container.append(form);
  });
}

function createMorphologyItem(label, rows) {
  const item = document.createElement("div");
  item.className = "morphology-item";

  const itemLabel = document.createElement("span");
  itemLabel.className = "morphology-item-label";
  itemLabel.textContent = label;

  const value = document.createElement("span");
  value.className = "morphology-value";
  appendMorphologyForms(value, rows);
  item.append(itemLabel, value);
  return item;
}

function appendMorphologyGroup(title, content) {
  const group = document.createElement("section");
  group.className = "morphology-group";

  const heading = document.createElement("h4");
  heading.className = "morphology-group-title";
  heading.textContent = title;
  group.append(heading, content);
  morphologyPanel.append(group);
}

function renderMorphology(word) {
  const morphology = word.morphology;
  morphologyPanel.replaceChildren();
  morphologyPanel.hidden = !morphology;
  if (!morphology) return;

  const title = document.createElement("h3");
  title.className = "morphology-title";
  title.textContent = "词形变化";
  morphologyPanel.append(title);

  if (morphology.noun) {
    const nounGrid = document.createElement("div");
    nounGrid.className = "morphology-grid";
    if (morphology.noun.countability === "uncountable") {
      nounGrid.append(createMorphologyItem("数", [{ form: "不可数", emphasis: "normal" }]));
    } else {
      nounGrid.append(createMorphologyItem("复数", morphology.noun.plural));
    }
    appendMorphologyGroup("名词", nounGrid);
  }

  if (morphology.verb) {
    const labels = {
      thirdPerson: "第三人称单数",
      presentParticiple: "-ing 形式",
      past: "过去式",
      pastParticiple: "过去分词",
    };
    const verb = morphology.verb;
    if (verb.defective) {
      const defectiveGrid = document.createElement("div");
      defectiveGrid.className = "morphology-grid";
      defectiveGrid.append(createMorphologyItem("说明", [{ form: verb.defective, emphasis: "normal" }]));
      appendMorphologyGroup("动词", defectiveGrid);
    } else if (verb.special?.length) {
      const specialList = document.createElement("div");
      specialList.className = "morphology-special-list";
      verb.special.forEach((paradigm) => {
        const section = document.createElement("section");
        section.className = "morphology-special";

        const meaning = document.createElement("h5");
        meaning.className = "morphology-special-meaning";
        meaning.textContent = paradigm.meaning;

        const grid = document.createElement("div");
        grid.className = "morphology-grid";
        Object.entries(labels).forEach(([field, label]) => {
          grid.append(createMorphologyItem(label, paradigm[field]));
        });
        section.append(meaning, grid);
        specialList.append(section);
      });
      appendMorphologyGroup("动词（按义项变化）", specialList);
    } else {
      const verbGrid = document.createElement("div");
      verbGrid.className = "morphology-grid";
      Object.entries(labels).forEach(([field, label]) => {
        verbGrid.append(createMorphologyItem(label, verb[field]));
      });
      appendMorphologyGroup("动词", verbGrid);
    }
  }
}

async function startStudy(event) {
  const transitionOrigin = getUiTransitionOrigin(event?.currentTarget);
  const tutorialStart =
    tutorialRuntime?.active && tutorialRuntime.step === "start";
  if (!tutorialStart && (!membershipAllowsStudy() || !hasPlan())) return;
  if (!await ensureVocabularyDetailsReady("study")) return;
  if (tutorialStart) {
    beginTutorialStudy();
    return;
  }

  startStudyWindow();
  const session = ensureTodaySession();

  if (!hasUnfinishedQueue()) {
    if (!session.baseNewAdded) {
      const learningDay = beginLearningDay("planned");
      session.activePlanDate = currentPlanDate();
      session.queue = buildStudyQueue({
        includeReviews: true,
        newLimit: state.plan.dailyTarget,
        newType: "new",
        reviewLearningDay: learningDay,
      });
      session.currentIndex = 0;
      session.revealed = false;
      session.cardPhase = "hidden";
      session.baseNewAdded = true;
      session.activeBatchType = "planned";
      session.reinforcementAdded = false;
      if (session.queue.length === 0) appendReinforcementStage();
      session.baseCompleted = session.queue.length === 0;
      if (session.baseCompleted) activityForDate().baseCompleted = true;
    } else {
      beginLearningDay("extra");
      session.activePlanDate = currentPlanDate();
      session.queue = buildStudyQueue({
        includeReviews: false,
        newLimit: state.plan.dailyTarget,
        newType: "extra",
      });
      session.currentIndex = 0;
      session.revealed = false;
      session.cardPhase = "hidden";
      session.activeBatchType = "extra";
      session.extraBatches += 1;
      session.reinforcementAdded = false;
      if (session.queue.length === 0) appendReinforcementStage();
    }
  }

  studyHierarchyOrigin = transitionOrigin;
  commitUiTransition("forward", () => {
    state.view = "study";
    render();
  }, {
    scope: "hierarchy",
    origin: transitionOrigin,
    afterStart: () => saveStateAfterMotion(520, {
      syncChangeOptions: { changedMaps: ["studyWindows", "dashboardSnapshots"] },
    }),
  });
}

async function startAdvanceStudy(event) {
  const transitionOrigin = getUiTransitionOrigin(event?.currentTarget);
  if (!canStartAdvanceStudy()) return;
  if (!await ensureVocabularyDetailsReady("advance")) return;

  startStudyWindow();
  const session = ensureTodaySession();
  const learningDay = beginLearningDay("advance");
  session.activePlanDate = addDays(currentDate(), session.advanceBatches + 1);
  session.queue = buildStudyQueue({
    includeReviews: true,
    newLimit: state.plan.dailyTarget,
    newType: "advance",
    reviewLearningDay: learningDay,
  });
  session.currentIndex = 0;
  session.revealed = false;
  session.cardPhase = "hidden";
  session.activeBatchType = "advance";
  session.advanceBatches += 1;
  session.advanceShiftCommitted = false;
  session.reinforcementAdded = false;
  session.reinforcedKeys = [];
  if (session.queue.length === 0) appendReinforcementStage();

  studyHierarchyOrigin = transitionOrigin;
  commitUiTransition("forward", () => {
    state.view = "study";
    render();
  }, {
    scope: "hierarchy",
    origin: transitionOrigin,
    afterStart: () => saveStateAfterMotion(520, {
      syncChangeOptions: { changedMaps: ["studyWindows", "dashboardSnapshots"] },
    }),
  });
}

function mountFloatingDialogs() {
  if (!modalLayer) return;
  document.querySelectorAll(".modal-backdrop").forEach((dialog) => {
    if (dialog.parentElement !== modalLayer) modalLayer.append(dialog);
  });
}

mountFloatingDialogs();

const floatingDialogTokens = new WeakMap();

function updateFloatingDialogLayerState() {
  const hasOpenDialog = [...document.querySelectorAll(".modal-backdrop")]
    .some((dialog) => !dialog.hidden);
  document.documentElement.classList.toggle("has-floating-dialog", hasOpenDialog);
  if (appShellElement) appShellElement.inert = hasOpenDialog;
  if (mainAppNav) mainAppNav.inert = hasOpenDialog;
}

function setFloatingDialogOrigin(dialog, originTarget = null) {
  const surface = dialog?.querySelector(".reset-dialog");
  if (!surface) return;
  const target = originTarget instanceof Element ? originTarget : document.activeElement;
  const surfaceRect = surface.getBoundingClientRect();
  const targetRect = target instanceof Element ? target.getBoundingClientRect() : null;
  const targetX = targetRect ? targetRect.left + targetRect.width / 2 : innerWidth / 2;
  const targetY = targetRect ? targetRect.top + targetRect.height / 2 : innerHeight;
  const originX = targetX - surfaceRect.left;
  const originY = targetY - surfaceRect.top;
  surface.style.setProperty("--modal-origin-x", `${originX}px`);
  surface.style.setProperty("--modal-origin-y", `${originY}px`);
}

function openFloatingDialog(dialog, originTarget = null) {
  if (!dialog) return;
  const token = (floatingDialogTokens.get(dialog) ?? 0) + 1;
  floatingDialogTokens.set(dialog, token);
  if (!dialog.hidden && !dialog.classList.contains("is-modal-closing")) {
    dialog.classList.remove("is-modal-entering");
    dialog.classList.add("is-modal-open");
    updateFloatingDialogLayerState();
    return;
  }
  dialog.hidden = false;
  updateFloatingDialogLayerState();
  dialog.classList.remove(
    "is-modal-closing",
    "is-modal-entering",
    "is-modal-open",
  );
  if (prefersReducedMotion()) {
    setFloatingDialogOrigin(dialog, originTarget);
    dialog.classList.add("is-modal-open");
    return;
  }
  dialog.classList.add("is-modal-preparing");
  const done = () => {
    if (floatingDialogTokens.get(dialog) !== token || dialog.hidden) return;
    dialog.classList.remove("is-modal-preparing", "is-modal-entering");
    dialog.classList.add("is-modal-open");
    positionTutorialOverlay({ force: true });
  };
  window.requestAnimationFrame(() => {
    if (floatingDialogTokens.get(dialog) !== token || dialog.hidden) return;
    setFloatingDialogOrigin(dialog, originTarget);
    dialog.classList.remove("is-modal-preparing");
    dialog.classList.add("is-modal-entering");
    const animation = [...(dialog.querySelector(".reset-dialog")?.getAnimations?.() ?? [])]
      .find((item) => item.animationName === "modal-drop-expand");
    if (animation) {
      if (tutorialRuntime?.active) {
        const trackTutorialTarget = () => {
          if (
            floatingDialogTokens.get(dialog) !== token ||
            !dialog.classList.contains("is-modal-entering")
          ) return;
          positionTutorialOverlay({ force: true });
          window.requestAnimationFrame(trackTutorialTarget);
        };
        window.requestAnimationFrame(trackTutorialTarget);
      }
      // Some WebViews occasionally lose the CSS animation finished event.
      // Keep the visual animation, but never leave the dialog in its entering
      // state and make the underlying controls permanently unstable.
      settleAnimation(animation.finished, 520).then(done);
    } else {
      window.setTimeout(done, 470);
    }
  });
}

function closeFloatingDialog(dialog, { force = false } = {}) {
  if (!dialog || dialog.hidden) return;
  const token = (floatingDialogTokens.get(dialog) ?? 0) + 1;
  floatingDialogTokens.set(dialog, token);
  if (force || prefersReducedMotion()) {
    dialog.hidden = true;
    dialog.classList.remove(
      "is-modal-preparing",
      "is-modal-closing",
      "is-modal-entering",
      "is-modal-open",
    );
    const surface = dialog.querySelector(".reset-dialog");
    surface?.style.removeProperty("--modal-origin-x");
    surface?.style.removeProperty("--modal-origin-y");
    updateFloatingDialogLayerState();
    return;
  }
  dialog.classList.remove("is-modal-preparing", "is-modal-entering", "is-modal-open");
  dialog.classList.add("is-modal-closing");
  const done = () => {
    if (floatingDialogTokens.get(dialog) !== token) return;
    dialog.hidden = true;
    dialog.classList.remove(
      "is-modal-preparing",
      "is-modal-closing",
      "is-modal-entering",
      "is-modal-open",
    );
    const surface = dialog.querySelector(".reset-dialog");
    surface?.style.removeProperty("--modal-origin-x");
    surface?.style.removeProperty("--modal-origin-y");
    updateFloatingDialogLayerState();
  };
  const animation = dialog.querySelector(".reset-dialog")?.getAnimations?.()[0];
  if (animation) {
    settleAnimation(animation.finished, 360).then(done);
  } else {
    window.setTimeout(done, 300);
  }
}

window.senseVocabModalMotion = Object.freeze({
  open: openFloatingDialog,
  close: closeFloatingDialog,
});

const MAIN_VIEW_ORDER = Object.freeze({ home: 0, dashboard: 1, settings: 2 });

function openMainView(nextView) {
  if (!state || state.view === nextView || !(nextView in MAIN_VIEW_ORDER)) return;
  const currentOrder = MAIN_VIEW_ORDER[state.view] ?? 0;
  const nextOrder = MAIN_VIEW_ORDER[nextView];
  commitUiTransition(nextOrder >= currentOrder ? "forward" : "backward", () => {
    state.view = nextView;
    render();
  }, { scope: "page" });
}

function openDashboard() {
  openMainView("dashboard");
}

function closeDashboard() {
  openMainView("home");
}

function openSettings() {
  openMainView("settings");
}

function openDataPage(event) {
  if (!state || state.view === "data") return;
  if (event?.detail?.immediate) {
    state.view = "data";
    render();
    return;
  }
  const transitionOrigin = getUiTransitionOrigin(event?.currentTarget ?? dataButton);
  commitUiTransition("forward", () => {
    state.view = "data";
    render();
  }, { scope: "hierarchy", origin: transitionOrigin });
}

function closeDataPage(event) {
  if (!state || state.view !== "data") return;
  const transitionOrigin = getUiTransitionOrigin(event?.currentTarget ?? dataButton);
  commitUiTransition("backward", () => {
    state.view = "settings";
    render();
  }, { scope: "hierarchy", origin: transitionOrigin });
}

function openWordList(event) {
  const transitionOrigin = getUiTransitionOrigin(event?.currentTarget);
  wordListHierarchyOrigin = transitionOrigin;
  commitUiTransition("forward", () => {
    state.wordBrowse = null;
    state.view = "word-list";
    wordListQuery = "";
    wordListFilter = "all";
    render();
  }, {
    scope: "hierarchy",
    origin: transitionOrigin,
    // The catalog can contain thousands of rows. Animate the live surface so
    // a fallback transition never deep-clones the rendered list.
    snapshots: false,
  });
}

function closeWordList(event) {
  const transitionOrigin = getUiTransitionOrigin(event?.currentTarget);
  const returnOrigin = wordListHierarchyOrigin ?? transitionOrigin;
  commitUiTransition("backward", () => {
    state.wordBrowse = null;
    state.view = "home";
    render();
  }, {
    scope: "hierarchy",
    origin: returnOrigin,
    snapshots: false,
    after: () => {
      wordListHierarchyOrigin = null;
    },
  });
}

function confusionRelatedIds(rootWordId) {
  const related = new Set();
  Object.values(state.confusionLinks ?? {}).forEach((link) => {
    if (link.left === rootWordId && wordById.has(link.right)) {
      related.add(link.right);
    } else if (link.right === rootWordId && wordById.has(link.left)) {
      related.add(link.left);
    }
  });
  return related;
}

function confusionWords(rootWordId) {
  const related = confusionRelatedIds(rootWordId);
  const root = wordById.get(rootWordId);
  if (!root) return [];
  return [
    root,
    ...words.filter((word) => related.has(word.id) && word.id !== rootWordId),
  ];
}

function setConfusionRelation(rootWordId, relatedWordId, enabled) {
  if (
    !wordById.has(rootWordId) ||
    !wordById.has(relatedWordId) ||
    rootWordId === relatedWordId
  ) return;
  const key = confusionPairKey(rootWordId, relatedWordId);
  if (enabled) {
    state.confusionLinks[key] = {
      left: rootWordId,
      right: relatedWordId,
      createdAt: new Date().toISOString(),
    };
  } else {
    delete state.confusionLinks[key];
  }
  saveState();
  renderConfusionPanel();
}

function renderConfusionSearchResults() {
  confusionSearchResults.replaceChildren();
  const rootWordId = confusionRuntime?.rootWordId;
  if (!rootWordId) return;
  const related = confusionRelatedIds(rootWordId);
  const query = confusionSearchInput.value.trim().toLocaleLowerCase("en");
  const candidates = (query
    ? words.filter((word) => {
        return word.id !== rootWordId &&
          word.word.toLocaleLowerCase("en").includes(query);
      })
    : words.filter((word) => related.has(word.id)))
    .slice(0, 10);

  const fragment = document.createDocumentFragment();
  candidates.forEach((word) => {
    const row = document.createElement("div");
    row.className = "confusion-search-result";

    const name = document.createElement("strong");
    name.textContent = word.word;

    const action = document.createElement("button");
    action.type = "button";
    action.className = "confusion-search-action";
    action.dataset.wordId = word.id;
    action.dataset.action = related.has(word.id) ? "remove" : "add";
    action.classList.toggle("is-remove", related.has(word.id));
    action.textContent = related.has(word.id) ? "移除" : "添加";
    row.append(name, action);
    fragment.append(row);
  });
  confusionSearchResults.append(fragment);
}

function renderConfusionPanel() {
  if (state.view !== "confusion") return;
  const rootWordId = confusionRuntime?.rootWordId;
  const rootWord = wordById.get(rootWordId);
  if (!rootWord) {
    closeConfusionGlobe({ back: true, animate: false });
    return;
  }

  const globeWords = confusionWords(rootWordId);
  const globeSignature = JSON.stringify({
    rootWordId,
    focusWordId: confusionRuntime.focusWordId ?? rootWordId,
    wordIds: globeWords.map((word) => word.id),
  });
  confusionTitle.textContent = rootWord.word;
  confusionCount.textContent = `${globeWords.length} 个词`;
  const shouldRebuildGlobe = !confusionGlobe || (
    !confusionTransitioning && confusionGlobeSignature !== globeSignature
  );
  if (shouldRebuildGlobe) {
    confusionGlobe?.destroy();
    confusionGlobe = null;
    confusionGlobeSignature = null;
    if (window.SenseVocabConfusionGlobe) {
      confusionGlobe = window.SenseVocabConfusionGlobe.create({
        container: confusionGlobeStage,
        words: globeWords,
        currentWordId: confusionRuntime.focusWordId ?? rootWordId,
        presentationProgress: confusionTransitioning ? 0 : 1,
        onSelect: ({ wordId }) => closeConfusionGlobe({ wordId }),
      });
      confusionGlobeSignature = globeSignature;
    } else {
      confusionGlobeStage.replaceChildren();
    }
  }
  renderConfusionSearchResults();
}

function ensureConfusionGlobeReady() {
  if (window.SenseVocabConfusionGlobe) return Promise.resolve(true);
  if (confusionGlobeLoader) return confusionGlobeLoader;
  confusionGlobeLoader = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "./confusion-globe.js?v=20260803-4";
    script.async = true;
    script.addEventListener("load", () => {
      resolve(Boolean(window.SenseVocabConfusionGlobe));
    }, { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.append(script);
  }).finally(() => {
    if (!window.SenseVocabConfusionGlobe) confusionGlobeLoader = null;
  });
  return confusionGlobeLoader;
}

function nextAnimationFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

function confusionSphereRect() {
  const visualRect = confusionGlobe?.visualRect?.();
  if (
    visualRect &&
    visualRect.width > 0 &&
    visualRect.height > 0
  ) return visualRect;
  const stageRect = confusionGlobeStage.getBoundingClientRect();
  const size = Math.max(120, Math.min(stageRect.width, stageRect.height) * 0.82);
  return {
    left: stageRect.left + (stageRect.width - size) / 2,
    top: stageRect.top + (stageRect.height - size) / 2,
    width: size,
    height: size,
  };
}

function confusionWordFontSize(wordId) {
  const element = confusionGlobe?.wordElement?.(wordId);
  return Number.parseFloat(element ? window.getComputedStyle(element).fontSize : "") || 14;
}

function createWordGlobeTransition(rect, text, fontSize) {
  const transition = document.createElement("div");
  transition.className = "word-globe-transition";
  const word = document.createElement("span");
  word.textContent = text;
  transition.append(word);
  Object.assign(transition.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    fontSize: `${fontSize}px`,
  });
  document.body.append(transition);
  return transition;
}

function reducedMotionPreferred() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function transitionAnimationFinished(animation) {
  return animation.finished.catch(() => undefined);
}

function settleAnimation(promise, timeout = 900) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer !== null) window.clearTimeout(timer);
      resolve();
    };
    timer = window.setTimeout(finish, timeout);
    Promise.resolve(promise).then(finish, finish);
  });
}

function interpolateNumber(from, to, progress) {
  return from + (to - from) * progress;
}

function smoothProgress(value) {
  const progress = Math.min(1, Math.max(0, value));
  return progress * progress * (3 - 2 * progress);
}

function animateFrameProgress(duration, onFrame) {
  if (duration <= 0) {
    onFrame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let startedAt = null;
    const tick = (now) => {
      if (startedAt == null) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / duration);
      onFrame(progress);
      if (progress >= 1) {
        window.requestAnimationFrame(resolve);
      } else {
        window.requestAnimationFrame(tick);
      }
    };
    window.requestAnimationFrame(tick);
  });
}

async function animateCardIntoGlobe(
  transition,
  fromRect,
  toRect,
  { fromFontSize, toFontSize, globe },
) {
  if (reducedMotionPreferred()) {
    globe?.setPresentationProgress?.(1);
    return;
  }
  const duration = 900;
  await animateFrameProgress(duration, (overall) => {
    const morphLinear = Math.min(1, overall / 0.58);
    const morph = 1 - Math.pow(1 - morphLinear, 3);
    const depth = smoothProgress((overall - 0.36) / 0.5);
    // Keep the flat sphere fully visible until WebGL has reached the browser's
    // compositor. A rendered canvas frame can still arrive one beat later on
    // mobile WebViews, so fading here would expose the page background.
    const handoffFloor = 1;
    const flatOpacity = handoffFloor + (1 - handoffFloor) * (
      1 - smoothProgress((overall - 0.6) / 0.4)
    );
    const width = interpolateNumber(fromRect.width, toRect.width, morph);
    const height = interpolateNumber(fromRect.height, toRect.height, morph);
    const radius = interpolateNumber(8, Math.min(width, height) / 2, morph);
    const background = [
      interpolateNumber(251, 231, morph),
      interpolateNumber(250, 240, morph),
      interpolateNumber(247, 237, morph),
    ].map(Math.round);
    Object.assign(transition.style, {
      left: `${interpolateNumber(fromRect.left, toRect.left, morph)}px`,
      top: `${interpolateNumber(fromRect.top, toRect.top, morph)}px`,
      width: `${width}px`,
      height: `${height}px`,
      borderRadius: `${radius}px`,
      borderColor: `rgba(${Math.round(interpolateNumber(221, 15, morph))}, ${Math.round(interpolateNumber(218, 118, morph))}, ${Math.round(interpolateNumber(207, 110, morph))}, ${interpolateNumber(1, 0.24, morph)})`,
      background: `rgb(${background.join(", ")})`,
      boxShadow: `0 ${interpolateNumber(18, 10, morph)}px ${interpolateNumber(48, 30, morph)}px rgba(38, 47, 51, ${interpolateNumber(0.13, 0.1, morph)})`,
      fontSize: `${interpolateNumber(fromFontSize, toFontSize, morph)}px`,
      opacity: String(flatOpacity),
    });
    globe?.setPresentationProgress?.(depth);
  });
}

async function fadeOutWordGlobeTransition(transition, duration = 180) {
  if (reducedMotionPreferred()) {
    transition.style.opacity = "0";
    return;
  }
  const fromOpacity = Number.parseFloat(
    window.getComputedStyle(transition).opacity,
  ) || 0;
  await animateFrameProgress(duration, (progress) => {
    transition.style.opacity = String(
      interpolateNumber(fromOpacity, 0, smoothProgress(progress)),
    );
  });
}

async function waitForGlobeCompositorCommit() {
  await nextAnimationFrame();
  await new Promise((resolve) => window.setTimeout(resolve, 96));
  await nextAnimationFrame();
}

async function flattenGlobeIntoTransition(
  transition,
  rect,
  { fontSize, globe },
) {
  Object.assign(transition.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: "50%",
    borderColor: "rgba(15, 118, 110, 0.24)",
    background: "rgba(231, 240, 237, 1)",
    boxShadow: "0 10px 30px rgba(38, 47, 51, 0.1)",
    fontSize: `${fontSize}px`,
    opacity: "0",
  });
  if (reducedMotionPreferred()) {
    globe?.setPresentationProgress?.(0);
    Object.assign(transition.style, {
      borderColor: "rgba(15, 118, 110, 0.24)",
      background: "rgba(231, 240, 237, 1)",
      opacity: "1",
    });
    return;
  }

  const duration = 360;
  await animateFrameProgress(duration, (overall) => {
    const circleOpacity = smoothProgress(overall / 0.55);
    const globeProgress = 1 - smoothProgress((overall - 0.38) / 0.62);
    transition.style.opacity = String(circleOpacity);
    globe?.setPresentationProgress?.(globeProgress);
  });
  Object.assign(transition.style, {
    borderColor: "rgba(15, 118, 110, 0.24)",
    background: "rgba(231, 240, 237, 1)",
    boxShadow: "0 10px 30px rgba(38, 47, 51, 0.1)",
    opacity: "1",
  });
}

async function animateFlatCircleIntoCard(
  transition,
  fromRect,
  toRect,
  { fromFontSize, toFontSize },
) {
  if (reducedMotionPreferred()) {
    transition.remove();
    return;
  }
  const animation = transition.animate(
    [
      {
        left: `${fromRect.left}px`,
        top: `${fromRect.top}px`,
        width: `${fromRect.width}px`,
        height: `${fromRect.height}px`,
        borderRadius: "50%",
        borderColor: "rgba(15, 118, 110, 0.24)",
        background: "rgba(231, 240, 237, 1)",
        boxShadow: "0 10px 30px rgba(38, 47, 51, 0.1)",
        fontSize: `${fromFontSize}px`,
      },
      {
        left: `${toRect.left}px`,
        top: `${toRect.top}px`,
        width: `${toRect.width}px`,
        height: `${toRect.height}px`,
        borderRadius: "8px",
        borderColor: "rgba(221, 218, 207, 1)",
        background: "rgba(251, 250, 247, 1)",
        boxShadow: "0 18px 48px rgba(38, 47, 51, 0.13)",
        fontSize: `${toFontSize}px`,
      },
    ],
    {
      duration: 560,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );
  await transitionAnimationFinished(animation);
  transition.remove();
}

function cloneNullable(value) {
  return value == null ? null : cloneSerializable(value);
}

function confusionEntryForOpen(rootWordId, currentWordId) {
  const inherited = state.wordBrowse?.confusionEntry;
  if (
    inherited?.rootWordId === rootWordId &&
    wordById.has(inherited.entryWordId)
  ) return cloneSerializable(inherited);
  return {
    rootWordId,
    entryWordId: currentWordId,
    entryWordBrowse: cloneNullable(state.wordBrowse),
  };
}

async function openConfusionGlobe(rootWordId = currentWord()?.id, options = {}) {
  const globeReady = await ensureConfusionGlobeReady();
  const currentWordId = currentWord()?.id;
  const inheritedEntry = state.wordBrowse?.confusionEntry;
  const returningFromRelatedCard =
    (inheritedEntry?.rootWordId === rootWordId ||
      state.wordBrowse?.confusionReturnRootId === rootWordId) &&
    options.focusWordId === currentWordId;
  if (
    confusionTransitioning ||
    tutorialRuntime?.active ||
    state.view !== "study" ||
    (currentWordId !== rootWordId && !returningFromRelatedCard) ||
    !rootWordId ||
    !wordById.has(rootWordId) ||
    !globeReady
  ) return;

  const originWord = currentWord();
  if (!originWord) return;
  confusionTransitioning = true;
  const transitionToken = ++confusionTransitionToken;
  const sourceRect = revealButton.getBoundingClientRect();
  const sourceFont = Number.parseFloat(window.getComputedStyle(wordText).fontSize) || 72;
  const transition = createWordGlobeTransition(
    sourceRect,
    originWord.word,
    sourceFont,
  );
  studyPanel.classList.add("is-transitioning");
  const entry = confusionEntryForOpen(rootWordId, originWord.id);
  confusionRuntime = {
    rootWordId,
    focusWordId: options.focusWordId ?? originWord.id,
    entryWordId: entry.entryWordId,
    entryWordBrowse: cloneNullable(entry.entryWordBrowse),
  };
  confusionSearchInput.value = "";
  state.view = "confusion";
  render();
  confusionPanel.classList.add("is-transitioning");
  await nextAnimationFrame();
  const targetRect = confusionSphereRect();
  const targetFont = confusionWordFontSize(confusionRuntime.focusWordId);
  await settleAnimation(animateCardIntoGlobe(transition, sourceRect, targetRect, {
    fromFontSize: sourceFont,
    toFontSize: targetFont,
    globe: confusionGlobe,
  }), 1_500);
  if (transitionToken !== confusionTransitionToken || !confusionRuntime) {
    transition.remove();
    return;
  }
  confusionPanel.classList.remove("is-transitioning");
  confusionGlobe?.setPresentationProgress?.(1);
  // The globe is interactive as soon as its panel is visible. Cleanup of the
  // handoff overlay must not keep the back button locked on slower WebViews.
  confusionTransitioning = false;
  void (async () => {
    try {
      if (confusionGlobe?.nextPaint) {
        await settleAnimation(confusionGlobe.nextPaint(), 180);
      } else {
        await settleAnimation(nextAnimationFrame(), 120);
      }
      await settleAnimation(waitForGlobeCompositorCommit(), 220);
      await settleAnimation(fadeOutWordGlobeTransition(transition, 220), 280);
    } finally {
      transition.remove();
      if (transitionToken === confusionTransitionToken) {
        studyPanel.classList.remove("is-transitioning");
        renderConfusionPanel();
      }
    }
  })();
}

async function closeConfusionGlobe(options = {}) {
  if (confusionTransitioning || !confusionRuntime) return;
  const runtime = confusionRuntime;
  const selectedWordId = options.back
    ? runtime.entryWordId
    : options.wordId ?? runtime.focusWordId ?? runtime.rootWordId;
  const selectedWord = wordById.get(selectedWordId);
  if (!selectedWord) return;

  confusionTransitioning = true;
  const transitionToken = ++confusionTransitionToken;
  if (options.animate !== false && !options.back) {
    await settleAnimation(confusionGlobe?.focusWord(selectedWordId), 520);
  }
  const sourceRect = confusionSphereRect();
  const sourceFont = confusionWordFontSize(selectedWordId);
  const transition = createWordGlobeTransition(
    sourceRect,
    selectedWord.word,
    sourceFont,
  );
  confusionGlobeStage.style.pointerEvents = "none";

  if (options.animate !== false) {
    await settleAnimation(flattenGlobeIntoTransition(transition, sourceRect, {
      fontSize: sourceFont,
      globe: confusionGlobe,
    }), 620);
  }
  confusionPanel.classList.add("is-transitioning");

  if (options.back) {
    state.wordBrowse = cloneNullable(runtime.entryWordBrowse);
  } else {
    state.wordBrowse = {
      wordId: selectedWordId,
      confusionEntry: {
        rootWordId: runtime.rootWordId,
        entryWordId: runtime.entryWordId,
        entryWordBrowse: cloneNullable(runtime.entryWordBrowse),
      },
    };
  }
  state.view = "study";
  confusionGlobe?.destroy();
  confusionGlobe = null;
  confusionGlobeSignature = null;
  confusionRuntime = null;
  render();
  studyPanel.classList.add("is-transitioning");
  await settleAnimation(nextAnimationFrame(), 120);
  await settleAnimation(nextAnimationFrame(), 120);
  const targetRect = revealButton.getBoundingClientRect();
  const targetFont = Number.parseFloat(window.getComputedStyle(wordText).fontSize) || 72;
  if (options.animate === false) {
    transition.remove();
  } else {
    await settleAnimation(animateFlatCircleIntoCard(transition, sourceRect, targetRect, {
      fromFontSize: sourceFont,
      toFontSize: targetFont,
    }), 720);
  }
  confusionPanel.classList.remove("is-transitioning");
  studyPanel.classList.remove("is-transitioning");
  confusionGlobeStage.style.pointerEvents = "";
  confusionTransitioning = false;
}

function openWordCard(wordId, options = {}) {
  if (!wordById.has(wordId)) return;
  const transitionOrigin = options.origin ?? getUiTransitionOrigin(options.event?.currentTarget);
  studyHierarchyOrigin = transitionOrigin;
  commitUiTransition("forward", () => {
    state.wordBrowse = options.source === "word-list"
      ? {
        wordId,
        source: "word-list",
        query: wordListQuery,
        filter: wordListFilter,
        sort: state.wordListSort,
      }
      : { wordId };
    state.view = "study";
    render();
    saveStateAfterMotion(520, { stampSync: false });
  }, {
    scope: "hierarchy",
    origin: transitionOrigin,
    snapshots: options.source !== "word-list",
  });

  // The catalog index already contains the word and sense identities needed by
  // a read-only card. Enter immediately, then hydrate examples, audio, and
  // morphology in the background instead of blocking the tap on the full pack.
  if (!vocabularyDetailsReady) {
    window.setTimeout(() => beginVocabularyDetailsLoad(), 0);
  }
}

function navigateWordCard(direction) {
  if (state.wordBrowse?.source !== "word-list") return;
  const { previousWordId, nextWordId } = wordBrowseNeighbors();
  const wordId = direction < 0 ? previousWordId : nextWordId;
  if (!wordId) return;

  commitUiTransition(direction < 0 ? "backward" : "forward", () => {
    stopWordAudio();
    state.wordBrowse.wordId = wordId;
    render();
    saveStateAfterMotion(460, { stampSync: false });
  }, { scope: "card" });
}

function closeWordCard(event) {
  const transitionOrigin = studyHierarchyOrigin ?? getUiTransitionOrigin(event?.currentTarget);
  const returningToWordList = state.wordBrowse?.source === "word-list" ||
    requestedWordId() && wordDeepLinkReturnView === "word-list";
  commitUiTransition("backward", () => {
    const deepLinked = Boolean(requestedWordId());
    state.wordBrowse = null;
    state.view = deepLinked
      ? ["home", "study", "word-list"].includes(wordDeepLinkReturnView)
        ? wordDeepLinkReturnView
        : "home"
      : "word-list";
    clearWordDeepLink();
    wordDeepLinkReturnView = null;
    render();
    saveStateAfterMotion(520, { stampSync: false });
  }, {
    scope: "hierarchy",
    origin: transitionOrigin,
    snapshots: !returningToWordList,
    after: () => {
      studyHierarchyOrigin = null;
    },
  });
}

function exitStudy(transitionOrigin = null) {
  if (!state) return;
  if (state.wordBrowse) {
    closeWordCard();
    return;
  }

  const returnOrigin = studyHierarchyOrigin ?? transitionOrigin;
  commitUiTransition("backward", () => {
    finishStudyWindow("return-home");
    const session = ensureTodaySession();
    session.historyView = null;
    session.revealed = false;
    session.cardPhase = "hidden";
    state.view = "home";
    render();
  }, {
    scope: "hierarchy",
    origin: returnOrigin,
    afterStart: () => saveStateAfterMotion(520, {
      sealLearningSession: true,
      syncChangeOptions: { changedMaps: ["studyWindows", "dashboardSnapshots"] },
    }),
    after: () => {
      studyHierarchyOrigin = null;
    },
  });
}

function openReturnDialog(event) {
  const session = ensureTodaySession();
  const historyOriginIndex = session.historyView?.originIndex;
  pendingCrossDayReturn = false;
  returnTitle.textContent = "返回";
  returnCrossDayWarning.hidden = true;
  returnOptions.hidden = false;
  previousWordButton.hidden = false;
  previousWordButton.disabled = session.currentIndex <= 0;
  nextHistoryWordButton.hidden = false;
  nextHistoryWordButton.disabled = !Number.isInteger(historyOriginIndex) ||
    session.currentIndex >= historyOriginIndex;
  returnHomeButton.textContent = "返回主页";
  returnHomeButton.className = "secondary-button";
  openFloatingDialog(returnDialog, event?.currentTarget);
}

function closeReturnDialog() {
  pendingCrossDayReturn = false;
  closeFloatingDialog(returnDialog);
}

function handleReturnHome(event) {
  const transitionOrigin = getUiTransitionOrigin(event?.currentTarget);
  if (isCrossDayStudy() && !pendingCrossDayReturn) {
    pendingCrossDayReturn = true;
    returnTitle.textContent = "确认进入下一日学习？";
    returnCrossDayWarning.hidden = false;
    previousWordButton.hidden = true;
    nextHistoryWordButton.hidden = true;
    returnHomeButton.textContent = "确认返回主页";
    returnHomeButton.className = "danger-button";
    return;
  }

  closeReturnDialog();
  exitStudy(transitionOrigin);
}

function showPreviousWord() {
  const session = ensureTodaySession();
  if (session.currentIndex <= 0) return;

  if (!session.historyView) {
    session.historyView = {
      originIndex: session.currentIndex,
      originRevealed: session.revealed,
      originPhase: session.cardPhase,
    };
  }
  commitUiTransition("backward", () => {
    session.currentIndex -= 1;
    session.revealed = true;
    session.cardPhase = "examples";
    clearStudyCompletionAnimation();
    closeReturnDialog();
    render();
    saveStateAfterMotion(460, { syncChangeOptions: { changedMaps: [] } });
  }, { scope: "card" });
}

function showNextHistoryWord() {
  const session = ensureTodaySession();
  const history = session.historyView;
  if (!history || session.currentIndex >= history.originIndex) return;

  commitUiTransition("forward", () => {
    session.currentIndex += 1;
    if (session.currentIndex >= history.originIndex) {
      session.currentIndex = Math.min(history.originIndex, session.queue.length);
      session.revealed = Boolean(history.originRevealed);
      session.cardPhase = history.originPhase || (session.revealed ? "select" : "hidden");
      session.historyView = null;
    } else {
      session.revealed = true;
      session.cardPhase = "examples";
    }
    clearStudyCompletionAnimation();
    closeReturnDialog();
    render();
    saveStateAfterMotion(460, { syncChangeOptions: { changedMaps: [] } });
  }, { scope: "card" });
}

function returnToCurrentWord() {
  const session = ensureTodaySession();
  const history = session.historyView;
  if (!history) return;

  commitUiTransition("forward", () => {
    session.currentIndex = Math.min(history.originIndex, session.queue.length);
    session.revealed = Boolean(history.originRevealed);
    session.cardPhase = history.originPhase || (session.revealed ? "select" : "hidden");
    session.historyView = null;
    clearStudyCompletionAnimation();
    render();
    saveStateAfterMotion(460, { syncChangeOptions: { changedMaps: [] } });
  }, { scope: "card" });
}

function revealSenses() {
  if (!state || !currentCard()) return;

  const session = ensureTodaySession();
  commitUiTransition("reveal", () => {
    session.revealed = true;
    session.cardPhase = "select";
    render();
    saveStateAfterMotion(340, { syncChangeOptions: { changedMaps: [] } });
  }, { scope: "reveal" });
}

function handleWordSurfaceClick() {
  if (!state || !currentCard()) return;
  const session = ensureTodaySession();
  if (!state.wordBrowse && !session.revealed) {
    revealSenses();
    return;
  }
  openConfusionGlobe(currentWord()?.id);
}

function stopWordAudio() {
  audioPlaybackGeneration += 1;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakWithLocalVoice(wordTextValue, playbackGeneration) {
  if (
    playbackGeneration !== audioPlaybackGeneration ||
    !("speechSynthesis" in window)
  ) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(wordTextValue);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function safeAudioUrl(sourceUrl) {
  if (!sourceUrl) return "";
  try {
    const url = new URL(sourceUrl, window.location.href);
    return url.protocol === "https:" || url.origin === window.location.origin
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function playWordAudio(word) {
  if (!word?.word) return;

  stopWordAudio();
  const playbackGeneration = audioPlaybackGeneration;
  const dedicatedUrls = audioRecordingsForWord(word)
    .map((recording) => recording.sourceUrl);
  const pronunciationUrls = dedicatedUrls.length
    ? dedicatedUrls
    : [
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
        word.word,
      )}&type=2`,
    ];
  let playedAny = false;

  const playNext = (index) => {
    if (playbackGeneration !== audioPlaybackGeneration) return;
    if (index >= pronunciationUrls.length) {
      activeAudio = null;
      if (!playedAny) speakWithLocalVoice(word.word, playbackGeneration);
      return;
    }

    let audio;
    try {
      audio = new Audio(pronunciationUrls[index]);
    } catch {
      playNext(index + 1);
      return;
    }
    activeAudio = audio;
    let settled = false;
    const supportsPlaybackEvents = typeof audio.addEventListener === "function";
    const settle = (succeeded) => {
      if (settled) return;
      settled = true;
      if (supportsPlaybackEvents) {
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("error", handleError);
      }
      if (
        playbackGeneration !== audioPlaybackGeneration ||
        activeAudio !== audio
      ) return;
      if (succeeded) playedAny = true;
      activeAudio = null;
      playNext(index + 1);
    };
    const handleEnded = () => settle(true);
    const handleError = () => settle(false);
    if (supportsPlaybackEvents) {
      audio.addEventListener("ended", handleEnded, { once: true });
      audio.addEventListener("error", handleError, { once: true });
    }

    try {
      Promise.resolve(audio.play())
        .then(() => {
          if (!supportsPlaybackEvents) settle(true);
        })
        .catch(handleError);
    } catch {
      handleError();
    }
  };

  playNext(0);
}

function maybeAutoPlayCurrentWord() {
  const session = ensureTodaySession();
  if (!state || session.revealed || state.view !== "study") return;

  const key = currentCardKey();
  const word = currentWord();
  if (!key || !word || key === lastAutoPlayedCardKey) return;

  lastAutoPlayedCardKey = key;
  playWordAudio(word);
}

function speakCurrentWord() {
  if (!state) return;

  const word = currentWord();
  if (!word) return;
  playWordAudio(word);
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function prefersLightweightUiMotion() {
  const brands = navigator.userAgentData?.brands
    ?.map((brand) => brand.brand)
    .join(" ") ?? "";
  return /HarmonyOS|OpenHarmony|ArkWeb|HuaweiBrowser|HUAWEI/i.test(
    `${navigator.userAgent ?? ""} ${brands}`,
  );
}

function playSenseTapSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return false;

  try {
    soundContext = soundContext ?? new AudioContextClass();
    if (!soundContext?.createOscillator || !soundContext?.createGain) return false;

    if (soundContext.state === "suspended" && typeof soundContext.resume === "function") {
      Promise.resolve(soundContext.resume()).catch(() => {});
    }

    const start = soundContext.currentTime;
    const oscillator = soundContext.createOscillator();
    const gain = soundContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(620, start);
    oscillator.frequency.exponentialRampToValueAtTime(880, start + 0.08);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

    oscillator.connect(gain);
    gain.connect(soundContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.13);
    return true;
  } catch {
    return false;
  }
}

function triggerStudyCompletionHaptic() {
  if (prefersReducedMotion() || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(15);
  } catch {
    // Unsupported or blocked vibration is an optional enhancement.
  }
}

function clearStudyCompletionAnimation() {
  if (completionFeedbackTimer !== null) {
    window.clearTimeout(completionFeedbackTimer);
    completionFeedbackTimer = null;
  }
  revealButton.closest(".word-card-wrap")?.classList.remove("is-card-completing");
}

function triggerStudyCompletionCue() {
  const cardWrap = revealButton.closest(".word-card-wrap");
  if (cardWrap) {
    cardWrap.classList.remove("is-card-completing");
    void cardWrap.offsetWidth;
    cardWrap.classList.add("is-card-completing");
  }

  if (completionFeedbackTimer !== null) {
    window.clearTimeout(completionFeedbackTimer);
  }
  completionFeedbackTimer = window.setTimeout(() => {
    completionFeedbackTimer = null;
    cardWrap?.classList.remove("is-card-completing");
  }, 500);

  playSenseTapSound();
  triggerStudyCompletionHaptic();
}

function setProgressMastered(
  key,
  progress,
  date,
  learningDay = activeLearningDay(),
  source = "new",
) {
  const actualDate = currentActivityDate();
  const previousStatus = progress.status ?? SENSE_STATUS.NEW;
  const enteredAt = new Date().toISOString();
  dashboardRecordTransition(state, key, previousStatus, SENSE_STATUS.MASTERED, {
    date: actualDate,
    observedAt: enteredAt,
    source,
    learningDay,
    outcome: true,
  });
  progress.status = SENSE_STATUS.MASTERED;
  progress.firstSeen = progress.firstSeen ?? date;
  progress.lastSeen = date;
  progress.masteredOn = date;
  progress.firstSeenActual = progress.firstSeenActual ?? actualDate;
  progress.lastSeenActual = actualDate;
  progress.masteredOnActual = actualDate;
  progress.dueDate = null;
  progress.lastLearningDay = learningDay;
  progress.dueLearningDay = null;
  progress.statusEnteredAt = previousStatus === SENSE_STATUS.MASTERED
    ? progress.statusEnteredAt
    : enteredAt;
  progress.updatedAt = enteredAt;
}

function setProgressPending(
  key,
  progress,
  status,
  date,
  dueDate,
  dueLearningDay,
  source = "reinforcement",
) {
  const actualDate = currentActivityDate();
  const previousStatus = progress.status ?? SENSE_STATUS.NEW;
  const enteredAt = new Date().toISOString();
  dashboardRecordTransition(state, key, previousStatus, status, {
    date: actualDate,
    observedAt: enteredAt,
    source,
    learningDay: dueLearningDay,
    outcome: true,
  });
  progress.status = status;
  progress.firstSeen = progress.firstSeen ?? date;
  progress.lastSeen = date;
  progress.masteredOn = null;
  progress.firstSeenActual = progress.firstSeenActual ?? actualDate;
  progress.lastSeenActual = actualDate;
  progress.masteredOnActual = null;
  progress.dueDate = dueDate;
  progress.lastLearningDay = activeLearningDay();
  progress.dueLearningDay = dueLearningDay;
  progress.statusEnteredAt = previousStatus === status
    ? progress.statusEnteredAt
    : enteredAt;
  progress.updatedAt = enteredAt;
}

function markSenseFamiliar(key, options = {}) {
  if (!options.skipSound) {
    playSenseTapSound();
  }

  const session = ensureTodaySession();
  const card = currentCard();
  if (!card || !activeSenseKeysForCard(card).includes(key)) return;
  if ((card.confirmedKeys ?? []).includes(key) || isMastered(key)) return;
  ensureEncounterSnapshot(card);

  const progress = progressFor(key);
  const date = activeStudyDate();
  const learningDay = activeLearningDay();
  if (isNewLearningKey(card, key)) {
    setProgressMastered(key, progress, date, learningDay, card.type ?? "new");
  } else if (card.type === "reinforcement") {
    setProgressPending(
      key,
      progress,
      SENSE_STATUS.REVIEW,
      date,
      addDays(date, 1),
      learningDay + 1,
      "reinforcement",
    );
  } else if (card.type === "review") {
    if (progress.status === SENSE_STATUS.REVIEW) {
      setProgressMastered(key, progress, date, learningDay);
    } else {
      setProgressPending(
        key,
        progress,
        SENSE_STATUS.REVIEW,
        date,
        addDays(date, 1),
        learningDay + 1,
        "review",
      );
      session.reviewPromotedKeys = [
        ...new Set([...(session.reviewPromotedKeys ?? []), key]),
      ];
    }
  }

  card.confirmedKeys = [...new Set([...(card.confirmedKeys ?? []), key])];
  if (isWordFullyMastered(card.wordId)) {
    card.expandedMasteredKeys = [];
    session.cardPhase = "examples";
  }
  if (!options.skipRender) {
    render();
  }
  // State mutation is complete before this point; never serialize/compress the
  // full multi-book cache before the pressed state can paint.
  const syncChangeOptions = {
    changedMaps: ["progress", "dashboardEvents"],
    changedScalars: ["session"],
    changedMapKeysByBook: {
      [activeBookId()]: { progress: [key] },
    },
  };
  if (options.deferSave) {
    saveStateAfterMotion(380, { syncChangeOptions });
  } else {
    saveStateAfterInteractionFrame({ syncChangeOptions });
  }
}

function toggleGreenSenseDetails(key) {
  const card = currentCard();
  if (!card || !isKnownSenseKey(key)) return;
  const expanded = new Set(card.expandedMasteredKeys ?? []);
  if (expanded.has(key)) {
    expanded.delete(key);
  } else {
    expanded.add(key);
  }
  card.expandedMasteredKeys = [...expanded];
  render();
  saveStateAfterInteractionFrame({
    syncChangeOptions: { changedMaps: [], stampScalars: false },
  });
}

function animateSenseMastered(item) {
  if (item.classList.contains("is-confirming")) return;

  const key = item.dataset.key;
  const reducedMotion = prefersReducedMotion();
  const startedAt = performance.now();
  senseList.classList.add("is-reordering");
  item.classList.add("is-confirming");
  item.disabled = true;
  const commit = (previousLayout) => {
    playSenseTapSound();
    markSenseFamiliar(key, { skipSound: true, skipRender: true, deferSave: true });
    if (ensureTodaySession().cardPhase === "examples") {
      nextButton.textContent = "下一词";
      nextButton.disabled = true;
      revealButton.classList.add("is-mastered");
    }
    const reorder = () => {
      render();
      animateSenseReorder(previousLayout, key);
    };
    if (reducedMotion) {
      reorder();
      return;
    }
    window.setTimeout(reorder, Math.max(0, 100 - (performance.now() - startedAt)));
  };
  if (reducedMotion) {
    const previousLayout = new Map(
      [...senseList.querySelectorAll(".sense-item[data-key]")].map((senseItem) => [
        senseItem.dataset.key,
        senseItem.getBoundingClientRect(),
      ]),
    );
    commit(previousLayout);
    return;
  }
  // One input frame is enough to paint the pressed state. A second frame made
  // large histories feel as if the tap had stalled before the FLIP movement.
  window.requestAnimationFrame(() => {
    const previousLayout = new Map(
      [...senseList.querySelectorAll(".sense-item[data-key]")].map((senseItem) => [
        senseItem.dataset.key,
        senseItem.getBoundingClientRect(),
      ]),
    );
    commit(previousLayout);
  });
}

function animateSenseReorder(previousLayout, selectedKey) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animations = [];

  senseList.querySelectorAll(".sense-item[data-key]").forEach((item) => {
    const previous = previousLayout.get(item.dataset.key);
    if (!previous) return;

    const current = item.getBoundingClientRect();
    const offsetX = previous.left - current.left;
    const offsetY = previous.top - current.top;
    if (Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5) return;

    const selected = item.dataset.key === selectedKey;
    if (reducedMotion) return;
    animations.push(
      item.animate(
        [
          {
            transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${selected ? 0.965 : 1})`,
          },
          {
            transform: "translate3d(0, 0, 0) scale(1)",
          },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "both",
        },
      ),
    );
  });

  if (animations.length === 0) {
    senseList.classList.remove("is-reordering");
    return;
  }

  Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
    animations.forEach((animation) => animation.cancel());
    senseList.classList.remove("is-reordering");
  });
}

function isNewLearningCard(card) {
  return card?.type === "new" || card?.type === "extra" || card?.type === "advance";
}

function isNewLearningKey(card, key) {
  return isNewLearningCard(card) || (card?.newSenseKeys ?? []).includes(key);
}

function unknownSenseKeysForCurrentCard() {
  const card = currentCard();
  if (!card) return [];
  const confirmed = new Set(card.confirmedKeys ?? []);
  return activeSenseKeysForCard(card)
    .filter(isKnownSenseKey)
    .filter((key) => !isMastered(key))
    .filter((key) => !confirmed.has(key));
}

function completeCurrentSelection() {
  if (!state) return;

  const session = ensureTodaySession();
  const card = currentCard();
  if (!session.revealed || !card) return;

  commitUiTransition("reveal", () => {
    card.expandedMasteredKeys = [];
    session.cardPhase = "examples";
    render();
    saveStateAfterMotion(340, {
      syncChangeOptions: { changedMaps: [], stampScalars: false },
    });
  }, { scope: "reveal" });
}

function scheduleUnknownSenses() {
  const card = currentCard();
  const unknownKeys = unknownSenseKeysForCurrentCard();
  const date = activeStudyDate();
  const learningDay = activeLearningDay();
  const dueDate = card?.type === "reinforcement" ? addDays(date, 1) : date;
  const dueLearningDay = card?.type === "reinforcement"
    ? learningDay + 1
    : learningDay;

  unknownKeys.forEach((key) => {
    const progress = progressFor(key);
    setProgressPending(
      key,
      progress,
      SENSE_STATUS.REINFORCE,
      date,
      dueDate,
      dueLearningDay,
      card?.type ?? "new",
    );
    progress.misses += 1;
  });
}

function markCurrentWordIntroduced() {
  const card = currentCard();
  if (!card || !isNewLearningCard(card)) return false;
  if (!state.introducedWords.includes(card.wordId)) {
    state.introducedWords.push(card.wordId);
    addActivityWord("new", card.wordId);
    updatePlanDrift();
    return true;
  }
  return false;
}

function nextWord() {
  if (!state) return;

  const session = ensureTodaySession();
  const completedCard = currentCard();
  if (!session.revealed || session.cardPhase !== "examples" || !completedCard) return;
  const activeBook = activeBookId();
  const cardKeys = activeSenseKeysForCard(completedCard);
  const syncChangeOptions = {
    changedMaps: ["progress", "introducedWords", "activityLog", "dashboardEvents"],
    changedScalars: ["session"],
    changedMapKeysByBook: {
      [activeBook]: {
        progress: cardKeys,
        introducedWords: [completedCard.wordId],
        activityLog: [currentActivityDate()],
      },
    },
  };

  commitUiTransition("forward", () => {
    scheduleUnknownSenses();
    markCurrentWordIntroduced();
    if (
      completedCard.type === "extra" ||
      completedCard.type === "advance" ||
      session.activeBatchType === "extra" ||
      session.activeBatchType === "advance"
    ) {
      activityForDate().overtime = true;
    }
    if (completedCard.type === "review" || completedCard.type === "reinforcement") {
      addActivityWord("review", completedCard.wordId);
    }
    if (completedCard.type === "reinforcement") {
      session.reinforcedKeys = [
        ...new Set([...session.reinforcedKeys, ...activeSenseKeysForCard(completedCard)]),
      ];
    }
    session.currentIndex += 1;
    session.revealed = false;
    session.cardPhase = "hidden";

    if (session.currentIndex >= session.queue.length) {
      appendReinforcementStage();
    }

    if (
      session.currentIndex >= session.queue.length &&
      session.activeBatchType === "planned"
    ) {
      session.baseCompleted = true;
      activityForDate().baseCompleted = true;
    }
    if (
      session.currentIndex >= session.queue.length &&
      session.activeBatchType === "advance" &&
      !session.advanceShiftCommitted
    ) {
      session.advanceShiftCommitted = true;
      activityForDate().overtime = true;
    }
    render();
    if (!currentCard()) triggerStudyCompletionCue();
  }, {
    scope: "card",
    afterStart: () => {
      const sessionFinished = !currentCard();
      saveStateAfterMotion(sessionFinished ? 160 : 460, {
        syncChangeOptions,
        journalOnly: !sessionFinished,
        sealLearningSession: sessionFinished,
      });
    },
  });
}

function handleProgressButton(event) {
  if (state.wordBrowse) {
    closeWordCard();
    return;
  }
  const session = ensureTodaySession();
  if (!currentCard()) {
    exitStudy(getUiTransitionOrigin(event?.currentTarget));
    return;
  }
  if (session.historyView) {
    returnToCurrentWord();
    return;
  }
  if (session.cardPhase === "examples") {
    nextWord();
    return;
  }

  completeCurrentSelection();
}

function resettableCardIndex() {
  const session = ensureTodaySession();
  if (session.queue[session.currentIndex]) return session.currentIndex;
  if (session.queue.length > 0) return session.queue.length - 1;
  return -1;
}

function resettableCard() {
  const session = ensureTodaySession();
  const index = resettableCardIndex();
  return index >= 0 ? session.queue[index] : null;
}

function openPlanDialog(event) {
  bookSelect.value = activeBookId();
  const selectedState = rootState.bookStates[bookSelect.value] ?? createState();
  const value = selectedState.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET;
  planTitle.textContent = selectedState.plan?.dailyTarget ? "修改计划" : "选择计划";
  dailyTargetInput.value = value;
  planForm.hidden = false;
  planResetConfirm.hidden = true;
  resetAllPlanButton.hidden = !selectedState.plan?.dailyTarget;
  updatePlanPreview();
  openFloatingDialog(planDialog, event?.currentTarget);
}

function closePlanDialog(options = {}) {
  if (
    tutorialRuntime?.active &&
    tutorialRuntime.step === "plan-form" &&
    options.force !== true
  ) return;
  planForm.hidden = false;
  planResetConfirm.hidden = true;
  closeFloatingDialog(planDialog, { force: options.force === true });
}

function showPlanResetConfirmation() {
  const bookId = bookSelect.value;
  if (!rootState.bookStates[bookId]?.plan?.dailyTarget) return;
  if (planResetBookName) planResetBookName.textContent = bookDisplayName(bookId);
  planForm.hidden = true;
  planResetConfirm.hidden = false;
}

function hidePlanResetConfirmation() {
  planResetConfirm.hidden = true;
  planForm.hidden = false;
}

function normalizedDailyTarget() {
  const parsed = Number.parseInt(dailyTargetInput.value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_DAILY_TARGET;
  return Math.min(500, Math.max(1, parsed));
}

function updatePlanPreview() {
  const target = normalizedDailyTarget();
  const bookId = bookSelect.value || activeBookId();
  const bookState = rootState.bookStates[bookId] ?? createState();
  const bookWords = wordsForBook(bookId);
  const knownIds = new Set(bookWords.map((word) => word.id));
  const completed = new Set(
    (bookState.introducedWords ?? []).filter((wordId) => knownIds.has(wordId)),
  ).size;
  const remaining = Math.max(0, bookWords.length - completed);
  const days = remaining === 0 ? 0 : Math.ceil(remaining / target);
  const completion = addDays(currentDate(), days);
  planPreview.textContent = `按剩余 ${remaining} 个词计算，每天 ${target} 个，预计还需 ${days} 天，完成日期 ${completion}。`;
  planTitle.textContent = bookState.plan?.dailyTarget ? "修改计划" : "选择计划";
  resetAllPlanButton.hidden = !bookState.plan?.dailyTarget;
}

function savePlan() {
  const selectedBookId = bookSelect.value || activeBookId();
  if (selectedBookId !== activeBookId()) {
    activateBookScope(selectedBookId);
  }
  const target = normalizedDailyTarget();
  const date = currentDate();

  if (!state.plan) {
    state.plan = {
      dailyTarget: target,
      startedOn: date,
      createdOn: date,
      updatedOn: date,
      advancedDays: 0,
      progressBaseWords: 0,
      progressBaseDays: 0,
    };
  } else {
    const preservedProgress = progressDayCount(state.plan.dailyTarget);
    state.plan.progressBaseWords = completedWordCount();
    state.plan.progressBaseDays = preservedProgress;
    state.plan.dailyTarget = target;
    state.plan.updatedOn = date;
  }
  ensurePlanTargetHistory(state);
  state.planTargetHistory[date] = target;

  closePlanDialog({ force: true });
  saveState();
  render();
}

function openResetDialog(event) {
  if (!state) return;

  const card = resettableCard();
  const word = card ? wordById.get(card.wordId) : null;

  resetWordLabel.textContent = word ? `当前单词：${word.word}` : "当前没有单词";
  resetMarkingButton.disabled = !word;
  relearnWordButton.disabled = !word;
  showResetOptions();
  openFloatingDialog(resetDialog, event?.currentTarget);
}

function closeResetDialog() {
  pendingResetType = null;
  closeFloatingDialog(resetDialog);
}

function showResetOptions() {
  pendingResetType = null;
  resetOptions.hidden = false;
  resetConfirm.hidden = true;
}

function showRelearnConfirmation() {
  const card = resettableCard();
  const word = card ? wordById.get(card.wordId) : null;

  pendingResetType = "relearn";
  resetOptions.hidden = true;
  resetConfirm.hidden = false;
  resetConfirmTitle.textContent = "确认重学该单词？";
  resetConfirmCopy.textContent = word
    ? `${word.word} 的所有义项会回到待新学状态，并重新按初始顺序学习。`
    : "当前没有可重学的单词。";
  confirmResetButton.textContent = "确认重学该单词";
}

function confirmPendingReset() {
  if (pendingResetType === "relearn") {
    relearnCurrentWord();
  }
}

function resetAllProgress() {
  const selectedBookId = bookSelect.value || activeBookId();
  rootState.bookStates[selectedBookId] = createState();
  activateBookScope(selectedBookId);
  saveState();
  closePlanDialog();
  render();
}

function resetCurrentMarking() {
  const session = ensureTodaySession();
  const cardIndex = resettableCardIndex();
  const card = session.queue[cardIndex];
  if (!card) return;

  ensureEncounterSnapshot(card);
  const snapshot = card.encounterSnapshot;
  const resetUpdatedAt = new Date().toISOString();
  Object.entries(snapshot.progress ?? {}).forEach(([key, progress]) => {
    if (progress) {
      const restored = cloneProgress(progress);
      const currentStatus = state.progress[key]?.status ?? SENSE_STATUS.NEW;
      if (currentStatus !== restored.status) {
        dashboardRecordTransition(state, key, currentStatus, restored.status, {
          date: currentActivityDate(),
          source: "reset",
        });
      }
      if (stableStateStringify(state.progress[key]) !== stableStateStringify(restored)) {
        restored.updatedAt = resetUpdatedAt;
      }
      state.progress[key] = restored;
    } else {
      if (state.progress[key]?.status && state.progress[key].status !== SENSE_STATUS.NEW) {
        dashboardRecordTransition(state, key, state.progress[key].status, SENSE_STATUS.NEW, {
          date: currentActivityDate(),
          source: "reset",
        });
      }
      delete state.progress[key];
    }
  });

  const introduced = new Set(state.introducedWords);
  if (snapshot.introduced) {
    introduced.add(card.wordId);
  } else {
    introduced.delete(card.wordId);
  }
  state.introducedWords = [...introduced];
  if (snapshot.activity) {
    state.activityLog[currentActivityDate()] = normalizeActivityEntry(snapshot.activity);
  } else {
    delete state.activityLog[currentActivityDate()];
  }
  updatePlanDrift();

  session.reinforcedKeys = [
    ...session.reinforcedKeys.filter(
      (key) => splitSenseKey(key).wordId !== card.wordId,
    ),
    ...(snapshot.reinforcedKeys ?? []),
  ];
  session.reviewPromotedKeys = [
    ...session.reviewPromotedKeys.filter(
      (key) => splitSenseKey(key).wordId !== card.wordId,
    ),
    ...(snapshot.reviewPromotedKeys ?? []),
  ];
  const snapshotConfirmedKeys = Array.isArray(snapshot.confirmedKeys)
    ? snapshot.confirmedKeys
    : card.type === "reinforcement"
      ? snapshot.reviewPromotedKeys ?? []
      : [];
  card.confirmedKeys = [...new Set(snapshotConfirmedKeys)].filter((key) => {
    return isKnownSenseKey(key) &&
      splitSenseKey(key).wordId === card.wordId &&
      state.progress[key]?.status === SENSE_STATUS.REVIEW;
  });
  refreshCardDisplayKeys(card);
  session.currentIndex = cardIndex;
  session.revealed = true;
  session.cardPhase = "select";
  clearStudyCompletionAnimation();
  saveState();
  closeResetDialog();
  render();
}

function relearnCurrentWord() {
  const session = ensureTodaySession();
  const cardIndex = resettableCardIndex();
  const card = session.queue[cardIndex];
  if (!card) return;

  const word = wordById.get(card.wordId);
  const allKeys = sortSenseKeysByImportance(allSenseKeysForWord(word));
  allKeys.forEach((key) => {
    const previous = state.progress[key];
    if (previous && previous.status !== SENSE_STATUS.NEW) {
      dashboardRecordTransition(state, key, previous.status, SENSE_STATUS.NEW, {
        date: currentActivityDate(),
        source: "relearn",
      });
    }
    delete state.progress[key];
  });
  state.introducedWords = state.introducedWords.filter(
    (wordId) => wordId !== card.wordId,
  );
  updatePlanDrift();
  session.reinforcedKeys = session.reinforcedKeys.filter(
    (key) => splitSenseKey(key).wordId !== card.wordId,
  );
  session.reviewPromotedKeys = session.reviewPromotedKeys.filter(
    (key) => splitSenseKey(key).wordId !== card.wordId,
  );

  const insertionIndex = session.queue
    .slice(0, cardIndex)
    .filter((item) => item.wordId !== card.wordId).length;
  session.queue = session.queue.filter((item) => item.wordId !== card.wordId);
  const replacement = createStudyCard("new", card.wordId, allKeys);
  session.queue.splice(insertionIndex, 0, replacement);
  session.currentIndex = insertionIndex;
  session.reinforcementAdded = session.queue.some(
    (item) => item.type === "reinforcement",
  );
  session.revealed = false;
  session.cardPhase = "hidden";
  clearStudyCompletionAnimation();
  saveState();
  closeResetDialog();
  render();
}

const TUTORIAL_HINTS = Object.freeze({
  plan: "点击这里选择词书和每日计划",
  "plan-form": "选择词书和每日计划，然后保存计划",
  start: "试着学几个单词吧",
  "recall-wait": "当单词出现时，请先尽可能回忆其所有含义",
  reveal: "回忆完成后，点击单词卡片展开详细内容",
  "act-performance": "展开后，点击刚才已经想到的义项",
  "act-law": "展开后，点击刚才已经想到的义项",
  reset: "当误点了不熟悉的义项时，可以在重置中撤回",
  "reset-marking": "点击这里撤回本次标记",
  complete: "标记完所有能回忆起来的义项后，点击这里结束标记。",
  "examples-wait": "不熟悉的义项提供了释义和例句以帮助学习记忆",
  "act-next": "完成学习后，点击这里进入下一词的学习。存在不熟悉义项的单词将进入强化和复习",
  "her-senses": "试试点击所有义项",
  "her-next": "所有义项都被标为熟悉的新单词将不再出现",
  "abandon-return": "点击这里返回主页",
  "return-home": "点击这里返回主页",
  more: "点击这里注册/登录/退出账户，或反馈遇到的问题，或重新学习教程",
  account: "请尽快注册账户，以防数据丢失；若已有账户，请直接登录",
});

function tutorialScopeId() {
  return document.documentElement.dataset.accountUserId || "guest";
}

function tutorialStorageKey(scopeId = tutorialScopeId()) {
  return `${TUTORIAL_STORAGE_PREFIX}${scopeId}`;
}

function tutorialTargetForStep(step = tutorialRuntime?.step) {
  const selectors = {
    plan: "#planButton",
    "plan-form": "#planForm",
    start: "#startStudyButton",
    "recall-wait": "#revealButton",
    reveal: "#revealButton",
    "act-performance": '.sense-item[data-key="act:v-1"]',
    "act-law": '.sense-item[data-key="act:n-3"]',
    reset: "#resetButton",
    "reset-marking": "#resetMarkingButton",
    complete: "#nextButton",
    "examples-wait": "#senseArea",
    "act-next": "#nextButton",
    "her-wait": "#revealButton",
    "her-senses": "#senseList",
    "her-next": "#nextButton",
    "abandon-return": "#exitStudyButton",
    "return-home": "#returnHomeButton",
    more: "#globalSettingsNavButton",
    account: "#accountButton",
  };
  const selector = selectors[step];
  if (!selector) return null;
  const target = document.querySelector(selector);
  return target && !target.hidden && target.getClientRects().length
    ? target
    : null;
}

function setTutorialMaskRect(mask, left, top, width, height) {
  mask.style.left = `${Math.max(0, left)}px`;
  mask.style.top = `${Math.max(0, top)}px`;
  mask.style.width = `${Math.max(0, width)}px`;
  mask.style.height = `${Math.max(0, height)}px`;
}

function setTutorialLiveTarget(target) {
  if (tutorialLiveTarget === target) return;
  tutorialLiveTarget?.classList.remove("is-tutorial-live-target");
  tutorialLiveTarget = null;
  if (target && !target.closest(".modal-backdrop")) {
    tutorialLiveTarget = target;
    tutorialLiveTarget.classList.add("is-tutorial-live-target");
  }
}

function positionTutorialExclusionMask() {
  const excludePlanCancel = tutorialRuntime?.step === "plan-form" &&
    !planDialog.hidden &&
    !cancelPlanButton.hidden &&
    cancelPlanButton.getClientRects().length;
  tutorialExclusionMask.hidden = !excludePlanCancel;
  if (!excludePlanCancel) return;
  const rect = cancelPlanButton.getBoundingClientRect();
  const padding = 5;
  Object.assign(tutorialExclusionMask.style, {
    left: `${rect.left - padding}px`,
    top: `${rect.top - padding}px`,
    width: `${rect.width + padding * 2}px`,
    height: `${rect.height + padding * 2}px`,
    borderRadius: "10px",
  });
}

function tutorialVisualRect(target) {
  const targets = tutorialRuntime?.step === "her-senses"
    ? [revealButton, senseArea]
    : [target];
  const rects = targets
    .filter((item) => item && !item.hidden && item.getClientRects().length)
    .map((item) => item.getBoundingClientRect());
  if (!rects.length) return target.getBoundingClientRect();
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  };
}

function positionTutorialOverlay(options = {}) {
  if (!tutorialRuntime?.active || tutorialOverlay.hidden) return;

  const hint = TUTORIAL_HINTS[tutorialRuntime.step] ?? "";
  if (tutorialTip.textContent !== hint) tutorialTip.textContent = hint;
  tutorialTip.hidden = !hint;
  const target = tutorialTargetForStep();
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  setTutorialLiveTarget(target);
  positionTutorialExclusionMask();

  if (!target) {
    const geometryKey = `${tutorialRuntime.step}|none|${viewportWidth}|${viewportHeight}`;
    if (options?.force !== true && geometryKey === tutorialOverlayGeometryKey) return;
    tutorialOverlayGeometryKey = geometryKey;
    setTutorialMaskRect(tutorialMasks.top, 0, 0, viewportWidth, viewportHeight);
    setTutorialMaskRect(tutorialMasks.right, 0, 0, 0, 0);
    setTutorialMaskRect(tutorialMasks.bottom, 0, 0, 0, 0);
    setTutorialMaskRect(tutorialMasks.left, 0, 0, 0, 0);
    tutorialSpotlight.hidden = true;
    tutorialTip.classList.add("is-centered");
    tutorialTip.style.left = "50%";
    tutorialTip.style.top = "50%";
    return;
  }

  const padding = 8;
  const rect = tutorialVisualRect(target);
  const geometryKey = [
    tutorialRuntime.step,
    viewportWidth,
    viewportHeight,
    rect.left.toFixed(2),
    rect.top.toFixed(2),
    rect.right.toFixed(2),
    rect.bottom.toFixed(2),
  ].join("|");
  if (options?.force !== true && geometryKey === tutorialOverlayGeometryKey) return;
  tutorialOverlayGeometryKey = geometryKey;

  const left = Math.min(viewportWidth, Math.max(0, rect.left - padding));
  const top = Math.min(viewportHeight, Math.max(0, rect.top - padding));
  const right = Math.max(0, Math.min(viewportWidth, rect.right + padding));
  const bottom = Math.max(0, Math.min(viewportHeight, rect.bottom + padding));
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);

  setTutorialMaskRect(tutorialMasks.top, 0, 0, viewportWidth, top);
  setTutorialMaskRect(tutorialMasks.bottom, 0, bottom, viewportWidth, viewportHeight - bottom);
  setTutorialMaskRect(tutorialMasks.left, 0, top, left, height);
  setTutorialMaskRect(tutorialMasks.right, right, top, viewportWidth - right, height);

  tutorialSpotlight.hidden = false;
  tutorialSpotlight.style.left = `${left}px`;
  tutorialSpotlight.style.top = `${top}px`;
  tutorialSpotlight.style.width = `${width}px`;
  tutorialSpotlight.style.height = `${height}px`;

  tutorialTip.classList.remove("is-centered");
  const tipRect = tutorialTip.getBoundingClientRect();
  const tipWidth = Math.min(tipRect.width || 360, viewportWidth - 24);
  const minTipCenter = 12 + tipWidth / 2;
  const maxTipCenter = viewportWidth - 12 - tipWidth / 2;
  const targetCenter = left + width / 2;
  tutorialTip.style.left = `${maxTipCenter < minTipCenter
    ? viewportWidth / 2
    : Math.min(Math.max(minTipCenter, targetCenter), maxTipCenter)}px`;
  const tipHeight = tipRect.height || 72;
  if (tutorialRuntime.step === "examples-wait") {
    tutorialTip.style.left = `${viewportWidth / 2}px`;
    tutorialTip.style.top = "12px";
    return;
  }
  const canPlaceBelow = bottom + 14 + tipHeight <= viewportHeight - 12;
  const canPlaceAbove = top - tipHeight - 14 >= 12;
  const preferAbove = tutorialRuntime.step === "reset-marking";
  tutorialTip.style.top = `${preferAbove && canPlaceAbove
    ? top - tipHeight - 14
    : canPlaceBelow
      ? bottom + 14
      : Math.max(12, top - tipHeight - 14)}px`;
}

function stopTutorialOverlayTracking() {
  if (tutorialOverlayFrameId !== null) {
    window.cancelAnimationFrame(tutorialOverlayFrameId);
  }
  tutorialOverlayFrameId = null;
  tutorialOverlayGeometryKey = "";
  setTutorialLiveTarget(null);
  tutorialExclusionMask.hidden = true;
}

function startTutorialOverlayTracking() {
  if (tutorialOverlayFrameId !== null) return;
  const track = () => {
    tutorialOverlayFrameId = null;
    if (!tutorialRuntime?.active || tutorialOverlay.hidden) return;
    positionTutorialOverlay();
    tutorialOverlayFrameId = window.requestAnimationFrame(track);
  };
  tutorialOverlayFrameId = window.requestAnimationFrame(track);
}

function scheduleTutorialOverlayPosition({ scroll = false } = {}) {
  if (!tutorialRuntime?.active) return;
  window.requestAnimationFrame(() => {
    const target = tutorialTargetForStep();
    if (scroll && target) {
      target.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
    }
    tutorialOverlayGeometryKey = "";
    positionTutorialOverlay({ force: true });
    startTutorialOverlayTracking();
  });
}

function setTutorialStep(step, options = {}) {
  if (!tutorialRuntime?.active) return;
  if (tutorialRuntime.timer) {
    window.clearTimeout(tutorialRuntime.timer);
    tutorialRuntime.timer = null;
  }
  tutorialRuntime.step = step;
  if (step === "plan-form" && planDialog.hidden) openPlanDialog();
  if (step === "reset-marking" && resetDialog.hidden) openResetDialog();
  if (step === "return-home" && returnDialog.hidden) openReturnDialog();
  if (step === "account" && settingsPanel.hidden) openSettings();
  tutorialOverlay.hidden = false;
  scheduleTutorialOverlayPosition({ scroll: options.scroll !== false });
}

function beginTutorialWait(step, nextStep, delay = TUTORIAL_WAIT_MS) {
  setTutorialStep(step, { scroll: false });
  tutorialRuntime.timer = window.setTimeout(() => {
    tutorialRuntime.timer = null;
    setTutorialStep(nextStep);
  }, delay);
}

function tutorialSessionForWord(wordId, { revealed = false } = {}) {
  const word = wordById.get(wordId);
  if (!word) return false;
  stopWordAudio();
  state.session = {
    date: currentDate(),
    queue: [createStudyCard("new", word.id, allSenseKeysForWord(word))],
    currentIndex: 0,
    revealed,
    cardPhase: revealed ? "select" : "hidden",
    baseNewAdded: true,
    baseCompleted: false,
    activeBatchType: "planned",
    activePlanDate: currentDate(),
    extraBatches: 0,
    advanceBatches: 0,
    advanceShiftCommitted: false,
    reinforcementAdded: false,
    reinforcedKeys: [],
    reviewPromotedKeys: [],
    activeLearningDay: 1,
    baseLearningDay: 1,
    historyView: null,
    snapshotTimingVersion: 2,
  };
  state.view = "study";
  state.wordBrowse = null;
  lastAutoPlayedCardKey = null;
  render();
  if (revealed) {
    lastAutoPlayedCardKey = currentCardKey();
    playWordAudio(word);
  }
  return true;
}

function beginTutorialStudy() {
  if (!tutorialRuntime?.active) return;
  activateBookScope(DEFAULT_BOOK_ID);
  state.plan = {
    dailyTarget: 3,
    startedOn: currentDate(),
    createdOn: currentDate(),
    updatedOn: currentDate(),
    advancedDays: 0,
    progressBaseWords: 0,
    progressBaseDays: 0,
  };
  tutorialSessionForWord("act");
  beginTutorialWait("recall-wait", "reveal");
}

function tutorialCurrentWordIsFullyMarked() {
  const card = currentCard();
  if (!card) return false;
  return activeSenseKeysForCard(card).every((key) => {
    return isMastered(key) || (card.confirmedKeys ?? []).includes(key);
  });
}

function closeTutorialSurfaces() {
  planDialog.hidden = true;
  resetDialog.hidden = true;
  returnDialog.hidden = true;
  document.querySelector("#accountDialog").hidden = true;
}

function startTutorial({ replay = false } = {}) {
  if (!rootState || tutorialRuntime?.active) return false;

  const scopeId = tutorialScopeId();
  closeTutorialSurfaces();
  tutorialRuntime = {
    active: true,
    replay,
    scopeId,
    realStorageKey: activeStorageKey,
    realRootState: cloneSerializable(rootState),
    timer: null,
    step: "plan",
  };

  rootState = createRootState();
  activateBookScope(DEFAULT_BOOK_ID);
  stopWordAudio();
  state.view = "home";
  state.plan = null;
  render();
  tutorialDoneDialog.hidden = true;
  tutorialOverlay.hidden = false;
  stopTutorialOverlayTracking();
  setTutorialStep("plan");
  return true;
}

function finishTutorial() {
  if (!tutorialRuntime?.active) return;
  const completedScope = tutorialRuntime.scopeId;
  if (tutorialRuntime.timer) window.clearTimeout(tutorialRuntime.timer);
  const realRootState = tutorialRuntime.realRootState;
  const realStorageKey = tutorialRuntime.realStorageKey;
  stopWordAudio();
  stopTutorialOverlayTracking();
  tutorialRuntime = null;
  tutorialOverlay.hidden = true;
  tutorialDoneDialog.hidden = true;
  localStorage.setItem(tutorialStorageKey(completedScope), "completed");

  activeStorageKey = realStorageKey;
  rootState = normalizeRootState(realRootState);
  activateBookScope(rootState.activeBookId);
  state.view = "home";
  state.wordBrowse = null;
  // The tutorial deliberately never writes its demo state. Persist the real
  // state immediately when it restores control so a page close right after
  // the tutorial cannot leave the account on an in-memory-only copy.
  saveState({
    notify: false,
    stampSync: false,
    syncRelevant: false,
    recordDashboardSnapshot: false,
  });
  render();
  window.dispatchEvent(new CustomEvent("sensevocab:tutorial-finished", {
    detail: { storageKey: activeStorageKey },
  }));
}

function showTutorialCompletedDialog() {
  if (!tutorialRuntime?.active) return;
  stopTutorialOverlayTracking();
  tutorialOverlay.hidden = true;
  tutorialDoneDialog.hidden = false;
}

function automaticTutorialAllowed() {
  return !navigator.webdriver ||
    window.__SENSE_VOCAB_ALLOW_AUTOMATIC_TUTORIAL__ === true;
}

function clearAutomaticTutorialSchedule() {
  if (tutorialAutoTimer !== null) {
    window.clearTimeout(tutorialAutoTimer);
  }
  tutorialAutoTimer = null;
  tutorialAutoScheduledScope = null;
}

function maybeStartAutomaticTutorial(delay = TUTORIAL_AUTO_START_DELAY_MS) {
  if (!automaticTutorialAllowed() || tutorialRuntime?.active) return;

  const scopeId = tutorialScopeId();
  if (tutorialAutoWaitScope !== scopeId) {
    tutorialAutoWaitScope = scopeId;
    tutorialAutoWaitStartedAt = Date.now();
  }
  if (localStorage.getItem(tutorialStorageKey(scopeId))) {
    if (tutorialAutoScheduledScope === scopeId) {
      clearAutomaticTutorialSchedule();
    }
    return;
  }
  if (tutorialAutoTimer !== null) {
    if (tutorialAutoScheduledScope === scopeId) return;
    clearAutomaticTutorialSchedule();
  }

  tutorialAutoScheduledScope = scopeId;
  tutorialAutoTimer = window.setTimeout(() => {
    tutorialAutoTimer = null;
    tutorialAutoScheduledScope = null;

    const activeScope = tutorialScopeId();
    if (tutorialRuntime?.active) return;
    if (activeScope !== scopeId) {
      maybeStartAutomaticTutorial();
      return;
    }
    if (localStorage.getItem(tutorialStorageKey(scopeId))) return;

    const appReady = document.documentElement.dataset.appReady === "true";
    const accountReady =
      document.documentElement.dataset.accountReady === "true";
    const accountConflictOpen =
      !document.querySelector("#accountConflictView").hidden;
    const accountDialogOpen =
      !document.querySelector("#accountDialog").hidden;
    const accountReadyGraceElapsed =
      Date.now() - tutorialAutoWaitStartedAt >= TUTORIAL_ACCOUNT_READY_GRACE_MS;
    if (
      !appReady ||
      accountConflictOpen ||
      accountDialogOpen ||
      (!accountReady && !accountReadyGraceElapsed) ||
      document.visibilityState === "hidden"
    ) {
      maybeStartAutomaticTutorial(TUTORIAL_AUTO_RETRY_MS);
      return;
    }
    if (scopeId === "guest" && initialGuestHadLearningData === true) {
      localStorage.setItem(tutorialStorageKey(scopeId), "completed");
      return;
    }
    if (!startTutorial()) {
      maybeStartAutomaticTutorial(TUTORIAL_AUTO_RETRY_MS);
    }
  }, Math.max(0, delay));
}

const acceptedTutorialClicks = new WeakSet();

function handleTutorialInteraction(event) {
  if (!tutorialRuntime?.active) return;
  const target = tutorialTargetForStep();
  if (target && !target.contains(event.target) && !acceptedTutorialClicks.has(event)) return;

  const step = tutorialRuntime.step;
  if (step === "plan" && event.target.closest("#planButton")) {
    window.setTimeout(() => setTutorialStep("plan-form"), 0);
  } else if (step === "plan-form" && event.target.closest("#savePlanButton")) {
    window.setTimeout(() => setTutorialStep("start"), 0);
  } else if (step === "reveal" && event.target.closest("#revealButton")) {
    window.setTimeout(() => setTutorialStep("act-performance"), 0);
  } else if (step === "act-performance" && event.target.closest('[data-key="act:v-1"]')) {
    window.setTimeout(() => setTutorialStep("act-law"), 0);
  } else if (step === "act-law" && event.target.closest('[data-key="act:n-3"]')) {
    window.setTimeout(() => setTutorialStep("reset"), 0);
  } else if (step === "reset" && event.target.closest("#resetButton")) {
    window.setTimeout(() => setTutorialStep("reset-marking"), 0);
  } else if (step === "reset-marking" && event.target.closest("#resetMarkingButton")) {
    window.setTimeout(() => setTutorialStep("complete"), 0);
  } else if (step === "complete" && event.target.closest("#nextButton")) {
    window.setTimeout(() => beginTutorialWait("examples-wait", "act-next"), 0);
  } else if (step === "act-next" && event.target.closest("#nextButton")) {
    window.setTimeout(() => {
      tutorialSessionForWord("her", { revealed: true });
      beginTutorialWait(
        "her-wait",
        "her-senses",
        TUTORIAL_HER_PROMPT_DELAY_MS,
      );
    }, 0);
  } else if (step === "her-senses" && event.target.closest(".sense-item")) {
    // Sense confirmation commits after the immediate press frame so slower
    // browsers can paint feedback before the FLIP layout work. Recheck after
    // that commit window instead of reading the pre-animation state here.
    window.setTimeout(() => {
      if (
        tutorialRuntime?.step === "her-senses" &&
        tutorialCurrentWordIsFullyMarked()
      ) {
        setTutorialStep("her-next");
      }
    }, 180);
  } else if (step === "her-next" && event.target.closest("#nextButton")) {
    window.setTimeout(() => {
      tutorialSessionForWord("abandon");
      setTutorialStep("abandon-return");
    }, 0);
  } else if (step === "abandon-return" && event.target.closest("#exitStudyButton")) {
    window.setTimeout(() => setTutorialStep("return-home"), 0);
  } else if (step === "return-home" && event.target.closest("#returnHomeButton")) {
    window.setTimeout(() => setTutorialStep("more"), 0);
  } else if (step === "more" && event.target.closest("#globalSettingsNavButton")) {
    if (tutorialScopeId() === "guest") {
      window.setTimeout(() => setTutorialStep("account"), 0);
    } else {
      window.setTimeout(showTutorialCompletedDialog, 0);
    }
  } else if (step === "account" && event.target.closest("#accountButton")) {
    window.setTimeout(showTutorialCompletedDialog, 0);
  }
}

function blockNonTutorialClick(event) {
  if (!tutorialRuntime?.active || tutorialDoneDialog.hidden === false) return;
  const target = tutorialTargetForStep();
  if (
    tutorialRuntime.step === "plan-form" &&
    event.target.closest("#cancelPlanButton, #resetAllPlanButton")
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (
    target?.contains(event.target) &&
    !TUTORIAL_NON_INTERACTIVE_STEPS.has(tutorialRuntime.step)
  ) {
    // A synchronous sense redraw can detach the accepted target before bubbling.
    acceptedTutorialClicks.add(event);
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
}

async function initializeApp() {
  setBootProgress(0, "正在准备本机学习空间");
  wordText.textContent = "加载中";
  cardMode.textContent = "词汇学习";
  startStudyButton.disabled = true;
  planButton.disabled = true;
  wordListButton.disabled = true;
  globalSettingsNavButton.disabled = true;
  dataButton.disabled = true;
  nextButton.disabled = true;
  audioButton.hidden = true;
  document.documentElement.dataset.vocabularyReady = "loading";
  setVocabularyStatus("正在加载词库索引和本地学习记录…");

  try {
    setBootProgress(0, "正在连接词库索引");
    vocabularyIndex = await loadVocabularyIndex();
    vocabularyCatalogAuthoritative = true;
    installVocabularyData(vocabularyIndex);
  } catch (indexError) {
    console.warn(indexError);
    try {
      const legacyIndex = { bundleVersion: "legacy" };
      const data = await loadVocabularyBundle(legacyIndex, {
        forceNetwork: true,
      });
      vocabularyIndex = {
        ...data,
        bundleVersion: "legacy",
      };
      vocabularyCatalogAuthoritative = true;
      installVocabularyData(data, { details: true });
      vocabularyDetailsReady = true;
      document.documentElement.dataset.vocabularyReady = "true";
    } catch (bundleError) {
      console.warn(bundleError);
      vocabularyCatalogAuthoritative = false;
      vocabularyIndex = {
        defaultBookId: DEFAULT_BOOK_ID,
        bundleVersion: "fallback",
        books: [
          {
            id: DEFAULT_BOOK_ID,
            name: "考研词汇",
            displayName: "考研词汇",
            entries: FALLBACK_WORDS.map((word) => ({
              wordId: word.id,
              senseIds: word.senses.map((sense) => sense.id),
            })),
          },
        ],
        words: FALLBACK_WORDS,
      };
      installVocabularyData(vocabularyIndex, { details: true });
      vocabularyDetailsReady = true;
      vocabularyDetailsError = bundleError;
      document.documentElement.dataset.vocabularyReady = "fallback";
      setVocabularyStatus(
        "完整词库暂时无法连接，当前仅显示离线应急内容。刷新页面即可重试，已有学习记录不会被改动。",
        { error: true },
      );
    }
  }

  renderBookOptions();
  // The network bar already reached 100% when the index body finished. Keep
  // that truthful value while the synchronous local record is normalized;
  // resetting to 0 here would make initialization look like a fake second
  // download.
  setBootProgress(100, "词库索引已载入，正在读取本机学习记录");
  rootState = loadState();
  initialGuestHadLearningData = stateHasLearningData(rootState);
  activateBookScope(rootState.activeBookId);
  applyWordDeepLink();
  if (document.documentElement.dataset.vocabularyReady !== "fallback") {
    saveState();
  }
  render();
  setBootProgress(100, "本机记录已就绪，正在确认账户");
  scheduleMidnightRefresh();
  const persistenceSafe = isPersistenceSafe();
  planButton.disabled = !persistenceSafe;
  wordListButton.disabled = !persistenceSafe;
  if (!persistenceSafe) {
    startStudyButton.disabled = true;
    advanceStudyButton.disabled = true;
  }
  applyAccountBootstrapGate();
  document.documentElement.dataset.appReady = "true";
  window.dispatchEvent(new CustomEvent("sensevocab:app-ready"));
  maybeStartAutomaticTutorial();
  if (!vocabularyDetailsReady) {
    scheduleVocabularyDetailsPreload();
  } else if (!vocabularyDetailsError) {
    setVocabularyStatus();
  }
}

planButton.addEventListener("click", openPlanDialog);
advanceStudyButton.addEventListener("click", startAdvanceStudy);
wordListButton.addEventListener("click", openWordList);
startStudyButton.addEventListener("click", startStudy);
dashboardButton?.addEventListener("click", openDashboard);
dashboardBackButton?.addEventListener("click", closeDashboard);
globalDashboardNavButton?.addEventListener("click", openDashboard);
globalHomeNavButton?.addEventListener("click", () => openMainView("home"));
globalSettingsNavButton?.addEventListener("click", openSettings);
dataButton?.addEventListener("click", openDataPage);
dataBackButton?.addEventListener("click", closeDataPage);
window.addEventListener("sensevocab:open-data", (event) => openDataPage(event));
homeFeedbackButton.addEventListener("click", () => {
  window.dispatchEvent(new CustomEvent("sensevocab:open-feedback"));
});
replayTutorialButton.addEventListener("click", () => {
  openFloatingDialog(tutorialReplayConfirmDialog, replayTutorialButton);
});
confirmReplayTutorialButton.addEventListener("click", () => {
  closeFloatingDialog(tutorialReplayConfirmDialog, { force: true });
  window.requestAnimationFrame(() => startTutorial({ replay: true }));
});
cancelReplayTutorialButton.addEventListener("click", () => {
  closeFloatingDialog(tutorialReplayConfirmDialog);
});
tutorialReplayConfirmDialog.addEventListener("click", (event) => {
  if (event.target === tutorialReplayConfirmDialog) {
    closeFloatingDialog(tutorialReplayConfirmDialog);
  }
});
savePlanButton.addEventListener("click", savePlan);
cancelPlanButton.addEventListener("click", closePlanDialog);
resetAllPlanButton.addEventListener("click", showPlanResetConfirmation);
confirmResetAllPlanButton.addEventListener("click", resetAllProgress);
backPlanResetButton.addEventListener("click", hidePlanResetConfirmation);
dailyTargetInput.addEventListener("input", updatePlanPreview);
bookSelect.addEventListener("change", () => {
  const selectedState = rootState.bookStates[bookSelect.value] ?? createState();
  dailyTargetInput.value = selectedState.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET;
  updatePlanPreview();
});
planDialog.addEventListener("click", (event) => {
  if (event.target === planDialog) closePlanDialog();
});

revealButton.addEventListener("click", handleWordSurfaceClick);
audioButton.addEventListener("click", speakCurrentWord);
browsePreviousWordButton.addEventListener("click", () => navigateWordCard(-1));
browseNextWordButton.addEventListener("click", () => navigateWordCard(1));
studyFeedbackButton.addEventListener("click", () => {
  const context = currentFeedbackContext();
  if (!context) return;
  window.dispatchEvent(new CustomEvent("sensevocab:open-feedback", {
    detail: { context },
  }));
});
exitStudyButton.addEventListener("click", (event) => {
  const confusionRootWordId =
    state.wordBrowse?.confusionEntry?.rootWordId ??
    state.wordBrowse?.confusionReturnRootId;
  if (confusionRootWordId) {
    openConfusionGlobe(confusionRootWordId, {
      focusWordId: state.wordBrowse.wordId,
    });
  } else if (state.wordBrowse) {
    closeWordCard(event);
  } else {
    openReturnDialog();
  }
});

confusionBackButton.addEventListener("click", () => {
  closeConfusionGlobe({ back: true });
});
confusionSearchInput.addEventListener("input", renderConfusionSearchResults);
confusionSearchResults.addEventListener("click", (event) => {
  const action = event.target.closest(".confusion-search-action");
  if (!action || !confusionRuntime) return;
  setConfusionRelation(
    confusionRuntime.rootWordId,
    action.dataset.wordId,
    action.dataset.action === "add",
  );
});

wordListBackButton.addEventListener("click", closeWordList);
dashboardBookSelect?.addEventListener("change", () => {
  dashboardBookId = dashboardBookSelect.value || activeBookId();
  renderDashboard();
});
dashboardUnitSelect?.addEventListener("change", () => {
  dashboardUnit = dashboardUnitSelect.value === "word" ? "word" : "sense";
  renderDashboard();
});
dashboardRangeSelect?.addEventListener("change", () => {
  dashboardRangeDays = Math.max(1, Number.parseInt(dashboardRangeSelect.value, 10) || 21);
  renderDashboard();
});
dashboardStartDate?.addEventListener("change", renderDashboard);
dashboardEndDate?.addEventListener("change", renderDashboard);
wordSearchInput.addEventListener("input", () => {
  wordListQuery = wordSearchInput.value;
  renderWordList();
});
wordListFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".word-list-filter");
  if (!button || !wordListFilters.contains(button)) return;
  wordListFilter = button.dataset.status;
  renderWordList();
});
wordSortSelect.addEventListener("change", () => {
  state.wordListSort = wordSortSelect.value;
  saveState();
  renderWordList();
});
wordListLoadMoreButton.addEventListener("click", loadMoreWordList);
wordList.addEventListener("scroll", () => {
  if (wordListMore.hidden || wordListRenderFrame !== null) return;
  const distanceToBottom = wordList.scrollHeight - wordList.scrollTop - wordList.clientHeight;
  if (distanceToBottom < 220) loadMoreWordList();
}, { passive: true });
wordList.addEventListener("click", (event) => {
  const item = event.target.closest(".word-list-item");
  if (!item) return;
  item.classList.add("is-loading");
  item.setAttribute("aria-busy", "true");
  openWordCard(item.dataset.wordId, {
    source: "word-list",
    event,
    origin: getUiTransitionOrigin(item),
  });
  item.classList.remove("is-loading");
  item.removeAttribute("aria-busy");
});

senseList.addEventListener("click", (event) => {
  const item = event.target.closest(".sense-item");
  if (!item) return;
  const session = ensureTodaySession();
  if (
    session.cardPhase === "examples" &&
    item.classList.contains("is-collapsible")
  ) {
    toggleGreenSenseDetails(item.dataset.key);
    return;
  }
  if (session.cardPhase !== "select") return;

  animateSenseMastered(item);
});

nextButton.addEventListener("click", handleProgressButton);
resetButton.addEventListener("click", openResetDialog);
resetMarkingButton.addEventListener("click", resetCurrentMarking);
relearnWordButton.addEventListener("click", showRelearnConfirmation);
confirmResetButton.addEventListener("click", confirmPendingReset);
backResetButton.addEventListener("click", showResetOptions);
cancelResetButton.addEventListener("click", closeResetDialog);
resetDialog.addEventListener("click", (event) => {
  if (event.target === resetDialog) closeResetDialog();
});

previousWordButton.addEventListener("click", showPreviousWord);
nextHistoryWordButton.addEventListener("click", showNextHistoryWord);
returnHomeButton.addEventListener("click", handleReturnHome);
cancelReturnButton.addEventListener("click", closeReturnDialog);
returnDialog.addEventListener("click", (event) => {
  if (event.target === returnDialog) closeReturnDialog();
});

document.addEventListener("keydown", (event) => {
  if (tutorialRuntime?.active) return;
  if (event.key === "Escape") {
    if (!resetDialog.hidden) closeResetDialog();
    if (!planDialog.hidden) closePlanDialog();
    if (!returnDialog.hidden) closeReturnDialog();
  }
});
document.addEventListener("click", blockNonTutorialClick, true);
document.addEventListener("click", handleTutorialInteraction);
window.addEventListener("scroll", positionTutorialOverlay, true);
window.addEventListener("resize", () => {
  updateAppViewportHeight();
  scheduleWordFit();
  positionTutorialOverlay();
  positionHeatmapAtLatest();
});
window.visualViewport?.addEventListener("resize", () => {
  updateAppViewportHeight();
  scheduleWordFit();
  positionTutorialOverlay({ force: true });
});
window.visualViewport?.addEventListener("scroll", () => {
  positionTutorialOverlay({ force: true });
});
window.addEventListener("orientationchange", updateAppViewportHeight);
finishTutorialButton.addEventListener("click", finishTutorial);
window.addEventListener("sensevocab:app-ready", maybeStartAutomaticTutorial);
window.addEventListener("sensevocab:account-ready", () => {
  render();
  maybeStartAutomaticTutorial();
});
window.addEventListener("sensevocab:account-scope", maybeStartAutomaticTutorial);
window.addEventListener("pageshow", maybeStartAutomaticTutorial);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    maybeStartAutomaticTutorial();
  }
});
window.addEventListener("sensevocab:membership", (event) => {
  membershipAccess = {
    loggedIn: Boolean(event.detail?.loggedIn),
    active: event.detail?.active !== false,
    pending: Boolean(event.detail?.pending),
    expiresAt: event.detail?.expiresAt ?? null,
  };
  if (state) render();
});

initializeApp();
