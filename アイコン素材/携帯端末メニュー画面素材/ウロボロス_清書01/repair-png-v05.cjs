"use strict";
// 原作者の許可を得た局所的なPNG補修。画像生成・SVG化は行わない。
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sharpDir = process.argv[2];
assert(sharpDir, "Sharpの絶対パスを指定する");
assert.equal(JSON.parse(fs.readFileSync(path.join(sharpDir, "package.json"))).name, "sharp");
const sharp = require(sharpDir);
const source = path.join(__dirname, "ouroboros-png-clean-v04.png");
const target = path.join(__dirname, "ouroboros-png-clean-v05.png");
const hash = () => crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex");

function distance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

function inside(x, y, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
// 折れ線の接合は丸ではなくマイター。菱形の角を尖ったまま閉じる。
function strokePolygon(points, halfWidth) {
  const normals = points.slice(1).map((p, i) => {
    const dx = p[0] - points[i][0], dy = p[1] - points[i][1], length = Math.hypot(dx, dy);
    return [-dy / length, dx / length];
  });
  const side = sign => points.map((p, i) => {
    if (i === 0 || i === points.length - 1) {
      const n = normals[i === 0 ? 0 : normals.length - 1];
      return [p[0] + sign * halfWidth * n[0], p[1] + sign * halfWidth * n[1]];
    }
    const n1 = normals[i - 1], n2 = normals[i];
    const mx = n1[0] + n2[0], my = n1[1] + n2[1];
    const scale = halfWidth / (mx * n1[0] + my * n1[1]);
    return [p[0] + sign * mx * scale, p[1] + sign * my * scale];
  });
  return [...side(1), ...side(-1).reverse()];
}

(async () => {
  const sourceHash = hash();
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  // 上左の灰色帯内だけ。二つの菱形を少し離し、継ぎ目の交差をなくす。
  const region = { left: 285, top: 214, width: 85, height: 86 };
  const branches = [ [[359.5, 210], [341.5, 230], [333, 249], [350, 247.5], [380, 240.8]], [[275, 280], [293, 271.5], [310, 266], [313, 280], [306, 299]] ];
  const outlines = branches.map(p => strokePolygon(p, 4.1));
  const samples = [];
  for (let y = 205; y < 310; y++) for (let x = 275; x < 380; x++) {
    const i = (y * info.width + x) * 4;
    if (data[i] > 45 && data[i] < 100 && data[i + 1] < 110 && data[i + 2] < 125 && data[i + 3] >= 250)
      samples.push([x, y, ...data.subarray(i, i + 3)]);
  }
  // 周囲の灰色から一次平面を当て、元の線の暗い縁も残さず補完する。
  const cleanSamples = samples.filter(s => distance(s[0], s[1], [360, 209], [304, 296]) > 11 && distance(s[0], s[1], [275, 280], [377, 241]) > 11);
  const coefficients = [0, 1, 2].map(channel => {
    const matrix = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
    for (const s of cleanSamples) {
      const v = [1, s[0] - 324, s[1] - 257];
      for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) matrix[r][c] += v[r] * v[c]; matrix[r][3] += v[r] * s[channel + 2]; }
    }
    for (let p = 0; p < 3; p++) {
      const divisor = matrix[p][p]; assert(Math.abs(divisor) > 1e-6);
      for (let c = p; c < 4; c++) matrix[p][c] /= divisor;
      for (let r = 0; r < 3; r++) if (r !== p) { const factor = matrix[r][p]; for (let c = p; c < 4; c++) matrix[r][c] -= factor * matrix[p][c]; }
    }
    return matrix.map(row => row[3]);
  });
  const background = (x, y) => coefficients.map(c => c[0] + c[1] * (x - 324) + c[2] * (y - 257));
  let changed = 0;
  for (let y = region.top; y < region.top + region.height; y++) for (let x = region.left; x < region.left + region.width; x++) {
    const i = (y * info.width + x) * 4;
    // 実際の補修マスクは継ぎ目を中心とする楕円。外周8pxで元の線に接続する。
    const radius = Math.hypot((x - 324) / 38, (y - 257) / 36);
    const blend = Math.max(0, Math.min(1, (1 - radius) * 4.5));
    if (!blend || data[i + 3] < 250) continue;
    let coverage = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const px = x + (sx + 0.5) / 4, py = y + (sy + 0.5) / 4;
      if (outlines.some(p => inside(px, py, p))) coverage += 1 / 16;
    }
    const bg = background(x, y);
    // 白線以外の画素も、接続部分以外は元の色を使う。灰色帯の明暗を保持。
    for (let c = 0; c < 3; c++) {
      const repaired = bg[c] * (1 - coverage) + [246, 248, 249][c] * coverage;
      output[i + c] = Math.round(data[i + c] * (1 - blend) + repaired * blend);
    }
    if (!output.subarray(i, i + 4).equals(data.subarray(i, i + 4))) changed++;
  }
  assert(changed > 0, "補修した画素が存在する");
  await sharp(output, { raw: info }).png().toFile(target);
  const saved = await sharp(target).ensureAlpha().raw().toBuffer();
  assert(saved.equals(output), "保存後のRGBAは補修バッファと同一");
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    assert.equal(saved[i + 3], data[i + 3], "全画素のアルファを保持");
    if (Math.hypot((x - 324) / 38, (y - 257) / 36) >= 1)
      assert(saved.subarray(i, i + 4).equals(data.subarray(i, i + 4)), "補修マスク外は完全一致");
  }
  assert.equal(hash(), sourceHash, "元PNGを変更しない");
  const crop = { left: 275, top: 205, width: 110, height: 110 };
  const panels = [];
  for (const [index, file] of [source, target].entries()) {
    panels.push({ input: await sharp(file).extract(crop).flatten({ background: "#243039" }).resize(440, 440).png().toBuffer(), left: index * 452, top: 0 });
  }
  await sharp({ create: { width: 892, height: 440, channels: 4, background: "#243039" } }).composite(panels).png().toFile(path.join(__dirname, "manual-repair-proof.png"));
  const report = { source: path.basename(source), output: path.basename(target), sourceHash, region, changedPixels: changed, alphaUnchanged: true, outsideMaskIdentical: true, originalUnchanged: true };
  fs.writeFileSync(path.join(__dirname, "manual-repair-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
