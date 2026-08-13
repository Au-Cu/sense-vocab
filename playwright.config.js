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
    "confusion-globe.spec.js",
    "vocabulary-feedback.spec.js",
    "compliance-rights.spec.js",
    "public-attribution.spec.js",
  ],
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: "py -3 -m http.server 4173 --bind 127.0.0.1",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
