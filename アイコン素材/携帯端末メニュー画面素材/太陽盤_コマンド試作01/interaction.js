(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const orbit = window.SolarOrbit;
  const viewport = byId('viewport'), home = byId('home');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const nodes = [];
  let angle = orbit.targetFor(0, 0), target = angle, gap = 18, velocity = 0, frame = null, lastTime = null;
  let drag = null, suppressUntil = 0, wheelUntil = 0, disposed = false;
  let currentIndex = -1;
  for (let i = 0; i < orbit.commands.length; i++) {
    const command = orbit.commands[i];
    const connector = document.createElement('div'); connector.className = 'command-connector';
    const anchor = document.createElement('div'); anchor.className = 'label-anchor';
    const button = document.createElement('button'); button.className = 'command'; button.type = 'button'; button.textContent = command.label;
    button.setAttribute('aria-label', command.label + 'を選択');
    anchor.append(button); byId('connectors').append(connector); byId('labels').append(anchor);
    button.addEventListener('click', () => {
      if (performance.now() < suppressUntil) return;
      if (orbit.selected(angle) === i && Math.abs(orbit.slot(angle, i, gap).rotation) < 1) openDestination();
      else moveTo(orbit.targetFor(target, i));
    });
    nodes.push({ connector, anchor, button });
  }
  function resize() {
    const scale = viewport.getBoundingClientRect().width / 844;
    home.style.setProperty('--scale', scale);
    home.style.setProperty('--hit-height', Math.max(44, 44 / Math.max(scale, .1)) + 'px');
  }
  const observer = new ResizeObserver(resize); observer.observe(viewport); resize();
  function render() {
    const selected = orbit.selected(angle);
    byId('rays-rotor').style.transform = 'rotate(' + angle + 'deg)';
    nodes.forEach((node, i) => {
      const position = orbit.slot(angle, i, gap);
      const transform = 'translate(' + position.x + 'px,' + position.y + 'px) rotate(' + position.rotation + 'deg)';
      node.anchor.style.transform = transform;
      node.connector.style.transform = 'translate(' + position.line.x + 'px,' + position.line.y + 'px) rotate(' + position.line.rotation + 'deg) scaleX(' + position.line.length + ')';
      node.button.style.transform = 'rotate(' + position.counterRotation + 'deg)';
      node.connector.hidden = !position.visible; node.anchor.hidden = !position.visible;
      const active = position.commandIndex === selected;
      node.connector.classList.toggle('selected', active);
      node.button.setAttribute('aria-pressed', String(active));
      node.button.tabIndex = position.visible ? 0 : -1;
    });
    const value = Math.round(orbit.mod(angle, 360)) % 360;
    byId('angle').value = value; byId('angle-value').textContent = value + '度';
    if (selected !== currentIndex) {
      currentIndex = selected;
      byId('selected-title').textContent = orbit.commands[selected].label;
      byId('selected-detail').textContent = orbit.commands[selected].detail;
      byId('status').textContent = '選択：' + orbit.commands[selected].label + '。開く操作は説明表示のみです。';
    }
  }
  function stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; lastTime = null; velocity = 0; }
  function animate(time) {
    if (disposed) return;
    const dt = lastTime === null ? 1 / 60 : Math.min((time - lastTime) / 1000, 1 / 30);
    lastTime = time;
    // 位置ではなく共通角度へばねをかけ、描画はtransformだけ更新。
    velocity += ((target - angle) * 100 - velocity * 20) * dt;
    angle += velocity * dt;
    if (Math.abs(target - angle) < .03 && Math.abs(velocity) < .08) { angle = target; frame = null; lastTime = null; velocity = 0; render(); return; }
    render(); frame = requestAnimationFrame(animate);
  }
  function moveTo(value) {
    if (disposed) return;
    target = value;
    if (reduced.matches) { stop(); angle = target; render(); return; }
    if (frame === null) { lastTime = null; frame = requestAnimationFrame(animate); }
  }
  function navigate(direction) {
    const index = orbit.mod(orbit.selected(target) + direction, 4);
    moveTo(orbit.targetFor(target, index));
  }
  function openDestination() {
    const command = orbit.commands[orbit.selected(angle)];
    byId('destination-title').textContent = command.label + '専用画面への入口';
    byId('destination-detail').textContent = command.detail;
    byId('destination').showModal();
  }
  byId('decide').addEventListener('click', openDestination);
  byId('previous').addEventListener('click', () => navigate(-1));
  byId('next').addEventListener('click', () => navigate(1));
  byId('reset-angle').addEventListener('click', () => moveTo(orbit.targetFor(angle, 0)));
  byId('angle').addEventListener('input', () => { stop(); angle = Number(byId('angle').value); target = angle; render(); });
  byId('angle').addEventListener('change', () => moveTo(orbit.snap(angle)));
  byId('gap').addEventListener('input', () => { gap = Number(byId('gap').value); byId('gap-value').textContent = gap + ' px'; render(); });
  viewport.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); navigate(1); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); navigate(-1); }
    else if (event.key === 'Enter' && event.target === viewport) { event.preventDefault(); openDestination(); }
  });
  function point(event) {
    const rect = viewport.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 844, y: (event.clientY - rect.top) / rect.height * 390 };
  }
  function pointerAngle(p) { return Math.atan2(p.y - 195, p.x) * 180 / Math.PI; }
  viewport.addEventListener('pointerdown', event => {
    const p = point(event);
    if (drag || event.button !== 0 || p.x > 280 || Math.hypot(p.x, p.y - 195) < 35) return;
    stop(); target = angle;
    const captor = event.target.closest('button') || viewport;
    drag = { id: event.pointerId, previous: pointerAngle(p), origin: p, moved: false, captor };
    // 札からつかんだ場合も画面外での終了を受け取る。クリック時は札に捕捉する。
    captor.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const p = point(event);
    if (Math.hypot(p.x, p.y - 195) < 35) return;
    if (!drag.moved && Math.hypot(p.x - drag.origin.x, p.y - drag.origin.y) < 5) return;
    if (!drag.moved) { drag.moved = true; viewport.setPointerCapture(event.pointerId); home.classList.add('dragging'); }
    const next = pointerAngle(p); angle += orbit.dragDelta(drag.previous, next); drag.previous = next; target = angle; render();
    event.preventDefault();
  });
  function finishDrag(event, snap) {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved, captor = drag.captor; drag = null; home.classList.remove('dragging');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    else if (captor.hasPointerCapture(event.pointerId)) captor.releasePointerCapture(event.pointerId);
    if (moved) { suppressUntil = performance.now() + 250; if (snap) moveTo(orbit.snap(angle)); }
  }
  viewport.addEventListener('pointerup', event => finishDrag(event, true));
  viewport.addEventListener('pointercancel', event => finishDrag(event, true));
  viewport.addEventListener('lostpointercapture', event => {
    // 札からviewportへの捕捉移譲で発生するlostは、ドラッグ終了ではない。
    if (!viewport.hasPointerCapture(event.pointerId)) finishDrag(event, true);
  });
  viewport.addEventListener('click', event => { if (performance.now() < suppressUntil) { event.preventDefault(); event.stopPropagation(); } }, true);
  viewport.addEventListener('wheel', event => {
    if (point(event).x > 280 || event.ctrlKey || event.deltaY === 0) return;
    event.preventDefault();
    const now = performance.now(); if (now < wheelUntil) return;
    wheelUntil = now + 160; navigate(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  function applyTheme() {
    const name = byId('character').value, p = window.SolarCharacterColors.palette(name);
    byId('material-defs').innerHTML = window.SolarMaterials.filters(p);
    document.documentElement.style.setProperty('--accent', name === 'karima' ? '#afc7cf' : '#c7a36b');
    ['disk', 'rays'].forEach(group => {
      byId(group + '-panes').style.filter = 'url(#solar-panes-material)';
      byId(group + '-frame').style.filter = p.gold.original ? 'none' : 'url(#solar-frame-material)';
      byId(group + '-panes').style.opacity = group === 'disk' ? .5 : .89;
    });
    applyBackground();
  }
  byId('character').addEventListener('change', applyTheme);
  function applyBackground() {
    const value = byId('background').value;
    home.style.backgroundImage = value === 'corridor' ? 'url("../太陽盤_試作02/corridor-reference.png")' : 'none';
    home.style.backgroundColor = value === 'dark' ? '#292c32' : '#85878b';
    const gray = value === 'gray';
    document.documentElement.style.setProperty('--label-ink', gray ? '#292c30' : '#f4f3ee');
    document.documentElement.style.setProperty('--label-shadow', gray ? 'none' : '0 1px 2px #202226');
    document.documentElement.style.setProperty('--line-ink', gray ? (byId('character').value === 'karima' ? '#4c626c' : '#766144') : 'var(--accent)');
  }
  byId('background').addEventListener('change', applyBackground);
  let remaining = 4, failed = false;
  ['disk', 'rays'].forEach(group => ['panes', 'frame'].forEach(part => {
    const img = byId(group + '-' + part); let done = false;
    const settle = success => {
      if (done || disposed) return; done = true; failed ||= !success;
      if (--remaining === 0) {
        byId('loading').hidden = true; byId('asset-error').hidden = !failed;
        byId('asset-error').textContent = failed ? '素材を読み込めません。試作03の4枚のPNGが隣のフォルダにあるか確認してください。' : '';
      }
    };
    img.onload = () => settle(true); img.onerror = () => settle(false);
    img.src = '../太陽盤_試作03/' + group + '-' + part + '.png';
  }));
  window.addEventListener('pagehide', () => { disposed = true; stop(); observer.disconnect(); drag = null; }, { once: true });
  applyTheme(); render();
})();
