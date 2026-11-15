using NUnit.Framework;
using Srpg.Battle;

namespace Srpg.Tests
{
    /// <summary>会話枠 H の折り返し（1行の字の数・禁則。2026-11-13）</summary>
    public class TalkWrapTests
    {
        [Test]
        public void WrapsAtMaxCharsAndKeepsLineBreaks()
        {
            var rows = DialogueView.WrapChars("一二三四五\n六七", 3);
            CollectionAssert.AreEqual(new[] { "一二三", "四五", "六七" }, rows);
        }

        [Test]
        public void PunctuationPushesTheLastCharToTheNextLine()
        {
            // 行の頭に「。」が来るときは、前の行の終わりの字を次の行へ送る（1行の字数を越えない。吹き出し配置の仕様 §7）
            CollectionAssert.AreEqual(new[] { "一二", "三。四" }, DialogueView.WrapChars("一二三。四", 3));
            CollectionAssert.AreEqual(new[] { "ギュンター、", "ごめん！" }, DialogueView.WrapChars("ギュンター、ごめん！", 6));
            foreach (var r in DialogueView.WrapChars("あらアルシェ様、おはようございます。その剣はどうなさったの？", DialogueView.BoxChars))
                Assert.LessOrEqual(r.Length, DialogueView.BoxChars);
        }

        [Test]
        public void ThirteenCharsFitTheFixedBox()
        {
            // 本文の箱（13字 × 31.8）は、幅 480 の箱の内側の線（6px 内側）に収まる
            float txW = UnityEngine.Mathf.Round(DialogueView.BoxChars * 31.8f), left = UnityEngine.Mathf.Round(844f - txW / 2f);
            Assert.GreaterOrEqual(left, DialogueView.BoxX0 + 6f);
            Assert.LessOrEqual(left + txW, DialogueView.BoxX0 + DialogueView.BoxW - 6f);
            Assert.AreEqual(214f, DialogueView.BoxH);
        }

        [Test]
        public void MaxCharsKeepsTheBubbleOnScreen()
        {
            // 支援会話（26字・2行のまま）: 吹き出しの左 287 でも、右の端 1648 を越えない
            float txW = DialogueView.MaxChars * 31.8f + 10f, w = txW + 100f;
            Assert.LessOrEqual(287f + w, 1648f);
        }
    }
}
