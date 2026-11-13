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

        private static bool AsciiBlank(char c) => c == ' ' || c == '\n' || c == '\r' || c == '\t';

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
            // どの字に四角が作られるかは字で違う（半角の空白や改行は作られない。全角の空白は作られることがある）。
            // 四角の数に合う数え方を選ぶ: 全部 → 半角の空白と改行を除く → 空白（全角も）を除く
            int col = 0;
            int all = s.Length, noAscii = 0, noBlank = 0;
            foreach (char ch in s)
            {
                if (!AsciiBlank(ch)) noAscii++;
                if (!char.IsWhiteSpace(ch)) noBlank++;
            }
            int rule = quads == all ? 0 : quads == noAscii ? 1 : 2;
            for (int c = 0; c < s.Length; c++)
            {
                char ch = s[c];
                bool skip = rule == 1 ? AsciiBlank(ch) : rule == 2 && char.IsWhiteSpace(ch);
                if (ch == '\n') { col = 0; if (!skip) charOf.Add(0); continue; }
                if (!skip) charOf.Add(col);
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
