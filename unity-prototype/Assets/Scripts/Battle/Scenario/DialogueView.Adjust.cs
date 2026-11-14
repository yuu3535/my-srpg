using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 立ち絵の位置の調整（原作者 2026-09-28。2026-11-14 に作り直し: 原作者「このuiだと正直使いにくい。効率的に直しが効くように」）。
    /// 会話中に立ち絵を素早く5回たたくと、画面の下に細い調整パネルが出る（会話枠 H と同じ黒い地に銀の線）。
    /// パネルが出ている間は、立ち絵を1回押すとその人を選ぶ。立ち絵をそのままドラッグで左右・上下、ホイール・「−」「＋」で大きさ、
    /// 「◀ ▶ ▲ ▼」や矢印キーで少しずつ。「前の台詞」「次の台詞」で会話を行き来しながら、ほかの吹き出しとの重なりを見られる。
    /// 保存は人ごと（表情ごとには分けない。立ち絵は仮置きで、表情の差分はポーズが変わらない予定。原作者 2026-11-14）。
    /// 保存先: エディタでは Assets/Data/portrait_adjust.json、書き出したゲームでは端末の中。ブラウザ版の値は「全部の調整をコピー」で総合担当へ
    /// </summary>
    public partial class DialogueView
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void SrpgCopyText(string text);
#endif

        [Serializable]
        public class PortraitAdjust
        {
            public string key;
            public float zoom = 1f;   // 1 より大きいと大きく映す
            public float dx, dy;      // 左右・上下（立ち絵の幅・高さに対する割合。+ で右・上へ）
        }

        [Serializable]
        private class AdjustFile { public PortraitAdjust[] items = Array.Empty<PortraitAdjust>(); }

        [SerializeField] private TextAsset adjustJson;   // Assets/Data/portrait_adjust.json（あれば）

        private readonly Dictionary<string, PortraitAdjust> adjusts = new Dictionary<string, PortraitAdjust>();
        private RectTransform adjustPanel, guides, balance;
        private int balanceMode;   // 0 なし・1 三分割・2 黄金比・3 両方
        private Text adjustTitle, adjustValues, adjustState;
        private string adjustWho;
        private string tapWho;
        private int tapCount;
        private float lastTap;
        private bool adjustTop, guidesOn, adjustDirty;
        private PortraitAdjust previewAdjust;

        private static string EditorAdjustPath => Path.Combine(Application.dataPath, "Data", "portrait_adjust.json");
        private static string PlayerAdjustPath => Path.Combine(Application.persistentDataPath, "portrait_adjust.json");

        private static string AdjustKey(string who, string expression) => string.IsNullOrEmpty(expression) ? who : $"{who}_{expression}";

        private void LoadAdjustments()
        {
            adjusts.Clear();
            void Read(string text)
            {
                if (string.IsNullOrEmpty(text)) return;
                try
                {
                    foreach (var a in JsonUtility.FromJson<AdjustFile>(text).items ?? Array.Empty<PortraitAdjust>())
                        if (!string.IsNullOrEmpty(a.key)) adjusts[a.key] = a;
                }
                catch (Exception e) { Debug.LogWarning($"[DialogueView] 立ち絵の調整を読めなかった: {e.Message}"); }
            }
            if (Application.isEditor && File.Exists(EditorAdjustPath)) Read(File.ReadAllText(EditorAdjustPath));
            else if (adjustJson != null) Read(adjustJson.text);
            if (!Application.isEditor && File.Exists(PlayerAdjustPath)) Read(File.ReadAllText(PlayerAdjustPath));
        }

        private void SaveAdjustments()
        {
            string path = Application.isEditor ? EditorAdjustPath : PlayerAdjustPath;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllText(path, AdjustmentsText());
            }
            catch (Exception e) { Debug.LogWarning($"[DialogueView] 立ち絵の調整を保存できなかった: {e.Message}"); }
        }

        /// <summary>調整した全部の値（文字）。貼ってもらった文を Assets/Data/portrait_adjust.json に入れると全員に効く</summary>
        public string AdjustmentsText() => JsonUtility.ToJson(new AdjustFile { items = adjusts.Values.OrderBy(a => a.key, StringComparer.Ordinal).ToArray() }, true);

        /// <summary>その人の調整（表情の調整があればそれ。今は人ごとに保存する）</summary>
        private PortraitAdjust AdjustOf(string who, string expression)
        {
            if (!string.IsNullOrEmpty(expression) && adjusts.TryGetValue(AdjustKey(who, expression), out var e)) return e;
            return adjusts.TryGetValue(who, out var a) ? a : null;
        }

        /// <summary>立ち絵をたたいた: パネルが出ていればその人を選ぶ。出ていなければ1回目は会話を進め、素早く5回で調整パネル</summary>
        private void OnPortraitTap(string who)
        {
            if (AdjusterOpen) { OpenAdjuster(who); return; }
            float now = Time.realtimeSinceStartup;
            if (who == tapWho && now - lastTap < 0.6f) tapCount++;
            else { tapCount = 1; tapWho = who; TapAdvance(); }   // 誤タップ対策つき
            lastTap = now;
            if (tapCount >= 5) { tapCount = 0; OpenAdjuster(who); }
        }

        /// <summary>調整パネルを開く（その人を選ぶ）</summary>
        public void OpenAdjuster(string who)
        {
            if (adjustPanel == null || string.IsNullOrEmpty(who)) return;
            adjustWho = who;
            var a = pending.TryGetValue(who, out var p) ? p : AdjustOf(who, null) ?? new PortraitAdjust();
            previewAdjust = new PortraitAdjust { zoom = a.zoom, dx = a.dx, dy = a.dy };
            adjustPanel.gameObject.SetActive(true);
            PlacePanel();
            Relayout();
            DrawBalance();
        }

        public bool AdjusterOpen => adjustPanel != null && adjustPanel.gameObject.activeSelf;

        // 変えた人の、保存前の値（別の人へ移っても消えない。「保存」で全部を保存）
        private readonly Dictionary<string, PortraitAdjust> pending = new Dictionary<string, PortraitAdjust>();

        private void CommitPreview()
        {
            if (adjustWho == null || previewAdjust == null) return;
            pending[adjustWho] = new PortraitAdjust { key = adjustWho, zoom = previewAdjust.zoom, dx = previewAdjust.dx, dy = previewAdjust.dy };
        }

        private void Nudge(float dzoom, float ddx, float ddy)
        {
            if (previewAdjust == null) return;
            previewAdjust.zoom = Mathf.Clamp(previewAdjust.zoom + dzoom, 0.5f, 2.5f);
            previewAdjust.dx = Mathf.Clamp(previewAdjust.dx + ddx, -1f, 1f);
            previewAdjust.dy = Mathf.Clamp(previewAdjust.dy + ddy, -1f, 1f);
            adjustDirty = true;
            CommitPreview();
            Relayout();
        }

        /// <summary>並べ直す（調整中の人は保存前の値で）。吹き出しも、立ち絵の新しい位置に合わせて出し直す</summary>
        private void Relayout()
        {
            if (adjustValues != null && previewAdjust != null)
            {
                adjustTitle.text = $"調整：{adjustWho}";
                adjustValues.text = $"大きさ {previewAdjust.zoom:0.00}　左右 {previewAdjust.dx:+0.00;-0.00;0.00}　上下 {previewAdjust.dy:+0.00;-0.00;0.00}";
                bool dirty = adjustDirty || pending.Count > 0;
                adjustState.text = dirty ? "● 保存していない変更あり" : "保存済み";
                adjustState.color = dirty ? HexC("#e8b860") : HexC("#a8a49c");
            }
            var line = CurrentLine;
            if (line == null) return;
            LayoutActors(line);
            string name = line.type == "phone" ? "携帯端末" : line.type == "narration" ? "" : line.speaker;
            int keepPage = page;
            LayoutTalk(line, name);   // 吹き出しの位置・大きさ（立ち絵の頭の位置について動く）
            page = Mathf.Clamp(keepPage, 0, Mathf.Max(0, pages.Length - 1));
            if (pages.Length > 0) { BeginReveal(pages[page]); FinishReveal(); }
            DrawGuides();
        }

        /// <summary>保存（変えた人ぜんぶ。人ごと）</summary>
        private void SaveAdjust()
        {
            CommitPreview();
            foreach (var kv in pending)
            {
                adjusts[kv.Key] = kv.Value;
                foreach (var k in adjusts.Keys.Where(k => k.StartsWith(kv.Key + "_", StringComparison.Ordinal)).ToList()) adjusts.Remove(k);   // 表情ごとの古い調整は消す
            }
            pending.Clear();
            SaveAdjustments();
            adjustDirty = false;
            Relayout();
        }

        private void ResetAdjust()
        {
            previewAdjust = new PortraitAdjust();
            adjustDirty = true;
            CommitPreview();
            Relayout();
        }

        private void CopyAdjustments()
        {
            string text = AdjustmentsText();
#if UNITY_WEBGL && !UNITY_EDITOR
            SrpgCopyText(text);
#else
            GUIUtility.systemCopyBuffer = text;
#endif
            adjustState.text = $"保存した{adjusts.Count}件をコピーした。総合担当に貼ってください（写せていなければ、もう一度画面をタップ）";
            adjustState.color = HexC("#a8d8c8");
        }

        private void CloseAdjuster()
        {
            if (adjustPanel != null) adjustPanel.gameObject.SetActive(false);
            if (guides != null) guides.gameObject.SetActive(false);
            if (balance != null) balance.gameObject.SetActive(false);
            adjustWho = null;
            previewAdjust = null;
            pending.Clear();
            adjustDirty = false;
            if (CurrentLine != null) Relayout();
        }

        /// <summary>調整中の人の値（保存前を含む）。並べるとき（PlaceSide）に使う</summary>
        private PortraitAdjust PreviewOf(string who)
        {
            if (!AdjusterOpen) return null;
            if (who == adjustWho && previewAdjust != null) return previewAdjust;
            return pending.TryGetValue(who, out var p) ? p : null;
        }

        // ── 毎コマ（ホイール・キー） ──

        private void UpdateAdjuster()
        {
            if (!AdjusterOpen || previewAdjust == null) return;
            var mouse = Mouse.current;
            if (mouse != null)
            {
                float s = mouse.scroll.ReadValue().y;
                if (Mathf.Abs(s) > 0.01f) Nudge(Mathf.Sign(s) * 0.02f, 0f, 0f);
            }
            var kb = Keyboard.current;
            if (kb == null) return;
            float step = kb.shiftKey.isPressed ? 0.02f : 0.005f;
            if (kb.leftArrowKey.wasPressedThisFrame) Nudge(0f, -step, 0f);
            if (kb.rightArrowKey.wasPressedThisFrame) Nudge(0f, step, 0f);
            if (kb.upArrowKey.wasPressedThisFrame) Nudge(0f, 0f, step);
            if (kb.downArrowKey.wasPressedThisFrame) Nudge(0f, 0f, -step);
            if (kb.equalsKey.wasPressedThisFrame || kb.numpadPlusKey.wasPressedThisFrame) Nudge(0.02f, 0f, 0f);
            if (kb.minusKey.wasPressedThisFrame || kb.numpadMinusKey.wasPressedThisFrame) Nudge(-0.02f, 0f, 0f);
        }

        /// <summary>立ち絵をドラッグで動かす（パネルが出ているときだけ。その人を選んで動かす）</summary>
        private void AttachPortraitDrag(GameObject go, string who)
        {
            var trig = go.AddComponent<EventTrigger>();
            var e = new EventTrigger.Entry { eventID = EventTriggerType.Drag };
            e.callback.AddListener(d =>
            {
                if (!AdjusterOpen) return;
                if (adjustWho != who) OpenAdjuster(who);
                var pe = (PointerEventData)d;
                float sf = canvas != null ? canvas.scaleFactor : 1f;
                if (!placed.TryGetValue(who, out var p) || p.width <= 0f) return;
                Nudge(0f, pe.delta.x / sf / p.width, pe.delta.y / sf / p.height);
            });
            trig.triggers.Add(e);
        }

        // ── 目安の線（選んでいる人の頭の位置・頭のてっぺん・絵の幅、今の吹き出しの範囲） ──

        private void DrawGuides()
        {
            if (guides == null) return;
            guides.gameObject.SetActive(guidesOn && AdjusterOpen);
            if (!guidesOn || !AdjusterOpen) return;
            for (int i = guides.childCount - 1; i >= 0; i--) Destroy(guides.GetChild(i).gameObject);
            var c = new Color(0.55f, 0.85f, 0.95f, 0.8f);
            if (adjustWho != null && placed.TryGetValue(adjustWho, out var p))
            {
                TFill(guides, p.headX - 0.5f, 0f, 1f, TalkH, c);                 // 頭の位置（吹き出しはここから 70px 外側に出る）
                TFill(guides, 0f, Mathf.Max(0f, p.top) - 0.5f, TalkW, 1f, c);   // 頭のてっぺん（吹き出しの下の端はこの 8px 上まで）
                TFill(guides, p.left, Mathf.Max(0f, p.top), 1f, TalkH, new Color(c.r, c.g, c.b, 0.35f));
                TFill(guides, p.left + p.width, Mathf.Max(0f, p.top), 1f, TalkH, new Color(c.r, c.g, c.b, 0.35f));
            }
            var b = new Color(0.95f, 0.75f, 0.4f, 0.85f);   // 今の吹き出し
            TFill(guides, bx0, by0, bx1 - bx0, 1f, b); TFill(guides, bx0, by1, bx1 - bx0, 1f, b);
            TFill(guides, bx0, by0, 1f, by1 - by0, b); TFill(guides, bx1, by0, 1f, by1 - by0, b);
        }

        // ── バランス線（原作者 2026-11-14「どこの位置に調整すると美しいか、目安があるとバランスとりやすい」） ──
        // 三分割（1/3・2/3）・黄金比（0.382・0.618）・まん中、と、立ち絵の枠のふつうの頭の位置（左の外・左の内・右の内・右の外、2人用）

        private static readonly string[] BalanceNames = { "バランス線：なし", "バランス線：三分割", "バランス線：黄金比", "バランス線：両方" };

        private void DrawBalance()
        {
            if (balance == null) return;
            for (int i = balance.childCount - 1; i >= 0; i--) Destroy(balance.GetChild(i).gameObject);
            balance.gameObject.SetActive(balanceMode > 0 && AdjusterOpen);
            if (balanceMode == 0 || !AdjusterOpen) return;
            var thirds = new Color(1f, 1f, 1f, 0.32f);
            var golden = new Color(0.98f, 0.82f, 0.45f, 0.42f);
            var center = new Color(1f, 1f, 1f, 0.16f);
            void V(float x, Color c, string label)
            {
                TFill(balance, x - 0.5f, 0f, 1f, TalkH, c);
                if (!string.IsNullOrEmpty(label)) { var t = TLabel(balance, label, x + 4f, 52f, 200f, 16f, 12, c, 600); t.alignment = TextAnchor.MiddleLeft; }
            }
            void Hz(float y, Color c, string label)
            {
                TFill(balance, 0f, y - 0.5f, TalkW, 1f, c);
                if (!string.IsNullOrEmpty(label)) { var t = TLabel(balance, label, 8f, y + 2f, 200f, 16f, 12, c, 600); t.alignment = TextAnchor.MiddleLeft; }
            }
            V(TalkW / 2f, center, "まん中");
            if (balanceMode == 1 || balanceMode == 3)
            {
                V(TalkW / 3f, thirds, "1/3"); V(TalkW * 2f / 3f, thirds, "2/3");
                Hz(TalkH / 3f, thirds, "1/3（目の高さの目安）"); Hz(TalkH * 2f / 3f, thirds, "2/3");
            }
            if (balanceMode == 2 || balanceMode == 3)
            {
                V(TalkW * 0.382f, golden, "黄金比"); V(TalkW * 0.618f, golden, "黄金比");
                Hz(TalkH * 0.382f, golden, "黄金比"); Hz(TalkH * 0.618f, golden, "");
            }
            // 枠のふつうの頭の位置（小さな印）。並び方で、どの枠の基準か分かるように
            var slotCol = new Color(0.55f, 0.85f, 0.95f, 0.7f);
            // 画面の上の端の近く（下は調整パネルに隠れるため）
            void Tick(float x, string label) { TFill(balance, x - 1f, 74f, 2f, 18f, slotCol); var t = TLabel(balance, label, x - 60f, 94f, 120f, 18f, 12, slotCol, 600); t.alignment = TextAnchor.MiddleCenter; }
            Tick(SL1.headX, "左の外"); Tick(SL2.headX, "左の内"); Tick(SR2.headX, "右の内"); Tick(SR1.headX, "右の外");
            Tick(SupL1.headX, "2人・左"); Tick(SupR1.headX, "2人・右");
        }

        // ── 組み立て（1688×780。会話枠 H と同じ黒い地に銀の線） ──

        private const float PanelH = 104f;

        private void PlacePanel()
        {
            if (adjustPanel == null) return;
            float y = adjustTop ? 60f : TalkH - 74f - PanelH - 8f;
            adjustPanel.anchoredPosition = new Vector2(24f, -y);
        }

        private void BuildAdjuster(Font font)
        {
            balance = TNode("BalanceGuides", root);
            balance.anchorMin = balance.anchorMax = balance.pivot = new Vector2(0f, 1f);
            balance.sizeDelta = Vector2.zero;
            balance.gameObject.SetActive(false);
            guides = TNode("AdjustGuides", root);
            guides.anchorMin = guides.anchorMax = guides.pivot = new Vector2(0f, 1f);
            guides.sizeDelta = Vector2.zero;
            guides.gameObject.SetActive(false);

            adjustPanel = TNode("Adjuster", root);
            adjustPanel.anchorMin = adjustPanel.anchorMax = adjustPanel.pivot = new Vector2(0f, 1f);
            adjustPanel.sizeDelta = new Vector2(TalkW - 48f, PanelH);
            var bg = adjustPanel.gameObject.AddComponent<Image>();
            bg.color = Dark(Rgb(9, 10, 13), 0.9f);
            TFill(adjustPanel, 0f, 0f, TalkW - 48f, 1f, Light(Rgb(214, 218, 224, 0.72f)));
            TFill(adjustPanel, 0f, PanelH - 1f, TalkW - 48f, 1f, Light(Rgb(214, 218, 224, 0.72f)));
            TFill(adjustPanel, 0f, 5f, TalkW - 48f, 1f, Light(Rgb(214, 218, 224, 0.2f)));

            adjustTitle = TLabel(adjustPanel, "調整", 20f, 12f, 260f, 30f, 20, HexC("#f1efe9"), 700);
            adjustTitle.alignment = TextAnchor.MiddleLeft;
            adjustValues = TLabel(adjustPanel, "", 270f, 12f, 520f, 30f, 17, HexC("#e4e7ec"), 600);
            adjustValues.alignment = TextAnchor.MiddleLeft;
            adjustState = TLabel(adjustPanel, "", 800f, 12f, 800f, 30f, 15, HexC("#a8a49c"), 600);
            adjustState.alignment = TextAnchor.MiddleLeft;
            var hint = TLabel(adjustPanel, "立ち絵を押して選ぶ・ドラッグで動かす・ホイールで大きさ・矢印キー（Shiftで大きく）", 20f, 46f, 900f, 14f, 12, HexC("#8f8a82"), 600);
            hint.alignment = TextAnchor.MiddleLeft;

            float x = 20f, y = 64f;
            float B(string label, float w, Action act)
            {
                var rt = TNode("Btn_" + label, adjustPanel);
                TPlace(rt, x, y, w, 32f);
                var img = rt.gameObject.AddComponent<Image>();
                img.color = Dark(Rgb(22, 20, 30), 0.95f);
                var ol = rt.gameObject.AddComponent<Outline>();
                ol.effectColor = Light(Rgb(214, 218, 224, 0.45f));
                ol.effectDistance = new Vector2(1f, -1f);
                var btn = rt.gameObject.AddComponent<Button>();
                btn.targetGraphic = img;
                btn.onClick.AddListener(() => act());
                var t = TLabel(rt, label, 0f, 0f, w, 32f, 15, HexC("#f1efe9"), 600);
                t.alignment = TextAnchor.MiddleCenter;
                return x += w + 6f;
            }
            void Gap() => x += 14f;
            B("−", 36f, () => Nudge(-0.02f, 0f, 0f));
            B("＋", 36f, () => Nudge(0.02f, 0f, 0f));
            Gap();
            B("◀", 36f, () => Nudge(0f, -0.005f, 0f));
            B("▶", 36f, () => Nudge(0f, 0.005f, 0f));
            B("▲", 36f, () => Nudge(0f, 0f, 0.005f));
            B("▼", 36f, () => Nudge(0f, 0f, -0.005f));
            Gap();
            B("前の台詞", 96f, () => StepLine(-1));
            B("次の台詞", 96f, () => StepLine(1));
            Gap();
            B("目安の線", 96f, () => { guidesOn = !guidesOn; DrawGuides(); });
            Text balanceLabel = null;
            B("バランス線：なし", 190f, () => { balanceMode = (balanceMode + 1) % 4; if (balanceLabel != null) balanceLabel.text = BalanceNames[balanceMode]; DrawBalance(); });
            balanceLabel = adjustPanel.Find("Btn_バランス線：なし").GetComponentInChildren<Text>();
            Gap();
            B("保存", 72f, SaveAdjust);
            B("元に戻す", 96f, ResetAdjust);
            B("全部の調整をコピー（総合担当へ）", 300f, CopyAdjustments);
            Gap();
            B("上へ／下へ", 112f, () => { adjustTop = !adjustTop; PlacePanel(); });
            B("閉じる", 80f, CloseAdjuster);
            adjustPanel.gameObject.SetActive(false);
        }
    }
}
