using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 切り裂きの切り抜き（Mask の形）。Full＝画面全部、Inside＝裂け目の中だけ（開く）、Outside＝裂け目の外だけ（閉じる）。
    /// 座標は基準 1688×780 の左上原点・下向き＋Y を、ローカル（左上原点・下向き −Y）へ直して描く
    /// </summary>
    [RequireComponent(typeof(CanvasRenderer))]
    public class TearMaskGraphic : MaskableGraphic
    {
        public enum Mode { Full, Inside, Outside }
        private Mode mode = Mode.Full;
        private readonly List<Vector2> upper = new List<Vector2>(), lower = new List<Vector2>();
        private Hub2Motion.Geometry geo;
        private const float Far = 20000f;

        public void SetFull() { mode = Mode.Full; SetVerticesDirty(); }

        public void SetTear(Mode m, float o, Hub2Motion.Geometry g)
        {
            mode = m; geo = g;
            Hub2Motion.TearLens(o, g, upper, lower);
            SetVerticesDirty();
        }

        private static Vector2 L(Vector2 p) => new Vector2(p.x, -p.y);

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            var r = rectTransform.rect;
            if (mode == Mode.Full)
            {
                Quad(vh, new Vector2(r.xMin, r.yMax), new Vector2(r.xMax, r.yMax), new Vector2(r.xMax, r.yMin), new Vector2(r.xMin, r.yMin));
                return;
            }
            if (mode == Mode.Inside)
            {
                // 裂け目の中: 上側と下側の点の間を帯にする
                for (int i = 0; i + 1 < upper.Count; i++)
                    Quad(vh, L(upper[i]), L(upper[i + 1]), L(lower[i + 1]), L(lower[i]));
                return;
            }
            // 裂け目の外: 上側の線から n の向きへ遠くまで、下側の線から −n の向きへ遠くまで。両端は u の向きへのばす
            Vector2 n = geo.n, u = geo.u;
            var up = new List<Vector2> { upper[0] - u * Far };
            up.AddRange(upper);
            up.Add(upper[upper.Count - 1] + u * Far);
            var lo = new List<Vector2> { lower[0] - u * Far };
            lo.AddRange(lower);
            lo.Add(lower[lower.Count - 1] + u * Far);
            for (int i = 0; i + 1 < up.Count; i++)
                Quad(vh, L(up[i]), L(up[i + 1]), L(up[i + 1] + n * Far), L(up[i] + n * Far));
            for (int i = 0; i + 1 < lo.Count; i++)
                Quad(vh, L(lo[i]), L(lo[i + 1]), L(lo[i + 1] - n * Far), L(lo[i] - n * Far));
        }

        private void Quad(VertexHelper vh, Vector2 a, Vector2 b, Vector2 c, Vector2 d)
        {
            int v = vh.currentVertCount;
            vh.AddVert(a, color, Vector4.zero);
            vh.AddVert(b, color, Vector4.zero);
            vh.AddVert(c, color, Vector4.zero);
            vh.AddVert(d, color, Vector4.zero);
            vh.AddTriangle(v, v + 1, v + 2);
            vh.AddTriangle(v, v + 2, v + 3);
        }
    }
}
