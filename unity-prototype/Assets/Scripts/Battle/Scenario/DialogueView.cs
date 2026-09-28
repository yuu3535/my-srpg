using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 会話の画面（DIALOGUE_STAGING_DIRECTION_2026-09-28）: 盤面を映したまま、立ち絵を左右の端に寄せて会話劇にする。
    /// 左＝主人公の側（アルシェ・カリマ）、右＝相手の側。片側2人まで。話している人は明るく少し前へ、黙っている人は暗く奥へ。
    /// 立ち絵の足元は下の暗いにじみに溶かす。テキストボックスの位置は仮（原作者: あとで決める）。
    /// 押すと次の行へ。制作メモの行は出さない。物を手に入れる行では OnItem を呼ぶ
    /// </summary>
    public class DialogueView : MonoBehaviour
    {
        [Serializable]
        public struct Portrait
        {
            public string name;        // 話者の名前（「名前_表情」なら、その表情の絵）
            public Texture2D texture;
            public Rect uv;            // 絵の中の見せる範囲（頭の上〜膝あたり）
        }

        [SerializeField] private Camera targetCamera;
        [SerializeField] private Font regularFont;
        [SerializeField] private Font boldFont;
        [SerializeField] private Sprite panelSprite;   // UI素材 panel_even（黒紫の地・金の細罫線）
        [SerializeField] private Portrait[] portraits = Array.Empty<Portrait>();

        private const float ScreenW = 844f, ScreenH = 390f;
        private static readonly Color Ivory = new Color32(243, 226, 182, 255);
        private static readonly Color GoldDeep = new Color32(214, 167, 64, 255);
        private static readonly Color NameGold = new Color32(239, 208, 129, 255);
        private static readonly Color Dim = new Color(0.34f, 0.33f, 0.42f, 1f);   // 黙っている人（色は線形で混ぜるので強めに暗くする）

        private Canvas canvas;
        private RectTransform root, stageRoot, box, namePlate, logPanel;
        private Text nameText, bodyText, logText, nextMark;
        private readonly Dictionary<string, RawImage> actors = new Dictionary<string, RawImage>();
        private readonly List<string> log = new List<string>();

        private ScenarioBlock block;
        private ScenarioLine[] lines = Array.Empty<ScenarioLine>();
        private int index = -1;
        private DialogueCast.Stage stage;
        private Action onEnd;

        public event Action<string> OnItem;
        public bool IsPlaying => block != null;
        public ScenarioLine CurrentLine => index >= 0 && index < lines.Length ? lines[index] : null;
        public IReadOnlyList<string> Log => log;
        public IReadOnlyList<string> LeftCast => stage?.left ?? (IReadOnlyList<string>)Array.Empty<string>();
        public IReadOnlyList<string> RightCast => stage?.right ?? (IReadOnlyList<string>)Array.Empty<string>();

        /// <summary>ブロックを最初から流す。終わったら onEnd</summary>
        public void Play(ScenarioBlock scenarioBlock, Action onFinished = null)
        {
            if (canvas == null) Build();
            block = scenarioBlock;
            lines = scenarioBlock?.Shown.ToArray() ?? Array.Empty<ScenarioLine>();
            onEnd = onFinished;
            index = -1;
            stage = new DialogueCast.Stage();
            foreach (var a in actors.Values) if (a != null) Remove(a.gameObject);
            actors.Clear();
            root.gameObject.SetActive(true);
            Advance();
        }

        /// <summary>次の行へ（最後の行のあとは閉じる）</summary>
        public void Advance()
        {
            if (block == null) return;
            index++;
            if (index >= lines.Length) { Close(); return; }
            var line = lines[index];
            stage.Speak(line.type == "line" ? line.speaker : null);
            ShowLine(line);
            if (!string.IsNullOrEmpty(line.item)) OnItem?.Invoke(line.item);
        }

        public void Close()
        {
            block = null;
            lines = Array.Empty<ScenarioLine>();
            index = -1;
            if (root != null) root.gameObject.SetActive(false);
            var done = onEnd;
            onEnd = null;
            done?.Invoke();
        }

        // ── 表示 ──

        private void ShowLine(ScenarioLine line)
        {
            bool narration = line.type == "narration";
            string name = line.type == "phone" ? "携帯端末" : narration ? "" : line.speaker;
            namePlate.gameObject.SetActive(!string.IsNullOrEmpty(name));
            nameText.text = name;
            // 名前の札は話している人の側に寄せる（右の人なら右）
            bool right = line.type == "line" && !DialogueCast.IsLeft(line.speaker);
            namePlate.anchoredPosition = new Vector2(right ? box.sizeDelta.x - 150f : 18f, 14f);
            bodyText.text = line.text;
            bodyText.fontStyle = narration ? FontStyle.Italic : FontStyle.Normal;
            bodyText.color = narration ? new Color(Ivory.r, Ivory.g, Ivory.b, 0.86f) : Ivory;
            log.Add(string.IsNullOrEmpty(name) ? line.text : $"{name}「{line.text}」");
            if (log.Count > 80) log.RemoveAt(0);
            LayoutActors(line);
        }

        /// <summary>舞台の立ち絵を並べ直す（話している人は明るく前、黙っている人は暗く奥）</summary>
        private void LayoutActors(ScenarioLine line)
        {
            var onStage = new HashSet<string>(stage.left.Concat(stage.right));
            foreach (var gone in actors.Keys.Where(k => !onStage.Contains(k)).ToList())
            {
                if (actors[gone] != null) Remove(actors[gone].gameObject);
                actors.Remove(gone);
            }
            PlaceSide(stage.left, false, line);
            PlaceSide(stage.right, true, line);
        }

        private void PlaceSide(List<string> cast, bool right, ScenarioLine line)
        {
            for (int i = 0; i < cast.Count; i++)
            {
                var who = cast[i];
                var portrait = FindPortrait(who, who == stage.Speaker ? line.expression : null);
                if (!actors.TryGetValue(who, out var image) || image == null)
                {
                    if (portrait.texture == null) continue;   // 絵のない人（モブ）は名前だけ
                    image = NewRect("Actor_" + who, stageRoot).gameObject.AddComponent<RawImage>();
                    image.raycastTarget = false;
                    actors[who] = image;
                }
                if (portrait.texture != null)
                {
                    image.texture = portrait.texture;
                    image.uvRect = portrait.uv;
                }
                bool speaking = who == stage.Speaker || (stage.Speaker == null && line.type != "line");
                // 端から内側へ: 1人目は端寄り、2人目はその内側で少し奥（小さく）。話している人は内側へ少し出る
                float height = ScreenH * (i == 0 ? 1.02f : 0.94f);
                float aspect = portrait.texture != null ? portrait.texture.width * portrait.uv.width / Mathf.Max(1f, portrait.texture.height * portrait.uv.height) : 0.6f;
                float width = height * aspect;
                float edge = i == 0 ? 20f : 128f;
                float step = speaking && stage.Speaker != null ? 16f : 0f;
                var rt = image.rectTransform;
                rt.anchorMin = rt.anchorMax = new Vector2(right ? 1f : 0f, 0f);
                rt.pivot = new Vector2(0.5f, 0f);
                rt.sizeDelta = new Vector2(width, height);
                float x = edge + width * 0.5f + step;
                rt.anchoredPosition = new Vector2(right ? -x : x, 0f);
                // 右の人は左右を反転して内側（相手の方）を向ける（立ち絵は全員右向きで描く決まり。発注書 §3）
                rt.localScale = new Vector3(right ? -1f : 1f, 1f, 1f);
                image.color = speaking ? Color.white : Dim;
                // 奥の人を先に描く（話している人が手前）
                if (speaking) rt.SetAsLastSibling(); else rt.SetAsFirstSibling();
            }
        }

        private Portrait FindPortrait(string who, string expression)
        {
            if (!string.IsNullOrEmpty(expression))
                foreach (var p in portraits) if (p.name == $"{who}_{expression}") return p;
            foreach (var p in portraits) if (p.name == who) return p;
            return default;
        }

        // ── 組み立て ──

        private void Build()
        {
            var font = regularFont != null ? regularFont : Font.CreateDynamicFontFromOSFont(new[] { "Noto Serif JP", "Yu Mincho", "MS PMincho" }, 16);
            var canvasObject = new GameObject("Dialogue", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);
            canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = targetCamera != null ? targetCamera : Camera.main;
            canvas.planeDistance = 0.9f;
            canvas.sortingOrder = 200;   // 戦闘のUI（100）より手前
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(ScreenW, ScreenH);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;

            root = NewRect("Root", canvasObject.transform);
            Stretch(root);
            // 押すと次へ（画面のどこでも）
            var hit = root.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            var next = root.gameObject.AddComponent<Button>();
            next.transition = Selectable.Transition.None;
            next.onClick.AddListener(Advance);

            stageRoot = NewRect("Stage", root);
            Stretch(stageRoot);

            // 下の暗いにじみ（立ち絵の足元を溶かし、文字を読みやすくする）
            var shade = NewRect("Shade", root).gameObject.AddComponent<RawImage>();
            shade.texture = VerticalFade(new Color(0.03f, 0.02f, 0.06f, 1f), 0.95f, 0.5f);
            shade.raycastTarget = false;
            var shadeRt = shade.rectTransform;
            shadeRt.anchorMin = new Vector2(0f, 0f);
            shadeRt.anchorMax = new Vector2(1f, 0.52f);
            shadeRt.offsetMin = shadeRt.offsetMax = Vector2.zero;

            // テキストボックス（仮の位置: 下の中央）
            box = NewRect("Box", root);
            box.anchorMin = box.anchorMax = new Vector2(0.5f, 0f);
            box.pivot = new Vector2(0.5f, 0f);
            box.sizeDelta = new Vector2(560f, 92f);
            box.anchoredPosition = new Vector2(0f, 10f);
            var boxImage = box.gameObject.AddComponent<Image>();
            if (panelSprite != null) { boxImage.sprite = panelSprite; boxImage.type = Image.Type.Sliced; }
            else boxImage.color = new Color(0.06f, 0.04f, 0.1f, 0.92f);
            boxImage.raycastTarget = false;

            namePlate = NewRect("Name", box);
            namePlate.anchorMin = namePlate.anchorMax = new Vector2(0f, 1f);
            namePlate.pivot = new Vector2(0f, 0f);
            namePlate.sizeDelta = new Vector2(132f, 20f);
            var plate = namePlate.gameObject.AddComponent<RawImage>();
            plate.texture = HorizontalBand(new Color32(56, 21, 71, 255));
            plate.raycastTarget = false;
            var plateRule = NewRect("Rule", namePlate).gameObject.AddComponent<Image>();
            plateRule.color = new Color(GoldDeep.r, GoldDeep.g, GoldDeep.b, 0.7f);
            plateRule.rectTransform.anchorMin = new Vector2(0f, 0f);
            plateRule.rectTransform.anchorMax = new Vector2(1f, 0f);
            plateRule.rectTransform.sizeDelta = new Vector2(0f, 1f);
            nameText = NewText("Text", namePlate, boldFont != null ? boldFont : font, 12, NameGold, TextAnchor.MiddleCenter);
            Stretch(nameText.rectTransform);

            bodyText = NewText("Body", box, font, 13, Ivory, TextAnchor.UpperLeft);
            bodyText.rectTransform.anchorMin = Vector2.zero;
            bodyText.rectTransform.anchorMax = Vector2.one;
            bodyText.rectTransform.offsetMin = new Vector2(22f, 14f);
            bodyText.rectTransform.offsetMax = new Vector2(-22f, -14f);
            bodyText.lineSpacing = 1.15f;

            nextMark = NewText("Next", box, font, 10, GoldDeep, TextAnchor.MiddleCenter);
            nextMark.text = "▼";
            nextMark.rectTransform.anchorMin = nextMark.rectTransform.anchorMax = new Vector2(1f, 0f);
            nextMark.rectTransform.sizeDelta = new Vector2(16f, 14f);
            nextMark.rectTransform.anchoredPosition = new Vector2(-16f, 12f);

            // ログ（左上のボタンで開く。押すと閉じる）
            var logButtonRt = NewRect("LogButton", root);
            logButtonRt.anchorMin = logButtonRt.anchorMax = new Vector2(0f, 1f);
            logButtonRt.pivot = new Vector2(0f, 1f);
            logButtonRt.sizeDelta = new Vector2(64f, 20f);
            logButtonRt.anchoredPosition = new Vector2(14f, -10f);
            var logButtonBg = logButtonRt.gameObject.AddComponent<RawImage>();
            logButtonBg.texture = HorizontalBand(new Color32(20, 14, 30, 255));
            var logButton = logButtonRt.gameObject.AddComponent<Button>();
            logButton.onClick.AddListener(() => logPanel.gameObject.SetActive(!logPanel.gameObject.activeSelf));
            var logLabel = NewText("Text", logButtonRt, font, 10, NameGold, TextAnchor.MiddleCenter);
            logLabel.text = "ログ";
            Stretch(logLabel.rectTransform);

            logPanel = NewRect("LogPanel", root);
            logPanel.anchorMin = new Vector2(0.5f, 0.5f);
            logPanel.anchorMax = new Vector2(0.5f, 0.5f);
            logPanel.sizeDelta = new Vector2(560f, 300f);
            var logBg = logPanel.gameObject.AddComponent<Image>();
            if (panelSprite != null) { logBg.sprite = panelSprite; logBg.type = Image.Type.Sliced; } else logBg.color = new Color(0.05f, 0.03f, 0.08f, 0.95f);
            var logClose = logPanel.gameObject.AddComponent<Button>();
            logClose.transition = Selectable.Transition.None;
            logClose.onClick.AddListener(() => logPanel.gameObject.SetActive(false));
            logText = NewText("Text", logPanel, font, 10, Ivory, TextAnchor.LowerLeft);
            logText.rectTransform.anchorMin = Vector2.zero;
            logText.rectTransform.anchorMax = Vector2.one;
            logText.rectTransform.offsetMin = new Vector2(18f, 14f);
            logText.rectTransform.offsetMax = new Vector2(-18f, -14f);
            logText.verticalOverflow = VerticalWrapMode.Truncate;
            logPanel.gameObject.SetActive(false);

            root.gameObject.SetActive(false);
        }

        private void Update()
        {
            if (logPanel != null && logPanel.gameObject.activeSelf) logText.text = string.Join("\n", log.Skip(Math.Max(0, log.Count - 16)));
            if (nextMark != null && Application.isPlaying) nextMark.color = new Color(GoldDeep.r, GoldDeep.g, GoldDeep.b, 0.55f + 0.45f * Mathf.Sin(Time.time * 4f));
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

        private static Text NewText(string name, Transform parent, Font font, int size, Color color, TextAnchor anchor)
        {
            var text = NewRect(name, parent).gameObject.AddComponent<Text>();
            text.font = font;
            text.fontSize = size;
            text.color = color;
            text.alignment = anchor;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            return text;
        }

        /// <summary>下が濃く、上へ消える縦の帯（alphaBottom から、height の割合の所で 0）</summary>
        private static Texture2D VerticalFade(Color color, float alphaBottom, float solid)
        {
            const int n = 64;
            var tex = new Texture2D(1, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < n; y++)
            {
                float t = y / (n - 1f);
                float a = alphaBottom * (1f - Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(solid * 0.2f, 1f, t)));
                tex.SetPixel(0, y, new Color(color.r, color.g, color.b, a));
            }
            tex.Apply();
            return tex;
        }

        /// <summary>名前の札の地: 左右の端が透明に消える紫の帯</summary>
        private static Texture2D HorizontalBand(Color color)
        {
            const int n = 64;
            var tex = new Texture2D(n, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int x = 0; x < n; x++)
            {
                float t = x / (n - 1f);
                float a = 0.92f * Mathf.Clamp01(Mathf.Min(t, 1f - t) * 6f);
                tex.SetPixel(x, 0, new Color(color.r, color.g, color.b, a));
            }
            tex.Apply();
            return tex;
        }
    }
}
