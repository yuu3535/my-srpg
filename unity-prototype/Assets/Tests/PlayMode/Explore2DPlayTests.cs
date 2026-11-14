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
            // 会話の枠を押すと、会話の枠が受ける（探索の画面の部品が手前で受けてしまい、進まなかった。2026-11-14）
            yield return null;   // 会話の枠が画面に出てから
            var es = UnityEngine.EventSystems.EventSystem.current;
            var hits = new System.Collections.Generic.List<UnityEngine.EventSystems.RaycastResult>();
            es.RaycastAll(new UnityEngine.EventSystems.PointerEventData(es) { position = new Vector2(Screen.width / 2f, Screen.height / 2f) }, hits);
            Assert.IsTrue(hits.Count > 0 && hits[0].gameObject.GetComponentInParent<Canvas>().rootCanvas.name == "Dialogue",
                "会話の枠より手前で押すのを受けている: " + (hits.Count > 0 ? hits[0].gameObject.GetComponentInParent<Canvas>().rootCanvas.name : "なし"));
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

            // 床の何もない所を押すと、そこへ歩く（部屋の座標。仕様書 §3.1 の ⑤）
            explore.TapWorld(new Vector2(2000f, 760f));
            for (float t = 0f; t < 4f && Mathf.Abs(view.PlayerX - 1000f) > 1f; t += Time.unscaledDeltaTime) yield return null;
            Assert.AreEqual(1000f, view.PlayerX, 1f, "押した所へ歩かない");

            // 収納箱を押すと、歩いて選ぶ（札が出る）→ もう一度押すと調べて、双剣を手に入れる
            var chest = explore.Targets.First(t => t.target.id == "find_sword");
            Assert.AreEqual(ExploreHit.Kind.Item, chest.target.kind, "収納箱は拾得物（光る）");
            explore.TapWorld(chest.target.hit.center);
            for (float t = 0f; t < 6f && explore.SelectedId != "find_sword"; t += Time.unscaledDeltaTime) yield return null;
            Assert.AreEqual("find_sword", explore.SelectedId, "歩いて収納箱を選んでいない");
            Assert.IsFalse(dialogue.IsPlaying, "選んだだけで調べてしまう");
            explore.TapWorld(chest.target.hit.center);
            for (float t = 0f; t < 2f && !dialogue.IsPlaying; t += Time.unscaledDeltaTime) yield return null;
            Assert.IsTrue(dialogue.IsPlaying, "選んだ物をもう一度押しても調べない");
            for (int i = 0; i < 20 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;
            Assert.IsTrue(explore.Items.Contains("黒陽の双剣"), "双剣を手に入れていない");
            Assert.AreEqual(ExploreHit.Kind.Tips, explore.Targets.First(t => t.target.id == "find_sword").target.kind, "取ったあとは光らない");

            // 出口の範囲を押すと、端まで歩いて廊下へ出る（押して開く札は出さない）
            explore.TapWorld(new Vector2(3100f, 450f));
            for (float t = 0f; t < 15f && explore.Place != "orcus_castle"; t += Time.unscaledDeltaTime) yield return null;
            Assert.AreEqual("orcus_castle", explore.Place, "部屋から回廊へ出られない");
        }

        [UnityTest]
        public IEnumerator StairsLeadToTheTrainingYardBoard()
        {
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var view = Object.FindFirstObjectByType<Corridor2DView>();
            var explore = Object.FindFirstObjectByType<Explore2DController>();
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            for (int i = 0; i < 20 && dialogue.IsPlaying; i++) dialogue.Close();
            explore.EnterPlace("orcus_castle", null);
            yield return null;
            // キャリーとヘンリーに会ったことにする（階段の条件）
            explore.PlayBlocks(new System.Collections.Generic.List<string> { "prologue_1_1.b06", "prologue_1_1.b08" }, null);
            for (int i = 0; i < 40 && dialogue.IsPlaying; i++) dialogue.Close();
            yield return null;
            view.PlayerX = explore.SpotX("to_yard") - 20f;
            explore.TapWorld(explore.Targets.First(t => t.target.id == "to_yard").target.point);   // 途中の扉: 案内の所を押すと歩いて出る
            for (float t = 0f; t < 8f && SceneManager.GetActiveScene().name != "Explore3D"; t += Time.unscaledDeltaTime) yield return null;
            Assert.AreEqual("Explore3D", SceneManager.GetActiveScene().name, "階段から戦闘の場所（Explore3D）へ移らない");
            yield return null;
            yield return null;
            var board = Object.FindFirstObjectByType<ExploreController>();
            Assert.IsNotNull(board?.Place, "Explore3D の探索が始まらない");
            Assert.AreEqual("orcus_training_yard", board.Place.mapId, "訓練場から始まらない");
            Assert.IsTrue(board.Seen.Contains("prologue_1_1.b08"), "回廊で流した会話が引き継がれない");
        }

        [UnityTest]
        public IEnumerator AfterTrainingBackToTheRoom()
        {
            // 訓練のあと（3Dの盤面）から2Dの自室へ戻る形: 御伽噺を調べる場面、カリマがいる、持ち物を引き継ぐ
            ExploreHandoff.SetTo2D("orcus_room", "prologue_1_2_fairytale", new[] { "prologue_1_1.b12" }, new[] { "黒陽の双剣" });
            SceneManager.LoadScene("Corridor2D");
            yield return null;
            yield return null;
            var explore = Object.FindFirstObjectByType<Explore2DController>();
            Assert.AreEqual("orcus_room", explore.Place);
            Assert.AreEqual("prologue_1_2_fairytale", explore.State?.id, "御伽噺の場面から始まらない");
            Assert.IsNotNull(GameObject.Find("Person_young_karima"), "カリマがいない");
            Assert.IsTrue(explore.Items.Contains("黒陽の双剣"), "持ち物が引き継がれない");
            Assert.IsFalse(float.IsNaN(explore.SpotX("fairytale_book")), "御伽噺の本（カリマの本棚）を調べられない");
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
