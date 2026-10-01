import * as THREE from 'three';
import { PX_PER_UNIT } from './MapData.js';

// マスの座標（gridX・gridY）と Three.js の座標（x・y・z）の変換、マスの高さ・通れるか、
// マウスで指すための見えない面、グリッドの線、ホバー・選択の印。
// 1マス ＝ 1 world unit ＝ 40px（PX_PER_UNIT）。マップの真ん中が原点。
export class GridSystem {
  constructor(map) {
    this.map = map;
    this.cols = map.cols;
    this.rows = map.rows;
    this.cells = [];
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const ch = map.heights[gy]?.[gx] ?? '.';
        const info = map.legend[ch] ?? map.legend['.'];
        const surface = map.surface?.[gy]?.[gx] ?? '.';
        this.cells.push({ gx, gy, ch, h: info.h ?? 0, blocked: !!info.blocked, info, carpet: surface === 'c' });
      }
    }
    this.group = new THREE.Group();
    this.group.name = 'Grid';
  }

  static pxToWorld(px) { return px / PX_PER_UNIT; }
  static worldToPx(u) { return u * PX_PER_UNIT; }

  inBounds(gx, gy) { return gx >= 0 && gy >= 0 && gx < this.cols && gy < this.rows; }
  cell(gx, gy) { return this.inBounds(gx, gy) ? this.cells[gy * this.cols + gx] : null; }
  heightAt(gx, gy) { return this.cell(Math.round(gx), Math.round(gy))?.h ?? 0; }
  isBlocked(gx, gy) { const c = this.cell(gx, gy); return !c || c.blocked; }
  block(gx, gy) { const c = this.cell(gx, gy); if (c) c.blocked = true; }

  /** マス → Three.js（マップの group の中の座標）。y を省くとそのマスの地面の高さ */
  gridToWorld(gx, gy, y, out = new THREE.Vector3()) {
    const h = y ?? (this.inBounds(Math.round(gx), Math.round(gy)) ? this.heightAt(gx, gy) : 0);
    return out.set(gx - this.cols / 2 + 0.5, h, gy - this.rows / 2 + 0.5);
  }

  /** Three.js（マップの group の中の座標）→ マス */
  worldToGrid(x, z) {
    return { gx: Math.floor(x + this.cols / 2), gy: Math.floor(z + this.rows / 2) };
  }

  /** マウスで指すための見えない面（マスごとに、その高さに1枚）。userData にマスを持つ */
  buildPickMeshes() {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    this.pickMeshes = [];
    for (const c of this.cells) {
      const m = new THREE.Mesh(geo, mat);
      this.gridToWorld(c.gx, c.gy, c.h + 0.001, m.position);
      m.userData.cell = c;
      m.name = `pick_${c.gx}_${c.gy}`;
      this.group.add(m);
      this.pickMeshes.push(m);
    }
    return this.pickMeshes;
  }

  /** マスの境の線（高さに合わせる）。既定は隠す */
  buildGridLines() {
    const pts = [];
    const e = 0.5, lift = 0.02;
    for (const c of this.cells) {
      const p = this.gridToWorld(c.gx, c.gy, c.h + lift);
      const corners = [[-e, -e], [e, -e], [e, e], [-e, e]];
      for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4];
        pts.push(p.x + a[0], p.y, p.z + a[1], p.x + b[0], p.y, p.z + b[1]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xe8c88a, transparent: true, opacity: 0.38, depthWrite: false }));
    this.lines.renderOrder = 20;
    this.lines.visible = false;
    this.group.add(this.lines);
    return this.lines;
  }

  setGridVisible(v) { if (this.lines) this.lines.visible = v; }
  get gridVisible() { return !!this.lines?.visible; }

  /** ホバー（うすい白）と選択（金）の印 */
  buildHighlights() {
    const make = (color, opacity) => {
      const g = new THREE.Group();
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity * 3), depthWrite: false }));
      g.add(fill, edge);
      g.renderOrder = 21;
      fill.renderOrder = edge.renderOrder = 21;
      g.visible = false;
      this.group.add(g);
      return g;
    };
    this.hover = make(0xf4ecff, 0.16);
    this.selected = make(0xe2b65a, 0.3);
    this.blockedMark = make(0xd0485a, 0.3);
  }

  showMark(mark, c) {
    if (!c) { mark.visible = false; return; }
    this.gridToWorld(c.gx, c.gy, c.h + 0.03, mark.position);
    mark.visible = true;
  }
}
