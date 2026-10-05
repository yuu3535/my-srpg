"use strict";
const fs = require("node:fs");
const path = require("node:path");
const core = require("./motion-core-v2.js");
const definition = JSON.parse(fs.readFileSync(path.join(__dirname, "motion-v2.json"), "utf8"));
const clips = {};
for (const [name, clip] of Object.entries(definition.clips)) {
  const totalMs = Math.round(clip.duration * 1000);
  const count = Math.ceil(clip.duration * definition.canvas.fps);
  const frames = Array.from({ length: count }, (_, index) => {
    const fromMs = Math.round(index * totalMs / count);
    const toMs = Math.round((index + 1) * totalMs / count);
    const time = fromMs / 1000;
    return { index, time, durationMs: toMs - fromMs, sample: core.sampleMotion(definition, name, time) };
  });
  const checks = Array.from({ length: Math.ceil(clip.duration * 120) + 1 }, (_, i) =>
    core.sampleMotion(definition, name, Math.min(i / 120, clip.duration)));
  clips[name] = { durationMs: totalMs, frames, checks,
    endpoint: core.sampleMotion(definition, name, clip.duration), loop: clip.loop };
}
process.stdout.write(JSON.stringify({ definition, clips }));
