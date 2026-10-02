using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 銀細工の戦闘UIの色（2026-10-02 原作者が方向性を確認。全画面の最終の色は未決）。
    /// 元: prototypes/silver-battle-ui/style.css。ブラウザ版は style.css の [silver] の変数（--sv-*）に同じ色を置く。
    /// 第2段以降で移す部品はここの色を使い、差し替えるときはここだけ直す
    /// </summary>
    public static class HudPalette
    {
        public static readonly Color Ink = Hex("#0d1923");              // いちばん暗い下地
        public static readonly Color Panel = Hex("#09141e", 0.94f);     // 欄の下地（チャコール）
        public static readonly Color Silver = Hex("#d9e1e5");           // 銀の細工・強い文字
        public static readonly Color Text = Hex("#f0f1ec");             // ふつうの文字
        public static readonly Color Muted = Hex("#a6b7bd");            // 控えめな文字
        public static readonly Color Teal = Hex("#67bfc1");             // 控えめな青緑の強調
        public static readonly Color Condition = Hex("#183c50");        // 勝利条件の札

        private static Color Hex(string hex, float alpha = 1f)
        {
            ColorUtility.TryParseHtmlString(hex, out var color);
            color.a = alpha;
            return color;
        }
    }
}
