const assert = require('node:assert/strict');
const engine = require('./material-engine.js');
const clip = value => Math.max(0, Math.min(1, value));
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
// SVGフィルタの1画素評価。描画は検証しないが、アルファと素材間の独立性を確認する。
function pixel(xml, source) {
  const results = { SourceGraphic: source };
  let previous = source;
  for (const m of xml.matchAll(/<fe(ColorMatrix|Composite)\b[^>]*\/>|<feComponentTransfer\b[^>]*>[\s\S]*?<\/feComponentTransfer>/g)) {
    const tag = m[0], a = attributes(tag.split('>')[0]), input = results[a.in] || previous;
    let out;
    if (tag.startsWith('<feColorMatrix')) {
      const matrix = a.values.split(/\s+/).map(Number);
      out = [0,1,2,3].map(row => clip(input.reduce((sum, value, col) => sum + value * matrix[row * 5 + col], matrix[row * 5 + 4])));
    } else if (tag.startsWith('<feComponentTransfer')) {
      out = [...input];
      for (const fn of tag.matchAll(/<feFunc([RGBA])\b[^>]*\/>/g)) {
        const f = attributes(fn[0]), index = 'RGBA'.indexOf(fn[1]), value = input[index];
        if (f.type === 'gamma') out[index] = clip(Number(f.amplitude) * value ** Number(f.exponent) + Number(f.offset));
        if (f.type === 'table') {
          const table = f.tableValues.split(/\s+/).map(Number), t = value * (table.length - 1), lo = Math.floor(t), hi = Math.min(table.length - 1, lo + 1);
          out[index] = table[lo] + (table[hi] - table[lo]) * (t - lo);
        }
      }
    } else {
      const other = results[a.in2];
      if (a.operator === 'in') out = [input[0], input[1], input[2], input[3] * other[3]];
      else {
        const premult = color => color.map((v, i) => i === 3 ? v : v * color[3]);
        const x = premult(input), y = premult(other);
        const p = x.map((v, i) => clip(Number(a.k1) * v * y[i] + Number(a.k2) * v + Number(a.k3) * y[i] + Number(a.k4)));
        out = p.map((v, i) => i === 3 ? v : p[3] ? Math.min(v, p[3]) / p[3] : 0);
      }
    }
    previous = out; if (a.result) results[a.result] = out;
  }
  return previous;
}
const paneFilter = profiles => engine.filters(profiles).match(/<filter id="solar-panes-material"[^>]*>([\s\S]*?)<\/filter>/)[1];
const frameFilter = profiles => engine.filters(profiles).match(/<filter id="solar-frame-material"[^>]*>([\s\S]*?)<\/filter>/)[1];
const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-5, a + ' != ' + b));
const neutral = [.92,.9,.87,.37], amber = [.9,.7,.3,.64], edge = [.73,.57,.28,.83];
let p = engine.normalize();
close(pixel(paneFilter(p), neutral), neutral);
close(pixel(paneFilter(p), amber), amber);
close(pixel(frameFilter(p), edge), edge);
p.white = { ...p.white, original: false, hue: 200, saturation: 55, lightness: 60 };
assert.notDeepEqual(pixel(paneFilter(p), neutral), neutral);
close(pixel(paneFilter(p), amber), amber);
close(pixel(frameFilter(p), edge), edge);
assert.equal(pixel(paneFilter(p), neutral)[3], neutral[3]);
p.ochre = { ...p.ochre, original: false, hue: 120, saturation: 40 };
assert.notDeepEqual(pixel(paneFilter(p), amber), amber);
assert.equal(pixel(paneFilter(p), amber)[3], amber[3]);
p.gold = { ...p.gold, original: false, hue: 12, gloss: 99 };
assert.notDeepEqual(pixel(frameFilter(p), edge), edge);
assert.equal(pixel(frameFilter(p), edge)[3], edge[3]);
assert.equal(pixel(paneFilter(p), [0,0,0,0])[3], 0);
const normalized = engine.normalize({ white: { hue: 999, saturation: 100, gloss: -5, lightness: NaN, original: 'false' } });
assert.equal(normalized.white.hue, 360); assert.equal(normalized.white.saturation, 80); assert.equal(normalized.white.gloss, 0);
assert.equal(normalized.white.original, true); assert.equal(normalized.white.lightness, 91);
close(engine.rgb({ hue: 0, saturation: 0, lightness: 60 }), [.6,.6,.6]);
console.log('PASS: material masks, separate color regions, original colors, preserved alpha, and input bounds');
