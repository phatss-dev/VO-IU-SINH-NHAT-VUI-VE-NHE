const GREETING_TEXT = 'Chúc mừng sinh nhật';
const SUBTITLE_TEXT = 'Happy Birthday';
const FALLBACK_RECIPIENT_NAME = 'Lữ Lê Bảo Trân';

const INTRO_CONFIG = {
	apiUrl: '/api/birthday',
	typewriterSpeed: 110,
	actionRevealDelay: 280,
	actionStagger: 0.28,
};

const NAME_FIT = {
	/** Chừa mép cho swash Great Vibes + overflow-x của container */
	safety: 0.9,
};

const RECIPIENT_NAME_CLASSES = {
	base: 'gradient-recipient-name glowing-text',
	shine: 'gradient-recipient-name glowing-text shine-sweep',
};

const els = {
	screen: document.getElementById('text-birthday'),
	greetLine: document.getElementById('greet-line'),
	nameLine: document.getElementById('name-line'),
	recipientName: document.getElementById('recipient-name'),
	typewriterText: document.getElementById('typewriter-text'),
	actions: document.getElementById('text-actions'),
	iconLetter: document.getElementById('icon-letter-wrap'),
	iconNext: document.getElementById('icon-next-wrap'),
};

let recipientName = FALLBACK_RECIPIENT_NAME;
let hasStarted = false;
let nameFitRaf = 0;

function normalizeRecipientName(data) {
	const name = String(data?.recipientName ?? data?.name ?? '').trim();
	return name || FALLBACK_RECIPIENT_NAME;
}

async function fetchRecipientName() {
	const preview =
		(window.__birthdayPreviewReady && (await window.__birthdayPreviewReady)) ||
		window.__BIRTHDAY_PREVIEW__;
	if (preview?.intro?.recipientName) {
		return preview.intro.recipientName;
	}

	try {
		const response = await fetch(INTRO_CONFIG.apiUrl);

		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}

		return normalizeRecipientName(await response.json());
	} catch (error) {
		console.warn('Dùng tên mặc định cho intro:', error);
		return FALLBACK_RECIPIENT_NAME;
	}
}

/** Giới hạn cỡ chữ theo phone / iPad / desktop + hướng màn hình */
function getViewportNameLimits() {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const landscape = w > h;

	if (w < 480) {
		return {
			maxPx: landscape ? 46 : 64,
			minPx: 22,
			wrapComfortPx: 36,
			preferWrapAt: 9,
			maxLines: 2.55,
			safety: 0.88,
		};
	}

	if (w < 768) {
		return {
			maxPx: landscape ? 52 : 74,
			minPx: 24,
			wrapComfortPx: 38,
			preferWrapAt: 11,
			maxLines: 2.45,
			safety: 0.9,
		};
	}

	if (w <= 1024) {
		return {
			maxPx: landscape ? 92 : 112,
			minPx: 30,
			wrapComfortPx: 44,
			preferWrapAt: 13,
			maxLines: 2.35,
			safety: 0.92,
		};
	}

	return {
		maxPx: 152,
		minPx: 36,
		wrapComfortPx: 48,
		preferWrapAt: 18,
		maxLines: 2.3,
		safety: NAME_FIT.safety,
	};
}

