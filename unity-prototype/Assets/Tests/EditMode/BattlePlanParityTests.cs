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
            public bool hit, crit, ok;
        }

        [Serializable]
        private class Case
        {
            public string attackerId, defenderId, rolls, artName;
            public int distance, attackerHp;
            public int[] percents, dice;
            public StepSummary[] steps;
            public int attackerHpAfter, attackerMpAfter, defenderHpAfter, defenderMpAfter;
        }

        [Serializable]
        private class CaseFile
        {
            public Case[] cases;
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
                if (!string.IsNullOrEmpty(c.artName)) attacker.hp = c.attackerHp;
                var defender = d.Clone(); defender.x = 5 + c.distance; defender.y = 4;
                var env = state.units.Select(u => u.id == a.id ? attacker : u.id == d.id ? defender : u).ToList();
                var action = string.IsNullOrEmpty(c.artName) ? PlanAction.ForEquipped(a) : new PlanAction { kind = "weapon", artName = c.artName };
                IPlanRolls rolls = c.rolls == "forecast" ? new ForecastRolls() : new FixedRolls(c.percents, c.dice);
                var plan = BattlePlan.PlanExchange(attacker, defender, action, env, rolls);

                string where = $"{c.attackerId}→{c.defenderId} 距離{c.distance} {c.rolls}{(string.IsNullOrEmpty(c.artName) ? "" : " " + c.artName)}";
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
