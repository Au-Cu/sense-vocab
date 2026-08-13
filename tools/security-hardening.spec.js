const { readFile } = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const root = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("the public UI avoids executable HTML sinks", async () => {
  const sources = await Promise.all([
    read("app.js"),
    read("account.js"),
    read("admin.js"),
  ]);
  const source = sources.join("\n");
  expect(source).not.toMatch(/\b(?:innerHTML|outerHTML)\s*=/);
  expect(source).not.toMatch(/\binsertAdjacentHTML\s*\(/);
  expect(source).not.toMatch(/\b(?:eval|Function)\s*\(/);
  expect(source).not.toMatch(/\bdocument\.write\s*\(/);
});

test("deployment headers enforce transport and browser isolation", async () => {
  const headers = await read("_headers");
  expect(headers).toContain("Content-Security-Policy:");
  expect(headers).toContain("object-src 'none'");
  expect(headers).toContain("frame-ancestors 'none'");
  expect(headers).toContain("upgrade-insecure-requests");
  expect(headers).toContain("Strict-Transport-Security:");
  expect(headers).toContain("Cross-Origin-Opener-Policy: same-origin");
  expect(headers).toContain("X-Content-Type-Options: nosniff");
});

test("database writes are revision-gated and feedback uploads are row-bound", async () => {
  const migration = await read(
    "supabase/migrations/202607290001_security_hardening.sql",
  );
  expect(migration).toContain(
    "revoke all on table public.sense_progress from anon, authenticated",
  );
  expect(migration).toContain("public.can_upload_feedback_image(name)");
  expect(migration).toContain("pg_advisory_xact_lock");
  expect(migration).toContain("create or replace function public.attach_feedback_images");
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);
});

test("feedback quota expansion preserves the authenticated RPC boundary", async () => {
  const migration = await read(
    "supabase/migrations/20260812051224_increase_feedback_submission_limits.sql",
  );
  expect(migration).toContain(
    "perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 9137))",
  );
  expect(migration).toMatch(/interval '1 hour'[\s\S]*?\) >= 20 then/);
  expect(migration).toMatch(/interval '1 day'[\s\S]*?\) >= 60 then/);
  expect(migration).toContain("from public, anon");
  expect(migration).toContain("to authenticated");
  expect(migration).not.toMatch(/\b(?:delete|update)\s+public\.feedback_reports\b/i);
});

test("account snapshots block undeclared record loss and keep recovery copies private", async () => {
  const migration = await read(
    "supabase/migrations/202607310001_state_recovery_guard.sql",
  );
  expect(migration).toContain(
    "create table if not exists public.user_state_snapshots",
  );
  expect(migration).toContain("public.state_has_undeclared_deletions");
  expect(migration).toContain("'destructiveBlocked', true");
  expect(migration).toContain("'before_blocked_write'");
  expect(migration).toContain(
    "revoke all on table public.user_state_snapshots from public, anon, authenticated",
  );
  expect(migration).toContain(
    "grant execute on function public.save_user_state(jsonb, bigint, boolean)",
  );
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);
});

test("confusing-word account snapshots validate and guard every book", async () => {
  const migration = await read(
    "supabase/migrations/20260808150845_confusion_links_account_sync_guard.sql",
  );
  expect(migration).toContain("public.state_confusion_links_are_valid");
  expect(migration).toContain("user_state_meta_confusion_links_guard");
  expect(migration).toContain(
    "array['progress', 'activityLog', 'confusionLinks']",
  );
  expect(migration).toContain("v_existing_books = '{}'::jsonb");
  expect(migration).toContain("p_incoming -> 'confusionLinks'");
  expect(migration).toContain(
    "revoke all on function public.enforce_state_confusion_links()",
  );
  expect(migration).not.toContain("delete from public.user_state_snapshots");
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);
});

test("admin analytics aggregate book states without rewriting learning data", async () => {
  const migration = await read(
    "supabase/migrations/20260731015734_book_aware_admin_analytics.sql",
  );
  expect(migration).toContain("public.internal_user_activity_rows");
  expect(migration).toContain("public.internal_user_book_stats");
  expect(migration).toContain("meta.extra_state -> 'bookStates'");
  expect(migration).not.toContain("update public.user_state_meta");
  expect(migration).not.toContain("delete from public.sense_progress");
});

