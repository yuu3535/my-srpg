const assert = require("node:assert/strict");

const {
    calcBattleStats,
    physicalDamage,
    battleHitRate,
    criticalRate,
    criticalDamage,
    masteryDamageBonus,
} = require("../statConversion.js");
const {
    createBattleActionRequest,
    createBattleContext,
    createFixedRollSource,
    resolveShadowPhysicalAttack,
    compareShadowPlanToLegacy,
} = require("../combatPipeline.js");
const { executeBattlePlanOnClones } = require("../cloneBattleExecutor.js");
const CHARACTERS_DATA = require("../characters.js");

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

function createFixture(overrides = {}) {
    const actor = makeUnit({
        id: "actor",
        name: "Actor",
        ...overrides.actor,
    });
    const target = makeUnit({
        id: "target",
        name: "Target",
        side: "enemy",
        str: 8,
        con: 8,
        dex: 8,
        app: 12,
        courage: 20,
        skills: { "武器": 5, "回避": 2, "武道": 0 },
        ...overrides.target,
    });
    const request = createBattleActionRequest({
        id: overrides.requestId || "request:test",
        actorId: actor.id,
        targetId: target.id,
        attackSkillName: "武器",
        attackSkillValue: actor.skills["武器"],
        includeCounter: false,
    });
    const context = createBattleContext({
        request,
        actor,
        target,
        weaponPower: overrides.weaponPower ?? 3,
        ...overrides.context,
    });
    return { actor, target, request, context };
}

// Independent characterization oracle for the current game.js path:
// getBattleHitResult -> calculatePhysicalDamage -> getContextCriticalRate
// -> HP clamp -> low-HP incapacitation check. Counter continuation is excluded.
function resolveLegacyPilotAttack({ actor, target, request, weaponPower }, rolls) {
    let rollIndex = 0;
    const nextRoll = () => rolls[rollIndex++];
    const actorStats = calcBattleStats(actor);
    const targetStats = calcBattleStats(target);
    const hitRate = battleHitRate(
        actorStats,
        targetStats,
        request.attackSkillValue,
        target.skills["回避"] ?? 0,
        { accuracy: 0, evasion: 0 }
    );
    const hitRoll = nextRoll();
    const isHit = hitRoll <= hitRate;

    if (!isHit) {
        return {
            hit: { rate: hitRate, roll: hitRoll, isHit: false },
            critical: null,
            damage: {
                attackValue: null,
                armorValue: null,
                base: 0,
                masteryBonus: 0,
                normal: 0,
                critical: 0,
                applied: 0,
            },
            incapacitation: null,
            commands: [],
            summary: { targetHpAfter: target.hp },
        };
    }

    const attackValue = actorStats.power + weaponPower;
    const armorValue = targetStats.armor;
    const base = physicalDamage({ atk: attackValue }, { def: armorValue }, 0);
    const masteryBonus = masteryDamageBonus(actor.skills["武道"]);
    const normalDamage = base + masteryBonus;
    const resolvedCriticalRate = criticalRate(
        Math.max(0, actorStats.raw.courage - Number(actor.battleCourageLoss || 0)),
        actor.level,
        targetStats.raw.app,
        {
            critical: Number(actor.criticalBonus || 0),
            criticalAvoidance: Number(target.criticalAvoidanceBonus || 0),
        }
    );
    const criticalRoll = nextRoll();
    const isCritical = criticalRoll <= resolvedCriticalRate;
    const resolvedCriticalDamage = criticalDamage(normalDamage);
    const appliedDamage = isCritical ? resolvedCriticalDamage : normalDamage;
    let targetHpAfter = Math.max(0, target.hp - appliedDamage);
    let incapacitation = null;
    const commands = [{
        type: "setHp",
        unitId: target.id,
        from: target.hp,
        to: targetHpAfter,
        reason: "physicalDamage",
    }];

    if (target.hp > 2 && targetHpAfter <= 2 && targetHpAfter > 0) {
        const rate = targetStats.raw.con * 5;
        const roll = nextRoll();
        const triggered = roll > rate;
        incapacitation = { rate, roll, triggered };
        if (triggered) {
            commands.push({
                type: "setHp",
                unitId: target.id,
                from: targetHpAfter,
                to: 0,
                reason: "incapacitation",
            });
            targetHpAfter = 0;
        }
    }

    return {
        hit: { rate: hitRate, roll: hitRoll, isHit: true },
        critical: { rate: resolvedCriticalRate, roll: criticalRoll, isCritical },
        damage: {
            attackValue,
            armorValue,
            base,
            masteryBonus,
            normal: normalDamage,
            critical: resolvedCriticalDamage,
            applied: appliedDamage,
        },
        incapacitation,
        commands,
        summary: { targetHpAfter },
    };
}

