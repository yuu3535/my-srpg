using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 2Dの探索から、戦闘になる場所（奥行きのある盤面。Explore3D）へ移るときの受け渡し（2026-10-04）。
    /// 戦闘になる場所は2Dの横スクロールにせず、3Dの盤面で見せる（原作者 2026-10-04: いつもの探索と違う見た目なら「次の戦場かも」と分かる）。
    /// 流した会話・持ち物を持って、配置表の扉の行き先（マスと向き）から始める
    /// </summary>
    public static class ExploreHandoff
    {
        public static bool Pending { get; private set; }
        public static string MapId { get; private set; }
        public static Vector2Int Cell { get; private set; }
        public static string Facing { get; private set; }
        public static readonly HashSet<string> Seen = new HashSet<string>();
        public static readonly List<string> Items = new List<string>();

        public static void Set(string mapId, Vector2Int cell, string facing, IEnumerable<string> seen, IEnumerable<string> items)
        {
            Pending = true;
            MapId = mapId;
            Cell = cell;
            Facing = facing;
            Seen.Clear(); Seen.UnionWith(seen);
            Items.Clear(); Items.AddRange(items);
        }

        public static void Clear() => Pending = false;
    }
}
