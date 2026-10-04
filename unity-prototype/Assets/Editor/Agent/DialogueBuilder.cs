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
    /// 会話の画面（プロローグ1-1 計画の段2）の確認: 仮の立ち絵を取り込み、戦闘の盤面の上でシナリオのブロックを流して撮る。
    /// 立ち絵は今の仮の絵（立ち絵透過済み/）。会話用の立ち絵が届いたら差し替える（立ち絵担当）
    /// </summary>
    public static class DialogueBuilder
    {
        private const string PortraitDir = "Assets/Art/Portraits/Dialogue";
        private const string ScenarioPath = "Assets/Data/Scenario/prologue_1_1.json";

        // 話者の名前 → 仮の立ち絵（リポジトリの 立ち絵透過済み/。元の絵は書き換えない）
        private static readonly (string name, string source)[] Sources =
        {
            ("アルシェ", "../立ち絵透過済み/アルシェ幼少期表情/元気_transparent.png"),
            ("カリマ", "../立ち絵透過済み/カリマ幼少期表情/ChatGPT Image 2026年5月29日 01_46_01_transparent.png"),
            ("キャリー", "../立ち絵透過済み/キャリー 立ち絵.png"),
            ("ヘンリー", "../立ち絵透過済み/ヘンリー 立ち絵.png"),
            ("ギュンター", "../立ち絵透過済み/ギュンター立ち絵_transparent.png"),
        };

        [MenuItem("Srpg/会話の画面の確認の画像を撮る")]
        public static void Run()
        {
            try
            {
                Shoot();
                Debug.Log("[DialogueBuilder] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        /// <summary>仮の立ち絵を取り込み、見せる範囲（頭の上〜膝あたり）を求める</summary>
        internal static DialogueView.Portrait[] ImportPortraits()
        {
            Directory.CreateDirectory(PortraitDir);
            var list = new List<DialogueView.Portrait>();
            foreach (var (name, source) in Sources)
            {
                string dest = $"{PortraitDir}/{name}.png";
                // 元の絵が見つからなければ、前に取り込んだ絵をそのまま使う（元のフォルダの整理で消えても、立ち絵が消えないように）
                if (!File.Exists(source) && !File.Exists(dest)) { Debug.LogWarning($"[DialogueBuilder] 立ち絵がない: {source}"); continue; }
                if (!File.Exists(source)) Debug.LogWarning($"[DialogueBuilder] 元の立ち絵がないので、取り込み済みの絵を使う: {source}");
                else if (!File.Exists(dest) || !File.ReadAllBytes(source).AsSpan().SequenceEqual(File.ReadAllBytes(dest)))
                    File.Copy(source, dest, true);
                AssetDatabase.ImportAsset(dest, ImportAssetOptions.ForceSynchronousImport);
                var importer = (TextureImporter)AssetImporter.GetAtPath(dest);
                importer.textureType = TextureImporterType.Default;
                importer.alphaIsTransparency = true;
                importer.mipmapEnabled = false;
                importer.maxTextureSize = 2048;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.SaveAndReimport();
                // 見せる範囲: 描かれている所（不透明な所）の上端から、その高さの 62% まで。横は描かれている所の中央
                var probe = new Texture2D(2, 2);
                probe.LoadImage(File.ReadAllBytes(dest));
                var (x0, y0, x1, y1) = OpaqueBounds(probe);   // 上が 0
                int w = probe.width, h = probe.height;
                UnityEngine.Object.DestroyImmediate(probe);
                float top = Mathf.Max(0, y0 - (y1 - y0) * 0.03f);
                float showH = (y1 - y0) * 0.62f;
                float showW = Mathf.Max((x1 - x0) * 1.05f, showH * 0.5f);
                float cx = (x0 + x1) * 0.5f;
                var uv = new Rect((cx - showW * 0.5f) / w, 1f - (top + showH) / h, showW / w, showH / h);
                list.Add(new DialogueView.Portrait { name = name, texture = AssetDatabase.LoadAssetAtPath<Texture2D>(dest), uv = uv });
            }
            return list.ToArray();
        }

        private const string CornerSource = "../prototypes/silver-ui-extension/assets/silver-corner-sculpted-source.png";   // Codex の見本の銀細工（左上の形）
        private const string CornerPath = "Assets/Art/UI/dialogue_corner_silver.png";

        /// <summary>台詞枠の四隅の銀細工を取り込む（見せるのは 76px なので 256 に縮める）</summary>
        private static Texture2D ImportCorner()
        {
            if (File.Exists(CornerSource) && (!File.Exists(CornerPath) || !File.ReadAllBytes(CornerSource).AsSpan().SequenceEqual(File.ReadAllBytes(CornerPath))))
            {
                File.Copy(CornerSource, CornerPath, true);
                AssetDatabase.ImportAsset(CornerPath, ImportAssetOptions.ForceSynchronousImport);
                var importer = (TextureImporter)AssetImporter.GetAtPath(CornerPath);
                importer.textureType = TextureImporterType.Default;
                importer.alphaIsTransparency = true;
                importer.mipmapEnabled = false;
                importer.maxTextureSize = 256;
                importer.wrapMode = TextureWrapMode.Clamp;
                importer.SaveAndReimport();
            }
            return AssetDatabase.LoadAssetAtPath<Texture2D>(CornerPath);
        }

        private static (int x0, int y0, int x1, int y1) OpaqueBounds(Texture2D tex)
        {
            var px = tex.GetPixels32();
            int w = tex.width, h = tex.height, x0 = w, x1 = 0, y0 = h, y1 = 0;
            for (int y = 0; y < h; y += 2)
            for (int x = 0; x < w; x += 2)
            {
                if (px[y * w + x].a < 24) continue;
                int top = h - 1 - y;   // 画像の上から
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (top < y0) y0 = top;
                if (top > y1) y1 = top;
            }
            return x0 > x1 ? (0, 0, w, h) : (x0, y0, x1, y1);
        }

        /// <summary>シーンに会話の画面を置く（▶のシーンにも使う）</summary>
        internal static DialogueView CreateView(Camera camera)
        {
            var go = new GameObject("DialogueView");
            var view = go.AddComponent<DialogueView>();
            var so = new SerializedObject(view);
            so.FindProperty("targetCamera").objectReferenceValue = camera;
            so.FindProperty("regularFont").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/NotoSerifJP-Regular.ttf");
            so.FindProperty("boldFont").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/NotoSerifJP-Bold.ttf");
            so.FindProperty("panelSprite").objectReferenceValue = AssetDatabase.LoadAllAssetsAtPath("Assets/Art/UI/panel_even.png").OfType<Sprite>().FirstOrDefault();
            // 原作者が調整した立ち絵の位置（会話中に立ち絵を5回たたく → 保存。あれば）
            so.FindProperty("adjustJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>("Assets/Data/portrait_adjust.json");
            // 銀細工の台詞枠（採用版md/SILVER_DIALOGUE_UI_DIRECTION.md）: 寸法と色、四隅の銀細工
            so.FindProperty("styleJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>("Assets/Data/Dialogue/dialogue_style.json");
            so.FindProperty("cornerTexture").objectReferenceValue = ImportCorner();
            var portraits = ImportPortraits();
            var prop = so.FindProperty("portraits");
            prop.arraySize = portraits.Length;
            for (int i = 0; i < portraits.Length; i++)
            {
                var e = prop.GetArrayElementAtIndex(i);
                e.FindPropertyRelative("name").stringValue = portraits[i].name;
                e.FindPropertyRelative("texture").objectReferenceValue = portraits[i].texture;
                e.FindPropertyRelative("uv").rectValue = portraits[i].uv;
            }
            so.ApplyModifiedPropertiesWithoutUndo();
            return view;
        }

        private static void Shoot()
        {
            EditorSceneManager.OpenScene("Assets/Scenes/Battle3D.unity", OpenSceneMode.Single);
            var controller = UnityEngine.Object.FindFirstObjectByType<Battle3DController>();
            var camera = UnityEngine.Object.FindFirstObjectByType<Camera>();
            var rt = new RenderTexture(Board3DTestBuilder.PreviewWidth, Board3DTestBuilder.PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)Board3DTestBuilder.PreviewWidth / Board3DTestBuilder.PreviewHeight;
            ShaderUtil.allowAsyncCompilation = false;
            controller.Setup();
            controller.View.SetView(true, 0, true);
            controller.View.SetOverview(false, true);
            controller.FocusOnAllies(true);
            camera.Render();

            var scenario = JsonUtility.FromJson<ScenarioFile>(File.ReadAllText(ScenarioPath));
            var view = CreateView(camera);
            var items = new List<string>();
            view.OnItem += items.Add;

            void Shot(string blockId, params int[] steps)
            {
                var block = scenario.Block(blockId) ?? throw new InvalidOperationException($"ブロックがない: {blockId}");
                view.Play(block);
                int at = 0;
                foreach (int step in steps)
                {
                    while (at < step) { view.Advance(); at++; }
                    Canvas.ForceUpdateCanvases();
                    var line = view.CurrentLine;
                    Board3DTestBuilder.Render(camera, rt, $"Dialogue_{blockId.Split('.').Last()}_{step:00}");
                    Debug.Log($"[DialogueBuilder] {blockId} {step}: {line?.speaker}「{line?.text?.Replace("\n", " ")}」 左 {string.Join("・", view.LeftCast)} / 右 {string.Join("・", view.RightCast)}");
                }
                view.Close();
            }

            Shot("prologue_1_1.b01", 0);           // 携帯端末の音（場面説明）
            Shot("prologue_1_1.b06", 0, 1, 2);     // キャリーとの挨拶（キャリー右・アルシェ左）
            Shot("prologue_1_1.b08", 0, 1);        // ヘンリー
            Shot("prologue_1_1.b10", 0, 3, 4);     // 訓練場（カリマ・アルシェ左、ギュンター右）
            // 立ち絵の位置の調整パネル（会話中に立ち絵を5回たたくと開く）
            view.Play(scenario.Block("prologue_1_1.b06"));
            view.Advance();
            view.OpenAdjuster("キャリー");
            Canvas.ForceUpdateCanvases();
            Board3DTestBuilder.Render(camera, rt, "Dialogue_adjust");
            if (!view.AdjusterOpen) throw new InvalidOperationException("調整パネルが開かなかった");
            view.Close();
            Debug.Log($"[DialogueBuilder] 手に入れた物: {string.Join("・", items)}");

            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
            EditorSceneManager.OpenScene("Assets/Scenes/Battle3D.unity", OpenSceneMode.Single);   // 変えた状態は保存しない
        }
    }
}
