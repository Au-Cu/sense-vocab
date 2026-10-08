import { createNativeRuntime } from "../../shared/runtime.mjs";

const unavailable = (name) => async () => { throw Object.assign(new Error(`${name} adapter is unavailable`), { code: "adapter-unavailable" }); };
export function createTargetRuntime() {
  return createNativeRuntime({
    targetId: "windows-x86_64",
    storage: { read: unavailable("Windows durable storage"), write: unavailable("Windows durable storage") },
    navigation: { openWindow: unavailable("Windows window navigation"), closeWindow: unavailable("Windows window navigation") },
    permissions: { request: unavailable("Windows permission") },
  });
}
