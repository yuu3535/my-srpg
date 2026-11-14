using System;
using System.Collections.Generic;
using Srpg.Battle.Menu;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 2Dの探索の画面の部品（探索の仕様書 explore_spec.md・探索の札 E。2026-11-14 総合担当）。
    /// 場所札・左右の矢印・ヒント・チップスの印・画面の端の印・札（調べる・話す）・出口の案内・床の印・縁の光・廊下への暗転。
    /// 座標は 1688×780（左上が原点）。部屋の物の位置は Corridor2DView.ScreenOf で画面の位置へ直す。
    /// 当たり判定・歩く・調べるは Explore2DController（ExploreHit）が決める。ここは見せることと、押されたことを伝えるだけ
    /// </summary>
    public class ExploreOverlay : MonoBehaviour
    {
        public const float W = 1688f, H = 780f;

        /// <summary>見せる物1つ（ExploreHit.Target に見た目の情報を足した物）</summary>
        public class Item
        {
            public ExploreHit.Target target;
            public string verb, name;          // 「調べる」「収納箱」など
            public string rim;                 // 縁の光のマスク（Resources/Explore/Rim/<rim>_glow など）。なければ光らない
            public Rect rimRect;               // マスクの位置（部屋の座標）
            public float delay;                // ときどき1周の光の開始のずれ（秒）
            public bool got;                   // 拾得物を取ったあと（チップスと同じ扱い）
            public string exitJp, exitEn;      // 出口の案内（「廊下へ」「EXIT」）
            public Rect plate;                 // 出口の案内の位置（部屋の座標。幅 150 × 60、右寄せ）。幅 0 なら指す点から決める
        }

        // ── 色（仕様書の値） ──
        private static readonly Color Ink = Hex("#f6f4ef"), Sub = Hex("#dcd8cf"), Check = Hex("#e4e7ec"), TalkCol = Hex("#4fa3a8"),
            Silver = Hex("#eef0f4"), PlateCol = new Color(9 / 255f, 10 / 255f, 13 / 255f), LineCol = new Color(214 / 255f, 218 / 255f, 224 / 255f),
            Accent = Hex("#e4e7ec"), AccentGlow = new Color(214 / 255f, 226 / 255f, 240 / 255f), Muted = Hex("#a8a49c");

        public Action<Vector2> Tapped;        // 部屋を押した（画面の点）
        public Action CardPressed, AlsoPressed;
        public Action<int> ArrowTapped;       // 矢印を短く押した（−1 左・1 右）

        private Explore2DController owner;
        private Corridor2DView view;
        private Font font, fontBold, fontEn;
        private RectTransform root, content, layerMarks, layerCard, layerTop, arrowsRoot;
        private CanvasGroup group;
        private readonly List<Item> items = new List<Item>();
        private readonly List<Mark> marks = new List<Mark>();
        private readonly List<Rim> rims = new List<Rim>();
        private readonly List<Plate> plates = new List<Plate>();
        private Arrow left, right;
        private Text hint;
        private RectTransform placeTab;
        private float clock;
        private Material bandMaterial;

        // 選んでいる物の札
        private Item selected, also;
        private RectTransform card, leader, pointRoot;
        private CanvasGroup cardGroup;
        private float cardTime = -1f, pressTime = -1f;
        private RawImage underline, pointRing;
        private PolyGraphic leaderDark, leaderLight;
        private RectTransform cardText, alsoRow;

        // 暗転
        private RectTransform exitFx;
        private CanvasGroup exitGroup;
        private RectTransform exitLabel;

        private class Mark { public Item item; public RectTransform rt; public CanvasGroup cg; public bool edge; }
        private class Rim { public Item item; public RawImage glow, rim, rimDark, band; public Material mat; public float g, r, b; }
        private class Plate { public Item item; public RectTransform rt; }
        private class Arrow { public RectTransform rt, art; public CanvasGroup cg; public int dir; public float down = -1f; public bool running; public RawImage glow; }

        private static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }
        private static Color A(Color c, float a) => new Color(c.r, c.g, c.b, a);
        private static Color Lt(Color c, float a) => new Color(c.r, c.g, c.b, Hub2Textures.SeenLight(a, 0.9f, 0.12f));
        private static Color Dk(Color c, float a) => new Color(c.r, c.g, c.b, Hub2Textures.Seen(a));

        public static ExploreOverlay Create(Explore2DController owner, Corridor2DView view)
        {
            var go = new GameObject("ExploreOverlay", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            // 場面のいちばん上に置く（部屋の組み立て直しで、Corridor2DView の子は消されるため）
            var canvas = go.GetComponent<Canvas>();
            // 部屋・会話の画面と同じくカメラに描く（画面にじかに描くと、カメラに描く会話の枠より必ず手前になり、
            // 会話の枠を押しても進まなかった。2026-11-14）。部屋（−10・距離 1）より手前、会話（200・距離 0.9）より奥
            var cam = Camera.main;
            if (cam != null) { canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = cam; canvas.planeDistance = 0.95f; }
            else canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 150;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(W, H);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;   // Hub2 と同じ
            var o = go.AddComponent<ExploreOverlay>();
            o.owner = owner;
            o.view = view;
            o.Build();
            return o;
        }

        // ── 組み立て ──

        private void Build()
        {
            font = Resources.Load<Font>("Fonts/ShipporiMincho-SemiBold") ?? StartMenu.FontOf();
            fontBold = Resources.Load<Font>("Fonts/ShipporiMincho-ExtraBold") ?? font;
            fontEn = Resources.Load<Font>("Fonts/BarlowCondensed-SemiBold") ?? font;
            var shader = Resources.Load<Shader>("Explore/RimBand");
            if (shader != null) bandMaterial = new Material(shader);
            root = (RectTransform)transform;

            // 部屋を押す（全面の透明な面）
            var catcher = Node("Tap", root);
            catcher.anchorMin = Vector2.zero; catcher.anchorMax = Vector2.one; catcher.sizeDelta = Vector2.zero;
            catcher.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var trig = catcher.gameObject.AddComponent<EventTrigger>();
            var e = new EventTrigger.Entry { eventID = EventTriggerType.PointerClick };
            e.callback.AddListener(d => Tapped?.Invoke(((PointerEventData)d).position));
            trig.triggers.Add(e);

            content = Node("Content", root);
            content.anchorMin = content.anchorMax = content.pivot = new Vector2(0.5f, 0.5f);
            content.sizeDelta = new Vector2(W, H);
            group = content.gameObject.AddComponent<CanvasGroup>();   // 会話・メニューの間は隠す（暗転は別。root の下）
            layerMarks = Box("Marks");
            layerTop = Box("Top");
            arrowsRoot = Box("Arrows");
            layerCard = Box("Card");
            left = BuildArrow(-1);
            right = BuildArrow(1);
            hint = Label(layerMarks, "◆　行きたい場所をタップ　◆", font, 18, Lt(Silver, 0.9f), 0.14f);
            hint.alignment = TextAnchor.MiddleCenter;
            Place(hint.rectTransform, 0f, 716f - 14f, W, 28f);
            Shadow(hint, 0.9f);
            hint.gameObject.SetActive(false);
            BuildExitFx();
        }

        private RectTransform Box(string name)
        {
            var b = Node(name, content);
            b.anchorMin = b.anchorMax = b.pivot = new Vector2(0f, 1f);   // 左上（1688×780 の左上が原点）
            b.sizeDelta = Vector2.zero;
            b.anchoredPosition = Vector2.zero;
            return b;
        }

        // ── 場所札（上中央。会話枠 H と同じ） ──

        public void SetPlace(string chapter, string room)
        {
            if (placeTab != null) Destroy(placeTab.gameObject);
            placeTab = Node("PlaceTab", layerTop);
            placeTab.anchorMin = placeTab.anchorMax = placeTab.pivot = new Vector2(0f, 1f);
            placeTab.sizeDelta = Vector2.zero;
            const float TH = 43f;
            float x = 92f;
            var texts = Node("Texts", placeTab);
            texts.anchorMin = texts.anchorMax = texts.pivot = new Vector2(0f, 1f);
            texts.sizeDelta = Vector2.zero;
            var en = Label(texts, chapter ?? "", fontEn, 15, Accent, 0.34f);
            Place(en.rectTransform, x, 12f, 400f, 18f); en.alignment = TextAnchor.MiddleLeft;
            x += Width(en, 0.34f) + 18f;
            var line = Fill(texts, x, 12f + 9f, 30f, 1f, Accent);
            x += 30f + 18f;
            var name = Label(texts, room ?? "", fontBold, 20, Hex("#f1efe9"), 0.14f);
            Place(name.rectTransform, x, 10f, 600f, 22f); name.alignment = TextAnchor.MiddleLeft;
            Shadow(name, 0.9f);
            x += Width(name, 0.14f);
            float tw = x + 92f;
            var fill = Poly(placeTab, A(PlateCol, Hub2Textures.Seen(0.92f * 0.86f)));
            fill.Set(new[] { new Vector2(0, 0), new Vector2(tw, 0), new Vector2(tw - 44f, -TH), new Vector2(44f, -TH) }, PolyGraphic.Mode.Fill);
            var edge = Poly(placeTab, Lt(LineCol, 0.72f));
            edge.Set(new[] { new Vector2(0, 0), new Vector2(44f, -TH), new Vector2(tw - 44f, -TH), new Vector2(tw, 0) }, PolyGraphic.Mode.Stroke, false, 1.4f);
            fill.transform.SetAsFirstSibling();
            edge.transform.SetSiblingIndex(1);
            Diamond(placeTab, 43.5f, TH + 0.5f, 7f, Accent, true);
            Diamond(placeTab, tw - 43.5f, TH + 0.5f, 7f, Accent, true);
            placeTab.anchoredPosition = new Vector2(W / 2f - tw / 2f, 0f);
        }

        // ── 物（チップスの印・縁の光・出口の案内） ──

        public void SetItems(IEnumerable<Item> list)
        {
            items.Clear();
            items.AddRange(list);
            foreach (var m in marks) if (m.rt != null) Destroy(m.rt.gameObject);
            foreach (var p in plates) if (p.rt != null) Destroy(p.rt.gameObject);
            marks.Clear(); plates.Clear();
            foreach (var it in items)
            {
                if (it.target.kind == ExploreHit.Kind.Exit) { plates.Add(new Plate { item = it, rt = BuildExitPlate(it) }); continue; }
                if (it.target.kind == ExploreHit.Kind.Tips || it.target.kind == ExploreHit.Kind.Item) marks.Add(BuildMark(it, false));
                if (it.target.kind == ExploreHit.Kind.Item) marks.Add(BuildMark(it, true));
            }
            BuildRims();
            if (selected != null && !items.Contains(selected)) ClearSelect();
        }

        /// <summary>縁の光（部屋と一緒に動く層へ。組み立て直したら呼び直す）</summary>
        public void BuildRims()
        {
            foreach (var r in rims) { if (r.glow != null) Destroy(r.glow.transform.parent.gameObject); if (r.mat != null) Destroy(r.mat); }
            rims.Clear();
            var layer = view != null ? view.WorldLayer : null;
            if (layer == null) return;
            foreach (var it in items)
            {
                if (string.IsNullOrEmpty(it.rim)) continue;
                var gTex = Resources.Load<Texture2D>("Explore/Rim/" + it.rim + "_glow");
                var rTex = Resources.Load<Texture2D>("Explore/Rim/" + it.rim + "_rim");
                var bTex = Resources.Load<Texture2D>("Explore/Rim/" + it.rim + "_band");
                if (rTex == null) continue;
                var box = Node("Rim_" + it.target.id, layer);
                box.anchorMin = box.anchorMax = box.pivot = new Vector2(0f, 1f);
                // 部屋の座標（1688 の細かさ）→ 場所の座標（844 の細かさ）
                box.anchoredPosition = new Vector2(it.rimRect.x / 2f, -it.rimRect.y / 2f);
                box.sizeDelta = new Vector2(it.rimRect.width / 2f, it.rimRect.height / 2f);
                var r = new Rim { item = it };
                // 白っぽい所でも見えるよう、暗い縁取り（drop-shadow の代わりに少しずらした暗い写し）
                r.rimDark = Raw(box, rTex, new Color(10 / 255f, 6 / 255f, 14 / 255f, 0f));
                Stretch(r.rimDark.rectTransform); r.rimDark.rectTransform.anchoredPosition = new Vector2(0f, -0.8f);
                r.glow = Raw(box, gTex, A(Silver, 0f)); Stretch(r.glow.rectTransform);
                r.rim = Raw(box, rTex, A(Silver, 0f)); Stretch(r.rim.rectTransform);
                if (bTex != null && bandMaterial != null)
                {
                    r.band = Raw(box, bTex, A(Silver, 0f)); Stretch(r.band.rectTransform);
                    r.mat = new Material(bandMaterial);
                    r.mat.SetFloat("_Aspect", it.rimRect.width / Mathf.Max(1f, it.rimRect.height));
                    r.band.material = r.mat;
                }
                rims.Add(r);
            }
        }

        private Mark BuildMark(Item it, bool edge)
        {
            var rt = Node(edge ? "Edge_" + it.target.id : "Tip_" + it.target.id, layerMarks);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = Vector2.zero;
            var cg = rt.gameObject.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            if (edge)
            {
                var gl = Raw(rt, Hub2Textures.Glow, A(AccentGlow, 0.5f)); Size(gl.rectTransform, 40f);
                Diamond(rt, 0f, 0f, 12f, Silver, false).anchoredPosition = Vector2.zero;
            }
            else
            {
                // 30×30 の正方形を45°回した菱形（外側 42）。枠 1px・中は暗く・影
                var shadow = Raw(rt, Hub2Textures.Glow, Dk(Color.black, 0.55f)); Size(shadow.rectTransform, 60f); shadow.rectTransform.anchoredPosition = new Vector2(0f, -2f);
                var fillD = Raw(rt, Hub2Textures.Diamond, A(PlateCol, Hub2Textures.Seen(0.86f))); Size(fillD.rectTransform, 42.4f);
                var ring = Raw(rt, ExploreTextures.DiamondRing, Lt(Hex("#e4e7ec"), 0.7f)); Size(ring.rectTransform, 42.4f);
                var icon = Raw(rt, ExploreTextures.Magnifier, Check); Size(icon.rectTransform, 16f);
            }
            return new Mark { item = it, rt = rt, cg = cg, edge = edge };
        }

        private RectTransform BuildExitPlate(Item it)
        {
            var rt = Node("Exit_" + it.target.id, layerMarks);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = Vector2.zero;
            return rt;   // 中身は毎コマ（画面の位置が動くので）LayoutExitPlate で
        }

        // ── 矢印 ──

        private Arrow BuildArrow(int dir)
        {
            var a = new Arrow { dir = dir };
            a.rt = Node(dir < 0 ? "ArrowLeft" : "ArrowRight", arrowsRoot);
            Place(a.rt, dir < 0 ? 0f : 1588f, 290f, 100f, 200f);
            a.cg = a.rt.gameObject.AddComponent<CanvasGroup>();
            // 画面の端から内側へ薄くなる暗がり（.62 → 0）
            var shade = Raw(a.rt, Hub2Textures.Gradient("explore_edge", Color.black, new Vector2(0f, 0f), new Vector2(1f, 1f)), Dk(Color.black, 0.62f));
            Stretch(shade.rectTransform);
            if (dir < 0) shade.uvRect = new Rect(1f, 0f, -1f, 1f);
            var hit = Node("Hit", a.rt); Stretch(hit);
            hit.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var trig = hit.gameObject.AddComponent<EventTrigger>();
            void On(EventTriggerType t, Action act) { var en = new EventTrigger.Entry { eventID = t }; en.callback.AddListener(_ => act()); trig.triggers.Add(en); }
            On(EventTriggerType.PointerDown, () => { a.down = Time.unscaledTime; a.running = false; });
            On(EventTriggerType.PointerUp, () => ReleaseArrow(a));
            On(EventTriggerType.PointerExit, () => { if (a.down >= 0f && a.running) ReleaseArrow(a); });
            // 絵（右向きで描いて、左は裏返す）。細い線 → 8px の菱形 → 手前の薄い「›」→ 太い「›」
            a.art = Node("Art", a.rt);
            a.art.anchorMin = a.art.anchorMax = a.art.pivot = new Vector2(0f, 1f);
            a.art.sizeDelta = new Vector2(100f, 200f);
            a.art.anchoredPosition = Vector2.zero;
            if (dir < 0) { a.art.pivot = new Vector2(0.5f, 0.5f); a.art.anchoredPosition = new Vector2(50f, -100f); a.art.localScale = new Vector3(-1f, 1f, 1f); }
            var art = Node("Inner", a.art);
            art.anchorMin = art.anchorMax = art.pivot = new Vector2(0f, 1f);
            art.sizeDelta = Vector2.zero;
            art.anchoredPosition = dir < 0 ? new Vector2(-50f, 100f) : Vector2.zero;
            a.glow = Raw(art, Hub2Textures.Glow, A(AccentGlow, 0f)); a.glow.rectTransform.anchorMin = a.glow.rectTransform.anchorMax = new Vector2(0f, 1f);
            a.glow.rectTransform.sizeDelta = new Vector2(90f, 140f); a.glow.rectTransform.anchoredPosition = new Vector2(70f, -100f);
            var thin = Raw(art, Hub2Textures.Gradient("explore_arrow_line", Color.white, new Vector2(0f, 0f), new Vector2(1f, 0.8f)), Silver);
            Place(thin.rectTransform, 4f, 99.5f, 26f, 1f);
            Diamond(art, 34f, 100f, 8f, Silver, false);
            Chevron(art, 46f, 100f, 16f, 37f, 1.6f, Lt(Silver, 0.5f));
            Chevron(art, 57f, 100f, 29f, 63f, 3f, Silver);
            return a;
        }

        private void Chevron(RectTransform parent, float x, float cy, float w, float h, float thick, Color col)
        {
            var p = Poly(parent, col);
            p.Soft = true;
            p.Set(new[] { new Vector2(x, -(cy - h / 2f)), new Vector2(x + w, -cy), new Vector2(x, -(cy + h / 2f)) }, PolyGraphic.Mode.Stroke, false, thick * 1.8f);
        }

        private void ReleaseArrow(Arrow a)
        {
            if (a.down < 0f) return;
            bool wasRun = a.running;
            a.down = -1f;
            a.running = false;
            if (view != null) { view.Hold(0); view.Running = false; }
            if (!wasRun) ArrowTapped?.Invoke(a.dir);
        }

        /// <summary>今、長押しで走っている向き（0＝走っていない）</summary>
        public int RunDir => left.running ? -1 : right.running ? 1 : 0;

        // ── 札 ──

        public Item Selected => selected;

        public void Select(Item it, Item alsoItem)
        {
            ClearSelect();
            if (it == null) return;
            selected = it;
            also = alsoItem;
            BuildCard();
            cardTime = 0f;
        }

        public void ClearSelect()
        {
            selected = null; also = null;
            if (card != null) Destroy(card.gameObject);
            if (leader != null) Destroy(leader.gameObject);
            if (pointRoot != null) Destroy(pointRoot.gameObject);
            card = leader = pointRoot = null;
            cardTime = pressTime = -1f;
        }

        /// <summary>札を押したときの動き（.24秒で少し縮んで明るくなって消える）。終わったら then</summary>
        public void PressCard(Action then)
        {
            if (card == null) { then?.Invoke(); return; }
            pressTime = 0f;
            pressDone = then;
        }
        private Action pressDone;

        private static bool PC => !Application.isMobilePlatform;

        private void BuildCard()
        {
            var it = selected;
            bool talk = it.target.kind == ExploreHit.Kind.Talk;
            Color col = talk ? TalkCol : Check;
            float w = ExploreHit.CardWidth(it.verb, it.name, PC);
            card = Node("Card", layerCard);
            card.anchorMin = card.anchorMax = card.pivot = new Vector2(0f, 1f);
            card.sizeDelta = new Vector2(w, 60f);
            cardGroup = card.gameObject.AddComponent<CanvasGroup>();
            // 楕円の暗がり（幅＋100 × 128。ALSO があれば 172）
            var dark = Raw(card, ExploreTextures.Ellipse, Dk(new Color(4 / 255f, 4 / 255f, 8 / 255f), 0.86f));
            dark.rectTransform.anchorMin = dark.rectTransform.anchorMax = new Vector2(0f, 1f);
            dark.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            float dh = also != null ? 172f : 128f;
            dark.rectTransform.sizeDelta = new Vector2(w + 100f, dh);
            dark.rectTransform.anchoredPosition = new Vector2(w / 2f, -(also != null ? 52f : 30f));
            // 押す所（札の全体）
            var hitArea = Node("Hit", card); Stretch(hitArea);
            hitArea.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var btn = hitArea.gameObject.AddComponent<Button>();
            btn.transition = Selectable.Transition.None;
            btn.onClick.AddListener(() => CardPressed?.Invoke());
            cardText = Node("Text", card);
            cardText.anchorMin = cardText.anchorMax = cardText.pivot = new Vector2(0f, 1f);
            cardText.sizeDelta = Vector2.zero;
            var textGroup = cardText.gameObject.AddComponent<CanvasGroup>();
            textGroup.blocksRaycasts = false;
            // 英字ラベル（アイコン 16px ＋ CHECK／TALK）・動詞・名前・ENTER
            var en = Label(cardText, talk ? "TALK" : "CHECK", fontEn, 12, col, 0.36f);
            var verb = Label(cardText, it.verb, fontBold, 27, Ink, 0.12f);
            var nm = Label(cardText, it.name, fontBold, 22, Sub, 0.08f);
            Shadow(verb, 0.95f); Shadow(nm, 0.95f); Shadow(en, 0.9f);
            float vw = Width(verb, 0.12f), nw = Width(nm, 0.08f), ew = Width(en, 0.36f);
            float lineW = vw + 14f + nw + (PC ? 14f + 48f : 0f);
            bool toRight = CardOnRight(it, w);
            float x0 = toRight ? 0f : w - lineW;
            Place(verb.rectTransform, x0, 20f, 400f, 34f); verb.alignment = TextAnchor.LowerLeft;
            Place(nm.rectTransform, x0 + vw + 14f, 24f, 400f, 30f); nm.alignment = TextAnchor.LowerLeft;
            if (PC)
            {
                float ex = x0 + vw + 14f + nw + 14f;
                var box = Poly(cardText, Lt(col, 0.7f));
                box.Set(new[] { new Vector2(ex, -31f), new Vector2(ex + 48f, -31f), new Vector2(ex + 48f, -53f), new Vector2(ex, -53f) }, PolyGraphic.Mode.Stroke, true, 1f);
                var et = Label(cardText, "ENTER", fontEn, 11, Lt(col, 0.9f), 0.2f);
                Place(et.rectTransform, ex, 31f, 48f, 22f); et.alignment = TextAnchor.MiddleCenter;
                et.rectTransform.anchoredPosition += new Vector2(-0.2f * 11f * 2.5f, 0f);
            }
            float iconX = toRight ? 0f : w - (16f + 6f + ew);
            var icon = Raw(cardText, talk ? ExploreTextures.Talk : ExploreTextures.Magnifier, col);
            Place(icon.rectTransform, iconX, 0f, 16f, 16f);
            Place(en.rectTransform, iconX + 22f, -1f, 200f, 18f); en.alignment = TextAnchor.MiddleLeft;
            // 下線（札の幅 × 1px。指す点の側が濃い .85 → 反対側へ透明）
            underline = Raw(card, Hub2Textures.Gradient("explore_underline", Color.white, new Vector2(0f, 0.85f), new Vector2(1f, 0f)), col);
            Place(underline.rectTransform, 0f, 60f, w, 1f);
            if (!toRight) underline.uvRect = new Rect(1f, 0f, -1f, 1f);
            // ALSO の行（高さ 40）
            if (also != null)
            {
                alsoRow = Node("Also", card);
                Place(alsoRow, 0f, 62f, w, 40f);
                var ah = alsoRow.gameObject.AddComponent<Image>(); ah.color = new Color(0f, 0f, 0f, 0f);
                var ab = alsoRow.gameObject.AddComponent<Button>(); ab.transition = Selectable.Transition.None;
                ab.onClick.AddListener(() => AlsoPressed?.Invoke());
                var t1 = Label(alsoRow, "ALSO", fontEn, 12, Lt(Muted, 0.9f), 0.36f);
                var t2 = Label(alsoRow, also.name + "  ›", fontBold, 20, Sub, 0.08f);
                Shadow(t2, 0.95f);
                float aw = Width(t1, 0.36f) + 12f + Width(t2, 0.08f);
                float ax0 = toRight ? 0f : w - aw;
                Place(t1.rectTransform, ax0, 10f, 120f, 20f); t1.alignment = TextAnchor.MiddleLeft;
                Place(t2.rectTransform, ax0 + Width(t1, 0.36f) + 12f, 6f, 400f, 28f); t2.alignment = TextAnchor.MiddleLeft;
            }
            // 引き出し線と指す点
            leader = Node("Leader", layerCard);
            leader.anchorMin = leader.anchorMax = leader.pivot = new Vector2(0f, 1f);
            leader.sizeDelta = Vector2.zero;
            leaderDark = Poly(leader, Color.clear); leaderDark.Soft = true;
            leaderLight = Poly(leader, Color.clear); leaderLight.Soft = true;
            pointRoot = Node("Point", layerCard);
            pointRoot.anchorMin = pointRoot.anchorMax = new Vector2(0f, 1f);
            pointRoot.pivot = new Vector2(0.5f, 0.5f);
            pointRoot.sizeDelta = Vector2.zero;
            pointRing = Raw(pointRoot, ExploreTextures.DiamondRing, col); Size(pointRing.rectTransform, 22f);
            Diamond(pointRoot, 0f, 0f, 10f, col, false).anchoredPosition = Vector2.zero;
            LayoutCard(0f);
        }

        private bool CardOnRight(Item it, float w)
        {
            var a = ScreenPoint(it.target.point);
            return ExploreHit.CardPos(a.x, a.y, w).x > a.x;
        }

        private void LayoutCard(float dt)
        {
            if (card == null || selected == null) return;
            var a = ScreenPoint(selected.target.point);
            float w = card.sizeDelta.x;
            var pos = ExploreHit.CardPos(a.x, a.y, w);
            bool toRight = pos.x > a.x;
            float t = cardTime;
            // 出方: 札 .24秒（下から10px＋縮小から）→ 引き出し線 .34秒 → 下線 .34秒（.14秒遅れ）→ 文字 .4秒（.2秒遅れ）→ 指す点がポンと
            float kCard = Ease(t / 0.24f), kLine = Ease(t / 0.34f), kUnder = Ease((t - 0.14f) / 0.34f), kText = Ease((t - 0.2f) / 0.4f), kPoint = Ease((t - 0.3f) / 0.2f);
            float press = pressTime >= 0f ? Mathf.Clamp01(pressTime / 0.24f) : 0f;
            card.anchoredPosition = new Vector2(pos.x, -(pos.y + 10f * (1f - kCard)));
            card.localScale = Vector3.one * (Mathf.Lerp(0.96f, 1f, kCard) * (1f - 0.05f * press));
            cardGroup.alpha = kCard * (1f - press);
            if (cardText != null) cardText.GetComponent<CanvasGroup>().alpha = kText;
            if (underline != null) underline.rectTransform.localScale = new Vector3(kUnder, 1f, 1f);
            if (underline != null) underline.rectTransform.pivot = new Vector2(toRight ? 0f : 1f, 0.5f);
            if (underline != null) underline.rectTransform.anchoredPosition = new Vector2(toRight ? 0f : w, -60.5f);
            // 引き出し線: 札の下の角の 18px 内側 → 指す点の 14px 上
            var from = new Vector2(toRight ? pos.x + 18f : pos.x + w - 18f, pos.y + 60f);
            var to = new Vector2(a.x, a.y - 14f);
            var mid = Vector2.Lerp(from, to, kLine);
            leaderDark.color = Dk(new Color(6 / 255f, 6 / 255f, 10 / 255f), 0.55f * (1f - press));
            leaderDark.Set(new[] { new Vector2(from.x, -from.y - 1.5f), new Vector2(mid.x, -mid.y - 1.5f) }, PolyGraphic.Mode.Stroke, false, 3f * 1.8f);
            leaderLight.color = Lt(Hex("#e4e7ec"), 0.9f * (1f - press));
            leaderLight.Set(new[] { new Vector2(from.x, -from.y), new Vector2(mid.x, -mid.y) }, PolyGraphic.Mode.Stroke, false, 1.6f);
            pointRoot.anchoredPosition = new Vector2(a.x, -a.y);
            pointRoot.localScale = Vector3.one * (kPoint < 1f ? Mathf.Lerp(0.2f, 1f, kPoint) + Mathf.Sin(kPoint * Mathf.PI) * 0.25f : 1f);
            float ring = Mathf.Repeat(clock, 2.2f) / 2.2f;
            pointRing.rectTransform.localScale = Vector3.one * Mathf.Lerp(0.6f, 1.8f, ring);
            pointRing.color = A(pointRing.color, (1f - ring) * kPoint * (1f - press));
        }

        // ── 毎コマ ──

        /// <summary>部屋の座標（1688 の細かさ）→ この画面の位置（1688×780、左上が原点）</summary>
        public Vector2 ScreenPoint(Vector2 world)
        {
            if (view == null) return world;
            var sp = view.ScreenOf(world.x / 2f, world.y / 2f);
            return OverlayOf(sp);
        }

        /// <summary>画面の点 → この画面の位置（1688×780、左上が原点）</summary>
        public Vector2 OverlayOf(Vector2 screen)
        {
            var canvas = GetComponent<Canvas>();
            var cam = canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay ? canvas.worldCamera : null;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(content, screen, cam, out var local);
            return new Vector2(local.x + W / 2f, H / 2f - local.y);
        }

        public bool Visible { get; set; } = true;
        public bool ShowLeft { get; set; }
        public bool ShowRight { get; set; }
        public bool HintOn { get => hint != null && hint.gameObject.activeSelf; set { if (hint != null) hint.gameObject.SetActive(value); } }

        private void Update()
        {
            float dt = Time.unscaledDeltaTime;
            clock += dt;
            group.alpha = Visible ? 1f : 0f;
            group.blocksRaycasts = Visible;
            if (cardTime >= 0f) cardTime += dt;
            if (pressTime >= 0f)
            {
                pressTime += dt;
                if (pressTime >= 0.24f) { var done = pressDone; pressDone = null; pressTime = -1f; done?.Invoke(); }
            }
            UpdateArrows(dt);
            UpdateMarks();
            UpdatePlates();
            UpdateRims(dt);
            LayoutCard(dt);
            if (hint != null && hint.gameObject.activeSelf)
                hint.color = Lt(Silver, Mathf.Lerp(0.45f, 0.95f, 0.5f - 0.5f * Mathf.Cos(clock / 3.4f * Mathf.PI * 2f)));
            UpdateFloorMarks(dt);
            UpdateExitFx(dt);
        }

        private void UpdateArrows(float dt)
        {
            foreach (var a in new[] { left, right })
            {
                bool show = a.dir < 0 ? ShowLeft : ShowRight;
                if (!show && a.down >= 0f && !a.running) a.down = -1f;
                a.rt.gameObject.SetActive(show || a.running);
                if (a.down >= 0f && !a.running && Time.unscaledTime - a.down >= 0.18f)
                {
                    a.running = true;   // 長押し（0.18秒から）: 押している間走る
                    if (view != null) { view.Hold(a.dir); view.Running = true; }
                }
                float period = a.running ? 0.35f : 2f;
                float sway = Mathf.Sin(clock / period * Mathf.PI * 2f) * 0.5f + 0.5f;
                a.art.anchoredPosition = a.dir < 0 ? new Vector2(50f - 3f * sway, -100f) : new Vector2(3f * sway, 0f);
                a.cg.alpha = a.running ? 1f : 0.85f;
                a.glow.color = A(AccentGlow, a.running ? 0.45f : 0f);
            }
        }

        private void UpdateMarks()
        {
            float t = clock;
            foreach (var m in marks)
            {
                var it = m.item;
                var p = ScreenPoint(it.target.point);
                bool onScreen = p.x > 0f && p.x < W;
                bool tipLike = it.target.kind == ExploreHit.Kind.Tips || it.got;
                if (m.edge)
                {
                    // 画面の外にある拾得物: その側の画面端に菱形（11秒周期で光る）
                    bool show = it.target.kind == ExploreHit.Kind.Item && !it.got && !onScreen;
                    m.rt.gameObject.SetActive(show);
                    if (!show) continue;
                    float y = Mathf.Clamp(it.target.point.y + 40f, 120f, 700f);
                    m.rt.anchoredPosition = new Vector2(p.x < 0f ? 20f : W - 20f, -y);
                    float k = Mathf.Repeat(t, 11f) / 11f;
                    m.cg.alpha = k < 0.03f ? Mathf.Lerp(0.25f, 1f, k / 0.03f) : k < 0.22f ? 1f : k < 0.28f ? Mathf.Lerp(1f, 0.25f, (k - 0.22f) / 0.06f) : 0.25f;
                    continue;
                }
                // チップスの印: 光らないチップスだけ。選んでいるとき・画面外では出さない
                bool tip = tipLike && it != selected && onScreen;
                m.rt.gameObject.SetActive(tip);
                if (!tip) continue;
                float bob = Mathf.Sin(t / 3f * Mathf.PI * 2f);
                m.rt.anchoredPosition = new Vector2(p.x, -p.y - 5f * (bob * 0.5f + 0.5f));
                m.cg.alpha = Mathf.Lerp(0.75f, 1f, bob * 0.5f + 0.5f);
            }
        }

        private void UpdatePlates()
        {
            foreach (var pl in plates)
            {
                if (pl.rt == null) continue;
                if (pl.rt.childCount == 0) LayoutExitPlate(pl);
                var it = pl.item;
                var origin = ScreenPoint(new Vector2(it.plate.width > 0f ? it.plate.x : it.target.point.x - 220f, it.plate.width > 0f ? it.plate.y : it.target.point.y - 124f));
                pl.rt.anchoredPosition = new Vector2(origin.x, -origin.y);
                bool on = origin.x > -400f && origin.x < W + 200f;
                pl.rt.gameObject.SetActive(on);
            }
        }

        /// <summary>出口の案内（押せない飾り。札と同じ作り: 枠なし・下線・引き出し線・指す点の菱形。右寄せ）</summary>
        private void LayoutExitPlate(Plate pl)
        {
            var it = pl.item;
            float pw = it.plate.width > 0f ? it.plate.width : 150f;
            // 部屋の座標での、案内の左上からの指す点の位置（画面の大きさは部屋と同じ細かさ）
            var pt = it.target.point - new Vector2(it.plate.width > 0f ? it.plate.x : it.target.point.x - 220f, it.plate.width > 0f ? it.plate.y : it.target.point.y - 124f);
            var dark = Raw(pl.rt, ExploreTextures.Ellipse, Dk(new Color(4 / 255f, 4 / 255f, 8 / 255f), 0.86f));
            dark.rectTransform.anchorMin = dark.rectTransform.anchorMax = new Vector2(0f, 1f);
            dark.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            dark.rectTransform.sizeDelta = new Vector2(250f, 128f);
            dark.rectTransform.anchoredPosition = new Vector2(pw / 2f + 2f, -30f);
            var en = Label(pl.rt, it.exitEn ?? "EXIT", fontEn, 12, Check, 0.36f);
            var jp = Label(pl.rt, it.exitJp ?? "", fontBold, 27, Ink, 0.12f);
            Shadow(jp, 0.95f); Shadow(en, 0.9f);
            float ew = Width(en, 0.36f), jw = Width(jp, 0.12f);
            Place(en.rectTransform, pw - ew, -1f, 200f, 18f); en.alignment = TextAnchor.MiddleLeft;
            var icon = Raw(pl.rt, ExitIcon(), Check);
            Place(icon.rectTransform, pw - ew - 22f, 0f, 16f, 16f);
            Place(jp.rectTransform, pw - jw, 20f, 300f, 34f); jp.alignment = TextAnchor.LowerLeft;
            var ul = Raw(pl.rt, Hub2Textures.Gradient("explore_underline", Color.white, new Vector2(0f, 0.85f), new Vector2(1f, 0f)), Check);
            Place(ul.rectTransform, 0f, 60f, pw, 1f);
            ul.uvRect = new Rect(1f, 0f, -1f, 1f);
            var from = new Vector2(pw - 18f, 60f);
            var to = new Vector2(pt.x, pt.y - 14f);
            var d = Poly(pl.rt, Dk(new Color(6 / 255f, 6 / 255f, 10 / 255f), 0.55f)); d.Soft = true;
            d.Set(new[] { new Vector2(from.x, -from.y - 1.5f), new Vector2(to.x, -to.y - 1.5f) }, PolyGraphic.Mode.Stroke, false, 5.4f);
            var l = Poly(pl.rt, Lt(Hex("#e4e7ec"), 0.9f)); l.Soft = true;
            l.Set(new[] { new Vector2(from.x, -from.y), new Vector2(to.x, -to.y) }, PolyGraphic.Mode.Stroke, false, 1.6f);
            var ring = Raw(pl.rt, ExploreTextures.DiamondRing, Lt(Check, 0.6f)); ring.rectTransform.anchorMin = ring.rectTransform.anchorMax = new Vector2(0f, 1f);
            ring.rectTransform.pivot = new Vector2(0.5f, 0.5f); ring.rectTransform.sizeDelta = new Vector2(22f, 22f); ring.rectTransform.anchoredPosition = new Vector2(pt.x, -pt.y);
            Diamond(pl.rt, pt.x, pt.y, 10f, Check, false);
        }

        private static Texture2D exitIcon;
        /// <summary>出口のしるし（逆U字の扉と右向きの矢印。16px の絵）</summary>
        private static Texture2D ExitIcon()
        {
            if (exitIcon != null) return exitIcon;
            const int S = 64;
            var t = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "ExploreExit" };
            float k = S / 16f, w = 0.9f * k;
            for (int y = 0; y < S; y++)
            for (int x = 0; x < S; x++)
            {
                var p = new Vector2(x + 0.5f, y + 0.5f) / k;
                float door = Mathf.Min(Mathf.Min(Seg(p, new Vector2(3f, 2f), new Vector2(3f, 10f)), Seg(p, new Vector2(9f, 2f), new Vector2(9f, 10f))),
                    Mathf.Abs((p - new Vector2(6f, 10f)).magnitude - 3f) + (p.y < 10f ? 99f : 0f));
                float arrow = Mathf.Min(Seg(p, new Vector2(8f, 6f), new Vector2(14f, 6f)), Mathf.Min(Seg(p, new Vector2(14f, 6f), new Vector2(12f, 8f)), Seg(p, new Vector2(14f, 6f), new Vector2(12f, 4f))));
                float dd = Mathf.Min(door, arrow) * k - w;
                t.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Clamp01(0.5f - dd / 1.2f)));
            }
            t.Apply();
            return exitIcon = t;
        }

        private static float Seg(Vector2 p, Vector2 a, Vector2 b)
        {
            var ab = b - a;
            float u = Mathf.Clamp01(Vector2.Dot(p - a, ab) / ab.sqrMagnitude);
            return (p - (a + ab * u)).magnitude;
        }

        // 縁の光（§4.2）
        private void UpdateRims(float dt)
        {
            foreach (var r in rims)
            {
                var it = r.item;
                bool sel = it == selected;
                bool item = it.target.kind == ExploreHit.Kind.Item && !it.got;
                float gT = 0f, rT = 0f, bT = 0f;
                bool two = false;
                float angle = 0f;
                if (sel)
                {
                    gT = Mathf.Lerp(0.15f, 0.32f, 0.5f - 0.5f * Mathf.Cos(clock / 2.4f * Mathf.PI * 2f));
                    rT = 0.32f; bT = 0.6f; two = true;
                    angle = Mathf.Repeat(clock / 3.6f, 1f) * 360f;
                }
                else if (item)
                {
                    rT = 0.34f;
                    // ときどき1周: 11秒ごとに、最初の約2.6秒で1周（3% で明るく、20% まで、24% で消える）
                    float k = Mathf.Repeat(clock - it.delay, 11f) / 11f;
                    angle = Mathf.Clamp01(k / 0.24f) * 360f;
                    bT = 0.55f * (k < 0.03f ? k / 0.03f : k < 0.2f ? 1f : k < 0.24f ? 1f - (k - 0.2f) / 0.04f : 0f);
                }
                // 光の出し入れは 0.4秒でふわっと（ときどき1周の明滅はそのまま）
                float step = dt / 0.4f;
                r.g = Mathf.MoveTowards(r.g, gT, step * 0.6f);
                r.r = Mathf.MoveTowards(r.r, rT, step * 0.6f);
                r.b = sel || !item ? Mathf.MoveTowards(r.b, bT, step) : bT;
                r.glow.color = Lt(Silver, r.g);
                r.rim.color = Lt(Silver, r.r);
                r.rimDark.color = new Color(10 / 255f, 6 / 255f, 14 / 255f, Hub2Textures.Seen(0.6f * Mathf.Clamp01(r.r / 0.32f)));
                if (r.band != null)
                {
                    r.band.color = Lt(Silver, r.b);
                    r.mat.SetFloat("_Angle", angle);
                    r.mat.SetFloat("_Two", two ? 1f : 0f);
                }
            }
        }

        // ── 床の印（§6.1） ──

        private readonly List<(RectTransform rt, RawImage outer, RawImage inner, RectTransform dia, float t)> floor = new List<(RectTransform, RawImage, RawImage, RectTransform, float)>();

        public void FloorMark(float x)
        {
            var rt = Node("Floor", layerMarks);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = Vector2.zero;
            rt.anchoredPosition = new Vector2(x, -752f);
            var outer = Raw(rt, ExploreTextures.EllipseRing, Lt(Silver, 0.85f)); outer.rectTransform.sizeDelta = new Vector2(128f, 30f);
            var inner = Raw(rt, ExploreTextures.EllipseRing, Lt(Silver, 0.6f)); inner.rectTransform.sizeDelta = new Vector2(68f, 16f);
            var dia = Diamond(rt, 0f, 0f, 8f, Silver, false);
            floor.Add((rt, outer, inner, dia, 0f));
        }

        private void UpdateFloorMarks(float dt)
        {
            for (int i = floor.Count - 1; i >= 0; i--)
            {
                var f = floor[i];
                f.t += dt;
                floor[i] = f;
                if (f.t >= 1.6f) { Destroy(f.rt.gameObject); floor.RemoveAt(i); continue; }
                float k = Mathf.Clamp01(f.t / 0.9f);
                float fade = 1f - Mathf.Clamp01((f.t - 0.6f) / 1.0f);
                f.outer.rectTransform.localScale = Vector3.one * Mathf.Lerp(0.4f, 1f, Ease(k));
                f.outer.color = Lt(Silver, 0.85f * (1f - k));
                f.inner.color = Lt(Silver, 0.6f * fade);
                float drop = Ease(Mathf.Clamp01(f.t / 0.3f));
                f.dia.anchoredPosition = new Vector2(0f, 10f * (1f - drop) + 4f);
                f.dia.GetComponent<RawImage>().color = Lt(Silver, fade);
            }
        }

        // ── 廊下への暗転（§7） ──

        private void BuildExitFx()
        {
            exitFx = Node("ExitFx", root);
            exitFx.anchorMin = Vector2.zero; exitFx.anchorMax = Vector2.one; exitFx.sizeDelta = Vector2.zero;
            var black = exitFx.gameObject.AddComponent<Image>();
            black.color = Hex("#050508");
            exitGroup = exitFx.gameObject.AddComponent<CanvasGroup>();
            exitGroup.alpha = 0f;
            exitGroup.blocksRaycasts = false;
            exitLabel = Node("Label", exitFx);
            exitLabel.anchorMin = exitLabel.anchorMax = exitLabel.pivot = new Vector2(0.5f, 0.5f);
            exitLabel.sizeDelta = Vector2.zero;
            exitLabel.gameObject.AddComponent<CanvasGroup>();
            exitFx.gameObject.SetActive(false);
        }

        private float exitTime = -1f;
        private Action exitBlack, exitDone;
        private bool exitSwitched;

        public bool Exiting => exitTime >= 0f;

        /// <summary>暗転（2.3秒。最初の 22% で黒くなる → 中央に「EN ── 日本語」→ onBlack（次の場所を読み込む）→ 明ける → onDone）</summary>
        public void PlayExit(string en, string jp, Action onBlack, Action onDone)
        {
            for (int i = exitLabel.childCount - 1; i >= 0; i--) Destroy(exitLabel.GetChild(i).gameObject);
            var e = Label(exitLabel, en ?? "", fontEn, 14, Accent, 0.34f);
            var j = Label(exitLabel, jp ?? "", fontBold, 22, Hex("#f1efe9"), 0.14f);
            float ew = Width(e, 0.34f), jw = Width(j, 0.14f), total = ew + 18f + 30f + 18f + jw;
            float x = -total / 2f;
            Place(e.rectTransform, 0f, 0f, 300f, 20f); e.rectTransform.anchorMin = e.rectTransform.anchorMax = new Vector2(0.5f, 0.5f); e.rectTransform.anchoredPosition = new Vector2(x, 10f); e.alignment = TextAnchor.MiddleLeft;
            x += ew + 18f;
            var line = Raw(exitLabel, null, Accent); line.rectTransform.anchorMin = line.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            line.rectTransform.pivot = new Vector2(0f, 0.5f); line.rectTransform.sizeDelta = new Vector2(30f, 1f); line.rectTransform.anchoredPosition = new Vector2(x, 0f);
            x += 30f + 18f;
            Place(j.rectTransform, 0f, 0f, 400f, 30f); j.rectTransform.anchorMin = j.rectTransform.anchorMax = new Vector2(0.5f, 0.5f); j.rectTransform.anchoredPosition = new Vector2(x, 15f); j.alignment = TextAnchor.MiddleLeft;
            exitFx.gameObject.SetActive(true);
            exitFx.SetAsLastSibling();
            exitGroup.blocksRaycasts = true;
            exitTime = 0f;
            exitSwitched = false;
            exitBlack = onBlack;
            exitDone = onDone;
            UpdateExitFx(0f);
        }

        private void UpdateExitFx(float dt)
        {
            if (exitTime < 0f) return;
            exitTime += dt;
            const float Total = 2.3f;
            float k = exitTime / Total;
            float alpha = k < 0.22f ? k / 0.22f : k < 0.7f ? 1f : Mathf.Clamp01(1f - (k - 0.7f) / 0.3f);
            exitGroup.alpha = alpha;
            float tk = Ease(Mathf.Clamp01((k - 0.22f) / 0.2f));
            exitLabel.anchoredPosition = new Vector2(-14f * (1f - tk), 0f);
            var lg = exitLabel.GetComponent<CanvasGroup>();
            lg.alpha = tk * (k < 0.7f ? 1f : Mathf.Clamp01(1f - (k - 0.7f) / 0.2f));
            if (!exitSwitched && k >= 0.3f) { exitSwitched = true; var b = exitBlack; exitBlack = null; b?.Invoke(); }
            if (k >= 1f)
            {
                exitTime = -1f;
                exitGroup.alpha = 0f;
                exitGroup.blocksRaycasts = false;
                exitFx.gameObject.SetActive(false);
                var d = exitDone; exitDone = null; d?.Invoke();
            }
        }

        // ── 小さな道具 ──

        private static float Ease(float x) { x = Mathf.Clamp01(x); return 1f - Mathf.Pow(1f - x, 3f); }

        private static RectTransform Node(string name, Transform parent)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            return rt;
        }

        private static void Stretch(RectTransform rt) { rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.sizeDelta = Vector2.zero; rt.anchoredPosition = Vector2.zero; }

        private static void Size(RectTransform rt, float s)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(s, s);
            rt.anchoredPosition = Vector2.zero;
        }

        private static RectTransform Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        private static RawImage Raw(Transform parent, Texture tex, Color col)
        {
            var rt = Node("Img", parent);
            var ri = rt.gameObject.AddComponent<RawImage>();
            ri.texture = tex;
            ri.color = col;
            ri.raycastTarget = false;
            return ri;
        }

        private static RawImage Fill(Transform parent, float x, float y, float w, float h, Color col)
        {
            var ri = Raw(parent, null, col);
            Place(ri.rectTransform, x, y, w, h);
            return ri;
        }

        private static PolyGraphic Poly(Transform parent, Color col)
        {
            var rt = Node("Poly", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = Vector2.zero;
            var p = rt.gameObject.AddComponent<PolyGraphic>();
            p.color = col;
            p.raycastTarget = false;
            return p;
        }

        /// <summary>菱形（size＝外側の四角の一辺。中心 (x, y)）。glow なら淡い光をそえる</summary>
        private static RectTransform Diamond(Transform parent, float x, float y, float size, Color col, bool glow)
        {
            var rt = Node("Diamond", parent);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(size * 1.414f, size * 1.414f);
            rt.anchoredPosition = new Vector2(x, -y);
            if (glow)
            {
                var g = Raw(rt, Hub2Textures.Glow, A(AccentGlow, 0.55f));
                Size(g.rectTransform, size * 3.2f);
            }
            var ri = rt.gameObject.AddComponent<RawImage>();
            ri.texture = Hub2Textures.Diamond;
            ri.color = col;
            ri.raycastTarget = false;
            return rt;
        }

        private Text Label(Transform parent, string text, Font f, int size, Color col, float em)
        {
            var rt = Node("Text", parent);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = f;
            t.fontSize = size;
            t.text = text;
            t.color = col;
            t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            if (em != 0f) rt.gameObject.AddComponent<LetterSpacing>().em = em;
            return t;
        }

        private static float Width(Text t, float em)
        {
            var settings = t.GetGenerationSettings(new Vector2(4000f, 200f));
            float w = t.cachedTextGeneratorForLayout.GetPreferredWidth(t.text, settings) / Mathf.Max(0.01f, t.pixelsPerUnit);
            return w + em * t.fontSize * Mathf.Max(0, (t.text?.Length ?? 0) - 1);
        }

        private static void Shadow(Text t, float a)
        {
            var s = t.gameObject.AddComponent<UnityEngine.UI.Shadow>();
            s.effectColor = new Color(0f, 0f, 0f, Hub2Textures.Seen(a) * 0.6f);
            s.effectDistance = new Vector2(0f, -1f);
        }
    }
}
