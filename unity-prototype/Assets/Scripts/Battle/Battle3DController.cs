using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// Unity版の戦闘（M1）を3Dの盤面で動かす（原作者 2026-09-27: マップは3Dの盤面に置き換える）。
    /// 2Dの斜めの1枚絵の BattleM1Controller と同じ流れ: 味方を選ぶと移動範囲が出て、範囲のマスを押すと動く。
    /// 表示は Board3DView、移動の規則は MoveRange（ブラウザ版と同じ規則）。
    /// データはブラウザ版から書き出した戦闘データ（tools/export_unity_battle.js）。
    /// </summary>
    public class Battle3DController : MonoBehaviour
    {
        [SerializeField] private TextAsset battleJson;
        [SerializeField] private Board3DView view;

        private BattleDataFile data;
        private readonly List<UnitState> units = new List<UnitState>();
        private readonly HashSet<Vector2Int> blocked = new HashSet<Vector2Int>();
        private readonly HashSet<Vector2Int> moveCells = new HashSet<Vector2Int>();
        private UnitState selected;
        private Board3DMap map;

        public BattleDataFile Data => data;
        public IReadOnlyList<UnitState> Units => units;
        public UnitState Selected => selected;
        public Board3DView View => view;

        /// <summary>盤面の上のユニット（移動の規則が使う位置・陣営）</summary>
        public class UnitState : MoveRange.IOccupant
        {
            public UnitData source;
            public Vector2Int cell;
            public bool moved;
            public Vector2Int Cell => cell;
            public string Side => source.side;
            public bool Alive => true;
        }

        private void Start()
        {
            Setup();
            view.SetView(true, 0, true);
        }

        /// <summary>データを読み、盤面を組み立て直す（エディタ上でも動く）</summary>
        public void Setup()
        {
            if (battleJson == null) throw new InvalidOperationException("battleJson が設定されていない");
            if (view == null) throw new InvalidOperationException("view（Board3DView）が設定されていない");
            data = JsonUtility.FromJson<BattleDataFile>(battleJson.text);
            units.Clear();
            moveCells.Clear();
            selected = null;
            blocked.Clear();
            foreach (var tile in data.tiles ?? Array.Empty<TileData>())
                if (tile.type == "wall" || tile.type == "void") blocked.Add(new Vector2Int(tile.x, tile.y));

            map = BuildMap(data, blocked);
            foreach (var source in data.units)
            {
                var state = new UnitState { source = source, cell = new Vector2Int(source.x, source.y) };
                units.Add(state);
                map.Units.Add(new Board3DMap.Unit { cell = state.cell, id = source.id, enemy = source.side == "enemy" });
            }
            view.Map = map;
            view.CellTapped -= TapCell;
            view.CellTapped += TapCell;
            view.Setup();
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
            return map;
        }

        // ── 操作 ──

        /// <summary>マスを押したときの処理（ユニットがいればそのユニット、いなければ移動先）</summary>
        public void TapCell(Vector2Int cell)
        {
            if (cell.x < 0 || cell.y < 0 || cell.x >= data.cols || cell.y >= data.rows)
            {
                Deselect();
                return;
            }
            var unit = units.FirstOrDefault(u => u.cell == cell);
            if (unit != null)
            {
                if (unit.source.side == "ally" && !unit.moved) Select(unit);
                else Deselect();
                return;
            }
            if (selected != null && moveCells.Contains(cell))
            {
                var mover = selected;
                Deselect();
                mover.cell = cell;
                mover.moved = true;
                view.MoveUnit(mover.source.id, cell);
                return;
            }
            Deselect();
        }

        public void Select(string unitId)
        {
            var unit = units.FirstOrDefault(u => u.source.id == unitId);
            if (unit != null) Select(unit);
        }

        private void Select(UnitState unit)
        {
            Deselect();
            selected = unit;
            // 地形の通行（TerrainRules）: 地上は s d g = だけ。飛行は通り抜けられるが、# と t には止まれない
            bool flying = unit.source.flying;
            var range = MoveRange.Compute(unit.cell, unit.source.move, unit.source.side, units, data.cols, data.rows,
                cell => map.CanEnter(cell, flying), cell => map.CanStop(cell, flying), unit);
            foreach (var cell in range) moveCells.Add(cell);
            view.ShowRange(range);
            view.Select(unit.cell);
            view.SetUnitHighlighted(unit.source.id, true);
        }

        public void Deselect()
        {
            if (selected != null) view.SetUnitHighlighted(selected.source.id, false);
            selected = null;
            moveCells.Clear();
            view.ShowRange(null);
            view.ClearSelection();
        }

        /// <summary>敵に狙われている印（キャラのまわりの赤い丸）を出す・消す。敵の行動予告（M1-c）から呼ぶ</summary>
        public void SetTargeted(string unitId, bool targeted) => view.SetTargeted(unitId, targeted);
    }
}
