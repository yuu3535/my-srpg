using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 会話の環境設定（2026-10-09）: 文字を少しずつ出す（文字の速さ）・オート・スキップ（既読だけ／未読も）。
    /// 押すと、文字を出している途中なら全部出し、出し終えていれば次へ。「オート」「スキップ」は下のボタン帯（DialogueView.Talk）
    /// </summary>
    public partial class DialogueView
    {
        private string revealTarget = "";
        private float revealStart, revealDoneAt = -1f;
        private bool currentRead;
        private float lastSkip;

        /// <summary>バッチ（自動のテスト・確認の画像）では文字を一度に出す。文字を出す仕組みのテストだけ false にする</summary>
        public static bool InstantInBatch { get; set; } = true;
        /// <summary>いま枠に出ている文字（出している途中なら途中まで）</summary>
        public string ShownText => bodyText != null ? bodyText.text : "";
        public ScenarioBlock CurrentBlock => block;
        public int LineIndex => index;

        /// <summary>オート（文字を出し終えたら、少し待って次へ）</summary>
        public bool Auto { get; set; }
        /// <summary>スキップ（既読の台詞を早送り。未読に来たら止まる。設定で未読も）</summary>
        public bool Skip { get; set; }
        /// <summary>文字を出している途中か</summary>
        public bool Revealing => Application.isPlaying && revealTarget.Length > 0 && bodyText != null && bodyText.text.Length < revealTarget.Length;
        /// <summary>今の行は前に読んだことがあるか（出す前の時点で）</summary>
        public bool CurrentWasRead => currentRead;

        private string ReadKeyOf(int i) => block != null ? GameSettings.LineKey(block.id, i) : null;

        /// <summary>行を出す前に、既読かを覚えてから既読にする</summary>
        private void NoteRead()
        {
            string key = ReadKeyOf(index);
            currentRead = GameSettings.IsRead(key);
            GameSettings.MarkRead(key);
            if (Skip && !currentRead && !GameSettings.Current.skipUnread) Skip = false;   // 未読に来たらスキップを止める
            RefreshToggles();
        }

        /// <summary>ページの文字を出し始める（すぐ・確認の画像を撮るとき・スキップ中は一度に）</summary>
        private void BeginReveal(string text)
        {
            revealTarget = text ?? "";
            revealStart = Time.unscaledTime;
            revealDoneAt = -1f;
            bool instant = !Application.isPlaying || (Application.isBatchMode && InstantInBatch) || GameSettings.CharsPerSecond <= 0f || Skip;
            bodyText.text = instant ? revealTarget : "";
            if (instant) revealDoneAt = Time.unscaledTime;
        }

        private void FinishReveal()
        {
            bodyText.text = revealTarget;
            revealDoneAt = Time.unscaledTime;
        }

        /// <summary>毎フレーム: 文字を出す・オート・スキップ（Update から呼ぶ）</summary>
        private void TickReveal()
        {
            if (!Application.isPlaying || !IsPlaying || AdjusterOpen) return;
            if (Revealing)
            {
                int n = Mathf.Clamp(Mathf.FloorToInt((Time.unscaledTime - revealStart) * GameSettings.CharsPerSecond), 0, revealTarget.Length);
                if (n != bodyText.text.Length) bodyText.text = revealTarget.Substring(0, n);
                if (n >= revealTarget.Length) revealDoneAt = Time.unscaledTime;
                return;
            }
            if (Skip && Time.unscaledTime - lastSkip > 0.06f)
            {
                lastSkip = Time.unscaledTime;
                Advance();
                return;
            }
            if (Auto && revealDoneAt > 0f && Time.unscaledTime - revealDoneAt > GameSettings.AutoDelay(revealTarget.Length))
            {
                revealDoneAt = -1f;
                Advance();
            }
        }
    }
}
