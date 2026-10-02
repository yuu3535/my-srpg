(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const stage = document.getElementById('stage');
  const viewport = document.getElementById('viewport');
  const model = window.DialogueStudy;
  const config = window.DialogueSettings;
  const saveStatus = document.getElementById('save-status');
  const transferStatus = document.getElementById('transfer-status');
  const jsonField = document.getElementById('settings-json');
  let settings = { ...config.defaults };
  let storageAvailable = true;
  // 撮影用のURLは既定値を使い、作者が保存した調整値を読み書きしない。
  if (!params.has('capture')) {
    try {
      const saved = localStorage.getItem(config.storageKey);
      if (saved) { settings = config.parse(saved); saveStatus.textContent = '前回の調整を復元しました。変更はこのブラウザに自動保存します。'; }
    } catch (error) { storageAvailable = false; saveStatus.textContent = '保存値を復元できませんでした。設定JSONを保存してお使いください。'; }
  }
  let state = model.makeState(params.get('copy') === 'long' ? 1 : 0);
  if (params.has('capture')) document.body.classList.add('capture');
  if (['small', 'medium', 'large'].includes(params.get('size'))) settings.ornament = params.get('size');
  if (params.get('background') === 'plain') stage.dataset.background = 'plain';
  function saveSettings() {
    if (params.has('capture')) return;
    try { localStorage.setItem(config.storageKey, config.serialize(settings)); storageAvailable = true; saveStatus.textContent = 'このブラウザに自動保存済み。同じブラウザ・同じURLのホストで続きから調整できます。'; }
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
    stage.style.setProperty('--inner-fill', settings.panelColor === config.defaults.panelColor && settings.transparency === 4 ? '#142531' : config.rgba(settings.panelColor, settings.transparency));
    stage.style.setProperty('--inner-border', settings.borderColor === config.defaults.borderColor ? '#586c78' : config.rgba(settings.borderColor, 55));
    document.querySelectorAll('[data-setting]').forEach(input => {
      const value = settings[input.dataset.setting]; input.value = value;
      document.getElementById(`${input.id}-value`).value = typeof value === 'number' ? `${value} ${input.dataset.setting === 'transparency' ? '%' : 'px'}` : value;
    });
    syncButtons('data-size', settings.ornament);
    jsonField.value = config.serialize(settings);
    const line = document.getElementById('line');
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
  }
  function resize() {
    const scale = viewport.clientWidth / 844;
    stage.style.setProperty('--scale', scale);
    document.getElementById('measurements').textContent = `現在の表示領域 ${Math.round(viewport.clientWidth)} × ${Math.round(viewport.clientHeight)}px ／ 横画面固定`;
    renderSettings();
  }
  document.querySelectorAll('button[data-size]').forEach(button => button.addEventListener('click', () => { settings.ornament = button.dataset.size; render(); saveSettings(); }));
  document.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('input', () => {
    settings = config.normalize({ ...settings, [input.dataset.setting]: input.type === 'range' ? Number(input.value) : input.value });
    renderSettings(); saveSettings();
  }));
  document.getElementById('reset-settings').addEventListener('click', () => { settings = { ...config.defaults }; renderSettings(); saveSettings(); transferStatus.setAttribute('role', 'status'); transferStatus.textContent = '元の見本に戻しました。'; });
  document.getElementById('copy-settings').addEventListener('click', async () => {
    const text = config.serialize(settings);
    transferStatus.setAttribute('role', 'status');
    try { await navigator.clipboard.writeText(text); saveStatus.textContent = `設定をコピーしました。${storageAvailable ? '調整は自動保存済みです。' : '自動保存できないためJSONも保存してください。'}`; }
    catch (error) { document.querySelector('.settings-details').open = true; jsonField.value = text; jsonField.focus(); jsonField.select(); transferStatus.textContent = '自動コピーできませんでした。選択されたJSONを手動でコピーしてください。'; }
  });
  document.getElementById('download-settings').addEventListener('click', () => {
    const blob = new Blob([config.serialize(settings)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'silver-dialogue-settings.json'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    saveStatus.textContent = '設定JSONのダウンロードを開始しました。保存したファイルは後で読み込めます。';
  });
  document.getElementById('import-settings').addEventListener('click', () => {
    try { const imported = config.parse(jsonField.value); settings = imported; renderSettings(); saveSettings(); transferStatus.setAttribute('role', 'status'); transferStatus.textContent = '設定を読み込みました。範囲外の数値はつまみの範囲に収めています。'; }
    catch (error) { transferStatus.setAttribute('role', 'alert'); transferStatus.textContent = error instanceof SyntaxError ? 'JSONを読み込めません。コピーした全文を貼り付けてください。' : error.message; }
  });
  document.querySelectorAll('button[data-background]').forEach(button => button.addEventListener('click', () => { stage.dataset.background = button.dataset.background; render(); }));
  document.querySelectorAll('[data-width]').forEach(button => button.addEventListener('click', () => { viewport.classList.toggle('wide', button.dataset.width === 'wide'); syncButtons('data-width', button.dataset.width); resize(); }));
  document.getElementById('short-copy').addEventListener('click', () => { state = model.choose(state, 0); render(); });
  document.getElementById('long-copy').addEventListener('click', () => { state = model.choose(state, 2); render(); });
  document.getElementById('advance').addEventListener('click', () => { state = model.advance(state); render(); });
  const logPanel = document.getElementById('log-panel');
  const openLog = document.getElementById('open-log');
  function closeLog() { logPanel.hidden = true; openLog.setAttribute('aria-expanded', 'false'); openLog.focus(); }
  openLog.addEventListener('click', () => { const willOpen = logPanel.hidden; logPanel.hidden = !willOpen; openLog.setAttribute('aria-expanded', String(willOpen)); if (willOpen) document.getElementById('close-log').focus(); });
  document.getElementById('close-log').addEventListener('click', closeLog);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !logPanel.hidden) closeLog(); });
  new ResizeObserver(resize).observe(viewport);
  const status = document.getElementById('asset-state');
  const images = [...stage.querySelectorAll('img')];
  Promise.all(images.map(image => image.decode())).then(() => { status.hidden = true; }).catch(() => { status.textContent = '素材を読み込めませんでした。ページを再読み込みしてください。'; status.setAttribute('role', 'alert'); });
  render(); resize();
})();
