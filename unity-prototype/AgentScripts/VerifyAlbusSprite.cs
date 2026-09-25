var assetPath = "Assets/Art/Characters/Albus/AlbusMagicSheet.png";
var importer = UnityEditor.AssetImporter.GetAtPath(assetPath) as UnityEditor.TextureImporter;
if (importer == null)
{
    throw new System.Exception("Verification failed: TextureImporter is missing.");
}

if (importer.textureType != UnityEditor.TextureImporterType.Sprite ||
    importer.spriteImportMode != UnityEditor.SpriteImportMode.Multiple ||
    importer.filterMode != UnityEngine.FilterMode.Point ||
    importer.mipmapEnabled ||
    importer.textureCompression != UnityEditor.TextureImporterCompression.Uncompressed ||
    System.Math.Abs(importer.spritePixelsPerUnit - 100f) > 0.001f)
{
    throw new System.Exception(
        $"Verification failed: type={importer.textureType}, mode={importer.spriteImportMode}, " +
        $"filter={importer.filterMode}, mipmaps={importer.mipmapEnabled}, " +
        $"compression={importer.textureCompression}, ppu={importer.spritePixelsPerUnit}.");
}

var factory = new UnityEditor.U2D.Sprites.SpriteDataProviderFactories();
factory.Init();
var dataProvider = factory.GetSpriteEditorDataProviderFromObject(importer);
if (dataProvider == null)
{
    throw new System.Exception("Verification failed: sprite data provider is missing.");
}

dataProvider.InitSpriteEditorDataProvider();
var rects = dataProvider.GetSpriteRects();
if (rects.Length != 14)
{
    throw new System.Exception($"Verification failed: expected 14 frames, got {rects.Length}.");
}

var orderedRects = System.Linq.Enumerable.ToArray(
    System.Linq.Enumerable.OrderBy(rects, rect => rect.name));
for (var frameIndex = 0; frameIndex < orderedRects.Length; frameIndex++)
{
    var rect = orderedRects[frameIndex];
    var expectedName = $"AlbusMagic_{frameIndex:00}";
    var rowFromTop = frameIndex / 4;
    var column = frameIndex % 4;
    var expectedRect = new UnityEngine.Rect(column * 365, 1204 - ((rowFromTop + 1) * 301), 365, 301);

    if (rect.name != expectedName || rect.rect != expectedRect)
    {
        throw new System.Exception(
            $"Verification failed for frame {frameIndex}: name={rect.name}, rect={rect.rect}.");
    }

    if (UnityEngine.Vector2.Distance(rect.pivot, new UnityEngine.Vector2(0.335f, 0.01f)) > 0.0001f)
    {
        throw new System.Exception(
            $"Verification failed for frame {frameIndex}: pivot={rect.pivot}.");
    }
}

UnityEngine.Debug.Log("Verified AlbusMagicSheet: 14 frames, 365x301 grid, shared foot pivot, Point/100 PPU/uncompressed.");
