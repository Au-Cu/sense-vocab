const DEFAULT_DAILY_TARGET = 20;
const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const ACCOUNT_STORAGE_PREFIX = `${STORAGE_KEY}:account:`;
const LOCAL_STORAGE_COMPRESSION_PREFIX = "svlz1:";
const LZ_MIN_MATCH = 4;
const LZ_MAX_MATCH = 65538;
const LZ_MAX_DISTANCE = 65535;
const LZ_MAX_CANDIDATES = 16;
const DATA_VERSION = 10;
const DASHBOARD_DATA_VERSION = 1;
const ROOT_STATE_VERSION = 2;
const DEFAULT_BOOK_ID = "kaoyan";
const VOCABULARY_INDEX_URL = "./data/vocabulary-index.json";
const VOCABULARY_BUNDLE_URL = "./data/vocabulary-bundle.json";
const VOCABULARY_CACHE_PREFIX = "sense-vocab-vocabulary-";
const DAY_MS = 24 * 60 * 60 * 1000;
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
const mainAppNav = document.querySelector("#mainAppNav");
const modalLayer = document.querySelector("#modalLayer");
const appShellElement = document.querySelector("#appShell");
const globalHomeNavButton = document.querySelector("#globalHomeNavButton");
const globalDashboardNavButton = document.querySelector("#globalDashboardNavButton");
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
const moreButton = document.querySelector("#moreButton");
const moreDialog = document.querySelector("#moreDialog");
const closeMoreButton = document.querySelector("#closeMoreButton");
const dashboardButton = document.querySelector("#dashboardButton");
const homeFeedbackButton = document.querySelector("#homeFeedbackButton");

if (dashboardHost && dashboardRoot && dashboardRoot.parentElement !== dashboardHost) {
  dashboardHost.append(dashboardRoot);
}

const wordListPanel = document.querySelector("#wordListPanel");
const wordSortSelect = document.querySelector("#wordSortSelect");
const wordSearchInput = document.querySelector("#wordSearchInput");
const wordListFilters = document.querySelector("#wordListFilters");
const wordListEmpty = document.querySelector("#wordListEmpty");
const wordList = document.querySelector("#wordList");
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

let words = [];
let wordById = new Map();
let state = null;
let rootState = null;
let vocabularyBundle = null;
let vocabularyIndex = null;
let vocabularySearchRelations = new Map();
let vocabularyDetailsReady = false;
let vocabularyDetailsPromise = null;
let vocabularyDetailsError = null;
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
let wordListIndexCache = null;
let wordListIndexRevision = 0;
let heatmapPositionedBookId = null;
let dashboardBookId = null;
let dashboardUnit = "sense";
let dashboardRangeDays = 21;
let initialGuestHadLearningData = null;
let confusionRuntime = null;
let confusionGlobe = null;
let confusionGlobeSignature = null;
let confusionTransitioning = false;
let confusionGlobeLoader = null;
let activeUiTransition = null;
let commitActiveUiTransition = null;
let cleanupActiveUiTransition = null;
let deferredUiStateSavePending = false;
let deferredUiStateSaveFrame = null;
let deferredUiStateSaveTimer = null;
let studyHierarchyOrigin = null;
let wordListHierarchyOrigin = null;
let membershipAccess = {
  loggedIn: false,
  active: true,
  pending: false,
  expiresAt: null,
};

function validateVocabularyData(data, label) {
  if (!Array.isArray(data?.words) || !Array.isArray(data?.books)) {
    throw new Error(`${label} has an invalid schema.`);
  }
  return data;
}

