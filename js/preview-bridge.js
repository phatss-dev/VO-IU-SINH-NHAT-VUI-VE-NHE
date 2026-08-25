/**
 * Bridge trên index.html:
 * - ?preview=1 → IndexedDB (xem trước từ create)
 * - ?id=<configId> → GET /api/happy-birthday-vip2s/:id (xem quà đã tạo)
 * - ?demo=1 → dữ liệu mặc định của từng màn (Xem mẫu đầy đủ)
 */
(function () {
  const store = window.BirthdayPreviewStore;

  function apiBase() {
    return String(window.APP_CONFIG?.apiBase || "https://hearlyserver.onrender.com").replace(
      /\/$/,
      "",
    );
  }

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch {
      return null;
    }
  }

  function getGiftIdFromUrl() {
    const id = getQueryParam("id");
    return id != null ? String(id).trim() : "";
  }

  function isPreviewMode() {
    return Boolean(store?.isPreviewMode?.());
  }

  function isDemoMode() {
    return getQueryParam("demo") === "1";
  }

  function resolveMusicUrl(music) {
    if (!music || typeof music !== "object") return null;
    const cdn = music.url != null ? String(music.url).trim() : "";
    if (cdn) return cdn;
    const path = music.path != null ? String(music.path).trim() : "";
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    // sample path dạng assets/audios/...
    return path.replace(/^\//, "");
  }

  function buildGalleryItems(preview) {
    const items = [];

    for (const item of preview?.images?.polaroid || []) {
      if (item?.url) {
        items.push({
          type: "polaroid",
          src: item.url,
          caption: item.caption ?? "",
          allowEmptyCaption: true,
        });
      }
    }

    for (const strip of preview?.images?.photobooth || []) {
      const images = (strip.urls || []).filter(Boolean);
      if (images.length) {
        items.push({ type: "photobooth", images });
      }
    }

    return items;
  }

  /**
   * Map bản ghi BE (docs/HB_VIP2_RECORD_FE.md) → shape viewer/preview.
   */
  function mapServerRecordToPreview(data) {
    if (!data || typeof data !== "object") return null;

    const polaroid = Array.isArray(data.images?.polaroid)
      ? data.images.polaroid
          .map((p) => ({
            url: p?.url != null ? String(p.url).trim() : "",
            caption: String(p?.caption || "").trim(),
          }))
          .filter((p) => p.url)
      : [];

    const photobooth = Array.isArray(data.images?.photobooth)
      ? data.images.photobooth.map((frame) => ({
          urls: Array.isArray(frame?.urls)
            ? frame.urls.map((u) => (u != null ? String(u).trim() : "")).filter(Boolean)
            : [],
        }))
      : [];

    const albumUrls = [
      ...polaroid.map((p) => p.url),
      ...photobooth.flatMap((s) => s.urls || []),
    ];

    const wishEnabled = Boolean(data.wishRain?.enabled);
    const wishImages = Array.isArray(data.wishRain?.images)
      ? data.wishRain.images.map((u) => String(u || "").trim()).filter(Boolean)
      : albumUrls;

    const musicUrl = resolveMusicUrl(data.music);
    const videoUrl =
      data.video?.enabled && data.video?.url
        ? String(data.video.url).trim()
        : "";

    return {
      id: data.id != null ? String(data.id) : "",
      source: "server",
      intro: {
        age: data.intro?.age ?? "",
        recipientName: String(data.intro?.recipientName || "").trim(),
        photoUrl: data.intro?.photoUrl
          ? String(data.intro.photoUrl).trim()
          : "",
        music: musicUrl
          ? {
              type: data.music?.type || "",
              path: data.music?.path || null,
              name: data.music?.name || "",
              url: musicUrl,
            }
          : null,
      },
      letter: {
        title: String(data.letter?.title || "").trim(),
        content: String(data.letter?.content || "").trim(),
        signature: String(data.letter?.signature || "").trim(),
      },
      images: { polaroid, photobooth },
      video: {
        enabled: Boolean(data.video?.enabled && videoUrl),
        url: videoUrl || null,
      },
      wishRain: {
        enabled: wishEnabled,
        messages: Array.isArray(data.wishRain?.messages)
          ? data.wishRain.messages.map((m) => String(m || "").trim()).filter(Boolean)
          : [],
        images: wishImages,
      },
    };
  }

  async function fetchGiftById(id) {
    const res = await fetch(
      `${apiBase()}/api/happy-birthday-vip2s/${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" } },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success || !json.data) {
      const msg =
        json?.message ||
        (res.status === 404
          ? "Không tìm thấy quà với mã này."
          : `Không tải được quà (HTTP ${res.status}).`);
      throw new Error(msg);
    }
    return mapServerRecordToPreview(json.data);
  }

  function showDemoWatermark() {
    const root = document.getElementById("demo-watermark");
    const grid = document.getElementById("demo-watermark-grid");
    if (!root) return;

    if (grid && !grid.childElementCount) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 48; i += 1) {
        const span = document.createElement("span");
        span.textContent = "Xem Demo";
        frag.appendChild(span);
      }
      grid.appendChild(frag);
    }

    root.hidden = false;
    document.body.classList.add("is-preview-mode");
  }

  function finalizePreview(preview, { demo = false } = {}) {
    if (!preview) {
      window.__BIRTHDAY_PREVIEW__ = null;
      return null;
    }
    preview.galleryItems = buildGalleryItems(preview);
    window.__BIRTHDAY_PREVIEW__ = preview;
    if (demo) showDemoWatermark();

    if (preview.wishRain?.enabled && window.LuckyRain?.applyRainPayload) {
      window.LuckyRain.applyRainPayload({
        messages: preview.wishRain.messages,
        images: preview.wishRain.images,
      });
    }
    return preview;
  }

  if (isPreviewMode() || isDemoMode()) {
    showDemoWatermark();
  }

  window.__birthdayPreviewReady = (async () => {
    const giftId = getGiftIdFromUrl();

    // Ưu tiên quà theo id (Xem quà / link chia sẻ)
    if (giftId) {
      try {
        const preview = await fetchGiftById(giftId);
        return finalizePreview(preview, { demo: false });
      } catch (err) {
        console.error("[gift] load by id failed", err);
        window.__BIRTHDAY_PREVIEW__ = null;
        window.__BIRTHDAY_GIFT_ERROR__ =
          err?.message || "Không tải được nội dung quà.";
        return null;
      }
    }

    // Xem mẫu đầy đủ: không gắn preview payload → modules dùng dữ liệu mặc định
    if (isDemoMode()) {
      window.__BIRTHDAY_PREVIEW__ = null;
      showDemoWatermark();
      return null;
    }

    if (!store || !isPreviewMode()) {
      window.__BIRTHDAY_PREVIEW__ = null;
      return null;
    }

    try {
      const preview = await store.loadHydrated();
      if (!preview) {
        window.__BIRTHDAY_PREVIEW__ = null;
        return null;
      }
      return finalizePreview(preview, { demo: true });
    } catch (err) {
      console.error("[preview] load failed", err);
      window.__BIRTHDAY_PREVIEW__ = null;
      return null;
    }
  })();

  /**
   * Luồng sau album tùy video / mưa lời chúc.
   * Có preview/gift server → theo lựa chọn đã lưu; không thì demo đầy đủ.
   */
  window.getBirthdayPreviewFlow = async function getBirthdayPreviewFlow() {
    const preview =
      (window.__birthdayPreviewReady && (await window.__birthdayPreviewReady)) ||
      window.__BIRTHDAY_PREVIEW__;

    if (!preview) {
      return {
        isPreview: false,
        hasVideo: true,
        hasWishRain: true,
        showAlbumNext: true,
      };
    }

    const hasVideo = Boolean(preview.video?.enabled && preview.video?.url);
    const hasWishRain = Boolean(preview.wishRain?.enabled);

    return {
      isPreview: true,
      hasVideo,
      hasWishRain,
      showAlbumNext: hasVideo || hasWishRain,
    };
  };
})();
