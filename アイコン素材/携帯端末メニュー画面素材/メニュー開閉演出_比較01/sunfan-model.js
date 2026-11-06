/* ⑤「日輪の扇」の時刻表と見た目の値。DOMに触れない。比較専用で、ゲーム本編・Unityには接続しない。
   開く: 左端から太陽盤が回りながら昇る → 光の針が「出撃」を指す → 針が上下に割れて光の扇が開き、照らされた所からメニューが現れる。
   閉じる: 扇がたたまれて針に戻る → 針が太陽へ吸い込まれる → 太陽が回って沈む。 */
(function(root) {
  'use strict';
  const viewport=Object.freeze({width:844,height:390});
  // 太陽盤の中心（ホームの844×390の座標）と、太陽だけを見せる円の半径。光条の絵440pxの外周に合わせる。
  const sun=Object.freeze({x:0,y:195,radius:232});
  const timing=Object.freeze({
    open:Object.freeze({end:.56,bloom:.22,sunIn:.08,spinArrive:.13,settle:.20,overshoot:6,beamStart:.14,beamLength:.06,edgeIn:.12,fanStart:.17,fanLength:.26,fanAngle:92,
      edgeOut:.40,edgeOutLength:.07,ringStart:.19,ringLength:.28,ring2Start:.27,ring2Length:.29,dim:.18,world:.40,itemLength:.11,itemMargin:3,startSpin:-110,startScale:1.25,
      // 磨き（2026-11-06）: ガラスを走る光、ステンドグラス越しの光の差しこみ。
      // 動いている太陽（元の素材の層）から、ホーム自身の太陽へ入れ替える時刻。項目が出そろってから。
      swapStart:.38,swapLength:.10,
      glintStart:.12,glintLength:.24,glintPeak:.6,washStart:.17,washIn:.09,washOut:.30,washOutLength:.22,washPeak:.26}),
    close:Object.freeze({end:.28,items:.06,fanStart:.02,fanLength:.17,beamStart:.17,beamLength:.06,sinkStart:.15,sinkLength:.13,endSpin:100,endScale:.85,
      dim:.23,dimLength:.05,world:.20,worldLength:.08}),
    short:Object.freeze({open:.24,close:.15}),none:Object.freeze({open:.10,close:.08})
  });
  // 13項目（0〜4 太陽盤＝身支度・出撃・探索・支援会話・セーブ、5 上の状態、6 運命予報の帯、7 場所の絵、8〜12 アプリ）の
  // 太陽の中心から見た角度（度、水平から上下どちらでも正）。ホームの実寸の中心座標から求めた値（2026-11-06 ブラウザで計測）。
  // 扇がその角度まで開いた瞬間に出る。だから「出撃」（0度）が必ず最初になる。
  const itemAngles=Object.freeze([22.2,0,22.2,42.8,42.8,16.6,13.3,1.8,19.6,15.7,13.0,11.1,9.7]);
  const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
  const mix=(a,b,p)=>a+(b-a)*p;
  const portion=(t,start,length)=>clamp((t-start)/length);
  function bezier(x1,y1,x2,y2,value) {
    const x=clamp(value);if(x===0||x===1)return x;
    const axis=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
    let lo=0,hi=1;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(axis(mid,x1,x2)<x)lo=mid;else hi=mid;}
    return axis((lo+hi)/2,y1,y2);
  }
  const easeOut=p=>bezier(.16,1,.3,1,p),cubicOut=p=>1-Math.pow(1-clamp(p),3);
  const fanEase=p=>bezier(.4,.45,.2,1,p),fanClose=p=>bezier(.55,0,.75,.2,p),sink=p=>bezier(.5,0,.9,.4,p);
  // 扇が各項目の角度に届く時刻（閉じた状態から開いたとき）。二分法で一度だけ求める。
  const itemStarts=Object.freeze(itemAngles.map(angle=>{
    const o=timing.open,target=Math.min(1,(angle+o.itemMargin)/o.fanAngle);let lo=0,hi=1;
    for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(fanEase(mid)<target)lo=mid;else hi=mid;}
    return o.fanStart+hi*o.fanLength;
  }));
  function closedPose() {
    const o=timing.open;
    return {sunAlpha:0,swap:0,spin:o.startSpin,scale:o.startScale,fan:0,beam:0,edge:0,ring:0,ring2:0,glintPos:0,glintAlpha:0,wash:0,dim:0,world:1,opacity:1,items:Array(itemAngles.length).fill(0)};
  }
  function openPose(){return pose(timing.open.end,closedPose());}
  function pose(seconds,from=closedPose(),closing=false) {
    const t=Math.max(0,Number.isFinite(seconds)?seconds:0),v={...from,items:from.items.slice()};
    if(closing){
      const c=timing.close,sunk=sink(portion(t,c.sinkStart,c.sinkLength));
      v.items=from.items.map(item=>mix(item,0,portion(t,0,c.items)));
      v.fan=mix(from.fan,0,fanClose(portion(t,c.fanStart,c.fanLength)));
      // 線は残さない: 針は太陽へ吸い込まれて消え、そのあとで暗幕を戻す。
      v.beam=mix(from.beam,0,bezier(.6,0,.9,.5,portion(t,c.beamStart,c.beamLength)));
      v.edge=mix(from.edge,1,portion(t,0,.04))*(v.beam>0?1:0);
      v.sunAlpha=mix(from.sunAlpha,0,sunk);
      // 閉じ始めにすぐ、ホームの太陽から動かせる太陽へ戻す（扇がたたまれる前に）。
      v.swap=mix(from.swap,0,portion(t,0,.08));v.spin=mix(from.spin,c.endSpin,sunk);v.scale=mix(from.scale,c.endScale,sunk);
      v.dim=mix(from.dim,0,portion(t,c.dim,c.dimLength));v.world=mix(from.world,1,easeOut(portion(t,c.world,c.worldLength)));
      // 波紋が途中なら、急いで広げ切って消す（いきなり消さない）。
      // 閉じ切ったら0に戻し、次に開くときまた波紋が出るようにする（0も1も見えないので見た目は飛ばない）。
      v.ring=t>=c.end?0:from.ring>0?mix(from.ring,1,portion(t,0,.08)):0;
      v.ring2=t>=c.end?0:from.ring2>0?mix(from.ring2,1,portion(t,0,.08)):0;
      // 光の名残は閉じ始めにすぐ消す。
      v.glintAlpha=mix(from.glintAlpha,0,portion(t,0,.05));v.wash=mix(from.wash,0,portion(t,0,.06));
    }else{
      const o=timing.open,bloom=easeOut(portion(t,0,o.bloom));
      // 太陽は太陽の形のまま、回りながら大きめから縮んで着き、最初の80msで浮かび上がる。
      v.sunAlpha=mix(from.sunAlpha,1,cubicOut(portion(t,0,o.sunIn)));v.scale=mix(from.scale,1,bloom);
      v.swap=mix(from.swap,1,portion(t,o.swapStart,o.swapLength));
      // 重みのある着地: 少し回りすぎてから戻る。行きすぎる量は残りの回転に比例させ、開き直しで揺れすぎない。
      // 扇がメニューを見せ始める（170ms〜）前に戻り切る。ホーム全体が回るので、遅いと画面が傾いて見える。
      const over=-Math.sign(from.spin)*o.overshoot*clamp(Math.abs(from.spin)/Math.abs(o.startSpin));
      v.spin=t<=o.spinArrive?mix(from.spin,over,easeOut(portion(t,0,o.spinArrive))):mix(over,0,bezier(.45,0,.35,1,portion(t,o.spinArrive,o.settle-o.spinArrive)));
      v.ring2=from.ring2>0?mix(from.ring2,1,portion(t,0,.08)):portion(t,o.ring2Start,o.ring2Length);
      // ガラスを走る光: 着地の瞬間に、太陽の上を斜めの光の帯が一度だけ横切る。
      // 何度も開くとチカチカしてうるさい（原作者 2026-11-06）ので、光の帯を出すかは開くたびに決める（glintOn。ふつうは初回だけ）。
      if(from.glintAlpha>0||from.glintOn===false){v.glintPos=from.glintPos;v.glintAlpha=mix(from.glintAlpha,0,portion(t,0,.05));}
      else{v.glintPos=portion(t,o.glintStart,o.glintLength);v.glintAlpha=o.glintPeak*Math.sin(Math.PI*v.glintPos);}
      // ステンドグラス越しの光: 扇の中に太陽から温かい光が差しこみ、メニューが出そろう頃に引いていく。
      v.wash=mix(from.wash,o.washPeak,cubicOut(portion(t,o.washStart,o.washIn)))*(1-portion(t,o.washOut,o.washOutLength));
      v.beam=mix(from.beam,1,cubicOut(portion(t,o.beamStart,o.beamLength)));
      v.fan=mix(from.fan,o.fanAngle,fanEase(portion(t,o.fanStart,o.fanLength)));
      v.edge=mix(from.edge,1,portion(t,o.edgeIn,.04))*(1-portion(t,o.edgeOut,o.edgeOutLength));
      v.ring=from.ring>0?mix(from.ring,1,portion(t,0,.08)):portion(t,o.ringStart,o.ringLength);
      v.dim=mix(from.dim,.62,cubicOut(portion(t,0,o.dim)));v.world=mix(from.world,1.04,easeOut(portion(t,0,o.world)));
      // 途中から開き直したときは、もう扇の内側にある項目をすぐ出し始める。
      v.items=from.items.map((item,i)=>mix(item,1,cubicOut(portion(t,from.fan>0&&itemAngles[i]<=from.fan?0:itemStarts[i],o.itemLength))));
    }
    return v;
  }
  // 扇の形のマスク（太陽の中心から右向きに±fan度）。太陽そのものは、元の素材（太陽盤_試作03）で描く別の層が受け持つ（sunfan.html の .sun-art）。
  // 以前は「広がる円の窓」で太陽を見せていたが、昇る途中で光条の先が円で切れ、窓の中のホームの暗い地が黒い円盤に見えた（原作者指摘 2026-11-06）。
  // 開き切ったら（90度以上）マスクしない。
  function fanMask(fan) {
    if(fan>=90)return 'none';
    const h=Math.max(0,Number.isFinite(fan)?fan:0),a=(90-h).toFixed(3),b=(90+h).toFixed(3);
    return `conic-gradient(from 0deg at ${sun.x}px ${sun.y}px,transparent ${a}deg,#000 ${a}deg,#000 ${b}deg,transparent ${b}deg)`;
  }
  function mode(value){return ['full','short','none'].includes(value)?value:'full';}
  function speed(value){const n=Number(value);return [.25,.5,1,2].includes(n)?n:1;}
  // 実時間1秒あたりに進める時刻表の秒数。「短い」は同じ動きを縮め、「なし」は短いフェードだけ（描く側で扱う）。
  function timeScale(setting,closing,rate=1) {
    const m=mode(setting),end=closing?timing.close.end:timing.open.end,real=m==='short'?(closing?timing.short.close:timing.short.open):m==='none'?(closing?timing.none.close:timing.none.open):end;
    return end/real*speed(rate);
  }
  function machine() {
    let state='closed',elapsed=0,current=closedPose(),from=current;
    const end=()=>state==='closing'?timing.close.end:timing.open.end;
    function begin(next){from={...current,items:current.items.slice()};elapsed=0;state=next;}
    function settle(){if(state==='opening'){current=pose(timing.open.end,from);state='open';}else if(state==='closing'){current=pose(timing.close.end,from,true);state='closed';}}
    return {
      // glint: この開き方で光の帯を出すか（省略時は出す）。
      open(glint=true){if(state==='opening')settle();else if(state!=='open'){begin('opening');from.glintOn=current.glintOn=glint!==false;}},
      close(){if(state!=='closed'&&state!=='closing')begin('closing');},
      toggle(){if(state==='open'||state==='opening'||state==='scrub')this.close();else this.open();},
      step(seconds,scale){if(state!=='opening'&&state!=='closing')return;elapsed+=Math.max(0,Number.isFinite(seconds)?seconds:0)*Math.max(0,scale||0);
        const closing=state==='closing';current=pose(Math.min(elapsed,end()),from,closing);if(elapsed>=end())settle();},
      // コマ送り: 閉じた状態から開いたときの、その時刻の見た目を出す。
      scrub(seconds,glint=true){state='scrub';from={...closedPose(),glintOn:glint!==false};current=pose(seconds,from);},
      settle,reset(){state='closed';elapsed=0;current=closedPose();from=current;},
      get state(){return state;},get progress(){return state==='open'?1:state==='closed'?0:Math.min(1,elapsed/end());},
      get visual(){return {...current,items:current.items.slice()};}
    };
  }
  const api=Object.freeze({viewport,sun,timing,itemAngles,itemStarts,clamp,bezier,closedPose,openPose,pose,fanMask,mode,speed,timeScale,machine});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SunFanModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
