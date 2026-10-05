/* 元RGBAを入力として派生画像を作る。DOM・原画像の書き換えには依存しない。 */
(function (root) {
  'use strict';
  function applyKeep(source, mask) {
    if (source.length !== mask.length || source.length % 4) throw new Error('接合マスクの寸法が不正です');
    const result = new Uint8ClampedArray(source);
    for (let i = 0; i < source.length; i += 4) if (mask[i] === 0) result[i + 3] = 0;
    return result;
  }
  const groups = [
    { id: 'cloth_tunic', label: '上衣', code: 1 },
    { id: 'cloth_trousers', label: 'ズボン', code: 2 },
    { id: 'cloth_waist', label: '腰布', code: 3 },
    { id: 'leather', label: '革装備', code: 4 },
    { id: 'armor', label: '防具', code: 5 }
  ];
  const paletteDefaults = () => Object.fromEntries(groups.map(group => [group.id, { enabled: false, hue: 145, saturation: 40, lightness: 0 }]));
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  function hueChannel(p, q, t) {
    t = (t + 1) % 1;
    return t < 1/6 ? p + (q-p)*6*t : t < 1/2 ? q : t < 2/3 ? p + (q-p)*(2/3-t)*6 : p;
  }
  function hslRgb(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360 / 360, s = clamp(saturation/100,0,1), l = clamp(lightness,0,1);
    if (!s) return [l*255,l*255,l*255];
    const q = l < .5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    return [hueChannel(p,q,h+1/3),hueChannel(p,q,h),hueChannel(p,q,h-1/3)].map(value => value*255);
  }
  function recolor(source, mask, palette) {
    if (source.length !== mask.length || source.length % 4) throw new Error('配色マスクの寸法が異なります');
    const settings = [null];
    for (const group of groups) {
      const setting = palette[group.id];
      if (!setting || ![setting.hue,setting.saturation,setting.lightness].every(Number.isFinite)) throw new Error('配色値が不正です');
      settings[group.code] = setting;
    }
    const result = new Uint8ClampedArray(source);
    for (let i=0; i<source.length; i+=4) {
      const setting = settings[mask[i]];
      if (!setting?.enabled) continue;
      // 元画素の明暗を使い、指定色相・彩度へ。alphaと保護画素はそのまま。
      const l = (Math.max(source[i],source[i+1],source[i+2])+Math.min(source[i],source[i+1],source[i+2]))/510;
      const rgb = hslRgb(setting.hue,setting.saturation,l+clamp(setting.lightness,-45,45)/100);
      result[i]=rgb[0]; result[i+1]=rgb[1]; result[i+2]=rgb[2];
    }
    return result;
  }
  function maskView(source, mask, code) {
    const result = new Uint8ClampedArray(source);
    for (let i=0;i<source.length;i+=4) {
      if (mask[i] !== code) continue;
      result[i]=47;result[i+1]=157;result[i+2]=121;
    }
    return result;
  }
  const api = { applyKeep, groups, paletteDefaults, hslRgb, recolor, maskView };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SharedBodyPixels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
