// =====================================================================
// combatPipeline.js - Shadow-only combat pipeline prototype
//
// The live game may call this module for read-only shadow comparison.
// It models the current single-target basic physical attack without
// mutating live battle units or deciding the real battle result.
// =====================================================================

const CombatStatRules = typeof module !== "undefined" && module.exports
    ? require("./statConversion.js")
    : globalThis;

const combatPipelineCalcBattleStats = CombatStatRules.calcBattleStats;
const combatPipelinePhysicalDamage = CombatStatRules.physicalDamage;
const combatPipelineBattleHitRate = CombatStatRules.battleHitRate;
const combatPipelineCriticalRate = CombatStatRules.criticalRate;
const combatPipelineCriticalDamage = CombatStatRules.criticalDamage;
const combatPipelineMasteryDamageBonus = CombatStatRules.masteryDamageBonus;

const COMBAT_PIPELINE_VERSION = 1;
const BASIC_PHYSICAL_ACTION = "basicPhysical";
const RESOLVER_HOOK_PHASES = Object.freeze([
    "beforeAttack",
    "beforeDamage",
]);

let requestSequence = 0;

function clonePlain(value) {
    if (Array.isArray(value)) return value.map(clonePlain);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, clonePlain(entry)])
        );
    }
    return value;
}

function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const entry of Object.values(value)) deepFreeze(entry);
    return Object.freeze(value);
}

function snapshotUnit(unit) {
    if (!unit || !unit.id) throw new Error("A combat unit with a stable id is required");

    const snapshot = {
        id: unit.id,
        name: unit.name || unit.id,
        side: unit.side || null,
        level: Number(unit.level || 1),
        hp: Number(unit.hp || 0),
        maxHp: Number(unit.maxHp ?? unit.hp ?? 0),
        mp: Number(unit.mp || 0),
        stats: clonePlain(unit.stats || {}),
        skills: clonePlain(unit.skills || {}),
        skillRanks: clonePlain(unit.skillRanks || {}),
        equipmentBonus: clonePlain(unit.equipmentBonus || {}),
        equipmentArmor: Number(unit.equipmentArmor || 0),
        equipmentWard: Number(unit.equipmentWard || 0),
        weaponPower: typeof unit.weaponPower === "number" ? unit.weaponPower : null,
        weaponFormula: unit.weaponFormula || null,
        battleCourageLoss: Number(unit.battleCourageLoss || 0),
        criticalBonus: Number(unit.criticalBonus || 0),
        criticalAvoidanceBonus: Number(unit.criticalAvoidanceBonus || 0),
        statusEffects: clonePlain(unit.statusEffects || []),
        learnedPassives: [...(unit.learnedPassives || [])],
        equippedPassives: [...(unit.equippedPassives || [])],
        counterMode: unit.counterMode ?? "auto",
    };

    for (const key of ["str", "con", "dex", "pow", "edu", "int", "siz", "app", "courage", "luck"]) {
        if (unit[key] !== undefined) snapshot[key] = clonePlain(unit[key]);
    }

    return deepFreeze(snapshot);
}

function createBattleActionRequest(input = {}) {
    const actorId = input.actorId || input.attackerId;
    const targetIds = Array.isArray(input.targetIds)
        ? input.targetIds.filter(Boolean)
        : [input.targetId].filter(Boolean);

    if (!actorId) throw new Error("BattleActionRequest.actorId is required");
    if (targetIds.length !== 1) throw new Error("The pilot requires exactly one target");

    return deepFreeze({
        id: input.id || `battle-request-${++requestSequence}`,
        version: COMBAT_PIPELINE_VERSION,
        actionType: input.actionType || BASIC_PHYSICAL_ACTION,
        source: input.source || "player",
        actorId,
        targetIds,
        attackSkillName: input.attackSkillName || "攻撃",
        attackSkillValue: Number(input.attackSkillValue ?? 5),
        combatArtId: input.combatArtId || null,
        spellId: input.spellId || null,
        isCounter: !!input.isCounter,
        includeCounter: !!input.includeCounter,
        includeFollowUp: !!input.includeFollowUp,
        halfDamage: !!input.halfDamage,
    });
}

