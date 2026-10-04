/* 選択札のAPNGと粒子だけを管理する。本編・輪の回転処理からは独立。 */
(function (root) {
  'use strict';
  const source = 'fx/command-flame-selection-v01-ignite.apng';
  const holdSource = 'fx/command-flame-selection-v01-hold.apng';
  const extinguishSource = 'fx/command-flame-selection-v01-extinguish.apng';
  const ignitionMs = 180;
  const extinguishMs = 200;
  const defaults = { flame: { size: 81, opacity: 83, x: -12, y: 11 },
    colors: { alche: { hue: 4, saturation: 138, brightness: 120 }, karima: { hue: 216, saturation: 171, brightness: 100 } } };
  const palettes = {
    alche: { name: 'gold', channels: ['0.357 0.647 0.831 0.949 1', '0.278 0.537 0.725 0.863 0.961', '0.106 0.231 0.333 0.553 0.847'], spark: '#eed784', core: '#fff6dc' },
    karima: { name: 'portrait', channels: ['0.160 0.205 0.265 0.425 0.792', '0.140 0.240 0.370 0.580 0.859', '0.360 0.635 0.815 0.925 1'], spark: '#9ca6ef', core: '#d9e1ff' }
  };
  const seeds = [
    [140, 155, 2.4, 14, -54, 'early'], [154, 144, 2, -4, -67, 'early'],
    [168, 136, 2.6, 20, -43, 'middle'], [130, 156, 1.9, 30, -44, 'middle'],
    [160, 120, 2.2, 10, -48, 'late'], [173, 132, 2, 16, -52, 'late']
  ];
  function filter(character, color, defaults) {
    if (!Object.hasOwn(palettes, character)) throw new Error('未対応の炎色');
    // 作者の既存数値は残し、確認済みのAPNG配色を基準に差分だけ微調整する。
    return 'url(#command-burn-' + character + ') hue-rotate(' + (color.hue - defaults.hue) + 'deg) saturate(' + (color.saturation / defaults.saturation) + ') brightness(' + (color.brightness / defaults.brightness) + ')';
  }
  function create({ document: doc, nodes, host, changed, schedule = setTimeout, cancel = clearTimeout }) {
    let disposed = false, active = -1, serial = 0, sparksEnabled = true;
    let timer = null, outgoing = -1, exitTimer = null, exitSerial = 0;
    const state = { ready: false, failed: false, exitReady: false, exitFailed: false };
    const svg = (tag, attrs) => {
      const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
      return node;
    };
    const defs = svg('svg', { class: 'defs', 'aria-hidden': 'true', focusable: 'false' });
    defs.innerHTML = '<defs>' + Object.entries(palettes).map(([key, value]) =>
      '<filter id="command-burn-' + key + '" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/><feComponentTransfer>' +
      value.channels.map((table, index) => '<feFunc' + ['R', 'G', 'B'][index] + ' type="table" tableValues="' + table + '"/>').join('') +
      '<feFuncA type="identity"/></feComponentTransfer></filter>').join('') + '</defs>';
    host.append(defs);
    const parts = nodes.map(node => {
      const art = doc.createElement('img'); art.className = 'selection-burn-art';
      art.alt = ''; art.draggable = false; art.hidden = true;
      const field = svg('svg', { class: 'command-sparks', viewBox: '0 0 192 192', 'aria-hidden': 'true', focusable: 'false', hidden: '' });
      seeds.forEach(([x, y, radius, drift, rise, phase], index) => {
        const group = svg('g', { class: 'command-spark command-spark-' + phase });
        group.style.setProperty('--drift', drift + 'px'); group.style.setProperty('--rise', rise + 'px');
        group.append(svg('circle', { class: 'command-spark-halo', cx: x, cy: y, r: radius * 2.6 }));
        if (index === 1 || index === 4) group.append(svg('path', { class: 'command-spark-trail', d: 'M' + x + ',' + y + ' l-2,6', fill: 'none' }));
        group.append(svg('circle', { class: 'command-spark-core', cx: x, cy: y, r: radius }));
        field.append(group);
      });
      node.flame.append(art, field);
      return { art, field, loaded: false };
    });
    function syncSparks(restart = false) {
      parts.forEach((part, index) => {
        const visible = index === active && part.loaded && sparksEnabled && !disposed;
        if (visible) part.field.removeAttribute('hidden'); else part.field.setAttribute('hidden', '');
        if (visible && restart && typeof part.field.getAnimations === 'function') {
          part.field.getAnimations({ subtree: true }).forEach(animation => { animation.currentTime = 0; });
        }
      });
    }
    function clearPart(index) {
      if (index < 0) return;
      const part = parts[index];
      part.loaded = false; part.art.onload = null; part.art.onerror = null;
      part.art.hidden = true; part.art.removeAttribute('src');
      part.field.setAttribute('hidden', ''); nodes[index].flameArt.hidden = false;
      nodes[index].flame.classList.remove('is-lit');
    }
    function stopActive() {
      serial++;
      if (timer !== null) { cancel(timer); timer = null; }
      clearPart(active); active = -1;
    }
    function stopOutgoing() {
      exitSerial++;
      if (exitTimer !== null) { cancel(exitTimer); exitTimer = null; }
      clearPart(outgoing); outgoing = -1;
    }
    function stop() { stopActive(); stopOutgoing(); }
    function extinguish() {
      // 連打でも消火中の札は最大1つ。見えていない点火待ちは即時停止する。
      stopOutgoing();
      if (active < 0 || !parts[active].loaded || !state.exitReady || disposed) { stopActive(); return -1; }
      serial++;
      if (timer !== null) { cancel(timer); timer = null; }
      outgoing = active; active = -1;
      const index = outgoing, part = parts[index], token = ++exitSerial;
      part.loaded = false; part.field.setAttribute('hidden', '');
      part.art.onload = () => {
        if (disposed || outgoing !== index || token !== exitSerial) return;
        part.art.onload = null; part.art.hidden = false;
        exitTimer = schedule(() => {
          if (disposed || outgoing !== index || token !== exitSerial) return;
          exitTimer = null; stopOutgoing();
        }, extinguishMs);
      };
      part.art.onerror = () => {
        if (disposed || outgoing !== index || token !== exitSerial) return;
        state.exitReady = false; state.exitFailed = true; stopOutgoing(); changed();
      };
      part.art.src = extinguishSource + '?exit=' + token;
      return index;
    }
    function play(index) {
      // 新札の点火で、旧札の短い消火を打ち切らない。ただし同じ札へ戻ったら解除。
      stopActive();
      if (outgoing === index) stopOutgoing();
      if (!state.ready || disposed || !parts[index]) return;
      active = index; const part = parts[index]; const token = ++serial;
      nodes[index].flame.classList.add('is-lit');
      nodes[index].flameArt.hidden = true;
      part.art.onload = () => {
        if (disposed || active !== index || token !== serial) return;
        part.loaded = true; part.art.hidden = false; syncSparks(true);
        // 点火は一度だけ。選択中は消火・透明コマのない中炎APNGへ移る。
        part.art.onload = null;
        timer = schedule(() => {
          timer = null;
          if (disposed || active !== index || token !== serial) return;
          part.art.src = holdSource + '?selection=' + token;
        }, ignitionMs);
      };
      part.art.onerror = () => {
        if (disposed || active !== index || token !== serial) return;
        state.ready = false; state.failed = true; stop(); changed();
      };
      // 再選択は点火から。隠れた札にはAPNGのsrcを持たせず、常時再生を増やさない。
      part.art.src = source + '?selection=' + token;
    }
    let remaining = 2;
    const preloaders = [source, holdSource, extinguishSource].map(src => {
      const image = doc.createElement('img');
      let settled = false;
      const finish = success => {
        if (disposed || settled) return; settled = true;
        image.onload = null; image.onerror = null; image.removeAttribute('src');
        if (src === extinguishSource) {
          state.exitReady = success; state.exitFailed = !success; changed(); return;
        }
        state.failed ||= !success;
        if (--remaining === 0) { state.ready = !state.failed; changed(); }
      };
      image.onload = () => finish(true); image.onerror = () => finish(false); image.src = src;
      return image;
    });
    return { state, play, stop, extinguish, setSparks(enabled) { sparksEnabled = enabled; syncSparks(); },
      dispose() { disposed = true; stop(); preloaders.forEach(image => { image.onload = null; image.onerror = null; image.removeAttribute('src'); }); } };
  }
  const api = { source, holdSource, extinguishSource, ignitionMs, extinguishMs, defaults, palettes, seeds, filter, create };
  if (typeof module !== 'undefined') module.exports = api;
  if (root) root.SolarCommandBurning = api;
})(typeof window !== 'undefined' ? window : null);
