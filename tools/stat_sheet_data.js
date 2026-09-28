// SRPGのステータス一覧（tools/build_stat_sheet.py）の元データを集める。
// 採用版md の表（因果Lv1・成長率・上限）＋ trialStatSystem.js（ゲームにだけある仮の値・今の戦闘の値）＋ abilityData.js（最初の兵種）
// 使い方: node tools/stat_sheet_data.js <出力の json>
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const T = require(path.join(ROOT, "trialStatSystem.js"));
const { ABILITY_DATA: A } = require(path.join(ROOT, "abilityData.js"));
const DEFS = require(path.join(ROOT, "battleDefinitions.js"));
const { parseAdoptedStatTables } = require(path.join(ROOT, "debug", "adoptedStatTables.js"));
const rows = parseAdoptedStatTables(fs.readFileSync(path.join(ROOT, "採用版md/SRPG_CHARACTER_STAT_GROWTH_STANDARD.md"), "utf8"));

const KEYS = ["hp", "atk", "def", "mag", "res", "tec", "spd", "cha"];


// 最初の兵種（兵種表CSV。ギュンターは表では「ベル」）
const classOf = name => {
    const c = (A.characterClasses[name] || []).find(x => x.initial);
    return c ? `${c.name.replace(/\)$/, "")}（${c.slot}）` : "";
};
const classKey = { 幼アルシェ: "アルシェ", 幼カリマ: "カリマ", 幼ギュンター: "ベル" };

// 幼アルシェの所属は文書の表にないので足す（ほかのメイン2人は文書に所属の欄がない）
const adopted = rows.map(r => ({ ...r, group: r.group || (r.name === "幼アルシェ" ? "オルクス王族" : ""), cls: classOf(classKey[r.name] || r.name) }));

// ゲームにだけある仮の値（採用版に表がない）
const gameOnly = [
    ["gunter", "ギュンター（訓練・チュートリアル仕様）"],
    ["forest_guard", "森の番人（敵・仮）"],
    ["dylan", "ディラン（敵・仮）"],
    ["herel", "ヘレル（敵・仮）"],
    ["hitodama", "ヒトダマ（召喚・仮）"],
].map(([id, label]) => {
    const p = T.TRIAL_PROFILES[id];
    return { id, name: label, race: p.race, base2: KEYS.map(k => p.base[k]), growth: KEYS.map(k => p.growth[k]), caps: KEYS.map(k => p.caps[k]), luck: p.luck, courage: p.courage, siz: p.siz };
});

// 今の戦闘で使っている値（ゲームの計算そのまま）
const battles = [];
for (const [bid, label] of [["battle_prologue_training", "プロローグの訓練"], ["battle_trial_adopted", "テスト戦闘"]]) {
    const def = DEFS[bid];
    const ids = [...def.unitIds, ...Object.keys(def.unitCopies || {})];
    for (const id of ids) {
        const p = T.trialProfileFor(id, bid);
        if (!p) continue;
        const lv = T.trialCauseLevelFor(p);
        const s = T.trialStatsAt(p, lv);
        const gear = T.trialStartingGear(id, bid);
        battles.push({ battle: label, id, name: p.name + (id === "albas_rival" ? "（敵）" : ""), lv, skillLv: T.trialAbilityLevelFor(p),
            stats: KEYS.map(k => s[k]), gear: gear.items.map(i => T.TRIAL_ITEMS[i]?.name || i).join("・") });
    }
}

fs.writeFileSync(process.argv[2] || path.join(ROOT, "output", "stat_sheet_data.json"), JSON.stringify({ adopted, gameOnly, battles }, null, 1));
