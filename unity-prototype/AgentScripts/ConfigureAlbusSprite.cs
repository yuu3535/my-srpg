var assetPath = "Assets/Art/Characters/Albus/AlbusMagicSheet.png";

UnityEditor.AssetDatabase.ImportAsset(
    assetPath,
    UnityEditor.ImportAssetOptions.ForceSynchronousImport | UnityEditor.ImportAssetOptions.ForceUpdate);

var textureImporter = UnityEditor.AssetImporter.GetAtPath(assetPath) as UnityEditor.TextureImporter;
if (textureImporter == null)
{
    throw new System.Exception("TextureImporter was not found for AlbusMagicSheet.png.");
}

textureImporter.textureType = UnityEditor.TextureImporterType.Sprite;
textureImporter.spriteImportMode = UnityEditor.SpriteImportMode.Multiple;
textureImporter.spritePixelsPerUnit = 100f;
textureImporter.filterMode = UnityEngine.FilterMode.Point;
textureImporter.mipmapEnabled = false;
textureImporter.textureCompression = UnityEditor.TextureImporterCompression.Uncompressed;
textureImporter.alphaIsTransparency = true;
var textureSettings = new UnityEditor.TextureImporterSettings();
textureImporter.ReadTextureSettings(textureSettings);
textureSettings.spriteMeshType = UnityEngine.SpriteMeshType.FullRect;
textureImporter.SetTextureSettings(textureSettings);
textureImporter.maxTextureSize = 2048;
textureImporter.SaveAndReimport();

var importer = UnityEditor.AssetImporter.GetAtPath(assetPath);
var factory = new UnityEditor.U2D.Sprites.SpriteDataProviderFactories();
factory.Init();
var dataProvider = factory.GetSpriteEditorDataProviderFromObject(importer);
if (dataProvider == null)
{
    throw new System.Exception("Sprite data provider is unavailable. Operation aborted.");
}

dataProvider.InitSpriteEditorDataProvider();

var editCapability = dataProvider.GetDataProvider<UnityEditor.U2D.Sprites.ISpriteFrameEditCapability>();
if (editCapability == null)
{
    throw new System.Exception("Edit capability is unavailable. Operation aborted.");
}

var capability = editCapability.GetEditCapability();
var requiredCapabilities = new[]
{
    UnityEditor.U2D.Sprites.EEditCapability.CreateAndDeleteSprite,
    UnityEditor.U2D.Sprites.EEditCapability.EditSpriteName,
    UnityEditor.U2D.Sprites.EEditCapability.EditSpriteRect,
    UnityEditor.U2D.Sprites.EEditCapability.EditPivot
};

foreach (var requiredCapability in requiredCapabilities)
{
    if (!capability.HasCapability(requiredCapability))
    {
        throw new System.Exception($"Required sprite capability is unavailable: {requiredCapability}. Operation aborted.");
    }
}

const int columns = 4;
const int cellWidth = 365;
const int cellHeight = 301;
const int populatedFrameCount = 14;
const int sourceHeight = 1204;

var spriteRects = new System.Collections.Generic.List<UnityEditor.SpriteRect>();
for (var frameIndex = 0; frameIndex < populatedFrameCount; frameIndex++)
{
    var rowFromTop = frameIndex / columns;
    var column = frameIndex % columns;
    var spriteRect = new UnityEditor.SpriteRect
    {
        name = $"AlbusMagic_{frameIndex:00}",
        rect = new UnityEngine.Rect(
            column * cellWidth,
            sourceHeight - ((rowFromTop + 1) * cellHeight),
            cellWidth,
            cellHeight),
        alignment = UnityEngine.SpriteAlignment.Custom,
        pivot = new UnityEngine.Vector2(0.335f, 0.01f),
        border = UnityEngine.Vector4.zero,
        spriteID = UnityEditor.GUID.Generate()
    };
    spriteRects.Add(spriteRect);
}

var nameFileIdProvider = dataProvider.GetDataProvider<UnityEditor.U2D.Sprites.ISpriteNameFileIdDataProvider>();
if (nameFileIdProvider == null)
{
    throw new System.Exception("Name/file ID provider is unavailable. Operation aborted.");
}

var nameFileIdPairs = new System.Collections.Generic.List<UnityEditor.SpriteNameFileIdPair>();
foreach (var spriteRect in spriteRects)
{
    nameFileIdPairs.Add(new UnityEditor.SpriteNameFileIdPair(spriteRect.name, spriteRect.spriteID));
}

dataProvider.SetSpriteRects(spriteRects.ToArray());
nameFileIdProvider.SetNameFileIdPairs(nameFileIdPairs);
dataProvider.Apply();
importer.SaveAndReimport();

UnityEditor.AssetDatabase.ImportAsset(
    assetPath,
    UnityEditor.ImportAssetOptions.ForceSynchronousImport | UnityEditor.ImportAssetOptions.ForceUpdate);
UnityEditor.AssetDatabase.SaveAssets();

var importedSprites = System.Linq.Enumerable.ToArray(
    System.Linq.Enumerable.OrderBy(
        System.Linq.Enumerable.OfType<UnityEngine.Sprite>(
            UnityEditor.AssetDatabase.LoadAllAssetsAtPath(assetPath)),
        sprite => sprite.name));
var importedSpriteNames = System.Linq.Enumerable.Select(importedSprites, sprite => sprite.name);

UnityEngine.Debug.Log($"Configured {importedSprites.Length} sprites: {string.Join(", ", importedSpriteNames)}");
