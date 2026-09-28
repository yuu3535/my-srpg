using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;

namespace Srpg.Tests
{
    /// <summary>配置表（tools/map_layout.py unity）から作る場所の盤面: 記号の決まり・置いてある物・出口へ歩いて行けるか</summary>
    public class MapLayoutTests
    {
        private static MapLayoutFile Load(string mapId) =>
            JsonUtility.FromJson<MapLayoutFile>(File.ReadAllText($"Assets/Data/Maps/{mapId}.json"));

        [TearDown]
        public void ClearOverrides() => TerrainTable.ClearOverrides();

        [Test]
        public void CastleSymbolsFollowTheTable()
        {
            var layout = Load("orcus_corridor");
            var map = Board3DMap.FromLayout(layout);
            Assert.AreEqual(layout.columns, map.Columns);
            Assert.AreEqual(layout.rows, map.Rows);
            Assert.IsTrue(map.FromLayoutFile && map.Indoor);
            Assert.IsFalse(map.CanStop(new Vector2Int(0, 0), false), "壁には入れない");
            Assert.IsFalse(map.CanEnter(new Vector2Int(0, 0), true), "外周の壁は飛んでも越えられない");
            Assert.IsTrue(map.CanStop(new Vector2Int(3, 0), false), "扉は通れる");
            var bench = layout.objects.First(o => o.id == "bench_1").cells[0].V;
            Assert.IsFalse(map.CanStop(bench, false), "置いてある物のマスには入れない");
            Assert.AreEqual("石の手すり", Board3DMap.TerrainName('b'), "配置表の legend の名前");
        }

        [Test]
        public void WatchroadRulesUnchanged()
        {
            // 表にしたあとも、国境監視路の決まりは前と同じ
            Assert.IsTrue(TerrainRules.CanStop('s', false));
            Assert.IsFalse(TerrainRules.CanStop('~', false));
            Assert.IsTrue(TerrainRules.CanStop('~', true), "水堀の上に浮いて止まれる");
            Assert.IsTrue(TerrainRules.CanEnter('#', true));
            Assert.IsFalse(TerrainRules.CanStop('#', true), "石の基礎は通り抜けるだけ");
            Assert.IsTrue(TerrainRules.CanStop('o', true));
            Assert.AreEqual(0.6f, TerrainTable.Get('t').height, 1e-5f);
        }

        [TestCase("orcus_room_arshe_karima")]
        [TestCase("orcus_corridor")]
        [TestCase("orcus_training_yard")]
        public void ExitsAreReachableFromTheStart(string mapId)
        {
            var layout = Load(mapId);
            var map = Board3DMap.FromLayout(layout);
            var start = layout.states.First().player.Cell;
            Assert.IsTrue(map.CanStop(start, false), $"{mapId}: 最初に立つマスに立てる");
            // 歩いて行けるマス（出口のマスは扉なので入れる）
            var reached = new HashSet<Vector2Int> { start };
            var queue = new Queue<Vector2Int>(reached);
            while (queue.Count > 0)
            {
                var c = queue.Dequeue();
                foreach (var d in new[] { Vector2Int.up, Vector2Int.down, Vector2Int.left, Vector2Int.right })
                {
                    var n = c + d;
                    if (!reached.Contains(n) && map.CanStop(n, false)) { reached.Add(n); queue.Enqueue(n); }
                }
            }
            foreach (var exit in layout.exits.Where(e => e.hasTarget))
                Assert.IsTrue(exit.cells.Any(cell => reached.Contains(cell.V)), $"{mapId}: 出口 {exit.id} へ歩いて行ける");
        }
    }
}
