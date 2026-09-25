const assert = require("node:assert/strict");
const {
    bpStrike,
    bpPlanExchange,
    bpForecast,
    bpFixedRolls,
    bpForecastRolls,
    bpScoreAttack,
    bpPlanArea,
    bpPlanDrain,
} = require("../battlePlan.js");

// 基本の数値だけを持つスナップショット
function unit(id, overrides = {}) {
    return {
        id, name: id, side: "ally", x: 0, y: 0, hp: 30, maxHp: 30, mp: 20,
        stats: { hp: 30, atk: 30, def: 20, mag: 30, res: 20, tec: 20, spd: 20, cha: 20 },
        siz: 11, courage: 60, luck: 50, abilityNames: [], statusEffects: [],
        equippedItem: "trial_sword", grimoireSpell: null,
        criticalBonus: 0, criticalAvoidanceBonus: 0, canCounterBase: true, prayerUsed: false,
        ...overrides,
    };
}
const FIRE = { id: "火", effectType: "magicDamage", targetType: "enemy", mpCost: "1d6", statusEffect: null };
const BREAK = { id: "破壊", effectType: "break", targetType: "enemy", mpCost: "1d6" };
const weapon = { kind: "weapon" };
const roles = plan => plan.steps.map(step => step.type === "strike" ? step.role : `check:${step.ok}`);

// ── 1撃の計算 ──
{
    const a = unit("a");
    const d = unit("d", { side: "enemy", x: 1 });
    const s = bpStrike(a, d, weapon);
    assert.equal(s.hitRate, 60, "命中 60 + (技20 - 速さ20) × 2.5");
    assert.equal(s.damage, 11, "武器6 + (力30 - 防御20) ÷ 2");
    assert.equal(s.critRate, 12, "必殺 技20 + 勇気60÷5 - 魅力20");
    assert.equal(s.critDamage, 33, "必殺は3倍");
    // 反撃は半分（切り捨て、最低1）
    assert.equal(bpStrike(d, a, { kind: "weapon", isCounter: true }).damage, 5);
    // 魔法: 呪文6 + (魔攻30 - 魔防20) ÷ 2
    assert.equal(bpStrike(a, d, { kind: "grimoire", spell: FIRE }).damage, 11);
    // 殺気: 命中+20（命中+10・相手の回避−10）、必殺+10。反撃では効かない
    const ring = unit("ring", { abilityNames: ["殺気"] });
    assert.equal(bpStrike(ring, d, weapon).hitRate, 80);
    assert.equal(bpStrike(ring, d, weapon).critRate, 22);
    assert.equal(bpStrike(ring, d, { kind: "weapon", isCounter: true }).hitRate, 60);
    // 戦技は1撃目だけ: 両断1.5倍、復讐は減ったHPを加算
    assert.equal(bpStrike(a, d, { kind: "weapon", artName: "両断" }).damage, 16);
    assert.equal(bpStrike(a, d, { kind: "weapon", artName: "両断", isFollowUp: true }).damage, 11);
    assert.equal(bpStrike(unit("hurt", { hp: 14 }), d, { kind: "weapon", artName: "復讐" }).damage, 27);
    assert.equal(bpStrike(a, d, { kind: "weapon", artName: "大振り" }).hitRate, 30);
    // 一族スキル: 対応属性の魔法で命中+20・1.5倍
    const clan = unit("clan", { abilityNames: ["黒の一族"] });
    assert.deepEqual([bpStrike(clan, d, { kind: "grimoire", spell: FIRE }).hitRate, bpStrike(clan, d, { kind: "grimoire", spell: FIRE }).damage], [80, 16]);
    // スタン中は必ず命中
    assert.equal(bpStrike(a, unit("stun", { statusEffects: [{ type: "stun" }] }), weapon).hitRate, 100);
}

// ── 交戦の順番（原作者の決定 2026-09-25） ──
{
    const fast = unit("fast", { stats: { hp: 30, atk: 30, def: 20, mag: 30, res: 20, tec: 20, spd: 30, cha: 20 } });
    const slow = unit("slow", { side: "enemy", x: 1 });

    // 1B: 最初の攻撃が外れても反撃する。2A: 外れても追撃する
    const missed = bpPlanExchange(fast, slow, weapon, {}, bpFixedRolls([
        99,      // hit（外れ）
        10,      // counter（勇気60以下で反撃）
        10, 99,  // 反撃の hit（命中35%）・crit
        50, 99,  // 追撃の hit・crit
    ]));
    assert.deepEqual(roles(missed), ["attack", "check:true", "counter", "followUp"]);
    assert.equal(missed.steps[0].hit, false);
    assert.equal(missed.steps[2].hit, true);
    assert.equal(missed.steps[3].hit, true);

    // 反撃の追撃（防御側が速い）
    const counterFollow = bpPlanExchange(slow, fast, weapon, {}, bpFixedRolls([10, 99, 10, 50, 99, 50, 99]));   // 遅い側の命中は35%
    assert.deepEqual(roles(counterFollow), ["attack", "check:true", "counter", "counterFollowUp"]);

    // 3B: 魔導書の魔法も追撃する
    const book = { kind: "grimoire", spell: FIRE };
    const bookPlan = bpPlanExchange(fast, slow, book, {}, bpForecastRolls());
    assert.equal(bookPlan.steps.filter(step => step.role === "followUp").length, 1);
    // 4A: 魔法の戦技は追撃しない
    const artPlan = bpPlanExchange(fast, slow, { kind: "magicArt", spell: BREAK }, {}, bpForecastRolls());
    assert.equal(artPlan.steps.some(step => step.role === "followUp"), false);
    // 奇襲も追撃しない
    assert.equal(bpPlanExchange(fast, slow, { kind: "weapon", artName: "奇襲" }).steps.some(step => step.role === "followUp"), false);

    // 途中で倒れたら、その先は起きない
    const weak = unit("weak", { side: "enemy", x: 1, hp: 5 });
    const ko = bpPlanExchange(fast, weak, weapon, {}, bpFixedRolls([50, 99]));
    assert.deepEqual(roles(ko), ["attack"]);
    assert.equal(ko.defender.hp, 0);
}

