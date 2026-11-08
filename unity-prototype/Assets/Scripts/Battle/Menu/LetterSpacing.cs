using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 字間（Unity の標準の文字には字間の設定が無いので、1文字ずつ右へずらす）。1行・左寄せの文字に使う。
    /// em＝文字の大きさに対する字間（正本の letter-spacing: 0.34em など）。Shadow・Outline より先に付ける
    /// </summary>
    [RequireComponent(typeof(Text))]
    public class LetterSpacing : BaseMeshEffect
    {
        public float em;
        private readonly List<UIVertex> verts = new List<UIVertex>();

        public override void ModifyMesh(VertexHelper vh)
        {
            if (!IsActive() || em == 0f) return;
            var text = GetComponent<Text>();
            float step = em * text.fontSize;
            verts.Clear();
            vh.GetUIVertexStream(verts);
            // 1文字＝6つの頂点（三角形2つ）。i 番目の文字を i×step だけ右へ
            for (int i = 0; i < verts.Count; i++)
            {
                var v = verts[i];
                v.position.x += (i / 6) * step;
                verts[i] = v;
            }
            vh.Clear();
            vh.AddUIVertexTriangleStream(verts);
        }
    }
}
