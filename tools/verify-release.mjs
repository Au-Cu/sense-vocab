import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  cacheDir,
  cleanupCache,
  compactLogPath,
  computeDistManifest,
  computeSourceManifest,
  emit,
  failureSummary,
  gitEvidence,
  listReceipts,
  logDir,
  readReceipt,
  rootDir,
  runCaptured,
  timestampToken,
  writeReceipt,
} from "./op-verification-lib.mjs";

function block(reason, extra = {}) {
  emit({ gate: "release", status: "blocked", reason, ...extra });
  process.exitCode = 3;
}

function npmRun(script) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error("npm_execpath is unavailable; run this gate through npm run verify:release.");
  }
  return {
    command: process.execPath,
    args: [npmCli, "run", script],
  };
}

async function loadCandidate() {
  try {
    return JSON.parse(await readFile(path.join(cacheDir, "candidate.json"), "utf8"));
  } catch {
    return null;
  }
}

async function readSummary(summaryPath) {
  try {
    return JSON.parse(await readFile(summaryPath, "utf8"));
  } catch {
    return { counts: {}, tests: [] };
  }
}

async function priorFailureRepairSatisfied(sourceHash, failure) {
  if (!failure?.failedFiles?.length) return true;
  const receipts = await listReceipts("targeted");
  const matching = receipts.filter((receipt) => (
    receipt.result === "passed" &&
    receipt.inputHash === sourceHash &&
    String(receipt.finishedAt) > String(failure.finishedAt)
  ));
  const passedFiles = new Set(matching.flatMap((receipt) => receipt.passedFiles ?? []));
  return failure.failedFiles.every((file) => passedFiles.has(file));
}

await cleanupCache();
const requireFreeze = process.argv.includes("--require-freeze");
const initialSource = await computeSourceManifest();
const candidate = await loadCandidate();

