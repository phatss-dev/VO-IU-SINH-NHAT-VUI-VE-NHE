/**
 * Bầu trời sao hồng — twinkle + sparkle particles
 * Chạy phía sau lớp UI lucky-rain, không chặn pointer.
 */
(function () {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let sparkles = [];
  let nebulae = [];
  let rafId = null;
  let running = false;
  let lastSpawn = 0;

  const PINK = [
    [255, 182, 213],
    [244, 114, 182],
    [251, 207, 232],
    [253, 164, 175],
    [240, 171, 252],
    [255, 228, 240],
  ];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickPink() {
    return PINK[(Math.random() * PINK.length) | 0];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  }

  function starCount() {
    const area = width * height;
    if (area < 500000) return 90;
    if (area < 1200000) return 140;
    return 190;
  }

  function rebuild() {
    const count = starCount();
    stars = [];
    for (let i = 0; i < count; i++) {
      const layer = Math.random();
      const [r, g, b] = pickPink();
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: layer < 0.7 ? rand(0.4, 1.1) : rand(1.1, 2.2),
        baseAlpha: layer < 0.55 ? rand(0.25, 0.5) : rand(0.55, 0.95),
        twinkleSpeed: rand(0.008, 0.035),
        twinklePhase: Math.random() * Math.PI * 2,
        driftX: rand(-0.015, 0.015),
        driftY: rand(0.008, 0.04),
        r,
        g,
        b,
        glow: layer > 0.82,
      });
    }

    nebulae = [
      { x: width * 0.22, y: height * 0.28, radius: Math.min(width, height) * 0.42, a: 0.11 },
      { x: width * 0.78, y: height * 0.62, radius: Math.min(width, height) * 0.38, a: 0.09 },
      { x: width * 0.55, y: height * 0.18, radius: Math.min(width, height) * 0.3, a: 0.07 },
      { x: width * 0.4, y: height * 0.75, radius: Math.min(width, height) * 0.28, a: 0.06 },
    ];

    sparkles = [];
  }

  function spawnSparkle() {
    const [r, g, b] = pickPink();
    sparkles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      life: 0,
      maxLife: rand(28, 70),
      size: rand(1.6, 3.4),
      r,
      g,
      b,
      rays: Math.random() > 0.35,
    });
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "#0a0512");
    g.addColorStop(0.45, "#140818");
    g.addColorStop(0.75, "#1a0a1c");
    g.addColorStop(1, "#120610");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    for (const n of nebulae) {
      const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
      ng.addColorStop(0, `rgba(244, 114, 182, ${n.a})`);
      ng.addColorStop(0.45, `rgba(190, 24, 93, ${n.a * 0.45})`);
      ng.addColorStop(1, "rgba(10, 5, 18, 0)");
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const vg = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      Math.min(width, height) * 0.2,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(5, 2, 10, 0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStar(s, t) {
    const twinkle = 0.55 + 0.45 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
    const alpha = s.baseAlpha * twinkle;

    if (s.glow) {
      const glowR = s.size * 5;
      const gg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
      gg.addColorStop(0, `rgba(${s.r}, ${s.g}, ${s.b}, ${alpha * 0.45})`);
      gg.addColorStop(1, `rgba(${s.r}, ${s.g}, ${s.b}, 0)`);
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${s.r}, ${s.g}, ${s.b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();

    if (s.size > 1.3 && alpha > 0.6) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSparkle(sp) {
    const p = sp.life / sp.maxLife;
    const fade = p < 0.2 ? p / 0.2 : p > 0.65 ? (1 - p) / 0.35 : 1;
    const alpha = Math.max(0, fade);
    const size = sp.size * (0.6 + 0.8 * Math.sin(p * Math.PI));

    if (sp.rays) {
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(p * 0.8);
      ctx.strokeStyle = `rgba(${sp.r}, ${sp.g}, ${sp.b}, ${alpha * 0.85})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-size * 2.8, 0);
      ctx.lineTo(size * 2.8, 0);
      ctx.moveTo(0, -size * 2.8);
      ctx.lineTo(0, size * 2.8);
      ctx.stroke();
      ctx.restore();
    }

    const gg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, size * 3);
    gg.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gg.addColorStop(0.35, `rgba(${sp.r}, ${sp.g}, ${sp.b}, ${alpha * 0.7})`);
    gg.addColorStop(1, `rgba(${sp.r}, ${sp.g}, ${sp.b}, 0)`);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, size * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick(now) {
    if (!running) return;

    drawBackground();

    const t = now * 0.06;

    for (const s of stars) {
      if (!reducedMotion) {
        s.x += s.driftX;
        s.y += s.driftY;
        if (s.x < -4) s.x = width + 4;
        if (s.x > width + 4) s.x = -4;
        if (s.y > height + 4) {
          s.y = -4;
          s.x = Math.random() * width;
        }
      }
      drawStar(s, t);
    }

    if (!reducedMotion) {
      if (now - lastSpawn > rand(180, 420)) {
        spawnSparkle();
        if (Math.random() > 0.55) spawnSparkle();
        lastSpawn = now;
      }

      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i];
        sp.life += 1;
        drawSparkle(sp);
        if (sp.life >= sp.maxLife) sparkles.splice(i, 1);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    resize();
    running = true;
    lastSpawn = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    if (!running) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  document.addEventListener("visibilitychange", () => {
    if (!canvas.isConnected) return;
    if (document.hidden) {
      stop();
    } else if (document.getElementById("lucky-rain")?.classList.contains("is-active")) {
      start();
    }
  });

  window.Starfield = { start, stop, resize };
})();
