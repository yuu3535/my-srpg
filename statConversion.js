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

    return {
        ...out,
        raw,
        hp: statAt(hpSource, unit?.level ?? 1),
        mp: raw.pow,
        attention: raw.app,
        supportMagic: Math.floor(raw.pow / 3),

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

function accuracyScore(dex, skillValue, bonus = 0) {
    return Number(dex || 0) * 2 + Number(skillValue || 0) * 5 + Number(bonus || 0);
}

function evasionScore(dex, siz, evadeSkill, bonus = 0) {
    return Number(dex || 0) - Number(siz || 0)
        + Number(evadeSkill || 0) * 3
        + Number(bonus || 0);
}

function battleHitRate(attackerStats, defenderStats, attackSkill, evadeSkill, modifiers = {}) {
    const accuracy = accuracyScore(
        attackerStats?.raw?.dex,
        attackSkill,
        modifiers.accuracy || 0
    );
    const evasion = evasionScore(
        defenderStats?.raw?.dex,
        defenderStats?.raw?.siz,
        evadeSkill,
        modifiers.evasion || 0
    );
    const rate = accuracy - evasion;
    return Math.min(95, Math.max(20, Math.round(rate)));
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
        accuracyScore,
        evasionScore,
        battleHitRate,
        targetPriorityScore,
    };
}
