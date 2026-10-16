const { test, expect } = require("@playwright/test");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1280, height: 900 },
});

async function openFreshApp(page) {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await expect(page.locator("#globalDashboardNavButton")).toHaveText(/统计数据/);
  await expect(page.locator("#mainAppNav")).toBeVisible();
  await expect(page.locator("#globalHomeNavButton")).toBeVisible();
  const primaryActionBoxes = await page.locator(".home-primary-actions > button").evaluateAll((items) => (
    items.map((item) => item.getBoundingClientRect())
  ));
  expect(primaryActionBoxes).toHaveLength(3);
  const primaryActionRows = [...new Set(primaryActionBoxes.map((box) => box.y))];
  if (await page.evaluate(() => window.innerWidth >= 700)) {
    expect(primaryActionRows).toHaveLength(1);
  } else {
    expect(primaryActionRows).toHaveLength(1);
  }
  await page.locator("#globalDashboardNavButton").click();
  await expect(page.locator("#dashboardPanel")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiTransition ?? ""))
    .toBe("");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiTransition ?? ""))
    .toBe("");
  await page.locator("#globalDashboardNavButton").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-ui-transition");
  await expect(page.locator("#dashboardPanel")).toBeVisible();
}

async function openSankeyFixture(page, { mobile = false } = {}) {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP_URL);
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  await page.evaluate(({ date }) => {
    const events = [
      ["new-mastered-1", "act:v-1", "new", "mastered"],
      ["new-mastered-1-duplicate", "act:v-1", "new", "mastered"],
      ["new-mastered-2", "act:v-2", "new", "mastered"],
      ["new-reinforce", "act:n-3", "new", "reinforce"],
      ["reinforce-review", "act:n-4", "reinforce", "review"],
      ["review-mastered", "action:n-1", "review", "mastered"],
      ["review-reinforce", "action:n-2", "review", "reinforce"],
      ["mastered-new-hidden", "activate:v-1", "mastered", "new"],
    ];
    localStorage.clear();
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({
      schemaVersion: 2,
      activeBookId: "kaoyan",
      bookStates: {
        kaoyan: {
          introducedWords: ["act", "action", "activate"],
          progress: {},
          dashboardEvents: Object.fromEntries(events.map(([id, senseId, from, to]) => [
            id,
            { id, date, senseId, from, to, observedAt: `${date}T12:00:00.000Z` },
          ])),
        },
      },
    }));
  }, { date });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  await expect(page.locator("#dashboardPanel")).toBeVisible();
  await page.locator("#dashboardStartDate").fill(date);
  await page.locator("#dashboardEndDate").fill(date);
  await page.locator("#dashboardEndDate").dispatchEvent("change");
  await expect(page.locator("#dashboardSankeyChart .dashboard-sankey-frame")).toBeVisible();
  return date;
}

test("dashboard is a child page with user-facing empty states", async ({ page }) => {
  await openFreshApp(page);
  await expect(page.locator("#learningDashboard")).toBeVisible();
  await expect(page.locator("#dashboardUnitSelect")).toHaveValue("sense");
  await expect(page.locator("#dashboardDailyChart")).toContainText("暂无数据");
  await expect(page.locator("#dashboardStatusBar .dashboard-status-segment")).toHaveCount(4);
  await expect(page.locator("#dashboardPoolChart")).toContainText("暂无数据");
  await expect(page.locator("#dashboardConversionChart")).toContainText("暂无数据");
  await expect(page.locator("#dashboardHoldChart")).toContainText("暂无数据");
  await expect(page.locator("#dashboardSankeyChart")).toContainText("暂无数据");
  await expect(page.locator("#dashboardStartDate")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.locator("#dashboardEndDate")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.locator("#dashboardChartDoesNotExist")).toHaveCount(0);
  await expect(page.locator("#dashboardPanel")).toContainText("统计数据");
  await expect(page.locator("#globalHomeNavButton")).toBeVisible();
  await expect(page.locator("#globalDashboardNavButton")).toHaveAttribute("aria-current", "page");
  await page.locator("#globalHomeNavButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  await expect(page.locator("#dashboardPanel")).toBeHidden();
  await page.locator("#globalDashboardNavButton").click();
  await expect(page.locator("#dashboardPanel")).toBeVisible();
});

test("dashboard keeps chart plots scrollable and axes outside the plot on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshApp(page);
  const plotCount = await page.locator(".dashboard-plot-scroll").count();
  if (plotCount > 0) {
    const plot = page.locator(".dashboard-plot-scroll").first();
    const overflow = await plot.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeGreaterThanOrEqual(overflow.clientWidth);
    await expect(page.locator(".dashboard-axis-left").first()).toBeVisible();
    await expect(page.locator(".dashboard-axis-right").first()).toBeVisible();
  }
  await expect(page.locator("#dashboardUnitSelect")).toBeVisible();
});

