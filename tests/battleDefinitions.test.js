const assert = require("node:assert/strict");
const battleDefinitions = require("../battleDefinitions.js");
const characters = require("../characters.js");

const characterIds = new Set(characters.map(character => character.id));
const allowedVictoryTypes = new Set(["defeatAll"]);
const allowedDefeatTypes = new Set(["allAlliesDefeated"]);

for (const [battleId, definition] of Object.entries(battleDefinitions)) {
    assert.ok(Number.isInteger(definition.cols) && definition.cols > 0, `${battleId}.cols`);
    assert.ok(Number.isInteger(definition.rows) && definition.rows > 0, `${battleId}.rows`);
    assert.ok(Array.isArray(definition.unitIds) && definition.unitIds.length > 0, `${battleId}.unitIds`);
    assert.equal(new Set(definition.unitIds).size, definition.unitIds.length, `${battleId} has duplicate units`);
    assert.ok(allowedVictoryTypes.has(definition.victory?.type), `${battleId}.victory.type`);
    assert.ok(allowedDefeatTypes.has(definition.defeat?.type), `${battleId}.defeat.type`);

    const occupied = new Set();
    for (const unitId of definition.unitIds) {
        assert.ok(characterIds.has(unitId), `${battleId} references unknown unit ${unitId}`);
        const position = definition.positions?.[unitId];
        assert.ok(position, `${battleId}.${unitId} has a position`);
        assert.ok(position.x >= 0 && position.x < definition.cols, `${battleId}.${unitId}.x`);
        assert.ok(position.y >= 0 && position.y < definition.rows, `${battleId}.${unitId}.y`);
        const key = `${position.x},${position.y}`;
        assert.ok(!occupied.has(key), `${battleId} has overlapping units at ${key}`);
        occupied.add(key);
    }

    for (const mapItem of definition.mapItems || []) {
        assert.ok(mapItem.x >= 0 && mapItem.x < definition.cols, `${battleId} map item x`);
        assert.ok(mapItem.y >= 0 && mapItem.y < definition.rows, `${battleId} map item y`);
        assert.ok(mapItem.item?.id, `${battleId} map item id`);
    }
}

console.log("battleDefinitions: all tests passed");
