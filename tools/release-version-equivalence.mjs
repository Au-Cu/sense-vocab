import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  cacheDir, compactLogPath, computeDistManifest, computeSourceManifest, emit, failureSummary,
  gitEvidence, listReceipts, normalizeManifestContent, readReceipt, rootDir, runCaptured, sha256,
  stableJson, writeReceipt,
} from "./op-verification-lib.mjs";

const VERSION_ONLY_PATHS = new Set([
  "package.json",
  "package-lock.json",
  "tools/verify-release.mjs",
  "tools/release-version-equivalence.mjs",
  "tools/release-version-equivalence.test.mjs",
]);
const VERSIONED_ARTIFACTS = new Set(["SBOM.cdx.json", "THIRD_PARTY_LICENSES.md"]);

function fail(message) { throw new Error(`Version-only reuse rejected: ${message}`); }
function same(left, right) { return stableJson(left) === stableJson(right); }

function withoutVersion(pkg, lock) {
  const cleanPackage = structuredClone(pkg), cleanLock = structuredClone(lock);
  delete cleanPackage.version;
  delete cleanLock.version;
  delete cleanLock.packages[""].version;
  return { cleanPackage, cleanLock };
}

export function assertVersionManifests(previousPackage, previousLock, currentPackage, currentLock) {
  for (const [pkg, lock] of [[previousPackage, previousLock], [currentPackage, currentLock]]) {
    if (!pkg || !lock?.packages?.[""] || typeof pkg.version !== "string" ||
        !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version) ||
        pkg.version !== lock.version || pkg.version !== lock.packages[""].version ||
        pkg.name !== lock.name || pkg.name !== lock.packages[""].name) {
      fail("package and lock root versions or names do not match");
    }
  }
  if (previousPackage.version === currentPackage.version) fail("version did not change");
  if (!same(withoutVersion(previousPackage, previousLock), withoutVersion(currentPackage, currentLock))) {
    fail("package scripts, dependencies, or non-version lock data changed");
  }
  return { previousVersion: previousPackage.version, currentVersion: currentPackage.version };
}

function fileMap(files) {
  if (!Array.isArray(files)) fail("file manifest missing");
  const result = new Map();
  for (const item of files) {
    if (!item || typeof item.path !== "string" || typeof item.sha256 !== "string" || result.has(item.path)) {
      fail("invalid or duplicate manifest entry");
    }
    result.set(item.path, item.sha256);
  }
  return result;
}

export function assertSourceEquivalence(previous, current) {
  if (!["node", "platform", "arch"].every((key) => typeof previous?.environment?.[key] === "string") ||
      !same(previous.environment, current?.environment)) fail("test environment changed");
  const before = fileMap(previous?.files), after = fileMap(current?.files);
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(path) !== after.get(path) && !VERSION_ONLY_PATHS.has(path)) {
      fail(`functional input changed: ${path}`);
    }
  }
  for (const path of ["package.json", "package-lock.json", "tools/verify-release.mjs"]) {
    if (!before.has(path) || !after.has(path)) fail(`required input missing: ${path}`);
  }
  for (const path of ["package.json", "package-lock.json"]) {
    if (before.get(path) === after.get(path)) fail(`version input did not change: ${path}`);
  }
  for (const path of ["tools/release-version-equivalence.mjs", "tools/release-version-equivalence.test.mjs"]) {
    if (!after.has(path)) fail(`version verifier input missing: ${path}`);
  }
}

const VERIFIER_ANCHOR = '} else {\n  const priorSuccess = await readReceipt("release", initialSource.hash);';
const VERIFIER_BRANCH = `} else if (process.argv.some((arg) => arg.startsWith("--reuse-version-only="))) {
  const { runVersionOnlyRelease } = await import("./release-version-equivalence.mjs");
  await runVersionOnlyRelease({ initialSource, candidate });
} else {
  const priorSuccess = await readReceipt("release", initialSource.hash);`;

export function versionReuseVerifierPatch(previous) {
  const text = previous.replaceAll("\r\n", "\n");
  if (!text.includes(VERIFIER_ANCHOR) || text.indexOf(VERIFIER_ANCHOR) !== text.lastIndexOf(VERIFIER_ANCHOR)) {
    fail("release verifier anchor is missing or ambiguous");
  }
  return text.replace(VERIFIER_ANCHOR, VERIFIER_BRANCH);
}

export function assertVerifierChange(previous, current) {
  const normalizedPrevious = previous.replaceAll("\r\n", "\n");
  const normalizedCurrent = current.replaceAll("\r\n", "\n");
  if (normalizedPrevious !== normalizedCurrent && versionReuseVerifierPatch(previous) !== normalizedCurrent) {
    fail("release verifier includes unrelated changes");
  }
}

export function isCurrentReceiptReusable(receipt, sourceHash, distHash) {
  return receipt?.gate === "release" && receipt.result === "passed" &&
    receipt.inputHash === sourceHash && receipt.dist?.hash === distHash;
}

