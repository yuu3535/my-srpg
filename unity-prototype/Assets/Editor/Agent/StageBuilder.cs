using System;
using System.IO;
using Srpg.Stage;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// 2Dの背景を舞台にする試作（StageFromImage）の場面を組み立て、確認の画像を撮る（2026-10-07）。
    /// バッチ: -executeMethod Srpg.EditorAgent.StageBuilder.Build
    /// 舞台のデータは tools/stage_from_image.py が作る。VRM は Assets/LocalOnly/（Git に入らない）。場面は本編・Web版のビルドに入れない
    /// </summary>
    public static class StageBuilder
    {
        private const string Name = "orcus_audience_hall";
        private static string Dir => $"Assets/Art/Stage/{Name}";
        private const string ScenePath = "Assets/Scenes/StageTest.unity";

        public static void Build()
        {
            try
            {
                Configure($"{Dir}/background.png", linear: false, readable: true);
                Configure($"{Dir}/occlusion.png", linear: true, readable: false);
                AssetDatabase.ImportAsset($"{Dir}/stage.json", ImportAssetOptions.ForceSynchronousImport);

                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                int rendererIndex = Board3DTestBuilder.EnsureUniversalRenderer();   // 2D 用ではなく 3D の描き方（盤面と同じ）
                var camGo = new GameObject("Main Camera", typeof(Camera));
                camGo.tag = "MainCamera";
                var camera = camGo.GetComponent<Camera>();
                camGo.AddComponent<UniversalAdditionalCameraData>().SetRenderer(rendererIndex);
                var lightGo = new GameObject("Key Light", typeof(Light));
                var light = lightGo.GetComponent<Light>();
                light.type = LightType.Directional;
                light.color = new Color(1f, 0.74f, 0.5f);   // 手前の燭台の暖かい光
                light.intensity = 0.32f;
                lightGo.transform.rotation = Quaternion.Euler(38f, 24f, 0f);   // 手前の左上から奥へ
                var stageGo = new GameObject("Stage");
                var stage = stageGo.AddComponent<StageFromImage>();
                var so = new SerializedObject(stage);
                so.FindProperty("stageJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>($"{Dir}/stage.json");
                so.FindProperty("background").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Texture2D>($"{Dir}/background.png");
                so.FindProperty("occlusion").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Texture2D>($"{Dir}/occlusion.png");
                so.FindProperty("backgroundShader").objectReferenceValue = Shader.Find("Srpg/StageBackground");
                so.FindProperty("toonShader").objectReferenceValue = Shader.Find("Srpg/StageToon");
                so.FindProperty("blobShader").objectReferenceValue = Shader.Find("Srpg/StageBlob");
                so.FindProperty("targetCamera").objectReferenceValue = camera;
                so.FindProperty("keyLight").objectReferenceValue = light;
                so.ApplyModifiedPropertiesWithoutUndo();
                EditorSceneManager.SaveScene(scene, ScenePath);   // キャラは遊ぶときに読む（場面には入れない）

                // 確認の画像: 場面の中で組み立て、キャラを置いて撮る（保存はしない）
                var rt = new RenderTexture(1536, 1024, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
                camera.targetTexture = rt;
                stage.Build();
                // 比べ: 塗りを差し替えない（読み込んだままの UniUnlit）
                var toon = stage.ToonShader; stage.ToonShader = null;
                stage.LoadCharacter();
                stage.PlaceAt(stage.StartPoint(), 180f);
                Board3DTestBuilder.Render(camera, rt, "Stage_00_unlit");
                UnityEngine.Object.DestroyImmediate(stage.Character.gameObject);
                foreach (Transform child in stage.transform) if (child.name == "BlobShadow") UnityEngine.Object.DestroyImmediate(child.gameObject);
                stage.ToonShader = toon;
                stage.LoadCharacter();
                if (stage.Character == null) throw new InvalidOperationException("VRM が読めない");
                var g = stage.Data.grid;
                Vector3 CellAt(float fx, float fz)
                {
                    // 歩ける所の、割合 (fx, fz) に近い歩けるマス
                    var want = new Vector3(g.x0 + fx * g.nx * g.cell, 0, g.z0 + fz * g.nz * g.cell);
                    var best = want; float bestD = float.MaxValue;
                    for (int z = 0; z < g.nz; z++)
                    for (int x = 0; x < g.nx; x++)
                    {
                        var p = new Vector3(g.x0 + (x + .5f) * g.cell, 0, g.z0 + (z + .5f) * g.cell);
                        if (!stage.IsWalkable(p)) continue;
                        float d = (p - want).sqrMagnitude;
                        if (d < bestD) { bestD = d; best = p; }
                    }
                    return best;
                }
                void Shot(string name, Vector3 at, float yaw)
                {
                    stage.PlaceAt(at, yaw);
                    Board3DTestBuilder.Render(camera, rt, "Stage_" + name);
                    Debug.Log($"[StageBuilder] {name}: {stage.Position} 床の高さ {stage.HeightAt(stage.Position):0.00}");
                }
                Shot("01_front", stage.StartPoint(), 180f);
                Shot("02_front_side", CellAt(.25f, .25f), 150f);
                Shot("03_middle", CellAt(.5f, .5f), 0f);
                Shot("04_far_left", CellAt(.15f, .65f), 90f);
                Shot("05_far_right", CellAt(.85f, .65f), 270f);
                Shot("06_stairs", CellAt(.5f, .85f), 0f);
                Shot("07_top", CellAt(.5f, .97f), 180f);
                // 歩く（動画用のコマ）: 手前の左 → 奥の右 → 階段の上 → 手前の真ん中。向きを変えながら
                string frames = Path.Combine(Path.GetDirectoryName(Application.dataPath), "PlaythroughShots", "stage_walk");
                if (Directory.Exists(frames)) Directory.Delete(frames, true);
                Directory.CreateDirectory(frames);
                stage.PlaceAt(CellAt(.25f, .2f), 0f);
                int frame = 0;
                foreach (var goal in new[] { CellAt(.8f, .55f), CellAt(.5f, .97f), stage.StartPoint() })
                {
                    stage.WalkTo(goal);
                    for (int i = 0; i < 900 && stage.Walking; i++)
                    {
                        stage.Step(1f / 30f);
                        if (i % 3 == 0) Board3DTestBuilder.Render(camera, rt, $"walk_{frame++:0000}", 1, frames);
                    }
                }
                Debug.Log($"[StageBuilder] 歩くコマ {frame} 枚: {frames}");
                Debug.Log($"[StageBuilder] 歩いた先: {stage.Position}");
                camera.targetTexture = null;
                Debug.Log("[StageBuilder] 作った: " + ScenePath);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        private static void Configure(string path, bool linear, bool readable)
        {
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = !linear;
            importer.mipmapEnabled = false;
            importer.isReadable = readable;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.maxTextureSize = 2048;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            if (linear)
            {
                var settings = importer.GetDefaultPlatformTextureSettings();
                settings.format = TextureImporterFormat.R16;
                importer.SetPlatformTextureSettings(settings);
            }
            importer.SaveAndReimport();
        }
    }
}
