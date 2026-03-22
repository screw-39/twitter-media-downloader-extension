const DEFAULT_SETTINGS = {
  downloadSubfolder: "{author}",
  fileNamePattern: "{author}_{tweetId}_{index}",
  askWhereToSave: false
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...current });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "DOWNLOAD_MEDIA") {
    handleDownload(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_SETTINGS") {
    chrome.storage.sync
      .get(DEFAULT_SETTINGS)
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function handleDownload(payload) {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const resolvedMediaItems = await resolveMediaItems(payload);

  if (!resolvedMediaItems.length) {
    throw new Error("No downloadable media found in this post.");
  }

  const results = [];
  for (let index = 0; index < resolvedMediaItems.length; index += 1) {
    const item = resolvedMediaItems[index];
    const filename = buildFilename(item, payload, settings, index);

    const downloadId = await chrome.downloads.download({
      url: item.downloadUrl,
      filename,
      saveAs: settings.askWhereToSave
    });

    results.push({
      downloadId,
      filename,
      type: item.type
    });
  }

  return results;
}

async function resolveMediaItems(payload) {
  const mediaItems = Array.isArray(payload?.mediaItems) ? payload.mediaItems : [];
  const needsResolution = mediaItems.some((item) => {
    const url = item?.downloadUrl || "";
    return item?.type === "video" || item?.type === "gif" || url.startsWith("blob:");
  });

  if (!payload?.tweetId || !needsResolution) {
    return mediaItems.filter((item) => item?.downloadUrl && !item.downloadUrl.startsWith("blob:"));
  }

  const remoteMediaItems = await fetchMediaFromTweetMetadata(payload.tweetId);
  if (!remoteMediaItems.length) {
    return mediaItems.filter((item) => item?.downloadUrl && !item.downloadUrl.startsWith("blob:"));
  }

  return remoteMediaItems;
}

async function fetchMediaFromTweetMetadata(tweetId) {
  const url = new URL("https://cdn.syndication.twimg.com/tweet-result");
  url.searchParams.set("id", tweetId);
  url.searchParams.set("token", String(Date.now()));

  const response = await fetch(url.toString(), {
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve tweet media metadata (${response.status}).`);
  }

  const data = await response.json();
  const mediaDetails = Array.isArray(data?.mediaDetails) ? data.mediaDetails : [];

  return mediaDetails
    .map((item) => normalizeResolvedMediaItem(item))
    .filter(Boolean);
}

function normalizeResolvedMediaItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  if (item.type === "photo" && item.media_url_https) {
    return {
      type: "image",
      sourceUrl: item.media_url_https,
      downloadUrl: normalizeImageUrl(item.media_url_https)
    };
  }

  if (item.type === "animated_gif") {
    const variant = pickBestVideoVariant(item.video_info?.variants);
    if (!variant) {
      return null;
    }

    return {
      type: "gif",
      sourceUrl: variant.url,
      downloadUrl: stripVideoQuery(variant.url)
    };
  }

  if (item.type === "video") {
    const variant = pickBestVideoVariant(item.video_info?.variants);
    if (!variant) {
      return null;
    }

    return {
      type: "video",
      sourceUrl: variant.url,
      downloadUrl: stripVideoQuery(variant.url)
    };
  }

  return null;
}

function pickBestVideoVariant(variants) {
  if (!Array.isArray(variants)) {
    return null;
  }

  return variants
    .filter((variant) => variant?.url && variant.content_type === "video/mp4")
    .sort((left, right) => (right.bitrate || 0) - (left.bitrate || 0))[0] || null;
}

function stripVideoQuery(url) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildFilename(item, payload, settings, index) {
  const tokens = {
    author: sanitizePathSegment(payload.authorHandle || "unknown"),
    tweetId: sanitizePathSegment(payload.tweetId || Date.now().toString()),
    index: String(index + 1).padStart(2, "0"),
    type: sanitizePathSegment(item.type || "media")
  };

  const rawName = applyTemplate(settings.fileNamePattern || DEFAULT_SETTINGS.fileNamePattern, tokens);
  const rawFolder = applyTemplate(settings.downloadSubfolder || DEFAULT_SETTINGS.downloadSubfolder, tokens);
  const extension = inferExtension(item);
  const baseName = sanitizePathSegment(rawName || `${tokens.author}_${tokens.tweetId}_${tokens.index}`);
  const folder = sanitizeFolder(rawFolder || DEFAULT_SETTINGS.downloadSubfolder);

  return `${folder}/${baseName}.${extension}`;
}

function applyTemplate(template, tokens) {
  return String(template)
    .replaceAll("{author}", tokens.author)
    .replaceAll("{tweetId}", tokens.tweetId)
    .replaceAll("{index}", tokens.index)
    .replaceAll("{type}", tokens.type);
}

function inferExtension(item) {
  if (item?.type === "image") {
    const url = item.downloadUrl || "";
    if (url.includes("format=jpg")) return "jpg";
    if (url.includes("format=png")) return "png";
    if (url.includes("format=webp")) return "webp";
    return "jpg";
  }

  if (item?.type === "video") {
    return "mp4";
  }

  if (item?.type === "gif") {
    return "mp4";
  }

  if (item?.type === "audio") {
    return "mp3";
  }

  return "bin";
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

function sanitizeFolder(value) {
  return String(value)
    .split(/[\\/]+/)
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean)
    .join("/");
}

function sanitizePathSegment(value) {
  return String(value)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120) || "item";
}
