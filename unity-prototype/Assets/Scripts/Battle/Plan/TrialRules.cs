using System;
using System.Collections.Generic;

namespace Srpg.Battle.Plan
{
    /// <summary>
    /// 採用版ステータスの戦闘の式（ブラウザ版 trialStatSystem.js の同名の関数を移したもの。式を変えるときは両方を直す）。
    /// 丸めは JavaScript と同じにする（Math.round は .5 を上へ。C# の Math.Round とは違う）。
    /// </summary>
    public static class TrialRules
    {
        public const int WeaponPowerMid = 6;          // TRIAL_WEAPON_POWER.mid
        public const int FollowUpSpeedGap = 5;         // TRIAL_FOLLOW_UP_SPEED_GAP
        public const int GrimoireRangeMin = 1;         // TRIAL_GRIMOIRE_RANGE
        public const int GrimoireRangeMax = 2;

        private static readonly Dictionary<string, string> ClanElements = new Dictionary<string, string>
        {
            { "黒の一族", "火" }, { "白の一族", "氷" }, { "黄の一族", "土" }, { "翠の一族", "風" },
        };

        /// <summary>JavaScript の Math.round（.5 は上へ）</summary>
        public static int JsRound(double value) => (int)Math.Floor(value + 0.5);

        public static int Distance(PlanUnit a, PlanUnit b) => Math.Abs(a.x - b.x) + Math.Abs(a.y - b.y);

        /// <summary>体格回避補正: 正なら避けやすく、負なら狙われやすい</summary>
        public static int SizeEvasionModifier(int siz) => Math.Max(-10, Math.Min(5, 11 - siz));

        /// <summary>命中率: 60 + (技 - 速さ) x 2.5 - 体格回避補正、5〜100%</summary>
        public static int HitRate(PlanStats attacker, PlanStats defender, int defenderSiz, double modifier = 0)
        {
            double rate = 60 + (attacker.tec - defender.spd) * 2.5 - SizeEvasionModifier(defenderSiz) + modifier;
            return Math.Max(5, Math.Min(100, JsRound(rate)));
        }

        /// <summary>ダメージ: max(1, round(武器威力 + (攻撃値 - 守備値) / 2))</summary>
        public static int Damage(int attack, int defense, int weaponPower = WeaponPowerMid) =>
            Math.Max(1, JsRound(weaponPower + (attack - defense) / 2.0));

        public static int PhysicalDamage(int attack, int defense, int weaponPower = WeaponPowerMid, int powerBonus = 0) =>
            Damage(attack, defense, weaponPower + powerBonus);

        /// <summary>必殺率: 技 + floor(勇気 / 5) - 相手の魅力 + 補正、0〜100%</summary>
        public static int CriticalRate(PlanStats attacker, int courage, PlanStats defender, double modifier = 0)
        {
            double rate = attacker.tec + Math.Floor(Math.Max(0, courage) / 5.0) - defender.cha + modifier;
            return Math.Max(0, Math.Min(100, (int)Math.Floor(rate)));
        }

        /// <summary>追撃: 速さの差が5以上</summary>
        public static bool CanFollowUp(PlanStats attacker, PlanStats defender) => attacker.spd - defender.spd >= FollowUpSpeedGap;

        /// <summary>確率で発動するスキルの発動率（%）</summary>
        public static int AbilityChance(string name, PlanStats stats, int maxHp = 0, int luck = 0)
        {
            switch (name)
            {
                case "野望": return Math.Min(100, stats.cha * 2);                                      // 反撃封じ
                case "カウンター": return (int)Math.Floor(((maxHp > 0 ? maxHp : stats.hp) + stats.def) / 4.0);
                case "祈り": return Math.Min(100, luck);
                case "詠唱破棄": return (int)Math.Floor((stats.mag + stats.res) / 4.0);
                default: return 0;
            }
        }

        public struct Aura
        {
            public int accuracy;
            public int critGuard;
            public List<string> notes;
        }

