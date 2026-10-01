import * as THREE from 'three';
import { AssetManager } from './AssetManager.js';
import { GridSystem } from './GridSystem.js';
import { PX_PER_UNIT } from './MapData.js';
import { Unit } from './Unit.js';

// 2.5Dの箱庭: 床・壁・段・柱は簡単な3Dの箱、玉座・旗・松明などは透過PNGの板。
// 前後は Three.js の深さ（depth test）で決まる（板も3Dの位置に立っているので、柱の手前・奥が自然に入れ替わる）。
export class MapScene {
  constructor(container, map) {
    this.container = container;
    this.map = map;
    this.clock = new THREE.Clock();
    this.listeners = {};
    this.props = [];      // { def, mesh, glows }
    this.glows = [];      // { sprite, base, phase }
    this.lightGroups = {};  // group → [{ light, base }]
    this.units = [];

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(map.background);
    this.root = new THREE.Group();   // マップ全体（デバッグの「マップの回転」はこれを回す）
    this.root.name = 'MapRoot';
    this.scene.add(this.root);

    const cam = map.camera;
    this.viewHeight = cam.viewHeight;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.camera.position.set(cam.position.x, cam.position.y, cam.position.z);
    this.target = new THREE.Vector3(cam.target.x, cam.target.y, cam.target.z);
    this.camera.zoom = cam.zoom;
    this.camera.lookAt(this.target);

    this.grid = new GridSystem(map);
    this.assets = new AssetManager(this.renderer);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.resize();
    // 入れ物の大きさが変わったら合わせる（開発中は CSS があとから効くので、窓の resize だけでは足りない）
    new ResizeObserver(() => this.resize()).observe(container);
  }

  on(name, fn) { (this.listeners[name] ??= []).push(fn); }
  emit(name, data) { (this.listeners[name] ?? []).forEach((fn) => fn(data)); }

  async build() {
    this.buildArchitecture();
    this.root.add(this.grid.group);
    this.grid.buildPickMeshes();
    this.grid.buildGridLines();
    this.grid.buildHighlights();
    await Promise.all([this.buildCarpet(), ...this.map.props.map((d) => this.addProp(d))]);
    this.buildLights();
    for (const u of this.map.units) await this.addUnit(u);
    this.bindInput();
    this.applyCamera();
  }

  // ── 3Dの箱（床・壁・段・柱） ──

