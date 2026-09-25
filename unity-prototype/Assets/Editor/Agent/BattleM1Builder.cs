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
        private const string FootGlowPath = "Assets/Art/UI/foot_glow.png";
        // 駒の台座（仮）: 縁は白で描き、陣営の色（味方＝青、敵＝赤）はシーン側で付ける。天面は草地
        private const string BaseRimPath = "Assets/Art/UI/base_rim.png";
        private const string BaseTopPath = "Assets/Art/UI/base_top.png";
        private const string PreviewDir = "Assets/Previews";
        // 足元の光のコマ（tools/make_flipbook.py が動画から作る）
        private const string AllyRingDir = "Assets/Art/Effects/FootRing/Ally";
        private const string EnemyRingDir = "Assets/Art/Effects/FootRing/Enemy";
        private const string SupportRingDir = "Assets/Art/Effects/FootRing/Support";
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
            File.WriteAllBytes(FootGlowPath, DrawFootGlow().EncodeToPNG());
            AssetDatabase.ImportAsset(FootGlowPath, ImportAssetOptions.ForceUpdate);
            File.WriteAllBytes(BaseRimPath, DrawBase(top: false).EncodeToPNG());
            File.WriteAllBytes(BaseTopPath, DrawBase(top: true).EncodeToPNG());
            AssetDatabase.ImportAsset(BaseRimPath, ImportAssetOptions.ForceUpdate);
            AssetDatabase.ImportAsset(BaseTopPath, ImportAssetOptions.ForceUpdate);
        }

        /// <summary>
        /// 駒の台座（仮・原作者のTRPGの動画の表現 2026-09-26）。楕円の円柱。
        ///   縁（top=false）: 側面の帯と天面のふちの輪。白で描き、陣営の色で染める
        ///   天面（top=true）: 草地の楕円（縁の輪の内側）
        /// 画像は 160×100、天面の楕円の中心は上から 38px（足を置く位置）
        /// </summary>
        private static Texture2D DrawBase(bool top)
        {
            const int w = 160, h = 100;
            const float cx = w / 2f, cy = 38f, rx = 74f, ry = 34f, side = 20f;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            for (int py = 0; py < h; py++)
            for (int px = 0; px < w; px++)
            {
                float x = px + 0.5f, y = py + 0.5f;   // 上から数えた位置
                float dx = (x - cx) / rx;
                float topDist = Mathf.Sqrt(dx * dx + Mathf.Pow((y - cy) / ry, 2f));
                float bottomDist = Mathf.Sqrt(dx * dx + Mathf.Pow((y - cy - side) / ry, 2f));
                Color c = new Color(0, 0, 0, 0);
                if (top)
                {
                    if (topDist <= 0.86f)
                    {
                        float shade = 0.75f + 0.25f * (1f - Mathf.Clamp01((y - (cy - ry)) / (2f * ry)));
                        float grain = Mathf.PerlinNoise(px * 0.18f, py * 0.18f) * 0.18f;
                        c = new Color((0.20f + grain) * shade, (0.40f + grain) * shade, (0.18f + grain * 0.5f) * shade, 1f);
                    }
                }
                else
                {
                    bool inSide = Mathf.Abs(dx) <= 1f && y >= cy && (bottomDist <= 1f || y <= cy + side) && topDist >= 0.99f;
                    bool inRim = topDist <= 1f && topDist > 0.86f;
                    if (inSide)
                    {
                        // 側面: 左右の端ほど暗く、立体に見せる
                        float light = 0.55f + 0.45f * (1f - Mathf.Abs(dx));
                        c = new Color(light, light, light, 1f);
                    }
                    else if (inRim) c = new Color(1f, 1f, 1f, 1f);
                }
                tex.SetPixel(px, h - 1 - py, c);
            }
            tex.Apply();
            return tex;
        }

        /// <summary>足元の淡い楕円（白。陣営の色はシーン側で付ける）。縁ほど薄く、輪の部分を少し濃く</summary>
        private static Texture2D DrawFootGlow()
        {
            const int w = 128, h = 64;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float dx = (x + 0.5f - w / 2f) / (w / 2f);
                float dy = (y + 0.5f - h / 2f) / (h / 2f);
                float r = Mathf.Sqrt(dx * dx + dy * dy);
                float fill = Mathf.Clamp01(1f - r) * 0.55f;
                float ring = Mathf.Exp(-Mathf.Pow((r - 0.78f) / 0.07f, 2f));
                float a = Mathf.Clamp01(fill + ring * 0.9f) * (r < 1f ? 1f : 0f);
                tex.SetPixel(x, y, new Color(1, 1, 1, a));
            }
            tex.Apply();
            return tex;
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
            foreach (var path in new[] { TileSpritePath, FrameSpritePath, FootGlowPath })
                ConfigureSprite(path, 128, new Vector2(0.5f, 0.5f), 256, FilterMode.Bilinear);
            // 台座: 天面の楕円の中心（上から38px/100px）がピボット＝足を置く位置
            foreach (var path in new[] { BaseRimPath, BaseTopPath })
                ConfigureSprite(path, 160, new Vector2(0.5f, 0.62f), 256, FilterMode.Bilinear);
            // マップ絵: 1マスの横幅 tileW px ＝ 1ワールド単位、左上がピボット
            if (data.iso != null)
                ConfigureSprite(data.iso.image, data.iso.tileW, new Vector2(0f, 1f), 2048, FilterMode.Bilinear);
            // 足元の光: 下端の中央がピボット
            foreach (var path in RingFramePaths(AllyRingDir).Concat(RingFramePaths(EnemyRingDir)).Concat(RingFramePaths(SupportRingDir)))
                ConfigureSprite(path, 100, new Vector2(0.5f, 0f), 512, FilterMode.Bilinear);
            // ドット絵: 足元（下端の中央）がピボット。大きさはシーン側で合わせる
            foreach (var unit in data.units.Where(u => !string.IsNullOrEmpty(u.token)))
                ConfigureSprite(unit.token, 100, new Vector2(0.5f, 0.02f), 1024, FilterMode.Bilinear);
        }

        private static string[] RingFramePaths(string dir)
        {
            if (!Directory.Exists(dir)) return Array.Empty<string>();
            return Directory.GetFiles(dir, "f_*.png").Select(p => p.Replace(Path.DirectorySeparatorChar, '/')).OrderBy(p => p, StringComparer.Ordinal).ToArray();
        }

        private static void SetSpriteArray(SerializedObject so, string property, string dir)
        {
            var paths = RingFramePaths(dir);
            var prop = so.FindProperty(property);
            prop.arraySize = paths.Length;
            for (int i = 0; i < paths.Length; i++)
                prop.GetArrayElementAtIndex(i).objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(paths[i]);
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
            so.FindProperty("footGlowSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(FootGlowPath);
            so.FindProperty("baseRimSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(BaseRimPath);
            so.FindProperty("baseTopSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(BaseTopPath);
            SetSpriteArray(so, "allyRingFrames", AllyRingDir);
            SetSpriteArray(so, "enemyRingFrames", EnemyRingDir);
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
