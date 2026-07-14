const assert = require("node:assert/strict");
const characters = require("../characters.js");
const { calcBattleStats } = require("../statConversion.js");
const {
    createPartyState,
    getPartyBattleResources,
    updatePartyStateFromBattle,
    clonePartyState,
} = require("../partyState.js");

const state = createPartyState(characters, calcBattleStats);
const ringholm = characters.find(unit => unit.id === "ringholm");
const ringholmStats = calcBattleStats(ringholm);

assert.equal(state.members.ringholm.hp, 23, "new party starts at full HP");
assert.equal(state.members.ringholm.mp, 28, "new party starts at full MP");
assert.ok(!state.members.forest_guard, "enemies are not party members");

updatePartyStateFromBattle(state, [{
    ...ringholm,
    hp: 7,
    mp: 4,
    items: [{ id: "small_potion", name: "Potion" }],
}]);
const restored = getPartyBattleResources(state, ringholm, ringholmStats, true);
assert.equal(restored.hp, 7, "story battle carries HP");
assert.equal(restored.mp, 4, "story battle carries MP");
assert.equal(restored.items.length, 1, "story battle carries items");

const testResources = getPartyBattleResources(state, ringholm, ringholmStats, false);
assert.equal(testResources.hp, 23, "test battle starts at full HP");
assert.equal(testResources.mp, 28, "test battle starts at full MP");
assert.equal(testResources.items.length, 0, "test battle ignores party inventory");

state.members.ringholm.hp = 0;
assert.equal(getPartyBattleResources(state, ringholm, ringholmStats, true).hp, 1,
    "incapacitated member provisionally returns at 1 HP");

const saved = clonePartyState(state);
saved.members.ringholm.items.push({ id: "copy_test" });
assert.equal(state.members.ringholm.items.length, 1, "save snapshot does not share item arrays");

const legacyLoaded = createPartyState(characters, calcBattleStats, null);
assert.equal(legacyLoaded.members.albas.hp, 28, "legacy save fallback creates defaults");

console.log("partyState: all tests passed");