// ── 反撃できるか（装備の射程） ──
{
    const mage = unit("mage", { x: 0, y: 0, equippedItem: "fire_book", grimoireSpell: FIRE });
    const sword = unit("sword", { side: "enemy", x: 0, y: 2 });
    // 距離2から魔法 → 剣（射程1）は反撃できない
    const far = bpPlanExchange(mage, sword, { kind: "grimoire", spell: FIRE });
    assert.deepEqual(far.steps.find(step => step.type === "counterCheck"), { type: "counterCheck", ok: false, reason: "射程外", actorId: "sword", label: "仮の剣" });
    // 魔導書を装備した防御側は、魔導書の魔法で反撃する
    const near = bpPlanExchange({ ...sword, y: 1 }, mage, weapon);
    const counter = near.steps.find(step => step.role === "counter");
    assert.equal(counter.kind, "grimoire");
    assert.equal(counter.spellId, "火");
    // 装備なしは反撃できない
    assert.equal(bpPlanExchange(sword, unit("bare", { x: 0, y: 1, equippedItem: null })).steps[1].reason, "装備なし");
    // 野望: 反撃を封じる
    const albas = unit("albas", { abilityNames: ["野望"], stats: { hp: 30, atk: 30, def: 20, mag: 30, res: 20, tec: 20, spd: 20, cha: 40 } });
    const sealed = bpPlanExchange(albas, unit("e", { side: "enemy", x: 1 }), weapon, {}, bpFixedRolls([50, 99, 10, 30]));
    assert.equal(sealed.steps[1].seal.active, true);
    assert.equal(sealed.steps.some(step => step.role === "counter"), false);
}

// ── 祈り・カウンター ──
{
    const a = unit("a", { stats: { hp: 30, atk: 60, def: 20, mag: 30, res: 20, tec: 20, spd: 20, cha: 20 } });
    const pious = unit("pious", { side: "enemy", x: 1, hp: 10, abilityNames: ["祈り"], luck: 90 });
    const saved = bpPlanExchange(a, pious, weapon, {}, bpFixedRolls([50, 99, 5, 100]));
    assert.equal(saved.steps[0].prayer.saved, true);
    assert.equal(saved.steps[0].targetHpAfter, 1);
    assert.equal(saved.defender.prayerUsed, true);

    const reflector = unit("reflector", { side: "enemy", x: 1, abilityNames: ["カウンター"] });
    const reflected = bpPlanExchange(unit("b"), reflector, weapon, {}, bpFixedRolls([50, 99, 1, 100]));
    assert.equal(reflected.steps[0].reflect.damage, 5, "受けた11の半分を返す");
    assert.equal(reflected.attacker.hp, 25);
}

// ── 戦闘予測: 見込みは「命中・必殺なし・反撃あり」 ──
{
    const fast = unit("fast", { stats: { hp: 30, atk: 30, def: 20, mag: 30, res: 20, tec: 20, spd: 30, cha: 20 } });
    const slow = unit("slow", { side: "enemy", x: 1 });
    const f = bpForecast(fast, slow, weapon);
    assert.equal(f.first.dealt, 11);
    assert.equal(f.followUp.dealt, 11);
    assert.equal(f.counter.dealt, 5);
    assert.equal(f.defenderHpAfter, 8);
    assert.equal(f.attackerHpAfter, 25);
    // 戦技は1撃目だけ（予測でも「16+11」）
    const art = bpForecast(fast, slow, { kind: "weapon", artName: "両断" });
    assert.deepEqual([art.first.dealt, art.followUp.dealt], [16, 11]);
    // 入力のスナップショットは書き換えない
    assert.equal(slow.hp, 30);
}

