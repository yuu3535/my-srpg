using System.Collections;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>
    /// 吹き出しの置き場所（2026-11-15 デザインのチャットの仕様）: 箱は真ん中に固定（高さは1〜3行で伸びる。2026-11-16）・先に来た人が内側・内側は下の尾・外側は横の尾（隣の頭をよける）・
    /// 立ち絵のない人は尾なし・1ページ3行
    /// </summary>
    public class BubblePlacementPlayTests
    {
        private static ScenarioLine L(string who, string text) => new ScenarioLine { type = "line", speaker = who, text = text };

        [UnityTest]
        public IEnumerator FixedBoxInnerFirstAndTails()
        {
            GameSettings.ResetForTest();
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;
            var box = Rect.MinMaxRect(604f, 98f, 1084f, 312f);   // 3行のとき
            var box1 = Rect.MinMaxRect(604f, 98f, 1084f, 212f);  // 1行のとき（上・左右の端は同じ。原作者 2026-11-16）
            // 9字以下の1行は字数に合わせた小さい箱（名前札が入る幅より狭くしない）。話す人の側の端は動かない（2026-11-18）
            // ギュンター「遅い。」: 名前札 182＋68＝250。カリマ（9字）: 286＋67＝353
            Rect smallR = Rect.MinMaxRect(834f, 98f, 1084f, 212f), smallL = Rect.MinMaxRect(604f, 98f, 957f, 212f);
            // 来た順: アルシェ（左の内）→ ギュンター（右の内）→ カリマ（左の外）→ キャリー（右の外）
            dialogue.Play(new ScenarioBlock
            {
                id = "test_place", part = "story", location = "オルクス城・回廊",
                lines = new[]
                {
                    L("アルシェ", "ギュンター、ごめん！\nまた寝坊した！\n次はちゃんと起きるよ！"),
                    L("ギュンター", "遅い。"),
                    L("カリマ", "あ！遅いよアル…！"),
                    L("キャリー", "あらアルシェ様、おはようございます。その剣はどうなさったの？"),
                    L("城の兵士", "至急お越しください！"),
                    L("アルシェ", "一行目。\n二行目。\n三行目。\n四行目。"),
                }
            });
            try
            {
                void To(string who) { for (int i = 0; i < 12 && dialogue.CurrentLine?.speaker != who; i++) dialogue.Advance(); }
                void Stand(string who, float x, float top, bool inner)
                {
                    Assert.IsTrue(dialogue.TryStand(who, out var hx, out var ht, out var inn), who + " が舞台にいない");
                    Assert.AreEqual(x, hx, 0.5f, who + " の頭の中心 X");
                    Assert.AreEqual(top, ht, 0.5f, who + " の頭のてっぺん");
                    Assert.AreEqual(inner, inn, who + " の内・外");
                }
                Stand("アルシェ", 544f, 297f, true);
                Stand("ギュンター", 844f + 300f + 16f, 230f, true);
                Stand("カリマ", 244f, 293f, false);
                Stand("キャリー", 1444f, 273f, false);

                // 左の内（3行）: 下の尾。付け根は 544+40 を [668, 1020] に収めた 668、先 (−37, 下の端+42)（見本01）
                Assert.AreEqual(box, dialogue.BubbleRect);
                Assert.AreEqual(1, dialogue.PageCount);
                Assert.AreEqual("bottom", dialogue.TailNow.edge);
                Assert.AreEqual(new Vector2(668f - 37f, 354f), dialogue.TailNow.tip);

                // 右の内（3字）: 小さい箱・1行の高さ。右の端は 1084 のまま。尾は下の端について上がる
                To("ギュンター");
                Assert.AreEqual("ギュンター", dialogue.CurrentLine.speaker);
                Assert.AreEqual(smallR, dialogue.BubbleRect);
                Assert.AreEqual("bottom", dialogue.TailNow.edge);
                Assert.AreEqual(new Vector2(1020f + 37f, 254f), dialogue.TailNow.tip);

                // 左の外（9字）: 小さい箱。左の辺から。低い箱なので付け根は下の端 −30 の 182、先 (554, 213)
                To("カリマ");
                Assert.AreEqual("カリマ", dialogue.CurrentLine.speaker);
                Assert.AreEqual(smallL, dialogue.BubbleRect);
                Assert.AreEqual("left", dialogue.TailNow.edge);
                Assert.AreEqual(new Vector2(554f, 213f), dialogue.TailNow.tip);

                // 右の外: 内側がギュンター（頭 230）なので、先は 190 まで上がる
                To("キャリー");
                Assert.AreEqual("キャリー", dialogue.CurrentLine.speaker);
                Assert.AreEqual(box, dialogue.BubbleRect);
                Assert.AreEqual("right", dialogue.TailNow.edge);
                Assert.AreEqual(new Vector2(1134f, 190f), dialogue.TailNow.tip);
                Assert.AreEqual(1, dialogue.PageCount, "13字で3行に収まる");

                // 立ち絵のない人（10字）: 尾なし・今の箱（1行の高さ）
                To("城の兵士");
                Assert.AreEqual("城の兵士", dialogue.CurrentLine.speaker);
                Assert.AreEqual(box1, dialogue.BubbleRect);
                Assert.IsNull(dialogue.TailNow.edge);

                // 4行は2ページ
                To("アルシェ");
                Assert.AreEqual("一行目。\n二行目。\n三行目。\n四行目。", dialogue.CurrentLine.text);
                Assert.AreEqual(2, dialogue.PageCount);
            }
            finally { dialogue.Close(); }
        }
    }
}
