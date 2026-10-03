/* 色・陰影の計算だけを持つ。元PNGとアルファは変更しない。 */
(function (root) {
  'use strict';
  const keys = ['white', 'gold', 'ochre'];
  const defaults = {
    white: { original: true, hue: 36, saturation: 8, lightness: 91, shading: 45, gloss: 10 },
    gold: { original: true, hue: 39, saturation: 58, lightness: 57, shading: 65, gloss: 20 },
    ochre: { original: true, hue: 40, saturation: 55, lightness: 64, shading: 45, gloss: 10 }
  };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  function normalize(input) {
    const result = {};
    keys.forEach(key => {
      const value = input && input[key] || {};
      result[key] = { ...defaults[key], original: typeof value.original === 'boolean' ? value.original : true };
      ['hue', 'saturation', 'lightness', 'shading', 'gloss'].forEach(field => {
        if (typeof value[field] === 'number' && Number.isFinite(value[field])) {
          result[key][field] = clamp(value[field], 0, field === 'hue' ? 360 : field === 'saturation' ? 80 : 100);
        }
      });
    });
    return result;
  }
  function rgb(profile) {
    const h = (profile.hue % 360) / 60, s = profile.saturation / 100, l = profile.lightness / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
    const raw = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return raw.map(value => value + m);
  }
  const n = value => Number(value.toFixed(6));
  function paint(profile, id) {
    if (profile.original) return `<feColorMatrix in="SourceGraphic" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1" result="${id}"/>`;
    const contrast = profile.shading / 100 * 1.7;
    const rows = rgb(profile).flatMap(color => [n(color * contrast * .2126), n(color * contrast * .7152), n(color * contrast * .0722), 0, n(color * (1 - contrast * .72))]);
    const strength = profile.gloss / 100 * .7;
    return `<feColorMatrix in="SourceGraphic" values="${rows.concat([0,0,0,0,1]).join(' ')}" result="${id}-base"/>
      <feColorMatrix in="SourceGraphic" values="1.063 3.576 .361 0 -3.8 1.063 3.576 .361 0 -3.8 1.063 3.576 .361 0 -3.8 0 0 0 0 1" result="${id}-highlight"/>
      <feComponentTransfer in="${id}-highlight" result="${id}-spec"><feFuncR type="gamma" amplitude="1" exponent="3" offset="0"/><feFuncG type="gamma" amplitude="1" exponent="3" offset="0"/><feFuncB type="gamma" amplitude="1" exponent="3" offset="0"/></feComponentTransfer>
      <feComposite in="${id}-base" in2="${id}-spec" operator="arithmetic" k1="${n(-strength)}" k2="1" k3="${n(strength)}" k4="0" result="${id}-lit"/>
      <feColorMatrix in="${id}-lit" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1" result="${id}"/>`;
  }
  function filters(input) {
    const p = normalize(input);
    const filter = (id, contents) => `<filter id="${id}" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">${contents}</filter>`;
    // R-Bの差で無彩色の面と琥珀の面を分ける。金枠は既に別PNG。
    const panes = `<feColorMatrix in="SourceGraphic" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 5 0 -5 0 -.3" result="warm-raw"/>
      <feComponentTransfer in="warm-raw" result="warm"><feFuncA type="table" tableValues="0 0 1 1"/></feComponentTransfer>
      <feComponentTransfer in="warm" result="cool"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
      ${paint(p.white, 'white-paint')}${paint(p.ochre, 'ochre-paint')}
      <feComposite in="white-paint" in2="cool" operator="in" result="white-only"/>
      <feComposite in="ochre-paint" in2="warm" operator="in" result="ochre-only"/>
      <feComposite in="white-only" in2="ochre-only" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="faces"/>
      <feComposite in="faces" in2="SourceGraphic" operator="in"/>`;
    const frame = `${paint(p.gold, 'gold-paint')}<feComposite in="gold-paint" in2="SourceGraphic" operator="in"/>`;
    return filter('solar-panes-material', panes) + filter('solar-frame-material', frame);
  }
  const api = { defaults, keys, normalize, rgb, filters };
  if (typeof module !== 'undefined') module.exports = api;
  root.SolarMaterials = api;
})(typeof window !== 'undefined' ? window : globalThis);
