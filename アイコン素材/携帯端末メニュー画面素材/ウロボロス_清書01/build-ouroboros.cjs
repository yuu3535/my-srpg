/* 採用見本の形をSVGへ清書。座標は見本の大きい紋章を基準にする。 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const COLOR = Object.freeze({
  silver: "#eef0ee", gray: "#5a6673", edge: "#b8c0c8",
  gold: "#e9bf80", red: "#a5243d", darkRed: "#6c1d34"
});
const CENTER = Object.freeze({ x: 611, y: 410 });
const BODY = "M 371 292 C 426 165 545 86 650 100 C 812 116 928 245 943 383 C 948 415 944 437 928 451 L 913 461 C 934 446 937 431 926 412 L 860 395 C 847 348 835 316 812 285 C 767 218 697 183 623 174 C 519 156 433 199 383 290 Z";
const SHOULDER = "M 371 292 C 408 207 474 145 552 116 C 572 126 594 137 616 147 C 515 143 433 199 383 290 Z";
const HEAD_LIGHT = "M 371 288 C 383 279 388 301 379 326 L 364 359 C 365 379 352 395 337 402 L 334 384 C 345 378 350 373 339 369 C 322 366 299 391 288 426 C 285 394 294 363 318 337 C 335 318 352 301 371 288 Z";
const HEAD_SHADOW = "M 910 437 C 888 444 877 461 870 480 C 861 498 857 526 862 546 C 864 558 875 553 891 542 C 927 517 958 477 962 419 C 956 439 939 452 916 458 C 903 462 900 457 911 453 Z";
const BODY_SHADOW = "M 862 546 C 810 652 713 724 620 735 C 461 752 333 638 308 507 C 301 468 300 429 314 400 L 329 384 C 330 422 350 454 389 474 C 402 563 502 662 616 663 C 718 667 806 614 862 546 Z";
const SHOULDER_SHADOW = "M 862 546 C 814 646 743 703 655 728 L 622 695 C 719 677 804 614 862 546 Z";

function point(angle, radius) {
  const rad = angle * Math.PI / 180;
  return [CENTER.x + Math.cos(rad) * radius, CENTER.y + Math.sin(rad) * radius];
}
function number(value) { return Number(value.toFixed(3)); }
function coords(values) { return values.map(number).join(" "); }

// 同じ角度幅の菱形を円周へ配置。白側は穴、灰側は銀の閉じた線。
function diamond(angle, radius, halfLength, halfDepth) {
  const rad = angle * Math.PI / 180;
  const [x, y] = point(angle, radius);
  const tangent = [-Math.sin(rad), Math.cos(rad)];
  const normal = [Math.cos(rad), Math.sin(rad)];
  const vertices = [
    [x - tangent[0] * halfLength, y - tangent[1] * halfLength],
    [x + normal[0] * halfDepth, y + normal[1] * halfDepth],
    [x + tangent[0] * halfLength, y + tangent[1] * halfLength],
    [x - normal[0] * halfDepth, y - normal[1] * halfDepth]
  ];
  return `M ${vertices.map(coords).join(" L ")} Z`;
}

function buildSvg() {
  const holeAngles = [-91, -76, -61, -46, -31, -16];
  const holes = holeAngles.map((angle) =>
    `<path d="${diamond(angle, 281, 32, 14)}" fill="#000"/>`).join("\n      ");
  const holesShadow = holeAngles.map((angle) =>
    `<path d="${diamond(angle + 180, 291, 32, 14)}" fill="#000"/>`).join("\n      ");
  const scales = [-145, -131, -117].map((angle) =>
    `<path d="${diamond(angle, 279, 32, 12)}"/>`).join("\n      ");
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const cardinal = i % 3 === 0;
    const angle = -90 + i * 30;
    const start = point(angle, cardinal ? 163 : 168);
    const end = point(angle, 196);
    return `<path d="M ${coords(start)} L ${coords(end)}" stroke="${cardinal ? COLOR.gold : COLOR.edge}" stroke-width="${cardinal ? 4.5 : 3}"/>`;
  }).join("\n    ");

  function serpent(id, rotation) {
    const turn = rotation ? ` transform="rotate(180 ${CENTER.x} ${CENTER.y})"` : "";
    const contour = rotation
      ? '<path d="M 328 441 C 349 590 471 712 623 721" fill="none" stroke="' + COLOR.gray + '" stroke-width="7"/><path d="M 329 384 C 330 424 350 455 389 474 C 408 568 505 650 617 662 L 619 679 C 504 669 397 579 371 498 C 348 466 331 426 329 384 Z" fill="' + COLOR.gray + '"/>'
      : '<path d="M 649 111 C 800 133 908 253 929 390" fill="none" stroke="' + COLOR.gray + '" stroke-width="7"/>';
    const goldInner = rotation
      ? '<path d="M 389 474 C 402 563 502 662 616 663 C 718 667 806 614 862 546 L 852 558 C 800 621 718 674 616 671 C 505 669 402 568 389 474 Z"/>'
      : '<path d="M 495 198 C 539 170 587 165 632 171 C 731 177 810 249 850 354 L 858 382 L 868 389 C 835 268 743 184 633 164 C 585 158 533 170 495 198 Z"/>';
    return `<g id="${id}">
      <g id="${id}-body" mask="url(#${rotation ? "scale-cutouts-shadow" : "scale-cutouts"})">
        <path d="${rotation ? BODY_SHADOW : BODY}" fill="${COLOR.silver}"/>
        <path d="${rotation ? SHOULDER_SHADOW : SHOULDER}" fill="${COLOR.gray}"/>
        ${contour}
        <path d="M 380 277 C 432 176 529 126 604 135"${turn} fill="none" stroke="${COLOR.edge}" stroke-width="3"/>
      </g>
      <g id="${id}-scales"${turn} fill="none" stroke="${COLOR.silver}" stroke-width="3.3" stroke-linejoin="round">
        ${scales}
      </g>
      <g id="${id}-gold" fill="${COLOR.gold}">
        <path d="M 324 317 C 362 214 443 138 548 107 L 523 120 C 430 158 362 227 340 306 Z"${turn}/>
        ${goldInner}
        ${rotation ? "" : '<path d="M 862 355 C 887 366 909 387 920 411 L 925 430 C 912 400 894 383 865 378 Z"/>'}
      </g>
    </g>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768" role="img" aria-labelledby="title desc">
  <title id="title">ウロボロスの双子 — アプリアイコン清書</title>
  <desc id="desc">二匹の蛇が互いの尾を噛む円環。銀と灰の菱形模様、赤い目。内側に十二の目盛りと金の円、中央に赤い縦長の瞳孔。</desc>
  <defs>
    <mask id="scale-cutouts" maskUnits="userSpaceOnUse" x="240" y="70" width="750" height="710">
      <rect x="240" y="70" width="750" height="710" fill="#fff"/>
      ${holes}
    </mask>
    <mask id="scale-cutouts-shadow" maskUnits="userSpaceOnUse" x="240" y="70" width="750" height="710">
      <rect x="240" y="70" width="750" height="710" fill="#fff"/>
      ${holesShadow}
    </mask>
  </defs>
  <!-- 全体は透過。星・針・数字・背景・アプリ外枠を追加しない。 -->
  <g transform="translate(-227 -26)" stroke-linecap="butt" stroke-linejoin="round">
    ${serpent("snake-light", false)}
    ${serpent("snake-shadow", true)}
    <g id="snake-heads">
      <path id="head-light" d="${HEAD_LIGHT}" fill="${COLOR.silver}"/>
      <path id="head-shadow" d="${HEAD_SHADOW}" fill="${COLOR.gray}"/>
      <ellipse id="eye-light" cx="354" cy="334" rx="7.8" ry="13" transform="rotate(31 354 334)" fill="${COLOR.darkRed}"/>
      <ellipse id="eye-shadow" cx="898" cy="503" rx="7.8" ry="13" transform="rotate(36 898 503)" fill="${COLOR.darkRed}"/>
    </g>
    <!-- 尾の先は相手の口の下へ接続し、頭と胴の二匹を保つ。 -->
    <g id="mouth-tail-joints" fill="${COLOR.gold}">
      <path d="M 288 426 C 298 401 317 380 339 377 C 340 372 333 371 325 375 C 308 385 294 404 288 426 Z"/>
      <path d="M 330 386 C 331 424 351 455 389 474 L 383 454 C 354 448 337 420 330 386 Z"/>
      <path d="M 913 461 C 936 456 955 440 962 419 C 960 442 944 459 922 466 C 916 467 911 464 913 461 Z"/>
    </g>
    <g id="clock-dial" fill="none" stroke="${COLOR.edge}" stroke-width="2.6">
      <circle cx="611" cy="410" r="210"/>
      <circle cx="611" cy="410" r="201"/>
      ${ticks}
    </g>
    <g id="iris">
      <circle id="gold-ring" cx="611" cy="410" r="155" fill="none" stroke="${COLOR.gold}" stroke-width="7"/>
      <path id="red-pupil" d="M 611 347 C 634 391 634 429 611 473 C 588 429 588 391 611 347 Z" fill="${COLOR.red}"/>
    </g>
  </g>
</svg>
`;
}

if (require.main === module) {
  fs.writeFileSync(path.join(__dirname, "ouroboros-clean-v01.svg"), buildSvg(), "utf8");
  console.log("SVGを書き出しました: ouroboros-clean-v01.svg");
}
module.exports = { buildSvg, COLOR, CENTER, point };
