import { createNativeRuntime } from "../../shared/runtime.mjs";
const unavailable = (name) => async () => { throw Object.assign(new Error(`${name} adapter is unavailable`), { code: "adapter-unavailable" }); };
export function createTargetRuntime() {
  return createNativeRuntime({ targetId: "harmonyos", storage: { read: unavailable("HarmonyOS durable storage"), write: unavailable("HarmonyOS durable storage") }, navigation: { openWindow: unavailable("HarmonyOS ability navigation"), closeWindow: unavailable("HarmonyOS ability navigation") }, permissions: { request: unavailable("HarmonyOS permission") } });
}
