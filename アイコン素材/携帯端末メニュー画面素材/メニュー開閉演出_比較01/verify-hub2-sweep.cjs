'use strict';
// Hub2 の帯スイープの検証（Node、フレームワークなし）。node verify-hub2-sweep.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('./hub2-sweep-model.js'),{mount}=require('./hub2-sweep.js');
const html=fs.readFileSync(path.join(__dirname,'hub2-sweep.html'),'utf8');
// 参照しているファイルがあること（立ち絵は Git 管理外のフォルダなので、無ければ知らせるだけ）。
for(const [,ref]of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(/^https?:/.test(ref))continue;const file=path.resolve(__dirname,ref.split('?')[0]);
  if(ref.includes('立ち絵透過下処理')){if(!fs.existsSync(file))console.warn('（注意）立ち絵が見つからない:',ref);continue;}
  assert.ok(fs.existsSync(file),ref);
}
for(const file of ['hub2-sweep-model.js','hub2-sweep.js'])new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'));
const T=model.timing;
// 仕様書の数値（§3-14）。
assert.equal(T.sweep,1.75);assert.equal(T.holdStart,.46);assert.equal(T.holdEnd,.54);assert.equal(T.swapAt*T.sweep,.875);assert.equal(T.burst,.28);assert.equal(T.land,.5);assert.equal(T.angle,155.2);assert.equal(T.tail,420);
// 幾何: 帯のふちは画面の対角線（右上〜左下）と平行（1688×780 で −24.8°）。覆いきる厚みがある。
const g=model.geometry();assert.ok(Math.abs(g.rotate+24.8)<.05,String(g.rotate));assert.ok(g.T>=g.max-g.min);
// 0〜46% で入り、46〜54% は画面を全部覆い、100% で抜けきる。開く・閉じるの両方。
for(const dir of ['close','open']){
  assert.equal(model.coverage(0,dir,g),0);assert.equal(model.coverage(1,dir,g),0);
  for(let p=.46;p<=.54;p+=.01)assert.equal(model.coverage(p,dir,g),1,`${dir} ${p}`);
  // 真っ暗なのは「一瞬」だけ（原作者の動画で長すぎた）: 42%・58%の時点ではまだ画面のどこかが見えている。
  assert.ok(model.coverage(.42,dir,g)<1&&model.coverage(.58,dir,g)<1,`${dir} 真っ暗が長すぎる`);
  assert.equal(model.band(.5,dir,g).covering,true);assert.equal(model.band(.3,dir,g).covering,false);
}
// 帯の向き（原作者の指摘 2026-11-08）: 「右上から」は開く・閉じるとも右上の角から入り、左下へ抜ける。「仕様書どおり」は左上から入り、開くときは逆向き。
const inside=(gg,b,x,y)=>Math.abs(x*gg.n.x+y*gg.n.y-b.s)<=gg.T/2;
{const tr=model.geometry(1688,780,model.flow('topright').angle);assert.ok(Math.abs(tr.rotate-24.8)<.05,String(tr.rotate));
  for(const kind of ['close','open']){const b=model.band(.22,model.travel(kind,'topright'),tr);assert.ok(inside(tr,b,1688,0),kind+' 右上が先に覆われる');assert.ok(!inside(tr,b,0,780),kind+' 左下はまだ');}
  const sp=model.geometry(1688,780,model.flow('spec').angle);
  let b=model.band(.22,model.travel('close','spec'),sp);assert.ok(inside(sp,b,0,0)&&!inside(sp,b,1688,780),'仕様書どおりの閉じるは左上から');
  b=model.band(.22,model.travel('open','spec'),sp);assert.ok(inside(sp,b,1688,780)&&!inside(sp,b,0,0),'仕様書どおりの開くは右下から');}
