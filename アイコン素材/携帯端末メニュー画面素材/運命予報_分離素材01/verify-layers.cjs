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
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      value: { 'surface-color': '#10253b', 'surface-opacity': '78', 'star-opacity': '13', background: 'checker' }[id] || '',
      hidden: false, checked: true, dataset: {}, handlers: {}, textContent: '',
      style: { properties: {}, setProperty(name, value) { this.properties[name] = value; } },
      addEventListener(name, callback) { this.handlers[name] = callback; }
    });
  }
  return elements.get(id);
}
const layerIds = ['beta-layer', 'frame-layer', 'surface-layer', 'star-layer', 'text-layer'];
const toggles = layerIds.map(id => Object.assign(element(`toggle-${id}`), { dataset: { layer: id } }));
const images = ['beta-layer', 'frame-layer', 'star-layer'].map(element);
const context = vm.createContext({ document: {
  getElementById: element,
  querySelectorAll(selector) { return selector === '[data-layer]' ? toggles : selector === 'img' ? images : []; }
} });
scripts.forEach(script => vm.runInContext(script, context));
assert.equal(element('stage').style.properties['--surface-opacity'], .78);
element('surface-opacity').value = '47';
element('surface-opacity').handlers.input();
assert.equal(element('stage').style.properties['--surface-opacity'], .47);
assert.equal(element('surface-value').textContent, '47%');
element('surface-color').value = '#243449';
element('surface-color').handlers.input();
assert.equal(element('stage').style.properties['--surface-color'], '#243449');
element('star-opacity').value = '8';
element('star-opacity').handlers.input();
assert.equal(element('stage').style.properties['--star-opacity'], .08);
for (const toggle of toggles) {
  toggle.checked = false;
  toggle.handlers.change();
  assert.equal(element(toggle.dataset.layer).hidden, true);
}
images[0].handlers.error();
assert.equal(element('asset-warning').hidden, false);
assert.ok(element('asset-warning').textContent.includes('読み込めません'));
element('reset').handlers.click();
assert.equal(element('surface-opacity').value, '78');
assert.equal(element('stage').style.properties['--surface-opacity'], .78);
assert.equal(element('stage').style.properties['--star-opacity'], .13);
for (const id of layerIds) assert.equal(element(id).hidden, false);
console.log('PASS: 参照、SVG輪郭、構文、色、不透明度、星、表示切替、読み込みエラー、リセット');
