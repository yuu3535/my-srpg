using NUnit.Framework;
using Srpg.Battle.Menu;
using UnityEngine;

namespace Srpg.Tests
{
    /// <summary>
    /// 拠点メニュー Hub2 の開閉（2026-11-09）。試作 hub2-sweep-model.js と同じ時刻表・節目・飛ばすになっているか
    /// </summary>
    public class Hub2MotionTests
    {
        private static float Total(Hub2Motion.Kind k, Hub2Motion.Effect e, Hub2Motion.Length l) => Hub2Motion.TearFrame(k, 0f, e, l).total;

        [Test]
        public void LengthsMatchTheSpec()
        {
            // 長い版: 閉じる1.43秒・開く1.93秒。短い版: 閉じる0.62秒・開く0.82秒。なし: 0.15秒のフェード
            Assert.AreEqual(1.43f, Total(Hub2Motion.Kind.Close, Hub2Motion.Effect.Full, Hub2Motion.Length.Long), 1e-4f);
            Assert.AreEqual(1.93f, Total(Hub2Motion.Kind.Open, Hub2Motion.Effect.Full, Hub2Motion.Length.Long), 1e-4f);
            Assert.AreEqual(0.62f, Total(Hub2Motion.Kind.Close, Hub2Motion.Effect.Full, Hub2Motion.Length.Short), 1e-4f);
            Assert.AreEqual(0.82f, Total(Hub2Motion.Kind.Open, Hub2Motion.Effect.Full, Hub2Motion.Length.Short), 1e-4f);
            // 設定「短い」は節目でも短い版
            Assert.AreEqual(0.82f, Total(Hub2Motion.Kind.Open, Hub2Motion.Effect.Short, Hub2Motion.Length.Long), 1e-4f);
            Assert.AreEqual(0.15f, Total(Hub2Motion.Kind.Open, Hub2Motion.Effect.None, Hub2Motion.Length.Long), 1e-4f);
        }

        [Test]
        public void OpenShowsTheMenuWhenTheTearOpensAndLandsTheStarLast()
        {
            var e = Hub2Motion.Effect.Full; var l = Hub2Motion.Length.Long;
            // 弾ける 0〜0.2 → 切れ目 0.2〜0.75 → 止まる 〜0.81 → 裂ける 〜1.43 → 着地 〜1.93
            var f = Hub2Motion.TearFrame(Hub2Motion.Kind.Open, 0.1f, e, l);
            Assert.AreEqual(Hub2Motion.Phase.Flare, f.phase); Assert.IsFalse(f.menu); Assert.IsTrue(f.exploreBurst > 0f);
            f = Hub2Motion.TearFrame(Hub2Motion.Kind.Open, 0.5f, e, l);
            Assert.AreEqual(Hub2Motion.Phase.Cut, f.phase); Assert.IsFalse(f.menu);
            f = Hub2Motion.TearFrame(Hub2Motion.Kind.Open, 1.0f, e, l);
            Assert.AreEqual(Hub2Motion.Phase.Open, f.phase); Assert.IsTrue(f.menu); Assert.IsTrue(f.clipInside);
            f = Hub2Motion.TearFrame(Hub2Motion.Kind.Open, 1.7f, e, l);
            Assert.IsFalse(f.hasTear); Assert.IsTrue(f.land > 0f && f.land < 1f);
            Assert.IsTrue(Hub2Motion.TearFrame(Hub2Motion.Kind.Open, 1.931f, e, l).done);   // 足し算の誤差の分だけ後
        }

        [Test]
        public void CloseCutsTheMenuAndGoesBackToExplore()
        {
            var e = Hub2Motion.Effect.Full; var l = Hub2Motion.Length.Short;
            var f = Hub2Motion.TearFrame(Hub2Motion.Kind.Close, 0.04f, e, l);
            Assert.IsTrue(f.menu); Assert.IsTrue(f.burst > 0f);
            f = Hub2Motion.TearFrame(Hub2Motion.Kind.Close, 0.5f, e, l);
            Assert.IsTrue(f.clipOutside);
            f = Hub2Motion.TearFrame(Hub2Motion.Kind.Close, 0.62f, e, l);
            Assert.IsFalse(f.menu); Assert.IsTrue(f.explore); Assert.IsTrue(f.done);
        }

