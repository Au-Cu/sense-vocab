# HarmonyOS target

Native DevEco/HAP work is paused short-to-medium term. The current planned route is the separately built Android APK distributed through 卓易通; it is not a native HarmonyOS package. `powershell -NoProfile -ExecutionPolicy Bypass -File platform/harmonyos/build.ps1 -Variant debug` remains as an explicit native probe and must fail until DevEco `hvigorw` is installed. The native route and the separate 卓易通 Android-compat route are documented in `compatibility.md`.
