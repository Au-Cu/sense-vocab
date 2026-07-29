const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tools",
  testMatch: [
    "morphology-ui.spec.js",
    "translation-ui.spec.js",
    "learning-flow.spec.js",
    "account-sync.spec.js",
    "sync-concurrency.spec.js",
    "book-scope.spec.js",
    "admin-ui.spec.js",
    "mobile-tutorial.spec.js",
    "security-hardening.spec.js",
  ],
  fullyParallel: false,
  workers: 1,
});
