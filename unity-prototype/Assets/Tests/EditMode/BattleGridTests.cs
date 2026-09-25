using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;

namespace Srpg.Tests
{
    public class BattleGridTests
    {
        private class Occupant : MoveRange.IOccupant
        {
            public Vector2Int Cell { get; set; }
            public string Side { get; set; }
            public bool Alive => true;
        }

        [Test]
        public void CellCenterAndWorldToCellRoundTrip()
        {
            for (int col = 0; col < 12; col++)
            for (int row = 0; row < 8; row++)
            {
                var center = IsoGrid.CellCenter(col, row);
                Assert.AreEqual(new Vector2Int(col, row), IsoGrid.WorldToCell(center), $"({col},{row})");
            }
        }

        [Test]
        public void CellShapeIsTwoToOneDiamond()
        {
            // マス(0,0)の中心は上の頂点（原点）から縦に半マス下
            Assert.AreEqual(new Vector2(0f, -0.25f), IsoGrid.CellCenter(0, 0));
            // 列が増えると右下、行が増えると左下
            Assert.AreEqual(new Vector2(0.5f, -0.5f), IsoGrid.CellCenter(1, 0));
            Assert.AreEqual(new Vector2(-0.5f, -0.5f), IsoGrid.CellCenter(0, 1));
            // マス(0,0)の右寄りの内側と、その右下のマス(1,0)の内側
            Assert.AreEqual(new Vector2Int(0, 0), IsoGrid.WorldToCell(new Vector2(0.4f, -0.25f)));
            Assert.AreEqual(new Vector2Int(1, 0), IsoGrid.WorldToCell(new Vector2(0.4f, -0.45f)));
        }

        [Test]
        public void MoveRangeMatchesBrowserRules()
        {
            var self = new Occupant { Cell = new Vector2Int(2, 2), Side = "ally" };
            var ally = new Occupant { Cell = new Vector2Int(3, 2), Side = "ally" };
            var enemy = new Occupant { Cell = new Vector2Int(2, 3), Side = "enemy" };
            var units = new List<MoveRange.IOccupant> { self, ally, enemy };
            var range = MoveRange.Compute(self.Cell, 2, "ally", units, 6, 6, _ => false, self);

            // 味方のマスは通れるが止まれない。その先には行ける
            Assert.IsFalse(range.Contains(new Vector2Int(3, 2)));
            Assert.IsTrue(range.Contains(new Vector2Int(4, 2)));
            // 敵のマスは通れない（その先の (2,4) へは回り道では3歩かかる）
            Assert.IsFalse(range.Contains(new Vector2Int(2, 3)));
            Assert.IsFalse(range.Contains(new Vector2Int(2, 4)));
            // 自分のマスは移動先に含めない
            Assert.IsFalse(range.Contains(self.Cell));
            // 移動力2のひし形（盤面・他ユニットを除く）
            Assert.IsTrue(range.All(c => Mathf.Abs(c.x - 2) + Mathf.Abs(c.y - 2) <= 2));
        }

        [Test]
        public void BlockedTilesAreNotEntered()
        {
            var self = new Occupant { Cell = new Vector2Int(0, 0), Side = "ally" };
            var range = MoveRange.Compute(self.Cell, 3, "ally", new[] { self }, 5, 5,
                cell => cell == new Vector2Int(1, 0) || cell == new Vector2Int(0, 1), self);
            Assert.IsEmpty(range);
        }
    }
}
