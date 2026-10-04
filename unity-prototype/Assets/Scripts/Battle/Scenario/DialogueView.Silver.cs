using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 銀細工の会話の枠（採用版md/SILVER_DIALOGUE_UI_DIRECTION.md。見本 prototypes/silver-ui-extension/dialogue.html?layout=portraits）。
    /// 上置きの本文の枠（丸い角・細い銀の縁・半透明の下地・四隅の銀細工）、話す人の側へ向く小さな尾（本文と一続きの輪郭）、
    /// 両端の尖った不透明な名前札（細い内縁・飾りなし）、長い文のページ送り。
    /// 寸法と色は原作者の調整値（Assets/Data/Dialogue/dialogue_style.json）。全場面に固定する値ではない
    /// </summary>
    public partial class DialogueView
    {
        [Serializable]
        public class DialogueStyle
        {
            public float width = 408f, height = 100f, top = 48f;
            public float transparency = 20f;        // 本文の下地の透過率（%）。名前札は透かさない
            public float radius = 24f;
            public string panelColor = "#131d34", borderColor = "#d7d7e0", textColor = "#e6e7ef";
            public string ornament = "large";       // 四隅の銀細工の大きさ small / medium / large
            public float tailLeftOffset = 17f, tailRightOffset = 17f;   // 尾の横位置（話す人の側の端から内側へ）
            public int fontSize = 18, nameFontSize = 17;
            public float listenerShade = 0.24f;     // 黙っている人を、絵の形の中だけ暗くする割合
        }

        [SerializeField] private TextAsset styleJson;
        [SerializeField] private Texture2D cornerTexture;   // 四隅の銀細工（左上の形。ほかの角は反転）

        private DialogueStyle style = new DialogueStyle();
        private Color panelCol, borderCol, textCol;
        private RawImage frameImage, plateImage;
        private Text pageText;
        private readonly Dictionary<string, Texture2D> frameCache = new Dictionary<string, Texture2D>();
        private readonly Dictionary<int, Texture2D> plateCache = new Dictionary<int, Texture2D>();
        private string[] pages = Array.Empty<string>();
        private int page;

        private const float TailDrop = 18f, PlateHeight = 32f, TextureScale = 2f;
        private const float TextLeft = 26f, TextRight = 66f, TextTop = 26f, TextBottom = 20f;

        public DialogueStyle Style => style;
        public int PageCount => pages.Length;
        public int PageIndex => page;

        private void LoadStyle()
        {
            style = new DialogueStyle();
            if (styleJson != null) JsonUtility.FromJsonOverwrite(styleJson.text, style);
            panelCol = Hex(style.panelColor, new Color32(19, 29, 52, 255));
            borderCol = Hex(style.borderColor, new Color32(215, 215, 224, 255));
            textCol = Hex(style.textColor, new Color32(230, 231, 239, 255));
        }

        /// <summary>
        /// 見本（ブラウザ）と同じ透け方に見える不透明度。Unity は色を線形の空間で混ぜるので、同じ値だと下の景色がずっと明るく透ける。
        /// 暗い下地を重ねたときに、ブラウザの混ぜ方（sRGB）と近くなるよう強める
        /// </summary>
        private static float SeenAlpha(float a) => QualitySettings.activeColorSpace == ColorSpace.Linear ? 1f - Mathf.Pow(1f - a, 2.2f) : a;

        private static Color Hex(string hex, Color fallback) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : fallback;

        /// <summary>上置きの本文の枠・名前札・四隅の銀細工・本文・ページ番号を組み立てる</summary>
        private void BuildSilverBox(Font font)
        {
            LoadStyle();
            box = NewRect("Box", root);
            box.anchorMin = box.anchorMax = new Vector2(0.5f, 1f);
            box.pivot = new Vector2(0.5f, 1f);
            box.sizeDelta = new Vector2(style.width, style.height);
            box.anchoredPosition = new Vector2(0f, -style.top);

            // 本文の枠と尾（1枚の絵。話す人の側ごとに作る）
            frameImage = NewRect("Frame", box).gameObject.AddComponent<RawImage>();
            frameImage.raycastTarget = false;
            var frt = frameImage.rectTransform;
            frt.anchorMin = frt.anchorMax = frt.pivot = new Vector2(0f, 1f);
            frt.sizeDelta = new Vector2(style.width, style.height + TailDrop + 2f);
            frt.anchoredPosition = Vector2.zero;

            // 四隅の銀細工（左上の絵を反転して使う）
            var (corner, ox, oy) = style.ornament == "small" ? (48f, -12f, -13f) : style.ornament == "medium" ? (64f, -16f, -17f) : (76f, -19f, -20f);
            if (cornerTexture != null)
                for (int i = 0; i < 4; i++)
                {
                    bool right = i % 2 == 1, bottom = i >= 2;
                    var img = NewRect("Corner", box).gameObject.AddComponent<RawImage>();
                    img.texture = cornerTexture;
                    img.raycastTarget = false;
                    img.uvRect = new Rect(right ? 1f : 0f, bottom ? 1f : 0f, right ? -1f : 1f, bottom ? -1f : 1f);
                    var rt = img.rectTransform;
                    rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(right ? 1f : 0f, bottom ? 0f : 1f);
                    rt.sizeDelta = new Vector2(corner, corner);
                    rt.anchoredPosition = new Vector2(right ? -ox : ox, bottom ? oy : -oy);
                }

            // 名前札（両端が尖った形。不透明な下地と細い内縁。飾りは付けない）
            namePlate = NewRect("Name", box);
            plateImage = namePlate.gameObject.AddComponent<RawImage>();
            plateImage.raycastTarget = false;
            nameText = NewText("Text", namePlate, boldFont != null ? boldFont : font, style.nameFontSize, textCol, TextAnchor.MiddleCenter);
            Stretch(nameText.rectTransform);

            bodyText = NewText("Body", box, font, style.fontSize, textCol, TextAnchor.UpperLeft);
            bodyText.rectTransform.anchorMin = Vector2.zero;
            bodyText.rectTransform.anchorMax = Vector2.one;
            bodyText.rectTransform.offsetMin = new Vector2(TextLeft, TextBottom);
            bodyText.rectTransform.offsetMax = new Vector2(-TextRight, -TextTop);
            bodyText.lineSpacing = 1f;
            bodyText.verticalOverflow = VerticalWrapMode.Truncate;

            nextMark = NewText("Next", box, font, 11, borderCol, TextAnchor.MiddleCenter);
            nextMark.text = "▼";
            nextMark.rectTransform.anchorMin = nextMark.rectTransform.anchorMax = new Vector2(1f, 0f);
            nextMark.rectTransform.sizeDelta = new Vector2(20f, 16f);
            nextMark.rectTransform.anchoredPosition = new Vector2(-24f, 18f);

            pageText = NewText("Page", box, font, 10, textCol, TextAnchor.MiddleRight);
            pageText.rectTransform.anchorMin = pageText.rectTransform.anchorMax = new Vector2(1f, 0f);
            pageText.rectTransform.pivot = new Vector2(1f, 0.5f);
            pageText.rectTransform.sizeDelta = new Vector2(44f, 14f);
            pageText.rectTransform.anchoredPosition = new Vector2(-14f, 38f);

            SetSpeakerSide(0, true, "");
        }

        /// <summary>話す人の側（−1 左・0 なし・1 右）に合わせて、尾と名前札を置く</summary>
        private void SetSpeakerSide(int side, bool tail, string name)
        {
            frameImage.texture = Frame(tail ? side : 0);
            namePlate.gameObject.SetActive(!string.IsNullOrEmpty(name));
            if (string.IsNullOrEmpty(name)) return;
            nameText.text = name;
            float textW = nameText.preferredWidth;
            float w = Mathf.Max(144f, Mathf.Ceil(textW + 64f));
            namePlate.sizeDelta = new Vector2(w, PlateHeight);
            float x = side < 0 ? 24f + w / 2f : side > 0 ? style.width - 24f - w / 2f : style.width / 2f;
            namePlate.anchorMin = namePlate.anchorMax = new Vector2(0f, 1f);
            namePlate.pivot = new Vector2(0.5f, 1f);
            namePlate.anchoredPosition = new Vector2(x, 20f);   // 枠の上の辺から 20 上に出す（見本 top: -20px）
            plateImage.texture = Plate(Mathf.RoundToInt(w));
        }

        /// <summary>本文を、枠に入る行数ずつのページに分ける（文字を小さくして詰めない）</summary>
        private string[] Paginate(string text)
        {
            var font = bodyText.font;
            int size = bodyText.fontSize;
            float width = style.width - TextLeft - TextRight - 2f;
            float lineH = font.lineHeight * size / Mathf.Max(1, font.fontSize) * bodyText.lineSpacing;
            if (font.dynamic) lineH = size * 1.45f * bodyText.lineSpacing;
            int rows = Mathf.Max(1, Mathf.FloorToInt((style.height - TextTop - TextBottom + 2f) / lineH));
            font.RequestCharactersInTexture(text ?? "", size, bodyText.fontStyle);
            var wrapped = new List<string>();
            foreach (var paragraph in (text ?? "").Split('\n'))
            {
                var row = new System.Text.StringBuilder();
                float w = 0f;
                foreach (char c in paragraph)
                {
                    float adv = font.GetCharacterInfo(c, out var info, size, bodyText.fontStyle) ? info.advance : size;
                    if (row.Length > 0 && w + adv > width) { wrapped.Add(row.ToString()); row.Clear(); w = 0f; }
                    row.Append(c);
                    w += adv;
                }
                wrapped.Add(row.ToString());
            }
            var result = new List<string>();
            for (int i = 0; i < wrapped.Count; i += rows) result.Add(string.Join("\n", wrapped.GetRange(i, Mathf.Min(rows, wrapped.Count - i))));
            return result.Count > 0 ? result.ToArray() : new[] { "" };
        }

        private void ShowPage()
        {
            bodyText.text = pages[page];
            pageText.text = pages.Length > 1 ? $"{page + 1}/{pages.Length}" : "";
        }

        // ── 絵を作る（初めに使うときに1回。2倍の細かさで作って縮めて見せる） ──

        /// <summary>本文の枠と尾を1枚に（丸い角の四角と尾を合わせた形。縁は1本の線で、継ぎ目を出さない）</summary>
        private Texture2D Frame(int side)
        {
            string key = side.ToString();
            if (frameCache.TryGetValue(key, out var cached) && cached != null) return cached;
            float S = TextureScale, W = style.width, H = style.height;
            int tw = Mathf.CeilToInt(W * S), th = Mathf.CeilToInt((H + TailDrop + 2f) * S);
            float r = Mathf.Min(style.radius, (W - 36f) / 2f, (H - 1f) / 2f);
            float offset = side < 0 ? style.tailLeftOffset : style.tailRightOffset;
            float near = r + 6f + Mathf.Clamp(offset, 0f, W - 2f * r - 36f), far = near + 23f;
            // 尾の三角（見本の framePath と同じ点）。上の辺は枠の中へ少し入れて、つなぎ目の線を消す
            Vector2 a, b, c;
            if (side < 0) { a = new Vector2(far, H - 4f); b = new Vector2(near - 6f, H + TailDrop); c = new Vector2(near, H - 4f); }
            else { a = new Vector2(W - near, H - 4f); b = new Vector2(W - near + 6f, H + TailDrop); c = new Vector2(W - far, H - 4f); }
            var fill = panelCol;
            fill.a = SeenAlpha(Mathf.Clamp01(1f - style.transparency / 100f));
            var px = new Color32[tw * th];
            for (int y = 0; y < th; y++)
            for (int x = 0; x < tw; x++)
            {
                // 枠の座標（左上が 0、下へ正）
                var p = new Vector2((x + 0.5f) / S, (th - 1 - y + 0.5f) / S);
                float d = RoundBox(p - new Vector2(W / 2f, H / 2f), new Vector2(W / 2f - 0.5f, H / 2f - 0.5f), r);
                if (side != 0) d = Mathf.Min(d, Triangle(p, a, b, c));
                px[y * tw + x] = Shade(d * S, fill, borderCol, 1f * S, 1f);
            }
            var tex = NewTexture(tw, th, px);
            frameCache[key] = tex;
            return tex;
        }

        /// <summary>名前札（両端が尖った六角形。不透明な下地・1本の縁・細い内縁）</summary>
        private Texture2D Plate(int width)
        {
            if (plateCache.TryGetValue(width, out var cached) && cached != null) return cached;
            float S = TextureScale, W = width, H = PlateHeight;
            int tw = Mathf.CeilToInt(W * S), th = Mathf.CeilToInt(H * S);
            // 見本の viewBox 140×34 の点を、札の大きさへ引き伸ばす（preserveAspectRatio none と同じ）
            Vector2[] Shape(float[] pts) { var v = new Vector2[pts.Length / 2]; for (int i = 0; i < v.Length; i++) v[i] = new Vector2(pts[i * 2] * W / 140f, pts[i * 2 + 1] * H / 34f); return v; }
            var outer = Shape(new[] { 1f, 17f, 13f, 1f, 127f, 1f, 139f, 17f, 127f, 33f, 13f, 33f });
            var inner = Shape(new[] { 6f, 17f, 15f, 5f, 125f, 5f, 134f, 17f, 125f, 29f, 15f, 29f });
            var fill = panelCol;
            fill.a = 1f;
            var innerCol = borderCol;
            innerCol.a = 0.5f;
            var px = new Color32[tw * th];
            for (int y = 0; y < th; y++)
            for (int x = 0; x < tw; x++)
            {
                var p = new Vector2((x + 0.5f) / S, (th - 1 - y + 0.5f) / S);
                Color col = Shade(ConvexPolygon(p, outer) * S, fill, borderCol, 1f * S, 1f);
                float di = Mathf.Abs(ConvexPolygon(p, inner) * S);
                float ia = Mathf.Clamp01(0.3f * S + 0.5f - di) * innerCol.a;
                if (ia > 0f && col.a > 0f) col = new Color(Mathf.Lerp(col.r, innerCol.r, ia), Mathf.Lerp(col.g, innerCol.g, ia), Mathf.Lerp(col.b, innerCol.b, ia), col.a);
                px[y * tw + x] = col;
            }
            var tex = NewTexture(tw, th, px);
            plateCache[width] = tex;
            return tex;
        }

        /// <summary>形からの距離 d（内側が負・絵の点の単位）から、下地と縁を重ねた色（縁は d=0 を中心に strokeWidth の太さ）</summary>
        private static Color32 Shade(float d, Color fill, Color stroke, float strokeWidth, float strokeAlpha)
        {
            float fillA = Mathf.Clamp01(0.5f - d) * fill.a;
            float sA = Mathf.Clamp01(strokeWidth / 2f + 0.5f - Mathf.Abs(d)) * strokeAlpha;
            float a = sA + fillA * (1f - sA);
            if (a <= 0f) return new Color32(0, 0, 0, 0);
            var rgb = (new Vector3(stroke.r, stroke.g, stroke.b) * sA + new Vector3(fill.r, fill.g, fill.b) * fillA * (1f - sA)) / a;
            return new Color(rgb.x, rgb.y, rgb.z, a);
        }

        private static Texture2D NewTexture(int w, int h, Color32[] px)
        {
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            tex.SetPixels32(px);
            tex.Apply();
            return tex;
        }

        // 丸い角の四角の距離（中心からの p、半分の大きさ b、角の丸み r）
        private static float RoundBox(Vector2 p, Vector2 b, float r)
        {
            var q = new Vector2(Mathf.Abs(p.x) - b.x + r, Mathf.Abs(p.y) - b.y + r);
            return new Vector2(Mathf.Max(q.x, 0f), Mathf.Max(q.y, 0f)).magnitude + Mathf.Min(Mathf.Max(q.x, q.y), 0f) - r;
        }

        // 三角形の距離（内側が負）
        private static float Triangle(Vector2 p, Vector2 p0, Vector2 p1, Vector2 p2)
        {
            Vector2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2, v0 = p - p0, v1 = p - p1, v2 = p - p2;
            Vector2 pq0 = v0 - e0 * Mathf.Clamp01(Vector2.Dot(v0, e0) / Vector2.Dot(e0, e0));
            Vector2 pq1 = v1 - e1 * Mathf.Clamp01(Vector2.Dot(v1, e1) / Vector2.Dot(e1, e1));
            Vector2 pq2 = v2 - e2 * Mathf.Clamp01(Vector2.Dot(v2, e2) / Vector2.Dot(e2, e2));
            float s = Mathf.Sign(e0.x * e2.y - e0.y * e2.x);
            var d = Vector2.Min(Vector2.Min(new Vector2(pq0.sqrMagnitude, s * (v0.x * e0.y - v0.y * e0.x)),
                                            new Vector2(pq1.sqrMagnitude, s * (v1.x * e1.y - v1.y * e1.x))),
                                            new Vector2(pq2.sqrMagnitude, s * (v2.x * e2.y - v2.y * e2.x)));
            return -Mathf.Sqrt(d.x) * Mathf.Sign(d.y);
        }

        // 凸な多角形の距離（辺ごとの外向きの距離のいちばん大きいもの。内側が負）
        private static float ConvexPolygon(Vector2 p, Vector2[] pts)
        {
            float area = 0f;
            for (int i = 0; i < pts.Length; i++) { var u = pts[i]; var v = pts[(i + 1) % pts.Length]; area += u.x * v.y - v.x * u.y; }
            float sign = area > 0f ? 1f : -1f;
            float d = float.MinValue;
            for (int i = 0; i < pts.Length; i++)
            {
                var u = pts[i];
                var e = pts[(i + 1) % pts.Length] - u;
                var n = new Vector2(e.y, -e.x).normalized * sign;
                d = Mathf.Max(d, Vector2.Dot(p - u, n));
            }
            return d;
        }
    }
}
