const assert = require("node:assert/strict");

const {
    createBattleActionContext,
    registerBattleActionHook,
    runBattleActionHooks,
} = require("../battleHooks.js");

const context = createBattleActionContext({
    attacker: { id: "attacker" },
    targets: [{ id: "target-a" }, { id: "target-b" }],
    damageType: "physical",
    combatArtId: "test_art",
    hit: { rate: 80, roll: 12, isHit: true },
});

let triggerCount = 0;
registerBattleActionHook("beforeAttack", {
    id: "test:once",
    oncePerAction: true,
    run(ctx) {
        triggerCount += 1;
        ctx.modifiers.physicalPowerBonus += 5;
        ctx.usageCounts.test_art = (ctx.usageCounts.test_art || 0) + 1;
        return true;
    },
});

runBattleActionHooks("beforeAttack", context);
runBattleActionHooks("beforeAttack", context);

assert.equal(triggerCount, 1, "oncePerAction hook triggers only once per action");
assert.equal(context.modifiers.physicalPowerBonus, 5, "hook modifier is applied once");
assert.equal(context.usageCounts.test_art, 1, "usage count is held on the context");
assert.deepEqual(context.triggeredEffectIds, ["test:once"], "triggered effects are recorded");
assert.equal(context.targets.length, 2, "context keeps the target list");
assert.equal(context.hit.rate, 80, "context keeps hit data");

console.log("battleHooks tests passed");
