// 素材は変更せず、透過検査と比較用画像だけを作る。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/jade-/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const files = ['preparation-icon-v01.png', 'wallet-icon-v01.png', 'renown-icon-v01.png', 'fortune-icon-v01.png'];
const matched = path.join(__dirname, 'ouroboros-style-match-v01.png');
const ouroboros = path.resolve(__dirname, '../ウロボロス_清書01/ouroboros-approved.png');
const expected = '080061ad217ae608c31f52bfa9dffaa28d7a6252cd4393f09e6d56649f4f6988';
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main() {
  const assets = [...files.map(file => path.join(__dirname, file)), matched];
  const before = assets.map(digest);
  const report = [];
  for (const file of assets) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0, opaque = 0, edgeNonzero = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * info.channels + 3];
      if (a === 0) transparent++;
      if (a === 255) opaque++;
      if ((x < 8 || y < 8 || x >= info.width - 8 || y >= info.height - 8) && a > 0) edgeNonzero++;
    }
    if (!transparent || !opaque) throw new Error('透過または不透明領域がありません: ' + file);
    report.push({ file: path.basename(file), width: info.width, height: info.height, transparent, opaque, edgeNonzero, sha256: digest(file) });
  }
  if (digest(ouroboros) !== expected) throw new Error('採用ウロボロスのハッシュが変化しています');
  const inputs = [...assets.slice(0, 4), ouroboros, matched];
  const panels = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < inputs.length; col++) {
    const background = row ? '#e5e8eb' : '#202a30';
    const icon = await sharp(inputs[col]).resize(224, 224, { fit: 'contain' }).png().toBuffer();
    const small = await sharp(inputs[col]).resize(64, 64, { fit: 'contain' }).png().toBuffer();
    const panel = await sharp({ create: { width: 260, height: 324, channels: 4, background } }).composite([
      { input: icon, left: 18, top: 10 }, { input: small, left: 98, top: 248 }
    ]).png().toBuffer();
    panels.push({ input: panel, left: col * 260, top: row * 324 });
  }
  await sharp({ create: { width: inputs.length * 260, height: 648, channels: 4, background: '#202a30' } }).composite(panels).png().toFile(path.join(__dirname, 'proof-style-match-v01.png'));
  if (assets.some((file, i) => digest(file) !== before[i])) throw new Error('QAで素材が変更されました');
  // 確認ページの相対ファイル参照とJavaScriptの構文を検査。
  const html = fs.readFileSync(path.join(__dirname, 'icons-preview.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (!fs.existsSync(path.resolve(__dirname, decodeURIComponent(match[1])))) throw new Error('参照がありません: ' + match[1]);
  }
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new Function(script);
  // ブラウザ全体の代替ではなく、比較切り替えのイベントだけを単体検証。
  const nodes = Object.fromEntries(['ouroborosVersion', 'ouroborosImage', 'ouroborosDownload', 'ouroborosHeading', 'ouroborosSizes'].map(id => {
    if (!html.includes('id="' + id + '"')) throw new Error('操作対象IDがありません: ' + id);
    return [id, { dataset: {}, addEventListener(type, handler) { this.handler = handler; } }];
  }));
  const smalls = [{}, {}, {}];
  const documentStub = { getElementById: id => nodes[id], querySelectorAll: () => smalls };
  const switchScript = script.slice(script.indexOf("document.getElementById('ouroborosVersion')"), script.indexOf("document.querySelectorAll('img')"));
  new Function('document', switchScript)(documentStub);
  for (const value of ['original', 'matched']) {
    nodes.ouroborosVersion.handler({ target: { value } });
    const src = value === 'original' ? '../ウロボロス_清書01/ouroboros-approved.png' : 'ouroboros-style-match-v01.png';
    if (nodes.ouroborosImage.src !== src || nodes.ouroborosDownload.href !== src || smalls.some(img => img.src !== src)) throw new Error('表示と保存先が連動していません');
  }
  console.log(JSON.stringify({ assets: report, ouroborosUnchanged: true, htmlReferencesAndSyntax: true, versionSwitchUnitTest: true }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
