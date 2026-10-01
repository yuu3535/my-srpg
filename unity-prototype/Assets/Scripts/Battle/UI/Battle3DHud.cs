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
        private RectTransform unitCard, weaponCard, commandList, hintBar, forecastRoot;
        private RawImage cardPortrait;
        private Text cardName, cardLevel, cardClass, cardMove, cardHpValue, cardMpValue;
        private Image cardHpFill, cardMpFill, cardFrame;
        private Image weaponIcon;
        private Text weaponName;
        private Text[] weaponValues;
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
        // 味方一覧を閉じる・開くつまみ（原作者 2026-10-02: 一覧が画面を占めて邪魔なときがある）。開け閉めは覚えておく
        private RectTransform rosterToggle;
        private Text rosterToggleText;
        private const string RosterPref = "srpg.rosterCollapsed";
        private static bool RosterCollapsed
        {
            get => PlayerPrefs.GetInt(RosterPref, 0) == 1;
            set { PlayerPrefs.SetInt(RosterPref, value ? 1 : 0); PlayerPrefs.Save(); }
        }
        private Text phaseEn, phaseJa, turnValue, terrainName, terrainNote;
        private RectTransform turnGroup;

        // 戦況の画面（原作者 2026-09-27: 勝利条件・敗北条件・ターン・軍の数・マップ表をここにまとめる）
        private RectTransform statusRoot, statusMapArea, statusMapPanel;
        private RawImage statusMap;
        private Text statusTitle, statusVictory, statusDefeat, statusTurn, statusAllies, statusEnemies, statusOthers, statusTargets;
        private readonly List<GameObject> statusMarks = new List<GameObject>();
        private bool statusOpen, openedAtStart;
        public bool StatusOpen => statusOpen;
        private Image phaseEdge;
        private Vector2Int? shownTerrainCell;
        private readonly List<RosterSlot> rosterSlots = new List<RosterSlot>();
        private readonly Dictionary<string, UnitOverlay> overlays = new Dictionary<string, UnitOverlay>();
        private Image markSelected, markTarget;

        private class RosterSlot
        {
            public string id;
            public RawImage face;
            public Image frame, hpFill;
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

        private void LateUpdate()
        {
            // 戦闘の組み立て（Battle3DController.Setup）が済んでから作る（Start の順番に頼らない）
            if (!Built)
            {
                if (controller == null || controller.Data == null) return;
                Build();
            }
            Refresh();
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

            // ブラウザ版の 844×390 の画面を真ん中に置き、その上の位置で並べる
            frame = NewRect("Frame", canvasObject.transform);
            frame.anchorMin = frame.anchorMax = new Vector2(0.5f, 0.5f);
            frame.pivot = new Vector2(0.5f, 0.5f);
            frame.sizeDelta = new Vector2(ScreenW, ScreenH);

            BuildTopStrip();
            BuildRoster();
            BuildRosterToggle();
            BuildTerrainPanel();
            BuildUnitCard();
            BuildWeaponCard();
            BuildCommandList();
            BuildHint();
            BuildGuide();
            BuildForecast();
            BuildStatus();

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

        /// <summary>上の帯: フェーズ（英字の小見出し＋日本語）・勝利条件・TURN・敵行動予告の数</summary>
        private void BuildTopStrip()
        {
            topStrip = Place(NewRect("TopStrip", frame), 82, 6, 680, 30);
            var bg = topStrip.gameObject.AddComponent<Image>();
            bg.sprite = StopsSprite((0f, Hex("#381547", 0.62f)), (0.46f, Hex("#070811", 0.34f)), (0.72f, Hex("#070811", 0f)), (1f, Hex("#070811", 0f)));
            bg.raycastTarget = false;
            Place(NewRect("Rule", topStrip), 0, 29, 680, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.22f);
            phaseEdge = Place(NewRect("PhaseEdge", topStrip), 0, 1, 2, 28).gameObject.AddComponent<Image>();
            phaseEn = Label(topStrip, "ALLY PHASE", 10, 4, 100, 9, 6.5f, Hex("#d6a740", 0.62f));
            phaseJa = Label(topStrip, "味方フェーズ", 10, 12, 110, 15, 13, Hex("#efd081"), FontStyle.Bold);
            // ターンは見出しの右に小さく（勝利条件・敵行動予告の数は戦況の画面へ移した。原作者 2026-09-27）
            turnGroup = Place(NewRect("Turn", topStrip), 116, 0, 80, 30);
            Place(NewRect("Divider", turnGroup), 0, 6, 1, 18).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.25f);
            Label(turnGroup, "TURN", 12, 13, 32, 11, 7.5f, Hex("#e0bd73", 0.5f));
            turnValue = Label(turnGroup, "TurnValue", 42, 5, 30, 20, 14, Hex("#efd081"), FontStyle.Bold);
        }

        /// <summary>左の味方一覧（R1 の枠・A5 の顔枠）。押すとその味方を選ぶ</summary>
        private void BuildRoster()
        {
            roster = Place(NewRect("Roster", frame), 82, 45, 46, 314);
            Framed(roster, "roster_frame", 4f);
            rosterSlots.Clear();
            int i = 0;
            foreach (var unit in controller.Units.Where(u => u.Side == "ally"))
            {
                var slotRect = Place(NewRect("Roster_" + unit.Id, roster), 5, 12 + i * 40, 36, 36);
                var bg = slotRect.gameObject.AddComponent<Image>();
                bg.color = Hex("#140b1f");
                var slot = new RosterSlot { id = unit.Id };
                slot.face = Place(NewRect("Face", slotRect), 2, 2, 32, 32).gameObject.AddComponent<RawImage>();
                slot.face.raycastTarget = false;
                uiUnits.TryGetValue(unit.Id, out var ui);
                SetPortrait(slot.face, ui, ui?.rosterUv);
                var hpBar = Place(NewRect("Hp", slotRect), 2, 32, 32, 2);
                hpBar.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0.65f);
                slot.hpFill = NewRect("Fill", hpBar).gameObject.AddComponent<Image>();
                slot.hpFill.color = Hex("#59e48c");
                slot.frame = Place(NewRect("Frame", slotRect), 0, 0, 36, 36).gameObject.AddComponent<Image>();
                slot.frame.raycastTarget = false;
                slot.done = Label(slotRect, "済", 22, 1, 12, 11, 8, Hex("#ecd28e"), FontStyle.Bold);
                var button = slotRect.gameObject.AddComponent<Button>();
                button.transition = Selectable.Transition.None;
                string id = unit.Id;
                button.onClick.AddListener(() => SelectFromRoster(id));
                rosterSlots.Add(slot);
                i++;
            }
        }

        /// <summary>味方一覧のつまみ: 開いているときは一覧の右上のふちに「◀」、閉じているときは左の端に「▶ 味方」</summary>
        private void BuildRosterToggle()
        {
            rosterToggle = NewRect("RosterToggle", frame);
            var bg = rosterToggle.gameObject.AddComponent<Image>();
            bg.color = Hex("#1a0f26", 0.92f);
            var outline = rosterToggle.gameObject.AddComponent<Outline>();
            outline.effectColor = Hex("#c8922a", 0.75f);
            outline.effectDistance = new Vector2(0.6f, -0.6f);
            rosterToggleText = Label(rosterToggle, "Label", 0, 0, 16, 16, 7.5f, Hex("#efd081"), FontStyle.Bold, TextAnchor.MiddleCenter);
            rosterToggleText.raycastTarget = false;
            var button = rosterToggle.gameObject.AddComponent<Button>();
            button.transition = Selectable.Transition.None;
            button.onClick.AddListener(() => { RosterCollapsed = !RosterCollapsed; Refresh(); });
            PlaceRosterToggle();
        }

        private void PlaceRosterToggle()
        {
            if (rosterToggle == null) return;
            bool collapsed = RosterCollapsed;
            // 開いているとき: 一覧（x82・幅46）の右のふちに小さく。閉じているとき: 一覧のあった場所の左の端に、縦長の「▶ 味方」
            if (collapsed) Place(rosterToggle, 82, 45, 16, 52);
            else Place(rosterToggle, 122, 45, 14, 16);
            Place(rosterToggleText.rectTransform, 0, 0, collapsed ? 16 : 14, collapsed ? 52 : 16);
            rosterToggleText.text = collapsed ? "▶\n味\n方" : "◀";
            rosterToggleText.lineSpacing = 0.9f;
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
            terrainPanel = Place(NewRect("Terrain", frame), 640, 44, 118, 42);
            Framed(terrainPanel, "panel_even", 7f);
            Diamond(terrainPanel, 12, 11, 5, Hex("#c8922a"));
            terrainName = Label(terrainPanel, "Name", 22, 5, 90, 17, 11, Ivory, FontStyle.Bold);
            terrainNote = Label(terrainPanel, "Note", 12, 22, 100, 14, 8.5f, Muted);
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

        private void BuildUnitCard()
        {
            unitCard = Place(NewRect("UnitCard", frame), 130, 279, 244, 86);
            cardFrame = Framed(unitCard, "panel_even", 7f);
            var face = Place(NewRect("Portrait", unitCard), 7, 7, 62, 72);
            face.gameObject.AddComponent<RectMask2D>();
            // 顔の後ろには何も敷かない（透過）。端を透明へ溶かした絵（<id>_card.png。書き出しで作る）を出す（原作者 2026-09-27）
            cardPortrait = NewRect("Image", face).gameObject.AddComponent<RawImage>();
            Stretch(cardPortrait.rectTransform);
            cardName = Label(unitCard, "Name", 77, 9, 110, 19, 13, Ivory, FontStyle.Bold);
            cardLevel = Label(unitCard, "Level", 180, 13, 49, 12, 8.5f, Muted, anchor: TextAnchor.MiddleRight);
            Diamond(unitCard, 78, 34, 5, Hex("#c8922a"));
            cardClass = Label(unitCard, "Class", 88, 28, 80, 14, 9, Gold);
            cardMove = Label(unitCard, "Move", 160, 29, 69, 12, 8, Hex("#e0bd73", 0.55f), anchor: TextAnchor.MiddleRight);
            (cardHpFill, cardHpValue) = Gauge(unitCard, "HP", 77, 46, Hex("#3fbf82"), Hex("#59e48c"));
            (cardMpFill, cardMpValue) = Gauge(unitCard, "MP", 77, 63, Hex("#3d6fd0"), Hex("#5d95f0"));
        }

        private (Image fill, Text value) Gauge(RectTransform parent, string label, float x, float y, Color from, Color to)
        {
            Label(parent, label, x, y, 16, 15, 8, Muted);
            var bar = Place(NewRect(label + "Bar", parent), x + 20, y + 5, 86, 5);
            bar.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0.6f);
            Outline(bar, Hex("#e0b048", 0.2f));
            var fill = NewRect("Fill", bar).gameObject.AddComponent<Image>();
            fill.rectTransform.anchorMin = Vector2.zero;
            fill.rectTransform.anchorMax = new Vector2(1f, 1f);
            fill.rectTransform.offsetMin = fill.rectTransform.offsetMax = Vector2.zero;
            fill.sprite = GradientSprite(from, to);
            var value = Label(parent, label + "Value", x + 108, y, 44, 15, 10, Ivory, anchor: TextAnchor.MiddleRight);
            value.supportRichText = true;
            return (fill, value);
        }

        private void BuildWeaponCard()
        {
            weaponCard = Place(NewRect("WeaponCard", frame), 380, 296, 150, 69);
            Framed(weaponCard, "panel_even", 7f);
            var iconBox = Place(NewRect("IconBox", weaponCard), 12, 9, 15, 15);
            weaponIcon = iconBox.gameObject.AddComponent<Image>();
            weaponIcon.preserveAspect = true;
            weaponName = Label(weaponCard, "Name", 32, 7, 106, 19, 11, Gold, FontStyle.Bold);
            var rule = Place(NewRect("Rule", weaponCard), 12, 27, 126, 1);
            rule.gameObject.AddComponent<Image>().color = Rule;
            weaponValues = new Text[4];
            string[] labels = { "威力", "射程", "命中", "必殺" };
            for (int i = 0; i < 4; i++)
            {
                float x = 12 + (i % 2) * 66, y = 31 + (i / 2) * 16;
                Label(weaponCard, labels[i], x, y, 28, 15, 8, Muted);
                weaponValues[i] = Label(weaponCard, labels[i] + "Value", x + 26, y, 34, 15, 10, Ivory, anchor: TextAnchor.MiddleRight);
            }
        }

        private void BuildCommandList()
        {
            commandList = Place(NewRect("Commands", frame), 640, 158, 118, 75);
            Framed(commandList, "panel_even", 7f);
        }

        /// <summary>手引きの帯（訓練の戦闘。原作者 2026-09-28: 台詞＋画面の帯）。上の帯の下、真ん中に金の縁で出す</summary>
        private void BuildGuide()
        {
            guideBar = Place(NewRect("Guide", frame), 140, 42, 490, 30);
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
            hintBar = Place(NewRect("Hint", frame), 82, 369, 680, 14);
            var bg = hintBar.gameObject.AddComponent<Image>();
            bg.sprite = GradientSprite(new Color(7 / 255f, 8 / 255f, 17 / 255f, 0.78f), new Color(7 / 255f, 8 / 255f, 17 / 255f, 0f));
            var edge = Place(NewRect("Edge", hintBar), 0, 0, 2, 14);
            edge.gameObject.AddComponent<Image>().color = Hex("#d6a740", 0.55f);
            hintText = Label(hintBar, "Text", 10, 0, 660, 14, 9, Hex("#e8d5a4", 0.78f));
        }

        private void BuildForecast()
        {
            forecastRoot = Place(NewRect("Forecast", frame), 0, 0, ScreenW, ScreenH);

            // 左上の見出し「戦闘予測」と、その下の飾り（F5）
            var title = Place(NewRect("Title", forecastRoot), 86, 8, 125, 25);
            var titleBg = title.gameObject.AddComponent<Image>();
            titleBg.sprite = GradientSprite(new Color(8 / 255f, 6 / 255f, 16 / 255f, 0.82f), new Color(8 / 255f, 6 / 255f, 16 / 255f, 0f));
            titleBg.raycastTarget = false;
            Diamond(title, 9, 9, 7, GoldDeep, hollow: true);
            fcTitle = Label(title, "Text", 25, 0, 100, 25, 15, Hex("#efd081"), FontStyle.Bold);
            SpriteImage(title, "heading_flourish", 0, 23, 125, 13, preserve: true);

            // 下の帯（F1）
            var panel = Place(NewRect("Panel", forecastRoot), 82, 223, 680, 132);
            var band = panel.gameObject.AddComponent<Image>();
            band.sprite = SpriteOf("fc_band");
            leftBust = Bust(panel, "BustLeft", 10, false);
            rightBust = Bust(panel, "BustRight", 516, true);
            leftSide = Side(panel, "SideLeft", 167);
            rightSide = Side(panel, "SideRight", 371);
            SpriteImage(panel, "fc_emblem_sword", 312, 7, 57, 118, preserve: true);

            // 攻める側の技の付け足し（MPの消費・封じ・状態）。帯の左の上に1行（レビュー 2026-09-28 D1）
            fcExtraBox = Place(NewRect("Extra", forecastRoot), 244, 206, 300, 16);
            var extraBg = fcExtraBox.gameObject.AddComponent<Image>();
            // 色は線形で混ぜるので、見た目より強めの値にする（右の端だけ薄く消す）
            var extraColor = new Color(8 / 255f, 6 / 255f, 16 / 255f, 1f);
            extraBg.sprite = GradientSprite(extraColor, extraColor, 0.72f, 1f, 0.97f, 0f);
            extraBg.raycastTarget = false;
            fcExtra = Label(fcExtraBox, "Text", 8, 0, 290, 16, 9.5f, Hex("#f3dc9a"), FontStyle.Bold);

            // 戦闘詳細（反撃・スキルの効果）
            fcDetailBox = Place(NewRect("Detail", forecastRoot), 310, 180, 300, 36);
            Framed(fcDetailBox, "panel_even", 5f);
            fcDetailText = Label(fcDetailBox, "Text", 10, 5, 280, 26, 8, Hex("#e2d4b4", 0.85f));
            fcDetailText.alignment = TextAnchor.UpperLeft;
            fcDetailBox.gameObject.SetActive(false);

            // 下のボタン: キャンセル（B2）・攻撃する（F3）・戦闘詳細（B2）
            fcCancel = FrameButton(forecastRoot, "Cancel", 237, 359, 94, 25, "button_b2_normal", "button_b2_pressed", 12f, "back", "キャンセル", 9.5f, Hex("#ecd28e", 0.92f), out _, out _);
            fcConfirm = FrameButton(forecastRoot, "Confirm", 349, 359, 146, 25, "button_f3_normal", "button_f3_pressed", 12f, "cross", "攻撃する", 11f, Hex("#fff2d0"), out fcConfirmLabel, out fcConfirmIcon);
            fcDetail = FrameButton(forecastRoot, "DetailButton", 513, 359, 94, 25, "button_b2_normal", "button_b2_pressed", 12f, "detail", "戦闘詳細", 9.5f, Hex("#ecd28e", 0.92f), out _, out _);
            fcCancel.onClick.AddListener(() => controller.CancelForecast());
            fcConfirm.onClick.AddListener(() => controller.ConfirmAttack());
            fcDetail.onClick.AddListener(() => fcDetailBox.gameObject.SetActive(!fcDetailBox.gameObject.activeSelf));
        }

        private RawImage Bust(RectTransform panel, string name, float x, bool mirrored)
        {
            var box = Place(NewRect(name, panel), x, 7, 154, 118);
            var mask = box.gameObject.AddComponent<RectMask2D>();
            mask.padding = Vector4.zero;
            var image = NewRect("Image", box).gameObject.AddComponent<RawImage>();
            Stretch(image.rectTransform);
            if (mirrored) image.rectTransform.localScale = new Vector3(-1f, 1f, 1f);
            // 帯の内側へ薄くなる（ブラウザ版の mask の代わりに、帯の地の色を重ねる）
            var fade = NewRect("Fade", box).gameObject.AddComponent<Image>();
            Stretch(fade.rectTransform);
            var bandColor = new Color(21 / 255f, 16 / 255f, 29 / 255f, 1f);
            fade.sprite = mirrored ? GradientSprite(bandColor, bandColor, 0f, 0.3f, 1f, 0f) : GradientSprite(bandColor, bandColor, 0.7f, 1f, 0f, 1f);
            fade.raycastTarget = false;
            return image;
        }

        private ForecastSide Side(RectTransform panel, string name, float x)
        {
            var side = new ForecastSide();
            var root = Place(NewRect(name, panel), x, 7, 147, 118);
            side.name = Label(root, "Name", 3, 4, 96, 16, 11, Parchment, FontStyle.Bold);
            side.level = Label(root, "Level", 96, 6, 47, 12, 8.5f, Faint, anchor: TextAnchor.MiddleRight);
            var iconBox = Place(NewRect("WeaponIcon", root), 3, 22, 17, 17);
            iconBox.gameObject.AddComponent<Image>().color = Hex("#4c286e", 0.55f);
            Outline(iconBox, Hex("#d6a740", 0.45f));
            side.weaponIcon = Place(NewRect("Icon", iconBox), 1, 1, 15, 15).gameObject.AddComponent<Image>();
            side.weaponIcon.preserveAspect = true;
            side.weapon = Label(root, "Weapon", 25, 21, 90, 19, 9.5f, Parchment, FontStyle.Bold);
            if (name == "SideLeft")
            {
                // 攻撃の切り替え（届く攻撃が2つ以上あるとき。ブラウザ版の ‹ 破壊 1/2 ›）
                fcPrev = TextButton(root, "Prev", 22, 21, 12, 19, "‹");
                fcNext = TextButton(root, "Next", 131, 21, 12, 19, "›");
                fcCount = Label(root, "Count", 104, 22, 26, 17, 7.5f, Hex("#e2d4b4", 0.55f), anchor: TextAnchor.MiddleRight);
                fcPrev.onClick.AddListener(() => { controller.CycleForecastOption(-1); stateKey = null; });
                fcNext.onClick.AddListener(() => { controller.CycleForecastOption(1); stateKey = null; });
            }
            side.note = Label(root, "Note", 100, 22, 43, 17, 7.5f, Hex("#e9927e", 0.85f), anchor: TextAnchor.MiddleRight);
            Place(NewRect("Rule", root), 3, 41, 139, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.16f);
            Label(root, "HP", 3, 42, 16, 22, 8, GoldDeep, FontStyle.Bold);
            var bar = Place(NewRect("Bar", root), 25, 51, 61, 4);
            bar.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0.6f);
            Outline(bar, Hex("#c8922a", 0.16f));
            side.hpLost = NewRect("Lost", bar).gameObject.AddComponent<Image>();
            side.hpLost.color = Hex("#ecd28e", 0.28f);
            side.hpAfter = NewRect("After", bar).gameObject.AddComponent<Image>();
            side.hpValue = Label(root, "HpValue", 88, 43, 55, 20, 13, Parchment, FontStyle.Bold, TextAnchor.MiddleRight);
            side.hpValue.supportRichText = true;
            side.values = new Text[3];
            string[] labels = { "ダメージ", "命中", "必殺" };
            for (int i = 0; i < 3; i++)
            {
                float y = 64 + i * 16.5f;
                Label(root, labels[i], 17, y, 80, 16, 8.5f, Faint);
                side.values[i] = Label(root, labels[i] + "Value", 90, y - 1, 51, 17, 11, Parchment, FontStyle.Bold, TextAnchor.MiddleRight);
                Place(NewRect("Rule" + i, root), 3, y + 16, 139, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.12f);
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
            bool showCard = sel != null && !forecastOpen;
            unitCard.gameObject.SetActive(showCard);
            weaponCard.gameObject.SetActive(showCard);
            if (showCard) FillCard(sel);
            if (preview != null) FillForecast(preview.attacker, preview.target, preview.forecast, preview.option, true);
            else if (forecastOpen) FillForecast(sel, tgt, controller.CurrentForecast, controller.CurrentOption, false);
            FillCommands(forecastOpen);
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
            phaseEn.gameObject.SetActive(!forecastOpen);
            phaseJa.gameObject.SetActive(!forecastOpen);
            phaseEdge.gameObject.SetActive(!forecastOpen);
            turnGroup.gameObject.SetActive(!forecastOpen);
            phaseEn.text = ended ? "BATTLE END" : enemy ? "ENEMY PHASE" : "ALLY PHASE";
            phaseJa.text = ended ? "戦闘終了" : enemy ? "敵フェーズ" : "味方フェーズ";
            phaseEdge.color = enemy ? Hex("#c95a4a") : Hex("#d6a740");
            phaseJa.color = enemy ? Hex("#f0a27f") : Hex("#efd081");
            phaseEn.color = enemy ? Hex("#e56e4e", 0.7f) : Hex("#d6a740", 0.62f);
            turnValue.text = controller.Turn.ToString();
        }

        private void FillRoster(bool forecastOpen)
        {
            if (controller.Units.Count(u => u.Side == "ally") != rosterSlots.Count)
            {
                Object.DestroyImmediate(roster.gameObject);
                BuildRoster();
                roster.SetSiblingIndex(1);
            }
            roster.gameObject.SetActive(!forecastOpen && !RosterCollapsed);
            rosterToggle.gameObject.SetActive(!forecastOpen);
            PlaceRosterToggle();
            rosterToggle.SetSiblingIndex(roster.GetSiblingIndex() + 1);   // 一覧のすぐ上（戦況の画面などより下）
            foreach (var slot in rosterSlots)
            {
                var unit = controller.Units.FirstOrDefault(u => u.Id == slot.id);
                if (unit == null) continue;
                bool dead = !unit.Alive;
                bool done = !dead && unit.acted;
                bool selectedNow = controller.Selected == unit;
                slot.frame.sprite = SpriteOf(selectedNow ? "face_frame_selected" : done ? "face_frame_done" : "face_frame");
                slot.face.color = dead || done ? new Color(0.32f, 0.3f, 0.34f, 1f) : Color.white;
                slot.done.gameObject.SetActive(done);
                SetBar(slot.hpFill.rectTransform, unit.plan == null ? 0f : (float)unit.plan.hp / Math.Max(1, unit.plan.maxHp));
                var group = slot.frame.transform.parent.GetComponent<CanvasGroup>();
                if (group == null) group = slot.frame.transform.parent.gameObject.AddComponent<CanvasGroup>();
                group.alpha = dead ? 0.28f : 1f;
            }
        }

        private void FillCard(Battle3DController.UnitState unit)
        {
            uiUnits.TryGetValue(unit.Id, out var ui);
            cardName.text = unit.Name;
            cardLevel.text = ui?.levelLabel ?? "";
            cardClass.text = ui?.className ?? "";
            cardMove.text = ui?.moveLabel ?? $"移動{unit.source.move}";
            var cardFace = ui != null ? portraits.FirstOrDefault(p => p.name == ui.portrait + "_card").texture : null;
            if (cardFace != null) { cardPortrait.texture = cardFace; cardPortrait.enabled = true; cardPortrait.uvRect = new Rect(0, 0, 1, 1); }
            else SetPortrait(cardPortrait, ui, ui?.cardUv);
            int hp = unit.plan?.hp ?? 0, maxHp = Math.Max(1, unit.plan?.maxHp ?? 1);
            int mp = unit.plan?.mp ?? 0, maxMp = Math.Max(1, ui?.maxMp ?? Math.Max(mp, 1));
            cardHpFill.rectTransform.anchorMax = new Vector2(Mathf.Clamp01((float)hp / maxHp), 1f);
            cardMpFill.rectTransform.anchorMax = new Vector2(Mathf.Clamp01((float)mp / maxMp), 1f);
            cardHpValue.text = $"{hp}<size=8><color=#e0bd738c>/{maxHp}</color></size>";
            cardMpValue.text = $"{mp}<size=8><color=#e0bd738c>/{maxMp}</color></size>";
            bool enemy = unit.Side == "enemy";
            cardFrame.sprite = SpriteOf(enemy ? "panel_even_enemy" : "panel_even") ?? cardFrame.sprite;

            cardHpFill.sprite = enemy ? GradientSprite(Hex("#b8423c"), Hex("#e0645a")) : GradientSprite(Hex("#3fbf82"), Hex("#59e48c"));

            weaponName.text = ui?.weaponName ?? "装備なし";
            weaponIcon.sprite = WeaponSprite(ui?.weaponType);
            weaponIcon.enabled = weaponIcon.sprite != null;
            string[] values = { ui?.weaponPower, ui?.weaponRange, ui?.weaponHit, ui?.weaponCrit };
            for (int i = 0; i < 4; i++) weaponValues[i].text = values[i] ?? "―";
        }

        private void FillForecast(Battle3DController.UnitState attacker, Battle3DController.UnitState defender, BattlePlan.Forecast fc, BattleOption option, bool readOnly)
        {
            bool magic = option != null ? option.isMagic : attacker.plan.HasGrimoireSpell;
            bool special = option != null && (option.isArt || option.isMagic);
            // 敵の攻撃の前の予測は見るだけ（ボタンなし・見出しは赤。ブラウザ版の「敵の攻撃」）
            fcTitle.text = readOnly ? "敵の攻撃" : "戦闘予測";
            fcTitle.color = readOnly ? Hex("#e9927e") : Hex("#efd081");
            fcCancel.gameObject.SetActive(!readOnly);
            fcConfirm.gameObject.SetActive(!readOnly);
            fcDetail.gameObject.SetActive(!readOnly);
            uiUnits.TryGetValue(attacker.Id, out var a);
            uiUnits.TryGetValue(defender.Id, out var d);
            SetPortrait(leftBust, a, a?.bustUv);
            SetPortrait(rightBust, d, d?.bustUv);

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
            side.hpAfter.sprite = unit.Side == "enemy" ? GradientSprite(Hex("#b8423c"), Hex("#e0645a")) : GradientSprite(Hex("#2aa7a0"), Hex("#58e0c8"));
            side.hpValue.text = hpAfter == hp
                ? $"{hp}<size=7><color=#d6a740b3> ▶ </color></size>{hp}"
                : $"{hp}<size=7><color=#d6a740b3> ▶ </color></size><color=#ffe2a0>{hpAfter}</color>";
            side.values[0].text = strike == null ? "─" : follow != null ? $"{strike.damage}×2" : $"{strike.damage}";
            side.values[1].text = strike == null ? "─" : $"{strike.hitRate}%";
            side.values[2].text = strike == null ? "─" : $"{strike.critRate}%";
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
            commandList.anchoredPosition = new Vector2(758f - width, commandList.anchoredPosition.y);
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
                Battle3DController.Mode.Moving => $"{sel.Name}の移動先を選ぶか、右のコマンドを選んでください。",
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
            foreach (var rt in new[] { commandList, unitCard, weaponCard, roster, rosterToggle })
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
