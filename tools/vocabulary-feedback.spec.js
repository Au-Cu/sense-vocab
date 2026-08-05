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
