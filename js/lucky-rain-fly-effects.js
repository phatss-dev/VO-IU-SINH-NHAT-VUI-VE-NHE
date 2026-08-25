/**
 * Hiệu ứng 3D tương tác — theo IMAGE_TEXT_FLY_EFFECTS.md
 * (không gồm ribbon trail, idle tilt)
 */
(function () {
  const ROTATE_SENSITIVITY = 0.28;
  const ROTATE_X_LIMIT = 58;
  const ROTATE_Y_CLAMP = 72;
  const DAMPING = 0.86;
  const ZOOM_MIN = 0.72;
  const ZOOM_MAX = 1.45;
  const WHEEL_STEP = 0.052;
  const GLOBAL_SCALE_MIN = 0.88;
  const GLOBAL_SCALE_MAX = 1.12;
  const BREATHE_AMPLITUDE = 0.022;

  const screen = document.getElementById("image-text-fly-screen");
  const wishesLayer = document.getElementById("wishes-layer");
  const wishesLayerSpace = document.querySelector(".wishes-layer-space");
  const fallingContainer = document.getElementById("falling-container");

  if (!screen || !wishesLayer || !wishesLayerSpace || !fallingContainer) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let rotateX = 0;
  let rotateY = 0;
  let globalWishScale = 1;
  let userExtraZoom = 1;
  let velocityX = 0;
  let velocityY = 0;
  let breathePhase = 0;

  let isDragging = false;
  let isPinching = false;
  let isUserZoomed = false;
  let dragPointerId = null;
  let lastDragX = 0;
  let lastDragY = 0;
  let lastDragTime = 0;
  let dampingFrameId = null;

  const pinchPointers = new Map();
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;

  const itemStates = new WeakMap();

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampZoom(z) {
    return clamp(z, ZOOM_MIN, ZOOM_MAX);
  }

  function updateLayerClasses() {
    wishesLayer.classList.toggle("dragging", isDragging);
    wishesLayer.classList.toggle("pinching", isPinching);
    wishesLayerSpace.classList.toggle("dragging", isDragging);
    wishesLayerSpace.classList.toggle("pinching", isPinching);
    wishesLayerSpace.classList.toggle("is-user-zoomed", isUserZoomed);
    wishesLayerSpace.classList.toggle("wishes-space-zoom", !reducedMotion);
  }

  function getCombinedScale() {
    const breathe = !isDragging && !isPinching && !isUserZoomed && !reducedMotion
      ? 1 + BREATHE_AMPLITUDE * Math.sin(breathePhase)
      : 1;
    return globalWishScale * userExtraZoom * breathe;
  }

  function applyLayerTransform() {
    const scale = getCombinedScale();
    wishesLayerSpace.style.transform =
      `perspective(1400px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
  }

  function tickBreathe() {
    if (!isDragging && !isPinching && !isUserZoomed && !reducedMotion) {
      breathePhase += 0.018;
    }
    applyLayerTransform();
    requestAnimationFrame(tickBreathe);
  }

  function stopDamping() {
    if (dampingFrameId !== null) {
      cancelAnimationFrame(dampingFrameId);
      dampingFrameId = null;
    }
  }

  function dampingAnimation() {
    if (Math.abs(velocityX) < 0.05 && Math.abs(velocityY) < 0.05) {
      velocityX = 0;
      velocityY = 0;
      dampingFrameId = null;
      applyLayerTransform();
      return;
    }
    rotateY = clamp(rotateY + velocityX, -ROTATE_Y_CLAMP, ROTATE_Y_CLAMP);
    rotateX = clamp(rotateX + velocityY, -ROTATE_X_LIMIT, ROTATE_X_LIMIT);
    velocityX *= DAMPING;
    velocityY *= DAMPING;
    applyLayerTransform();
    dampingFrameId = requestAnimationFrame(dampingAnimation);
  }

  function startGlobalDrag(e) {
    if (reducedMotion || isPinching) return;
    isDragging = true;
    dragPointerId = e.pointerId;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    lastDragTime = performance.now();
    velocityX = 0;
    velocityY = 0;
    stopDamping();
    updateLayerClasses();
    screen.setPointerCapture(e.pointerId);
  }

  function moveGlobalDrag(e) {
    if (!isDragging || e.pointerId !== dragPointerId) return;
    const now = performance.now();
    const dt = Math.max(now - lastDragTime, 1);
    const dx = e.clientX - lastDragX;
    const dy = e.clientY - lastDragY;

    rotateY += dx * ROTATE_SENSITIVITY;
    rotateX = clamp(rotateX + dy * ROTATE_SENSITIVITY, -ROTATE_X_LIMIT, ROTATE_X_LIMIT);
    globalWishScale = clamp(globalWishScale - dy * 0.0012, GLOBAL_SCALE_MIN, GLOBAL_SCALE_MAX);

    velocityX = (dx * ROTATE_SENSITIVITY) / dt * 16;
    velocityY = (dy * ROTATE_SENSITIVITY) / dt * 16;

    lastDragX = e.clientX;
    lastDragY = e.clientY;
    lastDragTime = now;
    applyLayerTransform();
  }

  function endGlobalDrag(e) {
    if (!isDragging || e.pointerId !== dragPointerId) return;
    isDragging = false;
    dragPointerId = null;
    updateLayerClasses();
    try {
      screen.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* noop */
    }
    dampingAnimation();
  }

  function getItemState(el) {
    if (!itemStates.has(el)) {
      itemStates.set(el, {
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        velocityX: 0,
        velocityY: 0,
        pointerId: null,
        dampingId: null,
      });
    }
    return itemStates.get(el);
  }

  function applyItemTransform(el) {
    const inner = el.querySelector(".wish-inner");
    if (!inner) return;
    const s = getItemState(el);
    inner.style.transform = `rotateX(${s.rotateX}deg) rotateY(${s.rotateY}deg) scale(${s.scale})`;
  }

  function itemDamping(el) {
    const s = getItemState(el);
    if (Math.abs(s.velocityX) < 0.05 && Math.abs(s.velocityY) < 0.05) {
      s.velocityX = 0;
      s.velocityY = 0;
      s.dampingId = null;
      applyItemTransform(el);
      return;
    }
    s.rotateY = clamp(s.rotateY + s.velocityX, -ROTATE_Y_CLAMP, ROTATE_Y_CLAMP);
    s.rotateX = clamp(s.rotateX + s.velocityY, -ROTATE_X_LIMIT, ROTATE_X_LIMIT);
    s.velocityX *= DAMPING;
    s.velocityY *= DAMPING;
    applyItemTransform(el);
    s.dampingId = requestAnimationFrame(() => itemDamping(el));
  }

  function startItemDrag(e, fallingItem) {
    if (reducedMotion || isPinching) return;
    e.stopPropagation();

    const s = getItemState(fallingItem);
    s.pointerId = e.pointerId;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastTime = performance.now();
    s.velocityX = 0;
    s.velocityY = 0;
    if (s.dampingId !== null) {
      cancelAnimationFrame(s.dampingId);
      s.dampingId = null;
    }

    fallingItem.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      if (ev.pointerId !== s.pointerId) return;
      const now = performance.now();
      const dt = Math.max(now - s.lastTime, 1);
      const dx = ev.clientX - s.lastX;
      const dy = ev.clientY - s.lastY;

      s.rotateY += dx * ROTATE_SENSITIVITY;
      s.rotateX = clamp(s.rotateX + dy * ROTATE_SENSITIVITY, -ROTATE_X_LIMIT, ROTATE_X_LIMIT);
      s.scale = clamp(s.scale - dy * 0.0012, GLOBAL_SCALE_MIN, GLOBAL_SCALE_MAX);

      s.velocityX = (dx * ROTATE_SENSITIVITY) / dt * 16;
      s.velocityY = (dy * ROTATE_SENSITIVITY) / dt * 16;

      s.lastX = ev.clientX;
      s.lastY = ev.clientY;
      s.lastTime = now;
      applyItemTransform(fallingItem);
    };

    const onUp = (ev) => {
      if (ev.pointerId !== s.pointerId) return;
      s.pointerId = null;
      try {
        fallingItem.releasePointerCapture(ev.pointerId);
      } catch (_) {
        /* noop */
      }
      fallingItem.removeEventListener("pointermove", onMove);
      fallingItem.removeEventListener("pointerup", onUp);
      fallingItem.removeEventListener("pointercancel", onUp);
      itemDamping(fallingItem);
    };

    fallingItem.addEventListener("pointermove", onMove);
    fallingItem.addEventListener("pointerup", onUp);
    fallingItem.addEventListener("pointercancel", onUp);
  }

  function pinchDistance() {
    const pts = [...pinchPointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return Math.hypot(dx, dy);
  }

  function onPinchPointerDown(e) {
    if (reducedMotion) return;
    pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchPointers.size === 2) {
      isPinching = true;
      isDragging = false;
      dragPointerId = null;
      pinchStartDistance = pinchDistance();
      pinchStartZoom = userExtraZoom;
      stopDamping();
      updateLayerClasses();
    }
  }

  function onPinchPointerMove(e) {
    if (!pinchPointers.has(e.pointerId)) return;
    pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (isPinching && pinchPointers.size >= 2 && pinchStartDistance > 0) {
      const dist = pinchDistance();
      userExtraZoom = clampZoom(pinchStartZoom * (dist / pinchStartDistance));
      isUserZoomed = true;
      applyLayerTransform();
    }
  }

  function onPinchPointerUp(e) {
    pinchPointers.delete(e.pointerId);
    if (pinchPointers.size < 2) {
      isPinching = false;
      updateLayerClasses();
    }
    if (pinchPointers.size === 0) {
      isPinching = false;
      updateLayerClasses();
    }
  }

  function attachGlobalDragEvents() {
    screen.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".wish-text, img.wish-image, .photo-frame")) return;
      startGlobalDrag(e);
    });
    screen.addEventListener("pointermove", moveGlobalDrag);
    screen.addEventListener("pointerup", endGlobalDrag);
    screen.addEventListener("pointercancel", endGlobalDrag);
  }

  function attachItemDragEvents() {
    fallingContainer.addEventListener("pointerdown", (e) => {
      const interactive = e.target.closest(".wish-text, img.wish-image, .photo-frame");
      if (!interactive) return;
      const fallingItem = interactive.closest(".falling-item");
      if (!fallingItem) return;
      startItemDrag(e, fallingItem);
    });
  }

  function attachWheelZoom() {
    screen.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const step = e.ctrlKey ? WHEEL_STEP * 1.35 : WHEEL_STEP;
        const delta = e.deltaY > 0 ? -step : step;
        userExtraZoom = clampZoom(userExtraZoom + delta);
        isUserZoomed = true;
        updateLayerClasses();
        applyLayerTransform();
      },
      { passive: false }
    );
  }

  function attachPinchZoom() {
    screen.addEventListener("pointerdown", onPinchPointerDown);
    screen.addEventListener("pointermove", onPinchPointerMove);
    screen.addEventListener("pointerup", onPinchPointerUp);
    screen.addEventListener("pointercancel", onPinchPointerUp);
  }

  function bootImageTextFly() {
    updateLayerClasses();
    applyLayerTransform();
    requestAnimationFrame(tickBreathe);

    if (reducedMotion) return;

    attachGlobalDragEvents();
    attachItemDragEvents();
    attachWheelZoom();
    attachPinchZoom();
  }

  window.bootImageTextFly = bootImageTextFly;
})();
