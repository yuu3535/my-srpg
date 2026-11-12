using System;
using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 支援会話の台本（2026-11-13 総合担当）。Resources/Support/support_talks.json を読む（台本ができたら差し替える）。
    /// 組（a・b）とランク（C / B / A）で探し、会話の画面（DialogueView.PlaySupport）に渡す形（ScenarioBlock）にする。画面に触れない
    /// </summary>
    public static class SupportTalks
    {
        [Serializable]
        public class Talk
        {
            public string a, b, rank, title;
            public bool draft;
            public ScenarioLine[] lines;

            public int RankIndex => Array.IndexOf(SupportRoster.RankNames, rank ?? "");
            public bool Is(string x, string y) => (a == x && b == y) || (a == y && b == x);

            public ScenarioBlock ToBlock() => new ScenarioBlock
            {
                id = $"support.{a}_{b}.{rank}",
                part = "support",
                label = "支援会話",
                scene = title,
                lines = lines ?? Array.Empty<ScenarioLine>(),
            };
        }

        [Serializable] private class TalkFile { public Talk[] talks; }

        private static List<Talk> all;

        public static IReadOnlyList<Talk> All { get { if (all == null) Load(); return all; } }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        public static void Reset() { all = null; }

        public static void Load(string json = null)
        {
            if (json == null)
            {
                var t = Resources.Load<TextAsset>("Support/support_talks");
                json = t != null ? t.text : "{}";
            }
            all = new List<Talk>(JsonUtility.FromJson<TalkFile>(json)?.talks ?? Array.Empty<Talk>());
        }

        /// <summary>組 x・y のランク rankIndex（0=C, 1=B, 2=A）の台本（無ければ null）</summary>
        public static Talk Find(string x, string y, int rankIndex)
        {
            foreach (var t in All) if (t.Is(x, y) && t.RankIndex == rankIndex) return t;
            return null;
        }
    }
}
