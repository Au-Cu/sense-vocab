const { test, expect } = require("@playwright/test");
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

function byWord(words, word) {
  return words.find((entry) => entry.word === word);
}

function bySynset(entry, synsetId) {
  return entry.senses.find((sense) => sense.synsetId === synsetId);
}

test("reported Kaoyan vocabulary senses remain covered", () => {
  const source = readJson("data/kaoyan-words.json");
  const bundle = readJson("data/vocabulary-bundle.json");

  const sourcePart = byWord(source, "part");
  const sourceParticipate = byWord(source, "participate");
  const sourceParty = byWord(source, "party");
  const sourceParachute = byWord(source, "parachute");
  const sourceOrder = byWord(source, "order");

  expect(bySynset(sourcePart, "omw-en-02030158-v")).toMatchObject({
    id: "common-02030158-v",
    pos: "v.",
    meaning: "分开，分离",
  });
  expect(sourceParticipate.senses[0]).toMatchObject({
    id: "sense-1",
    pos: "v.",
    meaning: "参与，参加",
  });
  expect(sourceParticipate.senses[0].exampleZh).toContain("参加");
  expect(bySynset(sourceParty, "omw-en-08252602-n")).toMatchObject({
    id: "common-08252602-n",
    pos: "n.",
    meaning: "聚会，派对",
  });
  expect(bySynset(sourceParachute, "omw-en-03888257-n")).toMatchObject({
    id: "common-03888257-n",
    pos: "n.",
    meaning: "降落伞",
  });
  expect(bySynset(sourceOrder, "omw-en-13968547-n")).toMatchObject({
    id: "sense-3",
    pos: "n.",
    meaning: "秩序",
  });
  expect(bySynset(sourceOrder, "omw-en-13968547-n").exampleZh).toContain("秩序");

  const runtimePart = byWord(bundle.words, "part");
  const runtimeParty = byWord(bundle.words, "party");
  const runtimeParachute = byWord(bundle.words, "parachute");

  expect(bySynset(runtimePart, "omw-en-13809207-n").id).toBe("n-1");
  expect(bySynset(runtimePart, "omw-en-00007703-r").id).toBe("adv-2");
  expect(bySynset(runtimePart, "omw-en-02030158-v").id).toBe("v-3");
  expect(bySynset(runtimeParty, "omw-en-08256968-n").id).toBe("n-1");
  expect(bySynset(runtimeParty, "omw-en-08252602-n").id).toBe("n-2");
  expect(bySynset(runtimeParachute, "omw-en-01968275-v").id).toBe("v-1");
  expect(bySynset(runtimeParachute, "omw-en-03888257-n").id).toBe("n-2");
});

test("new feedback senses preserve every existing runtime identity", () => {
  const bundle = readJson("data/vocabulary-bundle.json");
  const expected = {
    pension: {
      "omw-en-02262601-v": "v-1",
      "omw-en-13384164-n": "n-2",
    },
    port: {
      "omw-en-03578656-n": "n-1",
      "omw-en-03642928-n": "n-2",
      "omw-en-02090854-v": "v-3",
      "omw-en-08633957-n": "n-4",
    },
    pose: {
      "omw-en-02722663-v": "v-1",
      "omw-en-02142775-v": "v-2",
      "omw-en-02519183-v": "v-3",
      "omw-en-05081300-n": "n-4",
    },
    deposit: {
      "omw-en-13381145-n": "n-1",
      "omw-en-09428967-n": "n-2",
      "omw-en-13349834-n": "n-3",
      "omw-en-13349662-n": "n-4",
      "omw-en-13462191-n": "n-5",
      "omw-en-02310855-v": "v-6",
      "omw-en-01528069-v": "v-7",
    },
    prime: {
      "omw-en-15295045-n": "n-1",
      "omw-en-01012990-s": "adj-2",
    },
    positive: {
      "omw-en-00358678-s": "adj-1",
      "omw-en-01820481-a": "adj-2",
      "omw-en-01817500-a": "adj-3",
    },
    resume: {
      "omw-en-00350104-v": "v-1",
      "omw-en-02381951-v": "v-2",
      "omw-en-06468403-n": "n-3",
    },
    soil: {
      "omw-en-14844693-n": "n-1",
      "omw-en-14498096-n": "n-2",
    },
    prepare: {
      "omw-en-00406243-v": "v-1",
      "omw-en-01664172-v": "v-2",
    },
  };

  for (const [word, senses] of Object.entries(expected)) {
    const entry = byWord(bundle.words, word);
    expect(entry).toBeTruthy();
    expect(new Set(entry.senses.map((sense) => sense.id)).size)
      .toBe(entry.senses.length);
    for (const [synsetId, id] of Object.entries(senses)) {
      expect(bySynset(entry, synsetId)?.id).toBe(id);
    }
  }
});

