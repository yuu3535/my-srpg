const assert = require("node:assert/strict");
const {
    TRIAL_PROFILES,
    trialGrowthBonus,
    trialCauseLevelFor,
    trialStatsAt,
    trialSizeEvasionModifier,
    trialHitRate,
    trialDamage,
    trialCriticalRate,
    trialCanFollowUp,
} = require("../trialStatSystem.js");

const P = TRIAL_PROFILES;

// 幸運・勇気補正（採用版§6.1）
assert.equal(trialGrowthBonus(P.arshe), 4);
assert.equal(trialGrowthBonus(P.ringholm), 3);
assert.equal(trialGrowthBonus(P.albas), 3);

// TRPGレベル → 試験用因果Lv（原作者指定）
assert.equal(trialCauseLevelFor(P.ringholm), 30);
assert.equal(trialCauseLevelFor(P.arshe), 25);
assert.equal(trialCauseLevelFor(P.forest_guard), 10);

// 採用版§7の因果Lv40期待値（HPは案②なので案①からTRPG HP分を引いた値）
assert.deepEqual(trialStatsAt(P.arshe, 40),
    { hp: 42, atk: 39, def: 36, mag: 41, res: 36, tec: 38, spd: 39, cha: 40 });
assert.deepEqual(trialStatsAt(P.ringholm, 40),
    { hp: 31, atk: 46, def: 32, mag: 43, res: 41, tec: 37, spd: 40, cha: 41 });
assert.deepEqual(trialStatsAt(P.albas, 40),
    { hp: 45, atk: 29, def: 34, mag: 56, res: 52, tec: 44, spd: 32, cha: 45 });

// Lv1は基礎値そのもの
assert.deepEqual(trialStatsAt(P.albas, 1), P.albas.base);

// 能力上限で止まる
const capped = trialStatsAt(P.arshe, 400);
assert.equal(capped.spd, P.arshe.caps.spd);
assert.equal(capped.hp, P.arshe.caps.hp);

// 体格回避補正（-10〜+5）
assert.equal(trialSizeEvasionModifier(10), 1);
assert.equal(trialSizeEvasionModifier(4), 5);
assert.equal(trialSizeEvasionModifier(25), -10);

// 命中率: 60 + (技 - 速さ) x 2.5 - 体格補正、5〜100%
assert.equal(trialHitRate({ tec: 37 }, { spd: 32 }, 11), 73); // 72.5 → 73
assert.equal(trialHitRate({ tec: 44 }, { spd: 21 }, 12), 100);
assert.equal(trialHitRate({ tec: 5 }, { spd: 60 }, 11), 5);

// ダメージ（WORK_MEMO §12 / §15 の例）
const ring40 = trialStatsAt(P.ringholm, 40);
const albas40 = trialStatsAt(P.albas, 40);
assert.equal(trialDamage(ring40.atk, albas40.def, 6), 12);
assert.equal(trialDamage(albas40.mag, ring40.res, 6), 14);
assert.equal(trialDamage(1, 99, 3), 1); // 最低1

// 必殺率（WORK_MEMO §15 の例）
assert.equal(trialCriticalRate(ring40, 90, albas40), 10);
assert.equal(trialCriticalRate(albas40, 65, ring40), 16);
assert.equal(trialCriticalRate(ring40, 0, { cha: 99 }), 0);  // 最低0
assert.equal(trialCriticalRate(ring40, 90, albas40, 10), 20); // 補正

// 勇気が減ると必殺率も下がる
assert.ok(trialCriticalRate(ring40, 40, albas40) < trialCriticalRate(ring40, 90, albas40));

// 追撃: 速さ差5以上
assert.equal(trialCanFollowUp({ spd: 30 }, { spd: 25 }), true);
assert.equal(trialCanFollowUp({ spd: 29 }, { spd: 25 }), false);

console.log("trialStatSystem: all tests passed");
