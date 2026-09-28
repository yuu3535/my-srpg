using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 探索（プロローグ1-1 計画の段4）: 配置表の場所を歩き、人に話しかけ、近づくと会話が流れ、調べ、扉で次の場所へ行く。
    /// 操作は「行きたいマスを押すと、そこまで歩く」（原作者 2026-09-28）。人・調べる所を押したら、隣まで歩いてから話す・調べる。
    /// 会話は DialogueView、盤面は Board3DView、場所は MapLayoutFile（tools/map_layout.py unity）、会話の中身は ScenarioFile（tools/import_scenario.py）
    /// </summary>
    public class ExploreController : MonoBehaviour
    {
        [Serializable]
        public struct PlaceGround { public string mapId; public Texture2D texture; }

        [SerializeField] private Board3DView view;
        [SerializeField] private DialogueView dialogue;
        [SerializeField] private TextAsset scenarioJson;
        [SerializeField] private TextAsset[] placeJsons = Array.Empty<TextAsset>();
        [SerializeField] private PlaceGround[] grounds = Array.Empty<PlaceGround>();
        [SerializeField] private string startMap = "orcus_room_arshe_karima";
        [SerializeField] private float stepSeconds = 0.16f;

        // 配置表の人物の id → 盤面の絵の id と、会話の名前（立ち絵）
        private static readonly Dictionary<string, (string token, string name)> People = new Dictionary<string, (string, string)>
        {
            { "young_arshe", ("arshe", "アルシェ") },
            { "young_karima", ("young_karima", "カリマ") },
            { "gunter", ("gunter", "ギュンター") },
            { "carrie", ("carrie", "キャリー") },
            { "henry", ("henry", "ヘンリー") },
        };

        private ScenarioFile scenario;
        private readonly Dictionary<string, MapLayoutFile> places = new Dictionary<string, MapLayoutFile>();
        private readonly Dictionary<string, string> stateOf = new Dictionary<string, string>();   // 場所 → 使う場面（ない場所は最初の場面）
        private readonly HashSet<string> seen = new HashSet<string>();       // 流したブロック
        private readonly HashSet<string> played = new HashSet<string>();     // 流した「近づくと流れる会話」の範囲（once）
        private readonly List<string> items = new List<string>();
        private readonly Dictionary<string, Vector2Int> personCells = new Dictionary<string, Vector2Int>();
        private Coroutine walking;

        public MapLayoutFile Place { get; private set; }
        public MapState State { get; private set; }
        public Vector2Int Player { get; private set; }
        public string PlayerId { get; private set; } = "arshe";
        public IReadOnlyList<string> Items => items;
        public IReadOnlyCollection<string> Seen => seen;
        public bool Busy => dialogue != null && dialogue.IsPlaying;
        /// <summary>目的地に着いて、戦闘へ進むところ（段5でつなぐ）</summary>
        public string PendingBattleArea { get; private set; }
        public event Action<string> Log;

        private void Start()
        {
            if (Place == null) Begin();
        }

        /// <summary>最初の場所から始める</summary>
        public void Begin()
        {
            Load();
            EnterPlace(startMap, null, null);
        }

        private void Load()
        {
            scenario = scenarioJson != null ? JsonUtility.FromJson<ScenarioFile>(scenarioJson.text) : new ScenarioFile();
            places.Clear();
            foreach (var t in placeJsons)
                if (t != null)
                {
                    var layout = JsonUtility.FromJson<MapLayoutFile>(t.text);
                    places[layout.mapId] = layout;
                }
            if (dialogue != null)
            {
                dialogue.OnItem -= GotItem;
                dialogue.OnItem += GotItem;
            }
            if (view != null)
            {
                view.CellTapped -= Tap;
                view.CellTapped += Tap;
                view.IsOverOtherGui = _ => Busy;
            }
        }

        private void GotItem(string item)
        {
            if (!items.Contains(item)) { items.Add(item); Log?.Invoke($"「{item}」を手に入れた"); }
        }

        // ── 場所に入る ──

        /// <summary>場所に入る（cell が空なら、その場面の最初に立つマス）</summary>
        public void EnterPlace(string mapId, Vector2Int? cell, string facing)
        {
            if (!places.TryGetValue(mapId, out var layout)) { Log?.Invoke($"場所がない: {mapId}"); return; }
            StopWalking();
            Place = layout;
            State = stateOf.TryGetValue(mapId, out var sid) ? layout.State(sid) : layout.states?.FirstOrDefault();
            var map = Board3DMap.FromLayout(layout);
            Player = cell ?? State?.player?.Cell ?? new Vector2Int(layout.columns / 2, layout.rows / 2);
            PlayerId = State?.player != null && People.TryGetValue(State.player.id, out var p) ? p.token : "arshe";
            map.Units.Add(new Board3DMap.Unit { cell = Player, id = PlayerId });
            personCells.Clear();
            foreach (var person in State?.people ?? Array.Empty<MapPerson>())
            {
                string token = People.TryGetValue(person.id, out var pp) ? pp.token : person.id;
                if (token == PlayerId) continue;
                // 盤面の絵がない人は、会話の立ち絵を小さくして立てる（盤面のドット絵ができたら差し替え）。立ち絵もない人（モブ）は仮の火の玉
                if (!view.HasUnitSprite(token) && dialogue != null)
                {
                    var tex = dialogue.PortraitOf(People.TryGetValue(person.id, out var named) ? named.name : person.name);
                    if (tex != null) view.SetUnitSprite(token, Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.02f), tex.height));
                }
                personCells[person.id] = person.Cell;
                map.Units.Add(new Board3DMap.Unit { cell = person.Cell, id = token });
            }
            view.Ground = grounds.FirstOrDefault(g => g.mapId == mapId).texture;
            view.Map = map;
            view.Setup();
            Board3DMood.Apply(string.IsNullOrEmpty(layout.timeOfDay) ? Board3DMood.Day : layout.timeOfDay, view.KeyLight, layout.indoor);
            view.ApplyPropTint();
            view.SetView(true, 0, true);
            view.SetOverview(false, true);
            view.FocusOn(Player, true);
            Log?.Invoke($"{layout.name}に入った");
            // 入ったときの会話 → 着いたマスの目的地
            PlayBlocks((State?.onEnter ?? Array.Empty<string>()).Where(b => !seen.Contains(b)).ToList(), () => CheckCell(Player, arrived: true));
        }

        // ── 押す ──

        /// <summary>マスを押した（盤面の CellTapped）</summary>
        public void Tap(Vector2Int cell)
        {
            if (Busy || Place == null) return;
            var map = view.Map;
            // 人を押した → 隣まで歩いて話しかける
            var person = State?.people?.FirstOrDefault(p => personCells.TryGetValue(p.id, out var c) && c == cell);
            if (person != null) { WalkThen(cell, adjacent: true, () => Talk(person)); return; }
            // 調べる所を押した → 隣（か、その上）まで歩いて調べる
            var inspect = AllInspects().FirstOrDefault(i => i.cells != null && i.cells.Any(c => c.V == cell));
            if (inspect != null) { WalkThen(cell, adjacent: !map.CanStop(cell, false), () => Inspect(inspect)); return; }
            if (map.CanStop(cell, false)) WalkThen(cell, adjacent: false, null);
        }

        private IEnumerable<MapInspect> AllInspects() =>
            (State?.inspect ?? Array.Empty<MapInspect>()).Concat(Place?.inspect ?? Array.Empty<MapInspect>());

        private void Talk(MapPerson person)
        {
            if (string.IsNullOrEmpty(person.talkBlock)) { Log?.Invoke($"{person.name}"); return; }
            PlayBlocks(new List<string> { person.talkBlock }, null, replay: true);
        }

        private void Inspect(MapInspect inspect)
        {
            if (!string.IsNullOrEmpty(inspect.block)) { PlayBlocks(new List<string> { inspect.block }, null, replay: true); return; }
            if (!string.IsNullOrEmpty(inspect.text)) PlayLines(new[] { new ScenarioLine { type = "narration", text = inspect.text } }, null);
        }

        // ── 歩く ──

        /// <summary>そのマス（adjacent なら、その隣のいちばん近いマス）まで歩き、着いたら then</summary>
        public void WalkThen(Vector2Int target, bool adjacent, Action then)
        {
            var path = FindPath(Player, target, adjacent);
            if (path == null) { Log?.Invoke("そこへは行けない"); return; }
            StopWalking();
            if (Application.isPlaying) walking = StartCoroutine(Walk(path, then));
            else
            {
                // エディタの確認用: 待たずに歩く（途中の会話で止まる）
                foreach (var cell in path)
                    if (!Step(cell)) return;
                then?.Invoke();
            }
        }

        private IEnumerator Walk(List<Vector2Int> path, Action then)
        {
            foreach (var cell in path)
            {
                yield return new WaitForSeconds(stepSeconds);
                if (!Step(cell)) { walking = null; yield break; }
            }
            walking = null;
            then?.Invoke();
        }

        private void StopWalking()
        {
            if (walking != null) StopCoroutine(walking);
            walking = null;
        }

        /// <summary>1マス進む。会話・扉などで止まったら false</summary>
        private bool Step(Vector2Int cell)
        {
            Player = cell;
            view.MoveUnit(PlayerId, cell);
            view.FollowCell(cell);
            return !CheckCell(cell, arrived: false);
        }

        /// <summary>そのマスで起きること（近づくと流れる会話・扉・目的地）。止まるなら true</summary>
        private bool CheckCell(Vector2Int cell, bool arrived)
        {
            // 近づくと流れる会話（一度だけ）
            var area = State?.talkAreas?.FirstOrDefault(a => a.trigger == "approach" && a.Contains(cell) && !(a.once && played.Contains(Place.mapId + "/" + a.id)) && !seen.Contains(a.block));
            if (area != null)
            {
                played.Add(Place.mapId + "/" + area.id);
                PlayBlocks(new List<string> { area.block }, null);
                return true;
            }
            // 目的地（着いたら会話 → 戦闘など）
            var goal = State?.goals?.FirstOrDefault(g => g.cells != null && g.cells.Any(c => c.V == cell));
            if (goal != null && !seen.Contains(goal.block ?? goal.id))
            {
                var blocks = new List<string>();
                if (!string.IsNullOrEmpty(goal.block)) blocks.Add(goal.block);
                PlayBlocks(blocks, () =>
                {
                    seen.Add(goal.id);
                    if (!string.IsNullOrEmpty(goal.thenBattleArea))
                    {
                        PendingBattleArea = goal.thenBattleArea;
                        Log?.Invoke($"戦闘へ（{goal.thenBattleArea}）");   // 段5で戦闘につなぐ
                    }
                });
                return true;
            }
            // 扉
            var exit = Place?.exits?.FirstOrDefault(e => e.cells != null && e.cells.Any(c => c.V == cell));
            if (exit != null && !arrived)
            {
                if (!exit.hasTarget || string.IsNullOrEmpty(exit.toMap) || !places.ContainsKey(exit.toMap))
                {
                    PlayLines(new[] { new ScenarioLine { type = "narration", text = $"{exit.label}（まだ入れない）" } }, null);
                    return true;
                }
                var missing = (exit.requires ?? Array.Empty<string>()).FirstOrDefault(r => !Satisfied(r));
                if (missing != null)
                {
                    PlayLines(new[] { new ScenarioLine { type = "narration", text = LockedText(missing) } }, null);
                    return true;
                }
                EnterPlace(exit.toMap, exit.toCell.V, exit.facing);
                return true;
            }
            return false;
        }

        private bool Satisfied(string requirement)
        {
            if (requirement.StartsWith("item:")) return items.Contains(requirement.Substring(5));
            if (requirement.StartsWith("block:")) return seen.Contains(requirement.Substring(6));
            return true;
        }

        private static string LockedText(string requirement) =>
            requirement.StartsWith("item:") ? $"まだ準備ができていない。（{requirement.Substring(5)}）"
                : "先にやることがある。";

        /// <summary>
        /// 歩く道（上下左右。止まれるマスと、扉・目的地のマスを通る。人のいるマスは通らない）。adjacent なら、目標の隣のマスまで。
        /// 見つからなければ null。道には出発のマスを含めない
        /// </summary>
        public List<Vector2Int> FindPath(Vector2Int from, Vector2Int target, bool adjacent)
        {
            var map = view.Map;
            bool Free(Vector2Int c) => map.CanStop(c, false) && !personCells.Values.Contains(c);
            bool IsGoal(Vector2Int c) => adjacent ? Mathf.Abs(c.x - target.x) + Mathf.Abs(c.y - target.y) == 1 : c == target;
            if (IsGoal(from)) return new List<Vector2Int>();
            var prev = new Dictionary<Vector2Int, Vector2Int> { [from] = from };
            var queue = new Queue<Vector2Int>();
            queue.Enqueue(from);
            var dirs = new[] { Vector2Int.up, Vector2Int.down, Vector2Int.left, Vector2Int.right };
            while (queue.Count > 0)
            {
                var c = queue.Dequeue();
                foreach (var d in dirs)
                {
                    var n = c + d;
                    if (prev.ContainsKey(n) || !Free(n)) continue;
                    prev[n] = c;
                    if (IsGoal(n))
                    {
                        var path = new List<Vector2Int> { n };
                        for (var back = c; back != from; back = prev[back]) path.Insert(0, back);
                        return path;
                    }
                    queue.Enqueue(n);
                }
            }
            return null;
        }

        // ── 会話 ──

        /// <summary>ブロックを順に流し、終わったら then。一度流したブロックは replay でなければ飛ばす</summary>
        public void PlayBlocks(List<string> blockIds, Action then, bool replay = false)
        {
            var queue = new Queue<string>(blockIds.Where(b => replay || !seen.Contains(b)));
            void Next()
            {
                if (queue.Count == 0) { then?.Invoke(); return; }
                var id = queue.Dequeue();
                var block = scenario?.Block(id);
                seen.Add(id);
                if (block == null || dialogue == null) { Log?.Invoke($"ブロックがない: {id}"); Next(); return; }
                // もう持っている物は、2回目にはもらわない（話しかけ直したとき）
                dialogue.Play(block, Next);
            }
            Next();
        }

        private void PlayLines(ScenarioLine[] lines, Action then)
        {
            if (dialogue == null) { then?.Invoke(); return; }
            dialogue.Play(new ScenarioBlock { id = "", part = "story", lines = lines }, then);
        }
    }
}
