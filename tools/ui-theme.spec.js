const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const THEME_KEY = "sense-vocab-ui-theme-v1";
const LEARNING_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
const TUTORIAL_KEY = "sense-vocab-tutorial-complete-v1:guest";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
});

async function waitForApp(page) {
  await page.waitForFunction(() => (
    document.documentElement.dataset.appReady === "true" &&
    document.documentElement.dataset.accountReady === "true"
  ));
}

async function openMore(page) {
  await page.locator("#globalSettingsNavButton").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await expect(page.locator("#settingsPanel h1")).toHaveText("更多");
  await page.locator("#interfaceButton").click();
  await expect(page.locator("#interfacePanel")).toBeVisible();
}

test("classic dark mode keeps the startup background dark while loading", async ({ page }) => {
  let releaseIndex;
  const gate = new Promise((resolve) => { releaseIndex = resolve; });
  await page.route("**/data/vocabulary-index.json", async (route) => {
    await gate;
    await route.continue();
  });
  await page.addInitScript(({ themeKey, tutorialKey }) => {
    localStorage.clear();
    localStorage.setItem(themeKey, "classic");
    localStorage.setItem("sense-vocab-color-mode-v1", "dark");
    localStorage.setItem(tutorialKey, "completed");
  }, { themeKey: THEME_KEY, tutorialKey: TUTORIAL_KEY });
  await page.goto(APP_URL);
  const boot = page.locator("#bootScreen");
  await expect(boot).toBeVisible();
  const color = await boot.evaluate((element) => getComputedStyle(element).backgroundColor);
  const rgb = color.match(/\d+/g).slice(0, 3).map(Number);
  releaseIndex();
  expect(color).not.toBe("rgba(0, 0, 0, 0)");
  expect(Math.max(...rgb)).toBeLessThan(70);
});

test("interface preferences use compact segmented choices without explanatory copy", async ({ page }) => {
  await page.addInitScript(({ tutorialKey }) => {
    localStorage.clear(); localStorage.setItem(tutorialKey, "completed");
  }, { tutorialKey: TUTORIAL_KEY });
  await page.goto(APP_URL); await waitForApp(page); await openMore(page);
  const panel = page.locator("#interfacePanel");
  await expect(panel.getByRole("radio", { name: "经典", exact: true })).toBeChecked();
  await expect(panel.getByRole("radio", { name: "液态玻璃", exact: true })).toBeVisible();
  await expect(panel.getByRole("radio", { name: "浅色", exact: true })).toBeChecked();
  await expect(panel.getByRole("radio", { name: "深色", exact: true })).toBeVisible();
  await expect(panel.getByRole("radio", { name: "跟随系统", exact: true })).toBeVisible();
  await expect(panel).not.toContainText("保持原有简洁");
  await expect(panel).not.toContainText("仅保存在当前设备");
});

test("interface section titles sit inside their cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ tutorialKey }) => {
    localStorage.clear(); localStorage.setItem(tutorialKey, "completed");
  }, { tutorialKey: TUTORIAL_KEY });
  await page.goto(APP_URL); await waitForApp(page); await openMore(page);
  await expect(page.getByRole("radiogroup", { name: "界面风格" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "颜色模式" })).toBeVisible();
  const positions = await page.locator(".interface-choice").evaluateAll((cards) => cards.map((card) => {
    const title = card.querySelector("legend, .interface-choice-title").getBoundingClientRect();
    const box = card.getBoundingClientRect();
    return { topInset: title.top - box.top, leftInset: title.left - box.left, bottom: title.bottom - box.bottom };
  }));
  expect(positions).toHaveLength(2);
  for (const title of positions) {
    expect(title.topInset).toBeGreaterThan(6);
    expect(title.leftInset).toBeGreaterThan(6);
    expect(title.bottom).toBeLessThan(0);
  }
});

test("interface preference defaults to classic, persists, and stays outside learning data", async ({ page }) => {
  await page.addInitScript(({ tutorialKey }) => {
    if (sessionStorage.getItem("sense-vocab-ui-theme-test-ready") !== "true") {
      localStorage.clear();
      localStorage.setItem(tutorialKey, "completed");
      sessionStorage.setItem("sense-vocab-ui-theme-test-ready", "true");
    }
  }, { tutorialKey: TUTORIAL_KEY });

  await page.goto(APP_URL);
  await waitForApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "classic");
  await expect(page.locator("#globalSettingsNavButton")).toContainText("更多");

  const learningBefore = await page.evaluate((key) => localStorage.getItem(key), LEARNING_KEY);
  await openMore(page);
  await expect(page.getByRole("radio", { name: "经典", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "液态玻璃", exact: true })).not.toBeChecked();

  await page.getByRole("radio", { name: "液态玻璃", exact: true }).check();
  await expect(page.getByRole("radio", { name: "液态玻璃", exact: true })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "liquid-glass");
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
    .toBe("liquid-glass");
  expect(await page.evaluate((key) => localStorage.getItem(key), LEARNING_KEY))
    .toBe(learningBefore);

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "liquid-glass");
  await openMore(page);
  await expect(page.getByRole("radio", { name: "液态玻璃", exact: true })).toBeChecked();

  await page.getByRole("radio", { name: "经典", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio", { name: "经典", exact: true })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "classic");
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
    .toBe("classic");
});

