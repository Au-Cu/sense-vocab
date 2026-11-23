const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const bundle = require("../data/vocabulary-bundle.json");
const index = require("../data/vocabulary-index.json");
const { computePackedLayout } = require("../word-universe.js");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";
const VERSION = "0123456789abcdef";
const STORAGE_KEY = "sense-vocab-mvp-kaoyan-plan-v1";
test.use({ launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } });

// Synthetic transport fixture, explicitly test-only.  Stable IDs and the
// three WordNet sense pairs below are taken from the real vocabulary bundle.
function fixture() {
  const names = ["quit", "cease", "depart", "bank", "shore", "bark", "form", "shape", "act", "reform"];
  const tiles = { quit: "3-3", cease: "6-5", depart: "1-5", bank: "2-2", bark: "2-2" };
  const nodes = names.map((id, i) => {
    const word = bundle.words.find((entry) => entry.id === id);
    const tile = tiles[id] || "4-4";
    const [x, y] = tile.split("-").map(Number);
    const position = [(x - 3.5) * 375 + (i % 3) * 8, (y - 3.5) * 375 + (i % 4) * 8];
    return { id, word: word.word, complete: true, spellingSupported: true,
      semanticPlacement: id === "quit" ? "estimated-from-frozen-anchors" : "initial",
      semantic: position, spelling: position,
      semanticTile: tile, spellingTile: tile,
      senses: word.senses.map((sense) => ({ id: sense.id, pos: sense.pos, synsetId: sense.synsetId,
        verified: Boolean(sense.synsetId), frequency: "observed-positive", weight: 1 / word.senses.length })) };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const relationships = { synonym: new Map(), spelling: new Map() };
  const add = (kind, a, b, forward, reverse) => {
    for (const [id, edge] of [[a, { to: b, ...forward }], [b, { to: a, ...reverse }]]) {
      const list = relationships[kind].get(id) || [];
      list.push(edge); relationships[kind].set(id, list);
    }
  };
  for (const [a, sa, b, sb, synset] of [
    ["quit", "v-1", "depart", "v-1", "omw-en-02008396-v"],
    ["quit", "v-3", "cease", "v-1", "omw-en-02680814-v"],
    ["form", "n-1", "shape", "n-1", "omw-en-05930736-n"],
  ]) {
    expect(byId.get(a).senses.find((sense) => sense.id === sa).synsetId).toBe(synset);
    expect(byId.get(b).senses.find((sense) => sense.id === sb).synsetId).toBe(synset);
    add("synonym", a, b, { sourceSense: sa, targetSense: sb, synset, cosine: 0.9 },
      { sourceSense: sb, targetSense: sa, synset, cosine: 0.9 });
  }
  add("spelling", "bank", "bark", { distance: 1 }, { distance: 1 });
  for (const node of nodes) {
    node.synonymNeighborCount = new Set((relationships.synonym.get(node.id) || []).map((edge) => edge.to)).size;
    node.spellingNeighborCount = new Set((relationships.spelling.get(node.id) || []).map((edge) => edge.to)).size;
  }
  const shards = {};
  for (const kind of ["synonym", "spelling"]) {
    for (const node of nodes) {
      const tile = node[kind === "synonym" ? "semanticTile" : "spellingTile"];
      const key = `${kind}/${tile}`;
      shards[key] ||= { schema: 1, version: VERSION, kind, tile, adjacency: {} };
      shards[key].adjacency[node.id] = relationships[kind].get(node.id) || [];
    }
  }
  return { manifest: { schema: 1, version: VERSION, index: `./${VERSION}/index.json`, bundleSha256: index.bundleVersion },
    map: { schema: 1, version: VERSION, bundleSha256: index.bundleVersion, nodes }, shards };
}

async function mockMaps(page, options = {}) {
  const data = fixture();
  if (options.mismatchCounts) data.map.nodes.find((node) => node.id === "quit").synonymNeighborCount = 3;
  let failed = false;
  const requests = [];
  await page.route("**/data/universes/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    requests.push(pathname);
    if (options.failOnce && !failed && pathname.endsWith("manifest.json")) {
      failed = true; await route.fulfill({ status: 503, body: "test failure" }); return;
    }
    if (pathname.endsWith("manifest.json")) {
      const manifest = options.badVersion ? { ...data.manifest, bundleSha256: "0".repeat(64) } : data.manifest;
      await route.fulfill({ json: manifest }); return;
    }
    if (pathname.endsWith("index.json")) { await route.fulfill({ json: data.map }); return; }
    const match = pathname.match(/\/(synonym|spelling)\/(\d-\d)\.json$/);
    const shard = match && data.shards[`${match[1]}/${match[2]}`];
    if (shard) await route.fulfill({ json: shard }); else await route.fulfill({ status: 404 });
  });
  return requests;
}

async function openApp(page, { theme = "classic", color = "light" } = {}) {
  await page.addInitScript(({ theme, color }) => {
    localStorage.clear();
    localStorage.setItem("sense-vocab-tutorial-complete-v1:guest", "completed");
    localStorage.setItem("sense-vocab-ui-theme-v1", theme);
    localStorage.setItem("sense-vocab-color-mode-v1", color);
    const NativeDate = Date;
    const noon = new NativeDate(); noon.setHours(12, 0, 0, 0);
    window.__universeTestNow = noon.getTime();
    class TestDate extends NativeDate { constructor(...args) { super(...(args.length ? args : [window.__universeTestNow])); } static now() { return window.__universeTestNow; } }
    window.Date = TestDate;
  }, { theme, color });
  await page.goto(APP_URL);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true" && document.documentElement.dataset.accountReady === "true");
  await expect(page.locator("html")).toHaveAttribute("data-vocabulary-ready", "true", { timeout: 30000 });
}

async function search(page, word) {
  await page.locator("#universeSearch").fill(word);
  await page.getByRole("button", { name: word, exact: true }).click();
  await expect(page.locator(".universe-selection-heading h2")).toHaveText(word);
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-camera-moving", "false");
}

test("home search opens filtered word list and retains the query", async ({ page }) => {
  await openApp(page);
  const searchInput = page.locator("#homePanel #wordSearchInput");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("act");
  await searchInput.press("Enter");
  await expect(page.locator("#wordListPanel")).toBeVisible();
  await expect(page.locator('.word-list-item[data-word-id="act"]')).toBeVisible();
  await expect(page.locator("#wordSearchInput")).toHaveValue("act");
  await page.locator("#wordListBackButton").click();
  await expect(page.locator("#homePanel #wordSearchInput")).toHaveValue("act");
});

test("home search is first and universe entry labels are centered", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  const layout = await page.evaluate(() => {
    const search = document.querySelector("#homeWordSearchForm").getBoundingClientRect();
    const plan = document.querySelector("#todayPlanHeading").getBoundingClientRect();
    const buttons = [...document.querySelectorAll(".universe-entry button")].map((button) => {
      const range = document.createRange(); range.selectNodeContents(button);
      const text = range.getBoundingClientRect(), box = button.getBoundingClientRect();
      return Math.abs((text.left + text.right) / 2 - (box.left + box.right) / 2);
    });
    return { searchTop: search.top, planTop: plan.top, centers: buttons };
  });
  expect(layout.searchTop).toBeLessThan(layout.planTop);
  expect(layout.centers).toHaveLength(2);
  expect(Math.max(...layout.centers)).toBeLessThan(2);
});

