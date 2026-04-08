/* Cookie consent manager — plain script, no ES modules.
   GDPR: blocks Google Analytics until explicit opt-in.
   CCPA: includes Do Not Sell statement in privacy policy reference.
   Preference stored in localStorage key: lala_cookie_consent
*/
(function () {
  "use strict";

  var STORAGE_KEY = "lala_cookie_consent";
  var GA_ID = "G-99P9KH7JGP";
  var gaInjected = false;

  // ─── Preference storage ───────────────────────────────────────────────────

  function loadPreference() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function savePreference(analytics) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        analytics: analytics,
        ts: Date.now()
      }));
    } catch (e) { /* storage unavailable */ }
  }

  // ─── GA injection ─────────────────────────────────────────────────────────

  function injectGA() {
    if (gaInjected) return;
    gaInjected = true;

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_ID);
  }

  // ─── Apply stored consent ─────────────────────────────────────────────────

  function applyConsent(analytics) {
    if (analytics) {
      injectGA();
    }
    // If analytics === false we simply do nothing — GA is not loaded.
  }

  // ─── Banner ───────────────────────────────────────────────────────────────

  function hideBanner() {
    var banner = document.getElementById("cookie-banner");
    if (!banner) return;
    banner.classList.add("cookie-banner--hiding");
    // Remove after animation completes
    setTimeout(function () {
      banner.hidden = true;
      banner.classList.remove("cookie-banner--hiding");
    }, 400);
  }

  function showBanner() {
    var banner = document.getElementById("cookie-banner");
    if (!banner) return;
    banner.hidden = false;
    // Trigger slide-up animation on next frame
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add("cookie-banner--visible");
      });
    });
  }

  function accepted() {
    savePreference(true);
    applyConsent(true);
    hideBanner();
  }

  function declined() {
    savePreference(false);
    applyConsent(false);
    hideBanner();
  }

  function showPreferences() {
    // Re-show the banner so the user can change their mind
    var banner = document.getElementById("cookie-banner");
    if (!banner) return;
    banner.hidden = false;
    banner.classList.remove("cookie-banner--hiding");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add("cookie-banner--visible");
      });
    });
  }

  // ─── Wire up buttons ──────────────────────────────────────────────────────

  function wireButtons() {
    var acceptBtn = document.getElementById("cookie-accept");
    var declineBtn = document.getElementById("cookie-decline");
    var settingsBtn = document.getElementById("cookie-settings-btn");

    if (acceptBtn) {
      acceptBtn.addEventListener("click", function () { accepted(); });
    }
    if (declineBtn) {
      declineBtn.addEventListener("click", function () { declined(); });
    }
    if (settingsBtn) {
      settingsBtn.addEventListener("click", function () { showPreferences(); });
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    wireButtons();

    var pref = loadPreference();
    if (pref !== null) {
      // Preference already stored — apply it silently
      applyConsent(pref.analytics);
    } else {
      // No preference yet — show banner
      showBanner();
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.cookieConsent = {
    accepted: accepted,
    declined: declined,
    showPreferences: showPreferences
  };

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