        [Test]
        public void TheTearStartsAtTheStarAndEndsAtTheLowerLeft()
        {
            var g = Hub2Motion.TearGeometry();
            // A は画面の外枠の上（右の端か上の端）
            Assert.IsTrue(Mathf.Abs(g.A.x - Hub2Motion.BaseWidth) < 0.01f || Mathf.Abs(g.A.y) < 0.01f);
            var m0 = Hub2Motion.MeteorAt(0f, g);
            Assert.AreEqual(g.S.x, m0.pos.x, 0.01f); Assert.AreEqual(g.S.y, m0.pos.y, 0.01f);
            var m1 = Hub2Motion.MeteorAt(1f, g);
            Assert.AreEqual(g.B2.x, m1.pos.x, 0.01f); Assert.AreEqual(g.B2.y, m1.pos.y, 0.01f);
            // 裂け始めは何も見えず、裂けきると画面のすみまで裂け目の中
            Assert.IsFalse(Hub2Motion.InsideLens(0f, 844f, 390f, g));
            foreach (var p in new[] { new Vector2(1, 1), new Vector2(1687, 1), new Vector2(1, 779), new Vector2(1687, 779), new Vector2(844, 390) })
                Assert.IsTrue(Hub2Motion.InsideLens(1f, p.x, p.y, g), $"{p} が裂け目の外に残る");
        }

        [Test]
        public void SkipFinishesRightAwayAndIsTheOnlyInputWhileMoving()
        {
            var m = new Hub2Motion.Machine(Hub2Motion.State.Closed);
            Assert.IsFalse(m.Skip(), "止まっているときに飛ばせてしまう");
            Assert.IsTrue(m.Open(Hub2Motion.Length.Long));
            Assert.IsTrue(m.Locked);
            Assert.IsFalse(m.Close(), "開く途中で閉じられてしまう（飛ばすだけのはず）");
            m.Step(0.3f, Hub2Motion.Effect.Full);
            Assert.IsTrue(m.Skip());
            Assert.AreEqual(Hub2Motion.State.Open, m.State);
            Assert.IsTrue(m.Close());
            m.Step(0.62f, Hub2Motion.Effect.Full);
            Assert.AreEqual(Hub2Motion.State.Closed, m.State);
        }

        [Test]
        public void LongVersionOnlyAtMilestonesWhenOpening()
        {
            var s = new Hub2Motion.Milestones();
            // 起動して最初
            var r = Hub2Motion.OpenLength(Hub2Motion.Effect.Full, s, "1");
            Assert.AreEqual(Hub2Motion.Length.Long, r.length); Assert.AreEqual(Hub2Motion.ReasonBoot, r.reason);
            Hub2Motion.AfterOpen(s, "1");
            Assert.AreEqual(Hub2Motion.Length.Short, Hub2Motion.OpenLength(Hub2Motion.Effect.Full, s, "1").length, "同じ日の2回目は短い版");
            // その日の最初
            Assert.AreEqual(Hub2Motion.ReasonDay, Hub2Motion.OpenLength(Hub2Motion.Effect.Full, s, "2").reason);
            // 節目が重なったら重い方を1回だけ
            Hub2Motion.MarkMilestone(s, Hub2Motion.ReasonBattle);
            Hub2Motion.MarkMilestone(s, Hub2Motion.ReasonChapter);
            Hub2Motion.MarkMilestone(s, Hub2Motion.ReasonEvent);
            Assert.AreEqual(Hub2Motion.ReasonChapter, Hub2Motion.OpenLength(Hub2Motion.Effect.Full, s, "1").reason);
            Assert.AreEqual(Hub2Motion.Length.Short, Hub2Motion.OpenLength(Hub2Motion.Effect.Short, s, "1").length, "設定「短い」なら節目でも短い版");
            Hub2Motion.AfterOpen(s, "1");
            Assert.AreEqual(Hub2Motion.Length.Short, Hub2Motion.OpenLength(Hub2Motion.Effect.Full, s, "1").length, "節目は1回流したら消える");
        }

        [Test]
        public void PageDiamondsAreAlwaysDifferentColors()
        {
            for (float t = 0f; t < 20f; t += 0.7f)
            {
                var a = Hub2Motion.DiaColor(0, t); var b = Hub2Motion.DiaColor(1, t); var c = Hub2Motion.DiaColor(2, t);
                Assert.IsFalse(a == b || b == c || a == c, $"{t}秒で同じ色の菱形がある");
            }
        }
    }
}
