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
            public string label;   // 調べる所の名前（2Dでの置き物に合わせる。例: 剣は収納箱の中）
        }

        [Serializable] public class StateLook { public string state, look; }

        [Serializable]
        public class Explore2D
        {
            public string map;            // 配置表の mapId（Assets/Data/Maps/<map>.json）
            public string axis = "y";     // 横に並べるマスの軸
            public float from, to;        // この値が左の端（歩ける範囲の左）・右の端
            public string state;          // 使う場面（空なら最初）
            public Spot[] spots;
            public StateLook[] looks;
            public string introDark;      // 入ったとき、このブロックが終わるまで画面を暗くしておく（寝起きの暗転開け。原作者 2026-10-04）     // 場面ごとの見え方（Assets/Data/Looks/<look>.json）。なければ場所のふだんの見え方
        }

        [Serializable] private class CorridorExplore { public Explore2D explore; }

        [SerializeField] private Corridor2DView view;
        [SerializeField] private DialogueView dialogue;
        [SerializeField] private TextAsset[] placeJsons = Array.Empty<TextAsset>();   // 2Dの場所（Assets/Data/Corridors/<場所>.json）
        [SerializeField] private TextAsset[] mapJsons = Array.Empty<TextAsset>();     // 配置表（Assets/Data/Maps/<mapId>.json）
        [SerializeField] private string startPlace = "orcus_room";   // 最初の場所（プロローグは自室で起きる）
        [SerializeField] private TextAsset scenarioJson;
        [SerializeField] private Texture2D[] sprites = Array.Empty<Texture2D>();   // 盤面のキャラの絵（Assets/Art/SD）

        // 配置表の人の id → 盤面の絵の名前と、会話の名前（ExploreController と同じ）
        private static readonly Dictionary<string, (string token, string name)> People = new Dictionary<string, (string, string)>
        {
            { "young_arshe", ("young_arshe", "アルシェ") },
            { "young_karima", ("young_karima", "カリマ") },
            { "gunter", ("gunter", "ギュンター") },
            { "carrie", ("carrie_present", "キャリー") },   // キャリー(現代)（原作者 2026-10-04）
            { "henry", ("henry", "ヘンリー") },             // ヘンリー(現代)
        };

        private const float TalkReach = 70f, InspectReach = 60f, ExitReach = 70f, StandOff = 52f;

        private Explore2D ex;
        private MapLayoutFile map;
        private ScenarioFile scenario;
        private readonly HashSet<string> seen = new HashSet<string>();
        private readonly HashSet<string> played = new HashSet<string>();
        private readonly List<string> items = new List<string>();
        private readonly Dictionary<string, float> personX = new Dictionary<string, float>();
        private bool starting, moving;
        private readonly Dictionary<string, string> stateOf = new Dictionary<string, string>();   // 配置表 → 使う場面（あとで場面を進めるとき）
        private CanvasGroup fade;
        private List<(string, string, Texture2D, float)> peopleList = new List<(string, string, Texture2D, float)>();

        /// <summary>見え方を切り替える（シナリオの場面から。人も並べ直す）</summary>
        public void SetLook(string name) => view?.SetLook(name);   // 組み立て直したら Rebuilt で人を並べ直す

        public MapState State { get; private set; }
        public IReadOnlyCollection<string> Seen => seen;
        public IReadOnlyList<string> Items => items;
        public bool Busy => (dialogue != null && dialogue.IsPlaying) || (view != null && view.ScriptedWalking) || starting || moving;
        public string Place => view != null ? view.PlaceName : null;
        public float PersonX(string id) => personX.TryGetValue(id, out var x) ? x : float.NaN;

        private void Start() => Begin();

        public void Begin()
        {
            scenario = scenarioJson != null ? JsonUtility.FromJson<ScenarioFile>(scenarioJson.text) : new ScenarioFile();
            if (view == null || placeJsons.Length == 0) { enabled = false; return; }
            view.Controlled = true;
            view.Rebuilt -= OnViewRebuilt;
            view.Rebuilt += OnViewRebuilt;
            view.Tapped -= OnTap;
            view.Tapped += OnTap;
            if (dialogue != null) { dialogue.OnItem -= GotItem; dialogue.OnItem += GotItem; }
            if (dialogue != null)
            {
                dialogue.OnDirection -= OnDirection; dialogue.OnDirection += OnDirection;
                dialogue.Closed -= OnTalkClosed; dialogue.Closed += OnTalkClosed;
            }
            if (ExploreHandoff.Pending2D && PlaceAsset(ExploreHandoff.Place2D) != null)
            {
                // 戦闘の場所から戻ってきた: 流した会話・持ち物を引き継ぎ、その場所の指定の場面から
                seen.UnionWith(ExploreHandoff.Seen);
                foreach (var it in ExploreHandoff.Items) if (!items.Contains(it)) items.Add(it);
                string place = ExploreHandoff.Place2D, state = ExploreHandoff.State2D;
                ExploreHandoff.Clear();
                var mapId = JsonUtility.FromJson<CorridorExplore>(PlaceAsset(place).text)?.explore?.map;
                if (!string.IsNullOrEmpty(state) && !string.IsNullOrEmpty(mapId)) stateOf[mapId] = state;
                EnterPlace(place, null);
                return;
            }
            EnterPlace(placeJsons.Any(t => t != null && t.name == startPlace) ? startPlace : placeJsons[0].name, null);
        }

        private TextAsset PlaceAsset(string name) => placeJsons.FirstOrDefault(t => t != null && t.name == name);

        /// <summary>その配置表の場所が2Dにあれば、その場所の名前（なければ null）</summary>
        private string PlaceOfMap(string mapId) =>
            placeJsons.Where(t => t != null).FirstOrDefault(t => JsonUtility.FromJson<CorridorExplore>(t.text)?.explore?.map == mapId)?.name;

        /// <summary>
        /// 2Dの場所に入る（2026-10-04: 扉から別の場所へ）。fromMap があれば、その場所へ戻る扉の前に立つ。なければ場面の始まりの位置。
        /// 流した会話・持ち物・一度だけの会話は場所をまたいで残る
        /// </summary>
        public void EnterPlace(string placeName, string fromMap)
        {
            var asset = PlaceAsset(placeName);
            ex = asset != null ? JsonUtility.FromJson<CorridorExplore>(asset.text)?.explore : null;
            map = ex != null ? mapJsons.Where(t => t != null).Select(t => JsonUtility.FromJson<MapLayoutFile>(t.text)).FirstOrDefault(m => m.mapId == ex.map) : null;
            if (ex == null || map == null) { Debug.LogWarning($"[Explore2D] 場所がない: {placeName}"); return; }
            peopleList = new List<(string, string, Texture2D, float)>();
            view.SetPlace(asset);
            string stateId = stateOf.TryGetValue(map.mapId, out var sid) ? sid : ex.state;
            State = (!string.IsNullOrEmpty(stateId) ? map.State(stateId) : null) ?? map.states?.FirstOrDefault();

            // 人を並べる（アルシェ以外）
            // 場面の見え方（空・効果）。変わるときは組み立て直すので、人を並べる前に
            var stateLook = ex.looks?.FirstOrDefault(l => l.state == State?.id)?.look;
            if (!string.IsNullOrEmpty(stateLook)) view.SetLook(stateLook);

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
            peopleList = list;
            OnViewRebuilt();   // 人と、調べる所の印
            // 戻ってきた扉の前（少し内側）。なければ場面の始まりの位置
            var back = fromMap != null ? map.exits?.FirstOrDefault(e => e.toMap == fromMap) : null;
            if (back != null)
            {
                float bx = CellsX(back.id, back.cells);
                view.PlayerX = bx + (bx < view.Length / 2f ? 50f : -50f);
                view.Face(view.Length / 2f);
            }
            else view.PlayerX = State?.player != null ? X("player", State.player.Cell) : view.WalkMinX;

            // 入ったときの会話
            var onEnter = (State?.onEnter ?? Array.Empty<string>()).ToList();
            int dark = string.IsNullOrEmpty(ex.introDark) || seen.Contains(ex.introDark) ? -1 : onEnter.IndexOf(ex.introDark);
            if (dark >= 0)
            {
                // 暗いまま最初の会話（携帯端末の音）→ 明けながら続きの会話
                starting = true;
                view.Darkness = 1f;
                var first = onEnter.Take(dark + 1).ToList();
                var rest = onEnter.Skip(dark + 1).ToList();
                PlayBlocks(first, () =>
                {
                    if (Application.isPlaying) StartCoroutine(FadeIn(1.2f)); else view.Darkness = 0f;
                    PlayBlocks(rest, () => starting = false);
                });
            }
            else if (onEnter.Count > 0) { starting = true; PlayBlocks(onEnter, () => starting = false); }
        }

        private System.Collections.IEnumerator FadeIn(float seconds)
        {
            for (float t = 0f; t < seconds; t += Time.unscaledDeltaTime) { view.Darkness = 1f - t / seconds; yield return null; }
            view.Darkness = 0f;
        }

        // ── シナリオの演出（StageDirection。原作者 2026-10-05: 指示があるところは自動で、なければふつうのカメラ） ──
        private bool directedDark;

        private void OnDirection(string text)
        {
            var shot = StageDirection.Parse(text);
            if (shot.any)
            {
                var now = view.Shot;
                if (shot.reset) view.SetShot(0f, 0f, 1f);
                else view.SetShot(now.x + shot.dx, now.y + shot.dy, shot.zoom > 0f ? shot.zoom : now.z);
            }
            if (shot.dark == true) { view.Darkness = 1f; directedDark = true; }
            else if (shot.dark == false) { view.Darkness = 0f; directedDark = false; }
        }

        /// <summary>会話が終わったら、演出のカメラと暗転をもどす（次の会話はふつうのカメラから）</summary>
        private void OnTalkClosed()
        {
            if (view == null) return;
            if (view.Shot != new Vector3(0f, 0f, 1f)) view.SetShot(0f, 0f, 1f);
            if (directedDark) { view.Darkness = 0f; directedDark = false; }
        }

        private void OnViewRebuilt()
        {
            if (dialogue != null) dialogue.Letterbox = view.TalkBands;   // 場面の見え方で、会話の帯を出すか
            view.SetPeople(peopleList);
            view.SetMarkers(InspectSpots().Select(i => CellsX(i.id, i.cells)));
        }

        private IEnumerable<MapInspect> InspectSpots() => (State?.inspect ?? Array.Empty<MapInspect>()).Concat(map?.inspect ?? Array.Empty<MapInspect>());

        /// <summary>
        /// 画面を押した（原作者 2026-10-04: ◀ ▶ だけだと不便。押した所へ進む）。
        /// 人・調べる所・扉の近くを押したら、そこまで歩いてから話す・調べる・扉を使う。ほかは押した所へ歩くだけ
        /// </summary>
        private void OnTap(float x, float y)
        {
            if (Busy || State == null) return;
            const float Pick = 48f;
            var person = (State.people ?? Array.Empty<MapPerson>()).Where(p => !string.IsNullOrEmpty(p.talkBlock) && Mathf.Abs(personX[p.id] - x) < Pick)
                .OrderBy(p => Mathf.Abs(personX[p.id] - x)).FirstOrDefault();
            if (person != null) { Talk(person); return; }
            var inspect = InspectSpots().Where(i => Mathf.Abs(CellsX(i.id, i.cells) - x) < Pick).OrderBy(i => Mathf.Abs(CellsX(i.id, i.cells) - x)).FirstOrDefault();
            if (inspect != null) { view.WalkToTap(CellsX(inspect.id, inspect.cells), y, () => Inspect(inspect)); return; }
            var exit = (map.exits ?? Array.Empty<MapExit>()).Where(e => Mathf.Abs(CellsX(e.id, e.cells) - x) < Pick).OrderBy(e => Mathf.Abs(CellsX(e.id, e.cells) - x)).FirstOrDefault();
            if (exit != null) { view.WalkToTap(CellsX(exit.id, exit.cells), y, () => UseExit(exit)); return; }
            view.WalkToTap(x, y);
        }

        /// <summary>場所を移る: 暗くする → 入る → 明るくする（0.25 秒ずつ）</summary>
        private System.Collections.IEnumerator Move(Action enter)
        {
            moving = true;
            if (fade == null)
            {
                var go = new GameObject("場所の移動", typeof(Canvas), typeof(UnityEngine.UI.Image), typeof(CanvasGroup));
                var canvas = go.GetComponent<Canvas>();
                canvas.renderMode = RenderMode.ScreenSpaceOverlay;
                canvas.sortingOrder = 350;
                var img = go.GetComponent<UnityEngine.UI.Image>();
                img.color = new Color(0.02f, 0.02f, 0.04f, 1f);
                img.raycastTarget = false;
                fade = go.GetComponent<CanvasGroup>();
                fade.blocksRaycasts = false;
            }
            for (float t = 0f; t < 0.25f; t += Time.unscaledDeltaTime) { fade.alpha = t / 0.25f; yield return null; }
            fade.alpha = 1f;
            enter();
            yield return null;
            for (float t = 0f; t < 0.25f; t += Time.unscaledDeltaTime) { fade.alpha = 1f - t / 0.25f; yield return null; }
            fade.alpha = 0f;
            moving = false;
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
            // 相手のいる会話の間だけ寄る（相手の隣へ歩いて始めた会話。1人で調べたときは寄らない。原作者 2026-10-04）
            view.TalkZoom = dialogue != null && dialogue.IsPlaying && view.FocusX != null;
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
                if (d < InspectReach && d < best.dist) best = (d, $"調べる（{InspectName(i)}）", () => Inspect(inspect));
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

        /// <summary>調べる所の名前（配置表の label。なければ、そのマスにある物の名前。括弧の中は省く）</summary>
        private string InspectName(MapInspect i)
        {
            string name = !string.IsNullOrEmpty(SpotOf(i.id)?.label) ? SpotOf(i.id).label : i.label;
            if (string.IsNullOrEmpty(name))
                name = map?.objects?.FirstOrDefault(o => o.cells != null && i.cells != null && o.cells.Any(c => i.cells.Any(k => k.x == c.x && k.y == c.y)))?.kind ?? "";
            int cut = name.IndexOfAny(new[] { '（', '(' });
            if (cut > 0) name = name.Substring(0, cut);
            return string.IsNullOrEmpty(name) ? "ここ" : name;
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
            // 行き先が2Dの場所なら、暗くして入る。まだ2Dにしていない場所は一言だけ
            string target = PlaceOfMap(exit.toMap);
            if (target == null)
            {
                // 2Dにない場所＝戦闘になる場所（奥行きのある盤面）。会話・持ち物を持って Explore3D へ（原作者 2026-10-04）
                if (!Application.isPlaying) { Debug.Log($"[Explore2D] 戦闘の場所へ: {exit.toMap}"); return; }
                ExploreHandoff.Set(exit.toMap, exit.toCell.V, exit.facing, seen, items);
                StartCoroutine(Move(() => UnityEngine.SceneManagement.SceneManager.LoadScene("Explore3D")));
                return;
            }
            string from = map.mapId;
            if (!Application.isPlaying) { EnterPlace(target, from); return; }
            StartCoroutine(Move(() => EnterPlace(target, from)));
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

        /// <summary>確認用: 調べる所・扉・人の横の位置（id）</summary>
        public float SpotX(string id)
        {
            if (personX.TryGetValue(id, out var px)) return px;
            var i = (State?.inspect ?? Array.Empty<MapInspect>()).Concat(map?.inspect ?? Array.Empty<MapInspect>()).FirstOrDefault(n => n.id == id);
            if (i != null) return CellsX(i.id, i.cells);
            var e = map?.exits?.FirstOrDefault(n => n.id == id);
            return e != null ? CellsX(e.id, e.cells) : float.NaN;
        }

        /// <summary>確認用: その横の位置へ置き、近づくと流れる会話などを起こす（Update と同じ判定）</summary>
        public void StepForTest(float x)
        {
            view.PlayerX = x;
            Update();
            Update();                     // 会話が始まったら、寄る（TalkZoom）を入れる
            view.PlayerX = view.PlayerX;  // 置き直して画面に反映
        }
    }
}
