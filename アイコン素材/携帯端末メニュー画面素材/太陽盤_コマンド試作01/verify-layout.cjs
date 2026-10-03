'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const math = require('./layout-math.js');
// 全ラベル矩形が盤と針の包絡円の外。全項目が横画面の中に残る。
for (const gap of [12, 18, 44]) for (const scale of [.46, .57, .71, 1, 1.42]) {
  const slots = math.layout(gap, scale);
  assert.equal(slots.length, 4);
  slots.forEach((slot, index) => {
    assert(slot.left > 0 && slot.left + slot.width < 410);
    assert(slot.top >= 12 && slot.top + slot.height <= 378);
    const dy = Math.max(0, Math.abs(slot.y - 195) - slot.height / 2);
    assert(Math.hypot(slot.left, dy) > math.envelope);
    assert(Math.hypot(slot.left, dy) - math.envelope >= gap * .6);
    // 選択した針先とボタン内側の中央が、同じ放射線上に並ぶ。
    assert(Math.abs(slot.tipX * (slot.y - 195) - (slot.tipY - 195) * slot.left) < 1e-7);
    assert(Math.hypot(slot.left - slot.tipX, slot.y - slot.tipY) >= 12);
    if (index) assert(slot.top - (slots[index - 1].top + slots[index - 1].height) >= 7.999);
  });
}
assert.throws(() => math.layout(0)); assert.throws(() => math.layout(18, 0));

class Element {
  constructor() { this.style = { setProperty(key, value) { this[key] = value; } }; this.attributes = {}; this.events = {}; this.children = []; this.hidden = false; }
  append(child) { this.children.push(child); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(key, callback) { this.events[key] = callback; }
  focus() { this.focused = true; }
  getBoundingClientRect() { return { width: 844 }; }
}
function run(failImage = false) {
  const elements = Object.fromEntries(['viewport', 'screen', 'command-layer', 'rays-rotor', 'character', 'background', 'gap', 'gap-value', 'material-defs', 'loading', 'error', 'status', 'disk-panes', 'disk-frame', 'rays-panes', 'rays-frame'].map(id => [id, new Element()]));
  elements.character.value = 'alche'; elements.background.value = 'light'; elements.gap.value = 18;
  let disconnected = false, pagehide;
  const window = { SolarLayout: math, SolarMaterials: require('../太陽盤_試作03/material-engine.js'), SolarCharacterColors: require('../太陽盤_試作03/character-colors.js'), addEventListener(event, callback) { if (event === 'pagehide') pagehide = callback; } };
  const document = { getElementById: id => elements[id], createElement: () => new Element(), documentElement: new Element() };
  const ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'layout.js'), 'utf8'), { window, document, ResizeObserver });
  const buttons = elements['command-layer'].children;
  assert.equal(buttons.length, 4);
  for (const group of ['disk', 'rays']) for (const part of ['panes', 'frame']) {
    const img = elements[group + '-' + part];
    assert(fs.existsSync(path.resolve(__dirname, img.src)));
    if (failImage && group === 'rays' && part === 'frame') img.onerror(); else img.onload();
  }
  assert.equal(elements.loading.hidden, true);
  assert.equal(elements.error.hidden, !failImage);
  assert(elements.status.textContent.includes(failImage ? '失敗' : '直接選択'));
  buttons.forEach((button, index) => {
    button.events.click();
    assert.equal(button.attributes['aria-pressed'], 'true');
    assert.equal(button.hidden, false);
    assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + math.layout()[index].needleAngle + 'deg)');
    assert.equal(buttons.filter(b => b.attributes['aria-pressed'] === 'true').length, 1);
  });
  buttons[3].events.keydown({ key: 'Home', preventDefault() {} }); assert.equal(buttons[0].focused, true);
  const priorAngle = elements['rays-rotor'].style.transform;
  elements.character.value = 'karima'; elements.character.events.change();
  assert.equal(elements['rays-rotor'].style.transform, priorAngle);
  assert.equal(elements['disk-frame'].style.filter, 'url(#solar-frame-material)');
  assert.equal(elements['disk-panes'].style.opacity, .5); assert.equal(elements['rays-panes'].style.opacity, .89);
  elements.gap.value = 44; elements.gap.events.input(); assert.equal(elements['gap-value'].textContent, '44 px');
  elements.background.value = 'corridor'; elements.background.events.change(); assert(elements.screen.style.backgroundImage.includes('corridor-reference'));
  pagehide(); assert(disconnected);
}
run(); run(true);
const html = fs.readFileSync(path.join(__dirname, 'layout-static.html'), 'utf8');
for (const src of [...html.matchAll(/<script src="([^"?]+)/g)].map(match => match[1])) assert(fs.existsSync(path.resolve(__dirname, src)));
assert(html.includes('.command-layer { position: absolute; inset: 0; z-index: 1; }'));
assert(html.includes('.disk { z-index: 2;')); assert(html.includes('.rays { z-index: 3;'));
console.log('PASS: all four commands visible, separate lower layer, tip alignment, spacing, theme, click/keyboard, loading/error and cleanup');
