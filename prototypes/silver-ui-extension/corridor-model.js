(function (root) {
  'use strict';
  // Corridor2DView.csの座標・反復・追従計算を、独立見本用に読み替える。
  const screen = Object.freeze({ width: 844, height: 390 });
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function position(data, playerX) {
    const min = data.walkMin ?? 40;
    const limit = data.walkMax ?? -40;
    const max = Math.max(min, limit > 0 ? limit : data.length + Math.min(limit, -40));
    const margin = data.cameraMargin ?? 0;
    const player = clamp(playerX, min, max);
    const camera = clamp(player - screen.width / 2, margin, Math.max(margin, data.length - screen.width - margin));
    return { player, camera, heroX: player - camera };
  }
  // Unityと同じ基準幅で並べる。個別のdx/scaleで後続の位置・回廊の長さを変えない。
  function modules(layer, sizeOf) {
    let cursor = 0;
    const items = layer.modules.map((mod, index) => {
      const size = sizeOf(mod.file);
      if (!size || !(size.width > 0) || !(size.height > 0)) throw new Error(`回廊の素材の寸法を読めません: ${mod.file}`);
      const baseWidth = size.width * layer.height / size.height;
      if (index > 0) cursor -= mod.overlap || 0;
      const scale = mod.scale > 0 ? mod.scale : 1;
      const width = baseWidth * scale, height = layer.height * scale;
      const item = { file: mod.file, left: cursor + (mod.dx || 0) - (width - baseWidth) / 2, top: layer.bottom - height + (mod.dy || 0), width, height, front: Boolean(mod.front), shadeTop: Math.max(0, mod.shadeTop || 0) };
      cursor += baseWidth;
      return item;
    });
    return { items, length: Math.max(screen.width, cursor) };
  }
  function files(data) {
    return [...new Set(data.layers.flatMap(layer => layer.kind === 'modules' ? layer.modules.map(mod => mod.file) : [layer.file]))];
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
  const api = { screen, position, walk, tiles, dialogueLift, modules, files };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CorridorStudy = api;
})(typeof window !== 'undefined' ? window : globalThis);
