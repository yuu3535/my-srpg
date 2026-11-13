using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 支援会話：相手選び（2026-11-12 総合担当）。拠点メニュー Hub2 の太陽盤で「支援会話」を選ぶと開く。
    /// 正本: docs/10-design/ui/support_select/support_select_spec.md（基準 1688×780。見た目は見本画像 ref_01〜05、数値は仕様書）。
    /// 太陽盤は残り（項目名だけ「支援会話」が真ん中の並びに変わる）、右のガラス板の中身がこの画面になる。右上の星（BACK）で Hub2 に戻る。
    /// まだの物: 会話画面の支援モード（「会話する」は暗転のあと、この画面に戻る）、支援のデータ（仮の JSON）、仲間カードの長押し
    /// </summary>
    public class SupportSelectView : MonoBehaviour
    {
        /// <summary>
        /// 開発中だけ: 支援が解放される前でも、太陽盤の「支援会話」でこの画面を開く（原作者 2026-11-12。あとで false に戻す）
        /// </summary>
        public static bool OpenBeforeUnlock = true;

        public static SupportSelectView Instance { get; private set; }
        public static bool IsOpen => Instance != null && Instance.gameObject.activeSelf;

        /// <summary>開く（太陽盤の「支援会話」）。roster を渡さなければ Resources の仮のデータ</summary>
        public static SupportSelectView Open(SupportRoster roster = null)
        {
            if (Instance == null)
            {
                var go = new GameObject("SupportSelect");
                if (Hub2Menu.Instance != null) go.transform.SetParent(Hub2Menu.Instance.transform, false);
                Instance = go.AddComponent<SupportSelectView>();
            }
            Instance.gameObject.SetActive(true);
            Instance.Show(roster ?? (Roster ??= SupportRoster.Load()));
            return Instance;
        }

        /// <summary>今の支援のデータ（見た会話はここに残る。セーブはまだ）。roster を渡して開いたときは、それ</summary>
        public static SupportRoster Roster;

        /// <summary>支援会話を流している間（相手選びは隠れ、拠点メニューの中身も出さない）</summary>
        public static bool Talking { get; private set; }

        /// <summary>起動したとき・テスト: 支援のデータと「会話中」を消す</summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        public static void ResetStatics() { Roster = null; Talking = false; }

        /// <summary>BACK（星・Esc）。拠点メニューに戻る</summary>
        public void Back()
        {
            if (veilTime >= 0f) return;   // 暗転の途中は戻らない
            gameObject.SetActive(false);
        }

        // ── 色（仕様書 §2） ──
        private static Color C(int r, int g, int b, float a = 1f) => new Color(r / 255f, g / 255f, b / 255f, a);
        private static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }
        private static readonly Color Gold = Hex("#e2b04a"), GoldHi = Hex("#f3cd78"), Ink = Hex("#f1ead9"), InkHi = Hex("#fbf5e7"),
            Sub = Hex("#a59e90"), Sub2 = Hex("#b9b1a1"), Silver = C(201, 205, 210, Hub2Textures.SeenLight(0.75f, 0.8f)), RowLine = C(241, 234, 217, Hub2Textures.SeenLight(0.10f)),
            HeadLine = C(226, 176, 74, Hub2Textures.SeenLight(0.30f, 0.7f)), DialInk = Hex("#e6dfcf"), Dark = Hex("#121019"), Toggle = Hex("#8f887b"), LockGray = Hex("#6f695f");
        private static readonly Color TileBg = C(16, 14, 24, Hub2Textures.Seen(0.72f)), TileBgOn = C(34, 31, 44, Hub2Textures.Seen(0.94f));
        /// <summary>ランクの色（C 金・B 水色・A 赤）</summary>
        public static readonly Color[] RankColors = { Hex("#e2b04a"), Hex("#6cc6d6"), Hex("#d9475a") };

        // ── 動き（仕様書 §4・§6・§8・§9・§10）。テストからも使う ──
        public static class Motion
        {
            /// <summary>「続きがある」の菱形の跳ね（3.6秒周期、0 / 0.22 / 0.44秒ずつ遅れて6px上へ）。戻り値は上へのずれ</summary>
            public static float MoreHop(int i, float t)
            {
                float p = Mathf.Repeat(t - i * 0.22f, 3.6f) / 3.6f;
                if (p < 0.06f) return 6f * Ease(p / 0.06f);
                if (p < 0.11f) return 6f * (1f - Ease((p - 0.06f) / 0.05f));
                return 0f;
            }

            private static readonly Color[] MoreColors = { Hex("#4fa3a8"), Hex("#e2b04a"), Hex("#c9cdd2") };

            /// <summary>「続きがある」の菱形の色（9秒で 水色 → 金 → 銀。3つの位相を 0 / −6 / −3秒ずらす）</summary>
            public static Color MoreColor(int i, float t)
            {
                float shift = i == 1 ? 6f : i == 2 ? 3f : 0f;
                float x = Mathf.Repeat(t + shift, 9f) / 3f;
                int from = Mathf.FloorToInt(x) % 3;
                return Color.Lerp(MoreColors[from], MoreColors[(from + 1) % 3], x - Mathf.Floor(x));
            }

            /// <summary>未読のランクの点滅（3.2秒周期で 1 → 0.25 → 1）</summary>
            public static float PipBlink(float t) => 0.625f + 0.375f * Mathf.Cos(t / 3.2f * Mathf.PI * 2f);

            /// <summary>金の点の光の輪（2.2秒周期。広がり 0〜7px と濃さ）</summary>
            public static (float spread, float alpha) DotRing(float t)
            {
                float p = Mathf.Repeat(t, 2.2f) / 2.2f;
                float k = p < 0.5f ? Mathf.SmoothStep(0f, 1f, p / 0.5f) : 1f - Mathf.SmoothStep(0f, 1f, (p - 0.5f) / 0.5f);
                return (7f * k, 0.55f * (1f - k));
            }

            public const float VeilLength = 1.9f;

            /// <summary>暗転の濃さ（1.9秒で 0 →（18%）1 →（78%）1 → 0）</summary>
            public static float Veil(float t)
            {
                float p = t / VeilLength;
                if (p <= 0f || p >= 1f) return 0f;
                if (p < 0.18f) return Mathf.SmoothStep(0f, 1f, p / 0.18f);
                if (p < 0.78f) return 1f;
                return 1f - Mathf.SmoothStep(0f, 1f, (p - 0.78f) / 0.22f);
            }

            /// <summary>真っ暗になっている間（ここで会話画面へ切り替える）</summary>
            public static bool VeilFull(float t) => t >= VeilLength * 0.18f && t <= VeilLength * 0.78f;

            /// <summary>cubic-bezier(.2,.9,.25,1) に近い、速く出て静かに止まる動き</summary>
            public static float Ease(float x) { x = Mathf.Clamp01(x); return 1f - Mathf.Pow(1f - x, 3.2f); }
        }

        // ── 状態 ──
        private SupportRoster roster;
        private int selected;
        private bool compact;
        private float clock, introTime = -1f, veilTime = -1f;
        private string veilA, veilB;
        private int veilRank;

        private Font font, fontBold, fontEn;
        private Canvas canvas;
        private RectTransform canvasRect, content, leftGroup, panel, cardsContent, rowsContent, rowsViewport, veil;
        private CanvasGroup panelGroup, veilGroup;
        private ScrollRect rowsScroll, cardsScroll;
        private RectTransform bandRoot, bondHead, toggleFull, toggleMini, moreMember, moreBond;
        private Text toast;
        private float toastUntil;
        private RawImage designRef;
        private float lastScale = -1f;
        private Dictionary<string, (Texture2D tex, float fx, float fy, float hw)> faces;

        private readonly List<CardView> cards = new List<CardView>();
        private readonly List<(Graphic g, float baseAlpha)> blinkers = new List<(Graphic, float)>();
        private readonly List<(RectTransform rt, Image img)> memberDias = new List<(RectTransform, Image)>(), bondDias = new List<(RectTransform, Image)>();
        private float moreMemberAlpha, moreBondAlpha;

        private class CardView
        {
            public RectTransform root, art;
            public PolyGraphic frame;
            public GameObject cornerA, cornerB;
            public RectTransform ring;
            public RawImage ringImg;
            public Vector2[] shape;
            public float line = -1f;
            public float lift;
            public bool hover;
        }

        private static bool Still => Hub2Menu.Effect == Hub2Motion.Effect.None;

        private void Awake()
        {
            font = Resources.Load<Font>("Fonts/ShipporiMincho-SemiBold") ?? StartMenu.FontOf();
            fontBold = Resources.Load<Font>("Fonts/ShipporiMincho-ExtraBold") ?? font;
            fontEn = Resources.Load<Font>("Fonts/BarlowCondensed-SemiBold") ?? font;
            LoadFaces();
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Show(SupportRoster r)
        {
            roster = r;
            selected = 0;
            compact = false;   // 開くたびに「詳細」から
            veilTime = -1f;
            if (canvasRect != null) Destroy(canvasRect.gameObject);
            cards.Clear(); blinkers.Clear(); memberDias.Clear(); bondDias.Clear();
            Build();
            introTime = Still ? 10f : 0f;
            lastScale = -1f;
            Update();
        }

        /// <summary>確認用: 入ってくる動きを飛ばす</summary>
        public void FinishIntro() { introTime = 10f; Update(); }

        /// <summary>仲間を選ぶ（カードを押す）</summary>
        public void Select(int index)
        {
            if (roster == null || index < 0 || index >= roster.members.Count) return;
            selected = index;
            RebuildRight();
        }

        public void Select(string id) => Select(roster.members.FindIndex(m => m.id == id));

        /// <summary>BOND の表示（詳細／簡易）</summary>
        public void SetCompact(bool on)
        {
            compact = on;
            RebuildRight();
        }

        public bool Compact => compact;
        public int Selected => selected;
        public bool Veiled => veilTime >= 0f;

        /// <summary>「会話する」: 暗転してから会話画面へ（支援モードはまだ無いので、暗転のあと、この画面に戻る）</summary>
        public void Talk(string partnerId)
        {
            if (veilTime >= 0f) return;
            var me = roster.members[selected];
            var p = roster.PairOf(me.id, partnerId);
            if (p == null || !p.Talkable) return;
            talkPair = p;
            talk = SupportTalks.Find(me.id, partnerId, p.rank);
            talkStarted = false;
            veilA = me.name;
            veilB = roster.Find(partnerId)?.name ?? partnerId;
            veilRank = p.rank;
            BuildVeil();
            veilTime = 0f;
        }

        /// <summary>確認用: 暗転の時刻で止めて見る</summary>
        public void ScrubVeil(float t) { veilTime = t; Update(); }

        // ── 毎コマ ──

        private void Update()
        {
            if (canvasRect == null) return;
            float dt = Time.unscaledDeltaTime;
            clock += dt;
#if UNITY_EDITOR
            var kb = Keyboard.current;
            if (kb != null && kb.f8Key.wasPressedThisFrame) CycleDesignRef();
#endif
            LeaveIfDialTurned();
            if (!gameObject.activeSelf) return;
            StepRipple(dt);
            if (veilTime >= 0f) StepVeil(dt);   // Esc で戻るのは Hub2Menu が受ける（同じコマで拠点メニューまで閉じないように）

            // 入ってくる動き: 右の中身が右から寄る（太陽盤は拠点メニューで回ったまま）
            if (introTime >= 0f && introTime < 10f) introTime += dt;
            float it = introTime < 0f ? 10f : introTime;
            float pk = Motion.Ease((it - 0.15f) / 0.55f);
            panelGroup.alpha = Mathf.Clamp01((it - 0.15f) / 0.55f * 1.6f);
            panel.anchoredPosition = new Vector2(26f * (1f - pk), 0f);

            Idle(dt);

            float sf = canvas.scaleFactor;
            if (!Mathf.Approximately(sf, lastScale))
            {
                lastScale = sf;
                foreach (var t in GetComponentsInChildren<Text>(true)) t.SetAllDirty();
            }
            if (toast != null && toast.gameObject.activeSelf && Time.unscaledTime > toastUntil) toast.gameObject.SetActive(false);
        }

        private void Idle(float dt)
        {
            bool still = Still;
            // カード: 選んでいる物は10px、押す・ホバーで6px浮く。立ち絵は1.05倍
            for (int i = 0; i < cards.Count; i++)
            {
                var c = cards[i];
                bool sel = i == selected;
                float target = sel ? 10f : c.hover ? 6f : 0f;
                c.lift = still ? target : Mathf.Lerp(c.lift, target, 1f - Mathf.Exp(-dt * 12f));
                c.root.anchoredPosition = new Vector2(c.root.anchoredPosition.x, -(14f - c.lift));
                if (c.art != null)
                {
                    float s = c.hover && !still ? 1.05f : 1f;
                    c.art.localScale = Vector3.Lerp(c.art.localScale, Vector3.one * s, 1f - Mathf.Exp(-dt * 10f));
                }
                c.frame.color = sel ? Gold : c.hover ? C(243, 205, 120, 0.95f) : Silver;
                float line = sel ? 1.6f : 1f;
                if (!Mathf.Approximately(line, c.line)) { c.line = line; c.frame.Set(c.shape, PolyGraphic.Mode.Stroke, true, line); }
                c.cornerA.SetActive(sel); c.cornerB.SetActive(sel);
                if (c.ring != null)
                {
                    var (spread, a) = still ? (0f, 0f) : Motion.DotRing(clock);
                    c.ring.sizeDelta = new Vector2(8f + spread * 2f, 8f + spread * 2f);
                    c.ringImg.color = new Color(242f / 255f, 196f / 255f, 96f / 255f, a);
                }
            }
            // 未読のランクの点滅
            float blink = still ? 1f : Motion.PipBlink(clock);
            foreach (var (g, baseAlpha) in blinkers)
            {
                var col = g.color; col.a = baseAlpha * blink; g.color = col;
            }
            // 「続きがある」印: スクロールでき、まだ最後まで見ていないとき。消すときは0.3秒で透明に（場所は空けたまま）
            bool memberMore = cardsScroll != null && cardsContent.rect.width > cardsScroll.viewport.rect.width + 1f && cardsScroll.horizontalNormalizedPosition < 0.98f;
            bool bondMore = rowsContent.rect.height > rowsViewport.rect.height + 1f && rowsScroll.verticalNormalizedPosition > 0.02f;
            moreMemberAlpha = Mathf.MoveTowards(moreMemberAlpha, memberMore ? 1f : 0f, dt / 0.3f);
            moreBondAlpha = Mathf.MoveTowards(moreBondAlpha, bondMore ? 1f : 0f, dt / 0.3f);
            if (introTime < 0.05f) { moreMemberAlpha = memberMore ? 1f : 0f; moreBondAlpha = bondMore ? 1f : 0f; }
            moreMember.GetComponent<CanvasGroup>().alpha = moreMemberAlpha;
            moreBond.GetComponent<CanvasGroup>().alpha = moreBondAlpha;
            var dias = new List<(RectTransform rt, Image img)>(memberDias);
            dias.AddRange(bondDias);
            for (int i = 0; i < dias.Count; i++)
            {
                int k = i % 3;
                var (rt, img) = dias[i];
                var col = still ? (k == 0 ? Hex("#4fa3a8") : k == 1 ? Gold : Hex("#c9cdd2")) : Motion.MoreColor(k, clock);
                rt.anchoredPosition = new Vector2(rt.anchoredPosition.x, still ? 0f : Motion.MoreHop(k, clock));
                img.color = new Color(col.r, col.g, col.b, Hub2Textures.SeenLight(0.25f, 0.6f));
                rt.GetChild(0).GetComponent<PolyGraphic>().color = col;
            }
        }

        private void StepVeil(float dt)
        {
            bool wasFull = Motion.VeilFull(veilTime);
            veilTime += dt;
            veilGroup.alpha = Motion.Veil(veilTime);
            veil.gameObject.SetActive(true);
            // 真っ暗の間に会話画面へ切り替える（暗転の半ばで会話を始め、相手選びの中身を隠す。暗転は会話の上で明けていく）
            if (!talkStarted && veilTime > Motion.VeilLength * 0.5f) BeginTalk();
            if (veilTime >= Motion.VeilLength)
            {
                veilTime = -1f;
                veil.gameObject.SetActive(false);
                if (Talking) gameObject.SetActive(false);   // 会話の間は相手選びを閉じておく（終わったら戻る）
                else Toast("この組の支援会話の台本は、まだありません");
            }
        }

        private SupportRoster.Pair talkPair;
        private SupportTalks.Talk talk;
        private bool talkStarted;

        private void BeginTalk()
        {
            talkStarted = true;
            var dialogue = FindFirstObjectByType<DialogueView>();
            if (talk == null || dialogue == null) return;
            Talking = true;
            for (int i = 0; i < canvasRect.childCount; i++)
            {
                var c = canvasRect.GetChild(i);
                if (veil == null || c != veil.transform) c.gameObject.SetActive(false);
            }
            var pair = talkPair;
            int keep = selected;
            dialogue.PlaySupport(talk.ToBlock(), pair.rank, talk.title, () => EndTalk(pair, keep));
        }

        /// <summary>支援会話が終わった（最後まで読んだ・CLOSE）: 見たことにして、相手選びに戻る</summary>
        private void EndTalk(SupportRoster.Pair pair, int keep)
        {
            Talking = false;
            if (pair != null && pair.Talkable)
            {
                pair.rank = Mathf.Min(3, pair.rank + 1);
                if (pair.rank < 3) { pair.state = "Gauge"; pair.points = 0; }
            }
            gameObject.SetActive(true);
            Show(roster);
            Select(keep);
            FinishIntro();
        }

        // ── 組み立て ──

        private void Build()
        {
            var go = new GameObject("SupportCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            go.transform.SetParent(transform, false);
            canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 465;   // Hub2（460）の上、セーブ・設定（600）の下
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(Hub2Motion.BaseWidth, Hub2Motion.BaseHeight);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;   // Hub2 と同じ（1688×780 がいつも全部入る）
            if (EventSystem.current == null)
                new GameObject("EventSystem", typeof(EventSystem), typeof(UnityEngine.InputSystem.UI.InputSystemUIInputModule));
            canvasRect = (RectTransform)go.transform;

            // 後ろの探索を押せないように（全面の見えない板）。何もない所を素早く2回押したら、拠点メニューへ戻る（BlankTap）。
            // カードの並びと支援の一覧は、それぞれ見えない板で受けるので、押し損ねても戻らない
            var blocker = Stretch("Blocker", canvasRect);
            blocker.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var trigger = blocker.gameObject.AddComponent<EventTrigger>();
            var click = new EventTrigger.Entry { eventID = EventTriggerType.PointerClick };
            click.callback.AddListener(_ => BlankTap());
            trigger.triggers.Add(click);

            content = Node("Content", canvasRect);
            content.anchorMin = content.anchorMax = content.pivot = new Vector2(0.5f, 0.5f);
            content.sizeDelta = new Vector2(Hub2Motion.BaseWidth, Hub2Motion.BaseHeight);

            BuildScrims();
            BuildWatermark();
            var dots = Raw("Dots", content, Hub2Textures.Dots(924, 176), Vector2.zero, Color.white);
            Place(dots.rectTransform, 744f, 206f, 924f, 176f);

            leftGroup = Node("LeftGroup", canvasRect);
            leftGroup.anchorMin = leftGroup.anchorMax = leftGroup.pivot = new Vector2(0f, 0.5f);
            leftGroup.sizeDelta = new Vector2(668f, Hub2Motion.BaseHeight);
            BuildDial();

            // 右の中身（入ってくるとき右から寄る）
            var panelHolder = Node("PanelHolder", content);
            Place(panelHolder, 0f, 0f, Hub2Motion.BaseWidth, Hub2Motion.BaseHeight);
            panel = Node("Panel", panelHolder);
            panel.anchorMin = Vector2.zero; panel.anchorMax = Vector2.one; panel.sizeDelta = Vector2.zero; panel.pivot = new Vector2(0f, 1f);
            panelGroup = panel.gameObject.AddComponent<CanvasGroup>();
            BuildHeader();
            BuildMembers();
            BuildBondArea();
            RebuildRight();

            var back = BuildStar("BACK", canvasRect);
            back.GetComponent<Button>().onClick.AddListener(Back);

            toast = Label(content, "", 744f, 724f, 900f, 30f, 16, Ink, 600);
            toast.alignment = TextAnchor.MiddleCenter;
            Shadow(toast, 0.9f, 2f);
            toast.gameObject.SetActive(false);

#if UNITY_EDITOR
            designRef = Raw("DesignRef", canvasRect, null, Vector2.zero, new Color(1f, 1f, 1f, 0.4f));
            var dr = designRef.rectTransform;
            dr.anchorMin = dr.anchorMax = dr.pivot = new Vector2(0.5f, 0.5f);
            dr.sizeDelta = new Vector2(Hub2Motion.BaseWidth, Hub2Motion.BaseHeight);
            ApplyDesignRef();
#endif
        }

        private void BuildScrims()
        {
            float RW = 998f + 800f;
            var glass = Place(Raw("Glass", content, null, Vector2.zero, Color.white).rectTransform, 690f, -400f, RW, 1580f);
            glass.GetComponent<RawImage>().texture = Hub2Textures.Gradient("support_glass", C(12, 10, 20),
                new Vector2(0f, 0f), new Vector2(60f / RW, Hub2Textures.Seen(0.70f)), new Vector2(998f / RW, Hub2Textures.Seen(0.80f)), new Vector2(1f, Hub2Textures.Seen(0.80f)));
            float W = 1509f;
            var left = Place(Raw("LeftDark", content, null, Vector2.zero, Color.white).rectTransform, -800f, -400f, W, 1580f);
            left.GetComponent<RawImage>().texture = Hub2Textures.Gradient("support_left", C(10, 9, 16),
                new Vector2(0f, Hub2Textures.Seen(0.45f)), new Vector2(800f / W, Hub2Textures.Seen(0.45f)), new Vector2(1306f / W, Hub2Textures.Seen(0.30f)), new Vector2(1f, 0f));
        }

        private void BuildWatermark()
        {
            var t = Label(content, "ORCUS", 712f, -44f, 980f, 260f, 220, new Color(Ink.r, Ink.g, Ink.b, 0f), 700);
            t.alignment = TextAnchor.UpperLeft;
            Spacing(t, 0.04f);
            var ol = t.gameObject.AddComponent<Outline>();
            ol.effectColor = new Color(Ink.r, Ink.g, Ink.b, 0.07f);
            ol.effectDistance = new Vector2(1f, -1f);
        }

        // 太陽盤（§4）。Hub2 と同じ回る太陽盤を、「支援会話」が針の先の位置で。
        // 太陽盤は拠点メニューで回ったまま残るので、仕様書 §4 の「項目名が降りてくる」動きは要らなくなった（原作者 2026-11-13 回る太陽盤）。
        // この画面でも回せる。ほかの札へ回したら、拠点メニューへ戻る（押した札なら、回り終わってから拠点メニューでその項目を開く）。
        // 原作者 2026-11-13「メニュー開閉を押さないと戻れないのが不便。コマンドを回転させたときに閉じるとか」
        private void BuildDial()
        {
            SunDialView.SnapTo("支援会話");   // 直接開いたとき（拠点メニューから来たときは、もうこの位置）
            SunDialView.Create(leftGroup, true, null).onEmptyTap = BlankTap;   // 太陽盤の札でない所を押したときも同じ
        }

        // ── 何もない所を押したとき ──
        // 素早く2回押すと、太陽盤の札を外して拠点メニューへ戻る（札を外すと「支援会話」から離れるので LeaveIfDialTurned が戻す）。
        // 1回だけなら、押した所に光の輪が出るだけ（押し損ねで、眺めていた画面が急に消えないように）。
        // 原作者 2026-11-13「素早く２回タップでスッ…と戻る方が良い。１回タップだと誤タップしたときに折角眺めてた画面が急にどこか行くのはストレス」
        public const float DoubleTapSeconds = 0.35f;
        private float lastBlankTap = -10f, rippleTime = -1f;
        private RawImage ripple;

        public void BlankTap()
        {
            if (veilTime >= 0f || Talking) return;
            float now = Time.unscaledTime;
            if (now - lastBlankTap <= DoubleTapSeconds)
            {
                lastBlankTap = -10f;
                SunDialView.Clear();
                return;
            }
            lastBlankTap = now;
            ShowRipple();
        }

        private void ShowRipple()
        {
            if (ripple == null)
            {
                ripple = Raw("TapRipple", canvasRect, Hub2Textures.Glow, new Vector2(64f, 64f), Color.white);
                ripple.rectTransform.anchorMin = ripple.rectTransform.anchorMax = ripple.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            }
            ripple.transform.SetAsLastSibling();
            var pointer = Pointer.current;
            Vector2 local = Vector2.zero;
            if (pointer != null) RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, pointer.position.ReadValue(), null, out local);
            ripple.rectTransform.anchoredPosition = local;
            rippleTime = 0f;
            StepRipple(0f);
        }

        // 光の輪: 0.4秒で広がって消える（金の淡い光）
        private void StepRipple(float dt)
        {
            if (ripple == null) return;
            if (rippleTime < 0f) { ripple.enabled = false; return; }
            rippleTime += dt;
            float k = rippleTime / 0.4f;
            if (k >= 1f) { rippleTime = -1f; ripple.enabled = false; return; }
            ripple.enabled = true;
            float e = Motion.Ease(k);
            ripple.rectTransform.localScale = Vector3.one * (0.5f + 1.1f * e);
            ripple.color = new Color(GoldHi.r, GoldHi.g, GoldHi.b, Hub2Textures.SeenLight(0.35f * (1f - k), 0.8f));
        }

        /// <summary>太陽盤が「支援会話」から回されたら、拠点メニューへ戻る（暗転の間・支援会話の間は戻らない）</summary>
        private void LeaveIfDialTurned()
        {
            if (veilTime < 0f && !Talking && SunDialView.SelectedLabel != "支援会話") Back();
        }

        private void BuildHeader()
        {
            var en = Label(panel, "SUPPORT", 770f, 26f, 200f, 18f, 15, Gold, 600);
            en.alignment = TextAnchor.MiddleLeft;
            Spacing(en, 0.34f);
            var title = Label(panel, "支援会話", 768f, 54f, 600f, 63f, 56, InkHi, 800);
            title.alignment = TextAnchor.MiddleLeft;
            Spacing(title, 0.08f);
            Shadow(title, 0.8f, 2f);

            // 帯（§5）。中身は選んでいる人で変わる（RebuildRight）
            bandRoot = Place(Node("Band", panel), 772f, 146f, 820f, 36f);
            var line = Raw("Underline", panel, Hub2Textures.Gradient("support_band", Gold, new Vector2(0f, 0.6f), new Vector2(0.7f, 0.15f), new Vector2(1f, 0f)), Vector2.zero, Color.white);
            Place(line.rectTransform, 772f, 146f + 36f + 1f, 820f, 1f);
        }

        private void BuildMembers()
        {
            // 見出し（§6）
            var head = Place(Node("MemberHead", panel), 790f, 204f, 850f, 27f);
            float x = 0f;
            x = Inline(head, "MEMBER", x, 14, Gold, 600, 0.3f) + 14f;
            x = Inline(head, "仲間", x, 19, Ink, 700, 0.1f) + 14f;
            x = Inline(head, roster.members.Count.ToString(), x, 18, InkHi, 600, 0f) + 4f;
            x = Inline(head, "人", x, 13, Sub, 600, 0.1f, 2f) + 14f;
            Fill(head, x, 13f, 850f - 51f - 14f - x, 1f, HeadLine);
            moreMember = More(head, 850f - 51f, memberDias);

            // カード（§6）。並べる場所 (790, 237) 850×230、中の余白 左右6・上14
            var area = Place(Node("Cards", panel), 790f, 237f, 850f, 230f);
            var viewport = Stretch("Viewport", area);
            viewport.gameObject.AddComponent<RectMask2D>().padding = new Vector4(0f, -20f, 0f, 0f);
            viewport.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            cardsContent = Node("Content", viewport);
            cardsContent.anchorMin = cardsContent.anchorMax = cardsContent.pivot = new Vector2(0f, 1f);
            float total = 6f + roster.members.Count * 105f - 13f + 6f;
            cardsContent.sizeDelta = new Vector2(Mathf.Max(850f, total), 230f);
            cardsScroll = area.gameObject.AddComponent<ScrollRect>();
            cardsScroll.viewport = viewport;
            cardsScroll.content = cardsContent;
            cardsScroll.vertical = false;
            cardsScroll.horizontal = total > 850f;   // 9人以上になったときだけ
            cardsScroll.movementType = ScrollRect.MovementType.Clamped;
            cardsScroll.scrollSensitivity = 30f;
            for (int i = 0; i < roster.members.Count; i++) cards.Add(Card(i, roster.members[i]));
        }

        private CardView Card(int i, SupportRoster.Member m)
        {
            var c = new CardView();
            var root = Place(Node("Card_" + m.id, cardsContent), 6f + i * 105f, 14f, 92f, 212f);
            c.root = root;
            var shape = new[] { P(0, 23.32f), P(92, 0), P(92, 188.68f), P(0, 212) };
            var bg = Poly("Shape", root, C(12, 10, 20, Hub2Textures.Seen(0.45f)), 92f, 212f);
            bg.Set(shape, PolyGraphic.Mode.Fill);
            bg.raycastTarget = true;
            bg.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            if (Face(m.portrait, out var f))
            {
                // 顔の位置 (48, 58)・頭の幅 40 にそろえる（§11）。1.05倍に寄るときは顔の位置を中心に
                var pivot = Place(Node("ArtPivot", bg.rectTransform), 48f, 58f, 0f, 0f);
                c.art = pivot;
                var art = Raw("Art", pivot, f.tex, Vector2.zero, Color.white);
                float s = 40f / f.hw;
                Place(art.rectTransform, -f.fx * s, -f.fy * s, f.tex.width * s, f.tex.height * s);
            }
            else Silhouette(bg.rectTransform, 92f, 212f, 46f, 62f, 19f, new[] { P(10, 212), P(12, 120), P(26, 96), P(46, 94), P(66, 96), P(80, 120), P(82, 212) }, 0.1f);
            var fade = Raw("Fade", bg.rectTransform, VerticalFade(), Vector2.zero, Color.white);
            Place(fade.rectTransform, 0f, 212f * 0.6f, 92f, 212f * 0.4f);
            c.frame = Poly("Frame", root, Silver);
            c.shape = shape;
            c.cornerA = Diamond(root, 92f, 0f, 8f / 1.4142f, Gold).gameObject;
            c.cornerB = Diamond(root, 0f, 212f, 8f / 1.4142f, Gold).gameObject;
            var no = Label(root, (i + 1).ToString("00"), 9f, 148f, 60f, 14f, 12, Gold, 600); no.alignment = TextAnchor.MiddleLeft;
            int fs = m.name.Length >= 6 ? 12 : m.name.Length >= 5 ? 13 : 16;
            var nm = Label(root, m.name, 9f, 163f, 120f, 22f, fs, InkHi, 800); nm.alignment = TextAnchor.MiddleLeft;
            Spacing(nm, 0.06f);
            Shadow(nm, 0.8f, 1f);
            if (roster.HasReady(m.id))
            {
                // 金の点（右8・上14、直径8）と、外に広がる光の輪
                var ring = Raw("Ring", root, Hub2Textures.Disc, new Vector2(8f, 8f), new Color(1f, 1f, 1f, 0f));
                Centered(ring.rectTransform, 80f, 18f);
                c.ring = ring.rectTransform;
                c.ringImg = ring;
                var dot = Raw("Dot", root, Hub2Textures.Disc, new Vector2(8f, 8f), GoldHi);
                Centered(dot.rectTransform, 80f, 18f);
            }
            var btn = root.gameObject.AddComponent<Button>();
            btn.targetGraphic = bg;
            btn.transition = Selectable.Transition.None;
            int index = i;
            btn.onClick.AddListener(() => Select(index));
            var trig = root.gameObject.AddComponent<EventTrigger>();
            AddTrigger(trig, EventTriggerType.PointerEnter, () => c.hover = true);
            AddTrigger(trig, EventTriggerType.PointerExit, () => c.hover = false);
            AddTrigger(trig, EventTriggerType.PointerDown, () => c.hover = true);
            AddTrigger(trig, EventTriggerType.PointerUp, () => c.hover = false);
            return c;
        }

        private void BuildBondArea()
        {
            bondHead = Place(Node("BondHead", panel), 790f, 488f, 850f, 28f);
            rowsViewport = Place(Node("Rows", panel), 790f, 524f, 850f, 256f);
            rowsViewport.gameObject.AddComponent<RectMask2D>();
            rowsViewport.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            rowsContent = Node("Content", rowsViewport);
            rowsContent.anchorMin = rowsContent.anchorMax = rowsContent.pivot = new Vector2(0f, 1f);
            rowsScroll = rowsViewport.gameObject.AddComponent<ScrollRect>();
            rowsScroll.viewport = rowsViewport;
            rowsScroll.content = rowsContent;
            rowsScroll.horizontal = false;
            rowsScroll.movementType = ScrollRect.MovementType.Clamped;
            rowsScroll.scrollSensitivity = 30f;
        }

        /// <summary>選んでいる人で変わる所（帯・BOND の見出し・一覧）を作り直す。一覧は一番上に戻す</summary>
        private void RebuildRight()
        {
            if (bandRoot == null) return;
            var me = roster.members.Count > 0 ? roster.members[Mathf.Clamp(selected, 0, roster.members.Count - 1)] : null;
            Clear(bandRoot);
            Clear(bondHead);
            Clear(rowsContent);
            blinkers.Clear();
            BuildBand(me);
            var partners = me != null ? roster.PartnersOf(me.id) : new List<SupportRoster.Partner>();
            BuildBondHead(me, partners.Count);
            if (compact) BuildCompactRows(partners); else BuildDetailRows(partners);
            rowsScroll.StopMovement();
            rowsScroll.verticalNormalizedPosition = 1f;
            rowsContent.anchoredPosition = Vector2.zero;
        }

        private void BuildBand(SupportRoster.Member me)
        {
            float x = 0f;
            Diamond(bandRoot, 4.5f, 18f, 9f / 1.4142f, Gold);
            x = 9f + 12f;
            x = Inline(bandRoot, "話せる会話", x, 16, Gold, 700, 0.1f, 0f, 36f) + 12f;
            x = Inline(bandRoot, roster.ReadyTotal().ToString(), x, 22, InkHi, 600, 0f, 0f, 36f) + 12f;
            Fill(bandRoot, x, 10f, 1f, 16f, C(226, 176, 74, Hub2Textures.SeenLight(0.45f, 0.7f)));
            x += 1f + 12f;
            var band = me != null ? roster.BandFor(me.id) : new SupportRoster.Band { kind = SupportRoster.BandKind.Quiet };
            if (band.kind == SupportRoster.BandKind.Pair)
            {
                var col = RankColors[Mathf.Clamp(band.rank, 0, 2)];
                x = Inline(bandRoot, band.a, x, 15, col, 700, 0.1f, 0f, 36f);
                x = Inline(bandRoot, "と", x, 15, Sub2, 400, 0.1f, 0f, 36f);
                x = Inline(bandRoot, band.b, x, 15, col, 700, 0.1f, 0f, 36f);
                Inline(bandRoot, SupportRoster.BandTail(band.rank), x, 15, Sub2, 400, 0.1f, 0f, 36f);
            }
            else Inline(bandRoot, band.kind == SupportRoster.BandKind.Someone ? SupportRoster.BandSomeone : SupportRoster.BandQuiet, x, 15, Sub2, 400, 0.1f, 0f, 36f);
        }

        private void BuildBondHead(SupportRoster.Member me, int count)
        {
            float x = 0f;
            x = Inline(bondHead, "BOND", x, 14, Gold, 600, 0.3f, 0f, 28f) + 14f;
            x = Inline(bondHead, (me != null ? me.name : "") + "の支援", x, 19, Ink, 700, 0.1f, 0f, 28f) + 14f;
            x = Inline(bondHead, "相手", x, 13, Sub, 600, 0.1f, 2f, 28f) + 4f + 6f;   // 並びの間 4 ＋ 数字の左の 6
            x = Inline(bondHead, count.ToString(), x, 18, InkHi, 600, 0f, 0f, 28f) + 4f;
            x = Inline(bondHead, "人", x, 13, Sub, 600, 0.1f, 2f, 28f) + 14f;
            Fill(bondHead, x, 14f, 1457f - 790f - 14f - x, 1f, HeadLine);
            // 切り替え「詳細｜簡易」（§7）。位置は1pxも動かさない
            toggleFull = ToggleButton("詳細", 1457f - 790f, !compact, () => { if (compact) SetCompact(false); });
            toggleMini = ToggleButton("簡易", 1457f - 790f + 55f + 8f, compact, () => { if (!compact) SetCompact(true); });
            bondDias.Clear();
            moreBond = More(bondHead, 850f - 51f, bondDias);
        }

        private RectTransform ToggleButton(string label, float x, bool on, Action onClick)
        {
            var rt = Place(Node("Toggle_" + label, bondHead), x, 0f, 55f, 28f);
            rt.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            var btn = rt.gameObject.AddComponent<Button>();
            btn.transition = Selectable.Transition.None;
            btn.onClick.AddListener(() => onClick());
            // 左の小さな菱形（6px）。選ばれていない物は枠線だけ
            var d = Diamond(rt, 9f, 14f, 6f / 1.4142f, on ? Gold : new Color(0, 0, 0, 0));
            if (!on)
            {
                var ol = Poly("Line", d, C(201, 205, 210, Hub2Textures.SeenLight(0.45f, 0.8f)));
                ol.rectTransform.anchorMin = ol.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                float h = 6f / 1.4142f / 2f;
                ol.Set(new[] { new Vector2(-h, h), new Vector2(h, h), new Vector2(h, -h), new Vector2(-h, -h) }, PolyGraphic.Mode.Stroke, true, 1f);
            }
            else
            {
                var g = Raw("Glow", rt, Hub2Textures.Glow, new Vector2(13f, 13f), C(242, 196, 96, 0.4f));
                Centered(g.rectTransform, 9f, 14f);
                g.transform.SetAsFirstSibling();
            }
            var t = Label(rt, label, 18f, 0f, 40f, 28f, 13, on ? GoldHi : Toggle, 700);
            t.alignment = TextAnchor.MiddleLeft;
            Spacing(t, 0.12f);
            return rt;
        }

        private void BuildDetailRows(List<SupportRoster.Partner> partners)
        {
            rowsContent.sizeDelta = new Vector2(850f, partners.Count * 59f);
            for (int i = 0; i < partners.Count; i++)
            {
                var q = partners[i];
                var row = Place(Node("Row_" + q.member.id, rowsContent), 0f, i * 59f, 850f, 59f);
                Fill(row, 0f, 58f, 850f, 1f, RowLine);
                FaceBox(row, q.member, 4f, 8f, 42f, 42f, 21f, 19f, 22f);
                var nm = Label(row, q.member.name, 62f, 12f, 200f, 20f, 16, Ink, 700); nm.alignment = TextAnchor.MiddleLeft; Spacing(nm, 0.1f);
                var en = Label(row, q.member.en.ToUpperInvariant(), 62f, 36f, 200f, 14f, 11, Sub, 600); en.alignment = TextAnchor.MiddleLeft; Spacing(en, 0.3f);
                for (int k = 0; k < 3; k++) PipView(row, 254f + k * 36f, 15f, q.pair, k);
                Status(row, q.pair, 400f);
                if (q.pair.Talkable) TalkTile(row, q.member.id, q.pair.rank);
            }
        }

        private void BuildCompactRows(List<SupportRoster.Partner> partners)
        {
            int lines = (partners.Count + 1) / 2;
            rowsContent.sizeDelta = new Vector2(850f, lines * 59f);
            for (int i = 0; i < partners.Count; i++)
            {
                var q = partners[i];
                var cell = Place(Node("Cell_" + q.member.id, rowsContent), (i % 2) * 437f, (i / 2) * 59f, 413f, 59f);
                Fill(cell, 0f, 58f, 413f, 1f, RowLine);
                FaceBox(cell, q.member, 2f, 8f, 40f, 42f, 20f, 19f, 21f);
                var nm = Label(cell, q.member.name, 54f, 12f, 120f, 19f, 15, Ink, 700); nm.alignment = TextAnchor.MiddleLeft; Spacing(nm, 0.08f);
                var en = Label(cell, q.member.en.ToUpperInvariant(), 54f, 34f, 120f, 13f, 10, Sub, 600); en.alignment = TextAnchor.MiddleLeft; Spacing(en, 0.26f);
                for (int k = 0; k < 3; k++) PipView(cell, 176f + k * 32f, 15f, q.pair, k);
                if (q.pair.Talkable) SmallTalk(cell, q.member.id, q.pair.rank);
                else if (q.pair.Row == SupportRoster.RowState.Locked) Lock(cell, 413f - 8f - 13f, 21f, LockGray);
            }
        }

        // ランクの菱形（§9）。28×28 の箱の中に 20×20 の菱形、中央に文字
        private void PipView(RectTransform parent, float x, float y, SupportRoster.Pair pair, int k)
        {
            var box = Place(Node("Pip" + SupportRoster.RankNames[k], parent), x, y, 28f, 28f);
            var col = RankColors[k];
            var state = SupportRoster.PipOf(pair, k);
            var outer = DiamondShape(box, 14f, 14f, 10f, state == SupportRoster.Pip.NotYet ? C(201, 205, 210, Hub2Textures.SeenLight(0.42f, 0.8f)) : col);
            var inner = DiamondShape(box, 14f, 14f, 9f, state == SupportRoster.Pip.Seen ? col : C(14, 12, 20, Hub2Textures.Seen(0.8f)));
            var t = Label(box, SupportRoster.RankNames[k], 0f, 0f, 28f, 28f, 11, state == SupportRoster.Pip.Seen ? Dark : state == SupportRoster.Pip.Unread ? col : Sub, 700);
            t.alignment = TextAnchor.MiddleCenter;
            if (state == SupportRoster.Pip.Unread)
            {
                blinkers.Add((outer, outer.color.a));
                blinkers.Add((inner, inner.color.a));
                blinkers.Add((t, 1f));
            }
        }

        private void Status(RectTransform row, SupportRoster.Pair pair, float x)
        {
            switch (pair.Row)
            {
                case SupportRoster.RowState.Gauge:
                {
                    float cx = x;
                    cx = Inline(row, "支援値", cx, 12, Sub, 600, 0.1f, 3f, 58f) + 12f;
                    cx = Inline(row, pair.points.ToString(), cx, 20, InkHi, 600, 0f, 0f, 58f) + 6f;
                    Inline(row, "/ 100 PT", cx, 12, Sub, 600, 0f, 3f, 58f);
                    break;
                }
                case SupportRoster.RowState.Locked:
                    Lock(row, x, 22.5f, Sub);   // 行（58）のまん中
                    Inline(row, "第" + pair.unlockChapter + "章から話せる", x + 13f + 8f, 13, Sub, 600, 0.08f, 0f, 58f);
                    break;
                case SupportRoster.RowState.AllSeen:
                    Inline(row, "すべて見た", x, 13, Sub, 600, 0.1f, 0f, 58f);
                    break;
            }
        }

        // 「会話する」タイル（右端、178×44、右下を12px斜めに切る）
        private void TalkTile(RectTransform row, string partnerId, int rank)
        {
            var col = RankColors[Mathf.Clamp(rank, 0, 2)];
            var rt = Place(Node("Talk", row), 850f - 178f, 7f, 178f, 44f);
            var bg = TileShape(rt, 178f, 44f, 12f);
            var glow = Raw("Glow", rt, Hub2Textures.Glow, new Vector2(18f, 18f), new Color(col.r, col.g, col.b, 0.4f));
            Centered(glow.rectTransform, 18.5f, 22f);
            Diamond(rt, 18.5f, 22f, 9f / 1.4142f, col);
            var t = Label(rt, "会話する", 33f, 6f, 120f, 22f, 15, Ink, 700); t.alignment = TextAnchor.MiddleLeft; Spacing(t, 0.1f);
            var r = Label(rt, "RANK " + SupportRoster.RankNames[Mathf.Clamp(rank, 0, 2)], 33f, 28f, 120f, 12f, 10, col, 600); r.alignment = TextAnchor.MiddleLeft; Spacing(r, 0.3f);
            Chevron(rt, 178f - 12f - 8f, 22f, 16f, Gold, 2f);
            Press(rt, bg, () => Talk(partnerId));
        }

        // 簡易の「会話 ＞」（高さ34・右下を8px斜めに）
        private void SmallTalk(RectTransform cell, string partnerId, int rank)
        {
            var col = RankColors[Mathf.Clamp(rank, 0, 2)];
            var rt = Place(Node("Talk", cell), 413f - 74f, 12f, 74f, 34f);
            var bg = TileShape(rt, 74f, 34f, 8f);
            var t = Label(rt, "会話", 14f, 0f, 40f, 34f, 14, Ink, 700); t.alignment = TextAnchor.MiddleLeft; Spacing(t, 0.1f);
            Chevron(rt, 74f - 10f - 6.5f, 17f, 13f, col, 2.4f);
            Press(rt, bg, () => Talk(partnerId));
        }

        private void Press(RectTransform rt, PolyGraphic bg, Action onClick)
        {
            bg.raycastTarget = true;
            var btn = rt.gameObject.AddComponent<Button>();
            btn.targetGraphic = bg;
            btn.transition = Selectable.Transition.None;
            btn.onClick.AddListener(() => onClick());
            var trig = rt.gameObject.AddComponent<EventTrigger>();
            AddTrigger(trig, EventTriggerType.PointerEnter, () => bg.color = TileBgOn);
            AddTrigger(trig, EventTriggerType.PointerExit, () => bg.color = TileBg);
            AddTrigger(trig, EventTriggerType.PointerDown, () => bg.color = TileBgOn);
            AddTrigger(trig, EventTriggerType.PointerUp, () => bg.color = TileBg);
        }

        private PolyGraphic TileShape(RectTransform rt, float w, float h, float cut)
        {
            var bg = Poly("Bg", rt, TileBg, w, h);
            bg.Set(new[] { P(0, 0), P(w, 0), P(w, h - cut), P(w - cut, h), P(0, h) }, PolyGraphic.Mode.Fill);
            return bg;
        }

        private void FaceBox(RectTransform parent, SupportRoster.Member m, float x, float y, float w, float h, float cx, float cy, float head)
        {
            var box = Place(Node("Face", parent), x, y, w, h);
            var shape = new[] { P(0, h * 0.1f), P(w, 0), P(w, h * 0.9f), P(0, h) };
            var bg = Poly("Shape", box, TileBg, w, h);
            bg.Set(shape, PolyGraphic.Mode.Fill);
            bg.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            if (Face(m.portrait, out var f))
            {
                var art = Raw("Art", bg.rectTransform, f.tex, Vector2.zero, Color.white);
                float s = head / f.hw;
                Place(art.rectTransform, cx - f.fx * s, cy - f.fy * s, f.tex.width * s, f.tex.height * s);
            }
            else
            {
                float mid = w / 2f;
                Silhouette(bg.rectTransform, w, h, mid, 17f, 8f, new[] { P(5, h), P(7, 31), P(13, 27), P(mid, 27), P(w - 13, 27), P(w - 7, 31), P(w - 5, h) }, 0.12f);
            }
        }

        // 「続きがある」印（§8）。9×9 の菱形3つ、間10px。いつも場所を取っておき、要らないときは透明
        private RectTransform More(RectTransform parent, float x, List<(RectTransform, Image)> into)
        {
            var rt = Place(Node("More", parent), x, 0f, 51f, parent.sizeDelta.y);
            rt.gameObject.AddComponent<CanvasGroup>().alpha = 0f;
            for (int i = 0; i < 3; i++)
            {
                var d = Node("Dia" + i, rt);
                d.anchorMin = d.anchorMax = new Vector2(0f, 0.5f);
                d.pivot = new Vector2(0.5f, 0.5f);
                d.sizeDelta = new Vector2(9f / 1.4142f, 9f / 1.4142f);
                d.anchoredPosition = new Vector2(4.5f + i * 19f, 0f);
                d.localEulerAngles = new Vector3(0f, 0f, 45f);
                var img = d.gameObject.AddComponent<Image>();
                img.raycastTarget = false;
                var line = Poly("Line", d, Gold);
                line.rectTransform.anchorMin = line.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                float h = 9f / 1.4142f / 2f;
                line.Set(new[] { new Vector2(-h, h), new Vector2(h, h), new Vector2(h, -h), new Vector2(-h, -h) }, PolyGraphic.Mode.Stroke, true, 1f);
                into.Add((d, img));
            }
            return rt;
        }

        private void BuildVeil()
        {
            if (veil != null) Destroy(veil.gameObject);
            veil = Stretch("Veil", canvasRect);
            veil.gameObject.AddComponent<Image>().color = Hex("#08070c");
            veilGroup = veil.gameObject.AddComponent<CanvasGroup>();
            veilGroup.alpha = 0f;
            var mid = Node("Center", veil);
            mid.anchorMin = mid.anchorMax = mid.pivot = new Vector2(0.5f, 0.5f);
            mid.sizeDelta = new Vector2(Hub2Motion.BaseWidth, Hub2Motion.BaseHeight);
            // SUPPORT ― RANK B（英字は Barlow、線は明朝）
            string rank = SupportRoster.RankNames[Mathf.Clamp(veilRank, 0, 2)];
            var parts = new List<Text>
            {
                Label(mid, "SUPPORT", 0f, 326f, 300f, 22f, 18, Gold, 600),
                Label(mid, "―", 0f, 326f, 40f, 22f, 18, Gold, 600),
                Label(mid, "RANK " + rank, 0f, 326f, 300f, 22f, 18, Gold, 600),
            };
            float total = 0f;
            var widths = new List<float>();
            foreach (var p in parts) { Spacing(p, 0.3f); p.alignment = TextAnchor.MiddleLeft; float w = Width(p, 0.3f); widths.Add(w); total += w; }
            const float gap = 11f;   // 前後の空白ぶん
            total += 2f * gap;
            float x = 844f - total / 2f;
            for (int i = 0; i < parts.Count; i++) { parts[i].rectTransform.anchoredPosition = new Vector2(x, -326f); x += widths[i] + gap; }
            var title = Label(mid, veilA + " × " + veilB, 0f, 366f, Hub2Motion.BaseWidth, 52f, 40, Hex("#f1efe9"), 800);
            Centered(title, 844f, 0.16f);
            // 開発確認用の文（本番では消してよい。仕様書 §10）
            var sub = Label(mid, "支援会話へ ― 会話画面（支援モード）", 0f, 434f, Hub2Motion.BaseWidth, 22f, 15, Hex("#b8b5ae"), 400);
            Centered(sub, 844f, 0.14f);
            veil.SetSiblingIndex(canvasRect.childCount - 1);
            if (designRef != null) designRef.transform.SetAsLastSibling();
        }

        // ── 立ち絵（§11） ──

        private void LoadFaces()
        {
            faces = new Dictionary<string, (Texture2D, float, float, float)>();
            var t = Resources.Load<TextAsset>("Support/Portraits/faces");
            if (t == null) return;
            var list = JsonUtility.FromJson<FaceList>(t.text);
            if (list?.faces == null) return;
            foreach (var f in list.faces)
            {
                var tex = Resources.Load<Texture2D>("Support/Portraits/" + f.id);
                if (tex != null) faces[f.id] = (tex, f.fx, f.fy, f.hw);
            }
        }

        [Serializable] private class FaceList { public FaceEntry[] faces; }
        [Serializable] private class FaceEntry { public string id; public float w, h, fx, fy, hw; }

        private bool Face(string id, out (Texture2D tex, float fx, float fy, float hw) f)
        {
            f = default;
            return !string.IsNullOrEmpty(id) && faces != null && faces.TryGetValue(id, out f);
        }

        private void Silhouette(RectTransform parent, float w, float h, float cx, float cy, float r, Vector2[] body, float alpha)
        {
            var circle = new List<Vector2>();
            for (int i = 0; i < 32; i++) { float a = i / 32f * Mathf.PI * 2f; circle.Add(new Vector2(cx + Mathf.Cos(a) * r, -cy + Mathf.Sin(a) * r)); }
            alpha = Hub2Textures.SeenLight(alpha);
            var head = Poly("Head", parent, new Color(Ink.r, Ink.g, Ink.b, alpha));
            head.Set(circle, PolyGraphic.Mode.Fill);
            // 肩の形（曲線を細かい点で）
            var pts = new List<Vector2>();
            var a0 = body[0]; var b0 = body[1]; var b1 = body[2]; var a1 = body[3]; var c0 = body[4]; var c1 = body[5]; var a2 = body[6];
            for (int i = 0; i <= 12; i++) pts.Add(Bezier(a0, b0, b1, a1, i / 12f));
            for (int i = 1; i <= 12; i++) pts.Add(Bezier(a1, c0, c1, a2, i / 12f));
            var shoulders = Poly("Body", parent, new Color(Ink.r, Ink.g, Ink.b, alpha));
            shoulders.Set(pts, PolyGraphic.Mode.Fill);
        }

        private static Vector2 Bezier(Vector2 p0, Vector2 p1, Vector2 p2, Vector2 p3, float t)
        {
            float u = 1f - t;
            return u * u * u * p0 + 3f * u * u * t * p1 + 3f * u * t * t * p2 + t * t * t * p3;
        }

        private static Texture2D verticalFade;
        /// <summary>下40%の暗がり（上が透明、下が rgba(14,13,20,0.92)）</summary>
        private static Texture2D VerticalFade()
        {
            if (verticalFade != null) return verticalFade;
            const int H = 64;
            verticalFade = new Texture2D(1, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "SupportCardFade" };
            for (int y = 0; y < H; y++)
            {
                float k = y / (H - 1f);   // 0＝下
                verticalFade.SetPixel(0, y, new Color(14f / 255f, 13f / 255f, 20f / 255f, Hub2Textures.Seen(0.92f * (1f - k))));
            }
            verticalFade.Apply();
            return verticalFade;
        }

        // ── 開発用: 見本を半透明で重ねる（エディターだけ。F8 で ref_01〜05・なし を切り替え） ──

#if UNITY_EDITOR
        public static readonly string[] DesignRefs =
        {
            "ref_01_base_5members_detail", "ref_02_5members_compact", "ref_03_8members_albus", "ref_04_no_talk", "ref_05_talk_start",
        };
        /// <summary>重ねる見本（DesignRefs の番号。−1＝なし）</summary>
        public static int DesignRefIndex = -1;

        private void CycleDesignRef()
        {
            DesignRefIndex = DesignRefIndex + 1 >= DesignRefs.Length ? -1 : DesignRefIndex + 1;
            ApplyDesignRef();
        }

        public void ApplyDesignRef()
        {
            if (designRef == null) return;
            bool on = DesignRefIndex >= 0 && DesignRefIndex < DesignRefs.Length;
            designRef.gameObject.SetActive(on);
            if (on) designRef.texture = UnityEditor.AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/DesignRefs/SupportSelect/" + DesignRefs[DesignRefIndex] + ".png");
            designRef.transform.SetAsLastSibling();
        }
#endif

        // ── 星（Hub2 の CLOSE と同じ） ──

        private RectTransform BuildStar(string label, RectTransform parent)
        {
            var rt = Node(label + "Star", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(1f, 1f);
            rt.sizeDelta = new Vector2(104f, 124f);
            rt.anchoredPosition = new Vector2(-2f, 2f);
            rt.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            rt.gameObject.AddComponent<Button>().transition = Selectable.Transition.None;
            // 星60px・間6px・文字を、104×124 の縦のまん中に（星の中心は上から52、文字は95）
            var glow = Raw("Glow", rt, Hub2Textures.Glow, new Vector2(72f, 72f), C(242, 205, 120, 0.22f));
            Centered(glow.rectTransform, 52f, 52f);
            var star = Raw("Star", rt, Hub2Textures.Star, new Vector2(60f, 60f), Color.white);
            Centered(star.rectTransform, 52f, 52f);
            var t = Label(rt, label, 0f, 85f, 104f, 20f, 12, C(207, 199, 182), 600);
            t.alignment = TextAnchor.MiddleLeft;
            Spacing(t, 0.34f);
            t.rectTransform.anchoredPosition = new Vector2(52f - Width(t, 0.34f) / 2f + 0.17f * 12f, -85f);
            Shadow(t, 0.9f, 2f);
            return rt;
        }

        // ── トースト ──

        public void Toast(string text)
        {
            if (toast == null) return;
            toast.text = text;
            toast.gameObject.SetActive(true);
            toast.transform.SetAsLastSibling();
            toastUntil = Time.unscaledTime + 2.4f;
        }

        // ── 小さな道具 ──

        private static Vector2 P(float x, float y) => new Vector2(x, -y);

        private static RectTransform Node(string name, Transform parent)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            return rt;
        }

        private static RectTransform Stretch(string name, Transform parent)
        {
            var rt = Node(name, parent);
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.sizeDelta = Vector2.zero; rt.anchoredPosition = Vector2.zero;
            return rt;
        }

        private static RectTransform Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        private static void Centered(RectTransform rt, float cx, float cy)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(cx, -cy);
        }

        private static void Clear(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--) Destroy(t.GetChild(i).gameObject);
            for (int i = t.childCount - 1; i >= 0; i--) t.GetChild(i).SetParent(null);
        }

        private static PolyGraphic Poly(string name, Transform parent, Color color, float w = 0f, float h = 0f)
        {
            var rt = Node(name, parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = new Vector2(w, h);
            rt.gameObject.AddComponent<CanvasRenderer>();
            var g = rt.gameObject.AddComponent<PolyGraphic>();
            g.color = color;
            g.raycastTarget = false;
            return g;
        }

        private static RawImage Raw(string name, Transform parent, Texture tex, Vector2 size, Color color)
        {
            var rt = Node(name, parent);
            rt.sizeDelta = size;
            var ri = rt.gameObject.AddComponent<RawImage>();
            ri.texture = tex;
            ri.color = color;
            ri.raycastTarget = false;
            return ri;
        }

        private static Image Fill(Transform parent, float x, float y, float w, float h, Color color)
        {
            var rt = Place(Node("Fill", parent), x, y, w, h);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        /// <summary>塗りの菱形（中心 cx, cy。side は回す前の正方形の辺）</summary>
        private static RectTransform Diamond(Transform parent, float cx, float cy, float side, Color color)
        {
            var rt = Node("Diamond", parent);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(cx, -cy);
            rt.sizeDelta = new Vector2(side, side);
            rt.localEulerAngles = new Vector3(0f, 0f, 45f);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            img.raycastTarget = false;
            return rt;
        }

        /// <summary>菱形（中心 cx, cy、中心から角までの長さ r）を多角形で</summary>
        private static PolyGraphic DiamondShape(Transform parent, float cx, float cy, float r, Color color)
        {
            var g = Poly("Dia", parent, color);
            g.Set(new[] { P(cx, cy - r), P(cx + r, cy), P(cx, cy + r), P(cx - r, cy) }, PolyGraphic.Mode.Fill);
            return g;
        }

        private static void Chevron(Transform parent, float cx, float cy, float size, Color color, float width)
        {
            float k = size / 24f;
            var g = Poly("Chevron", parent, color);
            g.Set(new[] { P(cx - 3f * k, cy - 6f * k), P(cx + 3f * k, cy), P(cx - 3f * k, cy + 6f * k) }, PolyGraphic.Mode.Stroke, false, width * k * 1.3f);
            g.Soft = true;
        }

        private static void Lock(Transform parent, float left, float top, Color color)
        {
            // 13px の鍵（24 の枠の中の rect 5,11 14×10 と弧）。自分の入れ物に描く
            // （行の左上に大きさ 0 で置くと、RectMask2D に枠の外と見なされて消える）
            var holder = Place(Node("LockIcon", parent), left, top, 13f, 13f);
            parent = holder;
            float k = 13f / 24f, x = 0f, y = 0f;
            var body = Poly("Lock", parent, color);
            body.Set(new[] { P(x + 5 * k, y + 11 * k), P(x + 19 * k, y + 11 * k), P(x + 19 * k, y + 21 * k), P(x + 5 * k, y + 21 * k) }, PolyGraphic.Mode.Stroke, true, 2f * k);
            var arc = new List<Vector2>();
            for (int i = 0; i <= 10; i++)
            {
                float a = Mathf.PI * i / 10f;
                arc.Add(P(x + (12 - 4 * Mathf.Cos(a)) * k, y + (8 - 4 * Mathf.Sin(a)) * k));
            }
            arc.Insert(0, P(x + 8 * k, y + 11 * k));
            arc.Add(P(x + 16 * k, y + 11 * k));
            var shackle = Poly("Shackle", parent, color);
            shackle.Set(arc, PolyGraphic.Mode.Stroke, false, 2f * k);
        }

        private static void AddTrigger(EventTrigger trig, EventTriggerType type, Action action)
        {
            var e = new EventTrigger.Entry { eventID = type };
            e.callback.AddListener(_ => action());
            trig.triggers.Add(e);
        }

        /// <summary>
        /// 文字。太さ（CSS の font-weight）から字体を選ぶ: 英字だけなら Barlow Condensed SemiBold。
        /// 日本語は 800 なら ExtraBold、700 は 19px 以上なら ExtraBold・16px 以下なら SemiBold（原作者 2026-11-12）、それ以外は SemiBold
        /// </summary>
        private Text Label(Transform parent, string text, float x, float y, float w, float h, int size, Color color, int weight)
        {
            var rt = Place(Node("Text", parent), x, y, w, h);
            var t = rt.gameObject.AddComponent<Text>();
            bool en = IsLatin(text);
            bool heavy = weight >= 800 || (weight >= 700 && size >= 19);
            t.font = en ? fontEn : heavy ? fontBold : font;
            t.text = text;
            t.fontSize = size;
            t.fontStyle = FontStyle.Normal;
            t.color = color;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        /// <summary>横に並べる文字（x から。高さ h の行のまん中にそろえる。dy は下へのずらし）。戻り値は次の x（字間ぶんを含む）</summary>
        private float Inline(RectTransform parent, string text, float x, int size, Color color, int weight, float em, float dy = 0f, float h = -1f)
        {
            if (h < 0f) h = parent.sizeDelta.y;
            var t = Label(parent, text, x, dy, 600f, h, size, color, weight);
            t.alignment = TextAnchor.MiddleLeft;
            if (em != 0f) Spacing(t, em);
            return x + Width(t, em);
        }

        /// <summary>
        /// 字間のある文字を、CSS の中央寄せと同じ所に（CSS は最後の字のあとの字間も幅に入れて中央に置く）。
        /// まん中寄せで組んでから字間で右へずれる分（(n−1)×字間の半分）も戻す
        /// </summary>
        private static void Centered(Text t, float cx, float em)
        {
            Spacing(t, em);
            t.alignment = TextAnchor.MiddleCenter;
            float step = em * t.fontSize;
            var rt = t.rectTransform;
            rt.anchoredPosition = new Vector2(cx - rt.sizeDelta.x / 2f - t.text.Length * step / 2f, rt.anchoredPosition.y);
        }

        /// <summary>文字の幅（CSS の letter-spacing と同じく、最後の字のあとにも字間を足す）</summary>
        private static float Width(Text t, float em) => t.preferredWidth + em * t.fontSize * t.text.Length;

        private static bool IsLatin(string s)
        {
            if (string.IsNullOrEmpty(s)) return false;
            foreach (char c in s) if (c > 0x7E) return false;
            return true;
        }

        private static void Spacing(Text t, float em) => t.gameObject.AddComponent<LetterSpacing>().em = em;

        private static void Shadow(Text t, float a, float dist)
        {
            var s = t.gameObject.AddComponent<Shadow>();
            s.effectColor = new Color(0f, 0f, 0f, a);
            s.effectDistance = new Vector2(0f, -dist);
        }
    }
}
