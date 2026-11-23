import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

// This is a fail-closed publication guard, not an automated legal opinion.
// A human review must explicitly bind evidence and scope to these exact files.
const REQUIRED_EVIDENCE = ["source", "model", "training", "input", "output", "visualization"];
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const safeRelative = (value) => typeof value === "string" && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(value) &&
  !value.split("/").some((part) => part === "." || part === "..");

// Candidate assets are intentionally gitignored before clearance. Include the
// selected version in source freezes anyway, so a changed ignored file cannot
// reuse an earlier verification receipt. A malformed manifest still gets
// hashed, and verifyUniverseForBuild subsequently rejects it.
export async function discoverUniverseSourcePaths(rootDir) {
  const manifestPath = "data/universes/manifest.json";
  let bytes;
  try { bytes = await readFile(path.join(rootDir, ...manifestPath.split("/"))); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  const paths = [manifestPath];
  let manifest;
  try { manifest = JSON.parse(bytes.toString("utf8")); } catch { return paths; }
  if (!/^[a-f0-9]{16}$/.test(manifest.version || "") || !Array.isArray(manifest.files)) return paths;
  for (const file of manifest.files) if (safeRelative(file?.path)) {
    paths.push(`data/universes/${manifest.version}/${file.path}`);
  }
  return [...new Set(paths)];
}

export async function verifyUniverseForBuild(rootDir) {
  const directory = path.join(rootDir, "data", "universes");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  } catch {
    throw new Error("Universe assets missing or invalid: generate and review before building a release.");
  }
  const version = manifest.version;
  if (manifest.schema !== 1 || !/^[a-f0-9]{16}$/.test(version || "") ||
      manifest.index !== `./${version}/index.json`) throw new Error("Invalid universe version or index path.");
  const bundleHash = sha256(await readFile(path.join(rootDir, "data", "vocabulary-bundle.json")));
  if (manifest.bundleSha256 !== bundleHash) throw new Error("Universe data does not match this vocabulary bundle.");
  const clearance = manifest.clearance;
  if (manifest.distribution !== "cleared-for-release" || clearance?.status !== "approved" ||
      typeof clearance.reviewer !== "string" || !clearance.reviewer.trim() ||
      typeof clearance.reviewedAt !== "string" || !Number.isFinite(Date.parse(clearance.reviewedAt)) ||
      typeof clearance.scope !== "string" || !clearance.scope.trim() ||
      REQUIRED_EVIDENCE.some((key) => !Array.isArray(clearance.evidence?.[key]) ||
        !clearance.evidence[key].length || clearance.evidence[key].some((item) => typeof item !== "string" || !item.trim()))) {
    throw new Error("Universe publication blocked: source, model, training, input, output and visualization rights require recorded review.");
  }
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error("Universe artifact checksums missing.");
  const files = [...manifest.files].sort((a, b) => String(a.path) < String(b.path) ? -1 : String(a.path) > String(b.path) ? 1 : 0);
  if (clearance.artifactsSha256 !== sha256(JSON.stringify(files))) throw new Error("Universe review does not cover these artifact checksums.");
  const seen = new Set();
  for (const file of files) {
    if (!safeRelative(file.path) || seen.has(file.path) ||
        !/^[a-f0-9]{64}$/.test(file.sha256 || "") || !Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new Error("Invalid universe artifact entry.");
    }
    seen.add(file.path);
    const artifact = path.join(directory, version, ...file.path.split("/"));
    if (!(await lstat(artifact)).isFile()) throw new Error("Universe artifact is not a regular file.");
    const bytes = await readFile(artifact);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Universe artifact changed: ${file.path}`);
  }
  if (!["index.json", "report.json", "WORDNET-3.0-LICENSE.txt"].every((name) => seen.has(name)) ||
      !files.some((file) => /^synonym\/\d-\d\.json$/.test(file.path)) ||
      !files.some((file) => /^spelling\/\d-\d\.json$/.test(file.path))) throw new Error("Universe artifact set is incomplete.");
  const index = JSON.parse(await readFile(path.join(directory, version, "index.json"), "utf8"));
  if (index.version !== version || index.bundleSha256 !== bundleHash || !Array.isArray(index.nodes) || !index.nodes.length) {
    throw new Error("Universe index does not match the reviewed vocabulary.");
  }
  return { directory, version, files };
}
