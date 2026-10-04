/* 時間帯の透過素材と状態。ゲームの時刻やDOMには依存しない。 */
(function (root) {
  'use strict';
  const phases = Object.freeze({
    morning: Object.freeze({ label: '朝', description: '一度だけ日が昇り、その後は水平線に光が流れます。' }),
    day: Object.freeze({ label: '昼', description: '光が広がり、左右のきらめきが大小に変化します。' }),
    evening: Object.freeze({ label: '夕方', description: '一度だけ日が沈み、水平線に残った光が流れます。' }),
    night: Object.freeze({ label: '夜', description: '反対向きの月と、大小に変わる星のまたたきです。' })
  });
  function validPhase(value) {
    return Object.prototype.hasOwnProperty.call(phases, value);
  }
  function createState() {
    return { phase: 'evening', paused: false, reduced: false, hidden: false, replay: 0 };
  }
  function change(state, action) {
    switch (action.type) {
      case 'phase':
        if (!validPhase(action.value) || action.value === state.phase) return state;
        return { ...state, phase: action.value, replay: state.replay + 1 };
      case 'replay':
        return state.reduced ? state : { ...state, replay: state.replay + 1 };
      case 'pause': return { ...state, paused: !state.paused };
      case 'reduce': return { ...state, reduced: Boolean(action.value) };
      case 'visibility': return { ...state, hidden: Boolean(action.value) };
      default: return state;
    }
  }
  function playback(state) {
    return state.paused || state.hidden ? 'paused' : 'running';
  }
  // 生成した原寸PNGを変更せず、部品の矩形だけ切り出して表示する。
  const art = Object.freeze({ src: 'time-of-day-art/time-icons-atlas-v01.png?v=20261005a', width: 1254, height: 1254 });
  const rects = Object.freeze({
    disc: [881, 320, 993, 431], moon: [849, 818, 998, 1045],
    morningRays: [[319,199,329,364],[165,278,246,382],[396,278,480,381],[117,375,212,415],[433,373,526,414]],
    morningHorizon: [[79,451,188,459],[198,451,259,459],[390,451,450,459],[460,451,569,459]],
    morningGlint: [271,455,376,467],
    eveningRays: [[96,930,257,939],[402,930,570,940],[157,956,237,965],[419,956,504,965]],
    eveningHorizon: [[74,985,187,994],[196,985,259,994],[392,985,455,994],[466,985,585,994]],
    eveningGlint: [272,990,377,1002],
    dayRays: [[932,180,942,294],[932,457,942,557],[747,370,857,379],[1018,370,1127,379],[817,263,875,319],[1000,262,1058,319],[816,433,875,490],[1000,434,1058,490]],
    dayStars: [[679,351,729,403],[1144,351,1195,402]],
    nightStars: [[735,900,799,968],[1078,899,1141,969]]
  });
  function destination(rect, anchor, center, scale) {
    return [center[0] + (rect[0] - anchor[0]) * scale, center[1] + (rect[1] - anchor[1]) * scale,
      (rect[2] - rect[0]) * scale, (rect[3] - rect[1]) * scale];
  }
  function piece(rect, dest, name = '') {
    const w = rect[2] - rect[0], h = rect[3] - rect[1];
    const number = (value) => Number(value.toFixed(5));
    return `<span class="art-piece ${name}" style="left:${number(dest[0] / 160 * 100)}%;top:${number(dest[1] / 64 * 100)}%;width:${number(dest[2] / 160 * 100)}%;height:${number(dest[3] / 64 * 100)}%"><img src="${art.src}" alt="" draggable="false" style="left:${number(-rect[0] / w * 100)}%;top:${number(-rect[1] / h * 100)}%;width:${number(art.width / w * 100)}%;height:${number(art.height / h * 100)}%"></span>`;
  }
  function group(name, content) { return `<span class="art-group ${name}">${content}</span>`; }
  function icon(phase, instance) {
    if (!validPhase(phase)) throw new RangeError('不明な時間帯です。');
    if (!/^[a-z][a-z0-9-]*$/.test(instance)) throw new TypeError('見本識別子が不正です。');
    let shape;
    if (phase === 'morning' || phase === 'evening') {
      const anchor = phase === 'morning' ? [324,455] : [328,990];
      const render = (rect) => piece(rect, destination(rect, anchor, [80,57], .21));
      // 水平線の下を隠した同じ太陽素材で、日の出と日没を一度だけ再生する。
      shape = group('sky-clip', group('sun-travel', piece(rects.disc, [64,39.5,32,32]))) +
        group('dawn-rays', rects[phase + 'Rays'].map(render).join('')) +
        group('horizon', rects[phase + 'Horizon'].map(render).join('')) +
        group('horizon-glint', render(rects[phase + 'Glint']));
    } else if (phase === 'day') {
      const render = (rect, name) => piece(rect, destination(rect, [937,375], [80,32], .15), name);
      shape = render(rects.disc) + group('rays', rects.dayRays.map((rect) => render(rect)).join('')) +
        rects.dayStars.map((rect, index) => render(rect, 'twinkle star-' + (index ? 'b' : 'a'))).join('');
    } else {
      const render = (rect, name) => piece(rect, destination(rect, [930,932], [80,32], .22), name);
      // 右側が明るく、左側に開く月。素材自体が作者確認済みの向き。
      shape = render(rects.moon, 'moon') + rects.nightStars.map((rect, index) =>
        render(rect, 'twinkle star-' + (index ? 'b' : 'a'))).join('');
    }
    return `<span class="time-icon" data-phase="${phase}" data-instance="${instance}" aria-hidden="true">${shape}</span>`;
  }
  const api = Object.freeze({ phases, validPhase, createState, change, playback, icon, art, rects, destination });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TimeOfDay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
