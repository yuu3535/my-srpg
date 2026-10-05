// 配置編集の座標と操作・保存分岐を模擬。実描画／タッチQAは別途確認する。
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('./menu-preview-model.js');
const { mount } = require('./menu-position.js');
new vm.Script(fs.readFileSync(path.join(__dirname, 'menu-position.js'), 'utf8'));
assert.deepEqual(model.positions().map, { left: 330.243, top: 27.612 });
assert.deepEqual(model.positions({ map: { left: -20, top: 500 } }).map, { left: 0, top: 166 });
assert.deepEqual(model.positions({ tip: { left: '', top: NaN } }).tip, { left: 344.994, top: 336.504 });
assert.deepEqual(model.positions({ time: null }).time, { left: 652.622, top: 10.003 });
assert.equal(model.positions({ fortune: { left: 25.123456, top: 10.234567 } }).fortune.left, 25.123);
assert.deepEqual(Object.keys(model.settings(model.positions()).positions), ['map', 'tip', 'time', 'fortune']);
assert.equal(model.normalizeTipHeight(-20), 22);
assert.equal(model.normalizeTipHeight(100), 48);
assert.equal(model.normalizeTipHeight(''), 28);
assert.equal(model.settings(model.positions()).tipHeight, 28);
assert.equal(model.positions({ tip: { left: 200, top: 365 } }, model.boxes, 48).tip.top, 342);
function node() {
  return {
    handlers: new Map(), attributes: {}, dataset: {}, value: '', checked: false, hidden: false, capture: null,
    style: { properties: {}, setProperty(key, value) { this.properties[key] = value; } },
    addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(handler); },
    removeEventListener(type, handler) { this.handlers.get(type)?.delete(handler); },
    async emit(type, event = {}) { for (const handler of [...(this.handlers.get(type) || [])]) await handler(event); },
    setAttribute(key, value) { this.attributes[key] = value; },
    focus() { this.focused = true; }, select() { this.selected = true; },
    getBoundingClientRect() { return { width: 422, height: 195 }; },
    setPointerCapture(id) { this.capture = id; }, hasPointerCapture(id) { return this.capture === id; },
    releasePointerCapture() { this.capture = null; },
    remove() { this.removed = true; }
  };
}
function setup({ saved = null, blocked = false, copyFailure = false, downloadFailure = false } = {}) {
  const elements = new Map(), storage = new Map(), copied = [], blobs = [], downloads = [], revoked = [], timers = new Map();
  if (saved !== null) storage.set('solar-menu-layout-v01', saved);
  const byId = id => { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); };
  const doc = { getElementById: byId, body: { appendChild() {} }, createElement() {
    const link = node(); link.click = () => downloads.push(link); return link;
  } };
  const win = node();
  win.localStorage = { getItem(key) { if (blocked) throw new Error('blocked'); return storage.get(key) || null; },
    setItem(key, value) { if (blocked) throw new Error('blocked'); storage.set(key, value); } };
  win.navigator = { clipboard: { async writeText(value) { if (copyFailure) throw new Error('denied'); copied.push(value); } } };
  win.Blob = Blob; win.URL = { createObjectURL(blob) { if (downloadFailure) throw new Error('denied'); blobs.push(blob); return 'blob:test-' + blobs.length; }, revokeObjectURL(url) { revoked.push(url); } };
  let timerId = 0; win.setTimeout = callback => { const id = ++timerId; timers.set(id, () => { timers.delete(id); callback(); }); return id; }; win.clearTimeout = id => timers.delete(id);
  const app = mount(doc, win, model);
  return { byId, win, app, storage, copied, blobs, downloads, revoked, timers };
}
function pointer(extra = {}) { return { isPrimary: true, button: 0, pointerId: 3, clientX: 100, clientY: 100, preventDefault() {}, ...extra }; }
(async () => {
  const s = setup();
  assert.equal(s.byId('move-map').hidden, true);
  assert.equal(s.byId('map-open').style.properties['--position-offset'], 'translate(0px, 0px)');
  assert.equal(s.byId('fortune-top').max, '96');
  assert.equal(s.storage.size, 0, '読み込みだけでは保存値を上書きしない');
  assert.equal(s.byId('menu-tip').style.height, '28px');
  await s.byId('move-map').emit('pointerdown', pointer()); assert.equal(s.byId('move-map').capture, null);
  s.byId('menu-edit-layout').checked = true; await s.byId('menu-edit-layout').emit('change');
  for (const id of Object.keys(model.boxes)) assert.equal(s.byId('move-' + id).hidden, false);
  const map = s.byId('move-map');
  await map.emit('pointerdown', pointer({ button: 2 })); assert.equal(map.capture, null);
  await map.emit('pointerdown', pointer({ isPrimary: false })); assert.equal(map.capture, null);
  await map.emit('pointerdown', pointer()); assert.equal(map.capture, 3);
  await map.emit('pointermove', pointer({ pointerId: 4, clientX: 200 })); assert.equal(s.byId('map-left').value, '330.243');
  await map.emit('pointermove', pointer({ clientX: 90, clientY: 95 }));
  assert.equal(s.byId('map-left').value, '310.243'); assert.equal(s.byId('map-top').value, '17.612', '表示倍率の半分なら20/10px移動');
  assert.equal(s.byId('map-open').style.properties['--position-offset'], 'translate(-20px, -10px)');
  assert.equal(s.byId('move-map').style.transform, 'translate(-20px, -10px)');
  assert.equal(s.storage.size, 0, '連続移動中は保存を連打しない');
  await map.emit('pointerup', pointer()); assert.equal(map.capture, null);
  assert.equal(JSON.parse(s.storage.get('solar-menu-layout-v01')).positions.map.left, 310.243);
  await map.emit('keydown', { key: 'ArrowLeft', shiftKey: true, preventDefault() {} });
  assert.equal(s.byId('map-left').value, '300.243');
  await map.emit('pointerdown', pointer());
  await map.emit('pointermove', pointer({ clientX: -1000, clientY: 1000 }));
  await map.emit('pointercancel', pointer());
  assert.equal(s.byId('map-left').value, '0'); assert.equal(s.byId('map-top').value, '166');
  await map.emit('pointermove', pointer({ clientX: 500 })); assert.equal(s.byId('map-left').value, '0');
  const positions = { map: [100, 40], tip: [200, 300], time: [500, 20], fortune: [620, 80] };
  for (const [id, [left, top]] of Object.entries(positions)) {
    s.byId(id + '-left').value = String(left); s.byId(id + '-top').value = String(top);
    await s.byId(id + '-left').emit('change');
    assert.equal(s.byId(id + '-left').value, String(left)); assert.equal(s.byId(id + '-top').value, String(top));
  }
  const otherBefore = JSON.parse(s.byId('menu-layout-json').value).positions.fortune;
  s.byId('tip-height').value = '24'; await s.byId('tip-height').emit('input');
  assert.equal(s.byId('menu-tip').style.height, '24px');
  assert.equal(s.byId('move-tip').style.height, '24px');
  assert.equal(s.byId('tip-height-number').value, '24');
  assert.equal(s.byId('tip-height-value').textContent, '24px');
  assert.equal(s.byId('tip-top').max, '366');
  await s.byId('tip-height').emit('change');
  assert.equal(JSON.parse(s.storage.get('solar-menu-layout-v01')).tipHeight, 24);
  assert.deepEqual(JSON.parse(s.byId('menu-layout-json').value).positions.fortune, otherBefore);
  s.byId('tip-height-number').value = ''; await s.byId('tip-height-number').emit('change');
  assert.equal(s.byId('menu-tip').style.height, '24px', '空欄なら直前の高さを保持');
  s.byId('tip-top').value = '365'; await s.byId('tip-top').emit('change');
  s.byId('tip-height-number').value = '80'; await s.byId('tip-height-number').emit('change');
  assert.equal(s.byId('menu-tip').style.height, '48px');
  assert.equal(s.byId('tip-top').value, '342', '高くしても下端を画面内に保持');
  assert.equal(s.byId('tip-left').value, '200', '高さ調整ではXを変更しない');
  await s.byId('tip-reset-height').emit('click');
  assert.equal(s.byId('menu-tip').style.height, '28px');
  assert.equal(s.byId('tip-top').value, '342', '高さだけのリセットは配置を戻さない');
  s.byId('tip-height-number').value = '26'; await s.byId('tip-height-number').emit('change');
  s.byId('time-left').value = ''; await s.byId('time-left').emit('change'); assert.equal(s.byId('time-left').value, '500');
  assert.deepEqual(s.byId('menu-wheel').style.properties, {}, '太陽盤・コマンドは固定');
  s.byId('menu-edit-layout').checked = false; await s.byId('menu-edit-layout').emit('change');
  assert.equal(s.byId('move-map').hidden, true);
  await map.emit('keydown', { key: 'ArrowRight', preventDefault() { throw new Error('should not run'); } });
  assert.equal(s.byId('map-left').value, '100');
  await s.byId('menu-copy-layout').emit('click');
  const json = JSON.parse(s.copied[0]); assert.equal(json.schema, model.schema); assert.equal(json.positionUnit, 'pixels');
  assert.deepEqual(json.referenceResolution, { width: 844, height: 390 }); assert.equal(json.positions.fortune.top, 80);
  assert.equal(json.tipHeight, 26);
  const restored = setup({ saved: s.copied[0] }); assert.equal(restored.byId('fortune-top').value, '80');
  assert.equal(restored.byId('menu-tip').style.height, '26px'); restored.app.destroy();
  const old = { ...json }; delete old.tipHeight;
  const legacy = setup({ saved: JSON.stringify(old) });
  assert.equal(legacy.byId('menu-tip').style.height, '28px', '以前の配置JSONは高さ28pxとして復元');
  assert.equal(legacy.byId('fortune-top').value, '80'); legacy.app.destroy();
  await s.byId('menu-download-layout').emit('click');
  assert.equal(s.downloads[0].download, 'solar-menu-layout.json'); assert.equal(s.downloads[0].removed, true);
  assert.deepEqual(JSON.parse(await s.blobs[0].text()), json); assert.equal(s.revoked.length, 0);
  [...s.timers.values()].forEach(callback => callback()); assert.equal(s.revoked[0], 'blob:test-1');
  await s.byId('menu-reset-layout').emit('click'); assert.equal(s.byId('map-left').value, '330.243'); assert.equal(s.byId('fortune-top').value, '75.997');
  assert.equal(s.byId('menu-tip').style.height, '28px');
  const unavailable = setup({ blocked: true, copyFailure: true, downloadFailure: true });
  unavailable.byId('tip-left').value = '30'; await unavailable.byId('tip-left').emit('change');
  assert.ok(unavailable.byId('menu-layout-status').textContent.includes('自動保存できません'));
  await unavailable.byId('menu-copy-layout').emit('click'); assert.equal(unavailable.byId('menu-layout-json').selected, true);
  assert.ok(unavailable.byId('menu-layout-export-status').textContent.includes('Ctrl+C'));
  await unavailable.byId('menu-download-layout').emit('click'); assert.ok(unavailable.byId('menu-layout-export-status').textContent.includes('開始できません'));
  for (const saved of ['{bad', JSON.stringify({ schema: 'other' }), 'null']) {
    const invalid = setup({ saved }); assert.equal(invalid.byId('map-left').value, '330.243'); invalid.app.destroy();
  }
  s.app.destroy(); s.app.destroy(); unavailable.app.destroy();
  assert.equal(s.timers.size, 0);
  s.byId('map-left').value = '100'; await s.byId('map-left').emit('change');
  assert.equal(JSON.parse(s.storage.get('solar-menu-layout-v01')).positions.map.left, 330.243, '破棄後は入力イベントを処理しない');
  console.log('PASS: 4部品の独立移動、チップ高さと範囲・位置補正・単独リセット、保存／JSON・旧設定互換、編集・コピー／書き出し・失敗分岐・後始末。描画QA未実施。');
})().catch(error => { console.error(error); process.exitCode = 1; });