export function expectedSbomSerial(version, lockHash) {
  const hash = sha256(`sense-vocab:${version}:${lockHash}`);
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  return `urn:uuid:${uuid}`;
}

function normalizeSbom(text, version, lockHash) {
  let sbom;
  try { sbom = JSON.parse(text); } catch { fail("invalid SBOM"); }
  const component = sbom?.metadata?.component;
  const hashes = component?.hashes?.filter((item) => item.alg === "SHA-256") ?? [];
  if (component?.version !== version || hashes.length !== 1 || hashes[0].content !== lockHash ||
      sbom.serialNumber !== expectedSbomSerial(version, lockHash)) fail("SBOM version, lock hash, or serial is invalid");
  delete sbom.serialNumber;
  component.version = "<version>";
  hashes[0].content = "<lock-hash>";
  return sbom;
}

function replaceExactlyOnce(text, from, to) {
  if (!text.includes(from) || text.indexOf(from) !== text.lastIndexOf(from)) fail("license metadata is ambiguous");
  return text.replace(from, to);
}

export function assertArtifactEquivalence(previous, current, versions) {
  const before = fileMap(previous?.files), after = fileMap(current?.files);
  if (before.size !== after.size) fail("built artifact set changed");
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    if (!before.has(path) || !after.has(path)) fail(`built artifact added or removed: ${path}`);
    if (before.get(path) !== after.get(path) && !VERSIONED_ARTIFACTS.has(path)) {
      fail(`functional artifact changed: ${path}`);
    }
  }
  for (const [artifact, key] of [["SBOM.cdx.json", "sbom"], ["THIRD_PARTY_LICENSES.md", "licenses"]]) {
    if (!before.has(artifact) || !after.has(artifact) || sha256(previous[key]) !== before.get(artifact) ||
        sha256(current[key]) !== after.get(artifact)) fail(`artifact evidence mismatch: ${artifact}`);
  }
  const { previousVersion, currentVersion, previousLockHash, currentLockHash } = versions;
  if (!same(normalizeSbom(previous.sbom, previousVersion, previousLockHash),
    normalizeSbom(current.sbom, currentVersion, currentLockHash))) fail("non-version SBOM content changed");
  let expected = replaceExactlyOnce(previous.licenses, `Sense Vocab ${previousVersion}.`, `Sense Vocab ${currentVersion}.`);
  expected = replaceExactlyOnce(expected, `Package-lock SHA-256: \`${previousLockHash}\`.`,
    `Package-lock SHA-256: \`${currentLockHash}\`.`);
  if (expected !== current.licenses) fail("non-version license inventory changed");
}

export function assertPriorReceipt(receipt, hash, testLog) {
  const recomputedSource = receipt?.inputs && sha256(stableJson({
    files: receipt.inputs.files, environment: receipt.inputs.environment,
  }));
  const recomputedDist = receipt?.dist?.files && sha256(stableJson(receipt.dist.files));
  if (receipt?.gate !== "release" || receipt.result !== "passed" || receipt.inputHash !== hash ||
      receipt.inputs?.hash !== hash || recomputedSource !== hash || recomputedDist !== receipt.dist?.hash ||
      !(receipt.counts?.passed > 0) || (receipt.failedTests?.length ?? 0) || (receipt.failedFiles?.length ?? 0) ||
      Object.entries(receipt.counts ?? {}).some(([key, value]) => !["passed", "skipped"].includes(key) && value > 0) ||
      !receipt.commands?.some((command) => Array.isArray(command) && command.includes("test")) ||
      !testLog.includes(`${receipt.counts.passed} passed`) ||
      (receipt.counts.skipped > 0 && !testLog.includes(`${receipt.counts.skipped} skipped`))) {
    fail("previous full-test receipt or log is incomplete");
  }
}

async function artifactSnapshot(manifest) {
  if (!manifest) fail("built artifact manifest missing");
  return {
    files: manifest.files,
    sbom: await readFile(path.join(rootDir, "dist", "SBOM.cdx.json"), "utf8"),
    licenses: await readFile(path.join(rootDir, "dist", "THIRD_PARTY_LICENSES.md"), "utf8"),
  };
}

