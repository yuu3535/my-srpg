using NUnit.Framework;
using Srpg.Battle;

namespace Srpg.Tests
{
    /// <summary>タイトル画面がセーブから読む物（2026-11-13）</summary>
    public class TitleSavesTests
    {
        private static SaveStore.Slot S(int i, string at, int progress = 0) => new SaveStore.Slot { index = i, state = SaveStore.SlotState.Ok, data = new SaveData { scene = "Corridor2D", savedAt = at, progress = progress, placeName = "オルクス城・回廊", playSeconds = 192 * 60 } };
        private static SaveStore.Slot E(int i) => new SaveStore.Slot { index = i, state = SaveStore.SlotState.Empty };

        [Test]
        public void LatestAndFirstEmpty()
        {
            var slots = new[] { S(1, "2026-11-10 10:00"), E(2), S(3, "2026-11-12 23:40", 2), E(4) };
            Assert.AreEqual(3, TitleSaves.Latest(slots));
            Assert.AreEqual(2, TitleSaves.FirstEmpty(slots));
            Assert.AreEqual(GameProgress.AfterEnding, TitleSaves.StageOf(slots[2].data));
            Assert.AreEqual(GameProgress.BeforeClear, TitleSaves.StageOf(null));
            Assert.AreEqual(0, TitleSaves.Latest(new[] { E(1) }));
        }

        [Test]
        public void InfoLineSaysPrologueForOldSaves()
        {
            var d = S(1, "2026-11-12 23:40").data;
            Assert.AreEqual("プロローグ　オルクス城・回廊　2026/11/12 23:40　プレイ時間 03:12", TitleSaves.InfoLine(d));
            d.chapter = "第1章";
            Assert.AreEqual("第1章", TitleSaves.ChapterText(d));
            Assert.AreEqual("セーブデータがありません。", TitleSaves.InfoLine(null));
            // 版2のセーブを読むと、章はプロローグ
            var json = "{\"version\":2,\"scene\":\"Corridor2D\",\"placeName\":\"x\"}";
            Assert.AreEqual("プロローグ", SaveStore.FromJson(json).chapter);
        }
    }
}
