/* 外周コマンドの静止配置。針とコマンドを同じ回転親へ入れない。 */
(function (root) {
  'use strict';
  const commands = [
    { id: 'map', label: 'マップ' }, { id: 'items', label: 'アイテム' },
    { id: 'friends', label: '仲間' }, { id: 'support', label: '支援' }
  ];
  const center = { x: 0, y: 195 }, envelope = 225, width = 128;
  const tip = { x: (1184 - 627) * 439 / 1254, y: (319 - 627) * 439 / 1254 };
  const tipAngle = Math.atan2(tip.y, tip.x) * 180 / Math.PI;
  function layout(gap = 18, scale = 1) {
    if (!Number.isFinite(gap) || gap < 12 || gap > 44) throw new RangeError('余白は12〜44');
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('倍率が不正');
    // 横画面の小さい表示でも、画面内で項目どうしの間隔を保つ。
    const height = Math.max(44, Math.min(80, 44 / scale));
    const step = height + 8, firstY = Math.max(59, height / 2 + 12);
    return commands.map((command, i) => {
      const y = firstY + i * step;
      const nearestY = Math.max(0, Math.abs(y - center.y) - height / 2);
      const left = Math.sqrt(envelope ** 2 - nearestY ** 2) + gap;
      const angle = Math.atan2(y - center.y, left - center.x) * 180 / Math.PI;
      const needleAngle = angle - tipAngle;
      const rad = needleAngle * Math.PI / 180;
      const tipX = tip.x * Math.cos(rad) - tip.y * Math.sin(rad);
      const tipY = center.y + tip.x * Math.sin(rad) + tip.y * Math.cos(rad);
      return { ...command, left, top: y - height / 2, y, width, height, angle, needleAngle, tipX, tipY };
    });
  }
  const api = { commands, center, envelope, layout };
  if (typeof module !== 'undefined') module.exports = api;
  root.SolarLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
