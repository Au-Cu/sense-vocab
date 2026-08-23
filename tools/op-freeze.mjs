import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cacheDir,
  cleanupCache,
  computeSourceManifest,
  emit,
  gitEvidence,
} from "./op-verification-lib.mjs";

await cleanupCache();
const source = await computeSourceManifest();
const marker = {
  schemaVersion: 1,
  inputHash: source.hash,
  frozenAt: new Date().toISOString(),
  git: gitEvidence(),
};
await writeFile(
  path.join(cacheDir, "candidate.json"),
  `${JSON.stringify(marker, null, 2)}\n`,
  "utf8",
);
emit({
  gate: "candidate-freeze",
  status: "frozen",
  inputHash: source.hash,
  changed: marker.git.status.length,
});