test("dashboard uses status colors and interactive chart tooltips when data exists", async ({ page }) => {
  await page.goto(APP_URL);
  const today = new Date();
  const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  await page.evaluate(({ date }) => {
    const key = "sense-vocab-mvp-kaoyan-plan-v1";
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 2,
      activeBookId: "kaoyan",
      bookStates: {
        kaoyan: {
          introducedWords: ["act"],
          activityLog: { [date]: { newWords: ["act"], reviewWords: ["act"], target: 3 } },
          progress: {
            "act:v-1": { status: "mastered", firstSeenActual: date },
            "act:n-3": { status: "reinforce", firstSeenActual: date },
          },
          dashboardSnapshots: {
            [`kaoyan:${date}`]: {
              id: `kaoyan:${date}`,
              bookId: "kaoyan",
              date,
              observedAt: `${date}T12:00:00.000Z`,
              statuses: { "act:v-1": "review", "act:n-3": "reinforce" },
              enteredAt: {
                "act:v-1": `${date}T10:00:00.000Z`,
                "act:n-3": `${date}T10:00:00.000Z`,
              },
            },
          },
        },
      },
    }));
  }, { date });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  const statusCard = page.locator("#dashboardStatusHeading").locator("xpath=ancestor::article[1]");
  await expect(statusCard.locator(".dashboard-chart-detail-row")).toHaveCount(0);
  const masteredSegment = page.locator('#dashboardStatusBar [data-dashboard-status="mastered"]');
  const masteredLegend = page.locator('#dashboardStatusLegend [data-dashboard-status="mastered"]');
  await masteredSegment.dispatchEvent("pointerenter", { pointerType: "mouse" });
  await expect(masteredSegment).toHaveClass(/is-dashboard-active/);
  await expect(masteredLegend).toHaveClass(/is-dashboard-active/);
  await expect(masteredLegend).toHaveCSS("font-weight", "800");
  await expect(page.locator(".dashboard-plot-scroll").first()).toBeVisible();
  await expect(page.locator(".dashboard-axis-left").first()).toBeVisible();
  await expect(page.locator(".dashboard-axis-right").first()).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector(".dashboard-plot-scroll");
    if (!element) return false;
    const maxScroll = element.scrollWidth - element.clientWidth;
    return element.scrollLeft >= Math.max(0, maxScroll - 2);
  });
  const scrollState = await page.locator(".dashboard-plot-scroll").first().evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    maxScroll: element.scrollWidth - element.clientWidth,
  }));
  expect(scrollState.scrollLeft).toBeGreaterThanOrEqual(Math.max(0, scrollState.maxScroll - 2));
  const bar = page.locator(".dashboard-bar").first();
  const dailyCard = page.locator("#dashboardDailyHeading").locator("xpath=ancestor::article[1]");
  const dailyDetail = dailyCard.locator(".dashboard-chart-detail-row .dashboard-card-detail");
  const dailyTime = dailyCard.locator(".dashboard-card-heading .dashboard-card-time");
  await expect(dailyTime).toHaveText(date);
  await expect(dailyDetail).not.toContainText(date);
  const dailyBefore = await dailyCard.boundingBox();
  const barBox = await bar.boundingBox();
  const dailySvgBox = await page.locator("#dashboardDailyChart svg").boundingBox();
  await page.locator("#dashboardDailyChart .dashboard-plot-scroll").dispatchEvent("pointermove", {
    pointerType: "mouse",
    clientX: barBox.x + barBox.width / 2,
    clientY: dailySvgBox.y + 18,
  });
  await expect(page.locator("#dashboardDailyChart .dashboard-crosshair")).not.toHaveAttribute("visibility", "hidden");
  await expect(page.locator("#dashboardDailyChart .dashboard-crosshair")).toHaveAttribute("x1", /\d/);
  await expect(dailyTime).toHaveText(date);
  await expect(dailyDetail).toContainText("计划新学");
  const dailyAfter = await dailyCard.boundingBox();
  expect(Math.abs(dailyAfter.height - dailyBefore.height)).toBeLessThan(1);
  await expect(page.locator(".dashboard-hover-tooltip")).toHaveCount(0);
  await expect(page.locator("#dashboardDailySummary")).toContainText("计划新学");
  await expect(page.locator("#dashboardDailySummary")).not.toContainText("（");
  await expect(page.locator(".dashboard-card-detail").first()).toHaveCSS("text-overflow", "clip");
  await expect(page.locator(".dashboard-card-detail").first()).toHaveCSS("white-space", "normal");
  await expect(page.locator(".dashboard-bar.dashboard-new").first()).toHaveCSS("fill", "rgb(104, 114, 125)");
  const lineFills = await page.evaluate(() => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "dashboard-svg");
    document.body.append(svg);
    const fills = [
      "dashboard-reinforce",
      "dashboard-review",
      "dashboard-hold-reinforce",
      "dashboard-hold-review",
    ].map((seriesClass) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("class", `dashboard-line ${seriesClass}`);
      line.setAttribute("points", "0,10 10,0 20,10");
      line.setAttribute("fill", "none");
      svg.append(line);
      const fill = getComputedStyle(line).fill;
      line.remove();
      return fill;
    });
    svg.remove();
    return fills;
  });
  expect(lineFills).toEqual(["none", "none", "none", "none"]);
  const dailyAxisLabels = await page.locator("#dashboardDailyChart .dashboard-axis-left span").allTextContents();
  expect(Number(dailyAxisLabels[0])).toBeGreaterThanOrEqual(Number(dailyAxisLabels.at(-1)));

  const poolPoint = page.locator("#dashboardPoolChart .dashboard-point").last();
  const poolPointBox = await poolPoint.boundingBox();
  const poolPlot = page.locator("#dashboardPoolChart .dashboard-plot-scroll");
  const poolSvgBox = await page.locator("#dashboardPoolChart svg").boundingBox();
  await poolPlot.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: poolPointBox.x + poolPointBox.width / 2,
    clientY: poolSvgBox.y + 18,
  });
  await expect(page.locator("#dashboardPoolChart .dashboard-crosshair")).not.toHaveAttribute("visibility", "hidden");
  const poolDetail = page.locator("#dashboardPoolHeading").locator("xpath=ancestor::article[1]")
    .locator(".dashboard-chart-detail-row .dashboard-card-detail");
  const poolTime = page.locator("#dashboardPoolHeading").locator("xpath=ancestor::article[1]")
    .locator(".dashboard-card-heading .dashboard-card-time");
  await expect(poolTime).toHaveText(date);
  await expect(poolDetail).not.toContainText(date);
  await expect(poolDetail).toContainText("待强化");
  await expect(poolDetail).toContainText("待复习");

  await page.setViewportSize({ width: 390, height: 844 });
  await poolPlot.scrollIntoViewIfNeeded();
  await poolPlot.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  const mobilePointBox = await poolPoint.boundingBox();
  const mobileSvgBox = await page.locator("#dashboardPoolChart svg").boundingBox();
  const mobileCard = page.locator("#dashboardPoolHeading").locator("xpath=ancestor::article[1]");
  const mobileBefore = await mobileCard.boundingBox();
  await poolPlot.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: mobilePointBox.x + mobilePointBox.width / 2,
    clientY: mobileSvgBox.y + 22,
  });
  await expect(page.locator("#dashboardPoolChart .dashboard-crosshair")).not.toHaveAttribute("visibility", "hidden");
  await expect(poolTime).toHaveText(date);
  const mobileAfter = await mobileCard.boundingBox();
  expect(Math.abs(mobileAfter.height - mobileBefore.height)).toBeLessThan(1);

  const compactDetails = await page.locator(
    "#dashboardDailyHeading, #dashboardPoolHeading, #dashboardConversionHeading, #dashboardHoldHeading",
  ).evaluateAll((headings) => headings.map((heading) => {
    const card = heading.closest(".dashboard-card");
    const row = card.querySelector(".dashboard-chart-detail-row");
    const detail = row.querySelector(".dashboard-card-detail");
    const chart = row.nextElementSibling;
    const lineTops = [...detail.querySelectorAll(".dashboard-detail-part")]
      .map((part) => Math.round(part.getBoundingClientRect().top));
    return {
      lines: new Set(lineTops).size,
      scrollHeight: row.scrollHeight,
      clientHeight: row.clientHeight,
      overflowY: getComputedStyle(row).overflowY,
      chartGap: Math.round(chart.getBoundingClientRect().top - row.getBoundingClientRect().bottom),
    };
  }));
  expect(compactDetails).toHaveLength(4);
  compactDetails.forEach((detail) => {
    expect(detail.lines).toBeGreaterThanOrEqual(1);
    expect(detail.lines).toBeLessThanOrEqual(2);
    expect(detail.scrollHeight).toBeLessThanOrEqual(detail.clientHeight + 1);
    expect(detail.overflowY).toBe("hidden");
  });
  expect(Math.max(...compactDetails.map((detail) => detail.chartGap)) -
    Math.min(...compactDetails.map((detail) => detail.chartGap))).toBeLessThanOrEqual(1);
});

test("hierarchy pages cover and reveal the home navigation as one parent layer", async ({ page }) => {
  await openFreshApp(page);
  await page.locator("#globalHomeNavButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiTransition ?? ""))
    .toBe("");
  await page.locator("#wordListButton").evaluate((button) => button.click());
  await expect(page.locator("html")).toHaveAttribute("data-ui-transition-scope", "hierarchy");
  await expect(page.locator("#mainAppNav")).toBeHidden();
  const enteringLayers = await page.evaluate(() => ({
    app: getComputedStyle(document.documentElement, "::view-transition-group(app-surface)").zIndex,
    navigation: getComputedStyle(document.documentElement, "::view-transition-group(app-navigation)").zIndex,
    incomingBackground: getComputedStyle(
      document.documentElement,
      "::view-transition-new(app-surface)",
    ).backgroundColor,
  }));
  expect(Number(enteringLayers.app)).toBeGreaterThan(Number(enteringLayers.navigation));
  expect(enteringLayers.incomingBackground).not.toBe("rgba(0, 0, 0, 0)");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiTransition ?? ""))
    .toBe("");

  await page.locator("#wordListBackButton").evaluate((button) => button.click());
  await expect(page.locator("html")).toHaveAttribute("data-ui-transition-scope", "hierarchy");
  await expect(page.locator("#mainAppNav")).toHaveCSS("pointer-events", "none");
  const leavingBackground = await page.evaluate(() => getComputedStyle(
    document.documentElement,
    "::view-transition-old(app-surface)",
  ).backgroundColor);
  expect(leavingBackground).not.toBe("rgba(0, 0, 0, 0)");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiTransition ?? ""))
    .toBe("");
  await expect(page.locator("#mainAppNav")).toBeVisible();
  await expect(page.locator("#mainAppNav")).not.toHaveCSS("pointer-events", "none");
});

