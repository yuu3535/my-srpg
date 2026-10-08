using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 会話の環境設定（2026-10-09）: 文字を少しずつ出す（文字の速さ）・オート・スキップ（既読だけ／未読も）。
    /// 押すと、文字を出している途中なら全部出し、出し終えていれば次へ。左上の「ログ」の右に「オート」「スキップ」
    /// </summary>
    public partial class DialogueView
    {
        private string revealTarget = "";
        private float revealStart, revealDoneAt = -1f;
        private bool currentRead;
        private float lastSkip;
        private Text autoLabel, skipLabel;

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

        /// <summary>「ログ」の右に「オート」「スキップ」（押すと切り替え。点いているときは明るい）</summary>
        private void BuildToggles(Font font)
        {
            autoLabel = ToggleButton("AutoButton", "オート", new Vector2(84f, -10f), font, () => { Auto = !Auto; if (Auto) Skip = false; RefreshToggles(); });
            skipLabel = ToggleButton("SkipButton", "スキップ", new Vector2(154f, -10f), font, () => { Skip = !Skip; if (Skip) { Auto = false; FinishReveal(); } RefreshToggles(); });
            RefreshToggles();
        }

        private Text ToggleButton(string name, string label, Vector2 pos, Font font, System.Action onClick)
        {
            var rt = NewRect(name, root);
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = new Vector2(64f, 20f);
            rt.anchoredPosition = pos;
            rt.gameObject.AddComponent<Image>().color = new Color32(12, 26, 35, 240);
            var line = rt.gameObject.AddComponent<Outline>();
            line.effectColor = new Color(borderCol.r, borderCol.g, borderCol.b, 0.7f);
            line.effectDistance = new Vector2(1f, -1f);
            rt.gameObject.AddComponent<Button>().onClick.AddListener(() => onClick());
            var text = NewText("Text", rt, font, 10, textCol, TextAnchor.MiddleCenter);
            text.text = label;
            Stretch(text.rectTransform);
            return text;
        }

        private void RefreshToggles()
        {
            if (autoLabel != null) { autoLabel.text = Auto ? "オート●" : "オート"; autoLabel.color = Auto ? Color.white : new Color(textCol.r, textCol.g, textCol.b, 0.75f); }
            if (skipLabel != null) { skipLabel.text = Skip ? "スキップ●" : "スキップ"; skipLabel.color = Skip ? Color.white : new Color(textCol.r, textCol.g, textCol.b, 0.75f); }
        }
    }
}
