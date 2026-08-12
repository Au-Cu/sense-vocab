import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const lockPath = path.join(rootDir, "package-lock.json");
const packagePath = path.join(rootDir, "package.json");
const sbomPath = path.join(rootDir, "SBOM.cdx.json");
const licensesPath = path.join(rootDir, "THIRD_PARTY_LICENSES.md");
const evidencePath = path.join(rootDir, "THIRD_PARTY_LICENSE_EVIDENCE.json");
const auditDate = "2026-08-09";
const timestamp = "2026-08-09T00:00:00+08:00";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function integrityHash(integrity) {
  const match = String(integrity ?? "").match(/^(sha256|sha384|sha512)-(.+)$/);
  if (!match) return [];
  return [{ alg: match[1].toUpperCase().replace("SHA", "SHA-"), content: Buffer.from(match[2], "base64").toString("hex") }];
}

function packageNameFromPath(packageDir) {
  return packageDir.split("node_modules/").at(-1);
}

function purl(name, version) {
  return `pkg:npm/${encodeURIComponent(name).replace("%40", "@").replace("%2F", "%2F")}@${version}`;
}

function licenseExpression(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(licenseExpression).filter(Boolean).join(" OR ");
  if (value && typeof value === "object") return value.type ?? value.name ?? "NOASSERTION";
  return "NOASSERTION";
}

const lockBytes = await readFile(lockPath);
const lock = JSON.parse(lockBytes.toString("utf8"));
const rootPackage = JSON.parse(await readFile(packagePath, "utf8"));
const licenseEvidence = JSON.parse(await readFile(evidencePath, "utf8"));
const directNames = new Set([
  ...Object.keys(rootPackage.dependencies ?? {}),
  ...Object.keys(rootPackage.devDependencies ?? {}),
]);
const components = [];
const licenseTexts = new Map();
const missingLicenseFiles = [];
const unavailableArtifacts = [];

async function validateLicenseEvidence(key, expression) {
  const evidence = licenseEvidence.entries?.[key];
  if (!evidence) return { status: "missing", evidence: null, hashes: [] };
  if (evidence.declaredLicense !== expression) {
    throw new Error(`${key} license evidence declares ${evidence.declaredLicense}, package declares ${expression}.`);
  }
  const hashes = [];
  for (const artifact of evidence.localArtifacts ?? []) {
    const bytes = await readFile(path.join(rootDir, artifact.path));
    const actual = sha256(bytes);
    if (actual !== artifact.sha256) {
      throw new Error(`${key} license evidence hash mismatch for ${artifact.path}.`);
    }
    hashes.push(actual);
  }
  if (!hashes.length) throw new Error(`${key} license evidence has no locally verifiable artifact.`);
  return { status: "verified-version-specific-declaration", evidence, hashes };
}

