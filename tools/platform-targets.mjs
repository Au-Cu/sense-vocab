import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(await readFile(path.join(root, "platform/platform-matrix.json"), "utf8"));
const reports = [];
for (const target of matrix.nativeTargets) {
  const { stdout } = await exec(process.execPath, [path.join(root, "tools/platform-target.mjs"), "--target", target.id], { cwd: root });
  reports.push(JSON.parse(stdout));
}
console.log(JSON.stringify({ targets: reports }, null, 2));
