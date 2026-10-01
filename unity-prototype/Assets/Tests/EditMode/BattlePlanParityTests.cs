using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle.Plan;
using UnityEngine;

namespace Srpg.Tests
{
    /// <summary>
    /// 交戦の計画の答え合わせ: ブラウザ版（battlePlan.js）で計算した結果と、Unity版（BattlePlan.cs）の結果が同じか。
    /// 答えは tools/export_unity_battle_plan.mjs がブラウザ版から書き出す（全ての味方×敵の組み合わせ、距離1・2、
    /// 戦闘予測と、乱数を決めて振った交戦3通り、物理の戦技）。
    /// </summary>
    public class BattlePlanParityTests
    {
        private const string StatePath = "Assets/Data/Battles/battle_trial_adopted_plan.json";
        private const string CasesPath = "Assets/Tests/EditMode/Fixtures/battle_plan_cases.json";

        [Serializable]
        private class StepSummary
        {
            public string role, kind, reason, status;
            public int hitRate, damage, critRate, critDamage, hitRoll, critRoll, dealt, targetHpAfter, mpCost, actorMpAfter, reflectDamage, prayerSaved, sealChance, sealActive;
            public int durabilityCost = -1, actorDurabilityAfter = -1;
            public bool hit, crit, ok;
        }

        [Serializable]
        private class Case
        {
            public string attackerId, defenderId, rolls, artName;
            public string optionKind, itemId, weaponItemId;   // 攻撃の選択肢（戦技・魔法の戦技・魔導書）の答え合わせ
            public string area;                               // 範囲の攻撃（円舞・万雷）の答え合わせ
            public AreaTarget[] areaTargets;
            public PlanSpell spell, equipSpell;
            public int distance, attackerHp;
            public int[] percents, dice;
            public StepSummary[] steps;
            public int attackerHpAfter, attackerMpAfter, defenderHpAfter, defenderMpAfter;
        }

        [Serializable]
        private class AreaTarget
        {
            public string id;
            public int x, y;
        }

        [Serializable]
        private class HitCase
        {
            public string casterId, targetId;
            public PlanSpell spell;
            public int rate;
        }

        [Serializable]
        private class DrainCase
        {
            public string attackerId;
            public int attackerHp, attackerMp, percent, healed, attackerHpAfter, attackerMpAfter;
            public bool drain;
            public string[] targetIds;
            public int[] damages, targetHpAfter;
        }

        [Serializable]
        private class CaseFile
        {
            public Case[] cases;
            public HitCase[] hits;
            public DrainCase[] drains;
        }

        /// <summary>専用戦技（月詠・生命吸収）の割合ダメージと吸収がブラウザ版と同じ</summary>
        [Test]
        public void DrainMatchesTheBrowserVersion()
        {
            var state = JsonUtility.FromJson<PlanStateFile>(File.ReadAllText(StatePath));
            var drains = JsonUtility.FromJson<CaseFile>(File.ReadAllText(CasesPath)).drains;
            Assert.Greater(drains.Length, 0);
            var failures = new List<string>();
            foreach (var d in drains)
            {
                var a = state.units.First(u => u.id == d.attackerId).Clone();
                int maxMp = a.mp;   // 書き出しの状態は満タン
                a.hp = d.attackerHp; a.mp = d.attackerMp;
                var targets = d.targetIds.Select(id => state.units.First(u => u.id == id)).ToList();
                var r = BattlePlan.PlanDrain(a, targets, d.percent, d.drain, maxMp);
                string where = $"{d.attackerId} {d.percent}%{(d.drain ? " 吸収" : "")}";
                if (!r.hits.Select(h => h.damage).SequenceEqual(d.damages)) failures.Add($"{where}: ダメージ {string.Join(",", r.hits.Select(h => h.damage))}（ブラウザ版 {string.Join(",", d.damages)}）");
                if (r.healed != d.healed || r.attackerHpAfter != d.attackerHpAfter || r.attackerMpAfter != d.attackerMpAfter)
                    failures.Add($"{where}: 回復 {r.healed}/{d.healed} HP {r.attackerHpAfter}/{d.attackerHpAfter} MP {r.attackerMpAfter}/{d.attackerMpAfter}");
            }
            Assert.IsEmpty(failures, string.Join("\n", failures));
        }

