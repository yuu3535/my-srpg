using System.Collections;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>
    /// ▶でセーブ → ロード（2026-10-08）: 2Dの探索で回廊へ出てセーブし、自室から始め直してロードすると、
    /// 同じ場所・同じ位置・同じ持ち物・流した会話のまま続く。会話の途中はセーブできない
    /// </summary>
    public class SaveLoadPlayTests
    {
        private string dir;
        private SaveStore.IBackend before;

        [SetUp]
        public void SetUp()
        {
            dir = Path.Combine(Path.GetTempPath(), "srpg_save_play_" + System.Guid.NewGuid().ToString("N"));
            before = SaveStore.Backend;
            SaveStore.Backend = new SaveStore.FileBackend(dir);
        }

        [TearDown]
        public void TearDown()
        {
            SaveStore.Backend = before;
            SaveMenu.Close();
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }

        [UnityTest]
        public IEnumerator SaveInTheCorridorThenLoadContinuesThere()
        {
            SceneManager.LoadScene(SaveSystem.Scene2D);
            yield return null;
            yield return null;
            var explore = Object.FindFirstObjectByType<Explore2DController>();
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            var view = Object.FindFirstObjectByType<Corridor2DView>();

            // 起きたときの会話の途中はセーブできない
            Assert.IsTrue(dialogue.IsPlaying, "起床の会話が流れる");
            Assert.IsFalse(SaveSystem.SaveTo(1, out var why), "会話の途中でセーブできてしまう");
            StringAssert.Contains("会話", why);

            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            explore.EnterPlace("orcus_castle", "orcus_room_arshe_karima");
            yield return null;
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;
            view.PlayerX = view.WalkMinX + 60f;   // 近づくと流れる会話のない所（扉の近く）
            float x = view.PlayerX;
            var seen = explore.Seen.ToList();
            Assert.IsTrue(SaveSystem.SaveTo(2, out var message), message);

            // 始め直す（自室から）→ ロード
            SceneManager.LoadScene(SaveSystem.Scene2D);
            yield return null;
            yield return null;
            Assert.AreEqual("orcus_room", Object.FindFirstObjectByType<Explore2DController>().Place, "始め直すと自室");
            Assert.IsTrue(SaveSystem.LoadFrom(2, out var loadMessage), loadMessage);
            yield return null;
            yield return null;
            explore = Object.FindFirstObjectByType<Explore2DController>();
            view = Object.FindFirstObjectByType<Corridor2DView>();
            dialogue = Object.FindFirstObjectByType<DialogueView>();
            Assert.AreEqual("orcus_castle", explore.Place, "セーブした場所で続かない");
            Assert.AreEqual(x, view.PlayerX, 0.5f, "セーブした位置に立っていない");
            CollectionAssert.IsSubsetOf(seen, explore.Seen.ToList(), "流した会話が戻っていない");
            Assert.IsFalse(dialogue.IsPlaying, "流した会話がもう一度流れた");
            Assert.IsFalse(SaveSystem.HasPending);
        }
    }
}