function getNameFitWidth() {
	if (!els.nameLine) return 0;

	// clientWidth không bị GSAP transform làm lệch (khác getBoundingClientRect)
	let width = els.nameLine.clientWidth;

	const parent = els.nameLine.parentElement;
	if (parent) {
		const style = window.getComputedStyle(parent);
		const padX =
			(parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
		width = Math.max(width, parent.clientWidth - padX);
	}

	return Math.floor(Math.max(0, width));
}

function setRecipientFontSize(px) {
	els.recipientName.style.setProperty('--recipient-fs', `${Math.round(px * 100) / 100}px`);
}

/** Scale từ transform GSAP trên #name-line — Range API bị ảnh hưởng nên cần chia lại */
function getNameLineScaleX() {
	if (!els.nameLine) return 1;
	const t = window.getComputedStyle(els.nameLine).transform;
	if (!t || t === 'none') return 1;

	try {
		const m = new DOMMatrixReadOnly(t);
		const scaleX = Math.hypot(m.a, m.b);
		return scaleX > 0.01 ? scaleX : 1;
	} catch {
		return 1;
	}
}

/**
 * Đo bề ngang chữ thật (Range) — ổn định hơn scrollWidth trên Safari iOS/iPad.
 * Khi nowrap: lấy full width 1 dòng. Khi wrap: lấy dòng rộng nhất.
 */
function measureTextWidth(el) {
	if (!el || !el.firstChild) return 0;

	const range = document.createRange();
	range.selectNodeContents(el);
	const rects = range.getClientRects();
	const scale = getNameLineScaleX();

	if (!rects.length) {
		return range.getBoundingClientRect().width / scale;
	}

	let max = 0;
	for (let i = 0; i < rects.length; i += 1) {
		max = Math.max(max, rects[i].width);
	}
	return max / scale;
}

function measureTextHeight(el) {
	if (!el || !el.firstChild) return 0;
	const range = document.createRange();
	range.selectNodeContents(el);
	return range.getBoundingClientRect().height / getNameLineScaleX();
}

function nameFitsSingleLine(targetWidth) {
	return measureTextWidth(els.recipientName) <= targetWidth;
}

function nameFitsWrapped(targetWidth, fontSize, maxLines) {
	const widthOk = measureTextWidth(els.recipientName) <= targetWidth;
	const heightOk = measureTextHeight(els.recipientName) <= fontSize * maxLines;
	return widthOk && heightOk;
}

function binaryFitFontSize(maxPx, minPx, fits) {
	let lo = minPx;
	let hi = maxPx;

	setRecipientFontSize(hi);
	if (fits(hi)) return hi;

	setRecipientFontSize(lo);
	if (!fits(lo)) return lo;

	for (let i = 0; i < 18 && hi - lo > 0.4; i += 1) {
		const mid = (lo + hi) / 2;
		setRecipientFontSize(mid);
		if (fits(mid)) lo = mid;
		else hi = mid;
	}

	setRecipientFontSize(lo);
	return lo;
}

/**
 * Co cỡ chữ tên theo phone / iPad / desktop:
 * - Màn hẹp + tên dài: ưu tiên xuống dòng sớm để chữ vẫn đẹp
 * - Đo bằng Range API (Safari-friendly)
 * - Chừa mép safety cho nét swash cursive
 */
function fitRecipientName() {
	const el = els.recipientName;
	if (!el || !els.nameLine || !recipientName) return;

	const limits = getViewportNameLimits();
	const available = getNameFitWidth();
	if (available <= 0) return;

	const targetWidth = available * limits.safety;
	const maxPx = Math.min(limits.maxPx, Math.max(limits.minPx, available * 0.3));
	const words = recipientName.trim().split(/\s+/).filter(Boolean);
	const charCount = recipientName.replace(/\s+/g, '').length;

	el.classList.remove('is-wrapped', 'is-compact', 'is-tight');
	el.style.whiteSpace = 'nowrap';
	el.style.overflowWrap = '';
	el.style.wordBreak = '';

	const preferWrap =
		words.length >= 2 && charCount >= limits.preferWrapAt;

	let size;

	if (preferWrap) {
		el.classList.add('is-wrapped');
		el.style.whiteSpace = '';
		size = binaryFitFontSize(maxPx, limits.minPx, (fs) =>
			nameFitsWrapped(targetWidth, fs, limits.maxLines)
		);
	} else {
		size = binaryFitFontSize(maxPx, limits.minPx, () =>
			nameFitsSingleLine(targetWidth)
		);

		const tooSmallForSingle =
			words.length >= 2 &&
			(size < limits.wrapComfortPx || !nameFitsSingleLine(targetWidth));

		if (tooSmallForSingle) {
			el.classList.add('is-wrapped');
			el.style.whiteSpace = '';
			size = binaryFitFontSize(maxPx, limits.minPx, (fs) =>
				nameFitsWrapped(targetWidth, fs, limits.maxLines)
			);
		}
	}

	if (!nameFitsWrapped(targetWidth, size, limits.maxLines) && el.classList.contains('is-wrapped')) {
		el.style.overflowWrap = 'anywhere';
		el.style.wordBreak = 'break-word';
		size = binaryFitFontSize(size, limits.minPx, (fs) =>
			nameFitsWrapped(targetWidth, fs, limits.maxLines)
		);
	} else if (!el.classList.contains('is-wrapped') && !nameFitsSingleLine(targetWidth)) {
		el.classList.add('is-wrapped');
		el.style.whiteSpace = '';
		el.style.overflowWrap = 'anywhere';
		el.style.wordBreak = 'break-word';
		size = binaryFitFontSize(maxPx, limits.minPx, (fs) =>
			nameFitsWrapped(targetWidth, fs, limits.maxLines)
		);
	}

	if (charCount >= 14 || size <= limits.wrapComfortPx) {
		el.classList.add('is-compact');
	}
	if (charCount >= 22 || (el.classList.contains('is-wrapped') && size <= limits.wrapComfortPx)) {
		el.classList.add('is-tight');
	}
}

function scheduleFitRecipientName() {
	cancelAnimationFrame(nameFitRaf);
	nameFitRaf = requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			fitRecipientName();
		});
	});
}

