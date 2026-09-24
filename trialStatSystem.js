// =====================================================================
//  trialStatSystem.js ― 採用版ステータス試験用の計算（純粋処理）
//
//  試験ブランチ trial/adopted-stats 専用。DOM・戦闘状態に触れない。
//  出典:
//    採用版md/SRPG_CHARACTER_STAT_GROWTH_STANDARD.md v1.5（換算・成長・上限）
//    docs/90-worklogs/WORK_MEMO_2026-09-24.md §12（ダメージ式・武器威力）
//    docs/90-worklogs/WORK_MEMO_2026-09-24.md §15（必殺率・倍率の重複）
//    docs/10-design/battle/TRPG_TO_SRPG_STAT_CONVERSION.md §7.2（命中式）
//  第1段階では兵種補正・兵種スキル・Dualを含めない。
// =====================================================================

// 基本8ステータスのキー（採用版の並び）
const TRIAL_STAT_KEYS = Object.freeze(["hp", "atk", "def", "mag", "res", "tec", "spd", "cha"]);

// 仮の武器威力（WORK_MEMO §12）
const TRIAL_WEAPON_POWER = Object.freeze({ low: 3, mid: 6, high: 10 });

// 追撃に必要な速さ差（WORK_MEMO_2026-09-24 §1 の候補）
const TRIAL_FOLLOW_UP_SPEED_GAP = 5;

// TRPGレベル → 試験で使う因果Lv（原作者指定 2026-09-24）
const TRIAL_CAUSE_LEVEL_BY_TRPG_LEVEL = Object.freeze({ 1: 1, 2: 10, 3: 20, 4: 25, 5: 30 });

// 試験用の計算を適用する戦闘の目印（battleDefinitions.js の trialRules）
const TRIAL_RULES_ID = "adopted-stats-v1";

/*
 * 試験用プロフィール
 *   base   : 因果Lv1基礎値（HPは試験用の案②＝TRPG Lv1 HP x 1）
 *   growth : 個人成長率(%)。幸運・勇気補正は trialGrowthBonus で別に加える
 *   caps   : 能力上限（HP上限は採用版どおり x 2 の式）
 *   siz    : 命中式の体格補正用
 *   trpgLevel : 試験で使う因果Lvの決定元
 *   sourceCharacterId : 表示（画像）と持ち物（魔法・技能・秘伝など）を借りる
 *               characters.js の id。省略時はゲーム側のユニットのまま
 *
 *   敵3体（森の番人・ディラン・ヘレル）の個人成長率は採用版に無いため、試験用の仮値。
 */
