using NUnit.Framework;
using Srpg.Battle;

namespace Srpg.Tests
{
    /// <summary>環境設定の値と既読（2026-10-09）。端末の保存（PlayerPrefs）には書かない</summary>
    public class GameSettingsTests
    {
        [SetUp]
        public void SetUp() => GameSettings.ResetForTest();

        [TearDown]
        public void TearDown() => GameSettings.ResetForTest();

        [Test]
        public void DefaultsAndSpeeds()
        {
            var v = GameSettings.Current;
            Assert.AreEqual(2, v.textSpeed, "初めは「速い」");
            Assert.IsFalse(v.skipUnread, "スキップは既読だけ");
            v.textSpeed = 3;
            Assert.AreEqual(0f, GameSettings.CharsPerSecond, "「すぐ」は一度に出す");
            v.textSpeed = 0;
            Assert.Greater(GameSettings.CharsPerSecond, 0f);
            v.autoSpeed = 0; float slow = GameSettings.AutoDelay(20);
            v.autoSpeed = 2; float fast = GameSettings.AutoDelay(20);
            Assert.Greater(slow, fast);
            Assert.Greater(GameSettings.AutoDelay(40), GameSettings.AutoDelay(5), "長い台詞ほど長く待つ");
            v.moveSpeed = 2;
            Assert.Greater(GameSettings.MoveMultiplier, 1f);
        }

        [Test]
        public void LinesBecomeRead()
        {
            string key = GameSettings.LineKey("prologue_1_1.b01", 2);
            Assert.IsFalse(GameSettings.IsRead(key));
            GameSettings.MarkRead(key);
            Assert.IsTrue(GameSettings.IsRead(key));
            Assert.IsFalse(GameSettings.IsRead(GameSettings.LineKey("prologue_1_1.b01", 3)));
        }
    }
}
