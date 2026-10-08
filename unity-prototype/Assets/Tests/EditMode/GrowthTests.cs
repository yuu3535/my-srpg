using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using Srpg.Battle.Plan;

namespace Srpg.Tests
{
    /// <summary>経験値と因果Lvの上がり方（2026-10-09。確率＋救済、採用版の成長率・上限）</summary>
    public class GrowthTests
    {
        [TearDown]
        public void TearDown() => Party.Reset();

        private static PlanStats S(int hp, int atk, int def, int mag, int res, int tec, int spd, int cha) =>
            new PlanStats { hp = hp, atk = atk, def = def, mag = mag, res = res, tec = tec, spd = spd, cha = cha };

        [Test]
        public void ExpectedStatsMatchTheBrowserVersion()
        {
            // trialStatSystem.js のコメント: ギュンター因果Lv25 = HP33・力39・防御33・魔攻32・魔防34・技26・速さ22・魅力28
            var gunter = Growth.Profile("gunter");
            Assert.IsNotNull(gunter, "成長の元データが読めない（Resources/Growth/growth_profiles.json）");
            var s = Growth.Expected(gunter, 25);
            CollectionAssert.AreEqual(new[] { 33, 39, 33, 32, 34, 26, 22, 28 }, Enumerable.Range(0, 8).Select(i => Growth.Get(s, i)).ToArray());
            // 因果Lv1は基礎値そのまま（プロローグの訓練のアルシェ）
            var arshe = Growth.Profile("young_arshe");
            CollectionAssert.AreEqual(Enumerable.Range(0, 8).Select(i => Growth.Get(arshe.@base, i)).ToArray(),
                Enumerable.Range(0, 8).Select(i => Growth.Get(Growth.Expected(arshe, 1), i)).ToArray());
            Assert.AreEqual(1, Growth.LevelIn("battle_prologue_training", "young_karima"), "訓練ではカリマも因果Lv1");
            Assert.AreEqual(25, Growth.LevelIn("battle_trial_adopted", "young_karima"));
        }

        [Test]
        public void LevelUpAlwaysGivesAtLeastOnePoint()
        {
            var flat = new GrowthProfile { id = "t", @base = S(10, 10, 10, 10, 10, 10, 10, 10), growth = S(0, 0, 5, 0, 0, 0, 0, 0), caps = S(99, 99, 99, 99, 99, 99, 99, 99) };
            var stats = Growth.Copy(flat.@base);
            var rng = new System.Random(1);
            for (int n = 0; n < 20; n++)
            {
                var gains = Growth.LevelUp(flat, stats, rng);
                Assert.GreaterOrEqual(gains.Sum(), 1, "救済: 1つも伸びないことはない");
            }
            Assert.Greater(stats.def, 10 + 15, "救済は一番伸びやすい能力（防御）へ");
        }

        [Test]
        public void StatsStopAtTheirCap()
        {
            var p = new GrowthProfile { id = "t", @base = S(10, 10, 10, 10, 10, 10, 10, 10), growth = S(100, 100, 100, 100, 100, 100, 100, 100), caps = S(10, 12, 10, 10, 10, 10, 10, 10) };
            var stats = Growth.Copy(p.@base);
            var rng = new System.Random(2);
            for (int n = 0; n < 5; n++) Growth.LevelUp(p, stats, rng);
            Assert.AreEqual(10, stats.hp);
            Assert.AreEqual(12, stats.atk, "上限で止まる");
            var none = Growth.LevelUp(p, stats, rng);
            Assert.AreEqual(0, none.Sum(), "全部上限なら伸びない");
        }

        [Test]
        public void KillExpDependsOnTheLevelGap()
        {
            Assert.AreEqual(20, Growth.KillExp(1, 1));
            Assert.AreEqual(35, Growth.KillExp(5, 10));
            Assert.AreEqual(60, Growth.KillExp(1, 25), "最高60");
            Assert.AreEqual(5, Growth.KillExp(25, 1), "最低5");
            Assert.AreEqual(40, Growth.KillExp(1, 1, boss: true), "ボスは＋20");
        }

        [Test]
        public void ExpCarriesOverAndCanRaiseSeveralLevels()
        {
            Party.Rng = new System.Random(3);
            var m = Party.Ensure("young_arshe", 1);
            int before = m.stats.hp + m.stats.atk + m.stats.def + m.stats.mag + m.stats.res + m.stats.tec + m.stats.spd + m.stats.cha;
            var r = Party.AddExp("young_arshe", "アルシェ", 250);
            Assert.AreEqual(1, r.levelBefore);
            Assert.AreEqual(3, r.levelAfter);
            Assert.AreEqual(50, m.exp, "余りは次へ");
            Assert.AreEqual(2, r.gains.Count);
            int after = m.stats.hp + m.stats.atk + m.stats.def + m.stats.mag + m.stats.res + m.stats.tec + m.stats.spd + m.stats.cha;
            Assert.AreEqual(before + r.gains.Sum(g => g.Sum()), after);
            Assert.IsFalse(string.IsNullOrEmpty(r.GainsText));
        }

        [Test]
        public void PartyGoesIntoTheSaveAndOldSavesStillLoad()
        {
            Party.Ensure("young_arshe", 1).level = 4;
            var d = new SaveData { scene = SaveSystem.Scene2D, place = "orcus_room", party = Party.Snapshot() };
            var back = SaveStore.FromJson(SaveStore.ToJson(d));
            Assert.AreEqual(4, back.party.Single(m => m.id == "young_arshe").level);
            // 版1（仲間の育ちがない）のセーブも読める
            var old = SaveStore.FromJson("{\"version\":1,\"scene\":\"Corridor2D\",\"place\":\"orcus_room\"}");
            Assert.IsNotNull(old);
            Assert.AreEqual(0, old.party.Count);
        }
    }
}
