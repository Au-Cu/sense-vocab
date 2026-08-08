const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

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
