const assert = require("node:assert/strict");
const {
    calcBattleStats,
    physicalDamage,
    magicalDamage,
    accuracyScore,
    evasionScore,
    battleHitRate,
    targetPriorityScore,
} = require("../statConversion.js");
const characters = require("../characters.js");

const canon = {
    ringholm: characters.find(unit => unit.id === "ringholm"),
    arsheLv1: characters.find(unit => unit.id === "young_arshe"),
    albas: characters.find(unit => unit.id === "albas"),
};

for (const [id, unit] of Object.entries(canon)) {
    assert.ok(unit, `${id} fixture exists in characters.js`);
}

const expected = {
    ringholm: { atk: 26, mag: 28, skl: 22, def: 18, res: 25, counterRate: 90, luckT: 3, hp: 23, mp: 28 },
    arsheLv1: { atk: 14, mag: 18, skl: 18, def: 13, res: 15, counterRate: 90, luckT: 9, hp: 13, mp: 18 },
    albas: { atk: 18, mag: 36, skl: 36, def: 16, res: 32, counterRate: 65, luckT: 6, hp: 28, mp: 36 },
};

for (const [id, unit] of Object.entries(canon)) {
    const got = calcBattleStats(unit);
    for (const [key, value] of Object.entries(expected[id])) {
        assert.equal(got[key], value, `${id}.${key}`);
    }
}

const arsheLv4 = calcBattleStats(characters.find(unit => unit.id === "arshe"));
assert.equal(arsheLv4.atk, 22, "arshe Lv4 atk");
assert.equal(arsheLv4.mag, 26, "arshe Lv4 mag");
assert.equal(arsheLv4.skl, 23, "arshe Lv4 skl");
assert.equal(arsheLv4.def, 17, "arshe Lv4 physical defense");
assert.equal(arsheLv4.res, 23, "arshe Lv4 magical defense");

const fixedEnemy = calcBattleStats({
    str: 12, con: 10, dex: 9, pow: 6, int: 6,
    courage: 30, luck: 20, hp: 10,
});
assert.equal(fixedEnemy.atk, 12, "fixed enemy compatibility");
assert.equal(fixedEnemy.def, 11, "missing SIZ uses compatibility default 10");
assert.equal(fixedEnemy.power, fixedEnemy.atk, "legacy power alias");
assert.equal(fixedEnemy.armor, fixedEnemy.def, "legacy armor alias");
assert.equal(calcBattleStats(canon.ringholm).valor, 90, "legacy valor alias uses percent");
assert.equal(calcBattleStats(canon.ringholm).raw.app, 16, "ringholm APP");
assert.equal(calcBattleStats(canon.albas).attention, 17, "albas attention");

assert.equal(physicalDamage(calcBattleStats(canon.ringholm), calcBattleStats(canon.albas), 3), 13,
    "ringholm physical -> albas");
assert.equal(magicalDamage(calcBattleStats(canon.albas), calcBattleStats(canon.ringholm), 3), 14,
    "albas magic -> ringholm");
assert.equal(magicalDamage(calcBattleStats(canon.ringholm), calcBattleStats(canon.albas), 3), 1,
    "ringholm magic -> albas respects minimum damage");
assert.equal(calcBattleStats(canon.albas).supportMagic, 12, "support magic keeps compact effect scale");
assert.equal(accuracyScore(22, 9), 89, "ringholm accuracy");
assert.equal(evasionScore(22, 10, 9), 39, "ringholm evasion");
assert.equal(evasionScore(17, 14, 5), 18, "forest guard evasion");

const ringholmStats = calcBattleStats(canon.ringholm);
const guard = characters.find(unit => unit.id === "forest_guard");
const guardStats = calcBattleStats(guard);
assert.equal(battleHitRate(ringholmStats, guardStats, 9, 5), 71, "ringholm -> forest guard");
assert.equal(battleHitRate(guardStats, ringholmStats, 7, 9), 30, "forest guard -> ringholm");
assert.equal(battleHitRate(calcBattleStats(canon.albas), ringholmStats, 9, 9), 78, "albas attack magic -> ringholm");
assert.equal(battleHitRate({ raw: { dex: 1 } }, { raw: { dex: 99, siz: 1 } }, 1, 10), 20, "hit floor");
assert.equal(battleHitRate({ raw: { dex: 99 } }, { raw: { dex: 1, siz: 1 } }, 10, 0), 95, "hit ceiling");
assert.ok(targetPriorityScore(3, 17) < targetPriorityScore(3, 10), "higher APP draws attention at equal range");

console.log("statConversion: all tests passed");
