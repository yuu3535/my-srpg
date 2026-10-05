/* 全体試作の表示だけを管理。本編APIへは接続しない。 */
(function (root) {
  'use strict';
  function mount(doc, win, model, time) {
    const byId = id => doc.getElementById(id);
    const screen = byId('menu-screen'), wheel = byId('menu-wheel');
    const character = byId('menu-character'), phase = byId('menu-phase'), effects = byId('menu-effects');
    const showFrame = byId('menu-show-frame'), deviceFrame = byId('menu-device-frame');
    const media = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const disposers = [];
    let destroyed = false, wheelSelected = 'items', wheelLoading = true, wheelInitialized = false;
    const failures = new Map();
    function listen(node, type, handler) {
      node.addEventListener(type, handler);
      disposers.push(() => node.removeEventListener(type, handler));
    }
    function warning(key, message) {
      if (message) failures.set(key, message); else failures.delete(key);
      byId('menu-warning').hidden = failures.size === 0;
      byId('menu-warning').textContent = Array.from(failures.values()).join(' ');
    }
    function fit() {
      const viewport = byId('menu-viewport');
      const width = viewport.getBoundingClientRect ? viewport.getBoundingClientRect().width : viewport.clientWidth;
      screen.style.setProperty('--scene-scale', model.scaleFor(width));
    }
    function setFrame() {
      byId('menu-device').dataset.frame = String(showFrame.checked && !showFrame.disabled);
      deviceFrame.hidden = byId('menu-device').dataset.frame !== 'true';
      fit();
    }
    function configureWheel(select) {
      if (wheel.contentWindow) wheel.contentWindow.postMessage({ type: 'solar-menu-config', character: character.value,
        effects: effects.checked && !(media && media.matches) && !doc.hidden, ...(select ? { select } : {}) }, '*');
    }
    function syncMotion() {
      screen.dataset.reduced = String(Boolean(media && media.matches) || !effects.checked);
      screen.style.setProperty('--motion', doc.hidden ? 'paused' : 'running');
      byId('menu-replay-time').disabled = screen.dataset.reduced === 'true';
      configureWheel();
    }
    function drawTime() {
      if (!time.validPhase(phase.value)) phase.value = 'evening';
      byId('menu-time').innerHTML = time.icon(phase.value, 'menu-time');
      byId('menu-time').setAttribute('aria-label', '時間帯：' + time.phases[phase.value].label);
      syncMotion();
    }
    function setBackground() {
      const background = byId('menu-background').value;
      screen.dataset.background = ['corridor', 'gray', 'light'].includes(background) ? background : 'corridor';
      byId('menu-background-image').hidden = screen.dataset.background !== 'corridor';
    }
    function status() {
      byId('menu-status').textContent = wheelLoading ? '太陽盤を読み込んでいます。右側の配置は確認できます。' : '配置試作：コマンド選択・時間帯切り替え・マップ入口を確認できます。本編には未接続です。';
    }
    listen(wheel, 'load', () => {
      // 初回の未選択通知はiframeのloadより先に届くことがある。
      configureWheel(wheelInitialized ? wheelSelected : 'items');
      wheelInitialized = true;
    });
    listen(win, 'message', event => {
      if (event.source !== wheel.contentWindow || !event.data || event.data.type !== 'solar-menu-state') return;
      const state = event.data;
      if (state.selected !== null && !Object.hasOwn(model.descriptions, state.selected)) return;
      wheelSelected = state.selected;
      byId('menu-tip').textContent = model.description(state.selected);
      wheelLoading = Boolean(state.loading);
      byId('wheel-loading').hidden = !wheelLoading;
      warning('wheel', state.failed ? '太陽盤を読み込めません。単体ページと隣の試作03素材を確認してください。' : '');
      status();
    });
    listen(character, 'change', () => configureWheel());
    listen(phase, 'change', drawTime);
    listen(effects, 'change', syncMotion);
    listen(byId('menu-replay-time'), 'click', drawTime);
    listen(byId('menu-background'), 'change', setBackground);
    listen(showFrame, 'change', setFrame);
    function frameError() {
      showFrame.checked = false; showFrame.disabled = true; setFrame();
      warning('device-frame', '端末フレームを読み込めません。枠なし表示へ戻しました。横向きフレーム素材.pngを確認してください。');
    }
    listen(deviceFrame, 'error', frameError);
    listen(deviceFrame, 'load', () => { showFrame.disabled = false; warning('device-frame', ''); setFrame(); });
    listen(doc, 'visibilitychange', syncMotion);
    if (media && media.addEventListener) listen(media, 'change', syncMotion);
    const backgroundImage = byId('menu-background-image');
    listen(backgroundImage, 'error', () => warning('background', '背景を読み込めません。確認背景を無地へ切り替えてください。'));
    listen(backgroundImage, 'load', () => warning('background', ''));
    // CSSクロップで使う参照絵・時間帯アトラス・運命予報の素材も個別に検査する。
    const probes = [
      ['map', 'time-of-day-art/selected-reference-v01.png', 'マップの参考絵を読み込めません。'],
      ['time', time.art.src, '時間帯の素材を読み込めません。'],
      ['fortune-frame', '../運命予報_分離素材01/fortune-frame-silver-v01.png', '運命予報の枠を読み込めません。'],
      ['fortune-star', '../運命予報_分離素材01/fortune-star-watermark-v01.png', '運命予報の星を読み込めません。'],
      ['fortune-beta', '../運命予報_分離素材01/fortune-beta-sticker-v01.png', 'β版シールを読み込めません。']
    ].map(([key, src, message]) => {
      const image = doc.createElement('img');
      listen(image, 'error', () => warning(key, message));
      listen(image, 'load', () => warning(key, ''));
      image.src = src;
      return image;
    });
    const dialog = byId('map-dialog');
    listen(byId('map-open'), 'click', () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else { dialog.setAttribute('open', ''); warning('dialog', 'このブラウザでは簡易表示です。「閉じる」で戻れます。'); }
    });
    listen(doc.querySelector('.dialog-close'), 'click', event => {
      if (typeof dialog.close !== 'function') { event.preventDefault(); dialog.removeAttribute('open'); }
    });
    Array.from(doc.querySelectorAll('[data-map-mode]')).forEach(button => listen(button, 'click', () => {
      const mode = button.dataset.mapMode;
      if (!Object.hasOwn(model.mapModes, mode)) return;
      byId('map-mode-note').textContent = model.mapModes[mode] + 'の入口を選択しました。実際の画面への接続は次の段階です。';
      doc.querySelectorAll('[data-map-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    }));
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(fit); observer.observe(byId('menu-viewport'));
      disposers.push(() => observer.disconnect());
    } else listen(win, 'resize', fit);
    function destroy() {
      if (destroyed) return;
      destroyed = true; screen.style.setProperty('--motion', 'paused');
      disposers.splice(0).forEach(dispose => dispose());
      probes.forEach(image => image.removeAttribute('src'));
    }
    listen(win, 'pagehide', event => {
      if (event.persisted) { screen.style.setProperty('--motion', 'paused'); configureWheel(); }
      else destroy();
    });
    listen(win, 'pageshow', () => { fit(); syncMotion(); });
    drawTime(); setFrame(); setBackground(); status();
    if (deviceFrame.complete && deviceFrame.naturalWidth === 0) frameError();
    return { destroy, drawTime, fit };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { mount };
  else mount(document, root, root.SolarMenuPreview, root.TimeOfDay);
})(typeof globalThis !== 'undefined' ? globalThis : this);
