using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Srpg.Battle.Plan;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// Unity版の戦闘（M1）を3Dの盤面で動かす（原作者 2026-09-27: マップは3Dの盤面に置き換える。戦闘もUnityへ移す）。
    ///   味方の番: 味方を押す → 移動範囲（青）→ 移動先を押す（自分のマスならその場）→「攻撃／待機」
    ///            →「攻撃」なら攻撃の範囲（赤）→ 相手を押す → 戦闘予測 →「実行」
    ///   全員が動いたら（または「ターン終了」）敵の番: 敵は戦闘予測の評価（BattlePlan.ScoreAttack）で動く先と相手を選ぶ。
    /// 戦闘の計算はブラウザ版の battlePlan.js を移した BattlePlan（答え合わせのテストで同じ結果になることを確かめている）。
    /// 表示は Board3DView、移動の規則は MoveRange・TerrainRules。操作の欄は仮（IMGUI）。正式なUIは別に作る。
    /// </summary>
    public class Battle3DController : MonoBehaviour
    {
        [SerializeField] private TextAsset battleJson;   // 盤面・配置（tools/export_unity_battle.js）
        [SerializeField] private TextAsset planJson;     // 戦闘の状態（tools/export_unity_battle_plan.mjs）
        [SerializeField] private Board3DView view;
        [SerializeField] private float enemyStepSeconds = 0.6f;

        public enum Phase { Ally, Enemy, Victory, Defeat }
        public enum Mode { Idle, Moving, Acting, Targeting, Forecast }

        private BattleDataFile data;
        private Board3DMap map;
        private readonly List<UnitState> units = new List<UnitState>();
        private readonly HashSet<Vector2Int> blocked = new HashSet<Vector2Int>();
        private readonly HashSet<Vector2Int> moveCells = new HashSet<Vector2Int>();
        private readonly HashSet<Vector2Int> attackCells = new HashSet<Vector2Int>();
        private readonly List<string> log = new List<string>();
        private readonly List<Popup> popups = new List<Popup>();
        private UnitState selected;
        private UnitState target;
        private Vector2Int moveFrom;
        private BattlePlan.Forecast forecast;

        public BattleDataFile Data => data;
        public IReadOnlyList<UnitState> Units => units;
        public UnitState Selected => selected;
        public UnitState Target => target;
        public Board3DView View => view;
        public Phase CurrentPhase { get; private set; } = Phase.Ally;
        public Mode CurrentMode { get; private set; } = Mode.Idle;
        public int Turn { get; private set; } = 1;
        public BattlePlan.Forecast CurrentForecast => forecast;
        public IReadOnlyList<string> Log => log;
        /// <summary>テスト用: 乱数を決めたものに差し替える（null なら本物の乱数）</summary>
        public IPlanRolls RollsOverride { get; set; }

        /// <summary>盤面の上のユニット（位置・陣営・戦闘の状態）</summary>
        public class UnitState : MoveRange.IOccupant
        {
            public UnitData source;
            public PlanUnit plan;      // 戦闘の状態（HP・MP・能力値・スキル・装備）。位置は cell と同じにする
            public Vector2Int cell;
            public bool moved;
            public bool acted;
            public Vector2Int Cell => cell;
            public string Side => source.side;
            public bool Alive => plan == null || plan.hp > 0;
            public string Id => source.id;
            public string Name => source.name;
        }

        private struct Popup
        {
            public string unitId;
            public string text;
            public Color color;
            public float time;
        }

        private void Start()
        {
            Setup();
            view.SetView(true, 0, true);
            FocusOnAllies(true);
        }

        /// <summary>味方のまん中に寄る（寄りの画面。原作者 2026-09-27）</summary>
        public void FocusOnAllies(bool immediate = false)
        {
            var allies = units.Where(u => u.Side == "ally" && u.Alive).ToList();
            if (allies.Count == 0) return;
            var center = Vector3.zero;
            foreach (var a in allies) center += map.TopCenter(a.cell);
            view.FocusOnPoint(center / allies.Count, immediate);
        }

        /// <summary>データを読み、盤面を組み立て直す（エディタ上でも動く）</summary>
        public void Setup()
        {
            if (battleJson == null) throw new InvalidOperationException("battleJson が設定されていない");
            if (view == null) throw new InvalidOperationException("view（Board3DView）が設定されていない");
            data = JsonUtility.FromJson<BattleDataFile>(battleJson.text);
            var planState = planJson != null ? JsonUtility.FromJson<PlanStateFile>(planJson.text) : null;
            if (planState != null) BattlePlan.SetItems(planState.items);

            units.Clear();
            moveCells.Clear();
            attackCells.Clear();
            log.Clear();
            popups.Clear();
            selected = null;
            target = null;
            forecast = null;
            CurrentPhase = Phase.Ally;
            CurrentMode = Mode.Idle;
            Turn = 1;
            blocked.Clear();
            foreach (var tile in data.tiles ?? Array.Empty<TileData>())
                if (tile.type == "wall" || tile.type == "void") blocked.Add(new Vector2Int(tile.x, tile.y));

            map = BuildMap(data, blocked);
            foreach (var source in data.units)
            {
                var state = new UnitState { source = source, cell = new Vector2Int(source.x, source.y) };
                var snapshot = planState?.units?.FirstOrDefault(u => u.id == source.id);
                if (snapshot != null)
                {
                    state.plan = snapshot.Clone();
                    state.plan.x = state.cell.x;
                    state.plan.y = state.cell.y;
                }
                units.Add(state);
                map.Units.Add(new Board3DMap.Unit { cell = state.cell, id = source.id, enemy = source.side == "enemy" });
            }
            view.Map = map;
            view.CellTapped -= TapCell;
            view.CellTapped += TapCell;
            view.IsOverOtherGui = IsOverPanel;
            view.Setup();
            AddLog("味方フェーズ ターン1");
        }

        /// <summary>
        /// 戦闘データから3Dの盤面のデータを作る。
        /// 今の戦闘データは「通れないマス」しか持たないので、通れるマスの地形（石畳・苔・土）は見た目だけで決める。
        /// 地形の規則（水堀・遮蔽物など）をブラウザ版の戦闘データに足したら、それをそのまま使う
        /// </summary>
        public static Board3DMap BuildMap(BattleDataFile battle, ICollection<Vector2Int> blockedCells)
        {
            var map = new Board3DMap(battle.cols, battle.rows);
            for (int r = 0; r < battle.rows; r++)
            for (int c = 0; c < battle.cols; c++)
            {
                var cell = new Vector2Int(c, r);
                if (blockedCells.Contains(cell)) { map.SetTerrain(cell, '#'); continue; }
                // 中央の2行と真ん中の1列に古い石畳の道。まわりは苔と下草で、ところどころに石と土（同じデータなら毎回同じ配置）
                bool road = Mathf.Abs(r - (battle.rows - 1) * 0.5f) <= 0.5f || c == battle.cols / 2;
                int noise = ((c * 73856093) ^ (r * 19349663)) & 0xff;
                map.SetTerrain(cell, road ? (noise < 36 ? 'd' : 's') : (noise < 22 ? 'd' : noise < 44 ? 's' : 'g'));
            }
            Board3DScenery.Surround(map);   // まわりの景色（盤面の外を透明にしない）
            return map;
        }

        // ── 範囲 ──

        private List<Vector2Int> MoveCellsOf(UnitState unit)
        {
            // 地形の通行（TerrainRules）: 地上は s d g = だけ。飛行は通り抜けられるが、# と t には止まれない
            bool flying = unit.source.flying;
            return MoveRange.Compute(unit.cell, unit.source.move, unit.source.side, units.Where(u => u.Alive), data.cols, data.rows,
                cell => map.CanEnter(cell, flying), cell => map.CanStop(cell, flying), unit);
        }

        /// <summary>攻撃が届く距離（武器の射程。魔導書は1〜2、魔法射程+1で1〜3）</summary>
        public static (int min, int max) AttackReach(PlanUnit unit)
        {
            if (unit == null) return (1, 1);
            if (unit.HasGrimoireSpell) return (TrialRules.GrimoireRangeMin, TrialRules.GrimoireRangeMax + (unit.Has("魔法射程+1") ? 1 : 0));
            if (unit.equippedItem != null && BattlePlan.Items.TryGetValue(unit.equippedItem, out var item) && item.kind == "weapon")
                return (1, Math.Max(1, item.range));
            return (1, 1);
        }

        private static int Distance(Vector2Int a, Vector2Int b) => Mathf.Abs(a.x - b.x) + Mathf.Abs(a.y - b.y);

        private IEnumerable<UnitState> TargetsFrom(UnitState attacker, Vector2Int from)
        {
            var (min, max) = AttackReach(attacker.plan);
            return units.Where(u => u.Alive && u.Side != attacker.Side && Distance(u.cell, from) >= min && Distance(u.cell, from) <= max);
        }

        // ── 味方の番の操作 ──

        /// <summary>マスを押したときの処理</summary>
        public void TapCell(Vector2Int cell)
        {
            if (CurrentPhase != Phase.Ally) return;
            if (cell.x < 0 || cell.y < 0 || cell.x >= data.cols || cell.y >= data.rows) { CancelToIdle(); return; }
            var unit = units.FirstOrDefault(u => u.Alive && u.cell == cell);
            switch (CurrentMode)
            {
                case Mode.Moving:
                    if (unit == selected || (unit == null && moveCells.Contains(cell))) { MoveSelectedTo(cell); return; }
                    break;
                case Mode.Targeting:
                    if (unit != null && unit.Side != selected.Side && attackCells.Contains(cell)) { ShowForecast(unit); return; }
                    BackToActing();
                    return;
                case Mode.Acting:
                case Mode.Forecast:
                    return;   // 操作の欄で選ぶ
            }
            if (unit != null && unit.Side == "ally" && !unit.acted) { Select(unit); return; }
            CancelToIdle();
        }

        public void Select(string unitId)
        {
            var unit = units.FirstOrDefault(u => u.Id == unitId);
            if (unit != null) Select(unit);
        }

        private void Select(UnitState unit)
        {
            CancelToIdle();
            selected = unit;
            moveFrom = unit.cell;
            CurrentMode = Mode.Moving;
            var range = MoveCellsOf(unit);
            foreach (var cell in range) moveCells.Add(cell);
            view.ShowRange(range);
            view.Select(unit.cell);
            view.SetUnitHighlighted(unit.Id, true);
            view.FocusOn(unit.cell);
        }

        private void MoveSelectedTo(Vector2Int cell)
        {
            if (cell != selected.cell)
            {
                selected.cell = cell;
                if (selected.plan != null) { selected.plan.x = cell.x; selected.plan.y = cell.y; }
                view.MoveUnit(selected.Id, cell);
            }
            selected.moved = true;
            moveCells.Clear();
            view.ShowRange(null);
            view.Select(cell);
            CurrentMode = Mode.Acting;
        }

        /// <summary>「攻撃」: 攻撃の範囲（赤）を出して、相手を選ぶ</summary>
        public void ChooseAttack()
        {
            if (CurrentMode != Mode.Acting || selected == null) return;
            attackCells.Clear();
            var (min, max) = AttackReach(selected.plan);
            for (int x = 0; x < data.cols; x++)
            for (int y = 0; y < data.rows; y++)
            {
                var cell = new Vector2Int(x, y);
                int d = Distance(cell, selected.cell);
                if (d >= min && d <= max) attackCells.Add(cell);
            }
            view.ShowRange(attackCells, Board3DView.AttackRangeColor);
            CurrentMode = Mode.Targeting;
        }

        /// <summary>相手を選んで戦闘予測を出す</summary>
        public void ShowForecast(UnitState defender)
        {
            if (selected == null || defender == null || defender.Side == selected.Side || selected.plan == null || defender.plan == null) return;
            target = defender;
            forecast = BattlePlan.ForecastOf(selected.plan, defender.plan, PlanAction.ForEquipped(selected.plan), PlanUnits());
            view.ShowRange(new[] { defender.cell }, Board3DView.AttackRangeColor);
            CurrentMode = Mode.Forecast;
        }

        public void ShowForecast(string defenderId) => ShowForecast(units.FirstOrDefault(u => u.Id == defenderId));

        /// <summary>「実行」: 戦闘予測と同じ計算を本物の乱数で行い、結果を盤面に反映する</summary>
        public void ConfirmAttack()
        {
            if (CurrentMode != Mode.Forecast || selected == null || target == null) return;
            var attacker = selected;
            Execute(attacker, target);
            FinishAction(attacker);
        }

        /// <summary>「戻る」（戦闘予測から相手を選ぶところへ）</summary>
        public void CancelForecast()
        {
            if (CurrentMode != Mode.Forecast) return;
            target = null;
            forecast = null;
            CurrentMode = Mode.Acting;
            ChooseAttack();
        }

        private void BackToActing()
        {
            attackCells.Clear();
            view.ShowRange(null);
            CurrentMode = Mode.Acting;
        }

        /// <summary>「待機」</summary>
        public void ChooseWait()
        {
            if (CurrentMode != Mode.Acting && CurrentMode != Mode.Targeting) return;
            FinishAction(selected);
        }

        /// <summary>「移動を取り消す」（まだ行動していなければ、動く前のマスへ戻す）</summary>
        public void UndoMove()
        {
            if ((CurrentMode != Mode.Acting && CurrentMode != Mode.Targeting) || selected == null) return;
            var unit = selected;
            if (unit.cell != moveFrom)
            {
                unit.cell = moveFrom;
                if (unit.plan != null) { unit.plan.x = moveFrom.x; unit.plan.y = moveFrom.y; }
                view.MoveUnit(unit.Id, moveFrom);
            }
            unit.moved = false;
            Select(unit);
        }

        private void FinishAction(UnitState unit)
        {
            if (unit != null)
            {
                unit.acted = true;
                unit.moved = true;
                view.SetUnitHighlighted(unit.Id, false);
                if (unit.Alive) view.SetUnitDimmed(unit.Id, true);
            }
            selected = null;
            target = null;
            forecast = null;
            moveCells.Clear();
            attackCells.Clear();
            view.ShowRange(null);
            view.ClearSelection();
            CurrentMode = Mode.Idle;
            if (CheckEnd()) return;
            if (units.Where(u => u.Alive && u.Side == "ally").All(u => u.acted)) EndTurn();
        }

        private void CancelToIdle()
        {
            if (selected != null)
            {
                view.SetUnitHighlighted(selected.Id, false);
                // 動いたが行動を選ばずにやめたときは、動く前のマスへ戻す
                if (selected.moved && !selected.acted && selected.cell != moveFrom)
                {
                    selected.cell = moveFrom;
                    if (selected.plan != null) { selected.plan.x = moveFrom.x; selected.plan.y = moveFrom.y; }
                    view.MoveUnit(selected.Id, moveFrom);
                }
                if (!selected.acted) selected.moved = false;
            }
            selected = null;
            target = null;
            forecast = null;
            moveCells.Clear();
            attackCells.Clear();
            view.ShowRange(null);
            view.ClearSelection();
            CurrentMode = Mode.Idle;
        }

        // ── 交戦 ──

        private List<PlanUnit> PlanUnits() => units.Where(u => u.Alive && u.plan != null).Select(u => u.plan).ToList();

        /// <summary>1回の交戦を計画どおりに反映する（ブラウザ版 trialExecuteExchange と同じ流れ）</summary>
        private PlanResult Execute(UnitState attacker, UnitState defender)
        {
            var rolls = RollsOverride ?? new RandomRolls();
            var plan = BattlePlan.PlanExchange(attacker.plan, defender.plan, PlanAction.ForEquipped(attacker.plan), PlanUnits(), rolls);
            var byId = new Dictionary<string, UnitState> { { attacker.Id, attacker }, { defender.Id, defender } };
            AddLog($"{attacker.Name} → {defender.Name}");
            foreach (var step in plan.steps)
            {
                if (step.type == "counterCheck")
                {
                    var who = byId[step.actorId];
                    if (!string.IsNullOrEmpty(step.reason)) AddLog($"  反撃なし（{who.Name}：{step.reason}）");
                    else if (step.sealActive) AddLog($"  野望：{who.Name}の反撃を封じた（{step.sealRoll}/{step.sealChance}%）");
                    else AddLog($"  反撃！（{who.Name}・{step.label}）");
                    continue;
                }
                var actor = byId[step.actorId];
                var victim = byId[step.targetId];
                string what = step.role == "attack" ? "攻撃" : step.role == "followUp" ? "追撃" : step.role == "counter" ? "反撃" : "反撃の追撃";
                if (!step.hit)
                {
                    AddLog($"  {what}：{actor.Name}の攻撃は外れた（{step.hitRoll}/{step.hitRate}%）");
                    AddPopup(victim.Id, "MISS", new Color(0.8f, 0.8f, 0.85f));
                    continue;
                }
                AddLog($"  {what}：{victim.Name}に{step.dealt}ダメージ{(step.crit ? " 必殺！" : "")}（残りHP {step.targetHpAfter}）");
                AddPopup(victim.Id, step.crit ? $"{step.dealt}!" : step.dealt.ToString(), step.crit ? new Color(1f, 0.75f, 0.3f) : Color.white);
                if (step.reflectDamage > 0) AddLog($"  カウンター：{actor.Name}に{step.reflectDamage}ダメージ");
                if (step.prayerSaved == true) AddLog($"  祈り：{victim.Name}はHP1で耐えた");
            }
            // 交戦のあとの状態を、盤面のユニットへ写す（位置はそのまま）
            CopyBack(attacker, plan.attacker);
            CopyBack(defender, plan.defender);
            foreach (var unit in new[] { attacker, defender })
            {
                if (unit.Alive) continue;
                AddLog($"{unit.Name}は倒れた");
                view.RemoveUnit(unit.Id);
            }
            return plan;
        }

        private static void CopyBack(UnitState unit, PlanUnit after)
        {
            unit.plan.hp = after.hp;
            unit.plan.mp = after.mp;
            unit.plan.statusEffects = after.statusEffects;
            unit.plan.prayerUsed = after.prayerUsed;
        }

        private bool CheckEnd()
        {
            if (!units.Any(u => u.Alive && u.Side == "enemy")) { CurrentPhase = Phase.Victory; AddLog("勝利！ すべての敵を倒した"); return true; }
            if (!units.Any(u => u.Alive && u.Side == "ally")) { CurrentPhase = Phase.Defeat; AddLog("敗北…"); return true; }
            return false;
        }

        // ── 敵の番 ──

        /// <summary>「ターン終了」: 敵の番へ</summary>
        public void EndTurn()
        {
            if (CurrentPhase != Phase.Ally) return;
            CancelToIdle();
            CurrentPhase = Phase.Enemy;
            AddLog($"敵フェーズ ターン{Turn}");
            if (Application.isPlaying) StartCoroutine(EnemyPhase());
            else RunEnemyPhaseImmediately();
        }

        private IEnumerator EnemyPhase()
        {
            foreach (var enemy in units.Where(u => u.Side == "enemy").ToList())
            {
                if (!enemy.Alive || CurrentPhase != Phase.Enemy) continue;
                yield return new WaitForSeconds(enemyStepSeconds);
                EnemyAct(enemy);
                if (CheckEnd()) yield break;
            }
            yield return new WaitForSeconds(enemyStepSeconds * 0.5f);
            StartAllyTurn();
        }

        /// <summary>確認用（エディタ上）: 待たずに敵の番を進める</summary>
        public void RunEnemyPhaseImmediately()
        {
            foreach (var enemy in units.Where(u => u.Side == "enemy").ToList())
            {
                if (!enemy.Alive || CurrentPhase != Phase.Enemy) continue;
                EnemyAct(enemy);
                if (CheckEnd()) return;
            }
            StartAllyTurn();
        }

        /// <summary>
        /// 敵1人の行動: 動ける先（今のマスも含む）×届く相手のすべてを戦闘予測で評価し、いちばん良いものを選ぶ
        /// （ブラウザ版の敵の行動選びと同じ評価 BattlePlan.ScoreAttack）。攻撃できなければ、いちばん近い味方へ近づく
        /// </summary>
        private void EnemyAct(UnitState enemy)
        {
            view.FocusOn(enemy.cell);
            var cells = new List<Vector2Int> { enemy.cell };
            cells.AddRange(MoveCellsOf(enemy));
            double bestScore = double.NegativeInfinity;
            Vector2Int bestCell = enemy.cell;
            UnitState bestTarget = null;
            var original = enemy.cell;
            foreach (var cell in cells)
            {
                var attacker = enemy.plan.Clone();
                attacker.x = cell.x; attacker.y = cell.y;
                foreach (var ally in TargetsFrom(enemy, cell))
                {
                    var env = PlanUnits().Select(u => u.id == enemy.Id ? attacker : u).ToList();
                    var f = BattlePlan.ForecastOf(attacker, ally.plan, PlanAction.ForEquipped(attacker), env);
                    double score = BattlePlan.ScoreAttack(f, ally.plan.hp, attacker.hp) - Distance(cell, original) * 0.01;   // 同点なら動かない方
                    if (score > bestScore) { bestScore = score; bestCell = cell; bestTarget = ally; }
                }
            }
            if (bestTarget == null)
            {
                // 攻撃できない: いちばん近い味方にいちばん近づけるマスへ
                var allies = units.Where(u => u.Alive && u.Side == "ally").ToList();
                if (allies.Count == 0) return;
                bestCell = cells.OrderBy(c => allies.Min(a => Distance(a.cell, c))).ThenBy(c => Distance(c, original)).First();
            }
            if (bestCell != enemy.cell)
            {
                enemy.cell = bestCell;
                enemy.plan.x = bestCell.x; enemy.plan.y = bestCell.y;
                view.MoveUnit(enemy.Id, bestCell);
            }
            if (bestTarget != null) Execute(enemy, bestTarget);
            else AddLog($"{enemy.Name}は近づいてきた");
        }

        private void StartAllyTurn()
        {
            if (CurrentPhase != Phase.Enemy) return;
            Turn++;
            CurrentPhase = Phase.Ally;
            foreach (var unit in units)
            {
                unit.moved = false;
                unit.acted = false;
                if (unit.Alive) view.SetUnitDimmed(unit.Id, false);
            }
            AddLog($"味方フェーズ ターン{Turn}");
        }

        // ── 表示（仮の操作の欄。IMGUI） ──

        private void AddLog(string line)
        {
            log.Add(line);
            if (log.Count > 60) log.RemoveAt(0);
        }

        private void AddPopup(string unitId, string text, Color color) =>
            popups.Add(new Popup { unitId = unitId, text = text, color = color, time = Time.realtimeSinceStartup });

        private float GuiScale => Mathf.Max(1f, Screen.height / 390f);
        private float GuiWidth => Screen.width / GuiScale;
        private Rect CommandRect => new Rect(10f, 390f - 150f, 170f, 140f);
        private Rect ForecastRect => new Rect(GuiWidth * 0.5f - 170f, 390f - 170f, 340f, 160f);
        private Rect EndTurnRect => new Rect(190f, 390f - 48f, 110f, 38f);

        private bool IsOverPanel(Vector2 screenPosition)
        {
            var p = new Vector2(screenPosition.x, Screen.height - screenPosition.y) / GuiScale;
            if (CommandRect.Contains(p) && selected != null) return true;
            if (ForecastRect.Contains(p) && CurrentMode == Mode.Forecast) return true;
            return EndTurnRect.Contains(p) && CurrentPhase == Phase.Ally;
        }

        private Font guiFont;
        private GUIStyle boxStyle, labelStyle, bigStyle, popupStyle;

        private void OnGUI()
        {
            if (data == null) return;
            if (guiFont == null)
            {
                guiFont = Font.CreateDynamicFontFromOSFont(new[] { "Yu Gothic UI", "Meiryo", "MS Gothic", "Hiragino Sans", "Noto Sans CJK JP" }, 14);
                boxStyle = new GUIStyle(GUI.skin.box) { font = guiFont, alignment = TextAnchor.UpperLeft, fontSize = 12, wordWrap = true };
                labelStyle = new GUIStyle(GUI.skin.label) { font = guiFont, fontSize = 12, wordWrap = true };
                bigStyle = new GUIStyle(GUI.skin.label) { font = guiFont, fontSize = 30, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
                popupStyle = new GUIStyle(GUI.skin.label) { font = guiFont, fontSize = 18, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
            }
            GUI.skin.font = guiFont;
            float s = GuiScale;
            GUI.matrix = Matrix4x4.Scale(new Vector3(s, s, 1f));

            // 左上: フェーズとターン、ログの最後の数行
            string phaseText = CurrentPhase == Phase.Ally ? "味方フェーズ" : CurrentPhase == Phase.Enemy ? "敵フェーズ" : CurrentPhase == Phase.Victory ? "勝利" : "敗北";
            GUI.Label(new Rect(10f, 6f, 400f, 22f), $"{phaseText}　ターン{Turn}", labelStyle);
            var recent = log.Skip(Math.Max(0, log.Count - 5)).ToList();
            GUI.Label(new Rect(10f, 26f, 380f, 90f), string.Join("\n", recent), labelStyle);

            // 左下: 選んだ味方と操作
            if (selected != null && selected.plan != null)
            {
                var r = CommandRect;
                GUI.Box(r, $"{selected.Name}\nHP {selected.plan.hp}/{selected.plan.maxHp}　MP {selected.plan.mp}", boxStyle);
                float y = r.y + 44f;
                if (CurrentMode == Mode.Moving) GUI.Label(new Rect(r.x + 8f, y, r.width - 16f, 40f), "青いマスを押して動く（自分のマスならその場）", labelStyle);
                if (CurrentMode == Mode.Acting || CurrentMode == Mode.Targeting)
                {
                    GUI.enabled = TargetsFrom(selected, selected.cell).Any();
                    if (GUI.Button(new Rect(r.x + 8f, y, 74f, 28f), "攻撃")) ChooseAttack();
                    GUI.enabled = true;
                    if (GUI.Button(new Rect(r.x + 88f, y, 74f, 28f), "待機")) ChooseWait();
                    if (GUI.Button(new Rect(r.x + 8f, y + 34f, 154f, 26f), "移動を取り消す")) UndoMove();
                    if (CurrentMode == Mode.Targeting) GUI.Label(new Rect(r.x + 8f, y + 64f, 154f, 30f), "赤いマスの敵を押す", labelStyle);
                }
            }

            // 真ん中の下: 戦闘予測
            if (CurrentMode == Mode.Forecast && forecast != null && selected != null && target != null)
            {
                var r = ForecastRect;
                GUI.Box(r, "", boxStyle);
                string Line(PlanStep strike, PlanStep follow) => strike == null ? "―"
                    : $"{strike.damage}{(follow != null ? "×2" : "")}　命中{strike.hitRate}%　必殺{strike.critRate}%";
                var check = forecast.counterCheck;
                string counterNote = check == null ? "反撃なし"
                    : !string.IsNullOrEmpty(check.reason) ? $"反撃なし（{check.reason}）"
                    : check.sealChance.HasValue ? $"反撃あり（野望で{check.sealChance}%封じる）" : "反撃あり";
                GUI.Label(new Rect(r.x + 10f, r.y + 6f, r.width - 20f, 112f),
                    "戦闘予測\n" +
                    $"{selected.Name}　HP {selected.plan.hp} → {forecast.attackerHpAfter}\n　{Line(forecast.first, forecast.followUp)}\n" +
                    $"{target.Name}　HP {target.plan.hp} → {forecast.defenderHpAfter}\n　{Line(forecast.counter, forecast.counterFollowUp)}\n" +
                    counterNote, labelStyle);
                if (GUI.Button(new Rect(r.x + 10f, r.y + r.height - 36f, 150f, 28f), "実行")) ConfirmAttack();
                if (GUI.Button(new Rect(r.x + r.width - 160f, r.y + r.height - 36f, 150f, 28f), "戻る")) CancelForecast();
            }

            if (CurrentPhase == Phase.Ally && GUI.Button(EndTurnRect, "ターン終了")) EndTurn();
            if (CurrentPhase == Phase.Victory || CurrentPhase == Phase.Defeat)
                GUI.Label(new Rect(0f, 150f, GuiWidth, 60f), CurrentPhase == Phase.Victory ? "勝利" : "敗北", bigStyle);

            // ダメージの数字（頭の上に1.2秒）
            float now = Time.realtimeSinceStartup;
            popups.RemoveAll(p => now - p.time > 1.2f);
            foreach (var popup in popups)
            {
                var screen = view.UnitHeadToScreen(popup.unitId);
                if (screen.z <= 0f) continue;
                float rise = (now - popup.time) * 30f;
                var guiPos = new Vector2(screen.x, Screen.height - screen.y) / s;
                popupStyle.normal.textColor = popup.color;
                GUI.Label(new Rect(guiPos.x - 40f, guiPos.y - 24f - rise, 80f, 24f), popup.text, popupStyle);
            }
        }

        /// <summary>敵に狙われている印（キャラのまわりの赤い丸）を出す・消す。敵の行動予告から呼ぶ</summary>
        public void SetTargeted(string unitId, bool targeted) => view.SetTargeted(unitId, targeted);
    }
}