test("Huawei ArkWeb uses live surfaces instead of snapshot transitions", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "userAgent", {
      configurable: true,
      get: () => "Mozilla/5.0 (Linux; HarmonyOS) AppleWebKit/537.36 ArkWeb/4.1 Mobile HuaweiBrowser/15.0",
    });
    const nativeStartViewTransition = document.startViewTransition?.bind(document);
    window.__nativeTransitionCalls = 0;
    if (nativeStartViewTransition) {
      document.startViewTransition = (update) => {
        window.__nativeTransitionCalls += 1;
        return nativeStartViewTransition(update);
      };
    }
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");

  await page.locator("#wordListButton").evaluate((button) => button.click());
  await expect(page.locator("html")).toHaveAttribute("data-ui-transition-mode", "lightweight");
  await expect(page.locator("#wordListPanel")).toBeVisible();
  await expect(page.locator(".ui-transition-fallback-overlay")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiTransition ?? ""))
    .toBe("");

  await page.locator("#wordListBackButton").evaluate((button) => button.click());
  await expect(page.locator("html")).toHaveAttribute("data-ui-transition-mode", "lightweight");
  await expect(page.locator("#homePanel")).toBeVisible();
  await expect(page.locator(".ui-transition-fallback-overlay")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiTransition ?? ""))
    .toBe("");
  expect(await page.evaluate(() => window.__nativeTransitionCalls)).toBe(0);
});

test("mobile Sankey heading and date range stay compact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshApp(page);
  const heading = page.locator(".dashboard-sankey-heading");
  await expect(heading.locator("h2")).toHaveCSS("white-space", "nowrap");
  const inputBoxes = await heading.locator(".dashboard-sankey-date-range input").evaluateAll((items) => (
    items.map((item) => item.getBoundingClientRect())
  ));
  expect(inputBoxes).toHaveLength(2);
  expect(Math.abs(inputBoxes[0].y - inputBoxes[1].y)).toBeLessThan(1);
});

test("Sankey unfolds the review regression into a final sink and keeps ribbons separated", async ({ page }) => {
  const date = await openSankeyFixture(page);
  const flows = page.locator("#dashboardSankeyChart .dashboard-sankey-flow");
  await expect(flows).toHaveCount(5);
  await expect(page.locator("#dashboardSankeyChart .dashboard-sankey-particles")).toHaveCount(5);
  expect(await page.locator("#dashboardSankeyChart .dashboard-sankey-particle").count()).toBeGreaterThanOrEqual(15);
  await expect(page.locator('#dashboardSankeyChart [data-flow-to="new"]')).toHaveCount(0);
  await expect(page.locator('#dashboardSankeyChart [data-flow-lane="direct"]')).toHaveCount(1);
  await expect(page.locator('#dashboardSankeyChart [data-flow-lane="forward"]')).toHaveCount(3);
  await expect(page.locator('#dashboardSankeyChart [data-flow-lane="return"]')).toHaveCount(1);

  const stationXs = await page.locator("#dashboardSankeyChart .dashboard-sankey-node").evaluateAll((nodes) => (
    nodes.map((node) => ({
      status: node.dataset.dashboardStatus,
      x: Number(node.getAttribute("x")),
    }))
  ));
  expect(stationXs.map((station) => station.status)).toEqual([
    "new", "reinforce", "review", "mastered", "reinforce",
  ]);
  expect(new Set(stationXs.map((station) => station.x)).size).toBe(4);
  const lowerLabels = await page.locator(
    '#dashboardSankeyChart [data-label-node="reinforce"], #dashboardSankeyChart [data-label-node="review"]',
  ).evaluateAll((labels) => labels.map((label) => {
    const node = label.ownerSVGElement.querySelector(`[data-node-id="${label.dataset.labelNode}"]`);
    return Number(label.getAttribute("y")) >
      Number(node.getAttribute("y")) + Number(node.getAttribute("height"));
  }));
  expect(lowerLabels).toEqual([true, true]);
  const terminalNodes = page.locator('#dashboardSankeyChart [data-node-id="mastered"], #dashboardSankeyChart [data-node-id="reinforce-return"]');
  await expect(terminalNodes).toHaveCount(2);
  const terminalXs = await terminalNodes.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("x")));
  expect(new Set(terminalXs).size).toBe(1);

  const separatedPorts = await page.locator("#dashboardSankeyChart").evaluate((chart) => {
    const flows = [...chart.querySelectorAll(".dashboard-sankey-flow")];
    const separated = (items, topKey) => items
      .map((flow) => ({
        top: Number(flow.dataset[topKey]),
        bottom: Number(flow.dataset[topKey]) + Number(flow.dataset.flowThickness),
      }))
      .sort((left, right) => left.top - right.top)
      .every((item, index, all) => index === 0 || item.top - all[index - 1].bottom >= 3.9);
    return [...chart.querySelectorAll(".dashboard-sankey-node")].every((node) => {
      const id = node.dataset.nodeId;
      return separated(flows.filter((flow) => flow.dataset.flowFrom === id), "flowSourceTop") &&
        separated(flows.filter((flow) => flow.dataset.flowTargetNode === id), "flowTargetTop");
    });
  });
  expect(separatedPorts).toBe(true);
  const newMasteredFlow = page.locator('#dashboardSankeyChart [data-flow-from="new"][data-flow-to="mastered"]');
  const newReinforceFlow = page.locator('#dashboardSankeyChart [data-flow-from="new"][data-flow-to="reinforce"]');
  await expect(newMasteredFlow).toHaveAttribute("fill", "#68727d");
  await expect(newMasteredFlow).toHaveAttribute("d", /Z$/);
  await expect(newMasteredFlow).not.toHaveAttribute("stroke");
  expect(Number(await newMasteredFlow.getAttribute("data-flow-thickness")))
    .toBeGreaterThan(Number(await newReinforceFlow.getAttribute("data-flow-thickness")));
  const particleColors = await page.locator("#dashboardSankeyChart .dashboard-sankey-particle")
    .evaluateAll((particles) => particles.map((particle) => particle.getAttribute("fill")));
  expect(particleColors.every((color) => color !== "#fff" && color !== "white")).toBe(true);

  const newMasteredRow = page.locator("#dashboardSankeySummary tbody tr")
    .filter({ hasText: "新学" })
    .filter({ hasText: "已掌握" });
  await expect(newMasteredRow).toContainText("2");
  await expect(newMasteredRow).toContainText("67%");
  const newReinforceRow = page.locator("#dashboardSankeySummary tbody tr")
    .filter({ hasText: "新学" })
    .filter({ hasText: "待强化" });
  await expect(newReinforceRow).toContainText("33%");
  await expect(page.locator("#dashboardSankeySummary tbody tr")).toHaveCount(5);

  const endDate = page.locator("#dashboardEndDate");
  const chart = page.locator("#dashboardSankeyChart");
  const detail = page.locator(".dashboard-sankey-detail-row .dashboard-card-detail");
  await expect(detail).toContainText("6 个义项发生状态流转");
  await expect(detail.locator(".dashboard-detail-part")).toHaveCount(1);
  await expect(detail).not.toContainText(date);
  await expect(page.locator("#dashboardSankeySummary")).toHaveCSS("width", "1px");
  const before = {
    end: await endDate.boundingBox(),
    chart: await chart.boundingBox(),
  };
  await newMasteredFlow.dispatchEvent("pointerenter", { pointerType: "mouse" });
  await expect(detail).toContainText("占新学流出 67%");
  const after = {
    end: await endDate.boundingBox(),
    chart: await chart.boundingBox(),
  };
  expect(Math.abs(after.end.y - before.end.y)).toBeLessThan(1);
  expect(Math.abs(after.chart.y - before.chart.y)).toBeLessThan(1);
});