test("feedback is created before files are uploaded and then attached atomically", async () => {
  const client = await read("tools/cloud-client-entry.js");
  const createIndex = client.indexOf('client.rpc("submit_feedback"');
  const uploadIndex = client.indexOf(".upload(path, file");
  const attachIndex = client.indexOf('client.rpc("attach_feedback_images"');
  expect(createIndex).toBeGreaterThan(0);
  expect(uploadIndex).toBeGreaterThan(createIndex);
  expect(attachIndex).toBeGreaterThan(uploadIndex);
  expect(client).not.toContain('"image/gif"');
});

test("published vocabulary keeps stable word and sense identities", async () => {
  const result = await execFileAsync(
    process.execPath,
    [path.join(root, "tools", "content-identity.mjs")],
    { cwd: root },
  );
  expect(result.stdout).toContain("Content identity verified");

  const packageJson = JSON.parse(await read("package.json"));
  expect(packageJson.scripts["build:web"]).toMatch(
    /^npm run build:cloud-client && npm run build:confusion-globe && npm run build:vocabulary-index && npm run verify:content-identity && npm run audit:content && /,
  );
});

test("temporarily retained legacy media remains functional and explicitly audited", async () => {
  const [app, build, headers, sourcePolicy, rightsSummary] = await Promise.all([
    read("app.js"),
    read("tools/build-web.mjs"),
    read("_headers"),
    read("data/source-policy.json"),
    read("data/content-rights-summary.json"),
  ]);
  expect(app).toContain("dict.youdao.com");
  expect(headers).toContain("dict.youdao.com");
  expect(headers).toContain("upload.wikimedia.org");
  expect(app).toContain("speechSynthesis");
  expect(app).toContain("sense.audio");
  expect(build).not.toContain("delete sense.audio");
  expect(build).not.toContain('"kaoyan-source.json"');
  expect(sourcePolicy).toContain('"public distribution"');
  expect(sourcePolicy).toContain('"commercial publication"');
  expect(sourcePolicy).toContain('"temporary-compatibility-only"');
  expect(rightsSummary).toContain(
    '"legacyExternalServicesRequiringReplacement"',
  );
});

test("accounts require explicit terms, cross-border, and age consent", async () => {
  const [index, legal, account, migration, retentionMigration, cloudClient] =
    await Promise.all([
    read("index.html"),
    read("legal.html"),
    read("account.js"),
    read("supabase/migrations/202607290002_legal_consent_retention_audit.sql"),
    read("supabase/migrations/202607290003_feedback_retention_cleanup.sql"),
    read("tools/cloud-client-entry.js"),
  ]);
  expect(index).toContain('id="registerTermsConsent"');
  expect(index).toContain('id="registerCrossBorderConsent"');
  expect(index).toContain('id="registerAgeConsent"');
  expect(index).toContain('id="accountConsentView"');
  expect(index.indexOf("legal-config.js")).toBeLessThan(
    index.indexOf("cloud-client.js"),
  );
  expect(legal).toContain("个人信息跨境处理单独告知");
  expect(legal).toContain("当前项目区域位于新加坡");
  expect(account.indexOf("loadLegalConsents")).toBeLessThan(
    account.indexOf("cloud.loadState()"),
  );
  expect(migration).toContain("create table if not exists public.user_legal_consents");
  expect(migration).toContain("create table if not exists public.admin_audit_log");
  expect(migration).toContain("expires_at");
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);
  expect(retentionMigration).toContain("admin_expired_feedback");
  expect(retentionMigration).toContain("admin_delete_expired_feedback");
  expect(retentionMigration).not.toContain("delete from storage.objects");
  expect(cloudClient.indexOf(".remove(paths.slice")).toBeLessThan(
    cloudClient.indexOf('"admin_delete_expired_feedback"'),
  );
  expect(cloudClient).toContain("receipt?.ageVersion === expected.ageVersion");
});

