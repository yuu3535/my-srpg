/* 全体配置と確認用の文言。本編の状態・時計・DOMには触れない。 */
(function (root) {
  'use strict';
  const resolution = Object.freeze({ width: 844, height: 390 });
  const boxes = Object.freeze({
    map: Object.freeze({ left: 330.243, top: 27.612, width: 300, height: 224 }),
    tip: Object.freeze({ left: 344.994, top: 336.504, width: 285, height: 28 }),
    time: Object.freeze({ left: 652.622, top: 10.003, width: 160, height: 64 }),
    fortune: Object.freeze({ left: 630.871, top: 75.997, width: 196, height: 294 })
  });
  const descriptions = Object.freeze({
    settings: '音量・会話速度・移動速度を調整する',
    items: '戦闘マップへ出撃する', friends: '探索マップへ進む',
    support: '仲間との支援会話を見る', save: 'ここまでの進行を保存する'
  });
  const mapModes = Object.freeze({ exploration: '探索2Dマップ', battle: '章の戦闘マップ', encounter: '遭遇戦マップ' });
  function description(id) { return Object.hasOwn(descriptions, id) ? descriptions[id] : 'コマンドを選んでください'; }
  function scaleFor(width) { return Number.isFinite(width) && width > 0 ? width / resolution.width : 1; }
  const schema = 'solar-menu-layout-settings-v01';
  function coordinate(value, fallback, max) {
    const number = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
    return Math.round(Math.max(0, Math.min(max, Number.isFinite(number) ? number : fallback)) * 1000) / 1000;
  }
  function normalizeTipHeight(value, fallback = boxes.tip.height) { return Math.max(22, coordinate(value, fallback, 48)); }
  function positions(source = {}, fallback = boxes, tipHeight = boxes.tip.height) {
    const result = {};
    for (const [id, box] of Object.entries(boxes)) {
      const candidate = source && Object.hasOwn(source, id) ? source[id] : null;
      result[id] = {
        left: coordinate(candidate && candidate.left, fallback[id].left, resolution.width - box.width),
        top: coordinate(candidate && candidate.top, fallback[id].top, resolution.height - (id === 'tip' ? normalizeTipHeight(tipHeight) : box.height))
      };
    }
    return result;
  }
  function settings(source, height) {
    const tipHeight = normalizeTipHeight(height);
    return { schema, referenceResolution: resolution, positionUnit: 'pixels', positions: positions(source, boxes, tipHeight), tipHeight };
  }
  const api = Object.freeze({ resolution, boxes, descriptions, mapModes, description, scaleFor, schema, positions, settings, normalizeTipHeight });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SolarMenuPreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