test("reported definitions and examples are semantic rather than positional fixes", () => {
  const source = readJson("data/kaoyan-words.json");
  expect(bySynset(byWord(source, "appetite"), "omw-en-07485626-n")
    .definitionSentence).toContain("desire for food");
  expect(bySynset(byWord(source, "maneuver"), "omw-en-02369390-v")
    .example).toContain("chairmanship");
  expect(bySynset(byWord(source, "positive"), "omw-en-01820481-a")
    .example).toContain("tested positive");
  expect(bySynset(byWord(source, "propose"), "omw-en-00708980-v")
    .definitionSentence).toBe("To intend or plan to do something.");
  expect(bySynset(byWord(source, "impose"), "omw-en-02560424-v")
    .definitionSentence).not.toMatch(/impose means to impose/i);
});

test("approved 2026-08-12 feedback content is bound to stable senses", () => {
  const bundle = readJson("data/vocabulary-bundle.json");
  const expectedNewSenses = {
    sanction: { "n-2": "omw-en-06687358-n", "n-3": "omw-en-01124246-n" },
    consent: { "n-2": "omw-en-06689667-n" },
    prescribe: { "v-2": "omw-en-01074284-v" },
    aside: { "adv-2": "omw-en-00233892-r" },
    solid: { "adj-5": "omw-en-02275412-s" },
    solo: { "adv-3": "omw-en-00157967-r" },
    solution: { "n-3": "omw-en-05661668-n" },
    insult: { "v-2": "omw-en-00848420-v" },
    specify: { "v-2": "omw-en-01021973-v" },
    terminal: { "n-3": "omw-en-04412901-n" },
  };

  for (const [word, senses] of Object.entries(expectedNewSenses)) {
    const entry = byWord(bundle.words, word);
    for (const [senseId, synsetId] of Object.entries(senses)) {
      expect(entry.senses.find((sense) => sense.id === senseId)).toMatchObject({
        synsetId,
        generationBatchId: "OP-FB-2026-08-12-A",
        humanReviewStatus: "approved",
      });
      const kaoyanEntry = bundle.books.find((book) => book.id === "kaoyan")
        .entries.find((candidate) => candidate.wordId === entry.id);
      expect(kaoyanEntry.senseIds).toContain(senseId);
    }
  }

  expect(byWord(bundle.words, "intact").senses.find((sense) =>
    sense.id === "adj-1")).toMatchObject({
      meaning: "完整无损的",
      synsetId: "omw-en-00515870-s",
    });
  expect(byWord(bundle.words, "consist").senses.find((sense) =>
    sense.id === "v-1").definition).toContain("essential feature");
  expect(byWord(bundle.words, "container").senses.find((sense) =>
    sense.id === "n-1").meaning).toBe("容器；集装箱");
});

test("approved feedback change set retains field-level rights evidence", () => {
  const manifest = readJson("data/content-change-sets/op-fb-2026-08-12-a.json");
  const ledger = readJson(
    "data/content-change-sets/op-fb-2026-08-12-a-rights-ledger.json",
  );
  expect(manifest.review.status).toBe("approved");
  expect(ledger.decision).toBe("CLEARED");
  expect(ledger.historicalGlobalCommercialGate).toContain("BLOCKED");
  expect(ledger.rows).toHaveLength(ledger.rowCount);
  for (const row of ledger.rows) {
    expect(row).toMatchObject({
      risk: "CLEARED",
      reviewStatus: "approved",
    });
    expect(row.authorOrRightsholder).toBeTruthy();
    expect(row.directSource).toMatch(/^https:\/\//);
    expect(row.license).toBeTruthy();
    expect(row.oldValueSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(row.newValueSha256).toMatch(/^[a-f0-9]{64}$/);
  }
});

test("approved 2026-08-13 feedback batch preserves identities and rights", () => {
  const bundle = readJson("data/vocabulary-bundle.json");
  const manifest = readJson("data/content-change-sets/op-fb-2026-08-13-b.json");
  const ledger = readJson(
    "data/content-change-sets/op-fb-2026-08-13-b-rights-ledger.json",
  );
  const expected = {
    revenge: ["v-2", "omw-en-01153486-v"],
    suspect: ["v-2", "omw-en-00921072-v"],
    spectrum: ["n-2", "omw-en-11420831-n"],
    vacant: ["adj-2", "omw-en-01087977-s"],
    entertain: ["v-2", null],
    resolution: ["n-2", "omw-en-04861486-n"],
    shiver: ["n-2", "omw-en-00867983-n"],
    silver: ["adj-3", "omw-en-01529053-s"],
    versatile: ["adj-3", "omw-en-02228163-s"],
  };

  for (const [wordId, [senseId, synsetId]] of Object.entries(expected)) {
    const sense = bundle.words.find((word) => word.id === wordId)
      .senses.find((candidate) => candidate.id === senseId);
    expect(sense).toMatchObject({
      synsetId,
      generationBatchId: "OP-FB-2026-08-13-B",
      humanReviewStatus: "approved",
    });
  }
  expect(manifest.review).toMatchObject({
    status: "approved",
    reviewerRole: "product owner",
  });
  expect(ledger).toMatchObject({
    decision: "CLEARED",
    historicalGlobalCommercialGate: "BLOCKED outside this change set",
    rowCount: 81,
  });
  expect(ledger.rows.every((row) => row.risk === "CLEARED")).toBe(true);
  expect(byWord(bundle.words, "version").senses.find((sense) => sense.id === "n-2")
    .exampleZh).toBe("他对那场打斗的说法与我的不同。");
});

test("approved new senses are visible together on desktop and mobile", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(APP_URL);
  await page.waitForFunction(() =>
    document.documentElement.dataset.vocabularyReady === "true"
  );
  await page.locator("#wordListButton").click();
  await page.locator("#wordSearchInput").fill("sanction");
  await expect(page.locator(".word-list-item")).toHaveCount(1);
  await page.locator(".word-list-item").click();
  await expect(page.locator("#wordText")).toHaveText("sanction");
  await expect(page.locator("#senseArea")).toContainText("正式批准，许可");
  await expect(page.locator("#senseArea")).toContainText("制裁，处罚措施");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  const mobileOverflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return {
      documentFits: document.documentElement.scrollWidth <= viewportWidth,
      offenders: [...document.querySelectorAll("body *")].flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.left >= -1 && rect.right <= viewportWidth + 1) return [];
        return [{
          selector: element.id ? `#${element.id}` : element.className || element.tagName,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }];
      }).slice(0, 10),
    };
  });
  expect(mobileOverflow).toEqual({ documentFits: true, offenders: [] });
  await page.locator("#exitStudyButton").click();
  await expect(page.locator("#wordListPanel")).toBeVisible();
  await expect(page.locator("#wordSearchInput")).toHaveValue("sanction");
});