// 閉じる: 星が弾ける0.28秒 → 帯。覆いきった0.875秒でメニューを消し、MENU の星を出す。
let f=model.frame('close',.1);assert.equal(f.menu,true);assert.equal(f.sweep,null);assert.ok(f.burst>0);
f=model.frame('close',.28+.874);assert.equal(f.menu,true,'覆いきる前は消さない');
f=model.frame('close',.28+.876);assert.equal(f.menu,false);assert.equal(f.explore,true);
f=model.frame('close',.28+1.75);assert.equal(f.done,true);
// 開く: 帯 → 覆いきった瞬間にメニュー → CLOSE の星が着地0.5秒。
f=model.frame('open',.874);assert.equal(f.menu,false);assert.equal(f.explore,true);
f=model.frame('open',.876);assert.equal(f.menu,true);assert.equal(f.explore,false);
f=model.frame('open',1.75+.25);assert.equal(f.sweep,null);assert.ok(f.land>0&&f.land<1);
assert.equal(model.frame('open',2.25).done,true);
// 星の動き: 弾けると最後は消える。着地は1.7倍・-90°から始まり、1倍・0°で止まる。
assert.equal(model.burstPose(1).opacity,0);assert.ok(model.burstPose(.5).scale>1.45);
assert.ok(Math.abs(model.landPose(0).scale-1.7)<1e-9);assert.equal(model.landPose(0).rotate,-90);assert.equal(model.landPose(1).scale,1);assert.equal(model.landPose(1).rotate,0);
// 「短い」「なし」（演出担当の案）。
assert.equal(model.durations('short').sweep,.8);assert.equal(model.frame('close',0,'none').total,.15);assert.equal(model.frame('close',.15,'none').menu,false);
// 運命予報カード（§3-11）: 暗幕0.3秒・カード0.55秒（-80°・0.92倍から）。閉じるは案（+80°へ0.3秒）。「なし」は回さない。
{const F=T.fortune;assert.equal(F.open.scrim,.3);assert.equal(F.open.card,.55);assert.equal(F.open.fromRotate,-80);assert.equal(F.open.fromScale,.92);
  assert.equal(model.fortuneDurations('full').card,.55);assert.equal(model.fortuneDurations('full',false,.25).card,2.2);
  assert.equal(model.fortuneDurations('none').card,0);assert.ok(model.fortuneDurations('full',true).total<model.fortuneDurations('full').total,'閉じるのは開くより短い');}