test("invalid stored interface values fail safely to the classic theme", async ({ page }) => {
  await page.addInitScript(({ themeKey, tutorialKey }) => {
    localStorage.clear();
    localStorage.setItem(themeKey, "unknown-theme");
    localStorage.setItem(tutorialKey, "completed");
  }, { themeKey: THEME_KEY, tutorialKey: TUTORIAL_KEY });

  await page.goto(APP_URL);
  await waitForApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "classic");
  await openMore(page);
  await expect(page.getByRole("radio", { name: "经典", exact: true })).toBeChecked();
});

test("liquid glass remains contained and usable on desktop and phone viewports", async ({ browser }) => {
  const viewports = [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true },
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
    });
    await context.addInitScript(({ themeKey, tutorialKey }) => {
      localStorage.clear();
      localStorage.setItem(themeKey, "liquid-glass");
      localStorage.setItem(tutorialKey, "completed");
    }, { themeKey: THEME_KEY, tutorialKey: TUTORIAL_KEY });
    const page = await context.newPage();
    await page.goto(APP_URL);
    await waitForApp(page);
    await openMore(page);

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector("#interfacePanel").getBoundingClientRect();
      const control = document.querySelector(".interface-setting").getBoundingClientRect();
      return {
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        panel: panel.toJSON(),
        control: control.toJSON(),
      };
    });

    expect(metrics.scrollWidth, viewport.name).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.panel.left, viewport.name).toBeGreaterThanOrEqual(0);
    expect(metrics.panel.right, viewport.name).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.control.left, viewport.name).toBeGreaterThanOrEqual(metrics.panel.left);
    expect(metrics.control.right, viewport.name).toBeLessThanOrEqual(metrics.panel.right);
    await expect(page.getByRole("radio", { name: "液态玻璃", exact: true })).toBeChecked();
    await context.close();
  }
});

test("colour mode follows system, persists separately, and retains the selected interface style", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(({ tutorialKey }) => { localStorage.setItem(tutorialKey, "completed"); }, { tutorialKey: TUTORIAL_KEY });
  await page.goto(APP_URL);
  await waitForApp(page);
  await openMore(page);
  await page.getByRole("radio", { name: "液态玻璃", exact: true }).check();
  await page.getByLabel("跟随系统").check();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "liquid-glass");
  await page.reload();
  await waitForApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await openMore(page);
  await expect(page.getByLabel("跟随系统")).toBeChecked();
  await page.getByLabel("浅色", { exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  await page.getByLabel("深色", { exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await page.locator("#interfaceBackButton").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
});

test("dark surfaces remain readable across interface styles and viewport sizes", async ({ browser }) => {
  fs.mkdirSync(".op-cache/night-preview", { recursive: true });
  for (const theme of ["classic", "liquid-glass"]) {
    for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
      await context.addInitScript(({ theme, key }) => {
        localStorage.setItem("sense-vocab-ui-theme-v1", theme);
        localStorage.setItem("sense-vocab-color-mode-v1", "dark");
        localStorage.setItem(key, "completed");
      }, { theme, key: TUTORIAL_KEY });
      const page = await context.newPage();
      await page.goto(APP_URL);
      await waitForApp(page);
      await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
      await page.screenshot({ path: `.op-cache/night-preview/${theme}-${viewport.name}-home.png` });
      await openMore(page);
      await expect(page.getByLabel("深色", { exact: true })).toBeChecked();
      const panel = page.locator("#interfacePanel");
      const color = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(color).not.toBe("rgb(255, 255, 255)");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `.op-cache/night-preview/${theme}-${viewport.name}-settings.png` });
      await page.locator("#interfaceBackButton").click();
      await page.locator("#accountButton").click();
      await expect(page.locator("#accountDialog")).toBeVisible();
      await page.screenshot({ path: `.op-cache/night-preview/${theme}-${viewport.name}-account.png` });
      await page.locator("#closeAccountButton").click();
      await page.locator("#globalHomeNavButton").click();
      await page.locator("#wordListButton").click();
      await expect(page.locator("#wordListPanel")).toBeVisible();
      await page.screenshot({ path: `.op-cache/night-preview/${theme}-${viewport.name}-list.png` });
      await page.locator(".word-list-item").first().click();
      await expect(page.locator("#studyPanel")).toBeVisible();
      await page.screenshot({ path: `.op-cache/night-preview/${theme}-${viewport.name}-word.png` });
      await context.close();
    }
  }
});
