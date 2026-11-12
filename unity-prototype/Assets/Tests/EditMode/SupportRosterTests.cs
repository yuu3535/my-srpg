using NUnit.Framework;
using Srpg.Battle.Menu;

namespace Srpg.Tests
{
    /// <summary>支援会話の相手選び（2026-11-12）: 並び順・話せる会話の数・帯の一文・ランクの菱形・動き</summary>
    public class SupportRosterTests
    {
        private static SupportRoster Sample() => SupportRoster.Load();

        [Test]
        public void SampleDataLoadsInJoinOrder()
        {
            var r = Sample();
            Assert.AreEqual(5, r.members.Count);
            Assert.AreEqual("arshe", r.members[0].id);
            Assert.AreEqual("philo", r.members[4].id);
        }

        [Test]
        public void PartnersAreSortedReadyGaugeLockedAllSeen()
        {
            var r = Sample();
            var arshe = r.PartnersOf("arshe");
            CollectionAssert.AreEqual(new[] { "albus", "ann", "ringholm", "philo" }, arshe.ConvertAll(p => p.member.id));
            // アルバス: アルシェ（話せる）→ アン（ためている）→ リングホルム（すべて見た）。組がないフィロは出さない
            var albus = r.PartnersOf("albus");
            CollectionAssert.AreEqual(new[] { "arshe", "ann", "ringholm" }, albus.ConvertAll(p => p.member.id));
            Assert.AreEqual(SupportRoster.RowState.AllSeen, albus[2].pair.Row);
        }

        [Test]
        public void ReadyCountsAndDots()
        {
            var r = Sample();
            Assert.AreEqual(2, r.ReadyTotal());
            Assert.IsTrue(r.HasReady("arshe"));
            Assert.IsTrue(r.HasReady("albus"));
            Assert.IsTrue(r.HasReady("ann"));
            Assert.IsFalse(r.HasReady("ringholm"));
            Assert.IsFalse(r.HasReady("philo"));
            // 加入していない人との組は数えない
            r.pairs.Add(new SupportRoster.Pair { a = "arshe", b = "nobody", rank = 0, state = "Ready" });
            Assert.AreEqual(2, r.ReadyTotal());
        }

        [Test]
        public void BandSentence()
        {
            var r = Sample();
            var b = r.BandFor("arshe");
            Assert.AreEqual(SupportRoster.BandKind.Pair, b.kind);
            Assert.AreEqual("アルシェ", b.a);
            Assert.AreEqual("アルバス", b.b);   // 一覧の一番上の相手
            Assert.AreEqual(1, b.rank);
            Assert.AreEqual("の絆が、深まったようだ。", SupportRoster.BandTail(b.rank));
            Assert.AreEqual("の間に、絆が芽生えたようだ。", SupportRoster.BandTail(0));
            Assert.AreEqual("の絆が、固く結ばれようとしている。", SupportRoster.BandTail(2));
            Assert.AreEqual(SupportRoster.BandKind.Someone, r.BandFor("ringholm").kind);
            foreach (var p in r.pairs) if (p.state == "Ready") p.state = "Gauge";
            Assert.AreEqual(SupportRoster.BandKind.Quiet, r.BandFor("arshe").kind);
            Assert.AreEqual(0, r.ReadyTotal());
        }

        [Test]
        public void RankPips()
        {
            var ready = new SupportRoster.Pair { rank = 1, state = "Ready" };
            Assert.AreEqual(SupportRoster.Pip.Seen, SupportRoster.PipOf(ready, 0));
            Assert.AreEqual(SupportRoster.Pip.Unread, SupportRoster.PipOf(ready, 1));
            Assert.AreEqual(SupportRoster.Pip.NotYet, SupportRoster.PipOf(ready, 2));
            // ためている途中は、届いていない見た目のまま
            var gauge = new SupportRoster.Pair { rank = 2, state = "Gauge", points = 64 };
            Assert.AreEqual(SupportRoster.Pip.Seen, SupportRoster.PipOf(gauge, 1));
            Assert.AreEqual(SupportRoster.Pip.NotYet, SupportRoster.PipOf(gauge, 2));
            var all = new SupportRoster.Pair { rank = 3, state = "Ready" };
            Assert.IsFalse(all.Talkable);
            Assert.AreEqual(SupportRoster.Pip.Seen, SupportRoster.PipOf(all, 2));
        }

        [Test]
        public void Motions()
        {
            // 跳ねは 3.6秒の6%（0.216秒）で一番上（6px）、11%を過ぎたら止まる
            Assert.AreEqual(6f, SupportSelectView.Motion.MoreHop(0, 0.216f), 0.01f);
            Assert.AreEqual(0f, SupportSelectView.Motion.MoreHop(0, 1f), 0.001f);
            Assert.AreEqual(6f, SupportSelectView.Motion.MoreHop(1, 0.216f + 0.22f), 0.01f);
            // 暗転は 18%〜78% が真っ暗
            Assert.AreEqual(0f, SupportSelectView.Motion.Veil(0f), 0.001f);
            Assert.AreEqual(1f, SupportSelectView.Motion.Veil(0.95f), 0.001f);
            Assert.AreEqual(0f, SupportSelectView.Motion.Veil(1.9f), 0.001f);
            Assert.IsTrue(SupportSelectView.Motion.VeilFull(0.95f));
            Assert.IsFalse(SupportSelectView.Motion.VeilFull(0.1f));
            // 点滅は 1 → 0.25 → 1
            Assert.AreEqual(1f, SupportSelectView.Motion.PipBlink(0f), 0.001f);
            Assert.AreEqual(0.25f, SupportSelectView.Motion.PipBlink(1.6f), 0.001f);
        }
    }
}
