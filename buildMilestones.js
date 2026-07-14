// ============================================================
//  buildMilestones.js ― 修練度トラック定義（純粋データ）
//
//  設計: COMBAT_ARTS_DESIGN.md §4・§11 / SYNC_AGENDA.md §3
//  各特技は修練度1〜9のトラックを持ち、1段=1取得スロット。
//
//  ranks[n] の形:
//    { bonus: {...} }                     … 補正のみの段
//    { bonus: {...}, art: "id" }          … 節目: 補正 or 戦技 の排他択一
//    { bonus: {...}, passive: "id" }      … 節目: 補正 or パッシブ の排他択一
//    { art: "id" } / { passive: "id" }    … 習得特化型トラックの段（補正なし）
//    null                                 … 取得なし（×）
//
//  選択の記録は partyState.members[id].buildChoices
//  （例 { "武器:6": "art", "武器:9": "bonus" }・振り直しでリセット）
//
//  修練度のスケールは1〜9（skillRanks が正典。SYNC合意）
//  補正値は原案ママ・バランス未調整
// ============================================================

const BUILD_MILESTONES = {

    // ── 補正積み上げ型: 毎段+5%、節目で二者択一 ──
    武器: {
        type: "cumulative",
        ranks: {
            1: { bonus: { hit: 5 } },
            2: { bonus: { hit: 5 } },
            3: { bonus: { hit: 5 } },
            4: { bonus: { hit: 5 } },
            5: { bonus: { hit: 5 } },
            6: { bonus: { hit: 5 }, art: "ryoudan" },
            7: { bonus: { hit: 5 } },
            8: { bonus: { hit: 5 } },
            9: { bonus: { hit: 5 }, art: "enbu" },
        },
    },

    回避: {
        type: "cumulative",
        ranks: {
            1: { bonus: { evasion: 5 } },
            2: { bonus: { evasion: 5 } },
            3: { bonus: { evasion: 5 } },
            4: { bonus: { evasion: 5 } },
            5: { bonus: { evasion: 5 } },
            6: { bonus: { evasion: 5 }, art: "zetsuei" },
            7: { bonus: { evasion: 5 } },
            8: { bonus: { evasion: 5 } },
            9: { bonus: { evasion: 5 }, passive: "seizon_honnou" },
        },
    },

    // ── 習得特化型: 補正なし、段ごとに戦技/スキル ──
    武道: {
        type: "artsOnly",
        ranks: {
            1: null,
            2: null,
            3: null,
            4: null,
            5: { art: "jougen" },
            6: { art: "kagen" },
            7: { art: "muei" },
            8: { passive: "zanshin" },
            9: { art: "shinigami" },
        },
    },

    魔導: {
        type: "artsOnly",
        ranks: {
            1: null,
            2: null,
            3: null,
            4: null,
            5: { art: "makou" },
            6: { passive: "mahou_taisei" },
            7: { art: "ikou" },
            8: { passive: "eishou_tanshuku" },
            9: { art: "myoujou" },
        },
    },

    戦闘指揮: {
        type: "artsOnly",
        ranks: {
            1: null,
            2: { passive: "chikara_no_jin" },
            3: { passive: "bougyo_no_jin" },
            4: { passive: "maryoku_no_jin" },
            5: { art: "gunryaku_denju" },
            6: { passive: "mabou_no_jin" },
            7: { passive: "kyuusho_no_jin" },
            8: { passive: "kaihi_no_jin" },
            9: { art: "gunshin" },
        },
    },
};

// ── 汎用魔法: 属性ごとの修練度5で習得 ──────────────
const MAGIC_MASTERY = {
    火:   { at: 5, art: "rengoku" },
    水:   { at: 5, art: "gekiryuu" },
    土:   { at: 5, art: "suna_jigoku" },
    風:   { at: 5, art: "kamakaze" },
    治癒: { at: 5, passive: "kaifuku" },
    破壊: { at: 5, passive: "ma_no_kodou" },
};

if (typeof module !== "undefined") {
    module.exports = { BUILD_MILESTONES, MAGIC_MASTERY };
}
