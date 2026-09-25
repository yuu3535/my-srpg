const assert = require("node:assert/strict");
const characters = require("../characters.js");
const { calcBattleStats } = require("../statConversion.js");
const {
    createPartyState,
    getPartyBattleResources,
    updatePartyStateFromBattle,
    clonePartyState,
    getPartyLoadout,
    setPartyLoadout,
    getPartyGear,
    setPartyGear,
    getPartyStock,
    setPartyStock,
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

const loadedBuild = createPartyState(characters, calcBattleStats, {
    members: {
        ringholm: {
            learnedArts: ["ryoudan"],
            equippedArts: ["ryoudan"],
            learnedPassives: ["zanshin"],
            equippedPassives: ["zanshin"],
            buildChoices: { evasion: "zetsuei" },
        },
    },
});
assert.deepEqual(loadedBuild.members.ringholm.learnedArts, ["ryoudan"], "learned arts are restored");
assert.deepEqual(loadedBuild.members.ringholm.equippedArts, ["ryoudan"], "equipped arts are restored");
assert.deepEqual(loadedBuild.members.ringholm.learnedPassives, ["zanshin"], "learned passives are restored");
assert.deepEqual(loadedBuild.members.ringholm.equippedPassives, ["zanshin"], "equipped passives are restored");
assert.equal(loadedBuild.members.ringholm.buildChoices.evasion, "zetsuei", "build choices are restored");

const buildResources = getPartyBattleResources(loadedBuild, ringholm, ringholmStats, true);
assert.deepEqual(buildResources.equippedArts, ["ryoudan"], "battle resources carry equipped arts");
assert.deepEqual(buildResources.equippedPassives, ["zanshin"], "battle resources carry equipped passives");
assert.equal(buildResources.buildChoices.evasion, "zetsuei", "battle resources carry build choices");

const buildSnapshot = clonePartyState(loadedBuild);
buildSnapshot.members.ringholm.equippedPassives.push("copy_test");
buildSnapshot.members.ringholm.buildChoices.evasion = "copy_changed";
assert.deepEqual(loadedBuild.members.ringholm.equippedPassives, ["zanshin"],
    "save snapshot does not share passive arrays");
assert.equal(loadedBuild.members.ringholm.buildChoices.evasion, "zetsuei",
    "save snapshot does not share build choices");

console.log("partyState: all tests passed");

// 身支度のセット内容はパーティ状態に入り、セーブ（clone → 復元）で残る
const gearState = createPartyState(characters, calcBattleStats);
assert.equal(getPartyLoadout(gearState, "ringholm"), null, "loadout starts unset");
assert.equal(setPartyLoadout(gearState, "ringholm", { causeSkills: ["黒の一族", "剣の舞"], combatArts: ["復讐"] }), true);
assert.equal(setPartyLoadout(gearState, "forest_guard", { causeSkills: [] }), false, "enemies have no loadout");
const gearSaved = JSON.parse(JSON.stringify(clonePartyState(gearState)));
const gearLoaded = createPartyState(characters, calcBattleStats, gearSaved);
assert.deepEqual(getPartyLoadout(gearLoaded, "ringholm"), { causeSkills: ["黒の一族", "剣の舞"], combatArts: ["復讐"] },
    "loadout survives save and load");
const gearCopy = getPartyLoadout(gearLoaded, "ringholm");
gearCopy.causeSkills.push("死神");
assert.equal(getPartyLoadout(gearLoaded, "ringholm").causeSkills.length, 2, "reads return copies");

// 持ち物・装備と共有の持ち物も、セーブ（clone → 復元）で残る
assert.equal(getPartyGear(gearState, "albas"), null, "gear starts unset");
assert.equal(getPartyStock(gearState), null, "stock starts unset");
setPartyGear(gearState, "ringholm", { items: ["trial_sword", "albas_sword"], equipped: "albas_sword" });
setPartyStock(gearState, ["fire_book"]);
const gearLoaded2 = createPartyState(characters, calcBattleStats, JSON.parse(JSON.stringify(clonePartyState(gearState))));
assert.deepEqual(getPartyGear(gearLoaded2, "ringholm"), { items: ["trial_sword", "albas_sword"], equipped: "albas_sword" });
assert.deepEqual(getPartyStock(gearLoaded2), ["fire_book"]);
assert.equal(getPartyGear(gearLoaded2, "ringholm").equipped, "albas_sword");
setPartyGear(gearState, "arshe", { items: ["fire_book"], equipped: "missing" });
assert.equal(getPartyGear(gearState, "arshe").equipped, null, "cannot equip an item the member does not carry");
