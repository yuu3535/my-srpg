/* Hub2 の開閉（帯スイープ）の時刻表と幾何。DOMに触れない。比較専用で、ゲーム本編・Unityには接続しない。
   正本: docs/10-design/ui/MENU_HUB2_SPEC_2026-11-08.md §3-12（CLOSE）・§3-14（帯スイープ）・§3-15（MENU）。 */
(function(root) {
  'use strict';
  const base=Object.freeze({width:1688,height:780});
  const timing=Object.freeze({
    sweep:1.75,          // 帯が横切る全体
    holdStart:.46,holdEnd:.54, // 0〜46% 入る／46〜54% 覆って止まる／54〜100% 抜ける
    swapAt:.5,           // 覆いきった瞬間（0.875秒）にメニューを出す／消す
    burst:.28,           // CLOSE の星が弾ける（そのあと帯が流れる）
    land:.5,             // 開き終わりに CLOSE の星が着地（1.7倍・-90°から弾むように戻る）
    angle:155.2,         // 帯の進む向き（CSSのグラデーションの角度と同じ読み方。上が0°、時計回り）。仕様書どおり＝左上から右下へ
    // 原作者の指摘（2026-11-08）「MENU の星は右上だから、開くときも閉じるときも右上から来ないとおかしい」による案。
    // 右上から左下へ（155.2°を左右に反転した 204.8°）。開くときも閉じるときも同じ向き（星を押した所から帯が出る）。
    flows:Object.freeze({
      topright:Object.freeze({angle:204.8,openReverse:false,label:'右上から（開く・閉じるとも）'}),
      spec:Object.freeze({angle:155.2,openReverse:true,label:'仕様書どおり（左上から・開くは逆向き）'})
    }),
    tail:420,            // 星の光の尾の長さ
    // 演出担当の案（未決定）: 「短い」は同じ形を0.8秒に縮める、「なし」とOSの動きを減らす設定は0.15秒のフェードだけ。
    short:Object.freeze({sweep:.8,burst:.16,land:.3}),none:Object.freeze({fade:.15})
  });
  const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
  function bezier(x1,y1,x2,y2,value) {
    const x=clamp(value);if(x===0||x===1)return x;
    const axis=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
    let lo=0,hi=1;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(axis(mid,x1,x2)<x)lo=mid;else hi=mid;}
    return axis((lo+hi)/2,y1,y2);
  }
  const easeInOut=p=>bezier(.42,0,.58,1,p);
  // 帯の幾何。進む向き n、帯のふちの向き e、画面を n に投影した範囲、帯の厚み T（画面を覆いきれる厚み）。
  function geometry(width=base.width,height=base.height,angle=timing.angle) {
    const a=angle*Math.PI/180,n={x:Math.sin(a),y:-Math.cos(a)},e={x:-n.y,y:n.x};
    const min=Math.min(0,width*n.x)+Math.min(0,height*n.y),max=Math.max(0,width*n.x)+Math.max(0,height*n.y);
    // 帯の厚みは「画面をちょうど覆いきれる」だけにする。厚すぎると真っ暗な時間が長くなる（原作者の動画 2026-11-08 で約0.5秒真っ暗だった）。
    // ちょうどの厚みなら、真っ暗になるのは仕様書の「46〜54%で覆って一瞬止まる」の間だけ。光る線の光彩（glow）は帯の外へにじむ分として、画面の外へ出しきる距離にだけ使う。
    const glow=70,T=(max-min)+2,L=Math.hypot(width,height)*1.6;
    return {n,e,min,max,mid:(min+max)/2,T,L,glow,width,height,rotate:Math.atan2(-n.x,n.y)*180/Math.PI};
  }
  // 帯の流れ方（向きの角度と、開くとき逆向きにするか）。
  function flow(name){return timing.flows[name]||timing.flows.topright;}
  // 開く・閉じるのそれぞれで、帯を n の向き（'close'）に流すか逆（'open'）に流すか。
  function travel(kind,flowName){return kind==='open'&&flow(flowName).openReverse?'open':'close';}
  // 帯の位置（n 方向の中心の投影 s）。'close' は n の向きへ、'open' は逆向きへ流れる。
  function band(progress,direction='close',g=geometry()) {
    const p=clamp(progress),start=g.min-g.T/2-g.glow,end=g.max+g.T/2+g.glow,from=direction==='open'?end:start,to=direction==='open'?start:end;
    let s;
    if(p<=timing.holdStart)s=from+(g.mid-from)*easeInOut(p/timing.holdStart);
    else if(p<timing.holdEnd)s=g.mid;
    else s=g.mid+(to-g.mid)*easeInOut((p-timing.holdEnd)/(1-timing.holdEnd));
    const sign=direction==='open'?-1:1;
    return {s,offset:s-g.mid,leading:s+sign*g.T/2,covering:p>=timing.holdStart&&p<=timing.holdEnd,starTurn:360*p,sign};
  }
  // 画面のどこまでを帯が覆っているか（0〜1）。検査用。
  function coverage(progress,direction='close',g=geometry()) {
    const b=band(progress,direction,g),lo=Math.max(g.min,b.s-g.T/2),hi=Math.min(g.max,b.s+g.T/2);
    return clamp((hi-lo)/(g.max-g.min));
  }
  function mode(value){return ['full','short','none'].includes(value)?value:'full';}
  function durations(setting='full') {
    const m=mode(setting);
    if(m==='none')return {sweep:0,burst:0,land:0,fade:timing.none.fade};
    if(m==='short')return {sweep:timing.short.sweep,burst:timing.short.burst,land:timing.short.land,fade:0};
    return {sweep:timing.sweep,burst:timing.burst,land:timing.land,fade:0};
  }
  // 戻り値: menu＝メニューを出す、explore＝探索側の MENU の星を出す（探索の景色はいつも後ろに見えている）。
  // 閉じる: 星が弾ける → 帯が流れる（覆いきった瞬間に探索へ）。開く: 帯が流れる（覆いきった瞬間にメニュー）→ 星が着地。
  // 「なし」は0.15秒のフェードだけ。どの途中でも入力は受け付けない（Hub2 の決まり）。
  function frame(kind,seconds,setting='full') {
    const d=durations(setting),t=Math.max(0,Number.isFinite(seconds)?seconds:0);
    if(d.fade){
      const p=clamp(t/d.fade);
      return kind==='close'?{menu:p<1,menuOpacity:1-p,explore:p>=1,sweep:null,burst:null,land:null,done:p>=1,total:d.fade}
        :{menu:true,menuOpacity:p,explore:false,sweep:null,burst:null,land:null,done:p>=1,total:d.fade};
    }
    if(kind==='close'){
      const burst=clamp(t/d.burst),sp=t<d.burst?null:clamp((t-d.burst)/d.sweep),total=d.burst+d.sweep;
      const swapped=sp!==null&&sp>=timing.swapAt;
      return {menu:!swapped,menuOpacity:1,explore:swapped,sweep:sp!==null&&sp<1?sp:null,burst:t<d.burst?burst:(swapped?null:1),land:null,done:t>=total,total};
    }
    const sp=clamp(t/d.sweep),swapped=sp>=timing.swapAt,land=t<d.sweep?null:clamp((t-d.sweep)/d.land),total=d.sweep+d.land;
    return {menu:swapped,menuOpacity:1,explore:!swapped,sweep:sp<1?sp:null,burst:null,land:swapped?(land===null?0:land):null,done:t>=total,total};
  }
  // CLOSE の星: 弾ける（1.5倍に膨らみつつ回転 → 縮んで消える）。着地（1.7倍・-90°から弾むように戻る）。
  function burstPose(q){const p=clamp(q);if(p<.5){const k=p/.5;return {scale:1+.5*k,rotate:90*k,opacity:1};}const k=(p-.5)/.5;return {scale:1.5*(1-k),rotate:90+90*k,opacity:1-k};}
  function landPose(q){const p=clamp(q),k=bezier(.34,1.56,.64,1,p);return {scale:1.7+(1-1.7)*k,rotate:-90+90*k,opacity:Math.min(1,p*4)};}
  function machine(){
    let state='open',kind=null,elapsed=0;
    return {
      get state(){return state;},get kind(){return kind;},get elapsed(){return elapsed;},
      get locked(){return state==='closing'||state==='opening';},
      close(){if(state!=='open')return false;state='closing';kind='close';elapsed=0;return true;},
      open(){if(state!=='closed')return false;state='opening';kind='open';elapsed=0;return true;},
      step(seconds,setting='full'){if(!this.locked)return;elapsed+=Math.max(0,Number.isFinite(seconds)?seconds:0);if(frame(kind,elapsed,setting).done){state=kind==='close'?'closed':'open';kind=null;elapsed=0;}},
      frame(setting='full'){return kind?frame(kind,elapsed,setting):{menu:state==='open',menuOpacity:1,explore:state==='closed',sweep:null,burst:null,land:state==='open'?1:null,done:true,total:0};},
      scrub(k,seconds){state=k==='close'?'closing':'opening';kind=k;elapsed=Math.max(0,seconds);},
      reset(to='open'){state=to;kind=null;elapsed=0;}
    };
  }
  const api=Object.freeze({base,timing,clamp,bezier,easeInOut,geometry,flow,travel,band,coverage,mode,durations,frame,burstPose,landPose,machine});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Hub2SweepModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
