/* 比較版だけを制御。既存試作のコントローラを読み込まず、説明の更新を一元化する。 */
(function(root) {
  'use strict';
  function mount(doc,win,model,apps,wheelModel,time) {
    const byId=id=>doc.getElementById(id),screen=byId('menu-screen'),wheel=byId('menu-wheel'),dialog=byId('home-dialog');
    const character=byId('menu-character'),phase=byId('menu-phase'),stage=byId('home-stage'),kind=byId('notice-kind');
    const effects=byId('menu-effects'),frame=byId('menu-show-frame'),frameImage=byId('menu-device-frame');
    const notice=byId('home-notice'),tickerTrack=byId('notice-track'),tickerViewport=byId('notice-viewport'),tickerCopy=byId('notice-copy'),tickerRepeat=byId('notice-repeat'),tickerToggle=byId('notice-scroll');
    const buttons=Array.from(doc.querySelectorAll('[data-home-app]')),mapButtons=Array.from(doc.querySelectorAll('[data-map-mode]'));
    const failures=new Map(),disposers=[],media=win.matchMedia?win.matchMedia('(prefers-reduced-motion: reduce)'):null;
    let destroyed=false,wheelInitialized=false,selected='items',hovered=null,focused=null,fortuneRequested=false,fortuneLoaded=false;
    function listen(node,type,fn) { node.addEventListener(type,fn);disposers.push(()=>node.removeEventListener(type,fn)); }
    function warning(key,message) {
      if(message)failures.set(key,message);else failures.delete(key);
      byId('home-warning').hidden=failures.size===0;byId('home-warning').textContent=Array.from(failures.values()).join(' ');
    }
    function status() {
      const value=apps.app(hovered||focused);
      byId('home-status').textContent=value?value.tip:wheelModel.description(selected)+'。アプリと知らせも押して確認できます（本編未接続）。';
    }
    function configureWheel(select) {
      wheel.contentWindow?.postMessage({type:'solar-menu-config',character:model.owner(character.value),effects:effects.checked&&!(media&&media.matches)&&!doc.hidden,...(select?{select}: {})},'*');
    }
    function motion() {
      screen.dataset.reduced=String(!effects.checked||Boolean(media&&media.matches));
      screen.style.setProperty('--motion',doc.hidden?'paused':'running');configureWheel();tickerMotion();
    }
    function tickerMotion() {
      const openAttribute=dialog.getAttribute('open'),dialogShown=Boolean(dialog.open||openAttribute!==undefined&&openAttribute!==null);
      screen.style.setProperty('--ticker-play',!tickerToggle.checked||Boolean(media&&media.matches)||doc.hidden||dialogShown?'paused':'running');
    }
    function measureTicker(reset=false) {
      if(destroyed)return;
      // 文が変わる場合だけ先頭へ戻す。hoverや手動停止では進行位置を保つ。
      if(reset)notice.dataset.scrolling='false';
      tickerTrack.style.setProperty('--ticker-item-width',(tickerViewport.clientWidth||0)+'px');
      const metrics=model.ticker(tickerCopy.offsetWidth,tickerViewport.clientWidth);
      const value=model.presentation(character.value,stage.value,kind.value);
      notice.dataset.scrolling=String(Boolean(metrics&&value.after&&model.forecast(kind.value).key!=='none'));
      if(metrics) {
        tickerTrack.style.setProperty('--ticker-end',-metrics.distance+'px');
        tickerTrack.style.setProperty('--ticker-duration',metrics.duration+'s');
      }
      tickerMotion();
    }
    function fit() {
      if(doc.body.dataset.screenOnly==='true') {
        const scale=model.fit(win.innerWidth,win.innerHeight,byId('menu-device').dataset.frame==='true');
        doc.body.style.setProperty('--home-view-width',844*scale+'px');
      }
      screen.style.setProperty('--scene-scale',byId('menu-viewport').getBoundingClientRect().width/844);
      measureTicker();
    }
    function framing() {
      byId('menu-device').dataset.frame=String(frame.checked&&!frame.disabled);
      frameImage.hidden=byId('menu-device').dataset.frame!=='true';fit();
    }
    function drawTime() {
      if(!time.validPhase(phase.value))phase.value='evening';
      byId('home-time').innerHTML=time.icon(phase.value,'home-time');
      // 時間帯素材は元の試作フォルダに置いたまま参照する。
      byId('home-time').querySelectorAll('img').forEach(img=>img.src='../太陽盤_コマンド試作01/'+img.getAttribute('src'));
      byId('home-time').setAttribute('aria-label','時間帯：'+time.phases[phase.value].label);motion();
    }
    function presentation() {
      character.value=model.owner(character.value);screen.dataset.owner=character.value;
      const value=model.presentation(character.value,stage.value,kind.value);
      for(const [id,key] of [['home-chapter','chapter'],['home-place','place'],['notice-from','from'],['notice-copy','copy'],['notice-period','period'],['home-task','task']])byId(id).textContent=value[key];
      tickerRepeat.textContent=value.copy;
      byId('notice-kind-control').hidden=!value.after;
      byId('home-notice').dataset.fortune=String(value.after);
      byId('notice-beta').hidden=!value.after;
      byId('home-notice').setAttribute('aria-label',value.after?'運命予報β：'+value.period+'。'+value.copy+' 詳細を開く':value.from+'からのメッセージ。'+value.copy);
      byId('map-fallback').textContent='場所の画像を読み込めません。'+value.place;
      byId('home-location').alt=value.place+'の仮画像（章データ未接続）';configureWheel();measureTicker(true);
    }
    function mystery() {
      byId('home-ouroboros').hidden=!byId('home-mystery').checked;
      if(!byId('home-mystery').checked) { if(hovered==='ouroboros')hovered=null;if(focused==='ouroboros')focused=null; }
      status();
    }
    function open(title,copy,mode=false,fortune=false,forecastView=false) {
      byId('home-dialog-title').textContent=title;byId('home-dialog-body').textContent=copy;
      byId('home-forecast-copy').hidden=!forecastView;
      byId('map-options').hidden=!mode;byId('home-fortune').hidden=!fortune;byId('home-fortune-status').hidden=!fortune;
      byId('forecast-options').hidden=!forecastView||stage.value!=='after';
      if(fortune) {
        byId('home-fortune-status').textContent=fortuneLoaded?'':'運命予報を読み込み中';
        if(!fortuneRequested) { fortuneRequested=true;byId('home-fortune').src=byId('home-fortune').dataset.src; }
      }
      if(typeof dialog.showModal==='function') { if(!dialog.open)dialog.showModal(); }
      else dialog.setAttribute('open','');
      tickerMotion();
    }
    function openForecast() {
      const value=model.forecast(stage.value==='after'?kind.value:'story');
      // セール等へ「蛇」のカードを添えると別の予報と混同するため、章のヒントのみ表示。
      open('運命予報β — '+value.label,value.detail,false,value.key==='story',true);
      byId('home-forecast-copy').textContent=value.copy;
      doc.querySelectorAll('[data-forecast-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.forecastKind===value.key)));
    }
    function openApp(id) {
      const value=apps.app(id);if(!value||(id==='ouroboros'&&!byId('home-mystery').checked))return;
      if(id==='fortune')openForecast();else open(value.label,value.detail);
    }
    for(const button of buttons) {
      const id=button.dataset.homeApp;
      listen(button,'click',()=>openApp(id));
      listen(button,'pointerenter',()=>{hovered=id;status();});listen(button,'pointerleave',()=>{hovered=null;status();});
      listen(button,'focus',()=>{focused=id;status();});listen(button,'blur',()=>{focused=null;status();});
      const art=button.querySelector('.app-art'),img=art.querySelector(':scope > img'),fallback=button.querySelector('.app-fallback');
      function load() { art.dataset.loading='false';img.hidden=false;fallback.hidden=true;warning(id,''); }
      function fail() { art.dataset.loading='false';img.hidden=true;fallback.hidden=false;warning(id,valueLabel(id)+'の素材を読み込めません。'); }
      listen(img,'load',load);listen(img,'error',fail);if(img.complete){if(img.naturalWidth)load();else fail();}
    }
    function valueLabel(id) { return apps.app(id)?.label||'アプリ'; }
    const beta=byId('home-beta'),sticker=beta.querySelector('img');
    const appBeta={...apps.beta,size:model.appBetaSize};
    for(const key of ['size','x','y','angle'])screen.style.setProperty('--app-beta-'+key,appBeta[key]+(key==='angle'?'deg':'%'));
    function betaLoad() { beta.hidden=!apps.beta.visible;warning('beta',''); }
    function betaFail() { beta.hidden=true;warning('beta','β版シールを読み込めません。'); }
    listen(sticker,'load',betaLoad);listen(sticker,'error',betaFail);if(sticker.complete){if(sticker.naturalWidth)betaLoad();else betaFail();}
    const locationImage=byId('home-location');
    function mapLoad() { byId('home-map').dataset.loading='false';locationImage.hidden=false;byId('map-fallback').hidden=true;warning('map',''); }
    function mapFail() { byId('home-map').dataset.loading='false';locationImage.hidden=true;byId('map-fallback').hidden=false;warning('map','場所の仮画像を読み込めません。'); }
    listen(locationImage,'load',mapLoad);listen(locationImage,'error',mapFail);if(locationImage.complete){if(locationImage.naturalWidth)mapLoad();else mapFail();}
    const mapFrame=byId('home-map-frame');
    function mapFrameLoad() { mapFrame.hidden=false;byId('home-map').dataset.frameReady='true';warning('map-frame',''); }
    function mapFrameFail() { mapFrame.hidden=true;byId('home-map').dataset.frameReady='false';warning('map-frame','マップの飾り枠を読み込めません。細い銀色の罫線で表示しています。'); }
    listen(mapFrame,'load',mapFrameLoad);listen(mapFrame,'error',mapFrameFail);
    if(mapFrame.complete){if(mapFrame.naturalWidth)mapFrameLoad();else mapFrameFail();}
    const wallpaper=byId('home-wallpaper');
    function wallpaperLoad() { wallpaper.hidden=false;warning('wallpaper',''); }
    function wallpaperFail() { wallpaper.hidden=true;warning('wallpaper','壁紙を読み込めません。無地の炭色で表示しています。'); }
    listen(wallpaper,'error',wallpaperFail);listen(wallpaper,'load',wallpaperLoad);
    if(wallpaper.complete){if(wallpaper.naturalWidth)wallpaperLoad();else wallpaperFail();}
    listen(wheel,'load',()=>{configureWheel(wheelInitialized?selected:'items');wheelInitialized=true;});
    listen(win,'message',event=>{
      if(event.source!==wheel.contentWindow||!event.data||event.data.type!=='solar-menu-state')return;
      if(win.location?.protocol!=='file:'&&win.location?.origin&&event.origin!==win.location.origin)return;
      if(event.data.selected!==null&&!Object.hasOwn(wheelModel.descriptions,event.data.selected))return;
      selected=event.data.selected;byId('wheel-loading').hidden=!event.data.loading;
      warning('wheel',event.data.failed?'太陽盤の素材を読み込めません。':'');status();
    });
    listen(character,'change',presentation);listen(stage,'change',presentation);listen(kind,'change',presentation);
    listen(phase,'change',drawTime);listen(effects,'change',motion);listen(frame,'change',framing);listen(byId('home-mystery'),'change',mystery);
    listen(tickerToggle,'change',tickerMotion);listen(dialog,'close',tickerMotion);
    listen(byId('home-notice'),'click',()=>{const value=model.presentation(character.value,stage.value,kind.value);if(value.after)openForecast();else open(value.from+'からのメッセージ',value.detail);});
    for(const button of doc.querySelectorAll('[data-forecast-kind]'))listen(button,'click',()=>{
      if(stage.value!=='after'||!Object.hasOwn(model.forecasts,button.dataset.forecastKind))return;
      kind.value=button.dataset.forecastKind;presentation();openForecast();
    });
    listen(byId('map-open'),'click',()=>open('マップ',byId('home-place').textContent+'の入口見本です。探索・出撃の実処理には未接続です。',true));
    for(const button of mapButtons)listen(button,'click',()=>{
      if(!Object.hasOwn(wheelModel.mapModes,button.dataset.mapMode))return;
      byId('home-dialog-body').textContent=wheelModel.mapModes[button.dataset.mapMode]+'を選択しました。試作なので実際の場面には移動しません。';
      mapButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    });
    listen(byId('home-dialog-close'),'click',event=>{if(typeof dialog.close!=='function'){event.preventDefault();dialog.removeAttribute('open');tickerMotion();}});
    listen(byId('home-fortune'),'load',()=>{if(fortuneRequested){fortuneLoaded=true;byId('home-fortune-status').textContent='';}});
    listen(byId('home-fortune'),'error',()=>{fortuneLoaded=false;byId('home-fortune-status').textContent='運命予報を読み込めません。分離素材フォルダを確認してください。';});
    function screenOnly(value) { doc.body.dataset.screenOnly=String(value);fit(); }
    listen(byId('home-screen-only'),'click',()=>screenOnly(true));
    listen(doc,'keydown',event=>{if(event.key==='Escape'&&!dialog.open&&doc.body.dataset.screenOnly==='true')screenOnly(false);});
    listen(frameImage,'error',()=>{frame.checked=false;frame.disabled=true;framing();warning('frame','端末フレームを読み込めないため枠なしで表示しています。');});
    listen(frameImage,'load',()=>{frame.disabled=false;warning('frame','');framing();});
    listen(doc,'visibilitychange',motion);if(media?.addEventListener)listen(media,'change',motion);
    listen(win,'resize',fit);
    if(win.ResizeObserver){const observer=new win.ResizeObserver(fit);observer.observe(byId('menu-viewport'));disposers.push(()=>observer.disconnect());}
    if(win.ResizeObserver){const observer=new win.ResizeObserver(()=>measureTicker());observer.observe(tickerViewport);observer.observe(tickerCopy);disposers.push(()=>observer.disconnect());}
    if(doc.fonts?.addEventListener)listen(doc.fonts,'loadingdone',()=>measureTicker());
    doc.fonts?.ready?.then(()=>measureTicker());
    function destroy() { if(destroyed)return;destroyed=true;screen.style.setProperty('--motion','paused');screen.style.setProperty('--ticker-play','paused');notice.dataset.scrolling='false';disposers.splice(0).forEach(dispose=>dispose()); }
    listen(win,'pagehide',event=>{if(!event.persisted)destroy();else {screen.style.setProperty('--motion','paused');screen.style.setProperty('--ticker-play','paused');}});
    listen(win,'pageshow',()=>{fit();motion();});
    if(win.location?.search&&new URLSearchParams(win.location.search).get('view')==='screen')doc.body.dataset.screenOnly='true';
    presentation();drawTime();mystery();framing();configureWheel('items');
    return {destroy,openApp,presentation,fit};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={mount};else mount(document,root,root.IndependentHomeModel,root.SolarMenuApps,root.SolarMenuPreview,root.TimeOfDay);
})(typeof globalThis!=='undefined'?globalThis:this);
