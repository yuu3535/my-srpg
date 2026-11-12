using System.Collections;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>
    /// 会話枠 H（2026-11-13）: 1ページ2行まで／立ち絵の無い人は舞台の枠を取らない／ログを開いている間は進まない・閉じると戻る／
    /// 支援会話は CLOSE で閉じて呼んだ側へ戻る
    /// </summary>
    public class TalkPlayTests
    {
        private static ScenarioLine L(string type, string who, string text) => new ScenarioLine { type = type, speaker = who, text = text };

        private static IEnumerator Corridor()
        {
            GameSettings.ResetForTest();
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;
        }

        [UnityTest]
        public IEnumerator PagesCastLogAndSupport()
        {
            yield return Corridor();
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            var block = new ScenarioBlock
            {
                id = "test_talk", location = "オルクス城・回廊",
                lines = new[]
                {
                    L("line", "ギュンター", "遅い。"),
                    L("line", "キャリー", "あら。"),
                    L("line", "カリマ", "一行目。\n二行目。\n三行目。"),
                    L("line", "城の兵士", "伝言です！"),
                    L("narration", null, "鐘が鳴った。"),
                }
            };
            dialogue.Play(block);
            Assert.AreEqual(1, dialogue.PageCount);
            dialogue.Advance();
            dialogue.Advance();
            Assert.AreEqual("カリマ", dialogue.CurrentLine.speaker);
            Assert.AreEqual(2, dialogue.PageCount, "3行は2ページ（1ページ2行まで）");
            dialogue.Advance();
            Assert.AreEqual(1, dialogue.PageIndex);
            dialogue.Advance();
            // 立ち絵の無い人が話しても、右の2人はそのまま
            Assert.AreEqual("城の兵士", dialogue.CurrentLine.speaker);
            CollectionAssert.AreEquivalent(new[] { "ギュンター", "キャリー" }, dialogue.RightCast);

            // ログを開いている間は進まない
            dialogue.OpenLog();
            Assert.IsTrue(dialogue.LogOpen);
            dialogue.Advance();
            Assert.AreEqual("城の兵士", dialogue.CurrentLine.speaker);
            dialogue.CloseLog();
            Assert.IsFalse(dialogue.LogOpen);
            dialogue.Advance();
            Assert.AreEqual("narration", dialogue.CurrentLine.type);
            dialogue.Advance();
            Assert.IsFalse(dialogue.IsPlaying);

            // 支援会話: CLOSE の星で閉じ、呼んだ側へ
            bool closed = false;
            dialogue.PlaySupport(new ScenarioBlock { id = "test_support", lines = new[] { L("line", "ギュンター", "構えを崩すな。"), L("line", "アルシェ", "はい。") } }, 1, "三百本の素振り", () => closed = true);
            Assert.IsTrue(dialogue.SupportMode);
            yield return null;
            var star = GameObject.Find("CLOSEStar");
            Assert.IsNotNull(star, "CLOSE の星が無い");
            star.GetComponent<UnityEngine.UI.Button>().onClick.Invoke();
            Assert.IsTrue(closed);
            Assert.IsFalse(dialogue.IsPlaying);
            Assert.IsFalse(dialogue.SupportMode);
        }
    }
}
