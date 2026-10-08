import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateOfflineManifest } from "../platform/shared/offline-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetId = process.argv[process.argv.indexOf("--target") + 1];
if (!targetId) throw new Error("usage: node tools/platform-target.mjs --target <target-id>");
const targetRoot = path.join(root, "platform", targetId);
const manifest = JSON.parse(await readFile(path.join(targetRoot, "project.json"), "utf8"));
const resources = JSON.parse(await readFile(path.join(targetRoot, "resources", "offline-manifest.json"), "utf8"));
validateOfflineManifest(resources);
if (manifest.targetId !== targetId || !["project-source", "contract-only"].includes(manifest.sourceStatus)) throw new Error(`${targetId}: source/contract status is missing`);
const missing = (manifest.requiredTools ?? []).filter((tool) => !tool.available);
const report = {
  targetId,
  sourceReady: manifest.sourceReady === true,
  sourceStatus: manifest.sourceStatus,
  devBuild: manifest.buildEvidence?.status ?? (missing.length === 0 ? "eligible" : "blocked"),
  installable: "blocked",
  signedOrNotarized: "blocked",
  deviceVerified: "blocked",
  websiteReady: "blocked",
  blockingTools: missing.map(({ name, reason }) => ({ name, reason })),
  entry: manifest.entry,
  offlineResourceCount: resources.resources.length,
  command: manifest.build.command,
  buildEvidence: manifest.buildEvidence ?? null,
};
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--strict") && missing.length) process.exitCode = 2;
