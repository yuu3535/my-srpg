using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Video;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// 動画素材（mp4）からコマの画像を書き出す（Claude Code がコマンドから実行する）。
    ///   Unity.exe -batchmode -projectPath unity-prototype -executeMethod Srpg.EditorAgent.VideoFrameExtractor.ExtractFootRings -logFile -
    /// 入力: Assets/Art/Effects/FootRing/Source/*.mp4
    /// 出力: 環境変数 SRPG_FRAME_OUT のフォルダ（未指定なら プロジェクトの外の ../.srpg-video-frames）/<名前>/frame_000.png
    ///       確認・加工用の一時的な画像。Unity の Temp は終了時に消えるため使わない
    /// 動画は1コマずつ位置を合わせて読み、終わったら Unity を閉じる（-quit は付けない）。
    /// </summary>
    public static class VideoFrameExtractor
    {
        private const string SourceDir = "Assets/Art/Effects/FootRing/Source";
        private static string OutDir => System.Environment.GetEnvironmentVariable("SRPG_FRAME_OUT") ?? "../.srpg-video-frames";
        private const int Step = 1;   // 何コマおきに書き出すか

        private static readonly Queue<string> Pending = new Queue<string>();
        private static VideoPlayer player;
        private static RenderTexture target;
        private static string current;
        private static long frameIndex;
        private static double startedAt;

        public static void ExtractFootRings()
        {
            foreach (var path in Directory.GetFiles(SourceDir, "*.mp4")) Pending.Enqueue(path.Replace('\\', '/'));
            startedAt = EditorApplication.timeSinceStartup;
            EditorApplication.update += Tick;
            StartNext();
        }

        private static void StartNext()
        {
            if (player != null) Object.DestroyImmediate(player.gameObject);
            if (Pending.Count == 0)
            {
                Debug.Log("[VideoFrameExtractor] done");
                EditorApplication.update -= Tick;
                EditorApplication.Exit(0);
                return;
            }
            current = Pending.Dequeue();
            var clip = AssetDatabase.LoadAssetAtPath<VideoClip>(current);
            if (clip == null)
            {
                Debug.LogError($"[VideoFrameExtractor] 読めない: {current}");
                StartNext();
                return;
            }
            Debug.Log($"[VideoFrameExtractor] {current} {clip.width}x{clip.height} {clip.frameCount} frames {clip.frameRate} fps");
            target = new RenderTexture((int)clip.width, (int)clip.height, 0, RenderTextureFormat.ARGB32);
            player = new GameObject("VideoFrameExtractor").AddComponent<VideoPlayer>();
            player.playOnAwake = false;
            player.clip = clip;
            player.renderMode = VideoRenderMode.RenderTexture;
            player.targetTexture = target;
            player.audioOutputMode = VideoAudioOutputMode.None;
            player.skipOnDrop = false;
            player.sendFrameReadyEvents = true;
            player.frameReady += OnFrameReady;
            frameIndex = 0;
            Directory.CreateDirectory(Path.Combine(OutDir, Path.GetFileNameWithoutExtension(current)));
            player.Play();
        }

        private static void OnFrameReady(VideoPlayer source, long frame)
        {
            if (frame % Step != 0) return;
            var previous = RenderTexture.active;
            RenderTexture.active = target;
            var tex = new Texture2D(target.width, target.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, target.width, target.height), 0, 0);
            tex.Apply();
            RenderTexture.active = previous;
            var name = Path.GetFileNameWithoutExtension(current);
            File.WriteAllBytes(Path.Combine(OutDir, name, $"frame_{frame:000}.png"), tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
            frameIndex = frame;
        }

        private static void Tick()
        {
            if (player == null) return;
            // 最後のコマまで来たら次の動画へ
            if (player.clip != null && frameIndex >= (long)player.clip.frameCount - 1)
            {
                StartNext();
                return;
            }
            if (EditorApplication.timeSinceStartup - startedAt > 180)
            {
                Debug.LogError("[VideoFrameExtractor] 時間切れ");
                EditorApplication.Exit(1);
            }
        }
    }
}
