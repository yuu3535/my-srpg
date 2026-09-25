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
    /// Unity版 M1-a のシーンを組み立てる（Claude Code がコマンドから実行する）。
    ///
    ///   Unity.exe -batchmode -projectPath unity-prototype -executeMethod Srpg.EditorAgent.BattleM1Builder.BuildAll -quit -logFile -
    ///
    /// 1. 素材の読み込み設定（ドット絵・マップ絵・菱形）を整える
    /// 2. シーン Assets/Scenes/BattleM1.unity を作り直す
    /// 3. 確認用の画像を Assets/Previews/ に書き出す（全体・アルシェを選んだところ）
    /// データは tools/export_unity_battle.js（ブラウザ版から書き出し）で用意しておく。
    /// </summary>
    public static class BattleM1Builder
    {
        private const string DataPath = "Assets/Data/Battles/battle_trial_adopted.json";
        private const string ScenePath = "Assets/Scenes/BattleM1.unity";
        private const string TileSpritePath = "Assets/Art/UI/tile_diamond.png";
        private const string FrameSpritePath = "Assets/Art/UI/tile_frame.png";
        private const string PreviewDir = "Assets/Previews";
        // スマホの横画面（844×390 の2倍）で確認する
        private const int PreviewWidth = 1688;
        private const int PreviewHeight = 780;

        public static void BuildAll()
        {
            try
            {
                var data = JsonUtility.FromJson<BattleDataFile>(File.ReadAllText(DataPath));
                WriteDiamondSprites();
                ConfigureImporters(data);
                BuildScene(data);
                Debug.Log("[BattleM1Builder] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        // ── 素材 ──

        /// <summary>移動範囲の塗りの菱形と、選択中の枠の菱形（128×64）を描いて保存する</summary>
        private static void WriteDiamondSprites()
        {
            Directory.CreateDirectory("Assets/Art/UI");
            File.WriteAllBytes(TileSpritePath, DrawDiamond(fill: true).EncodeToPNG());
            File.WriteAllBytes(FrameSpritePath, DrawDiamond(fill: false).EncodeToPNG());
            AssetDatabase.ImportAsset(TileSpritePath, ImportAssetOptions.ForceUpdate);
            AssetDatabase.ImportAsset(FrameSpritePath, ImportAssetOptions.ForceUpdate);
        }

        private static Texture2D DrawDiamond(bool fill)
        {
            const int w = 128, h = 64;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            var clear = new Color(1, 1, 1, 0);
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    // 菱形の中心からの距離（1で縁）
                    float d = Mathf.Abs(x + 0.5f - w / 2f) / (w / 2f) + Mathf.Abs(y + 0.5f - h / 2f) / (h / 2f);
                    Color c = clear;
                    if (d <= 1f)
                    {
                        float edge = 1f - d;   // 縁ほど0
                        if (fill) c = new Color(1, 1, 1, edge < 0.06f ? 1f : 0.55f);
                        else if (edge < 0.07f) c = Color.white;
                    }
                    tex.SetPixel(x, h - 1 - y, c);
                }
            }
            tex.Apply();
            return tex;
        }

        private static void ConfigureImporters(BattleDataFile data)
        {
            // 菱形: 1マス（128px）＝1ワールド単位、中心がピボット
            foreach (var path in new[] { TileSpritePath, FrameSpritePath })
                ConfigureSprite(path, 128, new Vector2(0.5f, 0.5f), 256, FilterMode.Bilinear);
            // マップ絵: 1マスの横幅 tileW px ＝ 1ワールド単位、左上がピボット
            if (data.iso != null)
                ConfigureSprite(data.iso.image, data.iso.tileW, new Vector2(0f, 1f), 2048, FilterMode.Bilinear);
            // ドット絵: 足元（下端の中央）がピボット。大きさはシーン側で合わせる
            foreach (var unit in data.units.Where(u => !string.IsNullOrEmpty(u.token)))
                ConfigureSprite(unit.token, 100, new Vector2(0.5f, 0.02f), 1024, FilterMode.Bilinear);
        }

        private static void ConfigureSprite(string path, float pixelsPerUnit, Vector2 pivot, int maxSize, FilterMode filter)
        {
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer == null)
            {
                AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
                importer = AssetImporter.GetAtPath(path) as TextureImporter;
            }
            if (importer == null) throw new InvalidOperationException($"画像を読み込めない: {path}");
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = pixelsPerUnit;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = false;
            importer.filterMode = filter;
            importer.maxTextureSize = maxSize;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            var settings = new TextureImporterSettings();
            importer.ReadTextureSettings(settings);
            settings.spriteAlignment = (int)SpriteAlignment.Custom;
            settings.spritePivot = pivot;
            settings.spriteMeshType = SpriteMeshType.FullRect;
            importer.SetTextureSettings(settings);
            importer.SaveAndReimport();
        }

        // ── シーン ──

        private static void BuildScene(BattleDataFile data)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var cameraObject = new GameObject("Main Camera") { tag = "MainCamera" };
            var camera = cameraObject.AddComponent<Camera>();
            camera.orthographic = true;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color32(14, 11, 26, 255);   // 黒紫
            camera.transform.position = new Vector3(0, 0, -10);

            var controllerObject = new GameObject("BattleM1");
            var controller = controllerObject.AddComponent<BattleM1Controller>();
            var so = new SerializedObject(controller);
            so.FindProperty("battleJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(DataPath);
            if (data.iso != null)
                so.FindProperty("mapSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(data.iso.image);
            so.FindProperty("tileSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(TileSpritePath);
            so.FindProperty("frameSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(FrameSpritePath);
            so.FindProperty("targetCamera").objectReferenceValue = camera;
            var spritesProp = so.FindProperty("unitSprites");
            var withToken = data.units.Where(u => !string.IsNullOrEmpty(u.token)).ToArray();
            spritesProp.arraySize = withToken.Length;
            for (int i = 0; i < withToken.Length; i++)
            {
                var element = spritesProp.GetArrayElementAtIndex(i);
                element.FindPropertyRelative("id").stringValue = withToken[i].id;
                element.FindPropertyRelative("sprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(withToken[i].token);
            }
            so.ApplyModifiedPropertiesWithoutUndo();

            // スマホの横画面を基準にする
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;

            // プレビュー: 盤面全体と、アルシェを選んだところ
            camera.aspect = (float)PreviewWidth / PreviewHeight;
            controller.Setup();
            RenderPreview(camera, $"{PreviewDir}/BattleM1_board.png");
            controller.Select("arshe");
            RenderPreview(camera, $"{PreviewDir}/BattleM1_select.png");
            controller.Setup();   // シーンには選択なしの状態を保存する

            EditorSceneManager.SaveScene(scene, ScenePath);
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            AssetDatabase.SaveAssets();
        }

        private static void RenderPreview(Camera camera, string path)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            var rt = new RenderTexture(PreviewWidth, PreviewHeight, 24, RenderTextureFormat.ARGB32);
            var previous = RenderTexture.active;
            camera.targetTexture = rt;
            camera.Render();
            RenderTexture.active = rt;
            var tex = new Texture2D(PreviewWidth, PreviewHeight, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, PreviewWidth, PreviewHeight), 0, 0);
            tex.Apply();
            File.WriteAllBytes(path, tex.EncodeToPNG());
            camera.targetTexture = null;
            RenderTexture.active = previous;
            UnityEngine.Object.DestroyImmediate(rt);
            UnityEngine.Object.DestroyImmediate(tex);
            Debug.Log($"[BattleM1Builder] preview: {path}");
        }
    }
}
