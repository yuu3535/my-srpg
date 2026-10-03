'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('./corridor-model.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'corridor-reference-20261003.json'), 'utf8'));
assert.deepEqual(model.position(data, 422), { player: 422, camera: 0, heroX: 422 });
assert.deepEqual(model.position(data, 1266), { player: 1266, camera: 844, heroX: 422 });
assert.equal(model.position(data, -999).player, 40);
assert.equal(model.position(data, 99999).player, data.length - 40);
assert.equal(model.position(data, 99999).camera, data.length - 844);
assert.equal(model.walk(data, 422, 1, 0.1).player, 444);
assert.equal(model.walk(data, 422, 1, 999).player, 444);
assert.equal(model.walk(data, 422, -1, 0.1).player, 400);
assert.equal(model.walk(data, 422, 0, 0.1).player, 422);
assert.equal(model.dialogueLift(data, 117), 122);
const arch = data.layers.find(layer => layer.name === 'アーチ');
for (const camera of [0, 844, 1688]) {
  const copies = model.tiles(arch, camera, 230);
  assert.ok(copies.some(tile => tile.x <= 0 && tile.x + 230 >= 0));
  assert.ok(copies.some(tile => tile.x <= 844 && tile.x + 230 >= 844));
  assert.equal(copies[1].x - copies[0].x, 191);
}
assert.deepEqual(model.tiles({ x: 20, speed: 0.5, repeat: false }, 40, 100), [{ x: 0, mirrored: false }]);
assert.equal(model.tiles({ ...arch, mirror: true }, 0, 230)[1].mirrored, true);
assert.deepEqual(data.layers.map(layer => layer.speed), [0.03, 0.15, 0.45, 1, 1]);
const settings = require('./dialogue-settings.js');
assert.deepEqual(settings.parse(settings.serialize(settings.corridorTrial)), settings.corridorTrial);
assert.notEqual(settings.corridorStorageKey, settings.storageKey);
assert.equal(settings.defaults.transparency, 4);
// 最新modulesの正本と実画像寸法を使う。旧5層のテストも残し互換性を固定する。
const current = JSON.parse(fs.readFileSync(path.join(__dirname, '../../unity-prototype/Assets/Data/Corridors/orcus_castle.json'), 'utf8'));
const sourceBefore = JSON.stringify(current);
const imageSizes = new Map(model.files(current).map(file => {
  const png = fs.readFileSync(path.join(__dirname, '../../unity-prototype/Assets/Art/Corridor', file));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  return [file, { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }];
}));
const structure = current.layers.find(layer => layer.kind === 'modules');
const layout = model.modules(structure, file => imageSizes.get(file));
assert.equal(layout.items.length, 6);
assert.equal(imageSizes.size, 7); // アーチ4枚を1度だけ読み込む。
assert.equal(layout.items.filter(item => item.front).length, 2);
const first = layout.items[0], end = layout.items[5];
const leftWidth = 1306 * 391 / 1205, archWidth = 1305 * 391 / 1205;
assert.equal(first.left, 20 - leftWidth * .03 / 2);
assert.equal(first.top, 390 - 391 * 1.03 - 7);
assert.equal(first.shadeTop, 60);
assert.ok(Math.abs(layout.items[1].left - (leftWidth - 41)) < 1e-9);
assert.ok(Math.abs(layout.length - (leftWidth * 2 + archWidth * 4 - 197)) < 1e-9);
assert.equal(end.top, -11);
assert.equal(end.shadeTop, 60);
// 大きさと左右の調整は後続の並び・長さを変えない。
const shifted = model.modules({ ...structure, modules: structure.modules.map(mod => ({ ...mod, dx: 80, scale: 1.8 })) }, file => imageSizes.get(file));
assert.equal(shifted.length, layout.length);
assert.throws(() => model.modules(structure, () => null), /寸法/);
assert.deepEqual(model.modules({ ...structure, modules: [] }, () => null), { items: [], length: 844 });
const resolved = { ...current, length: layout.length };
assert.equal(model.position(resolved, -999).player, 150);
assert.equal(model.position(resolved, -999).camera, 60);
assert.equal(model.position(resolved, 99999).player, layout.length - 150);
assert.equal(model.position(resolved, 99999).camera, layout.length - 844 - 60);
assert.equal(model.position(resolved, layout.length / 2).heroX, 422);
assert.equal(model.walk(resolved, 150, -1, 0.1).player, 150);
assert.equal(model.walk(resolved, layout.length - 150, 1, 0.1).player, layout.length - 150);
assert.equal(model.position({ ...resolved, walkMax: 800 }, 99999).player, 800);
assert.equal(model.position({ length: 844, cameraMargin: 60 }, 422).camera, 60);
assert.equal(JSON.stringify(current), sourceBefore);
console.log('corridor-model: all tests passed');
