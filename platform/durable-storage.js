/* Shared durable storage kernel for Web and native shells. */
(function initDurableStorage(global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const RECORD_VERSION = 1;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function createDurableStateStore({ backend, legacyStorage = null, namespace = "sense-vocab" } = {}) {
    if (!backend || typeof backend.get !== "function" || typeof backend.set !== "function") {
      throw new TypeError("A durable backend with get/set methods is required");
    }

    const keyFor = (key) => `${namespace}:${key}`;

    async function read(key, fallback = null) {
      const record = await backend.get(keyFor(key));
      if (!record) return clone(fallback);
      if (record.schemaVersion !== SCHEMA_VERSION || record.recordVersion !== RECORD_VERSION) {
        return clone(fallback);
      }
      return clone(record.value);
    }

    async function write(key, value) {
      const record = {
        schemaVersion: SCHEMA_VERSION,
        recordVersion: RECORD_VERSION,
        updatedAt: new Date().toISOString(),
        value: clone(value),
      };
      await backend.set(keyFor(key), record);
      return clone(record);
    }

    async function migrateLegacy(key, { removeLegacy = false } = {}) {
      if (!legacyStorage || typeof legacyStorage.getItem !== "function") {
        return { status: "unavailable", value: null };
      }
      const existing = await read(key, null);
      if (existing !== null) return { status: "already-present", value: existing };
      const raw = legacyStorage.getItem(key);
      if (raw === null) return { status: "missing", value: null };
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        return { status: "corrupt", value: null };
      }
      await write(key, value);
      if (removeLegacy && typeof legacyStorage.removeItem === "function") {
        legacyStorage.removeItem(key);
      }
      return { status: "migrated", value: clone(value) };
    }

    return Object.freeze({
      namespace,
      schemaVersion: SCHEMA_VERSION,
      read,
      write,
      migrateLegacy,
    });
  }

  function createIndexedDbBackend({ databaseName = "sense-vocab", storeName = "state" } = {}) {
    if (!global.indexedDB) throw new Error("IndexedDB is unavailable");
    const open = () => new Promise((resolve, reject) => {
      const request = global.indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    });
    const run = (mode, operation) => open().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB operation failed"));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    }));
    return Object.freeze({
      get: (key) => run("readonly", (store) => store.get(key)),
      set: (key, value) => run("readwrite", (store) => store.put(value, key)).then(() => undefined),
    });
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    RECORD_VERSION,
    createDurableStateStore,
    createIndexedDbBackend,
  });
  if (typeof module === "object" && module.exports) module.exports = api;
  global.SenseVocabDurableStorage = api;
})(typeof globalThis === "object" ? globalThis : window);
