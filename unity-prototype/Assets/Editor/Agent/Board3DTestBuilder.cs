using System;
using System.Collections.Generic;
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
        internal const string ScenePath = "Assets/Scenes/Board3DTest.unity";
        internal const string RendererPath = "Assets/Settings/Renderer3D.asset";
        internal const string PreviewDir = "Assets/Previews";
        internal const string TokenDir = "Assets/Art/Tokens";                         // キャラの盤面の絵（BattleM1 と同じ）
        internal const string TreePicturePath = "Assets/Art/Board3D/tree_picture.png";  // 板に貼る仮の木の絵（ここで描く）
        internal const string TextureDir = "Assets/Art/Board3D/Textures";                // T5 の仮の模様（tools/make_board_textures.py）
        internal const string VolumeProfilePath = "Assets/Settings/Board3DVolume.asset";  // 光のにじみ（ブルーム）の設定
        // ゲームのUI素材（ブラウザ版の assets/ui/ から複製）。盤面の枠 D4（味方）・D5（敵）
        internal static readonly (string source, string dest)[] UiFrames =
        {
            ("../assets/ui/select_ally_d4.png", "Assets/Art/Board3D/select_ally_d4.png"),
            ("../assets/ui/select_enemy_d5.png", "Assets/Art/Board3D/select_enemy_d5.png"),
        };
        internal const int PreviewWidth = 1688;   // スマホの横画面（844×390 の2倍）
        internal const int PreviewHeight = 780;

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
        internal static int EnsureUniversalRenderer()
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

            CreateStage(rendererIndex, out var camera, out var light, out var volume);
            var controllerObject = new GameObject("Board3DTest");
            var controller = controllerObject.AddComponent<Board3DView>();
            ConfigureView(controller, camera, light, Board3DLayout.Units.Select(u => u.id), buildOnStart: true);

            // 確認用の画像（画面の大きさに合わせてから、マスを押す位置を計算する）
            var rt = new RenderTexture(PreviewWidth, PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)PreviewWidth / PreviewHeight;
            controller.Textured = false;
            controller.Lanterns = false;
            volume.enabled = false;
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
                controller.SetView(true, turn * 2, true);
                Render(camera, rt, $"Board3D_T3_turn{turn * 90}");
            }
            controller.SetRawAngles(30f, 0f);   // 0°と90°の間（-45° → 45°の途中）
            Render(camera, rt, "Board3D_T3_turning");

            // T4: キャラ・木・壁を立てた盤面（真上・4方向）と、寄って見たところ
            controller.SetView(false, 0, true);
            Render(camera, rt, "Board3D_T4_top");
            for (int turn = 0; turn < 4; turn++)
            {
                controller.SetView(true, turn * 2, true);
                Render(camera, rt, $"Board3D_T4_turn{turn * 90}");
            }
            // 寄って見る: 0° で石の壁のまわり ／ 180° で3Dの木の後ろに立つリングホルム
            controller.SetCloseView(30f, -45f, Board3DLayout.TopCenter(new Vector2Int(2, 3)) + Vector3.up * 0.4f, 2.3f);
            Render(camera, rt, "Board3D_T4_close_wall");
            controller.SetCloseView(30f, 135f, Board3DLayout.TopCenter(new Vector2Int(1, 6)) + Vector3.up * 0.5f, 2.3f);
            Render(camera, rt, "Board3D_T4_close_tree");

            // 足元の見せ方の比較（台座 ／ 影だけ ／ 影と陣営の色の輪）。斜めで寄ったところと、真上
            foreach (Board3DView.FootStyle foot in Enum.GetValues(typeof(Board3DView.FootStyle)))
            {
                controller.Foot = foot;
                controller.Setup();
                controller.SetCloseView(30f, -45f, Board3DLayout.TopCenter(new Vector2Int(5, 4)) + Vector3.up * 0.4f, 3.4f);
                Render(camera, rt, $"Board3D_T4_foot_{foot}_tilt");
                controller.SetView(false, 0, true);
                Render(camera, rt, $"Board3D_T4_foot_{foot}_top");
            }
            controller.Foot = Board3DView.FootStyle.TeamFrame;

            // T5: 仮の模様（ドット絵の粗さ）を貼り、見え方を4通りで比べる
            //   A 模様だけ ／ B 粗い解像度で描いて点のまま拡大 ／ C 色を寄せて遠くを霧で沈める ／ D B と C の両方
            // 原作者の決定（2026-09-27）で C に。原作TRPGの背景素材の色に寄せて作り直した C を「C2」として撮る
            // （A・B・C・D の比較の画像は、決定の記録として残してある）
            controller.Textured = true;
            controller.Lanterns = true;
            volume.enabled = true;
            SetMoodC2();
            controller.Setup();
            controller.SetView(true, 0, true);
            Render(camera, rt, "Board3D_T5_C2_board");
            controller.SetCloseView(30f, -45f, Board3DLayout.TopCenter(new Vector2Int(4, 4)) + Vector3.up * 0.3f, 2.6f);
            Render(camera, rt, "Board3D_T5_C2_close");
            controller.SetCloseView(30f, -45f, Board3DLayout.TopCenter(new Vector2Int(5, 1)) + Vector3.up * 0.3f, 2.6f);
            Render(camera, rt, "Board3D_T5_C2_gate");
            controller.SetView(true, 4, true);
            Render(camera, rt, "Board3D_T5_C2_turn180");
            controller.SetView(true, 1, true);   // 正面（原作者 2026-09-27）
            Render(camera, rt, "Board3D_T5_C2_front");

            // T6: 寄りの画面を基本にする（原作者 2026-09-27）。盤面のまわりの景色と、いちばん奥の背景（M1）
            controller.SetView(true, 0, true);
            Render(camera, rt, "Board3D_T6_overview");
            controller.SetOverview(false, true);
            controller.FocusOnPoint(Board3DLayout.TopCenter(new Vector2Int(4, 5)), true);
            Render(camera, rt, "Board3D_T6_close");
            controller.FocusOnPoint(Board3DLayout.TopCenter(new Vector2Int(6, 1)), true);
            Render(camera, rt, "Board3D_T6_close_gate");
            controller.FocusOnPoint(Board3DLayout.TopCenter(new Vector2Int(1, 6)), true);
            Render(camera, rt, "Board3D_T6_close_edge");
            controller.FocusOnPoint(Board3DLayout.TopCenter(new Vector2Int(4, 5)), true);
            controller.SetView(true, 1, true);
            Render(camera, rt, "Board3D_T6_close_front");
            controller.SetView(false, 0, true);
            Render(camera, rt, "Board3D_T6_close_top");
            controller.SetOverview(true, true);
            controller.SetView(true, 0, true);

            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
            controller.Textured = true;
            controller.ClearBoard();   // 盤面は再生したときに作る（作ったマテリアルはシーンに保存できないため）
            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
        }

        /// <summary>
        /// 絵の基準点から、一番下の色のある行（不透明度50%以上が3画素以上並ぶ行）までの距離を、絵の高さに対する割合で返す。
        /// 足の下の余白の量が絵ごとに違うため、この分だけ絵を下げて足の裏をマスの面にそろえる。
        /// 足より下に広がる魔法の光なども「色のある行」に入るので、その絵は光の下端が面に来る
        /// </summary>
        internal static float FootFromPivot(Sprite sprite, string path)
        {
            var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            tex.LoadImage(File.ReadAllBytes(path));
            var pixels = tex.GetPixels32();
            int w = tex.width, h = tex.height, lowest = 0;
            for (int y = 0; y < h; y++)   // y=0 が下端
            {
                int count = 0;
                for (int x = 0; x < w && count < 3; x++)
                    if (pixels[y * w + x].a >= 128) count++;
                if (count >= 3) { lowest = y; break; }
            }
            UnityEngine.Object.DestroyImmediate(tex);
            float pivot = sprite.pivot.y / sprite.rect.height;
            float foot = (float)lowest / h;
            Debug.Log($"[Board3DTestBuilder] feet {Path.GetFileName(path)}: 一番下の色 {foot:P1}・基準点 {pivot:P1}");
            return foot - pivot;
        }

        /// <summary>
        /// 画像を書き込む。別のアプリ（エクスプローラーの縮小表示など）が一瞬ファイルを開いていると失敗するので、少し待ってやり直す
        /// </summary>
        internal static void WriteWithRetry(string path, byte[] bytes)
        {
            for (int attempt = 1; ; attempt++)
            {
                try
                {
                    File.WriteAllBytes(path, bytes);
                    return;
                }
                catch (IOException) when (attempt < 10)
                {
                    System.Threading.Thread.Sleep(300 * attempt);
                }
            }
        }

        /// <summary>
        /// 作り直した C（docs/10-design/map/MAP_COLOR_MOOD_DIRECTION_2026-09-27.md）:
        /// 主な光は琥珀、まわりの明るさ（影の色）は青緑、霧は弱めの深い藍。シーンにもこの設定で保存する
        /// </summary>
        internal static void SetMoodC2()
        {
            var light = UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None).FirstOrDefault(l => l.type == LightType.Directional);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color32(16, 34, 44, 255);
            RenderSettings.fogStartDistance = 29f;
            RenderSettings.fogEndDistance = 46f;
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color32(76, 102, 108, 255);
            if (light != null)
            {
                light.color = new Color32(255, 216, 168, 255);
                light.intensity = 1.45f;
            }
        }

        /// <summary>光のにじみ（ブルーム）の設定を用意する。明るい光（炎・門の光）だけがにじむ</summary>
        internal static VolumeProfile EnsureVolumeProfile()
        {
            var profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(VolumeProfilePath);
            if (profile != null) return profile;
            profile = ScriptableObject.CreateInstance<VolumeProfile>();
            AssetDatabase.CreateAsset(profile, VolumeProfilePath);
            var bloom = profile.Add<Bloom>(true);
            bloom.threshold.Override(1.0f);
            bloom.intensity.Override(0.8f);
            bloom.scatter.Override(0.65f);
            AssetDatabase.AddObjectToAsset(bloom, profile);
            EditorUtility.SetDirty(profile);
            AssetDatabase.SaveAssets();
            return profile;
        }

        /// <summary>仮の模様を、点のまま拡大・繰り返しで読み込む。模様のパスを返す</summary>
        internal static string[] ConfigureBoardTextures()
        {
            if (!Directory.Exists(TextureDir)) return Array.Empty<string>();
            var paths = Directory.GetFiles(TextureDir, "*.png").Select(p => p.Replace(Path.DirectorySeparatorChar, '/')).OrderBy(p => p, StringComparer.Ordinal).ToArray();
            foreach (var path in paths)
            {
                AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
                var importer = (TextureImporter)AssetImporter.GetAtPath(path);
                importer.textureType = TextureImporterType.Default;
                importer.filterMode = FilterMode.Point;
                importer.wrapMode = TextureWrapMode.Repeat;
                importer.mipmapEnabled = false;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.SaveAndReimport();
            }
            return paths;
        }

        /// <summary>ゲームのUI素材（盤面の枠）を複製し、マス1つ分の絵として読み込む</summary>
        internal static void CopyUiFrames()
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
        internal static void WriteTreePicture()
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

        /// <summary>3Dの盤面の場: カメラ（3D用の描画設定・光のにじみ）、光のにじみの設定、向きのある光</summary>
        internal static void CreateStage(int rendererIndex, out Camera camera, out Light light, out Volume volume)
        {
            var cameraObject = new GameObject("Main Camera") { tag = "MainCamera" };
            camera = cameraObject.AddComponent<Camera>();
            camera.orthographic = true;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color32(14, 11, 26, 255);   // 黒紫
            var cameraData = cameraObject.AddComponent<UniversalAdditionalCameraData>();
            cameraData.SetRenderer(rendererIndex);
            cameraData.renderPostProcessing = true;   // 光のにじみ（ブルーム）
            var volumeObject = new GameObject("Global Volume");
            volume = volumeObject.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.sharedProfile = EnsureVolumeProfile();

            var lightObject = new GameObject("Directional Light");
            light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.15f;
            light.color = new Color32(255, 244, 226, 255);
            light.shadows = LightShadows.Soft;
            lightObject.transform.rotation = Quaternion.Euler(55f, -30f, 0f);
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color32(78, 72, 96, 255);
        }

        /// <summary>盤面の表示（Board3DView）に、カメラ・光・模様・木の絵・陣営の枠・キャラの絵（足の裏の位置つき）を渡す</summary>
        // いちばん奥の背景（発注書 第3版 M1。アイコン素材/発注UI_v3/M1.png を写したもの）
        internal const string BackdropPath = "Assets/Art/Board3D/bg_battle_m1.png";

        internal static void ConfigureView(Board3DView view, Camera camera, Light light, IEnumerable<string> unitIds, bool buildOnStart, bool startOverview = true)
        {
            var so = new SerializedObject(view);
            so.FindProperty("startOverview").boolValue = startOverview;
            so.FindProperty("backdrop").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Texture2D>(BackdropPath);
            so.FindProperty("targetCamera").objectReferenceValue = camera;
            so.FindProperty("keyLight").objectReferenceValue = light;
            so.FindProperty("buildOnStart").boolValue = buildOnStart;
            so.FindProperty("treeSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(TreePicturePath);
            var texturePaths = ConfigureBoardTextures();
            var texturesProp = so.FindProperty("boardTextures");
            texturesProp.arraySize = texturePaths.Length;
            for (int i = 0; i < texturePaths.Length; i++)
            {
                var element = texturesProp.GetArrayElementAtIndex(i);
                element.FindPropertyRelative("name").stringValue = Path.GetFileNameWithoutExtension(texturePaths[i]);
                element.FindPropertyRelative("texture").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePaths[i]);
            }
            so.FindProperty("allyFrameSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(UiFrames[0].dest);
            so.FindProperty("enemyFrameSprite").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Sprite>(UiFrames[1].dest);
            var withSprite = unitIds
                .Select(id => (id, sprite: AssetDatabase.LoadAssetAtPath<Sprite>($"{TokenDir}/{id}.png")))
                .Where(u => u.sprite != null).ToArray();
            var spritesProp = so.FindProperty("unitSprites");
            spritesProp.arraySize = withSprite.Length;
            for (int i = 0; i < withSprite.Length; i++)
            {
                var element = spritesProp.GetArrayElementAtIndex(i);
                element.FindPropertyRelative("id").stringValue = withSprite[i].id;
                element.FindPropertyRelative("sprite").objectReferenceValue = withSprite[i].sprite;
                element.FindPropertyRelative("footFromPivot").floatValue = FootFromPivot(withSprite[i].sprite, $"{TokenDir}/{withSprite[i].id}.png");
            }
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        /// <summary>そのマスの天面の中心を画面上で押したことにする（押して選べるかの確認）</summary>
        private static void Tap(Board3DView controller, Camera camera, Vector2Int cell)
        {
            var screen = camera.WorldToScreenPoint(controller.transform.position + Board3DLayout.TopCenter(cell));
            bool picked = controller.PickAtScreen(screen);
            Debug.Log($"[Board3DTestBuilder] tap {cell} at {screen} → {(picked ? controller.Selected.ToString() : "外れ")}");
            if (!picked || controller.Selected != cell)
                throw new InvalidOperationException($"マス {cell} を押して選べなかった");
        }

        /// <summary>
        /// 画像を書き出す。downscale が2以上なら、その分だけ粗い解像度で描いてから、ぼかさず点のまま元の大きさへ拡大する
        /// （T5 の「粗い解像度で描いて拡大」。3Dの盤面もキャラのドット絵と同じ粗さになる）
        /// </summary>
        internal static void Render(Camera camera, RenderTexture rt, string name, int downscale = 1)
        {
            Directory.CreateDirectory(PreviewDir);
            var previous = RenderTexture.active;
            Texture2D tex;
            if (downscale <= 1)
            {
                camera.Render();
                RenderTexture.active = rt;
                tex = new Texture2D(PreviewWidth, PreviewHeight, TextureFormat.RGB24, false);
                tex.ReadPixels(new Rect(0, 0, PreviewWidth, PreviewHeight), 0, 0);
                tex.Apply();
            }
            else
            {
                int w = PreviewWidth / downscale, h = PreviewHeight / downscale;
                var small = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32) { filterMode = FilterMode.Point };
                camera.targetTexture = small;
                camera.Render();
                RenderTexture.active = small;
                var lowTex = new Texture2D(w, h, TextureFormat.RGB24, false);
                lowTex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
                var low = lowTex.GetPixels32();
                var big = new Color32[PreviewWidth * PreviewHeight];
                for (int y = 0; y < PreviewHeight; y++)
                for (int x = 0; x < PreviewWidth; x++)
                    big[y * PreviewWidth + x] = low[Math.Min(h - 1, y / downscale) * w + Math.Min(w - 1, x / downscale)];
                tex = new Texture2D(PreviewWidth, PreviewHeight, TextureFormat.RGB24, false);
                tex.SetPixels32(big);
                tex.Apply();
                camera.targetTexture = rt;
                UnityEngine.Object.DestroyImmediate(lowTex);
                UnityEngine.Object.DestroyImmediate(small);
            }
            RenderTexture.active = previous;
            var path = $"{PreviewDir}/{name}.png";
            WriteWithRetry(path, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
            Debug.Log($"[Board3DTestBuilder] preview: {path}");
        }
    }
}
