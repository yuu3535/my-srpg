namespace Srpg.Battle
{
    /// <summary>
    /// 地形ごとの通行の決まり（マップ担当の地形の表 2026-09-27。docs/10-design/map/MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md §7）。
    ///   地上: 旧石畳 s・土道 d・苔と下草 g・補修橋 = だけ通れる
    ///   飛行: どの地形も通り抜けられる。止まれるのは、足場のない所（水堀 ~）と低い物の上（遮蔽物 o）まで。
    ///         高い物が立つ所（石の基礎 #・密な茂み t）は通り抜けるだけで止まれない（原作者 2026-09-27）
    /// ブラウザ版の移動の規則にはまだ地形の区別がない。戦闘データに地形を入れるときに、ブラウザ版も同じ決まりにそろえる。
    /// </summary>
    public static class TerrainRules
    {
        /// <summary>そのマスに入れる（通り抜けられる）か</summary>
        public static bool CanEnter(char terrain, bool flying)
        {
            if (flying) return terrain != '\0';
            return IsGround(terrain);
        }

        /// <summary>そのマスに止まれるか</summary>
        public static bool CanStop(char terrain, bool flying)
        {
            if (!flying) return IsGround(terrain);
            return IsGround(terrain) || terrain == '~' || terrain == 'o';
        }

        private static bool IsGround(char terrain) =>
            terrain == 's' || terrain == 'd' || terrain == 'g' || terrain == '=';
    }
}
