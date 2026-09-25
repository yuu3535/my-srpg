var renderPipelineAsset = UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline;
var pipelineType = "BuiltIn";
if (renderPipelineAsset != null)
{
    var fullName = renderPipelineAsset.GetType().FullName ?? string.Empty;
    if (fullName.Contains("Universal"))
    {
        pipelineType = "URP";
    }
    else if (fullName.Contains("HighDefinition"))
    {
        pipelineType = "HDRP";
    }
    else
    {
        pipelineType = "Custom";
    }
}

if (pipelineType != "URP")
{
    throw new System.Exception($"Expected URP but detected {pipelineType}. Scene setup aborted.");
}

var pixelPerfectType = System.Type.GetType(
    "UnityEngine.Rendering.Universal.PixelPerfectCamera, Unity.RenderPipelines.Universal.2D.Runtime");
if (pixelPerfectType == null)
{
    throw new System.Exception("URP was detected but its 2D PixelPerfectCamera type is unavailable.");
}

UnityEngine.Debug.Log($"Detected {pipelineType}; URP PixelPerfectCamera is available.");