test("membership, invitation, announcements, and replies stay behind RPC boundaries", async () => {
  const [migration, otpMigration, client, legal, authConfig] = await Promise.all([
    read("supabase/migrations/202607290004_membership_notifications.sql"),
    read("supabase/migrations/202607290005_email_otp_invite_rotation.sql"),
    read("tools/cloud-client-entry.js"),
    read("legal.html"),
    read("supabase/config.toml"),
  ]);
  expect(migration).toContain("membership_expires_at");
  expect(otpMigration).toContain("set invite_code = public.generate_invite_code()");
  expect(otpMigration).not.toContain("invite_used_at is null");
  expect(migration).toContain("for update");
  expect(migration).toContain("create table if not exists public.user_notifications");
  expect(migration).toContain("create table if not exists public.announcements");
  expect(migration).toContain(
    "revoke all on table public.user_notifications from anon, authenticated",
  );
  expect(migration).toContain("create or replace function public.admin_reply_feedback");
  expect(migration).toContain("create or replace function public.admin_set_membership_days");
  expect(migration).toContain("create or replace function public.admin_extend_all_memberships");
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);
  expect(otpMigration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);
  expect(otpMigration).toContain("管理员已将你的会员剩余时长延长 %s 天");
  expect(client).toContain('"load_my_account_profile"');
  expect(client).toContain('"load_my_notifications"');
  expect(client).toContain('"admin_reply_feedback"');
  expect(client).toContain('type: "signup"');
  expect(client).toContain('type: "recovery"');
  expect(authConfig).toContain("enable_confirmations = true");
  expect(authConfig).toContain("[auth.email.template.confirmation]");
  expect(authConfig).toContain("[auth.email.template.recovery]");
  expect(legal).toContain("具体来源状态以逐项权利台账为准");
});

test("announcements remain visible to accounts registered after publication", async () => {
  const migration = await read(
    "supabase/migrations/202607300001_announcement_images.sql",
  );
  const loadStart = migration.indexOf(
    "create or replace function public.load_my_notifications",
  );
  const loadEnd = migration.indexOf(
    "drop function if exists public.admin_publish_announcement",
    loadStart,
  );
  const publishStart = migration.indexOf(
    "create or replace function public.admin_publish_announcement",
  );
  const publishEnd = migration.indexOf(
    "create or replace function public.admin_announcement_list",
    publishStart,
  );
  const loadFunction = migration.slice(loadStart, loadEnd);
  const publishFunction = migration.slice(publishStart, publishEnd);

  expect(loadStart).toBeGreaterThanOrEqual(0);
  expect(loadEnd).toBeGreaterThan(loadStart);
  expect(loadFunction).toContain("from public.announcements as announcement");
  expect(loadFunction).toContain("left join public.announcement_reads as reads");
  expect(loadFunction).toContain("reads.user_id = v_user_id");
  expect(loadFunction).toContain(
    "where announcement.published_at <= clock_timestamp()",
  );
  expect(loadFunction).not.toContain("public.profiles");
  expect(loadFunction).not.toMatch(/profile\.created_at/i);

  expect(publishStart).toBeGreaterThanOrEqual(0);
  expect(publishEnd).toBeGreaterThan(publishStart);
  expect(publishFunction).toContain("insert into public.announcements");
  expect(publishFunction).not.toContain("insert into public.user_notifications");
});

test("bulk membership extension is bounded and notification-complete", async () => {
  const migration = await read(
    "supabase/migrations/202607300002_membership_bulk_update_fix.sql",
  );
  expect(migration).toContain(
    "create or replace function public.admin_extend_all_memberships",
  );
  expect(migration).toContain("where user_id is not null");
  expect(migration).toContain("from updated_profiles");
  expect(migration).toContain("from inserted_notifications");
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);
});

