'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const math = require('./wheel-math.js');
const flameModel = require('./flame-model.js');
assert.equal(flameModel.normalize({ size: NaN }).size, 69);
assert.deepEqual(flameModel.defaults, JSON.parse(fs.readFileSync(path.join(__dirname, 'settings/common-flame-v01.json'), 'utf8')));
assert.deepEqual(flameModel.defaults, { size: 69, opacity: 83, x: -18, y: 12 });
assert.deepEqual(flameModel.colorDefaults, JSON.parse(fs.readFileSync(path.join(__dirname, 'settings/flame-color-defaults-v01.json'), 'utf8')));
assert.throws(() => flameModel.normalizeColor({}, 'unknown'));
assert.deepEqual(flameModel.normalizeColor({ hue: NaN, saturation: -3, brightness: 999 }, 'karima'), { hue: 217, saturation: 0, brightness: 160 });
assert.equal(flameModel.colorFilter({ hue: 40, saturation: 100, brightness: 100 }), 'none', '元の金色の基準は初期値の更新から独立');
assert.equal(flameModel.colorFilter(flameModel.colorDefaults.alche), 'hue-rotate(-25deg) saturate(1.02) brightness(1.09)');
assert.equal(flameModel.colorFilter(flameModel.colorDefaults.karima), 'hue-rotate(177deg) saturate(1.04) brightness(1)');
for (const [x, y, hue] of [[38, 0, 0], [76, 38, 90], [38, 76, 180], [0, 38, 270], [38, 38, null]]) {
  assert.equal(flameModel.hueAt(x + 10, y + 20, { left: 10, top: 20, width: 76, height: 76 }), hue);
}
assert.throws(() => flameModel.variant('unknown'));
for (const key of Object.keys(flameModel.variants)) {
  assert(fs.existsSync(path.join(__dirname, flameModel.variant(key).src)));
  for (const size of [24, 69, 120]) {
    const p = flameModel.placement({ size, x: -27, y: 11 }, key), asset = flameModel.variant(key);
    const left = Number(/calc\(100% \+ (.+)px\)/.exec(p.left)[1]);
    const top = Number(/calc\(50% \+ (.+)px\)/.exec(p.top)[1]);
    assert(Math.abs(left + size * asset.originX + 27) < 1e-7, '両素材で根元の指定Xを固定');
    assert(Math.abs(top + size * asset.originY - 11) < 1e-7, '両素材で根元の指定Yを固定');
  }
}
assert.equal(flameModel.normalize({ size: 200, opacity: -3, x: -100, y: 100 }).size, 120);
assert.deepEqual(flameModel.normalize({ size: 200, opacity: -3, x: -100, y: 100 }), { size: 120, opacity: 0, x: -40, y: 40 });
for (const size of [24, 64, 120]) {
  const p = flameModel.placement({ size, x: -12, y: 5 });
  const left = Number(/calc\(100% \+ (.+)px\)/.exec(p.left)[1]);
  const top = Number(/calc\(50% \+ (.+)px\)/.exec(p.top)[1]);
  assert(Math.abs(left + size * .17 + 12) < 1e-7, 'サイズを変えても炎の根元Xが固定');
  assert(Math.abs(top + size * .83 - 5) < 1e-7, 'サイズを変えても炎の根元Yが固定');
}
assert.equal(math.normalize({ gap: NaN }).gap, math.defaults.gap);
assert.equal(math.normalize({ gap: -100 }).gap, -40);
assert.equal(math.normalize({ size: 1000 }).size, 740);
assert.throws(() => math.geometry(0, 0));
for (const character of ['alche', 'karima']) {
  const saved = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings', character + '-wheel-v02.json'), 'utf8'));
  assert.deepEqual(math.settings(math.preset(character), character), saved);
  const complete = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings', character + '-command-v02.json'), 'utf8'));
  assert.deepEqual(complete, { ...math.settings(math.preset(character), character), flame: { ...flameModel.defaults }, flameVariant: 'bottom', flameColor: { ...flameModel.colorDefaults[character] } }, '作者指定の全設定と実装初期値が一致');
}
assert.throws(() => math.preset('unknown'));
assert.equal(math.preset('karima').hue, 214);
assert.equal(math.preset('karima').lightness, 64);
assert.equal(math.preset('karima').opacity, 40, '輪の濃さではなく色だけを変更');
assert.equal(math.preset('karima').gap, -27, '両キャラの配置は作者指定の共通値');
assert.equal(math.preset('karima').bandHeight, 31);
assert.equal(math.preset('alche').hue, 224, 'アルシェの配色は維持');
assert.equal(math.preset('alche').lightness, 0);
assert.equal(math.commands.length, 5);
assert.equal(math.commands[4].id, 'save');
assert.equal(math.commands[0].id, 'settings');
assert.equal(math.commands[0].label, '設定');
assert.equal(math.commands[1].id, 'items');
assert.deepEqual(math.commands.map(command => command.label), ['設定', '出撃', '探索', '支援会話', 'セーブ']);
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
    const alignedCenter = math.slots(target, g, index)[index];
    const grownLeft = alignedCenter.left + alignedCenter.width / 2 * (1 - g.selectedScale);
    // 表示はpaddingの左端ではなく中央揃え。16px全角幅＋字間で現在のラベルを概算。
    // 字形の実描画は別途確認。針の長さ補正を含む、実装と同じ選択配置を使う。
    const estimatedTextWidth = alignedCenter.label.length * 16 * 1.12;
    assert(grownLeft + (alignedCenter.width - estimatedTextWidth) / 2 * g.selectedScale > math.tipRadius, '現在の中央揃えラベルの概算左端は針先より外');
    const grownBandBottom = alignedCenter.y + (g.bandHeight / 2 + 8 / 34 * g.bandHeight) * g.selectedScale;
    const below = slots.filter(slot => slot.y > center.y).sort((a, b) => a.y - b.y)[0];
    assert(grownBandBottom < below.y - g.bandHeight / 2, '拡大した裏帯も下の札へ重ならない');
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
  animate(keyframes, options) {
    const animation = { keyframes, options, cancelled: false, finished: false,
      cancel() { this.cancelled = true; }, finish() { this.finished = true; if (this.onfinish) this.onfinish(); } };
    (this.animations ||= []).push(animation); return animation;
  }
  getBoundingClientRect() { return this.bounds || { width: this.viewportWidth || 844 }; }
  setPointerCapture(id) { this.captured = id; }
  hasPointerCapture(id) { return this.captured === id; }
  releasePointerCapture(id) { if (this.captured === id) this.captured = undefined; }
}
async function run({ reduce = false, failImage = false, failFlame = false, failOtherFlame = false, initialVariant = 'bottom', failCopy = false, noAnimation = false, earlySelect = false } = {}) {
  const effectsEnabled = !reduce && !failImage && !failFlame && !noAnimation;
  const ids = ['viewport', 'screen', 'command-layer', 'command-nameplate', 'command-selected-surface', 'selection-effects', 'flame-source', 'flame-status', 'bands', 'labels', 'outer-ring', 'wheel-rotor', 'wheel-panes', 'rays-rotor', 'character', 'background', 'material-defs', 'loading', 'error', 'status', 'previous', 'next', 'clear', 'copy-settings', 'reset-settings', 'settings', 'settings-details', 'disk-panes', 'disk-frame', 'rays-panes', 'rays-frame'];
  Object.keys(math.defaults).forEach(key => ids.push(key, key + '-number', key + '-value'));
  Object.keys(flameModel.defaults).forEach(key => ids.push('flame-' + key, 'flame-' + key + '-number', 'flame-' + key + '-value'));
  ids.push('reset-flame', 'replay-flame');
  ids.push('flame-variant', 'flame-bottom-source');
  ids.push('flame-hue-wheel', 'reset-flame-color');
  Object.keys(flameModel.colorRanges).forEach(key => ids.push('flame-color-' + key, 'flame-color-' + key + '-number', 'flame-color-' + key + '-value'));
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  elements.character.value = 'alche'; elements.background.value = 'light';
  elements['flame-variant'].value = initialVariant;
  elements['selection-effects'].checked = true;
  const html = fs.readFileSync(path.join(__dirname, 'layout.html'), 'utf8');
  elements['command-nameplate'].innerHTML = /<template id="command-nameplate">([\s\S]*?)<\/template>/.exec(html)[1];
  let disconnected = false, mediaRemoved = false, visibilityRemoved = false, pagehide, resize, copied = '', rafId = 0, time = 0;
  const frames = new Map(), media = { matches: reduce, addEventListener(event, callback) { this.change = callback; }, removeEventListener() { mediaRemoved = true; } };
  const window = { SolarWheel: math, SolarFlame: flameModel, SolarMaterials: require('../太陽盤_試作03/material-engine.js'), SolarCharacterColors: require('../太陽盤_試作03/character-colors.js'), addEventListener(event, callback) { if (event === 'pagehide') pagehide = callback; } };
  const document = { hidden: false, getElementById: id => elements[id], createElement: () => new Element(), documentElement: new Element(),
    addEventListener(event, callback) { if (event === 'visibilitychange') this.visibilityChange = callback; },
    removeEventListener(event) { if (event === 'visibilitychange') visibilityRemoved = true; } };
  const ResizeObserver = class { constructor(callback) { resize = callback; } observe() {} disconnect() { disconnected = true; } };
  const navigator = { clipboard: { async writeText(value) { if (failCopy) throw new Error('denied'); copied = value; } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'wheel.js'), 'utf8'), { window, document, navigator, ResizeObserver, matchMedia: () => media, requestAnimationFrame(callback) { const id = ++rafId; frames.set(id, callback); return id; }, cancelAnimationFrame(id) { frames.delete(id); } });
  function settle() {
    let n = 0;
    while (frames.size) { assert(++n < 1200, 'spring loop must settle'); const [id, callback] = frames.entries().next().value; frames.delete(id); time += 1000 / 60; callback(time); }
  }
  const anchors = elements.labels.children, buttons = anchors.map(anchor => anchor.children[0]);
  const bands = buttons.map(button => button.children[0]);
  const flames = bands.map(band => band.children[0]);
  const effectParts = flames.flatMap(flame => [flame, flame.children[0]]);
  if (noAnimation) effectParts.forEach(part => { part.animate = undefined; });
  const effects = () => effectParts.flatMap(part => part.animations || []);
  const activeEffects = () => effects().filter(effect => !effect.cancelled && !effect.finished);
  assert.equal(effects().length, 0, '起動だけでは属性演出を出さない');
  buttons.forEach((button, index) => {
    assert.equal(button.children.length, 2);
    assert.equal(bands[index].className, 'band-row');
    assert.equal(button.children[1].className, 'command-copy');
    assert.equal(button.children[1].textContent, math.commands[index].label);
    assert.equal(flames[index].className, 'selection-flame');
    assert.equal(flames[index].attributes['aria-hidden'], 'true');
    assert.equal(flames[index].children[0].className, 'selection-flame-art');
    assert.equal(flames[index].children[0].alt, '');
    assert.equal(flames[index].children[0].src, flameModel.variant(initialVariant).src);
    assert.equal(bands[index].style.scale, undefined, '札だけを画面座標で拡大しない');
    assert.equal(bands[index].style.transform, undefined, '札だけへ画面座標の移動を与えない');
  });
  const focusAngle = math.geometry(math.defaults.gap).focusAngle;
  const selectedY = 195 + (math.tipRadius + math.defaults.gap) * Math.sin(focusAngle * Math.PI / 180);
  assert.equal(buttons.length, 5); assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + focusAngle + 'deg)');
  assert(buttons.every(button => button.style.transform === 'scale(1)'));
  assert.deepEqual(JSON.parse(elements.settings.value), { ...math.settings(math.preset('alche'), 'alche'), flame: { ...flameModel.defaults }, flameVariant: initialVariant, flameColor: { ...flameModel.colorDefaults.alche } });
  if (earlySelect) {
    buttons[2].events.click(); settle();
    assert.equal(effects().length, 0, '画像が揃う前は、中央への選択後も演出を保留');
    elements['flame-variant'].value = initialVariant === 'bottom' ? 'original' : 'bottom';
    elements['flame-variant'].events.change();
    elements['flame-variant'].value = initialVariant; elements['flame-variant'].events.change();
    assert.equal(effects().length, 0, '読み込み前に形を連打しても、選んだ素材だけを待つ');
  }
  for (const id of ['disk-panes', 'disk-frame', 'rays-panes', 'rays-frame', 'wheel-panes']) {
    const img = elements[id]; assert(fs.existsSync(path.resolve(__dirname, img.src)));
    if (failImage && id === 'wheel-panes') img.onerror(); else img.onload();
  }
  assert.equal(elements.loading.hidden, true); assert.equal(elements.error.hidden, !failImage);
  assert(elements.status.textContent.includes(failImage ? '失敗' : earlySelect ? '選択' : '未選択'));
  assert.equal(effects().length, 0, '本体の素材だけ揃っても炎素材を待つ');
  const currentSource = initialVariant === 'bottom' ? 'flame-bottom-source' : 'flame-source';
  const otherSource = initialVariant === 'bottom' ? 'flame-source' : 'flame-bottom-source';
  for (const id of [currentSource, otherSource]) assert(fs.existsSync(path.resolve(__dirname, elements[id].src)));
  if (failFlame || failOtherFlame) elements[otherSource].onerror(); else elements[otherSource].onload();
  assert.equal(effects().length, 0, '非選択素材だけ先に読み込んでも現在の素材を待つ');
  if (failFlame) elements[currentSource].onerror(); else elements[currentSource].onload();
  assert.equal(elements['flame-status'].hidden, !failFlame);
  if (failFlame) assert(elements['flame-status'].textContent.includes('選択操作はそのまま'));
  if (earlySelect) {
    assert.equal(effects().length, effectsEnabled ? 2 : 0, '読込完了後、保留中の選択だけ点火と常時炎を開始');
    elements.clear.events.click(); settle();
    effects().forEach(effect => { assert(effect.cancelled); });
    // 後続の操作回帰テスト用に履歴だけ消す。実アニメーション管理は既に解除済み。
    effectParts.forEach(part => { part.animations = []; });
  }
  const initialWheel = elements['wheel-rotor'].style.transform;
  let expectedPhase = Number(/rotate\(([^d]+)/.exec(initialWheel)[1]) - focusAngle, expectedStep = 0;
  function expectedSelect(index) {
    const g = math.geometry(math.defaults.gap);
    const next = math.targetFor(expectedPhase, index, g);
    expectedStep += Math.round((next - expectedPhase) / g.pitch); expectedPhase = next;
  }
  expectedSelect(0);
  buttons[0].events.click();
  assert.equal(effects().length, 0, '回転が止まるまでは演出しない');
  settle();
  assert.equal(effects().length, effectsEnabled ? 2 : 0);
  assert.equal(flames[0].classList.contains('is-lit'), !reduce && !failImage && !failFlame);
  if (effectsEnabled) {
    assert.equal(effects()[0].options.duration, 720);
    assert.equal(effects()[1].options.iterations, Infinity);
    effects()[0].finish();
    assert(flames[0].classList.contains('is-lit'), '点火が終わっても小さい炎を残す');
    assert.equal(activeEffects().length, 1, '点火後は装飾1枚の揺らめきだけ');
    buttons[0].events.click(); settle();
    assert.equal(effects().length, 4, '同じ札を押すと前の揺らめきを消して点火を再生');
    assert.equal(effects()[0].cancelled, false, '自然終了した演出は管理対象から外れる');
    assert.equal(activeEffects().length, 2);
  }
  assert.notEqual(elements['wheel-rotor'].style.transform, initialWheel);
  assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + (math.needleFor(expectedStep).angle + focusAngle) + 'deg)');
  assert.equal(bands.length, 5);
  // 形の切替は炎だけ。回転・文字・数値を維持し、旧演出を残さない。
  const stableWheel = elements['wheel-rotor'].style.transform, stableNeedle = elements['rays-rotor'].style.transform;
  const stableSettings = JSON.parse(elements.settings.value);
  const otherVariant = initialVariant === 'bottom' ? 'original' : 'bottom';
  for (let i = 0; i < 3; i++) {
    const prior = activeEffects().slice();
    elements['flame-variant'].value = otherVariant; elements['flame-variant'].events.change();
    assert(prior.every(effect => effect.cancelled), '切替時に前の炎を即停止');
    assert.equal(activeEffects().length, effectsEnabled && !failOtherFlame ? 1 : 0);
    assert.equal(elements['flame-status'].hidden, !failFlame && !failOtherFlame);
    assert(effectParts.filter(part => part.className === 'selection-flame-art').every(part => part.src === flameModel.variant(otherVariant).src));
    assert.equal(elements.screen.style['--flame-origin'], flameModel.placement(flameModel.defaults, otherVariant).origin);
    assert.deepEqual(JSON.parse(elements.settings.value).flame, stableSettings.flame);
    assert.deepEqual(JSON.parse(elements.settings.value).wheel, stableSettings.wheel);
    assert.equal(JSON.parse(elements.settings.value).flameVariant, otherVariant);
    assert.equal(elements['wheel-rotor'].style.transform, stableWheel);
    assert.equal(elements['rays-rotor'].style.transform, stableNeedle);
    assert.equal(buttons[0].attributes['aria-pressed'], 'true');
    elements['flame-variant'].value = initialVariant; elements['flame-variant'].events.change();
    assert.equal(activeEffects().length, effectsEnabled ? 1 : 0, '失敗した別素材からでも使用可能な素材へ戻る');
  }
  // 非選択素材の遅い失敗通知が、再生中の炎を消さない。
  if (failOtherFlame) {
    const prior = activeEffects().slice(); elements[otherSource].onerror();
    assert(prior.every(effect => !effect.cancelled));
    assert.equal(elements['flame-status'].hidden, !failFlame);
  }
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
    assert.equal(button.style.transform, 'scale(1.18)');
    assert.equal(bands[index].style.scale, undefined);
    assert(bands[index].classList.contains('selected'));
    assert.equal(buttons.filter(b => b.style.transform === 'scale(1.18)').length, 1);
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
  if (effectsEnabled) assert.equal(activeEffects().length, 2, '連打後は最後の札の点火と揺らめきだけ');
  assert.equal(flames.filter(flame => flame.classList.contains('is-lit')).length, !reduce && !failImage && !failFlame ? 1 : 0);
  assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + (math.needleFor(expectedStep).angle + focusAngle) + 'deg)');
  const priorWheel = elements['wheel-rotor'].style.transform, priorNeedle = elements['rays-rotor'].style.transform;
  const priorEffects = effects().slice();
  elements.character.value = 'karima'; elements.character.events.change();
  assert(priorEffects.every(effect => effect.cancelled || effect.finished), 'キャラ切替時に前キャラの演出を消す');
  if (effectsEnabled) { assert.equal(activeEffects().length, 1); assert.equal(activeEffects()[0].options.iterations, Infinity, '色替えでは点火を繰り返さず静かな炎を維持'); }
  const beforeKarimaEffect = effects().length;
  buttons[3].events.click(); settle();
  assert.equal(effects().length - beforeKarimaEffect, effectsEnabled ? 2 : 0, 'カリマも同じ1枚の炎で点火と揺らめき');
  if (effectsEnabled) assert.deepEqual(activeEffects().map(effect => effect.options.duration).sort((a, b) => a - b), [720, 2600]);
  assert.equal(elements.screen.style['--flame-filter'], flameModel.colorFilter(flameModel.colorDefaults.karima));
  elements['selection-effects'].checked = false; elements['selection-effects'].events.change();
  assert(effects().every(effect => effect.cancelled || effect.finished), '演出OFFは再生中も直ちに停止');
  assert(flames.every(flame => !flame.classList.contains('is-lit')));
  const beforeDisabledEffect = effects().length;
  buttons[3].events.click(); settle();
  assert.equal(effects().length, beforeDisabledEffect, '演出OFFでも通常の選択動作は維持');
  elements['selection-effects'].checked = true; elements['selection-effects'].events.change();
  assert.equal(effects().length - beforeDisabledEffect, effectsEnabled ? 1 : 0, 'ONへ戻すと選択中の静かな炎だけ再開');
  const beforeHidden = effects().slice();
  document.hidden = true; document.visibilityChange();
  assert(beforeHidden.every(effect => effect.cancelled || effect.finished), '背景タブで無限アニメーションを止める');
  assert(flames.every(flame => !flame.classList.contains('is-lit')));
  buttons[3].events.click(); settle();
  assert.equal(activeEffects().length, 0, '背景タブ内で再点火しない');
  document.hidden = false; document.visibilityChange();
  assert.equal(activeEffects().length, effectsEnabled ? 1 : 0, '表示復帰でピークなしの揺らめきだけ再開');
  assert.deepEqual(JSON.parse(elements.settings.value), { ...math.settings({ ...math.preset('karima'), gap: -27, bandHeight: 31 }, 'karima'), flame: { ...flameModel.defaults }, flameVariant: initialVariant, flameColor: { ...flameModel.colorDefaults.karima } }, '色切替ではアルシェでの配置を維持');
  assert.equal(elements['wheel-rotor'].style.transform, priorWheel); assert.equal(elements['rays-rotor'].style.transform, priorNeedle);
  assert.equal(elements['disk-frame'].style.filter, 'url(#solar-frame-material)');
  assert.equal(elements.screen.style['--backing'], '#8c9daa');
  assert.equal(elements.screen.style['--backing-active'], '#567f9e');
  assert.equal(elements.screen.style['--row'], '#e4e7ea', '銀白の表札は維持');
  assert.equal(elements.screen.style['--rule'], '#8c9daa', '金属の縁の配色は維持');
  assert.equal(elements.screen.style['--active'], '#e8edf1');
  assert.equal(elements.screen.style['--shine'], '#68a7d1', 'カリマの選択内縁は青の発光');
  assert.equal(elements.screen.style['--active-rule'], '#4f86ae', '外縁とキーボードフォーカスも青');
  assert.equal(elements['command-selected-surface'].style['--active'], '#e8edf1');
  assert.equal(elements['command-selected-surface'].style['--face-gloss'], '#ffffff');
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
  elements['hue-number'].value = ''; elements['hue-number'].events.input(); assert.equal(JSON.parse(elements.settings.value).wheel.hue, 214);
  elements.hue.value = 190; elements.hue.events.input(); elements.saturation.value = 30; elements.saturation.events.input();
  assert.equal(JSON.parse(elements.settings.value).wheel.hue, 190);
  elements.background.value = 'corridor'; elements.background.events.change(); assert(elements.screen.style.backgroundImage.includes('corridor-reference'));
  elements.viewport.viewportWidth = 600; resize();
  assert.equal(buttons[3].attributes['aria-pressed'], 'true');
  const resized = /^translate\(([^p]+)px,([^p]+)px\)/.exec(anchors[3].style.transform);
  const adjustedGeometry = math.geometry(-7, 600 / 844, 700, 22);
  assert(Math.abs(Number(resized[2]) - 195 - adjustedGeometry.radius * Math.sin(adjustedGeometry.focusAngle * Math.PI / 180)) < 1e-7);
  const adjustedWheel = elements['wheel-rotor'].style.transform, adjustedNeedle = elements['rays-rotor'].style.transform;
  // 色相環・数値調整は炎だけへ反映。ドラッグでも点火／ループを作り直さない。
  const hueWheel = elements['flame-hue-wheel'];
  hueWheel.bounds = { left: 10, top: 20, width: 76, height: 76 };
  const effectCountBeforeColor = effects().length;
  const pointer = (x, y, extra = {}) => ({ isPrimary: true, pointerType: 'mouse', button: 0, pointerId: 7, clientX: x + 10, clientY: y + 20, preventDefault() {}, ...extra });
  hueWheel.events.pointerdown(pointer(76, 38));
  assert.equal(elements['flame-color-hue'].value, 90);
  assert(hueWheel.hasPointerCapture(7));
  hueWheel.events.pointermove(pointer(38, 76));
  assert.equal(elements['flame-color-hue-number'].value, 180);
  hueWheel.events.pointermove(pointer(38, 38));
  assert.equal(elements['flame-color-hue'].value, 180, '中央ドラッグでは角度を飛ばさない');
  hueWheel.events.pointercancel(pointer(0, 38));
  assert(!hueWheel.hasPointerCapture(7));
  hueWheel.events.pointermove(pointer(0, 38));
  assert.equal(elements['flame-color-hue'].value, 180, 'キャンセル後はドラッグ終了');
  hueWheel.events.pointerdown(pointer(0, 38, { button: 2 }));
  assert.equal(elements['flame-color-hue'].value, 180, '右クリックでは更新しない');
  hueWheel.events.pointerdown(pointer(0, 38, { isPrimary: false }));
  assert.equal(elements['flame-color-hue'].value, 180, '第2タッチは更新しない');
  hueWheel.events.pointerdown(pointer(0, 38, { pointerType: 'touch' }));
  hueWheel.events.pointerup(pointer(0, 38));
  assert.equal(elements['flame-color-hue'].value, 270);
  const key = (value, shiftKey = false) => hueWheel.events.keydown({ key: value, shiftKey, preventDefault() {} });
  key('Home'); key('ArrowLeft'); assert.equal(elements['flame-color-hue'].value, 359);
  key('ArrowRight'); key('ArrowUp', true); assert.equal(elements['flame-color-hue'].value, 10);
  key('End'); assert.equal(hueWheel.attributes['aria-valuenow'], '360');
  elements['flame-color-hue-number'].value = 247; elements['flame-color-hue-number'].events.input();
  elements['flame-color-saturation'].value = 87; elements['flame-color-saturation'].events.input();
  elements['flame-color-brightness-number'].value = 118; elements['flame-color-brightness-number'].events.input();
  const adjustedColor = { hue: 247, saturation: 87, brightness: 118 };
  assert.deepEqual(JSON.parse(elements.settings.value).flameColor, adjustedColor);
  assert.equal(elements.screen.style['--flame-filter'], flameModel.colorFilter(adjustedColor));
  assert.equal(hueWheel.style['--flame-filter'], elements.screen.style['--flame-filter']);
  assert.equal(hueWheel.style['--flame-hue'], '247deg');
  elements['flame-color-hue-number'].value = ''; elements['flame-color-hue-number'].events.input();
  assert.deepEqual(JSON.parse(elements.settings.value).flameColor, adjustedColor, '空欄では直前の色を保持');
  assert.equal(effects().length, effectCountBeforeColor, '色相環・スライダー連打で点火やループを生成しない');
  assert.equal(elements['wheel-rotor'].style.transform, adjustedWheel);
  assert.equal(elements['rays-rotor'].style.transform, adjustedNeedle);
  assert.deepEqual(JSON.parse(elements.settings.value).flame, { ...flameModel.defaults });
  elements.background.events.change();
  elements['flame-variant'].value = otherVariant; elements['flame-variant'].events.change();
  assert.deepEqual(JSON.parse(elements.settings.value).flameColor, adjustedColor, '背景・形の切替でも色を保つ');
  elements['flame-variant'].value = initialVariant; elements['flame-variant'].events.change();
  const colorEffectsAfterShape = effects().length;
  elements.character.value = 'alche'; elements.character.events.change();
  assert.deepEqual(JSON.parse(elements.settings.value).flameColor, { ...flameModel.colorDefaults.alche });
  elements['flame-color-hue'].value = 55; elements['flame-color-hue'].events.input();
  elements.character.value = 'karima'; elements.character.events.change();
  assert.deepEqual(JSON.parse(elements.settings.value).flameColor, adjustedColor, 'キャラ別に手元の色を保持');
  elements['reset-flame-color'].events.click();
  assert.deepEqual(JSON.parse(elements.settings.value).flameColor, { ...flameModel.colorDefaults.karima });
  assert.deepEqual(JSON.parse(elements.settings.value).flame, { ...flameModel.defaults }, '色リセットで位置を戻さない');
  elements.character.value = 'alche'; elements.character.events.change();
  assert.equal(JSON.parse(elements.settings.value).flameColor.hue, 55, '他キャラの色リセットは影響しない');
  elements['reset-flame-color'].events.click();
  elements.character.value = 'karima'; elements.character.events.change();
  assert.equal(elements['wheel-rotor'].style.transform, adjustedWheel);
  assert.equal(elements['rays-rotor'].style.transform, adjustedNeedle);
  assert.equal(buttons[3].attributes['aria-pressed'], 'true');
  // 上の色相環ドラッグ自体にはアニメーション生成がない。形／キャラ切替だけ再開。
  assert(colorEffectsAfterShape >= effectCountBeforeColor);
  // 炎専用調整は輪・針・選択位置を変更しない。ピークは再点火せず定常表示で合わせる。
  elements['flame-size-number'].value = 88; elements['flame-size-number'].events.input();
  assert.equal(elements['flame-size'].value, 88);
  assert.equal(elements.screen.style['--flame-size'], '88px');
  elements['flame-opacity'].value = 100; elements['flame-opacity'].events.input();
  assert.equal(elements.screen.style['--flame-opacity'], 1);
  elements['flame-x-number'].value = -20; elements['flame-x-number'].events.input();
  elements['flame-y'].value = -5; elements['flame-y'].events.input();
  const adjustedFlame = { size: 88, opacity: 100, x: -20, y: -5 };
  assert.deepEqual(JSON.parse(elements.settings.value).flame, adjustedFlame);
  assert.equal(elements['flame-y-number'].value, -5);
  assert.equal(elements.screen.style['--flame-left'], flameModel.placement(adjustedFlame, initialVariant).left);
  assert.equal(elements.screen.style['--flame-top'], flameModel.placement(adjustedFlame, initialVariant).top);
  assert.equal(elements['wheel-rotor'].style.transform, adjustedWheel);
  assert.equal(elements['rays-rotor'].style.transform, adjustedNeedle);
  assert.equal(buttons[3].attributes['aria-pressed'], 'true');
  if (effectsEnabled) assert.equal(activeEffects().length, 1, 'つまみ連打で常時炎が重複しない');
  elements['flame-x-number'].value = ''; elements['flame-x-number'].events.input();
  assert.deepEqual(JSON.parse(elements.settings.value).flame, adjustedFlame, '空欄を0へ勝手に置換しない');
  elements.character.value = 'alche'; elements.character.events.change();
  assert.deepEqual(JSON.parse(elements.settings.value).flame, adjustedFlame, 'キャラ切替でも炎の手元調整を維持');
  const switched = JSON.parse(elements.settings.value).wheel;
  assert.equal(switched.lightness, 0); assert.equal(switched.opacity, 40);
  assert.equal(elements.screen.style['--backing'], '#cba04e');
  assert.equal(elements.screen.style['--backing-active'], '#e1b359');
  assert.equal(elements.screen.style['--active'], '#292e36', '選択した表札を茶金色へ染めない');
  assert.equal(elements.screen.style['--shine'], '#e7c56b', 'アルシェの選択内縁は金の発光');
  assert.equal(elements.screen.style['--active-rule'], '#d6b45e', '外縁とキーボードフォーカスも金');
  assert.equal(elements['command-selected-surface'].style['--active'], '#292e36');
  assert.equal(elements['command-selected-surface'].style['--face-gloss'], '#4a5059');
  assert.equal(switched.gap, -7); assert.equal(switched.size, 700); assert.equal(switched.bandHeight, 22);
  assert.equal(elements['wheel-rotor'].style.transform, adjustedWheel); assert.equal(elements['rays-rotor'].style.transform, adjustedNeedle);
  await elements['copy-settings'].events.click();
  if (failCopy) { assert(elements['settings-details'].open); assert(elements.settings.selectedText); } else assert.equal(JSON.parse(copied).schema, 'solar-command-wheel-settings-v02');
  if (!failCopy) assert.deepEqual(JSON.parse(copied).flame, adjustedFlame, '炎の値もコピーへ含める');
  if (!failCopy) assert.equal(JSON.parse(copied).flameVariant, initialVariant, '形もコピーへ含める');
  if (!failCopy) assert.deepEqual(JSON.parse(copied).flameColor, { ...flameModel.colorDefaults.alche }, 'キャラ別の色もコピーへ含める');
  // OFFのまま形を変えても勝手にONにならない。
  elements['selection-effects'].checked = false; elements['selection-effects'].events.change();
  elements['flame-color-hue'].value = 70; elements['flame-color-hue'].events.input();
  assert.equal(activeEffects().length, 0, '演出OFF中の色調整で勝手に点火しない');
  elements['reset-flame-color'].events.click();
  elements['flame-variant'].value = otherVariant; elements['flame-variant'].events.change();
  assert.equal(activeEffects().length, 0);
  assert.equal(elements['selection-effects'].checked, false);
  elements['flame-variant'].value = initialVariant; elements['flame-variant'].events.change();
  elements['selection-effects'].checked = true; elements['selection-effects'].events.change();
  elements['reset-flame'].events.click();
  assert.deepEqual(JSON.parse(elements.settings.value).flame, { ...flameModel.defaults });
  assert.equal(JSON.parse(elements.settings.value).wheel.size, 700, '炎のリセットは輪を戻さない');
  elements['flame-opacity-number'].value = -1; elements['flame-opacity-number'].events.input();
  assert.equal(elements.screen.style['--flame-opacity'], 0);
  elements['replay-flame'].events.click(); settle();
  if (effectsEnabled) assert(activeEffects().every(effect => effect.options.iterations === Infinity || effect.keyframes.every(key => key.opacity === 0)), '濃さ0ではピークも見えない');
  elements['reset-flame'].events.click();
  elements.clear.events.click(); settle(); assert.equal(elements['rays-rotor'].style.transform, 'rotate(' + (math.idleFor(math.needleFor(expectedStep).angle) + adjustedGeometry.focusAngle) + 'deg)');
  assert(buttons.every(b => b.attributes['aria-pressed'] === 'false'));
  assert(buttons.every(b => b.style.transform === 'scale(1)'));
  assert(bands.every(band => !band.classList.contains('selected')));
  elements['replay-flame'].events.click(); settle();
  if (!reduce && !failFlame) assert.equal(buttons[2].attributes['aria-pressed'], 'true', '未選択の点火確認では中央の探索を選択');
  elements.clear.events.click(); settle();
  elements['reset-settings'].events.click(); assert.equal(elements.gap.value, -27); assert.equal(elements.bandHeight.value, 31);
  elements.character.value = 'karima'; elements.character.events.change();
  elements.lightness.value = 12; elements.lightness.events.input(); elements['reset-settings'].events.click();
  assert.equal(elements.lightness.value, 64); assert.equal(elements.hue.value, 214); assert.equal(elements.bandHeight.value, 31);
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
  if (effectsEnabled) {
    buttons[2].events.click(); settle();
    media.matches = true; media.change();
    assert(effects().every(effect => effect.cancelled || effect.finished), '動きを減らす設定へ切替時も停止');
    const beforeReducedEffect = effects().length;
    buttons[1].events.click(); settle(); assert.equal(effects().length, beforeReducedEffect);
    media.matches = false; media.change();
    buttons[1].events.click(); settle();
    assert(effects().some(effect => !effect.cancelled && !effect.finished));
  }
  pagehide(); assert(disconnected && mediaRemoved && visibilityRemoved); assert.equal(frames.size, 0);
  assert(effects().every(effect => effect.cancelled || effect.finished), '画面を閉じたら演出も停止');
  assert(flames.every(flame => !flame.classList.contains('is-lit')));
  effects().forEach(effect => {
    assert([1, Infinity].includes(effect.options.iterations));
    assert.equal(effect.options.fill, 'none', '終了後に演出を残さない');
    if (effect.options.iterations === 1) { assert.equal(effect.keyframes[0].opacity, 0); assert(effect.keyframes.at(-1).opacity >= 0 && effect.keyframes.at(-1).opacity <= 1); assert.equal(effect.keyframes.at(-1).transform, 'scale(1)'); }
    else { assert.deepEqual(effect.keyframes[0], effect.keyframes.at(-1), '静かなループの継ぎ目は同じ状態'); assert.equal(effect.options.duration, 2600); }
    effect.keyframes.forEach(keyframe => assert(Object.keys(keyframe).every(key => ['opacity', 'transform', 'offset'].includes(key)), '演出は装飾グループのtransformとopacityだけ'));
  });
}
async function main() {
  await run(); await run({ reduce: true }); await run({ failImage: true, failCopy: true });
  await run({ noAnimation: true }); await run({ earlySelect: true }); await run({ earlySelect: true, failImage: true });
  await run({ failFlame: true }); await run({ earlySelect: true, failFlame: true });
  await run({ initialVariant: 'original' }); await run({ failOtherFlame: true, earlySelect: true });
  await run({ initialVariant: 'original', failOtherFlame: true });
  const html = fs.readFileSync(path.join(__dirname, 'layout.html'), 'utf8');
  for (const match of html.matchAll(/<script src="([^"?]+)/g)) assert(fs.existsSync(path.resolve(__dirname, match[1])));
  assert(html.includes('id="wheel-panes"')); assert(html.includes('id="gap-number"')); assert(html.includes('layout-static.html'));
  const shape = /<template id="command-nameplate">([\s\S]*?)<\/template>/.exec(html)[1];
  const allOutlines = [...shape.matchAll(/points="([^"]+)"/g)].map(match => match[1].split(' ').map(point => point.split(',').map(Number)));
  assert(shape.includes('class="nameplate-backing"'));
  assert.deepEqual(allOutlines[0], allOutlines[1], '裏帯は既存の札の輪郭を複製し、針の受け口を新しく描き替えない');
  const outlines = allOutlines.slice(1);
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
  assert.equal(math.geometry().selectedScale, 1.18);
  assert(html.includes('overflow: visible;'));
  assert(html.includes('transform: translate(3px, 5px)'));
  assert(html.includes('transform: translate(4px, 8px)'));
  assert(html.includes('fill: url(#command-selected-surface)'));
  assert(html.includes('filter: drop-shadow(0 0 1px var(--shine))'));
  assert(html.includes('class="nameplate-face"'));
  assert(html.includes('.nameplate-shape .nameplate-face { fill-opacity: .74; }'), '面だけを透かす');
  assert(html.includes('fill: url(#command-selected-surface); fill-opacity: .84;'), '選択面は少し濃くして可読性を保つ');
  assert(html.includes('font-size: 16px; font-weight: 400; font-synthesis: none;'));
  assert(html.includes('letter-spacing: .12em;'));
  assert(html.includes('.command[aria-pressed=true] { font-weight: 500; }'));
  assert(shape.includes('<g mask="url(#command-backing-mask)"><polygon class="nameplate-backing"'), '裏帯だけをマスクし、枠と文字はマスクしない');
  const mask = /<mask id="command-backing-mask"([\s\S]*?)<\/mask>/.exec(html)[1];
  assert(mask.includes('maskUnits="userSpaceOnUse"') && mask.includes('maskContentUnits="userSpaceOnUse"'));
  assert(mask.includes('fill="white"'));
  const cutout = /<polygon points="([^"]+)" fill="black"/.exec(mask)[1];
  assert.equal(cutout, '1,1 139,1 139,33 1,33 21,17', '裏帯の抜き形は表札と同じ。透過面へ色を漏らさない');
  for (const viewportScale of [.46, .72, 1, 1.42]) for (const emphasis of [1, 1.18]) {
    const g = math.geometry(math.defaults.gap, viewportScale);
    for (const slot of math.slots(math.targetFor(-2 * g.pitch, 1, g), g)) {
      const parentTop = -slot.height / 2;
      const shapeCenter = parentTop + slot.height / 2 - g.bandHeight / 2 + g.bandHeight / 2;
      const textCenter = parentTop + slot.height / 2;
      assert.equal((slot.y + shapeCenter * emphasis) * viewportScale, (slot.y + textCenter * emphasis) * viewportScale);
    }
  }
  assert(html.includes('@media (prefers-reduced-motion: reduce)'));
  assert(html.includes('.selection-flame { position: absolute; left: var(--flame-left); top: var(--flame-top);'));
  assert(html.includes('transform-origin: var(--flame-origin, 17% 83%)'));
  assert(html.includes('id="flame-variant"'));
  assert(html.includes('id="flame-hue-wheel"') && html.includes('role="slider" tabindex="0"'));
  Object.keys(flameModel.colorRanges).forEach(key => {
    assert(html.includes('id="flame-color-' + key + '" type="range"'));
    assert(html.includes('id="flame-color-' + key + '-number" type="number"'));
  });
  assert(html.includes('<option value="bottom" selected>'));
  assert(html.includes('.selection-flame.is-lit { opacity: var(--flame-opacity, .83); }'));
  Object.keys(flameModel.defaults).forEach(key => {
    assert(html.includes('id="flame-' + key + '" type="range"'));
    assert(html.includes('id="flame-' + key + '-number" type="number"'));
  });
  assert(html.includes('.selection-flame { display: none; }'));
  assert(!shape.includes('selection-fx'), '細い線の旧エフェクトは残さない');
  assert(html.includes('id="selection-effects" type="checkbox" checked'));
  console.log('PASS: command layout, per-needle alignment, presets, raster flame ignition/idle, cancellation/replay, independent asset loading, effect toggle, tab visibility, reduced motion, static fallback and cleanup');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
