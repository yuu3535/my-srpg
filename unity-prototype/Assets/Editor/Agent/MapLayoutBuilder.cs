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
    /// 配置表から作った場所の確認（プロローグ1-1 計画の段3）: Assets/Data/Maps/*.json（tools/map_layout.py unity）ごとに盤面を組み立てて撮る。
    /// 床は届いた床の絵（&lt;mapId&gt;_ground.png）、なければ下絵の色分け（&lt;mapId&gt;_guide.png）。人物は盤面の絵がある人だけ仮に立てる
    /// </summary>
    public static class MapLayoutBuilder
    {
        private const string MapDir = "Assets/Data/Maps";

        // 配置表の人物の id → 盤面の絵（Assets/Art/Tokens）。ない人は立てない（絵ができたら足す）
        private static string TokenOf(string id) => id switch
        {
            "young_arshe" => "arshe",
            "young_karima" => "young_karima",
            _ => null,
        };

        [MenuItem("Srpg/配置表の場所を組み立てて撮る")]
        public static void Run()
        {
            try
            {
                int rendererIndex = Board3DTestBuilder.EnsureUniversalRenderer();
                foreach (var path in Directory.GetFiles(MapDir, "*.json").OrderBy(p => p, StringComparer.Ordinal))
                    Shoot(rendererIndex, JsonUtility.FromJson<MapLayoutFile>(File.ReadAllText(path)));
                Debug.Log("[MapLayoutBuilder] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        /// <summary>場所の床の絵（届いた絵、なければ下絵）</summary>
        internal static Texture2D GroundOf(string mapId)
        {
            string painted = $"{Board3DTestBuilder.GroundDir}/{mapId}_ground.png", guide = $"{Board3DTestBuilder.GroundDir}/{mapId}_guide.png";
            string path = File.Exists(painted) ? painted : File.Exists(guide) ? guide : null;
            if (path == null) return null;
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = path == guide ? FilterMode.Point : FilterMode.Trilinear;
            importer.mipmapEnabled = path != guide;
            importer.maxTextureSize = 4096;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        private static void Shoot(int rendererIndex, MapLayoutFile layout)
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Board3DTestBuilder.CreateStage(rendererIndex, out var camera, out var light, out _);
            var view = new GameObject("Board3D").AddComponent<Board3DView>();
            Board3DTestBuilder.ConfigureView(view, camera, light, new[] { "arshe", "young_karima" }, buildOnStart: false, startOverview: false);
            if (layout.indoor)
            {
                // 屋内は森の遠景を出さない（外は暗いまま）
                var so = new SerializedObject(view);
                so.FindProperty("backdrop").objectReferenceValue = null;
                so.ApplyModifiedPropertiesWithoutUndo();
            }
            var map = Board3DMap.FromLayout(layout);
            var state = layout.states?.FirstOrDefault();
            if (state?.player != null && TokenOf(state.player.id) is string playerToken)
                map.Units.Add(new Board3DMap.Unit { cell = state.player.Cell, id = playerToken });
            foreach (var person in state?.people ?? Array.Empty<MapPerson>())
                if (TokenOf(person.id) is string token && map.Units.All(u => u.id != token))
                    map.Units.Add(new Board3DMap.Unit { cell = person.Cell, id = token });
            view.Ground = GroundOf(layout.mapId);
            view.Map = map;
            view.Setup();
            Board3DTestBuilder.SetMood(string.IsNullOrEmpty(layout.timeOfDay) ? Board3DMood.Day : layout.timeOfDay, layout.indoor);

            var rt = new RenderTexture(Board3DTestBuilder.PreviewWidth, Board3DTestBuilder.PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)Board3DTestBuilder.PreviewWidth / Board3DTestBuilder.PreviewHeight;
            ShaderUtil.allowAsyncCompilation = false;
            camera.Render();
            view.SetOverview(true, true);
            view.SetView(true, 0, true);
            Board3DTestBuilder.Render(camera, rt, $"Map_{layout.mapId}_overview");
            view.SetOverview(false, true);
            var focus = state?.player != null ? state.player.Cell : new Vector2Int(layout.columns / 2, layout.rows / 2);
            view.FocusOn(focus, true);
            view.UpdateBillboards();   // 隠している壁・物を半透明にする（▶では毎フレーム）
            Board3DTestBuilder.Render(camera, rt, $"Map_{layout.mapId}_close");
            view.SetView(false, 0, true);
            view.SetOverview(true, true);
            Board3DTestBuilder.Render(camera, rt, $"Map_{layout.mapId}_top");
            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
            Debug.Log($"[MapLayoutBuilder] {layout.mapId}: {layout.columns}×{layout.rows}、物 {map.Obstacles.Count()}、人物（絵あり）{map.Units.Count}、床 {(view.Ground != null ? view.Ground.name : "なし")}");
        }
    }
}