function assertLegacyParity(fixture, rolls) {
    const actorBefore = structuredClone(fixture.actor);
    const targetBefore = structuredClone(fixture.target);
    const source = createFixedRollSource(rolls);
    const plan = resolveShadowPhysicalAttack(fixture.context, { rollSource: source });
    const legacy = resolveLegacyPilotAttack({
        actor: fixture.actor,
        target: fixture.target,
        request: fixture.request,
        weaponPower: fixture.context.rules.weaponPower,
    }, rolls);
    const differences = compareShadowPlanToLegacy(plan, legacy);
    const cloneExecution = executeBattlePlanOnClones(plan, [fixture.actor, fixture.target]);
    const executedTarget = cloneExecution.units.find(unit => unit.id === fixture.target.id);

    assert.deepEqual(differences, [], `shadow and legacy results differ: ${JSON.stringify(differences)}`);
    assert.equal(cloneExecution.ok, true, "eligible shadow plan executes on clones");
    assert.equal(executedTarget.hp, plan.summary.targetHpAfter, "clone HP matches the BattlePlan summary");
    assert.equal(executedTarget.hp, legacy.summary.targetHpAfter, "clone HP matches the legacy result");
    assert.deepEqual(
        cloneExecution.appliedCommands.map(entry => entry.index),
        plan.commands.map((_, index) => index),
        "clone executor preserves BattlePlan command order"
    );
    assert.deepEqual(fixture.actor, actorBefore, "shadow resolver does not mutate the live actor");
    assert.deepEqual(fixture.target, targetBefore, "shadow resolver does not mutate the live target");
    return { plan, source, legacy, cloneExecution };
}

{
    const fixture = createFixture();
    const { plan, source } = assertLegacyParity(fixture, [10, 99]);
    assert.equal(plan.hit.isHit, true, "fixed hit roll produces a hit");
    assert.equal(plan.critical.isCritical, false, "fixed critical roll produces a normal hit");
    assert.equal(source.getConsumedCount(), 2, "hit and critical consume two fixed rolls");
    assert.equal(plan.commands[0].type, "setHp", "damage is recorded as a command");
    assert.deepEqual({
        hitRate: plan.hit.rate,
        criticalRate: plan.critical.rate,
        baseDamage: plan.damage.base,
        masteryBonus: plan.damage.masteryBonus,
        normalDamage: plan.damage.normal,
        criticalDamage: plan.damage.critical,
        targetHpAfter: plan.summary.targetHpAfter,
    }, {
        hitRate: 79,
        criticalRate: 0,
        baseDamage: 6,
        masteryBonus: 1,
        normalDamage: 7,
        criticalDamage: 21,
        targetHpAfter: 13,
    }, "current basic physical attack values remain characterized");
}

{
    const fixture = createFixture();
    const { plan, source } = assertLegacyParity(fixture, [100]);
    assert.equal(plan.hit.isHit, false, "fixed miss roll produces a miss");
    assert.equal(plan.critical, null, "a miss does not consume a critical roll");
    assert.equal(source.getConsumedCount(), 1, "a miss consumes only the hit roll");
    assert.equal(plan.commands.length, 0, "a miss records no state mutation command");
}

{
    const fixture = createFixture({
        actor: { courage: 100 },
    });
    const { plan } = assertLegacyParity(fixture, [1, 1]);
    assert.equal(plan.critical.isCritical, true, "fixed critical roll produces a critical hit");
    assert.equal(plan.damage.applied, plan.damage.critical, "critical damage is selected for the plan");
}

{
    const fixture = createFixture({
        actor: {
            str: 10,
            courage: 0,
            skills: { "武器": 10, "回避": 0, "武道": 0 },
        },
        target: {
            hp: 6,
            maxHp: 6,
            str: 0,
            siz: 10,
            con: 10,
            dex: 0,
            app: 10,
            skills: { "武器": 0, "回避": 0, "武道": 0 },
        },
        weaponPower: 0,
    });
    const { plan, source, cloneExecution } = assertLegacyParity(fixture, [1, 100, 60]);
    assert.deepEqual(plan.incapacitation, { rate: 50, roll: 60, triggered: true });
    assert.equal(plan.summary.targetHpAfter, 0, "failed CON check records incapacitation");
    assert.equal(source.getConsumedCount(), 3, "incapacitation consumes a third fixed roll");
    assert.deepEqual(plan.commands.map(command => command.reason), ["physicalDamage", "incapacitation"]);
    assert.deepEqual(cloneExecution.appliedCommands.map(command => command.reason), ["physicalDamage", "incapacitation"]);
}

{
    const fixture = createFixture();
    const plan = resolveShadowPhysicalAttack(fixture.context, {
        rollSource: createFixedRollSource([1, 100]),
        hooks: [{
            id: "test:pure-power",
            phase: "beforeAttack",
            resolve(context) {
                assert.ok(Object.isFrozen(context), "resolver hooks receive a frozen context");
                return {
                    modifiers: { physicalPowerBonus: 2 },
                    commands: [{ type: "recordUsage", effectId: "test:pure-power" }],
                    notes: ["test:pure-power"],
                };
            },
        }],
    });
    assert.equal(plan.triggeredEffectIds[0], "test:pure-power");
    assert.equal(plan.commands[0].type, "recordUsage", "hook state changes remain declarative");
    assert.ok(plan.notes.includes("test:pure-power"));
}

