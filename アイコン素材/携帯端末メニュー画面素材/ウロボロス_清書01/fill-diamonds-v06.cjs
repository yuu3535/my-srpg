"use strict";
// v05の形の変更は使わず、v04の閉じた菱形の内側だけを白で塗る。
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sharpDir = process.argv[2];
assert(sharpDir, "Sharpの絶対パスを指定する");
assert.equal(JSON.parse(fs.readFileSync(path.join(sharpDir, "package.json"))).name, "sharp");
const sharp = require(sharpDir);
const source = path.join(__dirname, "ouroboros-png-clean-v04.png");
const target = path.join(__dirname, "ouroboros-png-clean-v06.png");
const hash = () => crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex");

(async () => {
  const sourceHash = hash();
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  const mask = new Uint8Array(info.width * info.height);
  const components = [];
  // 菱形二つと、交差して見えていた中央の小さな閉領域。輪郭は原画のまま。
  for (const [label, x, y] of [["upper", 405, 205], ["lower", 267, 327]]) {
    const queue = [y * info.width + x];
    const component = new Set(queue);
    const eligible = index => {
      const i = index * 4;
      return data[i + 3] >= 245 && Math.max(data[i], data[i + 1], data[i + 2]) < 215;
    };
    assert(eligible(queue[0]), "塗りつぶし開始点は菱形の灰色の内側");
    let cursor = 0;
    for (; cursor < queue.length; cursor++) {
      const index = queue[cursor], px = index % info.width, py = Math.floor(index / info.width);
      assert(px > 190 && px < 495 && py > 160 && py < 400, label + ": 白い輪郭を越えて外の灰色へ漏れない (" + px + "," + py + ")");
      for (const next of [index - 1, index + 1, index - info.width, index + info.width]) {
        if (!component.has(next) && eligible(next)) { component.add(next); queue.push(next); }
      }
    }
    assert(queue.length < 16000, "局所的な閉領域のみ");
    for (const index of queue) mask[index] = 1;
    components.push({ label, seed: [x, y], pixels: queue.length });
  }
  // 継ぎ目の小さな灰色部分は、角の切れ目から外へ連結しているため局所マスクで埋める。
  // 白線の上に頂点を置く。既存の大きな菱形の外周は描き直さない。
  const junction = [[320, 249], [337, 245], [324, 270], [307, 273]];
  function inside(x, y) {
    let hit = false;
    for (let i = 0, j = junction.length - 1; i < junction.length; j = i++) {
      const a = junction[i], b = junction[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }
  for (let y = 245; y <= 273; y++) for (let x = 307; x <= 337; x++) if (inside(x + 0.5, y + 0.5)) mask[y * info.width + x] = 1;
  // 内側のアンチエイリアスを1pxだけ白線側へ馴染ませる。外の灰色には広げない。
  const interior = Uint8Array.from(mask);
  for (let y = 170; y < 395; y++) for (let x = 200; x < 495; x++) {
    const index = y * info.width + x, i = index * 4;
    if (!mask[index] && Math.min(data[i], data[i + 1], data[i + 2]) > 130 && data[i + 3] >= 245 &&
      [-info.width - 1, -info.width, -info.width + 1, -1, 1, info.width - 1, info.width, info.width + 1].some(offset => interior[index + offset])) mask[index] = 1;
  }
  // 元の白線から中央値を採り、塗りと輪郭の色をそろえる。
  const whites = [[], [], []];
  for (let y = 170; y < 395; y++) for (let x = 200; x < 495; x++) {
    const i = (y * info.width + x) * 4;
    if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240 && data[i + 3] >= 245)
      for (let c = 0; c < 3; c++) whites[c].push(data[i + c]);
  }
  const white = whites.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
  let changed = 0;
  for (let index = 0; index < mask.length; index++) if (mask[index]) {
    const i = index * 4;
    for (let c = 0; c < 3; c++) output[i + c] = white[c];
    if (!output.subarray(i, i + 4).equals(data.subarray(i, i + 4))) changed++;
  }
  assert(changed > 0);
  await sharp(output, { raw: info }).png().toFile(target);
  const saved = await sharp(target).ensureAlpha().raw().toBuffer();
  assert(saved.equals(output), "保存後の画素が補修バッファと一致");
  for (let index = 0; index < mask.length; index++) {
    const i = index * 4;
    assert.equal(saved[i + 3], data[i + 3], "全画素のアルファは不変");
    if (!mask[index]) assert(saved.subarray(i, i + 4).equals(data.subarray(i, i + 4)), "内側の塗り以外は完全一致");
  }
  for (const [, x, y] of [["upper", 405, 205], ["lower", 267, 327], ["junction", 321, 258]]) {
    const i = (y * info.width + x) * 4;
    assert.deepEqual([...saved.subarray(i, i + 3)], white, "各閉領域の内側が白い");
  }
  assert.equal(hash(), sourceHash, "元PNGは不変");
  const crop = { left: 190, top: 140, width: 340, height: 320 };
  const panels = [];
  for (const [index, file] of [source, target].entries()) panels.push({
    input: await sharp(file).extract(crop).flatten({ background: "#243039" }).resize(510, 480).png().toBuffer(), left: index * 522, top: 0
  });
  await sharp({ create: { width: 1032, height: 480, channels: 4, background: "#243039" } }).composite(panels).png().toFile(path.join(__dirname, "white-fill-proof-v06.png"));
  const report = { source: path.basename(source), target: path.basename(target), sourceHash, white, components, changedPixels: changed, alphaUnchanged: true, outsideFillIdentical: true, originalUnchanged: true };
  fs.writeFileSync(path.join(__dirname, "white-fill-report-v06.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
