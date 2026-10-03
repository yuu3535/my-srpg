/* DOMに依存しない、実際の尖った針先と外側コマンドの位置計算。 */
(function (root) {
  'use strict';
  const commands = Object.freeze([
    Object.freeze({ id: 'map', label: 'マップ', detail: '章エリアの探索と、遭遇戦・章の戦闘への入口。' }),
    Object.freeze({ id: 'items', label: 'アイテム', detail: '所持品・装備を扱う専用画面へ。' }),
    Object.freeze({ id: 'friends', label: '仲間', detail: '能力・スキルを確認。編成は戦闘準備で行います。' }),
    Object.freeze({ id: 'support', label: '支援', detail: '支援の進み具合と、新しく発生した会話を確認。' })
  ]);
  const wrap = angle => ((angle + 180) % 360 + 360) % 360 - 180;
  const mod = (n, size) => ((n % size) + size) % size;
  // 1254pxの元画像でアルファ180以上の尖端を測定。曲がった炎の先には置かない。
  // 上、右上、下、左下の4本。残る右下・左上の2本は装飾のまま。
  const tips = Object.freeze([{ x: 629, y: 7 }, { x: 1184, y: 319 }, { x: 628, y: 1220 }, { x: 71, y: 934 }].map(tip => Object.freeze(tip)));
  const spriteScale = 439 / 1254;
  const baseAngles = tips.map(tip => Math.atan2(tip.y - 627, tip.x - 627) * 180 / Math.PI);
  const envelope = 225, labelWidth = 114, labelHeight = 44;
  function slot(angle, index, gap = 18, center = { x: 0, y: 195 }) {
    const tip = tips[index], rad = wrap(angle) * Math.PI / 180;
    const dx = (tip.x - 627) * spriteScale, dy = (tip.y - 627) * spriteScale;
    const tipX = center.x + dx * Math.cos(rad) - dy * Math.sin(rad);
    const tipY = center.y + dx * Math.sin(rad) + dy * Math.cos(rad);
    const rotation = wrap(angle + baseAngles[index]);
    // ラベル全体を針の外側へ。上下端では文字だけ内側に寄せ、接続線で対応を保つ。
    const y = Math.max(34, Math.min(356, tipY));
    const nearestY = Math.max(0, Math.abs(y - center.y) - labelHeight / 2);
    const outsideX = Math.sqrt(Math.max(0, envelope * envelope - nearestY * nearestY));
    const left = Math.max(tipX + gap, center.x + outsideX + gap);
    const x = left + labelWidth / 2;
    const rayRad = rotation * Math.PI / 180;
    const lineX = tipX + Math.cos(rayRad) * 8, lineY = tipY + Math.sin(rayRad) * 8;
    const endX = left - 7, endY = y;
    return { x, y, left, top: y - labelHeight / 2, width: labelWidth, height: labelHeight,
      tipX, tipY, rotation, counterRotation: -rotation, commandIndex: index,
      visible: tipX >= 10,
      line: { x: lineX, y: lineY, length: Math.hypot(endX - lineX, endY - lineY), rotation: Math.atan2(endY - lineY, endX - lineX) * 180 / Math.PI } };
  }
  function selected(angle) {
    let nearest = 0;
    for (let index = 1; index < tips.length; index++) if (Math.abs(wrap(angle + baseAngles[index])) < Math.abs(wrap(angle + baseAngles[nearest]))) nearest = index;
    return nearest;
  }
  function targetFor(angle, commandIndex) {
    if (!Number.isFinite(angle) || !Number.isInteger(commandIndex) || commandIndex < 0 || commandIndex >= commands.length) throw new RangeError('Invalid command target');
    return angle - wrap(angle + baseAngles[commandIndex]);
  }
  const snap = angle => targetFor(angle, selected(angle));
  const dragDelta = (previous, current) => wrap(current - previous);
  const api = { commands, tips, baseAngles, envelope, labelWidth, labelHeight, wrap, mod, slot, selected, targetFor, snap, dragDelta };
  if (typeof module !== 'undefined') module.exports = api;
  root.SolarOrbit = api;
})(typeof window !== 'undefined' ? window : globalThis);
