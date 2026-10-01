import * as THREE from 'three';
import { AssetManager } from './AssetManager.js';

// B版（立体）: 回しても崩れないよう、形はコードで作り、石などは模様の絵を貼る。
// 炎だけは切り出した絵を、いつもカメラを向く板（Sprite）にする。
// どの部品も「足元の真ん中が原点・正面が +z」。置き場所と向きは MapScene が MapData から決める。

/** 部品で使う材質（MapData の materials から1回だけ作る） */
export function makeMaterials(M) {
  const stoneTex = AssetManager.stoneTexture({ ...M.stone, cols: 3, rows: 6, seed: 3 });
  const darkTex = AssetManager.stoneTexture({ ...M.stoneDark, cols: 2, rows: 5, seed: 7 });
  const tiled = (tex, rx, ry, extra = {}) => {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, ...extra });
  };
  return {
    tiled,
    stoneTex, darkTex,
    stone: tiled(stoneTex, 1, 1),
    stoneDark: tiled(darkTex, 1, 1),
    recess: new THREE.MeshStandardMaterial({ color: '#150f1d', roughness: 0.95 }),
    gold: new THREE.MeshStandardMaterial({ color: M.gold, roughness: 0.32, metalness: 0.85 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 0.45, metalness: 0.7 }),
    iron: new THREE.MeshStandardMaterial({ color: '#2a2230', roughness: 0.5, metalness: 0.6 }),
    cloth: new THREE.MeshStandardMaterial({ color: M.carpet.stairColor ?? M.carpet.color, roughness: 0.95 }),
    clothEdge: new THREE.MeshStandardMaterial({ color: M.carpet.edge, roughness: 0.45, metalness: 0.6 }),
    velvet: new THREE.MeshStandardMaterial({ color: '#4c1028', roughness: 0.85 }),
  };
}

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

/** とがったアーチの形（幅 w・高さ h・アーチが始まる高さ spring） */
export function pointedArch(w, h, spring) {
  const s = new THREE.Shape();
  const hw = w / 2;
  s.moveTo(-hw, 0);
  s.lineTo(-hw, spring);
  s.quadraticCurveTo(-hw, h * 0.97, 0, h);
  s.quadraticCurveTo(hw, h * 0.97, hw, spring);
  s.lineTo(hw, 0);
  s.closePath();
  return s;
}

function extrude(shape, depth, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  return new THREE.Mesh(g, mat);
}

/** アーチの枠（外の形から内の形をくりぬく） */
function archFrame(w, h, spring, border, depth, mat) {
  const outer = pointedArch(w, h, spring);
  const hole = new THREE.Path(pointedArch(w - border * 2, h - border * 1.2, spring).getPoints(24).map((p) => new THREE.Vector2(p.x, p.y + border * 0.2)));
  outer.holes.push(hole);
  return extrude(outer, depth, mat);
}

// ── 炎 ──

/** 炎（いつもカメラを向く板）と光のにじみ。flicker 用に userData.flames へ入れる */
export function flame(tex, color, size) {
  const g = new THREE.Group();
  const aspect = tex.image.width / tex.image.height;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.02 }));
  sp.center.set(0.5, 0.08);
  sp.scale.set(size * aspect, size, 1);
  sp.renderOrder = 25;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: AssetManager.glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
  glow.scale.setScalar(size * 2.2);
  glow.position.y = size * 0.35;
  glow.renderOrder = 30;
  g.add(sp, glow);
  g.userData.flame = { sprite: sp, glow, base: sp.scale.clone(), glowBase: size * 2.2, phase: Math.random() * 10 };
  return g;
}

// ── 部品 ──

/** 火鉢（松明・魔灯の台）: ろくろで回した形＋縁のとげ＋炎 */
export function brazier(mats, flameTex, color, height = 1.6) {
  const k = height / 1.6;
  const pts = [
    [0.0, 0], [0.3, 0], [0.3, 0.08], [0.2, 0.14], [0.13, 0.22], [0.1, 0.4], [0.12, 0.46], [0.09, 0.52],
    [0.08, 1.05], [0.12, 1.12], [0.2, 1.2], [0.3, 1.32], [0.34, 1.4], [0.31, 1.42], [0.2, 1.34], [0.0, 1.32],
  ].map(([r, y]) => new THREE.Vector2(r * k, y * k));
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mats.bronze);
  g.add(body);
  // 柄の金の帯
  for (const y of [0.46, 1.08]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.105 * k, 0.025 * k, 6, 16), mats.gold);
    band.rotation.x = Math.PI / 2; band.position.y = y * k;
    g.add(band);
  }
  // 縁のとげ（4本）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04 * k, 0.26 * k, 4), mats.gold);
    spike.position.set(Math.cos(a) * 0.3 * k, 1.5 * k, Math.sin(a) * 0.3 * k);
    spike.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(spike);
  }
  const f = flame(flameTex, color, 0.95 * k);
  f.position.y = 1.32 * k;
  g.add(f);
  return g;
}

