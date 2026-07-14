// ============================================================
//  passiveSkills.js ― パッシブスキルデータ（純粋データ）
//
//  設計: COMBAT_ARTS_DESIGN.md §7 / 原案: §11（戦技案.xlsx）
//  trigger : battleHooks のフック名（§8）
//  chance  : C型（確率発動）の発動率式。calcBattleStats の
//            v2名（atk/mag/def/res）または raw 値を参照する。
//            null は常時/条件のみで発動（B型）
//  condition: 追加の状況条件
//  数値バランスは未調整（原作者調整前提）
// ============================================================

const PASSIVE_SKILLS = {

    // ── 回避トラック ──────────────────────────────
    seizon_honnou: {
        name: "生存本能",
        track: "回避",
        trigger: "modifyPrediction",       // 常時系は予測にも反映する
        condition: { hpBelowPercent: 30 },
        chance: null,
        effect: { evasionBonus: 30 },
        desc: "HP30%以下の時、回避+30%。",
    },

    // ── 武道トラック ──────────────────────────────
    zanshin: {
        name: "残心",
        track: "武道",
        trigger: "onKill",
        condition: null,
        chance: null,
        effect: { evasionBonus: 20, duration: 1 },
        desc: "敵撃破時、回避+20%。",
    },

    // ── 魔導トラック ──────────────────────────────
    mahou_taisei: {
        name: "魔法耐性",
        track: "魔導",
        trigger: "beforeDamaged",
        condition: { damageType: "magic" },
        chance: "res*2",
        effect: { damageMultiplier: 0.5 },
        desc: "魔防×2%で発動、魔法ダメージを半減する。",
    },
    eishou_tanshuku: {
        name: "詠唱短縮",
        track: "魔導",
        trigger: "beforeAttack",
        condition: { actionType: "magic" },
        chance: null,
        effect: { mpCostMultiplier: 0.5 },
        desc: "魔法使用時、MPが半減する。",
    },

    // ── 戦闘指揮トラック（陣シリーズ＝C型の本場） ──
    chikara_no_jin: {
        name: "力の陣",
        track: "戦闘指揮",
        trigger: "beforeAttack",
        condition: { damageType: "physical" },
        chance: "atk*2",
        effect: { damageMultiplier: 1.4 },
        desc: "力×2%で発動、物理ダメージ×1.4。",
    },
    bougyo_no_jin: {
        name: "防御の陣",
        track: "戦闘指揮",
        trigger: "beforeDamaged",
        condition: { damageType: "physical" },
        chance: "def*2",
        effect: { damageMultiplier: 0.5 },
        desc: "物防×2%で発動、物理ダメージを半減。",
    },
    maryoku_no_jin: {
        name: "魔力の陣",
        track: "戦闘指揮",
        trigger: "beforeAttack",
        condition: { damageType: "magic" },
        chance: "mag*2",
        effect: { damageMultiplier: 1.4 },
        desc: "魔力×2%で発動、魔法ダメージ×1.4。",
    },
    mabou_no_jin: {
        name: "魔防の陣",
        track: "戦闘指揮",
        trigger: "beforeDamaged",
        // 原案ママ:「魔防×2%で発動、物理ダメージを半減」
        // ※物理でなく魔法ダメージの誤記の可能性 → 原作者確認待ち
        condition: { damageType: "physical" },
        chance: "res*2",
        effect: { damageMultiplier: 0.5 },
        desc: "魔防×2%で発動、物理ダメージを半減。",
    },
    kyuusho_no_jin: {
        name: "急所の陣",
        track: "戦闘指揮",
        trigger: "beforeAttack",
        condition: null,
        chance: "hit",                     // 命中%で発動（最終命中率を参照）
        effect: { critBonus: 30 },
        desc: "命中％で発動、必殺+30。",
        requiresCritSystem: true,          // 必殺実装後に有効化
    },
    kaihi_no_jin: {
        name: "回避の陣",
        track: "戦闘指揮",
        trigger: "beforeDamaged",
        condition: null,
        chance: "raw.dex*2",               // 速さは新設せずDEX代用（SYNC合意）
        effect: { evasionBonus: 30 },
        desc: "速さ(DEX)×2%で発動、回避+30。",
    },

    // ── 汎用魔法（属性ごと） ──────────────────────
    kaifuku: {
        name: "回復",
        track: "魔法:治癒",
        trigger: "beforeAttack",
        condition: { spellElement: "治癒" },
        chance: "mag*2",
        effect: { healMultiplier: 2 },
        desc: "魔力×2%で発動、治癒魔法の回復量×2。",
    },
    ma_no_kodou: {
        name: "魔の鼓動",
        track: "魔法:破壊",
        trigger: "afterAttack",
        condition: { spellElement: "破壊" },
        chance: "mag*2",
        effect: { mpRestorePercent: 20 },
        desc: "魔力×2%で発動、MPが20%回復。",
    },
};

if (typeof module !== "undefined") {
    module.exports = { PASSIVE_SKILLS };
}
