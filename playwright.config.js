const { defineConfig } = require("@playwright/test");

const requestedPort = Number(process.env.SENSE_VOCAB_TEST_PORT);
const testPort = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535
  ? requestedPort
  : 4173;
const testUrl = `http://127.0.0.1:${testPort}/`;
process.env.APP_URL ||= testUrl;

module.exports = defineConfig({
  testDir: "./tools",
  testMatch: [
    "morphology-ui.spec.js",
    "translation-ui.spec.js",
    "learning-flow.spec.js",
    "account-sync.spec.js",
    "sync-concurrency.spec.js",
    "cloud-client-chunk.spec.js",
    "book-scope.spec.js",
    "admin-ui.spec.js",
    "mobile-tutorial.spec.js",
    "security-hardening.spec.js",
    "confusion-globe.spec.js",
    "vocabulary-feedback.spec.js",
    "compliance-rights.spec.js",
    "public-attribution.spec.js",
    "dashboard.spec.js",
    "ui-theme.spec.js",
  ],
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: `${process.env.SENSE_VOCAB_PYTHON || "py -3"} -m http.server ${testPort} --bind 127.0.0.1`,
    url: testUrl,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
