// =====================================================================
// cloneBattleExecutor.js - Clone-only BattlePlan executor prototype
//
// This module never writes to live battle state. It clones the supplied
// units, applies supported commands in order, and returns the cloned result.
// =====================================================================

const CLONE_BATTLE_EXECUTOR_VERSION = 1;

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

function buildFailure(reason, baselineUnits, details = {}) {
    return deepFreeze({
        version: CLONE_BATTLE_EXECUTOR_VERSION,
        kind: "clone-execution",
        ok: false,
        reason,
        rolledBack: true,
        appliedCommands: [],
        units: clonePlain(baselineUnits),
        ...clonePlain(details),
    });
}

function executeBattlePlanOnClones(plan, sourceUnits) {
    if (!Array.isArray(sourceUnits)) {
        throw new Error("Clone BattleExecutor requires an array of source units");
    }

    const baselineUnits = clonePlain(sourceUnits);
    const workingUnits = clonePlain(sourceUnits);
    const unitById = new Map();

    for (const unit of workingUnits) {
        if (!unit?.id) return buildFailure("invalid-unit", baselineUnits, { unitId: unit?.id ?? null });
        if (unitById.has(unit.id)) return buildFailure("duplicate-unit-id", baselineUnits, { unitId: unit.id });
        unitById.set(unit.id, unit);
    }

    if (!plan || plan.eligible !== true) {
        return buildFailure("ineligible-plan", baselineUnits, {
            ineligibilityReasons: [...(plan?.ineligibilityReasons || [])],
        });
    }
    if (!Array.isArray(plan.commands)) {
        return buildFailure("invalid-command-list", baselineUnits);
    }

    const appliedCommands = [];
    for (let commandIndex = 0; commandIndex < plan.commands.length; commandIndex += 1) {
        const command = plan.commands[commandIndex];
        if (!command || command.type !== "setHp") {
            return buildFailure("unsupported-command", baselineUnits, {
                commandIndex,
                commandType: command?.type ?? null,
            });
        }

        const unit = unitById.get(command.unitId);
        if (!unit) {
            return buildFailure("unit-not-found", baselineUnits, {
                commandIndex,
                unitId: command.unitId ?? null,
            });
        }
        if (!Number.isFinite(command.from) || !Number.isFinite(command.to)) {
            return buildFailure("invalid-command-value", baselineUnits, {
                commandIndex,
                unitId: command.unitId,
                from: command.from,
                to: command.to,
            });
        }
        if (!Object.is(unit.hp, command.from)) {
            return buildFailure("state-mismatch", baselineUnits, {
                commandIndex,
                unitId: command.unitId,
                field: "hp",
                expected: command.from,
                actual: unit.hp,
            });
        }

        unit.hp = command.to;
        appliedCommands.push({
            index: commandIndex,
            type: command.type,
            unitId: command.unitId,
            from: command.from,
            to: command.to,
            reason: command.reason || null,
        });
    }

    return deepFreeze({
        version: CLONE_BATTLE_EXECUTOR_VERSION,
        kind: "clone-execution",
        ok: true,
        reason: null,
        rolledBack: false,
        appliedCommands,
        units: workingUnits,
    });
}

if (typeof module !== "undefined") {
    module.exports = {
        CLONE_BATTLE_EXECUTOR_VERSION,
        executeBattlePlanOnClones,
    };
}
