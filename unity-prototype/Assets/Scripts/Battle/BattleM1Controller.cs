using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Srpg.Battle
{
    /// <summary>
    /// Unity版 M1-a: 斜め見下ろしの盤面にマップ絵とユニットを並べ、選んで移動するまで。
    /// （docs/30-planning/UNITY_M1_PLAN_2026-09-26.md）
    /// シーンはエディタ用スクリプト（Assets/Editor/Agent/BattleM1Builder.cs）が組み立てる。
    /// Setup() はエディタ上でも実行でき、プレビュー画像の書き出しにも使う。
    /// </summary>
    public class BattleM1Controller : MonoBehaviour
    {
        [Serializable]
        public class UnitSprite
        {
            public string id;
            public Sprite sprite;
        }

        [SerializeField] private TextAsset battleJson;
        [SerializeField] private Sprite mapSprite;
        [SerializeField] private Sprite tileSprite;     // 塗りの菱形（移動範囲）
        [SerializeField] private Sprite frameSprite;    // 枠の菱形（選択中）
        [SerializeField] private UnitSprite[] unitSprites = Array.Empty<UnitSprite>();
        // 敵に狙われているユニットの足元から立ちのぼる赤い粒子（原作者 2026-09-26）。
        // 陣営は台座の色（味方＝白・敵＝黒）で示すので、ふだんは出さない
        [SerializeField] private Sprite[] targetSparkFrames = Array.Empty<Sprite>();
        [SerializeField] private float ringWidth = 0.9f;                            // 粒子の横幅（マスの横幅＝1）
        [SerializeField] private Sprite footGlowSprite;                             // 足元の淡い楕円（台座がないときに使う）
        [SerializeField] private Sprite baseAllySprite;                             // 駒の台座（味方＝白。原作者の素材）
        [SerializeField] private Sprite baseEnemySprite;                            // 駒の台座（敵＝黒）
        [SerializeField] private float baseWidth = 0.82f;                           // 台座の横幅（マスの横幅＝1）
        [SerializeField] private Camera targetCamera;
        [SerializeField] private float unitHeight = 1.35f;   // ユニットの絵の高さ（マスの横幅＝1）

        private static readonly Color MoveColor = new Color(0.30f, 0.60f, 1f, 0.45f);
        private static readonly Color SelectColor = new Color(0.55f, 0.80f, 1f, 1f);
        private static readonly Color AllyGlow = new Color(0.35f, 0.62f, 1f, 0.75f);
        private static readonly Color EnemyGlow = new Color(1f, 0.30f, 0.26f, 0.75f);

        private BattleDataFile data;
        private readonly List<UnitView> units = new List<UnitView>();
        private readonly List<SpriteRenderer> highlights = new List<SpriteRenderer>();
        private readonly HashSet<Vector2Int> moveCells = new HashSet<Vector2Int>();
        private readonly HashSet<Vector2Int> blocked = new HashSet<Vector2Int>();
        private SpriteRenderer selectionFrame;
        private Transform boardRoot;
        private UnitView selected;

        public BattleDataFile Data => data;
        public IReadOnlyList<UnitView> Units => units;
        public UnitView Selected => selected;

        /// <summary>盤面の上のユニット</summary>
        public class UnitView : MoveRange.IOccupant
        {
            public UnitData source;
            public GameObject root;
            public SpriteRenderer renderer;
            public SpriteRenderer ring;
            public SpriteRenderer glow;
            public SpriteRenderer unitBase;
            public Vector2Int cell;
            public bool moved;
            public Vector2Int Cell => cell;
            public string Side => source.side;
            public bool Alive => true;
        }

        private void Start()
        {
            Setup();
        }

        /// <summary>データを読み、盤面を組み立て直す（エディタ上でも動く）</summary>
        public void Setup()
        {
            if (battleJson == null) throw new InvalidOperationException("battleJson が設定されていない");
            data = JsonUtility.FromJson<BattleDataFile>(battleJson.text);
            ClearBoard();
            boardRoot = new GameObject("Board").transform;
            boardRoot.SetParent(transform, false);

            blocked.Clear();
            foreach (var tile in data.tiles ?? Array.Empty<TileData>())
            {
                if (tile.type == "wall" || tile.type == "void") blocked.Add(new Vector2Int(tile.x, tile.y));
            }

            BuildMap();
            BuildUnits();
            selectionFrame = CreateDiamond("SelectionFrame", frameSprite, SelectColor, 5);
            selectionFrame.gameObject.SetActive(false);
            FitCamera();
        }

        private void ClearBoard()
        {
            units.Clear();
            highlights.Clear();
            moveCells.Clear();
            selected = null;
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                var child = transform.GetChild(i).gameObject;
                if (Application.isPlaying) Destroy(child);
                else DestroyImmediate(child);
            }
        }

        /// <summary>マップ絵: マス(0,0)の上の頂点（絵の originX, originY）がワールドの原点に来るよう置く</summary>
        private void BuildMap()
        {
            if (mapSprite == null || data.iso == null) return;
            var map = new GameObject("Map").AddComponent<SpriteRenderer>();
            map.transform.SetParent(boardRoot, false);
            map.sprite = mapSprite;
            map.sortingOrder = -1000;
            // マップ絵は「1マスの横幅 tileW px ＝ 1ワールド単位」、ピボットは左上で読み込む
            float unit = data.iso.tileW;
            map.transform.localPosition = new Vector3(-data.iso.originX / unit, data.iso.originY / unit, 0f);
        }

        private void BuildUnits()
        {
            foreach (var source in data.units)
            {
                var root = new GameObject($"Unit_{source.id}");
                root.transform.SetParent(boardRoot, false);
                var renderer = new GameObject("Sprite").AddComponent<SpriteRenderer>();
                renderer.transform.SetParent(root.transform, false);
                renderer.sprite = unitSprites.FirstOrDefault(s => s.id == source.id)?.sprite;
                if (renderer.sprite != null)
                {
                    float scale = unitHeight / renderer.sprite.bounds.size.y;
                    renderer.transform.localScale = new Vector3(scale, scale, 1f);
                }
                // 足元の光: 味方は青、敵は赤（原作者 2026-09-26: 敵か味方かを見分けやすく）。キャラの絵の後ろに置く
                var frames = targetSparkFrames;
                SpriteRenderer ring = null;
                if (frames != null && frames.Length > 0)
                {
                    ring = new GameObject("FootRing").AddComponent<SpriteRenderer>();
                    ring.transform.SetParent(root.transform, false);
                    float ringScale = ringWidth / frames[0].bounds.size.x;
                    ring.transform.localScale = new Vector3(ringScale, ringScale, 1f);
                    ring.transform.localPosition = new Vector3(0f, -IsoGrid.TileHeight * 0.12f, 0f);
                    // ユニットごとに動きの始まりをずらす
                    float offset = (Mathf.Abs(source.id.GetHashCode()) % 1000) / 1000f * frames.Length / 20f;
                    ring.gameObject.AddComponent<SpriteFlipbook>().Setup(frames, 20f, offset);
                    ring.gameObject.SetActive(false);   // 狙われたときだけ出す（SetTargeted）
                }
                // 粒は立ちのぼって消えるのをくり返すため、陣営の色の淡い楕円を足元に常に敷く
                // 駒の台座（TRPGの駒のように、キャラを台座に立たせる。原作者の動画の表現と素材 2026-09-26）
                // 味方＝白、敵＝黒（原作者 2026-09-26）
                SpriteRenderer unitBase = null;
                var baseSprite = source.side == "enemy" ? baseEnemySprite : baseAllySprite;
                if (baseSprite != null) unitBase = CreateBasePart(root.transform, "Base", baseSprite, Color.white);
                SpriteRenderer glow = null;
                if (footGlowSprite != null && unitBase == null)
                {
                    glow = new GameObject("FootGlow").AddComponent<SpriteRenderer>();
                    glow.transform.SetParent(root.transform, false);
                    glow.sprite = footGlowSprite;
                    glow.color = source.side == "enemy" ? EnemyGlow : AllyGlow;
                    float glowScale = ringWidth / footGlowSprite.bounds.size.x;
                    glow.transform.localScale = new Vector3(glowScale, glowScale, 1f);
                    glow.transform.localPosition = new Vector3(0f, IsoGrid.TileHeight * 0.18f, 0f);   // マスの中心
                }
                var view = new UnitView { source = source, root = root, renderer = renderer, ring = ring, glow = glow, unitBase = unitBase, cell = new Vector2Int(source.x, source.y) };
                units.Add(view);
                PlaceUnit(view);
            }
        }

        private SpriteRenderer CreateBasePart(Transform parent, string name, Sprite sprite, Color color)
        {
            var part = new GameObject(name).AddComponent<SpriteRenderer>();
            part.transform.SetParent(parent, false);
            part.sprite = sprite;
            part.color = color;
            float scale = baseWidth / sprite.bounds.size.x;
            part.transform.localScale = new Vector3(scale, scale, 1f);
            return part;
        }

        private void PlaceUnit(UnitView view)
        {
            // 足元（絵の下端）をマスの中心より少し手前に置く
            Vector2 center = IsoGrid.CellCenter(view.cell.x, view.cell.y);
            view.root.transform.localPosition = new Vector3(center.x, center.y - IsoGrid.TileHeight * 0.18f, 0f);
            view.renderer.sortingOrder = IsoGrid.SortingOrder(view.cell.x, view.cell.y) + 5;
            if (view.ring != null) view.ring.sortingOrder = view.renderer.sortingOrder - 1;
            if (view.glow != null) view.glow.sortingOrder = view.renderer.sortingOrder - 2;
            if (view.unitBase != null) view.unitBase.sortingOrder = view.renderer.sortingOrder - 3;
        }

        private SpriteRenderer CreateDiamond(string name, Sprite sprite, Color color, int order)
        {
            var renderer = new GameObject(name).AddComponent<SpriteRenderer>();
            renderer.transform.SetParent(boardRoot, false);
            renderer.sprite = sprite;
            renderer.color = color;
            renderer.sortingOrder = order;
            return renderer;
        }

        /// <summary>盤面全体が画面に収まるように、カメラの大きさと位置を合わせる</summary>
        public void FitCamera()
        {
            if (targetCamera == null) targetCamera = Camera.main;
            if (targetCamera == null || data == null) return;
            int n = data.cols + data.rows;
            float width = n * IsoGrid.TileWidth * 0.5f;
            float height = n * IsoGrid.TileHeight * 0.5f + unitHeight;   // 奥のユニットの頭のぶん
            float left = -data.rows * IsoGrid.TileWidth * 0.5f;
            var center = new Vector2(left + width * 0.5f, unitHeight - height * 0.5f);
            float aspect = targetCamera.aspect > 0 ? targetCamera.aspect : 16f / 9f;
            // 左の味方一覧・右のコマンド一覧のぶん、横に少しゆとりを持たせる
            targetCamera.orthographicSize = Mathf.Max(height * 0.5f, width * 0.5f / aspect * 1.18f) * 1.04f;
            targetCamera.transform.position = new Vector3(center.x, center.y, -10f);
        }

        // ── 操作 ──

        private void Update()
        {
            var pointer = Pointer.current;
            if (pointer == null || !pointer.press.wasPressedThisFrame || targetCamera == null) return;
            Vector2 world = targetCamera.ScreenToWorldPoint(pointer.position.ReadValue());
            Vector2 local = boardRoot != null ? (Vector2)boardRoot.InverseTransformPoint(world) : world;
            TapCell(IsoGrid.WorldToCell(local));
        }

        /// <summary>マスを押したときの処理（ユニットがいればそのユニット、いなければ移動先）</summary>
        public void TapCell(Vector2Int cell)
        {
            if (!IsoGrid.InBounds(cell, data.cols, data.rows))
            {
                Deselect();
                return;
            }
            var unit = units.FirstOrDefault(u => u.cell == cell);
            if (unit != null)
            {
                if (unit.source.side == "ally" && !unit.moved) Select(unit);
                else Deselect();
                return;
            }
            if (selected != null && moveCells.Contains(cell))
            {
                selected.cell = cell;
                selected.moved = true;
                PlaceUnit(selected);
                Deselect();
                return;
            }
            Deselect();
        }

        /// <summary>敵に狙われている印（足元の赤い粒子）を出す・消す。敵の行動予告（M1-c）から呼ぶ</summary>
        public void SetTargeted(string unitId, bool targeted)
        {
            var unit = units.FirstOrDefault(u => u.source.id == unitId);
            if (unit?.ring != null) unit.ring.gameObject.SetActive(targeted);
        }

        public void Select(string unitId)
        {
            var unit = units.FirstOrDefault(u => u.source.id == unitId);
            if (unit != null) Select(unit);
        }

        private void Select(UnitView unit)
        {
            Deselect();
            selected = unit;
            var range = MoveRange.Compute(unit.cell, unit.source.move, unit.source.side, units, data.cols, data.rows,
                cell => blocked.Contains(cell), unit);
            foreach (var cell in range)
            {
                moveCells.Add(cell);
                var tile = CreateDiamond($"Move_{cell.x}_{cell.y}", tileSprite, MoveColor, 2);
                tile.transform.localPosition = IsoGrid.CellCenter(cell.x, cell.y);
                highlights.Add(tile);
            }
            selectionFrame.gameObject.SetActive(true);
            selectionFrame.transform.localPosition = IsoGrid.CellCenter(unit.cell.x, unit.cell.y);
        }

        public void Deselect()
        {
            selected = null;
            moveCells.Clear();
            foreach (var tile in highlights)
            {
                if (tile == null) continue;
                if (Application.isPlaying) Destroy(tile.gameObject);
                else DestroyImmediate(tile.gameObject);
            }
            highlights.Clear();
            if (selectionFrame != null) selectionFrame.gameObject.SetActive(false);
        }
    }
}
