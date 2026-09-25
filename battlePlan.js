// =====================================================================
//  battlePlan.js ― 交戦の計画（BattlePlan）を作る純粋処理
//
//  1回の交戦（攻撃 → 反撃 → 追撃）で起きることを、起きる順の一覧にする。
//  戦闘予測は「見込みの乱数」、実際の戦闘は「本物の乱数」で同じ計算を通すため、
//  予測と実際がずれない。DOM・戦闘中のユニットには触れない（入力はスナップショット）。
//
//  手順案: docs/30-planning/BATTLE_PLAN_MIGRATION_PLAN_2026-09-25.md
//  対象: 採用版ステータスのユニット同士（試験の戦闘）
//  原作者の決定（2026-09-25）:
//    最初の攻撃が外れても反撃する／外れても追撃する／魔導書の魔法も追撃する／魔法の戦技は追撃しない
// =====================================================================

const {
    trialHitRate: bpHitRate,
    trialDamage: bpMagicDamage,
    trialPhysicalDamage: bpPhysicalDamage,
    trialCriticalRate: bpCriticalRate,
    trialCanFollowUp: bpCanFollowUp,
    trialAuraModifiers: bpAuraModifiers,
    trialAttackModifiers: bpAttackModifiers,
    trialAbilityChance: bpAbilityChance,
    trialCounterPlan: bpCounterPlan,
    TRIAL_ITEMS: BP_ITEMS,
    TRIAL_WEAPON_POWER: BP_WEAPON_POWER,
} = typeof module !== "undefined" && module.exports
    ? require("./trialStatSystem.js")
    : {
        trialHitRate, trialDamage, trialPhysicalDamage, trialCriticalRate, trialCanFollowUp,
        trialAuraModifiers, trialAttackModifiers, trialAbilityChance, trialCounterPlan,
        TRIAL_ITEMS, TRIAL_WEAPON_POWER,
    };

const BP_DAMAGING_EFFECTS = new Set(["magicDamage", "break"]);
const BP_OFFENSIVE_EFFECTS = new Set([
    "magicDamage", "areaDamage", "break", "stun", "accuracyDown", "nightmare", "gravityField",
]);
const BP_CRITICAL_MULTIPLIER = 3;

// 物理の戦技（1撃目だけに乗る）
const BP_ART_HIT = Object.freeze({ "大振り": -30, "破天": 10, "奇襲": 50 });
const BP_ART_MULTIPLIER = Object.freeze({ "両断": 1.5, "大振り": 2 });

// 命中後に、魔攻÷2 %で相手の追撃・反撃・移動を封じる魔法の戦技（CSVの効果文）
const BP_SEAL_ARTS = new Set(["落雷", "万雷"]);

/** 封じの発動率（魔攻÷2 %） */
function bpArtSealChance(stats) {
    return Math.max(0, Math.min(100, Math.floor(Number(stats?.mag || 0) / 2)));
}

/** 封じ（落雷・万雷）を受けているか。追撃・反撃・移動ができない */
function bpSealed(unit) {
    return (unit?.statusEffects || []).some(effect => effect.type === "sealed");
}

// ── 乱数 ──
// percent(label): 1〜100。label は hit / crit / counter / seal / prayer / reflect / quickCast
// dice(formula): "1d6" などを振る

function bpParseDice(formula) {
    const m = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(String(formula || "").trim());
    if (!m) {
        const flat = Number(formula);
        return Number.isFinite(flat) ? { count: 0, sides: 0, bonus: flat } : { count: 1, sides: 6, bonus: 0 };
    }
    return { count: Number(m[1]), sides: Number(m[2]), bonus: Number(m[3] || 0) };
}

/** 本物の乱数 */
function bpRandomRolls(random = Math.random) {
    return {
        mode: "random",
        percent: () => Math.floor(random() * 100) + 1,
        dice: formula => {
            const d = bpParseDice(formula);
            let total = d.bonus;
            for (let i = 0; i < d.count; i++) total += Math.floor(random() * d.sides) + 1;
            return total;
        },
    };
}

/**
 * 戦闘予測の見込み: 攻撃は命中し、必殺は出ない。反撃は（できるなら）起き、野望の封じ・祈り・カウンター・詠唱破棄は起きない。
 * MPの消費はダイスの平均（切り上げ）
 */
function bpForecastRolls() {
    const always = new Set(["hit", "counter"]);
    return {
        mode: "forecast",
        percent: label => (always.has(label) ? 1 : 100),
        dice: formula => {
            const d = bpParseDice(formula);
            return Math.ceil(d.bonus + d.count * (d.sides + 1) / 2);
        },
    };
}

