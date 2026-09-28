using System;
using System.Collections.Generic;
using System.Linq;

namespace Srpg.Battle
{
    /// <summary>
    /// シナリオのデータ（tools/import_scenario.py がシナリオの表から作る。Assets/Data/Scenario/*.json）。
    /// ブロック＝続けて流れる台詞のまとまり。寄り道のブロックは、マップの配置表から id で指す
    /// </summary>
    [Serializable]
    public class ScenarioFile
    {
        public string id;
        public string source;
        public ScenarioBlock[] blocks;

        public ScenarioBlock Block(string blockId) => blocks?.FirstOrDefault(b => b.id == blockId);
    }

    [Serializable]
    public class ScenarioBlock
    {
        public string id;
        public string part;       // story（シナリオ）/ sidetrack（寄り道）/ battle（戦闘）
        public string scene;      // 表の「シーン」
        public string label;      // 表の「区分」
        public string location;   // 表の「背景」（場所）
        public string process;    // 表の「ゲーム処理」
        public string note;
        public int row;
        public ScenarioLine[] lines;

        /// <summary>画面に出す行（制作メモは除く）</summary>
        public IEnumerable<ScenarioLine> Shown => (lines ?? Array.Empty<ScenarioLine>()).Where(l => l.type != "memo");
    }

    [Serializable]
    public class ScenarioLine
    {
        public int row;
        public string type;        // line（台詞）/ narration（場面説明）/ phone（携帯端末）/ memo（制作メモ。出さない）
        public string speaker;
        public string expression;
        public string text;
        public string note;
        public string process;
        public string item;        // この行で手に入れる物（なければ空）
    }

    /// <summary>
    /// 会話劇の立ち位置（DIALOGUE_STAGING_DIRECTION_2026-09-28: 左＝主人公の側、右＝相手の側。片側2人まで。場面の途中で入れ替えない）
    /// </summary>
    public static class DialogueCast
    {
        /// <summary>左に立つ人（主人公の側）</summary>
        public static readonly HashSet<string> LeftSide = new HashSet<string> { "アルシェ", "カリマ" };

        public static bool IsLeft(string speaker) => LeftSide.Contains(speaker ?? "");

        /// <summary>
        /// 1行ずつ、舞台に立つ人を決める（純粋な計算。表示とテストで同じものを使う）。
        /// 話した人がまだ舞台にいなければ、その側に入れる。片側が2人なら、いちばん前に話した人と入れ替える
        /// </summary>
        public class Stage
        {
            public readonly List<string> left = new List<string>();
            public readonly List<string> right = new List<string>();
            private readonly Dictionary<string, int> lastSpoke = new Dictionary<string, int>();
            private int step;
            public string Speaker { get; private set; }

            /// <summary>
            /// 会話の最初に、話す人を先に舞台へ立てる（話す順。片側2人まで）。
            /// 話していない人も最初から見える（原作者 2026-09-28: 同じ画面に出し、黙っている人は暗く）
            /// </summary>
            public void Enter(IEnumerable<string> speakers)
            {
                foreach (var who in speakers)
                {
                    if (string.IsNullOrEmpty(who)) continue;
                    var side = IsLeft(who) ? left : right;
                    if (side.Contains(who) || side.Count >= 2) continue;
                    side.Add(who);
                }
            }

            public void Speak(string speaker)
            {
                step++;
                Speaker = string.IsNullOrEmpty(speaker) ? null : speaker;
                if (Speaker == null) return;
                lastSpoke[Speaker] = step;
                var side = IsLeft(Speaker) ? left : right;
                if (side.Contains(Speaker)) return;
                if (side.Count >= 2)
                {
                    var oldest = side.OrderBy(s => lastSpoke.TryGetValue(s, out var t) ? t : 0).First();
                    side[side.IndexOf(oldest)] = Speaker;
                }
                else side.Add(Speaker);
            }
        }
    }
}
