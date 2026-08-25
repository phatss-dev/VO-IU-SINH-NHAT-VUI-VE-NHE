/**
 * Nhạc nền birthday — URL có thể từ preview, API server, hoặc fallback local.
 * Phát trên gesture người dùng (click nút intro) để vượt autoplay policy.
 */
(function () {
  "use strict";

  const DEFAULT_TRACK_FILE = "BIRTHDAY XINH IU.mp3";

  function assetUrl(fileName) {
    return `assets/audios/${encodeURIComponent(fileName).replace(/%2F/g, "/")}`;
  }

  const DEFAULT_MUSIC_URL = assetUrl(DEFAULT_TRACK_FILE);

  let audio = null;
  let currentUrl = "";
  let started = false;
  /** Số lần tạm giữ (vd: đang phát video) — >0 thì không resume */
  let holdDepth = 0;

  /**
   * Ưu tiên: preview → musicUrl → music.url → fallback local.
   * @param {{ musicUrl?: string, music?: { url?: string } } | null} config
   * @param {{ intro?: { music?: { url?: string } } } | null} preview
   */
  function resolveUrl(config, preview) {
    return (
      preview?.intro?.music?.url ||
      preview?.intro?.music?.path ||
      config?.musicUrl ||
      config?.music?.url ||
      config?.music?.path ||
      DEFAULT_MUSIC_URL
    );
  }

  function prepare(url) {
    const next = url || DEFAULT_MUSIC_URL;
    if (audio && currentUrl === next) return audio;

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    audio = new Audio(next);
    audio.loop = true;
    audio.preload = "auto";
    currentUrl = next;
    started = false;
    holdDepth = 0;
    window.__birthdayMusic = audio;
    return audio;
  }

  function play(url) {
    const track = prepare(url || currentUrl || DEFAULT_MUSIC_URL);
    if (!track || started) return Promise.resolve();

    started = true;

    if (holdDepth > 0) return Promise.resolve();

    return track.play().catch(() => {
      started = false;
    });
  }

  function pause() {
    if (!audio) return;
    audio.pause();
  }

  /** Tạm dừng nhạc nền (khi video đang phát) */
  function hold() {
    holdDepth += 1;
    if (audio && !audio.paused) {
      audio.pause();
    }
  }

  /** Tiếp tục nhạc nền sau khi video pause / rời trang */
  function release() {
    if (holdDepth > 0) holdDepth -= 1;
    if (holdDepth > 0 || !audio || !started || !audio.paused) {
      return Promise.resolve();
    }

    return audio.play().catch(() => {});
  }

  window.BirthdayMusic = {
    DEFAULT_MUSIC_URL,
    resolveUrl,
    prepare,
    play,
    pause,
    hold,
    release,
    get audio() {
      return audio;
    },
    get isHeld() {
      return holdDepth > 0;
    },
  };
})();