/** テスト用: 決めた順に値を返す。尽きたら 100（失敗側） */
function bpFixedRolls(percents = [], dice = []) {
    const p = [...percents];
    const d = [...dice];
    const used = [];
    return {
        mode: "fixed",
        used,
        percent: label => {
            const value = p.length ? p.shift() : 100;
            used.push(`${label}:${value}`);
            return value;
        },
        dice: () => (d.length ? d.shift() : 1),
    };
}

// ── 1撃の計算 ──

function bpHas(unit, name) {
    return (unit?.abilityNames || []).includes(name);
}

function bpStatusSum(unit, types, scale = 1) {
    return (unit?.statusEffects || [])
        .filter(effect => types.includes(effect.type))
        .reduce((sum, effect) => sum + Number(effect.value || 0) * scale, 0);
}

function bpIsMagic(action) {
    return action.kind === "grimoire" || action.kind === "magicArt";
}

function bpIsDamaging(action) {
    return !bpIsMagic(action) || BP_DAMAGING_EFFECTS.has(action.spell?.effectType);
}

function bpWeaponPower(unit) {
    const item = BP_ITEMS[unit?.equippedItem];
    return item?.kind === "weapon" ? item.power : BP_WEAPON_POWER.mid;
}

/**
 * 1撃の命中率・ダメージ・必殺率（乱数は振らない）
 *   action: { kind: "weapon"|"grimoire"|"magicArt", artName, spell, isCounter, isFollowUp }
 *   env: { units }（周囲の能力の判定に使う全ユニットのスナップショット）
 */
function bpStrike(attacker, defender, action, env = {}) {
    const notes = [];
    const magic = bpIsMagic(action);
    const firstStrike = !action.isCounter && !action.isFollowUp;
    const art = firstStrike && action.kind === "weapon" ? action.artName || null : null;

    // 命中
    const aura = bpAuraModifiers(attacker, defender, env.units || []);
    const attack = bpAttackModifiers(attacker.abilityNames, defender.abilityNames, {
        isCounter: !!action.isCounter, isMagic: magic, spellId: action.spell?.id,
    });
    const sakki = bpHas(attacker, "殺気") && !action.isCounter;
    const sealArt = firstStrike && action.kind === "magicArt" && BP_SEAL_ARTS.has(action.artName) ? action.artName : null;
    if (sealArt) notes.push(`${sealArt}:封じ${bpArtSealChance(attacker.stats)}%`);
    if (sakki) notes.push("殺気:必殺+10");
    notes.push(...aura.notes, ...attack.notes);
    let accuracy = bpStatusSum(attacker, ["accuracyDown"], 5)
        - bpStatusSum(attacker, ["hitDown"])     // 虚像: 命中−20
        - bpStatusSum(defender, ["evasionUp", "evasionBonus"])
        + (sakki ? 20 : 0)                       // 殺気: 命中+10・相手の回避−10
        + aura.accuracy + attack.accuracy
        + (art ? Number(BP_ART_HIT[art] || 0) : 0);
    const stunned = (defender.statusEffects || []).some(effect => effect.type === "stun");
    const usesAccuracy = !magic || action.spell?.targetType === "enemy" || BP_OFFENSIVE_EFFECTS.has(action.spell?.effectType);
    const autoHit = stunned || !usesAccuracy;
    const hitRate = autoHit ? 100 : bpHitRate(attacker.stats, defender.stats, defender.siz, accuracy);

    // ダメージ
    let raw = magic
        ? bpMagicDamage(attacker.stats.mag, defender.stats.res, BP_WEAPON_POWER.mid)
        : bpPhysicalDamage(attacker.stats.atk, defender.stats.def, bpWeaponPower(attacker), 0);
    if (action.isCounter) raw = Math.max(1, Math.floor(raw / 2));
    let multiplier = attack.damageMultiplier;
    let finalBonus = 0;
    if (art && BP_ART_MULTIPLIER[art]) {
        multiplier *= BP_ART_MULTIPLIER[art];
        notes.push(art === "両断" ? "両断:1.5倍" : "大振り:2倍・命中-30");
    } else if (art === "破天") {
        notes.push("破天:命中+10");
    } else if (art === "奇襲") {
        notes.push("奇襲:相手の回避-50・追撃なし");
    } else if (art === "復讐") {
        finalBonus = Math.max(0, Number(attacker.maxHp || 0) - Number(attacker.hp || 0));
        notes.push(`復讐:威力+${finalBonus}`);
    }
    const damage = bpIsDamaging(action) ? Math.max(0, Math.floor((raw + finalBonus) * multiplier)) : 0;

    // 必殺
    const criticalModifier = Number(attacker.criticalBonus || 0) + bpStatusSum(attacker, ["criticalBonus"])
        - Number(defender.criticalAvoidanceBonus || 0) - bpStatusSum(defender, ["criticalAvoidance"])
        + (sakki ? 10 : 0) + attack.critical - aura.critGuard;
    const critRate = bpCriticalRate(attacker.stats, attacker.courage, defender.stats, criticalModifier);

    return {
        autoHit,
        hitRate,
        damage,
        critRate,
        critDamage: Math.floor(damage * BP_CRITICAL_MULTIPLIER),
        formula: magic
            ? { magic: attacker.stats.mag, ward: defender.stats.res, power: BP_WEAPON_POWER.mid }
            : { attack: attacker.stats.atk, armor: defender.stats.def, power: bpWeaponPower(attacker) },
        notes,
    };
}

