(() => {
  "use strict";

  const STORAGE_KEY = "sense-vocab-ui-theme-v1";
  const COLOR_KEY = "sense-vocab-color-mode-v1";
  const colorMedia = window.matchMedia("(prefers-color-scheme: dark)");
  const normalizeColor = (value) => ["light", "dark", "system"].includes(value) ? value : "light";
  let colorMode = "light";
  try { colorMode = normalizeColor(window.localStorage.getItem(COLOR_KEY)); } catch {}

  function applyColor(value, persist = false) {
    colorMode = normalizeColor(value);
    const dark = colorMode === "dark" || (colorMode === "system" && colorMedia.matches);
    document.documentElement.dataset.colorMode = dark ? "dark" : "light";
    let saved = true;
    if (persist) {
      try { window.localStorage.setItem(COLOR_KEY, colorMode); } catch { saved = false; }
    }
    document.querySelectorAll('input[name="colorMode"]').forEach((input) => { input.checked = input.value === colorMode; });
    const message = document.querySelector("#colorModeMessage");
    if (message) message.textContent = saved ? "仅保存在当前设备。" : "当前浏览器未允许保存，刷新后可能恢复浅色。";
    updateBrowserChrome(getTheme());
  }
  const CLASSIC_THEME = "classic";
  const LIQUID_GLASS_THEME = "liquid-glass";
  const SUPPORTED_THEMES = new Set([CLASSIC_THEME, LIQUID_GLASS_THEME]);

  function normalizeTheme(value) {
    return SUPPORTED_THEMES.has(value) ? value : CLASSIC_THEME;
  }

  function readStoredTheme() {
    try {
      return {
        theme: normalizeTheme(window.localStorage.getItem(STORAGE_KEY)),
        storageAvailable: true,
      };
    } catch {
      return { theme: CLASSIC_THEME, storageAvailable: false };
    }
  }

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
      return true;
    } catch {
      return false;
    }
  }

  function updateBrowserChrome(theme) {
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute(
      "content",
      document.documentElement.dataset.colorMode === "dark" ? "#10171d" : theme === LIQUID_GLASS_THEME ? "#dfeaf8" : "#f7f4ee",
    );
  }

  function applyTheme(value, { persist = false, source = "bootstrap" } = {}) {
    const theme = normalizeTheme(value);
    const previousTheme = normalizeTheme(document.documentElement.dataset.uiTheme);
    const persisted = persist ? writeStoredTheme(theme) : null;

    document.documentElement.dataset.uiTheme = theme;
    document.documentElement.dataset.uiThemeStorage = persisted === false
      ? "unavailable"
      : "available";
    updateBrowserChrome(theme);

    const detail = Object.freeze({
      theme,
      previousTheme,
      persisted,
      source,
    });
    window.dispatchEvent(new CustomEvent("sensevocab:ui-theme-change", { detail }));
    return detail;
  }

  function getTheme() {
    return normalizeTheme(document.documentElement.dataset.uiTheme);
  }

  function syncThemeControl(detail = {}) {
    const toggle = document.querySelector("#liquidGlassToggle");
    const badge = document.querySelector("#uiThemeBadge");
    const description = document.querySelector("#uiThemeDescription");
    if (!toggle || !badge || !description) return;

    const theme = getTheme();
    const liquidGlassEnabled = theme === LIQUID_GLASS_THEME;
    toggle.checked = liquidGlassEnabled;
    toggle.setAttribute("aria-checked", String(liquidGlassEnabled));
    badge.textContent = liquidGlassEnabled ? "液态玻璃" : "经典";
    description.textContent = liquidGlassEnabled
      ? "液态玻璃界面已开启：导航与控件采用通透、浮动的光感层次。"
      : "经典界面已开启：保持原有简洁、稳定的纸面风格。";

    if (detail.persisted === false) {
      description.textContent += " 当前浏览器未允许保存，刷新后可能恢复经典界面。";
    }
  }

  const initialPreference = readStoredTheme();
  applyColor(colorMode);
  applyTheme(initialPreference.theme, { source: "bootstrap" });
  if (!initialPreference.storageAvailable) {
    document.documentElement.dataset.uiThemeStorage = "unavailable";
  }

  window.SenseVocabTheme = Object.freeze({
    storageKey: STORAGE_KEY,
    themes: Object.freeze({
      classic: CLASSIC_THEME,
      liquidGlass: LIQUID_GLASS_THEME,
    }),
    getTheme,
    setTheme(theme) {
      return applyTheme(theme, { persist: true, source: "control" });
    },
  });

  function bindThemeControl() {
    const toggle = document.querySelector("#liquidGlassToggle");
    if (!toggle) return;
    applyColor(colorMode);
    document.querySelectorAll('input[name="colorMode"]').forEach((input) => {
      input.addEventListener("change", () => { if (input.checked) applyColor(input.value, true); });
    });
    syncThemeControl();
    toggle.addEventListener("change", () => {
      const nextTheme = toggle.checked ? LIQUID_GLASS_THEME : CLASSIC_THEME;
      const detail = applyTheme(nextTheme, {
        persist: true,
        source: "control",
      });
      syncThemeControl(detail);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindThemeControl, { once: true });
  } else {
    bindThemeControl();
  }

  window.addEventListener("sensevocab:ui-theme-change", (event) => {
    syncThemeControl(event.detail);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === COLOR_KEY) { applyColor(event.newValue); return; }
    if (event.key !== STORAGE_KEY) return;
    applyTheme(event.newValue, { source: "storage" });
  });
  colorMedia.addEventListener("change", () => { if (colorMode === "system") applyColor(colorMode); });
})();