/** 束ね柱（八角の柱＋まわりの細い柱4本・台座・柱頭・金の帯） */
export function clusteredPillar(mats, height) {
  const g = new THREE.Group();
  const shaftMat = mats.tiled(mats.darkTex, 1, 3);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, height, 8), shaftMat);
  shaft.position.y = height / 2;
  g.add(shaft);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, height, 8), shaftMat);
    c.position.set(Math.cos(a) * 0.3, height / 2, Math.sin(a) * 0.3);
    g.add(c);
  }
  g.add(box(0.95, 0.3, 0.95, mats.stoneDark, 0, 0.15, 0));
  g.add(box(0.85, 0.12, 0.85, mats.stone, 0, 0.36, 0));
  g.add(box(0.95, 0.28, 0.95, mats.stoneDark, 0, height - 0.14, 0));
  g.add(box(0.85, 0.1, 0.85, mats.stone, 0, height - 0.33, 0));
  for (const y of [0.44, height - 0.42]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.05, 8), mats.gold);
    band.position.y = y;
    g.add(band);
  }
  return g;
}

/**
 * 壁（正面が +z）: 石の壁・柱型・とがったアーチのくぼみ（中に燭台）。
 * opts.gap = [x0, x1] の範囲はくぼみを作らない（窓を入れる所）
 */
export function gothicWall(mats, flameTex, { length, height, thickness = 0.5, bay = 2, gap = null, sconces = true }) {
  const g = new THREE.Group();
  g.userData.flames = [];
  const wall = box(length, height, thickness, mats.tiled(mats.stoneTex, length / 2.5, height / 2.5), 0, height / 2, -thickness / 2);
  g.add(wall);
  // 足元の段と、上の金の帯
  g.add(box(length, 0.35, 0.25, mats.stone, 0, 0.175, 0.1));
  g.add(box(length, 0.06, 0.08, mats.gold, 0, 0.36, 0.2));
  g.add(box(length, 0.25, 0.3, mats.stoneDark, 0, height * 0.72, 0.1));
  g.add(box(length, 0.05, 0.06, mats.gold, 0, height * 0.72 + 0.14, 0.24));
  const n = Math.max(1, Math.round(length / bay));
  const step = length / n;
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + i * step;
    // 柱型（半分埋まった束ね柱）
    const p = box(0.5, height, 0.3, mats.tiled(mats.darkTex, 1, 3), x, height / 2, 0.08);
    g.add(p);
    g.add(box(0.56, 0.06, 0.36, mats.gold, x, 0.42, 0.08));
    g.add(box(0.56, 0.06, 0.36, mats.gold, x, height * 0.72 - 0.2, 0.08));
    if (i === n) break;
    const cx = x + step / 2;
    if (gap && cx > gap[0] && cx < gap[1]) continue;
    // 下の段のくぼみ（とがったアーチ）と燭台
    const w = step - 0.8;
    const arch = extrude(pointedArch(w, height * 0.5, height * 0.3), 0.04, mats.recess);
    arch.position.set(cx, 0.6, 0.0);
    g.add(arch);
    const frame = archFrame(w + 0.16, height * 0.5 + 0.1, height * 0.3, 0.09, 0.06, mats.gold);
    frame.position.set(cx, 0.56, 0.02);
    g.add(frame);
    // 上の段の小さなくぼみ
    const upper = extrude(pointedArch(w * 0.7, height * 0.18, height * 0.1), 0.04, mats.recess);
    upper.position.set(cx, height * 0.76, 0.0);
    g.add(upper);
    if (sconces && flameTex) {
      const y = 0.6 + height * 0.26;
      g.add(box(0.08, 0.3, 0.16, mats.iron, cx, y - 0.12, 0.1));
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.12, 8), mats.gold);
      cup.position.set(cx, y + 0.06, 0.18);
      g.add(cup);
      const f = flame(flameTex, '#ff8a3a', 0.55);
      f.position.set(cx, y + 0.1, 0.18);
      g.add(f);
      g.userData.flames.push(f);
    }
  }
  return g;
}

/** 窓の枠（とがったアーチ・金のふち・縦の桟）。窓の絵はこの中に MapScene が貼る */
export function windowFrame(mats, w, h) {
  const g = new THREE.Group();
  const frame = archFrame(w + 0.5, h + 0.35, h * 0.55, 0.28, 0.25, mats.stoneDark);
  g.add(frame);
  const edge = archFrame(w + 0.12, h + 0.08, h * 0.55, 0.07, 0.3, mats.gold);
  g.add(edge);
  // 窓台
  g.add(box(w + 0.8, 0.18, 0.5, mats.stone, 0, -0.09, 0.15));
  return g;
}

/**
 * 大階段: steps 段で rise まで上がる。幅 width・奥行き depth（手前の端が z=0、奥へ −z）。
 * 真ん中に絨毯（carpetWidth）、左右に下で外へ開く手すり
 */
