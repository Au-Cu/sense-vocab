import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const read = (name) => readFile(path.join(rootDir, name), "utf8");
const blockers = [];

const [bundleBytes, ledgerText, ledgerSummaryText, sbomText, licenseBundle,
  legalConfig, legalHtml, rightsSummaryText, migration, edgeFunction,
  securityAuditText] = await Promise.all([
  readFile(path.join(rootDir, "data", "vocabulary-bundle.json")),
  read("data/content-rights-ledger.jsonl"),
  read("data/content-rights-ledger-summary.json"),
  read("SBOM.cdx.json"),
  read("THIRD_PARTY_LICENSES.md"),
  read("legal-config.js"),
  read("legal.html"),
  read("data/content-rights-summary.json"),
  read("supabase/migrations/20260809060413_compliance_release_controls.sql"),
  read("supabase/functions/process-feedback-retention/index.ts"),
  read("data/supabase-security-audit.json"),
]);

const bundle = JSON.parse(bundleBytes.toString("utf8"));
const senseCount = bundle.words.reduce((sum, word) => sum + word.senses.length, 0);
const ledgerHeader = JSON.parse(ledgerText.split(/\r?\n/, 1)[0]);
const ledgerSummary = JSON.parse(ledgerSummaryText);
const sbom = JSON.parse(sbomText);
const rightsSummary = JSON.parse(rightsSummaryText);
const securityAudit = JSON.parse(securityAuditText);
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");

if (ledgerHeader.senseCount !== senseCount ||
  ledgerHeader.bundleSha256 !== bundleHash) {
  blockers.push("The rights ledger is missing or does not match the current bundle.");
}
if ((ledgerSummary.counts?.BLOCKER ?? 0) > 0 || (ledgerSummary.counts?.HIGH ?? 0) > 0) {
  blockers.push(`Rights ledger still has ${ledgerSummary.counts.BLOCKER} BLOCKER and ${ledgerSummary.counts.HIGH} HIGH senses.`);
}
if (Object.values(rightsSummary.counts ?? {}).some((count) => Number(count) > 0)) {
  blockers.push("The content-rights strict audit still contains unresolved findings.");
}
if (!sbom.components?.some((component) => component.name === "three" && component.version === "0.185.1")) {
  blockers.push("SBOM does not contain Three.js 0.185.1.");
}
if (!licenseBundle.includes("three@0.185.1")) {
  blockers.push("Third-party license bundle does not contain the Three.js license artifact.");
}
const directUnverifiedLicenseEvidence = Number(
  sbom.metadata?.properties?.find((property) =>
    property.name === "sense-vocab:direct-unverified-license-evidence-count"
  )?.value ?? 0,
);
if (directUnverifiedLicenseEvidence > 0) {
  blockers.push(
    `${directUnverifiedLicenseEvidence} direct npm dependencies still lack verified version-specific license evidence.`,
  );
}
if (![legalConfig, legalHtml].every((text) => text.includes("2026-08-09-v3"))) {
  blockers.push("Legal page and client legal configuration are not aligned to v3.");
}
const legalHash = createHash("sha256").update(legalHtml).digest("hex");
if (!migration.includes(legalHash)) {
  blockers.push("The legal-document SHA-256 does not match the consent-version registry.");
}
if ((securityAudit.errors ?? []).length > 0) {
  blockers.push("The Supabase security audit contains unresolved errors.");
}
for (const expected of [
  "alter default privileges for role postgres in schema public",
  "sense-vocab-feedback-retention-daily",
  "admin_begin_announcement_takedown",
  "retention_claim_feedback_batch",
]) {
  if (!migration.includes(expected)) blockers.push(`Compliance migration is missing ${expected}.`);
}
if (!edgeFunction.includes("retention_finalize_feedback_batch") ||
  !edgeFunction.includes('auth: ["secret"]')) {
  blockers.push("Feedback retention worker is not configured for secret-only two-phase deletion.");
}

if (blockers.length) {
  console.error("Commercial release gate: BLOCKED");
  blockers.forEach((blocker) => console.error(`- ${blocker}`));
  process.exit(1);
}
console.log("Commercial release gate: CLEARED for the audited artifacts.");
