// マップの中身（地形・小物・光・キャラ・カメラ）。座標はできるだけここに書き、コードには直書きしない。
//
// 座標の約束:
//   grid: { x, y }  … マス（x＝左→右の列、y＝奥→手前の行）。小数も使える（7.5 ＝ 7列と8列の境）。
//   y               … 高さ（world unit）。省略すると、そのマスの地面の高さ。
//   height          … 立てた板の高さ（world unit）。幅は絵の縦横比から決まる。
//   scale           … height の代わり。絵のpx ÷ PX_PER_UNIT × scale。
//   layer           … 同じ位置に重なる平たい物の描く順（大きいほど上）。
//   billboard       … true でいつもカメラの方を向く（独立して立つ小物・キャラ）。
//   stretch         … 立てた板を、カメラの傾きの分だけ縦に伸ばして、描いた絵の比率のまま見せる（既定 true）。

export const PX_PER_UNIT = 40;   // 既存の2Dマップ素材は 1マス＝40px

export const THRONE_ROOM = {
  id: 'orcus_throne_room',
  name: 'オルクス魔王城・玉座の間',
  cols: 16,
  rows: 12,

  // 高さの層（1文字＝1マス）。legend で文字 → 高さ・種類
  heights: [
    '....DDDDDDDD....',
    '....DDDDDDDD....',
    '....r333333r....',
    '..P.r222222r.P..',
    '....r111111r....',
    '................',
    '..P..........P..',
    '................',
    '................',
    '..P..........P..',
    '................',
    '................',
  ],
  legend: {
    '.': { h: 0 },
    'P': { h: 0, blocked: true, pillar: true },
    'D': { h: 1.2, dais: true },
    // 階段は描いた絵（staircase）で見せる。箱は描かず、歩くときの高さだけ使う（hideBox）
    '3': { h: 0.9, step: true, hideBox: true },
    '2': { h: 0.6, step: true, hideBox: true },
    '1': { h: 0.3, step: true, hideBox: true },
    'r': { h: 0, blocked: true },   // 階段の絵の手すり（通れない）
  },
  // 床の表面の層（c ＝ 絨毯）
  surface: [
    '................',
    '......cccc......',
    '......cccc......',
    '......cccc......',
    '......cccc......',
    '......cccc......',
    '......cccc......',
    '......cccc......',
    '......cccc......',
    '......cccc......',
    '......cccc......',
    '......cccc......',
  ],

  materials: {
    floor: { base: '#3d3449', seam: '#130e19', vary: 0.12, gloss: 0.58 },
    stone: { base: '#3a3045', seam: '#1b1522' },
    stoneDark: { base: '#241c2e', seam: '#100b16' },
    gold: '#a8823e',
    carpet: { texture: 'assets/maps/06e_carpet_top.png', color: '#5c1634', edge: '#b0874a' },
  },

  architecture: {
    wallHeight: 13,
    sideWallHeight: 6,
    pillarHeight: 5.2,
    baseDepth: 0.9,
  },

  props: [
    // ── 奥の壁 ──
    { id: 'architecture', src: 'assets/props/01_background_architecture.png', grid: { x: 7.5, y: -0.47 }, y: 0, height: 10.5, layer: 0, stretch: false },
    { id: 'stained_glass', src: 'assets/props/02_stained_glass_window.png', grid: { x: 7.5, y: -0.42 }, y: 2.6, height: 6.8, layer: 1, selfLight: 0.95, stretch: false },
    { id: 'drape_left', src: 'assets/props/06c_drape_left.png', grid: { x: 5.1, y: -0.36 }, y: 3.4, height: 5.6, layer: 2, stretch: false },
    { id: 'drape_right', src: 'assets/props/06d_drape_right.png', grid: { x: 9.9, y: -0.36 }, y: 3.4, height: 5.6, layer: 2, stretch: false },

    // ── 玉座と魔灯 ──
    { id: 'throne', src: 'assets/props/03_throne.png', grid: { x: 7.5, y: 0.45 }, height: 4.4, blocks: [[7, 0], [8, 0]],
      glow: [{ color: '#b070ff', at: [-0.27, 0.62], size: 0.9 }, { color: '#b070ff', at: [0.27, 0.62], size: 0.9 }] },
    { id: 'lamp_dais_left', src: 'assets/props/05d_magic_lamp_purple_large.png', grid: { x: 4, y: 1 }, height: 1.7, billboard: true, shadow: 0.7, blocks: [[4, 1]],
      glow: [{ color: '#b46cff', at: [0, 0.86], size: 1.5 }] },
    { id: 'lamp_dais_right', src: 'assets/props/05d_magic_lamp_purple_large.png', grid: { x: 11, y: 1 }, height: 1.7, billboard: true, shadow: 0.7, blocks: [[11, 1]],
      glow: [{ color: '#b46cff', at: [0, 0.86], size: 1.5 }] },
    { id: 'lamp_stairs_left', src: 'assets/props/05e_magic_lamp_purple_medium.png', grid: { x: 3, y: 4 }, height: 1.45, billboard: true, shadow: 0.6, blocks: [[3, 4]],
      glow: [{ color: '#b46cff', at: [0, 0.84], size: 1.3 }] },
    { id: 'lamp_stairs_right', src: 'assets/props/05e_magic_lamp_purple_medium.png', grid: { x: 12, y: 4 }, height: 1.45, billboard: true, shadow: 0.6, blocks: [[12, 4]],
      glow: [{ color: '#b46cff', at: [0, 0.84], size: 1.3 }] },

    // ── 絨毯ぞいの松明 ──
    { id: 'torch_l1', src: 'assets/props/05a_torch_orange_large.png', grid: { x: 5, y: 6 }, height: 2.0, billboard: true, shadow: 0.9, blocks: [[5, 6]],
      glow: [{ color: '#ff8a3a', at: [0, 0.82], size: 2.0, floor: true }] },
    { id: 'torch_r1', src: 'assets/props/05a_torch_orange_large.png', grid: { x: 10, y: 6 }, height: 2.0, billboard: true, shadow: 0.9, blocks: [[10, 6]],
      glow: [{ color: '#ff8a3a', at: [0, 0.82], size: 2.0, floor: true }] },
    { id: 'torch_l2', src: 'assets/props/05a_torch_orange_large.png', grid: { x: 5, y: 9 }, height: 2.0, billboard: true, shadow: 0.9, blocks: [[5, 9]],
      glow: [{ color: '#ff8a3a', at: [0, 0.82], size: 2.0, floor: true }] },
    { id: 'torch_r2', src: 'assets/props/05a_torch_orange_large.png', grid: { x: 10, y: 9 }, height: 2.0, billboard: true, shadow: 0.9, blocks: [[10, 9]],
      glow: [{ color: '#ff8a3a', at: [0, 0.82], size: 2.0, floor: true }] },

    // ── 柱の旗（柱の手前の面に下げる） ──
    { id: 'banner_l1', src: 'assets/props/06a_banner_left.png', grid: { x: 2, y: 3.43 }, y: 1.0, height: 3.6, layer: 3 },
    { id: 'banner_r1', src: 'assets/props/06b_banner_right.png', grid: { x: 13, y: 3.43 }, y: 1.0, height: 3.6, layer: 3 },
    { id: 'banner_l2', src: 'assets/props/06a_banner_left.png', grid: { x: 2, y: 9.43 }, y: 1.0, height: 3.6, layer: 3 },
    { id: 'banner_r2', src: 'assets/props/06b_banner_right.png', grid: { x: 13, y: 9.43 }, y: 1.0, height: 3.6, layer: 3 },
    { id: 'torch_pillar_l', src: 'assets/props/05c_torch_orange_small.png', grid: { x: 2, y: 6.43 }, y: 1.6, height: 1.2, layer: 3,
      glow: [{ color: '#ff8a3a', at: [0, 0.8], size: 1.3 }] },
    { id: 'torch_pillar_r', src: 'assets/props/05c_torch_orange_small.png', grid: { x: 13, y: 6.43 }, y: 1.6, height: 1.2, layer: 3,
      glow: [{ color: '#ff8a3a', at: [0, 0.8], size: 1.3 }] },

    // ── 階段（描いた絵）: いつもカメラの正面を向け、奥行きの位置だけ階段の奥へ下げる（depthPush）。
    //    画面の上の位置は変わらず、階段を歩くキャラは絵より手前になる ──
    { id: 'staircase', src: 'assets/props/04_staircase.png', grid: { x: 7.5, y: 4.62 }, y: 0, height: 4.3, faceCamera: true, depthPush: 1.45, layer: -1 },
  ],

  // 光（数は少なく。松明は代表の2か所だけ）。group はデバッグの強さの調整の単位
  lights: [
    { type: 'hemi', sky: '#8c7cb8', ground: '#2a1c2a', intensity: 0.7, group: 'ambient' },
    { type: 'dir', color: '#8d7dff', intensity: 0.35, from: { x: 1, y: 14, z: -5 }, group: 'window' },
    { type: 'point', color: '#ff9446', grid: { x: 5, y: 7.5 }, y: 2.2, intensity: 14, distance: 8, group: 'torch' },
    { type: 'point', color: '#ff9446', grid: { x: 10, y: 7.5 }, y: 2.2, intensity: 14, distance: 8, group: 'torch' },
    { type: 'point', color: '#b26bff', grid: { x: 7.5, y: 1.4 }, y: 3.0, intensity: 14, distance: 8, group: 'magic' },
    { type: 'point', color: '#6c5cff', grid: { x: 7.5, y: 0.2 }, y: 5.0, intensity: 9, distance: 10, group: 'window' },
  ],

  units: [
    { id: 'arshe', name: 'アルシェ', src: 'assets/characters/young_arshe.png', grid: { x: 7, y: 10 }, height: 1.35 },
  ],

  // カメラ: 絵が正面から描かれているので、正面の斜め上から見下ろす（デバッグで変えられる）
  camera: {
    position: { x: 0, y: 14.5, z: 13.5 },
    target: { x: 0, y: 3.4, z: -0.4 },
    viewHeight: 18.5,   // 画面の縦に入る world unit（zoom 1 のとき）
    zoom: 1.0,
  },

  background: '#140d1c',

  // 画面の仕上げ: 左右（マップの端のほう）を紫のもやで沈め、少しぼかす（空気遠近）。四隅も暗く
  finish: { haze: 0.5, hazeColor: '#1d1229', blur: 2.2, start: 0.55, vignette: 0.35 },
};

