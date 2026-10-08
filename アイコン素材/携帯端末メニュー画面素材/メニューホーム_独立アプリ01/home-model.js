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
  // カリマの明るい案は2026-10-09原作者指定JSONの色。本編／Unityへの反映は別作業。
  const themeDefaults=Object.freeze({alche:Object.freeze({background:'#1c1d1f',backing:'#d3ad59',ornament:'#b9ad8c',text:'#eceff2'}),karima:Object.freeze({background:'#e7eef3',backing:'#7194ae',ornament:'#142a48',text:'#000000'})});
  const karimaDarkTheme=Object.freeze({background:'#181c22',backing:'#a8bac7',ornament:'#97a8ba',text:'#eceff2'});
  // 原作者の保存前のスクショの色見本から採色。失われた設定値の完全な復旧保証ではない。
  const karimaRecoveredTheme=Object.freeze({background:'#f6fafe',text:'#000000',backing:'#7194ae',ornament:'#22257c'});
  function themeMode(who,value) { return owner(who)==='karima'&&value!=='dark'?'light':'dark'; }
  function theme(who,values={},mode='light') {
    const defaults=owner(who)==='karima'&&themeMode(who,mode)==='dark'?karimaDarkTheme:themeDefaults[owner(who)];
    return Object.fromEntries(Object.keys(defaults).map(key=>[key,typeof values?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(values[key])?values[key].toLowerCase():defaults[key]]));
  }
  function ornamentSize(value) { const number=Number(value);return Number.isFinite(number)&&number>=24&&number<=64?number:36; }
  function ornamentInset(value) { const number=Number(value);return Number.isFinite(number)&&number>=0&&number<=24?number:0; }
  const settingsSchema='solar-independent-home-settings-v01';
  const settingsStorageKey='solar-independent-home-settings-v01';
  // 保存と読み込みは同じ検査を通す。知らない形式／不正な値を現在の設定へ混ぜない。
  function settings(value) {
    const record=item=>Boolean(item&&typeof item==='object'&&!Array.isArray(item));
    const range=(item,min,max)=>typeof item==='number'&&Number.isFinite(item)&&item>=min&&item<=max;
    const choices=(item,list)=>typeof item==='string'&&list.includes(item);
    const boolean=item=>typeof item==='boolean';
    if(!record(value)||value.schema!==settingsSchema||value.referenceResolution?.width!==844||value.referenceResolution?.height!==390)return null;
    if(!choices(value.selectedOwner,['alche','karima'])||value.ownerModes?.alche!=='dark'||!choices(value.ownerModes?.karima,['light','dark']))return null;
    const themes={alche:{},karima:{}};
    for(const [who,mode] of [['alche','dark'],['karima','light'],['karima','dark']]) {
      const colors=value.ownerThemes?.[who]?.[mode];
      if(!record(colors)||!['background','backing','ornament','text'].every(key=>typeof colors[key]==='string'&&/^#[0-9a-f]{6}$/i.test(colors[key])))return null;
      themes[who][mode]=theme(who,colors,mode);
    }
    const corner=value.corner,preview=value.preview,forecastSettings=value.forecast;
    if(!record(corner)||!range(corner.size,24,64)||!range(corner.inset,0,24)||!boolean(value.showAppNames))return null;
    if(!record(preview)||!choices(preview.phase,['morning','day','evening','night'])||!choices(preview.stage,['prologue','after'])||!choices(preview.noticeKind,Object.keys(forecasts))||!['mystery','effects','frame'].every(key=>boolean(preview[key])))return null;
    if(!record(forecastSettings)||!range(forecastSettings.before,1,12)||!range(forecastSettings.after,1,12)||!range(forecastSettings.fontLimit,12,13.5)||!boolean(forecastSettings.play)||!boolean(forecastSettings.autoFont))return null;
    return {schema:settingsSchema,referenceResolution:{width:844,height:390},selectedOwner:value.selectedOwner,ownerModes:{alche:'dark',karima:value.ownerModes.karima},ownerThemes:themes,corner:{size:corner.size,inset:corner.inset},showAppNames:value.showAppNames,preview:{phase:preview.phase,stage:preview.stage,noticeKind:preview.noticeKind,mystery:preview.mystery,effects:preview.effects,frame:preview.frame},forecast:{before:forecastSettings.before,after:forecastSettings.after,fontLimit:forecastSettings.fontLimit,play:forecastSettings.play,autoFont:forecastSettings.autoFont}};
  }
  function readSettings(text) {
    if(typeof text!=='string'||text.length>65536)throw new Error('設定JSONが大きすぎるか、文字列ではありません。');
    let value;try { value=JSON.parse(text); } catch { throw new Error('JSONを読めません。保存した設定ファイルの内容を確認してください。'); }
    const result=settings(value);
    if(!result)throw new Error('このホーム用の設定ではないか、色・数値などが範囲外です。今の設定は変更しません。');
    return result;
  }
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
  const forecastOrder=Object.freeze(['story','sale','support','encounter']);
  function nextForecast(kind) { return forecastOrder[(forecastOrder.indexOf(kind)+1)%forecastOrder.length]; }
  function readingSeconds(value,fallback) { const number=Number(value);return Number.isFinite(number)&&number>=1&&number<=12?number:fallback; }
  function noticeFontLimit(value) { const number=Number(value);return Number.isFinite(number)&&number>=12&&number<=13.5?number:13.5; }
  // わずかなはみ出しだけ縮める。読みやすさの下限12pxより小さくしない。
  function noticeFontSize(textWidth,viewportWidth,limit=13.5) {
    const base=noticeFontLimit(limit);
    if(!Number.isFinite(textWidth)||!Number.isFinite(viewportWidth)||textWidth<=0||viewportWidth<=0||textWidth<=viewportWidth)return base;
    return Math.max(12,Math.min(base,Math.floor(base*viewportWidth/textWidth*10)/10));
  }
  // 先頭と末尾を静止して読む。収まる文は動かさず、同じ合計時間を取る。
  // 画面の拡大率ではなく、内部844×390のCSS pxを基準に一定速度へ。
  function ticker(textWidth,viewportWidth,before=5,after=3) {
    if(!Number.isFinite(textWidth)||!Number.isFinite(viewportWidth)||textWidth<=0||viewportWidth<=0)return null;
    const distance=Math.max(0,textWidth-viewportWidth);
    const holdBefore=readingSeconds(before,5),holdAfter=readingSeconds(after,3),duration=distance/28;
    return {distance,duration,before:holdBefore,after:holdAfter,total:holdBefore+duration+holdAfter};
  }
  function tickerState(plan,elapsed) {
    if(!plan)return {phase:'static',offset:0,done:false};
    const seconds=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
    if(seconds>=plan.total)return {phase:'after',offset:-plan.distance,done:true};
    if(!plan.distance)return {phase:'reading',offset:0,done:false};
    if(seconds<plan.before)return {phase:'before',offset:0,done:false};
    if(seconds<plan.before+plan.duration)return {phase:'scroll',offset:-(seconds-plan.before)*28,done:false};
    return {phase:'after',offset:-plan.distance,done:false};
  }
  const api=Object.freeze({owners,forecasts,owner,themeDefaults,karimaDarkTheme,karimaRecoveredTheme,themeMode,theme,ornamentSize,ornamentInset,settingsSchema,settingsStorageKey,settings,readSettings,forecast,presentation,fit,appBetaSize,ticker,tickerState,forecastOrder,nextForecast,readingSeconds,noticeFontLimit,noticeFontSize});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IndependentHomeModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
