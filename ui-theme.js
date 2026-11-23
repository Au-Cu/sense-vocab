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
    const options = document.querySelector("#colorModeOptions");
    if (options) options.dataset.selected = colorMode;
    const message = document.querySelector("#colorModeMessage");
    if (message) {
      message.hidden = saved;
      message.textContent = saved ? "" : "当前浏览器未允许保存，刷新后可能恢复浅色。";
    }
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
    const theme = getTheme();
    document.querySelectorAll('input[name="uiTheme"]').forEach((input) => { input.checked = input.value === theme; });
    const options = document.querySelector("#themeModeOptions");
    if (options) options.dataset.selected = theme;
    const message = document.querySelector("#uiThemeMessage");
    if (message) {
      message.hidden = detail.persisted !== false;
      message.textContent = detail.persisted === false ? "当前浏览器未允许保存，刷新后可能恢复经典界面。" : "";
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
    const options = document.querySelectorAll('input[name="uiTheme"]');
    if (!options.length) return;
    applyColor(colorMode);
    document.querySelectorAll('input[name="colorMode"]').forEach((input) => {
      input.addEventListener("change", () => { if (input.checked) applyColor(input.value, true); });
    });
    syncThemeControl({ persisted: document.documentElement.dataset.uiThemeStorage === "unavailable" ? false : null });
    options.forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        const detail = applyTheme(input.value, { persist: true, source: "control" });
        syncThemeControl(detail);
      });
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
