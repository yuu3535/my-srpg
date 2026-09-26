using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Object = UnityEngine.Object;
using UnityEngine.InputSystem;

namespace Srpg.Battle
{
    /// <summary>
    /// 3Dの盤面＋2Dのキャラの表示（原作者 2026-09-27: マップは3Dの盤面で作る。docs/10-design/map/MAP_BOARD_METHOD_DECISION_2026-09-27.md）。
    /// Board3DMap を受け取り、盤面・キャラ・木・明かりを組み立て、カメラを動かし、押したマスを知らせる。
    /// 試作（MAP_3D_BOARD_TEST_REQUEST_2026-09-26.md）で決めたこと:
    ///   - 正方形のマスを3Dのブロックで並べ、天面と側面に模様を貼る（T1・T5）
    ///   - 真上と斜め見下ろし（正投影・縦30°）を切り替え、45°ずつ回す（斜め⇔正面。原作者 2026-09-27）。真上は90°ずつ。光もカメラと一緒に回す
    ///   - キャラは板の絵で、常にカメラの方を向く。真上ではマスの中に収まる（T4）
    ///   - 台座なし。足元の影と、陣営の枠（UI素材 D4 味方・D5 敵）。重なりは キャラ＞枠＞影＞マップ（T4）
    /// 操作: 押す＝マスを知らせる（CellTapped。受け手がいなければそのマスを選ぶ。キャラの体を押したら、そのキャラのマス）
    ///       ／ 横にスワイプ・Q/E・画面のボタン＝45°回す ／ T・ボタン＝真上と斜め
    /// </summary>
    public class Board3DView : MonoBehaviour
    {
        /// <summary>キャラの足元の見せ方（台座を外すかの比較。原作者 2026-09-27）</summary>
        public enum FootStyle
        {
            Pedestal,   // 駒の台座（味方＝白・敵＝黒）
            Shadow,     // 台座なし。足元に丸い影だけ
            TeamRing,   // 台座なし。足元に丸い影と、陣営の色（味方＝青・敵＝赤）の細い輪
            TeamFrame,  // 台座なし。足元に丸い影と、ゲームのUI素材の枠（D4 味方・D5 敵）をマスに敷く（採用）
        }

        [Serializable]
        public struct UnitSprite
        {
            public string id;
            public Sprite sprite;
            // 絵の基準点（下端から2%）から、一番下の色のある行までの距離（絵の高さに対する割合。上が＋）。
            // 組み立て時に絵ごとに測る。この分だけ絵を下げて、足の裏をマスの面にそろえる（原作者 2026-09-27）
            public float footFromPivot;
        }

        [Serializable]
        public struct NamedTexture
        {
            public string name;
            public Texture2D texture;
        }

        [SerializeField] private Camera targetCamera;
        [SerializeField] private bool textured = true;                      // 模様を貼る（false なら仮の色）
        [SerializeField] private bool lanterns = true;                      // たいまつと門の光（点の光）
        [SerializeField] private bool showGuiButtons = true;                // 仮の画面ボタン（回す・真上）。正式なUIができたら外す
        [SerializeField] private bool buildOnStart = true;                  // ▶で自分で組み立てる（試作の国境監視路）
        [SerializeField] private bool showCellInfo = true;                  // 左上の「列・行・地形」（戦闘の画面では戦闘の表示を出すので消す）
        [SerializeField] private NamedTexture[] boardTextures = Array.Empty<NamedTexture>();
        [SerializeField] private UnitSprite[] unitSprites = Array.Empty<UnitSprite>();
        [SerializeField] private Sprite treeSprite;                         // 板に貼る木の絵
        [SerializeField] private float unitHeight = 1.25f;                  // キャラの絵の高さ（1マス＝1）
        [SerializeField] private FootStyle footStyle = FootStyle.TeamFrame;  // 原作者 2026-09-27: C'（UI素材の枠 D4・D5）
        [SerializeField] private Sprite allyFrameSprite;                    // UI素材 D4（assets/ui/select_ally_d4.png）
        [SerializeField] private Sprite enemyFrameSprite;                   // UI素材 D5（assets/ui/select_enemy_d5.png）
        [SerializeField, Range(0f, 1f)] private float teamFrameAlpha = 0.6f;
        [SerializeField] private float topViewUnitSize = 0.86f;             // 真上から見たときのキャラの絵の大きさ（マスの中に収める）
        [SerializeField] private Light keyLight;                            // カメラと一緒に回す光
        [SerializeField] private float lightPitch = 55f;
        [SerializeField] private float lightYawOffset = 15f;                // カメラの向きに対する光の向き（左上の奥から当たる）
        [SerializeField] private bool startTilted = true;
        [SerializeField, Range(10f, 80f)] private float tiltPitch = 30f;    // 斜め見下ろしの縦の角度
        [SerializeField] private float turnSeconds = 0.35f;                 // 回す・傾けるときの動きの長さ
        // 寄りの画面（原作者 2026-09-27: 盤面全体の箱庭ではなく、寄りを基本にする。全体はボタンで見る）
        [SerializeField] private bool startOverview = true;                 // 始まりを全体にするか（試作は全体、戦闘は寄り）
        [SerializeField] private float closeSize = 4.0f;                    // 寄りの画面の大きさ（正投影の縦の半分。理想の画面と同じくらいのマスの大きさ）
        [SerializeField] private float focusRaise = 0.35f;                  // 寄りのとき、見ている所を画面のどれだけ上に置くか（下にUIがある）
        [SerializeField] private Texture2D backdrop;                        // いちばん奥の背景（発注書 第3版 M1）

        private const float TileGap = 0.06f;       // マスの間のすき間（盤面の目地）
        private const float TileHeight = 0.3f;     // マスのブロックの厚み
        private const float BaseHeight = 0.5f;     // 盤面の下の台の厚み
        private const float SwipePixels = 60f;     // これより長く横に動かしたら回す
        private const float TapPixels = 12f;       // これより短ければ押した（選んだ）とみなす
        // 半透明の絵を重ねる順（大きいほど手前）。キャラ＞陣営の目印＞移動範囲＞足元の影＞マップ（原作者 2026-09-27）
        private const int OrderShadow = -30, OrderRange = -20, OrderMark = -10, OrderCharacter = 10;

        private static readonly Color RangeColor = new Color(0.30f, 0.60f, 1f, 0.42f);   // 移動範囲は従来の青（原作者 2026-09-25）
        public static readonly Color AttackRangeColor = new Color(1f, 0.30f, 0.26f, 0.40f); // 攻撃の範囲は赤
        private static readonly Color TargetRingColor = new Color(1f, 0.24f, 0.30f, 1f); // 狙われている印（赤い丸。原作者 2026-09-27）

        private Board3DMap map;
        private readonly Dictionary<Vector2Int, GameObject> tiles = new Dictionary<Vector2Int, GameObject>();
        private Transform boardRoot;
        private GameObject selectionFrame;
        private readonly Dictionary<Color, Material> litMaterials = new Dictionary<Color, Material>();
        private readonly Dictionary<string, Material> texturedMaterials = new Dictionary<string, Material>();
        private readonly List<GameObject> rangeTiles = new List<GameObject>();

        // 板の絵。fitCell のもの（キャラ）は、真上に近づくほどマスの中央に収まる大きさへ変わる
        private class Billboard
        {
            public Transform holder;
            public Transform sprite;
            public float height;
            public float scale;
            public bool fitCell;
            public float footFromPivot;
        }

        // キャラ1人ぶんの表示（板の絵・足元の影と枠・狙われている印）
        private class UnitVisual
        {
            public Board3DMap.Unit unit;
            public Billboard billboard;
            public readonly List<Transform> footParts = new List<Transform>();
            public SpriteRenderer frame;
            public SpriteRenderer targetRing;
        }

