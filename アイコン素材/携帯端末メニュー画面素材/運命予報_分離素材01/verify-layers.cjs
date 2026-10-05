// 素材参照と調整操作の静的確認。ブラウザの描画確認を代替するものではない。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, 'layers-preview.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
scripts.forEach(script => new vm.Script(script));
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(fs.existsSync(path.join(__dirname, match[1])), `参照なし: ${match[1]}`);
}
const svg = fs.readFileSync(path.join(__dirname, 'fortune-blue-surface-v01.svg'), 'utf8');
const surfacePath = svg.match(/d="(M 205[^"]+)"/)[1];
assert.ok(html.includes(`d="${surfacePath}"`), '下地のSVG輪郭を確認ページと一致させる');
const layerIds = ['beta-layer', 'frame-layer', 'surface-layer', 'star-layer', 'text-layer'];
const storageKey = 'fortune-separated-preview-v02';
function setup({ saved = null, blocked = false, clipboardFailure = false, downloadFailure = false, embedded = false } = {}) {
  const elements = new Map();
  const storage = new Map(saved === null ? [] : [[storageKey, saved]]);
  const copied = [], downloads = [], blobs = [], revoked = [], timers = [];
  let created = 0;
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: { 'surface-color': '#10253b', 'surface-opacity': '78', 'star-opacity': '13', background: 'checker', 'heading-font': 'gothic-ui', 'body-font': 'mincho', 'sticker-angle': '0', 'sticker-angle-number': '0' }[id] || '',
        hidden: false, checked: true, dataset: {}, handlers: {}, textContent: '', capture: null, children: [],
        style: { properties: {}, setProperty(name, value) { this.properties[name] = value; } },
        addEventListener(name, callback) { this.handlers[name] = callback; },
        getBoundingClientRect() { return { width: 400, height: 600 }; },
        focus() { this.focused = true; },
        select() { this.selected = true; },
        appendChild(child) { this.children.push(child); },
        click() { downloads.push({ filename: this.download, url: this.href, link: this }); },
        remove() { this.removed = true; },
        setPointerCapture(id) { this.capture = id; },
        hasPointerCapture(id) { return this.capture === id; },
        releasePointerCapture() { this.capture = null; }
      });
    }
    return elements.get(id);
  }
  const toggles = layerIds.map(id => Object.assign(element(`toggle-${id}`), { dataset: { layer: id } }));
  const images = ['beta-image', 'frame-layer', 'star-layer'].map(element);
  const context = vm.createContext({ URLSearchParams, location: { search: embedded ? '?embed=menu' : '' }, document: {
    documentElement: element('document-root'),
    getElementById: element,
    createElement(tag) { return Object.assign(element(`created-${++created}`), { tag }); },
    body: element('document-body'),
    querySelectorAll(selector) { return selector === '[data-layer]' ? toggles : selector === 'img' ? images : []; }
  }, localStorage: {
    getItem(key) { if (blocked) throw new Error('blocked'); return storage.get(key) || null; },
    setItem(key, value) { if (blocked) throw new Error('blocked'); storage.set(key, value); }
  }, navigator: { clipboard: { async writeText(value) { if (clipboardFailure) throw new Error('denied'); copied.push(value); } } },
  Blob,
  URL: {
    createObjectURL(blob) { if (downloadFailure) throw new Error('denied'); blobs.push(blob); return 'blob:test-' + blobs.length; },
    revokeObjectURL(url) { revoked.push(url); }
  }, setTimeout(callback) { timers.push(callback); }
  });
  scripts.forEach(script => vm.runInContext(script, context));
  return { element, toggles, images, storage, copied, downloads, blobs, revoked, timers };
}
const oldSettings = { surfaceColor: '#10253b', surfaceOpacity: 78, starOpacity: 13, headingFont: 'gothic-ui', bodyFont: 'mincho', sticker: { x: 800 / 1024 * 100, y: 20 / 1536 * 100, angle: 0 }, background: 'checker' };
const { element, toggles, images, storage } = setup({ saved: JSON.stringify(oldSettings) });
assert.equal(element('stage').style.properties['--surface-opacity'], .78);
element('surface-opacity').value = '47';
element('surface-opacity').handlers.input();
assert.equal(element('stage').style.properties['--surface-opacity'], .47);
assert.equal(element('surface-value').textContent, '47%（透け感53%）');
for (const value of ['0', '100']) {
  element('surface-opacity').value = value;
  element('surface-opacity').handlers.input();
  assert.equal(element('stage').style.properties['--surface-opacity'], Number(value) / 100);
  for (const id of ['frame-layer', 'star-layer', 'text-layer']) assert.deepEqual(element(id).style.properties, {});
}
element('surface-color').value = '#243449';
element('surface-color').handlers.input();
assert.equal(element('stage').style.properties['--surface-color'], '#243449');
element('star-opacity').value = '8';
element('star-opacity').handlers.input();
assert.equal(element('stage').style.properties['--star-opacity'], .08);
element('heading-font').value = 'meiryo';
element('heading-font').handlers.change();
assert.ok(element('stage').style.properties['--heading-font'].startsWith('Meiryo'));
assert.ok(element('stage').style.properties['--body-font'].startsWith("'Yu Mincho'"));
element('body-font').value = 'gothic';
element('body-font').handlers.change();
assert.ok(element('stage').style.properties['--body-font'].startsWith("'Yu Gothic'"));
for (const id of ['heading-font', 'body-font', 'fortune-font']) {
  const group = element(id).children.find(child => child.tag === 'optgroup');
  assert.ok(group.children.length >= 30, 'PC内の日本語フォント候補を追加');
  assert.ok(group.children.some(option => option.textContent === '02うつくし明朝体'));
  assert.ok(group.children.some(option => option.textContent === '異世明'));
}
element('body-font').value = 'local:源界明朝';
element('body-font').handlers.change();
assert.ok(element('stage').style.properties['--body-font'].startsWith('"源界明朝"'));
element('body-font').value = 'custom';
element('body-font').handlers.change();
assert.equal(element('body-custom-field').hidden, false);
element('body-custom-font').value = '独自"フォント\n名';
element('body-custom-font').handlers.input();
assert.ok(element('stage').style.properties['--body-font'].startsWith('"独自\\"フォント名"'), 'フォント名はCSS文字列として引用する');
element('body-font').value = 'gothic';
element('body-font').handlers.change();
assert.equal(element('body-custom-field').hidden, true);
assert.equal(element('stage').style.properties['--fortune-font'], 'Georgia, serif', '旧設定にFortuneがなくても従来の書体を維持');
const headingBefore = element('stage').style.properties['--heading-font'];
const bodyBefore = element('stage').style.properties['--body-font'];
element('fortune-font').value = 'consolas';
element('fortune-font').handlers.change();
assert.equal(element('stage').style.properties['--fortune-font'], 'Consolas, monospace');
assert.equal(element('stage').style.properties['--heading-font'], headingBefore);
assert.equal(element('stage').style.properties['--body-font'], bodyBefore);
assert.equal(JSON.parse(element('settings-json').value).fortuneFontFamily, 'Consolas');
element('fortune-font').value = 'custom';
element('fortune-custom-font').value = 'Garamond';
element('fortune-font').handlers.change();
assert.equal(element('fortune-custom-field').hidden, false);
assert.ok(element('stage').style.properties['--fortune-font'].startsWith('"Garamond"'));
function pointer(extra = {}) {
  return { isPrimary: true, button: 0, pointerId: 7, clientX: 350, clientY: 30, preventDefault() { this.prevented = true; }, ...extra };
}
const sticker = element('beta-layer');
sticker.handlers.pointerdown(pointer({ button: 2 }));
assert.equal(sticker.capture, null);
sticker.handlers.pointerdown(pointer({ isPrimary: false }));
assert.equal(sticker.capture, null);
sticker.handlers.pointerdown(pointer());
assert.equal(sticker.capture, 7);
assert.equal(sticker.focused, true);
sticker.handlers.pointermove(pointer({ pointerId: 8, clientX: 310 }));
assert.equal(element('sticker-x').value, '78.125');
sticker.handlers.pointermove(pointer({ clientX: 310, clientY: 90 }));
assert.equal(element('sticker-x').value, '68.125');
assert.equal(element('sticker-y').value, '11.302');
sticker.handlers.pointerup(pointer());
assert.equal(sticker.capture, null);
assert.equal(JSON.parse(storage.get(storageKey)).sticker.x, 68.125);
// パーセント座標なので表示を半分にしても同じ割合だけ移動できる。
element('stage').getBoundingClientRect = () => ({ width: 200, height: 300 });
sticker.handlers.pointerdown(pointer());
sticker.handlers.pointermove(pointer({ clientX: 330, clientY: 60 }));
assert.equal(element('sticker-x').value, '58.125');
assert.equal(element('sticker-y').value, '21.302');
sticker.handlers.pointercancel(pointer());
sticker.handlers.pointermove(pointer({ clientX: -1000 }));
assert.equal(element('sticker-x').value, '58.125');
const key = { key: 'ArrowLeft', shiftKey: true, preventDefault() { this.prevented = true; } };
sticker.handlers.keydown(key);
assert.equal(key.prevented, true);
assert.equal(element('sticker-x').value, '58.025');
element('sticker-x').value = '-20'; element('sticker-y').value = '200';
element('sticker-x').handlers.change();
assert.equal(element('sticker-x').value, '0');
assert.equal(element('sticker-y').value, '90.885');
element('sticker-x').value = ''; element('sticker-y').value = 'invalid';
element('sticker-y').handlers.change();
assert.equal(element('sticker-x').value, '0');
assert.equal(element('sticker-y').value, '90.885');
element('reset-sticker').handlers.click();
assert.equal(element('sticker-x').value, '62.898');
assert.equal(element('sticker-y').value, '10.393');
assert.equal(element('stage').style.properties['--sticker-rotation'], '6deg');
element('sticker-angle').value = '90';
element('sticker-angle').handlers.input();
assert.equal(element('stage').style.properties['--sticker-rotation'], '90deg');
assert.equal(element('sticker-angle-number').value, '90');
element('sticker-y').value = '0';
element('sticker-y').handlers.change();
assert.equal(element('sticker-y').value, '1.628', '回転後の外接矩形も画面内に保持');
element('sticker-angle-number').value = '-250';
element('sticker-angle-number').handlers.change();
assert.equal(element('stage').style.properties['--sticker-rotation'], '-180deg');
element('sticker-angle-number').value = 'invalid';
element('sticker-angle-number').handlers.change();
assert.equal(element('stage').style.properties['--sticker-rotation'], '-180deg');
assert.equal(JSON.parse(element('settings-json').value).sticker.angle, -180);
element('reset-sticker').handlers.click();
assert.equal(element('stage').style.properties['--sticker-rotation'], '6deg');
assert.ok(element('stage').style.properties['--heading-font'].startsWith('Meiryo'), 'シールのリセットはフォントを変更しない');
for (const id of ['frame-layer', 'star-layer', 'text-layer']) assert.deepEqual(element(id).style.properties, {}, '移動対象はシールだけ');
assert.ok(html.includes('transform: translateY(9.4%) scale(.9)'), '星の元の位置・縮尺を維持');
// クロップ表示は素材の座標を保持し、画像の再生成や拡大はしない。
assert.ok(Math.abs(190 * 538.9473684211 / 100 - 1024) < .000001);
assert.ok(Math.abs(140 * 1097.1428571429 / 100 - 1536) < .000001);
assert.ok(Math.abs(800 + 190 * -421.0526315789 / 100) < .000001);
for (const toggle of toggles) {
  toggle.checked = false;
  toggle.handlers.change();
  assert.equal(element(toggle.dataset.layer).hidden, true);
}
images[0].handlers.error();
assert.equal(element('asset-warning').hidden, false);
assert.ok(element('asset-warning').textContent.includes('読み込めません'));
element('reset').handlers.click();
assert.equal(element('surface-opacity').value, '59');
assert.equal(element('stage').style.properties['--surface-opacity'], .59);
assert.equal(element('stage').style.properties['--star-opacity'], .26);
assert.equal(element('surface-color').value, '#0d0f11');
assert.equal(element('heading-font').value, 'local:ベストテン-CRT');
assert.equal(element('body-font').value, 'local:源界明朝');
assert.equal(element('fortune-font').value, 'local:Neko_no_Mezame');
assert.equal(element('fortune-custom-font').value, '');
for (const id of layerIds) assert.equal(element(id).hidden, false);
const restored = setup({ saved: JSON.stringify({ surfaceOpacity: 35, surfaceColor: '#243449', starOpacity: 8, headingFont: 'meiryo', bodyFont: 'gothic', sticker: { x: 25, y: 30 }, background: 'dark' }) }).element;
assert.equal(restored('stage').style.properties['--surface-opacity'], .35);
assert.equal(restored('sticker-x').value, '25');
assert.equal(restored('sticker-y').value, '30');
assert.equal(restored('body-font').value, 'gothic');
assert.equal(restored('stage').dataset.background, 'dark');
const invalid = setup({ saved: JSON.stringify({ surfaceOpacity: -9, starOpacity: 150, surfaceColor: 'red', headingFont: '__proto__', bodyFont: 'bad', sticker: { x: 1000, y: 'invalid' } }) }).element;
assert.equal(invalid('stage').style.properties['--surface-opacity'], 0);
assert.equal(invalid('stage').style.properties['--star-opacity'], 1);
assert.equal(invalid('surface-color').value, '#0d0f11');
assert.equal(invalid('heading-font').value, 'local:ベストテン-CRT');
assert.equal(invalid('body-font').value, 'local:源界明朝');
assert.equal(invalid('sticker-x').value, '81.445');
const newRestored = setup({ saved: JSON.stringify({ headingFont: 'local:02うつくし明朝体', bodyFont: 'custom', bodyCustomFont: '異世明', sticker: { x: 30, y: 40, angle: 45 } }) }).element;
assert.ok(newRestored('stage').style.properties['--heading-font'].startsWith('"02うつくし明朝体"'));
assert.ok(newRestored('stage').style.properties['--body-font'].startsWith('"異世明"'));
assert.equal(newRestored('stage').style.properties['--sticker-rotation'], '45deg');
const fortuneRestored = setup({ saved: JSON.stringify({ fortuneFont: 'custom', fortuneCustomFont: 'Book Antiqua' }) }).element;
assert.equal(fortuneRestored('fortune-font').value, 'custom');
assert.equal(fortuneRestored('fortune-custom-font').value, 'Book Antiqua');
assert.ok(fortuneRestored('stage').style.properties['--fortune-font'].startsWith('"Book Antiqua"'));
const chosen = JSON.parse(setup().element('settings-json').value);
const embedPreview = setup({ embedded: true, saved: JSON.stringify(oldSettings) });
assert.equal(embedPreview.element('document-root').dataset.menuEmbed, 'true');
assert.equal(embedPreview.element('beta-layer').disabled, true);
assert.equal(embedPreview.element('beta-layer').tabIndex, -1);
assert.equal(embedPreview.element('stage').style.properties['--surface-opacity'], .59, '全体試作は採用候補の初期値を表示');
assert.equal(embedPreview.storage.get(storageKey), JSON.stringify(oldSettings), '埋め込み表示は単体の保存値を上書きしない');
assert.equal(chosen.surfaceColor, '#0d0f11');
assert.equal(chosen.surfaceOpacity, 59);
assert.equal(chosen.starOpacity, 26);
assert.equal(chosen.sticker.x, 62.89772727272727);
assert.equal(chosen.sticker.y, 10.392992424242424);
assert.equal(chosen.sticker.angle, 6);
assert.equal(chosen.headingFontFamily, 'ベストテン-CRT');
assert.equal(chosen.bodyFontFamily, '源界明朝');
assert.equal(chosen.fortuneFont, 'local:Neko_no_Mezame');
assert.equal(chosen.fortuneFontFamily, 'Neko_no_Mezame');
const latestRestored = setup({ saved: JSON.stringify(chosen) }).element;
assert.equal(latestRestored('fortune-font').value, 'local:Neko_no_Mezame');
assert.ok(latestRestored('stage').style.properties['--fortune-font'].startsWith('"Neko_no_Mezame"'));
for (const options of [{ saved: '{bad json' }, { blocked: true }]) {
  const fallback = setup(options).element;
  assert.equal(fallback('stage').style.properties['--surface-opacity'], .59);
  assert.ok(fallback('save-status').textContent.includes('読み込めなかった'));
  fallback('reset').handlers.click();
  assert.ok(fallback('save-status').textContent.includes(options.blocked ? '保存を使えません' : '保存しました'));
}
// Clipboardとダウンロードはブラウザの権限／保存UIを模擬して分岐を検証する。
(async () => {
  const exports = setup();
  exports.element('sticker-angle').value = '20';
  exports.element('sticker-angle').handlers.input();
  exports.element('fortune-font').value = 'garamond';
  exports.element('fortune-font').handlers.change();
  await exports.element('copy-settings').handlers.click();
  const copiedSettings = JSON.parse(exports.copied[0]);
  assert.equal(copiedSettings.schema, 'fortune-separated-preview-settings-v01');
  assert.deepEqual(copiedSettings.referenceResolution, { width: 1024, height: 1536 });
  assert.equal(copiedSettings.sticker.angle, 20);
  assert.equal(copiedSettings.sticker.positionUnit, 'percent');
  assert.equal(copiedSettings.headingFontFamily, 'ベストテン-CRT');
  assert.equal(copiedSettings.fortuneFontFamily, 'Garamond');
  assert.ok(exports.element('export-status').textContent.includes('コピーしました'));
  exports.element('download-settings').handlers.click();
  assert.equal(exports.downloads[0].filename, 'fortune-preview-settings.json');
  assert.equal(exports.blobs[0].type, 'application/json;charset=utf-8');
  assert.deepEqual(JSON.parse(await exports.blobs[0].text()), copiedSettings);
  assert.equal(exports.downloads[0].link.removed, true);
  assert.equal(exports.revoked.length, 0, 'クリック直後にはURLを破棄しない');
  exports.timers.forEach(callback => callback());
  assert.equal(exports.revoked[0], exports.downloads[0].url);
  const unavailable = setup({ blocked: true, clipboardFailure: true, downloadFailure: true });
  await unavailable.element('copy-settings').handlers.click();
  assert.equal(unavailable.element('settings-json').selected, true);
  assert.ok(unavailable.element('export-status').textContent.includes('Ctrl+C'));
  unavailable.element('download-settings').handlers.click();
  assert.ok(unavailable.element('export-status').textContent.includes('開始できません'));
  assert.equal(JSON.parse(unavailable.element('settings-json').value).surfaceOpacity, 59, '保存不可でも書き出し値を用意');
  const roundTrip = setup({ saved: exports.copied[0] }).element;
  assert.equal(roundTrip('stage').style.properties['--sticker-rotation'], '20deg');
  assert.equal(roundTrip('fortune-font').value, 'garamond');
  console.log('PASS: 原作者設定を初期値化、Fortuneの独立フォント／直接指定／保存復元、既存操作・旧設定互換、JSONコピー／ダウンロード、固定枠・星');
})().catch(error => { console.error(error); process.exitCode = 1; });
