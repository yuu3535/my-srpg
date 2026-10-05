/* 共通身体の静止フィッティング。攻撃モーションや部位リグは含めない。 */
(function () {
  'use strict';
  const core = SharedBodyFit;
  const pixels = SharedBodyPixels;
  const presets = SharedBodyPresets;
  const $ = id => document.getElementById(id);
  const keys = Object.keys(core.heads), images = {}, silhouettes = {}, seamImages = {};
  const profiles = Object.fromEntries(Object.keys(core.bodies).map(body => [body, Object.fromEntries(keys.map(key => [key, core.defaults()]))]));
  const referenceProfiles = Object.fromEntries(Object.keys(core.bodies).map(body => [body, Object.fromEntries(keys.map(key => [key, core.defaults()]))]));
  const weaponSettings = Object.fromEntries(Object.entries(core.bodies).map(([key, body]) => [key, body.weaponReady !== false]));
  const palettes = Object.fromEntries(Object.keys(core.extractedHeads).map(key => [key, pixels.paletteDefaults()]));
  const paletteCache = new Map();
  let paletteSource, paletteLabels, paletteKeep, lastPngUrl;
  let bodyKey = 'lineA1', ready = false, dark = false;
  let library = presets.empty(), storageDamaged = false;
  const current = () => profiles[bodyKey][$('character').value];
  const currentReference = () => referenceProfiles[bodyKey][$('character').value];
  function sync() {
    const available = core.headKeys(bodyKey), extracted = !!core.bodies[bodyKey].extracted;
    if (!available.includes($('character').value)) $('character').value = available[0];
    $('gunter-option').disabled = extracted;
    $('seam').disabled = !extracted;
    $('outfits-panel').hidden = !extracted;
    $('match-outfits').hidden = !extracted;
    document.querySelector('.preview').classList.toggle('outfit-mode', extracted);
    $('head-source').textContent = extracted ? '元SDから切り出した頭部。髪・色・顔を再生成していません。' : '旧比較：参照ベースの生成頭。元SDと細部が異なります。';
    $('characters-summary').textContent = extracted ? '2人を同じ衣装で比較' : '旧試作の3人を比較';
    for (const key of ['arshe', 'karima']) $('source-' + key).src = `assets/${core.originalAsset(bodyKey, key).file}`;
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
    document.querySelectorAll('.names span').forEach((label, i) => { label.hidden = !available.includes(keys[i]); label.classList.toggle('selected', keys[i] === $('character').value); });
    core.outfitKeys.forEach(key => $('caption-' + key).classList.toggle('selected', key === bodyKey));
    syncPalette();
    syncRecordControls();
    draw();
  }
  function syncRecordControls() {
    const template=presets.templates[bodyKey], character=$('character').value;
    const supported=ready && template?.classId===$('class-id').value && !!presets.characters[character];
    $('record-save').disabled=!supported;
    $('record-context').textContent=supported ? `${core.heads[character].label} / ${template.classId} / 子供 / ${bodyKey.replace('line','')}` : 'この組み合わせは記録対象外です。元頭部＋登録済み兵種衣装を選んでください。';
    $('record-load').disabled=!ready || !library.records.length;
  }
  function refreshRecords() {
    const previous=$('record-list').value;
    const records=[...library.records].sort((a,b)=>b.savedAt.localeCompare(a.savedAt) || b.revision-a.revision);
    const latestByKey=new Map();
    for (const record of records) if ((latestByKey.get(presets.key(record))?.revision || 0)<record.revision) latestByKey.set(presets.key(record),record);
    const options=records.map(record=>{
      const option=document.createElement('option'); option.value=record.id;
      const char=Object.keys(presets.characters).find(key=>presets.characters[key]===record.characterId);
      const newest=latestByKey.get(presets.key(record)).id===record.id;
      option.textContent=`${core.heads[char].label} / ${record.classId} / 子供 / ${record.appearance.templateId.replace('line','')} / 履歴${record.revision}${newest ? '（最新）' : ''} — ${record.name}`;
      return option;
    });
    if (!options.length) { const option=document.createElement('option');option.value='';option.textContent='記録なし';options.push(option); }
    $('record-list').replaceChildren(...options);
    $('record-list').value=records.some(r=>r.id===previous) ? previous : records[0]?.id || '';
    const count=new Set(records.map(presets.key)).size;
    $('record-count').textContent=records.length ? `${count}組の外見 / 履歴${records.length}件。保存済み記録を選んで呼び出せます。` : 'まだ記録がありません。左の記録ボタンで、現在の衣装・配色・頭合わせを保存してください。';
    syncRecordControls();
  }
  function diskLibrary() {
    const raw=localStorage.getItem(presets.STORAGE_KEY);
    if (!raw) return presets.empty();
    try { return presets.validateLibrary(JSON.parse(raw)); }
    catch {
      storageDamaged=true; $('storage-recovery').hidden=false; $('storage-recovery-text').value=raw;
      throw new Error('既存保存が読み取れません。元の内容は上書きしません');
    }
  }
  function recordMessage(id,message,error=false) {
    $(id).textContent=message; $(id).classList.toggle('problem',error);
  }
  function persistLibrary(candidate,messageId,success) {
    library=candidate;
    try {
      if (storageDamaged) throw new Error('元の保存内容を保全しています');
      library=presets.merge(diskLibrary(),library);
      localStorage.setItem(presets.STORAGE_KEY,JSON.stringify(library));
      recordMessage(messageId,success);
    } catch(error) {
      recordMessage(messageId,`${error.message}。記録はこのタブのみです。記録一覧JSONをバックアップしてください。`,true);
    }
    refreshRecords();
  }
  function identity() { return {id:crypto.randomUUID(),savedAt:new Date().toISOString()}; }
  function currentView() { return {overlay:$('overlay').checked,silhouette:$('silhouette').checked,opacity:Number($('reference-opacity').value)/100,mirror:$('mirror').checked,guides:$('guides').checked}; }
  function captureRecord() {
    const char=$('character').value;
    return {...identity(),revision:1,characterId:presets.characters[char],classId:$('class-id').value,bodyType:'child',name:$('record-name').value.trim() || `${core.heads[char].label} / ${$('class-id').value}`,
      appearance:{templateId:bodyKey,head:{...current()},palette:bodyKey==='lineA1' ? presets.copy(palettes[char]) : null,seam:$('seam').checked},
      editor:{reference:{...currentReference()},view:currentView()}};
  }
  function applyView(view,seam) {
    for (const name of ['overlay','silhouette','mirror','guides']) $(name).checked=view[name];
    $('reference-opacity').value=view.opacity*100; $('seam').checked=seam;
    $('mask-view').checked=false;
  }
  function applyRecord(record) {
    const char=Object.keys(presets.characters).find(key=>presets.characters[key]===record.characterId);
    bodyKey=record.appearance.templateId; $('character').value=char; $('class-id').value=record.classId;
    profiles[bodyKey][char]={...record.appearance.head}; referenceProfiles[bodyKey][char]={...record.editor.reference};
    if (record.appearance.palette) palettes[char]=presets.copy(record.appearance.palette);
    $('record-name').value=record.name; applyView(record.editor.view,record.appearance.seam); sync();
  }
  function applyWorkspace(workspace) {
    Object.assign(profiles,workspace.adjustments);Object.assign(referenceProfiles,workspace.references);Object.assign(palettes,workspace.palettes);
    bodyKey=workspace.selectedBody; $('character').value=workspace.selectedCharacter; $('class-id').value=presets.templates[bodyKey].classId;
    $('record-name').value='';applyView(workspace.view,workspace.seam);sync();
  }
  function importRecords(text) {
    if (!ready) return;
    try {
      const imported=presets.parse(text,identity()), workspace=presets.workspace(JSON.parse(text));
      const candidate=presets.merge(library,imported); // 全件検証が済むまで保存や調整を変えない。
      persistLibrary(candidate,'record-import-message',`読込済み：記録${imported.records.length}件${workspace ? '＋作業調整を復元' : '。一覧から呼び出してください'}`);
      if (workspace) applyWorkspace(workspace);
    } catch(error) { recordMessage('record-import-message',`読み込めません：${error.message}。現在の記録・調整は変えていません。`,true); }
  }
  function exportJSON(data,file,panel,field) {
    const serialized=JSON.stringify(data,null,2);
    $(field).value=serialized;$(panel).hidden=false;$(panel).open=true;
    const url=URL.createObjectURL(new Blob([serialized],{type:'application/json'})), link=document.createElement('a');
    link.href=url;link.download=file;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function syncPalette() {
    const active = ready && bodyKey === 'lineA1';
    $('palette-controls').disabled = !active;
    $('palette-note').textContent = active ? 'A1だけの試作。キャラごとに配色を保持します。肌・頭・濃い線・バックルは元色です。' : '配色操作はA1のみ。A2・A3の形にはマスクを使い回しません。A1を選ぶと調整できます。';
    $('hue-wheel').tabIndex = active ? 0 : -1;
    $('hue-wheel').setAttribute('aria-disabled', String(!active));
    $('palette-preview-label').textContent = `${core.heads[$('character').value].label}のA1配色`;
    const setting = palettes[$('character').value]?.[$('material').value];
    if (!setting) return;
    $('color-enabled').checked = setting.enabled;
    for (const field of ['hue','saturation','lightness']) $('color-' + field).value = setting[field];
    $('hue-value').value = `${setting.hue}°`;
    $('saturation-value').value = `${setting.saturation}%`;
    $('lightness-value').value = String(setting.lightness);
    $('hue-marker').style.setProperty('--angle', `${setting.hue}deg`);
    $('hue-wheel').setAttribute('aria-valuenow', String(setting.hue));
    $('color-swatch').style.background = `hsl(${setting.hue} ${setting.saturation}% ${50+setting.lightness}%)`;
  }
  function paletteCanvas(key, showMask = false) {
    const signature = JSON.stringify([palettes[key],$('seam').checked,showMask && $('material').value]);
    if (paletteCache.get(key)?.signature === signature) return paletteCache.get(key).canvas;
    const canvas = imageCanvas(core.paletteMask.target,core.paletteMask.size), ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0,0,...core.paletteMask.size);
    let result = pixels.recolor(paletteSource,paletteLabels,palettes[key]);
    if (showMask) result = pixels.maskView(result,paletteLabels,pixels.groups.find(group => group.id === $('material').value).code);
    if ($('seam').checked) result = pixels.applyKeep(result,paletteKeep);
    data.data.set(result); ctx.putImageData(data,0,0);
    canvas.dataset.palette = 'true'; canvas.dataset.seam = String($('seam').checked);
    paletteCache.set(key,{signature,canvas}); return canvas;
  }
  function imageLayer(ctx, file, layer, override) {
    ctx.save(); ctx.translate(...layer.position); ctx.scale(layer.scale, layer.scale); ctx.drawImage(override || ($('seam').checked && seamImages[file] ? seamImages[file] : images[file]), 0, 0); ctx.restore();
  }
  function imageCanvas(file, size) {
    const canvas = document.createElement('canvas'); canvas.width = size[0]; canvas.height = size[1];
    canvas.dataset.asset = `assets/${file}`;
    canvas.getContext('2d').drawImage(images[file], 0, 0);
    return canvas;
  }
  function prepareSeams() {
    for (const spec of Object.values(core.seamMasks)) {
      const canvas = imageCanvas(spec.target, spec.size), ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0,0,...spec.size);
      const mask = imageCanvas(spec.file, spec.size).getContext('2d').getImageData(0,0,...spec.size);
      data.data.set(SharedBodyPixels.applyKeep(data.data, mask.data)); ctx.putImageData(data,0,0);
      canvas.dataset.seam = 'true'; seamImages[spec.target] = canvas;
    }
  }
  function character(ctx, key, foot, zoom, chosenBody = bodyKey) {
    const fit = core.fit(chosenBody, key, profiles[chosenBody][key], foot, zoom);
    ctx.save();
    if ($('mirror').checked) { ctx.translate(foot[0] * 2, 0); ctx.scale(-1, 1); }
    if ($('weapon').checked && core.bodies[chosenBody].weaponReady !== false) {
      // 剣の柄は身体の手の後ろへ。静止合成のみで前後切替はまだしない。
      ctx.save(); ctx.translate(...fit.sword.position); ctx.rotate(fit.sword.angle); ctx.scale(fit.sword.scale, fit.sword.scale); ctx.drawImage(images[core.sword.file], -core.sword.join[0], -core.sword.join[1]); ctx.restore();
    }
    const colorBody = chosenBody === 'lineA1' ? paletteCanvas(key,bodyKey === 'lineA1' && $('mask-view').checked) : null;
    imageLayer(ctx, core.bodies[chosenBody].file, fit.body, colorBody);
    imageLayer(ctx, core.headAsset(chosenBody, key).file, fit.head);
    if ($('guides').checked) {
      ctx.strokeStyle = dark ? '#c3e4d4' : '#37635a'; ctx.lineWidth = 1;
      const points = core.bodies[chosenBody].weaponReady === false ? [fit.neck] : [fit.neck, fit.grip];
      for (const point of points) { ctx.beginPath(); ctx.arc(...point, 4 * zoom, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(point[0] - 8 * zoom, point[1]); ctx.lineTo(point[0] + 8 * zoom, point[1]); ctx.stroke(); }
    }
    ctx.restore();
  }
  function reference(ctx, key, foot, adjustment, overlay) {
    const fit = core.referenceFit(bodyKey, key, adjustment, foot);
    const asset = core.originalAsset(bodyKey, key);
    ctx.save();
    // 左右移動は画面方向に一定。反転は移動後の足元を軸にする。
    if ($('mirror').checked) { ctx.translate((foot[0] + adjustment.x) * 2, 0); ctx.scale(-1, 1); }
    ctx.globalAlpha = overlay ? Number($('reference-opacity').value) / 100 : 1;
    ctx.translate(...fit.position); ctx.scale(fit.scale, fit.scale);
    ctx.drawImage(overlay && $('silhouette').checked ? silhouettes[asset.file] : images[asset.file], 0, 0);
    ctx.restore();
  }
  function drawFitting() {
    const canvas = $('fitting'), ctx = canvas.getContext('2d'), key = $('character').value;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = dark ? '#60776a' : '#c5d3cb'; ctx.lineWidth = 1;
    const left = canvas.width / 4, right = canvas.width * .75, center = canvas.width / 2;
    ctx.beginPath(); ctx.moveTo(32, 460.5); ctx.lineTo(canvas.width - 32, 460.5); ctx.moveTo(center + .5, 25); ctx.lineTo(center + .5, 495); ctx.stroke();
    character(ctx, key, [left, 460], 1);
    if ($('overlay').checked) reference(ctx, key, [left, 460], currentReference(), true);
    reference(ctx, key, [right, 460], { ...currentReference(), x: 0, y: 0 }, false);
  }
  function draw() {
    if (!ready) return;
    if (core.bodies[bodyKey].extracted) {
      const canvas = $('outfits'), ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = dark ? '#60776a' : '#c5d3cb'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(20,360.5); ctx.lineTo(880,360.5); ctx.stroke();
      core.outfitKeys.forEach((key, i) => character(ctx, $('character').value, [150 + i * 300, 360], 1, key));
    }
    $('palette-panel').hidden = !core.bodies[bodyKey].extracted;
    if (core.bodies[bodyKey].extracted) {
      const palette=$('palette-preview'), ctx=palette.getContext('2d'); ctx.clearRect(0,0,palette.width,palette.height);
      character(ctx,$('character').value,[350,440],1.3,'lineA1');
    }
    drawFitting();
    const canvas = $('comparison'), ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = dark ? '#60776a' : '#c5d3cb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(36, 370.5); ctx.lineTo(804, 370.5); ctx.stroke();
    const available = core.headKeys(bodyKey);
    available.forEach((key, i) => character(ctx, key, [840 / available.length * (i + .5), 370], 1));
    const mini = $('mini'), mc = mini.getContext('2d'); mc.clearRect(0, 0, mini.width, mini.height);
    // 初期合成を全高約70pxにする固定ズーム。頭調整による大きさの差は残す。
    available.forEach((key, i) => character(mc, key, [380 / available.length * (i + .5), 85], 70 / core.characterHeight(bodyKey, key)));
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
    $('record-load').disabled=true; $('record-import').disabled=true; $('record-import-file').disabled=true;
    $('palette-controls').disabled = true; $('hue-wheel').tabIndex=-1; $('hue-wheel').setAttribute('aria-disabled','true');
    document.querySelector('.preview').classList.remove('ready'); $('loading').hidden = false; $('error').hidden = true;
    $('status').textContent = '素材の読み込み中';
    try {
      await Promise.all(core.allAssets().map(asset => loadImage(asset.file, asset.size)));
      prepareSeams();
      paletteCache.clear();
      const rgba = file => imageCanvas(file,core.paletteMask.size).getContext('2d').getImageData(0,0,...core.paletteMask.size).data;
      paletteSource = rgba(core.paletteMask.target); paletteLabels = rgba(core.paletteMask.file); paletteKeep = rgba(core.seamMasks.lineA1.file);
      for (const asset of [...Object.values(core.originals), ...Object.values(core.extractedOriginals)]) {
        const canvas = document.createElement('canvas');
        canvas.width = asset.size[0]; canvas.height = asset.size[1];
        const ctx = canvas.getContext('2d'); ctx.drawImage(images[asset.file], 0, 0);
        ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#527d6b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        silhouettes[asset.file] = canvas;
      }
      ready = true; $('controls').disabled = false; $('background').disabled = false;
      $('record-import').disabled=false; $('record-import-file').disabled=false;
      $('loading').hidden = true; document.querySelector('.preview').classList.add('ready'); sync();
      $('status').textContent = '静止フィッティング · 攻撃連番は未生成';
    } catch (error) {
      $('loading').hidden = true; $('error').hidden = false; $('error').querySelector('p').textContent = error.message;
      $('status').textContent = '読み込みエラー · 再試行できます';
    }
  }
  document.querySelectorAll('[data-body]').forEach(button => button.addEventListener('click', () => { bodyKey = button.dataset.body; sync(); }));
  $('character').addEventListener('change', () => { $('record-name').value='';sync(); });
  $('class-id').addEventListener('change',syncRecordControls);
  for (const classId of presets.classIds.filter(id=>id!=='戦列下級')) {
    const option=document.createElement('option'); option.value=classId;option.textContent=classId+'（衣装素材未登録）';option.disabled=true;$('class-id').appendChild(option);
  }
  $('record-save').addEventListener('click',()=>{
    if (!ready || $('record-save').disabled) return;
    try {
      let base=library;
      try { base=presets.merge(diskLibrary(),library); } catch { /* 保存失敗時もこのタブの記録は保全する。 */ }
      const candidate=presets.append(base,captureRecord());
      persistLibrary(candidate,'record-message','キャラ×兵種の外見をブラウザ内に記録しました。履歴から呼び出せます。');
      $('record-list').value=candidate.records[candidate.records.length-1].id;
    } catch(error) { recordMessage('record-message',`記録できません：${error.message}`,true); }
  });
  $('record-load').addEventListener('click',()=>{
    if (!ready) return;
    const record=library.records.find(r=>r.id===$('record-list').value);
    if (!record) { recordMessage('record-import-message','呼び出す記録を選んでください',true); return; }
    applyRecord(record); recordMessage('record-import-message',`${record.name} / 履歴${record.revision}を呼び出しました。変更を残すには改めて記録してください。`);
  });
  $('record-backup').addEventListener('click',()=>{
    exportJSON(library,'srpg-generic-outfits.json','record-export-panel','record-export-text');
    recordMessage('record-import-message','記録一覧JSONを生成しました。保存できない場合は下欄から全文をコピーしてください。');
  });
  $('record-import').addEventListener('click',()=>importRecords($('record-import-text').value));
  $('record-import-file').addEventListener('change',async()=>{
    const file=$('record-import-file').files?.[0];if (!file) return;
    if (file.size>2*1024*1024) { recordMessage('record-import-message','JSONは2MB以下にしてください',true);return; }
    try { importRecords(await file.text()); } catch { recordMessage('record-import-message','ファイルを読み取れませんでした',true); }
    $('record-import-file').value='';
  });
  $('material').addEventListener('change', () => { syncPalette(); draw(); });
  function changeColor(field, value) {
    if (!ready || bodyKey !== 'lineA1') return;
    const setting = palettes[$('character').value][$('material').value];
    setting[field] = value; setting.enabled = true; syncPalette(); draw();
  }
  for (const field of ['hue','saturation','lightness']) $('color-' + field).addEventListener('input', () => changeColor(field,Number($('color-' + field).value)));
  $('color-enabled').addEventListener('change', () => { palettes[$('character').value][$('material').value].enabled = $('color-enabled').checked; draw(); });
  $('mask-view').addEventListener('change', draw);
  $('color-reset').addEventListener('click', () => { const id=$('material').value; palettes[$('character').value][id]=pixels.paletteDefaults()[id]; syncPalette(); draw(); });
  $('palette-reset').addEventListener('click', () => { palettes[$('character').value]=pixels.paletteDefaults(); syncPalette(); draw(); });
  function wheelColor(event) {
    if (!ready || bodyKey !== 'lineA1') return;
    const box=$('hue-wheel').getBoundingClientRect();
    const angle=Math.atan2(event.clientY-box.top-box.height/2,event.clientX-box.left-box.width/2)*180/Math.PI;
    changeColor('hue',Math.round((angle+360)%360)%360);
  }
  $('hue-wheel').addEventListener('pointerdown', event => { if (ready && bodyKey==='lineA1') { $('hue-wheel').setPointerCapture(event.pointerId); wheelColor(event); } });
  $('hue-wheel').addEventListener('pointermove', event => { if (event.buttons & 1) wheelColor(event); });
  $('hue-wheel').addEventListener('keydown', event => {
    if (!ready || bodyKey !== 'lineA1' || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault(); const currentHue=palettes[$('character').value][$('material').value].hue;
    const delta=['ArrowLeft','ArrowDown'].includes(event.key) ? -1 : 1;
    changeColor('hue',event.key==='Home' ? 0 : event.key==='End' ? 359 : (currentHue+delta*(event.shiftKey ? 10 : 1)+360)%360);
  });
  $('palette-png').addEventListener('click', () => {
    if (!ready || bodyKey !== 'lineA1') return;
    const key=$('character').value;
    $('status').textContent='色替え身体PNGを書き出しています';
    paletteCanvas(key).toBlob(blob => {
      if (!blob) { $('status').textContent='PNGを書き出せませんでした。再試行してください'; return; }
      if (lastPngUrl) URL.revokeObjectURL(lastPngUrl);
      lastPngUrl=URL.createObjectURL(blob);
      const link=$('png-download'); link.href=lastPngUrl; link.download=`line_low_child_a1_${key}_palette.png`;
      $('png-export-meta').textContent=`出力時の${core.heads[key].label}の配色です。設定を変えた後は、もう一度PNGを保存してください。`;
      $('png-export').src=lastPngUrl; $('png-export-panel').hidden=false; $('png-export-panel').open=true;
      link.click(); $('status').textContent='頭なしのA1身体PNGを生成しました · 保存できない場合は書き出し画像から保存できます';
    },'image/png');
  });
  for (const [id, field] of [['head-scale','scale'], ['head-x','x'], ['head-y','y']]) $(id).addEventListener('input', () => { current()[field] = Number($(id).value); sync(); });
  for (const [id, field] of [['reference-scale','scale'], ['reference-x','x'], ['reference-y','y']]) $(id).addEventListener('input', () => { currentReference()[field] = Number($(id).value); sync(); });
  $('reference-opacity').addEventListener('input', sync);
  ['overlay','silhouette'].forEach(id => $(id).addEventListener('change', sync));
  $('reference-reset').addEventListener('click', () => { referenceProfiles[bodyKey][$('character').value] = core.defaults(); sync(); });
  $('reset').addEventListener('click', () => { profiles[bodyKey][$('character').value] = core.defaults(); sync(); });
  $('match-outfits').addEventListener('click', () => { const a = { ...current() }; core.outfitKeys.forEach(key => { profiles[key][$('character').value] = { ...a }; }); sync(); });
  $('weapon').addEventListener('change', () => { weaponSettings[bodyKey] = $('weapon').checked; draw(); });
  ['guides','mirror','seam'].forEach(id => $(id).addEventListener('change', draw));
  $('background').addEventListener('click', () => { dark = !dark; document.querySelectorAll('.stage').forEach(stage => stage.classList.toggle('dark', dark)); $('background').textContent = dark ? '背景を淡色に' : '背景を濃色に'; draw(); });
  $('retry').addEventListener('click', load);
  $('save').addEventListener('click', () => {
    const data = { version: 5, state: '試作対象', pose: core.bodies[bodyKey].extracted ? '静止・武器なしの衣装比較' : '旧試作の静止構え', selectedBody: bodyKey, selectedCharacter: $('character').value, bodies: core.bodies, heads: core.heads, extractedHeads: core.extractedHeads, originals: core.originals, extractedOriginals: core.extractedOriginals, adjustments: profiles, referenceAdjustments: referenceProfiles, referenceView: { overlay: $('overlay').checked, silhouette: $('silhouette').checked, opacity: Number($('reference-opacity').value) / 100 } };
    data.presetLibrary=library;data.editorView={mirror:$('mirror').checked,guides:$('guides').checked};
    data.palette = { body:'lineA1',mask:core.paletteMask,groups:pixels.groups,characters:palettes };
    data.seamView = { enabled: $('seam').checked, masks: core.seamMasks };
    exportJSON(data,'shared-body-fitting.json','export-panel','export-json');
    $('status').textContent = '作業全体JSONを生成しました · ダウンロードできない場合は下欄からコピーできます';
  });
  try { library=diskLibrary(); } catch(error) { recordMessage('record-message',`${error.message}。ブラウザ保存が使えない場合はJSONを保管してください。`,true); }
  refreshRecords();
  window.addEventListener('storage',event=>{
    if (event.key!==presets.STORAGE_KEY) return;
    try { library=presets.merge(library,diskLibrary());refreshRecords(); } catch(error) { recordMessage('record-message',error.message,true); }
  });
  load();
})();
