using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 3Dの盤面に組み立てるマップのデータ（大きさ・地形・高さ・キャラ・明かり・木）。
    /// 国境監視路の試作（Board3DLayout.Watchroad）も、戦闘データから作る盤面（Battle3DController）も、この形で渡す。
    /// 1マス＝1×1。列は +x（右）、行は −z（手前）へ進む。盤面の中心が原点。
    /// </summary>
    public class Board3DMap
    {
        public struct Unit
        {
            public Vector2Int cell;
            public string id;
            public bool enemy;
        }

        public readonly int Columns;
        public readonly int Rows;
        private readonly char[,] terrain;
        private readonly Dictionary<Vector2Int, char> markers = new Dictionary<Vector2Int, char>();
        private readonly Dictionary<Vector2Int, float> walls = new Dictionary<Vector2Int, float>();

        public readonly List<Unit> Units = new List<Unit>();
        public readonly List<Vector2Int> Torches = new List<Vector2Int>();
        public readonly List<Vector2Int> GateGlows = new List<Vector2Int>();
        public readonly List<Vector2Int> ModelTrees = new List<Vector2Int>();
        public readonly List<Vector2Int> PictureTrees = new List<Vector2Int>();
        public readonly List<Vector2Int> Gates = new List<Vector2Int>();      // 門（柱と屋根をマスの奥の辺に立てる。門の下は通れる）
        public readonly List<Vector2Int> Railings = new List<Vector2Int>();   // 橋の欄干（マスの左右の辺に低い手すり）

        public const float GateHeight = 1.8f;
        public const float TreeHeight = 2.3f;

        public const float WallHeight = 1.3f;

        public Board3DMap(int columns, int rows, char fill = 's')
        {
            Columns = columns;
            Rows = rows;
            terrain = new char[columns, rows];
            for (int c = 0; c < columns; c++)
            for (int r = 0; r < rows; r++)
                terrain[c, r] = fill;
        }

        /// <summary>地形の記号: s 旧石畳 / d 土道 / g 苔と下草 / = 補修橋 / ~ 水堀 / o 遮蔽物 / # 石の基礎 / t 密な茂み</summary>
        public void SetTerrain(Vector2Int cell, char type) => terrain[cell.x, cell.y] = type;
        public void SetMarker(Vector2Int cell, char marker) => markers[cell] = marker;
        /// <summary>壁の模型が立つマス（地形は # にする）。height は天面の高さ</summary>
        public void AddWall(Vector2Int cell, float height = WallHeight) => walls[cell] = height;

        public char TerrainAt(Vector2Int cell) => terrain[cell.x, cell.y];
        public char MarkerAt(Vector2Int cell) => markers.TryGetValue(cell, out var m) ? m : '.';
        public bool IsWall(Vector2Int cell) => walls.ContainsKey(cell);
        public bool InBounds(Vector2Int cell) => cell.x >= 0 && cell.x < Columns && cell.y >= 0 && cell.y < Rows;
        public float MaxHeight
        {
            get
            {
                float max = 0.6f;
                foreach (var h in walls.Values) max = Mathf.Max(max, h);
                if (Gates.Count > 0) max = Mathf.Max(max, GateHeight);
                if (ModelTrees.Count > 0) max = Mathf.Max(max, TreeHeight);
                return max;
            }
        }

        /// <summary>入れる（通り抜けられる）か・止まれるか（TerrainRules。飛行は # と t を通り抜けるだけ）</summary>
        public bool CanEnter(Vector2Int cell, bool flying) => InBounds(cell) && TerrainRules.CanEnter(TerrainAt(cell), flying);
        public bool CanStop(Vector2Int cell, bool flying) => InBounds(cell) && TerrainRules.CanStop(TerrainAt(cell), flying);

        /// <summary>
        /// マスの天面の高さ（マップ担当の地形の表 2026-09-27）。通れない地形は高さで分かるようにする:
        /// 水堀 −0.18 ／ 遮蔽物 +0.3 ／ 石の基礎 +0.5 ／ 密な茂み +0.6 ／ 壁の模型が立つマスは壁の高さ
        /// </summary>
        public float TopHeight(Vector2Int cell)
        {
            if (walls.TryGetValue(cell, out var wall)) return wall;
            return TerrainAt(cell) switch
            {
                '~' => -0.18f,
                'o' => 0.3f,
                '#' => 0.5f,
                't' => 0.6f,
                _ => 0f,
            };
        }

        /// <summary>マスの中心（高さ 0 の面）</summary>
        public Vector3 CellCenter(Vector2Int cell) =>
            new Vector3(cell.x - (Columns - 1) * 0.5f, 0f, (Rows - 1) * 0.5f - cell.y);

        public Vector3 TopCenter(Vector2Int cell) => CellCenter(cell) + Vector3.up * TopHeight(cell);

        /// <summary>盤面上の位置からマスを求める（CellCenter の逆）</summary>
        public Vector2Int WorldToCell(Vector3 world) =>
            new Vector2Int(
                Mathf.RoundToInt(world.x + (Columns - 1) * 0.5f),
                Mathf.RoundToInt((Rows - 1) * 0.5f - world.z));

        public static string TerrainName(char t) => t switch
        {
            's' => "旧石畳",
            'd' => "土道",
            'g' => "苔と下草",
            '=' => "補修橋",
            '~' => "水堀",
            'o' => "遮蔽物",
            '#' => "石の基礎",
            't' => "密な茂み",
            _ => "―",
        };

        /// <summary>模様がないときの仮の色（T1〜T4）</summary>
        public static Color TerrainColor(char t) => t switch
        {
            's' => new Color32(150, 146, 138, 255),
            'd' => new Color32(139, 108, 74, 255),
            'g' => new Color32(82, 108, 66, 255),
            '=' => new Color32(122, 90, 58, 255),
            '~' => new Color32(38, 68, 94, 255),
            'o' => new Color32(104, 98, 92, 255),
            '#' => new Color32(96, 90, 86, 255),
            't' => new Color32(40, 56, 44, 255),
            _ => Color.magenta,
        };
    }
}