test("visible spelling planets do not overlap in a dense overview", async ({ page }) => {
  await page.addInitScript(() => {
    window.__mapShapes = [];
    const originalClear = CanvasRenderingContext2D.prototype.clearRect;
    const originalArc = CanvasRenderingContext2D.prototype.arc;
    const originalRect = CanvasRenderingContext2D.prototype.rect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.classList.contains("universe-canvas")) window.__mapShapes = [];
      return originalClear.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.arc = function (x, y, radius, start, end, ...rest) {
      if (this.canvas.classList.contains("universe-canvas") && start === 0 && end === Math.PI * 2) {
        window.__mapShapes.push({ x, y, radius });
      }
      return originalArc.call(this, x, y, radius, start, end, ...rest);
    };
    CanvasRenderingContext2D.prototype.rect = function (x, y, width, height) {
      if (this.canvas.classList.contains("universe-canvas")) {
        window.__mapShapes.push({ x: x + width / 2, y: y + height / 2, radius: Math.hypot(width, height) / 2 });
      }
      return originalRect.call(this, x, y, width, height);
    };
  });
  await mockMaps(page); await openApp(page);
  await page.locator("#openSpellingUniverse").click();
  await expect.poll(() => page.evaluate(() => window.__mapShapes.length)).toBeGreaterThan(1);
  const collisions = await page.evaluate(() => {
    const shapes = window.__mapShapes;
    let count = 0;
    for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i], b = shapes[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) + 0.05 < a.radius + b.radius) count++;
    }
    return count;
  });
  expect(collisions).toBe(0);
});

