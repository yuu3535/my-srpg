/* 比較だけの制御。実探索やUnityの入力には接続しない。 */
(function(root) {
  'use strict';
  function mount(doc,win,model) {
    const $=id=>doc.getElementById(id),disposers=[],cards=[],storageKey='solar-menu-transition-comparison-v01';
    const media=win.matchMedia('(prefers-reduced-motion: reduce)'),settings=$('settings-dialog');
    let raf=null,lastTime=null,destroyed=false,suspended=false,large=null;
    function listen(node,type,handler,options){node.addEventListener(type,handler,options);disposers.push(()=>node.removeEventListener(type,handler,options));}
    function motionMode(card){return card.frameFailed?'none':model.effectiveMode($('effect-mode').value,media.matches);}
    function busy(){return settings.open||doc.hidden||suspended;}
    function active(){return cards.find(card=>card.id===$('active').value)||cards[0];}
    function interactive(card){return card.machine.state==='open'||card.id==='frameout'&&card.machine.state==='opening';}
    function choose(card){$('active').value=card.id;}
    function store(){try{win.localStorage.setItem(storageKey,JSON.stringify({mode:model.mode($('effect-mode').value),wake:$('wake-enabled').checked,speed:model.speed($('speed').value)}));$('storage-status').textContent='端末の演出モード・速さ・スリープ解除の比較設定を保存しています。ホームの配色JSONは変更しません。';}catch{$('storage-status').textContent='ブラウザへ保存できません。このページを開いている間だけ設定を保持します。';}}
    try{const saved=JSON.parse(win.localStorage.getItem(storageKey)||'null');if(saved&&['full','short','none'].includes(saved.mode))$('effect-mode').value=saved.mode;if(typeof saved?.wake==='boolean')$('wake-enabled').checked=saved.wake;$('speed').value=String(model.speed(saved?.speed));}catch{$('speed').value='1';$('storage-status').textContent='保存済み設定を読めないため、初期の「あり・通常速度」で比較します。';}
    $('effect-speed').value=$('speed').value;
    function postConfig(card,force=false){
      card.element.dataset.owner=$('owner').value;
      const config={type:'menu-transition-config',owner:$('owner').value,active:interactive(card),returnKey:{enabled:true,visible:card.machine.state==='open',viewScale:card.viewScale||1,safeRight:card.safeRight||0,safeBottom:card.safeBottom||0}};
      const signature=JSON.stringify(config);if(!force&&card.configSignature===signature)return;
      card.configSignature=signature;card.iframe.contentWindow?.postMessage(config,'*');
    }
    function inputStatus(card){card.inputNote.textContent=card.input.blocked?'探索入力：キーを一度離すまで停止':card.input.moving?'探索入力：移動指示あり（SDは静止画）':'探索入力：停止／目的地なし';}
    function draw(card){
      const machine=card.machine,newMotion=card.id==='frameout',animated=newMotion&&motionMode(card)!=='none';
      const p=animated?machine.visual:model.pose(card.id,machine.progress,motionMode(card)),isClosed=machine.state==='closed';
      card.stage.dataset.state=machine.state;card.stage.dataset.earlyInput=String(newMotion);
      card.plane.style.transform=`translate3d(0,${p.y}px,0) scale(${p.scale}) perspective(900px) rotateX(${p.tilt}deg) rotateZ(${p.rotation||0}deg)`;
      card.plane.style.opacity=String(p.opacity);card.plane.style.visibility=isClosed?'hidden':'visible';
      card.frame.style.opacity=String(p.frameOpacity);card.aperture.style.opacity=String(p.frameOpacity);card.dim.style.opacity=String(p.dim);
      card.image.parentElement?.style.setProperty('transform',`scale(${p.worldScale||1})`);
      card.iframe.style.transform=`scaleY(${p.screenY??1})`;card.flash.hidden=!animated;card.flash.style.transform=`scaleY(${p.screenY??1})`;card.flash.style.opacity=String(p.flash||0);
      if(newMotion)card.iframe.contentWindow?.postMessage({type:'menu-transition-motion',items:animated?p.items:Array(model.itemCount).fill(1)},'*');
      card.entry.hidden=!isClosed;card.entry.disabled=!card.ready||!model.canOpen($('context').value);
      card.closeButton.disabled=isClosed;if(large===card)$('large-close').disabled=isClosed;
      const waking=model.wake(machine.progress,motionMode(card),$('wake-enabled').checked);
      card.wake.hidden=newMotion||isClosed||motionMode(card)==='none'||!$('wake-enabled').checked;
      card.wakeTop.style.transform=`translateY(${-100*waking.reveal}%)`;card.wakeBottom.style.transform=`translateY(${100*waking.reveal}%)`;
      card.wakeMark.style.opacity=String(waking.markOpacity);card.wakeLine.style.opacity=String(waking.lineOpacity);card.wakeLine.style.transform=`scaleX(${waking.lineScale})`;
      card.wakeLabel.textContent=machine.state==='closing'?'スリープへ':'スリープ解除';
      card.iframe.inert=!interactive(card);card.iframe.tabIndex=interactive(card)?0:-1;
      const labels={closed:'探索',opening:animated?'開く途中・画面点灯／項目表示':waking.reveal<1&&motionMode(card)!=='none'&&$('wake-enabled').checked?'開く途中・スリープ解除':'開く途中',open:'ホーム',closing:'閉じる途中'};
      card.state.textContent=`${labels[machine.state]} / ${Math.round(machine.progress*100)}%`;
      card.openButton.disabled=!card.ready||!model.canOpen($('context').value);
      if(card.previous!==machine.state){postConfig(card);if(machine.state==='open'&&active()===card&&!settings.open)card.iframe.focus({preventScroll:true});if(isClosed&&card.previous==='closing'&&!settings.open)card.entry.focus({preventScroll:true});card.previous=machine.state;}
      inputStatus(card);
    }
    function stop(){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;lastTime=null;}
    function schedule(){if(!destroyed&&!busy()&&raf===null&&cards.some(card=>['opening','closing'].includes(card.machine.state)))raf=win.requestAnimationFrame(tick);}
    function tick(now){
      raf=null;if(destroyed||busy()){lastTime=null;return;}
      const elapsed=lastTime===null?0:Math.max(0,(now-lastTime)/1000);lastTime=now;
      for(const card of cards){card.machine.step(elapsed,model.duration(card.id,motionMode(card),card.machine.state==='closing',Number($('speed').value)));draw(card);}
      if(cards.some(card=>['opening','closing'].includes(card.machine.state)))schedule();else lastTime=null;
    }
    function open(card){
      choose(card);if(!card.ready){card.state.textContent='読み込みが終わるまでお待ちください。';return;}
      if(!model.canOpen($('context').value)){card.state.textContent='イベント中は端末を開けません。';return;}
      card.input.stop();card.machine.open();draw(card);schedule();
    }
    function close(card){choose(card);card.input.stop();card.machine.close();draw(card);schedule();}
    function escape(card){if(card.machine.state==='closed')open(card);else if(card.machine.state==='closing'){card.machine.settle();draw(card);}else close(card);}
    function readiness(card){
      card.ready=card.explorationSettled&&card.frameSettled&&card.homeReady;
      card.cover.hidden=card.ready;
      const messages=[card.explorationFailed?'探索画像を読み込めません。無地の画面で入力と演出のみ確認できます。':'',card.frameFailed?'端末枠を読み込めません。拡大なしの短い切替へ戻します。':'',card.homeWarning||''].filter(Boolean);
      card.error.hidden=messages.length===0;card.error.textContent=messages.join(' ');draw(card);
      $('open-all').disabled=!cards.every(item=>item.ready)||!model.canOpen($('context').value);
    }
    function fit(){
      if(large){const availableHeight=Math.max(100,win.innerHeight-150);large.slot.style.width=Math.min(win.innerWidth-32,availableHeight*844/390)+'px';}
      for(const card of cards){const width=card.stage.getBoundingClientRect().width,scale=width/844;card.world.style.setProperty('--view-scale',String(scale));
        // レイアウト上の内窓寸法で求める。transform後の値を測って倍率を累積させない。
        if(width>0){card.viewScale=scale;card.machine.setCover?.(model.framedScale*model.coverScale(width,width*390/844,844*scale*model.framedScale,390*scale*model.framedScale));}
        const css=win.getComputedStyle?.(card.stage);
        card.safeRight=Math.max(0,Math.min(200,parseFloat(css?.getPropertyValue('--safe-right'))||0));
        card.safeBottom=Math.max(0,Math.min(200,parseFloat(css?.getPropertyValue('--safe-bottom'))||0));postConfig(card);}
    }
    function largeView(card){
      if(large)exitLarge();choose(card);large=card;doc.body.dataset.large='true';card.element.dataset.large='true';
      $('large-view').hidden=false;$('large-title').textContent=model.variants[card.id].label;
      for(const other of cards)if(other!==card)other.element.inert=true;
      fit();draw(card);$('large-back').focus();
    }
    function exitLarge(){if(!large)return;const card=large;card.element.removeAttribute('data-large');card.slot.style.width='';large=null;doc.body.dataset.large='false';$('large-view').hidden=true;for(const item of cards)item.element.inert=false;fit();card.largeButton.focus();}
    function openSettings(card){if(card)choose(card);if(!settings.open)settings.showModal();stop();}
    for(const element of doc.querySelectorAll('[data-variant]')){
      const slot=element.querySelector('.stage-slot');slot.append($('stage-template').content.cloneNode(true));
      const stage=slot.querySelector('.stage'),find=selector=>stage.querySelector(selector);
      const card={id:element.dataset.variant,element,slot,stage,world:find('.logical-world'),plane:find('.device-plane'),frame:find('.phone-frame'),aperture:find('.aperture'),dim:find('.dim'),iframe:find('.home'),entry:find('.terminal-button'),cover:find('.stage-cover'),error:find('.resource-error'),retry:find('.retry-home'),image:find('.exploration-image'),state:element.querySelector('.state'),inputNote:element.querySelector('.input-note'),openButton:element.querySelector('[data-action="open"]'),largeButton:element.querySelector('[data-action="large"]'),machine:model.machine(element.dataset.variant),input:model.inputGate(),homeReady:false,homeWarning:'',ready:false,previous:'closed'};
      Object.assign(card,{closeButton:element.querySelector('[data-action="close"]'),flash:find('.screen-flash'),wake:find('.wake-screen'),wakeTop:find('.wake-top'),wakeBottom:find('.wake-bottom'),wakeMark:find('.wake-mark'),wakeLine:find('.wake-line'),wakeLabel:find('.wake-label')});
      card.closeButton.textContent='閉じる演出を確認';card.closeButton.setAttribute('aria-label','比較用：端末を閉じる演出を確認');
      cards.push(card);stage.setAttribute('aria-label',model.variants[card.id].label+'の探索と端末');
      for(const [key,value]of Object.entries(model.frameBox))card.frame.style[key]=value+'px';
      function homeTimeout(){card.homeTimer=win.setTimeout(()=>{if(!card.homeReady){card.homeWarning='ホームの応答がありません。再読込を試してください。';card.retry.hidden=false;readiness(card);}},15000);}
      homeTimeout();
      listen(card.iframe,'load',()=>postConfig(card,true));
      listen(card.retry,'click',()=>{win.clearTimeout(card.homeTimer);card.machine.reset();card.homeReady=false;card.homeWarning='';card.retry.hidden=true;readiness(card);card.iframe.src=card.iframe.getAttribute('src');homeTimeout();});
      for(const [image,type]of [[card.image,'exploration'],[card.frame,'frame']]){
        const loaded=failed=>{card[type+'Settled']=true;card[type+'Failed']=failed;image.hidden=failed;readiness(card);};
        listen(image,'load',()=>loaded(false));listen(image,'error',()=>loaded(true));if(image.complete)loaded(!image.naturalWidth);
      }
      for(const button of [card.entry,card.openButton])listen(button,'click',event=>{event.stopPropagation();open(card);});
      listen(card.closeButton,'click',event=>{event.stopPropagation();close(card);});
      listen(card.largeButton,'click',()=>largeView(card));listen(stage,'pointerenter',()=>choose(card));listen(stage,'focusin',()=>choose(card));
      listen(stage,'pointerdown',event=>{if(event.target.closest('button,iframe')||card.machine.state!=='closed'||!model.canOpen($('context').value))return;choose(card);card.input.walk({x:event.clientX,y:event.clientY},true);inputStatus(card);});
      listen(stage,'click',event=>{if(card.machine.state==='opening'&&!event.target.closest('button'))open(card);});
      disposers.push(()=>win.clearTimeout(card.homeTimer));draw(card);
    }
    listen(win,'message',event=>{
      const card=cards.find(item=>item.iframe.contentWindow===event.source);if(!card||!event.data)return;
      if(win.location.protocol!=='file:'&&event.origin!==win.location.origin)return;
      const data=event.data;
      if(data.type==='menu-transition-ready'){
        card.homeReady=data.ready===true;card.homeWarning=typeof data.warning==='string'?data.warning:'';
        if(card.homeReady){win.clearTimeout(card.homeTimer);card.retry.hidden=true;}readiness(card);
      }else if(data.type==='menu-transition-escape')escape(card);
      else if(data.type==='menu-transition-back'&&card.machine.state==='open'&&!busy())close(card);
      else if(data.type==='menu-transition-keyup'&&['ArrowLeft','ArrowRight','a','d','A','D'].includes(data.key)){for(const item of cards){item.input.release(data.key);inputStatus(item);}}
      else if(data.type==='menu-transition-settings'&&interactive(card))openSettings(card);
    });
    listen($('open-all'),'click',()=>cards.forEach(open));listen($('close-all'),'click',()=>cards.forEach(close));
    listen($('large-open'),'click',()=>{if(large)open(large);});listen($('large-close'),'click',()=>{if(large)close(large);});listen($('large-back'),'click',exitLarge);
    listen($('owner'),'change',()=>cards.forEach(card=>postConfig(card)));listen($('settings-open'),'click',()=>openSettings());
    function summarize(){const labels={full:'あり',short:'短い',none:'なし'};$('mode-summary').textContent='採用方針：④・通常速度。端末の演出：'+labels[model.mode($('effect-mode').value)]+' ／ 速さ：'+model.speed($('speed').value)+'倍'+(media.matches?' ／ OSの動きを減らす設定により、実際は「なし」':'')+'。ホーム右下の「戻る」かEscで閉じます。画面外の再生・比較ボタンは確認用です。';}
    function settleMotion(){stop();for(const card of cards){card.machine.settle();draw(card);}summarize();}
    listen($('effect-mode'),'change',()=>{settleMotion();store();});listen(media,'change',settleMotion);
    function changeSpeed(source){const value=String(model.speed(source.value));$('speed').value=value;$('effect-speed').value=value;settleMotion();store();}
    listen($('speed'),'change',()=>changeSpeed($('speed')));listen($('effect-speed'),'change',()=>changeSpeed($('effect-speed')));
    listen($('wake-enabled'),'change',()=>{settleMotion();store();});
    listen(settings,'close',()=>{lastTime=null;schedule();});
    listen($('context'),'change',()=>{stop();for(const card of cards){card.input.stop();card.machine.reset();draw(card);readiness(card);}});
    const movement=new Set(['ArrowLeft','ArrowRight','a','d','A','D']);
    listen(doc,'keydown',event=>{
      if(event.key==='Escape'){
        if(settings.open)return;
        if(event.target.closest('select,input,textarea'))return;
        // キーリピートで開閉が反転しない。大きく見る表示では、閉じた状態のEscは比較へ戻る。
        event.preventDefault();if(event.repeat)return;
        if(large&&large.machine.state==='closed')exitLarge();else escape(active());return;
      }
      if(large&&event.key==='Tab'&&!settings.open){
        const controls=[$('large-back'),large.iframe,$('large-open'),$('large-close')].filter(node=>!node.inert&&!node.disabled&&node.tabIndex!==-1);
        const index=controls.indexOf(doc.activeElement),next=event.shiftKey?(index-1+controls.length)%controls.length:(index+1)%controls.length;
        event.preventDefault();controls[next]?.focus();return;
      }
      if(movement.has(event.key)&&!event.target.closest('input,select,textarea,button')&&!settings.open){event.preventDefault();const card=active();card.input.press(event.key,card.machine.state==='closed'&&model.canOpen($('context').value));inputStatus(card);}
    });
    listen(doc,'keyup',event=>{for(const card of cards){card.input.release(event.key);inputStatus(card);}});
    listen(win,'blur',()=>{for(const card of cards){card.input.stop();inputStatus(card);}});
    listen(doc,'visibilitychange',()=>{if(doc.hidden){stop();cards.forEach(card=>card.input.stop());}else{lastTime=null;schedule();}});
    listen(win,'resize',fit);
    if(win.ResizeObserver){const observer=new win.ResizeObserver(fit);cards.forEach(card=>observer.observe(card.stage));disposers.push(()=>observer.disconnect());}
    function destroy(){if(destroyed)return;destroyed=true;stop();disposers.splice(0).forEach(dispose=>dispose());cards.forEach(card=>{card.input.stop();card.iframe.inert=true;});}
    listen(win,'pagehide',event=>{if(event.persisted){suspended=true;stop();}else destroy();});listen(win,'pageshow',()=>{suspended=false;lastTime=null;schedule();fit();});
    fit();summarize();return {cards,open,close,escape,destroy};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={mount};else mount(document,root,root.MenuTransitionModel);
})(typeof globalThis!=='undefined'?globalThis:this);