export function grandStair(mats, { width, depth, steps, rise, carpetWidth }) {
  const g = new THREE.Group();
  const d = depth / steps, h = rise / steps;
  const stepMat = mats.tiled(mats.stoneTex, width / 2, 0.5);
  for (let i = 0; i < steps; i++) {
    const top = h * (i + 1);
    const z0 = -i * d;   // この段の手前の端
    g.add(box(width, top, d, stepMat, 0, top / 2, z0 - d / 2));
    g.add(box(width, 0.03, 0.04, mats.gold, 0, top - 0.015, z0 + 0.005));
    if (carpetWidth) {
      g.add(box(carpetWidth, 0.02, d, mats.cloth, 0, top + 0.01, z0 - d / 2));
      g.add(box(carpetWidth, h, 0.02, mats.cloth, 0, top - h / 2, z0 + 0.012));
      for (const s of [-1, 1]) g.add(box(0.06, 0.025, d, mats.clothEdge, s * (carpetWidth / 2 - 0.08), top + 0.013, z0 - d / 2));
    }
  }
  // 手すり（下で外へ開く曲線）
  for (const s of [-1, 1]) {
    const x = s * (width / 2 + 0.12);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + s * 1.0, 0.95, 0.9),
      new THREE.Vector3(x + s * 0.55, 0.98, 0.35),
      new THREE.Vector3(x + s * 0.1, 1.0 + rise * 0.15, -depth * 0.12),
      new THREE.Vector3(x, 1.0 + rise * 0.55, -depth * 0.55),
      new THREE.Vector3(x, 1.0 + rise, -depth),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.06, 6, false), mats.bronze));
    // 手すりの下の壁（腰壁）: 曲線に沿って細い柱を並べる
    for (let t = 0; t <= 1.0001; t += 1 / 14) {
      const p = curve.getPoint(t);
      const floorY = Math.max(0, Math.min(rise, -p.z / depth * rise));
      const len = p.y - floorY;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), mats.bronze);
      post.position.set(p.x, floorY + len / 2, p.z);
      g.add(post);
    }
    // 下の親柱（とげのついた柱）
    const start = curve.getPoint(0);
    g.add(box(0.3, 1.15, 0.3, mats.stoneDark, start.x, 0.575, start.z));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), mats.gold);
    cap.position.set(start.x, 1.38, start.z);
    g.add(cap);
  }
  return g;
}

/** 玉座（正面が +z）: 台座・座面・高い背もたれ（とがったアーチ）・横の柱ととげ・こうもりの翼・魔灯 */
export function throne(mats, flameTex, scale = 1) {
  const g = new THREE.Group();
  g.userData.flames = [];
  const metal = mats.iron;
  g.add(box(1.9, 0.22, 1.4, mats.stoneDark, 0, 0.11, 0));
  g.add(box(1.94, 0.04, 1.44, mats.gold, 0, 0.23, 0));
  g.add(box(1.25, 0.42, 0.85, metal, 0, 0.45, 0.05));
  g.add(box(1.1, 0.16, 0.8, mats.velvet, 0, 0.74, 0.08));
  // 背もたれ
  const back = extrude(pointedArch(1.15, 2.5, 1.5), 0.16, metal);
  back.position.set(0, 0.66, -0.42);
  g.add(back);
  const panel = extrude(pointedArch(0.85, 2.15, 1.3), 0.04, mats.velvet);
  panel.position.set(0, 0.82, -0.25);
  g.add(panel);
  const trim = archFrame(0.93, 2.22, 1.3, 0.05, 0.05, mats.gold);
  trim.position.set(0, 0.79, -0.24);
  g.add(trim);
  // 紋章（金のひし形と冠の先）
  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mats.gold);
  crest.scale.set(1, 1.4, 0.3);
  crest.position.set(0, 2.05, -0.2);
  g.add(crest);
  // 肘掛けと横の柱
  for (const s of [-1, 1]) {
    g.add(box(0.2, 0.14, 0.85, metal, s * 0.66, 1.02, 0.05));
    g.add(box(0.22, 2.9, 0.22, metal, s * 0.72, 1.45, -0.38));
    g.add(box(0.26, 0.05, 0.26, mats.gold, s * 0.72, 2.5, -0.38));
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 4), mats.gold);
    spike.position.set(s * 0.72, 3.15, -0.38);
    g.add(spike);
    // こうもりの翼（下の縁がぎざぎざの板）
    const w = new THREE.Shape();
    w.moveTo(0, 0);
    w.quadraticCurveTo(0.5, 0.55, 1.2, 0.75);
    w.lineTo(1.0, 0.35); w.lineTo(0.85, 0.48); w.lineTo(0.68, 0.18); w.lineTo(0.5, 0.3); w.lineTo(0.35, 0.02);
    w.closePath();
    const wing = extrude(w, 0.05, metal);
    wing.scale.set(s, 1, 1);
    wing.position.set(s * 0.78, 2.35, -0.4);
    wing.rotation.y = s * -0.35;
    g.add(wing);
    // 肘掛けの先の魔灯
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.12, 8), mats.gold);
    cup.position.set(s * 0.66, 1.15, 0.42);
    g.add(cup);
    const f = flame(flameTex, '#b46cff', 0.42);
    f.position.set(s * 0.66, 1.2, 0.42);
    g.add(f);
    g.userData.flames.push(f);
  }
  g.scale.setScalar(scale);
  return g;
}
