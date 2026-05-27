// ============================================================
//  spells.js  ―  SRPG用魔法定義（日本語キー）
//
//  effectType 一覧:
//    magicDamage  : 魔法ダメージ（単体）
//    areaDamage   : 魔法ダメージ（範囲）
//    heal         : HP回復
//    barrier      : 装甲付与
//    accuracyDown : 命中低下
//    extraAction  : 再行動付与
//    break        : 結界・装甲破壊
//    stun         : 行動不能
//    counter      : カウンター状態付与
//    nightmare    : 勇気/MP減少
//    support      : 判定値+1
//    transfer     : HP/MP移譲（未実装：ログのみ）
//    clone        : 分霊（未実装：ログのみ）
//    teleport     : 転移（未実装：ログのみ）
//    transform    : 変身（未実装：ログのみ）
//    flight       : 浮遊（未実装：ログのみ）
//    gravityField : 重力場（全体固定ダメージ）
//    summon       : 召喚（未実装：ログのみ）
// ============================================================

const SPELLS_DATA = {

    // ==================== 基礎魔法 ====================

    火: {
        id: "火", name: "火",
        category: "basic", type: "attack", targetType: "enemy",
        range: 2, mpCost: "1d6",
        powerFormula: "1d6+MB", effectType: "magicDamage",
        statusEffect: "burn", statusChanceNote: "10ダメージ以上で火傷",
        description: "火を操り敵単体に魔法ダメージ。"
    },

    水: {
        id: "水", name: "水",
        category: "basic", type: "attack", targetType: "enemy",
        range: 2, mpCost: "1d6",
        powerFormula: "1d6+MB", effectType: "magicDamage",
        statusEffect: null, statusChanceNote: null,
        description: "水を操り敵単体に魔法ダメージ。"
    },

    風: {
        id: "風", name: "風",
        category: "basic", type: "attack", targetType: "enemy",
        range: 2, mpCost: "1d6",
        powerFormula: "1d6+MB", effectType: "magicDamage",
        statusEffect: "knockback", statusChanceNote: "10ダメージ以上で吹き飛ばし",
        description: "風を操り敵単体に魔法ダメージ。"
    },

    土: {
        id: "土", name: "土",
        category: "basic", type: "attack", targetType: "enemy",
        range: 2, mpCost: "1d6",
        powerFormula: "1d6+MB", effectType: "magicDamage",
        statusEffect: null, statusChanceNote: null,
        description: "土を操り敵単体に魔法ダメージ。"
    },

    治癒: {
        id: "治癒", name: "治癒",
        category: "basic", type: "heal", targetType: "ally",
        range: 2, mpCost: "1d6",
        powerFormula: "1d6+MB", effectType: "heal",
        description: "対象のHPを回復する。"
    },

    // ==================== 特殊魔法 ====================

    氷: {
        id: "氷", name: "氷",
        category: "special", type: "attack", targetType: "enemy",
        range: 2, mpCost: "1d6",
        powerFormula: "1d6+MB", effectType: "magicDamage",
        statusEffect: "slow", statusChanceNote: "10ダメージ以上で命中-1",
        description: "氷魔法。敵単体にダメージ。10以上で命中低下。"
    },

    加速: {
        id: "加速", name: "加速",
        category: "special", type: "support", targetType: "ally",
        range: 2, mpCost: "1d6",
        effectType: "extraAction", durationFormula: "1",
        description: "対象を加速させ再行動または追加行動を可能にする。"
    },

    カウンター: {
        id: "カウンター", name: "カウンター",
        category: "special", type: "support", targetType: "ally",
        range: null, mpCost: "1d6",
        effectType: "counter", durationFormula: "2d3",
        description: "2d3ターンの間、受けたダメージを跳ね返す。"
    },

    虚像: {
        id: "虚像", name: "虚像",
        category: "special", type: "debuff", targetType: "enemy",
        range: 2, mpCost: "1d8",
        effectType: "accuracyDown", effectValue: -2, durationFormula: "1d3+MB",
        description: "対象の命中を2低下させる。"
    },

    結界: {
        id: "結界", name: "結界",
        category: "special", type: "support", targetType: "ally",
        range: 2, mpCost: "1d6",
        powerFormula: "2d4", effectType: "barrier", durationFormula: "1d3+MB",
        description: "対象に装甲を付与する。「破壊」でのみ大きく減衰。"
    },

    破壊: {
        id: "破壊", name: "破壊",
        category: "special", type: "attack", targetType: "enemy",
        range: 2, mpCost: "1d6",
        powerFormula: "1d6+MB", effectType: "break",
        description: "結界・装甲を破壊し、残ダメージを本体に通す。"
    },

    封印: {
        id: "封印", name: "封印",
        category: "special", type: "debuff", targetType: "enemy",
        range: 2, mpCost: "1d8",
        effectType: "stun", durationFormula: "1d3+1",
        description: "対象を1d3+1ターンの間スタンさせる。"
    },

    落雷: {
        id: "落雷", name: "落雷",
        category: "special", type: "attack", targetType: "enemy",
        range: 3, mpCost: "1d6",
        powerFormula: "1d8+MB", effectType: "magicDamage",
        description: "雷撃を落とし敵単体に強力な魔法ダメージ。"
    },

    悪夢: {
        id: "悪夢", name: "悪夢",
        category: "special", type: "debuff", targetType: "enemy",
        range: 2, mpCost: "1d6",
        effectType: "nightmare", effectValue: "1d6+MB",
        description: "相手の勇気を1d6+MB減少させる。"
    },

    補助: {
        id: "補助", name: "補助",
        category: "special", type: "support", targetType: "ally",
        range: 2, mpCost: "1d6",
        effectType: "support",
        description: "特技・魔法の成功値に+1の補正をつける。"
    },

    付与: {
        id: "付与", name: "付与",
        category: "special", type: "support", targetType: "ally",
        range: 2, mpCost: "任意",
        effectType: "transfer",
        description: "自分のHP/MPを任意で消費し対象に付与する。"
    },

    転移: {
        id: "転移", name: "転移",
        category: "special", type: "support", targetType: "ally",
        range: 5, mpCost: "1d8",
        effectType: "teleport",
        description: "5マス以内の任意の場所に瞬間移動する。"
    },

    変身: {
        id: "変身", name: "変身",
        category: "special", type: "support", targetType: "ally",
        range: 2, mpCost: "1d8",
        effectType: "transform",
        description: "自分または対象の姿を変える。"
    },

    生命: {
        id: "生命", name: "生命",
        category: "special", type: "heal", targetType: "ally",
        range: 2, mpCost: "1d6",
        powerFormula: "1d6+MB", effectType: "heal",
        description: "対象のHPを回復する（生命魔法）。"
    },

    浮遊: {
        id: "浮遊", name: "浮遊",
        category: "special", type: "support", targetType: "ally",
        range: null, mpCost: "1d6",
        effectType: "flight", durationFormula: "1d10+MB",
        description: "1d10+MBターンの間、飛行状態になる。"
    },

    分霊: {
        id: "分霊", name: "分霊",
        category: "special", type: "support", targetType: "ally",
        range: null, mpCost: "1d6",
        effectType: "clone",
        description: "自分の分身を作る。本体とHP/MPを共有する。"
    },

    // ==================== 特殊（全体・範囲） ====================

    隕石: {
        id: "隕石", name: "隕石",
        category: "special", type: "attack", targetType: "enemy",
        range: 3, mpCost: "1d8",
        powerFormula: "1d12+MB", effectType: "areaDamage",
        areaNote: "縦3マス以内の敵全体",
        description: "いん石を降らせ、使用者の縦3マス以内の敵全体を攻撃。"
    },

    重力: {
        id: "重力", name: "重力",
        category: "special", type: "attack", targetType: "enemy",
        range: null, mpCost: "1d10",
        effectType: "gravityField", effectValue: 1,
        durationFormula: "1d6+MB",
        description: "1d6+MBターンの間、使用者以外の全員に毎ターン固定1ダメージ。"
    },

    // ==================== 召喚 ====================

    ヒトダマ: {
        id: "ヒトダマ", name: "ヒトダマ召喚",
        category: "summon", type: "support", targetType: "ally",
        range: null, mpCost: "1d4",
        effectType: "summon",
        description: "ヒトダマを召喚する。"
    },

    暗器召喚: {
        id: "暗器召喚", name: "暗器召喚",
        category: "summon", type: "attack", targetType: "ally",
        range: null, mpCost: "1d2",
        effectType: "summon",
        description: "1d4ダメージの暗器1d20本を召喚する。"
    },

    グレムリン: {
        id: "グレムリン", name: "グレムリン召喚",
        category: "summon", type: "support", targetType: "ally",
        range: null, mpCost: "1d2",
        effectType: "summon",
        description: "グレムリンを召喚する。"
    },

    "フギン＆ムギン": {
        id: "フギン＆ムギン", name: "フギン＆ムギン召喚",
        category: "summon", type: "support", targetType: "ally",
        range: null, mpCost: "1d2",
        effectType: "summon",
        description: "双鴉フギン＆ムギンを召喚する。"
    },

    ジズ: {
        id: "ジズ", name: "ジズ召喚",
        category: "summon", type: "support", targetType: "ally",
        range: null, mpCost: "5d3",
        effectType: "summon",
        description: "羽ばたく者ジズを召喚する。"
    },

    バハムート: {
        id: "バハムート", name: "バハムート召喚",
        category: "summon", type: "support", targetType: "ally",
        range: null, mpCost: "3d3",
        effectType: "summon",
        description: "彷徨う者バハムートを召喚する。"
    },

    レヴィア: {
        id: "レヴィア", name: "レヴィア召喚",
        category: "summon", type: "support", targetType: "ally",
        range: null, mpCost: "4d3",
        effectType: "summon",
        description: "渦巻く者レヴィアを召喚する。"
    },

};
