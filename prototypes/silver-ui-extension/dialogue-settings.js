(function (root) {
  'use strict';
  const storageKey = 'srpg.silver-dialogue.settings.v1';
  // 原作者が共有した値。2D回廊で試す仮設定であり、正式採用ではない。
  const corridorStorageKey = 'srpg.silver-dialogue.corridor.settings.v1';
  const corridorTrial = Object.freeze({ width: 796, height: 117, transparency: 20, radius: 20, panelColor: '#051029', borderColor: '#c4d1d8', textColor: '#e6e7ef', ornament: 'medium' });
  const portraitStorageKey = 'srpg.silver-dialogue.portraits.settings.v1';
  // 2026-10-03に原作者が共有した上置きの暫定基準。本編共通の固定仕様ではない。
  const portraitTrial = Object.freeze({ ...corridorTrial, width: 408, height: 100, panelColor: '#131d34', tailLeftOffset: 0, tailRightOffset: 0 });
  const portraitLimits = Object.freeze({ width: [320, 440], height: [100, 156], transparency: [0, 100], radius: [0, 24], tailLeftOffset: [0, 220], tailRightOffset: [0, 220] });
  const defaults = Object.freeze({ width: 796, height: 120, transparency: 4, radius: 0, panelColor: '#0b1822', borderColor: '#c4d1d8', textColor: '#f2f2ed', ornament: 'medium' });
  const limits = Object.freeze({ width: [480, 796], height: [100, 180], transparency: [0, 100], radius: [0, 24] });
  function normalize(input, presentation) {
    const activeLimits = presentation === 'portraits' ? portraitLimits : limits;
    const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const result = { ...(presentation === 'portraits' ? portraitTrial : defaults) };
    Object.keys(activeLimits).forEach(key => {
      if (typeof value[key] === 'number' && Number.isFinite(value[key])) result[key] = Math.round(Math.max(activeLimits[key][0], Math.min(activeLimits[key][1], value[key])));
    });
    ['panelColor', 'borderColor', 'textColor'].forEach(key => { if (typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key])) result[key] = value[key].toLowerCase(); });
    if (['small', 'medium', 'large'].includes(value.ornament)) result.ornament = value.ornament;
    return result;
  }
  function parse(text, presentation) {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || value.version !== 1 || !value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) throw new Error('この見本の設定JSON（version: 1）を貼り付けてください。');
    // 共有データの欠落・型違いは黙って初期値にせず、ユーザーへ知らせる。
    Object.keys(defaults).forEach(key => {
      if (!(key in value.settings)) throw new Error('設定の項目が足りません。コピーしたJSON全文を貼り付けてください。');
      if (key in limits && (typeof value.settings[key] !== 'number' || !Number.isFinite(value.settings[key]))) throw new Error('大きさと透過率には数値を指定してください。');
      if (key.endsWith('Color') && !/^#[0-9a-f]{6}$/i.test(value.settings[key])) throw new Error('色は # と6桁の色コードで指定してください。');
    });
    if (!['small', 'medium', 'large'].includes(value.settings.ornament)) throw new Error('飾りの大きさは small / medium / large のいずれかです。');
    // 旧JSONには尾の項目がない。未指定は0とし、旧設定をそのまま読み込める。
    if (presentation === 'portraits') {
      for (const key of ['tailLeftOffset', 'tailRightOffset']) {
        if (key in value.settings && (typeof value.settings[key] !== 'number' || !Number.isFinite(value.settings[key]))) throw new Error('尾の位置には数値を指定してください。');
      }
    }
    return normalize(value.settings, presentation);
  }
  function serialize(settings, presentation) { return JSON.stringify({ version: 1, prototype: 'silver-ui-extension/dialogue', ...(presentation === 'portraits' ? { presentation: 'portraits-top' } : {}), settings: normalize(settings, presentation) }, null, 2); }
  function rgba(hex, transparency) { const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)); return `rgba(${channels.join(',')},${(100 - transparency) / 100})`; }
  const api = { storageKey, corridorStorageKey, corridorTrial, portraitStorageKey, portraitTrial, portraitLimits, defaults, limits, normalize, parse, serialize, rgba };
  if (typeof module !== 'undefined') module.exports = api;
  else root.DialogueSettings = api;
})(typeof window !== 'undefined' ? window : globalThis);
