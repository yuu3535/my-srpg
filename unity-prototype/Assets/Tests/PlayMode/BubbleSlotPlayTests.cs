using System.Collections;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>
    /// 吹き出しの位置は立つ枠ごと（原作者 2026-11-15）: 背の高さに関係なく同じ枠なら同じ所。文が長くなっても、上の端と話す人の側の端は動かない
    /// </summary>
    public class BubbleSlotPlayTests
    {
        private static ScenarioLine L(string who, string text) => new ScenarioLine { type = "line", speaker = who, text = text };

        [UnityTest]
        public IEnumerator SameSlotSameEdgesWhateverTheTextOrHeight()
        {
            GameSettings.ResetForTest();
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;

            Rect Show(string left, string right, string speaker, string text)
            {
                DialogueCast.DebugLeft = new System.Collections.Generic.HashSet<string> { left };
                dialogue.Play(new ScenarioBlock { id = "", part = "story", lines = new[] { L(left, "…"), L(right, "…"), L(speaker, text) } }, null);
                for (int i = 0; i < 10 && dialogue.CurrentLine?.text != text; i++) dialogue.Advance();
                Assert.AreEqual(text, dialogue.CurrentLine?.text);
                return dialogue.BubbleRect;
            }
            try
            {
                // 右の人: 右の端と上の端は、短い文でも長い文でも、子供でも大人でも同じ
                var shortR = Show("アルシェ", "カリマ", "カリマ", "短い。");
                Assert.AreEqual("pairR", dialogue.BubbleSlotNow);
                var longR = Show("アルシェ", "カリマ", "カリマ", "長い台詞の見本です。吹き出しの大きさと、\n立ち絵との重なりを確かめます。");
                var tallR = Show("アルシェ", "ギュンター", "ギュンター", "短い。");
                Assert.AreEqual(shortR.xMax, longR.xMax, 0.5f, "文が長くなると右の端が動く");
                Assert.AreEqual(shortR.yMin, longR.yMin, 0.5f, "文が長くなると上の端が動く");
                Assert.Greater(longR.height, shortR.height, "2行の文で吹き出しが高くならない");
                Assert.Greater(longR.width, shortR.width + 1f, "長い文で吹き出しが広がらない");
                Assert.AreEqual(shortR.xMax, tallR.xMax, 0.5f, "背の高い人で位置が変わる");
                Assert.AreEqual(shortR.yMin, tallR.yMin, 0.5f, "背の高い人で位置が変わる");
                // 左の人: 左の端が動かない
                var shortL = Show("アルシェ", "カリマ", "アルシェ", "短い。");
                var longL = Show("アルシェ", "カリマ", "アルシェ", "改行なしの長い文の見本です。二十六字を超えると自動で折り返します。");
                Assert.AreEqual("pairL", dialogue.BubbleSlotNow);
                Assert.AreEqual(shortL.xMin, longL.xMin, 0.5f, "文が長くなると左の端が動く");

                // 枠ごとの1行の字数・1ページの行数（真ん中のすき間に置く案）: 13字・4行なら、狭く・下へ伸びる（保存はしない）
                Show("アルシェ", "カリマ", "アルシェ", "短い。");
                dialogue.OpenBubbleTool();   // 長い文の見本で出す
                var wide = dialogue.BubbleRect;
                dialogue.SetBubbleNumbers(null, null, null, null, 13, 4);
                var narrow = dialogue.BubbleRect;
                Assert.AreEqual(wide.xMin, narrow.xMin, 0.5f, "字数を変えると左の端が動く");
                Assert.AreEqual(wide.yMin, narrow.yMin, 0.5f, "行数を変えると上の端が動く");
                Assert.AreEqual(30f + 4 * 50f + 34f, narrow.height, 0.5f, "4行の高さにならない");
                Assert.AreEqual(1, dialogue.PageCount, "4行なら1ページに収まる");
                Assert.AreEqual(Mathf.Round(13 * 31.8f) + 110f, narrow.width, 0.5f, "字数を決めた枠は、その字数の幅（540 より細い）");
            }
            finally
            {
                DialogueCast.DebugLeft = null;
                dialogue.Close();
            }
        }
    }
}
