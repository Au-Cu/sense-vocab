import { createNativeRuntime } from "../../shared/runtime.mjs";
const unavailable = (name) => async () => { throw Object.assign(new Error(`${name} adapter is unavailable`), { code: "adapter-unavailable" }); };
export function createTargetRuntime() {
  return createNativeRuntime({ targetId: "windows-arm64", storage: { read: unavailable("Windows ARM64 durable storage"), write: unavailable("Windows ARM64 durable storage") }, navigation: { openWindow: unavailable("Windows ARM64 window navigation"), closeWindow: unavailable("Windows ARM64 window navigation") }, permissions: { request: unavailable("Windows ARM64 permission") } });
}
