/* 静止合成の座標計算。DOMや描画には依存しない。 */
(function (root) {
  'use strict';
  const bodies = {
    child: { label: '幼め / 2.5頭身目安', file: 'child_body.png', size: [626, 888], neck: [279, 15], foot: [305, 888], grip: [566, 239], height: 185, ratio: 2.5 },
    standard: { label: '標準 / 3頭身目安', file: 'standard_body.png', size: [695, 1102], neck: [301, 15], foot: [330, 1102], grip: [630, 307], height: 213, ratio: 3 },
    // 提供PNGは余白ごとそのまま使用。首・足元と有効全高のみ座標で指定する。
    providedChild: { label: '提供された子供素体 / 比率確認中', file: 'provided_child_body.png', size: [1254, 1254], bounds: [360, 321, 986, 1204], visibleHeight: 883, neck: [651, 332], foot: [650, 1204], grip: [912, 722], height: 175, ratio: 2.25, weaponReady: false },
    lineA1: { label: '戦列下級・子供 A1 / 半袖・前面腰布', file: 'line_child_a1.png', size: [1254,1254], bounds: [359,321,986,1204], visibleHeight: 883, neck: [651,357], foot: [650,1204], grip: [912,722], height: 175, ratio: 2.25, weaponReady: false, extracted: true },
    lineA2: { label: '戦列下級・子供 A2 / 肘丈・左右腰布', file: 'line_child_a2.png', size: [1254,1254], bounds: [358,321,986,1204], visibleHeight: 883, neck: [651,357], foot: [650,1204], grip: [912,722], height: 175, ratio: 2.25, weaponReady: false, extracted: true },
    lineA3: { label: '戦列下級・子供 A3 / 長袖・尖り腰布', file: 'line_child_a3.png', size: [1254,1254], bounds: [359,321,985,1204], visibleHeight: 883, neck: [651,357], foot: [650,1204], grip: [912,722], height: 175, ratio: 2.25, weaponReady: false, extracted: true }
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
  // 原画画素の頭と、その切出し元。旧生成頭は旧身体の比較用に残す。
  const extractedHeads = {
    arshe: { label: 'アルシェ', file: 'arshe_extracted_head.png', size: [628,511], join: [379,507], sourceBodyHeight: 642 },
    karima: { label: 'カリマ', file: 'karima_extracted_head.png', size: [585,535], join: [334,523], sourceBodyHeight: 640 }
  };
  const extractedOriginals = {
    arshe: { file: 'arshe_source_sd.png', size: [1254,1254], bounds: [313,60,931,1207] },
    karima: { file: 'karima_source_sd.png', size: [1254,1254], bounds: [349,51,907,1211] }
  };
  // 兵種の衣装: 戦列下級 A1〜A3（前から登録・首マスクと配色つき）と、import_outfits.py が取り込んだ衣装（outfit-registry.js）。
  // 取り込んだ衣装は同じ子供素体から作っているので、首・足元・全高は A1 と同じ基準を使う（頭の合わせ方が衣装で変わらない）
  for (const key of ['lineA1', 'lineA2', 'lineA3']) Object.assign(bodies[key], { classId: '戦列下級', bodyType: 'child', variant: key.slice(4) });
  const registry = (typeof module !== 'undefined' ? (() => { try { return require('./outfit-registry.js'); } catch { return []; } })() : root.SharedBodyOutfits) || [];
  const anchors = { child: bodies.lineA1 };
  for (const o of registry) {
    const base = anchors[o.bodyType];
    if (!base || bodies[o.key]) continue;   // 大人の素体の基準はまだない
    bodies[o.key] = { label: o.label, file: o.file, size: o.size, bounds: o.bounds, visibleHeight: base.visibleHeight, neck: [...base.neck], foot: [...base.foot], grip: [...base.grip],
      height: base.height, ratio: base.ratio, weaponReady: false, extracted: true, classId: o.classId, bodyType: o.bodyType, variant: o.variant, source: o.source, sha256: o.sha256 };
  }
  const outfitKeys = Object.keys(bodies).filter(key => bodies[key].classId);
  const outfitsOfClass = classId => outfitKeys.filter(key => bodies[key].classId === classId);
  const headKeys = bodyKey => Object.keys(bodies[bodyKey]?.extracted ? extractedHeads : heads);
  const headAsset = (bodyKey, headKey) => (bodies[bodyKey]?.extracted ? extractedHeads : heads)[headKey];
  const originalAsset = (bodyKey, headKey) => (bodies[bodyKey]?.extracted ? extractedOriginals : originals)[headKey];
  const seamMasks = {
    arshe_extracted_head: { target: 'arshe_extracted_head.png', file: 'arshe_neck_keep.png', size: [628,511] },
    karima_extracted_head: { target: 'karima_extracted_head.png', file: 'karima_neck_keep.png', size: [585,535] },
    lineA1: { target: 'line_child_a1.png', file: 'line_a1_neck_keep.png', size: [1254,1254] },
    lineA2: { target: 'line_child_a2.png', file: 'line_a2_neck_keep.png', size: [1254,1254] },
    lineA3: { target: 'line_child_a3.png', file: 'line_a3_neck_keep.png', size: [1254,1254] }
  };
  const paletteMask = { file: 'line_a1_materials.png', size: [1254,1254], target: 'line_child_a1.png' };
  const allAssets = () => [...Object.values(bodies), ...Object.values(heads), ...Object.values(originals), ...Object.values(extractedHeads), ...Object.values(extractedOriginals), ...Object.values(seamMasks), paletteMask, sword];
  const defaults = () => ({ scale: 1, x: 0, y: 0 });
  function fit(bodyKey, headKey, adjustment = defaults(), foot = [0, 0], zoom = 1) {
    const body = bodies[bodyKey], head = headAsset(bodyKey, headKey);
    if (!body || !head) throw new Error('未知の身体または頭です');
    const a = { ...defaults(), ...adjustment };
    if (![a.scale, a.x, a.y, zoom, ...foot].every(Number.isFinite) || a.scale <= 0 || zoom <= 0) throw new Error('調整値が不正です');
    const bs = body.height / (body.visibleHeight || body.size[1]) * zoom;
    const bp = [foot[0] - body.foot[0] * bs, foot[1] - body.foot[1] * bs];
    const neck = [bp[0] + body.neck[0] * bs, bp[1] + body.neck[1] * bs];
    const grip = [bp[0] + body.grip[0] * bs, bp[1] + body.grip[1] * bs];
    // 新衣装は各キャラの元SDにおける頭／首から足の比率を初期基準にする。
    const hs = (head.sourceBodyHeight ? body.height / head.sourceBodyHeight : body.height / (body.ratio - 1) / head.size[1]) * a.scale * zoom;
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
    const original = originalAsset(bodyKey, headKey), a = { ...defaults(), ...adjustment };
    if (!original) throw new Error('未知の身体または元SDです');
    if (![a.scale, a.x, a.y, zoom, ...foot].every(Number.isFinite) || a.scale <= 0 || zoom <= 0) throw new Error('元SDの調整値が不正です');
    const baselineHeight = characterHeight(bodyKey, headKey);
    const [left, top, right, bottom] = original.bounds;
    const scale = baselineHeight / (bottom - top) * a.scale * zoom;
    return { position: [foot[0] + a.x * zoom - (left + right) / 2 * scale, foot[1] + a.y * zoom - bottom * scale], scale, baselineHeight };
  }
  const api = { bodies, heads, sword, originals, extractedHeads, extractedOriginals, seamMasks, paletteMask, outfitKeys, outfitsOfClass, registry, headKeys, headAsset, originalAsset, allAssets, defaults, fit, referenceFit, characterHeight };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SharedBodyFit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
