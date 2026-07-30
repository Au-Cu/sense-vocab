import { build } from "esbuild";
import {
  copyFile,
  cp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const distDir = path.join(rootDir, "dist");

if (path.dirname(distDir) !== rootDir || path.basename(distDir) !== "dist") {
  throw new Error(`Refusing to clean unexpected output path: ${distDir}`);
}

await rm(distDir, { recursive: true, force: true });
await mkdir(path.join(distDir, "data"), { recursive: true });

for (const file of [
  "index.html",
  "styles.css",
  "sync-state.js",
  "app.js",
  "account.js",
  "admin.html",
  "admin.css",
  "admin.js",
  "legal.html",
  "legal.css",
  "legal-config.js",
  "THIRD_PARTY_NOTICES.md",
  "CONTENT_PROVENANCE.md",
  "PRIVACY_AND_RETENTION.md",
  "SECURITY.md",
  "_headers",
]) {
  await copyFile(path.join(rootDir, file), path.join(distDir, file));
}

await cp(path.join(rootDir, "assets"), path.join(distDir, "assets"), {
  recursive: true,
});
await copyFile(
  path.join(rootDir, "data", "vocabulary-index.json"),
  path.join(distDir, "data", "vocabulary-index.json"),
);
await copyFile(
  path.join(rootDir, "data", "vocabulary-bundle.json"),
  path.join(distDir, "data", "vocabulary-bundle.json"),
);
await copyFile(
  path.join(rootDir, "data", "kaoyan-words.json"),
  path.join(distDir, "data", "kaoyan-words.json"),
);
await copyFile(
  path.join(rootDir, "data", "content-identity-lock.json"),
  path.join(distDir, "data", "content-identity-lock.json"),
);
await copyFile(
  path.join(rootDir, "data", "content-rights-summary.json"),
  path.join(distDir, "data", "content-rights-summary.json"),
);

await build({
  entryPoints: [path.join(toolsDir, "cloud-client-entry.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  outfile: path.join(distDir, "cloud-client.js"),
  minify: true,
  legalComments: "external",
});

const cloudConfig = {
  supabaseUrl: String(process.env.SUPABASE_URL ?? "").trim(),
  supabaseAnonKey: String(
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    "",
  ).trim(),
};

if (Boolean(cloudConfig.supabaseUrl) !== Boolean(cloudConfig.supabaseAnonKey)) {
  throw new Error(
    "Supabase configuration is incomplete: provide both the URL and publishable key.",
  );
}

if (cloudConfig.supabaseUrl) {
  await writeFile(
    path.join(distDir, "cloud-config.js"),
    `window.SENSE_VOCAB_CLOUD_CONFIG = Object.freeze(${JSON.stringify(cloudConfig)});\n`,
    "utf8",
  );
} else {
  await copyFile(
    path.join(rootDir, "cloud-config.js"),
    path.join(distDir, "cloud-config.js"),
  );
}

console.log(`Web release created at ${distDir}`);
console.log(
  cloudConfig.supabaseUrl
    ? "Supabase account support is configured from environment variables."
    : "Cloud configuration copied from cloud-config.js.",
);
