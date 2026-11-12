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
        private readonly List<int> charOf = new List<int>();

        public override void ModifyMesh(VertexHelper vh)
        {
            if (!IsActive() || em == 0f) return;
            var text = GetComponent<Text>();
            float step = em * text.fontSize;
            verts.Clear();
            vh.GetUIVertexStream(verts);
            // 1文字＝6つの頂点（三角形2つ）。i 番目の文字を i×step だけ右へ。
            // 空白は形が無いので四角が作られない（作られない分だけ、あとの字の番号がずれる）。四角の数が字の数より少ないときは、空白を飛ばして数える
            // 改行のある文字は、行ごとに数え直す（2行目の頭がずれないように。会話の本文 2026-11-13）
            string s = text.text ?? "";
            int quads = verts.Count / 6;
            charOf.Clear();
            int col = 0;
            bool skipBlank = quads < s.Length;
            for (int c = 0; c < s.Length; c++)
            {
                if (s[c] == '\n') { col = 0; if (!skipBlank) charOf.Add(0); continue; }
                if (!skipBlank || !char.IsWhiteSpace(s[c])) charOf.Add(col);
                col++;
            }
            for (int i = 0; i < verts.Count; i++)
            {
                int q = i / 6;
                int index = charOf.Count > q ? charOf[q] : q;
                var v = verts[i];
                v.position.x += index * step;
                verts[i] = v;
            }
            vh.Clear();
            vh.AddUIVertexTriangleStream(verts);
        }
    }
}
