import {
  cleanupCache,
  compactLogPath,
  computeDistManifest,
  computeSourceManifest,
  emit,
  failureSummary,
  readReceipt,
  rootDir,
  runCaptured,
} from "./op-verification-lib.mjs";
import path from "node:path";

await cleanupCache();
const source = await computeSourceManifest();
const receipt = await readReceipt("release", source.hash);
const dist = await computeDistManifest();

if (
  receipt?.result !== "passed" ||
  !dist ||
  receipt.dist?.hash !== dist.hash
) {
  emit({
    gate: "deploy-verified",
    status: "blocked",
    reason: "Current relevant inputs and dist do not match a successful release receipt.",
    inputHash: source.hash,
    currentDistHash: dist?.hash ?? null,
    verifiedDistHash: receipt?.dist?.hash ?? null,
  });
  process.exitCode = 3;
} else if (process.argv.includes("--check")) {
  emit({
    gate: "deploy-verified",
    status: "ready",
    inputHash: source.hash,
    distHash: dist.hash,
    verifiedAt: receipt.finishedAt,
  });
} else {
  const script = path.join(rootDir, "tools", "run-wrangler.ps1");
  const result = await runCaptured(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "pages",
      "deploy",
      "dist",
      "--project-name=sense-vocab",
    ],
    { gate: "deploy-verified" },
  );
  if (result.exitCode !== 0) {
    emit(failureSummary(result, {
      gate: "deploy-verified",
      inputHash: source.hash,
      distHash: dist.hash,
    }));
    process.exitCode = result.exitCode;
  } else {
    const urls = [...new Set(result.tail.match(/https:\/\/[^\s]+\.pages\.dev\/?/g) ?? [])];
    emit({
      gate: "deploy-verified",
      status: "deployed",
      inputHash: source.hash,
      distHash: dist.hash,
      urls,
      durationMs: result.durationMs,
      log: compactLogPath(result.logPath),
    });
  }
}
