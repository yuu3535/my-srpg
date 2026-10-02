(function (root) {
  'use strict';
  // 長文はシナリオではなく、文字の収まりを試すための文面。
  const lines = [
    { speaker: '携帯端末', text: '（携帯端末の音）' },
    { speaker: '表示確認', text: 'これは台詞の表示見本です。銀の質感を残した角飾りと、まっすぐな縁を別々に重ねています。' },
    { speaker: '表示確認', text: '長い台詞でも、飾りと文字が重ならないか確認します。ここに表示している文面は、正式なシナリオではありません。' }
  ];
  function makeState(index = 0) { return { index, entries: [index] }; }
  function advance(state) { const index = (state.index + 1) % lines.length; return { index, entries: [...state.entries, index] }; }
  function choose(state, index) { if (!Number.isInteger(index) || index < 0 || index >= lines.length) throw new RangeError('台詞の番号が範囲外です'); return { index, entries: [...state.entries, index] }; }
  const api = { lines, makeState, advance, choose };
  if (typeof module !== 'undefined') module.exports = api;
  else root.DialogueStudy = api;
})(typeof window !== 'undefined' ? window : globalThis);
