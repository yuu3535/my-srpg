(function (root) {
  'use strict';
  // 構図と話者切替の確認専用。キャラの台詞・性格・本編のシナリオではない。
  const lines = [
    { speaker: 'アルシェ', side: 'left', text: '左右の立ち絵と、上の台詞枠。\nこれは会話画面の表示見本です。' },
    { speaker: 'カリマ', side: 'right', text: '話す人が切り替わると、立ち絵の明るさも変わります。背景とSDキャラは元の位置のままです。' },
    { speaker: 'アルシェ', side: 'left', text: '長い文章の表示テストです。文字を小さくして一度に詰め込まず、数行ずつ送って読めるようにしています。台詞の続きを表示している間は、話者と立ち絵は変わりません。ログでは分割前の全文を確認できます。これは正式なシナリオやキャラクターの台詞ではありません。' },
    { speaker: 'ナレーション', side: 'none', text: '話者のない文章の表示テストです。\nこのときは吹き出しの尾を出しません。' }
  ];
  function makeState(index = 0) { return { index, entries: [index] }; }
  function advance(state) { const index = (state.index + 1) % lines.length; return { index, entries: [...state.entries, index] }; }
  function choose(state, index) {
    if (!Number.isInteger(index) || index < 0 || index >= lines.length) throw new RangeError('台詞の番号が範囲外です');
    return { index, entries: [...state.entries, index] };
  }
  // ナレーションでは人物をどちらも通常表示にし、片方を話者として示さない。
  function isHighlighted(speakerSide, portraitSide) {
    return !['left', 'right'].includes(speakerSide) || speakerSide === portraitSide;
  }
  // 枠と尾を一度に描き、接ぎ目の二重線・半透明下地の重なりを防ぐ。
  function framePath(width, height, radius, side, offset = 0) {
    if (![width, height, radius, offset].every(Number.isFinite) || width < 120 || height < 40 || radius < 0) throw new RangeError('枠の大きさが不正です');
    const x = width - .5, y = height - .5;
    const r = Math.min(radius, (width - 36) / 2, (height - 1) / 2);
    // 丸い角に尾の基部が重ならない範囲で、話者側の端から内側へ移す。
    const near = r + 6 + Math.max(0, Math.min(offset, width - 2 * r - 36)), far = near + 23;
    const tail = side === 'left' ? `H ${far} L ${near - 6} ${y + 18} L ${near} ${y}`
      : side === 'right' ? `H ${width - near} L ${width - near + 6} ${y + 18} L ${width - far} ${y}` : '';
    return `M ${r + .5} .5 H ${x - r} Q ${x} .5 ${x} ${r + .5} V ${y - r} Q ${x} ${y} ${x - r} ${y} ${tail} H ${r + .5} Q .5 ${y} .5 ${y - r} V ${r + .5} Q .5 .5 ${r + .5} .5 Z`;
  }
  // 実際の書体の計測関数を受け取り、DOMに依存せず行とページを分ける。
  function paginate(text, width, rows, measure = value => Array.from(value).length) {
    if (!(width > 0) || !Number.isInteger(rows) || rows < 1) throw new RangeError('ページの大きさが不正です');
    const wrapped = [];
    for (const paragraph of text.split('\n')) {
      let row = '';
      for (const char of Array.from(paragraph)) {
        if (row && measure(row + char) > width) { wrapped.push(row); row = ''; }
        row += char;
      }
      wrapped.push(row);
    }
    const pages = [];
    for (let i = 0; i < wrapped.length; i += rows) pages.push(wrapped.slice(i, i + rows).join('\n'));
    return pages;
  }
  const api = { lines, makeState, advance, choose, paginate, isHighlighted, framePath };
  if (typeof module !== 'undefined') module.exports = api;
  else root.PortraitDialogueStudy = api;
})(typeof window !== 'undefined' ? window : globalThis);
