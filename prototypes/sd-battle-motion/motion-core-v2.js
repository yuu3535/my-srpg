(function attachSdMotion(scope) {
  "use strict";
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rotatePoint = (x, y, degrees) => {
    const r = degrees * Math.PI / 180;
    return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
  };
  const plus = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const normalizeTime = (clip, time) => clip.loop
    ? ((time % clip.duration) + clip.duration) % clip.duration
    : clamp(time, 0, clip.duration);

  function sampleKeys(keys, time) {
    if (!keys.length) throw new Error("キーフレームがありません。");
    const exact = keys.find((key) => Math.abs(time - key.t) < 1e-9);
    if (exact) return { ...exact };
    if (time <= keys[0].t) return { ...keys[0] };
    if (time >= keys.at(-1).t) return { ...keys.at(-1) };
    const index = keys.findIndex((key, i) => i < keys.length - 1 && time >= key.t && time < keys[i + 1].t);
    const left = keys[index];
    const right = keys[index + 1];
    const t = (time - left.t) / (right.t - left.t);
    const amount = t * t * (3 - 2 * t);
    const result = { ...left, t: time };
    Object.keys(left).forEach((field) => {
      if (field !== "t" && typeof left[field] === "number" && typeof right[field] === "number") {
        result[field] = lerp(left[field], right[field], amount);
      }
    });
    return result;
  }

  // Canvas と書き出しが同じアフィン行列を使う。画像のローカル座標→画面座標。
  function matrixAt(position, pivot, rotation, scale) {
    const r = rotation * Math.PI / 180;
    const a = Math.cos(r) * scale;
    const b = Math.sin(r) * scale;
    const c = -b;
    const d = a;
    return [a, b, c, d, position.x - a * pivot.x - c * pivot.y,
      position.y - b * pivot.x - d * pivot.y];
  }

  function transformPoint(matrix, point) {
    const [a, b, c, d, e, f] = matrix;
    return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
  }

  function makeSegment(part, origin, rotation, bodyScale) {
    const dx = part.end.x - part.start.x;
    const dy = part.end.y - part.start.y;
    const sourceAngle = Math.atan2(-dx, dy) * 180 / Math.PI;
    const scale = part.length * bodyScale / Math.hypot(dx, dy);
    const matrix = matrixAt(origin, part.start, rotation - sourceAngle, scale);
    return { matrix, end: transformPoint(matrix, part.end) };
  }

  function sampleMotion(definition, clipName, time, overrides = {}) {
    const clip = definition.clips[clipName];
    if (!clip) throw new Error(`モーションがありません: ${clipName}`);
    const localTime = normalizeTime(clip, time);
    const body = sampleKeys(clip.bodyKeys, localTime);
    const arm = sampleKeys(clip.armKeys, localTime);
    const bodyScale = definition.body.referenceBodyHeight / definition.body.sourceSize.height * body.scale;
    const footPosition = { x: definition.canvas.width / 2 + body.x, y: definition.canvas.groundY + body.y };
    const bodyMatrix = matrixAt(footPosition, definition.body.anchors.foot, body.rotation, bodyScale);
    const shoulderPosition = transformPoint(bodyMatrix, definition.body.anchors.shoulder);
    const upperRotation = body.rotation + arm.upperAngle;
    const forearmRotation = upperRotation + arm.elbowBend;
    const upper = makeSegment(definition.rig.upperArm, shoulderPosition, upperRotation, bodyScale);
    const forearm = makeSegment(definition.rig.forearm, upper.end, forearmRotation, bodyScale);
    const handMatrix = matrixAt(forearm.end, definition.rig.hand.wrist, forearmRotation,
      bodyScale * definition.rig.hand.scale);
    const handOffset = overrides.hand || { x: 0, y: 0 };
    const handGrip = {
      x: definition.rig.hand.grip.x + handOffset.x,
      y: definition.rig.hand.grip.y + handOffset.y
    };
    const handPosition = transformPoint(handMatrix, handGrip);
    const gripOffset = overrides.grip || { x: 0, y: 0 };
    const grip = plus(definition.weapon.grip, gripOffset);
    const pivot = { ...definition.weapon.pivot };
    const weaponScale = definition.weapon.defaultScale * (overrides.weaponScale ?? 1);
    const weaponAngle = forearmRotation + arm.wristAngle;
    const pivotToGrip = rotatePoint((grip.x - pivot.x) * weaponScale,
      (grip.y - pivot.y) * weaponScale, weaponAngle);
    const pivotPosition = { x: handPosition.x - pivotToGrip.x, y: handPosition.y - pivotToGrip.y };
    const weaponMatrix = matrixAt(pivotPosition, pivot, weaponAngle, weaponScale);
    const layer = arm.layer || "front";
    const matrices = { body: bodyMatrix, upperArm: upper.matrix, forearm: forearm.matrix,
      hand: handMatrix, weapon: weaponMatrix };
    const drawOrder = layer === "behind"
      ? ["weapon", "upperArm", "forearm", "hand", "body"]
      : ["body", "upperArm", "forearm", "weapon", "hand"];
    return { time: localTime, body, arm, bodyScale, matrices, drawOrder, layer,
      footPosition, shoulderPosition, elbowPosition: upper.end, wristPosition: forearm.end,
      handPosition, handGrip, grip, pivot, pivotPosition, weaponScale,
      weapon: { angle: weaponAngle },
      gripError: Math.hypot(transformPoint(weaponMatrix, grip).x - handPosition.x,
        transformPoint(weaponMatrix, grip).y - handPosition.y) };
  }

  const api = { clamp, lerp, rotatePoint, normalizeTime, sampleKeys, sampleMotion, matrixAt, transformPoint };
  scope.SdMotion = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
