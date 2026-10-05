/* 静止合成の座標計算。DOMや描画には依存しない。 */
(function (root) {
  'use strict';
  const bodies = {
    child: { label: '幼め / 2.5頭身目安', file: 'child_body.png', size: [626, 888], neck: [279, 15], foot: [305, 888], grip: [566, 239], height: 185, ratio: 2.5 },
    standard: { label: '標準 / 3頭身目安', file: 'standard_body.png', size: [695, 1102], neck: [301, 15], foot: [330, 1102], grip: [630, 307], height: 213, ratio: 3 },
    // 提供PNGは余白ごとそのまま使用。首・足元と有効全高のみ座標で指定する。
    providedChild: { label: '提供された子供素体 / 比率確認中', file: 'provided_child_body.png', size: [1254, 1254], bounds: [360, 321, 986, 1204], visibleHeight: 883, neck: [651, 332], foot: [650, 1204], grip: [912, 722], height: 175, ratio: 2.25, weaponReady: false }
  };
  const heads = {
    arshe: { label: 'アルシェ', file: 'arshe_head.png', size: [532, 453], join: [308, 440] },
    karima: { label: 'カリマ', file: 'karima_head.png', size: [455, 465], join: [282, 450] },
    gunter: { label: 'ギュンター', file: 'gunter_head.png', size: [490, 416], join: [279, 400] }
  };
  const sword = { file: 'orcus_sword.png', size: [1024, 1536], join: [512, 1260], height: 128, angle: 0.18 };
  // 元SDの有効輪郭。alpha>=24の外接矩形（元画像は変更しない）。
  const originals = {
    arshe: { file: 'arshe_original.png', size: [289, 512], bounds: [14, 14, 275, 498] },
    karima: { file: 'karima_original.png', size: [261, 512], bounds: [14, 14, 247, 498] },
    gunter: { file: 'gunter_original.png', size: [249, 512], bounds: [14, 14, 235, 498] }
  };
  const defaults = () => ({ scale: 1, x: 0, y: 0 });
  function fit(bodyKey, headKey, adjustment = defaults(), foot = [0, 0], zoom = 1) {
    const body = bodies[bodyKey], head = heads[headKey];
    if (!body || !head) throw new Error('未知の身体または頭です');
    const a = { ...defaults(), ...adjustment };
    if (![a.scale, a.x, a.y, zoom, ...foot].every(Number.isFinite) || a.scale <= 0 || zoom <= 0) throw new Error('調整値が不正です');
    const bs = body.height / (body.visibleHeight || body.size[1]) * zoom;
    const bp = [foot[0] - body.foot[0] * bs, foot[1] - body.foot[1] * bs];
    const neck = [bp[0] + body.neck[0] * bs, bp[1] + body.neck[1] * bs];
    const grip = [bp[0] + body.grip[0] * bs, bp[1] + body.grip[1] * bs];
    const hs = body.height / (body.ratio - 1) / head.size[1] * a.scale * zoom;
    const hp = [neck[0] + a.x * zoom - head.join[0] * hs, neck[1] + a.y * zoom - head.join[1] * hs];
    return { body: { position: bp, scale: bs }, head: { position: hp, scale: hs }, neck, grip, sword: { position: grip, scale: sword.height / sword.size[1] * zoom, angle: sword.angle } };
  }
  function characterHeight(bodyKey, headKey, adjustment = defaults()) {
    const initial = fit(bodyKey, headKey, adjustment), body = bodies[bodyKey];
    const bodyTop = initial.body.position[1] + (body.bounds ? body.bounds[1] * initial.body.scale : 0);
    return -Math.min(bodyTop, initial.head.position[1]);
  }
  function referenceFit(bodyKey, headKey, adjustment = defaults(), foot = [0, 0], zoom = 1) {
    // 調整中の頭ではなく初期合成の全高を基準にする。頭を変えても参照絵は動かない。
    const original = originals[headKey], a = { ...defaults(), ...adjustment };
    if (![a.scale, a.x, a.y, zoom, ...foot].every(Number.isFinite) || a.scale <= 0 || zoom <= 0) throw new Error('元SDの調整値が不正です');
    const baselineHeight = characterHeight(bodyKey, headKey);
    const [left, top, right, bottom] = original.bounds;
    const scale = baselineHeight / (bottom - top) * a.scale * zoom;
    return { position: [foot[0] + a.x * zoom - (left + right) / 2 * scale, foot[1] + a.y * zoom - bottom * scale], scale, baselineHeight };
  }
  const api = { bodies, heads, sword, originals, defaults, fit, referenceFit, characterHeight };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SharedBodyFit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
