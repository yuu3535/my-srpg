using NUnit.Framework;
using Srpg.Battle;

namespace Srpg.Tests
{
    /// <summary>効果音の一覧（2026-11-18）: se_map.json が読める・ゲームが鳴らす id が全部一覧にある</summary>
    public class SfxTests
    {
        // ゲームのコードが Sfx.Play で呼んでいる id（増やしたらここと se_map.json に足す）
        private static readonly string[] Used =
        {
            "ui_tap", "ui_select", "talk_next", "talk_shout", "item_get", "explore_check", "explore_exit",
            "battle_move", "battle_hit", "battle_crit", "battle_miss", "battle_down", "battle_heal", "phase_ally", "phase_enemy", "battle_victory", "battle_defeat",
        };

        [Test]
        public void EveryUsedIdIsInTheMap()
        {
            Sfx.ResetForTest();
            foreach (var id in Used)
            {
                Assert.IsTrue(Sfx.Map.ContainsKey(id), $"se_map.json に {id} が無い");
                Assert.IsNotEmpty(Sfx.Map[id].name, $"{id} の場面の説明が無い");
            }
        }
    }
}
