'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('./transition-model.js'),{mount}=require('./transition.js');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'transition.css'),'utf8');
for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(path.resolve(__dirname,ref.split(/[?#]/)[0])),ref);
for(const file of ['transition-model.js','transition.js'])new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'));
assert.equal((html.match(/data-variant=/g)||[]).length,4);assert.ok(html.includes('端末の演出'));
assert.ok(!html.includes('class="terminal-close'),'重ねる仮の閉じる札を撤去');
assert.ok(css.includes('min-height:44px')&&css.includes('safe-area-inset-right')&&css.includes('safe-area-inset-bottom'));
assert.ok(css.includes('aspect-ratio:844/390')&&!css.includes('grid-template-columns:1fr'),'横画面を縦積みへ変えない');
assert.ok(!fs.readFileSync(path.join(__dirname,'transition.js'),'utf8').includes('ImageGen'),'生成絵コンテを動作画面へ使わない');
assert.equal(model.canOpen('event'),false);assert.equal(model.canOpen('free'),true);assert.equal(model.canOpen('unknown'),false);
assert.equal(model.effectiveMode('full',true),'none');assert.equal(model.mode('bad'),'full');
assert.equal(model.duration('raise'),.5);assert.equal(model.duration('approach'),.36);assert.equal(model.duration('dissolve','short'),.18);assert.equal(model.duration('raise','none'),.1);assert.equal(model.duration('raise','full',true),.2);
assert.equal(model.duration('approach','full',false,.5),.72);
// 最終的なホームの844:390を均一拡大。原本の内窓比率と終点座標を検査する。
assert.ok(Math.abs(model.frame.innerWidth/model.frame.innerHeight-844/390)<1e-10);
assert.ok(Math.abs(model.frameBox.left+model.frame.x*390/643)<1e-9);
assert.ok(Math.abs(model.frameBox.top+model.frame.y*390/643)<1e-9);
assert.ok(model.framedScale>.73&&model.framedScale<.74);
for(const id of Object.keys(model.variants))for(const mode of ['full','short','none']){
  const finish=model.pose(id,1,mode);assert.equal(finish.scale,1);assert.equal(finish.y,0);assert.equal(finish.tilt,0);assert.equal(finish.opacity,1);
  if(id==='dissolve'||mode==='none')assert.equal(finish.frameOpacity,0);
  let priorScale=0;
  for(let p=0;p<=1;p+=.01){const value=model.pose(id,p,mode);assert.ok(Object.values(value).flat().every(Number.isFinite));assert.ok(value.scale>=priorScale);priorScale=value.scale;}
}
assert.equal(model.pose('approach',.9).frameOpacity,1,'寄り案では枠をフェードしない');
assert.ok(model.pose('dissolve',.8).frameOpacity<.5);assert.ok(model.pose('raise',0).y>model.pose('approach',0).y);
assert.ok(html.includes('<option value="1" selected>通常</option>'),'通常速度を初期値にする');
assert.ok(html.includes('<option value="frameout" selected>'),'④を初期の操作対象にする');
assert.ok(html.includes('id="wake-enabled" type="checkbox" checked'));
assert.equal(model.wake(0).reveal,0);assert.ok(model.wake(.35).markOpacity>0);assert.ok(model.wake(.35).lineOpacity>0);
assert.equal(model.wake(.9).reveal,1);assert.ok(model.pose('approach',.9).scale<1,'ホームが現れた後、最後の寄りで収まる');
for(const progress of [0,.2,.5,.9,1]){
  assert.ok(Object.values(model.wake(progress)).every(Number.isFinite));
  assert.equal(model.wake(progress,'none').reveal,1);assert.equal(model.wake(progress,'none').markOpacity,0);
  assert.equal(model.wake(progress,'full',false).reveal,1);
}
assert.equal(model.wake(1).markOpacity,0);assert.equal(model.wake(1).lineOpacity,0);
const machine=model.machine();assert.equal(machine.open(false),false);assert.equal(machine.state,'closed');machine.open();machine.step(.1,.36);const p=machine.progress;machine.close();assert.equal(machine.progress,p,'途中で閉じても飛ばない');machine.step(.02,.2);assert.ok(machine.progress<p);machine.open();machine.open();assert.equal(machine.state,'open','再度開く操作は最後へ');machine.close();machine.step(100,.2);assert.equal(machine.state,'closed');
const gate=model.inputGate();gate.press('ArrowRight',true);gate.walk({x:10},true);gate.stop();assert.equal(gate.moving,false);assert.equal(gate.blocked,true);assert.equal(gate.press('ArrowRight',true),false);gate.release('ArrowRight');assert.equal(gate.press('ArrowRight',true),true);
class Node {
  constructor(){this.handlers=new Map();this.style={setProperty(k,v){this[k]=v;}};this.dataset={};this.attributes={};this.value='';this.hidden=false;this.inert=false;this.tabIndex=0;this.complete=true;this.naturalWidth=100;this.map=new Map();}
  addEventListener(t,f){if(!this.handlers.has(t))this.handlers.set(t,new Set());this.handlers.get(t).add(f);}
  removeEventListener(t,f){this.handlers.get(t)?.delete(f);}
  emit(t,e={}){for(const f of [...this.handlers.get(t)||[]])f(e);}
  setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}removeAttribute(k){delete this.attributes[k];if(k==='data-large')delete this.dataset.large;}
  querySelector(s){if(!this.map.has(s))this.map.set(s,new Node());return this.map.get(s);}append(){}focus(){this.focused=true;}closest(){return null;}
  getBoundingClientRect(){return {width:this.width||360};}
}
function setup(saved=null){
  const doc=new Node(),win=new Node(),ids=new Map();doc.body=new Node();doc.hidden=false;
  const $=id=>{if(!ids.has(id))ids.set(id,new Node());return ids.get(id);};doc.getElementById=$;
  $('effect-mode').value='full';$('wake-enabled').checked=true;$('context').value='free';$('owner').value='alche';$('speed').value='1';$('active').value='approach';
  const settings=$('settings-dialog');settings.open=false;settings.showModal=()=>{settings.open=true;};settings.close=()=>{settings.open=false;settings.emit('close');};
  $('stage-template').content={cloneNode(){return new Node();}};
  const elements=Object.keys(model.variants).map(id=>{const element=new Node();element.dataset.variant=id;const stage=element.querySelector('.stage-slot').querySelector('.stage'),iframe=stage.querySelector('.home');iframe.messages=[];iframe.contentWindow={postMessage(m){iframe.messages.push(m);}};iframe.attributes.src='../メニューホーム_独立アプリ01/index.html?view=screen&embed=transition';return element;});
  doc.querySelectorAll=()=>elements;
  const media=new Node();media.matches=false;win.matchMedia=()=>media;win.location={protocol:'http:',origin:'http://preview.test'};win.innerWidth=844;win.innerHeight=390;
  win.getComputedStyle=node=>({getPropertyValue:key=>node.safe?.[key]||'0px'});
  const timers=new Map(),frames=new Map(),storage=new Map();let serial=0,clock=0;
  if(saved!==null)storage.set('solar-menu-transition-comparison-v01',JSON.stringify(saved));
  win.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  win.setTimeout=f=>{timers.set(++serial,f);return serial;};win.clearTimeout=id=>timers.delete(id);
  win.requestAnimationFrame=f=>{frames.set(++serial,f);return serial;};win.cancelAnimationFrame=id=>frames.delete(id);
  function step(ms){clock+=ms;const f=[...frames.values()];frames.clear();f.forEach(callback=>callback(clock));}
  const api=mount(doc,win,model);
  function message(card,data,source=card.iframe.contentWindow,origin=win.location.origin){win.emit('message',{source,origin,data});}
  const key=(key,repeat=false)=>({key,repeat,target:api.cards[0].stage,preventDefault(){this.prevented=true;}});
  return {doc,win,$,api,media,timers,frames,storage,step,message,key};
}
const s=setup(),a=s.api.cards[0];assert.equal(a.ready,false);s.api.open(a);assert.equal(a.machine.state,'closed','準備中に開かない');
s.message(a,{type:'menu-transition-ready',ready:true},{},s.win.location.origin);assert.equal(a.ready,false);
s.message(a,{type:'menu-transition-ready',ready:true},a.iframe.contentWindow,'http://other.test');assert.equal(a.ready,false);
for(const card of s.api.cards)s.message(card,{type:'menu-transition-ready',ready:true});assert.equal(s.$('open-all').disabled,false);assert.equal(s.timers.size,0);
s.doc.emit('keydown',s.key('ArrowRight'));assert.equal(a.input.moving,true);s.api.open(a);assert.equal(a.input.moving,false);assert.equal(a.input.blocked,true);
s.step(0);s.step(100);const halfway=a.machine.progress;s.api.close(a);assert.equal(a.machine.progress,halfway);s.step(40);assert.ok(a.machine.progress<halfway,JSON.stringify({halfway,progress:a.machine.progress,state:a.machine.state,pending:s.frames.size}));
s.step(500);assert.equal(a.machine.state,'closed');s.doc.emit('keydown',s.key('ArrowRight',true));assert.equal(a.input.moving,false);
s.doc.emit('keyup',{key:'ArrowRight'});s.doc.emit('keydown',s.key('ArrowRight'));assert.equal(a.input.moving,true);
// 端末ボタンのclickは移動へ渡さず、開く途中の再操作は最後へ。
a.entry.emit('click',{stopPropagation(){}});assert.equal(a.machine.state,'opening');a.entry.emit('click',{stopPropagation(){}});assert.equal(a.machine.state,'open');assert.equal(a.iframe.inert,false);
assert.equal(a.closeButton.disabled,false);assert.equal(a.closeButton.textContent,'閉じる演出を確認');
assert.equal(a.iframe.messages.filter(m=>m.type==='menu-transition-config').at(-1).returnKey.visible,true);
assert.equal(a.wakeTop.style.transform,'translateY(-100%)');assert.equal(a.wakeBottom.style.transform,'translateY(100%)');
s.message(a,{type:'menu-transition-settings'});assert.equal(s.$('settings-dialog').open,true);s.$('effect-mode').value='none';s.$('effect-mode').emit('change');assert.equal(a.frame.style.opacity,'0');assert.equal(a.wake.hidden,true);assert.equal(s.storage.size,1);s.$('settings-dialog').close();
s.message(a,{type:'menu-transition-escape'});assert.equal(a.machine.state,'closing');s.step(0);s.step(200);assert.equal(a.machine.state,'closed');assert.equal(a.iframe.inert,true);
assert.equal(a.closeButton.disabled,true);assert.equal(a.iframe.messages.filter(m=>m.type==='menu-transition-config').at(-1).returnKey.visible,false);
s.$('context').value='event';s.$('context').emit('change');s.api.open(a);assert.equal(a.machine.state,'closed');assert.equal(a.entry.disabled,true);s.$('context').value='free';s.$('context').emit('change');
s.$('effect-mode').value='full';s.$('effect-mode').emit('change');s.doc.emit('keydown',s.key('Escape',true));assert.equal(a.machine.state,'closed');s.doc.emit('keydown',s.key('Escape'));assert.equal(a.machine.state,'opening');
s.step(0);s.step(80);const paused=a.machine.progress;s.doc.hidden=true;s.doc.emit('visibilitychange');s.step(80000);assert.equal(a.machine.progress,paused);s.doc.hidden=false;s.doc.emit('visibilitychange');s.step(0);assert.equal(a.machine.progress,paused);s.step(1000);assert.equal(a.machine.state,'open');
a.largeButton.emit('click');assert.equal(a.element.dataset.large,'true');assert.equal(s.$('large-view').hidden,false);assert.ok(s.api.cards[1].element.inert);s.$('large-back').emit('click');assert.equal(s.$('large-view').hidden,true);assert.equal(s.api.cards[1].element.inert,false);
s.media.matches=true;s.media.emit('change');assert.equal(a.frame.style.opacity,'0');assert.ok(s.$('mode-summary').textContent.includes('OS'));
a.frame.emit('error');assert.ok(a.error.textContent.includes('枠を読み込めません'));assert.equal(a.frame.hidden,true);a.frame.emit('load');assert.equal(a.frame.hidden,false,'フレームが復旧したら表示も戻す');s.api.close(a);s.step(0);s.step(200);assert.equal(a.machine.state,'closed');
s.api.open(a);s.win.emit('pagehide',{persisted:true});assert.equal(s.frames.size,0);s.win.emit('pageshow');s.step(0);s.step(200);assert.equal(a.machine.state,'open');
s.api.destroy();s.api.destroy();assert.equal(s.frames.size,0);assert.equal(s.timers.size,0);const state=a.machine.state;a.entry.emit('click',{stopPropagation(){}});assert.equal(a.machine.state,state);
const late=setup(),lateCard=late.api.cards[0];for(const timer of [...late.timers.values()])timer();assert.equal(lateCard.retry.hidden,false);assert.ok(lateCard.error.textContent.includes('応答'));lateCard.retry.emit('click');assert.equal(lateCard.ready,false);assert.ok(lateCard.iframe.src.includes('embed=transition'));late.message(lateCard,{type:'menu-transition-ready',ready:true});late.api.open(lateCard);lateCard.stage.emit('click',{target:lateCard.stage});assert.equal(lateCard.machine.state,'open','開く途中の画面タップは最後へ');late.api.destroy();assert.equal(late.timers.size,0);
const wakeView=setup(),wakeCard=wakeView.api.cards[0];wakeView.message(wakeCard,{type:'menu-transition-ready',ready:true});wakeView.api.open(wakeCard);wakeView.step(0);wakeView.step(100);assert.equal(wakeCard.wake.hidden,false);assert.ok(wakeCard.wakeMark.style.opacity>0);wakeCard.closeButton.emit('click',{stopPropagation(){}});assert.equal(wakeCard.machine.state,'closing');assert.equal(wakeCard.wakeLabel.textContent,'スリープへ');wakeView.step(1000);assert.equal(wakeCard.machine.state,'closed');wakeView.$('wake-enabled').checked=false;wakeView.$('wake-enabled').emit('change');wakeView.api.open(wakeCard);assert.equal(wakeCard.wake.hidden,true);assert.equal(JSON.parse([...wakeView.storage.values()][0]).wake,false);wakeView.api.destroy();
// 新案は独立した開閉時計。実時間と要素ごとの順番、反転時の連続性を確認。
assert.equal(model.duration('frameout'),.614);assert.equal(model.duration('frameout','full',true),.29);
assert.equal(model.duration('frameout','full',false,.25),2.456);
assert.equal(model.coverScale(844,390,844*.7,390*.7),1/.7);assert.equal(model.coverScale(390,844,844,390),844/390);
assert.equal(model.coverScale(0,390,844,390),1);
const timeline=model.machine('frameout');assert.equal(timeline.open(false),false);timeline.open();timeline.step(.12,.614);
assert.equal(timeline.visual.screenY,.01);assert.ok(timeline.visual.items.every(v=>v===0));assert.ok(timeline.visual.worldScale>1);
timeline.step(.14,.614);assert.equal(timeline.visual.screenY,1);assert.ok(timeline.visual.items[0]>timeline.visual.items[1]);assert.equal(timeline.visual.items[12],0);
timeline.step(.12,.614);assert.equal(timeline.visual.scale,1);assert.equal(timeline.visual.frameOpacity,1,'枠はフェードしない');assert.equal(timeline.state,'opening','項目の余韻は本体の着地後も続く');
timeline.step(.234,.614);assert.equal(timeline.state,'open');assert.ok(timeline.visual.items.every(v=>v===1));assert.equal(timeline.visual.worldScale,1.05);
timeline.close();const closeStart=timeline.visual;timeline.step(.07,.29);assert.ok(timeline.visual.items.every(v=>v===0));assert.equal(timeline.visual.y,closeStart.y);
timeline.step(.17,.29);assert.equal(timeline.visual.opacity,0);assert.ok(timeline.visual.worldScale>1,'本体240ms、背景復帰は290ms');
timeline.step(.05,.29);assert.equal(timeline.state,'closed');assert.equal(timeline.visual.worldScale,1);
for(const when of [.04,.18,.29,.47]){
  const reverse=model.machine('frameout');reverse.open();reverse.step(when,.614);const atClose=reverse.visual;
  reverse.close();assert.deepEqual(reverse.visual,atClose);reverse.step(0,.29);assert.deepEqual(reverse.visual,atClose,'反転した最初のフレームも飛ばない');
  reverse.step(.11,.29);const atReopen=reverse.visual;reverse.open();reverse.step(0,.614);assert.deepEqual(reverse.visual,atReopen);
  reverse.step(1,.614);assert.equal(reverse.state,'open');reverse.close();reverse.close();reverse.step(.29,.29);assert.equal(reverse.state,'closed');
}
const fourth=setup(),newCard=fourth.api.cards[3];fourth.message(newCard,{type:'menu-transition-ready',ready:true});
fourth.api.open(newCard);assert.equal(newCard.iframe.inert,false,'④は開き始めから操作を受け付ける');assert.equal(newCard.wake.hidden,true);
assert.equal(newCard.iframe.messages.at(-1).active,true);fourth.step(0);fourth.step(260);assert.equal(newCard.iframe.style.transform,'scaleY(1)');
assert.ok(newCard.iframe.messages.some(m=>m.type==='menu-transition-motion'&&m.items[0]>0&&m.items[12]===0));
newCard.closeButton.emit('click',{stopPropagation(){}});assert.equal(newCard.machine.state,'closing');assert.equal(newCard.iframe.inert,true);
fourth.step(300);assert.equal(newCard.machine.state,'closed');assert.equal(newCard.iframe.messages.filter(m=>m.type==='menu-transition-config').at(-1).returnKey.visible,false);
fourth.api.open(newCard);fourth.step(0);fourth.step(180);const frozen=newCard.machine.visual;fourth.doc.hidden=true;fourth.doc.emit('visibilitychange');fourth.step(8000);assert.deepEqual(newCard.machine.visual,frozen);
fourth.doc.hidden=false;fourth.doc.emit('visibilitychange');fourth.step(0);assert.deepEqual(newCard.machine.visual,frozen);fourth.step(1000);assert.equal(newCard.machine.state,'open');
fourth.media.matches=true;fourth.media.emit('change');assert.equal(newCard.iframe.style.transform,'scaleY(1)');assert.equal(newCard.flash.hidden,true);assert.equal(newCard.frame.style.opacity,'0');assert.ok(newCard.iframe.messages.at(-1).items.every(v=>v===1));
fourth.api.destroy();assert.equal(fourth.frames.size,0);assert.equal(fourth.timers.size,0);
// 設定内の速さ・比較欄・保存を一つの値に揃える。旧保存には速度がないので通常へ。
for(const value of [undefined,null,0,-1,3,Infinity,'bad'])assert.equal(model.speed(value),1);
const preferences=setup();assert.equal(preferences.$('effect-speed').value,'1');
preferences.$('effect-speed').value='2';preferences.$('effect-speed').emit('change');
assert.equal(preferences.$('speed').value,'2');const stored=JSON.parse([...preferences.storage.values()][0]);assert.equal(stored.speed,2);
const restored=setup(stored);assert.equal(restored.$('speed').value,'2');assert.equal(restored.$('effect-speed').value,'2');
restored.$('speed').value='0.5';restored.$('speed').emit('change');assert.equal(restored.$('effect-speed').value,'0.5');assert.equal(JSON.parse([...restored.storage.values()][0]).speed,.5);
const legacy=setup({mode:'full',wake:false});assert.equal(legacy.$('speed').value,'1');assert.equal(legacy.$('wake-enabled').checked,false);
restored.win.localStorage.setItem=()=>{throw new Error('storage denied');};restored.$('effect-speed').value='1';restored.$('effect-speed').emit('change');assert.equal(restored.$('speed').value,'1');assert.ok(restored.$('storage-status').textContent.includes('保存できません'));
for(const view of [preferences,restored,legacy])view.api.destroy();
const navigation=setup(),home=navigation.api.cards[3];navigation.message(home,{type:'menu-transition-ready',ready:true});
navigation.api.open(home);navigation.api.open(home);assert.equal(home.machine.state,'open');
home.stage.width=844;home.stage.safe={'--safe-right':'24px','--safe-bottom':'16px'};navigation.win.emit('resize');
const config=home.iframe.messages.filter(m=>m.type==='menu-transition-config').at(-1);
assert.equal(config.returnKey.viewScale,1);assert.equal(config.returnKey.safeRight,24);assert.equal(config.returnKey.safeBottom,16);
navigation.message(home,{type:'menu-transition-back'},{});assert.equal(home.machine.state,'open');
navigation.message(home,{type:'menu-transition-back'},home.iframe.contentWindow,'http://other.test');assert.equal(home.machine.state,'open');
navigation.message(home,{type:'menu-transition-back'});assert.equal(home.machine.state,'closing');navigation.step(0);navigation.step(300);assert.equal(home.machine.state,'closed');
navigation.message(home,{type:'menu-transition-back'});assert.equal(home.machine.state,'closed','閉じた後の二重要求で再び開かない');
home.iframe.emit('load');assert.equal(home.iframe.messages.at(-1).returnKey.visible,false,'子の再読込には設定を再送');
navigation.api.destroy();
console.log('PASS: 4案の幾何・終点、④の点灯／順次表示／専用閉じる時計と途中反転、設定、読み込み、送信元、連打、イベント禁止、入力解除、Esc、非表示停止、大きく比較、失敗復旧、破棄。ブラウザ描画QAは未実施。');
