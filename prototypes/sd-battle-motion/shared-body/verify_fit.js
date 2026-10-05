/* Nodeで直接実行。頭の調整が共通身体を変形しないことを検証する。 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./fit-core.js');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
let cases = 0;
const assets = [...Object.values(core.bodies), ...Object.values(core.heads), core.sword, ...Object.values(core.originals)];
for (const asset of assets) {
  const bytes = fs.readFileSync(path.join(__dirname, 'assets', asset.file));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], asset.size);
}
for (const bodyKey of Object.keys(core.bodies)) {
  const body = core.bodies[bodyKey];
  const baseline = core.fit(bodyKey, 'arshe', core.defaults(), [140, 370]);
  for (const headKey of Object.keys(core.heads)) {
    const head = core.heads[headKey];
    for (const scale of [.8, 1, 1.2]) for (const x of [-18, 0, 18]) for (const y of [-12, 0, 12]) for (const zoom of [.2, 1, 2]) {
      const fit = core.fit(bodyKey, headKey, { scale, x, y }, [140, 370], zoom);
      const base = core.fit(bodyKey, 'arshe', core.defaults(), [140, 370], zoom);
      assert.deepEqual(fit.body, base.body);
      assert.deepEqual(fit.grip, base.grip);
      assert.deepEqual(fit.sword, base.sword);
      close(fit.body.position[0] + body.foot[0] * fit.body.scale, 140);
      close(fit.body.position[1] + body.foot[1] * fit.body.scale, 370);
      close(fit.head.position[0] + head.join[0] * fit.head.scale, fit.neck[0] + x * zoom);
      close(fit.head.position[1] + head.join[1] * fit.head.scale, fit.neck[1] + y * zoom);
      close(head.size[1] * fit.head.scale, body.height / (body.ratio - 1) * scale * zoom);
      for (const layer of [fit.body, fit.head]) assert.ok([...layer.position, layer.scale].every(Number.isFinite));
      if (zoom === 1) {
        assert.ok(fit.head.position[1] >= 0, '最大頭サイズも拡大ステージ上端を超えない');
        assert.ok(fit.head.position[0] >= 0, '頭が隣のセルへ出ない');
        assert.ok(fit.head.position[0] + head.size[0] * fit.head.scale <= 280, '頭が隣のセルへ出ない');
      }
      cases++;
    }
    assert.deepEqual(core.fit(bodyKey, headKey).body, core.fit(bodyKey, 'arshe').body);
  }
  assert.ok(baseline.body.scale > 0);
  if (body.visibleHeight) close(baseline.body.scale * body.visibleHeight, body.height);
}
assert.throws(() => core.fit('missing', 'arshe'));
assert.throws(() => core.fit('child', 'arshe', { scale: NaN }));
assert.throws(() => core.fit('child', 'arshe', { scale: 0 }));
assert.throws(() => core.fit('child', 'arshe', {}, [0, 0], -1));
let referenceCases = 0;
for (const bodyKey of Object.keys(core.bodies)) for (const headKey of Object.keys(core.heads)) {
  const [left, top, right, bottom] = core.originals[headKey].bounds;
  const baselineHeight = core.characterHeight(bodyKey, headKey);
  const headAdjustment = { scale: 1.2, x: 18, y: -12 };
  const referenceBefore = core.referenceFit(bodyKey, headKey);
  core.fit(bodyKey, headKey, headAdjustment);
  assert.deepEqual(core.referenceFit(bodyKey, headKey), referenceBefore, '頭調整が元SDの基準を変えない');
  for (const scale of [.75, 1, 1.25]) for (const x of [-60, 0, 60]) for (const y of [-50, 0, 50]) {
    const layer = core.referenceFit(bodyKey, headKey, { scale, x, y }, [210, 460]);
    close(layer.position[0] + (left + right) / 2 * layer.scale, 210 + x);
    close(layer.position[1] + bottom * layer.scale, 460 + y);
    close((bottom - top) * layer.scale, baselineHeight * scale);
    assert.ok(layer.position[1] + top * layer.scale >= 0, '最大拡大・上移動でも上端内');
    assert.ok(layer.position[1] + bottom * layer.scale <= 520, '下移動しても下端内');
    assert.ok(layer.position[0] + left * layer.scale >= 0, '左右調整しても左セル内');
    assert.ok(layer.position[0] + right * layer.scale <= 420, '左右調整しても左セル内');
    const mini = core.referenceFit(bodyKey, headKey, { scale, x, y }, [210, 460], .2);
    close(mini.scale, layer.scale * .2);
    referenceCases++;
  }
}
assert.throws(() => core.referenceFit('child', 'arshe', { scale: NaN }));
assert.throws(() => core.referenceFit('child', 'arshe', { scale: 0 }));
assert.throws(() => core.referenceFit('missing', 'arshe'));
// コピーした原本と元ファイルが同一であることも確認する。
const project = path.resolve(__dirname, '../../..');
for (const [key, original] of [['arshe','young_arshe'], ['karima','young_karima'], ['gunter','gunter']]) {
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(hash(path.join(__dirname, 'assets', `${key}_original.png`)), hash(path.join(project, 'unity-prototype/Assets/Art/SD', `${original}.png`)));
}
const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const providedCopy = path.join(__dirname, 'assets/provided_child_body.png');
const providedSource = path.join(project, '立ち絵透過下処理/AI_SD/子供素体.png');
// 入力フォルダーはGit管理外。別環境でも受領時の内容を検証できるようハッシュを固定する。
assert.equal(hashFile(providedCopy), 'd510e13a63a47ffa01f9ba7845c3c216b5a79a2dee26b4b071657b8d2476e017');
if (fs.existsSync(providedSource)) assert.equal(hashFile(providedCopy), hashFile(providedSource));
assert.equal(core.bodies.providedChild.weaponReady, false);
for (const headKey of Object.keys(core.heads)) {
  const height = core.characterHeight('providedChild', headKey);
  const initial = core.fit('providedChild', headKey);
  close(-initial.head.position[1], height);
  assert.ok(height > core.bodies.providedChild.height, '全高は余白ではなく頭＋身体で決まる');
}
console.log(`PASS: ${cases} fitting cases, ${referenceCases} reference cases, ${assets.length} asset sizes, 4 immutable input copies`);