const TRIAL_PROFILES = Object.freeze({
    ringholm: {
        name: "リングホルム", race: "ヒト", trpgLevel: 5,
        base:   { hp: 12, atk: 16, def: 13, mag: 16, res: 14, tec: 7,  spd: 12, cha: 16 },
        growth: { hp: 45, atk: 75, def: 45, mag: 65, res: 65, tec: 75, spd: 70, cha: 60 },
        caps:   { hp: 104, atk: 94, def: 94, mag: 110, res: 106, tec: 96, spd: 91, cha: 112 },
        luck: 35, courage: 90, siz: 10,
    },
    arshe: {
        // ゲーム側の arshe（TRPG Lv4）を、採用版の幼アルシェの値で因果Lv25として扱う。
        // 画像・魔法・技能などの表示と持ち物も幼アルシェ（young_arshe）のものを使う
        name: "アルシェ", race: "ヒト", trpgLevel: 4, sourceCharacterId: "young_arshe",
        base:   { hp: 13, atk: 14, def: 13, mag: 18, res: 15, tec: 9,  spd: 10, cha: 15 },
        growth: { hp: 70, atk: 60, def: 55, mag: 55, res: 50, tec: 70, spd: 70, cha: 60 },
        caps:   { hp: 122, atk: 90, def: 108, mag: 104, res: 106, tec: 87, spd: 71, cha: 102 },
        luck: 90, courage: 90, siz: 13,
    },
    young_karima: {
        // 幼カリマ（TRPG Lv1）は因果Lv1だと検証にならないため、原作者指示
        // 「弱すぎる場合は因果Lvを上げる」に従い、アルシェと同じ因果Lv25で扱う
        name: "カリマ", race: "ヒト", trpgLevel: 1, causeLevel: 25,
        base:   { hp: 12, atk: 14, def: 13, mag: 18, res: 15, tec: 9,  spd: 11, cha: 15 },
        growth: { hp: 55, atk: 50, def: 45, mag: 65, res: 70, tec: 70, spd: 70, cha: 65 },
        caps:   { hp: 122, atk: 86, def: 108, mag: 106, res: 100, tec: 86, spd: 96, cha: 101 },
        luck: 90, courage: 90, siz: 13,
    },
    albas: {
        name: "アルバス", race: "魔物", trpgLevel: 5,
        base:   { hp: 18, atk: 12, def: 13, mag: 24, res: 22, tec: 12, spd: 9,  cha: 17 },
        growth: { hp: 65, atk: 40, def: 50, mag: 80, res: 75, tec: 80, spd: 55, cha: 70 },
        caps:   { hp: 104, atk: 80, def: 89, mag: 110, res: 108, tec: 98, spd: 108, cha: 115 },
        luck: 65, courage: 65, siz: 15,
    },
    forest_guard: {
        // TRPGシートなし。characters.js の値（TRPG Lv2相当）をLv1基礎値として換算した一般兵
        name: "森の番人", race: "ヒト", trpgLevel: 2,
        base:   { hp: 14, atk: 18, def: 16, mag: 12, res: 15, tec: 8,  spd: 9,  cha: 10 },
        growth: { hp: 60, atk: 55, def: 50, mag: 15, res: 30, tec: 45, spd: 45, cha: 25 },
        caps:   { hp: 99, atk: 99, def: 99, mag: 99, res: 99, tec: 99, spd: 99, cha: 99 },
        luck: 40, courage: 50, siz: 14,
    },
    dylan: {
        // 竜人。SIZ増加後（SIZ25、HP23）を標準戦闘状態として換算。物理最高峰
        name: "ディラン", race: "竜人", trpgLevel: 4,
        base:   { hp: 23, atk: 24, def: 24, mag: 11, res: 15, tec: 9,  spd: 11, cha: 10 },
        growth: { hp: 65, atk: 80, def: 60, mag: 20, res: 35, tec: 50, spd: 50, cha: 25 },
        caps:   { hp: 130, atk: 110, def: 105, mag: 108, res: 61, tec: 97, spd: 94, cha: 107 },
        luck: 25, courage: 60, siz: 25,
    },
    herel: {
        // 星飼い。隕石・重力を使う魔法型
        name: "ヘレル", race: "ヒト", trpgLevel: 4,
        base:   { hp: 13, atk: 12, def: 12, mag: 15, res: 14, tec: 6,  spd: 9,  cha: 13 },
        growth: { hp: 45, atk: 25, def: 35, mag: 70, res: 60, tec: 60, spd: 50, cha: 50 },
        caps:   { hp: 100, atk: 70, def: 86, mag: 82, res: 81, tec: 76, spd: 76, cha: 89 },
        luck: 90, courage: 70, siz: 13,
    },
});

/*
 * 表示用の兵種データ（仮）
 *   兵種: Regarding character growth rates, skills, and combat arts/各キャラ兵種表 - 各キャラ兵種適正.csv の「◎（加入時の最初の兵種）」
 *   兵種スキル: 同フォルダの 各キャラ兵種表 - 兵種スキル.csv
 *   兵種Lvは未実装のため、表示上は TRIAL_CLASS_LEVEL とする
 */
const TRIAL_CLASS_LEVEL = 1;

