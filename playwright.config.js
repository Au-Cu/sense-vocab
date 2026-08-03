const { defineConfig } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

// 自动选择可用的浏览器，避免硬编码某台机器的浏览器路径：
//   1) 已安装的 Chrome（首选——类目方原有用例就是跑在它上面，最稳）
//   2) Playwright 内置 Chromium（未指定 channel 时默认使用）
//   3) 已安装的 Edge（Windows 11 自带，兜底）
// 这样即使内置 Chromium 缺失或被安全软件移除，测试也能自动落到真实浏览器上。
function resolveBrowserUse() {
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
  ];
  if (chromePaths.some((p) => fs.existsSync(p))) {
    return { channel: "chrome" };
  }
  const bundledRoot = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  try {
    const hasBundled =
      fs.existsSync(bundledRoot) &&
      fs.readdirSync(bundledRoot).some((name) => /^chromium-/.test(name));
    if (hasBundled) return {};
  } catch {
    // 内置浏览器缓存目录不可读 → 视为缺失，继续向下探测。
  }
  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  if (edgePaths.some((p) => fs.existsSync(p))) {
    return { channel: "msedge" };
  }
  return {};
}

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
    "user-journey.spec.js",
  ],
  fullyParallel: false,
  workers: 1,
  use: resolveBrowserUse(),
});
