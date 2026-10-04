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
    public partial class DialogueView : MonoBehaviour
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

        private Canvas canvas;
        private RectTransform root, stageRoot, box, namePlate, logPanel, letterTop, letterBottom;
        private const float LetterHeight = 30f;
        private float letterStart = -1f;
        private Text nameText, bodyText, logText, nextMark;
        private readonly Dictionary<string, RawImage> actors = new Dictionary<string, RawImage>();
        private readonly List<string> log = new List<string>();
        private readonly Dictionary<string, Vector2> actorTarget = new Dictionary<string, Vector2>();
        private readonly Dictionary<string, Color> actorColor = new Dictionary<string, Color>();
        private const float SlotWidth = 224f, PortraitTop = 66f, PortraitZoom = 1.45f;   // 見本の portrait-slot（幅 224）と figure の top 66

        private ScenarioBlock block;
        private ScenarioLine[] lines = Array.Empty<ScenarioLine>();
        private int index = -1;
        private DialogueCast.Stage stage;
        private Action onEnd;

        public event Action<string> OnItem;
        public Font RegularFont => regularFont;
        public Font BoldFont => boldFont;
        private float holdStart = -1f, lastFast;
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
            stage.Enter(lines.Where(l => l.type == "line").Select(l => l.speaker));
            foreach (var a in actors.Values) if (a != null) Remove(a.gameObject);
            actors.Clear();
            root.gameObject.SetActive(true);
            letterStart = Application.isPlaying ? Time.unscaledTime : -1f;
            SetLetterbox(Application.isPlaying ? 0f : 1f);
            Advance();
        }

        /// <summary>次の行へ（最後の行のあとは閉じる）</summary>
        public void Advance()
        {
            if (block == null || AdjusterOpen) return;   // 立ち絵の調整中は進めない
            // 長い文は次のページへ（話す人・表情はそのまま。ログ・物を手に入れるのは最初のページだけ）
            if (page < pages.Length - 1) { page++; ShowPage(); return; }
            index++;
            if (index >= lines.Length) { Close(); return; }
            var line = lines[index];
            stage.Speak(line.type == "line" ? line.speaker : null);
            ShowLine(line);
            if (!string.IsNullOrEmpty(line.item)) OnItem?.Invoke(line.item);
        }

        public void Close()
        {
            if (adjustPanel != null) adjustPanel.gameObject.SetActive(false);
            adjustWho = null;
            block = null;
            lines = Array.Empty<ScenarioLine>();
            index = -1;
            pages = Array.Empty<string>();
            page = 0;
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
            // 名前札と尾は話す人の側へ（上置きの新しい決まり。採用版md/SILVER_DIALOGUE_UI_DIRECTION.md）。
            // ナレーション・携帯端末・立ち絵のない人は尾を出さず、名前札は真ん中
            int side = 0;
            if (line.type == "line" && !string.IsNullOrEmpty(line.speaker) && FindPortrait(line.speaker, null).texture != null)
                side = stage.left.Contains(line.speaker) ? -1 : stage.right.Contains(line.speaker) ? 1 : 0;
            bodyText.fontStyle = narration ? FontStyle.Italic : FontStyle.Normal;
            bodyText.color = narration ? new Color(textCol.r, textCol.g, textCol.b, 0.86f) : textCol;
            LayoutBox(line.text);   // 台詞の量で枠を伸び縮み・ページに分ける
            SetSpeakerSide(side, side != 0, name);
            ShowPage();
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
                    // 立ち絵をたたく: 1回目は会話を進め、素早く5回で位置の調整（DialogueView.Adjust）
                    var tap = image.gameObject.AddComponent<Button>();
                    tap.transition = Selectable.Transition.None;
                    string tapped = who;
                    tap.onClick.AddListener(() => OnPortraitTap(tapped));
                    actors[who] = image;
                }
                bool fresh = image.texture == null;
                string expression = who == stage.Speaker ? line.expression : null;
                if (portrait.texture != null) image.texture = portrait.texture;
                bool speaking = who == stage.Speaker || (stage.Speaker == null && line.type != "line");
                // 見本（採用版の会話UI）と同じ置き方: 左右の端の枠（幅 SlotWidth）の中に、頭が画面の上から PortraitTop の所に来るように
                // 大きめに置き、下は画面の外へ（胸から上が見える）。2人目は1人目の内側で少し奥（小さく）。
                // 台詞の枠（上の真ん中）の下に頭が入らないように（原作者 2026-10-04）
                float height = (ScreenH - PortraitTop) * PortraitZoom * (i == 0 ? 1f : 0.92f);
                float aspect = portrait.texture != null ? portrait.texture.width * portrait.uv.width / Mathf.Max(1f, portrait.texture.height * portrait.uv.height) : 0.6f;
                // 枠の幅で切らない（原作者 2026-10-04: 手などが見切れていた）。立ち絵の真ん中を枠の真ん中にそろえる
                float fullW = height * aspect, showW = fullW;
                var rt = image.rectTransform;
                rt.anchorMin = rt.anchorMax = new Vector2(right ? 1f : 0f, 1f);
                rt.pivot = new Vector2(0.5f, 1f);
                rt.sizeDelta = new Vector2(showW, height);
                image.uvRect = SlotUv(AdjustedUv(portrait.uv, AdjustOf(who, expression)), showW / fullW);   // 原作者が調整した位置（portrait_adjust.json）を、枠の幅に切る
                float edge = i == 0 ? 8f : 8f + SlotWidth * 0.62f;
                float x = edge + SlotWidth * 0.5f;
                var target = new Vector2(right ? -x : x, -(PortraitTop + (i == 0 ? 0f : 12f)));
                // 話す人が変わるたびに飛ぶと画面がガタつく（原作者 2026-10-04）ので、位置と明るさはなめらかに寄せる（Update）
                actorTarget[who] = target;
                if (fresh || !Application.isPlaying) rt.anchoredPosition = target;
                // 右の人は左右を反転して内側（相手の方）を向ける（立ち絵は全員右向きで描く決まり。発注書 §3）
                rt.localScale = new Vector3(right ? -1f : 1f, 1f, 1f);
                // 黙っている人は透かさず、絵の形の中だけ暗くする（色の掛け算は絵の形の中にしか効かない）
                float keep = 1f - style.listenerShade;
                var color = speaking ? Color.white : new Color(keep, keep, keep, 1f);
                actorColor[who] = color;
                if (fresh || !Application.isPlaying) image.color = color;
                // 奥の人を先に描く（話している人が手前）
                if (speaking) rt.SetAsLastSibling(); else rt.SetAsFirstSibling();
            }
        }

        /// <summary>見せる範囲（uv）を、枠の幅（全体の幅に対する割合 keep）に合わせて左右の真ん中で切る</summary>
        private static Rect SlotUv(Rect uv, float keep)
        {
            keep = Mathf.Clamp01(keep);
            return new Rect(uv.x + uv.width * (1f - keep) * 0.5f, uv.y, uv.width * keep, uv.height);
        }

        /// <summary>その人の立ち絵（なければ null。探索で、盤面の絵がない人の仮の姿に使う）</summary>
        public Texture2D PortraitOf(string who) => FindPortrait(who, null).texture;

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
            var font = regularFont != null ? regularFont : JapaneseFont.Get(new[] { "Noto Serif JP", "Yu Mincho", "MS PMincho" }, 16);
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

            // 上下の黒帯（イベントの場面だと分かるように。原作者 2026-09-28）。会話が始まると差し込む
            letterTop = NewRect("LetterTop", root);
            letterTop.anchorMin = new Vector2(0f, 1f);
            letterTop.anchorMax = new Vector2(1f, 1f);
            letterTop.pivot = new Vector2(0.5f, 1f);
            letterBottom = NewRect("LetterBottom", root);
            letterBottom.anchorMin = new Vector2(0f, 0f);
            letterBottom.anchorMax = new Vector2(1f, 0f);
            letterBottom.pivot = new Vector2(0.5f, 0f);
            foreach (var bar in new[] { letterTop, letterBottom })
            {
                var img = bar.gameObject.AddComponent<Image>();
                img.color = new Color32(8, 5, 12, 255);
                img.raycastTarget = false;
            }
            SetLetterbox(1f);

            // 銀細工の上置きの台詞枠（DialogueView.Silver.cs）
            BuildSilverBox(font);

            // ログ（左上のボタンで開く。押すと閉じる）
            var logButtonRt = NewRect("LogButton", root);
            logButtonRt.anchorMin = logButtonRt.anchorMax = new Vector2(0f, 1f);
            logButtonRt.pivot = new Vector2(0f, 1f);
            logButtonRt.sizeDelta = new Vector2(64f, 20f);
            logButtonRt.anchoredPosition = new Vector2(14f, -10f);
            var logButtonBg = logButtonRt.gameObject.AddComponent<Image>();
            logButtonBg.color = new Color32(12, 26, 35, 240);
            var logButtonLine = logButtonRt.gameObject.AddComponent<Outline>();
            logButtonLine.effectColor = new Color(borderCol.r, borderCol.g, borderCol.b, 0.7f);
            logButtonLine.effectDistance = new Vector2(1f, -1f);
            var logButton = logButtonRt.gameObject.AddComponent<Button>();
            logButton.onClick.AddListener(() => logPanel.gameObject.SetActive(!logPanel.gameObject.activeSelf));
            var logLabel = NewText("Text", logButtonRt, font, 10, textCol, TextAnchor.MiddleCenter);
            logLabel.text = "ログ";
            Stretch(logLabel.rectTransform);

            logPanel = NewRect("LogPanel", root);
            logPanel.anchorMin = new Vector2(0.5f, 0.5f);
            logPanel.anchorMax = new Vector2(0.5f, 0.5f);
            logPanel.sizeDelta = new Vector2(560f, 300f);
            // ログも銀細工の色に（見本の log-panel: 濃い紺の地・細い銀の縁）
            var logBg = logPanel.gameObject.AddComponent<Image>();
            logBg.color = new Color32(12, 25, 34, 247);
            var logLine = logPanel.gameObject.AddComponent<Outline>();
            logLine.effectColor = new Color(borderCol.r, borderCol.g, borderCol.b, 0.8f);
            logLine.effectDistance = new Vector2(1f, -1f);
            var logClose = logPanel.gameObject.AddComponent<Button>();
            logClose.transition = Selectable.Transition.None;
            logClose.onClick.AddListener(() => logPanel.gameObject.SetActive(false));
            logText = NewText("Text", logPanel, font, 11, textCol, TextAnchor.LowerLeft);
            logText.rectTransform.anchorMin = Vector2.zero;
            logText.rectTransform.anchorMax = Vector2.one;
            logText.rectTransform.offsetMin = new Vector2(18f, 14f);
            logText.rectTransform.offsetMax = new Vector2(-18f, -14f);
            logText.verticalOverflow = VerticalWrapMode.Truncate;
            logPanel.gameObject.SetActive(false);

            LoadAdjustments();
            BuildAdjuster(font);
            root.gameObject.SetActive(false);

            // 押す操作をUIに届ける仕組み（探索のシーンには戦闘のUIがなく、これがないと会話を進められない）
            if (Application.isPlaying && UnityEngine.EventSystems.EventSystem.current == null)
            {
                var es = new GameObject("EventSystem", typeof(UnityEngine.EventSystems.EventSystem), typeof(UnityEngine.InputSystem.UI.InputSystemUIInputModule));
                es.transform.SetParent(transform, false);
            }
        }

        private void Update()
        {
            // 長押しで早送り（レビュー 2026-09-28_2 J8）
            if (Application.isPlaying && IsPlaying && !AdjusterOpen)
            {
                var pointer = UnityEngine.InputSystem.Pointer.current;
                bool held = pointer != null && pointer.press.isPressed;
                if (!held) holdStart = -1f;
                else if (holdStart < 0f) holdStart = Time.unscaledTime;
                else if (Time.unscaledTime - holdStart > 0.45f && Time.unscaledTime - lastFast > 0.07f) { lastFast = Time.unscaledTime; Advance(); }
            }
            // 立ち絵の位置と明るさを、目標へなめらかに寄せる（話す人が変わっても飛ばない）
            if (Application.isPlaying)
            {
                float k = 1f - Mathf.Exp(-Time.unscaledDeltaTime * 14f);
                foreach (var pair in actors)
                {
                    if (pair.Value == null) continue;
                    if (actorTarget.TryGetValue(pair.Key, out var t)) pair.Value.rectTransform.anchoredPosition = Vector2.Lerp(pair.Value.rectTransform.anchoredPosition, t, k);
                    if (actorColor.TryGetValue(pair.Key, out var c)) pair.Value.color = Color.Lerp(pair.Value.color, c, k);
                }
            }
            if (logPanel != null && logPanel.gameObject.activeSelf) logText.text = string.Join("\n", log.Skip(Math.Max(0, log.Count - 16)));
            if (letterStart >= 0f)
            {
                float t = Mathf.Clamp01((Time.unscaledTime - letterStart) / 0.35f);
                SetLetterbox(1f - (1f - t) * (1f - t) * (1f - t));   // 速く入って静かに止まる
                if (t >= 1f) letterStart = -1f;
            }
            if (nextMark != null && Application.isPlaying) nextMark.color = new Color(borderCol.r, borderCol.g, borderCol.b, 0.55f + 0.45f * Mathf.Sin(Time.time * 4f));
        }

        /// <summary>黒帯の出方（0＝なし、1＝出きった）。高さでなく位置を動かす（画面の外から差し込む）</summary>
        private void SetLetterbox(float amount)
        {
            if (letterTop == null) return;
            letterTop.sizeDelta = letterBottom.sizeDelta = new Vector2(0f, LetterHeight);
            letterTop.anchoredPosition = new Vector2(0f, LetterHeight * (1f - amount));
            letterBottom.anchoredPosition = new Vector2(0f, -LetterHeight * (1f - amount));
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
    }
}
