using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 3Dの盤面の試作（T1〜T3）で使う、マス目と地形の配置。
    /// 配置は国境監視路の案B改（docs/10-design/map/MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md §7）。
    /// 1マス＝1×1。列は +x（右）、行は −z（手前）へ進む。盤面の中心が原点。
    /// </summary>
    public static class Board3DLayout
    {
        public const int Columns = 12;
        public const int Rows = 8;

        // 地形の配置（行0〜7、列0〜11）。s 旧石畳 / d 土道 / g 苔と下草 / = 補修橋 / ~ 水堀 / o 遮蔽物 / # 砦壁の基礎・密な下草
        public static readonly string[] Terrain =
        {
            "##sssss#dd##",
            "#ssosssoddd#",
            "gs#ggssgdddg",
            "gs#~~~=~~ddg",
            "gss~~~=~~dod",
            "gosggosg#ddg",
            "#gsgggsggdg#",
            "##ggggsggd##",
        };

        // 駒の配置（向きが分かるように盤面に置く印）。A 味方 / E 敵 / C 敵の指揮役 / G 目的地点（監視門） / S 道標
        public static readonly string[] Markers =
        {
            ".....G...C..",
            "....E.......",
            "......E..E..",
            ".S..........",
            "............",
            "............",
            ".A.A..A..A..",
            "............",
        };

        // T4: 駒の位置に立てるキャラ（案B改の配置。id はブラウザ版と同じ）
        public static readonly (Vector2Int cell, string id)[] Units =
        {
            (new Vector2Int(1, 6), "ringholm"),
            (new Vector2Int(3, 6), "arshe"),
            (new Vector2Int(6, 6), "albas"),
            (new Vector2Int(9, 6), "young_karima"),
            (new Vector2Int(4, 1), "forest_guard"),
            (new Vector2Int(6, 2), "dylan"),
            (new Vector2Int(9, 2), "herel"),
            (new Vector2Int(9, 0), "albas_rival"),
        };

        // T4: 仮の石の壁（崩れた砦壁 列2・行2〜3）と、仮の木（3Dの模型と、板に貼った絵を1本ずつ）
        public static readonly Vector2Int[] Walls = { new Vector2Int(2, 2), new Vector2Int(2, 3) };
        public static readonly Vector2Int ModelTree = new Vector2Int(0, 6);
        public static readonly Vector2Int PictureTree = new Vector2Int(11, 1);

        public const float WallHeight = 1.3f;

        public static bool IsWall(Vector2Int cell) => System.Array.IndexOf(Walls, cell) >= 0;

        /// <summary>マスの天面の高さ。水堀は低く、壁は高く、遮蔽物（瓦礫）は少しだけ高い</summary>
        public static float TopHeight(Vector2Int cell)
        {
            if (IsWall(cell)) return WallHeight;
            return TerrainAt(cell) switch
            {
                '~' => -0.18f,
                'o' => 0.14f,
                _ => 0f,
            };
        }

        public static Vector3 TopCenter(Vector2Int cell) => CellCenter(cell) + Vector3.up * TopHeight(cell);

        public static char TerrainAt(Vector2Int cell) => Terrain[cell.y][cell.x];
        public static char MarkerAt(Vector2Int cell) => Markers[cell.y][cell.x];

        public static bool InBounds(Vector2Int cell) =>
            cell.x >= 0 && cell.x < Columns && cell.y >= 0 && cell.y < Rows;

        /// <summary>マスの天面の中心（天面の高さは y = 0）</summary>
        public static Vector3 CellCenter(Vector2Int cell) =>
            new Vector3(cell.x - (Columns - 1) * 0.5f, 0f, (Rows - 1) * 0.5f - cell.y);

        /// <summary>盤面上の位置からマスを求める（CellCenter の逆）</summary>
        public static Vector2Int WorldToCell(Vector3 world) =>
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
            '#' => "砦壁の基礎",
            _ => "―",
        };

        /// <summary>仮の色（T1〜T3。模様はT5で貼る）</summary>
        public static Color TerrainColor(char t) => t switch
        {
            's' => new Color32(150, 146, 138, 255),
            'd' => new Color32(139, 108, 74, 255),
            'g' => new Color32(82, 108, 66, 255),
            '=' => new Color32(122, 90, 58, 255),
            '~' => new Color32(38, 68, 94, 255),
            'o' => new Color32(104, 98, 92, 255),
            '#' => new Color32(52, 50, 58, 255),
            _ => Color.magenta,
        };
    }
}
