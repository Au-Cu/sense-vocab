(() => {
  const SYNC_VERSION = 1;
  const DEVICE_KEY = "sense-vocab-device-v1";
  const TAB_KEY = "sense-vocab-tab-v1";
  const STATUS_RANK = new Map([
    ["new", 0],
    ["reinforce", 1],
    ["review", 2],
    ["mastered", 3],
  ]);
  const SCALAR_RECORDS = [
    "plan",
    "session",
    "learningDayCounter",
    "wordListSort",
  ];
  const MAP_RECORDS = [
    "introducedWords",
    "progress",
    "activityLog",
    "studyWindows",
    "confusionLinks",
  ];
  let fallbackDeviceId = null;

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(",")}]`;
    }
    return `{${Object.keys(value).sort().map((key) => {
      return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
    }).join(",")}}`;
  }

  function valuesEqual(left, right) {
    return stableStringify(left) === stableStringify(right);
  }

  function randomToken() {
    const source = window.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random()}-${Math.random()}`;
    return source.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  }

  function readOrCreate(storage, key) {
    try {
      const existing = storage.getItem(key);
      if (existing) return existing;
      const created = randomToken();
      storage.setItem(key, created);
      return created;
    } catch {
      return randomToken();
    }
  }

  function deviceId() {
    if (fallbackDeviceId) return fallbackDeviceId;
    const device = readOrCreate(window.localStorage, DEVICE_KEY);
    const tab = readOrCreate(window.sessionStorage, TAB_KEY);
    fallbackDeviceId = `${device}.${tab}`;
    return fallbackDeviceId;
  }

  function normalizeVector(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, counter]) => {
          return key && Number.isSafeInteger(counter) && counter >= 0;
        })
        .map(([key, counter]) => [key, counter]),
    );
  }

  function normalizeRecord(value, deleted = false) {
    return {
      vector: normalizeVector(value?.vector),
      deleted: Boolean(value?.deleted ?? deleted),
    };
  }

  function emptyMetadata() {
    return {
      version: SYNC_VERSION,
      counters: {},
      records: {
        plan: null,
        session: null,
        learningDayCounter: null,
        wordListSort: null,
        introducedWords: {},
        progress: {},
        activityLog: {},
        studyWindows: {},
        confusionLinks: {},
      },
    };
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value ?? {}, key);
  }

  function windowsById(value) {
    const result = {};
    (Array.isArray(value) ? value : []).forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const id = String(entry.id ?? `${index + 1}`);
      result[id] = { ...entry, id };
    });
    return result;
  }

  function ensureScopeMetadata(state) {
    if (!state || typeof state !== "object") return emptyMetadata();
    const source = state._sync && typeof state._sync === "object"
      ? state._sync
      : {};
    const metadata = emptyMetadata();
    metadata.counters = normalizeVector(source.counters);

    const sourceRecords = source.records && typeof source.records === "object"
      ? source.records
      : {};
    SCALAR_RECORDS.forEach((name) => {
      if (sourceRecords[name] && typeof sourceRecords[name] === "object") {
        metadata.records[name] = normalizeRecord(sourceRecords[name]);
      }
    });
    MAP_RECORDS.forEach((name) => {
      const entries = sourceRecords[name] && typeof sourceRecords[name] === "object"
        ? sourceRecords[name]
        : {};
      metadata.records[name] = Object.fromEntries(
        Object.entries(entries).map(([key, record]) => {
          return [key, normalizeRecord(record)];
        }),
      );
    });

    if (state.plan && !metadata.records.plan) {
      metadata.records.plan = normalizeRecord(null);
    }
    if (state.session && !metadata.records.session) {
      metadata.records.session = normalizeRecord(null);
    }
    if (!metadata.records.learningDayCounter) {
      metadata.records.learningDayCounter = normalizeRecord(null);
    }
    if (!metadata.records.wordListSort) {
      metadata.records.wordListSort = normalizeRecord(null);
    }

    (Array.isArray(state.introducedWords) ? state.introducedWords : [])
      .forEach((wordId) => {
        if (!metadata.records.introducedWords[wordId]) {
          metadata.records.introducedWords[wordId] = normalizeRecord(null);
        }
      });
    Object.keys(state.progress ?? {}).forEach((key) => {
      if (!metadata.records.progress[key]) {
        metadata.records.progress[key] = normalizeRecord(null);
      }
    });
    Object.keys(state.activityLog ?? {}).forEach((date) => {
      if (!metadata.records.activityLog[date]) {
        metadata.records.activityLog[date] = normalizeRecord(null);
      }
    });
    Object.keys(windowsById(state.studyWindows)).forEach((id) => {
      if (!metadata.records.studyWindows[id]) {
        metadata.records.studyWindows[id] = normalizeRecord(null);
      }
    });
    Object.keys(state.confusionLinks ?? {}).forEach((key) => {
      if (!metadata.records.confusionLinks[key]) {
        metadata.records.confusionLinks[key] = normalizeRecord(null);
      }
    });

    state._sync = metadata;
    return metadata;
  }

  function mergeVector(left, right) {
    const merged = { ...normalizeVector(left) };
    Object.entries(normalizeVector(right)).forEach(([key, counter]) => {
      merged[key] = Math.max(merged[key] ?? 0, counter);
    });
    return merged;
  }

  function compareVectors(leftValue, rightValue) {
    const left = normalizeVector(leftValue);
    const right = normalizeVector(rightValue);
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    let leftGreater = false;
    let rightGreater = false;
    keys.forEach((key) => {
      const leftCounter = left[key] ?? 0;
      const rightCounter = right[key] ?? 0;
      if (leftCounter > rightCounter) leftGreater = true;
      if (rightCounter > leftCounter) rightGreater = true;
    });
    if (!leftGreater && !rightGreater) return "equal";
    if (leftGreater && !rightGreater) return "left";
    if (rightGreater && !leftGreater) return "right";
    return "concurrent";
  }

  function inheritMetadata(nextMetadata, previousMetadata) {
    nextMetadata.counters = mergeVector(
      nextMetadata.counters,
      previousMetadata.counters,
    );
    SCALAR_RECORDS.forEach((name) => {
      const next = nextMetadata.records[name];
      const previous = previousMetadata.records[name];
      if (
        previous &&
        (!next || Object.keys(next.vector).length === 0)
      ) {
        nextMetadata.records[name] = clone(previous);
      }
    });
    MAP_RECORDS.forEach((name) => {
      Object.entries(previousMetadata.records[name]).forEach(([key, record]) => {
        const next = nextMetadata.records[name][key];
        if (!next || Object.keys(next.vector).length === 0) {
          nextMetadata.records[name][key] = clone(record);
        }
      });
    });
  }

  function stampRecord(metadata, record, deleted, writer) {
    const normalized = normalizeRecord(record, deleted);
    const current = Math.max(
      metadata.counters[writer] ?? 0,
      normalized.vector[writer] ?? 0,
    );
    const nextCounter = current + 1;
    metadata.counters[writer] = nextCounter;
    normalized.vector[writer] = nextCounter;
    normalized.deleted = Boolean(deleted);
    return normalized;
  }

  function stampScalar(next, previous, metadata, previousMetadata, name, writer) {
    if (valuesEqual(next[name], previous[name])) return;
    metadata.records[name] = stampRecord(
      metadata,
      metadata.records[name] ?? previousMetadata.records[name],
      next[name] === null || next[name] === undefined,
      writer,
    );
  }

  function stampMap(nextMap, previousMap, metadata, previousMetadata, name, writer) {
    const keys = new Set([
      ...Object.keys(nextMap),
      ...Object.keys(previousMap),
      ...Object.keys(previousMetadata.records[name]),
    ]);
    keys.forEach((key) => {
      const nextHas = hasOwn(nextMap, key);
      const previousHas = hasOwn(previousMap, key);
      if (
        nextHas === previousHas &&
        (!nextHas || valuesEqual(nextMap[key], previousMap[key]))
      ) return;
      metadata.records[name][key] = stampRecord(
        metadata,
        metadata.records[name][key] ?? previousMetadata.records[name][key],
        !nextHas,
        writer,
      );
    });
  }

  function stampScopeChanges(nextState, previousState, writer = deviceId()) {
    if (!nextState || typeof nextState !== "object") return nextState;
    const previous = previousState && typeof previousState === "object"
      ? clone(previousState)
      : {};
    const previousMetadata = ensureScopeMetadata(previous);
    const metadata = ensureScopeMetadata(nextState);
    inheritMetadata(metadata, previousMetadata);

    stampScalar(nextState, previous, metadata, previousMetadata, "plan", writer);
    stampScalar(nextState, previous, metadata, previousMetadata, "session", writer);
    stampScalar(
      nextState,
      previous,
      metadata,
      previousMetadata,
      "learningDayCounter",
      writer,
    );
    stampScalar(
      nextState,
      previous,
      metadata,
      previousMetadata,
      "wordListSort",
      writer,
    );

    const nextMembership = Object.fromEntries(
      (Array.isArray(nextState.introducedWords) ? nextState.introducedWords : [])
        .map((wordId) => [wordId, true]),
    );
    const previousMembership = Object.fromEntries(
      (Array.isArray(previous.introducedWords) ? previous.introducedWords : [])
        .map((wordId) => [wordId, true]),
    );
    stampMap(
      nextMembership,
      previousMembership,
      metadata,
      previousMetadata,
      "introducedWords",
      writer,
    );
    stampMap(
      nextState.progress ?? {},
      previous.progress ?? {},
      metadata,
      previousMetadata,
      "progress",
      writer,
    );
    stampMap(
      nextState.activityLog ?? {},
      previous.activityLog ?? {},
      metadata,
      previousMetadata,
      "activityLog",
      writer,
    );
    stampMap(
      windowsById(nextState.studyWindows),
      windowsById(previous.studyWindows),
      metadata,
      previousMetadata,
      "studyWindows",
      writer,
    );
    stampMap(
      nextState.confusionLinks ?? {},
      previous.confusionLinks ?? {},
      metadata,
      previousMetadata,
      "confusionLinks",
      writer,
    );
    return nextState;
  }

  function recordState(recordValue, hasValue) {
    const explicit = Boolean(recordValue && typeof recordValue === "object");
    return {
      ...normalizeRecord(recordValue, !hasValue),
      explicit,
    };
  }

  function mergedRecord(left, right, deleted) {
    return {
      vector: mergeVector(left.vector, right.vector),
      deleted: Boolean(deleted),
    };
  }

  function pickDeterministic(left, right) {
    return stableStringify(left) >= stableStringify(right) ? left : right;
  }

  function minimumDate(...values) {
    return values
      .filter((value) => typeof value === "string" && value)
      .sort()[0] ?? null;
  }

  function maximumDate(...values) {
    return values
      .filter((value) => typeof value === "string" && value)
      .sort()
      .at(-1) ?? null;
  }

  function minimumNumber(...values) {
    const numbers = values.filter(Number.isFinite);
    return numbers.length ? Math.min(...numbers) : null;
  }

  function maximumNumber(...values) {
    const numbers = values.filter(Number.isFinite);
    return numbers.length ? Math.max(...numbers) : null;
  }

  function mergeProgress(left, right) {
    const base = clone(pickDeterministic(left, right));
    const leftRank = STATUS_RANK.get(left?.status) ?? 0;
    const rightRank = STATUS_RANK.get(right?.status) ?? 0;
    const status = leftRank <= rightRank ? left?.status : right?.status;
    base.status = STATUS_RANK.has(status) ? status : "new";
    base.misses = Math.max(Number(left?.misses) || 0, Number(right?.misses) || 0);
    base.firstSeen = minimumDate(left?.firstSeen, right?.firstSeen);
    base.firstSeenActual = minimumDate(
      left?.firstSeenActual,
      right?.firstSeenActual,
    );
    base.lastSeen = maximumDate(left?.lastSeen, right?.lastSeen);
    base.lastSeenActual = maximumDate(
      left?.lastSeenActual,
      right?.lastSeenActual,
    );
    base.lastLearningDay = maximumNumber(
      left?.lastLearningDay,
      right?.lastLearningDay,
    );
    if (base.status === "mastered") {
      base.masteredOn = maximumDate(left?.masteredOn, right?.masteredOn);
      base.masteredOnActual = maximumDate(
        left?.masteredOnActual,
        right?.masteredOnActual,
      );
      base.dueDate = null;
      base.dueLearningDay = null;
    } else {
      base.masteredOn = null;
      base.masteredOnActual = null;
      base.dueDate = minimumDate(left?.dueDate, right?.dueDate);
      base.dueLearningDay = minimumNumber(
        left?.dueLearningDay,
        right?.dueLearningDay,
      );
    }
    return base;
  }

  function uniqueStrings(...values) {
    return [...new Set(values.flatMap((value) => {
      return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
    }))];
  }

  function uniqueNumbers(...values) {
    return [...new Set(values.flatMap((value) => {
      return Array.isArray(value) ? value.filter(Number.isFinite) : [];
    }))].sort((left, right) => left - right);
  }

  function mergeActivity(left, right) {
    const base = clone(pickDeterministic(left, right));
    base.newWords = uniqueStrings(left?.newWords, right?.newWords);
    base.reviewWords = uniqueStrings(left?.reviewWords, right?.reviewWords);
    base.newCountLocked = Boolean(left?.newCountLocked || right?.newCountLocked);
    base.newCount = Math.max(
      base.newWords.length,
      Number(left?.newCount) || 0,
      Number(right?.newCount) || 0,
    );
    base.reviewCount = Math.max(
      base.reviewWords.length,
      Number(left?.reviewCount) || 0,
      Number(right?.reviewCount) || 0,
    );
    base.baseCompleted = Boolean(left?.baseCompleted || right?.baseCompleted);
    base.overtime = Boolean(left?.overtime || right?.overtime);
    base.target = maximumNumber(left?.target, right?.target);
    base.learningDays = uniqueNumbers(left?.learningDays, right?.learningDays);
    return base;
  }

  function mergeWindow(left, right) {
    const base = clone(pickDeterministic(left, right));
    base.startedAt = minimumDate(left?.startedAt, right?.startedAt);
    base.endedAt = maximumDate(left?.endedAt, right?.endedAt);
    base.endedDate = maximumDate(left?.endedDate, right?.endedDate);
    base.crossedMidnight = Boolean(left?.crossedMidnight || right?.crossedMidnight);
    if (base.endedAt) {
      base.endedReason = right?.endedAt === base.endedAt
        ? right?.endedReason ?? left?.endedReason ?? null
        : left?.endedReason ?? right?.endedReason ?? null;
    }
    return base;
  }

  function sessionScore(value) {
    if (!value || typeof value !== "object") return -1;
    const queueLength = Array.isArray(value.queue) ? value.queue.length : 0;
    const currentIndex = Number(value.currentIndex) || 0;
    return currentIndex * 100000 + queueLength * 100 +
      (value.baseCompleted ? 10 : 0) +
      (value.reinforcementAdded ? 1 : 0);
  }

  function concurrentValue(domain, left, right) {
    if (domain === "progress") return mergeProgress(left, right);
    if (domain === "activityLog") return mergeActivity(left, right);
    if (domain === "studyWindows") return mergeWindow(left, right);
    if (domain === "learningDayCounter") {
      return Math.max(Number(left) || 0, Number(right) || 0);
    }
    if (domain === "session") {
      const leftScore = sessionScore(left);
      const rightScore = sessionScore(right);
      if (leftScore !== rightScore) return leftScore > rightScore ? left : right;
    }
    return clone(pickDeterministic(left, right));
  }

  function resolveValue(domain, leftValue, rightValue, leftRecordValue, rightRecordValue) {
    const leftHas = leftValue !== undefined && leftValue !== null;
    const rightHas = rightValue !== undefined && rightValue !== null;
    const left = recordState(leftRecordValue, leftHas);
    const right = recordState(rightRecordValue, rightHas);
    const relation = compareVectors(left.vector, right.vector);

    if (relation === "left") {
      return {
        present: leftHas && !left.deleted,
        value: clone(leftValue),
        record: normalizeRecord(left, left.deleted),
      };
    }
    if (relation === "right") {
      return {
        present: rightHas && !right.deleted,
        value: clone(rightValue),
        record: normalizeRecord(right, right.deleted),
      };
    }
    if (
      relation === "equal" &&
      left.deleted === right.deleted &&
      valuesEqual(leftValue, rightValue)
    ) {
      return {
        present: leftHas && !left.deleted,
        value: clone(leftValue),
        record: mergedRecord(left, right, left.deleted),
      };
    }

    if (!leftHas && !left.explicit && rightHas) {
      return {
        present: !right.deleted,
        value: clone(rightValue),
        record: mergedRecord(left, right, right.deleted),
      };
    }
    if (!rightHas && !right.explicit && leftHas) {
      return {
        present: !left.deleted,
        value: clone(leftValue),
        record: mergedRecord(left, right, left.deleted),
      };
    }

    const explicitDeletion =
      (left.explicit && left.deleted) ||
      (right.explicit && right.deleted);
    if (explicitDeletion) {
      return {
        present: false,
        value: undefined,
        record: mergedRecord(left, right, true),
      };
    }

    if (!leftHas && !rightHas) {
      return {
        present: false,
        value: undefined,
        record: mergedRecord(left, right, true),
      };
    }
    if (!leftHas || !rightHas) {
      const value = leftHas ? leftValue : rightValue;
      return {
        present: true,
        value: clone(value),
        record: mergedRecord(left, right, false),
      };
    }

    return {
      present: true,
      value: concurrentValue(domain, leftValue, rightValue),
      record: mergedRecord(left, right, false),
    };
  }

  function mergeMap(domain, leftMap, rightMap, leftRecords, rightRecords) {
    const values = {};
    const records = {};
    const keys = new Set([
      ...Object.keys(leftMap),
      ...Object.keys(rightMap),
      ...Object.keys(leftRecords),
      ...Object.keys(rightRecords),
    ]);
    keys.forEach((key) => {
      const resolved = resolveValue(
        domain,
        hasOwn(leftMap, key) ? leftMap[key] : undefined,
        hasOwn(rightMap, key) ? rightMap[key] : undefined,
        leftRecords[key],
        rightRecords[key],
      );
      records[key] = resolved.record;
      if (resolved.present) values[key] = resolved.value;
    });
    return { values, records };
  }

  function mergeScopeStates(leftState, rightState) {
    const left = clone(leftState && typeof leftState === "object" ? leftState : {});
    const right = clone(rightState && typeof rightState === "object" ? rightState : {});
    const leftMetadata = ensureScopeMetadata(left);
    const rightMetadata = ensureScopeMetadata(right);
    const result = clone(pickDeterministic(left, right));
    const metadata = emptyMetadata();
    metadata.counters = mergeVector(
      leftMetadata.counters,
      rightMetadata.counters,
    );

    SCALAR_RECORDS.forEach((name) => {
      const resolved = resolveValue(
        name,
        left[name],
        right[name],
        leftMetadata.records[name],
        rightMetadata.records[name],
      );
      metadata.records[name] = resolved.record;
      result[name] = resolved.present ? resolved.value : null;
    });

    const leftMembership = Object.fromEntries(
      (Array.isArray(left.introducedWords) ? left.introducedWords : [])
        .map((wordId) => [wordId, true]),
    );
    const rightMembership = Object.fromEntries(
      (Array.isArray(right.introducedWords) ? right.introducedWords : [])
        .map((wordId) => [wordId, true]),
    );
    const membership = mergeMap(
      "introducedWords",
      leftMembership,
      rightMembership,
      leftMetadata.records.introducedWords,
      rightMetadata.records.introducedWords,
    );
    metadata.records.introducedWords = membership.records;
    const leftOrder = new Map(
      (left.introducedWords ?? []).map((wordId, index) => [wordId, index]),
    );
    const rightOrder = new Map(
      (right.introducedWords ?? []).map((wordId, index) => [wordId, index]),
    );
    result.introducedWords = Object.keys(membership.values).sort((leftWord, rightWord) => {
      const leftRank = Math.min(
        leftOrder.get(leftWord) ?? Number.MAX_SAFE_INTEGER,
        rightOrder.get(leftWord) ?? Number.MAX_SAFE_INTEGER,
      );
      const rightRank = Math.min(
        leftOrder.get(rightWord) ?? Number.MAX_SAFE_INTEGER,
        rightOrder.get(rightWord) ?? Number.MAX_SAFE_INTEGER,
      );
      return leftRank - rightRank || leftWord.localeCompare(rightWord);
    });

    const progress = mergeMap(
      "progress",
      left.progress ?? {},
      right.progress ?? {},
      leftMetadata.records.progress,
      rightMetadata.records.progress,
    );
    result.progress = progress.values;
    metadata.records.progress = progress.records;

    const activity = mergeMap(
      "activityLog",
      left.activityLog ?? {},
      right.activityLog ?? {},
      leftMetadata.records.activityLog,
      rightMetadata.records.activityLog,
    );
    result.activityLog = activity.values;
    metadata.records.activityLog = activity.records;

    const windows = mergeMap(
      "studyWindows",
      windowsById(left.studyWindows),
      windowsById(right.studyWindows),
      leftMetadata.records.studyWindows,
      rightMetadata.records.studyWindows,
    );
    metadata.records.studyWindows = windows.records;
    result.studyWindows = Object.values(windows.values)
      .sort((leftWindow, rightWindow) => {
        return String(leftWindow.startedAt ?? "").localeCompare(
          String(rightWindow.startedAt ?? ""),
        ) || String(leftWindow.id).localeCompare(String(rightWindow.id));
      })
      .slice(-500);

    const confusionLinks = mergeMap(
      "confusionLinks",
      left.confusionLinks ?? {},
      right.confusionLinks ?? {},
      leftMetadata.records.confusionLinks,
      rightMetadata.records.confusionLinks,
    );
    result.confusionLinks = confusionLinks.values;
    metadata.records.confusionLinks = confusionLinks.records;

    result.dataVersion = Math.max(
      Number(left.dataVersion) || 0,
      Number(right.dataVersion) || 0,
    );
    result.view = left.view ?? "home";
    result.wordBrowse = left.wordBrowse ?? null;
    result._sync = metadata;
    return result;
  }

  function isRootState(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      value.bookStates &&
      typeof value.bookStates === "object" &&
      !Array.isArray(value.bookStates),
    );
  }

  function mirroredScope(value) {
    const keys = [
      "view",
      "plan",
      "session",
      "introducedWords",
      "progress",
      "activityLog",
      "studyWindows",
      "learningDayCounter",
      "wordListSort",
      "wordBrowse",
      "dataVersion",
      "_sync",
    ];
    const entries = keys
      .filter((key) => hasOwn(value, key))
      .map((key) => [key, clone(value[key])]);
    return entries.length ? Object.fromEntries(entries) : null;
  }

  function asRootState(value) {
    if (isRootState(value)) {
      const root = clone(value);
      const activeBookId = typeof root.activeBookId === "string"
        ? root.activeBookId
        : "kaoyan";
      const mirror = mirroredScope(root);
      if (mirror) {
        root.bookStates[activeBookId] = {
          ...(root.bookStates[activeBookId] ?? {}),
          ...mirror,
        };
      }
      return root;
    }
    return {
      schemaVersion: 2,
      activeBookId: "kaoyan",
      bookStates: {
        kaoyan: clone(value && typeof value === "object" ? value : {}),
      },
    };
  }

  function ensureMetadata(state) {
    if (!isRootState(state)) return ensureScopeMetadata(state);
    Object.values(state.bookStates).forEach((bookState) => {
      ensureScopeMetadata(bookState);
    });
    return state;
  }

  function stampChanges(nextState, previousState, writer = deviceId()) {
    if (!isRootState(nextState) && !isRootState(previousState)) {
      return stampScopeChanges(nextState, previousState, writer);
    }
    const next = asRootState(nextState);
    const previous = asRootState(previousState);
    const bookIds = new Set([
      ...Object.keys(next.bookStates),
      ...Object.keys(previous.bookStates),
    ]);
    bookIds.forEach((bookId) => {
      if (!next.bookStates[bookId]) return;
      stampScopeChanges(
        next.bookStates[bookId],
        previous.bookStates[bookId] ?? {},
        writer,
      );
    });
    Object.assign(nextState, next);
    return nextState;
  }

  function mergeStates(leftState, rightState) {
    if (!isRootState(leftState) && !isRootState(rightState)) {
      return mergeScopeStates(leftState, rightState);
    }
    const left = asRootState(leftState);
    const right = asRootState(rightState);
    const bookIds = new Set([
      ...Object.keys(left.bookStates),
      ...Object.keys(right.bookStates),
    ]);
    const bookStates = {};
    bookIds.forEach((bookId) => {
      bookStates[bookId] = mergeScopeStates(
        left.bookStates[bookId] ?? {},
        right.bookStates[bookId] ?? {},
      );
    });
    const activeBookId = bookStates[left.activeBookId]
      ? left.activeBookId
      : bookStates[right.activeBookId]
        ? right.activeBookId
        : Object.keys(bookStates)[0] ?? "kaoyan";
    return {
      schemaVersion: Math.max(
        Number(left.schemaVersion) || 2,
        Number(right.schemaVersion) || 2,
      ),
      activeBookId,
      bookStates,
    };
  }

  window.SenseVocabSync = Object.freeze({
    deviceId,
    ensureMetadata,
    stampChanges,
    mergeStates,
    compareVectors,
  });
})();
