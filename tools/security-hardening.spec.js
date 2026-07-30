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
    /^npm run build:cloud-client && npm run build:vocabulary-index && npm run verify:content-identity && npm run audit:content && /,
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
  expect(legal).toContain("所有例句来自第三方或 AI 生成，均不代表运营者立场与观点");
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
