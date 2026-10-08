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
    /// <summary>
    /// ▶で戦闘のあと（2026-10-08）: 負けると「やり直す」の画面 → 最初の配置からもう一度。勝つと結果の画面 →「次へ」で探索へ戻る
    /// </summary>
    public class BattleAftermathPlayTests
    {
        [TearDown]
        public void TearDown() => BattleResultView.Close();

        private static IEnumerator WaitForResult(DialogueView dialogue)
        {
            for (float t = 0f; t < 8f && !BattleResultView.IsOpen; t += Time.unscaledDeltaTime)
            {
                if (dialogue != null && dialogue.IsPlaying) dialogue.Close();   // 手引きの締めの会話
                yield return null;
            }
        }

        private static IEnumerator StartTrainingBattle(System.Action<ExploreController, Battle3DController, DialogueView> got)
        {
            SceneManager.LoadScene("Explore3D");
            yield return null;
            yield return null;
            var explore = Object.FindFirstObjectByType<ExploreController>();
            var dialogue = Object.FindFirstObjectByType<DialogueView>();
            for (int i = 0; i < 100 && dialogue.IsPlaying; i++) dialogue.Close();
            explore.EnterPlace("orcus_training_yard", null, null);
            yield return null;
            for (int i = 0; i < 100 && dialogue.IsPlaying; i++) dialogue.Close();
            explore.StartBattle("prologue");
            yield return null;
            for (int i = 0; i < 100 && dialogue.IsPlaying; i++) dialogue.Close();
            got(explore, explore.Battle, dialogue);
        }

        [UnityTest]
        public IEnumerator DefeatOffersRetryFromTheStart()
        {
            ExploreController explore = null; Battle3DController battle = null; DialogueView dialogue = null;
            yield return StartTrainingBattle((e, b, d) => { explore = e; battle = b; dialogue = d; });
            Assert.IsTrue(explore.InBattle);
            var startCells = battle.Units.ToDictionary(u => u.Id, u => u.cell);

            foreach (var u in battle.Units.Where(u => u.Side == "ally")) u.plan.hp = 0;
            battle.EvaluateEnd();
            Assert.AreEqual(Battle3DController.Phase.Defeat, battle.CurrentPhase);
            yield return WaitForResult(dialogue);
            Assert.IsTrue(BattleResultView.IsOpen, "負けたあとの画面が出ない");
            Assert.IsTrue(explore.InBattle, "負けた画面の間は戦闘のまま");

            BattleResultView.Retry();
            yield return null;
            Assert.IsFalse(BattleResultView.IsOpen);
            Assert.IsTrue(explore.InBattle, "やり直すと戦闘が続く");
            Assert.AreEqual(Battle3DController.Phase.Ally, battle.CurrentPhase);
            Assert.AreEqual(1, battle.Turn);
            Assert.IsTrue(battle.Units.Where(u => u.Side == "ally").All(u => u.Alive), "味方が元に戻っていない");
            foreach (var u in battle.Units) Assert.AreEqual(startCells[u.Id], u.cell, $"{u.Name} が最初の位置にいない");
        }

        /// <summary>成長（2026-10-09）: 仲間の育ちが戦闘の能力に足され、倒すと経験値が入り、勝つと仲間に入る</summary>
        [UnityTest]
        public IEnumerator GrowthCarriesIntoBattleAndExpIsEarned()
        {
            Party.Reset();
            // 先に育っていたことにする: アルシェの力が期待値より+5
            var grown = Party.Ensure("young_arshe", 1);
            grown.stats.atk += 5;
            ExploreController explore = null; Battle3DController battle = null; DialogueView dialogue = null;
            yield return StartTrainingBattle((e, b, d) => { explore = e; battle = b; dialogue = d; });
            var arshe = battle.Units.First(u => u.Id == "young_arshe");
            Assert.AreEqual(ExportedAtk("young_arshe") + 5, arshe.plan.stats.atk, "育った分が戦闘の力に足されていない");
            Assert.IsNotNull(Party.Find("young_karima"), "初めて出たカリマが仲間に加わる");

            // 人形の隣で、必ず当たる攻撃 → 倒す
            var doll = battle.Units.First(u => u.Id == "training_doll_1");
            doll.plan.hp = 1;
            battle.TeleportForTest("young_arshe", doll.cell + Vector2Int.down);
            battle.RollsOverride = new FixedRolls(new[] { 1, 1, 1, 1 }, new[] { 99, 99, 99 });
            battle.Select("young_arshe");
            battle.ChooseAttack();
            battle.TapCell(doll.cell);
            battle.ConfirmAttack();
            battle.RollsOverride = null;
            for (int i = 0; i < 100 && dialogue.IsPlaying; i++) dialogue.Close();
            Assert.IsFalse(doll.Alive, "人形を倒せていない");
            Assert.GreaterOrEqual(battle.ExpEarned(arshe), Growth.KillExp(1, 1), "倒した経験値が入っていない");

            for (int round = 0; round < 6 && battle.CurrentPhase != Battle3DController.Phase.Victory; round++)
            {
                foreach (var u in battle.Units.Where(u => u.Side == "enemy")) u.plan.hp = 0;
                battle.EvaluateEnd();
                for (float t = 0f; t < 3f && battle.CurrentPhase != Battle3DController.Phase.Victory && !battle.Units.Any(u => u.Side == "enemy" && u.Alive); t += Time.unscaledDeltaTime)
                {
                    if (dialogue.IsPlaying) dialogue.Close();
                    yield return null;
                }
            }
            Assert.AreEqual(Battle3DController.Phase.Victory, battle.CurrentPhase);
            var result = battle.Summary().growth.Single(g => g.id == "young_arshe");
            Assert.GreaterOrEqual(result.exp, Growth.KillExp(1, 1));
            var member = Party.Find("young_arshe");
            Assert.AreEqual(result.levelAfter, member.level);
            Assert.AreEqual(result.exp, (member.level - 1) * Growth.ExpPerLevel + member.exp, "仲間に経験値が入っていない");
            Party.Reset();
        }

        /// <summary>書き出した戦闘のデータの力（育ちを足す前）</summary>
        private static int ExportedAtk(string id)
        {
            var path = System.IO.Path.Combine(Application.dataPath, "Data/Battles/battle_prologue_training_plan.json");
            var file = JsonUtility.FromJson<PlanStateFile>(System.IO.File.ReadAllText(path));
            return file.units.First(u => u.id == id).stats.atk;
        }

        [UnityTest]
        public IEnumerator VictoryShowsResultThenGoesOn()
        {
            ExploreController explore = null; Battle3DController battle = null; DialogueView dialogue = null;
            yield return StartTrainingBattle((e, b, d) => { explore = e; battle = b; dialogue = d; });
            // 訓練は人形のあとにギュンターが入ってくる（控えの敵）。入ってきたら、また倒す
            for (int round = 0; round < 6 && battle.CurrentPhase != Battle3DController.Phase.Victory; round++)
            {
                foreach (var u in battle.Units.Where(u => u.Side == "enemy")) u.plan.hp = 0;
                battle.EvaluateEnd();
                for (float t = 0f; t < 3f && battle.CurrentPhase != Battle3DController.Phase.Victory && !battle.Units.Any(u => u.Side == "enemy" && u.Alive); t += Time.unscaledDeltaTime)
                {
                    if (dialogue.IsPlaying) dialogue.Close();
                    yield return null;
                }
            }
            Assert.AreEqual(Battle3DController.Phase.Victory, battle.CurrentPhase);
            var summary = battle.Summary();
            Assert.AreEqual(summary.enemiesTotal, summary.enemiesDefeated);
            yield return WaitForResult(dialogue);
            Assert.IsTrue(BattleResultView.IsOpen, "勝ったあとの結果の画面が出ない");

            BattleResultView.Next();
            yield return null;
            Assert.IsFalse(explore != null && explore.InBattle, "「次へ」で探索に戻らない");
        }
    }
}
