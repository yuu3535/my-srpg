using System.Collections;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using Srpg.Battle.Plan;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

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

            // 敵の行動予告: 敵ごとに行動を決め、狙われた味方にだけ赤い丸を出す（ブラウザ版と同じ）
            Assert.AreEqual(controller.Units.Count(u => u.Side == "enemy"), controller.Declarations.Count, "敵全員の行動予告がある");
            var declaredTargets = controller.Declarations.Values.Where(d => d.type == "attack").Select(d => d.targetId).ToList();
            foreach (var ally in controller.Units.Where(u => u.Side == "ally"))
                Assert.AreEqual(declaredTargets.Contains(ally.Id), controller.View.IsTargeted(ally.Id), $"{ally.Name}の赤い丸");

            // アルシェ: 選ぶ → 動く → 待機
            var arshe = controller.Units.First(u => u.source.id == "arshe");
            var start = arshe.cell;
            controller.TapCell(start);
            Assert.AreSame(arshe, controller.Selected, "アルシェのマスを押すと選ばれる");
            Assert.Greater(controller.View.RangeCount, 0, "移動範囲が出る");
            var dest = controller.MoveCells.OrderBy(c => c.y).ThenBy(c => Mathf.Abs(c.x - start.x)).First();
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
            controller.TeleportForTest("albas_rival", albas.cell + new Vector2Int(0, -3));   // 橋の向こうの近くに置く
            controller.TapCell(albas.cell);
            controller.TapCell(albas.cell + new Vector2Int(0, -2));
            controller.ChooseAttack();
            Assert.AreEqual(Battle3DController.Mode.Targeting, controller.CurrentMode);
            controller.TapCell(rival.cell);
            Assert.AreEqual(Battle3DController.Mode.Forecast, controller.CurrentMode, "敵を押すと戦闘予測が出る");
            var forecast = controller.CurrentForecast;
            Assert.IsNotNull(forecast.first);
            // 届く攻撃が2つ以上あれば、予測で切り替えられる（戻すと同じ予測）
            if (controller.ForecastOptions.Count > 1)
            {
                var first = controller.CurrentOption;
                controller.CycleForecastOption(1);
                Assert.AreNotSame(first, controller.CurrentOption, "‹ › で攻撃を切り替える");
                controller.CycleForecastOption(-1);
                Assert.AreSame(first, controller.CurrentOption);
                forecast = controller.CurrentForecast;
            }
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

        /// <summary>補助の魔法（回復・加速）: 届く味方を選んで使う</summary>
        [UnityTest]
        public IEnumerator SupportMagic()
        {
            SceneManager.LoadScene("Battle3D");
            yield return null;
            yield return null;
            var controller = Object.FindFirstObjectByType<Battle3DController>();
            controller.RollsOverride = new ForecastRolls();
            var albas = controller.Units.First(u => u.Id == "albas");
            var ringholm = controller.Units.First(u => u.Id == "ringholm");
            ringholm.plan.hp = 5;

            // 回復: 範囲の味方を押すと、回復量（6＋魔攻÷4）×3 だけ回復し、アルバスは行動済み
            controller.Select("albas");
            var heal = controller.SupportsOf(albas).First(o => o.label == "回復");
            Assert.IsTrue(controller.CanSupportFromHere(heal), "回復が届く味方がいる");
            int mpBefore = albas.plan.mp;
            controller.ChooseSupport(heal);
            Assert.AreEqual(Battle3DController.Mode.Support, controller.CurrentMode);
            var target = controller.Units.Where(u => u.Side == "ally" && u.Alive && Mathf.Abs(u.cell.x - albas.cell.x) + Mathf.Abs(u.cell.y - albas.cell.y) <= heal.rangeMax)
                .OrderBy(u => u.plan.hp).First();
            int hpBefore = target.plan.hp;
            controller.TapCell(target.cell);
            int expected = Mathf.Min(target.plan.maxHp, hpBefore + (6 + albas.plan.stats.mag / 4) * 3);
            Assert.AreEqual(expected, target.plan.hp, "回復量");
            Assert.Less(albas.plan.mp, mpBefore, "MPを払う");
            Assert.IsTrue(albas.acted, "回復したら行動済み");

            // 加速を自分に: そのまま続けて行動できる
            albas.acted = false;
            albas.moved = false;
            controller.Select("albas");
            var haste = controller.SupportsOf(albas).First(o => o.label == "加速");
            controller.ChooseSupport(haste);
            controller.TapCell(albas.cell);
            Assert.IsFalse(albas.acted, "加速を自分に使うと、もう一度行動できる");
            Assert.AreSame(albas, controller.Selected);

            // 転移: 味方を選んで、空いているマスへ移す
            var transfer = controller.SupportsOf(albas).First(o => o.label == "転移");
            controller.ChooseSupport(transfer);
            controller.TapCell(ringholm.cell);
            Assert.AreSame(ringholm, controller.TransferAlly, "1段目で味方を選ぶ");
            var dest = controller.TargetCells.OrderBy(c => Mathf.Abs(c.x - ringholm.cell.x) + Mathf.Abs(c.y - ringholm.cell.y)).First();
            controller.TapCell(dest);
            Assert.AreEqual(dest, ringholm.cell, "2段目で選んだマスへ移る");
            Assert.IsTrue(albas.acted);
            controller.RollsOverride = null;
        }

        /// <summary>封印（敵が対象・命中の判定あり）: 当たると、その敵は相手の次の番まで動けない</summary>
        [UnityTest]
        public IEnumerator SealStopsMovement()
        {
            SceneManager.LoadScene("Battle3D");
            yield return null;
            yield return null;
            var controller = Object.FindFirstObjectByType<Battle3DController>();
            controller.RollsOverride = new FixedRolls(new[] { 1, 1, 1, 1 }, new[] { 3, 3, 3 });   // 必ず当たる
            var arshe = controller.Units.First(u => u.Id == "arshe");
            controller.Select("arshe");
            var seal = controller.SupportsOf(arshe).First(o => o.label == "封印");
            Assert.IsTrue(controller.CanSupportFromHere(seal));
            controller.ChooseSupport(seal);
            var foe = controller.Units.Where(u => u.Side == "enemy" && u.Alive)
                .OrderBy(u => Mathf.Abs(u.cell.x - arshe.cell.x) + Mathf.Abs(u.cell.y - arshe.cell.y)).First();
            controller.TapCell(foe.cell);
            Assert.IsTrue(foe.plan.statusEffects.Any(e => e.type == "immobilize"), "封印が当たる");
            Assert.IsTrue(arshe.acted);
            controller.RollsOverride = null;
        }

        /// <summary>消耗品: 止まったマスで拾い、移動を取り消すと戻り、「持ち物」で使う（ブラウザ版と同じ）</summary>
        [UnityTest]
        public IEnumerator PickUpAndUseItem()
        {
            SceneManager.LoadScene("Battle3D");
            yield return null;
            yield return null;
            var controller = Object.FindFirstObjectByType<Battle3DController>();
            var spot = controller.MapItems.Keys.First();
            var ringholm = controller.Units.First(u => u.Id == "ringholm");
            ringholm.plan.hp = 10;

            controller.Select("ringholm");
            controller.TapCell(spot);
            Assert.AreEqual(1, ringholm.items.Count, "止まったマスの物を拾う");
            Assert.IsFalse(controller.MapItems.ContainsKey(spot));
            controller.UndoMove();
            Assert.AreEqual(0, ringholm.items.Count, "移動を取り消すと物もマスへ戻る");
            Assert.IsTrue(controller.MapItems.ContainsKey(spot));

            controller.TapCell(spot);
            int value = ringholm.items[0].value;
            controller.UseItem(0);
            Assert.AreEqual(10 + value, ringholm.plan.hp, "使うと回復する");
            Assert.AreEqual(0, ringholm.items.Count);
            Assert.IsTrue(ringholm.acted, "使うと行動済み");
        }

        /// <summary>画面のUI（コマンド一覧）のボタンで操作する</summary>
        [UnityTest]
        public IEnumerator PlayWithHudButtons()
        {
            SceneManager.LoadScene("Battle3D");
            yield return null;
            yield return null;

            var controller = Object.FindFirstObjectByType<Battle3DController>();
            var hud = controller.Hud;
            Assert.IsNotNull(hud, "画面のUIがある");
            Assert.IsTrue(hud.Built, "▶で画面のUIを作る");
            Button Command(string label) => hud.GetComponentsInChildren<Button>(true).FirstOrDefault(b => b.name == "Command_" + label);

            Assert.IsTrue(hud.StatusOpen, "戦闘の始まりに戦況の画面を出す");
            hud.CloseStatus();
            hud.Refresh();
            Assert.IsNotNull(Command("ターン終了"), "誰も選んでいないときは「ターン終了」");
            Command("戦況").onClick.Invoke();
            Assert.IsTrue(hud.StatusOpen, "「戦況」で戦況の画面を開く");
            hud.CloseStatus();
            hud.Refresh();

            // 魔導書を持つアルバス: 選んだだけで「魔法」を押すと、その場に止まって相手を選ぶ
            controller.Select("albas");
            hud.Refresh();
            Assert.IsNotNull(Command("魔法"), "魔導書を持つアルバスは「魔法」");
            Assert.IsNull(Command("攻撃"), "武器を持たないアルバスに「攻撃」はない（ブラウザ版と同じ）");
            Assert.IsNotNull(Command("待機"));
            Command("魔法").onClick.Invoke();
            hud.Refresh();
            Assert.IsNotNull(Command("破壊"), "「魔法」で魔法の一覧に入れ替わる");
            Assert.IsNotNull(Command("回復"), "使えない魔法も一覧に出す");
            Command("破壊").onClick.Invoke();
            Assert.AreEqual(Battle3DController.Mode.Targeting, controller.CurrentMode);
            Assert.AreEqual("破壊", controller.CurrentOption.label);
            hud.Refresh();
            Command("取り消し").onClick.Invoke();
            Assert.AreEqual(Battle3DController.Mode.Acting, controller.CurrentMode, "取り消すとコマンドを選ぶところへ戻る");
            hud.Refresh();
            Command("待機").onClick.Invoke();
            Assert.IsTrue(controller.Units.First(u => u.Id == "albas").acted, "待機で行動済み");

            // 剣を持つアルシェ: 「攻撃」。動いたら「戻る」で動く前のマスへ
            var arshe = controller.Units.First(u => u.Id == "arshe");
            var start = arshe.cell;
            controller.Select("arshe");
            controller.TapCell(controller.MoveCells.First(c => c != start));
            hud.Refresh();
            Assert.IsNotNull(Command("攻撃"), "剣を持つアルシェは「攻撃」");
            Command("戻る").onClick.Invoke();
            Assert.AreEqual(start, arshe.cell, "「戻る」で動く前のマスへ");
            Assert.AreEqual(Battle3DController.Mode.Moving, controller.CurrentMode);
        }
    }
}
