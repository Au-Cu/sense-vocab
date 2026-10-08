import { createNativeRuntime } from "../../shared/runtime.mjs";
const unavailable = (name) => async () => { throw Object.assign(new Error(`${name} adapter is unavailable`), { code: "adapter-unavailable" }); };
export function createTargetRuntime() {
  return createNativeRuntime({ targetId: "android", storage: { read: unavailable("Android durable storage"), write: unavailable("Android durable storage") }, navigation: { openWindow: unavailable("Android activity navigation"), closeWindow: unavailable("Android activity navigation") }, permissions: { request: unavailable("Android runtime permission") } });
}
