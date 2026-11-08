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
    short:Object.freeze({sweep:.8,burst:.16,land:.3}),none:Object.freeze({fade:.15}),
    // 運命予報カード（§3-11）: 暗幕0.3秒のフェード＋カードがY軸で-80°→0°、0.92倍→1倍（0.55秒）。
    // 閉じるは仕様書に無いので演出担当の案: 同じ向きへ回り続けて+80°へ裏返るように去る（0.3秒）、暗幕0.25秒。
    fortune:Object.freeze({open:Object.freeze({scrim:.3,card:.55,fade:.2,fromRotate:-80,fromScale:.92}),close:Object.freeze({scrim:.25,card:.3,fade:.3,toRotate:80,toScale:.92})})
  });
  // 運命予報のティッカー（§3-4）は流さない（原作者 2026-11-08「電光掲示板みたいに流れてくるのはやめよう」）。止まった1行表示で、はみ出しは「…」。
  // 運命予報カードの時間。速さ（確認用の0.5倍など）で割る。「短い」は約半分、「なし」は回さず0.15秒のフェード。
  function fortuneDurations(setting='full',closing=false,rate=1) {
    const m=mode(setting),f=closing?timing.fortune.close:timing.fortune.open,r=[.25,.5,1,2].includes(Number(rate))?Number(rate):1;
    const k=m==='short'?.55:1,d=m==='none'?{scrim:.15,card:0,fade:.15}:{scrim:f.scrim*k,card:f.card*k,fade:f.fade*k};
    return {scrim:d.scrim/r,card:d.card/r,fade:d.fade/r,total:Math.max(d.scrim,d.card,d.fade)/r};
  }
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
  // ── 切り裂き（ジッパー）。原作者 2026-11-08: 「CLOSE の星を押したら、流星が右上の星の所から始まり、画面の斜め端から斜め端までジッパーみたいに切り裂いていく方がきれい」（添付のAPNG）。
  // 押した星が弾けて流星になり、星の所から左下の角へ一本の切れ目を引く → 切れ目が、流星の出た側から大きく裂けて開く。
  // 閉じる: メニューが裂けて探索が見える。開く: 探索が裂けてメニューが見える（切れ目の内側にメニュー）。どちらも右上の星から始まる。
  const tear=Object.freeze({flare:.2,cut:.55,hold:.06,open:.62,land:.5,margin:120,peak:.22,spread:4200,samples:32,tail:420});
  // 短い版（原作者の決定 2026-11-09「長い切り裂きは、その日の最初の1回や物語の節目だけ。普段は短い版」）。
  // 形は長い版と同じ（星が弾ける→切れ目→裂ける）で、各段を詰める。閉じる0.62秒・開く0.82秒（着地込み）。
  // 弾ける0.08（押した手応えだけ）、切れ目0.22（シュッと一筋）、止まり0.02（ほぼ無し）、裂ける0.30、着地0.20。
  const tearShort=Object.freeze({flare:.08,cut:.22,hold:.02,open:.30,land:.2});
  // length: 'long'（長い版）／'short'（短い版）。設定「なし」・OSの動きを減らす設定は、どちらでも0.15秒のフェード。
  function tearDurations(setting='full',length='short'){
    const m=mode(setting);if(m==='none')return {flare:0,cut:0,hold:0,open:0,land:0,fade:timing.none.fade};
    const src=m==='full'&&length==='long'?tear:tearShort;return {flare:src.flare,cut:src.cut,hold:src.hold,open:src.open,land:src.land,fade:0};
  }
  // ── 長い版を流すとき（「節目」）。原作者の決定 2026-11-09 を、メニュー演出担当が決まりにした案。
  // 長い版は「開く」ときだけ（物語や1日の始まりを見せる場面）。閉じるのは、いつも短い版（すぐ遊びに戻る）。
  // 開くときに長い版になる理由（どれか1つ）:
  //   day＝その日の最初の1回（ゲームの中の日が変わってから、最初に開くとき）
  //   boot＝ゲームを起動・ロードして最初に開くとき
  //   chapter＝章（シナリオ1本）が始まった／event＝メインイベントが変わった／battle＝物語の戦闘に勝った
  // 理由は「次に開くまで」取っておき、長い版を1回流したら消える（同じ節目で何度も長くならない）。設定「短い」なら節目でも短い版。
  const milestoneReasons=Object.freeze({chapter:'章の始まり',event:'メインイベントが変わった',battle:'物語の戦闘に勝った',boot:'起動して最初',day:'その日の最初'});
  function milestoneState(){return {lastDay:null,pending:null,booted:false};}
  // 節目が起きた（シナリオ側から呼ぶ）。すでに理由があれば、重い方（章＞イベント＞戦闘）を残す。
  function markMilestone(state,reason){const order=['chapter','event','battle'];if(!order.includes(reason))return state;
    const keep=state.pending&&order.indexOf(state.pending)<order.indexOf(reason)?state.pending:reason;return {...state,pending:keep};}
  // 次に開くときの長さと理由。
  function openLength(setting,state,day){
    if(mode(setting)!=='full')return {length:'short',reason:null};
    if(state.pending)return {length:'long',reason:state.pending};
    if(!state.booted)return {length:'long',reason:'boot'};
    if(state.lastDay!==day)return {length:'long',reason:'day'};
    return {length:'short',reason:null};
  }
  // 開いたあと（長くても短くても）。理由を消し、今日は開いた、と覚える。
  function afterOpen(state,day){return {lastDay:day,pending:null,booted:true};}
  // 切れ目の線。S＝流星の出る所（押した星の中心）、B＝左下の角。S から B と反対へのばして画面の端に当たる所が A。
  function tearGeometry(width=base.width,height=base.height,start={x:width-54,y:58}){
    const S={x:start.x,y:start.y},B={x:0,y:height},dx=S.x-B.x,dy=S.y-B.y,len=Math.hypot(dx,dy),u={x:-dx/len,y:-dy/len},n={x:-u.y,y:u.x};
    // A: S から -u の向きに進んで画面の外枠に当たる所。
    const cands=[];if(u.x<0)cands.push((S.x-width)/u.x);if(u.y>0)cands.push((S.y-0)/u.y);const back=Math.max(0,Math.min(...cands.filter(v=>v>=0),1e9));
    const A={x:S.x-u.x*back,y:S.y-u.y*back},m=tear.margin;
    const A2={x:A.x-u.x*m,y:A.y-u.y*m},B2={x:B.x+u.x*m,y:B.y+u.y*m},L=Math.hypot(B2.x-A2.x,B2.y-A2.y);
    return {width,height,S,A,B,A2,B2,u,n,L,back};
  }
  // 裂け目はゆっくり裂け始め、後半で一気に開く（裂ける物の自然な動き）。
  const cutEase=p=>bezier(.6,0,.4,1,p),openEase=p=>Math.pow(clamp(p),2.2);
  // 流星の位置（切れ目の先）と大きさ。APNGのように、走りながら大きくなり、終わりに小さくなる。
  function meteor(c,g=tearGeometry()){
    const p=clamp(c),k=cutEase(p),P={x:g.S.x+(g.B2.x-g.S.x)*k,y:g.S.y+(g.B2.y-g.S.y)*k};
    const scale=p<.3?1+.7*(p/.3):1.7-1.3*((p-.3)/.7);
    return {x:P.x,y:P.y,scale,rotate:540*k,angle:Math.atan2(g.u.y,g.u.x)*180/Math.PI};
  }
  // 裂け目の形（線の片側ずつの点の列）。裂け目は流星の出た側（peak の位置）がいちばん広く、反対の端は閉じたまま。
  function tearShape(v){return v<=tear.peak?Math.sqrt(v/tear.peak):(1-v)/(1-tear.peak);}
  function tearLens(o,g=tearGeometry()){
    const D=tear.spread*openEase(o),upper=[],lower=[];
    for(let i=0;i<=tear.samples;i++){const v=i/tear.samples,x=g.A2.x+(g.B2.x-g.A2.x)*v,y=g.A2.y+(g.B2.y-g.A2.y)*v,w=D*tearShape(v);
      upper.push({x:x+g.n.x*w,y:y+g.n.y*w});lower.push({x:x-g.n.x*w,y:y-g.n.y*w});}
    return {upper,lower,D};
  }
  const pts=list=>list.map(p=>`${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L');
  function lensPath(o,g=tearGeometry()){const l=tearLens(o,g);return `M${pts(l.upper)} L${pts([...l.lower].reverse())}Z`;}
  function edgePath(list){return 'M'+pts(list);}
  // 点が裂け目の中か（検査用）。
  function insideLens(o,x,y,g=tearGeometry()){
    const px=x-g.A2.x,py=y-g.A2.y,along=px*g.u.x+py*g.u.y,v=along/g.L;if(v<=0||v>=1)return false;
    return Math.abs(px*g.n.x+py*g.n.y)<=tear.spread*openEase(o)*tearShape(v);
  }
  // 戻り値: menu／explore は帯と同じ。tear＝{phase:'flare'|'cut'|'hold'|'open', c, o, clip:'outside'（メニューを裂く）|'inside'（裂け目からメニュー）}。
  // burst＝CLOSE の星が弾ける、exploreBurst＝MENU の星が弾ける（どちらも弾けたあと流星になる）、land＝開き終わりの CLOSE の星の着地。
  function tearFrame(kind,seconds,setting='full',length='short'){
    const d=tearDurations(setting,length),t=Math.max(0,Number.isFinite(seconds)?seconds:0);
    if(d.fade)return frame(kind,t,'none');
    const a=d.flare,b=a+d.cut,c=b+d.hold,e=c+d.open,total=kind==='open'?e+d.land:e;
    let tr=null;
    if(t<a)tr={phase:'flare',c:0,o:0};else if(t<b)tr={phase:'cut',c:clamp((t-a)/d.cut),o:0};else if(t<c)tr={phase:'hold',c:1,o:0};else if(t<e)tr={phase:'open',c:1,o:clamp((t-c)/d.open)};
    const burstQ=a>0?clamp(t/a):1;
    if(kind==='close'){
      const gone=t>=e;
      return {menu:!gone,menuOpacity:1,explore:gone,sweep:null,tear:tr&&{...tr,clip:tr.phase==='open'?'outside':null},burst:gone?null:burstQ,exploreBurst:null,land:null,done:t>=total,total};
    }
    const shown=t>=c;
    return {menu:shown,menuOpacity:1,explore:!shown,sweep:null,tear:tr&&{...tr,clip:tr.phase==='open'?'inside':null},burst:null,exploreBurst:shown?null:burstQ,land:t<e?(shown?0:null):clamp((t-e)/d.land),done:t>=total,total};
  }
  // ── ページ送りの菱形の3色（原作者と相談中 2026-11-08）。t＝水色、a＝藤色か赤（配色案による）、g＝金。
  // order＝左から並べる3色（例 'tag'）。mode: 'slot'＝色は場所に付き、今のページはその場所の色で光る／'follow'＝水色が今のページへ移り、残りは並びの順に他の2色。
  const dia=Object.freeze({t:'79,163,168',a:{ref:'158,146,182',crimson:'184,72,78'},g:'226,176,74',orders:Object.freeze(['tag','tga','atg','gta','agt','gat'])});
  function diaColors(scheme='crimson',order='tag',modeName='follow',page=0){
    const o=dia.orders.includes(order)?order:'tag',p=[0,1,2].includes(page)?page:0,rgb=k=>k==='t'?dia.t:k==='g'?dia.g:(dia.a[scheme]||dia.a.crimson);
    let keys;
    if(modeName==='slot')keys=o.split('');
    else{const rest=o.split('').filter(k=>k!=='t');keys=[0,1,2].map(i=>i===p?'t':rest.shift());}
    return keys.map((k,i)=>({key:k,rgb:rgb(k),active:i===p}));
  }
  function burstPose(q){const p=clamp(q);if(p<.5){const k=p/.5;return {scale:1+.5*k,rotate:90*k,opacity:1};}const k=(p-.5)/.5;return {scale:1.5*(1-k),rotate:90+90*k,opacity:1-k};}
  function landPose(q){const p=clamp(q),k=bezier(.34,1.56,.64,1,p);return {scale:1.7+(1-1.7)*k,rotate:-90+90*k,opacity:Math.min(1,p*4)};}
  function machine(){
    let state='open',kind=null,elapsed=0,length='short';
    // style: 'tear'（切り裂き）か 'band'（帯スイープ）。length: 'long'／'short'（切り裂きのとき）。
    const pick=(k,t,setting,style)=>style==='tear'?tearFrame(k,t,setting,length):frame(k,t,setting);
    const finish=()=>{state=kind==='close'?'closed':'open';kind=null;elapsed=0;};
    return {
      get state(){return state;},get kind(){return kind;},get elapsed(){return elapsed;},get length(){return length;},
      get locked(){return state==='closing'||state==='opening';},
      close(len='short'){if(state!=='open')return false;state='closing';kind='close';elapsed=0;length=len==='long'?'long':'short';return true;},
      open(len='short'){if(state!=='closed')return false;state='opening';kind='open';elapsed=0;length=len==='long'?'long':'short';return true;},
      // 演出中に押したら最後まで飛ばす（原作者の決定 2026-11-09）。演出中に受け付けるのはこの操作だけ。
      skip(){if(!this.locked)return false;finish();return true;},
      step(seconds,setting='full',style='band'){if(!this.locked)return;elapsed+=Math.max(0,Number.isFinite(seconds)?seconds:0);if(pick(kind,elapsed,setting,style).done)finish();},
      frame(setting='full',style='band'){return kind?pick(kind,elapsed,setting,style):{menu:state==='open',menuOpacity:1,explore:state==='closed',sweep:null,burst:null,land:state==='open'?1:null,done:true,total:0};},
      scrub(k,seconds,len){state=k==='close'?'closing':'opening';kind=k;elapsed=Math.max(0,seconds);if(len)length=len==='long'?'long':'short';},
      reset(to='open'){state=to;kind=null;elapsed=0;}
    };
  }
  const api=Object.freeze({base,timing,clamp,bezier,easeInOut,geometry,flow,travel,fortuneDurations,band,tear,tearDurations,tearGeometry,meteor,tearLens,lensPath,edgePath,insideLens,tearFrame,tearShort,milestoneReasons,milestoneState,markMilestone,openLength,afterOpen,dia,diaColors,coverage,mode,durations,frame,burstPose,landPose,machine});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Hub2SweepModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
