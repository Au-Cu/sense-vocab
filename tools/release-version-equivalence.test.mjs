import assert from "node:assert/strict";
import test from "node:test";
import { sha256, stableJson } from "./op-verification-lib.mjs";
import {
  assertArtifactEquivalence,
  assertPriorReceipt,
  assertSourceEquivalence,
  assertVerifierChange,
  assertVersionManifests,
  expectedSbomSerial,
  isCurrentReceiptReusable,
  versionReuseVerifierPatch,
} from "./release-version-equivalence.mjs";

const makePackage = (version) => ({ name: "sense", version, scripts: { test: "playwright test" } });
const makeLock = (version) => ({ name: "sense", version, lockfileVersion: 3,
  packages: { "": { name: "sense", version, dependencies: { x: "1.0.0" } },
    "node_modules/x": { version: "1.0.0" } } });
const file = (path, hash) => ({ path, sha256: hash });
const source = (files) => ({ files, environment: { node: "v24", platform: "win32", arch: "arm64" } });

test("version-only equivalence permits just consistent root version changes", () => {
  const result = assertVersionManifests(makePackage("1.0.0"), makeLock("1.0.0"),
    makePackage("1.1.0"), makeLock("1.1.0"));
  assert.deepEqual(result, { previousVersion: "1.0.0", currentVersion: "1.1.0" });
  const changed = makeLock("1.1.0"); changed.packages["node_modules/x"].version = "2.0.0";
  assert.throws(() => assertVersionManifests(makePackage("1.0.0"), makeLock("1.0.0"), makePackage("1.1.0"), changed));
  const inconsistent = makeLock("1.1.0"); inconsistent.packages[""].version = "1.0.0";
  assert.throws(() => assertVersionManifests(makePackage("1.0.0"), makeLock("1.0.0"), makePackage("1.1.0"), inconsistent));
  const changedScript = makePackage("1.1.0"); changedScript.scripts.test = "true";
  assert.throws(() => assertVersionManifests(makePackage("1.0.0"), makeLock("1.0.0"), changedScript, makeLock("1.1.0")));
});

test("verifier changes must be limited to the reviewed version-reuse branch", () => {
  const before = 'const candidate = null;\nif (requireFreeze) {\n} else {\n  const priorSuccess = await readReceipt("release", initialSource.hash);\n}\n';
  const after = versionReuseVerifierPatch(before);
  assert.doesNotThrow(() => assertVerifierChange(before, after));
  assert.doesNotThrow(() => assertVerifierChange(after, after));
  assert.throws(() => assertVerifierChange(before, after.replace("const candidate = null;", "const candidate = bypass;")));
  assert.throws(() => versionReuseVerifierPatch("no recognized gate"));
});

test("an exact successful receipt is reusable only with the same source and dist", () => {
  const receipt = { gate: "release", result: "passed", inputHash: "source", dist: { hash: "dist" } };
  assert.equal(isCurrentReceiptReusable(receipt, "source", "dist"), true);
  assert.equal(isCurrentReceiptReusable(receipt, "changed", "dist"), false);
  assert.equal(isCurrentReceiptReusable(receipt, "source", "changed"), false);
  assert.equal(isCurrentReceiptReusable({ ...receipt, result: "failed" }, "source", "dist"), false);
});

test("functional input equivalence rejects changed app, tests, dependencies, and environment", () => {
  const before = source([file("app.js", "a"), file("package.json", "p"), file("package-lock.json", "l"),
    file("tools/verify-release.mjs", "v"), file("tools/example.spec.js", "t")]);
  const after = source([file("app.js", "a"), file("package.json", "p2"), file("package-lock.json", "l2"),
    file("tools/verify-release.mjs", "v2"), file("tools/example.spec.js", "t"),
    file("tools/release-version-equivalence.mjs", "n"), file("tools/release-version-equivalence.test.mjs", "nt")]);
  assert.doesNotThrow(() => assertSourceEquivalence(before, after));
  for (const changedPath of ["app.js", "tools/example.spec.js"]) {
    const altered = structuredClone(after); altered.files.find((item) => item.path === changedPath).sha256 = "changed";
    assert.throws(() => assertSourceEquivalence(before, altered));
  }
  const newFile = structuredClone(after); newFile.files.push(file("tools/unreviewed.mjs", "z"));
  assert.throws(() => assertSourceEquivalence(before, newFile));
  const environment = structuredClone(after); environment.environment.node = "v25";
  assert.throws(() => assertSourceEquivalence(before, environment));
});

