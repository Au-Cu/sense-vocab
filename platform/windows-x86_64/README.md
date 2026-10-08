# Windows x86_64 target

The entry and adapter boundary are in `src/entry.mjs`; browser page code is not copied here. Run `node tools/platform-target.mjs --target windows-x86_64` to inspect the source-ready project and its toolchain blockers. Native compilation, signing, installation, device validation, and website readiness remain blocked until the Windows packager and certificate are supplied.
