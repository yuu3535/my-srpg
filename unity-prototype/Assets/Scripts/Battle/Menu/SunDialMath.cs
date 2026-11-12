using System;
using UnityEngine;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 回る太陽盤の計算（試作 アイコン素材/携帯端末メニュー画面素材/太陽盤_コマンド試作01/wheel-math.js をそのまま写した。2026-11-13）。
    /// 座標は 844×390（太陽盤の中心は (0, 195)。下向きが＋Y、角度は時計回りが＋）。画面に触れない
    /// </summary>
    public static class SunDialMath
    {
        /// <summary>札の並び（独立ホームの名前）。この順で弧の上を回る</summary>
        public static readonly string[] Commands = { "身支度", "出撃", "探索", "支援会話", "セーブ" };

        public static int IndexOf(string label) => Array.IndexOf(Commands, label);

        // 針の先（太陽盤の絵の上の菱形の先。絵は 1254px、表示は 439px）
        private static readonly Vector2 Tip = new Vector2((1184f - 627f) * 439f / 1254f, (319f - 627f) * 439f / 1254f);
        public static readonly float TipRadius = Tip.magnitude;
        private static readonly int[,] DiamondTips = { { 1184, 319 }, { 629, 7 }, { 70, 319 }, { 71, 934 }, { 628, 1220 }, { 1184, 934 } };

        public const float DefaultGap = -12f;

        /// <summary>配置（アルシェの作者指定値: gap −27・帯の高さ 31・外の輪 609）</summary>
        public struct Geometry
        {
            public float gap, inset, height, radius, outerRadius, bandHeight, pitch, period, focusAngle, cardWidth, textPadding, selectedScale;
        }

        public static Geometry Make(float gap = -27f, float scale = 1f, float size = 609f, float bandHeight = 31f)
        {
            gap = Mathf.Clamp(gap, -40f, 40f);
            float height = Mathf.Max(44f, Mathf.Min(60f, 44f / scale));
            float radius = TipRadius + Mathf.Max(DefaultGap, gap);
            float pitch = Mathf.Min(20f, Mathf.Asin((195f - 12f - height / 2f) / radius) * Mathf.Rad2Deg / 2f);
            float outer = Mathf.Max(radius + 76f, Mathf.Clamp(size, 440f, 740f) * 0.48f);
            return new Geometry
            {
                gap = gap, inset = Mathf.Min(0f, gap - DefaultGap), height = height, radius = radius, outerRadius = outer,
                bandHeight = Mathf.Clamp(bandHeight, 18f, 38f), pitch = pitch, period = pitch * Commands.Length, focusAngle = 0f,
                cardWidth = 112f, textPadding = 16f, selectedScale = 1.18f,
            };
        }

        public static float Mod(float v, float p) => ((v % p) + p) % p;

        public static float AngleFor(float phase, int index, Geometry g) => Mod(index * g.pitch + phase + g.period / 2f, g.period) - g.period / 2f;

        /// <summary>index の札を針の位置（角度 0）へ持ってくる phase</summary>
        public static float TargetFor(float phase, int index, Geometry g) => phase - AngleFor(phase, index, g);

        public struct Needle { public float angle, radius; public int index; }

        /// <summary>針（光の線）の step 番目の菱形の角度。絵は完全な60度の対称ではないので、測った先の位置で止める</summary>
        public static Needle NeedleFor(int step)
        {
            int i = (int)Mod(step, 6);
            float x = DiamondTips[i, 0] - 627f, y = DiamondTips[i, 1] - 627f;
            float angle = Mod(-Mathf.Atan2(y, x) * Mathf.Rad2Deg, 360f) + Mathf.Floor(step / 6f) * 360f;
            return new Needle { angle = angle, radius = Mathf.Sqrt(x * x + y * y) * 439f / 1254f, index = i };
        }

        public struct Slot { public int index; public float angle, left, y, opacity; }

        /// <summary>各札の位置（左の辺 left・まん中の高さ y）と濃さ（上下の端で消える）</summary>
        public static Slot SlotOf(float phase, int index, Geometry g, int selected, float needleRadius)
        {
            float angle = AngleFor(phase, index, g), rad = angle * Mathf.Deg2Rad;
            float y = 195f + g.radius * Mathf.Sin(rad);
            float innerX = g.radius * Mathf.Cos(rad);
            // 文字は左右対称の余白へ。上下の札だけ必要な分を外へ逃がして針の輪郭を避ける
            float nearestY = Mathf.Max(0f, Mathf.Abs(y - 195f) - 9f);
            float rayEnvelope = Mathf.Sqrt(Mathf.Max(0f, TipRadius * TipRadius - nearestY * nearestY));
            float left = Mathf.Max(innerX, rayEnvelope - g.textPadding + 4f) + g.inset;
            if (index == selected)
            {
                // 選んだ札の左の切れ込みの奥を、今向いている針の先へ合わせる
                float notch = g.cardWidth / 2f * (1f - g.selectedScale) + 21f / 140f * g.cardWidth * g.selectedScale;
                float correction = needleRadius - TipRadius + 0.75f - (DefaultGap + notch);
                float approach = Mathf.Max(0f, 1f - Mathf.Abs(angle - g.focusAngle) / g.pitch);
                left += correction * approach * approach * (3f - 2f * approach);
            }
            float toEdge = Mathf.Min(angle + g.period / 2f, g.period / 2f - angle);
            float opacity = Mathf.Clamp01(toEdge / (g.pitch * 0.4f));
            return new Slot { index = index, angle = angle, left = left, y = y, opacity = opacity };
        }

        /// <summary>ばね（試作と同じ。1回に進める時間は 1/30 秒まで）</summary>
        public static (float position, float velocity, bool settled) Spring(float position, float velocity, float target, float dt, float stiffness = 180f, float damping = 26f)
        {
            dt = Mathf.Clamp(dt, 0f, 1f / 30f);
            velocity += ((target - position) * stiffness - damping * velocity) * dt;
            position += velocity * dt;
            bool settled = Mathf.Abs(target - position) < 0.025f && Mathf.Abs(velocity) < 0.08f;
            return (settled ? target : position, settled ? 0f : velocity, settled);
        }

        /// <summary>針の位置（角度 0）にいちばん近い札</summary>
        public static int Centered(float phase, Geometry g)
        {
            int best = 0;
            float d = float.MaxValue;
            for (int i = 0; i < Commands.Length; i++)
            {
                float a = Mathf.Abs(AngleFor(phase, i, g) - g.focusAngle);
                if (a < d) { d = a; best = i; }
            }
            return best;
        }
    }
}