// ── 交戦の計画 ──

function bpCopy(unit) {
    return {
        ...unit,
        statusEffects: (unit.statusEffects || []).map(effect => ({ ...effect })),
        abilityNames: [...(unit.abilityNames || [])],
    };
}

function bpDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 防御側が今の装備で反撃できるか */
function bpCounterPlanFor(defender, attacker) {
    const item = BP_ITEMS[defender.equippedItem];
    const counterSpell = item?.kind === "grimoire" ? defender.grimoireSpell || null : null;
    const plan = bpCounterPlan({
        equipped: item ? (item.kind === "grimoire" ? "grimoire" : "weapon") : null,
        weaponRange: item?.kind === "weapon" ? item.range : 1,
        grimoire: item?.kind === "grimoire"
            ? { spell: item.spell, damaging: BP_DAMAGING_EFFECTS.has(counterSpell?.effectType) }
            : null,
        mp: defender.mp,
        distance: bpDistance(defender, attacker),
        grimoireRangeBonus: bpHas(defender, "魔法射程+1") ? 1 : 0,
    });
    return {
        ...plan,
        action: plan.kind === "grimoire"
            ? { kind: "grimoire", spell: counterSpell, isCounter: true }
            : { kind: "weapon", isCounter: true },
        label: item?.name || "装備なし",
    };
}

