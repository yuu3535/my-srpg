using System;

namespace Srpg.Battle.Plan
{
    /// <summary>
    /// 攻撃の選択肢（通常攻撃・物理の戦技・魔法の戦技・魔導書の魔法）。ブラウザ版の landscapeForecastOptions・
    /// trialEnemyAttackOptions の1つ分と同じ（tools/export_unity_battle_ui.mjs が書き出す）
    /// </summary>
    [Serializable]
    public class BattleOption
    {
        public string label;
        public string kind;          // weapon / grimoire / magicArt
        public string artName;       // 戦技の名前（なければ空）
        public string itemId;        // 魔導書の持ち物（grimoire のとき）
        public int rangeMin = 1, rangeMax = 1;
        public bool isArt, isMagic;
        public string area;          // 範囲の攻撃: "adjacent"（円舞・隣接する敵すべて）/ "line"（万雷・直線3マス）。なければ空
        public PlanSpell spell;      // 魔法のとき
        public PlanSpell equipSpell; // 魔導書に持ち替えたときの、装備の魔法

        /// <summary>計画の行動（ブラウザ版 trialPlanAction と同じ）</summary>
        public PlanAction ToAction()
        {
            string art = string.IsNullOrEmpty(artName) ? null : artName;
            return kind == "weapon"
                ? new PlanAction { kind = "weapon", artName = art }
                : new PlanAction { kind = kind, spell = spell, artName = art };
        }

        /// <summary>
        /// 使うときの持ち替え（ブラウザ版 trialPlanPrediction と同じ）: 魔導書の魔法はその魔導書に、
        /// 武器の攻撃は、今の装備が武器でなければ持っている武器に持ち替える
        /// </summary>
        public void ApplyEquip(PlanUnit unit, string weaponItemId)
        {
            if (kind == "grimoire" && !string.IsNullOrEmpty(itemId))
            {
                unit.equippedItem = itemId;
                unit.grimoireSpell = equipSpell;
            }
            else if (kind == "weapon" && !IsWeapon(unit.equippedItem) && !string.IsNullOrEmpty(weaponItemId))
            {
                unit.equippedItem = weaponItemId;
            }
        }

        private static bool IsWeapon(string itemId) =>
            itemId != null && BattlePlan.Items.TryGetValue(itemId, out var item) && item.kind == "weapon";

        public bool InRange(int distance) => distance >= rangeMin && distance <= rangeMax;
        public bool IsArea => !string.IsNullOrEmpty(area);

        /// <summary>予測・一覧に出す名前（魔導書は魔法の名前。例: 仮の魔導書 → 魔弾）</summary>
        public string ActionName => kind == "grimoire" && spell != null && !string.IsNullOrEmpty(spell.name) ? spell.name : label;
    }
}