if (requireFreeze && candidate?.inputHash !== initialSource.hash) {
  block("Candidate is not frozen for the current relevant inputs. Run npm run op:freeze after targeted tests pass.", {
    inputHash: initialSource.hash,
  });
} else {
  const priorSuccess = await readReceipt("release", initialSource.hash);
  if (priorSuccess?.result === "passed") {
    let dist = await computeDistManifest();
    if (!dist || dist.hash !== priorSuccess.dist?.hash) {
      const buildCommand = npmRun("build:web");
      const build = await runCaptured(
        buildCommand.command,
        buildCommand.args,
        { gate: "release-build-recreate" },
      );
      if (build.exitCode !== 0) {
        emit(failureSummary(build, {
          gate: "release-build-recreate",
          inputHash: initialSource.hash,
        }));
        process.exitCode = build.exitCode;
      } else {
        const afterBuild = await computeSourceManifest();
        dist = await computeDistManifest();
        if (
          afterBuild.hash !== initialSource.hash ||
          !dist ||
          dist.hash !== priorSuccess.dist?.hash
        ) {
          block("A previously verified input rebuilt to a different source or dist hash; do not reuse or rerun the full gate until the drift is explained.", {
            inputHash: initialSource.hash,
            previousDistHash: priorSuccess.dist?.hash ?? null,
            currentDistHash: dist?.hash ?? null,
          });
        } else {
          emit({
            gate: "release",
            status: "reused",
            inputHash: initialSource.hash,
            distHash: dist.hash,
            verifiedAt: priorSuccess.finishedAt,
            buildLog: compactLogPath(build.logPath),
          });
        }
      }
    } else {
      emit({
        gate: "release",
        status: "reused",
        inputHash: initialSource.hash,
        distHash: dist.hash,
        verifiedAt: priorSuccess.finishedAt,
      });
    }
  } else {
    const releaseReceipts = await listReceipts("release");
    const latestRelease = releaseReceipts[0] ?? null;
    const retryableBuildFailure = latestRelease?.result === "failed" &&
      latestRelease.inputHash === initialSource.hash &&
      latestRelease.failedStage === "build" &&
      !(latestRelease.failedFiles?.length) &&
      !(latestRelease.failedTests?.length);
    const retryableTestSetupFailure = latestRelease?.result === "failed" &&
      latestRelease.inputHash === initialSource.hash &&
      latestRelease.failedStage === "test" &&
      !(latestRelease.failedFiles?.length) &&
      !(latestRelease.failedTests?.length) &&
      Object.keys(latestRelease.counts ?? {}).length === 0;
    const retryableInfrastructureFailure = retryableBuildFailure || retryableTestSetupFailure;
    if (
      latestRelease?.result === "failed" &&
      latestRelease.inputHash === initialSource.hash &&
      !retryableInfrastructureFailure
    ) {
      block("The full gate already failed for this frozen input. Change a relevant input, make the failed spec pass in verify:targeted, then freeze again.", {
        inputHash: initialSource.hash,
        failedFiles: latestRelease.failedFiles ?? [],
      });
    } else if (
      latestRelease?.result === "failed" &&
      !await priorFailureRepairSatisfied(initialSource.hash, latestRelease)
    ) {
      block("The most recent full-test failures have not passed as targeted tests on the current input.", {
        inputHash: initialSource.hash,
        failedFiles: latestRelease.failedFiles ?? [],
      });
    } else {
      const startedAt = new Date().toISOString();
      const buildCommand = npmRun("build:web");
      const build = await runCaptured(
        buildCommand.command,
        buildCommand.args,
        { gate: "release-build" },
      );
      if (build.exitCode !== 0) {
        const receipt = {
          schemaVersion: 1,
          gate: "release",
          inputHash: initialSource.hash,
          inputs: initialSource,
          git: gitEvidence(),
          commands: [["npm", "run", "build:web"]],
          startedAt,
          finishedAt: new Date().toISOString(),
          result: "failed",
          failedStage: "build",
          failedTests: [],
          failedFiles: [],
          logs: { build: compactLogPath(build.logPath) },
        };
        await writeReceipt("release", initialSource.hash, receipt);
        emit(failureSummary(build, {
          gate: "release-build",
          inputHash: initialSource.hash,
        }));
        process.exitCode = build.exitCode;
      } else {
        const afterBuild = await computeSourceManifest();
        if (afterBuild.hash !== initialSource.hash) {
          block("Relevant inputs changed during build; freeze the resulting candidate before any full test.", {
            before: initialSource.hash,
            after: afterBuild.hash,
          });
        } else {
          const summaryPath = path.join(logDir, `${timestampToken()}-release-test-summary.json`);
          const playwrightCli = path.join(rootDir, "node_modules", "@playwright", "test", "cli.js");
          const testCommand = [
            playwrightCli,
            "test",
            "--reporter=dot,./tools/compact-playwright-reporter.cjs",
          ];
          const tests = await runCaptured(process.execPath, testCommand, {
            gate: "release-test",
            env: { SENSE_VOCAB_TEST_SUMMARY_PATH: summaryPath },
          });
          const summary = await readSummary(summaryPath);
          const failed = summary.tests.filter((test) => (
            test.status !== "passed" && test.status !== "skipped"
          ));
          const dist = await computeDistManifest();
          const passed = tests.exitCode === 0 && summary.tests.length > 0 && dist;
          const receipt = {
            schemaVersion: 1,
            gate: "release",
            inputHash: initialSource.hash,
            inputs: initialSource,
            git: gitEvidence(),
            commands: [
              ["npm", "run", "build:web"],
              [process.execPath, ...testCommand],
            ],
            startedAt,
            finishedAt: new Date().toISOString(),
            result: passed ? "passed" : "failed",
            failedStage: passed ? null : "test",
            failedTests: failed.map((test) => test.id),
            failedFiles: [...new Set(failed.map((test) => test.file))],
            counts: summary.counts,
            dist,
            logs: {
              build: compactLogPath(build.logPath),
              test: compactLogPath(tests.logPath),
            },
          };
          await writeReceipt("release", initialSource.hash, receipt);
          if (!passed) {
            emit(failureSummary(tests, {
              gate: "release-test",
              inputHash: initialSource.hash,
              counts: summary.counts,
              failed: receipt.failedTests,
            }));
            process.exitCode = tests.exitCode || 1;
          } else {
            emit({
              gate: "release",
              status: "passed",
              inputHash: initialSource.hash,
              distHash: dist.hash,
              counts: summary.counts,
              durationMs: build.durationMs + tests.durationMs,
              logs: receipt.logs,
            });
          }
        }
      }
    }
  }
}
