(() => {
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

  let tutorialRuntime = null;
  let tutorialAutoScheduledScope = null;
  let tutorialAutoTimer = null;
  let tutorialAutoWaitScope = null;
  let tutorialAutoWaitStartedAt = 0;
  let tutorialOverlayFrameId = null;
  let tutorialOverlayGeometryKey = "";
  let tutorialLiveTarget = null;

  const tutorialOverlay = document.querySelector("#tutorialOverlay");
  const tutorialSpotlight = document.querySelector("#tutorialSpotlight");
  const tutorialTip = document.querySelector("#tutorialTip");
  const tutorialMasks = Object.fromEntries(
    [...tutorialOverlay.querySelectorAll("[data-mask]")].map((mask) => [
      mask.dataset.mask,
      mask,
    ]),
  );
  const tutorialDoneDialog = document.querySelector("#tutorialDoneDialog");
  const finishTutorialButton = document.querySelector("#finishTutorialButton");
  const replayTutorialButton = document.querySelector("#replayTutorialButton");
  const moreDialog = document.querySelector("#moreDialog");
  const planDialog = document.querySelector("#planDialog");
  const resetDialog = document.querySelector("#resetDialog");
  const returnDialog = document.querySelector("#returnDialog");
  const revealButton = document.querySelector("#revealButton");
  const senseArea = document.querySelector("#senseArea");
  const tutorialExclusionMask = document.querySelector("#tutorialExclusionMask");
  const cancelPlanButton = document.querySelector("#cancelPlanButton");

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

    if (TUTORIAL_NON_INTERACTIVE_STEPS.has(tutorialRuntime.step)) {
      // Non-interactive steps block clicks everywhere (including the target),
      // while the spotlight still highlights it. Cover the full viewport with
      // the top mask; the spotlight paints above it and passes clicks through
      // to the mask, which intercepts them.
      setTutorialMaskRect(tutorialMasks.top, 0, 0, viewportWidth, viewportHeight);
      setTutorialMaskRect(tutorialMasks.right, 0, 0, 0, 0);
      setTutorialMaskRect(tutorialMasks.bottom, 0, 0, 0, 0);
      setTutorialMaskRect(tutorialMasks.left, 0, 0, 0, 0);
    } else {
      setTutorialMaskRect(tutorialMasks.top, 0, 0, viewportWidth, top);
      setTutorialMaskRect(tutorialMasks.bottom, 0, bottom, viewportWidth, viewportHeight - bottom);
      setTutorialMaskRect(tutorialMasks.left, 0, top, left, height);
      setTutorialMaskRect(tutorialMasks.right, right, top, viewportWidth - right, height);
    }

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
    document.body.dataset.tutorialActive = "true";

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
    delete document.body.dataset.tutorialActive;
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
    if (
      tutorialRuntime.step === "plan-form" &&
      event.target.closest("#cancelPlanButton, #resetAllPlanButton")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
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

  window.SenseVocabTutorial = Object.freeze({
    isActive: () => Boolean(tutorialRuntime?.active),
    getStep: () => tutorialRuntime?.step ?? null,
    beginStudy: () => beginTutorialStudy(),
    start: (options = {}) => startTutorial(options),
    maybeAutoStart: (delay) => maybeStartAutomaticTutorial(delay),
    recordReality: (storageKey, nextState = null) => {
      if (!tutorialRuntime?.active) return;
      tutorialRuntime.realStorageKey = storageKey;
      tutorialRuntime.realRootState = nextState
        ? normalizeRootState(cloneSerializable(nextState))
        : loadState(storageKey);
    },
    recordRealityState: (nextState) => {
      if (!tutorialRuntime?.active) return;
      tutorialRuntime.realRootState = normalizeRootState(cloneSerializable(nextState));
    },
    realState: () => {
      if (!tutorialRuntime?.active) return null;
      return cloneSerializable(tutorialRuntime.realRootState);
    },
  });

  replayTutorialButton.addEventListener("click", () => {
    closeMoreDialog();
    startTutorial({ replay: true });
  });

  finishTutorialButton.addEventListener("click", finishTutorial);

  document.addEventListener("click", handleTutorialInteraction);
  window.addEventListener("scroll", positionTutorialOverlay, true);
  window.addEventListener("resize", () => {
    positionTutorialOverlay();
  });
  window.visualViewport?.addEventListener("resize", () => {
    positionTutorialOverlay({ force: true });
  });
  window.visualViewport?.addEventListener("scroll", () => {
    positionTutorialOverlay({ force: true });
  });
  window.addEventListener("sensevocab:app-ready", maybeStartAutomaticTutorial);
  window.addEventListener("sensevocab:account-ready", maybeStartAutomaticTutorial);
  window.addEventListener("sensevocab:account-scope", maybeStartAutomaticTutorial);
  window.addEventListener("pageshow", maybeStartAutomaticTutorial);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      maybeStartAutomaticTutorial();
    }
  });
})();
