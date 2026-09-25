using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

public static class AlbusPreviewBuilder
{
    private const string SpriteSheetPath = "Assets/Art/Characters/Albus/AlbusMagicSheet.png";
    private const string AnimationClipPath = "Assets/Animations/AlbusMagic.anim";
    private const string AnimatorControllerPath = "Assets/Animations/AlbusMagic.controller";
    private const string ScenePath = "Assets/Scenes/AlbusMagicPreview.unity";
    private const string PreviewPath = "Assets/Previews/AlbusMagicPreview.png";

    public static string Build()
    {
        var pipelineAsset = GraphicsSettings.currentRenderPipeline;
        var pipelineName = pipelineAsset == null ? "BuiltIn" : pipelineAsset.GetType().FullName ?? string.Empty;
        if (!pipelineName.Contains("Universal"))
        {
            throw new InvalidOperationException($"URP is required, but the active pipeline is {pipelineName}.");
        }

        var sprites = AssetDatabase.LoadAllAssetsAtPath(SpriteSheetPath)
            .OfType<Sprite>()
            .OrderBy(sprite => sprite.name, StringComparer.Ordinal)
            .ToArray();
        if (sprites.Length != 14)
        {
            throw new InvalidOperationException($"Expected 14 Albus frames, but found {sprites.Length}.");
        }

        EnsureFolder("Assets/Animations");
        EnsureFolder("Assets/Scenes");
        EnsureFolder("Assets/Previews");

        DeleteGeneratedAsset(AnimationClipPath);
        DeleteGeneratedAsset(AnimatorControllerPath);

        var clip = CreateAnimationClip(sprites);
        var controller = CreateAnimatorController(clip);

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        var cameraObject = new GameObject("Main Camera");
        cameraObject.tag = "MainCamera";
        cameraObject.transform.position = new Vector3(0f, 0f, -10f);
        var camera = cameraObject.AddComponent<Camera>();
        camera.orthographic = true;
        camera.orthographicSize = 1.8f;
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color32(20, 18, 24, 255);
        camera.allowHDR = false;
        camera.allowMSAA = false;
        camera.allowDynamicResolution = false;
        cameraObject.AddComponent<UniversalAdditionalCameraData>();

        var pixelPerfect = cameraObject.AddComponent<PixelPerfectCamera>();
        pixelPerfect.assetsPPU = 100;
        pixelPerfect.refResolutionX = 640;
        pixelPerfect.refResolutionY = 360;
        pixelPerfect.gridSnapping = PixelPerfectCamera.GridSnapping.PixelSnapping;
        pixelPerfect.cropFrame = PixelPerfectCamera.CropFrame.Windowbox;

        QualitySettings.antiAliasing = 0;
        QualitySettings.anisotropicFiltering = AnisotropicFiltering.Disable;

        var lightObject = new GameObject("Global Light 2D");
        var light = lightObject.AddComponent<Light2D>();
        light.lightType = Light2D.LightType.Global;
        light.intensity = 1f;
        light.color = Color.white;

        var albusObject = new GameObject("Albus");
        albusObject.transform.position = new Vector3(-0.45f, -1.45f, 0f);
        var spriteRenderer = albusObject.AddComponent<SpriteRenderer>();
        spriteRenderer.sprite = sprites[0];
        spriteRenderer.sortingOrder = 10;
        var animator = albusObject.AddComponent<Animator>();
        animator.runtimeAnimatorController = controller;

        CreateOverlay(camera);

        EditorSceneManager.MarkSceneDirty(scene);
        if (!EditorSceneManager.SaveScene(scene, ScenePath))
        {
            throw new InvalidOperationException($"Could not save preview scene at {ScenePath}.");
        }

        EditorBuildSettings.scenes = new[]
        {
            new EditorBuildSettingsScene(ScenePath, true)
        };

        spriteRenderer.sprite = sprites[6];
        CapturePreview(camera, PreviewPath);
        spriteRenderer.sprite = sprites[0];

        EditorUtility.SetDirty(spriteRenderer);
        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene, ScenePath);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh(ImportAssetOptions.ForceUpdate);

        Selection.activeGameObject = albusObject;
        SceneView.RepaintAll();

