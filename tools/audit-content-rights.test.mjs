import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("repeat audits record their actual inputs without changing an unchanged public summary", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sense-audit-"));
  try {
    await mkdir(path.join(root, "tools"));
    await mkdir(path.join(root, "data"));
    await copyFile(new URL("./audit-content-rights.mjs", import.meta.url), path.join(root, "tools", "audit-content-rights.mjs"));
    const bundle = { schemaVersion: 1, words: [{ id: "x", word: "x", senses: [{ id: "s" }] }] };
    const input = path.join(root, "data", "vocabulary-bundle.json");
    await writeFile(input, JSON.stringify(bundle));
    const run = () => execFileSync(process.execPath, [path.join(root, "tools", "audit-content-rights.mjs")], { encoding: "utf8" });
    const read = async (file) => JSON.parse(await readFile(path.join(root, "data", file), "utf8"));
    run();
    const first = await read("content-rights-summary.json");
    const firstReport = await read("content-rights-audit.json");
    run();
    assert.deepEqual(await read("content-rights-summary.json"), first);
    const secondReport = await read("content-rights-audit.json");
    const history = (await readFile(path.join(root, ".op-cache", "content-audit", "runs.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(history.length, 2);
    assert.equal(history[1].auditedAt, secondReport.generatedAt);
    assert.equal(history[1].inputSha256, secondReport.inputSha256);
    assert.equal(history[0].resultSha256, history[1].resultSha256);
    assert.ok(secondReport.generatedAt >= firstReport.generatedAt);
    assert.equal(secondReport.inputSha256, firstReport.inputSha256);
    assert.match(secondReport.auditScriptSha256, /^[0-9a-f]{64}$/);
    bundle.words[0].senses[0].exampleSource = "quotation";
    await writeFile(input, JSON.stringify(bundle));
    run();
    const changed = await read("content-rights-summary.json");
    assert.equal(changed.counts.quotationExamplesRequiringReview, 1);
    assert.notEqual((await read("content-rights-audit.json")).inputSha256, firstReport.inputSha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});
