const { test, expect } = require("@playwright/test");

const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1180, height: 860 },
  reducedMotion: "no-preference",
});

async function prepareStudy(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
  });
  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText("act");
}

async function openGlobe(page) {
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
  await page.locator("#revealButton").click();
  await expect(page.locator("#confusionPanel")).toBeVisible();
  await expect(page.locator("#confusionGlobeStage canvas")).toBeVisible();
  await page.waitForTimeout(900);
}

test("dark mode keeps the card-to-globe transition dark", async ({ page }) => {
  await prepareStudy(page);
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
  const samples = await page.evaluate(async () => {
    document.documentElement.dataset.colorMode = "dark";
    document.querySelector("#revealButton").click();
    const colors = [];
    const start = performance.now();
    while (performance.now() - start < 1200) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const transition = document.querySelector(".word-globe-transition");
      if (transition) colors.push(getComputedStyle(transition).backgroundColor);
    }
    return colors;
  });
  expect(samples.length).toBeGreaterThan(0);
  for (const color of samples) {
    const rgb = color.match(/\d+/g).slice(0, 3).map(Number);
    expect(Math.max(...rgb)).toBeLessThan(100);
  }
});

test("adding a confusion word yields the input frame and persists on pagehide", async ({ page }) => {
  await prepareStudy(page); await openGlobe(page);
  await page.locator("#confusionSearchInput").fill("abandon");
  const result = await page.evaluate((storageKey) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === storageKey) {
        const until = performance.now() + 180;
        while (performance.now() < until) { /* simulate a slow full-state write */ }
      }
      return original.call(this, key, value);
    };
    const button = document.querySelector('.confusion-search-action[data-word-id="abandon"]');
    const start = performance.now();
    button.click();
    const clickMs = performance.now() - start;
    window.dispatchEvent(new Event("pagehide"));
    Storage.prototype.setItem = original;
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return { clickMs, links: Object.values(saved.confusionLinks ?? {}) };
  }, STORAGE_KEY);
  expect(result.clickMs).toBeLessThan(100);
  expect(result.links).toEqual(expect.arrayContaining([expect.objectContaining({ left: "act", right: "abandon" })]));
});

test("adding a confusion word updates the globe before a slow full-state write", async ({ page }) => {
  await prepareStudy(page); await openGlobe(page);
  await page.locator("#confusionSearchInput").fill("abandon");
  const result = await page.evaluate((storageKey) => new Promise((resolve, reject) => {
    const original = Storage.prototype.setItem;
    const timer = setTimeout(() => { Storage.prototype.setItem = original; reject(new Error("save did not start")); }, 5000);
    Storage.prototype.setItem = function (key, value) {
      if (key === storageKey) {
        const visibleBeforeWrite = Boolean(document.querySelector('.confusion-globe-word[data-word-id="abandon"]'));
        const countBeforeWrite = document.querySelector("#confusionCount").textContent;
        const until = performance.now() + 180;
        while (performance.now() < until) { /* simulate a slow full-state write */ }
        const result = original.call(this, key, value);
        Storage.prototype.setItem = original; clearTimeout(timer);
        resolve({ visibleBeforeWrite, countBeforeWrite });
        return result;
      }
      return original.call(this, key, value);
    };
    document.querySelector('.confusion-search-action[data-word-id="abandon"]').click();
  }), STORAGE_KEY);
  expect(result.visibleBeforeWrite).toBe(true);
  expect(result.countBeforeWrite).toBe("2 个词");
});

test("a pending confusion edit is saved before changing account scope", async ({ page }) => {
  await prepareStudy(page); await openGlobe(page);
  await page.locator("#confusionSearchInput").fill("abandon");
  const result = await page.evaluate((storageKey) => {
    document.querySelector('.confusion-search-action[data-word-id="abandon"]').click();
    const switched = window.SenseVocabApp.activateAccount("confusion-scope-test");
    const stored = JSON.parse(localStorage.getItem(storageKey));
    const account = window.SenseVocabApp.getAccountState("confusion-scope-test");
    return { switched, guestLinks: Object.values(stored.confusionLinks ?? stored.bookStates?.kaoyan?.confusionLinks ?? {}),
      accountLinks: Object.values(account.bookStates?.kaoyan?.confusionLinks ?? {}) };
  }, STORAGE_KEY);
  expect(result.switched).not.toBe(false);
  expect(result.guestLinks).toEqual(expect.arrayContaining([expect.objectContaining({ left: "act", right: "abandon" })]));
  expect(result.accountLinks).not.toEqual(expect.arrayContaining([expect.objectContaining({ left: "act", right: "abandon" })]));
});

