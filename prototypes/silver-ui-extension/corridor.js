(function (root) {
  'use strict';
  function create(stage, onFailure) {
    const model = root.CorridorStudy;
    const host = document.getElementById('corridor-scene');
    const canvas = document.getElementById('corridor-canvas');
    const ctx = canvas.getContext('2d');
    const modeButton = document.getElementById('corridor-mode');
    const slider = document.getElementById('corridor-position');
    const cameraChoice = document.getElementById('corridor-lift');
    const output = document.getElementById('corridor-position-value');
    const params = new URLSearchParams(location.search);
    const artBase = '../../unity-prototype/Assets/Art/Corridor/';
    let data, images, hero, enabled = false, loadPromise;
    let playerX = 422, direction = 0, keyboardDirection = 0, frame = 0, lastTime = 0, walkTime = 0;
    let conversation = params.get('mode') !== 'explore';
    let height = 117;
    if (params.get('lift') === 'off') cameraChoice.checked = false;

    function image(url) {
      const img = new Image();
      img.src = url;
      return img.decode().then(() => img);
    }
    async function load() {
      if (!ctx) throw new Error('背景を表示できません。このブラウザではCanvasが使えません。');
      // 別担当が編集中のUnityデータをUI比較へ即時反映しない。直前の見本の5層を固定する。
      const response = await fetch('corridor-reference-20261003.json');
      if (!response.ok) throw new Error('回廊の層の設定を読み込めませんでした。');
      data = await response.json();
      if (!Array.isArray(data.layers) || !data.layers.length || !(data.length >= 844)) throw new Error('回廊の層の設定が不正です。');
      const entries = await Promise.all(data.layers.map(async layer => [layer.file, await image(artBase + encodeURIComponent(layer.file))]));
      images = new Map(entries);
      hero = await image('../../unity-prototype/Assets/Art/SD/young_arshe.png');
      slider.max = data.length - 40;
      const chosen = Number(params.get('position'));
      if (params.has('position') && Number.isFinite(chosen)) playerX = model.position(data, chosen).player;
      syncPosition();
    }
    function syncPosition() {
      slider.value = Math.round(playerX);
      output.value = `${Math.round(playerX)} / ${data.length}`;
    }
    function mode(next) {
      conversation = next;
      direction = keyboardDirection = 0;
      stage.dataset.corridorMode = conversation ? 'dialogue' : 'explore';
      modeButton.textContent = conversation ? '探索へ戻る' : '会話を試す';
      modeButton.setAttribute('aria-pressed', String(conversation));
      document.getElementById('corridor-help').textContent = conversation
        ? stage.dataset.presentation === 'portraits'
          ? '会話中は歩行を停止。立ち絵と台詞はUIの層で、背景は元の位置のままです。'
          : '会話中は歩行を停止。場面の位置と「人物を見せる」を変えて見比べられます。'
        : '画面左右を押している間、またはキーボードの左右矢印で移動します。';
      render();
      stage.dispatchEvent(new Event('corridor-mode-change'));
    }
    function render() {
      if (!data || !hero || !enabled) return;
      const pos = model.position(data, playerX);
      const lift = conversation && stage.dataset.presentation !== 'portraits' && cameraChoice.checked ? model.dialogueLift(data, height) : 0;
      ctx.clearRect(0, 0, 844, 390);
      ctx.fillStyle = '#080a0f';
      ctx.fillRect(0, 0, 844, 390);
      ctx.save();
      ctx.translate(0, -lift);
      for (const layer of data.layers) {
        const img = images.get(layer.file);
        if (layer.kind === 'floor') {
          const h = Math.max(1, layer.bottom - layer.top);
          const rows = Math.max(1, Math.round(layer.rows));
          const tileW = Math.max(8, layer.tile);
          const shift = layer.x - pos.camera * layer.speed;
          let start = shift % tileW;
          if (start > 0) start -= tileW;
          for (let row = 0; row < rows; row++) {
            for (let x = start; x < 844; x += tileW) ctx.drawImage(img, x, layer.top + row * h / rows, tileW, h / rows + 0.5);
          }
          // UnityのShadeTextureと同じ、奥を暗くする32段の薄い影。絵の色替えはしない。
          for (let y = 0; y < 32; y++) {
            ctx.fillStyle = `rgba(10,14,22,${layer.shade * (31 - y) / 31})`;
            ctx.fillRect(0, layer.top + y * h / 32, 844, h / 32 + 0.5);
          }
          continue;
        }
        const width = img.naturalWidth * layer.height / img.naturalHeight;
        ctx.globalAlpha = layer.opacity ?? 1;
        for (const tile of model.tiles(layer, pos.camera, width)) {
          if (tile.x + width < 0 || tile.x > 844) continue;
          ctx.save();
          ctx.translate(tile.x + (tile.mirrored ? width : 0), layer.bottom - layer.height);
          if (tile.mirrored) ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, width, layer.height);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      const heroW = data.heroHeight * hero.naturalWidth / hero.naturalHeight;
      const bob = walkTime > 0 ? Math.abs(Math.sin(walkTime * 9)) * 3 : 0;
      ctx.translate(pos.heroX, data.heroFeetY - data.heroHeight - bob);
      if (stage.dataset.facing === 'left') ctx.scale(-1, 1);
      ctx.drawImage(hero, -heroW / 2, 0, heroW, data.heroHeight);
      ctx.restore();
    }
    function stop() {
      direction = keyboardDirection = 0;
      lastTime = walkTime = 0;
      cancelAnimationFrame(frame);
      frame = 0;
      render();
    }
    function tick(time) {
      frame = 0;
      const dir = keyboardDirection || direction;
      if (!enabled || conversation || !dir || document.hidden) { stop(); return; }
      const seconds = lastTime ? (time - lastTime) / 1000 : 0;
      lastTime = time;
      playerX = model.walk(data, playerX, dir, seconds).player;
      walkTime += Math.min(seconds, 0.1);
      stage.dataset.facing = dir < 0 ? 'left' : 'right';
      render(); syncPosition();
      frame = requestAnimationFrame(tick);
    }
    function start() { if (!frame && enabled && !conversation && hero) frame = requestAnimationFrame(tick); }
    document.querySelectorAll('[data-walk]').forEach(button => {
      button.addEventListener('pointerdown', event => {
        if (!enabled || conversation || !hero || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        direction = Number(button.dataset.walk); start();
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, stop));
    });
    document.addEventListener('keydown', event => {
      if (!enabled || conversation || !hero || !['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(event.key)) return;
      if (event.target.closest('input,textarea,select,[contenteditable],.tuning,.controls')) return;
      event.preventDefault();
      keyboardDirection = ['ArrowLeft', 'a'].includes(event.key) ? -1 : 1;
      start();
    });
    document.addEventListener('keyup', event => {
      if (!['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(event.key)) return;
      // 描画フレームより短いキー入力でも、一歩の反応を返す。
      if (keyboardDirection && walkTime === 0 && enabled && !conversation && hero) {
        playerX = model.walk(data, playerX, keyboardDirection, 1 / 60).player;
        stage.dataset.facing = keyboardDirection < 0 ? 'left' : 'right';
        syncPosition();
      }
      stop();
    });
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('pagehide', stop);
    modeButton.addEventListener('click', () => { mode(!conversation); stop(); });
    slider.addEventListener('input', () => { if (!data) return; stop(); playerX = model.position(data, Number(slider.value)).player; syncPosition(); render(); });
    document.querySelectorAll('[data-corridor-place]').forEach(button => button.addEventListener('click', () => {
      if (!data) return;
      stop();
      playerX = model.position(data, ({ left: 422, middle: data.length / 2, right: data.length - 422 })[button.dataset.corridorPlace]).player;
      syncPosition(); render();
    }));
    cameraChoice.addEventListener('change', render);
    mode(conversation);
    return {
      async activate() {
        enabled = true; host.hidden = false;
        if (!loadPromise) loadPromise = load().catch(error => { loadPromise = null; onFailure(error); throw error; });
        await loadPromise;
        if (enabled) { mode(conversation); render(); }
      },
      deactivate() { enabled = false; host.hidden = true; stop(); },
      setHeight(value) { height = value; render(); }
    };
  }
  root.DialogueCorridor = { create };
})(window);
