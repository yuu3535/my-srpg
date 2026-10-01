using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Srpg.Battle
{
    /// <summary>
    /// 箱庭の作り込み 段B（城の部品。原作者 2026-10-01）: 配置表の地形（壁 W・柱 P・扉 D・下草 g）から、城の部品をコードで組み立てる。
    ///   ・外側の壁の上の凸凹（胸壁）／四すみの塔（とがった屋根）／門の両わきの塔
    ///   ・2マスの厚みの壁（兵舎など）は建物にして、切妻の屋根・窓・石の台座
    ///   ・扉（木の扉・金の縁・アーチ）／内側を向く壁の窓（枠・窓台・うっすら灯り）／壁の根元の石の台座（下ほど暗い）
    ///   ・下草のマスの植え込み（茂みと花）
    /// カメラ側の壁を切るとき（断面の見せ方）、その壁の部品も隠す（castleDecor）。まずは箱庭の場所（訓練場）だけ
    /// </summary>
    public partial class Board3DView
    {
        // 壁のマス → その壁に付けた部品（断面で壁を切るときに隠す）
        private readonly Dictionary<Vector2Int, List<GameObject>> castleDecor = new Dictionary<Vector2Int, List<GameObject>>();

        private static readonly Vector2Int[] Dirs = { Vector2Int.right, Vector2Int.left, Vector2Int.up, Vector2Int.down };

        /// <summary>マスの向き（列+1＝世界の+x、行+1＝世界の−z）を世界の向きへ</summary>
        private static Vector3 World(Vector2Int d) => new Vector3(d.x, 0f, -d.y);

        private bool IsTallWall(Vector2Int c) => map.InBounds(c) && !map.IsVoid(c) && map.TopHeight(c) >= 1.0f;
        private bool IsFloor(Vector2Int c) => map.InBounds(c) && TerrainRules.CanEnter(map.TerrainAt(c), false);
        private bool OnEdge(Vector2Int c) => c.x == 0 || c.y == 0 || c.x == map.Columns - 1 || c.y == map.Rows - 1;

        private void Decor(Vector2Int cell, GameObject go)
        {
            if (!castleDecor.TryGetValue(cell, out var list)) castleDecor[cell] = list = new List<GameObject>();
            list.Add(go);
        }

        private Transform DecorRoot(Vector2Int cell, string label)
        {
            var root = new GameObject($"Castle_{label}_{cell.x}_{cell.y}").transform;
            root.SetParent(boardRoot, false);
            root.localPosition = map.CellCenter(cell);
            Decor(cell, root.gameObject);
            return root;
        }

        /// <summary>城の部品を組み立てる（Setup の最後。箱庭の場所だけ）</summary>
        private void BuildCastleParts()
        {
            castleDecor.Clear();
            var stone = LitMaterial(new Color32(92, 86, 104, 255));
            var stoneDark = LitMaterial(new Color32(58, 52, 68, 255));
            var slate = LitMaterial(new Color32(54, 48, 72, 255));
            var wood = LitMaterial(new Color32(74, 46, 30, 255));
            var gold = GlowMaterial(new Color(0.85f, 0.62f, 0.22f), 0.12f);
            var glass = GlowMaterial(new Color(1f, 0.66f, 0.32f), 0.9f);
            var glassDark = LitMaterial(new Color32(26, 20, 36, 255));
            int windowCount = 0;

            // 建物（2マスの厚みの壁）: 内側に床・外側（盤面の端）に壁のマス
            var building = new HashSet<Vector2Int>();
            for (int y = 0; y < map.Rows; y++)
            for (int x = 0; x < map.Columns; x++)
            {
                var c = new Vector2Int(x, y);
                if (!IsTallWall(c) || OnEdge(c)) continue;
                foreach (var d in Dirs)
                    if (IsFloor(c - d) && IsTallWall(c + d) && OnEdge(c + d) && !IsTallWall(c - d * 2 + d))
                    {
                        building.Add(c);
                        building.Add(c + d);
                    }
            }

            for (int y = 0; y < map.Rows; y++)
            for (int x = 0; x < map.Columns; x++)
            {
                var c = new Vector2Int(x, y);
                char t = map.TerrainAt(c);
                if (t == 'g' && !map.IsObstacle(c)) AddBushes(c);
                if (t == 'D') AddDoor(c, wood, gold, stoneDark);
                if (!IsTallWall(c)) continue;
                float top = map.TopHeight(c);
                TintStone(c);

                // 内側（床の側）を向く面
                var inward = new List<Vector2Int>();
                foreach (var d in Dirs) if (IsFloor(c + d)) inward.Add(d);

                // 壁の根元の石の台座（内側の面。下ほど暗い）
                foreach (var d in inward)
                {
                    var root = DecorRoot(c, "Plinth");
                    var face = World(d) * 0.5f;
                    var plinth = AddBox(root, "Plinth", face * 0.98f + new Vector3(0f, 0.16f, 0f), Abs(World(d)) * 0.08f + Abs(World(Perp(d))) * 1.0f + new Vector3(0f, 0.32f, 0f), stoneDark);
                    plinth.transform.localPosition += World(d) * 0.04f;
                    AddGrime(c, d, top);
                }

                if (building.Contains(c))
                {
                    // 建物: 切妻の屋根（壁の並びに沿って棟）。内側の面に窓
                    var along = IsTallWall(c + Vector2Int.up) || IsTallWall(c + Vector2Int.down) ? Vector2Int.up : Vector2Int.right;
                    var root = DecorRoot(c, "Roof");
                    AddGableRoof(root, top, along, slate);
                    // 煙突: 建物の並びの中ほどに1本（棟の上）
                    if (OnEdge(c) && (c.x + c.y) % 7 == 3)
                    {
                        AddBox(root, "Chimney", new Vector3(0f, top + 0.62f, 0f), new Vector3(0.24f, 0.7f, 0.24f), stoneDark);
                        AddBox(root, "ChimneyCap", new Vector3(0f, top + 1.0f, 0f), new Vector3(0.32f, 0.06f, 0.32f), stone);
                    }
                    foreach (var d in inward)
                        if ((c.x + c.y) % 2 == 0) AddWindow(c, d, top, wood, (windowCount++ % 3) == 0 ? glass : glassDark, stone);
                    continue;
                }

                // 柱（門のわき）: 高い塔ととがった屋根
                if (t == 'P')
                {
                    var root = DecorRoot(c, "GateTower");
                    AddBox(root, "Body", new Vector3(0f, top + 0.45f, 0f), new Vector3(0.96f, 0.9f, 0.96f), stone);
                    AddPyramid(root, new Vector3(0f, top + 0.9f, 0f), 1.1f, 1.2f, slate);
                    AddBox(root, "Finial", new Vector3(0f, top + 2.15f, 0f), new Vector3(0.08f, 0.2f, 0.08f), gold);
                    continue;
                }

                // 四すみの塔
                bool corner = (c.x == 0 || c.x == map.Columns - 1) && (c.y == 0 || c.y == map.Rows - 1);
                if (corner)
                {
                    var root = DecorRoot(c, "CornerTower");
                    AddBox(root, "Body", new Vector3(0f, top + 0.6f, 0f), new Vector3(1.16f, 1.2f, 1.16f), stone);
                    AddBox(root, "Rim", new Vector3(0f, top + 1.24f, 0f), new Vector3(1.3f, 0.1f, 1.3f), stoneDark);
                    AddPyramid(root, new Vector3(0f, top + 1.28f, 0f), 1.32f, 1.6f, slate);
                    AddBox(root, "Finial", new Vector3(0f, top + 2.95f, 0f), new Vector3(0.08f, 0.24f, 0.08f), gold);
                    continue;
                }

                // 外側の壁: 上の凸凹（胸壁）。盤面の端の側に2つの歯
                if (OnEdge(c))
                {
                    var outward = c.x == 0 ? Vector2Int.left : c.x == map.Columns - 1 ? Vector2Int.right : c.y == 0 ? Vector2Int.down : Vector2Int.up;
                    var root = DecorRoot(c, "Merlons");
                    var side = World(Perp(outward));
                    var edge = World(outward) * 0.36f;
                    foreach (float s in new[] { -0.25f, 0.25f })
                        AddBox(root, "Merlon", edge + side * s + new Vector3(0f, top + 0.16f, 0f), Abs(side) * 0.3f + Abs(World(outward)) * 0.24f + new Vector3(0f, 0.32f, 0f), stone);
                    // 内側を向く壁: 3マスおきに窓、4マスおきに燭台（窓と重ならない所）
                    foreach (var d in inward)
                    {
                        if ((c.x + c.y) % 3 == 1) AddWindow(c, d, top, wood, (windowCount++ % 4) == 0 ? glass : glassDark, stone);
                        else if ((c.x + c.y) % 4 == 0) AddSconce(c, d, top);
                    }
                }
            }
        }

        private static Vector2Int Perp(Vector2Int d) => new Vector2Int(-d.y, d.x);
        private static Vector3 Abs(Vector3 v) => new Vector3(Mathf.Abs(v.x), Mathf.Abs(v.y), Mathf.Abs(v.z));

        /// <summary>窓: 壁の内側の面に、枠・ガラス（灯りか暗いか）・窓台・上の小さなアーチ</summary>
        private void AddWindow(Vector2Int cell, Vector2Int d, float top, Material frame, Material pane, Material stone)
        {
            var root = DecorRoot(cell, "Window");
            var n = World(d);
            var side = Abs(World(Perp(d)));
            var face = n * 0.5f;
            float cy = Mathf.Min(top - 0.55f, 1.0f);
            AddBox(root, "Frame", face + n * 0.02f + new Vector3(0f, cy, 0f), side * 0.42f + Abs(n) * 0.04f + new Vector3(0f, 0.6f, 0f), frame);
            AddBox(root, "Pane", face + n * 0.045f + new Vector3(0f, cy, 0f), side * 0.32f + Abs(n) * 0.02f + new Vector3(0f, 0.48f, 0f), pane);
            AddBox(root, "Mullion", face + n * 0.06f + new Vector3(0f, cy, 0f), side * 0.03f + Abs(n) * 0.02f + new Vector3(0f, 0.48f, 0f), frame);
            AddBox(root, "Sill", face + n * 0.07f + new Vector3(0f, cy - 0.32f, 0f), side * 0.5f + Abs(n) * 0.1f + new Vector3(0f, 0.05f, 0f), stone);
            AddBox(root, "Lintel", face + n * 0.05f + new Vector3(0f, cy + 0.34f, 0f), side * 0.5f + Abs(n) * 0.06f + new Vector3(0f, 0.07f, 0f), stone);
        }

        /// <summary>扉: 床の側から見て奥の辺（壁の並び）に、木の扉・金の縁と鋲・石のアーチ</summary>
        private void AddDoor(Vector2Int cell, Material wood, Material gold, Material stone)
        {
            // 扉を立てる向き: 盤面の外の側（なければ壁のある側）
            Vector2Int back = Vector2Int.zero;
            foreach (var d in Dirs) if (!map.InBounds(cell + d)) back = d;
            if (back == Vector2Int.zero) foreach (var d in Dirs) if (IsTallWall(cell + d) && !IsTallWall(cell - d)) back = d;
            if (back == Vector2Int.zero) return;
            var root = DecorRoot(cell, "Door");
            var n = World(back);
            var side = Abs(World(Perp(back)));
            var face = n * 0.42f;
            AddBox(root, "Leaf", face + new Vector3(0f, 0.62f, 0f), side * 0.78f + Abs(n) * 0.08f + new Vector3(0f, 1.24f, 0f), wood);
            AddBox(root, "Seam", face - n * 0.045f + new Vector3(0f, 0.62f, 0f), side * 0.03f + Abs(n) * 0.02f + new Vector3(0f, 1.2f, 0f), gold);
            foreach (float h in new[] { 0.3f, 0.95f })
                AddBox(root, "Band", face - n * 0.045f + new Vector3(0f, h, 0f), side * 0.74f + Abs(n) * 0.02f + new Vector3(0f, 0.05f, 0f), gold);
            AddBox(root, "Arch", face - n * 0.02f + new Vector3(0f, 1.34f, 0f), side * 0.98f + Abs(n) * 0.16f + new Vector3(0f, 0.2f, 0f), stone);
            foreach (float s in new[] { -0.46f, 0.46f })
                AddBox(root, "Jamb", face - n * 0.02f + World(Perp(back)) * s + new Vector3(0f, 0.67f, 0f), side * 0.1f + Abs(n) * 0.16f + new Vector3(0f, 1.34f, 0f), stone);
        }

        /// <summary>植え込み: 低い茂み（緑の丸）と紫・黄の花</summary>
        private void AddBushes(Vector2Int cell)
        {
            var root = DecorRoot(cell, "Bush");
            var leaf = LitMaterial(new Color32(58, 88, 52, 255));
            var leafDark = LitMaterial(new Color32(40, 66, 42, 255));
            var purple = GlowMaterial(new Color(0.62f, 0.4f, 0.9f), 0.25f);
            var yellow = GlowMaterial(new Color(0.95f, 0.85f, 0.45f), 0.2f);
            for (int i = 0; i < 4; i++)
            {
                float h = Board3DScenery.Hash(cell.x * 5 + i, cell.y * 3 + i);
                var p = new Vector3((h - 0.5f) * 0.6f, 0.16f + h * 0.08f, (Board3DScenery.Hash(cell.y + i, cell.x) - 0.5f) * 0.6f);
                float s = 0.34f + 0.16f * h;
                AddShape(root, PrimitiveType.Sphere, "Leaf", p, new Vector3(s, s * 0.8f, s), i % 2 == 0 ? leaf : leafDark);
                AddShape(root, PrimitiveType.Sphere, "Flower", p + new Vector3(0.05f, s * 0.38f, -0.04f), Vector3.one * 0.07f, i % 2 == 0 ? purple : yellow);
            }
        }

        /// <summary>切妻の屋根: 棟は along の向き。軒を少し出した屋根の板2枚と、棟の押さえ</summary>
        private void AddGableRoof(Transform root, float top, Vector2Int along, Material slate)
        {
            var a = World(along);
            var across = World(Perp(along));
            foreach (float s in new[] { -1f, 1f })
            {
                var panel = AddBox(root, "RoofPanel", across * (0.3f * s) + new Vector3(0f, top + 0.28f, 0f), Abs(a) * 1.02f + Abs(across) * 0.78f + new Vector3(0f, 0.06f, 0f), slate);
                // 棟の線（along）を軸に傾ける
                panel.transform.localRotation = Quaternion.AngleAxis(-s * 36f, a);
            }
            AddBox(root, "Ridge", new Vector3(0f, top + 0.52f, 0f), Abs(a) * 1.02f + Abs(across) * 0.1f + new Vector3(0f, 0.08f, 0f), LitMaterial(new Color32(40, 34, 54, 255)));
        }

        /// <summary>石の色むら: 壁のマスごとに明るさを少し変える（同じ材質のまま、マスごとの色の上書き）</summary>
        private void TintStone(Vector2Int cell)
        {
            if (!tiles.TryGetValue(cell, out var tile) || tile == null) return;
            var renderer = tile.GetComponent<Renderer>();
            if (renderer == null) return;
            float h = Board3DScenery.Hash(cell.x * 13 + 1, cell.y * 7 + 3);
            float v = 0.86f + 0.2f * h;
            var block = new MaterialPropertyBlock();
            renderer.GetPropertyBlock(block);
            block.SetColor("_BaseColor", new Color(v, v * 0.98f, v * 1.03f, 1f));
            renderer.SetPropertyBlock(block);
        }

        private static Sprite grimeSprite;

        /// <summary>汚れの絵（コードで描く）: 下ほど濃い黒ずみと、上から垂れる雨だれの筋</summary>
        private static Sprite GrimeSprite()
        {
            if (grimeSprite != null) return grimeSprite;
            const int W = 64, H = 128;
            var tex = new Texture2D(W, H, TextureFormat.RGBA32, false) { name = "WallGrime", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var px = new Color32[W * H];
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                float v = y / (float)(H - 1);               // 0＝下
                float bottom = Mathf.Pow(1f - v, 2.2f) * 0.55f;
                float streak = Mathf.PerlinNoise(x * 0.35f, 3.7f);
                float streakA = Mathf.Clamp01((streak - 0.55f) * 3f) * Mathf.Clamp01((0.95f - v) * 2f) * 0.35f;
                float blotch = Mathf.Clamp01((Mathf.PerlinNoise(x * 0.08f + 9f, y * 0.06f) - 0.6f) * 2f) * 0.25f;
                float a = Mathf.Clamp01(bottom + streakA + blotch);
                // 左右の端は薄く（となりのマスとつながって見えるように）
                a *= Mathf.Clamp01(Mathf.Min(x, W - 1 - x) / 6f);
                px[y * W + x] = new Color32(22, 16, 30, (byte)(a * 255));
            }
            tex.SetPixels32(px);
            tex.Apply();
            grimeSprite = Sprite.Create(tex, new Rect(0, 0, W, H), new Vector2(0.5f, 0f), H);
            return grimeSprite;
        }

        /// <summary>壁の内側の面に汚れを貼る（下ほど黒ずむ・雨だれ）</summary>
        private void AddGrime(Vector2Int cell, Vector2Int d, float top)
        {
            var root = DecorRoot(cell, "Grime");
            var sr = new GameObject("Grime").AddComponent<SpriteRenderer>();
            sr.transform.SetParent(root, false);
            var n = World(d);
            sr.transform.localPosition = n * 0.505f;
            // 板の表を床の側へ向ける（スプライトの表は −z を向く）
            sr.transform.localRotation = Quaternion.LookRotation(-n, Vector3.up);
            sr.transform.localScale = new Vector3(1f, top + 0.02f, 1f);
            sr.sprite = GrimeSprite();
            sr.sharedMaterial = SpriteMaterial();
            sr.sortingOrder = OrderShadow - 10;
        }

        /// <summary>壁の燭台: 金具と、ゆらぐ小さな炎（光は出さない。光の数を増やさないため）</summary>
        private void AddSconce(Vector2Int cell, Vector2Int d, float top)
        {
            var root = DecorRoot(cell, "Sconce");
            var n = World(d);
            float y = Mathf.Min(top - 0.45f, 1.05f);
            AddBox(root, "Bracket", n * 0.56f + new Vector3(0f, y, 0f), Abs(n) * 0.14f + Abs(World(Perp(d))) * 0.06f + new Vector3(0f, 0.06f, 0f), LitMaterial(new Color32(40, 34, 44, 255)));
            AddBox(root, "Cup", n * 0.62f + new Vector3(0f, y + 0.06f, 0f), new Vector3(0.1f, 0.06f, 0.1f), LitMaterial(new Color32(150, 112, 52, 255)));
            var flame = AddShape(root, PrimitiveType.Sphere, "Flame", n * 0.62f + new Vector3(0f, y + 0.15f, 0f), new Vector3(0.08f, 0.13f, 0.08f), GlowMaterial(new Color(1f, 0.55f, 0.2f), 2.4f));
            flame.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            flame.AddComponent<FlameFlicker>();
        }

        /// <summary>四角すいの屋根（底の中心 basePos、底の一辺 width、高さ height）</summary>
        private static void AddPyramid(Transform root, Vector3 basePos, float width, float height, Material material)
        {
            float h = width * 0.5f;
            var apex = basePos + Vector3.up * height;
            var c = new[] { basePos + new Vector3(-h, 0, -h), basePos + new Vector3(h, 0, -h), basePos + new Vector3(h, 0, h), basePos + new Vector3(-h, 0, h) };
            var verts = new List<Vector3>();
            var tris = new List<int>();
            for (int i = 0; i < 4; i++)
            {
                int n = verts.Count;
                verts.Add(c[i]); verts.Add(apex); verts.Add(c[(i + 1) % 4]);
                tris.Add(n); tris.Add(n + 1); tris.Add(n + 2);
            }
            var mesh = new Mesh { name = "Pyramid" };
            mesh.SetVertices(verts);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            var go = new GameObject("Roof");
            go.transform.SetParent(root, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial = material;
        }

        /// <summary>断面の見せ方で壁を切ったら、その壁の部品も隠す</summary>
        private void ShowCastleDecor(Vector2Int cell, bool visible)
        {
            if (!castleDecor.TryGetValue(cell, out var list)) return;
            foreach (var go in list) if (go != null) go.SetActive(visible);
        }
    }
}
