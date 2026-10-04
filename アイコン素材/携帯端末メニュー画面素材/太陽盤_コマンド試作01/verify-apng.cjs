/* ファイル構造と操作の非描画テスト。実ブラウザーの描画検証ではない。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const flame = require('./flame-model.js');
const fx = path.join(__dirname, 'fx');
const manifest = JSON.parse(fs.readFileSync(path.join(fx, 'command-flame-burn-v03.json'), 'utf8'));
const bytes = fs.readFileSync(path.join(fx, manifest.apng));
assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
let offset = 8, controls = [];
while (offset < bytes.length) {
  const length = bytes.readUInt32BE(offset);
  const type = bytes.toString('ascii', offset + 4, offset + 8);
  assert.ok(offset + length + 12 <= bytes.length);
  const data = bytes.subarray(offset + 8, offset + 8 + length);
  if (type === 'acTL') { assert.equal(data.readUInt32BE(0), 17); assert.equal(data.readUInt32BE(4), 0); }
  if (type === 'fcTL') {
    assert.equal(data[24], 0); // disposal NONE
    assert.equal(data[25], 0); // blend SOURCE、残像なし
    controls.push(1000 * data.readUInt16BE(20) / data.readUInt16BE(22));
  }
  offset += length + 12;
}
assert.equal(offset, bytes.length);
assert.deepEqual(controls, manifest.durations);
assert.equal(manifest.cycleMs, controls.reduce((sum, value) => sum + value, 0));
assert.equal(manifest.frames.length, 17);
const hashes = new Set();
const crypto = require('node:crypto');
manifest.frames.forEach(name => {
  const content = fs.readFileSync(path.join(fx, name));
  assert.equal(content.readUInt32BE(16), 192);
  assert.equal(content.readUInt32BE(20), 192);
  assert.equal(content[25], 6); // RGBA
  hashes.add(crypto.createHash('sha256').update(content).digest('hex'));
});
assert.equal(hashes.size, 17, '静止素材の使い回しではなく全コマが異なる');
const bottoms = manifest.visibleBounds.map(box => box[3]);
assert.ok(Math.max(...bottoms) - Math.min(...bottoms) <= 1, '火種の下端は1px以内に登録');
const html = fs.readFileSync(path.join(__dirname, 'apng-demo.html'), 'utf8');
const blueFilter = html.match(/<filter id="karima-blue-flame"[\s\S]*?<\/filter>/)[0];
const matrix = blueFilter.match(/<feColorMatrix type="matrix" values="([\s\S]*?)"/)[1].trim().split(/\s+/).map(Number);
assert.equal(matrix.length, 20);
assert.deepEqual(matrix.slice(15), [0, 0, 0, 1, 0], '透明度は変えない');
function tint(rgb) {
  return [0, 1, 2].map(row => rgb.reduce((sum, value, column) => sum + value * matrix[row * 5 + column], matrix[row * 5 + 4]));
}
for (const input of [[0, 0, 0], [1, 1, 1], [1, .6, .08]]) {
  const [r, g, b] = tint(input);
  assert.ok(b > g && g > r && b <= 1.000001, '白い芯・火種・金の部分すべて青の階調へ');
}
const portraitFilter = html.match(/<filter id="karima-portrait-flame"[\s\S]*?<\/filter>/)[0];
assert.match(portraitFilter, /<feFuncA type="identity"/);
const portraitMatrix = portraitFilter.match(/values="([\s\S]*?)"/)[1].trim().split(/\s+/).map(Number);
assert.deepEqual(portraitMatrix.slice(15), [0, 0, 0, 1, 0]);
const tables = ['R', 'G', 'B'].map(channel => portraitFilter.match(new RegExp('<feFunc' + channel + ' type="table" tableValues="([^"]+)"'))[1].split(/\s+/).map(Number));
tables.forEach(table => {
  assert.equal(table.length, 5);
  table.forEach((value, index) => {
    assert.ok(value >= 0 && value <= 1);
    if (index) assert.ok(value >= table[index - 1], '光が増えるほど明るくする');
  });
});
assert.ok(tables[0][0] > tables[1][0] && tables[2][0] > tables[0][0], '陰影は青紫');
assert.ok(tables[2][2] > tables[1][2] && tables[1][2] > tables[0][2], '中間は澄んだ青');
assert.ok(tables[0][4] > .75 && tables[1][4] > .8, '芯は淡い光を残す');
const previousBody = [.396, .471, .929];
tables.forEach((table, channel) => assert.ok(table[2] < previousBody[channel], '炎本体は前の配色より深くする'));
assert.deepEqual(tables.map(table => table[4]), [.792, .859, 1], '光の芯は暗くしすぎない');
const goldFilter = html.match(/<filter id="alche-gold-flame"[\s\S]*?<\/filter>/)[0];
assert.match(goldFilter, /<feFuncA type="identity"/);
const goldTables = ['R', 'G', 'B'].map(channel => goldFilter.match(new RegExp('<feFunc' + channel + ' type="table" tableValues="([^"]+)"'))[1].split(/\s+/).map(Number));
for (let index = 0; index < 5; index++) {
  const [r, g, b] = goldTables.map(table => table[index]);
  assert.ok(r >= g && g > b && g / r > .77, '赤橙ではなく金〜黄白の階調');
}
assert.equal(goldTables[0][4], 1);
assert.ok(goldTables[1][4] > .95 && goldTables[2][4] > .8, '明るい芯は黄白');
assert.match(html, new RegExp('animation-duration: ' + manifest.cycleMs + 'ms'));
assert.match(html, /\.spark-field\[hidden\] \.spark \{ animation: none;/);

class Element {
  constructor() { this.listeners = {}; this.attrs = {}; this.children = []; this.hidden = false; this.value = ''; this.disabled = false;
    this.style = { setProperty(key, value) { this[key] = value; } }; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type, fn) { if (this.listeners[type] === fn) delete this.listeners[type]; }
  fire(type) { if (this.listeners[type]) this.listeners[type]({ target: this }); }
  removeAttribute(name) { delete this.attrs[name]; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  setAttribute(name, value) { this.attrs[name] = value; }
  appendChild(child) { this.children.push(child); }
  set src(value) { this.attrs.src = value; }
  get src() { return this.attrs.src; }
}
function fixture(options = {}) {
  const ids = Object.fromEntries(['apng-demo', 'demo-character', 'demo-background', 'demo-karima-color', 'demo-alche-color', 'demo-sparks', 'demo-play', 'demo-replay',
    'demo-frame', 'frame-value', 'demo-status', 'demo-error', 'original-flame'].map(id => [id, new Element()]));
  ids['demo-character'].value = 'alche'; ids['demo-background'].value = 'gray'; ids['demo-frame'].value = '9';
  ids['demo-karima-color'].value = 'portrait';
  ids['demo-alche-color'].value = 'gold'; ids['demo-sparks'].value = 'on';
  ids['original-flame'].complete = true; ids['original-flame'].naturalWidth = 1254;
  const animated = [new Element(), new Element()], still = [new Element(), new Element()];
  const sparkFields = [new Element(), new Element()];
  sparkFields.forEach(field => {
    field.setAttribute('hidden', '');
    field.animations = [{ currentTime: 50 }]; field.getAnimations = () => field.animations;
  });
  const viewports = [new Element(), new Element()];
  viewports.forEach(viewport => {
    viewport.firstElementChild = new Element(); viewport.getBoundingClientRect = () => ({ width: 400 });
  });
  ids['apng-demo'].querySelectorAll = selector => ({ '.animated': animated, '.still': still,
    '.flame': [ids['original-flame'], animated[0], still[0], sparkFields[0]], '.spark-field': sparkFields, '.viewport': viewports })[selector];
  const document = new Element(); document.getElementById = id => ids[id]; document.hidden = false;
  document.createElementNS = () => new Element();
  const reduced = new Element(); reduced.matches = !!options.reduced;
  const window = new Element(); window.SolarFlame = flame;
  let disconnected = false;
  const context = vm.createContext({ window, document, matchMedia: () => reduced,
    Image: class { set src(value) { this.naturalWidth = 192;
      if (options.fail && value.includes(options.fail)) this.onerror(); else this.onload(); } },
    ResizeObserver: class { observe() {} disconnect() { disconnected = true; } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'apng-demo.js'), 'utf8'), context);
  return { ids, animated, still, sparkFields, reduced, window, document, viewports, disconnected: () => disconnected };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const f = fixture();
  await flush();
  assert.equal(f.ids['demo-play'].disabled, false);
  assert.equal(f.ids['demo-karima-color'].disabled, true);
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], 'url("#alche-gold-flame")');
  assert.equal(f.ids['demo-alche-color'].disabled, false);
  assert.ok(f.sparkFields.every(field => !field.hasAttribute('hidden') && field.children.length === 6));
  f.sparkFields.forEach(field => field.children.forEach(group => {
    const core = group.children.find(child => child.attrs.class === 'spark-core');
    assert.ok(Number(core.attrs.cx) >= 130, '文字の左側へ散らさない');
    assert.ok(Number.parseFloat(group.style['--rise']) < 0, '粒は上へ離れる');
  }));
  const initialSource = f.animated[0].src;
  f.ids['demo-sparks'].value = 'off'; f.ids['demo-sparks'].fire('change');
  assert.ok(f.sparkFields.every(field => field.hasAttribute('hidden')));
  f.ids['demo-sparks'].value = 'on'; f.ids['demo-sparks'].fire('change');
  assert.ok(f.sparkFields.every(field => !field.hasAttribute('hidden')));
  assert.equal(f.animated[0].src, initialSource, '粒子ON/OFFで炎を再点火しない');
  f.ids['demo-alche-color'].value = 'original'; f.ids['demo-alche-color'].fire('change');
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], flame.colorFilter(flame.colorDefaults.alche));
  f.ids['demo-alche-color'].value = 'gold'; f.ids['demo-alche-color'].fire('change');
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], 'url("#alche-gold-flame")');
  assert.equal(f.animated[0].src, initialSource);
  assert.ok(f.animated.every(image => !image.hidden && image.src.includes('.apng')));
  assert.ok(f.still.every(image => image.hidden));
  assert.equal(f.ids['original-flame'].style.left, flame.placement(flame.defaults, 'bottom').left);
  f.ids['demo-play'].fire('click');
  assert.ok(f.sparkFields.every(field => field.hasAttribute('hidden')));
  assert.ok(f.animated.every(image => image.hidden && !image.hasAttribute('src')));
  assert.ok(f.still.every(image => !image.hidden && image.src.endsWith('09.png')));
  f.ids['demo-frame'].value = '17'; f.ids['demo-frame'].fire('input');
  assert.ok(f.still.every(image => image.src.endsWith('17.png')));
  assert.match(f.ids['frame-value'].textContent, /透明/);
  f.ids['demo-replay'].fire('click');
  assert.ok(f.animated.every(image => !image.hidden));
  assert.ok(f.sparkFields.every(field => !field.hasAttribute('hidden') && field.animations[0].currentTime === 0));
  const currentSource = f.animated[0].src;
  f.ids['demo-character'].value = 'karima'; f.ids['demo-character'].fire('change');
  assert.equal(f.ids['demo-karima-color'].disabled, false);
  assert.equal(f.ids['demo-alche-color'].disabled, true);
  assert.equal(f.ids['apng-demo'].style['--spark-color'], '#9ca6ef');
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], 'url("#karima-portrait-flame")');
  f.ids['demo-karima-color'].value = 'blue'; f.ids['demo-karima-color'].fire('change');
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], 'url("#karima-blue-flame")');
  f.ids['demo-karima-color'].value = 'original'; f.ids['demo-karima-color'].fire('change');
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], flame.colorFilter(flame.colorDefaults.karima));
  f.ids['demo-karima-color'].value = 'blue'; f.ids['demo-karima-color'].fire('change');
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], 'url("#karima-blue-flame")');
  f.ids['demo-karima-color'].value = 'portrait'; f.ids['demo-karima-color'].fire('change');
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], 'url("#karima-portrait-flame")');
  assert.equal(f.animated[0].src, currentSource, '色替えで点火を再起動しない');
  f.ids['demo-character'].value = 'alche'; f.ids['demo-character'].fire('change');
  assert.equal(f.ids['apng-demo'].style['--flame-filter'], 'url("#alche-gold-flame")');
  f.ids['demo-character'].value = 'karima'; f.ids['demo-character'].fire('change');
  assert.equal(f.ids['demo-karima-color'].value, 'portrait', '色の比較設定をキャラ替えで失わない');
  f.document.hidden = true; f.document.fire('visibilitychange');
  assert.ok(f.animated.every(image => !image.hasAttribute('src')));
  assert.ok(f.sparkFields.every(field => field.hasAttribute('hidden')));
  f.document.hidden = false; f.document.fire('visibilitychange');
  assert.ok(f.animated.every(image => image.hasAttribute('src')));
  f.reduced.matches = true; f.reduced.fire('change');
  assert.equal(f.ids['demo-play'].disabled, true);
  assert.equal(f.ids['demo-sparks'].disabled, true);
  assert.ok(f.sparkFields.every(field => field.hasAttribute('hidden')));
  assert.ok(f.animated.every(image => !image.hasAttribute('src')));
  assert.equal(f.ids['demo-frame'].disabled, false);
  f.window.fire('pagehide');
  assert.ok(f.disconnected());
  assert.equal(f.document.listeners.visibilitychange, undefined);
  const lowMotion = fixture({ reduced: true }); await flush();
  assert.ok(lowMotion.still.every(image => !image.hidden));
  assert.ok(lowMotion.animated.every(image => !image.hasAttribute('src')));
  assert.ok(lowMotion.sparkFields.every(field => field.hasAttribute('hidden')));
  const failure = fixture({ fail: '04.png' }); await flush();
  assert.equal(failure.ids['demo-play'].disabled, true);
  assert.ok(failure.sparkFields.every(field => field.hasAttribute('hidden')));
  assert.equal(failure.ids['demo-error'].hidden, false);
  assert.match(failure.ids['demo-error'].textContent, /読み込めません/);
  const unloaded = fixture(); unloaded.window.fire('pagehide'); await flush();
  assert.ok(unloaded.animated.every(image => !image.hasAttribute('src')));
  assert.ok(unloaded.sparkFields.every(field => field.hasAttribute('hidden')));
  console.log('APNG17コマ・透過RGBA・コマ時間・登録位置・両キャラ・静止/再生・失敗・動き低減・終了の非描画テスト成功');
})().catch(error => { console.error(error); process.exitCode = 1; });
