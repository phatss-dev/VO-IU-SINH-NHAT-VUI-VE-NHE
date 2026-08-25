document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // CẤU HÌNH & KIỂU KHUNG ẢNH
    // ==========================================
    // Khi có API: gán URL endpoint, ví dụ "/api/gallery"
    const GALLERY_API_URL = null;
  
    const FRAME = {
      POLAROID: "polaroid",
      PHOTOBOOTH: "photobooth",
    };
    const PHOTOBOOTH_SLOTS = 4;

    const screenEl = document.getElementById("image-birthday");
    const galleryEl = document.getElementById("main-gallery");
    const lightbox = document.getElementById("custom-lightbox");
    const lbContentTarget = document.getElementById("lb-content-target");
    const lbClose = document.getElementById("lb-close");
    const lbPrev = document.getElementById("lb-prev");
    const lbNext = document.getElementById("lb-next");
    const lbCounter = document.getElementById("lb-counter");
    const actionsBtn = document.getElementById("image-actions");
    const iconNextWrap = document.getElementById("image-icon-next-wrap");
  
    let galleryData = [];
    let lightboxSlides = [];
    let currentIndex = 0;
    let hasStarted = false;
    let controlsBound = false;
    let actionsVisible = false;
    let scrollBound = false;
  
    // ==========================================
    // TIỆN ÍCH
    // ==========================================
    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
  
    function toImageList(value) {
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object") {
              return String(
                item.src || item.url || item.image || item.path || "",
              ).trim();
            }
            return "";
          })
          .filter(Boolean);
      }
      if (typeof value === "string" && value.trim()) return [value.trim()];
      return [];
    }
  
    /** Chuẩn hóa 1 item từ server về đúng 2 kiểu khung */
    function normalizeItem(raw) {
      if (!raw || typeof raw !== "object") return null;
  
      const type = String(
        raw.type || raw.frameType || raw.frame || "",
      ).toLowerCase();
  
      const hasExplicitCaption = Object.prototype.hasOwnProperty.call(
        raw,
        "caption",
      );
      const caption = String(
        hasExplicitCaption
          ? raw.caption ?? ""
          : raw.title || raw.text || "",
      ).trim();
  
      // Photobooth: cần mảng ảnh (ưu tiên images/urls)
      if (
        type === FRAME.PHOTOBOOTH ||
        type === "booth" ||
        type === "strip"
      ) {
        let images = toImageList(
          raw.images || raw.urls || raw.photos || raw.srcList,
        );
  
        // Fallback: 1 URL đơn → nhân thành strip
        if (!images.length) {
          const single = String(
            raw.src || raw.url || raw.image || "",
          ).trim();
          if (single) images = [single];
        }
  
        if (!images.length) return null;
  
        // Đủ đúng PHOTOBOOTH_SLOTS khung (lặp nếu thiếu, cắt nếu thừa)
        const strip = Array.from({ length: PHOTOBOOTH_SLOTS }, (_, i) => {
          return images[i % images.length];
        });
  
        return {
          type: FRAME.PHOTOBOOTH,
          images: strip,
        };
      }
  
      // Polaroid: 1 ảnh
      const src = String(
        raw.src ||
          raw.url ||
          raw.image ||
          raw.path ||
          toImageList(raw.images)[0] ||
          "",
      ).trim();
  
      if (!src) return null;
  
      return {
        type: FRAME.POLAROID,
        src,
        caption:
          hasExplicitCaption || raw.allowEmptyCaption
            ? caption
            : caption || "Kỷ niệm đẹp",
      };
    }
  
    function normalizeGalleryItems(payload) {
      const list = Array.isArray(payload)
        ? payload
        : payload?.items || payload?.data || payload?.gallery || [];
  
      return list.map(normalizeItem).filter(Boolean);
    }
  
    // ==========================================
    // LẤY DỮ LIỆU (API hoặc mock local)
    // ==========================================
    async function fetchGalleryItems() {
      const preview =
        (window.__birthdayPreviewReady && (await window.__birthdayPreviewReady)) ||
        window.__BIRTHDAY_PREVIEW__;

      if (preview?.galleryItems?.length) {
        return normalizeGalleryItems(preview.galleryItems);
      }

      if (GALLERY_API_URL) {
        const res = await fetch(GALLERY_API_URL);
        if (!res.ok) {
          throw new Error(`API lỗi: ${res.status}`);
        }
        return normalizeGalleryItems(await res.json());
      }
  
      // Mock — thay bằng API khi sẵn sàng
      return normalizeGalleryItems([
        {
          type: "polaroid",
          src: "assets/images/gai_1.jpg",
          caption: "Nắng sớm và nụ cười rạng rỡ",
        },
        {
          type: "polaroid",
          src: "assets/images/gai_2.jpg",
          caption: "Cả bầu trời chứa đầy ước nguyện",
        },
        {
          type: "polaroid",
          src: "assets/images/gai_3.jpg",
          caption: "Nhắm mắt lại và ước nguyện nào...",
        },
        {
          type: "photobooth",
          images: [
            "assets/images/gai_1.jpg",
            "assets/images/gai_2.jpg",
            "assets/images/gai_3.jpg",
            "assets/images/gai4.jpg",
          ],
        },
        {
          type: "polaroid",
          src: "assets/images/gai4.jpg",
          caption: "Cạn ly vì một tuổi mới hạnh phúc!",
        },
        {
          type: "polaroid",
          src: "assets/images/gai5.jpg",
          caption: "Thắp sáng màn đêm bằng nụ cười",
        },
        {
          type: "polaroid",
          src: "assets/images/gai_2.jpg",
          caption: "Nhảy múa quên đi ngày hôm qua",
        },
        {
          type: "photobooth",
          images: [
            "assets/images/gai5.jpg",
            "assets/images/gai4.jpg",
            "assets/images/gai_3.jpg",
            "assets/images/gai_1.jpg",
          ],
        },
        {
          type: "polaroid",
          src: "assets/images/gai_3.jpg",
          caption: "Hẹn gặp lại tuổi mới rực rỡ hơn!",
        },
      ]);
    }
  
    // ==========================================
    // RENDER THEO TỪNG LOẠI KHUNG
    // ==========================================
    function renderPolaroid(item, index, slideIndex) {
      const src = escapeHtml(item.src);
      const caption = escapeHtml(item.caption || "");
      const aria = caption || "Ảnh Polaroid";
  
      return `
        <article
          class="gallery-item polaroid-style${caption ? "" : " is-captionless"}"
          data-index="${index}"
          data-slide-index="${slideIndex}"
          data-type="${FRAME.POLAROID}"
          role="button"
          tabindex="0"
          aria-label="${aria}"
        >
          <div class="washi-tape"></div>
          <div class="polaroid-image-container">
            <img src="${src}" alt="${aria}" loading="lazy" decoding="async" />
          </div>
          <div class="polaroid-caption-zone">
            <div class="polaroid-caption">${caption}</div>
          </div>
        </article>
      `;
    }
  
    function renderPhotobooth(item, index, frameSlides) {
      const frames = frameSlides
        .map(({ src, slideIndex }, i) => {
          const safeSrc = escapeHtml(src);
          return `
            <div
              class="photobooth-frame is-clickable"
              data-slide-index="${slideIndex}"
              role="button"
              tabindex="0"
              aria-label="Photobooth — ảnh ${i + 1}"
            >
              <img
                src="${safeSrc}"
                alt="Photobooth ${i + 1}"
                loading="lazy"
                decoding="async"
              />
            </div>
          `;
        })
        .join("");
  
      return `
        <article
          class="gallery-item photobooth-style"
          data-index="${index}"
          data-type="${FRAME.PHOTOBOOTH}"
          aria-label="HAPPY BIRTHDAY"
        >
          <div class="photobooth-edge-top"></div>
          <div class="photobooth-strip">${frames}</div>
          <div class="photobooth-brand">HAPPY BIRTHDAY</div>
          <div class="photobooth-edge-bottom"></div>
        </article>
      `;
    }
  
    function renderGallery(items) {
      if (!items.length) {
        galleryEl.innerHTML =
          '<div class="gallery-status">Chưa có ảnh để hiển thị.</div>';
        lightboxSlides = [];
        return;
      }
  
      lightboxSlides = [];
      let slideCursor = 0;
  
      galleryEl.innerHTML = items
        .map((item, index) => {
          if (item.type === FRAME.PHOTOBOOTH) {
            const frameSlides = item.images.map((src) => {
              const slideIndex = slideCursor++;
              lightboxSlides.push({ src });
              return { src, slideIndex };
            });
            return renderPhotobooth(item, index, frameSlides);
          }
  
          const slideIndex = slideCursor++;
          lightboxSlides.push({ src: item.src });
          return renderPolaroid(item, index, slideIndex);
        })
        .join("");
    }
  
    // ==========================================
    // HIỆU ỨNG XUẤT HIỆN
    // ==========================================
    function setupRevealEffects() {
      const items = galleryEl.querySelectorAll(".gallery-item");
  
      items.forEach((item, idx) => {
        item.style.setProperty("--delay", `${idx * 150}ms`);
      });
  
      const scrollObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const item = entry.target;
            const delay = item.style.getPropertyValue("--delay") || "0ms";
            setTimeout(() => item.classList.add("revealed"), parseInt(delay, 10));
            observer.unobserve(item);
          });
        },
        {
          root: null,
          rootMargin: "0px 0px -80px 0px",
          threshold: 0.15,
        },
      );
  
      items.forEach((item) => scrollObserver.observe(item));
    }
  
    // ==========================================
    // LIGHTBOX — chỉ phóng to 1 ảnh
    // ==========================================
    function openLightbox(slideIndex) {
      if (!lightboxSlides.length) return;
      currentIndex = slideIndex;
      updateLightboxContent();
      lightbox.classList.add("active");
      if (screenEl) screenEl.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
  
    function closeLightbox() {
      lightbox.classList.remove("active");
      if (screenEl) screenEl.style.overflow = "";
      document.body.style.overflow = "";
      setTimeout(() => {
        lbContentTarget.innerHTML = "";
      }, 500);
    }
  
    function updateLightboxContent() {
      const slide = lightboxSlides[currentIndex];
      if (!slide) return;
  
      lbCounter.textContent = `${currentIndex + 1} / ${lightboxSlides.length}`;
  
      lbContentTarget.innerHTML = `
        <div class="lightbox-image-only">
          <img src="${escapeHtml(slide.src)}" alt="" />
        </div>
      `;
    }
  
    function nextImage() {
      if (!lightboxSlides.length) return;
      currentIndex = (currentIndex + 1) % lightboxSlides.length;
      updateLightboxContent();
    }
  
    function prevImage() {
      if (!lightboxSlides.length) return;
      currentIndex =
        (currentIndex - 1 + lightboxSlides.length) % lightboxSlides.length;
      updateLightboxContent();
    }
  
    function bindGalleryClicks() {
      // Polaroid: click cả khung → mở đúng 1 ảnh đó
      galleryEl.querySelectorAll(".gallery-item.polaroid-style").forEach((item) => {
        const open = () => {
          const slideIndex = Number(item.dataset.slideIndex);
          if (!Number.isNaN(slideIndex)) openLightbox(slideIndex);
        };
  
        item.addEventListener("click", open);
        item.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
      });
  
      // Photobooth: chỉ mở đúng ô ảnh được nhấn
      galleryEl.querySelectorAll(".photobooth-frame.is-clickable").forEach((frame) => {
        const open = (e) => {
          e.stopPropagation();
          const slideIndex = Number(frame.dataset.slideIndex);
          if (!Number.isNaN(slideIndex)) openLightbox(slideIndex);
        };
  
        frame.addEventListener("click", open);
        frame.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open(e);
          }
        });
      });
    }
  
    function bindLightboxControls() {
      lbClose.addEventListener("click", (e) => {
        e.stopPropagation();
        closeLightbox();
      });
      lbNext.addEventListener("click", (e) => {
        e.stopPropagation();
        nextImage();
      });
      lbPrev.addEventListener("click", (e) => {
        e.stopPropagation();
        prevImage();
      });
  
      lightbox.addEventListener("click", (e) => {
        if (
          e.target === lightbox ||
          e.target === lightbox.querySelector(".lightbox-wrapper") ||
          e.target === lbContentTarget
        ) {
          closeLightbox();
        }
      });
  
      document.addEventListener("keydown", (e) => {
        if (!lightbox.classList.contains("active")) return;
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowRight") nextImage();
        if (e.key === "ArrowLeft") prevImage();
      });
  
      let touchStartX = 0;
      let touchEndX = 0;
  
      lightbox.addEventListener(
        "touchstart",
        (e) => {
          touchStartX = e.changedTouches[0].screenX;
        },
        { passive: true },
      );
  
      lightbox.addEventListener(
        "touchend",
        (e) => {
          touchEndX = e.changedTouches[0].screenX;
          const threshold = 50;
          if (touchStartX - touchEndX > threshold) nextImage();
          else if (touchEndX - touchStartX > threshold) prevImage();
        },
        { passive: true },
      );
    }
  
    // ==========================================
    // NÚT TIẾP TỤC (hiện khi kéo hết ảnh)
    // ==========================================
    function isScrolledToEnd() {
      if (!screenEl) return false;
      const threshold = 96;
      return (
        screenEl.scrollTop + screenEl.clientHeight >=
        screenEl.scrollHeight - threshold
      );
    }

    function revealActionsButton() {
      if (actionsVisible || !actionsBtn || !iconNextWrap) return;

      actionsVisible = true;
      actionsBtn.classList.add("is-visible");
      actionsBtn.setAttribute("aria-hidden", "false");

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduceMotion || typeof gsap === "undefined") {
        iconNextWrap.style.opacity = "1";
        iconNextWrap.style.transform = "none";
        return;
      }

      gsap.fromTo(
        iconNextWrap,
        { opacity: 0, y: 18, scale: 0.86 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.65,
          ease: "back.out(1.6)",
        },
      );
    }

    function hideActionsButton() {
      if (!actionsVisible || !actionsBtn) return;

      actionsVisible = false;
      actionsBtn.classList.remove("is-visible");
      actionsBtn.setAttribute("aria-hidden", "true");

      if (iconNextWrap) {
        if (typeof gsap !== "undefined") {
          gsap.set(iconNextWrap, { opacity: 0, y: 18, scale: 0.86 });
        } else {
          iconNextWrap.style.opacity = "0";
        }
      }
    }

    function checkScrollForActions() {
      if (!screenEl || lightbox?.classList.contains("active")) return;

      void (async () => {
        const flow =
          typeof window.getBirthdayPreviewFlow === "function"
            ? await window.getBirthdayPreviewFlow()
            : { showAlbumNext: true };

        if (!flow.showAlbumNext) {
          hideActionsButton();
          return;
        }

        if (isScrolledToEnd()) {
          revealActionsButton();
        } else {
          hideActionsButton();
        }
      })();
    }

    function bindScrollActions() {
      if (scrollBound || !screenEl) return;
      scrollBound = true;

      screenEl.addEventListener("scroll", checkScrollForActions, {
        passive: true,
      });
      window.addEventListener("resize", checkScrollForActions);
    }

    function goToAfterAlbum() {
      if (actionsBtn) {
        actionsBtn.style.pointerEvents = "none";
      }

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      void (async () => {
        const flow =
          typeof window.getBirthdayPreviewFlow === "function"
            ? await window.getBirthdayPreviewFlow()
            : { hasVideo: true, hasWishRain: true };

        if (flow.hasVideo && typeof window.showVideoBirthday === "function") {
          window.showVideoBirthday();
        } else if (
          flow.hasWishRain &&
          typeof window.showLuckyRain === "function"
        ) {
          window.showLuckyRain();
        }

        const hideImageScreen = () => {
          if (screenEl) {
            screenEl.classList.remove("is-active");
            screenEl.setAttribute("aria-hidden", "true");
          }
        };

        if (reduceMotion) {
          hideImageScreen();
          return;
        }

        window.setTimeout(hideImageScreen, 650);
      })();
    }

    function bindActionsClick() {
      actionsBtn?.addEventListener("click", goToAfterAlbum);
    }

    // ==========================================
    // KHỞI TẠO
    // ==========================================
    async function initImageBirthday() {
      if (!galleryEl || !lightbox) return;

      if (!controlsBound) {
        bindLightboxControls();
        bindActionsClick();
        bindScrollActions();
        controlsBound = true;
      }

      try {
        galleryData = await fetchGalleryItems();
        renderGallery(galleryData);
        setupRevealEffects();
        bindGalleryClicks();

        galleryEl.querySelectorAll("img").forEach((img) => {
          if (img.complete) return;
          img.addEventListener("load", checkScrollForActions, { once: true });
        });

        requestAnimationFrame(checkScrollForActions);
      } catch (err) {
        console.error(err);
        galleryEl.innerHTML =
          '<div class="gallery-status">Không tải được ảnh. Vui lòng thử lại.</div>';
      }
    }

    async function showImageBirthday() {
      if (!screenEl) return;

      screenEl.classList.add("is-active");
      screenEl.setAttribute("aria-hidden", "false");

      if (hasStarted) return;

      hasStarted = true;
      await initImageBirthday();
    }

    window.showImageBirthday = showImageBirthday;
  });
  