// ── 敵の行動選びの評価 ──
{
    const enemy = unit("enemy", { side: "enemy" });
    const score = (target, attacker = enemy) => bpScoreAttack(bpForecast(attacker, target, weapon), target.hp, attacker.hp);
    // 倒せる相手を優先する
    const low = score(unit("low", { x: 1, hp: 8 }));
    const full = score(unit("full", { x: 1 }));
    assert.equal(low.killChance, 0.6);
    assert.ok(low.score > full.score);
    // 反撃できない相手（装備なし）は、受けるダメージがないぶん高く評価する
    const bare = score(unit("bare", { x: 1, equippedItem: null }));
    assert.equal(bare.expectedTaken, 0);
    assert.ok(bare.score > full.score);
    // 距離2から魔導書で攻撃すれば、剣の相手から反撃を受けない
    const mage = unit("mage", { side: "enemy", equippedItem: "fire_book", grimoireSpell: FIRE });
    const bookAction = { kind: "grimoire", spell: FIRE };
    const at1 = bpScoreAttack(bpForecast(mage, unit("t", { x: 1 }), bookAction), 30, 30);
    const at2 = bpScoreAttack(bpForecast(mage, unit("t", { x: 2 }), bookAction), 30, 30);
    assert.ok(at1.expectedTaken > 0);
    assert.equal(at2.expectedTaken, 0);
    assert.ok(at2.score > at1.score);
    // 反撃で倒されうる選択肢は大きく減点
    const fragile = unit("fragile", { side: "enemy", hp: 3 });
    assert.ok(score(unit("t2", { x: 1 }), fragile).lethalCounter > 0);
}

// ── 戦技の効果 ──
{
    const LIGHTNING = { id: "落雷", effectType: "magicDamage", targetType: "enemy", mpCost: "1d6" };
    const caster = unit("caster", { stats: { hp: 30, atk: 20, def: 20, mag: 40, res: 20, tec: 20, spd: 30, cha: 20 } });
    const foe = unit("foe", { side: "enemy", x: 1, hp: 60, maxHp: 60 });
    // 落雷: 命中後に魔攻÷2（20%）で封じる → その交戦で反撃できない
    const sealed = bpPlanExchange(caster, foe, { kind: "magicArt", artName: "落雷", spell: LIGHTNING }, {}, bpFixedRolls([50, 99, 10]));
    assert.deepEqual(sealed.steps[0].artSeal, { roll: 10, chance: 20, active: true });
    assert.equal(sealed.steps[1].reason, "封じられている");
    assert.equal(sealed.defender.statusEffects.some(e => e.type === "sealed"), true);
    // 封じが外れれば反撃の判定をする
    const notSealed = bpPlanExchange(caster, foe, { kind: "magicArt", artName: "落雷", spell: LIGHTNING }, {}, bpFixedRolls([50, 99, 50, 10, 50, 99]));
    assert.equal(notSealed.steps[1].ok, true);
    // 予測の見込みでは封じは起きない（反撃ありで見積もる）が、補正の欄に発動率を出す
    assert.ok(bpForecast(caster, foe, { kind: "magicArt", artName: "落雷", spell: LIGHTNING }).first.notes.includes("落雷:封じ20%"));
    // 封じられた側は追撃できない
    const sealedFast = unit("sf", { stats: { hp: 30, atk: 30, def: 20, mag: 30, res: 20, tec: 20, spd: 40, cha: 20 }, statusEffects: [{ type: "sealed" }] });
    assert.equal(bpPlanExchange(sealedFast, unit("s", { side: "enemy", x: 1 }), weapon).steps.some(s => s.role === "followUp"), false);
    // 虚像: 命中−20
    assert.equal(bpStrike(unit("blind", { statusEffects: [{ type: "hitDown", value: 20 }] }), unit("t", { x: 1 }), weapon).hitRate, 40);

    // 円舞・万雷: 範囲の対象それぞれに1撃。反撃はない。魔法のMPは1回だけ
    const area = bpPlanArea(caster, [unit("e1", { side: "enemy", x: 1 }), unit("e2", { side: "enemy", x: 2 })],
        { kind: "magicArt", artName: "万雷", spell: LIGHTNING }, {}, bpFixedRolls([50, 99, 99, 50, 99, 99], [4]));
    assert.deepEqual(area.steps.map(s => [s.targetId, s.role, s.mpCost]), [["e1", "area", 4], ["e2", "area", 0]]);

    // 月詠: 最大HPの20%を削る（最低1） / 生命吸収: 10%を削り、合計を自分のHP・MPへ
    const moon = bpPlanDrain(caster, [unit("m1", { maxHp: 40, hp: 40 }), unit("m2", { maxHp: 3, hp: 3 })], 20);
    assert.deepEqual(moon.hits.map(h => h.damage), [8, 1]);
    const life = bpPlanDrain(unit("l", { hp: 20, maxHp: 30, mp: 10, maxMp: 36 }), [unit("v1", { maxHp: 40, hp: 40 }), unit("v2", { maxHp: 50, hp: 2 })], 10, true);
    assert.deepEqual([life.healed, life.attackerHpAfter, life.attackerMpAfter], [6, 26, 16]);   // 4 + （5だが残りHP2まで）
}

console.log("battlePlan: all tests passed");
