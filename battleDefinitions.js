// =====================================================================
// battleDefinitions.js - Battle content shared by story and test entries
// =====================================================================

// 訓練人形の仮の絵（盤面・立ち絵とも同じ絵。立ち絵の欄は全身が入るように）
const TRAINING_DOLL_ART = name => ({
    tokenImage: `unity-prototype/Assets/Art/SD/${name}.png`,
    portraitImage: `unity-prototype/Assets/Art/SD/${name}.png`,
    portraitImageDamaged: `unity-prototype/Assets/Art/SD/${name}.png`,
    portraitBgSize: "contain", portraitBgPos: "center bottom",
    portraitDmgBgSize: "contain", portraitDmgBgPos: "center bottom",
});

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
    // プロローグ1-1 の訓練（Unity版の本編。シナリオ「シナリオプロローグ1-1」68〜75行。原作者 2026-09-28）。
    // 案と決定: docs/30-planning/PROLOGUE_TRAINING_BATTLE_TUTORIAL_PROPOSAL_2026-09-28.md
    //   能力値は採用版の因果Lv1（trialStatSystem.js の TRIAL_PROFILES・TRIAL_BATTLE_SETUPS）。ギュンターはチュートリアル仕様
    //   盤面は訓練場の戦う範囲（配置表 orcus_training_yard の x8〜14・y6〜13）。ここでの座標は範囲の左上 (8,6) を (0,0) にしたもの
    //   ポーションは落ちていない。アルシェのツノをカリマに渡し、ポーションをもらう（交換の手引き）
    // ブラウザ版では DEBUG から試すだけ（ブラウザ版のプロローグは battle_tutorial のまま）
    battle_prologue_training: {
        uiTheme: "orcus",
        background: "背景/オルクス魔王城鍛錬場.png",
        cols: 7,
        rows: 8,
        tiles: [],
        trialRules: "adopted-stats-v1",
        victory: { type: "defeatAll" },
        defeat: { type: "allAlliesDefeated" },
        timeOfDay: "morning",
        // Unity版の戦況の画面の文。ギュンターは手加減する（原作者 2026-09-28: 動くが手加減。子どものHPは1より下がらない＝寸止め。負けはない）
        title: "訓練",
        // 2段（原作者 2026-10-02）: 1段目＝訓練人形（ラディン製）で剣・魔法・反撃・交換と回復を覚える → 人形を全部倒すと
        //   2段目＝ギュンターが入ってくる（行動予告・戦技）。reserve: 最初は盤面にいない（ほかの敵を全部倒すと出る。Unity版）
        //   passive: 自分からは動かない・攻撃しない（反撃はする）。ブラウザ版はこの2つに対応していない（Unity への書き出し用）
        victoryText: "訓練人形を倒し、ギュンターから一本取る（HPを0にする）",
        defeatText: "なし（訓練。ギュンターは寸止めする）",
        mercy: true,
        // 最初から持っている消耗品（Unity版の交換で渡す。ブラウザ版には交換がないので、ここは Unity への書き出しだけで使う）
        unitItems: {
            young_arshe:  [{ id: "horn", name: "ツノ", type: "key", value: 0 }],
            young_karima: [{ id: "small_potion", name: "ポーション", type: "heal", value: 5 }],
        },
        unitIds: ["young_arshe", "young_karima", "gunter"],
        // 訓練人形: ギュンターの複製に、人形の仮の絵（unity-prototype/Assets/Art/SD/training_doll*.png。原作者の絵ができたら差し替え）
        unitCopies: {
            training_doll_1:       { from: "gunter", name: "訓練人形", move: 0, ...TRAINING_DOLL_ART("training_doll") },
            training_doll_2:       { from: "gunter", name: "訓練人形", move: 0, ...TRAINING_DOLL_ART("training_doll") },
            training_doll_counter: { from: "gunter", name: "反撃人形", move: 0, ...TRAINING_DOLL_ART("training_doll_counter") },
        },
        reserve: ["gunter"],
        passive: ["training_doll_1", "training_doll_2", "training_doll_counter"],
        positions: {
            young_arshe:  { x: 2, y: 6 },
            young_karima: { x: 3, y: 6 },
            gunter:       { x: 3, y: 1 },
            training_doll_1:       { x: 1, y: 3 },
            training_doll_2:       { x: 3, y: 3 },
            training_doll_counter: { x: 5, y: 4 },
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
        // 斜め見下ろし（アイソメトリック）の表示の試し（原作者 2026-09-26）。
        //   image: マス目に合わせて描いたマップ絵 / tileW: 絵の上の菱形1マスの横幅(px) / originX・originY: マス(0,0)の菱形の上の頂点
        //   width・height: 絵の大きさ。値は tools/make_iso_map.py が出す。「視点」ボタンで真上からの表示に切り替えられる
        isoView: { image: "assets/maps/iso_trial_12x8.png", tileW: 128, originX: 608, originY: 96, width: 1472, height: 880 },
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
        // 3Dの盤面の時間帯（Unity版）: day＝明るい昼 / dusk＝暗めの琥珀色（原作者 2026-09-27: 明るいマップチップに合わせて昼）
        timeOfDay: "day",
        // 持ち物（消耗品）を試すため、拾える物を1つ置く（原作者 2026-09-27）
        mapItems: [
            { x: 2, y: 5, item: { id: "small_potion", name: "ポーション小", type: "heal", value: 5 } },
        ],
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
