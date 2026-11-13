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

        [UnityTest]
        public IEnumerator SupportSelectOpensFromTheDialAndGoesBack()
        {
            GameSettings.ResetForTest();
            Hub2Menu.ResetMilestones();
            Hub2Menu.Unlocks.Reset();
            SupportSelectView.ResetStatics();
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            var explore = Object.FindFirstObjectByType<Explore2DController>();
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            explore.EnterPlace("orcus_castle", "orcus_room_arshe_karima");
            yield return null;
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;
            var menu = Hub2Menu.Attach();
            yield return null;
            Assert.IsTrue(menu.RequestOpen());
            menu.Skip();
            yield return null;

            // 太陽盤の「支援会話」（解放の前でも、開発中の切り替えで開く）
            Assert.IsTrue(SupportSelectView.OpenBeforeUnlock);
            // 回る太陽盤: 押すと「支援会話」が針の先へ回ってきて、回り終わってから開く
            SunDialView.ResetState();
            Assert.AreEqual("出撃", SunDialView.SelectedLabel);
            GameObject.Find("Cmd_支援会話").GetComponent<UnityEngine.UI.Button>().onClick.Invoke();
            yield return null;
            Assert.AreEqual("支援会話", SunDialView.SelectedLabel);
            Assert.IsFalse(SupportSelectView.IsOpen, "回り終わる前に開いてしまう");
            float until = Time.realtimeSinceStartup + 3f;   // ばねが止まるまで（時間で待つ。バッチではコマがとても速い）
            while (!SupportSelectView.IsOpen && Time.realtimeSinceStartup < until) yield return null;
            Assert.IsTrue(SupportSelectView.IsOpen, "支援会話の相手選びが開かない");
            Assert.IsTrue(SunDialView.Settled);
            yield return null;
            Assert.IsFalse(GameObject.Find("Hub2Canvas").transform.Find("Menu").gameObject.activeSelf, "拠点メニューの中身が重なって見える");
            Assert.IsTrue(Hub2Menu.Blocking, "探索が動いてしまう");
            var view = SupportSelectView.Instance;
            Assert.AreEqual(0, view.Selected);
            Assert.IsFalse(view.Compact);

            // 仲間を選ぶ・簡易に切り替える
            view.Select("albus");
            Assert.AreEqual(1, view.Selected);
            view.SetCompact(true);
            Assert.IsTrue(view.Compact);

            // 会話する → 暗転の間は戻れない → 支援会話（台本がある組）→ 会話を閉じるとこの画面に戻る
            view.Select("arshe");
            view.Talk("albus");
            Assert.IsTrue(view.Veiled);
            view.Back();
            Assert.IsTrue(SupportSelectView.IsOpen || SupportSelectView.Talking, "暗転の途中で戻ってしまう");
            yield return new WaitForSecondsRealtime(2.1f);
            Assert.IsFalse(view.Veiled);
            Assert.IsTrue(SupportSelectView.Talking, "台本のある組なのに支援会話にならない");
            Object.FindFirstObjectByType<DialogueView>().Close();
            yield return null;
            Assert.IsFalse(SupportSelectView.Talking);
            Assert.IsTrue(SupportSelectView.IsOpen);

            // 話せない相手には会話しない
            view.Talk("philo");
            Assert.IsFalse(view.Veiled);

            // BACK → 拠点メニュー（メニューは開いたまま）
            view.Back();
            yield return null;
            Assert.IsFalse(SupportSelectView.IsOpen);
            Assert.AreEqual(Hub2Motion.State.Open, menu.State);
            Assert.IsTrue(GameObject.Find("Hub2Canvas").transform.Find("Menu").gameObject.activeSelf);

            // 開き直すと「詳細」・先頭の人から
            SupportSelectView.Open();
            Assert.IsFalse(SupportSelectView.Instance.Compact);
            Assert.AreEqual(0, SupportSelectView.Instance.Selected);
            SupportSelectView.Instance.Back();
            yield return null;

            // 相手選びの画面で太陽盤をほかの札へ回すと、拠点メニューへ戻る（原作者 2026-11-13）
            SupportSelectView.Open();
            yield return null;
            Assert.IsTrue(SupportSelectView.IsOpen);
            var dial = SupportSelectView.Instance.GetComponentInChildren<SunDialView>();
            dial.Select(SunDialMath.IndexOf("セーブ"), false);
            yield return null;
            yield return null;
            Assert.IsFalse(SupportSelectView.IsOpen, "太陽盤を回しても相手選びが閉じない");
            Assert.AreEqual(Hub2Motion.State.Open, menu.State);
            Assert.IsTrue(GameObject.Find("Hub2Canvas").transform.Find("Menu").gameObject.activeSelf);
            Assert.AreEqual("セーブ", SunDialView.SelectedLabel);

            // 何もない所を押しても、太陽盤の札でない所を押しても戻る（原作者 2026-11-13）
            SupportSelectView.Open();
            yield return null;
            var blank = System.Array.Find(SupportSelectView.Instance.GetComponentsInChildren<UnityEngine.UI.Button>(), x => x.name == "Blocker");
            blank.onClick.Invoke();
            yield return null;
            Assert.IsFalse(SupportSelectView.IsOpen, "何もない所を押しても戻らない");
            SupportSelectView.Open();
            yield return null;
            SupportSelectView.Instance.GetComponentInChildren<SunDialView>().OnPointerClick(new UnityEngine.EventSystems.PointerEventData(UnityEngine.EventSystems.EventSystem.current));
            yield return null;
            Assert.IsFalse(SupportSelectView.IsOpen, "太陽盤の札でない所を押しても戻らない");
            Assert.IsNull(SunDialView.SelectedLabel, "戻ったのに、針が札に残っている");

            // 拠点メニューでも、何もない所を押したら札を外す（試作の太陽盤と同じ）
            yield return null;
            var hub = GameObject.Find("Hub2Canvas").transform;
            dial = hub.GetComponentInChildren<SunDialView>();
            Assert.IsNotNull(dial, "拠点メニューの太陽盤が出ていない");
            dial.Select(SunDialMath.IndexOf("出撃"), false);
            Assert.AreEqual("出撃", SunDialView.SelectedLabel);
            hub.Find("Menu").GetComponent<UnityEngine.UI.Button>().onClick.Invoke();
            Assert.IsNull(SunDialView.SelectedLabel, "何もない所を押しても札が外れない");
        }
    }
}