test("mobile Sankey opens as a complete fitted graph and stays bounded while zooming and dragging", async ({ page }) => {
  await openSankeyFixture(page, { mobile: true });
  const frame = page.locator("#dashboardSankeyChart .dashboard-sankey-frame");
  const svg = page.locator("#dashboardSankeyChart .dashboard-sankey-svg");
  const initial = { frame: await frame.boundingBox(), svg: await svg.boundingBox() };
  expect(initial.svg.width).toBeLessThanOrEqual(initial.frame.width - 18);
  expect(initial.svg.x).toBeGreaterThanOrEqual(initial.frame.x + 8);
  expect(initial.svg.x + initial.svg.width).toBeLessThanOrEqual(initial.frame.x + initial.frame.width - 8);
  expect(initial.svg.y).toBeGreaterThanOrEqual(initial.frame.y + 8);
  expect(initial.svg.y + initial.svg.height).toBeLessThanOrEqual(initial.frame.y + initial.frame.height - 8);
  expect(Math.abs(
    (initial.svg.y + initial.svg.height / 2) - (initial.frame.y + initial.frame.height / 2),
  )).toBeLessThan(2);

  const zoomIn = frame.getByRole("button", { name: "放大流转图" });
  const zoomOut = frame.getByRole("button", { name: "缩小流转图" });
  await zoomIn.click();
  expect((await svg.boundingBox()).width).toBeGreaterThan(initial.svg.width);
  for (let index = 0; index < 12; index += 1) await zoomIn.click();
  const maxScale = await frame.getAttribute("data-sankey-max-scale");
  await expect(frame).toHaveAttribute("data-sankey-scale", maxScale);

  const frameBox = await frame.boundingBox();
  await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(frameBox.x + 2400, frameBox.y + 1800, { steps: 4 });
  await page.mouse.up();
  let movedSvg = await svg.boundingBox();
  expect(movedSvg.x + movedSvg.width).toBeGreaterThan(frameBox.x + 8);
  expect(movedSvg.y + movedSvg.height).toBeGreaterThan(frameBox.y + 8);

  await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(frameBox.x - 2400, frameBox.y - 1800, { steps: 4 });
  await page.mouse.up();
  movedSvg = await svg.boundingBox();
  expect(movedSvg.x).toBeLessThan(frameBox.x + frameBox.width - 8);
  expect(movedSvg.y).toBeLessThan(frameBox.y + frameBox.height - 8);

  for (let index = 0; index < 20; index += 1) await zoomOut.click();
  const minScale = await frame.getAttribute("data-sankey-min-scale");
  await expect(frame).toHaveAttribute("data-sankey-scale", minScale);
});

