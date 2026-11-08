using System;
using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 拠点メニュー Hub2 の開閉（切り裂き）の時刻表と幾何（2026-11-09）。画面に触れない。
    /// 試作 アイコン素材/携帯端末メニュー画面素材/メニュー開閉演出_比較01/hub2-sweep-model.js の切り裂き・短い版・節目・飛ばすを写したもの。
    /// 数値の正本: docs/10-design/ui/MENU_OPEN_MOTION_SPEC_2026-11-06.md「Hub2 の開閉（正）」。座標は基準 1688×780 の左上原点・下向き＋Y
    /// </summary>
    public static class Hub2Motion
    {
        public const float BaseWidth = 1688f, BaseHeight = 780f;
        public const float NoneFade = 0.15f;   // 「なし」・OSの動きを減らす設定

        public enum Effect { Full, Short, None }   // 設定「端末の演出：あり／短い／なし」
        public enum Length { Short, Long }
        public enum Kind { Close, Open }
        public enum Phase { Flare, Cut, Hold, Open }

        /// <summary>各段の長さ（秒）</summary>
        public struct Durations
        {
            public float flare, cut, hold, open, land, fade;
            public Durations(float flare, float cut, float hold, float open, float land, float fade)
            { this.flare = flare; this.cut = cut; this.hold = hold; this.open = open; this.land = land; this.fade = fade; }
        }

        // 長い版（節目に開くとき）と短い版（普段）。試作の tear・tearShort と同じ数
        public static readonly Durations LongTear = new Durations(0.20f, 0.55f, 0.06f, 0.62f, 0.50f, 0f);
        public static readonly Durations ShortTear = new Durations(0.08f, 0.22f, 0.02f, 0.30f, 0.20f, 0f);
        public const float Margin = 120f, Peak = 0.22f, Spread = 4200f, Tail = 420f;
        public const int Samples = 32;

        public static Durations TearDurations(Effect effect, Length length)
        {
            if (effect == Effect.None) return new Durations(0, 0, 0, 0, 0, NoneFade);
            return effect == Effect.Full && length == Length.Long ? LongTear : ShortTear;
        }

        public static float Clamp01(float v) => float.IsNaN(v) ? 0f : Mathf.Clamp01(v);

        /// <summary>CSS の cubic-bezier と同じ（x から y を二分探索で求める）</summary>
        public static float Bezier(float x1, float y1, float x2, float y2, float value)
        {
            float x = Clamp01(value);
            if (x == 0f || x == 1f) return x;
            float Axis(float t, float a, float b) => 3f * (1 - t) * (1 - t) * t * a + 3f * (1 - t) * t * t * b + t * t * t;
            float lo = 0f, hi = 1f;
            for (int i = 0; i < 24; i++) { float mid = (lo + hi) / 2f; if (Axis(mid, x1, x2) < x) lo = mid; else hi = mid; }
            return Axis((lo + hi) / 2f, y1, y2);
        }

        public static float CutEase(float p) => Bezier(0.6f, 0f, 0.4f, 1f, p);
        public static float OpenEase(float p) => Mathf.Pow(Clamp01(p), 2.2f);

        // ── 幾何 ──

        /// <summary>切れ目の線。S＝流星の出る所（押した星の中心）、B＝左下の角、A＝S から B と反対へのばして画面の端に当たる所</summary>
        public struct Geometry
        {
            public float width, height, L, back;
            public Vector2 S, A, B, A2, B2, u, n;
        }

        public static Geometry TearGeometry(float width, float height, Vector2 start)
        {
            var g = new Geometry { width = width, height = height, S = start, B = new Vector2(0f, height) };
            Vector2 d = g.S - g.B;
            float len = d.magnitude;
            g.u = -d / len;
            g.n = new Vector2(-g.u.y, g.u.x);
            var cands = new List<float>();
            if (g.u.x < 0) cands.Add((g.S.x - width) / g.u.x);
            if (g.u.y > 0) cands.Add((g.S.y - 0f) / g.u.y);
            float back = 1e9f;
            foreach (var c in cands) if (c >= 0 && c < back) back = c;
            if (back >= 1e9f) back = 0f;
            g.back = Mathf.Max(0f, back);
            g.A = g.S - g.u * g.back;
            g.A2 = g.A - g.u * Margin;
            g.B2 = g.B + g.u * Margin;
            g.L = Vector2.Distance(g.A2, g.B2);
            return g;
        }

        /// <summary>試作と同じ既定: 星は右上（右から54・上から58）</summary>
        public static Geometry TearGeometry() => TearGeometry(BaseWidth, BaseHeight, new Vector2(BaseWidth - 54f, 58f));

        /// <summary>裂け目の幅の形（流星の出た側がいちばん広く、反対の端は閉じたまま）</summary>
        public static float TearShape(float v) => v <= Peak ? Mathf.Sqrt(v / Peak) : (1f - v) / (1f - Peak);

        /// <summary>裂け目の上側・下側の点の列</summary>
        public static void TearLens(float o, Geometry g, List<Vector2> upper, List<Vector2> lower)
        {
            upper.Clear(); lower.Clear();
            float D = Spread * OpenEase(o);
            for (int i = 0; i <= Samples; i++)
            {
                float v = i / (float)Samples;
                Vector2 p = g.A2 + (g.B2 - g.A2) * v;
                float w = D * TearShape(v);
                upper.Add(p + g.n * w);
                lower.Add(p - g.n * w);
            }
        }

        public static bool InsideLens(float o, float x, float y, Geometry g)
        {
            Vector2 p = new Vector2(x, y) - g.A2;
            float v = Vector2.Dot(p, g.u) / g.L;
            if (v <= 0f || v >= 1f) return false;
            return Mathf.Abs(Vector2.Dot(p, g.n)) <= Spread * OpenEase(o) * TearShape(v);
        }

        /// <summary>流星（切れ目の先）。走りながら大きくなり、終わりに小さくなる</summary>
        public struct Meteor { public Vector2 pos; public float scale, rotate, angle; }

        public static Meteor MeteorAt(float c, Geometry g)
        {
            float p = Clamp01(c), k = CutEase(p);
            return new Meteor
            {
                pos = g.S + (g.B2 - g.S) * k,
                scale = p < 0.3f ? 1f + 0.7f * (p / 0.3f) : 1.7f - 1.3f * ((p - 0.3f) / 0.7f),
                rotate = 540f * k,
                angle = Mathf.Atan2(g.u.y, g.u.x) * Mathf.Rad2Deg,
            };
        }

        // ── 時刻 ──

        /// <summary>
        /// ある時刻の見え方。menu＝メニューを出す、explore＝探索側の MENU の星を出す。
        /// clipInside＝裂け目の中だけメニュー（開く）、clipOutside＝裂け目の外だけメニュー（閉じる）。
        /// burst＝CLOSE の星が弾ける（0〜1。-1は無し）、exploreBurst＝MENU の星が弾ける、land＝CLOSE の星の着地（-1は無し）
        /// </summary>
        public struct Frame
        {
            public bool menu, explore, done, hasTear, clipInside, clipOutside;
            public float menuOpacity, burst, exploreBurst, land, total;
            public Phase phase;
            public float c, o;   // 切れ目の進み（0〜1）・裂けの進み（0〜1）
        }

        public static Frame TearFrame(Kind kind, float seconds, Effect effect, Length length)
        {
            var d = TearDurations(effect, length);
            float t = Mathf.Max(0f, float.IsNaN(seconds) ? 0f : seconds);
            var f = new Frame { burst = -1f, exploreBurst = -1f, land = -1f, menuOpacity = 1f };
            if (d.fade > 0f)
            {
                float p = Clamp01(t / d.fade);
                f.total = d.fade;
                f.done = p >= 1f;
                if (kind == Kind.Close) { f.menu = p < 1f; f.menuOpacity = 1f - p; f.explore = p >= 1f; }
                else { f.menu = true; f.menuOpacity = p; f.explore = false; }
                return f;
            }
            float a = d.flare, b = a + d.cut, cc = b + d.hold, e = cc + d.open;
            f.total = kind == Kind.Open ? e + d.land : e;
            f.done = t >= f.total;
            if (t < e)
            {
                f.hasTear = true;
                if (t < a) { f.phase = Phase.Flare; }
                else if (t < b) { f.phase = Phase.Cut; f.c = Clamp01((t - a) / d.cut); }
                else if (t < cc) { f.phase = Phase.Hold; f.c = 1f; }
                else { f.phase = Phase.Open; f.c = 1f; f.o = Clamp01((t - cc) / d.open); }
            }
            float burstQ = a > 0f ? Clamp01(t / a) : 1f;
            if (kind == Kind.Close)
            {
                bool gone = t >= e;
                f.menu = !gone; f.explore = gone;
                f.clipOutside = f.hasTear && f.phase == Phase.Open;
                f.burst = gone ? -1f : burstQ;
                return f;
            }
            bool shown = t >= cc;
            f.menu = shown; f.explore = !shown;
            f.clipInside = f.hasTear && f.phase == Phase.Open;
            f.exploreBurst = shown ? -1f : burstQ;
            f.land = t < e ? (shown ? 0f : -1f) : Clamp01((t - e) / d.land);
            return f;
        }

        /// <summary>星が弾ける（1.5倍に膨らみつつ回転 → 縮んで消える）</summary>
        public static (float scale, float rotate, float opacity) BurstPose(float q)
        {
            float p = Clamp01(q);
            if (p < 0.5f) { float k = p / 0.5f; return (1f + 0.5f * k, 90f * k, 1f); }
            float k2 = (p - 0.5f) / 0.5f;
            return (1.5f * (1f - k2), 90f + 90f * k2, 1f - k2);
        }

        /// <summary>CLOSE の星の着地（1.7倍・-90°から弾むように戻る）</summary>
        public static (float scale, float rotate, float opacity) LandPose(float q)
        {
            float p = Clamp01(q), k = Bezier(0.34f, 1.56f, 0.64f, 1f, p);
            return (1.7f + (1f - 1.7f) * k, -90f + 90f * k, Mathf.Min(1f, p * 4f));
        }

        // ── 節目（長い版を流すとき） ──

        public const string ReasonChapter = "chapter", ReasonEvent = "event", ReasonBattle = "battle", ReasonBoot = "boot", ReasonDay = "day";
        private static readonly string[] MilestoneOrder = { ReasonChapter, ReasonEvent, ReasonBattle };

        public static string ReasonName(string reason) => reason switch
        {
            ReasonChapter => "章の始まり",
            ReasonEvent => "メインイベントが変わった",
            ReasonBattle => "物語の戦闘に勝った",
            ReasonBoot => "起動して最初",
            ReasonDay => "その日の最初",
            _ => "",
        };

        [Serializable]
        public class Milestones
        {
            public string lastDay;   // 最後に開いたゲームの中の日（null なら未だ）
            public string pending;   // 次に開くときに長い版にする理由（章・イベント・戦闘）
            public bool booted;      // 起動・ロードしてから開いたか
        }

        /// <summary>節目が起きた（シナリオ側から）。すでに理由があれば重い方（章＞イベント＞戦闘）を残す</summary>
        public static void MarkMilestone(Milestones s, string reason)
        {
            int i = Array.IndexOf(MilestoneOrder, reason);
            if (i < 0) return;
            int keep = string.IsNullOrEmpty(s.pending) ? -1 : Array.IndexOf(MilestoneOrder, s.pending);
            if (keep >= 0 && keep < i) return;
            s.pending = reason;
        }

        /// <summary>次に開くときの長さと理由</summary>
        public static (Length length, string reason) OpenLength(Effect effect, Milestones s, string day)
        {
            if (effect != Effect.Full) return (Length.Short, null);
            if (!string.IsNullOrEmpty(s.pending)) return (Length.Long, s.pending);
            if (!s.booted) return (Length.Long, ReasonBoot);
            if (s.lastDay != day) return (Length.Long, ReasonDay);
            return (Length.Short, null);
        }

        /// <summary>開いたあと（長くても短くても）。理由を消し、今日は開いた、と覚える</summary>
        public static void AfterOpen(Milestones s, string day) { s.lastDay = day; s.pending = null; s.booted = true; }

        // ── 開閉の状態 ──

        public enum State { Open, Closed, Opening, Closing }

        /// <summary>開閉の状態。演出中に受け付けるのは「飛ばす」だけ（原作者 2026-11-09）</summary>
        public class Machine
        {
            public State State { get; private set; } = State.Closed;
            public Kind Kind { get; private set; }
            public float Elapsed { get; private set; }
            public Length Length { get; private set; } = Length.Short;
            public bool Locked => State == State.Opening || State == State.Closing;

            public Machine(State start = State.Closed) { State = start; }

            public bool Close(Length len = Length.Short)
            {
                if (State != State.Open) return false;
                State = State.Closing; Kind = Kind.Close; Elapsed = 0f; Length = len; return true;
            }

            public bool Open(Length len = Length.Short)
            {
                if (State != State.Closed) return false;
                State = State.Opening; Kind = Kind.Open; Elapsed = 0f; Length = len; return true;
            }

            /// <summary>演出中に押したら最後まで飛ばす</summary>
            public bool Skip() { if (!Locked) return false; Finish(); return true; }

            public void Step(float seconds, Effect effect)
            {
                if (!Locked) return;
                Elapsed += Mathf.Max(0f, float.IsNaN(seconds) ? 0f : seconds);
                if (TearFrame(Kind, Elapsed, effect, Length).done) Finish();
            }

            public Frame Current(Effect effect)
            {
                if (Locked) return TearFrame(Kind, Elapsed, effect, Length);
                bool open = State == State.Open;
                return new Frame { menu = open, explore = !open, menuOpacity = 1f, burst = -1f, exploreBurst = -1f, land = open ? 1f : -1f, done = true };
            }

            /// <summary>確認用: 途中の時刻に置く</summary>
            public void Scrub(Kind kind, float seconds, Length len)
            {
                State = kind == Kind.Close ? State.Closing : State.Opening;
                Kind = kind; Elapsed = Mathf.Max(0f, seconds); Length = len;
            }

            private void Finish() { State = Kind == Kind.Close ? State.Closed : State.Open; Elapsed = 0f; }
        }

        // ── ページ送りの菱形（色が巡る） ──

        // 水色→藤色→赤→金を20秒で1周（各色約3.4秒止まって約1.6秒で移る）。隣は1色ずつずらす
        public static readonly Color32[] DiaCycle =
        {
            new Color32(79, 163, 168, 255), new Color32(158, 146, 182, 255), new Color32(184, 72, 78, 255), new Color32(226, 176, 74, 255),
        };
        public const float DiaPeriod = 20f, DiaHop = 9f;

        /// <summary>i 番目の菱形の、t 秒の色</summary>
        public static Color DiaColor(int i, float t)
        {
            float slot = DiaPeriod / DiaCycle.Length;             // 5秒で1色
            float x = ((t / slot) + i) % DiaCycle.Length;
            if (x < 0) x += DiaCycle.Length;
            int from = (int)x;
            float within = (x - from) * slot, hold = 3.4f;
            float k = within <= hold ? 0f : Mathf.SmoothStep(0f, 1f, (within - hold) / (slot - hold));
            return Color.Lerp(DiaCycle[from], DiaCycle[(from + 1) % DiaCycle.Length], k);
        }

        /// <summary>9秒に1回、左から右へ波のように小さく跳ねる（上へ5px、0.13秒ずつずらす）。戻り値は上へのずれ（px）</summary>
        public static float DiaHopOffset(int i, float t)
        {
            float local = (t % DiaHop) - i * 0.13f;
            if (local < 0f || local > 0.36f) return 0f;
            return 5f * Mathf.Sin(local / 0.36f * Mathf.PI);
        }
    }
}
