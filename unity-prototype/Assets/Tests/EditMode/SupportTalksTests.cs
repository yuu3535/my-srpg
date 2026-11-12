using NUnit.Framework;
using Srpg.Battle.Menu;

namespace Srpg.Tests
{
    /// <summary>支援会話の台本（2026-11-13）: 組とランクで探す・会話のブロックにする</summary>
    public class SupportTalksTests
    {
        [Test]
        public void FindsByPairAndRank()
        {
            SupportTalks.Load();
            var t = SupportTalks.Find("albus", "arshe", 1);   // 順不同・B
            Assert.IsNotNull(t);
            Assert.AreEqual("B", t.rank);
            Assert.IsNull(SupportTalks.Find("albus", "arshe", 0), "C の台本は無い");
            var block = t.ToBlock();
            Assert.AreEqual(4, t.lines.Length, "台詞が読めていない");
            Assert.AreEqual(t.lines.Length, block.lines.Length);
            Assert.AreEqual("support", block.part);
        }

        [Test]
        public void ReadsReplacementJson()
        {
            SupportTalks.Load("{\"talks\":[{\"a\":\"x\",\"b\":\"y\",\"rank\":\"A\",\"title\":\"t\",\"lines\":[{\"type\":\"line\",\"speaker\":\"X\",\"text\":\"hi\"}]}]}");
            Assert.AreEqual(1, SupportTalks.All.Count);
            Assert.AreEqual(2, SupportTalks.Find("y", "x", 2).RankIndex);
            SupportTalks.Reset();
        }
    }
}
