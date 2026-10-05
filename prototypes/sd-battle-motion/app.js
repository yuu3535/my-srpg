(function runMotionPreview() {
  "use strict";

  const state = {
    definition: null,
    images: {},
    clipName: "idle",
    time: 0,
    playing: false,
    flipped: false,
    lastTimestamp: 0,
    overrides: {
      hand: { x: 0, y: 0 },
      grip: { x: 0, y: 0 },
      weaponScale: 1
    }
  };

  const elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`画像を読み込めません: ${path}`));
      image.src = path;
    });
  }

  function drawPart(context, image, matrix) {
    context.save();
    context.transform(...matrix);
    context.drawImage(image, 0, 0);
    context.restore();
  }

  function drawDebug(context, sample) {
    context.save();
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.strokeStyle = "rgba(208, 169, 104, 0.85)";
    context.beginPath();
    context.moveTo(28, state.definition.canvas.groundY + sample.body.y);
    context.lineTo(state.definition.canvas.width - 28, state.definition.canvas.groundY + sample.body.y);
    context.stroke();
    context.setLineDash([]);

    context.strokeStyle = "#8ebbad";
    context.beginPath();
    context.moveTo(sample.shoulderPosition.x, sample.shoulderPosition.y);
    context.lineTo(sample.elbowPosition.x, sample.elbowPosition.y);
    context.lineTo(sample.wristPosition.x, sample.wristPosition.y);
    context.lineTo(sample.handPosition.x, sample.handPosition.y);
    context.stroke();
    [
      { point: sample.footPosition, color: "#d0a968", radius: 4 },
      { point: sample.shoulderPosition, color: "#8ebbad", radius: 3 },
      { point: sample.elbowPosition, color: "#8ebbad", radius: 3 },
      { point: sample.wristPosition, color: "#8ebbad", radius: 3 },
      { point: sample.handPosition, color: "#5fb1a4", radius: 4 }
    ].forEach(({ point, color, radius }) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    });

    context.strokeStyle = "#edf2f4";
    context.beginPath();
    context.arc(sample.handPosition.x, sample.handPosition.y, 7, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function render() {
    if (!state.definition) return;
    const sample = window.SdMotion.sampleMotion(
      state.definition,
      state.clipName,
      state.time,
      state.overrides
    );
    const context = elements.canvas.getContext("2d");

    context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    context.save();
    const floor = context.createLinearGradient(40, 0, elements.canvas.width - 40, 0);
    floor.addColorStop(0, "rgba(208, 169, 104, 0)");
    floor.addColorStop(0.5, "rgba(208, 169, 104, 0.35)");
    floor.addColorStop(1, "rgba(208, 169, 104, 0)");
    context.strokeStyle = floor;
    context.beginPath();
    context.moveTo(40, state.definition.canvas.groundY);
    context.lineTo(elements.canvas.width - 40, state.definition.canvas.groundY);
    context.stroke();
    context.restore();
    context.save();
    if (state.flipped) {
      context.translate(elements.canvas.width, 0);
      context.scale(-1, 1);
    }

    sample.drawOrder.forEach((part) => drawPart(context, state.images[part], sample.matrices[part]));

    if (elements.debugOverlay.checked) drawDebug(context, sample);
    context.restore();
    updateReadouts(sample);
  }

  function updateReadouts(sample) {
    const clip = state.definition.clips[state.clipName];
    elements.clipLabel.textContent = clip.label;
    elements.timeLabel.textContent = `${sample.time.toFixed(3)} / ${clip.duration.toFixed(3)} s`;
    elements.bodyReadout.textContent = `x ${sample.body.x.toFixed(1)} / y ${sample.body.y.toFixed(1)} / ${sample.body.rotation.toFixed(1)}°`;
    elements.weaponReadout.textContent = `${sample.weapon.angle.toFixed(1)}° / ${sample.layer.toUpperCase()}`;
    elements.gripReadout.textContent = `${sample.gripError.toFixed(2)} px`;
    elements.armReadout.textContent = `肩 ${sample.arm.upperAngle.toFixed(0)}° / 肘 ${sample.arm.elbowBend.toFixed(0)}°`;
    elements.timeline.value = sample.time;

    document.querySelectorAll(".phase-chip").forEach((chip) => {
      const from = Number(chip.dataset.from);
      const to = Number(chip.dataset.to);
      chip.classList.toggle("is-current", sample.time >= from && sample.time <= to);
    });
  }

  function updatePhaseTrack() {
    const clip = state.definition.clips[state.clipName];
    elements.phaseTrack.replaceChildren();
    if (!clip.phases) return;
    clip.phases.forEach((phase) => {
      const chip = document.createElement("span");
      chip.className = "phase-chip";
      chip.textContent = phase.label;
      chip.dataset.from = phase.from;
      chip.dataset.to = phase.to;
      chip.style.flex = String(phase.to - phase.from);
      elements.phaseTrack.appendChild(chip);
    });
  }

  function setClip(clipName) {
    state.clipName = clipName;
    state.time = 0;
    elements.timeline.max = state.definition.clips[clipName].duration;
    document.querySelectorAll("[data-clip]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.clip === clipName);
    });
    updatePhaseTrack();
    render();
  }

  function setPlaying(playing) {
    state.playing = playing;
    state.lastTimestamp = performance.now();
    elements.playButton.textContent = playing ? "一時停止" : "再生";
    elements.playButton.classList.toggle("action-primary", !playing);
  }

  function animate(timestamp) {
    if (state.playing && state.definition) {
      const clip = state.definition.clips[state.clipName];
      const elapsed = Math.min((timestamp - state.lastTimestamp) / 1000, 0.08);
      state.time += elapsed * Number(elements.speed.value);
      if (!clip.loop && state.time >= clip.duration) {
        state.time = clip.duration;
        setPlaying(false);
      } else if (clip.loop) {
        state.time %= clip.duration;
      }
      state.lastTimestamp = timestamp;
      render();
    }
    requestAnimationFrame(animate);
  }

  function bindRange(inputId, outputId, onChange, format) {
    const input = byId(inputId);
    const output = byId(outputId);
    const apply = () => {
      const value = Number(input.value);
      output.value = format(value);
      onChange(value);
      render();
    };
    input.addEventListener("input", apply);
    apply();
    return input;
  }

  function bindControls() {
    document.querySelectorAll("[data-clip]").forEach((button) => {
      button.addEventListener("click", () => setClip(button.dataset.clip));
    });
    elements.playButton.addEventListener("click", () => {
      const clip = state.definition.clips[state.clipName];
      if (!state.playing && !clip.loop && state.time >= clip.duration) state.time = 0;
      setPlaying(!state.playing);
    });
    elements.stopButton.addEventListener("click", () => {
      setPlaying(false);
      state.time = 0;
      render();
    });
    elements.flipButton.addEventListener("click", () => {
      state.flipped = !state.flipped;
      elements.flipButton.setAttribute("aria-pressed", String(state.flipped));
      elements.flipButton.textContent = `左向き: ${state.flipped ? "ON" : "OFF"}`;
      render();
    });
    elements.timeline.addEventListener("input", () => {
      state.time = Number(elements.timeline.value);
      render();
    });
    elements.debugOverlay.addEventListener("change", render);

    bindRange("speed", "speedValue", () => {}, (value) => `${value.toFixed(2)}×`);
    bindRange("handX", "handXValue", (value) => { state.overrides.hand.x = value; }, signed);
    bindRange("handY", "handYValue", (value) => { state.overrides.hand.y = value; }, signed);
    bindRange("gripX", "gripXValue", (value) => { state.overrides.grip.x = value; }, signed);
    bindRange("gripY", "gripYValue", (value) => { state.overrides.grip.y = value; }, signed);
    bindRange("weaponScale", "weaponScaleValue", (value) => { state.overrides.weaponScale = value; }, (value) => `${value.toFixed(2)}×`);

    byId("resetButton").addEventListener("click", () => {
      ["handX", "handY", "gripX", "gripY"].forEach((id) => {
        byId(id).value = "0";
        byId(id).dispatchEvent(new Event("input"));
      });
      elements.weaponScale.value = "1";
      elements.weaponScale.dispatchEvent(new Event("input"));
    });
  }

  function signed(value) {
    return value >= 0 ? `+${value}` : String(value);
  }

  async function initialize() {
    [
      "canvas", "loadingState", "errorState", "errorMessage", "previewContent", "clipLabel",
      "timeLabel", "timeline", "phaseTrack", "bodyReadout", "weaponReadout", "gripReadout", "armReadout",
      "playButton", "stopButton", "flipButton", "speed", "debugOverlay", "weaponScale"
    ].forEach((id) => { elements[id] = byId(id === "canvas" ? "motionCanvas" : id); });

    try {
      const response = await fetch("motion-v2.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`motion-v2.json: HTTP ${response.status}`);
      state.definition = await response.json();
      elements.canvas.width = state.definition.canvas.width;
      elements.canvas.height = state.definition.canvas.height;
      const paths = { body: state.definition.body.asset, weapon: state.definition.weapon.asset };
      ["upperArm", "forearm", "hand"].forEach((name) => { paths[name] = state.definition.rig[name].asset; });
      await Promise.all(Object.entries(paths).map(async ([name, path]) => {
        state.images[name] = await loadImage(path);
      }));
      bindControls();
      setClip("idle");
      elements.loadingState.hidden = true;
      elements.previewContent.hidden = false;
      requestAnimationFrame(animate);
    } catch (error) {
      elements.loadingState.hidden = true;
      elements.errorState.hidden = false;
      elements.errorMessage.textContent = error.message;
    }
  }

  initialize();
})();