function getPilotIneligibilityReasons(request, actor, target, input) {
    const reasons = [];

    if (request.actionType !== BASIC_PHYSICAL_ACTION) reasons.push("action-type");
    if (request.targetIds.length !== 1) reasons.push("target-count");
    if (request.combatArtId) reasons.push("combat-art");
    if (request.spellId) reasons.push("magic");
    if (request.isCounter || request.includeCounter) reasons.push("counter");
    if (request.includeFollowUp) reasons.push("follow-up");
    if (request.halfDamage) reasons.push("half-damage");
    if (actor.statusEffects.length || target.statusEffects.length) reasons.push("status-effects");
    if (actor.battleCourageLoss || target.battleCourageLoss) reasons.push("battle-courage-loss");
    if (actor.learnedPassives.length || actor.equippedPassives.length) reasons.push("actor-passives");
    if (target.learnedPassives.length || target.equippedPassives.length) reasons.push("target-passives");
    if (actor.weaponFormula && !Number.isFinite(Number(input.weaponPower))) reasons.push("weapon-formula");

    return reasons;
}

function createBattleContext(input = {}) {
    const request = input.request;
    if (!request) throw new Error("BattleContext requires a BattleActionRequest");

    const actor = snapshotUnit(input.actor || input.attacker);
    const target = snapshotUnit(input.target);

    if (actor.id !== request.actorId) throw new Error("BattleContext actor does not match the request");
    if (target.id !== request.targetIds[0]) throw new Error("BattleContext target does not match the request");

    const actorStats = combatPipelineCalcBattleStats(actor);
    const targetStats = combatPipelineCalcBattleStats(target);
    const weaponPower = Number.isFinite(Number(input.weaponPower))
        ? Number(input.weaponPower)
        : Number(actor.weaponPower ?? 3);
    const ineligibilityReasons = getPilotIneligibilityReasons(request, actor, target, input);

    return deepFreeze({
        id: input.id || `battle-context:${request.id}`,
        version: COMBAT_PIPELINE_VERSION,
        request,
        actor,
        target,
        actorStats: clonePlain(actorStats),
        targetStats: clonePlain(targetStats),
        rules: {
            battleHitMode: input.battleHitMode || "normal",
            weaponPower,
            evadeSkill: Number(target.skills?.["回避"] ?? 0),
            accuracyModifier: Number(input.accuracyModifier || 0),
            evasionModifier: Number(input.evasionModifier || 0),
            actorDerivedBonus: Number(input.actorDerivedBonus || 0),
            targetDerivedBonus: Number(input.targetDerivedBonus || 0),
            physicalPowerBonus: Number(input.physicalPowerBonus || 0),
            finalDamageBonus: Number(input.finalDamageBonus || 0),
            damageMultiplier: Number(input.damageMultiplier ?? 1),
            criticalBonus: Number(input.criticalBonus || 0),
            criticalAvoidanceBonus: Number(input.criticalAvoidanceBonus || 0),
        },
        eligible: ineligibilityReasons.length === 0,
        ineligibilityReasons,
    });
}

function createFixedRollSource(rolls = []) {
    const queue = [...rolls];
    let index = 0;

    return Object.freeze({
        nextPercent(label = "roll") {
            if (index >= queue.length) throw new Error(`No fixed roll remains for ${label}`);
            const value = Number(queue[index++]);
            if (!Number.isInteger(value) || value < 1 || value > 100) {
                throw new Error(`Fixed roll for ${label} must be an integer from 1 to 100`);
            }
            return value;
        },
        getConsumedCount() {
            return index;
        },
        getRemainingCount() {
            return queue.length - index;
        },
    });
}

