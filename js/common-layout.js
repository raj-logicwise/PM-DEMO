(function () {
  "use strict";

  var HEADER_PLACEHOLDER_ID = "common-layout-header";
  var FOOTER_PLACEHOLDER_ID = "common-layout-footer";

  var MENU_GROUPS = [
    { prefix: "billing-solutions", page: "billing-solutions" },
    { prefix: "specialty-solutions", page: "specialty-solutions-2" },
    { prefix: "consumer-solutions", page: "consumer-solutions" },
    { prefix: "resources", page: "resources-2" },
    { prefix: "team-prism", page: "team-prism" }
  ];
  var TRUSTARC_SRC =
    "https://consent.trustarc.com/notice?domain=orw0nf&c&c=teconsent&js=nj&noticeType=bb&gtm=1&text=true&cookieLink=https://www.prism-medical.com/privacy-statement&privacypolicylink=https://www.prism-medical.com/privacy-statement";
  var MEDCHAT_HOME_SRC =
    "https://medchatapp.com/widget/widget.js?api-key=MA0SwXYtCkG4AhzxIg7hbg&v=1";
  var MEDCHAT_DEFAULT_SRC =
    "https://medchatapp.com/widget/widget.js?api-key=MA0SwXYtCkG4AhzxIg7hbg";

  function handlePreloader() {
    var preloader = document.querySelector(".preloader");
    if (!preloader) {
      return;
    }

    setTimeout(function () {
      preloader.style.transition = "opacity 500ms ease";
      preloader.style.opacity = "0";

      setTimeout(function () {
        if (preloader && preloader.parentNode) {
          preloader.parentNode.removeChild(preloader);
        }
      }, 520);
    }, 200);
  }

  function normalizePath(path) {
    if (!path) {
      return "index";
    }
    var value = String(path).split("#")[0].split("?")[0].trim();
    if (!value) {
      return "index";
    }

    if (/^[a-z]+:\/\//i.test(value)) {
      try {
        value = new URL(value).pathname || "/";
      } catch (e) {
        return "index";
      }
    }

    value = value.replace(/\\/g, "/");
    if (value === "/") {
      return "index";
    }

    var parts = value.split("/");
    var last = "";
    for (var i = parts.length - 1; i >= 0; i--) {
      if (parts[i]) {
        last = parts[i];
        break;
      }
    }

    if (!last) {
      return "index";
    }

    // Strip .html extension so clean URLs and .html URLs both match
    if (last.length > 5 && last.slice(-5).toLowerCase() === ".html") {
      last = last.slice(0, -5);
    }

    return last.toLowerCase() || "index";
  }

  function normalizeHref(href) {
    if (!href) {
      return "";
    }
    var value = String(href).trim();
    if (!value || value.charAt(0) === "#" || /^(https?:|mailto:|tel:|javascript:|sms:)/i.test(value)) {
      return "";
    }
    return normalizePath(value);
  }

  function inferMenuPage(currentPage) {
    for (var i = 0; i < MENU_GROUPS.length; i++) {
      if (currentPage.indexOf(MENU_GROUPS[i].prefix) === 0) {
        return MENU_GROUPS[i].page;
      }
    }
    return currentPage;
  }

  function clearMenuState() {
    var selectors = [
      ".current-menu-item",
      ".current_page_item",
      ".current-menu-ancestor",
      ".current_page_ancestor"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var items = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < items.length; j++) {
        items[j].classList.remove(
          "current-menu-item",
          "current_page_item",
          "current-menu-ancestor",
          "current_page_ancestor"
        );
      }
    }

    var currentLinks = document.querySelectorAll('.awb-menu a[aria-current="page"]');
    for (var k = 0; k < currentLinks.length; k++) {
      currentLinks[k].removeAttribute("aria-current");
    }
  }

  function markMenuState() {
    clearMenuState();

    var currentPage = inferMenuPage(normalizePath(window.location.pathname));
    var links = document.querySelectorAll(".awb-menu a[href]");

    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (normalizeHref(link.getAttribute("href")) !== currentPage) {
        continue;
      }

      link.setAttribute("aria-current", "page");

      var item = link.closest(".menu-item");
      if (item) {
        item.classList.add("current-menu-item", "current_page_item");
        var parentList = item.parentElement;
        while (parentList) {
          var parentItem = parentList.closest(".menu-item");
          if (!parentItem) {
            break;
          }
          parentItem.classList.add("current-menu-ancestor", "current_page_ancestor");
          parentList = parentItem.parentElement;
        }
      }
    }
  }

  function fetchFragment(path) {
    return fetch(path, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load " + path);
      }
      return response.text();
    });
  }

  function replaceBlockHost(host, fragmentPath) {
    if (!host) {
      return Promise.resolve(false);
    }
    return fetchFragment(fragmentPath).then(function (html) {
      if (!html || !html.trim()) {
        return false;
      }
      host.outerHTML = html;
      return true;
    });
  }

  function replaceBlock(selector, placeholderId, fragmentPath) {
    var host = document.querySelector(selector);
    var placeholder = document.getElementById(placeholderId);

    if (!host && !placeholder) {
      return Promise.resolve(false);
    }

    return replaceBlockHost(host || placeholder, fragmentPath).catch(function () {
      return false;
    });
  }

  function refreshAvadaMenu() {
    if (typeof window.fusionNavRunAll === "function") {
      window.fusionNavRunAll();
    }
    if (typeof window.fusionRunNavIsCollapsed === "function") {
      window.fusionRunNavIsCollapsed();
    }
    if (typeof window.dispatchEvent === "function" && typeof window.Event === "function") {
      window.dispatchEvent(new Event("fusion-resize-horizontal"));
    }
  }

  function bindOrderFormOffCanvas() {
    var orderButton = document.getElementById("prism-order-form");
    if (!orderButton) {
      return;
    }

    if (orderButton.getAttribute("data-off-canvas-bound") === "true") {
      return;
    }

    var offCanvasId = null;
    if (window.off_canvas_11014 && window.off_canvas_11014.on_click === "yes") {
      offCanvasId = "11014";
    } else {
      for (var key in window) {
        if (!Object.prototype.hasOwnProperty.call(window, key)) {
          continue;
        }
        if (key.indexOf("off_canvas_") !== 0) {
          continue;
        }
        var config = window[key];
        if (config && config.on_click === "yes" && config.on_click_element === "#prism-order-form") {
          offCanvasId = key.substring("off_canvas_".length);
          break;
        }
      }
    }

    if (!offCanvasId) {
      return;
    }

    orderButton.setAttribute("data-off-canvas", "#prism-order-form");
    orderButton.setAttribute("data-off-canvas-bound", "true");
    orderButton.addEventListener("click", function (event) {
      event.preventDefault();
      if (window.awbOffCanvas && typeof window.awbOffCanvas.open_off_canvas === "function") {
        window.awbOffCanvas.open_off_canvas(offCanvasId, false);
      }
    });
  }

  function insertScript(src, options) {
    var script = document.createElement("script");
    script.src = src;
    if (options) {
      if (options.async) {
        script.async = true;
      }
      if (options.defer) {
        script.defer = true;
      }
      if (options.type) {
        script.type = options.type;
      }
      if (options.crossOrigin !== undefined) {
        script.crossOrigin = options.crossOrigin;
      }
    }
    (document.head || document.body || document.documentElement).appendChild(script);
    return script;
  }

  function ensureConsentScripts() {
    if (!window.PrivacyManagerAPI && !window.__trustarcLoading) {
      window.__trustarcLoading = true;
      var trustArcScript = insertScript(TRUSTARC_SRC, {
        async: true,
        type: "text/javascript",
        crossOrigin: "anonymous"
      });
      trustArcScript.onload = trustArcScript.onerror = function () {
        window.__trustarcLoading = false;
      };
    }
  }

  function ensureMedchatScript() {
    if (!document || !document.body) {
      return;
    }

    // Always register the hook so cm-consent-guard.js can call this function
    // at any point — including after a revoke + re-accept cycle where the
    // hook would otherwise be undefined.
    window.__cmLoadMedchat = ensureMedchatScript;

    // Only load Medchat if the user has accepted non-required cookies.
    // cm-consent-guard.js sets window.__cmConsentAccepted = true on acceptance.
    if (!window.__cmConsentAccepted) {
      return;
    }

    var desiredSrc = document.body.classList.contains("home")
      ? MEDCHAT_HOME_SRC
      : MEDCHAT_DEFAULT_SRC;
    var existing = document.querySelector('script[data-medchat-widget="true"]');
    if (existing) {
      if (existing.getAttribute("src") === desiredSrc) {
        return;
      }
      if (existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    if (window.__medchatWidgetLoading) {
      return;
    }

    // Add a cache-bust timestamp when Medchat globals were cleared (revoke cycle),
    // so the browser re-fetches and fully re-executes the script instead of
    // serving a cached copy that may skip widget initialization.
    var src = desiredSrc;
    if (typeof window.MedChat === "undefined" && typeof window.MedChatApp === "undefined") {
      src += (src.indexOf("?") === -1 ? "?" : "&") + "_t=" + Date.now();
    }
    window.__medchatWidgetLoading = true;
    var medchatScript = insertScript(src, { async: true });
    medchatScript.setAttribute("data-medchat-widget", "true");
    medchatScript.onload = medchatScript.onerror = function () {
      window.__medchatWidgetLoading = false;
    };
  }

  function shouldApplyCommonLayout() {
    if (!document.body) {
      return false;
    }
    if (!document.querySelector(".fusion-tb-header") && !document.getElementById(HEADER_PLACEHOLDER_ID)) {
      return false;
    }
    if (!document.querySelector(".fusion-tb-footer.fusion-footer") && !document.getElementById(FOOTER_PLACEHOLDER_ID)) {
      return false;
    }
    return true;
  }

  function applyCommonLayout() {
    if (!shouldApplyCommonLayout()) {
      ensureConsentScripts();
      ensureMedchatScript();
      bindOrderFormOffCanvas();
      return;
    }

    var footerFragment = document.body.classList.contains("home")
      ? "/layouts/home-footer.html"
      : "/layouts/footer.html";

    Promise.all([
      replaceBlock(".fusion-tb-header", HEADER_PLACEHOLDER_ID, "/layouts/header.html"),
      replaceBlock(".fusion-tb-footer.fusion-footer", FOOTER_PLACEHOLDER_ID, footerFragment)
    ]).then(function () {
      markMenuState();
      refreshAvadaMenu();
      bindOrderFormOffCanvas();
      ensureConsentScripts();
      ensureMedchatScript();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyCommonLayout);
  } else {
    applyCommonLayout();
  }

  if (document.readyState === "complete") {
    handlePreloader();
  } else {
    window.addEventListener("load", handlePreloader);
  }
})();