// ティッカー（§3-4）は流さない（原作者 2026-11-08）。
assert.equal(model.ticker,undefined);assert.ok(!/data-flowing|animate\(/.test(fs.readFileSync(path.join(__dirname,'hub2-sweep.js'),'utf8')),'ティッカーを流す処理が残っていない');
// 切り裂き（原作者の指摘 2026-11-08）: 押した星（右上）から左下の角へ切れ目、右上の側から裂けて開く。
{const tg=model.tearGeometry(1688,780,{x:1634,y:58});
  assert.equal(tg.B.x,0);assert.equal(tg.B.y,780);assert.ok(tg.A.x>=1688-1e-6||tg.A.y<=1e-6,'A は画面の右か上の端');
  const m0=model.meteor(0,tg),m1=model.meteor(1,tg);assert.ok(Math.abs(m0.x-1634)<1e-6&&Math.abs(m0.y-58)<1e-6,'流星は星の所から始まる');assert.ok(m1.x<0&&m1.y>780,'左下の角の外まで抜ける');
  let miss=0;for(let x=0;x<=1688;x+=16)for(let y=0;y<=780;y+=16)if(!model.insideLens(1,x,y,tg))miss++;assert.equal(miss,0,'裂け終わりで画面を全部開く');
  assert.equal(model.insideLens(0,800,400,tg),false,'裂ける前は閉じている');
  // 裂け始めは右上の側（流星の出た側）が先に開き、左下の端はまだ閉じている。
  const near={x:tg.A.x+(tg.B.x-tg.A.x)*.2,y:tg.A.y+(tg.B.y-tg.A.y)*.2},far={x:tg.A.x+(tg.B.x-tg.A.x)*.9,y:tg.A.y+(tg.B.y-tg.A.y)*.9};
  const off=(p,d)=>({x:p.x+tg.n.x*d,y:p.y+tg.n.y*d});
  assert.ok(model.insideLens(.3,off(near,60).x,off(near,60).y,tg)&&!model.insideLens(.3,off(far,60).x,off(far,60).y,tg),'右上の側から裂ける');
  assert.ok(model.lensPath(.5,tg).startsWith('M')&&model.lensPath(.5,tg).endsWith('Z'));}
{let f=model.tearFrame('close',.1);assert.equal(f.tear.phase,'flare');assert.ok(f.burst>0);assert.equal(f.menu,true);
  f=model.tearFrame('close',.5);assert.equal(f.tear.phase,'cut');assert.equal(f.tear.clip,null);
  f=model.tearFrame('close',1.1);assert.equal(f.tear.phase,'open');assert.equal(f.tear.clip,'outside');assert.equal(f.menu,true);
  f=model.tearFrame('close',1.44);assert.equal(f.done,true);assert.equal(f.menu,false);assert.equal(f.explore,true);
  f=model.tearFrame('open',.1);assert.ok(f.exploreBurst>0,'MENU の星が弾けて流星になる');assert.equal(f.menu,false);
  f=model.tearFrame('open',1.1);assert.equal(f.tear.clip,'inside');assert.equal(f.menu,true);assert.equal(f.explore,false);
  f=model.tearFrame('open',1.43+.25);assert.equal(f.tear,null);assert.ok(f.land>0&&f.land<1,'開き終わりに CLOSE の星が着地');
  assert.equal(model.tearFrame('open',1.94).done,true);
  assert.ok(model.tearFrame('close',0,'short').total<.8);assert.equal(model.tearFrame('close',0,'none').total,.15);}
// 菱形の3色: 水色が今のページへ移る／色は場所に付く。
{const c=model.diaColors('crimson','tag','follow',1).map(x=>x.key).join('');assert.equal(c,'atg','水色は2つ目へ、残りは並びの順');
  assert.equal(model.diaColors('crimson','tag','slot',1).map(x=>x.key).join(''),'tag','場所に付く色は変わらない');
  assert.equal(model.diaColors('crimson','gat','follow',0).map(x=>x.key).join(''),'tga');
  assert.equal(model.diaColors('ref','tag').find(x=>x.key==='a').rgb,'158,146,182');assert.equal(model.diaColors('crimson','tag').find(x=>x.key==='a').rgb,'184,72,78');
  assert.equal(model.diaColors('crimson','tag','follow',2).filter(x=>x.active).length,1);}
// 演出中は入力を受け付けない。
const m=model.machine();assert.equal(m.state,'open');assert.equal(m.close(),true);assert.equal(m.locked,true);assert.equal(m.open(),false,'閉じる途中に開けない');assert.equal(m.close(),false,'二重に閉じない');
m.step(5);assert.equal(m.state,'closed');assert.equal(m.open(),true);m.step(5);assert.equal(m.state,'open');
// ページの制御（DOMの代わり）。
class Node{constructor(){this.h=new Map();this.style={setProperty(k,v){this[k]=v;}};this.attrs={};this.dataset={};this.hidden=false;this.disabled=false;}
  addEventListener(t,fn){if(!this.h.has(t))this.h.set(t,new Set());this.h.get(t).add(fn);}removeEventListener(t,fn){this.h.get(t)?.delete(fn);}
  emit(t,e={}){for(const fn of [...this.h.get(t)||[]])fn(e);}setAttribute(k,v){this.attrs[k]=v;}getBoundingClientRect(){return {width:844};}querySelectorAll(){return [];}dispatchEvent(){}}
const ids=new Map(),$=id=>{if(!ids.has(id))ids.set(id,new Node());return ids.get(id);};
const doc=new Node(),win=new Node();doc.getElementById=$;doc.hidden=false;
$('flow').value='tear';$('dia').value='crimson';$('dia-order').value='tag';$('dia-mode').value='follow';$('dia-page').value='0';$('line-dia').value='none';$('event-dia').value='br';$('dia-order').options=[];$('dia').classList=undefined;$('phase').value='morning';$('effect-mode').value='full';$('speed').value='1';$('scrub-kind').value='close';$('scrub').value='0';
const media=new Node();media.matches=false;win.matchMedia=()=>media;win.Event=function(){};
const frames=new Map();let serial=0,clock=0;win.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};win.cancelAnimationFrame=id=>frames.delete(id);
win.setTimeout=()=>0;win.clearTimeout=()=>{};
const step=ms=>{clock+=ms;const list=[...frames.values()];frames.clear();list.forEach(fn=>fn(clock));};
win.TimeOfDay=require('../太陽盤_コマンド試作01/time-of-day.js');
$('sun-wheel').contentWindow={};
assert.ok(/\.sun-wheel\{[^}]*color-scheme:dark/.test(fs.readFileSync(path.join(__dirname,'hub2-sweep.css'),'utf8')),'太陽盤の下地が黒くならない（color-scheme を中のページと合わせる）');
const page=mount(doc,win,model);
assert.ok($('time-slot').innerHTML.includes('data-phase="morning"'),'時間帯アイコンを作る');assert.ok($('time-slot').innerHTML.includes('../太陽盤_コマンド試作01/time-of-day-art/'),'素材のパスを直す');assert.ok(!/src="time-of-day-art/.test($('time-slot').innerHTML));
assert.equal($('screen').style.transform,'scale(0.5)');assert.equal($('menu-star').hidden,true);
// 切り裂き（初期値）: 閉じる → 切れ目 → メニューが裂ける → 探索。
$('close-star').emit('click');assert.equal(page.machine.state,'closing');assert.equal($('close-star').disabled,true);
step(0);step(400);assert.equal($('tear').style.visibility,'visible');assert.ok($('tear-seam').attrs.d.startsWith('M1688'),'切れ目は右上の端から');assert.equal($('meteor').style.visibility,'visible');
step(600);assert.ok($('menu').style.clipPath.startsWith('path(evenodd'),'メニューが裂ける');
step(1000);assert.equal(page.machine.state,'closed');assert.equal($('menu').style.display,'none');assert.equal($('menu').style.clipPath,'');assert.equal($('menu-star').hidden,false);
$('menu-star').emit('click');step(0);step(1100);assert.ok($('menu').style.clipPath.startsWith('path("M'),'開くときは裂け目からメニュー');step(2000);assert.equal(page.machine.state,'open');
// 帯（比較用）も残す。
$('flow').value='topright';$('flow').emit('change');
$('close-star').emit('click');step(0);step(400);assert.equal($('band').style.visibility,'visible');assert.ok($('band').style.transform.includes('rotate(24.8'),'右上からの帯');assert.equal($('tear').style.visibility,'hidden');
$('menu-star').emit('click');assert.equal(page.machine.state,'closing','演出中のクリックは無視');
step(1000);assert.equal($('menu').style.display,'none');step(1000);assert.equal(page.machine.state,'closed');assert.equal($('menu-star').hidden,false);assert.equal($('band').style.visibility,'hidden');
$('time-slot').innerHTML='';$('menu-star').emit('click');step(0);step(900);assert.ok($('time-slot').innerHTML.length>0,'メニューが出たら時間帯アイコンを作り直す（日の出をもう一度）');assert.equal($('menu').style.display,'');step(2000);assert.equal(page.machine.state,'open');
// 運命予報カード: ティッカーを押すと開き、既読になる。暗幕・閉じる・Escで閉じる。Escはカードを先に閉じ、メニューは閉じない。
const timers=[];win.setTimeout=(fn,ms)=>{timers.push(fn);return timers.length;};
$('ticker').dataset.new='true';$('ticker').emit('click');assert.equal($('fortune').hidden,false);assert.equal($('fortune').dataset.state,'open');assert.equal($('ticker').dataset.new,'false');
assert.equal($('fortune').style['--d-card'],'0.55s');
const esc={key:'Escape',repeat:false,target:{closest:()=>null},preventDefault(){}};doc.emit('keydown',esc);assert.equal($('fortune').dataset.state,'closing');assert.equal(page.machine.state,'open','Escはカードを先に閉じる');
timers.splice(0).forEach(fn=>fn());assert.equal($('fortune').hidden,true);assert.equal($('fortune').dataset.state,'closed');
$('ticker').emit('click');$('fortune-scrim').emit('click');assert.equal($('fortune').dataset.state,'closing','暗幕で閉じる');timers.splice(0).forEach(fn=>fn());
$('scrub-kind').value='open';$('scrub').value='1000';$('scrub').emit('input');assert.equal(page.machine.kind,'open');assert.equal($('runner').dataset.dir,'close','右上からは開くときも同じ向き');
// 太陽盤の中の Esc（iframe からの知らせ）でも閉じる。よそからの知らせは無視。
page.machine.reset('open');win.emit('message',{data:{type:'solar-menu-escape'},source:{}});assert.equal(page.machine.state,'open','よその知らせは無視');
win.emit('message',{data:{type:'solar-menu-escape'},source:$('sun-wheel').contentWindow});assert.equal(page.machine.state,'closing','太陽盤の中のEscで閉じる');
page.destroy();assert.equal(frames.size,0);
console.log('PASS: Hub2 の帯スイープの数値（1.75秒・46〜54%で覆う・0.875秒で入れ替え・155.2°）、幾何（画面を覆いきる）、閉じる（星が弾ける→帯）・開く（帯→星が着地）、演出中は入力なし、短い／なしの案、ページの制御。ブラウザ描画は別途。');
