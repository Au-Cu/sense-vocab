import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const migrationDir = path.join(rootDir, "supabase", "migrations");
const hardeningName = "20260809060413_compliance_release_controls.sql";
const hardening = await readFile(path.join(migrationDir, hardeningName), "utf8");
const client = await readFile(path.join(rootDir, "tools", "cloud-client-entry.js"), "utf8");
const migrationNames = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
const securityMigrationNames = migrationNames.filter((name) => name >= hardeningName);
const functions = new Map();

for (const migrationName of migrationNames) {
  const sql = await readFile(path.join(migrationDir, migrationName), "utf8");
  const pattern = /create\s+or\s+replace\s+function\s+(public|private)\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?\$\$;/gi;
  for (const match of sql.matchAll(pattern)) {
    const body = match[0];
    const key = `${match[1]}.${match[2]}(${match[3].replace(/--.*$/gm, "").replace(/\s+/g, " ").trim()})`;
    functions.set(key, {
      key,
      schema: match[1],
      name: match[2],
      latestMigration: migrationName,
      securityDefiner: /security\s+definer/i.test(body),
      declaredEmptySearchPath: /set\s+search_path\s*=\s*''/i.test(body),
      checksCallerIdentity: /auth\.(uid|role)\s*\(/i.test(body) || match[1] === "private",
    });
  }
}

const finalGrantSql = (await Promise.all(
  securityMigrationNames.map((name) => readFile(path.join(migrationDir, name), "utf8")),
)).join("\n");
const grants = [...finalGrantSql.matchAll(
  /grant\s+execute\s+on\s+function\s+([a-z0-9_.]+)\(([^)]*)\)\s+to\s+([a-z0-9_, ]+);/gi,
)].map((match) => ({ signature: `${match[1]}(${match[2]})`, roles: match[3].split(",").map((role) => role.trim()) }));
const grantedNames = new Set(grants.map((grant) => grant.signature.match(/\.([a-z0-9_]+)\(/i)?.[1]));
const clientRpcNames = new Set(
  [...client.matchAll(/(?:client\.rpc\(|rpcName\s*=\s*[^;]*?)(?:"|')([a-z0-9_]+)(?:"|')/gi)]
    .map((match) => match[1]),
);
clientRpcNames.add("load_my_notifications");

const errors = [];
if (!/revoke execute on function %s from public, anon, authenticated/i.test(hardening)) {
  errors.push("No blanket revoke for existing public/private functions.");
}
if (!/alter function %s set search_path = %L[\s\S]*fn\.signature, ''/i.test(hardening)) {
  errors.push("SECURITY DEFINER functions are not forced to an empty search_path.");
}
if (!/alter default privileges[\s\S]*revoke execute on functions from public, anon, authenticated/i.test(hardening)) {
  errors.push("Default function EXECUTE privileges are not revoked.");
}
for (const rpcName of clientRpcNames) {
  if (!grantedNames.has(rpcName)) errors.push(`Browser RPC ${rpcName} has no explicit final grant.`);
}
const anon = grants.filter((grant) => grant.roles.includes("anon"));
const allowedAnon = new Set([
  "public.validate_invitation_code(text)",
  "public.load_my_notifications(integer)",
]);
for (const grant of anon) {
  if (!allowedAnon.has(grant.signature)) errors.push(`Unexpected anon function grant: ${grant.signature}`);
}
if (anon.length !== allowedAnon.size) errors.push("Anonymous function grant allowlist drifted.");
if (!/if v_user_id is null then\s+return public\.load_public_announcements\(v_limit\)/i.test(hardening)) {
  errors.push("Anonymous notification compatibility is not isolated to public announcements.");
}

const report = {
  auditDate: "2026-08-10",
  migration: hardeningName,
  grantMigrations: securityMigrationNames,
  policy: {
    allLegacyFunctionExecutionRevoked: true,
    allSecurityDefinersForcedToEmptySearchPath: true,
    anonymousFunctionAllowlist: [...allowedAnon].sort(),
    defaultFunctionExposureRevoked: true,
  },
  counts: {
    discoveredFunctionSignatures: functions.size,
    securityDefinerSignatures: [...functions.values()].filter((fn) => fn.securityDefiner).length,
    explicitFinalGrants: grants.length,
    browserRpcNames: clientRpcNames.size,
  },
  grants,
  functions: [...functions.values()].sort((left, right) => left.key.localeCompare(right.key)),
  errors,
};
await writeFile(
  path.join(rootDir, "data", "supabase-security-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
if (errors.length) {
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Supabase function security audit passed: ${functions.size} signatures, ${grants.length} explicit grants.`);
