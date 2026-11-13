using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// ぼかした影（CSS の text-shadow: 0 dy blur color）の近似。字の形の影を、半径 radius の輪の上に 8方向×3段 ずらして薄く重ねる。
    /// Unity の Shadow を何個も付けると、あとの Shadow が前の影まで写して形が増え続けるので、元の形だけを1回で写す。
    /// 字間（LetterSpacing）より後に付ける。重なった所の濃さが alpha に見えるよう、1枚の濃さを決める（暗い影なので Seen で線形の空間に合わせる）。
    /// 2026-11-13 タイトルの題名（Hub2担当のレビュー「題名の影が右下にずれた硬い影になっている。見本はぼかした光」）
    /// </summary>
    [RequireComponent(typeof(Text))]
    public class SoftTextShadow : BaseMeshEffect
    {
        public float alpha = 0.55f, offsetY = 6f, radius = 12f;
        private const int Rings = 3, Dirs = 8;
        private readonly List<UIVertex> src = new List<UIVertex>();
        private readonly List<UIVertex> outv = new List<UIVertex>();

        public override void ModifyMesh(VertexHelper vh)
        {
            if (!IsActive() || alpha <= 0f) return;
            src.Clear();
            vh.GetUIVertexStream(src);
            outv.Clear();
            float each = 1f - Mathf.Pow(1f - Hub2Textures.Seen(alpha), 1f / (Rings * Dirs));
            byte a8 = (byte)Mathf.Clamp(Mathf.RoundToInt(each * 255f), 1, 255);
            for (int r = 1; r <= Rings; r++)
            for (int d = 0; d < Dirs; d++)
            {
                float ang = d * Mathf.PI * 2f / Dirs + r * 0.4f, len = radius * r / Rings;
                var off = new Vector3(Mathf.Cos(ang) * len, -offsetY + Mathf.Sin(ang) * len, 0f);
                foreach (var v0 in src)
                {
                    var v = v0;
                    v.position += off;
                    var c = v.color;
                    v.color = new Color32(0, 0, 0, (byte)(a8 * c.a / 255));
                    outv.Add(v);
                }
            }
            outv.AddRange(src);   // 字は影の上
            vh.Clear();
            vh.AddUIVertexTriangleStream(outv);
        }
    }
}
