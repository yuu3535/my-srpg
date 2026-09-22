const assert = require("node:assert/strict");

const {
    beginLivePhysicalShadowComparison,
    finishLivePhysicalShadowComparison,
} = require("../combatShadowComparison.js");

function makeUnit(overrides = {}) {
    return {
        id: "unit",
        name: "Unit",
        side: "ally",
        level: 5,
        hp: 20,
        maxHp: 20,
        str: 12,
        con: 10,
        dex: 14,
        pow: 8,
        edu: 8,
        int: 8,
        siz: 10,
        app: 10,
        courage: 40,
        luck: 20,
        skills: { "武器": 7, "回避": 3, "武道": 3 },
        skillRanks: {},
        statusEffects: [],
        learnedPassives: [],
        equippedPassives: [],
        counterMode: "none",
        ...overrides,
    };
}

function matchingLegacyResult() {
    return {
        hit: { rate: 79, roll: 10, isHit: true },
        critical: { rate: 0, roll: 99, isCritical: false },
        damage: {
            attackValue: 15,
            armorValue: 9,
            base: 6,
            masteryBonus: 1,
            normal: 7,
            critical: 21,
            applied: 7,
        },
        incapacitation: null,
        commands: [{
            type: "setHp",
            unitId: "target",
            from: 20,
            to: 13,
            reason: "physicalDamage",
        }],
        summary: { targetHpAfter: 13 },
    };
}

{
    const actor = makeUnit({ id: "actor" });
    const target = makeUnit({
        id: "target",
        side: "enemy",
        str: 8,
        con: 8,
        dex: 8,
        app: 12,
        courage: 20,
        skills: { "武器": 5, "回避": 2, "武道": 0 },
    });
    const randomValues = [0.09, 0.98];
    let randomCalls = 0;
    const session = beginLivePhysicalShadowComparison({
        id: "live:test-match",
        actor,
        target,
        attackSkillName: "武器",
        attackSkillValue: 7,
        weaponPower: 3,
        random() {
            const value = randomValues[randomCalls];
            randomCalls += 1;
            return value;
        },
    });

    assert.equal(session.eligible, true);
    assert.equal(session.rollSource.nextPercent("hit"), 10);
    assert.equal(session.rollSource.nextPercent("critical"), 99);
    assert.equal(randomCalls, 2, "the legacy path owns exactly two random draws");

    const comparison = finishLivePhysicalShadowComparison(session, matchingLegacyResult());
    assert.equal(comparison.compared, true);
    assert.equal(comparison.matches, true);
    assert.deepEqual(comparison.rolls, [
        { label: "hit", value: 10 },
        { label: "critical", value: 99 },
    ]);
    assert.deepEqual(comparison.differences, []);
}

{
    const actor = makeUnit({ id: "actor" });
    const target = makeUnit({
        id: "target",
        side: "enemy",
        str: 8,
        con: 8,
        dex: 8,
        app: 12,
        skills: { "武器": 5, "回避": 2, "武道": 0 },
    });
    const session = beginLivePhysicalShadowComparison({
        id: "live:test-difference",
        actor,
        target,
        attackSkillName: "武器",
        attackSkillValue: 7,
        weaponPower: 3,
        random: (() => {
            const values = [0.09, 0.98];
            return () => values.shift();
        })(),
    });
    session.rollSource.nextPercent("hit");
    session.rollSource.nextPercent("critical");
    const legacy = matchingLegacyResult();
    legacy.summary.targetHpAfter = 12;

    const comparison = finishLivePhysicalShadowComparison(session, legacy);
    assert.equal(comparison.matches, false, "a difference is recorded instead of adopting the shadow result");
    assert.ok(comparison.differences.some(entry => entry.field === "summary.targetHpAfter"));
    assert.equal(legacy.summary.targetHpAfter, 12, "comparison does not alter the legacy result");
}

{
    const actor = makeUnit({ id: "actor", equippedPassives: ["sakki"] });
    const target = makeUnit({ id: "target", side: "enemy" });
    let randomCalls = 0;
    const session = beginLivePhysicalShadowComparison({
        id: "live:test-ineligible",
        actor,
        target,
        attackSkillName: "武器",
        attackSkillValue: 7,
        weaponPower: 3,
        random() {
            randomCalls += 1;
            return 0;
        },
    });

    assert.equal(session.eligible, false, "unsupported passives skip the shadow comparison");
    assert.ok(session.ineligibilityReasons.includes("actor-passives"));
    assert.equal(randomCalls, 0, "an ineligible comparison consumes no random values");
    const comparison = finishLivePhysicalShadowComparison(session, matchingLegacyResult());
    assert.equal(comparison.compared, false);
}

{
    const actor = makeUnit({ id: "actor" });
    const target = makeUnit({
        id: "target",
        side: "enemy",
        str: 8,
        con: 8,
        dex: 8,
        app: 12,
        skills: { "武器": 5, "回避": 2, "武道": 0 },
    });
    const session = beginLivePhysicalShadowComparison({
        id: "live:test-miss",
        actor,
        target,
        attackSkillName: "武器",
        attackSkillValue: 7,
        weaponPower: 3,
        random: () => 0.99,
    });
    const hitRoll = session.rollSource.nextPercent("hit");
    const comparison = finishLivePhysicalShadowComparison(session, {
        hit: { rate: 79, roll: hitRoll, isHit: false },
        critical: null,
        damage: { attackValue: null, armorValue: null, base: 0, masteryBonus: 0, normal: 0, critical: 0, applied: 0 },
        incapacitation: null,
        commands: [],
        summary: { targetHpAfter: 20 },
    });

    assert.equal(comparison.matches, true);
    assert.deepEqual(comparison.rolls, [{ label: "hit", value: 100 }], "a miss records only the hit roll");
}

{
    const actor = makeUnit({
        id: "actor",
        str: 10,
        courage: 0,
        skills: { "武器": 10, "回避": 0, "武道": 0 },
    });
    const target = makeUnit({
        id: "target",
        side: "enemy",
        hp: 6,
        maxHp: 6,
        str: 0,
        con: 10,
        dex: 0,
        app: 10,
        skills: { "武器": 0, "回避": 0, "武道": 0 },
    });
    const values = [0, 0.99, 0.59];
    const session = beginLivePhysicalShadowComparison({
        id: "live:test-incapacitation",
        actor,
        target,
        attackSkillName: "武器",
        attackSkillValue: 10,
        weaponPower: 0,
        random: () => values.shift(),
    });
    const hitRoll = session.rollSource.nextPercent("hit");
    const criticalRoll = session.rollSource.nextPercent("critical");
    const incapacitationRoll = session.rollSource.nextPercent("incapacitation");
    const comparison = finishLivePhysicalShadowComparison(session, {
        hit: { rate: 95, roll: hitRoll, isHit: true },
        critical: { rate: 0, roll: criticalRoll, isCritical: false },
        damage: { attackValue: 10, armorValue: 5, base: 5, masteryBonus: 0, normal: 5, critical: 15, applied: 5 },
        incapacitation: { rate: 50, roll: incapacitationRoll, triggered: true },
        commands: [
            { type: "setHp", unitId: "target", from: 6, to: 1, reason: "physicalDamage" },
            { type: "setHp", unitId: "target", from: 1, to: 0, reason: "incapacitation" },
        ],
        summary: { targetHpAfter: 0 },
    });

    assert.equal(comparison.matches, true);
    assert.deepEqual(comparison.rolls.map(record => record.label), ["hit", "critical", "incapacitation"]);
}

console.log("combatShadowComparison: shared-roll comparison tests passed");
