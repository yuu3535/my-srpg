using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 2Dの探索で、画面を押した所がどれに当たるか（探索の仕様書 explore_spec.md §3.1。2026-11-14）。
    /// 座標は「部屋の座標」＝場所のデータの横の位置の2倍（1688×780 の画面と同じ細かさ。左上が原点、下が＋）。
    /// DOM に触れない純粋な計算（EditMode のテストで確かめる）
    /// </summary>
    public static class ExploreHit
    {
        public enum Kind { Talk, Item, Tips, Exit }

        /// <summary>調べる・話す・出口の1つ</summary>
        public class Target
        {
            public string id;
            public Kind kind;
            public Rect hit;          // 当たり判定（x, y＝左上、幅、高さ）
            public Vector2 point;     // 札が指す点
            public float stripX = float.NaN;   // 出口だけ: この横の位置より右（stripRight）／左を押しても出口
            public bool stripRight = true;
            public float Area => hit.width * hit.height;
            public bool Contains(Vector2 p) =>
                p.x >= hit.x && p.x <= hit.xMax && p.y >= hit.y && p.y <= hit.yMax
                || kind == Kind.Exit && !float.IsNaN(stripX) && (stripRight ? p.x > stripX : p.x < stripX);
        }

        public enum Action { None, Exit, Execute, Select, Walk }

        public struct Result
        {
            public Action action;
            public string id;     // Exit・Execute・Select の相手
            public string also;   // Select のとき、同じ所に重なっているもう1つ（札の下の「ALSO」）
        }

        /// <summary>
        /// 押した所 p（部屋の座標）がどれに当たるか。selected＝今選んでいる物の id（なければ null）。
        /// 優先: ① 出口の範囲 ② 今選んでいる物の当たり判定の中 ③ 当たり判定に入っている物のうち面積がいちばん小さい物
        /// ④ どれにも入らないが、ある物の指す点の横の位置から ±near 以内 ⑤ それ以外は床（歩く）。
        /// （テキスト枠が出ているときは、ここへ来ない＝枠を進めるだけ）
        /// </summary>
        public static Result Pick(Vector2 p, IReadOnlyList<Target> targets, string selected, float near = 110f)
        {
            foreach (var t in targets)
                if (t.kind == Kind.Exit && t.Contains(p)) return new Result { action = Action.Exit, id = t.id };
            if (selected != null)
                foreach (var t in targets)
                    if (t.id == selected && t.kind != Kind.Exit && t.Contains(p)) return new Result { action = Action.Execute, id = t.id };
            Target best = null, second = null;
            foreach (var t in targets)
            {
                if (t.kind == Kind.Exit || !t.Contains(p)) continue;
                if (best == null || t.Area < best.Area) { second = best; best = t; }
                else if (second == null || t.Area < second.Area) second = t;
            }
            if (best != null) return new Result { action = Action.Select, id = best.id, also = second?.id };
            Target nearest = null;
            float bestD = near;
            foreach (var t in targets)
            {
                if (t.kind == Kind.Exit) continue;
                float d = Mathf.Abs(t.point.x - p.x);
                if (d <= bestD) { bestD = d; nearest = t; }
            }
            if (nearest != null) return new Result { action = Action.Select, id = nearest.id };
            return new Result { action = Action.Walk };
        }

        /// <summary>札の幅（仕様書 §5: 動詞の字数×27.5 ＋ 名前の幅（1＋24＋字数×22.7）＋ 8、最低 150。パソコンは ENTER の分 ＋62）</summary>
        public static float CardWidth(string verb, string name, bool pc)
        {
            float w = Mathf.Max((verb?.Length ?? 0) * 27.5f + (1f + 24f + (name?.Length ?? 0) * 22.7f) + 8f, 150f);
            return pc ? w + 62f : w;
        }

        /// <summary>札の左上（画面の座標）。指す点 (ax, ay) が画面の左半分なら右へ、右半分なら左へ。はみ出すなら反対へ（§5）</summary>
        public static Vector2 CardPos(float ax, float ay, float w)
        {
            bool right = ax < 844f;
            if (right && ax + 70f + w > 1664f) right = false;
            else if (!right && ax - 70f - w < 24f) right = true;
            float left = right ? ax + 70f : ax - 70f - w;
            left = Mathf.Clamp(left, 24f, Mathf.Max(24f, 1664f - w));
            return new Vector2(left, Mathf.Max(ay - 124f, 16f));
        }
    }
}
