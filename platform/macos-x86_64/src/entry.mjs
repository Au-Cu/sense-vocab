import { createNativeRuntime } from "../../shared/runtime.mjs";
const unavailable = (name) => async () => { throw Object.assign(new Error(`${name} adapter is unavailable`), { code: "adapter-unavailable" }); };
export function createTargetRuntime() {
  return createNativeRuntime({ targetId: "macos-x86_64", storage: { read: unavailable("macOS durable storage"), write: unavailable("macOS durable storage") }, navigation: { openWindow: unavailable("macOS window navigation"), closeWindow: unavailable("macOS window navigation") }, permissions: { request: unavailable("macOS permission") } });
}