test("approved volunteer noun and visual example stay bound to both books", async ({ page }) => {
  const response = await page.request.get(`${APP_URL}data/vocabulary-bundle.json`);
  expect(response.ok()).toBeTruthy();
  const bundle = await response.json();
  const volunteer = byWord(bundle.words, "volunteer");
  const volunteerNoun = volunteer.senses.find((sense) => sense.id === "n-3");
  expect(volunteerNoun).toMatchObject({
    pos: "n.",
    meaning: "志愿者，义务工作者",
    synsetId: "omw-en-10759151-n",
    humanReviewStatus: "approved",
  });
  expect(volunteerNoun.definition).toBe(
    "a person who freely offers to do work, usually without being paid",
  );
  expect(volunteerNoun.exampleZh).toBe(
    "每周六，这名志愿者都会在社区图书馆整理捐赠的图书，而且不领取报酬。",
  );

  for (const bookId of ["kaoyan", "ielts"]) {
    const entry = bundle.books.find((book) => book.id === bookId)
      .entries.find((candidate) => candidate.wordId === "volunteer");
    expect(entry.senseIds).toEqual(["v-1", "adj-2", "n-3"]);
  }

  const visual = byWord(bundle.words, "visual").senses.find(
    (sense) => sense.id === "adj-1",
  );
  expect(visual.example).toBe(
    "The runway remained visual throughout the final approach despite the light rain.",
  );
  expect(visual.exampleZh).toBe(
    "尽管下着小雨，在最后进近过程中始终都能看见跑道。",
  );
});

test("approved volunteer and visual content is visible while present remains available", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(APP_URL);
  await page.waitForFunction(() =>
    document.documentElement.dataset.vocabularyReady === "true"
  );
  await page.locator("#wordListButton").click();

  const openWordCard = async (wordId) => {
    await page.locator("#wordSearchInput").fill(wordId);
    const target = page.locator(`.word-list-item[data-word-id="${wordId}"]`);
    await expect(target).toHaveCount(1);
    await target.click();
    await expect(page.locator("#wordText")).toHaveText(wordId);
  };
  const returnToList = async () => {
    await page.locator("#exitStudyButton").click();
    await expect(page.locator("#wordListPanel")).toBeVisible();
  };

  await openWordCard("volunteer");
  await expect(page.locator('.sense-item[data-key="volunteer:n-3"]')).toHaveCount(1);
  await expect(page.locator("#senseArea")).toContainText(
    "a person who freely offers to do work, usually without being paid",
  );
  await returnToList();

  await openWordCard("visual");
  await expect(page.locator('.sense-item[data-key="visual:adj-1"]')).toContainText(
    "The runway remained visual throughout the final approach despite the light rain.",
  );
  await returnToList();

  await page.setViewportSize({ width: 390, height: 844 });
  await openWordCard("present");
  await expect(page.locator('.sense-item[data-key="present:adj-6"]')).toHaveCount(1);
  await expect(page.locator('.sense-item[data-key="present:adj-6"]')).toContainText("出席的");
  await page.waitForFunction(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
});
