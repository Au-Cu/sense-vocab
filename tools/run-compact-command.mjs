import {
  cleanupCache,
  compactLogPath,
  emit,
  failureSummary,
  runCaptured,
} from "./op-verification-lib.mjs";

const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
if (!args.length) {
  emit({ status: "blocked", reason: "Pass a command after --." });
  process.exitCode = 2;
} else {
  await cleanupCache();
  let [command, ...commandArgs] = args;
  if (
    process.platform === "win32" &&
    /^(?:npm|npm\.cmd)$/i.test(command) &&
    process.env.npm_execpath
  ) {
    commandArgs = [process.env.npm_execpath, ...commandArgs];
    command = process.execPath;
  }
  const result = await runCaptured(command, commandArgs, { gate: "compact" });
  if (result.exitCode !== 0) {
    emit(failureSummary(result, { gate: "compact" }));
    process.exitCode = result.exitCode;
  } else {
    emit({
      gate: "compact",
      status: "passed",
      durationMs: result.durationMs,
      log: compactLogPath(result.logPath),
    });
  }
}