test("dashboard keeps sense and word status counts isolated", async ({ page }) => {
  await page.goto(APP_URL);
  const today = new Date();
  const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  await page.evaluate(({ date }) => {
    const key = "sense-vocab-mvp-kaoyan-plan-v1";
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 2,
      activeBookId: "kaoyan",
      bookStates: {
        kaoyan: {
          introducedWords: ["act"],
          progress: {
            "act:v-1": { status: "mastered", updatedAt: new Date().toISOString() },
            "act:n-3": { status: "reinforce", updatedAt: new Date().toISOString() },
          },
          dashboardSnapshots: {
            [`kaoyan:${date}`]: {
              id: `kaoyan:${date}`,
              bookId: "kaoyan",
              date,
              observedAt: new Date().toISOString(),
              statuses: { "act:v-1": "mastered", "act:n-3": "reinforce" },
              enteredAt: {},
            },
          },
          dashboardEvents: {
            [`${date}|act:v-1|new|mastered`]: { date, senseId: "act:v-1", from: "new", to: "mastered", source: "new" },
          },
        },
      },
    }));
  }, { date });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  await expect(page.locator("#dashboardStatusBar .dashboard-status-segment").nth(0)).toHaveText("");
  await expect(page.locator("#dashboardStatusBar .dashboard-status-segment").nth(2)).toHaveText("");
  await page.locator("#dashboardUnitSelect").selectOption("word");
  await expect(page.locator("#dashboardStatusBar .dashboard-status-segment").nth(0)).toHaveAttribute("aria-label", /0/);
  await expect(page.locator("#dashboardStatusBar .dashboard-status-segment").nth(2)).toHaveAttribute("aria-label", /0/);
  await expect(page.locator("#dashboardStatusBar .dashboard-status-segment").nth(3)).toHaveAttribute("aria-label", /新学|待新学/);
  await expect(page.locator("#dashboardConversionSummary")).toContainText("新学 → 掌握");
  await page.locator("#dashboardStartDate").fill(date);
  await page.locator("#dashboardEndDate").fill(date);
  await page.locator("#dashboardEndDate").dispatchEvent("change");
  await expect(page.locator("#dashboardSankeyChart")).not.toContainText("\u6240\u9009\u65f6\u95f4\u6682\u65e0\u72b6\u6001\u53d8\u5316");
  await expect(page.locator("#dashboardSankeySummary")).toContainText("\u65b0\u5b66");
  await expect(page.locator("#dashboardSankeySummary")).toContainText("\u5df2\u638c\u63e1");
  await expect(page.locator("#dashboardSankeySummary")).toContainText("1");

  const yesterday = new Date(`${date}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const priorDate = [
    yesterday.getFullYear(),
    String(yesterday.getMonth() + 1).padStart(2, "0"),
    String(yesterday.getDate()).padStart(2, "0"),
  ].join("-");
  await page.locator("#dashboardStartDate").fill(priorDate);
  await page.locator("#dashboardStartDate").dispatchEvent("change");
  await expect(page.locator("#dashboardSankeySummary")).toContainText("\u65b0\u5b66");
  await expect(page.locator("#dashboardSankeySummary")).toContainText("\u5df2\u638c\u63e1");
  const conversionPoint = page.locator("#dashboardConversionChart .dashboard-new-mastered").first();
  await conversionPoint.focus();
  const conversionDetail = page.locator("#dashboardConversionHeading")
    .locator("xpath=ancestor::article[1]")
    .locator(".dashboard-card-detail");
  await expect(conversionDetail).toContainText("新学 → 掌握");
  await expect(conversionDetail).not.toContainText("new");
});

test("dashboard carries state pools across idle days and uses reliable conversion outcomes", async ({ page }) => {
  await page.goto(APP_URL);
  const day = (offset) => {
    const value = new Date();
    value.setHours(12, 0, 0, 0);
    value.setDate(value.getDate() + offset);
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  };
  const today = day(0);
  const yesterday = day(-1);
  const prior = day(-2);
  const entered = `${day(-12)}T08:00:00.000Z`;
  await page.evaluate(({ today, yesterday, prior, entered }) => {
    localStorage.clear();
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({
      schemaVersion: 2,
      activeBookId: "kaoyan",
      bookStates: {
        kaoyan: {
          view: "home",
          plan: { dailyTarget: 45, startedOn: prior },
          introducedWords: ["act", "action"],
          progress: {
            "act:n-3": { status: "reinforce", statusEnteredAt: entered, lastSeenActual: prior },
            "action:n-2": { status: "review", statusEnteredAt: entered, lastSeenActual: prior },
          },
          activityLog: {
            [yesterday]: {
              newWords: [],
              reviewWords: [],
              newCount: 45,
              reviewCount: 57,
              target: 45,
              baseCompleted: false,
            },
          },
          studyWindows: [{
            id: "completed-window",
            activityDate: yesterday,
            startedAt: `${yesterday}T08:00:00.000Z`,
            endedAt: `${yesterday}T10:00:00.000Z`,
            endedDate: yesterday,
            endedReason: "completed",
          }],
          dashboardSnapshots: {
            [`kaoyan:${prior}`]: {
              id: `kaoyan:${prior}`,
              bookId: "kaoyan",
              date: prior,
              observedAt: `${prior}T12:00:00.000Z`,
              statuses: { "act:n-3": "reinforce", "action:n-2": "review" },
              enteredAt: { "act:n-3": entered, "action:n-2": entered },
            },
          },
          dashboardEvents: {
            success: {
              id: "success", date: today, senseId: "act:n-4",
              from: "reinforce", to: "review", source: "reinforcement",
              observedAt: `${today}T08:00:00.000Z`, outcome: true,
            },
            retry: {
              id: "retry", date: today, senseId: "action:n-2",
              from: "reinforce", to: "reinforce", source: "reinforcement",
              observedAt: `${today}T08:01:00.000Z`, outcome: true,
            },
            newMastered: {
              id: "new-mastered", date: today, senseId: "act:v-1",
              from: "new", to: "mastered", source: "new",
              observedAt: `${today}T08:02:00.000Z`, outcome: true,
            },
            reviewMastered: {
              id: "review-mastered", date: today, senseId: "action:n-1",
              from: "review", to: "mastered", source: "review",
              observedAt: `${today}T08:03:00.000Z`, outcome: true,
            },
          },
        },
      },
    }));
  }, { today, yesterday, prior, entered });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");

  const completedDayColor = await page.locator(`#heatmapGrid [data-date="${yesterday}"]`)
    .evaluate((element) => element.style.getPropertyValue("--heat-color").trim());
  expect(completedDayColor).toBe("#49a96d");

  await page.locator("#globalDashboardNavButton").click();
  await expect(page.locator("#dashboardPoolChart .dashboard-point.dashboard-reinforce"))
    .toHaveCount(3);
  await expect(page.locator("#dashboardPoolChart .dashboard-point.dashboard-review"))
    .toHaveCount(3);
  await expect(page.locator("#dashboardHoldChart .dashboard-point.dashboard-hold-reinforce"))
    .toHaveCount(3);
  const reinforceConversionPoints = page.locator("#dashboardConversionChart .dashboard-point.dashboard-reinforce-review");
  expect(await reinforceConversionPoints.count()).toBeGreaterThan(3);
  await expect(reinforceConversionPoints.first())
    .toHaveAttribute("data-dashboard-tooltip", /0\/0（按 0% 计）/);
  await expect(reinforceConversionPoints.last())
    .toHaveAttribute("data-dashboard-tooltip", /1\/2（50%）/);

  const colors = await page.evaluate(() => {
    const pointColor = (selector) => getComputedStyle(document.querySelector(selector)).stroke;
    const dotColor = (selector) => getComputedStyle(document.querySelector(selector)).backgroundColor;
    return {
      newMastered: pointColor("#dashboardConversionChart .dashboard-new-mastered"),
      reinforceReview: pointColor("#dashboardConversionChart .dashboard-reinforce-review"),
      reviewMastered: pointColor("#dashboardConversionChart .dashboard-review-mastered"),
      reinforceLegend: dotColor("#dashboardConversionSummary .dashboard-reinforce-review"),
    };
  });
  expect(colors.newMastered).not.toBe(colors.reviewMastered);
  expect(colors.reinforceReview).toBe(colors.reinforceLegend);
});

