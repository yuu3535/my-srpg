const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const orbit = require('./orbit.js');
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, a+' != '+b);
for (let angle = -1080; angle <= 1080; angle += 13) for (let index = 0; index < 4; index++) for(const gap of [12,18,48]) {
  const p = orbit.slot(angle, index, gap);
  const originalTip=orbit.tips[index];
  close(Math.hypot(p.tipX, p.tipY-195),Math.hypot(originalTip.x-627,originalTip.y-627)*439/1254);
  close(orbit.wrap(Math.atan2(p.tipY-195,p.tipX)*180/Math.PI-p.rotation),0);
  close(p.rotation + p.counterRotation,0);
  assert.ok(p.commandIndex>=0 && p.commandIndex<4);
  if(p.visible) {
    assert.ok(p.top>=12 && p.top+p.height<=378);
    const nearestY=Math.max(0,Math.abs(p.y-195)-p.height/2);
    assert.ok(Math.hypot(p.left,nearestY)>orbit.envelope, 'Whole label must clear all needles');
    assert.ok(p.left-p.tipX>=gap-1e-8, 'Label must clear its associated tip');
    assert.ok(p.left+p.width<398, 'Label must clear right-hand information');
    assert.ok(p.line.length>0);
  }
}
for (let angle=-540; angle<540;angle+=9) for(let command=0;command<4;command++) {
  const target=orbit.targetFor(angle,command); assert.equal(orbit.selected(target),command);
  assert.ok(Math.abs(target-angle)<=180);
  close(orbit.snap(target),target);
}
assert.equal(orbit.dragDelta(179,-179),2); assert.equal(orbit.dragDelta(-179,179),-2);
assert.equal(orbit.selected(orbit.targetFor(0,0)),0); assert.equal(orbit.selected(orbit.targetFor(0,1)),1);
assert.throws(()=>orbit.targetFor(NaN,0),RangeError);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size);
const elements={};
function element() {
  const classes=new Set(), props={};
  return { value:'',style:{setProperty(k,v){props[k]=v;}},props,attributes:{},events:{},children:[],hidden:false,
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){on?classes.add(x):classes.delete(x);}},
    append(...nodes){this.children.push(...nodes);},setAttribute(k,v){this.attributes[k]=v;},
    addEventListener(name,fn){(this.events[name]||=[]).push(fn);},
    closest(){return null;},setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;},
    showModal(){this.open=true;},getBoundingClientRect(){return {left:0,top:0,width:844,height:390};},
    emit(name,event={}){event.target ||= this; event.preventDefault ||= ()=>{};event.stopPropagation ||= ()=>{}; (this.events[name]||[]).forEach(fn=>fn(event));}
  };
}
ids.forEach(id=>elements[id]=element());
elements.character.value='alche';elements.background.value='gray';elements.gap.value='18';
const frames=new Map();let frameId=0,now=1000,reduced=true;
const pageEvents={};let observerDisconnected=false;
const context=vm.createContext({
  window:{addEventListener(name,fn){pageEvents[name]=fn;}},
  document:{getElementById:id=>elements[id],createElement:element,documentElement:element()},
  matchMedia:()=>({get matches(){return reduced;}}),performance:{now:()=>now},
  ResizeObserver:class {constructor(fn){this.fn=fn;}observe(){}disconnect(){observerDisconnected=true;}},
  requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)
});
for(const script of [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1])){
  const file=path.resolve(__dirname,script.split('?')[0]);assert.ok(fs.existsSync(file));
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
for(const group of ['disk','rays'])for(const part of ['panes','frame']){
  const e=elements[group+'-'+part];assert.ok(fs.existsSync(path.resolve(__dirname,e.src)));e.onload();
}
assert.equal(elements.loading.hidden,true);
assert.equal(elements['selected-title'].textContent,'マップ');
assert.equal(elements.labels.children.length,4);
assert.equal(elements.connectors.children.length,4);
elements.next.emit('click');assert.equal(elements['selected-title'].textContent,'アイテム');
elements.next.emit('click');assert.equal(elements['selected-title'].textContent,'仲間');
elements.next.emit('click');assert.equal(elements['selected-title'].textContent,'支援');
elements.previous.emit('click');assert.equal(elements['selected-title'].textContent,'仲間');
const before=elements['rays-rotor'].style.transform;
elements.character.value='karima';elements.character.emit('change');
assert.equal(elements['rays-rotor'].style.transform,before);
assert.equal(elements['disk-panes'].style.opacity,.5);assert.equal(elements['rays-panes'].style.opacity,.89);
elements.decide.emit('click');assert.equal(elements.destination.open,true);
assert.equal(elements['destination-title'].textContent,'仲間専用画面への入口');elements.destination.open=false;
elements['reset-angle'].emit('click');assert.equal(elements['selected-title'].textContent,'マップ');
elements.viewport.emit('keydown',{key:'ArrowRight'});assert.equal(elements['selected-title'].textContent,'アイテム');
elements.viewport.emit('keydown',{key:'Enter'});assert.equal(elements.destination.open,true);elements.destination.open=false;
elements['reset-angle'].emit('click');
elements.viewport.emit('pointerdown',{button:0,pointerId:1,clientX:75,clientY:65.096});
elements.viewport.emit('pointermove',{pointerId:1,clientX:75,clientY:324.904});
close(Number(elements['angle'].value),210);
elements.viewport.emit('pointerup',{pointerId:1});
assert.equal(elements['selected-title'].textContent,'支援');
assert.equal(elements.viewport.capture,null);
now+=1000; elements['reset-angle'].emit('click');
elements.viewport.emit('wheel',{clientX:120,clientY:200,deltaY:1});
assert.equal(elements['selected-title'].textContent,'アイテム');
elements.viewport.emit('wheel',{clientX:120,clientY:200,deltaY:1});
assert.equal(elements['selected-title'].textContent,'アイテム');
now+=300; elements.viewport.emit('wheel',{clientX:700,clientY:200,deltaY:1});
assert.equal(elements['selected-title'].textContent,'アイテム');
elements['reset-angle'].emit('click'); reduced=false; elements.next.emit('click');
for(let i=0;i<250 && frames.size;i++){
  const callbacks=[...frames.values()];frames.clear();now+=16.667;callbacks.forEach(fn=>fn(now));
}
assert.equal(frames.size,0);assert.equal(elements['selected-title'].textContent,'アイテム');
elements.next.emit('click'); assert.ok(frames.size>0); pageEvents.pagehide();
assert.equal(frames.size,0);assert.equal(observerDisconnected,true);
console.log('PASS: measured tip alignment, no needle/label overlap, viewport bounds, counter-rotation, selection, image paths, theme, keyboard/drag/wheel, spring and cleanup');
