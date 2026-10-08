import { createNativeRuntime } from "../../shared/runtime.mjs";
const unavailable = (name) => async () => { throw Object.assign(new Error(`${name} adapter is unavailable`), { code: "adapter-unavailable" }); };
export function createTargetRuntime() {
  return createNativeRuntime({ targetId: "ios", storage: { read: unavailable("iOS durable storage"), write: unavailable("iOS durable storage") }, navigation: { openWindow: unavailable("iOS navigation controller"), closeWindow: unavailable("iOS navigation controller") }, permissions: { request: unavailable("iOS permission") } });
}
