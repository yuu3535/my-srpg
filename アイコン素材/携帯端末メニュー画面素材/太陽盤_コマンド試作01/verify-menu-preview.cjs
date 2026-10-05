// 参照・横画面の配置値・通信・操作分岐を検証。ブラウザ描画QAとは区別する。
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('./menu-preview-model.js');
const time = require('./time-of-day.js');
const { mount } = require('./menu-preview.js');
const html = fs.readFileSync(path.join(__dirname, 'menu-preview.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'menu-preview.css'), 'utf8');
for (const file of ['menu-preview.html', 'layout.html', '../運命予報_分離素材01/layers-preview.html']) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  for (const [, reference] of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (reference.startsWith('#')) continue;
    const target = reference.replace(/&amp;/g, '&').split(/[?#]/)[0];
    assert.ok(fs.existsSync(path.resolve(__dirname, path.dirname(file), target)), reference);
  }
  for (const [, script] of source.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
}
for (const file of ['menu-embed.js', 'menu-preview-model.js', 'menu-preview.js']) {
  new vm.Script(fs.readFileSync(path.join(__dirname, file), 'utf8'));
}
for (const box of Object.values(model.boxes)) {
  assert.ok(box.left >= 0 && box.top >= 0);
  assert.ok(box.left + box.width <= 844 && box.top + box.height <= 390);
}
// 原作者の位置調整後は中心揃えを強制しない。
assert.equal(model.boxes.tip.height, 28);
assert.deepEqual(model.positions(), {
  map: { left: 330.243, top: 27.612 }, tip: { left: 344.994, top: 336.504 },
  time: { left: 652.622, top: 10.003 }, fortune: { left: 630.871, top: 75.997 }
});
assert.ok(model.boxes.tip.top > model.boxes.map.top + model.boxes.map.height);
for (const [name, selector] of Object.entries({ map: 'map-card', tip: 'menu-tip', time: 'menu-time', fortune: 'fortune-frame' })) {
  const rule = css.match(new RegExp('\\.' + selector + ' \\{([^}]+)'))[1];
  for (const property of ['left', 'top', 'width', 'height']) assert.ok(rule.includes(`${property}: ${model.boxes[name][property]}px`));
}
assert.equal(model.scaleFor(422), .5);
assert.equal(model.scaleFor(NaN), 1);
assert.equal(model.description('__proto__'), 'コマンドを選んでください');
assert.equal(model.description('items'), '戦闘マップへ出撃する');
assert.equal(model.description('friends'), '探索マップへ進む');
assert.equal(model.description('support'), '仲間との支援会話を見る');
assert.ok(css.includes('aspect-ratio: 844 / 390'));
// 素材の比率と844:390の構図を両方維持。編集ハンドルより上でも入力を遮らない。
const framePng = fs.readFileSync(path.resolve(__dirname, '../横向きフレーム素材.png'));
assert.equal(framePng.readUInt32BE(16), 1799);
assert.equal(framePng.readUInt32BE(20), 874);
assert.equal(framePng[25], 6); // RGBA
assert.ok(css.includes('aspect-ratio: 1799 / 874'));
const frameRule = css.match(/\.device-frame \{([^}]+)\}/)[1];
assert.ok(frameRule.includes('pointer-events: none'));
assert.ok(frameRule.includes('z-index: 3'));
const deviceViewportRule = css.match(/\[data-frame="true"\] \.menu-viewport \{([^}]+)\}/)[1];
const framedWidth = Number(deviceViewportRule.match(/width: calc\(100% \* ([\d.]+) \/ 1799\)/)[1]);
const framedLeft = Number(deviceViewportRule.match(/left: calc\(100% \* ([\d.]+) \/ 1799\)/)[1]);
assert.ok(Math.abs(framedWidth / 844 - 643 / 390) < 1e-10);
assert.ok(Math.abs(framedLeft + framedWidth / 2 - (113 + 1570 / 2)) < 1e-10);
assert.ok(html.indexOf('id="menu-device-frame"') > html.indexOf('id="move-fortune"'));
function node() {
  return {
    handlers: new Map(), attributes: {}, dataset: {}, value: '', checked: false, hidden: false,
    style: { properties: {}, setProperty(key, value) { this.properties[key] = value; } },
    addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(handler); },
    removeEventListener(type, handler) { this.handlers.get(type)?.delete(handler); },
    emit(type, event = {}) { for (const handler of [...(this.handlers.get(type) || [])]) handler(event); },
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; if (key === 'src') delete this.src; }
  };
}
function setup({ reduced = false, fallback = false, frameFailed = false } = {}) {
  const elements = new Map(), probes = [], messages = [];
  const byId = id => { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); };
  const modes = Object.keys(model.mapModes).map(mode => Object.assign(node(), { dataset: { mapMode: mode } }));
  const close = node(), doc = node(), win = node(), media = node();
  media.matches = reduced; win.matchMedia = () => media;
  let disconnected = false;
  win.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  doc.getElementById = byId; doc.createElement = () => { const image = node(); probes.push(image); return image; };
  doc.querySelector = () => close; doc.querySelectorAll = () => modes;
  byId('menu-wheel').contentWindow = { postMessage(message) { messages.push(message); } };
  byId('menu-character').value = 'alche'; byId('menu-phase').value = 'evening';
  byId('menu-background').value = 'corridor'; byId('menu-effects').checked = true;
  byId('menu-show-frame').checked = true;
  if (frameFailed) Object.assign(byId('menu-device-frame'), { complete: true, naturalWidth: 0 });
  byId('menu-viewport').clientWidth = 422;
  if (!fallback) { byId('map-dialog').showModal = function () { this.open = true; }; byId('map-dialog').close = function () { this.open = false; }; }
  const app = mount(doc, win, model, time);
  const state = (value, source = byId('menu-wheel').contentWindow) => win.emit('message', { source, data: { type: 'solar-menu-state', selected: 'items', loading: false, failed: false, ...value } });
  return { app, doc, win, media, byId, probes, messages, modes, close, state, disconnected: () => disconnected };
}
const s = setup();
assert.equal(s.byId('menu-screen').style.properties['--scene-scale'], .5);
assert.equal(s.byId('menu-device').dataset.frame, 'true');
assert.equal(s.byId('menu-device-frame').hidden, false);
s.byId('menu-show-frame').checked = false; s.byId('menu-show-frame').emit('change');
assert.equal(s.byId('menu-device').dataset.frame, 'false');
assert.equal(s.byId('menu-device-frame').hidden, true);
// 枠の切り替えは座標・コマンド状態に触れず、実表示の小数pxも拡縮へ反映する。
s.byId('menu-viewport').getBoundingClientRect = () => ({ width: 380.25 });
s.byId('menu-show-frame').checked = true; s.byId('menu-show-frame').emit('change');
assert.equal(s.byId('menu-screen').style.properties['--scene-scale'], 380.25 / 844);
assert.equal(s.messages.length, 1);
s.byId('menu-device-frame').emit('error');
assert.equal(s.byId('menu-device').dataset.frame, 'false');
assert.equal(s.byId('menu-show-frame').disabled, true);
assert.ok(s.byId('menu-warning').textContent.includes('端末フレーム'));
s.byId('menu-device-frame').emit('load');
assert.equal(s.byId('menu-show-frame').disabled, false);
assert.equal(s.byId('menu-warning').hidden, true);
assert.equal(s.byId('menu-device').dataset.frame, 'false');
assert.ok(s.byId('menu-time').innerHTML.includes('data-phase="evening"'));
// 初回の未選択通知とloadの順序に依存しない。
s.state({ selected: null, loading: true }); s.byId('menu-wheel').emit('load');
assert.equal(s.messages.at(-1).select, 'items');
s.state({}); assert.equal(s.byId('menu-tip').textContent, model.descriptions.items);
assert.equal(s.byId('wheel-loading').hidden, true);
s.state({ selected: 'save' }, {}); assert.equal(s.byId('menu-tip').textContent, model.descriptions.items);
s.state({ selected: '__proto__' }); assert.equal(s.byId('menu-tip').textContent, model.descriptions.items);
for (const selected of Object.keys(model.descriptions)) { s.state({ selected }); assert.equal(s.byId('menu-tip').textContent, model.description(selected)); }
s.state({ selected: null }); assert.equal(s.byId('menu-tip').textContent, model.description(null));
s.state({ failed: true }); assert.equal(s.byId('menu-warning').hidden, false);
s.state({ failed: false }); assert.equal(s.byId('menu-warning').hidden, true);
for (const image of s.probes) {
  assert.ok(fs.existsSync(path.resolve(__dirname, image.src.split('?')[0])), image.src);
  image.emit('error'); assert.equal(s.byId('menu-warning').hidden, false);
  image.emit('load'); assert.equal(s.byId('menu-warning').hidden, true);
}
for (const phase of Object.keys(time.phases)) {
  s.byId('menu-phase').value = phase; s.byId('menu-phase').emit('change');
  assert.equal(s.byId('menu-time').attributes['aria-label'], '時間帯：' + time.phases[phase].label);
  assert.ok(s.byId('menu-time').innerHTML.includes(`data-phase="${phase}"`));
}
s.byId('menu-character').value = 'karima'; s.byId('menu-character').emit('change');
assert.equal(s.messages.at(-1).character, 'karima');
s.byId('menu-effects').checked = false; s.byId('menu-effects').emit('change');
assert.equal(s.messages.at(-1).effects, false); assert.equal(s.byId('menu-replay-time').disabled, true);
s.byId('menu-effects').checked = true; s.byId('menu-effects').emit('change');
s.doc.hidden = true; s.doc.emit('visibilitychange');
assert.equal(s.byId('menu-screen').style.properties['--motion'], 'paused'); assert.equal(s.messages.at(-1).effects, false);
s.doc.hidden = false; s.doc.emit('visibilitychange'); assert.equal(s.messages.at(-1).effects, true);
s.media.matches = true; s.media.emit('change'); assert.equal(s.byId('menu-screen').dataset.reduced, 'true');
s.byId('menu-background').value = 'gray'; s.byId('menu-background').emit('change');
assert.equal(s.byId('menu-background-image').hidden, true);
s.byId('map-open').emit('click'); assert.equal(s.byId('map-dialog').open, true);
for (const button of s.modes) {
  button.emit('click'); assert.ok(s.byId('map-mode-note').textContent.includes(model.mapModes[button.dataset.mapMode]));
  assert.equal(button.attributes['aria-pressed'], 'true');
}
s.app.destroy(); s.app.destroy(); assert.equal(s.disconnected(), true);
const count = s.messages.length; s.byId('menu-character').emit('change'); s.win.emit('pageshow');
assert.equal(s.messages.length, count); assert.ok(s.probes.every(image => !image.src));
const fallback = setup({ fallback: true, reduced: true });
fallback.byId('map-open').emit('click'); assert.equal(fallback.byId('map-dialog').attributes.open, '');
fallback.close.emit('click', { preventDefault() {} }); assert.equal(fallback.byId('map-dialog').attributes.open, undefined);
assert.equal(fallback.byId('menu-replay-time').disabled, true); fallback.app.destroy();
const missingFrame = setup({ frameFailed: true });
assert.equal(missingFrame.byId('menu-device').dataset.frame, 'false');
assert.equal(missingFrame.byId('menu-warning').hidden, false);
missingFrame.app.destroy();
// file: iframeの橋渡しは親ウィンドウだけを受け入れる。
const bridge = fs.readFileSync(path.join(__dirname, 'menu-embed.js'), 'utf8');
function setupBridge(embedded) {
  const doc = node(), win = node(), messages = [], elements = new Map();
  const byId = id => { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); };
  doc.getElementById = byId;
  win.parent = { postMessage(message) { messages.push(message); } }; win.SolarWheel = { commands: Object.keys(model.descriptions).map(id => ({ id })) };
  let selected = -1;
  const buttons = win.SolarWheel.commands.map((command, index) => ({ click() { selected = index; doc.emit('click'); } }));
  byId('labels').querySelector = () => buttons[selected] || null; byId('labels').querySelectorAll = () => buttons;
  const images = ['disk-panes', 'disk-frame', 'rays-panes', 'rays-frame', 'wheel-panes'].map(id => Object.assign(byId(id), { complete: true, naturalWidth: 100 }));
  byId('character').dispatchEvent = event => byId('character').emit(event.type);
  byId('selection-effects').dispatchEvent = event => byId('selection-effects').emit(event.type);
  const context = vm.createContext({ window: win, document: doc, URLSearchParams, location: { search: embedded ? '?embed=menu' : '' }, Event: class { constructor(type) { this.type = type; } } });
  vm.runInContext(bridge, context);
  return { win, doc, byId, messages, images };
}
const standalone = setupBridge(false); assert.equal(standalone.messages.length, 0);
const b = setupBridge(true); assert.equal(b.messages[0].selected, null);
const config = { type: 'solar-menu-config', character: 'karima', effects: false, select: 'friends' };
b.win.emit('message', { source: {}, data: config }); assert.equal(b.byId('character').value, '');
b.win.emit('message', { source: b.win.parent, data: config });
assert.equal(b.byId('character').value, 'karima'); assert.equal(b.byId('selection-effects').checked, false);
assert.equal(b.messages.at(-1).selected, 'friends');
const before = b.messages.length; b.doc.emit('click'); assert.equal(b.messages.length, before);
b.images[0].naturalWidth = 0; b.images[0].emit('error'); assert.equal(b.messages.at(-1).failed, true);
b.images[0].complete = false; b.images[0].emit('load'); assert.equal(b.messages.at(-1).loading, true);
console.log('PASS: 端末枠の比率／ON・OFF／失敗時復旧・全体配置・素材参照・iframe初期化／送信元検証・説明連動・時間帯／キャラ／背景・演出停止・マップ入口・破棄。描画QAは未実施。');