  buildArchitecture() {
    const { cols, rows, materials: M, architecture: A } = this.map;
    const g = this.grid;

    const stoneTex = AssetManager.stoneTexture({ ...M.stone, cols: 3, rows: 6, seed: 3 });
    const darkTex = AssetManager.stoneTexture({ ...M.stoneDark, cols: 2, rows: 5, seed: 7 });
    const stone = (repeatX, repeatY, tex = stoneTex) => {
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(repeatX, repeatY);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.82, metalness: 0.0 });
    };
    const gold = new THREE.MeshStandardMaterial({ color: M.gold, roughness: 0.4, metalness: 0.7 });

    // 床（磨いた黒紫の石畳。少しつやを出して、灯りが映りこむように）
    const floorTex = AssetManager.stoneTexture({ ...M.floor, cols: 2, rows: 2, size: 128, offsetRows: false, seed: 11 });
    floorTex.repeat.set(cols / 2, rows / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols, rows).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: M.floor.gloss, metalness: 0.15 }));
    floor.name = 'Floor';
    this.root.add(floor);

    // 床の下の台（箱庭の厚み）と、手前のふちの金の線
    const base = new THREE.Mesh(new THREE.BoxGeometry(cols + 1, A.baseDepth, rows + 0.6), stone(6, 1, darkTex));
    base.position.set(0, -A.baseDepth / 2 - 0.002, 0);
    this.root.add(base);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(cols + 1.02, 0.06, 0.06), gold);
    trim.position.set(0, -0.03, rows / 2 + 0.3);
    this.root.add(trim);

    // 奥の壁と左右の壁
    const back = new THREE.Mesh(new THREE.BoxGeometry(cols + 1, A.wallHeight, 0.5), stone(6, 5, darkTex));
    back.position.set(0, A.wallHeight / 2, -rows / 2 - 0.25);
    back.name = 'BackWall';
    this.root.add(back);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, A.sideWallHeight, rows), stone(5, 3, darkTex));
      side.position.set(s * (cols / 2 + 0.25), A.sideWallHeight / 2, 0);
      side.name = s < 0 ? 'WallLeft' : 'WallRight';
      this.root.add(side);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, rows + 0.1), gold);
      cap.position.set(side.position.x, A.sideWallHeight, 0);
      this.root.add(cap);
    }

    // 段（玉座台・階段）: 高さのあるマスごとに箱。上の面に絨毯の帯がのる
    const stepMat = stone(1, 1);
    for (const c of g.cells) {
      if (c.h <= 0) continue;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, c.h, 1), stepMat);
      g.gridToWorld(c.gx, c.gy, c.h / 2, box.position);
      box.name = `step_${c.gx}_${c.gy}`;
      this.root.add(box);
    }
    // 段の手前のふち（金の細い線）
    for (const c of g.cells) {
      if (c.h <= 0) continue;
      const front = g.cell(c.gx, c.gy + 1);
      if (front && front.h >= c.h) continue;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 0.04), gold);
      g.gridToWorld(c.gx, c.gy, c.h - 0.02, edge.position);
      edge.position.z += 0.5;
      this.root.add(edge);
    }

    // 柱（黒紫の石・金の帯）
    const pillarMat = stone(1, 3, darkTex);
    for (const c of g.cells) {
      if (!c.info.pillar) continue;
      const p = new THREE.Group();
      g.gridToWorld(c.gx, c.gy, 0, p.position);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.72, A.pillarHeight, 0.72), pillarMat);
      shaft.position.y = A.pillarHeight / 2;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.35, 0.92), pillarMat);
      foot.position.y = 0.175;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.3, 0.92), pillarMat);
      head.position.y = A.pillarHeight - 0.15;
      p.add(shaft, foot, head);
      for (const y of [0.37, A.pillarHeight - 0.32]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.8), gold);
        band.position.y = y;
        p.add(band);
      }
      p.name = `pillar_${c.gx}_${c.gy}`;
      this.root.add(p);
    }
  }

  /** 絨毯: 床の上は1枚の絵（真上から見た形に引き伸ばしたもの）、段の上は帯と蹴上げ */
  async buildCarpet() {
    const g = this.grid, M = this.map.materials;
    const flat = g.cells.filter((c) => c.carpet && c.h === 0);
    const raised = g.cells.filter((c) => c.carpet && c.h > 0);
    if (flat.length) {
      const minX = Math.min(...flat.map((c) => c.gx)), maxX = Math.max(...flat.map((c) => c.gx));
      const minY = Math.min(...flat.map((c) => c.gy)), maxY = Math.max(...flat.map((c) => c.gy));
      const tex = await this.assets.texture(M.carpet.texture);
      const w = maxX - minX + 1, d = maxY - minY + 1;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
      g.gridToWorld((minX + maxX) / 2, (minY + maxY) / 2, 0.006, mesh.position);
      mesh.name = 'Carpet';
      this.root.add(mesh);
    }
    const cloth = new THREE.MeshStandardMaterial({ color: M.carpet.color, roughness: 0.95 });
    const edge = new THREE.MeshStandardMaterial({ color: M.carpet.edge, roughness: 0.5, metalness: 0.5 });
    for (const c of raised) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.001, 0.02, 1.001), cloth);
      g.gridToWorld(c.gx, c.gy, c.h + 0.01, top.position);
      this.root.add(top);
      const front = g.cell(c.gx, c.gy + 1);
      const drop = c.h - (front?.h ?? 0);
      if (drop > 0) {
        const riser = new THREE.Mesh(new THREE.BoxGeometry(1.001, drop, 0.02), cloth);
        g.gridToWorld(c.gx, c.gy, c.h - drop / 2, riser.position);
        riser.position.z += 0.5;
        this.root.add(riser);
      }
      // 絨毯の左右のふちの金の線
      for (const s of [-1, 1]) {
        const n = g.cell(c.gx + s, c.gy);
        if (n?.carpet) continue;
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 1.001), edge);
        g.gridToWorld(c.gx, c.gy, c.h + 0.012, line.position);
        line.position.x += s * 0.42;
        this.root.add(line);
      }
    }
  }

  // ── 透過PNGの板 ──

  async addProp(def) {
    const tex = await this.assets.texture(def.src);
    const img = tex.image;
    const h = def.height ?? (img.height / PX_PER_UNIT) * (def.scale ?? 1);
    const w = h * (img.width / img.height);
    const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);   // 足元が原点
    const mat = new THREE.MeshLambertMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: def.selfLight ?? 0.55,
      transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = def.id;
    mesh.renderOrder = def.layer ?? 0;
    mesh.userData.prop = def;
    const holder = new THREE.Group();   // 位置と向き（billboard はこれを回す）
    holder.name = `prop_${def.id}`;
    this.grid.gridToWorld(def.grid.x, def.grid.y, def.y, holder.position);
    if (def.offset) holder.position.add(new THREE.Vector3(def.offset.x ?? 0, def.offset.y ?? 0, def.offset.z ?? 0));
    if (def.rotation) holder.rotation.set(def.rotation.x ?? 0, def.rotation.y ?? 0, def.rotation.z ?? 0);
    holder.add(mesh);
    holder.visible = def.visible !== false;
    this.root.add(holder);
    for (const [gx, gy] of def.blocks ?? []) this.grid.block(gx, gy);

    const entry = { def, mesh, holder, glows: [] };
    for (const gdef of def.glow ?? []) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: AssetManager.glowTexture(), color: gdef.color, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, opacity: 0.55,
      }));
      sprite.scale.setScalar(gdef.size);
      sprite.position.set(gdef.at[0] * w, gdef.at[1] * h, 0.05);
      sprite.renderOrder = 30;
      mesh.add(sprite);
      const glow = { sprite, base: gdef.size, phase: Math.random() * 10, group: gdef.color };
      entry.glows.push(glow);
      this.glows.push(glow);
      if (gdef.floor) {
        // 磨いた床への映りこみ（手前へ伸びる光の筋）
        const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.6).rotateX(-Math.PI / 2).translate(0, 0, 1.3),
          new THREE.MeshBasicMaterial({ map: AssetManager.glowTexture(), color: gdef.color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.32 }));
        streak.position.set(holder.position.x, (def.y ?? this.grid.heightAt(def.grid.x, def.grid.y)) + 0.01, holder.position.z);
        streak.renderOrder = 6;
        this.root.add(streak);
        entry.streak = streak;
        glow.streak = streak;
      }
    }
    this.props.push(entry);
    return entry;
  }

  setPropVisible(id, v) {
    const p = this.props.find((e) => e.def.id === id);
    if (!p) return;
    p.holder.visible = v;
    if (p.streak) p.streak.visible = v;
  }

  // ── 光 ──

  buildLights() {
    for (const L of this.map.lights) {
      let light;
      if (L.type === 'hemi') light = new THREE.HemisphereLight(L.sky, L.ground, L.intensity);
      else if (L.type === 'ambient') light = new THREE.AmbientLight(L.color, L.intensity);
      else if (L.type === 'dir') {
        light = new THREE.DirectionalLight(L.color, L.intensity);
        light.position.set(L.from.x, L.from.y, L.from.z);
      } else {
        light = new THREE.PointLight(L.color, L.intensity, L.distance ?? 0, L.decay ?? 1.6);
        this.grid.gridToWorld(L.grid.x, L.grid.y, L.y, light.position);
      }
      this.root.add(light);
      (this.lightGroups[L.group ?? 'other'] ??= []).push({ light, base: L.intensity });
    }
    this.lightScale = Object.fromEntries(Object.keys(this.lightGroups).map((k) => [k, 1]));
  }

  setLightScale(group, s) {
    this.lightScale[group] = s;
    for (const e of this.lightGroups[group] ?? []) e.light.intensity = e.base * s;
  }

  // ── キャラ ──

  async addUnit(def) {
    const tex = await this.assets.texture(def.src);
    const unit = new Unit(def, tex, this.grid);
    this.root.add(unit.root);
    this.units.push(unit);
    if (!this.activeUnit) this.activeUnit = unit;
    return unit;
  }

  // ── カメラ ──

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    const aspect = w / h, vh = this.viewHeight;
    Object.assign(this.camera, { left: (-vh * aspect) / 2, right: (vh * aspect) / 2, top: vh / 2, bottom: -vh / 2 });
    this.camera.updateProjectionMatrix();
  }

  /** カメラの位置・ズームを変えたら呼ぶ。立てた板の向きと縦の伸ばしも合わせる */
  applyCamera() {
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.target);
    const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    // 立てた板は、画面では cos(傾き) 倍に縮んで見える。描いた絵の比率に戻す（上限 1.6 倍）
    this.stretch = Math.min(1.6, 1 / Math.max(0.2, Math.cos(pitch)));
    this.cameraYaw = Math.atan2(dir.x, dir.z);
    for (const p of this.props) p.mesh.scale.y = p.def.stretch === false ? 1 : this.stretch;
    for (const u of this.units) u.setStretch(this.stretch);
    this.faceCamera();
  }

  /** billboard の板とキャラを、カメラの左右の向きに合わせる（マップを回しても） */
  faceCamera() {
    const yaw = this.cameraYaw - this.root.rotation.y;
    for (const p of this.props) if (p.def.billboard) p.holder.rotation.y = yaw;
    for (const u of this.units) u.body.rotation.y = yaw;
  }

  setMapRotation(deg) {
    this.root.rotation.y = THREE.MathUtils.degToRad(deg);
    this.faceCamera();
  }

  // ── マウス ──

  bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', (e) => {
      const c = this.pickCell(e);
      if (c !== this.hoverCell) {
        this.hoverCell = c;
        this.grid.showMark(this.grid.hover, c);
        this.emit('hover', c);
      }
    });
    el.addEventListener('pointerleave', () => { this.hoverCell = null; this.grid.showMark(this.grid.hover, null); this.emit('hover', null); });
    el.addEventListener('click', (e) => {
      if (e.shiftKey) { this.emit('inspect', this.pickObject(e)); return; }   // Shift＋クリック: 物を調べる
      const c = this.pickCell(e);
      if (!c) return;
      if (c.blocked) {
        this.grid.showMark(this.grid.blockedMark, c);
        clearTimeout(this.blockedTimer);
        this.blockedTimer = setTimeout(() => this.grid.showMark(this.grid.blockedMark, null), 400);
        return;
      }
      this.grid.showMark(this.grid.selected, c);
      this.activeUnit?.moveTo(c.gx, c.gy, 0.3);
      this.emit('select', c);
    });
  }

  setPointer(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  pickCell(e) {
    this.setPointer(e);
    const hit = this.raycaster.intersectObjects(this.grid.pickMeshes, false)[0];
    return hit?.object.userData.cell ?? null;
  }

  /** 板・キャラ・箱のうち、いちばん手前の物（透明な所は通りぬける） */
  pickObject(e) {
    this.setPointer(e);
    const targets = [...this.props.filter((p) => p.holder.visible).map((p) => p.mesh), ...this.units.map((u) => u.sprite)];
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const h of hits) {
      const map = h.object.material.map;
      if (!map?.image || !h.uv) return h.object;
      if (alphaAt(map.image, h.uv) > 0.35) return h.object;
    }
    return null;
  }

  // ── 毎フレーム ──

  start() {
    const loop = () => {
      const dt = Math.min(0.05, this.clock.getDelta());
      const t = this.clock.elapsedTime;
      for (const u of this.units) u.update(dt);
      for (const g of this.glows) {
        // 炎のゆらぎ（大きさと明るさ）
        const f = 1 + Math.sin(t * 7.3 + g.phase) * 0.05 + Math.sin(t * 13.1 + g.phase * 2) * 0.035;
        g.sprite.scale.setScalar(g.base * f);
        g.sprite.material.opacity = 0.5 * f;
        if (g.streak) g.streak.material.opacity = 0.3 * f;
      }
      for (const e of this.lightGroups.torch ?? []) {
        e.light.intensity = e.base * (this.lightScale.torch ?? 1) * (1 + Math.sin(t * 9.1 + e.base) * 0.06);
      }
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(loop);
    };
    loop();
  }
}

// 絵の uv の位置の不透明さ（調べる用。キャンバスに描いて読む）
const alphaCanvas = document.createElement('canvas');
const alphaCache = new WeakMap();
function alphaAt(image, uv) {
  let data = alphaCache.get(image);
  if (!data) {
    alphaCanvas.width = image.width; alphaCanvas.height = image.height;
    const g = alphaCanvas.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, image.width, image.height);
    g.drawImage(image, 0, 0);
    data = g.getImageData(0, 0, image.width, image.height);
    alphaCache.set(image, data);
  }
  const x = Math.min(data.width - 1, Math.floor(uv.x * data.width));
  const y = Math.min(data.height - 1, Math.floor((1 - uv.y) * data.height));
  return data.data[(y * data.width + x) * 4 + 3] / 255;
}
