import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i].startsWith("--")) args.set(process.argv[i], process.argv[i + 1]);
const targetId = args.get("--target");
const output = args.get("--out");
if (!targetId || !output) throw new Error("usage: node tools/package-offline-resources.mjs --target <target-id> --out <directory>");
const targetRoot = path.join(root, "platform", targetId);
const outputRoot = path.resolve(root, output);
const resources = ["data/vocabulary-bundle.json", "data/vocabulary-index.json"];
const entries = [];
for (const relative of resources) {
  const source = path.join(root, relative);
  const bytes = await readFile(source);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const destination = path.join(outputRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  entries.push({ path: relative, bytes: bytes.byteLength, sha256, required: true });
}
await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "offline-manifest.json"), JSON.stringify({ schemaVersion: 1, targetId, verification: "built", resources: entries }, null, 2) + "\n");
console.log(JSON.stringify({ targetId, output: outputRoot, resources: entries }, null, 2));
