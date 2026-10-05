/* 共通身体の静止フィッティング。攻撃モーションや部位リグは含めない。 */
(function () {
  'use strict';
  const core = SharedBodyFit;
  const $ = id => document.getElementById(id);
  const keys = Object.keys(core.heads), images = {}, silhouettes = {};
  const profiles = Object.fromEntries(Object.keys(core.bodies).map(body => [body, Object.fromEntries(keys.map(key => [key, core.defaults()]))]));
  const referenceProfiles = Object.fromEntries(Object.keys(core.bodies).map(body => [body, Object.fromEntries(keys.map(key => [key, core.defaults()]))]));
  const weaponSettings = Object.fromEntries(Object.entries(core.bodies).map(([key, body]) => [key, body.weaponReady !== false]));
  let bodyKey = 'providedChild', ready = false, dark = false;
  const current = () => profiles[bodyKey][$('character').value];
  const currentReference = () => referenceProfiles[bodyKey][$('character').value];
  function sync() {
    const a = current();
    $('head-scale').value = a.scale; $('head-x').value = a.x; $('head-y').value = a.y;
    $('scale-value').value = `${Math.round(a.scale * 100)}%`; $('x-value').value = `${a.x}px`; $('y-value').value = `${a.y}px`;
    $('body-title').textContent = core.bodies[bodyKey].label;
    const weaponReady = core.bodies[bodyKey].weaponReady !== false;
    $('weapon').checked = weaponSettings[bodyKey]; $('weapon').disabled = !weaponReady;
    $('weapon-note').hidden = weaponReady;
    const reference = currentReference(), label = core.heads[$('character').value].label;
    $('reference-scale').value = reference.scale; $('reference-x').value = reference.x; $('reference-y').value = reference.y;
    $('reference-scale-value').value = `${Math.round(reference.scale * 100)}%`;
    $('reference-x-value').value = `${reference.x}px`; $('reference-y-value').value = `${reference.y}px`;
    $('opacity-value').value = `${$('reference-opacity').value}%`;
    $('reference-character').textContent = label;
    $('fitting-label').textContent = `${label} / ${$('overlay').checked ? '合成＋元SD' : '合成のみ'}`;
    document.querySelectorAll('[data-body]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.body === bodyKey)));
    document.querySelectorAll('.names span').forEach((label, i) => label.classList.toggle('selected', keys[i] === $('character').value));
    draw();
  }
  function imageLayer(ctx, file, layer) {
    ctx.save(); ctx.translate(...layer.position); ctx.scale(layer.scale, layer.scale); ctx.drawImage(images[file], 0, 0); ctx.restore();
  }
  function character(ctx, key, foot, zoom) {
    const fit = core.fit(bodyKey, key, profiles[bodyKey][key], foot, zoom);
    ctx.save();
    if ($('mirror').checked) { ctx.translate(foot[0] * 2, 0); ctx.scale(-1, 1); }
    if ($('weapon').checked && core.bodies[bodyKey].weaponReady !== false) {
      // 剣の柄は身体の手の後ろへ。静止合成のみで前後切替はまだしない。
      ctx.save(); ctx.translate(...fit.sword.position); ctx.rotate(fit.sword.angle); ctx.scale(fit.sword.scale, fit.sword.scale); ctx.drawImage(images[core.sword.file], -core.sword.join[0], -core.sword.join[1]); ctx.restore();
    }
    imageLayer(ctx, core.bodies[bodyKey].file, fit.body);
    imageLayer(ctx, core.heads[key].file, fit.head);
    if ($('guides').checked) {
      ctx.strokeStyle = dark ? '#c3e4d4' : '#37635a'; ctx.lineWidth = 1;
      const points = core.bodies[bodyKey].weaponReady === false ? [fit.neck] : [fit.neck, fit.grip];
      for (const point of points) { ctx.beginPath(); ctx.arc(...point, 4 * zoom, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(point[0] - 8 * zoom, point[1]); ctx.lineTo(point[0] + 8 * zoom, point[1]); ctx.stroke(); }
    }
    ctx.restore();
  }
  function reference(ctx, key, foot, adjustment, overlay) {
    const fit = core.referenceFit(bodyKey, key, adjustment, foot);
    const asset = core.originals[key];
    ctx.save();
    // 左右移動は画面方向に一定。反転は移動後の足元を軸にする。
    if ($('mirror').checked) { ctx.translate((foot[0] + adjustment.x) * 2, 0); ctx.scale(-1, 1); }
    ctx.globalAlpha = overlay ? Number($('reference-opacity').value) / 100 : 1;
    ctx.translate(...fit.position); ctx.scale(fit.scale, fit.scale);
    ctx.drawImage(overlay && $('silhouette').checked ? silhouettes[key] : images[asset.file], 0, 0);
    ctx.restore();
  }
  function drawFitting() {
    const canvas = $('fitting'), ctx = canvas.getContext('2d'), key = $('character').value;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = dark ? '#60776a' : '#c5d3cb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(32, 460.5); ctx.lineTo(808, 460.5); ctx.moveTo(420.5, 25); ctx.lineTo(420.5, 495); ctx.stroke();
    character(ctx, key, [210, 460], 1);
    if ($('overlay').checked) reference(ctx, key, [210, 460], currentReference(), true);
    reference(ctx, key, [630, 460], { ...currentReference(), x: 0, y: 0 }, false);
  }
  function draw() {
    if (!ready) return;
    drawFitting();
    const canvas = $('comparison'), ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = dark ? '#60776a' : '#c5d3cb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(36, 370.5); ctx.lineTo(804, 370.5); ctx.stroke();
    keys.forEach((key, i) => character(ctx, key, [140 + i * 280, 370], 1));
    const mini = $('mini'), mc = mini.getContext('2d'); mc.clearRect(0, 0, mini.width, mini.height);
    // 初期合成を全高約70pxにする固定ズーム。頭調整による大きさの差は残す。
    keys.forEach((key, i) => character(mc, key, [52 + i * 125, 85], 70 / core.characterHeight(bodyKey, key)));
  }
  function loadImage(file, size) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth !== size[0] || img.naturalHeight !== size[1]) { reject(new Error(`素材の寸法が異なります: ${file}`)); return; }
        images[file] = img; resolve();
      };
      img.onerror = () => reject(new Error(`素材を読み込めません: ${file}`)); img.src = `assets/${file}`;
    });
  }
  async function load() {
    ready = false; $('controls').disabled = true; $('background').disabled = true;
    document.querySelector('.preview').classList.remove('ready'); $('loading').hidden = false; $('error').hidden = true;
    $('status').textContent = '素材の読み込み中';
    try {
      await Promise.all([...Object.values(core.bodies), ...Object.values(core.heads), core.sword, ...Object.values(core.originals)].map(asset => loadImage(asset.file, asset.size)));
      for (const key of keys) {
        const asset = core.originals[key], canvas = document.createElement('canvas');
        canvas.width = asset.size[0]; canvas.height = asset.size[1];
        const ctx = canvas.getContext('2d'); ctx.drawImage(images[asset.file], 0, 0);
        ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#527d6b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        silhouettes[key] = canvas;
      }
      ready = true; $('controls').disabled = false; $('background').disabled = false;
      $('loading').hidden = true; document.querySelector('.preview').classList.add('ready'); sync();
      $('status').textContent = '静止フィッティング · 攻撃連番は未生成';
    } catch (error) {
      $('loading').hidden = true; $('error').hidden = false; $('error').querySelector('p').textContent = error.message;
      $('status').textContent = '読み込みエラー · 再試行できます';
    }
  }
  document.querySelectorAll('[data-body]').forEach(button => button.addEventListener('click', () => { bodyKey = button.dataset.body; sync(); }));
  $('character').addEventListener('change', sync);
  for (const [id, field] of [['head-scale','scale'], ['head-x','x'], ['head-y','y']]) $(id).addEventListener('input', () => { current()[field] = Number($(id).value); sync(); });
  for (const [id, field] of [['reference-scale','scale'], ['reference-x','x'], ['reference-y','y']]) $(id).addEventListener('input', () => { currentReference()[field] = Number($(id).value); sync(); });
  $('reference-opacity').addEventListener('input', sync);
  ['overlay','silhouette'].forEach(id => $(id).addEventListener('change', sync));
  $('reference-reset').addEventListener('click', () => { referenceProfiles[bodyKey][$('character').value] = core.defaults(); sync(); });
  $('reset').addEventListener('click', () => { profiles[bodyKey][$('character').value] = core.defaults(); sync(); });
  $('weapon').addEventListener('change', () => { weaponSettings[bodyKey] = $('weapon').checked; draw(); });
  ['guides','mirror'].forEach(id => $(id).addEventListener('change', draw));
  $('background').addEventListener('click', () => { dark = !dark; document.querySelectorAll('.stage').forEach(stage => stage.classList.toggle('dark', dark)); $('background').textContent = dark ? '背景を淡色に' : '背景を濃色に'; draw(); });
  $('retry').addEventListener('click', load);
  $('save').addEventListener('click', () => {
    const data = { version: 2, state: '試作対象', pose: '静止構え', bodies: core.bodies, heads: core.heads, adjustments: profiles, referenceAdjustments: referenceProfiles, referenceView: { overlay: $('overlay').checked, silhouette: $('silhouette').checked, opacity: Number($('reference-opacity').value) / 100 } };
    const serialized = JSON.stringify(data, null, 2);
    $('export-json').value = serialized; $('export-panel').hidden = false; $('export-panel').open = true;
    const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'shared-body-fitting.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); $('status').textContent = 'JSONを書き出しました · ダウンロードできない場合は下欄からコピーできます';
  });
  load();
})();
