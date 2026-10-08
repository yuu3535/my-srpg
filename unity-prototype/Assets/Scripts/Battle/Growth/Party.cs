using System;
using System.Collections.Generic;
using System.Linq;
using Srpg.Battle.Plan;

namespace Srpg.Battle
{
    /// <summary>仲間1人の育ち（セーブする）。stats は本人現在ステ（因果Lv1基礎値＋永久成長。兵種・装備は含めない）</summary>
    [Serializable]
    public class PartyMember
    {
        public string id;
        public int level = 1;
        public int exp;
        public PlanStats stats;
    }

    /// <summary>戦闘で得た経験値と、上がった因果Lvの記録（結果の画面に出す）</summary>
    public class GrowthResult
    {
        public string id, name;
        public int exp, levelBefore, levelAfter;
        public List<int[]> gains = new List<int[]>();   // 上がったLvごとの伸び（Growth.Keys の順）

        /// <summary>伸びた能力の合計（例: 「HP+2 力+1 技+2」）</summary>
        public string GainsText
        {
            get
            {
                var parts = new List<string>();
                for (int i = 0; i < Growth.Keys.Length; i++)
                {
                    int sum = gains.Sum(g => g[i]);
                    if (sum > 0) parts.Add($"{Growth.Labels[i]}+{sum}");
                }
                return string.Join(" ", parts);
            }
        }
    }

    /// <summary>
    /// 仲間の育ち（2026-10-09）。場面をまたいで残り、セーブに入る。
    /// 仲間は、探索の戦闘に初めて味方として出たときに、その戦闘の因果Lvの期待値の能力で加わる
    /// </summary>
    public static class Party
    {
        private static readonly List<PartyMember> members = new List<PartyMember>();
        public static IReadOnlyList<PartyMember> Members => members;

        public static System.Random Rng { get; set; } = new System.Random();

        public static PartyMember Find(string id) => members.FirstOrDefault(m => m.id == id);

        /// <summary>まだいなければ、その因果Lvの期待値で加える</summary>
        public static PartyMember Ensure(string id, int level)
        {
            var m = Find(id);
            if (m != null) return m;
            var p = Growth.Profile(id);
            if (p == null) return null;
            m = new PartyMember { id = id, level = Math.Max(1, level), stats = Growth.Expected(p, Math.Max(1, level)) };
            members.Add(m);
            return m;
        }

        /// <summary>経験値を足し、100 ごとに因果Lvを上げる（確率＋救済）</summary>
        public static GrowthResult AddExp(string id, string name, int amount)
        {
            var m = Find(id);
            var p = Growth.Profile(id);
            var r = new GrowthResult { id = id, name = name, exp = amount, levelBefore = m?.level ?? 1, levelAfter = m?.level ?? 1 };
            if (m == null || p == null || amount <= 0) return r;
            m.exp += amount;
            while (m.exp >= Growth.ExpPerLevel)
            {
                m.exp -= Growth.ExpPerLevel;
                m.level++;
                r.gains.Add(Growth.LevelUp(p, m.stats, Rng));
            }
            r.levelAfter = m.level;
            return r;
        }

        public static void Reset() => members.Clear();

        /// <summary>セーブ用の写し</summary>
        public static List<PartyMember> Snapshot() => members.Select(m => new PartyMember { id = m.id, level = m.level, exp = m.exp, stats = Growth.Copy(m.stats) }).ToList();

        public static void Restore(IEnumerable<PartyMember> list)
        {
            members.Clear();
            foreach (var m in list ?? Enumerable.Empty<PartyMember>())
                if (m != null && !string.IsNullOrEmpty(m.id) && m.stats != null)
                    members.Add(new PartyMember { id = m.id, level = Math.Max(1, m.level), exp = Math.Max(0, m.exp), stats = Growth.Copy(m.stats) });
        }
    }
}
