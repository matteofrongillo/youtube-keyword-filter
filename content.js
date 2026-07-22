(() => {
  "use strict";

  if (globalThis.__youtubekeywordFilterLoaded) {
    return;
  }
  globalThis.__youtubekeywordFilterLoaded = true;

  let filterRules = [];
  let matchFunctions = [];

  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // YouTube titles can use compatibility Unicode characters such as
  // mathematical script letters (for example, "𝒜𝒞𝑀𝒫"). NFKC maps those
  // characters to their plain-text equivalents before matching.
  const normalizeForMatching = (value) => String(value ?? "").normalize("NFKC");

  function updateFilterRules(rules) {
    filterRules = rules || [];
    matchFunctions = [];

    filterRules.forEach(rule => {
      const word = normalizeForMatching(rule.word);
      if (!word) return;

      try {
        let regex;
        switch (rule.type) {
          case "contains":
            regex = new RegExp(escapeRegExp(word), 'i');
            break;
          case "exact":
            regex = new RegExp('\\b' + escapeRegExp(word) + '\\b', 'i');
            break;
          case "starts":
            regex = new RegExp('^\\s*' + escapeRegExp(word), 'i');
            break;
          case "ends":
            regex = new RegExp(escapeRegExp(word) + '\\s*$', 'i');
            break;
          case "regex":
            regex = new RegExp(word, 'i');
            break;
          default:
            regex = new RegExp(escapeRegExp(word), 'i');
        }
        matchFunctions.push((text) => regex.test(text));
      } catch (e) {
        console.error("Invalid regex in filter rule:", rule, e);
      }
    });
  }

  function matchesAnyRule(text) {
    if (matchFunctions.length === 0) return false;
    const normalizedText = normalizeForMatching(text);
    return matchFunctions.some(fn => fn(normalizedText));
  }
  const switchId = "youtube-keyword-filter-switch";
  const hiddenClass = "youtube-content-filter-hidden";
  const hiddenAttribute = "data-youtube-content-filter-hidden";
  const enabledAttribute = "data-youtube-content-filter-enabled";
  const legacyHiddenClass = "youtube-keyword-filter-hidden";
  const legacyHiddenAttribute = "data-youtube-keyword-filter-hidden";

  const resultSelector = [
    "ytd-compact-video-renderer",
    "ytd-video-renderer",
    "ytd-rich-item-renderer",
    "ytd-grid-video-renderer",
    "ytd-reel-item-renderer",
    "ytd-reel-video-renderer",
    "ytd-rich-grid-media",
    "ytd-rich-grid-slim-media",
    "ytd-playlist-panel-video-renderer",
    "ytd-channel-renderer",
    "yt-lockup-view-model"
  ].join(",");

  const titleSelector = [
    "a[href*='/watch']",
    "a[href*='/shorts/']",
    "a#video-title-link",
    "#video-title",
    "h3 a",
    "yt-formatted-string#video-title"
  ].join(",");

  let enabled = true;
  let scanIntervalId = null;
  let animationFrameId = null;
  let observer = null;

  function getText(element) {
    const labelledText = Array.from(
      element.querySelectorAll("[title], [aria-label]")
    ).map((labelledElement) => {
      return [
        labelledElement.getAttribute("title") || "",
        labelledElement.getAttribute("aria-label") || ""
      ].join(" ");
    });

    return [
      element.innerText || "",
      element.textContent || "",
      ...labelledText
    ].join(" ");
  }

  function getCardTarget(card) {
    return card.closest("ytd-rich-item-renderer, ytd-grid-video-renderer") || card;
  }

  function hideCard(card) {
    const target = getCardTarget(card);
    target.classList.add(hiddenClass);
    target.setAttribute(hiddenAttribute, "");
  }

  function restoreCard(card) {
    const target = getCardTarget(card);
    target.classList.remove(hiddenClass);
    target.classList.remove(legacyHiddenClass);
    target.removeAttribute(hiddenAttribute);
    target.removeAttribute(legacyHiddenAttribute);
  }

  function restoreAllCards() {
    document
      .querySelectorAll(
        [
          `.${hiddenClass}`,
          `[${hiddenAttribute}]`,
          `.${legacyHiddenClass}`,
          `[${legacyHiddenAttribute}]`
        ].join(",")
      )
      .forEach(restoreCard);
  }

  function removeBlockedResults() {
    if (!enabled) {
      return;
    }

    const allTargets = new Set();
    const matchingTargets = new Set();

    document.querySelectorAll(resultSelector).forEach((card) => {
      const target = getCardTarget(card);
      allTargets.add(target);

      if (matchesAnyRule(getText(card))) {
        matchingTargets.add(target);
      }
    });

    if (matchFunctions.length > 0) {
      document
        .querySelectorAll(titleSelector)
        .forEach((element) => {
          if (!matchesAnyRule(getText(element))) {
            return;
          }

          const card = element.closest(resultSelector);
          if (card) {
            const target = getCardTarget(card);
            allTargets.add(target);
            matchingTargets.add(target);
          }
        });
    }

    allTargets.forEach((target) => {
      if (matchingTargets.has(target)) {
        hideCard(target);
      } else if (target.hasAttribute(hiddenAttribute)) {
        // YouTube can reuse a card element for a different video.
        restoreCard(target);
      }
    });
  }

  function updateSwitch(button) {
    button.setAttribute("aria-checked", String(enabled));
    button.classList.toggle("youtube-keyword-filter-switch-on", enabled);

    const state = button.querySelector(".youtube-keyword-filter-state");
    if (state) {
      state.textContent = enabled ? "ON" : "OFF";
    }
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled;

    if (enabled) {
      document.documentElement.setAttribute(enabledAttribute, "");
      removeBlockedResults();
    } else {
      // Removing the root attribute disables the hiding CSS immediately.
      document.documentElement.removeAttribute(enabledAttribute);
      restoreAllCards();
    }

    const button = document.getElementById(switchId);
    if (button) {
      updateSwitch(button);
    }
  }

  function createSwitch() {
    const button = document.createElement("button");
    button.id = switchId;
    button.type = "button";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-label", "Toggle the YouTube content filter");

    const label = document.createElement("span");
    label.className = "youtube-keyword-filter-label";
    label.textContent = "Filter";

    const track = document.createElement("span");
    track.className = "youtube-keyword-filter-track";
    track.setAttribute("aria-hidden", "true");

    const thumb = document.createElement("span");
    thumb.className = "youtube-keyword-filter-thumb";
    track.append(thumb);

    const state = document.createElement("span");
    state.className = "youtube-keyword-filter-state";

    button.append(label, track, state);
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setEnabled(!enabled);
    });
    updateSwitch(button);

    return button;
  }

  function ensureSwitch() {
    if (document.getElementById(switchId)) {
      return;
    }

    const searchArea = document.querySelector("ytd-masthead #center");
    const endArea = document.querySelector("ytd-masthead #end");
    const host = searchArea || endArea;

    if (!host) {
      return;
    }

    const button = createSwitch();
    if (searchArea) {
      searchArea.append(button);
    } else {
      endArea.prepend(button);
    }
  }

  function schedulePageUpdate() {
    if (animationFrameId !== null) {
      return;
    }

    animationFrameId = requestAnimationFrame(() => {
      animationFrameId = null;
      ensureSwitch();
      removeBlockedResults();
    });
  }

  function handleNavigation() {
    schedulePageUpdate();
  }

  function cleanup() {
    document.documentElement.removeAttribute(enabledAttribute);
    restoreAllCards();

    if (scanIntervalId !== null) {
      clearInterval(scanIntervalId);
      scanIntervalId = null;
    }

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    document.removeEventListener("yt-navigate-finish", handleNavigation);
  }

  function start() {
    if (observer) {
      return;
    }

    document.documentElement.toggleAttribute(enabledAttribute, enabled);
    ensureSwitch();
    removeBlockedResults();

    scanIntervalId = window.setInterval(() => {
      ensureSwitch();
      removeBlockedResults();
    }, 500);

    observer = new MutationObserver(schedulePageUpdate);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    document.addEventListener("yt-navigate-finish", handleNavigation);
  }

  function initFilter() {
    chrome.storage.local.get(["filterRules", "blockedWords"], (result) => {
      if (result.filterRules) {
        updateFilterRules(result.filterRules);
      } else if (result.blockedWords) {
        // Migrate old blockedWords
        const words = result.blockedWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
        const migratedRules = words.map((w, i) => ({ id: "migrated_" + i, word: w, type: "exact" }));
        updateFilterRules(migratedRules);
        chrome.storage.local.set({ filterRules: migratedRules, blockedWords: "" });
      }
      start();
    });
  }

  // Listen for changes from the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.filterRules) {
      updateFilterRules(changes.filterRules.newValue);
      restoreAllCards(); 
      removeBlockedResults();
    }
  });

  initFilter();
  window.addEventListener("pagehide", cleanup);
  window.addEventListener("pageshow", initFilter);
})();
