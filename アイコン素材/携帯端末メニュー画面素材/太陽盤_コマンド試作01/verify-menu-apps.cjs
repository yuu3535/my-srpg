// ローカルHTMLの静的参照とアプリ入口の単体検証。ブラウザ描画QAとは別。
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const model=require('./menu-apps-model.js');
const wheelModel=require('./menu-preview-model.js');
const {mount}=require('./menu-apps-preview.js');
const html=fs.readFileSync(path.join(__dirname,'menu-apps-preview.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'menu-apps-preview.css'),'utf8');
for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if(ref.startsWith('#'))continue;
  assert.ok(fs.existsSync(path.resolve(__dirname,ref.replace(/&amp;/g,'&').split(/[?#]/)[0])),ref);
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'ID重複');
for(const file of ['menu-apps-model.js','menu-apps-preview.js'])new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'));
assert.equal(model.app('__proto__'),null);
assert.equal(model.app('missing'),null);
assert.ok(!html.includes('menu-position.js'),'旧保存配置を新しい試作へ流用しない');
assert.ok(!html.includes('fortune-frame"'),'常設予報ではなくアプリから開く');
assert.ok(html.includes('残金 —')&&html.includes('名声値 —'),'数値を捏造しない');
assert.ok(html.includes('src="layout.html?embed=menu&amp;v=20261006b"'),'既存の太陽盤をそのまま使う');
const frame=fs.readFileSync(path.join(__dirname,'map-window-frame-v01.svg'),'utf8');
assert.ok(frame.includes('viewBox="0 0 440 166"'));
assert.ok(!/<(?:image|foreignObject|rect)\b/.test(frame),'枠に景色や中央の全面塗りを焼き込まない');
assert.ok(frame.includes('fill="none"'),'中央透明の線画枠');
const contour='M8 25 L25 8 H399 L432 36 V138 L414 158 H22 L8 144 Z';
assert.ok(html.includes('id="home-map-clip"><path d="'+contour+'"'),'画像クリップ輪郭');
assert.ok(frame.includes('<path d="'+contour+'" fill="none"'),'枠と画像の輪郭一致');
assert.ok(html.includes('id="home-map-location"')&&html.includes('id="home-map-frame"'),'内容と枠の独立レイヤー');
assert.ok(html.indexOf('id="home-map-location"')<html.indexOf('id="home-map-frame"'),'枠を画像より上へ重ねる');
for(const box of Object.values(model.boxes)) {
  assert.ok(box.left>=0&&box.top>=0);
  assert.ok(box.left+box.width<=844&&box.top+box.height<=390);
}
const overlaps=(a,b)=>a.left<b.left+b.width&&b.left<a.left+a.width&&a.top<b.top+b.height&&b.top<a.top+a.height;
const boxes=Object.values(model.boxes);
for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(overlaps(boxes[i],boxes[j]),false,'部品同士の重なり');
for(const [name,selector] of Object.entries({apps:'home-apps',map:'home-screen .map-card',tip:'home-screen .menu-tip',time:'home-screen .menu-time'})) {
  const escaped=selector.replaceAll('.','\\.');
  const rule=css.match(new RegExp('\\.'+escaped+' \\{([^}]+)'))[1];
  for(const property of ['left','top','width','height'])assert.ok(rule.includes(property+':'+model.boxes[name][property]+'px'),name+property);
}
const betaJSON=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../アプリアイコン_清書01/fortune-app-beta-settings.json'),'utf8'));
for(const key of Object.keys(model.beta))assert.equal(model.beta[key],betaJSON.sticker[key]);
assert.equal(betaJSON.sticker.positionAnchor,'center');
assert.ok(css.includes('rotate(var(--app-beta-angle,18deg))'));
function node() {
  return {handlers:new Map(),dataset:{},hidden:false,attributes:{},style:{properties:{},setProperty(k,v){this.properties[k]=v;}},
    addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn);},
    removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);},emit(type,event={}){for(const fn of [...this.handlers.get(type)||[]])fn(event);},
    setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}
  };
}
function setup(fallback=false,cached=false) {
  const elements=new Map(),byId=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
  const buttons=Object.keys(model.apps).map(id=>{
    const button=byId(id==='ouroboros'?'home-ouroboros':'button-'+id);button.dataset.homeApp=id;
    button.art=node();button.image=node();button.fallback=node();
    if(cached)Object.assign(button.image,{complete:true,naturalWidth:80});
    button.querySelector=selector=>({'.app-art>img':button.image,'.app-art':button.art,'.app-fallback':button.fallback})[selector];
    return button;
  });
  const sticker=node();byId('home-beta').querySelector=()=>sticker;
  const doc=node(),win=node();doc.getElementById=byId;doc.querySelectorAll=()=>buttons;
  byId('menu-wheel').contentWindow={};byId('home-mystery').checked=true;
  const dialog=byId('home-app-dialog');
  if(!fallback)dialog.showModal=function(){this.open=true;};
  const app=mount(doc,win,model,wheelModel);
  return {app,byId,doc,win,buttons,sticker};
}
const s=setup();
assert.equal(s.byId('menu-screen').dataset.mystery,'true');
assert.equal(s.byId('menu-screen').style.properties['--app-beta-size'],'33%');
assert.equal(s.byId('menu-screen').style.properties['--app-beta-x'],'78%');
assert.equal(s.byId('menu-screen').style.properties['--app-beta-y'],'21%');
assert.equal(s.byId('menu-screen').style.properties['--app-beta-angle'],'18deg');
for(const button of s.buttons) {
  button.emit('focus');assert.equal(s.byId('menu-tip').textContent,model.apps[button.dataset.homeApp].tip);
  button.emit('blur');assert.equal(s.byId('menu-tip').textContent,wheelModel.description('items'));
  button.emit('pointerenter');button.emit('pointerleave');
  button.emit('click');assert.equal(s.byId('home-app-dialog').open,true);
  assert.equal(s.byId('home-app-title').textContent,model.apps[button.dataset.homeApp].label);
  assert.equal(s.byId('menu-fortune').hidden,button.dataset.homeApp!=='fortune');
  button.image.emit('load');assert.equal(button.fallback.hidden,true);
  button.image.emit('error');assert.equal(button.fallback.hidden,false);assert.equal(s.byId('home-app-error').hidden,false);
  button.image.emit('load');assert.equal(s.byId('home-app-error').hidden,true);
}
s.sticker.emit('error');assert.equal(s.byId('home-beta').hidden,true);
s.sticker.emit('load');assert.equal(s.byId('home-beta').hidden,false);
s.byId('home-mystery').checked=false;s.byId('home-mystery').emit('change');
assert.equal(s.byId('home-ouroboros').hidden,true);
assert.equal(s.byId('menu-screen').dataset.mystery,'false');
s.byId('home-app-title').textContent='unchanged';s.app.openApp('ouroboros');assert.equal(s.byId('home-app-title').textContent,'unchanged');
s.app.openApp('__proto__');assert.equal(s.byId('home-app-title').textContent,'unchanged');
s.byId('home-mystery').checked=true;s.byId('home-mystery').emit('change');assert.equal(s.byId('home-ouroboros').hidden,false);
s.win.emit('message',{source:s.byId('menu-wheel').contentWindow,data:{type:'solar-menu-state',selected:'save'}});
assert.equal(s.byId('menu-tip').textContent,wheelModel.description('save'));
s.win.emit('message',{source:{},data:{type:'solar-menu-state',selected:'items'}});assert.equal(s.byId('menu-tip').textContent,wheelModel.description('save'));
s.app.destroy();s.app.destroy();s.byId('home-app-title').textContent='destroyed';s.buttons[0].emit('click');assert.equal(s.byId('home-app-title').textContent,'destroyed');
const f=setup(true,true);f.app.openApp('fortune');assert.equal(f.byId('home-app-dialog').attributes.open,'');
let prevented=false;f.byId('home-app-close').emit('click',{preventDefault(){prevented=true;}});
assert.equal(prevented,true);assert.equal(f.byId('home-app-dialog').attributes.open,undefined);f.app.destroy();
console.log('PASS: マップ枠／内容の分離・輪郭一致・アプリ素材・横画面の非重複配置・指定β設定・入口開閉・名声／残金未接続表示・謎アプリ切替・エラー復旧・送信元・破棄。ブラウザ描画QA未実施。');
