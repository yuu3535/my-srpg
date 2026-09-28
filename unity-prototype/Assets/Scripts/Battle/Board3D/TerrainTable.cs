using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 地形の記号ごとの決まり（名前・地上で通れるか・飛行で通り抜け／止まれるか・天面の高さ・仮の色）。
    /// 国境監視路の記号（マップ担当の地形の表 2026-09-27）と、城の場所の記号（MAP_ART_PIPELINE_v1 §7・マップ担当の配置表 2026-09-28）。
    /// 配置表の legend に walk・flyEnter・flyStop・height があれば、その場所だけ上書きする（Board3DMap.FromLayout → Override）
    /// </summary>
    public static class TerrainTable
    {
        public struct Info
        {
            public string name;
            public bool walk;       // 地上で通れる・止まれる
            public bool flyEnter;   // 飛行で通り抜けられる
            public bool flyStop;    // 飛行で止まれる
            public float height;    // 天面の高さ（見た目。戦闘の補正にはまだ使わない）
            public Color color;     // 模様がないときの仮の色

            public Info(string name, bool walk, bool flyEnter, bool flyStop, float height, Color32 color)
            {
                this.name = name; this.walk = walk; this.flyEnter = flyEnter; this.flyStop = flyStop; this.height = height; this.color = color;
            }
        }

        private static readonly Dictionary<char, Info> defaults = new Dictionary<char, Info>
        {
            // 国境監視路（今までの値のまま）
            { 's', new Info("旧石畳", true, true, true, 0f, new Color32(150, 146, 138, 255)) },
            { 'd', new Info("土道", true, true, true, 0f, new Color32(139, 108, 74, 255)) },
            { 'g', new Info("苔と下草", true, true, true, 0f, new Color32(82, 108, 66, 255)) },
            { '=', new Info("補修橋", true, true, true, 0f, new Color32(122, 90, 58, 255)) },
            { '~', new Info("水堀", false, true, true, -0.18f, new Color32(38, 68, 94, 255)) },
            { 'o', new Info("遮蔽物", false, true, true, 0.3f, new Color32(104, 98, 92, 255)) },
            { '#', new Info("石の基礎", false, true, false, 0.5f, new Color32(96, 90, 86, 255)) },
            { 't', new Info("密な茂み", false, true, false, 0.6f, new Color32(40, 56, 44, 255)) },
            { 'c', new Info("岩の崖", false, true, false, 0f, new Color32(84, 80, 78, 255)) },
            // 城の場所（屋内の記号は MAP_ART_PIPELINE_v1 §7。u・/・F・b・w はマップ担当が足した）
            { 'f', new Info("石の床", true, true, true, 0f, new Color32(168, 160, 150, 255)) },
            { 'w', new Info("木の床", true, true, true, 0f, new Color32(150, 112, 78, 255)) },
            { 'r', new Info("絨毯", true, true, true, 0f, new Color32(120, 52, 96, 255)) },
            { 'a', new Info("砂の稽古場", true, true, true, 0f, new Color32(214, 190, 140, 255)) },
            { '+', new Info("一段高い台", true, true, true, 0.3f, new Color32(150, 104, 64, 255)) },
            { 'u', new Info("一段高い石の通路", true, true, true, 0.6f, new Color32(120, 112, 128, 255)) },
            { '/', new Info("階段", true, true, true, 0.3f, new Color32(214, 214, 222, 255)) },
            { 'F', new Info("木の柵", false, true, true, 0.5f, new Color32(70, 40, 24, 255)) },
            { 'b', new Info("石の手すり", false, true, false, 0.5f, new Color32(112, 100, 120, 255)) },
            { 'P', new Info("柱", false, true, false, 1.6f, new Color32(96, 80, 110, 255)) },
            { 'W', new Info("壁", false, false, false, 1.6f, new Color32(60, 52, 64, 255)) },
            { 'D', new Info("扉", true, true, true, 0f, new Color32(200, 140, 60, 255)) },
        };

        private static readonly Dictionary<char, Info> overrides = new Dictionary<char, Info>();

        public static bool TryGet(char symbol, out Info info) =>
            overrides.TryGetValue(symbol, out info) || defaults.TryGetValue(symbol, out info);

        public static Info Get(char symbol) =>
            TryGet(symbol, out var info) ? info : new Info("―", false, false, false, 0f, Color.magenta);

        /// <summary>この場所だけの決まり（配置表の legend）。次の場所を読むときに ClearOverrides で戻す</summary>
        public static void Override(char symbol, Info info) => overrides[symbol] = info;
        public static void ClearOverrides() => overrides.Clear();
    }
}
