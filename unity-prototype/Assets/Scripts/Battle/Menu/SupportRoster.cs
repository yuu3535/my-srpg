using System;
using System.Collections.Generic;
using UnityEngine;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 支援会話の相手選び（仕様書 docs/10-design/ui/support_select/support_select_spec.md §12）のデータと決まり。画面に触れない。
    /// 組み合わせは限定式（組がないペアは出さない）。データは Resources/Support/support_roster.json（仮。差し替えられる）
    /// </summary>
    [Serializable]
    public class SupportRoster
    {
        public enum PairState { Ready, Gauge, Locked }

        /// <summary>ランクの菱形の見え方（§9）</summary>
        public enum Pip { NotYet, Seen, Unread }

        /// <summary>一覧の状態（並び順もこの順。§7）</summary>
        public enum RowState { Ready, Gauge, Locked, AllSeen }

        [Serializable]
        public class Member
        {
            public string id, name, en, portrait;
        }

        [Serializable]
        public class Pair
        {
            public string a, b;
            public int rank;               // 見終わったランクの数 0〜3（0=未、1=C済、2=B済、3=A済）
            public string state = "Ready"; // Ready / Gauge / Locked
            public int points;             // 支援値 0〜100（Gauge のとき）
            public int unlockChapter;      // Locked のときの「第〇章から」

            public PairState State => state == "Gauge" ? PairState.Gauge : state == "Locked" ? PairState.Locked : PairState.Ready;
            public RowState Row => rank >= 3 ? RowState.AllSeen : State switch
            {
                PairState.Gauge => RowState.Gauge,
                PairState.Locked => RowState.Locked,
                _ => RowState.Ready,
            };
            /// <summary>今話せる（次のランクの会話がある）</summary>
            public bool Talkable => Row == RowState.Ready;
            public string Other(string id) => a == id ? b : a;
            public bool Has(string id) => a == id || b == id;
        }

        public struct Partner
        {
            public Member member;
            public Pair pair;
        }

        public enum BandKind { Pair, Someone, Quiet }

        /// <summary>帯の一文（§5）。Pair のときは A（選んでいる人）と B（相手）と次のランク</summary>
        public struct Band
        {
            public BandKind kind;
            public string a, b;
            public int rank;
        }

        public static readonly string[] RankNames = { "C", "B", "A" };

        public List<Member> members = new List<Member>();   // 加入済みの仲間（加入順）
        public List<Pair> pairs = new List<Pair>();

        public static SupportRoster Load()
        {
            var t = Resources.Load<TextAsset>("Support/support_roster");
            return t != null ? FromJson(t.text) : new SupportRoster();
        }

        public static SupportRoster FromJson(string json) => JsonUtility.FromJson<SupportRoster>(json) ?? new SupportRoster();

        public Member Find(string id) => members.Find(m => m.id == id);

        /// <summary>id の人の支援の相手（加入済みで組がある人だけ）。話せる → ためている途中 → 条件待ち → すべて見た、同じなら加入順</summary>
        public List<Partner> PartnersOf(string id)
        {
            var list = new List<Partner>();
            foreach (var m in members)
            {
                if (m.id == id) continue;
                var p = PairOf(id, m.id);
                if (p != null) list.Add(new Partner { member = m, pair = p });
            }
            // 安定した並べ替え（同じ状態は加入順のまま）
            var order = new List<int>();
            for (int i = 0; i < list.Count; i++) order.Add(i);
            order.Sort((x, y) =>
            {
                int c = ((int)list[x].pair.Row).CompareTo((int)list[y].pair.Row);
                return c != 0 ? c : x.CompareTo(y);
            });
            var sorted = new List<Partner>();
            foreach (int i in order) sorted.Add(list[i]);
            return sorted;
        }

        public Pair PairOf(string x, string y) => pairs.Find(p => (p.a == x && p.b == y) || (p.a == y && p.b == x));

        private bool Joined(string id) => members.Exists(m => m.id == id);

        /// <summary>話せる会話の総数（加入済みの2人の組だけ数える）</summary>
        public int ReadyTotal()
        {
            int n = 0;
            foreach (var p in pairs) if (p.Talkable && Joined(p.a) && Joined(p.b)) n++;
            return n;
        }

        /// <summary>id の人に話せる会話が1つ以上ある（カードの金の点）</summary>
        public bool HasReady(string id)
        {
            foreach (var p in pairs) if (p.Talkable && p.Has(id) && Joined(p.Other(id))) return true;
            return false;
        }

        /// <summary>帯の一文。選んでいる人に話せる相手がいれば一覧の一番上の相手、いなければ軍の誰か、誰もいなければ静か</summary>
        public Band BandFor(string id)
        {
            var me = Find(id);
            foreach (var q in PartnersOf(id))
                if (q.pair.Talkable)
                    return new Band { kind = BandKind.Pair, a = me != null ? me.name : id, b = q.member.name, rank = q.pair.rank };
            return new Band { kind = ReadyTotal() > 0 ? BandKind.Someone : BandKind.Quiet };
        }

        /// <summary>帯の一文の、2人の名前のあとに続く文（次のランクごと）</summary>
        public static string BandTail(int rank) => rank switch
        {
            0 => "の間に、絆が芽生えたようだ。",
            1 => "の絆が、深まったようだ。",
            _ => "の絆が、固く結ばれようとしている。",
        };

        public const string BandSomeone = "誰かが、話したいことがあるようだ。";
        public const string BandQuiet = "今は、静かな時間が流れている。";

        /// <summary>k 番目（0=C, 1=B, 2=A）のランクの菱形の見え方</summary>
        public static Pip PipOf(Pair p, int k)
        {
            if (k < p.rank) return Pip.Seen;
            if (k == p.rank && p.Talkable) return Pip.Unread;
            return Pip.NotYet;   // 支援値をためている途中でも、届いていない見た目のまま
        }
    }
}
