using System.IO;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;

namespace Srpg.Tests
{
    /// <summary>シナリオのデータ（tools/import_scenario.py）と、会話劇の立ち位置の決め方</summary>
    public class ScenarioTests
    {
        private static ScenarioFile Load() =>
            JsonUtility.FromJson<ScenarioFile>(File.ReadAllText("Assets/Data/Scenario/prologue_1_1.json"));

        [Test]
        public void PrologueDataLoads()
        {
            var s = Load();
            Assert.AreEqual("prologue_1_1", s.id);
            Assert.IsNotNull(s.Block("prologue_1_1.b06"), "キャリーとの挨拶");
            Assert.AreEqual("キャリーとの挨拶", s.Block("prologue_1_1.b06").label);
            Assert.IsTrue(s.Block("prologue_1_1.b06").lines.Any(l => l.item == "ツノ"), "キャリーからツノを受け取る");
            var sword = s.Block("prologue_1_1.b02_r09");
            Assert.IsNotNull(sword, "剣立てを調べたときの行は別のブロック（--split 9）");
            Assert.AreEqual("黒陽の双剣", sword.lines.Single().item);
            Assert.IsFalse(s.Block("prologue_1_1.b02").lines.Any(l => l.row == 9), "起床のブロックには剣を見つける行を含めない");
            Assert.IsTrue(s.Block("prologue_1_1.b11").lines.Where(l => l.type == "memo").All(l => !s.Block("prologue_1_1.b11").Shown.Contains(l)),
                "制作メモの行は出さない");
            Assert.AreEqual("sidetrack", s.Block("prologue_1_1.b07").part, "井戸端会議は寄り道");
        }

        [Test]
        public void CastStandsOnTheirSides()
        {
            var stage = new DialogueCast.Stage();
            stage.Speak("キャリー");
            stage.Speak("アルシェ");
            CollectionAssert.AreEqual(new[] { "アルシェ" }, stage.left, "アルシェは左（主人公の側）");
            CollectionAssert.AreEqual(new[] { "キャリー" }, stage.right, "相手は右");
            stage.Speak("カリマ");
            stage.Speak("ギュンター");
            stage.Speak("モブ１");
            Assert.AreEqual(2, stage.right.Count, "片側2人まで");
            CollectionAssert.Contains(stage.right, "モブ１");
            CollectionAssert.DoesNotContain(stage.right, "キャリー", "いちばん前に話した人と入れ替わる");
            stage.Speak(null);
            Assert.IsNull(stage.Speaker, "場面説明のあいだは話している人なし");
            Assert.AreEqual(2, stage.left.Count, "場面説明では舞台の人は変わらない");
        }

        [Test]
        public void CastEntersBeforeSpeaking()
        {
            var stage = new DialogueCast.Stage();
            stage.Enter(new[] { "キャリー", "アルシェ", "キャリー", "カリマ" });
            CollectionAssert.AreEqual(new[] { "アルシェ", "カリマ" }, stage.left, "話す前から左に立つ");
            CollectionAssert.AreEqual(new[] { "キャリー" }, stage.right, "同じ人は1回だけ");
            Assert.IsNull(stage.Speaker, "立てただけでは誰も話していない");
            stage.Speak("キャリー");
            Assert.AreEqual(1, stage.right.Count, "立っている人が話しても増えない");
        }
    }
}
