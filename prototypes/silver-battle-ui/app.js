(() => {
  const { CHARACTERS, enemies, initialState, reduce, forecastFor } = UIStudy;
  const $ = id => document.getElementById(id);
  const ui = '../../assets/ui/';
  const icons = 'assets/skill-icons/';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let state = initialState();
  let animationTimer;
  let noticeTimer;
  let previousFocus;
  const params = new URLSearchParams(location.search);
  document.body.classList.toggle('capture', params.get('capture') === '1');
  const portrait = c => `<img src="${esc(c.portrait)}" alt="">`;
  const weapon = c => `<img src="${ui + c.weaponIcon}.png" alt="">`;
  function dispatch(action) {
    state = reduce(state, action);
    $('command').hidden = true;
    render();
  }
  function vital(label, current, mp = false, maximum = current) {
    return `<div class="vital-line"><div><span>${label}</span><b>${current} / ${maximum}</b></div><div class="meter ${mp ? 'mp' : ''}"><i style="width:${current / maximum * 100}%"></i></div></div>`;
  }
  function renderStatus(c) {
    $('status').innerHTML = `<div class="identity"><img class="identity-art" src="${esc(c.portrait)}" alt="${esc(c.name)}の肖像"><div class="identity-text"><h3 class="${c.name.length > 5 ? 'long-name' : ''}">${esc(c.name)}</h3><p class="level">Lv.${c.level}</p><div class="job">${weapon(c)}${esc(c.job)}</div></div><div class="vitals">${vital('HP', state.allyHp[c.id], false, c.hp)}${vital('MP', c.mp, true)}</div></div><div class="abilities"><div class="mobility"><dl><dt>移動</dt><dd>${c.move}</dd></dl><dl><dt>射程</dt><dd>${c.range}</dd></dl></div><div class="ability-list">${['力', '魔力', '技', '速さ', '守備', '魔防'].map((n, i) => `<dl><dt>${n}</dt><dd>${c.stats[i]}</dd></dl>`).join('')}</div></div><div class="weapon">${weapon(c)}${esc(c.weapon)}</div><div class="skill"><img src="${icons + c.skillIcon}.png" alt=""><div><b>${esc(c.skill)}</b><small>${esc(c.description)}</small></div></div><div class="skill"><img src="${icons}17_戦闘指揮.png" alt=""><div><b>戦術の才</b><small>味方の与ダメージ +10%</small></div></div>`;
  }
  function renderRoster() {
    const focused = document.activeElement?.dataset?.ally;
    $('roster-list').hidden = !state.rosterOpen;
    $('roster-toggle').setAttribute('aria-expanded', String(state.rosterOpen));
    $('roster-toggle').setAttribute('aria-label', `味方一覧を${state.rosterOpen ? '閉じる' : '開く'}`);
    $('roster-toggle').querySelector('img').src = `assets/package/assets/regular/caret-${state.rosterOpen ? 'up' : 'down'}.svg`;
    const scroll = $('roster-list').scrollTop;
    $('roster-list').innerHTML = CHARACTERS.map(c => `<button class="roster-face ${state.selected === c.id ? 'selected' : ''}" data-ally="${c.id}" aria-label="${esc(c.name)}を選択" aria-pressed="${state.selected === c.id}">${portrait(c)}</button>`).join('');
    $('roster-list').scrollTop = scroll;
    if (focused) $('roster-list').querySelector(`[data-ally="${focused}"]`)?.focus({ preventScroll: true });
  }
  function renderMap() {
    const center = state.positions[state.selected];
    const target = enemies.find(e => e.id === state.target).position;
    $('stage').style.setProperty('--camera-y', `${Math.min(-20, 290 - Math.max(center[1], target[1]) * 1.02)}px`);
    $('attack-arc').hidden = state.phase === 'normal';
    Object.assign($('attack-arc').style, { left: `${Math.min(center[0], target[0]) - 5}px`, top: `${Math.min(center[1], target[1]) - 65}px`, width: `${Math.max(60, Math.abs(center[0] - target[0]) + 20)}px`, height: `${Math.max(65, Math.abs(center[1] - target[1]) + 20)}px`, transform: target[0] < center[0] ? 'scaleX(-1)' : 'none' });
    const tiles = [];
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      if (Math.abs(a) + Math.abs(b) > 3) continue;
      const x = center[0] + (a - b) * 55, y = center[1] + (a + b) * 28;
      if (x < 150 || x > 890 || y < 195 || y > 450) continue;
      const isEnemy = enemies.some(e => Math.abs(e.position[0] - x) < 55 && Math.abs(e.position[1] - y) < 28);
      if (state.phase !== 'normal' && !isEnemy && Math.abs(a) + Math.abs(b) > 1) continue;
      if (!isEnemy) tiles.push(`<button class="tile" tabindex="-1" data-move="${x},${y}" aria-label="移動先" style="left:${x - 55}px;top:${y - 28}px"><img src="${ui}range_move.png" alt=""></button>`);
    }
    // 射程判定ではなく、参考画像の移動色／対象色を比較するための見本。
    if (!state.defeated.includes(state.target)) for (const [dx, dy] of [[0, 0], [-55, 28], [55, 28], [0, 56]]) {
      tiles.push(`<button class="tile" tabindex="-1" data-enemy="${state.target}" aria-label="攻撃対象のマス" style="left:${target[0] + dx - 55}px;top:${target[1] + dy - 28}px"><img src="${ui}range_attack.png" alt=""></button>`);
    }
    $('ranges').innerHTML = tiles.join('');
    $('units').innerHTML = CHARACTERS.map(c => {
      const [x, y] = state.positions[c.id];
      return `<button class="unit ${c.id === state.selected ? 'selected' : ''} ${state.phase === 'attacking' && c.id === state.selected ? 'striking' : ''}" style="left:${x}px;top:${y}px" data-ally="${c.id}" aria-label="盤面の${esc(c.name)}を選択">${c.id === state.selected ? `<img class="unit-marker" src="${ui}mark_selected.png" alt="">` : ''}<img class="unit-art" src="${esc(c.unit)}" alt=""><span class="unit-hp"><i style="width:${state.allyHp[c.id] / c.hp * 100}%"></i></span></button>`;
    }).join('') + enemies.filter(e => !state.defeated.includes(e.id)).map(e => `<button class="unit enemy ${e.id === state.target && state.phase !== 'normal' ? 'target' : ''} ${state.phase === 'attacking' && e.id === state.target ? 'receiving' : ''}" style="left:${e.position[0]}px;top:${e.position[1]}px" data-enemy="${e.id}" aria-label="${e.name}に攻撃する">${e.id === state.target && state.phase !== 'normal' ? `<img class="unit-marker" src="${ui}mark_target.png" alt="">` : ''}<img class="unit-art" src="assets/guard-unit.png" alt=""><span class="unit-hp"><i style="width:${state.enemyHp[e.id] / e.hp * 100}%"></i></span></button>`).join('');
  }
  function renderForecast() {
    const p = forecastFor(state), c = p.attacker, e = p.defender;
    $('attacker-art').src = c.portrait;
    $('attacker-art').alt = `${c.name}の肖像`;
    $('attacker-stats').innerHTML = `<div class="forecast-name">${esc(c.name)}<small>Lv.${c.level}</small></div><div class="forecast-weapon">${weapon(c)}${esc(c.weapon)}</div><div class="forecast-hp"><span>HP</span><span class="meter"><i style="width:${c.hp / CHARACTERS.find(a => a.id === c.id).hp * 100}%"></i></span><b>${c.hp} » <em>${p.attackerAfter}</em></b></div><dl><dt>攻撃</dt><dd>${c.damage}${c.strikes > 1 ? ' × ' + c.strikes : ''}</dd></dl><dl><dt>命中</dt><dd>${c.hit}%</dd></dl><dl><dt>必殺</dt><dd>${c.crit}%</dd></dl>`;
    $('defender-stats').innerHTML = `<div class="forecast-name">${esc(e.name)}<small>Lv.${e.level}</small></div><div class="forecast-weapon"><img src="${ui}weapon_lance.png" alt="">鉄の槍</div><div class="forecast-hp"><span>HP</span><span class="meter"><i style="width:${e.hp / enemies.find(a => a.id === e.id).hp * 55}%"></i></span><b>${e.hp} » <em>${p.defenderAfter}</em></b></div><dl><dt>攻撃</dt><dd>12</dd></dl><dl><dt>命中</dt><dd>62%</dd></dl><dl><dt>必殺</dt><dd>0%</dd></dl>`;
    $('confirm').disabled = state.phase === 'attacking';
    $('confirm').querySelector('span').textContent = state.phase === 'attacking' ? '攻撃中' : '攻撃する';
  }
  function render() {
    const forecast = state.phase !== 'normal';
    $('stage').dataset.state = state.phase;
    $('chapter').hidden = forecast;
    $('forecast-title').hidden = !forecast;
    $('status').hidden = forecast;
    $('forecast').hidden = !forecast;
    $('normal-view').setAttribute('aria-pressed', String(!forecast));
    $('forecast-view').setAttribute('aria-pressed', String(forecast));
    $('instruction').textContent = forecast ? '予測を確認して攻撃。キャンセルで盤面へ戻ります。' : '味方を選ぶと人物情報。敵を押すと戦闘予測。';
    renderRoster(); renderStatus(CHARACTERS.find(c => c.id === state.selected)); renderMap();
    if (forecast) renderForecast();
  }
  function showNotice(title, description) {
    clearTimeout(noticeTimer);
    $('notice').innerHTML = `${esc(title)}<small>${esc(description)}</small>`;
    $('notice').hidden = false;
    noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 2300);
  }
  function openDialog(id) { previousFocus = document.activeElement; $(id).showModal(); $(id).querySelector('button').focus(); }
  document.addEventListener('click', event => {
    const ally = event.target.closest('[data-ally]');
    const enemy = event.target.closest('[data-enemy]');
    const move = event.target.closest('[data-move]');
    if (state.phase === 'attacking') return;
    if (ally) {
      const selectedAgain = ally.dataset.ally === state.selected && ally.classList.contains('unit');
      dispatch({ type: 'SELECT', id: ally.dataset.ally });
      if (selectedAgain) $('command').hidden = false;
    } else if (enemy) { dispatch({ type: 'FORECAST', id: enemy.dataset.enemy }); $('confirm').focus({ preventScroll: true }); }
    else if (move) dispatch({ type: 'MOVE', position: move.dataset.move.split(',').map(Number) });
  });
  $('roster-toggle').addEventListener('click', () => dispatch({ type: 'ROSTER' }));
  const openForecast = () => { dispatch({ type: 'FORECAST' }); if (state.phase === 'forecast') $('confirm').focus({ preventScroll: true }); else showNotice('対象がいません', '「最初に戻す」で、もう一度試せます。'); };
  $('forecast-view').addEventListener('click', openForecast);
  $('open-attack').addEventListener('click', openForecast);
  $('close-command').addEventListener('click', () => { $('command').hidden = true; });
  const cancel = () => { dispatch({ type: 'CANCEL' }); $('normal-view').focus({ preventScroll: true }); };
  $('normal-view').addEventListener('click', cancel);
  $('cancel').addEventListener('click', cancel);
  $('confirm').addEventListener('click', () => {
    if (state.phase !== 'forecast') return;
    dispatch({ type: 'CONFIRM' });
    clearTimeout(animationTimer);
    animationTimer = setTimeout(() => {
      dispatch({ type: 'FINISH' });
      showNotice('見本の攻撃完了', `相手HP ${state.result.defender.hp} → ${state.result.defenderAfter} ／ 戦闘計算は仮の固定例`);
      $('normal-view').focus({ preventScroll: true });
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 850);
  });
  $('reset').addEventListener('click', () => { clearTimeout(animationTimer); clearTimeout(noticeTimer); $('notice').hidden = true; dispatch({ type: 'RESET' }); });
  $('detail').addEventListener('click', () => {
    const p = forecastFor(state);
    $('detail-content').innerHTML = `<p>${esc(p.attacker.name)} → ${esc(p.defender.name)}</p><ol><li>攻撃 ${p.attacker.damage}ダメージ（表示確認用）</li><li>${p.counter ? '相手が生存した場合、射程内なので反撃' : '途中撃破する見本のため、反撃・追撃を実行しない'}</li></ol><p>命中・必殺は密度を確かめる仮の表示。乱数・武器耐久・MP・BattlePlanには未接続です。</p>`;
    openDialog('detail-dialog');
  });
  $('help').addEventListener('click', () => openDialog('help-dialog'));
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.querySelector('.dialog-return').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => previousFocus?.focus({ preventScroll: true }));
  }
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || state.phase === 'attacking') return;
    if (e.key === 'Escape') cancel();
    if (e.key.toLowerCase() === 'f') openForecast();
    if (e.key.toLowerCase() === 'r') $('reset').click();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const i = CHARACTERS.findIndex(c => c.id === state.selected), d = e.key === 'ArrowRight' ? 1 : -1;
      dispatch({ type: 'SELECT', id: CHARACTERS[(i + d + CHARACTERS.length) % CHARACTERS.length].id });
    }
  });
  const resize = () => { $('stage').style.setProperty('--scale', String($('viewport').clientWidth / 1254)); };
  new ResizeObserver(resize).observe($('viewport'));
  resize(); render();
  if (params.get('state') === 'forecast') dispatch({ type: 'FORECAST', id: 'guard' });
  // 読み込み失敗を成功扱いしない。見本内で原因と再読込の導線を示す。
  Promise.all(['castle-map.png', 'silver-frame.png', 'silver-button-filled.png', 'attack-arc.png', 'arshe-portrait.png', 'mage-portrait.png', 'guard-portrait.png', 'arshe-unit.png', 'mage-unit.png', 'guard-unit.png'].map(file => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = resolve; image.onerror = () => reject(new Error(file)); image.src = `assets/${file}`;
  }))).then(() => { $('loading').hidden = true; $('stage').setAttribute('aria-busy', 'false'); }).catch(error => {
    $('loading').innerHTML = `<p>素材を読み込めませんでした：${esc(error.message)}</p><button onclick="location.reload()">再読み込み</button>`;
    $('stage').setAttribute('aria-busy', 'false');
  });
})();
