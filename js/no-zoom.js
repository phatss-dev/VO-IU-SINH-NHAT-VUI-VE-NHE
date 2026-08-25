/**
 * Chặn zoom trang (pinch / Ctrl+cuộn / Ctrl±) trên mọi màn.
 * Màn lucky-rain giữ nguyên hiệu ứng zoom riêng (pointer pinch + wheel trong fly-effects).
 */
(function () {
  "use strict";

  function isLuckyRainActive() {
    const el = document.getElementById("lucky-rain");
    return Boolean(el && el.classList.contains("is-active"));
  }

  function isEventInLuckyRain(target) {
    return Boolean(target && target.closest && target.closest("#lucky-rain"));
  }

  function allowLuckyRainInteraction(target) {
    return isLuckyRainActive() && isEventInLuckyRain(target);
  }

  // Trackpad pinch / Ctrl+wheel → zoom trình duyệt
  document.addEventListener(
    "wheel",
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      // Luôn chặn zoom trình duyệt; lucky-rain vẫn nhận event để zoom hiệu ứng
      e.preventDefault();
    },
    { passive: false, capture: true }
  );

  // Ctrl / Cmd + (+|-|0)
  document.addEventListener(
    "keydown",
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key;
      if (
        key === "+" ||
        key === "-" ||
        key === "=" ||
        key === "_" ||
        key === "0" ||
        e.code === "NumpadAdd" ||
        e.code === "NumpadSubtract" ||
        e.code === "Numpad0"
      ) {
        e.preventDefault();
      }
    },
    { capture: true }
  );

  // Safari / iOS gesture zoom
  ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    document.addEventListener(
      type,
      (e) => {
        e.preventDefault();
      },
      { passive: false, capture: true }
    );
  });

  // Pinch bằng nhiều ngón — bỏ qua khi đang ở lucky-rain (cần cho hiệu ứng)
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length < 2) return;
      if (allowLuckyRainInteraction(e.target)) return;
      e.preventDefault();
    },
    { passive: false, capture: true }
  );

  // Một số trình duyệt Android vẫn cho phép zoom dù đã set viewport
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      if (allowLuckyRainInteraction(e.target)) return;
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false, capture: true }
  );
})();
