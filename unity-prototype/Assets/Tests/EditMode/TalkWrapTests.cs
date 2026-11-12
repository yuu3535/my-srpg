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
        public void PunctuationHangsOnThePreviousLine()
        {
            var rows = DialogueView.WrapChars("一二三。四", 3);
            CollectionAssert.AreEqual(new[] { "一二三。", "四" }, rows);
        }

        [Test]
        public void MaxCharsKeepsTheBubbleOnScreen()
        {
            // 左の外側の人（吹き出しの左 287）でも、右の端 1648 を越えない
            float txW = DialogueView.MaxChars * 31.8f + 10f, w = txW + 100f;
            Assert.LessOrEqual(287f + w, 1648f);
        }
    }
}