function createRandomRollSource(random = Math.random) {
    if (typeof random !== "function") throw new Error("A random function is required");
    return Object.freeze({
        nextPercent() {
            return Math.floor(random() * 100) + 1;
        },
    });
}

function mergeModifierPatch(target, patch = {}) {
    for (const key of [
        "physicalPowerBonus",
        "finalDamageBonus",
        "criticalBonus",
        "criticalAvoidanceBonus",
    ]) {
        target[key] += Number(patch[key] || 0);
    }
    if (patch.damageMultiplier !== undefined) {
        target.damageMultiplier *= Number(patch.damageMultiplier);
    }
}

function runPureResolverHooks(phase, hooks, context, current) {
    if (!RESOLVER_HOOK_PHASES.includes(phase)) throw new Error(`Unknown resolver hook phase: ${phase}`);

    const aggregate = {
        modifiers: {
            physicalPowerBonus: 0,
            finalDamageBonus: 0,
            damageMultiplier: 1,
            criticalBonus: 0,
            criticalAvoidanceBonus: 0,
        },
        commands: [],
        notes: [],
        triggeredEffectIds: [],
    };

    const payload = deepFreeze(clonePlain(current || {}));
    for (const hook of hooks || []) {
        if (!hook || hook.phase !== phase || typeof hook.resolve !== "function") continue;
        const result = hook.resolve(context, payload);
        if (!result) continue;
        mergeModifierPatch(aggregate.modifiers, result.modifiers);
        if (Array.isArray(result.commands)) aggregate.commands.push(...clonePlain(result.commands));
        if (Array.isArray(result.notes)) aggregate.notes.push(...result.notes.map(String));
        if (hook.id) aggregate.triggeredEffectIds.push(hook.id);
    }

    return aggregate;
}

function getEffectiveCourage(unit) {
    const stats = combatPipelineCalcBattleStats(unit);
    return Math.max(0, Number(stats.raw.courage || 0) - Number(unit.battleCourageLoss || 0));
}

function buildUnsupportedPlan(context) {
    return deepFreeze({
        version: COMBAT_PIPELINE_VERSION,
        kind: "shadow",
        requestId: context.request.id,
        contextId: context.id,
        eligible: false,
        ineligibilityReasons: [...context.ineligibilityReasons],
        hit: null,
        critical: null,
        damage: null,
        incapacitation: null,
        commands: [],
        events: [],
        notes: [],
        triggeredEffectIds: [],
        summary: null,
    });
}

