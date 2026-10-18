const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { webcrypto } = require("node:crypto");
const path = require("node:path");

test("generated concurrent branches preserve authoritative merge invariants", async () => {
  const storage = new Map();
  const window = { crypto: webcrypto, setTimeout, localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
  runInNewContext(readFileSync(path.join(__dirname, "../sync-state.js"), "utf8"),
    { window, setTimeout, console, performance });
  const sync = window.SenseVocabSync;
  const stable = (value) => value && typeof value === "object"
    ? Array.isArray(value) ? `[${value.map(stable).join(",")}]`
      : `{${Object.keys(value).sort().map((key) => `${key}:${stable(value[key])}`).join(",")}}`
    : JSON.stringify(value);
  // Membership is a set; its presentation order is not a merge invariant.
  const domains = (scope) => Object.fromEntries(
    ["progress", "introducedWords", "activityLog", "studyWindows", "learningDayCounter"]
      .map((name) => [name, name === "introducedWords" ? [...scope[name]].sort() : scope[name]]),
  );
  const statuses = ["new", "reinforce", "review", "mastered"];
  const branch = (seed, writer) => {
    const progress = {};
    const introducedWords = [];
    for (let index = 0; index < 16; index += 1) {
      if ((seed + index) % 3 === 0) continue;
      const word = `word-${index}`;
      introducedWords.push(word);
      progress[`${word}:sense-1`] = { status: statuses[(seed + index) % 4],
        lastLearningDay: 3, updatedAt: "2026-10-10T12:00:00.000Z", misses: index % 2 };
    }
    const state = { dataVersion: 8, introducedWords, progress, activityLog: {}, studyWindows: [], learningDayCounter: 3 };
    sync.stampChanges(state, {}, writer);
    return state;
  };
  for (let seed = 0; seed < 50; seed += 1) {
    const a = branch(seed, `left-${seed}`);
    const b = branch(seed + 1, `right-${seed}`);
    const c = branch(seed + 2, `third-${seed}`);
    const beforeA = stable(a);
    const beforeB = stable(b);
    const merged = sync.mergeStates(a, b);
    expect(stable(a), `left input unchanged, seed ${seed}`).toBe(beforeA);
    expect(stable(b), `right input unchanged, seed ${seed}`).toBe(beforeB);
    expect(stable(domains(sync.mergeStates(a, a))), `idempotence, seed ${seed}`).toBe(stable(domains(a)));
    expect(stable(domains(merged)), `commutativity, seed ${seed}`).toBe(stable(domains(sync.mergeStates(b, a))));
    expect(stable(domains(sync.mergeStates(merged, c))), `associativity, seed ${seed}`)
      .toBe(stable(domains(sync.mergeStates(a, sync.mergeStates(b, c)))));
    expect(Object.keys(merged.progress).length, `no missing records, seed ${seed}`)
      .toBe(new Set([...Object.keys(a.progress), ...Object.keys(b.progress)]).size);
    expect([...merged.introducedWords].sort(), `no missing new-word membership, seed ${seed}`)
      .toEqual([...new Set([...a.introducedWords, ...b.introducedWords])].sort());
    expect(stable(domains(await sync.mergeStatesAsync(a, b))), `cooperative parity, seed ${seed}`)
      .toBe(stable(domains(merged)));
    for (const key of Object.keys(a.progress).filter((key) => b.progress[key])) {
      expect(statuses.indexOf(merged.progress[key].status), `conservative status, seed ${seed}, ${key}`)
        .toBe(Math.min(statuses.indexOf(a.progress[key].status), statuses.indexOf(b.progress[key].status)));
    }
  }
});
