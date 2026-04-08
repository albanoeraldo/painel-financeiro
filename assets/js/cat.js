(function initFixedDraggableCat() {
  const catBox = document.getElementById("dashboardCatBox");
  const cat = document.getElementById("dashboardCat");
  const catImg = document.getElementById("dashboardCatImg");
  const bubble = document.getElementById("dashboardCatBubble");
  const easterEgg = document.getElementById("catEasterEgg");
  const easterEggText = document.getElementById("catEasterEggText");

  if (!catBox || !cat || !catImg || !bubble) return;

  const FRAME_SIT = "assets/img/cat-frame-5.png";
  const FRAME_SLEEP = "assets/img/cat-frame-6.png";
  const FRAME_DRAG = "assets/img/cat-frame-drag.png";

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

  let currentState = "sit";
  let cycleTimer = null;
  let bubbleTimer = null;
  let easterEggTimer = null;
  let clickTimer = null;
  let clickCount = 0;

  let pointerDown = false;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function showCatEasterEgg() {
    if (!easterEgg || !easterEggText) return;

    const messages = [
      "miau supremo 😺",
      "você me achou!",
      "ronrom lendário ✨",
      "humano favorito detectado",
      "gatinho secreto desbloqueado"
    ];

    easterEggText.textContent =
      messages[Math.floor(Math.random() * messages.length)];

    easterEgg.classList.add("show");

    clearTimeout(easterEggTimer);
    easterEggTimer = setTimeout(() => {
      easterEgg.classList.remove("show");
    }, 1800);
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

  function setState(state) {
    currentState = state;
    cat.classList.remove("is-sleeping", "is-awake");

    if (state === "sit") {
      catImg.src = FRAME_SIT;
    }

    if (state === "sleep") {
      catImg.src = FRAME_SLEEP;
      cat.classList.add("is-sleeping");
    }
  }

  function startCycle() {
    clearInterval(cycleTimer);

    setState("sit");

    cycleTimer = setInterval(() => {
      if (dragging) return;

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

  cat.addEventListener("pointerdown", (e) => {
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
    if (!pointerDown) return;

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
    if (!pointerDown) return;

    pointerDown = false;

    if (dragging) {
      dragging = false;
      cat.classList.remove("dragging");

      const rect = catBox.getBoundingClientRect();
      savePosition(rect.left, rect.top);

      setState("sit");
      showBubble("Estou aqui 😺", 1200);
      startCycle();
      return;
    }

    if (!moved) {
      clickCount++;

      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 1800);

      wakeUpMessage();
      startCycle();

      if (clickCount >= 4) {
        clickCount = 0;
        showCatEasterEgg();
      }
    }
  });

  cat.addEventListener("pointercancel", () => {
    pointerDown = false;
    dragging = false;
    cat.classList.remove("dragging");
    setState("sit");
    startCycle();
  });

  window.addEventListener("resize", () => {
    const rect = catBox.getBoundingClientRect();
    applyPosition(rect.left, rect.top);
  });

  const initialPos = getSavedPosition();
  applyPosition(initialPos.x, initialPos.y);
  startCycle();
})();