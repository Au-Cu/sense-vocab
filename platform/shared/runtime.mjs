import { namespaceKey } from "./product-contract.mjs";

export function createNativeRuntime({ targetId, storage, navigation, permissions }) {
  if (!targetId || !storage || !navigation || !permissions) throw new TypeError("runtime adapters are required");
  let phase = "created";
  return Object.freeze({
    targetId,
    get phase() { return phase; },
    async start() { phase = "running"; return { phase, targetId }; },
    async suspend() { if (phase === "running") phase = "suspended"; return { phase, targetId }; },
    async resume() { if (phase === "suspended") phase = "running"; return { phase, targetId }; },
    async stop() { phase = "stopped"; return { phase, targetId }; },
    stateKey(namespace, key) { return namespaceKey(namespace, key); },
    adapters: Object.freeze({ storage, navigation, permissions }),
  });
}
