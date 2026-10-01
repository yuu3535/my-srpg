using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// 箱庭の画面の仕上げ（段A。原作者 2026-10-01）を、盤面の描画の設定（Renderer3D）に入れる。何度呼んでも二重には入れない。
    ///   1. 物の根元の影（URP の ScreenSpaceAmbientOcclusion）
    ///   2. 線画の輪郭・上下のぼかし・色調・四隅の暗さ（Srpg/DioramaComposite。キャラ・範囲・UI を描く前にかける）
    /// 2 は _DioramaFX が 0 の場所（箱庭でない場所）では何もしない（Board3DView が場所ごとに決める）
    /// </summary>
    internal static class DioramaRenderSetup
    {
        private const string ShaderPath = "Assets/Shaders/DioramaComposite.shader";
        private const string MaterialPath = "Assets/Shaders/DioramaComposite.mat";
        private const string CompositeName = "DioramaComposite";
        private const string AoName = "DioramaAmbientOcclusion";

        internal static void Ensure(UniversalRendererData data)
        {
            if (data == null) return;
            bool changed = false;
            if (!data.rendererFeatures.Any(f => f != null && f.name == AoName))
            {
                var ao = ScriptableObject.CreateInstance<ScreenSpaceAmbientOcclusion>();
                ao.name = AoName;
                Add(data, ao);
                var so = new SerializedObject(ao);
                // 1マス＝1。根元に薄く（強すぎると汚れて見える）。スマホのため半分の解像度
                Set(so, "m_Settings.Intensity", 1.1f);
                Set(so, "m_Settings.Radius", 0.32f);
                Set(so, "m_Settings.DirectLightingStrength", 0.3f);
                SetBool(so, "m_Settings.Downsample", true);
                so.ApplyModifiedPropertiesWithoutUndo();
                changed = true;
            }
            if (!data.rendererFeatures.Any(f => f != null && f.name == CompositeName))
            {
                var feature = ScriptableObject.CreateInstance<FullScreenPassRendererFeature>();
                feature.name = CompositeName;
                feature.passMaterial = EnsureMaterial();
                feature.injectionPoint = FullScreenPassRendererFeature.InjectionPoint.BeforeRenderingTransparents;
                feature.requirements = ScriptableRenderPassInput.Depth | ScriptableRenderPassInput.Normal;
                feature.fetchColorBuffer = true;
                Add(data, feature);
                changed = true;
            }
            if (changed)
            {
                EditorUtility.SetDirty(data);
                AssetDatabase.SaveAssets();
            }
        }

        private static Material EnsureMaterial()
        {
            var material = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if (material != null) return material;
            AssetDatabase.ImportAsset(ShaderPath, ImportAssetOptions.ForceSynchronousImport);
            var shader = AssetDatabase.LoadAssetAtPath<Shader>(ShaderPath) ?? Shader.Find("Srpg/DioramaComposite");
            material = new Material(shader) { name = "DioramaComposite" };
            AssetDatabase.CreateAsset(material, MaterialPath);
            return material;
        }

        /// <summary>描画の設定に機能を足す（URP のインスペクターと同じく、機能の一覧と番号の一覧の両方へ）</summary>
        private static void Add(UniversalRendererData data, ScriptableRendererFeature feature)
        {
            AssetDatabase.AddObjectToAsset(feature, data);
            AssetDatabase.TryGetGUIDAndLocalFileIdentifier(feature, out _, out long localId);
            var so = new SerializedObject(data);
            var features = so.FindProperty("m_RendererFeatures");
            var map = so.FindProperty("m_RendererFeatureMap");
            features.arraySize++;
            features.GetArrayElementAtIndex(features.arraySize - 1).objectReferenceValue = feature;
            map.arraySize++;
            map.GetArrayElementAtIndex(map.arraySize - 1).longValue = localId;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void Set(SerializedObject so, string path, float value)
        {
            var p = so.FindProperty(path);
            if (p != null) p.floatValue = value;
            else Debug.LogWarning($"[DioramaRenderSetup] 設定が見つからない: {path}");
        }

        private static void SetBool(SerializedObject so, string path, bool value)
        {
            var p = so.FindProperty(path);
            if (p != null) p.boolValue = value;
            else Debug.LogWarning($"[DioramaRenderSetup] 設定が見つからない: {path}");
        }
    }
}
