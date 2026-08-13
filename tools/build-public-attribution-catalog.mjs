import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const rightsSummaryPath = path.join(
  rootDir,
  "data",
  "content-rights-ledger-summary.json",
);
const outputPath = path.join(rootDir, "data", "public-attributions.json");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Missing public attribution field: ${label}`);
  return text;
}

function requireUrl(value, label) {
  const text = requireText(value, label);
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`Invalid public attribution URL for ${label}: ${text}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsafe public attribution URL for ${label}: ${text}`);
  }
  if (parsed.hostname === "creativecommons.org" && parsed.protocol === "http:") {
    parsed.protocol = "https:";
  }
  return parsed.toString();
}

function licenseUrl(license, explicitUrl = null) {
  if (explicitUrl) return requireUrl(explicitUrl, `${license} license`);
  const normalized = String(license).trim().toLowerCase();
  if (normalized === "public domain") {
    return "https://creativecommons.org/publicdomain/mark/1.0/";
  }
  if (normalized === "cc0" || normalized === "cc0 1.0") {
    return "https://creativecommons.org/publicdomain/zero/1.0/";
  }
  if (normalized === "cc by 2.0 fr") {
    return "https://creativecommons.org/licenses/by/2.0/fr/";
  }
  throw new Error(`No public license URL is known for: ${license}`);
}

function reference(word, sense, field) {
  return {
    contentId: `${word.id}:${sense.id}:${field}`,
    wordId: word.id,
    senseId: sense.id,
    field,
  };
}

function mergeAsset(map, key, candidate, assetLabel) {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, candidate);
    return;
  }
  const comparableFields = [
    "author",
    "authorStatus",
    "license",
    "licenseUrl",
    "sourcePage",
    "historyPage",
    "copyrightPage",
    "specialAttribution",
    "modification",
  ];
  for (const field of comparableFields) {
    if ((existing[field] ?? null) !== (candidate[field] ?? null)) {
      throw new Error(`Conflicting ${field} for ${assetLabel}: ${key}`);
    }
  }
  existing.references.push(...candidate.references);
}

function finalizeAssets(map) {
  return [...map.values()].map((entry) => ({
    ...entry,
    references: [...new Map(
      entry.references.map((item) => [item.contentId, item]),
    ).values()].sort((left, right) => left.contentId.localeCompare(right.contentId)),
  })).sort((left, right) => (
    left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id)
  ));
}

const bundleBytes = await readFile(bundlePath);
const bundle = JSON.parse(bundleBytes.toString("utf8"));
const rightsSummary = JSON.parse(await readFile(rightsSummaryPath, "utf8"));
const audioAssets = new Map();
const exampleAssets = new Map();
const unresolved = {
  semcor: [],
  quotation: [],
  semantic: [],
};
let audioBindings = 0;
let tatoebaBindings = 0;
let wiktionaryBindings = 0;

for (const word of bundle.words ?? []) {
  for (const sense of word.senses ?? []) {
    if (sense.audio) {
      audioBindings += 1;
      const audioUrl = requireUrl(sense.audio, `${word.id}:${sense.id}:audio`);
      const author = requireText(sense.audioAuthor, `${word.id}:${sense.id}:audioAuthor`);
      const license = requireText(
        sense.audioLicense,
        `${word.id}:${sense.id}:audioLicense`,
      );
      const sourcePage = requireUrl(
        sense.audioSourcePage,
        `${word.id}:${sense.id}:audioSourcePage`,
      );
      mergeAsset(audioAssets, audioUrl, {
        id: `audio-${sha256(audioUrl).slice(0, 20)}`,
        kind: "audio",
        provider: "Wikimedia Commons",
        assetUrl: audioUrl,
        author,
        authorStatus: "named-or-file-page-designated",
        license,
        licenseUrl: licenseUrl(license, sense.audioLicenseUrl),
        sourcePage,
        historyPage: null,
        copyrightPage: "https://commons.wikimedia.org/wiki/Commons:Credit_line",
        specialAttribution: String(sense.audioAttribution ?? "").trim() || null,
        modification: "Sense Vocab 未编辑录音内容；播放地址使用 Wikimedia Commons 提供的转码文件。",
        references: [reference(word, sense, "audio")],
      }, "audio asset");
    }

    const source = String(sense.exampleSource ?? "").trim().toLowerCase();
    const exampleRef = reference(word, sense, "example");
    if (source === "semcor") unresolved.semcor.push(exampleRef);
    if (source.includes("quotation")) unresolved.quotation.push(exampleRef);
    if (source.startsWith("semantic-")) unresolved.semantic.push(exampleRef);

    if (source === "tatoeba") {
      tatoebaBindings += 1;
      const sourceId = requireText(
        sense.exampleSourceId,
        `${word.id}:${sense.id}:exampleSourceId`,
      );
      const author = requireText(
        sense.exampleOwner,
        `${word.id}:${sense.id}:exampleOwner`,
      );
      const license = requireText(
        sense.exampleLicense,
        `${word.id}:${sense.id}:exampleLicense`,
      );
      const sourcePage = requireUrl(
        sense.exampleSourcePage,
        `${word.id}:${sense.id}:exampleSourcePage`,
      );
      mergeAsset(exampleAssets, `tatoeba:${sourceId}`, {
        id: `example-tatoeba-${sourceId}`,
        kind: "example",
        provider: "Tatoeba",
        sourceId,
        author,
        authorStatus: requireText(
          sense.exampleOwnerStatus,
          `${word.id}:${sense.id}:exampleOwnerStatus`,
        ),
        license,
        licenseUrl: licenseUrl(license, sense.exampleLicenseUrl),
        sourcePage,
        historyPage: null,
        copyrightPage: "https://tatoeba.org/en/terms_of_use",
        specialAttribution: String(sense.exampleAttribution ?? "").trim() || null,
        modification: "例句与中文译文、义项上下文配对展示；具体文本处理记录保留在字段级权利台账。",
        rightsStatus: "attribution-complete",
        references: [exampleRef],
      }, "Tatoeba example");
      continue;
    }

    const isTraceableWiktionary = (
      source.includes("wiktionary") || source.includes("kaikki")
    ) && !source.startsWith("semantic-");
    if (isTraceableWiktionary) {
      wiktionaryBindings += 1;
      const sourceId = requireText(
        sense.exampleSourceId,
        `${word.id}:${sense.id}:exampleSourceId`,
      );
      const author = requireText(
        sense.exampleOwner,
        `${word.id}:${sense.id}:exampleOwner`,
      );
      const license = requireText(
        sense.exampleLicense,
        `${word.id}:${sense.id}:exampleLicense`,
      );
      const sourcePage = requireUrl(
        sense.exampleSourcePage,
        `${word.id}:${sense.id}:exampleSourcePage`,
      );
      mergeAsset(exampleAssets, `wiktionary:${sourceId}`, {
        id: `example-wiktionary-${sha256(sourceId).slice(0, 20)}`,
        kind: "example",
        provider: "Wiktionary / Kaikki",
        sourceId,
        author,
        authorStatus: "collective-contributors",
        license,
        licenseUrl: licenseUrl(license, sense.exampleLicenseUrl),
        sourcePage,
        historyPage: requireUrl(
          sense.exampleHistoryPage,
          `${word.id}:${sense.id}:exampleHistoryPage`,
        ),
        copyrightPage: requireUrl(
          sense.exampleCopyrightPage,
          `${word.id}:${sense.id}:exampleCopyrightPage`,
        ),
        specialAttribution: requireText(
          sense.exampleAttribution,
          `${word.id}:${sense.id}:exampleAttribution`,
        ),
        modification: "Sense Vocab 已对摘录进行义项配对、格式整理或上下文调整；衍生文本继续按 CC BY-SA 4.0 相同方式共享。",
        rightsStatus: source.includes("quotation")
          ? "attribution-complete-underlying-quotation-unresolved"
          : "attribution-complete-sharealike",
        references: [exampleRef],
      }, "Wiktionary example");
    }
  }
}

const entries = finalizeAssets(new Map([...audioAssets, ...exampleAssets]));
const catalog = {
  schemaVersion: 1,
  bundleSha256: sha256(bundleBytes),
  summary: {
    audioBindings,
    audioAssets: audioAssets.size,
    tatoebaBindings,
    tatoebaAssets: [...exampleAssets.keys()].filter((key) => key.startsWith("tatoeba:"))
      .length,
    wiktionaryBindings,
    wiktionaryAssets: [...exampleAssets.keys()].filter((key) => key.startsWith("wiktionary:"))
      .length,
    semcorUnresolved: unresolved.semcor.length,
    quotationUnresolved: unresolved.quotation.length,
    semanticUnresolved: unresolved.semantic.length,
    commercialReleaseBlockers: rightsSummary.counts?.BLOCKER ?? null,
  },
  notices: {
    wordnet: {
      title: "Princeton WordNet 3.0",
      copyright: "WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.",
      licenseUrl: "https://wordnet.princeton.edu/license-and-commercial-use",
      bundledLicense: "./THIRD_PARTY_LICENSES.md",
      conditions: "复制、修改或分发时须保留版权、许可条件和免责声明；不得以 Princeton 名称作宣传背书。",
    },
    tatoeba: {
      title: "Tatoeba",
      projectUrl: "https://tatoeba.org/",
      termsUrl: "https://tatoeba.org/en/terms_of_use",
      conditions: "逐句作者状态、许可证与句子页见下方公共目录。",
    },
    wiktionary: {
      title: "Wiktionary / Kaikki",
      projectUrl: "https://en.wiktionary.org/",
      copyrightUrl: "https://en.wiktionary.org/wiki/Wiktionary:Copyrights",
      conditions: "本项目选择 CC BY-SA 4.0 路径；修改后的适用文本继续遵守署名与相同方式共享。",
    },
    publicDomain: {
      title: "CC0 与公有领域录音",
      conditions: "法律上无需署名的资产仍在目录中保留文件页与提供者信息，作为礼貌性来源说明。",
    },
    unresolved: {
      title: "尚未完成权利确认的内容",
      conditions: "SemCor、quotation 与 semantic 来源记录继续保持既有 BLOCKER；公开警告迁移不代表已获授权或可收费发行。",
    },
  },
  unresolvedReferences: Object.fromEntries(
    Object.entries(unresolved).map(([key, values]) => [
      key,
      values.sort((left, right) => left.contentId.localeCompare(right.contentId)),
    ]),
  ),
  entries,
};

await writeFile(outputPath, `${JSON.stringify(catalog)}\n`, "utf8");
console.log(
  `Public attribution catalog: ${audioBindings} audio bindings -> ${audioAssets.size} assets; ` +
  `${tatoebaBindings} Tatoeba bindings -> ${catalog.summary.tatoebaAssets} assets; ` +
  `${wiktionaryBindings} Wiktionary/Kaikki bindings -> ${catalog.summary.wiktionaryAssets} assets.`,
);
