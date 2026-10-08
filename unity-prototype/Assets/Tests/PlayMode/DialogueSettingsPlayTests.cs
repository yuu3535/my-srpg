using System.Collections;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>▶で会話の設定（2026-10-09）: 文字を少しずつ出す → 押すと全部出る → もう一度で次へ。スキップは既読を飛ばし、未読で止まる</summary>
    public class DialogueSettingsPlayTests
    {
        [TearDown]
        public void TearDown()
        {
            DialogueView.InstantInBatch = true;
            GameSettings.ResetForTest();
        }

        [UnityTest]
        public IEnumerator RevealThenSkipStopsAtUnread()
        {
            GameSettings.ResetForTest();
            GameSettings.Current.textSpeed = 0;   // 遅い
            DialogueView.InstantInBatch = false;
            SceneManager.LoadScene(SaveSystem.Scene2D);
            yield return null;
            yield return null;
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            // 5行以上ある会話（プロローグ1-1）を流す
            var file = JsonUtility.FromJson<ScenarioFile>(System.IO.File.ReadAllText(System.IO.Path.Combine(Application.dataPath, "Data/Scenario/prologue_1_1.json")));
            var block = System.Linq.Enumerable.First(file.blocks, b => System.Linq.Enumerable.Count(b.Shown) >= 5);
            dialogue.Play(block);

            // 文字を少しずつ出す: 次の行へ進めた直前は途中まで → 押すと全部 → もう一度で次の行
            dialogue.Advance();
            if (dialogue.Revealing) dialogue.Advance();
            int line = dialogue.LineIndex;
            dialogue.Advance();
            Assert.AreEqual(line + 1, dialogue.LineIndex);
            Assert.IsTrue(dialogue.Revealing, "文字を少しずつ出していない");
            Assert.Less(dialogue.ShownText.Length, dialogue.CurrentLine.text.Length);
            dialogue.Advance();
            Assert.IsFalse(dialogue.Revealing, "押すと全部出る");
            Assert.AreEqual(line + 1, dialogue.LineIndex, "全部出すときは次へ進まない");
            int lastRead = dialogue.LineIndex;

            // もう一度同じ会話: スキップは既読を飛ばし、初めての行で止まる
            dialogue.Close();
            dialogue.Play(block);
            dialogue.Skip = true;
            for (float t = 0f; t < 3f && dialogue.Skip && dialogue.IsPlaying; t += Time.unscaledDeltaTime) yield return null;
            Assert.IsTrue(dialogue.IsPlaying, "未読の前で止まらずに会話が終わった");
            Assert.IsFalse(dialogue.Skip, "未読でスキップが止まらない");
            Assert.AreEqual(lastRead + 1, dialogue.LineIndex, "初めての行で止まる");
            Assert.IsFalse(dialogue.CurrentWasRead);
        }
    }
}
