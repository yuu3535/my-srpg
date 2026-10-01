import * as THREE from 'three';

// 画像の読み込み。見つからない素材は、名前を書いた仮の板（紫の枠）にして止めずに進む。
export class AssetManager {
  constructor(renderer) {
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.missing = [];
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
  }

  /** 絵を読み込む（同じ絵は1回だけ）。失敗したら仮の絵 */
  texture(url) {
    if (!this.cache.has(url)) {
      this.cache.set(url, new Promise((resolve) => {
        this.loader.load(url, (tex) => resolve(this.prepare(tex)), undefined, () => {
          console.warn('[AssetManager] 素材がない:', url);
          this.missing.push(url);
          resolve(this.prepare(AssetManager.placeholder(url)));
        });
      }));
    }
    return this.cache.get(url);
  }

  prepare(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAniso;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  /** 仮の絵: 紫の枠と素材の名前 */
  static placeholder(label) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(70,40,100,0.85)'; g.fillRect(0, 0, 128, 256);
    g.strokeStyle = '#e2b65a'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 252);
    g.fillStyle = '#f2e6ff'; g.font = '14px sans-serif'; g.textAlign = 'center';
    const name = label.split('/').pop();
    name.match(/.{1,14}/g).forEach((line, i) => g.fillText(line, 64, 120 + i * 18));
    return new THREE.CanvasTexture(c);
  }

  /** コードで描く石の模様（石畳・石積み）。base・seam は色、vary は石ごとの明るさのむら */
  static stoneTexture({ base, seam, vary = 0.08, cols = 4, rows = 4, size = 256, offsetRows = true, seed = 1 }) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = seam; g.fillRect(0, 0, size, size);
    const rnd = mulberry(seed);
    const cw = size / cols, rh = size / rows, gap = Math.max(2, size / 128);
    const baseRgb = new THREE.Color(base);
    for (let r = 0; r < rows; r++) {
      const shift = offsetRows && r % 2 ? cw / 2 : 0;
      for (let k = -1; k < cols; k++) {
        const x = k * cw + shift, y = r * rh;
        const v = 1 + (rnd() - 0.5) * 2 * vary;
        const col = baseRgb.clone().multiplyScalar(v);
        g.fillStyle = `#${col.getHexString()}`;
        g.fillRect(x + gap, y + gap, cw - gap * 2, rh - gap * 2);
        // 石の上のふちに、うすい明るい線（手描き風の面取り）
        g.fillStyle = 'rgba(255,240,255,0.06)';
        g.fillRect(x + gap, y + gap, cw - gap * 2, gap);
      }
    }
    // 細かい汚れ
    for (let i = 0; i < size * 6; i++) {
      g.fillStyle = `rgba(10,5,15,${rnd() * 0.12})`;
      g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** 光のにじみの丸（足し算で重ねる） */
  static glowTexture() {
    if (AssetManager._glow) return AssetManager._glow;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    AssetManager._glow = new THREE.CanvasTexture(c);
    return AssetManager._glow;
  }

  /** キャラの足元の丸い影 */
  static shadowTexture() {
    if (AssetManager._shadow) return AssetManager._shadow;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(8,4,14,0.75)');
    grad.addColorStop(0.6, 'rgba(8,4,14,0.4)');
    grad.addColorStop(1, 'rgba(8,4,14,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    AssetManager._shadow = new THREE.CanvasTexture(c);
    return AssetManager._shadow;
  }
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
