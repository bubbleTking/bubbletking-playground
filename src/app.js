const dialog = document.querySelector("#demo-dialog");
const openButtons = [
  document.querySelector("#try-demo"),
  document.querySelector("#visual-demo"),
];
const closeButton = document.querySelector("#close-demo");
const playButton = document.querySelector("#play-toggle");
const resetButton = document.querySelector("#reset-demo");
const headphoneButton = document.querySelector("#headphone-toggle");
const volumeSlider = document.querySelector("#volume-slider");
const volumeOutput = document.querySelector("#volume-output");
const volumeReadout = document.querySelector("#demo-volume-readout");
const volumeWarning = document.querySelector("#volume-warning");
const timer = document.querySelector("#demo-timer");
const timerLabel = document.querySelector("#demo-timer-label");
const timerRing = document.querySelector("#timer-ring");
const stateLabel = document.querySelector("#demo-state");
const deviceLabel = document.querySelector("#demo-device");
const playerLabel = document.querySelector("#demo-player");
const modeLabel = document.querySelector("#demo-mode");

const listenSeconds = 12;
const breakSeconds = 6;
let phase = "listening";
let elapsed = 0;
let playing = false;
let headphones = true;
let intervalId = null;

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `00:${String(safe).padStart(2, "0")}`;
}

function setPlayButton() {
  playButton.innerHTML = playing
    ? '<span aria-hidden="true">Ⅱ</span> Pause music'
    : '<span aria-hidden="true">▶</span> Start music';
}

function updateDemo() {
  const total = phase === "listening" ? listenSeconds : breakSeconds;
  const remaining = total - elapsed;
  const progress = Math.min(1, elapsed / total);
  timer.textContent = formatTime(remaining);
  timerRing.style.setProperty("--progress", `${progress * 360}deg`);
  timerLabel.textContent = phase === "listening" ? "until break" : "break remaining";
  modeLabel.textContent = phase === "listening" ? "Listening" : "On break";

  if (!headphones) {
    stateLabel.textContent = "Waiting for headphones";
    deviceLabel.textContent = "Headphones disconnected";
    playerLabel.textContent = playing ? "Playing, not counted" : "Paused";
  } else if (phase === "break") {
    stateLabel.textContent = "Give your ears a moment";
    deviceLabel.textContent = "Automatic listening break";
    playerLabel.textContent = "Paused by Guardian";
  } else if (playing) {
    stateLabel.textContent = "Listening safely";
    deviceLabel.textContent = "Headphones connected";
    playerLabel.textContent = "Spotify playing";
  } else {
    stateLabel.textContent = "Ready to listen";
    deviceLabel.textContent = "Headphones connected";
    playerLabel.textContent = "Paused";
  }
  setPlayButton();
}

function tick() {
  if (!headphones || !playing || phase === "break") {
    if (phase === "break") {
      elapsed += 0.1;
    } else {
      updateDemo();
      return;
    }
  } else {
    elapsed += 0.1;
  }

  const total = phase === "listening" ? listenSeconds : breakSeconds;
  if (elapsed >= total) {
    elapsed = 0;
    if (phase === "listening") {
      phase = "break";
      playing = false;
    } else {
      phase = "listening";
      playing = true;
    }
  }
  updateDemo();
}

function ensureTicker() {
  if (!intervalId) {
    intervalId = window.setInterval(tick, 100);
  }
}

function resetDemo() {
  phase = "listening";
  elapsed = 0;
  playing = false;
  headphones = true;
  headphoneButton.classList.add("is-on");
  headphoneButton.setAttribute("aria-checked", "true");
  volumeSlider.value = "62";
  updateVolume();
  updateDemo();
}

function updateVolume() {
  const value = Number(volumeSlider.value);
  volumeOutput.textContent = `${value}%`;
  volumeReadout.textContent = `${value}%`;
  volumeWarning.hidden = value < 70;
}

function openDemo() {
  dialog.showModal();
  ensureTicker();
  updateDemo();
}

openButtons.forEach((button) => button.addEventListener("click", openDemo));
closeButton.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
playButton.addEventListener("click", () => {
  if (phase === "break") return;
  playing = !playing;
  updateDemo();
});
resetButton.addEventListener("click", resetDemo);
headphoneButton.addEventListener("click", () => {
  headphones = !headphones;
  headphoneButton.classList.toggle("is-on", headphones);
  headphoneButton.setAttribute("aria-checked", String(headphones));
  updateDemo();
});
volumeSlider.addEventListener("input", updateVolume);

resetDemo();

const presenceDialog = document.querySelector("#presence-dialog");
const presenceButton = document.querySelector("#try-presence");
const presenceClose = document.querySelector("#close-presence");
const clueButtons = [...document.querySelectorAll("[data-clue]")];
const clueCount = document.querySelector("#clue-count");
const connectCluesButton = document.querySelector("#connect-clues");
const caseResult = document.querySelector("#case-result");
const caseHeadline = document.querySelector("#case-headline");
const caseCopy = document.querySelector("#case-copy");
const foundClues = new Set();

const clueMessages = {
  ticket: "The ticket was issued after the victim boarded. Someone else bought it.",
  glass: "The second glass contains a sedative, but the victim never touched it.",
  witness: "The conductor moved the meeting time forward by exactly seventeen minutes.",
};

function updateCase() {
  clueCount.textContent = `${foundClues.size} / 3 clues`;
  connectCluesButton.disabled = foundClues.size < 3;
  if (foundClues.size === 0) {
    caseResult.textContent = "Choose evidence to build your theory.";
    return;
  }
  const latest = [...foundClues].at(-1);
  caseResult.textContent = clueMessages[latest];
}

function resetCase() {
  foundClues.clear();
  clueButtons.forEach((button) => {
    button.classList.remove("is-found");
    button.disabled = false;
  });
  caseHeadline.textContent = "A passenger is missing.";
  caseCopy.textContent =
    "The train cannot stop until morning. Everyone in this carriage remembers the evening differently.";
  connectCluesButton.textContent = "Connect the evidence";
  updateCase();
}

presenceButton.addEventListener("click", () => {
  resetCase();
  presenceDialog.showModal();
});

presenceClose.addEventListener("click", () => presenceDialog.close());
presenceDialog.addEventListener("click", (event) => {
  if (event.target === presenceDialog) presenceDialog.close();
});

clueButtons.forEach((button) => {
  button.addEventListener("click", () => {
    foundClues.add(button.dataset.clue);
    button.classList.add("is-found");
    button.disabled = true;
    updateCase();
  });
});

connectCluesButton.addEventListener("click", () => {
  caseHeadline.textContent = "The disappearance was staged.";
  caseCopy.textContent =
    "The ticket created a false passenger, the drugged glass framed a suspect, and the altered timeline opened a seventeen-minute escape window.";
  connectCluesButton.textContent = "Theory connected";
  connectCluesButton.disabled = true;
  caseResult.textContent =
    "Case preview complete. The full story continues across six interactive episodes.";
});
