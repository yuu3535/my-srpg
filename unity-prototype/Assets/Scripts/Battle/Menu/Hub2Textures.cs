using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>コードで作る小さな絵（星・ドット・グラデーション）。作った物は使い回す</summary>
    public static class Hub2Textures
    {
        private static Texture2D star, glow, dots, softLine;

        /// <summary>線を横切る向きの濃さ（まん中が濃く、ふちへ向かって消える）。縦に 32px</summary>
        public static Texture2D SoftLine
        {
            get
            {
                if (softLine != null) return softLine;
                const int H = 32;
                softLine = new Texture2D(1, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "Hub2SoftLine" };
                for (int y = 0; y < H; y++)
                {
                    float d = Mathf.Abs((y + 0.5f) / H * 2f - 1f);   // 0＝まん中、1＝ふち
                    float a = Mathf.Clamp01((1f - d) / 0.45f);
                    softLine.SetPixel(0, y, new Color(1f, 1f, 1f, a * a * (3f - 2f * a)));
                }
                softLine.Apply();
                return softLine;
            }
        }
        private static readonly Dictionary<string, Texture2D> gradients = new Dictionary<string, Texture2D>();

        /// <summary>細い光が四方に伸びる金の星（素材 C が見つかるまでの仮。試作と同じくコードで描く）</summary>
        public static Texture2D Star
        {
            get
            {
                if (star != null) return star;
                const int S = 128;
                star = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "Hub2Star" };
                var px = new Color[S * S];
                var gold = new Color(0.95f, 0.80f, 0.47f);
                for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = (x + 0.5f) / S * 2f - 1f, dy = (y + 0.5f) / S * 2f - 1f;
                    float ax = Mathf.Abs(dx), ay = Mathf.Abs(dy), r = Mathf.Sqrt(dx * dx + dy * dy);
                    // 四方の光（縦横に細く長い）＋斜めの短い光＋中心
                    float ray = Mathf.Max(Spike(ax, ay), Spike(ay, ax));
                    float diag = Mathf.Max(Spike((ax + ay) * 0.7071f, Mathf.Abs(ax - ay) * 0.7071f) * 0.55f * Mathf.Clamp01(1f - r * 1.6f), 0f);
                    float core = Mathf.Clamp01(1f - r / 0.16f);
                    float halo = Mathf.Clamp01(1f - r) * 0.18f;
                    float a = Mathf.Clamp01(Mathf.Max(Mathf.Max(ray, diag), core) + halo);
                    var c = Color.Lerp(gold, Color.white, core * 0.8f);
                    px[y * S + x] = new Color(c.r, c.g, c.b, a);
                }
                star.SetPixels(px);
                star.Apply();
                return star;
            }
        }

        // along＝光の向きの距離、across＝横の距離
        private static float Spike(float along, float across)
        {
            if (along > 1f) return 0f;
            float thick = 0.10f * (1f - along) + 0.004f;
            return Mathf.Clamp01(1f - across / thick) * (1f - along * 0.85f);
        }

        /// <summary>やわらかい丸い光（光彩・流星の尾の頭）</summary>
        public static Texture2D Glow
        {
            get
            {
                if (glow != null) return glow;
                const int S = 64;
                glow = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "Hub2Glow" };
                var px = new Color[S * S];
                for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = (x + 0.5f) / S * 2f - 1f, dy = (y + 0.5f) / S * 2f - 1f;
                    float a = Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy));
                    px[y * S + x] = new Color(1f, 1f, 1f, a * a);
                }
                glow.SetPixels(px);
                glow.Apply();
                return glow;
            }
        }

        /// <summary>横のグラデーション（stops は 0〜1 の位置と透明度の組）。色は rgb</summary>
        public static Texture2D Gradient(string key, Color rgb, params Vector2[] stops)
        {
            if (gradients.TryGetValue(key, out var t) && t != null) return t;
            const int W = 256;
            t = new Texture2D(W, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "Hub2Grad_" + key };
            for (int x = 0; x < W; x++)
            {
                float p = x / (W - 1f), a = stops[stops.Length - 1].y;
                for (int i = 0; i + 1 < stops.Length; i++)
                    if (p >= stops[i].x && p <= stops[i + 1].x)
                    {
                        float k = Mathf.InverseLerp(stops[i].x, stops[i + 1].x, p);
                        a = Mathf.Lerp(stops[i].y, stops[i + 1].y, k);
                        break;
                    }
                if (p < stops[0].x) a = stops[0].y;
                t.SetPixel(x, 0, new Color(rgb.r, rgb.g, rgb.b, a));
            }
            t.Apply();
            gradients[key] = t;
            return t;
        }

        /// <summary>ドット帯（16px 間隔の丸い点。左が消え、右が濃い）。正本 §3-7</summary>
        public static Texture2D Dots(int w, int h)
        {
            if (dots != null) return dots;
            dots = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "Hub2Dots" };
            var px = new Color[w * h];
            var ink = new Color(241f / 255f, 234f / 255f, 217f / 255f);
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float cx = (x % 16) - 8f + 0.5f, cy = (y % 16) - 8f + 0.5f;
                float d = Mathf.Sqrt(cx * cx + cy * cy);
                float dot = Mathf.Clamp01(1.6f - d) * 0.5f;
                float p = x / (float)w;
                float mask = p < 0.3f ? Mathf.Lerp(0f, 0.15f, p / 0.3f) : p < 0.78f ? Mathf.Lerp(0.15f, 1f, (p - 0.3f) / 0.48f) : 1f;
                px[y * w + x] = new Color(ink.r, ink.g, ink.b, dot * mask * 0.55f);
            }
            dots.SetPixels(px);
            dots.Apply();
            return dots;
        }
    }
}
