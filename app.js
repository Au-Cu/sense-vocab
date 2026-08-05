const DEFAULT_DAILY_TARGET = 20;
const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const ACCOUNT_STORAGE_PREFIX = `${STORAGE_KEY}:account:`;
const DATA_VERSION = 10;
const ROOT_STATE_VERSION = 2;
const DEFAULT_BOOK_ID = "kaoyan";
const VOCABULARY_INDEX_URL = "./data/vocabulary-index.json";
const VOCABULARY_BUNDLE_URL = "./data/vocabulary-bundle.json";
const VOCABULARY_CACHE_PREFIX = "sense-vocab-vocabulary-";
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
const planButton = document.querySelector("#planButton");
const advanceStudyButton = document.querySelector("#advanceStudyButton");
const wordListButton = document.querySelector("#wordListButton");
const startStudyButton = document.querySelector("#startStudyButton");
const moreButton = document.querySelector("#moreButton");
const moreDialog = document.querySelector("#moreDialog");
const closeMoreButton = document.querySelector("#closeMoreButton");
const homeFeedbackButton = document.querySelector("#homeFeedbackButton");
const replayTutorialButton = document.querySelector("#replayTutorialButton");

const wordListPanel = document.querySelector("#wordListPanel");
const wordSortSelect = document.querySelector("#wordSortSelect");
const wordSearchInput = document.querySelector("#wordSearchInput");
const wordListFilters = document.querySelector("#wordListFilters");
const wordListEmpty = document.querySelector("#wordListEmpty");
const wordList = document.querySelector("#wordList");
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
const exitStudyButton = document.querySelector("#exitStudyButton");
const resetButton = document.querySelector("#resetButton");
const reviewCount = document.querySelector("#reviewCount");
const newCount = document.querySelector("#newCount");
const learningCount = document.querySelector("#learningCount");
const queueProgress = document.querySelector("#queueProgress");
const cardMode = document.querySelector("#cardMode");

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

let words = [];
let wordById = new Map();
let state = null;
let rootState = null;
let vocabularyBundle = null;
let vocabularyIndex = null;
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
let wordFitFrame = null;
let pendingCrossDayReturn = false;
let midnightRefreshTimer = null;
let wordListQuery = "";
let wordListFilter = "all";
let heatmapPositionedBookId = null;
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
let confusionGlobeLoader = null;
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
        audioSourcePage: sense.audioSourcePage,
        exampleSource: sense.exampleSource,
        exampleSourceId: sense.exampleSourceId,
        exampleOwner: sense.exampleOwner,
        exampleLicense: sense.exampleLicense,
        importance: Math.max(1, 100 - target.senses.length * 3),
      });
    });
  });

  return Array.from(merged.values())
    .filter((word) => word.senses.length > 0)
    .map(({ seenSenses, ...word }) => word);
}

function installVocabularyData(data, { details = false } = {}) {
  vocabularyBundle = data;
  bookById = new Map(data.books.map((book) => [book.id, book]));
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
    activity: cloneProgress(state.activityLog[currentActivityDate()]),
  };
}

function ensureEncounterSnapshot(card) {
  if (!card || card.encounterSnapshot) return;
  card.encounterSnapshot = createEncounterSnapshot(card.wordId);
}

function createStudyCard(type, wordId, activeKeys) {
  const card = {
    type,
    wordId,
    activeSenseKeys: sortSenseKeysByImportance(activeKeys),
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
    return { raw, parsed: JSON.parse(raw) };
  } catch {
    return { raw, parsed: null };
  }
}