test("announcement images are bounded, admin-only to upload, and publicly rendered", async () => {
  const [migration, client, adminHtml, adminScript, account] = await Promise.all([
    read("supabase/migrations/202607300001_announcement_images.sql"),
    read("tools/cloud-client-entry.js"),
    read("admin.html"),
    read("admin.js"),
    read("account.js"),
  ]);

  expect(migration).toContain("'announcement-images'");
  expect(migration).toContain("true,\n  5242880");
  expect(migration).toContain("cardinality(image_paths) between 0 and 4");
  expect(migration).toContain("public.can_upload_announcement_image(name)");
  expect(migration).toContain("and public.is_admin()");
  expect(migration).toContain("Invalid or missing announcement image");
  expect(migration).toContain("'imagePaths', image_paths");
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);

  expect(client).toContain('const ANNOUNCEMENT_BUCKET = "announcement-images"');
  expect(client).toContain(".getPublicUrl(normalizedPath)");
  expect(client).toContain("p_image_paths: uploadedPaths");
  expect(adminHtml).toContain('id="announcementImageInput"');
  expect(adminHtml).toContain("image/jpeg,image/png,image/webp");
  expect(adminScript).toContain("sanitizeAnnouncementImage");
  expect(adminScript).toContain("announcementFiles.map((entry) => entry.file)");
  expect(account).toContain('images.className = "notification-images"');
});

test("announcement deletion is admin-only, audited, and cleans storage through its API", async () => {
  const [migration, client, adminScript] = await Promise.all([
    read("supabase/migrations/202607300003_announcement_delete.sql"),
    read("tools/cloud-client-entry.js"),
    read("admin.js"),
  ]);
  expect(migration).toContain(
    "create or replace function public.admin_delete_announcement",
  );
  expect(migration).toContain("if v_admin_id is null or not public.is_admin()");
  expect(migration).toContain("delete from public.announcements");
  expect(migration).toContain("'announcement.delete'");
  expect(migration).not.toContain("delete from storage.objects");
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);
  expect(client).toContain('client.rpc("admin_delete_announcement"');
  expect(client).toContain(".remove(imagePaths)");
  expect(adminScript).toContain("公告已删除");
  expect(adminScript).toContain("announcement-delete-button");
});

test("announcement pinning is admin-only, audited, and sorted ahead of newer items", async () => {
  const [migration, client, adminScript, account] = await Promise.all([
    read("supabase/migrations/20260803151307_announcement_pinning.sql"),
    read("tools/cloud-client-entry.js"),
    read("admin.js"),
    read("account.js"),
  ]);

  expect(migration).toContain("add column if not exists is_pinned boolean");
  expect(migration).toContain(
    "order by is_pinned desc, created_at desc, id",
  );
  expect(migration).toContain(
    "order by is_pinned desc, published_at desc, id",
  );
  expect(migration).toContain(
    "create or replace function public.admin_set_announcement_pinned",
  );
  expect(migration).toContain("if v_admin_id is null or not public.is_admin()");
  expect(migration).toContain("'announcement.pin'");
  expect(migration).toContain("'announcement.unpin'");
  expect(migration).toContain(
    "revoke all on function public.admin_set_announcement_pinned(uuid, boolean)",
  );
  expect(migration).toContain("to authenticated;");
  expect(migration).not.toMatch(/\bexecute\s+(?:format|\w+\s*\|\|)/i);

  expect(client).toContain('client.rpc("admin_set_announcement_pinned"');
  expect(adminScript).toContain("announcement-pin-button");
  expect(account).toContain('expandButton.textContent = "展开"');
  expect(account).toContain("content.hidden = isAnnouncement");
});

