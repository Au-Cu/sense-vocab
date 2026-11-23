import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverUniverseSourcePaths, verifyUniverseForBuild } from "./universe-release-gate.mjs";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const version = "0123456789abcdef";
const evidence = Object.fromEntries(["source", "model", "training", "input", "output", "visualization"].map((key) => [key, ["test-fixture-only"]]));

async function fixture(t) {
  const tempRoot = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(tempRoot, "universe-gate-test-"));
  if (path.dirname(path.resolve(root)) !== tempRoot) throw new Error("Unsafe temporary fixture path");
  t.after(() => rm(root, { recursive: true, force: true }));
  const data = path.join(root, "data"), directory = path.join(data, "universes", version);
  await mkdir(path.join(directory, "synonym"), { recursive: true });
  await mkdir(path.join(directory, "spelling"), { recursive: true });
  const bundle = Buffer.from('{"test":"fixture"}'), bundleSha256 = sha256(bundle);
  await writeFile(path.join(data, "vocabulary-bundle.json"), bundle);
  const artifacts = {
    "index.json": JSON.stringify({ version, bundleSha256, nodes: [{ id: "test" }] }),
    "report.json": "{}", "WORDNET-3.0-LICENSE.txt": "fixture license",
    "synonym/0-0.json": "{}", "spelling/0-0.json": "{}",
  };
  const files = [];
  for (const [name, content] of Object.entries(artifacts)) {
    await writeFile(path.join(directory, ...name.split("/")), content);
    files.push({ path: name, sha256: sha256(content), bytes: Buffer.byteLength(content) });
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = { schema: 1, version, index: `./${version}/index.json`, bundleSha256,
    distribution: "cleared-for-release", files,
    clearance: { status: "approved", reviewer: "fixture", reviewedAt: "2026-01-01T00:00:00Z", scope: "test only", evidence,
      artifactsSha256: sha256(JSON.stringify(files)) } };
  async function save() { await writeFile(path.join(data, "universes", "manifest.json"), JSON.stringify(manifest)); }
  await save();
  return { root, data, directory, manifest, save };
}

test("valid synthetic review is bound to the exact bundle and artifacts", async (t) => {
  const f = await fixture(t);
  const paths = await discoverUniverseSourcePaths(f.root);
  assert.equal(paths.length, f.manifest.files.length + 1);
  assert.ok(paths.includes(`data/universes/${version}/index.json`));
  assert.equal((await verifyUniverseForBuild(f.root)).version, version);
  await writeFile(path.join(f.directory, "index.json"), "tampered");
  await assert.rejects(verifyUniverseForBuild(f.root), /artifact changed/);
});

test("unreviewed, incomplete and stale assets fail closed", async (t) => {
  const f = await fixture(t);
  f.manifest.distribution = "blocked";
  await f.save();
  await assert.rejects(verifyUniverseForBuild(f.root), /publication blocked/);
  f.manifest.distribution = "cleared-for-release";
  f.manifest.clearance.evidence = { ...evidence, training: [] };
  await f.save();
  await assert.rejects(verifyUniverseForBuild(f.root), /publication blocked/);
  f.manifest.clearance.evidence = evidence;
  await f.save();
  await writeFile(path.join(f.data, "vocabulary-bundle.json"), "different bundle");
  await assert.rejects(verifyUniverseForBuild(f.root), /does not match/);
});

test("unsafe artifact paths cannot escape the version directory", async (t) => {
  const f = await fixture(t);
  f.manifest.files[0].path = "../outside";
  f.manifest.files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  f.manifest.clearance.artifactsSha256 = sha256(JSON.stringify(f.manifest.files));
  await f.save();
  await assert.rejects(verifyUniverseForBuild(f.root), /Invalid universe artifact entry/);
});