test("historical pools replay recorded changes instead of stale reconstructed snapshots", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-15T20:00:00+08:00"));
  await page.goto(APP_URL);
  await page.evaluate(() => {
    localStorage.clear();
    const statuses = { "act:n-3": "reinforce", "action:n-2": "review" };
    const enteredAt = Object.fromEntries(Object.keys(statuses).map((key) => [key, "2026-09-25T08:00:00+08:00"]));
    const snapshot = (date, quality, time) => ({
      id: `kaoyan:${date}`, bookId: "kaoyan", date, quality,
      observedAt: `${date}T${time}+08:00`, statuses, enteredAt,
    });
    const events = [
      ["2026-10-11", "act:n-3", "reinforce", "review", "10:00:00"],
      ["2026-10-11", "action:n-2", "review", "mastered", "11:00:00"],
      ["2026-10-12", "act:n-3", "review", "reinforce", "10:00:00"],
      // A failed confirmation is an outcome, not a new state-entry time.
      ["2026-10-13", "act:n-3", "reinforce", "reinforce", "12:00:00"],
      // Cross-midnight activity belongs to its study date, but the pool moves
      // when the transition actually happened, not on the preceding date.
      ["2026-10-13", "act:n-3", "reinforce", "review", "00:15:00", "2026-10-14"],
    ];
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({
      schemaVersion: 2, activeBookId: "kaoyan", bookStates: { kaoyan: {
        introducedWords: ["act", "action"],
        progress: {
          "act:n-3": { status: "review", statusEnteredAt: "2026-10-14T00:15:00+08:00", lastSeenActual: "2026-10-13" },
          "action:n-2": { status: "mastered", statusEnteredAt: "2026-10-11T11:00:00+08:00", masteredOnActual: "2026-10-11" },
          "act:n-4": { status: "review", statusEnteredAt: "2026-10-12T09:00:00+08:00", lastSeenActual: "2026-10-12" },
        },
        dashboardSnapshots: {
          "kaoyan:2026-10-10": snapshot("2026-10-10", "exact", "20:00:00"),
          "kaoyan:2026-10-11": snapshot("2026-10-11", "exact", "08:00:00"),
          "kaoyan:2026-10-12": {
            ...snapshot("2026-10-12", "reconstructed", "23:59:59.999"),
            // Legacy imports can have a reliable derived record without events.
            statuses: { ...statuses, "act:n-4": "review" },
            enteredAt: { ...enteredAt, "act:n-4": "2026-10-12T09:00:00+08:00" },
          },
        },
        dashboardEvents: Object.fromEntries(events.map(([date, senseId, from, to, time, observedDate], index) => [
          `event-${index}`, { id: `event-${index}`, date, senseId, from, to,
            observedAt: `${observedDate ?? date}T${time}+08:00`, outcome: true },
        ])),
      } },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  const point = (chart, series, date) => page.locator(
    `#${chart} .dashboard-point.${series}[data-dashboard-tooltip^="${date}"]`,
  );
  await expect(point("dashboardPoolChart", "dashboard-reinforce", "2026-10-11"))
    .toHaveAttribute("data-dashboard-tooltip", /待强化 0/);
  await expect(point("dashboardPoolChart", "dashboard-review", "2026-10-11"))
    .toHaveAttribute("data-dashboard-tooltip", /待复习 1/);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiTransition ?? ""))
    .toBe("");
  await page.locator("#dashboardPoolHeading").locator("xpath=ancestor::article[1]")
    .screenshot({ path: ".op-cache/evidence/history-pool-mobile.png" });
  await page.locator("#dashboardHoldHeading").locator("xpath=ancestor::article[1]")
    .screenshot({ path: ".op-cache/evidence/history-hold-mobile.png" });
  await expect(point("dashboardPoolChart", "dashboard-review", "2026-10-12"))
    .toHaveAttribute("data-dashboard-tooltip", /待复习 1/);
  await expect(point("dashboardHoldChart", "dashboard-hold-review", "2026-10-11"))
    .toHaveAttribute("data-dashboard-tooltip", /平均 0\.6 天/);
  await expect(point("dashboardHoldChart", "dashboard-hold-reinforce", "2026-10-13"))
    .toHaveAttribute("data-dashboard-tooltip", /平均 1\.6 天/);
  await expect(point("dashboardPoolChart", "dashboard-reinforce", "2026-10-14"))
    .toHaveAttribute("data-dashboard-tooltip", /待强化 0/);
  await expect(point("dashboardPoolChart", "dashboard-review", "2026-10-14"))
    .toHaveAttribute("data-dashboard-tooltip", /待复习 2/);
  await page.evaluate(() => window.SenseVocabApp.repairDerivedData());
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  await expect(point("dashboardPoolChart", "dashboard-review", "2026-10-11"))
    .toHaveAttribute("data-dashboard-tooltip", /待复习 1/);
});

test("manual repair upgrades legacy-only pool history without shifting midnight or resetting residence", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-15T20:00:00+08:00"));
  await page.goto(APP_URL);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({
      schemaVersion: 2, activeBookId: "kaoyan", bookStates: { kaoyan: {
        introducedWords: ["act", "action"],
        progress: {
          "act:n-3": { status: "review", statusEnteredAt: "2026-10-14T00:15:00+08:00", lastSeenActual: "2026-10-13" },
          "action:n-2": { status: "review", statusEnteredAt: "2026-10-09T08:00:00+08:00", lastSeenActual: "2026-10-14" },
        },
        activityLog: { "2026-10-10": { newWords: ["act"], target: 1, baseCompleted: true } },
        dashboardSnapshots: { "kaoyan:2026-10-10": {
          id: "kaoyan:2026-10-10", bookId: "kaoyan", date: "2026-10-10", quality: "reconstructed",
          observedAt: "2026-10-10T23:59:59.999+08:00",
          statuses: { "act:n-3": "reinforce", "action:n-2": "review" },
          enteredAt: { "act:n-3": "2026-10-08T08:00:00+08:00", "action:n-2": "2026-10-09T08:00:00+08:00" },
        } },
        dashboardEvents: {
          repeated: { id: "repeated", date: "2026-10-11", senseId: "act:n-3", from: "reinforce", to: "reinforce",
            observedAt: "2026-10-11T12:00:00+08:00", outcome: true },
          midnight: { id: "midnight", date: "2026-10-13", senseId: "act:n-3", from: "reinforce", to: "review",
            observedAt: "2026-10-13T16:15:00Z", outcome: true },
        },
      } },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalSettingsNavButton").click();
  await page.locator("#dataButton").click();
  await page.locator("#repairDataButton").click();
  await expect(page.locator("#dataMessage")).toContainText("已按当前学习记录重建");
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  const point = (chart, series, date) => page.locator(
    `#${chart} .dashboard-point.${series}[data-dashboard-tooltip^="${date}"]`,
  );
  await expect(point("dashboardPoolChart", "dashboard-reinforce", "2026-10-10"))
    .toHaveAttribute("data-dashboard-tooltip", /待强化 1/);
  await expect(point("dashboardHoldChart", "dashboard-hold-reinforce", "2026-10-13"))
    .toHaveAttribute("data-dashboard-tooltip", /平均 5\.7 天/);
  await expect(point("dashboardPoolChart", "dashboard-review", "2026-10-13"))
    .toHaveAttribute("data-dashboard-tooltip", /待复习 1/);
  await expect(point("dashboardPoolChart", "dashboard-review", "2026-10-14"))
    .toHaveAttribute("data-dashboard-tooltip", /待复习 2/);
  expect(await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.activityLog["2026-10-10"].baseCompleted))
    .toBe(true);
});

test("sealed learning stores the final pool before returning home and preserves it across days", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    window.Date = class TestDate extends NativeDate {
      constructor(...args) {
        if (args.length) super(...args);
        else super(localStorage.getItem("dashboard-test-clock") || "2026-10-11T20:00:00+08:00");
      }
      static now() { return new this().getTime(); }
    };
  });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true");
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await page.locator("#revealButton").click();
  await page.locator('[data-key="act:v-1"]').click();
  await expect(page.locator("#senseList")).not.toHaveClass(/is-reordering/);
  await page.locator("#nextButton").click();
  await expect(page.locator("#nextButton")).toHaveText("下一词");
  await page.locator("#nextButton").click();
  await expect(page.locator("#cardMode")).toHaveText("强化");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("强化");
  const beforeFinalStage = await page.evaluate(() => window.SenseVocabApp.getState());
  await page.locator("#revealButton").click();
  await page.locator('[data-key="act:v-2"]').click();
  await expect(page.locator("#senseList")).not.toHaveClass(/is-reordering/);
  await page.locator("#nextButton").click();
  await expect(page.locator("#nextButton")).toHaveText("下一词");
  await page.locator("#nextButton").click();
  await expect(page.locator("#nextButton")).toHaveText("返回主页");
  await expect.poll(() => page.evaluate(() => {
    const scope = window.SenseVocabApp.getGuestState().bookStates.kaoyan;
    return scope.dashboardSnapshots["kaoyan:2026-10-11"]?.statuses["act:v-2"];
  })).toBe("review");
  const vector = await page.evaluate(() => {
    const scope = window.SenseVocabApp.getGuestState().bookStates.kaoyan;
    return scope._sync?.records?.dashboardSnapshots?.["kaoyan:2026-10-11"]?.vector;
  });
  expect(vector).not.toEqual(beforeFinalStage.bookStates.kaoyan._sync?.records?.dashboardSnapshots?.["kaoyan:2026-10-11"]?.vector);
  expect(await page.evaluate((previous) => {
    const app = window.SenseVocabApp;
    return app.buildSyncDelta(previous, app.getState())?.books?.kaoyan?.maps?.dashboardSnapshots
      ?.upsert?.["kaoyan:2026-10-11"]?.statuses?.["act:v-2"];
  }, beforeFinalStage)).toBe("review");
  await expect(page.locator("#studyPanel")).toBeVisible();
  await page.evaluate(() => localStorage.setItem("dashboard-test-clock", "2026-10-12T20:00:00+08:00"));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  await expect(page.locator('#dashboardPoolChart .dashboard-review[data-dashboard-tooltip^="2026-10-11"]'))
    .toHaveAttribute("data-dashboard-tooltip", /待复习 1/);
});

