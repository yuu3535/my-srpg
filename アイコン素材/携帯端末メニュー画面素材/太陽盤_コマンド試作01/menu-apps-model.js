/* 横844×390のアプリホーム見本。ゲームの状態・進行へは接続しない。 */
(function (root) {
  'use strict';
  const assetRoot = '../アプリアイコン_清書01/';
  const boxes = Object.freeze({
    apps: Object.freeze({ left: 340, top: 52, width: 450, height: 99 }),
    map: Object.freeze({ left: 345, top: 166, width: 440, height: 166 }),
    tip: Object.freeze({ left: 350, top: 343, width: 430, height: 28 }),
    time: Object.freeze({ left: 643, top: 0, width: 160, height: 52 })
  });
  const beta = Object.freeze({ visible: true, size: 33, x: 78, y: 21, angle: 18 });
  const apps = Object.freeze({
    preparation: Object.freeze({ label:'身支度', src:assetRoot+'preparation-icon-v01.png', tip:'持ち物・装備を整え、仲間の詳細ステータスを確認する', detail:'持ち物整理と装備をまとめる入口です。ここから仲間の詳細ステータスへ進む方針です。' }),
    wallet: Object.freeze({ label:'ウォレット', src:assetRoot+'wallet-icon-v01.png', tip:'現在の所持金を確認する', detail:'残金をホーム画面で確認するためのアプリです。残金の実データは未接続のため「—」で表示しています。' }),
    renown: Object.freeze({ label:'名声', src:assetRoot+'renown-icon-v01.png', tip:'名声値と、このマップでスカウトできる仲間を確認する', detail:'名声値と、このマップでスカウトできる仲間を確認する入口です。実データとスカウト処理は未接続です。' }),
    fortune: Object.freeze({ label:'運命予報', src:assetRoot+'fortune-icon-v01.png', tip:'今月の運命予報を読む', detail:'ヘンリーとラディンが作ったβ版の占いアプリです。' }),
    ouroboros: Object.freeze({ label:'？？？', src:assetRoot+'ouroboros-style-match-v01.png', tip:'後から追加される、謎のアプリ', detail:'開始時には表示されない謎のアプリです。報酬や解放条件の詳細は未確定です。' })
  });
  function app(id) { return Object.hasOwn(apps,id) ? apps[id] : null; }
  const api = Object.freeze({ boxes, beta, apps, app });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SolarMenuApps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
