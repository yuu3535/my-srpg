// =====================================================================
// statConversion.js - TRPG raw stats -> SRPG battle stats
// =====================================================================

/** Resolve a fixed stat or a { base, gains } stat at the given level. */
function statAt(stat, level = 1) {
    if (typeof stat === "number") return stat;
    if (!stat || typeof stat.base !== "number") return 0;
    const gains = Array.isArray(stat.gains) ? stat.gains : [];
    const gainedLevels = Math.max(0, level - 1);
    return stat.base + gains
        .slice(0, gainedLevels)
        .reduce((sum, value) => sum + Number(value || 0), 0);
}

const CONVERSION_RULES = Object.freeze({
    atk:   { formula: "STR",             label: "力" },
    mag:   { formula: "POW",             label: "魔力" },
    skl:   { formula: "DEX",             label: "技量" },
    def:   { formula: "(STR + SIZ) / 2", label: "物防" },
    res:   { formula: "(POW + CON) / 2", label: "魔防" },
    counterRate: { formula: "courage",   label: "反撃率" },
    luckT: { formula: "luck / 10",       label: "運" },
});

function rawStat(unit, key) {
    const source = unit?.stats?.[key] !== undefined ? unit.stats[key] : unit?.[key];
    return statAt(source, unit?.level ?? 1);
}

function equipmentStatBonus(unit, key) {
    if (typeof unit?.equipmentBonus?.[key] === "number") return unit.equipmentBonus[key];
    if (key === "def") return Number(unit?.equipmentArmor || 0);
    if (key === "res") return Number(unit?.equipmentWard || 0);
    return 0;
}

/**
 * Convert canonical TRPG stats into FE-style battle stats on the raw scale.
 * New v2 keys are returned together with legacy aliases used by the current UI.
 */
function calcBattleStats(unit) {
    const raw = {
        str: rawStat(unit, "str"),
        con: rawStat(unit, "con"),
        dex: rawStat(unit, "dex"),
        pow: rawStat(unit, "pow"),
        edu: rawStat(unit, "edu"),
        int: rawStat(unit, "int"),
        siz: rawStat(unit, "siz") || 10,
        app: rawStat(unit, "app") || 10,
        courage: rawStat(unit, "courage"),
        luck: rawStat(unit, "luck"),
    };
    const out = {
        atk: raw.str,
        mag: raw.pow,
        skl: raw.dex,
        def: Math.floor((raw.str + raw.siz) / 2) + equipmentStatBonus(unit, "def"),
        res: Math.floor((raw.pow + raw.con) / 2) + equipmentStatBonus(unit, "res"),
        counterRate: raw.courage,
        luckT: Math.floor(raw.luck / 10),
    };
    const hpSource = unit?.stats?.hp ?? unit?.maxHp ?? unit?.hp;
    const evadeSkill = Number(unit?.skills?.["回避"] ?? unit?.skillRanks?.["回避"] ?? 0);

    return {
        ...out,
        raw,
        hp: statAt(hpSource, unit?.level ?? 1),
        mp: raw.pow,
        attention: raw.app,
        supportMagic: Math.floor(raw.pow / 3),
        baseAccuracy: baseAccuracyRate(raw.dex),
        baseEvasion: baseEvasionRate(raw.str, raw.dex, raw.siz),
        evasion: evasionScore(raw.str, raw.dex, raw.siz, evadeSkill),

        // Compatibility aliases. Remove after all UI code uses the v2 names.
        power: out.atk,
        magic: out.mag,
        technique: out.skl,
        armor: out.def,
        ward: out.res,
        valor: out.counterRate,
        luckTokens: out.luckT,
    };
}

function physicalDamage(attacker, defender, weaponPower) {
    const atk = attacker?.atk ?? attacker?.power ?? 0;
    const def = defender?.def ?? defender?.armor ?? 0;
    return Math.max(1, atk + Number(weaponPower || 0) - def);
}

function magicalDamage(attacker, defender, spellPower) {
    const mag = attacker?.mag ?? attacker?.magic ?? 0;
    const res = defender?.res ?? defender?.ward ?? 0;
    return Math.max(1, mag + Number(spellPower || 0) - res);
}

function baseAccuracyRate(dex) {
    return 50 + Number(dex || 0);
}

function accuracyScore(dex, skillValue, bonus = 0) {
    return baseAccuracyRate(dex) + Number(skillValue || 0) * 5 + Number(bonus || 0);
}

function evasionSizeModifier(siz) {
    return Math.max(-14, Math.min(14, (11 - Number(siz || 10)) * 2));
}

function baseEvasionRate(str, dex, siz) {
    return Math.round(
        Number(str || 0) * 1.5
        + Number(dex || 0) * 0.5
        + evasionSizeModifier(siz)
    );
}

function evasionScore(str, dex, siz, evadeSkill, bonus = 0) {
    const baseRate = baseEvasionRate(str, dex, siz);
    const trainingMultiplier = 1 + Number(evadeSkill || 0) * 0.05;
    return Math.round(baseRate * trainingMultiplier) + Number(bonus || 0);
}

function battleHitRate(attackerStats, defenderStats, attackSkill, evadeSkill, modifiers = {}) {
    const accuracy = accuracyScore(
        attackerStats?.raw?.dex,
        attackSkill,
        modifiers.accuracy || 0
    );
    const evasion = evasionScore(
        defenderStats?.raw?.str,
        defenderStats?.raw?.dex,
        defenderStats?.raw?.siz,
        evadeSkill,
        modifiers.evasion || 0
    );
    const rate = accuracy - evasion;
    return Math.min(95, Math.max(20, Math.round(rate)));
}

function criticalValue(courage, level = 1, bonus = 0) {
    const levelModifier = (Number(level || 1) - 5) * 5;
    return Math.floor(Number(courage || 0) / 2) + levelModifier + Number(bonus || 0);
}

function criticalAvoidance(app, bonus = 0) {
    return Number(app || 0) * 2 + Number(bonus || 0);
}

function criticalRate(courage, level, defenderApp, modifiers = {}) {
    const rate = criticalValue(courage, level, modifiers.critical || 0)
        - criticalAvoidance(defenderApp, modifiers.criticalAvoidance || 0);
    return Math.min(95, Math.max(0, Math.floor(rate)));
}

function criticalDamage(baseDamage, multiplier = 3) {
    return Math.max(0, Math.floor(Number(baseDamage || 0) * Number(multiplier || 0)));
}

function masteryDamageBonus(rank) {
    return Math.max(0, Math.min(3, Math.floor(Number(rank || 0) / 3)));
}

function targetPriorityScore(distance, app, attentionBonus = 0) {
    return Number(distance || 0) * 10 - Number(app || 10) - Number(attentionBonus || 0);
}

if (typeof module !== "undefined") {
    module.exports = {
        CONVERSION_RULES,
        statAt,
        rawStat,
        calcBattleStats,
        physicalDamage,
        magicalDamage,
        baseAccuracyRate,
        accuracyScore,
        evasionSizeModifier,
        baseEvasionRate,
        evasionScore,
        battleHitRate,
        criticalValue,
        criticalAvoidance,
        criticalRate,
        criticalDamage,
        masteryDamageBonus,
        targetPriorityScore,
    };
}
