/* 素材マスクと純粋な画素処理の検証。目視確認とは別。 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const pixels=require('./pixel-core.js');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'assets',file))).digest('hex');
const seam=JSON.parse(fs.readFileSync(path.join(__dirname,'assets/seam_masks.json'),'utf8'));
for (const record of seam.masks) assert.equal(sha(record.file),record.sha256);
const palette=JSON.parse(fs.readFileSync(path.join(__dirname,'assets/palette_masks.json'),'utf8'));
assert.equal(sha(palette.source),palette.source_sha256); assert.equal(sha(palette.file),palette.sha256);
assert.deepEqual(palette.groups.map(g=>g.id),pixels.groups.map(g=>g.id));
const source=new Uint8ClampedArray([122,133,144,254, 81,72,67,255, 34,19,39,200, 178,96,88,0]);
const keep=new Uint8ClampedArray([255,255,255,255, 0,0,0,255, 255,255,255,255, 255,255,255,255]);
const masked=pixels.applyKeep(source,keep);
assert.deepEqual([...masked],[122,133,144,254,81,72,67,0,34,19,39,200,178,96,88,0]);
assert.equal(source[7],255);
const labels=new Uint8ClampedArray([1,1,1,255, 4,4,4,255, 0,0,0,255, 0,0,0,255]);
const config=pixels.paletteDefaults();
assert.deepEqual(pixels.recolor(source,labels,config),source,'未操作は全画素不変');
config.cloth_tunic={enabled:true,hue:160,saturation:65,lightness:-15};
const result=pixels.recolor(source,labels,config);
assert.notDeepEqual([...result.slice(0,3)],[...source.slice(0,3)]);
assert.deepEqual([...result.slice(4)],[...source.slice(4)],'別パーツ・保護領域不変');
assert.equal(result[3],source[3],'alpha保持');
for (const hue of [0,60,120,180,240,300,359]) for (const saturation of [0,40,100]) for (const lightness of [-45,0,45]) {
  for (const group of pixels.groups) config[group.id]={enabled:true,hue,saturation,lightness};
  const changed=pixels.recolor(source,labels,config);
  for (let i=3;i<source.length;i+=4) assert.equal(changed[i],source[i]);
  assert.deepEqual([...changed.slice(8)],[...source.slice(8)]);
}
assert.deepEqual(pixels.hslRgb(0,100,.5).map(Math.round),[255,0,0]);
assert.deepEqual(pixels.hslRgb(120,100,.5).map(Math.round),[0,255,0]);
assert.deepEqual(pixels.hslRgb(240,100,.5).map(Math.round),[0,0,255]);
assert.throws(()=>pixels.applyKeep(source,new Uint8ClampedArray(4)));
assert.throws(()=>pixels.recolor(source,labels,{}));
assert.equal(pixels.maskView(source,labels,1)[3],254);
console.log('PASS: mask hashes, 63 palette extremes, alpha/protected/source preservation, original reset, material independence.');
