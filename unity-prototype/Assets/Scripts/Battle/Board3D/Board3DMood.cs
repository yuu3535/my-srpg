using UnityEngine;
using UnityEngine.Rendering;

namespace Srpg.Battle
{
    /// <summary>
    /// 盤面の時間帯（光・環境光・霧）。マップごとに戦闘データの timeOfDay で選ぶ（原作者 2026-09-27）。
    ///   dusk: 原作の背景素材から決めた暗めの琥珀色（MAP_COLOR_MOOD_DIRECTION_2026-09-27 の C2）
    ///   day : 明るい昼。マップチップ（明るい土の道・草原）に合わせた、白っぽい光と薄い霧
    ///   morning: 晴れた朝。やわらかく少し冷たい光（淡い桃色がかった白）と、青みの環境光・ごく薄い青紫の霧。
    ///            最初の使い道はオルクス魔王城の鍛錬場（マップ担当の配置表。原作者 2026-09-28「足す方向で検討してよい」）
    ///   night: 夜。青白い月の光と暗い紺の霧。たいまつなどの点の光が主役になる（原作者 2026-09-28: マップは使い回し、朝・昼・夜は光で変える）
    ///   hall_morning / hall_day / hall_night: 屋内の暗い広間（謁見の間。原作者 2026-09-28「もともと暗い」）。霧なし・環境光は暗め。
    ///            朝は奥のステンドグラスから差す色の光（淡い琥珀と薔薇色）、夜はほぼ燭台・魔灯（点の光）だけ。マスと人物が読める明るさは残す
    ///   キャラの板の絵は光を受けない材質なので、どの時間帯でも人物の明るさは変わらない
    /// </summary>
    public static class Board3DMood
    {
        public const string Dusk = "dusk";
        public const string Day = "day";
        public const string Morning = "morning";
        public const string Night = "night";
        public const string HallMorning = "hall_morning";
        public const string HallDay = "hall_day";
        public const string HallNight = "hall_night";

        /// <summary>屋内の時間帯か（霧を使わない）</summary>
        public static bool IsIndoor(string mood) => mood != null && mood.StartsWith("hall_");

        public static void Apply(string mood, Light light)
        {
            RenderSettings.fog = !IsIndoor(mood);
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.ambientMode = AmbientMode.Flat;
            if (IsIndoor(mood))
            {
                // 屋内の暗い広間: 環境光は暗めの紫がかった灰。窓（主の光）の強さと色で時間を表す
                (Color32 ambient, Color32 window, float strength) = mood switch
                {
                    HallMorning => (new Color32(78, 70, 96, 255), new Color32(255, 196, 176, 255), 0.8f),   // ステンドグラスの色の光
                    HallNight => (new Color32(58, 54, 80, 255), new Color32(150, 160, 210, 255), 0.18f),   // 窓はほぼ暗い。燭台だけ
                    _ => (new Color32(74, 68, 90, 255), new Color32(255, 232, 210, 255), 0.7f),   // 昼も外より暗い（もともと暗い広間）
                };
                RenderSettings.ambientLight = ambient;
                if (light != null)
                {
                    light.color = window;
                    light.intensity = strength;
                }
                return;
            }
            if (mood == Night)
            {
                RenderSettings.fogColor = new Color32(20, 26, 46, 255);
                RenderSettings.fogStartDistance = 32f;
                RenderSettings.fogEndDistance = 58f;
                RenderSettings.ambientLight = new Color32(62, 72, 106, 255);
                if (light != null)
                {
                    light.color = new Color32(170, 190, 236, 255);   // 月の光
                    light.intensity = 0.6f;
                }
                return;
            }
            if (mood == Morning)
            {
                // 晴れた朝（シナリオ「今日もいい天気だな」。マップ担当 2026-09-28）: 霧は昼より遠くから、薄く
                RenderSettings.fogColor = new Color32(184, 192, 214, 255);
                RenderSettings.fogStartDistance = 44f;
                RenderSettings.fogEndDistance = 80f;
                RenderSettings.ambientLight = new Color32(130, 140, 164, 255);
                if (light != null)
                {
                    light.color = new Color32(255, 236, 224, 255);
                    light.intensity = 1.35f;
                }
                return;
            }
            if (mood == Day)
            {
                RenderSettings.fogColor = new Color32(176, 192, 204, 255);
                RenderSettings.fogStartDistance = 38f;
                RenderSettings.fogEndDistance = 70f;
                RenderSettings.ambientLight = new Color32(140, 146, 154, 255);
                if (light != null)
                {
                    light.color = new Color32(255, 247, 234, 255);
                    light.intensity = 1.4f;
                }
                return;
            }
            RenderSettings.fogColor = new Color32(16, 34, 44, 255);
            RenderSettings.fogStartDistance = 29f;
            RenderSettings.fogEndDistance = 46f;
            RenderSettings.ambientLight = new Color32(76, 102, 108, 255);
            if (light != null)
            {
                light.color = new Color32(255, 216, 168, 255);
                light.intensity = 1.45f;
            }
        }
    }
}
