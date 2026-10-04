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
            // 自室で起きて始まる → 回廊へ移ってから確かめる
            Assert.AreEqual("orcus_room", explore.Place, "自室で始まらない");
            for (int i = 0; i < 20 && dialogue.IsPlaying; i++) dialogue.Close();
            explore.EnterPlace("orcus_castle", "orcus_room_arshe_karima");
            yield return null;
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

        [UnityTest]
        public IEnumerator TapToFindTheSwordAndLeaveTheRoom()
        {
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var view = Object.FindFirstObjectByType<Corridor2DView>();
            var explore = Object.FindFirstObjectByType<Explore2DController>();
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            Assert.AreEqual("orcus_room", explore.Place);
            for (int i = 0; i < 20 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;

            // 床の何もない所を押すと、そこへ歩く（手前の高さも）
            float target = view.PlayerX + 120f;
            view.OnTap(target, 380f);
            for (float t = 0f; t < 3f && Mathf.Abs(view.PlayerX - target) > 1f; t += Time.unscaledDeltaTime) yield return null;
            Assert.AreEqual(target, view.PlayerX, 1f, "押した所へ歩かない");

            // 剣立てを押すと、歩いて調べて双剣を手に入れる
            view.OnTap(explore.SpotX("find_sword"), 360f);
            for (float t = 0f; t < 4f && !dialogue.IsPlaying; t += Time.unscaledDeltaTime) yield return null;
            Assert.IsTrue(dialogue.IsPlaying, "剣立てを調べる会話が始まらない");
            for (int i = 0; i < 20 && dialogue.IsPlaying; i++) dialogue.Close();
            Assert.IsTrue(explore.Items.Contains("黒陽の双剣"), "双剣を手に入れていない");

            // 扉を押すと、回廊へ出る
            view.OnTap(explore.SpotX("to_corridor"), 360f);
            for (float t = 0f; t < 5f && explore.Place != "orcus_castle"; t += Time.unscaledDeltaTime) yield return null;
            Assert.AreEqual("orcus_castle", explore.Place, "部屋から回廊へ出られない");
        }

        [UnityTest]
        public IEnumerator LookTunerRebuildsAndKeepsPeople()
        {
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var view = Object.FindFirstObjectByType<Corridor2DView>();
            var ex2 = Object.FindFirstObjectByType<Explore2DController>();
            var dlg = Object.FindFirstObjectByType<DialogueView>();
            for (int i = 0; i < 20 && dlg.IsPlaying; i++) dlg.Close();
            ex2.EnterPlace("orcus_castle", null);
            yield return null;
            Assert.AreEqual("orcus_castle_morning", view.LookName, "回廊はふだん朝の見え方");
            float x = view.PlayerX;

            // 調整画面を開いて、つまみを1つ動かす → 組み立て直しても、人とアルシェの位置が残る
            view.OpenTuner();
            Assert.IsTrue(view.TunerOpen, "調整画面が開かない");
            var slider = Object.FindObjectsByType<UnityEngine.UI.Slider>(FindObjectsSortMode.None).First(s => s.name == "Slider_ヴィネット");
            slider.value = 0.9f;
            for (float t = 0f; t < 0.6f; t += Time.unscaledDeltaTime) yield return null;
            Assert.IsNotNull(GameObject.Find("Person_carrie"), "組み立て直したらキャリーが消えた");
            Assert.AreEqual(x, view.PlayerX, 0.01f, "アルシェの位置が変わった");

            // 見え方を切り替える（夕方の仮の見え方）
            Assert.IsTrue(view.SetLook("orcus_castle_dusk"), "夕方の見え方に切り替わらない");
            yield return null;
            Assert.AreEqual("orcus_castle_dusk", view.LookName);
            Assert.IsNotNull(GameObject.Find("Person_carrie"), "切り替えたらキャリーが消えた");
        }
    }
}
