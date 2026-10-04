using NUnit.Framework;
using Srpg.Battle;

namespace Srpg.Tests
{
    /// <summary>シナリオのト書きから演出の指示を読む（StageDirection）: 決まった言い方だけ読み、指示がなければ何もしない</summary>
    public class StageDirectionTests
    {
        [Test]
        public void NoDirectionDoesNothing()
        {
            var s = StageDirection.Parse("現代オルクス魔王城。アルシェの自室から開始。朝。");
            Assert.IsFalse(s.any);
            Assert.IsNull(s.dark);
        }

        [Test]
        public void LookUpAndSide()
        {
            var s = StageDirection.Parse("カメラ：空を見上げる");
            Assert.IsTrue(s.any);
            Assert.AreEqual(StageDirection.LookUp, s.dy);
            Assert.AreEqual(0f, s.dx);
            Assert.AreEqual(StageDirection.LookSide, StageDirection.Parse("カメラ:右を見る").dx);
            Assert.AreEqual(-StageDirection.LookSide, StageDirection.Parse("足音がする。カメラ：左を見る。").dx);
        }

        [Test]
        public void ZoomAndReset()
        {
            Assert.AreEqual(StageDirection.CloseIn, StageDirection.Parse("カメラ：寄る").zoom);
            Assert.AreEqual(StageDirection.PullBack, StageDirection.Parse("カメラ：引く").zoom);
            Assert.IsTrue(StageDirection.Parse("カメラ：もどす").reset);
        }

        [Test]
        public void DarkAndLight()
        {
            Assert.AreEqual(true, StageDirection.Parse("暗転").dark);
            Assert.AreEqual(false, StageDirection.Parse("暗転明け。朝の光").dark);
            Assert.AreEqual(false, StageDirection.Parse("明転").dark);
        }
    }
}
