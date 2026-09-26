using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 3Dの盤面の試作（T1〜T3）で使う、マス目と地形の配置。
    /// 配置は国境監視路の案B改（docs/10-design/map/MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md §7）。
    /// 1マス＝1×1。列は +x（右）、行は −z（手前）へ進む。盤面の中心が原点。
    /// 盤面を組み立てるときは Watchroad() で Board3DMap にして渡す。
    /// </summary>
    public static class Board3DLayout
    {
        public const int Columns = 12;
        public const int Rows = 8;

        // 地形の配置（行0〜7、列0〜11。マップ担当の「3Dの盤面の地形・高い物の表」2026-09-27）。
        // s 旧石畳 / d 土道 / g 苔と下草 / = 補修橋 / ~ 水堀 / o 遮蔽物 / # 石の基礎 / t 密な茂み（盤面の角。木が立つ）
        public static readonly string[] Terrain =
        {
            "ttsssss#ddtt",
            "tssosssodddt",
            "gs#ggssgdddg",
            "gs#~~~=~~ddg",
            "gss~~~=~~dod",
            "gosggosg#ddg",
            "tgsgggsggdgt",
            "ttggggsggdtt",
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

        // 高い物（マップ担当の「高い物の表」2026-09-27）
        // 崩れた砦壁: 2マスで1つの壁。上の端を崩して、場所によって高さを変える
        public static readonly (Vector2Int cell, float height)[] Walls = { (new Vector2Int(2, 2), 1.3f), (new Vector2Int(2, 3), 1.05f) };
        // 木（針葉樹）: 盤面の角の茂み t だけに置く
        public static readonly Vector2Int[] Trees = { new Vector2Int(0, 0), new Vector2Int(11, 0), new Vector2Int(0, 6), new Vector2Int(11, 6) };
        // 監視門（目的地点）: 柱と屋根はマスの奥の辺に立て、たいまつ2本は門の左右の柱に付ける。門の下は通れる
        public static readonly Vector2Int Gate = new Vector2Int(5, 0);
        // 補修橋の欄干: 橋のマスの左右の辺に低い手すり
        public static readonly Vector2Int[] Railings = { new Vector2Int(6, 3), new Vector2Int(6, 4) };

        /// <summary>国境監視路の試作マップ（案B改）を、3Dの盤面のデータにする</summary>
        public static Board3DMap Watchroad()
        {
            var map = new Board3DMap(Columns, Rows);
            for (int r = 0; r < Rows; r++)
            for (int c = 0; c < Columns; c++)
            {
                var cell = new Vector2Int(c, r);
                map.SetTerrain(cell, TerrainAt(cell));
                if (MarkerAt(cell) != '.') map.SetMarker(cell, MarkerAt(cell));
            }
            foreach (var (cell, height) in Walls) map.AddWall(cell, height);
            foreach (var (cell, id) in Units)
                map.Units.Add(new Board3DMap.Unit { cell = cell, id = id, enemy = MarkerAt(cell) == 'E' || MarkerAt(cell) == 'C' });
            map.ModelTrees.AddRange(Trees);
            map.Gates.Add(Gate);   // たいまつと門の光は門の模型に付く
            map.Railings.AddRange(Railings);
            return map;
        }

        private static Board3DMap cached;
        private static Board3DMap Map => cached ??= Watchroad();

        public static bool IsWall(Vector2Int cell) => Map.IsWall(cell);
        public static float TopHeight(Vector2Int cell) => Map.TopHeight(cell);
        public static Vector3 TopCenter(Vector2Int cell) => Map.TopCenter(cell);

        public static char TerrainAt(Vector2Int cell) => Terrain[cell.y][cell.x];
        public static char MarkerAt(Vector2Int cell) => Markers[cell.y][cell.x];

        public static bool InBounds(Vector2Int cell) =>
            cell.x >= 0 && cell.x < Columns && cell.y >= 0 && cell.y < Rows;

        /// <summary>マスの中心（高さ 0 の面）</summary>
        public static Vector3 CellCenter(Vector2Int cell) =>
            new Vector3(cell.x - (Columns - 1) * 0.5f, 0f, (Rows - 1) * 0.5f - cell.y);

        /// <summary>盤面上の位置からマスを求める（CellCenter の逆）</summary>
        public static Vector2Int WorldToCell(Vector3 world) =>
            new Vector2Int(
                Mathf.RoundToInt(world.x + (Columns - 1) * 0.5f),
                Mathf.RoundToInt((Rows - 1) * 0.5f - world.z));
    }
}