        /// <summary>虚像・封印の命中率がブラウザ版と同じ</summary>
        [Test]
        public void SupportHitRateMatchesTheBrowserVersion()
        {
            var state = JsonUtility.FromJson<PlanStateFile>(File.ReadAllText(StatePath));
            BattlePlan.SetItems(state.items);
            var hits = JsonUtility.FromJson<CaseFile>(File.ReadAllText(CasesPath)).hits;
            Assert.Greater(hits.Length, 0);
            var failures = new List<string>();
            foreach (var h in hits)
            {
                var caster = state.units.First(u => u.id == h.casterId);
                var target = state.units.First(u => u.id == h.targetId);
                int rate = BattlePlan.SupportHitRate(caster, target, h.spell, state.units.ToList());
                if (rate != h.rate) failures.Add($"{h.casterId}→{h.targetId} {h.spell.id}: {rate}%（ブラウザ版 {h.rate}%）");
            }
            Assert.IsEmpty(failures, string.Join("\n", failures));
        }

        [Test]
        public void MatchesTheBrowserVersion()
        {
            var state = JsonUtility.FromJson<PlanStateFile>(File.ReadAllText(StatePath));
            BattlePlan.SetItems(state.items);
            var cases = JsonUtility.FromJson<CaseFile>(File.ReadAllText(CasesPath)).cases;
            Assert.Greater(cases.Length, 200, "答え合わせの件数");

            var failures = new List<string>();
            foreach (var c in cases)
            {
                var a = state.units.First(u => u.id == c.attackerId);
                var d = state.units.First(u => u.id == c.defenderId);
                var attacker = a.Clone(); attacker.x = 5; attacker.y = 4;
                if (!string.IsNullOrEmpty(c.artName) || !string.IsNullOrEmpty(c.optionKind)) attacker.hp = c.attackerHp;
                var defender = d.Clone(); defender.x = 5 + c.distance; defender.y = 4;
                if (!string.IsNullOrEmpty(c.area))
                {
                    // 範囲の攻撃: 巻き込む相手を置いて、bpPlanArea と比べる
                    var areaTargets = c.areaTargets.Select(t => { var x = state.units.First(u => u.id == t.id).Clone(); x.x = t.x; x.y = t.y; return x; }).ToList();
                    var areaEnv = state.units.Select(u => u.id == a.id ? attacker : areaTargets.FirstOrDefault(t => t.id == u.id) ?? u).ToList();
                    var areaOption = new BattleOption { kind = c.optionKind, artName = c.artName, spell = c.spell };
                    IPlanRolls areaRolls = c.rolls == "forecast" ? new ForecastRolls() : new FixedRolls(c.percents, c.dice);
                    var areaPlan = BattlePlan.PlanArea(attacker, areaTargets, areaOption.ToAction(), areaEnv, areaRolls);
                    string areaWhere = $"{c.area} {c.attackerId}→{string.Join("・", c.areaTargets.Select(t => t.id))} {c.rolls}";
                    if (areaPlan.steps.Count != c.steps.Length) { failures.Add($"{areaWhere}: 段の数 {areaPlan.steps.Count}（ブラウザ版 {c.steps.Length}）"); continue; }
                    for (int i = 0; i < c.steps.Length; i++)
                    {
                        var e = c.steps[i];
                        var s = areaPlan.steps[i];
                        if (e.hitRate != s.hitRate || e.damage != s.damage || e.critRate != s.critRate || e.dealt != s.dealt || e.hit != s.hit || e.targetHpAfter != s.targetHpAfter)
                            failures.Add($"{areaWhere} 段{i}: 命中{s.hitRate}/{e.hitRate} ダメージ{s.damage}/{e.damage} 必殺{s.critRate}/{e.critRate} 与えた{s.dealt}/{e.dealt}");
                    }
                    if (areaPlan.attacker.mp != c.attackerMpAfter) failures.Add($"{areaWhere}: MP {areaPlan.attacker.mp}（ブラウザ版 {c.attackerMpAfter}）");
                    continue;
                }
                var env = state.units.Select(u => u.id == a.id ? attacker : u.id == d.id ? defender : u).ToList();
                PlanAction action;
                if (!string.IsNullOrEmpty(c.optionKind))
                {
                    var option = new BattleOption { kind = c.optionKind, artName = c.artName, itemId = c.itemId, spell = c.spell, equipSpell = c.equipSpell };
                    option.ApplyEquip(attacker, c.weaponItemId);
                    action = option.ToAction();
                }
                else action = string.IsNullOrEmpty(c.artName) ? PlanAction.ForEquipped(a) : new PlanAction { kind = "weapon", artName = c.artName };
                IPlanRolls rolls = c.rolls == "forecast" ? new ForecastRolls() : new FixedRolls(c.percents, c.dice);
                var plan = BattlePlan.PlanExchange(attacker, defender, action, env, rolls);

                string where = $"{c.attackerId}→{c.defenderId} 距離{c.distance} {c.rolls}{(string.IsNullOrEmpty(c.artName) ? "" : " " + c.artName)}{(string.IsNullOrEmpty(c.optionKind) ? "" : $" [{c.optionKind} {c.spell?.id}]")}";
                if (plan.steps.Count != c.steps.Length)
                {
                    failures.Add($"{where}: 段の数 {plan.steps.Count}（ブラウザ版 {c.steps.Length}）");
                    continue;
                }
                for (int i = 0; i < c.steps.Length; i++)
                {
                    var e = c.steps[i];
                    var s = plan.steps[i];
                    void Check(string what, object expected, object actual)
                    {
                        if (!Equals(expected, actual)) failures.Add($"{where} 段{i}（{e.role}）{what}: {actual}（ブラウザ版 {expected}）");
                    }
                    if (e.role == "counterCheck")
                    {
                        Check("種類", "counterCheck", s.type);
                        Check("反撃できる", e.ok, s.ok);
                        Check("理由", e.reason ?? "", s.reason ?? "");
                        Check("野望の封じ率", e.sealChance, s.sealChance ?? -1);
                        continue;
                    }
                    Check("役", e.role, s.role);
                    Check("種類", e.kind, s.kind);
                    Check("命中率", e.hitRate, s.hitRate);
                    Check("ダメージ", e.damage, s.damage);
                    Check("必殺率", e.critRate, s.critRate);
                    Check("命中", e.hit, s.hit);
                    Check("必殺", e.crit, s.crit);
                    Check("与えたダメージ", e.dealt, s.dealt);
                    Check("相手の残りHP", e.targetHpAfter, s.targetHpAfter);
                    Check("MP消費", e.mpCost, s.mpCost ?? -1);
                    Check("耐久の消費", e.durabilityCost, s.durabilityCost ?? -1);
                    Check("残りの耐久", e.actorDurabilityAfter, s.actorDurabilityAfter ?? -1);
                    Check("カウンター", e.reflectDamage, s.reflectDamage ?? -1);
                    Check("祈り", e.prayerSaved, s.prayerSaved.HasValue ? (s.prayerSaved.Value ? 1 : 0) : -1);
                    Check("状態異常", e.status ?? "", s.status ?? "");
                }
                if (plan.attacker.hp != c.attackerHpAfter) failures.Add($"{where}: 攻撃側の残りHP {plan.attacker.hp}（ブラウザ版 {c.attackerHpAfter}）");
                if (plan.defender.hp != c.defenderHpAfter) failures.Add($"{where}: 防御側の残りHP {plan.defender.hp}（ブラウザ版 {c.defenderHpAfter}）");
                if (plan.attacker.mp != c.attackerMpAfter) failures.Add($"{where}: 攻撃側の残りMP {plan.attacker.mp}（ブラウザ版 {c.attackerMpAfter}）");
                if (plan.defender.mp != c.defenderMpAfter) failures.Add($"{where}: 防御側の残りMP {plan.defender.mp}（ブラウザ版 {c.defenderMpAfter}）");
            }
            Assert.IsEmpty(failures, $"ブラウザ版と違う結果（{failures.Count}件）:\n" + string.Join("\n", failures.Take(40)));
        }

        [Test]
        public void ForecastRollsHitAndNeverCrit()
        {
            var rolls = new ForecastRolls();
            Assert.AreEqual(1, rolls.Percent("hit"));
            Assert.AreEqual(100, rolls.Percent("crit"));
            Assert.AreEqual(4, rolls.Dice("1d6"), "MPはダイスの平均の切り上げ（3.5→4）");
            Assert.AreEqual(5, rolls.Dice("1d8"));
        }

        [Test]
        public void JsRoundRoundsHalfUp()
        {
            Assert.AreEqual(3, TrialRules.JsRound(2.5));
            Assert.AreEqual(-2, TrialRules.JsRound(-2.5));
            Assert.AreEqual(7, TrialRules.Damage(10, 9, 6), "6 + 0.5 → 7（JavaScript の Math.round と同じ）");
        }
    }
}
