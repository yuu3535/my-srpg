// DOM操作全体の代替ではなく、設定処理・連動・保存の単体検証。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'icons-preview.html'),'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const start = script.indexOf('const betaDefaults');
const end = script.indexOf("document.getElementById('ouroborosVersion')");
const betaScript = script.slice(start,end);
function setup(saved, blocked = false) {
  const nodes = {};
  const layers = [{},{},{},{}];
  const properties = {};
  const store = new Map();
  if (saved != null) store.set('solar-app-icon-beta-settings-v01', JSON.stringify(saved));
  let download, revoked;
  const document = {
    getElementById(id) { return nodes[id] ||= { handlers:{}, addEventListener(type,fn){this.handlers[type]=fn;} }; },
    querySelectorAll() { return layers; },
    createElement() { return { click(){ download=this.download; }, remove(){} }; },
    body:{append(){}}
  };
  const context = vm.createContext({ document, root:{style:{setProperty(key,value){properties[key]=value;}}},
    localStorage:{getItem(key){if(blocked)throw new Error('disabled');return store.get(key)||null;},setItem(key,value){if(blocked)throw new Error('disabled');store.set(key,value);}},
    Blob, URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(url){revoked=url;}},setTimeout(fn){fn();}
  });
  vm.runInContext(betaScript,context);
  const state = () => JSON.parse(nodes.betaSettingsJson.value).sticker;
  return {nodes,layers,properties,store,state,context,getDownload:()=>download,getRevoked:()=>revoked};
}
const test = setup();
assert.equal(test.state().size,30);
assert.equal(test.properties['--beta-size'],'30%');
assert.ok(test.layers.every(layer=>layer.hidden===false));
test.nodes.betaSize.handlers.input({target:{value:'40'}});
assert.equal(test.properties['--beta-size'],'40%');
assert.equal(JSON.parse(test.store.get('solar-app-icon-beta-settings-v01')).size,40);
test.nodes.betaX.handlers.input({target:{value:'1000'}});
test.nodes.betaY.handlers.input({target:{value:'-1000'}});
test.nodes.betaAngle.handlers.input({target:{value:'NaN'}});
assert.equal(test.state().x,110);assert.equal(test.state().y,-15);assert.equal(test.state().angle,-8);
test.nodes.beta.handlers.change({target:{value:'off'}});
assert.ok(test.layers.every(layer=>layer.hidden));assert.equal(test.nodes.betaControls.hidden,true);
test.nodes.resetBeta.handlers.click();
assert.equal(test.state().size,30);assert.equal(test.state().visible,true);
test.nodes.saveBeta.handlers.click();
assert.equal(test.getDownload(),'fortune-app-beta-settings.json');assert.equal(test.getRevoked(),'blob:test');
assert.equal(test.state().sourceRect.width,190);
assert.equal(test.state().positionAnchor,'center');
const restored = setup({visible:false,size:37,x:79,y:12,angle:6});
assert.equal(restored.state().size,37);assert.equal(restored.state().visible,false);
const blocked = setup(null,true);
assert.ok(blocked.nodes.status.textContent.includes('自動保存を使えません'));
blocked.nodes.betaSize.handlers.input({target:{value:'42'}});
assert.equal(blocked.state().size,42);
// 大表示と32/48/64pxの各見本で、同じ相対サイズを使う。
assert.ok(html.includes("container.dataset.beta"));
assert.ok(html.includes('aspect-ratio:190/140'));
assert.ok(html.includes('width:538.9473684211%'));
console.log('beta: defaults, ranges, visibility, save, reload-state, blocked-storage, JSON and crop geometry passed');
