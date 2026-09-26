using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;

namespace Srpg.Tests
{
    /// <summary>3Dの盤面の試作（T1〜T3）のマス目と配置</summary>
    public class Board3DLayoutTests
    {
        [Test]
        public void TerrainAndMarkersAre12By8()
        {
            Assert.AreEqual(Board3DLayout.Rows, Board3DLayout.Terrain.Length);
            Assert.AreEqual(Board3DLayout.Rows, Board3DLayout.Markers.Length);
            foreach (var row in Board3DLayout.Terrain) Assert.AreEqual(Board3DLayout.Columns, row.Length);
            foreach (var row in Board3DLayout.Markers) Assert.AreEqual(Board3DLayout.Columns, row.Length);
        }

        [Test]
        public void CellCenterRoundTrips()
        {
            for (int r = 0; r < Board3DLayout.Rows; r++)
            for (int c = 0; c < Board3DLayout.Columns; c++)
            {
                var cell = new Vector2Int(c, r);
                Assert.AreEqual(cell, Board3DLayout.WorldToCell(Board3DLayout.CellCenter(cell)));
            }
        }

        [Test]
        public void RowZeroIsFarSide()
        {
            // 行0（監視門のある側）は +z、列0は −x
            Assert.Greater(Board3DLayout.CellCenter(new Vector2Int(0, 0)).z, Board3DLayout.CellCenter(new Vector2Int(0, 7)).z);
            Assert.Less(Board3DLayout.CellCenter(new Vector2Int(0, 0)).x, Board3DLayout.CellCenter(new Vector2Int(11, 0)).x);
            Assert.AreEqual('=', Board3DLayout.TerrainAt(new Vector2Int(6, 3)));   // 補修橋
            Assert.AreEqual('G', Board3DLayout.MarkerAt(new Vector2Int(5, 0)));    // 目的地点
        }
    }
}
