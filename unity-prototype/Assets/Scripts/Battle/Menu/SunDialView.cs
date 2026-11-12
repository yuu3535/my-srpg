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
            public static int selected = 1, rayStep = 1, pending = -1;
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
        private float clock, flameAge = 10f;
        private int litIndex = -1;

        private class Plate
        {
            public RectTransform root, flame;
            public CanvasGroup group;
            public RawImage normal, selected, flameImg;
            public float scale = 1f;
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
            // 選択の炎（札の右の上。揺れの支点は絵の 17%・83%）
            var fl = Img(rt, "Flame", "Menu/Dial/flame", Vector2.zero, new Vector2(162f, 162f));
            p.flame = fl.rectTransform;
            p.flameImg = fl;
            p.flame.pivot = new Vector2(0.17f, 0.17f);
            float fx = (53.83f - 56f) * 2f, fy = 52.18f * 2f;
            p.flame.anchoredPosition = new Vector2(fx + 0.17f * 162f, fy - 0.83f * 162f);
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
            if (interactive && Hub2Menu.Instance != null && Hub2Menu.Instance.State == Hub2Motion.State.Open && !SupportSelectView.IsOpen && !SaveMenu.IsOpen && !SettingsMenu.IsOpen)
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
            bool settled = State.phase == State.target;
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
                // 炎: 回り終わった選択の札だけ。点いたときに膨らみ、そのあとゆっくり揺れる
                bool lit = sel && settled && !still;
                if (lit && litIndex != i) { litIndex = i; flameAge = 0f; }
                if (!lit && litIndex == i) litIndex = -1;
                p.flame.gameObject.SetActive(lit);
                if (lit)
                {
                    flameAge += dt;
                    float burst = FlameBurst(flameAge);
                    float sway = FlameSway(clock);
                    p.flame.localScale = new Vector3(1f, burst * sway, 1f);
                    p.flameImg.color = new Color(1f, 1f, 1f, 0.83f * Mathf.Clamp01(flameAge / 0.2f));
                }
            }
        }

        /// <summary>点いたときの膨らみ（0.72秒: 0.45 → 1.22 → 1.06 → 1）</summary>
        public static float FlameBurst(float t)
        {
            float p = t / 0.72f;
            if (p >= 1f) return 1f;
            if (p < 0.28f) return Mathf.Lerp(0.45f, 1.22f, Ease(p / 0.28f));
            if (p < 0.62f) return Mathf.Lerp(1.22f, 1.06f, Ease((p - 0.28f) / 0.34f));
            return Mathf.Lerp(1.06f, 1f, Ease((p - 0.62f) / 0.38f));
        }

        /// <summary>選んだ札の炎の揺れ（2.6秒: 1 → 1.06 → 0.97 → 1.03 → 1）</summary>
        public static float FlameSway(float t)
        {
            float p = Mathf.Repeat(t, 2.6f) / 2.6f;
            if (p < 0.25f) return Mathf.Lerp(1f, 1.06f, Mathf.SmoothStep(0f, 1f, p / 0.25f));
            if (p < 0.55f) return Mathf.Lerp(1.06f, 0.97f, Mathf.SmoothStep(0f, 1f, (p - 0.25f) / 0.30f));
            if (p < 0.8f) return Mathf.Lerp(0.97f, 1.03f, Mathf.SmoothStep(0f, 1f, (p - 0.55f) / 0.25f));
            return Mathf.Lerp(1.03f, 1f, Mathf.SmoothStep(0f, 1f, (p - 0.8f) / 0.2f));
        }

        private static float Ease(float x) => 1f - Mathf.Pow(1f - Mathf.Clamp01(x), 3f);
    }
}
