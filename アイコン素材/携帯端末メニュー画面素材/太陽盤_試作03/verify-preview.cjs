// DOMの代用品で配置・透過・保存を確認。ブラウザの描画確認を代替するものではない。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const preview = path.resolve(__dirname, '../太陽盤_試作01/preview.html');
const html = fs.readFileSync(preview, 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
assert.match(html, /class="workbench"/);
assert.match(html, /class="preview-panel"/);
assert.match(html, /class="editor-panel"/);
assert.match(html, /class="color-panel"/);
assert.match(html, /class="placement-panel"/);
assert.match(html, /<details><summary>/);
assert.doesNotMatch(html, /<details\s+open/);
const elements = {};
function mockElement() {
  let elementId = '';
  return {
    style: { setProperty(name, value) { this[name] = value; } }, value: '', hidden: false, checked: false, events: {}, children: [], attributes: {},
    get id() { return elementId; }, set id(value) { elementId = value; elements[value] = this; },
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.events[name] = handler; },
    animate() { return { cancel() {} }; }, focus() {}, select() {},
    setPointerCapture() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 106, height: 106 }; }
  };
}
for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
  const tag = match[0];
  const attribute = name => (tag.match(new RegExp('\\b' + name + '="([^"]*)"')) || [])[1];
  elements[match[1]] = {
    ...mockElement(), value: attribute('value') || '', min: attribute('min'), max: attribute('max'),
    hidden: /\bhidden\b/.test(tag), checked: false, events: {},
    addEventListener(name, handler) { this.events[name] = handler; },
    animate() { return { cancel() {} }; }, focus() {}, select() {}
  };
}
elements.version.value = 'v03';
elements.background.value = '#85878b';
const saved = new Map();
const animationFrames = new Map();
let nextFrame = 0;
function flushFrames() { const callbacks = [...animationFrames.values()]; animationFrames.clear(); callbacks.forEach(callback => callback()); }
const context = vm.createContext({
  document: { getElementById: id => elements[id], createElement: () => mockElement() },
  window: { addEventListener() {}, location: { search: '' } }, navigator: {}, URLSearchParams,
  requestAnimationFrame: callback => { const id = ++nextFrame; animationFrames.set(id, callback); return id; },
  cancelAnimationFrame: id => animationFrames.delete(id),
  matchMedia: () => ({ matches: true }),
  localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }
});
for (const name of ['material-engine.js', 'material-controls.js', 'character-colors.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, name), 'utf8'), context);
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
const run = source => vm.runInContext(source, context);
for (const group of ['disk', 'rays']) {
  elements[group + '-opacity'].value = '0';
  elements[group + '-opacity'].events.input();
  assert.equal(elements[group + '-panes'].style.opacity, 0);
  assert.equal(elements[group + '-frame'].style.opacity, 1);
  assert.equal(elements[group + '-frame'].hidden, false);
}
const raysBefore = JSON.stringify(elements['rays-slot'].style);
elements['disk-size'].value = '360'; elements['disk-x'].value = '120';
elements['disk-y'].value = '90'; elements['disk-angle'].value = '47';
elements['disk-size'].events.input();
assert.equal(elements['disk-slot'].style.width, (360 / 844 * 100) + '%');
assert.equal(elements['disk-slot'].style.left, (120 / 844 * 100) + '%');
assert.equal(elements['disk-slot'].style.top, (90 / 390 * 100) + '%');
assert.equal(elements['disk-rotor'].style.transform, 'rotate(47deg)');
assert.equal(JSON.stringify(elements['rays-slot'].style), raysBefore);
assert.equal(Number(elements['disk-size-number'].value), 360);
elements['disk-x-number'].value = '-95'; elements['disk-x-number'].events.change();
assert.equal(Number(elements['disk-x'].value), -95);
assert.equal(Number(elements['rays-x'].value), 0);
elements['disk-size-number'].value = '9999';
elements['disk-size-number'].events.keydown({ key: 'Enter', preventDefault() {} });
assert.equal(Number(elements['disk-size'].value), 1000);
elements['disk-size-number'].value = '360'; elements['disk-size-number'].events.change();
elements['disk-size-number'].value = ''; elements['disk-size-number'].events.change();
assert.equal(Number(elements['disk-size-number'].value), 360);
elements['material-white-hue'].value = '195';
elements['material-white-hue'].events.input();
flushFrames();
assert.equal(run('settings().materials.white.hue'), 195);
assert.equal(run('settings().materials.white.saturation'), 35);
assert.equal(run('settings().materials.ochre.original'), true);
assert.equal(elements['disk-panes'].style.filter, 'url(#solar-panes-material)');
assert.equal(elements['disk-frame'].style.filter, 'none');
elements['material-gold-gloss'].value = '68'; elements['material-gold-gloss'].events.input(); flushFrames();
assert.equal(elements['disk-frame'].style.filter, 'url(#solar-frame-material)');
elements['materials-off'].checked = true; elements['materials-off'].events.change();
assert.equal(elements['disk-frame'].style.filter, 'none');
assert.equal(run('settings().materials.gold.gloss'), 68);
elements['materials-off'].checked = false; elements['materials-off'].events.change();
elements.save.events.click();
assert.equal(JSON.parse([...saved.values()][0]).disk.size, 360);
assert.equal(JSON.parse([...saved.values()][0]).materials.gold.gloss, 68);
const snapshot = [...saved.values()][0];
run('materialControls.set()');
context.savedSnapshot = snapshot;
assert.equal(run('restore(JSON.parse(savedSnapshot))'), true);
assert.equal(run('settings().materials.white.hue'), 195);
assert.equal(run('settings().materials.gold.gloss'), 68);
assert.equal(run('restore({schema:"bad"})'), false);
run('restore({schema:"solar-dial-author-settings-v03", disk:{size:99999,x:-99999,opacity:NaN}}); render()');
assert.equal(elements['disk-size'].value, 1000);
assert.equal(elements['disk-x'].value, -422);
assert.equal(Number(elements['disk-opacity'].value), 0);
elements['frames-only'].checked = true;
elements['frames-only'].events.change();
assert.equal(elements['disk-panes'].hidden, true);
assert.equal(elements['disk-frame'].hidden, false);
for (const version of ['v01', 'v02', 'v03']) {
  elements.version.value = version; elements.version.events.change();
  for (const group of ['disk', 'rays']) for (const part of ['panes', 'frame']) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(preview), elements[group + '-' + part].src)));
    elements[group + '-' + part].onload();
  }
  assert.equal(elements.loading.hidden, true);
  assert.equal(elements.error.hidden, true);
}
elements['disk-frame'].onerror();
// 再読み込みで1枚失敗した場合のインラインエラーを確認。
run('loadAssets()');
elements['disk-frame'].onerror(); elements['disk-panes'].onload();
elements['rays-frame'].onload(); elements['rays-panes'].onload();
assert.equal(elements.error.hidden, false);
elements.reset.events.click();
assert.equal(elements.version.value, 'v03');
assert.equal(elements['disk-size'].value, 560);
assert.equal(saved.size, 0);
assert.equal(run('settings().materials.white.original'), true);
const whiteWheel = elements['material-controls'].children[0].children[1].children[0];
whiteWheel.events.pointerdown({ button: 0, pointerId: 1, clientX: 105, clientY: 53 });
flushFrames();
assert.equal(run('settings().materials.white.hue'), 90);
whiteWheel.events.pointerup();
whiteWheel.events.keydown({ key: 'End', shiftKey: false, preventDefault() {} });
flushFrames();
assert.equal(run('settings().materials.white.hue'), 360);
whiteWheel.events.keydown({ key: 'ArrowRight', shiftKey: true, preventDefault() {} });
flushFrames();
assert.equal(run('settings().materials.white.hue'), 10);
elements['materials-reset'].events.click();
assert.equal(run('settings().materials.white.original'), true);
assert.equal(elements['disk-size'].value, 560);
for (const match of html.matchAll(/\bsrc="([^"]+)"/g)) assert.ok(fs.existsSync(path.resolve(path.dirname(preview), match[1].split('?')[0])));
// Clipboardが使えないfile表示でも手動コピー欄に値が出る。
Promise.resolve(elements.copy.events.click()).then(() => {
  assert.equal(elements['settings-text'].hidden, false);
  assert.equal(JSON.parse(elements['settings-text'].value).version, 'v03');
  const storedBeforePreset = JSON.stringify([...saved.entries()]);
  elements['disk-angle'].value = '183'; elements['rays-angle'].value = '271';
  elements['disk-x'].value = '-27'; elements['rays-opacity'].value = '73';
  elements['disk-angle'].events.input();
  const beforeColor = JSON.parse(run('JSON.stringify(settings())'));
  elements['karima-silver'].events.click();
  const preset = JSON.parse(run('JSON.stringify(settings())'));
  assert.deepEqual(preset.materials.gold, { original: false, hue: 200, saturation: 10, lightness: 75, shading: 65, gloss: 25 });
  assert.deepEqual(preset.disk, beforeColor.disk);
  assert.deepEqual(preset.rays, beforeColor.rays);
  assert.equal(preset.background, beforeColor.background);
  assert.equal(preset.materials.ochre.hue, 214);
  assert.equal(preset.materials.white.original, true);
  elements['alche-warm'].events.click();
  const alche = JSON.parse(run('JSON.stringify(settings())'));
  assert.equal(alche.materials.gold.original, true);
  assert.equal(alche.materials.white.lightness, 0);
  assert.equal(alche.materials.ochre.hue, 20);
  assert.deepEqual(alche.disk, beforeColor.disk);
  assert.deepEqual(alche.rays, beforeColor.rays);
  run('openCharacterPreset("karima")');
  const initialPreset = JSON.parse(run('JSON.stringify(settings())'));
  assert.deepEqual(initialPreset.disk, { opacity: 50, size: 406, x: -40, y: 195, angle: 0 });
  assert.deepEqual(initialPreset.rays, { opacity: 89, size: 439, x: 0, y: 195, angle: 0 });
  assert.equal(JSON.stringify([...saved.entries()]), storedBeforePreset);
  console.log('PASS: script/assets, opaque frames, transforms/materials, save/restore, bounds, copy fallback, and color-only character switching');
});
