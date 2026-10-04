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
    /// 探索の2D横スクロール（オルクス城の回廊）の試しの場面を作る（原作者 2026-10-03）。
    /// 層の値: Assets/Data/Corridors/orcus_castle.json（原作者が debug/corridor_layers.html で決めた値）。
    /// 画像: Assets/Art/Corridor（背景/オルクス城回廊横スクロール/採用候補 から写したもの）。
    /// 確認の画像: Assets/Previews/Corridor2D_*.png（左・真ん中・右）
    /// </summary>
    public static class Corridor2DBuilder
    {
        private const string ScenePath = "Assets/Scenes/Corridor2D.unity";
        private const string DataPath = "Assets/Data/Corridors/orcus_castle.json";
        private const string ArtDir = "Assets/Art/Corridor";
        private const string HeroPath = "Assets/Art/SD/young_arshe.png";
        private const string MapPath = "Assets/Data/Maps/orcus_corridor.json";
        private const string ScenarioPath = "Assets/Data/Scenario/prologue_1_1.json";

        private const string LookDir = "Assets/Data/Looks";
        private const string Side2DDir = "Assets/Art/Side2D";
        private const string StartPlace = "orcus_room";   // プロローグは自室で起きる
        private const string SkyDir = "Assets/Art/Sky";

        [Serializable] private class CorridorLook { public string look; }
        [Serializable] private class LookSky { public string sky; }

        /// <summary>見え方のプリセットが使う空の絵を、背景/空/ から Assets/Art/Sky へ写す（使う空だけ。読み込みを軽く）</summary>
        private static string[] ImportLookSkies()
        {
            Directory.CreateDirectory(SkyDir);
            var paths = new System.Collections.Generic.List<string>();
            foreach (var file in Directory.GetFiles(LookDir, "*.json"))
            {
                var sky = JsonUtility.FromJson<LookSky>(File.ReadAllText(file))?.sky;
                if (string.IsNullOrEmpty(sky)) continue;
                string source = Path.Combine("..", sky.TrimStart('/'));
                string dest = $"{SkyDir}/{Path.GetFileName(sky)}";
                if (!File.Exists(source)) { Debug.LogWarning($"[Corridor2DBuilder] 空の絵がない: {source}"); continue; }
                if (!File.Exists(dest) || !File.ReadAllBytes(source).AsSpan().SequenceEqual(File.ReadAllBytes(dest)))
                {
                    File.Copy(source, dest, true);
                    AssetDatabase.ImportAsset(dest, ImportAssetOptions.ForceSynchronousImport);
                    var importer = (TextureImporter)AssetImporter.GetAtPath(dest);
                    importer.textureType = TextureImporterType.Default;
                    importer.mipmapEnabled = false;
                    importer.wrapMode = TextureWrapMode.Clamp;
                    importer.maxTextureSize = 2048;
                    importer.textureCompression = TextureImporterCompression.Compressed;
                    importer.SaveAndReimport();
                }
                if (!paths.Contains(dest)) paths.Add(dest);
            }
            return paths.ToArray();
        }

        [MenuItem("Srpg/2D回廊（試し）を作る")]
        public static void BuildAll()
        {
            try
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                var cameraObject = new GameObject("Main Camera", typeof(Camera));
                cameraObject.tag = "MainCamera";
                var camera = cameraObject.GetComponent<Camera>();
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = new Color(0.03f, 0.04f, 0.06f);
                camera.orthographic = true;
                camera.transform.position = new Vector3(0f, 0f, -10f);

                // 場所の絵: 回廊（Assets/Art/Corridor）と、ほかの場所（Assets/Art/Side2D/<場所>/）
                var artFiles = Directory.GetFiles(ArtDir, "*.png").Concat(Directory.Exists(Side2DDir) ? Directory.GetFiles(Side2DDir, "*.png", SearchOption.AllDirectories) : Array.Empty<string>()).ToArray();
                foreach (var path in artFiles)
                {
                    string asset = path.Replace(Path.DirectorySeparatorChar, '/');
                    AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport);
                    var importer = (TextureImporter)AssetImporter.GetAtPath(asset);
                    importer.textureType = TextureImporterType.Default;
                    importer.mipmapEnabled = false;
                    importer.alphaIsTransparency = true;
                    importer.wrapMode = path.Contains("floor") ? TextureWrapMode.Repeat : TextureWrapMode.Clamp;   // 床はくり返す
                    importer.maxTextureSize = 2048;
                    importer.textureCompression = TextureImporterCompression.Compressed;
                    importer.SaveAndReimport();
                }
                // 見え方のプリセット（場所のデータの look。空・効果。2026-10-04）と、その空の絵（背景/空/ から写す）
                var corridorData = JsonUtility.FromJson<CorridorLook>(File.ReadAllText(DataPath));
                string lookPath = string.IsNullOrEmpty(corridorData?.look) ? null : $"{LookDir}/{corridorData.look}.json";
                var lookAsset = lookPath != null ? AssetDatabase.LoadAssetAtPath<TextAsset>(lookPath) : null;
                var skyPaths = ImportLookSkies();
                var textures = artFiles.Concat(skyPaths)
                    .Select(p => AssetDatabase.LoadAssetAtPath<Texture2D>(p.Replace(Path.DirectorySeparatorChar, '/'))).Where(t => t != null).ToArray();

                var go = new GameObject("Corridor2D");
                var view = go.AddComponent<Corridor2DView>();
                var so = new SerializedObject(view);
                so.FindProperty("corridorJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(DataPath);
                so.FindProperty("hero").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Texture2D>(HeroPath);
                so.FindProperty("targetCamera").objectReferenceValue = camera;
                so.FindProperty("lookJson").objectReferenceValue = lookAsset;
                var looks = Directory.GetFiles(LookDir, "*.json").Select(p => AssetDatabase.LoadAssetAtPath<TextAsset>(p.Replace(Path.DirectorySeparatorChar, '/'))).Where(t => t != null).ToArray();
                var looksProp = so.FindProperty("lookJsons");
                looksProp.arraySize = looks.Length;
                for (int i = 0; i < looks.Length; i++) looksProp.GetArrayElementAtIndex(i).objectReferenceValue = looks[i];
                so.FindProperty("layerShader").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Shader>("Assets/Shaders/Corridor2DLayer.shader");
                so.FindProperty("glowShader").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Shader>("Assets/Shaders/Corridor2DGlow.shader");
                var texProp = so.FindProperty("textures");
                texProp.arraySize = textures.Length;
                for (int i = 0; i < textures.Length; i++) texProp.GetArrayElementAtIndex(i).objectReferenceValue = textures[i];
                so.ApplyModifiedPropertiesWithoutUndo();

                // 探索（会話・話す・調べる・扉。2026-10-04）: 3Dの探索と同じ配置表とシナリオを使う
                var dialogue = DialogueBuilder.CreateView(camera);
                var explore = go.AddComponent<Explore2DController>();
                var eso = new SerializedObject(explore);
                eso.FindProperty("view").objectReferenceValue = view;
                eso.FindProperty("dialogue").objectReferenceValue = dialogue;
                // 場所（Assets/Data/Corridors の全部）と配置表（Assets/Data/Maps の全部）。扉で行き来する（2026-10-04）
                void SetAll(string prop, string dir)
                {
                    var assets = Directory.GetFiles(dir, "*.json").Select(p => AssetDatabase.LoadAssetAtPath<TextAsset>(p.Replace(Path.DirectorySeparatorChar, '/'))).Where(t => t != null).ToArray();
                    var arr = eso.FindProperty(prop);
                    arr.arraySize = assets.Length;
                    for (int i = 0; i < assets.Length; i++) arr.GetArrayElementAtIndex(i).objectReferenceValue = assets[i];
                }
                SetAll("placeJsons", "Assets/Data/Corridors");
                SetAll("mapJsons", "Assets/Data/Maps");
                eso.FindProperty("startPlace").stringValue = StartPlace;
                eso.FindProperty("scenarioJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(ScenarioPath);
                var sprites = Directory.GetFiles("Assets/Art/SD", "*.png")
                    .Select(p => AssetDatabase.LoadAssetAtPath<Texture2D>(p.Replace(Path.DirectorySeparatorChar, '/'))).Where(t => t != null).ToArray();
                var spProp = eso.FindProperty("sprites");
                spProp.arraySize = sprites.Length;
                for (int i = 0; i < sprites.Length; i++) spProp.GetArrayElementAtIndex(i).objectReferenceValue = sprites[i];
                eso.ApplyModifiedPropertiesWithoutUndo();
                EditorSceneManager.SaveScene(scene, ScenePath);
                var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
                scenes.Add(new EditorBuildSettingsScene(ScenePath, true));
                EditorBuildSettings.scenes = scenes.ToArray();

                // 確認の画像（エディタで組み立てて、左・真ん中・右で撮る）
                var rt = new RenderTexture(Board3DTestBuilder.PreviewWidth, Board3DTestBuilder.PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
                camera.targetTexture = rt;
                camera.aspect = (float)Board3DTestBuilder.PreviewWidth / Board3DTestBuilder.PreviewHeight;
                view.Build();
                float len = view.Length;
                foreach (var (x, name) in new[] { (160f, "left_end"), (len / 2f, "middle"), (len - 160f, "right_end") })
                {
                    view.PlayerX = x;
                    Canvas.ForceUpdateCanvases();
                    Board3DTestBuilder.Render(camera, rt, "Corridor2D_" + name);
                }
                // 探索の確認: 入ったところ → キャリー（近づくと会話）→ 謁見の間の扉（調べる）→ 階段（ヘンリーにまだ会っていない）→ ヘンリー
                void Shot(string name, string note)
                {
                    Canvas.ForceUpdateCanvases();
                    Board3DTestBuilder.Render(camera, rt, "Corridor2D_" + name);
                    var line = dialogue.CurrentLine;
                    Debug.Log($"[Corridor2DBuilder] {name}: x={view.PlayerX:0} {note} 会話={(dialogue.IsPlaying ? $"{line?.speaker}「{line?.text?.Replace("\n", " ")}」" : "なし")}");
                }
                void CloseAll() { for (int i = 0; i < 20 && dialogue.IsPlaying; i++) dialogue.Close(); }
                var use = typeof(Corridor2DView).GetMethod("UseExit", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                // 自室（仮）: 起きる → 剣を見つける → 剣がないと出られない扉 → 回廊へ
                explore.Begin();
                Shot("room_wake", "自室で起きる");
                CloseAll();
                explore.StepForTest(view.WalkMinX);
                Shot("room_left", "部屋の左（会話なし）");
                explore.StepForTest(view.WalkMaxX);
                Shot("room_right", "部屋の右（会話なし）");
                explore.StepForTest(explore.SpotX("to_corridor"));
                use.Invoke(view, null);
                Shot("room_door_locked", "剣を持たずに扉へ");
                CloseAll();
                explore.StepForTest(explore.SpotX("find_sword"));
                use.Invoke(view, null);
                Shot("room_sword", "剣立てを調べる");
                CloseAll();
                explore.StepForTest(explore.SpotX("to_corridor"));
                use.Invoke(view, null);
                CloseAll();
                explore.StepForTest(view.PlayerX);
                Shot("explore_start", $"扉から回廊へ（場所 {explore.Place}）");
                explore.StepForTest(explore.PersonX("carrie") - 90f);
                Shot("explore_carrie", "キャリーの近く");
                dialogue.Close();
                explore.StepForTest(view.PlayerX + 1f);
                Shot("explore_after_carrie", "キャリーと話したあと");
                explore.StepForTest(view.Length - 150f);
                Shot("explore_stairs", "階段の前");
                if (!explore.Seen.Contains("prologue_1_1.b08"))
                {
                    use.Invoke(view, null);
                    Shot("explore_stairs_locked", "階段を使う（ヘンリーにまだ会っていない）");
                    dialogue.Close();
                }
                explore.StepForTest(explore.PersonX("henry") - 90f);
                Shot("explore_henry", "ヘンリーの近く");
                dialogue.Close();
                // 見え方の切り替え（ほかのプリセットで、同じ所を撮る）
                foreach (var other in looks.Where(t => t.name != corridorData.look && !t.name.StartsWith("orcus_room")))
                {
                    explore.SetLook(other.name);
                    Shot("look_" + other.name, $"見え方 {other.name}");
                }
                if (!string.IsNullOrEmpty(corridorData.look)) explore.SetLook(corridorData.look);
                // 訓練のあと、昼の自室へ戻る（御伽噺を調べる。原作者 2026-10-04: 朝練のあとなので昼）
                ExploreHandoff.SetTo2D("orcus_room", "prologue_1_2_fairytale", explore.Seen, Array.Empty<string>());
                explore.Begin();
                CloseAll();
                explore.StepForTest(view.PlayerX);
                Shot("room_noon", "昼の自室（御伽噺）");
                camera.targetTexture = null;
                foreach (Transform child in go.transform) UnityEngine.Object.DestroyImmediate(child.gameObject);
                foreach (Transform child in dialogue.transform) UnityEngine.Object.DestroyImmediate(child.gameObject);
                EditorSceneManager.SaveScene(scene, ScenePath);
                Debug.Log("[Corridor2DBuilder] 作った: " + ScenePath);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }
    }
}
