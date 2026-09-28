using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Srpg.Battle;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// 探索のシーン（Assets/Scenes/Explore3D.unity。プロローグ1-1 計画の段4）を組み立て、
    /// 自室で起きてから訓練場に着くまでを自動で進めて撮る（途中で止まったら失敗にする）。▶で遊ぶときは同じシーンを開く
    /// </summary>
    public static class ExploreBuilder
    {
        private const string ScenePath = "Assets/Scenes/Explore3D.unity";
        private const string MapDir = "Assets/Data/Maps";
        private const string ScenarioPath = "Assets/Data/Scenario/prologue_1_1.json";

        [MenuItem("Srpg/探索のシーンを組み立てて、訓練場まで歩いて撮る")]
        public static void BuildAll()
        {
            try
            {
                int rendererIndex = Board3DTestBuilder.EnsureUniversalRenderer();
                var (explore, camera) = BuildScene(rendererIndex);
                Walkthrough(explore, camera);
                // 保存するシーンは始まる前の状態（盤面は再生したときに作る）
                EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
                Debug.Log("[ExploreBuilder] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        private static (ExploreController, Camera) BuildScene(int rendererIndex)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Board3DTestBuilder.CreateStage(rendererIndex, out var camera, out var light, out _);
            var view = new GameObject("Board3D").AddComponent<Board3DView>();
            Board3DTestBuilder.ConfigureView(view, camera, light, new[] { "arshe", "young_karima" }, buildOnStart: false, startOverview: false);
            var viewSo = new SerializedObject(view);
            viewSo.FindProperty("backdrop").objectReferenceValue = null;   // 城の場所は森の遠景を出さない（城の遠景が届くまで）
            viewSo.FindProperty("showCellInfo").boolValue = false;
            viewSo.ApplyModifiedPropertiesWithoutUndo();
            var dialogue = DialogueBuilder.CreateView(camera);

            var go = new GameObject("Explore");
            var explore = go.AddComponent<ExploreController>();
            var so = new SerializedObject(explore);
            so.FindProperty("view").objectReferenceValue = view;
            so.FindProperty("dialogue").objectReferenceValue = dialogue;
            so.FindProperty("scenarioJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(ScenarioPath);
            var jsons = Directory.GetFiles(MapDir, "*.json").OrderBy(p => p, StringComparer.Ordinal).Select(p => p.Replace(Path.DirectorySeparatorChar, '/')).ToArray();
            var placesProp = so.FindProperty("placeJsons");
            placesProp.arraySize = jsons.Length;
            var groundsProp = so.FindProperty("grounds");
            groundsProp.arraySize = jsons.Length;
            for (int i = 0; i < jsons.Length; i++)
            {
                placesProp.GetArrayElementAtIndex(i).objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(jsons[i]);
                string mapId = Path.GetFileNameWithoutExtension(jsons[i]);
                groundsProp.GetArrayElementAtIndex(i).FindPropertyRelative("mapId").stringValue = mapId;
                groundsProp.GetArrayElementAtIndex(i).FindPropertyRelative("texture").objectReferenceValue = MapLayoutBuilder.GroundOf(mapId);
            }
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorSceneManager.SaveScene(scene, ScenePath);
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Add(new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            return (explore, camera);
        }

        /// <summary>自室 → 剣を取る → 廊下（キャリー・ヘンリー）→ 訓練場。着くまで自動で進めて、要所を撮る</summary>
        private static void Walkthrough(ExploreController explore, Camera camera)
        {
            var rt = new RenderTexture(Board3DTestBuilder.PreviewWidth, Board3DTestBuilder.PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)Board3DTestBuilder.PreviewWidth / Board3DTestBuilder.PreviewHeight;
            ShaderUtil.allowAsyncCompilation = false;
            var dialogue = UnityEngine.Object.FindFirstObjectByType<DialogueView>();
            var view = UnityEngine.Object.FindFirstObjectByType<Board3DView>();
            var log = new List<string>();
            explore.Log += line => { log.Add(line); Debug.Log("[ExploreBuilder] " + line); };
            int shot = 0;

            void Shot(string name)
            {
                view.UpdateBillboards();
                explore.Hud?.Refresh();
                Canvas.ForceUpdateCanvases();
                Board3DTestBuilder.Render(camera, rt, $"Explore_{++shot:00}_{name}");
                var line = dialogue.CurrentLine;
                Debug.Log($"[ExploreBuilder] shot {shot} {name}: {explore.Place?.mapId} {explore.Player} {(dialogue.IsPlaying ? $"{line?.speaker}「{line?.text?.Replace("\n", " ")}」" : "")}");
            }

            void FinishTalk()
            {
                for (int guard = 0; dialogue.IsPlaying && guard < 400; guard++) dialogue.Advance();
            }

            camera.Render();
            explore.Begin();
            Shot("wake");
            FinishTalk();
            Shot("room");

            // 行けないマス（壁）を押した → 赤く光り「そこへは行けない」（レビュー J1）
            explore.Tap(new Vector2Int(0, 0));
            Shot("cannot_go");
            // 剣を取る前に部屋の扉へ → アルシェの一言で止まる（レビュー J3）
            explore.Tap(explore.Place.exits.First(e => e.id == "to_corridor").cells[0].V);
            if (!dialogue.IsPlaying) throw new InvalidOperationException("探索の確認: 剣を持たずに部屋を出られてしまった");
            Shot("door_locked");
            FinishTalk();

            // 剣立てを調べる（必須の調べる所）
            var sword = explore.State.inspect.First(i => i.id == "find_sword");
            explore.Tap(sword.cells[0].V);
            Shot("sword");
            FinishTalk();
            if (!explore.Items.Contains("黒陽の双剣")) throw new InvalidOperationException("探索の確認: 剣を取れなかった");

            // 部屋を出る
            var toCorridor = explore.Place.exits.First(e => e.id == "to_corridor");
            explore.Tap(toCorridor.cells[0].V);
            if (explore.Place.mapId != "orcus_corridor") throw new InvalidOperationException($"探索の確認: 廊下へ出られなかった（{explore.Place.mapId}）");
            Shot("corridor");
            FinishTalk();

            // 訓練場への階段を目指す。途中の会話（キャリー・ヘンリー・井戸端会議）は流して進む
            for (int guard = 0; guard < 12 && explore.Place.mapId == "orcus_corridor"; guard++)
            {
                var toYard = explore.Place.exits.First(e => e.id == "to_yard");
                explore.Tap(toYard.cells[0].V);
                if (dialogue.IsPlaying && explore.Place.mapId == "orcus_corridor")
                {
                    bool carrie = dialogue.CurrentLine?.speaker != "アルシェ";
                    Shot("talk_" + (carrie ? "carrie" : "henry"));
                    FinishTalk();
                    if (carrie)
                    {
                        // キャリーとだけ話して階段へ行ったとき（ヘンリーの前）→ 止める一言（レビュー J3）
                        explore.CheckCellForTest(explore.Place.exits.First(e => e.id == "to_yard").cells[0].V);
                        Shot("stairs_locked");
                        FinishTalk();
                        Shot("corridor_after_carrie");
                    }
                }
            }
            if (explore.Place.mapId != "orcus_training_yard") throw new InvalidOperationException($"探索の確認: 訓練場に着かなかった（{explore.Place.mapId}・{explore.Player}）");
            Shot("yard");
            FinishTalk();
            if (explore.PendingBattleArea != "prologue") throw new InvalidOperationException("探索の確認: 訓練場に着いても戦闘へ進まなかった");
            Shot("to_battle");
            Debug.Log($"[ExploreBuilder] 流したブロック: {string.Join(" ", explore.Seen)} / 持ち物: {string.Join("・", explore.Items)}");
            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
        }
    }
}
