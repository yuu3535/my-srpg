using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 回る太陽盤（2026-11-13 総合担当。原作者「太陽盤は回転させれるようにしておこう！あれは気持ちよかった」）。
    /// 試作 太陽盤_コマンド試作01（wheel.js・wheel-math.js）を写した: 札を押すと、その札が針の先へ回ってくる（ばね）。外の輪は札と一緒に、
    /// 針（光の線）は動いた札の数だけ次の菱形へ回る。上下になぞっても回せる（離すといちばん近い札で止まる）。↑↓ でも回せ、Enter で決める。
    /// 札を押したときは、回り終わってからその項目を開く。部品の絵は tools/export_sun_dial_layers.cjs で書き出した Resources/Menu/Dial/。
    /// 回った位置は Hub2 と支援会話の画面で共有する（支援会話へ行くと、太陽盤は回ったまま右側だけが変わる）
    /// </summary>
    public class SunDialView : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        // ── 共有の状態（画面が変わっても、回った位置を保つ） ──
        private static class State
        {
            public static int selected = 1, rayStep = 1, pending = -1, serial;   // serial: 札を選ぶたびに増える（同じ札を押し直したら点火し直す）
            public static float phase, target, velocity, needle, needleTarget, needleVelocity;
            public static bool ready;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        public static void ResetState()
        {
            var g = SunDialMath.Make();
            State.selected = SunDialMath.IndexOf("出撃");
            float initial = -2f * g.pitch;
            State.target = State.phase = SunDialMath.TargetFor(initial, State.selected, g);
            State.rayStep = Mathf.RoundToInt((State.target - initial) / g.pitch);
            State.needleTarget = State.needle = SunDialMath.NeedleFor(State.rayStep).angle + g.focusAngle;
            State.velocity = State.needleVelocity = 0f;
            State.pending = -1;
            State.ready = true;
        }

        public static string SelectedLabel { get { Ensure(); return SunDialMath.Commands[State.selected]; } }
        public static bool Settled { get { Ensure(); return State.phase == State.target && State.needle == State.needleTarget; } }

        /// <summary>回さずに、すぐその札を針の先へ（支援会話の画面を直接開いたときなど）</summary>
        public static void SnapTo(string label)
        {
            Ensure();
            int i = SunDialMath.IndexOf(label);
            if (i < 0 || i == State.selected && Settled) return;
            var g = SunDialMath.Make();
            float next = SunDialMath.TargetFor(State.target, i, g);
            State.rayStep += Mathf.RoundToInt((next - State.target) / g.pitch);
            State.selected = i;
            State.target = State.phase = next;
            State.needleTarget = State.needle = SunDialMath.NeedleFor(State.rayStep).angle + g.focusAngle;
            State.velocity = State.needleVelocity = 0f;
            State.pending = -1;
        }

        private static void Ensure() { if (!State.ready) ResetState(); }

        // ── 作る ──

        /// <summary>parent（左上原点・1688×780 の座標の太陽盤のまとまり 668×780）に太陽盤を作る。interactive=false は飾り（支援会話の画面）</summary>
        public static SunDialView Create(RectTransform parent, bool interactive, Action<string> onCommand)
        {
            Ensure();
            var rt = new GameObject("SunDial", typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = Vector2.zero;
            rt.sizeDelta = new Vector2(668f, 780f);
            var view = rt.gameObject.AddComponent<SunDialView>();
            view.interactive = interactive;
            view.onCommand = onCommand;
            view.Build();
            view.Apply(0f);
            return view;
        }

        private bool interactive;
        private Action<string> onCommand;
        private SunDialMath.Geometry g;
        private RectTransform ring, rays;
        private readonly List<Plate> plates = new List<Plate>();
        private Font font;
        private bool dragging;
        private float clock;

        private class Plate
        {
            public RectTransform root, flame;
            public CanvasGroup group, flameGroup;
            public RawImage normal, selected, flameImg;
            public float scale = 1f;
            // 炎: 0 消えている・1 点火→燃焼・2 消火。flameT はその段に入ってからの秒
            public int stage, serial;
            public float flameT;
            public readonly List<Spark> sparks = new List<Spark>();
        }

        private class Spark
        {
            public RectTransform rt;
            public CanvasGroup group;
            public Vector2 at, move;
            public float start, peak, end, top;
        }

        /// <summary>札の入れ物（NEW の札などを付ける。中心が札のまん中、大きさ 224×88）</summary>
        public RectTransform PlateOf(string label)
        {
            int i = SunDialMath.IndexOf(label);
            return i >= 0 && i < plates.Count ? plates[i].root : null;
        }

        private static bool Still => Hub2Menu.Effect == Hub2Motion.Effect.None;

        private void Build()
        {
            g = SunDialMath.Make();
            font = Resources.Load<Font>("Fonts/ShipporiMincho-SemiBold") ?? StartMenu.FontOf();
            if (interactive)
            {
                // なぞって回すための見えない板（太陽盤のまとまり全体）
                var hit = gameObject.AddComponent<Image>();
                hit.color = new Color(0f, 0f, 0f, 0f);
            }
            ring = Layer("Ring", "Menu/Dial/dial_ring", 0f, 195f, 609f);
            var platesRoot = new GameObject("Plates", typeof(RectTransform)).GetComponent<RectTransform>();
            platesRoot.SetParent(transform, false);
            platesRoot.anchorMin = platesRoot.anchorMax = platesRoot.pivot = new Vector2(0f, 1f);
            platesRoot.sizeDelta = Vector2.zero;
            for (int i = 0; i < SunDialMath.Commands.Length; i++) plates.Add(BuildPlate(platesRoot, i));
            Layer("Disk", "Menu/Dial/dial_disk", -40f, 195f, 406f);
            rays = Layer("Rays", "Menu/Dial/dial_rays", 0f, 195f, 439f);
        }

        // 部品（中心 cx, cy・一辺 size。844×390 の座標）
        private RectTransform Layer(string name, string path, float cx, float cy, float size)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(transform, false);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(cx * 2f, -cy * 2f);
            rt.sizeDelta = new Vector2(size * 2f, size * 2f);
            var ri = rt.gameObject.AddComponent<RawImage>();
            ri.texture = Resources.Load<Texture2D>(path);
            ri.raycastTarget = false;
            return rt;
        }

        private Plate BuildPlate(RectTransform parent, int index)
        {
            string label = SunDialMath.Commands[index];
            var p = new Plate();
            var rt = new GameObject("Cmd_" + label, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(g.cardWidth * 2f, g.height * 2f);
            p.root = rt;
            p.group = rt.gameObject.AddComponent<CanvasGroup>();
            var hit = rt.gameObject.AddComponent<Image>();
            hit.color = new Color(0f, 0f, 0f, 0f);
            hit.raycastTarget = interactive;
            float w = (g.cardWidth + 16f) * 2f, h = (g.bandHeight + 16f) * 2f;
            p.normal = Img(rt, "Plate", "Menu/Dial/plate", Vector2.zero, new Vector2(w, h));
            p.selected = Img(rt, "PlateSelected", "Menu/Dial/plate_selected", Vector2.zero, new Vector2(w, h));
            // 選択の炎（札の右の上）。連番 17コマ（試作 command-burning.js と同じ: 点火 → 燃焼のくり返し、選ぶ札が変わると消火）と火の粉
            var fl = Img(rt, "Flame", "Menu/Dial/flame_sheet", Vector2.zero, new Vector2(162f, 162f));
            p.flame = fl.rectTransform;
            p.flameImg = fl;
            p.flameGroup = fl.gameObject.AddComponent<CanvasGroup>();
            p.flameGroup.alpha = 0.83f;
            p.flameGroup.blocksRaycasts = false;
            p.flame.pivot = new Vector2(0f, 1f);
            p.flame.anchoredPosition = new Vector2((53.83f - 56f) * 2f, 52.18f * 2f);
            SetFrame(fl, 0);
            BuildSparks(p);
            p.flame.gameObject.SetActive(false);
            // 文字（16px の明朝・字間 0.12em。844 の座標なので 2倍）
            var t = new GameObject("Text", typeof(RectTransform)).GetComponent<RectTransform>();
            t.SetParent(rt, false);
            t.anchorMin = t.anchorMax = t.pivot = new Vector2(0.5f, 0.5f);
            t.sizeDelta = new Vector2(400f, 60f);
            var text = t.gameObject.AddComponent<Text>();
            text.font = font;
            text.fontSize = 32;
            text.text = label;
            text.alignment = TextAnchor.MiddleCenter;
            text.color = new Color(238f / 255f, 233f / 255f, 223f / 255f);
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            t.gameObject.AddComponent<LetterSpacing>().em = 0.12f;
            t.anchoredPosition = new Vector2(-label.Length * 0.12f * 32f / 2f, 0f);   // 字間ぶんのずれを戻す（CSS の中央寄せと同じ所へ）
            if (interactive)
            {
                var btn = rt.gameObject.AddComponent<Button>();
                btn.transition = Selectable.Transition.None;
                btn.onClick.AddListener(() => Select(index, true));
            }
            return p;
        }

        private static RawImage Img(RectTransform parent, string name, string path, Vector2 pos, Vector2 size)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            var ri = rt.gameObject.AddComponent<RawImage>();
            ri.texture = Resources.Load<Texture2D>(path);
            ri.raycastTarget = false;
            return ri;
        }

        // ── 操作 ──

        /// <summary>index の札を針の先へ回す。execute のときは、回り終わったらその項目を開く</summary>
        public void Select(int index, bool execute)
        {
            if (!interactive || index < 0 || index >= SunDialMath.Commands.Length) return;
            float next = SunDialMath.TargetFor(State.phase, index, g);
            State.rayStep += Mathf.RoundToInt((next - State.target) / g.pitch);
            State.selected = index;
            State.target = next;
            State.needleTarget = SunDialMath.NeedleFor(State.rayStep).angle + g.focusAngle;
            State.pending = execute ? index : -1;
            State.serial++;
            if (Still) { State.phase = State.target; State.needle = State.needleTarget; State.velocity = State.needleVelocity = 0f; }
        }

        public void Navigate(int direction)
        {
            int n = SunDialMath.Commands.Length;
            Select(((State.selected + direction) % n + n) % n, false);
        }

        public void OnBeginDrag(PointerEventData e)
        {
            if (!interactive) return;
            dragging = true;
            State.pending = -1;
            State.velocity = 0f;
        }

        public void OnDrag(PointerEventData e)
        {
            if (!dragging) return;
            var canvas = GetComponentInParent<Canvas>();
            float sf = canvas != null ? canvas.rootCanvas.scaleFactor : 1f;
            float dy = -e.delta.y / sf / 2f;   // 844 の座標で下へ
            State.phase += dy / g.radius * Mathf.Rad2Deg;
        }

        public void OnEndDrag(PointerEventData e)
        {
            if (!dragging) return;
            dragging = false;
            Select(SunDialMath.Centered(State.phase, g), false);
        }

        // ── 毎コマ ──

        private void Update()
        {
            float dt = Time.unscaledDeltaTime;
            clock += dt;
            if (interactive && Hub2Menu.Instance != null && Hub2Menu.Instance.State == Hub2Motion.State.Open && !SupportSelectView.IsOpen && !SupportSelectView.Talking && !SaveMenu.IsOpen && !SettingsMenu.IsOpen)
            {
                var kb = Keyboard.current;
                if (kb != null)
                {
                    if (kb.upArrowKey.wasPressedThisFrame) Navigate(-1);
                    else if (kb.downArrowKey.wasPressedThisFrame) Navigate(1);
                    else if (kb.enterKey.wasPressedThisFrame) Select(State.selected, true);
                }
            }
            if (interactive) Step(dt);
            Apply(dt);
        }

        private void Step(float dt)
        {
            if (dragging) return;
            bool settled;
            do
            {
                float step = Mathf.Min(dt, 1f / 60f);
                dt -= step;
                var w = SunDialMath.Spring(State.phase, State.velocity, State.target, step);
                State.phase = w.position; State.velocity = w.velocity;
                var r = SunDialMath.Spring(State.needle, State.needleVelocity, State.needleTarget, step, 350f, 32f);
                State.needle = r.position; State.needleVelocity = r.velocity;
                settled = w.settled && r.settled;
            } while (dt > 1e-5f);
            // 回り終わったら、押した項目を開く
            if (settled && State.pending >= 0 && State.pending == State.selected)
            {
                int i = State.pending;
                State.pending = -1;
                onCommand?.Invoke(SunDialMath.Commands[i]);
            }
        }

        private void Apply(float dt)
        {
            bool still = Still;
            ring.localEulerAngles = new Vector3(0f, 0f, -(State.phase + g.focusAngle));
            rays.localEulerAngles = new Vector3(0f, 0f, -State.needle);
            var needleRadius = SunDialMath.NeedleFor(State.rayStep).radius;
            // 札と針が合う直前に点火する（試作: 回る量の 12% 以内・針 4度以内。ばねの細かい残りは待たない）
            bool approaching = !dragging && Mathf.Abs(State.phase - State.target) <= g.pitch * 0.12f
                && Mathf.Abs(State.needle - State.needleTarget) <= 4f;
            for (int i = 0; i < plates.Count; i++)
            {
                var p = plates[i];
                bool sel = i == State.selected;
                var s = SunDialMath.SlotOf(State.phase, i, g, State.selected, needleRadius);
                p.root.anchoredPosition = new Vector2((s.left + g.cardWidth / 2f) * 2f, -s.y * 2f);
                p.group.alpha = s.opacity;
                p.group.blocksRaycasts = s.opacity >= 0.2f;
                float target = sel ? g.selectedScale : 1f;
                p.scale = still || dt <= 0f ? target : Mathf.Lerp(p.scale, target, 1f - Mathf.Exp(-dt / 0.06f));
                p.root.localScale = Vector3.one * p.scale;
                p.normal.enabled = !sel;
                p.selected.enabled = sel;
                UpdateFlame(p, sel && approaching && !still, still, dt);
            }
        }

        private void UpdateFlame(Plate p, bool lit, bool still, float dt)
        {
            if (lit && (p.stage != 1 || p.serial != State.serial)) { p.stage = 1; p.serial = State.serial; p.flameT = 0f; }
            else if (!lit && p.stage == 1) { p.stage = still ? 0 : 2; p.flameT = 0f; }
            else p.flameT += dt;
            int frame = p.stage == 0 ? -1 : FlameFrame(p.stage == 2, p.flameT);
            if (frame < 0) p.stage = 0;
            p.flame.gameObject.SetActive(frame >= 0);
            if (frame < 0) return;
            SetFrame(p.flameImg, frame);
            // 火の粉は燃えている間だけ（1.61秒のくり返し）
            float k = p.stage == 1 ? Mathf.Repeat(p.flameT, SparkCycle) / SparkCycle : -1f;
            foreach (var sp in p.sparks)
            {
                float u = k < 0f ? 0f : Mathf.Clamp01((k - sp.start) / (sp.end - sp.start));
                float e = 1f - (1f - u) * (1f - u);
                sp.rt.anchoredPosition = sp.at + sp.move * e;
                sp.group.alpha = k < sp.start || k >= sp.end ? 0f
                    : k < sp.peak ? sp.top * (k - sp.start) / (sp.peak - sp.start)
                    : sp.top * (1f - (k - sp.peak) / (sp.end - sp.peak));
            }
        }

        // ── 炎の連番（fx/command-flame-selection-v01.json・extinguish.json と同じコマと長さ。ミリ秒） ──
        private static readonly int[] IgniteMs = { 40, 45, 45, 50 };            // 1〜4コマ目（一度だけ）
        private static readonly int[] HoldMs = { 80, 80, 80, 80, 90, 90, 90 };  // 5〜11コマ目（くり返し 590ms）
        private static readonly int[] ExitMs = { 35, 35, 40, 40, 40, 10 };      // 12〜17コマ目（消火 200ms）
        private const int SheetCols = 6, SheetRows = 3;
        private const float SparkCycle = 1.61f;

        /// <summary>t 秒の炎のコマ（0〜16。flame_sheet の左上から右へ）。消火が終わったら -1</summary>
        public static int FlameFrame(bool exiting, float t)
        {
            float ms = t * 1000f, acc = 0f;
            if (exiting)
            {
                for (int i = 0; i < ExitMs.Length; i++) if (ms < (acc += ExitMs[i])) return 11 + i;
                return -1;
            }
            for (int i = 0; i < IgniteMs.Length; i++) if (ms < (acc += IgniteMs[i])) return i;
            ms = Mathf.Repeat(ms - acc, 590f);
            acc = 0f;
            for (int i = 0; i < HoldMs.Length; i++) if (ms < (acc += HoldMs[i])) return 4 + i;
            return 10;
        }

        private static void SetFrame(RawImage img, int frame)
        {
            int col = frame % SheetCols, row = frame / SheetCols;
            img.uvRect = new Rect(col / (float)SheetCols, 1f - (row + 1) / (float)SheetRows, 1f / SheetCols, 1f / SheetRows);
        }

        // 火の粉（試作 command-burning.js の seeds。192 四方の座標 → 炎の絵 162px。x, y, 半径, 横へ, 上へ, 出る時期）
        private static readonly float[,] SparkSeeds =
        {
            { 140, 155, 2.4f, 14, -54, 0 }, { 154, 144, 2f, -4, -67, 0 },
            { 168, 136, 2.6f, 20, -43, 1 }, { 130, 156, 1.9f, 30, -44, 1 },
            { 160, 120, 2.2f, 10, -48, 2 }, { 173, 132, 2f, 16, -52, 2 },
        };
        // 時期ごとの 現れ始め・いちばん濃い・消える（1.61秒の中の割合）と濃さ（試作の CSS の keyframes）
        private static readonly float[,] SparkPhases = { { 0.18f, 0.24f, 0.46f, 0.95f }, { 0.35f, 0.42f, 0.68f, 0.95f }, { 0.53f, 0.60f, 0.85f, 0.9f } };

        private static void BuildSparks(Plate p)
        {
            const float k = 162f / 192f;
            var halo = new Color(0xee / 255f, 0xd7 / 255f, 0x84 / 255f, 0.18f);
            var core = new Color(1f, 0xf6 / 255f, 0xdc / 255f, 1f);
            for (int i = 0; i < SparkSeeds.GetLength(0); i++)
            {
                int ph = (int)SparkSeeds[i, 5];
                var rt = new GameObject("Spark" + i, typeof(RectTransform)).GetComponent<RectTransform>();
                rt.SetParent(p.flame, false);
                rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
                rt.pivot = new Vector2(0.5f, 0.5f);
                rt.sizeDelta = Vector2.zero;
                var sp = new Spark
                {
                    rt = rt, group = rt.gameObject.AddComponent<CanvasGroup>(),
                    at = new Vector2(SparkSeeds[i, 0], -SparkSeeds[i, 1]) * k,
                    move = new Vector2(SparkSeeds[i, 3], -SparkSeeds[i, 4]) * k,
                    start = SparkPhases[ph, 0], peak = SparkPhases[ph, 1], end = SparkPhases[ph, 2], top = SparkPhases[ph, 3],
                };
                sp.group.alpha = 0f;
                float r = SparkSeeds[i, 2] * k;
                Dot(rt, r * 2.6f, halo);
                Dot(rt, r, core);
                p.sparks.Add(sp);
            }
        }

        private static void Dot(RectTransform parent, float radius, Color color)
        {
            var rt = new GameObject("Dot", typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.sizeDelta = new Vector2(radius * 2f, radius * 2f);
            var ri = rt.gameObject.AddComponent<RawImage>();
            ri.texture = Hub2Textures.Disc;
            ri.color = color;
            ri.raycastTarget = false;
        }
    }
}
