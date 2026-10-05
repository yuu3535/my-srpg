"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const motion = require("./motion-core.js");

const definition = JSON.parse(fs.readFileSync(path.join(__dirname, "motion.json"), "utf8"));

for (const clipName of Object.keys(definition.clips)) {
  const clip = definition.clips[clipName];
  for (let frame = 0; frame <= Math.ceil(clip.duration * definition.canvas.fps); frame += 1) {
    const time = Math.min(frame / definition.canvas.fps, clip.duration);
    const sample = motion.sampleMotion(definition, clipName, time, {
      hand: { x: 0, y: 0 },
      grip: { x: 0, y: 0 },
      weaponScale: 1
    });
    assert.ok(Number.isFinite(sample.handPosition.x));
    assert.ok(Number.isFinite(sample.handPosition.y));
    assert.ok(["front", "behind"].includes(sample.layer));
    assert.equal(sample.footPosition.x, definition.canvas.width / 2 + sample.body.x);
    assert.equal(sample.footPosition.y, definition.canvas.groundY + sample.body.y);
  }
}

const attackBeforeSwap = motion.sampleMotion(definition, "attack", 0.3, {});
const attackAfterSwap = motion.sampleMotion(definition, "attack", 0.43, {});
assert.equal(attackBeforeSwap.layer, "behind");
assert.equal(attackAfterSwap.layer, "front");

const adjustedGrip = motion.sampleMotion(definition, "attack", 0.43, {
  hand: { x: 0, y: 0 },
  grip: { x: 7, y: -4 },
  weaponScale: 1
});
const pivotToGrip = motion.rotatePoint(
  (adjustedGrip.grip.x - adjustedGrip.pivot.x) * adjustedGrip.weaponScale,
  (adjustedGrip.grip.y - adjustedGrip.pivot.y) * adjustedGrip.weaponScale,
  adjustedGrip.weapon.angle
);
assert.ok(Math.abs(adjustedGrip.pivotPosition.x + pivotToGrip.x - adjustedGrip.handPosition.x) < 1e-9);
assert.ok(Math.abs(adjustedGrip.pivotPosition.y + pivotToGrip.y - adjustedGrip.handPosition.y) < 1e-9);

console.log("motion-core: OK");
