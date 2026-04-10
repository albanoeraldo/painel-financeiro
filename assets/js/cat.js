(function initFixedDraggableCat() {
  const catBox = document.getElementById("dashboardCatBox");
  const cat = document.getElementById("dashboardCat");
  const catImg = document.getElementById("dashboardCatImg");
  const bubble = document.getElementById("dashboardCatBubble");

  const helperPopup = document.getElementById("catHelperPopup");
  const helperText = document.getElementById("catHelperText");

  if (!catBox || !cat || !catImg || !bubble) return;

  const FRAME_SIT = "assets/img/cat-frame-5.png";
  const FRAME_SLEEP = "assets/img/cat-frame-6.png";
  const FRAME_DRAG = "assets/img/cat-frame-drag.png";
  const FRAME_CALC = "assets/img/cat-frame-calc.png";

  const POS_KEY = "dashboard_cat_position_v2";

  const awakeMessages = [
    "Miau! 😺",
    "Ronrom ✨",
    "Ei humano",
    "Cafuné?",
    "Você de novo 👀",
    "Mrrp!"
  ];

  const sleepyMessages = [
    "zzZ...",
    "Ronrom...",
    "Cochilando 💤"
  ];

  const calcMessages = [
    "Deixa eu calcular isso... 🧮",
    "Hum... essas contas não fecham 😼",
    "Pronto, agora ficou organizado! 📘"
  ];

  const helperMessages = [
    "Tá tudo bem por aí?",
    "Precisa de ajuda?",
    "Qualquer coisa estou aqui, vem brincar!"
  ];

  let currentState = "sit";
  let cycleTimer = null;
  let bubbleTimer = null;
  let clickTimer = null;
  let clickCount = 0;
  let calcMode = false;
  let calcTimeout = null;
  let helperTimer = null;
  let helperHideTimer = null;

  let pointerDown = false;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let ignoreNextClick = false;

  function isMobileCat() {
    return window.innerWidth <= 700;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function getDefaultPosition() {
    return {
      x: 65,
      y: window.innerHeight - 235
    };
  }

  function getSavedPosition() {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (!raw) return getDefaultPosition();

      const pos = JSON.parse(raw);
      if (typeof pos.x !== "number" || typeof pos.y !== "number") {
        return getDefaultPosition();
      }

      return pos;
    } catch {
      return getDefaultPosition();
    }
  }

  function savePosition(x, y) {
    localStorage.setItem(POS_KEY, JSON.stringify({ x, y }));
  }

  function updateCatFacing(catCenterX) {
    const main = document.querySelector(".main-content");
    if (!main) return;

    const rect = main.getBoundingClientRect();
    const middle = rect.left + rect.width / 2;

    if (catCenterX > middle) {
      cat.style.setProperty("--cat-face", "-1");
    } else {
      cat.style.setProperty("--cat-face", "1");
    }
  }

  function applyPosition(x, y) {
    if (isMobileCat()) {
      catBox.style.left = "";
      catBox.style.top = "";
      cat.style.setProperty("--cat-face", "1");
      return;
    }

    const maxX = window.innerWidth - catBox.offsetWidth - 10;
    const maxY = window.innerHeight - catBox.offsetHeight - 10;

    const finalX = clamp(x, 10, maxX);
    const finalY = clamp(y, 10, maxY);

    catBox.style.left = `${finalX}px`;
    catBox.style.top = `${finalY}px`;

    const catCenterX = finalX + (catBox.offsetWidth / 2);
    updateCatFacing(catCenterX);
  }

  function showBubble(text, duration = 1600) {
    bubble.textContent = text;
    cat.classList.add("show-bubble");

    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => {
      cat.classList.remove("show-bubble");
    }, duration);
  }

  function showHelperPopup() {
    if (!helperPopup || !helperText) return;

    helperText.textContent =
      helperMessages[Math.floor(Math.random() * helperMessages.length)];

    helperPopup.classList.add("show");

    clearTimeout(helperHideTimer);
    helperHideTimer = setTimeout(() => {
      helperPopup.classList.remove("show");
    }, 5000);
  }

  function startHelperTimer() {
    clearTimeout(helperTimer);

    helperTimer = setTimeout(() => {
      showHelperPopup();
    }, 10 * 60 * 1000); // 10 minutos
  }

  function setState(state) {
    currentState = state;
    cat.classList.remove("is-sleeping", "is-awake", "is-calculating");

    if (state === "sit") {
      catImg.src = FRAME_SIT;
    }

    if (state === "sleep") {
      catImg.src = FRAME_SLEEP;
      cat.classList.add("is-sleeping");
    }

    if (state === "calc") {
      catImg.src = FRAME_CALC;
      cat.classList.add("is-calculating");
    }
  }

  function startCycle() {
    clearInterval(cycleTimer);

    if (calcMode) return;

    setState("sit");

    cycleTimer = setInterval(() => {
      if (dragging || calcMode) return;

      if (currentState === "sit") {
        setState("sleep");

        if (Math.random() > 0.45) {
          showBubble(
            sleepyMessages[Math.floor(Math.random() * sleepyMessages.length)],
            1400
          );
        }
      } else {
        setState("sit");
      }
    }, 5000);
  }

  function wakeUpMessage() {
    if (calcMode) return;

    cat.classList.remove("is-awake");
    void cat.offsetWidth;
    cat.classList.add("is-awake");

    setState("sit");
    showBubble(
      awakeMessages[Math.floor(Math.random() * awakeMessages.length)],
      1800
    );

    setTimeout(() => {
      cat.classList.remove("is-awake");
    }, 700);
  }

  function triggerCalcMode() {
    calcMode = true;
    clearInterval(cycleTimer);
    clearTimeout(calcTimeout);

    setState("calc");
    showBubble(
      calcMessages[Math.floor(Math.random() * calcMessages.length)],
      2200
    );

    calcTimeout = setTimeout(() => {
      calcMode = false;
      setState("sit");
      startCycle();
    }, 3200);
  }

  function handleCatClick() {
    if (calcMode) return;

    clickCount++;

    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 1800);

    if (clickCount >= 4) {
      clickCount = 0;
      triggerCalcMode();
      return;
    }

    wakeUpMessage();
    startCycle();
  }

  cat.addEventListener("pointerdown", (e) => {
    if (isMobileCat() || calcMode) return;

    pointerDown = true;
    dragging = false;
    moved = false;

    startX = e.clientX;
    startY = e.clientY;

    const rect = catBox.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    cat.setPointerCapture(e.pointerId);
  });

  cat.addEventListener("pointermove", (e) => {
    if (!pointerDown || isMobileCat() || calcMode) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragging && Math.hypot(dx, dy) > 6) {
      dragging = true;
      moved = true;
      clearInterval(cycleTimer);
      cat.classList.add("dragging");
      cat.classList.remove("is-sleeping");
      catImg.src = FRAME_DRAG;
      cat.classList.remove("show-bubble");
    }

    if (!dragging) return;

    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;
    applyPosition(newX, newY);
  });

  cat.addEventListener("pointerup", () => {
    if (isMobileCat() || calcMode) return;
    if (!pointerDown) return;

    pointerDown = false;

    if (dragging) {
      dragging = false;
      ignoreNextClick = true;
      cat.classList.remove("dragging");

      const rect = catBox.getBoundingClientRect();
      savePosition(rect.left, rect.top);

      setState("sit");
      showBubble("Fiquei aqui 😺", 1200);
      startCycle();
    }
  });

  cat.addEventListener("pointercancel", () => {
    pointerDown = false;
    dragging = false;
    cat.classList.remove("dragging");

    if (!calcMode) {
      setState("sit");
      startCycle();
    }
  });

  cat.addEventListener("click", () => {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }

    if (dragging) return;

    handleCatClick();
  });

  window.addEventListener("resize", () => {
    if (isMobileCat()) {
      catBox.style.left = "";
      catBox.style.top = "";
      cat.style.setProperty("--cat-face", "1");
      return;
    }

    const rect = catBox.getBoundingClientRect();
    applyPosition(rect.left, rect.top);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(helperTimer);
      clearTimeout(helperHideTimer);
    } else {
      startHelperTimer();
    }
  });

  if (!isMobileCat()) {
    const initialPos = getSavedPosition();
    applyPosition(initialPos.x, initialPos.y);
  } else {
    cat.style.setProperty("--cat-face", "1");
  }

  startCycle();
  startHelperTimer();
})();