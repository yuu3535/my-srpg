using System;
using System.IO;
using System.Linq;
using Srpg.Battle;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// Unity版の戦闘（M1）を3Dの盤面で動かすシーンを組み立てる（Claude Code がコマンドから実行する）。
    ///
    ///   Unity.exe -batchmode -projectPath unity-prototype -executeMethod Srpg.EditorAgent.Battle3DBuilder.BuildAll -quit -logFile -
    ///
    /// 原作者 2026-09-27: マップは3Dの盤面に置き換える（docs/10-design/map/MAP_BOARD_METHOD_DECISION_2026-09-27.md）。
    /// 1. 3D用の描画設定・模様・陣営の枠・木の絵を用意する（Board3DTestBuilder と同じもの）
    /// 2. シーン Assets/Scenes/Battle3D.unity を作り直し、ビルドの最初のシーンにする（2Dの BattleM1 は残す）
    /// 3. Assets/Previews/Battle3D_*.png を書き出す（全体・アルシェを選んだところ・動かしたところ・狙われた印・真上）
    /// データは tools/export_unity_battle.js（ブラウザ版から書き出し）で用意しておく。
    /// </summary>
    public static class Battle3DBuilder
    {
        private const string DataPath = "Assets/Data/Battles/battle_trial_adopted.json";
        private const string ScenePath = "Assets/Scenes/Battle3D.unity";

        public static void BuildAll()
        {
            try
            {
                int rendererIndex = Board3DTestBuilder.EnsureUniversalRenderer();
                Board3DTestBuilder.WriteTreePicture();
                Board3DTestBuilder.CopyUiFrames();
                BuildScene(rendererIndex);
                Debug.Log("[Battle3DBuilder] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        private static void BuildScene(int rendererIndex)
        {
            var data = JsonUtility.FromJson<BattleDataFile>(File.ReadAllText(DataPath));
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Board3DTestBuilder.CreateStage(rendererIndex, out var camera, out var light, out _);

            var viewObject = new GameObject("Board3D");
            var view = viewObject.AddComponent<Board3DView>();
            Board3DTestBuilder.ConfigureView(view, camera, light, data.units.Select(u => u.id), buildOnStart: false);

            var controllerObject = new GameObject("Battle3D");
            var controller = controllerObject.AddComponent<Battle3DController>();
            var so = new SerializedObject(controller);
            so.FindProperty("battleJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(DataPath);
            so.FindProperty("view").objectReferenceValue = view;
            so.ApplyModifiedPropertiesWithoutUndo();

            // 見え方は T5 の C を原作の素材の色に寄せたもの（MAP_COLOR_MOOD_DIRECTION_2026-09-27.md）
            Board3DTestBuilder.SetMoodC2();
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;

            var rt = new RenderTexture(Board3DTestBuilder.PreviewWidth, Board3DTestBuilder.PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)Board3DTestBuilder.PreviewWidth / Board3DTestBuilder.PreviewHeight;
            ShaderUtil.allowAsyncCompilation = false;

            controller.Setup();
            view.SetView(true, 0, true);
            camera.Render();   // 最初の1枚は陰影の準備が間に合わず暗くなるので、一度空撮りする
            Board3DTestBuilder.Render(camera, rt, "Battle3D_board");

            // アルシェのマスを画面上で押して選ぶ → 移動範囲が出る
            var arshe = controller.Units.First(u => u.source.id == "arshe");
            TapOnScreen(view, camera, arshe.cell);
            if (controller.Selected != arshe) throw new InvalidOperationException("アルシェを押して選べなかった");
            Board3DTestBuilder.Render(camera, rt, "Battle3D_select");

            // 2マス奥を押して動かす
            var dest = arshe.cell + new Vector2Int(0, -2);
            TapOnScreen(view, camera, dest);
            if (arshe.cell != dest) throw new InvalidOperationException("移動範囲のマスを押して動かせなかった");
            // 敵に狙われている印（赤い丸）
            controller.SetTargeted("ringholm", true);
            view.SetCloseView(30f, -45f, view.Map.TopCenter(new Vector2Int(4, 5)) + Vector3.up * 0.4f, 2.6f);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_moved_targeted");
            controller.SetTargeted("ringholm", false);

            view.SetView(false, 0, true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_top");
            view.SetView(true, 2, true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_turn180");

            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
            view.ClearBoard();   // 盤面は再生したときに作る（作ったマテリアルはシーンに保存できないため）
            EditorSceneManager.SaveScene(scene, ScenePath);

            // 3Dの戦闘を最初のシーンにする（2Dの斜めの絵の BattleM1 は比べるために残す）
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            AssetDatabase.SaveAssets();
        }

        /// <summary>画面上でそのマスを押したことにする（押す判定から戦闘の処理までを通して確かめる）</summary>
        private static void TapOnScreen(Board3DView view, Camera camera, Vector2Int cell)
        {
            var screen = view.CellToScreen(cell);
            if (!view.TryPickCell(screen, out var picked) || picked != cell)
                throw new InvalidOperationException($"マス {cell} を押せなかった（{picked}）");
            // ▶で押したときと同じく、押したマスを戦闘の処理へ渡す（CellTapped → Battle3DController.TapCell）
            UnityEngine.Object.FindFirstObjectByType<Battle3DController>().TapCell(picked);
        }
    }
}
