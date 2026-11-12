// 回る太陽盤の部品を、Unity 用に別々の透過PNGへ書き出す（2026-11-13 総合担当）。
// 試作 アイコン素材/携帯端末メニュー画面素材/太陽盤_コマンド試作01 の export-wheel-commands.cjs と同じ素材・色フィルター・配置計算を使い、
// 合成せずに「外の輪（回る）・円盤（止まる）・光の線＝針（回る）・札（ふつう／選択）・選択の炎」を分ける。文字は Unity で描く。
// 使い方（リポジトリのルートで）:
//   node tools/export_sun_dial_layers.cjs <sharp モジュールの場所>
//   例: node tools/export_sun_dial_layers.cjs "%APPDATA%/npm/node_modules/netlify-cli/node_modules/sharp"
// 出力: unity-prototype/Assets/Resources/Menu/Dial/（PNG は 844×390 の座標の2倍の細かさ）と dial_layers.json（置き方）
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
const proto = path.resolve(__dirname, '../アイコン素材/携帯端末メニュー画面素材/太陽盤_コマンド試作01');
const math = require(path.join(proto, 'wheel-math.js'));
const colors = require(path.join(proto, '../太陽盤_試作03/character-colors.js'));
const materials = require(path.join(proto, '../太陽盤_試作03/material-engine.js'));
const burning = require(path.join(proto, 'command-burning.js'));
const materialDir = path.resolve(proto, '../太陽盤_試作03');
const outDir = path.resolve(__dirname, '../unity-prototype/Assets/Resources/Menu/Dial');
const K = 2; // 844×390 → 1688×780
const pngUrl = file => 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');

function asset(group, part, placement, palette) {
  const filtered = part === 'panes' || !palette.gold.original;
  return `<image x="${-placement.size / 2}" y="${-placement.size / 2}" width="${placement.size}" height="${placement.size}" href="${pngUrl(path.join(materialDir, group + '-' + part + '.png'))}" opacity="${part === 'panes' ? placement.opacity / 100 : 1}" ${filtered ? `filter="url(#solar-${part === 'panes' ? 'panes' : 'frame'}-material)"` : ''}/>`;
}

// 中心 (0,0) の正方形 size×size を、2倍の細かさの PNG に
async function square(name, size, body, defs) {
  const half = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * K}" height="${size * K}" viewBox="${-half} ${-half} ${size} ${size}"><defs>${defs}</defs>${body}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, name + '.png'));
}

