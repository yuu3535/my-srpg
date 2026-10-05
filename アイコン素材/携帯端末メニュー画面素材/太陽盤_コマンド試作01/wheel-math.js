/* 見える右側の弧を循環する5コマンド。輪と針は別の角度を持つ。 */
(function (root) {
  'use strict';
  const commands = Object.freeze([
    // 内部IDは既存の選択・埋め込み通信との互換用。表示名と本編の遷移は別に扱う。
    { id: 'settings', label: '設定' }, { id: 'items', label: '出撃' },
    { id: 'friends', label: '探索' }, { id: 'support', label: '支援会話' },
    { id: 'save', label: 'セーブ' }
  ].map(Object.freeze));
  const tip = { x: (1184 - 627) * 439 / 1254, y: (319 - 627) * 439 / 1254 };
  const tipRadius = Math.hypot(tip.x, tip.y);
  const diamondAngle = -Math.atan2(tip.y, tip.x) * 180 / Math.PI;
  // 配置計算の基準値。作者が調整した初期値はキャラ別presetで上書きする。
  const defaults = Object.freeze({ gap: -12, size: 609, hue: 224, saturation: 24, lightness: 0, opacity: 40, bandHeight: 29 });
  function preset(character) {
    if (character !== 'alche' && character !== 'karima') throw new RangeError('キャラが不正');
    // アルシェの作者指定値を維持。カリマは「銀が主役、青がアクセント」の配色試作。
    const shared = { ...defaults, gap: -27, bandHeight: 31 };
    return character === 'alche' ? shared : { ...shared, hue: 214, lightness: 64 };
  }
  const ranges = { gap: [-40, 40], size: [440, 740], hue: [0, 360], saturation: [0, 80], lightness: [0, 100], opacity: [0, 100], bandHeight: [18, 38] };
  // 6本の実際の菱形先端。画像は完全な60度対称ではないため、停止角は測定値で補正。
  const diamondTips = [[1184, 319], [629, 7], [70, 319], [71, 934], [628, 1220], [1184, 934]];
  function needleFor(step) {
    if (!Number.isInteger(step)) throw new RangeError('針の段数が不正');
    const index = mod(step, 6), [x, y] = diamondTips[index];
    const angle = mod(-Math.atan2(y - 627, x - 627) * 180 / Math.PI, 360) + Math.floor(step / 6) * 360;
    return { angle, radius: Math.hypot(x - 627, y - 627) * 439 / 1254, index };
  }
  const idleFor = angle => Math.round((angle - 30) / 60) * 60;
  const mod = (value, period) => ((value % period) + period) % period;
  function normalize(input = {}) {
    const result = {};
    Object.keys(defaults).forEach(key => {
      const value = input[key];
      result[key] = typeof value === 'number' && Number.isFinite(value) ? Math.max(ranges[key][0], Math.min(ranges[key][1], value)) : defaults[key];
    });
    return result;
  }
  function geometry(gap = 0, scale = 1, size = defaults.size, bandHeight = defaults.bandHeight) {
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('倍率が不正');
    gap = normalize({ gap }).gap;
    const height = Math.max(44, Math.min(60, 44 / scale));
    // -12より内へ寄せる分は水平移動へ。弧を縮めて上下のタップ領域を詰めない。
    const radius = tipRadius + Math.max(defaults.gap, gap);
    // 静止時の最上段が画面をはみ出さないよう、弧の広がりを抑える。
    const pitch = Math.min(20, Math.asin((195 - 12 - height / 2) / radius) * 180 / Math.PI / 2);
    const normalized = normalize({ size, bandHeight });
    const outerRadius = Math.max(radius + 76, normalized.size * .48);
    // 5枚を上2・中央1・下2に配置。選択は太陽盤と同じ中心Yへ戻す。
    return { gap, inset: Math.min(0, gap - defaults.gap), height, radius, outerRadius, bandHeight: normalized.bandHeight, pitch, period: pitch * commands.length, focusAngle: 0, cardWidth: 112, textPadding: 16, selectedScale: 1.18 };
  }
  // 水平の細い帯だけを、同心円の間で切り抜く。輪郭は設定変更時に一度だけ計算。
  function bandClip(geometry) {
    const ys = Array.from({ length: 131 }, (_, i) => i * 3);
    const x = (r, y) => Math.sqrt(Math.max(0, r * r - (y - 195) ** 2));
    const points = ys.map(y => [x(geometry.outerRadius, y), y]).concat(ys.slice().reverse().map(y => [x(geometry.radius, y), y]));
    return 'polygon(' + points.map(([px, py]) => px.toFixed(3) + 'px ' + py + 'px').join(',') + ')';
  }
  const angleFor = (phase, index, geometry) => mod(index * geometry.pitch + phase + geometry.period / 2, geometry.period) - geometry.period / 2;
  function targetFor(phase, index, geometry) {
    if (!Number.isInteger(index) || index < 0 || index >= commands.length) throw new RangeError('項目が不正');
    const offset = mod(index * geometry.pitch + phase + geometry.period / 2, geometry.period) - geometry.period / 2;
    return phase - offset;
  }
  function slots(phase, geometry, selected = -1, needleRadius = tipRadius) {
    return commands.map((command, index) => {
      const angle = angleFor(phase, index, geometry), rad = angle * Math.PI / 180;
      const y = 195 + geometry.radius * Math.sin(rad);
      const innerX = geometry.radius * Math.cos(rad);
      const outerX = Math.sqrt(Math.max(0, geometry.outerRadius ** 2 - (y - 195) ** 2));
      // 文字は左右対称の余白へ。上下の札だけ必要な分を外へ逃がして針の輪郭を避ける。
      const nearestY = Math.max(0, Math.abs(y - 195) - 9);
      const rayEnvelope = Math.sqrt(Math.max(0, tipRadius ** 2 - nearestY ** 2));
      let left = Math.max(innerX, rayEnvelope - geometry.textPadding + 4) + geometry.inset;
      if (index === selected) {
        // 140幅の札のV字最奥はX21。拡大後の最奥を、今回向いている針の先端へ合わせる。
        const notchOffset = geometry.cardWidth / 2 * (1 - geometry.selectedScale) + 21 / 140 * geometry.cardWidth * geometry.selectedScale;
        const correction = needleRadius - tipRadius + .75 - (defaults.gap + notchOffset);
        const approach = Math.max(0, 1 - Math.abs(angle - geometry.focusAngle) / geometry.pitch);
        left += correction * approach * approach * (3 - 2 * approach);
      }
      const distanceToEdge = Math.min(angle + geometry.period / 2, geometry.period / 2 - angle);
      const opacity = Math.max(0, Math.min(1, distanceToEdge / (geometry.pitch * .4)));
      return { ...command, index, angle, left, innerX, outerX, y, top: y - geometry.height / 2, width: geometry.cardWidth, height: geometry.height, opacity };
    });
  }
  function spring(position, velocity, target, dt, stiffness = 180, damping = 26) {
    dt = Math.max(0, Math.min(dt, 1 / 30));
    velocity += ((target - position) * stiffness - damping * velocity) * dt;
    position += velocity * dt;
    const settled = Math.abs(target - position) < .025 && Math.abs(velocity) < .08;
    return { position: settled ? target : position, velocity: settled ? 0 : velocity, settled };
  }
  function settings(input, character) {
    return { schema: 'solar-command-wheel-settings-v02', referenceResolution: { width: 844, height: 390 }, character, wheel: normalize(input) };
  }
  const api = { commands, tipRadius, diamondAngle, defaults, preset, ranges, normalize, geometry, bandClip, slots, angleFor, targetFor, needleFor, idleFor, spring, settings };
  if (typeof module !== 'undefined') module.exports = api;
  root.SolarWheel = api;
})(typeof window !== 'undefined' ? window : globalThis);