        /// <summary>周囲に効く能力（死神・王威）による補正（4マス以内）</summary>
        public static Aura AuraModifiers(PlanUnit attacker, PlanUnit defender, IEnumerable<PlanUnit> units)
        {
            var result = new Aura { notes = new List<string>() };
            var living = new List<PlanUnit>();
            foreach (var unit in units ?? Array.Empty<PlanUnit>()) if (unit != null && unit.hp > 0) living.Add(unit);
            string Who(PlanUnit owner) => string.IsNullOrEmpty(owner.name) ? owner.id : owner.name;
            foreach (var owner in living)
            {
                if (!owner.Has("死神")) continue;
                if (owner.side != attacker.side && Distance(owner, attacker) <= 4) { result.accuracy -= 10; result.notes.Add($"{Who(owner)}の死神:命中-10"); }
                if (owner.side != defender.side && Distance(owner, defender) <= 4) { result.accuracy += 10; result.notes.Add($"{Who(owner)}の死神:相手の回避-10"); }
            }
            foreach (var owner in living)
            {
                if (!owner.Has("王威")) continue;
                if (owner.side == attacker.side && owner.id != attacker.id && Distance(owner, attacker) <= 4) { result.accuracy += 10; result.notes.Add($"{Who(owner)}の王威:命中+10"); }
                if (owner.side == defender.side && owner.id != defender.id && Distance(owner, defender) <= 4)
                {
                    result.accuracy -= 10; result.critGuard += 10; result.notes.Add($"{Who(owner)}の王威:相手の回避・必殺耐性+10");
                }
            }
            return result;
        }

        public struct AttackModifier
        {
            public int accuracy;
            public int critical;
            public double damageMultiplier;
            public List<string> notes;
        }

        /// <summary>攻撃ごとの能力補正（野望・一族スキル）</summary>
        public static AttackModifier AttackModifiers(List<string> attackerNames, List<string> defenderNames, bool isCounter, bool isMagic, string spellId)
        {
            var result = new AttackModifier { damageMultiplier = 1, notes = new List<string>() };
            bool Has(List<string> names, string name) => names != null && names.Contains(name);
            if (Has(attackerNames, "野望") && !isCounter) { result.accuracy += 10; result.critical += 10; result.notes.Add("野望:命中+10・必殺+10"); }
            if (Has(defenderNames, "野望") && isCounter) { result.accuracy -= 10; result.notes.Add("野望:相手の命中-10"); }
            if (isMagic)
            {
                foreach (var pair in ClanElements)
                {
                    if (Has(attackerNames, pair.Key) && spellId == pair.Value)
                    {
                        result.accuracy += 20; result.damageMultiplier *= 1.5; result.notes.Add($"{pair.Key}:命中+20・1.5倍");
                    }
                }
            }
            return result;
        }

        public struct CounterPlan
        {
            public bool canCounter;
            public string kind;
            public string reason;
        }

        /// <summary>反撃できるか: 防御側が今装備している武器・魔導書の射程で決める（射程内なら必ず反撃。原作者 2026-09-25）</summary>
        public static CounterPlan Counter(string equipped, int weaponRange, bool hasGrimoire, bool grimoireDamaging, int mp, int distance, int grimoireRangeBonus)
        {
            if (string.IsNullOrEmpty(equipped)) return new CounterPlan { canCounter = false, kind = null, reason = "装備なし" };
            if (equipped == "grimoire" && hasGrimoire)
            {
                if (!grimoireDamaging) return new CounterPlan { canCounter = false, kind = "grimoire", reason = "攻撃できない魔導書" };
                int maxRange = GrimoireRangeMax + grimoireRangeBonus;
                if (distance < GrimoireRangeMin || distance > maxRange) return new CounterPlan { canCounter = false, kind = "grimoire", reason = "射程外" };
                if (mp <= 0) return new CounterPlan { canCounter = false, kind = "grimoire", reason = "MP不足" };
                return new CounterPlan { canCounter = true, kind = "grimoire", reason = "" };
            }
            int range = Math.Max(1, weaponRange);
            if (distance < 1 || distance > range) return new CounterPlan { canCounter = false, kind = "weapon", reason = "射程外" };
            return new CounterPlan { canCounter = true, kind = "weapon", reason = "" };
        }
    }
}
