using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 多角形の塗り・線（Hub2 の枠・菱形・レティクル・切れ目の線）。点は RectTransform のローカル座標（左上の点を原点に、下向きは −Y）で渡す。
    /// 線の太さは基準 1688×780 の px
    /// </summary>
    [RequireComponent(typeof(CanvasRenderer))]
    public class PolyGraphic : MaskableGraphic
    {
        public enum Mode { Fill, Stroke }
        private readonly List<Vector2> points = new List<Vector2>();
        private Mode mode = Mode.Stroke;
        private bool closed = true;
        private float width = 1f;
        private Color[] pointColors;   // 線の点ごとの色（null なら color）

        /// <summary>線のふちをやわらかくする（斜めの細い線がスマホでギザギザに見えないように。2026-11-09 原作者「流星軌道がガビガビ」）</summary>
        public bool Soft { get => soft; set { soft = value; SetMaterialDirty(); SetVerticesDirty(); } }
        private bool soft;
        public override Texture mainTexture => soft ? Hub2Textures.SoftLine : base.mainTexture;

        public void Set(IList<Vector2> pts, Mode m, bool close = true, float lineWidth = 1f, Color[] colors = null)
        {
            points.Clear();
            points.AddRange(pts);
            mode = m; closed = close; width = lineWidth; pointColors = colors;
            SetVerticesDirty();
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            if (points.Count < 2) return;
            if (mode == Mode.Fill) { Fill(vh); return; }
            int n = points.Count, segs = closed ? n : n - 1;
            for (int i = 0; i < segs; i++)
            {
                Vector2 a = points[i], b = points[(i + 1) % n];
                Vector2 d = b - a;
                if (d.sqrMagnitude < 1e-6f) continue;
                Vector2 nrm = new Vector2(-d.y, d.x).normalized * (width / 2f);
                Vector2 ext = d.normalized * (width / 2f);   // 角が欠けないよう少しのばす
                Color ca = pointColors != null ? pointColors[i] : color, cb = pointColors != null ? pointColors[(i + 1) % n] : color;
                int v = vh.currentVertCount;
                // やわらかい線は、横切る向きに 0→1 の uv（Hub2Textures.SoftLine の濃さの山）
                vh.AddVert(a - ext + nrm, ca, new Vector4(0.5f, 0f));
                vh.AddVert(b + ext + nrm, cb, new Vector4(0.5f, 0f));
                vh.AddVert(b + ext - nrm, cb, new Vector4(0.5f, 1f));
                vh.AddVert(a - ext - nrm, ca, new Vector4(0.5f, 1f));
                vh.AddTriangle(v, v + 1, v + 2);
                vh.AddTriangle(v, v + 2, v + 3);
            }
        }

        private void Fill(VertexHelper vh)
        {
            foreach (var p in points) vh.AddVert(p, color, new Vector4(0.5f, 0.5f));
            foreach (var t in Triangulate(points)) vh.AddTriangle(t.x, t.y, t.z);
        }

        /// <summary>耳切りで三角形に分ける（凹んだ多角形も）</summary>
        public static List<Vector3Int> Triangulate(IList<Vector2> pts)
        {
            var result = new List<Vector3Int>();
            var idx = new List<int>();
            for (int i = 0; i < pts.Count; i++) idx.Add(i);
            float area = 0f;
            for (int i = 0; i < pts.Count; i++) { var a = pts[i]; var b = pts[(i + 1) % pts.Count]; area += a.x * b.y - b.x * a.y; }
            float sign = area >= 0 ? 1f : -1f;
            int guard = 0;
            while (idx.Count > 3 && guard++ < 1000)
            {
                bool clipped = false;
                for (int i = 0; i < idx.Count; i++)
                {
                    int i0 = idx[(i + idx.Count - 1) % idx.Count], i1 = idx[i], i2 = idx[(i + 1) % idx.Count];
                    Vector2 a = pts[i0], b = pts[i1], c = pts[i2];
                    float cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
                    if (cross * sign <= 0f) continue;
                    bool inside = false;
                    foreach (int j in idx)
                    {
                        if (j == i0 || j == i1 || j == i2) continue;
                        if (InTri(pts[j], a, b, c)) { inside = true; break; }
                    }
                    if (inside) continue;
                    result.Add(new Vector3Int(i0, i1, i2));
                    idx.RemoveAt(i);
                    clipped = true;
                    break;
                }
                if (!clipped) break;
            }
            if (idx.Count == 3) result.Add(new Vector3Int(idx[0], idx[1], idx[2]));
            return result;
        }

        private static bool InTri(Vector2 p, Vector2 a, Vector2 b, Vector2 c)
        {
            float d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
            float d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
            float d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
            bool neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
            return !(neg && pos);
        }
    }
}
