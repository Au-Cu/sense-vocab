const { test, expect } = require("@playwright/test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173/";

test.use({
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  viewport: { width: 1100, height: 850 },
});

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8"));
}

function contentId(word, sense, field) {
  return `${word.id}:${sense.id}:${field}`;
}

test("public attribution catalog covers every traceable runtime audio and example", () => {
  const bundleBytes = fs.readFileSync(
    path.join(ROOT_DIR, "data/vocabulary-bundle.json"),
  );
  const bundle = JSON.parse(bundleBytes.toString("utf8"));
  const catalog = readJson("data/public-attributions.json");
  const rightsSummary = readJson("data/content-rights-ledger-summary.json");
  expect(catalog.bundleSha256).toBe(
    crypto.createHash("sha256").update(bundleBytes).digest("hex"),
  );

  const expected = { audio: new Set(), tatoeba: new Set(), wiktionary: new Set() };
  const unique = { audio: new Set(), tatoeba: new Set(), wiktionary: new Set() };
  const unresolved = { semcor: 0, quotation: 0, semantic: 0 };
  for (const word of bundle.words) {
    for (const sense of word.senses ?? []) {
      const source = String(sense.exampleSource ?? "").toLowerCase();
      if (sense.audio) {
        expected.audio.add(contentId(word, sense, "audio"));
        unique.audio.add(sense.audio);
      }
      if (source === "tatoeba") {
        expected.tatoeba.add(contentId(word, sense, "example"));
        unique.tatoeba.add(String(sense.exampleSourceId));
      }
      if (
        (source.includes("wiktionary") || source.includes("kaikki")) &&
        !source.startsWith("semantic-")
      ) {
        expected.wiktionary.add(contentId(word, sense, "example"));
        unique.wiktionary.add(String(sense.exampleSourceId));
      }
      if (source === "semcor") unresolved.semcor += 1;
      if (source.includes("quotation")) unresolved.quotation += 1;
      if (source.startsWith("semantic-")) unresolved.semantic += 1;
    }
  }

  const actual = { audio: new Set(), tatoeba: new Set(), wiktionary: new Set() };
  for (const entry of catalog.entries) {
    expect(entry.author).toBeTruthy();
    expect(entry.license).toBeTruthy();
    expect(entry.licenseUrl).toMatch(/^https?:\/\//);
    expect(entry.sourcePage).toMatch(/^https?:\/\//);
    expect(entry.modification).toBeTruthy();
    if (entry.kind === "audio") {
      expect(entry.provider).toBe("Wikimedia Commons");
      entry.references.forEach((item) => actual.audio.add(item.contentId));
    } else if (entry.provider === "Tatoeba") {
      expect(entry.sourceId).toBeTruthy();
      expect(entry.authorStatus).toBeTruthy();
      entry.references.forEach((item) => actual.tatoeba.add(item.contentId));
    } else {
      expect(entry.provider).toBe("Wiktionary / Kaikki");
      expect(entry.historyPage).toContain("action=history");
      expect(entry.copyrightPage).toContain("Wiktionary:Copyrights");
      expect(entry.specialAttribution).toContain("modified by Sense Vocab");
      entry.references.forEach((item) => actual.wiktionary.add(item.contentId));
    }
  }

  expect([...actual.audio].sort()).toEqual([...expected.audio].sort());
  expect([...actual.tatoeba].sort()).toEqual([...expected.tatoeba].sort());
  expect([...actual.wiktionary].sort()).toEqual([...expected.wiktionary].sort());
  expect(catalog.summary).toMatchObject({
    audioBindings: expected.audio.size,
    audioAssets: unique.audio.size,
    tatoebaBindings: expected.tatoeba.size,
    tatoebaAssets: unique.tatoeba.size,
    wiktionaryBindings: expected.wiktionary.size,
    wiktionaryAssets: unique.wiktionary.size,
    semcorUnresolved: unresolved.semcor,
    quotationUnresolved: unresolved.quotation,
    semanticUnresolved: unresolved.semantic,
    commercialReleaseBlockers: rightsSummary.counts.BLOCKER,
  });
  expect(catalog.notices.wordnet.copyright).toContain(
    "Copyright 2006 by Princeton University",
  );
  expect(catalog.notices.wiktionary.conditions).toContain("相同方式共享");
  expect(catalog.notices.unresolved.conditions).toContain("BLOCKER");
});

test("public source directory is searchable without login on desktop and mobile", async ({ page }) => {
  await page.goto(APP_URL);
  await page.waitForFunction(() => (
    document.documentElement.dataset.accountReady === "true"
  ));
  await page.locator("#moreButton").click();
  await expect(page.locator(".legal-link-button")).toHaveAttribute(
    "href",
    "./legal.html",
  );

  await page.goto(`${APP_URL}legal.html#sources`);
  await expect(page.locator("#sourceCatalogSummary")).toContainText(
    "1,747 个音频绑定已按 URL 去重为 1,204 项",
  );
  await page.locator("#sourceCatalogKind").selectOption("example");
  await page.locator("#sourceCatalogSearch").fill("abbreviation:n-1:example");
  await expect(page.locator(".source-entry")).toHaveCount(1);
  await page.locator(".source-entry summary").click();
  await expect(page.locator(".source-entry")).toContainText("CM");
  await expect(page.locator(".source-entry")).toContainText("CC BY 2.0 FR");
  await expect(page.locator(".source-entry a")).toHaveCount(3);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  })).toBe(true);
  await expect(page.locator("#sourceCatalogSearch")).toHaveCSS("font-size", "16px");
  await page.locator("#sourceCatalogSearch").focus();
  await expect(page.locator("#sourceCatalogSearch")).toBeFocused();
});
