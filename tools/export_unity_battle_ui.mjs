// =====================================================================
//  ブラウザ版の戦闘画面の表示（ユニットのカード・武器のカード・戦闘予測の立ち絵）を、Unity版のUIに書き出す。
//
//  使い方（静的サーバーで index.html を開ける状態にしてから）:
//    node tools/export_unity_battle_ui.mjs [ポート番号（既定 8931）]
//
//  画面なしの Edge でテスト戦闘（battle_trial_adopted）を始め、ブラウザ版のカードを実際に描いて読み取る。
//  表示の正本はブラウザ版のまま（兵種名・因果Lv・移動の書き方・武器の命中や必殺・立ち絵の切り抜き）。
//
//  出力:
//    unity-prototype/Assets/Data/Battles/battle_trial_adopted_ui.json … キャラごとの表示と、立ち絵の切り抜き（uv）
//    unity-prototype/Assets/Art/Portraits/<id>.png                    … 立ち絵（縦1024pxまでに縮める）
//    unity-prototype/Assets/Art/UI/Icons/<名前>.png                    … コマンドの線のアイコン（白。色はUnityで付ける）
// =====================================================================
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT_SERVER = Number(process.argv[2] || 8931);
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT_DEBUG = 9337;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "srpg-edge-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT_DEBUG}`, `--user-data-dir=${profile}`,
    "--window-size=1688,780", "about:blank"], { stdio: "ignore" });

