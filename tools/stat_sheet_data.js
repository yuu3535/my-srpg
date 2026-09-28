// SRPGのステータス一覧（tools/build_stat_sheet.py）の元データを集める。
// 採用版md の表（因果Lv1・成長率・上限）＋ trialStatSystem.js（ゲームにだけある仮の値・今の戦闘の値）＋ abilityData.js（最初の兵種）
// 使い方: node tools/stat_sheet_data.js <出力の json>
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const T = require(path.join(ROOT, "trialStatSystem.js"));
const { ABILITY_DATA: A } = require(path.join(ROOT, "abilityData.js"));
const DEFS = require(path.join(ROOT, "battleDefinitions.js"));
const md = fs.readFileSync(path.join(ROOT, "採用版md/SRPG_CHARACTER_STAT_GROWTH_STANDARD.md"), "utf8").split(/\r?\n/);

const KEYS = ["hp", "atk", "def", "mag", "res", "tec", "spd", "cha"];

// 見出し（### x.y ...）の下の最初の表を読む
function tableAfter(heading) {
    const i = md.findIndex(l => l.startsWith(heading));
    if (i < 0) throw new Error("見出しがない: " + heading);
    let j = i + 1;
    while (!md[j].startsWith("|")) j++;
    const rows = [];
    for (; j < md.length && md[j].startsWith("|"); j++) rows.push(md[j].split("|").slice(1, -1).map(s => s.trim()));
    return { head: rows[0], body: rows.slice(2) };
}
const num = s => Number(String(s).replace("%", ""));

// 因果Lv1（HPは表では案①。案②＝半分）
const base = {};
const main = tableAfter("## 5. メイン3人の因果Lv1基礎ステータス");
for (const r of main.body) base[r[0]] = { race: null, group: null, v: r.slice(1, 9).map(num) };
const others = tableAfter("### 5.3 その他のネームドキャラクター");
for (const r of others.body) base[r[0]] = { race: r[1], group: r[2], v: r.slice(3, 11).map(num) };
Object.assign(base["幼アルシェ"], { race: "ヒト", group: "オルクス王族" });
Object.assign(base["リングホルム"], { race: "ヒト", group: "" });
Object.assign(base["アルバス"], { race: "魔物", group: "" });

// 成長率（表は 行＝能力、列＝キャラ）
function growthTable(heading) {
    const t = tableAfter(heading);
    const names = t.head.slice(1);
    const out = {};
    names.forEach((n, k) => (out[n] = {}));
    for (const r of t.body) names.forEach((n, k) => (out[n][r[0]] = r[k + 1]));
    return out;
}
const labels = ["HP", "力", "防御", "魔攻", "魔防", "技", "速さ", "魅力"];
const growth = {};
for (const [n, g] of Object.entries({ ...growthTable("## 6. 個人成長率"), ...growthTable("### 6.2 その他のネームドキャラクターの個人成長率") })) {
    growth[n] = { v: labels.map(l => num(g[l])) };
    if (g["幸運 / 最大勇気"]) { const [lk, cg] = g["幸運 / 最大勇気"].split("/").map(num); growth[n].luck = lk; growth[n].courage = cg; }
}
// メイン3人の幸運・勇気（§6.1）
for (const r of tableAfter("### 6.1 幸運・勇気の成長率補正").body) Object.assign(growth[r[0]], { luck: num(r[1]), courage: num(r[2]) });

// 上限
const caps = {};
for (const h of ["### 8.2 メイン3人の能力上限", "### 8.4 その他のネームドキャラクターの能力上限"])
    for (const r of tableAfter(h).body) caps[r[0]] = r.slice(1, 9).map(num);

// 最初の兵種（兵種表CSV。ギュンターは表では「ベル」）
const classOf = name => {
    const c = (A.characterClasses[name] || []).find(x => x.initial);
    return c ? `${c.name.replace(/\)$/, "")}（${c.slot}）` : "";
};
const classKey = { 幼アルシェ: "アルシェ", 幼カリマ: "カリマ", 幼ギュンター: "ベル" };

const adopted = Object.keys(base).map(n => ({
    name: n, race: base[n].race, group: base[n].group,
    cls: classOf(classKey[n] || n),
    base1: base[n].v, // HP 案①
    growth: growth[n].v, luck: growth[n].luck, courage: growth[n].courage,
    caps: caps[n],
}));

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
