(function () {
  "use strict";

  var STORAGE_KEY = "swagger-dark-mode";
  var body = document.body;

  function applyDarkMode(enabled) {
    if (enabled) {
      body.classList.add("dark-mode");
    } else {
      body.classList.remove("dark-mode");
    }
    updateButton(enabled);
  }

  function updateButton(enabled) {
    var btn = document.getElementById("dark-mode-toggle");
    if (!btn) return;
    var icon = btn.querySelector(".toggle-icon");
    var label = btn.querySelector(".toggle-label");
    if (icon) {
      icon.textContent = enabled ? "☀️" : "🌙";
    }
    if (label) {
      label.textContent = enabled ? "Light" : "Dark";
    }
  }

  function getSavedPreference() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") return true;
      if (saved === "false") return false;
    } catch (e) {
      /* localStorage unavailable */
    }
    // Fall back to OS preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return true;
    }
    return false;
  }

  function savePreference(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    } catch (e) {
      /* localStorage unavailable */
    }
  }

  function createToggleButton() {
    var btn = document.createElement("button");
    btn.id = "dark-mode-toggle";
    btn.className = "dark-mode-toggle";
    btn.setAttribute("aria-label", "Toggle dark mode");
    btn.innerHTML =
      '<span class="toggle-icon">🌙</span><span class="toggle-label">Dark</span>';
    btn.addEventListener("click", function () {
      var isDark = body.classList.toggle("dark-mode");
      savePreference(isDark);
      updateButton(isDark);
    });
    document.body.appendChild(btn);
  }

  // Initialize
  function init() {
    var isDark = getSavedPreference();
    applyDarkMode(isDark);
    createToggleButton();
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
