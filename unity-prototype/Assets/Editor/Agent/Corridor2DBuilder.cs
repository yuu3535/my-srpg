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

                foreach (var path in Directory.GetFiles(ArtDir, "*.png"))
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
                var textures = Directory.GetFiles(ArtDir, "*.png")
                    .Select(p => AssetDatabase.LoadAssetAtPath<Texture2D>(p.Replace(Path.DirectorySeparatorChar, '/'))).Where(t => t != null).ToArray();

                var go = new GameObject("Corridor2D");
                var view = go.AddComponent<Corridor2DView>();
                var so = new SerializedObject(view);
                so.FindProperty("corridorJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(DataPath);
                so.FindProperty("hero").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Texture2D>(HeroPath);
                so.FindProperty("targetCamera").objectReferenceValue = camera;
                var texProp = so.FindProperty("textures");
                texProp.arraySize = textures.Length;
                for (int i = 0; i < textures.Length; i++) texProp.GetArrayElementAtIndex(i).objectReferenceValue = textures[i];
                so.ApplyModifiedPropertiesWithoutUndo();
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
                camera.targetTexture = null;
                foreach (Transform child in go.transform) UnityEngine.Object.DestroyImmediate(child.gameObject);
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
