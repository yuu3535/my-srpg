"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { buildSvg, COLOR, CENTER, point } = require("./build-ouroboros.cjs");

const svg = fs.readFileSync(path.join(__dirname, "ouroboros-clean-v01.svg"), "utf8");
assert.equal(svg, buildSvg(), "清書SVGと生成元を一致させる");
assert.match(svg, /viewBox="0 0 768 768"/);
assert.equal((svg.match(/<circle /g) || []).length, 3, "時計の二重円と金の円");
assert.equal((svg.match(/<ellipse /g) || []).length, 2, "蛇の目は二つ");
assert.match(svg, new RegExp('id="red-pupil"[^>]+fill="' + COLOR.red + '"'));
assert.match(svg, /id="gold-ring" cx="611" cy="410" r="155" fill="none"/);
const dial = svg.match(/<g id="clock-dial"[\s\S]*?<\/g>/)[0];
assert.equal((dial.match(/<path /g) || []).length, 12, "十二の目盛り");
assert.equal((dial.match(/stroke="#e9bf80"/g) || []).length, 4, "四方だけ金");
assert(!/<(?:script|image|foreignObject|filter|linearGradient|radialGradient)\b/.test(svg), "SVG素材は単独で静止描画");
const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, "IDを重複させない");
for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) assert(ids.includes(match[1]));
assert.deepEqual(point(0, 155), [CENTER.x + 155, CENTER.y]);

const html = fs.readFileSync(path.join(__dirname, "icon-preview.html"), "utf8");
assert.equal((html.match(/src="ouroboros-approved\.png/g) || []).length, 3, "比較・小サイズ・アプリ下地で原作者の採用PNGを使う");
assert(fs.readFileSync(path.join(__dirname, "ouroboros-approved.png")).equals(fs.readFileSync(path.join(__dirname, "..", "download.png"))), "採用PNGは原作者の入力ファイルとバイト単位で同一");
for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)) {
  assert(fs.existsSync(path.join(__dirname, match[1])), "ローカル参照: " + match[1]);
}

function control(value = "") {
  return { value, hidden: true, listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; } };
}
const elements = {
  background: control("dark"), "icon-size": control("64"), "size-value": control(),
  "small-icon": control(), "tile-icon": control(), "asset-error": control()
};
const images = [control(), control(), control()];
const body = { dataset: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "icon-preview.js"), "utf8"), {
  document: { body, getElementById: (id) => elements[id], querySelectorAll: () => images }
});
assert.equal(elements["small-icon"].width, 64);
assert.equal(elements["tile-icon"].height, 64);
elements["icon-size"].value = "96";
elements["icon-size"].listeners.input();
assert.equal(elements["tile-icon"].width, 96);
assert.equal(elements["size-value"].textContent, "96px");
elements.background.value = "checker";
elements.background.listeners.change();
assert.equal(body.dataset.background, "checker");
images[0].listeners.error();
assert.equal(elements["asset-error"].hidden, false);
console.log("ウロボロス清書: SVG構造・生成再現性・参照・背景/サイズ/エラー連動 OK");
