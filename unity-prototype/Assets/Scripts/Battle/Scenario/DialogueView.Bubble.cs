using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 吹き出しの位置を「立つ枠」ごとに決める（原作者 2026-11-15「テキストボックスが画面のあちこちを行ったり来たりしてかなり見づらい。
    /// テキストボックスの位置を共通であらかじめ決めておいて吹き出しの位置を決められるような仕組みを」）。
    /// 枠: 2人用の左・右（1人のときも同じ）、3人・4人の並びの 左の外・左の内・右の内・右の外。話す人の背の高さに関係なく、同じ枠なら同じ所に出る。
    /// 文の長さで大きさが変わっても、上の端と、話す人の側の端（左の人は左の端・右の人は右の端）は動かない。尾の先は枠ごとに決めた点を指す。
    /// 調整は「DEV 立ち絵の並び」の「吹き出しの位置」から: 吹き出しをドラッグで動かす・尾の先の菱形をドラッグ・文を入れて（改行も）大きさを見る。
    /// 保存先: エディタでは Assets/Resources/Talk/bubble_slots.json（全員に効く）、書き出したゲームでは端末の中。ブラウザ版の値は「コピー」で総合担当へ
    /// </summary>
    public partial class DialogueView
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void SrpgEditText(string initial, TextDone done);
#endif
        private delegate void TextDone(IntPtr text);   // ブラウザの入力欄から戻る（IL2CPP は総称の delegate を渡せない）

        [Serializable]
        public class BubbleSlot
        {
            public string key;        // pairL / pairR / L1 / L2 / R2 / R1
            public float x, y;        // 話す人の側の端（左の人は左の端・右の人は右の端）と、上の端（1688×780 の座標）
            public float tipX, tipY;  // 尾の先
        }

        [Serializable] private class BubbleFile { public BubbleSlot[] items = Array.Empty<BubbleSlot>(); }

        private static readonly (string key, string name)[] BubbleSlotNames =
        {
            ("pairL", "1〜2人・左"), ("pairR", "1〜2人・右"), ("L1", "3〜4人・左の外"), ("L2", "3〜4人・左の内"), ("R2", "3〜4人・右の内"), ("R1", "3〜4人・右の外"),
        };

        private static string SlotName(string key) => BubbleSlotNames.FirstOrDefault(s => s.key == key).name ?? key;

        private static string EditorBubblePath => Path.Combine(Application.dataPath, "Resources", "Talk", "bubble_slots.json");
        private static string PlayerBubblePath => Path.Combine(Application.persistentDataPath, "bubble_slots.json");

        private readonly Dictionary<string, BubbleSlot> bubbleSlots = new Dictionary<string, BubbleSlot>();
        private readonly Dictionary<string, BubbleSlot> bubblePending = new Dictionary<string, BubbleSlot>();
        private RectTransform bubblePanel, bubbleGrab, tipGrab;
        private Text bubbleTitle, bubbleValues, bubbleState;
        private bool bubbleTop, bubbleDirty;
        private string editText;          // 調整中に見る文（null なら台詞のまま）
        private string bubbleKeyNow;      // 今の吹き出しの枠
        private Vector2 dragFrom;
        private BubbleSlot dragStart;

        public bool BubbleToolOpen => bubblePanel != null && bubblePanel.gameObject.activeSelf;
        /// <summary>立ち絵の調整か吹き出しの調整が出ている（会話を進めない）</summary>
        public bool ToolOpen => AdjusterOpen || BubbleToolOpen;
        /// <summary>今の吹き出しの枠（確認・テスト用。枠に立つ人が話していなければ null）</summary>
        public string BubbleSlotNow => bubbleKeyNow;

        private const string ShortSample = "短い台詞の見本。";
        private const string LongSample = "長い台詞の見本です。吹き出しの大きさと、\n立ち絵との重なりを確かめます。";

        private void LoadBubbleSlots()
        {
            bubbleSlots.Clear();
            void Read(string text)
            {
                if (string.IsNullOrEmpty(text)) return;
                try
                {
                    foreach (var s in JsonUtility.FromJson<BubbleFile>(text).items ?? Array.Empty<BubbleSlot>())
                        if (!string.IsNullOrEmpty(s.key)) bubbleSlots[s.key] = s;
                }
                catch (Exception e) { Debug.LogWarning($"[DialogueView] 吹き出しの位置を読めなかった: {e.Message}"); }
            }
            if (Application.isEditor && File.Exists(EditorBubblePath)) Read(File.ReadAllText(EditorBubblePath));
            else Read(Resources.Load<TextAsset>("Talk/bubble_slots")?.text);
            if (!Application.isEditor && File.Exists(PlayerBubblePath)) Read(File.ReadAllText(PlayerBubblePath));
        }

        /// <summary>保存した全部の位置（文字）。貼ってもらった文を Resources/Talk/bubble_slots.json に入れると全員に効く</summary>
        public string BubbleSlotsText() => JsonUtility.ToJson(new BubbleFile
        {
            items = BubbleSlotNames.Select(n => bubbleSlots.TryGetValue(n.key, out var s) ? s : null).Where(s => s != null).ToArray(),
        }, true);

        /// <summary>枠の頭の位置（立ち絵の並びの基準）</summary>
        private static Slot SlotOf(string key) => key switch
        {
            "pairL" => SupL1, "pairR" => SupR1, "L1" => SL1, "L2" => SL2, "R2" => SR2, _ => SR1,
        };

        private static bool SlotRight(string key) => key == "pairR" || key == "R1" || key == "R2";

        /// <summary>まだ決めていない枠の位置（前の「頭の上」の置き方に近い値）</summary>
        private static BubbleSlot DefaultBubble(string key)
        {
            var s = SlotOf(key);
            bool right = SlotRight(key);
            return new BubbleSlot { key = key, x = right ? s.headX + 70f : s.headX - 70f, y = 110f, tipX = s.headX + (right ? 14f : -14f), tipY = 300f };
        }

        /// <summary>その枠の吹き出しの位置（調整中は保存前の値）</summary>
        private BubbleSlot BubbleOf(string key)
        {
            if (BubbleToolOpen && bubblePending.TryGetValue(key, out var p)) return p;
            return bubbleSlots.TryGetValue(key, out var s) ? s : DefaultBubble(key);
        }

        private static BubbleSlot Copy(BubbleSlot s) => new BubbleSlot { key = s.key, x = s.x, y = s.y, tipX = s.tipX, tipY = s.tipY };

        /// <summary>
        /// 枠で決めた吹き出しの形（LayoutTalk から）。尾は、尾の先が吹き出しより下なら下の辺から、横なら横の辺から出す。
        /// shape は時計回り（上の辺 → 右の辺 → 下の辺 → 左の辺）
        /// </summary>
        private static void SlotTail(List<Vector2> shape, int edge, float x0, float y0, float x1, float y1, Vector2 tip)
        {
            // edge: 0＝右の辺（下へ向かう）・1＝下の辺（左へ向かう）・2＝左の辺（上へ向かう）
            if (edge == 0) { float by = Mathf.Clamp(tip.y - 24f, y0 + 26f, y1 - 26f); shape.Add(TP(x1, by - 13f)); shape.Add(TP(tip.x, tip.y)); shape.Add(TP(x1, by + 13f)); }
            else if (edge == 1) { float bx = Mathf.Clamp(tip.x, x0 + 40f, x1 - 40f); shape.Add(TP(bx + 12f, y1)); shape.Add(TP(tip.x, tip.y)); shape.Add(TP(bx - 12f, y1)); }
            else { float by = Mathf.Clamp(tip.y - 24f, y0 + 26f, y1 - 26f); shape.Add(TP(x0, by + 13f)); shape.Add(TP(tip.x, tip.y)); shape.Add(TP(x0, by - 13f)); }
        }

        private static int TailEdge(float x0, float y0, float x1, float y1, Vector2 tip)
        {
            if (tip.y > y1 + 8f || (tip.x >= x0 && tip.x <= x1)) return 1;
            return tip.x > x1 ? 0 : 2;
        }

        // ── 調整の道具 ──

        /// <summary>吹き出しの位置の調整を開く（「DEV 立ち絵の並び」から）。会話は進まず、前後の台詞は「前の台詞」「次の台詞」で</summary>
        public void OpenBubbleTool()
        {
            if (bubblePanel == null) return;
            if (AdjusterOpen) CloseAdjuster();
            bubblePending.Clear();
            bubbleDirty = false;
            editText ??= LongSample;
            bubblePanel.gameObject.SetActive(true);
            PlaceBubblePanel();
            RelayoutBubble();
        }

        private void CloseBubbleTool()
        {
            if (bubblePanel != null) bubblePanel.gameObject.SetActive(false);
            if (bubbleGrab != null) bubbleGrab.gameObject.SetActive(false);
            if (tipGrab != null) tipGrab.gameObject.SetActive(false);
            bubblePending.Clear();
            bubbleDirty = false;
            editText = null;
            if (CurrentLine != null) Relayout();
        }

        /// <summary>出し直す（吹き出しの位置・文・つかむ所・数値）</summary>
        private void RelayoutBubble()
        {
            Relayout();
            bool on = BubbleToolOpen && bubbleKeyNow != null;
            bubbleGrab.gameObject.SetActive(on);
            tipGrab.gameObject.SetActive(on);
            if (on)
            {
                var s = BubbleOf(bubbleKeyNow);
                TPlace(bubbleGrab, bx0, by0, bx1 - bx0, by1 - by0);
                tipGrab.anchorMin = tipGrab.anchorMax = new Vector2(0f, 1f);
                tipGrab.pivot = new Vector2(0.5f, 0.5f);
                tipGrab.anchoredPosition = new Vector2(s.tipX, -s.tipY);
            }
            if (bubbleValues == null) return;
            if (bubbleKeyNow == null)
            {
                bubbleTitle.text = "吹き出しの位置";
                bubbleValues.text = "この台詞は枠に立つ人ではない（地の文・携帯端末・立ち絵の無い人）。「前の台詞」「次の台詞」で選ぶ";
            }
            else
            {
                var s = BubbleOf(bubbleKeyNow);
                bubbleTitle.text = $"枠：{SlotName(bubbleKeyNow)}";
                bubbleValues.text = $"{(SlotRight(bubbleKeyNow) ? "右の端" : "左の端")} {s.x:0}　上の端 {s.y:0}　尾の先 ({s.tipX:0}, {s.tipY:0})　幅 {bx1 - bx0:0} × 高さ {by1 - by0:0}";
            }
            bool dirty = bubbleDirty || bubblePending.Count > 0;
            bubbleState.text = dirty ? "● 保存していない変更あり" : "保存済み";
            bubbleState.color = dirty ? HexC("#e8b860") : HexC("#a8a49c");
        }

        private void MoveBubble(float dx, float dy, bool tipOnly)
        {
            if (bubbleKeyNow == null) return;
            var s = bubblePending.TryGetValue(bubbleKeyNow, out var p) ? p : Copy(BubbleOf(bubbleKeyNow));
            if (!tipOnly) { s.x += dx; s.y += dy; }
            s.tipX += dx; s.tipY += dy;   // 吹き出しを動かすと尾の先も一緒に（尾の先だけは菱形で）
            s.x = Mathf.Clamp(s.x, 0f, TalkW); s.y = Mathf.Clamp(s.y, 0f, TalkH - 60f);
            s.tipX = Mathf.Clamp(s.tipX, 0f, TalkW); s.tipY = Mathf.Clamp(s.tipY, 0f, TalkH);
            bubblePending[bubbleKeyNow] = s;
            bubbleDirty = true;
            RelayoutBubble();
        }

        private void SaveBubbles()
        {
            foreach (var kv in bubblePending) bubbleSlots[kv.Key] = Copy(kv.Value);
            bubblePending.Clear();
            string path = Application.isEditor ? EditorBubblePath : PlayerBubblePath;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllText(path, BubbleSlotsText());
            }
            catch (Exception e) { Debug.LogWarning($"[DialogueView] 吹き出しの位置を保存できなかった: {e.Message}"); }
            bubbleDirty = false;
            RelayoutBubble();
        }

        private void ResetBubble()
        {
            if (bubbleKeyNow == null) return;
            bubblePending[bubbleKeyNow] = DefaultBubble(bubbleKeyNow);
            bubbleDirty = true;
            RelayoutBubble();
        }

        private void CopyBubbles()
        {
            string text = BubbleSlotsText();
#if UNITY_WEBGL && !UNITY_EDITOR
            SrpgCopyText(text);
#else
            GUIUtility.systemCopyBuffer = text;
#endif
            bubbleState.text = $"保存した{bubbleSlots.Count}つの枠をコピーした。総合担当に貼ってください（写せていなければ、もう一度画面をタップ）";
            bubbleState.color = HexC("#a8d8c8");
        }

        private void SetEditText(string text)
        {
            editText = string.IsNullOrEmpty(text) ? null : text.Replace("\r\n", "\n").Replace('\r', '\n');
            if (BubbleToolOpen) RelayoutBubble();
        }

        private static DialogueView textEditing;

        /// <summary>文を入れる（ブラウザ版はブラウザの入力欄。日本語の変換ができるように。エディタでは見本を順に）</summary>
        private void EditText()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            textEditing = this;
            WebGLInput.captureAllKeyboardInput = false;   // 入力欄に字が届くように
            SrpgEditText(editText ?? "", OnTextEdited);
