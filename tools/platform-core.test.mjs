import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import storage from "../platform/durable-storage.js";
import { createInitialSenseState, transitionSense } from "../platform/shared/learning-state.mjs";
import { createMigrationPlan } from "../platform/shared/product-contract.mjs";
import { createNativeRuntime } from "../platform/shared/runtime.mjs";
import { createNativeStorageContract } from "../platform/shared/native-storage.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function memoryBackend() {
  const records = new Map();
  return {
    records,
    async get(key) { return records.get(key) ?? null; },
    async set(key, value) { records.set(key, value); },
  };
}

function legacyStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
  };
}

test("platform matrix contains Web plus the seven ordered native targets", async () => {
  const matrix = JSON.parse(await readFile(path.join(rootDir, "platform/platform-matrix.json"), "utf8"));
  assert.equal(matrix.webTarget.status, "available");
  assert.deepEqual(matrix.nativeTargets.map((target) => target.id), [
    "windows-x86_64", "windows-arm64", "macos-x86_64", "macos-arm64", "ios", "android", "harmonyos",
  ]);
  assert.ok(matrix.nativeTargets.every((target) => target.publicDistribution === "website-only"));
  assert.equal(matrix.versioning.scheme, "independent-per-target");
  assert.ok(matrix.nativeTargets.every((target) => target.versioning.productVersion === "0.0.0" && target.versioning.buildNumber === 0));
  assert.ok(matrix.nativeTargets.every((target) => target.updatePolicy === "target-scoped" && target.rollbackPolicy));
  for (const target of matrix.nativeTargets) {
    const project = JSON.parse(await readFile(path.join(rootDir, target.projectPath, "project.json"), "utf8"));
    for (const relative of ["project.json", project.entry, "resources/offline-manifest.json", "tests/fixture.json", "README.md"]) await readFile(path.join(rootDir, target.projectPath, relative));
  }
});

test("shared learning state preserves stable identity and guarded transitions", () => {
  const identity = { wordId: "w1", senseId: "s1" };
  assert.equal(createInitialSenseState(identity).status, "new");
  const event = transitionSense({ identity, from: "new", to: "reinforce", learningDay: "2026-10-07", occurredAt: "2026-10-07T00:00:00.000Z" });
  assert.equal(event.identity.senseId, "s1");
  assert.throws(() => transitionSense({ identity, from: "new", to: "review", learningDay: "2026-10-07" }), /invalid sense transition/);
});

test("migration plan is namespace-scoped and non-destructive", () => {
  assert.deepEqual(createMigrationPlan({ namespace: "guest", legacyKeys: ["learning", "feedback"], durableKeys: ["learning"] }), [
    { key: "learning", namespace: "guest", action: "skip-existing", destructive: false },
    { key: "feedback", namespace: "guest", action: "import-explicitly", destructive: false },
  ]);
});

test("native runtime exposes lifecycle and adapter boundaries without browser globals", async () => {
  const runtime = createNativeRuntime({ targetId: "android", storage: {}, navigation: {}, permissions: {} });
  assert.equal((await runtime.start()).phase, "running");
  assert.equal((await runtime.suspend()).phase, "suspended");
  assert.equal((await runtime.resume()).phase, "running");
  assert.equal((await runtime.stop()).phase, "stopped");
  assert.equal(runtime.stateKey("guest", "learning"), "sense-vocab:guest:learning");
});

test("native durable storage contract is namespaced, versioned, and rollback-aware", async () => {
  const records = new Map();
  const store = createNativeStorageContract({ namespace: "account", backend: {
    async read(key) { return records.get(key) ?? null; },
    async write(key, value) { records.set(key, value); },
    async rollback(key) { records.delete(key); },
  } });
  await store.write("learning", { status: "review" }, 3);
  assert.deepEqual(await store.read("learning"), { status: "review" });
  assert.equal(records.get("sense-vocab:account:learning").revision, 3);
  assert.deepEqual(await store.rollback("learning"), { status: "rolled-back" });
  assert.equal(await store.read("learning", "fallback"), "fallback");
});

test("durable records survive a new store instance and preserve a namespaced envelope", async () => {
  const backend = memoryBackend();
  const first = storage.createDurableStateStore({ backend, namespace: "account:user-a" });
  await first.write("learning", { wordId: "w1", senseId: "s1", status: "reinforce" });
  const second = storage.createDurableStateStore({ backend, namespace: "account:user-a" });
  assert.deepEqual(await second.read("learning"), { wordId: "w1", senseId: "s1", status: "reinforce" });
  assert.equal(backend.records.get("account:user-a:learning").schemaVersion, 1);
  assert.equal(backend.records.has("account:user-b:learning"), false);
});

test("legacy Web data migration is explicit, idempotent, and does not delete by default", async () => {
  const backend = memoryBackend();
  const legacy = legacyStorage({ learning: JSON.stringify({ wordId: "w2", senseId: "s2", status: "review" }) });
  const store = storage.createDurableStateStore({ backend, legacyStorage: legacy });
  assert.deepEqual(await store.migrateLegacy("learning"), { status: "migrated", value: { wordId: "w2", senseId: "s2", status: "review" } });
  assert.equal(legacy.has("learning"), true);
  assert.equal((await store.migrateLegacy("learning")).status, "already-present");
  const other = legacyStorage({ learning: JSON.stringify({ status: "mastered" }) });
  const second = storage.createDurableStateStore({ backend: memoryBackend(), legacyStorage: other });
  await second.migrateLegacy("learning", { removeLegacy: true });
  assert.equal(other.has("learning"), false);
});

test("corrupt or incompatible records fail closed to the supplied fallback", async () => {
  const backend = memoryBackend();
  backend.records.set("sense-vocab:learning", { schemaVersion: 99, recordVersion: 1, value: { status: "mastered" } });
  const store = storage.createDurableStateStore({ backend });
  assert.deepEqual(await store.read("learning", { status: "new" }), { status: "new" });
  const legacy = legacyStorage({ learning: "not-json" });
  const corrupt = storage.createDurableStateStore({ backend: memoryBackend(), legacyStorage: legacy });
  assert.deepEqual(await corrupt.migrateLegacy("learning"), { status: "corrupt", value: null });
});
