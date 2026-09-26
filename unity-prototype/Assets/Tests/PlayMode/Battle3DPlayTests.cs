using System.Collections;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using Srpg.Battle.Plan;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>▶（Play）で3Dの盤面の戦闘を動かす: 選ぶ・動かす・攻撃（戦闘予測どおり）・敵の番・回したあとの押す判定</summary>
    public class Battle3DPlayTests
    {
        [UnityTest]
        public IEnumerator PlayOneTurnOn3DBoard()
        {
            SceneManager.LoadScene("Battle3D");
            yield return null;
            yield return null;

            var controller = Object.FindFirstObjectByType<Battle3DController>();
            Assert.IsNotNull(controller, "Battle3DController がない");
            Assert.AreEqual(8, controller.Units.Count);   // 味方4人（カリマを含む）と敵4人
            Assert.IsTrue(controller.Units.All(u => u.plan != null), "全員に戦闘の状態（能力値・装備）がある");
            Assert.IsTrue(controller.View.Tilted, "斜め見下ろしで始まる");

            // 狙われている印（赤い丸）は、ふだんは出さず、狙われたときだけ出す
            Assert.IsFalse(controller.View.IsTargeted("arshe"));
            controller.SetTargeted("arshe", true);
            Assert.IsTrue(controller.View.IsTargeted("arshe"));
            controller.SetTargeted("arshe", false);

            // アルシェ: 選ぶ → 動く → 待機
            var arshe = controller.Units.First(u => u.source.id == "arshe");
            var start = arshe.cell;
            controller.TapCell(start);
            Assert.AreSame(arshe, controller.Selected, "アルシェのマスを押すと選ばれる");
            Assert.Greater(controller.View.RangeCount, 0, "移動範囲が出る");
            var dest = start + new Vector2Int(0, -2);
            controller.TapCell(dest);
            Assert.AreEqual(dest, arshe.cell, "移動範囲のマスを押すと動く");
            Assert.AreEqual(Battle3DController.Mode.Acting, controller.CurrentMode, "動いたら「攻撃／待機」を選ぶ");
            controller.ChooseWait();
            Assert.IsTrue(arshe.acted);
            Assert.IsNull(controller.Selected);
            controller.TapCell(dest);
            Assert.IsNull(controller.Selected, "行動済みは選べない");

            // アルバス: 2マス奥へ動いて、敵のアルバスを攻撃（戦闘予測どおりの結果になる）
            var albas = controller.Units.First(u => u.source.id == "albas");
            var rival = controller.Units.First(u => u.source.id == "albas_rival");
            controller.TapCell(albas.cell);
            controller.TapCell(albas.cell + new Vector2Int(0, -2));
            controller.ChooseAttack();
            Assert.AreEqual(Battle3DController.Mode.Targeting, controller.CurrentMode);
            controller.TapCell(rival.cell);
            Assert.AreEqual(Battle3DController.Mode.Forecast, controller.CurrentMode, "敵を押すと戦闘予測が出る");
            var forecast = controller.CurrentForecast;
            Assert.IsNotNull(forecast.first);
            controller.RollsOverride = new ForecastRolls();
            controller.ConfirmAttack();
            Assert.AreEqual(forecast.defenderHpAfter, rival.plan.hp, "予測どおりのHPになる");
            Assert.AreEqual(forecast.attackerHpAfter, albas.plan.hp, "反撃も予測どおり");
            Assert.IsTrue(albas.acted);
            controller.RollsOverride = null;

            // 敵の番: 終わると味方の番（ターン2）に戻る
            controller.EndTurn();
            Assert.AreEqual(Battle3DController.Phase.Enemy, controller.CurrentPhase);
            float waited = 0f;
            while (controller.CurrentPhase == Battle3DController.Phase.Enemy && waited < 20f)
            {
                waited += Time.deltaTime;
                yield return null;
            }
            Assert.AreEqual(Battle3DController.Phase.Ally, controller.CurrentPhase, "敵の番が終わる");
            Assert.AreEqual(2, controller.Turn);
            Assert.IsTrue(controller.Units.Where(u => u.Side == "ally").All(u => !u.acted), "味方はまた動ける");

            // 正面（45°）・90°・真上に回しても、押す判定は変わらない（キャラの体を押したらそのキャラのマス）
            foreach (var (tilted, turn) in new[] { (true, 1), (true, 2), (false, 0) })
            {
                controller.View.SetView(tilted, turn, true);
                Assert.IsTrue(controller.View.TryPickCell(controller.View.CellToScreen(dest), out var picked));
                Assert.AreEqual(dest, picked, $"マスの中心（{(tilted ? "斜め" : "真上")}・{turn}）");
                Assert.IsTrue(controller.View.TryPickCell(controller.View.UnitHeadToScreen("arshe") + new Vector3(0f, -20f, 0f), out var body));
                Assert.AreEqual(arshe.cell, body, "キャラの体を押すと、そのキャラのマス");
            }
        }
    }
}