test("word pools count existence independently and measure continuous membership", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-15T20:00:00+08:00"));
  await page.goto(APP_URL);
  await page.evaluate(() => {
    localStorage.clear();
    const statuses = {
      "act:v-1": "reinforce", "act:n-3": "reinforce", "act:v-2": "review",
      "action:n-1": "reinforce", "action:n-2": "review",
    };
    const enteredAt = {
      "act:v-1": "2026-10-01T00:00:00+08:00", "act:n-3": "2026-10-05T00:00:00+08:00",
      "act:v-2": "2026-10-02T00:00:00+08:00", "action:n-1": "2026-10-09T00:00:00+08:00",
      "action:n-2": "2026-10-09T00:00:00+08:00",
    };
    const progress = Object.fromEntries(Object.entries(statuses).map(([key, status]) => [
      key, { status, statusEnteredAt: enteredAt[key] },
    ]));
    const transitions = [
      ["2026-10-11", "act:v-1", "reinforce", "mastered"],
      ["2026-10-12", "act:n-3", "reinforce", "mastered"],
      ["2026-10-13", "act:n-4", "new", "reinforce"],
    ];
    transitions.forEach(([date, key, from, to]) => {
      progress[key] = { status: to, statusEnteredAt: `${date}T00:00:00+08:00` };
    });
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({
      schemaVersion: 2, activeBookId: "kaoyan", bookStates: { kaoyan: {
        introducedWords: ["act", "action"], progress,
        dashboardSnapshots: { "kaoyan:2026-10-10": {
          id: "kaoyan:2026-10-10", bookId: "kaoyan", date: "2026-10-10", quality: "exact",
          observedAt: "2026-10-10T20:00:00+08:00", statuses, enteredAt,
        } },
        dashboardEvents: Object.fromEntries(transitions.map(([date, senseId, from, to], index) => [
          `change-${index}`, { id: `change-${index}`, date, senseId, from, to,
            observedAt: `${date}T00:00:00+08:00` },
        ])),
      } },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  const point = (chart, series, date) => page.locator(
    `#${chart} .dashboard-point.${series}[data-dashboard-tooltip^="${date}"]`,
  );
  await expect(point("dashboardPoolChart", "dashboard-reinforce", "2026-10-10"))
    .toHaveAttribute("data-dashboard-tooltip", /待强化 3/);
  await expect(point("dashboardHoldChart", "dashboard-hold-reinforce", "2026-10-11"))
    .toHaveAttribute("data-dashboard-tooltip", /平均 5\.0 天/);
  await page.locator("#dashboardUnitSelect").selectOption("word");
  await expect(point("dashboardPoolChart", "dashboard-reinforce", "2026-10-10"))
    .toHaveAttribute("data-dashboard-tooltip", /待强化 2/);
  await expect(point("dashboardPoolChart", "dashboard-review", "2026-10-10"))
    .toHaveAttribute("data-dashboard-tooltip", /待复习 2/);
  await expect(point("dashboardHoldChart", "dashboard-hold-reinforce", "2026-10-11"))
    .toHaveAttribute("data-dashboard-tooltip", /平均 7\.0 天/);
  await expect(point("dashboardHoldChart", "dashboard-hold-reinforce", "2026-10-13"))
    .toHaveAttribute("data-dashboard-tooltip", /平均 3\.0 天/);
  await expect(point("dashboardHoldChart", "dashboard-hold-reinforce", "2026-10-15"))
    .toHaveAttribute("data-dashboard-tooltip", /平均 4\.8 天/);
});

test("time-series axes follow the visible horizontal window", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP_URL);
  const day = (offset) => {
    const value = new Date();
    value.setHours(12, 0, 0, 0);
    value.setDate(value.getDate() + offset);
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  };
  const today = day(0);
  const oldest = day(-89);
  await page.evaluate(({ today, oldest }) => {
    localStorage.clear();
    localStorage.setItem("sense-vocab-mvp-kaoyan-plan-v1", JSON.stringify({
      schemaVersion: 2,
      activeBookId: "kaoyan",
      bookStates: {
        kaoyan: {
          view: "home",
          plan: { dailyTarget: 45, startedOn: oldest },
          introducedWords: ["act", "action"],
          activityLog: {
            [oldest]: { newWords: ["act"], reviewWords: [], target: 500 },
            [today]: { newWords: ["action"], reviewWords: [], target: 45 },
          },
          dashboardEvents: {
            oldestSuccess: {
              id: "oldest-success", date: oldest, senseId: "act:n-3",
              from: "reinforce", to: "review", source: "reinforcement",
              observedAt: `${oldest}T08:00:00.000Z`, outcome: true,
            },
            recentSuccess: {
              id: "recent-success", date: today, senseId: "act:n-3",
              from: "reinforce", to: "review", source: "reinforcement",
              observedAt: `${today}T08:00:00.000Z`, outcome: true,
            },
            recentRetry: {
              id: "recent-retry", date: today, senseId: "action:n-2",
              from: "reinforce", to: "reinforce", source: "reinforcement",
              observedAt: `${today}T08:01:00.000Z`, outcome: true,
            },
          },
        },
      },
    }));
  }, { today, oldest });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.vocabularyReady === "true");
  await page.locator("#globalDashboardNavButton").click();
  await page.locator("#dashboardRangeSelect").selectOption("90");
  await page.locator("#dashboardUnitSelect").selectOption("word");

  const dailyPlot = page.locator("#dashboardDailyChart .dashboard-plot-scroll");
  const conversionPlot = page.locator("#dashboardConversionChart .dashboard-plot-scroll");
  const dailyTop = page.locator("#dashboardDailyChart .dashboard-axis-left span").first();
  const conversionTop = page.locator("#dashboardConversionChart .dashboard-axis-left span").first();
  await expect(dailyTop).toHaveText("45");
  await expect(conversionTop).toHaveText("50");

  await dailyPlot.evaluate((element) => { element.scrollLeft = 0; });
  await conversionPlot.evaluate((element) => { element.scrollLeft = 0; });
  await expect(dailyTop).toHaveText("500");
  await expect(conversionTop).toHaveText("100");
});

test("study surface clips card content and keeps navigation outside study view", async ({ page }) => {
  await openFreshApp(page);
  await page.locator("#globalHomeNavButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#studyPanel")).toBeVisible();
  await expect(page.locator("#mainAppNav")).toBeHidden();

  const desktopLayout = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box && { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    };
    const panel = document.querySelector("#studyPanel");
    const viewport = document.querySelector("#studyCardViewport");
    const actions = document.querySelector("#studyPanel .study-actions");
    const panelBox = panel.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    return {
      panel: rect("#studyPanel"),
      viewport: rect("#studyCardViewport"),
      actions: rect("#studyPanel .study-actions"),
      panelInViewport: panelBox.top >= 0 && panelBox.bottom <= innerHeight,
      actionAfterViewport: actionsBox.top >= viewportBox.bottom,
      viewportScrollable: getComputedStyle(viewport).overflowY === "auto",
      actionPosition: getComputedStyle(actions).position,
      transitionOverlay: [...document.querySelectorAll(".ui-transition-fallback-overlay.is-card")]
        .map((element) => ({
          overflow: getComputedStyle(element).overflow,
          contain: getComputedStyle(element).contain,
        })),
    };
  });
  expect(desktopLayout.panelInViewport).toBe(true);
  expect(desktopLayout.actionAfterViewport).toBe(true);
  expect(desktopLayout.viewportScrollable).toBe(true);
  expect(desktopLayout.actionPosition).toBe("relative");
  expect(desktopLayout.transitionOverlay).toEqual([]);

  await page.locator("#revealButton").click();
  await expect(page.locator("#senseArea")).toBeVisible();
  const scrollMetrics = await page.locator("#studyCardViewport").evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  await page.locator("#studyCardViewport").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const configuredHeight = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height"),
    );
    return Math.abs(configuredHeight - innerHeight) <= 1;
  });
  const mobileLayout = await page.evaluate(() => {
    const panel = document.querySelector("#studyPanel").getBoundingClientRect();
    const actions = document.querySelector("#studyPanel .study-actions").getBoundingClientRect();
    const viewport = document.querySelector("#studyCardViewport").getBoundingClientRect();
    const word = document.querySelector("#wordText").getBoundingClientRect();
    return {
      panelInViewport: panel.top >= 0 && panel.bottom <= innerHeight,
      actionAfterViewport: actions.top >= viewport.bottom,
      actionPosition: getComputedStyle(document.querySelector("#studyPanel .study-actions")).position,
      wordSingleLine: word.height <= Number.parseFloat(getComputedStyle(document.querySelector("#wordText")).fontSize) * 1.25,
      documentWidthFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    };
  });
  expect(mobileLayout.panelInViewport).toBe(true);
  expect(mobileLayout.actionAfterViewport).toBe(true);
  expect(mobileLayout.actionPosition).toBe("relative");
  expect(mobileLayout.wordSingleLine).toBe(true);
  expect(mobileLayout.documentWidthFits).toBe(true);
});

