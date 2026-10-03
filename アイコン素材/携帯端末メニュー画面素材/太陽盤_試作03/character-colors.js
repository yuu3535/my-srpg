/* 原作者確認の色違い方針。素材・ゲーム本編の正式採用ではなく検討用の設定。 */
(function (root) {
  'use strict';
  const palettes = {
    alche: {
      white: { original: false, hue: 233, saturation: 38, lightness: 0, shading: 33, gloss: 36 },
      gold: { original: true, hue: 38, saturation: 74, lightness: 49, shading: 60, gloss: 58 },
      ochre: { original: false, hue: 20, saturation: 80, lightness: 57, shading: 100, gloss: 100 }
    },
    karima: {
      white: { original: true, hue: 200, saturation: 35, lightness: 76, shading: 33, gloss: 25 },
      gold: { original: false, hue: 200, saturation: 10, lightness: 75, shading: 65, gloss: 25 },
      ochre: { original: false, hue: 214, saturation: 69, lightness: 55, shading: 100, gloss: 100 }
    }
  };
  const commonPlacement = {
    disk: { opacity: 50, size: 406, x: -40, y: 195, angle: 0 },
    rays: { opacity: 89, size: 439, x: 0, y: 195, angle: 0 }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const api = {
    palette(name) { return palettes[name] ? clone(palettes[name]) : null; },
    placement() { return clone(commonPlacement); }
  };
  if (typeof module !== 'undefined') module.exports = api;
  root.SolarCharacterColors = api;
})(typeof window !== 'undefined' ? window : globalThis);
