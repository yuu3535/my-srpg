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
    trialMagicMenuFor,
    TRIAL_CAUSE_ABILITIES,
    TRIAL_PERSONAL_SKILLS,
    trialPhysicalArtsFor,
    trialLoadoutStatBonus,
    trialAuraModifiers,
    trialAttackModifiers,
    trialAbilityChance,
    trialLearnedAbilitiesFor,
    trialToggleLoadoutSelection,
    trialAbilityNamesFor,
    trialAbilityLevelFor,
    trialCounterPlan,
    TRIAL_ITEM_CAPACITY,
    trialStartingGear,
    trialCarriedGrimoires,
    trialCarriedWeapon,
    trialGearEquip,
    trialGearTransfer,
    trialPhysicalDamage,
} = require("../trialStatSystem.js");

const books = id => trialCarriedGrimoires(trialStartingGear(id));

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

// 専用兵種予定4人の因果Lv50能力は、因果3枠には入らない。兵種固有枠に置けるのは専用兵種のときだけ
// （SKILL_LOADOUT_RULES §5）。試験では最初の兵種のため、兵種固有枠は空き
const karimaFinal = trialSkillLoadoutFor("young_karima", 50);
assert.equal(karimaFinal.classUnique[0], null);
assert.equal(karimaFinal.causeSkills.some(skill => skill?.name === "神炎の器"), false);
assert.equal(TRIAL_CAUSE_ABILITIES.young_karima.find(a => a.level === 50).type, "exclusive");

// 兵種表CSVから作ったデータ: 最初の兵種、個人スキル、戦技の種類、能力値上昇の読み取り
assert.deepEqual(TRIAL_UNIT_CLASS.ringholm, { name: "ならずもの", line: "戦列下級" });
assert.deepEqual(TRIAL_UNIT_CLASS.albas, { name: "ロード", line: "術軍師上級" });
assert.equal(TRIAL_PERSONAL_SKILLS.ringholm.name, "殺気");
assert.equal(TRIAL_PERSONAL_SKILLS.young_karima.name, "双蛇の逆針");
assert.match(TRIAL_PERSONAL_SKILLS.albas.desc, /^自分から攻撃した際、魅力×2%で相手の反撃を封じる/);   // 原作者回答（案A）
assert.equal(TRIAL_CAUSE_ABILITIES.arshe.find(a => a.name === "両断").artKind, "physicalArt");
assert.equal(TRIAL_CAUSE_ABILITIES.albas.find(a => a.name === "生命吸収").artKind, "exclusiveArt");
assert.deepEqual(TRIAL_CAUSE_ABILITIES.albas.find(a => a.level === 50).statBonus, { hp: 10, mag: 10, tec: 10, cha: 10 });
assert.deepEqual(TRIAL_CLASS_SKILLS["術軍師上級"].map(s => s[1]), ["威光", "魅力+10", "詠唱破棄", "導きの神髄"]);
assert.equal(TRIAL_CLASS_SKILLS["術下級"].length, 3);   // 兵種Lv10の習得枠は空欄
// 兵種Lv15なら通常兵種スキルの能力値上昇が乗る（戦列下級のHP+5）。戦技型の兵種能力は通常枠に入れない
assert.equal(trialLoadoutStatBonus("ringholm", 30).hp, 0);
assert.equal(trialSkillLoadoutFor("albas", 30, 15).classSkills.some(s => s?.name === "威光"), false);
assert.equal(trialSkillLoadoutFor("ringholm", 30, 15).classSkills[0].name, "HP+5");

// 物理の戦技は攻撃コマンド側。効果未実装のものは implemented=false
assert.deepEqual(trialPhysicalArtsFor("ringholm", 30).map(a => [a.name, a.implemented]),
    [["円舞", false], ["復讐", true]]);
assert.deepEqual(trialPhysicalArtsFor("arshe", 25).map(a => a.name), ["両断"]);

// 周囲の能力: 死神（敵の命中・回避-10）、王威（味方の命中・回避・必殺耐性+10）
const auraUnits = [
    { id: "ringholm", side: "ally", x: 0, y: 0, hp: 10, abilityNames: ["死神"] },
    { id: "albas", side: "ally", x: 5, y: 5, hp: 10, abilityNames: ["王威"] },
    { id: "arshe", side: "ally", x: 5, y: 6, hp: 10, abilityNames: [] },
    { id: "dylan", side: "enemy", x: 0, y: 3, hp: 10, abilityNames: [] },
];
const [ring, alb, ars, dyl] = auraUnits;
assert.equal(trialAuraModifiers(dyl, ring, auraUnits).accuracy, -10);           // 死神の近くの敵は命中-10
assert.equal(trialAuraModifiers(ring, dyl, auraUnits).accuracy, 10);            // 死神の近くの敵は回避-10
// 死神の近くの敵が、王威の近くの味方を狙う: 死神-10と王威-10が重なる
assert.deepEqual([trialAuraModifiers(dyl, ars, auraUnits).accuracy, trialAuraModifiers(dyl, ars, auraUnits).critGuard], [-20, 10]);
assert.equal(trialAuraModifiers({ id: "herel", side: "enemy", x: 9, y: 9, hp: 10 }, alb, auraUnits).accuracy, 0); // 王威は本人には効かない