        private readonly List<Billboard> billboards = new List<Billboard>();
        private readonly Dictionary<string, UnitVisual> unitVisuals = new Dictionary<string, UnitVisual>();
        private readonly Dictionary<Collider, UnitVisual> unitBodies = new Dictionary<Collider, UnitVisual>();
        private Material spriteMaterial;
        private Sprite shadowSprite, ringSprite, squareSprite;

        public FootStyle Foot { get => footStyle; set => footStyle = value; }
        public bool Textured { get => textured; set => textured = value; }
        public bool Lanterns { get => lanterns; set => lanterns = value; }
        public Board3DMap Map { get => map; set => map = value; }

        private bool tilted;
        private int turn;                  // 45°の何回目か（0〜7）。偶数＝斜め、奇数＝正面（真上では90°ずつ）
        private float pitch, yaw, size;    // 今のカメラ
        private float fromPitch, fromYaw, fromSize, toPitch, toYaw, toSize, moveTime = -1f;
        private Vector2 pressPosition, lastDrag;
        private bool pressing, dragging;
        private bool overview = true;
        private Vector3 focus, fromFocus, toFocus;   // カメラが見ている所（盤面の中の位置。全体のときは盤面の中心）
        private Vector3 closeFocus;                  // 寄りのときに見る所（全体にしている間も覚えておく）
        private RectTransform backdropRect;

        public bool Overview => overview;
        public float CloseSize { get => closeSize; set => closeSize = Mathf.Clamp(value, 2.6f, 7f); }

        /// <summary>マスが押された（受け手がいなければ、そのマスを選ぶ）</summary>
        public event Action<Vector2Int> CellTapped;

        public Vector2Int? Selected { get; private set; }
        public bool Tilted => tilted;
        public int Turn => turn;

        private void Start()
        {
            // 戦闘の画面では Battle3DController がマップを渡してから Setup する（buildOnStart = false）
            overview = startOverview;
            if (!buildOnStart) return;
            Setup();
            SetView(startTilted, 0, true);
        }

        // ── 盤面を作る ──

        public void Setup()
        {
            if (targetCamera == null) targetCamera = Camera.main;
            if (map == null) map = Board3DLayout.Watchroad();
            ClearBoard();
            boardRoot = new GameObject("Board").transform;
            boardRoot.SetParent(transform, false);

            // 盤面の下の台（すき間から暗く見え、目地になる）
            var baseBlock = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseBlock.name = "Base";
            Object.DestroyImmediate(baseBlock.GetComponent<Collider>());
            baseBlock.transform.SetParent(boardRoot, false);
            int margin = map.SceneryMargin;
            baseBlock.transform.localScale = new Vector3(map.Columns + margin * 2 + 0.1f, BaseHeight, map.Rows + margin * 2 + 0.1f);
            baseBlock.transform.localPosition = new Vector3(0, -TileHeight - BaseHeight * 0.5f + 0.02f, 0);
            baseBlock.GetComponent<Renderer>().sharedMaterial = LitMaterial(new Color32(24, 20, 30, 255));

            for (int r = 0; r < map.Rows; r++)
            for (int c = 0; c < map.Columns; c++)
            {
                var cell = new Vector2Int(c, r);
                tiles[cell] = textured && TextureMaterial("top_stone") != null ? BuildTexturedTile(cell) : BuildColoredTile(cell);
                AddMarker(cell);
            }

            // まわりの景色（押せない。当たり判定を外す）
            foreach (var cell in map.SceneryCells)
            {
                var tile = textured && TextureMaterial("top_stone") != null ? BuildTexturedTile(cell) : BuildColoredTile(cell);
                tile.name = $"Scenery_{cell.x}_{cell.y}";
                var collider = tile.GetComponent<Collider>();
                if (collider != null) Object.DestroyImmediate(collider);
            }
            foreach (var cell in map.SceneryTrees) AddModelTree(cell);
            AddBackdrop();

            foreach (var unit in map.Units) AddUnit(unit);
            foreach (var cell in map.ModelTrees) AddModelTree(cell);
            foreach (var cell in map.PictureTrees) AddPictureTree(cell);
            foreach (var cell in map.Gates) AddGate(cell);
            foreach (var cell in map.Railings) AddRailings(cell);
            if (lanterns)
            {
                foreach (var cell in map.Torches) AddTorch(cell);
                foreach (var cell in map.GateGlows)
                    AddPointLight("GateGlow", map.TopCenter(cell) + Vector3.up * 0.6f, new Color32(255, 214, 150, 255), 2.6f, 1.6f);
            }

            selectionFrame = BuildSelectionFrame();
            selectionFrame.SetActive(false);
            Selected = null;
        }

        public void ClearBoard()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
                Object.DestroyImmediate(transform.GetChild(i).gameObject);
            tiles.Clear();
            billboards.Clear();
            unitVisuals.Clear();
            unitBodies.Clear();
            rangeTiles.Clear();
            boardRoot = null;
            backdropRect = null;
        }

        private GameObject BuildColoredTile(Vector2Int cell)
        {
            var tile = GameObject.CreatePrimitive(PrimitiveType.Cube);
            tile.name = $"Tile_{cell.x}_{cell.y}";
            tile.transform.SetParent(boardRoot, false);
            // 天面の高さはマスごと（水堀は低く、壁は高く）。底は台の上でそろえる
            float top = map.TopHeight(cell);
            float height = top + TileHeight;
            tile.transform.localScale = new Vector3(1f - TileGap, height, 1f - TileGap);
            tile.transform.localPosition = map.CellCenter(cell) + Vector3.up * (top - height * 0.5f);
            Color color = map.IsWall(cell) ? new Color32(122, 116, 110, 255) : Board3DMap.TerrainColor(map.TerrainAt(cell));
            tile.GetComponent<Renderer>().sharedMaterial = LitMaterial(color);
            return tile;
        }

        // ── キャラ ──

