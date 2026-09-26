using System.Collections.Generic;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;

namespace Srpg.Tests
{
    /// <summary>地形の通行（マップ担当の地形の表 2026-09-27）と、飛行の「通り抜け」「止まる」</summary>
    public class TerrainRulesTests
    {
        [Test]
        public void GroundUnitsUseOnlyFloorTerrain()
        {
            foreach (char t in "sdg=") Assert.IsTrue(TerrainRules.CanEnter(t, false) && TerrainRules.CanStop(t, false), $"地上は {t} を通れて止まれる");
            foreach (char t in "~o#t") Assert.IsFalse(TerrainRules.CanEnter(t, false), $"地上は {t} に入れない");
        }

        [Test]
        public void FlyingPassesEverythingButStopsOnlyWhereNoTallThingStands()
        {
            foreach (char t in "sdg=~o#t") Assert.IsTrue(TerrainRules.CanEnter(t, true), $"飛行は {t} を通り抜けられる");
            foreach (char t in "sdg=~o") Assert.IsTrue(TerrainRules.CanStop(t, true), $"飛行は {t} に止まれる（水・瓦礫の上も）");
            foreach (char t in "#t") Assert.IsFalse(TerrainRules.CanStop(t, true), $"飛行は {t} に止まれない（通り抜けるだけ）");
        }

        private class Occupant : MoveRange.IOccupant
        {
            public Vector2Int Cell { get; set; }
            public string Side { get; set; }
            public bool Alive => true;
        }

        private static List<Vector2Int> Range(Board3DMap map, Vector2Int start, int move, bool flying)
        {
            var self = new Occupant { Cell = start, Side = "ally" };
            return MoveRange.Compute(start, move, "ally", new[] { self }, map.Columns, map.Rows,
                cell => map.CanEnter(cell, flying), cell => map.CanStop(cell, flying), self);
        }

        [Test]
        public void OnWatchroadFlyingCrossesTheWallButCannotLandOnIt()
        {
            var map = Board3DLayout.Watchroad();
            var start = new Vector2Int(1, 2);   // 旧石畳。右隣 (2,2) は崩れた砦壁（#）
            var ground = Range(map, start, 2, false);
            var flying = Range(map, start, 2, true);

            CollectionAssert.DoesNotContain(ground, new Vector2Int(2, 2), "地上は壁に入れない");
            CollectionAssert.DoesNotContain(ground, new Vector2Int(3, 2), "地上は壁の向こうへ2歩では行けない");
            CollectionAssert.DoesNotContain(flying, new Vector2Int(2, 2), "飛行は壁のマスに止まれない");
            CollectionAssert.Contains(flying, new Vector2Int(3, 2), "飛行は壁を通り抜けて向こうに止まれる");
            CollectionAssert.Contains(flying, new Vector2Int(2, 1), "飛行は壁の脇の石畳にも行ける");
        }

        [Test]
        public void OnWatchroadFlyingCanHoverOverTheMoat()
        {
            var map = Board3DLayout.Watchroad();
            var start = new Vector2Int(4, 2);   // 苔。下 (4,3) は水堀
            CollectionAssert.DoesNotContain(Range(map, start, 2, false), new Vector2Int(4, 3), "地上は水堀に入れない");
            var flying = Range(map, start, 2, true);
            CollectionAssert.Contains(flying, new Vector2Int(4, 3), "飛行は水堀の上に止まれる");
            CollectionAssert.Contains(flying, new Vector2Int(4, 4), "飛行は水堀を渡れる");
        }

        [Test]
        public void WatchroadHeightsFollowTheTerrainTable()
        {
            var map = Board3DLayout.Watchroad();
            Assert.AreEqual('t', map.TerrainAt(new Vector2Int(0, 0)), "盤面の角は密な茂み");
            Assert.AreEqual(0.6f, map.TopHeight(new Vector2Int(0, 0)), 1e-4f);
            Assert.AreEqual(0.5f, map.TopHeight(new Vector2Int(7, 0)), 1e-4f, "監視門の脇の基礎 #");
            Assert.AreEqual(0.3f, map.TopHeight(new Vector2Int(3, 1)), 1e-4f, "遮蔽物 o");
            Assert.AreEqual(-0.18f, map.TopHeight(new Vector2Int(3, 3)), 1e-4f, "水堀");
            Assert.Greater(map.TopHeight(new Vector2Int(2, 2)), map.TopHeight(new Vector2Int(2, 3)), "崩れた砦壁は場所によって高さが違う");
            CollectionAssert.AreEquivalent(new[] { new Vector2Int(0, 0), new Vector2Int(11, 0), new Vector2Int(0, 6), new Vector2Int(11, 6) }, map.ModelTrees);
            foreach (var tree in map.ModelTrees) Assert.AreEqual('t', map.TerrainAt(tree), "木は茂み t のマスに立つ");
            CollectionAssert.AreEqual(new[] { new Vector2Int(5, 0) }, map.Gates);
            Assert.IsEmpty(map.Torches, "たいまつは門の柱に付ける（通れるマスには立てない）");
            Assert.IsTrue(map.CanStop(new Vector2Int(5, 0), false), "門の下は通れる");
        }
    }
}
