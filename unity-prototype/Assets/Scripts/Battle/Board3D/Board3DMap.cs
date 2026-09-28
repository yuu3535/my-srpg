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
        public readonly List<Vector2Int> SceneryTrees = new List<Vector2Int>(); // 盤面の外の景色の木（Board3DScenery）

        // 戦えるマスの外の、見た目だけの地形（種類と天面の高さ）。押せない・入れない
        private readonly Dictionary<Vector2Int, (char type, float height)> scenery = new Dictionary<Vector2Int, (char, float)>();
        public IEnumerable<Vector2Int> SceneryCells => scenery.Keys;
        public int SceneryMargin { get; private set; }

        public const float GateHeight = 1.8f;
        public const float TreeHeight = 2.3f;

        public const float WallHeight = 1.3f;

        // 置いてある物（ベッド・机・ベンチなど。配置表の objects）: そのマスには入れない。見た目の高さと種類
        private readonly Dictionary<Vector2Int, (string id, string kind, float height)> obstacles = new Dictionary<Vector2Int, (string, string, float)>();
        public IEnumerable<KeyValuePair<Vector2Int, (string id, string kind, float height)>> Obstacles => obstacles;
        public void AddObstacle(Vector2Int cell, string id, string kind, float height = 0.6f) => obstacles[cell] = (id, kind, height);

        // 下を通れる高い物（天幕の屋根など）・板の絵の小物・点の光（配置表の objects の blocks: false・props・lights）
        public readonly List<(Vector2Int cell, string kind, float height)> Canopies = new List<(Vector2Int, string, float)>();
        public readonly List<MapProp> Props = new List<MapProp>();
        public readonly List<MapLight> Lights = new List<MapLight>();
        public bool IsObstacle(Vector2Int cell) => obstacles.ContainsKey(cell);

        /// <summary>
        /// 壁のかたまりの中身（配置表の場所で、通れるマスに斜めも含めて接していない、入れないマス）。描かない（外と同じ暗さ）。
        /// 廊下のまわりの部屋の壁が、大きな石の箱になって画面をふさがないように（2026-09-28）
        /// </summary>
        public bool IsVoid(Vector2Int cell)
        {
            if (!FromLayoutFile || !InBounds(cell) || TerrainRules.CanEnter(TerrainAt(cell), false)) return false;
            for (int dy = -1; dy <= 1; dy++)
            for (int dx = -1; dx <= 1; dx++)
            {
                var n = cell + new Vector2Int(dx, dy);
                if (InBounds(n) && TerrainRules.CanEnter(TerrainAt(n), false)) return false;
            }
            return true;
        }

        /// <summary>配置表から作った場所（城の部屋・廊下・訓練場）。まわりの景色（地面の絵を鏡に映した外側）を作らない</summary>
        public bool FromLayoutFile { get; private set; }
        public bool Indoor { get; private set; }
        public string MapId { get; private set; }

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

        /// <summary>盤面の外に見た目だけの地形を置く（c は岩の崖。ほかの記号は盤面と同じ模様）</summary>
        public void SetScenery(Vector2Int cell, char type, float height)
        {
            if (InBounds(cell)) return;
            scenery[cell] = (type, height);
            int dx = cell.x < 0 ? -cell.x : Mathf.Max(0, cell.x - Columns + 1);
            int dy = cell.y < 0 ? -cell.y : Mathf.Max(0, cell.y - Rows + 1);
            SceneryMargin = Mathf.Max(SceneryMargin, Mathf.Max(dx, dy));
        }

        public bool IsScenery(Vector2Int cell) => !InBounds(cell) && scenery.ContainsKey(cell);

        /// <summary>景色の段差をなくす（地面の1枚絵のとき。絵は平らな地面として描いてあるため）</summary>
        public void FlattenScenery()
        {
            foreach (var cell in new List<Vector2Int>(scenery.Keys)) scenery[cell] = (scenery[cell].type, 0f);
        }

        public char TerrainAt(Vector2Int cell)
        {
            if (InBounds(cell)) return terrain[cell.x, cell.y];
            return scenery.TryGetValue(cell, out var s) ? s.type : '.';
        }
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

        /// <summary>入れる（通り抜けられる）か・止まれるか（TerrainRules。飛行は # と t を通り抜けるだけ。置いてある物のマスは地上では入れない）</summary>
        public bool CanEnter(Vector2Int cell, bool flying) => InBounds(cell) && TerrainRules.CanEnter(TerrainAt(cell), flying) && (flying || !IsObstacle(cell));
        public bool CanStop(Vector2Int cell, bool flying) => InBounds(cell) && TerrainRules.CanStop(TerrainAt(cell), flying) && !IsObstacle(cell);

        /// <summary>
        /// マスの天面の高さ（マップ担当の地形の表 2026-09-27）。通れない地形は高さで分かるようにする:
        /// 水堀 −0.18 ／ 遮蔽物 +0.3 ／ 石の基礎 +0.5 ／ 密な茂み +0.6 ／ 壁の模型が立つマスは壁の高さ
        /// </summary>
        public float TopHeight(Vector2Int cell)
        {
            if (!InBounds(cell)) return scenery.TryGetValue(cell, out var s) ? s.height : 0f;
            if (walls.TryGetValue(cell, out var wall)) return wall;
            if (IsVoid(cell)) return 0f;
            return TerrainTable.TryGet(TerrainAt(cell), out var info) ? info.height : 0f;
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

        public static string TerrainName(char t) => TerrainTable.TryGet(t, out var info) ? info.name : "―";

        /// <summary>模様がないときの仮の色（T1〜T4）</summary>
        public static Color TerrainColor(char t) => TerrainTable.Get(t).color;

        /// <summary>
        /// 配置表（tools/map_layout.py unity が書き出した MapLayoutFile）から場所の盤面を作る。
        /// 記号の決まりはこの場所の legend で上書きする。置いてある物（blocks）は入れないマスにする。人物は探索の場面ごとに置く（ここでは置かない）
        /// </summary>
        public static Board3DMap FromLayout(MapLayoutFile layout)
        {
            TerrainTable.ClearOverrides();
            foreach (var s in layout.symbols ?? System.Array.Empty<MapSymbol>())
            {
                if (string.IsNullOrEmpty(s.symbol)) continue;
                // 決まった値（TerrainTable）から始め、配置表にあるものだけ上書きする
                var info = TerrainTable.Get(s.symbol[0]);
                if (!string.IsNullOrEmpty(s.name)) info.name = s.name;
                if (s.color != null && s.color.Length >= 3) info.color = new Color32((byte)s.color[0], (byte)s.color[1], (byte)s.color[2], 255);
                foreach (var pair in (s.rules ?? "").Split(','))
                {
                    var kv = pair.Split('=');
                    if (kv.Length != 2) continue;
                    string key = kv[0].Trim(), value = kv[1].Trim();
                    bool on = value == "1" || value == "true";
                    if (key == "walk") info.walk = on;
                    else if (key == "flyEnter") info.flyEnter = on;
                    else if (key == "flyStop") info.flyStop = on;
                    else if (key == "height" && float.TryParse(value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var h)) info.height = h;
                }
                TerrainTable.Override(s.symbol[0], info);
            }
            var map = new Board3DMap(layout.columns, layout.rows) { FromLayoutFile = true, Indoor = layout.indoor, MapId = layout.mapId };
            for (int r = 0; r < layout.rows; r++)
            for (int c = 0; c < layout.columns; c++)
            {
                var row = layout.terrain[r];
                map.SetTerrain(new Vector2Int(c, r), c < row.Length ? row[c] : 'W');
            }
            foreach (var o in layout.objects ?? System.Array.Empty<MapObject>())
            foreach (var cell in o.cells ?? System.Array.Empty<MapCell>())
            {
                if (!map.InBounds(cell.V)) continue;
                if (o.blocks) map.AddObstacle(cell.V, o.id, o.kind, o.height > 0f ? o.height : 0.6f);
                else map.Canopies.Add((cell.V, o.kind, o.height > 0f ? o.height : 1.8f));   // 下を通れる（天幕の屋根）
            }
            map.Props.AddRange(layout.props ?? System.Array.Empty<MapProp>());
            map.Lights.AddRange(layout.lights ?? System.Array.Empty<MapLight>());
            return map;
        }
    }
}
