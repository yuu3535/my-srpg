using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 立ち絵の位置の調整（原作者 2026-09-28: 今のUIでも自分で調整できるように。ブラウザ版の「立ち絵を5回たたくと調整パネル」と同じやり方）。
    /// 会話中に立ち絵を素早く5回たたくと、調整パネルが開く。大きさ・上下・左右をつまみで変え、「この表情」か「全表情」に保存する。
    /// 保存先: Unity のエディタで遊んだときは Assets/Data/portrait_adjust.json（コミットすれば全員に効く）、
    /// 書き出したゲームでは端末の中（persistentDataPath）。キーは「名前」（全表情）か「名前_表情」（その表情だけ）
    /// </summary>
    public partial class DialogueView
    {
        [Serializable]
        public class PortraitAdjust
        {
            public string key;
            public float zoom = 1f;   // 1 より大きいと大きく映す（見せる範囲を狭める）
            public float dx, dy;      // 左右・上下（見せる範囲の幅・高さに対する割合。+ で絵が右・上へ動く）
        }

        [Serializable]
        private class AdjustFile { public PortraitAdjust[] items = Array.Empty<PortraitAdjust>(); }

        [SerializeField] private TextAsset adjustJson;   // Assets/Data/portrait_adjust.json（あれば）

        private readonly Dictionary<string, PortraitAdjust> adjusts = new Dictionary<string, PortraitAdjust>();
        private RectTransform adjustPanel;
        private Text adjustTitle, adjustValues;
        private Slider zoomSlider, xSlider, ySlider;
        private string adjustWho, adjustExpression;
        private string tapWho;
        private int tapCount;
        private float lastTap;

        private static string EditorAdjustPath => Path.Combine(Application.dataPath, "Data", "portrait_adjust.json");
        private static string PlayerAdjustPath => Path.Combine(Application.persistentDataPath, "portrait_adjust.json");

        private static string AdjustKey(string who, string expression) => string.IsNullOrEmpty(expression) ? who : $"{who}_{expression}";

        private void LoadAdjustments()
        {
            adjusts.Clear();
            void Read(string text)
            {
                if (string.IsNullOrEmpty(text)) return;
                try
                {
                    foreach (var a in JsonUtility.FromJson<AdjustFile>(text).items ?? Array.Empty<PortraitAdjust>())
                        if (!string.IsNullOrEmpty(a.key)) adjusts[a.key] = a;
                }
                catch (Exception e) { Debug.LogWarning($"[DialogueView] 立ち絵の調整を読めなかった: {e.Message}"); }
            }
            if (Application.isEditor && File.Exists(EditorAdjustPath)) Read(File.ReadAllText(EditorAdjustPath));
            else if (adjustJson != null) Read(adjustJson.text);
            if (!Application.isEditor && File.Exists(PlayerAdjustPath)) Read(File.ReadAllText(PlayerAdjustPath));
        }

        private void SaveAdjustments()
        {
            var json = JsonUtility.ToJson(new AdjustFile { items = adjusts.Values.OrderBy(a => a.key, StringComparer.Ordinal).ToArray() }, true);
            string path = Application.isEditor ? EditorAdjustPath : PlayerAdjustPath;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllText(path, json);
                Debug.Log($"[DialogueView] 立ち絵の調整を保存した: {path}");
            }
            catch (Exception e) { Debug.LogWarning($"[DialogueView] 立ち絵の調整を保存できなかった: {e.Message}"); }
        }

        /// <summary>その人・表情の調整（表情の調整 → 全表情の調整 → なし）</summary>
        private PortraitAdjust AdjustOf(string who, string expression)
        {
            if (!string.IsNullOrEmpty(expression) && adjusts.TryGetValue(AdjustKey(who, expression), out var e)) return e;
            return adjusts.TryGetValue(who, out var a) ? a : null;
        }

        /// <summary>見せる範囲に調整をかける（大きさは真ん中を基準に、上下左右は見せる範囲に対する割合で）</summary>
        private static Rect AdjustedUv(Rect uv, PortraitAdjust a)
        {
            if (a == null) return uv;
            float zoom = Mathf.Clamp(a.zoom, 0.5f, 2.5f);
            float w = uv.width / zoom, h = uv.height / zoom;
            var center = uv.center - new Vector2(a.dx * w, a.dy * h);
            return new Rect(center.x - w * 0.5f, center.y - h * 0.5f, w, h);
        }

        /// <summary>立ち絵をたたいた: 1回目は会話を進める。素早く続けて5回たたくと調整パネル（ブラウザ版と同じ）</summary>
        private void OnPortraitTap(string who)
        {
            float now = Time.realtimeSinceStartup;
            if (who == tapWho && now - lastTap < 0.6f) tapCount++;
            else { tapCount = 1; tapWho = who; Advance(); }
            lastTap = now;
            if (tapCount >= 5) { tapCount = 0; OpenAdjuster(who); }
        }

        /// <summary>調整パネルを開く（その人の今の表情）</summary>
        public void OpenAdjuster(string who)
        {
            if (adjustPanel == null) return;
            adjustWho = who;
            adjustExpression = who == stage?.Speaker ? CurrentLine?.expression : null;
            var a = AdjustOf(who, adjustExpression) ?? new PortraitAdjust();
            adjustTitle.text = $"立ち絵の調整：{who}{(string.IsNullOrEmpty(adjustExpression) ? "" : $"（{adjustExpression}）")}";
            zoomSlider.SetValueWithoutNotify(a.zoom);
            xSlider.SetValueWithoutNotify(a.dx);
            ySlider.SetValueWithoutNotify(a.dy);
            adjustPanel.gameObject.SetActive(true);
            PreviewAdjust();
        }

        public bool AdjusterOpen => adjustPanel != null && adjustPanel.gameObject.activeSelf;

        private PortraitAdjust CurrentSliders() => new PortraitAdjust { zoom = zoomSlider.value, dx = xSlider.value, dy = ySlider.value };

        /// <summary>つまみを動かしたら、その人の立ち絵にすぐかける（保存はボタン）</summary>
        private void PreviewAdjust()
        {
            if (adjustWho == null) return;
            var a = CurrentSliders();
            adjustValues.text = $"大きさ {a.zoom:0.00}　左右 {a.dx:+0.00;-0.00;0.00}　上下 {a.dy:+0.00;-0.00;0.00}";
            if (actors.TryGetValue(adjustWho, out var image) && image != null)
            {
                var portrait = FindPortrait(adjustWho, adjustExpression);
                if (portrait.texture != null) image.uvRect = AdjustedUv(portrait.uv, a);
            }
        }

        private void SaveAdjust(bool allExpressions)
        {
            var a = CurrentSliders();
            a.key = allExpressions || string.IsNullOrEmpty(adjustExpression) ? adjustWho : AdjustKey(adjustWho, adjustExpression);
            adjusts[a.key] = a;
            if (allExpressions && !string.IsNullOrEmpty(adjustExpression))
                adjusts.Remove(AdjustKey(adjustWho, adjustExpression));   // 全表情に保存したら、その表情だけの調整は消す
            SaveAdjustments();
            adjustValues.text += "　保存した";
        }

        private void ResetAdjust()
        {
            zoomSlider.SetValueWithoutNotify(1f);
            xSlider.SetValueWithoutNotify(0f);
            ySlider.SetValueWithoutNotify(0f);
            PreviewAdjust();
        }

        private void CloseAdjuster()
        {
            if (adjustPanel != null) adjustPanel.gameObject.SetActive(false);
            adjustWho = null;
            if (CurrentLine != null) LayoutActors(CurrentLine);   // 保存した値（または元の値）で並べ直す
        }

        // ── 組み立て ──

        private void BuildAdjuster(Font font)
        {
            adjustPanel = NewRect("Adjuster", root);
            adjustPanel.anchorMin = adjustPanel.anchorMax = new Vector2(0.5f, 1f);
            adjustPanel.pivot = new Vector2(0.5f, 1f);
            adjustPanel.sizeDelta = new Vector2(380f, 168f);
            adjustPanel.anchoredPosition = new Vector2(0f, -8f);
            var bg = adjustPanel.gameObject.AddComponent<Image>();
            if (panelSprite != null) { bg.sprite = panelSprite; bg.type = Image.Type.Sliced; } else bg.color = new Color(0.05f, 0.03f, 0.08f, 0.96f);
            adjustTitle = NewText("Title", adjustPanel, boldFont != null ? boldFont : font, 12, NameGold, TextAnchor.MiddleLeft);
            PlaceTop(adjustTitle.rectTransform, 16f, 10f, 350f, 18f);
            zoomSlider = NewSlider("大きさ", 34f, 0.5f, 2.5f, font);
            xSlider = NewSlider("左右", 60f, -0.5f, 0.5f, font);
            ySlider = NewSlider("上下", 86f, -0.5f, 0.5f, font);
            adjustValues = NewText("Values", adjustPanel, font, 10, Ivory, TextAnchor.MiddleLeft);
            PlaceTop(adjustValues.rectTransform, 16f, 108f, 350f, 16f);
            NewButton("この表情に保存", 16f, () => SaveAdjust(false), font);
            NewButton("全表情に保存", 108f, () => SaveAdjust(true), font);
            NewButton("元に戻す", 200f, ResetAdjust, font);
            NewButton("閉じる", 276f, CloseAdjuster, font);
            adjustPanel.gameObject.SetActive(false);
        }

        private Slider NewSlider(string label, float y, float min, float max, Font font)
        {
            var name = NewText("Label_" + label, adjustPanel, font, 10, Ivory, TextAnchor.MiddleLeft);
            name.text = label;
            PlaceTop(name.rectTransform, 16f, y, 50f, 20f);
            var rt = NewRect("Slider_" + label, adjustPanel);
            PlaceTop(rt, 70f, y + 4f, 290f, 12f);
            var track = NewRect("Track", rt).gameObject.AddComponent<Image>();
            track.color = new Color(0f, 0f, 0f, 0.55f);
            Stretch(track.rectTransform);
            var fillArea = NewRect("FillArea", rt);
            Stretch(fillArea);
            var fill = NewRect("Fill", fillArea).gameObject.AddComponent<Image>();
            fill.color = new Color(GoldDeep.r, GoldDeep.g, GoldDeep.b, 0.45f);
            Stretch(fill.rectTransform);   // 横の長さはつまみの値に合わせて Slider が変える
            var handleArea = NewRect("HandleArea", rt);
            Stretch(handleArea);
            var handle = NewRect("Handle", handleArea).gameObject.AddComponent<Image>();
            handle.color = NameGold;
            handle.rectTransform.anchorMin = new Vector2(0f, 0f);
            handle.rectTransform.anchorMax = new Vector2(0f, 1f);
            handle.rectTransform.sizeDelta = new Vector2(12f, 6f);
            var slider = rt.gameObject.AddComponent<Slider>();
            slider.fillRect = fill.rectTransform;
            slider.handleRect = handle.rectTransform;
            slider.targetGraphic = handle;
            slider.minValue = min;
            slider.maxValue = max;
            slider.onValueChanged.AddListener(_ => PreviewAdjust());
            return slider;
        }

        private void NewButton(string label, float x, Action action, Font font)
        {
            var rt = NewRect("Button_" + label, adjustPanel);
            PlaceTop(rt, x, 132f, label.Length * 11f + 18f, 24f);
            var bg = rt.gameObject.AddComponent<Image>();
            bg.color = new Color(0.22f, 0.08f, 0.28f, 0.95f);
            var button = rt.gameObject.AddComponent<Button>();
            button.targetGraphic = bg;
            button.onClick.AddListener(() => action());
            var t = NewText("Text", rt, font, 10, NameGold, TextAnchor.MiddleCenter);
            t.text = label;
            Stretch(t.rectTransform);
        }

        private static void PlaceTop(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
        }
    }
}
