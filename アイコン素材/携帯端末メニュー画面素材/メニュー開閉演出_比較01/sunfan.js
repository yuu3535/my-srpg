/* ⑤ 日輪の扇の制御。比較専用で、実探索やUnityの入力には接続しない。 */
(function(root) {
  'use strict';
  function mount(doc,win,model,keyModel) {
    const $=id=>doc.getElementById(id),disposers=[],machine=model.machine(),media=win.matchMedia('(prefers-reduced-motion: reduce)');
    const stage=$('stage'),home=$('home'),toggle=$('toggle'),edges=[$('edge-up'),$('edge-down')];
    let raf=null,last=null,destroyed=false,homeReady=false,imageReady=false,viewScale=1,safeRight=0,safeBottom=0,signature='',itemsSignature='',replayTimer=null;
    function listen(node,type,handler,options){node.addEventListener(type,handler,options);disposers.push(()=>node.removeEventListener(type,handler,options));}
    function motion(){return media.matches?'none':model.mode($('effect-mode').value);}
    function interactive(){return machine.state==='open'||machine.state==='opening';}
    function closes(){return ['open','opening','scrub'].includes(machine.state);}
    function ready(){return homeReady&&imageReady;}
    function post(data){home.contentWindow?.postMessage(data,'*');}
    function postConfig(force=false){
      // ホーム内の戻るキーも、そのための空き枠も使わない（アプリの列は元の並びに戻る）。しまうのはホームバー。
      const config={type:'menu-transition-config',owner:$('owner').value,active:interactive(),returnKey:{enabled:false,visible:false,viewScale,safeRight,safeBottom}};
      const next=JSON.stringify(config);if(!force&&next===signature)return;signature=next;post(config);
    }
    function postItems(items,force=false){const next=items.map(v=>v.toFixed(3)).join();if(!force&&next===itemsSignature)return;itemsSignature=next;post({type:'menu-transition-motion',items});}
    function draw(){
      const state=machine.state,none=motion()==='none'&&state!=='scrub';
      stage.dataset.state=state==='scrub'?'opening':state;stage.dataset.owner=$('owner').value;
      let v=machine.visual;
      if(none){
        const p=state==='open'?1:state==='closed'?0:state==='opening'?machine.progress:1-machine.progress;
        v={...model.openPose(),dim:.62*p,world:1,edge:0,ring:0,ring2:0,glintAlpha:0,wash:0,sunAlpha:0,swap:1,items:Array(13).fill(1)};
      }
      // ホームは回さない。見せる形は「扇 − 太陽の円」。太陽はホームの太陽へ入れ替わる（swap）まで .sun-art が描く。
      const fan=model.fanMask(v.fan),masked=!none&&(fan!=='none'||v.swap<1);
      stage.style.setProperty('--fan-mask',fan==='none'?'linear-gradient(#000,#000)':fan);
      // 入れ替えが始まるまでは、太陽の絵の形の穴を開ける（ガラスが二重に重ならない）。始まったら穴をなくし、上の太陽を薄くしていく。
      stage.style.setProperty('--hole-mask',(v.swap??1)>0?'linear-gradient(transparent,transparent)':sunMask);
      home.dataset.masked=String(masked);home.style.transform='none';
      home.style.opacity=String(none?(state==='closed'?0:v.dim/.62):1);home.style.visibility=state==='closed'?'hidden':'visible';
      // 動いているあいだの太陽（元の素材）。回転・縮尺・浮かび上がりはここだけにかける。
      const art=$('sun-art');art.style.opacity=String(none?0:(v.sunAlpha||0)*(1-(v.swap??0)));art.style.transform=`rotate(${v.spin}deg) scale(${v.scale})`;
      art.style.visibility=Number(art.style.opacity)>0?'visible':'hidden';
      const wash=$('wash');wash.style.opacity=String(v.wash||0);
      // 針とふちは太陽と一緒に回る（着地の行きすぎで、針も「出撃」を少し通りすぎて戻る）。
      edges.forEach((edge,i)=>{edge.style.transform=`rotate(${(none?0:v.spin)+(i?1:-1)*v.fan}deg) scale(${none?1:v.scale})`;edge.firstElementChild.style.transform=`scaleX(${v.beam})`;edge.style.opacity=String(v.edge);});
      const ring=(id,value,alpha,grow)=>{$(id).style.opacity=String(value>0&&value<1?alpha*(1-value):0);$(id).style.transform=`scale(${1+grow*value})`;};
      ring('ring',v.ring,.55,.55);ring('ring2',v.ring2||0,.4,.42);
      const glint=$('glint');glint.style.opacity=String(v.glintAlpha||0);glint.firstElementChild.style.transform=`rotate(28deg) translateX(${-120+450*(v.glintPos||0)}px)`;// 太陽の左半分は画面の外なので、見えている右半分を横切らせる。
      // 「世界が透ける」では、暗幕は左から右へ濃くなる帯（CSS）にして、開き具合（0〜1）で出す。ぼかした景色も同じ割合で重ねる。
      const world=$('backdrop').value==='world',openness=Math.max(0,Math.min(1,v.dim/.62));
      $('dim').style.opacity=String(world?openness:v.dim);$('exploration-blur').style.opacity=String(world?openness:0);
      $('exploration').parentElement.style.transform=`scale(${v.world})`;
      postItems(v.items);
      // 「端末」ボタンは探索側のボタン。開いているあいだは出さず、しまう操作は画面の下のホームバー（スマホと同じ）で行う。
      const shown=closes();toggle.hidden=shown;toggle.dataset.mode='open';$('toggle-label').textContent='端末';
      toggle.setAttribute('aria-label','端末を開く');toggle.disabled=!ready();
      // 戻るボタンは上の段（状態の行）と一緒に現れる。しまい始めたら隠す（連打で開き直したりしない）。
      // しまい始めたら押せなくし、押した光が見えるよう140msかけて消す。
      const back=$('back-key'),fading=state==='closing'?Math.max(0,1-machine.progress/.5):0;
      back.hidden=!shown&&fading<=0;back.disabled=!(state==='open'||state==='opening')||sleeping!=null;back.dataset.style=['a','b','c','d'].includes($('back-style').value)?$('back-style').value:'a';
      back.setAttribute('aria-label',back.dataset.style==='d'?'スリープ（端末をしまう）':'戻る（端末をしまう）');
      back.style.opacity=String(state==='closing'?fading*(back.dataset.from??1):none?1:Math.max(0,Math.min(1,v.items[5]??1)));
      if(state!=='closing')back.dataset.from=back.style.opacity;
      home.inert=!interactive();home.tabIndex=interactive()?0:-1;
      const labels={closed:'探索',opening:'開く途中',open:'ホーム',closing:'閉じる途中',scrub:'コマ送りで停止中'};
      $('status').textContent=`${labels[state]}　／　端末の演出：${{full:'あり',short:'短い',none:'なし'}[motion()]}${media.matches?'（OSの動きを減らす設定）':''}`;
      postConfig();
    }
    function stop(){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;last=null;}
    function schedule(){if(!destroyed&&!doc.hidden&&raf===null&&['opening','closing'].includes(machine.state))raf=win.requestAnimationFrame(tick);}
    function tick(now){
      raf=null;if(destroyed||doc.hidden){last=null;return;}
      const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;
      machine.step(dt,model.timeScale(motion(),machine.state==='closing',$('speed').value));draw();
      if(['opening','closing'].includes(machine.state))schedule();else last=null;
    }
    // 動いているあいだの太陽を、ホームの太陽と同じ姿にそろえる。
    // ・色: ホームと同じ仕組み（太陽盤_試作03 の material-engine.js と character-colors.js）で付ける。
    // ・針（光条）の角度: 選んでいるコマンドの方へ回っているので、開く・閉じる瞬間にホームの中から読む。読めないとき（file:// など）は前の角度のまま。
    // ・光の帯の形（--sun-mask）: 自分の太陽の絵をその角度で描いて作る。同じ角度なら作り直さない。
    const arts={diskPanes:$('art-disk-panes'),diskFrame:$('art-disk-frame'),raysPanes:$('art-rays-panes'),raysFrame:$('art-rays-frame')};
    // 太陽の形が作れないとき（file:// など）は、ふちをぼかした円で代わりにする。
    let needle=Math.PI/2,shapeKey=null,sunMask='radial-gradient(circle at 0 195px,#000 196px,transparent 226px)';
    function paintSun(){
      try{
        const colors=win.SolarCharacterColors,materials=win.SolarMaterials;if(!colors||!materials)return;
        const palette=colors.palette($('owner').value);$('sun-defs').innerHTML=materials.filters(palette);
        for(const [img,alpha]of [[arts.diskPanes,.5],[arts.raysPanes,.89]]){img.style.filter='url(#solar-panes-material)';img.style.opacity=String(alpha);}
        for(const img of [arts.diskFrame,arts.raysFrame])img.style.filter=palette.gold?.original?'none':'url(#solar-frame-material)';
      }catch{/* 色を付けられなければ元の絵の色のまま */}
    }
    function sunShape(){
      try{
        const rotor=home.contentDocument?.getElementById('menu-wheel')?.contentDocument?.getElementById('rays-rotor');
        if(rotor){const m=new win.DOMMatrix(rotor.ownerDocument.defaultView.getComputedStyle(rotor).transform);needle=Math.atan2(m.b,m.a);}
      }catch{/* 読めなければ前の角度 */}
      $('art-rays-rotor').style.transform=`rotate(${needle}rad)`;
      try{
        const parts=Object.values(arts);if(parts.some(img=>!img?.complete||!img.naturalWidth))return;
        const key=needle.toFixed(4);if(key===shapeKey)return;
        // 形（不透明度）だけ使う光の帯用。半分の解像度で十分。844×390へ引き伸ばして使う。
        const k=.5,canvas=doc.createElement('canvas');canvas.width=Math.round(844*k);canvas.height=Math.round(390*k);
        const ctx=canvas.getContext('2d');ctx.scale(k,k);
        ctx.save();ctx.translate(0,195);ctx.rotate(needle);
        for(const img of [arts.raysPanes,arts.raysFrame])ctx.drawImage(img,-219.5,-219.5,439,439);
        ctx.restore();for(const img of [arts.diskPanes,arts.diskFrame])ctx.drawImage(img,-243,-8,406,406);
        sunMask=`url("${canvas.toDataURL('image/png')}")`;stage.style.setProperty('--sun-mask',sunMask);shapeKey=key;
      }catch{/* 作れなければ、ぼかした円のまま */}
    }
    // 太陽の「きらっ」（光の帯）は、何度も見るとチカチカしてうるさいので、ふつうは最初に開いたときだけ（原作者 2026-11-06）。
    // 比較用に「毎回」「出さない」も選べる。「初回」はこのページを開いてからの最初の1回（本編ではゲームを起動してから、などを総合担当が決める）。
    let glintShown=false;
    function glintNow(){const m=$('glint-mode').value;return m==='always'||m==='first'&&!glintShown;}
    function open(){
      if(!ready())return;if(machine.state==='closed')sunShape();
      const fresh=machine.state==='closed'||machine.state==='closing',glint=fresh&&glintNow();
      machine.open(glint);if(glint)glintShown=true;draw();schedule();
    }
    function close(){sunShape();machine.close();draw();schedule();}
    // スリープで画面が消えていく途中（まだしまう前）は、Escなどで二重に閉じない。
    function flip(){win.clearTimeout(replayTimer);if(sleeping&&!sleeping.closed)return;if(closes())close();else open();}
    function fit(){
      const width=stage.getBoundingClientRect().width;if(width>0)viewScale=width/844;
      $('world').style.setProperty('--view-scale',String(viewScale));
      const css=win.getComputedStyle?.(stage);
      safeRight=Math.max(0,Math.min(200,parseFloat(css?.getPropertyValue('--safe-right'))||0));safeBottom=Math.max(0,Math.min(200,parseFloat(css?.getPropertyValue('--safe-bottom'))||0));
      // 「端末」と「戻る」は同じ一つのボタン。ホームがアプリ列の右に空けた枠へ実寸で置く（④と同じ）。
      const box=keyModel.toggleKeyBox(viewScale,safeRight,safeBottom),style=toggle.style;toggle.dataset.fit=String(Boolean(box));
      for(const key of ['right','top','width','height'])style[key]=box?box[key]+'px':'';
      style.bottom=box?'auto':'';style.setProperty('--key-icon',box?box.icon+'px':'');style.setProperty('--key-font',box?box.font+'px':'');
      postConfig();
    }
    function readiness(){$('cover').hidden=ready();draw();}
    listen(toggle,'click',event=>{event.stopPropagation();flip();});
    // 戻るボタン: タップ（クリック・Enter）でしまう。独自のスワイプは使わない（OSの操作とぶつけない）。
    // 押した瞬間に金の縁を一度だけ柔らかく光らせる。しまい始めたらボタンは隠れるので、連打しても二重にしまったり開き直したりしない。
    const backKey=$('back-key');
    listen(backKey,'click',event=>{
      event.stopPropagation();if(backKey.disabled||!interactive())return;
      backKey.classList?.remove('is-pressed');void backKey.offsetWidth;backKey.classList?.add('is-pressed');
      if(backKey.dataset.style==='d')sleep();else close();
    });
    // D スリープ: 画面を消して（黒い幕）、真っ暗なあいだにしまい、幕が引いて探索へ戻る。「なし」の設定では普通にしまう。
    let sleeping=null;
    function sleepFrame(now){
      if(!sleeping||destroyed)return;
      if(sleeping.last!==null)sleeping.t+=Math.max(0,(now-sleeping.last)/1000)*model.speed($('speed').value);sleeping.last=now;
      const s=model.sleepVeil(sleeping.t),veil=$('sleep-veil');
      veil.style.visibility='visible';veil.style.opacity=String(s.veil);
      if(s.closed&&!sleeping.closed){sleeping.closed=true;stop();machine.reset();draw();}
      if(s.done){veil.style.opacity='0';veil.style.visibility='hidden';sleeping=null;return;}
      sleeping.raf=win.requestAnimationFrame(sleepFrame);
    }
    function sleep(){
      if(sleeping||!interactive())return;
      if(motion()==='none'){close();return;}
      backKey.disabled=true;sleeping={t:0,last:null,closed:false,raf:null};sleeping.raf=win.requestAnimationFrame(sleepFrame);
    }
    disposers.push(()=>{if(sleeping?.raf!=null)win.cancelAnimationFrame(sleeping.raf);sleeping=null;});
    listen(backKey,'animationend',()=>backKey.classList?.remove('is-pressed'));
    listen($('back-style'),'change',()=>draw());
    // ホームの背景の見比べ。ホームの暗い板（html・body・#menu-screen の地の色）を、このページの中でだけ透明にする。
    // ホームのファイルは変えない（同じ origin のときだけ効く。file:// では今のまま）。
    function applyBackdrop(){
      const world=$('backdrop').value==='world';stage.dataset.backdrop=world?'world':'panel';
      try{
        const hd=home.contentDocument;if(!hd?.head)return;let tag=hd.getElementById('sunfan-world-backdrop');
        if(world&&!tag){tag=hd.createElement('style');tag.id='sunfan-world-backdrop';tag.textContent='html,body,#menu-screen{background:transparent!important}';hd.head.appendChild(tag);}
        if(!world&&tag)tag.remove();
      }catch{/* 透かせなければ今のまま */}
      draw();
    }
    listen($('backdrop'),'change',applyBackdrop);listen(home,'load',applyBackdrop);
    listen($('exploration'),'load',()=>{imageReady=true;readiness();});listen($('exploration'),'error',()=>{imageReady=true;readiness();});
    if($('exploration').complete)imageReady=true;
    listen(home,'load',()=>{signature='';itemsSignature='';postConfig(true);draw();});
    listen(win,'message',event=>{
      if(event.source!==home.contentWindow||!event.data)return;
      if(win.location.protocol!=='file:'&&event.origin!==win.location.origin)return;
      const type=event.data.type;
      if(type==='menu-transition-ready'){homeReady=event.data.ready===true;readiness();}
      else if(type==='menu-transition-escape'||type==='menu-transition-back'&&interactive())flip();
    });
    listen(doc,'keydown',event=>{if(event.key!=='Escape'||event.target.closest?.('select,input'))return;event.preventDefault();if(!event.repeat)flip();});
    listen($('scrub'),'input',()=>{win.clearTimeout(replayTimer);stop();sunShape();const ms=Number($('scrub').value)||0;$('scrub-time').textContent=String(ms);machine.scrub(ms/1000,$('glint-mode').value!=='off');draw();});
    // 「初回だけ」を選び直したら、次に開くときをもう一度「初回」として見られるようにする。
    listen($('glint-mode'),'change',()=>{glintShown=false;});
    listen($('replay'),'click',()=>{win.clearTimeout(replayTimer);stop();machine.reset();open();
      const wait=(model.timing.open.end/model.timeScale(motion(),false,$('speed').value)+.6)*1000;replayTimer=win.setTimeout(close,wait);});
    const settle=()=>{stop();machine.settle();draw();};
    listen($('effect-mode'),'change',settle);listen($('speed'),'change',settle);listen(media,'change',settle);
    listen($('owner'),'change',()=>{paintSun();draw();});
    listen(doc,'visibilitychange',()=>{if(doc.hidden)stop();else{last=null;schedule();}});
    listen(win,'resize',fit);
    if(win.ResizeObserver){const observer=new win.ResizeObserver(fit);observer.observe(stage);disposers.push(()=>observer.disconnect());}
    function destroy(){if(destroyed)return;destroyed=true;stop();win.clearTimeout(replayTimer);disposers.splice(0).forEach(dispose=>dispose());}
    listen(win,'pagehide',destroy);
    paintSun();fit();readiness();
    return {machine,open,close,flip,draw,destroy,get ready(){return ready();}};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={mount};else root.SunFanPage=mount(document,root,root.SunFanModel,root.MenuTransitionModel);
})(typeof globalThis!=='undefined'?globalThis:this);
