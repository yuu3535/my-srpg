(function (root) {
  'use strict';
  // Corridor2DView.csの座標・反復・追従計算を、独立見本用に読み替える。
  const screen = Object.freeze({ width: 844, height: 390 });
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function position(data, playerX) {
    const player = clamp(playerX, 40, Math.max(40, data.length - 40));
    const camera = clamp(player - screen.width / 2, 0, Math.max(0, data.length - screen.width));
    return { player, camera, heroX: player - camera };
  }
  function walk(data, playerX, direction, seconds) {
    return position(data, playerX + clamp(direction, -1, 1) * 220 * clamp(seconds, 0, 0.1));
  }
  function tiles(layer, camera, width) {
    const step = Math.max(8, width - (layer.overlap || 0));
    const shift = layer.x - camera * layer.speed;
    let start = shift;
    if (layer.repeat) {
      start = shift % step;
      if (start > 0) start -= step;
      start -= Math.ceil(screen.width / step) * step;
    }
    const count = layer.repeat ? Math.ceil(screen.width * 3 / step) + 2 : 1;
    return Array.from({ length: count }, (_, index) => ({ x: start + index * step, mirrored: Boolean(layer.mirror && index % 2) }));
  }
  function dialogueLift(data, height) {
    // 世界の足元を変更せず、見本の会話中だけ画面全体を上へ寄せる。
    return Math.max(0, data.heroFeetY - (screen.height - height - 25 - 18));
  }
  const api = { screen, position, walk, tiles, dialogueLift };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CorridorStudy = api;
})(typeof window !== 'undefined' ? window : globalThis);
