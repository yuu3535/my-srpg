using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>探索の画面の小さな形（コードで描く。ふちはなめらかに）。2026-11-14</summary>
    public static class ExploreTextures
    {
        private static Texture2D diamondRing, magnifier, talk, ellipse, ellipseRing;

        private static Texture2D New(int s, string name) =>
            new Texture2D(s, s, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = name };

        private static float Edge(float d, float soft = 1.2f) => Mathf.Clamp01(0.5f - d / soft);

        /// <summary>菱形の枠（外側の四角いっぱい。線の太さは絵の 1/22）</summary>
        public static Texture2D DiamondRing
        {
            get
            {
                if (diamondRing != null) return diamondRing;
                const int S = 88;
                var t = New(S, "ExploreDiamondRing");
                float line = S / 22f;
                for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float d = Mathf.Abs(x + 0.5f - S / 2f) + Mathf.Abs(y + 0.5f - S / 2f);
                    float outer = S / 2f - 1f;
                    float dist = Mathf.Abs(d - (outer - line / 2f)) - line / 2f;
                    t.SetPixel(x, y, new Color(1f, 1f, 1f, Edge(dist * 1.414f)));
                }
                t.Apply();
                return diamondRing = t;
            }
        }

        /// <summary>虫めがね（線 2px を 16px に描く絵。64px）</summary>
        public static Texture2D Magnifier
        {
            get
            {
                if (magnifier != null) return magnifier;
                const int S = 64;
                var t = New(S, "ExploreMagnifier");
                float k = S / 16f, w = 1.0f * k;   // 線の半分の太さ
                var c = new Vector2(6.5f, 9.5f) * k;   // 輪の中心（上が大きい y）
                float r = 4.6f * k;
                Vector2 a = new Vector2(10f, 6f) * k, b = new Vector2(14f, 2f) * k;
                for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    var p = new Vector2(x + 0.5f, y + 0.5f);
                    float ring = Mathf.Abs((p - c).magnitude - r) - w;
                    float h = SegDist(p, a, b) - w * 1.1f;
                    t.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Max(Edge(ring), Edge(h))));
                }
                t.Apply();
                return magnifier = t;
            }
        }

        /// <summary>話す（吹き出しの枠と小さなしっぽ。64px）</summary>
        public static Texture2D Talk
        {
            get
            {
                if (talk != null) return talk;
                const int S = 64;
                var t = New(S, "ExploreTalk");
                float k = S / 16f, w = 0.9f * k;
                var c = new Vector2(8f, 9.5f) * k;
                Vector2 half = new Vector2(6f, 4.2f) * k;
                Vector2 t0 = new Vector2(5f, 5.6f) * k, t1 = new Vector2(3.6f, 2f) * k, t2 = new Vector2(8f, 5.6f) * k;
                for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    var p = new Vector2(x + 0.5f, y + 0.5f);
                    // 角の丸い四角の枠
                    var q = new Vector2(Mathf.Abs(p.x - c.x), Mathf.Abs(p.y - c.y)) - (half - Vector2.one * 1.6f * k);
                    float box = new Vector2(Mathf.Max(q.x, 0f), Mathf.Max(q.y, 0f)).magnitude + Mathf.Min(Mathf.Max(q.x, q.y), 0f) - 1.6f * k;
                    float frame = Mathf.Abs(box) - w;
                    float tail = Mathf.Min(SegDist(p, t0, t1), SegDist(p, t1, t2)) - w;
                    if (p.y > 5.6f * k + w) tail = 99f;
                    t.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Max(Edge(frame), Edge(tail))));
                }
                t.Apply();
                return talk = t;
            }
        }

        /// <summary>楕円の暗がり（まん中 1 → ふち 0。札のまわり）</summary>
        public static Texture2D Ellipse
        {
            get
            {
                if (ellipse != null) return ellipse;
                const int S = 64;
                var t = New(S, "ExploreEllipse");
                for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = (x + 0.5f) / S * 2f - 1f, dy = (y + 0.5f) / S * 2f - 1f;
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    float a = Mathf.Clamp01(1f - d);
                    t.SetPixel(x, y, new Color(1f, 1f, 1f, a * a * (3f - 2f * a)));
                }
                t.Apply();
                return ellipse = t;
            }
        }

        /// <summary>楕円の細い輪（床の印）</summary>
        public static Texture2D EllipseRing
        {
            get
            {
                if (ellipseRing != null) return ellipseRing;
                const int W = 256, H = 64;
                var t = new Texture2D(W, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "ExploreEllipseRing" };
                for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float dx = (x + 0.5f) / W * 2f - 1f, dy = (y + 0.5f) / H * 2f - 1f;
                    float r = Mathf.Sqrt(dx * dx + dy * dy);
                    // 楕円の上での距離（画素）: 輪の半径の差 × その向きの大きさ
                    float scale = Mathf.Lerp(H / 2f, W / 2f, Mathf.Abs(dx) / Mathf.Max(0.0001f, r));
                    float dist = Mathf.Abs(r - 0.96f) * scale - 0.9f;
                    t.SetPixel(x, y, new Color(1f, 1f, 1f, Edge(dist)));
                }
                t.Apply();
                return ellipseRing = t;
            }
        }

        private static float SegDist(Vector2 p, Vector2 a, Vector2 b)
        {
            var ab = b - a;
            float u = Mathf.Clamp01(Vector2.Dot(p - a, ab) / ab.sqrMagnitude);
            return (p - (a + ab * u)).magnitude;
        }
    }
}
