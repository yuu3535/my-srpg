// =====================================================================
//  tools/trial_battle_sim.js ― 採用版ステータスの対戦シミュレーション
//
//  使い方: node tools/trial_battle_sim.js [試行回数] [--enemy-level=30] [--enemy-growth=470]
//    --enemy-level  : 敵の因果Lvを指定値にそろえる（省略時は TRPGレベル対応表どおり）
//    --enemy-growth : 敵の個人成長率を、配分を保ったまま合計○%へ拡大縮小する
//  テスト戦闘（battle_ch1）の味方3人 × 敵3体を、1対1の交戦で総当たりする。
//
//  1回の交戦:
//    1. 攻撃側の攻撃（命中 → ダメージ → 必殺）
//    2. 防御側の反撃（勇気%で発生、ダメージ半分。現行ゲームのルール）
//    3. 追撃（速さ差5以上。攻撃側が速ければ攻撃側が再攻撃、
//       防御側が速く反撃が出ていれば防御側が再反撃）
//  物理・魔法は期待ダメージの高い方を選ぶ。武器は全員「中威力6」。
//  第1段階のため、兵種補正・兵種スキル・Dual・MP消費は含めない。
// =====================================================================

const T = require("../trialStatSystem.js");

const TRIALS = Number(process.argv.slice(2).find(a => /^\d+$/.test(a)) || 20000);
const argValue = name => {
    const arg = process.argv.find(a => a.startsWith(`--${name}=`));
    return arg ? Number(arg.split("=")[1]) : null;
};
const ENEMY_LEVEL = argValue("enemy-level");
const ENEMY_GROWTH = argValue("enemy-growth");
const WEAPON = T.TRIAL_WEAPON_POWER.mid;
const ALLIES = ["ringholm", "arshe", "albas"];
const ENEMIES = ["forest_guard", "dylan", "herel"];

// 乱数（再現できるよう固定シード）
let seed = 20260924;
function rand100() {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return Math.floor((seed / 2147483648) * 100) + 1;
}

function makeUnit(id, hpPlan = 2) {
    let profile = T.TRIAL_PROFILES[id];
    let level = T.trialCauseLevelFor(profile);
    if (ENEMIES.includes(id)) {
        if (ENEMY_LEVEL) level = ENEMY_LEVEL;
        if (ENEMY_GROWTH) {
            const total = T.TRIAL_STAT_KEYS.reduce((sum, k) => sum + profile.growth[k], 0);
            const growth = {};
            for (const k of T.TRIAL_STAT_KEYS) growth[k] = profile.growth[k] * ENEMY_GROWTH / total;
            profile = { ...profile, growth };
        }
    }
    const stats = T.trialStatsAt(profile, level);
    // hpPlan 1 = 案①（Lv1 HP x 2 に同じ成長を加える）
    if (hpPlan === 1) stats.hp += profile.base.hp;
    return { id, name: profile.name, level, stats, courage: profile.courage, siz: profile.siz, baseHp: profile.base.hp };
}

/** 攻撃1回分の見込み（物理と魔法のうち期待値の高い方） */
function planAttack(att, def, half = false) {
    const options = ["phys", "magic"].map(kind => {
        const a = kind === "phys" ? att.stats.atk : att.stats.mag;
        const d = kind === "phys" ? def.stats.def : def.stats.res;
        let dmg = T.trialDamage(a, d, WEAPON);
        if (half) dmg = Math.max(1, Math.floor(dmg / 2));
        const hit = T.trialHitRate(att.stats, def.stats, def.siz);
        const crit = T.trialCriticalRate(att.stats, att.courage, def.stats);
        const expected = (hit / 100) * dmg * (1 + 2 * crit / 100);
        return { kind, dmg, hit, crit, expected };
    });
    return options[0].expected >= options[1].expected ? options[0] : options[1];
}

function strike(att, def, state, half = false) {
    const plan = planAttack(att, def, half);
    if (rand100() > plan.hit) return { hit: false, dmg: 0, crit: false };
    const crit = rand100() <= plan.crit;
    const dmg = crit ? plan.dmg * 3 : plan.dmg;
    state[def.id] = Math.max(0, state[def.id] - dmg);
    return { hit: true, dmg, crit };
}

/** 1回の交戦。state は現在HP */
function exchange(att, def, state, log) {
    strike(att, def, state);
    let countered = false;
    if (state[def.id] > 0 && rand100() <= def.courage) {
        countered = true;
        strike(def, att, state, true);
    }
    if (state[att.id] > 0 && state[def.id] > 0) {
        if (T.trialCanFollowUp(att.stats, def.stats)) {
            strike(att, def, state);
            log.attFollow++;
        } else if (countered && T.trialCanFollowUp(def.stats, att.stats)) {
            strike(def, att, state, true);
            log.defFollow++;
        }
    }
}

