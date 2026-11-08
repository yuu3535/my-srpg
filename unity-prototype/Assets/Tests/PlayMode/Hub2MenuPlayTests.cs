using System.Collections;
using NUnit.Framework;
using Srpg.Battle;
using Srpg.Battle.Menu;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>
    /// ▶で拠点メニュー Hub2 を開け閉めする（2026-11-09）: 会話の途中は開けない／開くと探索は止まる／
    /// 起動して最初は長い版・2回目は短い版／演出中に押せば飛ばせる／閉じたら探索へ戻る
    /// </summary>
    public class Hub2MenuPlayTests
    {
        [TearDown]
        public void TearDown()
        {
            if (Hub2Menu.Instance != null) Object.Destroy(Hub2Menu.Instance.gameObject);
            SettingsMenu.Close();
            SaveMenu.Close();
            GameSettings.ResetForTest();
        }

        [UnityTest]
        public IEnumerator OpenSkipAndCloseOverTheCorridor()
        {
            GameSettings.ResetForTest();
            Hub2Menu.ResetMilestones();   // ほかのテスト（戦闘から戻る）が残した節目を消す
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            var explore = Object.FindFirstObjectByType<Explore2DController>();
            var menu = Hub2Menu.Attach();
            yield return null;

            // 起きたときの会話の途中は開けない（イベントの場面）
            Assert.IsTrue(dialogue.IsPlaying);
            Assert.IsFalse(menu.CanOpen, "会話の途中で開けてしまう");
            Assert.IsFalse(menu.RequestOpen());

            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            explore.EnterPlace("orcus_castle", "orcus_room_arshe_karima");
            yield return null;
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;
            Assert.IsTrue(menu.CanOpen, "会話のあとで開けない");

            // 起動して最初は長い版。演出中は探索が止まる。押せば飛ばせる
            Assert.IsTrue(menu.RequestOpen());
            Assert.AreEqual(Hub2Motion.Length.Long, menu.CurrentLength);
            Assert.AreEqual(Hub2Motion.ReasonBoot, menu.LastOpenReason);
            Assert.AreEqual(Hub2Motion.State.Opening, menu.State);
            Assert.IsTrue(Hub2Menu.Blocking);
            Assert.IsTrue(menu.Skip());
            Assert.AreEqual(Hub2Motion.State.Open, menu.State);
            Assert.IsTrue(GameObject.Find("Menu").activeInHierarchy, "開いたのにメニューが見えない");

            // 閉じる（短い版 0.62秒）
            Assert.IsTrue(menu.RequestClose());
            yield return new WaitForSecondsRealtime(0.9f);
            Assert.AreEqual(Hub2Motion.State.Closed, menu.State, "閉じ終わらない");
            Assert.IsFalse(Hub2Menu.Blocking);

            // 同じ日の2回目は短い版。最後まで流れて開ききる
            Assert.IsTrue(menu.RequestOpen());
            Assert.AreEqual(Hub2Motion.Length.Short, menu.CurrentLength);
            yield return new WaitForSecondsRealtime(1.1f);
            Assert.AreEqual(Hub2Motion.State.Open, menu.State, "開き終わらない");

            // 物語の戦闘に勝ったあとは長い版
            Assert.IsTrue(menu.Skip() == false);
            menu.RequestClose();
            menu.Skip();
            Hub2Menu.MarkMilestone(Hub2Motion.ReasonBattle);
            Assert.IsTrue(menu.RequestOpen());
            Assert.AreEqual(Hub2Motion.Length.Long, menu.CurrentLength);
            Assert.AreEqual(Hub2Motion.ReasonBattle, menu.LastOpenReason);
            menu.Skip();

            // 設定「なし」は0.15秒のフェード
            GameSettings.Current.menuEffect = 2;
            menu.RequestClose();
            yield return new WaitForSecondsRealtime(0.3f);
            Assert.AreEqual(Hub2Motion.State.Closed, menu.State);
        }
    }
}