test("a failed confusion edit remains pending until local storage can save it", async ({ page }) => {
  await prepareStudy(page); await openGlobe(page);
  await page.locator("#confusionSearchInput").fill("abandon");
  await page.evaluate((storageKey) => {
    window.__originalSetItem = Storage.prototype.setItem;
    window.__blockConfusionWrite = true;
    window.__confusionStorageError = false;
    window.addEventListener("sensevocab:storage-error", () => { window.__confusionStorageError = true; });
    Storage.prototype.setItem = function (key, value) {
      if (key === storageKey && window.__blockConfusionWrite) throw new DOMException("quota exceeded", "QuotaExceededError");
      return window.__originalSetItem.call(this, key, value);
    };
    document.querySelector('.confusion-search-action[data-word-id="abandon"]').click();
  }, STORAGE_KEY);
  await expect.poll(() => page.evaluate(() => window.__confusionStorageError)).toBe(true);
  await page.evaluate(() => document.querySelector("#confusionBackButton").click());
  await expect(page.locator("#confusionPanel")).toBeVisible();
  await page.evaluate(() => { window.__blockConfusionWrite = false; });
  await page.evaluate(() => document.querySelector("#confusionBackButton").click());
  await expect(page.locator("#studyPanel")).toBeVisible();
  const links = await page.evaluate((key) => {
    Storage.prototype.setItem = window.__originalSetItem;
    const stored = JSON.parse(localStorage.getItem(key));
    return Object.values(stored.confusionLinks ?? stored.bookStates?.kaoyan?.confusionLinks ?? {});
  }, STORAGE_KEY);
  expect(links).toEqual(expect.arrayContaining([expect.objectContaining({ left: "act", right: "abandon" })]));
});

test("globe loading feedback paints before the module arrives without rendering hidden study", async ({ page }) => {
  let releaseModule;
  const moduleGate = new Promise((resolve) => { releaseModule = resolve; });
  await page.route("**/confusion-globe.js?*", async (route) => {
    await moduleGate;
    await route.continue();
  });
  await prepareStudy(page);
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
  await page.evaluate(() => {
    window.__hiddenStudyRenders = 0;
    const original = window.renderStudy;
    window.renderStudy = function trackHiddenStudy() {
      if (document.querySelector("#studyPanel").hidden) window.__hiddenStudyRenders += 1;
      return original();
    };
  });
  const firstFrame = await page.evaluate(async () => {
    document.querySelector("#revealButton").click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Boolean(document.querySelector(".word-globe-transition"));
  });
  releaseModule();
  expect(firstFrame).toBe(true);
  await expect(page.locator("#confusionPanel")).toBeVisible();
  await expect(page.locator("#confusionPanel")).not.toHaveClass(/is-transitioning/);
  expect(await page.evaluate(() => window.__hiddenStudyRenders)).toBe(0);
});

test("idle globes stop drawing and reuse one WebGL surface on reentry", async ({ page }) => {
  await prepareStudy(page);
  await openGlobe(page);
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);
  await page.evaluate(() => {
    window.__globeCanvas = document.querySelector("#confusionGlobeStage canvas");
    window.__globeDraws = 0;
    const prototype = WebGL2RenderingContext.prototype;
    const original = prototype.drawElements;
    prototype.drawElements = function countDraws(...args) {
      if (this.canvas === window.__globeCanvas) window.__globeDraws += 1;
      return original.apply(this, args);
    };
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__globeDraws)).toBe(0);
  await page.locator("#confusionGlobeStage").press("ArrowRight");
  await expect.poll(() => page.evaluate(() => window.__globeDraws)).toBeGreaterThan(0);
  await page.locator("#confusionBackButton").click();
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);
  await page.locator("#revealButton").click();
  await expect(page.locator("#confusionPanel")).toBeVisible();
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector("#confusionGlobeStage canvas") === window.__globeCanvas)).toBe(true);
});

