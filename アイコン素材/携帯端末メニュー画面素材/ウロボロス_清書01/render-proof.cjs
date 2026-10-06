/* ブラウザを使用しないSVG描画・比較画像出力。任意のローカルSharpを指定。 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

async function renderProof(sharpPath) {
  if (!sharpPath) throw new Error("ローカルSharpのパッケージフォルダを引数で指定してください。");
  const packageInfo = JSON.parse(fs.readFileSync(path.join(sharpPath, "package.json"), "utf8"));
  if (packageInfo.name !== "sharp") throw new Error("Sharp以外のパッケージは使用しません。");
  const sharp = require(sharpPath);
  const svg = path.join(__dirname, "ouroboros-clean-v01.svg");
  const png = path.join(__dirname, "ouroboros-clean-v01.png");
  const reference = path.join(__dirname, "reference-approved.png");
  await sharp(svg).png().toFile(png);
  const clean = await sharp(svg).resize(768, 768).png().toBuffer();
  const source = await sharp(reference).extract({ left: 227, top: 26, width: 768, height: 768 }).png().toBuffer();
  const panels = [{ input: source, left: 0, top: 36 }, { input: clean, left: 768, top: 36 }];
  const labels = Buffer.from('<svg width="1536" height="36" xmlns="http://www.w3.org/2000/svg"><g fill="#d4dce2" font-family="sans-serif" font-size="18"><text x="24" y="25">REFERENCE</text><text x="792" y="25">SVG / v01</text></g></svg>');
  panels.push({ input: labels, left: 0, top: 0 });
  for (let i = 0; i < 4; i++) {
    const size = [32, 48, 64, 96][i];
    const small = await sharp(svg).resize(size, size).png().toBuffer();
    panels.push({ input: small, left: 844 + i * 168, top: 835 + Math.round((96 - size) / 2) });
  }
  const checker = Buffer.from('<svg width="192" height="144" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="c" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#596167"/><path d="M0 0h12v12H0z M12 12h12v12H12z" fill="#747c83"/></pattern></defs><rect width="192" height="144" fill="url(#c)"/></svg>');
  panels.push({ input: checker, left: 24, top: 816 });
  panels.push({ input: await sharp(svg).resize(128, 128).png().toBuffer(), left: 56, top: 824 });
  await sharp({ create: { width: 1536, height: 984, channels: 4, background: "#1f282d" } })
    .composite(panels).png().toFile(path.join(__dirname, "comparison-proof.png"));
  const raster = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => raster.data[(y * raster.info.width + x) * 4 + 3];
  if (alphaAt(0, 0) !== 0 || alphaAt(384, 450) !== 0) throw new Error("透明な外側・内側が必要です。");
  if (alphaAt(384, 384) !== 255) throw new Error("中央の瞳孔は塗りつぶしです。");
  console.log(`描画完了: 768×768 / 透過・中央の塗り確認 / Sharp ${packageInfo.version}`);
}
if (require.main === module) renderProof(process.argv[2]).catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { renderProof };
