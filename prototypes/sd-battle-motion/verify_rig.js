"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("./motion-core-v2.js");
const definition = JSON.parse(fs.readFileSync(path.join(__dirname, "motion-v2.json"), "utf8"));
let checks = 0;
function near(actual, expected, label) {
  assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-8, label);
  checks += 1;
}
const overrides = [undefined, { hand: { x: 17, y: -9 }, grip: { x: 80, y: -65 }, weaponScale: 1.25 }];
for (const [name, clip] of Object.entries(definition.clips)) {
  for (let i = 0; i <= 240; i += 1) {
    for (const override of overrides) {
      const s = core.sampleMotion(definition, name, clip.duration * i / 240, override);
      const t = (part, point) => core.transformPoint(s.matrices[part], point);
      near(t("body", definition.body.anchors.foot), s.footPosition, "足元固定");
      near(t("body", definition.body.anchors.shoulder), s.shoulderPosition, "肩位置");
      near(t("upperArm", definition.rig.upperArm.start), s.shoulderPosition, "上腕の肩接続");
      near(t("upperArm", definition.rig.upperArm.end), s.elbowPosition, "上腕の肘接続");
      near(t("forearm", definition.rig.forearm.start), s.elbowPosition, "前腕の肘接続");
      near(t("forearm", definition.rig.forearm.end), s.wristPosition, "前腕の手首接続");
      near(t("hand", definition.rig.hand.wrist), s.wristPosition, "手首接続");
      near(t("hand", s.handGrip), s.handPosition, "握り手接続");
      near(t("weapon", s.grip), s.handPosition, "剣のGrip一致");
      assert.ok(Object.values(s.matrices).flat().every(Number.isFinite), "行列が有限");
    }
  }
}
const start = core.sampleMotion(definition, "attack", 0);
const end = core.sampleMotion(definition, "attack", 1.05);
assert.deepEqual(end.matrices, start.matrices, "攻撃の終端が元の姿勢");
assert.deepEqual(core.sampleMotion(definition, "attack", 10).matrices, end.matrices, "非ループの終端固定");
assert.deepEqual(core.sampleMotion(definition, "idle", 1.5).matrices,
  core.sampleMotion(definition, "idle", 0).matrices, "待機ループ接続");
assert.equal(core.sampleMotion(definition, "attack", 0.30).layer, "behind");
assert.equal(core.sampleMotion(definition, "attack", 0.44).layer, "front");
const swing = core.sampleMotion(definition, "attack", 0.53);
assert.ok(Math.hypot(swing.wristPosition.x - start.wristPosition.x,
  swing.wristPosition.y - start.wristPosition.y) > 15, "剣だけでなく腕が移動");
assert.throws(() => core.sampleMotion(definition, "missing", 0), /モーションがありません/);
assert.throws(() => core.sampleKeys([], 0), /キーフレームがありません/);
console.log(`腕付きv2: ${checks}接続検証と復帰・ループ・描画順テスト成功`);
