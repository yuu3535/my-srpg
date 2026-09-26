using System;
using System.IO;
using System.Linq;
using System.Reflection;
using Srpg.Battle;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// 3Dの盤面の試作シーン（T1〜T3）を組み立て、段階ごとの確認用の画像を書き出す（Claude Code がコマンドから実行する）。
    ///
    ///   Unity.exe -batchmode -projectPath unity-prototype -executeMethod Srpg.EditorAgent.Board3DTestBuilder.BuildAll -quit -logFile -
    ///
    /// 1. 3D用の描画設定（Universal Renderer）を用意する。今の設定は2D用で、3Dの陰影が出ないため。
    ///    既存の2D用の設定（BattleM1 が使う）は変えず、描画設定の一覧に足すだけ。
    /// 2. シーン Assets/Scenes/Board3DTest.unity を作り直す（盤面は再生したときに作る）
    /// 3. Assets/Previews/Board3D_*.png を書き出す
    /// 依頼: docs/10-design/map/MAP_3D_BOARD_TEST_REQUEST_2026-09-26.md（T1〜T4）
    /// </summary>
    public static class Board3DTestBuilder
    {
        private const string ScenePath = "Assets/Scenes/Board3DTest.unity";
        private const string RendererPath = "Assets/Settings/Renderer3D.asset";
        private const string PreviewDir = "Assets/Previews";
        private const string TokenDir = "Assets/Art/Tokens";                         // キャラの盤面の絵（BattleM1 と同じ）
        private const string TreePicturePath = "Assets/Art/Board3D/tree_picture.png";  // 板に貼る仮の木の絵（ここで描く）
        // ゲームのUI素材（ブラウザ版の assets/ui/ から複製）。盤面の枠 D4（味方）・D5（敵）
        private static readonly (string source, string dest)[] UiFrames =
        {
            ("../assets/ui/select_ally_d4.png", "Assets/Art/Board3D/select_ally_d4.png"),
            ("../assets/ui/select_enemy_d5.png", "Assets/Art/Board3D/select_enemy_d5.png"),
        };
        private const int PreviewWidth = 1688;   // スマホの横画面（844×390 の2倍）
        private const int PreviewHeight = 780;

        public static void BuildAll()
        {
            try
            {
                int rendererIndex = EnsureUniversalRenderer();
                WriteTreePicture();
                CopyUiFrames();
                BuildScene(rendererIndex);
                Debug.Log("[Board3DTestBuilder] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        /// <summary>3D用の描画設定を描画設定の一覧に足し、その番号を返す（あれば足さない）</summary>
        private static int EnsureUniversalRenderer()
        {
            var pipeline = (GraphicsSettings.defaultRenderPipeline ?? QualitySettings.renderPipeline) as UniversalRenderPipelineAsset;
            if (pipeline == null) pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/Settings/UniversalRP.asset");
            if (pipeline == null) throw new InvalidOperationException("URP の設定が見つからない");
            var so = new SerializedObject(pipeline);
            var list = so.FindProperty("m_RendererDataList");
            for (int i = 0; i < list.arraySize; i++)
                if (list.GetArrayElementAtIndex(i).objectReferenceValue is UniversalRendererData) return i;

            var data = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(RendererPath);
            if (data == null)
            {
                // URP のメニュー「Universal Renderer」と同じ作り方（既定の後処理の設定つき）
                var create = typeof(UniversalRenderPipelineAsset).GetMethod("CreateRendererAsset", BindingFlags.NonPublic | BindingFlags.Static);
                data = (UniversalRendererData)create.Invoke(null, new object[] { RendererPath, RendererType.UniversalRenderer, false, "Renderer" });
            }
            list.arraySize++;
            list.GetArrayElementAtIndex(list.arraySize - 1).objectReferenceValue = data;
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(pipeline);
            AssetDatabase.SaveAssets();
            return list.arraySize - 1;
        }

        private static void BuildScene(int rendererIndex)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var cameraObject = new GameObject("Main Camera") { tag = "MainCamera" };
            var camera = cameraObject.AddComponent<Camera>();
            camera.orthographic = true;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color32(14, 11, 26, 255);   // 黒紫
            cameraObject.AddComponent<UniversalAdditionalCameraData>().SetRenderer(rendererIndex);

            var lightObject = new GameObject("Directional Light");
            var light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.15f;
            light.color = new Color32(255, 244, 226, 255);
            light.shadows = LightShadows.Soft;
            lightObject.transform.rotation = Quaternion.Euler(55f, -30f, 0f);
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color32(78, 72, 96, 255);

            var controllerObject = new GameObject("Board3DTest");
            var controller = controllerObject.AddComponent<Board3DTestController>();
            var so = new SerializedObject(controller);
            so.FindProperty("targetCamera").objectReferenceValue = camera;
            so.FindProperty("keyLight").objectReferenceValue = light;
            so.FindProperty("treeSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(TreePicturePath);
            so.FindProperty("allyFrameSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(UiFrames[0].dest);
            so.FindProperty("enemyFrameSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(UiFrames[1].dest);
            var withSprite = Board3DLayout.Units
                .Select(u => (u.id, sprite: AssetDatabase.LoadAssetAtPath<Sprite>($"{TokenDir}/{u.id}.png")))
                .Where(u => u.sprite != null).ToArray();
            var spritesProp = so.FindProperty("unitSprites");
            spritesProp.arraySize = withSprite.Length;
            for (int i = 0; i < withSprite.Length; i++)
            {
                var element = spritesProp.GetArrayElementAtIndex(i);
                element.FindPropertyRelative("id").stringValue = withSprite[i].id;
                element.FindPropertyRelative("sprite").objectReferenceValue = withSprite[i].sprite;
            }
            so.ApplyModifiedPropertiesWithoutUndo();

            // 確認用の画像（画面の大きさに合わせてから、マスを押す位置を計算する）
            var rt = new RenderTexture(PreviewWidth, PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)PreviewWidth / PreviewHeight;
            controller.Setup();

            // T1: 真上（最初の1枚は陰影の準備が間に合わず暗くなるので、一度空撮りしてから撮る）
            ShaderUtil.allowAsyncCompilation = false;
            controller.SetView(false, 0, true);
            camera.Render();
            Render(camera, rt, "Board3D_T1_top");
            Tap(controller, camera, new Vector2Int(6, 3));   // 補修橋のマスを押す
            Render(camera, rt, "Board3D_T1_select");

            // T2: 斜め見下ろし（縦に30°・横に45°）
            controller.Setup();
            controller.SetView(true, 0, true);
            Render(camera, rt, "Board3D_T2_tilt");
            Tap(controller, camera, new Vector2Int(9, 2));   // 敵のいるマスを押す
            Render(camera, rt, "Board3D_T2_select");

            // T3: 90°ずつ回す（1〜3回目）と、回している途中
            controller.Setup();
            for (int turn = 1; turn < 4; turn++)
            {
                controller.SetView(true, turn, true);
                Render(camera, rt, $"Board3D_T3_turn{turn * 90}");
            }
            controller.SetRawAngles(30f, 0f);   // 0°と90°の間（-45° → 45°の途中）
            Render(camera, rt, "Board3D_T3_turning");

            // T4: キャラ・木・壁を立てた盤面（真上・4方向）と、寄って見たところ
            controller.SetView(false, 0, true);
            Render(camera, rt, "Board3D_T4_top");
            for (int turn = 0; turn < 4; turn++)
            {
                controller.SetView(true, turn, true);
                Render(camera, rt, $"Board3D_T4_turn{turn * 90}");
            }
            // 寄って見る: 0° で石の壁のまわり ／ 180° で3Dの木の後ろに立つリングホルム
            controller.SetCloseView(30f, -45f, Board3DLayout.TopCenter(new Vector2Int(2, 3)) + Vector3.up * 0.4f, 2.3f);
            Render(camera, rt, "Board3D_T4_close_wall");
            controller.SetCloseView(30f, 135f, Board3DLayout.TopCenter(new Vector2Int(1, 6)) + Vector3.up * 0.5f, 2.3f);
            Render(camera, rt, "Board3D_T4_close_tree");

            // 足元の見せ方の比較（台座 ／ 影だけ ／ 影と陣営の色の輪）。斜めで寄ったところと、真上
            foreach (Board3DTestController.FootStyle foot in Enum.GetValues(typeof(Board3DTestController.FootStyle)))
            {
                controller.Foot = foot;
                controller.Setup();
                controller.SetCloseView(30f, -45f, Board3DLayout.TopCenter(new Vector2Int(5, 4)) + Vector3.up * 0.4f, 3.4f);
                Render(camera, rt, $"Board3D_T4_foot_{foot}_tilt");
                controller.SetView(false, 0, true);
                Render(camera, rt, $"Board3D_T4_foot_{foot}_top");
            }
            controller.Foot = Board3DTestController.FootStyle.TeamFrame;

            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
            controller.ClearBoard();   // 盤面は再生したときに作る（作ったマテリアルはシーンに保存できないため）
            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
        }

        /// <summary>ゲームのUI素材（盤面の枠）を複製し、マス1つ分の絵として読み込む</summary>
        private static void CopyUiFrames()
        {
            foreach (var (source, dest) in UiFrames)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(dest));
                File.Copy(source, dest, true);
                AssetDatabase.ImportAsset(dest, ImportAssetOptions.ForceSynchronousImport);
                var importer = (TextureImporter)AssetImporter.GetAtPath(dest);
                importer.textureType = TextureImporterType.Sprite;
                importer.spriteImportMode = SpriteImportMode.Single;
                importer.spritePixelsPerUnit = 256;
                importer.alphaIsTransparency = true;
                importer.mipmapEnabled = true;   // 真上から小さく見るので、縮めたときのちらつきを抑える
                importer.SaveAndReimport();
            }
        }

        /// <summary>板に貼る仮の木の絵（幹と、重ねた丸い葉）を描いて、足元を基準にした絵として読み込む</summary>
        private static void WriteTreePicture()
        {
            const int w = 256, h = 384;
            var pixels = new Color32[w * h];
            var trunk = new Color32(74, 52, 36, 255);
            var dark = new Color32(38, 66, 44, 255);
            var mid = new Color32(52, 88, 56, 255);
            var light = new Color32(78, 118, 72, 255);
            void Disc(int cx, int cy, int r, Color32 c)
            {
                for (int y = cy - r; y <= cy + r; y++)
                for (int x = cx - r; x <= cx + r; x++)
                    if (x >= 0 && x < w && y >= 0 && y < h && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r)
                        pixels[y * w + x] = c;
            }
            for (int y = 4; y < 150; y++)   // 幹（下が y=0）
            for (int x = w / 2 - 14; x < w / 2 + 14; x++)
                pixels[y * w + x] = trunk;
            foreach (var (cx, cy, r) in new[] { (128, 170, 86), (80, 210, 62), (176, 214, 64), (128, 262, 78), (104, 318, 52), (150, 320, 50), (128, 352, 30) })
                Disc(cx, cy, r, dark);
            foreach (var (cx, cy, r) in new[] { (122, 176, 70), (84, 214, 48), (170, 218, 50), (122, 268, 62), (104, 318, 38), (146, 322, 36) })
                Disc(cx, cy, r, mid);
            foreach (var (cx, cy, r) in new[] { (104, 196, 26), (106, 286, 24), (96, 330, 14), (70, 226, 16) })
                Disc(cx, cy, r, light);
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            tex.SetPixels32(pixels);
            tex.Apply();
            Directory.CreateDirectory(Path.GetDirectoryName(TreePicturePath));
            File.WriteAllBytes(TreePicturePath, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
            AssetDatabase.ImportAsset(TreePicturePath, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(TreePicturePath);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = 100;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = false;
            var settings = new TextureImporterSettings();
            importer.ReadTextureSettings(settings);
            settings.spriteAlignment = (int)SpriteAlignment.Custom;
            settings.spritePivot = new Vector2(0.5f, 0.01f);
            importer.SetTextureSettings(settings);
            importer.SaveAndReimport();
        }

        /// <summary>そのマスの天面の中心を画面上で押したことにする（押して選べるかの確認）</summary>
        private static void Tap(Board3DTestController controller, Camera camera, Vector2Int cell)
        {
            var screen = camera.WorldToScreenPoint(controller.transform.position + Board3DLayout.TopCenter(cell));
            bool picked = controller.PickAtScreen(screen);
            Debug.Log($"[Board3DTestBuilder] tap {cell} at {screen} → {(picked ? controller.Selected.ToString() : "外れ")}");
            if (!picked || controller.Selected != cell)
                throw new InvalidOperationException($"マス {cell} を押して選べなかった");
        }

        private static void Render(Camera camera, RenderTexture rt, string name)
        {
            Directory.CreateDirectory(PreviewDir);
            camera.Render();
            var previous = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(PreviewWidth, PreviewHeight, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, PreviewWidth, PreviewHeight), 0, 0);
            tex.Apply();
            RenderTexture.active = previous;
            var path = $"{PreviewDir}/{name}.png";
            File.WriteAllBytes(path, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
            Debug.Log($"[Board3DTestBuilder] preview: {path}");
        }
    }
}
