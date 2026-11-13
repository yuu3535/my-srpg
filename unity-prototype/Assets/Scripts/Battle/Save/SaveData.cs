using System;
using System.Collections.Generic;

namespace Srpg.Battle
{
    /// <summary>
    /// セーブの中身（2026-10-08。原作者: 枠は多め、オートセーブはしない）。
    /// 探索の進み具合（場所・立っている所・流した会話・持ち物・場所ごとの場面）と、仲間の育ち（版2、2026-10-09）。
    /// 中身を足したら version を上げる（古いセーブは SaveStore.FromJson で読み替える）
    /// </summary>
    [Serializable]
    public class SaveData
    {
        public const int CurrentVersion = 3;   // 1: 探索だけ / 2: 仲間の育ち（因果Lv・経験値・能力）を足した / 3: 章・進み具合・はじめからの印（2026-11-13）

        public int version = CurrentVersion;
        public string savedAt;          // 保存した日時（端末の時刻。"yyyy-MM-dd HH:mm"）
        public float playSeconds;       // 遊んだ時間（秒）
        public string scene;            // 戻る場面（Corridor2D＝2Dの探索 / Explore3D＝戦闘になる場所の探索）
        public string place;            // 2D: 場所の名前（Assets/Data/Corridors）/ 3D: 配置表の mapId
        public string placeName;        // 一覧に出す場所の名前
        public float playerX;           // 2D: 立っている所（横の位置）
        public int cellX, cellY;        // 3D: 立っているマス
        public List<string> seen = new List<string>();     // 流した会話のブロック
        public List<string> played = new List<string>();   // 一度だけの「近づくと流れる会話」の範囲
        public List<string> items = new List<string>();    // 持ち物
        public List<StateEntry> states = new List<StateEntry>();   // 配置表ごとの今の場面（戦闘のあと、など）
        public List<PartyMember> party = new List<PartyMember>();  // 仲間の育ち（版2〜。版1のセーブは空＝次の戦闘で加わる）
        public string chapter;          // 章の名前（版3〜。タイトル画面の説明の行・運命予報。空＝プロローグ）
        public int progress;            // 進み具合（版3〜。0 クリア前 / 1 サタン撃破後 / 2 終幕後。タイトル画面の空・星・文が変わる）
        public bool fresh;              // はじめからで作ったばかりのセーブ（読むと、プロローグを最初から始める）

        [Serializable] public class StateEntry { public string map, state; }

        public Dictionary<string, string> StateMap()
        {
            var d = new Dictionary<string, string>();
            foreach (var e in states ?? new List<StateEntry>()) if (!string.IsNullOrEmpty(e?.map)) d[e.map] = e.state;
            return d;
        }

        public void SetStates(IEnumerable<KeyValuePair<string, string>> map)
        {
            states = new List<StateEntry>();
            foreach (var kv in map) states.Add(new StateEntry { map = kv.Key, state = kv.Value });
        }

        /// <summary>一覧に出す遊んだ時間（例: 1:05）</summary>
        public string PlayTimeText
        {
            get
            {
                int m = (int)(playSeconds / 60f);
                return $"{m / 60}:{m % 60:00}";
            }
        }
    }
}
