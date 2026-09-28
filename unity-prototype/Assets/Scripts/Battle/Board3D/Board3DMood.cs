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

        /// <summary>
        /// 板の絵の木・小物にかける色（光を受けない材質なので、時間帯の環境光の色でなじませる。マップ担当の所見 2026-09-28）。
        /// キャラには かけない（読みやすさのため）
        /// </summary>
        public static Color CurrentPropTint { get; private set; } = Color.white;

        public static Color PropTint(string mood) => mood switch
        {
            Morning => new Color(0.96f, 0.95f, 1f),
            Dusk => new Color(0.82f, 0.8f, 0.8f),
            Night => new Color(0.5f, 0.56f, 0.76f),
            HallMorning => new Color(0.74f, 0.7f, 0.9f),
            HallDay => new Color(0.78f, 0.76f, 0.84f),
            HallNight => new Color(0.46f, 0.46f, 0.62f),
            _ => Color.white,
        };

        /// <summary>屋内の時間帯か（霧を使わない）</summary>
        public static bool IsIndoor(string mood) => mood != null && mood.StartsWith("hall_");

        /// <param name="indoor">屋内の場所（配置表の indoor）。朝・昼・夜の光のまま、霧だけかけない（マップ担当 2026-09-28: 自室・廊下は窓からの朝の光）</param>
        public static void Apply(string mood, Light light, bool indoor = false)
        {
            CurrentPropTint = PropTint(mood);
            RenderSettings.fog = !IsIndoor(mood) && !indoor;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.ambientMode = AmbientMode.Flat;
            if (IsIndoor(mood))
            {
                // 屋内の暗い広間: 環境光は暗めの紫がかった灰。窓（主の光）の強さと色で時間を表す
                (Color32 ambient, Color32 window, float strength) = mood switch
                {
                    // ステンドグラス（オルクスの紋章: 深い紫・藍・金）から差す紫〜藍の光。橙にすると夕方に見える（マップ担当の所見 2026-09-28）
                    HallMorning => (new Color32(72, 70, 100, 255), new Color32(176, 150, 246, 255), 0.9f),
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
                // もう一段暗く青く（マップ担当の所見 2026-09-28: 昼に近い明るさと緑に見えた）
                RenderSettings.fogColor = new Color32(12, 18, 38, 255);
                RenderSettings.fogStartDistance = 28f;
                RenderSettings.fogEndDistance = 52f;
                RenderSettings.ambientLight = new Color32(40, 50, 88, 255);
                if (light != null)
                {
                    light.color = new Color32(140, 164, 230, 255);   // 月の光
                    light.intensity = 0.42f;
                }
                return;
            }
            if (mood == Morning)
            {
                // 晴れた朝（シナリオ「今日もいい天気だな」。マップ担当 2026-09-28）: 霧は昼より遠くから、薄く
                // 白〜淡い金の朝の光（レビュー 2026-09-28_2 J7: 訓練場が紫の夕暮れに見えた。環境光の青みを減らした）
                RenderSettings.fogColor = new Color32(200, 204, 214, 255);
                RenderSettings.fogStartDistance = 44f;
                RenderSettings.fogEndDistance = 80f;
                RenderSettings.ambientLight = new Color32(148, 148, 156, 255);
                if (light != null)
                {
                    light.color = new Color32(255, 246, 228, 255);
                    light.intensity = 1.4f;
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
