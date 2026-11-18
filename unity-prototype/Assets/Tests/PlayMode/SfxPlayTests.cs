using System.Collections;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>効果音（2026-11-18）: 音のファイルが無ければ黙る・あれば鳴る・音量「なし」なら鳴らない・同じ音を続けて鳴らしすぎない</summary>
    public class SfxPlayTests
    {
        [UnityTest]
        public IEnumerator PlaysOnlyWhenThereIsASound()
        {
            GameSettings.ResetForTest();
            Sfx.ResetForTest();
            Sfx.Play("no_such_sound");
            Assert.AreEqual(0, Sfx.PlayedCount, "音の無い id で鳴った");

            Sfx.SetClipForTest("ui_tap", AudioClip.Create("beep", 4410, 1, 44100, false));
            Sfx.Play("ui_tap");
            Assert.AreEqual(1, Sfx.PlayedCount);
            Assert.AreEqual("ui_tap", Sfx.LastPlayed);
            Sfx.Play("ui_tap");   // すぐ続けては鳴らさない（cooldown）
            Assert.AreEqual(1, Sfx.PlayedCount);
            yield return new WaitForSecondsRealtime(0.1f);
            Sfx.Play("ui_tap");
            Assert.AreEqual(2, Sfx.PlayedCount);

            GameSettings.Current.soundVolume = 0;   // 設定の「効果音」なし
            yield return new WaitForSecondsRealtime(0.1f);
            Sfx.Play("ui_tap");
            Assert.AreEqual(2, Sfx.PlayedCount, "音量「なし」で鳴った");
            GameSettings.ResetForTest();
            Sfx.ResetForTest();
        }
    }
}