#else
            string[] samples = { ShortSample, LongSample, "三行の見本です。\n二行を超えると、\n次のページへ送ります。", "改行なしの長い文の見本です。二十六字を超えると自動で折り返します。" };
            int i = Array.IndexOf(samples, editText);
            SetEditText(samples[(i + 1) % samples.Length]);
#endif
        }

        [AOT.MonoPInvokeCallback(typeof(TextDone))]
        private static void OnTextEdited(IntPtr ptr)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            WebGLInput.captureAllKeyboardInput = true;
#endif
            if (ptr == IntPtr.Zero || textEditing == null) return;   // 取り消し
            textEditing.SetEditText(Marshal.PtrToStringUTF8(ptr));
        }

        /// <summary>画面の点 → 1688×780 の座標（左上が原点）</summary>
        private Vector2 TalkPoint(Vector2 screen)
        {
            var cam = canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay ? canvas.worldCamera : null;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(content, screen, cam, out var local);
            return new Vector2(local.x + TalkW / 2f, TalkH / 2f - local.y);
        }

        private void AttachDrag(GameObject go, bool tipOnly)
        {
            var trig = go.AddComponent<EventTrigger>();
            var begin = new EventTrigger.Entry { eventID = EventTriggerType.BeginDrag };
            begin.callback.AddListener(d => { dragFrom = TalkPoint(((PointerEventData)d).position); });
            var drag = new EventTrigger.Entry { eventID = EventTriggerType.Drag };
            drag.callback.AddListener(d =>
            {
                var now = TalkPoint(((PointerEventData)d).position);
                var delta = now - dragFrom;
                dragFrom = now;
                MoveBubble(Mathf.Round(delta.x), Mathf.Round(delta.y), tipOnly);
            });
            trig.triggers.Add(begin);
            trig.triggers.Add(drag);
        }

        private void PlaceBubblePanel()
        {
            if (bubblePanel == null) return;
            float y = bubbleTop ? 60f : TalkH - 74f - PanelH - 8f;
            bubblePanel.anchoredPosition = new Vector2(24f, -y);
        }

        private void BuildBubbleTool(Font font)
        {
            // つかむ所（吹き出しの上に透明な面・尾の先に菱形）。調整のときだけ出す
            bubbleGrab = TNode("BubbleGrab", content);
            var gi = bubbleGrab.gameObject.AddComponent<Image>();
            gi.color = new Color(0.95f, 0.75f, 0.4f, 0.06f);
            var gol = bubbleGrab.gameObject.AddComponent<Outline>();
            gol.effectColor = new Color(0.95f, 0.75f, 0.4f, 0.85f);
            gol.effectDistance = new Vector2(1f, -1f);
            AttachDrag(bubbleGrab.gameObject, false);
            bubbleGrab.gameObject.SetActive(false);

            tipGrab = TNode("TipGrab", content);
            tipGrab.sizeDelta = new Vector2(30f, 30f);
            tipGrab.localRotation = Quaternion.Euler(0f, 0f, 45f);
            var ti = tipGrab.gameObject.AddComponent<Image>();
            ti.color = new Color(0.95f, 0.75f, 0.4f, 0.55f);
            var tol = tipGrab.gameObject.AddComponent<Outline>();
            tol.effectColor = new Color(1f, 1f, 1f, 0.9f);
            tol.effectDistance = new Vector2(1f, -1f);
            AttachDrag(tipGrab.gameObject, true);
            tipGrab.gameObject.SetActive(false);

            bubblePanel = TNode("BubbleTool", root);
            bubblePanel.anchorMin = bubblePanel.anchorMax = bubblePanel.pivot = new Vector2(0f, 1f);
            bubblePanel.sizeDelta = new Vector2(TalkW - 48f, PanelH);
            var bg = bubblePanel.gameObject.AddComponent<Image>();
            bg.color = Dark(Rgb(9, 10, 13), 0.9f);
            TFill(bubblePanel, 0f, 0f, TalkW - 48f, 1f, Light(Rgb(214, 218, 224, 0.72f)));
            TFill(bubblePanel, 0f, PanelH - 1f, TalkW - 48f, 1f, Light(Rgb(214, 218, 224, 0.72f)));
            TFill(bubblePanel, 0f, 5f, TalkW - 48f, 1f, Light(Rgb(214, 218, 224, 0.2f)));

            bubbleTitle = TLabel(bubblePanel, "吹き出しの位置", 20f, 12f, 300f, 30f, 20, HexC("#f1efe9"), 700);
            bubbleTitle.alignment = TextAnchor.MiddleLeft;
            bubbleValues = TLabel(bubblePanel, "", 320f, 12f, 760f, 30f, 16, HexC("#e4e7ec"), 600);
            bubbleValues.alignment = TextAnchor.MiddleLeft;
            bubbleState = TLabel(bubblePanel, "", 1090f, 12f, 540f, 30f, 15, HexC("#a8a49c"), 600);
            bubbleState.alignment = TextAnchor.MiddleLeft;
            var hint = TLabel(bubblePanel, "吹き出しをドラッグで動かす・菱形（尾の先）をドラッグ・同じ枠の人はみんな同じ位置になる。文の大きさが変わっても、上の端と話す人の側の端は動かない", 20f, 46f, 1400f, 14f, 12, HexC("#8f8a82"), 600);
            hint.alignment = TextAnchor.MiddleLeft;

            float x = 20f, y = 64f;
            void B(string label, float w, Action act)
            {
                var rt = TNode("Btn_" + label, bubblePanel);
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
                x += w + 6f;
            }
            void Gap() => x += 14f;
            B("短い文", 80f, () => SetEditText(ShortSample));
            B("長い文", 80f, () => SetEditText(LongSample));
            B("文を入れる（改行できる）", 230f, EditText);
            Gap();
            B("前の台詞", 96f, () => { StepLine(-1); RelayoutBubble(); });
            B("次の台詞", 96f, () => { StepLine(1); RelayoutBubble(); });
            Gap();
            B("左へ", 52f, () => MoveBubble(-4f, 0f, false));
            B("右へ", 52f, () => MoveBubble(4f, 0f, false));
            B("上へ", 52f, () => MoveBubble(0f, -4f, false));
            B("下へ", 52f, () => MoveBubble(0f, 4f, false));
            Gap();
            B("保存", 72f, SaveBubbles);
            B("この枠を元に戻す", 150f, ResetBubble);
            B("全部の位置をコピー（総合担当へ）", 300f, CopyBubbles);
            Gap();
            B("上へ／下へ", 112f, () => { bubbleTop = !bubbleTop; PlaceBubblePanel(); });
            B("閉じる", 80f, CloseBubbleTool);
            bubblePanel.gameObject.SetActive(false);
        }
    }
}
