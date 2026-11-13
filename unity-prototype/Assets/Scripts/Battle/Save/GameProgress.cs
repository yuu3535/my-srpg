using System;
using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 物語の進み具合（2026-11-13）。章の名前と、タイトル画面の3つの状態（クリア前／サタン撃破後／終幕後）。
    /// セーブに入れ（SaveSystem.Stamp）、読んだら戻す（SaveSystem.LoadFrom）。章が進んだら Chapter を変える
    /// </summary>
    public static class GameProgress
    {
        public const string Prologue = "プロローグ";
        public const int BeforeClear = 0, AfterSatan = 1, AfterEnding = 2;

        public static string Chapter = Prologue;
        public static int Stage = BeforeClear;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        public static void Reset() { Chapter = Prologue; Stage = BeforeClear; }
    }

    /// <summary>タイトル画面がセーブから読む物（いちばん最近のセーブ・空き枠・状態・説明の行）。画面に触れない</summary>
    public static class TitleSaves
    {
        /// <summary>いちばん最近遊んだセーブの枠（保存した日時がいちばん新しい物。同じなら番号の大きい物）。無ければ 0</summary>
        public static int Latest(IReadOnlyList<SaveStore.Slot> slots)
        {
            int best = 0;
            string bestAt = null;
            foreach (var s in slots)
            {
                if (s.state != SaveStore.SlotState.Ok || s.data == null) continue;
                string at = s.data.savedAt ?? "";
                if (bestAt == null || string.CompareOrdinal(at, bestAt) >= 0) { best = s.index; bestAt = at; }
            }
            return best;
        }

        /// <summary>空いている枠（いちばん番号の小さい物）。無ければ 0</summary>
        public static int FirstEmpty(IReadOnlyList<SaveStore.Slot> slots)
        {
            foreach (var s in slots) if (s.state == SaveStore.SlotState.Empty) return s.index;
            return 0;
        }

        /// <summary>タイトル画面の状態（いちばん最近のセーブの進み具合。セーブが無ければクリア前）</summary>
        public static int StageOf(SaveData latest) => latest == null ? GameProgress.BeforeClear : Mathf.Clamp(latest.progress, 0, 2);

        /// <summary>説明の行（続きから）: 章　場所　日時　プレイ時間（間は全角の空白）</summary>
        public static string InfoLine(SaveData d)
        {
            if (d == null) return "セーブデータがありません。";
            string at = (d.savedAt ?? "").Replace('-', '/');
            return $"{ChapterText(d)}　{d.placeName}　{at}　プレイ時間 {PlayTime(d.playSeconds)}";
        }

        public static string ChapterText(SaveData d) => d == null || string.IsNullOrEmpty(d.chapter) ? GameProgress.Prologue : d.chapter;

        public static string PlayTime(float seconds)
        {
            int m = Mathf.Max(0, (int)(seconds / 60f));
            return $"{m / 60:00}:{m % 60:00}";
        }
    }
}