test("every real planet keeps a strict shared gap in both complete maps", () => {
  const manifest = require("../data/universes/manifest.json");
  const { nodes } = require(`../data/universes/${manifest.version}/index.json`);
  for (const kind of ["synonym", "spelling"]) {
    const { positions, gap } = computePackedLayout(nodes, kind);
    const cells = new Map();
    const size = 25;
    let violations = 0;
    expect(positions.length).toBe(nodes.length * 3);
    expect(gap).toBeGreaterThan(0);
    for (let i = 0; i < nodes.length; i++) {
      const x = positions[i * 3], y = positions[i * 3 + 1], radius = positions[i * 3 + 2];
      const cx = Math.floor(x / size), cy = Math.floor(y / size);
      if (!(radius > 0)) violations++;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const other of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (!(Math.hypot(x - other.x, y - other.y) > radius + other.radius + gap)) violations++;
        }
      }
      const key = `${cx},${cy}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ x, y, radius });
    }
    expect(violations).toBe(0);
  }
});

test("a card shows its word and direct relations before the remaining map", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(...args) { setTimeout(() => super.postMessage(...args), 1800); }
    };
  });
  await mockMaps(page); await openApp(page);
  await page.locator("#wordSearchInput").fill("bank");
  await page.locator("#wordSearchInput").press("Enter");
  await page.locator('.word-list-item[data-word-id="bank"]').click();
  await page.locator("#wordSpellingUniverse").click();
  await expect(page.locator(".universe-selection-heading h2")).toHaveText("bank");
  await expect(page.locator(".universe-relation")).toContainText("bark");
  const canvas = page.locator(".universe-canvas");
  await expect(canvas).toHaveAttribute("data-layout-phase", "focus");
  await expect(canvas).toHaveAttribute("data-indexed-words", "2");
  await expect(canvas).toHaveAttribute("data-index-ready", "true", { timeout: 10000 });
  await expect(canvas).toHaveAttribute("data-indexed-words", "10");
  await expect(page.locator(".universe-relation")).toContainText("bark");
});

test("selected relations remain visible and interactive when zoomed out", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockMaps(page); await openApp(page);
  await page.locator("#openSynonymUniverse").click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true");
  await search(page, "quit");
  await expect(page.locator(".universe-relation")).toHaveCount(2);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "缩小" }).click();
  const canvas = page.locator(".universe-canvas");
  await expect.poll(async () => Number(await canvas.getAttribute("data-camera-zoom"))).toBeLessThan(1);
  await expect(canvas).toHaveAttribute("data-focus-strength", "1.00");
  await expect.poll(async () => Number(await canvas.getAttribute("data-visible-lines"))).toBe(2);
  await expect.poll(async () => Number(await canvas.getAttribute("data-visible-labels"))).toBeGreaterThan(0);
});

test("specific senses filter real-identity relations and cross-region jumps without changing progress", async ({ page }) => {
  const requests = await mockMaps(page);
  await openApp(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator("#openSynonymUniverse").click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true");
  await search(page, "quit");
  await page.locator(".universe-info summary").click();
  await expect(page.locator(".universe-info")).toContainText("估计或占位");
  await expect(page.locator(".universe-relation")).toHaveCount(2);
  await page.locator(".universe-sense-select").selectOption("v-3");
  await expect(page.locator(".universe-relation")).toHaveCount(1);
  await expect(page.locator(".universe-relation")).toContainText("cease");
  await page.locator(".universe-sense-select").selectOption("all");
  const positions = fixture().map.nodes;
  const layout = computePackedLayout(positions, "synonym").positions;
  const sourceIndex = positions.findIndex((node) => node.id === "quit") * 3;
  const targetIndex = positions.findIndex((node) => node.id === "depart") * 3;
  const source = [layout[sourceIndex], layout[sourceIndex + 1]];
  const target = [layout[targetIndex], layout[targetIndex + 1]];
  const canvas = page.locator(".universe-canvas");
  await expect(canvas).toHaveAttribute("data-camera-moving", "false");
  const camera = await canvas.evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight,
    x: Number(element.dataset.cameraX), y: Number(element.dataset.cameraY), zoom: Number(element.dataset.cameraZoom) }));
  const unit = Math.min(camera.width, camera.height) / 3000 * camera.zoom;
  const project = ([x, y]) => ({ x: camera.width / 2 + (x - camera.x) * unit, y: camera.height / 2 + (y - camera.y) * unit });
  const from = project(source), to = project(target);
  expect(to.x).toBeGreaterThan(0); expect(to.x).toBeLessThan(camera.width);
  expect(to.y).toBeGreaterThan(0); expect(to.y).toBeLessThan(camera.height);
  const marks = positions.map((_, i) => project([layout[i * 3], layout[i * 3 + 1]]));
  const point = Array.from({ length: 17 }, (_, i) => (i + 2) / 20)
    .map((t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }))
    .find((p) => p.x > 5 && p.x < camera.width - 5 && p.y > 5 && p.y < camera.height - 5 &&
      marks.every((mark) => Math.hypot(mark.x - p.x, mark.y - p.y) > 10));
  expect(point).toBeTruthy();
  await canvas.click({ position: point });
  await expect(page.locator(".universe-edge-detail")).toContainText("omw-en-02008396-v");
  await page.getByRole("button", { name: "前往 depart" }).click();
  await expect(page.locator(".universe-selection-heading h2")).toHaveText("depart");
  await expect.poll(() => requests.some((url) => url.endsWith("/synonym/1-5.json"))).toBe(true);
  await page.locator(".universe-back").click();
  await expect(page.locator("#homePanel")).toBeVisible();
  await expect(page.locator("#openSynonymUniverse")).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
});

test("bank keeps distinct meanings and spelling edges are never presented as synonym edges", async ({ page }) => {
  await mockMaps(page); await openApp(page);
  await page.locator("#openSynonymUniverse").click(); await search(page, "bank");
  await expect(page.locator(".universe-sense-select")).toContainText("银行");
  await expect(page.locator(".universe-sense-select")).toContainText("河边");
  await expect(page.locator(".universe-selection")).toContainText("暂无可核验的关系");
  await expect(page.locator(".universe-relation")).toHaveCount(0);
  await page.getByRole("button", { name: "形近词", exact: true }).click();
  await expect(page.locator(".universe-relation")).toContainText("bark");
  await page.locator(".universe-relation").click();
  await expect(page.locator(".universe-edge-detail")).toContainText("不代表含义相近");
});

test("star size follows distinct recorded neighbors and changes with universe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockMaps(page); await openApp(page);
  await page.locator("#openSynonymUniverse").click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true");
  await search(page, "quit");
  await expect(page.locator(".universe-relation")).toHaveCount(2);
  const canvas = page.locator(".universe-canvas");
  await expect.poll(async () => Number(await canvas.getAttribute("data-selected-radius"))).toBeGreaterThan(0);
  const worldRadius = async () => Number(await canvas.getAttribute("data-selected-radius")) /
    Number(await canvas.getAttribute("data-camera-zoom"));
  const withTwoNeighbors = await worldRadius();
  await search(page, "bank");
  await expect(page.locator(".universe-relation")).toHaveCount(0);
  await expect.poll(worldRadius).toBeLessThan(withTwoNeighbors);
  await page.getByRole("button", { name: "形近词", exact: true }).click();
  await expect(page.locator(".universe-relation")).toHaveCount(1);
  await expect(page.locator(".universe-relation")).not.toContainText("拼写编辑距离");
});

test("mismatched recorded neighbor count fails safely", async ({ page }) => {
  await mockMaps(page, { mismatchCounts: true }); await openApp(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator("#openSynonymUniverse").click();
  await search(page, "quit");
  await expect(page.locator(".universe-loading")).toContainText("关系加载失败");
  await expect(page.getByRole("button", { name: "重试关系" })).toBeVisible();
  await page.locator(".universe-back").click();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
});

test("failed or stale map fails safely and a transient failure can be retried", async ({ page }) => {
  await mockMaps(page, { failOnce: true }); await openApp(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator("#openSynonymUniverse").click();
  await expect(page.locator(".universe-loading")).toContainText("加载失败");
  await page.getByRole("button", { name: "重新加载地图" }).click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true");
  await page.locator(".universe-back").click();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
});

test("mismatched vocabulary versions are rejected instead of misbinding senses", async ({ page }) => {
  await mockMaps(page, { badVersion: true }); await openApp(page);
  await page.locator("#openSynonymUniverse").click();
  await expect(page.locator(".universe-loading")).toContainText("版本不匹配");
  await expect(page.locator(".universe-relation")).toHaveCount(0);
});

test("an unavailable map script offers a safe retry without changing progress", async ({ page }) => {
  await mockMaps(page);
  let first = true;
  await page.route("**/word-universe.js?*", async (route) => {
    if (first) { first = false; await route.abort(); } else await route.continue();
  });
  await openApp(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator("#openSynonymUniverse").click();
  await expect(page.getByRole("status").filter({ hasText: "地图组件未加载" })).toBeVisible();
  await page.getByRole("button", { name: "重试加载" }).click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true");
  await page.locator(".universe-back").click();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
});

test("study entry returns to the same card and preserves the learning record", async ({ page }) => {
  await mockMaps(page); await openApp(page);
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText("act");
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator("#wordSynonymUniverse").click();
  await expect(page.locator(".universe-selection-heading h2")).toHaveText("act");
  await page.locator(".universe-back").click();
  await expect(page.locator("#wordText")).toHaveText("act");
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
});

test("book and account overlays remain separate, including a partially mastered word", async ({ page }) => {
  await mockMaps(page); await openApp(page);
  const guestBefore = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator("#openSynonymUniverse").click();
  await search(page, "bank");
  await expect(page.locator(".universe-selection-status")).toHaveText("0 / 2 义项已掌握");
  await page.evaluate(() => {
    const app = window.SenseVocabApp;
    const account = structuredClone(app.getGuestState());
    const progress = { ...account.bookStates.kaoyan.progress,
      "bank:n-1": { status: "mastered" }, "bank:n-2": { status: "reinforce" } };
    account.bookStates.kaoyan.progress = progress;
    account.progress = progress;
    app.activateAccount("universe-test-user", account);
  });
  await expect(page.locator("#homePanel")).toBeVisible();
  await page.locator("#openSynonymUniverse").click(); await search(page, "bank");
  await expect(page.locator(".universe-selection-status")).toHaveText("1 / 2 义项已掌握");
  await expect(page.locator(".universe-sense-select")).toContainText("已掌握");
  await expect(page.locator(".universe-sense-select")).toContainText("待强化");
  await page.evaluate(() => window.SenseVocabApp.activateGuest());
  await expect(page.locator("#homePanel")).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(guestBefore);

  await page.locator("#planButton").click();
  await page.locator("#bookSelect").selectOption("ielts");
  await page.locator("#dailyTargetInput").fill("10");
  await page.locator("#savePlanButton").click();
  await page.locator("#openSynonymUniverse").click(); await search(page, "shore");
  await expect(page.locator(".universe-selection-status")).toHaveText("当前词书外");
  await expect(page.locator(".universe-sense-select")).toContainText("词书外");
});

test("a map left open across midnight preserves normal session rollover", async ({ page }) => {
  await mockMaps(page); await openApp(page);
  const before = await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.session.date);
  await page.locator("#openSynonymUniverse").click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true");
  const after = await page.evaluate(() => {
    window.__universeTestNow += 24 * 60 * 60 * 1000;
    window.render();
    return window.SenseVocabApp.getState().bookStates.kaoyan.session.date;
  });
  expect(after).not.toBe(before);
  await page.locator(".universe-back").click();
  await expect(page.locator("#homePanel")).toBeVisible();
});

test("an active study window remains resumable across midnight with the map open", async ({ page }) => {
  await mockMaps(page); await openApp(page);
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#wordText")).toHaveText("act");
  const before = await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.session.date);
  await page.locator("#wordSynonymUniverse").click();
  await expect(page.locator(".universe-selection-heading h2")).toHaveText("act");
  const after = await page.evaluate(() => {
    window.__universeTestNow += 24 * 60 * 60 * 1000;
    window.render();
    return window.SenseVocabApp.getState().bookStates.kaoyan.session.date;
  });
  expect(after).toBe(before);
  await page.locator(".universe-back").click();
  await expect(page.locator("#wordText")).toHaveText("act");
});

test("opening a map during sense confirmation preserves the new-to-reinforcement flow", async ({ page }) => {
  await mockMaps(page); await openApp(page);
  await page.locator("#planButton").click();
  await page.locator("#dailyTargetInput").fill("1");
  await page.locator("#savePlanButton").click();
  await page.locator("#startStudyButton").click();
  await page.locator("#revealButton").click();
  await page.locator('[data-key="act:v-1"]').click();
  await expect(page.locator("#newCount")).toHaveText("1/4");
  const before = await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.progress);
  await page.locator("#wordSynonymUniverse").click();
  await expect(page.locator(".universe-selection-heading h2")).toHaveText("act");
  await page.locator(".universe-back").click();
  expect(await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.progress)).toEqual(before);
  await expect(page.locator("#newCount")).toHaveText("1/4");
  const next = page.locator("#nextButton");
  if (!/^(下一词|返回主页)$/.test(await next.textContent())) await next.click();
  await expect(next).toHaveText(/^(下一词|返回主页)$/);
  if ((await next.textContent()) === "下一词") await next.click();
  await expect(page.locator("#cardMode")).toHaveText("强化");
  await expect(page.locator("#wordText")).toHaveText("act");
});

test("map navigation does not change incremental or advance-study queues", async ({ page }) => {
  await mockMaps(page); await openApp(page);
  const seed = await page.evaluate(() => {
    const now = new Date();
    const date = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    const today = date(now), tomorrow = date(new Date(now.getTime() + 86400000));
    return { view: "home", plan: { dailyTarget: 1, startedOn: today, createdOn: today, updatedOn: today, advancedDays: 0 },
      session: { date: today, queue: [], currentIndex: 0, revealed: false, cardPhase: "hidden", baseNewAdded: true,
        baseCompleted: true, activeBatchType: "planned", activePlanDate: today, extraBatches: 0, advanceBatches: 0,
        advanceShiftCommitted: false, reinforcementAdded: true, reinforcedKeys: [] },
      introducedWords: ["act"], progress: { "act:v-1": { status: "reinforce", misses: 1, dueDate: tomorrow, firstSeen: today, lastSeen: today, masteredOn: null },
        "act:v-2": { status: "review", misses: 0, dueDate: tomorrow, firstSeen: today, lastSeen: today, masteredOn: null } } };
  });
  const restore = async () => expect(await page.evaluate((value) => window.SenseVocabApp.replaceActiveState(value,
    { notify: false, stampSync: false, syncRelevant: false }), seed)).toBe(true);
  await restore();
  await page.locator("#startStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("增量");
  const incrementalWord = await page.locator("#wordText").textContent();
  const incrementalQueue = await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.session.queue);
  await page.locator("#wordSpellingUniverse").click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true");
  await page.locator(".universe-back").click();
  await expect(page.locator("#wordText")).toHaveText(incrementalWord);
  expect(await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.session.queue)).toEqual(incrementalQueue);

  await restore();
  await page.locator("#advanceStudyButton").click();
  await expect(page.locator("#cardMode")).toHaveText("复习");
  await expect(page.locator("#wordText")).toHaveText("act");
  const advance = await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.session);
  await page.locator("#wordSynonymUniverse").click();
  await expect(page.locator(".universe-selection-heading h2")).toHaveText("act");
  await page.locator(".universe-back").click();
  expect(await page.evaluate(() => window.SenseVocabApp.getState().bookStates.kaoyan.session)).toEqual(advance);
});

test("real complete candidate graph loads and navigates across regions", async ({ page }) => {
  test.skip(process.env.SENSE_VOCAB_UNIVERSE_REALDATA !== "1", "requires locally generated and not-yet-distributed candidate data");
  await page.setViewportSize({ width: 1400, height: 1000 });
  await openApp(page);
  const started = Date.now();
  await page.locator("#openSynonymUniverse").click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true", { timeout: 30000 });
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-total-words", "6607");
  const loadedMs = Date.now() - started;
  await search(page, "quit");
  await expect(page.locator(".universe-relation").filter({ hasText: "depart" })).toBeVisible();
  await expect(page.locator(".universe-relation").filter({ hasText: "cease" })).toBeVisible();
  await page.locator(".universe-sense-select").selectOption("v-3");
  await expect(page.locator(".universe-relation")).toHaveCount(1);
  await expect(page.locator(".universe-relation")).toContainText("cease");
  await page.locator(".universe-relation").first().click();
  await page.getByRole("button", { name: "前往 cease" }).click();
  await expect(page.locator(".universe-selection-heading h2")).toHaveText("cease");
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-camera-moving", "false");
  const network = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => entry.name.includes("/data/universes/"))
    .map((entry) => ({ name: new URL(entry.name).pathname.split("/").slice(-2).join("/"), bytes: entry.transferSize, ms: Math.round(entry.duration) })));
  console.log(JSON.stringify({ realGraphLoadedMs: loadedMs, resources: network }));
  fs.mkdirSync(path.resolve(__dirname, "../.test-artifacts"), { recursive: true });
  await page.screenshot({ path: path.resolve(__dirname, "../.test-artifacts/universe-real-desktop.png"), fullPage: true });
});

test("real candidate graph remains usable in phone viewport and dark liquid glass", async ({ browser }) => {
  test.skip(process.env.SENSE_VOCAB_UNIVERSE_REALDATA !== "1", "requires locally generated candidate data");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  await openApp(page, { theme: "liquid-glass", color: "dark" });
  const started = Date.now();
  await page.locator("#openSpellingUniverse").click();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true", { timeout: 30000 });
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-total-words", "6607");
  const loadedMs = Date.now() - started;
  await search(page, "bank");
  await expect(page.locator(".universe-relation").filter({ hasText: "bark" })).toBeVisible();
  await expect(page.locator(".universe-canvas")).toBeVisible();
  await expect(page.locator(".universe-canvas")).toHaveAttribute("data-focus-strength", "1.00");
  await expect.poll(async () => Number(await page.locator(".universe-canvas").getAttribute("data-visible-lines"))).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  console.log(JSON.stringify({ realPhoneGraphLoadedMs: loadedMs, note: "local desktop Chrome emulating a phone; not physical-device network timing" }));
  fs.mkdirSync(path.resolve(__dirname, "../.test-artifacts"), { recursive: true });
  await page.screenshot({ path: path.resolve(__dirname, "../.test-artifacts/universe-real-phone.png"), fullPage: true });
  await context.close();
});

test("camera eases, stops drawing when idle, and honours reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mockMaps(page); await openApp(page);
  await page.locator("#openSynonymUniverse").click();
  const canvas = page.locator(".universe-canvas");
  await expect(canvas).toHaveAttribute("data-index-ready", "true");
  await page.evaluate(() => {
    const canvas = document.querySelector(".universe-canvas");
    window.__cameraMotionStates = [];
    const observer = new MutationObserver(() => window.__cameraMotionStates.push(canvas.dataset.cameraMoving));
    observer.observe(canvas, { attributes: true, attributeFilter: ["data-camera-moving"] });
  });
  await search(page, "quit");
  expect(await page.evaluate(() => window.__cameraMotionStates)).toContain("true");
  expect(await page.evaluate(() => window.__cameraMotionStates)).toContain("false");
  await page.evaluate(() => {
    const target = document.querySelector(".universe-canvas");
    const prototype = CanvasRenderingContext2D.prototype;
    const original = prototype.clearRect;
    window.__universeDrawCount = 0;
    prototype.clearRect = function (...args) {
      if (this.canvas === target) window.__universeDrawCount += 1;
      return original.apply(this, args);
    };
  });
  await page.waitForTimeout(350);
  const idleCount = await page.evaluate(() => window.__universeDrawCount);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__universeDrawCount)).toBe(idleCount);
  await canvas.focus(); await page.keyboard.press("ArrowRight");
  await expect.poll(() => page.evaluate(() => window.__universeDrawCount)).toBeGreaterThan(idleCount);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { window.__cameraMotionStates.length = 0; });
  await search(page, "bank");
  expect(await page.evaluate(() => window.__cameraMotionStates)).not.toContain("true");
});

test("overview recedes through real word points without synthetic clusters", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mockMaps(page); await openApp(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator("#openSynonymUniverse").click();
  const canvas = page.locator(".universe-canvas");
  await expect(canvas).toHaveAttribute("data-rendered-words", "10");
  await expect(canvas).toHaveAttribute("data-aggregate-count", "0");
  await search(page, "quit");
  const observed = page.evaluate(() => new Promise((resolve) => {
    const samples = [], start = performance.now(); let wasMoving = false;
    function step(now) {
      const data = document.querySelector(".universe-canvas").dataset;
      wasMoving ||= data.cameraMoving === "true";
      samples.push({ zoom: Number(data.cameraZoom), aggregateCount: Number(data.aggregateCount) });
      if ((wasMoving && data.cameraMoving === "false") || now - start > 3000) resolve(samples);
      else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }));
  await page.getByRole("button", { name: "全局总览" }).click();
  const samples = await observed;
  await expect(canvas).toHaveAttribute("data-camera-zoom", "1.0000");
  await expect(canvas).toHaveAttribute("data-rendered-words", "10");
  expect(samples.every((sample) => sample.aggregateCount === 0)).toBeTruthy();
  expect(new Set(samples.map((sample) => sample.zoom.toFixed(2))).size).toBeGreaterThan(5);
  expect(Math.max(...samples.map((sample) => sample.zoom))).toBeGreaterThan(1.2);
  await page.locator(".universe-back").click();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
});

for (const spec of [
  { name: "desktop-light-classic", width: 1440, height: 1000, theme: "classic", color: "light" },
  { name: "phone-dark-glass", width: 390, height: 844, theme: "liquid-glass", color: "dark", touch: true },
]) {
  test(`${spec.name} offers visible, nonempty, keyboard-operable map without horizontal overflow`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, hasTouch: !!spec.touch, reducedMotion: "reduce" });
    const page = await context.newPage(); await mockMaps(page); await openApp(page, spec);
    await page.locator("#openSynonymUniverse").click();
    await expect(page.locator(".universe-canvas")).toHaveAttribute("data-index-ready", "true");
    const canvas = page.locator(".universe-canvas"); await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate((el) => {
      const data = el.getContext("2d").getImageData(0, 0, el.width, el.height).data;
      let count = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
      return count;
    })).toBeGreaterThan(20);
    await canvas.focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("+");
    if (spec.touch) {
      await canvas.scrollIntoViewIfNeeded();
      const bounds = await canvas.boundingBox();
      const before = await canvas.evaluate((element) => element.toDataURL());
      const client = await context.newCDPSession(page);
      const midX = bounds.x + bounds.width / 2, midY = bounds.y + bounds.height / 2;
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: midX - 30, y: midY, id: 1 }, { x: midX + 30, y: midY, id: 2 }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: midX - 65, y: midY, id: 1 }, { x: midX + 65, y: midY, id: 2 }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(() => canvas.evaluate((element) => element.toDataURL())).not.toBe(before);
      await client.detach();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(spec.width + 1);
    await search(page, "quit");
    fs.mkdirSync(path.resolve(__dirname, "../.test-artifacts"), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, `../.test-artifacts/universe-${spec.name}.png`), fullPage: true });
    await context.close();
  });
}