async function main() {
  const who = 'alche', palette = colors.palette(who), placement = colors.placement(), values = math.preset(who);
  const geometry = math.geometry(values.gap, 1, values.size, values.bandHeight);
  const profile = { original: false, hue: values.hue, saturation: values.saturation, lightness: values.lightness, shading: 35, gloss: 0 };
  let defs = materials.filters(palette) + materials.filters({ white: profile, ochre: profile }).replaceAll('solar-panes-material', 'wheel-panes-material').replaceAll('solar-frame-material', 'wheel-frame-material');
  fs.mkdirSync(outDir, { recursive: true });

  // 外の輪（回る。札と一緒に phase だけ回る）
  await square('dial_ring', values.size, `<image x="${-values.size / 2}" y="${-values.size / 2}" width="${values.size}" height="${values.size}" opacity="${values.opacity / 100}" href="${pngUrl(path.join(materialDir, 'disk-panes.png'))}" filter="url(#wheel-panes-material)"/>`, defs);
  // 円盤（止まっている。中心は (−40, 195)）
  await square('dial_disk', placement.disk.size, asset('disk', 'panes', placement.disk, palette) + asset('disk', 'frame', placement.disk, palette), defs);
  // 光の線＝針（回る。中心は (0, 195)）
  await square('dial_rays', placement.rays.size, asset('rays', 'panes', placement.rays, palette) + asset('rays', 'frame', placement.rays, palette), defs);

  // 札（112×帯の高さ。左の切れ込み・裏の金の帯・内縁）。原点は札の左の辺のまん中
  const bh = geometry.bandHeight, pad = 8;
  defs += '<linearGradient id="selected" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5059"/><stop offset=".3" stop-color="#292e36"/><stop offset="1" stop-color="#292e36"/></linearGradient>';
  defs += '<mask id="backing-mask" maskUnits="userSpaceOnUse" x="-12" y="-12" width="164" height="70" style="mask-type:luminance"><rect x="-12" y="-12" width="164" height="70" fill="white"/><polygon points="1,1 139,1 139,33 1,33 21,17" fill="black" stroke="black" stroke-width="1"/></mask>';
  const polygon = '1,1 139,1 139,33 1,33 21,17';
  for (const selected of [false, true]) {
    const rule = selected ? '#d6b45e' : '#bba57c';
    const plate = `<svg x="0" y="${-bh / 2}" width="112" height="${bh}" viewBox="0 0 140 34" preserveAspectRatio="none" overflow="visible"><g mask="url(#backing-mask)"><polygon points="${polygon}" transform="translate(${selected ? '4 8' : '3 5'})" fill="${selected ? '#e1b359' : '#cba04e'}" opacity="${selected ? 1 : .9}"/></g><polygon points="${polygon}" fill="${selected ? 'url(#selected)' : '#252931'}" fill-opacity="${selected ? .84 : .74}" stroke="${rule}" stroke-width="1" vector-effect="non-scaling-stroke"/><polygon points="11,5 134,5 134,29 11,29 26,17" fill="none" stroke="${selected ? '#e7c56b' : rule}" stroke-width="${selected ? .9 : .6}" opacity="${selected ? .9 : .5}" vector-effect="non-scaling-stroke"/></svg>`;
    const w = 112 + pad * 2, h = bh + pad * 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * K}" height="${h * K}" viewBox="${-pad} ${-bh / 2 - pad} ${w} ${h}"><defs>${defs}</defs>${plate}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, selected ? 'plate_selected.png' : 'plate.png'));
  }

  // 選択の炎（燃えている途中の1コマを、アルシェの色に）
  const flameDefs = '<filter id="flame-color" color-interpolation-filters="sRGB"><feColorMatrix values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/><feComponentTransfer>' + burning.palettes.alche.channels.map((table, i) => `<feFunc${['R', 'G', 'B'][i]} type="table" tableValues="${table}"/>`).join('') + '<feFuncA type="identity"/></feComponentTransfer></filter>';
  const flame = await sharp(path.join(proto, 'fx/command-flame-selection-v01-hold.apng')).png().toBuffer();
  const fsvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${81 * K}" height="${81 * K}" viewBox="0 0 81 81"><defs>${flameDefs}</defs><image x="0" y="0" width="81" height="81" href="data:image/png;base64,${flame.toString('base64')}" filter="url(#flame-color)"/></svg>`;
  await sharp(Buffer.from(fsvg)).png().toFile(path.join(outDir, 'flame.png'));

  const layout = {
    _note: '回る太陽盤の部品の置き方（844×390 の座標。tools/export_sun_dial_layers.cjs で作る。手で直さない）',
    center: { x: 0, y: 195 },
    ring: { size: values.size },
    disk: { size: placement.disk.size, x: -40, y: 195 },
    rays: { size: placement.rays.size },
    plate: { width: 112, bandHeight: bh, pad },
    flame: { x: 112 - 12 - 81 * .57, y: 11 - 81 * .78, size: 81, opacity: .83 },
    geometry: { gap: values.gap, radius: geometry.radius, outerRadius: geometry.outerRadius, pitch: geometry.pitch, inset: geometry.inset, height: geometry.height, cardWidth: geometry.cardWidth, textPadding: geometry.textPadding, selectedScale: geometry.selectedScale, tipRadius: math.tipRadius },
  };
  fs.writeFileSync(path.join(outDir, 'dial_layers.json'), JSON.stringify(layout, null, 1) + '\n');
  console.log(JSON.stringify(layout, null, 1));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