function applyRecipientName(name) {
	recipientName = normalizeRecipientName({ recipientName: name });
	els.recipientName.textContent = recipientName;
	scheduleFitRecipientName();
}

function generateAnimatedCharacters(text) {
	els.greetLine.replaceChildren();

	text.split(' ').forEach((word) => {
		const wordSpan = document.createElement('span');
		wordSpan.className = 'inline-block mr-3 md:mr-5 transform select-none';

		[...word].forEach((char) => {
			const charSpan = document.createElement('span');
			charSpan.textContent = char;
			charSpan.className = 'char-span inline-block opacity-0 filter blur-xl transform scale-[0.4] transition-all duration-1000';
			wordSpan.appendChild(charSpan);
		});

		els.greetLine.appendChild(wordSpan);
	});
}

function resetRecipientNameClasses(withShine = false) {
	const wasWrapped = els.recipientName.classList.contains('is-wrapped');
	const wasCompact = els.recipientName.classList.contains('is-compact');
	const wasTight = els.recipientName.classList.contains('is-tight');

	els.recipientName.className = withShine
		? RECIPIENT_NAME_CLASSES.shine
		: RECIPIENT_NAME_CLASSES.base;

	if (wasWrapped) els.recipientName.classList.add('is-wrapped');
	if (wasCompact) els.recipientName.classList.add('is-compact');
	if (wasTight) els.recipientName.classList.add('is-tight');
}

function typeWriterEffect(text, element, speed = INTRO_CONFIG.typewriterSpeed, onComplete) {
	let index = 0;
	element.textContent = '';
	element.classList.add('typing-cursor');

	const nextChar = () => {
		if (index < text.length) {
			element.textContent += text.charAt(index);
			index += 1;
			setTimeout(nextChar, speed);
			return;
		}

		element.classList.remove('typing-cursor');

		if (typeof onComplete === 'function') {
			onComplete();
		}
	};

	nextChar();
}

function revealActionButtons() {
	if (!els.actions || !els.iconLetter || !els.iconNext) {
		return;
	}

	els.actions.classList.add('is-visible');
	els.actions.setAttribute('aria-hidden', 'false');

	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (reduceMotion) {
		gsap.set([els.iconLetter, els.iconNext], { opacity: 1, y: 0, scale: 1 });
		return;
	}

	gsap.fromTo(
		[els.iconLetter, els.iconNext],
		{ opacity: 0, y: 18, scale: 0.86 },
		{
			opacity: 1,
			y: 0,
			scale: 1,
			duration: 0.65,
			ease: 'back.out(1.6)',
			stagger: INTRO_CONFIG.actionStagger,
			delay: INTRO_CONFIG.actionRevealDelay / 1000,
		}
	);
}