test("disposed globe callbacks cannot change the reused surface", async ({ page }) => {
  await prepareStudy(page);
  await openGlobe(page);
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);
  const result = await page.evaluate(async () => {
    const container = document.querySelector("#confusionGlobeStage");
    const options = { container, words: [{ id: "act", word: "act" }], currentWordId: "act" };
    const old = window.SenseVocabConfusionGlobe.create(options);
    await old.nextPaint();
    old.destroy();
    const current = window.SenseVocabConfusionGlobe.create(options);
    await current.nextPaint();
    const alpha = () => {
      const canvas = container.querySelector("canvas");
      const gl = canvas.getContext("webgl2");
      const pixel = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel[3];
    };
    const before = alpha();
    old.setPresentationProgress(0);
    await current.nextPaint();
    const after = alpha();
    current.destroy();
    return { before, after };
  });
  expect(result.before).toBeGreaterThan(200);
  expect(result.after).toBe(result.before);
});

test("a failed globe load leaves the learning card usable and can be retried", async ({ page }) => {
  await page.route("**/confusion-globe.js?*", (route) => route.abort());
  await prepareStudy(page);
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
  await page.locator("#revealButton").click();
  await expect(page.locator("#queueProgress")).toHaveText("球体加载失败，请重试");
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);
  await expect(page.locator("#studyPanel")).not.toHaveClass(/is-transitioning/);
  await expect(page.locator("#revealButton")).not.toHaveAttribute("aria-busy");
  await page.unroute("**/confusion-globe.js?*");
  await page.locator("#revealButton").click();
  await expect(page.locator("#confusionPanel")).toBeVisible();
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);
});

