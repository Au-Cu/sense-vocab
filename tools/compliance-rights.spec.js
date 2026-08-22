const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8"));
}

test("content rights metadata is complete-or-blocked and SemCor is never attributed to WordNet", () => {
  const bundle = readJson("data/vocabulary-bundle.json");
  const rows = fs.readFileSync(
    path.join(ROOT_DIR, "data/content-rights-ledger.jsonl"),
    "utf8",
  ).trim().split("\n").slice(1).map(JSON.parse);
  const fields = rows.flatMap((row) => row.fields);
  const nullFieldHash = crypto.createHash("sha256").update("null").digest("hex");
  const clearedIncomplete = fields.filter((field) =>
    field.sha256 !== nullFieldHash && field.risk === "CLEARED" &&
      (!field.author || !field.license || !field.sourceUrl),
  );
  expect(clearedIncomplete).toEqual([]);

  const semCorSenses = bundle.words.flatMap((word) =>
    (word.senses ?? []).filter((sense) =>
      String(sense.exampleSource ?? "").toLowerCase() === "semcor"),
  );
  expect(semCorSenses).toHaveLength(2836);
  const semCorFields = fields.filter((field) =>
    String(field.source ?? "").toLowerCase() === "semcor");
  expect(semCorFields).toHaveLength(semCorSenses.length);
  for (const field of semCorFields) {
    expect(field.risk).toBe("BLOCKER");
    expect(field.issues.some((issue) =>
      issue.code === "semcor-commercial-rights-unverified"),
    ).toBe(true);
    expect(field.author).toBeNull();
    expect(field.license).toBeNull();
  }
});

test("Tatoeba, Wiktionary, and Wikimedia records retain complete item-level evidence", () => {
  const bundle = readJson("data/vocabulary-bundle.json");
  const senses = bundle.words.flatMap((word) => word.senses ?? []);

  const tatoeba = senses.filter((sense) =>
    String(sense.exampleSource ?? "").toLowerCase() === "tatoeba");
  expect(tatoeba).toHaveLength(944);
  expect(tatoeba.filter((sense) => sense.exampleMetadataStatus !== "verified")).toEqual([]);
  expect(tatoeba.filter((sense) => sense.exampleNormalization?.type ===
    "removed-redundant-terminal-period")).toHaveLength(12);

  const wiktionary = senses.filter((sense) =>
    /kaikki|wiktionary/i.test(String(sense.exampleSource ?? "")));
  expect(wiktionary).toHaveLength(828);
  for (const sense of wiktionary) {
    expect(sense.exampleOwner).toBe("Wiktionary contributors");
    expect(sense.exampleLicense).toBe("CC BY-SA 4.0");
    expect(sense.exampleLicenseUrl).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
    expect(sense.exampleSourcePage).toMatch(/^https:\/\/en\.wiktionary\.org\/wiki\//);
    expect(sense.exampleHistoryPage).toContain("action=history");
    expect(sense.exampleCopyrightPage).toBe(
      "https://en.wiktionary.org/wiki/Wiktionary:Copyrights",
    );
    expect(sense.exampleAttribution).toContain("modified by Sense Vocab");
  }

  const audio = senses.filter((sense) => sense.audio);
  const pronunciationManifest = readJson(
    "data/content-change-sets/rd-multi-pronunciation-2026-08-12.json",
  );
  const addedAudioFields = pronunciationManifest.items.filter((item) =>
    Object.hasOwn(item.fields, "audio")
  ).length;
  expect(audio).toHaveLength(1617 + addedAudioFields);
  for (const sense of audio) {
    expect(sense.audioAuthor).toBeTruthy();
    expect(sense.audioLicense).toBeTruthy();
    expect(sense.audioSourcePage).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    expect(sense.audioRightsEvidenceSha256).toMatch(/^[a-f0-9]{64}$/);
  }
});

test("direct dependencies have exact version-specific license declaration evidence", () => {
  const sbom = readJson("SBOM.cdx.json");
  const evidence = readJson("THIRD_PARTY_LICENSE_EVIDENCE.json");
  const directEvidenceGap = sbom.metadata.properties.find((property) =>
    property.name === "sense-vocab:direct-unverified-license-evidence-count");
  expect(directEvidenceGap?.value).toBe("0");

  for (const key of ["supabase@2.110.0", "wordnet@2.0.0"]) {
    const [name, version] = key.split(/@(?=[^@]+$)/);
    const component = sbom.components.find((entry) =>
      entry.name === name && entry.version === version);
    expect(component).toBeTruthy();
    const properties = Object.fromEntries(
      component.properties.map((property) => [property.name, property.value]),
    );
    expect(properties["sense-vocab:license-evidence-status"])
      .toBe("verified-version-specific-declaration");
    expect(properties["sense-vocab:license-declaration-evidence-sha256"])
      .not.toBe("missing");
    expect(evidence.entries[key].declaredLicense).toBe("MIT");
    expect(evidence.entries[key].separateLicenseFilePresent).toBe(false);
  }
});
