using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// タップの波紋（全画面共通。探索の仕様書 §9・TapFX。2026-11-14）。どの画面でも、押した所に銀の菱形が広がって消える。
    /// 28px の菱形の枠が 0.3倍 → 2.1倍に広がりながら消え、中心の 8px の菱形は 1.4倍 → 0.2倍に縮んで消える（.42秒）。
    /// ボタンの上では少し強く（.5秒・光つき）。同時に6個まで。押した物の邪魔はしない（いちばん手前に描くだけで、押せない）
    /// </summary>
    public class TapRipple : MonoBehaviour
    {
        public static TapRipple Instance { get; private set; }
        private static readonly Color Silver = new Color(0xee / 255f, 0xf0 / 255f, 0xf4 / 255f);
        private static readonly Color GlowColor = new Color(214 / 255f, 226 / 255f, 240 / 255f, 0.55f);
        private const int Max = 6;

        private RectTransform root;
        private readonly List<Ripple> live = new List<Ripple>();
        private readonly List<RaycastResult> hits = new List<RaycastResult>();

        private class Ripple
        {
            public RectTransform rt, ring, dot, glow;
            public RawImage ringImg, dotImg, glowImg;
            public float t, length;
            public bool strong;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (Instance != null) return;
            var go = new GameObject("TapRipple", typeof(Canvas), typeof(CanvasScaler));
            DontDestroyOnLoad(go);
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 1000;   // いちばん手前（セーブ・設定 600 より上）
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1688f, 780f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;   // Hub2 と同じ
            Instance = go.AddComponent<TapRipple>();
            Instance.root = (RectTransform)go.transform;
        }

        private void Update()
        {
            var pointer = Pointer.current;
            if (pointer != null && pointer.press.wasPressedThisFrame) Spawn(pointer.position.ReadValue());
            float dt = Time.unscaledDeltaTime;
            for (int i = live.Count - 1; i >= 0; i--)
            {
                var r = live[i];
                r.t += dt;
                float k = Mathf.Clamp01(r.t / r.length);
                if (r.t >= 0.7f || k >= 1f) { Destroy(r.rt.gameObject); live.RemoveAt(i); continue; }
                float e = 1f - Mathf.Pow(1f - k, 3f);
                r.ring.localScale = Vector3.one * Mathf.Lerp(0.3f, 2.1f, e);
                r.ringImg.color = new Color(Silver.r, Silver.g, Silver.b, Hub2Textures.SeenLight((r.strong ? 1f : 0.9f) * (1f - k), 0.9f, 0.2f));
                r.dot.localScale = Vector3.one * Mathf.Lerp(1.4f, 0.2f, e);
                r.dotImg.color = new Color(Silver.r, Silver.g, Silver.b, Hub2Textures.SeenLight(1f - k, 0.9f, 0.2f));
                if (r.glow != null)
                {
                    r.glow.localScale = Vector3.one * Mathf.Lerp(0.6f, 1.6f, e);
                    r.glowImg.color = new Color(GlowColor.r, GlowColor.g, GlowColor.b, GlowColor.a * 0.6f * (1f - k));
                }
            }
        }

        /// <summary>screen（画面の点）に波紋を出す</summary>
        public void Spawn(Vector2 screen)
        {
            if (root == null) return;
            if (live.Count >= Max) { Destroy(live[0].rt.gameObject); live.RemoveAt(0); }
            RectTransformUtility.ScreenPointToLocalPointInRectangle(root, screen, null, out var local);
            bool strong = OverButton(screen);
            var r = new Ripple { strong = strong, length = strong ? 0.5f : 0.42f };
            r.rt = Node("Ripple", root);
            r.rt.anchoredPosition = local;
            if (strong)
            {
                r.glowImg = Img("Glow", r.rt, Hub2Textures.Glow, 64f);
                r.glow = r.glowImg.rectTransform;
            }
            r.ringImg = Img("Ring", r.rt, ExploreTextures.DiamondRing, 28f);
            r.ring = r.ringImg.rectTransform;
            r.dotImg = Img("Dot", r.rt, Hub2Textures.Diamond, 8f);
            r.dot = r.dotImg.rectTransform;
            live.Add(r);
            r.t = 0f;
            Update0(r);
        }

        private void Update0(Ripple r)
        {
            r.ring.localScale = Vector3.one * 0.3f;
            r.dot.localScale = Vector3.one * 1.4f;
        }

        /// <summary>押した所にボタン（Selectable）があるか</summary>
        private bool OverButton(Vector2 screen)
        {
            var es = EventSystem.current;
            if (es == null) return false;
            hits.Clear();
            es.RaycastAll(new PointerEventData(es) { position = screen }, hits);
            if (hits.Count == 0 || hits[0].gameObject == null) return false;
            // いちばん手前に当たった物が、見えるボタン（全面の見えない受け皿は除く）
            var b = hits[0].gameObject.GetComponentInParent<Selectable>();
            if (b == null) return false;
            var g = b.GetComponent<Graphic>();
            return g == null || g.color.a > 0.01f || b.transform.childCount > 0 && b.GetComponent<RectTransform>().rect.width < 900f;
        }

        private static RectTransform Node(string name, Transform parent)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = Vector2.zero;
            return rt;
        }

        private static RawImage Img(string name, Transform parent, Texture tex, float size)
        {
            var rt = Node(name, parent);
            rt.sizeDelta = new Vector2(size, size);
            var ri = rt.gameObject.AddComponent<RawImage>();
            ri.texture = tex;
            ri.raycastTarget = false;
            return ri;
        }
    }
}
