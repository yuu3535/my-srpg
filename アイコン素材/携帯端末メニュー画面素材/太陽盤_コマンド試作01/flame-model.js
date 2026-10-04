/* 炎の根元を札の右端基準で配置。サイズ変更と位置変更を分離する。 */
(function (root) {
  'use strict';
  const defaults = Object.freeze({ size: 69, opacity: 83, x: -18, y: 12 });
  const ranges = Object.freeze({ size: [24, 120], opacity: [0, 100], x: [-40, 40], y: [-40, 40] });
  // 元の金色を40度相当の基準とする。色相環は近似色、白い芯や陰影は素材から保つ。
  const colorDefaults = Object.freeze({
    alche: Object.freeze({ hue: 15, saturation: 102, brightness: 109 }),
    karima: Object.freeze({ hue: 217, saturation: 104, brightness: 100 })
  });
  const colorRanges = Object.freeze({ hue: [0, 360], saturation: [0, 200], brightness: [20, 160] });
  function normalizeColor(input = {}, character = 'alche') {
    if (!Object.hasOwn(colorDefaults, character)) throw new RangeError('炎のキャラが不正');
    const result = {};
    Object.keys(colorRanges).forEach(key => {
      const value = input[key];
      result[key] = typeof value === 'number' && Number.isFinite(value)
        ? Math.max(colorRanges[key][0], Math.min(colorRanges[key][1], value)) : colorDefaults[character][key];
    });
    return result;
  }
  function colorFilter(input) {
    const value = normalizeColor(input);
    if (value.hue === 40 && value.saturation === 100 && value.brightness === 100) return 'none';
    return 'hue-rotate(' + (value.hue - 40) + 'deg) saturate(' + value.saturation / 100 + ') brightness(' + value.brightness / 100 + ')';
  }
  // 上が0度、右が90度。中心クリックは現在値を維持し、不安定な方向へ飛ばさない。
  function hueAt(x, y, bounds) {
    const dx = x - bounds.left - bounds.width / 2, dy = y - bounds.top - bounds.height / 2;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 4) return null;
    return Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360) % 360;
  }
  const variants = Object.freeze({
    original: Object.freeze({ src: 'fx/command-flame-gold-v01.png', originX: .17, originY: .83 }),
    // 広い火種の中央を支点に、右側が札の下縁へ沿うよう合わせる。
    bottom: Object.freeze({ src: 'fx/command-flame-bottom-v02-candidate.png', originX: .57, originY: .78 })
  });
  function variant(key) {
    if (!Object.hasOwn(variants, key)) throw new RangeError('炎の素材が不正');
    return variants[key];
  }
  function normalize(input = {}) {
    const result = {};
    Object.keys(defaults).forEach(key => {
      const value = input[key];
      result[key] = typeof value === 'number' && Number.isFinite(value)
        ? Math.max(ranges[key][0], Math.min(ranges[key][1], value)) : defaults[key];
    });
    return result;
  }
  function placement(input, shape = 'original') {
    const value = normalize(input);
    const asset = variant(shape);
    return { size: value.size, opacity: value.opacity / 100,
      left: 'calc(100% + ' + (value.x - value.size * asset.originX) + 'px)',
      top: 'calc(50% + ' + (value.y - value.size * asset.originY) + 'px)',
      origin: (asset.originX * 100) + '% ' + (asset.originY * 100) + '%' };
  }
  const api = { defaults, ranges, colorDefaults, colorRanges, normalizeColor, colorFilter, hueAt, variants, variant, normalize, placement };
  if (typeof module !== 'undefined') module.exports = api;
  root.SolarFlame = api;
})(typeof window !== 'undefined' ? window : globalThis);
