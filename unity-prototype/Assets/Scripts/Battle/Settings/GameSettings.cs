using System;
using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 環境設定（2026-10-09）。セーブの枠とは別に、端末に1つだけ持つ（どのセーブで遊んでも同じ）。
    /// 保存先はブラウザ・PC とも PlayerPrefs（WebGL ではブラウザの保存）。画面に触れない。
    /// 読んだ台詞の記録（既読）もここ。既読はセーブの枠に関係なく、一度読んだら既読
    /// </summary>
    public static class GameSettings
    {
        [Serializable]
        public class Values
        {
            public int textSpeed = 2;     // 文字の速さ 0 遅い / 1 ふつう / 2 速い / 3 すぐ
            public int autoSpeed = 1;     // オートの速さ 0 ゆっくり / 1 ふつう / 2 速い
            public bool skipUnread;       // スキップで未読も飛ばす（ふだんは既読だけ）
            public int moveSpeed = 1;     // 探索の歩く速さ 0 ゆっくり / 1 ふつう / 2 速い
            public int musicVolume = 3;   // 音楽 0〜4（音はまだ入っていない。入れたらこの値を使う）
            public int soundVolume = 3;   // 効果音 0〜4
        }

        public static readonly string[] TextSpeedNames = { "遅い", "ふつう", "速い", "すぐ" };
        public static readonly string[] AutoSpeedNames = { "ゆっくり", "ふつう", "速い" };
        public static readonly string[] MoveSpeedNames = { "ゆっくり", "ふつう", "速い" };
        public static readonly string[] VolumeNames = { "なし", "小", "中", "大", "最大" };

        private const string Key = "settings_v1", ReadKey = "read_lines_v1";
        private static Values current;
        private static HashSet<string> read;
        private static bool readDirty;

        public static Values Current => current ??= Load();

        /// <summary>1秒に出す文字の数（すぐ＝0: 一度に出す）</summary>
        public static float CharsPerSecond => Current.textSpeed switch { 0 => 18f, 1 => 32f, 2 => 60f, _ => 0f };

        /// <summary>オートで次へ進むまでの時間（文字を出し終えてから）</summary>
        public static float AutoDelay(int length)
        {
            float k = Current.autoSpeed switch { 0 => 1.5f, 2 => 0.6f, _ => 1f };
            return (0.9f + 0.05f * Mathf.Min(length, 60)) * k;
        }

        /// <summary>探索の歩く速さの倍率</summary>
        public static float MoveMultiplier => Current.moveSpeed switch { 0 => 0.75f, 2 => 1.5f, _ => 1f };

        public static float MusicVolume01 => Mathf.Clamp(Current.musicVolume, 0, 4) / 4f;
        public static float SoundVolume01 => Mathf.Clamp(Current.soundVolume, 0, 4) / 4f;

        private static Values Load()
        {
            try
            {
                var json = PlayerPrefs.GetString(Key, "");
                var v = string.IsNullOrEmpty(json) ? null : JsonUtility.FromJson<Values>(json);
                return Sanitize(v ?? new Values());
            }
            catch (Exception) { return new Values(); }
        }

        private static Values Sanitize(Values v)
        {
            v.textSpeed = Mathf.Clamp(v.textSpeed, 0, 3);
            v.autoSpeed = Mathf.Clamp(v.autoSpeed, 0, 2);
            v.moveSpeed = Mathf.Clamp(v.moveSpeed, 0, 2);
            v.musicVolume = Mathf.Clamp(v.musicVolume, 0, 4);
            v.soundVolume = Mathf.Clamp(v.soundVolume, 0, 4);
            return v;
        }

        public static void Save()
        {
            Sanitize(Current);
            try { PlayerPrefs.SetString(Key, JsonUtility.ToJson(Current)); PlayerPrefs.Save(); }
            catch (Exception e) { Debug.LogWarning("[Settings] 保存できなかった: " + e.Message); }
        }

        /// <summary>初めの値に戻す（既読はそのまま）</summary>
        public static void ResetToDefaults() { current = new Values(); Save(); }

        // ── 既読 ──

        private static HashSet<string> Read
        {
            get
            {
                if (read != null) return read;
                read = new HashSet<string>();
                try
                {
                    foreach (var k in PlayerPrefs.GetString(ReadKey, "").Split('\n'))
                        if (!string.IsNullOrEmpty(k)) read.Add(k);
                }
                catch (Exception) { }
                return read;
            }
        }

        public static string LineKey(string blockId, int index) => $"{blockId}#{index}";
        public static bool IsRead(string key) => !string.IsNullOrEmpty(key) && Read.Contains(key);
        public static void MarkRead(string key) { if (!string.IsNullOrEmpty(key) && Read.Add(key)) readDirty = true; }

        /// <summary>既読を書き出す（会話を閉じたとき）</summary>
        public static void FlushRead()
        {
            if (!readDirty) return;
            readDirty = false;
            try { PlayerPrefs.SetString(ReadKey, string.Join("\n", Read)); PlayerPrefs.Save(); }
            catch (Exception e) { Debug.LogWarning("[Settings] 既読を保存できなかった: " + e.Message); }
        }

        /// <summary>テスト用: 値と既読を記憶から読み直さず、空から始める</summary>
        public static void ResetForTest() { current = new Values(); read = new HashSet<string>(); readDirty = false; }
    }
}
