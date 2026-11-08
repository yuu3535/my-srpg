/* Hub2 の帯スイープの制御。比較専用で、実探索やUnityの入力には接続しない。 */
(function(root) {
  'use strict';
  function mount(doc,win,model) {
    const $=id=>doc.getElementById(id),disposers=[],machine=model.machine(),media=win.matchMedia('(prefers-reduced-motion: reduce)');
    const stage=$('stage'),screen=$('screen'),band=$('band'),runner=$('runner');
    let raf=null,last=null,destroyed=false,scale=1,replayTimer=null,geometry=null;
    // 開閉の形: 切り裂き（原作者の指摘 2026-11-08。初期値）／帯・右上から／帯・仕様書どおり。
    function style(){return $('flow').value==='tear'?'tear':'band';}
    function flowName(){return $('flow').value==='spec'?'spec':'topright';}
    function refreshGeometry(){geometry=model.geometry(model.base.width,model.base.height,model.flow(flowName()).angle);}
    // 切り裂きの線は、押した星の中心から始まる（CLOSE も MENU も右上）。星の位置は画面から測る。
    let tearG=null;
    function starCenter(id){const el=$(id),r=el.getBoundingClientRect?.(),sr=screen.getBoundingClientRect?.();
      if(!r||!sr||!r.width||!sr.width)return {x:model.base.width-54,y:58};const k=sr.width/model.base.width,x=(r.left+r.width/2-sr.left)/k,y=(r.top+r.height/2-sr.top)/k;
      return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:{x:model.base.width-54,y:58};}
    function refreshTear(kind){tearG=model.tearGeometry(model.base.width,model.base.height,starCenter(kind==='open'?'menu-star-wrap':'close-star-wrap'));}
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
    // 時間帯アイコン（§3-6）。既存の TimeOfDay（太陽盤_コマンド試作01/time-of-day.js）で作る。メニューが出るたびに作り直し、朝の日の出・夕方の日没を1回流す。
    const phaseNames={morning:'朝',day:'昼',evening:'夕方',night:'夜'};let menuShown=null;
    function renderTime(){
      const tod=win.TimeOfDay,slot=$('time-slot'),phase=Object.hasOwn(phaseNames,$('phase').value)?$('phase').value:'morning';
      slot.setAttribute?.('aria-label','時間帯：'+phaseNames[phase]);if(!tod)return;
      slot.innerHTML=tod.icon(phase,'hub2').replaceAll('time-of-day-art/','../太陽盤_コマンド試作01/time-of-day-art/');
    }
    // 切り裂きを描く。切れ目の金の線・流星・裂け目のふちは SVG、裂け目はメニューの clip-path。
    const tearSvg=$('tear'),seam=$('tear-seam'),edgeU=$('tear-edge-u'),edgeL=$('tear-edge-l'),met=$('meteor'),tail=$('meteor-tail'),tailGrad=$('meteor-grad');
    function drawTear(f,menu){
      const tr=f.tear;
      if(!tr){tearSvg.style.visibility='hidden';menu.style.clipPath='';return;}
      const g=tearG||model.tearGeometry();tearSvg.style.visibility='visible';
      // 切れ目（A から流星の今の位置まで）。裂け始めたら薄れていく。
      const m=model.meteor(tr.c,g),end=tr.phase==='flare'?g.S:(tr.phase==='cut'?m:g.B2);
      seam.setAttribute('d',tr.phase==='flare'?'':`M${g.A.x} ${g.A.y}L${end.x} ${end.y}`);seam.style.opacity=String(tr.phase==='open'?Math.max(0,1-tr.o*3):1);
      // 流星（星と光の尾）。切っている間だけ。
      if(tr.phase==='cut'){const tx=m.x-g.u.x*model.tear.tail,ty=m.y-g.u.y*model.tear.tail;
        met.style.visibility='visible';met.setAttribute('transform',`translate(${m.x} ${m.y}) rotate(${m.rotate}) scale(${m.scale})`);
        tail.setAttribute('x1',tx);tail.setAttribute('y1',ty);tail.setAttribute('x2',m.x);tail.setAttribute('y2',m.y);
        tailGrad.setAttribute('x1',tx);tailGrad.setAttribute('y1',ty);tailGrad.setAttribute('x2',m.x);tailGrad.setAttribute('y2',m.y);tail.style.visibility='visible';}
      else{met.style.visibility='hidden';tail.style.visibility='hidden';}
      // 裂け目。閉じる＝メニューの裂け目の外だけ見せる、開く＝裂け目の中だけメニューを見せる。
      if(tr.phase==='open'){const l=model.tearLens(tr.o,g),lens=model.lensPath(tr.o,g),W=model.base.width,H=model.base.height;
        menu.style.clipPath=tr.clip==='outside'?`path(evenodd,"M0 0H${W}V${H}H0Z ${lens}")`:`path("${lens}")`;
        edgeU.setAttribute('d',model.edgePath(l.upper));edgeL.setAttribute('d',model.edgePath(l.lower));const fade=String(Math.max(0,1-Math.max(0,tr.o-.55)/.45));edgeU.style.opacity=fade;edgeL.style.opacity=fade;}
      else{menu.style.clipPath='';edgeU.setAttribute('d','');edgeL.setAttribute('d','');}
    }
    function draw(){
      const f=machine.frame(setting(),style());
      screen.dataset.reduced=String(setting()==='none');
      if(f.menu&&menuShown===false)renderTime();menuShown=f.menu;
      const menu=$('menu');menu.style.display=f.menu?'':'none';menu.style.opacity=String(f.menuOpacity??1);
      $('menu-star').hidden=!f.explore;
      if(f.sweep===null||f.sweep===undefined)band.style.visibility='hidden';else placeBand(f.sweep,machine.kind);
      drawTear(f,menu);
      const mw=$('menu-star-wrap'),mp=f.exploreBurst!==null&&f.exploreBurst!==undefined?model.burstPose(f.exploreBurst):null;
      mw.style.transform=mp?`rotate(${mp.rotate}deg) scale(${mp.scale})`:'';mw.style.opacity=mp?String(mp.opacity):'';
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
      machine.step(dt,setting(),style());draw();
      if(machine.locked)schedule();else last=null;
    }
    function close(){if(machine.state==='open')refreshTear('close');if(machine.close()){draw();schedule();}}
    function open(){if(machine.state==='closed')refreshTear('open');if(machine.open()){draw();schedule();}}
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
    // ティッカー（§3-4）は流さない（原作者 2026-11-08）。押すと運命予報カードが開き、既読になる。
    listen($('ticker'),'click',openFortune);listen($('fortune-scrim'),'click',closeFortune);listen($('fortune-close'),'click',closeFortune);
    disposers.push(()=>win.clearTimeout(fortuneTimer));
    // NEW の札（§3-5）は太陽盤の「支援会話」の札の右上に付ける。太陽盤は 844×390 基準のページを2倍で表示しているので、中の座標を2倍すると画面の座標になる。
    // 太陽盤が回っている間は札の動きに1コマ遅れて浮いて見える（原作者 2026-11-08「NEW がクルクルしてるとコマンドから浮く」）ので、
    // 動いている間は消しておき、止まったら軽く弾んで出す。
    let badgeRaf=null,badgeLast=null,badgeStill=0;
    function badgeTarget(){
      const doc2=$('sun-wheel').contentDocument,cmd=doc2&&[...doc2.querySelectorAll('.command')].find(b=>b.textContent.includes('支援会話'));
      const face=cmd&&(cmd.querySelector('.nameplate-face')||cmd);if(!face)return null;const r=face.getBoundingClientRect();return {x:r.right*2-44,y:r.top*2-22};
    }
    // 押してから回り始めるまでに間があるので、追いかけは止めずに毎コマ続ける（1コマに位置を1回測るだけ）。止まって約0.1秒で出す。
    function followBadge(){if(badgeRaf!==null||destroyed)return;
      const nb=doc.querySelector?.('.new-badge');if(!nb)return;
      const loop=()=>{badgeRaf=null;if(destroyed)return;let p=null;try{p=badgeTarget();}catch{}
        if(p){const moved=!badgeLast||Math.hypot(p.x-badgeLast.x,p.y-badgeLast.y)>.3;badgeLast=p;
          if(moved){badgeStill=0;if(nb.dataset.moving!=='true')nb.dataset.moving='true';}else badgeStill++;
          if(badgeStill===6){nb.style.left=p.x+'px';nb.style.top=p.y+'px';nb.dataset.moving='false';}}
        badgeRaf=win.requestAnimationFrame(loop);};
      loop();}
    // 太陽盤の中を押したら（回り始める前に）追いかけ始める。
    listen($('sun-wheel'),'load',()=>{try{const d2=$('sun-wheel').contentDocument;d2.addEventListener('pointerdown',followBadge);d2.addEventListener('keydown',followBadge);}catch{}followBadge();});
    disposers.push(()=>{if(badgeRaf!==null)win.cancelAnimationFrame(badgeRaf);});
    listen(win,'message',event=>{if(event.data&&event.data.type==='solar-menu-state'&&event.source===$('sun-wheel').contentWindow)followBadge();});
    // 埋め込んだ太陽盤（iframe）の中で Esc を押したときも、同じように閉じる。
    listen(win,'message',event=>{if(event.data&&event.data.type==='solar-menu-escape'&&event.source===$('sun-wheel').contentWindow)escape();});
    function escape(){if(fortune.dataset.state==='open'){closeFortune();return;}if(fortune.dataset.state==='closing')return;
      if(machine.state==='open')close();else if(machine.state==='closed')open();}
    listen(doc,'keydown',event=>{if(event.key!=='Escape'||event.repeat||event.target.closest?.('select,input'))return;event.preventDefault();escape();});
    listen($('replay'),'click',()=>{win.clearTimeout(replayTimer);stop();machine.reset('open');draw();close();
      const d=total('close'),s=Number($('speed').value||1);replayTimer=win.setTimeout(open,(d/s+.8)*1000);});
    function total(kind){return (style()==='tear'?model.tearFrame(kind,0,setting()):model.frame(kind,0,setting())).total;}
    function scrubMax(){$('scrub').max=String(Math.round(total($('scrub-kind').value)*1000));}
    listen($('scrub'),'input',()=>{win.clearTimeout(replayTimer);stop();const ms=Number($('scrub').value)||0;$('scrub-time').textContent=String(ms);refreshTear($('scrub-kind').value);machine.scrub($('scrub-kind').value,ms/1000);draw();});
    listen($('scrub-kind'),'change',()=>{scrubMax();$('scrub').value='0';$('scrub').dispatchEvent(new win.Event('input'));});
    const settle=()=>{stop();machine.reset(machine.state==='closed'||machine.kind==='close'?'closed':'open');scrubMax();draw();};
    listen($('flow'),'change',()=>{refreshGeometry();settle();});
    listen($('phase'),'change',renderTime);
    // ページ送りの菱形の配色（原作者に選んでもらう）。
    // 3色の案（ref・crimson）では、並び順・めくり方・今のページから各菱形の色を決める。菱形を押してもページが変わる。
    const dias=[...(screen.querySelectorAll?.('.page-dia')||[])];
    function applyDia(){
      const sch=['cycle','crimson','ref','gold','moon','ember','spec'].includes($('dia').value)?$('dia').value:'cycle',three=sch==='ref'||sch==='crimson';screen.dataset.dia=sch;
      const accent=sch==='ref'?'藤色':'赤';for(const opt of [...($('dia-order').options||[])])opt.textContent=opt.value.split('').map(k=>k==='t'?'水色':k==='g'?'金':accent).join('・');
      $('dia-order').disabled=!three;$('dia-mode').disabled=!three; // 巡る案では並び・めくり方は使わない（色は時間で巡る）
      const page=Number($('dia-page').value)||0,cols=model.diaColors(sch,$('dia-order').value,$('dia-mode').value,page);
      dias.forEach((d,i)=>{d.classList.toggle('on',i===page);d.dataset.key=cols[i].key;d.style.setProperty('--dc',cols[i].rgb);});
    }
    for(const id of ['dia','dia-order','dia-mode','dia-page'])listen($(id),'change',applyDia);
    dias.forEach((d,i)=>listen(d,'click',e=>{e.stopPropagation?.();$('dia-page').value=String(i);applyDia();}));
    applyDia();
    // メインイベントの角の菱形（見比べ用）。
    const applyDeco=()=>{screen.dataset.eventDia=['br','spec','cards','none'].includes($('event-dia').value)?$('event-dia').value:'spec';};
    listen($('event-dia'),'change',applyDeco);applyDeco();
    // 立ち絵の位置合わせ（確認用）。--l／--t／--w（カード内の px）を、ドラッグとホイールで変える。決めた値は「位置をコピー」で渡してもらう。
    const cards=[...(screen.querySelectorAll?.('.card')||[])];let drag=null;
    const artOf=card=>card.querySelector('.card-art img');
    const px=(img,name)=>parseFloat(img.style.getPropertyValue(name))||0;
    function artText(){return cards.map(c=>{const img=artOf(c),name=c.querySelector('.card-label')?.textContent.replace(/^\d+/,'')||'';return `${name}: --w:${px(img,'--w').toFixed(0)}px; --l:${px(img,'--l').toFixed(0)}px; --t:${px(img,'--t').toFixed(0)}px`;}).join('\n');}
    function showArt(){const out=$('art-values');out.hidden=!$('art-adjust').checked;out.textContent=artText();}
    listen($('art-adjust'),'change',()=>{screen.dataset.adjust=String($('art-adjust').checked);showArt();});
    for(const card of cards){
      listen(card,'pointerdown',e=>{if(!$('art-adjust').checked)return;e.preventDefault();const img=artOf(card);drag={img,x:e.clientX,y:e.clientY,l:px(img,'--l'),t:px(img,'--t'),id:e.pointerId};card.setPointerCapture?.(e.pointerId);});
      listen(card,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;drag.img.style.setProperty('--l',(drag.l+(e.clientX-drag.x)/scale)+'px');drag.img.style.setProperty('--t',(drag.t+(e.clientY-drag.y)/scale)+'px');showArt();});
      const end=e=>{if(drag&&drag.id===e.pointerId)drag=null;};listen(card,'pointerup',end);listen(card,'pointercancel',end);
      // ホイール: カードの真ん中を中心に大きさを変える（顔の位置がずれにくいように）。
      listen(card,'wheel',e=>{if(!$('art-adjust').checked)return;e.preventDefault();const img=artOf(card),w=px(img,'--w'),k=e.deltaY<0?1.03:1/1.03,nw=Math.max(110,Math.min(900,w*k)),cx=55,cy=135,f=nw/w;
        img.style.setProperty('--w',nw+'px');img.style.setProperty('--l',(cx-(cx-px(img,'--l'))*f)+'px');img.style.setProperty('--t',(cy-(cy-px(img,'--t'))*f)+'px');showArt();},{passive:false});
    }
    listen($('art-copy'),'click',()=>{const t=artText();$('art-values').hidden=false;$('art-values').textContent=t;win.navigator?.clipboard?.writeText(t).catch(()=>{});});
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
    fit();scrubMax();renderTime();draw();
    return {machine,open,close,draw,destroy};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={mount};else root.Hub2SweepPage=mount(document,root,root.Hub2SweepModel);
})(typeof globalThis!=='undefined'?globalThis:this);