        /// <summary>足元（影・陣営の枠、または台座）と、その上に立つキャラの絵（板・常にカメラの方を向く）</summary>
        private void AddUnit(Board3DMap.Unit unit)
        {
            var visual = new UnitVisual { unit = unit };
            var top = map.TopCenter(unit.cell);
            float feet = 0.005f;   // 足の裏はマスの面（重なり順は描く順で決めるので、浮かせなくてよい）
            if (footStyle == FootStyle.Pedestal)
            {
                var pedestal = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pedestal.name = $"Pedestal_{unit.id}";
                Object.DestroyImmediate(pedestal.GetComponent<Collider>());
                pedestal.transform.SetParent(boardRoot, false);
                pedestal.transform.localScale = new Vector3(0.7f, 0.05f, 0.7f);
                pedestal.transform.localPosition = top + Vector3.up * 0.05f;
                pedestal.GetComponent<Renderer>().sharedMaterial = LitMaterial(unit.enemy ? new Color32(30, 28, 34, 255) : new Color32(232, 230, 226, 255));
                visual.footParts.Add(pedestal.transform);
                feet = 0.1f;
            }
            else
            {
                visual.footParts.Add(AddFlat($"Shadow_{unit.id}", ShadowSprite(), top + Vector3.up * 0.012f, 0.78f, Color.white, OrderShadow).transform);
                if (footStyle == FootStyle.TeamRing)
                    visual.footParts.Add(AddFlat($"Ring_{unit.id}", RingSprite(), top + Vector3.up * 0.016f, 0.86f,
                        unit.enemy ? new Color32(224, 72, 60, 230) : new Color32(77, 140, 255, 230), OrderMark).transform);
                var frame = unit.enemy ? enemyFrameSprite : allyFrameSprite;
                if (footStyle == FootStyle.TeamFrame && frame != null)
                {
                    visual.frame = AddFlat($"Frame_{unit.id}", frame, top + Vector3.up * 0.014f, 0.98f / frame.bounds.size.x, new Color(1f, 1f, 1f, teamFrameAlpha), OrderMark);
                    visual.footParts.Add(visual.frame.transform);
                }
            }

            Sprite sprite = null;
            float footFromPivot = 0f;
            foreach (var entry in unitSprites)
                if (entry.id == unit.id) { sprite = entry.sprite; footFromPivot = entry.footFromPivot; }
            if (sprite != null)
            {
                visual.billboard = AddBillboard($"Unit_{unit.id}", sprite, top + Vector3.up * feet, unitHeight, true, footFromPivot);
                // キャラの体にも当たり判定を付ける（体を押したら、後ろのマスではなくそのキャラのマスを選ぶ）
                var body = visual.billboard.sprite.gameObject.AddComponent<BoxCollider>();
                body.center = sprite.bounds.center;
                body.size = new Vector3(sprite.bounds.size.x * 0.7f, sprite.bounds.size.y * 0.9f, 0.05f);
                unitBodies[body] = visual;
                // 敵に狙われている印: キャラのまわりの赤い丸（ブラウザ版と同じ。原作者 2026-09-27）。ふだんは出さない
                var ring = new GameObject("TargetRing").AddComponent<SpriteRenderer>();
                ring.transform.SetParent(visual.billboard.holder, false);
                ring.transform.localPosition = Vector3.up * (unitHeight * 0.45f);
                ring.transform.localScale = Vector3.one * (unitHeight * 0.95f);
                ring.sprite = RingSprite();
                ring.color = TargetRingColor;
                ring.sortingOrder = OrderCharacter + 1;
                ring.sharedMaterial = SpriteMaterial();
                ring.gameObject.SetActive(false);
                visual.targetRing = ring;
            }
            unitVisuals[unit.id] = visual;
        }

        /// <summary>キャラをマスへ動かす（絵・足元の影と枠をまとめて）</summary>
        public void MoveUnit(string id, Vector2Int cell)
        {
            if (!unitVisuals.TryGetValue(id, out var visual)) return;
            var delta = map.TopCenter(cell) - map.TopCenter(visual.unit.cell);
            visual.unit.cell = cell;
            if (visual.billboard != null) visual.billboard.holder.localPosition += delta;
            foreach (var part in visual.footParts) part.localPosition += delta;
        }

        /// <summary>敵に狙われている印（キャラのまわりの赤い丸）を出す・消す</summary>
        public void SetTargeted(string id, bool targeted)
        {
            if (unitVisuals.TryGetValue(id, out var visual) && visual.targetRing != null)
                visual.targetRing.gameObject.SetActive(targeted);
        }

        public bool IsTargeted(string id) =>
            unitVisuals.TryGetValue(id, out var visual) && visual.targetRing != null && visual.targetRing.gameObject.activeSelf;

        /// <summary>陣営の枠の濃さ。選んでいるキャラは濃く（100%）して、ふだんの目印（60%）と区別する</summary>
        public void SetUnitHighlighted(string id, bool highlighted)
        {
            if (unitVisuals.TryGetValue(id, out var visual) && visual.frame != null)
                visual.frame.color = new Color(1f, 1f, 1f, highlighted ? 1f : teamFrameAlpha);
        }

        /// <summary>範囲のマス（移動は半透明の青、攻撃は赤）を出す。空なら消す</summary>
        public void ShowRange(IEnumerable<Vector2Int> cells, Color? color = null)
        {
            foreach (var tile in rangeTiles) if (tile != null) Object.DestroyImmediate(tile);
            rangeTiles.Clear();
            if (cells == null) return;
            foreach (var cell in cells)
                rangeTiles.Add(AddFlat($"Range_{cell.x}_{cell.y}", SquareSprite(), map.TopCenter(cell) + Vector3.up * 0.01f, 1f - TileGap, color ?? RangeColor, OrderRange).gameObject);
        }

        /// <summary>倒れたキャラを盤面から消す</summary>
        public void RemoveUnit(string id)
        {
            if (!unitVisuals.TryGetValue(id, out var visual)) return;
            if (visual.billboard != null) visual.billboard.holder.gameObject.SetActive(false);
            foreach (var part in visual.footParts) part.gameObject.SetActive(false);
        }

        /// <summary>行動済みのキャラを暗くする</summary>
        public void SetUnitDimmed(string id, bool dimmed)
        {
            if (!unitVisuals.TryGetValue(id, out var visual) || visual.billboard == null) return;
            var renderer = visual.billboard.sprite.GetComponent<SpriteRenderer>();
            if (renderer != null) renderer.color = dimmed ? new Color(0.5f, 0.5f, 0.55f, 1f) : Color.white;
        }

        /// <summary>そのキャラの頭の上の画面位置（ダメージの数字などを出す）</summary>
        public Vector3 UnitHeadToScreen(string id)
        {
            if (!unitVisuals.TryGetValue(id, out var visual) || targetCamera == null) return Vector3.zero;
            var top = map.TopCenter(visual.unit.cell) + Vector3.up * unitHeight;
            return targetCamera.WorldToScreenPoint(transform.TransformPoint(top));
        }

        public int RangeCount => rangeTiles.Count;

        // ── 地面の絵・板の絵 ──

        /// <summary>地面に寝かせた絵（足元の影・陣営の枠・範囲）。size はマスに対する幅</summary>
        private SpriteRenderer AddFlat(string objectName, Sprite sprite, Vector3 position, float size, Color tint, int order)
        {
            var flat = new GameObject(objectName).AddComponent<SpriteRenderer>();
            flat.transform.SetParent(boardRoot, false);
            flat.transform.localPosition = position;
            flat.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            flat.transform.localScale = Vector3.one * size;
            flat.sprite = sprite;
            flat.color = tint;
            flat.sortingOrder = order;
            flat.sharedMaterial = SpriteMaterial();
            return flat;
        }

        /// <summary>丸い影（中心が濃く、外へ消える）。1ユニット四方</summary>
        private Sprite ShadowSprite()
        {
            if (shadowSprite == null)
                shadowSprite = RadialSprite(r => new Color(0.03f, 0.02f, 0.05f, 0.6f * Mathf.Clamp01(1f - r) * Mathf.Clamp01(1f - r)));
            return shadowSprite;
        }

        /// <summary>細い輪（色は後から付ける）。1ユニット四方</summary>
        private Sprite RingSprite()
        {
            if (ringSprite == null)
                ringSprite = RadialSprite(r => new Color(1f, 1f, 1f, Mathf.Clamp01(1f - Mathf.Abs(r - 0.86f) / 0.08f)));
            return ringSprite;
        }

