using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 敵の行動予告の矢印（ブラウザ版 renderDeclarations の「攻撃レーザー」と同じ考え方）:
    /// 攻撃を予告した敵から、狙う味方へ、弧を描く赤い矢印。外側に脈打つ赤いにじみ、先に矢じり。
    /// どの向き・真上から見ても読めるよう、弧は上へふくらませ、矢印が重なるときは横へも少しずらす
    /// </summary>
    public partial class Board3DView
    {
        private static readonly Color IntentLineColor = new Color(0.95f, 0.28f, 0.32f, 0.96f);   // ブラウザ版 .declAttackLine
        private static readonly Color IntentAuraColor = new Color(0.75f, 0.11f, 0.18f, 0.34f);    // ブラウザ版 .declAttackAura

        private class IntentArrow
        {
            public string from, to;
            public int index;
            public LineRenderer line, aura, head;
        }

        private readonly List<IntentArrow> intentArrows = new List<IntentArrow>();
        private Material intentMaterial;

        /// <summary>行動予告の矢印を出し直す（敵の id → 狙う味方の id）。空なら消す</summary>
        public void SetIntentArrows(IEnumerable<(string from, string to)> pairs)
        {
            foreach (var a in intentArrows)
            {
                if (a.line != null) Object.DestroyImmediate(a.line.gameObject);
                if (a.aura != null) Object.DestroyImmediate(a.aura.gameObject);
                if (a.head != null) Object.DestroyImmediate(a.head.gameObject);
            }
            intentArrows.Clear();
            if (pairs == null || boardRoot == null) return;
            int index = 0;
            foreach (var (from, to) in pairs)
            {
                var arrow = new IntentArrow { from = from, to = to, index = index++ };
                arrow.aura = NewIntentLine($"IntentAura_{from}", 0.2f, IntentAuraColor, 0);
                arrow.line = NewIntentLine($"IntentLine_{from}", 0.055f, IntentLineColor, 1);
                arrow.head = NewIntentLine($"IntentHead_{from}", 0.22f, new Color(1f, 0.44f, 0.46f, 0.98f), 2);
                arrow.head.widthCurve = AnimationCurve.Linear(0f, 1f, 1f, 0f);   // 太い所から先へ細くなる＝矢じり
                intentArrows.Add(arrow);
            }
            UpdateIntentArrows();
        }

        public int IntentArrowCount => intentArrows.Count;

        private LineRenderer NewIntentLine(string objectName, float width, Color color, int orderOffset)
        {
            if (intentMaterial == null) intentMaterial = new Material(SpriteMaterial()) { name = "IntentArrow" };
            var go = new GameObject(objectName);
            go.transform.SetParent(boardRoot, false);
            go.layer = UnitLayer;   // マップ表（真上の絵）には写さない
            var lr = go.AddComponent<LineRenderer>();
            lr.useWorldSpace = true;
            lr.alignment = LineAlignment.View;   // いつもカメラの方を向く帯
            lr.widthMultiplier = width;
            lr.numCapVertices = 4;
            lr.numCornerVertices = 2;
            lr.sharedMaterial = intentMaterial;
            lr.startColor = lr.endColor = color;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;
            lr.sortingOrder = OrderCharacter + 2 + orderOffset;
            return lr;
        }

        /// <summary>キャラが動いたとき・カメラが動いたときに、矢印の位置を合わせる（UpdateBillboards から毎回）</summary>
        private void UpdateIntentArrows()
        {
            if (intentArrows.Count == 0 || map == null) return;
            float pulse = 0.75f + 0.25f * Mathf.Sin(Time.realtimeSinceStartup * 5.2f);   // ブラウザ版 declDangerPulse
            foreach (var a in intentArrows)
            {
                unitVisuals.TryGetValue(a.from, out var from);
                unitVisuals.TryGetValue(a.to, out var to);
                bool show = from?.billboard != null && to?.billboard != null
                    && from.billboard.holder.gameObject.activeInHierarchy && to.billboard.holder.gameObject.activeInHierarchy;
                a.line.gameObject.SetActive(show);
                a.aura.gameObject.SetActive(show);
                a.head.gameObject.SetActive(show);
                if (!show) continue;
                var start = transform.TransformPoint(map.TopCenter(from.unit.cell)) + Vector3.up * unitHeight * 0.55f;
                var end = transform.TransformPoint(map.TopCenter(to.unit.cell)) + Vector3.up * unitHeight * 0.45f;
                var d = end - start;
                float length = d.magnitude;
                if (length < 0.01f) continue;
                var dir = d / length;
                // 端はキャラの絵に少しかからないように縮める
                start += dir * 0.3f;
                end -= dir * 0.38f;
                var side = Vector3.Cross(Vector3.up, dir).normalized * (0.35f + 0.15f * (a.index % 3)) * (a.index % 2 == 0 ? 1f : -1f);
                var lift = Vector3.up * Mathf.Clamp(length * 0.28f, 0.5f, 1.6f);
                const int n = 24;
                var points = new Vector3[n];
                for (int i = 0; i < n; i++)
                {
                    float t = i / (n - 1f);
                    float bulge = 4f * t * (1f - t);
                    points[i] = Vector3.Lerp(start, end, t) + (lift + side) * bulge;
                }
                a.line.positionCount = n;
                a.line.SetPositions(points);
                a.aura.positionCount = n;
                a.aura.SetPositions(points);
                var auraColor = new Color(IntentAuraColor.r, IntentAuraColor.g, IntentAuraColor.b, IntentAuraColor.a * pulse);
                a.aura.startColor = a.aura.endColor = auraColor;
                // 矢じり: 最後の区間の向きに、短い三角（太い所から先へ細くなる帯）
                var tip = points[n - 1];
                var back = tip - (points[n - 1] - points[n - 3]).normalized * 0.3f;
                a.head.positionCount = 2;
                a.head.SetPosition(0, back);
                a.head.SetPosition(1, tip + (points[n - 1] - points[n - 3]).normalized * 0.08f);
            }
        }
    }
}
