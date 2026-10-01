import * as THREE from 'three';
import { AssetManager } from './AssetManager.js';

// SDキャラ1体: 足元を原点にした立てた板（いつもカメラを向く）と、足元の丸い影。
// moveTo でマスの真ん中へ、なめらかに動く（経路・移動力はまだ見ない）。
export class Unit {
  constructor(def, texture, grid) {
    this.def = def;
    this.grid = grid;
    this.gx = def.grid.x;
    this.gy = def.grid.y;

    const img = texture.image;
    const h = def.height ?? 1.4;
    const w = h * (img.width / img.height);
    this.root = new THREE.Group();
    this.root.name = `unit_${def.id}`;

    this.body = new THREE.Group();   // カメラを向く
    const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
    this.material = new THREE.MeshLambertMaterial({
      map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: def.selfLight ?? 0.62,
      transparent: true, alphaTest: 0.4, side: THREE.DoubleSide,
    });
    this.sprite = new THREE.Mesh(geo, this.material);
    this.sprite.userData.unit = this;
    this.body.add(this.sprite);
    this.root.add(this.body);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.42).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: AssetManager.shadowTexture(), transparent: true, depthWrite: false }));
    shadow.position.y = 0.012;
    shadow.renderOrder = 5;
    this.root.add(shadow);

    grid.gridToWorld(this.gx, this.gy, undefined, this.root.position);
    this.move = null;
    this.time = Math.random() * 10;
  }

  /** カメラの傾きの分だけ縦に伸ばす（描いた絵の比率のまま見せる） */
  setStretch(s) { this.sprite.scale.y = s; }

  /** マス（gx, gy）へ動く。duration は秒 */
  moveTo(gx, gy, duration = 0.3) {
    const from = this.root.position.clone();
    const to = this.grid.gridToWorld(gx, gy);
    if (Math.abs(to.x - from.x) > 0.01) this.sprite.scale.x = to.x < from.x ? -1 : 1;   // SDは右向きに描いてある
    this.move = { from, to, t: 0, duration: Math.max(0.2, Math.min(0.4, duration)) };
    this.gx = gx; this.gy = gy;
  }

  update(dt) {
    this.time += dt;
    // 待っているあいだ、少しだけ上下に息をする
    this.body.position.y = Math.sin(this.time * 2.4) * 0.012;
    if (!this.move) return;
    const m = this.move;
    m.t = Math.min(1, m.t + dt / m.duration);
    const k = 1 - Math.pow(1 - m.t, 3);   // 終わりに向かってゆっくり
    this.root.position.lerpVectors(m.from, m.to, k);
    // 段差をまたぐときは小さく弾む
    const hop = Math.abs(m.to.y - m.from.y) > 0.01 ? 0.25 : 0.06;
    this.root.position.y += Math.sin(m.t * Math.PI) * hop;
    if (m.t >= 1) this.move = null;
  }
}
