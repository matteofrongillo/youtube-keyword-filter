(() => {
  "use strict";

  if (globalThis.__youtubeAsmrFilterLoaded) {
    return;
  }
  globalThis.__youtubeAsmrFilterLoaded = true;

  let blockedRegex = null;

  function updateBlockedRegex(wordsString) {
    if (!wordsString || wordsString.trim() === "") {
      blockedRegex = null;
      return;
    }
    // Split by commas, trim whitespace, and filter out empty strings
    const words = wordsString.split(',').map(w => w.trim()).filter(w => w.length > 0);
    if (words.length === 0) {
      blockedRegex = null;
      return;
    }
    // Escape characters that have special meaning in regex
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = words.map(w => '\\b' + escapeRegExp(w) + '\\b').join('|');
    blockedRegex = new RegExp(pattern, 'i');
  }
  const switchId = "youtube-asmr-filter-switch";
  const hiddenClass = "youtube-content-filter-hidden";
  const hiddenAttribute = "data-youtube-content-filter-hidden";
  const enabledAttribute = "data-youtube-content-filter-enabled";
  const legacyHiddenClass = "youtube-asmr-filter-hidden";
  const legacyHiddenAttribute = "data-youtube-asmr-filter-hidden";

  const resultSelector = [
    "ytd-compact-video-renderer",
    "ytd-video-renderer",
    "ytd-rich-item-renderer",
    "ytd-grid-video-renderer",
    "ytd-reel-item-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-channel-renderer",
    "yt-lockup-view-model"
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

  function hideCard(card) {
    card.classList.add(hiddenClass);
    card.setAttribute(hiddenAttribute, "");
  }

  function restoreCard(card) {
    card.classList.remove(hiddenClass);
    card.classList.remove(legacyHiddenClass);
    card.removeAttribute(hiddenAttribute);
    card.removeAttribute(legacyHiddenAttribute);
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

    document.querySelectorAll(resultSelector).forEach((card) => {
      if (blockedRegex && blockedRegex.test(getText(card))) {
        hideCard(card);
      } else if (card.hasAttribute(hiddenAttribute)) {
        // YouTube can reuse a card element for a different video.
        restoreCard(card);
      }
    });

    if (blockedRegex) {
      document
        .querySelectorAll("a[href*='/watch'], h3, #video-title")
        .forEach((element) => {
          if (!blockedRegex.test(getText(element))) {
            return;
          }

          const card = element.closest(resultSelector);
          if (card) {
            hideCard(card);
          }
        });
    }
  }

  function updateSwitch(button) {
    button.setAttribute("aria-checked", String(enabled));
    button.classList.toggle("youtube-asmr-filter-switch-on", enabled);

    const state = button.querySelector(".youtube-asmr-filter-state");
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
    label.className = "youtube-asmr-filter-label";
    label.textContent = "Filter";

    const track = document.createElement("span");
    track.className = "youtube-asmr-filter-track";
    track.setAttribute("aria-hidden", "true");

    const thumb = document.createElement("span");
    thumb.className = "youtube-asmr-filter-thumb";
    track.append(thumb);

    const state = document.createElement("span");
    state.className = "youtube-asmr-filter-state";

    button.append(label, track, state);
    button.addEventListener("click", () => setEnabled(!enabled));
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
    chrome.storage.local.get({ blockedWords: "ASMR" }, (result) => {
      updateBlockedRegex(result.blockedWords);
      start();
    });
  }

  // Listen for changes from the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.blockedWords) {
      updateBlockedRegex(changes.blockedWords.newValue);
      restoreAllCards(); 
      removeBlockedResults();
    }
  });

  initFilter();
  window.addEventListener("pagehide", cleanup);
  window.addEventListener("pageshow", initFilter);
})();