function triggerCinematicTimeline() {
	generateAnimatedCharacters(GREETING_TEXT);
	resetRecipientNameClasses(false);
	scheduleFitRecipientName();

	gsap.set(els.nameLine, { opacity: 0, scale: 0.85 });
	gsap.set(els.typewriterText, { opacity: 0 });
	els.typewriterText.textContent = '';
	els.typewriterText.classList.add('typing-cursor');

	const tl = gsap.timeline();

	tl.to('.char-span', {
		opacity: 1,
		scale: 1,
		filter: 'blur(0px)',
		duration: 1.2,
		stagger: 0.04,
		ease: 'back.out(1.65)',
	}, 0);

	tl.to(els.nameLine, {
		opacity: 1,
		scale: 1,
		duration: 1.8,
		ease: 'power3.out',
		onComplete: scheduleFitRecipientName,
	}, '-=0.5');

	tl.add(() => {
		resetRecipientNameClasses(true);
		scheduleFitRecipientName();
	}, '+=0.3');

	tl.to(els.typewriterText, {
		opacity: 1,
		duration: 0.1,
		onComplete: () => {
			typeWriterEffect(SUBTITLE_TEXT, els.typewriterText, INTRO_CONFIG.typewriterSpeed, revealActionButtons);
		},
	}, '-=0.6');
}

async function showTextBirthday() {
	if (hasStarted || !els.screen) {
		return;
	}

	hasStarted = true;

	const cakeScene = document.getElementById('cake-scene');
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Crossfade: hiện text trước, cake fade out — tránh cắt đột ngột bằng display:none
	els.screen.classList.add('is-active');
	els.screen.setAttribute('aria-hidden', 'false');

	// Apply tên sau khi màn đã visible để đo layout đúng trên mobile/iPad
	applyRecipientName(FALLBACK_RECIPIENT_NAME);

	if (cakeScene) {
		cakeScene.setAttribute('aria-hidden', 'true');

		if (reduceMotion) {
			cakeScene.setAttribute('hidden', '');
		} else {
			cakeScene.classList.add('is-leaving');
			window.setTimeout(() => {
				cakeScene.setAttribute('hidden', '');
				cakeScene.classList.remove('is-leaving');
			}, 700);
		}
	}

	fetchRecipientName().then((name) => {
		if (name && name !== recipientName) {
			applyRecipientName(name);
		}
	});

	const enterDelay = reduceMotion ? 0 : 380;

	window.setTimeout(() => {
		triggerCinematicTimeline();
	}, enterDelay);
}

function goToLetterBirthday() {
	if (els.actions) {
		els.actions.style.pointerEvents = 'none';
	}

	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Hiện letter trước (z-index cao hơn) rồi mới ẩn text → tránh lộ ảnh bánh phía dưới
	if (typeof window.showLetterBirthday === 'function') {
		window.showLetterBirthday();
	}

	const hideTextScreen = () => {
		if (els.screen) {
			els.screen.classList.remove('is-active');
			els.screen.setAttribute('aria-hidden', 'true');
		}
	};

	if (reduceMotion) {
		hideTextScreen();
		return;
	}

	window.setTimeout(hideTextScreen, 650);
}

function bindActionButton() {
	els.actions?.addEventListener('click', goToLetterBirthday);
}

function bindRecipientNameFit() {
	if (!els.nameLine) return;

	window.addEventListener('resize', scheduleFitRecipientName, { passive: true });
	window.addEventListener('orientationchange', () => {
		window.setTimeout(scheduleFitRecipientName, 120);
	}, { passive: true });

	if (window.visualViewport) {
		window.visualViewport.addEventListener('resize', scheduleFitRecipientName, {
			passive: true,
		});
	}

	if (typeof ResizeObserver !== 'undefined') {
		const ro = new ResizeObserver(() => scheduleFitRecipientName());
		ro.observe(els.nameLine);
		if (els.nameLine.parentElement) {
			ro.observe(els.nameLine.parentElement);
		}
	}

	if (document.fonts?.ready) {
		document.fonts.ready.then(() => scheduleFitRecipientName());
	}
}

bindActionButton();
bindRecipientNameFit();

window.showTextBirthday = showTextBirthday;
