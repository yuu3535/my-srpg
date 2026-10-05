(function attachSdMotion(globalScope) {
  "use strict";

  const NUMBER_FIELDS = ["x", "y", "rotation", "scale", "angle"];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function smoothstep(amount) {
    const t = clamp(amount, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function normalizeTime(clip, time) {
    if (clip.loop) {
      return ((time % clip.duration) + clip.duration) % clip.duration;
    }
    return clamp(time, 0, clip.duration);
  }

  function sampleKeys(keys, time) {
    if (!keys.length) {
      throw new Error("キーフレームがありません。");
    }

    const exact = keys.find((key) => Math.abs(time - key.t) < 1e-9);
    if (exact) return { ...exact };
    if (time <= keys[0].t) return { ...keys[0] };
    if (time >= keys[keys.length - 1].t) return { ...keys[keys.length - 1] };

    let left = keys[0];
    let right = keys[keys.length - 1];
    for (let index = 0; index < keys.length - 1; index += 1) {
      if (time >= keys[index].t && time <= keys[index + 1].t) {
        left = keys[index];
        right = keys[index + 1];
        break;
      }
    }

    const amount = smoothstep((time - left.t) / (right.t - left.t));
    const sampled = { ...left, t: time };
    NUMBER_FIELDS.forEach((field) => {
      if (typeof left[field] === "number" && typeof right[field] === "number") {
        sampled[field] = lerp(left[field], right[field], amount);
      }
    });
    sampled.layer = left.layer;
    return sampled;
  }

  function rotatePoint(x, y, degrees) {
    const radians = (degrees * Math.PI) / 180;
    return {
      x: x * Math.cos(radians) - y * Math.sin(radians),
      y: x * Math.sin(radians) + y * Math.cos(radians)
    };
  }

  function sampleMotion(definition, clipName, time, overrides) {
    const clip = definition.clips[clipName];
    if (!clip) throw new Error(`モーションが見つかりません: ${clipName}`);

    const localTime = normalizeTime(clip, time);
    const body = sampleKeys(clip.bodyKeys, localTime);
    const weapon = sampleKeys(clip.weaponKeys, localTime);
    const bodyScale = definition.body.referenceBodyHeight / definition.body.sourceSize.height;
    const foot = definition.body.anchors.foot;
    const handOverride = overrides && overrides.hand ? overrides.hand : { x: 0, y: 0 };
    const gripOverride = overrides && overrides.grip ? overrides.grip : { x: 0, y: 0 };
    const weaponScaleOverride = overrides && typeof overrides.weaponScale === "number"
      ? overrides.weaponScale
      : 1;

    const localHandX = (definition.body.anchors.hand.x + handOverride.x - foot.x)
      * bodyScale * body.scale;
    const localHandY = (definition.body.anchors.hand.y + handOverride.y - foot.y)
      * bodyScale * body.scale;
    const rotatedHand = rotatePoint(localHandX, localHandY, body.rotation);
    const footPosition = {
      x: definition.canvas.width / 2 + body.x,
      y: definition.canvas.groundY + body.y
    };

    const grip = {
      x: definition.weapon.grip.x + gripOverride.x,
      y: definition.weapon.grip.y + gripOverride.y
    };
    const pivot = { ...definition.weapon.pivot };
    const weaponScale = definition.weapon.defaultScale * weapon.scale * weaponScaleOverride;
    const pivotToGrip = rotatePoint(
      (grip.x - pivot.x) * weaponScale,
      (grip.y - pivot.y) * weaponScale,
      weapon.angle
    );
    const handPosition = {
      x: footPosition.x + rotatedHand.x + weapon.x,
      y: footPosition.y + rotatedHand.y + weapon.y
    };

    return {
      time: localTime,
      body,
      weapon,
      bodyScale: bodyScale * body.scale,
      footPosition,
      handPosition,
      grip,
      pivot,
      pivotPosition: {
        x: handPosition.x - pivotToGrip.x,
        y: handPosition.y - pivotToGrip.y
      },
      weaponScale,
      layer: weapon.layer || "front"
    };
  }

  const api = { clamp, lerp, normalizeTime, rotatePoint, sampleKeys, sampleMotion };
  globalScope.SdMotion = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
