/* APNG本体はブラウザーが再生する。コマ確認時は元の連番PNGへ切り替える。 */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const root = byId('apng-demo'), model = window.SolarFlame;
  const animated = Array.from(root.querySelectorAll('.animated'));
  const still = Array.from(root.querySelectorAll('.still'));
  const sparkFields = Array.from(root.querySelectorAll('.spark-field'));
  // すべて札の右端側。左の文字領域へ流さず、短い寿命で上へ離れる。
  const sparkSeeds = [
    [140, 155, 2.4, 14, -54, 'early'], [154, 144, 2, -4, -67, 'early'],
    [168, 136, 2.6, 20, -43, 'middle'], [130, 156, 1.9, 30, -44, 'middle'],
    [160, 120, 2.2, 10, -48, 'late'], [173, 132, 2, 16, -52, 'late']
  ];
  function svgNode(tag, attrs) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }
  sparkFields.forEach(field => sparkSeeds.forEach(([x, y, radius, drift, rise, phase], index) => {
    const group = svgNode('g', { class: 'spark spark-' + phase });
    group.style.setProperty('--drift', drift + 'px');
    group.style.setProperty('--rise', rise + 'px');
    group.appendChild(svgNode('circle', { class: 'spark-halo', cx: x, cy: y, r: radius * 2.6 }));
    if (index === 1 || index === 4) group.appendChild(svgNode('path', {
      class: 'spark-trail', d: 'M' + x + ',' + y + ' l-2,6', fill: 'none'
    }));
    group.appendChild(svgNode('circle', { class: 'spark-core', cx: x, cy: y, r: radius }));
    field.appendChild(group);
  }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const source = 'fx/command-flame-burn-v03.apng';
  const frames = Array.from({ length: 17 }, (_, index) =>
    'fx/command-flame-burn-v03-frames/' + String(index + 1).padStart(2, '0') + '.png');
  const stages = ['点火', '小', '小', '小', '中', '中', '中', '中', '中', '中', '中', '縮む', '小', '消火', '消火', '消火', '透明'];
  let ready = false, failed = false, disposed = false, playing = !reduced.matches;
  let frame = 9, serial = 0;
  function report(message) {
    byId('demo-error').hidden = false;
    byId('demo-error').textContent = message;
  }
  function status() {
    byId('demo-play').disabled = !ready || reduced.matches;
    byId('demo-replay').disabled = !ready || reduced.matches;
    byId('demo-frame').disabled = !ready;
    byId('demo-sparks').disabled = !ready || reduced.matches;
    byId('demo-play').textContent = playing ? '静止コマへ' : 'APNGを再生';
    byId('frame-value').textContent = frame + ' / 17・' + stages[frame - 1];
    byId('demo-status').textContent = failed ? '新しい素材を読み込めません。元の素材・メニューには影響しません。'
      : !ready ? '連番を読み込み中です。'
      : reduced.matches ? '動きを減らす設定：静止コマを表示中。下のコマ選択で確認できます。'
      : document.hidden ? '背景タブではAPNGの表示を停止しています。'
      : playing ? '透過APNGを繰り返し再生中。画像の拡縮やうねりは追加していません。'
      : '静止コマを表示中。再生は点火から再開します。';
  }
  function syncSparks(run, restart) {
    const visible = run && byId('demo-sparks').value === 'on';
    sparkFields.forEach(field => {
      // SVGはHTMLElement.hiddenに頼らず属性を明示的に切り替える。
      if (visible) field.removeAttribute('hidden');
      else field.setAttribute('hidden', '');
      // 再点火時は粒子も先頭へ。未対応の場合もCSSの通常再生は維持する。
      if (visible && restart && typeof field.getAnimations === 'function') {
        field.getAnimations({ subtree: true }).forEach(animation => { animation.currentTime = 0; });
      }
    });
  }
  function render(restart = false) {
    still.forEach(image => { image.src = frames[frame - 1]; image.hidden = playing && !document.hidden; });
    const run = ready && playing && !reduced.matches && !document.hidden && !disposed;
    if (restart) serial++;
    animated.forEach(image => {
      image.hidden = !run;
      if (!run) image.removeAttribute('src');
      else if (restart || !image.hasAttribute('src')) image.src = source + '?preview=' + serial;
    });
    if (!run) still.forEach(image => { image.hidden = !ready; });
    syncSparks(run, restart);
    status();
  }
  function theme() {
    const karima = byId('demo-character').value === 'karima';
    // hue-rotateだけでは白い芯は白のままなので、青案は明度を青の階調へ写す。
    // APNG見本のみの比較用。既存モデルの作者色や素材ファイルは変更しない。
    const profile = byId('demo-karima-color').value;
    const filter = !karima && byId('demo-alche-color').value === 'gold' ? 'url("#alche-gold-flame")'
      : karima && profile === 'portrait' ? 'url("#karima-portrait-flame")'
      : karima && profile === 'blue' ? 'url("#karima-blue-flame")'
      : model.colorFilter(model.colorDefaults[karima ? 'karima' : 'alche']);
    root.style.setProperty('--flame-filter', filter);
    byId('demo-karima-color').disabled = !karima;
    byId('demo-alche-color').disabled = karima;
    root.style.setProperty('--spark-color', karima ? '#9ca6ef' : '#eed784');
    root.style.setProperty('--spark-core', karima ? '#d9e1ff' : '#fff6dc');
    root.style.setProperty('--face', karima ? '#e8edf1' : '#292e36');
    root.style.setProperty('--accent', karima ? '#4f86ae' : '#d6b45e');
    root.style.setProperty('--ink', karima ? '#333942' : '#eee9df');
    root.style.setProperty('--sample-bg', ({ gray: '#85878b', dark: '#30353a', light: '#ececeb' })[byId('demo-background').value]);
  }
  const placed = model.placement(model.defaults, 'bottom');
  root.querySelectorAll('.flame').forEach(image => {
    image.style.left = placed.left; image.style.top = placed.top;
    image.style.width = placed.size + 'px'; image.style.height = placed.size + 'px';
    image.style.opacity = String(placed.opacity);
  });
  sparkFields.forEach(field => { field.style.opacity = '1'; });
  const viewports = Array.from(root.querySelectorAll('.viewport'));
  function resize() {
    viewports.forEach(viewport => viewport.firstElementChild.style.setProperty('--demo-scale', viewport.getBoundingClientRect().width / 400));
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (observer) viewports.forEach(viewport => observer.observe(viewport));
  else window.addEventListener('resize', resize);
  ['demo-character', 'demo-background', 'demo-karima-color', 'demo-alche-color'].forEach(id => byId(id).addEventListener('change', theme));
  byId('demo-sparks').addEventListener('change', () => render());
  byId('demo-play').addEventListener('click', () => {
    if (!ready || reduced.matches) return;
    playing = !playing; render(playing);
  });
  byId('demo-replay').addEventListener('click', () => {
    if (!ready || reduced.matches) return;
    playing = true; render(true);
  });
  byId('demo-frame').addEventListener('input', () => {
    if (!ready) return;
    frame = Math.max(1, Math.min(17, Math.round(Number(byId('demo-frame').value) || 9)));
    playing = false; render();
  });
  function motionChange() { if (reduced.matches) playing = false; render(); }
  function visibilityChange() { render(); }
  reduced.addEventListener('change', motionChange);
  document.addEventListener('visibilitychange', visibilityChange);
  function load(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.naturalWidth ? resolve(image) : reject(new Error(src));
      image.onerror = () => reject(new Error(src));
      image.src = src;
    });
  }
  Promise.all([source, ...frames].map(load)).then(() => {
    if (disposed) return;
    ready = true; render(true);
  }).catch(() => {
    if (disposed) return;
    failed = true; playing = false;
    report('APNGまたは連番PNGを読み込めません。fx内の素材ファイルが揃っているか確認してください。');
    render();
  });
  animated.forEach(image => { image.onerror = () => {
    if (disposed) return;
    playing = false; report('APNGの再生画像を読み込めません。静止コマへ切り替えます。'); render();
  }; });
  const original = byId('original-flame');
  original.onerror = () => report('元の炎を読み込めません。新しいAPNGの操作はそのまま使えます。');
  if (original.complete && !original.naturalWidth) original.onerror();
  window.addEventListener('pagehide', () => {
    disposed = true;
    animated.forEach(image => { image.hidden = true; image.removeAttribute('src'); });
    sparkFields.forEach(field => { field.setAttribute('hidden', ''); });
    if (observer) observer.disconnect();
    else window.removeEventListener('resize', resize);
    reduced.removeEventListener('change', motionChange);
    document.removeEventListener('visibilitychange', visibilityChange);
  }, { once: true });
  theme(); resize(); status();
})();