/** 1撃を実行する（命中・必殺・結界・祈り・カウンターまで）。state の HP・MP・結界を更新する */
function bpResolveStrike(actor, target, action, role, env, rolls) {
    const step = { type: "strike", role, actorId: actor.id, targetId: target.id, kind: action.kind, spellId: action.spell?.id || null };

    if (bpIsMagic(action) && action.freeCast) {
        step.mpCost = 0;
        step.actorMpAfter = actor.mp;
    } else if (bpIsMagic(action)) {
        let mpCost = rolls.dice(action.spell?.mpCost || "1d6");
        const quickChance = bpHas(actor, "詠唱破棄") ? bpAbilityChance("詠唱破棄", actor.stats) : 0;
        if (quickChance > 0) {
            const roll = rolls.percent("quickCast");
            step.quickCast = { roll, chance: quickChance, active: roll <= quickChance };
            if (step.quickCast.active) mpCost = 0;
        }
        step.mpCost = mpCost;
        actor.mp = Math.max(0, Number(actor.mp || 0) - mpCost);
        step.actorMpAfter = actor.mp;
    }

    const strike = bpStrike(actor, target, action, env);
    Object.assign(step, {
        hitRate: strike.hitRate, damage: strike.damage, critRate: strike.critRate,
        critDamage: strike.critDamage, formula: strike.formula, notes: strike.notes,
    });
    step.hitRoll = strike.autoHit ? null : rolls.percent("hit");
    step.hit = strike.autoHit || step.hitRoll <= strike.hitRate;
    if (!step.hit) {
        step.dealt = 0;
        step.targetHpAfter = target.hp;
        return step;
    }

    step.critRoll = rolls.percent("crit");
    step.crit = step.critRoll <= strike.critRate;
    const beforeBarrier = step.crit ? strike.critDamage : strike.damage;

    // 結界（装甲）
    const barrier = target.statusEffects.find(effect => effect.type === "barrier");
    let absorbed = 0;
    if (barrier && barrier.value > 0) {
        absorbed = Math.min(barrier.value, beforeBarrier);
        const breaks = action.spell?.effectType === "break";
        barrier.value -= absorbed;
        if (breaks || barrier.value <= 0) target.statusEffects = target.statusEffects.filter(effect => effect !== barrier);
        step.barrier = { absorbed, broken: breaks || barrier.value <= 0, remaining: breaks ? 0 : Math.max(0, barrier.value) };
    }
    step.dealt = beforeBarrier - absorbed;
    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - step.dealt);

    // 魔法の状態異常（10ダメージ以上。結界の前のダメージで判定）
    if (bpIsMagic(action) && action.spell?.statusEffect && beforeBarrier >= 10) {
        if (action.spell.statusEffect === "burn") {
            const duration = rolls.dice("1d6");
            target.statusEffects.push({ type: "burn", duration });
            step.status = { type: "burn", duration };
        } else if (action.spell.statusEffect === "slow") {
            target.statusEffects.push({ type: "accuracyDown", value: -1, duration: 3 });
            step.status = { type: "accuracyDown", duration: 3 };
        } else if (action.spell.statusEffect === "knockback") {
            step.status = { type: "knockback" };
        }
    }

    // 落雷・万雷: 命中後に魔攻÷2 %で封じる（倒れていなければ）
    if (!action.isCounter && !action.isFollowUp && action.kind === "magicArt" && BP_SEAL_ARTS.has(action.artName) && target.hp > 0) {
        const chance = bpArtSealChance(actor.stats);
        const roll = rolls.percent("artSeal");
        step.artSeal = { roll, chance, active: roll <= chance };
        if (step.artSeal.active && !bpSealed(target)) {
            target.statusEffects.push({ type: "sealed", holdOwnPhase: true, name: "封じ" });
        }
    }

    step.prayer = bpPrayer(target, hpBefore, rolls);
    step.targetHpAfter = target.hp;

    // カウンター（被ダメージの半分を返す）
    if (step.dealt > 0 && target.hp > 0 && actor.hp > 0 && bpHas(target, "カウンター")) {
        const chance = bpAbilityChance("カウンター", target.stats, { maxHp: target.maxHp });
        const roll = rolls.percent("reflect");
        if (roll <= chance) {
            const back = Math.max(1, Math.floor(step.dealt / 2));
            const actorHpBefore = actor.hp;
            actor.hp = Math.max(0, actor.hp - back);
            step.reflect = { roll, chance, damage: back, actorHpAfter: actor.hp, prayer: bpPrayer(actor, actorHpBefore, rolls) };
            step.reflect.actorHpAfter = actor.hp;
        } else {
            step.reflect = { roll, chance, damage: 0 };
        }
    }
    return step;
}

/** 祈り: 戦闘中1度だけ、HPが0になったとき幸運%でHP1で耐える */
function bpPrayer(unit, hpBefore, rolls) {
    if (unit.hp > 0 || hpBefore <= 0 || unit.prayerUsed || !bpHas(unit, "祈り")) return null;
    unit.prayerUsed = true;
    const chance = bpAbilityChance("祈り", unit.stats, { luck: unit.luck });
    const roll = rolls.percent("prayer");
    const saved = roll <= chance;
    if (saved) unit.hp = 1;
    return { roll, chance, saved };
}

function bpAlive(unit) {
    return Number(unit.hp) > 0;
}

/**
 * 1回の交戦の計画を作る。
 *   attacker・defender: スナップショット（下の「スナップショットの形」）
 *   action: 攻撃側の行動 { kind, artName, spell }
 *   env: { units, passiveBattle }
 *   rolls: bpRandomRolls() / bpForecastRolls() / bpFixedRolls()
 * 返り値: { steps, attacker, defender }（attacker・defender は交戦後の状態）
 *
 * 順番: 攻撃 → 反撃（外れても判定する） → 追撃（速いほうが1回。攻撃側は外れても追撃する）
 * 魔導書の魔法も追撃する。魔法の戦技と奇襲は追撃しない。
 */