const TRIAL_CLASS_SKILLS = Object.freeze({
    "戦列下級": [
        ["兵種Lv5",  "HP+5",   "最大HP+5"],
        ["兵種Lv10", "深呼吸", "勇気が減っているとき、2ターンごとに勇気+5"],
        ["兵種Lv15", "武道",   "技÷2%で物理攻撃の威力2倍"],
        ["マスター", "戦上手", "武器装備時HP+5（この兵種のみ）"],
    ],
    "術軍師上級": [
        ["兵種Lv5",  "威光",       "魅力÷2%で発動、力・魔攻の威力1.5倍（戦技）"],
        ["兵種Lv10", "魅力+10",    "魅力+10"],
        ["兵種Lv15", "詠唱破棄",   "魔法使用時、消費MP半減"],
        ["マスター", "導きの神髄", "魅力+5、魔攻+5（この兵種のみ）"],
    ],
});

const TRIAL_UNIT_CLASS = Object.freeze({
    ringholm:     { name: "ならずもの", line: "戦列下級" },
    arshe:        { name: "王子",       line: "戦列下級" },
    young_karima: { name: "王子",       line: "戦列下級" },
    albas:        { name: "ロード",     line: "術軍師上級" },
    forest_guard: { name: "戦士（仮）", line: "戦列下級" },
    dylan:        { name: "未設定",     line: null },
    herel:        { name: "未設定",     line: null },
});

// 採用済みのセット枠。試験画面では「装備中の枠」を見るだけとし、
// 習得一覧や付け替え操作は拠点の育成画面へ分離する。
const TRIAL_LOADOUT_SLOT_COUNTS = Object.freeze({
    classSkills: 4,
    classUnique: 1,
    causeSkills: 3,
    combatArts: 4,
});

// 個人スキルは外せない固定枠。アルバスの「野望」は、CSVより新しい
// WORK_MEMO_2026-09-25 の原作者回答（案A）を優先している。
const TRIAL_PERSONAL_SKILLS = Object.freeze({
    arshe: {
        name: "双蛇の逆針",
        desc: "味方の撃破や攻撃失敗の後、一手単位で行動を巻き戻す。残り回数の機能は未実装。",
    },
    ringholm: {
        name: "殺気",
        desc: "自分から攻撃したとき、命中+10・相手の回避-10・必殺+10。",
    },
    albas: {
        name: "野望",
        desc: "自分から攻撃したとき、魅力×2%で敵の反撃を封じる。ほかの補正の適用場面は確認中。",
    },
    young_karima: {
        name: "双蛇の逆針",
        desc: "味方の撃破や攻撃失敗の後、一手単位で行動を巻き戻す。残り回数の機能は未実装。",
    },
});

