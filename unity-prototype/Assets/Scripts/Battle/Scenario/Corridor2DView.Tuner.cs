using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// ゲームの中の見え方の調整画面（2026-10-04。docs/10-design/map/SIDE_SCROLL_2D_LOOK_PRESETS_2026-10-04.md §4 の3）。
    /// 画面の左上を素早く5回たたく（パソコンは F2）と開く。つまみで効果を動かすとその場で見え方が変わり、
    /// 「コピー」で見え方のプリセットの文（Assets/Data/Looks/&lt;名前&gt;.json と同じ形）を写す。原作者が総合担当に貼り、総合担当がファイルに保存する。
    /// 色（霞の色・光の色など）は調整ページ（debug/corridor_layers.html）で決める
    /// </summary>
    public partial class Corridor2DView
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void SrpgCopyText(string text);
#endif

        /// <summary>組み立て直したあと（見え方の切り替え・調整）。人を並べ直すのに使う</summary>
        public event Action Rebuilt;

        private string lookTextOverride;                  // 調整中の見え方（ファイルの代わりに使う）
        private readonly Dictionary<string, (float haze, float blur)> layerValues = new Dictionary<string, (float, float)>();
        private GameObject tuner;
        private RectTransform tunerContent;
        private Text tunerTitle, tunerNote;
        private InputField tunerOut;
        private bool tunerDirty;
        private float tunerChanged, tunerApplied;
        private int hotTaps;
        private float hotLast;

        public bool TunerOpen => tuner != null && tuner.activeSelf;

        private string LookText() => lookTextOverride ?? lookJson?.text;

        /// <summary>今の見え方で組み立て直す（アルシェの位置・向きはそのまま）</summary>
        private void RebuildKeep()
        {
            float x = playerX;
            bool left = facingLeft;
            Build();
            playerX = x;
            facingLeft = left;
            Apply();
            Rebuilt?.Invoke();
        }

        /// <summary>左上の見えない押し場所（5回で調整画面）</summary>
        private void BuildTunerHotspot(Transform parent)
        {
            var rt = NewRect("調整の入口", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = new Vector2(70f, 50f);
            rt.anchoredPosition = Vector2.zero;
            rt.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var b = rt.gameObject.AddComponent<Button>();
            b.transition = Selectable.Transition.None;
            b.onClick.AddListener(() =>
            {
                float now = Time.realtimeSinceStartup;
                hotTaps = now - hotLast < 0.6f ? hotTaps + 1 : 1;
                hotLast = now;
                if (hotTaps >= 5) { hotTaps = 0; OpenTuner(); }
            });
        }

        private void UpdateTuner()
        {
            if (Keyboard.current != null && Keyboard.current.f2Key.wasPressedThisFrame) { if (TunerOpen) tuner.SetActive(false); else OpenTuner(); }
            // つまみを動かしている間は 0.2 秒ごとに組み立て直す（スマホで重くならないように）
            if (tunerDirty && Time.unscaledTime - tunerApplied > 0.2f && Time.unscaledTime - tunerChanged > 0.05f)
            {
                tunerDirty = false;
                tunerApplied = Time.unscaledTime;
                lookTextOverride = JsonUtility.ToJson(look, true);
                RebuildKeep();
            }
        }

        public void OpenTuner()
        {
            if (look == null) return;
            if (tuner == null) BuildTuner();
            tuner.SetActive(true);
            FillTuner();
        }

        // ── 画面 ──

        private Font TunerFont => JapaneseFont.Get(new[] { "Noto Serif JP", "Yu Mincho", "MS PMincho" }, 12);

        private void BuildTuner()
        {
            // 見え方を組み立て直しても消えないよう、回廊の外に置く
            tuner = new GameObject("見え方の調整", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = tuner.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 400;
            var scaler = tuner.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(ScreenW, ScreenH);
            scaler.matchWidthOrHeight = 1f;

            var panel = NewRect("Panel", tuner.transform);
            panel.anchorMin = new Vector2(1f, 0f); panel.anchorMax = new Vector2(1f, 1f); panel.pivot = new Vector2(1f, 0.5f);
            panel.sizeDelta = new Vector2(300f, -16f);
            panel.anchoredPosition = new Vector2(-8f, 0f);
            panel.gameObject.AddComponent<Image>().color = new Color(0.04f, 0.07f, 0.1f, 0.9f);
            panel.gameObject.AddComponent<Outline>().effectColor = new Color(0.84f, 0.84f, 0.88f, 0.6f);

            tunerTitle = TunerText(panel, 12, TextAnchor.MiddleLeft);
            Place(tunerTitle.rectTransform, 10f, 6f, 280f, 18f);
            float bx = 10f;
            foreach (var (label, act) in new (string, Action)[] { ("見え方を替える", NextLook), ("コピー", CopyLook), ("元に戻す", ResetLook), ("閉じる", () => tuner.SetActive(false)) })
            {
                var rt = NewRect(label, panel);
                float w = label.Length * 12f + 14f;
                Place(rt, bx, 26f, w, 24f);
                bx += w + 4f;
                rt.gameObject.AddComponent<Image>().color = new Color(0.12f, 0.2f, 0.26f, 1f);
                rt.gameObject.AddComponent<Button>().onClick.AddListener(() => act());
                var t = TunerText(rt, 11, TextAnchor.MiddleCenter);
                t.text = label;
                t.rectTransform.anchorMin = Vector2.zero; t.rectTransform.anchorMax = Vector2.one; t.rectTransform.sizeDelta = Vector2.zero;
            }
            tunerNote = TunerText(panel, 10, TextAnchor.UpperLeft);
            Place(tunerNote.rectTransform, 10f, 52f, 280f, 28f);

            // つまみの並び（たてに流せる）
            var view = NewRect("Scroll", panel);
            view.anchorMin = new Vector2(0f, 0f); view.anchorMax = new Vector2(1f, 1f);
            view.offsetMin = new Vector2(6f, 6f); view.offsetMax = new Vector2(-6f, -82f);
            view.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.01f);
            view.gameObject.AddComponent<RectMask2D>();
            tunerContent = NewRect("Content", view);
            tunerContent.anchorMin = new Vector2(0f, 1f); tunerContent.anchorMax = new Vector2(1f, 1f); tunerContent.pivot = new Vector2(0.5f, 1f);
            tunerContent.sizeDelta = Vector2.zero;
            var scroll = view.gameObject.AddComponent<ScrollRect>();
            scroll.content = tunerContent;
            scroll.horizontal = false;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 20f;

            // コピーした文（自分で選んで写せるように）
            var outRt = NewRect("Out", tuner.transform);
            outRt.anchorMin = new Vector2(0f, 0f); outRt.anchorMax = new Vector2(0f, 1f); outRt.pivot = new Vector2(0f, 0.5f);
            outRt.sizeDelta = new Vector2(ScreenW - 330f, -40f);
            outRt.anchoredPosition = new Vector2(12f, 0f);
            outRt.gameObject.AddComponent<Image>().color = new Color(0.03f, 0.05f, 0.07f, 0.94f);
            var outText = TunerText(outRt, 9, TextAnchor.UpperLeft);
            outText.rectTransform.anchorMin = Vector2.zero; outText.rectTransform.anchorMax = Vector2.one;
            outText.rectTransform.offsetMin = new Vector2(8f, 8f); outText.rectTransform.offsetMax = new Vector2(-8f, -8f);
            outText.supportRichText = false;
            tunerOut = outRt.gameObject.AddComponent<InputField>();
            tunerOut.textComponent = outText;
            tunerOut.lineType = InputField.LineType.MultiLineNewline;
            tunerOut.readOnly = true;
            outRt.gameObject.SetActive(false);
        }

        private Text TunerText(Transform parent, int size, TextAnchor anchor)
        {
            var t = NewRect("Text", parent).gameObject.AddComponent<Text>();
            t.font = TunerFont; t.fontSize = size; t.alignment = anchor;
            t.color = new Color(0.92f, 0.94f, 0.95f);
            t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        /// <summary>今の見え方の値で、つまみを並べ直す</summary>
        private void FillTuner()
        {
            foreach (Transform c in tunerContent.Cast<Transform>().ToList()) { if (Application.isPlaying) Destroy(c.gameObject); else DestroyImmediate(c.gameObject); }
            tunerTitle.text = $"見え方の調整：{look.look}";
            tunerNote.text = "動かすとすぐ変わる。「コピー」の文を総合担当へ。色は調整ページで。";
            var e = look.effects;
            var c2 = e.chara ?? (e.chara = new LookChara());
            float y = 0f;
            void Head(string text)
            {
                var t = TunerText(tunerContent, 10, TextAnchor.MiddleLeft);
                t.text = text;
                t.color = new Color(0.55f, 0.8f, 0.82f);
                Place(t.rectTransform, 4f, y + 2f, 270f, 16f);
                y += 20f;
            }
            void Row(string label, float min, float max, Func<float> get, Action<float> set)
            {
                var name = TunerText(tunerContent, 10, TextAnchor.MiddleLeft);
                name.text = label;
                Place(name.rectTransform, 4f, y, 92f, 20f);
                var value = TunerText(tunerContent, 10, TextAnchor.MiddleRight);
                Place(value.rectTransform, 238f, y, 40f, 20f);
                var rt = NewRect("Slider_" + label, tunerContent);
                Place(rt, 98f, y + 5f, 136f, 10f);
                var track = NewRect("Track", rt).gameObject.AddComponent<Image>();
                track.color = new Color(0f, 0f, 0f, 0.6f);
                track.rectTransform.anchorMin = Vector2.zero; track.rectTransform.anchorMax = Vector2.one; track.rectTransform.sizeDelta = Vector2.zero;
                var handleArea = NewRect("HandleArea", rt);
                handleArea.anchorMin = Vector2.zero; handleArea.anchorMax = Vector2.one; handleArea.sizeDelta = Vector2.zero;
                var handle = NewRect("Handle", handleArea).gameObject.AddComponent<Image>();
                handle.color = new Color(0.62f, 0.86f, 0.88f);
                handle.rectTransform.anchorMin = new Vector2(0f, 0f); handle.rectTransform.anchorMax = new Vector2(0f, 1f);
                handle.rectTransform.sizeDelta = new Vector2(14f, 8f);
                var s = rt.gameObject.AddComponent<Slider>();
                s.handleRect = handle.rectTransform;
                s.targetGraphic = handle;
                s.minValue = min; s.maxValue = max;
                s.SetValueWithoutNotify(Mathf.Clamp(get(), min, max));
                value.text = get().ToString(max - min > 20f ? "0" : "0.00");
                s.onValueChanged.AddListener(v =>
                {
                    set(v);
                    value.text = v.ToString(max - min > 20f ? "0" : "0.00");
                    tunerDirty = true;
                    tunerChanged = Time.unscaledTime;
                });
                y += 22f;
            }
            Head("画面全体");
            Row("空気遠近", 0f, 1f, () => e.haze, v => e.haze = v);
            Row("奥のぼかし", 0f, 6f, () => e.dof, v => e.dof = v);
            Row("明るさ", 0.5f, 1.5f, () => e.bright, v => e.bright = v);
            Row("コントラスト", 0.5f, 1.5f, () => e.contrast, v => e.contrast = v);
            Row("彩度", 0f, 2f, () => e.saturate, v => e.saturate = v);
            Row("色温度", -1f, 1f, () => e.temp, v => e.temp = v);
            Row("オーバーレイ", 0f, 1f, () => e.ovl, v => e.ovl = v);
            Row("ヴィネット", 0f, 1f, () => e.vignette, v => e.vignette = v);
            Row("暗くしない広さ", 0.2f, 0.95f, () => e.vignetteSize, v => e.vignetteSize = v);
            Head("光の筋");
            Row("強さ", 0f, 1f, () => e.shafts, v => e.shafts = v);
            Row("角度", -45f, 45f, () => e.shaftAngle, v => e.shaftAngle = v);
            Row("高さ（＋下）", -150f, 150f, () => e.shaftY, v => e.shaftY = v);
            Row("左右", -300f, 300f, () => e.shaftX, v => e.shaftX = v);
            Row("太さ", 0.3f, 2.5f, () => e.shaftWidth, v => e.shaftWidth = v);
            Row("やわらかさ", 0f, 20f, () => e.shaftSoft, v => e.shaftSoft = v);
            Row("にじみ", 0f, 1.5f, () => e.shaftGlow, v => e.shaftGlow = v);
            Head("層ごと（動かすと自動でなくなる）");
            foreach (var (layer, _, _, _) in built)
            {
                string n = layer.name;
                var (h0, b0) = layerValues.TryGetValue(n, out var cur) ? cur : (0f, 0f);
                string shortName = n.Length > 6 ? n.Substring(0, 6) : n;
                Row($"{shortName} 霞", 0f, 1f, () => LayerOverride(n).haze >= 0f ? LayerOverride(n).haze : h0, v => { var o = LayerOverride(n); if (o.blur < 0f) o.blur = b0; o.haze = v; });
                Row($"{shortName} ぼかし", 0f, 8f, () => LayerOverride(n).blur >= 0f ? LayerOverride(n).blur : b0, v => { var o = LayerOverride(n); if (o.haze < 0f) o.haze = h0; o.blur = v; });
            }
            Head("キャラ（アルシェ・人）");
            Row("霞", 0f, 1f, () => c2.haze, v => c2.haze = v);
            Row("ぼかし", 0f, 8f, () => c2.blur, v => c2.blur = v);
            Row("明るさ", 0.4f, 1.6f, () => c2.bright, v => c2.bright = v);
            Row("なじませ", 0f, 1f, () => c2.tint, v => c2.tint = v);
            tunerContent.sizeDelta = new Vector2(0f, y + 8f);
        }

        /// <summary>その層の上書き（なければ足す。−1＝自動）</summary>
        private LookLayer LayerOverride(string name)
        {
            var list = (look.layers ?? Array.Empty<LookLayer>()).ToList();
            var o = list.FirstOrDefault(l => l.name == name);
            if (o == null) { o = new LookLayer { name = name, haze = -1f, blur = -1f }; list.Add(o); look.layers = list.ToArray(); }
            return o;
        }

        private void NextLook()
        {
            var names = lookJsons.Where(t => t != null).Select(t => t.name).ToList();
            if (names.Count == 0) return;
            int i = names.IndexOf(look?.look ?? "");
            lookTextOverride = null;
            string next = names[(i + 1) % names.Count];
            lookJson = lookJsons.First(t => t != null && t.name == next);
            RebuildKeep();
            FillTuner();
        }

        private void ResetLook()
        {
            lookTextOverride = null;
            var asset = lookJsons.FirstOrDefault(t => t != null && t.name == look?.look);
            if (asset != null) lookJson = asset;
            RebuildKeep();
            FillTuner();
        }

        private void CopyLook()
        {
            // 0.2599999904… のような長い小数を、小数第3位までに丸める（読みやすく）
            string text = System.Text.RegularExpressions.Regex.Replace(JsonUtility.ToJson(look, true), @"-?\d+\.\d{4,}",
                m => Math.Round(double.Parse(m.Value, System.Globalization.CultureInfo.InvariantCulture), 3).ToString("0.###", System.Globalization.CultureInfo.InvariantCulture));
#if UNITY_WEBGL && !UNITY_EDITOR
            SrpgCopyText(text);
#else
            GUIUtility.systemCopyBuffer = text;
#endif
            tunerOut.text = text;
            tunerOut.gameObject.SetActive(true);
            tunerNote.text = "コピーした（左の文）。写せていなければ、もう一度画面をタップするか、左の文を選んで写す。";
        }

        /// <summary>層の効果の値を覚える（調整画面の「自動」の値に使う。ApplyLayerEffects から）</summary>
        private void RememberLayer(string name, float haze, float blur) => layerValues[name] = (haze, blur);

    }
}
