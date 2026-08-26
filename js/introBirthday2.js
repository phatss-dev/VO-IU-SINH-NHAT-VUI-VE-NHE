const BIRTHDAY_API = '/api/birthday';

const FALLBACK = {
	photoUrl: 'assets/images/gai5.jpg',
	age: '17',
	photoAlt: 'Ảnh trang trí trên bánh',
	musicUrl: window.BirthdayMusic?.DEFAULT_MUSIC_URL || '',
};

async function fetchBirthdayConfig() {
	const response = await fetch(BIRTHDAY_API);

	if (!response.ok) {
		throw new Error(`API error: ${response.status}`);
	}

	return response.json();
}

function applyAge(cake, age) {
	if (age == null || age === '') {
		return;
	}

	cake.dataset.age = String(age);
}

function preloadPhoto(url) {
	return new Promise((resolve, reject) => {
		const loader = new Image();
		loader.decoding = 'async';
		loader.onload = () => resolve(url);
		loader.onerror = () => reject(new Error('Photo load failed'));
		loader.src = url;
	});
}

async function loadCakePhoto(photo, slot, photoUrl, photoAlt) {
	await preloadPhoto(photoUrl);

	photo.src = photoUrl;

	if (photoAlt) {
		photo.alt = photoAlt;
	}

	slot.hidden = false;
	slot.classList.add('is-ready');
}

function prepareBackgroundMusic(config, preview) {
	const music = window.BirthdayMusic;
	if (!music) return;

	const url = music.resolveUrl(config, preview);
	music.prepare(url);
}

async function initBirthdayCake() {
	const cake = document.querySelector('.cake');
	const photo = document.querySelector('.cake-photo');
	const slot = document.querySelector('.cake-photo-slot');

	if (!cake || !photo || !slot) {
		return;
	}

	let config = { ...FALLBACK };

	const preview =
		(window.__birthdayPreviewReady && (await window.__birthdayPreviewReady)) ||
		window.__BIRTHDAY_PREVIEW__;

	if (preview?.intro) {
		config = {
			...FALLBACK,
			age: preview.intro.age,
			photoUrl: preview.intro.photoUrl || FALLBACK.photoUrl,
			photoAlt: preview.intro.recipientName
				? `Ảnh của ${preview.intro.recipientName}`
				: FALLBACK.photoAlt,
			musicUrl: preview.intro.music?.url || FALLBACK.musicUrl,
		};
	} else {
		try {
			const serverData = await fetchBirthdayConfig();
			config = { ...FALLBACK, ...serverData };
		} catch {
			// Chưa có server hoặc lỗi mạng — dùng dữ liệu mặc định
		}
	}

	prepareBackgroundMusic(config, preview);
	applyAge(cake, config.age);

	if (!config.photoUrl) {
		slot.classList.add('is-empty');
		return;
	}

	try {
		await loadCakePhoto(photo, slot, config.photoUrl, config.photoAlt);
	} catch {
		slot.classList.add('is-error');
	}
}

initBirthdayCake();
initGlowButton();

const EXTINGUISH_DURATION_MS = 900;

function initGlowButton() {
	const button = document.querySelector('.glow-btn');
	const cake = document.querySelector('.cake');

	if (!button || !cake) {
		return;
	}

	let done = false;

	function setFlameLife(life) {
		cake.style.setProperty('--flame-life', String(Math.max(0, Math.min(1, life))));
	}

	function goToTextBirthday() {
		if (typeof window.showTextBirthday === 'function') {
			window.showTextBirthday();
		}
	}

	function startBackgroundMusic() {
		window.BirthdayMusic?.play();
	}

	function animateExtinguish(onDone) {
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		cake.classList.add('is-extinguishing');
		cake.classList.remove('is-extinguished');
		setFlameLife(1);

		if (reduceMotion) {
			setFlameLife(0);
			cake.classList.remove('is-extinguishing');
			cake.classList.add('is-extinguished');
			onDone();
			return;
		}

		const start = performance.now();

		function tick(now) {
			const progress = Math.min(1, (now - start) / EXTINGUISH_DURATION_MS);
			const eased = 1 - Math.pow(1 - progress, 2.2);
			setFlameLife(1 - eased);

			if (progress < 1) {
				requestAnimationFrame(tick);
				return;
			}

			setFlameLife(0);
			cake.classList.remove('is-extinguishing');
			cake.classList.add('is-extinguished');
			onDone();
		}

		requestAnimationFrame(tick);
	}

	function extinguishAndStart() {
		if (done) return;
		done = true;

		button.classList.add('is-holding');
		button.style.pointerEvents = 'none';
		startBackgroundMusic();

		animateExtinguish(() => {
			button.classList.remove('is-holding');
			goToTextBirthday();
		});
	}

	button.addEventListener('click', extinguishAndStart);
}
