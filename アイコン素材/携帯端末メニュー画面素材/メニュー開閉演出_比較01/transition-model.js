/* 演出の比較専用。ゲーム進行・Unity・DOMには触れない。 */
(function(root) {
  'use strict';
  const variants=Object.freeze({
    approach:Object.freeze({label:'③＋寄り',duration:.36,description:'小さく浮いた端末ごと寄り、内窓が全画面になると枠は外へ抜ける。'}),
    dissolve:Object.freeze({label:'修正版：③＋小さな浮き上がり',duration:.36,description:'軽く浮かせ、枠だけを薄くしながら全画面のホームへ合わせる。'}),
    raise:Object.freeze({label:'①：構えて寄る',duration:.50,description:'下から構えるように現れ、傾きを戻しながら画面へ寄る。SDの動作は付けない。'}),
    frameout:Object.freeze({label:'④ 枠抜け全画面（新案）',duration:.53,description:'下から浮いた端末へ寄り、線から画面が点き、項目が順に現れる。閉じる動きは短く畳む。'})
  });
  // ④の時刻表（秒）。2026-11-06 原作者フィードバック①〜③を反映した試作値。仕様の表と同じ値にする。
  const frameoutTiming=Object.freeze({
    open:Object.freeze({end:.53,arrive:.171,zoomEnd:.38,dim:.16,world:.40,lineIn:.09,lineInLength:.03,screen:.12,screenLength:.12,lineGlowFade:.45,
      itemStart:.19,itemStep:.018,itemLength:.12}),
    close:Object.freeze({end:.29,items:.06,screen:.02,screenLength:.08,lineFade:.08,lineFadeLength:.04,fall:.09,fallLength:.15,dim:.12,dimLength:.12,world:.12,worldLength:.17})
  });
  // 出す順番。添字はホームへ渡す13項目（0〜4 太陽盤＝身支度・出撃・探索・支援会話・セーブ、5 上の状態、6 運命予報の帯、7 場所の絵＝今日のタスク、8〜12 アプリ）。
  // よく押す「出撃」を最初に、次に太陽盤の残り（中央に近い順）、アプリ、場所の絵、上の情報。
  const frameoutOrder=Object.freeze([1,2,0,3,4,8,9,10,11,12,7,5,6]);
  const frameoutRank=Object.freeze(frameoutOrder.reduce((rank,item,i)=>{rank[item]=i;return rank;},Array(13).fill(0)));
  const viewport=Object.freeze({width:844,height:390});
  // 既存の端末原本1799×874。844:390の内窓はX202.241...／Y109／W1391.517...／H643。
  const frame=Object.freeze({width:1799,height:874,x:202.2410256410,y:109,innerWidth:643*844/390,innerHeight:643});
  const frameBox=Object.freeze({left:-frame.x*390/643,top:-frame.y*390/643,width:frame.width*390/643,height:frame.height*390/643});
  const framedScale=Math.min(viewport.width/frameBox.width,viewport.height/frameBox.height);
  const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
  const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
  function mode(value) { return ['full','short','none'].includes(value)?value:'full'; }
  function effectiveMode(value,reduced) { return reduced?'none':mode(value); }
  function speed(value) { const n=Number(value);return [.25,.5,1,2].includes(n)?n:1; }
  function duration(id,setting='full',closing=false,speed=1) {
    const value=mode(setting),factor=[.25,.5,1,2].includes(speed)?speed:1;
    const seconds=value==='none'?(closing?.08:.10):value==='short'?(closing?.12:.18):closing?(id==='frameout'?frameoutTiming.close.end:.20):(variants[id]||variants.approach).duration;
    return seconds/factor;
  }
  function pose(id,progress,setting='full') {
    const p=clamp(progress),value=mode(setting);
    if(value==='none')return {scale:1,y:0,tilt:0,opacity:smooth(p),frameOpacity:0,dim:.38*smooth(p)};
    if(id==='frameout')return frameoutPose(p*frameoutTiming.open.end);
    const rise=smooth(p/.36),zoom=smooth((p-.30)/.70),large=id==='raise';
    const startScale=large?.54:framedScale;
    return {scale:startScale+(1-startScale)*zoom,y:(large?260:16)*(1-rise),tilt:large?13*(1-rise):0,
      opacity:smooth(p/.22),frameOpacity:id==='dissolve'?1-smooth((p-.38)/.62):1,dim:.38*smooth(p/.35)};
  }
  // CSSのcubic-bezierを時刻から評価。依存ライブラリ・DOM・常駐タイマーを持たない。
  function bezier(x1,y1,x2,y2,value) {
    const x=clamp(value);if(x===0||x===1)return x;
    const axis=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
    let lo=0,hi=1;
    for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(axis(mid,x1,x2)<x)lo=mid;else hi=mid;}
    return axis((lo+hi)/2,y1,y2);
  }
  const easeOut=p=>bezier(.16,1,.3,1,p),ease=p=>bezier(.3,0,.2,1,p);
  const mix=(a,b,p)=>a+(b-a)*p;
  const portion=(t,start,length)=>clamp((t-start)/length);
  const itemCount=13; // コマンド5、状態・予報・マップ3、独立アプリ5。
  function coverScale(width,height,screenWidth,screenHeight) {
    if(![width,height,screenWidth,screenHeight].every(v=>Number.isFinite(v)&&v>0))return 1;
    return Math.max(width/screenWidth,height/screenHeight);
  }
  function sleepingPose() {
    return {scale:framedScale*.94,y:viewport.height*.70,tilt:0,rotation:4,opacity:0,frameOpacity:1,dim:0,worldScale:1,screenY:.01,screenOpacity:1,flash:0,items:Array(itemCount).fill(0)};
  }
  const cubicOut=p=>1-Math.pow(1-p,3);
  function frameoutPose(seconds,from=sleepingPose(),cover=1,closing=false) {
    const t=Math.max(0,seconds),v={...from,items:from.items.slice()},fromScreen=from.screenOpacity??1;
    if(closing){
      const c=frameoutTiming.close;
      const fall=bezier(.5,0,.9,.4,portion(t,c.fall,c.fallLength)),screen=bezier(.7,0,.9,.6,portion(t,c.screen,c.screenLength));
      v.scale=mix(from.scale,framedScale*.94,fall);v.y=mix(from.y,viewport.height*.75,fall);v.rotation=mix(from.rotation,-3,fall);v.opacity=mix(from.opacity,0,fall);
      v.screenY=mix(from.screenY,.01,screen);
      // 直し③: 線を先に消してから、暗幕と背景を戻す。線が残ったまま探索が明るくならない。
      v.screenOpacity=mix(fromScreen,0,portion(t,c.lineFade,c.lineFadeLength));
      v.dim=mix(from.dim,0,portion(t,c.dim,c.dimLength));v.worldScale=mix(from.worldScale,1,easeOut(portion(t,c.world,c.worldLength)));
      v.items=from.items.map(item=>mix(item,0,portion(t,0,c.items)));
      v.flash=Math.max(mix(from.flash,0,portion(t,0,c.screenLength)),.5*screen)*v.screenOpacity;
    }else{
      const o=frameoutTiming.open;
      const arrival=easeOut(portion(t,0,o.arrive)),zoom=ease(portion(t,o.arrive,o.zoomEnd-o.arrive));
      // 途中反転はその場の値を始点へ。既に寄った後は一度縮め直さない。
      const rest=Math.max(from.scale,framedScale);
      v.scale=t<=o.arrive?mix(from.scale,rest,arrival):mix(rest,cover,zoom);
      v.y=mix(from.y,0,arrival);v.rotation=mix(from.rotation,0,arrival);v.opacity=mix(from.opacity,1,arrival);
      v.dim=mix(from.dim,.6,cubicOut(portion(t,0,o.dim)));v.worldScale=mix(from.worldScale,1.05,easeOut(portion(t,0,o.world)));
      v.screenY=mix(from.screenY,1,bezier(.3,0,.1,1,portion(t,o.screen,o.screenLength)));
      v.screenOpacity=mix(fromScreen,1,portion(t,0,o.lineIn));
      // 直し①: 光るのは細い線のときだけ。画面が広がるほど光を消し、明るい板のコマを作らない。
      // 画面の地は最初からホームの暗い色。光はopacityだけで表し、大きな面へのfilterは使わない。
      const opened=clamp((v.screenY-.01)/.99),glow=.85*portion(t,o.lineIn,o.lineInLength)*Math.pow(1-opened,6);
      v.flash=Math.max(from.flash*(1-portion(t,0,o.lineIn)),glow);
      // 直し②: よく押す物から順に出す。最後の項目も0.53秒で出そろう。
      v.items=from.items.map((item,i)=>mix(item,1,cubicOut(portion(t,o.itemStart+frameoutRank[i]*o.itemStep,o.itemLength))));
    }
    return v;
  }
  // ④だけは閉じる専用タイムライン。キャンセル時点の全表示値を保持して次へ渡す。
  function frameoutMachine() {
    let state='closed',progress=0,elapsed=0,startProgress=0,current=sleepingPose(),from=current,cover=1;
    function begin(next){from={...current,items:current.items.slice()};startProgress=progress;elapsed=0;state=next;}
    const openEnd=frameoutTiming.open.end,closeEnd=frameoutTiming.close.end;
    function settle(){if(state==='opening'){current=frameoutPose(openEnd,from,cover);progress=1;state='open';}else if(state==='closing'){current=frameoutPose(closeEnd,from,cover,true);progress=0;state='closed';}}
    return {open(allowed=true){if(!allowed)return false;if(state==='opening')settle();else if(state!=='open')begin('opening');return true;},
      close(){if(state!=='closed'&&state!=='closing')begin('closing');},
      step(seconds,fullDuration){if(!['opening','closing'].includes(state))return;elapsed+=Math.max(0,Number.isFinite(seconds)?seconds:0);const p=clamp(elapsed/Math.max(.001,fullDuration)),closing=state==='closing';progress=mix(startProgress,closing?0:1,p);current=frameoutPose(p*(closing?closeEnd:openEnd),from,cover,closing);if(p===1)settle();},
      settle,reset(){state='closed';progress=0;elapsed=0;current=sleepingPose();from=current;},setCover(value){if(Number.isFinite(value)&&value>0)cover=value;},
      get state(){return state;},get progress(){return progress;},get visual(){return {...current,items:current.items.slice()};}};
  }
  // 寄りが終わる前にスリープ面を上下へ開き、既存ホームを見せる。読み込み待ちや認証ではない。
  function wake(progress,setting='full',enabled=true) {
    if(mode(setting)==='none'||!enabled)return {reveal:1,markOpacity:0,lineOpacity:0,lineScale:1};
    const p=clamp(progress);
    return {reveal:smooth((p-.48)/.36),markOpacity:smooth((p-.08)/.18)*(1-smooth((p-.42)/.20)),
      lineOpacity:smooth(p/.12)*(1-smooth((p-.52)/.18)),lineScale:.05+.95*smooth((p-.08)/.40)};
  }
  // 直し④: 「端末」と「戻る」を同じ一つのボタンにする。置き場所は、ホームがアプリ列の右に空けている枠
  // （メニューホーム_独立アプリ01/home-model.js の returnLayout と同じ式）。戻り値は画面上の実寸px。
  // 空き枠がとれない極小表示ではnull（CSSの既定位置を使う）。
  function toggleKeyBox(viewScale=1,safeRight=0,safeBottom=0) {
    if(!(Number.isFinite(viewScale)&&viewScale>0&&viewScale<=4)||![safeRight,safeBottom].every(n=>Number.isFinite(n)&&n>=0&&n<=200))return null;
    const width=Math.max(44,44/viewScale),height=Math.max(64,44/viewScale),right=safeRight/viewScale;
    const appsWidth=494-width-12-right,top=Math.min(282,390-6-safeBottom/viewScale-height);
    if(appsWidth<372||top<272)return null;
    // 画面の端に密着させず、アプリとの間の12pxのうち4pxだけ内側へ寄せる。
    return {width:width*viewScale,height:height*viewScale,right:(right+4)*viewScale,top:top*viewScale,icon:Math.max(22,22*viewScale),font:Math.max(11,11*viewScale)};
  }
  function canOpen(context) { return context==='free'; }
  function inputGate() {
    const held=new Set(),blocked=new Set();let target=null;
    return {press(key,allowed){if(!allowed||blocked.has(key))return false;held.add(key);return true;},
      release(key){held.delete(key);blocked.delete(key);},walk(value,allowed){if(allowed)target=value;return allowed;},
      stop(){for(const key of held)blocked.add(key);held.clear();target=null;},
      get moving(){return held.size>0||target!==null;},get blocked(){return blocked.size>0;}};
  }
  // 一つの進行率を往復する。途中で閉じても開始位置へ飛ばない。
  function machine(id) {
    if(id==='frameout')return frameoutMachine();
    let state='closed',progress=0;
    function open(allowed=true) {
      if(!allowed)return false;
      if(state==='opening'){progress=1;state='open';}else if(state!=='open')state='opening';
      return true;
    }
    function close() { if(state!=='closed')state='closing'; }
    function step(seconds,fullDuration) {
      if(state!=='opening'&&state!=='closing')return;
      const delta=Math.max(0,Number.isFinite(seconds)?seconds:0)/Math.max(.001,fullDuration);
      progress=clamp(progress+(state==='opening'?delta:-delta));
      if(state==='opening'&&progress===1)state='open';else if(state==='closing'&&progress===0)state='closed';
    }
    function settle() { if(state==='opening'){progress=1;state='open';}else if(state==='closing'){progress=0;state='closed';} }
    function reset() { state='closed';progress=0; }
    return {open,close,step,settle,reset,get state(){return state;},get progress(){return progress;}};
  }
  const api=Object.freeze({variants,viewport,frame,frameBox,framedScale,clamp,smooth,mode,effectiveMode,speed,duration,pose,wake,canOpen,inputGate,machine,coverScale,frameoutPose,frameoutTiming,frameoutOrder,toggleKeyBox,itemCount});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MenuTransitionModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
