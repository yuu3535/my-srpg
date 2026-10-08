// 静的参照・DOM代替の単体テスト。ブラウザ描画検査ではない。
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('./home-model.js'),{mount}=require('./home.js');
const apps=require('../太陽盤_コマンド試作01/menu-apps-model.js'),wheel=require('../太陽盤_コマンド試作01/menu-preview-model.js');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'home.css'),'utf8');
for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(path.resolve(__dirname,ref.replaceAll('&amp;','&').split(/[?#]/)[0])),ref);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);
for(const file of ['home.js','home-model.js'])new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'));
assert.equal([...html.matchAll(/data-home-app="/g)].length,5);
assert.ok(!html.includes('src="../太陽盤_コマンド試作01/menu-preview.js'),'旧説明チップ処理を二重に読み込まない');
assert.ok(!html.includes('class="dock"'),'大きなドック箱を置かない');
assert.ok(css.includes('.independent-apps')&&css.includes('background:transparent; border:0;'));
function rule(selector) {
  const prefix=selector+' {';return css.slice(css.indexOf(prefix)+prefix.length,css.indexOf('}',css.indexOf(prefix)));
}
const artRule=rule('.app-art'),timeRule=rule('.home-time');
const commandSource=fs.readFileSync(path.join(__dirname,'../太陽盤_コマンド試作01/layout.html'),'utf8');
const commandFont=commandSource.match(/\.command \{[^}]*font-family:\s*([^;]+);/)[1].replace(/\s/g,'');
const homeFont=css.match(/--home-font:([^;]+);/)[1].replace(/\s/g,'');
assert.equal(homeFont,commandFont,'ホームと太陽盤コマンドのフォント・フォールバック順を一致させる');
assert.ok(rule('.independent-home').includes('font-family:var(--home-font);')&&rule('.independent-home').includes('font-synthesis:none;'));
assert.ok(rule('.notice-beta').includes('var(--home-font)')&&rule('.app-metric').includes('var(--home-font)'),'上書きされる小文字も統一');
assert.ok(rule('#home-dialog').includes('font-family:var(--home-font);'),'iframe外の詳細画面も統一');
assert.ok(!css.includes('Consolas')&&!css.includes("'Yu Gothic UI'"),'ホーム専用CSSの書体の混在をなくす');
assert.ok(artRule.includes('width:64px; height:64px;'),'下地の基本サイズは変えない');
assert.ok(artRule.includes('border-radius:0;')&&artRule.includes('background:rgb(13 15 17 / .6);'),'透ける黒の正方形');
assert.ok(artRule.includes('box-shadow:var(--app-backing-offset) var(--app-backing-offset) 0 0 var(--app-backing-color);'),'金は右下へずれた平坦な下地だけ');
assert.ok(css.includes('--app-backing-offset:4px;')&&css.includes('--app-backing-color:#d3ad59;'));
assert.ok(timeRule.includes('border:0;')&&timeRule.includes('background:transparent;')&&timeRule.includes('box-shadow:none;'),'時間帯アイコンの囲いを外す');
assert.ok(timeRule.includes('width:110px; height:38px;')&&timeRule.includes('padding:3px 6px;'),'時間帯の絵の表示寸法を維持');
const wallpaper=fs.readFileSync(path.join(__dirname,'home-wallpaper-stars-v01.png'));
assert.equal(wallpaper.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(wallpaper.readUInt32BE(16),1844);assert.equal(wallpaper.readUInt32BE(20),853);
assert.ok(Math.abs(1844/853-844/390)<.003,'生成素材は横844×390とほぼ同じ比率');
assert.ok(html.includes('src="home-wallpaper-stars-v01.png?v=20261008a"'),'壁紙だけの独立素材を参照');
assert.ok(!html.includes('class="home-shade"'),'隅の装飾を旧写真用の色かぶせで暗くしない');
assert.ok(rule('.home-wallpaper').includes('filter:none;')&&rule('.home-wallpaper').includes('pointer-events:none;'));
assert.ok(rule('.independent-home').includes('background:#1c1d1f;'),'画像未読込時も無地の炭色');
assert.ok(rule('.home-right').includes('left:338px; top:0px; width:494px; height:390px;'),'生成見本の配置変更は取り込まない');
assert.ok(rule('.home-map').includes('top:82px; width:494px; height:190px;'),'マップ位置・サイズを維持');
assert.ok(html.includes('class="home-map-frame"')&&html.includes('src="map-frame-silver-gold-v01.png?v=20261008a"'),'景色と飾り枠の別素材');
const frameAsset=fs.readFileSync(path.join(__dirname,'map-frame-silver-gold-v01.png'));
assert.equal(frameAsset.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(frameAsset.readUInt32BE(16),2022);assert.equal(frameAsset.readUInt32BE(20),778);assert.equal(frameAsset[25],6,'透過を保持したRGBA');
assert.ok(rule('.home-map>.home-map-frame').includes('pointer-events:none;'),'枠の画像で入口のクリックを遮らない');
assert.ok(rule('.home-map[data-loading="true"]>#home-location').includes('opacity:0;'),'背景だけを隠し、枠は読み込み状態で消さない');
assert.ok(html.includes('id="notice-viewport" aria-hidden="true"'),'本文の複製は読上げ対象から外す');
assert.ok(css.includes('animation-play-state:paused;')&&css.includes('animation:none !important;'),'hover／focus／動きを減らす設定で止める');
assert.ok(css.includes('transform:translateX(var(--ticker-end,-500px));'),'移動はtransformのみ');
assert.ok(!html.includes('<marquee'),'非推奨のmarquee要素を使わない');
assert.deepEqual(model.ticker(420,300),{distance:468,duration:468/28});
assert.deepEqual(model.ticker(90,300),{distance:348,duration:348/28},'短文も同じ速度で循環する');
for(const [text,viewport] of [[0,300],[420,0],[-1,300],[NaN,300],[Infinity,300],[420,NaN]])assert.equal(model.ticker(text,viewport),null);
// CSS配置の数値確認。ブラウザでの実測ではない。
const slotWidth=(494-8*4)/5,artExtent=64+4;
assert.ok(artExtent<slotWidth,'金の張り出しを含めても隣のアプリに重ならない');
assert.ok(282+64+9+14*1.35<=390,'名前を金の下地から離しても横画面内に収まる');
assert.ok(!/\b\d{1,2}:\d{2}\b/.test(html+JSON.stringify(model.owners)+JSON.stringify(model.forecasts)),'時計時刻を表示しない');
assert.ok(!/<iframe id="home-fortune"[^>]*\ssrc=/.test(html),'閉じた予報を最初に読み込まない');
assert.ok(html.includes('残金 —')&&html.includes('名声 —'));
assert.equal(model.owner('__proto__'),'alche');assert.equal(model.owner('karima'),'karima');
assert.equal(model.presentation('karima','prologue','sale').from,'アルシェ');
for(const kind of Object.keys(model.forecasts)) {
  const result=model.presentation('alche','after',kind);assert.equal(result.after,true);assert.equal(result.period,model.forecasts[kind].label);assert.equal(result.from,'運命予報');
  assert.equal(result.task,'届いたタスクを確認する','予報の種類を変えてもマップの目的は変えない');
}
assert.equal(model.presentation('alche','after','__proto__').copy,model.forecasts.story.copy);
assert.equal(model.forecast('__proto__').key,'story');
assert.equal(model.fit(844,390),1);assert.ok(model.fit(390,844)<1);assert.ok(model.fit(844,390,true)<1);
function node() {return {dataset:{},handlers:new Map(),hidden:false,attributes:{},style:{properties:{},setProperty(k,v){this.properties[k]=v;}},addEventListener(t,f){if(!this.handlers.has(t))this.handlers.set(t,new Set());this.handlers.get(t).add(f);},removeEventListener(t,f){this.handlers.get(t)?.delete(f);},emit(t,event={}){for(const f of [...this.handlers.get(t)||[]])f(event);},getAttribute(k){return this.attributes[k];},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},querySelectorAll(){return [];},getBoundingClientRect(){return {width:844};}};}
function setup(native=true,wallpaperReady=null) {
  const items=new Map(),byId=id=>{if(!items.has(id))items.set(id,node());return items.get(id);};
  const doc=node(),win=node();doc.body=node();doc.hidden=false;doc.getElementById=byId;
  win.innerWidth=844;win.innerHeight=390;win.location={protocol:'http:',origin:'http://localhost:8931',search:''};
  const media=Object.assign(node(),{matches:false});win.matchMedia=()=>media;
  byId('menu-character').value='alche';byId('menu-phase').value='evening';byId('home-stage').value='prologue';byId('notice-kind').value='story';
  byId('menu-effects').checked=true;byId('home-mystery').checked=true;byId('menu-show-frame').checked=false;
  byId('notice-scroll').checked=true;byId('notice-viewport').clientWidth=300;byId('notice-copy').offsetWidth=420;
  const sent=[];byId('menu-wheel').contentWindow={postMessage(m){sent.push(m);}};
  const buttons=Object.keys(apps.apps).map(id=>{
    const button=id==='ouroboros'?byId('home-ouroboros'):node();button.dataset.homeApp=id;button.art=node();button.img=node();button.fallback=node();
    button.art.querySelector=()=>button.img;button.querySelector=selector=>selector==='.app-art'?button.art:button.fallback;return button;
  });
  const mapButtons=['exploration','battle','encounter'].map(id=>Object.assign(node(),{dataset:{mapMode:id}}));
  const forecastButtons=Object.keys(model.forecasts).map(id=>Object.assign(node(),{dataset:{forecastKind:id}}));
  doc.querySelectorAll=selector=>selector==='[data-home-app]'?buttons:selector==='[data-forecast-kind]'?forecastButtons:mapButtons;
  const sticker=node();byId('home-beta').querySelector=()=>sticker;
  if(wallpaperReady!==null){byId('home-wallpaper').complete=true;byId('home-wallpaper').naturalWidth=wallpaperReady?1844:0;}
  byId('home-fortune').dataset.src='../運命予報_分離素材01/layers-preview.html?embed=menu&v=20261005a';
  const dialog=byId('home-dialog');if(native){dialog.showModal=function(){this.open=true;};dialog.close=function(){this.open=false;this.emit('close');};}
  const time={validPhase:p=>['morning','day','evening','night'].includes(p),phases:{morning:{label:'朝'},day:{label:'昼'},evening:{label:'夕方'},night:{label:'夜'}},icon:p=>p};
  const api=mount(doc,win,model,apps,wheel,time);return {api,doc,win,byId,sent,buttons,mapButtons,forecastButtons,sticker,media};
}
const s=setup();assert.equal(s.byId('menu-device').dataset.frame,'false');assert.equal(s.byId('home-fortune').src,undefined);
for(const [key,value] of Object.entries({size:'40%',x:'78%',y:'21%',angle:'18deg'}))assert.equal(s.byId('menu-screen').style.properties['--app-beta-'+key],value);
assert.equal(apps.beta.size,33,'素材比較ページの保存値は変えない');
assert.equal(s.byId('notice-from').textContent,'カリマ');
assert.equal(s.byId('notice-beta').hidden,true);
assert.equal(s.byId('home-notice').dataset.scrolling,'false','プロローグの通信は流さない');
s.byId('home-notice').emit('click');assert.equal(s.byId('home-dialog-title').textContent,'カリマからのメッセージ');assert.equal(s.byId('home-fortune').src,undefined);
s.byId('menu-character').value='karima';s.byId('menu-character').emit('change');assert.equal(s.byId('notice-from').textContent,'アルシェ');assert.equal(s.byId('menu-screen').dataset.owner,'karima');
s.byId('home-stage').value='after';s.byId('home-stage').emit('change');assert.equal(s.byId('notice-kind-control').hidden,false);
assert.equal(s.byId('home-notice').dataset.scrolling,'true');
assert.equal(s.byId('notice-track').style.properties['--ticker-end'],'-468px');
assert.equal(s.byId('notice-track').style.properties['--ticker-duration'],468/28+'s');
assert.equal(s.byId('notice-repeat').textContent,model.forecasts.story.copy);
assert.ok(s.byId('home-notice').attributes['aria-label'].includes(model.forecasts.story.copy),'読み上げは完全な文を一度だけ');
s.byId('home-dialog').close();assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'running');
s.byId('notice-scroll').checked=false;s.byId('notice-scroll').emit('change');assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'paused');
s.byId('notice-scroll').checked=true;s.byId('notice-scroll').emit('change');assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'running');
s.doc.hidden=true;s.doc.emit('visibilitychange');assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'paused');
s.doc.hidden=false;s.doc.emit('visibilitychange');assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'running');
s.media.matches=true;s.media.emit('change');assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'paused');
s.media.matches=false;s.media.emit('change');assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'running');
s.byId('notice-kind').value='sale';s.byId('notice-kind').emit('change');assert.equal(s.byId('notice-copy').textContent,model.forecasts.sale.copy);
assert.equal(s.byId('notice-beta').hidden,false);assert.equal(s.byId('home-notice').dataset.fortune,'true');
s.byId('home-notice').emit('click');assert.equal(s.byId('home-dialog-title').textContent,'運命予報β — セール');assert.ok(s.byId('home-dialog-body').textContent.includes('この試作は価格を変えません'));
assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'paused','詳細閲覧中は停止');
assert.equal(s.byId('home-forecast-copy').textContent,model.forecasts.sale.copy);assert.equal(s.byId('home-forecast-copy').hidden,false);
assert.equal(s.byId('home-fortune').src,undefined,'セールには蛇の章ヒントを読み込まない');
const saleTitle=s.byId('home-dialog-title').textContent;s.api.openApp('fortune');assert.equal(s.byId('home-dialog-title').textContent,saleTitle,'帯とアプリアイコンは同じ予報を開く');
for(const button of s.forecastButtons) {
  button.emit('click');assert.equal(s.byId('notice-kind').value,button.dataset.forecastKind);
  assert.equal(s.byId('notice-copy').textContent,model.forecasts[button.dataset.forecastKind].copy);
  assert.equal(s.byId('notice-repeat').textContent,model.forecasts[button.dataset.forecastKind].copy);
  assert.equal(s.byId('home-notice').dataset.scrolling,String(button.dataset.forecastKind!=='none'),'予報なしは流さない');
  assert.equal(s.byId('home-fortune').hidden,button.dataset.forecastKind!=='story');
  assert.equal(button.attributes['aria-pressed'],'true');
  assert.equal(s.byId('home-task').textContent,'届いたタスクを確認する');
}
s.api.openApp('wallet');assert.equal(s.byId('forecast-options').hidden,true);assert.equal(s.byId('home-forecast-copy').hidden,true);
s.byId('home-dialog').close();s.byId('notice-kind').value='story';s.byId('notice-kind').emit('change');
s.byId('notice-copy').offsetWidth=0;s.win.emit('resize');assert.equal(s.byId('home-notice').dataset.scrolling,'false','計測できない状態では動かさない');
s.byId('notice-copy').offsetWidth=420;s.win.emit('resize');assert.equal(s.byId('home-notice').dataset.scrolling,'true','寸法の復帰後に再計測');
s.win.emit('pagehide',{persisted:true});assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'paused');
s.win.emit('pageshow');assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'running');
s.byId('home-stage').value='prologue';s.byId('home-stage').emit('change');assert.equal(s.byId('notice-kind-control').hidden,true);
for(const button of s.buttons) {button.emit('click');assert.equal(s.byId('home-dialog-title').textContent,button.dataset.homeApp==='fortune'?'運命予報β — 章のヒント':apps.apps[button.dataset.homeApp].label);assert.equal(s.byId('home-fortune').hidden,button.dataset.homeApp!=='fortune');button.img.emit('error');assert.equal(button.fallback.hidden,false);button.img.emit('load');assert.equal(button.fallback.hidden,true);}
s.api.openApp('fortune');assert.equal(s.byId('forecast-options').hidden,true,'プロローグでは他の予報を提供しない');
s.forecastButtons[1].emit('click');assert.equal(s.byId('home-dialog-title').textContent,'運命予報β — 章のヒント');
assert.equal(s.byId('home-fortune').src,s.byId('home-fortune').dataset.src);
s.byId('home-fortune').emit('load');assert.equal(s.byId('home-fortune-status').textContent,'');
const wallet=s.buttons[1];wallet.emit('focus');
s.win.emit('message',{source:s.byId('menu-wheel').contentWindow,origin:s.win.location.origin,data:{type:'solar-menu-state',selected:'save',loading:false}});assert.equal(s.byId('home-status').textContent,apps.apps.wallet.tip);
wallet.emit('blur');assert.ok(s.byId('home-status').textContent.startsWith(wheel.description('save')));
s.win.emit('message',{source:{},origin:s.win.location.origin,data:{type:'solar-menu-state',selected:'items'}});assert.ok(s.byId('home-status').textContent.startsWith(wheel.description('save')));
s.win.emit('message',{source:s.byId('menu-wheel').contentWindow,origin:'http://untrusted.invalid',data:{type:'solar-menu-state',selected:'items'}});assert.ok(s.byId('home-status').textContent.startsWith(wheel.description('save')));
s.byId('home-mystery').checked=false;s.byId('home-mystery').emit('change');assert.equal(s.byId('home-ouroboros').hidden,true);s.byId('home-dialog-title').textContent='guard';s.api.openApp('ouroboros');s.api.openApp('__proto__');assert.equal(s.byId('home-dialog-title').textContent,'guard');
s.byId('home-location').emit('error');assert.equal(s.byId('map-fallback').hidden,false);s.byId('home-location').emit('load');assert.equal(s.byId('map-fallback').hidden,true);
s.byId('home-map-frame').emit('error');assert.equal(s.byId('home-map-frame').hidden,true);assert.equal(s.byId('home-map').dataset.frameReady,'false');
s.byId('home-map-frame').emit('load');assert.equal(s.byId('home-map-frame').hidden,false);assert.equal(s.byId('home-map').dataset.frameReady,'true');
s.byId('home-wallpaper').emit('error');assert.equal(s.byId('home-wallpaper').hidden,true);assert.ok(s.byId('home-warning').textContent.includes('無地の炭色'));
s.byId('home-wallpaper').emit('load');assert.equal(s.byId('home-wallpaper').hidden,false);assert.ok(!s.byId('home-warning').textContent.includes('壁紙'));
s.byId('map-open').emit('click');assert.equal(s.byId('map-options').hidden,false);s.mapButtons[0].emit('click');assert.ok(s.byId('home-dialog-body').textContent.includes('探索2D'));
s.byId('menu-show-frame').checked=true;s.byId('menu-show-frame').emit('change');assert.equal(s.byId('menu-device').dataset.frame,'true');
s.byId('menu-device-frame').emit('error');assert.equal(s.byId('menu-device').dataset.frame,'false');assert.equal(s.byId('menu-show-frame').disabled,true);
s.byId('menu-effects').checked=false;s.byId('menu-effects').emit('change');assert.equal(s.sent.at(-1).effects,false);assert.equal(s.byId('menu-screen').dataset.reduced,'true');
s.byId('home-screen-only').emit('click');assert.equal(s.doc.body.dataset.screenOnly,'true');assert.equal(s.doc.body.style.properties['--home-view-width'],'844px');s.byId('home-dialog').open=false;s.doc.emit('keydown',{key:'Escape'});assert.equal(s.doc.body.dataset.screenOnly,'false');
s.sticker.emit('error');assert.equal(s.byId('home-beta').hidden,true);s.sticker.emit('load');assert.equal(s.byId('home-beta').hidden,false);
s.api.destroy();s.api.destroy();s.byId('home-dialog-title').textContent='destroyed';s.buttons[0].emit('click');assert.equal(s.byId('home-dialog-title').textContent,'destroyed');
assert.equal(s.byId('menu-screen').style.properties['--ticker-play'],'paused');assert.equal(s.byId('home-notice').dataset.scrolling,'false');
const f=setup(false);f.api.openApp('wallet');assert.equal(f.byId('home-dialog').attributes.open,'');let prevented=false;f.byId('home-dialog-close').emit('click',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(f.byId('home-dialog').attributes.open,undefined);f.api.destroy();
for(const ready of [true,false]){const cached=setup(true,ready);assert.equal(cached.byId('home-wallpaper').hidden,!ready);assert.equal(cached.byId('home-warning').hidden,ready);cached.api.destroy();}
console.log('PASS: 銀／金の別素材マップ枠・予報本文の一定速度テロップ／複製と全文・手動停止／非表示／動きを減らす設定／詳細開閉・予報なし停止・既存入口／遅延読込／通信／画像復旧／破棄。描画QA未実施。');
