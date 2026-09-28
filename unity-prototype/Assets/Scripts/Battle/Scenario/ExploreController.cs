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
        private ExploreHud hud;
        private bool walkedOnce;
        public ExploreHud Hud => hud;

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
            if (hud == null)
            {
                hud = GetComponent<ExploreHud>() ?? gameObject.AddComponent<ExploreHud>();
                hud.Build(view != null ? view.TargetCamera : Camera.main, dialogue != null ? dialogue.RegularFont : null, dialogue != null ? dialogue.BoldFont : null);
                hud.Hidden = () => Busy;
            }
        }

        private void GotItem(string item)
        {
            if (!items.Contains(item)) { items.Add(item); Log?.Invoke($"「{item}」を手に入れた"); hud?.Toast($"「{item}」を手に入れた"); }
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
            map.Units.Add(new Board3DMap.Unit { cell = Player, id = PlayerId, neutral = true });   // 探索では陣営の枠を付けない
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
                map.Units.Add(new Board3DMap.Unit { cell = person.Cell, id = token, neutral = true });
            }
            view.Ground = grounds.FirstOrDefault(g => g.mapId == mapId).texture;
            view.Map = map;
            view.Setup();
            Board3DMood.Apply(string.IsNullOrEmpty(layout.timeOfDay) ? Board3DMood.Day : layout.timeOfDay, view.KeyLight, layout.indoor);
            view.ApplyPropTint();
            view.SetView(true, 0, true);
            view.SetOverview(false, true);
            // 入った直後は、アルシェから場所の真ん中の方へ少し寄せて見る（レビュー J6: 画面の半分が場所の外の黒になった）
            var center = WalkableCenter(map);
            view.FocusOnPoint(Vector3.Lerp(map.TopCenter(Player), center, 0.4f), true);
            Log?.Invoke($"{layout.name}に入った");
            hud?.Toast(layout.name);
            RefreshHud();
            // 入ったときの会話 → 着いたマスの目的地
            PlayBlocks((State?.onEnter ?? Array.Empty<string>()).Where(b => !seen.Contains(b)).ToList(), () =>
            {
                if (!CheckCell(Player, arrived: true) && !walkedOnce) hud?.Toast("行きたい所を押すと歩きます", 4f);
            });
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
            else CannotGo(cell);
        }

        /// <summary>行けないマスを押した: 一瞬赤く光らせ、短く知らせる（レビュー J1）</summary>
        private void CannotGo(Vector2Int cell)
        {
            Log?.Invoke("そこへは行けない");
            hud?.Toast("そこへは行けない", 1.2f);
            view.ShowRange(new[] { cell }, Board3DView.AttackRangeColor);
            if (Application.isPlaying) StartCoroutine(ClearFlash());
        }

        private IEnumerator ClearFlash()
        {
            yield return new WaitForSeconds(0.35f);
            view.ShowRange(null);
        }

        /// <summary>通れるマスの真ん中（入った直後のカメラの寄せ先）</summary>
        private static Vector3 WalkableCenter(Board3DMap map)
        {
            var sum = Vector3.zero;
            int n = 0;
            for (int y = 0; y < map.Rows; y++)
            for (int x = 0; x < map.Columns; x++)
            {
                var c = new Vector2Int(x, y);
                if (!map.CanStop(c, false)) continue;
                sum += map.TopCenter(c);
                n++;
            }
            return n > 0 ? sum / n : Vector3.zero;
        }

        // ── 画面の表示（印・目的） ──

        private static string Short(string text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            int i = text.IndexOf('（');
            return (i > 0 ? text.Substring(0, i) : text).Trim();
        }

        /// <summary>調べる所の名前（配置表の label、なければそのマスの物の種類）</summary>
        private string InspectName(MapInspect inspect)
        {
            if (!string.IsNullOrEmpty(inspect.label)) return Short(inspect.label);
            var cell = inspect.cells != null && inspect.cells.Length > 0 ? inspect.cells[0].V : Vector2Int.zero;
            var obj = Place?.objects?.FirstOrDefault(o => o.cells != null && o.cells.Any(c => c.V == cell));
            return obj != null ? Short(obj.kind) : "調べる所";
        }

        /// <summary>そのブロックで最初に話す、アルシェ以外の人（「〜に会う」に使う）</summary>
        private string SpeakerOf(string blockId)
        {
            var block = scenario?.Block(blockId);
            return block?.Shown.Select(l => l.speaker).FirstOrDefault(s => !string.IsNullOrEmpty(s) && s != "アルシェ" && !s.Contains("携帯端末"));
        }

        /// <summary>頭上の印・扉の札・今の目的を、今の状態に合わせて作り直す</summary>
        public void RefreshHud()
        {
            if (hud == null || Place == null) return;
            hud.ClearMarks();
            foreach (var person in State?.people ?? Array.Empty<MapPerson>())
            {
                if (string.IsNullOrEmpty(person.talkBlock) || !personCells.ContainsKey(person.id)) continue;
                string token = People.TryGetValue(person.id, out var pp) ? pp.token : person.id;
                hud.AddMark(seen.Contains(person.talkBlock) ? ExploreHud.MarkKind.Talked : ExploreHud.MarkKind.Talk,
                    () => view.UnitHeadToScreen(token) + new Vector3(0f, 6f, 0f));
            }
            foreach (var inspect in AllInspects())
            {
                if (inspect.cells == null || inspect.cells.Length == 0) continue;
                var cell = inspect.cells[0].V;
                bool done = !string.IsNullOrEmpty(inspect.block) && seen.Contains(inspect.block);
                var kind = done ? ExploreHud.MarkKind.Inspected : inspect.required ? ExploreHud.MarkKind.InspectRequired : ExploreHud.MarkKind.Inspect;
                float height = view.Map.IsObstacle(cell) ? 1.0f : 0.5f;
                hud.AddMark(kind, () => view.CellPointToScreen(cell, height));
            }
            foreach (var exit in Place.exits ?? Array.Empty<MapExit>())
            {
                if (exit.cells == null || exit.cells.Length == 0 || string.IsNullOrEmpty(exit.label)) continue;
                var cell = exit.cells[0].V;
                bool open = exit.hasTarget && places.ContainsKey(exit.toMap ?? "") && (exit.requires ?? Array.Empty<string>()).All(Satisfied);
                hud.AddMark(open ? ExploreHud.MarkKind.Door : ExploreHud.MarkKind.DoorLocked, () => view.CellPointToScreen(cell, 0.25f), Short(exit.label));
            }
            hud.SetObjective(Objective());
        }

        /// <summary>今の目的（携帯端末のタスクができるまでの代わり。レビュー J2）</summary>
        public string Objective()
        {
            // 先へ進むのに要る「調べる所」
            var needInspect = AllInspects().FirstOrDefault(i => i.required && !string.IsNullOrEmpty(i.block) && !seen.Contains(i.block));
            if (needInspect != null) return $"{InspectName(needInspect)}を調べる";
            foreach (var goal in State?.goals ?? Array.Empty<MapGoal>())
            {
                if (seen.Contains(goal.id)) continue;
                var exit = Place.exits?.FirstOrDefault(e => e.id == goal.exit);
                if (exit != null)
                {
                    var missing = (exit.requires ?? Array.Empty<string>()).FirstOrDefault(r => !Satisfied(r));
                    if (missing != null && missing.StartsWith("block:") && SpeakerOf(missing.Substring(6)) is string who) return $"{who}に会う";
                    if (missing != null && missing.StartsWith("item:")) return $"{missing.Substring(5)}を持っていく";
                    return $"{Short(exit.label).TrimEnd('へ')}へ進む";
                }
                if (!string.IsNullOrEmpty(goal.block) && !seen.Contains(goal.block)) return $"{Place.name}に入る";
            }
            return "";
        }

        private IEnumerable<MapInspect> AllInspects() =>
            (State?.inspect ?? Array.Empty<MapInspect>()).Concat(Place?.inspect ?? Array.Empty<MapInspect>());

        private void Talk(MapPerson person)
        {
            if (string.IsNullOrEmpty(person.talkBlock)) { Log?.Invoke($"{person.name}"); return; }
            LookAtTalk(person);
            PlayBlocks(new List<string> { person.talkBlock }, null, replay: true);
        }

        /// <summary>会話が始まったら、話す2人のまん中へ寄せる（レビュー J5）</summary>
        private void LookAtTalk(MapPerson person)
        {
            if (person == null || !personCells.TryGetValue(person.id, out var cell)) return;
            var map = view.Map;
            view.FocusOnPoint((map.TopCenter(Player) + map.TopCenter(cell)) * 0.5f);
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
            if (path == null) { CannotGo(target); return; }
            StopWalking();
            StartedWalking();
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

        private void StartedWalking()
        {
            walkedOnce = true;
            view.ShowRange(null);
            hud?.HideToast();
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
                LookAtTalk(State?.people?.FirstOrDefault(p => p.talkBlock == area.block));
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
                    PlayLines(new[] { new ScenarioLine { type = "narration", text = $"{Short(exit.label)}は、今は入れない。" } }, null);
                    return true;
                }
                var missing = (exit.requires ?? Array.Empty<string>()).FirstOrDefault(r => !Satisfied(r));
                if (missing != null)
                {
                    // 扉ごとの一言（配置表の lockedText）。なければ、アルシェの独り言として足りない物・会う人から作る（レビュー J3）
                    string text = !string.IsNullOrEmpty(exit.lockedText) ? exit.lockedText : LockedText(missing);
                    PlayLines(new[] { new ScenarioLine { type = "line", speaker = "アルシェ", text = text } }, null);
                    return true;
                }
                EnterPlace(exit.toMap, exit.toCell.V, exit.facing);
                return true;
            }
            return false;
        }

        /// <summary>確認用: そのマスに踏み込んだときに起きること（会話・扉の止める一言など）を、歩かずに起こす</summary>
        public bool CheckCellForTest(Vector2Int cell) => CheckCell(cell, arrived: false);

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
                if (queue.Count == 0) { RefreshHud(); then?.Invoke(); return; }
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
