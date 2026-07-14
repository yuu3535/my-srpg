// =====================================================================
// battleDefinitions.js - Battle content shared by story and test entries
// =====================================================================

const BATTLE_DEFINITIONS = Object.freeze({
    battle_tutorial: {
        uiTheme: "orcus",
        background: "背景/オルクス魔王城鍛錬場.png",
        cols: 7,
        rows: 8,
        tiles: [],
        passive: true,
        victory: { type: "defeatAll" },
        defeat: { type: "allAlliesDefeated" },
        mapItems: [
            { x: 3, y: 4, item: { id: "small_potion", name: "ポーション小", type: "heal", value: 5 } },
        ],
        unitIds: ["young_arshe", "young_karima", "gunter"],
        positions: {
            young_arshe:  { x: 2, y: 6 },
            young_karima: { x: 4, y: 6 },
            gunter:       { x: 3, y: 1 },
        },
    },
    battle_ch1: {
        uiTheme: "mixed",
        background: "assets/background_forest.png",
        cols: 12,
        rows: 8,
        tiles: [],
        victory: { type: "defeatAll" },
        defeat: { type: "allAlliesDefeated" },
        unitIds: ["ringholm", "arshe", "albas", "forest_guard", "dylan", "herel"],
        positions: {
            ringholm:     { x: 3, y: 6 },
            arshe:        { x: 4, y: 6 },
            albas:        { x: 5, y: 6 },
            forest_guard: { x: 6, y: 1 },
            dylan:        { x: 7, y: 1 },
            herel:        { x: 8, y: 2 },
        },
    },
});

if (typeof module !== "undefined") {
    module.exports = BATTLE_DEFINITIONS;
}
