using UnityEngine;
using UnityEngine.Rendering;

namespace Srpg.Battle
{
    /// <summary>
    /// 盤面の時間帯（光・環境光・霧）。マップごとに戦闘データの timeOfDay で選ぶ（原作者 2026-09-27）。
    ///   dusk: 原作の背景素材から決めた暗めの琥珀色（MAP_COLOR_MOOD_DIRECTION_2026-09-27 の C2）
    ///   day : 明るい昼。マップチップ（明るい土の道・草原）に合わせた、白っぽい光と薄い霧
    /// </summary>
    public static class Board3DMood
    {
        public const string Dusk = "dusk";
        public const string Day = "day";

        public static void Apply(string mood, Light light)
        {
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.ambientMode = AmbientMode.Flat;
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
