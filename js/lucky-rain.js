(function () {
  const MAX_MESSAGE_LENGTH = 28;
  const DEFAULT_MESSAGES = [
    "Chúc em mãi hạnh phúc 💖",
    "Sinh nhật vui nhé em 🎂",
    "Yêu em đến mãi sau 💞",
    "Em là điều tuyệt nhất 💕",
    "Tuổi mới đầy yêu thương 💓",
  ];
  const DEFAULT_IMAGES = [
    "assets/images/gai_1.jpg",
    "assets/images/gai_2.jpg",
    "assets/images/gai_3.jpg",
    "assets/images/gai4.jpg",
    "assets/images/gai5.jpg",
  ];
  const TABLET_MIN_WIDTH = 768;
  const TABLET_MIN_HEIGHT = 600;
  const DESKTOP_MIN_WIDTH = 1024;

  const PINK_TONES = [
    "text-pink-300",
    "text-pink-400",
    "text-rose-300",
    "text-rose-400",
    "text-fuchsia-300",
    "text-fuchsia-400",
  ];
  const FALLBACK_MESSAGES = ["Chúc may mắn! 🍀"];

  const screenEl = document.getElementById("lucky-rain");
  const container = document.getElementById("falling-container");
  let messages = [...DEFAULT_MESSAGES];
  let images = [...DEFAULT_IMAGES];
  let hasServerData = false;
  let hasStarted = false;
  let flyBooted = false;

  function limitMessageLength(text) {
    const chars = [...text];
    if (chars.length <= MAX_MESSAGE_LENGTH) return text;
    return chars.slice(0, MAX_MESSAGE_LENGTH).join("");
  }

  function normalizeMessage(item) {
    let text = "";
    if (typeof item === "string") {
      text = item.trim();
    } else if (item && typeof item === "object") {
      text = String(item.text ?? item.message ?? "").trim();
    }
    if (!text) return null;
    return limitMessageLength(text);
  }

  function normalizeImage(item) {
    if (typeof item === "string") {
      const url = item.trim();
      return url || null;
    }
    if (!item || typeof item !== "object") return null;
    const url = String(item.url ?? item.image ?? item.imageUrl ?? item.src ?? "").trim();
    return url || null;
  }

  function applyRainPayload(data) {
    hasServerData = true;
    const msgList = data?.messages ?? [];
    const imgList = data?.images ?? [];

    const normalizedMessages = msgList.map(normalizeMessage).filter(Boolean);
    const normalizedImages = imgList.map(normalizeImage).filter(Boolean);

    messages = normalizedMessages.length > 0 ? normalizedMessages : [...DEFAULT_MESSAGES];
    images = normalizedImages.length > 0 ? normalizedImages : [...DEFAULT_IMAGES];
    if (hasStarted) resetFallingSystem();
  }

  function pickRandomItem(display) {
    const hasMessages = messages.length > 0;
    const hasImages = images.length > 0;

    if (!hasMessages && !hasImages) {
      return { kind: "text", text: FALLBACK_MESSAGES[0] };
    }
    if (!hasImages) {
      return { kind: "text", text: messages[Math.floor(Math.random() * messages.length)] };
    }
    if (!hasMessages) {
      return { kind: "image", url: images[Math.floor(Math.random() * images.length)] };
    }

    if (Math.random() < display.imageChance) {
      return { kind: "image", url: images[Math.floor(Math.random() * images.length)] };
    }
    return { kind: "text", text: messages[Math.floor(Math.random() * messages.length)] };
  }

  function getViewportTier() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w >= DESKTOP_MIN_WIDTH) return "desktop";
    if (w >= TABLET_MIN_WIDTH && h >= TABLET_MIN_HEIGHT) return "tablet";
    return "mobile";
  }

  function getDisplaySettings() {
    const presets = {
      mobile: {
        maxObjects: 75,
        totalColumns: 22,
        fontSize: 14,
        imageBaseSize: 100,
        imageChance: 0.06,
      },
      tablet: {
        maxObjects: 95,
        totalColumns: 28,
        fontSize: 18,
        imageBaseSize: 118,
        imageChance: 0.16,
      },
      desktop: {
        maxObjects: 115,
        totalColumns: 32,
        fontSize: 20,
        imageBaseSize: 132,
        imageChance: 0.16,
      },
    };
    return presets[getViewportTier()];
  }

  class FallingElement {
    constructor(columnIndex, totalColumns, display, isInitial = false) {
      this.el = document.createElement("div");
      this.display = display;
      this.item = pickRandomItem(display);
      this.assignDepth();
      this.render();
      this.initPosition(columnIndex, totalColumns, isInitial);
    }

    assignDepth() {
      const depthRoll = Math.random();
      if (depthRoll < 0.4) {
        this.scale = 0.4 + Math.random() * 0.25;
        this.speed = 0.5 + Math.random() * 0.5;
        this.opacity = 0.5 + Math.random() * 0.2;
        this.zIndex = 1;
      } else if (depthRoll < 0.85) {
        this.scale = 0.7 + Math.random() * 0.25;
        this.speed = 1.0 + Math.random() * 0.75;
        this.opacity = 0.72 + Math.random() * 0.2;
        this.zIndex = 2;
      } else {
        this.scale = 0.95 + Math.random() * 0.3;
        this.speed = 1.7 + Math.random() * 1.1;
        this.opacity = 0.94 + Math.random() * 0.06;
        this.zIndex = 3;
      }
    }

    render() {
      this.el.className = "falling-item absolute select-none";
      this.el.replaceChildren();

      this.inner = document.createElement("div");
      this.inner.className = "wish-inner";
      this.el.appendChild(this.inner);

      if (this.item.kind === "image") {
        this.renderImage(this.item.url);
      } else {
        this.renderText(this.item.text);
      }

      this.el.style.opacity = this.opacity;
      this.el.style.zIndex = this.zIndex;
    }

    renderText(text) {
      const color = PINK_TONES[Math.floor(Math.random() * PINK_TONES.length)];
      const baseSize = this.display.fontSize * this.scale;

      const textEl = document.createElement("span");
      textEl.className = `wish-text blessing-text ${color} whitespace-nowrap`;
      textEl.style.fontSize = `${baseSize}px`;
      textEl.style.textShadow = `0 1px 2px rgba(0,0,0,.6), 0 0 ${6 * this.scale}px rgba(244,114,182,.42)`;
      textEl.textContent = text;
      this.inner.appendChild(textEl);
    }

    renderImage(url) {
      const maxEdge = Math.floor(this.display.imageBaseSize * this.scale);
      const frame = document.createElement("div");
      frame.className = "photo-frame";

      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.className = "wish-image";
      img.draggable = false;

      const fitImageSize = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return;
        const ratio = Math.min(maxEdge / w, maxEdge / h);
        const width = Math.round(w * ratio);
        const height = Math.round(h * ratio);
        img.style.width = `${width}px`;
        img.style.height = `${height}px`;
        frame.style.width = `${width}px`;
        frame.style.height = `${height}px`;
      };

      img.onload = fitImageSize;
      img.onerror = () => {
        this.item = { kind: "text", text: "💖" };
        this.render();
      };

      frame.appendChild(img);
      this.inner.appendChild(frame);
      if (img.complete && img.naturalWidth > 0) fitImageSize();
    }

    refresh() {
      this.item = pickRandomItem(this.display);
      this.render();
    }

    initPosition(columnIndex, totalColumns, isInitial = false) {
      const colWidth = window.innerWidth / totalColumns;
      const minX = columnIndex === 0 ? 35 : 5;
      const maxX = columnIndex === totalColumns - 1 ? colWidth - 35 : colWidth - 5;
      this.x = columnIndex * colWidth + minX + Math.random() * (maxX - minX);

      if (isInitial) {
        this.y = Math.random() * (window.innerHeight + 180) - 100;
      } else {
        this.y = -130 - Math.random() * 250;
      }

      this.colIndex = columnIndex;
      this.totCols = totalColumns;
      this.updateStyle();
    }

    update() {
      this.y += this.speed;
      this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})`;

      if (this.y > window.innerHeight + 120) {
        this.refresh();
        this.initPosition(this.colIndex, this.totCols, false);
      }
    }

    updateStyle() {
      this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})`;
    }

    destroy() {
      this.el.remove();
    }
  }

  const fallingObjects = [];
  let currentViewportTier = null;
  let animationRunning = true;

  function resetFallingSystem() {
    if (!container) return;
    fallingObjects.forEach((obj) => obj.destroy());
    fallingObjects.length = 0;
    container.innerHTML = "";
    initFallingSystem();
  }

  function initFallingSystem() {
    if (!container) return;

    if (messages.length === 0 && images.length === 0) {
      if (hasServerData) {
        messages = [...FALLBACK_MESSAGES];
        images = [...DEFAULT_IMAGES];
      } else {
        messages = [...DEFAULT_MESSAGES];
        images = [...DEFAULT_IMAGES];
      }
    }

    const display = getDisplaySettings();
    const columns = Math.min(display.maxObjects, display.totalColumns);

    for (let i = 0; i < display.maxObjects; i++) {
      const obj = new FallingElement(i % columns, columns, display, true);
      container.appendChild(obj.el);
      fallingObjects.push(obj);
    }
  }

  function animationLoop() {
    if (!animationRunning || !hasStarted) return;
    for (let i = 0, len = fallingObjects.length; i < len; i++) {
      fallingObjects[i].update();
    }
    requestAnimationFrame(animationLoop);
  }

  document.addEventListener("visibilitychange", () => {
    if (!hasStarted) return;
    animationRunning = !document.hidden;
    if (animationRunning) requestAnimationFrame(animationLoop);
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    if (!hasStarted) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const tier = getViewportTier();
      if (tier !== currentViewportTier) {
        currentViewportTier = tier;
        resetFallingSystem();
        return;
      }
      const { totalColumns } = getDisplaySettings();
      const columns = Math.min(fallingObjects.length, totalColumns);
      fallingObjects.forEach((obj, idx) => obj.initPosition(idx % columns, columns, true));
    }, 150);
  });

  function startLuckyRain() {
    if (!container) return;

    currentViewportTier = getViewportTier();
    initFallingSystem();
    animationRunning = true;
    animationLoop();

    if (!flyBooted && typeof window.bootImageTextFly === "function") {
      flyBooted = true;
      window.bootImageTextFly();
    }
  }

  function showLuckyRain() {
    if (!screenEl) return;

    const applyPreviewRain = async () => {
      const preview =
        (window.__birthdayPreviewReady && (await window.__birthdayPreviewReady)) ||
        window.__BIRTHDAY_PREVIEW__;
      if (!preview?.wishRain?.enabled) return;
      applyRainPayload({
        messages: preview.wishRain.messages,
        images: preview.wishRain.images,
      });
    };

    void applyPreviewRain();

    screenEl.classList.add("is-active");
    screenEl.setAttribute("aria-hidden", "false");
    window.Starfield?.start?.();

    if (hasStarted) return;

    hasStarted = true;
    startLuckyRain();
  }

  window.LuckyRain = {
    startLuckyRain,
    applyRainPayload,
    resetFallingSystem,
  };

  window.showLuckyRain = showLuckyRain;
})();
