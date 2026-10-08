import path from "node:path";
import { fileURLToPath } from "node:url";
import { access, readFile } from "node:fs/promises";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(await readFile(path.join(rootDir, "platform", "platform-matrix.json"), "utf8"));
const expected = ["windows-x86_64", "windows-arm64", "macos-x86_64", "macos-arm64", "ios", "android", "harmonyos"];
const actual = matrix.nativeTargets.map((target) => target.id);
if (matrix.schemaVersion !== 1 || matrix.webTarget?.status !== "available") throw new Error("Invalid platform matrix header");
if (matrix.versioning?.scheme !== "independent-per-target") throw new Error("Native versioning must be independent per target");
if (actual.length !== expected.length || expected.some((id, index) => actual[index] !== id)) {
  throw new Error(`Platform matrix must contain exactly the seven ordered native targets: ${expected.join(", ")}`);
}
for (const target of matrix.nativeTargets) {
  for (const field of ["id", "os", "architecture", "packageFormat", "status", "publicDistribution"]) {
    if (!target[field]) throw new Error(`${target.id || "unknown"} is missing ${field}`);
  }
  if (target.publicDistribution !== "website-only") throw new Error(`${target.id} changed distribution policy`);
  if (!Array.isArray(target.requiredTools) || target.requiredTools.length === 0) throw new Error(`${target.id} has no toolchain evidence boundary`);
  if (target.versioning?.productVersion !== "0.0.0" || target.versioning?.buildNumber !== 0 || target.versioning?.releaseStatus !== "not-built") {
    throw new Error(`${target.id} must start at product version 0.0.0/build 0 and remain not-built`);
  }
  if (target.artifactNaming !== matrix.versioning.artifactNamingTemplate || target.updatePolicy !== "target-scoped" || !target.rollbackPolicy) {
    throw new Error(`${target.id} is missing target-scoped artifact/update/rollback metadata`);
  }
  const project = JSON.parse(await readFile(path.join(rootDir, target.projectPath, "project.json"), "utf8"));
  if (!target.projectPath || !["project-source", "contract-only"].includes(target.sourceStatus) || project.sourceStatus !== target.sourceStatus) throw new Error(`${target.id} is missing source/contract status metadata`);
  for (const file of ["project.json", project.entry, "resources/offline-manifest.json", "tests/fixture.json", "README.md"]) {
    await access(path.join(rootDir, target.projectPath, file));
  }
}
console.log(JSON.stringify({
  schemaVersion: matrix.schemaVersion,
  web: matrix.webTarget,
  nativeTargets: matrix.nativeTargets.map(({ id, os, architecture, packageFormat, status }) => ({ id, os, architecture, packageFormat, status })),
}, null, 2));