// ── B版（立体）: 回しても崩れないよう、形はコードの立体。絵は平たい物（窓・旗・垂れ布・絨毯）と炎だけ ──
const FLAT_PROPS = ['stained_glass', 'drape_left', 'drape_right', 'banner_l1', 'banner_r1', 'banner_l2', 'banner_r2'];
const brazier = (id, x, y, flame, height, glow) => ({
  id, type: 'brazier', grid: { x, y }, flame, height, blocks: [[x, y]], shadow: 0.9,
  color: flame === 'purple' ? '#b46cff' : '#ff8a3a', floorGlow: glow,
});

export const THRONE_ROOM_B = {
  ...THRONE_ROOM,
  id: 'orcus_throne_room_b',
  name: 'オルクス魔王城・玉座の間（B 立体）',
  legend: {
    ...THRONE_ROOM.legend,
    // 階段は立体の部品（grandStair）で描く。歩く高さは段の上
    '3': { h: 1.2, step: true, hideBox: true },
    '2': { h: 0.8, step: true, hideBox: true },
    '1': { h: 0.4, step: true, hideBox: true },
  },
  architecture: { ...THRONE_ROOM.architecture, style: 'gothic', wallHeight: 10.5, sideWallHeight: 6, windowGap: [-2.6, 2.6] },
  flames: { orange: 'assets/props/flame_orange.png', purple: 'assets/props/flame_purple.png' },
  // 立体は絵と違って光と影を描き込んでいないので、全体の光を少し強く
  lights: THRONE_ROOM.lights.map((l) => (l.group === 'ambient' ? { ...l, intensity: 1.15 } : l)),
  materials: { ...THRONE_ROOM.materials, carpet: { ...THRONE_ROOM.materials.carpet, stairColor: '#3e0c1e' } },
  environmentIntensity: 0.22,
  props: THRONE_ROOM.props.filter((p) => FLAT_PROPS.includes(p.id)).map((p) => (p.id === 'stained_glass' ? { ...p, grid: { x: 7.5, y: -0.44 } } : p)),
  models: [
    { id: 'window_frame', type: 'windowFrame', grid: { x: 7.5, y: -0.66 }, y: 2.6, width: 3.95, height: 6.8 },
    { id: 'stairs', type: 'grandStair', grid: { x: 7.5, y: 4.5 }, width: 6, depth: 3, steps: 6, rise: 1.2, carpetWidth: 3.6 },
    { id: 'throne', type: 'throne', grid: { x: 7.5, y: 0.3 }, scale: 1.2, blocks: [[7, 0], [8, 0]] },
    brazier('lamp_dais_left', 4, 1, 'purple', 1.3),
    brazier('lamp_dais_right', 11, 1, 'purple', 1.3),
    brazier('lamp_stairs_left', 3, 4, 'purple', 1.2),
    brazier('lamp_stairs_right', 12, 4, 'purple', 1.2),
    brazier('torch_l1', 5, 6, 'orange', 1.6, true),
    brazier('torch_r1', 10, 6, 'orange', 1.6, true),
    brazier('torch_l2', 5, 9, 'orange', 1.6, true),
    brazier('torch_r2', 10, 9, 'orange', 1.6, true),
  ],
};
