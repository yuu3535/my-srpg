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
    /// 3Dの戦闘の画面のUI（1段目）: 右のコマンド一覧、左下のユニットのカードと武器のカード、下の戦闘予測の帯。
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

        [Serializable]
        public class UvRect
        {
            public float x, y, w, h;
            public Rect ToRect() => new Rect(x, y, w, h);
        }

        [Serializable]
        public class UiUnit
        {
            public string id, name, side, levelLabel, className, moveLabel;
            public int maxMp;
            public string weaponName, weaponType, weaponPower, weaponRange, weaponHit, weaponCrit;
            public string portrait;
            public UvRect cardUv, bustUv;
        }

        [Serializable]
        public class UiDataFile
        {
            public string battleId;
            public UiUnit[] units;
        }

        [SerializeField] private Battle3DController controller;
        [SerializeField] private Camera targetCamera;                                     // 盤面を映すカメラ（UIもこのカメラの前に描く）
        [SerializeField] private TextAsset uiJson;
        [SerializeField] private NamedSprite[] sprites = Array.Empty<NamedSprite>();      // UI素材（panel_even・fc_band・ボタン・武器のアイコンなど）
        [SerializeField] private NamedTexture[] portraits = Array.Empty<NamedTexture>();  // 立ち絵（キャラの id）

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
        private readonly List<GameObject> commandItems = new List<GameObject>();
        private ForecastSide leftSide, rightSide;
        private RawImage leftBust, rightBust;
        private Button fcCancel, fcConfirm, fcDetail;
        private Text fcConfirmLabel, fcTitle;
        private Image fcConfirmIcon;
        private RectTransform fcDetailBox;
        private Text fcDetailText;
        private string stateKey;

        private class ForecastSide
        {
            public Text name, level, weapon, hpValue, note;
            public Image weaponIcon, hpLost, hpAfter;
            public Text[] values;
        }

        public bool Built => canvas != null;

        private void Start()
        {
            if (!Built) Build();
        }

        private void LateUpdate() => Refresh();

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
            font = Font.CreateDynamicFontFromOSFont(new[] { "Noto Serif JP", "Yu Mincho", "游明朝", "MS PMincho", "Hiragino Mincho ProN" }, 16);

            var canvasObject = new GameObject("HUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);
            canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = targetCamera != null ? targetCamera : Camera.main;
            canvas.planeDistance = 1f;
            canvas.sortingOrder = 10;
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(ScreenW, ScreenH);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;

            // ブラウザ版の 844×390 の画面を真ん中に置き、その上の位置で並べる
            frame = NewRect("Frame", canvasObject.transform);
            frame.anchorMin = frame.anchorMax = new Vector2(0.5f, 0.5f);
            frame.pivot = new Vector2(0.5f, 0.5f);
            frame.sizeDelta = new Vector2(ScreenW, ScreenH);

            BuildUnitCard();
            BuildWeaponCard();
            BuildCommandList();
            BuildHint();
            BuildForecast();

            if (Application.isPlaying && EventSystem.current == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
                es.transform.SetParent(transform, false);
            }
            stateKey = null;
            Refresh();
        }

        public void Clear()
        {
            for (int i = transform.childCount - 1; i >= 0; i--) Object.DestroyImmediate(transform.GetChild(i).gameObject);
            canvas = null;
            commandItems.Clear();
        }

        private void BuildUnitCard()
        {
            unitCard = Place(NewRect("UnitCard", frame), 130, 279, 244, 86);
            cardFrame = Framed(unitCard, "panel_even", 7f);
            var face = Place(NewRect("Portrait", unitCard), 7, 7, 62, 72);
            face.gameObject.AddComponent<Image>().color = new Color(3 / 255f, 4 / 255f, 10 / 255f, 0.8f);
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
            string key = $"{controller.CurrentPhase}|{controller.CurrentMode}|{sel?.Id}|{sel?.plan?.hp}|{sel?.plan?.mp}|{sel?.cell}|{tgt?.Id}|{tgt?.plan?.hp}|{controller.Turn}|{controller.Units.Count(u => u.acted)}";
            if (key == stateKey) return;
            stateKey = key;

            bool forecastOpen = controller.CurrentMode == Battle3DController.Mode.Forecast && controller.CurrentForecast != null && sel != null && tgt != null;
            forecastRoot.gameObject.SetActive(forecastOpen);
            if (!forecastOpen) fcDetailBox.gameObject.SetActive(false);
            bool showCard = sel != null && !forecastOpen;
            unitCard.gameObject.SetActive(showCard);
            weaponCard.gameObject.SetActive(showCard);
            if (showCard) FillCard(sel);
            if (forecastOpen) FillForecast(sel, tgt, controller.CurrentForecast);
            FillCommands(forecastOpen);
            hintBar.gameObject.SetActive(!forecastOpen);   // 戦闘予測のときは下のボタンが出る
            hintText.text = HintText(forecastOpen);
        }

        private void FillCard(Battle3DController.UnitState unit)
        {
            uiUnits.TryGetValue(unit.Id, out var ui);
            cardName.text = unit.Name;
            cardLevel.text = ui?.levelLabel ?? "";
            cardClass.text = ui?.className ?? "";
            cardMove.text = ui?.moveLabel ?? $"移動{unit.source.move}";
            SetPortrait(cardPortrait, ui, ui?.cardUv);
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

        private void FillForecast(Battle3DController.UnitState attacker, Battle3DController.UnitState defender, BattlePlan.Forecast fc)
        {
            bool magic = attacker.plan.HasGrimoireSpell;
            fcTitle.text = "戦闘予測";
            uiUnits.TryGetValue(attacker.Id, out var a);
            uiUnits.TryGetValue(defender.Id, out var d);
            SetPortrait(leftBust, a, a?.bustUv);
            SetPortrait(rightBust, d, d?.bustUv);

            var check = fc.counterCheck;
            bool canCounter = fc.counter != null;
            string attackName = magic ? (attacker.plan.grimoireSpell?.name ?? "魔法") : "通常攻撃";
            FillSide(leftSide, attacker, a, attackName, magic ? "魔法" : a?.weaponType, fc.attackerHpAfter, fc.first, fc.followUp, null);
            FillSide(rightSide, defender, d, d?.weaponName ?? "装備なし", d?.weaponType, fc.defenderHpAfter, fc.counter, fc.counterFollowUp, canCounter ? null : "反撃なし");

            fcConfirmLabel.text = magic ? "実行する" : "攻撃する";
            fcConfirmIcon.sprite = magic ? WeaponSprite("魔法") : SpriteOf("icon_cross");
            fcConfirmIcon.color = magic ? Color.white : Hex("#fff2d0");
            string counter = check == null ? "反撃なし"
                : !string.IsNullOrEmpty(check.reason) ? $"反撃なし（{check.reason}）"
                : check.sealChance.HasValue && check.sealChance.Value >= 0 ? $"反撃あり（野望で{check.sealChance}%封じる）" : "反撃あり";
            var notes = fc.plan?.steps?.SelectMany(s => s.notes ?? new List<string>()).Distinct().ToList() ?? new List<string>();
            fcDetailText.text = counter + (notes.Count > 0 ? "\n" + string.Join(" / ", notes) : "");
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
            var sel = controller.Selected;
            var mode = controller.CurrentMode;
            if (controller.CurrentPhase == Battle3DController.Phase.Ally && !forecastOpen)
            {
                if (sel != null && (mode == Battle3DController.Mode.Moving || mode == Battle3DController.Mode.Acting))
                {
                    bool magic = sel.plan != null && sel.plan.HasGrimoireSpell;
                    entries.Add((magic ? "magic" : "attack", magic ? "魔法" : "攻撃", () => controller.ChooseAttack(), controller.CanAttackFromHere));
                    entries.Add(("wait", "待機", () => controller.ChooseWait(), true));
                    if (controller.CanUndoMove) entries.Add(("back", "戻る", () => controller.UndoMove(), true));
                }
                else if (sel != null && mode == Battle3DController.Mode.Targeting)
                {
                    entries.Add(("back", "取り消し", () => controller.CancelTargeting(), true));
                }
                else if (sel == null)
                {
                    entries.Add(("wait", "ターン終了", () => controller.EndTurn(), true));
                }
            }
            commandList.gameObject.SetActive(entries.Count > 0);
            if (entries.Count == 0) return;
            commandList.sizeDelta = new Vector2(118, entries.Count * 30 + 15);
            for (int i = 0; i < entries.Count; i++)
            {
                var (icon, label, action, enabled) = entries[i];
                var row = Place(NewRect("Command_" + label, commandList), 8, 7 + i * 30, 102, 30);
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
                var text = Label(row, "Label", 36, 0, 64, 30, 12, color);
                text.text = label;
                if (i > 0) Place(NewRect("Rule", row), 4, 0, 94, 1).gameObject.AddComponent<Image>().color = Hex("#c8922a", 0.2f);
                commandItems.Add(row.gameObject);
            }
        }

        private string HintText(bool forecastOpen)
        {
            var sel = controller.Selected;
            switch (controller.CurrentPhase)
            {
                case Battle3DController.Phase.Enemy: return "敵フェーズ";
                case Battle3DController.Phase.Victory: return "勝利";
                case Battle3DController.Phase.Defeat: return "敗北";
            }
            if (forecastOpen) return $"{controller.Target.Name}への攻撃を実行しますか。";
            if (sel == null) return "動かす味方を選んでください。";
            return controller.CurrentMode switch
            {
                Battle3DController.Mode.Moving => $"{sel.Name}の移動先を選ぶか、右のコマンドを選んでください。",
                Battle3DController.Mode.Targeting => "攻撃する相手を選んでください。",
                _ => $"{sel.Name}の行動を選んでください。",
            };
        }

        /// <summary>画面上の位置がUIの上か（そこを押しても盤面のマスを押したことにしない）</summary>
        public bool IsOverHud(Vector2 screenPosition)
        {
            if (!Built) return false;
            var cam = canvas.worldCamera;
            foreach (var rt in new[] { commandList, unitCard, weaponCard })
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
            text.fontStyle = style;
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

        private static Color Hex(string hex, float alpha = 1f)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            c.a = alpha;
            return c;
        }
    }
}
