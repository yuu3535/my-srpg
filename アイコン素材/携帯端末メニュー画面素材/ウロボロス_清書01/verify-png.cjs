"use strict";
// 元PNGは変更せず、透過の検証と背景・サイズの確認画像だけを作る。
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const sharpDir = process.argv[2];
assert(sharpDir, "使用するSharpの絶対パスを指定する");
assert.equal(JSON.parse(fs.readFileSync(path.join(sharpDir, "package.json"))).name, "sharp");
const sharp = require(sharpDir);
const assetName = process.argv[3] || "ouroboros-png-clean-v01.png";
assert.match(assetName, /^ouroboros-png-clean-v\d{2}\.png$/, "同じフォルダの清書PNGを指定する");
const source = path.join(__dirname, assetName);
const version = assetName.match(/v\d{2}/)[0];
(async () => {
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.hasAlpha, true);
  assert.equal(metadata.width, metadata.height);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
  const cornerAlphas = [];
  for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) {
    cornerAlphas.push(pixel(x, y)[3]);
    // 画像生成の1/255の量子化残りは記録し、可視の背景残りは失敗にする。
    assert(pixel(x, y)[3] <= 1, "四隅は透過、許容する量子化残りは最大1/255");
  }
  if (cornerAlphas.some((alpha) => alpha !== 0)) console.warn("注意：四隅に最大1/255のアルファが残る。完全なalpha=0ではない。素材は変更しない。");
  assert.equal(pixel(Math.round(info.width * 0.4), Math.round(info.height * 0.5))[3], 0, "瞳孔の横は透過");
  const center = pixel(Math.floor(info.width / 2), Math.floor(info.height / 2));
  assert(center[0] > center[1] * 2 && center[3] > 240, "瞳孔の中まで赤い塗り");
  const checker = Buffer.from('<svg width="480" height="480" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="c" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#cccccc"/><path d="M0 0h16v16H0zM16 16h16v16H16z" fill="#eeeeee"/></pattern></defs><rect width="480" height="480" fill="url(#c)"/></svg>');
  const icon = await sharp(source).resize(480, 480).png().toBuffer();
  const panels = [];
  for (const [index, background] of ["#243039", "#f3f3f0", null].entries()) {
    const base = background ? sharp({ create: { width: 480, height: 480, channels: 4, background } }) : sharp(checker);
    panels.push({ input: await base.composite([{ input: icon }]).png().toBuffer(), left: index * 480, top: 0 });
  }
  for (const [index, size] of [32, 48, 64, 96, 128].entries()) {
    panels.push({ input: await sharp(source).resize(size, size).png().toBuffer(), left: 90 + index * 270, top: 530 + Math.round((128 - size) / 2) });
  }
  await sharp({ create: { width: 1440, height: 700, channels: 4, background: "#243039" } }).composite(panels).png().toFile(path.join(__dirname, "png-comparison-proof-" + version + ".png"));
  console.log(JSON.stringify({ asset: path.basename(source), width: metadata.width, height: metadata.height, alpha: true, cornerAlphas, strictTransparentCorners: cornerAlphas.every((alpha) => alpha === 0), center, result: "表示上の透過と中央赤塗り OK。背景3種・32/48/64/96/128pxの確認画像を作成" }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
