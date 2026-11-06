'use strict';
// ⑤ 日輪の扇の検証（Node、フレームワークなし）。node verify-sunfan.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('./sunfan-model.js'),keys=require('./transition-model.js'),{mount}=require('./sunfan.js');
const html=fs.readFileSync(path.join(__dirname,'sunfan.html'),'utf8');
for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(path.resolve(__dirname,ref.split(/[?#]/)[0])),ref);
for(const file of ['sunfan-model.js','sunfan.js'])new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'));
const T=model.timing;
// 長さ: 開く0.6秒以内、閉じるのは開くより短い。
assert.ok(T.open.end<=.6&&T.close.end<T.open.end);
// 順番: 扇が角度に届いた順に出る。「出撃」（1番）が最初、項目は0.4秒までに出そろう。
const first=model.itemStarts.indexOf(Math.min(...model.itemStarts));assert.equal(first,1,'出撃が最初');
assert.ok(Math.max(...model.itemStarts)+T.open.itemLength<=.4,'項目は0.4秒までに出そろう');
for(let i=0;i<13;i++)for(let j=0;j<13;j++)if(model.itemAngles[i]<model.itemAngles[j])assert.ok(model.itemStarts[i]<=model.itemStarts[j]);
// 開き終わり: 太陽は元の位置・回転0・倍率1、扇は全開で切り抜きなし、針とふちは消えている。
const done=model.openPose();
assert.equal(done.spin,0);assert.equal(done.scale,1);assert.equal(done.sunAlpha,1);assert.equal(done.fan,T.open.fanAngle);assert.ok(done.edge<1e-9);assert.ok(done.items.every(v=>v===1));
assert.equal(model.fanMask(done.fan),'none');
// 太陽が昇るあいだ（扇が開く前）は項目を出さない。
for(let t=0;t<T.open.fanStart;t+=.01){const v=model.pose(t);assert.ok(v.items.every(x=>x===0));assert.equal(v.fan,0);}
// 切り抜き: 扇0度では太陽の円だけ（遠い点を作らない）。扇が開いたら遠くまで届く。
// 扇のマスク: 太陽の中心から右向き（90度）に±fan度。扇0度では幅0（何も見せない）。
const span=mask=>{const [a,b]=[...mask.matchAll(/#000 ([\d.]+)deg/g)].map(m=>+m[1]);return [a,b];};
assert.ok(model.fanMask(0).includes('at 0px 195px'));{const [a,b]=span(model.fanMask(0));assert.equal(a,b);}
for(const fan of [.5,4,37.3,80]){const [a,b]=span(model.fanMask(fan));assert.ok(Math.abs(a-(90-fan))<1e-3&&Math.abs(b-(90+fan))<1e-3);}
// 太陽は円で切らない: 昇るあいだも太陽の不透明度だけで見せる（80msで1）。
assert.equal(model.pose(0).sunAlpha,0);assert.ok(model.pose(T.open.sunIn).sunAlpha>.999);
// 閉じる: 針が消えるまで暗幕を戻さない（線を残したまま探索を明るくしない）。最後は全部0に戻る。
for(let t=0;t<=T.close.end;t+=.005){const v=model.pose(t,done,true);if(v.dim<.62-1e-9)assert.equal(v.beam,0,`t=${t}`);}
const shut=model.pose(T.close.end,done,true);assert.equal(shut.sunAlpha,0);assert.equal(shut.dim,0);assert.equal(shut.world,1);assert.equal(shut.beam,0);
// 磨き: 着地で少し行きすぎて戻る。光の帯は一度だけ横切り、差しこむ光と波紋は開き終わりまでに消える。
{const spins=Array.from({length:57},(_,i)=>model.pose(i/100).spin);assert.ok(Math.max(...spins)>5&&Math.max(...spins)<=T.open.overshoot+1e-9,'行きすぎは7度まで');assert.equal(model.pose(T.open.settle).spin,0);
  assert.ok(model.pose(T.open.glintStart+T.open.glintLength/2).glintAlpha>.5);{const quiet=model.machine();quiet.open(false);for(let i=0;i<60;i++){quiet.step(.01,1);assert.equal(quiet.visual.glintAlpha,0,'光の帯なしで開ける');}}
  assert.ok(done.glintAlpha<1e-9&&done.wash<1e-9,'開き終わりに光は残さない');assert.ok(Math.max(...Array.from({length:57},(_,i)=>model.pose(i/100).wash))>T.open.washPeak*.8);
  const reopen=model.machine();reopen.open();reopen.step(1,1);reopen.close();reopen.step(.05,1);reopen.open();reopen.step(.3,1);assert.ok(Math.abs(reopen.visual.spin)<1,'開き直しでは大きく揺れない');}
// 速さと「短い」「なし」。
assert.equal(model.timeScale('full',false,1),1);assert.equal(model.timeScale('full',false,.25),.25);
assert.ok(Math.abs(T.open.end/model.timeScale('short',false,1)-T.short.open)<1e-9);assert.ok(Math.abs(T.close.end/model.timeScale('none',true,1)-T.none.close)<1e-9);
// 途中で反転しても飛ばない（見えていない光の位置は比べない）。
const seen=v=>{const out={...v};if(!(out.glintAlpha>0))delete out.glintPos;return out;};
for(const when of [.05,.18,.25,.4]){
  const m=model.machine();m.open();m.step(when,1);const at=m.visual;m.close();m.step(0,1);assert.deepEqual(seen(m.visual),seen(at),'閉じ始めの1コマ目が飛ばない');
  m.step(.08,1);const back=m.visual;m.open();m.step(0,1);assert.deepEqual(seen(m.visual),seen(back),'開き直しの1コマ目が飛ばない');m.step(1,1);assert.equal(m.state,'open');
}
const again=model.machine();again.open();again.open();assert.equal(again.state,'open','開く途中にもう一度「開く」は最後へ');
// ページの制御（DOMの代わり）。
class Node{constructor(){this.handlers=new Map();this.style={setProperty(k,v){this[k]=v;}};this.dataset={};this.attributes={};this.value='';this.hidden=false;this.complete=true;this.firstElementChild=null;}
  addEventListener(t,f){if(!this.handlers.has(t))this.handlers.set(t,new Set());this.handlers.get(t).add(f);}removeEventListener(t,f){this.handlers.get(t)?.delete(f);}
  emit(t,e={}){for(const f of [...this.handlers.get(t)||[]])f(e);}setAttribute(k,v){this.attributes[k]=v;}getBoundingClientRect(){return {width:844};}}
const ids=new Map(),$=id=>{if(!ids.has(id)){const n=new Node();n.firstElementChild=new Node();ids.set(id,n);}return ids.get(id);};
const doc=new Node(),win=new Node();doc.getElementById=$;doc.hidden=false;
$('owner').value='alche';$('glint-mode').value='first';$('effect-mode').value='full';$('speed').value='1';$('scrub').value='0';$('exploration').parentElement=new Node();
const sent=[];$('home').contentWindow={postMessage(m){sent.push(m);}};
const media=new Node();media.matches=false;win.matchMedia=()=>media;win.location={protocol:'http:',origin:'http://preview.test'};
const frames=new Map();let serial=0,clock=0;win.requestAnimationFrame=f=>{frames.set(++serial,f);return serial;};win.cancelAnimationFrame=id=>frames.delete(id);
win.setTimeout=()=>0;win.clearTimeout=()=>{};win.getComputedStyle=()=>({getPropertyValue:()=>'0px'});
const step=ms=>{clock+=ms;const f=[...frames.values()];frames.clear();f.forEach(cb=>cb(clock));};
const page=mount(doc,win,model,keys);
assert.equal($('toggle').disabled,true,'準備ができるまで開けない');
win.emit('message',{source:{},origin:win.location.origin,data:{type:'menu-transition-ready',ready:true}});assert.equal(page.ready,false,'ほかの窓からの準備完了は受け取らない');
win.emit('message',{source:$('home').contentWindow,origin:win.location.origin,data:{type:'menu-transition-ready',ready:true}});assert.equal(page.ready,true);
assert.equal($('toggle').style.top,'282px');assert.equal($('toggle').dataset.fit,'true','④と同じ空き枠に置く');
const config=sent.filter(m=>m.type==='menu-transition-config').at(-1);assert.equal(config.returnKey.visible,false);assert.equal(config.returnKey.enabled,true);
// 元の素材の太陽: 動いているあいだは .sun-art が回り、ホームは回さない（メニューが傾かない）。開き切るとホームの太陽へ入れ替わる。
assert.equal(model.pose(.3).swap,0);assert.equal(done.swap,1);
{const back=model.pose(.08,done,true);assert.equal(back.swap,0,'閉じ始め80msで動かせる太陽へ戻る');assert.ok(back.fan>80,'扇がたたまれる前に戻る');}
page.machine.reset();$('scrub').value='120';$('scrub').emit('input');
assert.equal($('home').style.transform,'none');assert.ok(Number($('sun-art').style.opacity)>0);assert.ok($('sun-art').style.transform.includes('rotate('));assert.equal($('home').dataset.masked,'true');
page.machine.reset();page.draw();
$('toggle').emit('click',{stopPropagation(){}});assert.equal(page.machine.state,'opening');assert.equal($('toggle-label').textContent,'戻る');assert.equal($('home').inert,false,'開き始めから押せる');assert.equal(page.machine.visual.glintOn,true,'初回は光の帯を出す');
step(0);step(100);$('toggle').emit('click',{stopPropagation(){}});assert.equal(page.machine.state,'closing','開く途中の「戻る」はその場から閉じる');assert.equal($('toggle-label').textContent,'端末');
step(0);step(400);assert.equal(page.machine.state,'closed');
$('toggle').emit('click',{stopPropagation(){}});step(0);step(1000);assert.equal(page.machine.state,'open');assert.equal($('home').dataset.masked,'false','開き切ったら切り抜かない');assert.equal($('sun-art').style.opacity,'0','開き切ったらホームの太陽だけ');
$('toggle').emit('click',{stopPropagation(){}});step(0);step(1000);assert.equal(page.machine.state,'closed');
// 2回目からは光の帯（きらっ）を出さない。「毎回」を選べば出る。
$('toggle').emit('click',{stopPropagation(){}});step(0);step(240);assert.equal(page.machine.visual.glintAlpha,0,'2回目は光の帯なし');step(1000);$('toggle').emit('click',{stopPropagation(){}});step(0);step(1000);
$('glint-mode').value='always';$('glint-mode').emit('change');$('toggle').emit('click',{stopPropagation(){}});step(0);step(240);assert.ok(page.machine.visual.glintAlpha>.3,'毎回を選べば出る');step(1000);$('toggle').emit('click',{stopPropagation(){}});step(0);step(1000);assert.equal($('home').style.visibility,'hidden');
$('scrub').value='230';$('scrub').emit('input');assert.equal(page.machine.state,'scrub');assert.ok(sent.filter(m=>m.type==='menu-transition-motion').at(-1).items[1]>0);
$('effect-mode').value='none';$('effect-mode').emit('change');page.machine.reset();page.open();assert.equal($('home').dataset.masked,'false','「なし」は切り抜かない');
page.destroy();assert.equal(frames.size,0);
console.log('PASS: ⑤ 日輪の扇の長さ・出る順番（出撃が最初）・開き終わり・切り抜き・閉じるとき線を残さない・速さ／短い／なし・途中反転・ボタンの位置と切り替え・送信元・コマ送り。ブラウザ描画QAは別途。');
