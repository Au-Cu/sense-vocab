const { test, expect } = require("@playwright/test");

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
}

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
  await expect(page.locator("#liquidGlassToggle")).not.toBeChecked();
  await expect(page.locator("#uiThemeBadge")).toHaveText("经典");

  await page.locator(".ui-theme-switch").click();
  await expect(page.locator("#liquidGlassToggle")).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "liquid-glass");
  await expect(page.locator("#uiThemeBadge")).toHaveText("液态玻璃");
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
    .toBe("liquid-glass");
  expect(await page.evaluate((key) => localStorage.getItem(key), LEARNING_KEY))
    .toBe(learningBefore);

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "liquid-glass");
  await openMore(page);
  await expect(page.locator("#liquidGlassToggle")).toBeChecked();

  await page.locator("#liquidGlassToggle").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#liquidGlassToggle")).not.toBeChecked();
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
  await expect(page.locator("#liquidGlassToggle")).not.toBeChecked();
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
      const nav = document.querySelector("#mainAppNav").getBoundingClientRect();
      const panel = document.querySelector("#settingsPanel").getBoundingClientRect();
      const control = document.querySelector(".interface-setting").getBoundingClientRect();
      const navStyle = getComputedStyle(document.querySelector("#mainAppNav"));
      return {
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        nav: nav.toJSON(),
        panel: panel.toJSON(),
        control: control.toJSON(),
        navBlur: navStyle.backdropFilter || navStyle.webkitBackdropFilter,
      };
    });

    expect(metrics.scrollWidth, viewport.name).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.nav.left, viewport.name).toBeGreaterThanOrEqual(0);
    expect(metrics.nav.right, viewport.name).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.nav.bottom, viewport.name).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.panel.left, viewport.name).toBeGreaterThanOrEqual(0);
    expect(metrics.panel.right, viewport.name).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.control.left, viewport.name).toBeGreaterThanOrEqual(metrics.panel.left);
    expect(metrics.control.right, viewport.name).toBeLessThanOrEqual(metrics.panel.right);
    expect(metrics.navBlur, viewport.name).toContain("blur");
    await expect(page.locator("#liquidGlassToggle")).toBeChecked();
    await context.close();
  }
});
