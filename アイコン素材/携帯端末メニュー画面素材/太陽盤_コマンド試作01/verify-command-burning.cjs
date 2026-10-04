/* DOMモックによる接続検証。ブラウザーの描画・見た目の確認とは別。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const burning = require('./command-burning.js');
const model = require('./flame-model.js');
const math = require('./wheel-math.js');
const html = fs.readFileSync(path.join(__dirname, 'layout.html'), 'utf8');
const demo = fs.readFileSync(path.join(__dirname, 'apng-demo.html'), 'utf8');
assert(fs.existsSync(path.join(__dirname, burning.source)));
assert(fs.existsSync(path.join(__dirname, burning.holdSource)));
assert(fs.existsSync(path.join(__dirname, burning.extinguishSource)));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx/command-flame-selection-v01.json'), 'utf8'));
const exitManifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx/command-flame-selection-v01-extinguish.json'), 'utf8'));
assert.equal(exitManifest.stages.extinguish.durationMs, burning.extinguishMs);
assert.equal(exitManifest.stages.extinguish.loop, 1);
assert.deepEqual(exitManifest.stages.extinguish.frames, [12, 13, 14, 15, 16, 17]);
assert.equal(manifest.stages.ignite.durationMs, burning.ignitionMs);
assert.equal(manifest.stages.ignite.loop, 1);
assert.equal(manifest.stages.hold.loop, 0);
assert.deepEqual(manifest.stages.hold.frames, [5, 6, 7, 8, 9, 10, 11], '消火・透明コマは常時燃焼に含めない');
for (const stage of Object.values({ ...manifest.stages, ...exitManifest.stages })) {
  const data = fs.readFileSync(path.join(__dirname, 'fx', stage.src));
  const durations = []; let loops, frameCount;
  for (let offset = 8; offset < data.length;) {
    const size = data.readUInt32BE(offset), kind = data.toString('ascii', offset + 4, offset + 8), start = offset + 8;
    if (kind === 'acTL') { frameCount = data.readUInt32BE(start); loops = data.readUInt32BE(start + 4); }
    if (kind === 'fcTL') {
      durations.push(Math.round(data.readUInt16BE(start + 20) / (data.readUInt16BE(start + 22) || 100) * 1000));
      assert.equal(data[start + 24], 0); assert.equal(data[start + 25], 0, 'SOURCE置換で前コマの残像を残さない');
    }
    offset += size + 12;
  }
  assert.equal(frameCount, stage.frames.length); assert.equal(loops, stage.loop); assert.deepEqual(durations, stage.durations);
}
for (const character of ['alche', 'karima']) {
  assert.equal(burning.filter(character, model.colorDefaults[character], model.colorDefaults[character]),
    'url(#command-burn-' + character + ') hue-rotate(0deg) saturate(1) brightness(1)');
  const filterId = character === 'alche' ? 'alche-gold-flame' : 'karima-portrait-flame';
  const approved = new RegExp('<filter id="' + filterId + '"[\\s\\S]*?</filter>').exec(demo)[0];
  const channels = [...approved.matchAll(/tableValues="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(burning.palettes[character].channels, channels, 'メニューと確認済み見本の階調は同じ');
}
assert.equal(burning.seeds.length, 6);
assert(burning.seeds.every(([x, , , , rise]) => x >= 130 && rise < 0));
assert(html.includes('animation-duration: 1610ms'));
assert(html.includes('.command-sparks[hidden] .command-spark { animation: none; }'));
assert(html.includes('.selection-flame [hidden] { display: none !important; }'), '作者CSSのdisplay:blockよりhiddenを優先');
assert(html.includes('value="apng" selected'));
class Element {
  constructor(tag = '') {
    this.tag = tag; this.children = []; this.attributes = {}; this.events = {}; this.hidden = false; this.value = '';
    this.style = { setProperty(key, value) { this[key] = value; } };
    const classes = new Set(); this.classList = {
      add(key) { classes.add(key); }, remove(key) { classes.delete(key); },
      toggle(key, active) { if (active) classes.add(key); else classes.delete(key); }, contains(key) { return classes.has(key); }
    };
    this.animations = [{ currentTime: 200 }];
  }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; if (key === 'src') delete this.src; }
  hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
  addEventListener(key, callback) { this.events[key] = callback; }
  getAnimations() { return this.animations; }
  getBoundingClientRect() { return { width: 844, height: 390 }; }
  focus() {} select() {}
}
function setup({ reduce = false, failMenu = false, loadExit = false } = {}) {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
  Object.assign(elements.character, { value: 'alche' });
  elements.background.value = 'light'; elements['flame-variant'].value = 'bottom'; elements['flame-animation'].value = 'apng';
  elements['selection-effects'].checked = true; elements['flame-particles'].checked = true;
  const created = [], frames = new Map(), timers = new Map(); let id = 0, timerId = 0, time = 0, closed = false, pagehide;
  const doc = {
    hidden: false, getElementById: key => elements[key],
    createElement(tag) { const node = new Element(tag); created.push(node); return node; },
    createElementNS(ns, tag) { const node = new Element(tag); created.push(node); return node; },
    addEventListener(key, callback) { this.events ||= {}; this.events[key] = callback; },
    removeEventListener(key) { delete this.events[key]; }
  };
  const media = { matches: reduce, addEventListener(key, callback) { this.changed = callback; }, removeEventListener() {} };
  const win = { SolarWheel: math, SolarFlame: model, SolarCommandBurning: burning,
    SolarMaterials: require('../太陽盤_試作03/material-engine.js'), SolarCharacterColors: require('../太陽盤_試作03/character-colors.js'),
    addEventListener(key, callback) { if (key === 'pagehide') pagehide = callback; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'wheel.js'), 'utf8'), {
    window: win, document: doc, navigator: {}, matchMedia: () => media,
    ResizeObserver: class { observe() {} disconnect() { closed = true; } },
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; }, cancelAnimationFrame(key) { frames.delete(key); }
    , setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; }, clearTimeout(key) { timers.delete(key); }
  });
  function settle() {
    let iterations = 0;
    while (frames.size) {
      assert(++iterations < 1200); const [key, callback] = frames.entries().next().value; frames.delete(key); callback(time += 1000 / 60);
    }
  }
  const buttons = elements.labels.children.map(anchor => anchor.children[0]);
  const flameNodes = buttons.map(button => button.children[0].children[0]);
  const art = created.filter(node => node.className === 'selection-burn-art');
  const fields = created.filter(node => node.attributes.class === 'command-sparks');
  const preload = created.find(node => node.tag === 'img' && node.src === burning.source);
  const holdPreload = created.find(node => node.tag === 'img' && node.src === burning.holdSource);
  const exitPreload = created.find(node => node.tag === 'img' && node.src === burning.extinguishSource);
  assert(exitPreload);
  if (loadExit) exitPreload.onload();
  assert(preload); assert.equal(art.length, 5); assert.equal(fields.length, 5);
  assert(art.every(node => !node.src), '未選択札には再生リソースを持たせない');
  const loadMenu = () => ['disk-panes', 'disk-frame', 'rays-panes', 'rays-frame', 'wheel-panes'].forEach((key, i) => {
    if (failMenu && i === 0) elements[key].onerror(); else elements[key].onload();
  });
  const active = () => art.filter(node => node.src);
  const select = index => { buttons[index].events.click(); settle(); };
  const ignite = index => { assert(art[index].src); art[index].onload(); assert(!art[index].hidden); };
  const settings = () => JSON.parse(elements.settings.value);
  function tick() { const [key, callback] = frames.entries().next().value; frames.delete(key); callback(time += 1000 / 60); }
  function sustain() { assert.equal(timers.size, 1); const [key, timer] = timers.entries().next().value; assert.equal(timer.delay, 180); timers.delete(key); timer.callback(); }
  function finishExit() { const entry = [...timers].find(([, timer]) => timer.delay === 200); assert(entry); const [key, timer] = entry; timers.delete(key); timer.callback(); }
  return { elements, doc, media, buttons, art, fields, preload, holdPreload, exitPreload, flameNodes, settle, loadMenu, active, select, ignite, settings, tick, sustain, timers, finishExit, hasRotation: () => frames.size > 0,
    close() { pagehide(); assert(closed); assert.equal(frames.size, 0); assert.equal(timers.size, 0); } };
}
const s = setup();
assert.deepEqual(s.settings(), JSON.parse(fs.readFileSync(path.join(__dirname, 'settings/alche-command-v03.json'), 'utf8')), 'アルシェの作者JSONと初期値が一致');
s.select(2); assert.equal(s.active().length, 0);
s.loadMenu(); assert.equal(s.active().length, 0, '輪の読み込み完了だけでは点火しない');
s.preload.onload(); assert.equal(s.active().length, 0, '燃焼中ループも先に読み込む');
s.holdPreload.onload(); assert.equal(s.active().length, 1); assert(!s.preload.src && !s.holdPreload.src, '読み込み専用のAPNGを解放');
s.ignite(2); assert.equal(s.fields[2].hasAttribute('hidden'), false);
assert.equal(s.fields[2].animations[0].currentTime, 0);
assert.equal(s.fields[2].children.length, 6);
assert(s.flameNodes[2].children[0].hidden, 'APNGと旧画像を重ねない');
const first = s.art[2].src;
s.elements.character.value = 'karima'; s.elements.character.events.change();
assert.equal(s.art[2].src, first, '色違いの切替では再点火しない');
assert(s.elements.screen.style['--flame-filter'].includes('command-burn-karima'));
assert.deepEqual(s.settings().flame, burning.defaults.flame);
assert.deepEqual(s.settings().flameColor, burning.defaults.colors.karima);
assert.equal(s.settings().flameAnimation, 'apng'); assert.equal(s.settings().flamePalette, 'portrait');
assert.deepEqual(s.settings(), JSON.parse(fs.readFileSync(path.join(__dirname, 'settings/karima-command-v03.json'), 'utf8')), 'カリマの作者JSONと切替値が一致');
assert.equal(s.settings().wheel.gap, -27); assert.equal(s.settings().wheel.bandHeight, 31);
s.elements['flame-x-number'].value = -24; s.elements['flame-x-number'].events.input();
s.elements['flame-color-hue'].value = 227; s.elements['flame-color-hue'].events.input();
assert.equal(s.art[2].src, first, '位置・色の調整でAPNGを再起動しない');
assert(s.elements.screen.style['--flame-filter'].includes('hue-rotate(10deg)'));
s.elements['flame-particles'].checked = false; s.elements['flame-particles'].events.change();
assert(s.fields.every(field => field.hasAttribute('hidden'))); assert.equal(s.art[2].src, first);
s.elements['flame-particles'].checked = true; s.elements['flame-particles'].events.change();
assert(!s.fields[2].hasAttribute('hidden'));
s.select(2); assert.notEqual(s.art[2].src, first);
const obsolete = s.art[2].onload;
s.ignite(2);
s.buttons[4].events.click(); assert.equal(s.active().length, 0, '回転が始まると前の炎を停止');
obsolete(); assert(s.fields.every(field => field.hasAttribute('hidden')), '古い読込通知で炎を復活させない');
s.settle(); s.ignite(4); assert.equal(s.active().length, 1);
s.sustain(); assert(s.art[4].src.startsWith(burning.holdSource), '点火後は燃焼中の無限ループ');
s.elements['selection-effects'].checked = false; s.elements['selection-effects'].events.change();
assert.equal(s.active().length, 0); assert(s.fields.every(field => field.hasAttribute('hidden')));
s.elements['selection-effects'].checked = true; s.elements['selection-effects'].events.change(); s.ignite(4);
s.doc.hidden = true; s.doc.events.visibilitychange(); assert.equal(s.active().length, 0);
s.doc.hidden = false; s.doc.events.visibilitychange(); s.ignite(4);
s.media.matches = true; s.media.changed(); assert.equal(s.active().length, 0);
s.media.matches = false; s.media.changed(); s.ignite(4);
s.elements['flame-animation'].value = 'legacy'; s.elements['flame-animation'].events.change();
assert.equal(s.active().length, 0); assert.equal(s.elements['flame-variant'].disabled, false);
// 静止素材が未読込でもAPNGへ戻ることはできる。
s.elements['flame-animation'].value = 'apng'; s.elements['flame-animation'].events.change(); s.ignite(4);
s.art[4].onerror(); assert.equal(s.active().length, 0); assert(!s.elements['flame-status'].hidden);
s.select(0); assert.equal(s.buttons[0].attributes['aria-pressed'], 'true', '炎のエラーでも選択は動く');
s.close(); assert.equal(s.active().length, 0);
const hidden = setup(); hidden.loadMenu(); hidden.doc.hidden = true; hidden.select(1); hidden.preload.onload(); hidden.holdPreload.onload();
assert.equal(hidden.active().length, 0); hidden.doc.hidden = false; hidden.doc.events.visibilitychange(); hidden.ignite(1); hidden.close();
for (const options of [{ reduce: true }, { failMenu: true }]) {
  const blocked = setup(options); blocked.loadMenu(); blocked.preload.onload(); blocked.holdPreload.onload(); blocked.select(1);
  assert.equal(blocked.active().length, 0); blocked.close();
}
const failure = setup(); failure.loadMenu(); failure.select(3); failure.preload.onerror(); failure.holdPreload.onload();
assert.equal(failure.active().length, 0); assert(!failure.elements['flame-status'].hidden); failure.close();
const closing = setup(); const late = closing.preload.onload; closing.close(); late(); assert.equal(closing.active().length, 0);
const early = setup(); early.loadMenu(); early.preload.onload(); early.holdPreload.onload();
early.buttons[0].events.click(); let count = 0;
while (!early.active().length) { assert(++count < 100); early.tick(); }
assert(early.elements.status.textContent.startsWith('回転中：'), '厳密な停止を待たず、嵌合直前に点火');
early.ignite(0); assert.equal(early.timers.size, 1);
early.buttons[3].events.click(); assert.equal(early.timers.size, 0, '次の選択で燃焼切替タイマーを破棄');
early.settle(); early.ignite(3); early.sustain(); const hold = early.art[3].src;
early.elements['flame-size'].value = 92; early.elements['flame-size'].events.input();
assert.equal(early.art[3].src, hold, '常時燃焼中も位置調整で再点火しない');
early.elements['clear'].events.click(); assert.equal(early.active().length, 0); early.close();
function readyExit() {
  const scene = setup({ loadExit: true }); scene.loadMenu(); scene.preload.onload(); scene.holdPreload.onload();
  scene.select(0); scene.ignite(0); scene.sustain(); return scene;
}
const fading = readyExit();
fading.buttons[2].events.click();
assert(fading.hasRotation(), '消火完了を待たず、輪はすぐ回る');
assert(fading.art[0].src.startsWith(burning.extinguishSource));
assert(fading.flameNodes[0].classList.contains('is-lit'), '消火中の旧札だけ表示を保持');
assert(fading.fields[0].hasAttribute('hidden'), '旧札は新しい火の粉を出さない');
fading.art[0].onload(); fading.settle(); fading.ignite(2);
assert.equal(fading.active().length, 2, '消火1つと点火1つだけ');
assert.equal(fading.timers.size, 2);
fading.finishExit();
assert(!fading.art[0].src); assert(!fading.flameNodes[0].classList.contains('is-lit'));
assert(fading.art[2].src); assert(!fading.fields[2].hasAttribute('hidden'), '旧札の後処理は新札を消さない');
fading.sustain();
fading.elements['clear'].events.click(); assert(fading.art[2].src.startsWith(burning.extinguishSource));
fading.art[2].onload(); fading.finishExit(); assert.equal(fading.active().length, 0); fading.close();
const rapid = readyExit(); rapid.buttons[1].events.click();
const lateExitLoad = rapid.art[0].onload;
rapid.art[0].onload(); const lateExitTimer = [...rapid.timers.values()][0].callback;
rapid.select(1); rapid.ignite(1);
rapid.buttons[0].events.click();
assert(!rapid.art[0].src, '前に消火中だった札へ戻る際は古い消火を解放');
lateExitLoad(); lateExitTimer(); assert(!rapid.art[0].src, '古い読込・タイマーで消火を復活させない');
rapid.settle(); rapid.ignite(0);
lateExitTimer(); assert(rapid.art[0].src, '古い消火終了で再選択した炎を消さない');
assert.equal(rapid.active().length, 2);
rapid.buttons[3].events.click(); assert.equal(rapid.active().length, 1, '連打中の消火は最大1つ');
assert(rapid.art[0].src.startsWith(burning.extinguishSource)); assert(!rapid.art[1].src);
rapid.elements['selection-effects'].checked = false; rapid.elements['selection-effects'].events.change();
assert.equal(rapid.active().length, 0); assert.equal(rapid.timers.size, 0); rapid.close();
for (const shutdown of ['hidden', 'reduced', 'pagehide', 'legacy']) {
  const scene = readyExit(); scene.buttons[1].events.click(); scene.art[0].onload();
  if (shutdown === 'hidden') { scene.doc.hidden = true; scene.doc.events.visibilitychange(); }
  if (shutdown === 'reduced') { scene.media.matches = true; scene.media.changed(); }
  if (shutdown === 'legacy') { scene.elements['flame-animation'].value = 'legacy'; scene.elements['flame-animation'].events.change(); }
  if (shutdown === 'pagehide') scene.close();
  assert.equal(scene.active().length, 0); assert.equal(scene.timers.size, 0, '消火中も停止条件で即解放');
  if (shutdown !== 'pagehide') scene.close();
}
const missingExit = setup(); missingExit.loadMenu(); missingExit.preload.onload(); missingExit.holdPreload.onload();
missingExit.exitPreload.onerror(); missingExit.select(0); missingExit.ignite(0);
assert(missingExit.elements['flame-status'].textContent.includes('点火・燃焼'));
missingExit.buttons[1].events.click(); assert.equal(missingExit.active().length, 0, '消火だけの欠落は即時停止へ');
missingExit.settle(); missingExit.ignite(1); missingExit.close();
const exitError = readyExit(); exitError.buttons[2].events.click(); exitError.art[0].onerror();
assert.equal(exitError.active().length, 0); exitError.settle(); exitError.ignite(2); exitError.close();
console.log('PASS: early ignition, sustained flame, 200ms exit without delaying rotation, bounded overlap, rapid reselection, stale callbacks, failures, presets and lifecycle cleanup');
