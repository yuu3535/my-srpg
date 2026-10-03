(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const stage = document.getElementById('stage');
  const viewport = document.getElementById('viewport');
  const presentation = params.get('layout') === 'portraits' ? 'portraits' : 'lower';
  const isPortrait = presentation === 'portraits';
  stage.dataset.presentation = presentation;
  const model = isPortrait ? window.PortraitDialogueStudy : window.DialogueStudy;
  const config = window.DialogueSettings;
  const saveStatus = document.getElementById('save-status');
  const transferStatus = document.getElementById('transfer-status');
  const jsonField = document.getElementById('settings-json');
  const isCorridorTrial = params.get('background') === 'corridor2d';
  const initialSettings = isPortrait ? config.portraitTrial : isCorridorTrial ? config.corridorTrial : config.defaults;
  const storageKey = isPortrait ? config.portraitStorageKey : isCorridorTrial ? config.corridorStorageKey : config.storageKey;
  const serialize = value => config.serialize(value, presentation);
  let pageIndex = 0, pages = [];
  const textMeasure = document.createElement('canvas').getContext('2d');
  let settings = { ...initialSettings };
  const status = document.getElementById('asset-state');
  function assetFailure(error) {
    status.hidden = false;
    document.getElementById('asset-message').textContent = error.message || '素材を読み込めませんでした。読み込み直してください。';
    document.getElementById('retry-assets').hidden = false;
    status.setAttribute('role', 'alert');
  }
  const corridor = window.DialogueCorridor.create(stage, assetFailure);
  let storageAvailable = true;
  // 撮影用のURLは既定値を使い、作者が保存した調整値を読み書きしない。
  if (!params.has('capture')) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { settings = config.parse(saved, presentation); saveStatus.textContent = '前回の調整を復元しました。変更はこのブラウザに自動保存します。'; }
    } catch (error) { storageAvailable = false; saveStatus.textContent = '保存値を復元できませんでした。設定JSONを保存してお使いください。'; }
  }
  let state = model.makeState(params.get('copy') === 'long' ? 1 : 0);
  if (params.has('capture')) document.body.classList.add('capture');
  if (['small', 'medium', 'large'].includes(params.get('size'))) settings.ornament = params.get('size');
  if (params.get('background') === 'plain') stage.dataset.background = 'plain';
  if (isCorridorTrial) {
    stage.dataset.background = 'corridor2d';
    document.getElementById('reset-settings').textContent = '送った仮設定に戻す';
  }
  if (isPortrait) {
    document.getElementById('portrait-left').src = '../../unity-prototype/Assets/Art/Portraits/Dialogue/アルシェ.png';
    document.getElementById('portrait-right').src = '../../unity-prototype/Assets/Art/Portraits/Dialogue/カリマ.png';
    document.querySelectorAll('[data-portrait]').forEach(image => {
      image.parentElement.style.setProperty('--portrait-mask', `url("${image.getAttribute('src')}")`);
    });
    document.getElementById('presentation-help').hidden = false;
    document.getElementById('tail-tuning').hidden = false;
    document.getElementById('reset-settings').textContent = '上置きの仮設定に戻す';
    for (const key of ['width', 'height']) {
      const input = document.querySelector(`[data-setting="${key}"]`);
      [input.min, input.max] = config.portraitLimits[key];
    }
    document.getElementById('box-height').nextElementSibling.textContent = '枠の高さに合わせて数行ずつページ送りします。';
    document.getElementById('box-transparency').nextElementSibling.textContent = '本文の下地の透過率。名前札は背後の線が透けない不透明な下地で、同じ色に連動します。';
    document.getElementById('corridor-lift').closest('label').hidden = true;
    document.getElementById('corridor-lift').closest('label').nextElementSibling.textContent = '上置き案では背景とSDキャラを持ち上げません。Unityと同じ足元位置で比較します。';
  }
  document.querySelectorAll('[data-presentation]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.presentation === presentation) return;
    const url = new URL(location.href);
    if (button.dataset.presentation === 'portraits') { url.searchParams.set('layout', 'portraits'); url.searchParams.set('background', 'corridor2d'); }
    else url.searchParams.delete('layout');
    location.assign(url);
  }));
  function saveSettings() {
    if (params.has('capture')) return;
    try { localStorage.setItem(storageKey, serialize(settings)); storageAvailable = true; saveStatus.textContent = 'このブラウザに自動保存済み。同じブラウザ・同じURLのホストで続きから調整できます。'; }
    catch (error) { storageAvailable = false; saveStatus.textContent = '自動保存できません。「設定JSONを保存」で手元に残してください。'; }
  }
  function renderSettings() {
    stage.dataset.size = settings.ornament;
    stage.style.setProperty('--box-width', `${settings.width}px`);
    stage.style.setProperty('--box-height', `${settings.height}px`);
    stage.style.setProperty('--box-radius', `${settings.radius}px`);
    stage.style.setProperty('--panel-fill', config.rgba(settings.panelColor, settings.transparency));
    stage.style.setProperty('--frame-color', settings.borderColor);
    stage.style.setProperty('--copy-color', settings.textColor);
    stage.style.setProperty('--name-fill', settings.panelColor === config.defaults.panelColor && settings.transparency === 4 ? '#122530' : config.rgba(settings.panelColor, settings.transparency));
    stage.style.setProperty('--name-border', settings.borderColor === config.defaults.borderColor ? '#b4c6cf' : settings.borderColor);
    if (isPortrait) {
      // 名前札だけは不透明な下地にし、背後の枠・銀細工を透かさない。
      stage.style.setProperty('--name-fill', settings.panelColor);
      stage.style.setProperty('--name-border', settings.borderColor);
      const outline = document.querySelector('.dialogue-outline');
      outline.setAttribute('viewBox', `0 0 ${settings.width} ${settings.height + 20}`);
      const tailOffset = stage.dataset.speakerSide === 'right' ? settings.tailRightOffset : settings.tailLeftOffset;
      document.getElementById('dialogue-outline-path').setAttribute('d', model.framePath(settings.width, settings.height, settings.radius, stage.dataset.speakerSide, tailOffset));
    }
    stage.style.setProperty('--inner-fill', settings.panelColor === config.defaults.panelColor && settings.transparency === 4 ? '#142531' : config.rgba(settings.panelColor, settings.transparency));
    stage.style.setProperty('--inner-border', settings.borderColor === config.defaults.borderColor ? '#586c78' : config.rgba(settings.borderColor, 55));
    corridor.setHeight(settings.height);
    document.querySelectorAll('[data-setting]').forEach(input => {
      if (!(input.dataset.setting in settings)) return;
      const value = settings[input.dataset.setting]; input.value = value;
      document.getElementById(`${input.id}-value`).value = typeof value === 'number' ? `${value} ${input.dataset.setting === 'transparency' ? '%' : 'px'}` : value;
    });
    syncButtons('data-size', settings.ornament);
    jsonField.value = serialize(settings);
    const line = document.getElementById('line');
    if (isPortrait && line.clientWidth > 2 && line.clientHeight > 0) {
      const style = getComputedStyle(line);
      const lineHeight = parseFloat(style.lineHeight);
      const rows = Math.max(1, Math.floor(line.clientHeight / lineHeight));
      if (textMeasure) textMeasure.font = `${style.fontSize} ${style.fontFamily}`;
      const measure = text => textMeasure ? textMeasure.measureText(text).width + Array.from(text).length * parseFloat(style.letterSpacing || 0) : text.length * 18;
      pages = model.paginate(model.lines[state.index].text, line.clientWidth - 2, rows, measure);
      pageIndex = Math.min(pageIndex, pages.length - 1);
      line.textContent = pages[pageIndex];
      document.getElementById('page-count').hidden = pages.length < 2;
      document.getElementById('page-count').textContent = `${pageIndex + 1} / ${pages.length}`;
      document.getElementById('advance').setAttribute('aria-label', pageIndex < pages.length - 1 ? '台詞の続きを表示' : '次の台詞');
    }
    const messages = [];
    if (line.scrollHeight > line.clientHeight + 1) messages.push('台詞が枠より長いので、枠内をスクロールできます。');
    if (settings.transparency > 45) messages.push('下地がよく透けます。背景の明るい場所でも文字が読めるか確認してください。');
    if (settings.textColor === settings.panelColor) messages.push('文字と下地が同じ色です。見やすさも確認してください。');
    document.getElementById('readability-note').textContent = messages.join(' ') || '文字・銀細工は不透明のまま。幅と高さは844×390の横画面を基準にした値です。';
  }
  function syncButtons(attribute, value) {
    document.querySelectorAll(`button[${attribute}]`).forEach(button => button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === value)));
  }
  function render() {
    const line = model.lines[state.index];
    document.getElementById('speaker').textContent = line.speaker;
    document.getElementById('line').textContent = line.text;
    stage.dataset.speakerSide = line.side || 'none';
    document.querySelectorAll('[data-portrait]').forEach(image => {
      const speaking = isPortrait ? model.isHighlighted(line.side, image.dataset.portrait) : false;
      image.dataset.speaking = String(speaking);
      image.parentElement.dataset.speaking = String(speaking);
    });
    document.getElementById('short-copy').setAttribute('aria-pressed', String(state.index === 0));
    document.getElementById('long-copy').setAttribute('aria-pressed', String(state.index > 0));
    const entries = document.getElementById('log-entries');
    entries.replaceChildren();
    state.entries.forEach(index => {
      const item = document.createElement('div'); item.className = 'log-entry';
      const speaker = document.createElement('b'); speaker.textContent = model.lines[index].speaker;
      const text = document.createElement('p'); text.textContent = model.lines[index].text;
      item.append(speaker, text); entries.append(item);
    });
    renderSettings();
    syncButtons('data-background', stage.dataset.background);
    syncButtons('data-presentation', presentation);
    syncButtons('data-tail-preview', line.side || 'none');
  }
  function resize() {
    const scale = viewport.clientWidth / 844;
    stage.style.setProperty('--scale', scale);
    document.getElementById('measurements').textContent = `現在の表示領域 ${Math.round(viewport.clientWidth)} × ${Math.round(viewport.clientHeight)}px ／ 横画面固定`;
    renderSettings();
  }
  document.querySelectorAll('button[data-size]').forEach(button => button.addEventListener('click', () => { settings.ornament = button.dataset.size; render(); saveSettings(); }));
  document.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('input', () => {
    settings = config.normalize({ ...settings, [input.dataset.setting]: input.type === 'range' ? Number(input.value) : input.value }, presentation);
    renderSettings(); saveSettings();
  }));
  document.getElementById('reset-settings').addEventListener('click', () => { settings = { ...initialSettings }; pageIndex = 0; renderSettings(); saveSettings(); transferStatus.setAttribute('role', 'status'); transferStatus.textContent = isPortrait ? '上置き案の仮設定に戻しました。正式採用ではありません。' : isCorridorTrial ? '送ってくれた仮設定に戻しました。正式採用ではありません。' : '元の見本に戻しました。'; });
  document.getElementById('copy-settings').addEventListener('click', async () => {
    const text = serialize(settings);
    transferStatus.setAttribute('role', 'status');
    try { await navigator.clipboard.writeText(text); saveStatus.textContent = `設定をコピーしました。${storageAvailable ? '調整は自動保存済みです。' : '自動保存できないためJSONも保存してください。'}`; }
    catch (error) { document.querySelector('.settings-details').open = true; jsonField.value = text; jsonField.focus(); jsonField.select(); transferStatus.textContent = '自動コピーできませんでした。選択されたJSONを手動でコピーしてください。'; }
  });
  document.getElementById('download-settings').addEventListener('click', () => {
    const blob = new Blob([serialize(settings)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'silver-dialogue-settings.json'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    saveStatus.textContent = '設定JSONのダウンロードを開始しました。保存したファイルは後で読み込めます。';
  });
  document.getElementById('import-settings').addEventListener('click', () => {
    try { const imported = config.parse(jsonField.value, presentation); settings = imported; renderSettings(); saveSettings(); transferStatus.setAttribute('role', 'status'); transferStatus.textContent = '設定を読み込みました。範囲外の数値はつまみの範囲に収めています。'; }
    catch (error) { transferStatus.setAttribute('role', 'alert'); transferStatus.textContent = error instanceof SyntaxError ? 'JSONを読み込めません。コピーした全文を貼り付けてください。' : error.message; }
  });
  async function background(value) {
    stage.dataset.background = value;
    document.getElementById('corridor-controls').hidden = value !== 'corridor2d';
    if (value === 'corridor2d') {
      try { await corridor.activate(); } catch (error) { assetFailure(error); }
    } else corridor.deactivate();
    render();
  }
  document.querySelectorAll('button[data-background]').forEach(button => button.addEventListener('click', () => {
    // 別の試験URLへ移り、旧見本の保存キーへ2Dの調整値を書き込まない。
    if ((button.dataset.background === 'corridor2d' && !isCorridorTrial) || (button.dataset.background === 'scene' && isCorridorTrial)) {
      const url = new URL(location.href); url.searchParams.set('background', button.dataset.background); location.assign(url); return;
    }
    background(button.dataset.background);
  }));
  document.querySelectorAll('[data-width]').forEach(button => button.addEventListener('click', () => { viewport.classList.toggle('wide', button.dataset.width === 'wide'); syncButtons('data-width', button.dataset.width); resize(); }));
  document.getElementById('short-copy').addEventListener('click', () => { pageIndex = 0; state = model.choose(state, 0); render(); });
  document.getElementById('long-copy').addEventListener('click', () => { pageIndex = 0; state = model.choose(state, 2); render(); });
  document.querySelectorAll('[data-tail-preview]').forEach(button => button.addEventListener('click', () => {
    if (!isPortrait) return;
    pageIndex = 0; state = model.choose(state, button.dataset.tailPreview === 'right' ? 1 : 0); render();
  }));
  document.getElementById('reset-tail').addEventListener('click', () => {
    if (!isPortrait) return;
    settings = { ...settings, tailLeftOffset: 0, tailRightOffset: 0 }; render(); saveSettings();
    transferStatus.setAttribute('role', 'status'); transferStatus.textContent = '尾の位置だけ戻しました。色・寸法・ほかの調整値はそのままです。';
  });
  document.getElementById('advance').addEventListener('click', () => {
    if (isPortrait && pageIndex < pages.length - 1) pageIndex++;
    else { pageIndex = 0; state = model.advance(state); }
    render();
  });
  const logPanel = document.getElementById('log-panel');
  const openLog = document.getElementById('open-log');
  function closeLog() { logPanel.hidden = true; openLog.setAttribute('aria-expanded', 'false'); openLog.focus(); }
  openLog.addEventListener('click', () => { const willOpen = logPanel.hidden; logPanel.hidden = !willOpen; openLog.setAttribute('aria-expanded', String(willOpen)); if (willOpen) document.getElementById('close-log').focus(); });
  document.getElementById('close-log').addEventListener('click', closeLog);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !logPanel.hidden) closeLog(); });
  stage.addEventListener('corridor-mode-change', renderSettings);
  new ResizeObserver(resize).observe(viewport);
  const images = [...stage.querySelectorAll('img')].filter(image => image.getAttribute('src'));
  document.getElementById('retry-assets').addEventListener('click', () => location.reload());
  Promise.all([...images.map(image => image.decode()), isCorridorTrial ? corridor.activate() : Promise.resolve()])
    .then(() => { status.hidden = true; }).catch(assetFailure);
  document.getElementById('corridor-controls').hidden = !isCorridorTrial;
  render(); resize();
})();