function simulate(attId, defId, hpPlan = 2) {
    const att = makeUnit(attId, hpPlan);
    const def = makeUnit(defId, hpPlan);
    let oneShot = 0, dealt = 0, taken = 0, killTurns = 0, attackerDied = 0;
    const log = { attFollow: 0, defFollow: 0 };
    for (let i = 0; i < TRIALS; i++) {
        // 1回目の交戦だけで集計
        const s1 = { [att.id]: att.stats.hp, [def.id]: def.stats.hp };
        exchange(att, def, s1, log);
        dealt += def.stats.hp - s1[def.id];
        taken += att.stats.hp - s1[att.id];
        if (s1[def.id] <= 0) oneShot++;
        // 決着まで交戦を繰り返す（攻撃側が毎回仕掛ける）
        const s = { [att.id]: att.stats.hp, [def.id]: def.stats.hp };
        let n = 0;
        while (s[att.id] > 0 && s[def.id] > 0 && n < 50) { exchange(att, def, s, log); n++; }
        if (s[def.id] <= 0) killTurns += n; else attackerDied++;
    }
    const wins = TRIALS - attackerDied;
    const plan = planAttack(att, def);
    return {
        att, def, plan,
        follow: T.trialCanFollowUp(att.stats, def.stats) ? "攻撃側" : (T.trialCanFollowUp(def.stats, att.stats) ? "防御側" : "なし"),
        dealtPct: dealt / TRIALS / def.stats.hp * 100,
        takenPct: taken / TRIALS / att.stats.hp * 100,
        oneShotPct: oneShot / TRIALS * 100,
        winPct: wins / TRIALS * 100,
        killTurns: wins ? killTurns / wins : null,
    };
}

function fmt(n, d = 0) { return n === null ? "-" : n.toFixed(d); }

function statsTable(ids) {
    const rows = ids.map(id => {
        const u = makeUnit(id);
        const s = u.stats;
        return `| ${u.name} | ${u.level} | ${s.hp}（${s.hp + u.baseHp}） | ${s.atk} | ${s.def} | ${s.mag} | ${s.res} | ${s.tec} | ${s.spd} | ${s.cha} | ${u.courage} |`;
    });
    return ["| ユニット | 因果Lv | HP 案②（案①） | 力 | 防御 | 魔攻 | 魔防 | 技 | 速さ | 魅力 | 勇気 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |", ...rows].join("\n");
}

function matchupTable(pairs, hpPlan = 2) {
    const rows = pairs.map(([a, d]) => {
        const r = simulate(a, d, hpPlan);
        const kind = r.plan.kind === "phys" ? "物理" : "魔法";
        return `| ${r.att.name} → ${r.def.name} | ${kind} | ${r.plan.hit}% | ${r.plan.dmg} | ${r.plan.crit}% | ${r.follow} | ${fmt(r.dealtPct)}% | ${fmt(r.takenPct)}% | ${fmt(r.oneShotPct, 1)}% | ${fmt(r.killTurns, 1)} | ${fmt(r.winPct)}% |`;
    });
    return ["| 攻撃 → 防御 | 攻撃 | 命中 | ダメージ | 必殺 | 追撃 | 1交戦で与える（相手HP比） | 1交戦で受ける（自HP比） | 1交戦で撃破 | 撃破までの交戦数 | 先に倒せる率 |",
        "| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |", ...rows].join("\n");
}

if (require.main === module) {
    const allyToEnemy = [];
    const enemyToAlly = [];
    for (const a of ALLIES) for (const e of ENEMIES) { allyToEnemy.push([a, e]); enemyToAlly.push([e, a]); }
    console.log(`試行回数: ${TRIALS}（固定シード）`
        + (ENEMY_LEVEL ? ` / 敵の因果Lv ${ENEMY_LEVEL}` : "")
        + (ENEMY_GROWTH ? ` / 敵の成長率合計 ${ENEMY_GROWTH}%` : "") + "\n");
    console.log("## ユニット\n");
    console.log(statsTable([...ALLIES, ...ENEMIES]));
    console.log("\n## 味方 → 敵（HP 案②）\n");
    console.log(matchupTable(allyToEnemy));
    console.log("\n## 敵 → 味方（HP 案②）\n");
    console.log(matchupTable(enemyToAlly));
    console.log("\n## 参考: 味方 → 敵（HP 案①）\n");
    console.log(matchupTable(allyToEnemy, 1));
    console.log("\n## 参考: 敵 → 味方（HP 案①）\n");
    console.log(matchupTable(enemyToAlly, 1));
}

module.exports = { makeUnit, planAttack, simulate };
