/* 比較版だけを制御。既存試作のコントローラを読み込まず、説明の更新を一元化する。 */
(function(root) {
  'use strict';
  function mount(doc,win,model,apps,wheelModel,time) {
    const byId=id=>doc.getElementById(id),screen=byId('menu-screen'),wheel=byId('menu-wheel'),dialog=byId('home-dialog');
    const character=byId('menu-character'),phase=byId('menu-phase'),stage=byId('home-stage'),kind=byId('notice-kind');
    const effects=byId('menu-effects'),frame=byId('menu-show-frame'),frameImage=byId('menu-device-frame');
    const notice=byId('home-notice'),tickerTrack=byId('notice-track'),tickerViewport=byId('notice-viewport'),tickerCopy=byId('notice-copy'),tickerToggle=byId('notice-scroll');
    const tickerBefore=byId('notice-before'),tickerAfter=byId('notice-after');
    const tickerMeasure=byId('notice-measure'),tickerFont=byId('notice-font'),tickerAuto=byId('notice-font-auto');
    const themeMode=byId('home-theme-mode');
    const themeInputs={background:byId('home-surface-color'),backing:byId('home-backing-color'),ornament:byId('home-ornament-color'),text:byId('home-text-color')};
    const ownerModes={alche:'dark',karima:'light'};
    const ownerThemes={alche:{dark:model.theme('alche')},karima:{light:model.theme('karima'),dark:model.theme('karima',{},'dark')}};
    const buttons=Array.from(doc.querySelectorAll('[data-home-app]')),mapButtons=Array.from(doc.querySelectorAll('[data-map-mode]'));
    const failures=new Map(),disposers=[],media=win.matchMedia?win.matchMedia('(prefers-reduced-motion: reduce)'):null;
    let destroyed=false,wheelInitialized=false,selected='items',hovered=null,focused=null,fortuneRequested=false,fortuneLoaded=false;
    let tickerPlan=null,tickerElapsed=0,tickerFrame=null,tickerLastTime=null,tickerHovered=false,tickerFocused=false,pageSuspended=false;
    let storageAvailable=true,importRun=0;
    const downloadUrls=new Map();
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
    function tickerEligible() { return Boolean(tickerPlan&&stage.value==='after'&&model.forecast(kind.value).key!=='none'); }
    function tickerPaused() {
      const openAttribute=dialog.getAttribute('open'),dialogShown=Boolean(dialog.open||openAttribute!==undefined&&openAttribute!==null);
      return !tickerToggle.checked||Boolean(media&&media.matches)||doc.hidden||pageSuspended||dialogShown||tickerHovered||tickerFocused;
    }
    function stopTicker() {
      if(tickerFrame!==null)win.cancelAnimationFrame?.(tickerFrame);
      tickerFrame=null;tickerLastTime=null;
    }
    function paintTicker() {
      const state=model.tickerState(tickerEligible()?tickerPlan:null,tickerElapsed);
      if(notice.dataset.tickerPhase!==state.phase)notice.dataset.tickerPhase=state.phase;
      const scrolling=String(tickerEligible()&&tickerPlan.distance>0),offset=state.offset+'px';
      if(notice.dataset.scrolling!==scrolling)notice.dataset.scrolling=scrolling;
      if(tickerTrack.style.getPropertyValue?.('--ticker-offset')!==offset)tickerTrack.style.setProperty('--ticker-offset',offset);
    }
    function queueTicker() {
      if(destroyed||!tickerEligible()||tickerPaused()||tickerFrame!==null||typeof win.requestAnimationFrame!=='function')return;
      tickerFrame=win.requestAnimationFrame(tickTicker);
    }
    function tickTicker(now) {
      tickerFrame=null;
      if(destroyed||!tickerEligible()||tickerPaused()){tickerLastTime=null;return;}
      if(tickerLastTime!==null)tickerElapsed+=Math.max(0,now-tickerLastTime)/1000;
      tickerLastTime=now;
      if(model.tickerState(tickerPlan,tickerElapsed).done) {
        kind.value=model.nextForecast(kind.value);presentation();
      } else paintTicker();
      queueTicker();
    }
    function tickerMotion() {
      screen.style.setProperty('--ticker-play',tickerPaused()?'paused':'running');
      if(media&&media.matches){tickerElapsed=0;paintTicker();}
      if(tickerPaused()||!tickerEligible())stopTicker();else queueTicker();
    }
    function measureTicker(reset=false) {
      if(destroyed)return;
      const base=stage.value==='after'?model.noticeFontLimit(tickerFont.value):13.5;
      const baseValue=base+'px';
      if(tickerMeasure.style.getPropertyValue?.('--ticker-base-font')!==baseValue)tickerMeasure.style.setProperty('--ticker-base-font',baseValue);
      let size=tickerAuto.checked&&stage.value==='after'?model.noticeFontSize(tickerMeasure.offsetWidth,tickerViewport.clientWidth,base):base;
      function applySize() {
        const value=size+'px';
        if(tickerCopy.style.getPropertyValue?.('--ticker-font')!==value)tickerCopy.style.setProperty('--ticker-font',value);
      }
      applySize();
      // 字のヒンティング等で比例計算と実幅が違っても、下限までに留めて再計測する。
      if(tickerAuto.checked&&stage.value==='after'&&tickerViewport.clientWidth>0) {
        while(size>12&&tickerCopy.offsetWidth>tickerViewport.clientWidth){size=Math.max(12,Math.round((size-.1)*10)/10);applySize();}
      }
      byId('notice-font-size').textContent=String(size);
      const metrics=model.ticker(tickerCopy.offsetWidth,tickerViewport.clientWidth,tickerBefore.value,tickerAfter.value);
      // 文・実幅・読む間が変わった時は読み直せる先頭へ。単なる停止／再開では進行を保つ。
      if(reset||!metrics||!tickerPlan||metrics.distance!==tickerPlan.distance||metrics.before!==tickerPlan.before||metrics.after!==tickerPlan.after){stopTicker();tickerElapsed=0;}
      tickerPlan=metrics;paintTicker();tickerMotion();
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
    function applyTheme() {
      const who=model.owner(character.value),mode=ownerModes[who],value=ownerThemes[who][mode];
      screen.dataset.themeMode=mode;themeMode.value=mode;
      byId('home-theme-mode-control').hidden=who!=='karima';themeMode.disabled=who!=='karima';
      for(const [key,property] of [['background','--home-surface'],['backing','--app-backing-color'],['ornament','--home-ornament'],['text','--home-ink']]) {
        themeInputs[key].value=value[key];screen.style.setProperty(property,value[key]);
      }
      byId('home-corner-ink').setAttribute('flood-color',value.ornament);
    }
    function corners() {
      const size=model.ornamentSize(byId('home-corner-size').value),inset=model.ornamentInset(byId('home-corner-inset').value);
      byId('home-corner-size').value=String(size);byId('home-corner-inset').value=String(inset);
      screen.style.setProperty('--corner-size',size+'px');screen.style.setProperty('--corner-inset',inset+'px');
    }
    function appNames() { screen.dataset.appNames=String(byId('home-app-names').checked); }
    function snapshot() {
      return model.settings({schema:model.settingsSchema,referenceResolution:{width:844,height:390},selectedOwner:model.owner(character.value),ownerModes,ownerThemes,
        corner:{size:model.ornamentSize(byId('home-corner-size').value),inset:model.ornamentInset(byId('home-corner-inset').value)},showAppNames:Boolean(byId('home-app-names').checked),
        preview:{phase:time.validPhase(phase.value)?phase.value:'evening',stage:stage.value==='after'?'after':'prologue',noticeKind:model.forecast(kind.value).key,mystery:Boolean(byId('home-mystery').checked),effects:Boolean(effects.checked),frame:Boolean(frame.checked)},
        forecast:{play:Boolean(tickerToggle.checked),before:model.readingSeconds(tickerBefore.value,5),after:model.readingSeconds(tickerAfter.value,3),autoFont:Boolean(tickerAuto.checked),fontLimit:model.noticeFontLimit(tickerFont.value)}});
    }
    function settingsJson() { const text=JSON.stringify(snapshot(),null,2);byId('home-settings-json').value=text;return text; }
    function saveStatus(message) { if(!destroyed)byId('home-save-status').textContent=message; }
    function autoSave() {
      const text=settingsJson();
      try { win.localStorage.setItem(model.settingsStorageKey,text);storageAvailable=true;saveStatus('このブラウザに自動保存しました。別の環境へ渡すときは「設定JSONを保存」を使ってください。'); }
      catch { storageAvailable=false;saveStatus('このブラウザでは自動保存できません。「設定JSONを保存」でファイルに残してください。'); }
    }
    function restoreSettings(value,render=true) {
      for(const who of ['alche','karima']){ownerModes[who]=value.ownerModes[who];ownerThemes[who]=value.ownerThemes[who];}
      character.value=value.selectedOwner;phase.value=value.preview.phase;stage.value=value.preview.stage;kind.value=value.preview.noticeKind;
      effects.checked=value.preview.effects;frame.checked=value.preview.frame;byId('home-mystery').checked=value.preview.mystery;
      byId('home-app-names').checked=value.showAppNames;byId('home-corner-size').value=String(value.corner.size);byId('home-corner-inset').value=String(value.corner.inset);
      tickerToggle.checked=value.forecast.play;tickerBefore.value=String(value.forecast.before);tickerAfter.value=String(value.forecast.after);tickerAuto.checked=value.forecast.autoFont;tickerFont.value=String(value.forecast.fontLimit);
      if(render){presentation();corners();appNames();drawTime();mystery();framing();}
      settingsJson();
    }
    function loadAutomatic() {
      let raw;
      try { raw=win.localStorage.getItem(model.settingsStorageKey); }
      catch { storageAvailable=false;saveStatus('このブラウザでは自動保存を使えません。設定JSONの保存・読み込みをご利用ください。');return; }
      if(!raw){saveStatus('変更するとこのブラウザに自動保存します。ファイルにも残すなら「設定JSONを保存」。');return;}
      try { restoreSettings(model.readSettings(raw),false);saveStatus('このブラウザに保存した設定を復元しました。'); }
      catch { saveStatus('自動保存の内容を読めませんでした。初期表示のままです。保存データは上書きしていません。設定JSONから読み込めます。'); }
    }
    function importSettings(text) {
      const value=model.readSettings(text);restoreSettings(value);autoSave();
      saveStatus(storageAvailable?'設定JSONを読み込み、このブラウザにも保存しました。':'設定JSONを読み込みました。ブラウザ内の自動保存は使えないため、設定JSONファイルを保管してください。');
    }
    function revokeDownload(url) {
      const timer=downloadUrls.get(url);if(timer!==undefined)win.clearTimeout?.(timer);
      downloadUrls.delete(url);win.URL.revokeObjectURL(url);
    }
    listen(byId('home-settings-save'),'click',()=>{
      autoSave();let url=null,link=null;
      try {
        const blob=new win.Blob([settingsJson()],{type:'application/json;charset=utf-8'});url=win.URL.createObjectURL(blob);
        link=doc.createElement('a');link.href=url;link.download='menu-home-settings.json';doc.body.append(link);link.click();
        downloadUrls.set(url,win.setTimeout(()=>revokeDownload(url),1000));
        saveStatus('設定JSONのダウンロードを開始しました。'+(storageAvailable?'':'ブラウザ内の自動保存は使えません。'));
      } catch { if(url)revokeDownload(url);saveStatus('ダウンロードを開始できません。「JSONをコピー」か下の設定JSON欄から保存してください。'); }
      finally { link?.remove(); }
    });
    listen(byId('home-settings-copy'),'click',async()=>{
      const text=settingsJson();
      try {
        if(!win.navigator?.clipboard?.writeText)throw new Error('clipboard unavailable');
        await win.navigator.clipboard.writeText(text);saveStatus('設定JSONをコピーしました。こちらに貼り付けて配色を渡すこともできます。');
      } catch {
        if(destroyed)return;
        byId('home-settings-json').focus();byId('home-settings-json').select();saveStatus('自動コピーを使えません。選択した設定JSONを手動でコピーしてください。');
      }
    });
    listen(byId('home-settings-import-button'),'click',()=>{
      try { importSettings(byId('home-settings-import').value); }
      catch(error) { saveStatus(error.message); }
    });
    listen(byId('home-settings-file'),'change',async()=>{
      const input=byId('home-settings-file'),file=input.files?.[0];if(!file)return;
      const run=++importRun;input.disabled=true;byId('home-settings-import-button').disabled=true;saveStatus('設定ファイルを読み込み中…');
      try {
        if(file.size>65536)throw new Error('設定ファイルが大きすぎます。このホームで保存したJSONを選んでください。');
        const text=await file.text();if(destroyed||run!==importRun)return;importSettings(text);
      } catch(error) { if(!destroyed&&run===importRun)saveStatus(error.message); }
      finally { if(!destroyed&&run===importRun){input.disabled=false;input.value='';byId('home-settings-import-button').disabled=false;} }
    });
    function presentation() {
      character.value=model.owner(character.value);screen.dataset.owner=character.value;
      applyTheme();
      const value=model.presentation(character.value,stage.value,kind.value);
      for(const [id,key] of [['home-chapter','chapter'],['home-place','place'],['notice-from','from'],['notice-copy','copy'],['home-task','task']])byId(id).textContent=value[key];
      tickerMeasure.textContent=value.copy;
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
      // 見た目の名前をOFFにしても、入口の名前を読み上げとhoverへ残す。
      button.setAttribute('aria-label',valueLabel(id));button.setAttribute('title',valueLabel(id));
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
    const cornerSource=byId('home-corner-source');
    function cornerLoad() { byId('home-corners').dataset.ready='true';warning('corners',''); }
    function cornerFail() { byId('home-corners').dataset.ready='false';warning('corners','隅飾りを読み込めません。選んだ色の無地下地で表示しています。'); }
    listen(cornerSource,'error',cornerFail);listen(cornerSource,'load',cornerLoad);
    if(cornerSource.complete){if(cornerSource.naturalWidth)cornerLoad();else cornerFail();}
    listen(wheel,'load',()=>{configureWheel(wheelInitialized?selected:'items');wheelInitialized=true;});
    listen(win,'message',event=>{
      if(event.source!==wheel.contentWindow||!event.data||event.data.type!=='solar-menu-state')return;
      if(win.location?.protocol!=='file:'&&win.location?.origin&&event.origin!==win.location.origin)return;
      if(event.data.selected!==null&&!Object.hasOwn(wheelModel.descriptions,event.data.selected))return;
      selected=event.data.selected;byId('wheel-loading').hidden=!event.data.loading;
      warning('wheel',event.data.failed?'太陽盤の素材を読み込めません。':'');status();
    });
    listen(character,'change',presentation);listen(stage,'change',presentation);listen(kind,'change',presentation);
    listen(themeMode,'change',()=>{
      const who=model.owner(character.value);ownerModes[who]=model.themeMode(who,themeMode.value);applyTheme();
    });
    for(const [key,input] of Object.entries(themeInputs))listen(input,'input',()=>{
      const who=model.owner(character.value),mode=ownerModes[who];ownerThemes[who][mode]=model.theme(who,{...ownerThemes[who][mode],[key]:input.value},mode);applyTheme();
    });
    listen(byId('home-theme-reset'),'click',()=>{const who=model.owner(character.value),mode=ownerModes[who];ownerThemes[who][mode]=model.theme(who,{},mode);applyTheme();});
    listen(byId('home-theme-recover'),'click',()=>{
      character.value='karima';ownerModes.karima='light';ownerThemes.karima.light=model.theme('karima',model.karimaRecoveredTheme);
      byId('home-corner-size').value='36';byId('home-corner-inset').value='0';byId('home-app-names').checked=true;
      presentation();corners();appNames();
    });
    listen(byId('home-corner-size'),'change',corners);listen(byId('home-corner-inset'),'change',corners);
    listen(byId('home-app-names'),'change',appNames);
    listen(phase,'change',drawTime);listen(effects,'change',motion);listen(frame,'change',framing);listen(byId('home-mystery'),'change',mystery);
    listen(tickerToggle,'change',tickerMotion);listen(dialog,'close',tickerMotion);
    listen(notice,'pointerenter',event=>{if(event.pointerType==='touch')return;tickerHovered=true;tickerMotion();});listen(notice,'pointerleave',()=>{tickerHovered=false;tickerMotion();});
    listen(notice,'focus',()=>{tickerFocused=true;tickerMotion();});listen(notice,'blur',()=>{tickerFocused=false;tickerMotion();});
    for(const [input,fallback] of [[tickerBefore,5],[tickerAfter,3]])listen(input,'change',()=>{input.value=String(model.readingSeconds(input.value,fallback));measureTicker(true);});
    listen(tickerFont,'change',()=>{tickerFont.value=String(model.noticeFontLimit(tickerFont.value));measureTicker(true);});
    listen(tickerAuto,'change',()=>measureTicker(true));
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
    if(win.ResizeObserver){const observer=new win.ResizeObserver(()=>measureTicker());observer.observe(tickerViewport);observer.observe(tickerCopy);observer.observe(tickerMeasure);disposers.push(()=>observer.disconnect());}
    if(doc.fonts?.addEventListener)listen(doc.fonts,'loadingdone',()=>measureTicker());
    doc.fonts?.ready?.then(()=>measureTicker());
    function destroy() { if(destroyed)return;destroyed=true;stopTicker();screen.style.setProperty('--motion','paused');screen.style.setProperty('--ticker-play','paused');notice.dataset.scrolling='false';disposers.splice(0).forEach(dispose=>dispose()); }
    listen(win,'pagehide',event=>{if(!event.persisted)destroy();else {pageSuspended=true;screen.style.setProperty('--motion','paused');tickerMotion();}});
    listen(win,'pageshow',()=>{pageSuspended=false;fit();motion();});
    // 先に既存の表示更新を済ませた後で保存する。自動テロップの順送りでは保存しない。
    for(const [input,event] of [[character,'change'],[phase,'change'],[stage,'change'],[kind,'change'],[themeMode,'change'],
      ...Object.values(themeInputs).map(input=>[input,'input']),[byId('home-theme-reset'),'click'],[byId('home-theme-recover'),'click'],
      [byId('home-corner-size'),'change'],[byId('home-corner-inset'),'change'],[byId('home-app-names'),'change'],[byId('home-mystery'),'change'],
      [effects,'change'],[frame,'change'],[tickerToggle,'change'],[tickerBefore,'change'],[tickerAfter,'change'],[tickerFont,'change'],[tickerAuto,'change']])listen(input,event,autoSave);
    disposers.push(()=>{++importRun;for(const url of Array.from(downloadUrls.keys()))revokeDownload(url);});
    if(win.location?.search&&new URLSearchParams(win.location.search).get('view')==='screen')doc.body.dataset.screenOnly='true';
    loadAutomatic();presentation();corners();appNames();drawTime();mystery();framing();configureWheel('items');settingsJson();
    return {destroy,openApp,presentation,fit};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={mount};else mount(document,root,root.IndependentHomeModel,root.SolarMenuApps,root.SolarMenuPreview,root.TimeOfDay);
})(typeof globalThis!=='undefined'?globalThis:this);