// 野望・一族スキル
assert.deepEqual(trialAttackModifiers(["野望"], [], {}).accuracy, 10);
assert.equal(trialAttackModifiers(["野望"], [], { isCounter: true }).accuracy, 0);
assert.equal(trialAttackModifiers([], ["野望"], { isCounter: true }).accuracy, -10);
assert.equal(trialAttackModifiers(["黒の一族"], [], { isMagic: true, spellId: "火" }).damageMultiplier, 1.5);
assert.equal(trialAttackModifiers(["黒の一族"], [], { isMagic: true, spellId: "氷" }).damageMultiplier, 1);
assert.equal(trialAbilityChance("野望", { cha: 38 }), 76);
assert.equal(trialAbilityChance("カウンター", { hp: 30, def: 26 }, { maxHp: 30 }), 14);

// 仮の敵プロフィールも同じ枠数を返し、未設定を勝手に能力なしと確定しない。
const guardLoadout = trialSkillLoadoutFor("forest_guard", 10);
assert.equal(guardLoadout.personal, null);
assert.equal(guardLoadout.causeSkills.length, 3);
assert.equal(guardLoadout.combatArts.length, 4);

// 魔法コマンド: セット中の魔法戦技 → 魔導書の順。物理戦技は出さない
assert.deepEqual(trialMagicMenuFor("albas", 30).map(m => [m.name, m.spell, m.source]),
    [["破壊", "破壊", "戦技"], ["回復", "治癒", "戦技"], ["加速", "加速", "戦技"]]);
assert.deepEqual(trialMagicMenuFor("ringholm", 30, null, books("ringholm")).map(m => m.name), ["召喚「ヒトダマ」", "火の魔導書"]);
assert.deepEqual(trialMagicMenuFor("young_karima", 25, null, books("young_karima")).map(m => m.name), ["結界", "破壊", "治癒の魔導書"]);
assert.equal(trialMagicMenuFor("ringholm", 30).some(m => m.source === "魔導書"), false);   // 魔導書を持っていなければ出ない
assert.equal(trialMagicMenuFor("arshe", 25).some(m => m.name === "両断"), false);
assert.deepEqual(trialMagicMenuFor("dylan", 25), []);

// 身支度: 習得済みの一覧と、セットの付け外し
const ringLearned = trialLearnedAbilitiesFor("ringholm", 45);
assert.deepEqual(ringLearned.causeSkills.map(a => a.name), ["黒の一族", "死神", "カウンター", "戦闘指揮", "剣の舞"]);
// 既定（習得順）の3枠がいっぱい → 4つ目は付けられない
let sel = null;
let toggled = trialToggleLoadoutSelection("ringholm", 45, sel, "causeSkills", "剣の舞");
assert.deepEqual([toggled.changed, toggled.reason], [false, "full"]);
// 外してから付ける
toggled = trialToggleLoadoutSelection("ringholm", 45, sel, "causeSkills", "死神");
assert.deepEqual(toggled.selection.causeSkills, ["黒の一族", "カウンター"]);
toggled = trialToggleLoadoutSelection("ringholm", 45, toggled.selection, "causeSkills", "剣の舞");
assert.deepEqual(toggled.selection.causeSkills, ["黒の一族", "カウンター", "剣の舞"]);
sel = toggled.selection;
assert.deepEqual(trialSkillLoadoutFor("ringholm", 45, 1, sel).causeSkills.map(a => a.name), ["黒の一族", "カウンター", "剣の舞"]);
assert.equal(trialAbilityNamesFor("ringholm", 45, sel).includes("死神"), false);
// 戦技は4枠。習得していない名前・入れ替えできない区分は変わらない
assert.equal(trialToggleLoadoutSelection("ringholm", 45, sel, "combatArts", "両断").reason, "unknown");
assert.equal(trialToggleLoadoutSelection("ringholm", 45, sel, "classUnique", "勇者の器").reason, "locked");
// 戦技を外すと、その戦技は攻撃・魔法コマンドに出ない
const noRevenge = trialToggleLoadoutSelection("ringholm", 30, null, "combatArts", "復讐").selection;
assert.deepEqual(trialPhysicalArtsFor("ringholm", 30, noRevenge).map(a => a.name), ["円舞"]);
const noHitodama = trialToggleLoadoutSelection("ringholm", 30, null, "combatArts", "召喚「ヒトダマ」").selection;
assert.deepEqual(trialMagicMenuFor("ringholm", 30, noHitodama, books("ringholm")).map(m => m.name), ["火の魔導書"]);

