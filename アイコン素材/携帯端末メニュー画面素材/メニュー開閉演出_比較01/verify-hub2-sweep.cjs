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
// 演出中は入力を受け付けない。
const m=model.machine();assert.equal(m.state,'open');assert.equal(m.close(),true);assert.equal(m.locked,true);assert.equal(m.open(),false,'閉じる途中に開けない');assert.equal(m.close(),false,'二重に閉じない');
m.step(5);assert.equal(m.state,'closed');assert.equal(m.open(),true);m.step(5);assert.equal(m.state,'open');
// ページの制御（DOMの代わり）。
class Node{constructor(){this.h=new Map();this.style={setProperty(k,v){this[k]=v;}};this.attrs={};this.dataset={};this.hidden=false;this.disabled=false;}
  addEventListener(t,fn){if(!this.h.has(t))this.h.set(t,new Set());this.h.get(t).add(fn);}removeEventListener(t,fn){this.h.get(t)?.delete(fn);}
  emit(t,e={}){for(const fn of [...this.h.get(t)||[]])fn(e);}setAttribute(k,v){this.attrs[k]=v;}getBoundingClientRect(){return {width:844};}querySelectorAll(){return [];}dispatchEvent(){}}
const ids=new Map(),$=id=>{if(!ids.has(id))ids.set(id,new Node());return ids.get(id);};
const doc=new Node(),win=new Node();doc.getElementById=$;doc.hidden=false;
$('flow').value='topright';$('effect-mode').value='full';$('speed').value='1';$('scrub-kind').value='close';$('scrub').value='0';
const media=new Node();media.matches=false;win.matchMedia=()=>media;win.Event=function(){};
const frames=new Map();let serial=0,clock=0;win.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};win.cancelAnimationFrame=id=>frames.delete(id);
win.setTimeout=()=>0;win.clearTimeout=()=>{};
const step=ms=>{clock+=ms;const list=[...frames.values()];frames.clear();list.forEach(fn=>fn(clock));};
const page=mount(doc,win,model);
assert.equal($('screen').style.transform,'scale(0.5)');assert.equal($('menu-star').hidden,true);
$('close-star').emit('click');assert.equal(page.machine.state,'closing');assert.equal($('close-star').disabled,true);
step(0);step(400);assert.equal($('band').style.visibility,'visible');assert.ok($('band').style.transform.includes('rotate(24.8'),'右上からの帯');
$('menu-star').emit('click');assert.equal(page.machine.state,'closing','演出中のクリックは無視');
step(1000);assert.equal($('menu').style.display,'none');step(1000);assert.equal(page.machine.state,'closed');assert.equal($('menu-star').hidden,false);assert.equal($('band').style.visibility,'hidden');
$('menu-star').emit('click');step(0);step(900);assert.equal($('menu').style.display,'');step(2000);assert.equal(page.machine.state,'open');
// 運命予報カード: ティッカーを押すと開き、既読になる。暗幕・閉じる・Escで閉じる。Escはカードを先に閉じ、メニューは閉じない。
const timers=[];win.setTimeout=(fn,ms)=>{timers.push(fn);return timers.length;};
$('ticker').dataset.new='true';$('ticker').emit('click');assert.equal($('fortune').hidden,false);assert.equal($('fortune').dataset.state,'open');assert.equal($('ticker').dataset.new,'false');
assert.equal($('fortune').style['--d-card'],'0.55s');
const esc={key:'Escape',repeat:false,target:{closest:()=>null},preventDefault(){}};doc.emit('keydown',esc);assert.equal($('fortune').dataset.state,'closing');assert.equal(page.machine.state,'open','Escはカードを先に閉じる');
timers.splice(0).forEach(fn=>fn());assert.equal($('fortune').hidden,true);assert.equal($('fortune').dataset.state,'closed');
$('ticker').emit('click');$('fortune-scrim').emit('click');assert.equal($('fortune').dataset.state,'closing','暗幕で閉じる');timers.splice(0).forEach(fn=>fn());
$('scrub-kind').value='open';$('scrub').value='1000';$('scrub').emit('input');assert.equal(page.machine.kind,'open');assert.equal($('runner').dataset.dir,'close','右上からは開くときも同じ向き');
page.destroy();assert.equal(frames.size,0);
console.log('PASS: Hub2 の帯スイープの数値（1.75秒・46〜54%で覆う・0.875秒で入れ替え・155.2°）、幾何（画面を覆いきる）、閉じる（星が弾ける→帯）・開く（帯→星が着地）、演出中は入力なし、短い／なしの案、ページの制御。ブラウザ描画は別途。');
