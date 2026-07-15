// =====================================================================
// partyState.js - Persistent player resources across story battles
// =====================================================================

const PARTY_STATE_VERSION = 1;

function clonePartyItems(items) {
    return Array.isArray(items)
        ? items.map(item => item && typeof item === "object" ? { ...item } : item)
        : [];
}

function cloneStringList(values) {
    return Array.isArray(values) ? [...values] : [];
}

function clampPartyResource(value, fallback, max) {
    const resolved = Number.isFinite(Number(value)) ? Number(value) : fallback;
    return Math.max(0, Math.min(max, Math.floor(resolved)));
}

function createPartyState(characters, statCalculator, savedState = null) {
    const savedMembers = savedState?.members && typeof savedState.members === "object"
        ? savedState.members
        : {};
    const members = {};

    for (const character of characters.filter(unit => unit.side === "ally")) {
        const saved = savedMembers[character.id] || {};
        const level = Number.isInteger(saved.level) && saved.level > 0
            ? saved.level
            : character.level;
        const leveledCharacter = { ...character, level };
        const stats = statCalculator(leveledCharacter);

        members[character.id] = {
            level,
            hp: clampPartyResource(saved.hp, stats.hp, stats.hp),
            mp: clampPartyResource(saved.mp, stats.mp, stats.mp),
            items: clonePartyItems(saved.items ?? character.items),
            skillRanks: { ...(saved.skillRanks || {}) },
            learnedArts: cloneStringList(saved.learnedArts ?? character.learnedArts),
            equippedArts: cloneStringList(saved.equippedArts ?? character.equippedArts),
            learnedPassives: cloneStringList(saved.learnedPassives ?? character.learnedPassives),
            equippedPassives: cloneStringList(saved.equippedPassives ?? character.equippedPassives),
            buildChoices: saved.buildChoices && typeof saved.buildChoices === "object"
                ? { ...saved.buildChoices }
                : { ...(character.buildChoices || {}) },
        };
    }

    return { version: PARTY_STATE_VERSION, members };
}

function getPartyBattleResources(partyState, character, battleStats, enabled) {
    const member = enabled ? partyState?.members?.[character.id] : null;
    if (!member) {
        return {
            level: character.level,
            hp: battleStats.hp,
            mp: battleStats.mp,
            items: clonePartyItems(character.items),
            learnedArts: cloneStringList(character.learnedArts),
            equippedArts: cloneStringList(character.equippedArts),
            learnedPassives: cloneStringList(character.learnedPassives),
            equippedPassives: cloneStringList(character.equippedPassives),
            buildChoices: { ...(character.buildChoices || {}) },
        };
    }

    return {
        level: member.level,
        hp: Math.max(1, clampPartyResource(member.hp, battleStats.hp, battleStats.hp)),
        mp: clampPartyResource(member.mp, battleStats.mp, battleStats.mp),
        items: clonePartyItems(member.items),
        learnedArts: cloneStringList(member.learnedArts),
        equippedArts: cloneStringList(member.equippedArts),
        learnedPassives: cloneStringList(member.learnedPassives),
        equippedPassives: cloneStringList(member.equippedPassives),
        buildChoices: { ...(member.buildChoices || {}) },
    };
}

function updatePartyStateFromBattle(partyState, battleUnits) {
    if (!partyState?.members) return partyState;

    for (const unit of battleUnits.filter(candidate => candidate.side === "ally")) {
        const member = partyState.members[unit.id];
        if (!member) continue;
        member.level = unit.level;
        member.hp = Math.max(0, Math.floor(unit.hp));
        member.mp = Math.max(0, Math.floor(unit.mp));
        member.items = clonePartyItems(unit.items);
        member.learnedArts = cloneStringList(unit.learnedArts);
        member.equippedArts = cloneStringList(unit.equippedArts);
        member.learnedPassives = cloneStringList(unit.learnedPassives);
        member.equippedPassives = cloneStringList(unit.equippedPassives);
        member.buildChoices = { ...(unit.buildChoices || {}) };
    }
    return partyState;
}

function clonePartyState(partyState) {
    if (!partyState?.members) return { version: PARTY_STATE_VERSION, members: {} };
    const members = {};
    for (const [id, member] of Object.entries(partyState.members)) {
        members[id] = {
            ...member,
            items: clonePartyItems(member.items),
            skillRanks: { ...(member.skillRanks || {}) },
            learnedArts: cloneStringList(member.learnedArts),
            equippedArts: cloneStringList(member.equippedArts),
            learnedPassives: cloneStringList(member.learnedPassives),
            equippedPassives: cloneStringList(member.equippedPassives),
            buildChoices: { ...(member.buildChoices || {}) },
        };
    }
    return { version: PARTY_STATE_VERSION, members };
}

if (typeof module !== "undefined") {
    module.exports = {
        PARTY_STATE_VERSION,
        createPartyState,
        getPartyBattleResources,
        updatePartyStateFromBattle,
        clonePartyState,
    };
}