// 習得に使う因果Lv（味方4人は入れ替えを試せるよう Lv45 相当。能力値の因果Lvは別）
assert.equal(trialAbilityLevelFor(P.ringholm), 45);
assert.equal(trialCauseLevelFor(P.ringholm), 30);
assert.equal(trialAbilityLevelFor(P.dylan), trialCauseLevelFor(P.dylan));

// 反撃: 防御側が今装備している武器・魔導書の射程で決める（魔法攻撃も反撃の対象）
const fireBook = { spell: "火", damaging: true };
assert.equal(trialCounterPlan({ equipped: "weapon", weaponRange: 1, distance: 1 }).canCounter, true);
assert.deepEqual(trialCounterPlan({ equipped: "weapon", weaponRange: 1, distance: 2 }), { canCounter: false, kind: "weapon", reason: "射程外" });
assert.equal(trialCounterPlan({ equipped: "grimoire", grimoire: fireBook, mp: 5, distance: 1 }).canCounter, true);
assert.equal(trialCounterPlan({ equipped: "grimoire", grimoire: fireBook, mp: 5, distance: 2 }).canCounter, true);
assert.equal(trialCounterPlan({ equipped: "grimoire", grimoire: fireBook, mp: 5, distance: 3 }).reason, "射程外");
assert.equal(trialCounterPlan({ equipped: "grimoire", grimoire: fireBook, mp: 0, distance: 1 }).reason, "MP不足");
assert.equal(trialCounterPlan({ equipped: "grimoire", grimoire: { spell: "治癒", damaging: false }, mp: 5, distance: 1 }).reason, "攻撃できない魔導書");
// 魔導書を持っていても、装備が武器なら武器の射程（自動で持ち替えない）
assert.deepEqual(trialCounterPlan({ equipped: "weapon", weaponRange: 1, grimoire: fireBook, mp: 5, distance: 2 }).reason, "射程外");

// 持ち物: アルバスの剣は共有の持ち物にあり、ほかの味方に持たせて装備できる
assert.deepEqual(trialStartingGear("albas"), { items: [], equipped: null });
assert.equal(trialCounterPlan({ equipped: null, distance: 1 }).reason, "装備なし");
assert.equal(trialCarriedWeapon(trialStartingGear("ringholm")), "trial_sword");
assert.deepEqual(books("herel"), ["star_book"]);
let gears = { ringholm: trialStartingGear("ringholm"), albas: trialStartingGear("albas") };
let moved = trialGearTransfer(gears, ["albas_sword"], "stock", "albas", "albas_sword");
assert.equal(moved.ok, true);
assert.deepEqual(moved.gears.albas.items, ["albas_sword"]);
assert.deepEqual(moved.stock, []);
assert.equal(trialGearEquip(moved.gears.albas, "albas_sword").gear.equipped, "albas_sword");
// 装備中の剣を共有の持ち物にしまうと、残りの最初の持ち物（火の魔導書）を装備する
moved = trialGearTransfer(gears, [], "ringholm", "stock", "trial_sword");
assert.deepEqual([moved.gears.ringholm.items, moved.gears.ringholm.equipped, moved.stock], [["fire_book"], "fire_book", ["trial_sword"]]);
// 持っていないものは装備できない。持てる数を超えては渡せない
assert.equal(trialGearEquip(gears.ringholm, "albas_sword").changed, false);
const fullGear = { items: Array(TRIAL_ITEM_CAPACITY).fill("trial_sword"), equipped: "trial_sword" };
assert.equal(trialGearTransfer({ ringholm: fullGear }, ["albas_sword"], "stock", "ringholm", "albas_sword").reason, "full");

// 物理ダメージの威力補正は括弧の外（+5 はそのまま +5 効く。括弧の中だと +2.5 になっていた）
assert.equal(trialPhysicalDamage(30, 20, 6, 0), 11);
assert.equal(trialPhysicalDamage(30, 20, 6, 5), 16);
assert.equal(trialPhysicalDamage(10, 40, 6, 0), 1);   // 最低1

// 追撃: 速さ差5以上
assert.equal(trialCanFollowUp({ spd: 30 }, { spd: 25 }), true);
assert.equal(trialCanFollowUp({ spd: 29 }, { spd: 25 }), false);

console.log("trialStatSystem: all tests passed");
