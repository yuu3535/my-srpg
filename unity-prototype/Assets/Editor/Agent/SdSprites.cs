using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// 盤面のキャラのSDの絵（tools/import_sd_sprites.py が Assets/Art/SD に置く）を、盤面のキャラの id に結びつける（2026-10-01）。
    /// SDの絵があるキャラはSDの絵、ないキャラ（ヘンリーなど）は今までの絵（Assets/Art/Tokens）。
    /// 今のSDは名前のあるキャラが探索用（武器をしまった姿）、モブが戦闘用。戦闘用・アニメ（AutoSprite）は届いてから差し替える
    /// </summary>
    internal static class SdSprites
    {
        internal const string Dir = "Assets/Art/SD";

        // 盤面のキャラの id → SDの絵の名前
        private static readonly Dictionary<string, string> ByUnit = new Dictionary<string, string>
        {
            { "arshe", "young_arshe" },        // 探索のアルシェ・テスト戦闘のアルシェ（幼アルシェの見た目）
            { "young_arshe", "young_arshe" },
            { "young_karima", "young_karima" },
            { "gunter", "gunter" },
            { "ringholm", "ringholm" },
            { "albas", "albas" },
            { "albas_rival", "albas_demon" },  // テスト戦闘の敵のアルバス（見分けやすいよう魔物の姿）
            { "carrie", "carrie_present" },    // 会話の立ち絵（メイド服）に合わせる（原作者 2026-10-01: 廊下は現代で大丈夫）
            { "forest_guard", "alstro_spear_1" },
            { "dylan", "alstro_general" },
            { "herel", "alstro_mage_1" },
            // 訓練人形（ラディン製）。原作者の絵ができるまでの仮の絵（総合担当がコードで描いた）
            { "training_doll_1", "training_doll" },
            { "training_doll_2", "training_doll" },
            { "training_doll_counter", "training_doll_counter" },
        };

        // 絵の高さの倍率: 子どもは小さく、竜に乗る兵は大きく（SDは全員が同じ大きさで描かれている）
        private static readonly Dictionary<string, float> Scale = new Dictionary<string, float>
        {
            { "young_arshe", 0.86f }, { "young_karima", 0.86f }, { "bell", 0.84f },
            { "ouroboros_sister", 0.8f }, { "ouroboros_brother", 0.8f }, { "poor_girl", 0.82f }, { "poor_boy", 0.82f },
            { "ringholm", 0.96f }, { "anne", 0.94f },
            { "training_doll", 0.8f }, { "training_doll_counter", 0.8f },
            { "orcus_rider", 1.4f }, { "orcus_general", 1.5f },
        };

        /// <summary>そのキャラのSDの絵（読み込み済みのスプライト・ファイルの場所・高さの倍率）。なければ null</summary>
        internal static (Sprite sprite, string path, float scale)? For(string unitId)
        {
            if (!ByUnit.TryGetValue(unitId, out var name)) return null;
            string path = $"{Dir}/{name}.png";
            if (!File.Exists(path)) return null;
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            var settings = new TextureImporterSettings();
            importer.ReadTextureSettings(settings);
            settings.spriteAlignment = (int)SpriteAlignment.BottomCenter;
            importer.SetTextureSettings(settings);
            importer.spritePixelsPerUnit = 100;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = true;   // 縮めて出すので、ちらつかないように
            importer.filterMode = FilterMode.Trilinear;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SaveAndReimport();
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(path);
            return sprite == null ? null : (sprite, path, Scale.TryGetValue(name, out var s) ? s : 1f);
        }
    }
}