let pages = [];
for (let i = 0; i < 40 && !pages.length; i++) {
    await sleep(250);
    try { pages = (await (await fetch(`http://127.0.0.1:${PORT_DEBUG}/json/list`)).json()).filter(p => p.type === "page"); } catch {}
}
if (!pages.length) throw new Error("Edge に接続できない");
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map();
ws.addEventListener("message", ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
});
const send = (method, params = {}) => new Promise(r => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expr => {
    const res = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
    return res.result?.result?.value;
};

await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");
await send("Page.navigate", { url: `http://localhost:${PORT_SERVER}/index.html?t=${Date.now()}` });
await sleep(2500);

const result = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    launchDebugBattle("battle_trial_adopted", "test");
    await wait(1200);
    [...document.querySelectorAll("*")].find(e => e.children.length <= 2 && e.textContent.trim() === "戦闘開始")?.click();
    await wait(1500);

    const loadImage = src => new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = src; });

    // CSS の background-size・background-position（計算済みの値）から、箱に見えている絵の範囲（Unity の uv、左下が原点）を出す
    const uvOf = (boxW, boxH, iw, ih, size, position) => {
        let w, h;
        if (size === "cover" || size === "contain") {
            const s = size === "cover" ? Math.max(boxW / iw, boxH / ih) : Math.min(boxW / iw, boxH / ih);
            w = iw * s; h = ih * s;
        } else {
            const [sw, sh = "auto"] = size.split(" ");
            const len = (v, box) => v.endsWith("%") ? box * parseFloat(v) / 100 : parseFloat(v);
            w = sw === "auto" ? null : len(sw, boxW);
            h = sh === "auto" ? null : len(sh, boxH);
            if (w === null && h === null) { w = iw; h = ih; }
            if (w === null) w = h * iw / ih;
            if (h === null) h = w * ih / iw;
        }
        const words = { left: "0%", top: "0%", center: "50%", right: "100%", bottom: "100%" };
        const [px = "50%", py = "50%"] = position.split(" ").map(v => words[v] || v);
        const off = (v, box, img) => v.endsWith("%") ? (box - img) * parseFloat(v) / 100 : parseFloat(v);
        const ox = off(px, boxW, w), oy = off(py, boxH, h);
        return { x: -ox / w, y: 1 - (-oy + boxH) / h, w: boxW / w, h: boxH / h };
    };

    // 立ち絵を縦1024pxまでに縮めて PNG にする
    const shrink = im => {
        const s = Math.min(1, 1024 / im.naturalHeight);
        const c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        return c.toDataURL("image/png").split(",")[1];
    };

    const units = [];
    const portraits = {};
    for (const unit of battleUnits.filter(u => u.trialStats)) {
        renderLandscapeUnitPanel(unit);
        await wait(50);
        const q = sel => document.querySelector("#landscapeUnitContent " + sel);
        const text = sel => (q(sel)?.textContent || "").trim();
        const cls = q(".lcClass");
        const stats = {};
        document.querySelectorAll("#landscapeUnitContent .lcWeapon dl > div").forEach(d => { stats[d.querySelector("dt").textContent.trim()] = d.querySelector("dd").textContent.trim(); });
        const item = TRIAL_ITEMS[unit.trialEquippedItem];
        const entry = {
            id: unit.id, name: unit.name, side: unit.side,
            levelLabel: text(".lcName span"),
            className: cls ? [...cls.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim() : "",
            moveLabel: text(".lcClass em"),
            maxMp: unit.maxMp || 0,
            weaponName: item ? item.name : "装備なし",
            weaponType: item ? weaponTypeOf(item) : "",
            weaponPower: stats["威力"] || "―", weaponRange: stats["射程"] || "―", weaponHit: stats["命中"] || "―", weaponCrit: stats["必殺"] || "―",
            portrait: "", cardUv: null, bustUv: null,
        };
        const src = getPortraitSrc(unit) || unit.tokenImage || "";
        const face = q(".lcPortrait");
        if (src && face) {
            const im = await loadImage(src);
            const cs = getComputedStyle(face);
            const r = face.getBoundingClientRect();
            entry.portrait = unit.id;
            entry.cardUv = uvOf(r.width, r.height, im.naturalWidth, im.naturalHeight, cs.backgroundSize, cs.backgroundPosition);
            // 戦闘予測の顔のアップ（renderLandscapeBattlePreview の bust と同じ決め方。箱は 154×118）
            const size = parseFloat(unit.portraitBgSize) || 300;
            const [x = "50%", y = "top"] = String(unit.portraitBgPos || "50% top").split(" ");
            const posX = /%$/.test(x) ? x : "50%";
            const pos = unit.forecastBustPos || (posX + " " + Math.round((/px$/.test(y) ? parseFloat(y) : 0) * 0.5 - 80) + "px");
            entry.bustUv = uvOf(154, 118, im.naturalWidth, im.naturalHeight, size + "% auto", pos);
            portraits[unit.id] = shrink(im);
        }
        units.push(entry);
    }

    // コマンドの線のアイコン（ブラウザ版と同じ線。白で描き、色は Unity で付ける）
    const icons = {};
    const names = { attack: "攻撃", wait: "待機", back: "戻る", cross: "交差", detail: "詳細", skill: "戦技", item: "持ち物" };
    for (const [file, label] of Object.entries(names)) {
        const d = LS_COMMAND_ICON_PATHS[label];
        if (!d) continue;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
        const im = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
        const c = document.createElement("canvas"); c.width = 96; c.height = 96;
        c.getContext("2d").drawImage(im, 0, 0, 96, 96);
        icons[file] = c.toDataURL("image/png").split(",")[1];
    }
    renderLandscapeUnitPanel(null);
    return { units, portraits, icons };
})()`);

const dataFile = join(ROOT, "unity-prototype", "Assets", "Data", "Battles", "battle_trial_adopted_ui.json");
const portraitDir = join(ROOT, "unity-prototype", "Assets", "Art", "Portraits");
const iconDir = join(ROOT, "unity-prototype", "Assets", "Art", "UI", "Icons");
for (const dir of [dirname(dataFile), portraitDir, iconDir]) mkdirSync(dir, { recursive: true });
writeFileSync(dataFile, JSON.stringify({ battleId: "battle_trial_adopted", units: result.units }, null, 2) + "\n", "utf8");
for (const [id, b64] of Object.entries(result.portraits)) writeFileSync(join(portraitDir, `${id}.png`), Buffer.from(b64, "base64"));
for (const [name, b64] of Object.entries(result.icons)) writeFileSync(join(iconDir, `${name}.png`), Buffer.from(b64, "base64"));
console.log(`書き出し: 表示 ${result.units.length}人・立ち絵 ${Object.keys(result.portraits).length}枚・アイコン ${Object.keys(result.icons).length}個`);

ws.close();
edge.kill();
process.exit(0);
