using System.Collections;
using System.IO;
using NUnit.Framework;
using Srpg.Battle;
using Srpg.Battle.Menu;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>
    /// タイトル画面（2026-11-13）: セーブなしは「はじめから」が選ばれ、「続きから」は押せない／はじめからは空いている枠へ（演出のあと）／
    /// セーブありは「続きから」が選ばれ、いちばん最近のセーブへ／状態はいちばん最近のセーブの進み具合
    /// </summary>
    public class TitlePlayTests
    {
        private SaveStore.IBackend before;
        private string dir;

        [SetUp]
        public void SetUp()
        {
            dir = Path.Combine(Path.GetTempPath(), "srpg_title_test");
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
            before = SaveStore.Backend;
            SaveStore.Backend = new SaveStore.FileBackend(dir);
            TitleScreen.StageOverride = -1;
        }

        [TearDown]
        public void TearDown()
        {
            if (TitleScreen.Instance != null) Object.Destroy(TitleScreen.Instance.gameObject);
            SaveStore.Backend = before;
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }

        [UnityTest]
        public IEnumerator NewGameAndContinue()
        {
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            int newSlot = -1, contSlot = -1;
            var acts = new TitleScreen.Actions { newGame = s => newSlot = s, continueAt = s => contSlot = s };

            // セーブなし
            var t = TitleScreen.Open(acts);
            Assert.AreEqual(TitleScreen.Phase.Tap, t.Current);
            Assert.IsFalse(t.HasSave);
            Assert.AreEqual(1, t.Selected, "セーブが無いのに「はじめから」が選ばれていない");
            Assert.AreEqual(GameProgress.BeforeClear, t.Stage);
            t.SetPhase(TitleScreen.Phase.Menu);
            t.Run(0);   // 続きから（押せない）
            Assert.AreEqual(TitleScreen.Phase.Menu, t.Current);
            t.Run(1);   // はじめから → 空いている枠（1）へ、演出のあと
            Assert.AreEqual(TitleScreen.Phase.Effect, t.Current);
            Assert.AreEqual(-1, newSlot, "演出の前に始まってしまう");
            yield return new WaitForSecondsRealtime(5.5f);
            Assert.AreEqual(1, newSlot);

            // セーブあり（いちばん最近は 4。サタン撃破後）
            SaveStore.Save(2, new SaveData { scene = "Corridor2D", placeName = "A", savedAt = "2026-11-10 10:00", progress = 0 }, out _);
            SaveStore.Save(4, new SaveData { scene = "Corridor2D", placeName = "B", savedAt = "2026-11-12 23:40", progress = 1 }, out _);
            t = TitleScreen.Open(acts);
            Assert.IsTrue(t.HasSave);
            Assert.AreEqual(4, t.LatestSlot);
            Assert.AreEqual(0, t.Selected, "セーブがあるのに「続きから」が選ばれていない");
            Assert.AreEqual(GameProgress.AfterSatan, t.Stage);
            t.SetPhase(TitleScreen.Phase.Menu);
            t.Run(0);
            yield return new WaitForSecondsRealtime(4.1f);
            Assert.AreEqual(4, contSlot);
        }
    }
}
