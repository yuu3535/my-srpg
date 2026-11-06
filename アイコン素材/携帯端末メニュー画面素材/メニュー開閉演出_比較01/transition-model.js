/* 演出の比較専用。ゲーム進行・Unity・DOMには触れない。 */
(function(root) {
  'use strict';
  const variants=Object.freeze({
    approach:Object.freeze({label:'③＋寄り',duration:.36,description:'小さく浮いた端末ごと寄り、内窓が全画面になると枠は外へ抜ける。'}),
    dissolve:Object.freeze({label:'修正版：③＋小さな浮き上がり',duration:.36,description:'軽く浮かせ、枠だけを薄くしながら全画面のホームへ合わせる。'}),
    raise:Object.freeze({label:'①：構えて寄る',duration:.50,description:'下から構えるように現れ、傾きを戻しながら画面へ寄る。SDの動作は付けない。'}),
    frameout:Object.freeze({label:'④ 枠抜け全画面（新案）',duration:.614,description:'下から浮いた端末へ寄り、線から画面が点き、項目が順に現れる。閉じる動きは短く畳む。'})
  });
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
    const seconds=value==='none'?(closing?.08:.10):value==='short'?(closing?.12:.18):closing?(id==='frameout'?.29:.20):(variants[id]||variants.approach).duration;
    return seconds/factor;
  }
  function pose(id,progress,setting='full') {
    const p=clamp(progress),value=mode(setting);
    if(value==='none')return {scale:1,y:0,tilt:0,opacity:smooth(p),frameOpacity:0,dim:.38*smooth(p)};
    if(id==='frameout')return frameoutPose(p*.614);
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
    return {scale:framedScale*.94,y:viewport.height*.70,tilt:0,rotation:4,opacity:0,frameOpacity:1,dim:0,worldScale:1,screenY:.01,flash:0,items:Array(itemCount).fill(0)};
  }
  function frameoutPose(seconds,from=sleepingPose(),cover=1,closing=false) {
    const t=Math.max(0,seconds),v={...from,items:from.items.slice()};
    if(closing){
      const fall=bezier(.5,0,.9,.4,portion(t,.09,.15)),screen=bezier(.7,0,.9,.6,portion(t,.03,.09));
      v.scale=mix(from.scale,framedScale*.94,fall);v.y=mix(from.y,viewport.height*.75,fall);v.rotation=mix(from.rotation,-3,fall);v.opacity=mix(from.opacity,0,fall);
      v.screenY=mix(from.screenY,.01,screen);v.dim=mix(from.dim,0,portion(t,.09,.15));v.worldScale=mix(from.worldScale,1,easeOut(portion(t,.09,.20)));
      v.items=from.items.map(item=>mix(item,0,portion(t,0,.07)));
      v.flash=Math.max(mix(from.flash,0,portion(t,0,.09)),.45*screen*(1-portion(t,.12,.12)));
    }else{
      const arrival=easeOut(portion(t,0,.171)),zoom=ease(portion(t,.171,.209));
      // 途中反転はその場の値を始点へ。既に寄った後は一度縮め直さない。
      const rest=Math.max(from.scale,framedScale);
      v.scale=t<=.171?mix(from.scale,rest,arrival):mix(rest,cover,zoom);
      v.y=mix(from.y,0,arrival);v.rotation=mix(from.rotation,0,arrival);v.opacity=mix(from.opacity,1,arrival);
      v.dim=mix(from.dim,.6,1-Math.pow(1-portion(t,0,.16),3));v.worldScale=mix(from.worldScale,1.05,easeOut(portion(t,0,.4)));
      v.screenY=mix(from.screenY,1,bezier(.3,0,.1,1,portion(t,.13,.13)));
      // 白い線の明るさはopacityで表現。大きな画面へのfilterアニメーションは避ける。
      v.flash=t<.13?mix(from.flash,0,portion(t,0,.13)):(1-portion(t,.13,.13))*.72;
      v.items=from.items.map((item,i)=>mix(item,1,1-Math.pow(1-portion(t,.2+i*.022,.15),3)));
    }
    return v;
  }
  // ④だけは閉じる専用タイムライン。キャンセル時点の全表示値を保持して次へ渡す。
  function frameoutMachine() {
    let state='closed',progress=0,elapsed=0,startProgress=0,current=sleepingPose(),from=current,cover=1;
    function begin(next){from={...current,items:current.items.slice()};startProgress=progress;elapsed=0;state=next;}
    function settle(){if(state==='opening'){current=frameoutPose(.614,from,cover);progress=1;state='open';}else if(state==='closing'){current=frameoutPose(.29,from,cover,true);progress=0;state='closed';}}
    return {open(allowed=true){if(!allowed)return false;if(state==='opening')settle();else if(state!=='open')begin('opening');return true;},
      close(){if(state!=='closed'&&state!=='closing')begin('closing');},
      step(seconds,fullDuration){if(!['opening','closing'].includes(state))return;elapsed+=Math.max(0,Number.isFinite(seconds)?seconds:0);const p=clamp(elapsed/Math.max(.001,fullDuration)),closing=state==='closing';progress=mix(startProgress,closing?0:1,p);current=frameoutPose(p*(closing?.29:.614),from,cover,closing);if(p===1)settle();},
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
  const api=Object.freeze({variants,viewport,frame,frameBox,framedScale,clamp,smooth,mode,effectiveMode,speed,duration,pose,wake,canOpen,inputGate,machine,coverScale,frameoutPose,itemCount});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MenuTransitionModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
