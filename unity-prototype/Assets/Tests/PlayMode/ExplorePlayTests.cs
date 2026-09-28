using System.Collections;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>▶で探索: 自室で起きる → 会話を進める → 剣立てを押すと歩いて調べる（プロローグ1-1 計画の段4）</summary>
    public class ExplorePlayTests
    {
        [UnityTest]
        public IEnumerator WakeUpAndTakeTheSword()
        {
            SceneManager.LoadScene("Explore3D");
            yield return null;
            yield return null;
            var explore = Object.FindFirstObjectByType<ExploreController>();
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            Assert.IsNotNull(explore);
            Assert.AreEqual("orcus_room_arshe_karima", explore.Place.mapId, "自室から始まる");
            Assert.IsTrue(dialogue.IsPlaying, "起床の会話が流れる");
            for (int i = 0; i < 100 && dialogue.IsPlaying; i++) dialogue.Advance();
            Assert.IsFalse(dialogue.IsPlaying);

            var sword = explore.State.inspect.First(x => x.id == "find_sword").cells[0].V;
            var start = explore.Player;
            explore.Tap(sword);
            for (float t = 0; t < 5f && !dialogue.IsPlaying; t += Time.deltaTime) yield return null;
            Assert.AreNotEqual(start, explore.Player, "押したら歩いた");
            Assert.AreEqual(1, Mathf.Abs(explore.Player.x - sword.x) + Mathf.Abs(explore.Player.y - sword.y), "剣立ての隣まで歩いた");
            Assert.IsTrue(dialogue.IsPlaying, "調べると会話が流れる");
            for (int i = 0; i < 20 && dialogue.IsPlaying; i++) dialogue.Advance();
            CollectionAssert.Contains(explore.Items.ToList(), "黒陽の双剣", "剣を手に入れた");
        }
    }
}
