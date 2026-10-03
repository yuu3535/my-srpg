// 既存の素材・SVG色フィルターを、背景なしでPNGへ書き出す。
// ブラウザー操作や画像の再生成は行わない。元素材・試作画面を変更しない。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require(process.argv[2] || 'sharp');
const materialDir = path.resolve(__dirname, '../太陽盤_試作03');
const materials = require(path.join(materialDir, 'material-engine.js'));
const colors = require(path.join(materialDir, 'character-colors.js'));
const outputDir = path.resolve(__dirname, '../太陽盤_配置たたき台用');

function image(group, part, placement, palette) {
  const data = fs.readFileSync(path.join(materialDir, `${group}-${part}.png`)).toString('base64');
  const filter = part === 'panes' ? 'solar-panes-material' : 'solar-frame-material';
  const useFilter = part === 'panes' || !palette.gold.original;
  return `<image x="${-placement.size / 2}" y="${-placement.size / 2}" width="${placement.size}" height="${placement.size}" href="data:image/png;base64,${data}" opacity="${part === 'panes' ? placement.opacity / 100 : 1}" ${useFilter ? `filter="url(#${filter})"` : ''}/>`;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, label] of [['alche', 'アルシェ'], ['karima', 'カリマ']]) {
    const palette = colors.palette(name), placement = colors.placement();
    const groups = ['disk', 'rays'].map(group => {
      const p = placement[group];
      return `<g transform="translate(${p.x} ${p.y}) rotate(${p.angle})">${image(group, 'panes', p, palette)}${image(group, 'frame', p, palette)}</g>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1688" height="780" viewBox="0 0 844 390"><defs>${materials.filters(palette)}</defs>${groups}</svg>`;
    const destination = path.join(outputDir, `太陽盤のみ_${label}_1688x780.png`);
    // 上書きしない。既存のたたき台がある場合は停止する。
    assert(!fs.existsSync(destination), `既存ファイルを保護しました: ${destination}`);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1688); assert.equal(info.height, 780);
    let transparent = 0, translucent = 0, opaque = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (x >= 450) assert.equal(alpha, 0, '太陽盤以外の領域は完全透過');
      if (alpha === 0) transparent++; else if (alpha === 255) opaque++; else translucent++;
    }
    assert(transparent > 1000000 && translucent > 1000 && opaque > 1000);
    fs.writeFileSync(destination, png, { flag: 'wx' });
    console.log(JSON.stringify({ destination, width: info.width, height: info.height, transparent, translucent, opaque }));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
