using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Srpg.Battle;
using Srpg.Battle.Plan;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// 1手ごとの画像（ゲームレビュー担当の依頼 2026-09-28。引き継ぎ §6）: 試験の戦闘を最初から自動で進め、
    /// 味方は「動いたあと・戦闘予測・攻撃のあと」、敵は「動いたあと・攻撃の前の予測・攻撃のあと」を1枚ずつ撮る。
    /// 味方も敵と同じ評価（BattlePlan.ScoreAttack）で、動く先・相手・攻撃を選ぶ。乱数は決まった種で、毎回同じ戦闘になる。
    /// 画像は unity-prototype/PlaythroughShots/（Git に入れない。数が多いため）。一覧と戦闘の記録は同じ所の playthrough.md。
    /// 先に Battle3DBuilder.BuildAll でシーンを作っておく。
    /// </summary>
    public static class Battle3DPlaythrough
    {
        private const string ScenePath = "Assets/Scenes/Battle3D.unity";
        private const string OutDir = "PlaythroughShots";
        private const int Seed = 20260928;
        private const int MaxTurns = 8;

        [MenuItem("Srpg/Battle3D の1手ごとの画像を撮る")]
        public static void Run()
        {
            try
            {
                Shoot();
                Debug.Log("[Battle3DPlaythrough] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        private static void Shoot()
        {
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            var controller = UnityEngine.Object.FindFirstObjectByType<Battle3DController>();
            var hud = UnityEngine.Object.FindFirstObjectByType<Battle3DHud>();
            var view = controller.View;
            var camera = UnityEngine.Object.FindFirstObjectByType<Camera>();
            if (controller == null || hud == null || camera == null) throw new InvalidOperationException("Battle3D のシーンが組み立てられていない");

            if (Directory.Exists(OutDir)) foreach (var old in Directory.GetFiles(OutDir, "*.png")) File.Delete(old);
            Directory.CreateDirectory(OutDir);
            var rt = new RenderTexture(Board3DTestBuilder.PreviewWidth, Board3DTestBuilder.PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)Board3DTestBuilder.PreviewWidth / Board3DTestBuilder.PreviewHeight;
            ShaderUtil.allowAsyncCompilation = false;

            controller.Setup();
            view.SetView(true, 0, true);
            view.SetOverview(false, true);
            controller.FocusOnAllies(true);
            hud.Build();
            controller.RollsOverride = new RandomRolls(new System.Random(Seed));
            camera.Render();   // 最初の1枚は陰影の準備が間に合わず暗くなるので、一度空撮りする

            var md = new StringBuilder();
            md.AppendLine("# 1手ごとの画像（Battle3D・試験の戦闘）");
            md.AppendLine();
            md.AppendLine($"撮った日時: {DateTime.Now:yyyy-MM-dd HH:mm} / 乱数の種: {Seed} / 味方も敵と同じ評価で自動で動く");
            md.AppendLine("画像は同じフォルダ。名前は `t<ターン>_<番号>_<キャラ>_<場面>.png`（場面: moved＝動いたあと・forecast＝戦闘予測・preview＝敵の攻撃の前の予測・acted＝行動のあと）");
            md.AppendLine();
            int logSeen = controller.LogTotal, shotNo = 0;

            void Shot(string unitId, string stage)
            {
                shotNo++;
                string name = $"t{controller.Turn}_{shotNo:000}_{unitId}_{stage}";
                hud.Refresh();
                hud.UpdateOverlays();
                hud.UpdateTerrain();
                Canvas.ForceUpdateCanvases();
                Board3DTestBuilder.Render(camera, rt, name, dir: OutDir);
                int fresh = Math.Min(controller.LogTotal - logSeen, controller.Log.Count);
                var lines = controller.Log.Skip(controller.Log.Count - fresh).ToList();
                logSeen = controller.LogTotal;
                md.AppendLine($"- `{name}.png`" + (lines.Count > 0 ? "：" + string.Join(" / ", lines) : ""));
            }

            controller.EnemyStepHook = (stage, enemy) => Shot(enemy.Id, stage);
            controller.AutoEndTurn = false;
            Shot("start", "turn");
            while (controller.CurrentPhase == Battle3DController.Phase.Ally && controller.Turn <= MaxTurns)
            {
                md.AppendLine();
                md.AppendLine($"## ターン {controller.Turn}");
                int turn = controller.Turn;
                var order = controller.Units.Where(u => u.Side == "ally").Select(u => u.Id).ToList();
                foreach (var id in order)
                {
                    var unit = controller.Units.FirstOrDefault(u => u.Id == id);
                    if (unit == null || !unit.Alive || unit.acted || controller.CurrentPhase != Battle3DController.Phase.Ally || controller.Turn != turn) continue;
                    ActAlly(controller, unit, Shot);
                }
                // 味方が全員行動したらターン終了（敵の番は EnemyStepHook で1人ずつ撮る）
                if (controller.CurrentPhase == Battle3DController.Phase.Ally && controller.Turn == turn) controller.EndTurn();
                if (controller.CurrentPhase == Battle3DController.Phase.Ally)
                {
                    controller.FocusOnAllies(true);
                    Shot("start", "turn");
                }
            }
            controller.EnemyStepHook = null;
            controller.AutoEndTurn = true;
            controller.RollsOverride = null;

            string result = controller.CurrentPhase == Battle3DController.Phase.Victory ? $"勝利（ターン{controller.Turn}）"
                : controller.CurrentPhase == Battle3DController.Phase.Defeat ? $"敗北（ターン{controller.Turn}）"
                : $"決着せず（ターン{MaxTurns}まで）";
            view.SetOverview(true, true);
            Shot("end", "result");
            md.AppendLine();
            md.AppendLine($"## 結果: {result}");
            foreach (var u in controller.Units)
                md.AppendLine($"- {u.Name}（{u.Side}）: HP {u.plan?.hp}/{u.plan?.maxHp}{(u.Alive ? "" : "・倒れた")}");
            File.WriteAllText(Path.Combine(OutDir, "playthrough.md"), md.ToString(), new UTF8Encoding(false));
            Debug.Log($"[Battle3DPlaythrough] {result}・{shotNo}枚");

            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
            hud.Clear();
            view.ClearBoard();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);   // 変えた状態を保存しないよう、開き直す
        }

        /// <summary>味方1人の行動: 攻撃できるなら一番よい立ち位置から攻撃、できなければいちばん近い敵へ近づいて待機</summary>
        private static void ActAlly(Battle3DController controller, Battle3DController.UnitState unit, Action<string, string> shot)
        {
            controller.Select(unit.Id);
            var (cell, target, option) = controller.SuggestAttack(unit);
            if (target == null) cell = controller.SuggestApproach(unit);
            if (!controller.MoveCells.Contains(cell)) cell = unit.cell;   // 動けない（封じ・範囲外）ときはその場
            controller.TapCell(cell);   // 今のマスを押しても「動いた」扱いで行動を選ぶ段へ
            shot(unit.Id, "moved");
            if (target != null && option != null)
            {
                controller.ChooseOption(option);
                controller.TapCell(target.cell);
                if (controller.CurrentMode == Battle3DController.Mode.Forecast)
                {
                    shot(unit.Id, "forecast");
                    controller.ConfirmAttack();
                    shot(unit.Id, "acted");
                    return;
                }
                controller.CancelTargeting();
            }
            if (!unit.acted) controller.ChooseWait();
        }
    }
}
