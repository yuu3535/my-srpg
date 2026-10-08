using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Srpg.Battle.Plan;

namespace Srpg.Battle
{
    /// <summary>
    /// 成長の元データ（tools/export_unity_growth.mjs が trialStatSystem.js から書き出す。Resources/Growth/growth_profiles.json）
    /// </summary>
    [Serializable]
    public class GrowthProfile
    {
        public string id, name;
        public PlanStats @base, growth, caps;
        public int luck, courage;
        public int causeLevel = 1;   // ふだんの因果Lv（敵の強さ・味方が初めて加わるときの因果Lv）
    }

    [Serializable]
    public class GrowthFile
    {
        [Serializable] public class BattleLevel { public string battleId, id; public int causeLevel; }
        public GrowthProfile[] profiles;
        public BattleLevel[] battleLevels;
    }

    /// <summary>
    /// 経験値と因果Lvの上がり方（2026-10-09。原作者: 敵を倒す・行動するたびに経験値＝FE の形、伸び方は「確率＋救済」）。
    /// 採用版 `採用版md/SRPG_CHARACTER_STAT_GROWTH_STANDARD.md` §6（個人成長率＋幸運・勇気補正）・§8（能力上限）に従う。画面に触れない
    /// </summary>
    public static class Growth
    {
        public static readonly string[] Keys = { "hp", "atk", "def", "mag", "res", "tec", "spd", "cha" };
        public static readonly string[] Labels = { "HP", "力", "防御", "魔攻", "魔防", "技", "速さ", "魅力" };

        // ── 経験値（原作者 2026-10-09: 総合担当の案で任せる） ──
        public const int ExpPerLevel = 100;
        public const int ActionExp = 10;   // 攻撃・魔法・戦技が当たった／回復・補助をした
        public const int MissExp = 1;      // 外れた・反撃できずに受けた
        public const int BossBonus = 20;

        /// <summary>倒したときの経験値: 20 ＋ 3×（敵のLv − 自分のLv）、5〜60。ボスは＋20</summary>
        public static int KillExp(int myLevel, int foeLevel, bool boss = false) =>
            Mathf.Clamp(20 + 3 * (foeLevel - myLevel), 5, 60) + (boss ? BossBonus : 0);

        /// <summary>幸運・勇気補正（採用版 §6.1）: floor((幸運 + 最大勇気) / 40)%</summary>
        public static int Bonus(GrowthProfile p) => (p.luck + p.courage) / 40;

        public static int Get(PlanStats s, int i) => i switch
        {
            0 => s.hp, 1 => s.atk, 2 => s.def, 3 => s.mag, 4 => s.res, 5 => s.tec, 6 => s.spd, _ => s.cha,
        };

        public static void Set(PlanStats s, int i, int v)
        {
            switch (i)
            {
                case 0: s.hp = v; break; case 1: s.atk = v; break; case 2: s.def = v; break; case 3: s.mag = v; break;
                case 4: s.res = v; break; case 5: s.tec = v; break; case 6: s.spd = v; break; default: s.cha = v; break;
            }
        }

        public static PlanStats Copy(PlanStats s)
        {
            var c = new PlanStats();
            for (int i = 0; i < Keys.Length; i++) Set(c, i, Get(s, i));
            return c;
        }

        /// <summary>実効成長率（%）: 個人成長率＋幸運・勇気補正。100 で打ち止め（兵種成長率は兵種を入れたら足す）</summary>
        public static int Rate(GrowthProfile p, int i) => Mathf.Clamp(Get(p.growth, i) + Bonus(p), 0, 100);

        private static int Cap(GrowthProfile p, int i)
        {
            int c = p.caps != null ? Get(p.caps, i) : 0;
            return c > 0 ? c : int.MaxValue;   // 上限のない物（人形など）
        }

        /// <summary>
        /// その因果Lvの期待値の能力（ブラウザ版 trialStatsAt と同じ: 基礎値＋実効成長率×(Lv−1) を四捨五入、上限まで）。
        /// 戦闘のデータはこの値で書き出されているので、仲間の実際の能力との差を戦闘に足すのに使う
        /// </summary>
        public static PlanStats Expected(GrowthProfile p, int level)
        {
            var s = new PlanStats();
            int gained = Math.Max(0, level - 1);
            for (int i = 0; i < Keys.Length; i++)
            {
                double v = Get(p.@base, i) + Rate(p, i) / 100.0 * gained;
                Set(s, i, (int)Math.Round(Math.Min(Cap(p, i), v), MidpointRounding.AwayFromZero));
            }
            return s;
        }

        /// <summary>
        /// 因果Lvが1上がったときの伸び（確率＋救済）: 能力ごとに実効成長率の確率で+1。1つも伸びなければ、
        /// 上限に届いていない中で一番伸びやすい能力を+1。上限に届いた能力は伸びない。stats を書き換え、伸びた量を返す
        /// </summary>
        public static int[] LevelUp(GrowthProfile p, PlanStats stats, System.Random rng)
        {
            var gains = new int[Keys.Length];
            for (int i = 0; i < Keys.Length; i++)
                if (Get(stats, i) < Cap(p, i) && rng.Next(100) < Rate(p, i)) gains[i] = 1;
            if (gains.All(g => g == 0))
            {
                int best = -1;
                for (int i = 0; i < Keys.Length; i++)
                    if (Get(stats, i) < Cap(p, i) && (best < 0 || Rate(p, i) > Rate(p, best))) best = i;
                if (best >= 0) gains[best] = 1;
            }
            for (int i = 0; i < Keys.Length; i++) Set(stats, i, Get(stats, i) + gains[i]);
            return gains;
        }

        // ── 元データ ──

        private static GrowthFile file;

        /// <summary>元データ（Resources から一度だけ読む。テストでは差し替えられる）</summary>
        public static GrowthFile File
        {
            get
            {
                if (file == null)
                {
                    var asset = Resources.Load<TextAsset>("Growth/growth_profiles");
                    file = asset != null ? JsonUtility.FromJson<GrowthFile>(asset.text) : new GrowthFile();
                }
                return file;
            }
            set => file = value;
        }

        public static GrowthProfile Profile(string id) => File.profiles?.FirstOrDefault(p => p.id == id);

        /// <summary>その戦闘でのキャラの因果Lv（戦闘ごとの上書き → ふだんの因果Lv → 1）</summary>
        public static int LevelIn(string battleId, string id)
        {
            var o = File.battleLevels?.FirstOrDefault(b => b.battleId == battleId && b.id == id);
            if (o != null) return o.causeLevel;
            return Profile(id)?.causeLevel ?? 1;
        }
    }
}
