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
    /// 最初の画面は探索（Explore3D。プロローグ1-1）。書き出し先は unity-prototype/Builds/WebGL（Git には入れない）。
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
                PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
                PlayerSettings.WebGL.decompressionFallback = true;   // GitHub Pages は圧縮の知らせを付けないので、読み込み側でほどく
                PlayerSettings.WebGL.dataCaching = true;
                PlayerSettings.defaultWebScreenWidth = 1266;          // 横画面（844×390 と同じ比率）
                PlayerSettings.defaultWebScreenHeight = 586;
                PlayerSettings.productName = "自作SRPG（Unity版の試し）";
                var watch = Stopwatch.StartNew();
                var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
                {
                    scenes = new[] { "Assets/Scenes/Explore3D.unity" },
                    locationPathName = OutDir,
                    target = BuildTarget.WebGL,
                    options = BuildOptions.None,
                });
                watch.Stop();
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
