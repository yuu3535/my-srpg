using System;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Srpg.Battle
{
    /// <summary>
    /// 遊んでいる場面とセーブをつなぐ（2026-10-08）。
    /// ・セーブ: 今の探索（2D か 3D）から中身を取り出す。会話中・戦闘中・移動中はセーブしない
    /// ・ロード: 中身を預けて、その場面を開く。場面の探索が始まるとき（Begin）に受け取って、その所から続ける
    /// ・遊んだ時間を数える
    /// </summary>
    public static class SaveSystem
    {
        public const string Scene2D = "Corridor2D";
        public const string Scene3D = "Explore3D";

        /// <summary>ロードで預けた中身（場面が開いたら探索が受け取る）</summary>
        public static SaveData Pending { get; private set; }
        public static bool HasPending => Pending != null;

        /// <summary>遊んだ時間（秒）。ロードするとセーブの時間から数え直す</summary>
        public static float PlaySeconds { get; set; }

        /// <summary>その場面の探索が、預けた中身を受け取る（その場面のものでなければ受け取らない）</summary>
        public static SaveData Take(string scene)
        {
            if (Pending == null || Pending.scene != scene) return null;
            var d = Pending;
            Pending = null;
            return d;
        }

        /// <summary>今の探索から中身を取り出す。セーブできないときは null と理由</summary>
        public static SaveData Capture(out string reason)
        {
            reason = null;
            var ex2 = UnityEngine.Object.FindFirstObjectByType<Explore2DController>();
            if (ex2 != null && ex2.isActiveAndEnabled && ex2.State != null)
            {
                if (ex2.Busy) { reason = "会話や移動が終わってからセーブできます"; return null; }
                return Stamp(ex2.Capture());
            }
            var ex3 = UnityEngine.Object.FindFirstObjectByType<ExploreController>();
            if (ex3 != null && ex3.isActiveAndEnabled && ex3.Place != null)
            {
                if (ex3.InBattle) { reason = "戦闘中はセーブできません"; return null; }
                if (ex3.Busy) { reason = "会話や移動が終わってからセーブできます"; return null; }
                return Stamp(ex3.Capture());
            }
            reason = "ここではセーブできません";
            return null;
        }

        private static SaveData Stamp(SaveData d)
        {
            d.savedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
            d.playSeconds = PlaySeconds;
            d.party = Party.Snapshot();
            return d;
        }

        /// <summary>今の所を枠にセーブする</summary>
        public static bool SaveTo(int slot, out string message)
        {
            var d = Capture(out message);
            if (d == null) return false;
            if (!SaveStore.Save(slot, d, out message)) return false;
            message = $"No.{slot:00} にセーブしました";
            return true;
        }

        /// <summary>枠を読み、その場面を開いて続きから</summary>
        public static bool LoadFrom(int slot, out string message)
        {
            message = null;
            var d = SaveStore.Load(slot);
            if (d == null) { message = "このセーブは読めません"; return false; }
            Pending = d;
            PlaySeconds = d.playSeconds;
            Party.Restore(d.party);
            SceneManager.LoadScene(d.scene);
            return true;
        }

        // ── 遊んだ時間 ──

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void StartClock()
        {
            Pending = null;
            PlaySeconds = 0f;
            Party.Reset();
            var go = new GameObject("PlayClock") { hideFlags = HideFlags.HideInHierarchy };
            go.AddComponent<PlayClock>();
            UnityEngine.Object.DontDestroyOnLoad(go);
        }

        private class PlayClock : MonoBehaviour
        {
            private void Update() => PlaySeconds += Time.unscaledDeltaTime;
        }
    }
}
