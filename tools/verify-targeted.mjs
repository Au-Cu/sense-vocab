import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanupCache,
  compactLogPath,
  computeSourceManifest,
  emit,
  failureSummary,
  logDir,
  rootDir,
  runCaptured,
  timestampToken,
  writeReceipt,
} from "./op-verification-lib.mjs";

const selectors = process.argv.slice(2);
if (selectors[0] === "--") selectors.shift();
if (!selectors.length || selectors.some((value) => value.startsWith("--reporter"))) {
  emit({
    status: "blocked",
    reason: "Provide at least one spec, grep, project, or line selector; reporter overrides are not allowed.",
  });
  process.exitCode = 2;
} else {
  await cleanupCache();
  const source = await computeSourceManifest();
  const summaryPath = path.join(logDir, `${timestampToken()}-targeted-summary.json`);
  const playwrightCli = path.join(rootDir, "node_modules", "@playwright", "test", "cli.js");
  const command = [
    playwrightCli,
    "test",
    ...selectors,
    "--reporter=dot,./tools/compact-playwright-reporter.cjs",
  ];
  const result = await runCaptured(process.execPath, command, {
    gate: "targeted",
    env: { SENSE_VOCAB_TEST_SUMMARY_PATH: summaryPath },
  });
  let summary = { counts: {}, tests: [] };
  try {
    summary = JSON.parse(await readFile(summaryPath, "utf8"));
  } catch {
    // Missing structured output is treated as a failed verification below.
  }
  const passedTests = summary.tests.filter((test) => test.status === "passed");
  const failedTests = summary.tests.filter((test) => test.status !== "passed" && test.status !== "skipped");
  const receipt = {
    schemaVersion: 1,
    gate: "playwright-targeted",
    inputHash: source.hash,
    inputs: source,
    command: [process.execPath, ...command],
    startedAt: new Date(Date.now() - result.durationMs).toISOString(),
    finishedAt: new Date().toISOString(),
    result: result.exitCode === 0 && summary.tests.length ? "passed" : "failed",
    passedTests: passedTests.map((test) => test.id),
    passedFiles: [...new Set(passedTests.map((test) => test.file))],
    failedTests: failedTests.map((test) => test.id),
    failedFiles: [...new Set(failedTests.map((test) => test.file))],
    counts: summary.counts,
    log: compactLogPath(result.logPath),
  };
  await writeReceipt("targeted", `${source.hash}-${Date.now()}`, receipt);
  if (receipt.result !== "passed") {
    emit(failureSummary(result, {
      gate: "playwright-targeted",
      inputHash: source.hash,
      counts: summary.counts,
      failed: receipt.failedTests,
    }));
    process.exitCode = result.exitCode || 1;
  } else {
    emit({
      gate: "playwright-targeted",
      status: "passed",
      inputHash: source.hash,
      counts: summary.counts,
      durationMs: result.durationMs,
      log: receipt.log,
    });
  }
}