export async function runVersionOnlyRelease({ initialSource, candidate }) {
  try {
    const existing = await readReceipt("release", initialSource.hash);
    if (existing?.result === "passed") {
      const dist = await computeDistManifest();
      if (!isCurrentReceiptReusable(existing, initialSource.hash, dist?.hash)) fail("verified dist changed; use the normal release verifier");
      emit({ gate: "release", status: "reused", inputHash: initialSource.hash, distHash: dist.hash,
        verifiedAt: existing.finishedAt, reusedTestsFrom: existing.reusedTests?.inputHash ?? null });
      return;
    }
    const baseArg = process.argv.find((arg) => arg.startsWith("--reuse-version-only="));
    const dirArg = process.argv.find((arg) => arg.startsWith("--version-baseline="));
    const baseHash = baseArg?.slice("--reuse-version-only=".length);
    if (!/^[a-f0-9]{64}$/.test(baseHash ?? "") || !dirArg || candidate?.inputHash !== initialSource.hash) {
      fail("baseline hash, baseline directory, or frozen candidate missing");
    }
    const baselineDir = path.resolve(rootDir, dirArg.slice("--version-baseline=".length));
    const relative = path.relative(cacheDir, baselineDir);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("baseline must be in .op-cache");
    const previous = await readReceipt("release", baseHash);
    const latest = (await listReceipts("release"))[0];
    if (latest?.result === "failed") fail("a recent full-test failure still requires its normal repair gate");
    const testPath = path.resolve(rootDir, previous?.logs?.test ?? "");
    const logRelative = path.relative(path.join(cacheDir, "logs"), testPath);
    if (!logRelative || logRelative.startsWith("..") || path.isAbsolute(logRelative)) fail("previous test log path is invalid");
    const testLog = await readFile(testPath, "utf8");
    assertPriorReceipt(previous, baseHash, testLog);
    assertSourceEquivalence(previous.inputs, initialSource);
    const oldFiles = fileMap(previous.inputs.files);
    const previousPackageBytes = await readFile(path.join(baselineDir, "baseline-package.json"));
    const previousLockBytes = await readFile(path.join(baselineDir, "baseline-package-lock.json"));
    const previousVerifierBytes = await readFile(path.join(baselineDir, "baseline-verify-release.mjs"));
    for (const [name, bytes] of [["package.json", previousPackageBytes], ["package-lock.json", previousLockBytes],
      ["tools/verify-release.mjs", previousVerifierBytes]]) {
      if (sha256(normalizeManifestContent(name, bytes)) !== oldFiles.get(name)) fail(`baseline input mismatch: ${name}`);
    }
    const currentPackageBytes = await readFile(path.join(rootDir, "package.json"));
    const currentLockBytes = await readFile(path.join(rootDir, "package-lock.json"));
    const currentVerifierBytes = await readFile(path.join(rootDir, "tools", "verify-release.mjs"));
    assertVerifierChange(previousVerifierBytes.toString("utf8"), currentVerifierBytes.toString("utf8"));
    const versions = assertVersionManifests(JSON.parse(previousPackageBytes), JSON.parse(previousLockBytes),
      JSON.parse(currentPackageBytes), JSON.parse(currentLockBytes));
    versions.previousLockHash = sha256(previousLockBytes);
    versions.currentLockHash = sha256(currentLockBytes);
    const before = {
      files: previous.dist.files,
      sbom: await readFile(path.join(baselineDir, "baseline-SBOM.cdx.json"), "utf8"),
      licenses: await readFile(path.join(baselineDir, "baseline-THIRD_PARTY_LICENSES.md"), "utf8"),
    };
    const startedAt = new Date().toISOString();
    const unit = await runCaptured(process.execPath, ["--test", "tools/release-version-equivalence.test.mjs"],
      { gate: "release-version-unit" });
    if (unit.exitCode !== 0) {
      emit(failureSummary(unit, { gate: "release-version-unit", inputHash: initialSource.hash }));
      process.exitCode = unit.exitCode || 1;
      return;
    }
    if (!process.env.npm_execpath) fail("run through npm run verify:release");
    const build = await runCaptured(process.execPath, [process.env.npm_execpath, "run", "build:web"],
      { gate: "release-version-build" });
    if (build.exitCode !== 0) {
      emit(failureSummary(build, { gate: "release-version-build", inputHash: initialSource.hash }));
      process.exitCode = build.exitCode || 1;
      return;
    }
    const afterSource = await computeSourceManifest();
    if (afterSource.hash !== initialSource.hash) fail("source changed during version build");
    const dist = await computeDistManifest();
    const after = await artifactSnapshot(dist);
    assertArtifactEquivalence(before, after, versions);
    const receipt = {
      schemaVersion: 1, gate: "release", inputHash: initialSource.hash, inputs: initialSource,
      git: gitEvidence(), startedAt, finishedAt: new Date().toISOString(), result: "passed",
      failedStage: null, failedTests: [], failedFiles: [], counts: previous.counts, dist,
      commands: [[process.execPath, "--test", "tools/release-version-equivalence.test.mjs"], ["npm", "run", "build:web"]],
      reusedTests: { inputHash: baseHash, finishedAt: previous.finishedAt, command: previous.commands.find((c) => c.includes("test")),
        counts: previous.counts, log: previous.logs.test },
      versionOnlyEvidence: { ...versions, previousDistHash: previous.dist.hash,
        baselineDir: path.relative(rootDir, baselineDir).replaceAll("\\", "/") },
      logs: { unit: compactLogPath(unit.logPath), build: compactLogPath(build.logPath), test: previous.logs.test },
    };
    await writeReceipt("release", initialSource.hash, receipt);
    emit({ gate: "release", status: "passed-version-only", inputHash: initialSource.hash, distHash: dist.hash,
      reusedTestsFrom: baseHash, counts: previous.counts, versions, logs: receipt.logs });
  } catch (error) {
    emit({ gate: "release", status: "blocked", reason: error?.message ?? String(error) });
    process.exitCode = 3;
  }
}
