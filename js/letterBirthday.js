const elements = {
  screen: document.querySelector("#letter-birthday"),
  wrapper: document.querySelector(".cssletter"),
  envelope: document.querySelector(".envelope"),
  openButton: document.querySelector("#openEnvelope"),
  title: document.querySelector("#letterTitle"),
  content: document.querySelector("#letterContent"),
  signature: document.querySelector("#letterSignature"),
  continueButton: document.querySelector("#continueLetter"),
};

const endpoint =
  elements.screen?.dataset.letterEndpoint?.trim() ||
  document.body.dataset.letterEndpoint?.trim() ||
  "";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TYPE_SPEED = {
  title: 48,
  content: 28,
  signature: 42,
  pauseBetween: 320,
};

let hasShown = false;
let openBound = false;

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

const readFallbackLetter = () => ({
  title: trimText(elements.title?.textContent),
  content: trimText(elements.content?.textContent),
  signature: trimText(elements.signature?.textContent),
});

const normalizeText = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => trimText(String(item)))
      .filter(Boolean)
      .join("\n\n");
  }

  return trimText(value);
};

const normalizeLetterPayload = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  const source = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const content = normalizeText(
    source.content ?? source.body ?? source.message ?? source.text
  );

  if (!content) return null;

  return {
    title: normalizeText(source.title ?? source.heading ?? source.subject),
    content,
    signature: normalizeText(
      source.signature ?? source.author ?? source.from ?? source.sender
    ),
  };
};

const clearLetter = () => {
  if (elements.title) {
    elements.title.textContent = "";
    elements.title.hidden = true;
  }
  if (elements.content) {
    elements.content.textContent = "";
  }
  if (elements.signature) {
    elements.signature.textContent = "";
    elements.signature.hidden = true;
  }
  if (elements.continueButton) {
    elements.continueButton.classList.remove("is-visible");
    elements.continueButton.disabled = true;
    elements.continueButton.setAttribute("aria-hidden", "true");
  }
};

const showContinueButton = () => {
  if (!elements.continueButton) return;

  elements.continueButton.disabled = false;
  elements.continueButton.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    elements.continueButton.classList.add("is-visible");
  });
};

const setTypingTarget = (el, isTyping) => {
  if (!el) return;
  el.classList.toggle("is-typing", isTyping);
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const typeText = async (el, text, speed) => {
  if (!el || !text) return;

  el.hidden = false;
  el.textContent = "";
  setTypingTarget(el, true);

  for (let i = 1; i <= text.length; i += 1) {
    el.textContent = text.slice(0, i);

    const letterEl = elements.envelope?.querySelector(".reveal-letter");
    if (letterEl) {
      letterEl.scrollTop = letterEl.scrollHeight;
    }

    await wait(speed);
  }

  setTypingTarget(el, false);
};

const writeLetter = async (letter) => {
  if (prefersReducedMotion) {
    if (elements.title) {
      elements.title.textContent = letter.title;
      elements.title.hidden = !letter.title;
    }
    if (elements.content) {
      elements.content.textContent = letter.content;
    }
    if (elements.signature) {
      elements.signature.textContent = letter.signature;
      elements.signature.hidden = !letter.signature;
    }
    showContinueButton();
    return;
  }

  clearLetter();

  if (letter.title) {
    await typeText(elements.title, letter.title, TYPE_SPEED.title);
    await wait(TYPE_SPEED.pauseBetween);
  }

  if (letter.content) {
    await typeText(elements.content, letter.content, TYPE_SPEED.content);
    await wait(TYPE_SPEED.pauseBetween);
  }

  if (letter.signature) {
    await typeText(elements.signature, letter.signature, TYPE_SPEED.signature);
  }

  await wait(TYPE_SPEED.pauseBetween);
  showContinueButton();
};

const fetchLetterFromServer = async () => {
  const fallbackLetter = readFallbackLetter();

  if (!endpoint) return fallbackLetter;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return normalizeLetterPayload(payload) ?? fallbackLetter;
  } catch (error) {
    console.error("Failed to load letter content:", error);
    return fallbackLetter;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const letterPromise = (async () => {
  const preview =
    (window.__birthdayPreviewReady && (await window.__birthdayPreviewReady)) ||
    window.__BIRTHDAY_PREVIEW__;

  if (preview?.letter?.content) {
    const letter = normalizeLetterPayload(preview.letter) ?? readFallbackLetter();
    clearLetter();
    return letter;
  }

  const letter = await fetchLetterFromServer();
  clearLetter();
  return letter;
})();

function bindOpenEnvelope() {
  if (openBound || !elements.wrapper || !elements.envelope || !elements.openButton) {
    return;
  }

  openBound = true;

  elements.openButton.addEventListener(
    "click",
    async () => {
      const letter = await letterPromise;
      elements.envelope.classList.add("active");

      window.setTimeout(() => {
        elements.envelope.classList.add("extracting");
      }, 720);

      window.setTimeout(() => {
        elements.envelope.classList.add("lowered");
        writeLetter(letter);
      }, 1820);
    },
    { once: true }
  );
}

function showLetterBirthday() {
  if (!elements.screen) {
    return;
  }

  hasShown = true;
  bindOpenEnvelope();
  bindContinueButton();

  elements.screen.classList.add("is-active");
  elements.screen.setAttribute("aria-hidden", "false");
}

function goToImageBirthday() {
  if (elements.continueButton) {
    elements.continueButton.disabled = true;
    elements.continueButton.style.pointerEvents = "none";
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Hiện gallery trước rồi mới ẩn letter → tránh lộ màn phía dưới
  if (typeof window.showImageBirthday === "function") {
    window.showImageBirthday();
  }

  const hideLetterScreen = () => {
    if (elements.screen) {
      elements.screen.classList.remove("is-active");
      elements.screen.setAttribute("aria-hidden", "true");
    }
  };

  if (reduceMotion) {
    hideLetterScreen();
    return;
  }

  window.setTimeout(hideLetterScreen, 650);
}

let continueBound = false;

function bindContinueButton() {
  if (continueBound || !elements.continueButton) return;

  continueBound = true;
  elements.continueButton.addEventListener("click", goToImageBirthday);
}

window.showLetterBirthday = showLetterBirthday;

if (elements.screen?.classList.contains("is-active") || !elements.screen) {
  bindOpenEnvelope();
  bindContinueButton();
}
