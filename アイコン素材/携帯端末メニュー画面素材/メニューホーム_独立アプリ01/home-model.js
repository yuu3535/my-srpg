/* シナリオ接続のない表示見本。原作者決定事項と仮文を区別する。 */
(function(root) {
  'use strict';
  const owners=Object.freeze({alche:{name:'アルシェ',from:'カリマ',message:'もう訓練場にいるから早く来て。'},karima:{name:'カリマ',from:'アルシェ',message:'いま起きた！すぐ行く！'}});
  const forecasts=Object.freeze({
    story:{label:'章のヒント',copy:'失せモノに注意。笑う声が聞こえたら、振り返らないこと。',detail:'運勢：蛇\n\n章の重要な局面のヒントとして読む、運命予報の見本です。下の縦書きカードに既存の本文を表示します。章データによる更新は未接続です。'},
    sale:{label:'セール',copy:'武器屋と道具屋がセール中。',detail:'武器屋と道具屋がセール中。\n\n対象の店・商品、期間、値引きの割合：未設定。\n表示見本です。本編では実際の値引きに効く方針ですが、この試作は価格を変えません。'},
    support:{label:'飯屋',copy:'飯屋で支援値を上げやすいイベント。',detail:'飯屋で支援値を上げやすいイベント。\n\n対象の店・仲間、開催期間、発生条件：未設定。\n表示見本です。本編では支援値に効く方針ですが、この試作は支援値を変更しません。'},
    encounter:{label:'遭遇戦',copy:'遭遇戦にレアな敵が現れるらしい。',detail:'遭遇戦にレアな敵が現れるらしい。\n\n対象の場所・敵、出現条件：未設定。\n表示見本です。本編では出現に効く方針ですが、この試作は戦闘や敵を生成しません。'},
    none:{label:'予報なし',copy:'今は新しい予報がありません。',detail:'今は新しい予報がありません。\n\n予報がない状態の表示見本です。次の章や局面で更新する処理は未接続です。'}
  });
  function owner(value) { return Object.hasOwn(owners,value)?value:'alche'; }
  function forecast(kind) { const key=Object.hasOwn(forecasts,kind)?kind:'story';return {key,...forecasts[key]}; }
  function presentation(who,stage,kind) {
    const selected=owners[owner(who)];
    if(stage!=='after')return {chapter:'プロローグ',place:'オルクス城・回廊',from:selected.from,copy:selected.message,period:'朝',task:'ギュンターとの演習（訓練場）',detail:selected.message+'\n\nプロローグのメッセージ見本です。百年戦争の時代へ飛んだ後は二人の通信は使えません。',after:false};
    const value=forecast(kind);
    // 表示先をアプリへまとめる試作。情報が届く仕組みや送り主の変更は決定しない。
    return {chapter:'時遊びのあと',place:'章の場所（見本）',from:'運命予報',copy:value.copy,period:value.label,task:'届いたタスクを確認する',detail:value.detail,after:true};
  }
  function fit(width,height,framed=false) { return Math.max(0,Math.min(width/844,height/(framed?844*874/1799:390))); }
  // このホームの小さいアプリ表示用。素材比較ページの保存値は上書きしない。
  const appBetaSize=40;
  // 画面の拡大率ではなく、内部844×390のCSS pxを基準に一定速度へ。
  function ticker(textWidth,viewportWidth) {
    if(!Number.isFinite(textWidth)||!Number.isFinite(viewportWidth)||textWidth<=0||viewportWidth<=0)return null;
    const distance=Math.max(textWidth,viewportWidth)+48;
    return {distance,duration:distance/28};
  }
  const api=Object.freeze({owners,forecasts,owner,forecast,presentation,fit,appBetaSize,ticker});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IndependentHomeModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
