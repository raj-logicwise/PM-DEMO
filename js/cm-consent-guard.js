/**
 * cm-consent-guard.js
 *
 * Blocks non-required third-party trackers until the user grants consent
 * via the TrustArc Consent Management Platform.
 *
 * Handles two directions:
 *  ACTIVATE  — on accept: unblocks scripts, iframes, Medchat, YT background
 *  REVOKE    — on reject mid-session: immediately blanks active iframes,
 *              removes YT background video, removes Medchat widget
 *
 * Revocation is detected via:
 *  - TrustArc postMessage (fires immediately when user submits preferences)
 *  - Cookie watcher (polls every 1 s as a reliable fallback)
 */
(function () {
  "use strict";

  /* ── constants ─────────────────────────────────────────────────────────── */

  // src substrings that identify consent-gated iframes after activation
  var GATED_PATTERNS = [
    "youtube.com/embed",
    "player.vimeo.com",
    "snapwidget.com/embed",
    "survey.prism-medical.com/zs",
    "qrco.de/"
  ];

  var PLACEHOLDER_STYLE =
    "background:#f0f4f8;border:1px solid #d0d8e4;border-radius:6px;" +
    "padding:24px;text-align:center;font-family:sans-serif;color:#52607a;margin:8px 0;";

  var PLACEHOLDER_INNER =
    '<p style="margin:0 0 6px;font-size:14px;font-weight:600;">Content blocked</p>' +
    '<p style="margin:0;font-size:12px;">Please accept cookies in the consent banner to view this content.</p>';

  /* ── cookie helper ─────────────────────────────────────────────────────── */

  function getCookie(name) {
    var rx = new RegExp("(?:^|;\\s*)" + name.replace(/[[\]{}()*+?.\\^$|]/g, "\\$&") + "=([^;]*)");
    var m = document.cookie.match(rx);
    return m ? decodeURIComponent(m[1]) : null;
  }

  /**
   * Returns true  — non-required consent given
   *         false — consent rejected
   *         null  — no cookie yet (first visit)
   */
  function hasPriorConsent() {
    var gdprPrefs = getCookie("notice_gdpr_prefs");
    if (gdprPrefs !== null) {
      var cats = gdprPrefs.split(",");
      for (var i = 0; i < cats.length; i++) {
        var n = parseInt(cats[i].trim(), 10);
        if (!isNaN(n) && n >= 2) return true;
      }
      return false;
    }
    var alt = getCookie("cmapi_cookie_privacy") || getCookie("notice_preferences");
    if (alt !== null) return /[2-9]/.test(alt);
    return null;
  }

  /* ── TrustArc API ──────────────────────────────────────────────────────── */

  function checkViaAPI() {
    if (!window.PrivacyManagerAPI) return false;
    try {
      var result = window.PrivacyManagerAPI.callApi(
        "getGDPRConsentDecision",
        window.location.host
      );
      if (!result || !result.consentDecision) return false;
      for (var i = 0; i < result.consentDecision.length; i++) {
        var n = parseInt(result.consentDecision[i], 10);
        if (!isNaN(n) && n >= 2) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /* ── placeholder helper ────────────────────────────────────────────────── */

  function insertPlaceholderBefore(el) {
    var prev = el.previousElementSibling;
    if (prev && prev.hasAttribute("data-consent-placeholder")) return;
    var ph = document.createElement("div");
    ph.setAttribute("data-consent-placeholder", "");
    ph.setAttribute("style", PLACEHOLDER_STYLE);
    ph.innerHTML = PLACEHOLDER_INNER;
    el.parentNode.insertBefore(ph, el);
  }

  /* ── ACTIVATE ──────────────────────────────────────────────────────────── */

  function activateScript(el) {
    var src = el.getAttribute("data-src");
    if (!src || !el.parentNode) return;
    var script = document.createElement("script");
    script.src = src;
    script.type = "text/javascript";
    var attrs = el.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var n = attrs[a].name;
      if (n !== "data-src" && n !== "data-consent-required" && n !== "type") {
        script.setAttribute(n, attrs[a].value);
      }
    }
    el.parentNode.insertBefore(script, el.nextSibling);
    el.parentNode.removeChild(el);
  }

  function activateIframe(el) {
    var src = el.getAttribute("data-consent-src");
    if (!src) return;
    var prev = el.previousElementSibling;
    if (prev && prev.hasAttribute("data-consent-placeholder")) {
      prev.parentNode.removeChild(prev);
    }
    el.setAttribute("src", src);
    el.removeAttribute("data-consent-src");
    el.removeAttribute("hidden");
  }

  function activateTrackers() {
    if (window.__cmTrackersActivated) return;
    window.__cmTrackersActivated = true;

    // 1. Unblock <script type="text/plain" data-consent-required> tags
    var scripts = document.querySelectorAll('script[type="text/plain"][data-consent-required]');
    for (var i = 0; i < scripts.length; i++) activateScript(scripts[i]);

    // 2. Unblock hidden iframes
    var iframes = document.querySelectorAll("iframe[data-consent-src]");
    for (var j = 0; j < iframes.length; j++) activateIframe(iframes[j]);

    // 3. Restore Avada YouTube background video attribute and class
    var ytBgs = document.querySelectorAll("[data-consent-yt-id]");
    for (var k = 0; k < ytBgs.length; k++) {
      var ytId = ytBgs[k].getAttribute("data-consent-yt-id");
      ytBgs[k].setAttribute("data-youtube-video-id", ytId);
      ytBgs[k].removeAttribute("data-consent-yt-id");
      ytBgs[k].classList.remove("fusion-video-consent-blocked");
      ytBgs[k].classList.add("fusion-background-video-wrapper");
      ytBgs[k].style.display = "";
    }

    // 4. Allow Medchat to load
    window.__cmConsentAccepted = true;
    if (typeof window.__cmLoadMedchat === "function") {
      window.__cmLoadMedchat();
    }
  }

  /* ── REVOKE (instant mid-session) ──────────────────────────────────────── */

  function isGatedSrc(src) {
    if (!src) return false;
    for (var i = 0; i < GATED_PATTERNS.length; i++) {
      if (src.indexOf(GATED_PATTERNS[i]) !== -1) return true;
    }
    return false;
  }

  function revokeTrackers() {
    if (!window.__cmTrackersActivated) return;
    window.__cmTrackersActivated = false;
    window.__cmConsentAccepted = false;

    // 1. Instantly blank any consent-gated iframes that were activated
    var iframes = document.querySelectorAll("iframe");
    for (var i = 0; i < iframes.length; i++) {
      var src = iframes[i].getAttribute("src") || "";
      if (!isGatedSrc(src)) continue;
      iframes[i].setAttribute("data-consent-src", src); // save for re-activate
      iframes[i].setAttribute("src", "about:blank");
      iframes[i].setAttribute("hidden", "");
      insertPlaceholderBefore(iframes[i]);
    }

    // 2. Stop Avada YouTube background video instantly
    var ytWrappers = document.querySelectorAll(
      ".fusion-background-video-wrapper[data-youtube-video-id]"
    );
    for (var j = 0; j < ytWrappers.length; j++) {
      var ytId = ytWrappers[j].getAttribute("data-youtube-video-id");
      ytWrappers[j].setAttribute("data-consent-yt-id", ytId);
      ytWrappers[j].removeAttribute("data-youtube-video-id");
      // Blank the inner iframe Avada created for the YT player
      var ytIframe = ytWrappers[j].querySelector("iframe");
      if (ytIframe) ytIframe.setAttribute("src", "about:blank");
      ytWrappers[j].style.opacity = "0";
    }

    // 3. Remove Medchat widget from DOM instantly
    var medchatScript = document.querySelector('script[data-medchat-widget="true"]');
    if (medchatScript && medchatScript.parentNode) {
      medchatScript.parentNode.removeChild(medchatScript);
    }
    // Remove all Medchat DOM elements
    var medchatEls = document.querySelectorAll('[id*="medchat"],[class*="medchat"]');
    for (var m = 0; m < medchatEls.length; m++) {
      if (medchatEls[m].parentNode) medchatEls[m].parentNode.removeChild(medchatEls[m]);
    }
    // Clear Medchat global state so the script re-initializes cleanly on re-accept.
    // Without this the script sees these globals and skips widget creation entirely.
    // try { delete window.MedChat; } catch (e) { window.MedChat = undefined; }
    // try { delete window.MedChatApp; } catch (e) { window.MedChatApp = undefined; }
    // try { delete window.medchatapp; } catch (e) { window.medchatapp = undefined; }
    window.__medchatWidgetLoading = false;

    // Reload the page so all in-flight Medchat XHR/fetch requests (which
    // cannot be cancelled via DOM removal) are cleared. On reload the
    // rejection cookie is already set, so the widget never loads again.
    // setTimeout(function () { window.location.reload(); }, 300);
  }

  /* ── consent state handler ─────────────────────────────────────────────── */

  function handleConsentChange() {
    var accepted = checkViaAPI();
    if (accepted) {
      activateTrackers();
    } else if (window.__cmTrackersActivated) {
      revokeTrackers(); // user rejected while session was active
    }
  }

  /* ── initial check on page load ────────────────────────────────────────── */

  function runInitialCheck() {
    if (checkViaAPI()) { activateTrackers(); return; }
    var cookieState = hasPriorConsent();
    if (cookieState === true) activateTrackers();
    // false → rejected, null → first visit — both stay blocked
  }

  /* ── TrustArc postMessage listener (fires on every preference submit) ──── */

  window.addEventListener("message", function (e) {
    try {
      var data = JSON.parse(e.data);
      if (
        data &&
        data.PrivacyManagerAPI &&
        data.PrivacyManagerAPI.capabilities &&
        data.PrivacyManagerAPI.action === "getConsentDecision"
      ) {
        handleConsentChange();
      }
    } catch (ex) {
      /* not a TrustArc message */
    }
  });

  /* ── poll for PrivacyManagerAPI on first load ───────────────────────────── */

  var pollAttempts = 0;
  var poll = setInterval(function () {
    pollAttempts++;
    if (pollAttempts > 200) { clearInterval(poll); return; }
    if (window.PrivacyManagerAPI) {
      clearInterval(poll);
      try {
        var req = {
          PrivacyManagerAPI: {
            action: "getConsentDecision",
            timestamp: new Date().getTime(),
            self: window.location.host,
          },
        };
        window.top.postMessage(JSON.stringify(req), "*");
      } catch (ex) {}
      setTimeout(function () {
        if (!window.__cmTrackersActivated && checkViaAPI()) activateTrackers();
      }, 150);
    }
  }, 50);

  /* ── cookie watcher — reliable fallback for mid-session changes ─────────── */
  // Polls every 1 s after the 3 s mark so it catches any preference change
  // (accept → reject, reject → accept) even if postMessage fires inconsistently.
  var lastCookieState = null;
  setTimeout(function () {
    setInterval(function () {
      var current = hasPriorConsent();
      if (current === lastCookieState) return; // no change
      lastCookieState = current;
      if (current === true) {
        activateTrackers();
      } else if (current === false && window.__cmTrackersActivated) {
        revokeTrackers();
      }
    }, 1000);
  }, 3000);

  /* ── kick off ──────────────────────────────────────────────────────────── */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runInitialCheck);
  } else {
    runInitialCheck();
  }

  // Public API
  window.__cmActivateTrackers = activateTrackers;
  window.__cmRevokeTrackers = revokeTrackers;

  // Avada hook — called by min3dab.js before loading YouTube iframe API.
  // Returning false prevents YouTube from loading when consent is not given.
  window.fusionGetConsent = function () {
    return checkViaAPI() || (hasPriorConsent() === true);
  };
})();
