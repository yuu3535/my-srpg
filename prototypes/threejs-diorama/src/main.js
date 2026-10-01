import GUI from 'lil-gui';
import { MapScene } from './MapScene.js';
import { THRONE_ROOM } from './MapData.js';
import './styles.css';

// 開発中（npm run dev）か、URL に ?debug を付けたときだけ、調整の窓を出す
const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

const app = document.getElementById('app');
const hud = {
  title: document.getElementById('map-title'),
  cell: document.getElementById('cell-info'),
  inspect: document.getElementById('inspect'),
  loading: document.getElementById('loading'),
};

const scene = new MapScene(app, THRONE_ROOM);
hud.title.textContent = THRONE_ROOM.name;

scene.build().then(() => {
  hud.loading.classList.add('done');
  scene.start();
  if (scene.assets.missing.length) console.warn('仮の板で代用した素材:', scene.assets.missing);
  if (DEBUG) buildDebug();
  // 確認用: ?at=5,7 でキャラをそのマスに置く、?grid でグリッドを出す、?rot=30 でマップを回す、?nogui で調整の窓を隠す
  const q = new URLSearchParams(location.search);
  if (q.has('at')) {
    const [gx, gy] = q.get('at').split(',').map(Number);
    const u = scene.activeUnit;
    u.gx = gx; u.gy = gy;
    scene.grid.gridToWorld(gx, gy, undefined, u.root.position);
  }
  if (q.has('grid')) scene.grid.setGridVisible(true);
  if (q.has('rot')) scene.setMapRotation(Number(q.get('rot')));
  if (q.has('nogui')) gui?.hide();
});

scene.on('hover', (c) => {
  hud.cell.textContent = c ? `マス ${c.gx}, ${c.gy}　高さ ${c.h}${c.blocked ? '　通れない' : ''}` : '';
});

// G: グリッドの表示・非表示
window.addEventListener('keydown', (e) => {
  if (e.key === 'g' || e.key === 'G') {
    scene.grid.setGridVisible(!scene.grid.gridVisible);
    gui?.controllersRecursive().forEach((c) => c.updateDisplay());
  }
});

let gui = null;

function buildDebug() {
  gui = new GUI({ title: '調整（開発用）', width: 280 });
  window.__gui = gui;
  const cam = scene.camera;
  const apply = () => scene.applyCamera();
  const state = {
    grid: false,
    rotation: 0,
    copyCamera() {
      const text = JSON.stringify({
        position: { x: round(cam.position.x), y: round(cam.position.y), z: round(cam.position.z) },
        target: { x: round(scene.target.x), y: round(scene.target.y), z: round(scene.target.z) },
        viewHeight: scene.viewHeight, zoom: round(cam.zoom),
      }, null, 2);
      navigator.clipboard?.writeText(text);
      console.log('camera:', text);
    },
  };
  Object.defineProperty(state, 'grid', { get: () => scene.grid.gridVisible, set: (v) => scene.grid.setGridVisible(v) });

  const fc = gui.addFolder('カメラ');
  fc.add(cam.position, 'x', -30, 30, 0.1).name('camera X').onChange(apply);
  fc.add(cam.position, 'y', 1, 40, 0.1).name('camera Y').onChange(apply);
  fc.add(cam.position, 'z', -30, 40, 0.1).name('camera Z').onChange(apply);
  fc.add(scene.target, 'y', -2, 6, 0.1).name('見る点の高さ').onChange(apply);
  fc.add(scene.target, 'z', -8, 8, 0.1).name('見る点の奥行き').onChange(apply);
  fc.add(cam, 'zoom', 0.4, 3, 0.01).name('zoom').onChange(apply);
  fc.add(state, 'rotation', -180, 180, 1).name('map rotation').onChange((v) => scene.setMapRotation(v));
  fc.add(state, 'copyCamera').name('カメラの値をコピー');

  const fg = gui.addFolder('表示');
  fg.add(state, 'grid').name('グリッド（G）');

  const fl = gui.addFolder('光の強さ');
  const names = { ambient: '全体（空・床の返り）', window: 'ステンドグラス（藍）', torch: '松明（橙）', magic: '魔灯（紫）' };
  for (const group of Object.keys(scene.lightScale)) {
    fl.add(scene.lightScale, group, 0, 3, 0.01).name(names[group] ?? group).onChange((v) => scene.setLightScale(group, v));
  }
  fl.add(scene.renderer, 'toneMappingExposure', 0.4, 2, 0.01).name('画面の明るさ');

  const ff = gui.addFolder('仕上げ（空気遠近）');
  const upd = () => scene.updateFinish();
  ff.add(scene.finish, 'haze', 0, 1, 0.01).name('左右のもや').onChange(upd);
  ff.add(scene.finish, 'blur', 0, 6, 0.1).name('左右のぼかし').onChange(upd);
  ff.add(scene.finish, 'start', 0, 1, 0.01).name('もやの始まり').onChange(upd);
  ff.add(scene.finish, 'vignette', 0, 1, 0.01).name('四隅の暗さ').onChange(upd);

  const fp = gui.addFolder('素材の表示');
  for (const p of scene.props) {
    const o = { v: p.holder.visible };
    fp.add(o, 'v').name(p.def.id).onChange((v) => scene.setPropVisible(p.def.id, v));
  }
  fp.close();

  hud.inspect.hidden = false;
  hud.inspect.textContent = 'Shift＋クリックで、板・キャラの位置を調べる';
}

// Shift＋クリック: 物の position・rotation・scale を出す（マップ作りの手がかり）
scene.on('inspect', (obj) => {
  if (!DEBUG) return;
  if (!obj) { hud.inspect.textContent = '（何もない）'; return; }
  const holder = obj.parent;
  const wp = obj.getWorldPosition(obj.position.clone());
  const def = obj.userData.prop ?? obj.userData.unit?.def;
  const grid = scene.grid.worldToGrid(holder.position.x, holder.position.z);
  hud.inspect.textContent = [
    `${def?.id ?? obj.name}`,
    `position  ${fmt(holder.position)}（world ${fmt(wp)}）`,
    `rotation  ${fmt(holder.rotation)}`,
    `scale     ${fmt(obj.scale)}`,
    `grid      ${def?.grid ? `${def.grid.x}, ${def.grid.y}` : `${grid.gx}, ${grid.gy}`}`,
  ].join('\n');
  console.log('inspect', def, holder.position, holder.rotation, obj.scale);
});

function round(v) { return Math.round(v * 100) / 100; }
function fmt(v) { return `${round(v.x)}, ${round(v.y)}, ${round(v.z)}`; }

window.__scene = scene;   // ブラウザのコンソールから触る用
