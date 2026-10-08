import { createNativeRuntime } from "../../shared/runtime.mjs";
const unavailable = (name) => async () => { throw Object.assign(new Error(`${name} adapter is unavailable`), { code: "adapter-unavailable" }); };
export function createTargetRuntime() {
  return createNativeRuntime({ targetId: "macos-arm64", storage: { read: unavailable("macOS ARM64 durable storage"), write: unavailable("macOS ARM64 durable storage") }, navigation: { openWindow: unavailable("macOS ARM64 window navigation"), closeWindow: unavailable("macOS ARM64 window navigation") }, permissions: { request: unavailable("macOS ARM64 permission") } });
}