// 因果スキル・戦技は修正版CSVから表示に必要な項目だけを転記する。
// Lv50の専用能力は因果3枠ではなく、現在兵種限定の兵種固有枠へ入る。
const TRIAL_CAUSE_ABILITIES = Object.freeze({
    arshe: Object.freeze([
        { level: 5,  type: "skill", name: "黒陽の加護", desc: "獲得兵種経験値1.5倍" },
        { level: 10, type: "art",   name: "両断", desc: "物理攻撃1.5倍" },
        { level: 15, type: "skill", name: "祈り", desc: "戦闘中1度、幸運%でHP1を残す" },
        { level: 20, type: "art",   name: "破壊", desc: "魔法攻撃時に装甲を破壊" },
        { level: 25, type: "skill", name: "デュアル+", desc: "デュアル発生率+5" },
        { level: 30, type: "skill", name: "カウンター", desc: "被ダメージの半分を相手へ返すことがある" },
        { level: 35, type: "art",   name: "落雷", desc: "雷撃と追撃・反撃・移動封じ" },
        { level: 40, type: "art",   name: "封印", desc: "射程内の敵1体の移動を封じる" },
        { level: 45, type: "art",   name: "万雷", desc: "直線3マスを巻き込む雷撃" },
        { level: 50, type: "exclusive", name: "奈落の王", desc: "力・魔攻・速さ・魅力+10" },
    ]),
    ringholm: Object.freeze([
        { level: 5,  type: "skill", name: "黒の一族", desc: "火魔法の命中+20・ダメージ1.5倍" },
        { level: 10, type: "art",   name: "召喚「ヒトダマ」", desc: "幻獣ヒトダマを2ターンで召喚" },
        { level: 15, type: "art",   name: "円舞", desc: "隣接するすべての敵へ物理攻撃" },
        { level: 20, type: "skill", name: "死神", desc: "周囲の敵の回避・命中-10、速さ-5" },
        { level: 25, type: "skill", name: "カウンター", desc: "被ダメージの半分を相手へ返すことがある" },
        { level: 30, type: "art",   name: "復讐", desc: "減少HPを攻撃威力へ加算" },
        { level: 35, type: "skill", name: "戦闘指揮", desc: "指揮したターンの味方戦闘値+5" },
        { level: 40, type: "art",   name: "月詠", desc: "周囲5マスの敵HPを20%削る" },
        { level: 45, type: "skill", name: "剣の舞", desc: "剣装備時、力・魔攻・命中+10" },
        { level: 50, type: "exclusive", name: "勇者の器", desc: "力・技・速さ・魅力+10" },
    ]),
    albas: Object.freeze([
        { level: 5,  type: "art",   name: "破壊", desc: "魔法攻撃時に装甲を破壊" },
        { level: 10, type: "skill", name: "詠唱破棄", desc: "確率で魔法武器耐久・MP消費なし" },
        { level: 15, type: "art",   name: "回復", desc: "回復魔法の回復量×3" },
        { level: 20, type: "skill", name: "王威", desc: "周囲の味方の回避・命中・必殺耐性+10" },
        { level: 25, type: "art",   name: "加速", desc: "自分または味方1人を再行動させる" },
        { level: 30, type: "skill", name: "魔法射程+1", desc: "魔法の射程+1" },
        { level: 35, type: "art",   name: "転移", desc: "味方を指定位置へ移動させる" },
        { level: 40, type: "art",   name: "生命吸収", desc: "周囲の敵HPを削り、自身のHP・MPを回復" },
        { level: 45, type: "skill", name: "魔神の器", desc: "魔法装備時、魔攻・魔防・命中+10" },
        { level: 50, type: "exclusive", name: "破滅の王", desc: "HP・魔攻・技・魅力+10" },
    ]),
    young_karima: Object.freeze([
        { level: 5,  type: "skill", name: "白陽の加護", desc: "獲得兵種経験値1.5倍" },
        { level: 10, type: "art",   name: "結界", desc: "自分または味方1人へ装甲を与える" },
        { level: 15, type: "skill", name: "祈り", desc: "戦闘中1度、幸運%でHP1を残す" },
        { level: 20, type: "art",   name: "破壊", desc: "魔法攻撃時に装甲を破壊" },
        { level: 25, type: "skill", name: "デュアル+", desc: "デュアル発生率+5" },
        { level: 30, type: "skill", name: "アシスト", desc: "隣接する味方の命中・必殺+5" },
        { level: 35, type: "art",   name: "虚像", desc: "相手の命中-20" },
        { level: 40, type: "art",   name: "封印", desc: "射程内の敵1体の移動を封じる" },
        { level: 45, type: "art",   name: "落雷", desc: "雷撃と追撃・反撃・移動封じ" },
        { level: 50, type: "exclusive", name: "神炎の器", desc: "防御・魔防・速さ・魅力+10" },
    ]),
});

// 魔法戦技 → 既存の魔法データ（spells.js）の対応（たたき台・未採用）。
// 魔法コマンドは「セットした魔法戦技」と「装備した魔導書」の魔法を選ぶ入口（原作者方針 2026-09-25）。
// 戦技の独自効果（破壊の装甲破壊、回復の回復量×3など）は未実装で、対応する魔法をそのまま使う。
// 万雷は対応する魔法がないため、まだ魔法コマンドに出さない。
const TRIAL_MAGIC_ART_SPELLS = Object.freeze({
    "破壊": "破壊",
    "落雷": "落雷",
    "封印": "封印",
    "結界": "結界",
    "虚像": "虚像",
    "加速": "加速",
    "転移": "転移",
    "回復": "治癒",
    "召喚「ヒトダマ」": "ヒトダマ",
});

