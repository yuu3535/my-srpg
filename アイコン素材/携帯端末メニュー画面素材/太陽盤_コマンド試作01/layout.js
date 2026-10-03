(function () {
  'use strict';
  const byId = id => document.getElementById(id), math = window.SolarLayout;
  let selected = 1, gap = 18, scale = 1, loaded = false, failed = false;
  const buttons = math.commands.map((command, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'command'; button.textContent = command.label;
    button.addEventListener('click', () => { selected = index; render(); });
    button.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
      selected = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + direction + 4) % 4;
      render(); buttons[selected].focus();
    });
    byId('command-layer').append(button); return button;
  });
  function render() {
    const slots = math.layout(gap, scale);
    slots.forEach((slot, index) => {
      Object.assign(buttons[index].style, { left: slot.left + 'px', top: slot.top + 'px', width: slot.width + 'px', height: slot.height + 'px' });
      buttons[index].setAttribute('aria-pressed', String(index === selected));
    });
    // コマンドの輪とは別レイヤーの角度。今回はアニメーションなし。
    byId('rays-rotor').style.transform = 'rotate(' + slots[selected].needleAngle + 'deg)';
    if (loaded && !failed) byId('status').textContent = '配置確認：' + math.commands[selected].label + '。4項目とも直接選択できます。';
  }
  function resize() {
    scale = byId('viewport').getBoundingClientRect().width / 844;
    byId('screen').style.setProperty('--scale', scale); render();
  }
  const observer = new ResizeObserver(resize); observer.observe(byId('viewport')); resize();
  function background() {
    const screen = byId('screen'), value = byId('background').value;
    screen.style.backgroundColor = value === 'gray' ? '#85878b' : '#ececeb';
    screen.style.backgroundImage = value === 'corridor' ? 'url("../太陽盤_試作02/corridor-reference.png")' : 'none';
    screen.style.setProperty('--ink', value === 'corridor' ? '#f2f2ec' : '#333739');
    screen.style.setProperty('--row', value === 'corridor' ? '#2d333bdc' : '#c8cbcc99');
    screen.style.setProperty('--rule', value === 'corridor' ? '#bdc4c577' : '#70767a66');
    const karima = byId('character').value === 'karima';
    screen.style.setProperty('--active', value === 'corridor' ? (karima ? '#425862ee' : '#67573eee') : (karima ? '#b3c8cecc' : '#c4b292cc'));
  }
  function theme() {
    const name = byId('character').value, palette = window.SolarCharacterColors.palette(name);
    byId('material-defs').innerHTML = window.SolarMaterials.filters(palette);
    document.documentElement.style.setProperty('--accent', name === 'karima' ? '#adc5ce' : '#bba077');
    ['disk', 'rays'].forEach(group => {
      byId(group + '-panes').style.filter = 'url(#solar-panes-material)';
      byId(group + '-panes').style.opacity = group === 'disk' ? .5 : .89;
      byId(group + '-frame').style.filter = palette.gold.original ? 'none' : 'url(#solar-frame-material)';
    });
    background();
  }
  byId('character').addEventListener('change', theme);
  byId('background').addEventListener('change', background);
  byId('gap').addEventListener('input', () => { gap = Number(byId('gap').value); byId('gap-value').textContent = gap + ' px'; render(); });
  let remaining = 4;
  ['disk', 'rays'].forEach(group => ['panes', 'frame'].forEach(part => {
    const img = byId(group + '-' + part); let settled = false;
    const finish = success => {
      if (settled) return; settled = true; failed ||= !success;
      if (--remaining !== 0) return;
      loaded = true; byId('loading').hidden = true; byId('error').hidden = !failed;
      if (failed) { byId('error').textContent = '太陽盤を読み込めません。隣の試作03フォルダの素材を確認してください。'; byId('status').textContent = '素材の読込に失敗しました。'; }
      render();
    };
    img.onload = () => finish(true); img.onerror = () => finish(false);
    img.src = '../太陽盤_試作03/' + group + '-' + part + '.png';
  }));
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  theme(); render();
})();