test("prior full-test evidence must bind source, artifacts, command, and complete results", () => {
  const inputs = source([file("app.js", "hash")]);
  inputs.hash = sha256(stableJson({ files: inputs.files, environment: inputs.environment }));
  const dist = { files: [file("index.html", "hash")] }; dist.hash = sha256(stableJson(dist.files));
  const receipt = { gate: "release", result: "passed", inputHash: inputs.hash, inputs, dist,
    counts: { passed: 2, skipped: 1 }, failedTests: [], failedFiles: [], commands: [["npm", "test"]] };
  assert.doesNotThrow(() => assertPriorReceipt(receipt, inputs.hash, "1 skipped\n2 passed"));
  assert.throws(() => assertPriorReceipt(receipt, inputs.hash, "1 skipped"));
  for (const alter of [
    (r) => { r.inputs.files[0].sha256 = "changed"; },
    (r) => { r.dist.files[0].sha256 = "changed"; },
    (r) => { r.counts.failed = 1; },
    (r) => { r.commands = [["npm", "run", "build:web"]]; },
  ]) {
    const changed = structuredClone(receipt); alter(changed);
    assert.throws(() => assertPriorReceipt(changed, inputs.hash, "1 skipped\n2 passed"));
  }
});

test("artifact equivalence allows only version and lock-hash metadata", () => {
  const oldLock = Buffer.from("old lock"), newLock = Buffer.from("new lock");
  const oldHash = sha256(oldLock), newHash = sha256(newLock);
  const sbom = (version, hash) => ({ serialNumber: expectedSbomSerial(version, hash),
    metadata: { component: { name: "sense", version, hashes: [{ alg: "SHA-256", content: hash }] } },
    components: [{ name: "x", version: "1.0.0" }] });
  const licenses = (version, hash) => `Generated for Sense Vocab ${version}.\nPackage-lock SHA-256: \`${hash}\`.\nDependency inventory\n`;
  const before = { sbom: JSON.stringify(sbom("1.0.0", oldHash)), licenses: licenses("1.0.0", oldHash) };
  const after = { sbom: JSON.stringify(sbom("1.1.0", newHash)), licenses: licenses("1.1.0", newHash) };
  before.files = [file("index.html", "same"), file("SBOM.cdx.json", sha256(before.sbom)), file("THIRD_PARTY_LICENSES.md", sha256(before.licenses))];
  after.files = [file("index.html", "same"), file("SBOM.cdx.json", sha256(after.sbom)), file("THIRD_PARTY_LICENSES.md", sha256(after.licenses))];
  const versions = { previousVersion: "1.0.0", currentVersion: "1.1.0", previousLockHash: oldHash, currentLockHash: newHash };
  assert.doesNotThrow(() => assertArtifactEquivalence(before, after, versions));
  const changedAsset = structuredClone(after); changedAsset.files[0].sha256 = "altered";
  assert.throws(() => assertArtifactEquivalence(before, changedAsset, versions));
  const changedDependency = structuredClone(after); const changedSbom = JSON.parse(changedDependency.sbom);
  changedSbom.components[0].version = "2.0.0"; changedDependency.sbom = JSON.stringify(changedSbom);
  changedDependency.files.find((item) => item.path === "SBOM.cdx.json").sha256 = sha256(changedDependency.sbom);
  assert.throws(() => assertArtifactEquivalence(before, changedDependency, versions));
  const changedNotice = structuredClone(after); changedNotice.licenses += "unexpected\n";
  changedNotice.files.find((item) => item.path === "THIRD_PARTY_LICENSES.md").sha256 = sha256(changedNotice.licenses);
  assert.throws(() => assertArtifactEquivalence(before, changedNotice, versions));
  const invalidSerial = structuredClone(after); const serialSbom = JSON.parse(invalidSerial.sbom);
  serialSbom.serialNumber = "forged"; invalidSerial.sbom = JSON.stringify(serialSbom);
  invalidSerial.files.find((item) => item.path === "SBOM.cdx.json").sha256 = sha256(invalidSerial.sbom);
  assert.throws(() => assertArtifactEquivalence(before, invalidSerial, versions));
  const missingFile = structuredClone(after); missingFile.files.pop();
  assert.throws(() => assertArtifactEquivalence(before, missingFile, versions));
});