// 仮の魔導書（1人1冊）。武器・魔導書の装備欄ができるまでの試験用。
// どのキャラに何の魔導書を持たせるかは原作者が決める（ここは Claude Code の仮置き）
const TRIAL_GRIMOIRES = Object.freeze({
    ringholm:     { name: "火の魔導書",   spell: "火" },   // 黒の一族（火魔法強化）に合わせた
    arshe:        { name: "火の魔導書",   spell: "火" },
    young_karima: { name: "治癒の魔導書", spell: "治癒" },
});

/** 試験用ユニットの魔法コマンドの中身（セット中の魔法戦技 → 魔導書の順） */
function trialMagicMenuFor(unitId, causeLevel) {
    const loadout = trialSkillLoadoutFor(unitId, causeLevel);
    const menu = loadout.combatArts
        .filter(art => art && TRIAL_MAGIC_ART_SPELLS[art.name])
        .map(art => ({ name: art.name, spell: TRIAL_MAGIC_ART_SPELLS[art.name], source: "戦技" }));
    const grimoire = TRIAL_GRIMOIRES[unitId];
    if (grimoire && !menu.some(item => item.spell === grimoire.spell)) {
        menu.push({ name: grimoire.name, spell: grimoire.spell, source: "魔導書" });
    }
    return menu;
}

function trialFillLoadoutSlots(items, count) {
    return Array.from({ length: count }, (_, index) => items[index] || null);
}

/**
 * 試験画面用の読み取り専用セット内容。
 * セット変更機能が未実装のため、習得順に空き枠へ入れる表示例とする。
 * 戦闘効果には接続せず、画面構成を確認するためだけに使う。
 */
function trialSkillLoadoutFor(unitId, causeLevel, classLevel = TRIAL_CLASS_LEVEL) {
    const cls = TRIAL_UNIT_CLASS[unitId] || { line: null };
    const classLearned = (cls.line ? TRIAL_CLASS_SKILLS[cls.line] || [] : [])
        .filter(([need]) => need !== "マスター" && classLevel >= Number(need.replace("兵種Lv", "")))
        .map(([need, name, desc]) => ({ name, desc, source: need }));
    const causeLearned = (TRIAL_CAUSE_ABILITIES[unitId] || [])
        .filter(ability => ability.level <= Number(causeLevel || 1));
    const exclusive = causeLearned.find(ability => ability.type === "exclusive") || null;
    return {
        personal: TRIAL_PERSONAL_SKILLS[unitId] || null,
        classSkills: trialFillLoadoutSlots(classLearned, TRIAL_LOADOUT_SLOT_COUNTS.classSkills),
        classUnique: trialFillLoadoutSlots(exclusive ? [exclusive] : [], TRIAL_LOADOUT_SLOT_COUNTS.classUnique),
        causeSkills: trialFillLoadoutSlots(
            causeLearned.filter(ability => ability.type === "skill"),
            TRIAL_LOADOUT_SLOT_COUNTS.causeSkills
        ),
        combatArts: trialFillLoadoutSlots(
            causeLearned.filter(ability => ability.type === "art"),
            TRIAL_LOADOUT_SLOT_COUNTS.combatArts
        ),
    };
}

/**
 * ステータス画面に出す戦闘値。
 *   命中率 = 命中値 - 相手の回避値（5〜100%）
 *   必殺率 = 必殺値 - 相手の必殺耐性
 *   追撃   = 速さの差が TRIAL_FOLLOW_UP_SPEED_GAP 以上
 */
function trialDerivedValues(stats, siz, currentCourage) {
    const courage = Math.max(0, Math.min(100, Number(currentCourage || 0)));
    const sizeMod = trialSizeEvasionModifier(siz);
    return {
        hit: Math.round(60 + stats.tec * 2.5),
        evade: Math.round(stats.spd * 2.5 + sizeMod),
        crit: stats.tec + Math.floor(courage / 5),
        critGuard: stats.cha,
        followUp: stats.spd - TRIAL_FOLLOW_UP_SPEED_GAP,
        followedBy: stats.spd + TRIAL_FOLLOW_UP_SPEED_GAP,
        counter: courage,
        sizeMod,
    };
}

/** 幸運・勇気の成長率補正（採用版§6.1）。最大勇気を使う */
function trialGrowthBonus(profile) {
    return Math.floor((Number(profile.luck || 0) + Number(profile.courage || 0)) / 40);
}

