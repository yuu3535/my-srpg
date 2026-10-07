using System.IO;
using NUnit.Framework;
using Srpg.Battle;

namespace Srpg.Tests
{
    /// <summary>セーブの枠の読み書き（2026-10-08）。一時フォルダに書いて確かめる</summary>
    public class SaveStoreTests
    {
        private string dir;
        private SaveStore.IBackend before;

        [SetUp]
        public void SetUp()
        {
            dir = Path.Combine(Path.GetTempPath(), "srpg_save_test_" + System.Guid.NewGuid().ToString("N"));
            before = SaveStore.Backend;
            SaveStore.Backend = new SaveStore.FileBackend(dir);
        }

        [TearDown]
        public void TearDown()
        {
            SaveStore.Backend = before;
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }

        private static SaveData Sample() => new SaveData
        {
            savedAt = "2026-10-08 21:14",
            playSeconds = 3900f,
            scene = SaveSystem.Scene2D,
            place = "orcus_castle",
            placeName = "オルクス城廊下",
            playerX = 812.5f,
            seen = { "prologue_1_1.b01", "prologue_1_1.b06" },
            played = { "servants_chat" },
            items = { "黒陽の双剣", "ツノ" },
            states = { new SaveData.StateEntry { map = "orcus_training_yard", state = "after_training" } },
        };

        [Test]
        public void SaveThenLoadGivesTheSameProgress()
        {
            Assert.IsTrue(SaveStore.Save(3, Sample(), out var error), error);
            var d = SaveStore.Load(3);
            Assert.IsNotNull(d);
            Assert.AreEqual("orcus_castle", d.place);
            Assert.AreEqual(812.5f, d.playerX);
            CollectionAssert.AreEqual(new[] { "黒陽の双剣", "ツノ" }, d.items);
            CollectionAssert.AreEquivalent(new[] { "prologue_1_1.b01", "prologue_1_1.b06" }, d.seen);
            Assert.AreEqual("after_training", d.StateMap()["orcus_training_yard"]);
            Assert.AreEqual("1:05", d.PlayTimeText);
        }

        [Test]
        public void ListShowsEmptyFilledAndUnreadableSlots()
        {
            SaveStore.Save(1, Sample(), out _);
            File.WriteAllText(Path.Combine(dir, "slot_02.json"), "{ 壊れた");
            var list = SaveStore.List();
            Assert.AreEqual(SaveStore.SlotCount, list.Length);
            Assert.AreEqual(SaveStore.SlotState.Ok, list[0].state);
            Assert.AreEqual(SaveStore.SlotState.Unreadable, list[1].state);
            Assert.AreEqual(SaveStore.SlotState.Empty, list[2].state);
            Assert.IsNull(SaveStore.Load(2), "壊れた枠は読まない");
        }

        [Test]
        public void OverwriteKeepsOnlyTheNewSaveAndLeavesNoTempFile()
        {
            SaveStore.Save(5, Sample(), out _);
            var second = Sample();
            second.place = "orcus_room";
            Assert.IsTrue(SaveStore.Save(5, second, out _));
            Assert.AreEqual("orcus_room", SaveStore.Load(5).place);
            Assert.IsFalse(File.Exists(Path.Combine(dir, "slot_05.json.tmp")));
        }

        [Test]
        public void SaveFromANewerGameIsNotRead()
        {
            var newer = Sample();
            newer.version = SaveData.CurrentVersion + 1;
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, "slot_04.json"), UnityEngine.JsonUtility.ToJson(newer));
            Assert.IsNull(SaveStore.Load(4));
            Assert.AreEqual(SaveStore.SlotState.Unreadable, SaveStore.Peek(4).state);
        }

        [Test]
        public void SlotNumbersOutsideTheListAreRefused()
        {
            Assert.IsFalse(SaveStore.Save(0, Sample(), out _));
            Assert.IsFalse(SaveStore.Save(SaveStore.SlotCount + 1, Sample(), out _));
            Assert.IsNull(SaveStore.Load(0));
        }
    }
}
