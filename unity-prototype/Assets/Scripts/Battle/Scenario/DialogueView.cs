using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 会話の画面（ノベルパート）。2026-11-13 から「会話枠 H」（正本 docs/10-design/ui/talk/talk_spec.md。基準 1688×780）。
    /// 探索の景色をそのまま見せ、立ち絵を左右に2人ずつ（外側 L1・R1、内側 L2・R2）。話している人は明るく少し上へ、黙っている人は暗く。
    /// 吹き出しは話す人の頭の上（支援会話は顔の横）。押すと次へ（文字を出している途中なら全部出す → 次のページ → 次の台詞）。
    /// 制作メモの行は出さない。物を手に入れる行では OnItem を呼ぶ。見た目と組み立ては DialogueView.Talk.cs
    /// </summary>
    public partial class DialogueView : MonoBehaviour
    {
        [Serializable]
        public struct Portrait
        {
            public string name;        // 話者の名前（「名前_表情」なら、その表情の絵）
            public Texture2D texture;
            public Rect uv;            // （前の会話枠で使っていた見せる範囲。H では使わず、透明でない所を portrait_bounds.json から）
        }

        [SerializeField] private Camera targetCamera;
        [SerializeField] private Font regularFont;
        [SerializeField] private Font boldFont;
        [SerializeField] private Sprite panelSprite;   // 立ち絵の調整パネルの地
        [SerializeField] private Portrait[] portraits = Array.Empty<Portrait>();

        private static readonly Color Ivory = new Color32(243, 226, 182, 255);
        private static readonly Color GoldDeep = new Color32(214, 167, 64, 255);
        private static readonly Color NameGold = new Color32(239, 208, 129, 255);

        private Canvas canvas;
        private RectTransform root, content, stageRoot;
        private Text bodyText;
        private readonly Dictionary<string, RawImage> actors = new Dictionary<string, RawImage>();
        private readonly List<string> log = new List<string>();
        private readonly Dictionary<string, Vector2> actorTarget = new Dictionary<string, Vector2>();
        private readonly Dictionary<string, Color> actorColor = new Dictionary<string, Color>();

        private ScenarioBlock block;
        private ScenarioLine[] lines = Array.Empty<ScenarioLine>();
        private int index = -1;
        private DialogueCast.Stage stage;
        private Action onEnd;

        public event Action<string> OnItem;
        /// <summary>台詞を出すたびに、その行のト書き（備考・ゲーム処理と、前の制作メモ）を渡す。演出の指示を読む（StageDirection。原作者 2026-10-05）</summary>
        public event Action<string> OnDirection;
        /// <summary>会話を閉じた（ブロックの終わり）。演出をもどすのに使う</summary>
        public event Action Closed;
        private string[] directions = Array.Empty<string>();
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
            // 出す行ごとのト書き: その行の備考・ゲーム処理と、すぐ前の制作メモ（出さない行）
            var dirs = new List<string>();
            var memo = new System.Text.StringBuilder();
            foreach (var l in scenarioBlock?.lines ?? Array.Empty<ScenarioLine>())
            {
                if (l.type == "memo") { memo.Append(l.text).Append(' ').Append(l.note).Append(' '); continue; }
                dirs.Add(memo + " " + l.note + " " + l.process);
                memo.Clear();
            }
            directions = dirs.ToArray();
            onEnd = onFinished;
            index = -1;
            stage = new DialogueCast.Stage();
            // 立ち絵の無い人（モブ）は舞台に立てない（枠を取らず、話しても誰も入れ替えない。仕様書 §4: 全員話していない扱い）
            stage.Enter(lines.Where(l => l.type == "line" && HasPortrait(l.speaker)).Select(l => l.speaker));
            foreach (var a in actors.Values) if (a != null) Remove(a.gameObject);
            actors.Clear();
            root.gameObject.SetActive(true);
            OnPlayTalk();
            Advance();
        }

        /// <summary>次の行へ（最後の行のあとは閉じる）</summary>
        public void Advance()
        {
            if (block == null || AdjusterOpen || LogOpen) return;   // 立ち絵の調整中・ログを開いている間は進めない
            if (Revealing) { FinishReveal(); return; }    // 文字を出している途中なら、まず全部出す
            // 長い文は次のページへ（話す人・表情はそのまま。ログ・物を手に入れるのは最初のページだけ）
            if (page < pages.Length - 1) { page++; ShowPage(); return; }
            index++;
            if (index >= lines.Length) { Close(); return; }
            var line = lines[index];
            stage.Speak(line.type == "line" && HasPortrait(line.speaker) ? line.speaker : null);
            NoteRead();
            if (index < directions.Length && !string.IsNullOrWhiteSpace(directions[index])) OnDirection?.Invoke(directions[index]);
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
            CloseLog();
            if (root != null) root.gameObject.SetActive(false);
            GameSettings.FlushRead();
            var done = onEnd;
            onEnd = null;
            Closed?.Invoke();
            done?.Invoke();
        }

        // ── 表示 ──

        private void ShowLine(ScenarioLine line)
        {
            bool narration = line.type == "narration";
            string name = line.type == "phone" ? "携帯端末" : narration ? "" : line.speaker;
            LayoutActors(line);
            LayoutTalk(line, name);   // 吹き出し・名前札・ページ（DialogueView.Talk）
            ShowPage();
            log.Add(string.IsNullOrEmpty(name) ? line.text : $"{name}「{line.text}」");
            if (log.Count > 80) log.RemoveAt(0);
            AddLog(line, name);
        }

        private bool HasPortrait(string who) => !string.IsNullOrEmpty(who) && FindPortrait(who, null).texture != null;

        /// <summary>立ち絵の絵（なければ default）</summary>
        public Texture2D PortraitOf(string who) => FindPortrait(who, null).texture;

        private Portrait FindPortrait(string who, string expression)
        {
            if (!string.IsNullOrEmpty(expression))
                foreach (var p in portraits) if (p.name == $"{who}_{expression}") return p;
            foreach (var p in portraits) if (p.name == who) return p;
            // 場面の立ち絵の一覧に無い人は、Resources/Talk/Portraits/〈名前〉 を探す（支援会話のアルバスなど。2026-11-13）
            if (string.IsNullOrEmpty(who)) return default;
            if (!extraPortraits.TryGetValue(who, out var tex)) { tex = Resources.Load<Texture2D>("Talk/Portraits/" + who); extraPortraits[who] = tex; }
            return tex != null ? new Portrait { name = who, texture = tex } : default;
        }

        private readonly Dictionary<string, Texture2D> extraPortraits = new Dictionary<string, Texture2D>();

        // ── 組み立て ──

        private void Build()
        {
            var canvasObject = new GameObject("Dialogue", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);
            canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = targetCamera != null ? targetCamera : Camera.main;
            canvas.planeDistance = 0.9f;
            canvas.sortingOrder = 200;   // 戦闘のUI（100）より手前
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            // 画面の広がり方は拠点メニュー Hub2 と同じ（1688×780 がいつも全部入る。仕様書 §0）
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(TalkW, TalkH);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;

            root = NewRect("Root", canvasObject.transform);
            Stretch(root);
            // 押すと次へ（画面のどこでも。ボタンの所は除く）
            var hit = root.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            var next = root.gameObject.AddComponent<Button>();
            next.transition = Selectable.Transition.None;
            next.onClick.AddListener(TapAdvance);   // 誤タップ対策つき（DialogueView.Talk）

            BuildTalk();   // 周辺減光・立ち絵の舞台・吹き出し・上のタブ・下のボタン帯・ログ（DialogueView.Talk）

            LoadAdjustments();
            BuildAdjuster(TalkFont);
            adjustPanel.localScale = Vector3.one * 2f;   // 調整パネルは 844 の大きさで作ってある
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
            TickReveal();   // 文字を少しずつ出す・オート・スキップ（DialogueView.Settings）
            // 長押しで早送り（レビュー 2026-09-28_2 J8）
            if (Application.isPlaying && IsPlaying && !AdjusterOpen && !LogOpen)
            {
                var pointer = UnityEngine.InputSystem.Pointer.current;
                bool held = pointer != null && pointer.press.isPressed;
                if (!held) holdStart = -1f;
                else if (holdStart < 0f) holdStart = Time.unscaledTime;
                else if (Time.unscaledTime - holdStart > 0.45f && Time.unscaledTime - lastFast > 0.07f) { lastFast = Time.unscaledTime; Advance(); }
            }
            // 立ち絵の位置と明るさを、目標へなめらかに寄せる（話す人が変わっても飛ばない。0.3〜0.45秒）
            if (Application.isPlaying)
            {
                float k = 1f - Mathf.Exp(-Time.unscaledDeltaTime * 10f);
                foreach (var pair in actors)
                {
                    if (pair.Value == null) continue;
                    if (actorTarget.TryGetValue(pair.Key, out var t)) pair.Value.rectTransform.anchoredPosition = Vector2.Lerp(pair.Value.rectTransform.anchoredPosition, t, k);
                    if (actorColor.TryGetValue(pair.Key, out var c)) pair.Value.color = Color.Lerp(pair.Value.color, c, k);
                }
            }
            TickTalk();   // 吹き出しの出方・「次へ」の印・タブの脈・ログ（DialogueView.Talk）
        }

        /// <summary>（前の会話枠の上下の黒い帯。H では帯を使わない。原作者 2026-11-13。呼ぶ側のために残す）</summary>
        public bool Letterbox { get; set; } = true;

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
    }
}