function bpPlanExchange(attackerSnapshot, defenderSnapshot, action, env = {}, rolls = bpForecastRolls()) {
    const attacker = bpCopy(attackerSnapshot);
    const defender = bpCopy(defenderSnapshot);
    const units = (env.units || []).map(unit =>
        unit.id === attacker.id ? attacker : unit.id === defender.id ? defender : unit);
    const localEnv = { ...env, units };
    const steps = [];
    const firstAction = { ...action, isCounter: false, isFollowUp: false };

    steps.push(bpResolveStrike(attacker, defender, firstAction, "attack", localEnv, rolls));

    // 反撃
    let counterAction = null;
    if (bpIsDamaging(firstAction) && bpAlive(attacker) && bpAlive(defender) && !env.passiveBattle && defender.canCounterBase) {
        const plan = bpCounterPlanFor(defender, attacker);
        if (bpSealed(defender)) {
            steps.push({ type: "counterCheck", ok: false, reason: "封じられている", actorId: defender.id, label: plan.label });
        } else if (!plan.canCounter) {
            steps.push({ type: "counterCheck", ok: false, reason: plan.reason, actorId: defender.id, label: plan.label });
        } else {
            // 射程内なら必ず反撃する（FE式。原作者 2026-09-25: 勇気%の確率発動はやめる）。野望だけが確率で封じる
            const check = { type: "counterCheck", ok: false, actorId: defender.id, label: plan.label };
            if (bpHas(attacker, "野望")) {
                const sealChance = bpAbilityChance("野望", attacker.stats);
                const sealRoll = rolls.percent("seal");
                check.seal = { roll: sealRoll, chance: sealChance, active: sealRoll <= sealChance };
            }
            check.ok = !check.seal?.active;
            steps.push(check);
            if (check.ok) {
                counterAction = plan.action;
                steps.push(bpResolveStrike(defender, attacker, counterAction, "counter", localEnv, rolls));
            }
        }
    }

    // 追撃（速いほうが1回）
    const attackerCanFollow = firstAction.kind === "weapon"
        ? firstAction.artName !== "奇襲"
        : firstAction.kind === "grimoire" && Number(attacker.mp || 0) > 0;
    if (attackerCanFollow && !bpSealed(attacker) && bpAlive(attacker) && bpAlive(defender) && bpCanFollowUp(attacker.stats, defender.stats)) {
        const followUp = firstAction.kind === "weapon"
            ? { kind: "weapon", isFollowUp: true }
            : { ...firstAction, isFollowUp: true, artName: null };
        steps.push(bpResolveStrike(attacker, defender, followUp, "followUp", localEnv, rolls));
    } else if (counterAction && !bpSealed(defender) && bpAlive(attacker) && bpAlive(defender) && bpCanFollowUp(defender.stats, attacker.stats)
        && bpCounterPlanFor(defender, attacker).canCounter) {
        steps.push(bpResolveStrike(defender, attacker, { ...counterAction, isFollowUp: true }, "counterFollowUp", localEnv, rolls));
    }

    return { steps, attacker, defender };
}

/**
 * 範囲の攻撃（円舞・万雷）: 対象それぞれに1撃ずつ。反撃・追撃はない（範囲攻撃のため。仮の扱い）。
 * 魔法のMPは最初の1回だけ払う。返り値: { steps, attacker, targets }
 */
function bpPlanArea(attackerSnapshot, targetSnapshots, action, env = {}, rolls = bpForecastRolls()) {
    const attacker = bpCopy(attackerSnapshot);
    const targets = targetSnapshots.map(bpCopy);
    const units = (env.units || []).map(unit =>
        unit.id === attacker.id ? attacker : targets.find(t => t.id === unit.id) || unit);
    const localEnv = { ...env, units };
    const steps = [];
    targets.forEach((target, index) => {
        if (!bpAlive(attacker) || !bpAlive(target)) return;
        const strikeAction = { ...action, isCounter: false, isFollowUp: false };
        if (index > 0 && bpIsMagic(strikeAction)) strikeAction.freeCast = true;
        steps.push(bpResolveStrike(attacker, target, strikeAction, "area", localEnv, rolls));
    });
    return { steps, attacker, targets };
}

/**
 * 割合でHPを削る（月詠: 最大HPの20%、生命吸収: 10%を削り、その合計だけ自分のHP・MPを回復）。
 * 命中判定はなく、最低1。返り値: { hits: [{ targetId, damage, targetHpAfter }], healed, attackerHpAfter, attackerMpAfter }
 */
function bpPlanDrain(attackerSnapshot, targetSnapshots, percent, drain = false) {
    const hits = targetSnapshots.filter(bpAlive).map(target => {
        const damage = Math.max(1, Math.floor(Number(target.maxHp || 0) * percent / 100));
        return { targetId: target.id, damage, targetHpAfter: Math.max(0, target.hp - damage) };
    });
    const total = hits.reduce((sum, hit) => sum + Math.min(hit.damage, targetSnapshots.find(t => t.id === hit.targetId).hp), 0);
    const healed = drain ? total : 0;
    return {
        hits,
        healed,
        attackerHpAfter: Math.min(attackerSnapshot.maxHp, attackerSnapshot.hp + healed),
        attackerMpAfter: Math.min(Number(attackerSnapshot.maxMp ?? attackerSnapshot.mp), Number(attackerSnapshot.mp || 0) + healed),
    };
}

