// =====================================================================
// combatShadowComparison.js - Legacy-authoritative live shadow comparison
//
// The legacy path owns every random draw and every live state change.
// This module only records those draws, replays them into the Shadow
// Resolver, and compares the resulting BattlePlan with the legacy result.
// =====================================================================

const CombatShadowPipeline = typeof module !== "undefined" && module.exports
    ? require("./combatPipeline.js")
    : globalThis;

const shadowBasicPhysicalAction = CombatShadowPipeline.BASIC_PHYSICAL_ACTION;
const shadowCreateBattleActionRequest = CombatShadowPipeline.createBattleActionRequest;
const shadowCreateBattleContext = CombatShadowPipeline.createBattleContext;
const shadowResolvePhysicalAttack = CombatShadowPipeline.resolveShadowPhysicalAttack;
const shadowComparePlanToLegacy = CombatShadowPipeline.compareShadowPlanToLegacy;

function cloneShadowValue(value) {
    if (Array.isArray(value)) return value.map(cloneShadowValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, cloneShadowValue(entry)])
        );
    }
    return value;
}

function freezeShadowValue(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const entry of Object.values(value)) freezeShadowValue(entry);
    return Object.freeze(value);
}

function createRecordingPercentRollSource(random = Math.random) {
    if (typeof random !== "function") throw new Error("A random function is required");
    const records = [];

    return Object.freeze({
        nextPercent(label = "roll") {
            const value = Math.floor(random() * 100) + 1;
            records.push({ label, value });
            return value;
        },
        getRecords() {
            return freezeShadowValue(cloneShadowValue(records));
        },
    });
}

function createRecordedPercentRollSource(records = []) {
    const queue = cloneShadowValue(records);
    let index = 0;

    return Object.freeze({
        nextPercent(label = "roll") {
            if (index >= queue.length) throw new Error(`No recorded roll remains for ${label}`);
            const record = queue[index++];
            if (record.label !== label) {
                throw new Error(`Recorded roll order mismatch: expected ${record.label}, requested ${label}`);
            }
            return record.value;
        },
        getConsumedCount() {
            return index;
        },
        getRemainingCount() {
            return queue.length - index;
        },
    });
}

function beginLivePhysicalShadowComparison(input = {}) {
    const request = shadowCreateBattleActionRequest({
        id: input.id,
        source: input.source || "live-shadow-comparison",
        actionType: input.actionType || shadowBasicPhysicalAction,
        actorId: input.actor?.id,
        targetId: input.target?.id,
        attackSkillName: input.attackSkillName,
        attackSkillValue: input.attackSkillValue,
        combatArtId: input.combatArtId || null,
        spellId: null,
        isCounter: false,
        includeCounter: false,
        includeFollowUp: false,
        halfDamage: false,
    });
    const context = shadowCreateBattleContext({
        request,
        actor: input.actor,
        target: input.target,
        weaponPower: input.weaponPower,
        battleHitMode: input.battleHitMode || "normal",
    });

    if (!context.eligible) {
        return freezeShadowValue({
            eligible: false,
            requestId: request.id,
            ineligibilityReasons: [...context.ineligibilityReasons],
        });
    }

    return Object.freeze({
        eligible: true,
        requestId: request.id,
        context,
        rollSource: createRecordingPercentRollSource(input.random),
    });
}

function finishLivePhysicalShadowComparison(session, legacyResult) {
    if (!session?.eligible) {
        return freezeShadowValue({
            compared: false,
            matches: null,
            requestId: session?.requestId || null,
            reason: "ineligible-session",
            ineligibilityReasons: [...(session?.ineligibilityReasons || [])],
        });
    }

    const rolls = session.rollSource.getRecords();
    const replaySource = createRecordedPercentRollSource(rolls);
    const plan = shadowResolvePhysicalAttack(session.context, { rollSource: replaySource });
    const differences = shadowComparePlanToLegacy(plan, legacyResult);
    if (replaySource.getRemainingCount() !== 0) {
        differences.push({
            field: "rolls.remaining",
            shadowValue: replaySource.getRemainingCount(),
            legacyValue: 0,
        });
    }

    return freezeShadowValue({
        compared: true,
        matches: differences.length === 0,
        requestId: session.requestId,
        rolls,
        differences,
        plan,
        legacyResult: cloneShadowValue(legacyResult),
    });
}

const combatShadowComparisonExports = {
    createRecordingPercentRollSource,
    createRecordedPercentRollSource,
    beginLivePhysicalShadowComparison,
    finishLivePhysicalShadowComparison,
};

if (typeof module !== "undefined") module.exports = combatShadowComparisonExports;
