/* ブラウザを起動しないUIロジックの単体テスト。実画面の目視確認を代替しない。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('./fit-core.js');
const pixels = require('./pixel-core.js');
const presets = require('./preset-core.js');
const crypto = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
function harness(failedFile = null, storage = new Map(), storageFault = null) {
  const elements = {}, draws = [];
  function element(id, attrs = '') {
    const classes = new Set(), handlers = {};
    const el = { id, dataset: {}, style: { setProperty() {} }, value: attrs.match(/\bvalue="([^"]*)"/)?.[1] || '', checked: /\bchecked\b/.test(attrs), disabled: /\bdisabled\b/.test(attrs), hidden: /\bhidden\b/.test(attrs), textContent: '', handlers,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) },
      addEventListener: (type, fn) => { handlers[type] = fn; }, setAttribute: (name, value) => { el[name] = value; }, click: () => handlers.click?.(),
      querySelector: () => el.message ||= { textContent: '' }
    };
    el.appendChild=child=>{ (el.children ||= []).push(child); };
    el.replaceChildren=(...children)=>{el.children=children;el.value=children[0]?.value || '';};
    if (id === 'comparison' || id === 'fitting' || id === 'outfits' || id === 'mini' || id === 'palette-preview' || id === 'silhouette-canvas') {
      el.width = Number(attrs.match(/\bwidth="(\d+)"/)?.[1] || 0); el.height = Number(attrs.match(/\bheight="(\d+)"/)?.[1] || 0);
      const stack = [];
      const ctx = { globalAlpha: 1, save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); }, clearRect() { for (let i = draws.length - 1; i >= 0; i--) if (draws[i].canvas === id) draws.splice(i, 1); },
        translate() {}, scale() {}, rotate() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fillRect() {},
        getImageData(x,y,width,height) { return { data: new Uint8ClampedArray(width*height*4), width, height }; }, putImageData() {},
        drawImage(img) { draws.push({ canvas: id, file: img.src || img.dataset?.asset || 'silhouette', alpha: this.globalAlpha, seam: img.dataset?.seam === 'true' }); }
      };
      el.getContext = () => ctx;
      el.toBlob = callback => callback(new Blob(['mock PNG']));
    }
    return el;
  }
  for (const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) elements[tag[1]] = element(tag[1], tag[0]);
  elements.character.value = 'arshe';
  elements.material.value = 'cloth_tunic';
  elements['class-id'].value='戦列下級';
  const preview = element('preview'), secondary = element('secondary');
  const bodies = Object.keys(core.bodies).map(body => Object.assign(element(body), { dataset: { body } }));
  const names = ['arshe','karima','gunter'].map(key => element(key));
  const document = { getElementById: id => { assert.ok(elements[id], `HTMLに必要なID: ${id}`); return elements[id]; }, createElement: tag => element(tag === 'canvas' ? 'silhouette-canvas' : tag),
    querySelector: selector => { assert.equal(selector, '.preview'); return preview; },
    querySelectorAll: selector => selector === '[data-body]' ? bodies : selector === '.names span' ? names : selector === '.stage' ? [elements.stage, secondary] : []
  };
  const assets = core.allAssets();
  class Image {
    set src(value) {
      this.source = value; const asset = assets.find(a => value === `assets/${a.file}`); assert.ok(asset, value);
      [this.naturalWidth, this.naturalHeight] = asset.size;
      queueMicrotask(() => asset.file === failedFile ? this.onerror() : this.onload());
    }
    get src() { return this.source; }
  }
  const storageHandlers={};
  const localStorage={getItem:key=>{if(storageFault==='read')throw new Error('storage unavailable');return storage.get(key)||null;},setItem:(key,value)=>{if(storageFault==='write')throw new Error('quota exceeded');storage.set(key,value);}};
  vm.runInNewContext(source, { SharedBodyFit: core, SharedBodyPixels: pixels, SharedBodyPresets: presets, document, Image, Blob, crypto, localStorage, window:{addEventListener:(name,fn)=>{storageHandlers[name]=fn;}}, URL: { createObjectURL: () => 'blob:unit-test', revokeObjectURL() {} }, setTimeout: fn => fn() });
  const input = (id, value) => { elements[id].value = String(value); elements[id].handlers.input(); };
  const check = (id, value) => { elements[id].checked = value; elements[id].handlers.change(); };
  return { elements, draws, bodies, preview, input, check, storage, storageHandlers, setFailed: value => { failedFile = value; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
async function main() {
  const ui = harness(); await settle();
  const { elements: el, input, check } = ui;
  assert.equal(el.controls.disabled, false); assert.ok(ui.preview.classList.contains('ready'));
  const switchBody = key => ui.bodies.find(button => button.dataset.body === key).click();
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/line_child_a1.png'));
  assert.equal(el['gunter-option'].disabled, true);
  assert.equal(el['outfits-panel'].hidden, false);
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/arshe_extracted_head.png'));
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/arshe_extracted_head.png' && d.seam));
  check('seam', false); assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/arshe_extracted_head.png' && !d.seam)); check('seam', true);
  assert.ok(!ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/arshe_head.png'));
  assert.deepEqual(ui.draws.filter(d => d.canvas === 'outfits' && /line_child/.test(d.file)).map(d => d.file), ['assets/line_child_a1.png','assets/line_child_a2.png','assets/line_child_a3.png']);
  assert.equal(ui.draws.filter(d => d.canvas === 'outfits' && d.file === 'assets/arshe_extracted_head.png').length, 3);
  input('head-scale', 1.08); input('head-x', 3); el['match-outfits'].click();
  switchBody('lineA2'); assert.equal(el['head-scale'].value, 1.08); assert.equal(el['head-x'].value, 3);
  input('head-y', -4); switchBody('lineA1'); assert.equal(el['head-y'].value, 0);
  el.character.value = 'karima'; el.character.handlers.change(); assert.equal(el['head-scale'].value, 1);
  assert.ok(ui.draws.some(d => d.canvas === 'outfits' && d.file === 'assets/karima_extracted_head.png'));
  el.character.value = 'arshe'; el.character.handlers.change(); el.save.click();
  const outfitsData = JSON.parse(el['export-json'].value);
  assert.equal(outfitsData.version, 5); assert.equal(outfitsData.selectedBody, 'lineA1');
  assert.deepEqual(outfitsData.adjustments.lineA2.arshe, { scale: 1.08, x: 3, y: -4 });
  assert.equal(outfitsData.extractedHeads.arshe.file, 'arshe_extracted_head.png');
  assert.match(html, /id="reference-x"[^>]*min="-120" max="120"/);
  input('reference-x', -120); assert.equal(el['reference-x-value'].value, '-120px');
  switchBody('lineA2'); input('reference-x', 120);
  switchBody('lineA1'); assert.equal(el['reference-x'].value, -120);
  el.save.click();
  const wideData = JSON.parse(el['export-json'].value);
  assert.equal(wideData.referenceAdjustments.lineA1.arshe.x, -120);
  assert.equal(wideData.referenceAdjustments.lineA2.arshe.x, 120);
  el['reference-reset'].click();
  input('color-hue', 220); input('color-saturation', 56); input('color-lightness', -12);
  assert.equal(el['color-enabled'].checked, true);
  el.material.value='leather'; el.material.handlers.change(); assert.equal(el['color-hue'].value,145);
  input('color-hue',33); check('mask-view',true);
  el.character.value='karima'; el.character.handlers.change(); assert.equal(el['color-enabled'].checked,false);
  input('color-hue',90);
  el.character.value='arshe'; el.character.handlers.change(); assert.equal(el['color-hue'].value,33);
  switchBody('lineA2'); assert.equal(el['palette-controls'].disabled,true); assert.equal(el['hue-wheel'].tabIndex,-1);
  switchBody('lineA1'); assert.equal(el['palette-controls'].disabled,false);
  el.save.click();
  const colorData=JSON.parse(el['export-json'].value);
  assert.deepEqual(colorData.palette.characters.arshe.cloth_tunic,{enabled:true,hue:220,saturation:56,lightness:-12});
  assert.equal(colorData.palette.characters.karima.leather.hue,90);
  assert.equal(colorData.palette.mask.file,'line_a1_materials.png');
  assert.equal(colorData.seamView.enabled,true);
  el['color-reset'].click(); assert.equal(el['color-enabled'].checked,false);
  el['palette-png'].click(); assert.match(el.status.textContent,/頭なし/);
  el.material.value='cloth_tunic'; el.material.handlers.change(); assert.equal(el['color-hue'].value,220);
  el['palette-reset'].click(); assert.equal(el['color-enabled'].checked,false);
  check('mask-view',false);
  switchBody('providedChild');
  assert.equal(el['gunter-option'].disabled, false); assert.equal(el['outfits-panel'].hidden, true);
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/provided_child_body.png'));
  assert.equal(el.weapon.disabled, true); assert.equal(el.weapon.checked, false);
  assert.ok(!ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/orcus_sword.png'));
  switchBody('child'); assert.equal(el.weapon.disabled, false); assert.equal(el.weapon.checked, true);
  let referenceDraws = () => ui.draws.filter(d => d.canvas === 'fitting' && d.file === 'assets/arshe_original.png');
  assert.equal(referenceDraws().length, 0, 'ふだんは元のデザインを出さない（原作者 2026-10-06）');
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'silhouette' && d.alpha === 1), 'ふだんは元SDをシルエットで横に並べる');
  check('silhouette', false); check('overlay', true);
  assert.deepEqual(referenceDraws().map(d => d.alpha), [.35, 1], '重ねると、半透明の重ねと原画そのままの隣表示');
  input('reference-opacity', 0); assert.deepEqual(referenceDraws().map(d => d.alpha), [0, 1]);
  input('reference-opacity', 100); assert.deepEqual(referenceDraws().map(d => d.alpha), [1, 1]);
  check('overlay', false); assert.equal(referenceDraws().length, 1); assert.match(el['fitting-label'].textContent, /合成のみ/);
  check('overlay', true); check('silhouette', true);
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'silhouette' && d.alpha === 1));
  input('head-scale', 1.08); input('reference-scale', 1.1); input('reference-x', 15); input('reference-y', -8);
  switchBody('standard'); assert.equal(el['reference-scale'].value, 1); assert.equal(el['head-scale'].value, 1);
  switchBody('child'); assert.equal(el['reference-scale'].value, 1.1); assert.equal(el['reference-x'].value, 15); assert.equal(el['head-scale'].value, 1.08);
  el.character.value = 'karima'; el.character.handlers.change(); assert.equal(el['reference-x'].value, 0);
  check('silhouette', false);
  assert.ok(ui.draws.some(d => d.canvas === 'fitting' && d.file === 'assets/karima_original.png'));
  check('silhouette', true);
  el.character.value = 'arshe'; el.character.handlers.change(); el.save.click();
  const data = JSON.parse(el['export-json'].value);
  assert.deepEqual(data.referenceAdjustments.child.arshe, { scale: 1.1, x: 15, y: -8 });
  assert.deepEqual(data.adjustments.child.arshe, { scale: 1.08, x: 0, y: 0 });
  assert.equal(data.referenceView.opacity, 1); assert.equal(data.referenceView.silhouette, true);
  el['reference-reset'].click(); assert.equal(el['reference-x'].value, 0); assert.equal(el['reference-scale'].value, 1); assert.equal(el['head-scale'].value, 1.08);
  check('weapon', false); switchBody('providedChild');
  assert.equal(el.weapon.disabled, true); assert.equal(el.weapon.checked, false); assert.equal(el['reference-scale'].value, 1);
  switchBody('child'); assert.equal(el.weapon.disabled, false); assert.equal(el.weapon.checked, false);
  check('mirror', true); el.background.click(); assert.ok(el.stage.classList.contains('dark'));
  el.character.value = 'gunter'; el.character.handlers.change();
  switchBody('lineA3'); assert.equal(el.character.value, 'arshe', '抽出頭のないキャラを旧試作から持ち越さない');
  assert.ok(!ui.draws.some(d => d.canvas === 'comparison' && /gunter/.test(d.file)));
  assert.equal(el['record-save'].disabled,false);
  el['record-name'].value='調整テスト';input('head-x',7);input('color-hue',211);
  el['record-save'].click();
  let library=JSON.parse(ui.storage.get(presets.STORAGE_KEY));assert.equal(library.records.length,1);
  const firstId=library.records[0].id;
  assert.equal(library.records[0].characterId,'young_arshe');assert.equal(library.records[0].appearance.templateId,'lineA3');
  switchBody('lineA1');input('color-hue',211);input('head-x',9);el['record-save'].click();
  library=JSON.parse(ui.storage.get(presets.STORAGE_KEY));assert.equal(library.records.length,2);assert.equal(library.records[1].revision,2);
  el.character.value='karima';el.character.handlers.change();input('color-hue',47);el['record-save'].click();
  library=JSON.parse(ui.storage.get(presets.STORAGE_KEY));assert.equal(library.records.length,3);assert.equal(library.records[2].revision,1);
  assert.match(el['now-title'].textContent,/記録したばかり/,'記録した直後は、その記録を表示中と出す');
  el['record-list'].value=firstId;el['record-load'].click();assert.equal(el.character.value,'arshe');assert.equal(el['head-x'].value,7);
  assert.match(el['now-title'].textContent,/一覧から呼び出した記録/);assert.doesNotMatch(el['now-detail'].textContent,/変更あり/);
  assert.match(el['record-list'].children.find(o=>o.value===firstId).textContent,/表示中/,'一覧で表示中の記録に印');
  input('head-y',2);assert.match(el['now-detail'].textContent,/変更あり/,'呼び出したあとに変えたら分かる');input('head-y',0);
  el['record-list'].value=firstId;el['record-load'].click();
  assert.equal(el['body-title'].textContent,core.bodies.lineA3.label);
  el['record-backup'].click();const backup=el['record-export-text'].value;
  const reloaded=harness(null,ui.storage);await settle();
  assert.equal(reloaded.elements['record-list'].children.length,3,'再読込後も一覧が残る');
  reloaded.elements['record-list'].value=library.records[1].id;reloaded.elements['record-load'].click();
  assert.equal(reloaded.elements['head-x'].value,9);assert.equal(reloaded.elements['color-hue'].value,211);
  const imported=harness();await settle();
  imported.elements['record-import-text'].value=backup;imported.elements['record-import'].click();
  assert.equal(JSON.parse(imported.storage.get(presets.STORAGE_KEY)).records.length,3);
  assert.equal(imported.elements['record-list'].value,library.records[1].id,'複数JSONは調整中キャラの最新取込記録を選択');
  assert.equal(imported.elements['head-x'].value,0,'複数件では呼出前に編集中の見た目を変えない');
  imported.elements['record-load'].click();assert.equal(imported.elements['head-x'].value,9);assert.equal(imported.elements['color-hue'].value,211);
  imported.elements['record-import'].click();assert.equal(JSON.parse(imported.storage.get(presets.STORAGE_KEY)).records.length,3,'重複取込は増えない');
  const before=imported.storage.get(presets.STORAGE_KEY);
  imported.elements['record-import-text'].value='{bad json';imported.elements['record-import'].click();
  assert.match(imported.elements['record-import-message'].textContent,/読み込めません/);assert.equal(imported.storage.get(presets.STORAGE_KEY),before);
  assert.equal(imported.elements['head-x'].value,9,'読込失敗で見た目も変えない');
  const single=presets.empty();single.records=[library.records[2]];
  imported.elements['record-import-text'].value=JSON.stringify(single);imported.elements['record-import'].click();
  assert.equal(imported.elements.character.value,'karima','1件JSONは別キャラも自動表示');
  assert.equal(imported.elements['color-hue'].value,47);assert.match(imported.elements['record-import-message'].textContent,/見た目を表示/);
  assert.match(imported.elements['now-title'].textContent,/JSON.*から読み込んだ記録/,'JSONから読んだ見た目だと分かる');
  assert.match(imported.elements['record-list'].children.find(o=>o.value===library.records[2].id).textContent,/JSONから/,'読み込んだ記録は一覧で印');
  assert.equal(JSON.parse(imported.storage.get(presets.STORAGE_KEY)).records.length,3,'表示で履歴やJSONを増やさない');
  imported.elements['record-import-text'].value=JSON.stringify(presets.empty());imported.elements['record-import'].click();
  assert.equal(imported.elements.character.value,'karima');assert.match(imported.elements['record-import-message'].textContent,/0件/);
  el.save.click();const workspaceBackup=el['export-json'].value;
  imported.elements['record-import-text'].value=workspaceBackup;imported.elements['record-import'].click();
  assert.equal(imported.elements['head-x'].value,7,'作業JSONの調整復元');
  assert.match(imported.elements['now-title'].textContent,/作業全体JSON/,'作業全体JSONから戻した値だと分かる');
  assert.equal(imported.elements['color-hue'].value,211,'作業JSONの配色復元');
  const broken=harness(null,new Map([[presets.STORAGE_KEY,'broken original']]));await settle();broken.elements['record-save'].click();
  assert.equal(broken.storage.get(presets.STORAGE_KEY),'broken original','壊れた保存は上書きしない');assert.equal(broken.elements['storage-recovery-text'].value,'broken original');
  const quota=harness(null,new Map(),'write');await settle();quota.elements['record-save'].click();
  assert.match(quota.elements['record-message'].textContent,/このタブのみ/);assert.equal(quota.elements['record-list'].children.length,1);
  quota.elements['record-backup'].click();assert.equal(JSON.parse(quota.elements['record-export-text'].value).records.length,1);
  const unavailable=harness(null,new Map(),'read');await settle();unavailable.elements['record-save'].click();
  assert.match(unavailable.elements['record-message'].textContent,/このタブのみ/);
  unavailable.elements['record-backup'].click();assert.equal(JSON.parse(unavailable.elements['record-export-text'].value).records.length,1);
  const fileImport=harness();await settle();
  const fileText=fs.readFileSync(path.join(__dirname,'generated/preset_import_fixture.json'),'utf8');
  fileImport.elements['record-import-file'].files=[{size:Buffer.byteLength(fileText),text:async()=>fileText}];
  await fileImport.elements['record-import-file'].handlers.change();
  assert.equal(fileImport.elements['head-x'].value,5);assert.equal(fileImport.elements['head-scale'].value,1.07);
  const failed = harness('arshe_original.png'); await settle();
  assert.equal(failed.elements.controls.disabled, true); assert.equal(failed.elements.error.hidden, false); assert.match(failed.elements.error.message.textContent, /arshe_original/);
  failed.setFailed(null); failed.elements.retry.click(); await settle();
  assert.equal(failed.elements.controls.disabled, false); assert.equal(failed.elements.error.hidden, true);
  const failedOutfit = harness('line_child_a2.png'); await settle();
  assert.equal(failedOutfit.elements.controls.disabled, true); assert.equal(failedOutfit.elements.error.hidden, false);
  failedOutfit.setFailed(null); failedOutfit.elements.retry.click(); await settle();
  assert.equal(failedOutfit.elements.controls.disabled, false);
  el['composite-png'].click(); assert.match(el.status.textContent,/頭つき/,'頭つきPNGを書き出せる');
  assert.match(el['composite-download'].download,/_with_head\.png$/);
  if (core.outfitsOfClass('戦列攻撃上級').length) {
    // 取り込んだ兵種の衣装（import_outfits.py）: 兵種を選ぶとその衣装に替わり、その兵種で記録できる
    const brave=harness(); await settle();
    brave.elements['class-id'].value='戦列攻撃上級'; brave.elements['class-id'].handlers.change();
    const first=core.outfitsOfClass('戦列攻撃上級')[0];
    assert.ok(brave.draws.some(d=>d.canvas==='fitting' && d.file===`assets/${core.bodies[first].file}`),'取り込んだ衣装を表示');
    assert.equal(brave.elements['record-save'].disabled,false);
    brave.elements['record-save'].click();
    const saved=JSON.parse(brave.storage.get(presets.STORAGE_KEY)).records[0];
    assert.equal(saved.classId,'戦列攻撃上級'); assert.equal(saved.appearance.templateId,first); assert.equal(saved.appearance.palette,null);
  }
  console.log('PASS: UI (imported class outfits, now-showing source, outfits/palette/seams, record revisions, reload/recall, JSON v5, single JSON appearance recall, multi JSON selection, deduplicated import, invalid JSON atomicity, quota fallback, corrupt storage preservation, loading error/retry).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
