/**
 * Lưu / đọc payload xem trước (create → index) qua IndexedDB
 * để blob/file vẫn dùng được sau khi chuyển trang.
 */
(function () {
  const DB_NAME = "birthdayPreviewDb";
  const DB_VERSION = 1;
  const STORE = "preview";
  const KEY = "current";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    });
  }

  async function idbSet(value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("IndexedDB write failed"));
      };
    });
  }

  async function idbGet() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error("IndexedDB read failed"));
      };
    });
  }

  async function idbClear() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("IndexedDB clear failed"));
      };
    });
  }

  async function packFile(file) {
    if (!file) return null;
    return {
      kind: "file",
      name: file.name || "file",
      type: file.type || "application/octet-stream",
      buffer: await file.arrayBuffer(),
    };
  }

  async function packUrlOrFile(url, file) {
    if (file) return packFile(file);
    if (!url) return null;
    if (String(url).startsWith("blob:")) {
      const res = await fetch(url);
      const blob = await res.blob();
      return {
        kind: "file",
        name: "blob",
        type: blob.type || "application/octet-stream",
        buffer: await blob.arrayBuffer(),
      };
    }
    return { kind: "path", path: String(url) };
  }

  function unpackToUrl(record) {
    if (!record) return null;
    if (record.kind === "path" && record.path) return record.path;
    if (record.kind === "file" && record.buffer) {
      const blob = new Blob([record.buffer], {
        type: record.type || "application/octet-stream",
      });
      return URL.createObjectURL(blob);
    }
    return null;
  }

  /**
   * @param {object} payload — từ collectPayload() trên create.js
   */
  async function saveFromCreatePayload(payload) {
    const introPhoto = await packUrlOrFile(
      payload?.intro?.photoUrl,
      payload?.intro?.photoFile,
    );

    let music = null;
    if (payload?.intro?.music) {
      const m = payload.intro.music;
      music = {
        source: m.source || "",
        title: m.title || "",
        preset: m.preset || null,
        media: await packUrlOrFile(m.url, m.file),
      };
    }

    const polaroid = [];
    for (const item of payload?.images?.polaroid || []) {
      const media = await packUrlOrFile(item.url, item.file);
      if (!media) continue;
      polaroid.push({
        media,
        caption: String(item.caption || "").trim(),
      });
    }

    const photobooth = [];
    for (const strip of payload?.images?.photobooth || []) {
      const slots = [];
      const urls = strip.urls || [];
      const files = strip.files || [];
      for (let i = 0; i < Math.max(urls.length, files.length, 4); i += 1) {
        slots.push(await packUrlOrFile(urls[i], files[i]));
      }
      photobooth.push(slots);
    }

    let video = { enabled: false, media: null };
    if (payload?.video?.enabled) {
      video = {
        enabled: true,
        media: await packUrlOrFile(payload.video.url, payload.video.file),
      };
    }

    const packed = {
      savedAt: Date.now(),
      intro: {
        age: payload?.intro?.age ?? "",
        recipientName: payload?.intro?.recipientName || "",
        photo: introPhoto,
        music,
      },
      letter: {
        title: payload?.letter?.title || "",
        content: payload?.letter?.content || "",
        signature: payload?.letter?.signature || "",
      },
      images: { polaroid, photobooth },
      video,
      wishRain: {
        enabled: Boolean(payload?.wishRain?.enabled),
        messages: Array.isArray(payload?.wishRain?.messages)
          ? payload.wishRain.messages.slice()
          : [],
      },
    };

    await idbSet(packed);
    return packed;
  }

  function hydratePacked(packed) {
    if (!packed) return null;

    const photoUrl = unpackToUrl(packed.intro?.photo);
    let music = null;
    if (packed.intro?.music) {
      music = {
        source: packed.intro.music.source || "",
        title: packed.intro.music.title || "",
        preset: packed.intro.music.preset || null,
        url: unpackToUrl(packed.intro.music.media),
      };
    }

    const polaroid = (packed.images?.polaroid || [])
      .map((rec) => {
        // Hỗ trợ cả format cũ (record media trực tiếp) và mới ({ media, caption })
        const media = rec?.media || rec;
        const url = unpackToUrl(media);
        if (!url) return null;
        return {
          url,
          caption: String(rec?.caption || "").trim(),
        };
      })
      .filter(Boolean);

    const photobooth = (packed.images?.photobooth || []).map((slots) => ({
      urls: (slots || []).map((rec) => unpackToUrl(rec)),
    }));

    const albumUrls = [
      ...polaroid.map((p) => p.url),
      ...photobooth.flatMap((s) => (s.urls || []).filter(Boolean)),
    ];

    const videoEnabled = Boolean(packed.video?.enabled);
    const videoUrl = videoEnabled ? unpackToUrl(packed.video?.media) : null;

    return {
      intro: {
        age: packed.intro?.age ?? "",
        recipientName: packed.intro?.recipientName || "",
        photoUrl,
        music,
      },
      letter: {
        title: packed.letter?.title || "",
        content: packed.letter?.content || "",
        signature: packed.letter?.signature || "",
      },
      images: { polaroid, photobooth },
      video: {
        enabled: videoEnabled && Boolean(videoUrl),
        url: videoUrl,
      },
      wishRain: {
        enabled: Boolean(packed.wishRain?.enabled),
        messages: packed.wishRain?.messages || [],
        images: albumUrls,
      },
    };
  }

  async function loadHydrated() {
    const packed = await idbGet();
    return hydratePacked(packed);
  }

  function isPreviewMode() {
    try {
      return new URLSearchParams(window.location.search).get("preview") === "1";
    } catch {
      return false;
    }
  }

  window.BirthdayPreviewStore = {
    saveFromCreatePayload,
    loadHydrated,
    clear: idbClear,
    isPreviewMode,
  };
})();
