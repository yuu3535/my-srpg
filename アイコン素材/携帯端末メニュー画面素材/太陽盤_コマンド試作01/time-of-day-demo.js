/* 時間帯だけの独立見本。本編やコマンド輪の状態は変更しない。 */
(function (root) {
  'use strict';
  function mount(doc, win, model) {
    const byId = (id) => doc.getElementById(id);
    const scene = byId('scene');
    const buttons = Array.from(doc.querySelectorAll('[data-phase-button]'));
    const replay = byId('replay'), pause = byId('pause');
    const placed = byId('placed-icon'), large = byId('large-icon');
    const background = byId('background'), image = byId('scene-background');
    const atlas = byId('icon-atlas-preload');
    const media = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const disposers = [];
    let state = model.createState(), destroyed = false;
    function listen(target, name, handler) {
      target.addEventListener(name, handler);
      disposers.push(() => target.removeEventListener(name, handler));
    }
    function draw() {
      // 差し替える二つの素材レイヤーだけ再始動。常時タイマーは持たない。
      placed.innerHTML = model.icon(state.phase, 'placed');
      large.innerHTML = model.icon(state.phase, 'large');
      placed.setAttribute('aria-label', model.phases[state.phase].label);
    }
    function sync() {
      scene.dataset.reduced = String(state.reduced);
      scene.style.setProperty('--motion', model.playback(state));
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.phaseButton === state.phase)));
      pause.setAttribute('aria-pressed', String(state.paused));
      pause.textContent = state.paused ? '再開' : '一時停止';
      pause.disabled = state.reduced;
      replay.disabled = state.reduced;
      const suffix = state.reduced ? ' 端末の動き低減設定に合わせ、静止表示中です。' : state.paused ? ' 一時停止中です。' : '';
      byId('status').textContent = model.phases[state.phase].label + '：' + model.phases[state.phase].description + suffix;
    }
    function dispatch(action) {
      if (destroyed) return;
      const previous = state;
      state = model.change(state, action);
      if (state.replay !== previous.replay) draw();
      sync();
    }
    function fit() {
      const width = byId('preview').clientWidth;
      if (width > 0) scene.style.setProperty('--scene-scale', String(width / 844));
    }
    function setBackground() {
      const value = ['corridor', 'gray', 'light'].includes(background.value) ? background.value : 'gray';
      scene.dataset.background = value;
      image.hidden = value !== 'corridor';
      byId('background-warning').hidden = value !== 'corridor' || !(image.complete && image.naturalWidth === 0);
    }
    buttons.forEach((button) => listen(button, 'click', () => dispatch({ type: 'phase', value: button.dataset.phaseButton })));
    listen(replay, 'click', () => dispatch({ type: 'replay' }));
    listen(pause, 'click', () => dispatch({ type: 'pause' }));
    listen(background, 'change', setBackground);
    listen(image, 'error', () => { byId('background-warning').hidden = background.value !== 'corridor'; });
    listen(image, 'load', () => { byId('background-warning').hidden = true; });
    function artworkStatus() {
      byId('art-loading').hidden = atlas.complete;
      byId('art-warning').hidden = !atlas.complete || atlas.naturalWidth > 0;
    }
    listen(atlas, 'load', () => {
      artworkStatus();
      // 遅い初回読み込みでも、素材が見える前に日の出が終わらないよう再始動。
      draw(); sync();
    });
    listen(atlas, 'error', () => { byId('art-loading').hidden = true; byId('art-warning').hidden = false; });
    listen(doc, 'visibilitychange', () => dispatch({ type: 'visibility', value: doc.hidden }));
    // BFCacheへ入る場合は停止だけ。戻ったときにDOMと監視を再利用する。
    listen(win, 'pagehide', (event) => {
      if (event.persisted) dispatch({ type: 'visibility', value: true });
      else destroy();
    });
    listen(win, 'pageshow', () => { fit(); dispatch({ type: 'visibility', value: doc.hidden }); });
    if (media) {
      const changed = () => dispatch({ type: 'reduce', value: media.matches });
      if (media.addEventListener) listen(media, 'change', changed);
      else if (media.addListener) {
        media.addListener(changed);
        disposers.push(() => media.removeListener(changed));
      }
      state = model.change(state, { type: 'reduce', value: media.matches });
    }
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(fit);
      observer.observe(byId('preview'));
      disposers.push(() => observer.disconnect());
    } else listen(win, 'resize', fit);
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.style.setProperty('--motion', 'paused');
      disposers.splice(0).forEach((dispose) => dispose());
    }
    state = model.change(state, { type: 'visibility', value: doc.hidden });
    byId('still-grid').innerHTML = Object.keys(model.phases).map((phase) =>
      `<section class="still-example"><div class="icon-slot">${model.icon(phase, 'still-' + phase)}</div><p>${model.phases[phase].label}・静止形</p></section>`
    ).join('');
    draw(); sync(); fit(); setBackground(); artworkStatus();
    return { dispatch, destroy, getState: () => ({ ...state }) };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { mount };
  else if (root.TimeOfDay) mount(document, root, root.TimeOfDay);
  else document.getElementById('script-warning').hidden = false;
})(typeof globalThis !== 'undefined' ? globalThis : this);