        return $"Built {ScenePath} with {sprites.Length} frames at 10 fps and wrote {PreviewPath}.";
    }

    private static AnimationClip CreateAnimationClip(Sprite[] sprites)
    {
        var clip = new AnimationClip
        {
            name = "AlbusMagic",
            frameRate = 10f,
            wrapMode = WrapMode.Loop
        };

        var keyframes = sprites
            .Select((sprite, index) => new ObjectReferenceKeyframe
            {
                time = index / clip.frameRate,
                value = sprite
            })
            .ToArray();

        var binding = EditorCurveBinding.PPtrCurve(string.Empty, typeof(SpriteRenderer), "m_Sprite");
        AnimationUtility.SetObjectReferenceCurve(clip, binding, keyframes);

        var settings = AnimationUtility.GetAnimationClipSettings(clip);
        settings.loopTime = true;
        settings.loopBlend = false;
        AnimationUtility.SetAnimationClipSettings(clip, settings);

        AssetDatabase.CreateAsset(clip, AnimationClipPath);
        return clip;
    }

    private static AnimatorController CreateAnimatorController(AnimationClip clip)
    {
        var controller = AnimatorController.CreateAnimatorControllerAtPath(AnimatorControllerPath);
        var stateMachine = controller.layers[0].stateMachine;
        var state = stateMachine.AddState("Cast");
        state.motion = clip;
        stateMachine.defaultState = state;
        EditorUtility.SetDirty(controller);
        return controller;
    }

    private static void CreateOverlay(Camera camera)
    {
        var canvasObject = new GameObject("Preview UI");
        var canvas = canvasObject.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceCamera;
        canvas.worldCamera = camera;
        canvas.planeDistance = 1f;
        canvas.sortingOrder = 100;

        var scaler = canvasObject.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1280f, 720f);
        scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
        scaler.matchWidthOrHeight = 0.5f;
        canvasObject.AddComponent<GraphicRaycaster>();

        CreateText(canvasObject.transform, "Title", "ALBUS // MAGIC CAST TEST", 30, new Vector2(38f, -32f));
        CreateText(canvasObject.transform, "Details", "14 FRAMES // 10 FPS // LOOP PREVIEW", 18, new Vector2(40f, -76f));
    }

    private static void CreateText(Transform parent, string name, string value, int fontSize, Vector2 position)
    {
        var textObject = new GameObject(name);
        textObject.transform.SetParent(parent, false);
        var rect = textObject.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0f, 1f);
        rect.anchorMax = new Vector2(0f, 1f);
        rect.pivot = new Vector2(0f, 1f);
        rect.anchoredPosition = position;
        rect.sizeDelta = new Vector2(760f, 42f);

        var text = textObject.AddComponent<Text>();
        text.text = value;
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        text.fontSize = fontSize;
        text.fontStyle = FontStyle.Bold;
        text.alignment = TextAnchor.MiddleLeft;
        text.color = name == "Title"
            ? new Color32(238, 232, 244, 255)
            : new Color32(173, 156, 190, 255);
        text.raycastTarget = false;
    }

    private static void CapturePreview(Camera camera, string assetPath)
    {
        const int width = 1280;
        const int height = 720;
        var renderTexture = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32)
        {
            filterMode = FilterMode.Point,
            antiAliasing = 1
        };
        var texture = new Texture2D(width, height, TextureFormat.RGBA32, false);

        try
        {
            camera.targetTexture = renderTexture;
            camera.Render();
            RenderTexture.active = renderTexture;
            texture.ReadPixels(new Rect(0, 0, width, height), 0, 0, false);
            texture.Apply(false, false);

            var fullPath = Path.Combine(Directory.GetParent(Application.dataPath).FullName, assetPath);
            File.WriteAllBytes(fullPath, texture.EncodeToPNG());
        }
        finally
        {
            camera.targetTexture = null;
            RenderTexture.active = null;
            UnityEngine.Object.DestroyImmediate(texture);
            UnityEngine.Object.DestroyImmediate(renderTexture);
        }

        AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
    }

    private static void DeleteGeneratedAsset(string assetPath)
    {
        if (AssetDatabase.LoadMainAssetAtPath(assetPath) != null)
        {
            AssetDatabase.DeleteAsset(assetPath);
        }
    }

    private static void EnsureFolder(string folder)
    {
        var parent = Path.GetDirectoryName(folder)?.Replace('\\', '/');
        var name = Path.GetFileName(folder);
        if (!AssetDatabase.IsValidFolder(folder) && !string.IsNullOrEmpty(parent))
        {
            AssetDatabase.CreateFolder(parent, name);
        }
    }
}
