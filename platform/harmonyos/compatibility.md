# HarmonyOS native vs 卓易通 compatibility route

These are separate targets:

- `harmonyos-native` means an ArkTS/DevEco project producing HarmonyOS HAP/APP artifacts. Huawei's build overview documents Hvigor, `build-profile.json5`, `hvigorfile.ts`, HAP/App Pack outputs and the API-version-specific project structure: <https://developer.huawei.com/consumer/en/doc/harmonyos-guides-V2/build_overview-0000001055075201-V2>.
- `harmonyos-android-compat` means an Android APK used inside the 卓易通 environment. It is not a native HAP/APP and cannot be represented as a successful HarmonyOS-native build.

The official 卓易通 FAQ describes a managed third-party-app environment, app-management screens for notifications, permissions and storage, and an in-app update check. It also distinguishes behavior on HarmonyOS 5.0/5.1 and 6.0+: <https://www.droitong.com/CommonQues.html>. This is evidence for the existence of a managed compatibility/distribution route, not proof that Sense Vocab's APK is accepted, installable, fully offline, or compatible on every version. The route must be verified on the exact device and 卓易通 version.

No repackaging, signature bypass, unofficial installer, or modified APK is permitted. The Android APK remains built and signed under its Android target; 卓易通 acceptance, permissions, files, notifications, background behavior, update continuity and account/sync fallback require separate device evidence.
