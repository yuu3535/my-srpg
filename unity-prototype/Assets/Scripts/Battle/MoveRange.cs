using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 移動範囲（ブラウザ版 game.js の getMoveRange と同じ規則）。
    ///   上下左右に移動力のぶん進める。相手の陣営のユニットは通れない。味方は通れるが、止まれない。
    ///   通れないマス（wall・void）には入れない。
    ///   地形を考えるときは、入れるマスと止まれるマスを分けて渡す（飛行は通り抜けられても止まれないマスがある）。
    /// </summary>
    public static class MoveRange
    {
        public interface IOccupant
        {
            Vector2Int Cell { get; }
            string Side { get; }
            bool Alive { get; }
        }

        public static List<Vector2Int> Compute(
            Vector2Int start, int move, string side,
            IEnumerable<IOccupant> units, int cols, int rows, System.Func<Vector2Int, bool> isBlocked,
            IOccupant self = null)
        {
            System.Func<Vector2Int, bool> open = cell => isBlocked == null || !isBlocked(cell);
            return Compute(start, move, side, units, cols, rows, open, open, self);
        }

        /// <summary>
        /// 地形を考える移動範囲。canEnter: 入れる（通り抜けられる）マス、canStop: 止まれるマス。
        /// 飛行は、止まれないマス（石の基礎・茂み）も通り抜けられる（TerrainRules）
        /// </summary>
        public static List<Vector2Int> Compute(
            Vector2Int start, int move, string side,
            IEnumerable<IOccupant> units, int cols, int rows,
            System.Func<Vector2Int, bool> canEnter, System.Func<Vector2Int, bool> canStop,
            IOccupant self = null)
        {
            var occupants = new Dictionary<Vector2Int, IOccupant>();
            foreach (var unit in units)
            {
                if (unit == null || !unit.Alive || unit == self) continue;
                occupants[unit.Cell] = unit;
            }

            var reachable = new List<Vector2Int>();
            var visited = new HashSet<Vector2Int> { start };
            var queue = new Queue<(Vector2Int cell, int remaining)>();
            queue.Enqueue((start, move));
            var dirs = new[] { new Vector2Int(0, 1), new Vector2Int(0, -1), new Vector2Int(1, 0), new Vector2Int(-1, 0) };

            while (queue.Count > 0)
            {
                var (cell, remaining) = queue.Dequeue();
                if (cell != start && !occupants.ContainsKey(cell) && canStop(cell)) reachable.Add(cell);
                if (remaining <= 0) continue;
                foreach (var dir in dirs)
                {
                    var next = cell + dir;
                    if (!IsoGrid.InBounds(next, cols, rows) || visited.Contains(next)) continue;
                    if (!canEnter(next)) continue;
                    if (occupants.TryGetValue(next, out var occ) && occ.Side != side) continue;
                    visited.Add(next);
                    queue.Enqueue((next, remaining - 1));
                }
            }
            return reachable;
        }
    }
}
