using System.Collections.Generic;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;

namespace Srpg.Tests
{
    /// <summary>探索の当たり判定の優先順（探索の仕様書 §3.1）と札の位置（§5）。双子の部屋の仕様書の値で</summary>
    public class ExploreHitTests
    {
        private static List<ExploreHit.Target> Room() => new List<ExploreHit.Target>
        {
            T("chestA", ExploreHit.Kind.Item, 88, 640, 390, 130, 283, 664),
            T("bedA", ExploreHit.Kind.Tips, 32, 97, 532, 653, 298, 160),
            T("shelfK", ExploreHit.Kind.Tips, 1530, 136, 291, 630, 1675, 200),
            T("bedK", ExploreHit.Kind.Tips, 1781, 105, 540, 649, 2051, 168),
            T("karima", ExploreHit.Kind.Talk, 1418, 270, 160, 510, 1497, 400),
            new ExploreHit.Target { id = "exit", kind = ExploreHit.Kind.Exit, hit = new Rect(2030, 380, 310, 210), point = new Vector2(2284, 548), stripX = 2290f, stripRight = true },
        };

        private static ExploreHit.Target T(string id, ExploreHit.Kind k, float x, float y, float w, float h, float px, float py) =>
            new ExploreHit.Target { id = id, kind = k, hit = new Rect(x, y, w, h), point = new Vector2(px, py) };

        [Test]
        public void ExitWinsEvenOverKarimasBed()
        {
            var r = ExploreHit.Pick(new Vector2(2100, 450), Room(), null);
            Assert.AreEqual(ExploreHit.Action.Exit, r.action);
            Assert.AreEqual("exit", r.id);
            Assert.AreEqual(ExploreHit.Action.Exit, ExploreHit.Pick(new Vector2(2300, 100), Room(), "bedK").action, "右の端の縦の帯も出口");
        }

        [Test]
        public void SelectedThingRunsWhenTappedAgain()
        {
            var r = ExploreHit.Pick(new Vector2(300, 400), Room(), "bedA");
            Assert.AreEqual(ExploreHit.Action.Execute, r.action);
            Assert.AreEqual("bedA", r.id);
        }

        [Test]
        public void SmallestAreaWinsAndTheOtherIsAlso()
        {
            // 収納箱とベッドが重なる所 → 小さい収納箱。ALSO にベッド
            var r = ExploreHit.Pick(new Vector2(250, 700), Room(), null);
            Assert.AreEqual(ExploreHit.Action.Select, r.action);
            Assert.AreEqual("chestA", r.id);
            Assert.AreEqual("bedA", r.also);
            // カリマと本棚 → カリマ
            Assert.AreEqual("karima", ExploreHit.Pick(new Vector2(1540, 500), Room(), null).id);
        }

        [Test]
        public void NearAPointPicksItElseWalk()
        {
            var r = ExploreHit.Pick(new Vector2(1000, 300), Room(), null);
            Assert.AreEqual(ExploreHit.Action.Walk, r.action, "どれにも近くない所は歩く");
            var near = new List<ExploreHit.Target> { T("a", ExploreHit.Kind.Tips, 0, 0, 10, 10, 500, 100) };
            Assert.AreEqual("a", ExploreHit.Pick(new Vector2(600, 700), near, null).id, "指す点の横 ±110 以内なら選ぶ");
            Assert.AreEqual(ExploreHit.Action.Walk, ExploreHit.Pick(new Vector2(620, 700), near, null).action);
        }

        [Test]
        public void CardSitsOnTheFarSideAndInsideTheScreen()
        {
            float w = ExploreHit.CardWidth("調べる", "収納箱", false);
            Assert.AreEqual(3 * 27.5f + 1f + 24f + 3 * 22.7f + 8f, w, 0.01f);
            var p = ExploreHit.CardPos(283f, 664f, w);
            Assert.AreEqual(283f + 70f, p.x, 0.01f, "左半分なら右へ");
            Assert.AreEqual(664f - 124f, p.y, 0.01f);
            var q = ExploreHit.CardPos(1497f, 400f, w);
            Assert.AreEqual(1497f - 70f - w, q.x, 0.01f, "右半分なら左へ");
            Assert.AreEqual(16f, ExploreHit.CardPos(800f, 60f, w).y, "上は 16 より上へ出ない");
            Assert.AreEqual(150f + 62f, ExploreHit.CardWidth("話す", "", true), 0.01f, "最低 150、パソコンは ENTER の分");
        }
    }
}
