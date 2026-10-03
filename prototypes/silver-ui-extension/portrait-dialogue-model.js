(function (root) {
  'use strict';
  // 構図と話者切替の確認専用。キャラの台詞・性格・本編のシナリオではない。
  const lines = [
    { speaker: 'アルシェ', side: 'left', text: '左右の立ち絵と、上の台詞枠。\nこれは会話画面の表示見本です。' },
    { speaker: 'カリマ', side: 'right', text: '話す人が切り替わると、立ち絵の明るさも変わります。背景とSDキャラは元の位置のままです。' },
    { speaker: 'アルシェ', side: 'left', text: '長い文章の表示テストです。文字を小さくして一度に詰め込まず、数行ずつ送って読めるようにしています。台詞の続きを表示している間は、話者と立ち絵は変わりません。ログでは分割前の全文を確認できます。これは正式なシナリオやキャラクターの台詞ではありません。' }
  ];
  function makeState(index = 0) { return { index, entries: [index] }; }
  function advance(state) { const index = (state.index + 1) % lines.length; return { index, entries: [...state.entries, index] }; }
  function choose(state, index) {
    if (!Number.isInteger(index) || index < 0 || index >= lines.length) throw new RangeError('台詞の番号が範囲外です');
    return { index, entries: [...state.entries, index] };
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
  const api = { lines, makeState, advance, choose, paginate };
  if (typeof module !== 'undefined') module.exports = api;
  else root.PortraitDialogueStudy = api;
})(typeof window !== 'undefined' ? window : globalThis);