function resolveShadowPhysicalAttack(context, options = {}) {
    if (!context?.request) throw new Error("A BattleContext is required");
    if (!context.eligible) return buildUnsupportedPlan(context);

    const rollSource = options.rollSource;
    if (!rollSource || typeof rollSource.nextPercent !== "function") {
        throw new Error("Shadow execution requires an injected roll source");
    }

    const beforeAttack = runPureResolverHooks("beforeAttack", options.hooks, context, {});
    const modifiers = {
        physicalPowerBonus: context.rules.physicalPowerBonus,
        finalDamageBonus: context.rules.finalDamageBonus,
        damageMultiplier: context.rules.damageMultiplier,
        criticalBonus: context.rules.criticalBonus,
        criticalAvoidanceBonus: context.rules.criticalAvoidanceBonus,
    };
    mergeModifierPatch(modifiers, beforeAttack.modifiers);

    const guaranteedHit = context.rules.battleHitMode === "guaranteed";
    const hitRate = guaranteedHit
        ? 100
        : combatPipelineBattleHitRate(
            context.actorStats,
            context.targetStats,
            context.request.attackSkillValue,
            context.rules.evadeSkill,
            {
                accuracy: context.rules.accuracyModifier,
                evasion: context.rules.evasionModifier,
            }
        );
    const hitRoll = guaranteedHit ? null : rollSource.nextPercent("hit");
    const isHit = guaranteedHit || hitRoll <= hitRate;
    const events = [{ type: "hitCheck", rate: hitRate, roll: hitRoll, success: isHit }];
    const commands = [...beforeAttack.commands];
    const notes = [...beforeAttack.notes];
    const triggeredEffectIds = [...beforeAttack.triggeredEffectIds];

    if (!isHit) {
        return deepFreeze({
            version: COMBAT_PIPELINE_VERSION,
            kind: "shadow",
            requestId: context.request.id,
            contextId: context.id,
            eligible: true,
            ineligibilityReasons: [],
            hit: { rate: hitRate, roll: hitRoll, isHit: false },
            critical: null,
            damage: {
                base: 0,
                masteryBonus: 0,
                normal: 0,
                critical: 0,
                applied: 0,
            },
            incapacitation: null,
            commands,
            events,
            notes,
            triggeredEffectIds,
            summary: {
                targetHpBefore: context.target.hp,
                targetHpAfter: context.target.hp,
                displayedDamage: 0,
            },
        });
    }

    const attackValue = context.actorStats.power
        + context.rules.weaponPower
        + context.rules.actorDerivedBonus
        + modifiers.physicalPowerBonus;
    const armorValue = context.targetStats.armor + context.rules.targetDerivedBonus;
    const baseBeforeMastery = combatPipelinePhysicalDamage({ atk: attackValue }, { def: armorValue }, 0);
    const masteryBonus = combatPipelineMasteryDamageBonus(context.actor.skills?.["武道"]);
    const calculatedDamage = baseBeforeMastery + masteryBonus;
    const beforeDamage = runPureResolverHooks("beforeDamage", options.hooks, context, {
        calculatedDamage,
        attackValue,
        armorValue,
    });
    mergeModifierPatch(modifiers, beforeDamage.modifiers);
    commands.push(...beforeDamage.commands);
    notes.push(...beforeDamage.notes);
    triggeredEffectIds.push(...beforeDamage.triggeredEffectIds);

    const normalDamage = Math.max(
        0,
        Math.floor((calculatedDamage + modifiers.finalDamageBonus) * modifiers.damageMultiplier)
    );
    const resolvedCriticalRate = combatPipelineCriticalRate(
        getEffectiveCourage(context.actor),
        context.actor.level,
        context.targetStats.raw.app,
        {
            critical: context.actor.criticalBonus + modifiers.criticalBonus,
            criticalAvoidance: context.target.criticalAvoidanceBonus + modifiers.criticalAvoidanceBonus,
        }
    );
    const criticalRoll = rollSource.nextPercent("critical");
    const isCritical = criticalRoll <= resolvedCriticalRate;
    const calculatedCriticalDamage = combatPipelineCriticalDamage(normalDamage);
    const appliedDamage = isCritical ? calculatedCriticalDamage : normalDamage;
    const hpAfterDamage = Math.max(0, context.target.hp - appliedDamage);

    events.push({
        type: "criticalCheck",
        rate: resolvedCriticalRate,
        roll: criticalRoll,
        success: isCritical,
    });
    events.push({
        type: "damageCalculated",
        normalDamage,
        criticalDamage: calculatedCriticalDamage,
        appliedDamage,
    });
    commands.push({
        type: "setHp",
        unitId: context.target.id,
        from: context.target.hp,
        to: hpAfterDamage,
        reason: "physicalDamage",
    });

    let targetHpAfter = hpAfterDamage;
    let incapacitation = null;
    if (context.target.hp > 2 && hpAfterDamage <= 2 && hpAfterDamage > 0) {
        const rate = context.targetStats.raw.con * 5;
        const roll = rollSource.nextPercent("incapacitation");
        const triggered = roll > rate;
        incapacitation = { rate, roll, triggered };
        events.push({ type: "incapacitationCheck", rate, roll, triggered });
        if (triggered) {
            targetHpAfter = 0;
            commands.push({
                type: "setHp",
                unitId: context.target.id,
                from: hpAfterDamage,
                to: 0,
                reason: "incapacitation",
            });
        }
    }

    return deepFreeze({
        version: COMBAT_PIPELINE_VERSION,
        kind: "shadow",
        requestId: context.request.id,
        contextId: context.id,
        eligible: true,
        ineligibilityReasons: [],
        hit: { rate: hitRate, roll: hitRoll, isHit: true },
        critical: {
            rate: resolvedCriticalRate,
            roll: criticalRoll,
            isCritical,
        },
        damage: {
            base: baseBeforeMastery,
            masteryBonus,
            normal: normalDamage,
            critical: calculatedCriticalDamage,
            applied: appliedDamage,
            attackValue,
            armorValue,
        },
        incapacitation,
        commands,
        events,
        notes,
        triggeredEffectIds,
        summary: {
            targetHpBefore: context.target.hp,
            targetHpAfter,
            displayedDamage: appliedDamage,
        },
    });
}

