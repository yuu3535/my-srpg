using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>章ごとの文（Resources/Title/chapters.json）。タイトル画面の運命予報（ローマ字）と、拠点メニューの運命予報（日本語）</summary>
    public static class TitleChapters
    {
        [Serializable] public class Chapter { public string name, en, fortuneJa, fortuneRomaji; }
        [Serializable] private class File { public Chapter[] chapters; }
        private static List<Chapter> all;

        public static Chapter Of(string name)
        {
            if (all == null)
            {
                var t = Resources.Load<TextAsset>("Title/chapters");
                all = new List<Chapter>(t != null ? JsonUtility.FromJson<File>(t.text)?.chapters ?? Array.Empty<Chapter>() : Array.Empty<Chapter>());
            }
            foreach (var c in all) if (c.name == name) return c;
            return all.Count > 0 ? all[0] : new Chapter { name = name, en = "PROLOGUE", fortuneJa = "", fortuneRomaji = "" };
        }
    }

    /// <summary>
    /// タイトル画面（2026-11-13 総合担当。正本 docs/10-design/ui/title/title_spec.md・TitleC3.dc.html。基準 1688×780）。
    /// 3つの状態（クリア前・宵空／サタン撃破後・朝焼け／終幕後・褪せた朝焼けと黒い題名）。配置は同じで、空・色・文だけが変わる。
    /// 起動するとタップ待ち → メニュー（続きから・はじめから・保管庫・設定）。続きから・はじめからは演出のあとで場面へ。
    /// 星のまわりの輪と運命予報は謎文字（Neko_no_Mezame）
    /// </summary>
    public class TitleScreen : MonoBehaviour
    {
        // ── 外から ──

        /// <summary>選んだ物をするところ（StartMenu がつなぐ）</summary>
        public struct Actions
        {
            public Action<int> newGame;     // 枠を決めた: その枠に新しいデータ → プロローグ
            public Action<int> continueAt;  // 続きから: その枠を読む
            public Action battleTest, supportTest;
        }

        public static TitleScreen Instance { get; private set; }

        /// <summary>開発中だけ: 3つの状態を見るために、状態を決めて表示する（−1 ならセーブから決める）</summary>
        public static int StageOverride = -1;
        public static bool ShowDev = true;

        public static TitleScreen Open(Actions actions)
        {
            if (Instance != null) Destroy(Instance.gameObject);
            var go = new GameObject("TitleScreen");
            Instance = go.AddComponent<TitleScreen>();
            Instance.actions = actions;
            Instance.Build();
            return Instance;
        }

        public enum Phase { Tap, Menu, Effect, Slots }
        public Phase Current { get; private set; }
        public int Stage { get; private set; }
        public int Selected => selected;
        public bool HasSave => latestSlot > 0;
        public int LatestSlot => latestSlot;

        // ── 色（仕様書 §2） ──
        private static Color C(int r, int g, int b, float a = 1f) => new Color(r / 255f, g / 255f, b / 255f, a);
        private static Color H(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }

        private struct Look
        {
            public Color core, star, glowNear, glowFar, flare, accent, title, fortune, menu, menuOn, menuLock, info, tap, tapSub, shadeTop, shadeBot, horizon;
            public float bandLow, bandTop, shineOp;
            public bool shadows, titleShadow, vignette;
            public string sky, ring, fcLabel, fcText;
        }

        private Look LookOf(int stage, TitleChapters.Chapter ch)
        {
            var menu = C(236, 232, 224, 0.82f); var menuOn = H("#fffaf0"); var menuLock = C(200, 196, 210, 0.45f); var info = C(236, 232, 224, 0.8f);
            switch (stage)
            {
                case GameProgress.AfterSatan:
                    return new Look
                    {
                        core = Color.white, star = H("#ffd98a"), glowNear = C(255, 214, 130, 0.9f), glowFar = C(255, 190, 90, 0.35f), flare = C(255, 226, 160, 0.95f),
                        accent = H("#f3cd78"), title = H("#fff6dc"), fortune = H("#fff3d6"), menu = menu, menuOn = menuOn, menuLock = menuLock, info = info,
                        tap = H("#fffaf0"), tapSub = C(240, 236, 228, 0.8f), shadeTop = C(20, 30, 70, 0.25f), shadeBot = C(40, 20, 10, 0.55f), horizon = C(255, 214, 150, 0.55f),
                        bandLow = 0.5f, bandTop = 0.3f, shineOp = 1f, shadows = true, titleShadow = true, vignette = false,
                        sky = "Title/sky_dawn", ring = "THIS WORLD IS DEDICATED TO YOU  ·  ", fcLabel = "NEW DAWN", fcText = "soshite, atarashii yoake e",
                    };
                case GameProgress.AfterEnding:
                    return new Look
                    {
                        core = H("#0a0204"), star = H("#b3263c"), glowNear = C(170, 22, 44, 0.8f), glowFar = C(120, 10, 30, 0.4f), flare = C(196, 52, 72, 0.9f),
                        accent = H("#cc2e41"), title = H("#050305"), fortune = H("#8e1222"), menu = C(6, 3, 6, 0.74f), menuOn = H("#000000"), menuLock = C(6, 3, 6, 0.32f), info = C(6, 3, 6, 0.82f),
                        tap = H("#050305"), tapSub = H("#050305"), shadeTop = C(10, 10, 12, 0.42f), shadeBot = C(8, 6, 8, 0.35f), horizon = C(255, 255, 255, 0.4f),
                        bandLow = 0f, bandTop = 0f, shineOp = 0.14f, shadows = false, titleShadow = false, vignette = true,
                        sky = "Title/sky_dawn_faded", ring = "IF I CAN BRING YOU BACK, I WILL DO IT  ·  ", fcLabel = "AFTER THE FABLE", fcText = "hebi wa mada, waratte iru",
                    };
                default:
                    return new Look
                    {
                        core = Color.white, star = H("#cfe0ff"), glowNear = C(190, 210, 255, 0.85f), glowFar = C(140, 170, 255, 0.3f), flare = C(214, 228, 255, 0.95f),
                        accent = H("#c9d8f6"), title = H("#f4f6fb"), fortune = C(220, 226, 244, 0.85f), menu = menu, menuOn = menuOn, menuLock = menuLock, info = info,
                        tap = H("#fffaf0"), tapSub = C(240, 236, 228, 0.8f), shadeTop = C(4, 6, 18, 0.55f), shadeBot = C(4, 5, 14, 0.82f), horizon = C(255, 200, 140, 0.32f),
                        bandLow = 0.22f, bandTop = 0f, shineOp = 1f, shadows = true, titleShadow = true, vignette = false,
                        sky = "Title/sky_dusk", ring = "ONLY I WAS THE CREATOR OF THIS WORLD  ·  ", fcLabel = "FATE FORECAST  ―  " + (ch?.en ?? "PROLOGUE"), fcText = ch?.fortuneRomaji ?? "",
                    };
            }
        }

        // ── 状態 ──
        private Actions actions;
        private Look look;
        private int selected, latestSlot;
        private SaveData latest;
        private float clock, phaseTime;
        private Font fontSemi, fontExtra, fontEn, fontNeko;
        private Canvas canvas;
        private RectTransform root, content, main, skyPan, star, halo, ring, flareH1, flareH2, flareV, core, horizon, tapArea, menuRoot, info, fxRoot, slotRoot, shineBand;
        private CanvasGroup mainGroup, tapGroup, menuGroup, infoGroup, fxGroup;
        private RawImage sky, skyFx, horizonImg, sun, devStageLabel;
        private Text infoText;
        private readonly List<(RectTransform rt, CanvasGroup g, float delay)> fadeUps = new List<(RectTransform, CanvasGroup, float)>();
        private readonly List<MenuItem> items = new List<MenuItem>();
        private string fxKind;
        private float fxStart;
        private bool fxDone;
        private int pendingSlot;
        private RawImage designRef;

        private class MenuItem
        {
            public string id, ja, en;
            public RectTransform rt, underline;
            public Text jaText, enText;
            public bool locked;
            public float u;
        }

        private static bool Still => Hub2Menu.Effect == Hub2Motion.Effect.None;

        // ── 組み立て ──

        private void Build()
        {
            fontSemi = Resources.Load<Font>("Fonts/ShipporiMincho-SemiBold") ?? StartMenu.FontOf();
            fontExtra = Resources.Load<Font>("Fonts/ShipporiMincho-ExtraBold") ?? fontSemi;
            fontEn = Resources.Load<Font>("Fonts/BarlowCondensed-SemiBold") ?? fontSemi;
            fontNeko = Resources.Load<Font>("Fonts/Neko_no_Mezame") ?? fontEn;
            var slots = SaveStore.List();
            latestSlot = TitleSaves.Latest(slots);
            latest = latestSlot > 0 ? slots[latestSlot - 1].data : null;
            Stage = StageOverride >= 0 ? StageOverride : TitleSaves.StageOf(latest);
            look = LookOf(Stage, TitleChapters.Of(TitleSaves.ChapterText(latest)));
            selected = HasSave ? 0 : 1;   // セーブがあれば「続きから」、なければ「はじめから」
            // 薄い字（半透明の明るい字）は、線形の空間で混ぜるとブラウザより明るく見えるので弱める（終幕後の黒い字はそのまま）
            if (look.shadows)
            {
                look.menu = Lit(look.menu); look.menuLock = Lit(look.menuLock); look.info = Lit(look.info); look.fortune = Lit(look.fortune); look.tapSub = Lit(look.tapSub);
            }

            var go = new GameObject("TitleCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            go.transform.SetParent(transform, false);
            canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 500;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1688f, 780f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;   // Hub2 と同じ
            if (EventSystem.current == null) new GameObject("EventSystem", typeof(EventSystem), typeof(UnityEngine.InputSystem.UI.InputSystemUIInputModule));
            root = (RectTransform)go.transform;
            var bg = Node("Bg", root); Stretch(bg);
            bg.gameObject.AddComponent<Image>().color = H("#05060a");

            // 1. 空（2172×724 の絵を 2340×780 に。90秒で x 0 → −652 を往復）。上下の暗さより奥
            var back = Node("Back", root);
            back.anchorMin = back.anchorMax = back.pivot = new Vector2(0.5f, 0.5f);
            back.sizeDelta = new Vector2(1688f, 780f);
            skyPan = Place(Node("SkyPan", back), 0f, 0f, 2340f, 780f);
            sky = Raw("Sky", skyPan, Resources.Load<Texture2D>(look.sky), Stage == GameProgress.BeforeClear ? new Color(0.92f, 0.92f, 0.92f) : Color.white);
            Stretch(sky.rectTransform);
            skyFx = Raw("SkyFx", skyPan, null, new Color(1f, 1f, 1f, 0f));
            Stretch(skyFx.rectTransform);
            // 2. 上下の暗さ（空の上・ほかの全部の下）
            var shade = Raw("Shade", root, ShadeTexture(look.shadeTop, look.shadeBot), Color.white);
            Stretch(shade.rectTransform);
            content = Node("Content", root);
            content.anchorMin = content.anchorMax = content.pivot = new Vector2(0.5f, 0.5f);
            content.sizeDelta = new Vector2(1688f, 780f);
            // 3. 終幕後だけ: 周りの暗さ
            if (look.vignette)
            {
                // vignette_end.png は、取り込むときに Unity の混ぜ方に合わせて不透明度を強めてある（仕様書の素材から作り直すときも同じに）
                var vig = Raw("Vignette", content, Resources.Load<Texture2D>("Title/vignette_end"), Color.white);
                Place(vig.rectTransform, 0f, 0f, 1688f, 780f);
            }
            // 4. 地平線の光・暗い帯
            horizonImg = Raw("Horizon", content, RadialFade(), look.horizon);
            horizon = Place(horizonImg.rectTransform, 144f, 560f, 1400f, 420f);
            horizon.pivot = new Vector2(0.5f, 0.5f); horizon.anchoredPosition = new Vector2(844f, -770f);
            if (look.bandLow > 0f) Place(Raw("BandLow", content, RadialFade(), C(10, 6, 14, Hub2Textures.Seen(look.bandLow))).rectTransform, 194f, 500f, 1300f, 260f);
            if (look.bandTop > 0f) Place(Raw("BandTop", content, RadialFade(), C(10, 8, 20, Hub2Textures.Seen(look.bandTop))).rectTransform, 344f, 210f, 1000f, 260f);

            main = Node("Main", content); Stretch(main);
            mainGroup = main.gameObject.AddComponent<CanvasGroup>();
            BuildStar();
            BuildTitle();
            BuildTap();
            BuildMenu();
            BuildDev();
            fxRoot = Node("Fx", content); Stretch(fxRoot);
            fxGroup = fxRoot.gameObject.AddComponent<CanvasGroup>();
            fxRoot.gameObject.SetActive(false);
#if UNITY_EDITOR
            designRef = Raw("DesignRef", root, null, new Color(1f, 1f, 1f, 0.4f));
            designRef.rectTransform.anchorMin = designRef.rectTransform.anchorMax = designRef.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            designRef.rectTransform.sizeDelta = new Vector2(1688f, 780f);
            ApplyDesignRef();
#endif
            SetPhase(Phase.Tap);
            Select(selected);
            Update();
        }

        // 5. 星（§6。中心 844,136）
        private void BuildStar()
        {
            star = Node("Star", main); Place(star, 0f, 0f, 1688f, 220f);
            flareH1 = Place(Raw("FlareH", star, HLine(), look.flare).rectTransform, 94f, 135f, 1500f, 2f);
            flareH2 = Place(Raw("FlareH2", star, HLineSoft(), look.flare).rectTransform, 444f, 131f - 6f, 800f, 22f);
            flareV = Place(Raw("FlareV", star, VLine(), look.flare).rectTransform, 843f, 20f, 2f, 232f);
            foreach (var r in new[] { flareH1, flareH2 }) { r.pivot = new Vector2(0.5f, 0.5f); r.anchoredPosition += new Vector2(r.sizeDelta.x / 2f, -r.sizeDelta.y / 2f); }
            flareV.pivot = new Vector2(0.5f, 0.5f); flareV.anchoredPosition += new Vector2(1f, -116f);
            foreach (float a in new[] { 45f, -45f })
            {
                var d = Raw("FlareD", star, VLine(), new Color(look.flare.r, look.flare.g, look.flare.b, look.flare.a * 0.6f)).rectTransform;
                d.anchorMin = d.anchorMax = new Vector2(0f, 1f); d.pivot = new Vector2(0.5f, 0.5f);
                d.sizeDelta = new Vector2(2f, 100f); d.anchoredPosition = new Vector2(844f, -136f); d.localEulerAngles = new Vector3(0f, 0f, -a);
            }
            // 菱形の輪（半径70・15°ごとに24個。偶数番は 6×14 の縦長〈不透明度0.6〉、奇数番は 10×10）。120秒で時計回り
            halo = Node("Halo", star); halo.anchorMin = halo.anchorMax = new Vector2(0f, 1f); halo.anchoredPosition = new Vector2(844f, -136f);
            for (int k = 0; k < 24; k++)
            {
                var arm = Node("Arm", halo); arm.localEulerAngles = new Vector3(0f, 0f, -k * 15f);
                bool tall = k % 2 == 0;
                float w = tall ? 6f : 10f, h = tall ? 14f : 10f;
                var dia = Poly("Dia", arm, new Color(look.star.r, look.star.g, look.star.b, tall ? 0.6f : 1f));
                dia.rectTransform.anchorMin = dia.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                dia.Set(new[] { new Vector2(0, 70 + h / 2), new Vector2(w / 2, 70), new Vector2(0, 70 - h / 2), new Vector2(-w / 2, 70) }, PolyGraphic.Mode.Fill);
            }
            // 文字の輪（半径100。輪の文を70字以上になるまでつなぎ、i 番目を i×360/N°に。200秒で反時計回り）
            ring = Node("Ring", star); ring.anchorMin = ring.anchorMax = new Vector2(0f, 1f); ring.anchoredPosition = new Vector2(844f, -136f);
            string text = look.ring;
            while (text.Length < 70) text += look.ring;
            for (int i = 0; i < text.Length; i++)
            {
                if (text[i] == ' ') continue;
                var arm = Node("Ch", ring); arm.localEulerAngles = new Vector3(0f, 0f, -i * 360f / text.Length);
                var t = Label(arm, text[i].ToString(), 0f, 0f, 24f, 24f, 20, new Color(look.star.r, look.star.g, look.star.b, 0.9f), fontNeko);
                t.alignment = TextAnchor.MiddleCenter;
                t.rectTransform.anchorMin = t.rectTransform.anchorMax = t.rectTransform.pivot = new Vector2(0.5f, 0.5f);
                t.rectTransform.anchoredPosition = new Vector2(0f, 100f);
            }
            // 芯（24px。中心〜30% 芯の色 → 60% 星の色 → 72% で透明）と光彩2重
            // box-shadow のぼかしは真ん中に寄る（ガウス）ので、ふちまで広がる丸い光より弱めに
            var far = Raw("GlowFar", star, Hub2Textures.Glow, new Color(look.glowFar.r, look.glowFar.g, look.glowFar.b, look.glowFar.a * 0.55f));
            Centered(far.rectTransform, 844f, 136f, 220f, 220f);
            var near = Raw("GlowNear", star, Hub2Textures.Glow, new Color(look.glowNear.r, look.glowNear.g, look.glowNear.b, look.glowNear.a * 0.8f));
            Centered(near.rectTransform, 844f, 136f, 84f, 84f);
            var c = Raw("Core", star, CoreTexture(look.core, look.star), Color.white);
            core = Centered(c.rectTransform, 844f, 136f, 24f, 24f);
        }

        // 6〜7. 英字題名・題名・運命予報（§7）
        private void BuildTitle()
        {
            // 英字題名の行（上 y256）: 線 80・間16・文字・間16・線 80
            var en = Node("TitleEn", main); Place(en, 0f, 256f, 1688f, 20f);
            AddFade(en, 0.3f);
            var et = Label(en, "THE HUNDRED YEARS WAR", 0f, 0f, 1000f, 20f, 17, look.accent, fontEn);
            float ew = Spaced(et, 0.44f);
            float total = 80f + 16f + ew + 16f + 80f, x0 = 844f - total / 2f;
            Place(Raw("L", en, Hub2Textures.Gradient("title_l", Color.white, new Vector2(0f, 0f), new Vector2(1f, 1f)), look.accent).rectTransform, x0, 10f, 80f, 1f);
            Place(Raw("R", en, Hub2Textures.Gradient("title_r", Color.white, new Vector2(0f, 1f), new Vector2(1f, 0f)), look.accent).rectTransform, x0 + total - 80f, 10f, 80f, 1f);
            CenterSpaced(et, 844f, 0.44f);
            if (look.shadows) Shadow(et, 0.6f, 1f);

            // 題名（132px・800・字間 0.12em。枠は y282〜430）
            var tl = Node("Title", main); Place(tl, 0f, 282f, 1688f, 148f);
            AddFade(tl, 0.5f);
            if (look.titleShadow)
            {
                var glow = Raw("Glow", tl, Hub2Textures.Glow, new Color(look.accent.r, look.accent.g, look.accent.b, Stage == GameProgress.AfterSatan ? 0.4f : 0.35f));
                Centered(glow.rectTransform, 844f, 74f, 900f, 260f);
            }
            var tt = Label(tl, "百年戦争編", 0f, 0f, 1688f, 148f, 132, look.title, fontExtra);
            CenterSpaced(tt, 844f, 0.12f);
            if (look.titleShadow) SoftShadow(tt, 0.55f, 6f, 12f);   // 0 6px 24px rgba(0,0,0,.55)。ずらした硬い影ではなく、ぼかした影
            // 題名の光: 字の形の中だけを白い斜めの帯が通る（7秒周期。55〜85%で通る）
            var mask = Label(tl, "百年戦争編", 0f, 0f, 1688f, 148f, 132, Color.white, fontExtra);
            CenterSpaced(mask, 844f, 0.12f);
            mask.gameObject.AddComponent<Mask>().showMaskGraphic = false;
            var band = Raw("Shine", mask.rectTransform, ShineTexture(), new Color(1f, 1f, 1f, 0.95f * look.shineOp));
            shineBand = band.rectTransform;
            shineBand.anchorMin = shineBand.anchorMax = new Vector2(0f, 0.5f);
            shineBand.pivot = new Vector2(0.5f, 0.5f);
            shineBand.sizeDelta = new Vector2(150f, 260f);
            shineBand.localEulerAngles = new Vector3(0f, 0f, -10f);

            // 運命予報（見出し y458・本文 y479 / y521。謎文字・最大2行）
            var fc = Node("Fortune", main); Place(fc, 0f, 458f, 1688f, 120f);
            AddFade(fc, 1.1f);
            var ft = Label(fc, Collapse(look.fcLabel), 0f, 0f, 1000f, 15f, 12, new Color(look.accent.r, look.accent.g, look.accent.b, look.accent.a * 0.85f), fontEn);
            float fw = Spaced(ft, 0.4f);
            float ftot = 40f + 12f + fw + 12f + 40f, fx0 = 844f - ftot / 2f;
            Place(Raw("L", fc, Hub2Textures.Gradient("title_l", Color.white, new Vector2(0f, 0f), new Vector2(1f, 1f)), look.accent).rectTransform, fx0, 7f, 40f, 1f);
            Place(Raw("R", fc, Hub2Textures.Gradient("title_r", Color.white, new Vector2(0f, 1f), new Vector2(1f, 0f)), look.accent).rectTransform, fx0 + ftot - 40f, 7f, 40f, 1f);
            CenterSpaced(ft, 844f, 0.4f);
            if (look.shadows) Shadow(ft, 0.7f, 1f);
            var lines = (look.fcText ?? "").Split('/');
            int n = 0;
            foreach (var raw in lines)
            {
                var s = Collapse(raw.Trim());
                if (s.Length == 0 || n >= 2) continue;
                var lt = Label(fc, s, 0f, 21f + n * 42f, 1688f, 36f, 28, look.fortune, fontNeko);
                CenterSpaced(lt, 844f, 0.16f);
                if (look.shadows) Shadow(lt, 0.75f, 1f);
                n++;
            }
        }

        // 8. タップ待ち（§8）
        private void BuildTap()
        {
            tapArea = Place(Node("TapArea", main), 0f, 220f, 1688f, 560f);
            tapArea.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var btn = tapArea.gameObject.AddComponent<Button>();
            btn.transition = Selectable.Transition.None;
            btn.onClick.AddListener(() => { if (Current == Phase.Tap) SetPhase(Phase.Menu); });
            tapGroup = tapArea.gameObject.AddComponent<CanvasGroup>();
            var a = Label(tapArea, "TAP TO START", 0f, 380f, 1688f, 22f, 18, look.tap, fontEn);
            CenterSpaced(a, 844f, 0.5f);
            var b = Label(tapArea, "画面をタップ", 0f, 410f, 1688f, 20f, 14, look.tapSub, fontSemi);
            CenterSpaced(b, 844f, 0.3f);
        }

        // 8. メニューと説明の行（§8）
        private static readonly (string id, string ja, string en, float x, float w)[] MenuDefs =
        {
            ("cont", "続きから", "CONTINUE", 506f, 137f), ("new", "はじめから", "NEW GAME", 706f, 167f), ("arc", "保管庫", "ARCHIVE", 936f, 107f), ("cfg", "設定", "CONFIG", 1105f, 76f),
        };

        private void BuildMenu()
        {
            menuRoot = Node("Menu", main); Stretch(menuRoot);
            menuGroup = menuRoot.gameObject.AddComponent<CanvasGroup>();
            for (int i = 0; i < MenuDefs.Length; i++)
            {
                var d = MenuDefs[i];
                if (i > 0)
                {
                    float px = MenuDefs[i - 1].x + MenuDefs[i - 1].w, sx = (px + d.x) / 2f;
                    // 7×7 の正方形を45度回した菱形（外側の四角は 7×1.414 ≒ 9.9）。ふちのなめらかな絵で描く（回した Image は丸い点に見えた。Hub2担当のレビュー 2026-11-13）
                    var sep = Node("Sep", menuRoot); sep.anchorMin = sep.anchorMax = new Vector2(0f, 1f);
                    sep.sizeDelta = new Vector2(9.9f, 9.9f); sep.anchoredPosition = new Vector2(sx, -619f);
                    var si = sep.gameObject.AddComponent<RawImage>(); si.texture = Hub2Textures.Diamond; si.color = new Color(look.accent.r, look.accent.g, look.accent.b, 0.7f); si.raycastTarget = false;
                }
                var it = new MenuItem { id = d.id, ja = d.ja, en = d.en, locked = d.id == "arc" || (d.id == "cont" && !HasSave) };
                it.rt = Place(Node("Item_" + d.id, menuRoot), d.x, 584f, d.w, 70f);
                it.rt.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
                it.jaText = Label(it.rt, d.ja, 0f, 10f, d.w, 34f, 26, look.menu, fontExtra);
                CenterSpaced(it.jaText, d.w / 2f, 0.16f);
                it.enText = Label(it.rt, d.en, 0f, 46f, d.w, 14f, 11, look.menu, fontEn);
                CenterSpaced(it.enText, d.w / 2f, 0.3f);
                if (look.shadows) { Shadow(it.jaText, 0.8f, 1f); Shadow(it.enText, 0.8f, 1f); }
                var ul = Node("Underline", it.rt); ul.anchorMin = ul.anchorMax = new Vector2(0.5f, 0f); ul.pivot = new Vector2(0.5f, 0.5f);
                ul.anchoredPosition = new Vector2(0f, -8f); ul.sizeDelta = new Vector2(0f, 1f);
                ul.gameObject.AddComponent<Image>().raycastTarget = false;
                it.underline = ul;
                int index = i;
                var btn = it.rt.gameObject.AddComponent<Button>();
                btn.transition = Selectable.Transition.None;
                btn.onClick.AddListener(() => { Select(index); Run(index); });
                var trig = it.rt.gameObject.AddComponent<EventTrigger>();
                var e = new EventTrigger.Entry { eventID = EventTriggerType.PointerEnter };
                e.callback.AddListener(_ => Select(index));
                trig.triggers.Add(e);
                items.Add(it);
            }
            var infoRt = Place(Node("Info", main), 0f, 688f, 1688f, 20f);
            info = infoRt;
            infoGroup = infoRt.gameObject.AddComponent<CanvasGroup>();
            infoText = Label(infoRt, "", 0f, 0f, 1688f, 20f, 14, look.info, fontSemi);
            infoText.alignment = TextAnchor.MiddleCenter;
            infoText.gameObject.AddComponent<LetterSpacing>().em = 0.12f;
            if (look.shadows) Shadow(infoText, 0.9f, 1f);
        }

        // 9. 開発中だけ: 戦闘テスト・支援会話テスト・状態の切り替え／バージョン表記
        private void BuildDev()
        {
            var ver = Label(root, "VER 0.1 — DEVELOPMENT BUILD", 0f, 0f, 400f, 16f, 12, C(185, 177, 161, 0.7f), fontEn);
            ver.alignment = TextAnchor.MiddleRight;
            ver.gameObject.AddComponent<LetterSpacing>().em = 0.24f;
            var vr = ver.rectTransform; vr.anchorMin = vr.anchorMax = vr.pivot = new Vector2(1f, 0f);
            vr.anchoredPosition = new Vector2(-24f - 0.24f * 12f * ver.text.Length, 16f);
            if (!ShowDev) return;
            var bar = Node("Dev", root); bar.anchorMin = bar.anchorMax = bar.pivot = new Vector2(0f, 0f);
            bar.anchoredPosition = new Vector2(40f, 780f - 726f - 30f);
            float x = 0f;
            x = DevButton(bar, x, "戦闘テスト", () => actions.battleTest?.Invoke()) + 10f;
            if (StartMenu.ShowSupportTest) x = DevButton(bar, x, "支援会話テスト", () => actions.supportTest?.Invoke()) + 10f;
            string[] names = { "クリア前", "サタン撃破後", "終幕後" };
            DevButton(bar, x, "表示：" + names[Mathf.Clamp(Stage, 0, 2)], () =>
            {
                StageOverride = (Stage + 1) % 3;
                var a = actions; Open(a);
            });
        }

        private float DevButton(RectTransform parent, float x, string label, Action onClick)
        {
            var rt = Node("DevButton", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 0f);
            var dev = Label(rt, "DEV", 12f, 0f, 40f, 30f, 11, H("#8f887b"), fontEn);
            dev.alignment = TextAnchor.MiddleLeft;
            dev.gameObject.AddComponent<LetterSpacing>().em = 0.2f;
            float dw = Width(dev, 0.2f);
            var t = Label(rt, label, 12f + dw + 8f, 0f, 300f, 30f, 12, H("#8f887b"), fontSemi);
            t.alignment = TextAnchor.MiddleLeft;
            t.gameObject.AddComponent<LetterSpacing>().em = 0.1f;
            float w = 12f + dw + 8f + Width(t, 0.1f) + 12f;
            dev.rectTransform.anchoredPosition = new Vector2(12f, 0f); dev.rectTransform.anchorMin = dev.rectTransform.anchorMax = dev.rectTransform.pivot = new Vector2(0f, 0f);
            t.rectTransform.anchoredPosition = new Vector2(12f + dw + 8f, 0f); t.rectTransform.anchorMin = t.rectTransform.anchorMax = t.rectTransform.pivot = new Vector2(0f, 0f);
            rt.anchoredPosition = new Vector2(x, 0f);
            rt.sizeDelta = new Vector2(w, 30f);
            var bg = rt.gameObject.AddComponent<Image>(); bg.color = C(10, 9, 14, Hub2Textures.Seen(0.5f));
            var ol = rt.gameObject.AddComponent<Outline>(); ol.effectColor = C(201, 205, 210, 0.35f); ol.effectDistance = new Vector2(1f, -1f);
            var btn = rt.gameObject.AddComponent<Button>(); btn.targetGraphic = bg;
            btn.onClick.AddListener(() => onClick());
            return x + w;
        }

        // ── 操作 ──

        public void SetPhase(Phase p)
        {
            Current = p;
            phaseTime = 0f;
            tapArea.gameObject.SetActive(p == Phase.Tap);
            menuRoot.gameObject.SetActive(p == Phase.Menu || p == Phase.Effect);
            info.gameObject.SetActive(p == Phase.Menu || p == Phase.Effect);
            foreach (var it in items) it.rt.GetComponent<Button>().interactable = p == Phase.Menu;
        }

        public void Select(int i)
        {
            if (i < 0 || i >= items.Count) return;
            selected = i;
            string id = items[i].id;
            infoText.text = id switch
            {
                "cont" => TitleSaves.InfoLine(latest),
                "new" => "プロローグから。アルシェが自室で目を覚ますところから始まります。",
                "arc" => "見た支援会話などを見返せます。（あとで開放）",
                _ => "音量・文字の速さ・画面の設定など。",
            };
            // 字間ぶんを戻して中央に（CSS の text-indent と同じ見え方）
            infoText.rectTransform.anchoredPosition = new Vector2(-(infoText.text.Length - 1) * 0.12f * 14f / 2f, 0f);
        }

        /// <summary>項目を押した（§8「押したとき」）</summary>
        public void Run(int i)
        {
            if (Current != Phase.Menu || i < 0 || i >= items.Count) return;
            var it = items[i];
            if (it.locked) return;
            switch (it.id)
            {
                case "cont": StartEffect("cont", latestSlot); break;
                case "new":
                    int slot = TitleSaves.FirstEmpty(SaveStore.List());
                    if (slot > 0) StartEffect("new", slot);   // 空きがあれば確認なしでそこへ
                    else OpenSlots();                        // 空きがなければ上書きする枠を選ぶ
                    break;
                case "cfg": SettingsMenu.Open(); break;
            }
        }

        // ── 演出（§9） ──

        private void StartEffect(string kind, int slot)
        {
            fxKind = kind;
            pendingSlot = slot;
            fxStart = clock;
            fxDone = false;
            SetPhase(Phase.Effect);
            for (int i = fxRoot.childCount - 1; i >= 0; i--) Destroy(fxRoot.GetChild(i).gameObject);
            fxRoot.gameObject.SetActive(true);
            fxRoot.SetAsLastSibling();
            if (kind == "new")
            {
                skyFx.texture = Resources.Load<Texture2D>("Title/sky_dawn");
                skyFx.color = new Color(1f, 1f, 1f, 0f);
                sun = Raw("Sun", fxRoot, SunTexture(), Color.white);
                sun.rectTransform.anchorMin = sun.rectTransform.anchorMax = new Vector2(0f, 1f);
                sun.rectTransform.pivot = new Vector2(0.5f, 0.5f);
                sun.rectTransform.sizeDelta = new Vector2(800f, 800f);
                PvLines(new[] { ("PROLOGUE", 18, H("#fff6dc"), fontEn), ("祝賀会の朝", 44, Color.white, fontExtra) }, 14f);
            }
            else
            {
                skyFx.texture = Resources.Load<Texture2D>("Title/sky_orcus");
                skyFx.color = new Color(0.55f, 0.55f, 0.55f, 0f);
                sun = null;
                string at = (latest?.savedAt ?? "").Replace('-', '/');
                PvLines(new[] { (TitleSaves.ChapterText(latest), 18, H("#dcd2ee"), fontSemi), (latest?.placeName ?? "", 32, H("#f6f2fb"), fontExtra), (at, 14, C(220, 210, 238, 0.75f), fontEn) }, 16f);
            }
        }

        private readonly List<(Text t, float baseX)> pv = new List<(Text, float)>();

        private void PvLines((string text, int size, Color color, Font font)[] rows, float gap)
        {
            pv.Clear();
            float total = 0f;
            var heights = new List<float>();
            foreach (var r in rows) { float hh = r.size * 1.3f; heights.Add(hh); total += hh; }
            total += gap * (rows.Length - 1);
            float y = 390f - total / 2f;
            for (int i = 0; i < rows.Length; i++)
            {
                var t = Label(fxRoot, rows[i].text, 0f, y, 1688f, heights[i], rows[i].size, rows[i].color, rows[i].font);
                t.alignment = TextAnchor.MiddleCenter;
                t.gameObject.AddComponent<LetterSpacing>().em = 0.5f;
                Shadow(t, 0.6f, 2f);
                pv.Add((t, 0f));
                y += heights[i] + gap;
            }
        }

        private void StepEffect()
        {
            float t = clock - fxStart;
            // 1. 題名・メニューなど全部が 1.2秒で上へ 10px 動きながら消える
            float o = Mathf.Clamp01(t / 1.2f);
            mainGroup.alpha = 1f - o;
            main.anchoredPosition = new Vector2(0f, 10f * o);
            // 2. 空が 2.6秒で切り替わる
            var c = skyFx.color; c.a = Mathf.Clamp01(t / 2.6f); skyFx.color = c;
            // 3. 朝日（3秒で 下200・0.6倍・透明 → 元の位置・1.4倍・不透明）
            if (sun != null)
            {
                float k = Mathf.Clamp01(t / 3f), e = 1f - Mathf.Pow(1f - k, 3f);
                sun.rectTransform.anchoredPosition = new Vector2(844f, -(780f + 200f * (1f - e)));
                sun.rectTransform.localScale = Vector3.one * Mathf.Lerp(0.6f, 1.4f, e);
                sun.color = new Color(1f, 1f, 1f, Mathf.Clamp01(k / 0.6f));
            }
            // 4. 2.1秒後から、字間 0.5em → 0.16em に縮みながら現れる（2.2秒の半ばで出きる）
            float p = Mathf.Clamp01((t - 2.1f) / 1.1f), pe = 1f - Mathf.Pow(1f - p, 3f);
            foreach (var (txt, _) in pv)
            {
                float em = Mathf.Lerp(0.5f, 0.16f, pe);
                txt.GetComponent<LetterSpacing>().em = em;
                txt.SetVerticesDirty();
                txt.rectTransform.anchoredPosition = new Vector2(-(txt.text.Length - 1) * em * txt.fontSize / 2f, txt.rectTransform.anchoredPosition.y);
                var col = txt.color; col.a = pe * (txt.color.a > 0f ? 1f : 1f); txt.canvasRenderer.SetAlpha(pe);
            }
            float length = fxKind == "new" ? 5.2f : 3.8f;
            if (t >= length && !fxDone)
            {
                fxDone = true;
                if (fxKind == "new") actions.newGame?.Invoke(pendingSlot);
                else actions.continueAt?.Invoke(pendingSlot);
            }
        }

        // ── 上書きする枠を選ぶ（仮の見た目。拠点メニューに合わせる） ──

        private void OpenSlots()
        {
            SetPhase(Phase.Slots);
            if (slotRoot != null) Destroy(slotRoot.gameObject);
            slotRoot = Node("Slots", root); Stretch(slotRoot);
            slotRoot.gameObject.AddComponent<Image>().color = C(12, 10, 20, Hub2Textures.Seen(0.92f));
            var area = Node("Area", slotRoot); area.anchorMin = area.anchorMax = area.pivot = new Vector2(0.5f, 0.5f); area.sizeDelta = new Vector2(1688f, 780f);
            var head = Label(area, "上書きする枠を選んでください", 150f, 40f, 1000f, 44f, 30, H("#fbf5e7"), fontExtra); head.alignment = TextAnchor.MiddleLeft;
            var sub = Label(area, "空いている枠がありません。選んだ枠のデータは消えて、はじめからになります。", 150f, 88f, 1300f, 22f, 15, C(185, 177, 161), fontSemi); sub.alignment = TextAnchor.MiddleLeft;
            var view = Place(Node("View", area), 150f, 130f, 1390f, 560f);
            view.gameObject.AddComponent<RectMask2D>();
            view.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            var list = Node("List", view); list.anchorMin = list.anchorMax = list.pivot = new Vector2(0f, 1f);
            var slots = SaveStore.List();
            int cols = 3; float cw = 450f, chh = 72f;
            list.sizeDelta = new Vector2(1390f, Mathf.Ceil(slots.Length / (float)cols) * (chh + 12f));
            for (int i = 0; i < slots.Length; i++)
            {
                var s = slots[i];
                var cell = Place(Node("Slot", list), (i % cols) * (cw + 20f), (i / cols) * (chh + 12f), cw, chh);
                var bg = cell.gameObject.AddComponent<Image>(); bg.color = C(16, 14, 24, Hub2Textures.Seen(0.72f));
                var no = Label(cell, $"No.{s.index:00}", 16f, 0f, 80f, chh, 18, H("#e2b04a"), fontEn); no.alignment = TextAnchor.MiddleLeft;
                string body = s.state == SaveStore.SlotState.Ok ? $"{TitleSaves.ChapterText(s.data)}　{s.data.placeName}\n{(s.data.savedAt ?? "").Replace('-', '/')}　{TitleSaves.PlayTime(s.data.playSeconds)}" : s.state == SaveStore.SlotState.Empty ? "（空き）" : "（読めないデータ）";
                var bt = Label(cell, body, 100f, 0f, cw - 110f, chh, 15, H("#f1ead9"), fontSemi); bt.alignment = TextAnchor.MiddleLeft;
                var btn = cell.gameObject.AddComponent<Button>(); btn.targetGraphic = bg;
                int slot = s.index;
                btn.onClick.AddListener(() => ConfirmOverwrite(slot));
            }
            var scroll = view.gameObject.AddComponent<ScrollRect>(); scroll.viewport = view; scroll.content = list; scroll.horizontal = false; scroll.movementType = ScrollRect.MovementType.Clamped; scroll.scrollSensitivity = 40f;
            var back = Place(Node("Back", area), 150f, 706f, 160f, 48f);
            var bb = back.gameObject.AddComponent<Image>(); bb.color = C(16, 14, 24, Hub2Textures.Seen(0.72f));
            var bl = Label(back, "もどる", 0f, 0f, 160f, 48f, 18, H("#f1ead9"), fontSemi); bl.alignment = TextAnchor.MiddleCenter;
            back.gameObject.AddComponent<Button>().onClick.AddListener(CloseSlots);
        }

        private void ConfirmOverwrite(int slot)
        {
            var box = Node("Confirm", slotRoot); Stretch(box);
            box.gameObject.AddComponent<Image>().color = C(0, 0, 0, 0.6f);
            var area = Node("Area", box); area.anchorMin = area.anchorMax = area.pivot = new Vector2(0.5f, 0.5f); area.sizeDelta = new Vector2(1688f, 780f);
            var panel = Place(Node("Panel", area), 444f, 270f, 800f, 240f);
            panel.gameObject.AddComponent<Image>().color = C(12, 10, 20, 0.97f);
            var o = panel.gameObject.AddComponent<Outline>(); o.effectColor = C(201, 205, 210, 0.6f); o.effectDistance = new Vector2(1f, -1f);
            var q = Label(panel, $"No.{slot:00} を上書きして、はじめからにしますか？\n（このデータは消えます）", 0f, 30f, 800f, 90f, 22, H("#fbf5e7"), fontSemi); q.alignment = TextAnchor.MiddleCenter;
            float bx = 400f - 170f;
            foreach (var (label, yes) in new[] { ("上書きする", true), ("やめる", false) })
            {
                var b = Place(Node(label, panel), bx, 150f, 160f, 52f);
                var bg = b.gameObject.AddComponent<Image>(); bg.color = yes ? C(60, 30, 36) : C(30, 28, 40);
                var t = Label(b, label, 0f, 0f, 160f, 52f, 18, H("#f1ead9"), fontSemi); t.alignment = TextAnchor.MiddleCenter;
                b.gameObject.AddComponent<Button>().onClick.AddListener(() =>
                {
                    Destroy(box.gameObject);
                    if (!yes) return;
                    CloseSlots();
                    StartEffect("new", slot);
                });
                bx += 180f;
            }
        }

        private void CloseSlots()
        {
            if (slotRoot != null) Destroy(slotRoot.gameObject);
            slotRoot = null;
            if (Current == Phase.Slots) SetPhase(Phase.Menu);
        }

        // ── 毎コマ ──

        private void Update()
        {
            if (root == null) return;
            float dt = Time.unscaledDeltaTime;
            clock += dt; phaseTime += dt;
            bool still = Still;
            // 空の横移動（90秒で 0 → −652 を往復。ゆっくり始まりゆっくり止まる）
            float pan = still ? 0f : Mathf.PingPong(clock / 90f, 1f);
            skyPan.anchoredPosition = new Vector2(-652f * (pan * pan * (3f - 2f * pan)), 0f);
            // 地平線の光（7秒で 不透明度 0.75↔1・横 1↔1.06）
            float g7 = still ? 0f : 0.5f - 0.5f * Mathf.Cos(clock / 7f * Mathf.PI * 2f);
            // 明るい光を重ねる不透明度は、線形の空間で混ぜるとブラウザより明るく見えるので弱める（SeenLight）
            horizonImg.color = new Color(look.horizon.r, look.horizon.g, look.horizon.b, Hub2Textures.SeenLight(look.horizon.a * Mathf.Lerp(0.75f, 1f, g7), 0.9f, 0.08f));
            horizon.localScale = new Vector3(Mathf.Lerp(1f, 1.06f, g7), 1f, 1f);
            // 星（4秒周期の脈・輪の回転）
            float g4 = still ? 1f : 0.5f - 0.5f * Mathf.Cos(clock / 4f * Mathf.PI * 2f);
            core.localScale = Vector3.one * Mathf.Lerp(1f, 1.18f, still ? 0f : g4);
            foreach (var f in new[] { flareH1, flareH2 })
            {
                f.localScale = new Vector3(Mathf.Lerp(0.92f, 1f, g4), 1f, 1f);
                var ri = f.GetComponent<RawImage>(); var cc = ri.color; cc.a = look.flare.a * Mathf.Lerp(0.7f, 1f, g4); ri.color = cc;
            }
            flareV.localScale = new Vector3(1f, Mathf.Lerp(0.85f, 1f, g4), 1f);
            { var ri = flareV.GetComponent<RawImage>(); var cc = ri.color; cc.a = look.flare.a * Mathf.Lerp(0.6f, 0.95f, g4); ri.color = cc; }
            if (!still)
            {
                halo.localEulerAngles = new Vector3(0f, 0f, -(clock / 120f * 360f) % 360f);
                ring.localEulerAngles = new Vector3(0f, 0f, (clock / 200f * 360f) % 360f);
            }
            // 題名の光（7秒周期: 0〜55% は止まる、55〜85% で左から右へ）
            float s7 = (clock % 7f) / 7f;
            float sp = still ? 0f : Mathf.Clamp01((s7 - 0.55f) / 0.30f);
            float tw = 1688f;
            shineBand.anchoredPosition = new Vector2(Mathf.Lerp(844f - 420f - 120f, 844f + 420f + 120f, Mathf.SmoothStep(0f, 1f, sp)), 0f);
            shineBand.gameObject.SetActive(!still && s7 >= 0.55f && s7 <= 0.86f);
            _ = tw;
            // 出てくるときの動き（1.1秒で下 18px から）
            foreach (var (rt, g, delay) in fadeUps)
            {
                float k = still ? 1f : Mathf.Clamp01((clock - delay) / 1.1f), e = 1f - Mathf.Pow(1f - k, 3f);
                g.alpha = Current == Phase.Effect ? g.alpha : e;
                rt.anchoredPosition = new Vector2(rt.anchoredPosition.x, -(baseY[rt] + 18f * (1f - e)));
            }
            // メニュー・説明の行（1.2秒後から 1.4秒でふわっと）／タップ待ちの明滅（2.4秒）
            float m = still ? 1f : Mathf.Clamp01((clock - 1.2f) / 1.4f);
            if (Current != Phase.Effect) { menuGroup.alpha = Current == Phase.Menu ? Mathf.Max(m, Mathf.Clamp01(phaseTime / 0.6f)) : 0f; infoGroup.alpha = menuGroup.alpha; }
            tapGroup.alpha = still ? 1f : Mathf.Lerp(0.35f, 1f, 0.5f - 0.5f * Mathf.Cos(clock / 2.4f * Mathf.PI * 2f));
            // 選んでいる項目: 字の色・下線（中央から 0.3秒で伸びる）
            for (int i = 0; i < items.Count; i++)
            {
                var it = items[i];
                bool on = i == selected && !it.locked;
                var col = it.locked ? look.menuLock : on ? look.menuOn : look.menu;
                it.jaText.color = col;
                it.enText.color = new Color(col.r, col.g, col.b, col.a * 0.75f);
                it.u = still ? (on ? 1f : 0f) : Mathf.MoveTowards(it.u, on ? 1f : 0f, dt / 0.3f);
                float ue = 1f - Mathf.Pow(1f - it.u, 3f);
                // 1px の線は、画面が基準（1688×780）より小さいと1画面の点より細くなり消える。いつも1点以上の太さに（Hub2担当のレビュー 2026-11-13）
                float px1 = canvas != null && canvas.scaleFactor > 0f ? Mathf.Max(1f, 1f / canvas.scaleFactor) : 1f;
                it.underline.sizeDelta = new Vector2(it.rt.sizeDelta.x * ue, px1);
                it.underline.GetComponent<Image>().color = col;
            }
            // キー
            var kb = Keyboard.current;
            if (kb != null && !SettingsMenu.IsOpen)
            {
                if (Current == Phase.Tap && (kb.enterKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame)) SetPhase(Phase.Menu);
                else if (Current == Phase.Menu)
                {
                    if (kb.leftArrowKey.wasPressedThisFrame) Select(Mathf.Max(0, selected - 1));
                    if (kb.rightArrowKey.wasPressedThisFrame) Select(Mathf.Min(items.Count - 1, selected + 1));
                    if (kb.enterKey.wasPressedThisFrame) Run(selected);
                }
            }
            if (Current == Phase.Effect) StepEffect();
#if UNITY_EDITOR
            if (kb != null && kb.f8Key.wasPressedThisFrame) { DesignRefIndex = DesignRefIndex + 1 >= DesignRefs.Length ? -1 : DesignRefIndex + 1; ApplyDesignRef(); }
#endif
        }

        private readonly Dictionary<RectTransform, float> baseY = new Dictionary<RectTransform, float>();

        private void AddFade(RectTransform rt, float delay)
        {
            var g = rt.gameObject.AddComponent<CanvasGroup>();
            g.blocksRaycasts = false;
            baseY[rt] = -rt.anchoredPosition.y;
            fadeUps.Add((rt, g, delay));
        }

        /// <summary>確認用: 出てくる動きを飛ばす</summary>
        public void FinishIntro() { clock = Mathf.Max(clock, 3f); Update(); }

        /// <summary>確認用: 演出の時刻で止めて見る</summary>
        public void ScrubEffect(string kind, float t) { if (Current != Phase.Effect) StartEffect(kind, Mathf.Max(1, latestSlot)); fxStart = clock - t; fxDone = true; StepEffect(); }

        public void SetSelected(int i) => Select(i);

#if UNITY_EDITOR
        public static readonly string[] DesignRefs =
        {
            "title_02_before_menu", "title_01_before_tap", "title_03_before_nosave", "title_04_dawn_menu", "title_05_end_menu", "title_06_end_tap", "fx_01_new_game", "fx_02_continue",
        };
        public static int DesignRefIndex = -1;

        public void ApplyDesignRef()
        {
            if (designRef == null) return;
            bool on = DesignRefIndex >= 0 && DesignRefIndex < DesignRefs.Length;
            designRef.gameObject.SetActive(on);
            if (on) designRef.texture = UnityEditor.AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/DesignRefs/Title/" + DesignRefs[DesignRefIndex] + ".png");
            designRef.transform.SetAsLastSibling();
        }
#endif

        private void OnDestroy() { if (Instance == this) Instance = null; }

        // ── 絵（コードで作る） ──

        private static Texture2D hLine, hLineSoft, vLine, radial, shine;
        private static readonly Dictionary<string, Texture2D> cache = new Dictionary<string, Texture2D>();

        private static Texture2D HLine()
        {
            if (hLine != null) return hLine;
            hLine = new Texture2D(256, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int x = 0; x < 256; x++) hLine.SetPixel(x, 0, new Color(1f, 1f, 1f, 1f - Mathf.Abs(x / 255f * 2f - 1f)));
            hLine.Apply();
            return hLine;
        }

        private static Texture2D HLineSoft()
        {
            if (hLineSoft != null) return hLineSoft;
            const int W = 256, Hh = 32;
            hLineSoft = new Texture2D(W, Hh, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < Hh; y++)
            for (int x = 0; x < W; x++)
            {
                float ax = 1f - Mathf.Abs(x / (W - 1f) * 2f - 1f);
                float dy = (y + 0.5f) / Hh * 2f - 1f;
                float ay = Mathf.Exp(-dy * dy * 4f);
                hLineSoft.SetPixel(x, y, new Color(1f, 1f, 1f, ax * ay * 0.8f));
            }
            hLineSoft.Apply();
            return hLineSoft;
        }

        private static Texture2D VLine()
        {
            if (vLine != null) return vLine;
            vLine = new Texture2D(1, 256, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < 256; y++) vLine.SetPixel(0, y, new Color(1f, 1f, 1f, 1f - Mathf.Abs(y / 255f * 2f - 1f)));
            vLine.Apply();
            return vLine;
        }

        /// <summary>中心が1、楕円のふちで0（radial-gradient closest-side）</summary>
        private static Texture2D RadialFade()
        {
            if (radial != null) return radial;
            const int S = 128;
            radial = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < S; y++)
            for (int x = 0; x < S; x++)
            {
                float dx = (x + 0.5f) / S * 2f - 1f, dy = (y + 0.5f) / S * 2f - 1f;
                radial.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy))));
            }
            radial.Apply();
            return radial;
        }

        private static Texture2D ShineTexture()
        {
            if (shine != null) return shine;
            shine = new Texture2D(64, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int x = 0; x < 64; x++) shine.SetPixel(x, 0, new Color(1f, 1f, 1f, 1f - Mathf.Abs(x / 63f * 2f - 1f)));
            shine.Apply();
            return shine;
        }

        /// <summary>上下の暗さ（上端の色 → 38% で透明 → 58% まで透明 → 下端の色）</summary>
        private static Texture2D ShadeTexture(Color top, Color bottom)
        {
            string key = "shade" + top + bottom;
            if (cache.TryGetValue(key, out var t) && t != null) return t;
            const int Hh = 128;
            t = new Texture2D(1, Hh, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < Hh; y++)
            {
                float p = 1f - (y + 0.5f) / Hh;   // 0＝上
                Color c = p < 0.38f ? Color.Lerp(top, new Color(top.r, top.g, top.b, 0f), p / 0.38f)
                    : p < 0.58f ? new Color(0f, 0f, 0f, 0f)
                    : Color.Lerp(new Color(bottom.r, bottom.g, bottom.b, 0f), bottom, (p - 0.58f) / 0.42f);
                c.a = Hub2Textures.Seen(c.a);
                t.SetPixel(0, y, c);
            }
            t.Apply();
            cache[key] = t;
            return t;
        }

        /// <summary>星の芯（中心〜30% 芯の色 → 60% 星の色 → 72% で透明）</summary>
        private static Texture2D CoreTexture(Color coreIn, Color starC)
        {
            string key = "core" + coreIn + starC;
            if (cache.TryGetValue(key, out var t) && t != null) return t;
            const int S = 64;
            t = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < S; y++)
            for (int x = 0; x < S; x++)
            {
                float dx = (x + 0.5f) / S * 2f - 1f, dy = (y + 0.5f) / S * 2f - 1f;
                float r = Mathf.Sqrt(dx * dx + dy * dy) * 0.70710678f / 0.70710678f;   // circle: 100% ＝ 中心から角まで（CSS の circle farthest-corner）
                r = Mathf.Sqrt(dx * dx + dy * dy) / 1.41421356f;
                Color c = r <= 0.3f ? coreIn : r <= 0.6f ? Color.Lerp(coreIn, starC, (r - 0.3f) / 0.3f) : r <= 0.72f ? Color.Lerp(starC, new Color(starC.r, starC.g, starC.b, 0f), (r - 0.6f) / 0.12f) : new Color(0f, 0f, 0f, 0f);
                float edge = Mathf.Clamp01((1f - Mathf.Sqrt(dx * dx + dy * dy)) * S / 2f);   // 丸く切る（border-radius 50%）
                c.a *= edge;
                t.SetPixel(x, y, c);
            }
            t.Apply();
            cache[key] = t;
            return t;
        }

        /// <summary>朝日（中心 白 → 30% 金 0.75 → 60% 橙 0.25 → ふちで透明）</summary>
        private static Texture2D SunTexture()
        {
            if (cache.TryGetValue("sun", out var t) && t != null) return t;
            const int S = 256;
            t = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            Color a = C(255, 250, 230, 1f), b = C(255, 214, 140, 0.75f), c2 = C(255, 170, 90, 0.25f), d = C(255, 170, 90, 0f);
            for (int y = 0; y < S; y++)
            for (int x = 0; x < S; x++)
            {
                float dx = (x + 0.5f) / S * 2f - 1f, dy = (y + 0.5f) / S * 2f - 1f;
                float r = Mathf.Sqrt(dx * dx + dy * dy);
                Color c = r <= 0.3f ? Color.Lerp(a, b, r / 0.3f) : r <= 0.6f ? Color.Lerp(b, c2, (r - 0.3f) / 0.3f) : r <= 1f ? Color.Lerp(c2, d, (r - 0.6f) / 0.4f) : d;
                t.SetPixel(x, y, c);
            }
            t.Apply();
            cache["sun"] = t;
            return t;
        }

        // ── 小さな道具 ──

        private static RectTransform Node(string name, Transform parent)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = Vector2.zero;
            return rt;
        }

        private static void Stretch(RectTransform rt) { rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.pivot = new Vector2(0.5f, 0.5f); rt.sizeDelta = Vector2.zero; rt.anchoredPosition = Vector2.zero; }

        private static RectTransform Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        private static RectTransform Centered(RectTransform rt, float cx, float cy, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(cx, -cy);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        private static RawImage Raw(string name, Transform parent, Texture tex, Color color)
        {
            var ri = Node(name, parent).gameObject.AddComponent<RawImage>();
            ri.texture = tex;
            ri.color = color;
            ri.raycastTarget = false;
            return ri;
        }

        private static PolyGraphic Poly(string name, Transform parent, Color color)
        {
            var rt = Node(name, parent);
            rt.gameObject.AddComponent<CanvasRenderer>();
            var g = rt.gameObject.AddComponent<PolyGraphic>();
            g.color = color;
            g.raycastTarget = false;
            return g;
        }

        private static Text Label(Transform parent, string text, float x, float y, float w, float h, int size, Color color, Font font)
        {
            var t = Node("Text", parent).gameObject.AddComponent<Text>();
            Place(t.rectTransform, x, y, w, h);
            t.font = font;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = TextAnchor.MiddleLeft;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        /// <summary>字間をつけて、見える幅（最後の字間を除く）を返す</summary>
        private static float Spaced(Text t, float em)
        {
            var ls = t.gameObject.GetComponent<LetterSpacing>() ?? t.gameObject.AddComponent<LetterSpacing>();
            ls.em = em;
            return t.preferredWidth + em * t.fontSize * Mathf.Max(0, t.text.Length - 1);
        }

        private static float Width(Text t, float em) => t.preferredWidth + em * t.fontSize * Mathf.Max(0, t.text.Length - 1);

        /// <summary>字間つきの文字を cx の中央に（CSS の text-indent で中心をそろえた見え方。見える字の並びのまん中が cx）</summary>
        private static void CenterSpaced(Text t, float cx, float em)
        {
            Spaced(t, em);
            t.alignment = TextAnchor.MiddleCenter;
            var rt = t.rectTransform;
            float step = em * t.fontSize;
            rt.anchoredPosition = new Vector2(cx - rt.sizeDelta.x / 2f - (t.text.Length - 1) * step / 2f, rt.anchoredPosition.y);
        }

        private static Color Lit(Color c) => new Color(c.r, c.g, c.b, Hub2Textures.SeenLight(c.a, 0.85f, 0.15f));

        /// <summary>続く空白を1つに（HTML の見え方と同じ。運命予報の文）</summary>
        private static string Collapse(string s) => System.Text.RegularExpressions.Regex.Replace(s ?? "", " {2,}", " ");

        private static void SoftShadow(Text t, float a, float dy, float radius)
        {
            var s = t.gameObject.AddComponent<SoftTextShadow>();
            s.alpha = a; s.offsetY = dy; s.radius = radius;
        }

        private static void Shadow(Text t, float a, float dy)
        {
            var s = t.gameObject.AddComponent<UnityEngine.UI.Shadow>();
            s.effectColor = new Color(0f, 0f, 0f, a);
            s.effectDistance = new Vector2(0f, -dy);
        }
    }
}
