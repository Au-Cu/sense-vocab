import { assertStateEnvelope, createStateEnvelope, namespaceKey } from "./product-contract.mjs";

export function createNativeStorageContract({ backend, namespace }) {
  if (!backend || typeof backend.read !== "function" || typeof backend.write !== "function") throw new TypeError("native storage backend must implement read/write");
  return Object.freeze({
    async read(key, fallback = null) {
      const record = await backend.read(namespaceKey(namespace, key));
      if (!record) return fallback;
      try { return assertStateEnvelope(record).value; } catch { return fallback; }
    },
    async write(key, value, revision = 0) {
      const record = createStateEnvelope({ namespace, key, value, revision });
      await backend.write(namespaceKey(namespace, key), record);
      return record;
    },
    async rollback(key) {
      if (typeof backend.rollback !== "function") return { status: "unsupported" };
      await backend.rollback(namespaceKey(namespace, key));
      return { status: "rolled-back" };
    },
  });
}