test("users build symmetric pairwise confusing-word globes without transitive links", async ({ page }) => {
  test.setTimeout(45000);
  await page.addInitScript(() => {
    const NativeDate = Date;
    const start = new NativeDate();
    // This test covers globe navigation, not the separate cross-day confirmation flow.
    start.setHours(12, 0, 0, 0);
    const offset = start.getTime() - NativeDate.now();
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [NativeDate.now() + offset])); }
      static now() { return NativeDate.now() + offset; }
    };
  });
  await prepareStudy(page);
  await openGlobe(page);

  await expect(page.locator("#confusionCount")).toHaveText("1 个词");
  await expect(page.locator('.confusion-globe-word[data-word-id="act"]')).toBeVisible();

  const canvasSignal = await page.locator("#confusionGlobeStage canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { nonBlank: false, width: canvas.width, height: canvas.height };
    const sampleWidth = Math.min(32, canvas.width);
    const sampleHeight = Math.min(32, canvas.height);
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
    gl.readPixels(
      Math.max(0, Math.floor((canvas.width - sampleWidth) / 2)),
      Math.max(0, Math.floor((canvas.height - sampleHeight) / 2)),
      sampleWidth,
      sampleHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    return {
      nonBlank: pixels.some((value, index) => index % 4 !== 3 && value > 0),
      width: canvas.width,
      height: canvas.height,
    };
  });
  expect(canvasSignal.nonBlank).toBe(true);
  expect(canvasSignal.width).toBeGreaterThan(300);
  expect(canvasSignal.height).toBeGreaterThan(300);

  await page.locator("#confusionSearchInput").fill("abandon");
  await page.locator('.confusion-search-action[data-word-id="abandon"]').click();
  await expect(page.locator("#confusionCount")).toHaveText("2 个词");
  await page.waitForFunction(() => {
    return ["act", "abandon"].every((wordId) => {
      const element = document.querySelector(
        `.confusion-globe-word[data-word-id="${wordId}"]`,
      );
      return element && Number.isFinite(Number.parseFloat(
        element.style.getPropertyValue("--globe-word-scale"),
      ));
    });
  });
  const depthStyles = await page.evaluate(() => {
    const read = (wordId) => {
      const element = document.querySelector(
        `.confusion-globe-word[data-word-id="${wordId}"]`,
      );
      return {
        opacity: Number.parseFloat(element.style.opacity),
        scale: Number.parseFloat(
          element.style.getPropertyValue("--globe-word-scale"),
        ),
      };
    };
    return { front: read("act"), rear: read("abandon") };
  });
  expect(depthStyles.front.scale).toBeGreaterThan(depthStyles.rear.scale);
  expect(depthStyles.front.opacity).toBeGreaterThan(depthStyles.rear.opacity);
  const wordSurface = await page.locator(
    '.confusion-globe-word[data-word-id="act"]',
  ).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderWidth: style.borderTopWidth,
      background: style.backgroundColor,
      markerCount: element.parentElement.querySelectorAll(
        ".confusion-globe-word-marker",
      ).length,
    };
  });
  expect(wordSurface.borderWidth).toBe("0px");
  expect(wordSurface.background).toBe("rgba(0, 0, 0, 0)");
  expect(wordSurface.markerCount).toBe(1);

  await page.locator("#confusionSearchInput").fill("ability");
  await page.locator('.confusion-search-action[data-word-id="ability"]').click();
  await expect(page.locator("#confusionCount")).toHaveText("3 个词");
  await page.screenshot({
    path: "test-results/confusion-globe-desktop.png",
    fullPage: true,
  });

  const links = await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    return Object.values(saved.confusionLinks ?? {});
  }, STORAGE_KEY);
  expect(links).toEqual(expect.arrayContaining([
    expect.objectContaining({ left: "act", right: "abandon" }),
    expect.objectContaining({ left: "act", right: "ability" }),
  ]));
  expect(links.some((link) => {
    return new Set([link.left, link.right]).has("abandon") &&
      new Set([link.left, link.right]).has("ability");
  })).toBe(false);

  const globeStage = await page.locator("#confusionGlobeStage").boundingBox();
  await page.mouse.move(
    globeStage.x + globeStage.width * 0.72,
    globeStage.y + globeStage.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    globeStage.x + globeStage.width * 0.28,
    globeStage.y + globeStage.height * 0.5,
    { steps: 14 },
  );
  await page.mouse.up();
  await page.waitForTimeout(400);
  const reverseCoverage = await page.evaluate(async () => {
    document.querySelector(
      '.confusion-globe-word[data-word-id="abandon"]',
    ).click();
    const startedAt = performance.now();
    let sawTransition = false;
    let minimumCoverage = 1;
    const paintCoverage = (transition) => {
      const transitionStyle = getComputedStyle(transition);
      const transitionOpacity = Number.parseFloat(transitionStyle.opacity) || 0;
      const colorParts = transitionStyle.backgroundColor.match(/[\d.]+/g) ?? [];
      const backgroundAlpha = colorParts.length > 3
        ? Number.parseFloat(colorParts[3])
        : 1;
      const overlayCoverage = transitionOpacity * backgroundAlpha;
      const canvas = document.querySelector("#confusionGlobeStage canvas");
      let globeCoverage = 0;
      if (canvas) {
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (gl) {
          const pixel = new Uint8Array(4);
          gl.readPixels(
            Math.floor(canvas.width / 2),
            Math.floor(canvas.height / 2),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel,
          );
          globeCoverage = pixel[3] / 255;
        }
      }
      return overlayCoverage + globeCoverage * (1 - overlayCoverage);
    };
    while (performance.now() - startedAt < 3000) {
      const transition = document.querySelector(".word-globe-transition");
      const globeWord = document.querySelector(
        '.confusion-globe-word[data-word-id="abandon"]',
      );
      if (transition && globeWord) {
        sawTransition = true;
        minimumCoverage = Math.min(minimumCoverage, paintCoverage(transition));
      } else if (sawTransition && transition && !globeWord) {
        return minimumCoverage;
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    throw new Error("The globe/flat-circle reverse handoff did not finish.");
  });
  expect(reverseCoverage).toBeGreaterThan(0.82);
  await expect(page.locator("#studyPanel")).toBeVisible();
  await expect(page.locator("#wordText")).toHaveText("abandon");
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);
  await page.locator("#exitStudyButton").click();
  await expect(page.locator("#confusionPanel")).toBeVisible();
  await expect(page.locator('.confusion-globe-word[data-word-id="abandon"]')).toBeVisible();
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);

  await page.locator('.confusion-globe-word[data-word-id="act"]').dispatchEvent("click");
  await expect(page.locator("#studyPanel")).toBeVisible();
  await expect(page.locator("#wordText")).toHaveText("act");
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);
  await page.locator("#exitStudyButton").click();
  await expect(page.locator("#confusionPanel")).toBeVisible();
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);

  await page.locator("#confusionBackButton").click();
  await expect(page.locator("#studyPanel")).toBeVisible();
  await expect(page.locator("#wordText")).toHaveText("act");
  await expect(page.locator(".word-globe-transition")).toHaveCount(0);

  await page.locator("#exitStudyButton").click();
  await page.locator("#returnHomeButton").click();
  await expect(page.locator("#wordListButton")).toBeVisible();
  await page.locator("#wordListButton").click();
  await page.locator("#wordSearchInput").fill("abandon");
  await page.locator('.word-list-item[data-word-id="abandon"]').click();
  await page.locator("#revealButton").click();
  await expect(page.locator("#confusionPanel")).toBeVisible();
  await expect(page.locator("#confusionCount")).toHaveText("2 个词");
  await expect(page.locator('.confusion-globe-word[data-word-id="act"]')).toHaveCount(1);
  await expect(page.locator('.confusion-globe-word[data-word-id="ability"]')).toHaveCount(0);
});

