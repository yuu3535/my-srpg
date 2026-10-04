using System.Text.RegularExpressions;

namespace Srpg.Battle
{
    /// <summary>
    /// シナリオのト書き（台詞の行の「備考」「ゲーム処理」と、その前の制作メモ）から、カメラなどの演出の指示を読む（原作者 2026-10-05）。
    /// 書き方: 「カメラ：空を見上げる」「カメラ：右を見る」「カメラ：寄る」「カメラ：引く」「カメラ：もどす」、「暗転」「明転」。
    /// 一覧と使い方は docs/10-design/scenario/STAGE_DIRECTIONS_2026-10-05.md。指示がなければ何もしない（ふつうのカメラのまま）
    /// </summary>
    public static class StageDirection
    {
        public struct Shot
        {
            public bool any;        // カメラの指示があった
            public bool reset;      // もどす（ふつうのカメラへ）
            public float dx, dy;    // 見る所を右・上へずらす幅（844×390 の画面の点）。足していく
            public float zoom;      // 大きさを何倍にするか（0 なら変えない）
            public bool? dark;      // 暗転（true）・明転（false）
        }

        // 1回の指示で動かす幅（画面 844×390 の点）
        public const float LookUp = 150f, LookDown = 80f, LookSide = 280f, CloseIn = 1.35f, PullBack = 0.8f;

        private static readonly Regex CameraWord = new Regex(@"カメラ\s*[:：]\s*([^\s、。，,／/）)]+)");

        public static Shot Parse(string text)
        {
            var shot = new Shot();
            if (string.IsNullOrEmpty(text)) return shot;
            foreach (Match m in CameraWord.Matches(text))
            {
                string w = m.Groups[1].Value;
                shot.any = true;
                if (Has(w, "もどす", "戻す", "もどる", "戻る", "ふつう", "普通")) { shot.reset = true; continue; }
                if (Has(w, "見上げ", "上を見", "空")) shot.dy += LookUp;
                if (Has(w, "見下ろ", "下を見", "足元")) shot.dy -= LookDown;
                if (Has(w, "右")) shot.dx += LookSide;
                if (Has(w, "左")) shot.dx -= LookSide;
                if (Has(w, "寄")) shot.zoom = CloseIn;
                if (Has(w, "引")) shot.zoom = PullBack;
            }
            // 暗転・明転（「暗転明け」「暗転から」は明転）
            if (Regex.IsMatch(text, "明転|暗転明け|暗転から|暗転が明け")) shot.dark = false;
            else if (text.Contains("暗転")) shot.dark = true;
            return shot;
        }

        private static bool Has(string w, params string[] keys)
        {
            foreach (var k in keys) if (w.Contains(k)) return true;
            return false;
        }
    }
}
