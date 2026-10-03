'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const math = require('./wheel-math.js');
assert.equal(math.normalize({ gap: NaN }).gap, math.defaults.gap);
assert.equal(math.normalize({ gap: -100 }).gap, -40);
assert.equal(math.normalize({ size: 1000 }).size, 740);
assert.throws(() => math.geometry(0, 0));
for (const character of ['alche', 'karima']) {
  const saved = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings', character + '-wheel-v02.json'), 'utf8'));
  assert.deepEqual(math.settings(math.preset(character), character), saved);
}
assert.throws(() => math.preset('unknown'));
assert.equal(math.commands.length, 5);
assert.equal(math.commands[4].id, 'save');
assert.equal(math.commands[0].id, 'settings');
assert.equal(math.commands[0].label, '設定');
assert.equal(math.commands[1].id, 'items');
assert.equal(math.commands[1].label, '所持品');
assert(!math.commands.some(command => command.id === 'map'));
for (const scale of [.46, .59, .72, 1, 1.42]) for (const gap of [-12, 0, 8, 40]) {
  const g = math.geometry(gap, scale);
  for (let phase = -1000; phase <= 1000; phase += 17) for (let index = 0; index < math.commands.length; index++) {
    const target = math.targetFor(phase, index, g), slots = math.slots(target, g);
    assert(Math.abs(target - phase) <= g.period / 2 + 1e-7);
    const focusRad = g.focusAngle * Math.PI / 180;
    assert(Math.abs(slots[index].angle - g.focusAngle) < 1e-7);
    assert(Math.abs(slots[index].y - 195 - g.radius * Math.sin(focusRad)) < 1e-7);
    assert(Math.abs(slots[index].innerX - g.radius * Math.cos(focusRad)) < 1e-7);
    assert(Math.abs(slots.reduce((sum, slot) => sum + slot.y, 0) / 5 - 195) < 1e-7, '5枚全体の重心が上下中央');
    assert.equal(slots.filter(slot => slot.y < 195 - 1e-7).length, 2);
    assert.equal(slots.filter(slot => slot.y > 195 + 1e-7).length, 2);
    assert.equal(g.focusAngle, 0);
    slots.forEach(slot => {
      assert(slot.opacity === 1);
      assert(slot.top >= 12 - 1e-7 && slot.top + slot.height <= 378 + 1e-7);
      assert(slot.left > 0 && slot.left + slot.width < 400);
      assert.equal(slot.width, 112);
      assert(slot.left >= slot.innerX);
      // 17pxの文字行の左端が、針の最大半径の外にあることを保守的に確認。
      const nearestY = Math.max(0, Math.abs(slot.y - 195) - 9);
      const rayEnvelope = Math.sqrt(Math.max(0, math.tipRadius ** 2 - nearestY ** 2));
      assert(slot.left + g.textPadding > rayEnvelope, '左右対称の文字余白で針の外に配置');
    });
    const sorted = slots.slice().sort((a, b) => a.top - b.top);
    for (let j = 1; j < sorted.length; j++) assert(sorted[j].top > sorted[j - 1].top + sorted[j - 1].height);
    const center = slots[index], grownHeight = center.height * g.selectedScale;
    for (const slot of slots.filter(slot => slot.index !== index)) assert(Math.abs(center.y - slot.y) > (grownHeight + slot.height) / 2, '選択札の拡大後も他の押せる範囲と非重複');
    const grownLeft = center.left + center.width / 2 * (1 - g.selectedScale);
    assert(grownLeft + g.textPadding * g.selectedScale > math.tipRadius, '拡大後の文字も中央の針先より外');
  }
}
for (let step = -24; step <= 24; step++) {
  const a = math.needleFor(step), b = math.needleFor(step + 1), c = math.needleFor(step + 2);
  assert(b.angle - a.angle > 55 && b.angle - a.angle < 65);
  assert(c.angle - a.angle > 115 && c.angle - a.angle < 125);
  assert(Math.abs(math.needleFor(step + 6).angle - a.angle - 360) < 1e-7);
  assert.equal(Math.abs(math.idleFor(a.angle) % 60), 0);
  assert(a.radius >= 207 && a.radius < 224);
}
const clipped = math.bandClip(math.geometry(-12, 1, 609, 28));
assert(clipped.startsWith('polygon(')); assert(!clipped.includes('NaN'));
assert.equal(math.geometry(0, 1, 609, 28).bandHeight, 28);
assert.notEqual(math.bandClip(math.geometry(0, 1, 609)), math.bandClip(math.geometry(0, 1, 740)));
for (const target of [-120, 29, 400]) {
  let x = 0, v = 0, result;
  for (let i = 0; i < 600; i++) { result = math.spring(x, v, target, 1 / 60); x = result.position; v = result.velocity; }
  assert(result.settled); assert.equal(x, target);
}
class Element {
  constructor() { this.style = { setProperty(key, value) { this[key] = value; } }; this.attributes = {}; this.events = {}; this.children = []; this.hidden = false; this.value = ''; this.textContent = ''; const classes = new Set(); this.classList = { add(key) { classes.add(key); }, remove(key) { classes.delete(key); }, toggle(key, active) { if (active) classes.add(key); else classes.delete(key); }, contains(key) { return classes.has(key); } }; }
  append(child) { this.children.push(child); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(key, callback) { this.events[key] = callback; }
  focus() { this.focused = true; }
  select() { this.selectedText = true; }
  getBoundingClientRect() { return { width: this.viewportWidth || 844 }; }
}
async function run({ reduce = false, failImage = false, failCopy = false } = {}) {
  const ids = ['viewport', 'screen', 'command-layer', 'command-nameplate', 'bands', 'labels', 'outer-ring', 'wheel-rotor', 'wheel-panes', 'rays-rotor', 'character', 'background', 'material-defs', 'loading', 'error', 'status', 'previous', 'next', 'clear', 'copy-settings', 'reset-settings', 'settings', 'settings-details', 'disk-panes', 'disk-frame', 'rays-panes', 'rays-frame'];
  Object.keys(math.defaults).forEach(key => ids.push(key, key + '-number', key + '-value'));
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  elements.character.value = 'alche'; elements.background.value = 'light';
  const html = fs.readFileSync(path.join(__dirname, 'layout.html'), 'utf8');
  elements['command-nameplate'].innerHTML = /<template id="command-nameplate">([\s\S]*?)<\/template>/.exec(html)[1];
  let disconnected = false, mediaRemoved = false, pagehide, resize, copied = '', rafId = 0, time = 0;
  const frames = new Map(), media = { matches: reduce, addEventListener() {}, removeEventListener() { mediaRemoved = true; } };
  const window = { SolarWheel: math, SolarMaterials: require('../太陽盤_試作03/material-engine.js'), SolarCharacterColors: require('../太陽盤_試作03/character-colors.js'), addEventListener(event, callback) { if (event === 'pagehide') pagehide = callback; } };
  const document = { getElementById: id => elements[id], createElement: () => new Element(), documentElement: new Element() };
  const ResizeObserver = class { constructor(callback) { resize = callback; } observe() {} disconnect() { disconnected = true; } };
  const navigator = { clipboard: { async writeText(value) { if (failCopy) throw new Error('denied'); copied = value; } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'wheel.js'), 'utf8'), { window, document, navigator, ResizeObserver, matchMedia: () => media, requestAnimationFrame(callback) { const id = ++rafId; frames.set(id, callback); return id; }, cancelAnimationFrame(id) { frames.delete(id); } });
  function settle() {
    let n = 0;
    while (frames.size) { assert(++n < 1200, 'spring loop must settle'); const [id, callback] = frames.entries().next().value; frames.delete(id); time += 1000 / 60; callback(time); }
  }
  const anchors = elements.labels.children, buttons = anchors.map(anchor => anchor.children[0]);
  const bands = buttons.map(button => button.children[0]);
  buttons.forEach((button, index) => {
    assert.equal(button.children.length, 2);
    assert.equal(bands[index].className, 'band-row');
    assert.equal(button.children[1].className, 'command-copy');
    assert.equal(button.children[1].textContent, math.commands[index].label);
    assert.equal(bands[index].style.scale, undefined, '札だけを画面座標で拡大しない');
    assert.equal(bands[index].style.transform, undefined, '札だけへ画面座標の移動を与えない');
  });
  const focusAngle = math.geometry(math.defaults.gap).focusAngle;
  const selectedY = 195 + (math.tipRadius + math.defaults.gap) * Math.sin(focusAngle * Math.PI / 180);
  assert.equal(buttons.length, 5); assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + focusAngle + 'deg)');
  assert(buttons.every(button => button.style.transform === 'scale(1)'));
  assert.deepEqual(JSON.parse(elements.settings.value), math.settings(math.preset('alche'), 'alche'));
  for (const id of ['disk-panes', 'disk-frame', 'rays-panes', 'rays-frame', 'wheel-panes']) {
    const img = elements[id]; assert(fs.existsSync(path.resolve(__dirname, img.src)));
    if (failImage && id === 'wheel-panes') img.onerror(); else img.onload();
  }
  assert.equal(elements.loading.hidden, true); assert.equal(elements.error.hidden, !failImage);
  assert(elements.status.textContent.includes(failImage ? '失敗' : '未選択'));
  const initialWheel = elements['wheel-rotor'].style.transform;
  let expectedPhase = Number(/rotate\(([^d]+)/.exec(initialWheel)[1]) - focusAngle, expectedStep = 0;
  function expectedSelect(index) {
    const g = math.geometry(math.defaults.gap);
    const next = math.targetFor(expectedPhase, index, g);
    expectedStep += Math.round((next - expectedPhase) / g.pitch); expectedPhase = next;
  }
  expectedSelect(0);
  buttons[0].events.click(); settle();
  assert.notEqual(elements['wheel-rotor'].style.transform, initialWheel);
  assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + (math.needleFor(expectedStep).angle + focusAngle) + 'deg)');
  assert.equal(bands.length, 5);
  assert(bands.every(band => band.innerHTML === elements['command-nameplate'].innerHTML));
  buttons[0].events.mouseenter(); assert(bands[0].classList.contains('hover'));
  buttons[0].events.mouseleave(); assert(!bands[0].classList.contains('hover'));
  buttons[0].events.focus(); assert(bands[0].classList.contains('focus'));
  buttons[0].events.blur(); assert(!bands[0].classList.contains('focus'));
  const centered = /^translate\(([^p]+)px,([^p]+)px\)/.exec(anchors[0].style.transform);
  assert(Math.abs(Number(centered[2]) - selectedY) < 1e-7);
  buttons.forEach((button, index) => {
    expectedSelect(index);
    button.events.click(); settle(); assert.equal(button.attributes['aria-pressed'], 'true');
    assert.equal(button.style.transform, 'scale(1.08)');
    assert.equal(bands[index].style.scale, undefined);
    assert(bands[index].classList.contains('selected'));
    assert.equal(buttons.filter(b => b.style.transform === 'scale(1.08)').length, 1);
    assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + (math.needleFor(expectedStep).angle + focusAngle) + 'deg)');
    assert.equal(buttons.filter(b => b.attributes['aria-pressed'] === 'true').length, 1);
    assert.equal(anchors[index].style.opacity, '1'); assert.equal(button.style.pointerEvents, 'auto');
    const position = /^translate\(([^p]+)px,([^p]+)px\)/.exec(anchors[index].style.transform);
    assert(Math.abs(Number(position[2]) - selectedY) < 1e-7);
    const initial = math.preset('alche');
    const expectedSlot = math.slots(expectedPhase, math.geometry(initial.gap, 1, initial.size, initial.bandHeight), index, math.needleFor(expectedStep).radius)[index];
    assert(Math.abs(Number(position[1]) - expectedSlot.left) < 1e-7, '描画にも現在の針の長さ補正を渡す');
    // 札の中心は同じボタン内の50%で固定。異なる画面座標から拡大する回帰を防ぐ。
    assert.strictEqual(button.children[0], bands[index]);
    assert.equal(bands[index].style.transform, undefined);
  });
  // Endと末尾からの次送りが、追加したセーブを含む5項目で循環する。
  expectedSelect(4); buttons[0].events.keydown({ key: 'End', preventDefault() {} }); settle(); assert(buttons[4].focused);
  expectedSelect(0); buttons[4].events.keydown({ key: 'ArrowDown', preventDefault() {} }); settle(); assert.equal(buttons[0].attributes['aria-pressed'], 'true');
  expectedSelect(0); buttons[3].events.keydown({ key: 'Home', preventDefault() {} }); settle(); assert(buttons[0].focused);
  // 途中で別項目を連打しても、最後の選択に留まる。
  expectedSelect(1); buttons[1].events.click(); expectedSelect(3); buttons[3].events.click(); settle(); assert.equal(buttons[3].attributes['aria-pressed'], 'true');
  assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + (math.needleFor(expectedStep).angle + focusAngle) + 'deg)');
  const priorWheel = elements['wheel-rotor'].style.transform, priorNeedle = elements['rays-rotor'].style.transform;
  elements.character.value = 'karima'; elements.character.events.change();
  assert.deepEqual(JSON.parse(elements.settings.value), math.settings({ ...math.preset('karima'), gap: -27, bandHeight: 31 }, 'karima'), '色切替ではアルシェでの配置を維持');
  assert.equal(elements['wheel-rotor'].style.transform, priorWheel); assert.equal(elements['rays-rotor'].style.transform, priorNeedle);
  assert.equal(elements['disk-frame'].style.filter, 'url(#solar-frame-material)');
  assert(elements['material-defs'].innerHTML.includes('id="wheel-panes-material"'));
  const beforeInset = /^translate\(([^p]+)px,([^p]+)px\)/.exec(anchors[3].style.transform);
  elements['gap-number'].value = -28; elements['gap-number'].events.input();
  const afterInset = /^translate\(([^p]+)px,([^p]+)px\)/.exec(anchors[3].style.transform);
  assert.equal(elements.gap.value, -28);
  assert.equal(JSON.parse(elements.settings.value).wheel.gap, -28);
  assert.equal(afterInset[2], beforeInset[2]);
  assert(Math.abs(Number(beforeInset[1]) - Number(afterInset[1]) - 1) < 1e-7, '新しい初期値-27から-28へさらに寄る');
  elements['gap-number'].value = -7; elements['gap-number'].events.input();
  assert.equal(elements.gap.value, -7); assert.equal(elements['gap-value'].textContent, '-7 px');
  elements.size.value = 700; elements.size.events.input(); assert.equal(elements['outer-ring'].style.width, '700px');
  elements.bandHeight.value = 22; elements.bandHeight.events.input(); assert.equal(elements['bandHeight-value'].textContent, '22 px');
  assert.equal(elements.screen.style['--band-height'], '22px');
  elements.opacity.value = 0; elements.opacity.events.input(); assert.equal(elements['wheel-panes'].style.opacity, 0);
  elements['hue-number'].value = ''; elements['hue-number'].events.input(); assert.equal(JSON.parse(elements.settings.value).wheel.hue, 224);
  elements.hue.value = 190; elements.hue.events.input(); elements.saturation.value = 30; elements.saturation.events.input();
  assert.equal(JSON.parse(elements.settings.value).wheel.hue, 190);
  elements.background.value = 'corridor'; elements.background.events.change(); assert(elements.screen.style.backgroundImage.includes('corridor-reference'));
  elements.viewport.viewportWidth = 600; resize();
  assert.equal(buttons[3].attributes['aria-pressed'], 'true');
  const resized = /^translate\(([^p]+)px,([^p]+)px\)/.exec(anchors[3].style.transform);
  const adjustedGeometry = math.geometry(-7, 600 / 844, 700, 22);
  assert(Math.abs(Number(resized[2]) - 195 - adjustedGeometry.radius * Math.sin(adjustedGeometry.focusAngle * Math.PI / 180)) < 1e-7);
  const adjustedWheel = elements['wheel-rotor'].style.transform, adjustedNeedle = elements['rays-rotor'].style.transform;
  elements.character.value = 'alche'; elements.character.events.change();
  const switched = JSON.parse(elements.settings.value).wheel;
  assert.equal(switched.lightness, 0); assert.equal(switched.opacity, 40);
  assert.equal(switched.gap, -7); assert.equal(switched.size, 700); assert.equal(switched.bandHeight, 22);
  assert.equal(elements['wheel-rotor'].style.transform, adjustedWheel); assert.equal(elements['rays-rotor'].style.transform, adjustedNeedle);
  await elements['copy-settings'].events.click();
  if (failCopy) { assert(elements['settings-details'].open); assert(elements.settings.selectedText); } else assert.equal(JSON.parse(copied).schema, 'solar-command-wheel-settings-v02');
  elements.clear.events.click(); settle(); assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + (math.idleFor(math.needleFor(expectedStep).angle) + adjustedGeometry.focusAngle) + 'deg)');
  assert(buttons.every(b => b.attributes['aria-pressed'] === 'false'));
  assert(buttons.every(b => b.style.transform === 'scale(1)'));
  assert(bands.every(band => !band.classList.contains('selected')));
  elements['reset-settings'].events.click(); assert.equal(elements.gap.value, -27); assert.equal(elements.bandHeight.value, 31);
  elements.character.value = 'karima'; elements.character.events.change();
  elements.lightness.value = 12; elements.lightness.events.input(); elements['reset-settings'].events.click();
  assert.equal(elements.lightness.value, 80); assert.equal(elements.bandHeight.value, 29);
  // 弧の間隔が変わる狭幅＋大きい余白でも、文字と針の選択位置は中央に維持。
  buttons[2].events.click(); settle();
  const beforeFocusChange = Number(/rotate\(([^d]+)/.exec(elements['rays-rotor'].style.transform)[1]);
  const beforeGeometry = math.geometry(math.defaults.gap, 600 / 844);
  elements.gap.value = 40; elements.gap.events.input();
  elements.viewport.viewportWidth = 844 * .46; resize();
  const tight = math.geometry(40, .46);
  assert(tight.pitch < beforeGeometry.pitch);
  assert.equal(tight.focusAngle, 0);
  const afterFocusChange = Number(/rotate\(([^d]+)/.exec(elements['rays-rotor'].style.transform)[1]);
  assert(Math.abs(afterFocusChange - beforeFocusChange - tight.focusAngle + beforeGeometry.focusAngle) < 1e-7);
  const tightPosition = /^translate\(([^p]+)px,([^p]+)px\)/.exec(anchors[2].style.transform);
  assert(Math.abs(Number(tightPosition[2]) - 195 - tight.radius * Math.sin(tight.focusAngle * Math.PI / 180)) < 1e-7);
  assert.equal(buttons[2].attributes['aria-pressed'], 'true');
  buttons[1].events.click(); pagehide(); assert(disconnected && mediaRemoved); assert.equal(frames.size, 0);
}
async function main() {
  await run(); await run({ reduce: true }); await run({ failImage: true, failCopy: true });
  const html = fs.readFileSync(path.join(__dirname, 'layout.html'), 'utf8');
  for (const match of html.matchAll(/<script src="([^"?]+)/g)) assert(fs.existsSync(path.resolve(__dirname, match[1])));
  assert(html.includes('id="wheel-panes"')); assert(html.includes('id="gap-number"')); assert(html.includes('layout-static.html'));
  const shape = /<template id="command-nameplate">([\s\S]*?)<\/template>/.exec(html)[1];
  const outlines = [...shape.matchAll(/points="([^"]+)"/g)].map(match => match[1].split(' ').map(point => point.split(',').map(Number)));
  assert.deepEqual(outlines[0], [[1, 1], [139, 1], [139, 33], [1, 33], [21, 17]], '左はV字、右は箱型');
  assert.deepEqual(outlines[1], [[11, 5], [134, 5], [134, 29], [11, 29], [26, 17]], '内縁も切れ込みと箱型に沿う');
  outlines.forEach(points => {
    assert.equal(points[1][0], points[2][0], '右端は上下で同じXの垂直な辺');
    assert.equal(points[points.length - 1][1], 17, 'V字の受け口は札の上下中央');
    assert(points[points.length - 1][0] > points[0][0], '左端は凸ではなく内向きの切れ込み');
  });
  // 標準の余白-12でも、選択拡大後の針先とV字最奥に小さい隙間を残す。
  const notchGeometry = math.geometry(math.defaults.gap, 1);
  for (const scale of [.46, .72, 1, 1.42]) for (const gap of [-40, -28, -12, 0, 40]) {
    const g = math.geometry(gap, scale);
    for (let step = -12; step <= 12; step++) for (let index = 0; index < 5; index++) {
      const radius = math.needleFor(step).radius;
      const target = math.targetFor(-2 * g.pitch, index, g);
      const slot = math.slots(target, g, index, radius)[index];
      const notchX = slot.left + slot.width / 2 * (1 - g.selectedScale) + outlines[0][4][0] / 140 * slot.width * g.selectedScale;
      assert(Math.abs(notchX - radius - (.75 + gap - math.defaults.gap)) < 1e-7, '全6本で針先との隙間を補正し、負の余白も実際に寄せる');
      const sorted = math.slots(target, g, index, radius).sort((a, b) => a.y - b.y);
      for (let j = 1; j < sorted.length; j++) assert(sorted[j].top > sorted[j - 1].top + sorted[j - 1].height, '内寄せで上下の押せる範囲を詰めない');
    }
  }
  const base = math.slots(0, notchGeometry);
  const inset = math.slots(0, math.geometry(-28, 1));
  base.forEach((slot, index) => {
    assert.equal(inset[index].y, slot.y);
    assert(Math.abs(slot.left - inset[index].left - 16) < 1e-7, '文字ガードで余白スライダーの内寄せを打ち消さない');
  });
  assert(html.includes('id="gap" type="range" min="-40"'));
  assert(html.includes('id="gap-number" type="number" min="-40"'));
  assert(html.includes("font-family: 'Yu Mincho'"));
  assert(html.includes('padding: 0 16px; text-align: center; display: grid; place-items: center;'));
  assert(html.includes('top: 50%; width: 100%; height: var(--band-height, 29px); transform: translateY(-50%);'));
  assert(!html.includes('id="bands"'));
  // 位置によらず、親の共通拡大なら札と文字の中心は同じ。縮小画面も確認。
  for (const viewportScale of [.46, .72, 1, 1.42]) for (const emphasis of [1, 1.08]) {
    const g = math.geometry(math.defaults.gap, viewportScale);
    for (const slot of math.slots(math.targetFor(-2 * g.pitch, 1, g), g)) {
      const parentTop = -slot.height / 2;
      const shapeCenter = parentTop + slot.height / 2 - g.bandHeight / 2 + g.bandHeight / 2;
      const textCenter = parentTop + slot.height / 2;
      assert.equal((slot.y + shapeCenter * emphasis) * viewportScale, (slot.y + textCenter * emphasis) * viewportScale);
    }
  }
  assert(html.includes('@media (prefers-reduced-motion: reduce)'));
  console.log('PASS: V-notch with square right edge, per-needle alignment, inward adjustment to -40, unchanged vertical spacing, shared enlargement, five-command selection, presets, resizing, reduced motion and fallback states');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