test("floating dialogs cover navigation and expand from the trigger", async ({ page }) => {
  await openFreshApp(page);
  await page.locator("#globalHomeNavButton").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  const triggerCenter = await page.locator("#planButton").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });

  await page.locator("#planButton").click();
  await expect(page.locator("#planDialog")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/has-floating-dialog/);
  await expect(page.locator("#modalLayer > #planDialog")).toHaveCount(1);
  await expect(page.locator("#modalLayer > .modal-backdrop")).toHaveCount(
    await page.locator(".modal-backdrop").count(),
  );

  const metrics = await page.evaluate(({ triggerCenter }) => {
    const backdrop = document.querySelector("#planDialog");
    const surface = backdrop.querySelector(".reset-dialog");
    const nav = document.querySelector("#mainAppNav");
    const navRect = nav.getBoundingClientRect();
    const topAtNav = document.elementFromPoint(
      navRect.left + navRect.width / 2,
      navRect.top + navRect.height / 2,
    );
    const backdropRect = backdrop.getBoundingClientRect();
    const finalSurfaceLeft = backdropRect.left + (backdrop.clientWidth - surface.offsetWidth) / 2;
    const finalSurfaceTop = backdropRect.top + (backdrop.clientHeight - surface.offsetHeight) / 2;
    const surfaceStyle = getComputedStyle(surface);
    const animation = surface.getAnimations().find((item) => {
      return item.animationName === "modal-drop-expand";
    });
    const keyframes = animation?.effect?.getKeyframes?.() ?? [];
    const firstFrame = keyframes[0] ?? {};
    const lastFrame = keyframes.at(-1) ?? {};
    return {
      backdropZ: Number.parseInt(getComputedStyle(backdrop).zIndex, 10),
      navZ: Number.parseInt(getComputedStyle(nav).zIndex, 10),
      navBackdropFilter: getComputedStyle(nav).backdropFilter,
      navBackgroundColor: getComputedStyle(nav).backgroundColor,
      navViewTransitionName: getComputedStyle(nav).viewTransitionName,
      navInert: nav.inert,
      appInert: document.querySelector("#appShell").inert,
      modalCoversNav: backdrop.contains(topAtNav),
      originX: Number.parseFloat(surfaceStyle.getPropertyValue("--modal-origin-x")),
      originY: Number.parseFloat(surfaceStyle.getPropertyValue("--modal-origin-y")),
      expectedX: triggerCenter.x - finalSurfaceLeft,
      expectedY: triggerCenter.y - finalSurfaceTop,
      animationName: surfaceStyle.animationName,
      animationDuration: surfaceStyle.animationDuration,
      animationTimingFunction: surfaceStyle.animationTimingFunction,
      keyframeCount: keyframes.length,
      initialClipPath: firstFrame.clipPath ?? "",
      initialTransform: firstFrame.transform ?? "",
      finalTransform: lastFrame.transform ?? "",
    };
  }, { triggerCenter });

  expect(metrics.backdropZ).toBeGreaterThan(metrics.navZ);
  expect(metrics.navBackdropFilter).toContain("blur(16px)");
  expect(metrics.navBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(metrics.navViewTransitionName).toBe("app-navigation");
  expect(metrics.navInert).toBe(true);
  expect(metrics.appInert).toBe(true);
  expect(metrics.modalCoversNav).toBe(true);
  expect(Math.abs(metrics.originX - metrics.expectedX)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(metrics.originY - metrics.expectedY)).toBeLessThanOrEqual(1.5);
  expect(metrics.animationName).toBe("modal-drop-expand");
  expect(metrics.animationDuration).toBe("0.36s");
  expect(metrics.animationTimingFunction).toBe("cubic-bezier(0.2, 0.8, 0.2, 1)");
  expect(metrics.keyframeCount).toBe(2);
  expect(metrics.initialClipPath).toBe("");
  expect(metrics.initialTransform).toContain("scale(0.08)");
  expect(metrics.finalTransform).toContain("scale(1)");

  const synchronizedScale = await page.locator("#planDialog .reset-dialog").evaluate((surface) => {
    const animation = surface.getAnimations().find((item) => item.animationName === "modal-drop-expand");
    animation.pause();
    animation.currentTime = 140;
    const child = surface.querySelector("h2");
    const surfaceRatio = surface.getBoundingClientRect().width / surface.offsetWidth;
    const childRatio = child.getBoundingClientRect().width / child.offsetWidth;
    return {
      clipPath: getComputedStyle(surface).clipPath,
      surfaceRatio,
      childRatio,
    };
  });
  expect(synchronizedScale.clipPath).toBe("none");
  expect(synchronizedScale.surfaceRatio).toBeGreaterThan(0.08);
  expect(synchronizedScale.surfaceRatio).toBeLessThan(1);
  expect(Math.abs(synchronizedScale.surfaceRatio - synchronizedScale.childRatio)).toBeLessThan(0.03);

  await page.locator("#cancelPlanButton").click();
  await expect(page.locator("#planDialog")).toBeHidden();
  await expect(page.locator("html")).not.toHaveClass(/has-floating-dialog/);
  await expect.poll(() => page.locator("#mainAppNav").evaluate((nav) => nav.inert)).toBe(false);
  await expect(page.locator("#mainAppNav")).not.toHaveCSS("backdrop-filter", "none");
});

test("account, notifications, and feedback controls stay above the inert navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshApp(page);

  const assertTopmost = async (buttonSelector) => {
    const button = page.locator(buttonSelector);
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    expect(await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return {
        topmost: element === top || element.contains(top),
        insideViewport: rect.bottom <= innerHeight && rect.top >= 0,
        navInert: document.querySelector("#mainAppNav").inert,
      };
    })).toEqual({ topmost: true, insideViewport: true, navInert: true });
  };

  const openDialog = async (selector) => {
    await page.evaluate((targetSelector) => {
      window.senseVocabModalMotion.open(document.querySelector(targetSelector));
    }, selector);
    await expect(page.locator(selector)).toBeVisible();
  };

  await openDialog("#accountDialog");
  await assertTopmost("#closeAccountButton");
  await page.locator("#closeAccountButton").click();

  await openDialog("#notificationsDialog");
  await assertTopmost("#closeNotificationsButton");
  await page.locator("#closeNotificationsButton").click();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("sensevocab:open-feedback", { detail: { context: null } }));
  });
  await expect(page.locator("#accountDialog")).toBeVisible();
  await assertTopmost("#closeAccountButton");
});
