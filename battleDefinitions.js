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
    // 採用版ステータスの試験専用（trial/adopted-stats）。DEBUGの「テスト戦闘」だけから起動する。
    // battle_ch1 と同じ構成に幼カリマを加えた。シナリオ本編からは参照しない。
    battle_trial_adopted: {
        uiTheme: "mixed",
        background: "assets/background_forest.png",
        cols: 12,
        rows: 8,
        tiles: [],
        trialRules: "adopted-stats-v1",
        // 出撃ルール（機能の確認用の仮の値。本編の値はシナリオを作る段階で決める）
        //   forced: 必ず出撃するキャラ / max: 最大出撃人数 / deployTiles: 出撃位置に使えるマス（省略時は味方の初期位置）
        sortie: {
            forced: ["arshe"],
            max: 4,
            deployTiles: [
                { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
                { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 3, y: 7 }, { x: 5, y: 7 },
            ],
        },
        victory: { type: "defeatAll" },
        defeat: { type: "allAlliesDefeated" },
        unitIds: ["ringholm", "arshe", "albas", "young_karima", "forest_guard", "dylan", "herel"],
        // 既存のキャラを複製して置く（id: { from: 元のキャラ, 上書きする項目 }）。
        // アルバス同士で破壊・反撃を試すため、敵のアルバスを置く（原作者 2026-09-25）
        unitCopies: {
            albas_rival: { from: "albas", side: "enemy", name: "アルバス（敵）" },
        },
        positions: {
            ringholm:     { x: 3, y: 6 },
            arshe:        { x: 4, y: 6 },
            albas:        { x: 5, y: 6 },
            young_karima: { x: 6, y: 6 },
            forest_guard: { x: 6, y: 1 },
            dylan:        { x: 7, y: 1 },
            herel:        { x: 8, y: 2 },
            albas_rival:  { x: 5, y: 2 },
        },
    },
});

if (typeof module !== "undefined") {
    module.exports = BATTLE_DEFINITIONS;
}
