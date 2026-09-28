// =====================================================================
//  adoptedStatTables.js ― 採用版の文書（採用版md/SRPG_CHARACTER_STAT_GROWTH_STANDARD.md）の表を読む（純粋な処理）
//
//  因果Lv1の能力値（§5・§5.3）・成長率（§6・§6.2）・幸運と勇気（§6.1・§6.2）・能力上限（§8.2・§8.4）。
//  ステータスの一覧（tools/build_stat_sheet.py）と、デバッグ用のページ（debug/status_viewer.html）の両方で使う。
//  文書の表の HP は案①（TRPG HP×2）。ゲームは案②（×1）で動いている（原作者 2026-09-29: 案②の方が自然）
// =====================================================================

const ADOPTED_STAT_KEYS = Object.freeze(["hp", "atk", "def", "mag", "res", "tec", "spd", "cha"]);
const ADOPTED_STAT_LABELS = Object.freeze(["HP", "力", "防御", "魔攻", "魔防", "技", "速さ", "魅力"]);

/** 文書の本文から、キャラごとの表の値を読む。返り値: [{ name, race, group, base1（HP案①）, growth, luck, courage, caps }] */
function parseAdoptedStatTables(mdText) {
    const md = String(mdText).split(/\r?\n/);
    const num = s => Number(String(s).replace("%", ""));
    const tableAfter = heading => {
        const i = md.findIndex(l => l.startsWith(heading));
        if (i < 0) throw new Error("採用版の文書に見出しがない: " + heading);
        let j = i + 1;
        while (j < md.length && !md[j].startsWith("|")) j++;
        const rows = [];
        for (; j < md.length && md[j].startsWith("|"); j++) rows.push(md[j].split("|").slice(1, -1).map(s => s.trim()));
        return { head: rows[0], body: rows.slice(2) };
    };

    const base = {};
    for (const r of tableAfter("## 5. メイン3人の因果Lv1基礎ステータス").body)
        base[r[0]] = { race: "", group: "", v: r.slice(1, 9).map(num) };
    for (const r of tableAfter("### 5.3 その他のネームドキャラクター").body)
        base[r[0]] = { race: r[1], group: r[2], v: r.slice(3, 11).map(num) };
    // メイン3人の種族は §4.4 の表から
    for (const r of tableAfter("### 4.4 種族差の扱い").body)
        for (const name of (r[7] || "").split("、").map(s => s.trim()))
            if (base[name] && !base[name].race) base[name].race = r[0];

    const growth = {};
    const growthTable = heading => {
        const t = tableAfter(heading);
        const names = t.head.slice(1);
        const cols = {};
        names.forEach(n => (cols[n] = {}));
        for (const r of t.body) names.forEach((n, k) => (cols[n][r[0]] = r[k + 1]));
        for (const [n, g] of Object.entries(cols)) {
            growth[n] = { v: ADOPTED_STAT_LABELS.map(l => num(g[l])) };
            if (g["幸運 / 最大勇気"]) {
                const [luck, courage] = g["幸運 / 最大勇気"].split("/").map(num);
                Object.assign(growth[n], { luck, courage });
            }
        }
    };
    growthTable("## 6. 個人成長率");
    growthTable("### 6.2 その他のネームドキャラクターの個人成長率");
    for (const r of tableAfter("### 6.1 幸運・勇気の成長率補正").body)
        Object.assign(growth[r[0]], { luck: num(r[1]), courage: num(r[2]) });

    const caps = {};
    for (const h of ["### 8.2 メイン3人の能力上限", "### 8.4 その他のネームドキャラクターの能力上限"])
        for (const r of tableAfter(h).body) caps[r[0]] = r.slice(1, 9).map(num);

    return Object.keys(base).map(name => ({
        name, race: base[name].race, group: base[name].group,
        base1: base[name].v, growth: growth[name].v, luck: growth[name].luck, courage: growth[name].courage, caps: caps[name],
    }));
}

/** 採用版の表の1人分を、trialStatSystem.js と同じ形のプロフィールにする（hpPlan: 2＝案②（×1）、1＝案①（×2）） */
function adoptedProfile(row, hpPlan = 2, siz = null) {
    const obj = values => Object.fromEntries(ADOPTED_STAT_KEYS.map((k, i) => [k, values[i]]));
    const base = obj(row.base1);
    if (hpPlan === 2) base.hp = row.base1[0] / 2;
    return { name: row.name, race: row.race, base, growth: obj(row.growth), caps: obj(row.caps), luck: row.luck, courage: row.courage, siz };
}

if (typeof module !== "undefined") {
    module.exports = { ADOPTED_STAT_KEYS, ADOPTED_STAT_LABELS, parseAdoptedStatTables, adoptedProfile };
}