        /// <summary>白い正方形（色は後から付ける）。1ユニット四方</summary>
        private Sprite SquareSprite()
        {
            if (squareSprite == null)
            {
                var tex = new Texture2D(4, 4, TextureFormat.RGBA32, false);
                var pixels = new Color[16];
                for (int i = 0; i < pixels.Length; i++) pixels[i] = Color.white;
                tex.SetPixels(pixels);
                tex.Apply();
                squareSprite = Sprite.Create(tex, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f), 4);
            }
            return squareSprite;
        }

        private static Sprite RadialSprite(Func<float, Color> colorAt)
        {
            const int n = 128;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            var pixels = new Color[n * n];
            for (int y = 0; y < n; y++)
            for (int x = 0; x < n; x++)
            {
                float dx = (x + 0.5f) / n * 2f - 1f, dy = (y + 0.5f) / n * 2f - 1f;
                pixels[y * n + x] = colorAt(Mathf.Sqrt(dx * dx + dy * dy));
            }
            tex.SetPixels(pixels);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), n);
        }

        /// <summary>板に貼った絵を立てる。足元（絵の下端の中央）が position に来る</summary>
        private Billboard AddBillboard(string objectName, Sprite sprite, Vector3 position, float height, bool fitCell = false, float footFromPivot = 0f)
        {
            var holder = new GameObject(objectName).transform;
            holder.SetParent(boardRoot, false);
            holder.localPosition = position;
            var spriteRenderer = new GameObject("Sprite").AddComponent<SpriteRenderer>();
            spriteRenderer.transform.SetParent(holder, false);
            spriteRenderer.sprite = sprite;
            spriteRenderer.sharedMaterial = SpriteMaterial();
            spriteRenderer.sortingOrder = OrderCharacter;
            float scale = height / Mathf.Max(0.01f, sprite.bounds.size.y);
            spriteRenderer.transform.localScale = Vector3.one * scale;
            spriteRenderer.transform.localPosition = Vector3.down * (footFromPivot * height);
            var billboard = new Billboard { holder = holder, sprite = spriteRenderer.transform, height = height, scale = scale, fitCell = fitCell, footFromPivot = footFromPivot };
            billboards.Add(billboard);
            return billboard;
        }

        /// <summary>
        /// 板の絵を、カメラと同じ向きにする（どの角度から見ても正面を向く）。
        /// キャラは、真上に近づくほど「足元を基準に立つ絵」から「マスの中央に収まる駒の絵」へ変える
        /// （真上では板が寝るので、足元を基準のままだと絵が奥のマスへはみ出す。原作者 2026-09-26）
        /// </summary>
        public void UpdateBillboards()
        {
            if (targetCamera == null) return;
            var rotation = targetCamera.transform.rotation;
            float t = Mathf.InverseLerp(tiltPitch, 90f, pitch);
            t = t * t * (3f - 2f * t);
            foreach (var b in billboards)
            {
                if (b.holder == null) continue;
                b.holder.rotation = rotation;
                if (!b.fitCell) continue;
                float height = Mathf.Lerp(b.height, topViewUnitSize, t);
                b.sprite.localScale = Vector3.one * (b.scale * height / b.height);
                // 立っているときは足の裏をマスの面に、真上では絵の中心をマスの中央へ
                b.sprite.localPosition = Vector3.down * Mathf.Lerp(b.footFromPivot * height, height * 0.5f, t);
            }
            // 狙われている印はゆっくり明滅する
            float pulse = 0.7f + 0.3f * Mathf.Sin(Time.realtimeSinceStartup * 5.5f);
            foreach (var visual in unitVisuals.Values)
                if (visual.targetRing != null && visual.targetRing.gameObject.activeSelf)
                    visual.targetRing.color = new Color(TargetRingColor.r, TargetRingColor.g, TargetRingColor.b, pulse);
        }

        private void LateUpdate() => UpdateBillboards();

        // ── 木・明かり・印 ──

        /// <summary>仮の木（3Dの模型）: 幹と、重ねた3つの葉の塊</summary>
        private void AddModelTree(Vector2Int cell)
        {
            var root = new GameObject("Tree_Model").transform;
            root.SetParent(boardRoot, false);
            root.localPosition = map.TopCenter(cell);
            if (!map.InBounds(cell))
            {
                // 景色の木は、大きさと向きを少しずつ変える
                float h = Board3DScenery.Hash(cell.y, cell.x);
                root.localScale = Vector3.one * (0.8f + 0.45f * h);
                root.localRotation = Quaternion.Euler(0f, h * 360f, 0f);
                root.localPosition += new Vector3((h - 0.5f) * 0.3f, 0f, (Board3DScenery.Hash(cell.x + 7, cell.y) - 0.5f) * 0.3f);
            }
            var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Object.DestroyImmediate(trunk.GetComponent<Collider>());
            trunk.transform.SetParent(root, false);
            trunk.transform.localScale = new Vector3(0.18f, 0.5f, 0.18f);
            trunk.transform.localPosition = new Vector3(0, 0.5f, 0);
            trunk.GetComponent<Renderer>().sharedMaterial = textured && TextureMaterial("side_earth") != null
                ? TextureMaterial("side_earth") : LitMaterial(new Color32(74, 52, 36, 255));
            var crowns = new[] { (0.9f, 1.05f), (0.7f, 1.5f), (0.48f, 1.9f) };   // 針葉樹（高さ2.0前後）
            foreach (var (width, y) in crowns)
            {
                var crown = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                Object.DestroyImmediate(crown.GetComponent<Collider>());
                crown.transform.SetParent(root, false);
                crown.transform.localScale = new Vector3(width, width * 0.8f, width);
                crown.transform.localPosition = new Vector3(0, y, 0);
                crown.GetComponent<Renderer>().sharedMaterial = textured && TextureMaterial("top_moss") != null
                    ? TextureMaterial("top_moss") : LitMaterial(new Color32(46, 78, 50, 255));
            }
        }

        /// <summary>
        /// 監視門（マップ担当の高い物の表 2026-09-27）: 2本の柱と上の梁を、マスの奥の辺（盤面の外側の縁）に立てる。
        /// 門の下は通れる（キャラが立つマスの中心をふさがない）。たいまつ2本は左右の柱に付け、門の光を足元に置く
        /// </summary>
        private void AddGate(Vector2Int cell)
        {
            var root = new GameObject($"Gate_{cell.x}_{cell.y}").transform;
            root.SetParent(boardRoot, false);
            root.localPosition = map.TopCenter(cell) + new Vector3(0f, 0f, 0.42f);   // 奥の辺（行0の側＝+z）
            float h = Board3DMap.GateHeight;
            var stone = textured && TextureMaterial("side_stone") != null ? TextureMaterial("side_stone") : LitMaterial(new Color32(120, 112, 104, 255));
            var wood = textured && TextureMaterial("top_bridge") != null ? TextureMaterial("top_bridge") : LitMaterial(new Color32(96, 64, 44, 255));
            foreach (float x in new[] { -0.42f, 0.42f })
            {
                AddBox(root, "Pillar", new Vector3(x, h * 0.5f, 0f), new Vector3(0.16f, h, 0.16f), stone);
                // たいまつ: 柱の内側の面（マスの中心の側）に付ける
                var flameAt = new Vector3(x * 0.78f, h * 0.62f, -0.12f);
                var flame = AddBox(root, "TorchFlame", flameAt, new Vector3(0.1f, 0.14f, 0.1f), GlowMaterial(new Color(1f, 0.5f, 0.16f), 2.2f));
                flame.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                AddBox(root, "TorchHolder", flameAt + new Vector3(0f, -0.12f, 0.03f), new Vector3(0.05f, 0.12f, 0.05f), LitMaterial(new Color32(60, 40, 30, 255)));
                if (lanterns)
                    AddPointLight($"GateTorch_{cell.x}_{cell.y}_{(x < 0 ? "L" : "R")}", root.localPosition + flameAt + new Vector3(0f, 0.1f, -0.15f), new Color32(255, 150, 72, 255), 3.4f, 2.6f);
            }
            AddBox(root, "Beam", new Vector3(0f, h + 0.06f, 0f), new Vector3(1.08f, 0.16f, 0.24f), wood);
            AddBox(root, "Cap", new Vector3(0f, h + 0.2f, 0f), new Vector3(1.2f, 0.1f, 0.34f), stone);
            if (lanterns)
                AddPointLight($"GateGlow_{cell.x}_{cell.y}", map.TopCenter(cell) + Vector3.up * 0.6f, new Color32(255, 214, 150, 255), 2.6f, 1.6f);
        }

        /// <summary>橋の欄干: マスの左右の辺（列の向きの両側）に、低い柱と手すり（高さ0.3）</summary>
        private void AddRailings(Vector2Int cell)
        {
            var root = new GameObject($"Railing_{cell.x}_{cell.y}").transform;
            root.SetParent(boardRoot, false);
            root.localPosition = map.TopCenter(cell);
            var wood = textured && TextureMaterial("top_bridge") != null ? TextureMaterial("top_bridge") : LitMaterial(new Color32(96, 64, 44, 255));
            foreach (float x in new[] { -0.45f, 0.45f })
            {
                foreach (float z in new[] { -0.4f, 0.4f })
                    AddBox(root, "Post", new Vector3(x, 0.15f, z), new Vector3(0.07f, 0.3f, 0.07f), wood);
                AddBox(root, "Rail", new Vector3(x, 0.27f, 0f), new Vector3(0.05f, 0.05f, 0.96f), wood);
            }
        }

        private static GameObject AddBox(Transform parent, string objectName, Vector3 localPosition, Vector3 size, Material material)
        {
            var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = objectName;
            Object.DestroyImmediate(box.GetComponent<Collider>());
            box.transform.SetParent(parent, false);
            box.transform.localPosition = localPosition;
            box.transform.localScale = size;
            box.GetComponent<Renderer>().sharedMaterial = material;
            return box;
        }

        /// <summary>仮の木（板に貼った絵）。キャラと同じく常にカメラの方を向く</summary>
        private void AddPictureTree(Vector2Int cell)
        {
            if (treeSprite == null) return;
            AddBillboard("Tree_Picture", treeSprite, map.TopCenter(cell), 2.4f);
        }

        /// <summary>仮のたいまつ: 細い柱の上に光る炎と、橙の点の光（原作の背景素材の「暗い中のはっきりした光」）</summary>
        private void AddTorch(Vector2Int cell)
        {
            var root = new GameObject($"Torch_{cell.x}_{cell.y}").transform;
            root.SetParent(boardRoot, false);
            root.localPosition = map.TopCenter(cell) + new Vector3(0f, 0f, 0.3f);
            var post = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Object.DestroyImmediate(post.GetComponent<Collider>());
            post.transform.SetParent(root, false);
            post.transform.localScale = new Vector3(0.08f, 0.32f, 0.08f);
            post.transform.localPosition = new Vector3(0f, 0.32f, 0f);
            post.GetComponent<Renderer>().sharedMaterial = LitMaterial(new Color32(60, 40, 30, 255));
            var flame = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Object.DestroyImmediate(flame.GetComponent<Collider>());
            flame.transform.SetParent(root, false);
            flame.transform.localScale = new Vector3(0.16f, 0.22f, 0.16f);
            flame.transform.localPosition = new Vector3(0f, 0.72f, 0f);
            flame.GetComponent<Renderer>().sharedMaterial = GlowMaterial(new Color(1f, 0.5f, 0.16f), 2.2f);
            flame.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            AddPointLight($"TorchLight_{cell.x}_{cell.y}", root.localPosition + new Vector3(0f, 0.8f, 0f), new Color32(255, 150, 72, 255), 3.4f, 2.8f);
        }

        private void AddPointLight(string objectName, Vector3 localPosition, Color color, float range, float intensity)
        {
            var light = new GameObject(objectName).AddComponent<Light>();
            light.transform.SetParent(boardRoot, false);
            light.transform.localPosition = localPosition;
            light.type = LightType.Point;
            light.color = color;
            light.range = range;
            light.intensity = intensity;
            light.shadows = LightShadows.None;
        }

        /// <summary>自分で光る材質（光のにじみ＝ブルームで周りに光が広がる）</summary>
        private static Material GlowMaterial(Color color, float strength)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var material = new Material(shader) { color = color };
            material.EnableKeyword("_EMISSION");
            material.globalIlluminationFlags = MaterialGlobalIlluminationFlags.None;
            if (material.HasProperty("_EmissionColor")) material.SetColor("_EmissionColor", color * strength);
            return material;
        }

        /// <summary>目的地点・道標の位置に平たい印を置く（試作の国境監視路）</summary>
        private void AddMarker(Vector2Int cell)
        {
            char m = map.MarkerAt(cell);
            if (m == '.' || m == 'A' || m == 'E' || m == 'C') return;   // 駒の位置にはキャラを立てる
            Color color = m == 'G' ? new Color32(214, 167, 64, 255) : new Color32(236, 226, 200, 255);
            float diameter = m == 'G' ? 0.72f : 0.32f;
            var disc = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            disc.name = $"Marker_{m}_{cell.x}_{cell.y}";
            Object.DestroyImmediate(disc.GetComponent<Collider>());
            disc.transform.SetParent(boardRoot, false);
            disc.transform.localScale = new Vector3(diameter, 0.03f, diameter);
            // 道標は、マスの中心ではなく奥の辺の近くに置く（そのマスに立つキャラと重ならない。マップ担当 2026-09-27）
            disc.transform.localPosition = map.TopCenter(cell) + Vector3.up * 0.03f + (m == 'S' ? new Vector3(0f, 0f, 0.3f) : Vector3.zero);
            disc.GetComponent<Renderer>().sharedMaterial = LitMaterial(color);
            disc.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;   // 薄い印の影はギザギザになる
            if (m == 'G')
            {
                // 目的地点は、中に小さな印を重ねて見分ける
                var inner = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                Object.DestroyImmediate(inner.GetComponent<Collider>());
                inner.transform.SetParent(disc.transform, false);
                inner.transform.localScale = new Vector3(0.45f, 1.6f, 0.45f);
                inner.GetComponent<Renderer>().sharedMaterial = LitMaterial(new Color32(24, 20, 30, 255));
                inner.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
        }

        // ── 模様を貼ったマス（T5） ──

        // 模様の割り当ては、マップ担当の地形の表（2026-09-27）のとおり
        private string TopTextureName(Vector2Int cell)
        {
            if (map.IsWall(cell)) return "top_wall";
            // 景色の茂み・下草は、森の地面として苔の模様（清書では top_thicket）
            if (map.IsScenery(cell) && (map.TerrainAt(cell) == 't' || map.TerrainAt(cell) == 'g')) return "top_moss";
            return map.TerrainAt(cell) switch
            {
                'c' => "top_wall",
                's' => "top_stone",
                'd' => "top_dirt",
                'g' => "top_moss",
                '=' => "top_bridge",
                '~' => "top_water",
                'o' => "top_rubble",
                '#' => "top_wall",
                _ => "top_dark",   // t 密な茂み（清書で top_thicket に分けてもよい）
            };
        }

        private string SideTextureName(Vector2Int cell)
        {
            if (map.IsWall(cell)) return "side_stone";
            char t = map.TerrainAt(cell);
            return t == '~' || t == '=' || t == 'o' || t == '#' || t == 'c' ? "side_stone" : "side_earth";
        }

        /// <summary>天面と側面に別の模様を貼ったマスのブロック。天面の模様はマスごとに90°ずつ回して、繰り返しを目立たなくする</summary>
        private GameObject BuildTexturedTile(Vector2Int cell)
        {
            float top = map.TopHeight(cell);
            float height = top + TileHeight;
            var tile = new GameObject($"Tile_{cell.x}_{cell.y}");
            tile.transform.SetParent(boardRoot, false);
            tile.transform.localPosition = map.TopCenter(cell);
            int turnUv = (cell.x * 7 + cell.y * 13) % 4;
            tile.AddComponent<MeshFilter>().sharedMesh = BlockMesh(1f - TileGap, height, turnUv);
            tile.AddComponent<MeshRenderer>().sharedMaterials = new[]
            {
                TextureMaterial(TopTextureName(cell)),
                TextureMaterial(SideTextureName(cell)),
            };
            var box = tile.AddComponent<BoxCollider>();
            box.size = new Vector3(1f - TileGap, height, 1f - TileGap);
            box.center = new Vector3(0f, -height * 0.5f, 0f);
            return tile;
        }

        /// <summary>天面（部分0）と4つの側面（部分1）だけの箱。天面は y=0、底は y=-height。側面の模様は高さ1ごとに繰り返す</summary>
        private static Mesh BlockMesh(float width, float height, int turnUv)
        {
            float h = width * 0.5f;
            var vertices = new List<Vector3>();
            var normals = new List<Vector3>();
            var uvs = new List<Vector2>();
            var topTris = new List<int>();
            var sideTris = new List<int>();

            Vector2 Turn(Vector2 uv)
            {
                for (int i = 0; i < turnUv; i++) uv = new Vector2(1f - uv.y, uv.x);
                return uv;
            }
            void Quad(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector3 normal, Vector2 ua, Vector2 ub, Vector2 uc, Vector2 ud, List<int> tris)
            {
                int start = vertices.Count;
                vertices.AddRange(new[] { a, b, c, d });
                normals.AddRange(new[] { normal, normal, normal, normal });
                uvs.AddRange(new[] { ua, ub, uc, ud });
                tris.AddRange(new[] { start, start + 1, start + 2, start, start + 2, start + 3 });
            }

            // 天面（上から見て時計回り）
            Quad(new Vector3(-h, 0, -h), new Vector3(-h, 0, h), new Vector3(h, 0, h), new Vector3(h, 0, -h), Vector3.up,
                Turn(new Vector2(0, 0)), Turn(new Vector2(0, 1)), Turn(new Vector2(1, 1)), Turn(new Vector2(1, 0)), topTris);
            // 側面: 模様の上端（v=1）を天面にそろえる
            float vb = 1f - height;
            var sides = new (Vector3 normal, Vector3 left, Vector3 right)[]
            {
                (Vector3.back, new Vector3(-h, 0, -h), new Vector3(h, 0, -h)),
                (Vector3.right, new Vector3(h, 0, -h), new Vector3(h, 0, h)),
                (Vector3.forward, new Vector3(h, 0, h), new Vector3(-h, 0, h)),
                (Vector3.left, new Vector3(-h, 0, h), new Vector3(-h, 0, -h)),
            };
            foreach (var (normal, left, right) in sides)
            {
                var down = Vector3.down * height;
                Quad(left + down, left, right, right + down, normal,
                    new Vector2(0, vb), new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, vb), sideTris);
            }

            var mesh = new Mesh { name = "Block" };
            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.subMeshCount = 2;
            mesh.SetTriangles(topTris, 0);
            mesh.SetTriangles(sideTris, 1);
            mesh.RecalculateBounds();
            return mesh;
        }

        private Material TextureMaterial(string name)
        {
            if (texturedMaterials.TryGetValue(name, out var cached)) return cached;
            Texture2D texture = null;
            foreach (var entry in boardTextures) if (entry.name == name) texture = entry.texture;
            if (texture == null) return null;
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var material = new Material(shader) { mainTexture = texture };
            if (material.HasProperty("_BaseMap")) material.SetTexture("_BaseMap", texture);
            if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", 0.05f);
            texturedMaterials[name] = material;
            return material;
        }

        /// <summary>選んだマスの枠（明るい4本の棒）</summary>
        private GameObject BuildSelectionFrame()
        {
            var frame = new GameObject("Selection");
            frame.transform.SetParent(boardRoot, false);
            var material = UnlitMaterial(new Color32(150, 215, 255, 255));
            const float w = 0.08f, len = 1f, h = 0.05f;
            for (int i = 0; i < 4; i++)
            {
                var bar = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.DestroyImmediate(bar.GetComponent<Collider>());
                bar.transform.SetParent(frame.transform, false);
                bool alongX = i < 2;
                float offset = (len - w) * 0.5f * (i % 2 == 0 ? 1 : -1);
                bar.transform.localScale = alongX ? new Vector3(len, h, w) : new Vector3(w, h, len);
                bar.transform.localPosition = alongX ? new Vector3(0, h * 0.5f, offset) : new Vector3(offset, h * 0.5f, 0);
                bar.GetComponent<Renderer>().sharedMaterial = material;
                bar.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            return frame;
        }

        private Material LitMaterial(Color color)
        {
            if (litMaterials.TryGetValue(color, out var cached)) return cached;
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var material = new Material(shader) { color = color };
            if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", 0.1f);
            litMaterials[color] = material;
            return material;
        }

        private static Material UnlitMaterial(Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color");
            var material = new Material(shader);
            if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
            material.color = color;
            return material;
        }

        private Material SpriteMaterial()
        {
            if (spriteMaterial != null) return spriteMaterial;
            var shader = Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default") ?? Shader.Find("Sprites/Default");
            spriteMaterial = new Material(shader);
            return spriteMaterial;
        }

        // ── マスを押す・選ぶ ──

        /// <summary>画面上の位置にあるマスを調べる（3Dのブロックに当たるか）</summary>
        public bool TryPickCell(Vector2 screenPosition, out Vector2Int cell)
        {
            cell = default;
            if (targetCamera == null) return false;
            Physics.SyncTransforms();
            var ray = targetCamera.ScreenPointToRay(screenPosition);
            // 手前から順に見て、最初に当たったマスかキャラ（キャラならそのキャラのマス）
            foreach (var hit in Physics.RaycastAll(ray, 200f).OrderBy(h => h.distance))
            {
                if (unitBodies.TryGetValue(hit.collider, out var visual) && hit.collider.gameObject.activeInHierarchy)
                {
                    cell = visual.unit.cell;
                    return true;
                }
                foreach (var pair in tiles)
                {
                    if (pair.Value != hit.collider.gameObject) continue;
                    cell = pair.Key;
                    return true;
                }
            }
            return false;
        }

        /// <summary>画面上の位置のマスを選ぶ（確認用）</summary>
        public bool PickAtScreen(Vector2 screenPosition)
        {
            if (!TryPickCell(screenPosition, out var cell)) return false;
            Select(cell);
            return true;
        }

        /// <summary>画面上のそのマスの位置（押したことにする確認用）</summary>
        public Vector3 CellToScreen(Vector2Int cell) =>
            targetCamera.WorldToScreenPoint(transform.TransformPoint(map.TopCenter(cell)));

        public void Select(Vector2Int cell)
        {
            if (!map.InBounds(cell)) return;
            Selected = cell;
            selectionFrame.SetActive(true);
            selectionFrame.transform.localPosition = map.TopCenter(cell) + Vector3.up * 0.01f;
        }

        public void ClearSelection()
        {
            Selected = null;
            if (selectionFrame != null) selectionFrame.SetActive(false);
        }

        private void Tap(Vector2 screenPosition)
        {
            if (!TryPickCell(screenPosition, out var cell)) return;
            if (CellTapped != null) CellTapped(cell);
            else Select(cell);
        }

        // ── カメラ ──

        /// <summary>
        /// 真上／斜めと、向きを決める。turnIndex は45°ずつ（0＝基本の斜め、1＝正面、2＝次の斜め…）。
        /// 真上では90°ずつにそろえる（マスの縦横を画面の縦横に合わせる）。immediate なら動きなしで切り替える
        /// </summary>
        public void SetView(bool tiltedView, int turnIndex, bool immediate = false)
        {
            tilted = tiltedView;
            turn = ((turnIndex % 8) + 8) % 8;
            toPitch = tilted ? tiltPitch : 90f;
            // 斜めの基本の向きは、今までの2Dの斜めの絵と同じ（列0・行0の角が奥）。turn 1 で正面（行が画面の横にそろう）
            float targetYaw = tilted ? turn * 45f - 45f : (turn / 2) * 90f;
            toYaw = yaw + Mathf.DeltaAngle(yaw, targetYaw);
            toSize = overview ? FitSize(toPitch, toYaw) : closeSize;
            toFocus = overview ? Vector3.zero : ClampFocus(closeFocus);
            StartCameraMove(immediate);
        }

        private void StartCameraMove(bool immediate)
        {
            if (immediate || turnSeconds <= 0f || !Application.isPlaying)
            {
                pitch = toPitch; yaw = toYaw; size = toSize; focus = toFocus;
                moveTime = -1f;
                ApplyCamera();
                return;
            }
            fromPitch = pitch; fromYaw = yaw; fromSize = size; fromFocus = focus;
            moveTime = 0f;
        }

        /// <summary>全体（盤面がまるごと入る）と寄り（横に約10マス）を切り替える</summary>
        public void SetOverview(bool on, bool immediate = false)
        {
            overview = on;
            SetView(tilted, turn, immediate);
        }

        /// <summary>そのマスを画面に入れる（寄りのとき。全体のときは覚えておくだけ）</summary>
        public void FocusOn(Vector2Int cell, bool immediate = false) => FocusOnPoint(map.TopCenter(cell), immediate);

        public void FocusOnPoint(Vector3 point, bool immediate = false)
        {
            closeFocus = ClampFocus(point);
            if (overview) return;
            toFocus = closeFocus;
            if (moveTime >= 0f && !immediate) return;   // 回している途中なら、その動きのまま寄る先だけ変える
            toPitch = pitch; toYaw = yaw; toSize = size;
            StartCameraMove(immediate);
        }

        /// <summary>
        /// 見ている所は、戦えるマスの少し内側から出さない（盤面の角に寄っても、景色の外が画面の角に見えないように）。
        /// 高さは天面の高さのまま
        /// </summary>
        private Vector3 ClampFocus(Vector3 point)
        {
            if (map == null) return point;
            float hx = Mathf.Max(0f, (map.Columns - 1) * 0.5f - 1.5f), hz = Mathf.Max(0f, (map.Rows - 1) * 0.5f - 1f);
            return new Vector3(Mathf.Clamp(point.x, -hx, hx), point.y, Mathf.Clamp(point.z, -hz, hz));
        }

        public void TurnBy(int steps) => SetView(tilted, turn + steps);
        public void ToggleTilt() => SetView(!tilted, turn);

        /// <summary>確認用: 回している途中の角度で止めて見る</summary>
        public void SetRawAngles(float pitchDegrees, float yawDegrees)
        {
            pitch = pitchDegrees; yaw = yawDegrees; size = FitSize(pitch, yaw);
            moveTime = -1f;
            ApplyCamera();
        }

        /// <summary>確認用: 盤面の一部に寄って見る（focus を画面の中心に、size は正投影の縦の半分）</summary>
        public void SetCloseView(float pitchDegrees, float yawDegrees, Vector3 focus, float orthoSize)
        {
            pitch = pitchDegrees; yaw = yawDegrees; size = orthoSize;
            moveTime = -1f;
            var rotation = Quaternion.Euler(pitch, yaw, 0f);
            targetCamera.orthographic = true;
            targetCamera.orthographicSize = size;
            targetCamera.transform.rotation = rotation;
            targetCamera.transform.position = transform.position + focus - rotation * Vector3.forward * 30f;
            if (keyLight != null) keyLight.transform.rotation = Quaternion.Euler(lightPitch, yaw + lightYawOffset, 0f);
            FitBackdrop();
            UpdateBillboards();
        }

        private void ApplyCamera()
        {
            if (targetCamera == null) return;
            var rotation = Quaternion.Euler(pitch, yaw, 0f);
            targetCamera.orthographic = true;
            targetCamera.orthographicSize = size;
            targetCamera.transform.rotation = rotation;
            // 寄りのときは、見ている所を画面の少し上に置く（画面の下にユニットのカードや戦闘予測が出るため）
            var aim = transform.position + focus - rotation * Vector3.up * (size * focusRaise * (1f - OverviewBlend()));
            targetCamera.transform.position = aim - rotation * Vector3.forward * 30f;
            targetCamera.nearClipPlane = 0.1f;
            targetCamera.farClipPlane = 80f;
            // 光もカメラと一緒に回す（どの向きから見ても、同じ側が明るい。原作者 2026-09-26）
            if (keyLight != null) keyLight.transform.rotation = Quaternion.Euler(lightPitch, yaw + lightYawOffset, 0f);
            FitBackdrop();
            UpdateBillboards();
        }

        // 全体のときは見ている所を上げない（0＝寄り、1＝全体）
        private float OverviewBlend() => overview ? 1f : 0f;

        /// <summary>いちばん奥の背景（M1）: カメラに付けた画面いっぱいの絵。霧を受けないようUIの絵として描く</summary>
        private void AddBackdrop()
        {
            if (backdrop == null || targetCamera == null) return;
            var canvasObject = new GameObject("Backdrop", typeof(Canvas));
            canvasObject.transform.SetParent(transform, false);
            var canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = targetCamera;
            canvas.planeDistance = 70f;
            canvas.sortingOrder = -100;
            var image = new GameObject("Image", typeof(RectTransform), typeof(UnityEngine.UI.RawImage));
            image.transform.SetParent(canvasObject.transform, false);
            image.GetComponent<UnityEngine.UI.RawImage>().texture = backdrop;
            image.GetComponent<UnityEngine.UI.RawImage>().raycastTarget = false;
            backdropRect = image.GetComponent<RectTransform>();
            backdropRect.anchorMin = Vector2.zero;
            backdropRect.anchorMax = Vector2.one;
            backdropRect.offsetMin = backdropRect.offsetMax = Vector2.zero;
        }

        /// <summary>背景の絵の縦横比を保って画面を覆う</summary>
        private void FitBackdrop()
        {
            if (backdropRect == null || backdrop == null || targetCamera == null) return;
            float screenAspect = targetCamera.aspect > 0f ? targetCamera.aspect : 844f / 390f;
            float imageAspect = (float)backdrop.width / backdrop.height;
            float sx = Mathf.Max(1f, imageAspect / screenAspect), sy = Mathf.Max(1f, screenAspect / imageAspect);
            backdropRect.anchorMin = new Vector2(0.5f - sx * 0.5f, 0.5f - sy * 0.5f);
            backdropRect.anchorMax = new Vector2(0.5f + sx * 0.5f, 0.5f + sy * 0.5f);
        }

        /// <summary>盤面全体が画面に入る大きさ（正投影の縦の半分）</summary>
        private float FitSize(float pitchDegrees, float yawDegrees)
        {
            var rotation = Quaternion.Inverse(Quaternion.Euler(pitchDegrees, yawDegrees, 0f));
            float halfW = 0f, halfH = 0f;
            int columns = map != null ? map.Columns : Board3DLayout.Columns;
            int rows = map != null ? map.Rows : Board3DLayout.Rows;
            float hx = columns * 0.5f, hz = rows * 0.5f;
            float top = Mathf.Max(map != null ? map.MaxHeight : 0f, unitHeight) + 0.4f, bottom = -TileHeight - BaseHeight;
            foreach (float x in new[] { -hx, hx })
            foreach (float z in new[] { -hz, hz })
            foreach (float y in new[] { top, bottom })
            {
                var p = rotation * new Vector3(x, y, z);
                halfW = Mathf.Max(halfW, Mathf.Abs(p.x));
                halfH = Mathf.Max(halfH, Mathf.Abs(p.y));
            }
            float aspect = targetCamera != null && targetCamera.aspect > 0f ? targetCamera.aspect : 844f / 390f;
            return Mathf.Max(halfH, halfW / aspect) * 1.1f;
        }

        // ── 操作 ──

        private void Update()
        {
            if (moveTime >= 0f)
            {
                moveTime += Time.deltaTime;
                float t = Mathf.Clamp01(moveTime / turnSeconds);
                t = t * t * (3f - 2f * t);
                pitch = Mathf.Lerp(fromPitch, toPitch, t);
                yaw = Mathf.Lerp(fromYaw, toYaw, t);
                size = Mathf.Lerp(fromSize, toSize, t);
                focus = Vector3.Lerp(fromFocus, toFocus, t);
                ApplyCamera();
                if (t >= 1f) moveTime = -1f;
            }

            var keyboard = Keyboard.current;
            if (keyboard != null)
            {
                if (keyboard.qKey.wasPressedThisFrame) TurnBy(tilted ? -1 : -2);
                if (keyboard.eKey.wasPressedThisFrame) TurnBy(tilted ? 1 : 2);
                if (keyboard.tKey.wasPressedThisFrame) ToggleTilt();
                if (keyboard.fKey.wasPressedThisFrame) SetOverview(!overview);
            }

            // 寄りのときは、ホイールで寄る・引く
            var mouse = Mouse.current;
            if (mouse != null && !overview)
            {
                float scroll = mouse.scroll.ReadValue().y;
                if (Mathf.Abs(scroll) > 0.01f)
                {
                    CloseSize -= Mathf.Sign(scroll) * 0.4f;
                    size = toSize = closeSize;
                    ApplyCamera();
                }
            }

            var pointer = Pointer.current;
            if (pointer == null) return;
            var position = pointer.position.ReadValue();
            if (pointer.press.wasPressedThisFrame)
            {
                if (IsOverButtons(position)) return;
                pressing = true;
                dragging = false;
                pressPosition = lastDrag = position;
            }
            else if (pressing && pointer.press.isPressed && !overview)
            {
                // 寄りのときは、指でずらして見回す（回すのはボタン・Q/E）
                if (!dragging && (position - pressPosition).magnitude > TapPixels) dragging = true;
                if (dragging) PanByScreen(position - lastDrag);
                lastDrag = position;
            }
            if (pressing && pointer.press.wasReleasedThisFrame)
            {
                pressing = false;
                var delta = position - pressPosition;
                if (dragging) dragging = false;
                else if (overview && Mathf.Abs(delta.x) >= SwipePixels && Mathf.Abs(delta.x) > Mathf.Abs(delta.y))
                    TurnBy((delta.x > 0 ? 1 : -1) * (tilted ? 1 : 2));
                else if (delta.magnitude <= TapPixels)
                    Tap(position);
            }
        }

        /// <summary>画面上で動かした分だけ、見ている所をずらす（指に地面が付いてくるように）</summary>
        public void PanByScreen(Vector2 screenDelta)
        {
            if (targetCamera == null || map == null) return;
            float unitsPerPixel = 2f * size / Mathf.Max(1f, targetCamera.pixelHeight);
            var rotation = Quaternion.Euler(pitch, yaw, 0f);
            var right = rotation * Vector3.right; right.y = 0f; right.Normalize();
            var up = rotation * Vector3.up; up.y = 0f;
            if (up.sqrMagnitude < 1e-4f) up = rotation * Vector3.forward;
            up.y = 0f; up.Normalize();
            float sin = Mathf.Max(0.3f, Mathf.Sin(pitch * Mathf.Deg2Rad));
            focus = ClampFocus(focus - right * screenDelta.x * unitsPerPixel - up * screenDelta.y * unitsPerPixel / sin);
            toFocus = closeFocus = focus;
            moveTime = -1f;
            ApplyCamera();
        }

        // ── 画面のボタン（試作用。正式なUIは別） ──

        private float GuiScale => Mathf.Max(1f, Screen.height / 390f);

        private Rect ButtonArea => new Rect(Screen.width / GuiScale - 326f, 390f - 48f, 316f, 38f);

        /// <summary>ほかの画面の部品（戦闘の操作の欄など）の上を押したときは、マスを押したことにしない</summary>
        public Func<Vector2, bool> IsOverOtherGui;

        private bool IsOverButtons(Vector2 screenPosition)
        {
            if (IsOverOtherGui != null && IsOverOtherGui(screenPosition)) return true;
            if (!showGuiButtons) return false;
            var guiPoint = new Vector2(screenPosition.x, Screen.height - screenPosition.y) / GuiScale;
            return ButtonArea.Contains(guiPoint);
        }

        private Font guiFont;

        private void OnGUI()
        {
            if (!showGuiButtons || map == null) return;
            // 簡易ボタンの字体には日本語が入っていないので、端末の日本語の字体を使う
            if (guiFont == null)
                guiFont = Font.CreateDynamicFontFromOSFont(new[] { "Yu Gothic UI", "Meiryo", "MS Gothic", "Hiragino Sans", "Noto Sans CJK JP" }, 14);
            GUI.skin.font = guiFont;
            float s = GuiScale;
            GUI.matrix = Matrix4x4.Scale(new Vector3(s, s, 1f));
            var area = ButtonArea;
            if (GUI.Button(new Rect(area.x, area.y, 60f, area.height), tilted ? "◀ 45°" : "◀ 90°")) TurnBy(tilted ? -1 : -2);
            if (GUI.Button(new Rect(area.x + 66f, area.y, 108f, area.height), tilted ? "真上から見る" : "斜めから見る")) ToggleTilt();
            if (GUI.Button(new Rect(area.x + 180f, area.y, 60f, area.height), tilted ? "45° ▶" : "90° ▶")) TurnBy(tilted ? 1 : 2);
            if (GUI.Button(new Rect(area.x + 246f, area.y, 70f, area.height), overview ? "寄る" : "全体")) SetOverview(!overview);

            if (showCellInfo)
            {
                string info = Selected.HasValue
                    ? $"列{Selected.Value.x}・行{Selected.Value.y}　{Board3DMap.TerrainName(map.TerrainAt(Selected.Value))}"
                    : "マスを押すと選べます";
                GUI.Label(new Rect(10f, 8f, 400f, 24f), info);
            }

            // 向きの表示: 行0の側（盤面の奥）を「北」として矢印で出す
            if (targetCamera != null)
            {
                var center = targetCamera.WorldToScreenPoint(transform.position);
                var north = targetCamera.WorldToScreenPoint(transform.position + Vector3.forward);
                var dir = new Vector2(north.x - center.x, north.y - center.y);
                float angle = -Mathf.Atan2(dir.x, dir.y) * Mathf.Rad2Deg;
                var pivot = new Vector2(34f, 390f - 34f);
                var saved = GUI.matrix;
                GUIUtility.RotateAroundPivot(-angle, pivot * s);
                GUI.Label(new Rect(pivot.x - 12f, pivot.y - 22f, 24f, 20f), "▲");
                GUI.matrix = saved;
                GUI.Label(new Rect(pivot.x - 8f, pivot.y - 2f, 40f, 20f), "北");
            }
        }
    }
}
