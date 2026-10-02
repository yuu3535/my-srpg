/**
 * ブラウザ版の戦闘データを、Unity版（unity-prototype）で読む形に書き出す。
 * データの正本はブラウザ版（characters.js・battleDefinitions.js）。Unity側で書き直さない。
 *
 * 使い方:
 *   node tools/export_unity_battle.js                 # テスト戦闘（battle_trial_adopted）
 *   node tools/export_unity_battle.js <battleId>
 *
 * 出力（unity-prototype/Assets/ 以下）:
 *   Data/Battles/<battleId>.json   … マップの大きさ・斜め見下ろしの設定・ユニット（位置・陣営・移動力・絵）
 *   Art/Tokens/<unitId>.png        … 盤面のドット絵（元の画像を複製）
 *   Art/Maps/<名前>.png            … 斜め見下ろしのマップ絵（元の画像を複製）
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const UNITY_ASSETS = path.join(ROOT, "unity-prototype", "Assets");
const CHARACTERS_DATA = require(path.join(ROOT, "characters.js"));
const BATTLE_DEFINITIONS = require(path.join(ROOT, "battleDefinitions.js"));

// Unity版の戦闘に出さないキャラ（理由つき）。素材が揃ったら外す
// （カリマは背景を透明にした盤面の絵ができたので出す。原作者 2026-09-26）
const UNITY_EXCLUDED_UNITS = {};

function copyAsset(sourceRelative, destDir, destName) {
    const source = path.join(ROOT, sourceRelative);
    if (!fs.existsSync(source)) throw new Error(`素材が見つからない: ${sourceRelative}`);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, destName);
    fs.copyFileSync(source, dest);
    return path.relative(path.join(ROOT, "unity-prototype"), dest).split(path.sep).join("/");
}

function main() {
    const battleId = process.argv[2] || "battle_trial_adopted";
    const def = BATTLE_DEFINITIONS[battleId];
    if (!def) throw new Error(`戦闘が見つからない: ${battleId}`);

    // ブラウザ版の startBattle と同じ並び: unitIds のキャラ → unitCopies（既存キャラの複製）
    const sources = [
        ...CHARACTERS_DATA.filter(c => def.unitIds.includes(c.id)),
        ...Object.entries(def.unitCopies || {}).map(([id, copy]) => {
            const base = CHARACTERS_DATA.find(c => c.id === copy.from);
            if (!base) throw new Error(`複製元が見つからない: ${copy.from}`);
            const { from, ...overrides } = copy;
            return { ...base, ...overrides, id };
        }),
    ];

    const tokenDir = path.join(UNITY_ASSETS, "Art", "Tokens");
    for (const c of sources) {
        if (UNITY_EXCLUDED_UNITS[c.id]) console.log(`出さない: ${c.name}（${UNITY_EXCLUDED_UNITS[c.id]}）`);
    }
    const units = sources.filter(c => !UNITY_EXCLUDED_UNITS[c.id]).map(c => {
        const pos = def.positions?.[c.id] ?? { x: c.x, y: c.y };
        return {
            id: c.id,
            name: c.name,
            side: c.side,
            x: pos.x,
            y: pos.y,
            move: c.move,
            attackRange: c.attackRange ?? 1,
            token: c.tokenImage ? copyAsset(c.tokenImage, tokenDir, `${c.id}.png`) : null,
            flying: !!c.flying,   // 飛行（キャラのデータにあれば。移動の規則は Unity の TerrainRules）
            // 最初から持っている消耗品（戦闘定義の unitItems。Unity の交換で渡す）
            items: (def.unitItems?.[c.id] || []).map(item => ({ ...item })),
            reserve: (def.reserve || []).includes(c.id),   // 最初は戦いに出ない（ほかの敵を全部倒すと出る）
            // 控えの待つ位置（戦う範囲の外で見守る。なければ空）。[x, y]
            wait: def.reserveWait?.[c.id] ? [def.reserveWait[c.id].x, def.reserveWait[c.id].y] : [],
            enter: def.reserveEnter?.[c.id] || "",   // 控えの入り方（teleport＝一瞬で現れる。空なら歩く）
            passive: (def.passive || []).includes(c.id),   // 自分からは動かない・攻撃しない（反撃はする）
        };
    });

    let iso = null;
    if (def.isoView) {
        const mapName = path.basename(def.isoView.image);
        iso = {
            image: copyAsset(def.isoView.image, path.join(UNITY_ASSETS, "Art", "Maps"), mapName),
            tileW: def.isoView.tileW,
            originX: def.isoView.originX,
            originY: def.isoView.originY,
            width: def.isoView.width,
            height: def.isoView.height,
        };
    }

    const out = {
        battleId,
        cols: def.cols ?? 10,
        rows: def.rows ?? 10,
        tiles: def.tiles || [],
        iso,
        units,
        timeOfDay: def.timeOfDay || "dusk",
        // 戦況の画面の文と、手加減（訓練。味方のHPは1より下がらない）
        title: def.title || "",
        chapter: def.chapter || "",     // 左上の Chapter と戦場名（銀細工のUI 第2段）
        location: def.location || "",
        victoryText: def.victoryText || "",
        defeatText: def.defeatText || "",
        mercy: !!def.mercy,
        // 拾える消耗品（{ x, y, item: { id, name, type, value } }）
        mapItems: (def.mapItems || []).map(mi => ({ x: mi.x, y: mi.y, item: { ...mi.item } })),
    };
    const dataDir = path.join(UNITY_ASSETS, "Data", "Battles");
    fs.mkdirSync(dataDir, { recursive: true });
    const file = path.join(dataDir, `${battleId}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log(`書き出し: ${path.relative(ROOT, file)}（ユニット ${units.length}）`);
}

main();
