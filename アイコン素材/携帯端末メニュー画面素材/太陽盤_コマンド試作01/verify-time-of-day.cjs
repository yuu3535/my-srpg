'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('./time-of-day.js');
const { mount } = require('./time-of-day-demo.js');

// 時間は自動で進まず、同じ項目の再クリックも点火のように毎回再生しない。
let state = model.createState();
assert.equal(state.phase, 'evening');
assert.equal(model.change(state, { type: 'phase', value: 'evening' }), state);
assert.equal(model.change(state, { type: 'phase', value: '__proto__' }), state);
state = model.change(state, { type: 'phase', value: 'morning' });
assert.equal(state.replay, 1);
state = model.change(state, { type: 'pause' });
assert.equal(model.playback(state), 'paused');
state = model.change(state, { type: 'pause' });
state = model.change(state, { type: 'visibility', value: true });
assert.equal(model.playback(state), 'paused');
state = model.change(state, { type: 'reduce', value: true });
assert.equal(model.change(state, { type: 'replay' }), state);
assert.throws(() => model.icon('unknown', 'test'), RangeError);
assert.throws(() => model.icon('day', '"><script>'), TypeError);
for (const phase of Object.keys(model.phases)) {
  const markup = model.icon(phase, 'check-' + phase);
  assert.ok(markup.includes(model.art.src));
  assert.ok(markup.includes(`data-phase="${phase}"`));
  assert.ok(markup.includes('aria-hidden="true"'));
  assert.doesNotMatch(markup, /<svg|<path|<circle/);
}
assert.notEqual(model.icon('morning', 'placed'), model.icon('morning', 'large'));
assert.equal((model.icon('night', 'check-night').match(/class="art-piece twinkle/g) || []).length, 2);
const texture = fs.readFileSync(path.join(__dirname, model.art.src.split('?')[0]));
assert.equal(texture.subarray(1, 4).toString(), 'PNG');
assert.equal(texture.readUInt32BE(16), model.art.width);
assert.equal(texture.readUInt32BE(20), model.art.height);
assert.equal(texture[25], 6, '透過RGBA素材');
for (const value of Object.values(model.rects)) {
  for (const rect of typeof value[0] === 'number' ? [value] : value) {
    assert.ok(rect[0] >= 0 && rect[1] >= 0 && rect[2] <= model.art.width && rect[3] <= model.art.height);
    assert.ok(rect[2] > rect[0] && rect[3] > rect[1]);
  }
}
for (const [name, anchor, scale, center] of [
  ['morningRays', [324,455], .21, [80,57]], ['eveningRays', [328,990], .21, [80,57]],
  ['dayRays', [937,375], .15, [80,32]], ['nightStars', [930,932], .22, [80,32]]
]) {
  for (const rect of model.rects[name]) {
    const [x,y,w,h] = model.destination(rect, anchor, center, scale);
    assert.ok(x >= 0 && y >= 0 && x + w <= 160 && y + h <= 64, name + 'の静止形が枠内');
  }
}
assert.ok(model.rects.morningRays[0][3] - model.rects.morningRays[0][1] > 100);
assert.ok(model.rects.eveningRays.every((r) => r[2] - r[0] > (r[3] - r[1]) * 8));
for (const phase of ['morning', 'evening']) assert.ok(model.icon(phase, 'glint-' + phase).includes('horizon-glint'));

class Target {
  constructor() { this.events = new Map(); this.dataset = {}; this.attrs = {}; this.hidden = false; this.textContent = ''; this.innerHTML = ''; this.disabled = false; this.styles = {}; this.style = { setProperty: (key, value) => { this.styles[key] = value; } }; }
  addEventListener(name, handler) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(handler); }
  removeEventListener(name, handler) { this.events.get(name)?.delete(handler); }
  emit(name, data = {}) { [...(this.events.get(name) || [])].forEach((handler) => handler(data)); }
  setAttribute(name, value) { this.attrs[name] = value; }
  listeners() { return [...this.events.values()].reduce((total, set) => total + set.size, 0); }
}
function fixture(reduced = false, modern = true) {
  const ids = ['scene', 'replay', 'pause', 'placed-icon', 'large-icon', 'background', 'scene-background', 'preview', 'status', 'background-warning', 'still-grid', 'icon-atlas-preload', 'art-loading', 'art-warning'];
  const elements = Object.fromEntries(ids.map((id) => [id, new Target()]));
  elements.preview.clientWidth = 422;
  elements.background.value = 'corridor';
  elements['scene-background'].complete = true;
  elements['scene-background'].naturalWidth = 1200;
  elements['icon-atlas-preload'].complete = true;
  elements['icon-atlas-preload'].naturalWidth = 1254;
  const buttons = Object.keys(model.phases).map((phase) => { const item = new Target(); item.dataset.phaseButton = phase; return item; });
  const doc = new Target(); doc.getElementById = (id) => elements[id]; doc.querySelectorAll = () => buttons;
  const win = new Target(), media = new Target(); media.matches = reduced;
  win.matchMedia = () => media;
  let disconnected = false;
  if (modern) win.ResizeObserver = class { constructor(handler) { this.handler = handler; } observe() {} disconnect() { disconnected = true; } };
  else {
    media.addListener = (handler) => Target.prototype.addEventListener.call(media, 'change', handler);
    media.removeListener = (handler) => Target.prototype.removeEventListener.call(media, 'change', handler);
    media.addEventListener = undefined;
  }
  const app = mount(doc, win, model);
  return { app, doc, win, media, elements, buttons, disconnected: () => disconnected };
}
const f = fixture();
assert.equal(f.elements.scene.styles['--scene-scale'], '0.5');
assert.equal(f.elements['placed-icon'].attrs['aria-label'], '夕方');
assert.equal(f.buttons[2].attrs['aria-pressed'], 'true');
assert.equal(f.elements['art-loading'].hidden, true);
assert.equal(f.elements['art-warning'].hidden, true);
f.elements['icon-atlas-preload'].naturalWidth = 0;
f.elements['icon-atlas-preload'].emit('error');
assert.equal(f.elements['art-warning'].hidden, false);
f.elements['icon-atlas-preload'].naturalWidth = 1254;
f.elements['icon-atlas-preload'].emit('load');
assert.equal(f.elements['art-warning'].hidden, true);
f.buttons[0].emit('click');
assert.equal(f.app.getState().phase, 'morning');
assert.equal(f.elements['placed-icon'].attrs['aria-label'], '朝');
const replay = f.app.getState().replay;
f.buttons[0].emit('click');
assert.equal(f.app.getState().replay, replay);
f.elements.replay.emit('click');
assert.equal(f.app.getState().replay, replay + 1);
f.elements.pause.emit('click');
assert.equal(f.elements.scene.styles['--motion'], 'paused');
assert.equal(f.elements.pause.textContent, '再開');
f.buttons[3].emit('click');
assert.equal(f.elements.scene.styles['--motion'], 'paused');
f.elements.pause.emit('click');
assert.equal(f.elements.scene.styles['--motion'], 'running');
f.doc.hidden = true; f.doc.emit('visibilitychange');
assert.equal(f.elements.scene.styles['--motion'], 'paused');
f.doc.hidden = false; f.doc.emit('visibilitychange');
assert.equal(f.elements.scene.styles['--motion'], 'running');
f.win.emit('pagehide', { persisted: true });
assert.equal(f.elements.scene.styles['--motion'], 'paused');
f.win.emit('pageshow');
assert.equal(f.elements.scene.styles['--motion'], 'running');
f.media.matches = true; f.media.emit('change');
assert.equal(f.elements.scene.dataset.reduced, 'true');
assert.equal(f.elements.replay.disabled, true);
assert.equal(f.elements.pause.disabled, true);
f.media.matches = false; f.media.emit('change');
assert.equal(f.elements.replay.disabled, false);
f.elements['scene-background'].naturalWidth = 0;
f.elements['scene-background'].emit('error');
assert.equal(f.elements['background-warning'].hidden, false);
f.elements.background.value = 'light'; f.elements.background.emit('change');
assert.equal(f.elements['scene-background'].hidden, true);
assert.equal(f.elements['background-warning'].hidden, true);
assert.equal(f.elements.scene.dataset.background, 'light');
f.win.emit('pagehide', { persisted: false });
assert.equal(f.disconnected(), true);
assert.equal(f.elements.scene.styles['--motion'], 'paused');
for (const item of [f.doc, f.win, f.media, ...Object.values(f.elements), ...f.buttons]) assert.equal(item.listeners(), 0);
const stopped = f.app.getState();
f.app.dispatch({ type: 'phase', value: 'evening' });
assert.deepEqual(f.app.getState(), stopped);
f.app.destroy();
const legacy = fixture(true, false);
assert.equal(legacy.elements.scene.dataset.reduced, 'true');
legacy.elements.preview.clientWidth = 844; legacy.win.emit('resize');
assert.equal(legacy.elements.scene.styles['--scene-scale'], '1');
legacy.app.destroy();
assert.equal(legacy.media.listeners(), 0);
assert.equal(legacy.win.listeners(), 0);

// 描画ではなく、単発/ループ・寸法・停止の実装契約を検査する。
const css = fs.readFileSync(path.join(__dirname, 'time-of-day.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'time-of-day-demo.html'), 'utf8');
assert.match(css, /aspect-ratio: 844 \/ 390/);
assert.match(css, /grid-template-columns: 1fr 180px/);
assert.match(css, /justify-items: center/);
assert.match(css, /animation: sunrise[^;]*both;/);
assert.match(css, /animation: sunset[^;]*both;/);
assert.doesNotMatch(css, /animation: (sunrise|sunset)[^;]*infinite/);
assert.match(css, /animation: daylight[^;]*infinite/);
assert.match(css, /animation: starlight[^;]*infinite/);
assert.match(css, /animation: horizon-light[^;]*infinite/);
assert.match(css, /transform-box: border-box/);
assert.match(css, /transform: scale\(1\.08\) rotate\(4deg\)/);
assert.match(css, /transform: translateY\(-15%\) scale\(1\.4\)/);
assert.match(css, /clip-path: inset\(0 0 14\.0625% 0\)/);
assert.match(css, /animation-play-state: var\(--motion\) !important/);
assert.match(css, /prefers-reduced-motion/);
const keyframes = css.slice(css.indexOf('@keyframes sunrise'), css.indexOf('.below-preview'));
assert.doesNotMatch(keyframes, /(?:top|left|width|height|filter|box-shadow):/);
assert.ok(html.includes('笑う声が聞こえたら、振り返らないこと。'));
assert.ok(fs.existsSync(path.join(__dirname, '../太陽盤_試作02/corridor-reference.png')));
console.log('時間帯アイコン：状態・単発/ループ・停止・復帰・失敗・後始末の非描画検証成功');
