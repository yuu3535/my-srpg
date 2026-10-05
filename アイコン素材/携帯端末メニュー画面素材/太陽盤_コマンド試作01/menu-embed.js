/* 既存の回転輪を全体確認ページへ埋め込むための小さな橋渡し。通常表示では何もしない。 */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('embed') !== 'menu' || window.parent === window) return;
  const byId = id => document.getElementById(id);
  const images = ['disk-panes', 'disk-frame', 'rays-panes', 'rays-frame', 'wheel-panes'].map(byId);
  let previous = null;
  function send(force = false) {
    const button = byId('labels').querySelector('.command[aria-pressed="true"]');
    const selected = button ? Array.from(byId('labels').querySelectorAll('.command')).indexOf(button) : -1;
    const command = window.SolarWheel.commands[selected];
    const loading = images.some(image => !image.complete);
    const failed = images.some(image => image.complete && image.naturalWidth === 0);
    const state = { type: 'solar-menu-state', selected: command ? command.id : null, loading, failed };
    const signature = JSON.stringify(state);
    if (force || previous !== signature) { previous = signature; window.parent.postMessage(state, '*'); }
  }
  document.addEventListener('click', () => send());
  document.addEventListener('keydown', () => send());
  images.forEach(image => { image.addEventListener('load', () => send()); image.addEventListener('error', () => send()); });
  window.addEventListener('message', event => {
    // file:のoriginはnullなので、通信先ウィンドウと受け入れる値を限定する。
    if (event.source !== window.parent || !event.data || event.data.type !== 'solar-menu-config') return;
    const config = event.data;
    if (['alche', 'karima'].includes(config.character) && byId('character').value !== config.character) {
      byId('character').value = config.character;
      byId('character').dispatchEvent(new Event('change'));
    }
    if (typeof config.effects === 'boolean' && byId('selection-effects').checked !== config.effects) {
      byId('selection-effects').checked = config.effects;
      byId('selection-effects').dispatchEvent(new Event('change'));
    }
    const index = window.SolarWheel.commands.findIndex(command => command.id === config.select);
    if (index >= 0) byId('labels').querySelectorAll('.command')[index].click();
    send(true);
  });
  send(true);
})();
