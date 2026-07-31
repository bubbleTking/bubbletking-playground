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