for (const [packageDir, lockEntry] of Object.entries(lock.packages ?? {})) {
  if (!packageDir || !packageDir.includes("node_modules/")) continue;
  const installedDir = path.join(rootDir, packageDir);
  let manifest = {};
  let installed = true;
  try {
    manifest = JSON.parse(await readFile(path.join(installedDir, "package.json"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    installed = false;
  }
  const name = manifest.name ?? packageNameFromPath(packageDir);
  const version = manifest.version ?? lockEntry.version;
  const expression = licenseExpression(manifest.license ?? manifest.licenses ?? lockEntry.license);
  const evidenceKey = `${name}@${version}`;
  const declarationEvidence = await validateLicenseEvidence(evidenceKey, expression);
  const repository = typeof manifest.repository === "string"
    ? manifest.repository
    : manifest.repository?.url;
  const refs = [];
  if (lockEntry.resolved) refs.push({ type: "distribution", url: lockEntry.resolved });
  if (manifest.homepage) refs.push({ type: "website", url: manifest.homepage });
  if (repository) refs.push({ type: "vcs", url: repository.replace(/^git\+/, "") });
  for (const artifact of declarationEvidence.evidence?.officialArtifacts ?? []) {
    refs.push({ type: "documentation", url: artifact.url });
  }

  const entries = installed ? await readdir(installedDir, { withFileTypes: true }) : [];
  const noticeNames = entries.filter((entry) =>
    entry.isFile() && /^(licen[cs]e|copying|notice|third[-_ ]party)(\.|$)/i.test(entry.name)
  ).map((entry) => entry.name).sort();
  const textHashes = [];
  for (const noticeName of noticeNames) {
    const text = await readFile(path.join(installedDir, noticeName), "utf8");
    const hash = sha256(text);
    textHashes.push(hash);
    const existing = licenseTexts.get(hash) ?? { text, packages: [], files: [] };
    existing.packages.push(`${name}@${version}`);
    existing.files.push(`${packageDir}/${noticeName}`);
    licenseTexts.set(hash, existing);
  }
  if (!installed) unavailableArtifacts.push(`${name}@${version}`);
  else if (!noticeNames.length) missingLicenseFiles.push(`${name}@${version}`);

  components.push({
    type: "library",
    "bom-ref": `${purl(name, version)}?path=${encodeURIComponent(packageDir)}`,
    group: name.startsWith("@") ? name.split("/")[0].slice(1) : undefined,
    name,
    version,
    scope: directNames.has(name) ? "required" : "optional",
    hashes: integrityHash(lockEntry.integrity),
    licenses: [{ expression }],
    purl: purl(name, version),
    externalReferences: refs,
    properties: [
      { name: "sense-vocab:npm-path", value: packageDir },
      { name: "sense-vocab:direct", value: String(directNames.has(name)) },
      { name: "sense-vocab:installed-artifact", value: String(installed) },
      { name: "sense-vocab:license-text-sha256", value: textHashes.join(",") || "missing" },
      { name: "sense-vocab:license-evidence-status", value: noticeNames.length ? "bundled-license-file" : declarationEvidence.status },
      { name: "sense-vocab:license-declaration-evidence-sha256", value: declarationEvidence.hashes.join(",") || "missing" },
    ],
  });
}

components.sort((left, right) =>
  `${left.name}@${left.version}:${left["bom-ref"]}`.localeCompare(
    `${right.name}@${right.version}:${right["bom-ref"]}`,
  )
);
const directMissingLicenseFiles = components
  .filter((component) =>
    component.properties.some((entry) =>
      entry.name === "sense-vocab:direct" && entry.value === "true"
    ) && component.properties.some((entry) =>
      entry.name === "sense-vocab:license-text-sha256" && entry.value === "missing"
    )
  )
  .map((component) => `${component.name}@${component.version}`)
  .sort();
const directUnverifiedLicenseEvidence = components
  .filter((component) =>
    component.properties.some((entry) =>
      entry.name === "sense-vocab:direct" && entry.value === "true"
    ) && component.properties.some((entry) =>
      entry.name === "sense-vocab:license-evidence-status" && entry.value === "missing"
    )
  )
  .map((component) => `${component.name}@${component.version}`)
  .sort();
const verifiedDirectWithoutLicenseFile = directMissingLicenseFiles.filter(
  (key) => licenseEvidence.entries?.[key],
);
const lockHash = sha256(lockBytes);
const serialHash = sha256(`sense-vocab:${rootPackage.version}:${lockHash}`);
const uuid = `${serialHash.slice(0, 8)}-${serialHash.slice(8, 12)}-5${serialHash.slice(13, 16)}-a${serialHash.slice(17, 20)}-${serialHash.slice(20, 32)}`;
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:${uuid}`,
  version: 1,
  metadata: {
    timestamp,
    tools: { components: [{ type: "application", name: "Sense Vocab compliance generator", version: "1" }] },
    component: {
      type: "application",
      name: rootPackage.name,
      version: rootPackage.version,
      hashes: [{ alg: "SHA-256", content: lockHash }],
    },
    properties: [
      { name: "sense-vocab:source", value: "package-lock.json + installed package manifests" },
      { name: "sense-vocab:access-date", value: auditDate },
      { name: "sense-vocab:missing-license-file-count", value: String(missingLicenseFiles.length) },
      { name: "sense-vocab:direct-missing-license-file-count", value: String(directMissingLicenseFiles.length) },
      { name: "sense-vocab:direct-unverified-license-evidence-count", value: String(directUnverifiedLicenseEvidence.length) },
      { name: "sense-vocab:unavailable-artifact-count", value: String(unavailableArtifacts.length) },
    ],
  },
  components,
};
await writeFile(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");

const lines = [
  "# Third-Party License Bundle",
  "",
  `Generated from \`package-lock.json\` and installed package artifacts for Sense Vocab ${rootPackage.version}.`,
  `Evidence date: ${auditDate}. Package-lock SHA-256: \`${lockHash}\`.`,
  "",
  "## Component inventory",
  "",
  "| Component | Version | Direct | Declared license | Package path |",
  "|---|---:|:---:|---|---|",
  ...components.map((component) => {
    const direct = component.properties.find((entry) => entry.name === "sense-vocab:direct")?.value === "true";
    const packageDir = component.properties.find((entry) => entry.name === "sense-vocab:npm-path")?.value;
    return `| ${component.name} | ${component.version} | ${direct ? "yes" : "no"} | ${component.licenses[0].expression} | \`${packageDir}\` |`;
  }),
  "",
  "## Reproduced license and notice texts",
  "",
];
for (const [hash, record] of [...licenseTexts].sort(([left], [right]) => left.localeCompare(right))) {
  lines.push(
    `### SHA-256 ${hash}`,
    "",
    `Applies to: ${[...new Set(record.packages)].sort().join(", ")}.`,
    `Source files: ${[...new Set(record.files)].sort().map((file) => `\`${file}\``).join(", ")}.`,
    "",
    "```text",
    record.text.replace(/[ \t]+$/gm, "").trimEnd(),
    "```",
    "",
  );
}
if (missingLicenseFiles.length) {
  lines.push(
    "## Components without a bundled license text",
    "",
    "These components declare a license in their package manifest but did not include a separately named license or notice file in the installed artifact:",
    "",
    ...missingLicenseFiles.sort().map((item) => `- ${item}`),
    "",
  );
}
if (verifiedDirectWithoutLicenseFile.length) {
  lines.push(
    "## Direct dependencies with verified declarations but no separate license file",
    "",
    "The exact installed package manifest and README were hashed and matched to the version-specific official source. The upstream package and repository contain no separately named license file, so this bundle preserves the available declaration evidence without inventing a copyright notice:",
    "",
    ...verifiedDirectWithoutLicenseFile.map((item) => {
      const evidence = licenseEvidence.entries[item];
      const localHashes = evidence.localArtifacts
        .map((artifact) => `\`${artifact.path}\` SHA-256 \`${artifact.sha256}\``)
        .join("; ");
      return `- ${item}: ${evidence.declaredLicense}; upstream \`${evidence.upstreamRef}\` / \`${evidence.upstreamCommit}\`; ${localHashes}.`;
    }),
    "",
  );
}
if (directUnverifiedLicenseEvidence.length) {
  lines.push(
    "## Direct dependencies with unverified license evidence",
    "",
    ...directUnverifiedLicenseEvidence.map((item) => `- ${item}`),
    "",
  );
}
if (unavailableArtifacts.length) {
  lines.push(
    "## Platform-optional artifacts not installed on this host",
    "",
    "These entries are present in package-lock.json and therefore remain in the SBOM, but their platform-specific package artifacts were not installed on this Windows host. Rebuild and regenerate this bundle on every release platform:",
    "",
    ...unavailableArtifacts.sort().map((item) => `- ${item}`),
    "",
  );
}
while (lines.at(-1) === "") lines.pop();
await writeFile(licensesPath, `${lines.join("\n")}\n`, "utf8");

console.log(`SBOM components: ${components.length}`);
console.log(`Unique license/notice texts: ${licenseTexts.size}`);
console.log(`Components without bundled license text: ${missingLicenseFiles.length}`);
console.log(`Platform-optional artifacts unavailable on this host: ${unavailableArtifacts.length}`);
console.log(`Direct dependencies missing a license artifact: ${directMissingLicenseFiles.length}`);
console.log(`Direct dependencies with unverified license evidence: ${directUnverifiedLicenseEvidence.length}`);
