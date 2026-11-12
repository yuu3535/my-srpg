using System.Collections;
using NUnit.Framework;
using Srpg.Battle;
using Srpg.Battle.Menu;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>支援会話（2026-11-13）: 相手選びの「会話する」→ 暗転 → 支援会話 → CLOSE で相手選びに戻り、そのランクを見たことになる</summary>
    public class SupportTalkPlayTests
    {
        [TearDown]
        public void TearDown()
        {
            if (Hub2Menu.Instance != null) Object.Destroy(Hub2Menu.Instance.gameObject);
            GameSettings.ResetForTest();
        }

        [UnityTest]
        public IEnumerator TalkFromSelectAndComeBack()
        {
            GameSettings.ResetForTest();
            Hub2Menu.ResetMilestones();
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
            var menu = Hub2Menu.Attach();
            yield return null;
            menu.RequestOpen();
            menu.Skip();
            var view = SupportSelectView.Open();
            view.FinishIntro();
            var pair = SupportSelectView.Roster.PairOf("arshe", "albus");
            Assert.AreEqual(1, pair.rank);
            view.Talk("albus");
            float until = Time.realtimeSinceStartup + 4f;
            while (!SupportSelectView.Talking && Time.realtimeSinceStartup < until) yield return null;
            Assert.IsTrue(SupportSelectView.Talking, "支援会話が始まらない");
            Assert.IsTrue(dialogue.IsPlaying);
            Assert.IsTrue(dialogue.SupportMode);
            yield return null;
            Assert.IsFalse(GameObject.Find("Hub2Canvas").transform.Find("Menu").gameObject.activeSelf, "支援会話の後ろに拠点メニューが見える");
            until = Time.realtimeSinceStartup + 3f;
            while (SupportSelectView.IsOpen && Time.realtimeSinceStartup < until) yield return null;
            Assert.IsFalse(SupportSelectView.IsOpen, "会話の間、相手選びが閉じない");

            GameObject.Find("CLOSEStar").GetComponent<UnityEngine.UI.Button>().onClick.Invoke();
            yield return null;
            Assert.IsFalse(SupportSelectView.Talking);
            Assert.IsTrue(SupportSelectView.IsOpen, "相手選びに戻らない");
            Assert.AreEqual(2, pair.rank, "B を見たことになっていない");
            Assert.IsFalse(pair.Talkable);
            SupportSelectView.Instance.Back();
        }
    }
}
