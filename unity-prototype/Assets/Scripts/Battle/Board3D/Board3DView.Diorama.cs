using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Srpg.Battle
{
    /// <summary>
    /// 箱庭の見せ方（試作。原作者 2026-10-01）: 場所を切り取った土台ごと、黒紫の霧の空間に浮かべる。
    /// 見本: docs/10-design/map/concepts/orcus_training_yard_diorama_concept_2026-10-01.webp
    ///   ・土台の下: 石の帯と、ぶら下がる土と岩のかたまり（コードで作る）
    ///   ・背景: 黒紫のグラデーション・雲・浮かぶ城の影（コードで描く。時間帯で色を変える。城の影は箱庭の飾り）
    ///   ・旗（はためく）・魔灯（ゆらぐ）
    /// まずは訓練場だけ（DioramaMaps）。よければほかの場所にも広げる
    /// </summary>
    public partial class Board3DView
    {
        private static readonly HashSet<string> DioramaMaps = new HashSet<string> { "orcus_training_yard" };
        private const float StoneBandHeight = 0.9f;   // 土台の下の石の帯の厚み
        private const float RockDepth = 6.5f;         // ぶら下がる岩のいちばん長い所

        /// <summary>箱庭の見せ方にする場所か</summary>
        public bool IsDiorama => map != null && map.FromLayoutFile && DioramaMaps.Contains(map.MapId ?? "");

        private Texture2D dioramaBackdrop;
        private bool cameraSaved;
        private CameraClearFlags savedClearFlags;
        private Color savedBackground;
        private string dioramaBackdropMood;

        /// <summary>背景に使う絵（箱庭ならコードで描いた絵、ほかは backdrop）</summary>
        private Texture2D CurrentBackdrop => IsDiorama ? DioramaBackdrop() : backdrop;

        // ── 土台の下 ──

        /// <summary>土台の下の石の帯と、ぶら下がる土と岩（3段の色で下ほど霧に溶ける）</summary>
        private void BuildIslandUnderside()
        {
            int cols = map.Columns, rows = map.Rows;
            float top = -TileHeight - BaseHeight + 0.02f;
            // 石の帯（土台の側面。黒い石）
            var band = GameObject.CreatePrimitive(PrimitiveType.Cube);
            band.name = "Island_StoneBand";
            Object.DestroyImmediate(band.GetComponent<Collider>());
            band.transform.SetParent(boardRoot, false);
            band.transform.localScale = new Vector3(cols + 0.1f, StoneBandHeight, rows + 0.1f);
            band.transform.localPosition = new Vector3(0f, top - StoneBandHeight * 0.5f, 0f);
            band.GetComponent<Renderer>().sharedMaterial = LitMaterial(new Color32(82, 76, 94, 255));
            // ぶら下がる土と岩: マスごとに先の細い柱。まん中ほど長い。上・中・下の3段で色を変える
            var bands = new[]
            {
                new List<Vector3>(), new List<Vector3>(), new List<Vector3>(),
            };
            var tris = new[] { new List<int>(), new List<int>(), new List<int>() };
            float rockTop = top - StoneBandHeight + 0.02f;
            float half = Mathf.Min(cols, rows) * 0.5f;
            // 大きなかたまり（2マスおき）と、すき間を埋める小さな岩。まん中ほど長く、端は短い
            var spots = new List<(float x, float y, float size)>();
            for (int r = 0; r < rows; r += 2)
            for (int c = 0; c < cols; c += 2) spots.Add((c + 1f, r + 1f, 2.3f));
            for (int r = 1; r < rows; r += 2)
            for (int c = 1; c < cols; c += 2) spots.Add((c + 0.5f, r + 0.5f, 1.2f));
            var origin = map.CellCenter(new Vector2Int(0, 0));
            foreach (var (sx, sy, size) in spots)
            {
                int c = Mathf.FloorToInt(sx), r = Mathf.FloorToInt(sy);
                float edge = Mathf.Min(Mathf.Min(sx, cols - sx), Mathf.Min(sy, rows - sy));
                float inner = Mathf.Clamp01(edge / half);
                float h = Board3DScenery.Hash(c * 3 + 11, r * 7 + 5);
                float length = (1.4f + RockDepth * (0.35f + 0.65f * Mathf.Pow(inner, 0.6f))) * (0.45f + 0.75f * h) * (size > 2f ? 1f : 0.6f);   // 端も長く（見本の絵: 縁の下にぶら下がる岩）
                // マス(0,0)の中心から、列は +x・行は −z（行が増えると手前）
                var center = origin + new Vector3(sx - 0.5f, 0f, -(sy - 0.5f));
                center.y = rockTop;
                center += new Vector3((Board3DScenery.Hash(c, r + 3) - 0.5f) * 0.5f, 0f, (Board3DScenery.Hash(c + 9, r) - 0.5f) * 0.5f);
                float w0 = size * (0.85f + 0.3f * Board3DScenery.Hash(r, c)), w3 = 0.08f;
                // 3段: 上35%・中35%・下30%
                float[] cut = { 0f, 0.35f, 0.7f, 1f };
                for (int s = 0; s < 3; s++)
                {
                    float y0 = center.y - length * cut[s], y1 = center.y - length * cut[s + 1];
                    float a = Mathf.Lerp(w0, w3, cut[s]), b = Mathf.Lerp(w0, w3, cut[s + 1]);
                    // 先へ行くほど少し横へずらす（まっすぐな円すいにしない）
                    var lean = new Vector3((Board3DScenery.Hash(c + 5, r) - 0.5f), 0f, (Board3DScenery.Hash(c, r + 5) - 0.5f)) * (length * 0.18f);
                    AddFrustum(bands[s], tris[s], new Vector3(center.x, y0, center.z) + lean * cut[s], a, new Vector3(center.x, y1, center.z) + lean * cut[s + 1], b, h * 360f);
                }
            }
            Color32[] colors = { new Color32(104, 78, 62, 255), new Color32(70, 52, 54, 255), new Color32(46, 36, 58, 255) };   // 土 → 暗い土 → 霧に溶ける岩
            for (int s = 0; s < 3; s++)
            {
                var mesh = new Mesh { name = $"IslandRocks_{s}", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
                mesh.SetVertices(bands[s]);
                mesh.SetTriangles(tris[s], 0);
                mesh.RecalculateNormals();
                mesh.RecalculateBounds();
                var go = new GameObject($"Island_Rocks_{s}");
                go.transform.SetParent(boardRoot, false);
                go.AddComponent<MeshFilter>().sharedMesh = mesh;
                go.AddComponent<MeshRenderer>().sharedMaterial = LitMaterial(colors[s]);
            }
        }

        /// <summary>6角の断面の、先の細くなる柱の1段（側面6枚。面ごとに頂点を分けて角を立てる。角ごとに太さを少し変えてごつごつさせる）</summary>
        private static void AddFrustum(List<Vector3> v, List<int> t, Vector3 top, float topWidth, Vector3 bottom, float bottomWidth, float yawDegrees)
        {
            var rot = Quaternion.Euler(0f, yawDegrees, 0f);
            const int sides = 6;
            Vector3 P(Vector3 c, float w, int i)
            {
                float ang = i * Mathf.PI * 2f / sides;
                float r = w * 0.5f * (0.82f + 0.36f * Board3DScenery.Hash(i * 3 + 1, Mathf.RoundToInt(yawDegrees)));
                return c + rot * new Vector3(Mathf.Cos(ang) * r, 0f, Mathf.Sin(ang) * r);
            }
            for (int i = 0; i < sides; i++)
            {
                int j = (i + 1) % sides, n = v.Count;
                v.Add(P(top, topWidth, i)); v.Add(P(top, topWidth, j)); v.Add(P(bottom, bottomWidth, j)); v.Add(P(bottom, bottomWidth, i));
                t.Add(n); t.Add(n + 2); t.Add(n + 1);
                t.Add(n); t.Add(n + 3); t.Add(n + 2);
            }
        }

        // ── 背景 ──

        /// <summary>
        /// 箱庭の背景の絵（コードで描く）: 上から下への黒紫のグラデーション・雲のむら・左右に浮かぶ城の影。
        /// 時間帯（Board3DMood.CurrentMood）が変わったら描き直す
        /// </summary>
        private Texture2D DioramaBackdrop()
        {
            string mood = Board3DMood.CurrentMood ?? Board3DMood.Dusk;
            if (dioramaBackdrop != null && dioramaBackdropMood == mood) return dioramaBackdrop;
            const int W = 1024, H = 512;
            if (dioramaBackdrop == null)
                dioramaBackdrop = new Texture2D(W, H, TextureFormat.RGBA32, false) { name = "DioramaBackdrop", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            dioramaBackdropMood = mood;
            var (topColor, bottomColor) = Board3DMood.VoidColors(mood);
            var pixels = new Color[W * H];
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                float v = y / (float)(H - 1);   // 0＝下、1＝上
                var col = Color.Lerp(bottomColor, topColor, Mathf.SmoothStep(0f, 1f, v));
                // 雲のむら（明るい霧と暗い霧）
                float n = Mathf.PerlinNoise(x * 0.006f + 3.1f, y * 0.015f + 7.7f) * 0.65f + Mathf.PerlinNoise(x * 0.02f, y * 0.045f) * 0.35f;
                col = Color.Lerp(col, Color.Lerp(col, topColor * 1.25f, 0.6f), Mathf.Clamp01((n - 0.5f) * 1.6f));
                col = Color.Lerp(col, bottomColor * 0.7f, Mathf.Clamp01((0.42f - n) * 1.4f));
                // 四隅の暗さ（盤面の仕上げと同じ。背景は仕上げのあとに描くので、絵に入れておく）
                float vx = (x / (float)(W - 1) - 0.5f) * 1.25f, vy = v - 0.5f;
                float vig = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(0.42f, 0.9f, Mathf.Sqrt(vx * vx + vy * vy)));
                col = Color.Lerp(col, new Color(col.r * 0.62f, col.g * 0.55f, col.b * 0.72f), vig);
                pixels[y * W + x] = new Color(col.r, col.g, col.b, 1f);
            }
            // 浮かぶ城の影（箱庭の飾り。原作者 2026-10-01: 残す）。遠いほど霧の色に近い
            var silhouette = Color.Lerp(bottomColor, topColor, 0.28f) * 0.82f;
            DrawFloatingCastle(pixels, W, H, 104, 140, 2.0f, silhouette, 0.55f);
            DrawFloatingCastle(pixels, W, H, 220, 380, 1.2f, silhouette, 0.35f);
            DrawFloatingCastle(pixels, W, H, 904, 120, 1.8f, silhouette, 0.5f);
            DrawFloatingCastle(pixels, W, H, 796, 400, 1.1f, silhouette, 0.3f);
            DrawFloatingCastle(pixels, W, H, 36, 428, 0.9f, silhouette, 0.25f);
            dioramaBackdrop.SetPixels(pixels);
            dioramaBackdrop.Apply();
            return dioramaBackdrop;
        }

        /// <summary>浮かぶ城の影: 逆さの岩のかたまりの上に、塔（とがった屋根）が並ぶ。cx・baseY は絵の上の位置（下が0）</summary>
        private static void DrawFloatingCastle(Color[] pixels, int w, int h, int cx, int baseY, float scale, Color color, float alpha)
        {
            void Blend(int x, int y)
            {
                if (x < 0 || y < 0 || x >= w || y >= h) return;
                var p = pixels[y * w + x];
                pixels[y * w + x] = Color.Lerp(p, new Color(color.r, color.g, color.b, 1f), alpha);
            }
            int rockW = Mathf.RoundToInt(46 * scale), rockH = Mathf.RoundToInt(30 * scale);
            // 逆さの岩（下へ細くなる）
            for (int dy = 0; dy < rockH; dy++)
            {
                float t = dy / (float)rockH;
                int half = Mathf.RoundToInt(rockW * 0.5f * (1f - t) * (0.85f + 0.15f * Mathf.Sin(dy * 0.9f)));
                for (int dx = -half; dx <= half; dx++) Blend(cx + dx, baseY - dy);
            }
            // 塔: 位置・高さ・幅（scale 倍）
            var towers = new[] { (-16, 22, 7), (-6, 34, 8), (5, 26, 6), (14, 18, 6), (-22, 12, 5) };
            foreach (var (ox, th, tw) in towers)
            {
                int x0 = cx + Mathf.RoundToInt(ox * scale), height = Mathf.RoundToInt(th * scale), half = Mathf.Max(1, Mathf.RoundToInt(tw * scale * 0.5f));
                for (int dy = 0; dy < height; dy++)
                for (int dx = -half; dx <= half; dx++) Blend(x0 + dx, baseY + dy);
                int roof = Mathf.RoundToInt(half * 2.6f);
                for (int dy = 0; dy < roof; dy++)
                {
                    int rh = Mathf.RoundToInt(half * (1f - dy / (float)roof));
                    for (int dx = -rh; dx <= rh; dx++) Blend(x0 + dx, baseY + height + dy);
                }
            }
            // 城壁（塔のあいだ）
            int wallH = Mathf.RoundToInt(10 * scale), wallHalf = Mathf.RoundToInt(20 * scale);
            for (int dy = 0; dy < wallH; dy++)
            for (int dx = -wallHalf; dx <= wallHalf; dx++) Blend(cx + dx, baseY + dy);
        }

        /// <summary>時間帯が変わったとき: 背景の絵・カメラの地の色・霧の色を箱庭の色に合わせる</summary>
        private void RefreshDiorama()
        {
            ApplyFinishing();
            if (!IsDiorama)
            {
                // 箱庭でない場所に戻ったら、カメラの地の色を元に戻す
                if (cameraSaved && targetCamera != null) { targetCamera.clearFlags = savedClearFlags; targetCamera.backgroundColor = savedBackground; }
                return;
            }
            if (!cameraSaved && targetCamera != null) { savedClearFlags = targetCamera.clearFlags; savedBackground = targetCamera.backgroundColor; cameraSaved = true; }
            var (topColor, bottomColor) = Board3DMood.VoidColors(Board3DMood.CurrentMood);
            if (targetCamera != null)
            {
                targetCamera.clearFlags = CameraClearFlags.SolidColor;
                targetCamera.backgroundColor = Color.Lerp(bottomColor, topColor, 0.4f);
            }
            // 霧は背景の色に寄せる（ぶら下がる岩の先が霧に溶ける）
            RenderSettings.fogColor = Color.Lerp(bottomColor, topColor, 0.35f);
            var image = backdropRect != null ? backdropRect.GetComponent<UnityEngine.UI.RawImage>() : null;
            if (image != null) image.texture = DioramaBackdrop();
            else AddBackdrop();
            FitBackdrop();
        }

        /// <summary>
        /// 画面の仕上げ（段A。Srpg/DioramaComposite）の強さと色合い。箱庭の場所だけ効かせる。
        /// 色合いは時間帯で変える（暗い所・明るい所の色。原作者 2026-10-01: 光は時間で変える）
        /// </summary>
        private void ApplyFinishing()
        {
            Shader.SetGlobalFloat("_DioramaFX", IsDiorama ? 1f : 0f);
            if (!IsDiorama) return;
            string mood = Board3DMood.CurrentMood;
            var (shadow, light) = mood switch
            {
                Board3DMood.Morning => (new Vector4(0.93f, 0.92f, 1.04f, 1f), new Vector4(1.05f, 1.03f, 0.97f, 1f)),
                Board3DMood.Day => (new Vector4(0.95f, 0.94f, 1.03f, 1f), new Vector4(1.04f, 1.02f, 0.98f, 1f)),
                Board3DMood.Night => (new Vector4(0.84f, 0.88f, 1.12f, 1f), new Vector4(1.0f, 0.98f, 1.04f, 1f)),
                _ => (new Vector4(0.9f, 0.82f, 1.06f, 1f), new Vector4(1.08f, 1.0f, 0.9f, 1f)),   // 夕暮れ: 影は紫、灯りは温かく
            };
            Shader.SetGlobalVector("_DioramaShadowTint", shadow);
            Shader.SetGlobalVector("_DioramaLightTint", light);
            // SDの絵に合わせて、線は太く濃く（SDの絵の輪郭と同じ濃い紫）
            Shader.SetGlobalVector("_DioramaLineColor", new Vector4(0.13f, 0.07f, 0.18f, 0.88f));
            Shader.SetGlobalFloat("_DioramaLineWidth", 1.6f);
            // 箱庭の塗り（Srpg/DioramaToon）の影の色: 紫に寄せる。夕暮れ・夜は濃く
            Vector4 shade = mood switch
            {
                Board3DMood.Morning => new Vector4(0.8f, 0.76f, 0.96f, 1f),
                Board3DMood.Day => new Vector4(0.82f, 0.79f, 0.95f, 1f),
                Board3DMood.Night => new Vector4(0.62f, 0.62f, 0.96f, 1f),
                _ => new Vector4(0.72f, 0.62f, 0.93f, 1f),
            };
            Shader.SetGlobalVector("_ToonShadeTint", shade);
        }

        // ── 旗・魔灯 ──

        /// <summary>紋章の旗: 黒い旗竿（金の先）と横木から下がる紫の布（金の縁と紋章）。布ははためく</summary>
        private void AddBannerModel(MapProp prop, Vector3 offset)
        {
            var root = new GameObject($"Banner_{prop.id}").transform;
            root.SetParent(boardRoot, false);
            root.localPosition = map.TopCenter(prop.Cell) + offset;
            var metal = LitMaterial(new Color32(36, 30, 42, 255));
            var gold = GlowMaterial(new Color(0.85f, 0.62f, 0.22f), 0.15f);
            const float poleH = 2.6f;
            AddBox(root, "Pole", new Vector3(0f, poleH * 0.5f, 0f), new Vector3(0.07f, poleH, 0.07f), metal);
            AddBox(root, "Finial", new Vector3(0f, poleH + 0.07f, 0f), new Vector3(0.1f, 0.14f, 0.1f), gold);
            AddBox(root, "Bar", new Vector3(0f, poleH - 0.12f, 0f), new Vector3(0.84f, 0.06f, 0.06f), metal);
            // 布（横 0.56・縦 1.05。上の辺が横木）。細かく分けた板にして、頂点を動かしてはためかせる
            var cloth = new GameObject("Cloth");
            cloth.transform.SetParent(root, false);
            cloth.transform.localPosition = new Vector3(0f, poleH - 0.14f, 0.04f);
            var mesh = BannerMesh(0.76f, 1.45f, 6, 12);
            cloth.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = cloth.AddComponent<MeshRenderer>();
            var material = LitMaterial(Color.white);
            material = new Material(material) { mainTexture = BannerTexture() };
            if (material.HasProperty("_BaseMap")) material.SetTexture("_BaseMap", BannerTexture());
            if (material.HasProperty("_Cull")) material.SetFloat("_Cull", 0f);   // 両面
            renderer.sharedMaterial = material;
            var wave = cloth.AddComponent<BannerWave>();
            wave.Setup(mesh, Board3DScenery.Hash(prop.Cell.x, prop.Cell.y) * 6f);
            RegisterOccluder(root.gameObject);   // キャラを隠すときは半透明（壁・天幕と同じ）
        }

        /// <summary>旗の布の板: 上の辺が y=0、下へ height。x は −width/2〜width/2</summary>
        private static Mesh BannerMesh(float width, float height, int nx, int ny)
        {
            var verts = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();
            for (int j = 0; j <= ny; j++)
            for (int i = 0; i <= nx; i++)
            {
                float u = i / (float)nx, v = j / (float)ny;
                // 下の端はとがらせる（旗の先が三角）
                float tip = j == ny ? (1f - Mathf.Abs(u - 0.5f) * 2f) * 0.12f : 0f;
                verts.Add(new Vector3((u - 0.5f) * width, -v * height - tip, 0f));
                uvs.Add(new Vector2(u, 1f - v));
            }
            for (int j = 0; j < ny; j++)
            for (int i = 0; i < nx; i++)
            {
                int a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
                tris.Add(a); tris.Add(b); tris.Add(c);
                tris.Add(b); tris.Add(d); tris.Add(c);
            }
            var mesh = new Mesh { name = "Banner" };
            mesh.SetVertices(verts);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        private static Texture2D bannerTexture;

        /// <summary>旗の布の絵（コードで描く）: 濃い紫の地・金の縁・金の紋章（ツノの蛇と翼を簡単にした形）</summary>
        private static Texture2D BannerTexture()
        {
            if (bannerTexture != null) return bannerTexture;
            const int W = 64, H = 128;
            bannerTexture = new Texture2D(W, H, TextureFormat.RGBA32, false) { name = "BannerCloth", filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var purple = new Color32(84, 36, 116, 255);
            var dark = new Color32(56, 22, 80, 255);
            var gold = new Color32(214, 166, 72, 255);
            var px = new Color32[W * H];
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                bool border = x < 3 || x >= W - 3 || y >= H - 4 || y < 2;
                bool inner = x == 6 || x == W - 7;
                var c = border ? gold : inner ? dark : purple;
                // 紋章: 中央の縦の蛇（波）と、左右に3枚ずつの翼、上に冠
                float cx = W * 0.5f + Mathf.Sin(y * 0.22f) * 4f;
                if (y > 34 && y < 98 && Mathf.Abs(x - cx) < 2.2f) c = gold;
                for (int k = 0; k < 3; k++)
                {
                    int wy = 76 - k * 10;
                    if (y >= wy - 2 && y <= wy && Mathf.Abs(x - W * 0.5f) > 4 && Mathf.Abs(x - W * 0.5f) < 22 - k * 4) c = gold;
                }
                if (y >= 100 && y <= 106 && Mathf.Abs(x - W * 0.5f) < 9 && (y > 102 || (x % 5) < 2)) c = gold;
                px[y * W + x] = c;
            }
            bannerTexture.SetPixels32(px);
            bannerTexture.Apply();
            return bannerTexture;
        }

        // ── 置いてある物の形（箱庭の試作。種類の名前から形を選ぶ。ほかの場所は今までの箱） ──

        /// <summary>種類の名前に合う形を作れたら true（人形・樽と木箱・武器立て・机）</summary>
        private bool TryAddShapedObject(Transform root, string kind, float height)
        {
            var wood = LitMaterial(new Color32(118, 82, 52, 255));
            var darkWood = LitMaterial(new Color32(78, 52, 34, 255));
            var iron = LitMaterial(new Color32(70, 66, 78, 255));
            if (kind.Contains("人形"))
            {
                // 稽古の人形: 柱・横木の腕・わらの胴・丸い頭
                float s = height / 1.0f;
                AddBox(root, "Post", new Vector3(0f, 0.45f * s, 0f), new Vector3(0.1f, 0.9f * s, 0.1f), darkWood);
                AddBox(root, "Arms", new Vector3(0f, 0.68f * s, 0f), new Vector3(0.62f * s, 0.08f, 0.08f), darkWood);
                AddBox(root, "Body", new Vector3(0f, 0.6f * s, 0f), new Vector3(0.3f * s, 0.34f * s, 0.24f * s), LitMaterial(new Color32(176, 146, 92, 255)));
                AddShape(root, PrimitiveType.Sphere, "Head", new Vector3(0f, 0.92f * s, 0f), new Vector3(0.22f, 0.22f, 0.22f) * s, LitMaterial(new Color32(186, 156, 104, 255)));
                AddBox(root, "Foot", new Vector3(0f, 0.03f, 0f), new Vector3(0.36f, 0.06f, 0.36f), darkWood);
                return true;
            }
            if (kind.Contains("樽") || kind.Contains("木箱"))
            {
                AddShape(root, PrimitiveType.Cylinder, "Barrel", new Vector3(-0.14f, 0.28f, 0.1f), new Vector3(0.34f, 0.28f, 0.34f), wood);
                AddShape(root, PrimitiveType.Cylinder, "Hoop", new Vector3(-0.14f, 0.42f, 0.1f), new Vector3(0.36f, 0.02f, 0.36f), iron);
                AddShape(root, PrimitiveType.Cylinder, "Hoop2", new Vector3(-0.14f, 0.14f, 0.1f), new Vector3(0.36f, 0.02f, 0.36f), iron);
                if (kind.Contains("木箱"))
                    AddBox(root, "Crate", new Vector3(0.18f, 0.17f, -0.14f), new Vector3(0.34f, 0.34f, 0.34f), darkWood);
                return true;
            }
            if (kind.Contains("武器立て"))
            {
                AddBox(root, "Base", new Vector3(0f, 0.04f, 0f), new Vector3(0.74f, 0.08f, 0.26f), darkWood);
                AddBox(root, "Rail", new Vector3(0f, 0.62f, 0f), new Vector3(0.74f, 0.06f, 0.08f), darkWood);
                foreach (float x in new[] { -0.34f, 0.34f })
                    AddBox(root, "Leg", new Vector3(x, 0.34f, 0f), new Vector3(0.06f, 0.68f, 0.06f), darkWood);
                for (int i = 0; i < 4; i++)
                {
                    var stick = AddBox(root, "Weapon", new Vector3(-0.24f + i * 0.16f, 0.46f, 0.04f), new Vector3(0.035f, 0.86f, 0.035f), i % 2 == 0 ? iron : wood);
                    stick.transform.localRotation = Quaternion.Euler(8f, 0f, (i - 1.5f) * 3f);
                }
                return true;
            }
            if (kind.Contains("机"))
            {
                AddBox(root, "Top", new Vector3(0f, 0.6f, 0f), new Vector3(0.78f, 0.06f, 0.5f), wood);
                foreach (var (x, z) in new[] { (-0.34f, -0.2f), (0.34f, -0.2f), (-0.34f, 0.2f), (0.34f, 0.2f) })
                    AddBox(root, "Leg", new Vector3(x, 0.3f, z), new Vector3(0.06f, 0.6f, 0.06f), darkWood);
                if (kind.Contains("兜"))
                    AddShape(root, PrimitiveType.Sphere, "Helm", new Vector3(-0.12f, 0.72f, 0f), new Vector3(0.2f, 0.18f, 0.2f), iron);
                return true;
            }
            return false;
        }

        /// <summary>天幕（箱庭）: 手前の2本の柱と、とがった紫の屋根（布）。1マスずつ並べて長い天幕に見せる</summary>
        private void AddTentModel(Transform root, float height)
        {
            var cloth = LitMaterial(new Color32(92, 40, 122, 255));
            var pole = LitMaterial(new Color32(60, 44, 34, 255));
            foreach (var (x, z) in new[] { (-0.44f, -0.44f), (0.44f, -0.44f) })
                AddBox(root, "Pole", new Vector3(x, height * 0.5f, z), new Vector3(0.06f, height, 0.06f), pole);
            // 屋根: 前後へ下がる2枚の板（とがった形）
            foreach (float side in new[] { -1f, 1f })
            {
                var panel = AddBox(root, "Roof", new Vector3(0f, height + 0.22f, side * 0.26f), new Vector3(1.02f, 0.05f, 0.62f), cloth);
                panel.transform.localRotation = Quaternion.Euler(side * 32f, 0f, 0f);
            }
            AddBox(root, "Valance", new Vector3(0f, height - 0.02f, -0.52f), new Vector3(1.02f, 0.16f, 0.03f), LitMaterial(new Color32(196, 150, 64, 255)));
        }

        private static GameObject AddShape(Transform parent, PrimitiveType type, string objectName, Vector3 localPosition, Vector3 size, Material material)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = objectName;
            Object.DestroyImmediate(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPosition;
            go.transform.localScale = size;
            go.GetComponent<Renderer>().sharedMaterial = material;
            return go;
        }

        /// <summary>魔灯（紫）・ランタン（暖色）の台: 石の台と、光る火の芯。光はゆらぐ</summary>
        private void AddLampModel(Vector3 localPosition, Color color, bool magic)
        {
            var root = new GameObject(magic ? "MagicLamp" : "Lantern").transform;
            root.SetParent(boardRoot, false);
            root.localPosition = localPosition;
            var stone = LitMaterial(new Color32(58, 52, 66, 255));
            if (magic)
            {
                AddBox(root, "Base", new Vector3(0f, 0.12f, 0f), new Vector3(0.34f, 0.24f, 0.34f), stone);
                AddBox(root, "Pillar", new Vector3(0f, 0.5f, 0f), new Vector3(0.18f, 0.56f, 0.18f), stone);
                AddBox(root, "Cage", new Vector3(0f, 0.86f, 0f), new Vector3(0.26f, 0.18f, 0.26f), LitMaterial(new Color32(36, 30, 42, 255)));
            }
            else AddBox(root, "Post", new Vector3(0f, 0.4f, 0f), new Vector3(0.08f, 0.8f, 0.08f), LitMaterial(new Color32(60, 40, 30, 255)));
            var flame = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Object.DestroyImmediate(flame.GetComponent<Collider>());
            flame.transform.SetParent(root, false);
            flame.transform.localScale = magic ? new Vector3(0.18f, 0.24f, 0.18f) : new Vector3(0.12f, 0.16f, 0.12f);
            flame.transform.localPosition = new Vector3(0f, magic ? 1.06f : 0.86f, 0f);
            flame.GetComponent<Renderer>().sharedMaterial = GlowMaterial(color, magic ? 2.6f : 2f);
            flame.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }
    }

    /// <summary>旗の布をはためかせる（頂点を動かす。上の辺は止める）</summary>
    public class BannerWave : MonoBehaviour
    {
        private Mesh mesh;
        private Vector3[] baseVertices, work;
        private float phase;

        public void Setup(Mesh target, float startPhase)
        {
            mesh = target;
            baseVertices = target.vertices;
            work = new Vector3[baseVertices.Length];
            phase = startPhase;
        }

        private void Update()
        {
            if (mesh == null) return;
            float t = Time.time * 2.1f + phase;
            for (int i = 0; i < baseVertices.Length; i++)
            {
                var v = baseVertices[i];
                float down = Mathf.Clamp01(-v.y / 1.5f);   // 上の辺は動かさない
                v.z += Mathf.Sin(t + v.y * 3.1f + v.x * 4f) * 0.06f * down;
                v.x += Mathf.Sin(t * 0.7f + v.y * 2f) * 0.02f * down;
                work[i] = v;
            }
            mesh.vertices = work;
            mesh.RecalculateNormals();
        }
    }

    /// <summary>小さな炎をゆらがせる（燭台。大きさを少しずつ変える）</summary>
    public class FlameFlicker : MonoBehaviour
    {
        private Vector3 baseScale;
        private float seed;

        private void Awake()
        {
            baseScale = transform.localScale;
            seed = transform.position.x * 1.7f + transform.position.z * 0.9f;
        }

        private void Update()
        {
            float n = Mathf.PerlinNoise(Time.time * 4f, seed);
            transform.localScale = new Vector3(baseScale.x * (0.85f + 0.3f * n), baseScale.y * (0.8f + 0.45f * n), baseScale.z * (0.85f + 0.3f * n));
        }
    }

    /// <summary>光をゆらがせる（魔灯・たいまつ）</summary>
    public class LightFlicker : MonoBehaviour
    {
        private Light target;
        private float baseIntensity, seed;

        public void Setup(Light light, float startSeed)
        {
            target = light;
            baseIntensity = light.intensity;
            seed = startSeed;
        }

        private void Update()
        {
            if (target == null) return;
            float n = Mathf.PerlinNoise(Time.time * 2.3f, seed);
            target.intensity = baseIntensity * (0.8f + 0.35f * n);
        }
    }
}
