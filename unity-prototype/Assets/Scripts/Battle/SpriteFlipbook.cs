using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// コマ画像を順に切り替えて繰り返す（足元の光など）。
    /// 動画を再生するより軽く、スマホでも数が増やせる。startOffset をずらすと、ユニットごとに動きがそろわない。
    /// </summary>
    [RequireComponent(typeof(SpriteRenderer))]
    public class SpriteFlipbook : MonoBehaviour
    {
        [SerializeField] private Sprite[] frames = System.Array.Empty<Sprite>();
        [SerializeField] private float fps = 20f;
        [SerializeField] private float startOffset;   // 秒

        private SpriteRenderer spriteRenderer;

        public void Setup(Sprite[] newFrames, float newFps, float offset)
        {
            frames = newFrames ?? System.Array.Empty<Sprite>();
            fps = newFps;
            startOffset = offset;
            spriteRenderer = GetComponent<SpriteRenderer>();
            ShowAt(0f);   // エディタ上（プレビュー）でも1コマ出しておく
        }

        private void Awake()
        {
            spriteRenderer = GetComponent<SpriteRenderer>();
        }

        private void Update()
        {
            ShowAt(Time.time);
        }

        private void ShowAt(float time)
        {
            if (frames == null || frames.Length == 0 || spriteRenderer == null) return;
            int index = Mathf.FloorToInt((time + startOffset) * fps) % frames.Length;
            if (index < 0) index += frames.Length;
            spriteRenderer.sprite = frames[index];
        }
    }
}