/** 試験用の因果Lv。causeLevel の指定があれば優先し、なければTRPGレベルの対応表で求める */
function trialCauseLevelFor(profile) {
    if (Number.isInteger(profile.causeLevel)) return profile.causeLevel;
    return TRIAL_CAUSE_LEVEL_BY_TRPG_LEVEL[profile.trpgLevel] ?? 1;
}

/**
 * 因果Lv時点の本人ステータス（期待値を四捨五入、上限適用）。
 * 確率成長か固定成長かは未決のため、試験では成長率どおりの期待値を使う。
 */
function trialStatsAt(profile, level) {
    const bonus = trialGrowthBonus(profile);
    const gained = Math.max(0, Number(level || 1) - 1);
    const stats = {};
    for (const key of TRIAL_STAT_KEYS) {
        const rate = (Number(profile.growth[key] || 0) + bonus) / 100;
        const value = profile.base[key] + rate * gained;
        stats[key] = Math.round(Math.min(profile.caps[key], value));
    }
    return stats;
}

/** 体格回避補正（検討資料§7.2）: 正なら避けやすく、負なら狙われやすい */
function trialSizeEvasionModifier(siz) {
    return Math.max(-10, Math.min(5, 11 - Number(siz || 11)));
}

/** 命中率（検討資料§7.2）: 60 + (技 - 速さ) x 2.5 - 体格回避補正、5〜100% */
function trialHitRate(attackerStats, defenderStats, defenderSiz, modifier = 0) {
    const rate = 60
        + (attackerStats.tec - defenderStats.spd) * 2.5
        - trialSizeEvasionModifier(defenderSiz)
        + Number(modifier || 0);
    return Math.max(5, Math.min(100, Math.round(rate)));
}

/** ダメージ（WORK_MEMO §12）: max(1, round(武器威力 + (攻撃値 - 守備値) / 2)) */
function trialDamage(attackValue, defenseValue, weaponPower = TRIAL_WEAPON_POWER.mid) {
    return Math.max(1, Math.round(Number(weaponPower) + (Number(attackValue) - Number(defenseValue)) / 2));
}

/** 必殺率（WORK_MEMO §15）: 技 + floor(現在の勇気 / 5) - 相手の魅力 + 補正、0〜100% */
function trialCriticalRate(attackerStats, currentCourage, defenderStats, modifier = 0) {
    const rate = attackerStats.tec
        + Math.floor(Math.max(0, Number(currentCourage || 0)) / 5)
        - defenderStats.cha
        + Number(modifier || 0);
    return Math.max(0, Math.min(100, Math.floor(rate)));
}

/** 追撃の判定: 速さの差が TRIAL_FOLLOW_UP_SPEED_GAP 以上 */
function trialCanFollowUp(attackerStats, defenderStats) {
    return attackerStats.spd - defenderStats.spd >= TRIAL_FOLLOW_UP_SPEED_GAP;
}

if (typeof module !== "undefined") {
    module.exports = {
        TRIAL_STAT_KEYS,
        TRIAL_WEAPON_POWER,
        TRIAL_FOLLOW_UP_SPEED_GAP,
        TRIAL_CAUSE_LEVEL_BY_TRPG_LEVEL,
        TRIAL_RULES_ID,
        TRIAL_PROFILES,
        TRIAL_CLASS_LEVEL,
        TRIAL_CLASS_SKILLS,
        TRIAL_UNIT_CLASS,
        TRIAL_LOADOUT_SLOT_COUNTS,
        TRIAL_PERSONAL_SKILLS,
        TRIAL_CAUSE_ABILITIES,
        trialSkillLoadoutFor,
        TRIAL_MAGIC_ART_SPELLS,
        TRIAL_GRIMOIRES,
        trialMagicMenuFor,
        trialDerivedValues,
        trialGrowthBonus,
        trialCauseLevelFor,
        trialStatsAt,
        trialSizeEvasionModifier,
        trialHitRate,
        trialDamage,
        trialCriticalRate,
        trialCanFollowUp,
    };
}
