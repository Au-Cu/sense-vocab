import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverDerivationSourcePaths, verifyDerivationsForBuild } from "./derivation-release-gate.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const version = "0123456789abcdef", base = "fedcba9876543210";
const corpus = "cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59";

async function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(parent, "derivation-gate-test-"));
  if (path.dirname(path.resolve(root)) !== parent) throw new Error("Unsafe temporary fixture path");
  t.after(() => rm(root, { recursive: true, force: true }));
  const data = path.join(root, "data"), tools = path.join(root, "tools");
  const baseDir = path.join(data, "universes", base), directory = path.join(data, "derivations", version);
  await mkdir(baseDir, { recursive: true });
  await mkdir(path.join(directory, "derivation"), { recursive: true });
  await mkdir(tools, { recursive: true });
  const bundle = Buffer.from("fixture bundle"), bundleSha256 = hash(bundle);
  const baseIndex = Buffer.from("fixture base index"), generator = Buffer.from("fixture generator");
  await writeFile(path.join(data, "vocabulary-bundle.json"), bundle);
  await writeFile(path.join(baseDir, "index.json"), baseIndex);
  await writeFile(path.join(data, "universes", "manifest.json"), JSON.stringify({ version: base, bundleSha256 }));
  await writeFile(path.join(tools, "build_wordnet_derivations.py"), generator);
  const contents = {
    "index.json": JSON.stringify({ schema: 1, version, baseUniverseVersion: base, bundleSha256, wordnetSha256: corpus, counts: {} }),
    "derivation/0-0.json": "{}",
  };
  const files = [];
  for (const [name, content] of Object.entries(contents)) {
    await writeFile(path.join(directory, ...name.split("/")), content);
    files.push({ path: name, sha256: hash(content), bytes: Buffer.byteLength(content) });
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const artifactListSha256 = hash(JSON.stringify(files));
  const manifest = { schema: 1, version, index: `./${version}/index.json`, bundleSha256, baseUniverseVersion: base,
    files, artifactListSha256, source: { archiveSha256: corpus, baseIndexSha256: hash(baseIndex), generatorSha256: hash(generator) },
    distribution: "cleared-for-release", review: { status: "approved", reviewer: "synthetic fixture",
      reviewedAt: "2026-01-01T00:00:00Z", scope: "synthetic test only", artifactListSha256, evidence: ["synthetic"] } };
  async function save() { await writeFile(path.join(data, "derivations", "manifest.json"), JSON.stringify(manifest)); }
  await save();
  return { root, data, tools, directory, manifest, save };
}

test("review covers the exact synthetic files, index, vocabulary and generator", async (t) => {
  const f = await fixture(t);
  assert.equal((await discoverDerivationSourcePaths(f.root)).length, 3);
  assert.equal((await verifyDerivationsForBuild(f.root)).version, version);
  await writeFile(path.join(f.directory, "derivation", "0-0.json"), "tampered");
  await assert.rejects(verifyDerivationsForBuild(f.root), /checksum mismatch/);
});

test("pending or incompletely documented review cannot build", async (t) => {
  const f = await fixture(t);
  f.manifest.distribution = "blocked-pending-review";
  await f.save();
  await assert.rejects(verifyDerivationsForBuild(f.root), /requires recorded review/);
  f.manifest.distribution = "cleared-for-release";
  f.manifest.review.evidence = [];
  await f.save();
  await assert.rejects(verifyDerivationsForBuild(f.root), /requires recorded review/);
  f.manifest.review.evidence = ["synthetic"];
  f.manifest.review.artifactListSha256 = "0".repeat(64);
  await f.save();
  await assert.rejects(verifyDerivationsForBuild(f.root), /requires recorded review/);
});

test("changed vocabulary invalidates the review", async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.data, "vocabulary-bundle.json"), "changed");
  await assert.rejects(verifyDerivationsForBuild(f.root), /does not match/);
});

test("changed generator invalidates the review", async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.tools, "build_wordnet_derivations.py"), "changed");
  await assert.rejects(verifyDerivationsForBuild(f.root), /generator has changed/);
});

test("changed base index invalidates the review", async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.data, "universes", base, "index.json"), "changed");
  await assert.rejects(verifyDerivationsForBuild(f.root), /source index has changed/);
});

test("reviewed path traversal fails closed", async (t) => {
  const f = await fixture(t);
  f.manifest.files[0].path = "../outside";
  f.manifest.files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  f.manifest.artifactListSha256 = hash(JSON.stringify(f.manifest.files));
  f.manifest.review.artifactListSha256 = f.manifest.artifactListSha256;
  await f.save();
  await assert.rejects(verifyDerivationsForBuild(f.root), /Invalid derivation asset entry/);
});

test("reviewed duplicate file entries fail closed", async (t) => {
  const f = await fixture(t);
  f.manifest.files.push({ ...f.manifest.files[0] });
  f.manifest.files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  f.manifest.artifactListSha256 = hash(JSON.stringify(f.manifest.files));
  f.manifest.review.artifactListSha256 = f.manifest.artifactListSha256;
  await f.save();
  await assert.rejects(verifyDerivationsForBuild(f.root), /Invalid derivation asset entry/);
});
