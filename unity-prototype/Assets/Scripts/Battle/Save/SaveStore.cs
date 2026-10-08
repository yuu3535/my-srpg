using System;
using System.IO;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// セーブの枠に読み書きする（2026-10-08）。画面に触れない。
    /// ・PC・エディタ: 端末の中（persistentDataPath/saves/slot_NN.json）。書くときは別の名前に書いてから置き換える（途中で落ちても前のセーブが残る）
    /// ・WebGL: ブラウザの保存（PlayerPrefs。ページを閉じても残る）
    /// 壊れた枠・新しい版のゲームで作った枠は読まずに「読めない」として一覧に出す
    /// </summary>
    public static class SaveStore
    {
        /// <summary>枠の数（原作者 2026-10-08: 多め）</summary>
        public const int SlotCount = 30;

        public interface IBackend
        {
            string Read(int slot);
            void Write(int slot, string json);
            void Delete(int slot);
        }

        public class FileBackend : IBackend
        {
            private readonly string dir;
            public FileBackend(string dir) { this.dir = dir; }
            private string PathOf(int slot) => Path.Combine(dir, $"slot_{slot:00}.json");
            public string Read(int slot) => File.Exists(PathOf(slot)) ? File.ReadAllText(PathOf(slot)) : null;
            public void Write(int slot, string json)
            {
                Directory.CreateDirectory(dir);
                string path = PathOf(slot), temp = path + ".tmp";
                File.WriteAllText(temp, json);
                if (File.Exists(path)) File.Replace(temp, path, null);
                else File.Move(temp, path);
            }
            public void Delete(int slot) { if (File.Exists(PathOf(slot))) File.Delete(PathOf(slot)); }
        }

        public class PrefsBackend : IBackend
        {
            private static string Key(int slot) => $"save_slot_{slot:00}";
            public string Read(int slot) => PlayerPrefs.HasKey(Key(slot)) ? PlayerPrefs.GetString(Key(slot)) : null;
            public void Write(int slot, string json) { PlayerPrefs.SetString(Key(slot), json); PlayerPrefs.Save(); }
            public void Delete(int slot) { PlayerPrefs.DeleteKey(Key(slot)); PlayerPrefs.Save(); }
        }

        private static IBackend backend;
        /// <summary>読み書きする所（テストでは一時フォルダに差し替える）</summary>
        public static IBackend Backend
        {
            get => backend ??= Application.platform == RuntimePlatform.WebGLPlayer
                ? new PrefsBackend()
                : (IBackend)new FileBackend(Path.Combine(Application.persistentDataPath, "saves"));
            set => backend = value;
        }

        public enum SlotState { Empty, Ok, Unreadable }

        public struct Slot
        {
            public int index;
            public SlotState state;
            public SaveData data;
        }

        public static bool Valid(int slot) => slot >= 1 && slot <= SlotCount;

        public static string ToJson(SaveData data) => JsonUtility.ToJson(data, true);

        /// <summary>読み取る。壊れている・新しい版のゲームのセーブなら null</summary>
        public static SaveData FromJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            SaveData data;
            try { data = JsonUtility.FromJson<SaveData>(json); }
            catch (Exception) { return null; }
            if (data == null || data.version < 1 || data.version > SaveData.CurrentVersion || string.IsNullOrEmpty(data.scene)) return null;
            // 古い版の読み替えは、版を上げたときにここへ足す
            data.seen ??= new System.Collections.Generic.List<string>();
            data.played ??= new System.Collections.Generic.List<string>();
            data.items ??= new System.Collections.Generic.List<string>();
            data.states ??= new System.Collections.Generic.List<SaveData.StateEntry>();
            data.party ??= new System.Collections.Generic.List<PartyMember>();   // 版1: 仲間の育ちがない
            return data;
        }

        /// <summary>枠に書く。書けなかったら false と理由</summary>
        public static bool Save(int slot, SaveData data, out string error)
        {
            error = null;
            if (!Valid(slot)) { error = "枠の番号がおかしい"; return false; }
            if (data == null) { error = "セーブするものがない"; return false; }
            try
            {
                data.version = SaveData.CurrentVersion;
                Backend.Write(slot, ToJson(data));
                return true;
            }
            catch (Exception e)
            {
                error = "書けなかった（" + e.Message + "）";
                Debug.LogWarning("[Save] " + error);
                return false;
            }
        }

        public static SaveData Load(int slot)
        {
            if (!Valid(slot)) return null;
            try { return FromJson(Backend.Read(slot)); }
            catch (Exception e) { Debug.LogWarning("[Save] 読めなかった: " + e.Message); return null; }
        }

        public static Slot Peek(int slot)
        {
            string json = null;
            try { json = Backend.Read(slot); } catch (Exception) { }
            if (json == null) return new Slot { index = slot, state = SlotState.Empty };
            var data = FromJson(json);
            return new Slot { index = slot, state = data != null ? SlotState.Ok : SlotState.Unreadable, data = data };
        }

        public static Slot[] List()
        {
            var list = new Slot[SlotCount];
            for (int i = 0; i < SlotCount; i++) list[i] = Peek(i + 1);
            return list;
        }

        public static void Delete(int slot) { if (Valid(slot)) Backend.Delete(slot); }
    }
}
