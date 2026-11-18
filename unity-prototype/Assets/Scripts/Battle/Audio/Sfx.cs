using System;
using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 効果音（SE）を鳴らす（2026-11-18 総合担当。原作者「SEの仕組みは入れておいていい」）。
    /// どの場面で何を鳴らすかは id で呼ぶ（例: Sfx.Play("ui_tap")）。音の一覧と音量は Resources/SE/se_map.json、音のファイルは Resources/SE/〈id〉（wav・ogg・mp3）。
    /// 音のファイルが無い id は黙って何もしない（素材が集まるまでも、ゲームはそのまま動く）。
    /// 素材の試聴・選別と、Resources/SE への置き方は tools/se_picker.py（総合担当が作った道具）。音量は設定の「効果音」（GameSettings.SoundVolume01）
    /// </summary>
    public static class Sfx
    {
        [Serializable] public class Entry { public string id; public string name; public string file; public string source; public float volume = 1f; public float cooldown = 0.05f; }
        [Serializable] private class MapFile { public Entry[] items = Array.Empty<Entry>(); }

        private static Dictionary<string, Entry> map;
        private static readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        private static readonly Dictionary<string, float> lastPlayed = new Dictionary<string, float>();
        private static Player player;

        /// <summary>鳴らした回数（テスト・確認用。音のファイルが無くて鳴らなかったものは数えない）</summary>
        public static int PlayedCount { get; private set; }
        /// <summary>最後に鳴らした id（テスト・確認用）</summary>
        public static string LastPlayed { get; private set; }

        /// <summary>音の一覧（se_map.json）。id → 中身</summary>
        public static IReadOnlyDictionary<string, Entry> Map
        {
            get
            {
                if (map != null) return map;
                map = new Dictionary<string, Entry>();
                var t = Resources.Load<TextAsset>("SE/se_map");
                if (t != null)
                    foreach (var e in JsonUtility.FromJson<MapFile>(t.text).items ?? Array.Empty<Entry>())
                        if (!string.IsNullOrEmpty(e.id)) map[e.id] = e;
                return map;
            }
        }

        /// <summary>id の音を鳴らす。delay 秒あとに鳴らすこともできる（戦闘の当たり・外れを順に鳴らすときなど）</summary>
        public static void Play(string id, float delay = 0f, float volume = 1f)
        {
            if (string.IsNullOrEmpty(id) || !Application.isPlaying) return;
            float master = GameSettings.SoundVolume01;
            if (master <= 0f) return;
            var clip = ClipOf(id);
            if (clip == null) return;
            Map.TryGetValue(id, out var e);
            float now = Time.unscaledTime + delay;
            float cd = e != null ? e.cooldown : 0.05f;
            if (lastPlayed.TryGetValue(id, out var last) && now - last < cd) return;   // 同じ音が重なりすぎないように
            lastPlayed[id] = now;
            EnsurePlayer().Schedule(clip, master * Mathf.Clamp01(volume) * (e != null ? Mathf.Clamp(e.volume, 0f, 2f) : 1f), delay);
            PlayedCount++;
            LastPlayed = id;
        }

        private static AudioClip ClipOf(string id)
        {
            if (clips.TryGetValue(id, out var c)) return c;
            c = Resources.Load<AudioClip>("SE/" + id);
            clips[id] = c;
            return c;
        }

        /// <summary>テスト用: 読み込んだ一覧と回数を消す</summary>
        public static void ResetForTest() { map = null; clips.Clear(); lastPlayed.Clear(); PlayedCount = 0; LastPlayed = null; }

        /// <summary>テスト用: 音のファイルの代わりに clip を使う</summary>
        public static void SetClipForTest(string id, AudioClip clip) => clips[id] = clip;

        private static Player EnsurePlayer()
        {
            if (player != null) return player;
            var go = new GameObject("Sfx");
            UnityEngine.Object.DontDestroyOnLoad(go);
            player = go.AddComponent<Player>();
            return player;
        }

        /// <summary>音を鳴らす入れ物（AudioSource を8つ使い回す。遅らせて鳴らす音を待つ）</summary>
        private class Player : MonoBehaviour
        {
            private readonly List<AudioSource> sources = new List<AudioSource>();
            private readonly List<(AudioClip clip, float volume, float at)> waiting = new List<(AudioClip, float, float)>();
            private int next;

            private void Awake()
            {
                for (int i = 0; i < 8; i++)
                {
                    var s = gameObject.AddComponent<AudioSource>();
                    s.playOnAwake = false;
                    s.spatialBlend = 0f;
                    sources.Add(s);
                }
            }

            public void Schedule(AudioClip clip, float volume, float delay)
            {
                if (delay <= 0f) Now(clip, volume);
                else waiting.Add((clip, volume, Time.unscaledTime + delay));
            }

            private void Now(AudioClip clip, float volume)
            {
                var s = sources[next];
                next = (next + 1) % sources.Count;
                s.PlayOneShot(clip, volume);
            }

            private void Update()
            {
                for (int i = waiting.Count - 1; i >= 0; i--)
                {
                    if (Time.unscaledTime < waiting[i].at) continue;
                    Now(waiting[i].clip, waiting[i].volume);
                    waiting.RemoveAt(i);
                }
            }
        }
    }
}
