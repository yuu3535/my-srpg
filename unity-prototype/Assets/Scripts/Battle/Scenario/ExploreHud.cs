using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 探索の画面の表示（レビュー 2026-09-28_2 の直し）:
    ///   頭上の印（話せる人「！」・話し終えた人「…」・調べられる所「？」。先へ進むのに要る所は金、ほかは淡く）・扉の行き先の札（J4）、
    ///   今の目的の1行（J2。携帯端末のタスクができるまでの代わり）、短いお知らせの帯（J1: 手に入れた・場所に入った・行けない）。
    /// 会話の画面（200）より奥、盤面より手前（150）に描く
    /// </summary>
    public class ExploreHud : MonoBehaviour
    {
        public enum MarkKind { Talk, Talked, Inspect, InspectRequired, Inspected, Door, DoorLocked }

        private const float ScreenW = 844f, ScreenH = 390f;
        private static readonly Color Gold = new Color32(239, 208, 129, 255);
        private static readonly Color Ivory = new Color32(243, 226, 182, 255);
        private static readonly Color Plate = new Color32(20, 12, 30, 225);

        private Camera targetCamera;
        private Font font, boldFont;
        private Canvas canvas;
        private RectTransform root, markRoot;
        private Text objectiveText, toastText;
        private RectTransform objective, toast;
        private float toastUntil;

        private class Mark
        {
            public Func<Vector3> screen;   // 画面の位置（px。z が負なら出さない）
            public RectTransform rt;
        }

        private readonly List<Mark> marks = new List<Mark>();

        /// <summary>隠すか（会話の画面が出ている間は、探索の表示を隠す）</summary>
        public Func<bool> Hidden;

        public void Build(Camera camera, Font regular, Font bold)
        {
            targetCamera = camera;
            font = regular != null ? regular : JapaneseFont.Get(new[] { "Noto Serif JP", "Yu Mincho" }, 16);
            boldFont = bold != null ? bold : font;
            if (canvas != null) return;
            var go = new GameObject("ExploreHud", typeof(Canvas), typeof(CanvasScaler));
            go.transform.SetParent(transform, false);
            canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = camera;
            canvas.planeDistance = 0.95f;
            canvas.sortingOrder = 150;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(ScreenW, ScreenH);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;
            root = NewRect("Root", go.transform);
            Stretch(root);
            markRoot = NewRect("Marks", root);
            Stretch(markRoot);

            // 今の目的（左上）
            objective = NewRect("Objective", root);
            objective.anchorMin = objective.anchorMax = new Vector2(0f, 1f);
            objective.pivot = new Vector2(0f, 1f);
            objective.sizeDelta = new Vector2(300f, 22f);
            objective.anchoredPosition = new Vector2(12f, -10f);
            var objBg = objective.gameObject.AddComponent<RawImage>();
            objBg.texture = Band(Plate, fadeRight: true);
            objBg.raycastTarget = false;
            var head = NewText("Head", objective, boldFont, 10, Gold, TextAnchor.MiddleLeft);
            head.text = "目的";
            Place(head.rectTransform, 10f, 0f, 36f, 22f);
            objectiveText = NewText("Text", objective, font, 11, Ivory, TextAnchor.MiddleLeft);
            Place(objectiveText.rectTransform, 44f, 0f, 250f, 22f);

            // お知らせの帯（上の中央）
            toast = NewRect("Toast", root);
            toast.anchorMin = toast.anchorMax = new Vector2(0.5f, 1f);
            toast.pivot = new Vector2(0.5f, 1f);
            toast.sizeDelta = new Vector2(360f, 24f);
            toast.anchoredPosition = new Vector2(0f, -44f);
            var toastBg = toast.gameObject.AddComponent<RawImage>();
            toastBg.texture = Band(Plate, fadeRight: false);
            toastBg.raycastTarget = false;
            toastText = NewText("Text", toast, boldFont, 12, Gold, TextAnchor.MiddleCenter);
            Stretch(toastText.rectTransform);
            toast.gameObject.SetActive(false);
        }

        public void SetObjective(string text)
        {
            if (objective == null) return;
            objective.gameObject.SetActive(!string.IsNullOrEmpty(text));
            objectiveText.text = text ?? "";
        }

        /// <summary>短いお知らせ（手に入れた・場所に入った・行けない）。▶では seconds 秒で消える</summary>
        public void Toast(string text, float seconds = 2.2f)
        {
            if (toast == null) return;
            toastText.text = text;
            toast.gameObject.SetActive(true);
            toastUntil = Time.realtimeSinceStartup + seconds;
        }

        public void HideToast() { if (toast != null) toast.gameObject.SetActive(false); }

        public void ClearMarks()
        {
            foreach (var m in marks) if (m.rt != null) Remove(m.rt.gameObject);
            marks.Clear();
        }

        /// <summary>印を足す（頭上の「！」「…」「？」、扉の札）。screen は画面の位置（px）を返す</summary>
        public void AddMark(MarkKind kind, Func<Vector3> screen, string label = null)
        {
            if (markRoot == null) return;
            var rt = NewRect("Mark_" + kind, markRoot);
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0f);
            bool door = kind == MarkKind.Door || kind == MarkKind.DoorLocked;
            if (door)
            {
                // 扉の札: 行き先の名前と ▲（押すとそこへ行く）
                rt.sizeDelta = new Vector2(Mathf.Max(60f, (label ?? "").Length * 11f + 26f), 18f);
                var bg = rt.gameObject.AddComponent<RawImage>();
                bg.texture = Band(Plate, fadeRight: false);
                bg.raycastTarget = false;
                var t = NewText("Text", rt, font, 10, kind == MarkKind.Door ? Ivory : new Color(0.7f, 0.66f, 0.72f, 1f), TextAnchor.MiddleCenter);
                t.text = (kind == MarkKind.Door ? "▲ " : "") + label;
                Stretch(t.rectTransform);
            }
            else
            {
                // 頭上の印: 黒紫の丸に金の文字
                // 先へ進むのに要る所・話すと先へ進む人は大きく、寄り道は小さく淡く
                float size = kind == MarkKind.InspectRequired || kind == MarkKind.Talk ? 26f : kind == MarkKind.Inspect ? 17f : 15f;
                rt.sizeDelta = new Vector2(size, size);
                var bg = rt.gameObject.AddComponent<Image>();
                bg.sprite = Circle();
                bg.color = kind == MarkKind.Talked || kind == MarkKind.Inspected ? new Color(0.08f, 0.05f, 0.12f, 0.55f) : new Color(0.08f, 0.05f, 0.12f, 0.9f);
                bg.raycastTarget = false;
                var t = NewText("Text", rt, boldFont, kind == MarkKind.InspectRequired || kind == MarkKind.Talk ? 16 : 11, Gold, TextAnchor.MiddleCenter);
                t.text = kind == MarkKind.Talk ? "！" : kind == MarkKind.Talked ? "…" : "？";
                t.color = kind == MarkKind.Talk || kind == MarkKind.InspectRequired ? Gold
                    : kind == MarkKind.Inspect ? new Color(Gold.r, Gold.g, Gold.b, 0.75f) : new Color(0.75f, 0.7f, 0.8f, 0.7f);
                Stretch(t.rectTransform);
            }
            marks.Add(new Mark { screen = screen, rt = rt });
            Place(marks[marks.Count - 1]);
        }

        /// <summary>印を今の画面の位置に合わせる（カメラやキャラが動いたら）</summary>
        public void Refresh()
        {
            if (root != null) root.gameObject.SetActive(Hidden == null || !Hidden());
            foreach (var m in marks) Place(m);
            if (toast != null && toast.gameObject.activeSelf && Application.isPlaying && Time.realtimeSinceStartup > toastUntil) toast.gameObject.SetActive(false);
        }

        private void LateUpdate() => Refresh();

        private void Place(Mark m)
        {
            if (m.rt == null || canvas == null) return;
            var p = m.screen();
            bool show = p.z > 0f;
            m.rt.gameObject.SetActive(show);
            if (!show) return;
            var cam = canvas.worldCamera;
            var rect = cam != null ? cam.pixelRect : new Rect(0, 0, Screen.width, Screen.height);
            float scale = Mathf.Max(0.0001f, canvas.scaleFactor);
            float bob = Application.isPlaying ? Mathf.Sin(Time.time * 3f) * 1.5f : 0f;
            m.rt.anchoredPosition = new Vector2((p.x - rect.center.x) / scale, (p.y - rect.center.y) / scale + bob);
        }

        // ── 部品 ──

        private static Sprite circle;
        private static Sprite Circle()
        {
            if (circle != null) return circle;
            const int n = 64;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < n; y++)
            for (int x = 0; x < n; x++)
            {
                float dx = (x + 0.5f) / n * 2f - 1f, dy = (y + 0.5f) / n * 2f - 1f;
                float r = Mathf.Sqrt(dx * dx + dy * dy);
                float ring = Mathf.Clamp01(1f - Mathf.Abs(r - 0.9f) / 0.07f);   // 金の細い縁
                float a = r <= 0.95f ? 1f : 0f;
                var c = Color.Lerp(Color.white, new Color(0.84f, 0.65f, 0.25f, 1f), ring);
                tex.SetPixel(x, y, new Color(c.r, c.g, c.b, a));
            }
            tex.Apply();
            circle = Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), n);
            return circle;
        }

        private static Texture2D Band(Color color, bool fadeRight)
        {
            const int n = 64;
            var tex = new Texture2D(n, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int x = 0; x < n; x++)
            {
                float t = x / (n - 1f);
                float a = fadeRight ? color.a * (1f - Mathf.SmoothStep(0.6f, 1f, t)) : color.a * Mathf.Clamp01(Mathf.Min(t, 1f - t) * 6f);
                tex.SetPixel(x, 0, new Color(color.r, color.g, color.b, a));
            }
            tex.Apply();
            return tex;
        }

        private static void Remove(GameObject go)
        {
            if (Application.isPlaying) Destroy(go); else DestroyImmediate(go);
        }

        private static RectTransform NewRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        private static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }

        private static void Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
        }

        private static Text NewText(string name, Transform parent, Font font, int size, Color color, TextAnchor anchor)
        {
            var text = NewRect(name, parent).gameObject.AddComponent<Text>();
            text.font = font;
            text.fontSize = size;
            text.color = color;
            text.alignment = anchor;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            return text;
        }
    }
}