async function loadVocabularyIndex() {
  const response = await fetch(VOCABULARY_INDEX_URL, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Vocabulary index failed to load: ${response.status}`);
  }
  const data = validateVocabularyData(
    await response.json(),
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

  const response = await fetch(request, {
    cache: forceNetwork ? "reload" : "default",
  });
  if (!response.ok) {
    throw new Error(`Vocabulary bundle failed to load: ${response.status}`);
  }
  const cacheCopy = response.clone();
  const data = validateVocabularyData(
    await response.json(),
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
      if (state) render();
      window.dispatchEvent(
        new CustomEvent("sensevocab:vocabulary-ready"),
      );
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

async function ensureVocabularyDetailsReady(intent = "study") {
  if (vocabularyDetailsReady) return true;

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
  const { word, sense } = getSense(key);
  return Boolean(word && sense);
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
  const normalized = normalizeRootState(cloneSerializable(candidate));
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
    migrateStoredStateToCompactFormat(key, normalizeRootState(parsed), raw);
  });
}

function loadState(storageKey = activeStorageKey) {
  const { raw, parsed } = readStoredState(storageKey);
  if (!parsed) return createRootState();
  const normalized = normalizeRootState(parsed);
  migrateStoredStateToCompactFormat(storageKey, normalized, raw);
  return normalized;
}

function saveState(options = {}) {
  if (document.body.dataset.tutorialActive === "true") return;
  if (!isPersistenceSafe()) return;
  wordListIndexRevision += 1;
  wordListIndexCache = null;
  const notify = options.notify !== false;
  let persisted = true;
  let attemptedCharacters = 0;
  let previousCharacters = 0;
  try {
    rootState.bookStates[activeBookId()] = state;
    const nextRootState = cloneSerializable(rootState);
    if (state.wordBrowse && requestedWordId()) {
      nextRootState.bookStates[activeBookId()] = {
        ...nextRootState.bookStates[activeBookId()],
        view: wordDeepLinkReturnView ?? "home",
        wordBrowse: null,
      };
    }
    const previous = readStoredState(activeStorageKey);
    const previousStoredState = previous.parsed;
    previousCharacters = previous.raw?.length ?? 0;
    if (window.SenseVocabSync) {
      if (options.stampSync === false) {
        window.SenseVocabSync.ensureMetadata(nextRootState);
      } else {
        window.SenseVocabSync.stampChanges(
          nextRootState,
          previousStoredState,
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
    writeStoredState(activeStorageKey, serialized);
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
      detail: { storageKey: activeStorageKey, persisted },
    }));
  }
  return persisted;
}

function runDeferredUiStateSave() {
  deferredUiStateSaveFrame = null;
  deferredUiStateSaveTimer = null;
  if (!deferredUiStateSavePending) return;
  deferredUiStateSavePending = false;
  saveState();
}

function flushDeferredUiStateSave() {
  if (deferredUiStateSaveFrame !== null) {
    window.cancelAnimationFrame(deferredUiStateSaveFrame);
    deferredUiStateSaveFrame = null;
  }
  if (deferredUiStateSaveTimer !== null) {
    window.clearTimeout(deferredUiStateSaveTimer);
    deferredUiStateSaveTimer = null;
  }
  runDeferredUiStateSave();
}

function saveStateAfterInteractionFrame() {
  if (document.visibilityState === "hidden") return saveState();
  deferredUiStateSavePending = true;
  if (deferredUiStateSaveFrame !== null || deferredUiStateSaveTimer !== null) return true;
  deferredUiStateSaveFrame = window.requestAnimationFrame(() => {
    deferredUiStateSaveFrame = null;
    deferredUiStateSaveTimer = window.setTimeout(runDeferredUiStateSave, 0);
  });
  return true;
}

window.addEventListener("pagehide", flushDeferredUiStateSave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushDeferredUiStateSave();
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
    state.activityLog[date].target = state.plan?.dailyTarget ?? 0;
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

function migrateLegacyActivity() {
  Object.entries(state.activityLog).forEach(([date, entry]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      delete state.activityLog[date];
      return;
    }
    state.activityLog[date] = normalizeActivityEntry(entry);
  });

  if (
    state.dataVersion >= DATA_VERSION &&
    Object.keys(state.activityLog).length > 0
  ) {
    state.dataVersion = DATA_VERSION;
    return;
  }

  const target = state.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET;
  const startedOn = state.plan?.startedOn ?? currentDate();
  const inferredDateByWord = new Map();

  state.introducedWords.forEach((wordId, index) => {
    const word = wordById.get(wordId);
    if (!word) return;
    const seenDates = allSenseKeysForWord(word)
      .map((key) => state.progress[key]?.firstSeenActual ?? state.progress[key]?.firstSeen)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))
      .sort();
    const distributed = addDays(startedOn, Math.floor(index / Math.max(1, target)));
    const inferredDate = seenDates[0] ?? (
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
      for (let offset = 0; offset < bestLength; offset += 1) {
        addCandidate(cursor + offset);
      }
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
  // Keep new writes as ordinary JSON so existing integrations and local
  // recovery tools can continue to inspect the cache directly. The reader
  // still accepts the legacy svlz1 representation for backward compatibility.
  return JSON.stringify(encodeLocalStorageState(candidate));
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
  wordDeepLinkReturnView = state.view;
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
    (Array.isArray(candidate.studyWindows) && candidate.studyWindows.length),
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

function applyStateToStorage(storageKey, nextState = null) {
  if (document.body.dataset.tutorialActive === "true") {
    window.SenseVocabTutorial?.recordReality?.(storageKey, nextState);
    return;
  }
  activeStorageKey = storageKey;
  rootState = nextState
    ? normalizeRootState(cloneSerializable(nextState))
    : loadState(storageKey);
  activateBookScope(rootState.activeBookId);
  applyWordDeepLink();
  const persisted = saveState({ notify: false, stampSync: !nextState });
  render();
  window.dispatchEvent(new CustomEvent("sensevocab:scope-changed", {
    detail: { storageKey: activeStorageKey },
  }));
  return persisted;
}

function cloudStateSnapshot() {
  if (document.body.dataset.tutorialActive === "true") {
    return window.SenseVocabTutorial?.realState?.() ?? cloneSerializable(rootState);
  }
  const snapshot = cloneSerializable(rootState);
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
    view: ["home", "study", "word-list", "dashboard"].includes(state.view)
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
  recoveryStateSignature,
  mergeStates: (localState, remoteState) => {
    if (!window.SenseVocabSync) return cloneSerializable(remoteState);
    return window.SenseVocabSync.mergeStates(localState, remoteState);
  },
  prepareIndependentMergeState: (candidate, baseline = null) => {
    if (!window.SenseVocabSync) return cloneSerializable(candidate);
    return window.SenseVocabSync.prepareIndependentMergeState(candidate, baseline);
  },
  hasIndependentChanges: (candidate, baseline) => {
    if (!window.SenseVocabSync) return false;
    return window.SenseVocabSync.hasIndependentChanges(candidate, baseline);
  },
  getCurrentWordContext: () => currentFeedbackContext(),
  activateGuest: () => applyStateToStorage(STORAGE_KEY),
  activateAccount: (userId, nextState = null) => {
    return applyStateToStorage(accountStorageKey(userId), nextState);
  },
  isActiveStatePersisted: () => {
    const { parsed } = readStoredState(activeStorageKey);
    if (!parsed) return false;
    return stableStateStringify(compactLocalState(parsed)) ===
      stableStateStringify(compactLocalState(rootState));
  },
  replaceActiveState: (nextState, options = {}) => {
    if (document.body.dataset.tutorialActive === "true") {
      window.SenseVocabTutorial?.recordRealityState?.(nextState);
      return;
    }
    const navigation = options.preserveNavigation
      ? captureActiveNavigation()
      : null;
    rootState = normalizeRootState(cloneSerializable(nextState));
    if (navigation && bookById.has(navigation.bookId)) {
      rootState.activeBookId = navigation.bookId;
    }
    activateBookScope(rootState.activeBookId);
    restoreActiveNavigation(navigation);
    applyWordDeepLink();
    const persisted = saveState({
      notify: options.notify !== false,
      stampSync: options.stampSync !== false,
    });
    render();
    return persisted;
  },
  removeAccountCache: (userId) => {
    localStorage.removeItem(accountStorageKey(userId));
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
  const keepOpenCrossDaySession = state.view === "study" &&
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
    const dueReinforcementCount = Object.entries(state.progress).filter(
      ([key, progress]) => {
        return isKnownSenseKey(key) &&
          progress.status === SENSE_STATUS.REINFORCE &&
          !alreadyReinforced.has(key) &&
          (
            !Number.isFinite(progress.dueLearningDay) ||
            progress.dueLearningDay <= activeLearningDay()
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
    if (lightweightMotion && transition?.cancel) transition.cancel();
    delete root.dataset.uiTransition;
    delete root.dataset.uiTransitionScope;
    delete root.dataset.uiTransitionMode;
    clearUiTransitionOrigin(root);
    after?.();
  };

  // Card changes use the live viewport plus one outgoing snapshot below. Native
  // nested view-transition snapshots can briefly expose the freshly rendered
  // card on Safari and Chromium when a reveal transition has just finished.
  if (!lightweightMotion && scope !== "card" && !hadActiveTransition && typeof document.startViewTransition === "function") {
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
  const outgoingSurface = !lightweightMotion && ["hierarchy", "page", "card"].includes(scope)
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
  try {
    animation = target?.animate?.(
      lightweightMotion
        ? lightweightUiTransitionFrames(kind, scope)
        : uiTransitionFrames(kind, scope, "incoming"), {
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
  const mainNavigationVisible = state.view === "home" || state.view === "dashboard";
  mainAppNav.hidden = !mainNavigationVisible;
globalHomeNavButton.classList.toggle("is-active", state.view === "home");
globalDashboardNavButton.classList.toggle("is-active", state.view === "dashboard");
if (state.view === "home") {
  globalHomeNavButton.setAttribute("aria-current", "page");
} else {
  globalHomeNavButton.removeAttribute("aria-current");
}
if (state.view === "dashboard") {
  globalDashboardNavButton.setAttribute("aria-current", "page");
} else {
  globalDashboardNavButton.removeAttribute("aria-current");
}
appShell.classList.toggle("is-study-view", state.view === "study");
  confusionPanel.hidden = state.view !== "confusion";
  renderHome();
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
  if (!bookState || !isKnownSenseKey(key) || from === to) return false;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(options.date ?? "")
    ? options.date
    : currentActivityDate();
  const observedAt = options.observedAt ?? new Date().toISOString();
  const id = `${date}|${key}|${from}|${to}|${observedAt}`;
  bookState.dashboardEvents = normalizeDashboardMap(bookState.dashboardEvents);
  bookState.dashboardEvents[id] = {
    id,
    date,
    observedAt,
    senseId: key,
    from,
    to,
    source: options.source ?? null,
    learningDay: Number.isFinite(options.learningDay) ? options.learningDay : null,
  };
  return true;
}

function dashboardSnapshotKey(bookId, date) {
  return `${bookId}:${date}`;
}

function dashboardRecordSnapshot(bookId = activeBookId(), date = currentDate()) {
  const bookState = dashboardBookState(bookId);
  const bookWords = dashboardWords(bookId);
  if (!bookState || !bookWords.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
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
  dashboardSenseKeys(bookWords).forEach((key) => {
    const progress = bookState.progress?.[key];
    if (progress?.status && progress.status !== SENSE_STATUS.NEW) {
      statuses[key] = dashboardStatusForKey(bookState, key);
    }
    if (progress?.statusEnteredAt) enteredAt[key] = progress.statusEnteredAt;
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
  bookState.dashboardSnapshots = normalizeDashboardMap(bookState.dashboardSnapshots);
  bookState.dashboardSnapshots[id] = snapshot;
  const dates = Object.values(bookState.dashboardSnapshots)
    .filter((entry) => entry?.bookId === bookId && /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? ""))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  dates.slice(0, Math.max(0, dates.length - 180)).forEach((entry) => {
    delete bookState.dashboardSnapshots[entry.id];
  });
  return true;
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
  requestAnimationFrame(() => {
    plotScroll.scrollLeft = plotScroll.scrollWidth;
  });
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
  dashboardEnhanceChart(container, { groups, plotTop: top, plotBottom: top + plotHeight });
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
  series.forEach((item) => {
    let segment = [];
    const segments = [];
    item.values.forEach((value, index) => {
      if (Number.isFinite(value)) {
        segment.push(`${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`);
      } else if (segment.length) {
        segments.push(segment);
        segment = [];
      }
    });
    if (segment.length) segments.push(segment);
    segments.filter((points) => points.length > 1).forEach((points) => {
      markup += `<polyline class="dashboard-line dashboard-${item.key}" points="${points.join(" ")}" fill="none" />`;
    });
    item.values.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      const title = item.tooltip?.[index] ?? `${dates[index]} ${dashboardDisplayLabel(item.key, item.label)} ${value}`;
      markup += `<circle class="dashboard-point dashboard-${item.key}" cx="${xFor(index)}" cy="${yFor(value)}" r="3" data-dashboard-index="${index}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(title)}"></circle>`;
    });
  });
  dates.forEach((date, index) => {
    if (index % (dates.length > 42 ? 7 : dates.length > 21 ? 3 : 1) !== 0 && index !== dates.length - 1) return;
    markup += `<text class="dashboard-axis-label" x="${xFor(index)}" y="${chartHeight - 10}" text-anchor="middle">${dashboardEscape(dashboardDateLabel(date))}</text>`;
  });
  markup += "</svg>";
  dashboardSetMarkup(container, markup);
  dashboardEnhanceChart(container, { groups, plotTop: top, plotBottom: top + plotHeight });
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
    const wordTarget = Math.max(0, Number(activity.target ?? bookState.plan?.dailyTarget ?? 0));
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
  const keys = dashboardSenseKeys(bookWords);
  return [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].map((status) => ({
    key: status,
    label: status === SENSE_STATUS.REINFORCE ? "待强化" : "待复习",
    values: dates.map((date) => {
      const snapshot = snapshots[dashboardSnapshotKey(bookIdForState(bookState), date)];
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
  const definitions = [
    ["new-mastered", "新学 → 掌握", SENSE_STATUS.NEW, SENSE_STATUS.MASTERED],
    ["reinforce-review", "强化 → 复习", SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW],
    ["review-mastered", "复习 → 掌握", SENSE_STATUS.REVIEW, SENSE_STATUS.MASTERED],
  ];
  return definitions.map(([key, label, from, to]) => {
    const tooltip = [];
    const values = dates.map((date, index) => {
      const source = new Set(events.filter((event) => event.date === date && event.from === from && event.to === to).map((event) => event.senseId));
      const denominator = new Set(events.filter((event) => event.date === date && event.from === from).map((event) => event.senseId));
      if (denominator.size === 0) {
        tooltip[index] = `${date} ${label}：无可靠分母`;
        return null;
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
  return [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].map((status) => {
    const tooltip = [];
    const values = dates.map((date, index) => {
      const snapshot = snapshots[dashboardSnapshotKey(bookId, date)];
      if (!snapshot) {
        tooltip[index] = `${date}：暂无数据`;
        return null;
      }
      const keys = dashboardSenseKeys(bookWords).filter((key) => snapshot.statuses?.[key] === status);
      const durations = keys.map((key) => {
        const entered = snapshot.enteredAt?.[key];
        const time = entered ? Date.parse(entered) : NaN;
        const end = Date.parse(snapshot.observedAt);
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
  const startSnapshot = snapshots[dashboardSnapshotKey(bookId, start)];
  const endSnapshot = snapshots[dashboardSnapshotKey(bookId, end)];
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
    min: 0,
    max: 100,
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
  [studyPanel, wordListPanel, dashboardPanel, confusionPanel].forEach((panel) => {
    panel.inert = pending;
  });
  if (!pending) {
    const persistenceSafe = isPersistenceSafe();
    planButton.disabled = !persistenceSafe;
    wordListButton.disabled = !persistenceSafe;
    globalDashboardNavButton.disabled = !persistenceSafe;
    return;
  }
  planButton.disabled = true;
  wordListButton.disabled = true;
  globalDashboardNavButton.disabled = true;
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
    saveState({ notify: false });
  }
  renderDashboard();
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

  const target = activity?.target || state.plan?.dailyTarget || 1;
  if (!activity?.baseCompleted) {
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

function wordLearningInfo(word) {
  const introduced = state.introducedWords.includes(word.id);
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
  const activityDates = Object.entries(state.activityLog)
    .filter(([, activity]) => {
      return activity?.newWords?.includes(word.id) ||
        activity?.reviewWords?.includes(word.id);
    })
    .map(([date]) => date)
    .filter(isDate);
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
  const introducedOrder = state.introducedWords.indexOf(word.id);

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

function wordStatusBadges(word) {
  if (!state.introducedWords.includes(word.id)) {
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

  const items = words.map((word) => ({
    word,
    info: wordLearningInfo(word),
    badges: wordStatusBadges(word),
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

function renderWordList() {
  if (wordListBookName) wordListBookName.textContent = bookDisplayName();
  wordSortSelect.value = state.wordListSort;
  wordSearchInput.value = wordListQuery;
  [...wordListFilters.querySelectorAll(".word-list-filter")].forEach((button) => {
    const active = button.dataset.status === wordListFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const fragment = document.createDocumentFragment();
  const items = sortedWordsForList();
  wordListEmpty.hidden = items.length > 0;
  items.forEach(({ word, info }) => {
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

    wordStatusBadges(word).forEach(({ label, type }) => {
      const status = document.createElement("span");
      status.className = `word-list-badge is-${type}`;
      status.textContent = label;
      meta.append(status);
    });

    button.append(name, meta);
    fragment.append(button);
  });
  wordList.replaceChildren(fragment);
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
  if (state.view === "study" && !vocabularyDetailsReady) {
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
    senseProgressBar.firstElementChild.style.width = "0%";
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
  senseProgressBar.firstElementChild.style.width = senseProgress.total > 0
    ? `${Math.round(senseProgress.completed / senseProgress.total * 100)}%`
    : "0%";

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
  const tutorialStart = window.SenseVocabTutorial?.isActive() &&
    window.SenseVocabTutorial.getStep() === "start";
  if (!tutorialStart && (!membershipAllowsStudy() || !hasPlan())) return;
  if (!await ensureVocabularyDetailsReady("study")) return;
  if (tutorialStart) {
    window.SenseVocabTutorial.beginStudy();
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
  }, { scope: "hierarchy", origin: transitionOrigin, afterStart: saveState });
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
  }, { scope: "hierarchy", origin: transitionOrigin, afterStart: saveState });
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
  dialog.classList.remove("is-modal-closing", "is-modal-entering", "is-modal-open");
  setFloatingDialogOrigin(dialog, originTarget);
  if (prefersReducedMotion()) {
    dialog.classList.add("is-modal-open");
    return;
  }
  void dialog.offsetWidth;
  dialog.classList.add("is-modal-entering");
  const done = () => {
    if (floatingDialogTokens.get(dialog) !== token || dialog.hidden) return;
    dialog.classList.remove("is-modal-entering");
    dialog.classList.add("is-modal-open");
    positionTutorialOverlay({ force: true });
  };
  const animation = [...(dialog.querySelector(".reset-dialog")?.getAnimations?.() ?? [])]
    .find((item) => item.animationName === "modal-drop-expand");
  if (animation) {
    Promise.resolve(animation.finished).then(done, done);
  } else {
    window.setTimeout(done, 470);
  }
}

function closeFloatingDialog(dialog, { force = false } = {}) {
  if (!dialog || dialog.hidden) return;
  const token = (floatingDialogTokens.get(dialog) ?? 0) + 1;
  floatingDialogTokens.set(dialog, token);
  if (force || prefersReducedMotion()) {
    dialog.hidden = true;
    dialog.classList.remove("is-modal-closing", "is-modal-entering", "is-modal-open");
    const surface = dialog.querySelector(".reset-dialog");
    surface?.style.removeProperty("--modal-origin-x");
    surface?.style.removeProperty("--modal-origin-y");
    updateFloatingDialogLayerState();
    return;
  }
  dialog.classList.remove("is-modal-entering", "is-modal-open");
  dialog.classList.add("is-modal-closing");
  const done = () => {
    if (floatingDialogTokens.get(dialog) !== token) return;
    dialog.hidden = true;
    dialog.classList.remove("is-modal-closing", "is-modal-entering", "is-modal-open");
    const surface = dialog.querySelector(".reset-dialog");
    surface?.style.removeProperty("--modal-origin-x");
    surface?.style.removeProperty("--modal-origin-y");
    updateFloatingDialogLayerState();
  };
  const animation = dialog.querySelector(".reset-dialog")?.getAnimations?.()[0];
  if (animation) {
    Promise.resolve(animation.finished).then(done, done);
  } else {
    window.setTimeout(done, 300);
  }
}

window.senseVocabModalMotion = Object.freeze({
  open: openFloatingDialog,
  close: closeFloatingDialog,
});

function openMoreDialog(event) {
  openFloatingDialog(moreDialog, event?.currentTarget);
}

function closeMoreDialog() {
  closeFloatingDialog(moreDialog);
}

function openDashboard(event) {
  if (!state || state.view === "dashboard") return;
  closeMoreDialog();
  commitUiTransition("forward", () => {
    state.view = "dashboard";
    render();
  }, { scope: "page" });
}

function closeDashboard() {
  if (!state || state.view === "home") return;
  commitUiTransition("backward", () => {
    state.view = "home";
    render();
  }, { scope: "page" });
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
  }, { scope: "hierarchy", origin: transitionOrigin });
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
    document.body.dataset.tutorialActive === "true" ||
    state.view !== "study" ||
    (currentWordId !== rootWordId && !returningFromRelatedCard) ||
    !rootWordId ||
    !wordById.has(rootWordId) ||
    !globeReady
  ) return;

  const originWord = currentWord();
  if (!originWord) return;
  confusionTransitioning = true;
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
  await animateCardIntoGlobe(transition, sourceRect, targetRect, {
    fromFontSize: sourceFont,
    toFontSize: targetFont,
    globe: confusionGlobe,
  });
  confusionPanel.classList.remove("is-transitioning");
  confusionGlobe?.setPresentationProgress?.(1);
  if (confusionGlobe?.nextPaint) {
    await confusionGlobe.nextPaint();
  } else {
    await nextAnimationFrame();
  }
  await waitForGlobeCompositorCommit();
  await fadeOutWordGlobeTransition(transition, 220);
  transition.remove();
  studyPanel.classList.remove("is-transitioning");
  confusionTransitioning = false;
  renderConfusionPanel();
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
  if (options.animate !== false) {
    await confusionGlobe?.focusWord(selectedWordId);
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
    await flattenGlobeIntoTransition(transition, sourceRect, {
      fontSize: sourceFont,
      globe: confusionGlobe,
    });
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
  await nextAnimationFrame();
  await nextAnimationFrame();
  const targetRect = revealButton.getBoundingClientRect();
  const targetFont = Number.parseFloat(window.getComputedStyle(wordText).fontSize) || 72;
  if (options.animate === false) {
    transition.remove();
  } else {
    await animateFlatCircleIntoCard(transition, sourceRect, targetRect, {
      fromFontSize: sourceFont,
      toFontSize: targetFont,
    });
  }
  confusionPanel.classList.remove("is-transitioning");
  studyPanel.classList.remove("is-transitioning");
  confusionGlobeStage.style.pointerEvents = "";
  confusionTransitioning = false;
}

async function openWordCard(wordId, options = {}) {
  if (!wordById.has(wordId)) return;
  if (!await ensureVocabularyDetailsReady("word-card")) return;
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
    saveStateAfterInteractionFrame();
  }, { scope: "hierarchy", origin: transitionOrigin });
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
    saveStateAfterInteractionFrame();
  }, { scope: "card" });
}

function closeWordCard(event) {
  const transitionOrigin = studyHierarchyOrigin ?? getUiTransitionOrigin(event?.currentTarget);
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
    saveStateAfterInteractionFrame();
  }, {
    scope: "hierarchy",
    origin: transitionOrigin,
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
    afterStart: saveState,
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
    saveStateAfterInteractionFrame();
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
    saveStateAfterInteractionFrame();
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
    saveStateAfterInteractionFrame();
  }, { scope: "card" });
}

function revealSenses() {
  if (!state || !currentCard()) return;

  const session = ensureTodaySession();
  commitUiTransition("reveal", () => {
    session.revealed = true;
    session.cardPhase = "select";
    render();
    saveStateAfterInteractionFrame();
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

function dashboardKeyForProgress(progress) {
  return Object.entries(state?.progress ?? {}).find(([, value]) => value === progress)?.[0] ?? null;
}

function setProgressMastered(progress, date, learningDay = activeLearningDay(), source = "new") {
  const actualDate = currentActivityDate();
  const previousStatus = progress.status ?? SENSE_STATUS.NEW;
  const enteredAt = new Date().toISOString();
  dashboardRecordTransition(state, dashboardKeyForProgress(progress), previousStatus, SENSE_STATUS.MASTERED, {
    date: actualDate,
    observedAt: enteredAt,
    source,
    learningDay,
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
  dashboardRecordTransition(state, dashboardKeyForProgress(progress), previousStatus, status, {
    date: actualDate,
    observedAt: enteredAt,
    source,
    learningDay: dueLearningDay,
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
    setProgressMastered(progress, date, learningDay, card.type ?? "new");
  } else if (card.type === "reinforcement") {
    setProgressPending(
      progress,
      SENSE_STATUS.REVIEW,
      date,
      addDays(date, 1),
      learningDay + 1,
      "reinforcement",
    );
  } else if (card.type === "review") {
    if (progress.status === SENSE_STATUS.REVIEW) {
      setProgressMastered(progress, date, learningDay);
    } else {
      setProgressPending(
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
  saveState();
  if (!options.skipRender) {
    render();
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
  saveState();
  render();
}

function animateSenseMastered(item) {
  if (item.classList.contains("is-confirming")) return;

  const key = item.dataset.key;
  const previousLayout = new Map(
    [...senseList.querySelectorAll(".sense-item[data-key]")].map((senseItem) => [
      senseItem.dataset.key,
      senseItem.getBoundingClientRect(),
    ]),
  );
  playSenseTapSound();
  senseList.classList.add("is-reordering");
  item.classList.add("is-confirming");
  item.disabled = true;
  markSenseFamiliar(key, { skipSound: true, skipRender: true });
  if (ensureTodaySession().cardPhase === "examples") {
    nextButton.textContent = "下一词";
    nextButton.disabled = true;
    revealButton.classList.add("is-mastered");
  }

  window.setTimeout(() => {
    render();
    animateSenseReorder(previousLayout, key);
  }, 180);
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
          duration: 560,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
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
    saveStateAfterInteractionFrame();
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
  if (!session.revealed || session.cardPhase !== "examples" || !currentCard()) return;

  commitUiTransition("forward", () => {
    const completedCard = currentCard();
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
    if (session.currentIndex >= session.queue.length) {
      finishStudyWindow("completed");
    }

    render();
    if (!currentCard()) triggerStudyCompletionCue();
  }, { scope: "card", afterStart: saveState });
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
    document.body.dataset.tutorialActive === "true" &&
    window.SenseVocabTutorial.getStep() === "plan-form" &&
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

async function initializeApp() {
  wordText.textContent = "加载中";
  cardMode.textContent = "词汇学习";
  startStudyButton.disabled = true;
  planButton.disabled = true;
  wordListButton.disabled = true;
  moreButton.disabled = true;
  nextButton.disabled = true;
  audioButton.hidden = true;
  document.documentElement.dataset.vocabularyReady = "loading";
  setVocabularyStatus("正在加载词库索引和本地学习记录…");

  try {
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
  rootState = loadState();
  compactKnownStateCaches();
  initialGuestHadLearningData = stateHasLearningData(rootState);
  activateBookScope(rootState.activeBookId);
  applyWordDeepLink();
  if (document.documentElement.dataset.vocabularyReady !== "fallback") {
    saveState();
  }
  render();
  scheduleMidnightRefresh();
  const persistenceSafe = isPersistenceSafe();
  planButton.disabled = !persistenceSafe;
  wordListButton.disabled = !persistenceSafe;
  if (!persistenceSafe) {
    startStudyButton.disabled = true;
    advanceStudyButton.disabled = true;
  }
  moreButton.disabled = false;
  applyAccountBootstrapGate();
  document.documentElement.dataset.appReady = "true";
  window.dispatchEvent(new CustomEvent("sensevocab:app-ready"));
  window.SenseVocabTutorial?.maybeAutoStart?.();
  if (!vocabularyDetailsReady) {
    beginVocabularyDetailsLoad();
  } else if (!vocabularyDetailsError) {
    setVocabularyStatus();
  }
}

planButton.addEventListener("click", openPlanDialog);
advanceStudyButton.addEventListener("click", startAdvanceStudy);
wordListButton.addEventListener("click", openWordList);
startStudyButton.addEventListener("click", startStudy);
moreButton.addEventListener("click", openMoreDialog);
closeMoreButton.addEventListener("click", closeMoreDialog);
dashboardButton?.addEventListener("click", openDashboard);
dashboardBackButton?.addEventListener("click", closeDashboard);
globalDashboardNavButton?.addEventListener("click", openDashboard);
globalHomeNavButton?.addEventListener("click", (event) => {
  if (state?.view === "dashboard") closeDashboard(event);
});
moreDialog.addEventListener("click", (event) => {
  if (event.target === moreDialog) closeMoreDialog();
});
document.querySelector("#accountButton").addEventListener("click", closeMoreDialog);
homeFeedbackButton.addEventListener("click", () => {
  closeMoreDialog();
  window.dispatchEvent(new CustomEvent("sensevocab:open-feedback"));
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
wordList.addEventListener("click", async (event) => {
  const item = event.target.closest(".word-list-item");
  if (!item) return;
  item.classList.add("is-loading");
  item.setAttribute("aria-busy", "true");
  await openWordCard(item.dataset.wordId, {
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
  if (document.body.dataset.tutorialActive === "true") return;
  if (event.key === "Escape") {
    if (!resetDialog.hidden) closeResetDialog();
    if (!planDialog.hidden) closePlanDialog();
    if (!returnDialog.hidden) closeReturnDialog();
  }
});
window.addEventListener("resize", () => {
  updateAppViewportHeight();
  scheduleWordFit();
  positionHeatmapAtLatest();
});
window.addEventListener("orientationchange", updateAppViewportHeight);
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
