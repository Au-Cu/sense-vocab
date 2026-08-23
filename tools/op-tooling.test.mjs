import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyRisk,
  normalizeManifestContent,
  rootDir,
} from "./op-verification-lib.mjs";

test("package version changes invalidate verification inputs", () => {
  const left = normalizeManifestContent(
    "package.json",
    Buffer.from(JSON.stringify({ name: "sense", version: "1.0.0", scripts: { test: "x" } })),
  );
  const right = normalizeManifestContent(
    "package.json",
    Buffer.from(JSON.stringify({ name: "sense", version: "2.0.0", scripts: { test: "x" } })),
  );
  assert.notDeepEqual(left, right);

  const lockLeft = normalizeManifestContent(
    "package-lock.json",
    Buffer.from(JSON.stringify({
      name: "sense",
      version: "1.0.0",
      packages: { "": { version: "1.0.0", dependencies: { x: "1.0.0" } } },
    })),
  );
  const lockRight = normalizeManifestContent(
    "package-lock.json",
    Buffer.from(JSON.stringify({
      name: "sense",
      version: "2.0.0",
      packages: { "": { version: "2.0.0", dependencies: { x: "1.0.0" } } },
    })),
  );
  assert.notDeepEqual(lockLeft, lockRight);
});

test("risk classification preserves content, database, and release escalation", () => {
  assert.equal(classifyRisk(["docs/CURRENT.md"]), "T0");
  assert.equal(classifyRisk(["data/content-rights-summary.json"]), "T1");
  assert.equal(classifyRisk(["data/vocabulary-bundle.json"]), "T2");
  assert.equal(classifyRisk(["supabase/migrations/example.sql"]), "T3");
  assert.equal(classifyRisk([], { release: true }), "T4");
});

test("op snapshot returns one structured line with no diff body", () => {
  const output = execFileSync(process.execPath, ["tools/op-snapshot.mjs"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  assert.equal(output.trim().split(/\r?\n/).length, 1);
  const snapshot = JSON.parse(output);
  assert.equal(snapshot.cwd, rootDir);
  assert.match(snapshot.head, /^[0-9a-f]{40}$/);
  assert.ok(Array.isArray(snapshot.changed));
  assert.equal(Object.hasOwn(snapshot, "diff"), false);
});

test("compact command wrapper can launch npm on Windows without streaming logs", () => {
  const output = execFileSync(
    process.execPath,
    ["tools/run-compact-command.mjs", "--", "npm", "--version"],
    { cwd: rootDir, encoding: "utf8" },
  );
  assert.equal(output.trim().split(/\r?\n/).length, 1);
  const summary = JSON.parse(output);
  assert.equal(summary.status, "passed");
  assert.equal(summary.gate, "compact");
});

test("feedback triage is read-only and excludes identity fields", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260822144248_admin_feedback_triage_readonly.sql", import.meta.url),
    "utf8",
  );
  const triage = migration
    .split("create or replace function public.admin_feedback_triage", 2)[1]
    .split("create or replace function public.admin_feedback_detail", 1)[0];
  assert.ok(triage);
  assert.doesNotMatch(triage, /\b(?:insert|update|delete|truncate)\b/i);
  assert.doesNotMatch(triage, /'email'|'message'|'imagePaths'|'userId'/);
  assert.match(triage, /'anonymousId'/);
  assert.match(triage, /'contentId'/);
});

test("triage client does not call destructive feedback retention", async () => {
  const source = await readFile(new URL("./cloud-client-entry.js", import.meta.url), "utf8");
  const method = source
    .split("async loadAdminFeedbackTriage", 2)[1]
    .split("async loadAdminFeedbackDetail", 1)[0];
  assert.ok(method);
  assert.doesNotMatch(method, /admin_expired_feedback|admin_delete_expired_feedback|\.remove\(/);
  assert.match(method, /admin_feedback_triage/);
});
