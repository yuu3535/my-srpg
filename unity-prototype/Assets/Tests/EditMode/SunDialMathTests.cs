using NUnit.Framework;
using Srpg.Battle.Menu;
using UnityEngine;

namespace Srpg.Tests
{
    /// <summary>回る太陽盤の計算（試作 wheel-math.js の写し。2026-11-13）</summary>
    public class SunDialMathTests
    {
        [Test]
        public void GeometryMatchesThePrototype()
        {
            var g = SunDialMath.Make();
            Assert.AreEqual(20f, g.pitch, 1e-4f);
            Assert.AreEqual(100f, g.period, 1e-4f);
            Assert.AreEqual(-15f, g.inset, 1e-4f);
            Assert.AreEqual(SunDialMath.TipRadius - 12f, g.radius, 1e-4f);
            Assert.AreEqual(292.32f, g.outerRadius, 1e-3f);
        }

        [Test]
        public void SelectingBringsTheCommandToTheNeedle()
        {
            var g = SunDialMath.Make();
            float phase = SunDialMath.TargetFor(-2f * g.pitch, SunDialMath.IndexOf("出撃"), g);
            Assert.AreEqual(0f, SunDialMath.AngleFor(phase, SunDialMath.IndexOf("出撃"), g), 1e-4f);
            // 出撃が真ん中のとき、上から セーブ・身支度・出撃・探索・支援会話（拠点メニューの今の並び）
            string[] order = { "セーブ", "身支度", "出撃", "探索", "支援会話" };
            for (int k = 0; k < order.Length; k++)
                Assert.AreEqual((k - 2) * g.pitch, SunDialMath.AngleFor(phase, SunDialMath.IndexOf(order[k]), g), 1e-3f, order[k]);
            // 支援会話へ回すと、上から 出撃・探索・支援会話・セーブ・身支度（支援会話の画面の並び）
            float next = SunDialMath.TargetFor(phase, SunDialMath.IndexOf("支援会話"), g);
            Assert.AreEqual(-40f, next - phase, 1e-3f);   // 近い向きへ2つ分
            string[] order2 = { "出撃", "探索", "支援会話", "セーブ", "身支度" };
            for (int k = 0; k < order2.Length; k++)
                Assert.AreEqual((k - 2) * g.pitch, SunDialMath.AngleFor(next, SunDialMath.IndexOf(order2[k]), g), 1e-3f, order2[k]);
            Assert.AreEqual(SunDialMath.IndexOf("支援会話"), SunDialMath.Centered(next, g));
        }

        [Test]
        public void SlotsSitOnTheArcAndFadeAtTheEnds()
        {
            var g = SunDialMath.Make();
            var top = SunDialMath.SlotOf(0f, 0, g, -1, SunDialMath.TipRadius);
            Assert.AreEqual(195f, top.y, 1e-3f);
            var up = SunDialMath.SlotOf(-40f, 0, g, -1, SunDialMath.TipRadius);
            Assert.AreEqual(195f - g.radius * Mathf.Sin(40f * Mathf.Deg2Rad), up.y, 1e-3f);
            Assert.AreEqual(1f, up.opacity, 1e-4f);
            var edge = SunDialMath.SlotOf(-50f, 0, g, -1, SunDialMath.TipRadius);
            Assert.AreEqual(0f, edge.opacity, 1e-4f);
        }

        [Test]
        public void NeedleStepsAroundTheDiamonds()
        {
            var n0 = SunDialMath.NeedleFor(0);
            var n6 = SunDialMath.NeedleFor(6);
            Assert.AreEqual(n0.angle + 360f, n6.angle, 1e-3f);
            Assert.AreEqual(n0.radius, SunDialMath.TipRadius, 0.5f);
            Assert.Greater(SunDialMath.NeedleFor(1).angle, n0.angle);
        }

        [Test]
        public void SpringSettlesOnTheTarget()
        {
            float p = 0f, v = 0f;
            bool settled = false;
            for (int i = 0; i < 600 && !settled; i++) { var r = SunDialMath.Spring(p, v, 40f, 1f / 60f); p = r.position; v = r.velocity; settled = r.settled; }
            Assert.IsTrue(settled);
            Assert.AreEqual(40f, p);
        }

        [Test]
        public void FlameIgnitesThenBurnsInALoopThenGoesOut()
        {
            // 点火 1〜4コマ（180ms・一度だけ）→ 燃焼 5〜11コマ（590ms のくり返し）。消火 12〜17コマ（200ms）で消える
            Assert.AreEqual(0, SunDialView.FlameFrame(false, 0f));
            Assert.AreEqual(3, SunDialView.FlameFrame(false, 0.17f));
            Assert.AreEqual(4, SunDialView.FlameFrame(false, 0.19f));
            Assert.AreEqual(10, SunDialView.FlameFrame(false, 0.18f + 0.58f));
            Assert.AreEqual(4, SunDialView.FlameFrame(false, 0.18f + 0.59f + 0.01f));
            Assert.AreEqual(11, SunDialView.FlameFrame(true, 0f));
            Assert.AreEqual(16, SunDialView.FlameFrame(true, 0.195f));
            Assert.AreEqual(-1, SunDialView.FlameFrame(true, 0.2f));
        }
    }
}