function compareShadowPlanToLegacy(plan, legacyResult) {
    const fields = [
        ["hit.rate", plan?.hit?.rate, legacyResult?.hit?.rate],
        ["hit.roll", plan?.hit?.roll, legacyResult?.hit?.roll],
        ["hit.isHit", plan?.hit?.isHit, legacyResult?.hit?.isHit],
        ["damage.attackValue", plan?.damage?.attackValue ?? null, legacyResult?.damage?.attackValue ?? null],
        ["damage.armorValue", plan?.damage?.armorValue ?? null, legacyResult?.damage?.armorValue ?? null],
        ["damage.base", plan?.damage?.base ?? 0, legacyResult?.damage?.base ?? 0],
        ["damage.masteryBonus", plan?.damage?.masteryBonus ?? 0, legacyResult?.damage?.masteryBonus ?? 0],
        ["critical.rate", plan?.critical?.rate ?? null, legacyResult?.critical?.rate ?? null],
        ["critical.roll", plan?.critical?.roll ?? null, legacyResult?.critical?.roll ?? null],
        ["critical.isCritical", plan?.critical?.isCritical ?? null, legacyResult?.critical?.isCritical ?? null],
        ["damage.normal", plan?.damage?.normal ?? 0, legacyResult?.damage?.normal ?? 0],
        ["damage.critical", plan?.damage?.critical ?? 0, legacyResult?.damage?.critical ?? 0],
        ["damage.applied", plan?.damage?.applied ?? 0, legacyResult?.damage?.applied ?? 0],
        ["commands", JSON.stringify(plan?.commands || []), JSON.stringify(legacyResult?.commands || [])],
        ["summary.targetHpAfter", plan?.summary?.targetHpAfter, legacyResult?.summary?.targetHpAfter],
        ["incapacitation.rate", plan?.incapacitation?.rate ?? null, legacyResult?.incapacitation?.rate ?? null],
        ["incapacitation.roll", plan?.incapacitation?.roll ?? null, legacyResult?.incapacitation?.roll ?? null],
        ["incapacitation.triggered", plan?.incapacitation?.triggered ?? null, legacyResult?.incapacitation?.triggered ?? null],
    ];

    return fields
        .filter(([, shadowValue, legacyValue]) => !Object.is(shadowValue, legacyValue))
        .map(([field, shadowValue, legacyValue]) => ({ field, shadowValue, legacyValue }));
}

const exported = {
    COMBAT_PIPELINE_VERSION,
    BASIC_PHYSICAL_ACTION,
    RESOLVER_HOOK_PHASES,
    createBattleActionRequest,
    createBattleContext,
    createFixedRollSource,
    createRandomRollSource,
    runPureResolverHooks,
    resolveShadowPhysicalAttack,
    compareShadowPlanToLegacy,
};

if (typeof module !== "undefined") module.exports = exported;