test("commercial compliance controls are versioned, least-privilege, and operationally testable", async () => {
  const [
    migration,
    retentionWorker,
    functionConfig,
    legalConfig,
    adminHtml,
    adminScript,
    client,
    account,
    packageJson,
  ] = await Promise.all([
    read("supabase/migrations/20260809060413_compliance_release_controls.sql"),
    read("supabase/functions/process-feedback-retention/index.ts"),
    read("supabase/config.toml"),
    read("legal-config.js"),
    read("admin.html"),
    read("admin.js"),
    read("tools/cloud-client-entry.js"),
    read("account.js"),
    read("package.json"),
  ]);

  expect(legalConfig).toContain('termsVersion: "2026-08-09-v3"');
  expect(legalConfig).toContain('privacyVersion: "2026-08-09-v3"');
  expect(legalConfig).toContain('crossBorderVersion: "2026-08-09-v3"');
  expect(legalConfig).toContain('ageVersion: "2026-08-09-v3"');
  expect(migration).toContain("2026-08-09-v3");
  expect(migration).toContain("legal_document_versions");
  expect(migration).toContain("interval '180 days'");
  expect(migration).toContain("sense-vocab-feedback-retention-daily");
  expect(migration).toContain("feedback_retention_jobs");
  expect(migration).toContain("revoke execute on function %s from public, anon, authenticated");
  expect(migration).toContain("alter default privileges for role postgres in schema public");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain("rights_metadata");
  expect(migration).toContain("content_provenance");
  expect(migration).toContain("admin_begin_announcement_takedown");
  expect(retentionWorker).toContain('auth: ["secret"]');
  expect(retentionWorker.indexOf(".from(FEEDBACK_BUCKET)")).toBeLessThan(
    retentionWorker.indexOf('rpc("retention_finalize_feedback_batch"'),
  );
  expect(functionConfig).toContain("[functions.process-feedback-retention]");
  expect(functionConfig).toContain("verify_jwt = false");
  expect(adminHtml).toContain('id="announcementRightsBasis"');
  expect(adminHtml).toContain('id="announcementHumanReviewed"');
  expect(adminScript).toContain("announcement-takedown-button");
  expect(client).toContain('client.rpc("admin_begin_announcement_takedown"');
  expect(account).toContain('className = "notification-ai-label"');
  expect(packageJson).toContain('"verify:commercial-release"');
  expect(packageJson).toContain('"build:third-party-compliance"');
});

test("compliance cards use append-only admin snapshots with CAS and default-deny clearance", async () => {
  const [migration, runtimeFix, dashboardFix, client, adminHtml, adminScript] = await Promise.all([
    read("supabase/migrations/20260809153605_compliance_issue_cards.sql"),
    read("supabase/migrations/20260809161847_compliance_runtime_fixes.sql"),
    read("supabase/migrations/20260809162137_compliance_dashboard_ambiguity_fix.sql"),
    read("tools/cloud-client-entry.js"),
    read("admin.html"),
    read("admin.js"),
  ]);

  for (const table of [
    "compliance_issues",
    "compliance_issue_snapshots",
    "compliance_release_snapshots",
  ]) {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
    expect(migration).toContain(
      `revoke all on table public.${table} from public, anon, authenticated`,
    );
  }
  expect(migration).toContain("p_expected_revision bigint");
  expect(migration).toContain("for update");
  expect(migration).toContain("using errcode = '40001'");
  expect(migration).toContain("insert into public.admin_audit_log");
  expect(migration).toContain("'releaseHistory'");
  expect(runtimeFix).toContain("'updatedBy', snapshot.created_by");
  expect(runtimeFix).toContain("'updatedBy', release.created_by");
  expect(runtimeFix).toContain("((image.ord - 1)::integer)");
  expect(dashboardFix).toContain("issue.id as issue_id");
  expect(dashboardFix).toContain("latest.created_at as snapshot_created_at");
  expect(dashboardFix).not.toContain("latest.*");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain("CLEARED issues must be closed");
  expect(migration).toContain("authorOrRightsholder");
  expect(migration).toContain("licenseOrPermission");
  expect(migration).toContain("commercialScope");
  expect(migration).toContain("^[0-9a-f]{64}$");
  expect(migration).not.toMatch(/update\s+public\.compliance_issue_snapshots/i);
  expect(migration).not.toMatch(/delete\s+from\s+public\.compliance_issue_snapshots/i);

  for (const rpc of [
    "admin_compliance_dashboard",
    "admin_compliance_issue_detail",
    "admin_create_compliance_issue",
    "admin_append_compliance_issue_snapshot",
    "admin_append_compliance_release_snapshot",
  ]) {
    expect(client).toContain(`"${rpc}"`);
    expect(migration).toContain(`function public.${rpc}`);
  }
  expect(adminHtml).toContain('id="complianceCardRail"');
  expect(adminHtml).toContain('id="complianceIssueDialog"');
  expect(adminScript).toContain("appendComplianceIssueSnapshot");
});
