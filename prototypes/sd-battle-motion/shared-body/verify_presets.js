'use strict';
const assert=require('node:assert/strict');
const presets=require('./preset-core.js');
const pixels=require('./pixel-core.js');
const {ABILITY_DATA}=require('../../../abilityData.js');
assert.deepEqual(presets.classIds,Object.keys(ABILITY_DATA.classLines),'兵種IDは本編のデータと一致');
function record(id='test-1',characterId='young_arshe',templateId='lineA1') {
  return {id,revision:1,savedAt:'2026-10-06T01:20:30.000Z',characterId,classId:'戦列下級',bodyType:'child',name:'首合わせ確認',
    appearance:{templateId,head:{scale:1.04,x:2,y:-3},palette:templateId==='lineA1' ? pixels.paletteDefaults() : null,seam:true},
    editor:{reference:{scale:1.1,x:-110,y:30},view:{overlay:true,silhouette:false,opacity:.4,mirror:false,guides:false}}};
}
let library=presets.append(presets.empty(),record());
library=presets.append(library,record('test-2','young_arshe','lineA2'));
library=presets.append(library,record('test-3','young_karima'));
assert.deepEqual(library.records.map(r=>r.revision),[1,2,1]);
assert.equal(presets.latest(library,'young_arshe','戦列下級','child').appearance.templateId,'lineA2');
assert.equal(presets.latest(library,'young_karima','戦列下級','child').id,'test-3');
assert.equal(presets.latest(library,'young_arshe','術下級','child'),null);
assert.equal(presets.latest(library,'young_arshe','戦列下級','standard'),null);
assert.equal(library.records[0].appearance.templateId,'lineA1','旧履歴不変');
assert.deepEqual(presets.parse(JSON.stringify(library)),library);
assert.deepEqual(presets.merge(library,library),library);
const other=presets.append(presets.empty(),record('other-1'));
const merged=presets.merge(library,other);
assert.equal(merged.records[3].revision,3);assert.deepEqual(presets.merge(merged,other),merged,'衝突履歴の再読込も重複しない');
const conflicting=presets.copy(other);conflicting.records[0].appearance.head.x=10;
assert.throws(()=>presets.merge(merged,conflicting),/内容が異なります/);
const recipe=presets.recipe(library.records[0]);assert.equal(recipe.head.file,'arshe_extracted_head.png');assert.equal(recipe.body.file,'line_child_a1.png');assert.equal(recipe.motion,null);assert.equal(recipe.weapon,null);
recipe.adjustment.x=12;assert.equal(library.records[0].appearance.head.x,2,'返り値はコピー');
const invalid=[
  r=>{r.characterId='arshe';},r=>{r.classId='術下級';},r=>{r.bodyType='standard';},r=>{r.appearance.templateId='../../image.png';},
  r=>{r.appearance.head.x=19;},r=>{r.appearance.head.scale=0;},r=>{r.appearance.palette.armor.hue=360;},
  r=>{r.appearance.palette.leather.enabled='true';},r=>{r.editor.view.opacity=2;},r=>{r.editor.reference.x=121;},r=>{r.savedAt='invalid';},r=>{r.id='__proto__';},r=>{r.revision=1.1;}
];
for (const change of invalid) {const r=record();change(r);assert.throws(()=>presets.validateRecord(r));}
for (const templateId of ['__proto__','constructor','toString']) {
  const r=record();r.appearance.templateId=templateId;delete r.classId;delete r.bodyType;
  assert.throws(()=>presets.validateRecord(r),'継承プロパティは素材IDに使えない');
}
assert.throws(()=>presets.parse('null'));assert.throws(()=>presets.parse('{bad'));assert.throws(()=>presets.parse('x'.repeat(2*1024*1024+1)));
assert.throws(()=>presets.validateLibrary({...library,version:99}));assert.throws(()=>presets.validateLibrary({...library,records:[library.records[0],library.records[0]]}));
const legacy={version:4,selectedBody:'lineA1',selectedCharacter:'arshe',adjustments:{lineA1:{arshe:{scale:1.1,x:6,y:-5}}},referenceAdjustments:{lineA1:{arshe:{scale:1,x:30,y:0}}},referenceView:{overlay:true,silhouette:true,opacity:.3},palette:{characters:{arshe:pixels.paletteDefaults()}},seamView:{enabled:false}};
const imported=presets.parse(JSON.stringify(legacy),{id:'legacy-test',savedAt:'2026-10-06T01:00:00Z'});
assert.equal(imported.records[0].appearance.head.x,6);assert.equal(imported.records[0].appearance.seam,false);
const workspace=presets.workspace(legacy);assert.equal(workspace.adjustments.lineA1.arshe.x,6);assert.equal(workspace.adjustments.lineA2.arshe.x,0);assert.equal(workspace.references.lineA1.arshe.x,30);
const v3={...legacy,version:3,palette:undefined,seamView:undefined};
const importedV3=presets.parse(JSON.stringify(v3),{id:'legacy-v3',savedAt:'2026-10-06T01:00:00Z'});
assert.equal(importedV3.records[0].appearance.seam,true);assert.deepEqual(importedV3.records[0].appearance.palette,pixels.paletteDefaults());
assert.equal(presets.workspace(v3).adjustments.lineA1.arshe.x,6);
assert.throws(()=>presets.workspace({...legacy,selectedBody:'__proto__'}));
assert.equal(presets.workspace(library),null);
const v5={...legacy,version:5,presetLibrary:library};assert.deepEqual(presets.parse(JSON.stringify(v5)),library);
console.log('PASS: character/class/body identity, history/latest/merge, import versions 3-5, runtime recipe, invalid data/path/ranges and class catalog.');