{
    const actor = makeUnit({ id: "actor", equippedPassives: ["sakki"] });
    const target = makeUnit({ id: "target", side: "enemy" });
    const request = createBattleActionRequest({
        actorId: actor.id,
        targetId: target.id,
        attackSkillName: "武器",
        attackSkillValue: actor.skills["武器"],
    });
    const context = createBattleContext({ request, actor, target, weaponPower: 3 });
    const plan = resolveShadowPhysicalAttack(context, { rollSource: createFixedRollSource([]) });
    assert.equal(plan.eligible, false, "unsupported passive effects stay on the legacy path");
    assert.ok(plan.ineligibilityReasons.includes("actor-passives"));
    const execution = executeBattlePlanOnClones(plan, [actor, target]);
    assert.equal(execution.ok, false, "ineligible plans are not executed on clones");
    assert.equal(execution.reason, "ineligible-plan");
}

{
    const fixture = createFixture();
    const plan = resolveShadowPhysicalAttack(fixture.context, {
        rollSource: createFixedRollSource([1, 100]),
    });
    const staleTarget = structuredClone(fixture.target);
    staleTarget.hp -= 1;
    const staleTargetBefore = structuredClone(staleTarget);
    const execution = executeBattlePlanOnClones(plan, [fixture.actor, staleTarget]);

    assert.equal(execution.ok, false, "stale clone state stops execution");
    assert.equal(execution.reason, "state-mismatch");
    assert.equal(execution.commandIndex, 0);
    assert.equal(execution.expected, fixture.target.hp);
    assert.equal(execution.actual, staleTarget.hp);
    assert.equal(execution.appliedCommands.length, 0, "failed execution commits no commands");
    assert.deepEqual(staleTarget, staleTargetBefore, "failed execution does not mutate its source unit");
}

{
    const actor = makeUnit({ id: "actor" });
    const target = makeUnit({ id: "target", side: "enemy", hp: 6, maxHp: 6 });
    const targetBefore = structuredClone(target);
    const inconsistentPlan = {
        eligible: true,
        commands: [
            { type: "setHp", unitId: "target", from: 6, to: 2, reason: "physicalDamage" },
            { type: "setHp", unitId: "target", from: 1, to: 0, reason: "incapacitation" },
        ],
    };
    const execution = executeBattlePlanOnClones(inconsistentPlan, [actor, target]);
    const returnedTarget = execution.units.find(unit => unit.id === target.id);

    assert.equal(execution.ok, false, "a mismatch in a later command stops execution");
    assert.equal(execution.reason, "state-mismatch");
    assert.equal(execution.commandIndex, 1, "commands are validated in their original order");
    assert.equal(execution.expected, 1);
    assert.equal(execution.actual, 2);
    assert.equal(returnedTarget.hp, 6, "a later failure rolls back earlier clone changes");
    assert.deepEqual(target, targetBefore, "rollback does not mutate its source unit");
}

{
    const sourceActor = CHARACTERS_DATA.find(unit => unit.id === "arshe");
    const sourceTarget = CHARACTERS_DATA.find(unit => unit.id === "forest_guard");
    const sourceActorBefore = structuredClone(sourceActor);
    const sourceTargetBefore = structuredClone(sourceTarget);
    const actor = {
        ...structuredClone(sourceActor),
        learnedPassives: [],
        equippedPassives: [],
        statusEffects: [],
    };
    const target = {
        ...structuredClone(sourceTarget),
        learnedPassives: [],
        equippedPassives: [],
        statusEffects: [],
    };
    const request = createBattleActionRequest({
        id: "request:real-arshe-vs-forest-guard",
        actorId: actor.id,
        targetId: target.id,
        attackSkillName: "武器",
        attackSkillValue: actor.skills["武器"],
    });
    const context = createBattleContext({ request, actor, target, weaponPower: 3 });
    const fixture = { actor, target, request, context };
    const { plan, cloneExecution } = assertLegacyParity(fixture, [1, 100]);
    const executedTarget = cloneExecution.units.find(unit => unit.id === target.id);

    assert.deepEqual({
        attackValue: plan.damage.attackValue,
        armorValue: plan.damage.armorValue,
        masteryBonus: plan.damage.masteryBonus,
        hitRate: plan.hit.rate,
        normalDamage: plan.damage.normal,
        criticalRate: plan.critical.rate,
        criticalDamage: plan.damage.critical,
        commands: plan.commands,
        executedHp: executedTarget.hp,
    }, {
        attackValue: 25,
        armorValue: 16,
        masteryBonus: 2,
        hitRate: 70,
        normalDamage: 11,
        criticalRate: 20,
        criticalDamage: 33,
        commands: [{
            type: "setHp",
            unitId: "forest_guard",
            from: 14,
            to: 3,
            reason: "physicalDamage",
        }],
        executedHp: 3,
    }, "real character data remains characterized");
    assert.deepEqual(sourceActor, sourceActorBefore, "characters.js actor data is unchanged");
    assert.deepEqual(sourceTarget, sourceTargetBefore, "characters.js target data is unchanged");
}

console.log("combatPipeline: shadow/legacy parity tests passed");
