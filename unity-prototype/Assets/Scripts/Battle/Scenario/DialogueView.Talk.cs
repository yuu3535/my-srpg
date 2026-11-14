using System;
using System.Collections.Generic;
using System.Linq;
using Srpg.Battle.Menu;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 会話枠 H（2026-11-13 総合担当。正本 docs/10-design/ui/talk/talk_spec.md と TalkH.dc.html。基準 1688×780）。
    /// 吹き出し（角を14px切った枠・銀の細い線・内側の線・ドット柄）、名前札（平行四辺形）、「次へ」の印、上のタブ（場所／支援ランク）、
    /// 下のボタン帯（会話ログ・オート・スキップ）、会話ログの画面、支援会話モード（顔の横の吹き出し・CLOSE の星）。
    /// 色は Unity の線形の空間で混ぜるので、ブラウザと同じに見えるよう不透明度を直して使う（Hub2Textures.Seen／SeenLight）
    /// </summary>
    public partial class DialogueView
    {
        public const float TalkW = 1688f, TalkH = 780f;

        // ── テーマ（仕様書 §1。既定は汎用。オルクス城の色を使う場所は、あとで決める。原作者 2026-11-13） ──
        public enum TalkTheme { General, Orcus }
        public static TalkTheme Theme = TalkTheme.General;

        private struct Palette { public Color ln, ln2, ac, acg, pl, tx, nar; }

        private static Color Rgb(int r, int g, int b, float a = 1f) => new Color(r / 255f, g / 255f, b / 255f, a);
        private static Color HexC(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }

        private static Palette Pal => Theme == TalkTheme.Orcus
            ? new Palette { ln = Rgb(201, 205, 210, 0.75f), ln2 = Rgb(201, 205, 210, 0.25f), ac = HexC("#e2b04a"), acg = Rgb(242, 196, 96, 0.55f), pl = Rgb(12, 10, 20), tx = HexC("#f1ead9"), nar = HexC("#d9d0bd") }
            : new Palette { ln = Rgb(214, 218, 224, 0.72f), ln2 = Rgb(214, 218, 224, 0.22f), ac = HexC("#e4e7ec"), acg = Rgb(214, 226, 240, 0.55f), pl = Rgb(9, 10, 13), tx = HexC("#f1efe9"), nar = HexC("#d6d2c9") };

        private static Color Light(Color c, float fg = 0.85f) => new Color(c.r, c.g, c.b, Hub2Textures.SeenLight(c.a, fg));
        private static Color Dark(Color c, float a) => new Color(c.r, c.g, c.b, Hub2Textures.Seen(a));

        /// <summary>章の英字（上のタブ）。シナリオの章ができたら差し替える</summary>
        public static string Chapter = "PROLOGUE";
        /// <summary>場所の名前（上のタブ）。空なら会話のブロックの「背景」（場所）</summary>
        public string Place { get; set; }

        // ── 支援会話モード（仕様書 §9） ──
        public bool SupportMode { get; private set; }
        private int supportSeen;
        private string supportTitle = "";
        private Action supportClose;

        /// <summary>
        /// 支援会話として流す（2人・顔の横の吹き出し・上のタブはランク・右上に CLOSE）。ranksSeen＝見終わったランクの数（今のランクの番号）。
        /// onClose は、最後まで読んだときも CLOSE で閉じたときも1回だけ呼ぶ
        /// </summary>
        public void PlaySupport(ScenarioBlock scenarioBlock, int ranksSeen, string title, Action onClose)
        {
            SupportMode = true;
            supportSeen = Mathf.Clamp(ranksSeen, 0, 2);
            supportTitle = title ?? "";
            supportClose = onClose;
            Play(scenarioBlock, () => { SupportMode = false; var c = supportClose; supportClose = null; c?.Invoke(); });
        }

        // ── 1行の文字（仕様書 §1・§4） ──
        private const float CW = 31.8f, LH = 50f;
        /// <summary>1行に入れる字の数の上限（仕様書に無いので、吹き出しが画面に収まる幅で総合担当が決めた。2026-11-13）</summary>
        public const int MaxChars = 26;

        // ── 立ち絵の置き方（仕様書 §3。立ち絵は仮。見本と同じ見え方になるよう、透明でない所の高さをそろえる） ──
        private struct Figure { public float height, headX, faceY; }   // 表示の高さ・頭の中心（右向きの絵の左から）・顔の中心（上から）
        private static readonly Dictionary<string, Figure> Figures = new Dictionary<string, Figure>
        {
            { "アルシェ", new Figure { height = 950f, headX = 156f, faceY = 110f } },
            { "カリマ", new Figure { height = 950f, headX = 128f, faceY = 110f } },
            { "キャリー", new Figure { height = 1060f, headX = 491f - 221f, faceY = 112f } },
            { "ギュンター", new Figure { height = 1100f, headX = 365f - 175f, faceY = 128f } },
            // アルバス（見本に無い。albas.png の頭の中心 409,118・透明でない所 36〜740 × 7〜1012 から、高さ 1080 で）
            { "アルバス", new Figure { height = 1080f, headX = (409f - 36f) * 1080f / 1005f, faceY = (118f - 7f) * 1080f / 1005f } },
        };
        // ── 顔の高さ（目の線）を、年齢と性差の分類でそろえる（2026-11-14 原作者「アルシェとカリマ＝子供、ギュンター＝大人男性、キャリー＝大人女性」。
        //    どの並び・どの枠でも、同じ分類の人は同じ高さに顔が来る。値は原作者が4人の並びで合わせた顔の高さ） ──
        public enum Physique { Child, AdultMale, AdultFemale }
        public static readonly Dictionary<Physique, float> FaceLine = new Dictionary<Physique, float>
        {
            { Physique.Child, 403f }, { Physique.AdultMale, 336f }, { Physique.AdultFemale, 377f },
        };
        public static readonly Dictionary<string, Physique> BuildOf = new Dictionary<string, Physique>
        {
            { "アルシェ", Physique.Child }, { "カリマ", Physique.Child },
            { "ギュンター", Physique.AdultMale }, { "アルバス", Physique.AdultMale }, { "ヘンリー", Physique.AdultMale },
            { "キャリー", Physique.AdultFemale },
        };

        // 枠ごとの頭の中心 X と足元の線（見本の立ち絵の左上＋頭の位置、上端＋高さ）
        private struct Slot { public float headX, baseline; }
        private static readonly Slot SL1 = new Slot { headX = 201f + 156f, baseline = 297f + 950f }, SL2 = new Slot { headX = 439f + 128f, baseline = 293f + 950f },
            SR2 = new Slot { headX = 945f + 221f, baseline = 273f + 1060f }, SR1 = new Slot { headX = 1272f + 175f, baseline = 230f + 1100f },
            SupL1 = new Slot { headX = 276f + 156f, baseline = 297f + 950f }, SupR1 = new Slot { headX = 1153f + 175f, baseline = 218f + 1100f };
        private const float TopMinNormal = 230f, TopMinSupport = 218f;

        private struct Bounds { public float w, h, left, top, right, bottom; }
        private Dictionary<string, Bounds> bounds;

        private struct Placed { public float left, top, width, height, headX; public bool right; }
        private readonly Dictionary<string, Placed> placed = new Dictionary<string, Placed>();

        // ── 部品 ──
        private Font fontSemi, fontExtra, fontEn;
        private Font TalkFont => fontSemi != null ? fontSemi : regularFont;
        private RectTransform bubbleGroup, tabRoot, nextRoot, typingRoot, contextTab, bottomBar, tiles, logRoot, logContent, logThumb, closeStar, phoneStar;
        private CanvasGroup bubbleFade, tabFade;
        private PolyGraphic bubbleFill, bubbleLine, bubbleInner, tabFill, tabLines;
        private RawImage dots;
        private RectTransform diaTL, diaBR;
        private Text nameLabel, pageLabel;
        private ScrollRect logScroll;
        private readonly List<(RectTransform rt, Image fill, PolyGraphic line)> nextDias = new List<(RectTransform, Image, PolyGraphic)>();
        private readonly List<RawImage> typingDots = new List<RawImage>();
        private readonly List<(Image dia, RawImage glow)> rankNow = new List<(Image, RawImage)>();
        private (RectTransform rt, PolyGraphic bg, Text jp) autoTile, skipTile;
        private float lineShownAt = -10f, talkClock;
        private float bx0, by0, bx1, by1;   // 今の吹き出し
        private bool lastRevealing;
        private float doneAt = -1f;
        private float pageAt = -10f;

        /// <summary>
        /// 画面を押して次へ（誤タップ対策。探索の仕様書 §8: 枠が開いた直後・ページが変わった直後の 0.4秒と、
        /// 全部出た直後の 0.35秒は押しても何もしない。2026-11-14。キー・テストの Advance はそのまま）
        /// </summary>
        public void TapAdvance()
        {
            float now = Time.unscaledTime;
            if (now - pageAt < 0.4f) return;
            if (!Revealing && doneAt >= 0f && now - doneAt < 0.35f) return;
            Advance();
        }
        private RawImage designRef;

        private class LogEntry { public string name, text; public bool narration, phone; }
        private readonly List<LogEntry> logEntries = new List<LogEntry>();

        public bool LogOpen => logRoot != null && logRoot.gameObject.activeSelf;

        private static bool Still => Hub2Menu.Effect == Hub2Motion.Effect.None;

        // ── 組み立て ──

        private void BuildTalk()
        {
            fontSemi = Resources.Load<Font>("Fonts/ShipporiMincho-SemiBold") ?? regularFont ?? StartMenu.FontOf();
            fontExtra = Resources.Load<Font>("Fonts/ShipporiMincho-ExtraBold") ?? fontSemi;
            fontEn = Resources.Load<Font>("Fonts/BarlowCondensed-SemiBold") ?? fontSemi;
            LoadBounds();
            var p = Pal;

            // 周辺減光（楕円。中心 50%/52%、横80%・縦78%、45% まで透明 → 端で 0.55）
            var vignette = NewRect("Vignette", root).gameObject.AddComponent<RawImage>();
            vignette.texture = VignetteTexture();
            vignette.raycastTarget = false;
            Stretch(vignette.rectTransform);

            content = NewRect("Content", root);
            content.anchorMin = content.anchorMax = content.pivot = new Vector2(0.5f, 0.5f);
            content.sizeDelta = new Vector2(TalkW, TalkH);
            stageRoot = TNode("Stage", content);
            stageRoot.anchorMin = stageRoot.anchorMax = stageRoot.pivot = new Vector2(0f, 1f);

            // 吹き出し（いつも立ち絵より手前）
            bubbleGroup = TNode("Bubble", content);
            bubbleGroup.anchorMin = bubbleGroup.anchorMax = bubbleGroup.pivot = new Vector2(0f, 1f);
            bubbleFade = bubbleGroup.gameObject.AddComponent<CanvasGroup>();
            bubbleFade.blocksRaycasts = false;
            bubbleFill = TPoly("Fill", bubbleGroup, Dark(p.pl, 0.92f * 0.86f));
            bubbleFill.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            dots = TRaw("Dots", bubbleFill.rectTransform, null, Color.white);
            bubbleLine = TPoly("Line", bubbleGroup, Light(p.ln));
            bubbleInner = TPoly("Inner", bubbleGroup, Light(p.ln2));
            diaTL = TDiamond(bubbleGroup, 0f, 0f, 7f, p.ac, p.acg);
            diaBR = TDiamond(bubbleGroup, 0f, 0f, 7f, p.ac, p.acg);

            bodyText = TLabel(bubbleGroup, "", 0f, 0f, 1200f, 120f, 30, p.tx, 600);
            bodyText.alignment = TextAnchor.UpperLeft;
            bodyText.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.06f;
            bodyText.lineSpacing = LineSpacingFor(bodyText, LH);

            // 名前札（平行四辺形・地は pl・上下に ln の線）
            tabRoot = TNode("NameTab", bubbleGroup);
            tabRoot.anchorMin = tabRoot.anchorMax = tabRoot.pivot = new Vector2(0f, 1f);
            tabFade = tabRoot.gameObject.AddComponent<CanvasGroup>();
            tabFill = TPoly("Fill", tabRoot, Dark(p.pl, 0.92f));
            tabLines = TPoly("Lines", tabRoot, Light(p.ln));
            tabBottom = TPoly("Bottom", tabRoot, Light(p.ln));
            phoneStar = TNode("Star", tabRoot);
            var star = TPoly("Shape", phoneStar, p.ac);
            star.Set(FourStar(8f, 8f, 8f), PolyGraphic.Mode.Fill);
            nameLabel = TLabel(tabRoot, "", 0f, 0f, 400f, 46f, 22, HexC("#f3f1ec"), 700);
            nameLabel.alignment = TextAnchor.MiddleLeft;
            nameLabel.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.14f;

            // 「次へ」の印（文字を出している間は灰色の丸点、出し終えたら菱形が3つ）
            nextRoot = TNode("Next", bubbleGroup);
            nextRoot.anchorMin = nextRoot.anchorMax = nextRoot.pivot = new Vector2(0f, 1f);
            pageLabel = TLabel(nextRoot, "", 0f, 0f, 120f, 20f, 14, HexC("#b8b5ae"), 600);
            pageLabel.alignment = TextAnchor.MiddleRight;
            pageLabel.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.2f;
            for (int i = 0; i < 3; i++)
            {
                var d = TNode("Dia" + i, nextRoot);
                d.anchorMin = d.anchorMax = new Vector2(0f, 1f);
                d.pivot = new Vector2(0.5f, 0.5f);
                d.sizeDelta = new Vector2(9f / 1.4142f, 9f / 1.4142f);
                d.localEulerAngles = new Vector3(0f, 0f, 45f);
                var fill = d.gameObject.AddComponent<Image>();
                fill.raycastTarget = false;
                var line = TPoly("Line", d, Color.white);
                line.rectTransform.anchorMin = line.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                float h = 9f / 1.4142f / 2f;
                line.Set(new[] { new Vector2(-h, h), new Vector2(h, h), new Vector2(h, -h), new Vector2(-h, -h) }, PolyGraphic.Mode.Stroke, true, 1f);
                nextDias.Add((d, fill, line));
            }
            typingRoot = TNode("Typing", bubbleGroup);
            typingRoot.anchorMin = typingRoot.anchorMax = typingRoot.pivot = new Vector2(0f, 1f);
            for (int i = 0; i < 3; i++)
            {
                var dot = TRaw("Dot" + i, typingRoot, Hub2Textures.Disc, Rgb(200, 198, 192, 0.55f));
                dot.rectTransform.anchorMin = dot.rectTransform.anchorMax = new Vector2(0f, 1f);
                dot.rectTransform.pivot = new Vector2(0.5f, 0.5f);
                dot.rectTransform.sizeDelta = new Vector2(5f, 5f);
                dot.rectTransform.anchoredPosition = new Vector2(-42.5f + i * 17f, -10f);   // 丸点 5px・間12・右の余白6
                typingDots.Add(dot);
            }

            BuildContextTab();
            BuildBottomBar();
            BuildLog();

            // 支援会話の CLOSE の星（右上）
            closeStar = TStar("CLOSE", root, () => { var c = supportClose; supportClose = null; SupportMode = false; Close(); c?.Invoke(); });
            closeStar.gameObject.SetActive(false);

#if UNITY_EDITOR
            designRef = TRaw("DesignRef", root, null, new Color(1f, 1f, 1f, 0.4f));
            var dr = designRef.rectTransform;
            dr.anchorMin = dr.anchorMax = dr.pivot = new Vector2(0.5f, 0.5f);
            dr.sizeDelta = new Vector2(TalkW, TalkH);
            ApplyDesignRef();
#endif
        }

        /// <summary>会話を始めるとき（Play から）</summary>
        private void OnPlayTalk()
        {
            logEntries.Clear();
            CloseLog();
            closeStar.gameObject.SetActive(SupportMode);
            RebuildContextTab();
            RefreshToggles();
        }

        // ── 上のタブ（§7） ──

        private void BuildContextTab()
        {
            contextTab = TNode("ContextTab", root);
            contextTab.anchorMin = contextTab.anchorMax = contextTab.pivot = new Vector2(0.5f, 1f);
            contextTab.anchoredPosition = Vector2.zero;
        }

        private void RebuildContextTab()
        {
            for (int i = contextTab.childCount - 1; i >= 0; i--) Destroy(contextTab.GetChild(i).gameObject);
            for (int i = contextTab.childCount - 1; i >= 0; i--) contextTab.GetChild(i).SetParent(null);
            rankNow.Clear();
            var p = Pal;
            const float H = 43f;
            var items = TNode("Items", contextTab);
            items.anchorMin = items.anchorMax = items.pivot = new Vector2(0f, 1f);
            float x = 92f;
            float Add(string text, int size, Color col, int weight, float em)
            {
                var t = TLabel(items, text, x, 12f, 600f, 17f, size, col, weight);
                t.alignment = TextAnchor.MiddleLeft;
                if (em != 0f) t.gameObject.AddComponent<Menu.LetterSpacing>().em = em;
                if (size >= 20) TShadow(t, 0.9f);
                return x += TWidth(t, em);
            }
            void Line(float w, float h, Color col) { var f = TFill(items, x, 12f + 8.5f - h / 2f, w, h, col); x += w; }
            if (SupportMode)
            {
                Add("SUPPORT", 15, p.ac, 600, 0.34f); x += 18f;
                Line(30f, 1f, p.ac); x += 18f;
                for (int k = 0; k < 3; k++)
                {
                    bool now = k == supportSeen;
                    Add(Menu.SupportRoster.RankNames[k], 16, now ? HexC("#fbf5e7") : HexC("#a59e90"), now ? 700 : 600, 0f);
                    x += 8f;
                    var glow = TRaw("Glow", items, Hub2Textures.Glow, new Color(p.acg.r, p.acg.g, p.acg.b, k <= supportSeen ? 0.5f : 0f));
                    glow.rectTransform.anchorMin = glow.rectTransform.anchorMax = new Vector2(0f, 1f);
                    glow.rectTransform.pivot = new Vector2(0.5f, 0.5f);
                    glow.rectTransform.sizeDelta = new Vector2(26f, 26f);
                    glow.rectTransform.anchoredPosition = new Vector2(x + 5f, -(12f + 8.5f));
                    var rk = TDiamondOutline(items, x + 5f, 12f + 8.5f, 10f, p.ac, k <= supportSeen);
                    if (now) rankNow.Add((rk, glow));
                    x += 10f + (k < 2 ? 16f : 0f);
                }
                x += 18f;
                Line(1f, 18f, Light(p.ln2)); x += 18f;
                Add(supportTitle, 20, HexC("#f1ead9"), 700, 0.14f);
            }
            else
            {
                Add(Chapter, 15, p.ac, 600, 0.34f); x += 18f;
                Line(30f, 1f, p.ac); x += 18f;
                Add(PlaceName(), 20, HexC("#f1ead9"), 700, 0.14f);
            }
            float W = x + 92f;
            items.anchoredPosition = new Vector2(-W / 2f, 0f);
            // 台形（下へ左右 44px すぼまる）。地は pl×0.86、縁は上の辺を除く 1.4px の線
            var fill = TPoly("Fill", contextTab, Dark(p.pl, 0.92f * 0.86f));
            fill.rectTransform.anchoredPosition = new Vector2(-W / 2f, 0f);
            fill.Set(new[] { TP(0, 0), TP(W, 0), TP(W - 44f, H), TP(44f, H) }, PolyGraphic.Mode.Fill);
            var line = TPoly("Line", contextTab, Light(p.ln));
            line.rectTransform.anchoredPosition = new Vector2(-W / 2f, 0f);
            line.Set(new[] { TP(0, 0), TP(44f, H), TP(W - 44f, H), TP(W, 0) }, PolyGraphic.Mode.Stroke, false, 1.4f);
            fill.transform.SetAsFirstSibling();
            line.transform.SetSiblingIndex(1);
            var d1 = TDiamond(contextTab, -W / 2f + 43.5f, H + 0.5f, 7f, p.ac, p.acg);
            var d2 = TDiamond(contextTab, W / 2f - 43.5f, H + 0.5f, 7f, p.ac, p.acg);
            foreach (var d in new[] { d1, d2 }) { d.anchorMin = d.anchorMax = new Vector2(0.5f, 1f); }
        }

        private string PlaceName()
        {
            if (!string.IsNullOrEmpty(Place)) return Place;
            return block?.location ?? "";
        }

        // ── 下のボタン帯（§8） ──

        private void BuildBottomBar()
        {
            bottomBar = TNode("BottomBar", root);
            bottomBar.anchorMin = new Vector2(0f, 0f);
            bottomBar.anchorMax = new Vector2(1f, 0f);
            bottomBar.pivot = new Vector2(0.5f, 0f);
            bottomBar.sizeDelta = new Vector2(0f, 74f);
            bottomBar.anchoredPosition = Vector2.zero;
            var band = TRaw("Band", bottomBar, VerticalBand(), Color.white);
            Stretch(band.rectTransform);
            var top = TRaw("TopLine", bottomBar, null, Rgb(255, 255, 255, Hub2Textures.SeenLight(0.08f, 1f)));
            top.rectTransform.anchorMin = new Vector2(0f, 1f);
            top.rectTransform.anchorMax = new Vector2(1f, 1f);
            top.rectTransform.pivot = new Vector2(0.5f, 1f);
            top.rectTransform.sizeDelta = new Vector2(0f, 1f);

            tiles = TNode("Tiles", root);
            tiles.anchorMin = tiles.anchorMax = tiles.pivot = new Vector2(0f, 0f);
            tiles.anchoredPosition = new Vector2(20f, TalkH - 715f - 56f);
            float x = 0f;
            Tile(ref x, "会話ログ", "LOG", 0, OpenLog);
            autoTile = Tile(ref x, "オート", "AUTO", 1, () => { Auto = !Auto; if (Auto) Skip = false; RefreshToggles(); });
            skipTile = Tile(ref x, "スキップ", "SKIP", 2, () => { Skip = !Skip; if (Skip) { Auto = false; FinishReveal(); } RefreshToggles(); });
        }

        private (RectTransform, PolyGraphic, Text) Tile(ref float x, string jp, string en, int icon, Action onClick)
        {
            var p = Pal;
            var rt = TNode("Tile_" + en, tiles);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            // 文字の幅（日本語 16px・字間 0.1em と英字 10px・0.3em の広いほう）
            var jt = TLabel(rt, jp, 0f, 9f, 200f, 22f, 16, HexC("#f1ead9"), 700);
            jt.alignment = TextAnchor.MiddleLeft;
            jt.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.1f;
            var et = TLabel(rt, en, 0f, 31f, 200f, 14f, 10, HexC("#a59e90"), 600);
            et.alignment = TextAnchor.MiddleLeft;
            et.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.3f;
            float iconW = icon == 0 ? 22f : 20f;
            float textW = Mathf.Max(TWidth(jt, 0.1f), TWidth(et, 0.3f));
            float w = 12f + iconW + 10f + textW + 18f, h = 56f;
            rt.anchoredPosition = new Vector2(x, h);
            rt.sizeDelta = new Vector2(w, h);
            x += w + 10f;
            float tx = 12f + iconW + 10f;
            jt.rectTransform.anchoredPosition = new Vector2(tx, -9f);
            et.rectTransform.anchoredPosition = new Vector2(tx, -31f);
            var bg = TPoly("Bg", rt, Dark(Rgb(16, 14, 24), 0.72f), w, h);
            bg.Set(new[] { TP(0, 0), TP(w, 0), TP(w, h - 12f), TP(w - 12f, h), TP(0, h) }, PolyGraphic.Mode.Fill);
            bg.raycastTarget = true;
            bg.transform.SetAsFirstSibling();
            Icon(rt, icon, 12f, (h - iconW) / 2f, iconW, p.ac);
            var btn = rt.gameObject.AddComponent<Button>();
            btn.targetGraphic = bg;
            btn.transition = Selectable.Transition.None;
            btn.onClick.AddListener(() => onClick());
            return (rt, bg, jt);
        }

        // アイコン（24 の枠・線の太さ 1.6 を size に縮めて）
        private static void Icon(RectTransform parent, int kind, float x, float y, float size, Color col)
        {
            float k = size / 24f;
            Vector2 Q(float a, float b) => TP(x + a * k, y + b * k);
            float w = 1.6f * k;
            if (kind == 0)
            {
                TPoly("Doc", parent, col).Set(new[] { Q(5, 3), Q(19, 3), Q(19, 21), Q(5, 21) }, PolyGraphic.Mode.Stroke, true, w);
                TPoly("L1", parent, col).Set(new[] { Q(9, 8), Q(15, 8) }, PolyGraphic.Mode.Stroke, false, w);
                TPoly("L2", parent, col).Set(new[] { Q(9, 12), Q(15, 12) }, PolyGraphic.Mode.Stroke, false, w);
                TPoly("L3", parent, col).Set(new[] { Q(9, 16), Q(13, 16) }, PolyGraphic.Mode.Stroke, false, w);
            }
            else if (kind == 1) TPoly("Play", parent, col).Set(new[] { Q(7, 5), Q(18, 12), Q(7, 19) }, PolyGraphic.Mode.Stroke, true, w);
            else
            {
                TPoly("C1", parent, col).Set(new[] { Q(5, 6), Q(11, 12), Q(5, 18) }, PolyGraphic.Mode.Stroke, false, w);
                TPoly("C2", parent, col).Set(new[] { Q(12, 6), Q(18, 12), Q(12, 18) }, PolyGraphic.Mode.Stroke, false, w);
            }
        }

        /// <summary>オート・スキップの点いている・消えている（点いていると地が明るく、文字がアクセントの色）</summary>
        private void RefreshToggles()
        {
            var p = Pal;
            foreach (var (t, on) in new[] { (autoTile, Auto), (skipTile, Skip) })
            {
                if (t.rt == null) continue;
                t.bg.color = on ? Dark(Rgb(34, 31, 44), 0.94f) : Dark(Rgb(16, 14, 24), 0.72f);
                t.jp.color = on ? p.ac : HexC("#f1ead9");
            }
        }

        // ── 会話ログ（§10） ──

        private void BuildLog()
        {
            var p = Pal;
            logRoot = TNode("Log", root);
            Stretch(logRoot);
            // 下地: ぼかしの代わりに濃く（原作者 2026-11-13: 後ろの吹き出しや文字が読めないくらい）
            var bg = logRoot.gameObject.AddComponent<Image>();
            bg.color = Dark(p.pl, 0.97f);
            var area = TNode("Area", logRoot);
            area.anchorMin = area.anchorMax = area.pivot = new Vector2(0.5f, 0.5f);
            area.sizeDelta = new Vector2(TalkW, TalkH);
            // 見出し
            float x = 150f;
            var en = TLabel(area, "LOG", x, 34f, 100f, 46f, 15, p.ac, 600);
            en.alignment = TextAnchor.MiddleLeft;
            en.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.34f;
            x += TWidth(en, 0.34f) + 16f;
            TFill(area, x, 34f + 23f, 36f, 1f, p.ac);
            x += 36f + 16f;
            var title = TLabel(area, "会話ログ", x, 34f, 400f, 46f, 34, HexC("#fbf5e7"), 800);
            title.alignment = TextAnchor.MiddleLeft;
            title.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.1f;
            var under = TRaw("Underline", area, Hub2Textures.Gradient("talk_log_line_" + Theme, new Color(p.ln.r, p.ln.g, p.ln.b), new Vector2(0f, Hub2Textures.SeenLight(p.ln.a, 0.85f)), new Vector2(0.4f, Hub2Textures.SeenLight(p.ln2.a, 0.85f)), new Vector2(1f, 0f)), Color.white);
            TPlace(under.rectTransform, 150f, 98f, 1300f, 1f);
            TDiamond(area, 149.5f, 98.5f, 7f, p.ac, p.acg);
            // 一覧（新しい物が下。上の 90px は消えていく）
            var list = TNode("List", area);
            TPlace(list, 150f, 112f, 1300f, 650f);
            list.gameObject.AddComponent<RectMask2D>();
            list.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            logContent = TNode("Content", list);
            logContent.anchorMin = new Vector2(0f, 0f);
            logContent.anchorMax = new Vector2(1f, 0f);
            logContent.pivot = new Vector2(0f, 0f);
            logScroll = list.gameObject.AddComponent<ScrollRect>();
            logScroll.viewport = list;
            logScroll.content = logContent;
            logScroll.horizontal = false;
            logScroll.movementType = ScrollRect.MovementType.Clamped;
            logScroll.scrollSensitivity = 40f;
            var fade = TRaw("TopFade", area, VerticalFadeDown(p.pl), Color.white);
            TPlace(fade.rectTransform, 150f, 112f, 1300f, 90f);
            // スクロールの目印
            TFill(area, 1490f, 96f, 1f, 640f, Light(p.ln2));
            logThumb = TFill(area, 1489f, 560f, 3f, 176f, Light(p.ln)).rectTransform;
            TDiamond(area, 1489.5f, 95.5f, 7f, p.ac, p.acg);
            TStar("CLOSE", logRoot, CloseLog);
            logRoot.gameObject.SetActive(false);
        }

        private void AddLog(ScenarioLine line, string name)
        {
            logEntries.Add(new LogEntry { name = name, text = line.text ?? "", narration = line.type == "narration", phone = line.type == "phone" });
            if (logEntries.Count > 80) logEntries.RemoveAt(0);
        }

        public void OpenLog()
        {
            if (logRoot == null || !IsPlaying) return;
            var p = Pal;
            for (int i = logContent.childCount - 1; i >= 0; i--) Destroy(logContent.GetChild(i).gameObject);
            for (int i = logContent.childCount - 1; i >= 0; i--) logContent.GetChild(i).SetParent(null);
            float y = 0f;
            for (int i = 0; i < logEntries.Count; i++)
            {
                var e = logEntries[i];
                bool cur = i == logEntries.Count - 1;
                var rows = WrapChars(e.text, 36);
                float h = 14f + rows.Count * 46f + 14f;
                var row = TNode("Row", logContent);
                row.anchorMin = row.anchorMax = row.pivot = new Vector2(0f, 1f);
                row.anchoredPosition = new Vector2(0f, -y);
                row.sizeDelta = new Vector2(1300f, h);
                if (!e.narration)
                {
                    var nm = TLabel(row, e.name, 0f, 22f, 230f - 26f, 30f, 20, cur ? p.ac : HexC("#d9d5cc"), 700);
                    nm.alignment = TextAnchor.MiddleRight;
                    nm.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.16f;
                    nm.rectTransform.anchoredPosition = new Vector2(-0.16f * 20f, -22f);   // 字間ぶん右へずれるのを戻す
                    if (e.phone)
                    {
                        var st = TPoly("Star", row, p.ac);
                        float sx = 230f - 26f - TWidth(nm, 0.16f) - 8f - 8f;
                        st.Set(FourStar(sx, 37f, 8f), PolyGraphic.Mode.Fill);
                    }
                }
                TFill(row, 230f, 0f, 1f, h, Light(p.ln2));
                if (cur) TDiamond(row, 230.5f, 34.5f, 9f, p.ac, p.acg);
                var tx = TLabel(row, string.Join("\n", rows), 231f + 30f, 14f, 1011f, rows.Count * 46f, 26, e.narration ? p.nar : cur ? HexC("#f6f4ef") : Rgb(241, 239, 233, 0.86f), 600);
                tx.alignment = TextAnchor.UpperLeft;
                tx.lineSpacing = LineSpacingFor(tx, 46f);
                tx.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.06f;
                tx.rectTransform.anchoredPosition += new Vector2(0f, TextTopPad(tx, 46f));
                y += h;
            }
            logContent.sizeDelta = new Vector2(0f, y);
            for (int i = 0; i < logContent.childCount; i++)
            {
                var r = (RectTransform)logContent.GetChild(i);
                r.anchoredPosition = new Vector2(r.anchoredPosition.x, r.anchoredPosition.y + y);
            }
            logRoot.gameObject.SetActive(true);
            logRoot.SetAsLastSibling();
            logScroll.verticalNormalizedPosition = 0f;
            SetTalkUiVisible(false);
        }

        public void CloseLog()
        {
            if (logRoot == null) return;
            logRoot.gameObject.SetActive(false);
            SetTalkUiVisible(true);
        }

        /// <summary>ログを開いている間は、吹き出し・上のタブ・下の帯を隠す（透けて重ならないように）</summary>
        private void SetTalkUiVisible(bool on)
        {
            if (bubbleGroup != null) bubbleGroup.gameObject.SetActive(on);
            if (contextTab != null) contextTab.gameObject.SetActive(on);
            if (bottomBar != null) bottomBar.gameObject.SetActive(on);
            if (tiles != null) tiles.gameObject.SetActive(on);
            if (closeStar != null) closeStar.gameObject.SetActive(on && SupportMode);
        }

        // ── 立ち絵（§3） ──

        private void LoadBounds()
        {
            bounds = new Dictionary<string, Bounds>();
            var t = Resources.Load<TextAsset>("Talk/portrait_bounds");
            if (t == null) return;
            foreach (var b in JsonUtility.FromJson<BoundsFile>(t.text).items ?? Array.Empty<BoundsItem>())
                bounds[b.name] = new Bounds { w = b.w, h = b.h, left = b.left, top = b.top, right = b.right, bottom = b.bottom };
        }

        [Serializable] private class BoundsFile { public BoundsItem[] items; }
        [Serializable] private class BoundsItem { public string name; public float w, h, left, top, right, bottom; }

        /// <summary>舞台の立ち絵を並べ直す（左右の外側・内側の枠。話している人は明るく、6px 上で手前）</summary>
        private void LayoutActors(ScenarioLine line)
        {
            placed.Clear();
            var onStage = new HashSet<string>(stage.left.Concat(stage.right));
            foreach (var gone in actors.Keys.Where(k => !onStage.Contains(k)).ToList())
            {
                if (actors[gone] != null) Remove(actors[gone].gameObject);
                actors.Remove(gone);
            }
            // 左右に1人ずつ（立ち絵のある人）のときは、支援会話の「2人用の位置」に立つ（外側の位置だと遠すぎる。原作者 2026-11-13 案A）
            // 1人だけのときも同じ2人用の位置（原作者 2026-11-14「1人の時もなるべく二人会話の時と同じ位置に」）
            int nl = stage.left.Count(HasDrawn), nr = stage.right.Count(HasDrawn);
            pairStage = !SupportMode && nl <= 1 && nr <= 1 && nl + nr >= 1;
            PlaceSide(stage.left, false, line);
            PlaceSide(stage.right, true, line);
        }

        private bool pairStage;
        private bool HasDrawn(string who) => FindPortrait(who, null).texture != null;

        private void PlaceSide(List<string> cast, bool right, ScenarioLine line)
        {
            // 絵のある人だけ枠に入れる（先に立った人が外側）。支援会話は外側の1人だけ
            var drawn = cast.Where(w => FindPortrait(w, null).texture != null).ToList();
            foreach (var hidden in cast.Except(drawn)) if (actors.TryGetValue(hidden, out var img) && img != null) { Remove(img.gameObject); actors.Remove(hidden); }
            for (int i = 0; i < drawn.Count; i++)
            {
                var who = drawn[i];
                bool visible = !SupportMode || i == 0;
                string expression = who == stage.Speaker ? line.expression : null;
                var portrait = FindPortrait(who, expression);
                if (portrait.texture == null) portrait = FindPortrait(who, null);
                if (!actors.TryGetValue(who, out var image) || image == null)
                {
                    image = NewRect("Actor_" + who, stageRoot).gameObject.AddComponent<RawImage>();
                    // 立ち絵をたたく: 1回目は会話を進め、素早く5回で位置の調整（DialogueView.Adjust）
                    var tap = image.gameObject.AddComponent<Button>();
                    tap.transition = Selectable.Transition.None;
                    string tapped = who;
                    tap.onClick.AddListener(() => OnPortraitTap(tapped));
                    AttachPortraitDrag(image.gameObject, tapped);   // 調整パネルが出ているときは、ドラッグで動かす
                    actors[who] = image;
                }
                image.gameObject.SetActive(visible);
                bool fresh = image.texture == null;
                image.texture = portrait.texture;
                var slot = SupportMode || pairStage ? (right ? SupR1 : SupL1) : right ? (i == 0 ? SR1 : SR2) : (i == 0 ? SL1 : SL2);
                var fig = Figures.TryGetValue(who, out var f) ? f : new Figure { height = 1060f, headX = -1f, faceY = 120f };
                // 透明でない所（絵の名前で探す。無ければ絵全体）
                var b = bounds.TryGetValue(portrait.texture.name, out var bb) ? bb : new Bounds { w = portrait.texture.width, h = portrait.texture.height, left = 0, top = 0, right = portrait.texture.width, bottom = portrait.texture.height };
                float bw = b.right - b.left, bh = b.bottom - b.top;
                var adj = PreviewOf(who) ?? AdjustOf(who, expression);   // 調整中は保存前の値（DialogueView.Adjust）
                float zoom = adj != null ? Mathf.Clamp(adj.zoom, 0.5f, 2.5f) : 1f;
                float H = fig.height * zoom, W = H * bw / Mathf.Max(1f, bh);
                float natHead = fig.headX >= 0f ? fig.headX * zoom : W * 0.5f;
                float headOnScreen = right ? W - natHead : natHead;
                float left = slot.headX - headOnScreen + (adj != null ? adj.dx * W : 0f);
                // 上下: 分類のある人は顔の高さ（目の線）で決める。ない人は枠の足元の線から（前と同じ）
                float baseTop = BuildOf.TryGetValue(who, out var build) ? FaceLine[build] - fig.faceY * zoom : slot.baseline - H;
                float top = baseTop - (adj != null ? adj.dy * H : 0f);
                // 頭の位置は調整（左右）のあとの位置。吹き出しはこれについて動く（原作者 2026-11-14「立ち絵の位置調整したらテキストボックスも追従して」）
                placed[who] = new Placed { left = left, top = top, width = W, height = H, headX = left + headOnScreen, right = right };
                bool speaking = who == stage.Speaker;
                var rt = image.rectTransform;
                rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
                rt.pivot = new Vector2(0.5f, 0.5f);
                rt.sizeDelta = new Vector2(W, H);
                image.uvRect = new Rect(b.left / b.w, 1f - b.bottom / b.h, bw / b.w, bh / b.h);
                // 右の人は左右を反転（立ち絵は全員右向きで描く決まり）
                rt.localScale = new Vector3(right ? -1f : 1f, 1f, 1f);
                var target = new Vector2(left + W / 2f, -(top + H / 2f) + (speaking ? 6f : 0f));
                actorTarget[who] = target;
                if (fresh || !Application.isPlaying) rt.anchoredPosition = target;
                // 話していない人: 明るさ 0.72（透かさず、絵の形の中だけ暗く）
                var color = speaking ? Color.white : new Color(0.72f, 0.72f, 0.72f, 1f);
                actorColor[who] = color;
                if (fresh || !Application.isPlaying) image.color = color;
                if (speaking) rt.SetAsLastSibling(); else rt.SetAsFirstSibling();
            }
        }

        // ── 吹き出し（§4・§5） ──

        private void LayoutTalk(ScenarioLine line, string name)
        {
            var p = Pal;
            bool narration = line.type == "narration", phone = line.type == "phone";
            bool talk = line.type == "line" && !string.IsNullOrEmpty(line.speaker) && placed.ContainsKey(line.speaker);
            bool voice = line.type == "line" && !talk;
            // ページ（1ページ2行まで。字は小さくしない）
            var rows = WrapChars(line.text ?? "", MaxChars);
            var list = new List<string>();
            for (int i = 0; i < rows.Count; i += 2) list.Add(string.Join("\n", rows.GetRange(i, Mathf.Min(2, rows.Count - i))));
            pages = list.Count > 0 ? list.ToArray() : new[] { "" };
            page = 0;
            int maxLen = rows.Count > 0 ? rows.Max(r => r.Length) : 0;
            int lineCount = Mathf.Min(2, Mathf.Max(1, rows.Count));
            float txW = Mathf.Round(maxLen * CW) + 10f;
            float w = Mathf.Max(540f, txW + 100f);
            float h = 30f + lineCount * LH + 34f;

            float x0, x1, y0, y1;
            int side = talk ? (placed[line.speaker].right ? 1 : -1) : voice ? 1 : 0;
            float headX = talk ? placed[line.speaker].headX : 844f;
            if (talk && side < 0) { x0 = Mathf.Max(40f, headX - 70f); x1 = x0 + w; }
            else if (talk) { x1 = Mathf.Min(1648f, headX + 70f); x0 = x1 - w; }
            else { float c0 = 844f + (voice ? 60f : 0f); x0 = Mathf.Round(c0 - w / 2f); x1 = Mathf.Round(c0 + w / 2f); }
            float refTop = talk ? placed[line.speaker].top : SupportMode ? TopMinSupport : TopMinNormal;
            y1 = Mathf.Min(292f, refTop - 8f); y0 = Mathf.Max(98f, y1 - h); y1 = y0 + h;
            bool face = talk && SupportMode;
            if (face)
            {
                if (side > 0) { x1 = Mathf.Max(w + 40f, headX - 115f); x0 = x1 - w; }
                else { x0 = Mathf.Min(1648f - w, headX + 115f); x1 = x0 + w; }
                y1 = Mathf.Max(98f + h, Mathf.Round(placed[line.speaker].top + 70f)); y0 = y1 - h;
            }
            float cx = Mathf.Round((x0 + x1) / 2f);
            bx0 = x0; by0 = y0; bx1 = x1; by1 = y1;

            // 形（角を14px切る。尾つき）
            var shape = new List<Vector2> { TP(x0 + 14f, y0), TP(x1 - 14f, y0), TP(x1, y0 + 14f) };
            if (voice) { float my = y0 + h / 2f; shape.Add(TP(x1, my - 12f)); shape.Add(TP(x1 + 46f, my - 22f)); shape.Add(TP(x1, my + 12f)); }
            shape.Add(TP(x1, y1 - 14f)); shape.Add(TP(x1 - 14f, y1));
            if (talk)
            {
                float bx; int dir;
                if (face) { bx = side > 0 ? x1 - 64f : x0 + 64f; dir = side > 0 ? 1 : -1; }
                else { dir = side < 0 ? -1 : 1; bx = Mathf.Max(x0 + 70f, Mathf.Min(x1 - 70f, headX + (side < 0 ? 20f : -20f))); }
                float tx = face ? bx + dir * 36f : bx + dir * 34f, ty = face ? y1 + 38f : y1 + 40f;
                if (dir < 0) { shape.Add(TP(bx + 18f, y1)); shape.Add(TP(tx, ty)); shape.Add(TP(bx - 6f, y1)); }
                else { shape.Add(TP(bx + 6f, y1)); shape.Add(TP(tx, ty)); shape.Add(TP(bx - 18f, y1)); }
            }
            shape.Add(TP(x0 + 14f, y1)); shape.Add(TP(x0, y1 - 14f)); shape.Add(TP(x0, y0 + 14f));
            bubbleFill.color = Dark(p.pl, 0.92f * 0.86f);
            bubbleFill.Set(shape, PolyGraphic.Mode.Fill);
            bubbleLine.color = Light(p.ln);
            bubbleLine.Set(shape, PolyGraphic.Mode.Stroke, true, 1f);
            bubbleInner.color = Light(p.ln2);
            bubbleInner.Set(Chamfer(x0 + 6f, y0 + 6f, x1 - 6f, y1 - 6f, 10f), PolyGraphic.Mode.Stroke, true, 1f);
            // ドット柄（ナレーションは無し・携帯端末は濃く）
            float dotsOp = phone ? 0.55f : narration ? 0f : 0.3f;
            dots.gameObject.SetActive(dotsOp > 0f);
            if (dotsOp > 0f)
            {
                dots.texture = DotsTexture(x0, y0, x1, y1, dotsOp);
                TPlace(dots.rectTransform, x0, y0, x1 - x0, y1 - y0);
            }
            diaTL.anchoredPosition = new Vector2(x0 + 13.5f, -(y0 - 0.5f));
            diaBR.anchoredPosition = new Vector2(x1 - 13.5f, -(y1 - 0.5f));

            // 本文
            bodyText.color = narration ? p.nar : p.tx;
            bodyText.alignment = narration ? TextAnchor.UpperCenter : TextAnchor.UpperLeft;
            float txX = narration ? x0 + 30f : cx - txW / 2f, txY = y0 + (narration ? 30f : 34f), boxW = narration ? w - 60f : txW + 40f;
            TPlace(bodyText.rectTransform, txX, txY - TextTopPad(bodyText, LH), boxW, lineCount * LH + 20f);
            // 中央寄せ＋字間: 字間で右へずれる分（(n−1)×字間の半分）と、CSS が最後の字間も幅に入れる分（字間の半分）を戻す
            if (narration) bodyText.rectTransform.anchoredPosition += new Vector2(-maxLen * 0.06f * 30f / 2f, 0f);

            // 名前札（ナレーションは無し）
            tabRoot.gameObject.SetActive(!narration);
            if (!narration)
            {
                float tabW = 52f + name.Length * 26f + (phone ? 26f : 0f), tabH = 46f;
                float tabX = side > 0 ? x1 - 34f - tabW : side < 0 ? x0 + 34f : cx - tabW / 2f;
                tabRoot.anchoredPosition = new Vector2(tabX, -(y0 - 30f));
                tabFill.color = Dark(p.pl, 0.92f);
                tabFill.Set(new[] { TP(12f, 0f), TP(tabW, 0f), TP(tabW - 12f, tabH), TP(0f, tabH) }, PolyGraphic.Mode.Fill);
                tabLines.color = tabBottom.color = Light(p.ln);
                tabLines.Set(new[] { TP(12f, 0.5f), TP(tabW, 0.5f) }, PolyGraphic.Mode.Stroke, false, 1f);
                tabBottom.Set(new[] { TP(0f, tabH - 0.5f), TP(tabW - 12f, tabH - 0.5f) }, PolyGraphic.Mode.Stroke, false, 1f);
                nameLabel.text = name;
                float nameW = TWidth(nameLabel, 0.14f), starW = phone ? 16f + 10f : 0f;
                float startX = (tabW - (starW + nameW)) / 2f;
                phoneStar.gameObject.SetActive(phone);
                phoneStar.anchoredPosition = new Vector2(startX, -(tabH / 2f - 8f));
                TPlace(nameLabel.rectTransform, startX + starW, 0f, 400f, tabH);
                bool newSpeaker = lastName != name;
                lastName = name;
                if (newSpeaker && Application.isPlaying) tabShownAt = Time.unscaledTime;
            }

            // 「次へ」の印（右端 x1−30、上 y1−32）
            nextRoot.anchoredPosition = new Vector2(x1 - 30f, -(y1 - 32f));
            typingRoot.anchoredPosition = new Vector2(x1 - 30f, -(y1 - 32f));
            // 菱形3つ（9px・間10・右の余白4）の中心は右端から 8.5・27.5・46.5。ページの「1 / 2」はその左に間12
            for (int i = 0; i < 3; i++) nextDias[i].rt.anchoredPosition = new Vector2(-8.5f - (2 - i) * 19f, -10f);
            lineShownAt = Application.isPlaying ? Time.unscaledTime : -10f;
            doneAt = -1f;
        }

        private PolyGraphic tabBottom;
        private string lastName;
        private float tabShownAt = -10f;

        private void ShowPage()
        {
            pageAt = Time.unscaledTime;
            BeginReveal(pages[page]);
            pageLabel.text = pages.Length > 1 ? $"{page + 1} / {pages.Length}" : "";
            // 右寄せ＋字間: 見える右の端を（菱形の左 −51 − 間12 − 最後の字間）に
            var pr = pageLabel.rectTransform;
            pr.anchorMin = pr.anchorMax = pr.pivot = new Vector2(0f, 1f);
            pr.sizeDelta = new Vector2(120f, 20f);
            pr.anchoredPosition = new Vector2(-63f - 120f - pageLabel.text.Length * 0.2f * 14f, 0f);
            doneAt = -1f;
        }

        private string[] pages = Array.Empty<string>();
        private int page;
        public int PageCount => pages.Length;
        public int PageIndex => page;

        // ── 毎コマ ──

        private void TickTalk()
        {
            if (root == null || !root.gameObject.activeSelf) return;
            float dt = Time.unscaledDeltaTime;
            talkClock += dt;
            bool still = Still || !Application.isPlaying;
            // 台詞が変わったとき: 下から 6px ずらしつつ 0.26秒でフェードイン
            float t = still ? 1f : Mathf.Clamp01((Time.unscaledTime - lineShownAt) / 0.26f);
            float e = 1f - Mathf.Pow(1f - t, 3f);
            bubbleFade.alpha = Mathf.Lerp(0.3f, 1f, e);
            bubbleGroup.anchoredPosition = new Vector2(0f, -6f * (1f - e));
            float tt = still ? 1f : Mathf.Clamp01((Time.unscaledTime - tabShownAt) / 0.24f);
            tabFade.alpha = tt;
            // 「次へ」: 文字を出している間は丸点が順に明滅、出し終えたら菱形へ
            bool revealing = Revealing;
            if (!revealing && doneAt < 0f) doneAt = Time.unscaledTime;
            if (revealing) doneAt = -1f;
            typingRoot.gameObject.SetActive(revealing);
            nextRoot.gameObject.SetActive(!revealing);
            for (int i = 0; i < typingDots.Count; i++)
            {
                float a = still ? 0.6f : 0.35f + 0.55f * (0.5f - 0.5f * Mathf.Cos((talkClock - i * 0.2f) / 1.4f * Mathf.PI * 2f));
                typingDots[i].color = Rgb(200, 198, 192, 0.55f * a / 0.6f);
            }
            if (!revealing)
            {
                float since = Time.unscaledTime - doneAt;
                Color[] fixedCols = { HexC("#4fa3a8"), HexC("#e2b04a"), HexC("#c9cdd2") };
                for (int i = 0; i < nextDias.Count; i++)
                {
                    var (rt, fill, line) = nextDias[i];
                    // 丸点（5px・灰色）から菱形（9px）へ（0.12秒ずつずらして 0.55秒）
                    float m = still ? 1f : Mathf.Clamp01((since - i * 0.12f) / 0.55f);
                    float morph = Mathf.Clamp01((m - 0.55f) / 0.45f);
                    var col = still ? fixedCols[i] : SupportSelectView.Motion.MoreColor(i, talkClock);
                    var gray = HexC("#8d8a84");
                    var c = Color.Lerp(gray, col, morph);
                    float size = Mathf.Lerp(5f, 9f, morph) / 1.4142f;
                    rt.sizeDelta = new Vector2(size, size);
                    float hop = still || morph < 1f ? 0f : SupportSelectView.Motion.MoreHop(i, talkClock);
                    rt.anchoredPosition = new Vector2(rt.anchoredPosition.x, -10f + hop);
                    fill.color = new Color(c.r, c.g, c.b, Hub2Textures.SeenLight(morph < 1f ? 1f : (i == 2 ? 0.18f : 0.28f), 0.6f));
                    line.color = c;
                    float hh = size / 2f;
                    line.Set(new[] { new Vector2(-hh, hh), new Vector2(hh, hh), new Vector2(hh, -hh), new Vector2(-hh, -hh) }, PolyGraphic.Mode.Stroke, true, 1f);
                }
            }
            // 支援ランクの今のランク: 2.4秒で光が脈打つ
            foreach (var (dia, glow) in rankNow)
            {
                float k = still ? 0.5f : 0.5f - 0.5f * Mathf.Cos(talkClock / 2.4f * Mathf.PI * 2f);
                glow.color = new Color(glow.color.r, glow.color.g, glow.color.b, 0.35f + 0.45f * k);
            }
            // ログのつまみ
            if (LogOpen && logThumb != null)
            {
                float view = logScroll.viewport.rect.height, total = Mathf.Max(view, logContent.rect.height);
                float frac = view / total, hThumb = Mathf.Max(30f, 640f * frac);
                float pos = 1f - logScroll.verticalNormalizedPosition;
                logThumb.sizeDelta = new Vector2(3f, hThumb);
                logThumb.anchoredPosition = new Vector2(1489f, -(96f + (640f - hThumb) * (1f - pos)));
            }
#if UNITY_EDITOR
            var kb = UnityEngine.InputSystem.Keyboard.current;
            if (kb != null && kb.f8Key.wasPressedThisFrame) { DesignRefIndex = DesignRefIndex + 1 >= DesignRefs.Length ? -1 : DesignRefIndex + 1; ApplyDesignRef(); }
#endif
        }

        // ── 開発用: 見本を半透明で重ねる（エディターだけ。F8 で切り替え） ──
#if UNITY_EDITOR
        public static readonly string[] DesignRefs =
        {
            "talk_03_outer_left_2lines", "talk_01_narration", "talk_02_outer_right", "talk_04_inner_right_page1of2", "talk_05_inner_left_page1of2",
            "talk_06_phone", "talk_07_voice_no_portrait", "talk_08_typing", "talk_09_theme_orcus", "support_01_right_speaker", "support_02_left_speaker", "log_01_open",
        };
        public static int DesignRefIndex = -1;

        public void ApplyDesignRef()
        {
            if (designRef == null) return;
            bool on = DesignRefIndex >= 0 && DesignRefIndex < DesignRefs.Length;
            designRef.gameObject.SetActive(on);
            if (on) designRef.texture = UnityEditor.AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/DesignRefs/Talk/" + DesignRefs[DesignRefIndex] + ".png");
            designRef.transform.SetAsLastSibling();
        }
#endif

        // ── 文字 ──

        private const string NoLineStart = "、。，．！？!?）」』】〕〉》…‥ーぁぃぅぇぉっゃゅょァィゥェォッャュョ～";

        /// <summary>字の数で折り返す（改行はそのまま。行の頭に来てはいけない字は前の行の終わりへぶら下げる）</summary>
        public static List<string> WrapChars(string text, int max)
        {
            var rows = new List<string>();
            foreach (var para in (text ?? "").Split('\n'))
            {
                var row = new System.Text.StringBuilder();
                foreach (char c in para)
                {
                    if (row.Length >= max && NoLineStart.IndexOf(c) < 0) { rows.Add(row.ToString()); row.Clear(); }
                    row.Append(c);
                }
                rows.Add(row.ToString());
            }
            return rows;
        }

        /// <summary>行送りを px でそろえる（Text の lineSpacing は字の高さに対する倍率）</summary>
        private static float LineSpacingFor(Text t, float px)
        {
            var gen = new TextGenerator();
            var s = t.GetGenerationSettings(new Vector2(4000f, 4000f));
            s.scaleFactor = 1f;
            s.lineSpacing = 1f;
            float one = gen.GetPreferredHeight("あ", s), two = gen.GetPreferredHeight("あ\nあ", s);
            float step = two - one;
            return step > 0f ? px / step : 1f;
        }

        /// <summary>CSS の行の箱（line-height px）の中で字はまん中。Unity の1行目の字の上の位置との差（上へずらす量）</summary>
        private static float TextTopPad(Text t, float px)
        {
            var gen = new TextGenerator();
            var s = t.GetGenerationSettings(new Vector2(4000f, 4000f));
            s.scaleFactor = 1f;
            s.lineSpacing = 1f;
            float one = gen.GetPreferredHeight("あ", s);
            return -(px - one) / 2f;
        }

        // ── 小さな道具 ──

        private static Vector2 TP(float x, float y) => new Vector2(x, -y);

        private static List<Vector2> Chamfer(float x0, float y0, float x1, float y1, float c) => new List<Vector2>
        {
            TP(x0 + c, y0), TP(x1 - c, y0), TP(x1, y0 + c), TP(x1, y1 - c), TP(x1 - c, y1), TP(x0 + c, y1), TP(x0, y1 - c), TP(x0, y0 + c),
        };

        private static Vector2[] FourStar(float cx, float cy, float r)
        {
            // 24 の枠の四芒星 M12 1 L14.2 9.8 L23 12 ...（中心 12,12）を r に縮めて
            float k = r / 11f;
            var pts = new[] { (12f, 1f), (14.2f, 9.8f), (23f, 12f), (14.2f, 14.2f), (12f, 23f), (9.8f, 14.2f), (1f, 12f), (9.8f, 9.8f) };
            return pts.Select(q => TP(cx + (q.Item1 - 12f) * k, cy + (q.Item2 - 12f) * k)).ToArray();
        }

        private static RectTransform TNode(string name, Transform parent)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.sizeDelta = Vector2.zero;   // 入れ物は大きさ 0（左上に付けた子の位置が、入れ物の位置そのものになるように）
            return rt;
        }

        private static RectTransform TPlace(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        private static PolyGraphic TPoly(string name, Transform parent, Color color, float w = 0f, float h = 0f)
        {
            var rt = TNode(name, parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = new Vector2(w, h);
            rt.gameObject.AddComponent<CanvasRenderer>();
            var g = rt.gameObject.AddComponent<PolyGraphic>();
            g.color = color;
            g.raycastTarget = false;
            return g;
        }

        private static RawImage TRaw(string name, Transform parent, Texture tex, Color color)
        {
            var ri = TNode(name, parent).gameObject.AddComponent<RawImage>();
            ri.texture = tex;
            ri.color = color;
            ri.raycastTarget = false;
            return ri;
        }

        private static Image TFill(Transform parent, float x, float y, float w, float h, Color color)
        {
            var img = TNode("Fill", parent).gameObject.AddComponent<Image>();
            TPlace(img.rectTransform, x, y, w, h);
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        /// <summary>塗りの菱形（中心 cx, cy。size は回す前の箱の一辺）＋光彩</summary>
        private static RectTransform TDiamond(Transform parent, float cx, float cy, float size, Color color, Color glow)
        {
            var holder = TNode("Diamond", parent);
            holder.anchorMin = holder.anchorMax = new Vector2(0f, 1f);
            holder.pivot = new Vector2(0.5f, 0.5f);
            holder.anchoredPosition = new Vector2(cx, -cy);
            holder.sizeDelta = new Vector2(size, size);
            var g = TRaw("Glow", holder, Hub2Textures.Glow, new Color(glow.r, glow.g, glow.b, glow.a * 0.7f));
            g.rectTransform.sizeDelta = new Vector2(size * 3f, size * 3f);
            var d = TNode("Shape", holder);
            d.sizeDelta = new Vector2(size, size);
            d.localEulerAngles = new Vector3(0f, 0f, 45f);
            var img = d.gameObject.AddComponent<Image>();
            img.color = color;
            img.raycastTarget = false;
            return holder;
        }

        /// <summary>ランクの菱形（10px。塗り or 枠だけ）</summary>
        private static Image TDiamondOutline(Transform parent, float cx, float cy, float size, Color color, bool filled)
        {
            var d = TNode("Rank", parent);
            d.anchorMin = d.anchorMax = new Vector2(0f, 1f);
            d.pivot = new Vector2(0.5f, 0.5f);
            d.anchoredPosition = new Vector2(cx, -cy);
            float s = size / 1.4142f;
            d.sizeDelta = new Vector2(s, s);
            d.localEulerAngles = new Vector3(0f, 0f, 45f);
            var img = d.gameObject.AddComponent<Image>();
            img.color = filled ? color : new Color(0f, 0f, 0f, 0f);
            img.raycastTarget = false;
            var line = TPoly("Line", d, color);
            line.rectTransform.anchorMin = line.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            float h = s / 2f;
            line.Set(new[] { new Vector2(-h, h), new Vector2(h, h), new Vector2(h, -h), new Vector2(-h, -h) }, PolyGraphic.Mode.Stroke, true, 1f);
            return img;
        }

        private Text TLabel(Transform parent, string text, float x, float y, float w, float h, int size, Color color, int weight)
        {
            var t = TNode("Text", parent).gameObject.AddComponent<Text>();
            TPlace(t.rectTransform, x, y, w, h);
            bool en = !string.IsNullOrEmpty(text) && text.All(c => c <= 0x7E);
            bool heavy = weight >= 800 || (weight >= 700 && size >= 19);   // 700 は 19px 以上なら 800、16px 以下なら 600（仕様書 §1）
            t.font = en ? fontEn : heavy ? fontExtra : fontSemi;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        private static float TWidth(Text t, float em) => t.preferredWidth + em * t.fontSize * (t.text ?? "").Length;

        private static void TShadow(Text t, float a)
        {
            var s = t.gameObject.AddComponent<Shadow>();
            s.effectColor = new Color(0f, 0f, 0f, a);
            s.effectDistance = new Vector2(0f, -1f);
        }

        /// <summary>右上の星（Hub2 の CLOSE と同じ。104×124）</summary>
        private RectTransform TStar(string label, RectTransform parent, Action onClick)
        {
            var rt = TNode(label + "Star", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(1f, 1f);
            rt.sizeDelta = new Vector2(104f, 124f);
            rt.anchoredPosition = new Vector2(-2f, 2f);
            rt.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var btn = rt.gameObject.AddComponent<Button>();
            btn.transition = Selectable.Transition.None;
            btn.onClick.AddListener(() => onClick());
            var glow = TRaw("Glow", rt, Hub2Textures.Glow, Rgb(242, 205, 120, 0.22f));
            glow.rectTransform.anchorMin = glow.rectTransform.anchorMax = new Vector2(0f, 1f);
            glow.rectTransform.sizeDelta = new Vector2(72f, 72f);
            glow.rectTransform.anchoredPosition = new Vector2(52f, -52f);
            var star = TRaw("Star", rt, Hub2Textures.Star, Color.white);
            star.rectTransform.anchorMin = star.rectTransform.anchorMax = new Vector2(0f, 1f);
            star.rectTransform.sizeDelta = new Vector2(60f, 60f);
            star.rectTransform.anchoredPosition = new Vector2(52f, -52f);
            var t = TLabel(rt, label, 0f, 85f, 104f, 20f, 12, Rgb(207, 199, 182), 600);
            t.alignment = TextAnchor.MiddleCenter;
            t.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.34f;
            t.rectTransform.anchoredPosition = new Vector2(-label.Length * 0.34f * 12f / 2f + 0.17f * 12f, -85f);
            return rt;
        }

        // ── 絵（コードで作る） ──

        private static Texture2D vignetteTex, bandTex;
        private static readonly Dictionary<string, Texture2D> fadeTex = new Dictionary<string, Texture2D>();
        private Texture2D dotsTex;
        private string dotsKey;

        private static Texture2D VignetteTexture()
        {
            if (vignetteTex != null) return vignetteTex;
            const int W = 256, H = 128;
            vignetteTex = new Texture2D(W, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "TalkVignette" };
            var px = new Color[W * H];
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                float fx = (x + 0.5f) / W * TalkW, fy = (1f - (y + 0.5f) / H) * TalkH;
                float dx = (fx - 0.5f * TalkW) / (0.8f * TalkW), dy = (fy - 0.52f * TalkH) / (0.78f * TalkH);
                float r = Mathf.Sqrt(dx * dx + dy * dy);
                float a = 0.55f * Mathf.Clamp01((r - 0.45f) / 0.55f);
                px[y * W + x] = new Color(0f, 0f, 0f, Hub2Textures.Seen(a));
            }
            vignetteTex.SetPixels(px);
            vignetteTex.Apply();
            return vignetteTex;
        }

        // 下のボタン帯（下 0.74 → 上 0.52）
        private static Texture2D VerticalBand()
        {
            if (bandTex != null) return bandTex;
            const int H = 32;
            bandTex = new Texture2D(1, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "TalkBand" };
            for (int y = 0; y < H; y++) bandTex.SetPixel(0, y, new Color(4f / 255f, 4f / 255f, 7f / 255f, Hub2Textures.Seen(Mathf.Lerp(0.74f, 0.52f, y / (H - 1f)))));
            bandTex.Apply();
            return bandTex;
        }

        // ログの上の端のフェード（上が下地の色、下へ透明）
        private static Texture2D VerticalFadeDown(Color c)
        {
            string key = ColorUtility.ToHtmlStringRGB(c);
            if (fadeTex.TryGetValue(key, out var t) && t != null) return t;
            const int H = 32;
            t = new Texture2D(1, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "TalkLogFade" };
            for (int y = 0; y < H; y++) t.SetPixel(0, y, new Color(c.r, c.g, c.b, Hub2Textures.Seen(0.97f) * (y / (H - 1f))));
            t.Apply();
            fadeTex[key] = t;
            return t;
        }

        /// <summary>吹き出しのドット柄（16px の格子・半径 1.1px。左 → 右へ濃く。格子は画面にそろえる）</summary>
        private Texture2D DotsTexture(float x0, float y0, float x1, float y1, float op)
        {
            int w = Mathf.CeilToInt(x1 - x0), h = Mathf.CeilToInt(y1 - y0);
            string key = $"{x0 % 16f}_{y0 % 16f}_{w}_{h}_{op}";
            if (dotsKey == key && dotsTex != null) return dotsTex;
            if (dotsTex != null) Destroy(dotsTex);
            dotsTex = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "TalkDots" };
            var px = new Color32[w * h];
            for (int y = 0; y < h; y++)
            {
                float gy = y0 + (h - 1 - y) + 0.5f;
                float cy = Mathf.Repeat(gy, 16f) - 8f;
                if (Mathf.Abs(cy) > 1.7f) continue;
                for (int x = 0; x < w; x++)
                {
                    float gx = x0 + x + 0.5f;
                    float cxp = Mathf.Repeat(gx, 16f) - 8f;
                    if (Mathf.Abs(cxp) > 1.7f) continue;
                    float d = Mathf.Sqrt(cxp * cxp + cy * cy);
                    float cov = d <= 1.1f ? 1f : Mathf.Clamp01((1.6f - d) / 0.5f);
                    float u = x / (float)w;
                    float mask = u < 0.45f ? Mathf.Lerp(0f, 0.149f, u / 0.45f) : Mathf.Lerp(0.149f, 1f, (u - 0.45f) / 0.55f);
                    float a = Hub2Textures.SeenLight(0.5f * op * mask * cov, 0.92f);
                    px[y * w + x] = new Color32(241, 234, 217, (byte)Mathf.RoundToInt(a * 255f));
                }
            }
            dotsTex.SetPixels32(px);
            dotsTex.Apply();
            dotsKey = key;
            return dotsTex;
        }
    }
}
