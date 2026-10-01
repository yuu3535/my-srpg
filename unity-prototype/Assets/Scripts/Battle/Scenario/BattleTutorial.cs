using System;
using System.Collections.Generic;
using System.Linq;

namespace Srpg.Battle
{
    /// <summary>戦闘の手引きのデータ（Assets/Data/Scenario/prologue_training_tutorial.json）</summary>
    [Serializable]
    public class TutorialFile
    {
        public string battleId;
        public string block;         // 表の行（rows）を探すブロック（例: prologue_1_1.b11）
        public string note;
        public string finishGuide;   // 手引きが全部済んだあとの帯
        public string reserveGuide;  // 今の段の手引きが済んだが、まだ控えの敵が出ていないときの帯（訓練の1段目の残りの人形）
        public TutorialLesson[] lessons;
    }

    [Serializable]
    public class TutorialLesson
    {
        public string id;
        public string when;     // 出す条件: 空＝いつでも / "declared"＝敵が攻撃を予告している / "hurt"＝傷ついた味方がいる（条件のある手引きは先に出す）
        public string done;     // 済む行動（Battle3DController.ActionDone の種類）。"shown" は台詞を流したら済む。"dismiss" は行動では済まない（次の味方の番で引っ込む）
        public int[] rows;      // 始めに流すシナリオの表の行
        public TutorialLine[] lines;   // 始めに流す台詞（表にない下書き）
        public int[] after;     // 済んだあとに流す表の行
        public string guide;    // 画面の帯
        public int phase;       // 段（0 か 1＝1段目、2＝2段目。控えの敵が現れると2段目。原作者 2026-10-02: 人形 → ギュンター）
    }

    [Serializable]
    public class TutorialLine
    {
        public string speaker, text;
        public bool draft;      // 総合担当の下書き（原作者の確認待ち）
    }

    /// <summary>
    /// 訓練の戦闘の手引き（原作者 2026-09-28: 台詞＋画面の帯）。戦闘の行動の知らせ（ActionDone）で進む。
    /// 手引きは順に出す（まだ済んでいない最初のもの。条件のある手引きは、条件を満たしたら先に出す）。
    /// 先にやってしまった行動の手引きは、飛ばす。会話の間は盤面を押せない
    /// </summary>
    public class BattleTutorial
    {
        private readonly TutorialFile file;
        private readonly Battle3DController battle;
        private readonly Func<ScenarioBlock, Action, bool> play;   // 会話を流す（流せなければ false）
        private readonly ScenarioBlock source;
        private readonly HashSet<string> done = new HashSet<string>();
        private readonly HashSet<string> introduced = new HashSet<string>();
        private bool playing, stopped;
        private int phase = 1;
        private static int PhaseOf(TutorialLesson lesson) => lesson.phase <= 1 ? 1 : lesson.phase;

        public IReadOnlyCollection<string> Done => done;
        public string CurrentId { get; private set; }

        public BattleTutorial(TutorialFile file, ScenarioFile scenario, Battle3DController battle, Func<ScenarioBlock, Action, bool> play)
        {
            this.file = file;
            this.battle = battle;
            this.play = play;
            source = scenario?.Block(file?.block);
        }

        /// <summary>手引きを始める（戦闘を組み立てたあと）</summary>
        public void Begin()
        {
            battle.ActionDone += OnAction;
            battle.Finished += OnFinished;
            battle.Reinforced += OnReinforced;
            battle.InputBlocked = () => playing;
            Step();
        }

        public void Stop()
        {
            stopped = true;
            battle.ActionDone -= OnAction;
            battle.Finished -= OnFinished;
            battle.Reinforced -= OnReinforced;
            battle.Guide = "";
        }

        private void OnFinished(Battle3DController.Phase phase) => Stop();

        /// <summary>控えの敵が現れた: 2段目へ（1段目でやり残した手引きは済んだことにする）</summary>
        private void OnReinforced()
        {
            if (stopped) return;
            phase = 2;
            foreach (var lesson in file.lessons ?? Array.Empty<TutorialLesson>())
                if (PhaseOf(lesson) < phase) done.Add(lesson.id);
            Step();
        }

        /// <summary>今の段</summary>
        public int Phase => phase;

