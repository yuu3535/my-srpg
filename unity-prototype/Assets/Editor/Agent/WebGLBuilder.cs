using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// Unity版を WebGL に書き出す（ブラウザ・スマホで遊べる形。GitHub Pages に置く試し。原作者 2026-09-28）。
    /// 最初の画面は探索（Explore3D）の入口（プロローグ1-1 か 試験の戦闘 Battle3D を選ぶ）。書き出し先は unity-prototype/Builds/WebGL（Git には入れない）。
    ///
    /// 盤面は動かしながら材質を作る（Shader.Find）ので、書き出しで描画の部品が外されないよう、
    /// 使う組み合わせの材質を Assets/Resources/ShaderKeep に置いて必ず含める。霧も、実行中に切り替えるので残す
    /// </summary>
    public static class WebGLBuilder
    {
        private const string OutDir = "Builds/WebGL";
        private const string KeepDir = "Assets/Resources/ShaderKeep";

        [MenuItem("Srpg/WebGL に書き出す（探索）")]
        public static void Build()
        {
            try
            {
                KeepShaders();
                KeepFog();
                CompressTexturesForWeb();
                var mipped = DropNpotMipmapsForWeb();
                PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
                PlayerSettings.WebGL.decompressionFallback = true;   // GitHub Pages は圧縮の知らせを付けないので、読み込み側でほどく
                PlayerSettings.WebGL.dataCaching = true;
                PlayerSettings.defaultWebScreenWidth = 1266;          // 横画面（844×390 と同じ比率）
                PlayerSettings.defaultWebScreenHeight = 586;
                PlayerSettings.productName = "自作SRPG（Unity版の試し）";
                var watch = Stopwatch.StartNew();
                var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
                {
                    // 最初は探索（入口の画面 StartMenu で「プロローグから」か「試験の戦闘」を選ぶ。原作者 2026-10-03）
                    scenes = new[] { "Assets/Scenes/Explore3D.unity", "Assets/Scenes/Battle3D.unity", "Assets/Scenes/Corridor2D.unity" },
                    locationPathName = OutDir,
                    target = BuildTarget.WebGL,
                    options = BuildOptions.None,
                });
                watch.Stop();
                RestoreMipmaps(mipped);
                var s = report.summary;
                long bytes = Directory.Exists(OutDir) ? Directory.GetFiles(OutDir, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length) : 0;
                Debug.Log($"[WebGLBuilder] {s.result}・{watch.Elapsed.TotalMinutes:0.0}分・書き出しの合計 {bytes / 1024f / 1024f:0.0}MB・エラー {s.totalErrors}");
                foreach (var f in Directory.Exists(OutDir) ? Directory.GetFiles(OutDir, "*", SearchOption.AllDirectories) : Array.Empty<string>())
                    Debug.Log($"[WebGLBuilder] {f.Replace('\\', '/')} {new FileInfo(f).Length / 1024f / 1024f:0.00}MB");
                if (s.result != BuildResult.Succeeded && Application.isBatchMode) EditorApplication.Exit(1);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        /// <summary>
        /// 絵を WebGL の書き出しだけ圧縮する（2026-10-03: 書き出しの 9 割が圧縮していない絵で、83MB あった）。
        /// スマホ向けの ASTC 6×6（透明あり）。エディタ・確認の画像の見え方は変えない（WebGL の上書き設定だけ）。
        /// 大きすぎる絵は 2048 まで（UI の枠・ボタンは 1024 まで）
        /// </summary>
        private static void CompressTexturesForWeb()
        {
            EditorUserBuildSettings.webGLBuildSubtarget = WebGLTextureSubtarget.ASTC;
            int changed = 0;
            foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/Art", "Assets/Resources" }))
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                if (!(AssetImporter.GetAtPath(path) is TextureImporter importer)) continue;
                int max = path.StartsWith("Assets/Art/UI/") ? 1024 : 2048;
                var settings = importer.GetPlatformTextureSettings("WebGL");
                if (settings.overridden && settings.format == TextureImporterFormat.ASTC_6x6 && settings.maxTextureSize == max) continue;
                settings.overridden = true;
                settings.format = TextureImporterFormat.ASTC_6x6;
                settings.maxTextureSize = max;
                settings.textureCompression = TextureImporterCompression.Compressed;
                importer.SetPlatformTextureSettings(settings);
                importer.SaveAndReimport();
                changed++;
            }
            Debug.Log($"[WebGLBuilder] 絵の圧縮（WebGL・ASTC 6×6）を設定: {changed} 枚");
        }

        /// <summary>
        /// WebGL では、縦横が2の累乗でない絵にミップマップがあると圧縮されず RGBA32 のまま入る（2026-10-03 に確かめた:
        /// 地面の絵 1枚で 18MB あった）。書き出しの間だけミップマップを外し、終わったら RestoreMipmaps で戻す
        /// （エディタ・確認の画像の見え方は変えない）。木の絵は小さく出すので、WebGL では 512 まで縮めてちらつきを抑える
        /// </summary>
        private static System.Collections.Generic.List<string> DropNpotMipmapsForWeb()
        {
            var changed = new System.Collections.Generic.List<string>();
            foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/Art" }))
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                if (!(AssetImporter.GetAtPath(path) is TextureImporter importer) || !importer.mipmapEnabled) continue;
                var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if (tex == null || (Mathf.IsPowerOfTwo(tex.width) && Mathf.IsPowerOfTwo(tex.height))) continue;
                importer.mipmapEnabled = false;
                if (path.Contains("/Trees/"))
                {
                    var web = importer.GetPlatformTextureSettings("WebGL");
                    web.maxTextureSize = 512;
                    importer.SetPlatformTextureSettings(web);
                }
                importer.SaveAndReimport();
                changed.Add(path);
            }
            Debug.Log($"[WebGLBuilder] 書き出しの間だけミップマップを外した絵: {changed.Count} 枚");
            return changed;
        }

        private static void RestoreMipmaps(System.Collections.Generic.List<string> paths)
        {
            if (paths == null) return;
            foreach (var path in paths)
            {
                if (!(AssetImporter.GetAtPath(path) is TextureImporter importer)) continue;
                importer.mipmapEnabled = true;
                EditorUtility.SetDirty(importer);
                importer.SaveAndReimport();
            }
            AssetDatabase.SaveAssets();
            // 戻ったか確かめる（2026-10-03: 3枚だけ戻らなかったことがあった）
            int left = paths.Count(p => AssetImporter.GetAtPath(p) is TextureImporter i && !i.mipmapEnabled);
            if (left > 0) Debug.LogWarning($"[WebGLBuilder] ミップマップが戻っていない絵が {left} 枚ある（.meta を git で戻す）");
        }

        /// <summary>確認用: WebGL での絵の形式と大きさを、大きい順に記録へ出す（どの絵が圧縮されていないかを見る）</summary>
        public static void ReportTextures()
        {
            var rows = AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/Art" })
                .Select(g => AssetDatabase.GUIDToAssetPath(g))
                .Select(p => (p, t: AssetDatabase.LoadAssetAtPath<Texture2D>(p)))
                .Where(x => x.t != null)
                .Select(x => (x.p, x.t, size: UnityEngine.Profiling.Profiler.GetRuntimeMemorySizeLong(x.t)))
                .OrderByDescending(x => x.size).Take(25);
            foreach (var (p, t, size) in rows)
            {
                var imp = (TextureImporter)AssetImporter.GetAtPath(p);
                Debug.Log($"[WebGLBuilder] 絵 {p} {t.width}x{t.height} {t.format} mip{t.mipmapCount} {size / 1024f / 1024f:0.0}MB 種類{imp.textureType}/{imp.spriteImportMode}");
            }
        }

        /// <summary>使う描画の組み合わせを材質にして Resources に置く（書き出しで必ず含まれる）</summary>
        private static void KeepShaders()
        {
            Directory.CreateDirectory(KeepDir);
            void Keep(string name, string shader, Action<Material> setup = null)
            {
                var sh = Shader.Find(shader);
                if (sh == null) { Debug.LogWarning($"[WebGLBuilder] シェーダーがない: {shader}"); return; }
                string path = $"{KeepDir}/{name}.mat";
                var m = AssetDatabase.LoadAssetAtPath<Material>(path);
                if (m == null) { m = new Material(sh); AssetDatabase.CreateAsset(m, path); }
                m.shader = sh;
                setup?.Invoke(m);
                EditorUtility.SetDirty(m);
            }
            Keep("LitOpaque", "Universal Render Pipeline/Lit");
            Keep("LitTransparent", "Universal Render Pipeline/Lit", m =>
            {
                // 隠している物の半透明（Board3DView.Occlusion.FadedMaterial と同じ）
                m.SetFloat("_Surface", 1f);
                m.SetFloat("_Blend", 0f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.SetFloat("_ZWrite", 0f);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            });
            Keep("LitCutout", "Universal Render Pipeline/Lit", m =>
            {
                // 背景が透明の絵の切り抜き（Board3DView.CutoutMaterial と同じ）
                m.SetFloat("_AlphaClip", 1f);
                m.EnableKeyword("_ALPHATEST_ON");
                m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.AlphaTest;
            });
            Keep("LitEmission", "Universal Render Pipeline/Lit", m => m.EnableKeyword("_EMISSION"));   // 光る材質（たいまつの炎など）
            Keep("Unlit", "Universal Render Pipeline/Unlit");
            // 箱庭の塗り（Srpg/DioramaToon）: ふつう・半透明の写し（隠している物）
            Keep("ToonOpaque", "Srpg/DioramaToon");
            Keep("ToonTransparent", "Srpg/DioramaToon", m =>
            {
                m.SetFloat("_Surface", 1f);
                m.SetFloat("_ZWrite", 0f);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            });
            Keep("SpriteUnlit", "Universal Render Pipeline/2D/Sprite-Unlit-Default");
            AssetDatabase.SaveAssets();
        }

        /// <summary>霧は実行中に時間帯で切り替える（Board3DMood）。シーンに霧がなくても、直線の霧の部品を残す</summary>
        private static void KeepFog()
        {
            var settings = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset").FirstOrDefault();
            if (settings == null) return;
            var so = new SerializedObject(settings);
            var strip = so.FindProperty("m_FogStripping");
            var linear = so.FindProperty("m_FogKeepLinear");
            if (strip != null) strip.intValue = 1;   // 自分で選ぶ
            if (linear != null) linear.boolValue = true;
            so.ApplyModifiedPropertiesWithoutUndo();
        }
    }
}
