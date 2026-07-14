// ============================================================
//  combatArts.js ― 戦技データ（純粋データ・DOM/戦闘状態に触れない）
//
//  設計: COMBAT_ARTS_DESIGN.md §7 / 原案: §11（戦技案.xlsx）
//  読込順: 技能・魔法データの後、game.js の前
//
//  base : どのコマンドの派生か
//         "attack"（物理攻撃） / "magic:火" 等（属性魔法）
//  cost : { durability } 武器耐久消費（物理系）
//         { mpMultiplier } MP消費倍率（魔導系）
//         { mp } MP増減（負値は軽減）
//         { uses } 戦闘ごとの使用回数上限
//  effect: battleHooks 実装時に解釈する宣言的パラメータ。
//          数値バランスは未調整（原作者調整前提）
// ============================================================

const COMBAT_ARTS = {

    // ── 武器トラック ──────────────────────────────
    ryoudan: {
        name: "両断",
        category: "奥義",
        track: "武器",
        base: "attack",
        cost: { durability: 3 },
        effect: { powerBonus: 5 },
        desc: "戦技発動時、攻撃力+5。",
    },
    enbu: {
        name: "円舞",
        category: "技巧",
        track: "武器",
        base: "attack",
        cost: { durability: 5 },
        effect: { areaShape: "adjacentAll" },
        desc: "隣接する全ての敵に物理攻撃が当たる。",
    },

    // ── 回避トラック ──────────────────────────────
    zetsuei: {
        name: "絶影",
        category: "技巧",
        track: "回避",
        base: "self",
        cost: { uses: 3 },
        effect: { evasionBonus: 20, duration: 1 },
        desc: "発動ターンの間、回避+20%。戦闘中3回まで使用可能。",
    },

    // ── 武道トラック ──────────────────────────────
    jougen: {
        name: "上弦",
        category: "技巧",
        track: "武道",
        base: "attack",
        cost: { durability: 3 },
        effect: { areaShape: "upper3" },
        desc: "隣接する上3マスの敵に物理攻撃が当たる。",
    },
    kagen: {
        name: "下弦",
        category: "技巧",
        track: "武道",
        base: "attack",
        cost: { durability: 3 },
        effect: { areaShape: "lower3" },
        desc: "隣接する下3マスの敵に物理攻撃が当たる。",
    },
    muei: {
        name: "無影",
        category: "技巧",
        track: "武道",
        base: "attack",
        cost: { durability: 3 },
        effect: { rangeBonus: 2 },
        desc: "戦技発動時、物理攻撃の射程+2。",
    },
    shinigami: {
        name: "死神",
        category: "技巧",
        track: "武道",
        base: "attack",
        cost: { durability: 6 },
        effect: {
            onKillHealDamageDealt: true,
            onKillCourageHalveRadius: 3,   // 周囲3マスの敵の currentCourage 半減(1T)
            courageDebuffDuration: 1,
        },
        desc: "敵を倒したときのダメージ分HPを回復。周囲3マス以内の敵の勇気を半減(1ターン)。",
    },

    // ── 魔導トラック ──────────────────────────────
    makou: {
        name: "魔光",
        category: "神髄",
        track: "魔導",
        base: "magic:any",
        cost: { mpMultiplier: 3 },
        effect: { areaShape: "cross3x3" },   // 敵中心の上3×横3マス
        desc: "敵を中心とした上3マス横3マスの敵に魔法攻撃が当たる。MP消費3倍。",
    },
    ikou: {
        name: "威光",
        category: "神髄",
        track: "魔導",
        base: "magic:any",
        cost: { mpMultiplier: 3 },
        effect: { rangeBonus: 5 },
        desc: "戦技発動時、魔法攻撃の射程+5。MP消費3倍。",
    },
    myoujou: {
        name: "明星",
        category: "神髄",
        track: "魔導",
        base: "magic:any",
        cost: { mp: 6 },
        effect: {
            onKillHealDamageDealt: true,
            onKillAllyHealRadius: 3,       // 周囲3マスの味方HP20%回復
            allyHealPercent: 20,
        },
        desc: "敵を倒したときのダメージ分HPを回復。周囲3マス以内の味方のHPを20%回復。",
    },

    // ── 戦闘指揮トラック ──────────────────────────
    gunryaku_denju: {
        name: "軍略伝授",
        category: "指揮",
        track: "戦闘指揮",
        base: "self",
        cost: {},                          // コスト未設定（要調整）
        effect: { partyBuff: { hit: 10, evasion: 10, crit: 10 } },
        desc: "味方全員の命中・回避・必殺+10。",
        requiresCritSystem: true,          // 必殺実装後に有効化
    },
    gunshin: {
        name: "軍神",
        category: "指揮",
        track: "戦闘指揮",
        base: "self",
        cost: {},                          // コスト未設定（要調整）
        effect: { partyBuff: { atk: 5, mag: 5, def: 5, res: 5, speed: 5, hit: 5, evasion: 5, crit: 5 } },
        desc: "味方全員の力・魔力・防御・魔防・速さ・命中・回避・必殺+5。",
        requiresCritSystem: true,
    },

    // ── 汎用魔法（属性ごと・修練度5で習得） ────────
    rengoku: {
        name: "煉獄",
        category: "神髄",
        track: "魔法:火",
        base: "magic:火",
        cost: {},
        effect: { statusOnHit: { type: "burn", duration: 4, guaranteed: true } },
        desc: "魔法：火の攻撃に成功した時、4ターンの間、必ず相手をやけど状態にする。",
    },
    gekiryuu: {
        name: "激流",
        category: "神髄",
        track: "魔法:水",
        base: "magic:水",
        cost: {},
        effect: { knockback: 1 },
        desc: "魔法：水の攻撃に成功したとき、相手を1マス後ろに下げる。",
    },
    suna_jigoku: {
        name: "砂地獄",
        category: "神髄",
        track: "魔法:土",
        base: "magic:土",
        cost: {},
        effect: { statusOnHit: { type: "immobilize", duration: 1 } },
        desc: "魔法：土でダメージを与えた際、相手の移動を封じる(1ターン)。",
    },
    kamakaze: {
        name: "鎌風",
        category: "神髄",
        track: "魔法:風",
        base: "magic:風",
        cost: {},
        effect: { splashRadius: 1 },
        desc: "魔法：風の攻撃に成功したとき、その敵を中心に1マス以内に隣接する敵にも攻撃が当たる。",
    },
};

if (typeof module !== "undefined") {
    module.exports = { COMBAT_ARTS };
}
