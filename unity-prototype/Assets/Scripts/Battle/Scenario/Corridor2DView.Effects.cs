using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 2Dの横スクロールの見え方の効果（2026-10-04。docs/10-design/map/SIDE_SCROLL_2D_LOOK_PRESETS_2026-10-04.md）。
    /// 見え方のプリセット（Assets/Data/Looks/&lt;名前&gt;.json）を読み、調整ページ（debug/corridor_layers.html）と同じ見た目にする:
    /// 空の絵の差し替え、層ごとの霞・ぼかし（奥ほど強く。層ごとに上書き可）、色温度・オーバーレイ・明るさ・コントラスト・彩度（画面全体）、
    /// ヴィネット、光の筋と床の光、キャラの霞・ぼかし・明るさ・なじませ。会話の枠などほかの UI には効果をかけない
    /// </summary>
    public partial class Corridor2DView
    {
        [Serializable]
        public class LookChara { public float haze, blur, bright = 1f, tint; public string tintColor = "#3a4a7a"; }

        [Serializable]
        public class LookEffects
        {
            public bool on = true;
            public float haze = 0.25f; public string hazeColor = "#a9b8e8";
            public float dof = 1.5f;
            public float vignette = 0.35f; public string vignetteColor = "#0b0d18"; public float vignetteSize = 0.55f;
            public float bright = 1f, contrast = 1f, saturate = 1f, temp;
            public float shafts; public string shaftColor = "#ffe0a8";
            public float shaftAngle = 20f, shaftY, shaftX, shaftWidth = 1f, shaftSoft = 6f, shaftGlow;
            public string shaftBlend = "screen";
            public float ovl; public string ovlTop = "#ffd9a0", ovlBottom = "#3a4a7a", ovlMode = "overlay";
            public LookChara chara = new LookChara();
        }

        [Serializable] public class LookLayer { public string name; public float haze = -1f, blur = -1f; }   // −1＝自動（全体のつまみ×奥行き）

        [Serializable]
        public class LookFile
        {
            public string look, sky;
            public LookEffects effects = new LookEffects();
            public LookLayer[] layers;
        }

        [SerializeField] private TextAsset lookJson;          // 見え方のプリセット（なければ効果なし）。場所のふだんの見え方
        [SerializeField] private TextAsset[] lookJsons = Array.Empty<TextAsset>();   // 切り替えられる見え方（Assets/Data/Looks の全部）
        [SerializeField] private Shader layerShader;          // Srpg/Corridor2DLayer
        [SerializeField] private Shader glowShader;           // Srpg/Corridor2DGlow

        private LookFile look;
        private readonly List<(float left, float top, float w, float h, float mw)> moduleRects = new List<(float, float, float, float, float)>();
        private readonly List<(RectTransform rt, Vector2 home)> shaftParts = new List<(RectTransform, Vector2)>();
        private readonly List<Material> lookMaterials = new List<Material>();
        private CorridorLayer modulesLayer;

        private static readonly string[] BlendModes = { "overlay", "soft-light", "screen", "plus-lighter", "multiply", "color", "hard-light", "color-dodge" };

        public string LookName => look?.look;

        /// <summary>今の場所の名前（場所のデータのファイル名。例 orcus_castle）</summary>
        public string PlaceName => corridorJson != null ? corridorJson.name : null;

        /// <summary>
        /// 場所を切り替える（2Dの探索で扉を通ったとき。2026-10-04）。場所のデータと、そのふだんの見え方で組み立て直す。
        /// アルシェの位置は呼んだ側で決める（PlayerX）。人は Rebuilt で並べ直す
        /// </summary>
        public void SetPlace(TextAsset placeJson)
        {
            if (placeJson == null) return;
            corridorJson = placeJson;
            string lookName = JsonUtility.FromJson<CorridorFile>(placeJson.text)?.look;
            lookJson = string.IsNullOrEmpty(lookName) ? null : lookJsons.FirstOrDefault(t => t != null && t.name == lookName);
            lookTextOverride = null;
            look = null;
            Build();
            Rebuilt?.Invoke();
        }

        /// <summary>
        /// 見え方を切り替える（シーンごと。docs/10-design/map/SIDE_SCROLL_2D_LOOK_PRESETS_2026-10-04.md §1）。
        /// 空の絵と効果が変わるので、組み立て直す（アルシェの位置はそのまま。人は呼んだ側で並べ直す）。見つからなければ何もしない
        /// </summary>
        public bool SetLook(string name)
        {
            if (string.IsNullOrEmpty(name) || name == LookName) return false;
            var asset = lookJsons.FirstOrDefault(t => t != null && t.name == name);
            if (asset == null) { Debug.LogWarning($"[Corridor2DView] 見え方がない: {name}"); return false; }
            lookJson = asset;
            lookTextOverride = null;
            RebuildKeep();
            return true;
        }
        private bool EffectsOn => look != null && look.effects != null && look.effects.on && layerShader != null;

        /// <summary>プリセットを読み、空の絵を差し替える（層を組み立てる前に呼ぶ）</summary>
        private void LoadLook()
        {
            // 調整画面で動かしている間は、動かした値（look）をそのまま使う（つまみが同じものを指し続けるように）
            if (lookTextOverride == null || look == null) look = LookText() != null ? JsonUtility.FromJson<LookFile>(LookText()) : null;
            foreach (var m in lookMaterials) if (m != null) DestroyImmediate(m);
            lookMaterials.Clear();
            moduleRects.Clear();
            shaftParts.Clear();
            modulesLayer = null;
            if (look == null || data?.layers == null) return;
            // 空: いちばん奥の層の絵を、プリセットの空に替える（背景/空/朝焼け.png → 朝焼け）
            if (!string.IsNullOrEmpty(look.sky))
            {
                var sky = data.layers.FirstOrDefault(l => l.kind != "modules" && l.kind != "floor");
                string name = System.IO.Path.GetFileName(look.sky);
                if (sky != null && Texture(name) != null) sky.file = name;
            }
        }

        private static Color Hex(string hex, Color fallback) => !string.IsNullOrEmpty(hex) && ColorUtility.TryParseHtmlString(hex, out var c) ? c : fallback;

        /// <summary>画面全体の色（色温度・オーバーレイ・明るさ・コントラスト・彩度）を、層の描き方に渡す</summary>
        private void SetGlobals()
        {
            Shader.SetGlobalFloat("_CgOn", EffectsOn ? 1f : 0f);
            if (!EffectsOn) return;
            var e = look.effects;
            Shader.SetGlobalFloat("_CgBright", e.bright);
            Shader.SetGlobalFloat("_CgContrast", e.contrast);
            Shader.SetGlobalFloat("_CgSaturate", e.saturate);
            // 色温度: ブラウザと同じく、暖色か寒色をソフトライトで |temp|×0.6 重ねる
            Shader.SetGlobalFloat("_CgTemp", Mathf.Abs(e.temp) * 0.6f);
            Shader.SetGlobalColor("_CgTempColor", e.temp > 0f ? new Color32(0xff, 0x9a, 0x3c, 255) : new Color32(0x3c, 0x7c, 0xff, 255));
            Shader.SetGlobalFloat("_CgOvl", e.ovl);
            Shader.SetGlobalColor("_CgOvlTop", Hex(e.ovlTop, Color.white));
            Shader.SetGlobalColor("_CgOvlBottom", Hex(e.ovlBottom, Color.black));
            Shader.SetGlobalFloat("_CgOvlMode", Mathf.Max(0, Array.IndexOf(BlendModes, e.ovlMode)));
        }

        private Material NewLayerMaterial(float haze, float blurPx, Vector2 sizePx, Vector2 uvSize)
        {
            var e = look.effects;
            var m = new Material(layerShader) { name = "Corridor2DLayer (look)" };
            m.SetColor("_HazeColor", Hex(e.hazeColor, Color.white));
            m.SetFloat("_Haze", Mathf.Clamp01(haze));
            m.SetFloat("_Mix", 0f);
            m.SetFloat("_Bright", 1f);
            // ぼかしの半径（画面の点）を、絵の uv の幅に直す
            var r = blurPx > 0.05f && sizePx.x > 0f && sizePx.y > 0f ? new Vector2(blurPx * uvSize.x / sizePx.x, blurPx * uvSize.y / sizePx.y) : Vector2.zero;
            m.SetVector("_BlurUV", new Vector4(r.x, r.y, 0f, 0f));
            lookMaterials.Add(m);
            return m;
        }

        /// <summary>層の絵に効果をかける（組み立てのあとに1回。ぼかしの uv は絵の大きさで決まる）</summary>
        private void ApplyLayerEffects()
        {
            SetGlobals();
            if (!EffectsOn) return;
            var e = look.effects;
            bool first = true;
            int index = 0;
            foreach (var (layer, box, tiles, width) in built)
            {
                // 奥行き（流れる速さが遅いほど奥）。いちばん奥の層（空）には霞をかけない
                float depth = Mathf.Clamp01(1f - layer.speed);
                var over = look.layers?.FirstOrDefault(l => l.name == layer.name) ?? (look.layers != null && index < look.layers.Length && string.IsNullOrEmpty(look.layers[index].name) ? look.layers[index] : null);
                float haze = over != null && over.haze >= 0f ? over.haze : first ? 0f : e.haze * depth;
                float blur = over != null && over.blur >= 0f ? over.blur : e.dof * depth;
                RememberLayer(layer.name, haze, blur);
                first = false;
                index++;
                foreach (var t in tiles)
                {
                    if (t == null || t.texture == null) continue;   // 天井の色（絵なし）はそのまま
                    var size = t.rectTransform.sizeDelta;
                    if (layer.kind == "floor") size = new Vector2(Mathf.Max(8f, layer.tile), size.y);   // 床は素材の幅ごとにくり返す
                    else if (layer.kind != "modules") size = new Vector2(width, layer.height);
                    t.material = NewLayerMaterial(haze, blur, size, Vector2.one);
                }
            }
        }

        /// <summary>キャラ（アルシェ・人）の絵に効果をかける（霞・なじませ・明るさ・ぼかしと、画面全体の色）</summary>
        private void ApplyCharaEffects(RawImage image)
        {
            if (image == null || !EffectsOn || image.texture == null) return;
            var c = look.effects.chara ?? new LookChara();
            var size = image.rectTransform.sizeDelta;
            var m = NewLayerMaterial(c.haze, c.blur, size, Vector2.one);
            m.SetColor("_MixColor", Hex(c.tintColor, Color.black));
            m.SetFloat("_Mix", Mathf.Clamp01(c.tint));
            m.SetFloat("_Bright", c.bright);
            image.material = m;
        }

        /// <summary>光の筋（アーチの間から斜めに差す）と床の光。回廊（モジュール）と一緒に流れる</summary>
        private void BuildShafts(Transform parent)
        {
            if (!EffectsOn || glowShader == null || look.effects.shafts <= 0f || moduleRects.Count < 3) return;
            var e = look.effects;
            var box = NewRect("光の筋", parent);
            box.anchorMin = Vector2.zero; box.anchorMax = Vector2.one; box.sizeDelta = Vector2.zero;
            var mat = new Material(glowShader) { name = "Corridor2DGlow (look)" };
            bool add = e.shaftBlend == "plus-lighter";
            mat.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.One);
            mat.SetFloat("_DstBlend", (float)(add ? UnityEngine.Rendering.BlendMode.One : UnityEngine.Rendering.BlendMode.OneMinusSrcColor));
            lookMaterials.Add(mat);
            var color = Hex(e.shaftColor, Color.white);
            float angle = e.shaftAngle, tan = Mathf.Tan(angle * Mathf.Deg2Rad), cos = Mathf.Cos(angle * Mathf.Deg2Rad);
            // 左右の端の絵（最初と最後）には差さない
            for (int i = 1; i < moduleRects.Count - 1; i++)
            {
                var (left, top, w2, h2, mw) = moduleRects[i];
                float x = left + w2 / 2f + e.shaftX, y0 = top + h2 * 0.28f + e.shaftY, y1 = modulesLayer.bottom - 8f;
                float h = Mathf.Max(10f, y1 - y0), w = mw * 0.34f * e.shaftWidth, soft = Mathf.Max(0.5f, e.shaftSoft);
                Ray(box, mat, x, y0, w, h, soft, cos, angle, color, e.shafts);
                if (e.shaftGlow > 0f) Ray(box, mat, x, y0, w * 2f, h, soft * 3f + 6f, cos, angle, color, e.shafts * e.shaftGlow);
                // 床の光: 筋の下の端（左へ h×tan ずれた所）
                float px = x - h * tan, pw = w * 1.6f + soft * 2f, ph = 34f + soft * 2f;
                var pool = NewRect("床の光", box);
                pool.anchorMin = pool.anchorMax = new Vector2(0f, 1f);
                pool.pivot = new Vector2(0.5f, 0.5f);
                pool.sizeDelta = new Vector2(pw, ph);
                var home = new Vector2(px, -(y1 - 22f + 17f));
                pool.anchoredPosition = home;
                var pi = pool.gameObject.AddComponent<RawImage>();
                pi.texture = PoolTexture();
                pi.material = mat;
                pi.color = new Color(color.r, color.g, color.b, Mathf.Clamp01(e.shafts * (0.7f + e.shaftGlow * 0.3f)));
                pi.raycastTarget = false;
                shaftParts.Add((pool, home));
            }
        }

        private void Ray(RectTransform box, Material mat, float x, float y0, float w, float h, float soft, float cos, float angle, Color color, float alpha)
        {
            var rt = NewRect("光", box);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 1f);
            // ブラウザの skewX の代わりに、上の端を中心に回す（下の端が左へ h×tan。長さは h/cos）
            rt.sizeDelta = new Vector2(w + soft * 2f, h / Mathf.Max(0.2f, cos));
            rt.localEulerAngles = new Vector3(0f, 0f, -angle);
            var home = new Vector2(x, -y0);
            rt.anchoredPosition = home;
            var img = rt.gameObject.AddComponent<RawImage>();
            img.texture = RayTexture(soft / Mathf.Max(1f, w + soft * 2f));
            img.material = mat;
            img.color = new Color(color.r, color.g, color.b, Mathf.Clamp01(alpha));
            img.raycastTarget = false;
            shaftParts.Add((rt, home));
        }

        /// <summary>ヴィネット（四隅を暗く。ブラウザの radial-gradient(ellipse 72% 78%, transparent 広さ, 色 100%) と同じ）</summary>
        private void BuildVignette(Transform parent)
        {
            if (!EffectsOn || look.effects.vignette <= 0f) return;
            var e = look.effects;
            var rt = NewRect("ヴィネット", parent);
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.sizeDelta = Vector2.zero;
            var img = rt.gameObject.AddComponent<RawImage>();
            img.texture = VignetteTexture(e.vignetteSize, Mathf.Clamp01(e.vignette));
            var col = Hex(e.vignetteColor, Color.black);
            img.color = new Color(col.r, col.g, col.b, 1f);   // 濃さは絵の透明度に入れた
            img.raycastTarget = false;
        }

        /// <summary>光の筋を回廊と一緒に流す（Apply から）</summary>
        private void ShiftShafts()
        {
            if (modulesLayer == null) return;
            float shift = modulesLayer.x - cameraX * modulesLayer.speed;
            foreach (var (rt, home) in shaftParts) if (rt != null) rt.anchoredPosition = home + new Vector2(shift, 0f);
        }

        // ── 絵を作る ──

        private static Texture2D RayTexture(float softFraction)
        {
            const int w = 32, h = 128;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < h; y++)
            {
                float t = 1f - y / (h - 1f);   // 0 上 → 1 下
                float v = t < 0.35f ? t / 0.35f : 1f - (t - 0.35f) / 0.65f;   // 透明 → 35% で色 → 透明（ブラウザと同じ）
                for (int x = 0; x < w; x++)
                {
                    float u = x / (w - 1f);
                    float edge = Mathf.Min(u, 1f - u);
                    float a = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(edge / Mathf.Max(0.02f, softFraction * 2f)));
                    tex.SetPixel(x, y, new Color(1f, 1f, 1f, a * v));
                }
            }
            tex.Apply();
            return tex;
        }

        private static Texture2D poolTexture;
        private static Texture2D PoolTexture()
        {
            if (poolTexture != null) return poolTexture;
            const int w = 64, h = 32;
            poolTexture = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float dx = (x + 0.5f) / w * 2f - 1f, dy = (y + 0.5f) / h * 2f - 1f;
                float d = Mathf.Sqrt(dx * dx + dy * dy);
                poolTexture.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(1f - d))));
            }
            poolTexture.Apply();
            return poolTexture;
        }

        /// <summary>
        /// ヴィネットの透明度。Unity は色を線形の空間で混ぜるので、ブラウザと同じ暗さに見えるよう強める（会話の枠の SeenAlpha と同じ考え）
        /// </summary>
        private static float Seen(float a) => QualitySettings.activeColorSpace == ColorSpace.Linear ? 1f - Mathf.Pow(1f - a, 2.2f) : a;

        private static Texture2D VignetteTexture(float clearSize, float strength)
        {
            const int w = 128, h = 64;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float dx = ((x + 0.5f) / w - 0.5f) / 0.72f, dy = ((y + 0.5f) / h - 0.5f) / 0.78f;
                float d = Mathf.Sqrt(dx * dx + dy * dy);   // 楕円（横 72%・縦 78%）の端で 1
                float a = Mathf.Clamp01((d - clearSize) / Mathf.Max(0.01f, 1f - clearSize));
                tex.SetPixel(x, y, new Color(1f, 1f, 1f, Seen(a * strength)));
            }
            tex.Apply();
            return tex;
        }
    }
}
