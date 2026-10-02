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
        public enum Mode { Idle, Moving, Acting, Targeting, Forecast, Support, Summon, Trade }

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

        [SerializeField] private Battle3DHud hud;   // 画面のUI（あれば仮の操作の欄 IMGUI は出さない）
        [SerializeField] private TextAsset uiJson;  // 攻撃の選択肢（通常攻撃・戦技・魔法。tools/export_unity_battle_ui.mjs）
        // 盤面の配置（原作者 2026-09-27）: "watchroad"＝国境監視路（地形・高い物・最初の位置・地面の1枚絵）。空なら戦闘データから作る平らな盤面
        [SerializeField] private string layout = "watchroad";
        [SerializeField] private bool setupOnStart = true;   // ▶で自分で組み立てる（探索から始める戦闘は StartOnPlace で組み立てる）

        // 場所の中で戦う（プロローグの訓練: 探索と同じ盤面・同じ絵。原作者 2026-09-28）。null なら戦闘だけの盤面
        private MapLayoutFile place;
        private MapArea area;
        private Texture2D placeGround;
        /// <summary>戦う範囲の左上のマス（場所の中で戦うとき。戦闘データの位置はここからの位置）</summary>
        public Vector2Int Origin => area != null ? new Vector2Int(area.x, area.y) : Vector2Int.zero;

        /// <summary>そのマスが戦う範囲の中か（場所の中で戦うときは範囲の外に入れない。原作者 2026-09-28）</summary>
        public bool InBoard(Vector2Int cell) =>
            area != null ? area.Contains(cell) : cell.x >= 0 && cell.y >= 0 && cell.x < data.cols && cell.y < data.rows;

        /// <summary>戦う範囲のマス</summary>
        private IEnumerable<Vector2Int> BoardCells()
        {
            var o = Origin;
            for (int y = 0; y < data.rows; y++)
            for (int x = 0; x < data.cols; x++)
                yield return o + new Vector2Int(x, y);
        }

        /// <summary>
        /// 場所（配置表）の戦う範囲で戦闘を始める。盤面は探索と同じ（地形・高い物・床の絵）、キャラは戦闘データの位置に置く。
        /// 例: 訓練場の "prologue"（x8〜14・y6〜13）
        /// </summary>
        public void StartOnPlace(MapLayoutFile layoutFile, string areaId, Texture2D ground)
        {
            place = layoutFile;
            area = layoutFile?.battleAreas?.FirstOrDefault(a => a.id == areaId);
            if (place != null && area == null) throw new InvalidOperationException($"戦う範囲がない: {layoutFile.mapId} / {areaId}");
            placeGround = ground;
            Setup();
            view.SetView(false, 0, true);   // 戦闘は真上からが最初（原作者 2026-10-03: 斜めはスマホで押し間違いが多い）。ボタンで斜めにもできる
            view.SetOverview(false, true);
            // 戦う範囲のまん中より2マス奥に寄る（寄る点は画面の少し上に来るので、奥の敵が上の帯・手引きの帯に隠れないように。
            // 味方だけに寄ると、奥の敵が画面の端に切れた）
            var topLeft = map.TopCenter(Origin);
            var bottomRight = map.TopCenter(Origin + new Vector2Int(data.cols - 1, data.rows - 1));
            var oneRowNorth = map.TopCenter(Origin) - map.TopCenter(Origin + Vector2Int.up);
            view.FocusOnPoint((topLeft + bottomRight) * 0.5f + oneRowNorth * 2f, true);
        }

        /// <summary>戦闘が終わった（勝利・敗北）。1回だけ</summary>
        public event Action<Phase> Finished;
        private bool finishedRaised;

        /// <summary>
        /// 行動が済んだ（手引きの進み具合に使う）: "attack"（通常攻撃）/ "art"（戦技）/ "magic"（魔法）/ "item" / "trade" / "move" / "wait" / "allyTurn"（味方の番の始まり）
        /// </summary>
        public event Action<string, UnitState> ActionDone;
        /// <summary>控えの敵（reserve）が盤面に出てきた（ほかの敵を全部倒したとき。訓練の2段目）</summary>
        public event Action Reinforced;
        /// <summary>
        /// 控えの敵を呼ぶところ（ほかの敵を全部倒した）。受け取る側（訓練の手引き）は台詞を流してから BringReservesNow を呼ぶ。
        /// 受け取る側がいなければ、すぐに出てくる
        /// </summary>
        public event Action ReserveCalled;
        private bool reservePending;
        /// <summary>控えの敵が呼ばれて、まだ入ってきていない（この間はターンを終えない）</summary>
        public bool ReservePending => reservePending;
        private readonly Dictionary<string, Vector2Int> reserveEntry = new Dictionary<string, Vector2Int>();
        private readonly List<UnitState> reserves = new List<UnitState>();
        /// <summary>まだ出ていない控えの敵がいるか</summary>
        public bool HasReserves => reserves.Count > 0;

        /// <summary>盤面を押しても動かさない間（戦闘中の会話など）。敵の番も、この間は待つ</summary>
        public Func<bool> InputBlocked { get; set; }

        /// <summary>手引きの帯（空なら出さない。BattleTutorial が決める）</summary>
        public string Guide { get; set; } = "";

        /// <summary>選んだキャラが動けるマス（確認用）</summary>
        public IReadOnlyCollection<Vector2Int> MoveCells => moveCells;
        /// <summary>補助・召喚で押せるマス（確認用）</summary>
        public IReadOnlyCollection<Vector2Int> TargetCells => supportCells;

        /// <summary>確認用: キャラを別のマスへ置く（行動にならない）</summary>
        public void TeleportForTest(string unitId, Vector2Int cell)
        {
            var unit = units.FirstOrDefault(u => u.Id == unitId);
            if (unit == null) return;
            unit.cell = cell;
            if (unit.plan != null) { unit.plan.x = cell.x; unit.plan.y = cell.y; }
            view.MoveUnit(unitId, cell);
        }

        private readonly Dictionary<string, UiUnit> uiUnits = new Dictionary<string, UiUnit>();
        private readonly HashSet<Vector2Int> supportCells = new HashSet<Vector2Int>();

        // 拾える消耗品（ブラウザ版の currentMapItems）と、この移動で拾った物（移動の取り消しで戻す）
        private readonly Dictionary<Vector2Int, ItemData> mapItems = new Dictionary<Vector2Int, ItemData>();
        private (Vector2Int cell, ItemData item)? pickedThisMove;
        public IReadOnlyDictionary<Vector2Int, ItemData> MapItems => mapItems;

        /// <summary>消耗品を使う（ブラウザ版と同じ: 回復の物は value だけHPを回復。使うと行動済み）</summary>
        public void UseItem(int index)
        {
            StayIfMoving();
            if (CurrentMode != Mode.Acting || selected == null || index < 0 || index >= selected.items.Count) return;
            var unit = selected;
            var used = unit.items[index];
            if (used.type != "heal") return;   // 使えない物（ツノなど。渡すだけの物）
            unit.items.RemoveAt(index);
            if (used.type == "heal" && unit.plan != null)
            {
                int before = unit.plan.hp;
                unit.plan.hp = Math.Min(unit.plan.maxHp, before + used.value);
                AddPopup(unit.Id, $"+{unit.plan.hp - before}", new Color(0.45f, 1f, 0.6f));
                AddLog($"{unit.Name}は {used.name} を使用 → HP +{unit.plan.hp - before}");
            }
            ActionDone?.Invoke("item", unit);
            FinishAction(unit);
        }

        /// <summary>敵が攻撃する前に見せる戦闘予測（ブラウザ版 trialShowEnemyForecast。1.2秒）</summary>
        public class EnemyPreviewInfo
        {
            public UnitState attacker, target;
            public BattleOption option;
            public BattlePlan.Forecast forecast;
        }
        public EnemyPreviewInfo EnemyPreview { get; private set; }
        [SerializeField] private float enemyPreviewSeconds = 1.2f;

        private readonly HashSet<string> usedSpecials = new HashSet<string>();   // 「キャラ:専用戦技」（1戦闘に1回）

        // ── 召喚（ブラウザ版 trialStartSummon・trialResolveSummons と同じ。原作者 2026-09-27）──
        //   戦技に入っている召喚だけ・1戦闘に1回。隣の空いているマスに陣を置き、使ったターン＋2 の味方の番の始まりに出る。
        //   呼んだキャラが倒れたら、出る前の召喚も出ている召喚獣も消える。召喚獣は負けの判定に数えない
        public class PendingSummon
        {
            public string unitId, casterId, artName;
            public Vector2Int cell;
            public int dueTurn;
        }

        private readonly List<PendingSummon> pendingSummons = new List<PendingSummon>();
        private readonly HashSet<string> usedSummons = new HashSet<string>();
        private UiListEntry summonEntry;
        private PlanUnit[] planSnapshots = Array.Empty<PlanUnit>();
        public IReadOnlyList<PendingSummon> PendingSummons => pendingSummons;

        public bool SummonUsed(UnitState unit, UiListEntry entry) => usedSummons.Contains(unit.Id + ":" + entry.label);

        /// <summary>その召喚が使えるか（まだ使っていない・MPがある・隣に空いているマスがある）</summary>
        public bool CanSummon(UnitState unit, UiListEntry entry) =>
            unit != null && entry != null && !string.IsNullOrEmpty(entry.summonUnitId) && !SummonUsed(unit, entry)
            && unit.plan != null && unit.plan.mp > 0 && SummonCells(unit.cell).Any();

        private IEnumerable<Vector2Int> SummonCells(Vector2Int from)
        {
            foreach (var d in new[] { Vector2Int.right, Vector2Int.left, Vector2Int.up, Vector2Int.down })
            {
                var cell = from + d;
                if (!map.InBounds(cell) || !map.CanStop(cell, false)) continue;
                if (units.Any(u => u.Alive && u.cell == cell) || view.HasSummonCircle(cell)) continue;
                yield return cell;
            }
        }

        /// <summary>召喚を選び、陣を置くマス（隣の空いているマス）を出す</summary>
        public void ChooseSummon(UiListEntry entry)
        {
            StayIfMoving();
            if (CurrentMode != Mode.Acting || !CanSummon(selected, entry)) return;
            summonEntry = entry;
            supportCells.Clear();
            foreach (var cell in SummonCells(selected.cell)) supportCells.Add(cell);
            view.ShowRange(supportCells, Board3DView.SupportRangeColor);
            CurrentMode = Mode.Summon;
        }

        private void PlaceSummon(Vector2Int cell)
        {
            var caster = selected;
            var rolls = RollsOverride ?? new RandomRolls();
            int cost = PayMagicMp(caster, new PlanSpell { mpCost = summonEntry.mpCost }, rolls);
            usedSummons.Add(caster.Id + ":" + summonEntry.label);
            int due = Turn + summonEntry.summonDelay;
            pendingSummons.Add(new PendingSummon { unitId = summonEntry.summonUnitId, casterId = caster.Id, artName = summonEntry.label, cell = cell, dueTurn = due });
            view.AddSummonCircle(cell);
            AddLog($"{caster.Name}が {summonEntry.label} 使用  MP-{cost} → {cell}に召喚の陣（ターン{due}に出る）");
            summonEntry = null;
            supportCells.Clear();
            view.ShowRange(null);
            FinishAction(caster);
        }

        /// <summary>味方の番の始まり: 時が来た召喚を出す（陣がふさがっていたら、いちばん近い空いているマス）</summary>
        private void ResolveSummons()
        {
            foreach (var p in pendingSummons.Where(p => p.dueTurn <= Turn).ToList())
            {
                pendingSummons.Remove(p);
                view.RemoveSummonCircle(p.cell);
                var caster = units.FirstOrDefault(u => u.Id == p.casterId && u.Alive);
                if (caster == null) continue;
                var spot = BoardCells()
                    .Where(c => map.CanStop(c, false) && !units.Any(u => u.Alive && u.cell == c))
                    .OrderBy(c => Distance(c, p.cell)).ThenBy(c => c.y).ThenBy(c => c.x)
                    .Cast<Vector2Int?>().FirstOrDefault();
                if (spot == null) continue;
                var ui = uiUnits.TryGetValue(p.unitId, out var found) ? found : null;
                var snapshot = planSnapshots.FirstOrDefault(u => u.id == p.unitId);
                var source = new UnitData { id = p.unitId, name = ui?.name ?? p.unitId, side = caster.Side, x = spot.Value.x, y = spot.Value.y, move = ui?.move ?? 4, attackRange = 1 };
                var state = new UnitState { source = source, cell = spot.Value, summoned = true, summonerId = caster.Id, plan = snapshot?.Clone() };
                if (state.plan != null) { state.plan.x = spot.Value.x; state.plan.y = spot.Value.y; state.plan.side = caster.Side; }
                units.Add(state);
                view.AddUnitToBoard(new Board3DMap.Unit { cell = spot.Value, id = source.id, enemy = caster.Side == "enemy" });
                AddLog($"召喚の陣から {source.name} が現れた！");
            }
        }

        /// <summary>呼んだキャラが倒れたら、出る前の召喚と、出ている召喚獣を消す</summary>
        private void CleanupSummons()
        {
            foreach (var p in pendingSummons.Where(p => !units.Any(u => u.Id == p.casterId && u.Alive)).ToList())
            {
                pendingSummons.Remove(p);
                view.RemoveSummonCircle(p.cell);
            }
            foreach (var unit in units.Where(u => u.summoned && u.Alive && !units.Any(c => c.Id == u.summonerId && c.Alive)).ToList())
            {
                unit.plan.hp = 0;
                view.RemoveUnit(unit.Id);
                AddLog($"{unit.Name}は呼んだ者が倒れ、消えた");
            }
        }

        public IReadOnlyList<SpecialArt> SpecialsOf(UnitState unit) => (IReadOnlyList<SpecialArt>)UiOf(unit)?.specials ?? Array.Empty<SpecialArt>();
        public bool SpecialUsed(UnitState unit, SpecialArt art) => usedSpecials.Contains(unit.Id + ":" + art.name);

        /// <summary>
        /// 専用戦技（ブラウザ版 trialCastSpecialArt）: radius マス以内の敵すべてのHPを percent% 削る（命中判定なし・最低1）。
        /// 生命吸収は削った合計だけ自分のHP・MPを回復。1戦闘に1回。使うと行動済み
        /// </summary>
        public void UseSpecial(SpecialArt art)
        {
            StayIfMoving();
            if (CurrentMode != Mode.Acting || selected == null || art == null || SpecialUsed(selected, art)) return;
            var unit = selected;
            var foes = units.Where(u => u.Alive && u.Side != unit.Side && Distance(u.cell, unit.cell) <= art.radius).ToList();
            int maxMp = UiOf(unit)?.maxMp ?? unit.plan.mp;
            var plan = BattlePlan.PlanDrain(unit.plan, foes.Select(f => f.plan).ToList(), art.percent, art.drain, maxMp);
            usedSpecials.Add(unit.Id + ":" + art.name);
            AddLog($"{unit.Name}の{art.name}！（{art.radius}マス以内の敵のHPを{art.percent}%削る）");
            if (plan.hits.Count == 0) AddLog("  範囲内に敵がいない");
            foreach (var (targetId, damage, hpAfter) in plan.hits)
            {
                var foe = foes.First(f => f.Id == targetId);
                foe.plan.hp = hpAfter;
                AddPopup(foe.Id, damage.ToString(), Color.white);
                AddLog($"  {foe.Name}に{damage}ダメージ → HP {foe.plan.hp}/{foe.plan.maxHp}");
                if (!foe.Alive) { AddLog($"  {foe.Name}は倒れた！"); view.RemoveUnit(foe.Id); }
            }
            if (art.drain && plan.healed > 0)
            {
                unit.plan.hp = plan.attackerHpAfter;
                unit.plan.mp = plan.attackerMpAfter;
                AddPopup(unit.Id, $"+{plan.healed}", new Color(0.45f, 1f, 0.6f));
                AddLog($"  {unit.Name}のHP・MPを{plan.healed}回復");
            }
            FinishAction(unit);
        }

        /// <summary>そのキャラの補助の魔法（回復・結界・加速・治癒の杖）</summary>
        public IReadOnlyList<BattleOption> SupportsOf(UnitState unit) => (IReadOnlyList<BattleOption>)UiOf(unit)?.supports ?? Array.Empty<BattleOption>();

        /// <summary>今のマスから、その補助が届く味方（自分も含む）がいるか</summary>
        public bool CanSupportFromHere(BattleOption option) =>
            selected != null && option != null && SupportTargets(option).Any();

        /// <summary>補助の対象: 敵が対象の魔法（虚像・封印）は射程の敵、ほかは射程の味方（自分も含む）</summary>
        private IEnumerable<UnitState> SupportTargets(BattleOption option)
        {
            bool enemyTarget = option.spell?.targetType == "enemy";
            return units.Where(u => u.Alive && (enemyTarget ? u.Side != selected.Side : u.Side == selected.Side)
                && Distance(u.cell, selected.cell) >= (enemyTarget ? 1 : 0) && Distance(u.cell, selected.cell) <= option.rangeMax);
        }

        /// <summary>転移の2段目で選んでいる味方（1段目のあいだは null）</summary>
        public UnitState TransferAlly { get; private set; }

        /// <summary>補助の魔法を選び、届く味方（緑）から対象を選ぶ</summary>
        public void ChooseSupport(BattleOption option)
        {
            StayIfMoving();
            if (CurrentMode != Mode.Acting || selected == null || option == null) return;
            currentOption = option;
            TransferAlly = null;
            supportCells.Clear();
            foreach (var unit in SupportTargets(option)) supportCells.Add(unit.cell);
            view.ShowRange(supportCells, option.spell?.targetType == "enemy" ? Board3DView.AttackRangeColor : Board3DView.SupportRangeColor);
            CurrentMode = Mode.Support;
        }

        /// <summary>魔法のMPを払う（詠唱破棄の判定つき。ブラウザ版 trialPayMagicMp）</summary>
        private int PayMagicMp(UnitState caster, PlanSpell spell, IPlanRolls rolls)
        {
            int cost = rolls.Dice(string.IsNullOrEmpty(spell?.mpCost) ? "1d6" : spell.mpCost);
            if (caster.plan.Has("詠唱破棄"))
            {
                int chance = TrialRules.AbilityChance("詠唱破棄", caster.plan.stats, caster.plan.maxHp, caster.plan.luck);
                int roll = rolls.Percent("詠唱破棄");
                if (roll <= chance) { AddLog($"  詠唱破棄！MP消費なし（{roll}/{chance}%）"); cost = 0; }
            }
            caster.plan.mp = Math.Max(0, caster.plan.mp - cost);
            string staff = caster.plan.equippedItem;
            if (!string.IsNullOrEmpty(staff) && BattlePlan.Items.TryGetValue(staff, out var staffItem) && staffItem.kind == "grimoire")
            {
                int before = StaffDurability(caster, staff);
                if (before > 0)
                {
                    int after = before - Math.Min(before, cost);
                    caster.durability[staff] = after;
                    caster.plan.staffDurability = after;
                    AddLog($"  {staffItem.name}の耐久 -{before - after}（残り {after}）");
                    if (after == 0) AddLog($"  {staffItem.name}が壊れた（威力・命中の補正と付属の魔法を失う）");
                }
            }
            return cost;
        }

        /// <summary>
        /// 補助の魔法の効果（ブラウザ版 trialCastSupportArt・trialCastHeal と同じ）:
        /// 回復＝回復量×3、治癒の杖＝回復量（6＋魔攻÷4）、結界＝魔防÷2の装甲（次の自分の番まで）、加速＝もう一度行動できる
        /// </summary>
        private void CastSupport(UnitState caster, UnitState target, BattleOption option)
        {
            var rolls = RollsOverride ?? new RandomRolls();
            if (!string.IsNullOrEmpty(option.itemId)) Equip(caster, caster.plan, option);   // 治癒の杖に持ち替え
            string art = option.artName;
            supportCells.Clear();
            view.ShowRange(null);
            if (option.spell?.targetType == "enemy")
            {
                // 虚像・封印: 命中の判定（ブラウザ版 getMagicHitResult）→ MP → 効果
                int rate = BattlePlan.SupportHitRate(caster.plan, target.plan, option.spell, PlanUnits());
                int roll = rolls.Percent("補助の命中");
                bool hit = roll <= rate;
                int paid = PayMagicMp(caster, option.spell, rolls);
                AddLog($"{caster.Name}が {art} 使用（{roll}/{rate}%）  MP-{paid} → {(hit ? "命中" : "失敗")}");
                if (!hit)
                {
                    AddPopup(target.Id, "MISS", new Color(0.8f, 0.8f, 0.85f));
                    FinishAction(caster);
                    return;
                }
                string type = art == "虚像" ? "hitDown" : "immobilize";
                target.plan.statusEffects.RemoveAll(e => e.type == type);
                target.plan.statusEffects.Add(new PlanStatus { type = type, value = art == "虚像" ? 20 : 0, holdOwnPhase = true, name = art });
                AddLog(art == "虚像" ? $"  {target.Name}の命中-20（相手の次の番まで）" : $"  {target.Name}の移動を封じた（相手の次の番まで）");
                AddPopup(target.Id, art, new Color(0.85f, 0.6f, 1f));
                FinishAction(caster);
                return;
            }
            int cost = PayMagicMp(caster, option.spell, rolls);
            if (art == "回復" || (string.IsNullOrEmpty(art) && option.spell?.effectType == "heal"))
            {
                int amount = (6 + caster.plan.stats.mag / 4) * (art == "回復" ? 3 : 1);
                int before = target.plan.hp;
                target.plan.hp = Math.Min(target.plan.maxHp, before + amount);
                AddLog($"{caster.Name}が {option.ActionName} 使用  MP-{cost} → {target.Name}のHPを{target.plan.hp - before}回復（HP {target.plan.hp}/{target.plan.maxHp}）");
                AddPopup(target.Id, $"+{target.plan.hp - before}", new Color(0.45f, 1f, 0.6f));
            }
            else if (art == "結界")
            {
                int value = caster.plan.stats.res / 2;
                target.plan.statusEffects.RemoveAll(e => e.type == "barrier");
                target.plan.statusEffects.Add(new PlanStatus { type = "barrier", value = value, duration = 1, name = "結界" });
                AddLog($"{caster.Name}が 結界 使用  MP-{cost} → {target.Name}に装甲+{value}（魔防÷2。次の自分の番まで）");
                AddPopup(target.Id, "結界", new Color(0.6f, 0.8f, 1f));
            }
            else if (art == "加速")
            {
                target.moved = false;
                target.acted = false;
                view.SetUnitDimmed(target.Id, false);
                AddLog($"{caster.Name}が 加速 使用  MP-{cost} → {target.Name}が再行動できる");
                AddPopup(target.Id, "加速", new Color(1f, 0.9f, 0.5f));
                if (target == caster)
                {
                    // 自分に使ったときは、そのまま続けて行動できる（ブラウザ版と同じ）
                    Select(caster);
                    return;
                }
            }
            FinishAction(caster);
        }

        /// <summary>転移の1段目: 移す味方を選び、範囲の空いているマスを出す（ブラウザ版 trialPickTransferAlly）</summary>
        private void PickTransferAlly(UnitState ally)
        {
            TransferAlly = ally;
            supportCells.Clear();
            foreach (var cell in BoardCells())
            {
                if (Distance(cell, selected.cell) > currentOption.rangeMax) continue;
                if (!map.CanStop(cell, false)) continue;
                if (units.Any(u => u.Alive && u.cell == cell)) continue;
                supportCells.Add(cell);
            }
            view.ShowRange(supportCells, Board3DView.TransferRangeColor);
            view.Select(ally.cell);
        }

        /// <summary>転移の2段目: 選んだ味方を、選んだマスへ移す（ブラウザ版 trialExecuteTransfer）</summary>
        private void CastTransfer(UnitState caster, UnitState ally, Vector2Int cell)
        {
            var rolls = RollsOverride ?? new RandomRolls();
            int cost = PayMagicMp(caster, currentOption.spell, rolls);
            var from = ally.cell;
            ally.cell = cell;
            if (ally.plan != null) { ally.plan.x = cell.x; ally.plan.y = cell.y; }
            view.MoveUnit(ally.Id, cell);
            AddLog($"{caster.Name}が 転移 使用  MP-{cost} → {ally.Name}を{from}から{cell}へ移した");
            TransferAlly = null;
            supportCells.Clear();
            view.ShowRange(null);
            FinishAction(caster);
        }

        /// <summary>範囲の攻撃で巻き込む相手（ブラウザ版: 円舞＝隣接する敵すべて、万雷＝相手の方向の直線3マスの敵すべて）</summary>
        private List<UnitState> AreaTargets(UnitState attacker, UnitState target, BattleOption option)
        {
            var foes = units.Where(u => u.Alive && u.Side != attacker.Side).ToList();
            if (option.area == "adjacent")
            {
                var list = foes.Where(u => Distance(u.cell, attacker.cell) == 1).ToList();
                if (!list.Contains(target)) list.Insert(0, target);
                return list;
            }
            int dx = Math.Sign(target.cell.x - attacker.cell.x), dy = Math.Sign(target.cell.y - attacker.cell.y);
            if ((dx == 0) == (dy == 0)) return new List<UnitState> { target };   // 直線上にない相手なら、その相手だけ
            var line = new List<UnitState>();
            for (int k = 1; k <= 3; k++)
            {
                var foe = foes.FirstOrDefault(u => u.cell == attacker.cell + new Vector2Int(dx * k, dy * k));
                if (foe != null) line.Add(foe);
            }
            if (!line.Contains(target)) line.Insert(0, target);
            return line;
        }

        /// <summary>範囲の攻撃を計画どおりに反映する（ブラウザ版 trialExecuteArea）</summary>
        private void ExecuteArea(UnitState attacker, UnitState target, BattleOption option)
        {
            var rolls = RollsOverride ?? new RandomRolls();
            Equip(attacker, attacker.plan, option);
            var targets = AreaTargets(attacker, target, option);
            var plan = BattlePlan.PlanArea(attacker.plan, targets.Select(t => t.plan).ToList(), option.ToAction(), PlanUnits(), rolls);
            AddLog($"{attacker.Name}の{option.ActionName}！（{string.Join("・", targets.Select(t => t.Name))}）");
            foreach (var step in plan.steps)
            {
                if (step.durabilityCost > 0) LogDurability(attacker, step);
                var victim = targets.First(t => t.Id == step.targetId);
                if (!step.hit)
                {
                    AddLog($"  {victim.Name}：外れた（{step.hitRoll}/{step.hitRate}%）");
                    AddPopup(victim.Id, "MISS", new Color(0.8f, 0.8f, 0.85f));
                    continue;
                }
                AddLog($"  {victim.Name}に{step.dealt}ダメージ{(step.crit ? " 必殺！" : "")}（残りHP {step.targetHpAfter}）");
                AddPopup(victim.Id, step.crit ? $"{step.dealt}!" : step.dealt.ToString(), step.crit ? new Color(1f, 0.75f, 0.3f) : Color.white);
            }
            CopyBack(attacker, plan.attacker);
            for (int i = 0; i < targets.Count; i++) CopyBack(targets[i], plan.targets[i]);
            foreach (var unit in targets.Append(attacker))
            {
                if (unit.Alive) continue;
                AddLog($"{unit.Name}は倒れた");
                view.RemoveUnit(unit.Id);
            }
        }

        /// <summary>
        /// 状態の時間を進める（ブラウザ版 tickStatusEffects）: side の番の始まりに呼ぶ。
        /// 「相手の次の番まで」の状態は、相手の番を過ごしたあと、次の番が始まるときに消える。火傷は1d3のダメージ
        /// </summary>
        private void TickStatusEffects(string side)
        {
            var rolls = RollsOverride ?? new RandomRolls();
            foreach (var u in units.Where(u => u.Side != side && u.Alive && u.plan != null))
            {
                foreach (var e in u.plan.statusEffects.Where(e => e.holdOwnPhase && e.phaseSeen).ToList())
                {
                    AddLog($"  {u.Name}の【{(string.IsNullOrEmpty(e.name) ? e.type : e.name)}】効果が切れた");
                    u.plan.statusEffects.Remove(e);
                }
            }
            foreach (var u in units.Where(u => u.Side == side && u.Alive && u.plan != null).ToList())
            {
                var next = new List<PlanStatus>();
                foreach (var e in u.plan.statusEffects)
                {
                    if (e.holdOwnPhase) { e.phaseSeen = true; next.Add(e); continue; }
                    if (e.type == "burn")
                    {
                        int dmg = rolls.Dice("1d3");
                        u.plan.hp = Math.Max(0, u.plan.hp - dmg);
                        AddPopup(u.Id, dmg.ToString(), new Color(1f, 0.55f, 0.3f));
                        AddLog($"  {u.Name}は火傷で {dmg} ダメージ（HP {u.plan.hp}/{u.plan.maxHp}）");
                    }
                    else if (e.type == "gravityField")
                    {
                        int dmg = Math.Max(1, e.value);
                        u.plan.hp = Math.Max(0, u.plan.hp - dmg);
                        AddLog($"  {u.Name}は重力場で {dmg} ダメージ");
                    }
                    e.duration--;
                    if (e.duration <= 0) AddLog($"  {u.Name}の【{(string.IsNullOrEmpty(e.name) ? e.type : e.name)}】効果が切れた");
                    else next.Add(e);
                }
                u.plan.statusEffects = next;
                if (!u.Alive)
                {
                    AddLog($"  {u.Name}は倒れた！");
                    view.RemoveUnit(u.Id);
                }
            }
        }

        /// <summary>確認用: 敵がいまの位置から攻撃するときの予測を出す（動かない）</summary>
        public void PreviewEnemyAttack(string enemyId)
        {
            var enemy = units.FirstOrDefault(u => u.Id == enemyId);
            if (enemy == null) return;
            var (_, target, option) = ChooseEnemyAttackWithOption(enemy, units.Where(u => u.Alive && u.Side == "ally"));
            EnemyPreview = target == null ? null : new EnemyPreviewInfo
            {
                attacker = enemy, target = target, option = option,
                forecast = BattlePlan.ForecastOf(enemy.plan, target.plan, option.ToAction(), PlanUnits()),
            };
            if (target != null) FocusOnPair(enemy, target);
        }

        /// <summary>
        /// 攻める側と受ける側のまん中に寄る。味方の攻撃・敵の攻撃の前の予測のどちらも同じ寄せ方
        /// （レビュー 2026-09-28 D3: 敵の番の予測で、受ける味方が下の帯に隠れていた）
        /// </summary>
        private void FocusOnPair(UnitState attacker, UnitState defender) =>
            view.FocusOnPointAt((map.TopCenter(attacker.cell) + map.TopCenter(defender.cell)) * 0.5f, 0.64f);   // 下の予測の帯より上（銀細工のUI 第4段）

        public void ClearEnemyPreview() => EnemyPreview = null;
        private BattleOption currentOption;
        /// <summary>今選んでいる攻撃（狙う相手を選ぶ・戦闘予測の間）</summary>
        public BattleOption CurrentOption => currentOption;
        public UiUnit UiOf(UnitState unit) => unit != null && uiUnits.TryGetValue(unit.Id, out var ui) ? ui : null;

        /// <summary>そのキャラが選べる攻撃（なければ今の装備の攻撃だけ）</summary>
        public IReadOnlyList<BattleOption> OptionsOf(UnitState unit)
        {
            var ui = UiOf(unit);
            if (ui?.options != null && ui.options.Length > 0)
                return ui.options.Where(o => !(o.kind == "weapon" && !string.IsNullOrEmpty(o.artName) && ArtUsesLeft(unit, o.artName) <= 0)
                    && !(o.kind == "grimoire" && StaffBroken(unit, o.itemId))).ToList();
            var (min, max) = AttackReach(unit.plan);
            return new[] { new BattleOption { label = "通常攻撃", kind = unit.plan != null && unit.plan.HasGrimoireSpell ? "grimoire" : "weapon",
                spell = unit.plan?.grimoireSpell, equipSpell = unit.plan?.grimoireSpell, itemId = unit.plan?.equippedItem, rangeMin = min, rangeMax = max,
                isMagic = unit.plan != null && unit.plan.HasGrimoireSpell } };
        }

        /// <summary>コマンド「攻撃」: 武器の通常攻撃（武器を持っていなければ最初の攻撃）</summary>
        public BattleOption BasicOption(UnitState unit)
        {
            var options = OptionsOf(unit);
            return options.FirstOrDefault(o => o.kind == "weapon" && string.IsNullOrEmpty(o.artName)) ?? options.FirstOrDefault();
        }

        /// <summary>今のマスから、その攻撃が届く相手がいるか</summary>
        public bool CanUseFromHere(BattleOption option) =>
            selected != null && option != null && units.Any(u => u.Alive && u.Side != selected.Side && option.InRange(Distance(u.cell, selected.cell)));

        /// <summary>戦闘予測で切り替えられる攻撃（この相手に届くものだけ。ブラウザ版の ‹ › と同じ）</summary>
        public IReadOnlyList<BattleOption> ForecastOptions =>
            selected == null || target == null ? Array.Empty<BattleOption>()
                : OptionsOf(selected).Where(o => o.InRange(Distance(selected.cell, target.cell))).ToList();

        /// <summary>戦闘予測の攻撃を1つ前・次に切り替える</summary>
        public void CycleForecastOption(int step)
        {
            if (CurrentMode != Mode.Forecast) return;
            var list = ForecastOptions;
            if (list.Count < 2) return;
            int i = Math.Max(0, list.ToList().IndexOf(currentOption));
            currentOption = list[((i + step) % list.Count + list.Count) % list.Count];
            forecast = ForecastFor(selected, target, currentOption);
        }

        /// <summary>予測（使うときの持ち替えも入れる）</summary>
        private BattlePlan.Forecast ForecastFor(UnitState attacker, UnitState defender, BattleOption option)
        {
            var a = attacker.plan.Clone();
            Equip(attacker, a, option);
            var env = PlanUnits().Select(u => u.id == a.id ? a : u).ToList();
            if (option.IsArea)
            {
                // 範囲の攻撃は反撃・追撃なし。予測は押した相手への1撃（ブラウザ版 trialPlanPrediction）
                var area = BattlePlan.PlanArea(a, new[] { defender.plan }, option.ToAction(), env, new ForecastRolls());
                return new BattlePlan.Forecast
                {
                    plan = new PlanResult { steps = area.steps, attacker = area.attacker, defender = area.targets[0] },
                    first = area.steps.FirstOrDefault(),
                    attackerHpAfter = area.attacker.hp,
                    defenderHpAfter = area.targets[0].hp,
                };
            }
            return BattlePlan.ForecastOf(a, defender.plan, option.ToAction(), env);
        }
        public Battle3DHud Hud => hud;

        /// <summary>
        /// 敵の行動予告（ブラウザ版の planEnemyActions と同じ）: 味方の番の始まりに、敵ごとに狙う相手を決めて見せる。
        /// 敵の番では、その相手を攻撃できる一番よい立ち位置を選び直して攻撃する（相手が倒れていたら選び直す）
        /// </summary>
        public class Declaration
        {
            public string type;      // attack / move / wait
            public string targetId;  // attack のとき
            public Vector2Int dest;
        }

        private readonly Dictionary<string, Declaration> declarations = new Dictionary<string, Declaration>();
        public IReadOnlyDictionary<string, Declaration> Declarations => declarations;

        /// <summary>戦況の画面の見出しと、勝利条件・敗北条件の文（今の試験の戦闘。battleDefinitions の victory・defeat と同じ）</summary>
        public string BattleTitle => string.IsNullOrEmpty(data?.title) ? "テスト戦闘" : data.title;
        public string VictoryText => string.IsNullOrEmpty(data?.victoryText) ? "すべての敵を撃破する" : data.victoryText;
        public string DefeatText => string.IsNullOrEmpty(data?.defeatText) ? "味方の全滅" : data.defeatText;

        /// <summary>今のマスから攻撃が届く相手がいるか（「攻撃」を押せるか）</summary>
        public bool CanAttackFromHere => selected != null && CanUseFromHere(BasicOption(selected));
        /// <summary>動いたあとで、動く前のマスへ戻せるか</summary>
        public bool CanUndoMove => selected != null && selected.moved && selected.cell != moveFrom && !selected.acted;

        /// <summary>盤面の上のユニット（位置・陣営・戦闘の状態）</summary>
        public class UnitState : MoveRange.IOccupant
        {
            public UnitData source;
            public PlanUnit plan;      // 戦闘の状態（HP・MP・能力値・スキル・装備）。位置は cell と同じにする
            public Vector2Int cell;
            public bool moved;
            public bool acted;
            public readonly List<ItemData> items = new List<ItemData>();   // 拾った消耗品
            public bool summoned;          // 召喚獣（負けの判定に数えない）
            public string summonerId;      // 呼んだキャラ（倒れたら召喚獣も消える）
            public readonly Dictionary<string, int> durability = new Dictionary<string, int>();   // 魔法武器（杖）の今の耐久（item id → 値。戦闘の始めは満タン）
            public readonly Dictionary<string, int> artUses = new Dictionary<string, int>();      // 物理戦技の残り回数（戦技名 → 回数）
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
            if (!setupOnStart) return;
            Setup();
            view.SetView(false, 0, true);   // 戦闘は真上からが最初（原作者 2026-10-03）
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
            uiUnits.Clear();
            if (uiJson != null)
                foreach (var u in JsonUtility.FromJson<UiDataFile>(uiJson.text).units ?? Array.Empty<UiUnit>())
                    uiUnits[u.id] = u;
            currentOption = null;
            var planState = planJson != null ? JsonUtility.FromJson<PlanStateFile>(planJson.text) : null;
            if (planState != null) BattlePlan.SetItems(planState.items);
            planSnapshots = planState?.units ?? Array.Empty<PlanUnit>();
            pendingSummons.Clear();
            usedSummons.Clear();
            summonEntry = null;

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
            finishedRaised = false;
            blocked.Clear();
            foreach (var tile in data.tiles ?? Array.Empty<TileData>())
                if (tile.type == "wall" || tile.type == "void") blocked.Add(new Vector2Int(tile.x, tile.y));

            if (place != null)
            {
                // 場所の中で戦う: 探索と同じ盤面（地形・高い物・床の絵）。キャラはこのあと足す
                map = Board3DMap.FromLayout(place);
                map.Units.Clear();
            }
            else if (layout == "watchroad" && data.cols == Board3DLayout.Columns && data.rows == Board3DLayout.Rows)
            {
                // 国境監視路: 地形・高い物・まわりの景色は配置のとおり。キャラはこのあと足す
                map = Board3DLayout.Watchroad();
                map.Units.Clear();
            }
            else map = BuildMap(data, blocked);
            mapItems.Clear();
            usedSpecials.Clear();
            reserves.Clear();
            reserveEntry.Clear();
            reservePending = false;
            pickedThisMove = null;
            foreach (var mi in data.mapItems ?? Array.Empty<MapItemData>())
                if (mi?.item != null) mapItems[new Vector2Int(mi.x, mi.y)] = mi.item;
            foreach (var source in data.units)
            {
                var start = Origin + new Vector2Int(source.x, source.y);
                if (place == null && layout == "watchroad")
                {
                    // 監視路の最初の位置（マップ担当の配置）
                    foreach (var (cell, id) in Board3DLayout.Units) if (id == source.id) start = cell;
                }
                var state = new UnitState { source = source, cell = start };
                if (source.items != null) state.items.AddRange(source.items.Where(i => i != null && !string.IsNullOrEmpty(i.name)));
                var snapshot = planState?.units?.FirstOrDefault(u => u.id == source.id);
                if (snapshot != null)
                {
                    state.plan = snapshot.Clone();
                    state.plan.x = state.cell.x;
                    state.plan.y = state.cell.y;
                }
                if (source.reserve)
                {
                    reserves.Add(state);
                    reserveEntry[source.id] = start;
                    if (source.wait != null && source.wait.Length == 2)
                    {
                        state.cell = Origin + new Vector2Int(source.wait[0], source.wait[1]);
                        // 見守っている間は陣営の枠を付けない（戦う相手に見えないように）
                        map.Units.Add(new Board3DMap.Unit { cell = state.cell, id = source.id, enemy = source.side == "enemy", neutral = true });
                    }
                    continue;
                }
                units.Add(state);
                map.Units.Add(new Board3DMap.Unit { cell = state.cell, id = source.id, enemy = source.side == "enemy" });
            }
            if (place != null)
            {
                view.Ground = placeGround;
                view.TileGap = 0.03f;   // 戦闘はマス目の線を出す（探索は 0）。線は戦う範囲だけ（範囲の外は場所の景色のまま）
                view.GapCells = InBoard;
            }
            else view.GapCells = null;
            view.Map = map;
            view.CellTapped -= TapCell;
            view.CellTapped += TapCell;
            view.IsOverOtherGui = IsOverPanel;
            view.HideGuiButtons = HideViewButtons;   // 視点のボタン（回す・真上・全体）は、戦闘予測・会話の間は隠す（予測のボタンに重なった）
            view.Setup();
            Board3DMood.Apply(string.IsNullOrEmpty(data.timeOfDay) ? Board3DMood.Dusk : data.timeOfDay, view.KeyLight, place != null && place.indoor);
            view.ApplyPropTint();
            foreach (var cell in mapItems.Keys) view.AddPickup(cell);
            AddLog("味方フェーズ ターン1");
            PlanEnemyActions();
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
            // 封印（移動不可）・封じのあいだは動けない（ブラウザ版 getMoveRange と同じ）
            if (unit.plan != null && unit.plan.statusEffects.Any(e => e.type == "immobilize" || e.type == "sealed")) return new List<Vector2Int>();
            // 地形の通行（TerrainRules）: 地上は s d g = だけ。飛行は通り抜けられるが、# と t には止まれない
            bool flying = unit.source.flying;
            // 場所の中で戦うときは、戦う範囲の外に入れない（原作者 2026-09-28）
            return MoveRange.Compute(unit.cell, unit.source.move, unit.source.side, units.Where(u => u.Alive), map.Columns, map.Rows,
                cell => InBoard(cell) && map.CanEnter(cell, flying), cell => InBoard(cell) && map.CanStop(cell, flying), unit);
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
            if (InputBlocked != null && InputBlocked()) return;
            if (!InBoard(cell)) { CancelToIdle(); return; }
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
                case Mode.Summon:
                    if (unit == null && supportCells.Contains(cell)) { PlaceSummon(cell); return; }
                    BackToActing();
                    return;
                case Mode.Support:
                    if (currentOption?.artName == "転移")
                    {
                        // 転移: 1段目＝範囲の味方、2段目＝範囲の空いているマス（味方を押すと選び直し）
                        if (unit != null && unit.Side == selected.Side && Distance(unit.cell, selected.cell) <= currentOption.rangeMax) { PickTransferAlly(unit); return; }
                        if (TransferAlly != null && unit == null && supportCells.Contains(cell)) { CastTransfer(selected, TransferAlly, cell); return; }
                        BackToActing();
                        return;
                    }
                    if (unit != null && supportCells.Contains(cell)) { CastSupport(selected, unit, currentOption); return; }
                    BackToActing();
                    return;
                case Mode.Trade:
                    // 交換: 隣の味方を押して相手を選ぶ（相手を選んだあとは、操作の欄で品物を選ぶ）
                    if (TradePartner == null && unit != null && supportCells.Contains(cell)) { PickTradePartner(unit); return; }
                    if (TradePartner == null) EndTrade();
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
            view.FollowCell(unit.cell);
        }

        private void MoveSelectedTo(Vector2Int cell)
        {
            if (cell != selected.cell)
            {
                selected.cell = cell;
                if (selected.plan != null) { selected.plan.x = cell.x; selected.plan.y = cell.y; }
                view.MoveUnit(selected.Id, cell);
            }
            if (cell != moveFrom) ActionDone?.Invoke("move", selected);
            selected.moved = true;
            view.FollowCell(cell);   // 動いた先が画面の端なら付いていく
            pickedThisMove = null;
            if (selected.Side == "ally" && mapItems.TryGetValue(cell, out var found))
            {
                mapItems.Remove(cell);
                selected.items.Add(found);
                pickedThisMove = (cell, found);
                view.RemovePickup(cell);
                AddLog($"{selected.Name}は {found.name} を拾った");
            }
            moveCells.Clear();
            view.ShowRange(null);
            view.Select(cell);
            CurrentMode = Mode.Acting;
        }

        /// <summary>「攻撃」: 攻撃の範囲（赤）を出して、相手を選ぶ</summary>
        public void ChooseAttack()
        {
            if (selected != null) ChooseOption(BasicOption(selected));
        }

        /// <summary>攻撃（通常攻撃・戦技・魔法）を選び、その射程で狙う相手を選ぶ</summary>
        public void ChooseOption(BattleOption option)
        {
            StayIfMoving();
            if (CurrentMode != Mode.Acting || selected == null || option == null) return;
            currentOption = option;
            attackCells.Clear();
            int min = option.rangeMin, max = option.rangeMax;
            foreach (var cell in BoardCells())
            {
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
            if (currentOption == null || !currentOption.InRange(Distance(selected.cell, defender.cell)))
                currentOption = OptionsOf(selected).FirstOrDefault(o => o.InRange(Distance(selected.cell, defender.cell))) ?? BasicOption(selected);
            forecast = ForecastFor(selected, defender, currentOption);
            // 戦闘予測: 攻める側と受ける側のまん中に寄る（下の帯に隠れないよう、見ている所は画面の少し上）
            FocusOnPair(selected, defender);
            view.ShowRange(new[] { defender.cell }, Board3DView.AttackRangeColor);
            CurrentMode = Mode.Forecast;
        }

        public void ShowForecast(string defenderId) => ShowForecast(units.FirstOrDefault(u => u.Id == defenderId));

        /// <summary>「実行」: 戦闘予測と同じ計算を本物の乱数で行い、結果を盤面に反映する</summary>
        public void ConfirmAttack()
        {
            if (CurrentMode != Mode.Forecast || selected == null || target == null) return;
            var attacker = selected;
            var defender = target;
            var used = currentOption;
            PlanResult result = null;
            if (currentOption != null && currentOption.IsArea) ExecuteArea(attacker, target, currentOption);
            else result = Execute(attacker, target, currentOption);
            ActionDone?.Invoke(used != null && used.isMagic ? "magic" : used != null && used.isArt ? "art" : "attack", attacker);
            // 反撃を受けた（訓練の手引き: 反撃人形）。反撃が外れても、反撃する相手を倒してしまっても進む
            // （原作者 2026-10-03: スマホで反撃の手引きから先へ進めなくなった）
            bool counterStep = result != null && result.steps.Any(s => s.type == "strike" && (s.role == "counter" || s.role == "counterFollowUp"));
            bool counterFoeDown = !string.IsNullOrEmpty(defender.plan?.equippedItem) && !defender.Alive;
            if (counterStep || counterFoeDown) ActionDone?.Invoke("countered", attacker);
            FinishAction(attacker);
        }

        /// <summary>視点のボタンを隠すとき: 戦闘予測（敵の攻撃の前の予測も）・会話（手引き）の間</summary>
        public bool HideViewButtons() =>
            CurrentMode == Mode.Forecast || EnemyPreview != null || (InputBlocked != null && InputBlocked());

        /// <summary>「戻る」（戦闘予測から相手を選ぶところへ）</summary>
        public void CancelForecast()
        {
            if (CurrentMode != Mode.Forecast) return;
            target = null;
            forecast = null;
            CurrentMode = Mode.Acting;
            ChooseOption(currentOption ?? BasicOption(selected));   // 同じ攻撃のまま相手を選び直す
        }

        /// <summary>選んだだけで動かずにコマンドを選んだときは、その場に止まったことにする（ブラウザ版と同じ）</summary>
        private void StayIfMoving()
        {
            if (CurrentMode == Mode.Moving && selected != null) MoveSelectedTo(selected.cell);
        }

        // ── 交換（原作者 2026-09-28: 落ちているアイテム拾いではなく、物交換にする。プロローグではカリマからポーションをもらう） ──

        /// <summary>交換している相手（相手を選ぶ前は null）</summary>
        public UnitState TradePartner { get; private set; }
        private bool tradedThisAction;

        /// <summary>交換できる相手: 隣の味方で、自分か相手が持ち物を持っている</summary>
        private IEnumerable<UnitState> TradeCandidates() =>
            selected == null ? Enumerable.Empty<UnitState>()
                : units.Where(u => u.Alive && u != selected && u.Side == selected.Side && !u.summoned && Distance(u.cell, selected.cell) == 1
                    && (selected.items.Count > 0 || u.items.Count > 0));

        public bool CanTradeFromHere => TradeCandidates().Any();

        /// <summary>「交換」: 隣の味方（緑）から相手を選ぶ。1人なら、すぐその相手にする</summary>
        public void ChooseTrade()
        {
            StayIfMoving();
            if (CurrentMode != Mode.Acting || selected == null) return;
            var candidates = TradeCandidates().ToList();
            if (candidates.Count == 0) return;
            supportCells.Clear();
            foreach (var u in candidates) supportCells.Add(u.cell);
            TradePartner = null;
            CurrentMode = Mode.Trade;
            if (candidates.Count == 1) PickTradePartner(candidates[0]);
            else view.ShowRange(supportCells, Board3DView.SupportRangeColor);
        }

        private void PickTradePartner(UnitState partner)
        {
            TradePartner = partner;
            view.ShowRange(new[] { partner.cell }, Board3DView.SupportRangeColor);
        }

        /// <summary>自分の持ち物を相手に渡す</summary>
        public void GiveItem(int index)
        {
            if (CurrentMode != Mode.Trade || TradePartner == null || index < 0 || index >= selected.items.Count) return;
            var item = selected.items[index];
            selected.items.RemoveAt(index);
            TradePartner.items.Add(item);
            tradedThisAction = true;
            AddLog($"{selected.Name}は {item.name} を {TradePartner.Name} に渡した");
        }

        /// <summary>相手の持ち物をもらう</summary>
        public void TakeItem(int index)
        {
            if (CurrentMode != Mode.Trade || TradePartner == null || index < 0 || index >= TradePartner.items.Count) return;
            var item = TradePartner.items[index];
            TradePartner.items.RemoveAt(index);
            selected.items.Add(item);
            tradedThisAction = true;
            AddLog($"{selected.Name}は {TradePartner.Name} から {item.name} をもらった");
        }

        /// <summary>
        /// 交換を終えて、行動を選ぶところへ戻る（交換は行動にならない。ただし交換したら、その場所で確定して移動は取り消せない。
        /// 動いた先で拾った物も、そのまま持つ）
        /// </summary>
        public void EndTrade()
        {
            if (CurrentMode != Mode.Trade) return;
            TradePartner = null;
            if (tradedThisAction && selected != null)
            {
                moveFrom = selected.cell;
                pickedThisMove = null;
            }
            if (tradedThisAction) ActionDone?.Invoke("trade", selected);
            tradedThisAction = false;
            BackToActing();
        }

        /// <summary>確認用: キャラに持ち物を持たせる</summary>
        public void GiveItemForTest(string unitId, ItemData item) => units.FirstOrDefault(u => u.Id == unitId)?.items.Add(item);

        /// <summary>「取り消し」: 相手を選ぶのをやめて、コマンドを選ぶところへ戻る</summary>
        public void CancelTargeting()
        {
            if (CurrentMode == Mode.Targeting || CurrentMode == Mode.Support || CurrentMode == Mode.Summon) BackToActing();
        }

        private void BackToActing()
        {
            supportCells.Clear();
            TransferAlly = null;
            attackCells.Clear();
            view.ShowRange(null);
            CurrentMode = Mode.Acting;
        }

        /// <summary>「待機」</summary>
        public void ChooseWait()
        {
            StayIfMoving();
            if (CurrentMode != Mode.Acting && CurrentMode != Mode.Targeting) return;
            FinishAction(selected);
        }

        /// <summary>「移動を取り消す」（まだ行動していなければ、動く前のマスへ戻す）</summary>
        public void UndoMove()
        {
            if ((CurrentMode != Mode.Acting && CurrentMode != Mode.Targeting && CurrentMode != Mode.Support && CurrentMode != Mode.Summon) || selected == null) return;
            supportCells.Clear();
            var unit = selected;
            if (pickedThisMove.HasValue)
            {
                // 移動を取り消したら、拾った物もマスへ戻す（ブラウザ版と同じ）
                var (cell, item) = pickedThisMove.Value;
                unit.items.Remove(item);
                mapItems[cell] = item;
                view.AddPickup(cell);
                pickedThisMove = null;
            }
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
            if (reservePending) return;   // 控えの敵が入ってくるのを待つ（入ったら FinishReserves で敵の番へ）
            if (AutoEndTurn && units.Where(u => u.Alive && u.Side == "ally").All(u => u.acted)) EndTurn();
        }

        /// <summary>味方が全員行動したら、自動で敵の番へ進む（確認用の自動の進行では止めて、最後の味方の画像を撮ってから進める）</summary>
        public bool AutoEndTurn { get; set; } = true;

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
        private PlanResult Execute(UnitState attacker, UnitState defender, BattleOption option = null, bool switchEquip = true)
        {
            var rolls = RollsOverride ?? new RandomRolls();
            // 味方は使うときに持ち替える（ブラウザ版と同じ。敵は持ち替えない）
            if (option != null && switchEquip) Equip(attacker, attacker.plan, option);
            else SyncDurability(attacker, attacker.plan);
            SyncDurability(defender, defender.plan);
            // 物理戦技は1戦闘の回数を使う（採用版 v1.3。回数は仮）
            if (option != null && option.kind == "weapon" && !string.IsNullOrEmpty(option.artName))
                attacker.artUses[option.artName] = ArtUsesLeft(attacker, option.artName) - 1;
            var action = option != null ? option.ToAction() : PlanAction.ForEquipped(attacker.plan);
            var plan = BattlePlan.PlanExchange(attacker.plan, defender.plan, action, PlanUnits(), rolls);
            if (option != null && (option.isArt || option.isMagic)) AddLog($"{attacker.Name}の{option.ActionName}");
            var byId = new Dictionary<string, UnitState> { { attacker.Id, attacker }, { defender.Id, defender } };
            AddLog($"{attacker.Name} → {defender.Name}");
            foreach (var step in plan.steps)
            {
                if (step.durabilityCost > 0) LogDurability(byId[step.actorId], step);
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
            // 手加減（訓練）: 味方のHPは1より下がらない（寸止め）
            if (data.mercy)
                foreach (var unit in new[] { attacker, defender })
                    if (unit.Side == "ally" && unit.plan.hp <= 0)
                    {
                        unit.plan.hp = 1;
                        AddLog($"  {(unit == attacker ? defender : attacker).Name}は寸止めした（{unit.Name}はHP1で止まる）");
                    }
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
            unit.plan.staffDurability = after.staffDurability;
            if (!string.IsNullOrEmpty(unit.plan.equippedItem) && unit.plan.staffDurability >= 0)
                unit.durability[unit.plan.equippedItem] = unit.plan.staffDurability;
        }

        // ── 魔法武器の耐久・物理戦技の回数（採用版 v1.3〜1.4。値は仮。ブラウザ版の trialStaffDurability・trialPhysicalArtUsesLeft と同じ） ──

        /// <summary>持ち替え（使うときの持ち替え＋その杖の今の耐久）</summary>
        private void Equip(UnitState unit, PlanUnit plan, BattleOption option)
        {
            option.ApplyEquip(plan, UiOf(unit)?.weaponItemId);
            SyncDurability(unit, plan);
        }

        /// <summary>装備中の魔法武器の今の耐久を、計画用の値に入れる（まだ使っていなければ −1＝満タン）</summary>
        private static void SyncDurability(UnitState unit, PlanUnit plan)
        {
            plan.staffDurability = !string.IsNullOrEmpty(plan.equippedItem) && unit.durability.TryGetValue(plan.equippedItem, out var value) ? value : -1;
        }

        /// <summary>その魔法武器の今の耐久（使っていなければ最大）</summary>
        public static int StaffDurability(UnitState unit, string itemId)
        {
            if (string.IsNullOrEmpty(itemId)) return 0;
            if (unit.durability.TryGetValue(itemId, out var value)) return value;
            return BattlePlan.Items.TryGetValue(itemId, out var item) ? item.durability : 0;
        }

        public static bool StaffBroken(UnitState unit, string itemId) =>
            !string.IsNullOrEmpty(itemId) && BattlePlan.Items.TryGetValue(itemId, out var item) && item.kind == "grimoire" && StaffDurability(unit, itemId) <= 0;

        /// <summary>物理戦技の残り回数</summary>
        public static int ArtUsesLeft(UnitState unit, string artName) =>
            unit.artUses.TryGetValue(artName, out var left) ? left : TrialRules.PhysicalArtUses;

        private void LogDurability(UnitState unit, PlanStep step)
        {
            string name = unit.plan.equippedItem != null && BattlePlan.Items.TryGetValue(unit.plan.equippedItem, out var item) ? item.name : "魔法武器";
            AddLog($"  {name}の耐久 -{step.durabilityCost}（残り {step.actorDurabilityAfter}）");
            if (step.actorDurabilityAfter == 0) AddLog($"  {name}が壊れた（威力・命中の補正と付属の魔法を失う）");
        }

        /// <summary>確認用: 勝敗と召喚の片付けを今すぐ行う</summary>
        public bool CheckBattleEnd() => CheckEnd();

        private bool CheckEnd()
        {
            CleanupSummons();
            if (!units.Any(u => u.Alive && u.Side == "enemy") && reserves.Count > 0)
            {
                if (reservePending) return false;
                if (ReserveCalled != null) { reservePending = true; ReserveCalled.Invoke(); }
                else BringReservesNow();
                return false;
            }
            if (!units.Any(u => u.Alive && u.Side == "enemy")) { CurrentPhase = Phase.Victory; AddLog("勝利！ すべての敵を倒した"); RaiseFinished(); return true; }
            if (!units.Any(u => u.Alive && u.Side == "ally" && !u.summoned)) { CurrentPhase = Phase.Defeat; AddLog("敗北…"); RaiseFinished(); return true; }
            return false;
        }

        /// <summary>控えの敵を戦いに出す（待つ位置から、もとの位置まで歩いて入る。ふさがっていれば近くの空いたマス）</summary>
        public void BringReservesNow()
        {
            if (reserves.Count == 0) { reservePending = false; return; }
            var walkers = new List<(UnitState unit, Vector2Int from, Vector2Int to)>();
            foreach (var unit in reserves)
            {
                var from = unit.cell;
                bool waiting = view.IsUnitShown(unit.Id, out _);
                var cell = reserveEntry.TryGetValue(unit.Id, out var entry) ? entry : unit.cell;
                if (units.Any(u => u.Alive && u.cell == cell))
                {
                    var free = BoardCells().Where(c => !units.Any(u => u.Alive && u.cell == c) && !blocked.Contains(c))
                        .OrderBy(c => Distance(c, unit.cell)).Cast<Vector2Int?>().FirstOrDefault();
                    if (free.HasValue) cell = free.Value;
                }
                unit.cell = cell;
                if (unit.plan != null) { unit.plan.x = cell.x; unit.plan.y = cell.y; }
                units.Add(unit);
                if (waiting) walkers.Add((unit, from, cell));
                else view.AddUnitToBoard(new Board3DMap.Unit { cell = cell, id = unit.Id, enemy = unit.Side == "enemy" });
                AddLog($"{unit.Name}が戦いに加わった");
            }
            reserves.Clear();
            if (Application.isPlaying && walkers.Count > 0) StartCoroutine(WalkReservesIn(walkers));
            else
            {
                foreach (var w in walkers) { view.MoveUnit(w.unit.Id, w.to); view.FocusOn(w.to); }
                FinishReserves();
            }
        }

        /// <summary>
        /// 待つ位置から入る: ふつうは1マスずつ歩く（縦に進んでから横）。enter が teleport なら、転移の輪の光とともに
        /// 待つ位置から消えて、入る位置に一瞬で現れる（ギュンターの得意の転移魔法。原作者 2026-10-02）
        /// </summary>
        private IEnumerator WalkReservesIn(List<(UnitState unit, Vector2Int from, Vector2Int to)> walkers)
        {
            foreach (var w in walkers)
            {
                view.FocusOn(w.to);
                if (w.unit.source.enter == "teleport")
                {
                    view.AddSummonCircle(w.from);
                    yield return new WaitForSeconds(0.35f);
                    view.RemoveUnit(w.unit.Id);
                    view.RemoveSummonCircle(w.from);
                    view.AddSummonCircle(w.to);
                    yield return new WaitForSeconds(0.35f);
                    view.MoveUnit(w.unit.Id, w.to);
                    view.RemoveSummonCircle(w.to);
                    AddPopup(w.unit.Id, "転移", new Color(0.7f, 0.85f, 1f));
                    continue;
                }
                var at = w.from;
                while (at != w.to)
                {
                    at += at.y != w.to.y ? new Vector2Int(0, Math.Sign(w.to.y - at.y)) : new Vector2Int(Math.Sign(w.to.x - at.x), 0);
                    view.MoveUnit(w.unit.Id, at);
                    yield return new WaitForSeconds(0.22f);
                }
            }
            FinishReserves();
        }

        private void FinishReserves()
        {
            // 見守っていたキャラ（枠なし）を、戦うキャラ（陣営の枠つき）として置き直す
            foreach (var unit in units.Where(u => view.Map.Units.Any(m => m.id == u.Id && m.neutral)).ToList())
            {
                view.RemoveUnit(unit.Id);
                view.Map.Units.RemoveAll(m => m.id == unit.Id);
                view.AddUnitToBoard(new Board3DMap.Unit { cell = unit.cell, id = unit.Id, enemy = unit.Side == "enemy" });
            }
            reservePending = false;
            if (CurrentPhase == Phase.Ally) PlanEnemyActions();
            Reinforced?.Invoke();
            // 呼ばれる前に味方が全員行動していたら、ここで敵の番へ
            if (CurrentPhase == Phase.Ally && AutoEndTurn && units.Where(u => u.Alive && u.Side == "ally").All(u => u.acted)) EndTurn();
        }

        private void RaiseFinished()
        {
            if (finishedRaised) return;
            finishedRaised = true;
            Finished?.Invoke(CurrentPhase);
        }

        // ── 敵の番 ──

        /// <summary>「ターン終了」: 敵の番へ</summary>
        public void EndTurn()
        {
            if (CurrentPhase != Phase.Ally || reservePending) return;
            CancelToIdle();
            CurrentPhase = Phase.Enemy;
            AddLog($"敵フェーズ ターン{Turn}");
            TickStatusEffects("enemy");
            if (CheckEnd()) return;
            if (Application.isPlaying) StartCoroutine(EnemyPhase());
            else RunEnemyPhaseImmediately();
        }

        private IEnumerator EnemyPhase()
        {
            foreach (var enemy in units.Where(u => u.Side == "enemy").ToList())
            {
                if (!enemy.Alive || enemy.source.passive || CurrentPhase != Phase.Enemy) continue;
                while (InputBlocked != null && InputBlocked()) yield return null;   // 会話の間は待つ
                yield return new WaitForSeconds(enemyStepSeconds);
                var plan = PrepareEnemyAct(enemy);
                if (plan.target != null)
                {
                    EnemyPreview = new EnemyPreviewInfo
                    {
                        attacker = enemy, target = plan.target, option = plan.option,
                        forecast = BattlePlan.ForecastOf(enemy.plan, plan.target.plan, plan.option.ToAction(), PlanUnits()),
                    };
                    FocusOnPair(enemy, plan.target);
                    yield return new WaitForSeconds(enemyPreviewSeconds);
                    EnemyPreview = null;
                }
                PerformEnemyAct(enemy, plan);
                if (CheckEnd()) yield break;
            }
            yield return new WaitForSeconds(enemyStepSeconds * 0.5f);
            StartAllyTurn();
        }

        /// <summary>
        /// 確認用（1手ごとの画像）: 敵の番で、敵が動いたあと（"moved"）・攻撃の前の予測（"preview"）・行動のあと（"acted"）に呼ぶ。
        /// 空なら、敵の番は今までどおり1度に進む
        /// </summary>
        public Action<string, UnitState> EnemyStepHook { get; set; }

        /// <summary>確認用（エディタ上）: 待たずに敵の番を進める</summary>
        public void RunEnemyPhaseImmediately()
        {
            foreach (var enemy in units.Where(u => u.Side == "enemy").ToList())
            {
                if (!enemy.Alive || enemy.source.passive || CurrentPhase != Phase.Enemy) continue;
                if (EnemyStepHook == null) EnemyAct(enemy);
                else
                {
                    var plan = PrepareEnemyAct(enemy);
                    EnemyStepHook("moved", enemy);
                    if (plan.target != null)
                    {
                        EnemyPreview = new EnemyPreviewInfo
                        {
                            attacker = enemy, target = plan.target, option = plan.option,
                            forecast = BattlePlan.ForecastOf(enemy.plan, plan.target.plan, plan.option.ToAction(), PlanUnits()),
                        };
                        FocusOnPair(enemy, plan.target);
                        EnemyStepHook("preview", enemy);
                        EnemyPreview = null;
                    }
                    PerformEnemyAct(enemy, plan);
                    EnemyStepHook("acted", enemy);
                }
                if (CheckEnd()) return;
            }
            StartAllyTurn();
        }

        /// <summary>確認用（自動で進める）: このキャラが攻撃するなら、敵の行動選びと同じ評価で どこから・誰を・どの攻撃で</summary>
        public (Vector2Int cell, UnitState target, BattleOption option) SuggestAttack(UnitState unit) =>
            ChooseEnemyAttackWithOption(unit, units.Where(u => u.Alive && IsOpponent(unit, u)));

        /// <summary>確認用（自動で進める）: 攻撃できないとき、いちばん近い相手へ近づけるマス</summary>
        public Vector2Int SuggestApproach(UnitState unit) =>
            ApproachCell(unit, units.Where(u => u.Alive && IsOpponent(unit, u)));

        private static bool IsOpponent(UnitState a, UnitState b) => (a.Side == "enemy") != (b.Side == "enemy");

        /// <summary>
        /// 敵1人の行動: 動ける先（今のマスも含む）×届く相手のすべてを戦闘予測で評価し、いちばん良いものを選ぶ
        /// （ブラウザ版の敵の行動選びと同じ評価 BattlePlan.ScoreAttack）。攻撃できなければ、いちばん近い味方へ近づく
        /// </summary>
        private void EnemyAct(UnitState enemy) => PerformEnemyAct(enemy, PrepareEnemyAct(enemy));

        private struct EnemyPlan
        {
            public UnitState target;
            public BattleOption option;
        }

        /// <summary>敵1人の行動の準備: 予告した相手を攻撃できる一番よい立ち位置と攻撃を選び直して、そこへ動く</summary>
        private EnemyPlan PrepareEnemyAct(UnitState enemy)
        {
            view.FocusOn(enemy.cell);
            var allies = units.Where(u => u.Alive && u.Side == "ally").ToList();
            if (allies.Count == 0) return default;
            declarations.TryGetValue(enemy.Id, out var decl);
            // 予告した相手がいれば、その相手を攻撃できる一番よい立ち位置を選び直す。倒れていたら相手を選び直す
            var victim = decl?.type == "attack" ? allies.FirstOrDefault(u => u.Id == decl.targetId) : null;
            var (cell, target, option) = victim != null ? ChooseEnemyAttackWithOption(enemy, new[] { victim }) : ChooseEnemyAttackWithOption(enemy, allies);
            if (decl?.type == "attack" && victim == null && target != null) AddLog($"{enemy.Name}は目標を {target.Name} に切り替えた");
            if (target == null) cell = ApproachCell(enemy, victim != null ? new[] { victim } : (IEnumerable<UnitState>)allies);
            if (cell != enemy.cell)
            {
                enemy.cell = cell;
                enemy.plan.x = cell.x; enemy.plan.y = cell.y;
                view.MoveUnit(enemy.Id, cell);
            }
            declarations.Remove(enemy.Id);
            RefreshTargetRings();
            return new EnemyPlan { target = target, option = option };
        }

        private void PerformEnemyAct(UnitState enemy, EnemyPlan plan)
        {
            if (plan.target != null) Execute(enemy, plan.target, plan.option, switchEquip: false);
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
            TickStatusEffects("ally");
            if (CheckEnd()) return;
            ResolveSummons();
            PlanEnemyActions();
            ActionDone?.Invoke("allyTurn", null);
        }

        /// <summary>敵の行動予告を作り、狙われた味方に赤い丸を出す</summary>
        public void PlanEnemyActions()
        {
            declarations.Clear();
            var allies = units.Where(u => u.Alive && u.Side == "ally").ToList();
            var reserved = new HashSet<Vector2Int>();
            foreach (var enemy in units.Where(u => u.Alive && u.Side == "enemy"))
            {
                if (allies.Count == 0) break;
                if (enemy.source.passive) { declarations[enemy.Id] = new Declaration { type = "wait", dest = enemy.cell }; continue; }
                var (cell, target) = ChooseEnemyAttack(enemy, allies, reserved);
                if (target != null)
                {
                    reserved.Add(cell);
                    declarations[enemy.Id] = new Declaration { type = "attack", targetId = target.Id, dest = cell };
                    continue;
                }
                var dest = ApproachCell(enemy, allies, reserved);
                reserved.Add(dest);
                declarations[enemy.Id] = new Declaration { type = dest != enemy.cell ? "move" : "wait", dest = dest };
            }
            RefreshTargetRings();
        }

        private void RefreshTargetRings()
        {
            var targeted = new HashSet<string>(declarations.Values.Where(d => d.type == "attack").Select(d => d.targetId));
            foreach (var unit in units.Where(u => u.Side == "ally"))
                view.SetTargeted(unit.Id, unit.Alive && targeted.Contains(unit.Id));
            // 行動予告の矢印（ブラウザ版の攻撃レーザー。予告した敵 → 狙う味方）
            view.SetIntentArrows(declarations.Where(kv => kv.Value.type == "attack" && units.Any(u => u.Id == kv.Key && u.Alive))
                .Select(kv => (kv.Key, kv.Value.targetId)).ToList());
        }

        /// <summary>
        /// 敵が攻撃する立ち位置と相手を選ぶ: 動ける先（今のマスも含む）×届く相手のすべてを戦闘予測で評価する
        /// （ブラウザ版の敵の行動選びと同じ評価 BattlePlan.ScoreAttack）。reserved のマスには止まらない
        /// </summary>
        private (Vector2Int cell, UnitState target) ChooseEnemyAttack(UnitState enemy, IEnumerable<UnitState> candidates, ICollection<Vector2Int> reserved = null)
        {
            var (cell, target, _) = ChooseEnemyAttackWithOption(enemy, candidates, reserved);
            return (cell, target);
        }

        /// <summary>敵の攻撃の選択肢（魔法は MP があるときだけ。ブラウザ版 trialEnemyAttackOptions）</summary>
        private List<BattleOption> EnemyOptionsOf(UnitState enemy)
        {
            var ui = UiOf(enemy);
            var list = ui?.enemyOptions != null && ui.enemyOptions.Length > 0 ? ui.enemyOptions.ToList() : OptionsOf(enemy).ToList();
            return list.Where(o => !o.isMagic || (enemy.plan != null && enemy.plan.mp > 0)).ToList();
        }

        /// <summary>
        /// 敵が攻撃する立ち位置・相手・攻撃を選ぶ（ブラウザ版の trialChooseEnemyAttack と同じ）: 相手×動ける先×攻撃のすべてを
        /// 戦闘予測で評価する（BattlePlan.ScoreAttack）。同じ評価なら、動く距離が短いほう・通常攻撃（MPや戦技を使わないほう）
        /// </summary>
        private (Vector2Int cell, UnitState target, BattleOption option) ChooseEnemyAttackWithOption(UnitState enemy, IEnumerable<UnitState> candidates, ICollection<Vector2Int> reserved = null)
        {
            var cells = new List<Vector2Int> { enemy.cell };
            cells.AddRange(MoveCellsOf(enemy));
            var options = EnemyOptionsOf(enemy);
            double bestScore = double.NegativeInfinity;
            Vector2Int bestCell = enemy.cell;
            UnitState bestTarget = null;
            BattleOption bestOption = null;
            foreach (var ally in candidates.Where(u => u.Alive && u.plan != null))
            foreach (var cell in cells)
            {
                if (reserved != null && cell != enemy.cell && reserved.Contains(cell)) continue;
                int distance = Distance(cell, ally.cell);
                if (distance < 1) continue;
                var attacker = enemy.plan.Clone();
                attacker.x = cell.x; attacker.y = cell.y;
                var env = PlanUnits().Select(u => u.id == enemy.Id ? attacker : u).ToList();
                foreach (var option in options)
                {
                    if (!option.InRange(distance)) continue;
                    var f = BattlePlan.ForecastOf(attacker, ally.plan, option.ToAction(), env);
                    double score = BattlePlan.ScoreAttack(f, ally.plan.hp, enemy.plan.hp) - Distance(cell, enemy.cell) * 0.01
                        - (option.isArt || option.isMagic ? 0.005 : 0);
                    if (score > bestScore) { bestScore = score; bestCell = cell; bestTarget = ally; bestOption = option; }
                }
            }
            return (bestCell, bestTarget, bestOption);
        }

        /// <summary>攻撃できないとき: 相手（いちばん近い味方）にいちばん近づけるマス</summary>
        private Vector2Int ApproachCell(UnitState enemy, IEnumerable<UnitState> toward, ICollection<Vector2Int> reserved = null)
        {
            var goals = toward.Where(u => u.Alive).ToList();
            if (goals.Count == 0) return enemy.cell;
            var cells = new List<Vector2Int> { enemy.cell };
            cells.AddRange(MoveCellsOf(enemy).Where(c => reserved == null || !reserved.Contains(c)));
            return cells.OrderBy(c => goals.Min(a => Distance(a.cell, c))).ThenBy(c => Distance(c, enemy.cell)).First();
        }

        // ── 表示（仮の操作の欄。IMGUI） ──

        /// <summary>これまでに足した記録の行数（記録は新しい60行だけ残すので、確認用に数える）</summary>
        public int LogTotal { get; private set; }

        private void AddLog(string line)
        {
            LogTotal++;
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
            if (hud != null) return hud.IsOverHud(screenPosition);
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
                guiFont = JapaneseFont.Get(new[] { "Yu Gothic UI", "Meiryo", "MS Gothic", "Hiragino Sans", "Noto Sans CJK JP" }, 14);
                boxStyle = new GUIStyle(GUI.skin.box) { font = guiFont, alignment = TextAnchor.UpperLeft, fontSize = 12, wordWrap = true };
                labelStyle = new GUIStyle(GUI.skin.label) { font = guiFont, fontSize = 12, wordWrap = true };
                bigStyle = new GUIStyle(GUI.skin.label) { font = guiFont, fontSize = 30, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
                popupStyle = new GUIStyle(GUI.skin.label) { font = guiFont, fontSize = 18, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
            }
            GUI.skin.font = guiFont;
            float s = GuiScale;
            GUI.matrix = Matrix4x4.Scale(new Vector3(s, s, 1f));

            if (hud != null) { DrawPopupsAndResult(s); return; }

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
            DrawPopupsAndResult(s);
        }

        /// <summary>勝敗の文字と、頭の上のダメージの数字（UIを作るまでの仮）</summary>
        private void DrawPopupsAndResult(float s)
        {
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