function migrateStoredStateToCompactFormat(storageKey, normalized, raw) {
  if (!raw) return;
  try {
    const compact = JSON.stringify(compactLocalState(normalized));
    if (compact.length < raw.length) {
      localStorage.setItem(storageKey, compact);
    }
  } catch {
    // A failed replacement leaves the previous localStorage value untouched.
  }
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
  if (tutorialRuntime?.active) return;
  if (!isPersistenceSafe()) return;
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
    const serialized = JSON.stringify(compactLocalState(nextRootState));
    attemptedCharacters = serialized.length;
    localStorage.setItem(activeStorageKey, serialized);
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

function stateSignature(candidate) {
  const value = JSON.stringify(candidate ?? {});
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function applyStateToStorage(storageKey, nextState = null) {
  if (tutorialRuntime?.active) {
    tutorialRuntime.realStorageKey = storageKey;
    tutorialRuntime.realRootState = nextState
      ? normalizeRootState(cloneSerializable(nextState))
      : loadState(storageKey);
    return;
  }
  activeStorageKey = storageKey;
  rootState = nextState
    ? normalizeRootState(cloneSerializable(nextState))
    : loadState(storageKey);
  activateBookScope(rootState.activeBookId);
  applyWordDeepLink();
  saveState({ notify: false, stampSync: !nextState });
  render();
  window.dispatchEvent(new CustomEvent("sensevocab:scope-changed", {
    detail: { storageKey: activeStorageKey },
  }));
}

function cloudStateSnapshot() {
  if (tutorialRuntime?.active) {
    return cloneSerializable(tutorialRuntime.realRootState);
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
    view: ["home", "study", "word-list"].includes(state.view)
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
  getState: cloudStateSnapshot,
  getGuestState: () => loadState(STORAGE_KEY),
  getAccountState: (userId) => loadState(accountStorageKey(userId)),
  hasLearningData: stateHasLearningData,
  isPersistenceSafe,
  stateSignature,
  mergeStates: (localState, remoteState) => {
    if (!window.SenseVocabSync) return cloneSerializable(remoteState);
    return window.SenseVocabSync.mergeStates(localState, remoteState);
  },
  getCurrentWordContext: () => currentFeedbackContext(),
  activateGuest: () => applyStateToStorage(STORAGE_KEY),
  activateAccount: (userId, nextState = null) => {
    applyStateToStorage(accountStorageKey(userId), nextState);
  },
  replaceActiveState: (nextState, options = {}) => {
    if (tutorialRuntime?.active) {
      tutorialRuntime.realRootState = normalizeRootState(cloneSerializable(nextState));
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
    saveState({
      notify: options.notify !== false,
      stampSync: options.stampSync !== false,
    });
    render();
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
  return [...reviewCards, ...newCards];
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
    return createStudyCard("reinforcement", wordId, keys);
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

function exampleAttribution(sense) {
  const source = String(sense.exampleSource ?? "").toLowerCase();
  if (!source) return "";
  if (source.includes("tatoeba")) {
    const sentence = sense.exampleSourceId ? ` #${sense.exampleSourceId}` : "";
    const owner = sense.exampleOwner ? ` · ${sense.exampleOwner}` : "";
    const license = sense.exampleLicense ? ` · ${sense.exampleLicense}` : "";
    return `来源：Tatoeba${sentence}${owner}${license}`;
  }
  if (source.includes("kaikki") || source.includes("wiktionary")) {
    const label = source.includes("quotation") ? "Wiktionary/Kaikki 引文" : "Wiktionary/Kaikki";
    return `来源：${label}${sense.exampleLicense ? ` · ${sense.exampleLicense}` : ""}`;
  }
  if (source.includes("wordnet") || source.includes("semcor")) {
    return `来源：Princeton WordNet${sense.exampleLicense ? ` · ${sense.exampleLicense}` : ""}`;
  }
  return "";
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
    const newTypes = new Set(["new", "extra", "advance"]);
    return new Set(
      session.queue
        .slice(session.currentIndex)
        .filter((card) => newTypes.has(card.type))
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
    const category = cardProgressCategory(card);
    if (!category) return;
    const keys = activeSenseKeysForCard(card).filter(isKnownSenseKey);
    counts[category].total += keys.length;
    if (index < progressIndex) {
      counts[category].completed += keys.length;
      return;
    }
    if (index !== progressIndex) return;
    if (progressPhase === "examples") {
      counts[category].completed += keys.length;
      return;
    }
    const confirmed = new Set(card.confirmedKeys ?? []);
    counts[category].completed += keys.filter((key) => confirmed.has(key)).length;
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
  if (!membershipAllowsStudy() || !hasPlan() || availableNewWordCount() === 0) {
    return false;
  }
  const session = ensureTodaySession();
  return session.baseCompleted && !hasUnfinishedQueue();
}

function render() {
  if (!state) return;

  ensureTodaySession();
  homePanel.hidden = state.view !== "home";
  studyPanel.hidden = state.view !== "study";
  wordListPanel.hidden = state.view !== "word-list";
  confusionPanel.hidden = state.view !== "confusion";
  renderHome();
  renderStudy();
  if (state.view === "word-list") renderWordList();
  if (state.view === "confusion") renderConfusionPanel();
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
  const available = Math.max(96, revealButton.clientWidth - horizontalPadding);
  const measured = wordText.getBoundingClientRect().width;
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
  startStudyButton.textContent = button.label;
  startStudyButton.disabled = button.disabled;
  advanceStudyButton.hidden = !hasPlan() || !ensureTodaySession().baseCompleted || remaining === 0;
  advanceStudyButton.disabled = !canStartAdvanceStudy();
  advanceStudyButton.textContent = scheduleDeltaDays() > 0 ? "再提前一天" : "提前学习";
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
  const encounterDates = [
    ...actualProgressDates,
    ...activityDates,
    ...(actualProgressDates.length || activityDates.length
      ? []
      : legacyProgressDates),
  ].sort();
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
  const duration = firstLearned
    ? daysBetween(firstLearned, masteredOn ?? lastLearned ?? firstLearned) + 1
    : 0;
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

function sortedWordsForList() {
  const query = wordListQuery.trim().toLocaleLowerCase("en");
  const items = words
    .filter((word) => {
      return wordListFilter === "all" ||
        wordStatusBadges(word).some(({ type }) => type === wordListFilter);
    })
    .filter((word) => !query || word.word.toLocaleLowerCase("en").includes(query))
    .map((word) => ({ word, info: wordLearningInfo(word) }));
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
    const mode = state.wordListSort;
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
  wordList.replaceChildren();
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
  wordList.append(fragment);
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
    reviewCount.textContent = "0/0";
    newCount.textContent = "0/0";
    learningCount.textContent = "0/0";
    queueProgress.textContent = browsing ? "单词卡片" : "正在准备";
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
  reviewCount.textContent = `${counts.review.completed}/${counts.review.total}`;
  newCount.textContent = `${counts.new.completed}/${counts.new.total}`;
  learningCount.textContent =
    `${counts.reinforcement.completed}/${counts.reinforcement.total}`;
  queueProgress.textContent = browsing
    ? "单词卡片"
    : `${stageWordProgress.current} / ${stageWordProgress.total}`;

  senseList.replaceChildren();
  morphologyPanel.replaceChildren();
  senseArea.hidden = browsing ? false : !session.revealed || finished;
  nextButton.disabled = browsing || !session.revealed || finished;
  nextButton.textContent = !browsing && isHistoryView()
    ? "回到当前词"
    : phase === "examples" ? "下一词" : "完成";
  audioButton.hidden = finished;
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
    nextButton.textContent = "下一词";
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
      const attributionText = exampleAttribution(sense);
      if (attributionText) {
        const attribution = document.createElement("span");
        attribution.className = "sense-attribution";
        attribution.textContent = attributionText;
        exampleGroup.append(attribution);
      }
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

async function startStudy() {
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

  state.view = "study";
  saveState();
  render();
}

async function startAdvanceStudy() {
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

  state.view = "study";
  saveState();
  render();
}

function openMoreDialog() {
  moreDialog.hidden = false;
}

function closeMoreDialog() {
  moreDialog.hidden = true;
}

function openWordList() {
  state.wordBrowse = null;
  state.view = "word-list";
  wordListQuery = "";
  wordListFilter = "all";
  saveState();
  render();
}

function closeWordList() {
  state.wordBrowse = null;
  state.view = "home";
  saveState();
  render();
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

async function openWordCard(wordId) {
  if (!wordById.has(wordId)) return;
  if (!await ensureVocabularyDetailsReady("word-card")) return;
  state.wordBrowse = { wordId };
  state.view = "study";
  saveState();
  render();
}

function closeWordCard() {
  const deepLinked = Boolean(requestedWordId());
  state.wordBrowse = null;
  state.view = deepLinked
    ? ["home", "study", "word-list"].includes(wordDeepLinkReturnView)
      ? wordDeepLinkReturnView
      : "home"
    : "word-list";
  clearWordDeepLink();
  wordDeepLinkReturnView = null;
  saveState();
  render();
}

function exitStudy() {
  if (!state) return;
  if (state.wordBrowse) {
    closeWordCard();
    return;
  }

  finishStudyWindow("return-home");
  const session = ensureTodaySession();
  session.historyView = null;
  session.revealed = false;
  session.cardPhase = "hidden";
  state.view = "home";
  saveState();
  render();
}

function openReturnDialog() {
  const session = ensureTodaySession();
  pendingCrossDayReturn = false;
  returnTitle.textContent = "返回";
  returnCrossDayWarning.hidden = true;
  returnOptions.hidden = false;
  previousWordButton.hidden = false;
  previousWordButton.disabled = session.currentIndex <= 0;
  returnHomeButton.textContent = "返回主页";
  returnHomeButton.className = "secondary-button";
  returnDialog.hidden = false;
}

function closeReturnDialog() {
  pendingCrossDayReturn = false;
  returnDialog.hidden = true;
}

function handleReturnHome() {
  if (isCrossDayStudy() && !pendingCrossDayReturn) {
    pendingCrossDayReturn = true;
    returnTitle.textContent = "确认进入下一日学习？";
    returnCrossDayWarning.hidden = false;
    previousWordButton.hidden = true;
    returnHomeButton.textContent = "确认返回主页";
    returnHomeButton.className = "danger-button";
    return;
  }

  closeReturnDialog();
  exitStudy();
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
  session.currentIndex -= 1;
  session.revealed = true;
  session.cardPhase = "examples";
  closeReturnDialog();
  saveState();
  render();
}

function returnToCurrentWord() {
  const session = ensureTodaySession();
  const history = session.historyView;
  if (!history) return;

  session.currentIndex = Math.min(history.originIndex, session.queue.length);
  session.revealed = Boolean(history.originRevealed);
  session.cardPhase = history.originPhase || (session.revealed ? "select" : "hidden");
  session.historyView = null;
  saveState();
  render();
}

function revealSenses() {
  if (!state || !currentCard()) return;

  const session = ensureTodaySession();
  session.revealed = true;
  session.cardPhase = "select";
  saveState();
  render();
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

function playWordAudio(wordTextValue, sourceUrl = "") {
  if (!wordTextValue) return;

  stopWordAudio();
  const playbackGeneration = audioPlaybackGeneration;
  const pronunciationUrl =
    safeAudioUrl(sourceUrl) ||
    `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
      wordTextValue,
    )}&type=2`;

  const audio = new Audio(pronunciationUrl);
  activeAudio = audio;
  audio.play().catch(() => {
    if (
      playbackGeneration !== audioPlaybackGeneration ||
      activeAudio !== audio
    ) return;
    speakWithLocalVoice(wordTextValue, playbackGeneration);
  });
}

function maybeAutoPlayCurrentWord() {
  const session = ensureTodaySession();
  if (!state || session.revealed || state.view !== "study") return;

  const key = currentCardKey();
  const word = currentWord();
  if (!key || !word || key === lastAutoPlayedCardKey) return;

  lastAutoPlayedCardKey = key;
  playWordAudio(
    word.word,
    word.senses.find((sense) => sense.audio)?.audio ?? "",
  );
}

function speakCurrentWord() {
  if (!state) return;

  const word = currentWord();
  if (!word) return;
  playWordAudio(
    word.word,
    word.senses.find((sense) => sense.audio)?.audio ?? "",
  );
}

function playSenseTapSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  soundContext = soundContext ?? new AudioContextClass();

  if (soundContext.state === "suspended") {
    soundContext.resume();
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
}

function setProgressMastered(progress, date, learningDay = activeLearningDay()) {
  const actualDate = currentActivityDate();
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
}

function setProgressPending(
  progress,
  status,
  date,
  dueDate,
  dueLearningDay,
) {
  const actualDate = currentActivityDate();
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
  if (isNewLearningCard(card)) {
    setProgressMastered(progress, date, learningDay);
  } else if (card.type === "reinforcement") {
    setProgressPending(
      progress,
      SENSE_STATUS.REVIEW,
      date,
      addDays(date, 1),
      learningDay + 1,
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
      );
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
  }, 340);
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

  card.expandedMasteredKeys = [];
  session.cardPhase = "examples";
  saveState();
  render();
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

  saveState();
  render();
}

function handleProgressButton() {
  if (state.wordBrowse) {
    closeWordCard();
    return;
  }
  const session = ensureTodaySession();
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

function openPlanDialog() {
  bookSelect.value = activeBookId();
  const selectedState = rootState.bookStates[bookSelect.value] ?? createState();
  const value = selectedState.plan?.dailyTarget ?? DEFAULT_DAILY_TARGET;
  planTitle.textContent = selectedState.plan?.dailyTarget ? "修改计划" : "选择计划";
  dailyTargetInput.value = value;
  planForm.hidden = false;
  planResetConfirm.hidden = true;
  resetAllPlanButton.hidden = !selectedState.plan?.dailyTarget;
  updatePlanPreview();
  planDialog.hidden = false;
}

function closePlanDialog(options = {}) {
  if (
    tutorialRuntime?.active &&
    tutorialRuntime.step === "plan-form" &&
    options.force !== true
  ) return;
  planForm.hidden = false;
  planResetConfirm.hidden = true;
  planDialog.hidden = true;
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

function openResetDialog() {
  if (!state) return;

  const card = resettableCard();
  const word = card ? wordById.get(card.wordId) : null;

  resetWordLabel.textContent = word ? `当前单词：${word.word}` : "当前没有单词";
  resetMarkingButton.disabled = !word;
  relearnWordButton.disabled = !word;
  showResetOptions();
  resetDialog.hidden = false;
}

function closeResetDialog() {
  pendingResetType = null;
  resetDialog.hidden = true;
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
  Object.entries(snapshot.progress ?? {}).forEach(([key, progress]) => {
    if (progress) {
      state.progress[key] = cloneProgress(progress);
    } else {
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
  card.confirmedKeys = [];
  refreshCardDisplayKeys(card);
  session.currentIndex = cardIndex;
  session.revealed = true;
  session.cardPhase = "select";
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
  allKeys.forEach((key) => delete state.progress[key]);
  state.introducedWords = state.introducedWords.filter(
    (wordId) => wordId !== card.wordId,
  );
  updatePlanDrift();
  session.reinforcedKeys = session.reinforcedKeys.filter(
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
    more: "#moreButton",
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
  if (step === "account" && moreDialog.hidden) openMoreDialog();
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
    playWordAudio(
      word.word,
      word.senses.find((sense) => sense.audio)?.audio ?? "",
    );
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
  moreDialog.hidden = true;
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
  render();
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

function handleTutorialInteraction(event) {
  if (!tutorialRuntime?.active) return;
  const target = tutorialTargetForStep();
  if (target && !target.contains(event.target)) return;

  const step = tutorialRuntime.step;
  if (step === "plan" && event.target.closest("#planButton")) {
    window.setTimeout(() => setTutorialStep("plan-form"), 0);
  } else if (step === "plan-form" && event.target.closest("#savePlanButton")) {
    window.setTimeout(() => setTutorialStep("start"), 0);
  } else if (step === "reveal" && event.target.closest("#revealButton")) {
    window.setTimeout(() => setTutorialStep("act-performance"), 0);
  } else if (step === "act-performance" && event.target.closest('[data-key="act:v-1"]')) {
    window.setTimeout(() => setTutorialStep("act-law"), 720);
  } else if (step === "act-law" && event.target.closest('[data-key="act:n-3"]')) {
    window.setTimeout(() => setTutorialStep("reset"), 720);
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
    if (tutorialCurrentWordIsFullyMarked()) {
      window.setTimeout(() => setTutorialStep("her-next"), 720);
    }
  } else if (step === "her-next" && event.target.closest("#nextButton")) {
    window.setTimeout(() => {
      tutorialSessionForWord("abandon");
      setTutorialStep("abandon-return");
    }, 0);
  } else if (step === "abandon-return" && event.target.closest("#exitStudyButton")) {
    window.setTimeout(() => setTutorialStep("return-home"), 0);
  } else if (step === "return-home" && event.target.closest("#returnHomeButton")) {
    window.setTimeout(() => setTutorialStep("more"), 0);
  } else if (step === "more" && event.target.closest("#moreButton")) {
    if (tutorialScopeId() === "guest") {
      window.setTimeout(() => setTutorialStep("account"), 0);
    } else {
      closeMoreDialog();
      window.setTimeout(showTutorialCompletedDialog, 0);
    }
  } else if (step === "account" && event.target.closest("#accountButton")) {
    closeMoreDialog();
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
  ) return;
  event.preventDefault();
  event.stopImmediatePropagation();
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
  homePanel.setAttribute("aria-busy", "false");
  document.documentElement.dataset.appReady = "true";
  window.dispatchEvent(new CustomEvent("sensevocab:app-ready"));
  maybeStartAutomaticTutorial();
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
moreDialog.addEventListener("click", (event) => {
  if (event.target === moreDialog) closeMoreDialog();
});
document.querySelector("#accountButton").addEventListener("click", closeMoreDialog);
homeFeedbackButton.addEventListener("click", () => {
  closeMoreDialog();
  window.dispatchEvent(new CustomEvent("sensevocab:open-feedback"));
});
replayTutorialButton.addEventListener("click", () => {
  closeMoreDialog();
  startTutorial({ replay: true });
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
studyFeedbackButton.addEventListener("click", () => {
  const context = currentFeedbackContext();
  if (!context) return;
  window.dispatchEvent(new CustomEvent("sensevocab:open-feedback", {
    detail: { context },
  }));
});
exitStudyButton.addEventListener("click", () => {
  const confusionRootWordId =
    state.wordBrowse?.confusionEntry?.rootWordId ??
    state.wordBrowse?.confusionReturnRootId;
  if (confusionRootWordId) {
    openConfusionGlobe(confusionRootWordId, {
      focusWordId: state.wordBrowse.wordId,
    });
  } else if (state.wordBrowse) {
    closeWordCard();
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
  await openWordCard(item.dataset.wordId);
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
  positionTutorialOverlay({ force: true });
});
window.visualViewport?.addEventListener("scroll", () => {
  positionTutorialOverlay({ force: true });
});
window.addEventListener("orientationchange", updateAppViewportHeight);
finishTutorialButton.addEventListener("click", finishTutorial);
window.addEventListener("sensevocab:app-ready", maybeStartAutomaticTutorial);
window.addEventListener("sensevocab:account-ready", maybeStartAutomaticTutorial);
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
