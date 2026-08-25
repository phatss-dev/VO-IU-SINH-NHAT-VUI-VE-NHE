(function () {
/* ========== CẤU HÌNH SERVER ==========
   Khi có API, chỉ cần điền apiUrl.
   Server nên trả JSON dạng:
   { "url": "https://.../video.mp4", "poster": "https://.../thumb.jpg", "title": "..." }
   hoặc { "videoUrl": "..." }
   Có thể truyền ?id=xxx trên URL trang để lấy video cụ thể.
*/
const CONFIG = {
    apiUrl: '', // ví dụ: 'https://api.example.com/videos' hoặc '/api/video'
    fallbackVideoUrl: 'assets/videos/videoDemoHPBD2.mp4',
};

const screenEl = document.getElementById('video-birthday');
const video = document.getElementById('birthdayVideo');
const videoShell = document.getElementById('videoShell');
const videoPoster = document.getElementById('videoPoster');
const stateLoading = document.getElementById('stateLoading');
const stateError = document.getElementById('stateError');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const posterPlayBtn = document.getElementById('posterPlayBtn');
const playBtn = document.getElementById('playBtn');
const rewindBtn = document.getElementById('rewindBtn');
const forwardBtn = document.getElementById('forwardBtn');
const muteBtn = document.getElementById('muteBtn');
const volumeBar = document.getElementById('volumeBar');
const progressBar = document.getElementById('progressBar');
const progressBarFill = document.getElementById('progressBarFill');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fsRoot = document.getElementById('fsRoot');
const actionsBtn = document.getElementById('video-actions');
const iconNextWrap = document.getElementById('video-icon-next-wrap');

let isPortraitVideo = false;
let videoReady = false;
let hasStarted = false;
let controlsBound = false;
let actionsVisible = false;
let actionsBound = false;

function setUIState(state, message = '') {
    if (!stateLoading || !stateError || !posterPlayBtn) return;

    stateLoading.classList.toggle('hidden', state !== 'loading');
    stateLoading.classList.toggle('flex', state === 'loading');
    stateError.classList.toggle('hidden', state !== 'error');
    stateError.classList.toggle('flex', state === 'error');
    posterPlayBtn.classList.toggle('hidden', state !== 'ready');
    if (state === 'error' && errorMessage) errorMessage.textContent = message;
}

function getVideoIdFromPage() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('videoId') || '';
}

/** Gọi API server lấy thông tin video */
async function fetchVideoFromServer() {
    const preview =
        (window.__birthdayPreviewReady && (await window.__birthdayPreviewReady)) ||
        window.__BIRTHDAY_PREVIEW__;

    if (preview) {
        if (preview.video?.enabled && preview.video?.url) {
            return {
                url: preview.video.url,
                poster: null,
                title: null,
            };
        }
        return { url: null, poster: null, title: null, skip: true };
    }

    if (!CONFIG.apiUrl) {
        return { url: CONFIG.fallbackVideoUrl, poster: null, title: null };
    }

    const videoId = getVideoIdFromPage();
    const endpoint = new URL(CONFIG.apiUrl, window.location.origin);
    if (videoId) endpoint.searchParams.set('id', videoId);

    const res = await fetch(endpoint.toString(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Server lỗi (${res.status}). Không tải được video.`);
    }

    const data = await res.json();
    const url = data.url || data.videoUrl || data.src || data.video_url;

    if (!url) {
        throw new Error('Server không trả về đường dẫn video.');
    }

    return {
        url,
        poster: data.poster || data.thumbnail || null,
        title: data.title || null,
    };
}

/** Gán nguồn video và chờ metadata sẵn sàng */
function attachVideoSource(src, poster = null) {
    return new Promise((resolve, reject) => {
        videoReady = false;
        video.pause();
        video.removeAttribute('src');
        video.querySelectorAll('source').forEach((el) => el.remove());

        if (poster) {
            video.poster = poster;
        } else {
            video.removeAttribute('poster');
        }

        const onReady = () => {
            cleanup();
            videoReady = true;
            resolve();
        };

        const onError = () => {
            cleanup();
            reject(new Error('Không phát được file video từ server.'));
        };

        const cleanup = () => {
            video.removeEventListener('loadedmetadata', onReady);
            video.removeEventListener('error', onError);
        };

        video.addEventListener('loadedmetadata', onReady, { once: true });
        video.addEventListener('error', onError, { once: true });

        video.preload = 'metadata';
        video.src = src;
        video.load();
    });
}

function detectVideoOrientation() {
    if (!video.videoWidth || !video.videoHeight) return;
    isPortraitVideo = video.videoHeight > video.videoWidth;
    videoShell.classList.toggle('is-portrait', isPortraitVideo);
    videoShell.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
}

function resetProgressUI() {
    progressBar.value = 0;
    progressBarFill.style.width = '0%';
    currentTimeEl.textContent = '00:00';
    durationTimeEl.textContent = '00:00';
    updatePlayPauseState();
}

async function loadVideo() {
    setUIState('loading');
    videoPoster.classList.remove('opacity-0', 'pointer-events-none');
    resetProgressUI();

    try {
        const info = await fetchVideoFromServer();
        if (info?.skip || !info?.url) {
            const flow =
                typeof window.getBirthdayPreviewFlow === 'function'
                    ? await window.getBirthdayPreviewFlow()
                    : { hasWishRain: true };
            if (flow.hasWishRain) {
                goToLuckyRain();
            }
            return;
        }
        await attachVideoSource(info.url, info.poster);
        detectVideoOrientation();
        durationTimeEl.textContent = formatTime(video.duration);
        setUIState('ready');

        const flow =
            typeof window.getBirthdayPreviewFlow === 'function'
                ? await window.getBirthdayPreviewFlow()
                : { hasWishRain: true };
        if (flow.hasWishRain) {
            revealActionsButton();
        }
    } catch (err) {
        console.error(err);
        setUIState('error', err.message || 'Có lỗi khi tải video.');
    }
}

function isMobileOrTablet() {
    return window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
}

function isScreenPortrait() {
    return window.innerHeight >= window.innerWidth;
}

function getFullscreenElement() {
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.msFullscreenElement;
}

function requestFs(el) {
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
    return Promise.reject(new Error('Fullscreen không được hỗ trợ'));
}

function exitFs() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    return Promise.resolve();
}

async function lockScreenOrientation() {
    if (!screen.orientation || typeof screen.orientation.lock !== 'function') {
        return false;
    }
    const mode = isPortraitVideo ? 'portrait' : 'landscape';
    const fallback = isPortraitVideo ? 'portrait-primary' : 'landscape-primary';
    try {
        await screen.orientation.lock(mode);
        return true;
    } catch (_) {
        try {
            await screen.orientation.lock(fallback);
            return true;
        } catch (_) {
            return false;
        }
    }
}

function unlockScreenOrientation() {
    try {
        screen.orientation?.unlock?.();
    } catch (_) {}
}

async function applyFullscreenOrientation() {
    fsRoot.classList.remove('fs-rotate-landscape');
    if (!isMobileOrTablet()) return;

    if (isPortraitVideo) {
        await lockScreenOrientation();
        return;
    }

    const locked = await lockScreenOrientation();
    if (!locked && isScreenPortrait() && getFullscreenElement()) {
        fsRoot.classList.add('fs-rotate-landscape');
    }
}

function clearFullscreenOrientation() {
    fsRoot.classList.remove('fs-rotate-landscape');
    unlockScreenOrientation();
}

function updateFullscreenIcon() {
    fullscreenBtn.innerHTML = getFullscreenElement()
        ? '<i class="fa-solid fa-compress"></i>'
        : '<i class="fa-solid fa-expand"></i>';
}

function startVideo() {
    if (!videoReady) return;
    videoPoster.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        video.play()
            .then(() => updatePlayPauseState())
            .catch(error => console.log('Video error: ', error));
    }, 150);
}

function seekBy(seconds) {
    if (!videoReady || !video.duration || isNaN(video.duration)) return;
    video.currentTime = Math.min(
        Math.max(video.currentTime + seconds, 0),
        video.duration
    );
}

function updatePlayPauseState() {
    playBtn.innerHTML = video.paused
        ? '<i class="fa-solid fa-play"></i>'
        : '<i class="fa-solid fa-pause"></i>';
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateVolumeIcon() {
    if (video.muted || video.volume === 0) {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else if (video.volume < 0.4) {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
    } else {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
}

function onFullscreenChange() {
    updateFullscreenIcon();
    if (getFullscreenElement()) {
        applyFullscreenOrientation();
    } else {
        clearFullscreenOrientation();
    }
}

function bindVideoControls() {
    if (controlsBound || !video) return;
    controlsBound = true;

    posterPlayBtn?.addEventListener('click', startVideo);
    retryBtn?.addEventListener('click', loadVideo);

    video.addEventListener('click', () => {
        if (!videoReady) return;
        if (video.paused) video.play();
        else video.pause();
        updatePlayPauseState();
    });

    playBtn?.addEventListener('click', () => {
        if (!videoReady) return;
        if (video.paused) video.play();
        else video.pause();
        updatePlayPauseState();
    });

    rewindBtn?.addEventListener('click', () => seekBy(-10));
    forwardBtn?.addEventListener('click', () => seekBy(10));

    video.addEventListener('play', () => {
        updatePlayPauseState();
        window.BirthdayMusic?.hold?.();
    });
    video.addEventListener('pause', () => {
        updatePlayPauseState();
        window.BirthdayMusic?.release?.();
    });
    video.addEventListener('ended', () => {
        window.BirthdayMusic?.release?.();
    });

    video.addEventListener('timeupdate', () => {
        if (!video.duration) return;
        const percentage = (video.currentTime / video.duration) * 100;
        progressBar.value = percentage || 0;
        progressBarFill.style.width = `${percentage}%`;
        currentTimeEl.textContent = formatTime(video.currentTime);
        if (!isNaN(video.duration)) {
            durationTimeEl.textContent = formatTime(video.duration);
        }
    });

    progressBar?.addEventListener('input', () => {
        if (!video.duration) return;
        video.currentTime = (progressBar.value / 100) * video.duration;
        progressBarFill.style.width = `${progressBar.value}%`;
    });

    volumeBar?.addEventListener('input', (e) => {
        video.volume = e.target.value;
        video.muted = (video.volume === 0);
        updateVolumeIcon();
    });

    muteBtn?.addEventListener('click', () => {
        video.muted = !video.muted;
        volumeBar.value = video.muted ? 0 : (video.volume || 0.8);
        updateVolumeIcon();
    });

    fullscreenBtn?.addEventListener('click', async () => {
        if (!videoReady) return;
        try {
            if (!getFullscreenElement()) {
                detectVideoOrientation();
                await requestFs(fsRoot);
                await applyFullscreenOrientation();
            } else {
                await exitFs();
            }
        } catch (err) {
            console.error(`Fullscreen error: ${err.message}`);
        }
        updateFullscreenIcon();
    });

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    window.addEventListener('resize', () => {
        if (!getFullscreenElement() || !isMobileOrTablet() || isPortraitVideo) return;
        fsRoot.classList.toggle('fs-rotate-landscape', isScreenPortrait());
    });
}

function revealActionsButton() {
    if (actionsVisible || !actionsBtn || !iconNextWrap) return;

    actionsVisible = true;
    actionsBtn.classList.add('is-visible');
    actionsBtn.setAttribute('aria-hidden', 'false');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || typeof gsap === 'undefined') {
        iconNextWrap.style.opacity = '1';
        iconNextWrap.style.transform = 'none';
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
            ease: 'back.out(1.6)',
            delay: 0.28,
        },
    );
}

function goToLuckyRain() {
    if (actionsBtn) {
        actionsBtn.style.pointerEvents = 'none';
    }

    if (video && !video.paused) {
        video.pause();
    } else {
        // Video đã pause / chưa phát — vẫn nhả hold để BGM chắc chắn chạy lại
        window.BirthdayMusic?.release?.();
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof window.showLuckyRain === 'function') {
        window.showLuckyRain();
    }

    const hideVideoScreen = () => {
        if (screenEl) {
            screenEl.classList.remove('is-active');
            screenEl.setAttribute('aria-hidden', 'true');
        }
    };

    if (reduceMotion) {
        hideVideoScreen();
        return;
    }

    window.setTimeout(hideVideoScreen, 650);
}

function bindActionsClick() {
    if (actionsBound || !actionsBtn) return;
    actionsBound = true;
    actionsBtn.addEventListener('click', goToLuckyRain);
}

function showVideoBirthday() {
    if (!screenEl) return;

    bindVideoControls();
    bindActionsClick();

    void (async () => {
        const flow =
            typeof window.getBirthdayPreviewFlow === 'function'
                ? await window.getBirthdayPreviewFlow()
                : { hasVideo: true, hasWishRain: true };

        // Preview không có video → chỉ sang mưa lời chúc nếu đã chọn
        if (flow.isPreview && !flow.hasVideo) {
            if (flow.hasWishRain) {
                goToLuckyRain();
            }
            return;
        }

        screenEl.classList.add('is-active');
        screenEl.setAttribute('aria-hidden', 'false');

        // Nút next chỉ hiện khi còn mưa lời chúc phía sau
        if (!flow.isPreview || flow.hasWishRain) {
            // reveal sau khi video ready trong loadVideo (preview),
            // hoặc hiện luôn ở demo mode
            if (!flow.isPreview) {
                revealActionsButton();
            }
        }

        if (hasStarted) return;

        hasStarted = true;
        loadVideo();
    })();
}

window.showVideoBirthday = showVideoBirthday;
})();
