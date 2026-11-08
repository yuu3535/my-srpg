/* Hub2 の帯スイープの制御。比較専用で、実探索やUnityの入力には接続しない。 */
(function(root) {
  'use strict';
  function mount(doc,win,model) {
    const $=id=>doc.getElementById(id),disposers=[],machine=model.machine(),media=win.matchMedia('(prefers-reduced-motion: reduce)');
    const stage=$('stage'),screen=$('screen'),band=$('band'),runner=$('runner');
    let raf=null,last=null,destroyed=false,scale=1,replayTimer=null,geometry=null;
    // 帯の流れ方: 右上から（原作者の指摘による案。初期値）／仕様書どおり（左上から・開くは逆）。
    function flowName(){return $('flow').value==='spec'?'spec':'topright';}
    function refreshGeometry(){geometry=model.geometry(model.base.width,model.base.height,model.flow(flowName()).angle);}
    refreshGeometry();
    function listen(node,type,handler,options){node.addEventListener(type,handler,options);disposers.push(()=>node.removeEventListener(type,handler,options));}
    function setting(){return media.matches?'none':model.mode($('effect-mode').value);}
    function fit(){const w=stage.getBoundingClientRect().width;if(w>0)scale=w/model.base.width;screen.style.transform=`scale(${scale})`;}
    function placeBand(p,kind){
      const g=geometry,b=model.band(p,model.travel(kind,flowName()),g),cx=g.width/2+g.n.x*b.offset,cy=g.height/2+g.n.y*b.offset;
      band.style.visibility='visible';band.style.width=g.L+'px';band.style.height=g.T+'px';
      band.style.transform=`translate(${cx-g.L/2}px,${cy-g.T/2}px) rotate(${g.rotate}deg)`;
      // 星は帯の先頭（進む側のふち）の、画面の真ん中に近い所に乗り、尾は帯の内側へ伸びる。1回転する。
      runner.dataset.dir=b.sign>0?'close':'open';runner.style.left=(g.L/2)+'px';runner.style.top=(b.sign>0?g.T:0)+'px';
      $('runner-star').style.transform=`rotate(${b.starTurn}deg)`;
    }
    function draw(){
      const f=machine.frame(setting());
      const menu=$('menu');menu.style.display=f.menu?'':'none';menu.style.opacity=String(f.menuOpacity??1);
      $('menu-star').hidden=!f.explore;
      if(f.sweep===null)band.style.visibility='hidden';else placeBand(f.sweep,machine.kind);
      const wrap=$('close-star-wrap');let pose=null;
      if(f.burst!==null&&f.burst!==undefined)pose=model.burstPose(f.burst);else if(f.land!==null&&f.land!==undefined&&f.land<1)pose=model.landPose(f.land);
      wrap.style.transform=pose?`rotate(${pose.rotate}deg) scale(${pose.scale})`:'';wrap.style.opacity=pose?String(pose.opacity):'';
      // 演出中は入力を受け付けない（Hub2 の決まり）。
      $('close-star').disabled=machine.locked||machine.state!=='open';$('menu-star').disabled=machine.locked||machine.state!=='closed';
      screen.dataset.locked=String(machine.locked);
      const labels={open:'メニュー',closed:'探索',closing:'閉じる途中（入力なし）',opening:'開く途中（入力なし）'};
      $('status').textContent=`${labels[machine.state]}　／　端末の演出：${{full:'あり',short:'短い（案）',none:'なし（案）'}[setting()]}${media.matches?'（OSの動きを減らす設定）':''}`;
    }
    function stop(){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;last=null;}
    function schedule(){if(!destroyed&&!doc.hidden&&raf===null&&machine.locked)raf=win.requestAnimationFrame(tick);}
    function tick(now){
      raf=null;if(destroyed||doc.hidden){last=null;return;}
      const dt=last===null?0:Math.max(0,(now-last)/1000)*Number($('speed').value||1);last=now;
      machine.step(dt,setting());draw();if(machine.locked)schedule();else last=null;
    }
    function close(){if(machine.close()){draw();schedule();}}
    function open(){if(machine.open()){draw();schedule();}}
    listen($('close-star'),'click',close);listen($('menu-star'),'click',open);
    // 運命予報カード（§3-11）。ティッカーを押すと出て、ティッカーは既読になる（点が消え、文字が落ち着いた色に）。
    // 閉じる途中・開く途中でも反対の操作はその場から（CSSのトランジションが今の姿から戻る）。
    const fortune=$('fortune');let fortuneTimer=null;
    function fortuneVars(closing){const d=model.fortuneDurations(setting(),closing,$('speed').value);
      fortune.style.setProperty('--d-scrim',d.scrim+'s');fortune.style.setProperty('--d-card',d.card+'s');fortune.style.setProperty('--d-fade',d.fade+'s');return d;}
    function openFortune(){
      if(machine.state!=='open'||fortune.dataset.state==='open')return;win.clearTimeout(fortuneTimer);
      fortuneVars(false);fortune.hidden=false;void fortune.offsetWidth;fortune.dataset.state='open';
      const t=$('ticker');t.dataset.new='false';t.setAttribute('aria-label','運命予報を開く');
      fortuneTimer=win.setTimeout(()=>$('fortune-close').focus?.({preventScroll:true}),model.fortuneDurations(setting(),false,$('speed').value).total*1000);
    }
    function closeFortune(){
      if(fortune.dataset.state!=='open')return;win.clearTimeout(fortuneTimer);
      const d=fortuneVars(true);fortune.dataset.state='closing';
      fortuneTimer=win.setTimeout(()=>{fortune.hidden=true;fortune.dataset.state='closed';$('ticker').focus?.({preventScroll:true});},d.total*1000+20);
    }
    listen($('ticker'),'click',openFortune);listen($('fortune-scrim'),'click',closeFortune);listen($('fortune-close'),'click',closeFortune);
    disposers.push(()=>win.clearTimeout(fortuneTimer));
    listen(doc,'keydown',event=>{if(event.key!=='Escape'||event.repeat||event.target.closest?.('select,input'))return;event.preventDefault();
      if(fortune.dataset.state==='open'){closeFortune();return;}if(fortune.dataset.state==='closing')return;
      if(machine.state==='open')close();else if(machine.state==='closed')open();});
    listen($('replay'),'click',()=>{win.clearTimeout(replayTimer);stop();machine.reset('open');draw();close();
      const d=model.frame('close',0,setting()).total,s=Number($('speed').value||1);replayTimer=win.setTimeout(open,(d/s+.8)*1000);});
    function scrubMax(){const kind=$('scrub-kind').value;const total=model.frame(kind,0,setting()).total;$('scrub').max=String(Math.round(total*1000));}
    listen($('scrub'),'input',()=>{win.clearTimeout(replayTimer);stop();const ms=Number($('scrub').value)||0;$('scrub-time').textContent=String(ms);machine.scrub($('scrub-kind').value,ms/1000);draw();});
    listen($('scrub-kind'),'change',()=>{scrubMax();$('scrub').value='0';$('scrub').dispatchEvent(new win.Event('input'));});
    const settle=()=>{stop();machine.reset(machine.state==='closed'||machine.kind==='close'?'closed':'open');scrubMax();draw();};
    listen($('flow'),'change',()=>{refreshGeometry();settle();});
    listen($('effect-mode'),'change',settle);listen($('speed'),'change',()=>{});listen(media,'change',settle);
    listen(doc,'visibilitychange',()=>{if(doc.hidden)stop();else{last=null;schedule();}});
    listen(win,'resize',fit);if(win.ResizeObserver){const o=new win.ResizeObserver(fit);o.observe(stage);disposers.push(()=>o.disconnect());}
    // 素材の読み込みを待ってから見せる（立ち絵は Git 管理外のフォルダにあるので、無い環境では空のカードになる）。
    const images=[...screen.querySelectorAll('img')];let pending=images.length;
    const done=()=>{if(--pending<=0)$('cover').hidden=true;};
    for(const img of images){if(img.complete)done();else{listen(img,'load',done);listen(img,'error',done);}}
    if(!images.length)$('cover').hidden=true;
    function destroy(){if(destroyed)return;destroyed=true;stop();win.clearTimeout(replayTimer);disposers.splice(0).forEach(d=>d());}
    listen(win,'pagehide',destroy);
    fit();scrubMax();draw();
    return {machine,open,close,draw,destroy};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={mount};else root.Hub2SweepPage=mount(document,root,root.Hub2SweepModel);
})(typeof globalThis!=='undefined'?globalThis:this);
