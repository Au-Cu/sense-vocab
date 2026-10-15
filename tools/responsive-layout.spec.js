const { test, expect } = require("@playwright/test");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  reducedMotion: "reduce",
});

async function openApp(page, theme, history = false) {
  await page.addInitScript(({ theme, history }) => {
    localStorage.clear();
    localStorage.setItem("sense-vocab-ui-theme-v1", theme);
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
    if (history) {
      const activityLog = {};
      const dashboardSnapshots = {};
      const dashboardEvents = {};
      for (let offset = 21; offset >= 1; offset -= 1) {
        const day = new Date();
        day.setDate(day.getDate() - offset);
        const date = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
        activityLog[date] = { newWords: ["act"], reviewWords: ["action"], target: 1 };
        dashboardSnapshots[`kaoyan:${date}`] = {
          id: `kaoyan:${date}`, bookId: "kaoyan", date, observedAt: `${date}T12:00:00.000Z`,
          statuses: { "act:v-1": "review", "act:n-3": "reinforce" },
          enteredAt: { "act:v-1": `${date}T10:00:00.000Z`, "act:n-3": `${date}T10:00:00.000Z` },
        };
        dashboardEvents[`event-${date}`] = {
          id: `event-${date}`, date, senseId: "act:v-2", from: "new", to: "mastered", observedAt: `${date}T12:00:00.000Z`,
        };
      }
      localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({
        schemaVersion: 2, activeBookId: "kaoyan",
        bookStates: { kaoyan: {
          introducedWords: ["act", "action"], activityLog, dashboardSnapshots, dashboardEvents,
          progress: { "act:v-1": { status: "review" }, "act:n-3": { status: "reinforce" } },
        } },
      }));
    }
  }, { theme, history });
  await page.goto(APP_URL);
  await page.waitForFunction(() => (
    document.documentElement.dataset.appReady === "true" &&
    document.documentElement.dataset.vocabularyReady === "true" &&
    document.documentElement.dataset.accountReady === "true"
  ));
}

async function expectPageFrame(page, selector, reference) {
  const panel = page.locator(selector);
  await expect(panel).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-ui-transition");
  const box = await panel.boundingBox();
  expect(Math.abs(box.width - reference.width), `${selector} width`).toBeLessThan(1);
  expect(Math.abs(box.x - reference.x), `${selector} alignment`).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    .toBe(true);
}

for (const theme of ["classic", "liquid-glass"]) {
  for (const viewport of [
    { name: "wide desktop", width: 1440, height: 1000 },
    { name: "small desktop", width: 1024, height: 900 },
    { name: "tablet", width: 800, height: 900 },
    { name: "phone", width: 390, height: 844 },
    { name: "narrow phone", width: 320, height: 740 },
  ]) {
    test(`${theme} ${viewport.name} pages share one responsive content frame`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize(viewport);
      await openApp(page, theme);
      await expect(page.locator("html")).toHaveCSS("scrollbar-gutter", viewport.width > 760 ? "stable" : "auto");
      const home = await page.locator("#homePanel").boundingBox();
      if (viewport.width >= 1024) expect(home.width).toBe(920);

      await page.locator("#globalDashboardNavButton").click();
      await expectPageFrame(page, "#dashboardPanel", home);
      const card = await page.locator(".dashboard-card").first().boundingBox();
      expect(card.width).toBeGreaterThan(home.width - (viewport.width > 560 ? 80 : 32));

      await page.locator("#globalSettingsNavButton").click();
      await expectPageFrame(page, "#settingsPanel", home);
      const interfaceBox = await page.locator(".interface-setting").boundingBox();
      const actionBox = await page.locator(".settings-action-list").boundingBox();
      expect(Math.abs(interfaceBox.x - actionBox.x)).toBeLessThan(1);
      expect(Math.abs(interfaceBox.width - actionBox.width)).toBeLessThan(1);

      await page.locator("#dataButton").click();
      await expectPageFrame(page, "#dataPanel", home);
      const dataBoxes = await page.locator(".data-status-card, .data-action-list, #dataBackButton")
        .evaluateAll((items) => items.map((item) => {
          const box = item.getBoundingClientRect();
          return { x: box.x, width: box.width };
        }));
      for (const box of dataBoxes) {
        expect(Math.abs(box.x - dataBoxes[0].x)).toBeLessThan(1);
        expect(Math.abs(box.width - dataBoxes[0].width)).toBeLessThan(1);
      }
      await page.locator("#dataBackButton").click();
      await expectPageFrame(page, "#settingsPanel", home);

      const dialogWidths = [];
      for (const [button, dialog, close] of [
        ["#accountButton", "#accountDialog .account-dialog", "#closeAccountButton"],
        ["#notificationsButton", "#notificationsDialog .notifications-dialog", "#closeNotificationsButton"],
      ]) {
        await page.locator(button).click();
        await expect(page.locator(dialog)).toBeVisible();
        await expect(page.locator(dialog).locator("..")).not.toHaveClass(/is-modal-(preparing|entering|closing)/);
        const box = await page.locator(dialog).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        dialogWidths.push(box.width);
        await page.locator(close).click();
        await expect(page.locator(dialog)).toBeHidden();
      }
      expect(Math.abs(dialogWidths[0] - dialogWidths[1])).toBeLessThan(1);

      if (theme === "liquid-glass" && viewport.width >= 1024) {
        const nav = await page.locator("#mainAppNav").boundingBox();
        expect(Math.abs(nav.width - home.width)).toBeLessThan(1);
        expect(Math.abs(nav.x - home.x)).toBeLessThan(1);
      }

      await page.locator("#globalHomeNavButton").click();
      await page.locator("#wordListButton").click();
      await expectPageFrame(page, "#wordListPanel", home);
      await page.locator("#wordListBackButton").click();
      await expect(page.locator("#homePanel")).toBeVisible();
      await page.locator("#planButton").click();
      await page.locator("#dailyTargetInput").fill("1");
      await page.locator("#savePlanButton").click();
      await page.locator("#startStudyButton").click();
      await expectPageFrame(page, "#studyPanel", home);
      await page.locator("#revealButton").click();
      await expect(page.locator("#senseArea")).toBeVisible();
      await page.locator("#revealButton").click();
      await expectPageFrame(page, "#confusionPanel", home);
      await page.locator("#confusionBackButton").click();
      await expectPageFrame(page, "#studyPanel", home);
    });
  }
}

test("populated desktop charts expand with the page and remain contained after resizing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openApp(page, "classic", true);
  await page.locator("#globalDashboardNavButton").click();
  await expect(page.locator(".dashboard-chart-frame")).toHaveCount(4);
  for (const width of [1440, 800, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(async () => page.locator(".dashboard-plot-scroll").first()
      .evaluate((plot) => plot.clientWidth)).toBeGreaterThan(width === 1440 ? 700 : 200);
    const plots = await page.locator(".dashboard-chart-frame").evaluateAll((frames) => frames.map((frame) => {
      const box = frame.getBoundingClientRect();
      return { left: box.left, right: box.right, plotWidth: frame.querySelector(".dashboard-plot-scroll").clientWidth };
    }));
    for (const plot of plots) {
      expect(plot.left).toBeGreaterThanOrEqual(0);
      expect(plot.right).toBeLessThanOrEqual(width);
      expect(plot.plotWidth).toBeGreaterThan(width === 1440 ? 700 : 200);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: ".op-cache/evidence/responsive-dashboard-desktop.png", fullPage: true });
});
