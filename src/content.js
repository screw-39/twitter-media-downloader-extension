(function initTwitterMediaDownloader() {
  const BUTTON_CLASS = "tmd-download-button";
  const WRAPPER_CLASS = "tmd-download-wrapper";
  let scanScheduled = false;

  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "poster"]
  });

  scheduleScan();
  window.setInterval(scheduleScan, 1500);

  function scheduleScan() {
    if (scanScheduled) {
      return;
    }

    scanScheduled = true;
    window.requestAnimationFrame(() => {
      scanScheduled = false;
      scanTweets();
    });
  }

  function scanTweets() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    tweets.forEach((tweet) => {
      syncButtonForTweet(tweet);
    });
  }

  function syncButtonForTweet(tweet) {
    const mediaItems = collectMediaFromTweet(tweet);
    const actionBar = findActionBar(tweet);
    const existingWrapper = tweet.querySelector(`.${WRAPPER_CLASS}`);

    if (!mediaItems.length || !actionBar) {
      if (existingWrapper) {
        existingWrapper.remove();
      }
      return;
    }

    if (existingWrapper) {
      if (existingWrapper.parentElement !== actionBar) {
        actionBar.appendChild(existingWrapper);
      }
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "下載媒體";
    button.title = "下載這則貼文中的媒體";

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const latestMediaItems = collectMediaFromTweet(tweet);
      if (!latestMediaItems.length) {
        setButtonState(button, "沒有可下載媒體", true);
        return;
      }

      setButtonState(button, "下載中...", true);
      try {
        const payload = buildDownloadPayload(tweet, latestMediaItems);
        const response = await chrome.runtime.sendMessage({
          type: "DOWNLOAD_MEDIA",
          payload
        });

        if (!response?.ok) {
          throw new Error(response?.error || "Download failed.");
        }

        setButtonState(button, `已加入 ${latestMediaItems.length} 個下載`, true);
      } catch (error) {
        setButtonState(button, "下載失敗", true);
        console.error("[Twitter Media Downloader]", error);
      } finally {
        window.setTimeout(() => {
          setButtonState(button, "下載媒體", false);
        }, 2200);
      }
    });

    const wrapper = document.createElement("div");
    wrapper.className = WRAPPER_CLASS;
    wrapper.appendChild(button);
    actionBar.appendChild(wrapper);
  }

  function findActionBar(tweet) {
    const groups = Array.from(tweet.querySelectorAll('div[role="group"]'));
    return groups.find((group) => group.querySelector('[data-testid="reply"]')) || groups[groups.length - 1] || null;
  }

  function collectMediaFromTweet(tweet) {
    const items = [];
    const seen = new Set();

    const images = tweet.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    images.forEach((img) => {
      const src = img.currentSrc || img.src;
      if (!src) return;
      const normalized = normalizeImageUrl(src);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      items.push({
        type: "image",
        sourceUrl: src,
        downloadUrl: normalized
      });
    });

    const videoElements = tweet.querySelectorAll("video");
    videoElements.forEach((video) => {
      const candidate = video.currentSrc || video.src || video.querySelector("source")?.src;
      if (!candidate) return;
      if (seen.has(candidate)) return;
      seen.add(candidate);
      items.push({
        type: "video",
        sourceUrl: candidate,
        downloadUrl: candidate
      });
    });

    const audioElements = tweet.querySelectorAll("audio");
    audioElements.forEach((audio) => {
      const candidate = audio.currentSrc || audio.src || audio.querySelector("source")?.src;
      if (!candidate) return;
      if (seen.has(candidate)) return;
      seen.add(candidate);
      items.push({
        type: "audio",
        sourceUrl: candidate,
        downloadUrl: candidate
      });
    });

    return items;
  }

  function normalizeImageUrl(url) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("name", "orig");
      if (!parsed.searchParams.has("format")) {
        const extMatch = parsed.pathname.match(/\.([a-zA-Z0-9]+)$/);
        if (extMatch) {
          parsed.searchParams.set("format", extMatch[1]);
        }
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }

  function buildDownloadPayload(tweet, mediaItems) {
    const tweetLink = tweet.querySelector('a[href*="/status/"]');
    const tweetId = tweetLink?.href.match(/status\/(\d+)/)?.[1] || "";
    const authorMatch = tweetLink?.href.match(/(?:x|twitter)\.com\/([^/]+)\/status/);
    const authorHandle = authorMatch?.[1] || extractAuthorFromTweet(tweet);

    return {
      tweetId,
      authorHandle,
      tweetUrl: tweetLink?.href || location.href,
      mediaItems
    };
  }

  function extractAuthorFromTweet(tweet) {
    const handleNode = Array.from(tweet.querySelectorAll("a")).find((anchor) => {
      const text = anchor.textContent?.trim() || "";
      return text.startsWith("@");
    });

    return handleNode?.textContent?.trim().replace(/^@/, "") || "unknown";
  }

  function setButtonState(button, label, disabled) {
    button.textContent = label;
    button.disabled = disabled;
  }
})();
