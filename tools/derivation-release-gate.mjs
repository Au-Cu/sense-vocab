import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

const WORDNET_SHA256 = "cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Include ignored candidate data in freezes even before it is staged. A
// malformed manifest is still hashed and subsequently rejected by the gate.
export async function discoverDerivationSourcePaths(rootDir) {
  const manifestPath = "data/derivations/manifest.json";
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(rootDir, manifestPath), "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return []; return [manifestPath]; }
  const paths = [manifestPath];
  if (/^[a-f0-9]{16}$/.test(manifest.version || "") && Array.isArray(manifest.files)) {
    for (const file of manifest.files) {
      if (file?.path === "index.json" || /^derivation\/[0-7]-[0-7]\.json$/.test(file?.path || "")) {
        paths.push(`data/derivations/${manifest.version}/${file.path}`);
      }
    }
  }
  return paths;
}

// This validates a recorded human review and exact files, not legal ownership
// or the correctness of every individual derivational relationship.
export async function verifyDerivationsForBuild(rootDir) {
  const directory = path.join(rootDir, "data", "derivations");
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")); }
  catch { throw new Error("Derivation assets are missing or invalid."); }
  if (manifest.schema !== 1 || !/^[a-f0-9]{16}$/.test(manifest.version || "") ||
      manifest.index !== `./${manifest.version}/index.json` ||
      !/^[a-f0-9]{64}$/.test(manifest.artifactListSha256 || "") ||
      manifest.source?.archiveSha256 !== WORDNET_SHA256) throw new Error("Invalid derivation manifest.");
  const bundleHash = sha256(await readFile(path.join(rootDir, "data", "vocabulary-bundle.json")));
  const universe = JSON.parse(await readFile(path.join(rootDir, "data", "universes", "manifest.json"), "utf8"));
  if (manifest.bundleSha256 !== bundleHash || manifest.baseUniverseVersion !== universe.version ||
      universe.bundleSha256 !== bundleHash) throw new Error("Derivation data does not match the vocabulary universe.");
  const oldIndex = await readFile(path.join(rootDir, "data", "universes", universe.version, "index.json"));
  if (manifest.source.baseIndexSha256 !== sha256(oldIndex)) throw new Error("Derivation source index has changed.");
  const sourceScript = await readFile(path.join(rootDir, "tools", "build_wordnet_derivations.py"));
  if (manifest.source.generatorSha256 !== sha256(sourceScript)) throw new Error("Derivation generator has changed since generation.");
  const review = manifest.review;
  if (manifest.distribution !== "cleared-for-release" || review?.status !== "approved" ||
      typeof review.reviewer !== "string" || !review.reviewer.trim() ||
      typeof review.reviewedAt !== "string" || !Number.isFinite(Date.parse(review.reviewedAt)) ||
      typeof review.scope !== "string" || !review.scope.trim() ||
      review.artifactListSha256 !== manifest.artifactListSha256 ||
      !Array.isArray(review.evidence) || !review.evidence.length ||
      review.evidence.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("Derivation publication requires recorded review of this exact asset and scope.");
  }
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error("Derivation asset list is missing.");
  const files = [...manifest.files].sort((a, b) => String(a.path) < String(b.path) ? -1 : String(a.path) > String(b.path) ? 1 : 0);
  if (sha256(JSON.stringify(files)) !== manifest.artifactListSha256) throw new Error("Derivation review does not cover these files.");
  const seen = new Set();
  for (const file of files) {
    if (!(file.path === "index.json" || /^derivation\/[0-7]-[0-7]\.json$/.test(file.path || "")) ||
        seen.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256 || "") ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 1) throw new Error("Invalid derivation asset entry.");
    seen.add(file.path);
    const asset = path.join(directory, manifest.version, ...file.path.split("/"));
    if (!(await lstat(asset)).isFile()) throw new Error("Derivation asset is not a regular file.");
    const bytes = await readFile(asset);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Derivation asset checksum mismatch: ${file.path}`);
  }
  if (!seen.has("index.json") || !files.some((file) => file.path.startsWith("derivation/"))) throw new Error("Derivation asset set is incomplete.");
  const graph = JSON.parse(await readFile(path.join(directory, manifest.version, "index.json"), "utf8"));
  if (graph.schema !== 1 || graph.version !== manifest.version || graph.bundleSha256 !== bundleHash ||
      graph.baseUniverseVersion !== universe.version || graph.wordnetSha256 !== WORDNET_SHA256 ||
      !graph.counts || Array.isArray(graph.counts) || typeof graph.counts !== "object") {
    throw new Error("Derivation asset contents do not match their manifest.");
  }
  return { directory, version: manifest.version, files };
}
