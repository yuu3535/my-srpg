using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 開発用: 立ち絵の並びテスト（2026-11-14 原作者「2人会話と4人会話の時も出せるようにして、どういう挙動になるかも確認したい。
    /// じゃないと1人いじったところで画面での見栄えが分からない」）。
    /// 入口の画面の「立ち絵の並び」→ 2Dの探索の部屋で、2人か4人を選び、それぞれの枠に立つ人を選んで、見本の会話（会話枠 H）を流す。
    /// 会話の中で立ち絵を5回たたくと位置の調整パネル（ほかの人も並んだまま見ながら直せる）。終わると選ぶ画面に戻る。戻るときは右下の「最初へ」
    /// </summary>
    public class PortraitTalkDebug : MonoBehaviour
    {
        public static bool Pending;

        // 立ち絵のある人（DialogueView で絵が見つからない人は、選んでも舞台に立たない）
        private static readonly string[] Cast = { "アルシェ", "カリマ", "キャリー", "ギュンター", "ヘンリー", "アルバス" };

        private bool four;
        private readonly int[] pick = { 0, 2, 1, 3 };   // 2人: [左, 右]。4人: [左の外, 右の外, 左の内, 右の内]
        private RectTransform panel, slotsRoot;
        private Font font, fontEn;
        private readonly List<Text> slotNames = new List<Text>();
        private Text modeLabel;

        public static PortraitTalkDebug Attach()
        {
            Pending = false;
            return new GameObject("PortraitTalkDebug").AddComponent<PortraitTalkDebug>();
        }

        private IEnumerator Start()
        {
            font = Resources.Load<Font>("Fonts/ShipporiMincho-SemiBold") ?? StartMenu.FontOf();
            fontEn = Resources.Load<Font>("Fonts/BarlowCondensed-SemiBold") ?? font;
            yield return null;
            yield return null;
            // 部屋の物語（起きたときの会話・近づくと流れる会話）は止める。テストの会話のほかは、出たらすぐ閉じる（Update）
            var explore = FindFirstObjectByType<Explore2DController>();
            if (explore != null) explore.enabled = false;
            var view = FindFirstObjectByType<Corridor2DView>();
            if (view != null) view.Darkness = 0f;
            Build();
        }

        private bool playing;

        private void Update()
        {
            var dialogue = FindFirstObjectByType<DialogueView>();
            if (!playing && dialogue != null && dialogue.IsPlaying) dialogue.Close();
        }

        private void OnDestroy() => DialogueCast.DebugLeft = null;

        private void Build()
        {
            var go = new GameObject("PortraitTalkDebugCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            go.transform.SetParent(transform, false);
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 470;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1688f, 780f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;
            var root = (RectTransform)go.transform;
            panel = Node("Panel", root);
            panel.anchorMin = Vector2.zero; panel.anchorMax = Vector2.one; panel.sizeDelta = Vector2.zero;
            panel.gameObject.AddComponent<Image>().color = new Color(9f / 255f, 10f / 255f, 13f / 255f, Hub2Textures.Seen(0.88f));
            var area = Node("Area", panel);
            area.anchorMin = area.anchorMax = area.pivot = new Vector2(0.5f, 0.5f);
            area.sizeDelta = new Vector2(1688f, 780f);
            Label(area, "DEBUG", 150f, 40f, 200f, 24f, 15, new Color(0.89f, 0.69f, 0.29f), fontEn);
            Label(area, "立ち絵の並びテスト（開発用）", 150f, 64f, 900f, 48f, 34, new Color(0.98f, 0.96f, 0.91f), font);
            Label(area, "並びと人を選んで「会話を流す」。会話の中で立ち絵を5回たたくと調整パネル（ほかの人も並んだまま）。終わるとこの画面に戻ります。", 150f, 116f, 1400f, 26f, 16, new Color(0.65f, 0.62f, 0.56f), font);
            Button(area, "2人で", 150f, 170f, 150f, () => { four = false; Refresh(); });
            Button(area, "4人で", 316f, 170f, 150f, () => { four = true; Refresh(); });
            modeLabel = Label(area, "", 490f, 170f, 600f, 48f, 20, new Color(0.89f, 0.69f, 0.29f), font);
            slotsRoot = Node("Slots", area);
            slotsRoot.anchorMin = slotsRoot.anchorMax = slotsRoot.pivot = new Vector2(0f, 1f);
            slotsRoot.sizeDelta = Vector2.zero;
            Button(area, "この並びで会話を流す", 150f, 560f, 420f, Play);
            Refresh();
        }

        private string[] SlotTitles => four ? new[] { "左の外", "右の外", "左の内", "右の内" } : new[] { "左", "右" };

        private void Refresh()
        {
            modeLabel.text = four ? "4人の会話（左右に2人ずつ）" : "2人の会話（左右に1人ずつ・2人用の位置）";
            for (int i = slotsRoot.childCount - 1; i >= 0; i--) Destroy(slotsRoot.GetChild(i).gameObject);
            slotNames.Clear();
            var titles = SlotTitles;
            // 画面の並び（左の外・左の内・右の内・右の外）で見せる
            int[] order = four ? new[] { 0, 2, 3, 1 } : new[] { 0, 1 };
            for (int k = 0; k < order.Length; k++)
            {
                int s = order[k];
                float x = 150f + k * 340f;
                Label(slotsRoot, titles[s], x, 250f, 300f, 30f, 18, new Color(0.65f, 0.62f, 0.56f), font);
                Button(slotsRoot, "‹", x, 290f, 56f, () => { pick[s] = (pick[s] + Cast.Length - 1) % Cast.Length; UpdateNames(); });
                var name = Label(slotsRoot, "", x + 66f, 290f, 170f, 56f, 24, new Color(0.98f, 0.96f, 0.91f), font);
                name.alignment = TextAnchor.MiddleCenter;
                Button(slotsRoot, "›", x + 246f, 290f, 56f, () => { pick[s] = (pick[s] + 1) % Cast.Length; UpdateNames(); });
                while (slotNames.Count <= s) slotNames.Add(null);
                slotNames[s] = name;
            }
            UpdateNames();
        }

        private void UpdateNames()
        {
            for (int s = 0; s < slotNames.Count; s++) if (slotNames[s] != null) slotNames[s].text = Cast[pick[s]];
        }

        /// <summary>見本の会話: 選んだ順（外 → 内）に話す。1行と2行の台詞で吹き出しの大きさも見る。名前が重なったら、その人は1回だけ</summary>
        private void Play()
        {
            var dialogue = FindFirstObjectByType<DialogueView>();
            if (dialogue == null) return;
            int n = four ? 4 : 2;
            var who = new List<string>();
            var left = new HashSet<string>();
            for (int s = 0; s < n; s++)
            {
                string c = Cast[pick[s]];
                if (who.Contains(c)) continue;
                who.Add(c);
                if (s % 2 == 0) left.Add(c);   // 0・2 が左
            }
            DialogueCast.DebugLeft = left;   // 名前に関係なく、選んだ枠の側に立てる
            var lines = new List<ScenarioLine>();
            foreach (var c in who) lines.Add(new ScenarioLine { type = "line", speaker = c, text = $"{c}の台詞の見本です。" });
            foreach (var c in who) lines.Add(new ScenarioLine { type = "line", speaker = c, text = "二行の台詞の見本です。吹き出しの大きさと、立ち絵との重なりを確かめます。" });
            lines.Add(new ScenarioLine { type = "narration", text = "地の文の見本です。" });
            panel.gameObject.SetActive(false);
            playing = true;
            dialogue.Play(new ScenarioBlock { id = "", part = "story", lines = lines.ToArray(), location = "立ち絵の並びテスト" },
                () => { playing = false; DialogueCast.DebugLeft = null; if (panel != null) panel.gameObject.SetActive(true); });
        }

        private void Button(RectTransform parent, string text, float x, float y, float w, System.Action act)
        {
            var rt = Node("Button", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, 56f);
            var bg = rt.gameObject.AddComponent<Image>();
            bg.color = new Color(16f / 255f, 14f / 255f, 24f / 255f, Hub2Textures.Seen(0.85f));
            var b = rt.gameObject.AddComponent<UnityEngine.UI.Button>();
            b.onClick.AddListener(() => act());
            var t = Label(rt, text, 0f, 0f, w, 56f, 22, new Color(0.98f, 0.96f, 0.91f), font);
            t.alignment = TextAnchor.MiddleCenter;
        }

        private static RectTransform Node(string name, Transform parent)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            return rt;
        }

        private static Text Label(Transform parent, string text, float x, float y, float w, float h, int size, Color color, Font f)
        {
            var rt = Node("Text", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = f;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = TextAnchor.MiddleLeft;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }
    }
}
