const fs = require("node:fs");
const path = require("node:path");

function testId(test) {
  const location = test.location || {};
  const relativeFile = path.relative(process.cwd(), location.file || "").replaceAll("\\", "/");
  return [relativeFile, location.line || 0, ...test.titlePath()].join("::");
}

class CompactPlaywrightReporter {
  constructor() {
    this.startedAt = Date.now();
    this.tests = [];
  }

  onTestEnd(test, result) {
    this.tests.push({
      id: testId(test),
      file: path.relative(process.cwd(), test.location?.file || "").replaceAll("\\", "/"),
      title: test.titlePath().join(" › "),
      status: result.status,
      expectedStatus: test.expectedStatus,
      durationMs: result.duration,
    });
  }

  onEnd(result) {
    const summaryPath = process.env.SENSE_VOCAB_TEST_SUMMARY_PATH;
    if (!summaryPath) return;
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    const counts = {};
    for (const test of this.tests) counts[test.status] = (counts[test.status] || 0) + 1;
    fs.writeFileSync(summaryPath, `${JSON.stringify({
      status: result.status,
      durationMs: Date.now() - this.startedAt,
      counts,
      tests: this.tests,
    }, null, 2)}\n`, "utf8");
  }
}

module.exports = CompactPlaywrightReporter;
