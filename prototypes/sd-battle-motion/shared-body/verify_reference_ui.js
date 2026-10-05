/* ブラウザを起動しないUIロジックの単体テスト。実画面の目視確認を代替しない。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('./fit-core.js');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
function harness(failedFile = null) {
  const elements = {}, draws = [];
  function element(id, attrs = '') {
    const classes = new Set(), handlers = {};
    const el = { id, value: attrs.match(/\bvalue="([^"]*)"/)?.[1] || '', checked: /\bchecked\b/.test(attrs), disabled: /\bdisabled\b/.test(attrs), hidden: /\bhidden\b/.test(attrs), textContent: '', handlers,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) },
      addEventListener: (type, fn) => { handlers[type] = fn; }, setAttribute: (name, value) => { el[name] = value; }, click: () => handlers.click?.(),
      querySelector: () => el.message ||= { textContent: '' }
    };
    if (id === 'comparison' || id === 'fitting' || id === 'mini' || id === 'silhouette-canvas') {
      el.width = Number(attrs.match(/\bwidth="(\d+)"/)?.[1] || 0); el.height = Number(attrs.match(/\bheight="(\d+)"/)?.[1] || 0);
      const stack = [];
      const ctx = { globalAlpha: 1, save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); }, clearRect() { for (let i = draws.length - 1; i >= 0; i--) if (draws[i].canvas === id) draws.splice(i, 1); },
        translate() {}, scale() {}, rotate() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fillRect() {},
        drawImage(img) { draws.push({ canvas: id, file: img.src || 'silhouette', alpha: this.globalAlpha }); }
      };
      el.getContext = () => ctx;
    }
    return el;
  }
  for (const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) elements[tag[1]] = element(tag[1], tag[0]);
  elements.character.value = 'arshe';
  const preview = element('preview'), secondary = element('secondary');
  const bodies = Object.keys(core.bodies).map(body => Object.assign(element(body), { dataset: { body } }));
  const names = ['arshe','karima','gunter'].map(key => element(key));
  const document = { getElementById: id => { assert.ok(elements[id], `HTMLに必要なID: ${id}`); return elements[id]; }, createElement: tag => element(tag === 'canvas' ? 'silhouette-canvas' : tag),
    querySelector: selector => { assert.equal(selector, '.preview'); return preview; },
    querySelectorAll: selector => selector === '[data-body]' ? bodies : selector === '.names span' ? names : selector === '.stage' ? [elements.stage, secondary] : []
  };
  const assets = [...Object.values(core.bodies), ...Object.values(core.heads), core.sword, ...Object.values(core.originals)];
  class Image {
    set src(value) {
      this.source = value; const asset = assets.find(a => value === `assets/${a.file}`); assert.ok(asset, value);
      [this.naturalWidth, this.naturalHeight] = asset.size;
      queueMicrotask(() => asset.file === failedFile ? this.onerror() : this.onload());
    }
    get src() { return this.source; }
  }
  vm.runInNewContext(source, { SharedBodyFit: core, document, Image, Blob, URL: { createObjectURL: () => 'blob:unit-test', revokeObjectURL() {} }, setTimeout: fn => fn() });
  const input = (id, value) => { elements[id].value = String(value); elements[id].handlers.input(); };
  const check = (id, value) => { elements[id].checked = value; elements[id].handlers.change(); };
  return { elements, draws, bodies, preview, input, check, setFailed: value => { failedFile = value; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
async function main() {
  const ui = harness(); await settle();
  const { elements: el, input, check } = ui;
  assert.equal(el.controls.disabled, false); assert.ok(ui.preview.classList.contains('ready'));
  const switchBody = key => ui.bodies.find(button => button.dataset.body === key).click();
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/provided_child_body.png'));
  assert.equal(el.weapon.disabled, true); assert.equal(el.weapon.checked, false);
  assert.ok(!ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/orcus_sword.png'));
  switchBody('child'); assert.equal(el.weapon.disabled, false); assert.equal(el.weapon.checked, true);
  let referenceDraws = () => ui.draws.filter(d => d.canvas === 'fitting' && d.file === 'assets/arshe_original.png');
  assert.deepEqual(referenceDraws().map(d => d.alpha), [.35, 1], '半透明の重ねと原画そのままの隣表示');
  input('reference-opacity', 0); assert.deepEqual(referenceDraws().map(d => d.alpha), [0, 1]);
  input('reference-opacity', 100); assert.deepEqual(referenceDraws().map(d => d.alpha), [1, 1]);
  check('overlay', false); assert.equal(referenceDraws().length, 1); assert.match(el['fitting-label'].textContent, /合成のみ/);
  check('overlay', true); check('silhouette', true);
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'silhouette' && d.alpha === 1));
  input('head-scale', 1.08); input('reference-scale', 1.1); input('reference-x', 15); input('reference-y', -8);
  switchBody('standard'); assert.equal(el['reference-scale'].value, 1); assert.equal(el['head-scale'].value, 1);
  switchBody('child'); assert.equal(el['reference-scale'].value, 1.1); assert.equal(el['reference-x'].value, 15); assert.equal(el['head-scale'].value, 1.08);
  el.character.value = 'karima'; el.character.handlers.change(); assert.equal(el['reference-x'].value, 0);
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/karima_original.png'));
  el.character.value = 'arshe'; el.character.handlers.change(); el.save.click();
  const data = JSON.parse(el['export-json'].value);
  assert.deepEqual(data.referenceAdjustments.child.arshe, { scale: 1.1, x: 15, y: -8 });
  assert.deepEqual(data.adjustments.child.arshe, { scale: 1.08, x: 0, y: 0 });
  assert.equal(data.referenceView.opacity, 1); assert.equal(data.referenceView.silhouette, true);
  el['reference-reset'].click(); assert.equal(el['reference-x'].value, 0); assert.equal(el['reference-scale'].value, 1); assert.equal(el['head-scale'].value, 1.08);
  check('weapon', false); switchBody('providedChild');
  assert.equal(el.weapon.disabled, true); assert.equal(el.weapon.checked, false); assert.equal(el['reference-scale'].value, 1);
  switchBody('child'); assert.equal(el.weapon.disabled, false); assert.equal(el.weapon.checked, false);
  check('mirror', true); el.background.click(); assert.ok(el.stage.classList.contains('dark'));
  const failed = harness('arshe_original.png'); await settle();
  assert.equal(failed.elements.controls.disabled, true); assert.equal(failed.elements.error.hidden, false); assert.match(failed.elements.error.message.textContent, /arshe_original/);
  failed.setFailed(null); failed.elements.retry.click(); await settle();
  assert.equal(failed.elements.controls.disabled, false); assert.equal(failed.elements.error.hidden, true);
  console.log('PASS: UI unit tests (provided child body, weapon guard, overlay, opacity, silhouette, profiles, export, reset, error/retry). Browser visual QA pending.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