/**
 * 戦闘予測の要約（見込みの乱数で作った計画から）
 *   first: 1撃目、followUp: 攻撃側の追撃、counter: 反撃、counterFollowUp: 反撃の追撃
 */
function bpForecast(attackerSnapshot, defenderSnapshot, action, env = {}) {
    const plan = bpPlanExchange(attackerSnapshot, defenderSnapshot, action, env, bpForecastRolls());
    const find = role => plan.steps.find(step => step.type === "strike" && step.role === role) || null;
    const check = plan.steps.find(step => step.type === "counterCheck") || null;
    return {
        plan,
        first: find("attack"),
        followUp: find("followUp"),
        counter: find("counter"),
        counterFollowUp: find("counterFollowUp"),
        counterCheck: check,
        attackerHpAfter: plan.attacker.hp,
        defenderHpAfter: plan.defender.hp,
    };
}

/**
 * 敵の行動選び用: 攻撃の選択肢（相手・立ち位置）の評価。戦闘予測（bpForecast）の結果から作る。
 *   与える見込み: 1撃目と追撃のダメージ × 命中率
 *   倒せる見込み: 1撃目（または1撃目＋追撃）で倒せるなら、その命中率に応じて加点
 *   受ける見込み: 反撃（と反撃の追撃）のダメージ × 反撃の起きやすさ × 命中率。半分の重みで減点
 *   反撃で倒されうるなら、さらに減点
 */
const BP_AI_WEIGHTS = Object.freeze({ kill: 30, taken: 0.5, death: 30 });

function bpScoreAttack(forecast, defenderHp, attackerHp) {
    const first = forecast.first;
    const followUp = forecast.followUp;
    const hitFirst = first.hit === false ? 0 : first.hitRate / 100;
    const hitFollow = followUp ? followUp.hitRate / 100 : 0;
    const expectedDealt = first.dealt * hitFirst + (followUp ? followUp.dealt * hitFollow : 0);

    let killChance = 0;
    if (first.dealt >= defenderHp) killChance = hitFirst;
    else if (followUp && first.dealt + followUp.dealt >= defenderHp) killChance = hitFirst * hitFollow;

    const check = forecast.counterCheck;
    const counterChance = check && !check.reason
        ? 1 - (check.seal?.chance || 0) / 100
        : 0;
    const counter = forecast.counter;
    const counterFollowUp = forecast.counterFollowUp;
    const takenIfCounter = counter
        ? counter.dealt * counter.hitRate / 100 + (counterFollowUp ? counterFollowUp.dealt * counterFollowUp.hitRate / 100 : 0)
        : 0;
    const expectedTaken = counterChance * takenIfCounter;
    const lethalCounter = counter && (counter.dealt + (counterFollowUp?.dealt || 0)) >= attackerHp
        ? counterChance * (counter.hitRate / 100)
        : 0;

    const score = expectedDealt
        + killChance * BP_AI_WEIGHTS.kill
        - expectedTaken * BP_AI_WEIGHTS.taken
        - lethalCounter * BP_AI_WEIGHTS.death;
    return { score, expectedDealt, killChance, expectedTaken, lethalCounter };
}

/*
 * スナップショットの形（game.js 側で戦闘中のユニットから作る）
 *   { id, name, side, x, y, hp, maxHp, mp, stats: {hp, atk, def, mag, res, tec, spd, cha}, siz,
 *     courage（今の勇気。反撃率・必殺率に使う）, luck, abilityNames: [],
 *     statusEffects: [{ type, value, duration }], equippedItem, grimoireSpell（装備中の魔導書の魔法データ）,
 *     criticalBonus, criticalAvoidanceBonus, canCounterBase（反撃しない設定でないか）, prayerUsed }
 */

if (typeof module !== "undefined") {
    module.exports = {
        bpRandomRolls,
        bpForecastRolls,
        bpFixedRolls,
        bpStrike,
        bpCounterPlanFor,
        bpPlanExchange,
        bpForecast,
        bpScoreAttack,
        bpPlanArea,
        bpPlanDrain,
        bpArtSealChance,
    };
}
