using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 2Dの横スクロールの探索（原作者 2026-10-04: 探索を3Dの盤面から2Dへ移す。まず回廊で試す）。
    /// 出来事は3Dの探索と同じ配置表（Assets/Data/Maps/&lt;場所&gt;.json の states・talkAreas・inspect・exits）を使い、
    /// 位置だけを横の位置に置き換える: 配置表のマスの1つの軸（回廊なら y）を、歩ける範囲の左から右へ並べる。
    /// 人・範囲ごとに場所のデータ（Assets/Data/Corridors/&lt;場所&gt;.json の explore.spots）で横の位置を上書きできる。
    /// 近づくと流れる会話（一度だけ。相手の隣まで歩いてから始める）、話す・調べる・扉の札、扉の条件（先に会う人・持ち物）
    /// </summary>
    public class Explore2DController : MonoBehaviour
    {
        [Serializable]
        public class Spot
        {
            public string id;
            public float x;
            public float w;   // 範囲（talkArea）の幅。0 なら配置表のマスから
        }

        [Serializable]
        public class Explore2D
        {
            public string map;            // 配置表の mapId（Assets/Data/Maps/<map>.json）
            public string axis = "y";     // 横に並べるマスの軸
            public float from, to;        // この値が左の端（歩ける範囲の左）・右の端
            public string state;          // 使う場面（空なら最初）
            public Spot[] spots;
        }

        [Serializable] private class CorridorExplore { public Explore2D explore; }

        [SerializeField] private Corridor2DView view;
        [SerializeField] private DialogueView dialogue;
        [SerializeField] private TextAsset corridorJson;
        [SerializeField] private TextAsset mapJson;
        [SerializeField] private TextAsset scenarioJson;
        [SerializeField] private Texture2D[] sprites = Array.Empty<Texture2D>();   // 盤面のキャラの絵（Assets/Art/SD）

        // 配置表の人の id → 盤面の絵の名前と、会話の名前（ExploreController と同じ）
        private static readonly Dictionary<string, (string token, string name)> People = new Dictionary<string, (string, string)>
        {
            { "young_arshe", ("young_arshe", "アルシェ") },
            { "young_karima", ("young_karima", "カリマ") },
            { "gunter", ("gunter", "ギュンター") },
            { "carrie", ("carrie", "キャリー") },
            { "henry", ("henry", "ヘンリー") },
        };

        private const float TalkReach = 70f, InspectReach = 60f, ExitReach = 70f, StandOff = 52f;

        private Explore2D ex;
        private MapLayoutFile map;
        private ScenarioFile scenario;
        private readonly HashSet<string> seen = new HashSet<string>();
        private readonly HashSet<string> played = new HashSet<string>();
        private readonly List<string> items = new List<string>();
        private readonly Dictionary<string, float> personX = new Dictionary<string, float>();
        private bool starting;

        public MapState State { get; private set; }
        public IReadOnlyCollection<string> Seen => seen;
        public IReadOnlyList<string> Items => items;
        public bool Busy => (dialogue != null && dialogue.IsPlaying) || (view != null && view.AutoWalking) || starting;
        public float PersonX(string id) => personX.TryGetValue(id, out var x) ? x : float.NaN;

        private void Start() => Begin();

        public void Begin()
        {
            ex = corridorJson != null ? JsonUtility.FromJson<CorridorExplore>(corridorJson.text)?.explore : null;
            map = mapJson != null ? JsonUtility.FromJson<MapLayoutFile>(mapJson.text) : null;
            scenario = scenarioJson != null ? JsonUtility.FromJson<ScenarioFile>(scenarioJson.text) : new ScenarioFile();
            if (ex == null || map == null || view == null) { enabled = false; return; }
            if (view.Length <= 0f) view.Build();
            view.Controlled = true;
            State = (!string.IsNullOrEmpty(ex.state) ? map.State(ex.state) : null) ?? map.states?.FirstOrDefault();
            if (dialogue != null) { dialogue.OnItem -= GotItem; dialogue.OnItem += GotItem; }

            // 人を並べる（アルシェ以外）
            personX.Clear();
            var list = new List<(string, string, Texture2D, float)>();
            foreach (var p in State?.people ?? Array.Empty<MapPerson>())
            {
                float x = X(p.id, p.Cell);
                personX[p.id] = x;
                string token = People.TryGetValue(p.id, out var v) ? v.token : p.id;
                string name = !string.IsNullOrEmpty(p.name) ? p.name : People.TryGetValue(p.id, out var w) ? w.name : p.id;
                list.Add((p.id, name, sprites.FirstOrDefault(t => t != null && t.name == token), x));
            }
            view.SetPeople(list);
            view.PlayerX = State?.player != null ? X("player", State.player.Cell) : view.WalkMinX;

            // 入ったときの会話
            var onEnter = (State?.onEnter ?? Array.Empty<string>()).ToList();
            if (onEnter.Count > 0) { starting = true; PlayBlocks(onEnter, () => starting = false); }
        }

        private void GotItem(string item)
        {
            if (!items.Contains(item)) { items.Add(item); view.Toast($"「{item}」を手に入れた"); }
        }

        private void Update()
        {
            if (view == null || State == null) return;
            bool busy = Busy;
            view.Locked = busy;
            if (busy) { view.ShowAction(null, null); return; }
            view.FocusX = null;
            float px = view.PlayerX;

            // 近づくと流れる会話（一度だけ）
            foreach (var area in State.talkAreas ?? Array.Empty<MapTalkArea>())
            {
                if (area.trigger != "approach" || seen.Contains(area.block) || (area.once && played.Contains(area.id))) continue;
                var (lo, hi) = Range(area);
                if (px < lo || px > hi) continue;
                played.Add(area.id);
                ApproachThen(area.block);
                return;
            }

            // 札: いちばん近い人（話す）・調べる所・扉
            (float dist, string label, Action act) best = (float.MaxValue, null, null);
            foreach (var p in State.people ?? Array.Empty<MapPerson>())
            {
                if (string.IsNullOrEmpty(p.talkBlock)) continue;
                float d = Mathf.Abs(personX[p.id] - px);
                var person = p;
                if (d < TalkReach && d < best.dist) best = (d, $"話す（{NameOf(p)}）", () => Talk(person));
            }
            foreach (var i in (State.inspect ?? Array.Empty<MapInspect>()).Concat(map.inspect ?? Array.Empty<MapInspect>()))
            {
                float d = Mathf.Abs(CellsX(i.id, i.cells) - px);
                var inspect = i;
                if (d < InspectReach && d < best.dist) best = (d, string.IsNullOrEmpty(i.label) ? "調べる" : $"調べる（{i.label}）", () => Inspect(inspect));
            }
            foreach (var e in map.exits ?? Array.Empty<MapExit>())
            {
                float d = Mathf.Abs(CellsX(e.id, e.cells) - px);
                var exit = e;
                if (d < ExitReach && d < best.dist) best = (d, ExitLabel(e), () => UseExit(exit));
            }
            view.ShowAction(best.label, best.act);
        }

        // ── 位置（配置表のマス → 横の位置。spots で上書き） ──

        private Spot SpotOf(string id) => ex.spots?.FirstOrDefault(s => s.id == id);

        private float AxisX(float v)
        {
            float t = Mathf.Approximately(ex.from, ex.to) ? 0.5f : (v - ex.from) / (ex.to - ex.from);
            return Mathf.Lerp(view.WalkMinX, view.WalkMaxX, Mathf.Clamp01(t));
        }

        private float X(string id, Vector2Int cell)
        {
            var spot = SpotOf(id);
            return spot != null ? Resolve(spot.x) : AxisX(ex.axis == "x" ? cell.x : cell.y);
        }

        private float CellsX(string id, MapCell[] cells)
        {
            var spot = SpotOf(id);
            if (spot != null) return Resolve(spot.x);
            if (cells == null || cells.Length == 0) return float.MaxValue;
            return AxisX((float)cells.Average(c => ex.axis == "x" ? c.x : c.y));
        }

        /// <summary>負の値は右の端からの距離（場所のデータの出口と同じ）</summary>
        private float Resolve(float x) => x < 0f ? view.Length + x : x;

        private (float lo, float hi) Range(MapTalkArea area)
        {
            var spot = SpotOf(area.id);
            if (spot != null && spot.w > 0f) { float c = Resolve(spot.x); return (c - spot.w / 2f, c + spot.w / 2f); }
            float a0 = ex.axis == "x" ? area.x : area.y, n = ex.axis == "x" ? area.w : area.h;
            float half = Mathf.Abs(AxisX(a0 + 1f) - AxisX(a0)) / 2f;
            float x0 = AxisX(a0), x1 = AxisX(a0 + n - 1f);
            return (Mathf.Min(x0, x1) - half, Mathf.Max(x0, x1) + half);
        }

        // ── 出来事 ──

        private string NameOf(MapPerson p) => !string.IsNullOrEmpty(p.name) ? p.name : People.TryGetValue(p.id, out var v) ? v.name : p.id;

        private void Talk(MapPerson person) => ApproachThen(person.talkBlock, replay: true);

        private void Inspect(MapInspect inspect)
        {
            if (!string.IsNullOrEmpty(inspect.block)) { PlayBlocks(new List<string> { inspect.block }, null, replay: true); return; }
            if (!string.IsNullOrEmpty(inspect.text)) PlayLines(new[] { new ScenarioLine { type = "narration", text = inspect.text } });
        }

        private string ExitLabel(MapExit e)
        {
            string label = e.label ?? "";
            int cut = label.IndexOfAny(new[] { '（', '(' });
            return cut > 0 ? label.Substring(0, cut) : label;
        }

        private void UseExit(MapExit exit)
        {
            if (!exit.hasTarget || string.IsNullOrEmpty(exit.toMap))
            {
                PlayLines(new[] { new ScenarioLine { type = "narration", text = $"{ExitLabel(exit)}は、今は入れない。" } });
                return;
            }
            var missing = (exit.requires ?? Array.Empty<string>()).FirstOrDefault(r => !Satisfied(r));
            if (missing != null)
            {
                string text = !string.IsNullOrEmpty(exit.lockedText) ? exit.lockedText : LockedText(missing);
                PlayLines(new[] { new ScenarioLine { type = "line", speaker = "アルシェ", text = text } });
                return;
            }
            // ほかの場所はまだ2Dにしていない（自室の素材ができたら、場所をつなぐ）
            view.Toast($"{ExitLabel(exit)}へ（2Dの場所はまだつながっていません）", 2.5f);
        }

        private bool Satisfied(string requirement)
        {
            if (requirement.StartsWith("item:")) return items.Contains(requirement.Substring(5));
            if (requirement.StartsWith("block:")) return seen.Contains(requirement.Substring(6));
            return true;
        }

        private string LockedText(string requirement)
        {
            if (requirement.StartsWith("item:")) return $"おっと、{requirement.Substring(5)}を忘れてた。";
            if (requirement.StartsWith("block:") && SpeakerOf(requirement.Substring(6)) is string who) return $"その前に、{who}にも挨拶していこう。";
            return "先にやることがあったな。";
        }

        private string SpeakerOf(string blockId) =>
            scenario?.Block(blockId)?.Shown.Where(l => l.type == "line" && l.speaker != "アルシェ").Select(l => l.speaker).FirstOrDefault();

        /// <summary>会話の相手の隣まで歩いてから始める（離れた所からいきなり始まらないように。3Dの探索と同じ考え）</summary>
        private void ApproachThen(string blockId, bool replay = false)
        {
            var partner = PartnerOf(blockId);
            if (partner == null) { PlayBlocks(new List<string> { blockId }, null, replay); return; }
            float px = personX[partner.id];
            float stand = view.PlayerX <= px ? px - StandOff : px + StandOff;
            view.WalkTo(stand, () =>
            {
                view.Face(px);
                view.FocusX = (view.PlayerX + px) / 2f;
                PlayBlocks(new List<string> { blockId }, () => view.FocusX = null, replay);
            });
        }

        private MapPerson PartnerOf(string blockId)
        {
            if (string.IsNullOrEmpty(blockId)) return null;
            var people = State?.people ?? Array.Empty<MapPerson>();
            var byTalk = people.FirstOrDefault(p => p.talkBlock == blockId);
            if (byTalk != null) return byTalk;
            var speakers = scenario?.Block(blockId)?.Shown.Where(l => l.type == "line" && l.speaker != "アルシェ").Select(l => l.speaker).Distinct() ?? Enumerable.Empty<string>();
            foreach (var s in speakers)
            {
                var p = people.FirstOrDefault(x => NameOf(x) == s);
                if (p != null) return p;
            }
            return null;
        }

        /// <summary>ブロックを順に流し、終わったら then。一度流したブロックは replay でなければ飛ばす</summary>
        public void PlayBlocks(List<string> blockIds, Action then, bool replay = false)
        {
            view.ShowAction(null, null);   // 会話の間は札を隠す
            var queue = new Queue<string>(blockIds.Where(b => replay || !seen.Contains(b)));
            void Next()
            {
                if (queue.Count == 0) { then?.Invoke(); return; }
                var id = queue.Dequeue();
                var block = scenario?.Block(id);
                seen.Add(id);
                if (block == null || dialogue == null || !block.Shown.Any()) { Next(); return; }
                dialogue.Play(block, Next);
            }
            Next();
        }

        private void PlayLines(ScenarioLine[] lines)
        {
            if (dialogue == null) return;
            view.ShowAction(null, null);
            dialogue.Play(new ScenarioBlock { id = "", part = "story", lines = lines }, null);
        }

        /// <summary>確認用: その横の位置へ置き、近づくと流れる会話などを起こす（Update と同じ判定）</summary>
        public void StepForTest(float x)
        {
            view.PlayerX = x;
            Update();
        }
    }
}
