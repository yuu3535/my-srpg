using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 拠点メニュー Hub2（携帯端末。2026-11-09 総合担当）。2Dの探索の上に重なって開き、背景の探索は透けて見える。
    /// 見た目の正本: docs/10-design/ui/MENU_HUB2_SPEC_2026-11-08.md（基準 1688×780）。開閉は切り裂き（Hub2Motion）。
    /// 右上の MENU の星（探索）で開き、CLOSE の星で閉じる。Esc でも開閉。演出中は「飛ばす」だけ受け付ける（どこを押しても・Esc・Enter・スペース）。
    /// イベントの場面（会話の途中など）では開けない（MENU の星を隠す）。画面はコードで組み立てる。
    /// まだの物: 太陽盤は静止の絵（回らない）、時間帯アイコン、運命予報のカード、文字のシナリオ連動、所持金・名声のデータ
    /// </summary>
    public class Hub2Menu : MonoBehaviour
    {
        // ── 外から使う ──

        /// <summary>メニューが開いている・開閉の途中（探索の歩く・調べるを止める）</summary>
        public static bool Blocking => instance != null && instance.machine.State != Hub2Motion.State.Closed;

        /// <summary>節目（長い版を流す理由）。シナリオ側から MarkMilestone で知らせる</summary>
        public static readonly Hub2Motion.Milestones Milestones = new Hub2Motion.Milestones();

        /// <summary>ゲームの中の日（時間帯の仕組みができたら、朝に戻るたびに変える）</summary>
        public static string Day = "1";

        public static void MarkMilestone(string reason) => Hub2Motion.MarkMilestone(Milestones, reason);

        /// <summary>ロードしたとき（次に開くのを長い版に）</summary>
        public static void ResetBoot() { Milestones.booted = false; }

        /// <summary>起動したとき・テスト: 節目を全部消す（場面を読み直しても節目は残す。消すのはここだけ）</summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        public static void ResetMilestones() { Milestones.booted = false; Milestones.pending = null; Milestones.lastDay = null; Day = "1"; }

        public static Hub2Menu Instance => instance;

        public Hub2Motion.State State => machine.State;
        public Hub2Motion.Length CurrentLength => machine.Length;
        public string LastOpenReason { get; private set; }

        /// <summary>今の場面に Hub2 を付ける（2Dの探索から呼ぶ）</summary>
        public static Hub2Menu Attach()
        {
            if (instance != null) return instance;
            var go = new GameObject("Hub2Menu");
            return go.AddComponent<Hub2Menu>();
        }

        public bool CanOpen
        {
            get
            {
                if (SaveMenu.IsOpen || SettingsMenu.IsOpen) return false;
                if (explore == null) explore = FindFirstObjectByType<Explore2DController>();
                if (explore != null && explore.Busy) return false;
                if (corridor == null) corridor = FindFirstObjectByType<Corridor2DView>();
                if (corridor != null && corridor.Locked) return false;
                return true;
            }
        }

        public bool RequestOpen()
        {
            if (machine.State != Hub2Motion.State.Closed || !CanOpen) return false;
            var (len, reason) = Hub2Motion.OpenLength(Effect, Milestones, Day);
            Hub2Motion.AfterOpen(Milestones, Day);
            LastOpenReason = reason;
            machine.Open(len);
            HideToast();
            Apply();
            return true;
        }

        public bool RequestClose()
        {
            if (machine.State != Hub2Motion.State.Open) return false;
            machine.Close(Hub2Motion.Length.Short);   // 閉じるのはいつも短い版（すぐ遊びに戻る）
            Apply();
            return true;
        }

        public bool Skip()
        {
            if (!machine.Skip()) return false;
            Apply();
            return true;
        }

        /// <summary>確認用: 開閉の途中の時刻で止めて見る（確認の画像・テスト）</summary>
        public void Scrub(Hub2Motion.Kind kind, float seconds, Hub2Motion.Length length)
        {
            machine.Scrub(kind, seconds, length);
            Apply();
        }

        public static Hub2Motion.Effect Effect => GameSettings.Current.menuEffect switch
        {
            1 => Hub2Motion.Effect.Short,
            2 => Hub2Motion.Effect.None,
            _ => Hub2Motion.Effect.Full,
        };

        // ── 色（正本 §1） ──
        private static Color C(int r, int g, int b, float a = 1f) => new Color(r / 255f, g / 255f, b / 255f, a);
        private static readonly Color InkHi = C(251, 245, 231), Ink = C(241, 234, 217), InkMid = C(207, 199, 182), InkMid2 = C(201, 193, 176),
            InkMid3 = C(185, 177, 161), InkLow = C(165, 158, 144), Gold = C(226, 176, 74), GoldHi = C(243, 205, 120), GoldReticle = C(217, 168, 69),
            Silver = C(201, 205, 210, 0.75f), SilverSoft = C(201, 205, 210, 0.25f), SilverDim = C(201, 205, 210, 0.5f), Panel = C(12, 10, 20, 0.38f),
            Tile = C(16, 14, 24, 0.72f), Chip = C(243, 220, 166), Glow = C(242, 205, 120);

        private static Hub2Menu instance;
        private readonly Hub2Motion.Machine machine = new Hub2Motion.Machine(Hub2Motion.State.Closed);
        private Explore2DController explore;
        private Corridor2DView corridor;
        private Font font;
        private RectTransform canvasRect, menuRoot, content, fx, closeStar, closeStarImg, menuStar, menuStarImg, reticle, newBadge, newRing, tickerDot;
        private CanvasGroup menuGroup;
        private TearMaskGraphic tearMask;
        private PolyGraphic cutLine, cutGlow, edgeUpper, edgeLower, tail;
        private RawImage meteor, meteorGlow, closeGlow, menuGlow;
        private GameObject skipCatcher;
        private Text toast;
        private float toastUntil, clock;
        private readonly List<RectTransform> pageDias = new List<RectTransform>();
        private readonly List<PolyGraphic> pageDiaLines = new List<PolyGraphic>();
        private readonly List<Image> pageDiaFills = new List<Image>();
        private readonly List<Vector2> lensUpper = new List<Vector2>(), lensLower = new List<Vector2>();
        private int page;
        private bool maskFull = true;
        private Canvas canvas;
        private float lastScale = -1f;

        private void Awake()
        {
            if (instance != null && instance != this) { Destroy(gameObject); return; }
            instance = this;
            Build();
            Apply();
        }

        private void OnDestroy() { if (instance == this) instance = null; }

        private void Update()
        {
            float dt = Time.unscaledDeltaTime;
            clock += dt;
            var kb = Keyboard.current;
            bool dialogs = SaveMenu.IsOpen || SettingsMenu.IsOpen;
            if (machine.Locked)
            {
                if (kb != null && (kb.escapeKey.wasPressedThisFrame || kb.enterKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame)) Skip();
                else machine.Step(dt, Effect);
            }
            else if (kb != null && kb.escapeKey.wasPressedThisFrame && !dialogs)
            {
                if (machine.State == Hub2Motion.State.Open) RequestClose();
                else RequestOpen();
            }
            Apply();
            Idle();
            // 窓の大きさが変わって倍率が変わったら、文字を作り直す（作り直さないと、前の倍率の粗い文字のまま）
            float sf = canvas != null ? canvas.scaleFactor : 1f;
            if (!Mathf.Approximately(sf, lastScale))
            {
                lastScale = sf;
                foreach (var t in GetComponentsInChildren<Text>(true)) t.SetAllDirty();
            }
            if (toast != null && toast.gameObject.activeSelf && Time.unscaledTime > toastUntil) HideToast();
        }

        // ── 毎コマの見え方 ──

        private void Apply()
        {
            if (menuRoot == null) return;
            var f = machine.Current(Effect);
            var g = Geo();
            menuRoot.gameObject.SetActive(f.menu);
            menuGroup.alpha = f.menuOpacity;
            if (f.clipInside) { tearMask.SetTear(TearMaskGraphic.Mode.Inside, f.o, g); maskFull = false; }
            else if (f.clipOutside) { tearMask.SetTear(TearMaskGraphic.Mode.Outside, f.o, g); maskFull = false; }
            else if (!maskFull) { tearMask.SetFull(); maskFull = true; }

            // 切れ目の線・流星・裂け目のふち
            bool cutting = f.hasTear && (f.phase == Hub2Motion.Phase.Cut || f.phase == Hub2Motion.Phase.Hold);
            bool opening = f.hasTear && f.phase == Hub2Motion.Phase.Open;
            fx.gameObject.SetActive(cutting || opening);
            if (cutting)
            {
                var m = Hub2Motion.MeteorAt(f.c, g);
                var pts = new[] { L(g.S), L(m.pos) };
                cutLine.Set(pts, PolyGraphic.Mode.Stroke, false, 3f);
                cutGlow.Set(pts, PolyGraphic.Mode.Stroke, false, 12f);
                bool flying = f.phase == Hub2Motion.Phase.Cut;
                meteor.gameObject.SetActive(flying);
                meteorGlow.gameObject.SetActive(flying);
                tail.gameObject.SetActive(flying);
                if (flying)
                {
                    var rt = meteor.rectTransform;
                    rt.anchoredPosition = L(m.pos);
                    rt.localScale = Vector3.one * m.scale;
                    rt.localEulerAngles = new Vector3(0f, 0f, -m.rotate);
                    meteorGlow.rectTransform.anchoredPosition = L(m.pos);
                    meteorGlow.rectTransform.localScale = Vector3.one * m.scale;
                    Vector2 back = m.pos - g.u * Hub2Motion.Tail * Mathf.Min(1f, f.c * 3f);
                    tail.Set(new[] { L(back), L(m.pos) }, PolyGraphic.Mode.Stroke, false, 5f * m.scale, new[] { new Color(Glow.r, Glow.g, Glow.b, 0f), new Color(1f, 0.95f, 0.8f, 0.95f) });
                }
                edgeUpper.gameObject.SetActive(false);
                edgeLower.gameObject.SetActive(false);
            }
            else if (opening)
            {
                meteor.gameObject.SetActive(false); meteorGlow.gameObject.SetActive(false); tail.gameObject.SetActive(false);
                cutLine.Set(Array.Empty<Vector2>(), PolyGraphic.Mode.Stroke);
                cutGlow.Set(Array.Empty<Vector2>(), PolyGraphic.Mode.Stroke);
                Hub2Motion.TearLens(f.o, g, lensUpper, lensLower);
                var up = new List<Vector2>(); foreach (var p in lensUpper) up.Add(L(p));
                var lo = new List<Vector2>(); foreach (var p in lensLower) lo.Add(L(p));
                float a = 1f - f.o;   // ふちの金は、開くにつれて消える
                edgeUpper.gameObject.SetActive(true); edgeLower.gameObject.SetActive(true);
                edgeUpper.color = edgeLower.color = new Color(Glow.r, Glow.g, Glow.b, a);
                edgeUpper.Set(up, PolyGraphic.Mode.Stroke, false, 3f);
                edgeLower.Set(lo, PolyGraphic.Mode.Stroke, false, 3f);
            }

            // CLOSE の星: 弾ける／着地
            if (f.burst >= 0f) Pose(closeStarImg, closeGlow, Hub2Motion.BurstPose(f.burst));
            else if (f.land >= 0f && f.land < 1f) Pose(closeStarImg, closeGlow, Hub2Motion.LandPose(f.land));
            else Pose(closeStarImg, closeGlow, (1f, 0f, 1f));

            // 探索の MENU の星（イベントの場面では隠す）
            bool showMenuStar = f.explore && (machine.Locked || CanOpen);
            menuStar.gameObject.SetActive(showMenuStar);
            if (f.exploreBurst >= 0f) Pose(menuStarImg, menuGlow, Hub2Motion.BurstPose(f.exploreBurst));
            else Pose(menuStarImg, menuGlow, (1f, 0f, 1f));

            skipCatcher.SetActive(machine.Locked);
        }

        private static void Pose(RectTransform img, RawImage glow, (float scale, float rotate, float opacity) p)
        {
            img.localScale = Vector3.one * p.scale;
            img.localEulerAngles = new Vector3(0f, 0f, -p.rotate);
            var ri = img.GetComponent<RawImage>();
            var c = ri.color; c.a = p.opacity; ri.color = c;
            if (glow != null) { var gc = glow.color; gc.a = 0.35f * p.opacity; glow.color = gc; glow.rectTransform.localScale = Vector3.one * p.scale; }
        }

        /// <summary>止まっている間の小さな動き（レティクル・菱形・星のまたたき・NEW の札・新着の点）</summary>
        private void Idle()
        {
            if (menuRoot == null || !menuRoot.gameObject.activeSelf) { TwinkleMenuStar(); return; }
            bool still = Effect == Hub2Motion.Effect.None;
            if (reticle != null && !still) reticle.localEulerAngles = new Vector3(0f, 0f, -(clock / 18f * 360f) % 360f);
            for (int i = 0; i < pageDias.Count; i++)
            {
                Color col = still ? (Color)Hub2Motion.DiaCycle[i % Hub2Motion.DiaCycle.Length] : Hub2Motion.DiaColor(i, clock);
                bool on = i == page;
                pageDiaLines[i].color = new Color(col.r, col.g, col.b, on ? 1f : 0.72f);
                pageDiaFills[i].color = new Color(col.r, col.g, col.b, on ? 0.22f : 0f);
                pageDias[i].anchoredPosition = new Vector2(pageDias[i].anchoredPosition.x, still ? 0f : Hub2Motion.DiaHopOffset(i, clock));
            }
            float tw = still ? 0.5f : 0.5f + 0.5f * Mathf.Sin(clock / 3.4f * Mathf.PI * 2f);
            if (closeGlow != null && machine.State == Hub2Motion.State.Open) closeGlow.color = new Color(Glow.r, Glow.g, Glow.b, 0.2f + 0.25f * tw);
            if (newRing != null)
            {
                float p = still ? 0f : (clock % 2.2f) / 2.2f;
                newRing.localScale = new Vector3(1f + 0.35f * p, 1f + 0.8f * p, 1f);
                newRing.GetComponent<Image>().color = new Color(Gold.r, Gold.g, Gold.b, 0.6f * (1f - p));
            }
            if (tickerDot != null)
            {
                float p = still ? 1f : 0.55f + 0.45f * Mathf.Cos(clock / 2.2f * Mathf.PI * 2f);
                tickerDot.GetComponent<Image>().color = new Color(Gold.r, Gold.g, Gold.b, p);
            }
        }

        private void TwinkleMenuStar()
        {
            if (menuGlow == null || machine.Locked) return;
            float tw = Effect == Hub2Motion.Effect.None ? 0.5f : 0.5f + 0.5f * Mathf.Sin(clock / 3.4f * Mathf.PI * 2f);
            menuGlow.color = new Color(Glow.r, Glow.g, Glow.b, 0.2f + 0.25f * tw);
        }

        // ── 幾何（画面＝Canvas の大きさ。星は右上） ──

        private Hub2Motion.Geometry Geo()
        {
            var r = canvasRect.rect;
            float w = Mathf.Max(1f, r.width), h = Mathf.Max(1f, r.height);
            return Hub2Motion.TearGeometry(w, h, new Vector2(w - 54f, 58f));
        }

        private static Vector2 L(Vector2 p) => new Vector2(p.x, -p.y);

        // ── 組み立て ──

        private void Build()
        {
            font = StartMenu.FontOf();
            var go = new GameObject("Hub2Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            go.transform.SetParent(transform, false);
            canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 460;   // 探索の札（〜450）より上、セーブ・設定（600）より下
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(Hub2Motion.BaseWidth, Hub2Motion.BaseHeight);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;   // 1688×780 がいつも全部入る
            if (EventSystem.current == null)
                new GameObject("EventSystem", typeof(EventSystem), typeof(UnityEngine.InputSystem.UI.InputSystemUIInputModule));
            canvasRect = (RectTransform)go.transform;

            // メニュー（切り裂きの形で切り抜く）
            menuRoot = Stretch("Menu", canvasRect);
            menuRoot.pivot = new Vector2(0f, 1f);
            menuGroup = menuRoot.gameObject.AddComponent<CanvasGroup>();
            menuRoot.gameObject.AddComponent<CanvasRenderer>();
            tearMask = menuRoot.gameObject.AddComponent<TearMaskGraphic>();
            tearMask.color = Color.white;
            tearMask.raycastTarget = true;   // メニューが出ている間は、後ろの探索を押せない
            menuRoot.gameObject.AddComponent<Mask>().showMaskGraphic = false;

            content = Node("Content", menuRoot);
            content.anchorMin = content.anchorMax = content.pivot = new Vector2(0.5f, 0.5f);
            content.sizeDelta = new Vector2(Hub2Motion.BaseWidth, Hub2Motion.BaseHeight);
            content.anchoredPosition = Vector2.zero;

            BuildScrims();
            BuildWatermark();
            BuildDots();
            BuildDial();
            BuildHeader();
            BuildTicker();
            BuildMainEvent();
            BuildSupport();
            BuildStatus();
            BuildTiles();
            BuildNewBadge();
            BuildToast();
            closeStar = BuildStar("CLOSE", menuRoot, false, out closeStarImg, out closeGlow);
            closeStar.GetComponent<Button>().onClick.AddListener(() => RequestClose());

            // 切り裂きの線・流星
            fx = Stretch("TearFx", canvasRect);
            fx.pivot = new Vector2(0f, 1f);
            cutGlow = Poly("CutGlow", fx, new Color(Glow.r, Glow.g, Glow.b, 0.28f));
            cutLine = Poly("Cut", fx, new Color(1f, 0.93f, 0.72f, 1f));
            edgeUpper = Poly("EdgeUpper", fx, Glow);
            edgeLower = Poly("EdgeLower", fx, Glow);
            tail = Poly("Tail", fx, Color.white);
            meteorGlow = Raw("MeteorGlow", fx, Hub2Textures.Glow, new Vector2(140f, 140f), new Color(Glow.r, Glow.g, Glow.b, 0.55f));
            meteor = Raw("Meteor", fx, Hub2Textures.Star, new Vector2(60f, 60f), Color.white);
            foreach (var ri in new[] { meteor, meteorGlow })
            {
                ri.rectTransform.anchorMin = ri.rectTransform.anchorMax = new Vector2(0f, 1f);
                ri.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            }

            // 探索の MENU の星
            menuStar = BuildStar("MENU", canvasRect, true, out menuStarImg, out menuGlow);
            menuStar.GetComponent<Button>().onClick.AddListener(() => RequestOpen());

            // 演出中に押したら飛ばす（いちばん手前）
            var sc = Stretch("SkipCatcher", canvasRect);
            sc.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var trig = sc.gameObject.AddComponent<EventTrigger>();
            var entry = new EventTrigger.Entry { eventID = EventTriggerType.PointerDown };
            entry.callback.AddListener(_ => Skip());
            trig.triggers.Add(entry);
            skipCatcher = sc.gameObject;
        }

        // 暗幕2枚（正本 §3-1）。画面の比率が違っても覆うよう、上下左右へはみ出させる
        private void BuildScrims()
        {
            var dark = new Color(10f / 255f, 9f / 255f, 16f / 255f);
            // 左の暗がり: x −800〜709（基準の 0% は x 0、30% は 506、42% は 709）
            var left = Place(Raw("LeftDark", content, null, Vector2.zero, Color.white).rectTransform, -800f, -400f, 1509f, 1580f);
            float W = 1509f;
            left.GetComponent<RawImage>().texture = Hub2Textures.Gradient("left", dark,
                new Vector2(0f, 0.45f), new Vector2(800f / W, 0.45f), new Vector2(1306f / W, 0.30f), new Vector2(1f, 0f));
            // 右のガラス: x 690〜（右へはみ出す）。左端 0 → 60px で 0.62 → 右端 0.72（ぼかしは WebGL で重いので省き、少し濃く）
            float RW = 998f + 800f;
            var glass = Place(Raw("RightGlass", content, null, Vector2.zero, Color.white).rectTransform, 690f, -400f, RW, 1580f);
            glass.GetComponent<RawImage>().texture = Hub2Textures.Gradient("glass", new Color(12f / 255f, 10f / 255f, 20f / 255f),
                new Vector2(0f, 0f), new Vector2(60f / RW, 0.66f), new Vector2(998f / RW, 0.76f), new Vector2(1f, 0.76f));
        }

        private void BuildWatermark()
        {
            var t = Label(content, "ORCUS", 712f, -44f, 980f, 260f, 220, new Color(Ink.r, Ink.g, Ink.b, 0.028f), FontStyle.Bold);   // 正本は輪郭線だけ（ほぼ見えない）。字の輪郭は描けないので、ごく薄い塗り
            t.alignment = TextAnchor.UpperLeft;
        }

        private void BuildDots()
        {
            var ri = Raw("Dots", content, Hub2Textures.Dots(924, 176), Vector2.zero, Color.white);
            Place(ri.rectTransform, 744f, 206f, 924f, 176f);
        }

        // 太陽盤（正本 §3-5「既存の実装」。Unity にはまだ無いので、試作から書き出した静止の絵＋押せる所）
        private static readonly (string label, float x, float y, float w, float h)[] DialCommands =
        {
            ("セーブ", 315f, 88f, 222f, 64f), ("身支度", 376f, 214f, 224f, 64f), ("出撃", 383f, 352f, 256f, 74f),
            ("探索", 376f, 503f, 224f, 64f), ("支援会話", 315f, 628f, 222f, 64f),
        };

        private void BuildDial()
        {
            var tex = Resources.Load<Texture2D>("Menu/sun_dial_arshe");
            var ri = Raw("SunDial", content, tex, Vector2.zero, Color.white);
            Place(ri.rectTransform, 0f, 0f, 668f, 780f);
            foreach (var c in DialCommands)
            {
                var b = Place(Node("Cmd_" + c.label, content), c.x, c.y, c.w, c.h);
                b.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
                var label = c.label;
                b.gameObject.AddComponent<Button>().onClick.AddListener(() => Command(label));
            }
        }

        private void BuildHeader()
        {
            var en = Label(content, "PROLOGUE", 770f, 26f, 140f, 22f, 15, Gold, FontStyle.Bold);
            en.alignment = TextAnchor.MiddleLeft;
            Fill(content, 770f + 112f, 37f, 36f, 1f, Gold);
            var sub = Label(content, "百年戦争と祝賀会の朝", 770f + 162f, 26f, 400f, 22f, 16, InkMid2, FontStyle.Bold);
            sub.alignment = TextAnchor.MiddleLeft;
            var place = Label(content, "オルクス城・回廊", 768f, 54f, 800f, 70f, 56, InkHi, FontStyle.Bold);
            place.alignment = TextAnchor.MiddleLeft;
            Shadow(place, 0.8f);
        }

        private void BuildTicker()
        {
            var b = Place(Node("Ticker", content), 772f, 146f, 918f, 36f);
            b.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            b.gameObject.AddComponent<Button>().onClick.AddListener(() => Toast("運命予報のカードは、次の段階で入れます"));
            var icon = Raw("Icon", b, Resources.Load<Texture2D>("Menu/fortune_icon"), Vector2.zero, Color.white);
            Place(icon.rectTransform, 0f, 4f, 27f, 27f);
            var name = Label(b, "運命予報", 39f, 0f, 80f, 36f, 16, Gold, FontStyle.Bold);
            name.alignment = TextAnchor.MiddleLeft;
            var beta = Label(b, "β", 104f, 2f, 16f, 14f, 11, Gold, FontStyle.Normal);
            beta.alignment = TextAnchor.UpperLeft;
            tickerDot = Fill(b, 126f, 14.5f, 7f, 7f, Gold).rectTransform;
            Fill(b, 145f, 10f, 1f, 16f, new Color(Gold.r, Gold.g, Gold.b, 0.45f));
            // 流さない（原作者 2026-11-08）。止まった1行で、はみ出しは「…」
            var body = Label(b, Ellipsize("運勢：蛇。　失せモノに注意。　笑う声が聞こえたら、振り返らないこと。", 36), 158f, 0f, 760f, 36f, 17, Ink, FontStyle.Normal);
            body.alignment = TextAnchor.MiddleLeft;
            var line = Raw("Underline", b, Hub2Textures.Gradient("tickerline", Gold, new Vector2(0f, 0.6f), new Vector2(0.7f, 0.15f), new Vector2(1f, 0f)), Vector2.zero, Color.white);
            Place(line.rectTransform, 0f, 38f, 918f, 1f);
        }

        private static string Ellipsize(string s, int max) => s.Length <= max ? s : s.Substring(0, max - 1) + "…";

        // メインイベント（正本 §3-5）。右下の菱形だけ（原作者 2026-11-08）
        private void BuildMainEvent()
        {
            var box = Place(Node("MainEvent", content), 804f, 204f, 556f, 156f);
            var outer = new[] { P(14, 0), P(542, 0), P(556, 14), P(556, 142), P(542, 156), P(14, 156), P(0, 142), P(0, 102), P(20, 78), P(0, 54), P(0, 14) };
            var inner = new[] { P(18, 6), P(538, 6), P(550, 18), P(550, 138), P(538, 150), P(18, 150), P(8, 140), P(8, 98), P(26, 78), P(8, 58), P(8, 16) };
            var fill = Poly("Fill", box, Panel, 556f, 156f); fill.Set(outer, PolyGraphic.Mode.Fill); fill.raycastTarget = true;
            var line = Poly("Line", box, Silver); line.Set(outer, PolyGraphic.Mode.Stroke, true, 1.5f);
            var line2 = Poly("Inner", box, SilverSoft); line2.Set(inner, PolyGraphic.Mode.Stroke, true, 1f);
            var btn = box.gameObject.AddComponent<Button>();
            btn.targetGraphic = fill;
            var cols = btn.colors; cols.highlightedColor = new Color(1.3f, 1.25f, 1.4f, 1f); cols.pressedColor = new Color(1.5f, 1.4f, 1.6f, 1f); btn.colors = cols;
            btn.onClick.AddListener(() => Toast("マップで目的地を見せるのは、マップができてから"));
            Diamond(box, 556f - 12f - 3.5f, 156f + 3f - 3.5f, 7f, Gold, true);
            // レティクル（18秒で1回転）
            reticle = Place(Node("Reticle", box), -9f, 61f, 34f, 34f);
            reticle.pivot = new Vector2(0.5f, 0.5f);
            reticle.anchoredPosition = new Vector2(-9f + 17f, -(61f + 17f));
            var circle = new List<Vector2>();
            for (int i = 0; i < 28; i++) { float a = i / 28f * Mathf.PI * 2f; circle.Add(new Vector2(Mathf.Cos(a) * 10f, Mathf.Sin(a) * 10f)); }
            var disc = Poly("Disc", reticle, C(12, 10, 20, 0.85f)); disc.rectTransform.anchorMin = disc.rectTransform.anchorMax = new Vector2(0.5f, 0.5f); disc.Set(circle, PolyGraphic.Mode.Fill);
            var ring = Poly("Ring", reticle, GoldReticle); ring.rectTransform.anchorMin = ring.rectTransform.anchorMax = new Vector2(0.5f, 0.5f); ring.Set(circle, PolyGraphic.Mode.Stroke, true, 1.5f);
            foreach (var d in new[] { new Vector2(0, 1), new Vector2(0, -1), new Vector2(1, 0), new Vector2(-1, 0) })
            {
                var tick = Poly("Tick", reticle, GoldReticle); tick.rectTransform.anchorMin = tick.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                tick.Set(new[] { d * 12f, d * 17f }, PolyGraphic.Mode.Stroke, false, 1.5f);
            }
            var dc = Poly("Center", reticle, Gold); dc.rectTransform.anchorMin = dc.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            dc.Set(new[] { new Vector2(0, 3), new Vector2(3, 0), new Vector2(0, -3), new Vector2(-3, 0) }, PolyGraphic.Mode.Fill);
            // 文字
            var en = Label(box, "MAIN EVENT", 42f, 14f, 120f, 20f, 14, Gold, FontStyle.Bold); en.alignment = TextAnchor.MiddleLeft;
            var jp = Label(box, "メインイベント", 150f, 14f, 140f, 20f, 14, InkMid3, FontStyle.Normal); jp.alignment = TextAnchor.MiddleLeft;
            var title = Label(box, "ギュンターとの演習", 42f, 38f, 500f, 54f, 38, InkHi, FontStyle.Bold); title.alignment = TextAnchor.MiddleLeft; Shadow(title, 0.85f);
            var pin = Poly("Pin", box, Gold);
            pin.Set(new[] { P(42, 106), P(52, 106), P(52, 112), P(47, 122), P(42, 112) }, PolyGraphic.Mode.Fill);
            var go = Label(box, "訓練場へ向かう", 60f, 102f, 300f, 24f, 18, InkMid, FontStyle.Bold); go.alignment = TextAnchor.MiddleLeft;
            // 右下の札「マップで確認」
            var chip = Place(Node("MapChip", box), 556f - 18f - 132f, 156f - 14f - 28f, 132f, 28f);
            chip.gameObject.AddComponent<Image>().color = C(10, 10, 15, 0.7f);
            var ol = chip.gameObject.AddComponent<Outline>(); ol.effectColor = C(226, 176, 74, 0.55f); ol.effectDistance = new Vector2(1f, -1f);
            var ct = Label(chip, "マップで確認", 26f, 0f, 104f, 28f, 13, Chip, FontStyle.Normal); ct.alignment = TextAnchor.MiddleLeft;
            var map = Poly("MapIcon", chip, Chip); map.Set(new[] { P(8, 9), P(13, 7), P(18, 9), P(22, 7), P(22, 20), P(18, 22), P(13, 20), P(8, 22) }, PolyGraphic.Mode.Stroke, true, 1.2f);
        }

        private void BuildSupport()
        {
            var head = Label(content, "支援の深い仲間", 836f, 392f, 200f, 24f, 19, InkHi, FontStyle.Bold); head.alignment = TextAnchor.MiddleLeft;
            Fill(content, 836f + 170f, 404f, 470f - 170f - 64f, 1f, C(226, 176, 74, 0.3f));
            for (int i = 0; i < 3; i++)
            {
                float x = 836f + 470f - 54f + i * 19f;
                var d = Place(Node("PageDia" + i, content), x, 399f, 10f, 10f);
                var holder = Node("Hop", d); holder.anchorMin = holder.anchorMax = holder.pivot = new Vector2(0.5f, 0.5f); holder.sizeDelta = new Vector2(10f, 10f);
                holder.localEulerAngles = new Vector3(0f, 0f, 45f);
                var fillImg = holder.gameObject.AddComponent<Image>(); fillImg.raycastTarget = false;
                var line = Poly("Line", holder, SilverDim);
                line.rectTransform.anchorMin = line.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                line.Set(new[] { new Vector2(-5, 5), new Vector2(5, 5), new Vector2(5, -5), new Vector2(-5, -5) }, PolyGraphic.Mode.Stroke, true, 1.2f);
                int index = i;
                var hit = d.gameObject.AddComponent<Image>(); hit.color = new Color(0, 0, 0, 0);
                d.gameObject.AddComponent<Button>().onClick.AddListener(() => page = index);
                pageDias.Add(holder); pageDiaLines.Add(line); pageDiaFills.Add(fillImg);
            }
            Card(0, "カリマ", "Menu/card_karima", 876f, 464f);
            Card(1, "ギュンター", "Menu/card_gunter", 1025f, 458f);
            Card(2, "キャリー", "Menu/card_carrie", 1164f, 450f);
        }

        private void Card(int i, string name, string art, float x, float y)
        {
            var card = Place(Node("Card_" + name, content), x, y, 110f, 270f);
            var shape = new[] { P(0, 29.7f), P(110, 0), P(110, 240.3f), P(0, 270) };
            var bg = Poly("Shape", card, C(12, 10, 20, 0.45f), 110f, 270f); bg.Set(shape, PolyGraphic.Mode.Fill); bg.raycastTarget = true;
            bg.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            var pic = Raw("Art", bg.rectTransform, Resources.Load<Texture2D>(art), Vector2.zero, Color.white);
            Place(pic.rectTransform, 0f, 0f, 110f, 270f);
            // 下から40%の暗がり（縦のグラデーション。横の絵を90°回して使う）
            var grad = Raw("Fade", bg.rectTransform, Hub2Textures.Gradient("cardfade", C(14, 13, 20), new Vector2(0f, 0.92f), new Vector2(1f, 0f)), Vector2.zero, Color.white);
            var gr = grad.rectTransform;
            gr.anchorMin = gr.anchorMax = new Vector2(0f, 1f); gr.pivot = new Vector2(0.5f, 0.5f);
            gr.sizeDelta = new Vector2(108f, 110f);
            gr.anchoredPosition = new Vector2(55f, -(270f - 54f));
            gr.localEulerAngles = new Vector3(0f, 0f, 90f);
            var frame = Poly("Frame", card, Silver); frame.Set(shape, PolyGraphic.Mode.Stroke, true, 1.5f);
            Diamond(card, 110f, 0f, 8f, Gold, true);
            Diamond(card, 0f, 270f, 8f, Gold, true);
            var no = Label(card, (i + 1).ToString("00"), 12f, 270f - 36f - 42f, 60f, 18f, 13, Gold, FontStyle.Bold); no.alignment = TextAnchor.MiddleLeft;
            var nm = Label(card, name, 12f, 270f - 36f - 22f, 100f, 22f, 16, InkHi, FontStyle.Bold); nm.alignment = TextAnchor.MiddleLeft; Shadow(nm, 0.9f);
            var btn = card.gameObject.AddComponent<Button>();
            btn.targetGraphic = bg;
            btn.onClick.AddListener(() => Toast(name + "との支援会話は、まだつながっていません"));
        }

        private void BuildStatus()
        {
            var en = Label(content, "STATUS", 1352f, 396f, 80f, 20f, 14, Gold, FontStyle.Bold); en.alignment = TextAnchor.MiddleLeft;
            Fill(content, 1352f + 76f, 406f, 318f - 76f, 1f, C(226, 176, 74, 0.3f));
            StatusRow(1352f, 422f, "Menu/wallet_icon", "所持金", "FUNDS", "—", "G");
            StatusRow(1352f, 490f, "Menu/renown_icon", "名声", "FAME", "—", "pt");
            var tile = TileShape("Reward", 1352f, 570f, 318f, 64f);
            var icon = Raw("Icon", tile, Resources.Load<Texture2D>("Menu/ouroboros_icon"), Vector2.zero, Color.white);
            Place(icon.rectTransform, 12f, 9f, 46f, 46f);
            var t = Label(tile, "名声報酬", 70f, 10f, 200f, 24f, 17, InkHi, FontStyle.Bold); t.alignment = TextAnchor.MiddleLeft;
            var s = Label(tile, "武器・ボーナスアイテムと交換", 70f, 34f, 220f, 18f, 12, InkLow, FontStyle.Normal); s.alignment = TextAnchor.MiddleLeft;
            var chev = Label(tile, "›", 286f, 6f, 24f, 48f, 30, Gold, FontStyle.Bold); chev.alignment = TextAnchor.MiddleCenter;
            tile.GetComponent<Button>().onClick.AddListener(() => Toast("名声報酬は、まだつながっていません"));
        }

        private void StatusRow(float x, float y, string icon, string name, string en, string value, string unit)
        {
            var ic = Raw("Icon", content, Resources.Load<Texture2D>(icon), Vector2.zero, Color.white);
            Place(ic.rectTransform, x, y + 12f, 44f, 44f);
            var n = Label(content, name, x + 56f, y + 14f, 100f, 22f, 16, InkHi, FontStyle.Bold); n.alignment = TextAnchor.MiddleLeft;
            var e = Label(content, en, x + 56f, y + 36f, 100f, 16f, 11, InkLow, FontStyle.Normal); e.alignment = TextAnchor.MiddleLeft;
            var v = Label(content, value, x + 150f, y + 12f, 136f, 44f, 30, InkHi, FontStyle.Bold); v.alignment = TextAnchor.MiddleRight;
            var u = Label(content, unit, x + 290f, y + 26f, 28f, 22f, 14, InkMid3, FontStyle.Normal); u.alignment = TextAnchor.MiddleLeft;
            Fill(content, x, y + 66f, 318f, 1f, C(241, 234, 217, 0.1f));
        }

        private void BuildTiles()
        {
            var cfg = TileShape("Config", 1350f, 668f, 156f, 64f);
            var gear = Raw("Icon", cfg, Resources.Load<Texture2D>("Menu/settings_icon"), Vector2.zero, Color.white);
            Place(gear.rectTransform, 12f, 12f, 40f, 40f);
            var t1 = Label(cfg, "設定", 62f, 10f, 80f, 24f, 17, InkHi, FontStyle.Bold); t1.alignment = TextAnchor.MiddleLeft;
            var e1 = Label(cfg, "CONFIG", 62f, 34f, 80f, 18f, 11, InkLow, FontStyle.Normal); e1.alignment = TextAnchor.MiddleLeft;
            cfg.GetComponent<Button>().onClick.AddListener(SettingsMenu.Open);
            var log = TileShape("Log", 1350f + 168f, 668f, 156f, 64f);
            var doc = Poly("LogIcon", log, Gold);
            doc.Set(new[] { P(18, 14), P(30, 14), P(36, 20), P(36, 50), P(18, 50) }, PolyGraphic.Mode.Stroke, true, 1.4f);
            var lines = Poly("LogLines", log, Gold);
            lines.Set(new[] { P(22, 30), P(32, 30) }, PolyGraphic.Mode.Stroke, false, 1.2f);
            var t2 = Label(log, "ログ", 62f, 10f, 80f, 24f, 17, InkHi, FontStyle.Bold); t2.alignment = TextAnchor.MiddleLeft;
            var e2 = Label(log, "LOG", 62f, 34f, 80f, 18f, 11, InkLow, FontStyle.Normal); e2.alignment = TextAnchor.MiddleLeft;
            log.GetComponent<Button>().onClick.AddListener(() => Toast("ログは、まだつながっていません"));
        }

        /// <summary>タイル（半透明の暗色＋右下を14px斜めに切り欠き）。押せる</summary>
        private RectTransform TileShape(string name, float x, float y, float w, float h)
        {
            var rt = Place(Node(name, content), x, y, w, h);
            var shape = new[] { P(0, 0), P(w, 0), P(w, h - 14f), P(w - 14f, h), P(0, h) };
            var bg = Poly("Bg", rt, Tile, w, h); bg.Set(shape, PolyGraphic.Mode.Fill); bg.raycastTarget = true;
            var btn = rt.gameObject.AddComponent<Button>();
            btn.targetGraphic = bg;
            var cols = btn.colors; cols.highlightedColor = new Color(1.6f, 1.6f, 1.7f, 1.3f); cols.pressedColor = new Color(1.9f, 1.9f, 2f, 1.3f); btn.colors = cols;
            return rt;
        }

        // NEW の札（太陽盤の「支援会話」の右上。新しい支援会話があるときだけ。今は見本として出す）
        private void BuildNewBadge()
        {
            newBadge = Place(Node("NewBadge", content), 500f, 616f, 62f, 24f);
            newRing = Node("Ring", newBadge);
            newRing.anchorMin = Vector2.zero; newRing.anchorMax = Vector2.one; newRing.sizeDelta = Vector2.zero;
            var ringImg = newRing.gameObject.AddComponent<Image>(); ringImg.raycastTarget = false;
            var bg = newBadge.gameObject.AddComponent<Image>(); bg.color = Gold; bg.raycastTarget = false;
            var t = Label(newBadge, "NEW", 0f, 0f, 62f, 24f, 13, C(23, 22, 27), FontStyle.Bold);
            t.alignment = TextAnchor.MiddleCenter;
        }

        private void BuildToast()
        {
            toast = Label(content, "", 744f, 724f, 600f, 30f, 16, Ink, FontStyle.Normal);
            toast.alignment = TextAnchor.MiddleCenter;
            Shadow(toast, 0.9f);
            toast.gameObject.SetActive(false);
        }

        public void Toast(string text)
        {
            if (toast == null) return;
            toast.text = text;
            toast.gameObject.SetActive(true);
            toastUntil = Time.unscaledTime + 2.2f;
        }

        private void HideToast() { if (toast != null) toast.gameObject.SetActive(false); }

        private void Command(string label)
        {
            switch (label)
            {
                case "セーブ": SaveMenu.Open(SaveMenu.Mode.Save); break;
                default: Toast(label + "は、まだつながっていません"); break;
            }
        }

        /// <summary>CLOSE／MENU の星（右上。104×124、星60px＋英字12px）。画面の右の端に付ける</summary>
        private RectTransform BuildStar(string label, RectTransform parent, bool withBg, out RectTransform starImg, out RawImage glow)
        {
            var rt = Node(label + "Star", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(1f, 1f);
            rt.sizeDelta = new Vector2(104f, 124f);
            rt.anchoredPosition = new Vector2(withBg ? 0f : -2f, withBg ? 0f : 2f);
            var bg = rt.gameObject.AddComponent<Image>();
            bg.color = withBg ? C(12, 10, 20, 0.55f) : new Color(0f, 0f, 0f, 0f);
            rt.gameObject.AddComponent<Button>().transition = Selectable.Transition.None;
            glow = Raw("Glow", rt, Hub2Textures.Glow, new Vector2(110f, 110f), new Color(Glow.r, Glow.g, Glow.b, 0.35f));
            Centered(glow.rectTransform, 52f, 56f);
            var star = Raw("Star", rt, Hub2Textures.Star, new Vector2(60f, 60f), Color.white);
            Centered(star.rectTransform, 52f, 56f);
            starImg = star.rectTransform;
            var t = Label(rt, label, 0f, 92f, 104f, 20f, 12, withBg ? Ink : InkMid, FontStyle.Bold);
            t.alignment = TextAnchor.MiddleCenter;
            return rt;
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

        /// <summary>左上原点・下向き＋Y の (x, y, w, h) に置く</summary>
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

        /// <summary>多角形。押せる形にするときは w・h（形を囲む大きさ）を渡す（押した所の判定は RectTransform の四角で見るため）</summary>
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

        /// <summary>金の小さな菱形（中心 cx, cy）</summary>
        private static void Diamond(Transform parent, float cx, float cy, float size, Color color, bool filled)
        {
            var rt = Node("Diamond", parent);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(cx, -cy);
            rt.sizeDelta = new Vector2(size, size);
            rt.localEulerAngles = new Vector3(0f, 0f, 45f);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = filled ? color : new Color(0, 0, 0, 0);
            img.raycastTarget = false;
        }

        private Text Label(Transform parent, string text, float x, float y, float w, float h, int size, Color color, FontStyle style)
        {
            var rt = Place(Node("Text", parent), x, y, w, h);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = font;
            t.text = text;
            t.fontSize = size;
            t.fontStyle = style;
            t.color = color;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        private static void Shadow(Text t, float a)
        {
            var s = t.gameObject.AddComponent<Shadow>();
            s.effectColor = new Color(0f, 0f, 0f, a);
            s.effectDistance = new Vector2(0f, -2f);
        }
    }
}
