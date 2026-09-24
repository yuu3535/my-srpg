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
    TRIAL_LOADOUT_SLOT_COUNTS,
    trialSkillLoadoutFor,
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

// 幼カリマ: TRPG Lv1 だが causeLevel の指定で因果Lv25（採用版§6.2の成長率、幸運・勇気補正+4%）
assert.equal(trialGrowthBonus(P.young_karima), 4);
assert.equal(trialCauseLevelFor(P.young_karima), 25);
assert.deepEqual(trialStatsAt(P.young_karima, 40),
    { hp: 35, atk: 35, def: 32, mag: 45, res: 44, tec: 38, spd: 40, cha: 42 });

// 試験用バトルの定義（シナリオ本編の battle_ch1 には目印を付けない）
const battles = require("../battleDefinitions.js");
const { TRIAL_RULES_ID } = require("../trialStatSystem.js");
assert.equal(battles.battle_trial_adopted.trialRules, TRIAL_RULES_ID);
assert.equal(battles.battle_ch1.trialRules, undefined);
assert.equal(battles.battle_tutorial.trialRules, undefined);
for (const id of battles.battle_trial_adopted.unitIds) {
    assert.ok(P[id], `試験用バトルの ${id} に試験プロフィールがある`);
}

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

// ステータス画面の戦闘値: 命中値 - 回避値 が命中率の式と一致する
const {
    trialDerivedValues, TRIAL_UNIT_CLASS, TRIAL_CLASS_SKILLS,
} = require("../trialStatSystem.js");
const ring40d = trialDerivedValues(ring40, P.ringholm.siz, 90);
const albas40d = trialDerivedValues(albas40, P.albas.siz, 65);
assert.equal(ring40d.hit - albas40d.evade, trialHitRate(ring40, albas40, P.albas.siz));
assert.equal(ring40d.crit - albas40d.critGuard, trialCriticalRate(ring40, 90, albas40));
assert.equal(ring40d.followUp, ring40.spd - 5);
assert.equal(trialDerivedValues(ring40, 10, 150).counter, 100); // 反撃率は0〜100%

// 試験プロフィールのキャラは全員、兵種の表示データを持つ
for (const id of Object.keys(P)) {
    const cls = TRIAL_UNIT_CLASS[id];
    assert.ok(cls, `${id} の兵種表示データ`);
    if (cls.line) assert.ok(TRIAL_CLASS_SKILLS[cls.line], `${cls.line} の兵種スキル`);
}

// 採用済みのセット枠。ステータス画面は空き枠も含めて固定数を返す。
const ringLoadout = trialSkillLoadoutFor("ringholm", 30);
assert.equal(ringLoadout.personal.name, "殺気");
assert.equal(ringLoadout.classSkills.length, TRIAL_LOADOUT_SLOT_COUNTS.classSkills);
assert.equal(ringLoadout.classUnique.length, TRIAL_LOADOUT_SLOT_COUNTS.classUnique);
assert.deepEqual(ringLoadout.causeSkills.map(skill => skill?.name), ["黒の一族", "死神", "カウンター"]);
assert.deepEqual(ringLoadout.combatArts.map(art => art?.name), ["召喚「ヒトダマ」", "円舞", "復讐", undefined]);

// 専用兵種予定4人の因果Lv50能力は、因果3枠ではなく兵種固有枠へ入る。
const karimaFinal = trialSkillLoadoutFor("young_karima", 50);
assert.equal(karimaFinal.classUnique[0].name, "神炎の器");
assert.equal(karimaFinal.causeSkills.some(skill => skill?.name === "神炎の器"), false);

// 仮の敵プロフィールも同じ枠数を返し、未設定を勝手に能力なしと確定しない。
const guardLoadout = trialSkillLoadoutFor("forest_guard", 10);
assert.equal(guardLoadout.personal, null);
assert.equal(guardLoadout.causeSkills.length, 3);
assert.equal(guardLoadout.combatArts.length, 4);

// 追撃: 速さ差5以上
assert.equal(trialCanFollowUp({ spd: 30 }, { spd: 25 }), true);
assert.equal(trialCanFollowUp({ spd: 29 }, { spd: 25 }), false);

console.log("trialStatSystem: all tests passed");
