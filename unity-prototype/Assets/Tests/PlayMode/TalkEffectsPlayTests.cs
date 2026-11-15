using System.Collections;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>
    /// 吹き出しの演出（2026-11-15 吹き出し配置の仕様 §4〜§6）: ガヤは3人以上の場面の外側の人だけ・メインで話しているあいだと地の文では出さない／
    /// 画面の外の声（ざわざわは4つ）／叫ぶ台詞は一気に出る
    /// </summary>
    public class TalkEffectsPlayTests
    {
        private static ScenarioLine L(string who, string text, GayaLine[] gaya = null, string fx = null) => new ScenarioLine { type = "line", speaker = who, text = text, gaya = gaya, fx = fx };
        private static GayaLine G(string who, string text, bool strong = false) => new GayaLine { who = who, text = text, strong = strong };

        [UnityTest]
        public IEnumerator GayaMobAndShout()
        {
            GameSettings.ResetForTest();
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;
            void To(string text) { for (int i = 0; i < 20 && dialogue.CurrentLine?.text != text; i++) dialogue.Advance(); Assert.AreEqual(text, dialogue.CurrentLine?.text); }
            try
            {
                const string shout = "そこまでだ！ 全員、剣を収めろ！";
                dialogue.Play(new ScenarioBlock
                {
                    id = "test_fx", part = "story", location = "オルクス城・回廊",
                    lines = new[]
                    {
                        L("アルシェ", "…"), L("ギュンター", "…"), L("カリマ", "…"), L("キャリー", "…"),
                        // 外側のカリマ・キャリーは出る。内側のギュンターは出ない
                        L("アルシェ", "ギュンター、ごめん！", new[] { G("カリマ", "えっ、そうなの？"), G("キャリー", "あらあら", true), G("ギュンター", "出ない") }),
                        // メインで話している人のガヤは出さない
                        L("カリマ", "あ！遅いよアル…！", new[] { G("カリマ", "出ない") }),
                        new ScenarioLine { type = "narration", text = "回廊の向こうで、鐘が鳴った。", gaya = new[] { G("キャリー", "出ない") }, mob = "murmur" },
                        L("ギュンター", shout, null, "shout"),
                    }
                });
                To("ギュンター、ごめん！");
                CollectionAssert.AreEquivalent(new[] { "カリマ", "キャリー" }, dialogue.GayaNow);
                // 下の端は頭のてっぺん −26（カリマ 293・キャリー 273）。ふつうは高さ 50、強めは 54
                Assert.AreEqual(267f, dialogue.GayaRect("カリマ").yMax, 0.5f);
                Assert.AreEqual(50f, dialogue.GayaRect("カリマ").height, 0.5f);
                Assert.AreEqual(247f, dialogue.GayaRect("キャリー").yMax, 0.5f);
                Assert.AreEqual(54f, dialogue.GayaRect("キャリー").height, 0.5f);
                Assert.LessOrEqual(dialogue.GayaRect("キャリー").xMax, 1688f - 16f, "画面の端から 16px 以内に収まらない");
                Assert.IsFalse(dialogue.ShoutNow);

                To("あ！遅いよアル…！");
                CollectionAssert.IsEmpty(dialogue.GayaNow);

                To("回廊の向こうで、鐘が鳴った。");
                CollectionAssert.IsEmpty(dialogue.GayaNow, "地の文のあいだはガヤを出さない");
                Assert.AreEqual(4, dialogue.MobCount, "ざわざわは4つ");

                To(shout);
                Assert.IsTrue(dialogue.ShoutNow);
                Assert.AreEqual(0, dialogue.MobCount, "画面の外の声は次の台詞で消える");
                Assert.IsFalse(dialogue.Revealing);
                Assert.IsTrue(dialogue.ShownText.StartsWith("そこまでだ"), "叫ぶ台詞は全文が一気に出る");
                dialogue.Close();
                Assert.IsFalse(dialogue.ShoutNow);

                // 2人の場面ではガヤを出さない
                dialogue.Play(new ScenarioBlock
                {
                    id = "test_fx2", part = "story",
                    lines = new[] { L("アルシェ", "…"), L("ギュンター", "遅い。", new[] { G("アルシェ", "出ない") }) }
                });
                To("遅い。");
                CollectionAssert.IsEmpty(dialogue.GayaNow);
            }
            finally { dialogue.Close(); }
        }
    }
}