test("the flat circle hands off to the real globe without changing the word size", async ({ page }) => {
  await prepareStudy(page);
  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
  const handoff = await page.evaluate(async () => {
    const stage = document.querySelector("#confusionGlobeStage");
    let canvasAdditions = 0;
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node instanceof HTMLCanvasElement) canvasAdditions += 1;
        if (node instanceof Element) {
          canvasAdditions += node.querySelectorAll("canvas").length;
        }
      }));
    });
    observer.observe(stage, { childList: true, subtree: true });
    document.querySelector("#revealButton").click();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("sensevocab:membership", {
        detail: {
          loggedIn: true,
          active: true,
          pending: false,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      }));
    }, 340);
    const startedAt = performance.now();
    let sawTransition = false;
    let sample = null;
    let minimumCoverage = 1;
    let minimumPaintCoverage = 1;
    const paintCoverage = (transition) => {
      const transitionStyle = getComputedStyle(transition);
      const transitionOpacity = Number.parseFloat(transitionStyle.opacity) || 0;
      const colorParts = transitionStyle.backgroundColor.match(/[\d.]+/g) ?? [];
      const backgroundAlpha = colorParts.length > 3
        ? Number.parseFloat(colorParts[3])
        : 1;
      const overlayCoverage = transitionOpacity * backgroundAlpha;
      const canvas = stage.querySelector("canvas");
      let globeCoverage = 0;
      if (canvas) {
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (gl) {
          const pixel = new Uint8Array(4);
          gl.readPixels(
            Math.floor(canvas.width / 2),
            Math.floor(canvas.height / 2),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel,
          );
          globeCoverage = pixel[3] / 255;
        }
      }
      return overlayCoverage + globeCoverage * (1 - overlayCoverage);
    };
    while (performance.now() - startedAt < 3000) {
      const transition = document.querySelector(".word-globe-transition");
      const transitionWord = transition?.querySelector("span");
      const globeWord = document.querySelector(
        '.confusion-globe-word[data-word-id="act"]',
      );
      if (transitionWord && globeWord) {
        sawTransition = true;
        const transitionStyle = getComputedStyle(transition);
        const transitionWordStyle = getComputedStyle(transitionWord);
        const globeStyle = getComputedStyle(globeWord);
        const transitionOpacity = Number.parseFloat(transitionStyle.opacity);
        const globeOpacity = Number.parseFloat(globeStyle.opacity);
        minimumCoverage = Math.min(
          minimumCoverage,
          transitionOpacity + globeOpacity * (1 - transitionOpacity),
        );
        minimumPaintCoverage = Math.min(
          minimumPaintCoverage,
          paintCoverage(transition),
        );
        if (
          !sample &&
          transitionOpacity > 0.05 && transitionOpacity < 0.95 &&
          globeOpacity > 0.95
        ) {
          const globeScale = Number.parseFloat(
            globeWord.style.getPropertyValue("--globe-word-scale"),
          );
          sample = {
            transitionFont: Number.parseFloat(transitionWordStyle.fontSize),
            globeFont: Number.parseFloat(globeStyle.fontSize) * globeScale,
            transitionOpacity,
            globeOpacity,
          };
        }
      } else if (sawTransition && !transition && globeWord && sample) {
        observer.disconnect();
        return {
          ...sample,
          canvasAdditions,
          minimumCoverage,
          minimumPaintCoverage,
          finalGlobeOpacity: Number.parseFloat(getComputedStyle(globeWord).opacity),
        };
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    throw new Error("The flat-circle/globe crossfade window was not observed.");
  });
  expect(Math.abs(handoff.transitionFont - handoff.globeFont)).toBeLessThan(0.75);
  expect(handoff.transitionOpacity).toBeGreaterThan(0.05);
  expect(handoff.transitionOpacity).toBeLessThan(0.95);
  expect(handoff.globeOpacity).toBeGreaterThan(0.95);
  expect(handoff.minimumCoverage).toBeGreaterThan(0.94);
  expect(handoff.minimumPaintCoverage).toBeGreaterThan(0.82);
  expect(handoff.canvasAdditions).toBe(1);
  expect(handoff.finalGlobeOpacity).toBeGreaterThan(0.98);
  await expect(page.locator("#confusionGlobeStage canvas")).toBeVisible();
  await expect(page.locator("#confusionPanel")).toBeVisible();
});

