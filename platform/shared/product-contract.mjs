export const CONTRACT_VERSION = 1;
export const SENSE_STATUSES = Object.freeze(["new", "reinforce", "review", "mastered"]);
export const NAMESPACES = Object.freeze(["guest", "account"]);

export function assertStableIdentity(value) {
  if (!value || typeof value !== "object" || typeof value.wordId !== "string" || typeof value.senseId !== "string") {
    throw new TypeError("stable content identity requires wordId and senseId");
  }
  return { wordId: value.wordId, senseId: value.senseId };
}

export function namespaceKey(namespace, key) {
  if (!NAMESPACES.includes(namespace)) throw new TypeError(`unsupported namespace: ${namespace}`);
  if (typeof key !== "string" || !key.trim()) throw new TypeError("state key is required");
  return `sense-vocab:${namespace}:${key}`;
}

export function createStateEnvelope({ namespace, key, value, revision = 0, updatedAt = new Date().toISOString() }) {
  return { contractVersion: CONTRACT_VERSION, namespace, key, revision, updatedAt, value };
}

export function assertStateEnvelope(record) {
  if (!record || record.contractVersion !== CONTRACT_VERSION || !NAMESPACES.includes(record.namespace)) {
    throw new TypeError("incompatible state envelope");
  }
  if (typeof record.key !== "string" || !Number.isInteger(record.revision) || record.revision < 0) {
    throw new TypeError("invalid state envelope metadata");
  }
  return record;
}

export function createMigrationPlan({ namespace, legacyKeys = [], durableKeys = [] }) {
  const durable = new Set(durableKeys);
  return legacyKeys.map((key) => ({
    key,
    namespace,
    action: durable.has(key) ? "skip-existing" : "import-explicitly",
    destructive: false,
  }));
}
