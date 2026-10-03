(function () {
  'use strict';
  const byId = id => document.getElementById(id), math = window.SolarWheel;
  const screen = byId('screen'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let values = math.preset(byId('character').value), scale = 1, geometry = math.geometry(0, 1);
  let selected = -1, phase = -2 * geometry.pitch, target = phase, velocity = 0;
  let needle = geometry.focusAngle, needleVelocity = 0, rayStep = 0, needleTarget = needle, frame = null, lastTime = null;
  let loaded = false, failed = false, disposed = false;
  const nodes = math.commands.map((command, index) => {
    const anchor = document.createElement('div'); anchor.className = 'label-anchor';
    const band = document.createElement('div'); band.className = 'band-row';
    // 会話UIを基にした作者指定の切れ込み札。太陽盤の画像は変更しない。
    band.innerHTML = byId('command-nameplate').innerHTML;
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
    anchor.append(button); byId('labels').append(anchor); return { anchor, button, band };
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
    if (wheel.settled && ray.settled) { frame = null; lastTime = null; render(); return; }
    render(); frame = requestAnimationFrame(animate);
  }
  function start() {
    if (disposed) return;
    if (reduced.matches) { stop(); phase = target; needle = needleTarget; render(); return; }
    if (frame === null) { lastTime = null; frame = requestAnimationFrame(animate); }
    render();
  }
  function select(index) {
    const next = math.targetFor(target, index, geometry);
    rayStep += Math.round((next - target) / geometry.pitch);
    selected = index; target = next; needleTarget = math.needleFor(rayStep).angle + geometry.focusAngle; start();
  }
  function navigate(direction) {
    const centered = math.slots(target, geometry).reduce((a, b) => Math.abs(a.angle - geometry.focusAngle) < Math.abs(b.angle - geometry.focusAngle) ? a : b).index;
    const count = math.commands.length;
    select(((selected < 0 ? centered : selected) + direction + count) % count);
  }
  function clear() { selected = -1; needleTarget = math.idleFor(needleTarget - geometry.focusAngle) + geometry.focusAngle; start(); }
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
  function exportSettings() { byId('settings').value = JSON.stringify(math.settings(values, byId('character').value), null, 2); }
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
    // 名前札と同じ不透明な下地と細い内縁。背景変更で札の配色は変えない。
    screen.style.setProperty('--ink', karima ? '#333942' : '#eee9df');
    screen.style.setProperty('--row', karima ? '#e4e7ea' : '#252931');
    screen.style.setProperty('--rule', karima ? '#8c9daa' : '#bba57c');
    screen.style.setProperty('--active', karima ? '#f0f2f3' : '#37312a');
    screen.style.setProperty('--active-rule', karima ? '#607988' : '#dec797');
  }
  byId('character').addEventListener('change', () => {
    const saved = math.preset(byId('character').value);
    // 色違いだけ切替。手元で動かした配置・帯の高さ・選択・回転角は保持する。
    ['hue', 'saturation', 'lightness', 'opacity'].forEach(key => { values[key] = saved[key]; });
    applyWheel(); background();
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
      render();
    };
    img.onload = () => finish(true); img.onerror = () => finish(false);
    img.src = '../太陽盤_試作03/' + (id === 'wheel-panes' ? 'disk-panes' : id) + '.png';
  });
  const motionChange = () => { if (reduced.matches) start(); };
  reduced.addEventListener('change', motionChange);
  window.addEventListener('pagehide', () => { disposed = true; stop(); observer.disconnect(); reduced.removeEventListener('change', motionChange); }, { once: true });
  applyWheel(); background(); render();
})();
