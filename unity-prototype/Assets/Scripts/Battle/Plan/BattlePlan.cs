using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Srpg.Battle.Plan
{
    /// <summary>乱数（battlePlan.js の rolls）。Percent: 1〜100、Dice: "1d6" などを振る</summary>
    public interface IPlanRolls
    {
        int Percent(string label);
        int Dice(string formula);
    }

    /// <summary>本物の乱数</summary>
    public class RandomRolls : IPlanRolls
    {
        private readonly Random random;
        public RandomRolls(Random random = null) { this.random = random ?? new Random(); }
        public int Percent(string label) => random.Next(100) + 1;
        public int Dice(string formula)
        {
            var d = BattlePlan.ParseDice(formula);
            int total = d.bonus;
            for (int i = 0; i < d.count; i++) total += random.Next(d.sides) + 1;
            return total;
        }
    }

    /// <summary>戦闘予測の見込み: 攻撃は命中し、必殺は出ない。反撃は起き、野望の封じ・祈り・カウンター・詠唱破棄は起きない。MPはダイスの平均（切り上げ）</summary>
    public class ForecastRolls : IPlanRolls
    {
        public int Percent(string label) => label == "hit" || label == "counter" ? 1 : 100;
        public int Dice(string formula)
        {
            var d = BattlePlan.ParseDice(formula);
            return (int)Math.Ceiling(d.bonus + d.count * (d.sides + 1) / 2.0);
        }
    }

    /// <summary>テスト用: 決めた順に値を返す。尽きたら Percent は 100（失敗側）、Dice は 1</summary>
    public class FixedRolls : IPlanRolls
    {
        private readonly Queue<int> percents;
        private readonly Queue<int> dice;
        public readonly List<string> used = new List<string>();
        public FixedRolls(IEnumerable<int> percents, IEnumerable<int> dice = null)
        {
            this.percents = new Queue<int>(percents ?? Array.Empty<int>());
            this.dice = new Queue<int>(dice ?? Array.Empty<int>());
        }
        public int Percent(string label)
        {
            int value = percents.Count > 0 ? percents.Dequeue() : 100;
            used.Add($"{label}:{value}");
            return value;
        }
        public int Dice(string formula) => dice.Count > 0 ? dice.Dequeue() : 1;
    }

    /// <summary>
    /// 交戦の計画（ブラウザ版 battlePlan.js を移したもの。規則を変えるときは両方を直し、
    /// tools/export_unity_battle_plan.mjs で答え合わせの結果を書き出し直してテストする）。
    /// 1回の交戦（攻撃 → 反撃 → 追撃）で起きることを、起きる順の一覧にする。
    /// 戦闘予測は見込みの乱数、実際の戦闘は本物の乱数で同じ計算を通すため、予測と実際がずれない。
    /// 原作者の決定（2026-09-25）: 最初の攻撃が外れても反撃する／外れても追撃する／魔導書の魔法も追撃する／魔法の戦技は追撃しない。
    /// 射程内なら必ず反撃する（野望だけが確率で封じる）。
    /// </summary>
    public static class BattlePlan
    {
        public const int CriticalMultiplier = 3;
        private static readonly HashSet<string> DamagingEffects = new HashSet<string> { "magicDamage", "break" };
        private static readonly HashSet<string> OffensiveEffects = new HashSet<string>
            { "magicDamage", "areaDamage", "break", "stun", "accuracyDown", "nightmare", "gravityField" };
        private static readonly Dictionary<string, int> ArtHit = new Dictionary<string, int> { { "大振り", -30 }, { "破天", 10 }, { "奇襲", 50 } };
        private static readonly Dictionary<string, double> ArtMultiplier = new Dictionary<string, double> { { "両断", 1.5 }, { "大振り", 2 } };
        private static readonly HashSet<string> SealArts = new HashSet<string> { "落雷", "万雷" };

        /// <summary>持ち物の一覧（武器の威力・射程、魔導書かどうか）。戦闘の状態の JSON から入れる</summary>
        public static Dictionary<string, PlanItem> Items = new Dictionary<string, PlanItem>();

        public static void SetItems(IEnumerable<PlanItem> items)
        {
            Items = new Dictionary<string, PlanItem>();
            foreach (var item in items ?? Array.Empty<PlanItem>()) Items[item.id] = item;
        }

        public struct DiceFormula { public int count, sides, bonus; }

        public static DiceFormula ParseDice(string formula)
        {
            var m = Regex.Match((formula ?? "").Trim(), @"^(\d+)d(\d+)(?:\+(\d+))?$");
            if (!m.Success)
            {
                if (double.TryParse(formula, out var flat)) return new DiceFormula { count = 0, sides = 0, bonus = (int)flat };
                return new DiceFormula { count = 1, sides = 6, bonus = 0 };
            }
            return new DiceFormula
            {
                count = int.Parse(m.Groups[1].Value),
                sides = int.Parse(m.Groups[2].Value),
                bonus = m.Groups[3].Success ? int.Parse(m.Groups[3].Value) : 0,
            };
        }

        /// <summary>封じ（落雷・万雷）の発動率: 魔攻÷2 %</summary>
        public static int ArtSealChance(PlanStats stats) => Math.Max(0, Math.Min(100, (stats?.mag ?? 0) / 2));

        private static bool Sealed(PlanUnit unit) => unit.statusEffects.Any(e => e.type == "sealed");
        private static int StatusSum(PlanUnit unit, string[] types, int scale = 1) =>
            unit.statusEffects.Where(e => types.Contains(e.type)).Sum(e => e.value * scale);
        public static bool IsMagic(PlanAction action) => action.kind == "grimoire" || action.kind == "magicArt";
        public static bool IsDamaging(PlanAction action) => !IsMagic(action) || (action.spell != null && DamagingEffects.Contains(action.spell.effectType ?? ""));

        private static int WeaponPower(PlanUnit unit) =>
            unit.equippedItem != null && Items.TryGetValue(unit.equippedItem, out var item) && item.kind == "weapon" ? item.power : TrialRules.WeaponPowerMid;

        public struct Strike
        {
            public bool autoHit;
            public int hitRate, damage, critRate, critDamage;
            public List<string> notes;
        }

        /// <summary>1撃の命中率・ダメージ・必殺率（乱数は振らない）</summary>
        public static Strike StrikeOf(PlanUnit attacker, PlanUnit defender, PlanAction action, IList<PlanUnit> units)
        {
            var notes = new List<string>();
            bool magic = IsMagic(action);
            bool firstStrike = !action.isCounter && !action.isFollowUp;
            string art = firstStrike && action.kind == "weapon" ? action.artName : null;

            // 命中
            var aura = TrialRules.AuraModifiers(attacker, defender, units);
            var attack = TrialRules.AttackModifiers(attacker.abilityNames, defender.abilityNames, action.isCounter, magic, action.spell?.id);
            bool sakki = attacker.Has("殺気") && !action.isCounter;
            string sealArt = firstStrike && action.kind == "magicArt" && action.artName != null && SealArts.Contains(action.artName) ? action.artName : null;
            if (sealArt != null) notes.Add($"{sealArt}:封じ{ArtSealChance(attacker.stats)}%");
            if (sakki) notes.Add("殺気:必殺+10");
            notes.AddRange(aura.notes);
            notes.AddRange(attack.notes);
            int accuracy = StatusSum(attacker, new[] { "accuracyDown" }, 5)
                - StatusSum(attacker, new[] { "hitDown" })
                - StatusSum(defender, new[] { "evasionUp", "evasionBonus" })
                + (sakki ? 20 : 0)
                + aura.accuracy + attack.accuracy
                + (art != null && ArtHit.TryGetValue(art, out var artHit) ? artHit : 0);
            bool stunned = defender.statusEffects.Any(e => e.type == "stun");
            bool usesAccuracy = !magic || action.spell?.targetType == "enemy" || OffensiveEffects.Contains(action.spell?.effectType ?? "");
            bool autoHit = stunned || !usesAccuracy;
            int hitRate = autoHit ? 100 : TrialRules.HitRate(attacker.stats, defender.stats, defender.siz, accuracy);

            // ダメージ
            int raw = magic
                ? TrialRules.Damage(attacker.stats.mag, defender.stats.res, TrialRules.WeaponPowerMid)
                : TrialRules.PhysicalDamage(attacker.stats.atk, defender.stats.def, WeaponPower(attacker), 0);
            if (action.isCounter) raw = Math.Max(1, raw / 2);
            double multiplier = attack.damageMultiplier;
            int finalBonus = 0;
            if (art != null && ArtMultiplier.TryGetValue(art, out var artMultiplier))
            {
                multiplier *= artMultiplier;
                notes.Add(art == "両断" ? "両断:1.5倍" : "大振り:2倍・命中-30");
            }
            else if (art == "破天") notes.Add("破天:命中+10");
            else if (art == "奇襲") notes.Add("奇襲:相手の回避-50・追撃なし");
            else if (art == "復讐")
            {
                finalBonus = Math.Max(0, attacker.maxHp - attacker.hp);
                notes.Add($"復讐:威力+{finalBonus}");
            }
            int damage = IsDamaging(action) ? Math.Max(0, (int)Math.Floor((raw + finalBonus) * multiplier)) : 0;

            // 必殺
            int criticalModifier = attacker.criticalBonus + StatusSum(attacker, new[] { "criticalBonus" })
                - defender.criticalAvoidanceBonus - StatusSum(defender, new[] { "criticalAvoidance" })
                + (sakki ? 10 : 0) + attack.critical - aura.critGuard;
            int critRate = TrialRules.CriticalRate(attacker.stats, attacker.courage, defender.stats, criticalModifier);

            return new Strike { autoHit = autoHit, hitRate = hitRate, damage = damage, critRate = critRate, critDamage = damage * CriticalMultiplier, notes = notes };
        }

        public struct CounterCheck
        {
            public TrialRules.CounterPlan plan;
            public PlanAction action;
            public string label;
        }

        /// <summary>防御側が今の装備で反撃できるか</summary>
        public static CounterCheck CounterPlanFor(PlanUnit defender, PlanUnit attacker)
        {
            PlanItem item = null;
            if (defender.equippedItem != null) Items.TryGetValue(defender.equippedItem, out item);
            bool grimoire = item != null && item.kind == "grimoire";
            PlanSpell counterSpell = grimoire && defender.HasGrimoireSpell ? defender.grimoireSpell : null;
            var plan = TrialRules.Counter(
                item == null ? null : grimoire ? "grimoire" : "weapon",
                item != null && item.kind == "weapon" ? item.range : 1,
                grimoire,
                grimoire && counterSpell != null && DamagingEffects.Contains(counterSpell.effectType ?? ""),
                defender.mp,
                TrialRules.Distance(defender, attacker),
                defender.Has("魔法射程+1") ? 1 : 0);
            return new CounterCheck
            {
                plan = plan,
                action = plan.kind == "grimoire"
                    ? new PlanAction { kind = "grimoire", spell = counterSpell, isCounter = true }
                    : new PlanAction { kind = "weapon", isCounter = true },
                label = item?.name ?? "装備なし",
            };
        }

        /// <summary>1撃を実行する（命中・必殺・結界・祈り・カウンターまで）。actor・target の HP・MP・状態を更新する</summary>
        private static PlanStep ResolveStrike(PlanUnit actor, PlanUnit target, PlanAction action, string role, IList<PlanUnit> units, IPlanRolls rolls)
        {
            var step = new PlanStep { type = "strike", role = role, actorId = actor.id, targetId = target.id, kind = action.kind, spellId = action.spell?.id };

            if (IsMagic(action) && action.freeCast)
            {
                step.mpCost = 0;
                step.actorMpAfter = actor.mp;
            }
            else if (IsMagic(action))
            {
                int mpCost = rolls.Dice(string.IsNullOrEmpty(action.spell?.mpCost) ? "1d6" : action.spell.mpCost);
                int quickChance = actor.Has("詠唱破棄") ? TrialRules.AbilityChance("詠唱破棄", actor.stats) : 0;
                if (quickChance > 0)
                {
                    int roll = rolls.Percent("quickCast");
                    step.quickCastRoll = roll; step.quickCastChance = quickChance; step.quickCastActive = roll <= quickChance;
                    if (step.quickCastActive) mpCost = 0;
                }
                step.mpCost = mpCost;
                actor.mp = Math.Max(0, actor.mp - mpCost);
                step.actorMpAfter = actor.mp;
            }

            var strike = StrikeOf(actor, target, action, units);
            step.autoHit = strike.autoHit;
            step.hitRate = strike.hitRate; step.damage = strike.damage; step.critRate = strike.critRate; step.critDamage = strike.critDamage;
            step.notes = strike.notes;
            step.hitRoll = strike.autoHit ? (int?)null : rolls.Percent("hit");
            step.hit = strike.autoHit || step.hitRoll <= strike.hitRate;
            if (!step.hit)
            {
                step.dealt = 0;
                step.targetHpAfter = target.hp;
                return step;
            }

            step.critRoll = rolls.Percent("crit");
            step.crit = step.critRoll <= strike.critRate;
            int beforeBarrier = step.crit ? strike.critDamage : strike.damage;

            // 結界（装甲）
            var barrier = target.statusEffects.FirstOrDefault(e => e.type == "barrier");
            int absorbed = 0;
            if (barrier != null && barrier.value > 0)
            {
                absorbed = Math.Min(barrier.value, beforeBarrier);
                bool breaks = action.spell?.effectType == "break";
                barrier.value -= absorbed;
                if (breaks || barrier.value <= 0) target.statusEffects.Remove(barrier);
                step.barrierAbsorbed = absorbed;
                step.barrierBroken = breaks || barrier.value <= 0;
            }
            step.dealt = beforeBarrier - absorbed;
            int hpBefore = target.hp;
            target.hp = Math.Max(0, target.hp - step.dealt);

            // 魔法の状態異常（10ダメージ以上。結界の前のダメージで判定）
            if (IsMagic(action) && !string.IsNullOrEmpty(action.spell?.statusEffect) && beforeBarrier >= 10)
            {
                if (action.spell.statusEffect == "burn")
                {
                    int duration = rolls.Dice("1d6");
                    target.statusEffects.Add(new PlanStatus { type = "burn", duration = duration });
                    step.status = "burn"; step.statusDuration = duration;
                }
                else if (action.spell.statusEffect == "slow")
                {
                    target.statusEffects.Add(new PlanStatus { type = "accuracyDown", value = -1, duration = 3 });
                    step.status = "accuracyDown"; step.statusDuration = 3;
                }
                else if (action.spell.statusEffect == "knockback")
                {
                    step.status = "knockback";
                }
            }

            // 落雷・万雷: 命中後に魔攻÷2 %で封じる（倒れていなければ）
            if (!action.isCounter && !action.isFollowUp && action.kind == "magicArt" && action.artName != null && SealArts.Contains(action.artName) && target.hp > 0)
            {
                int chance = ArtSealChance(actor.stats);
                int roll = rolls.Percent("artSeal");
                step.artSealRoll = roll; step.artSealChance = chance; step.artSealActive = roll <= chance;
                if (step.artSealActive && !Sealed(target))
                    target.statusEffects.Add(new PlanStatus { type = "sealed", holdOwnPhase = true, name = "封じ" });
            }

            step.prayerSaved = Prayer(target, hpBefore, rolls);
            step.targetHpAfter = target.hp;

            // カウンター（被ダメージの半分を返す）
            if (step.dealt > 0 && target.hp > 0 && actor.hp > 0 && target.Has("カウンター"))
            {
                int chance = TrialRules.AbilityChance("カウンター", target.stats, target.maxHp);
                int roll = rolls.Percent("reflect");
                if (roll <= chance)
                {
                    int back = Math.Max(1, step.dealt / 2);
                    int actorHpBefore = actor.hp;
                    actor.hp = Math.Max(0, actor.hp - back);
                    step.reflectDamage = back;
                    Prayer(actor, actorHpBefore, rolls);
                    step.reflectActorHpAfter = actor.hp;
                }
                else step.reflectDamage = 0;
            }
            return step;
        }

        /// <summary>祈り: 戦闘中1度だけ、HPが0になったとき幸運%でHP1で耐える。発動の判定がなければ null</summary>
        private static bool? Prayer(PlanUnit unit, int hpBefore, IPlanRolls rolls)
        {
            if (unit.hp > 0 || hpBefore <= 0 || unit.prayerUsed || !unit.Has("祈り")) return null;
            unit.prayerUsed = true;
            int chance = TrialRules.AbilityChance("祈り", unit.stats, luck: unit.luck);
            int roll = rolls.Percent("prayer");
            bool saved = roll <= chance;
            if (saved) unit.hp = 1;
            return saved;
        }

        private static bool Alive(PlanUnit unit) => unit.hp > 0;

        /// <summary>
        /// 1回の交戦の計画を作る。attacker・defender は写して使い、交戦後の状態を返す（元は書き換えない）。
        /// 順番: 攻撃 → 反撃（外れても判定する） → 追撃（速いほうが1回。攻撃側は外れても追撃する）。
        /// 魔導書の魔法も追撃する。魔法の戦技と奇襲は追撃しない。
        /// </summary>
        public static PlanResult PlanExchange(PlanUnit attackerSnapshot, PlanUnit defenderSnapshot, PlanAction action,
            IEnumerable<PlanUnit> envUnits, IPlanRolls rolls, bool passiveBattle = false)
        {
            var attacker = attackerSnapshot.Clone();
            var defender = defenderSnapshot.Clone();
            var units = (envUnits ?? Array.Empty<PlanUnit>())
                .Select(unit => unit.id == attacker.id ? attacker : unit.id == defender.id ? defender : unit).ToList();
            var result = new PlanResult { attacker = attacker, defender = defender };
            var first = action.With(isCounter: false, isFollowUp: false);

            result.steps.Add(ResolveStrike(attacker, defender, first, "attack", units, rolls));

            // 反撃
            PlanAction counterAction = null;
            if (IsDamaging(first) && Alive(attacker) && Alive(defender) && !passiveBattle && defender.canCounterBase)
            {
                var counter = CounterPlanFor(defender, attacker);
                if (Sealed(defender))
                    result.steps.Add(new PlanStep { type = "counterCheck", ok = false, reason = "封じられている", actorId = defender.id, label = counter.label });
                else if (!counter.plan.canCounter)
                    result.steps.Add(new PlanStep { type = "counterCheck", ok = false, reason = counter.plan.reason, actorId = defender.id, label = counter.label });
                else
                {
                    // 射程内なら必ず反撃する。野望だけが確率で封じる
                    var check = new PlanStep { type = "counterCheck", actorId = defender.id, label = counter.label };
                    if (attacker.Has("野望"))
                    {
                        int sealChance = TrialRules.AbilityChance("野望", attacker.stats);
                        int sealRoll = rolls.Percent("seal");
                        check.sealRoll = sealRoll; check.sealChance = sealChance; check.sealActive = sealRoll <= sealChance;
                    }
                    check.ok = !check.sealActive;
                    result.steps.Add(check);
                    if (check.ok)
                    {
                        counterAction = counter.action;
                        result.steps.Add(ResolveStrike(defender, attacker, counterAction, "counter", units, rolls));
                    }
                }
            }

            // 追撃（速いほうが1回）
            bool attackerCanFollow = first.kind == "weapon" ? first.artName != "奇襲" : first.kind == "grimoire" && attacker.mp > 0;
            if (attackerCanFollow && !Sealed(attacker) && Alive(attacker) && Alive(defender) && TrialRules.CanFollowUp(attacker.stats, defender.stats))
            {
                var followUp = first.kind == "weapon"
                    ? new PlanAction { kind = "weapon", isFollowUp = true }
                    : first.With(isFollowUp: true, artName: null);
                result.steps.Add(ResolveStrike(attacker, defender, followUp, "followUp", units, rolls));
            }
            else if (counterAction != null && !Sealed(defender) && Alive(attacker) && Alive(defender)
                && TrialRules.CanFollowUp(defender.stats, attacker.stats) && CounterPlanFor(defender, attacker).plan.canCounter)
            {
                result.steps.Add(ResolveStrike(defender, attacker, counterAction.With(isFollowUp: true), "counterFollowUp", units, rolls));
            }
            return result;
        }

        /// <summary>戦闘予測の要約（見込みの乱数で作った計画から）</summary>
        public class Forecast
        {
            public PlanResult plan;
            public PlanStep first, followUp, counter, counterFollowUp, counterCheck;
            public int attackerHpAfter, defenderHpAfter;
        }

        public static Forecast ForecastOf(PlanUnit attacker, PlanUnit defender, PlanAction action, IEnumerable<PlanUnit> envUnits, bool passiveBattle = false)
        {
            var plan = PlanExchange(attacker, defender, action, envUnits, new ForecastRolls(), passiveBattle);
            PlanStep Find(string role) => plan.steps.FirstOrDefault(s => s.type == "strike" && s.role == role);
            return new Forecast
            {
                plan = plan,
                first = Find("attack"),
                followUp = Find("followUp"),
                counter = Find("counter"),
                counterFollowUp = Find("counterFollowUp"),
                counterCheck = plan.steps.FirstOrDefault(s => s.type == "counterCheck"),
                attackerHpAfter = plan.attacker.hp,
                defenderHpAfter = plan.defender.hp,
            };
        }

        /// <summary>
        /// 敵の行動選び用: 攻撃の選択肢の評価（battlePlan.js の bpScoreAttack）。
        /// 与える見込み＋倒せる見込み×30 − 受ける見込み×0.5 − 反撃で倒されうる見込み×30
        /// </summary>
        public static double ScoreAttack(Forecast forecast, int defenderHp, int attackerHp)
        {
            var first = forecast.first;
            var followUp = forecast.followUp;
            double hitFirst = first.hit ? first.hitRate / 100.0 : 0;
            double hitFollow = followUp != null ? followUp.hitRate / 100.0 : 0;
            double expectedDealt = first.dealt * hitFirst + (followUp != null ? followUp.dealt * hitFollow : 0);

            double killChance = 0;
            if (first.dealt >= defenderHp) killChance = hitFirst;
            else if (followUp != null && first.dealt + followUp.dealt >= defenderHp) killChance = hitFirst * hitFollow;

            var check = forecast.counterCheck;
            double counterChance = check != null && string.IsNullOrEmpty(check.reason) ? 1 - (check.sealChance ?? 0) / 100.0 : 0;
            var counter = forecast.counter;
            var counterFollowUp = forecast.counterFollowUp;
            double takenIfCounter = counter != null
                ? counter.dealt * counter.hitRate / 100.0 + (counterFollowUp != null ? counterFollowUp.dealt * counterFollowUp.hitRate / 100.0 : 0)
                : 0;
            double expectedTaken = counterChance * takenIfCounter;
            double lethalCounter = counter != null && counter.dealt + (counterFollowUp?.dealt ?? 0) >= attackerHp
                ? counterChance * (counter.hitRate / 100.0)
                : 0;
            return expectedDealt + killChance * 30 - expectedTaken * 0.5 - lethalCounter * 30;
        }
    }
}
