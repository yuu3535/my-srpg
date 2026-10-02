using System;
using System.Collections.Generic;
using System.Linq;
using Srpg.Battle.Plan;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace Srpg.Battle
{
    /// <summary>
    /// 3Dの戦闘の画面のUI。1段目: 右のコマンド一覧、左下のユニットのカードと武器のカード、下の戦闘予測の帯。
    /// 2段目: 上の帯（フェーズ・勝利条件・ターン・敵行動予告の数）、左の味方一覧、右上の地形の欄、
    /// キャラの下のHPバーと行動予告の印、頭の上の印（選んだ味方＝青の▼、戦闘予測の相手＝交差した剣）。
    /// ブラウザ版の戦闘画面と同じ配置・同じ素材（assets/ui）で作る。位置と大きさはブラウザ版の 844×390 の画面で測った値
    /// （tools/export_unity_battle_ui.mjs が表示の値と立ち絵の切り抜きを書き出す）。
    /// UIは中央の16:9の枠の中（3段の重ね。原作者 2026-09-26）。明朝体（端末の Noto Serif JP・游明朝）
    /// </summary>
    public class Battle3DHud : MonoBehaviour
    {
        [Serializable]
        public struct NamedSprite
        {
            public string name;
            public Sprite sprite;
        }

        [Serializable]
        public struct NamedTexture
        {
            public string name;
            public Texture2D texture;
        }

        [SerializeField] private Battle3DController controller;
        [SerializeField] private Camera targetCamera;                                     // 盤面を映すカメラ（UIもこのカメラの前に描く）
        [SerializeField] private TextAsset uiJson;
        [SerializeField] private NamedSprite[] sprites = Array.Empty<NamedSprite>();      // UI素材（panel_even・fc_band・ボタン・武器のアイコンなど）
        [SerializeField] private NamedTexture[] portraits = Array.Empty<NamedTexture>();  // 立ち絵（キャラの id）
        [SerializeField] private Font regularFont;   // 明朝体（ゲームに同梱した Noto Serif JP。Assets/Fonts）
        [SerializeField] private Font boldFont;

        // ブラウザ版の画面の大きさ（この上の位置で並べる）と、UIを置く16:9の枠の左右の余り
        private const float ScreenW = 844f, ScreenH = 390f;

        // 色（ブラウザ版の style.css と同じ）
        private static readonly Color Gold = Hex("#ecd28e");
        private static readonly Color GoldDeep = Hex("#d6a740");
        private static readonly Color Ivory = Hex("#f3e2b6");
        private static readonly Color Parchment = Hex("#f1e2bb");
        private static readonly Color Muted = Hex("#e0bd73", 0.7f);
        private static readonly Color Faint = Hex("#e2d4b4", 0.72f);
        private static readonly Color Rule = Hex("#c8922a", 0.18f);

        private readonly Dictionary<string, Sprite> spriteMap = new Dictionary<string, Sprite>();
        private readonly Dictionary<string, UiUnit> uiUnits = new Dictionary<string, UiUnit>();
        private Font font;
        private Canvas canvas;
        private RectTransform frame;

        // 部品
        private RectTransform commandList, hintBar, forecastRoot, fcStrip, fcPanel;
        // 右の人物欄（銀細工のUI 第3段。2026-10-02）。行動を選ぶ間はコマンドと入れ替える（panelMode）
        private RectTransform personPanel, personIconRow, personAct, personSkillRow;
        private RawImage personFace;
        private Text personName, personLevel, personClass, personHp, personMp, personMove, personRange, personState, personWeapon, personDurability;
        private Text personSkillName, personSkillDesc;
        private Image personWeaponIcon, personHpFill, personMpFill;
        private readonly Text[] personStats = new Text[7];
        private Text personHit, personEvade;
        private readonly List<GameObject> personIconItems = new List<GameObject>();
        private RectTransform skillInfo;
        private Text skillInfoKind, skillInfoName, skillInfoDesc;
        private RectTransform skillInfoIcon;
        private string panelMode = "person", panelUnit;
        private Battle3DController.Mode lastPanelMode;
        private Text hintText;
        private RectTransform guideBar;
        private Text guideText;
        private readonly List<GameObject> commandItems = new List<GameObject>();
        private ForecastSide leftSide, rightSide;
        private RawImage leftBust, rightBust;
        private Button fcCancel, fcConfirm, fcDetail;
        private Text fcConfirmLabel, fcTitle;
        private RectTransform fcExtraBox;
        private Text fcExtra;
        private Image fcConfirmIcon;
        private RectTransform fcDetailBox;
        private Text fcDetailText;
        private string stateKey;

        // 2段目
        private RectTransform overlayRoot, topStrip, roster, terrainPanel;
        // 味方一覧の開け閉め（原作者 2026-10-02: 一覧が画面を占めて邪魔なときがある）。TURN の下の山形で開け閉めし、覚えておく
        private RectTransform rosterChevron, rosterView, rosterFaces;
        private Text rosterDecl;
        private const string RosterPref = "srpg.rosterCollapsed";
        private static bool RosterCollapsed
        {
            get => PlayerPrefs.GetInt(RosterPref, 0) == 1;
            set { PlayerPrefs.SetInt(RosterPref, value ? 1 : 0); PlayerPrefs.Save(); }
        }
        private Text turnValue, terrainName, terrainNote;
        // フェーズ切替の演出（ブラウザ版 showPhaseBanner と同じ見た目・同じ長さ 1.65秒）
        private RectTransform bannerRoot, bannerVeil, bannerRail, bannerCopy;
        private Text bannerEyebrow, bannerTitle, bannerSub;
        private Image bannerVeilImage, bannerRailLeft, bannerRailRight, bannerDiamond, bannerTopLine, bannerBottomLine;
        private CanvasGroup bannerVeilGroup, bannerRailGroup, bannerCopyGroup;
        private float bannerStart = -1f;
        private string bannerShownKey;
        private const float BannerSeconds = 1.65f;

        // 戦況の画面（原作者 2026-09-27: 勝利条件・敗北条件・ターン・軍の数・マップ表をここにまとめる）
        private RectTransform statusRoot, statusMapArea, statusMapPanel;
        private RawImage statusMap;
        private Text statusTitle, statusVictory, statusDefeat, statusTurn, statusAllies, statusEnemies, statusOthers, statusTargets;
        private readonly List<GameObject> statusMarks = new List<GameObject>();
        private bool statusOpen, openedAtStart;
        public bool StatusOpen => statusOpen;
        private Vector2Int? shownTerrainCell;
        private readonly List<RosterSlot> rosterSlots = new List<RosterSlot>();
        private readonly Dictionary<string, UnitOverlay> overlays = new Dictionary<string, UnitOverlay>();
        private Image markSelected, markTarget;

        private class RosterSlot
        {
            public string id;
            public RectTransform root;
            public RawImage face;
            public Image frame, hpFill;   // frame: 顔の枠の線（選んでいる味方は明るい青）
            public Text done;
        }

        private class UnitOverlay
        {
            public RectTransform root;
            public Text hp;
            public Image fill, intent;
        }

        private string subList;   // コマンドの一覧を入れ替えている（"skill" 戦技・"magic" 魔法）。null なら最初の一覧
        private string subListOwner;   // 一覧を開いたキャラ。別のキャラを選んだら最初の一覧に戻す
        private Button fcPrev, fcNext;
        private Text fcCount;

        private class ForecastSide
        {
            public Text name, level, weapon, hpValue, note;
            public Image weaponIcon, hpLost, hpAfter;
            public Text[] values;
        }

        public bool Built => canvas != null;

        private Rect safeAreaApplied;

        /// <summary>
        /// 端末の安全な表示範囲（切り欠き・丸い角を除いた範囲）の内側に、左右の部品を置く。
        /// 盤面と背景は画面いっぱいのまま。エディタ・PCでは範囲が画面全体なので何もしない
        /// </summary>
        private void ApplySafeArea()
        {
            if (frame == null) return;
            var safe = Screen.safeArea;
            if (safe == safeAreaApplied) return;
            safeAreaApplied = safe;
            float w = Mathf.Max(1, Screen.width), h = Mathf.Max(1, Screen.height);
            var canvasRect = ((RectTransform)canvas.transform).rect;
            frame.offsetMin = new Vector2(safe.xMin / w * canvasRect.width, safe.yMin / h * canvasRect.height);
            frame.offsetMax = new Vector2(-(w - safe.xMax) / w * canvasRect.width, -(h - safe.yMax) / h * canvasRect.height);
        }

        private void LateUpdate()
        {
            // 戦闘の組み立て（Battle3DController.Setup）が済んでから作る（Start の順番に頼らない）
            if (!Built)
            {
                if (controller == null || controller.Data == null) return;
                Build();
            }
            ApplySafeArea();
            Refresh();
            UpdatePhaseBanner(Time.unscaledTime);
            UpdateOverlays();
            UpdateTerrain();
        }

        // ── 組み立て ──

        /// <summary>UIを組み立てる（▶の始まり。確認の画像を撮るときはエディタから呼ぶ）</summary>
        public void Build()
        {
            Clear();
            spriteMap.Clear();
            foreach (var s in sprites) if (s.sprite != null) spriteMap[s.name] = s.sprite;
            uiUnits.Clear();
            if (uiJson != null)
                foreach (var u in JsonUtility.FromJson<UiDataFile>(uiJson.text).units ?? Array.Empty<UiUnit>())
                    uiUnits[u.id] = u;
            font = regularFont != null ? regularFont
                : JapaneseFont.Get(new[] { "Noto Serif JP", "Yu Mincho", "游明朝", "MS PMincho", "Hiragino Mincho ProN" }, 16);

            var canvasObject = new GameObject("HUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);
            canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = targetCamera != null ? targetCamera : Camera.main;
            canvas.planeDistance = 1f;
            canvas.sortingOrder = 100;   // 盤面のキャラの絵（10）より手前
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(ScreenW, ScreenH);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;

            // キャラの下のHPバー・頭の上の印（盤面に付いて動く。ほかのUIより奥）
            overlayRoot = NewRect("Overlays", canvasObject.transform);
            Stretch(overlayRoot);
            overlays.Clear();
            markSelected = OverlayMark("MarkSelected", "mark_selected", 13, 11.4f);
            markTarget = OverlayMark("MarkTarget", "mark_target", 16, 16);

            // 画面いっぱいの枠（銀細工のUIの土台。2026-10-02）。高さ390を基準に拡大縮小し、横に長い画面では左右へ広がる。
            // 部品は PlaceLeft・PlaceRight・PlaceCenter・PlaceWide で、画面の左端・右端・真ん中から位置を決める。
            // スマホの切り欠き・丸い角は ApplySafeArea で避ける
            frame = NewRect("Frame", canvasObject.transform);
            Stretch(frame);
            safeAreaApplied = new Rect(-1f, -1f, -1f, -1f);

            BuildTopStrip();
            BuildRoster();
            BuildTerrainPanel();
            BuildPersonPanel();
            BuildCommandList();
            BuildHint();
            BuildGuide();
            BuildForecast();
            BuildStatus();
            BuildSkillInfo();
            BuildPhaseBanner();
            bannerShownKey = null;

            if (Application.isPlaying && EventSystem.current == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
                es.transform.SetParent(transform, false);
            }
            stateKey = null;
            statusOpen = false;
            // ▶で戦闘が始まったら、まず戦況の画面で勝利条件を見せる（1回だけ）
            if (Application.isPlaying && !openedAtStart) { openedAtStart = true; OpenStatus(); }
            Refresh();
        }

        public void Clear()
        {
            for (int i = transform.childCount - 1; i >= 0; i--) Object.DestroyImmediate(transform.GetChild(i).gameObject);
            canvas = null;
            commandItems.Clear();
            rosterSlots.Clear();
            overlays.Clear();
        }

        /// <summary>
        /// 左上: Chapter・戦場名・勝利条件（銀細工のUI 第2段。原作者 2026-10-02）。常に出ていたフェーズの文字はやめ、
        /// フェーズの切り替えは演出（BuildPhaseBanner）で見せる。TURN は左の一覧の上へ移した。位置と大きさはブラウザ版と同じ
        /// </summary>
        private void BuildTopStrip()
        {
            var data = controller.Data;
            topStrip = Place(NewRect("Chapter", frame), 17, 13, 300, 60);
            var ornament = SpriteImage(topStrip, "fc_emblem_sword", 0, 1, 16, 46, true);
            ornament.color = new Color(0.86f, 0.9f, 0.92f, 0.9f);
            Shadowed(Label(topStrip, "ChapterNo", 22, 0, 240, 13, 11, HudPalette.Silver)).text = data?.chapter ?? "";
            Shadowed(Label(topStrip, "Location", 22, 12, 278, 24, 18, HudPalette.Text, FontStyle.Bold)).text =
                !string.IsNullOrEmpty(data?.location) ? data.location : (!string.IsNullOrEmpty(data?.title) ? data.title : "");
            var chip = Place(NewRect("VictoryChip", topStrip), 22, 42, 46, 15);
            chip.gameObject.AddComponent<Image>().color = HudPalette.Condition;
            Label(chip, "勝利条件", 0, 0, 46, 15, 10, HudPalette.Text, FontStyle.Normal, TextAnchor.MiddleCenter).raycastTarget = false;
            Shadowed(Label(topStrip, "Victory", 74, 42, 226, 15, 10.5f, HudPalette.Text)).text =
                string.IsNullOrEmpty(data?.victoryText) ? "すべての敵を撃破する" : data.victoryText;
        }

        /// <summary>
        /// フェーズ切替の演出（ブラウザ版 showPhaseBanner・style.css #phaseBanner と同じ見た目と動き）。
        /// 画面の真ん中に横長の暗い帯、細い線と菱形、小さな英字＋大きな見出し。1.65秒で出て消える。盤面の操作はさえぎらない
        /// </summary>
        private void BuildPhaseBanner()
        {
            bannerRoot = NewRect("PhaseBanner", canvas.transform);
            Stretch(bannerRoot);
            bannerVeil = NewRect("Veil", bannerRoot);
            bannerVeil.anchorMin = new Vector2(0f, 0.5f);
            bannerVeil.anchorMax = new Vector2(1f, 0.5f);
            bannerVeil.pivot = new Vector2(0.5f, 0.5f);
            bannerVeil.sizeDelta = new Vector2(0f, 112f);
            bannerVeilGroup = bannerVeil.gameObject.AddComponent<CanvasGroup>();
            bannerVeilImage = bannerVeil.gameObject.AddComponent<Image>();
            bannerTopLine = Place(NewRect("TopLine", bannerVeil), 0, 0, 10, 1).gameObject.AddComponent<Image>();
            StretchX(bannerTopLine.rectTransform, true);
            bannerBottomLine = Place(NewRect("BottomLine", bannerVeil), 0, 0, 10, 1).gameObject.AddComponent<Image>();
            StretchX(bannerBottomLine.rectTransform, false);

            bannerRail = NewRect("Rail", bannerRoot);
            bannerRail.anchorMin = bannerRail.anchorMax = bannerRail.pivot = new Vector2(0.5f, 0.5f);
            bannerRail.sizeDelta = new Vector2(620f, 13f);
            bannerRailGroup = bannerRail.gameObject.AddComponent<CanvasGroup>();
            bannerRailLeft = Place(NewRect("Left", bannerRail), 0, 6, 291.5f, 1).gameObject.AddComponent<Image>();
            bannerRailRight = Place(NewRect("Right", bannerRail), 328.5f, 6, 291.5f, 1).gameObject.AddComponent<Image>();
            var diamond = Place(NewRect("Diamond", bannerRail), 305, 1.5f, 10, 10);
            diamond.pivot = new Vector2(0.5f, 0.5f);
            diamond.anchoredPosition = new Vector2(310f, -6.5f);
            diamond.localEulerAngles = new Vector3(0f, 0f, 45f);
            diamond.gameObject.AddComponent<Image>().color = Hex("#0b0b14");
            bannerDiamond = Place(NewRect("Edge", diamond), -1, -1, 12, 12).gameObject.AddComponent<Image>();
            bannerDiamond.color = new Color(0, 0, 0, 0);
            bannerDiamond.gameObject.AddComponent<Outline>().effectDistance = new Vector2(1f, -1f);

            bannerCopy = NewRect("Copy", bannerRoot);
            bannerCopy.anchorMin = bannerCopy.anchorMax = bannerCopy.pivot = new Vector2(0.5f, 0.5f);
            bannerCopy.sizeDelta = new Vector2(320f, 52f);
            bannerCopyGroup = bannerCopy.gameObject.AddComponent<CanvasGroup>();
            bannerEyebrow = Label(bannerCopy, "Eyebrow", 0, 4, 320, 9, 7, Hex("#e0bd73", 0.66f), FontStyle.Normal, TextAnchor.MiddleCenter);
            bannerTitle = Label(bannerCopy, "Title", 0, 13, 320, 31, 27, Hex("#efd99c"), FontStyle.Bold, TextAnchor.MiddleCenter);
            var titleShadow = bannerTitle.gameObject.AddComponent<Shadow>();
            titleShadow.effectColor = new Color(0f, 0f, 0f, 0.92f);
            titleShadow.effectDistance = new Vector2(0f, -2f);
            bannerSub = Label(bannerCopy, "Sub", 0, 44, 320, 9, 7, Hex("#e0bd73", 0.66f), FontStyle.Normal, TextAnchor.MiddleCenter);
            foreach (var g in bannerRoot.GetComponentsInChildren<Graphic>(true)) g.raycastTarget = false;
            bannerRoot.gameObject.SetActive(false);
        }

        private static void StretchX(RectTransform rt, bool top)
        {
            rt.anchorMin = new Vector2(0f, top ? 1f : 0f);
            rt.anchorMax = new Vector2(1f, top ? 1f : 0f);
            rt.pivot = new Vector2(0.5f, top ? 1f : 0f);
            rt.anchoredPosition = Vector2.zero;
            rt.sizeDelta = new Vector2(0f, 1f);
        }

        /// <summary>演出を出す（variant: ally / enemy / victory / defeat）。ブラウザ版の文言と同じ</summary>
        public void ShowPhaseBanner(string variant)
        {
            if (bannerRoot == null) return;
            int turn = controller != null ? controller.Turn : 1;
            bool red = variant == "enemy" || variant == "defeat";
            bannerEyebrow.text = Spaced(variant == "ally" ? $"TURN {turn} / ROYAL COMMAND" : variant == "enemy" ? $"TURN {turn} / HOSTILE FORCE"
                : variant == "victory" ? "BATTLE COMPLETE" : "BATTLE TERMINATED", " ");
            bannerTitle.text = Spaced(variant == "ally" ? "味方行動" : variant == "enemy" ? "敵軍行動" : variant == "victory" ? "勝利" : "敗北", "\u2009");
            bannerSub.text = Spaced(variant == "ally" ? "ALLY PHASE" : variant == "enemy" ? "ENEMY PHASE" : variant == "victory" ? "VICTORY" : "DEFEAT", " ");
            bannerTitle.color = red ? Hex("#f0b0a2") : Hex("#efd99c");
            var small = red ? Hex("#e8998b", 0.68f) : Hex("#e0bd73", 0.66f);
            bannerEyebrow.color = bannerSub.color = small;
            bannerVeilImage.sprite = red
                ? StopsSprite((0f, Hex("#120a0e", 0f)), (0.17f, Hex("#12060a", 0.82f)), (0.5f, Hex("#1c070c", 0.96f)), (0.83f, Hex("#12060a", 0.82f)), (1f, Hex("#120a0e", 0f)))
                : StopsSprite((0f, Hex("#05070e", 0f)), (0.17f, Hex("#05070e", 0.82f)), (0.5f, Hex("#070810", 0.96f)), (0.83f, Hex("#05070e", 0.82f)), (1f, Hex("#05070e", 0f)));
            bannerTopLine.color = red ? Hex("#d34944", 0.42f) : Hex("#e0b048", 0.30f);
            bannerBottomLine.color = red ? Hex("#86222a", 0.30f) : Hex("#41c7b3", 0.16f);
            var rail = red ? Hex("#d34944", 0.68f) : Hex("#e0b048", 0.58f);
            bannerRailLeft.sprite = StopsSprite((0f, new Color(rail.r, rail.g, rail.b, 0f)), (1f, rail));
            bannerRailRight.sprite = StopsSprite((0f, rail), (1f, new Color(rail.r, rail.g, rail.b, 0f)));
            bannerDiamond.GetComponent<Outline>().effectColor = red ? Hex("#e55c52", 0.78f) : Hex("#e0b048", 0.72f);
            bannerRoot.SetAsLastSibling();
            bannerRoot.gameObject.SetActive(true);
            bannerStart = Time.unscaledTime;
            UpdatePhaseBanner(bannerStart);
        }

        /// <summary>確認の画像を撮るとき: 演出の途中（t＝0〜1）の形にする</summary>
        public void PreviewPhaseBanner(string variant, float t)
        {
            ShowPhaseBanner(variant);
            bannerStart = -1000f;
            ApplyPhaseBanner(t);
        }

        public void HidePhaseBanner()
        {
            if (bannerRoot != null) bannerRoot.gameObject.SetActive(false);
        }

        private void UpdatePhaseBanner(float now)
        {
            if (bannerRoot == null || !bannerRoot.gameObject.activeSelf || bannerStart < -999f) return;
            float t = (now - bannerStart) / BannerSeconds;
            if (t >= 1f) { bannerRoot.gameObject.SetActive(false); return; }
            ApplyPhaseBanner(t);
        }

        /// <summary>ブラウザ版の phaseVeilIn・phaseRailIn・phaseCopyIn と同じ動き（cubic-bezier(.16,1,.3,1) に近い ease-out）</summary>
        private void ApplyPhaseBanner(float t)
        {
            static float Ease(float x) => 1f - Mathf.Pow(1f - Mathf.Clamp01(x), 3f);
            // 帯: 0→18% で広がって出る、78% まで止まる、100% で少し縮んで消える
            float veilScale = t < 0.18f ? Mathf.Lerp(0.18f, 1f, Ease(t / 0.18f)) : t < 0.78f ? 1f : Mathf.Lerp(1f, 0.72f, (t - 0.78f) / 0.22f);
            float veilAlpha = t < 0.18f ? Ease(t / 0.18f) : t < 0.78f ? 1f : 1f - (t - 0.78f) / 0.22f;
            bannerVeil.localScale = new Vector3(veilScale, 1f, 1f);
            bannerVeilGroup.alpha = veilAlpha;
            float railScale = t < 0.24f ? Mathf.Lerp(0.10f, 1f, Ease(t / 0.24f)) : t < 0.78f ? 1f : Mathf.Lerp(1f, 0.82f, (t - 0.78f) / 0.22f);
            float railAlpha = t < 0.24f ? Ease(t / 0.24f) : t < 0.78f ? 1f : 1f - (t - 0.78f) / 0.22f;
            bannerRail.localScale = new Vector3(railScale, 1f, 1f);
            bannerRailGroup.alpha = railAlpha;
            // 文字: 14% まで待ち、30% で下から出る、76% まで止まる、100% で少し上へ消える
            float copyAlpha = t < 0.14f ? 0f : t < 0.30f ? Ease((t - 0.14f) / 0.16f) : t < 0.76f ? 1f : 1f - (t - 0.76f) / 0.24f;
            float copyY = t < 0.30f ? Mathf.Lerp(-8f, 0f, Ease(Mathf.Max(0f, t - 0.14f) / 0.16f)) : t < 0.76f ? 0f : Mathf.Lerp(0f, 5f, (t - 0.76f) / 0.24f);
            bannerCopy.anchoredPosition = new Vector2(0f, copyY);
            bannerCopyGroup.alpha = copyAlpha;
        }

        /// <summary>字の間をあける（ブラウザ版の letter-spacing の代わり）</summary>
        private static string Spaced(string text, string gap) => string.Join(gap, text.ToCharArray().Select(c => c.ToString()));

        /// <summary>文字に暗い影（盤面の上でも読めるように。見本の text-shadow）</summary>
        private static Text Shadowed(Text text)
        {
            var shadow = text.gameObject.AddComponent<Shadow>();
            shadow.effectColor = Hex("#132630", 0.9f);
            shadow.effectDistance = new Vector2(0.8f, -0.8f);
            text.raycastTarget = false;
            return text;
        }

        // 左の一覧の寸法（ブラウザ版の [silver-left] と同じ。見本 1254×627 を高さで縮めた値）
        private const float RosterX = 5f, RosterY = 77f, RosterW = 50f, RosterHead = 76f, RosterStep = 38f;

        /// <summary>
        /// 左: TURN と山形の開け閉め、その下へ顔の一覧（銀細工のUI 第2段）。閉じると TURN と山形だけ。顔を押すとその味方を選ぶ。
        /// 枠は見本の銀の枠（仮の素材 silver_frame）
        /// </summary>
        private void BuildRoster()
        {
            roster = Place(NewRect("Roster", frame), RosterX, RosterY, RosterW, RosterHead);
            var back = NewRect("Back", roster);
            Stretch(back);
            back.offsetMin = new Vector2(4f, 4f);
            back.offsetMax = new Vector2(-4f, -4f);
            back.gameObject.AddComponent<Image>().color = HudPalette.Panel;
            var border = NewRect("Frame", roster);
            Stretch(border);
            border.offsetMin = new Vector2(-4f, -4f);
            border.offsetMax = new Vector2(4f, 4f);
            Framed(border, "silver_frame", 11f).raycastTarget = false;
            Label(roster, "TURN", 0, 10, RosterW, 10, 9, HudPalette.Silver, FontStyle.Normal, TextAnchor.MiddleCenter).raycastTarget = false;
            turnValue = Label(roster, "TurnValue", 0, 20, RosterW, 21, 19, HudPalette.Text, FontStyle.Normal, TextAnchor.MiddleCenter);
            turnValue.raycastTarget = false;
            rosterDecl = Label(roster, "Decl", 0, 41, RosterW, 9, 7.5f, Hex("#e6a596"), FontStyle.Normal, TextAnchor.MiddleCenter);
            rosterDecl.raycastTarget = false;
            // 山形: 開いているとき上向き、閉じているとき下向き。押すところは少し広く
            var toggle = Place(NewRect("Toggle", roster), 7, 55, 36, 18);
            toggle.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var toggleButton = toggle.gameObject.AddComponent<Button>();
            toggleButton.transition = Selectable.Transition.None;
            toggleButton.onClick.AddListener(() => { RosterCollapsed = !RosterCollapsed; Refresh(); });
            rosterChevron = SpriteImage(toggle, "chevron_up", 10.5f, 1.5f, 15, 15, true).rectTransform;
            rosterChevron.pivot = new Vector2(0.5f, 0.5f);
            rosterChevron.anchoredPosition = new Vector2(18f, -9f);

            // 顔の一覧は、見える範囲（予測の間は短くして中だけスクロール。見本と同じ）の中に並べる
            rosterView = Place(NewRect("FacesView", roster), 0, RosterHead, RosterW, 10);
            rosterView.gameObject.AddComponent<RectMask2D>();
            rosterView.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            rosterFaces = Place(NewRect("Faces", rosterView), 0, 0, RosterW, 10);
            var scroll = rosterView.gameObject.AddComponent<ScrollRect>();
            scroll.content = rosterFaces;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 12f;
            rosterSlots.Clear();
            int i = 0;
            foreach (var unit in controller.Units.Where(u => u.Side == "ally"))
            {
                var slotRect = Place(NewRect("Roster_" + unit.Id, rosterFaces), 8, i * RosterStep, 34, 34);
                var bg = slotRect.gameObject.AddComponent<Image>();
                bg.color = Hex("#162331");
                var slot = new RosterSlot { id = unit.Id, root = slotRect };
                slot.face = Place(NewRect("Face", slotRect), 1, 1, 32, 32).gameObject.AddComponent<RawImage>();
                slot.face.raycastTarget = false;
                uiUnits.TryGetValue(unit.Id, out var ui);
                SetPortrait(slot.face, ui, ui?.rosterUv);
                var hpBar = Place(NewRect("Hp", slotRect), 0, 32, 29.6f, 2);
                hpBar.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0.55f);
                slot.hpFill = NewRect("Fill", hpBar).gameObject.AddComponent<Image>();
                slot.hpFill.color = HudPalette.Teal;
                // 枠の線（1px）。選んでいる味方は明るい青
                slot.frame = Place(NewRect("Frame", slotRect), 0, 0, 34, 34).gameObject.AddComponent<Image>();
                slot.frame.color = new Color(0, 0, 0, 0);
                slot.frame.raycastTarget = false;
                var line = slot.frame.gameObject.AddComponent<Outline>();
                line.effectDistance = new Vector2(1f, -1f);
                slot.done = Label(slotRect, "済", 21, 1, 12, 11, 8, HudPalette.Silver, FontStyle.Bold);
                var button = slotRect.gameObject.AddComponent<Button>();
                button.transition = Selectable.Transition.None;
                string id = unit.Id;
                button.onClick.AddListener(() => SelectFromRoster(id));
                rosterSlots.Add(slot);
                i++;
            }
        }

        private void SelectFromRoster(string id)
        {
            var unit = controller.Units.FirstOrDefault(u => u.Id == id);
            if (unit == null || !unit.Alive || unit.acted || controller.CurrentPhase != Battle3DController.Phase.Ally) return;
            // 攻撃の相手を選んでいる間や、動いたあとは切り替えない（ブラウザ版と同じ）
            var mode = controller.CurrentMode;
            if (mode != Battle3DController.Mode.Idle && mode != Battle3DController.Mode.Moving) return;
            controller.Select(id);
        }

        /// <summary>右上の地形の欄（原作者の理想の画面）。カーソルのあるマス、なければ選んだキャラのマス</summary>
        private void BuildTerrainPanel()
        {
            // 銀細工のUI 第3段: 右上に銀の枠。名前と、下に細い線と効果（見本の .terrain を高さで縮めた寸法）
            terrainPanel = PlaceFromRight(NewRect("Terrain", frame), PanelRight, 8, 128, 44);
            SilverBox(terrainPanel);
            terrainName = Label(terrainPanel, "Name", 12, 6, 104, 17, 13, HudPalette.Text);
            Place(NewRect("Rule", terrainPanel), 12, 24, 104, 1).gameObject.AddComponent<Image>().color = Hex("#7a8c9a");
            terrainNote = Label(terrainPanel, "Note", 12, 26, 104, 13, 9.5f, HudPalette.Silver);
        }

        private Image OverlayMark(string name, string sprite, float w, float h)
        {
            var image = NewRect(name, overlayRoot).gameObject.AddComponent<Image>();
            image.sprite = SpriteOf(sprite);
            image.preserveAspect = true;
            image.raycastTarget = false;
            image.rectTransform.anchorMin = image.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            image.rectTransform.pivot = new Vector2(0.5f, 0f);
            image.rectTransform.sizeDelta = new Vector2(w, h);
            image.gameObject.SetActive(false);
            return image;
        }

        private UnitOverlay OverlayOf(Battle3DController.UnitState unit)
        {
            if (overlays.TryGetValue(unit.Id, out var o)) return o;
            o = new UnitOverlay { root = NewRect("Overlay_" + unit.Id, overlayRoot) };
            o.root.anchorMin = o.root.anchorMax = new Vector2(0.5f, 0.5f);
            o.root.pivot = new Vector2(0.5f, 1f);
            // HPの数字はスマホの横画面でも読める大きさにし、濃い縁取りを付ける（レビュー 2026-09-28 F3: 7では約6pxで読めなかった）
            o.root.sizeDelta = new Vector2(58, 12);
            o.intent = Place(NewRect("Intent", o.root), -6, 1, 10, 10).gameObject.AddComponent<Image>();
            o.intent.sprite = SpriteOf("mark_intent");
            o.intent.raycastTarget = false;
            o.hp = Label(o.root, "Hp", 5, 0, 18, 12, 11, Hex("#55ee88"), FontStyle.Bold, TextAnchor.MiddleRight);
            var edge = o.hp.gameObject.AddComponent<Outline>();
            edge.effectColor = new Color(0.04f, 0.02f, 0.06f, 0.95f);
            edge.effectDistance = new Vector2(0.9f, -0.9f);
            var bar = Place(NewRect("Bar", o.root), 25, 4, 32, 3.5f);
            bar.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0.6f);
            o.fill = NewRect("Fill", bar).gameObject.AddComponent<Image>();
            o.fill.raycastTarget = false;
            overlays[unit.Id] = o;
            return o;
        }

        /// <summary>キャラの下のHPバーと行動予告の印、頭の上の印を、キャラの位置に合わせる（毎フレーム）</summary>
        public void UpdateOverlays()
        {
            if (!Built || controller == null || controller.View == null || overlayRoot == null) return;
            var view = controller.View;
            foreach (var unit in controller.Units)
            {
                var o = OverlayOf(unit);
                var foot = view.UnitFootToScreen(unit.Id);
                bool visible = unit.Alive && foot.z > 0f;
                o.root.gameObject.SetActive(visible);
                if (!visible) continue;
                o.root.anchoredPosition = ScreenToOverlay(foot) + new Vector2(0f, -1f);
                int hp = unit.plan?.hp ?? 0, maxHp = Math.Max(1, unit.plan?.maxHp ?? 1);
                float t = (float)hp / maxHp;
                var color = t <= 0.25f ? Hex("#ff5555") : t <= 0.5f ? Hex("#ffcc44") : Hex("#55ee88");
                o.hp.text = hp.ToString();
                // 敵の数字はバーと同じ赤系にして、味方の緑と見分ける（レビュー 2026-09-28 A3）
                o.hp.color = unit.Side == "enemy" && t > 0.5f ? Hex("#ff9a8a") : color;
                o.fill.color = unit.Side == "enemy" && t > 0.5f ? Hex("#e0645a") : color;
                SetBar(o.fill.rectTransform, t);
                bool intent = unit.Side == "enemy" && controller.Declarations.TryGetValue(unit.Id, out var d) && d.type == "attack"
                    && controller.CurrentPhase == Battle3DController.Phase.Ally;
                o.intent.gameObject.SetActive(intent);
            }

            // 頭の上の印: 選んでいる味方（動かす・行動を選ぶ間）に青の▼、戦闘予測の相手に交差した剣
            var sel = controller.Selected;
            var mode = controller.CurrentMode;
            bool showSelected = sel != null && sel.Side == "ally" && (mode == Battle3DController.Mode.Moving || mode == Battle3DController.Mode.Acting);
            PlaceHeadMark(markSelected, showSelected ? sel : null, 2f);
            PlaceHeadMark(markTarget, controller.EnemyPreview?.target ?? (mode == Battle3DController.Mode.Forecast ? controller.Target : null), 0f);
        }

        /// <summary>
        /// 画面の位置（px）を、盤面の上の印の置き場（画面いっぱい・中心が原点）の位置にする。
        /// キャンバスの位置はカメラが動いた次の描画で追いつくので、それを通さずに直接計算する（ずらしている間も遅れない）
        /// </summary>
        private Vector2 ScreenToOverlay(Vector3 screen)
        {
            var cam = canvas.worldCamera;
            var rect = cam != null ? cam.pixelRect : new Rect(0, 0, Screen.width, Screen.height);
            float scale = Mathf.Max(0.0001f, canvas.scaleFactor);
            return new Vector2((screen.x - rect.center.x) / scale, (screen.y - rect.center.y) / scale);
        }

        private void PlaceHeadMark(Image mark, Battle3DController.UnitState unit, float bob)
        {
            bool show = unit != null && unit.Alive;
            mark.gameObject.SetActive(show);
            if (!show) return;
            var head = controller.View.UnitHeadToScreen(unit.Id);
            var local = ScreenToOverlay(head);
            float wave = Application.isPlaying ? Mathf.Sin(Time.time * 4f) * bob : 0f;
            mark.rectTransform.anchoredPosition = local + new Vector2(0f, 1f + wave);
        }

        /// <summary>地形の欄を、カーソルのあるマス（なければ選んだキャラのマス）に合わせる</summary>
        public void UpdateTerrain()
        {
            if (!Built || terrainPanel == null || controller == null || controller.View == null) return;
            var map = controller.View.Map;
            // 誰も選んでいないときは出さない（レビュー 2026-09-28 B1: 盤面の奥のキャラに重なっていた）
            Vector2Int? cell = controller.Selected == null ? null : controller.View.HoverCell ?? controller.Selected.cell;
            bool show = cell.HasValue && map != null && map.InBounds(cell.Value) && controller.CurrentMode != Battle3DController.Mode.Forecast
                && controller.EnemyPreview == null;
            terrainPanel.gameObject.SetActive(show);
            if (!show || shownTerrainCell == cell) return;
            shownTerrainCell = cell;
            char t = map.TerrainAt(cell.Value);
            terrainName.text = Board3DMap.TerrainName(t);
            // 地形の効果（回避・防御）はまだ戦闘の計算にない。通れない地形はそう書く
            terrainNote.text = TerrainRules.CanStop(t, false) ? "回避 +0　防御 +0" : "通れない";
        }

        /// <summary>
        /// 戦況の画面（見本: 原作者のスクショ）。左に 見出し・勝利条件・敗北条件・軍の数・ターン・行動予告、右にマップ表。
        /// マップ表は3Dの盤面を真上から撮った絵に、陣営の印（味方＝青・敵＝赤）を重ねる
        /// </summary>
        private void BuildStatus()
        {
            statusRoot = NewRect("Status", canvas.transform);
            Stretch(statusRoot);
            var dim = statusRoot.gameObject.AddComponent<Image>();
            dim.color = new Color(4 / 255f, 3 / 255f, 10 / 255f, 0.9f);   // 色は線形で混ぜるので、見た目より強めの値にする
            var dimButton = statusRoot.gameObject.AddComponent<Button>();
            dimButton.transition = Selectable.Transition.None;
            dimButton.onClick.AddListener(CloseStatus);   // 外側を押しても閉じる

            var body = NewRect("Body", statusRoot);
            body.anchorMin = body.anchorMax = new Vector2(0.5f, 0.5f);
            body.pivot = new Vector2(0.5f, 0.5f);
            body.sizeDelta = new Vector2(ScreenW, ScreenH);
            body.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);   // 中を押しても閉じない（閉じるのは「戻る」か枠の外）

            // 見出し（戦闘の名前）
            var head = Place(NewRect("Head", body), 82, 14, 300, 30);
            var headBg = head.gameObject.AddComponent<Image>();
            headBg.sprite = StopsSprite((0f, Hex("#381547", 0.9f)), (0.6f, Hex("#1a0f2a", 0.7f)), (1f, Hex("#070811", 0f)));
            Place(NewRect("Edge", head), 0, 1, 2, 28).gameObject.AddComponent<Image>().color = Hex("#d6a740");
            Place(NewRect("Rule", head), 0, 29, 300, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.35f);
            Label(head, "BATTLE STATUS", 12, 4, 120, 9, 6.5f, Hex("#d6a740", 0.62f));
            statusTitle = Label(head, "Title", 12, 12, 280, 16, 13, Hex("#efd081"), FontStyle.Bold);

            // 左: 条件
            StatusHeading(body, "勝利条件", 100, 60);
            statusVictory = StatusPanel(body, "Victory", 100, 82);
            StatusHeading(body, "敗北条件", 100, 124);
            statusDefeat = StatusPanel(body, "Defeat", 100, 146);
            statusAllies = StatusChip(body, "自軍", 100, 192, Hex("#4d8cff"));
            statusEnemies = StatusChip(body, "敵軍", 258, 192, Hex("#e0483c"));
            statusOthers = StatusChip(body, "友軍", 100, 222, Hex("#59c47a"));
            statusTurn = StatusChip(body, "ターン", 258, 222, Hex("#d6a740"));
            StatusHeading(body, "敵の行動予告", 100, 258);
            // 行動予告の一覧: 盤面の上でも読めるよう、暗い板を敷いて大きくする（レビュー 2026-09-28 F3）
            Framed(Place(NewRect("TargetsPanel", body), 100, 280, 300, 70), "panel_even", 7f);
            statusTargets = Label(body, "Targets", 114, 287, 276, 58, 11, Hex("#f1e2bb"));
            statusTargets.alignment = TextAnchor.UpperLeft;
            statusTargets.verticalOverflow = VerticalWrapMode.Truncate;
            statusTargets.horizontalOverflow = HorizontalWrapMode.Wrap;
            statusTargets.lineSpacing = 1.2f;

            // 右: マップ表
            statusMapPanel = Place(NewRect("MapPanel", body), 430, 44, 330, 290);
            var mapPanel = statusMapPanel;
            Framed(mapPanel, "panel_even", 7f);
            statusMapArea = Place(NewRect("MapArea", mapPanel), 14, 14, 302, 262);
            statusMap = NewRect("Picture", statusMapArea).gameObject.AddComponent<RawImage>();
            statusMap.raycastTarget = false;
            statusMap.rectTransform.anchorMin = statusMap.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            statusMap.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            Outline(statusMap.rectTransform, Hex("#c8922a", 0.45f));

            var close = FrameButton(body, "Close", 666, 356, 94, 25, "button_b2_normal", "button_b2_pressed", 12f, "back", "戻る", 9.5f, Hex("#ecd28e", 0.92f), out _, out _);
            close.onClick.AddListener(CloseStatus);
            statusRoot.gameObject.SetActive(false);
        }

        private void StatusHeading(RectTransform parent, string text, float x, float y)
        {
            var band = Place(NewRect("Heading_" + text, parent), x, y, 300, 18);
            var bg = band.gameObject.AddComponent<Image>();
            bg.sprite = StopsSprite((0f, Hex("#381547", 0f)), (0.2f, Hex("#381547", 0.85f)), (0.8f, Hex("#381547", 0.85f)), (1f, Hex("#381547", 0f)));
            bg.raycastTarget = false;
            Place(NewRect("Top", band), 30, 0, 240, 1).gameObject.AddComponent<Image>().color = Hex("#d6a740", 0.55f);
            Place(NewRect("Bottom", band), 30, 17, 240, 1).gameObject.AddComponent<Image>().color = Hex("#d6a740", 0.55f);
            float half = text.Length * 11f * 0.55f + 12f;   // 文字の幅に合わせて左右に菱形
            Diamond(band, 150 - half - 6, 6, 6, Hex("#d6a740"));
            Diamond(band, 150 + half, 6, 6, Hex("#d6a740"));
            Label(band, text, 0, 0, 300, 18, 11, Hex("#efd081"), FontStyle.Bold, TextAnchor.MiddleCenter);
        }

        private Text StatusPanel(RectTransform parent, string name, float x, float y)
        {
            var panel = Place(NewRect("Panel_" + name, parent), x, y, 300, 34);
            Framed(panel, "panel_even", 7f);
            return Label(panel, name, 0, 0, 300, 34, 11, Ivory, anchor: TextAnchor.MiddleCenter);
        }

        private Text StatusChip(RectTransform parent, string label, float x, float y, Color mark)
        {
            var chip = Place(NewRect("Chip_" + label, parent), x, y, 142, 24);
            var bg = chip.gameObject.AddComponent<Image>();
            bg.sprite = StopsSprite((0f, Hex("#1a0f2a", 0.9f)), (1f, Hex("#1a0f2a", 0.2f)));
            Place(NewRect("Rule", chip), 0, 23, 142, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.3f);
            Diamond(chip, 8, 8, 8, mark);
            Label(chip, label, 24, 0, 60, 24, 10, Hex("#e8d5a4"));
            return Label(chip, label + "Value", 80, 0, 56, 24, 13, Hex("#efd081"), FontStyle.Bold, TextAnchor.MiddleRight);
        }

        /// <summary>戦況の画面を開く（マップ表を撮り直す）</summary>
        public void OpenStatus()
        {
            if (!Built) return;
            statusOpen = true;
            statusRoot.gameObject.SetActive(true);
            frame.gameObject.SetActive(false);        // ふだんのUIとキャラの下のHPは隠す
            overlayRoot.gameObject.SetActive(false);
            statusRoot.SetAsLastSibling();
            FillStatus();
            stateKey = null;
        }

        public void CloseStatus()
        {
            statusOpen = false;
            if (statusRoot != null) statusRoot.gameObject.SetActive(false);
            if (frame != null) frame.gameObject.SetActive(true);
            if (overlayRoot != null) overlayRoot.gameObject.SetActive(true);
            stateKey = null;
        }

        private void FillStatus()
        {
            statusTitle.text = controller.BattleTitle;
            statusVictory.text = controller.VictoryText;
            statusDefeat.text = controller.DefeatText;
            statusAllies.text = controller.Units.Count(u => u.Side == "ally" && u.Alive).ToString();
            statusEnemies.text = controller.Units.Count(u => u.Side == "enemy" && u.Alive).ToString();
            statusOthers.text = controller.Units.Count(u => u.Side != "ally" && u.Side != "enemy" && u.Alive).ToString();
            statusTurn.text = controller.Turn.ToString();
            var lines = controller.Declarations
                .Where(p => p.Value.type == "attack")
                .Select(p => (enemy: controller.Units.FirstOrDefault(u => u.Id == p.Key), target: controller.Units.FirstOrDefault(u => u.Id == p.Value.targetId)))
                .Where(p => p.enemy != null && p.target != null)
                .Select(p => $"{p.enemy.Name}　→　{p.target.Name}")
                .ToList();
            statusTargets.text = lines.Count > 0 ? string.Join("\n", lines) : "なし";

            // マップ表: 盤面を真上から撮った絵を、欄に収まる大きさで置く
            var map = controller.View.Map;
            var picture = controller.View.RenderMapPicture(40, canvas);
            statusMap.texture = picture;
            // 欄の横幅に合わせて大きさを決め、枠の高さをマップ表に合わせる（縦長のマップなら高さに合わせる）
            float cell = Mathf.Min(302f / map.Columns, 262f / map.Rows);
            var size = new Vector2(cell * map.Columns, cell * map.Rows);
            statusMapPanel.sizeDelta = new Vector2(330, size.y + 28);
            statusMapArea.sizeDelta = new Vector2(302, size.y);
            statusMap.rectTransform.sizeDelta = size;
            statusMap.rectTransform.anchoredPosition = Vector2.zero;

            // 陣営の印（味方＝青・敵＝赤）
            foreach (var mark in statusMarks) Object.DestroyImmediate(mark);
            statusMarks.Clear();
            foreach (var unit in controller.Units.Where(u => u.Alive))
            {
                var m = NewRect("Mark_" + unit.Id, statusMap.rectTransform);
                m.anchorMin = m.anchorMax = new Vector2(0f, 1f);
                m.pivot = new Vector2(0.5f, 0.5f);
                m.sizeDelta = new Vector2(cell * 0.62f, cell * 0.62f);
                m.anchoredPosition = new Vector2((unit.cell.x + 0.5f) * cell, -(unit.cell.y + 0.5f) * cell);
                var img = m.gameObject.AddComponent<Image>();
                img.color = unit.Side == "ally" ? Hex("#3f7ee0") : unit.Side == "enemy" ? Hex("#c9463c") : Hex("#4fae6a");
                img.raycastTarget = false;
                Outline(m, Hex("#f3e2b6", 0.85f));
                if (unit.Side == "enemy" && controller.Declarations.TryGetValue(unit.Id, out var d) && d.type == "attack")
                {
                    var x = Place(NewRect("Intent", m), cell * 0.36f, -cell * 0.14f, cell * 0.4f, cell * 0.4f).gameObject.AddComponent<Image>();
                    x.sprite = SpriteOf("mark_intent");
                    x.raycastTarget = false;
                }
                statusMarks.Add(m.gameObject);
            }
        }

        // 右の欄の位置（右端からの距離・上から）。人物欄とコマンドは同じ場所
        private const float PanelRight = 6f, PanelTop = 58f, PanelW = 184f;

        /// <summary>画面の右端から決める（right＝右端からの距離）</summary>
        private static RectTransform PlaceFromRight(RectTransform rt, float right, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(1f, 1f);
            rt.pivot = new Vector2(1f, 1f);
            rt.anchoredPosition = new Vector2(-right, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        /// <summary>銀の枠（仮の素材 silver_frame）とチャコールの下地</summary>
        private void SilverBox(RectTransform rt, float inset = 4f, float outset = 4f, float width = 13f, bool opaque = false)
        {
            var back = NewRect("Back", rt);
            Stretch(back);
            back.offsetMin = new Vector2(inset, inset);
            back.offsetMax = new Vector2(-inset, -inset);
            var panelColor = HudPalette.Panel;
            if (opaque) panelColor.a = 1f;   // 戦闘予測の帯: 不透明（少し透ける色は撮影の画像でほとんど透明に写るため）
            back.gameObject.AddComponent<Image>().color = panelColor;
            var border = NewRect("Frame", rt);
            Stretch(border);
            border.offsetMin = new Vector2(-outset, -outset);
            border.offsetMax = new Vector2(outset, outset);
            Framed(border, "silver_frame", width).raycastTarget = false;
        }

        private static bool IsTargetingMode(Battle3DController.Mode mode) =>
            mode == Battle3DController.Mode.Targeting || mode == Battle3DController.Mode.Support
            || mode == Battle3DController.Mode.Summon || mode == Battle3DController.Mode.Trade;

        /// <summary>
        /// 右の人物欄（銀細工のUI 第3段。ブラウザ版 renderSilverPerson と同じ並び・同じ寸法）:
        /// 顔・名前・Lv・兵種・HP/MP ／ 移動・射程と能力値 ／ 武器 ／ 固有スキル（文）／ 残りのスキル・戦技（アイコン。押すと説明）／ 行動する
        /// </summary>
        private void BuildPersonPanel()
        {
            personPanel = PlaceFromRight(NewRect("Person", frame), PanelRight, PanelTop, PanelW, 300);
            SilverBox(personPanel);
            var mask = Place(NewRect("FaceMask", personPanel), 4, 4, 76, 98);
            mask.gameObject.AddComponent<RectMask2D>();
            personFace = Place(NewRect("Face", mask), 3, 3, 72, 95).gameObject.AddComponent<RawImage>();
            personFace.raycastTarget = false;
            personName = Label(personPanel, "Name", 81, 10, 96, 17, 14, HudPalette.Text, FontStyle.Bold);
            personLevel = Label(personPanel, "Level", 81, 27, 96, 12, 9.5f, HudPalette.Silver, anchor: TextAnchor.MiddleRight);
            Place(NewRect("JobTop", personPanel), 81, 40, 96, 1).gameObject.AddComponent<Image>().color = Hex("#81939e");
            personWeaponIcon = Place(NewRect("JobIcon", personPanel), 82, 43, 12, 12).gameObject.AddComponent<Image>();
            personWeaponIcon.preserveAspect = true;
            personClass = Label(personPanel, "Class", 97, 41, 80, 15, 9.5f, HudPalette.Text);
            Place(NewRect("JobBottom", personPanel), 81, 56, 96, 1).gameObject.AddComponent<Image>().color = Hex("#81939e");
            personHp = Label(personPanel, "Hp", 79, 59, 98, 13, 12.5f, HudPalette.Text, anchor: TextAnchor.MiddleRight);
            Label(personPanel, "HP", 79, 59, 30, 13, 8.7f, HudPalette.Silver);
            personHpFill = Meter(personPanel, 79, 73, Hex("#64c6c3"));
            personMp = Label(personPanel, "Mp", 79, 79, 98, 13, 12.5f, HudPalette.Text, anchor: TextAnchor.MiddleRight);
            Label(personPanel, "MP", 79, 79, 30, 13, 8.7f, HudPalette.Silver);
            personMpFill = Meter(personPanel, 79, 93, Hex("#8ba4c8"));
            Place(NewRect("Rule1", personPanel), 15, 101, 154, 1).gameObject.AddComponent<Image>().color = Hex("#697b87");
            // 移動・射程と能力値
            Label(personPanel, "移動", 15, 106, 40, 12, 10.5f, HudPalette.Silver);
            personMove = Label(personPanel, "Move", 50, 106, 30, 12, 10.5f, HudPalette.Text, anchor: TextAnchor.MiddleRight);
            Label(personPanel, "射程", 15, 118, 40, 12, 10.5f, HudPalette.Silver);
            personRange = Label(personPanel, "Range", 40, 118, 40, 12, 10.5f, HudPalette.Text, anchor: TextAnchor.MiddleRight);
            Label(personPanel, "命中", 15, 130, 40, 12, 10.5f, HudPalette.Silver);
            personHit = Label(personPanel, "Hit", 40, 130, 40, 12, 10.5f, HudPalette.Text, anchor: TextAnchor.MiddleRight);
            Label(personPanel, "回避", 15, 142, 40, 12, 10.5f, HudPalette.Silver);
            personEvade = Label(personPanel, "Evade", 40, 142, 40, 12, 10.5f, HudPalette.Text, anchor: TextAnchor.MiddleRight);
            personState = Label(personPanel, "State", 15, 156, 66, 22, 8.5f, HudPalette.Muted, anchor: TextAnchor.UpperLeft);
            Place(NewRect("Divider", personPanel), 86, 106, 1, 84).gameObject.AddComponent<Image>().color = Hex("#627a88");
            string[] names = { "力", "魔攻", "技", "速さ", "防御", "魔防", "魅力" };
            for (int i = 0; i < names.Length; i++)
            {
                Label(personPanel, names[i], 94, 106 + i * 12f, 40, 12, 10.5f, HudPalette.Silver);
                personStats[i] = Label(personPanel, "Stat" + i, 129, 106 + i * 12f, 40, 12, 10.5f, HudPalette.Text, anchor: TextAnchor.MiddleRight);
            }
            Place(NewRect("Rule2", personPanel), 15, 192, 154, 1).gameObject.AddComponent<Image>().color = Hex("#81939e");
            // 武器
            var weaponIconRect = Place(NewRect("WeaponIcon", personPanel), 15, 198, 13, 13);
            weaponIconRect.gameObject.AddComponent<Image>().preserveAspect = true;
            personWeapon = Label(personPanel, "Weapon", 33, 193, 100, 24, 11, HudPalette.Text);
            personDurability = Label(personPanel, "Durability", 110, 193, 59, 24, 8.5f, HudPalette.Muted, anchor: TextAnchor.MiddleRight);
            Place(NewRect("Rule3", personPanel), 15, 217, 154, 1).gameObject.AddComponent<Image>().color = Hex("#81939e");
            // 固有スキル（押すと説明）
            personSkillRow = Place(NewRect("PersonalSkill", personPanel), 15, 221, 154, 36);
            personSkillRow.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            personSkillRow.gameObject.AddComponent<Button>().transition = Selectable.Transition.None;
            personSkillName = Label(personSkillRow, "Name", 30, 0, 124, 13, 11, HudPalette.Text);
            personSkillDesc = Label(personSkillRow, "Desc", 30, 13, 124, 24, 8.3f, HudPalette.Muted, anchor: TextAnchor.UpperLeft);
            personSkillName.raycastTarget = personSkillDesc.raycastTarget = false;
            personSkillDesc.horizontalOverflow = HorizontalWrapMode.Wrap;   // 説明は2行まで折り返す
            personSkillDesc.verticalOverflow = VerticalWrapMode.Truncate;
            personSkillDesc.lineSpacing = 0.95f;
            personIconRow = Place(NewRect("Icons", personPanel), 15, 252, 154, 22);
            // 行動する（コマンドへ）
            personAct = Place(NewRect("Act", personPanel), 15, 270, 154, 22);
            personAct.gameObject.AddComponent<Image>().color = Hex("#183c50", 0.85f);
            var actLine = personAct.gameObject.AddComponent<Outline>();
            actLine.effectColor = Hex("#7a989f");
            actLine.effectDistance = new Vector2(1f, -1f);
            var actButton = personAct.gameObject.AddComponent<Button>();
            actButton.transition = Selectable.Transition.None;
            actButton.onClick.AddListener(() => { panelMode = "commands"; stateKey = null; Refresh(); });
            var actIcon = Place(NewRect("Icon", personAct), 52, 5, 12, 12).gameObject.AddComponent<Image>();
            actIcon.sprite = SpriteOf("icon_wait");
            actIcon.preserveAspect = true;
            actIcon.raycastTarget = false;
            Label(personAct, "行動する", 68, 0, 70, 22, 10.5f, HudPalette.Text).raycastTarget = false;
        }

        /// <summary>細いメーター（HP・MP）</summary>
        private Image Meter(RectTransform parent, float x, float y, Color color)
        {
            var bar = Place(NewRect("Meter", parent), x, y, 98, 4);
            bar.gameObject.AddComponent<Image>().color = Hex("#46515e");
            var fill = NewRect("Fill", bar).gameObject.AddComponent<Image>();
            fill.color = color;
            return fill;
        }

        /// <summary>スキル・戦技のアイコン（枠つき。ブラウザ版 abilityIconHtml と同じ: 絵＋枠。絵がなければ枠だけ）</summary>
        private RectTransform SkillIcon(RectTransform parent, float x, float y, float size, string name, string kind)
        {
            var root = Place(NewRect("Skill_" + name, parent), x, y, size, size);
            var art = Place(NewRect("Art", root), 0, 0, size, size).gameObject.AddComponent<Image>();
            art.sprite = SpriteOf("skill_" + name);
            art.preserveAspect = true;
            art.enabled = art.sprite != null;
            art.raycastTarget = false;
            var edge = Place(NewRect("Frame", root), 0, 0, size, size).gameObject.AddComponent<Image>();
            edge.sprite = SpriteOf("skill_frame_" + (string.IsNullOrEmpty(kind) ? "passive" : kind));
            edge.preserveAspect = true;
            edge.enabled = edge.sprite != null;
            edge.raycastTarget = false;
            return root;
        }

        private void FillPerson(Battle3DController.UnitState unit, bool canAct)
        {
            uiUnits.TryGetValue(unit.Id, out var ui);
            var face = ui != null ? portraits.FirstOrDefault(p => p.name == ui.portrait + "_card").texture : null;
            if (face != null) { personFace.texture = face; personFace.enabled = true; personFace.uvRect = new Rect(0, 0, 1, 1); }
            else SetPortrait(personFace, ui, ui?.cardUv);
            personName.text = unit.Name;
            personLevel.text = ui?.levelLabel ?? "";
            personClass.text = string.IsNullOrEmpty(ui?.className) ? "―" : ui.className;
            personWeaponIcon.sprite = WeaponSprite(ui?.weaponType);
            personWeaponIcon.enabled = personWeaponIcon.sprite != null;
            int hp = unit.plan?.hp ?? 0, maxHp = Math.Max(1, unit.plan?.maxHp ?? 1);
            int mp = unit.plan?.mp ?? 0, maxMp = Math.Max(1, ui?.maxMp ?? Math.Max(mp, 1));
            personHp.text = $"{hp}<size=8><color=#a6b7bd>/{maxHp}</color></size>";
            personMp.text = $"{mp}<size=8><color=#a6b7bd>/{ui?.maxMp ?? mp}</color></size>";
            SetBar(personHpFill.rectTransform, (float)hp / maxHp);
            SetBar(personMpFill.rectTransform, (float)mp / maxMp);
            personMove.text = unit.source.move.ToString();
            personRange.text = ui?.weaponRange ?? "―";
            personState.text = ui?.statusText ?? "";
            var st = unit.plan?.stats;
            int[] values = st == null ? null : new[] { st.atk, st.mag, st.tec, st.spd, st.def, st.res, st.cha };
            personHit.text = ui != null ? ui.hit.ToString() : "―";
            personEvade.text = ui != null ? ui.evade.ToString() : "―";
            for (int i = 0; i < personStats.Length; i++) personStats[i].text = values == null ? "―" : values[i].ToString();
            var weaponIconImage = personPanel.Find("WeaponIcon").GetComponent<Image>();
            weaponIconImage.sprite = WeaponSprite(ui?.weaponType) ?? SpriteOf("icon_attack");
            personWeapon.text = ui?.weaponName ?? "装備なし";
            personDurability.text = string.IsNullOrEmpty(ui?.weaponType) ? "反撃できません" : "";
            string equipped = unit.plan?.equippedItem;
            if (!string.IsNullOrEmpty(equipped) && BattlePlan.Items.TryGetValue(equipped, out var equippedItem) && equippedItem.kind == "grimoire")
                personDurability.text = $"耐久 {Battle3DController.StaffDurability(unit, equipped)}/{equippedItem.durability}";
            // 固有スキル
            var personal = ui?.personal;
            bool hasPersonal = personal != null && !string.IsNullOrEmpty(personal.name);
            personSkillRow.gameObject.SetActive(hasPersonal);
            foreach (var child in personSkillRow.Cast<Transform>().Where(c => c.name.StartsWith("Skill_")).ToList()) Object.DestroyImmediate(child.gameObject);
            if (hasPersonal)
            {
                SkillIcon(personSkillRow, 0, 3, 24, personal.name, "personal").name = "Skill_icon";
                personSkillName.text = personal.name;
                personSkillDesc.text = personal.desc;
                var button = personSkillRow.GetComponent<Button>();
                button.onClick.RemoveAllListeners();
                button.onClick.AddListener(() => OpenSkillInfo(personal));
            }
            // 残りのスキル・戦技（アイコン。7つで折り返す）
            foreach (var item in personIconItems) Object.DestroyImmediate(item);
            personIconItems.Clear();
            var skills = ui?.skills ?? Array.Empty<UiSkill>();
            float rowY = hasPersonal ? 260 : 223;
            for (int i = 0; i < skills.Length; i++)
            {
                var skill = skills[i];
                var icon = SkillIcon(personPanel, 15 + (i % 7) * 22.5f, rowY + (i / 7) * 23, 21, skill.name, skill.kind);
                var hit = icon.gameObject.AddComponent<Image>();
                hit.color = new Color(0, 0, 0, 0);
                var button = icon.gameObject.AddComponent<Button>();
                button.transition = Selectable.Transition.None;
                button.onClick.AddListener(() => OpenSkillInfo(skill));
                personIconItems.Add(icon.gameObject);
            }
            float bottom = rowY + (skills.Length == 0 ? 0 : ((skills.Length - 1) / 7 + 1) * 23);
            personAct.gameObject.SetActive(canAct);
            personAct.anchoredPosition = new Vector2(15f, -(bottom + 2f));
            personPanel.sizeDelta = new Vector2(PanelW, bottom + (canAct ? 30f : 6f) + 4f);
        }

        /// <summary>スキルの説明の窓（人物欄のアイコンを押したとき）。どこを押しても閉じる</summary>
        private void BuildSkillInfo()
        {
            skillInfo = NewRect("SkillInfo", canvas.transform);
            Stretch(skillInfo);
            skillInfo.gameObject.AddComponent<Image>().color = new Color(0.02f, 0.04f, 0.06f, 0.45f);
            var close = skillInfo.gameObject.AddComponent<Button>();
            close.transition = Selectable.Transition.None;
            close.onClick.AddListener(() => skillInfo.gameObject.SetActive(false));
            var card = NewRect("Card", skillInfo);
            card.anchorMin = card.anchorMax = card.pivot = new Vector2(0.5f, 0.5f);
            card.sizeDelta = new Vector2(270f, 70f);
            SilverBox(card);
            skillInfoIcon = Place(NewRect("IconSlot", card), 12, 14, 34, 34);
            skillInfoKind = Label(card, "Kind", 56, 8, 200, 11, 8.5f, HudPalette.Teal);
            skillInfoName = Label(card, "Name", 56, 18, 200, 16, 13, HudPalette.Text, FontStyle.Bold);
            skillInfoDesc = Label(card, "Desc", 56, 35, 204, 30, 10, HudPalette.Silver, anchor: TextAnchor.UpperLeft);
            skillInfoDesc.horizontalOverflow = HorizontalWrapMode.Wrap;
            foreach (var g in card.GetComponentsInChildren<Graphic>(true)) g.raycastTarget = false;
            skillInfo.gameObject.SetActive(false);
        }

        public void OpenSkillInfo(UiSkill skill)
        {
            if (skillInfo == null || skill == null) return;
            foreach (var child in skillInfoIcon.Cast<Transform>().ToList()) Object.DestroyImmediate(child.gameObject);
            SkillIcon(skillInfoIcon, 0, 0, 34, skill.name, skill.kind);
            skillInfoKind.text = skill.kind == "personal" ? "個人スキル" : skill.kind == "active" ? "戦技" : "スキル";
            skillInfoName.text = skill.name;
            skillInfoDesc.text = string.IsNullOrEmpty(skill.desc) ? "説明はまだありません" : skill.desc;
            skillInfo.SetAsLastSibling();
            skillInfo.gameObject.SetActive(true);
        }

        private void BuildCommandList()
        {
            commandList = PlaceFromRight(NewRect("Commands", frame), PanelRight, PanelTop, 118, 75);
            Framed(commandList, "panel_even", 7f);
        }

        /// <summary>手引きの帯（訓練の戦闘。原作者 2026-09-28: 台詞＋画面の帯）。上の帯の下、真ん中に金の縁で出す</summary>
        private void BuildGuide()
        {
            guideBar = PlaceCenter(NewRect("Guide", frame), 140, 42, 490, 30);
            var bg = guideBar.gameObject.AddComponent<Image>();
            bg.sprite = StopsSprite((0f, Hex("#381547", 0.96f)), (0.7f, Hex("#140b1f", 0.93f)), (1f, Hex("#140b1f", 0.72f)));
            bg.raycastTarget = false;
            Place(NewRect("RuleTop", guideBar), 0, 0, 490, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.6f);
            Place(NewRect("RuleBottom", guideBar), 0, 29, 490, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.6f);
            Diamond(guideBar, 10, 11, 7, Hex("#d6a740"));
            guideText = Label(guideBar, "Text", 24, 1, 460, 28, 10, Hex("#efd081"), FontStyle.Bold);
            guideText.horizontalOverflow = HorizontalWrapMode.Wrap;
            guideText.resizeTextForBestFit = true;
            guideText.resizeTextMinSize = 7;
            guideText.resizeTextMaxSize = 10;
            guideBar.gameObject.SetActive(false);
        }

        private void BuildHint()
        {
            hintBar = PlaceWide(NewRect("Hint", frame), 82, 369, 680, 14);
            var bg = hintBar.gameObject.AddComponent<Image>();
            bg.sprite = GradientSprite(new Color(7 / 255f, 8 / 255f, 17 / 255f, 0.78f), new Color(7 / 255f, 8 / 255f, 17 / 255f, 0f));
            var edge = Place(NewRect("Edge", hintBar), 0, 0, 2, 14);
            edge.gameObject.AddComponent<Image>().color = Hex("#d6a740", 0.55f);
            hintText = Label(hintBar, "Text", 10, 0, 660, 14, 9, Hex("#e8d5a4", 0.78f));
        }

        /// <summary>
        /// 戦闘予測（銀細工のUI 第4段。ブラウザ版の [silver-forecast] と同じ寸法）: 左上の見出し、下の大きな帯（左右の端まで）、
        /// 帯から少しはみ出す肖像、左右の数値、中央の交戦の印、帯のすぐ下のボタン。数値は今までどおり BattlePlan から
        /// </summary>
        private void BuildForecast()
        {
            forecastRoot = NewRect("Forecast", frame);
            Stretch(forecastRoot);

            // 帯の下（ボタンの後ろ）の暗い地
            var strip = NewRect("Strip", forecastRoot);
            strip.anchorMin = new Vector2(0f, 0f);
            strip.anchorMax = new Vector2(1f, 0f);
            strip.pivot = new Vector2(0.5f, 0f);
            strip.sizeDelta = new Vector2(0f, ScreenH - 339f);
            var stripImage = strip.gameObject.AddComponent<Image>();
            // 不透明にする（少し透ける色は、撮影の画像でほとんど透明に写るため。見本の 0.92 とほぼ同じ見え方）
            stripImage.color = new Color(10 / 255f, 20 / 255f, 29 / 255f, 1f);
            stripImage.raycastTarget = false;
            fcStrip = strip;

            // 左上の見出し「戦闘予測」と、その下の飾り
            var title = Place(NewRect("Title", forecastRoot), 6, 5, 162, 42);
            var titleBg = title.gameObject.AddComponent<Image>();
            titleBg.color = new Color(9 / 255f, 20 / 255f, 30 / 255f, 0.7f);
            titleBg.raycastTarget = false;
            fcTitle = Label(title, "Text", 39, 2, 123, 30, 20, HudPalette.Text);
            var flourish = SpriteImage(title, "heading_flourish", 0, 27, 165, 29, preserve: false);
            flourish.color = new Color(0.86f, 0.9f, 0.93f, 1f);

            // 下の帯
            var panel = NewRect("Panel", forecastRoot);
            panel.anchorMin = new Vector2(0f, 0f);
            panel.anchorMax = new Vector2(1f, 0f);
            panel.pivot = new Vector2(0.5f, 0f);
            panel.offsetMin = new Vector2(4f, 49f);
            panel.offsetMax = new Vector2(-4f, 49f + 123f);
            fcPanel = panel;
            SilverBox(panel, 10f, 0f, 30f, opaque: true);
            leftBust = Bust(panel, "BustLeft", false);
            rightBust = Bust(panel, "BustRight", true);
            leftSide = Side(panel, "SideLeft", 168);
            rightSide = Side(panel, "SideRight", 168);
            var emblem = NewRect("Emblem", panel);
            emblem.anchorMin = emblem.anchorMax = new Vector2(0.5f, 1f);
            emblem.pivot = new Vector2(0.5f, 1f);
            emblem.anchoredPosition = new Vector2(0f, -12.5f);
            emblem.sizeDelta = new Vector2(42f, 104f);
            var emblemImage = emblem.gameObject.AddComponent<Image>();
            emblemImage.sprite = SpriteOf("fc_emblem_sword");
            emblemImage.color = new Color(0.9f, 0.95f, 1f, 1f);
            emblemImage.raycastTarget = false;

            // 攻める側の技の付け足し（MPの消費・封じ・状態）。帯の左の上に1行
            fcExtraBox = Place(NewRect("Extra", forecastRoot), 176, 199, 300, 16);
            var extraBg = fcExtraBox.gameObject.AddComponent<Image>();
            var extraColor = new Color(9 / 255f, 20 / 255f, 30 / 255f, 1f);
            extraBg.sprite = GradientSprite(extraColor, extraColor, 0.85f, 1f, 0.97f, 0f);
            extraBg.raycastTarget = false;
            fcExtra = Label(fcExtraBox, "Text", 8, 0, 290, 16, 9.5f, HudPalette.Silver);

            // 戦闘詳細（反撃・スキルの効果）
            fcDetailBox = PlaceCenter(NewRect("Detail", forecastRoot), 272, 168, 300, 40);
            SilverBox(fcDetailBox);
            fcDetailText = Label(fcDetailBox, "Text", 10, 6, 280, 28, 8.5f, HudPalette.Silver);
            fcDetailText.alignment = TextAnchor.UpperLeft;
            fcDetailText.horizontalOverflow = HorizontalWrapMode.Wrap;
            fcDetailBox.gameObject.SetActive(false);

            // 下のボタン（見本の銀のボタン。仮の素材 silver_button_filled）: キャンセル・攻撃する・戦闘詳細。幅は 1 : 1.3 : 1、間は 10
            fcCancel = SilverButton(forecastRoot, "Cancel", 169f, 147.3f, "back", "キャンセル", 14f, HudPalette.Text, out _, out _);
            fcConfirm = SilverButton(forecastRoot, "Confirm", 326.3f, 191.5f, "cross", "攻撃する", 18f, Hex("#c1eeed"), out fcConfirmLabel, out fcConfirmIcon);
            fcDetail = SilverButton(forecastRoot, "DetailButton", 527.8f, 147.3f, "detail", "戦闘詳細", 14f, HudPalette.Text, out _, out _);
            fcCancel.onClick.AddListener(() => controller.CancelForecast());
            fcConfirm.onClick.AddListener(() => controller.ConfirmAttack());
            fcDetail.onClick.AddListener(() => fcDetailBox.gameObject.SetActive(!fcDetailBox.gameObject.activeSelf));
        }

        /// <summary>銀のボタン（見本の .action）。x・幅は 844 の画面の左からの位置（画面の真ん中から決める）。上は 339、高さ 39</summary>
        private Button SilverButton(RectTransform parent, string name, float x, float w, string icon, string label, float size, Color color, out Text text, out Image iconImage)
        {
            var rt = PlaceCenter(NewRect(name, parent), x, 339f, w, 39f);
            rt.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var art = NewRect("Art", rt);
            art.anchorMin = art.anchorMax = art.pivot = new Vector2(0.5f, 0.5f);
            art.sizeDelta = new Vector2(w, 39f * 2.1f);
            var artImage = art.gameObject.AddComponent<Image>();
            artImage.sprite = SpriteOf("silver_button_filled");
            artImage.raycastTarget = false;
            var button = rt.gameObject.AddComponent<Button>();
            button.transition = Selectable.Transition.ColorTint;
            button.targetGraphic = artImage;
            var colors = button.colors;
            colors.highlightedColor = new Color(1.25f, 1.25f, 1.25f, 1f);
            colors.pressedColor = new Color(0.85f, 0.85f, 0.85f, 1f);
            colors.colorMultiplier = 1f;
            button.colors = colors;
            float textW = label.Length * size + 4f;
            float iconSize = size + 4f;
            float startX = (w - (iconSize + 9f + textW)) / 2f;
            iconImage = Place(NewRect("Icon", rt), startX, (39f - iconSize) / 2f, iconSize, iconSize).gameObject.AddComponent<Image>();
            iconImage.sprite = SpriteOf("icon_" + icon);
            iconImage.preserveAspect = true;
            iconImage.color = color;
            iconImage.raycastTarget = false;
            text = Label(rt, label, startX + iconSize + 9f, 0, textW + 20f, 39, size, color);
            text.raycastTarget = false;
            return button;
        }

        /// <summary>帯の下にそろえ、上へ少しはみ出す肖像（書き出しで端を薄くした絵 *_bust を使う）。右は向かい合うように左右反転</summary>
        private RawImage Bust(RectTransform panel, string name, bool mirrored)
        {
            var box = NewRect(name, panel);
            box.anchorMin = box.anchorMax = box.pivot = new Vector2(mirrored ? 1f : 0f, 0f);
            box.anchoredPosition = new Vector2(mirrored ? 4f : -4f, 0f);
            box.sizeDelta = new Vector2(175f, 149f);
            var image = NewRect("Image", box).gameObject.AddComponent<RawImage>();
            Stretch(image.rectTransform);
            if (mirrored) image.rectTransform.localScale = new Vector3(-1f, 1f, 1f);
            image.raycastTarget = false;
            return image;
        }

        /// <summary>帯の左右の数値（名前・Lv／武器／HP／ダメージ・命中・必殺）。x は帯の端からの距離（右は右の端から）</summary>
        private ForecastSide Side(RectTransform panel, string name, float x)
        {
            var side = new ForecastSide();
            bool right = name == "SideRight";
            var root = NewRect(name, panel);
            // 真ん中の印の両側に寄せる（原作者 2026-10-02: 真ん中の隙間が広い）。x は使わない
            root.anchorMin = root.anchorMax = new Vector2(0.5f, 1f);
            root.pivot = new Vector2(right ? 0f : 1f, 1f);
            root.anchoredPosition = new Vector2(right ? 42f : -42f, -11f);
            root.sizeDelta = new Vector2(156f, 103f);
            side.name = Label(root, "Name", 0, 0, 112, 17, 13, HudPalette.Text);
            side.level = Label(root, "Level", 96, 1, 60, 16, 9.5f, HudPalette.Silver, anchor: TextAnchor.MiddleRight);
            Place(NewRect("Rule", root), 0, 17, 156, 1).gameObject.AddComponent<Image>().color = Hex("#617583");
            side.weaponIcon = Place(NewRect("Icon", root), 0, 19, 16, 16).gameObject.AddComponent<Image>();
            side.weaponIcon.preserveAspect = true;
            side.weaponIcon.color = HudPalette.Silver;
            side.weapon = Label(root, "Weapon", 20, 18, 100, 18, 11.2f, HudPalette.Text);
            if (!right)
            {
                // 攻撃の切り替え（届く攻撃が2つ以上あるとき。ブラウザ版の ‹ 破壊 1/2 ›）
                fcPrev = TextButton(root, "Prev", 16, 18, 12, 18, "‹");
                fcNext = TextButton(root, "Next", 144, 18, 12, 18, "›");
                fcCount = Label(root, "Count", 110, 18, 32, 18, 8f, HudPalette.Muted, anchor: TextAnchor.MiddleRight);
                fcPrev.onClick.AddListener(() => { controller.CycleForecastOption(-1); stateKey = null; });
                fcNext.onClick.AddListener(() => { controller.CycleForecastOption(1); stateKey = null; });
            }
            side.note = Label(root, "Note", 96, 18, 60, 18, 8f, Hex("#dc8a93"), anchor: TextAnchor.MiddleRight);
            Label(root, "HP", 0, 36, 20, 20, 11, HudPalette.Silver);
            var bar = Place(NewRect("Bar", root), 24, 43, 57, 6);
            bar.gameObject.AddComponent<Image>().color = Hex("#46515e");
            side.hpLost = NewRect("Lost", bar).gameObject.AddComponent<Image>();
            side.hpLost.color = Hex("#d9e1e5", 0.28f);
            side.hpAfter = NewRect("After", bar).gameObject.AddComponent<Image>();
            side.hpValue = Label(root, "HpValue", 84, 36, 72, 20, 15, HudPalette.Text, FontStyle.Normal, TextAnchor.MiddleRight);
            side.hpValue.supportRichText = true;
            Place(NewRect("Rule2", root), 0, 56, 156, 1).gameObject.AddComponent<Image>().color = Hex("#627582");
            side.values = new Text[3];
            string[] labels = { "ダメージ", "命中", "必殺" };
            for (int i = 0; i < 3; i++)
            {
                float y = 58 + i * 13f;
                Label(root, labels[i], 14, y, 60, 13, 12, HudPalette.Silver);
                side.values[i] = Label(root, labels[i] + "Value", 62, y, 90, 13, 12, HudPalette.Text, FontStyle.Normal, TextAnchor.MiddleRight);
            }
            return side;
        }

        // ── 表示を今の状態に合わせる ──

        public void Refresh()
        {
            if (!Built || controller == null || controller.Data == null) return;
            var sel = controller.Selected;
            var tgt = controller.Target;
            string key = $"{statusOpen}|{subList}|{sel?.items.Count}|{controller.Units.Count}|{controller.PendingSummons.Count}|{controller.CurrentOption?.label}|{controller.TransferAlly?.Id}|{controller.TradePartner?.Id}|{controller.TradePartner?.items.Count}|{controller.EnemyPreview?.attacker?.Id}|{controller.CurrentPhase}|{controller.CurrentMode}|{sel?.Id}|{sel?.plan?.hp}|{sel?.plan?.mp}|{sel?.cell}|{tgt?.Id}|{tgt?.plan?.hp}|{controller.Turn}|{controller.Units.Count(u => u.acted)}"
                + $"|{controller.Declarations.Count}|{string.Join(",", controller.Units.Select(u => u.plan?.hp ?? 0))}|{controller.Guide}|{RosterCollapsed}";
            if (key == stateKey) return;
            stateKey = key;

            var preview = controller.EnemyPreview;
            bool forecastOpen = preview != null
                || (controller.CurrentMode == Battle3DController.Mode.Forecast && controller.CurrentForecast != null && sel != null && tgt != null);
            forecastRoot.gameObject.SetActive(forecastOpen);
            if (!forecastOpen) fcDetailBox.gameObject.SetActive(false);
            // 右の欄: 人物欄かコマンドか（ブラウザ版 lsShowCommands と同じ決まり）。味方を選んだらまず人物欄（「行動する」でコマンド）、
            // 移動したら自動でコマンド、相手を選ぶ間・戦技などの一覧もコマンド。コマンドの「人物」で人物欄へ戻る
            var panelModeNow = controller.CurrentMode;
            bool canAct = sel != null && sel.Side == "ally" && !sel.acted && controller.CurrentPhase == Battle3DController.Phase.Ally
                && (panelModeNow == Battle3DController.Mode.Moving || panelModeNow == Battle3DController.Mode.Acting);
            if (sel?.Id != panelUnit) { panelUnit = sel?.Id; panelMode = "person"; }
            if (panelModeNow == Battle3DController.Mode.Acting && lastPanelMode != Battle3DController.Mode.Acting) panelMode = "commands";
            lastPanelMode = panelModeNow;
            bool showPerson = sel != null && !forecastOpen && (canAct ? panelMode == "person" && subList == null : !IsTargetingMode(panelModeNow));
            personPanel.gameObject.SetActive(showPerson);
            if (showPerson) FillPerson(sel, canAct);
            if (preview != null) FillForecast(preview.attacker, preview.target, preview.forecast, preview.option, true);
            else if (forecastOpen) FillForecast(sel, tgt, controller.CurrentForecast, controller.CurrentOption, false);
            FillCommands(forecastOpen);
            if (showPerson) commandList.gameObject.SetActive(false);
            FillTopStrip(forecastOpen);
            FillRoster(forecastOpen);
            hintBar.gameObject.SetActive(!forecastOpen);   // 戦闘予測のときは下のボタンが出る
            hintText.text = HintText(forecastOpen);
            // 手引きの帯: 味方の番で、戦闘予測・戦況の画面を開いていないとき
            bool guide = !string.IsNullOrEmpty(controller.Guide) && !forecastOpen && !statusOpen && controller.CurrentPhase == Battle3DController.Phase.Ally;
            guideBar.gameObject.SetActive(guide);
            if (guide) guideText.text = controller.Guide;
        }

        private void FillTopStrip(bool forecastOpen)
        {
            var phase = controller.CurrentPhase;
            bool ended = phase == Battle3DController.Phase.Victory || phase == Battle3DController.Phase.Defeat;
            bool enemy = phase == Battle3DController.Phase.Enemy;
            // 戦闘予測の間は左上に「戦闘予測」の見出しが出るので、フェーズの見出しを隠す（ブラウザ版と同じ）
            // 戦闘予測の間は、左上に予測の見出しが出るので Chapter の欄を隠す（見本・ブラウザ版と同じ）
            topStrip.gameObject.SetActive(!forecastOpen);
            turnValue.text = controller.Turn.ToString();
            int declarations = controller.Declarations.Count;
            rosterDecl.text = declarations > 0 ? $"予告 {declarations}" : "";
            // フェーズが変わったら演出を出す（ブラウザ版 showPhaseBanner と同じ時: 味方の番・敵の番の始まり、勝ち・負け）
            string bannerKey = ended ? phase.ToString() : $"{phase}:{controller.Turn}";
            // 戦況の画面を開いている間は待ち、閉じてから出す。確認の画像を撮るとき（再生していない）は出さない
            if (bannerKey != bannerShownKey && !statusOpen)
            {
                bannerShownKey = bannerKey;
                if (Application.isPlaying) ShowPhaseBanner(phase == Battle3DController.Phase.Victory ? "victory" : phase == Battle3DController.Phase.Defeat ? "defeat" : enemy ? "enemy" : "ally");
            }
        }

        private void FillRoster(bool forecastOpen)
        {
            if (controller.Units.Count(u => u.Side == "ally") != rosterSlots.Count)
            {
                Object.DestroyImmediate(roster.gameObject);
                BuildRoster();
                roster.SetSiblingIndex(1);
            }
            bool collapsed = RosterCollapsed;
            // 戦闘予測の間も出す（見本）。見出しの下から、顔の一覧は2人分弱の高さにして中だけスクロール（帯・肖像と重ならない）
            float listH = rosterSlots.Count * RosterStep;
            float viewH = collapsed ? 0f : forecastOpen ? Math.Min(56f, listH) : listH;
            roster.gameObject.SetActive(true);
            Place(roster, RosterX, forecastOpen ? 50f : RosterY, RosterW, RosterHead + viewH + (viewH > 0f ? 4f : 0f));
            rosterView.sizeDelta = new Vector2(RosterW, viewH);
            rosterFaces.sizeDelta = new Vector2(RosterW, listH);
            rosterChevron.localEulerAngles = new Vector3(0f, 0f, collapsed ? 180f : 0f);
            foreach (var slot in rosterSlots)
            {
                slot.root.gameObject.SetActive(!collapsed);
                var unit = controller.Units.FirstOrDefault(u => u.Id == slot.id);
                if (unit == null) continue;
                bool dead = !unit.Alive;
                bool done = !dead && unit.acted;
                bool selectedNow = controller.Selected == unit;
                slot.frame.GetComponent<Outline>().effectColor = selectedNow ? Hex("#e0f6fc") : Hex("#62717d");
                slot.face.color = dead || done ? new Color(0.32f, 0.3f, 0.34f, 1f) : Color.white;
                slot.done.gameObject.SetActive(done);
                SetBar(slot.hpFill.rectTransform, unit.plan == null ? 0f : (float)unit.plan.hp / Math.Max(1, unit.plan.maxHp));
                var group = slot.frame.transform.parent.GetComponent<CanvasGroup>();
                if (group == null) group = slot.frame.transform.parent.gameObject.AddComponent<CanvasGroup>();
                group.alpha = dead ? 0.28f : 1f;
            }
        }

        private void FillForecast(Battle3DController.UnitState attacker, Battle3DController.UnitState defender, BattlePlan.Forecast fc, BattleOption option, bool readOnly)
        {
            bool magic = option != null ? option.isMagic : attacker.plan.HasGrimoireSpell;
            bool special = option != null && (option.isArt || option.isMagic);
            // 敵の攻撃の前の予測は見るだけ（ボタンなし・見出しは赤。ブラウザ版の「敵の攻撃」）
            fcTitle.text = readOnly ? "敵の攻撃" : "戦闘予測";
            fcTitle.color = readOnly ? Hex("#e9a99b") : HudPalette.Text;
            fcCancel.gameObject.SetActive(!readOnly);
            fcConfirm.gameObject.SetActive(!readOnly);
            fcDetail.gameObject.SetActive(!readOnly);
            uiUnits.TryGetValue(attacker.Id, out var a);
            uiUnits.TryGetValue(defender.Id, out var d);
            SetBust(leftBust, a);
            SetBust(rightBust, d);
            fcStrip.gameObject.SetActive(!readOnly);   // 敵の攻撃の予測（見るだけ）はボタンがないので、帯の下の暗い地も出さない

            var check = fc.counterCheck;
            bool canCounter = fc.counter != null;
            string attackName = option?.ActionName ?? (magic ? (attacker.plan.grimoireSpell?.name ?? "魔法") : "通常攻撃");
            string attackType = magic ? "魔法" : (a?.weaponType == "魔法" || string.IsNullOrEmpty(a?.weaponType) ? "剣" : a.weaponType);
            FillSide(leftSide, attacker, a, attackName, attackType, fc.attackerHpAfter, fc.first, fc.followUp, null);
            // 攻撃の切り替え
            var switchable = controller.ForecastOptions;
            bool canSwitch = !readOnly && switchable.Count > 1;
            fcPrev.gameObject.SetActive(canSwitch);
            fcNext.gameObject.SetActive(canSwitch);
            fcCount.gameObject.SetActive(canSwitch);
            leftSide.weapon.rectTransform.anchoredPosition = new Vector2(canSwitch ? 36 : 25, leftSide.weapon.rectTransform.anchoredPosition.y);
            if (canSwitch) fcCount.text = $"{Math.Max(1, switchable.ToList().IndexOf(option) + 1)}/{switchable.Count}";
            FillSide(rightSide, defender, d, d?.weaponName ?? "装備なし", d?.weaponType, fc.defenderHpAfter, fc.counter, fc.counterFollowUp, canCounter ? null : "反撃なし");

            var extra = ExtraNotes(attacker, option, fc);
            fcExtraBox.gameObject.SetActive(extra.Length > 0);
            fcExtra.text = extra;

            fcConfirmLabel.text = special ? "実行する" : "攻撃する";
            fcConfirmIcon.sprite = magic ? WeaponSprite("魔法") : SpriteOf("icon_cross");
            fcConfirmIcon.color = magic ? Color.white : Hex("#fff2d0");
            string counter = check == null ? "反撃なし"
                : !string.IsNullOrEmpty(check.reason) ? $"反撃なし（{check.reason}）"
                : check.sealChance.HasValue && check.sealChance.Value >= 0 ? $"反撃あり（野望で{check.sealChance}%封じる）" : "反撃あり";
            var notes = fc.plan?.steps?.SelectMany(s => s.notes ?? new List<string>()).Distinct().ToList() ?? new List<string>();
            fcDetailText.text = counter + (notes.Count > 0 ? "\n" + string.Join(" / ", notes) : "");
        }

        /// <summary>
        /// 攻める側の技で、ダメージ・命中・必殺の欄に出ないこと（MPの消費・封じの確率・付く状態）。
        /// 追撃はダメージの「×2」で出している
        /// </summary>
        private static string ExtraNotes(Battle3DController.UnitState attacker, BattleOption option, BattlePlan.Forecast fc)
        {
            var parts = new List<string>();
            var first = fc.first;
            string formula = option?.spell?.mpCost ?? attacker.plan?.grimoireSpell?.mpCost;
            if (first?.mpCost is int mp && mp > 0)
                parts.Add(string.IsNullOrEmpty(formula) ? $"MP {mp}" : $"MP {formula}（見込み{mp}）");
            if (first?.artSealChance is int seal) parts.Add($"封じ {seal}%");
            if (!string.IsNullOrEmpty(first?.status))
            {
                string name = first.status == "burn" ? "火傷" : first.status == "accuracyDown" ? "命中低下" : first.status == "knockback" ? "押し出し" : first.status;
                parts.Add(first.statusDuration is int turns && turns > 0 ? $"{name}（{turns}ターン）" : name);
            }
            return string.Join("　／　", parts);
        }

        private void FillSide(ForecastSide side, Battle3DController.UnitState unit, UiUnit ui, string weapon, string weaponType, int hpAfter, PlanStep strike, PlanStep follow, string note)
        {
            side.name.text = unit.Name;
            side.level.text = ui?.levelLabel ?? "";
            side.weapon.text = weapon;
            side.weaponIcon.sprite = WeaponSprite(weaponType);
            side.weaponIcon.enabled = side.weaponIcon.sprite != null;
            side.note.text = note ?? "";
            int hp = unit.plan.hp, maxHp = Math.Max(1, unit.plan.maxHp);
            SetBar(side.hpLost.rectTransform, (float)hp / maxHp);
            SetBar(side.hpAfter.rectTransform, (float)hpAfter / maxHp);
            side.hpAfter.sprite = null;
            side.hpAfter.color = unit.Side == "enemy" ? Hex("#db7b85") : Hex("#64c6c3");
            string after = unit.Side == "enemy" ? "#dc8a93" : "#d3e2e1";
            side.hpValue.text = hpAfter == hp
                ? $"{hp}<size=9><color=#a6b7bd> » </color></size>{hp}"
                : $"{hp}<size=9><color=#a6b7bd> » </color></size><color={after}>{hpAfter}</color>";
            side.values[0].text = strike == null ? "─" : follow != null ? $"{strike.damage}×2" : $"{strike.damage}";
            side.values[1].text = strike == null ? "─" : $"{strike.hitRate}%";
            side.values[2].text = strike == null ? "─" : $"{strike.critRate}%";
        }

        /// <summary>予測の肖像: 書き出しで端を薄くした *_bust の絵（なければ今までの切り抜き）</summary>
        private void SetBust(RawImage image, UiUnit ui)
        {
            var bust = ui != null ? portraits.FirstOrDefault(p => p.name == ui.portrait + "_bust").texture : null;
            if (bust != null) { image.texture = bust; image.enabled = true; image.uvRect = new Rect(0, 0, 1, 1); }
            else SetPortrait(image, ui, ui?.bustUv);
        }

        private static void SetBar(RectTransform rt, float t)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = new Vector2(Mathf.Clamp01(t), 1f);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }

        private void FillCommands(bool forecastOpen)
        {
            foreach (var item in commandItems) Object.DestroyImmediate(item);
            commandItems.Clear();
            var entries = new List<(string icon, string label, Action action, bool enabled)>();
            var subTexts = new List<string>();
            bool wide = false;   // 名前と説明が入るよう一覧を広げる（交換）
            var sel = controller.Selected;
            var mode = controller.CurrentMode;
            if (sel == null || sel.Id != subListOwner || (mode != Battle3DController.Mode.Moving && mode != Battle3DController.Mode.Acting)) subList = null;
            subListOwner = sel?.Id;
            if (controller.CurrentPhase == Battle3DController.Phase.Ally && !forecastOpen)
            {
                var ui = controller.UiOf(sel);
                if (sel != null && (mode == Battle3DController.Mode.Moving || mode == Battle3DController.Mode.Acting) && subList != null)
                {
                    if (subList == "item")
                    {
                        // 持ち物（消耗品）: 押すとすぐ使う
                        for (int k = 0; k < sel.items.Count; k++)
                        {
                            int index = k;
                            entries.Add(("item", sel.items[k].name, () => { subList = null; controller.UseItem(index); }, true));
                            subTexts.Add("使う");
                        }
                        if (sel.items.Count == 0) { entries.Add(("item", "持ち物なし", () => { }, false)); subTexts.Add(""); }
                    }
                    // 戦技・魔法の一覧（使えないもの・届く相手がいないものは暗く）
                    var list = subList == "skill" ? ui?.artList : subList == "magic" ? ui?.magicList : null;
                    var options = controller.OptionsOf(sel);
                    foreach (var entry in list ?? Array.Empty<UiListEntry>())
                    {
                        if (!string.IsNullOrEmpty(entry.summonUnitId))
                        {
                            // 召喚（1戦闘に1回。隣の空いているマスに陣を置く）
                            var summon = entry;
                            bool usedSummon = controller.SummonUsed(sel, summon);
                            bool canSummon = controller.CanSummon(sel, summon);
                            entries.Add(("magic", entry.label, () => { subList = null; controller.ChooseSummon(summon); }, canSummon));
                            // 使えないときは理由（レビュー 2026-09-28 D5）
                            subTexts.Add(usedSummon ? "使用済み" : canSummon ? $"MP {entry.mpCost}" : (sel.plan?.mp ?? 0) <= 0 ? "MP不足" : "置く所なし");
                            continue;
                        }
                        var specials = controller.SpecialsOf(sel);
                        if (entry.specialIndex >= 0 && entry.specialIndex < specials.Count)
                        {
                            // 専用戦技（範囲の割合ダメージ。1戦闘に1回）
                            var special = specials[entry.specialIndex];
                            bool used = controller.SpecialUsed(sel, special);
                            entries.Add(("skill", entry.label, () => { subList = null; controller.UseSpecial(special); }, !used));
                            subTexts.Add(used ? "使用済み" : $"{special.radius}マス・1回");
                            continue;
                        }
                        var option = entry.index >= 0 && entry.index < options.Count ? options[entry.index] : null;
                        var supports = controller.SupportsOf(sel);
                        var support = entry.supportIndex >= 0 && entry.supportIndex < supports.Count ? supports[entry.supportIndex] : null;
                        // Unity版でまだ使えない戦技・魔法（虚像・封印・転移・範囲・召喚など）は「準備中」
                        string sub = option == null && support == null ? "準備中" : subList == "magic" && !string.IsNullOrEmpty(entry.mpCost) ? $"MP {entry.mpCost}" : "";
                        bool usable;
                        if (support != null)
                        {
                            usable = controller.CanSupportFromHere(support);
                            entries.Add(("magic", entry.label, () => { subList = null; controller.ChooseSupport(support); }, usable));
                            if (!usable) sub = "対象なし";
                        }
                        else
                        {
                            usable = option != null && controller.CanUseFromHere(option);
                            entries.Add((subList == "magic" ? "magic" : "skill", entry.label, () => { subList = null; controller.ChooseOption(option); }, usable));
                            if (option != null && !usable) sub = "届かない";   // 使えない理由（レビュー 2026-09-28 D5: 暗いだけで理由がなかった）
                        }
                        subTexts.Add(sub);
                    }
                    entries.Add(("back", "戻る", () => { subList = null; stateKey = null; }, true));
                    subTexts.Add("");
                }
                else if (sel != null && (mode == Battle3DController.Mode.Moving || mode == Battle3DController.Mode.Acting))
                {
                    subList = null;
                    entries.Add(("detail", "人物", () => { panelMode = "person"; stateKey = null; }, true));   // 人物欄へ戻る（銀細工のUI 第3段）
                    var basic = controller.OptionsOf(sel).FirstOrDefault(o => o.kind == "weapon" && string.IsNullOrEmpty(o.artName));
                    if (basic != null) entries.Add(("attack", "攻撃", () => controller.ChooseOption(basic), controller.CanUseFromHere(basic)));
                    if (ui?.artList != null && ui.artList.Length > 0) entries.Add(("skill", "戦技", () => { subList = "skill"; stateKey = null; }, true));
                    if (ui?.magicList != null && ui.magicList.Length > 0) entries.Add(("magic", "魔法", () => { subList = "magic"; stateKey = null; }, true));
                    if (sel.items.Count > 0) entries.Add(("item", "持ち物", () => { subList = "item"; stateKey = null; }, true));
                    // 交換（隣の味方と持ち物をやりとりする。原作者 2026-09-28）
                    if (controller.CanTradeFromHere) entries.Add(("item", "交換", () => controller.ChooseTrade(), true));
                    if (basic == null && (ui?.magicList == null || ui.magicList.Length == 0))
                        entries.Add(("attack", "攻撃", () => controller.ChooseAttack(), controller.CanAttackFromHere));
                    entries.Add(("wait", "待機", () => controller.ChooseWait(), true));
                    if (controller.CanUndoMove) entries.Add(("back", "戻る", () => controller.UndoMove(), true));
                }
                else if (sel != null && mode == Battle3DController.Mode.Trade)
                {
                    var partner = controller.TradePartner;
                    if (partner != null)
                    {
                        // 押した物が相手へ移る（自分の物＝渡す、相手の物＝もらう）
                        for (int k = 0; k < sel.items.Count; k++)
                        {
                            int index = k;
                            entries.Add(("item", sel.items[k].name, () => controller.GiveItem(index), true));
                            subTexts.Add("渡す →");
                        }
                        for (int k = 0; k < partner.items.Count; k++)
                        {
                            int index = k;
                            entries.Add(("item", partner.items[k].name, () => controller.TakeItem(index), true));
                            subTexts.Add("← もらう");
                        }
                        entries.Add(("back", "終わる", () => controller.EndTrade(), true));
                        subTexts.Add("");
                        wide = true;
                    }
                    else entries.Add(("back", "取り消し", () => controller.EndTrade(), true));
                }
                else if (sel != null && (mode == Battle3DController.Mode.Targeting || mode == Battle3DController.Mode.Support || mode == Battle3DController.Mode.Summon))
                {
                    entries.Add(("back", "取り消し", () => controller.CancelTargeting(), true));
                }
                else if (sel == null)
                {
                    entries.Add(("detail", "戦況", OpenStatus, true));
                    entries.Add(("wait", "ターン終了", () => controller.EndTurn(), true));
                }
            }
            commandList.gameObject.SetActive(entries.Count > 0);
            if (entries.Count == 0) return;
            // 入れ替えた一覧（戦技・魔法）は、名前とMPが入るように少し広げる
            float width = wide ? 178f : subList != null ? 150f : 118f;   // 交換は品物の名前と「渡す →」「← もらう」が入る幅
            commandList.anchoredPosition = new Vector2(-PanelRight, -PanelTop);   // 右の人物欄と同じ場所（銀細工のUI 第3段）。幅は左へ伸びる
            commandList.sizeDelta = new Vector2(width, entries.Count * 30 + 15);
            for (int i = 0; i < entries.Count; i++)
            {
                var (icon, label, action, enabled) = entries[i];
                var row = Place(NewRect("Command_" + label, commandList), 8, 7 + i * 30, width - 16, 30);
                var hit = row.gameObject.AddComponent<Image>();
                hit.color = new Color(1f, 0.9f, 0.6f, 0f);
                var button = row.gameObject.AddComponent<Button>();
                button.targetGraphic = hit;
                var colors = button.colors;
                colors.normalColor = new Color(1, 1, 1, 0);
                colors.highlightedColor = new Color(0.84f, 0.65f, 0.25f, 0.12f);
                colors.pressedColor = new Color(0.84f, 0.65f, 0.25f, 0.24f);
                colors.disabledColor = new Color(1, 1, 1, 0);
                button.colors = colors;
                button.interactable = enabled;
                var onClick = action;
                button.onClick.AddListener(() => onClick());
                var color = enabled ? Hex("#ecd28e", 0.9f) : Hex("#a096aa", 0.5f);
                var img = Place(NewRect("Icon", row), 10, 7, 16, 16).gameObject.AddComponent<Image>();
                img.sprite = icon == "magic" ? WeaponSprite("魔法") : SpriteOf("icon_" + icon);
                img.color = icon == "magic" ? (enabled ? Color.white : new Color(1, 1, 1, 0.45f)) : color;
                img.preserveAspect = true;
                img.raycastTarget = false;
                var text = Label(row, "Label", 36, 0, width - 60, 30, subList != null || wide ? 11 : 12, color);
                text.text = label;
                if (i < subTexts.Count && !string.IsNullOrEmpty(subTexts[i]))
                {
                    var sub = Label(row, "Sub", width - 70, 0, 50, 30, 7.5f, enabled ? Hex("#e0bd73", 0.7f) : Hex("#a096aa", 0.45f), anchor: TextAnchor.MiddleRight);
                    sub.text = subTexts[i];
                }
                if (i > 0) Place(NewRect("Rule", row), 4, 0, width - 24, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.2f);
                commandItems.Add(row.gameObject);
            }
        }

        private string SupportHint()
        {
            var option = controller.CurrentOption;
            if (option?.artName == "転移")
                return controller.TransferAlly == null
                    ? $"転移させる味方を選んでください（{option.rangeMax}マス以内。自分も選べます）。"
                    : $"{controller.TransferAlly.Name}の移動先のマスを選んでください（味方を押すと選び直し）。";
            if (option?.spell?.targetType == "enemy") return $"{option.ActionName}を使う相手を選んでください（赤いマス）。";
            return $"{option?.ActionName}を使う味方を選んでください（緑のマス）。";
        }

        private string HintText(bool forecastOpen)
        {
            var sel = controller.Selected;
            if (controller.EnemyPreview != null) return $"{controller.EnemyPreview.attacker.Name}が{controller.EnemyPreview.target.Name}を攻撃する。";
            switch (controller.CurrentPhase)
            {
                case Battle3DController.Phase.Enemy: return "敵フェーズ";
                case Battle3DController.Phase.Victory: return "勝利";
                case Battle3DController.Phase.Defeat: return "敗北";
            }
            if (controller.EnemyPreview != null) return $"{controller.EnemyPreview.attacker.Name}が{controller.EnemyPreview.target.Name}を攻撃する。";
            if (forecastOpen) return $"{controller.Target.Name}への攻撃を実行しますか。";
            if (sel == null) return "動かす味方を選んでください。";
            return controller.CurrentMode switch
            {
                Battle3DController.Mode.Moving => $"{sel.Name}の移動先を選ぶか、右の「行動する」でその場から行動してください。",
                Battle3DController.Mode.Targeting => "攻撃する相手を選んでください。",
                Battle3DController.Mode.Support => SupportHint(),
                Battle3DController.Mode.Summon => "召喚の陣を置くマスを選んでください（隣の空いているマス。2ターン後に出ます）。",
                Battle3DController.Mode.Trade => controller.TradePartner == null ? "交換する味方を選んでください（隣の味方）。"
                    : $"{controller.TradePartner.Name}と持ち物を交換します。押した物が相手へ移ります。",
                _ => $"{sel.Name}の行動を選んでください。",
            };
        }

        /// <summary>画面上の位置がUIの上か（そこを押しても盤面のマスを押したことにしない）</summary>
        public bool IsOverHud(Vector2 screenPosition)
        {
            if (!Built) return false;
            if (statusOpen) return true;   // 戦況の画面が開いている間は盤面を押せない
            var cam = canvas.worldCamera;
            foreach (var rt in new[] { commandList, personPanel, roster, terrainPanel })
                if (rt != null && rt.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint(rt, screenPosition, cam)) return true;
            if (forecastRoot != null && forecastRoot.gameObject.activeInHierarchy)
            {
                foreach (var g in forecastRoot.GetComponentsInChildren<Graphic>())
                    if (g.raycastTarget && RectTransformUtility.RectangleContainsScreenPoint(g.rectTransform, screenPosition, cam)) return true;
            }
            return false;
        }

        // ── 小さな部品 ──

        private void SetPortrait(RawImage image, UiUnit ui, UvRect uv)
        {
            var tex = ui != null ? portraits.FirstOrDefault(p => p.name == ui.portrait).texture : null;
            image.texture = tex;
            image.enabled = tex != null;
            if (tex != null && uv != null) image.uvRect = uv.ToRect();
        }

        private Sprite WeaponSprite(string type) => type switch
        {
            "剣" => SpriteOf("weapon_sword"),
            "槍" => SpriteOf("weapon_lance"),
            "斧" => SpriteOf("weapon_axe"),
            "弓" => SpriteOf("weapon_bow"),
            "杖" => SpriteOf("weapon_staff"),
            "魔法" => SpriteOf("weapon_magic"),
            _ => null,
        };

        private Sprite SpriteOf(string name) => spriteMap.TryGetValue(name, out var s) ? s : null;

        private static RectTransform NewRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        /// <summary>親の左上からの位置と大きさ（ブラウザ版の画面の px）で置く</summary>
        // ── 画面の端から決める置き方（座標は 844×390 の画面で測った値のまま） ──
        // ブラウザ版の左右の余白（75。旧方針の「UIは中央16:9」）をやめ、その分だけ部品を左右の端へ寄せる（2026-10-02）
        private const float OldSideMargin = 75f;

        /// <summary>画面の左端から（x は 844 の画面の左からの位置）</summary>
        private static RectTransform PlaceLeft(RectTransform rt, float x, float y, float w, float h) => Place(rt, x - OldSideMargin, y, w, h);

        /// <summary>画面の右端から（x は 844 の画面の左からの位置。右端までの距離を保つ）</summary>
        private static RectTransform PlaceRight(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(1f, 1f);
            rt.pivot = new Vector2(1f, 1f);
            rt.anchoredPosition = new Vector2(-(ScreenW - (x + w) - OldSideMargin), -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        /// <summary>画面の真ん中から（844 の画面の真ん中からのずれを保つ）</summary>
        private static RectTransform PlaceCenter(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 1f);
            rt.pivot = new Vector2(0.5f, 1f);
            rt.anchoredPosition = new Vector2(x + w / 2f - ScreenW / 2f, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        /// <summary>左右いっぱい（左端・右端からの距離を保って伸びる）</summary>
        private static RectTransform PlaceWide(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(1f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.offsetMin = new Vector2(x - OldSideMargin, -(y + h));
            rt.offsetMax = new Vector2(-(ScreenW - (x + w) - OldSideMargin), -y);
            return rt;
        }

        private static RectTransform Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        private static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }

        /// <summary>枠の絵（9分割）を敷く。border は画面での枠の太さ</summary>
        private Image Framed(RectTransform rt, string spriteName, float border)
        {
            var image = rt.gameObject.AddComponent<Image>();
            image.sprite = SpriteOf(spriteName);
            image.type = Image.Type.Sliced;
            if (image.sprite != null && image.sprite.border.x > 0f) image.pixelsPerUnitMultiplier = image.sprite.border.x / border;
            return image;
        }

        private Image SpriteImage(RectTransform parent, string spriteName, float x, float y, float w, float h, bool preserve)
        {
            var image = Place(NewRect(spriteName, parent), x, y, w, h).gameObject.AddComponent<Image>();
            image.sprite = SpriteOf(spriteName);
            image.preserveAspect = preserve;
            image.raycastTarget = false;
            return image;
        }

        private Button FrameButton(RectTransform parent, string name, float x, float y, float w, float h, string normal, string pressed, float border,
            string icon, string label, float size, Color color, out Text text, out Image iconImage)
        {
            var rt = Place(NewRect(name, parent), x, y, w, h);
            var image = rt.gameObject.AddComponent<Image>();
            image.sprite = SpriteOf(normal);
            image.type = Image.Type.Sliced;
            if (image.sprite != null && image.sprite.border.x > 0f) image.pixelsPerUnitMultiplier = image.sprite.border.x / border;
            var button = rt.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            button.transition = Selectable.Transition.SpriteSwap;
            var state = button.spriteState;
            state.pressedSprite = SpriteOf(pressed);
            state.disabledSprite = SpriteOf("button_b2_disabled");
            button.spriteState = state;
            // アイコンと文字を真ん中にまとめる
            float textWidth = label.Length * size * 1.12f;
            float start = (w - (13 + 6 + textWidth)) * 0.5f;
            iconImage = Place(NewRect("Icon", rt), start, (h - 13) * 0.5f, 13, 13).gameObject.AddComponent<Image>();
            iconImage.sprite = SpriteOf("icon_" + icon);
            iconImage.color = color;
            iconImage.preserveAspect = true;
            iconImage.raycastTarget = false;
            text = Label(rt, "Label", start + 19, 0, textWidth + 8, h, size, color, FontStyle.Bold);
            text.text = label;
            return button;
        }

        private Button TextButton(RectTransform parent, string name, float x, float y, float w, float h, string text)
        {
            var rt = Place(NewRect(name, parent), x, y, w, h);
            var hit = rt.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            var button = rt.gameObject.AddComponent<Button>();
            button.targetGraphic = hit;
            var label = Label(rt, "Text", 0, 0, w, h, 13, Hex("#efd081", 0.85f), anchor: TextAnchor.MiddleCenter);
            label.text = text;
            return button;
        }

        private Text Label(RectTransform parent, string name, float x, float y, float w, float h, float size, Color color,
            FontStyle style = FontStyle.Normal, TextAnchor anchor = TextAnchor.MiddleLeft)
        {
            var text = Place(NewRect(name, parent), x, y, w, h).gameObject.AddComponent<Text>();
            text.font = font;
            // Text は整数の大きさしか持てないので、小数の大きさは拡大で合わせる
            int whole = Mathf.CeilToInt(size);
            text.fontSize = whole;
            if (!Mathf.Approximately(whole, size))
            {
                float k = size / whole;
                text.rectTransform.localScale = new Vector3(k, k, 1f);
                text.rectTransform.sizeDelta = new Vector2(w / k, h / k);
            }
            if (style == FontStyle.Bold && boldFont != null) { text.font = boldFont; text.fontStyle = FontStyle.Normal; }
            else text.fontStyle = style;
            text.color = color;
            text.alignment = anchor;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            text.text = name;   // 決まった文字の欄は名前がそのまま文字。値の欄は Refresh で書き換える
            return text;
        }

        private static void Diamond(RectTransform parent, float x, float y, float size, Color color, bool hollow = false)
        {
            var rt = Place(NewRect("Diamond", parent), x, y, size, size);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(x + size * 0.5f, -(y + size * 0.5f));
            rt.localRotation = Quaternion.Euler(0, 0, 45f);
            var image = rt.gameObject.AddComponent<Image>();
            image.color = hollow ? new Color(0, 0, 0, 0) : color;
            image.raycastTarget = false;
            if (hollow) Outline(rt, color);
        }

        /// <summary>1px の枠線（4本の細い四角）</summary>
        private static void Outline(RectTransform rt, Color color)
        {
            void Edge(string name, Vector2 min, Vector2 max, Vector2 size)
            {
                var e = NewRect(name, rt);
                e.anchorMin = min; e.anchorMax = max;
                e.pivot = new Vector2(0.5f, 0.5f);
                e.sizeDelta = size;
                e.anchoredPosition = Vector2.zero;
                var img = e.gameObject.AddComponent<Image>();
                img.color = color;
                img.raycastTarget = false;
            }
            Edge("Top", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, 1));
            Edge("Bottom", new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1));
            Edge("Left", new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 0));
            Edge("Right", new Vector2(1, 0), new Vector2(1, 1), new Vector2(1, 0));
        }

        private static readonly Dictionary<string, Sprite> gradients = new Dictionary<string, Sprite>();

        /// <summary>横のグラデーションの絵（from → to）。a0〜a1 の範囲で不透明度を alphaFrom → alphaTo に変える</summary>
        private static Sprite GradientSprite(Color from, Color to, float a0 = 0f, float a1 = 1f, float alphaFrom = -1f, float alphaTo = -1f)
        {
            string key = $"{from}|{to}|{a0}|{a1}|{alphaFrom}|{alphaTo}";
            if (gradients.TryGetValue(key, out var cached) && cached != null) return cached;
            const int W = 64;
            var tex = new Texture2D(W, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            for (int i = 0; i < W; i++)
            {
                float t = i / (W - 1f);
                var c = Color.Lerp(from, to, t);
                if (alphaFrom >= 0f) c.a = Mathf.Lerp(alphaFrom, alphaTo, Mathf.InverseLerp(a0, a1, t));
                tex.SetPixel(i, 0, c);
            }
            tex.Apply();
            var sprite = UnityEngine.Sprite.Create(tex, new Rect(0, 0, W, 1), new Vector2(0.5f, 0.5f));
            gradients[key] = sprite;
            return sprite;
        }

        /// <summary>
        /// 箱の端へ向かって color に溶ける重ね（ブラウザ版の linear-gradient と同じ）。from までは透明、mid で 0.85、端で maxAlpha。
        /// horizontal なら右へ（reverse なら左へ）、そうでなければ下へ
        /// </summary>
        private static void FadeOverlay(RectTransform parent, Color color, bool horizontal, float from, float mid, bool reverse = false, float maxAlpha = 1f)
        {
            const int N = 64;
            var tex = horizontal ? new Texture2D(N, 1, TextureFormat.RGBA32, false) : new Texture2D(1, N, TextureFormat.RGBA32, false);
            tex.wrapMode = TextureWrapMode.Clamp;
            for (int i = 0; i < N; i++)
            {
                float t = i / (N - 1f);
                if (reverse) t = 1f - t;
                if (!horizontal) t = 1f - t;   // テクスチャは下が 0。上から下へ濃くする
                float a = t <= from ? 0f : t <= mid ? Mathf.Lerp(0f, 0.85f * maxAlpha, (t - from) / Mathf.Max(0.0001f, mid - from))
                    : Mathf.Lerp(0.85f * maxAlpha, maxAlpha, (t - mid) / Mathf.Max(0.0001f, 1f - mid));
                var c = new Color(color.r, color.g, color.b, a);
                if (horizontal) tex.SetPixel(i, 0, c); else tex.SetPixel(0, i, c);
            }
            tex.Apply();
            var image = NewRect("Fade", parent).gameObject.AddComponent<RawImage>();
            Stretch(image.rectTransform);
            image.texture = tex;
            image.raycastTarget = false;
        }

        private static Sprite glowSprite;

        /// <summary>中心（少し下）が明るく、70%で消える丸い光（白。色は Image の色で付ける。ブラウザ版の radial-gradient と同じ形）</summary>
        private static Sprite GlowSprite()
        {
            if (glowSprite != null) return glowSprite;
            const int S = 64;
            var tex = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            // 箱の横と縦のうち長いほうの対角を基準にした円（circle at 50% 60% の farthest-corner）
            var center = new Vector2(0.5f, 0.4f);   // テクスチャは下が 0 なので、上から60%＝下から40%
            float far = new Vector2(0.5f, 0.6f).magnitude;
            for (int y = 0; y < S; y++)
            for (int x = 0; x < S; x++)
            {
                float d = (new Vector2((x + 0.5f) / S, (y + 0.5f) / S) - center).magnitude / far;
                tex.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Clamp01(1f - d / 0.7f)));
            }
            tex.Apply();
            glowSprite = UnityEngine.Sprite.Create(tex, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f));
            return glowSprite;
        }

        /// <summary>横のグラデーション（色の段階つき。t は 0〜1）</summary>
        private static Sprite StopsSprite(params (float t, Color c)[] stops)
        {
            const int W = 128;
            var tex = new Texture2D(W, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            for (int i = 0; i < W; i++)
            {
                float t = i / (W - 1f);
                int k = 0;
                while (k < stops.Length - 2 && t > stops[k + 1].t) k++;
                var (t0, c0) = stops[k];
                var (t1, c1) = stops[Math.Min(k + 1, stops.Length - 1)];
                tex.SetPixel(i, 0, Color.Lerp(c0, c1, Mathf.InverseLerp(t0, t1, t)));
            }
            tex.Apply();
            return UnityEngine.Sprite.Create(tex, new Rect(0, 0, W, 1), new Vector2(0.5f, 0.5f));
        }

        private static Color Hex(string hex, float alpha = 1f)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            c.a = alpha;
            return c;
        }
    }
}
