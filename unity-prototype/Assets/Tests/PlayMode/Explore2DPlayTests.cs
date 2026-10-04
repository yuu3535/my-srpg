using System.Collections;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>
    /// ▶（Play）で2Dの回廊の探索を動かす（2026-10-04: 遊ぶと組み立てが2回走り、人が消えて毎フレームの更新が止まっていた。
    /// エディタで撮る確認の画像では起きないので、▶で確かめる）
    /// </summary>
    public class Explore2DPlayTests
    {
        [UnityTest]
        public IEnumerator WalkUpToCarrieStartsTheTalk()
        {
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;

            var view = Object.FindFirstObjectByType<Corridor2DView>();
            var explore = Object.FindFirstObjectByType<Explore2DController>();
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            Assert.IsNotNull(view, "Corridor2DView がない");
            Assert.IsNotNull(explore, "Explore2DController がない");
            Assert.IsNotNull(explore.State, "探索の場面が読めていない");
            Assert.IsNotNull(GameObject.Find("Hero"), "アルシェがいない");
            Assert.IsNotNull(GameObject.Find("Person_carrie"), "キャリーがいない");

            // キャリーの手前へ置くと、隣まで歩いてから会話が始まる
            float carrie = explore.PersonX("carrie");
            view.PlayerX = carrie - 90f;
            for (float t = 0f; t < 3f && !dialogue.IsPlaying; t += Time.unscaledDeltaTime) yield return null;   // 歩く時間（フレームの数でなく時間で待つ）
            Assert.IsTrue(dialogue.IsPlaying, "キャリーの近くで会話が始まらない");
            Assert.AreEqual("キャリー", dialogue.CurrentLine?.speaker);
            Assert.Less(Mathf.Abs(view.PlayerX - carrie), 80f, "キャリーの隣まで歩いていない");
            Assert.IsTrue(view.Locked, "会話の間は歩けない");

            dialogue.Close();
            yield return null;
            yield return null;
            Assert.IsFalse(view.Locked, "会話が終わったら歩ける");
            Assert.IsTrue(explore.Seen.Contains("prologue_1_1.b06"), "キャリーの会話を流した");
        }
    }
}