        private void OnAction(string kind, Battle3DController.UnitState unit)
        {
            if (stopped) return;
            var after = new List<int>();
            foreach (var lesson in file.lessons ?? Array.Empty<TutorialLesson>())
            {
                // 条件のある手引き（ポーションなど）は、出したターンにやらなければ、次の味方の番で引っ込める（ほかの手引きを止めない）
                if (kind == "allyTurn" && !string.IsNullOrEmpty(lesson.when) && introduced.Contains(lesson.id)) { done.Add(lesson.id); continue; }
                if (done.Contains(lesson.id) || lesson.done != kind) continue;
                done.Add(lesson.id);
                if (lesson.after != null) after.AddRange(lesson.after);
            }
            // 敵を全部倒した行動のあとは、手引きを出さない（勝利へ。控えの敵が出てくるときは、その知らせ OnReinforced で進む）
            if (!battle.Units.Any(u => u.Alive && u.Side == "enemy")) return;
            if (after.Count > 0) Play(LinesOf(after, null), Step);
            else Step();
        }

        /// <summary>今出す手引き</summary>
        public TutorialLesson Current()
        {
            var open = (file.lessons ?? Array.Empty<TutorialLesson>()).Where(l => !done.Contains(l.id) && PhaseOf(l) == phase).ToList();
            // 段の始めの台詞（条件なし・shown）は、条件のある手引きより先に流す（ギュンターの登場 → 行動予告）
            return open.FirstOrDefault(l => string.IsNullOrEmpty(l.when) && l.done == "shown")
                ?? open.FirstOrDefault(l => !string.IsNullOrEmpty(l.when) && WhenMet(l.when))
                ?? open.FirstOrDefault(l => string.IsNullOrEmpty(l.when));
        }

        /// <summary>
        /// "declared": 敵が攻撃を予告している（赤い矢印が出ている。届かない間は予告しない）。
        /// "hurt": 傷ついた味方がいて、味方の誰かが回復の物を持っている（持っていない人には交換で渡せる）
        /// </summary>
        private bool WhenMet(string when)
        {
            if (when == "declared") return battle.Declarations.Values.Any(d => d.type == "attack");
            if (when != "hurt") return false;
            var allies = battle.Units.Where(u => u.Alive && u.Side == "ally" && u.plan != null).ToList();
            return allies.Any(u => u.plan.hp < u.plan.maxHp) && allies.Any(u => u.items.Any(i => i.type == "heal"));
        }

        private void Step()
        {
            if (stopped || playing) return;
            var lesson = Current();
            CurrentId = lesson?.id;
            if (lesson == null) { battle.Guide = (battle.HasReserves ? file.reserveGuide : null) ?? file.finishGuide ?? ""; return; }
            if (!introduced.Contains(lesson.id))
            {
                introduced.Add(lesson.id);
                battle.Guide = "";
                var lines = LinesOf(lesson.rows, lesson.lines);
                Play(lines, () =>
                {
                    if (lesson.done == "shown") done.Add(lesson.id);
                    Step();
                });
                return;
            }
            battle.Guide = lesson.guide ?? "";
        }

        private void Play(List<ScenarioLine> lines, Action then)
        {
            if (lines.Count == 0) { then(); return; }
            playing = true;
            var block = new ScenarioBlock { id = "", part = "battle", lines = lines.ToArray() };
            if (!play(block, () => { playing = false; then(); })) { playing = false; then(); }
        }

        /// <summary>表の行と下書きの台詞を、流す行にする（{target} は敵が狙っている味方の名前）</summary>
        public List<ScenarioLine> LinesOf(IEnumerable<int> rows, IEnumerable<TutorialLine> drafts)
        {
            var list = new List<ScenarioLine>();
            foreach (int row in rows ?? Enumerable.Empty<int>())
            {
                var line = source?.lines?.FirstOrDefault(l => l.row == row);
                if (line != null && line.type != "memo") list.Add(line);
            }
            foreach (var d in drafts ?? Enumerable.Empty<TutorialLine>())
                list.Add(new ScenarioLine { type = "line", speaker = d.speaker, text = (d.text ?? "").Replace("{target}", TargetName()) });
            return list;
        }

        private string TargetName()
        {
            var decl = battle.Declarations.Values.FirstOrDefault(d => d.type == "attack");
            var unit = decl != null ? battle.Units.FirstOrDefault(u => u.Id == decl.targetId) : null;
            if (unit == null) return "お二人";
            return unit.Name == "アルシェ" ? "アルシェ様" : unit.Name == "カリマ" ? "カリマ様" : unit.Name;
        }
    }
}