test("the globe is framed on a mobile viewport and responds to drag rotation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareStudy(page);
  await openGlobe(page);
  await page.locator("#confusionSearchInput").fill("abandon");
  await page.locator('.confusion-search-action[data-word-id="abandon"]').click();
  await page.waitForTimeout(500);

  const stage = page.locator("#confusionGlobeStage");
  const before = await page.locator('.confusion-globe-word[data-word-id="act"]').boundingBox();
  const stageBox = await stage.boundingBox();
  expect(stageBox.x).toBeGreaterThanOrEqual(0);
  expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(390);
  expect(stageBox.height).toBeGreaterThanOrEqual(320);

  await page.mouse.move(stageBox.x + stageBox.width * 0.65, stageBox.y + stageBox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(stageBox.x + stageBox.width * 0.25, stageBox.y + stageBox.height * 0.42, {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(350);
  const after = await page.locator('.confusion-globe-word[data-word-id="act"]').boundingBox();
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(5);

  await page.waitForTimeout(700);
  const beforeTouch = await page.locator(
    '.confusion-globe-word[data-word-id="act"]',
  ).boundingBox();
  await stage.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const fire = (type, pointerId, x, y) => {
      element.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + x,
        clientY: rect.top + y,
        pointerId,
        pointerType: "touch",
        isPrimary: pointerId === 41,
      }));
    };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    fire("pointerdown", 41, centerX - 58, centerY);
    fire("pointerdown", 42, centerX + 58, centerY);
    fire("pointermove", 41, centerX - 38, centerY - 36);
    fire("pointermove", 42, centerX + 38, centerY + 36);
    fire("pointerup", 41, centerX - 38, centerY - 36);
    fire("pointerup", 42, centerX + 38, centerY + 36);
  });
  await page.waitForTimeout(420);
  const afterTouch = await page.locator(
    '.confusion-globe-word[data-word-id="act"]',
  ).boundingBox();
  expect(
    Math.abs(afterTouch.x - beforeTouch.x) +
      Math.abs(afterTouch.y - beforeTouch.y),
  ).toBeGreaterThan(3);
  const stageCenter = {
    x: stageBox.x + stageBox.width / 2,
    y: stageBox.y + stageBox.height / 2,
  };
  const screenAngle = (box) => Math.atan2(
    box.y + box.height / 2 - stageCenter.y,
    box.x + box.width / 2 - stageCenter.x,
  );
  let clockwiseDelta = screenAngle(afterTouch) - screenAngle(beforeTouch);
  while (clockwiseDelta > Math.PI) clockwiseDelta -= Math.PI * 2;
  while (clockwiseDelta < -Math.PI) clockwiseDelta += Math.PI * 2;
  expect(clockwiseDelta).toBeGreaterThan(0.03);

  await page.screenshot({
    path: "test-results/confusion-globe-mobile.png",
    fullPage: true,
  });
});
