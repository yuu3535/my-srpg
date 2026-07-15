// ============================================================
//  battleHooks.js - Battle action context and hook dispatcher
// ============================================================

const BATTLE_HOOK_NAMES = Object.freeze([
    "beforeAttack",
    "beforeDamaged",
    "afterDamage",
    "afterAttack",
    "onKill",
]);

const BATTLE_ACTION_HOOKS = Object.fromEntries(
    BATTLE_HOOK_NAMES.map(name => [name, []])
);

let battleActionContextSeq = 0;

function createBattleActionContext(input = {}) {
    const targets = Array.isArray(input.targets)
        ? input.targets.filter(Boolean)
        : [input.target].filter(Boolean);

    return {
        id: `battle-action-${++battleActionContextSeq}`,
        attacker: input.attacker || null,
        target: input.target || targets[0] || null,
        targets,
        actionType: input.actionType || "attack",
        damageType: input.damageType || "physical",
        isMagic: !!input.isMagic,
        isCounter: !!input.isCounter,
        isPreview: !!input.isPreview,
        spell: input.spell || null,
        combatArtId: input.combatArtId || null,
        combatArt: input.combatArt || null,
        attackSkillName: input.attackSkillName || null,
        attackSkillValue: input.attackSkillValue ?? null,
        half: !!input.half,
        hit: input.hit || null,
        critical: null,
        damage: {
            baseDamage: 0,
            finalDamage: 0,
            criticalDamage: 0,
            actualDamage: 0,
            baseAfterBarrier: 0,
            critAfterBarrier: 0,
        },
        targetResults: [],
        usageCounts: {},
        triggeredEffects: new Set(),
        triggeredEffectIds: [],
        modifiers: {
            physicalPowerBonus: 0,
            magicPowerBonus: 0,
            finalDamageBonus: 0,
            damageMultiplier: 1,
            criticalBonus: 0,
            criticalAvoidanceBonus: 0,
        },
        notes: [],
    };
}

function registerBattleActionHook(name, hook) {
    if (!BATTLE_ACTION_HOOKS[name]) {
        throw new Error(`Unknown battle action hook: ${name}`);
    }
    if (!hook || typeof hook.run !== "function") {
        throw new Error(`Battle action hook ${name} requires a run(context, payload) function`);
    }
    BATTLE_ACTION_HOOKS[name].push(hook);
}

function wasBattleEffectTriggered(context, effectId) {
    return !!context?.triggeredEffects?.has(effectId);
}

function markBattleEffectTriggered(context, effectId) {
    if (!context || !effectId || wasBattleEffectTriggered(context, effectId)) return false;
    context.triggeredEffects.add(effectId);
    context.triggeredEffectIds.push(effectId);
    return true;
}

function runBattleActionHooks(name, context, payload = {}) {
    const hooks = BATTLE_ACTION_HOOKS[name] || [];
    for (const hook of hooks) {
        const effectId = hook.id || `${name}:${hooks.indexOf(hook)}`;
        if (hook.oncePerAction && wasBattleEffectTriggered(context, effectId)) continue;
        const didApply = hook.run(context, payload);
        if (didApply !== false && hook.oncePerAction) {
            markBattleEffectTriggered(context, effectId);
        }
    }
    return context;
}

if (typeof module !== "undefined") {
    module.exports = {
        BATTLE_HOOK_NAMES,
        BATTLE_ACTION_HOOKS,
        createBattleActionContext,
        registerBattleActionHook,
        runBattleActionHooks,
        markBattleEffectTriggered,
        wasBattleEffectTriggered,
    };
}
