if (!UnityEditor.EditorApplication.isPlaying)
{
    throw new System.Exception("Runtime verification failed: Unity is not in Play mode.");
}

var albus = UnityEngine.GameObject.Find("Albus");
if (albus == null)
{
    throw new System.Exception("Runtime verification failed: Albus GameObject is missing.");
}

var animator = albus.GetComponent<UnityEngine.Animator>();
var renderer = albus.GetComponent<UnityEngine.SpriteRenderer>();
if (animator == null || renderer == null || animator.runtimeAnimatorController == null || renderer.sprite == null)
{
    throw new System.Exception("Runtime verification failed: Animator or SpriteRenderer is incomplete.");
}

var state = animator.GetCurrentAnimatorStateInfo(0);
if (!state.IsName("Cast") || state.normalizedTime <= 0f)
{
    throw new System.Exception(
        $"Runtime verification failed: state={state.fullPathHash}, normalizedTime={state.normalizedTime}.");
}

var camera = UnityEngine.Camera.main;
if (camera == null)
{
    throw new System.Exception("Runtime verification failed: Main Camera is missing.");
}

var pixelPerfect = camera.GetComponent<UnityEngine.Rendering.Universal.PixelPerfectCamera>();
if (pixelPerfect == null ||
    pixelPerfect.assetsPPU != 100 ||
    pixelPerfect.refResolutionX != 640 ||
    pixelPerfect.refResolutionY != 360 ||
    pixelPerfect.gridSnapping != UnityEngine.Rendering.Universal.PixelPerfectCamera.GridSnapping.PixelSnapping ||
    pixelPerfect.cropFrame != UnityEngine.Rendering.Universal.PixelPerfectCamera.CropFrame.Windowbox)
{
    throw new System.Exception("Runtime verification failed: Pixel Perfect Camera settings are incorrect.");
}

UnityEngine.Debug.Log(
    $"Runtime verified: Cast is playing at normalizedTime={state.normalizedTime:F2}, " +
    $"currentSprite={renderer.sprite.name}, PixelPerfect=640x360@100PPU.");
