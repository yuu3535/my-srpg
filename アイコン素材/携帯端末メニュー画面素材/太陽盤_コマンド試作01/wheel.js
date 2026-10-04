(function () {
  'use strict';
  const byId = id => document.getElementById(id), math = window.SolarWheel;
  const screen = byId('screen'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let values = math.preset(byId('character').value), scale = 1, geometry = math.geometry(0, 1);
  let selected = -1, phase = -2 * geometry.pitch, target = phase, velocity = 0;
  let needle = geometry.focusAngle, needleVelocity = 0, rayStep = 0, needleTarget = needle, frame = null, lastTime = null;
  let loaded = false, failed = false, disposed = false;
  const flameModel = window.SolarFlame;
  let flameVariant = byId('flame-variant').value || 'bottom';
  const flameStates = { original: { ready: false, failed: false }, bottom: { ready: false, failed: false } };
  const burningModel = window.SolarCommandBurning;
  const flameDefaults = burningModel ? burningModel.defaults.flame : flameModel.defaults;
  const colorDefaults = burningModel ? burningModel.defaults.colors : flameModel.colorDefaults;
  let flameValues = flameModel.normalize(flameDefaults);
  const flameColors = { alche: flameModel.normalizeColor(colorDefaults.alche, 'alche'), karima: flameModel.normalizeColor(colorDefaults.karima, 'karima') };
  let pendingEffect = -1, effectAnimations = [];
  const nodes = math.commands.map((command, index) => {
    const anchor = document.createElement('div'); anchor.className = 'label-anchor';
    const band = document.createElement('div'); band.className = 'band-row';
    // 会話UIを基にした作者指定の切れ込み札。太陽盤の画像は変更しない。
    band.innerHTML = byId('command-nameplate').innerHTML;
    // 選んだ見本の炎を透過PNGで配置。両キャラは同じ形の色違いにする。
    const flame = document.createElement('span'); flame.className = 'selection-flame';
    flame.setAttribute('aria-hidden', 'true');
    const flameArt = document.createElement('img'); flameArt.className = 'selection-flame-art';
    flameArt.alt = ''; flameArt.draggable = false; flameArt.src = flameModel.variant(flameVariant).src;
    flame.append(flameArt); band.append(flame);
    const button = document.createElement('button'); button.className = 'command'; button.type = 'button';
    const copy = document.createElement('span'); copy.className = 'command-copy'; copy.textContent = command.label;
    // 札・内縁・文字を同じボタン内へ入れ、位置とは別の共通ローカル座標で拡大する。
    button.append(band); button.append(copy);
    button.setAttribute('aria-label', command.label + 'を針の選択位置へ回して選択');
    button.addEventListener('click', () => select(index));
    button.addEventListener('mouseenter', () => band.classList.add('hover'));
    button.addEventListener('mouseleave', () => band.classList.remove('hover'));
    button.addEventListener('focus', () => band.classList.add('focus'));
    button.addEventListener('blur', () => band.classList.remove('focus'));
    button.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') { clear(); return; }
      const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
      const count = math.commands.length;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (index + direction + count) % count;
      select(next); nodes[next].button.focus();
    });
    anchor.append(button); byId('labels').append(anchor); return { anchor, button, band, flame, flameArt };
  });
  const burning = window.SolarCommandBurning ? window.SolarCommandBurning.create({
    document, nodes, host: byId('screen'), schedule: setTimeout, cancel: clearTimeout, changed() {
      if (disposed || !usesApng()) return;
      if (burning.state.failed) cancelEffects();
      flameStatus(); playSelectionEffect();
    }
  }) : null;
  function usesApng() { return Boolean(burning && byId('flame-animation').value === 'apng'); }
  function effectState() { return usesApng() ? burning.state : flameStates[flameVariant]; }
  function cancelEffects(gentle = false) {
    pendingEffect = -1;
    let exiting = -1;
    if (burning) {
      if (gentle && usesApng() && !reduced.matches && !document.hidden && !disposed) exiting = burning.extinguish();
      else burning.stop();
    }
    effectAnimations.forEach(animation => { animation.onfinish = null; animation.cancel(); });
    effectAnimations = [];
    nodes.forEach((node, index) => { if (index !== exiting) node.flame.classList.remove('is-lit'); });
  }
  function playSelectionEffect(burst = true) {
    // APNGは視覚上の嵌合直前から短い点火。ばねの微小な残差待ちはしない。
    const approaching = usesApng() && Math.abs(phase - target) <= geometry.pitch * .12 && Math.abs(needle - needleTarget) <= 4;
    if (pendingEffect < 0 || (frame !== null && !approaching) || !loaded || !effectState().ready || disposed || document.hidden) return;
    const index = pendingEffect; pendingEffect = -1;
    if (index !== selected || failed || effectState().failed || reduced.matches || !byId('selection-effects').checked) return;
    const { flame, flameArt } = nodes[index];
    flame.classList.add('is-lit');
    if (usesApng()) { burning.play(index); return; }
    // API未対応では調整値どおりの静止炎。文字や選択操作には影響させない。
    if (typeof flame.animate !== 'function' || typeof flameArt.animate !== 'function') return;
    const track = animation => {
      effectAnimations.push(animation);
      animation.onfinish = () => { effectAnimations = effectAnimations.filter(item => item !== animation); };
    };
    if (burst) track(flame.animate([
      { opacity: 0, transform: flameVariant === 'bottom' ? 'scale(1,.45)' : 'scale(.45)' },
      { opacity: flameValues.opacity / 100, transform: flameVariant === 'bottom' ? 'scale(1,1.22)' : 'scale(1.22)', offset: .28 },
      { opacity: flameValues.opacity / 100, transform: flameVariant === 'bottom' ? 'scale(1,1.06)' : 'scale(1.06)', offset: .62 },
      { opacity: flameValues.opacity / 100, transform: 'scale(1)' }
    ], { duration: 720, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'none', iterations: 1 }));
    // 選択中の1枚だけ、根元を動かさずゆっくり揺らす。rAFの常時処理は増やさない。
    const idleFrames = flameVariant === 'bottom' ? [
      { transform: 'scaleY(1)' },
      { transform: 'scaleY(1.06)', offset: .25 },
      { transform: 'scaleY(.97)', offset: .55 },
      { transform: 'scaleY(1.03)', offset: .8 },
      { transform: 'scaleY(1)' }
    ] : [
      { transform: 'skewX(0deg) scale(1,1)' },
      { transform: 'skewX(-5deg) scale(.96,1.08)', offset: .22 },
      { transform: 'skewX(3deg) scale(1.04,.95)', offset: .48 },
      { transform: 'skewX(-2deg) scale(.98,1.04)', offset: .76 },
      { transform: 'skewX(0deg) scale(1,1)' }
    ];
    track(flameArt.animate(idleFrames, { duration: 2600, easing: 'ease-in-out', fill: 'none', iterations: Infinity }));
  }
  function relight() { cancelEffects(); pendingEffect = selected; playSelectionEffect(false); }
  function applyFlameColor() {
    const color = flameColors[byId('character').value], wheel = byId('flame-hue-wheel');
    const character = byId('character').value;
    const filter = usesApng() ? window.SolarCommandBurning.filter(character, color, flameModel.colorDefaults[character]) : flameModel.colorFilter(color);
    screen.style.setProperty('--flame-filter', filter);
    wheel.style.setProperty('--flame-filter', filter);
    if (burning) {
      const palette = window.SolarCommandBurning.palettes[character];
      screen.style.setProperty('--spark-color', palette.spark); screen.style.setProperty('--spark-core', palette.core);
    }
    wheel.style.setProperty('--flame-hue', color.hue + 'deg');
    wheel.setAttribute('aria-valuenow', String(color.hue));
    wheel.setAttribute('aria-valuetext', color.hue + '度');
    Object.keys(flameModel.colorRanges).forEach(key => {
      byId('flame-color-' + key).value = color[key];
      byId('flame-color-' + key + '-number').value = color[key];
      byId('flame-color-' + key + '-value').textContent = color[key] + (key === 'hue' ? '度' : '%');
    });
    exportSettings();
  }
  function changeFlameColor(key, value) {
    const character = byId('character').value;
    flameColors[character] = flameModel.normalizeColor({ ...flameColors[character], [key]: value }, character);
    // 色だけ即時更新。点火や揺らめきを再起動せず、ドラッグ中も根元・選択を保つ。
    applyFlameColor();
  }
  Object.keys(flameModel.colorRanges).forEach(key => ['flame-color-' + key, 'flame-color-' + key + '-number'].forEach(id => {
    byId(id).addEventListener('input', () => {
      const raw = byId(id).value;
      if (raw === '' || !Number.isFinite(Number(raw))) return;
      changeFlameColor(key, Number(raw));
    });
  }));
  const hueWheel = byId('flame-hue-wheel');
  function hueFromPointer(event) {
    const hue = flameModel.hueAt(event.clientX, event.clientY, hueWheel.getBoundingClientRect());
    if (hue !== null) changeFlameColor('hue', hue);
  }
  hueWheel.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); hueWheel.focus(); hueWheel.setPointerCapture(event.pointerId); hueFromPointer(event);
  });
  hueWheel.addEventListener('pointermove', event => { if (hueWheel.hasPointerCapture(event.pointerId)) hueFromPointer(event); });
  ['pointerup', 'pointercancel'].forEach(type => hueWheel.addEventListener(type, event => {
    if (hueWheel.hasPointerCapture(event.pointerId)) hueWheel.releasePointerCapture(event.pointerId);
  }));
  hueWheel.addEventListener('keydown', event => {
    const directions = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (!Object.hasOwn(directions, event.key) && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const hue = flameColors[byId('character').value].hue;
    changeFlameColor('hue', event.key === 'Home' ? 0 : event.key === 'End' ? 360
      : (hue + directions[event.key] * (event.shiftKey ? 10 : 1) + 360) % 360);
  });
  byId('reset-flame-color').addEventListener('click', () => {
    const character = byId('character').value;
    flameColors[character] = flameModel.normalizeColor(colorDefaults[character], character); applyFlameColor();
  });
  function applyFlame() {
    const placed = flameModel.placement(flameValues, usesApng() ? 'bottom' : flameVariant);
    screen.style.setProperty('--flame-size', placed.size + 'px');
    screen.style.setProperty('--flame-opacity', placed.opacity);
    screen.style.setProperty('--flame-left', placed.left);
    screen.style.setProperty('--flame-top', placed.top);
    screen.style.setProperty('--flame-origin', placed.origin);
    Object.keys(flameModel.defaults).forEach(key => {
      byId('flame-' + key).value = flameValues[key];
      byId('flame-' + key + '-number').value = flameValues[key];
      byId('flame-' + key + '-value').textContent = flameValues[key] + (key === 'opacity' ? '%' : ' px');
    });
    exportSettings();
  }
  Object.keys(flameModel.defaults).forEach(key => ['flame-' + key, 'flame-' + key + '-number'].forEach(id => {
    byId(id).addEventListener('input', () => {
      const raw = byId(id).value;
      if (raw === '' || !Number.isFinite(Number(raw))) return;
      flameValues = flameModel.normalize({ ...flameValues, [key]: Number(raw) });
      applyFlame(); if (!usesApng()) relight();
    });
  }));
  byId('reset-flame').addEventListener('click', () => { flameValues = flameModel.normalize(flameDefaults); applyFlame(); if (!usesApng()) relight(); });
  byId('replay-flame').addEventListener('click', () => {
    if (reduced.matches) { status('端末の「動きを減らす」が有効なため、炎は非表示です。'); return; }
    if (effectState().failed) { status('炎の素材を読み込めません。再生方法を切り替えるか再読み込みして確認してください。'); return; }
    byId('selection-effects').checked = true;
    select(selected < 0 ? 2 : selected);
  });
  byId('selection-effects').addEventListener('change', () => { if (byId('selection-effects').checked) relight(); else cancelEffects(); });
  function flameStatus() {
    const state = effectState(), message = byId('flame-status');
    message.hidden = state.ready;
    message.textContent = state.failed
      ? '選んだ炎の素材を読み込めません。メニューの選択操作はそのまま使えます。形を切り替えるか再読み込みしてください。'
      : '選んだ炎の素材を読み込んでいます。';
    if (usesApng() && state.ready && state.exitFailed) {
      message.hidden = false;
      message.textContent = '消火素材を読み込めません。点火・燃焼とメニュー操作は使えますが、切替時は炎を即時停止します。';
    }
  }
  if (burning) {
    function animationMode() {
      cancelEffects();
      byId('flame-variant').disabled = usesApng();
      byId('flame-particles').disabled = !usesApng();
      byId('flame-color-help').textContent = usesApng()
        ? '確認済みの金色／青紫を基準に微調整。色相は基準値からの差分、彩度・明るさは基準値との比率で反映します。色相環の丸は目安です。'
        : '色相環をクリック・ドラッグ、または矢印キーで1度ずつ調整。Shift＋矢印は10度ずつ。色の丸は目安です。';
      applyFlame(); applyFlameColor(); flameStatus(); pendingEffect = selected; playSelectionEffect(false);
    }
    byId('flame-animation').addEventListener('change', animationMode);
    byId('flame-particles').addEventListener('change', () => { burning.setSparks(byId('flame-particles').checked); exportSettings(); });
    byId('flame-variant').disabled = usesApng();
    byId('flame-particles').disabled = !usesApng();
    byId('flame-color-help').textContent = '確認済みの金色／青紫を基準に微調整。色相は基準値からの差分、彩度・明るさは基準値との比率で反映します。色相環の丸は目安です。';
  }
  byId('flame-variant').addEventListener('change', () => {
    const next = byId('flame-variant').value;
    if (!Object.hasOwn(flameModel.variants, next)) return;
    cancelEffects(); flameVariant = next;
    nodes.forEach(node => { node.flameArt.src = flameModel.variant(next).src; });
    applyFlame(); applyFlameColor(); flameStatus(); pendingEffect = selected; playSelectionEffect(false);
  });
  // 片方が失敗しても、もう片方やメニューの操作は使える。非選択素材の遅い通知は現在の炎を消さない。
  Object.keys(flameModel.variants).forEach(key => {
    const source = byId(key === 'original' ? 'flame-source' : 'flame-bottom-source');
    source.onload = () => {
      if (disposed) return;
      flameStates[key].ready = true; flameStates[key].failed = false;
      if (key === flameVariant && !usesApng()) { flameStatus(); playSelectionEffect(); }
    };
    source.onerror = () => {
      if (disposed) return;
      flameStates[key].failed = true; flameStates[key].ready = false;
      if (key === flameVariant && !usesApng()) { cancelEffects(); flameStatus(); }
    };
    source.src = flameModel.variant(key).src;
  });
  function status(message) { if (byId('status').textContent !== message) byId('status').textContent = message; }
  function render() {
    const slots = math.slots(phase, geometry, selected, math.needleFor(rayStep).radius);
    screen.style.setProperty('--hit-height', geometry.height + 'px');
    slots.forEach((slot, index) => {
      const node = nodes[index];
      node.anchor.style.transform = 'translate(' + slot.left + 'px,' + slot.y + 'px)';
      node.anchor.style.opacity = String(slot.opacity);
      node.band.classList.toggle('selected', index === selected);
      // 札と文字を同じ中心で拡大。移動中も文字は水平に保つ。
      const emphasis = index === selected ? geometry.selectedScale : 1;
      node.button.style.transform = 'scale(' + emphasis + ')';
      node.button.style.pointerEvents = slot.opacity < .2 ? 'none' : 'auto';
      node.button.setAttribute('aria-pressed', String(index === selected));
      // 上下の回り込み中でもキーボードから全コマンドへ到達できる。
      node.button.tabIndex = 0;
    });
    byId('wheel-rotor').style.transform = 'rotate(' + (phase + geometry.focusAngle) + 'deg)';
    byId('rays-rotor').style.transform = 'rotate(' + needle + 'deg)';
    if (loaded && !failed) {
      if (selected < 0) status('未選択：曲線の針が選択位置を向いています。コマンドを押してみてください。');
      else status((frame === null ? '選択：' : '回転中：') + math.commands[selected].label + '。今回は選択の動作見本です。');
    }
  }
  function stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; lastTime = null; velocity = 0; needleVelocity = 0; }
  function animate(time) {
    if (disposed) return;
    const dt = lastTime === null ? 1 / 60 : Math.min((time - lastTime) / 1000, 1 / 30); lastTime = time;
    const wheel = math.spring(phase, velocity, target, dt); phase = wheel.position; velocity = wheel.velocity;
    // 移動した項目数に応じて次の菱形へ回す。角度を毎回同じ位置へ戻さない。
    const ray = math.spring(needle, needleVelocity, needleTarget, dt, 350, 32); needle = ray.position; needleVelocity = ray.velocity;
    if (wheel.settled && ray.settled) { frame = null; lastTime = null; render(); playSelectionEffect(); return; }
    render(); if (usesApng()) playSelectionEffect(); frame = requestAnimationFrame(animate);
  }
  function start() {
    if (disposed) return;
    if (reduced.matches) { stop(); phase = target; needle = needleTarget; render(); playSelectionEffect(); return; }
    if (frame === null) { lastTime = null; frame = requestAnimationFrame(animate); }
    render();
  }
  function select(index) {
    cancelEffects(index !== selected); pendingEffect = index;
    const next = math.targetFor(target, index, geometry);
    rayStep += Math.round((next - target) / geometry.pitch);
    selected = index; target = next; needleTarget = math.needleFor(rayStep).angle + geometry.focusAngle; start();
  }
  function navigate(direction) {
    const centered = math.slots(target, geometry).reduce((a, b) => Math.abs(a.angle - geometry.focusAngle) < Math.abs(b.angle - geometry.focusAngle) ? a : b).index;
    const count = math.commands.length;
    select(((selected < 0 ? centered : selected) + direction + count) % count);
  }
  function clear() { cancelEffects(true); selected = -1; needleTarget = math.idleFor(needleTarget - geometry.focusAngle) + geometry.focusAngle; start(); }
  byId('previous').addEventListener('click', () => navigate(-1));
  byId('next').addEventListener('click', () => navigate(1));
  byId('clear').addEventListener('click', clear);
  screen.addEventListener('click', event => { if (!event.target.closest('.command')) clear(); });
  function refreshGeometry() {
    const next = math.geometry(values.gap, scale, values.size, values.bandHeight), ratio = next.pitch / geometry.pitch;
    const focusShift = next.focusAngle - geometry.focusAngle;
    needle += focusShift; needleTarget += focusShift;
    phase *= ratio; target *= ratio; velocity *= ratio; geometry = next;
    screen.style.setProperty('--band-height', geometry.bandHeight + 'px');
    screen.style.setProperty('--card-width', geometry.cardWidth + 'px');
    render();
  }
  function resize() {
    scale = byId('viewport').getBoundingClientRect().width / 844;
    screen.style.setProperty('--scale', scale); refreshGeometry();
  }
  const observer = new ResizeObserver(resize); observer.observe(byId('viewport')); resize();
  function filters() {
    const palette = window.SolarCharacterColors.palette(byId('character').value);
    const profile = { original: false, hue: values.hue, saturation: values.saturation, lightness: values.lightness, shading: 35, gloss: 0 };
    const wheelFilters = window.SolarMaterials.filters({ white: profile, ochre: profile }).replaceAll('solar-panes-material', 'wheel-panes-material').replaceAll('solar-frame-material', 'wheel-frame-material');
    byId('material-defs').innerHTML = window.SolarMaterials.filters(palette) + wheelFilters;
    ['disk', 'rays'].forEach(group => {
      byId(group + '-panes').style.filter = 'url(#solar-panes-material)';
      byId(group + '-panes').style.opacity = group === 'disk' ? .5 : .89;
      byId(group + '-frame').style.filter = palette.gold.original ? 'none' : 'url(#solar-frame-material)';
    });
  }
  function exportSettings() {
    // v02の輪はそのまま。試作の炎は独立した任意項目としてコピーする。
    const character = byId('character').value;
    const combustion = burning ? { flameAnimation: usesApng() ? 'apng' : 'legacy', flamePalette: usesApng() ? window.SolarCommandBurning.palettes[character].name : 'legacy', flameParticles: byId('flame-particles').checked } : {};
    byId('settings').value = JSON.stringify({ ...math.settings(values, character), flame: { ...flameValues }, flameVariant, flameColor: { ...flameColors[character] }, ...combustion }, null, 2);
  }
  function applyWheel() {
    const ring = byId('outer-ring');
    ring.style.width = values.size + 'px'; ring.style.height = values.size + 'px';
    ring.style.transform = 'translate(' + -values.size / 2 + 'px,' + (195 - values.size / 2) + 'px)';
    byId('wheel-panes').style.opacity = values.opacity / 100;
    Object.keys(math.defaults).forEach(key => {
      byId(key).value = values[key]; byId(key + '-number').value = values[key];
      byId(key + '-value').textContent = values[key] + (key === 'gap' || key === 'size' || key === 'bandHeight' ? ' px' : key === 'hue' ? '度' : '%');
    });
    refreshGeometry(); filters(); exportSettings();
  }
  Object.keys(math.defaults).forEach(key => [key, key + '-number'].forEach(id => {
    byId(id).addEventListener('input', () => {
      const raw = byId(id).value;
      if (raw === '' || !Number.isFinite(Number(raw))) return;
      values = math.normalize({ ...values, [key]: Number(raw) }); applyWheel();
    });
  }));
  byId('reset-settings').addEventListener('click', () => { values = math.preset(byId('character').value); applyWheel(); });
  byId('copy-settings').addEventListener('click', async () => {
    exportSettings();
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('コピーAPIがありません');
      await navigator.clipboard.writeText(byId('settings').value); status('調整値をコピーしました。このチャットへ貼り付けられます。');
    } catch {
      byId('settings-details').open = true; byId('settings').focus(); byId('settings').select();
      status('自動コピーができません。表示した調整値を手動でコピーしてください。');
    }
  });
  function background() {
    const value = byId('background').value, karima = byId('character').value === 'karima';
    screen.style.backgroundColor = value === 'gray' ? '#85878b' : '#ececeb';
    screen.style.backgroundImage = value === 'corridor' ? 'url("../太陽盤_試作02/corridor-reference.png")' : 'none';
    // 面だけの半透明はCSSで制御。文字・枠は維持し、背景変更で色は変えない。
    screen.style.setProperty('--ink', karima ? '#333942' : '#eee9df');
    screen.style.setProperty('--row', karima ? '#e4e7ea' : '#252931');
    screen.style.setProperty('--rule', karima ? '#8c9daa' : '#bba57c');
    // 選択面は無彩色のまま。金色は裏帯へ分離し、表面は薄い白系の光沢にする。
    screen.style.setProperty('--active', karima ? '#e8edf1' : '#292e36');
    screen.style.setProperty('--active-rule', karima ? '#4f86ae' : '#d6b45e');
    screen.style.setProperty('--face-gloss', karima ? '#ffffff' : '#4a5059');
    screen.style.setProperty('--shine', karima ? '#68a7d1' : '#e7c56b');
    applyFlameColor();
    // 共有SVGのdefsはscreenの外なので、参照先の変数をdefsにも同期する。
    const surface = byId('command-selected-surface');
    surface.style.setProperty('--active', karima ? '#e8edf1' : '#292e36');
    surface.style.setProperty('--face-gloss', karima ? '#ffffff' : '#4a5059');
    screen.style.setProperty('--backing', karima ? '#8c9daa' : '#cba04e');
    screen.style.setProperty('--backing-active', karima ? '#567f9e' : '#e1b359');
  }
  byId('character').addEventListener('change', () => {
    if (!usesApng()) cancelEffects();
    const saved = math.preset(byId('character').value);
    // 色違いだけ切替。手元で動かした配置・帯の高さ・選択・回転角は保持する。
    ['hue', 'saturation', 'lightness', 'opacity'].forEach(key => { values[key] = saved[key]; });
    applyWheel(); background();
    if (!usesApng()) { pendingEffect = selected; playSelectionEffect(false); }
  });
  byId('background').addEventListener('change', background);
  let remaining = 5;
  ['disk-panes', 'disk-frame', 'rays-panes', 'rays-frame', 'wheel-panes'].forEach(id => {
    const img = byId(id); let settled = false;
    const finish = success => {
      if (settled || disposed) return; settled = true; failed ||= !success;
      if (--remaining !== 0) return;
      loaded = true; byId('loading').hidden = true; byId('error').hidden = !failed;
      if (failed) { byId('error').textContent = '太陽盤または輪を読み込めません。隣の試作03フォルダの素材を確認してください。'; status('素材の読込に失敗しました。'); }
      render(); playSelectionEffect();
    };
    img.onload = () => finish(true); img.onerror = () => finish(false);
    img.src = '../太陽盤_試作03/' + (id === 'wheel-panes' ? 'disk-panes' : id) + '.png';
  });
  const motionChange = () => { if (reduced.matches) { cancelEffects(); start(); } else relight(); };
  reduced.addEventListener('change', motionChange);
  const visibilityChange = () => { if (document.hidden) cancelEffects(); else relight(); };
  document.addEventListener('visibilitychange', visibilityChange);
  window.addEventListener('pagehide', () => { disposed = true; cancelEffects(); if (burning) burning.dispose(); stop(); observer.disconnect(); reduced.removeEventListener('change', motionChange); document.removeEventListener('visibilitychange', visibilityChange); }, { once: true });
  applyWheel(); applyFlame(); background(); render();
})();
