using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace Srpg.Battle
{
    /// <summary>
    /// 隠れたキャラの見せ方（MAP_BOARD_METHOD_DECISION_2026-09-27 の推奨）:
    /// 高い物（木・壁・門・高いマス）がキャラ・選んだマス・カーソルのマスを隠しているときだけ、その物を半透明にする。
    /// 回す・真上に切り替えるだけに頼らない
    /// </summary>
    public partial class Board3DView
    {
        [SerializeField, Range(0f, 1f)] private float occluderAlpha = 0.35f;   // 隠している物の不透明度

        private class Occluder
        {
            public Renderer[] renderers;
            public Material[][] originals;
            public Bounds bounds;
            public bool faded;
        }

        private const float TallTile = 0.45f;   // これより高いマス（石の基礎・茂み・壁・景色の崖）は隠す物になりうる

        private readonly List<Occluder> occluders = new List<Occluder>();
        private readonly Dictionary<Material, Material> fadedMaterials = new Dictionary<Material, Material>();
        private readonly List<Vector3> occlusionPoints = new List<Vector3>();

        /// <summary>今、半透明にしている物の数（確認用）</summary>
        public int FadedCount => occluders.Count(o => o.faded);

        /// <summary>隠す物になりうる物を登録する（キャラの絵・足元の印は入れない）</summary>
        private void RegisterOccluder(GameObject go)
        {
            var renderers = go.GetComponentsInChildren<Renderer>().Where(r => !(r is SpriteRenderer)).ToArray();
            if (renderers.Length == 0) return;
            var bounds = renderers[0].bounds;
            foreach (var r in renderers) bounds.Encapsulate(r.bounds);
            occluders.Add(new Occluder { renderers = renderers, originals = renderers.Select(r => r.sharedMaterials).ToArray(), bounds = bounds });
        }

        private void RegisterTallTile(Vector2Int cell, GameObject tile)
        {
            if (map.TopHeight(cell) >= TallTile) RegisterOccluder(tile);
        }

        private void ClearOccluders()
        {
            occluders.Clear();
        }

        /// <summary>キャラ・選んだマス・カーソルのマスを隠している物だけ半透明にする（カメラやキャラが動くたびに呼ぶ）</summary>
        public void UpdateOcclusion()
        {
            if (targetCamera == null || map == null || occluders.Count == 0) return;
            occlusionPoints.Clear();
            foreach (var visual in unitVisuals.Values)
            {
                if (visual.billboard == null || !visual.billboard.holder.gameObject.activeInHierarchy) continue;
                var foot = transform.TransformPoint(map.TopCenter(visual.unit.cell));
                // 足元・体・頭（真上から見るときは絵が低くなるが、足元の点で足りる）
                occlusionPoints.Add(foot + Vector3.up * 0.2f);
                occlusionPoints.Add(foot + Vector3.up * unitHeight * 0.55f);
                occlusionPoints.Add(foot + Vector3.up * unitHeight * 0.9f);
            }
            if (Selected.HasValue) occlusionPoints.Add(transform.TransformPoint(map.TopCenter(Selected.Value)) + Vector3.up * 0.05f);
            if (HoverCell.HasValue) occlusionPoints.Add(transform.TransformPoint(map.TopCenter(HoverCell.Value)) + Vector3.up * 0.05f);

            // 正投影なので、どの点もカメラの向きに沿った線で見ている。点より手前でその線に当たる物が「隠している物」
            var forward = targetCamera.transform.forward;
            const float back = 60f;
            foreach (var o in occluders)
            {
                bool hide = false;
                foreach (var p in occlusionPoints)
                {
                    var ray = new Ray(p - forward * back, forward);
                    if (o.bounds.IntersectRay(ray, out float d) && d < back - 0.3f) { hide = true; break; }
                }
                SetFaded(o, hide);
            }
        }

        private void SetFaded(Occluder o, bool fade)
        {
            if (o.faded == fade) return;
            o.faded = fade;
            for (int i = 0; i < o.renderers.Length; i++)
            {
                var r = o.renderers[i];
                if (r == null) continue;
                r.sharedMaterials = fade ? o.originals[i].Select(FadedMaterial).ToArray() : o.originals[i];
                r.shadowCastingMode = fade ? ShadowCastingMode.Off : ShadowCastingMode.On;
            }
        }

        /// <summary>URP の Lit を半透明にした写し（元の材質ごとに1つ）</summary>
        private Material FadedMaterial(Material original)
        {
            if (original == null) return null;
            if (fadedMaterials.TryGetValue(original, out var cached) && cached != null) return cached;
            var m = new Material(original) { name = original.name + " (faded)" };
            if (m.HasProperty("_Surface"))
            {
                m.SetFloat("_Surface", 1f);
                m.SetFloat("_Blend", 0f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
                if (m.HasProperty("_SrcBlendAlpha")) m.SetFloat("_SrcBlendAlpha", (float)BlendMode.One);
                if (m.HasProperty("_DstBlendAlpha")) m.SetFloat("_DstBlendAlpha", (float)BlendMode.OneMinusSrcAlpha);
                m.SetFloat("_ZWrite", 0f);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.DisableKeyword("_ALPHATEST_ON");
                m.renderQueue = (int)RenderQueue.Transparent;
            }
            var color = m.HasProperty("_BaseColor") ? m.GetColor("_BaseColor") : m.color;
            color.a = occluderAlpha;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", color);
            else m.color = color;
            fadedMaterials[original] = m;
            return m;
        }
    }
}
